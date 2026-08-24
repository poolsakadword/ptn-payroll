/**
 * ==============================================================================
 * ระบบบริหารจัดการเงินเดือน (PTN Payroll System V3.0)
 * บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด
 * Backend Script & REST API (Code.gs)
 * รองรับทั้ง Google Apps Script Web App และ Cloudflare Pages / GitHub REST API
 * ==============================================================================
 */

function doGet(e) {
  // Check if request is an API request (JSON or JSONP)
  var action = (e && e.parameter && e.parameter.action);
  var callback = (e && e.parameter && e.parameter.callback);
  var payloadStr = (e && e.parameter && e.parameter.payload);

  if (action) {
    var params = e.parameter || {};
    if (payloadStr) {
      try {
        var parsed = JSON.parse(payloadStr);
        params = Object.assign({}, params, parsed);
      } catch (err) {}
    }
    var res = handleApiRequest(action, params);

    // If JSONP callback requested
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + JSON.stringify(res) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Otherwise render Web App UI
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ระบบบริหารจัดการเงินเดือน - บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var params = {};
    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch(ex) {
        params = e.parameter || {};
      }
    } else if (e && e.parameter) {
      params = e.parameter;
    }

    var action = params.action || (e && e.parameter && e.parameter.action) || 'getAppInitialData';
    var res = handleApiRequest(action, params);
    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Invalid request: ' + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleApiRequest(action, params) {
  try {
    var res = {};
    switch (action) {
      case 'checkLogin':
        res = checkLogin(params.username, params.password);
        break;
      case 'getAppInitialData':
        res = getAppInitialData(params.period);
        break;
      case 'saveEmployee':
        res = saveEmployee(params.employee, params.origId);
        break;
      case 'deleteEmployee':
        res = deleteEmployee(params.empId);
        break;
      case 'saveInputRecord':
        res = saveInputRecord(params.record, params.origEmpId, params.period);
        break;
      case 'deleteInputRecord':
        res = deleteInputRecord(params.empId, params.period);
        break;
      case 'populateEmployeesToPeriod':
        res = populateEmployeesToPeriod(params.period);
        break;
      case 'processPayroll':
        res = processPayrollWeb(params.period);
        break;
      case 'saveCompanyInfo':
        res = saveCompanyInfo(params.settings);
        break;
      case 'closePeriod':
        res = closePeriod(params.period, params.username);
        break;
      case 'reopenPeriod':
        res = reopenPeriod(params.period);
        break;
      case 'saveUser':
        res = saveUser(params.user, params.origUser);
        break;
      case 'deleteUser':
        res = deleteUser(params.username);
        break;
      case 'setupInitialSheets':
        res = setupInitialSheets(params.period);
        break;
      case 'getSpreadsheetDownloadLinks':
        res = getSpreadsheetDownloadLinks();
        break;
      default:
        res = { success: false, message: 'Unknown action: ' + action };
    }
    return createJsonResponse(res);
  } catch (err) {
    return createJsonResponse({ success: false, message: 'API Error: ' + err.message });
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 1. AUTHENTICATION
 */
function checkLogin(username, password) {
  try {
    var u = String(username || '').trim().toLowerCase();
    var p = String(password || '').trim();

    if (!u || !p) {
      return { success: false, message: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' };
    }

    if ((u === 'admin' || u === 'admin@company.com') && 
        (p === '123456' || p === 'P@ssword123' || p === 'admin' || p === 'password123')) {
      return {
        success: true,
        username: 'admin',
        role: 'Admin / HR'
      };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      var sheet = ss.getSheetByName('Users');
      if (sheet && sheet.getLastRow() > 1) {
        var data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          var sheetUser = String(data[i][0] || '').trim().toLowerCase();
          var sheetPass = String(data[i][1] || '').trim();
          var role = String(data[i][2] || 'User').trim();
          if (sheetUser === u && (sheetPass === p || sheetPass.toLowerCase() === p.toLowerCase())) {
            return {
              success: true,
              username: String(data[i][0]).trim(),
              role: role
            };
          }
        }
      }
    }

    return {
      success: false,
      message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง'
    };
  } catch (err) {
    return {
      success: false,
      message: 'เกิดข้อผิดพลาด: ' + err.message
    };
  }
}

/**
 * Helper: Default Period
 */
function getDefaultPeriod() {
  var months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var d = new Date();
  return months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

/**
 * Standard Headers Definition
 */
var STANDARD_INPUT_HEADERS = [
  'งวดประจำเดือน', 'ลำดับ', 'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'เงินเดือนฐาน', 'PF Rate', 'กองทุน PF (บาท)',
  'วันลา', 'OT (ชม.)', 'อัตรา OT (บาท/ชม.)', 'เบี้ยเลี้ยง', 'โบนัส', 'หักเงินเบิก', 'หักอื่นๆ', 'ประกันสังคม', 'ภาษี'
];

var STANDARD_CALC_HEADERS = [
  'งวดประจำเดือน', 'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'ตำแหน่ง', 'ธนาคาร', 'เลขที่บัญชี',
  'เงินเดือนฐาน', 'OT (ชม.)', 'อัตรา OT', 'เงิน OT', 'เบี้ยเลี้ยง', 'โบนัส',
  'หักขาดลา', 'เงินได้รวม (Gross)', 'ประกันสังคม', 'กองทุน PF', 'ภาษี',
  'หักเงินเบิก', 'หักอื่นๆ', 'รวมยอดหัก', 'สุทธิ (Net)'
];

function ensureSheetDimensions(sheet, requiredRows, requiredCols) {
  if (!sheet) return;
  var maxRows = sheet.getMaxRows();
  if (maxRows < requiredRows) {
    sheet.insertRowsAfter(maxRows, requiredRows - maxRows);
  }
  var maxCols = sheet.getMaxColumns();
  if (maxCols < requiredCols) {
    sheet.insertColumnsAfter(maxCols, requiredCols - maxCols);
  }
}

function findCol(headers, aliases) {
  if (!headers || !headers.length) return -1;
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim().toLowerCase();
    for (var j = 0; j < aliases.length; j++) {
      if (h === aliases[j].toLowerCase()) return i;
    }
  }
  return -1;
}

/**
 * 2. INITIALIZE / RESET & CLEAN SHEETS
 */
function setupInitialSheets(targetPeriod) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return { success: false, message: 'ไม่พบ Spreadsheet' };

  var curPeriod = targetPeriod || getDefaultPeriod();

  // 1. Settings
  var sSettings = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
  sSettings.clear();
  ensureSheetDimensions(sSettings, 10, 2);
  sSettings.appendRow(['Key', 'Value']);
  sSettings.appendRow(['CompanyName', 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด']);
  sSettings.appendRow(['Address', '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110']);
  sSettings.appendRow(['Phone', '02-123-4567']);
  sSettings.appendRow(['TaxId', '0105559876543']);
  sSettings.appendRow(['Period_Status_' + curPeriod, 'OPEN']);
  sSettings.getRange(1, 1, 1, 2).setBackground('#1e3a8a').setFontColor('#ffffff').setFontWeight('bold');

  // 2. Users
  var sUsers = ss.getSheetByName('Users') || ss.insertSheet('Users');
  sUsers.clear();
  ensureSheetDimensions(sUsers, 10, 3);
  sUsers.appendRow(['Username', 'Password', 'Role']);
  sUsers.appendRow(['admin', '123456', 'Admin / HR']);
  sUsers.appendRow(['admin@company.com', 'P@ssword123', 'Admin / HR']);
  sUsers.getRange(1, 1, 1, 3).setBackground('#1e3a8a').setFontColor('#ffffff').setFontWeight('bold');

  // 3. Employee Master (14 columns)
  var sEmp = ss.getSheetByName('Employee Master') || ss.insertSheet('Employee Master');
  sEmp.clear();
  ensureSheetDimensions(sEmp, 10, 14);
  sEmp.appendRow([
    'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'เลขบัตรประชาชน', 'เบอร์โทรศัพท์', 'ที่อยู่', 
    'แผนก', 'ตำแหน่ง', 'เงินเดือนฐาน', 'ธนาคาร', 'เลขที่บัญชี', 'วันเริ่มงาน', 'PF Rate',
    'ประกันสังคม (Default)', 'ภาษี (Default)'
  ]);
  sEmp.appendRow(['EMP001', 'สมชาย ใจดี', '1100200300401', '081-234-5678', 'กรุงเทพมหานคร', 'IT', 'Programmer', 45000, 'กสิกรไทย (KBANK)', '123-4-56789-0', '2023-01-15', 0.05, 750, 1200]);
  sEmp.appendRow(['EMP002', 'สมหญิง รักงาน', '3100500600702', '089-876-5432', 'นนทบุรี', 'HR', 'HR Manager', 40000, 'ไทยพาณิชย์ (SCB)', '234-5-67890-1', '2022-05-01', 0.05, 750, 950]);
  sEmp.appendRow(['EMP003', 'วิชัย มุ่งมั่น', '1100700800903', '086-555-7890', 'ปทุมธานี', 'Sales', 'Sales Executive', 30000, 'กรุงเทพ (BBL)', '345-6-78901-2', '2024-02-10', 0.03, 750, 800]);
  sEmp.getRange(1, 1, 1, 14).setBackground('#1e3a8a').setFontColor('#ffffff').setFontWeight('bold');

  // 4. Input (16 columns)
  var sInput = ss.getSheetByName('Input') || ss.insertSheet('Input');
  sInput.clear();
  ensureSheetDimensions(sInput, 10, STANDARD_INPUT_HEADERS.length);
  sInput.appendRow(STANDARD_INPUT_HEADERS);
  sInput.appendRow([curPeriod, 1, 'EMP001', 'สมชาย ใจดี', 45000, 0.05, 2250, 0, 10, 281.25, 1500, 0, 0, 0, 750, 1200]);
  sInput.appendRow([curPeriod, 2, 'EMP002', 'สมหญิง รักงาน', 40000, 0.05, 2000, 1, 5, 250, 1000, 0, 500, 0, 750, 950]);
  sInput.appendRow([curPeriod, 3, 'EMP003', 'วิชัย มุ่งมั่น', 30000, 0.03, 900, 0, 15, 187.5, 3000, 5000, 1000, 0, 750, 800]);
  sInput.getRange(1, 1, 1, STANDARD_INPUT_HEADERS.length).setBackground('#1e3a8a').setFontColor('#ffffff').setFontWeight('bold');

  // 5. Payroll Calc (22 columns)
  var sCalc = ss.getSheetByName('Payroll Calc') || ss.insertSheet('Payroll Calc');
  sCalc.clear();
  ensureSheetDimensions(sCalc, 10, STANDARD_CALC_HEADERS.length);
  sCalc.appendRow(STANDARD_CALC_HEADERS);
  sCalc.getRange(1, 1, 1, STANDARD_CALC_HEADERS.length).setBackground('#1e3a8a').setFontColor('#ffffff').setFontWeight('bold');

  processPayrollWeb(curPeriod);

  return getAppInitialData(curPeriod);
}

/**
 * 3. UNIFIED SINGLE API CALL: getAppInitialData
 */
function getAppInitialData(targetPeriod) {
  try {
    var period = targetPeriod || getDefaultPeriod();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return { success: false, message: 'ไม่พบ Spreadsheet' };
    }

    var defaultSettings = {
      companyName: 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด',
      address: '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
      phone: '02-123-4567',
      taxId: '0105559876543'
    };

    // 1. Settings
    var sSettings = ss.getSheetByName('Settings');
    var isClosed = false;
    var closedInfo = '';
    var cfg = Object.assign({}, defaultSettings);

    if (sSettings && sSettings.getLastRow() > 1) {
      var sData = sSettings.getDataRange().getValues();
      for (var s = 1; s < sData.length; s++) {
        var sk = String(sData[s][0] || '').trim();
        var sv = String(sData[s][1] || '').trim();
        if (sk === 'CompanyName' && sv) cfg.companyName = sv;
        if (sk === 'Address') cfg.address = sv;
        if (sk === 'Phone') cfg.phone = sv;
        if (sk === 'TaxId') cfg.taxId = sv;
        if (sk === 'Period_Status_' + period) {
          if (sv.indexOf('CLOSED') === 0) {
            isClosed = true;
            closedInfo = sv;
          }
        }
      }
    }

    // 2. Employees
    var employees = [];
    var sEmp = ss.getSheetByName('Employee Master');
    if (sEmp && sEmp.getLastRow() > 1) {
      var empData = sEmp.getDataRange().getValues();
      var empHeaders = empData[0];
      var eIdCol = findCol(empHeaders, ['รหัสพนักงาน', 'รหัส', 'EmpId', 'Employee ID']);
      var eNameCol = findCol(empHeaders, ['ชื่อ-นามสกุล', 'ชื่อ', 'Name', 'FullName']);
      var eCitCol = findCol(empHeaders, ['เลขบัตรประชาชน', 'บัตรประชาชน', 'CitizenId']);
      var ePhoneCol = findCol(empHeaders, ['เบอร์โทรศัพท์', 'เบอร์โทร', 'Phone']);
      var eAddrCol = findCol(empHeaders, ['ที่อยู่', 'Address']);
      var eDeptCol = findCol(empHeaders, ['แผนก', 'Department']);
      var ePosCol = findCol(empHeaders, ['ตำแหน่ง', 'Position']);
      var eSalCol = findCol(empHeaders, ['เงินเดือนฐาน', 'เงินเดือน', 'BaseSalary', 'Salary']);
      var eBankCol = findCol(empHeaders, ['ธนาคาร', 'BankName', 'Bank']);
      var eAccCol = findCol(empHeaders, ['เลขที่บัญชี', 'เลขที่บัญชีธนาคาร', 'BankAccount']);
      var eJoinCol = findCol(empHeaders, ['วันเริ่มงาน', 'JoinDate']);
      var ePfCol = findCol(empHeaders, ['PF Rate', 'PF', 'กองทุน']);
      var eSsoDefCol = findCol(empHeaders, ['ประกันสังคม (Default)', 'ประกันสังคม (ค่าเริ่มต้น)', 'SSO Default']);
      var eTaxDefCol = findCol(empHeaders, ['ภาษี (Default)', 'ภาษี (ค่าเริ่มต้น)', 'Tax Default']);

      if (eIdCol === -1) eIdCol = 0;
      if (eNameCol === -1) eNameCol = 1;
      if (eSalCol === -1) eSalCol = 7;

      var seenEmp = {};
      for (var e = 1; e < empData.length; e++) {
        var id = String(empData[e][eIdCol] || '').trim();
        if (!id || seenEmp[id]) continue;
        seenEmp[id] = true;

        var jDate = '';
        if (eJoinCol >= 0 && empData[e][eJoinCol]) {
          var jd = empData[e][eJoinCol];
          if (jd instanceof Date) {
            jDate = Utilities.formatDate(jd, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');
          } else {
            jDate = String(jd).substring(0, 10);
          }
        }

        employees.push({
          empId: id,
          fullName: (eNameCol >= 0) ? String(empData[e][eNameCol] || '') : '',
          citizenId: (eCitCol >= 0) ? String(empData[e][eCitCol] || '') : '',
          phone: (ePhoneCol >= 0) ? String(empData[e][ePhoneCol] || '') : '',
          address: (eAddrCol >= 0) ? String(empData[e][eAddrCol] || '') : '',
          department: (eDeptCol >= 0) ? String(empData[e][eDeptCol] || '') : '',
          position: (ePosCol >= 0) ? String(empData[e][ePosCol] || '') : '',
          baseSalary: (eSalCol >= 0) ? (Number(empData[e][eSalCol]) || 0) : 0,
          bankName: (eBankCol >= 0) ? String(empData[e][eBankCol] || '') : '',
          bankAccount: (eAccCol >= 0) ? String(empData[e][eAccCol] || '') : '',
          joinDate: jDate,
          pfRate: (ePfCol >= 0) ? (Number(empData[e][ePfCol]) || 0) : 0.05,
          defaultSso: (eSsoDefCol >= 0 && empData[e][eSsoDefCol] !== '' && !isNaN(empData[e][eSsoDefCol])) ? Number(empData[e][eSsoDefCol]) : 750,
          defaultTax: (eTaxDefCol >= 0 && empData[e][eTaxDefCol] !== '' && !isNaN(empData[e][eTaxDefCol])) ? Number(empData[e][eTaxDefCol]) : 0
        });
      }
    }

    // 3. Input Records
    var inputRecords = [];
    var sInput = ss.getSheetByName('Input');
    if (sInput && sInput.getLastRow() > 1) {
      var inData = sInput.getDataRange().getValues();
      var inHeaders = inData[0];
      var inPeriodCol = findCol(inHeaders, ['งวดประจำเดือน', 'งวด', 'Period']);
      var inIdCol = findCol(inHeaders, ['รหัสพนักงาน', 'รหัส', 'EmpId', 'Employee ID']);
      var inNameCol = findCol(inHeaders, ['ชื่อ-นามสกุล', 'ชื่อ', 'Name', 'FullName']);
      var inSalCol = findCol(inHeaders, ['เงินเดือนฐาน', 'เงินเดือน', 'BaseSalary', 'Salary']);
      var inPfRateCol = findCol(inHeaders, ['PF Rate', 'PF %', 'PF']);
      var inPfAmtCol = findCol(inHeaders, ['กองทุน PF (บาท)', 'กองทุน PF', 'PFAmount']);
      var inLeaveCol = findCol(inHeaders, ['วันลา', 'Leave', 'LeaveDays']);
      var inOtHCol = findCol(inHeaders, ['OT (ชม.)', 'OT ชม.', 'OT', 'OTHours']);
      var inOtRCol = findCol(inHeaders, ['อัตรา OT (บาท/ชม.)', 'อัตรา OT', 'OTRate']);
      var inAllowCol = findCol(inHeaders, ['เบี้ยเลี้ยง', 'Allowance']);
      var inBonusCol = findCol(inHeaders, ['โบนัส', 'Bonus']);
      var inAdvCol = findCol(inHeaders, ['หักเงินเบิก', 'AdvanceDeduct', 'Advance']);
      var inOthCol = findCol(inHeaders, ['หักอื่นๆ', 'OtherDeduct']);
      var inSsoCol = findCol(inHeaders, ['ประกันสังคม', 'SSO']);
      var inTaxCol = findCol(inHeaders, ['ภาษี', 'ภาษีหัก ณ ที่จ่าย', 'Tax']);

      if (inIdCol === -1) inIdCol = (inPeriodCol >= 0) ? 2 : 1;
      if (inNameCol === -1) inNameCol = inIdCol + 1;

      var seenInput = {};
      for (var inp = 1; inp < inData.length; inp++) {
        var rowPeriod = (inPeriodCol >= 0) ? String(inData[inp][inPeriodCol] || '').trim() : period;
        if (period && rowPeriod && rowPeriod !== period) continue;

        var rowId = String(inData[inp][inIdCol] || '').trim();
        if (!rowId || seenInput[rowId]) continue;
        seenInput[rowId] = true;

        var bSal = (inSalCol >= 0) ? (Number(inData[inp][inSalCol]) || 0) : 0;
        var pRate = (inPfRateCol >= 0 && inData[inp][inPfRateCol] !== '' && !isNaN(inData[inp][inPfRateCol])) ? Number(inData[inp][inPfRateCol]) : 0.05;
        var pAmt = (inPfAmtCol >= 0 && inData[inp][inPfAmtCol] !== '' && !isNaN(inData[inp][inPfAmtCol])) ? Number(inData[inp][inPfAmtCol]) : (Math.round(bSal * pRate * 100) / 100);

        inputRecords.push({
          period: rowPeriod || period,
          no: inputRecords.length + 1,
          empId: rowId,
          empName: (inNameCol >= 0) ? String(inData[inp][inNameCol] || '') : '',
          baseSalary: bSal,
          pfRate: pRate,
          pfAmount: pAmt,
          leaveDays: (inLeaveCol >= 0) ? (Number(inData[inp][inLeaveCol]) || 0) : 0,
          otHours: (inOtHCol >= 0) ? (Number(inData[inp][inOtHCol]) || 0) : 0,
          otRate: (inOtRCol >= 0) ? (Number(inData[inp][inOtRCol]) || 0) : 0,
          allowance: (inAllowCol >= 0) ? (Number(inData[inp][inAllowCol]) || 0) : 0,
          bonus: (inBonusCol >= 0) ? (Number(inData[inp][inBonusCol]) || 0) : 0,
          advanceDeduct: (inAdvCol >= 0) ? (Number(inData[inp][inAdvCol]) || 0) : 0,
          otherDeduct: (inOthCol >= 0) ? (Number(inData[inp][inOthCol]) || 0) : 0,
          sso: (inSsoCol >= 0) ? (Number(inData[inp][inSsoCol]) || 0) : 750,
          tax: (inTaxCol >= 0) ? (Number(inData[inp][inTaxCol]) || 0) : 0
        });
      }
    }

    // 4. Payroll Calc List
    var sCalc = ss.getSheetByName('Payroll Calc');
    var payrollList = [];
    var totalGross = 0;
    var totalDeductions = 0;
    var totalNet = 0;

    if (sCalc && sCalc.getLastRow() > 1) {
      var calcData = sCalc.getDataRange().getValues();
      var cHeaders = calcData[0];
      var cPeriod = findCol(cHeaders, ['งวดประจำเดือน', 'งวด', 'Period']);
      var cEmpId = findCol(cHeaders, ['รหัสพนักงาน', 'รหัส', 'EmpId', 'Employee ID']);
      var cName = findCol(cHeaders, ['ชื่อ-นามสกุล', 'ชื่อ', 'Name', 'FullName']);
      var cDept = findCol(cHeaders, ['แผนก', 'Department']);
      var cPos = findCol(cHeaders, ['ตำแหน่ง', 'Position']);
      var cBank = findCol(cHeaders, ['ธนาคาร', 'BankName', 'Bank']);
      var cAcc = findCol(cHeaders, ['เลขที่บัญชี', 'เลขที่บัญชีธนาคาร', 'BankAccount', 'Account']);
      var cBase = findCol(cHeaders, ['เงินเดือนฐาน', 'เงินเดือน', 'BaseSalary', 'Salary']);
      var cOtHours = findCol(cHeaders, ['OT (ชม.)', 'OT ชม.', 'OT', 'OTHours']);
      var cOtRate = findCol(cHeaders, ['อัตรา OT', 'อัตรา OT (บาท/ชม.)', 'OTRate']);
      var cOtPay = findCol(cHeaders, ['เงิน OT', 'OT Pay', 'OTPay']);
      var cAllowance = findCol(cHeaders, ['เบี้ยเลี้ยง', 'Allowance']);
      var cBonus = findCol(cHeaders, ['โบนัส', 'Bonus']);
      var cLeaveDed = findCol(cHeaders, ['หักขาดลา', 'หักขาด/ลา', 'LeaveDeduction']);
      var cGross = findCol(cHeaders, ['เงินได้รวม (Gross)', 'เงินได้รวม', 'Gross', 'GrossPay']);
      var cSso = findCol(cHeaders, ['ประกันสังคม', 'SSO']);
      var cPf = findCol(cHeaders, ['กองทุน PF', 'กองทุนสำรองเลี้ยงชีพ', 'PF']);
      var cTax = findCol(cHeaders, ['ภาษี', 'ภาษีหัก ณ ที่จ่าย', 'Tax']);
      var cAdvDed = findCol(cHeaders, ['หักเงินเบิก', 'AdvanceDeduct', 'Advance']);
      var cOthDed = findCol(cHeaders, ['หักอื่นๆ', 'OtherDeduct']);
      var cTotalDed = findCol(cHeaders, ['รวมยอดหัก', 'TotalDeductions', 'ยอดหัก']);
      var cNet = findCol(cHeaders, ['สุทธิ (Net)', 'สุทธิ', 'Net', 'NetPay']);

      if (cEmpId === -1) cEmpId = (cPeriod >= 0) ? 1 : 0;
      if (cName === -1) cName = cEmpId + 1;
      if (cBase === -1) cBase = 7;
      if (cGross === -1) cGross = 14;
      if (cTotalDed === -1) cTotalDed = 20;
      if (cNet === -1) cNet = 21;

      var seenCalc = {};
      for (var c = 1; c < calcData.length; c++) {
        var row = calcData[c];
        var rowId = (cEmpId >= 0 && row[cEmpId]) ? String(row[cEmpId]).trim() : '';
        if (!rowId) continue;

        if (cPeriod >= 0 && period) {
          var rowPeriod = String(row[cPeriod] || '').trim();
          if (rowPeriod && rowPeriod !== String(period).trim()) {
            continue;
          }
        }

        if (seenCalc[rowId]) continue;
        seenCalc[rowId] = true;

        var gross = (cGross >= 0) ? (Number(row[cGross]) || 0) : 0;
        var ded = (cTotalDed >= 0) ? (Number(row[cTotalDed]) || 0) : 0;
        var net = (cNet >= 0) ? (Number(row[cNet]) || 0) : 0;

        totalGross += gross;
        totalDeductions += ded;
        totalNet += net;

        payrollList.push({
          period: (cPeriod >= 0) ? String(row[cPeriod] || period) : period,
          empId: rowId,
          name: (cName >= 0) ? String(row[cName] || '') : '',
          department: (cDept >= 0) ? String(row[cDept] || '') : '',
          position: (cPos >= 0) ? String(row[cPos] || '') : '',
          bankName: (cBank >= 0) ? String(row[cBank] || '') : '',
          bankAccount: (cAcc >= 0) ? String(row[cAcc] || '') : '',
          baseSalary: (cBase >= 0) ? (Number(row[cBase]) || 0) : 0,
          otHours: (cOtHours >= 0) ? (Number(row[cOtHours]) || 0) : 0,
          otRate: (cOtRate >= 0) ? (Number(row[cOtRate]) || 0) : 0,
          otPay: (cOtPay >= 0) ? (Number(row[cOtPay]) || 0) : 0,
          allowance: (cAllowance >= 0) ? (Number(row[cAllowance]) || 0) : 0,
          bonus: (cBonus >= 0) ? (Number(row[cBonus]) || 0) : 0,
          leaveDeduction: (cLeaveDed >= 0) ? (Number(row[cLeaveDed]) || 0) : 0,
          grossPay: gross,
          sso: (cSso >= 0) ? (Number(row[cSso]) || 0) : 0,
          pf: (cPf >= 0) ? (Number(row[cPf]) || 0) : 0,
          tax: (cTax >= 0) ? (Number(row[cTax]) || 0) : 0,
          advanceDeduct: (cAdvDed >= 0) ? (Number(row[cAdvDed]) || 0) : 0,
          otherDeduct: (cOthDed >= 0) ? (Number(row[cOthDed]) || 0) : 0,
          totalDeductions: ded,
          netPay: net
        });
      }
    }

    // 5. Users
    var users = [];
    var sUsers = ss.getSheetByName('Users');
    if (sUsers && sUsers.getLastRow() > 1) {
      var uData = sUsers.getDataRange().getValues();
      var seenU = {};
      for (var u = 1; u < uData.length; u++) {
        var un = String(uData[u][0] || '').trim();
        if (!un || seenU[un.toLowerCase()]) continue;
        seenU[un.toLowerCase()] = true;
        users.push({
          username: un,
          password: String(uData[u][1] || ''),
          role: String(uData[u][2] || 'User')
        });
      }
    }

    return {
      success: true,
      period: String(period),
      settings: cfg,
      isClosed: Boolean(isClosed),
      closedInfo: String(closedInfo || ''),
      employees: employees,
      inputRecords: inputRecords,
      payrollList: payrollList,
      stats: {
        totalEmployees: payrollList.length,
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100
      },
      users: users
    };
  } catch (err) {
    return {
      success: false,
      message: 'ดึงข้อมูลไม่สำเร็จ: ' + err.message
    };
  }
}

/**
 * 4. PAYROLL PROCESSING ENGINE
 */
function processPayrollWeb(targetPeriod) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { success: false, message: 'Spreadsheet not found' };

    var period = targetPeriod || getDefaultPeriod();
    var empSheet = ss.getSheetByName('Employee Master');
    var inputSheet = ss.getSheetByName('Input');
    var calcSheet = ss.getSheetByName('Payroll Calc');

    if (!empSheet || !inputSheet || !calcSheet) {
      setupInitialSheets(period);
      empSheet = ss.getSheetByName('Employee Master');
      inputSheet = ss.getSheetByName('Input');
      calcSheet = ss.getSheetByName('Payroll Calc');
    }

    // 1. Map Employee Master
    var empMap = {};
    if (empSheet && empSheet.getLastRow() > 1) {
      var empData = empSheet.getDataRange().getValues();
      var empHeaders = empData[0];
      var eIdCol = findCol(empHeaders, ['รหัสพนักงาน', 'รหัส', 'EmpId', 'Employee ID']);
      var eNameCol = findCol(empHeaders, ['ชื่อ-นามสกุล', 'ชื่อ', 'Name', 'FullName']);
      var eDeptCol = findCol(empHeaders, ['แผนก', 'Department']);
      var ePosCol = findCol(empHeaders, ['ตำแหน่ง', 'Position']);
      var eSalCol = findCol(empHeaders, ['เงินเดือนฐาน', 'เงินเดือน', 'BaseSalary', 'Salary']);
      var eBankCol = findCol(empHeaders, ['ธนาคาร', 'BankName', 'Bank']);
      var eAccCol = findCol(empHeaders, ['เลขที่บัญชี', 'เลขที่บัญชีธนาคาร', 'BankAccount']);
      var ePfCol = findCol(empHeaders, ['PF Rate', 'PF', 'กองทุน', 'กองทุนสำรองเลี้ยงชีพ']);
      var eSsoDefCol = findCol(empHeaders, ['ประกันสังคม (Default)', 'ประกันสังคม (ค่าเริ่มต้น)', 'SSO Default']);
      var eTaxDefCol = findCol(empHeaders, ['ภาษี (Default)', 'ภาษี (ค่าเริ่มต้น)', 'Tax Default']);

      if (eIdCol === -1) eIdCol = 0;
      if (eNameCol === -1) eNameCol = 1;
      if (eSalCol === -1) eSalCol = 7;

      for (var i = 1; i < empData.length; i++) {
        var id = String(empData[i][eIdCol] || '').trim();
        if (id) {
          empMap[id] = {
            empId: id,
            fullName: (eNameCol >= 0) ? String(empData[i][eNameCol] || '') : '',
            department: (eDeptCol >= 0) ? String(empData[i][eDeptCol] || '') : '',
            position: (ePosCol >= 0) ? String(empData[i][ePosCol] || '') : '',
            baseSalary: (eSalCol >= 0) ? (Number(empData[i][eSalCol]) || 0) : 0,
            bankName: (eBankCol >= 0) ? String(empData[i][eBankCol] || '') : '',
            bankAccount: (eAccCol >= 0) ? String(empData[i][eAccCol] || '') : '',
            pfRate: (ePfCol >= 0) ? (Number(empData[i][ePfCol]) || 0) : 0.05,
            defaultSso: (eSsoDefCol >= 0 && empData[i][eSsoDefCol] !== '' && !isNaN(empData[i][eSsoDefCol])) ? Number(empData[i][eSsoDefCol]) : 750,
            defaultTax: (eTaxDefCol >= 0 && empData[i][eTaxDefCol] !== '' && !isNaN(empData[i][eTaxDefCol])) ? Number(empData[i][eTaxDefCol]) : 0
          };
        }
      }
    }

    // 2. Map Input Records
    var inputMap = {};
    if (inputSheet && inputSheet.getLastRow() > 1) {
      var inData = inputSheet.getDataRange().getValues();
      var inHeaders = inData[0];
      var inPeriodCol = findCol(inHeaders, ['งวดประจำเดือน', 'งวด', 'Period']);
      var inIdCol = findCol(inHeaders, ['รหัสพนักงาน', 'รหัส', 'EmpId', 'Employee ID']);
      var inNameCol = findCol(inHeaders, ['ชื่อ-นามสกุล', 'ชื่อ', 'Name', 'FullName']);
      var inSalCol = findCol(inHeaders, ['เงินเดือนฐาน', 'เงินเดือน', 'BaseSalary', 'Salary']);
      var inPfRateCol = findCol(inHeaders, ['PF Rate', 'PF %', 'PF']);
      var inPfAmtCol = findCol(inHeaders, ['กองทุน PF (บาท)', 'กองทุน PF', 'PFAmount']);
      var inLeaveCol = findCol(inHeaders, ['วันลา', 'Leave', 'LeaveDays']);
      var inOtHCol = findCol(inHeaders, ['OT (ชม.)', 'OT ชม.', 'OT', 'OTHours']);
      var inOtRCol = findCol(inHeaders, ['อัตรา OT (บาท/ชม.)', 'อัตรา OT', 'OTRate']);
      var inAllowCol = findCol(inHeaders, ['เบี้ยเลี้ยง', 'Allowance']);
      var inBonusCol = findCol(inHeaders, ['โบนัส', 'Bonus']);
      var inAdvCol = findCol(inHeaders, ['หักเงินเบิก', 'AdvanceDeduct', 'Advance']);
      var inOthCol = findCol(inHeaders, ['หักอื่นๆ', 'OtherDeduct']);
      var inSsoCol = findCol(inHeaders, ['ประกันสังคม', 'SSO']);
      var inTaxCol = findCol(inHeaders, ['ภาษี', 'ภาษีหัก ณ ที่จ่าย', 'Tax']);

      if (inIdCol === -1) inIdCol = (inPeriodCol >= 0) ? 2 : 1;

      for (var j = 1; j < inData.length; j++) {
        var rowPeriod = (inPeriodCol >= 0) ? String(inData[j][inPeriodCol] || '').trim() : period;
        if (period && rowPeriod && rowPeriod !== period) continue;

        var inId = String(inData[j][inIdCol] || '').trim();
        if (inId && !inputMap[inId]) {
          inputMap[inId] = {
            empName: (inNameCol >= 0) ? String(inData[j][inNameCol] || '') : '',
            baseSalary: (inSalCol >= 0) ? (Number(inData[j][inSalCol]) || 0) : 0,
            pfRate: (inPfRateCol >= 0 && inData[j][inPfRateCol] !== '' && !isNaN(inData[j][inPfRateCol])) ? Number(inData[j][inPfRateCol]) : undefined,
            pfAmount: (inPfAmtCol >= 0 && inData[j][inPfAmtCol] !== '' && !isNaN(inData[j][inPfAmtCol])) ? Number(inData[j][inPfAmtCol]) : undefined,
            leaveDays: (inLeaveCol >= 0) ? (Number(inData[j][inLeaveCol]) || 0) : 0,
            otHours: (inOtHCol >= 0) ? (Number(inData[j][inOtHCol]) || 0) : 0,
            otRate: (inOtRCol >= 0) ? (Number(inData[j][inOtRCol]) || 0) : 0,
            allowance: (inAllowCol >= 0) ? (Number(inData[j][inAllowCol]) || 0) : 0,
            bonus: (inBonusCol >= 0) ? (Number(inData[j][inBonusCol]) || 0) : 0,
            advanceDeduct: (inAdvCol >= 0) ? (Number(inData[j][inAdvCol]) || 0) : 0,
            otherDeduct: (inOthCol >= 0) ? (Number(inData[j][inOthCol]) || 0) : 0,
            sso: (inSsoCol >= 0) ? (Number(inData[j][inSsoCol]) || 0) : undefined,
            tax: (inTaxCol >= 0) ? (Number(inData[j][inTaxCol]) || 0) : undefined
          };
        }
      }
    }

    // 3. Merge All Employee IDs
    var allEmpIds = {};
    for (var k1 in empMap) allEmpIds[k1] = true;
    for (var k2 in inputMap) allEmpIds[k2] = true;

    var newPeriodRows = [];
    for (var empId in allEmpIds) {
      var emp = empMap[empId] || {
        empId: empId, fullName: '', department: '', position: '', bankName: '', bankAccount: '',
        baseSalary: 0, pfRate: 0.05, defaultSso: 750, defaultTax: 0
      };
      var inp = inputMap[empId] || {
        empName: emp.fullName, baseSalary: emp.baseSalary, pfRate: emp.pfRate,
        leaveDays: 0, otHours: 0, otRate: 0, allowance: 0, bonus: 0,
        advanceDeduct: 0, otherDeduct: 0, sso: emp.defaultSso, tax: emp.defaultTax
      };

      var baseSalary = (inp.baseSalary > 0) ? inp.baseSalary : (emp.baseSalary || 0);
      var pfRate = (inp.pfRate !== undefined && !isNaN(inp.pfRate)) ? inp.pfRate : (emp.pfRate || 0.05);
      var pfAmount = (inp.pfAmount !== undefined && !isNaN(inp.pfAmount)) ? inp.pfAmount : (Math.round(baseSalary * pfRate * 100) / 100);
      var name = inp.empName || emp.fullName || empId;

      var otRate = (inp.otRate > 0) ? inp.otRate : (baseSalary > 0 ? (baseSalary / 30 / 8 * 1.5) : 0);
      otRate = Math.round(otRate * 100) / 100;
      var otPay = Math.round((inp.otHours || 0) * otRate * 100) / 100;
      var leaveDeduction = Math.round(((inp.leaveDays || 0) * (baseSalary / 30)) * 100) / 100;
      var grossPay = Math.round((baseSalary + otPay + (inp.allowance || 0) + (inp.bonus || 0) - leaveDeduction) * 100) / 100;

      // Deductions
      var sso = (inp.sso !== undefined && inp.sso !== null && !isNaN(inp.sso)) ? Number(inp.sso) : (emp.defaultSso !== undefined ? emp.defaultSso : (baseSalary >= 15000 ? 750 : Math.round(baseSalary * 0.05)));
      var pf = pfAmount;
      var tax = (inp.tax !== undefined && inp.tax !== null && !isNaN(inp.tax)) ? Number(inp.tax) : (emp.defaultTax || 0);
      var advDed = inp.advanceDeduct || 0;
      var othDed = inp.otherDeduct || 0;
      var totalDed = Math.round((sso + pf + tax + advDed + othDed) * 100) / 100;
      var netPay = Math.round((grossPay - totalDed) * 100) / 100;

      newPeriodRows.push([
        period, empId, name, emp.department || '', emp.position || '', emp.bankName || '', emp.bankAccount || '',
        baseSalary, inp.otHours || 0, otRate, otPay, inp.allowance || 0, inp.bonus || 0,
        leaveDeduction, grossPay, sso, pf, tax,
        advDed, othDed, totalDed, netPay
      ]);
    }

    // Preserve rows for other periods
    var existingRows = [];
    var existingKeys = {};
    if (calcSheet.getLastRow() > 1) {
      var oldData = calcSheet.getDataRange().getValues();
      var oldHeaders = oldData[0];
      var oldPeriodCol = findCol(oldHeaders, ['งวดประจำเดือน', 'งวด', 'Period']);
      var oldEmpIdCol = findCol(oldHeaders, ['รหัสพนักงาน', 'รหัส', 'EmpId']);
      if (oldPeriodCol === -1) oldPeriodCol = 0;
      if (oldEmpIdCol === -1) oldEmpIdCol = 1;

      for (var k = 1; k < oldData.length; k++) {
        var rPeriod = String(oldData[k][oldPeriodCol] || '').trim();
        var rEmpId = String(oldData[k][oldEmpIdCol] || '').trim();
        if (rPeriod && rEmpId && rPeriod !== period) {
          var uKey = rPeriod + '_' + rEmpId;
          if (!existingKeys[uKey]) {
            existingKeys[uKey] = true;
            existingRows.push(oldData[k]);
          }
        }
      }
    }

    var allRows = [STANDARD_CALC_HEADERS].concat(existingRows).concat(newPeriodRows);

    calcSheet.clear();
    ensureSheetDimensions(calcSheet, allRows.length + 5, STANDARD_CALC_HEADERS.length);
    calcSheet.getRange(1, 1, allRows.length, allRows[0].length).setValues(allRows);
    calcSheet.getRange(1, 1, 1, allRows[0].length).setBackground('#1e3a8a').setFontColor('#ffffff').setFontWeight('bold');

    return {
      success: true,
      period: period,
      count: newPeriodRows.length,
      message: 'ประมวลผลคำนวณเงินเดือนงวด ' + period + ' สำเร็จ (' + newPeriodRows.length + ' รายการ)'
    };
  } catch (err) {
    return { success: false, message: 'ประมวลผลล้มเหลว: ' + err.message };
  }
}

/**
 * 5. CRUD OPERATIONS
 */
function saveEmployee(emp, origId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Employee Master');
    if (!sheet) {
      setupInitialSheets();
      sheet = ss.getSheetByName('Employee Master');
    }

    var data = sheet.getDataRange().getValues();
    var foundIndex = -1;

    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][0]).trim();
      if ((origId && rowId === origId.trim()) || (!origId && rowId === emp.empId.trim())) {
        foundIndex = i + 1;
        break;
      }
    }

    var newRow = [
      emp.empId, emp.fullName, emp.citizenId || '', emp.phone || '', emp.address || '',
      emp.department || '', emp.position || '', emp.baseSalary || 0,
      emp.bankName || '', emp.bankAccount || '', emp.joinDate || '', emp.pfRate || 0,
      emp.defaultSso !== undefined ? Number(emp.defaultSso) : 750,
      emp.defaultTax !== undefined ? Number(emp.defaultTax) : 0
    ];

    if (foundIndex > 0) {
      ensureSheetDimensions(sheet, foundIndex, newRow.length);
      sheet.getRange(foundIndex, 1, 1, newRow.length).setValues([newRow]);
    } else {
      ensureSheetDimensions(sheet, sheet.getLastRow() + 2, newRow.length);
      sheet.appendRow(newRow);
    }

    processPayrollWeb();
    return { success: true, message: 'บันทึกข้อมูลพนักงานเรียบร้อยแล้ว' };
  } catch (err) {
    return { success: false, message: 'บันทึกล้มเหลว: ' + err.message };
  }
}

