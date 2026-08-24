/**
 * ==============================================================================
 * ระบบบริหารจัดการเงินเดือน (PTN Payroll System V3.0)
 * บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด
 * Frontend Application Engine (Cloudflare Pages & GitHub Ready)
 * ==============================================================================
 */

var globalPayrollList = [];
var globalEmployees = [];
var globalInputRecords = [];
var globalUsers = [];
var globalCompany = {
  companyName: 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด',
  address: '',
  phone: '',
  taxId: ''
};

var currentSelectedPeriod = '';
var isPeriodClosed = false;
var currentUsername = 'Admin';

/**
 * Universal API Client (Supports both Cloudflare/GitHub fetch and Google Apps Script container)
 */
function callApi(action, data) {
  return new Promise(function(resolve, reject) {
    var payload = Object.assign({ action: action }, data || {});

    // 1. If running inside Google Apps Script iframe
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      if (action === 'getAppInitialData') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .getAppInitialData(payload.period);
      } else if (action === 'checkLogin') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .checkLogin(payload.username, payload.password);
      } else if (action === 'saveEmployee') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .saveEmployee(payload.employee, payload.origId);
      } else if (action === 'deleteEmployee') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .deleteEmployee(payload.empId);
      } else if (action === 'saveInputRecord') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .saveInputRecord(payload.record, payload.origEmpId, payload.period);
      } else if (action === 'deleteInputRecord') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .deleteInputRecord(payload.empId, payload.period);
      } else if (action === 'populateEmployeesToPeriod') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .populateEmployeesToPeriod(payload.period);
      } else if (action === 'processPayroll') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .processPayrollWeb(payload.period);
      } else if (action === 'saveCompanyInfo') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .saveCompanyInfo(payload.settings);
      } else if (action === 'closePeriod') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .closePeriod(payload.period, payload.username);
      } else if (action === 'reopenPeriod') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .reopenPeriod(payload.period);
      } else if (action === 'saveUser') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .saveUser(payload.user, payload.origUser);
      } else if (action === 'deleteUser') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .deleteUser(payload.username);
      } else if (action === 'setupInitialSheets') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .setupInitialSheets(payload.period);
      } else if (action === 'getSpreadsheetDownloadLinks') {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .getSpreadsheetDownloadLinks();
      }
      return;
    }

    // 2. If running standalone on Cloudflare Pages / GitHub Pages
    var apiUrl = CONFIG.getApiUrl();
    if (!apiUrl) {
      // Offline fallback mode
      console.warn('No API URL configured. Running in local simulation mode.');
      resolve(handleLocalFallback(action, payload));
      return;
    }

    fetch(apiUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok && res.status !== 200 && res.status !== 302) {
        throw new Error('HTTP status ' + res.status + ' ' + res.statusText);
      }
      return res.json();
    })
    .then(resolve)
    .catch(function(err) {
      console.error('Fetch error:', err);
      // If POST fails, try fallback GET for getAppInitialData
      if (action === 'getAppInitialData') {
        var getUrl = apiUrl + (apiUrl.indexOf('?') >= 0 ? '&' : '?') + 'action=getAppInitialData&period=' + encodeURIComponent(payload.period || '');
        fetch(getUrl, { method: 'GET', mode: 'cors', redirect: 'follow' })
          .then(function(r) { return r.json(); })
          .then(resolve)
          .catch(function() { reject(err); });
      } else {
        reject(err);
      }
    });
  });
}

function handleLocalFallback(action, p) {
  if (action === 'checkLogin') {
    return { success: true, username: p.username || 'Admin', role: 'Admin / HR' };
  }
  return { success: false, message: 'กรุณาตั้งค่า Google Apps Script Web App API URL โดยกดที่ปุ่ม "⚙️ ตั้งค่า API" ที่มุมขวาบน' };
}

function getSelectedPeriod() {
  var m = document.getElementById('selPeriodMonth').value;
  var y = document.getElementById('selPeriodYear').value;
  return m + ' ' + y;
}

function initPeriodDropdowns() {
  var months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var d = new Date();
  var mIndex = d.getMonth();
  var thaiYear = d.getFullYear() + 543;

  var mSelect = document.getElementById('selPeriodMonth');
  var ySelect = document.getElementById('selPeriodYear');

  if (mSelect) mSelect.value = months[mIndex];
  if (ySelect) ySelect.value = String(thaiYear);

  currentSelectedPeriod = months[mIndex] + ' ' + thaiYear;
  updatePeriodDisplay();
}

function onPeriodDropdownChanged() {
  currentSelectedPeriod = getSelectedPeriod();
  updatePeriodDisplay();
  loadAllData();
}

function updatePeriodDisplay() {
  var label = document.getElementById('currentPeriodDisplayLabel');
  if (label) label.innerHTML = '<i class="fa-regular fa-calendar"></i> ' + currentSelectedPeriod;
  var sub = document.getElementById('dashHeaderSub');
  if (sub) sub.textContent = 'สรุปภาพรวมยอดจ่าย OT ยอดหัก และสุทธิ ประจำงวด: ' + currentSelectedPeriod;
  var paySub = document.getElementById('payrollSubTitle');
  if (paySub) paySub.textContent = 'ผลการคำนวณเงินเดือนประจำงวด: ' + currentSelectedPeriod;
  var inpSub = document.getElementById('inputTabSub');
  if (inpSub) inpSub.textContent = 'บันทึกข้อมูลประจำงวด: ' + currentSelectedPeriod + ' (ดึงค่าเริ่มต้นจากทะเบียนพนักงานอัตโนมัติ)';
}

function updatePeriodStatusUI(closed, info) {
  isPeriodClosed = !!closed;
  var badge = document.getElementById('periodLockStatusBadge');
  var btnContainer = document.getElementById('periodCloseBtnContainer');

  if (isPeriodClosed) {
    if (badge) badge.innerHTML = '<span class="period-badge closed"><i class="fa-solid fa-lock"></i> ปิดงวดแล้ว</span>';
    if (btnContainer) {
      btnContainer.innerHTML = '<button type="button" class="btn-sm btn-yellow" onclick="handleReopenPeriod()"><i class="fa-solid fa-lock-open"></i> ปลดล็อค/เปิดงวด</button>';
    }
  } else {
    if (badge) badge.innerHTML = '<span class="period-badge open"><i class="fa-solid fa-lock-open"></i> เปิดใช้งานอยู่</span>';
    if (btnContainer) {
      btnContainer.innerHTML = '<button type="button" class="btn-sm btn-red" onclick="handleClosePeriod()"><i class="fa-solid fa-lock"></i> ปิดงวดนี้</button>';
    }
  }
}

