function applyRolePermissions() {
  var role = (State.currentUser && State.currentUser.role) ? String(State.currentUser.role).trim() : 'User';
  var roleLower = role.toLowerCase();
  var isGeneralUser = (roleLower === 'user');
  var isHR = (roleLower === 'hr');
  var isAdmin = (roleLower.indexOf('admin') >= 0);

  // Top user badge
  var badgeEl = document.getElementById('topUserBadge');
  if (badgeEl) {
    var iconClass = isAdmin ? 'fa-crown' : (isHR ? 'fa-user-tie' : 'fa-user');
    badgeEl.innerHTML = '<i class="fa-solid ' + iconClass + '"></i> ' + esc(State.currentUser.username) + ' (' + esc(role) + ')';
  }

  // Navigation tabs
  var tabDash = document.getElementById('navBtn-dashboard');
  var tabPay = document.getElementById('navBtn-payroll');
  var tabInp = document.getElementById('navBtn-input');
  var tabEmp = document.getElementById('navBtn-employees');
  var tabHist = document.getElementById('navBtn-history');
  var tabComp = document.getElementById('navBtn-company');
  var tabUsers = document.getElementById('navBtn-users');
  var periodBar = document.getElementById('periodBar');

  if (isGeneralUser) {
    if (tabDash) tabDash.style.display = 'none';
    if (tabPay) tabPay.style.display = 'none';
    if (tabInp) tabInp.style.display = 'none';
    if (tabHist) tabHist.style.display = 'none';
    if (tabComp) tabComp.style.display = 'none';
    if (tabUsers) tabUsers.style.display = 'none';
    if (periodBar) periodBar.style.display = 'none';
    if (tabEmp) tabEmp.style.display = 'inline-flex';

    // Force active tab to employees immediately
    switchTab('employees');
  } else {
    if (tabDash) tabDash.style.display = 'inline-flex';
    if (tabPay) tabPay.style.display = 'inline-flex';
    if (tabInp) tabInp.style.display = 'inline-flex';
    if (tabEmp) tabEmp.style.display = 'inline-flex';
    if (tabHist) tabHist.style.display = 'inline-flex';
    if (periodBar) periodBar.style.display = 'flex';

    if (isAdmin) {
      if (tabComp) tabComp.style.display = 'inline-flex';
      if (tabUsers) tabUsers.style.display = 'inline-flex';
    } else {
      if (tabComp) tabComp.style.display = 'none';
      if (tabUsers) tabUsers.style.display = 'none';
    }
  }
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
  document.getElementById('statTotalEmp').textContent = State.stats.totalEmployees + ' คน';
  document.getElementById('statGrossPay').textContent = fmt(State.stats.totalGross);
  document.getElementById('statTotalDeductions').textContent = fmt(State.stats.totalDeductions);
  document.getElementById('statNetPay').textContent = fmt(State.stats.totalNet);

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
      '<td class="text-right font-mono">' + fmt(i.sso !== undefined && i.sso !== null ? i.sso : 0) + '</td>' +
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
  var thead = document.getElementById('employeesTableHead');
  if (!tbody) return;

  var role = (State.currentUser && State.currentUser.role) ? String(State.currentUser.role).trim().toLowerCase() : 'user';
  var isGeneralUser = (role === 'user');

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
    sel += '<option value="' + e.empId + '" data-name="' + esc(e.fullName) + '" data-salary="' + e.baseSalary + '" data-pf="' + empPf + '" data-sso="' + (e.defaultSso !== undefined ? e.defaultSso : 750) + '" data-tax="' + (e.defaultTax || 0) + '">' + esc(e.empId) + ' - ' + esc(e.fullName) + nickDisplay + '</option>';
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
          '<button type="button" class="btn-icon edit" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button>' +
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
          '<button type="button" class="btn-icon edit" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button> ' +
          '<button type="button" class="btn-icon del" onclick="deleteEmployee(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-trash"></i> ลบ</button>' +
        '</td>' +
      '</tr>';
    }
  });
  tbody.innerHTML = h;
}

// 5. EMPLOYEE WORK HISTORY TAB
var currentHistoryList = [];
function renderHistoryTab() {
  var sel = document.getElementById('histEmpSelect');
  if (sel && sel.value) {
    onHistoryEmpChanged();
  }
}