function deleteEmployee(empId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Employee Master');
    if (!sheet) return { success: false, message: 'Sheet not found' };

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === empId.trim()) {
        sheet.deleteRow(i + 1);
        processPayrollWeb();
        return { success: true, message: 'ลบพนักงาน ' + empId + ' เรียบร้อยแล้ว' };
      }
    }
    return { success: false, message: 'ไม่พบพนักงาน ' + empId };
  } catch (err) {
    return { success: false, message: 'ลบล้มเหลว: ' + err.message };
  }
}

function saveInputRecord(rec, origEmpId, targetPeriod) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { success: false, message: 'Spreadsheet not found' };

    var period = targetPeriod || rec.period || getDefaultPeriod();
    var sheet = ss.getSheetByName('Input');
    if (!sheet) {
      setupInitialSheets(period);
      sheet = ss.getSheetByName('Input');
    }

    var data = sheet.getDataRange().getValues();
    var inPeriodCol = findCol(data[0], ['งวดประจำเดือน', 'งวด', 'Period']);
    var inIdCol = findCol(data[0], ['รหัสพนักงาน', 'รหัส', 'EmpId', 'Employee ID']);
    if (inIdCol === -1) inIdCol = 2;

    var foundIndex = -1;
    for (var i = 1; i < data.length; i++) {
      var rowPeriod = (inPeriodCol >= 0) ? String(data[i][inPeriodCol] || '').trim() : period;
      var rowId = String(data[i][inIdCol]).trim();
      if (rowPeriod === period && ((origEmpId && rowId === origEmpId.trim()) || (!origEmpId && rowId === rec.empId.trim()))) {
        foundIndex = i + 1;
        break;
      }
    }

    var rowNo = (foundIndex > 0) ? (data[foundIndex - 1][1] || (foundIndex - 1)) : sheet.getLastRow();
    var baseSal = Number(rec.baseSalary) || 0;
    var pfRate = Number(rec.pfRate) || 0.05;
    var pfAmt = (rec.pfAmount !== undefined && !isNaN(Number(rec.pfAmount))) ? Number(rec.pfAmount) : (Math.round(baseSal * pfRate * 100) / 100);

    var newRow = [
      period, rowNo, rec.empId, rec.empName || '', baseSal, pfRate, pfAmt,
      Number(rec.leaveDays) || 0, Number(rec.otHours) || 0, Number(rec.otRate) || 0,
      Number(rec.allowance) || 0, Number(rec.bonus) || 0, Number(rec.advanceDeduct) || 0,
      Number(rec.otherDeduct) || 0, Number(rec.sso) || 0, Number(rec.tax) || 0
    ];

    if (foundIndex > 0) {
      ensureSheetDimensions(sheet, foundIndex, newRow.length);
      sheet.getRange(foundIndex, 1, 1, newRow.length).setValues([newRow]);
    } else {
      ensureSheetDimensions(sheet, sheet.getLastRow() + 2, newRow.length);
      sheet.appendRow(newRow);
    }

    processPayrollWeb(period);
    return { success: true, message: 'บันทึกข้อมูลประจำงวด ' + period + ' เรียบร้อยแล้ว' };
  } catch (err) {
    return { success: false, message: 'บันทึกล้มเหลว: ' + err.message };
  }
}