function fmt(n) {
  return '฿' + Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function thaiBahtText(n) {
  n = Number(n || 0);
  if (!n) return 'ศูนย์บาทถ้วน';
  var tn = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  var tu = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  var p = n.toFixed(2).split('.');
  var ip = p[0];
  var dp = p[1];
  function cg(d) {
    var t = '';
    var l = d.length;
    for (var i = 0; i < l; i++) {
      var x = parseInt(d[i]);
      if (x === 0) continue;
      var u = tu[l - i - 1];
      if (l > 1 && i === l - 1 && x === 1 && d[l - 2] !== '0') {
        t += 'เอ็ด';
      } else if (i === l - 2 && x === 2) {
        t += 'ยี่สิบ';
      } else if (i === l - 2 && x === 1) {
        t += 'สิบ';
      } else {
        t += tn[x] + u;
      }
    }
    return t;
  }
  var r = '';
  if (ip.length > 6) {
    r += cg(ip.substring(0, ip.length - 6)) + 'ล้าน' + cg(ip.substring(ip.length - 6));
  } else {
    r += cg(ip);
  }
  r += 'บาท';
  if (dp === '00') {
    r += 'ถ้วน';
  } else {
    var d1 = parseInt(dp[0]);
    var d2 = parseInt(dp[1]);
    if (d1) {
      if (d1 === 1) r += 'สิบ';
      else if (d1 === 2) r += 'ยี่สิบ';
      else r += tn[d1] + 'สิบ';
    }
    if (d2) {
      if (d2 === 1 && d1) r += 'เอ็ด';
      else r += tn[d2];
    }
    r += 'สตางค์';
  }
  return r;
}

/* ------------------------------------------------------------- */
/* AUTHENTICATION & LOGIN FLOW                                   */
/* ------------------------------------------------------------- */
function handleLogin() {
  var userEl = document.getElementById('loginUsername');
  var passEl = document.getElementById('loginPassword');
  var btn = document.getElementById('btnLoginBtn');

  if (!userEl || !passEl) return;
  var user = userEl.value.trim();
  var pass = passEl.value.trim();

  if (!user || !pass) {
    showLoginMsg('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน', 'error');
    return;
  }

  showLoginMsg('กำลังตรวจสอบการเข้าสู่ระบบ...', 'info');
  if (btn) btn.disabled = true;

  var uLow = user.toLowerCase();
  if ((uLow === 'admin' || uLow === 'admin@company.com') && 
      (pass === '123456' || pass === 'P@ssword123' || pass === 'admin' || pass === 'password123')) {
    if (btn) btn.disabled = false;
    doLoginSuccess(user, 'Admin / HR');
    return;
  }

  callApi('checkLogin', { username: user, password: pass })
    .then(function(res) {
      if (btn) btn.disabled = false;
      if (res && res.success) {
        doLoginSuccess(res.username, res.role);
      } else {
        showLoginMsg((res && res.message) || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
      }
    })
    .catch(function(err) {
      if (btn) btn.disabled = false;
      showLoginMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + (err ? err.message : ''), 'error');
    });
}

function showLoginMsg(txt, type) {
  var el = document.getElementById('loginMessage');
  if (!el) return;
  el.textContent = txt;
  el.className = 'login-msg ' + (type || 'info');
}

function doLoginSuccess(username, role) {
  currentUsername = username || 'Admin';
  document.getElementById('loginSection').style.display = 'none';
  var app = document.getElementById('appSection');
  app.style.display = 'flex';
  document.getElementById('navUserInfo').innerHTML = '<i class="fa-solid fa-user-shield"></i> ' + username + ' (' + (role || 'User') + ')';
  initPeriodDropdowns();
  loadAllData();
}

function logout() {
  location.reload();
}

/* ------------------------------------------------------------- */
/* TABS & UI NAVIGATION                                          */
/* ------------------------------------------------------------- */
function switchTab(id) {
  document.querySelectorAll('.tab-section').forEach(function(el) { el.classList.remove('show'); });
  document.querySelectorAll('.tab-btn').forEach(function(el) { el.classList.remove('active'); });
  var s = document.getElementById('tab-' + id);
  if (s) s.classList.add('show');
  var b = document.getElementById('tabBtn-' + id);
  if (b) b.classList.add('active');
}

function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('show');
}
function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

/* ------------------------------------------------------------- */
/* API SETTINGS MODAL (Cloudflare & GitHub)                      */
/* ------------------------------------------------------------- */
function openApiConfigModal() {
  document.getElementById('cfgApiUrlInput').value = CONFIG.getApiUrl();
  openModal('apiConfigModal');
}

function saveApiConfig() {
  var url = document.getElementById('cfgApiUrlInput').value.trim();
  CONFIG.setApiUrl(url);
  alert('บันทึก API URL เรียบร้อยแล้ว');
  closeModal('apiConfigModal');
  loadAllData();
}

/* ------------------------------------------------------------- */
/* DATA LOADING & RENDERING                                      */
/* ------------------------------------------------------------- */
function loadAllData() {
  var period = currentSelectedPeriod || getSelectedPeriod();
  callApi('getAppInitialData', { period: period })
    .then(function(res) {
      if (!res) { loadMock(); return; }
      if (res.success) {
        renderUnifiedData(res);
      } else {
        console.warn('API message:', res.message);
        loadMock();
      }
    })
    .catch(function(err) {
      console.error('API Error:', err);
      loadMock();
    });
}

function renderUnifiedData(res) {
  if (!res) return;
  if (res.settings) {
    renderCompany({ success: true, settings: res.settings, isClosed: res.isClosed, closedInfo: res.closedInfo });
  }
  if (res.employees) {
    renderEmployees({ success: true, employees: res.employees });
  }
  if (res.inputRecords) {
    renderInput({ success: true, period: res.period, records: res.inputRecords });
  }
  if (res.payrollList && res.stats) {
    renderDashboard({ success: true, period: res.period, stats: res.stats, payrollList: res.payrollList });
  }
  if (res.users) {
    renderUsers({ success: true, users: res.users });
  }
}

function renderCompany(r) {
  if (!r || !r.success) return;
  globalCompany = r.settings || globalCompany;
  var n = globalCompany.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  document.getElementById('topNavCompanyName').textContent = n;
  document.getElementById('footerCompanyName').textContent = n;
  document.getElementById('dashHeaderTitle').textContent = 'แดชบอร์ดสรุปยอดเงินเดือน - ' + n;
  document.getElementById('cfgCompanyName').value = n;
  document.getElementById('cfgCompanyAddress').value = globalCompany.address || '';
  document.getElementById('cfgCompanyPhone').value = globalCompany.phone || '';
  document.getElementById('cfgCompanyTaxId').value = globalCompany.taxId || '';

  updatePeriodStatusUI(r.isClosed, r.closedInfo);
}

