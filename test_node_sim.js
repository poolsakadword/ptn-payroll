
const elements = {};
function createMockElement(id) {
  return {
    id: id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    appendChild: () => {},
    removeChild: () => {},
    addEventListener: () => {}
  };
}

global.document = {
  getElementById: (id) => {
    if (!elements[id]) elements[id] = createMockElement(id);
    return elements[id];
  },
  querySelectorAll: (selector) => [],
  querySelector: (selector) => null,
  createElement: (tag) => createMockElement(tag),
  addEventListener: () => {},
  body: createMockElement('body')
};

global.window = {
  print: () => {},
  addEventListener: () => {},
  location: { hostname: 'master.ptn-payroll.pages.dev', protocol: 'https:', href: 'https://master.ptn-payroll.pages.dev' }
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, yearlySummary: [], grandTotal: {} }) });
global.Blob = function() {};
global.URL = { createObjectURL: () => '' };

/**
 * ==============================================================================
 * PTN Payroll System V4.0 - Config Engine
 * ==============================================================================
 */
var APP_CONFIG = {
  getApiUrl: function() {
    return '/api';
  }
};
// GLOBAL PERMISSIONS HELPER
function hasPermission(permKey) {
  if (!State.currentUser) return false;
  var role = State.currentUser.role ? String(State.currentUser.role).toLowerCase() : '';
  var username = State.currentUser.username ? String(State.currentUser.username).toLowerCase() : '';
  if (username === 'admin' || role.indexOf('admin') >= 0) return true;
  var perms = State.currentUser.permissions || [];
  if (perms.indexOf('all') >= 0) return true;
  return perms.indexOf(permKey) >= 0;
}

function applyRolePermissions() {
  if (!State.currentUser) return;

  var role = State.currentUser.role || 'User';
  var isAdmin = hasPermission('all');
  var isHR = (role.indexOf('HR') >= 0);

  // Top user badge
  var badgeEl = document.getElementById('topUserBadge');
  if (badgeEl) {
    var iconClass = isAdmin ? 'fa-crown' : (isHR ? 'fa-user-tie' : 'fa-user');
    badgeEl.innerHTML = '<i class="fa-solid ' + iconClass + '"></i> ' + esc(State.currentUser.username) + ' (' + esc(role) + ')';
  }

  var canViewDash = hasPermission('view_dash');
  var canViewPayroll = hasPermission('view_payroll');
  var canViewInputs = hasPermission('view_inputs');
  var canViewEmp = hasPermission('view_emp');
  var canViewHistory = hasPermission('view_history');
  var canManageCompany = hasPermission('manage_company') || hasPermission('manage_backup');
  var canManageUsers = hasPermission('manage_users');
  var canViewSalary = hasPermission('view_salary');
  var canEditEmp = hasPermission('edit_emp');
  var canEditInputs = hasPermission('edit_inputs');
  var canPopulateInputs = hasPermission('populate_inputs');
  var canCalcPayroll = hasPermission('calc_payroll');
  var canClosePeriod = hasPermission('close_period');
  var canPrintHistory = hasPermission('print_history');
  var canExportCsv = hasPermission('export_csv');

  // 1. Navigation Tabs Visibility
  var navDash = document.getElementById('navBtn-dashboard');
  var navPayroll = document.getElementById('navBtn-payroll');
  var navInput = document.getElementById('navBtn-input');
  var navEmp = document.getElementById('navBtn-employees');
  var navHistory = document.getElementById('navBtn-history');
  var navCompany = document.getElementById('navBtn-company');
  var navUsers = document.getElementById('navBtn-users');

  if (navDash) navDash.style.display = canViewDash ? 'inline-flex' : 'none';
  if (navPayroll) navPayroll.style.display = canViewPayroll ? 'inline-flex' : 'none';
  if (navInput) navInput.style.display = canViewInputs ? 'inline-flex' : 'none';
  if (navEmp) navEmp.style.display = canViewEmp ? 'inline-flex' : 'none';
  if (navHistory) navHistory.style.display = canViewHistory ? 'inline-flex' : 'none';
  if (navCompany) navCompany.style.display = canManageCompany ? 'inline-flex' : 'none';
  if (navUsers) navUsers.style.display = canManageUsers ? 'inline-flex' : 'none';

  // 2. Ensure current active tab is accessible
  var curActiveTab = document.querySelector('.tab-content.active');
  if (curActiveTab) {
    var tabId = curActiveTab.id;
    var allowed = true;
    if (tabId === 'tab-dashboard' && !canViewDash) allowed = false;
    if (tabId === 'tab-payroll' && !canViewPayroll) allowed = false;
    if (tabId === 'tab-input' && !canViewInputs) allowed = false;
    if (tabId === 'tab-employees' && !canViewEmp) allowed = false;
    if (tabId === 'tab-history' && !canViewHistory) allowed = false;
    if (tabId === 'tab-company' && !canManageCompany) allowed = false;
    if (tabId === 'tab-users' && !canManageUsers) allowed = false;

    if (!allowed) {
      if (canViewDash) switchTab('dashboard');
      else if (canViewEmp) switchTab('employees');
      else if (canViewInputs) switchTab('input');
      else if (canViewPayroll) switchTab('payroll');
      else if (canViewHistory) switchTab('history');
    }
  }

  // 3. Employee Master Toolbar & Salary Inputs
  var btnAddEmp = document.querySelector('button[onclick="openAddEmployeeModal()"]');
  if (btnAddEmp) btnAddEmp.style.display = canEditEmp ? 'inline-flex' : 'none';
  var btnImportEmp = document.querySelector('button[onclick*="empCsvFileInput"]');
  if (btnImportEmp) btnImportEmp.style.display = canEditEmp ? 'inline-flex' : 'none';

  var baseSalaryGroup = document.getElementById('empBaseSalaryGroup');
  var pfRateGroup = document.getElementById('empPfRateGroup');
  var ssoGroup = document.getElementById('empSsoGroup');
  var taxGroup = document.getElementById('empTaxGroup');

  if (!canViewSalary) {
    if (baseSalaryGroup) baseSalaryGroup.style.display = 'none';
    if (pfRateGroup) pfRateGroup.style.display = 'none';
    if (ssoGroup) ssoGroup.style.display = 'none';
    if (taxGroup) taxGroup.style.display = 'none';
  } else {
    if (baseSalaryGroup) baseSalaryGroup.style.display = 'block';
    if (pfRateGroup) pfRateGroup.style.display = 'block';
    if (ssoGroup) ssoGroup.style.display = 'block';
    if (taxGroup) taxGroup.style.display = 'block';
  }

  // 4. Monthly Input Toolbar Buttons
  var btnAddInput = document.querySelector('button[onclick="openAddInputModal()"]');
  if (btnAddInput) btnAddInput.style.display = canEditInputs ? 'inline-flex' : 'none';
  var btnPopulate = document.querySelector('button[onclick="populateEmployeesToCurrentPeriod()"]');
  if (btnPopulate) btnPopulate.style.display = canPopulateInputs ? 'inline-flex' : 'none';

  // 5. Payroll Toolbar Buttons
  var btnCalcPayroll = document.querySelector('button[onclick="runPayrollRecalc()"]');
  if (btnCalcPayroll) btnCalcPayroll.style.display = canCalcPayroll ? 'inline-flex' : 'none';

  // 6. Period Lock Button
  var periodCloseContainer = document.getElementById('periodCloseBtnContainer');
  if (periodCloseContainer && !canClosePeriod) {
    periodCloseContainer.style.display = 'none';
  } else if (periodCloseContainer) {
    periodCloseContainer.style.display = 'inline-block';
  }

  // 7. History Print Buttons
  var btnPrintActive = document.querySelector('button[onclick="printActiveHistoryReport()"]');
  if (btnPrintActive) btnPrintActive.style.display = canPrintHistory ? 'inline-flex' : 'none';
  var btnPrintBatch = document.querySelector('button[onclick="printAllEmployeesBatch()"]');
  if (btnPrintBatch) btnPrintBatch.style.display = canPrintHistory ? 'inline-flex' : 'none';

  // 8. Export CSV Buttons
  var exportBtns = document.querySelectorAll('button[onclick*="exportToCSV"], button[onclick*="exportActiveHistoryCsv"], button[onclick*="exportAllEmployeeHistory"]');
  exportBtns.forEach(function(b) {
    b.style.display = canExportCsv ? 'inline-flex' : 'none';
  });
}

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
      applyRolePermissions();
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
  for (var y = curY - 5; y <= curY + 20; y++) {
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
  return callApi('getAppInitialData')
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
      return r;
    })
    .catch(function(err) {
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message, 'error');
    });
}