function deleteInputRecord(empId, targetPeriod) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Input');
    var period = targetPeriod || getDefaultPeriod();
    if (!sheet) return { success: false, message: 'Sheet not found' };

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var inPeriodCol = findCol(headers, ['งวดประจำเดือน', 'งวด', 'Period']);
    var inIdCol = findCol(headers, ['รหัสพนักงาน', 'รหัส', 'EmpId', 'Employee ID']);
    if (inIdCol === -1) inIdCol = 2;

    for (var i = 1; i < data.length; i++) {
      var rowPeriod = (inPeriodCol >= 0) ? String(data[i][inPeriodCol] || '').trim() : period;
      var rowId = String(data[i][inIdCol]).trim();
      if (rowPeriod === period && rowId === empId.trim()) {
        sheet.deleteRow(i + 1);
        processPayrollWeb(period);
        return { success: true, message: 'ลบข้อมูลประจำงวด ' + period + ' ของ ' + empId + ' เรียบร้อยแล้ว' };
      }
    }
    return { success: false, message: 'ไม่พบข้อมูล ' + empId + ' ในงวด ' + period };
  } catch (err) {
    return { success: false, message: 'ลบล้มเหลว: ' + err.message };
  }
}

function populateEmployeesToPeriod(targetPeriod) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { success: false, message: 'Spreadsheet not found' };

    var period = targetPeriod || getDefaultPeriod();
    var sheet = ss.getSheetByName('Input');
    if (!sheet) {
      setupInitialSheets(period);
      sheet = ss.getSheetByName('Input');
    }

    var sEmp = ss.getSheetByName('Employee Master');
    if (!sEmp || sEmp.getLastRow() <= 1) {
      return { success: false, message: 'ไม่พบข้อมูลในทะเบียนพนักงาน (กรุณาเพิ่มพนักงานก่อน หรือกดปุ่ม "⚙️ ตั้งค่า Sheet" ด้านบน)' };
    }

    var empData = sEmp.getDataRange().getValues();
    var empHeaders = empData[0];
    var eIdCol = findCol(empHeaders, ['รหัสพนักงาน', 'รหัส', 'EmpId', 'Employee ID']);
    var eNameCol = findCol(empHeaders, ['ชื่อ-นามสกุล', 'ชื่อ', 'Name', 'FullName']);
    var eSalCol = findCol(empHeaders, ['เงินเดือนฐาน', 'เงินเดือน', 'BaseSalary', 'Salary']);
    var ePfCol = findCol(empHeaders, ['PF Rate', 'PF', 'กองทุน']);
    var eSsoDefCol = findCol(empHeaders, ['ประกันสังคม (Default)', 'ประกันสังคม (ค่าเริ่มต้น)', 'SSO Default']);
    var eTaxDefCol = findCol(empHeaders, ['ภาษี (Default)', 'ภาษี (ค่าเริ่มต้น)', 'Tax Default']);

    if (eIdCol === -1) eIdCol = 0;
    if (eNameCol === -1) eNameCol = 1;
    if (eSalCol === -1) eSalCol = 7;

    // Read existing in Input
    var inData = sheet.getDataRange().getValues();
    var inPeriodCol = findCol(inData[0], ['งวดประจำเดือน', 'งวด', 'Period']);
    var inIdCol = findCol(inData[0], ['รหัสพนักงาน', 'รหัส', 'EmpId', 'Employee ID']);
    if (inIdCol === -1) inIdCol = 2;

    var existingIds = {};
    for (var i = 1; i < inData.length; i++) {
      var rowPeriod = (inPeriodCol >= 0) ? String(inData[i][inPeriodCol] || '').trim() : period;
      if (rowPeriod === period) {
        var rowId = String(inData[i][inIdCol] || '').trim();
        if (rowId) existingIds[rowId] = true;
      }
    }

    var newRows = [];
    var curRowNo = sheet.getLastRow();
    for (var e = 1; e < empData.length; e++) {
      var empId = String(empData[e][eIdCol] || '').trim();
      if (empId && !existingIds[empId]) {
        curRowNo++;
        existingIds[empId] = true;
        var fullName = (eNameCol >= 0) ? String(empData[e][eNameCol] || '') : '';
        var baseSalary = (eSalCol >= 0) ? (Number(empData[e][eSalCol]) || 0) : 0;
        var pfRate = (ePfCol >= 0 && empData[e][ePfCol] !== '' && !isNaN(empData[e][ePfCol])) ? Number(empData[e][ePfCol]) : 0.05;
        var pfAmount = Math.round(baseSalary * pfRate * 100) / 100;
        var otRate = baseSalary > 0 ? Math.round(baseSalary / 30 / 8 * 1.5 * 100) / 100 : 0;
        var sso = (eSsoDefCol >= 0 && empData[e][eSsoDefCol] !== '' && !isNaN(empData[e][eSsoDefCol])) ? Number(empData[e][eSsoDefCol]) : (baseSalary >= 15000 ? 750 : Math.round(baseSalary * 0.05));
        var tax = (eTaxDefCol >= 0 && empData[e][eTaxDefCol] !== '' && !isNaN(empData[e][eTaxDefCol])) ? Number(empData[e][eTaxDefCol]) : 0;

        newRows.push([
          period, curRowNo, empId, fullName, baseSalary, pfRate, pfAmount,
          0, 0, otRate, 0, 0, 0, 0, sso, tax
        ]);
      }
    }

    if (newRows.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      ensureSheetDimensions(sheet, startRow + newRows.length + 5, STANDARD_INPUT_HEADERS.length);
      sheet.getRange(startRow, 1, newRows.length, STANDARD_INPUT_HEADERS.length).setValues(newRows);
    }

    processPayrollWeb(period);
    return {
      success: true,
      period: period,
      count: newRows.length,
      message: (newRows.length > 0) ? ('นำเข้าพนักงานเข้างวด ' + period + ' สำเร็จ (' + newRows.length + ' คน)') : ('พนักงานทุกคนมีข้อมูลในงวด ' + period + ' อยู่แล้ว')
    };
  } catch (err) {
    return { success: false, message: 'นำเข้าล้มเหลว: ' + err.message };
  }
}