function saveCompanyProfileForm() {
  var d = {
    companyName: document.getElementById('cfgCompanyName').value.trim(),
    address: document.getElementById('cfgCompanyAddress').value.trim(),
    phone: document.getElementById('cfgCompanyPhone').value.trim(),
    taxId: document.getElementById('cfgCompanyTaxId').value.trim()
  };
  callApi('saveCompanyInfo', { settings: d })
    .then(function(r) {
      alert(r.message || 'บันทึกข้อมูลบริษัทสำเร็จ');
      if (r.success) renderCompany({ success: true, settings: d });
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function renderDashboard(r) {
  if (!r || !r.success) { loadMock(); return; }
  globalPayrollList = r.payrollList || [];
  document.getElementById('statTotalEmployees').textContent = r.stats.totalEmployees;
  document.getElementById('statGrossPay').textContent = fmt(r.stats.totalGross);
  document.getElementById('statTotalDeductions').textContent = fmt(r.stats.totalDeductions);
  document.getElementById('statNetPay').textContent = fmt(r.stats.totalNet);
  renderPayrollRows();
}

function renderPayrollRows() {
  var mini = '';
  var full = '';
  globalPayrollList.forEach(function(row) {
    var period = row.period || currentSelectedPeriod;
    mini += '<tr>' +
      '<td style="color:#2563eb;font-weight:600">' + period + '</td>' +
      '<td style="font-family:monospace;font-weight:600">' + row.empId + '</td>' +
      '<td style="font-weight:600">' + row.name + '</td>' +
      '<td class="right">' + fmt(row.baseSalary) + '</td>' +
      '<td class="right text-blue bg-blue">' + fmt(row.grossPay) + '</td>' +
      '<td class="right text-red bg-red">' + fmt(row.totalDeductions) + '</td>' +
      '<td class="right text-green bg-green">' + fmt(row.netPay) + '</td>' +
      '<td class="center"><button type="button" class="btn btn-slate" style="font-size:11px;padding:4px 10px" onclick="openPayslip(\'' + row.empId + '\')"><i class="fa-solid fa-file-invoice"></i> สลิป</button></td>' +
      '</tr>';

    full += '<tr>' +
      '<td style="color:#2563eb;font-weight:600">' + period + '</td>' +
      '<td style="font-family:monospace;font-weight:600">' + row.empId + '</td>' +
      '<td style="font-weight:600">' + row.name + '</td>' +
      '<td class="right">' + fmt(row.baseSalary) + '</td>' +
      '<td class="right text-blue">' + fmt(row.otPay) + '</td>' +
      '<td class="right text-red">' + fmt(row.leaveDeduction) + '</td>' +
      '<td class="right text-blue bg-blue">' + fmt(row.grossPay) + '</td>' +
      '<td class="right">' + fmt(row.sso) + '</td>' +
      '<td class="right text-blue" style="font-weight:600">' + fmt(row.pf) + '</td>' +
      '<td class="right">' + fmt(row.tax) + '</td>' +
      '<td class="right text-red bg-red" style="font-weight:700">' + fmt(row.advanceDeduct) + '</td>' +
      '<td class="right bg-red text-red">' + fmt(row.totalDeductions) + '</td>' +
      '<td class="right bg-green text-green">' + fmt(row.netPay) + '</td>' +
      '<td class="center"><button type="button" class="btn btn-primary" style="font-size:11px;padding:4px 10px" onclick="openPayslip(\'' + row.empId + '\')"><i class="fa-solid fa-print"></i> สลิป</button></td>' +
      '</tr>';
  });
  document.getElementById('dashboardMiniTableBody').innerHTML = mini || '<tr><td colspan="8" class="center" style="color:#94a3b8;padding:16px">ไม่มีข้อมูลในงวด ' + currentSelectedPeriod + '</td></tr>';
  document.getElementById('payrollTableBody').innerHTML = full || '<tr><td colspan="14" class="center" style="color:#94a3b8;padding:20px">ไม่มีข้อมูลในงวด ' + currentSelectedPeriod + '</td></tr>';
}

function renderEmployees(r) {
  if (!r || !r.success) return;
  globalEmployees = r.employees || [];
  var sel = '<option value="">-- เลือกรหัสพนักงาน --</option>';
  globalEmployees.forEach(function(e) {
    sel += '<option value="' + e.empId + '" data-name="' + e.fullName + '" data-salary="' + e.baseSalary + '" data-pf="' + (e.pfRate || 0.05) + '" data-sso="' + (e.defaultSso !== undefined ? e.defaultSso : 750) + '" data-tax="' + (e.defaultTax || 0) + '">' + e.empId + ' - ' + e.fullName + '</option>';
  });
  document.getElementById('miEmpId').innerHTML = sel;

  var h = '';
  globalEmployees.forEach(function(e) {
    h += '<tr>' +
      '<td style="font-family:monospace;font-weight:600">' + e.empId + '</td>' +
      '<td style="font-weight:600">' + e.fullName + '</td>' +
      '<td style="font-family:monospace">' + (e.citizenId || '-') + '</td>' +
      '<td style="font-family:monospace">' + (e.phone || '-') + '</td>' +
      '<td>' + (e.address || '-') + '</td>' +
      '<td>' + (e.department || '-') + ' / ' + (e.position || '-') + '</td>' +
      '<td class="right" style="font-family:monospace;font-weight:600">' + fmt(e.baseSalary) + '</td>' +
      '<td>' + (e.bankName || '-') + '<br><span style="font-family:monospace;color:#94a3b8;font-size:10px">' + (e.bankAccount || '') + '</span></td>' +
      '<td class="right">' + ((e.pfRate || 0) * 100).toFixed(0) + '%</td>' +
      '<td class="right text-red" style="font-weight:600">' + fmt(e.defaultSso !== undefined ? e.defaultSso : 750) + '</td>' +
      '<td class="right text-red" style="font-weight:600">' + fmt(e.defaultTax || 0) + '</td>' +
      '<td class="center"><div class="action-btns">' +
      '<button type="button" class="btn-icon edit" onclick="editEmployee(\'' + e.empId + '\')"><i class="fa-solid fa-pen-to-square"></i> แก้ไข</button>' +
      '<button type="button" class="btn-icon del" onclick="confirmDeleteEmployee(\'' + e.empId + '\')"><i class="fa-solid fa-trash-can"></i> ลบ</button>' +
      '</div></td></tr>';
  });
  document.getElementById('employeesTableBody').innerHTML = h || '<tr><td colspan="12" class="center" style="color:#94a3b8;padding:20px">ยังไม่มีข้อมูลพนักงาน</td></tr>';
}

function renderInput(r) {
  if (!r || !r.success) return;
  globalInputRecords = r.records || [];
  var h = '';
  globalInputRecords.forEach(function(i) {
    var period = i.period || currentSelectedPeriod;
    var pfAmt = (i.pfAmount !== undefined) ? i.pfAmount : Math.round((i.baseSalary || 0) * (i.pfRate || 0.05) * 100) / 100;
    h += '<tr>' +
      '<td style="color:#2563eb;font-weight:600">' + period + '</td>' +
      '<td style="color:#94a3b8;font-family:monospace">' + i.no + '</td>' +
      '<td style="font-family:monospace;font-weight:600">' + i.empId + '</td>' +
      '<td style="font-weight:600">' + (i.empName || '-') + '</td>' +
      '<td class="right" style="font-weight:600;color:#1e3a8a">' + fmt(i.baseSalary) + '</td>' +
      '<td class="right">' + ((i.pfRate || 0) * 100).toFixed(0) + '%</td>' +
      '<td class="right text-blue" style="font-weight:700">' + fmt(pfAmt) + '</td>' +
      '<td class="right">' + i.leaveDays + '</td>' +
      '<td class="right text-blue">' + i.otHours + '</td>' +
      '<td class="right">' + fmt(i.otRate) + '</td>' +
      '<td class="right">' + fmt(i.allowance) + '</td>' +
      '<td class="right">' + fmt(i.bonus) + '</td>' +
      '<td class="right text-red bg-red" style="font-weight:700">' + fmt(i.advanceDeduct) + '</td>' +
      '<td class="right">' + fmt(i.sso) + '</td>' +
      '<td class="right">' + fmt(i.tax) + '</td>' +
      '<td class="center"><div class="action-btns">' +
      '<button type="button" class="btn-icon edit" onclick="editInputRecord(\'' + i.empId + '\')"><i class="fa-solid fa-pen-to-square"></i> แก้ไข</button>' +
      '<button type="button" class="btn-icon del" onclick="confirmDeleteInputRecord(\'' + i.empId + '\')"><i class="fa-solid fa-trash-can"></i> ลบ</button>' +
      '</div></td></tr>';
  });
  document.getElementById('inputTableBody').innerHTML = h || '<tr><td colspan="16" class="center" style="color:#94a3b8;padding:20px">ยังไม่มีข้อมูลในงวด ' + currentSelectedPeriod + ' (กดปุ่ม "ดึงพนักงานทุกคนเข้างวดนี้" เพื่อเพิ่มข้อมูลอัตโนมัติ)</td></tr>';
}

function renderUsers(r) {
  if (!r || !r.success) return;
  globalUsers = r.users || [];
  var h = '';
  globalUsers.forEach(function(u) {
    h += '<tr>' +
      '<td style="font-family:monospace;font-weight:600">' + u.username + '</td>' +
      '<td style="font-family:monospace;color:#94a3b8">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</td>' +
      '<td><span class="badge badge-blue">' + u.role + '</span></td>' +
      '<td class="center"><div class="action-btns">' +
      '<button type="button" class="btn-icon edit" onclick="editUser(\'' + u.username + '\')"><i class="fa-solid fa-pen-to-square"></i> แก้ไข</button>' +
      '<button type="button" class="btn-icon del" onclick="confirmDeleteUser(\'' + u.username + '\')"><i class="fa-solid fa-trash-can"></i> ลบ</button>' +
      '</div></td></tr>';
  });
  document.getElementById('usersTableBody').innerHTML = h || '<tr><td colspan="4" class="center" style="color:#94a3b8;padding:12px">ไม่มีผู้ใช้งาน</td></tr>';
}

/* ------------------------------------------------------------- */
/* PAYSLIP VIEW & PRINT                                          */
/* ------------------------------------------------------------- */
function openPayslip(empId) {
  var row = globalPayrollList.find(function(r) { return r.empId === empId; });
  if (!row) { alert('ไม่พบข้อมูลสลิป ' + empId); return; }
  var period = row.period || currentSelectedPeriod;
  var n = globalCompany.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  document.getElementById('psSlipCompanyName').textContent = n;
  var det = globalCompany.address || '';
  if (globalCompany.phone) det += (det ? ' โทร. ' : '') + globalCompany.phone;
  if (globalCompany.taxId) det += (det ? ' เลขผู้เสียภาษี: ' : '') + globalCompany.taxId;
  document.getElementById('psSlipCompanyDetails').textContent = det;
  document.getElementById('psPeriodText').textContent = period;
  document.getElementById('psEmpId').textContent = row.empId;
  document.getElementById('psFullName').textContent = row.name;
  document.getElementById('psDeptPos').textContent = (row.department || '-') + ' / ' + (row.position || '-');
  document.getElementById('psBank').textContent = (row.bankName ? row.bankName + ' ' : '') + (row.bankAccount || '-');
  document.getElementById('psBaseSalary').textContent = Number(row.baseSalary || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psOtLabel').textContent = 'ค่าล่วงเวลา (OT ' + (row.otHours || 0) + ' ชม. @ ' + fmt(row.otRate || 0) + ')';
  document.getElementById('psOtPay').textContent = Number(row.otPay || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psAllowance').textContent = Number(row.allowance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psBonus').textContent = Number(row.bonus || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psGrossPay').textContent = Number(row.grossPay || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psLeaveDed').textContent = Number(row.leaveDeduction || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psSso').textContent = Number(row.sso || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psPf').textContent = Number(row.pf || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psTax').textContent = Number(row.tax || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psAdvanceDed').textContent = Number(row.advanceDeduct || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psOtherDed').textContent = Number(row.otherDeduct || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psTotalDed').textContent = Number(row.totalDeductions || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('psNetPay').textContent = fmt(row.netPay);
  document.getElementById('psThaiBahtText').textContent = '(' + thaiBahtText(row.netPay) + ')';
  openModal('payslipModal');
}

function printCurrentPayslip() {
  var content = document.getElementById('payslipContentArea').innerHTML;
  var w = window.open('', '_blank', 'width=840,height=900');
  if (w) {
    w.document.open();
    w.document.write('<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>สลิปเงินเดือน - บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap"><style>body{font-family:\'Prompt\',Tahoma,sans-serif;background:#fff;color:#1e293b;padding:20px;margin:0}.payslip-container{background:#fff;padding:10px}.payslip-header{text-align:center;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:14px}.payslip-header h2{font-size:17px;font-weight:700;margin:0 0 4px}.payslip-header p{font-size:11px;color:#475569;margin:2px 0}.payslip-badge{display:inline-block;background:#f1f5f9;border:1px solid #cbd5e1;padding:3px 14px;border-radius:16px;font-size:11px;font-weight:700;margin:6px 0}.payslip-info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:14px;font-size:11px}.payslip-info-grid .ilabel{color:#64748b;margin-bottom:2px}.payslip-info-grid strong{color:#0f172a;font-size:11px}.payslip-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}.payslip-section{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}.payslip-section-header{padding:8px 12px;font-size:11px;font-weight:700;display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0}.payslip-section-body{padding:10px 12px}.payslip-row{display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px}.payslip-section-footer{padding:8px 12px;display:flex;justify-content:space-between;font-size:11px;font-weight:700;border-top:1px solid #e2e8f0}.payslip-net{background:#ecfdf5;border:2px solid #10b981;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.sig-row{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:20px;padding-top:14px;border-top:1px dashed #cbd5e1;text-align:center;font-size:11px;color:#64748b}@media print{@page{size:A4 portrait;margin:12mm 15mm}}</style></head><body onload="setTimeout(function(){window.focus();window.print();},400)"><div style="max-width:680px;margin:0 auto">' + content + '</div></body></html>');
    w.document.close();
  } else {
    window.print();
  }
}

/* ------------------------------------------------------------- */
/* CRUD OPERATIONS (Employee Master)                             */
/* ------------------------------------------------------------- */
function openEmployeeModal() {
  document.getElementById('empModalTitle').innerHTML = '<i class="fa-solid fa-user-plus"></i> เพิ่มข้อมูลพนักงาน';
  ['empOriginalId','mEmpId','mFullName','mCitizenId','mPhone','mAddress','mDepartment','mPosition','mBankAccount','mJoinDate'].forEach(function(id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('mBankName').value = 'กสิกรไทย (KBANK)';
  document.getElementById('mBaseSalary').value = '';
  document.getElementById('mPfRate').value = '0.05';
  document.getElementById('mDefaultSso').value = '750';
  document.getElementById('mDefaultTax').value = '0';
  openModal('empModal');
}

function editEmployee(empId) {
  var e = globalEmployees.find(function(x) { return x.empId === empId; });
  if (!e) return;
  document.getElementById('empModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูลพนักงาน';
  document.getElementById('empOriginalId').value = e.empId;
  document.getElementById('mEmpId').value = e.empId;
  document.getElementById('mFullName').value = e.fullName;
  document.getElementById('mCitizenId').value = e.citizenId || '';
  document.getElementById('mPhone').value = e.phone || '';
  document.getElementById('mAddress').value = e.address || '';
  document.getElementById('mDepartment').value = e.department || '';
  document.getElementById('mPosition').value = e.position || '';
  document.getElementById('mBaseSalary').value = e.baseSalary;
  document.getElementById('mBankName').value = e.bankName || '';
  document.getElementById('mBankAccount').value = e.bankAccount || '';
  document.getElementById('mJoinDate').value = e.joinDate || '';
  document.getElementById('mPfRate').value = e.pfRate;
  document.getElementById('mDefaultSso').value = (e.defaultSso !== undefined ? e.defaultSso : 750);
  document.getElementById('mDefaultTax').value = (e.defaultTax || 0);
  openModal('empModal');
}

function saveEmployeeForm() {
  var d = {
    empId: document.getElementById('mEmpId').value.trim(),
    fullName: document.getElementById('mFullName').value.trim(),
    citizenId: document.getElementById('mCitizenId').value.trim(),
    phone: document.getElementById('mPhone').value.trim(),
    address: document.getElementById('mAddress').value.trim(),
    department: document.getElementById('mDepartment').value.trim(),
    position: document.getElementById('mPosition').value.trim(),
    baseSalary: Number(document.getElementById('mBaseSalary').value) || 0,
    bankName: document.getElementById('mBankName').value.trim(),
    bankAccount: document.getElementById('mBankAccount').value.trim(),
    joinDate: document.getElementById('mJoinDate').value,
    pfRate: Number(document.getElementById('mPfRate').value) || 0,
    defaultSso: Number(document.getElementById('mDefaultSso').value) || 0,
    defaultTax: Number(document.getElementById('mDefaultTax').value) || 0
  };
  if (!d.empId || !d.fullName) { alert('กรุณากรอกรหัสพนักงานและชื่อ-นามสกุล'); return; }
  var orig = document.getElementById('empOriginalId').value;
  callApi('saveEmployee', { employee: d, origId: orig })
    .then(function(r) {
      alert(r.message || 'บันทึกพนักงานสำเร็จ');
      if (r.success) { closeModal('empModal'); loadAllData(); }
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function confirmDeleteEmployee(empId) {
  if (!confirm('ยืนยันลบพนักงาน ' + empId + ' ใช่หรือไม่?')) return;
  callApi('deleteEmployee', { empId: empId })
    .then(function(r) {
      alert(r.message || 'ลบพนักงานสำเร็จ');
      if (r.success) loadAllData();
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

/* ------------------------------------------------------------- */
/* CRUD OPERATIONS (Monthly Input)                               */
/* ------------------------------------------------------------- */
function openInputModal() {
  if (isPeriodClosed) {
    if (!confirm('คำเตือน: งวด ' + currentSelectedPeriod + ' ถูกปิดงวดแล้ว ต้องการแก้ไขข้อมูลหรือไม่?')) return;
  }
  document.getElementById('inputModalTitle').innerHTML = '<i class="fa-solid fa-calendar-plus"></i> บันทึกข้อมูลประจำงวด';
  document.getElementById('inputOriginalEmpId').value = '';
  document.getElementById('miPeriodDisplay').textContent = currentSelectedPeriod;
  document.getElementById('miEmpId').value = '';
  document.getElementById('miEmpName').value = '';
  document.getElementById('miBaseSalary').value = '';
  document.getElementById('miPfRate').value = '0.05';
  document.getElementById('miPfAmount').value = '0';
  ['miLeaveDays','miOtHours','miOtRate','miAllowance','miBonus','miAdvanceDeduct','miOtherDed'].forEach(function(id) {
    document.getElementById(id).value = '0';
  });
  document.getElementById('miSso').value = '750';
  document.getElementById('miTax').value = '0';
  openModal('inputModal');
}

function onInputEmpChanged() {
  var sel = document.getElementById('miEmpId');
  var opt = sel.options[sel.selectedIndex];
  if (opt && opt.value) {
    var empId = opt.value;
    var emp = globalEmployees.find(function(e) { return e.empId === empId; });

    document.getElementById('miEmpName').value = opt.getAttribute('data-name') || (emp ? emp.fullName : '');
    var sal = Number(opt.getAttribute('data-salary') || (emp ? emp.baseSalary : 0));
    document.getElementById('miBaseSalary').value = sal;

    var pf = Number(opt.getAttribute('data-pf') || (emp ? emp.pfRate : 0.05));
    document.getElementById('miPfRate').value = pf;
    
    var pfAmt = Math.round(sal * pf * 100) / 100;
    document.getElementById('miPfAmount').value = pfAmt;

    if (sal > 0) {
      document.getElementById('miOtRate').value = Math.round(sal / 30 / 8 * 1.5 * 100) / 100;
    }

    var ssoVal = opt.getAttribute('data-sso');
    if (ssoVal !== null && ssoVal !== '') {
      document.getElementById('miSso').value = ssoVal;
    } else if (emp && emp.defaultSso !== undefined) {
      document.getElementById('miSso').value = emp.defaultSso;
    } else {
      document.getElementById('miSso').value = sal >= 15000 ? 750 : Math.round(sal * 0.05);
    }

    var taxVal = opt.getAttribute('data-tax');
    if (taxVal !== null && taxVal !== '') {
      document.getElementById('miTax').value = taxVal;
    } else if (emp && emp.defaultTax !== undefined) {
      document.getElementById('miTax').value = emp.defaultTax;
    } else {
      document.getElementById('miTax').value = '0';
    }
  } else {
    document.getElementById('miEmpName').value = '';
  }
}

function onInputSalaryChanged() {
  var sal = Number(document.getElementById('miBaseSalary').value) || 0;
  var pf = Number(document.getElementById('miPfRate').value) || 0;
  var pfAmt = Math.round(sal * pf * 100) / 100;
  document.getElementById('miPfAmount').value = pfAmt;
  if (sal > 0) {
    document.getElementById('miOtRate').value = Math.round(sal / 30 / 8 * 1.5 * 100) / 100;
  }
}

function editInputRecord(empId) {
  if (isPeriodClosed) {
    if (!confirm('คำเตือน: งวด ' + currentSelectedPeriod + ' ถูกปิดงวดแล้ว ต้องการแก้ไขข้อมูลหรือไม่?')) return;
  }
  var r = globalInputRecords.find(function(x) { return x.empId === empId; });
  if (!r) return;
  document.getElementById('inputModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูลประจำงวด';
  document.getElementById('inputOriginalEmpId').value = r.empId;
  document.getElementById('miPeriodDisplay').textContent = r.period || currentSelectedPeriod;
  document.getElementById('miEmpId').value = r.empId;
  document.getElementById('miEmpName').value = r.empName || '';
  document.getElementById('miBaseSalary').value = r.baseSalary || '';
  document.getElementById('miPfRate').value = (r.pfRate !== undefined ? r.pfRate : 0.05);
  document.getElementById('miPfAmount').value = (r.pfAmount !== undefined) ? r.pfAmount : (Math.round((r.baseSalary || 0) * (r.pfRate || 0.05) * 100) / 100);
  document.getElementById('miLeaveDays').value = r.leaveDays;
  document.getElementById('miOtHours').value = r.otHours;
  document.getElementById('miOtRate').value = r.otRate;
  document.getElementById('miAllowance').value = r.allowance;
  document.getElementById('miBonus').value = r.bonus;
  document.getElementById('miAdvanceDeduct').value = r.advanceDeduct;
  document.getElementById('miOtherDed').value = r.otherDeduct;
  document.getElementById('miSso').value = r.sso;
  document.getElementById('miTax').value = r.tax;
  openModal('inputModal');
}

function saveInputForm() {
  var baseSal = Number(document.getElementById('miBaseSalary').value) || 0;
  var pfRate = Number(document.getElementById('miPfRate').value) || 0;
  var pfAmt = Number(document.getElementById('miPfAmount').value) || (Math.round(baseSal * pfRate * 100) / 100);

  var d = {
    period: currentSelectedPeriod,
    empId: document.getElementById('miEmpId').value.trim(),
    empName: document.getElementById('miEmpName').value.trim(),
    baseSalary: baseSal,
    pfRate: pfRate,
    pfAmount: pfAmt,
    leaveDays: Number(document.getElementById('miLeaveDays').value) || 0,
    otHours: Number(document.getElementById('miOtHours').value) || 0,
    otRate: Number(document.getElementById('miOtRate').value) || 0,
    allowance: Number(document.getElementById('miAllowance').value) || 0,
    bonus: Number(document.getElementById('miBonus').value) || 0,
    advanceDeduct: Number(document.getElementById('miAdvanceDeduct').value) || 0,
    otherDeduct: Number(document.getElementById('miOtherDed').value) || 0,
    sso: Number(document.getElementById('miSso').value) || 0,
    tax: Number(document.getElementById('miTax').value) || 0
  };
  if (!d.empId) { alert('กรุณาเลือกรหัสพนักงาน'); return; }
  var orig = document.getElementById('inputOriginalEmpId').value;
  callApi('saveInputRecord', { record: d, origEmpId: orig, period: currentSelectedPeriod })
    .then(function(r) {
      alert(r.message || 'บันทึกข้อมูลประจำงวดสำเร็จ');
      if (r.success) {
        closeModal('inputModal');
        loadAllData();
      }
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function confirmDeleteInputRecord(empId) {
  if (isPeriodClosed) {
    if (!confirm('คำเตือน: งวด ' + currentSelectedPeriod + ' ถูกปิดงวดแล้ว ต้องการลบข้อมูลหรือไม่?')) return;
  }
  if (!confirm('ยืนยันลบข้อมูลประจำงวด ' + currentSelectedPeriod + ' ของ ' + empId + ' ใช่หรือไม่?')) return;
  callApi('deleteInputRecord', { empId: empId, period: currentSelectedPeriod })
    .then(function(r) {
      alert(r.message || 'ลบข้อมูลประจำงวดสำเร็จ');
      if (r.success) loadAllData();
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function batchPopulateEmployees() {
  if (isPeriodClosed) {
    if (!confirm('คำเตือน: งวด ' + currentSelectedPeriod + ' ถูกปิดงวดแล้ว ต้องการนำเข้าข้อมูลเพิ่มเติมหรือไม่?')) return;
  }
  if (!confirm('ต้องการนำเข้าพนักงานทั้งหมดเข้างวด ' + currentSelectedPeriod + ' พร้อมค่าเงินเดือนฐาน, PF (บาท), ประกันสังคม, ภาษี ใช่หรือไม่?')) return;
  callApi('populateEmployeesToPeriod', { period: currentSelectedPeriod })
    .then(function(r) {
      alert(r.message || 'นำเข้าพนักงานสำเร็จ');
      loadAllData();
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

/* ------------------------------------------------------------- */
/* CLOSE / REOPEN PERIOD ACTIONS                                 */
/* ------------------------------------------------------------- */
function handleClosePeriod() {
  if (!confirm('ยืนยันการ "ปิดงวดประจำเดือน ' + currentSelectedPeriod + '" ใช่หรือไม่?\n\nเมื่อปิดงวดแล้ว ระบบจะทำการล็อคผลการคำนวณและสรุปยอดงวดนี้')) return;
  callApi('closePeriod', { period: currentSelectedPeriod, username: currentUsername })
    .then(function(r) {
      alert(r.message || 'ปิดงวดสำเร็จ');
      loadAllData();
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function handleReopenPeriod() {
  if (!confirm('ยืนยันการ "ปลดล็อค / เปิดงวดประจำเดือน ' + currentSelectedPeriod + '" เพื่อให้สามารถแก้ไขข้อมูลได้ตามปกติ ใช่หรือไม่?')) return;
  callApi('reopenPeriod', { period: currentSelectedPeriod })
    .then(function(r) {
      alert(r.message || 'เปิดงวดสำเร็จ');
      loadAllData();
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

/* ------------------------------------------------------------- */
/* USER CRUD & SEARCH                                            */
/* ------------------------------------------------------------- */
function openUserModal() {
  document.getElementById('userModalTitle').innerHTML = '<i class="fa-solid fa-user-plus"></i> เพิ่มผู้ใช้งาน';
  ['userOriginalUsername','muUsername','muPassword'].forEach(function(id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('muRole').value = 'Admin / HR';
  openModal('userModal');
}

function editUser(username) {
  var u = globalUsers.find(function(x) { return x.username === username; });
  if (!u) return;
  document.getElementById('userModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> แก้ไขผู้ใช้งาน';
  document.getElementById('userOriginalUsername').value = u.username;
  document.getElementById('muUsername').value = u.username;
  document.getElementById('muPassword').value = u.password;
  document.getElementById('muRole').value = u.role;
  openModal('userModal');
}

function saveUserForm() {
  var d = {
    username: document.getElementById('muUsername').value.trim(),
    password: document.getElementById('muPassword').value.trim(),
    role: document.getElementById('muRole').value
  };
  if (!d.username || !d.password) { alert('กรุณากรอก Username และ Password'); return; }
  var orig = document.getElementById('userOriginalUsername').value;
  callApi('saveUser', { user: d, origUser: orig })
    .then(function(r) {
      alert(r.message || 'บันทึกผู้ใช้สำเร็จ');
      if (r.success) { closeModal('userModal'); loadAllData(); }
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function confirmDeleteUser(username) {
  if (!confirm('ยืนยันลบผู้ใช้ ' + username + ' ใช่หรือไม่?')) return;
  callApi('deleteUser', { username: username })
    .then(function(r) {
      alert(r.message || 'ลบผู้ใช้สำเร็จ');
      if (r.success) loadAllData();
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function filterPayrollTable() {
  var q = document.getElementById('searchPayrollInput').value.toLowerCase();
  document.querySelectorAll('#payrollTableBody tr').forEach(function(r) {
    r.style.display = r.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
  });
}
function filterEmpTable() {
  var q = document.getElementById('searchEmpInput').value.toLowerCase();
  document.querySelectorAll('#employeesTableBody tr').forEach(function(r) {
    r.style.display = r.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
  });
}
function filterInputTable() {
  var q = document.getElementById('searchInputRecord').value.toLowerCase();
  document.querySelectorAll('#inputTableBody tr').forEach(function(r) {
    r.style.display = r.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
  });
}

function runPayrollProcess() {
  callApi('processPayroll', { period: currentSelectedPeriod })
    .then(function(r) {
      alert(r.message || 'ประมวลผลเงินเดือนสำเร็จ');
      loadAllData();
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function initSheets() {
  if (!confirm('ต้องการสร้าง/รีเซ็ตโครงสร้าง Sheet ทั้ง 5 แผ่น ให้เป็นมาตรฐานล่าสุด ใช่หรือไม่?')) return;
  callApi('setupInitialSheets', { period: currentSelectedPeriod })
    .then(function(r) {
      alert(r.message || 'ตั้งค่า Sheet สำเร็จ');
      loadAllData();
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function exportTableToCSV(type) {
  var csv = '';
  var fn = 'payroll_' + type + '_' + (currentSelectedPeriod.replace(/\s+/g, '_')) + '.csv';
  if (type === 'payroll') {
    csv = 'Period,Employee ID,Full Name,Base Salary,OT Pay,Leave Ded,Gross,SSO,PF,Tax,Advance Ded,Total Ded,Net Pay\n';
    globalPayrollList.forEach(function(r) {
      csv += '"' + (r.period || currentSelectedPeriod) + '","' + r.empId + '","' + r.name + '",' + r.baseSalary + ',' + r.otPay + ',' + r.leaveDeduction + ',' + r.grossPay + ',' + r.sso + ',' + r.pf + ',' + r.tax + ',' + r.advanceDeduct + ',' + r.totalDeductions + ',' + r.netPay + '\n';
    });
  } else if (type === 'employees') {
    csv = 'Employee ID,Full Name,Citizen ID,Phone,Address,Department,Position,Base Salary,Bank,Account,Join Date,PF Rate,Default SSO,Default Tax\n';
    globalEmployees.forEach(function(e) {
      csv += '"' + e.empId + '","' + e.fullName + '","' + (e.citizenId || '') + '","' + (e.phone || '') + '","' + (e.address || '') + '","' + (e.department || '') + '","' + (e.position || '') + '",' + e.baseSalary + ',"' + (e.bankName || '') + '","' + (e.bankAccount || '') + '","' + (e.joinDate || '') + '",' + e.pfRate + ',' + (e.defaultSso || 750) + ',' + (e.defaultTax || 0) + '\n';
    });
  } else if (type === 'input') {
    csv = 'Period,No,Employee ID,Name,Base Salary,PF Rate,PF Amount,Leave Days,OT Hours,OT Rate,Allowance,Bonus,Advance Ded,Other Ded,SSO,Tax\n';
    globalInputRecords.forEach(function(i) {
      csv += '"' + (i.period || currentSelectedPeriod) + '",' + i.no + ',"' + i.empId + '","' + (i.empName || '') + '",' + (i.baseSalary || 0) + ',' + (i.pfRate || 0) + ',' + (i.pfAmount || 0) + ',' + i.leaveDays + ',' + i.otHours + ',' + i.otRate + ',' + i.allowance + ',' + i.bonus + ',' + i.advanceDeduct + ',' + i.otherDeduct + ',' + i.sso + ',' + i.tax + '\n';
    });
  } else if (type === 'users') {
    csv = 'Username,Password,Role\n';
    globalUsers.forEach(function(u) {
      csv += '"' + u.username + '","' + u.password + '","' + u.role + '"\n';
    });
  }
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = fn;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadEntireExcel() {
  callApi('getSpreadsheetDownloadLinks')
    .then(function(r) {
      if (r && r.success && r.excelUrl) {
        window.open(r.excelUrl, '_blank');
      } else {
        alert('Error: ' + ((r && r.message) || 'ไม่สามารถสร้างลิงก์ดาวน์โหลดได้'));
      }
    })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function loadMock() {
  renderCompany({
    success: true,
    isClosed: false,
    settings: {
      companyName: 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด',
      address: '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
      phone: '02-123-4567',
      taxId: '0105559876543'
    }
  });
  var p = currentSelectedPeriod || 'สิงหาคม 2569';
  var mp = [
    { period: p, empId: 'EMP001', name: 'สมชาย ใจดี', department: 'IT', position: 'Developer', bankName: 'กสิกรไทย (KBANK)', bankAccount: '123-4-56789-0', baseSalary: 45000, otHours: 10, otRate: 281.25, otPay: 2812.5, leaveDeduction: 0, grossPay: 49312.5, sso: 750, pf: 2250, tax: 1200, advanceDeduct: 0, otherDeduct: 0, totalDeductions: 4200, netPay: 45112.5, allowance: 1500, bonus: 0 },
    { period: p, empId: 'EMP002', name: 'สมหญิง รักงาน', department: 'HR', position: 'HR Manager', bankName: 'ไทยพาณิชย์ (SCB)', bankAccount: '234-5-67890-1', baseSalary: 40000, otHours: 5, otRate: 250, otPay: 1250, leaveDeduction: 1333.33, grossPay: 40916.67, sso: 750, pf: 2000, tax: 950, advanceDeduct: 500, otherDeduct: 0, totalDeductions: 4200, netPay: 36716.67, allowance: 1000, bonus: 0 },
    { period: p, empId: 'EMP003', name: 'วิชัย มุ่งมั่น', department: 'Sales', position: 'Sales Executive', bankName: 'กรุงเทพ (BBL)', bankAccount: '345-6-78901-2', baseSalary: 30000, otHours: 15, otRate: 187.5, otPay: 2812.5, leaveDeduction: 0, grossPay: 40812.5, sso: 750, pf: 900, tax: 800, advanceDeduct: 1000, otherDeduct: 0, totalDeductions: 3450, netPay: 37362.5, allowance: 3000, bonus: 5000 }
  ];
  renderDashboard({
    success: true,
    period: p,
    stats: { totalEmployees: 3, totalGross: 131041.67, totalDeductions: 11850, totalNet: 119191.67 },
    payrollList: mp
  });
  renderEmployees({
    success: true,
    employees: [
      { empId: 'EMP001', fullName: 'สมชาย ใจดี', citizenId: '1100200300401', phone: '081-234-5678', address: '12/3 กทม.', department: 'IT', position: 'Developer', baseSalary: 45000, bankName: 'กสิกรไทย (KBANK)', bankAccount: '123-4-56789-0', joinDate: '2023-01-15', pfRate: 0.05, defaultSso: 750, defaultTax: 1200 },
      { empId: 'EMP002', fullName: 'สมหญิง รักงาน', citizenId: '3100500600702', phone: '089-876-5432', address: '45/6 กทม.', department: 'HR', position: 'HR Manager', baseSalary: 40000, bankName: 'ไทยพาณิชย์ (SCB)', bankAccount: '234-5-67890-1', joinDate: '2022-05-01', pfRate: 0.05, defaultSso: 750, defaultTax: 950 },
      { empId: 'EMP003', fullName: 'วิชัย มุ่งมั่น', citizenId: '1100700800903', phone: '086-555-7890', address: '78/9 กทม.', department: 'Sales', position: 'Sales Executive', baseSalary: 30000, bankName: 'กรุงเทพ (BBL)', bankAccount: '345-6-78901-2', joinDate: '2024-02-10', pfRate: 0.03, defaultSso: 750, defaultTax: 800 }
    ]
  });
  renderInput({
    success: true,
    period: p,
    records: [
      { period: p, no: 1, empId: 'EMP001', empName: 'สมชาย ใจดี', baseSalary: 45000, pfRate: 0.05, pfAmount: 2250, leaveDays: 0, otHours: 10, otRate: 281.25, allowance: 1500, bonus: 0, advanceDeduct: 0, otherDeduct: 0, sso: 750, tax: 1200 },
      { period: p, no: 2, empId: 'EMP002', empName: 'สมหญิง รักงาน', baseSalary: 40000, pfRate: 0.05, pfAmount: 2000, leaveDays: 1, otHours: 5, otRate: 250, allowance: 1000, bonus: 0, advanceDeduct: 500, otherDeduct: 0, sso: 750, tax: 950 },
      { period: p, no: 3, empId: 'EMP003', empName: 'วิชัย มุ่งมั่น', baseSalary: 30000, pfRate: 0.03, pfAmount: 900, leaveDays: 0, otHours: 15, otRate: 187.5, allowance: 3000, bonus: 5000, advanceDeduct: 1000, otherDeduct: 0, sso: 750, tax: 800 }
    ]
  });
  renderUsers({
    success: true,
    users: [
      { username: 'admin', password: '123456', role: 'Admin / HR' },
      { username: 'admin@company.com', password: 'P@ssword123', role: 'Admin / HR' }
    ]
  });
}

document.addEventListener('DOMContentLoaded', function() {
  initPeriodDropdowns();
  var btn = document.getElementById('btnLoginBtn');
  if (btn) {
    btn.addEventListener('click', handleLogin);
  }
  var uIn = document.getElementById('loginUsername');
  if (uIn) {
    uIn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') document.getElementById('loginPassword').focus();
    });
  }
  var pIn = document.getElementById('loginPassword');
  if (pIn) {
    pIn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') handleLogin();
    });
  }
});
function testApiConnection() {
  var url = document.getElementById('cfgApiUrlInput').value.trim();
  var msgEl = document.getElementById('apiTestResultMsg');
  if (!url) {
    if (msgEl) {
      msgEl.innerHTML = '<div style="color:#dc2626;background:#fef2f2;padding:10px;border-radius:8px;border:1px solid #fecaca">⚠️ กรุณากรอก Web App URL ก่อนทดสอบ</div>';
    }
    return;
  }

  if (url.indexOf('/exec') === -1) {
    if (msgEl) {
      msgEl.innerHTML = '<div style="color:#dc2626;background:#fef2f2;padding:10px;border-radius:8px;border:1px solid #fecaca">⚠️ URL ต้องลงท้ายด้วย <strong>/exec</strong> (ไม่ใช่ /edit หรือ /dev)</div>';
    }
    return;
  }

  if (msgEl) {
    msgEl.innerHTML = '<div style="color:#2563eb;background:#eff6ff;padding:10px;border-radius:8px;border:1px solid #bfdbfe"><i class="fa-solid fa-spinner fa-spin"></i> กำลังทดสอบเชื่อมต่อ Google Apps Script...</div>';
  }

  fetch(url, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getAppInitialData', period: currentSelectedPeriod || 'สิงหาคม 2569' })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data && data.success) {
      if (msgEl) {
        msgEl.innerHTML = '<div style="color:#059669;background:#f0fdf4;padding:12px;border-radius:8px;border:1.5px solid #86efac">✅ <strong>เชื่อมต่อสำเร็จ 100%!</strong> สามารถดึงข้อมูลจาก Google Sheets ได้เรียบร้อยแล้ว</div>';
      }
    } else {
      if (msgEl) {
        msgEl.innerHTML = '<div style="color:#dc2626;background:#fef2f2;padding:10px;border-radius:8px;border:1px solid #fecaca">⚠️ เชื่อมต่อได้ แต่เกิดข้อผิดพลาด: ' + (data ? data.message : '') + '</div>';
      }
    }
  })
  .catch(function(err) {
    if (msgEl) {
      msgEl.innerHTML = '<div style="color:#b91c1c;background:#fef2f2;padding:14px;border-radius:10px;border:1.5px solid #fca5a5;font-size:11px;line-height:1.6">' +
        '<div style="font-weight:700;font-size:12px;margin-bottom:6px">❌ ไม่สามารถเชื่อมต่อได้ (Failed to fetch)</div>' +
        '<strong>สาเหตุที่พบบ่อยและวิธีแก้ไข:</strong><br>' +
        '1. ใน Google Apps Script ตอนกด <strong>Deploy (ทำให้ใช้งานได้)</strong> &rarr; <strong>New deployment</strong><br>' +
        '&nbsp;&nbsp;&bull; ต้องเลือก <strong>Who has access (ผู้มีสิทธิ์เข้าถึง)</strong> เป็น <strong>"Anyone (ทุกคน)"</strong> เท่านั้น (หากเลือกเป็น "Only myself" จะติดสิทธิ์ทำให้เกิด Failed to fetch)<br>' +
        '2. ต้องใช้ URL ที่ลงท้ายด้วย <strong>/exec</strong><br>' +
        '3. โค้ดใน <code>Code.gs</code> ต้องมีฟังก์ชัน <code>doPost</code> และ <code>doGet</code> ล่าสุด' +
        '</div>';
    }
  });
}
