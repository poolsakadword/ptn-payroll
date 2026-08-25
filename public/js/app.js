/**
 * ==============================================================================
 * PTN Payroll System V4.0 - Clean Modular Frontend Engine
 * บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด
 * ==============================================================================
 */

// CENTRAL STATE STORE
var State = {
  period: '',
  workingDays: 30,
  isClosed: false,
  closedInfo: '',
  company: { companyName: 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด', address: '', phone: '', taxId: '' },
  employees: [],
  inputRecords: [],
  payrollList: [],
  stats: { totalEmployees: 0, totalGross: 0, totalDeductions: 0, totalNet: 0 },
  users: [],
  currentUser: { username: 'Admin', role: 'Admin / HR' }
};

// UTILITIES
function fmt(n) {
  var val = Number(n);
  if (isNaN(val)) val = 0;
  return '฿' + val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type) {
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'success');
  toast.innerHTML = '<i class="fa-solid ' + (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check') + '"></i> ' + esc(msg);
  container.appendChild(toast);
  setTimeout(function() {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 4000);
}

// API CLIENT
function callApi(action, payload) {
  payload = payload || {};
  payload.action = action;
  payload.period = payload.period || State.period;

  return fetch(APP_CONFIG.getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(function(res) {
    if (!res.ok) throw new Error('HTTP Error: ' + res.status);
    return res.json();
  });
}

// APP INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
  initPeriodDropdowns();
  checkAuth();
});

function checkAuth() {
  var savedUser = localStorage.getItem('ptn_user') || sessionStorage.getItem('ptn_user');
  if (savedUser) {
    try {
      State.currentUser = JSON.parse(savedUser);
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appShell').classList.add('active');
      document.getElementById('topUserBadge').innerHTML = '<i class="fa-solid fa-user-shield"></i> ' + esc(State.currentUser.username) + ' (' + esc(State.currentUser.role) + ')';
      loadAppData();
    } catch(e) {
      handleLogout();
    }
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appShell').classList.remove('active');
  }
}

function handleLogin(e) {
  if (e) e.preventDefault();
  var u = document.getElementById('loginUsername').value.trim();
  var p = document.getElementById('loginPassword').value.trim();
  if (!u || !p) { showToast('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'error'); return; }

  callApi('checkLogin', { username: u, password: p })
    .then(function(r) {
      if (r.success) {
        State.currentUser = { username: r.username, role: r.role };
        localStorage.setItem('ptn_user', JSON.stringify(State.currentUser)); sessionStorage.setItem('ptn_user', JSON.stringify(State.currentUser));
        showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ ' + r.username);
        checkAuth();
      } else {
        showToast(r.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
      }
    })
    .catch(function(err) {
      showToast('ไม่สามารถเชื่อมต่อฐานข้อมูลได้: ' + err.message, 'error');
    });
}

function handleLogout() {
  localStorage.removeItem('ptn_user');
  sessionStorage.removeItem('ptn_user');
  checkAuth();
}

// PERIOD SELECTION
function initPeriodDropdowns() {
  var months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var d = new Date();
  var curM = d.getMonth();
  var curY = d.getFullYear() + 543;

  var mSel = document.getElementById('periodMonthSelect');
  var ySel = document.getElementById('periodYearSelect');
  mSel.innerHTML = '';
  months.forEach(function(m, idx) {
    mSel.innerHTML += '<option value="' + m + '" ' + (idx === curM ? 'selected' : '') + '>' + m + '</option>';
  });

  ySel.innerHTML = '';
  for (var y = curY - 2; y <= curY + 2; y++) {
    ySel.innerHTML += '<option value="' + y + '" ' + (y === curY ? 'selected' : '') + '>' + y + '</option>';
  }

  var savedPeriod = localStorage.getItem('ptn_last_period');
  if (savedPeriod && savedPeriod.indexOf(' ') > 0) {
    var parts = savedPeriod.split(' ');
    if (parts.length === 2 && months.indexOf(parts[0]) >= 0) {
      mSel.value = parts[0];
      ySel.value = parts[1];
      State.period = savedPeriod;
      return;
    }
  }
  State.period = months[curM] + ' ' + curY;
}

function onPeriodChanged() {
  var m = document.getElementById('periodMonthSelect').value;
  var y = document.getElementById('periodYearSelect').value;
  State.period = m + ' ' + y;
  localStorage.setItem('ptn_last_period', State.period);
  loadAppData();
}

function setPeriodWorkingDays() {
  var days = Number(document.getElementById('periodWorkingDaysInput').value) || 30;
  callApi('savePeriodWorkDays', { workingDays: days })
    .then(function(r) {
      showToast(r.message || 'ตั้งค่าวันทำงานสำเร็จ');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// DATA LOADER & STATE SYNC
function loadAppData() {
  callApi('getAppInitialData')
    .then(function(r) {
      if (!r.success) { showToast(r.message, 'error'); return; }

      State.period = r.period;
      State.workingDays = r.workingDays || 30;
      State.isClosed = r.isClosed || false;
      State.closedInfo = r.closedInfo || '';
      State.company = r.settings || State.company;
      State.employees = r.employees || [];
      State.inputRecords = r.inputRecords || [];
      State.payrollList = r.payrollList || [];
      State.stats = r.stats || { totalEmployees: 0, totalGross: 0, totalDeductions: 0, totalNet: 0 };
      State.users = r.users || [];

      renderAllViews();
    })
    .catch(function(err) {
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message, 'error');
    });
}

function renderAllViews() {
  // Update Period Bar
  document.getElementById('periodPillDisplay').textContent = State.period;
  document.getElementById('periodWorkingDaysInput').value = State.workingDays;
  var statusEl = document.getElementById('periodStatusDisplay');
  if (State.isClosed) {
    statusEl.innerHTML = '<span class="status-badge" style="background:#fef2f2;color:#dc2626;border-color:#fecaca"><i class="fa-solid fa-lock"></i> ปิดงวดแล้ว</span>';
    document.getElementById('periodCloseBtnContainer').innerHTML = '<button type="button" class="btn btn-slate btn-sm" onclick="reopenPeriod()"><i class="fa-solid fa-lock-open"></i> ปลดล็อคงวด</button>';
  } else {
    statusEl.innerHTML = '<span class="status-badge"><i class="fa-solid fa-circle-check"></i> เปิดใช้งานอยู่</span>';
    document.getElementById('periodCloseBtnContainer').innerHTML = '<button type="button" class="btn btn-danger btn-sm" onclick="closePeriod()"><i class="fa-solid fa-lock"></i> ปิดงวดนี้</button>';
  }

  // Update Headers & Company Info
  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  document.getElementById('topBrandName').textContent = compName;
  document.getElementById('footerBrandName').textContent = compName;
  document.getElementById('dashTitle').textContent = 'แดชบอร์ดสรุปยอดเงินเดือน - ' + compName;

  renderDashboard();
  renderPayrollTable();
  renderInputTable();
  renderEmployeesTable();
  renderHistoryTab();
  renderCompanySettings();
  renderUsersTable();
}

// 1. DASHBOARD RENDERER
function renderDashboard() {
  document.getElementById('statTotalEmp').textContent = State.stats.totalEmployees + ' คน';
  document.getElementById('statGrossPay').textContent = fmt(State.stats.totalGross);
  document.getElementById('statTotalDeductions').textContent = fmt(State.stats.totalDeductions);
  document.getElementById('statNetPay').textContent = fmt(State.stats.totalNet);

  var tbody = document.getElementById('dashboardTableBody');
  if (!tbody) return;

  if (State.payrollList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:28px">' +
      '<div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:4px"><i class="fa-solid fa-chart-pie"></i> ยังไม่มีข้อมูลภาพรวมในงวด ' + esc(State.period) + '</div>' +
      '<div style="font-size:11.5px;color:#94a3b8">กรุณาบันทึกข้อมูลประจำงวดในแท็บ <strong>"บันทึกข้อมูลประจำงวด"</strong> ก่อน</div>' +
    '</td></tr>';
    return;
  }

  var h = '';
  State.payrollList.forEach(function(row) {
    h += '<tr>' +
      '<td class="text-blue font-bold">' + esc(row.period) + '</td>' +
      '<td class="font-mono font-bold">' + esc(row.empId) + '</td>' +
      '<td class="font-bold">' + esc(row.name) + '</td>' +
      '<td class="text-right font-mono">' + fmt(row.baseSalary) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + fmt(row.grossPay) + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light">' + fmt(row.totalDeductions) + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light">' + fmt(row.netPay) + '</td>' +
      '<td class="text-center"><button type="button" class="btn btn-slate btn-sm" onclick="viewPayslip(\'' + esc(row.empId) + '\')"><i class="fa-solid fa-file-invoice"></i> สลิป</button></td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
}

// 2. PAYROLL TABLE RENDERER (20 COLUMNS)
function renderPayrollTable() {
  var tbody = document.getElementById('payrollTableBody');
  if (!tbody) return;

  if (State.payrollList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="20" class="text-center text-muted" style="padding:36px">' +
      '<div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:6px"><i class="fa-solid fa-calculator"></i> ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + esc(State.period) + '</div>' +
      '<div style="font-size:12px;color:#94a3b8">กรุณาไปที่แท็บ <strong>"บันทึกข้อมูลประจำงวด"</strong> แล้วกดปุ่ม <strong>"ดึงพนักงานทุกคนเข้างวดนี้"</strong> หรือบันทึกข้อมูลรายคน</div>' +
    '</td></tr>';
    return;
  }

  var workDays = State.workingDays > 0 ? State.workingDays : 30;
  var h = '';
  State.payrollList.forEach(function(row) {
    var baseSal = Number(row.baseSalary) || 0;
    var dailyRate = workDays > 0 ? Math.round(baseSal / workDays * 100) / 100 : 0;

    h += '<tr>' +
      '<td class="font-mono font-bold">' + esc(row.empId) + '</td>' +
      '<td class="font-bold">' + esc(row.name) + '</td>' +
      '<td><span class="period-pill">' + esc(row.department || '-') + '</span> ' + esc(row.position || '') + '</td>' +
      '<td class="text-muted" style="font-size:11px">' + esc(row.bankName || '-') + '<br>' + esc(row.bankAccount || '-') + '</td>' +
      '<td class="text-right font-mono font-bold">' + fmt(baseSal) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold bg-blue-light">' + fmt(dailyRate) + '</td>' +
      '<td class="text-right font-mono">' + (row.otHours || 0) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(row.otPay) + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(row.allowance) + '</td>' +
      '<td class="text-right font-mono">' + fmt(row.bonus) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + fmt(row.leaveDeduction) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + fmt(row.grossPay) + '</td>' +
      '<td class="text-right font-mono">' + fmt(row.sso) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue">' + fmt(row.pf) + '</td>' +
      '<td class="text-right font-mono">' + fmt(row.tax) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(row.advanceDeduct) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(row.otherDeduct) + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light">' + fmt(row.totalDeductions) + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light" style="font-size:13px">' + fmt(row.netPay) + '</td>' +
      '<td class="text-center"><button type="button" class="btn btn-primary btn-sm" onclick="viewPayslip(\'' + esc(row.empId) + '\')"><i class="fa-solid fa-print"></i> สลิป</button></td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
}

// 3. MONTHLY INPUT TABLE RENDERER (19 COLUMNS)
function renderInputTable() {
  var tbody = document.getElementById('inputTableBody');
  if (!tbody) return;

  if (State.inputRecords.length === 0) {
    tbody.innerHTML = '<tr><td colspan="19" class="text-center text-muted" style="padding:32px">' +
      '<div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:6px"><i class="fa-solid fa-calendar-days"></i> ยังไม่มีข้อมูลในงวด ' + esc(State.period) + '</div>' +
      '<div style="font-size:12px;color:#94a3b8">กดปุ่มสีเหลือง <strong>"👥 ดึงพนักงานทุกคนเข้างวดนี้"</strong> ด้านบนเพื่อนำเข้าข้อมูลอัตโนมัติ</div>' +
    '</td></tr>';
    return;
  }

  var workDays = State.workingDays > 0 ? State.workingDays : 30;
  var h = '';
  State.inputRecords.forEach(function(i, idx) {
    var baseSal = Number(i.baseSalary) || 0;
    var dailyRate = workDays > 0 ? Math.round(baseSal / workDays * 100) / 100 : 0;
    var pfRate = Number(i.pfRate) || 0.05;
    var pfAmt = (i.pfAmount !== undefined && i.pfAmount > 0) ? i.pfAmount : Math.round(baseSal * pfRate * 100) / 100;

    h += '<tr>' +
      '<td class="text-center font-mono">' + (i.no || (idx + 1)) + '</td>' +
      '<td class="font-mono font-bold">' + esc(i.empId) + '</td>' +
      '<td class="font-bold">' + esc(i.empName || '-') + '</td>' +
      '<td class="text-right font-mono font-bold" style="color:#1e3a8a">' + fmt(baseSal) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold bg-blue-light">' + fmt(dailyRate) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (i.absentDays || 0) + '</td>' +
      '<td class="text-right font-mono">' + (i.leaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + (i.sickLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(i.lateDeduct || 0) + '</td>' +
      '<td class="text-right font-mono">' + (i.otHours || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(i.otRate || 40) + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(i.allowance || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(i.bonus || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue">' + fmt(pfAmt) + '</td>' +
      '<td class="text-right font-mono">' + fmt(i.sso !== undefined ? i.sso : 750) + '</td>' +
      '<td class="text-right font-mono">' + fmt(i.tax || 0) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + fmt(i.advanceDeduct || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(i.otherDeduct || 0) + '</td>' +
      '<td class="text-center">' +
        '<button type="button" class="btn-icon edit" onclick="openEditInputModal(\'' + esc(i.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button> ' +
        '<button type="button" class="btn-icon del" onclick="deleteInputRecord(\'' + esc(i.empId) + '\')"><i class="fa-solid fa-trash"></i> ลบ</button>' +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
}

// 4. EMPLOYEE MASTER RENDERER
function renderEmployeesTable() {
  var tbody = document.getElementById('employeesTableBody');
  if (!tbody) return;

  // Populate employee select dropdowns
  var sel = '<option value="">-- เลือกรหัสพนักงาน --</option>';
  State.employees.forEach(function(e) {
    sel += '<option value="' + e.empId + '" data-name="' + esc(e.fullName) + '" data-salary="' + e.baseSalary + '" data-pf="' + (e.pfRate || 0.05) + '" data-sso="' + (e.defaultSso !== undefined ? e.defaultSso : 750) + '" data-tax="' + (e.defaultTax || 0) + '">' + esc(e.empId) + ' - ' + esc(e.fullName) + '</option>';
  });
  var miSel = document.getElementById('miEmpId');
  if (miSel) miSel.innerHTML = sel;
  var histSel = document.getElementById('histEmpSelect');
  if (histSel) histSel.innerHTML = sel;

  if (State.employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted" style="padding:28px">ยังไม่มีข้อมูลในทะเบียนพนักงาน</td></tr>';
    return;
  }

  var h = '';
  State.employees.forEach(function(e) {
    h += '<tr>' +
      '<td class="font-mono font-bold">' + esc(e.empId) + '</td>' +
      '<td class="font-bold">' + esc(e.fullName) + '</td>' +
      '<td class="font-mono">' + esc(e.citizenId || '-') + '</td>' +
      '<td class="font-mono">' + esc(e.phone || '-') + '</td>' +
      '<td>' + esc(e.address || '-') + '</td>' +
      '<td><span class="period-pill">' + esc(e.department || '-') + '</span> ' + esc(e.position || '') + '</td>' +
      '<td class="text-right font-mono font-bold">' + fmt(e.baseSalary) + '</td>' +
      '<td>' + esc(e.bankName || '-') + '<br><span class="text-muted font-mono" style="font-size:11px">' + esc(e.bankAccount || '-') + '</span></td>' +
      '<td class="text-right font-mono">' + ((e.pfRate || 0) * 100).toFixed(0) + '%</td>' +
      '<td class="text-right font-mono text-red font-bold">' + fmt(e.defaultSso !== undefined ? e.defaultSso : 750) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + fmt(e.defaultTax || 0) + '</td>' +
      '<td class="text-center">' +
        '<button type="button" class="btn-icon edit" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button> ' +
        '<button type="button" class="btn-icon del" onclick="deleteEmployee(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-trash"></i> ลบ</button>' +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
}

// 5. EMPLOYEE WORK HISTORY TAB
function renderHistoryTab() {
  var sel = document.getElementById('histEmpSelect');
  if (sel && sel.value) {
    onHistoryEmpChanged();
  }
}

function onHistoryEmpChanged() {
  var empId = document.getElementById('histEmpSelect').value;
  if (!empId) {
    document.getElementById('histContentArea').style.display = 'none';
    return;
  }

  callApi('getEmployeeHistory', { empId: empId })
    .then(function(r) {
      if (!r.success) { showToast(r.message, 'error'); return; }
      var emp = r.employee;
      var hist = r.history || [];

      document.getElementById('histContentArea').style.display = 'block';
      document.getElementById('histEmpCardName').textContent = emp.fullName + ' (' + emp.empId + ')';
      document.getElementById('histEmpCardDept').textContent = (emp.department || '-') + ' / ' + (emp.position || '-');
      document.getElementById('histEmpCardCitizen').textContent = emp.citizenId || '-';
      document.getElementById('histEmpCardPhone').textContent = emp.phone || '-';
      document.getElementById('histEmpCardBank').textContent = (emp.bankName || '-') + ' ' + (emp.bankAccount || '-');
      document.getElementById('histEmpCardSalary').textContent = fmt(emp.baseSalary);
      document.getElementById('histEmpCardJoin').textContent = emp.joinDate || '-';
      document.getElementById('histEmpCardPf').textContent = ((emp.pfRate || 0.05) * 100).toFixed(0) + '%';

      var tbody = document.getElementById('histTableBody');
      if (hist.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" class="text-center text-muted" style="padding:24px">ยังไม่มีประวัติเงินเดือนในระบบ</td></tr>';
        return;
      }

      var h = '';
      hist.forEach(function(row) {
        h += '<tr>' +
          '<td class="font-bold text-blue">' + esc(row.period) + '</td>' +
          '<td class="text-right font-mono font-bold">' + fmt(row.baseSalary) + '</td>' +
          '<td class="text-right font-mono text-red font-bold">' + (row.absentDays || 0) + '</td>' +
          '<td class="text-right font-mono">' + (row.leaveDays || 0) + '</td>' +
          '<td class="text-right font-mono text-red">' + (row.sickLeaveDays || 0) + '</td>' +
          '<td class="text-right font-mono text-red">' + fmt(row.lateDeduct || 0) + '</td>' +
          '<td class="text-right font-mono">' + (row.otHours || 0) + '</td>' +
          '<td class="text-right font-mono text-blue font-bold">' + fmt(row.otPay) + '</td>' +
          '<td class="text-right font-mono text-green font-bold">' + fmt(row.allowance) + '</td>' +
          '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + fmt(row.grossPay) + '</td>' +
          '<td class="text-right font-mono">' + fmt(row.sso) + '</td>' +
          '<td class="text-right font-mono font-bold text-blue">' + fmt(row.pf) + '</td>' +
          '<td class="text-right font-mono">' + fmt(row.tax) + '</td>' +
          '<td class="text-right font-mono font-bold text-red bg-red-light">' + fmt(row.totalDeductions) + '</td>' +
          '<td class="text-right font-mono font-bold text-green bg-green-light" style="font-size:13px">' + fmt(row.netPay) + '</td>' +
        '</tr>';
      });
      tbody.innerHTML = h;
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// 6. COMPANY SETTINGS RENDERER
function renderCompanySettings() {
  document.getElementById('cfgCompanyName').value = State.company.companyName || '';
  document.getElementById('cfgCompanyAddress').value = State.company.address || '';
  document.getElementById('cfgCompanyPhone').value = State.company.phone || '';
  document.getElementById('cfgCompanyTaxId').value = State.company.taxId || '';
}

function saveCompanySettings(e) {
  if (e) e.preventDefault();
  var d = {
    companyName: document.getElementById('cfgCompanyName').value.trim(),
    address: document.getElementById('cfgCompanyAddress').value.trim(),
    phone: document.getElementById('cfgCompanyPhone').value.trim(),
    taxId: document.getElementById('cfgCompanyTaxId').value.trim()
  };
  callApi('saveCompanyInfo', { settings: d })
    .then(function(r) {
      showToast(r.message || 'บันทึกข้อมูลบริษัทเรียบร้อยแล้ว');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// 7. USERS RENDERER
function renderUsersTable() {
  var tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  var h = '';
  State.users.forEach(function(u) {
    h += '<tr>' +
      '<td class="font-mono font-bold">' + esc(u.username) + '</td>' +
      '<td class="font-mono text-muted">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</td>' +
      '<td><span class="period-pill">' + esc(u.role) + '</span></td>' +
      '<td class="text-center">' +
        '<button type="button" class="btn-icon edit" onclick="openEditUserModal(\'' + esc(u.username) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button> ' +
        '<button type="button" class="btn-icon del" onclick="deleteUser(\'' + esc(u.username) + '\')"><i class="fa-solid fa-trash"></i> ลบ</button>' +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h || '<tr><td colspan="4" class="text-center text-muted" style="padding:16px">ไม่มีผู้ใช้งาน</td></tr>';
}

// ACTIONS & MODAL CONTROLLERS
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.nav-tab-btn').forEach(function(el) { el.classList.remove('active'); });
  var target = document.getElementById('tab-' + tabId);
  var btn = document.getElementById('navBtn-' + tabId);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');

  if (tabId === 'history') {
    renderHistoryTab();
  }
}

function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// POPULATE ALL EMPLOYEES
function batchPopulateEmployees() {
  if (State.isClosed) {
    if (!confirm('คำเตือน: งวด ' + State.period + ' ถูกปิดงวดแล้ว ต้องการนำเข้าข้อมูลหรือไม่?')) return;
  }
  if (!confirm('ต้องการนำเข้า/ซิงค์พนักงานทั้งหมดเข้างวด ' + State.period + ' (อัตรา OT เริ่มต้น 40 บาท) ใช่หรือไม่?')) return;

  callApi('populateEmployeesToPeriod')
    .then(function(r) {
      showToast(r.message || 'นำเข้าพนักงานสำเร็จ');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// INPUT MODAL
function openAddInputModal() {
  document.getElementById('inputModalTitle').innerHTML = '<i class="fa-solid fa-calendar-plus"></i> บันทึกข้อมูลประจำงวด';
  document.getElementById('inputOrigEmpId').value = '';
  document.getElementById('miEmpId').value = '';
  document.getElementById('miEmpName').value = '';
  document.getElementById('miBaseSalary').value = '';
  document.getElementById('miPfRate').value = '0.05';
  document.getElementById('miPfAmount').value = '0';
  document.getElementById('miAbsentDays').value = '0';
  document.getElementById('miLeaveDays').value = '0';
  document.getElementById('miSickLeaveDays').value = '0';
  document.getElementById('miLateDeduct').value = '0';
  document.getElementById('miOtHours').value = '0';
  document.getElementById('miOtRate').value = '40';
  document.getElementById('miAllowance').value = '0';
  document.getElementById('miBonus').value = '0';
  document.getElementById('miAdvanceDeduct').value = '0';
  document.getElementById('miOtherDeduct').value = '0';
  document.getElementById('miSso').value = '750';
  document.getElementById('miTax').value = '0';
  updateModalDailyRate(0);
  openModal('inputModal');
}

function openEditInputModal(empId) {
  var r = State.inputRecords.find(function(x) { return x.empId === empId; });
  if (!r) return;

  document.getElementById('inputModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูลประจำงวด';
  document.getElementById('inputOrigEmpId').value = r.empId;
  document.getElementById('miEmpId').value = r.empId;
  document.getElementById('miEmpName').value = r.empName || '';
  document.getElementById('miBaseSalary').value = r.baseSalary || '';
  document.getElementById('miPfRate').value = r.pfRate || 0.05;
  document.getElementById('miPfAmount').value = r.pfAmount || Math.round((r.baseSalary || 0) * (r.pfRate || 0.05) * 100) / 100;
  document.getElementById('miAbsentDays').value = r.absentDays || 0;
  document.getElementById('miLeaveDays').value = r.leaveDays || 0;
  document.getElementById('miSickLeaveDays').value = r.sickLeaveDays || 0;
  document.getElementById('miLateDeduct').value = r.lateDeduct || 0;
  document.getElementById('miOtHours').value = r.otHours || 0;
  document.getElementById('miOtRate').value = (r.otRate !== null && r.otRate !== undefined && !isNaN(Number(r.otRate))) ? r.otRate : 40;
  document.getElementById('miAllowance').value = r.allowance || 0;
  document.getElementById('miBonus').value = r.bonus || 0;
  document.getElementById('miAdvanceDeduct').value = r.advanceDeduct || 0;
  document.getElementById('miOtherDeduct').value = r.otherDeduct || 0;
  document.getElementById('miSso').value = (r.sso !== undefined ? r.sso : 750);
  document.getElementById('miTax').value = r.tax || 0;
  updateModalDailyRate(r.baseSalary || 0);
  openModal('inputModal');
}

function onInputEmpSelectChanged() {
  var sel = document.getElementById('miEmpId');
  var opt = sel.options[sel.selectedIndex];
  if (opt && opt.value) {
    var empId = opt.value;
    var emp = State.employees.find(function(e) { return e.empId === empId; });
    document.getElementById('miEmpName').value = opt.getAttribute('data-name') || (emp ? emp.fullName : '');
    var sal = Number(opt.getAttribute('data-salary') || (emp ? emp.baseSalary : 0));
    document.getElementById('miBaseSalary').value = sal;
    var pf = Number(opt.getAttribute('data-pf') || (emp ? emp.pfRate : 0.05));
    document.getElementById('miPfRate').value = pf;
    document.getElementById('miPfAmount').value = Math.round(sal * pf * 100) / 100;
    if (!document.getElementById('miOtRate').value || Number(document.getElementById('miOtRate').value) === 0) {
      document.getElementById('miOtRate').value = '40';
    }
    var ssoVal = opt.getAttribute('data-sso');
    document.getElementById('miSso').value = (ssoVal !== null && ssoVal !== '') ? ssoVal : (sal >= 15000 ? 750 : Math.round(sal * 0.05));
    var taxVal = opt.getAttribute('data-tax');
    document.getElementById('miTax').value = (taxVal !== null && taxVal !== '') ? taxVal : '0';
    updateModalDailyRate(sal);
  } else {
    document.getElementById('miEmpName').value = '';
  }
}

function onInputSalaryChanged() {
  var sal = Number(document.getElementById('miBaseSalary').value) || 0;
  var pf = Number(document.getElementById('miPfRate').value) || 0.05;
  document.getElementById('miPfAmount').value = Math.round(sal * pf * 100) / 100;
  updateModalDailyRate(sal);
}

function updateModalDailyRate(sal) {
  var days = State.workingDays > 0 ? State.workingDays : 30;
  var daily = days > 0 ? Math.round(sal / days * 100) / 100 : 0;
  document.getElementById('miModalWorkingDays').textContent = days;
  document.getElementById('miModalDailyRate').textContent = fmt(daily);
}

function saveInputRecordForm(e) {
  if (e) e.preventDefault();
  var baseSal = Number(document.getElementById('miBaseSalary').value) || 0;
  var pfRate = Number(document.getElementById('miPfRate').value) || 0.05;
  var pfAmt = Number(document.getElementById('miPfAmount').value) || Math.round(baseSal * pfRate * 100) / 100;

  var d = {
    empId: document.getElementById('miEmpId').value.trim(),
    empName: document.getElementById('miEmpName').value.trim(),
    baseSalary: baseSal,
    pfRate: pfRate,
    pfAmount: pfAmt,
    absentDays: Number(document.getElementById('miAbsentDays').value) || 0,
    leaveDays: Number(document.getElementById('miLeaveDays').value) || 0,
    sickLeaveDays: Number(document.getElementById('miSickLeaveDays').value) || 0,
    lateDeduct: Number(document.getElementById('miLateDeduct').value) || 0,
    otHours: Number(document.getElementById('miOtHours').value) || 0,
    otRate: Number(document.getElementById('miOtRate').value) || 40,
    allowance: Number(document.getElementById('miAllowance').value) || 0,
    bonus: Number(document.getElementById('miBonus').value) || 0,
    advanceDeduct: Number(document.getElementById('miAdvanceDeduct').value) || 0,
    otherDeduct: Number(document.getElementById('miOtherDeduct').value) || 0,
    sso: Number(document.getElementById('miSso').value) || 0,
    tax: Number(document.getElementById('miTax').value) || 0
  };

  if (!d.empId) { showToast('กรุณาเลือกรหัสพนักงาน', 'error'); return; }
  var orig = document.getElementById('inputOrigEmpId').value;

  callApi('saveInputRecord', { record: d, origEmpId: orig })
    .then(function(r) {
      showToast(r.message || 'บันทึกข้อมูลสำเร็จ');
      closeModal('inputModal');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function deleteInputRecord(empId) {
  if (!confirm('ยืนยันลบข้อมูลประจำงวดของ ' + empId + ' ใช่หรือไม่?')) return;
  callApi('deleteInputRecord', { empId: empId })
    .then(function(r) {
      showToast(r.message || 'ลบข้อมูลสำเร็จ');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// EMPLOYEE MASTER MODAL
function openAddEmployeeModal() {
  document.getElementById('empModalTitle').innerHTML = '<i class="fa-solid fa-user-plus"></i> เพิ่มพนักงานใหม่';
  document.getElementById('empOrigId').value = '';
  ['mEmpId','mFullName','mCitizenId','mPhone','mAddress','mDepartment','mPosition','mBankAccount','mJoinDate'].forEach(function(id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('mBankName').value = 'กสิกรไทย (KBANK)';
  document.getElementById('mBaseSalary').value = '';
  document.getElementById('mPfRate').value = '0.05';
  document.getElementById('mDefaultSso').value = '750';
  document.getElementById('mDefaultTax').value = '0';
  openModal('empModal');
}

function openEditEmployeeModal(empId) {
  var e = State.employees.find(function(x) { return x.empId === empId; });
  if (!e) return;

  document.getElementById('empModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูลพนักงาน';
  document.getElementById('empOrigId').value = e.empId;
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
  document.getElementById('mPfRate').value = e.pfRate || 0.05;
  document.getElementById('mDefaultSso').value = (e.defaultSso !== undefined ? e.defaultSso : 750);
  document.getElementById('mDefaultTax').value = (e.defaultTax || 0);
  openModal('empModal');
}

function saveEmployeeForm(e) {
  if (e) e.preventDefault();
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
    pfRate: Number(document.getElementById('mPfRate').value) || 0.05,
    defaultSso: Number(document.getElementById('mDefaultSso').value) || 750,
    defaultTax: Number(document.getElementById('mDefaultTax').value) || 0
  };

  if (!d.empId || !d.fullName) { showToast('กรุณากรอกรหัสและชื่อพนักงาน', 'error'); return; }
  var orig = document.getElementById('empOrigId').value;

  callApi('saveEmployee', { employee: d, origId: orig })
    .then(function(r) {
      showToast(r.message || 'บันทึกข้อมูลพนักงานสำเร็จ');
      closeModal('empModal');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function deleteEmployee(empId) {
  if (!confirm('ยืนยันลบพนักงาน ' + empId + ' ออกจากระบบ? (ข้อมูลในงวดทั้งหมดจะถูกลบด้วย)')) return;
  callApi('deleteEmployee', { empId: empId })
    .then(function(r) {
      showToast(r.message || 'ลบพนักงานสำเร็จ');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// PAYSLIP MODAL
function viewPayslip(empId) {
  var row = State.payrollList.find(function(x) { return x.empId === empId; });
  if (!row) return;

  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  var compAddr = State.company.address || '';
  var compPhone = State.company.phone || '';
  var compTax = State.company.taxId || '';

  document.getElementById('psCompName').textContent = compName;
  document.getElementById('psCompAddr').textContent = compAddr ? 'ที่อยู่: ' + compAddr : '';
  document.getElementById('psCompTax').textContent = (compTax ? 'เลขประจำตัวผู้เสียภาษี: ' + compTax + ' ' : '') + (compPhone ? 'โทร: ' + compPhone : '');
  document.getElementById('psPeriod').textContent = row.period;
  document.getElementById('psEmpId').textContent = row.empId;
  document.getElementById('psEmpName').textContent = row.name;
  document.getElementById('psDeptPos').textContent = (row.department || '-') + ' / ' + (row.position || '-');
  document.getElementById('psBankAcc').textContent = (row.bankName || '-') + ' ' + (row.bankAccount || '-');

  document.getElementById('psBaseSalary').textContent = fmt(row.baseSalary);
  document.getElementById('psOtHours').textContent = row.otHours || 0;
  document.getElementById('psOtPay').textContent = fmt(row.otPay);
  document.getElementById('psAllowance').textContent = fmt(row.allowance);
  document.getElementById('psBonus').textContent = fmt(row.bonus);
  document.getElementById('psLeaveDed').textContent = fmt(row.leaveDeduction);
  document.getElementById('psGrossPay').textContent = fmt(row.grossPay);

  document.getElementById('psSso').textContent = fmt(row.sso);
  document.getElementById('psPf').textContent = fmt(row.pf);
  document.getElementById('psTax').textContent = fmt(row.tax);
  document.getElementById('psAdvDed').textContent = fmt(row.advanceDeduct);
  document.getElementById('psOtherDed').textContent = fmt(row.otherDeduct);
  document.getElementById('psTotalDed').textContent = fmt(row.totalDeductions);
  document.getElementById('psNetPay').textContent = fmt(row.netPay);

  openModal('payslipModal');
}

function printPayslip() {
  window.print();
}

// PERIOD CLOSE / REOPEN
function closePeriod() {
  if (!confirm('ยืนยันการปิดงวด ' + State.period + ' ใช่หรือไม่? (ผลการคำนวณจะถูกล็อค)')) return;
  callApi('closePeriod')
    .then(function(r) {
      showToast(r.message || 'ปิดงวดสำเร็จ');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function reopenPeriod() {
  if (!confirm('ยืนยันการปลดล็อคและเปิดงวด ' + State.period + ' ใช่หรือไม่?')) return;
  callApi('reopenPeriod')
    .then(function(r) {
      showToast(r.message || 'เปิดงวดสำเร็จ');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function runPayrollRecalc() {
  callApi('processPayroll')
    .then(function(r) {
      showToast(r.message || 'คำนวณเงินเดือนสำเร็จ');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// EXPORT TO CSV / EXCEL
function exportToCSV(type) {
  var csv = '\uFEFF';
  var filename = 'PTN_' + type + '_' + State.period.replace(/\s+/g, '_') + '.csv';

  if (type === 'payroll') {
    csv += 'รหัส,ชื่อ-นามสกุล,แผนก,ตำแหน่ง,ธนาคาร,เลขบัญชี,เงินเดือนฐาน,ค่าจ้างต่อวัน,OTชม,เงินOT,เบี้ยขยัน,โบนัส,หักขาดลาสาย,Gross,ประกันสังคม,กองทุนPF,ภาษี,หักเงินเบิก,หักอื่นๆ,รวมหัก,สุทธิNet\n';
    var workDays = State.workingDays > 0 ? State.workingDays : 30;
    State.payrollList.forEach(function(r) {
      var dRate = workDays > 0 ? Math.round(Number(r.baseSalary) / workDays * 100) / 100 : 0;
      csv += [r.empId, '"' + r.name + '"', '"' + r.department + '"', '"' + r.position + '"', '"' + r.bankName + '"', '"' + r.bankAccount + '"', r.baseSalary, dRate, r.otHours, r.otPay, r.allowance, r.bonus, r.leaveDeduction, r.grossPay, r.sso, r.pf, r.tax, r.advanceDeduct, r.otherDeduct, r.totalDeductions, r.netPay].join(',') + '\n';
    });
  } else if (type === 'input') {
    csv += 'ลำดับ,รหัส,ชื่อ-นามสกุล,เงินเดือนฐาน,ขาดงานวัน,ลากิจวัน,ลาป่วยวัน,หักสายบาท,OTชม,อัตราOT,เบี้ยขยัน,โบนัส,กองทุนPF,ประกันสังคม,ภาษี,หักเงินเบิก,หักอื่นๆ\n';
    State.inputRecords.forEach(function(i) {
      csv += [i.no, i.empId, '"' + i.empName + '"', i.baseSalary, i.absentDays, i.leaveDays, i.sickLeaveDays, i.lateDeduct, i.otHours, i.otRate, i.allowance, i.bonus, i.pfAmount, i.sso, i.tax, i.advanceDeduct, i.otherDeduct].join(',') + '\n';
    });
  } else if (type === 'employees') {
    csv += 'รหัส,ชื่อ-นามสกุล,บัตรประชาชน,เบอร์โทร,ที่อยู่,แผนก,ตำแหน่ง,เงินเดือนฐาน,ธนาคาร,เลขบัญชี,วันเริ่มงาน,PFRate,SSODefault,TaxDefault\n';
    State.employees.forEach(function(e) {
      csv += [e.empId, '"' + e.fullName + '"', '"' + e.citizenId + '"', '"' + e.phone + '"', '"' + e.address + '"', '"' + e.department + '"', '"' + e.position + '"', e.baseSalary, '"' + e.bankName + '"', '"' + e.bankAccount + '"', e.joinDate, e.pfRate, e.defaultSso, e.defaultTax].join(',') + '\n';
    });
  }

  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}