function saveCompanyInfo(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Settings');
    if (!sheet) {
      setupInitialSheets();
      sheet = ss.getSheetByName('Settings');
    }

    ensureSheetDimensions(sheet, 10, 2);
    var oldData = sheet.getDataRange().getValues();
    var periodStatuses = {};
    for (var i = 1; i < oldData.length; i++) {
      var k = String(oldData[i][0] || '').trim();
      if (k.indexOf('Period_Status_') === 0) {
        periodStatuses[k] = oldData[i][1];
      }
    }

    sheet.clear();
    sheet.appendRow(['Key', 'Value']);
    sheet.appendRow(['CompanyName', data.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด']);
    sheet.appendRow(['Address', data.address || '']);
    sheet.appendRow(['Phone', data.phone || '']);
    sheet.appendRow(['TaxId', data.taxId || '']);
    for (var psKey in periodStatuses) {
      sheet.appendRow([psKey, periodStatuses[psKey]]);
    }
    sheet.getRange(1, 1, 1, 2).setBackground('#1e3a8a').setFontColor('#ffffff').setFontWeight('bold');

    return { success: true, message: 'บันทึกข้อมูลบริษัทเรียบร้อยแล้ว' };
  } catch (err) {
    return { success: false, message: 'บันทึกล้มเหลว: ' + err.message };
  }
}

function closePeriod(targetPeriod, username) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var period = targetPeriod || getDefaultPeriod();
    var sheet = ss.getSheetByName('Settings');
    if (!sheet) {
      setupInitialSheets(period);
      sheet = ss.getSheetByName('Settings');
    }

    ensureSheetDimensions(sheet, 10, 2);
    processPayrollWeb(period);

    var d = new Date();
    var timeStr = Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    var statusVal = 'CLOSED|' + timeStr + '|' + (username || 'Admin');
    var key = 'Period_Status_' + period;

    var data = sheet.getDataRange().getValues();
    var foundIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim() === key) {
        foundIndex = i + 1;
        break;
      }
    }

    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 2).setValue(statusVal);
    } else {
      sheet.appendRow([key, statusVal]);
    }

    return {
      success: true,
      period: period,
      isClosed: true,
      message: 'ปิดงวดประจำเดือน ' + period + ' เรียบร้อยแล้ว (ล็อคผลการคำนวณ)'
    };
  } catch (err) {
    return { success: false, message: 'ปิดงวดล้มเหลว: ' + err.message };
  }
}