function onHistoryEmpChanged() {
  var empId = document.getElementById('histEmpSelect').value;
  var contentArea = document.getElementById('histContentArea');
  if (!empId) {
    if (contentArea) contentArea.style.display = 'none';
    currentHistoryList = [];
    return;
  }

  callApi('getEmployeeHistory', { empId: empId })
    .then(function(r) {
      if (!r.success) { showToast(r.message, 'error'); return; }
      var emp = r.employee || {};
      currentHistoryList = r.history || [];

      if (contentArea) contentArea.style.display = 'block';
      if (document.getElementById('histEmpCardName')) document.getElementById('histEmpCardName').textContent = (emp.fullName || '') + (emp.nickname ? ' (' + emp.nickname + ')' : '') + ' [' + (emp.empId || '') + ']';
      if (document.getElementById('histEmpCardDept')) document.getElementById('histEmpCardDept').textContent = (emp.department || '-') + ' / ' + (emp.position || '-');
      var birthAgeStr = (emp.birthDate || '-') + (emp.age ? ' (' + emp.age + ' ปี)' : '');
      if (document.getElementById('histEmpCardBirthAge')) document.getElementById('histEmpCardBirthAge').textContent = birthAgeStr;
      if (document.getElementById('histEmpCardCitizen')) document.getElementById('histEmpCardCitizen').textContent = emp.citizenId || '-';
      if (document.getElementById('histEmpCardPhone')) document.getElementById('histEmpCardPhone').textContent = emp.phone || '-';
      if (document.getElementById('histEmpCardBank')) document.getElementById('histEmpCardBank').textContent = (emp.bankName || '-') + ' ' + (emp.bankAccount || '-');
      if (document.getElementById('histEmpCardSalary')) document.getElementById('histEmpCardSalary').textContent = fmt(emp.baseSalary);
      if (document.getElementById('histEmpCardJoin')) document.getElementById('histEmpCardJoin').textContent = emp.joinDate || '-';
      if (document.getElementById('histEmpCardPf')) document.getElementById('histEmpCardPf').textContent = (Number(emp.pfRate) > 0) ? (((Number(emp.pfRate) * 100).toFixed(0)) + '%') : 'ไม่หัก (0%)';

      filterHistoryTable();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function filterHistoryTable() {
  var tbody = document.getElementById('historyTableBody') || document.getElementById('histTableBody');
  if (!tbody) return;

  var q = (document.getElementById('historySearchInput') ? document.getElementById('historySearchInput').value : '').trim().toLowerCase();
  var list = (currentHistoryList || []).filter(function(row) {
    if (!q) return true;
    return (row.period && row.period.toLowerCase().indexOf(q) >= 0) ||
           (row.department && row.department.toLowerCase().indexOf(q) >= 0) ||
           (row.position && row.position.toLowerCase().indexOf(q) >= 0);
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="19" class="text-center text-muted" style="padding:28px">' +
      '<div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:4px"><i class="fa-solid fa-clock-rotate-left"></i> ' + (q ? 'ไม่พบประวัติที่ตรงกับคำค้นหา "' + esc(q) + '"' : 'ยังไม่มีประวัติเงินเดือนในระบบ') + '</div>' +
    '</td></tr>';
    return;
  }

  var h = '';
  list.forEach(function(c) {
    h += '<tr>' +
      '<td class="font-bold text-blue">' + esc(c.period) + '</td>' +
      '<td class="text-right font-mono font-bold">' + fmt(c.baseSalary) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (c.absentDays || 0) + '</td>' +
      '<td class="text-right font-mono">' + (c.leaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + (c.sickLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(c.lateDeduct || 0) + '</td>' +
      '<td class="text-right font-mono">' + (c.otHours || 0) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + fmt(c.otPay || 0) + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(c.allowance || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(c.bonus || 0) + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + fmt(c.leaveDeduction || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + fmt(c.grossPay || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-red">' + fmt(c.sso || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue">' + fmt(c.pf || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(c.tax || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(c.advanceDeduct || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(c.otherDeduct || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light">' + fmt(c.totalDeductions || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light" style="font-size:13px">' + fmt(c.netPay || 0) + '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
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
    var finalSso = (ssoVal !== null && ssoVal !== '' && !isNaN(Number(ssoVal))) ? Number(ssoVal) : (emp && emp.defaultSso !== undefined && emp.defaultSso !== null ? Number(emp.defaultSso) : 0);
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

function saveInputRecordForm(e) {
  if (e) e.preventDefault();
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

function saveEmployeeForm(e) {
  if (e) e.preventDefault();
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
function openAddUserModal() {
  document.getElementById('userModalTitle').innerHTML = '<i class="fa-solid fa-user-plus"></i> เพิ่มผู้ใช้งาน';
  document.getElementById('userOrigUsername').value = '';
  document.getElementById('mUsername').value = '';
  document.getElementById('mPassword').value = '';
  document.getElementById('mRole').value = 'Admin / HR';
  openModal('userModal');
}

function openEditUserModal(username) {
  var u = State.users.find(function(x) { return x.username === username; });
  if (!u) return;
  document.getElementById('userModalTitle').innerHTML = '<i class="fa-solid fa-user-pen"></i> แก้ไขผู้ใช้งาน';
  document.getElementById('userOrigUsername').value = u.username;
  document.getElementById('mUsername').value = u.username;
  document.getElementById('mPassword').value = u.password || '';
  document.getElementById('mRole').value = u.role || 'Admin / HR';
  openModal('userModal');
}

function saveUserForm(e) {
  if (e) e.preventDefault();
  var u = {
    username: document.getElementById('mUsername').value.trim(),
    password: document.getElementById('mPassword').value.trim(),
    role: document.getElementById('mRole').value
  };
  if (!u.username || !u.password) {
    showToast('กรุณากรอก Username และ Password', 'error');
    return;
  }
  var orig = document.getElementById('userOrigUsername').value;
  callApi('saveUser', { user: u, origUser: orig })
    .then(function(r) {
      if (r.success) {
        showToast(r.message || 'บันทึกผู้ใช้งานสำเร็จ');
        closeModal('userModal');
        loadAppData();
      } else {
        showToast(r.message || 'เกิดข้อผิดพลาดในการบันทึกผู้ใช้', 'error');
      }
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
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