function renderAllViews() {
  applyRolePermissions();
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
  var canViewSalary = hasPermission('view_salary');
  document.getElementById('statTotalEmp').textContent = State.stats.totalEmployees + ' คน';
  document.getElementById('statGrossPay').textContent = canViewSalary ? fmt(State.stats.totalGross) : '฿***';
  document.getElementById('statTotalDeductions').textContent = canViewSalary ? fmt(State.stats.totalDeductions) : '฿***';
  document.getElementById('statNetPay').textContent = canViewSalary ? fmt(State.stats.totalNet) : '฿***';

  var tbody = document.getElementById('dashboardTableBody');
  if (!tbody) return;

  var q = (document.getElementById('dashSearchInput') ? document.getElementById('dashSearchInput').value : '').trim().toLowerCase();
  var list = State.payrollList.filter(function(r) {
    if (!q) return true;
    return (r.empId && r.empId.toLowerCase().indexOf(q) >= 0) ||
           (r.name && r.name.toLowerCase().indexOf(q) >= 0) ||
           (r.department && r.department.toLowerCase().indexOf(q) >= 0) ||
           (r.position && r.position.toLowerCase().indexOf(q) >= 0);
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:28px">' +
      '<div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:4px"><i class="fa-solid fa-chart-pie"></i> ' + (q ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา "' + esc(q) + '"' : 'ยังไม่มีข้อมูลภาพรวมในงวด ' + esc(State.period)) + '</div>' +
      '<div style="font-size:11.5px;color:#94a3b8">กรุณาบันทึกข้อมูลประจำงวดในแท็บ <strong>"บันทึกข้อมูลประจำงวด"</strong> ก่อน</div>' +
    '</td></tr>';
    return;
  }

  var h = '';
  list.forEach(function(row) {
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

  var q = (document.getElementById('payrollSearchInput') ? document.getElementById('payrollSearchInput').value : '').trim().toLowerCase();
  var list = State.payrollList.filter(function(r) {
    if (!q) return true;
    return (r.empId && r.empId.toLowerCase().indexOf(q) >= 0) ||
           (r.name && r.name.toLowerCase().indexOf(q) >= 0) ||
           (r.department && r.department.toLowerCase().indexOf(q) >= 0) ||
           (r.position && r.position.toLowerCase().indexOf(q) >= 0);
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="20" class="text-center text-muted" style="padding:36px">' +
      '<div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:6px"><i class="fa-solid fa-calculator"></i> ' + (q ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา "' + esc(q) + '"' : 'ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + esc(State.period)) + '</div>' +
      '<div style="font-size:12px;color:#94a3b8">กรุณาไปที่แท็บ <strong>"บันทึกข้อมูลประจำงวด"</strong> แล้วกดปุ่ม <strong>"ดึงพนักงานทุกคนเข้างวดนี้"</strong> หรือบันทึกข้อมูลรายคน</div>' +
    '</td></tr>';
    return;
  }

  var workDays = State.workingDays > 0 ? State.workingDays : 30;
  var h = '';
  list.forEach(function(row) {
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

  var q = (document.getElementById('inputSearchInput') ? document.getElementById('inputSearchInput').value : '').trim().toLowerCase();
  var list = State.inputRecords.filter(function(i) {
    if (!q) return true;
    return (i.empId && i.empId.toLowerCase().indexOf(q) >= 0) ||
           (i.empName && i.empName.toLowerCase().indexOf(q) >= 0);
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="19" class="text-center text-muted" style="padding:32px">' +
      '<div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:6px"><i class="fa-solid fa-calendar-days"></i> ' + (q ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา "' + esc(q) + '"' : 'ยังไม่มีข้อมูลในงวด ' + esc(State.period)) + '</div>' +
      '<div style="font-size:12px;color:#94a3b8">กดปุ่มสีเหลือง <strong>"👥 ดึงพนักงานทุกคนเข้างวดนี้"</strong> ด้านบนเพื่อนำเข้าข้อมูลอัตโนมัติ</div>' +
    '</td></tr>';
    return;
  }

  var workDays = State.workingDays > 0 ? State.workingDays : 30;
  var h = '';
  list.forEach(function(i, idx) {
    var baseSal = Number(i.baseSalary) || 0;
    var dailyRate = workDays > 0 ? Math.round(baseSal / workDays * 100) / 100 : 0;
    var pfRate = (i.pfRate !== null && i.pfRate !== undefined && !isNaN(Number(i.pfRate))) ? Number(i.pfRate) : 0;
    var pfAmt = (pfRate > 0) ? ((i.pfAmount !== undefined && i.pfAmount > 0) ? Number(i.pfAmount) : Math.round(baseSal * pfRate * 100) / 100) : 0;

    var canViewSalary = hasPermission('view_salary');
    var canEditInputs = hasPermission('edit_inputs');

    h += '<tr>' +
      '<td class="text-center font-mono">' + (i.no || (idx + 1)) + '</td>' +
      '<td class="font-mono font-bold">' + esc(i.empId) + '</td>' +
      (function() {
      var emp = State.employees.find(function(e) { return e.empId === i.empId; });
      var remBadge = (emp && emp.remark) ? '<br><span style="font-size:11px;font-weight:normal;color:#d97706;background:#fffbeb;border:1px solid #fef3c7;padding:1px 6px;border-radius:4px;display:inline-block;margin-top:2px"><i class="fa-solid fa-note-sticky"></i> ' + esc(emp.remark) + '</span>' : '';
      return '<td class="font-bold">' + esc(i.empName || '-') + remBadge + '</td>';
    })() +
      '<td class="text-right font-mono font-bold" style="color:#1e3a8a">' + (canViewSalary ? fmt(baseSal) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-blue font-bold bg-blue-light">' + (canViewSalary ? fmt(dailyRate) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (i.absentDays || 0) + '</td>' +
      '<td class="text-right font-mono">' + (i.leaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + (i.sickLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(i.lateDeduct || 0) + '</td>' +
      '<td class="text-right font-mono">' + (i.otHours || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(i.otRate || 40) + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(i.allowance || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(i.bonus || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue">' + (canViewSalary ? fmt(pfAmt) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(i.sso !== undefined && i.sso !== null ? i.sso : 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(i.tax || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + fmt(i.advanceDeduct || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(i.otherDeduct || 0) + '</td>' +
      '<td class="text-center">' +
        (canEditInputs ? '<button type="button" class="btn-icon edit" onclick="openEditInputModal(\'' + esc(i.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button> <button type="button" class="btn-icon del" onclick="deleteInputRecord(\'' + esc(i.empId) + '\')"><i class="fa-solid fa-trash"></i> ลบ</button>' : '<span class="text-muted">-</span>') +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
}

// 4. EMPLOYEE MASTER RENDERER
function renderEmployeesTable() {
  var tbody = document.getElementById('employeesTableBody');
  var thead = document.getElementById('employeesTableHead');
  if (!tbody) return;

  var canViewSalary = hasPermission('view_salary');
  var canEditEmp = hasPermission('edit_emp');
  var canDelEmp = hasPermission('del_emp');
  var isGeneralUser = !canViewSalary;

  // Adjust table header based on role
  if (thead) {
    if (isGeneralUser) {
      thead.innerHTML = '<tr>' +
        '<th style="width:90px">รหัส</th>' +
        '<th>ชื่อ-นามสกุล</th>' +
        '<th style="width:100px">ชื่อเล่น</th>' +
        '<th>วันเกิด / อายุ</th>' +
        '<th>บัตรประชาชน</th>' +
        '<th>เบอร์โทร</th>' +
        '<th>ที่อยู่</th>' +
        '<th>แผนก / ตำแหน่ง</th>' +
        '<th>ธนาคาร / เลขบัญชี</th>' +
        '<th>วันเริ่มงาน</th>' +
        '<th class="text-center" style="width:90px">จัดการ</th>' +
      '</tr>';
    } else {
      thead.innerHTML = '<tr>' +
        '<th style="width:90px">รหัส</th>' +
        '<th>ชื่อ-นามสกุล</th>' +
        '<th style="width:100px">ชื่อเล่น</th>' +
        '<th>ที่อยู่</th>' +
        '<th>แผนก / ตำแหน่ง</th>' +
        '<th class="text-right" style="width:110px">เงินเดือนฐาน</th>' +
        '<th class="text-right" style="width:70px">PF %</th>' +
        '<th class="text-right text-red font-bold" style="width:110px">SSO (Default) 🔴</th>' +
        '<th class="text-right text-red font-bold" style="width:100px">ภาษี (Default) 🔴</th>' +
        '<th class="text-center" style="width:120px">จัดการ</th>' +
      '</tr>';
    }
  }

  // Populate employee select dropdowns
  var sel = '<option value="">-- เลือกรหัสพนักงาน --</option>';
  State.employees.forEach(function(e) {
    var nickDisplay = e.nickname ? ' (' + e.nickname + ')' : '';
    var empPf = (e.pfRate !== null && e.pfRate !== undefined && !isNaN(Number(e.pfRate))) ? Number(e.pfRate) : 0;
    var empSso = (e.defaultSso !== null && e.defaultSso !== undefined && !isNaN(Number(e.defaultSso))) ? Number(e.defaultSso) : 0;
    sel += '<option value="' + e.empId + '" data-name="' + esc(e.fullName) + '" data-salary="' + e.baseSalary + '" data-pf="' + empPf + '" data-sso="' + empSso + '" data-tax="' + (e.defaultTax || 0) + '" data-remark="' + esc(e.remark || '') + '">' + esc(e.empId) + ' - ' + esc(e.fullName) + nickDisplay + '</option>';
  });
  var miSel = document.getElementById('miEmpId');
  if (miSel) miSel.innerHTML = sel;
  var histSel = document.getElementById('histEmpSelect');
  if (histSel) histSel.innerHTML = sel;

  var q = (document.getElementById('empSearchInput') ? document.getElementById('empSearchInput').value : '').trim().toLowerCase();
  var list = State.employees.filter(function(e) {
    if (!q) return true;
    return (e.empId && e.empId.toLowerCase().indexOf(q) >= 0) ||
           (e.fullName && e.fullName.toLowerCase().indexOf(q) >= 0) ||
           (e.nickname && e.nickname.toLowerCase().indexOf(q) >= 0) ||
           (e.department && e.department.toLowerCase().indexOf(q) >= 0) ||
           (e.position && e.position.toLowerCase().indexOf(q) >= 0);
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + (isGeneralUser ? '11' : '10') + '" class="text-center text-muted" style="padding:28px">' + (q ? 'ไม่พบพนักงานที่ตรงกับคำค้นหา "' + esc(q) + '"' : 'ยังไม่มีข้อมูลในทะเบียนพนักงาน') + '</td></tr>';
    return;
  }

  var h = '';
  list.forEach(function(e) {
    var birthText = e.birthDate ? (e.birthDate + (e.age ? ' (' + e.age + ' ปี)' : '')) : (e.age ? (e.age + ' ปี') : '-');

    if (isGeneralUser) {
      // General User view: 11 columns, NO salary, NO delete button
      h += '<tr>' +
        '<td class="font-mono font-bold">' + esc(e.empId) + '</td>' +
        '<td class="font-bold">' + esc(e.fullName) + '</td>' +
        '<td style="color:#2563eb;font-weight:600">' + esc(e.nickname || '-') + '</td>' +
        '<td>' + esc(birthText) + '</td>' +
        '<td class="font-mono">' + esc(e.citizenId || '-') + '</td>' +
        '<td class="font-mono">' + esc(e.phone || '-') + '</td>' +
        '<td>' + esc(e.address || '-') + '</td>' +
        '<td><span class="period-pill">' + esc(e.department || '-') + '</span> ' + esc(e.position || '') + '</td>' +
        '<td>' + esc(e.bankName || '-') + '<br><span class="text-muted font-mono" style="font-size:11px">' + esc(e.bankAccount || '-') + '</span></td>' +
        '<td>' + esc(e.joinDate || '-') + '</td>' +
        '<td class="text-center nowrap">' +
          (canEditEmp ? '<button type="button" class="btn-icon edit" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button>' : '<span class="text-muted">-</span>') +
        '</td>' +
      '</tr>';
    } else {
      // Admin / HR view: 10 columns with salary, PF, SSO, Tax, and Delete button
      h += '<tr>' +
        '<td class="font-mono font-bold">' + esc(e.empId) + '</td>' +
        '<td class="font-bold">' + esc(e.fullName) + '</td>' +
        '<td style="color:#2563eb;font-weight:600">' + esc(e.nickname || '-') + '</td>' +
        '<td>' + esc(e.address || '-') + '</td>' +
        '<td><span class="period-pill">' + esc(e.department || '-') + '</span> ' + esc(e.position || '') + '</td>' +
        '<td class="text-right font-mono font-bold">' + fmt(e.baseSalary) + '</td>' +
        '<td class="text-right font-mono">' + (Number(e.pfRate) > 0 ? (((Number(e.pfRate) * 100).toFixed(0)) + '%') : '<span class="text-muted" style="font-size:11px">ไม่หัก (0%)</span>') + '</td>' +
        '<td class="text-right font-mono text-red font-bold">' + (Number(e.defaultSso) > 0 ? fmt(e.defaultSso) : '<span class="text-muted" style="font-size:11px">ไม่หัก (฿0)</span>') + '</td>' +
        '<td class="text-right font-mono text-red font-bold">' + fmt(e.defaultTax || 0) + '</td>' +
        '<td class="text-center nowrap">' +
          (canEditEmp ? '<button type="button" class="btn-icon edit" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button> ' : '') +
          (canDelEmp ? '<button type="button" class="btn-icon del" onclick="deleteEmployee(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-trash"></i> ลบ</button>' : '') +
          (!canEditEmp && !canDelEmp ? '<span class="text-muted">-</span>' : '') +
        '</td>' +
      '</tr>';
    }
  });
  tbody.innerHTML = h;
}

// =======================================================
// 5. EMPLOYEE HISTORY & YEARLY SUMMARY
// =======================================================
var currentHistoryMode = 'yearly'; // 'yearly' or 'individual'
var currentYearlySummaryData = [];
var currentGrandTotalData = {};
var currentHistoryList = [];

function switchHistoryViewMode(mode) {
  currentHistoryMode = mode;
  var btnYearly = document.getElementById('btnHistModeYearly');
  var btnIndiv = document.getElementById('btnHistModeIndividual');
  var empGroup = document.getElementById('histEmpSelectGroup');
  var viewYearly = document.getElementById('histYearlyViewArea');
  var viewIndiv = document.getElementById('histContentArea');

  if (mode === 'yearly') {
    if (btnYearly) { btnYearly.className = 'btn btn-primary btn-sm'; }
    if (btnIndiv) { btnIndiv.className = 'btn btn-slate btn-sm'; }
    if (empGroup) empGroup.style.display = 'none';
    if (viewYearly) viewYearly.style.display = 'block';
    if (viewIndiv) viewIndiv.style.display = 'none';
    loadYearlySummaryData();
  } else {
    if (btnYearly) { btnYearly.className = 'btn btn-slate btn-sm'; }
    if (btnIndiv) { btnIndiv.className = 'btn btn-primary btn-sm'; }
    if (empGroup) empGroup.style.display = 'inline-flex';
    if (viewYearly) viewYearly.style.display = 'none';
    if (viewIndiv) viewIndiv.style.display = 'block';
    onHistoryEmpChanged();
  }
}

function initHistoryYearDropdown() {
  var sel = document.getElementById('histYearSelect');
  if (!sel) return;
  var curYear = new Date().getFullYear() + 543;
  var curVal = sel.value;
  var h = '';
  for (var y = curYear + 5; y >= curYear - 5; y--) {
    h += '<option value="' + y + '"' + (y === curYear ? ' selected' : '') + '>' + y + '</option>';
  }
  h += '<option value="ALL">ทุกปี (ทั้งหมด)</option>';
  sel.innerHTML = h;
  if (curVal) sel.value = curVal;
}

function onHistoryYearChanged() {
  if (currentHistoryMode === 'yearly') {
    loadYearlySummaryData();
  } else {
    onHistoryEmpChanged();
  }
}

function renderHistoryTab(silent) {
  initHistoryYearDropdown();
  var sel = document.getElementById('histEmpSelect');
  if (sel) {
    var curVal = sel.value;
    var h = '<option value="">-- เลือกพนักงาน --</option>';
    State.employees.forEach(function(e) {
      var nick = e.nickname ? ' (' + e.nickname + ')' : '';
      h += '<option value="' + esc(e.empId) + '">' + esc(e.empId) + ' - ' + esc(e.fullName) + nick + '</option>';
    });
    sel.innerHTML = h;
    if (curVal) sel.value = curVal;
  }

  var isHistTabActive = document.getElementById('tab-history') && document.getElementById('tab-history').classList.contains('active');
  if (currentHistoryMode === 'yearly') {
    loadYearlySummaryData(silent || !isHistTabActive);
  } else if (sel && sel.value) {
    onHistoryEmpChanged(silent || !isHistTabActive);
  }
}

function loadYearlySummaryData(silent) {
  var yrSel = document.getElementById('histYearSelect');
  var yr = yrSel ? yrSel.value : '';
  if (!yr) {
    var curYear = new Date().getFullYear() + 543;
    yr = String(curYear);
  }

  var isHistTabActive = document.getElementById('tab-history') && document.getElementById('tab-history').classList.contains('active');
  if (!silent && isHistTabActive) {
    showToast('กำลังโหลดข้อมูลสรุปประจำปี ' + yr + '...', 'info');
  }

  callApi('getYearlySummary', { year: yr })
    .then(function(r) {
      if (!r.success) {
        if (isHistTabActive) showToast(r.message || 'ไม่สามารถโหลดข้อมูลสรุปประจำปีได้', 'error');
        return;
      }
      currentYearlySummaryData = r.yearlySummary || [];
      currentGrandTotalData = r.grandTotal || {};
      renderYearlySummaryTable();
    })
    .catch(function(err) {
      if (isHistTabActive) showToast('Error: ' + err.message, 'error');
    });
}

function renderYearlySummaryTable() {
  var tbody = document.getElementById('yearlySummaryTableBody');
  var tfoot = document.getElementById('yearlySummaryTableFoot');
  var yrSel = document.getElementById('histYearSelect');
  var yr = yrSel ? yrSel.value : '';

  // Update Grand Stats
  var gt = currentGrandTotalData || {};
  if (document.getElementById('statYearlyEmps')) document.getElementById('statYearlyEmps').textContent = (gt.activeEmployees || 0) + ' / ' + (gt.totalEmployees || 0) + ' คน';
  if (document.getElementById('statYearlyGross')) document.getElementById('statYearlyGross').textContent = fmt(gt.totalGrossPay || 0);
  if (document.getElementById('statYearlyDeductions')) document.getElementById('statYearlyDeductions').textContent = fmt(gt.totalDeductions || 0);
  if (document.getElementById('statYearlyNet')) document.getElementById('statYearlyNet').textContent = fmt(gt.totalNetPay || 0);

  if (document.getElementById('yearlyPrintCompName')) document.getElementById('yearlyPrintCompName').textContent = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  if (document.getElementById('yearlyPrintYearDisplay')) document.getElementById('yearlyPrintYearDisplay').textContent = yr === 'ALL' ? 'ทั้งหมดทุกปี' : yr;

  var q = (document.getElementById('historySearchInput') ? document.getElementById('historySearchInput').value : '').trim().toLowerCase();
  var list = (currentYearlySummaryData || []).filter(function(r) {
    if (!q) return true;
    return (r.empId && r.empId.toLowerCase().indexOf(q) >= 0) ||
           (r.fullName && r.fullName.toLowerCase().indexOf(q) >= 0) ||
           (r.nickname && r.nickname.toLowerCase().indexOf(q) >= 0) ||
           (r.department && r.department.toLowerCase().indexOf(q) >= 0) ||
           (r.position && r.position.toLowerCase().indexOf(q) >= 0);
  });

  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="19" class="text-center text-muted" style="padding:28px">ไม่พบข้อมูลประวัติเงินเดือนในปี ' + esc(yr) + '</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  var h = '';
  list.forEach(function(r, idx) {
    var nick = r.nickname ? ' (' + esc(r.nickname) + ')' : '';
    h += '<tr>' +
      '<td class="text-center font-mono">' + (idx + 1) + '</td>' +
      '<td class="font-mono font-bold">' + esc(r.empId) + '</td>' +
      '<td class="font-bold">' + esc(r.fullName) + nick + '</td>' +
      '<td>' + esc(r.department || '-') + '</td>' +
      '<td class="text-center font-mono font-bold" style="color:#2563eb">' + (r.totalPeriods || 0) + ' งวด</td>' +
      '<td class="text-right font-mono font-bold" style="color:#1e3a8a">' + fmt(r.baseSalaryLatest) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (r.totalAbsentDays || 0) + '</td>' +
      '<td class="text-right font-mono">' + (r.totalLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + (r.totalSickLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(r.totalLateDeduct || 0) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(r.totalOtPay || 0) + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(r.totalAllowance || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(r.totalBonus || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + fmt(r.totalGrossPay || 0) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + fmt(r.totalSso || 0) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(r.totalPf || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(r.totalTax || 0) + '</td>' +
      '<td class="text-right font-mono text-red font-bold bg-red-light">' + fmt(r.totalDeductions || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light">' + fmt(r.totalNetPay || 0) + '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;

  // Render Grand Total row in tfoot
  if (tfoot) {
    tfoot.innerHTML = '<tr style="background:#f1f5f9;font-weight:700;font-size:12px;border-top:2px solid #94a3b8">' +
      '<td colspan="4" class="text-center font-bold" style="color:#0f172a;font-size:12.5px">รวมยอดทั้งบริษัท (' + list.length + ' คน)</td>' +
      '<td class="text-center font-mono font-bold" style="color:#2563eb">-</td>' +
      '<td class="text-right font-mono font-bold" style="color:#1e3a8a">-</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (gt.totalAbsentDays || 0) + '</td>' +
      '<td class="text-right font-mono">' + (gt.totalLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + (gt.totalSickLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(gt.totalLateDeduct || 0) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(gt.totalOtPay || 0) + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(gt.totalAllowance || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(gt.totalBonus || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light" style="font-size:13px">' + fmt(gt.totalGrossPay || 0) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + fmt(gt.totalSso || 0) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(gt.totalPf || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(gt.totalTax || 0) + '</td>' +
      '<td class="text-right font-mono text-red font-bold bg-red-light" style="font-size:13px">' + fmt(gt.totalDeductions || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light" style="font-size:14px;color:#15803d">' + fmt(gt.totalNetPay || 0) + '</td>' +
    '</tr>';
  }
}

function onHistoryEmpChanged(silent) {
  var sel = document.getElementById('histEmpSelect');
  var empId = sel ? sel.value : '';
  var area = document.getElementById('histContentArea');

  if (!empId) {
    if (area) area.style.display = 'none';
    currentHistoryList = [];
    return;
  }

  var isHistTabActive = document.getElementById('tab-history') && document.getElementById('tab-history').classList.contains('active');
  if (!silent && isHistTabActive) {
    showToast('กำลังโหลดประวัติของ ' + empId + '...', 'info');
  }
  callApi('getEmployeeHistory', { empId: empId })
    .then(function(r) {
      if (!r.success) { showToast(r.message, 'error'); return; }
      var emp = r.employee || {};
      currentHistoryList = r.history || [];

      // Filter by selected year if not ALL
      var yrSel = document.getElementById('histYearSelect');
      var yr = yrSel ? yrSel.value : '';
      if (yr && yr !== 'ALL') {
        currentHistoryList = currentHistoryList.filter(function(h) {
          return h.period && h.period.indexOf(yr) >= 0;
        });
      }

      if (document.getElementById('histEmpCardName')) document.getElementById('histEmpCardName').textContent = emp.fullName + (emp.nickname ? ' (' + emp.nickname + ')' : '') + ' [' + (emp.empId || '') + ']';
      if (document.getElementById('histEmpCardDept')) document.getElementById('histEmpCardDept').textContent = (emp.department || '-') + ' / ' + (emp.position || '-');
      if (document.getElementById('histEmpCardBirthAge')) document.getElementById('histEmpCardBirthAge').textContent = (emp.birthDate || '-') + ' (' + (emp.age || 0) + ' ปี)';
      if (document.getElementById('histEmpCardCitizen')) document.getElementById('histEmpCardCitizen').textContent = emp.citizenId || '-';
      if (document.getElementById('histEmpCardPhone')) document.getElementById('histEmpCardPhone').textContent = emp.phone || '-';
      if (document.getElementById('histEmpCardBank')) document.getElementById('histEmpCardBank').textContent = (emp.bankName || '-') + ' ' + (emp.bankAccount || '-');
      if (document.getElementById('histEmpCardSalary')) document.getElementById('histEmpCardSalary').textContent = hasPermission('view_salary') ? fmt(emp.baseSalary) : '฿***';
      if (document.getElementById('histEmpCardJoin')) document.getElementById('histEmpCardJoin').textContent = emp.joinDate || '-';
      var pfText = (emp.pfRate !== null && emp.pfRate !== undefined && !isNaN(Number(emp.pfRate)) && Number(emp.pfRate) > 0) ? (Math.round(Number(emp.pfRate) * 100) + '%') : 'ไม่หัก PF';
      if (document.getElementById('histEmpCardPf')) document.getElementById('histEmpCardPf').textContent = pfText;

      filterHistoryTable();
      if (area) area.style.display = 'block';
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function filterHistoryTable() {
  if (currentHistoryMode === 'yearly') {
    renderYearlySummaryTable();
    return;
  }

  var tbody = document.getElementById('historyTableBody');
  var tfoot = document.getElementById('historyTableFoot');
  if (!tbody) return;

  var q = (document.getElementById('historySearchInput') ? document.getElementById('historySearchInput').value : '').trim().toLowerCase();
  var list = (currentHistoryList || []).filter(function(r) {
    if (!q) return true;
    return (r.period && r.period.toLowerCase().indexOf(q) >= 0);
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="19" class="text-center text-muted" style="padding:28px">ไม่พบข้อมูลประวัติเงินเดือน</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  var sumBase = 0, sumAbsent = 0, sumLeave = 0, sumSick = 0, sumLate = 0;
  var sumOtHours = 0, sumOtPay = 0, sumAllowance = 0, sumBonus = 0, sumLeaveDed = 0;
  var sumGross = 0, sumSso = 0, sumPf = 0, sumTax = 0, sumAdv = 0, sumOther = 0, sumDed = 0, sumNet = 0;

  var h = '';
  list.forEach(function(r) {
    var base = Number(r.baseSalary) || 0;
    var abs = Number(r.absentDays) || 0;
    var lev = Number(r.leaveDays) || 0;
    var sck = Number(r.sickLeaveDays) || 0;
    var late = Number(r.lateDeduct) || 0;
    var otH = Number(r.otHours) || 0;
    var otP = Number(r.otPay) || 0;
    var allow = Number(r.allowance) || 0;
    var bon = Number(r.bonus) || 0;
    var lDed = Number(r.leaveDeduction) || 0;
    var grs = Number(r.grossPay) || 0;
    var ssoVal = Number(r.sso) || 0;
    var pfVal = Number(r.pf) || 0;
    var taxVal = Number(r.tax) || 0;
    var adv = Number(r.advanceDeduct) || 0;
    var oth = Number(r.otherDeduct) || 0;
    var totDed = Number(r.totalDeductions) || 0;
    var net = Number(r.netPay) || 0;

    sumBase += base; sumAbsent += abs; sumLeave += lev; sumSick += sck; sumLate += late;
    sumOtHours += otH; sumOtPay += otP; sumAllowance += allow; sumBonus += bon; sumLeaveDed += lDed;
    sumGross += grs; sumSso += ssoVal; sumPf += pfVal; sumTax += taxVal; sumAdv += adv; sumOther += oth;
    sumDed += totDed; sumNet += net;

    h += '<tr>' +
      '<td class="font-bold">' + esc(r.period) + '</td>' +
      '<td class="text-right font-mono">' + fmt(base) + '</td>' +
      '<td class="text-right font-mono text-red">' + abs + '</td>' +
      '<td class="text-right font-mono">' + lev + '</td>' +
      '<td class="text-right font-mono text-red">' + sck + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(late) + '</td>' +
      '<td class="text-right font-mono">' + otH + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(otP) + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(allow) + '</td>' +
      '<td class="text-right font-mono">' + fmt(bon) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(lDed) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + fmt(grs) + '</td>' +
      '<td class="text-right font-mono font-bold text-red">' + fmt(ssoVal) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(pfVal) + '</td>' +
      '<td class="text-right font-mono">' + fmt(taxVal) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(adv) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(oth) + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light">' + fmt(totDed) + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light">' + fmt(net) + '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;

  // Individual Annual Total Row in tfoot
  if (tfoot) {
    tfoot.innerHTML = '<tr style="background:#eff6ff;font-weight:700;font-size:12px;border-top:2px solid #60a5fa">' +
      '<td class="font-bold" style="color:#1e40af">รวมสะสม (' + list.length + ' งวด)</td>' +
      '<td class="text-right font-mono font-bold" style="color:#1e3a8a">' + fmt(sumBase) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + sumAbsent + '</td>' +
      '<td class="text-right font-mono">' + sumLeave + '</td>' +
      '<td class="text-right font-mono text-red">' + sumSick + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(sumLate) + '</td>' +
      '<td class="text-right font-mono">' + sumOtHours + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(sumOtPay) + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(sumAllowance) + '</td>' +
      '<td class="text-right font-mono">' + fmt(sumBonus) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(sumLeaveDed) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light" style="font-size:13px">' + fmt(sumGross) + '</td>' +
      '<td class="text-right font-mono font-bold text-red">' + fmt(sumSso) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(sumPf) + '</td>' +
      '<td class="text-right font-mono">' + fmt(sumTax) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(sumAdv) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(sumOther) + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light" style="font-size:13px">' + fmt(sumDed) + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light" style="font-size:14px;color:#15803d">' + fmt(sumNet) + '</td>' +
    '</tr>';
  }
}

function printActiveHistoryReport() {
  if (currentHistoryMode === 'yearly') {
    printYearlySummary();
  } else {
    printHistoryReport();
  }
}

function printYearlySummary() {
  document.body.classList.remove('printing-payslip');
  document.body.classList.remove('printing-history');
  document.body.classList.remove('printing-batch-history');
  document.body.classList.add('printing-yearly-summary');

  window.print();

  setTimeout(function() {
    document.body.classList.remove('printing-yearly-summary');
  }, 1000);
}

function printHistoryReport() {
  var area = document.getElementById('histContentArea');
  if (!area || area.style.display === 'none') {
    showToast('กรุณาเลือกพนักงานก่อนพิมพ์รายงานประวัติ', 'warning');
    return;
  }
  document.body.classList.remove('printing-payslip');
  document.body.classList.remove('printing-yearly-summary');
  document.body.classList.remove('printing-batch-history');
  document.body.classList.add('printing-history');

  window.print();

  setTimeout(function() {
    document.body.classList.remove('printing-history');
  }, 1000);
}

function exportActiveHistoryCsv() {
  if (currentHistoryMode === 'yearly') {
    exportYearlySummaryCsv();
  } else {
    exportCurrentEmployeeHistory();
  }
}

function exportYearlySummaryCsv() {
  var yrSel = document.getElementById('histYearSelect');
  var yr = yrSel ? yrSel.value : 'ALL';

  if (!currentYearlySummaryData || currentYearlySummaryData.length === 0) {
    showToast('ยังไม่มีข้อมูลสรุปประจำปี ' + yr, 'warning');
    return;
  }

  var csv = '\uFEFF';
  csv += 'ลำดับ,รหัสพนักงาน,ชื่อ-นามสกุล,ชื่อเล่น,แผนก,ตำแหน่ง,จำนวนงวด,เงินเดือนฐานล่าสุด,ขาด(วัน),ลากิจ(วัน),ลาป่วย(วัน),หักสาย(บาท),เงินOTรวม(บาท),เบี้ยขยันรวม(บาท),โบนัสรวม(บาท),รวมเงินได้Grossทั้งปี,ประกันสังคมสะสมทั้งปี,กองทุนPFสะสมทั้งปี,ภาษีสะสมทั้งปี,รวมหักสะสมทั้งปี,เงินได้สุทธิNetทั้งปี\n';

  currentYearlySummaryData.forEach(function(r, idx) {
    var line = [
      idx + 1,
      '"' + (r.empId || '').replace(/"/g, '""') + '"',
      '"' + (r.fullName || '').replace(/"/g, '""') + '"',
      '"' + (r.nickname || '').replace(/"/g, '""') + '"',
      '"' + (r.department || '').replace(/"/g, '""') + '"',
      '"' + (r.position || '').replace(/"/g, '""') + '"',
      Number(r.totalPeriods) || 0,
      Number(r.baseSalaryLatest) || 0,
      Number(r.totalAbsentDays) || 0,
      Number(r.totalLeaveDays) || 0,
      Number(r.totalSickLeaveDays) || 0,
      Number(r.totalLateDeduct) || 0,
      Number(r.totalOtPay) || 0,
      Number(r.totalAllowance) || 0,
      Number(r.totalBonus) || 0,
      Number(r.totalGrossPay) || 0,
      Number(r.totalSso) || 0,
      Number(r.totalPf) || 0,
      Number(r.totalTax) || 0,
      Number(r.totalDeductions) || 0,
      Number(r.totalNetPay) || 0
    ];
    csv += line.join(',') + '\n';
  });

  // Add Grand Total row
  var gt = currentGrandTotalData || {};
  var grandLine = [
    '""',
    '"TOTAL"',
    '"รวมทั้งบริษัท (' + currentYearlySummaryData.length + ' คน)"',
    '""',
    '""',
    '""',
    '""',
    '""',
    Number(gt.totalAbsentDays) || 0,
    Number(gt.totalLeaveDays) || 0,
    Number(gt.totalSickLeaveDays) || 0,
    Number(gt.totalLateDeduct) || 0,
    Number(gt.totalOtPay) || 0,
    Number(gt.totalAllowance) || 0,
    Number(gt.totalBonus) || 0,
    Number(gt.totalGrossPay) || 0,
    Number(gt.totalSso) || 0,
    Number(gt.totalPf) || 0,
    Number(gt.totalTax) || 0,
    Number(gt.totalDeductions) || 0,
    Number(gt.totalNetPay) || 0
  ];
  csv += grandLine.join(',') + '\n';

  var filename = 'PTN_Yearly_Summary_' + yr + '_' + new Date().toISOString().substring(0,10) + '.csv';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์สรุปประจำปี ' + yr + ' สำเร็จ');
}

function exportCurrentEmployeeHistory() {
  var sel = document.getElementById('histEmpSelect');
  var empId = sel ? sel.value : '';
  if (!empId || !currentHistoryList || currentHistoryList.length === 0) {
    showToast('กรุณาเลือกพนักงานและโหลดข้อมูลก่อนส่งออก CSV', 'warning');
    return;
  }

  var csv = '\uFEFF';
  csv += 'งวด,เงินเดือนฐาน,ขาด(วัน),ลากิจ(วัน),ลาป่วย(วัน),หักสาย(บาท),OT(ชม),เงินOT,เบี้ยขยัน,โบนัส,หักขาดลาสาย,เงินได้Gross,ประกันสังคม,กองทุนPF,ภาษี,หักเงินเบิก,หักอื่นๆ,รวมหัก,เงินได้สุทธิNet\n';

  currentHistoryList.forEach(function(r) {
    var line = [
      '"' + (r.period || '').replace(/"/g, '""') + '"',
      Number(r.baseSalary) || 0,
      Number(r.absentDays) || 0,
      Number(r.leaveDays) || 0,
      Number(r.sickLeaveDays) || 0,
      Number(r.lateDeduct) || 0,
      Number(r.otHours) || 0,
      Number(r.otPay) || 0,
      Number(r.allowance) || 0,
      Number(r.bonus) || 0,
      Number(r.leaveDeduction) || 0,
      Number(r.grossPay) || 0,
      Number(r.sso) || 0,
      Number(r.pf) || 0,
      Number(r.tax) || 0,
      Number(r.advanceDeduct) || 0,
      Number(r.otherDeduct) || 0,
      Number(r.totalDeductions) || 0,
      Number(r.netPay) || 0
    ];
    csv += line.join(',') + '\n';
  });

  var filename = 'PTN_History_' + empId + '_' + new Date().toISOString().substring(0,10) + '.csv';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดประวัติพนักงาน ' + empId + ' สำเร็จ');
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
  var role = (State.currentUser && State.currentUser.role) ? String(State.currentUser.role).trim() : 'User';
  var isGeneralUser = (role.toLowerCase() === 'user');

  // If General User, force tab to employees only
  if (isGeneralUser && tabId !== 'employees') {
    tabId = 'employees';
  }

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
  if (document.getElementById('miEmpRemark')) document.getElementById('miEmpRemark').value = '';
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
  document.getElementById('miSso').value = '0';
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
  var empMatch = State.employees.find(function(e) { return e.empId === r.empId; });
  if (document.getElementById('miEmpRemark')) document.getElementById('miEmpRemark').value = (empMatch && empMatch.remark) ? empMatch.remark : '-';
  document.getElementById('miBaseSalary').value = r.baseSalary || '';
  var inpPfRate = (r.pfRate !== null && r.pfRate !== undefined && !isNaN(Number(r.pfRate))) ? Number(r.pfRate) : 0;
  document.getElementById('miPfRate').value = inpPfRate;
  document.getElementById('miPfAmount').value = inpPfRate > 0 ? (r.pfAmount !== undefined && r.pfAmount > 0 ? r.pfAmount : Math.round((r.baseSalary || 0) * inpPfRate * 100) / 100) : 0;
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
  document.getElementById('miSso').value = (r.sso !== undefined && r.sso !== null) ? r.sso : 0;
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
    var remVal = opt.getAttribute('data-remark') || (emp ? emp.remark : '');
    if (document.getElementById('miEmpRemark')) document.getElementById('miEmpRemark').value = remVal ? remVal : '-';
    var sal = Number(opt.getAttribute('data-salary') || (emp ? emp.baseSalary : 0));
    document.getElementById('miBaseSalary').value = sal;
    var pfVal = opt.getAttribute('data-pf');
    var pf = (pfVal !== null && pfVal !== '' && !isNaN(Number(pfVal))) ? Number(pfVal) : (emp && emp.pfRate !== undefined ? Number(emp.pfRate) : 0);
    document.getElementById('miPfRate').value = pf;
    document.getElementById('miPfAmount').value = pf > 0 ? (Math.round(sal * pf * 100) / 100) : 0;
    if (!document.getElementById('miOtRate').value || Number(document.getElementById('miOtRate').value) === 0) {
      document.getElementById('miOtRate').value = '40';
    }
    var ssoVal = opt.getAttribute('data-sso');
    var finalSso = (ssoVal !== null && ssoVal !== '' && !isNaN(Number(ssoVal))) ? Number(ssoVal) : ((emp && emp.defaultSso !== undefined && emp.defaultSso !== null && !isNaN(Number(emp.defaultSso))) ? Number(emp.defaultSso) : 0);
    document.getElementById('miSso').value = finalSso;
    var taxVal = opt.getAttribute('data-tax');
    document.getElementById('miTax').value = (taxVal !== null && taxVal !== '') ? taxVal : '0';
    updateModalDailyRate(sal);
  } else {
    document.getElementById('miEmpName').value = '';
  }
}

function onInputSalaryChanged() {
  var sal = Number(document.getElementById('miBaseSalary').value) || 0;
  var pf = Number(document.getElementById('miPfRate').value) || 0;
  document.getElementById('miPfAmount').value = pf > 0 ? (Math.round(sal * pf * 100) / 100) : 0;
  updateModalDailyRate(sal);
}

function updateModalDailyRate(sal) {
  var days = State.workingDays > 0 ? State.workingDays : 30;
  var daily = days > 0 ? Math.round(sal / days * 100) / 100 : 0;
  document.getElementById('miModalWorkingDays').textContent = days;
  document.getElementById('miModalDailyRate').textContent = fmt(daily);
}

function saveInputRecordForm(e, openPayslipAfter) {
  if (e && e.preventDefault) e.preventDefault();
  var baseSal = Number(document.getElementById('miBaseSalary').value) || 0;
  var pfRate = (document.getElementById('miPfRate') && document.getElementById('miPfRate').value !== '' && !isNaN(Number(document.getElementById('miPfRate').value))) ? Number(document.getElementById('miPfRate').value) : 0;
  var pfAmt = pfRate > 0 ? (Number(document.getElementById('miPfAmount').value) || Math.round(baseSal * pfRate * 100) / 100) : 0;

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
    sso: (document.getElementById('miSso') && document.getElementById('miSso').value !== '' && !isNaN(Number(document.getElementById('miSso').value))) ? Number(document.getElementById('miSso').value) : 0,
    tax: Number(document.getElementById('miTax').value) || 0
  };

  if (!d.empId) { showToast('กรุณาเลือกรหัสพนักงาน', 'error'); return; }
  var orig = document.getElementById('inputOrigEmpId').value;

  callApi('saveInputRecord', { record: d, origEmpId: orig })
    .then(function(r) {
      showToast(r.message || 'บันทึกข้อมูลสำเร็จ');
      closeModal('inputModal');
      var p = loadAppData();
      if (openPayslipAfter) {
        if (p && p.then) {
          p.then(function() { viewPayslip(d.empId); });
        } else {
          setTimeout(function() { viewPayslip(d.empId); }, 300);
        }
      }
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
  var isGeneralUser = (State.currentUser && String(State.currentUser.role).trim().toLowerCase() === 'user');
  var finSection = document.getElementById('empModalFinancialSection');
  if (finSection) finSection.style.display = isGeneralUser ? 'none' : 'block';
  var salInput = document.getElementById('mBaseSalary');
  if (salInput) salInput.required = !isGeneralUser;

  document.getElementById('empModalTitle').innerHTML = '<i class="fa-solid fa-user-plus"></i> เพิ่มพนักงานใหม่';
  document.getElementById('empOrigId').value = '';
  ['mEmpId','mFullName','mNickname','mBirthDate','mAge','mCitizenId','mPhone','mAddress','mDepartment','mPosition','mBankAccount','mJoinDate','mRemark'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('mBankName').value = 'กสิกรไทย (KBANK)';
  document.getElementById('mBaseSalary').value = '';
  var hasPfCheck = document.getElementById('mHasPf');
  if (hasPfCheck) hasPfCheck.checked = true;
  var pfRateInput = document.getElementById('mPfRate');
  if (pfRateInput) { pfRateInput.value = '0.05'; pfRateInput.disabled = false; }
  var pfRateLbl = document.getElementById('mPfRateLabel');
  if (pfRateLbl) { pfRateLbl.textContent = '(5%)'; pfRateLbl.style.color = '#1d4ed8'; }
  var hasSsoCheck = document.getElementById('mHasSso');
  if (hasSsoCheck) hasSsoCheck.checked = true;
  var ssoInput = document.getElementById('mDefaultSso');
  if (ssoInput) { ssoInput.value = '750'; ssoInput.disabled = false; }
  var ssoLbl = document.getElementById('mDefaultSsoLabel');
  if (ssoLbl) { ssoLbl.textContent = '(750฿)'; ssoLbl.style.color = '#dc2626'; }
  document.getElementById('mDefaultTax').value = '0';
  openModal('empModal');
}

function openEditEmployeeModal(empId) {
  var e = State.employees.find(function(x) { return x.empId === empId; });
  if (!e) return;

  var isGeneralUser = (State.currentUser && String(State.currentUser.role).trim().toLowerCase() === 'user');
  var finSection = document.getElementById('empModalFinancialSection');
  if (finSection) finSection.style.display = isGeneralUser ? 'none' : 'block';
  var salInput = document.getElementById('mBaseSalary');
  if (salInput) salInput.required = !isGeneralUser;

  document.getElementById('empModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูลพนักงาน';
  document.getElementById('empOrigId').value = e.empId;
  document.getElementById('mEmpId').value = e.empId;
  document.getElementById('mFullName').value = e.fullName;
  document.getElementById('mNickname').value = e.nickname || '';
  document.getElementById('mBirthDate').value = e.birthDate || '';
  document.getElementById('mAge').value = (e.age && e.age > 0) ? e.age : '';
  document.getElementById('mCitizenId').value = e.citizenId || '';
  document.getElementById('mPhone').value = e.phone || '';
  document.getElementById('mAddress').value = e.address || '';
  document.getElementById('mDepartment').value = e.department || '';
  document.getElementById('mPosition').value = e.position || '';
  document.getElementById('mBaseSalary').value = e.baseSalary;
  document.getElementById('mBankName').value = e.bankName || '';
  document.getElementById('mBankAccount').value = e.bankAccount || '';
  document.getElementById('mJoinDate').value = e.joinDate || '';
  document.getElementById('mRemark').value = e.remark || '';
  var hasPf = (e.pfRate !== undefined && e.pfRate !== null && Number(e.pfRate) > 0);
  var hasPfCheck = document.getElementById('mHasPf');
  if (hasPfCheck) hasPfCheck.checked = hasPf;
  var pfRateInput = document.getElementById('mPfRate');
  if (pfRateInput) {
    pfRateInput.value = hasPf ? e.pfRate : '0';
    pfRateInput.disabled = !hasPf;
  }
  var pfRateLbl = document.getElementById('mPfRateLabel');
  if (pfRateLbl) {
    pfRateLbl.textContent = hasPf ? ('(' + Math.round(Number(e.pfRate) * 100) + '%)') : '(ไม่หัก PF)';
    pfRateLbl.style.color = hasPf ? '#1d4ed8' : '#94a3b8';
  }
  var hasSso = (e.defaultSso !== undefined && e.defaultSso !== null && Number(e.defaultSso) > 0);
  var hasSsoCheck = document.getElementById('mHasSso');
  if (hasSsoCheck) hasSsoCheck.checked = hasSso;
  var ssoInput = document.getElementById('mDefaultSso');
  if (ssoInput) {
    ssoInput.value = hasSso ? e.defaultSso : '0';
    ssoInput.disabled = !hasSso;
  }
  var ssoLbl = document.getElementById('mDefaultSsoLabel');
  if (ssoLbl) {
    ssoLbl.textContent = hasSso ? ('(' + fmt(e.defaultSso) + ')') : '(ไม่หัก SSO)';
    ssoLbl.style.color = hasSso ? '#dc2626' : '#94a3b8';
  }
  document.getElementById('mDefaultTax').value = (e.defaultTax || 0);
  openModal('empModal');
}

function saveEmployeeForm(e, openPayslipAfter) {
  if (e && e.preventDefault) e.preventDefault();
  var orig = document.getElementById('empOrigId').value;
  var existingEmp = orig ? State.employees.find(function(x) { return x.empId === orig; }) : null;
  var isUser = (State.currentUser && State.currentUser.role === 'User');

  var baseSal = isUser ? (existingEmp ? existingEmp.baseSalary : 0) : (Number(document.getElementById('mBaseSalary').value) || 0);
    var hasPf = document.getElementById('mHasPf') ? document.getElementById('mHasPf').checked : true;
  var pfRate = isUser ? (existingEmp ? (existingEmp.pfRate || 0) : 0) : (hasPf ? (Number(document.getElementById('mPfRate').value) || 0.05) : 0);
    var hasSso = document.getElementById('mHasSso') ? document.getElementById('mHasSso').checked : true;
  var ssoVal = isUser ? (existingEmp ? (existingEmp.defaultSso !== undefined ? existingEmp.defaultSso : 0) : 0) : (hasSso ? (Number(document.getElementById('mDefaultSso').value) || 0) : 0);
  var taxVal = isUser ? (existingEmp ? existingEmp.defaultTax : 0) : (Number(document.getElementById('mDefaultTax').value) || 0);

  var d = {
    empId: document.getElementById('mEmpId').value.trim(),
    fullName: document.getElementById('mFullName').value.trim(),
    nickname: document.getElementById('mNickname').value.trim(),
    birthDate: document.getElementById('mBirthDate').value,
    age: Number(document.getElementById('mAge').value) || 0,
    citizenId: document.getElementById('mCitizenId').value.trim(),
    phone: document.getElementById('mPhone').value.trim(),
    address: document.getElementById('mAddress').value.trim(),
    department: document.getElementById('mDepartment').value.trim(),
    position: document.getElementById('mPosition').value.trim(),
    baseSalary: baseSal,
    bankName: document.getElementById('mBankName').value.trim(),
    bankAccount: document.getElementById('mBankAccount').value.trim(),
    joinDate: document.getElementById('mJoinDate').value,
    remark: document.getElementById('mRemark').value.trim(),
    pfRate: pfRate,
    defaultSso: ssoVal,
    defaultTax: taxVal
  };

  if (!d.empId || !d.fullName) { showToast('กรุณากรอกรหัสและชื่อพนักงาน', 'error'); return; }
  var orig = document.getElementById('empOrigId').value;

  callApi('saveEmployee', { employee: d, origId: orig })
    .then(function(r) {
      showToast(r.message || 'บันทึกข้อมูลพนักงานสำเร็จ');
      closeModal('empModal');
      var p = loadAppData();
      if (openPayslipAfter) {
        if (p && p.then) {
          p.then(function() { viewPayslip(d.empId); });
        } else {
          setTimeout(function() { viewPayslip(d.empId); }, 300);
        }
      }
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
  document.body.classList.remove('printing-history');
  document.body.classList.add('printing-payslip');
  window.print();
  setTimeout(function() {
    document.body.classList.remove('printing-payslip');
  }, 1000);
}

function printHistoryReport() {
  var empId = document.getElementById('histEmpSelect') ? document.getElementById('histEmpSelect').value : '';
  if (!empId) {
    showToast('กรุณาเลือกพนักงานก่อนพิมพ์รายงานประวัติ', 'warning');
    return;
  }
  document.body.classList.remove('printing-payslip');
  document.body.classList.add('printing-history');
  window.print();
  setTimeout(function() {
    document.body.classList.remove('printing-history');
  }, 1000);
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
    var isUserRole = (State.currentUser && State.currentUser.role === 'User');
    if (isUserRole) {
      csv += 'รหัส,ชื่อ-นามสกุล,ชื่อเล่น,วันเกิด,อายุ,บัตรประชาชน,เบอร์โทร,ที่อยู่,แผนก,ตำแหน่ง,ธนาคาร,เลขบัญชี,วันเริ่มงาน\n';
      State.employees.forEach(function(e) {
        csv += [
          e.empId,
          '"' + (e.fullName || '').replace(/"/g, '""') + '"',
          '"' + (e.nickname || '').replace(/"/g, '""') + '"',
          e.birthDate || '',
          e.age || 0,
          '"' + (e.citizenId || '').replace(/"/g, '""') + '"',
          '"' + (e.phone || '').replace(/"/g, '""') + '"',
          '"' + (e.address || '').replace(/"/g, '""') + '"',
          '"' + (e.department || '').replace(/"/g, '""') + '"',
          '"' + (e.position || '').replace(/"/g, '""') + '"',
          '"' + (e.bankName || '').replace(/"/g, '""') + '"',
          '"' + (e.bankAccount || '').replace(/"/g, '""') + '"',
          e.joinDate || ''
        ].join(',') + '\n';
      });
    } else {
      csv += 'รหัส,ชื่อ-นามสกุล,ชื่อเล่น,ที่อยู่,แผนก,ตำแหน่ง,เงินเดือนฐาน,PF%,SSODefault,TaxDefault,ธนาคาร,เลขบัญชี,วันเกิด,อายุ,วันเริ่มงาน,บัตรประชาชน,เบอร์โทร,หมายเหตุ\n';
      State.employees.forEach(function(e) {
        csv += [
          e.empId,
          '"' + (e.fullName || '').replace(/"/g, '""') + '"',
          '"' + (e.nickname || '').replace(/"/g, '""') + '"',
          '"' + (e.address || '').replace(/"/g, '""') + '"',
          '"' + (e.department || '').replace(/"/g, '""') + '"',
          '"' + (e.position || '').replace(/"/g, '""') + '"',
          e.baseSalary || 0,
          e.pfRate || 0.05,
          e.defaultSso !== undefined ? e.defaultSso : 750,
          e.defaultTax || 0,
          '"' + (e.bankName || '').replace(/"/g, '""') + '"',
          '"' + (e.bankAccount || '').replace(/"/g, '""') + '"',
          e.birthDate || '',
          e.age || 0,
          e.joinDate || '',
          '"' + (e.citizenId || '').replace(/"/g, '""') + '"',
          '"' + (e.phone || '').replace(/"/g, '""') + '"',
          '"' + (e.remark || '').replace(/"/g, '""') + '"'
        ].join(',') + '\n';
      });
    }
  }

  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
function onBirthDateChanged() {
  var bVal = document.getElementById('mBirthDate').value;
  if (!bVal) return;
  var bDate = new Date(bVal);
  if (isNaN(bDate.getTime())) return;
  var today = new Date();
  var age = today.getFullYear() - bDate.getFullYear();
  var m = today.getMonth() - bDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
    age--;
  }
  if (age >= 0) {
    document.getElementById('mAge').value = age;
  }
}

// IMPORT EMPLOYEES CSV
function triggerImportEmployees() {
  var fileInput = document.getElementById('importEmployeesFileInput');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function handleImportEmployeesFile(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    parseAndImportEmployeesCSV(text);
  };
  reader.readAsText(file, 'utf-8');
}

function parseCSVLine(line) {
  var result = [];
  var cur = '';
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseAndImportEmployeesCSV(csvText) {
  if (!csvText || !csvText.trim()) {
    showToast('ไฟล์ CSV ว่างเปล่า', 'error');
    return;
  }

  // Remove BOM if present
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.substring(1);
  }

  var lines = csvText.split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
  if (lines.length <= 1) {
    showToast('ไม่พบแถวข้อมูลพนักงานในไฟล์ CSV', 'error');
    return;
  }

  // Header row
  var header = parseCSVLine(lines[0]);
  var employees = [];

  for (var i = 1; i < lines.length; i++) {
    var cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    // Map columns:
    // รหัส,ชื่อ-นามสกุล,ชื่อเล่น,ที่อยู่,แผนก,ตำแหน่ง,เงินเดือนฐาน,PF%,SSODefault,TaxDefault,ธนาคาร,เลขบัญชี,วันเกิด,อายุ,วันเริ่มงาน,บัตรประชาชน,เบอร์โทร
    var empId = cols[0];
    var fullName = cols[1];
    if (!empId || !fullName) continue;

    var emp = {
      empId: empId,
      fullName: fullName,
      nickname: cols[2] || '',
      address: cols[3] || '',
      department: cols[4] || '',
      position: cols[5] || '',
      baseSalary: Number(cols[6]) || 0,
      pfRate: Number(cols[7]) || 0.05,
      defaultSso: cols[8] !== undefined && cols[8] !== '' ? Number(cols[8]) : 750,
      defaultTax: Number(cols[9]) || 0,
      bankName: cols[10] || 'กสิกรไทย (KBANK)',
      bankAccount: cols[11] || '',
      birthDate: cols[12] || '',
      age: Number(cols[13]) || 0,
      joinDate: cols[14] || '',
      citizenId: cols[15] || '',
      phone: cols[16] || '',
      remark: cols[17] || ''
    };
    employees.push(emp);
  }

  if (employees.length === 0) {
    showToast('ไม่สามารถแปลงข้อมูลพนักงานจากไฟล์ได้ กรุณาตรวจสอบรูปแบบคอลัมน์', 'error');
    return;
  }

  if (!confirm('พบข้อมูลพนักงานทั้งหมด ' + employees.length + ' คน ต้องการนำเข้าสู่ระบบใช่หรือไม่?')) {
    return;
  }

  callApi('batchImportEmployees', { employees: employees })
    .then(function(res) {
      if (res.success) {
        showToast(res.message || 'นำเข้าข้อมูลพนักงานสำเร็จ');
        loadAppData();
      } else {
        showToast(res.message || 'เกิดข้อผิดพลาดในการนำเข้า', 'error');
      }
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

// USER MANAGEMENT HANDLERS
function onRoleTemplateChanged() {
  var role = document.getElementById('mRole').value;
  var allPerms = [
    'perm_view_emp', 'perm_view_salary', 'perm_edit_emp', 'perm_del_emp',
    'perm_view_inputs', 'perm_edit_inputs', 'populate_inputs',
    'perm_view_payroll', 'perm_calc_payroll', 'perm_view_payslip', 'perm_close_period',
    'perm_view_dash', 'perm_view_history', 'perm_print_history', 'perm_export_csv',
    'perm_manage_users', 'perm_company_settings', 'perm_backup_restore'
  ];

  if (role === 'Admin / HR' || role === 'Admin') {
    allPerms.forEach(function(p) {
      var el = document.getElementById(p);
      if (el) el.checked = true;
    });
  } else if (role === 'HR Payroll') {
    var hrPerms = ['perm_view_emp', 'perm_view_salary', 'perm_edit_emp', 'perm_view_inputs', 'perm_edit_inputs', 'populate_inputs', 'perm_view_payroll', 'perm_calc_payroll', 'perm_view_payslip', 'perm_view_dash', 'perm_view_history', 'perm_print_history', 'perm_export_csv'];
    allPerms.forEach(function(p) {
      var el = document.getElementById(p);
      if (el) el.checked = (hrPerms.indexOf(p) >= 0);
    });
  } else if (role === 'HR Time Attendance') {
    var attPerms = ['perm_view_emp', 'perm_edit_emp', 'perm_view_inputs', 'perm_edit_inputs', 'populate_inputs', 'perm_view_history', 'perm_print_history'];
    allPerms.forEach(function(p) {
      var el = document.getElementById(p);
      if (el) el.checked = (attPerms.indexOf(p) >= 0);
    });
  } else if (role === 'Accounting / Finance') {
    var accPerms = ['perm_view_dash', 'perm_view_payroll', 'perm_view_payslip', 'perm_view_history', 'perm_print_history', 'perm_export_csv'];
    allPerms.forEach(function(p) {
      var el = document.getElementById(p);
      if (el) el.checked = (accPerms.indexOf(p) >= 0);
    });
  } else if (role === 'User') {
    var userPerms = ['perm_view_emp'];
    allPerms.forEach(function(p) {
      var el = document.getElementById(p);
      if (el) el.checked = (userPerms.indexOf(p) >= 0);
    });
  }
}

function openAddUserModal() {
  document.getElementById('userModalTitle').innerHTML = '<i class="fa-solid fa-user-plus"></i> เพิ่มผู้ใช้งาน';
  document.getElementById('userOrigUsername').value = '';
  document.getElementById('mUsername').value = '';
  document.getElementById('mUsername').disabled = false;
  document.getElementById('mPassword').value = '';
  document.getElementById('mRole').value = 'HR Payroll';
  onRoleTemplateChanged();
  openModal('userModal');
}

function openEditUserModal(username) {
  var u = State.users.find(function(x) { return x.username === username; });
  if (!u) return;
  document.getElementById('userModalTitle').innerHTML = '<i class="fa-solid fa-user-pen"></i> กำหนดสิทธิ์ / แก้ไขผู้ใช้: ' + esc(u.username);
  document.getElementById('userOrigUsername').value = u.username;
  document.getElementById('mUsername').value = u.username;
  document.getElementById('mUsername').disabled = (u.username === 'admin');
  document.getElementById('mPassword').value = '';

  var roleSel = document.getElementById('mRole');
  var matchedRole = false;
  for (var i = 0; i < roleSel.options.length; i++) {
    if (roleSel.options[i].value === u.role) {
      roleSel.selectedIndex = i;
      matchedRole = true;
      break;
    }
  }
  if (!matchedRole) roleSel.value = 'Custom';

  // Apply user's active permissions to checkboxes
  var perms = u.permissions || [];
  var isAll = perms.indexOf('all') >= 0 || u.username === 'admin';

  var allPerms = [
    'perm_view_emp', 'perm_view_salary', 'perm_edit_emp', 'perm_del_emp',
    'perm_view_inputs', 'perm_edit_inputs', 'populate_inputs',
    'perm_view_payroll', 'perm_calc_payroll', 'perm_view_payslip', 'perm_close_period',
    'perm_view_dash', 'perm_view_history', 'perm_print_history', 'perm_export_csv',
    'perm_manage_users', 'perm_company_settings', 'perm_backup_restore'
  ];

  allPerms.forEach(function(pKey) {
    var el = document.getElementById(pKey);
    if (el) {
      // Map element id to perm key
      var cleanKey = pKey.replace('perm_', '');
      if (pKey === 'populate_inputs') cleanKey = 'populate_inputs';
      el.checked = isAll || (perms.indexOf(cleanKey) >= 0) || (perms.indexOf(pKey) >= 0);
    }
  });

  openModal('userModal');
}

function saveUserForm(e) {
  if (e) e.preventDefault();
  var orig = document.getElementById('userOrigUsername').value;
  var u = document.getElementById('mUsername').value.trim();
  var p = document.getElementById('mPassword').value.trim();
  var role = document.getElementById('mRole').value;

  if (!u) { showToast('กรุณากรอก Username', 'error'); return; }
  if (!orig && !p) { showToast('กรุณากรอก Password', 'error'); return; }

  // Collect checked permissions
  var perms = [];
  if (role === 'Admin / HR' || role === 'Admin' || u === 'admin') {
    perms = ['all'];
  } else {
    var permElements = [
      { id: 'perm_view_emp', key: 'view_emp' },
      { id: 'perm_view_salary', key: 'view_salary' },
      { id: 'perm_edit_emp', key: 'edit_emp' },
      { id: 'perm_del_emp', key: 'del_emp' },
      { id: 'perm_view_inputs', key: 'view_inputs' },
      { id: 'perm_edit_inputs', key: 'edit_inputs' },
      { id: 'perm_populate_inputs', key: 'populate_inputs' },
      { id: 'perm_view_payroll', key: 'view_payroll' },
      { id: 'perm_calc_payroll', key: 'calc_payroll' },
      { id: 'perm_view_payslip', key: 'view_payslip' },
      { id: 'perm_close_period', key: 'close_period' },
      { id: 'perm_view_dash', key: 'view_dash' },
      { id: 'perm_view_history', key: 'view_history' },
      { id: 'perm_print_history', key: 'print_history' },
      { id: 'perm_export_csv', key: 'export_csv' },
      { id: 'perm_manage_users', key: 'manage_users' },
      { id: 'perm_company_settings', key: 'manage_company' },
      { id: 'perm_backup_restore', key: 'manage_backup' }
    ];
    permElements.forEach(function(item) {
      var el = document.getElementById(item.id);
      if (el && el.checked) perms.push(item.key);
    });
  }

  var userData = {
    username: u,
    role: role,
    permissions: perms
  };
  if (p) userData.password = p;

  callApi('saveUser', { user: userData, origUser: orig })
    .then(function(r) {
      showToast(r.message || 'บันทึกผู้ใช้งานเรียบร้อยแล้ว');
      closeModal('userModal');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function deleteUser(username) {
  if (username.toLowerCase() === 'admin') {
    showToast('ไม่สามารถลบผู้ใช้งาน Admin หลักของระบบได้', 'error');
    return;
  }
  if (!confirm('ยืนยันการลบผู้ใช้งาน ' + username + ' ออกจากระบบ?')) return;
  callApi('deleteUser', { username: username })
    .then(function(r) {
      if (r.success) {
        showToast(r.message || 'ลบผู้ใช้งานสำเร็จ');
        loadAppData();
      } else {
        showToast(r.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้', 'error');
      }
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

// EMPLOYEE PF TOGGLE HANDLERS
function onEmpHasPfChanged() {
  var chk = document.getElementById('mHasPf').checked;
  var input = document.getElementById('mPfRate');
  var label = document.getElementById('mPfRateLabel');
  if (chk) {
    input.disabled = false;
    if (!input.value || Number(input.value) <= 0) input.value = '0.05';
    var pct = Math.round(Number(input.value) * 100);
    label.textContent = '(' + pct + '%)';
    label.style.color = '#1d4ed8';
  } else {
    input.value = '0';
    input.disabled = true;
    label.textContent = '(ไม่หัก PF)';
    label.style.color = '#94a3b8';
  }
}

function onEmpPfRateInputChanged() {
  var input = document.getElementById('mPfRate');
  var label = document.getElementById('mPfRateLabel');
  var val = Number(input.value) || 0;
  var pct = Math.round(val * 100);
  label.textContent = '(' + pct + '%)';
}

// EMPLOYEE SSO TOGGLE HANDLERS
function onEmpHasSsoChanged() {
  var chk = document.getElementById('mHasSso').checked;
  var input = document.getElementById('mDefaultSso');
  var label = document.getElementById('mDefaultSsoLabel');
  if (chk) {
    input.disabled = false;
    if (!input.value || Number(input.value) <= 0) input.value = '750';
    label.textContent = '(' + fmt(input.value) + ')';
    label.style.color = '#dc2626';
  } else {
    input.value = '0';
    input.disabled = true;
    label.textContent = '(ไม่หัก SSO)';
    label.style.color = '#94a3b8';
  }
}

function onEmpSsoInputChanged() {
  var input = document.getElementById('mDefaultSso');
  var label = document.getElementById('mDefaultSsoLabel');
  var val = Number(input.value) || 0;
  label.textContent = '(' + fmt(val) + ')';
}

// HISTORY TABLE SEARCH FILTER
var currentHistoryList = [];
function filterHistoryTable() {
  var tbody = document.getElementById('historyTableBody');
  if (!tbody || !currentHistoryList || currentHistoryList.length === 0) return;
  var q = (document.getElementById('historySearchInput') ? document.getElementById('historySearchInput').value : '').trim().toLowerCase();
  var filtered = currentHistoryList.filter(function(c) {
    if (!q) return true;
    return (c.period && c.period.toLowerCase().indexOf(q) >= 0) ||
           (c.department && c.department.toLowerCase().indexOf(q) >= 0) ||
           (c.position && c.position.toLowerCase().indexOf(q) >= 0);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="19" class="text-center text-muted" style="padding:28px">ไม่พบประวัติที่ตรงกับคำค้นหา "' + esc(q) + '"</td></tr>';
    return;
  }

  var h = '';
  filtered.forEach(function(c) {
    h += '<tr>' +
      '<td class="font-bold text-blue">' + esc(c.period) + '</td>' +
      '<td class="font-mono font-bold">' + fmt(c.baseSalary) + '</td>' +
      '<td class="text-right font-mono">' + (c.absentDays || 0) + '</td>' +
      '<td class="text-right font-mono">' + (c.leaveDays || 0) + '</td>' +
      '<td class="text-right font-mono">' + (c.sickLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(c.lateDeduct) + '</td>' +
      '<td class="text-right font-mono">' + (c.otHours || 0) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(c.otPay) + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(c.allowance) + '</td>' +
      '<td class="text-right font-mono">' + fmt(c.bonus) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + fmt(c.leaveDeduction) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + fmt(c.grossPay) + '</td>' +
      '<td class="text-right font-mono">' + fmt(c.sso) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue">' + fmt(c.pf) + '</td>' +
      '<td class="text-right font-mono">' + fmt(c.tax) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(c.advanceDeduct) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(c.otherDeduct) + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light">' + fmt(c.totalDeductions) + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light">' + fmt(c.netPay) + '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
}

// BACKUP & RESTORE HANDLERS
function backupDatabase() {
  showToast('กำลังเตรียมไฟล์สำรองข้อมูล...', 'info');
  callApi('backupDatabase')
    .then(function(r) {
      if (!r.success || !r.backup) {
        showToast(r.message || 'ไม่สามารถสำรองข้อมูลได้', 'error');
        return;
      }
      var jsonStr = JSON.stringify(r.backup, null, 2);
      var nowStr = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      var filename = 'PTN_PAYROLL_BACKUP_' + nowStr + '.json';

      var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('ดาวน์โหลดไฟล์สำรองข้อมูลสำเร็จ');
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

function triggerRestoreBackup() {
  var fileInput = document.getElementById('restoreBackupFileInput');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function handleRestoreBackupFile(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!confirm('⚠️ คำเตือนสำคัญ!\n\nการกู้คืนข้อมูลจะเขียนทับข้อมูลพนักงาน ข้อมูลเงินเดือนทุกงวด ผู้ใช้งาน และการตั้งค่าทั้งหมดในระบบด้วยข้อมูลจากไฟล์นี้\n\nคุณแน่ใจหรือไม่ที่จะทำการกู้คืนข้อมูล?')) {
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var backupData = JSON.parse(e.target.result);
      showToast('กำลังกู้คืนข้อมูลเข้าสู่ระบบ...', 'info');
      callApi('restoreDatabase', { backup: backupData })
        .then(function(r) {
          if (r.success) {
            showToast(r.message || 'กู้คืนข้อมูลสำเร็จ');
            loadAppData();
          } else {
            showToast(r.message || 'เกิดข้อผิดพลาดในการกู้คืนข้อมูล', 'error');
          }
        })
        .catch(function(err) {
          showToast('Error: ' + err.message, 'error');
        });
    } catch(err) {
      showToast('ไฟล์ JSON ไม่ถูกต้อง หรือเสียหาย: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function exportAllEmployeeHistory() {
  showToast('กำลังเตรียมข้อมูลประวัติพนักงานทั้งหมด...', 'info');
  callApi('getAllEmployeeHistory')
    .then(function(r) {
      if (!r.success || !r.allHistory) {
        showToast(r.message || 'ไม่พบข้อมูลประวัติพนักงาน', 'error');
        return;
      }
      var list = r.allHistory;
      if (list.length === 0) {
        showToast('ยังไม่มีข้อมูลประวัติเงินเดือนในระบบ', 'warning');
        return;
      }

      var csv = '\uFEFF';
      csv += 'งวด,รหัสพนักงาน,ชื่อ-นามสกุล,ชื่อเล่น,แผนก,ตำแหน่ง,เงินเดือนฐาน,ขาด(วัน),ลากิจ(วัน),ลาป่วย(วัน),หักสาย(บาท),OT(ชม),อัตราOT,เงินOT,เบี้ยขยัน,โบนัส,รวมหักขาดลาสาย,เงินได้รวมGross,ประกันสังคม,กองทุนPF,ภาษี,หักเงินเบิก,หักอื่นๆ,รวมหักทั้งหมด,เงินได้สุทธิNet\n';

      list.forEach(function(row) {
        var line = [
          '"' + (row.period || '').replace(/"/g, '""') + '"',
          '"' + (row.empId || '').replace(/"/g, '""') + '"',
          '"' + (row.fullName || '').replace(/"/g, '""') + '"',
          '"' + (row.nickname || '').replace(/"/g, '""') + '"',
          '"' + (row.department || '').replace(/"/g, '""') + '"',
          '"' + (row.position || '').replace(/"/g, '""') + '"',
          Number(row.baseSalary) || 0,
          Number(row.absentDays) || 0,
          Number(row.leaveDays) || 0,
          Number(row.sickLeaveDays) || 0,
          Number(row.lateDeduct) || 0,
          Number(row.otHours) || 0,
          Number(row.otRate) || 40,
          Number(row.otPay) || 0,
          Number(row.allowance) || 0,
          Number(row.bonus) || 0,
          Number(row.leaveDeduction) || 0,
          Number(row.grossPay) || 0,
          Number(row.sso) || 0,
          Number(row.pf) || 0,
          Number(row.tax) || 0,
          Number(row.advanceDeduct) || 0,
          Number(row.otherDeduct) || 0,
          Number(row.totalDeductions) || 0,
          Number(row.netPay) || 0
        ];
        csv += line.join(',') + '\n';
      });

      var filename = 'PTN_All_Employees_History_' + new Date().toISOString().substring(0, 10) + '.csv';
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('ดาวน์โหลดไฟล์ประวัติพนักงานทั้งหมด (' + list.length + ' รายการ) สำเร็จ');
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

function printAllEmployeesBatch() {
  showToast('กำลังเตรียมเอกสารประวัติพนักงานทุกคนสำหรับพิมพ์...', 'info');
  var yrSel = document.getElementById('histYearSelect');
  var yr = yrSel ? yrSel.value : 'ALL';

  callApi('getAllEmployeeHistory')
    .then(function(r) {
      if (!r.success || !r.allHistory || r.allHistory.length === 0) {
        showToast('ไม่พบข้อมูลประวัติพนักงานสำหรับพิมพ์', 'warning');
        return;
      }

      var all = r.allHistory;
      if (yr && yr !== 'ALL') {
        all = all.filter(function(x) { return x.period && x.period.indexOf(yr) >= 0; });
      }

      if (all.length === 0) {
        showToast('ไม่พบข้อมูลประวัติพนักงานในปี ' + yr, 'warning');
        return;
      }

      // Group by empId
      var grouped = {};
      State.employees.forEach(function(e) {
        grouped[e.empId] = { emp: e, rows: [] };
      });

      all.forEach(function(row) {
        if (!grouped[row.empId]) {
          grouped[row.empId] = {
            emp: {
              empId: row.empId,
              fullName: row.fullName,
              nickname: row.nickname,
              department: row.department,
              position: row.position,
              baseSalary: row.baseSalary
            },
            rows: []
          };
        }
        grouped[row.empId].rows.push(row);
      });

      var container = document.getElementById('histBatchPrintArea');
      if (!container) return;

      var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
      var html = '';

      Object.keys(grouped).sort().forEach(function(empId) {
        var item = grouped[empId];
        var emp = item.emp;
        var rows = item.rows;
        if (rows.length === 0) return; // Skip employees with no records in this year

        var pfText = (emp.pfRate !== null && emp.pfRate !== undefined && !isNaN(Number(emp.pfRate)) && Number(emp.pfRate) > 0) ? (Math.round(Number(emp.pfRate) * 100) + '%') : 'ไม่หัก PF';

        html += '<div class="batch-emp-page">';
        html += '<div style="text-align:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px">';
        html += '<h2 style="font-size:16px;font-weight:700;margin:0 0 3px">' + esc(compName) + '</h2>';
        html += '<p style="font-size:12px;font-weight:700;color:#1e3a8a;margin:2px 0">รายงานประวัติการทำงานและเงินเดือนรายบุคคล (ประจำปี ' + (yr === 'ALL' ? 'ทั้งหมด' : yr) + ')</p>';
        html += '</div>';

        // Profile card
        html += '<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:10.5px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px">';
        html += '<div><span style="color:#64748b">รหัสพนักงาน:</span> <strong>' + esc(emp.empId) + '</strong></div>';
        html += '<div><span style="color:#64748b">ชื่อ-นามสกุล:</span> <strong>' + esc(emp.fullName) + (emp.nickname ? ' (' + esc(emp.nickname) + ')' : '') + '</strong></div>';
        html += '<div><span style="color:#64748b">แผนก/ตำแหน่ง:</span> <strong>' + esc(emp.department || '-') + ' / ' + esc(emp.position || '-') + '</strong></div>';
        html += '<div><span style="color:#64748b">เงินเดือนฐาน:</span> <strong>' + fmt(emp.baseSalary) + '</strong></div>';
        html += '<div><span style="color:#64748b">วันเกิด/อายุ:</span> <strong>' + esc(emp.birthDate || '-') + ' (' + (emp.age || 0) + ' ปี)</strong></div>';
        html += '<div><span style="color:#64748b">ธนาคาร:</span> <strong>' + esc(emp.bankName || '-') + ' ' + esc(emp.bankAccount || '-') + '</strong></div>';
        html += '<div><span style="color:#64748b">วันเริ่มงาน:</span> <strong>' + esc(emp.joinDate || '-') + '</strong></div>';
        html += '<div><span style="color:#64748b">กองทุน PF:</span> <strong>' + pfText + '</strong></div>';
        html += '</div>';

        // Table
        html += '<table class="data-table" style="font-size:7.5pt">';
        html += '<thead><tr>';
        html += '<th style="width:90px">งวด</th><th class="text-right">ฐาน</th><th class="text-right">ขาด</th><th class="text-right">ลากิจ</th><th class="text-right">ลาป่วย</th><th class="text-right">สาย</th><th class="text-right">OT ชม.</th><th class="text-right">เงินOT</th><th class="text-right">เบี้ยขยัน</th><th class="text-right">โบนัส</th><th class="text-right">Gross</th><th class="text-right">ปกส.</th><th class="text-right">PF</th><th class="text-right">ภาษี</th><th class="text-right">รวมหัก</th><th class="text-right">สุทธิ(Net)</th>';
        html += '</tr></thead><tbody>';

        var sumBase = 0, sumAbs = 0, sumLev = 0, sumSck = 0, sumLate = 0, sumOtH = 0, sumOtP = 0, sumAllow = 0, sumBon = 0, sumGross = 0, sumSso = 0, sumPf = 0, sumTax = 0, sumDed = 0, sumNet = 0;

        rows.forEach(function(r) {
          sumBase += Number(r.baseSalary) || 0; sumAbs += Number(r.absentDays) || 0; sumLev += Number(r.leaveDays) || 0; sumSck += Number(r.sickLeaveDays) || 0;
          sumLate += Number(r.lateDeduct) || 0; sumOtH += Number(r.otHours) || 0; sumOtP += Number(r.otPay) || 0; sumAllow += Number(r.allowance) || 0;
          sumBon += Number(r.bonus) || 0; sumGross += Number(r.grossPay) || 0; sumSso += Number(r.sso) || 0; sumPf += Number(r.pf) || 0;
          sumTax += Number(r.tax) || 0; sumDed += Number(r.totalDeductions) || 0; sumNet += Number(r.netPay) || 0;

          html += '<tr>' +
            '<td class="font-bold">' + esc(r.period) + '</td>' +
            '<td class="text-right font-mono">' + fmt(r.baseSalary) + '</td>' +
            '<td class="text-right font-mono">' + (r.absentDays || 0) + '</td>' +
            '<td class="text-right font-mono">' + (r.leaveDays || 0) + '</td>' +
            '<td class="text-right font-mono">' + (r.sickLeaveDays || 0) + '</td>' +
            '<td class="text-right font-mono">' + fmt(r.lateDeduct || 0) + '</td>' +
            '<td class="text-right font-mono">' + (r.otHours || 0) + '</td>' +
            '<td class="text-right font-mono text-blue font-bold">' + fmt(r.otPay || 0) + '</td>' +
            '<td class="text-right font-mono text-green font-bold">' + fmt(r.allowance || 0) + '</td>' +
            '<td class="text-right font-mono">' + fmt(r.bonus || 0) + '</td>' +
            '<td class="text-right font-mono font-bold text-blue">' + fmt(r.grossPay || 0) + '</td>' +
            '<td class="text-right font-mono font-bold text-red">' + fmt(r.sso || 0) + '</td>' +
            '<td class="text-right font-mono text-blue font-bold">' + fmt(r.pf || 0) + '</td>' +
            '<td class="text-right font-mono">' + fmt(r.tax || 0) + '</td>' +
            '<td class="text-right font-mono font-bold text-red">' + fmt(r.totalDeductions || 0) + '</td>' +
            '<td class="text-right font-mono font-bold text-green">' + fmt(r.netPay || 0) + '</td>' +
          '</tr>';
        });

        html += '</tbody>';
        html += '<tfoot style="background:#eff6ff;font-weight:700;border-top:1.5px solid #93c5fd"><tr>';
        html += '<td class="font-bold">รวมสะสม (' + rows.length + ' งวด)</td>' +
          '<td class="text-right font-mono">' + fmt(sumBase) + '</td>' +
          '<td class="text-right font-mono">' + sumAbs + '</td>' +
          '<td class="text-right font-mono">' + sumLev + '</td>' +
          '<td class="text-right font-mono">' + sumSck + '</td>' +
          '<td class="text-right font-mono">' + fmt(sumLate) + '</td>' +
          '<td class="text-right font-mono">' + sumOtH + '</td>' +
          '<td class="text-right font-mono text-blue font-bold">' + fmt(sumOtP) + '</td>' +
          '<td class="text-right font-mono text-green font-bold">' + fmt(sumAllow) + '</td>' +
          '<td class="text-right font-mono">' + fmt(sumBon) + '</td>' +
          '<td class="text-right font-mono font-bold text-blue">' + fmt(sumGross) + '</td>' +
          '<td class="text-right font-mono font-bold text-red">' + fmt(sumSso) + '</td>' +
          '<td class="text-right font-mono text-blue font-bold">' + fmt(sumPf) + '</td>' +
          '<td class="text-right font-mono">' + fmt(sumTax) + '</td>' +
          '<td class="text-right font-mono font-bold text-red">' + fmt(sumDed) + '</td>' +
          '<td class="text-right font-mono font-bold text-green">' + fmt(sumNet) + '</td>' +
        '</tr></tfoot>';
        html += '</table>';
        html += '</div>'; // end .batch-emp-page
      });

      container.innerHTML = html;

      document.body.classList.remove('printing-payslip');
      document.body.classList.remove('printing-history');
      document.body.classList.remove('printing-yearly-summary');
      document.body.classList.add('printing-batch-history');

      window.print();

      setTimeout(function() {
        document.body.classList.remove('printing-batch-history');
      }, 1000);
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}


console.log("1. Testing functions with Admin user (Full Permissions)...");
State.currentUser = { username: 'admin', role: 'Admin / HR', permissions: ['all'] };
State.employees = [
  { empId: 'EMP001', fullName: 'นายทดสอบ', nickname: 'ทดสอบ', baseSalary: 15000, pfRate: 0.05, defaultSso: 750, defaultTax: 0 }
];
State.inputRecords = [
  { no: 1, empId: 'EMP001', empName: 'นายทดสอบ', baseSalary: 15000, absentDays: 0, leaveDays: 0, sickLeaveDays: 0, lateDeduct: 0, otHours: 0, otRate: 40, allowance: 0, bonus: 0, pfAmount: 750, sso: 750, tax: 0, advanceDeduct: 0, otherDeduct: 0 }
];
State.payrollList = [
  { empId: 'EMP001', name: 'นายทดสอบ', department: 'โกดัง', position: 'พนักงาน', baseSalary: 15000, otHours: 0, otRate: 40, otPay: 0, allowance: 0, bonus: 0, leaveDeduction: 0, grossPay: 15000, sso: 750, pf: 750, tax: 0, advanceDeduct: 0, otherDeduct: 0, totalDeductions: 1500, netPay: 13500 }
];
State.stats = { totalEmployees: 1, totalGross: 15000, totalDeductions: 1500, totalNet: 13500 };
State.users = [
  { username: 'admin', role: 'Admin / HR', permissions: ['all'] }
];

try {
  applyRolePermissions();
  renderDashboard();
  renderPayrollTable();
  renderInputTable();
  renderEmployeesTable();
  renderHistoryTab();
  renderCompanySettings();
  renderUsersTable();
  console.log(">>> ADMIN TEST: ALL RENDER FUNCTIONS PASSED! <<<");
} catch (err) {
  console.error("ADMIN TEST ERROR:", err);
  process.exit(1);
}

console.log("2. Testing functions with General User (NO salary view)...");
State.currentUser = { username: 'user01', role: 'User', permissions: ['view_emp'] };

try {
  applyRolePermissions();
  renderDashboard();
  renderPayrollTable();
  renderInputTable();
  renderEmployeesTable();
  renderHistoryTab();
  renderCompanySettings();
  renderUsersTable();
  console.log(">>> GENERAL USER TEST: ALL RENDER FUNCTIONS PASSED! <<<");
} catch (err) {
  console.error("GENERAL USER TEST ERROR:", err);
  process.exit(1);
}

console.log("3. Testing functions with HR Time Attendance (NO salary view, has attendance write)...");
State.currentUser = { username: 'hr_time', role: 'HR Time Attendance', permissions: ['view_emp', 'edit_emp', 'view_inputs', 'edit_inputs', 'populate_inputs'] };

try {
  applyRolePermissions();
  renderDashboard();
  renderPayrollTable();
  renderInputTable();
  renderEmployeesTable();
  renderHistoryTab();
  renderCompanySettings();
  renderUsersTable();
  console.log(">>> HR TIME ATTENDANCE TEST: ALL RENDER FUNCTIONS PASSED! <<<");
} catch (err) {
  console.error("HR TIME ATTENDANCE TEST ERROR:", err);
  process.exit(1);
}

console.log("\n=============================================");
console.log("ALL TESTS COMPLETED SUCCESSFULLY WITH 0 ERRORS!");
console.log("=============================================");