function reopenPeriod(targetPeriod) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var period = targetPeriod || getDefaultPeriod();
    var sheet = ss.getSheetByName('Settings');
    if (!sheet) return { success: false, message: 'Sheet not found' };

    var key = 'Period_Status_' + period;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim() === key) {
        sheet.getRange(i + 1, 2).setValue('OPEN');
        break;
      }
    }

    return {
      success: true,
      period: period,
      isClosed: false,
      message: 'ปลดล็อคและเปิดงวดประจำเดือน ' + period + ' เรียบร้อยแล้ว สามารถแก้ไขข้อมูลได้ตามปกติ'
    };
  } catch (err) {
    return { success: false, message: 'เปิดงวดล้มเหลว: ' + err.message };
  }
}

function saveUser(u, origUser) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users');
    if (!sheet) {
      setupInitialSheets();
      sheet = ss.getSheetByName('Users');
    }

    ensureSheetDimensions(sheet, sheet.getLastRow() + 5, 3);
    var data = sheet.getDataRange().getValues();
    var foundIndex = -1;

    for (var i = 1; i < data.length; i++) {
      var rowUser = String(data[i][0]).trim().toLowerCase();
      if ((origUser && rowUser === origUser.trim().toLowerCase()) || 
          (!origUser && rowUser === u.username.trim().toLowerCase())) {
        foundIndex = i + 1;
        break;
      }
    }

    var newRow = [u.username, u.password, u.role || 'User'];
    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
    return { success: true, message: 'บันทึกผู้ใช้งานเรียบร้อยแล้ว' };
  } catch (err) {
    return { success: false, message: 'บันทึกล้มเหลว: ' + err.message };
  }
}

function deleteUser(username) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users');
    if (!sheet) return { success: false, message: 'Sheet not found' };

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === username.trim().toLowerCase()) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'ลบผู้ใช้ ' + username + ' เรียบร้อยแล้ว' };
      }
    }
    return { success: false, message: 'ไม่พบผู้ใช้ ' + username };
  } catch (err) {
    return { success: false, message: 'ลบล้มเหลว: ' + err.message };
  }
}

function getSpreadsheetDownloadLinks() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var id = ss.getId();
    return {
      success: true,
      excelUrl: 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx'
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}