// ==============================================================================
// GLOBAL PRINT MANAGEMENT & CLEANUP
// ==============================================================================
var ALL_PRINT_CLASSES = [
  'printing-payslip',
  'printing-salary-cert',
  'printing-50twi',
  'printing-payroll-summary',
  'printing-history',
  'printing-yearly-summary',
  'printing-batch-history',
  'printing-analytics'
];

function clearAllPrintClasses() {
  ALL_PRINT_CLASSES.forEach(function(cls) {
    document.body.classList.remove(cls);
  });
}

// Clean up print classes automatically when print dialog closes
window.addEventListener('afterprint', clearAllPrintClasses);

// Auto-detect active modal when user presses Ctrl+P or triggers browser print
window.addEventListener('beforeprint', function() {
  var salaryCertModal = document.getElementById('salaryCertModal');
  var payslipModal = document.getElementById('payslipModal');
  var twi50Modal = document.getElementById('twi50Modal');
  var payrollSignoffModal = document.getElementById('payrollSignoffModal');

  if (salaryCertModal && salaryCertModal.classList.contains('active')) {
    clearAllPrintClasses();
    document.body.classList.add('printing-salary-cert');
  } else if (payslipModal && payslipModal.classList.contains('active')) {
    clearAllPrintClasses();
    document.body.classList.add('printing-payslip');
  } else if (twi50Modal && twi50Modal.classList.contains('active')) {
    clearAllPrintClasses();
    document.body.classList.add('printing-50twi');
  } else if (payrollSignoffModal && payrollSignoffModal.classList.contains('active')) {
    clearAllPrintClasses();
    document.body.classList.add('printing-payroll-summary');
  }
});

// GLOBAL PERMISSIONS HELPER
function hasPermission(permKey) {
  if (!State.currentUser) return false;
  var role = State.currentUser.role ? String(State.currentUser.role).trim().toLowerCase() : '';
  var username = State.currentUser.username ? String(State.currentUser.username).trim().toLowerCase() : '';
  if (username === 'admin' || role === 'admin' || role === 'admin / hr' || role === 'super admin') return true;
  var perms = State.currentUser.permissions || [];
  if (perms.indexOf('all') >= 0) return true;
  return perms.indexOf(permKey) >= 0;
}

function isSuperAdmin() {
  if (!State.currentUser) return false;
  var u = State.currentUser.username ? String(State.currentUser.username).trim().toLowerCase() : '';
  var r = State.currentUser.role ? String(State.currentUser.role).trim().toLowerCase() : '';
  if (u === 'admin') return true;
  if (r.indexOf('super') >= 0) return true;
  if (r === 'admin / hr' || r === 'admin') return true;
  return false;
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
  var canManageCompany = hasPermission('manage_company') || hasPermission('manage_backup') || isSuperAdmin();
  var canManageUsers = hasPermission('manage_users') || isSuperAdmin();
  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();
  var canEditEmp = hasPermission('edit_emp') || isSuperAdmin();
  var canDelEmp = hasPermission('del_emp') || isSuperAdmin();
  var canEditInputs = hasPermission('edit_inputs') || isSuperAdmin();
  var canPopulateInputs = hasPermission('populate_inputs') || isSuperAdmin();
  var canCalcPayroll = hasPermission('calc_payroll') || isSuperAdmin();
  var canClosePeriod = hasPermission('close_period') || isSuperAdmin();
  var canPrintHistory = hasPermission('print_history') || isSuperAdmin();
  var canExportCsv = hasPermission('export_csv') || isSuperAdmin();
  var canViewAnalytics = hasPermission('view_analytics') || isSuperAdmin();
  var canViewAttendance = hasPermission('view_attendance') || isSuperAdmin();
  var canApproveAttendance = hasPermission('approve_attendance') || isSuperAdmin();
  var canUnlockDevice = hasPermission('unlock_device') || isSuperAdmin();
  var canSyncPtnTime = hasPermission('sync_ptn_time') || isSuperAdmin();
  var canManageAttendanceSettings = hasPermission('manage_attendance_settings') || isSuperAdmin();
  var canViewDocuments = hasPermission('view_documents') || hasPermission('all') || isSuperAdmin();
  var canIssueSalaryCert = hasPermission('issue_salary_cert') || isSuperAdmin() || hasPermission('all');
  var canExportBankFiles = hasPermission('export_bank_files') || isSuperAdmin() || hasPermission('all');
  var canExportTaxSso = hasPermission('export_tax_sso') || isSuperAdmin() || hasPermission('all');

  // 1. Navigation Tabs Visibility
  var navDash = document.getElementById('navBtn-dashboard');
  var navPayroll = document.getElementById('navBtn-payroll');
  var navInput = document.getElementById('navBtn-input');
  var navAttendance = document.getElementById('navBtn-attendance');
  var navEmp = document.getElementById('navBtn-employees');
  var navHistory = document.getElementById('navBtn-history');
  var navAnalytics = document.getElementById('navBtn-analytics');
  var navDocuments = document.getElementById('navBtn-documents');
  var navCompany = document.getElementById('navBtn-company');
  var navUsers = document.getElementById('navBtn-users');

  if (navDash) navDash.style.display = canViewDash ? 'inline-flex' : 'none';
  if (navPayroll) navPayroll.style.display = canViewPayroll ? 'inline-flex' : 'none';
  if (navInput) navInput.style.display = canViewInputs ? 'inline-flex' : 'none';
  if (navAttendance) navAttendance.style.display = canViewAttendance ? 'inline-flex' : 'none';
  if (navEmp) navEmp.style.display = canViewEmp ? 'inline-flex' : 'none';
  if (navHistory) navHistory.style.display = canViewHistory ? 'inline-flex' : 'none';
  if (navAnalytics) navAnalytics.style.display = canViewAnalytics ? 'inline-flex' : 'none';
  if (navDocuments) navDocuments.style.display = canViewDocuments ? 'inline-flex' : 'none';
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
    if (tabId === 'tab-attendance' && !canViewAttendance) allowed = false;
    if (tabId === 'tab-employees' && !canViewEmp) allowed = false;
    if (tabId === 'tab-history' && !canViewHistory) allowed = false;
    if (tabId === 'tab-analytics' && !canViewAnalytics) allowed = false;
    if (tabId === 'tab-documents' && !canViewDocuments) allowed = false;
    if (tabId === 'tab-company' && !canManageCompany) allowed = false;
    if (tabId === 'tab-users' && !canManageUsers) allowed = false;

    if (!allowed) {
      if (canViewDash) switchTab('dashboard');
      else if (canViewAttendance) switchTab('attendance');
      else if (canViewEmp) switchTab('employees');
      else if (canViewInputs) switchTab('input');
      else if (canViewPayroll) switchTab('payroll');
      else if (canViewHistory) switchTab('history');
      else if (canViewAnalytics) switchTab('analytics');
      else if (canViewDocuments) switchTab('documents');
    }
  }

  // 3. Employee Master Toolbar & Salary Inputs
  var btnAddEmp = document.querySelector('button[onclick="openAddEmployeeModal()"]');
  if (btnAddEmp) btnAddEmp.style.display = canEditEmp ? 'inline-flex' : 'none';
  var btnImportEmp = document.querySelector('button[onclick*="empCsvFileInput"]');
  if (btnImportEmp) btnImportEmp.style.display = canEditEmp ? 'inline-flex' : 'none';

  var empFinSec = document.getElementById('empModalFinancialSection');
  var miFinSec = document.getElementById('miModalFinancialSection');
  var miDailySec = document.getElementById('miModalDailyRateBlock');
  var miSsoTaxSec = document.getElementById('miModalSsoTaxSection');

  if (!canViewSalary) {
    if (empFinSec) empFinSec.style.display = 'none';
    if (miFinSec) miFinSec.style.display = 'none';
    if (miDailySec) miDailySec.style.display = 'none';
    if (miSsoTaxSec) miSsoTaxSec.style.display = 'none';
  } else {
    if (empFinSec) empFinSec.style.display = 'block';
    if (miFinSec) miFinSec.style.display = 'grid';
    if (miDailySec) miDailySec.style.display = 'flex';
    if (miSsoTaxSec) miSsoTaxSec.style.display = 'block';
  }

  // Delete employee buttons
  var btnDelEmpList = document.querySelectorAll('button[onclick*="deleteEmployee"]');
  btnDelEmpList.forEach(function(b) {
    b.style.display = canDelEmp ? 'inline-flex' : 'none';
  });

  // 4. Monthly Input Toolbar Buttons
  var btnAddInput = document.querySelector('button[onclick="openAddInputModal()"]');
  if (btnAddInput) btnAddInput.style.display = canEditInputs ? 'inline-flex' : 'none';
  var btnPopulate = document.getElementById('btnBatchPopulate') || document.querySelector('button[onclick*="batchPopulateEmployees"]');
  if (btnPopulate) btnPopulate.style.display = canPopulateInputs ? 'inline-flex' : 'none';
  var btnInputSync = document.getElementById('btnInputSyncFromPtnTime') || document.querySelector('button[onclick*="syncFromPtnTime()"]');
  if (btnInputSync) btnInputSync.style.display = canSyncPtnTime ? 'inline-flex' : 'none';

  // 5. Payroll Toolbar Buttons
  var btnCalcPayroll = document.querySelector('button[onclick="runPayrollRecalc()"]');
  if (btnCalcPayroll) btnCalcPayroll.style.display = canCalcPayroll ? 'inline-flex' : 'none';
  var btnPushSlip = document.querySelector('button[onclick*="broadcastPayslipPushNotification"]');
  if (btnPushSlip) btnPushSlip.style.display = canCalcPayroll ? 'inline-flex' : 'none';

  // 6. Period Lock Button
  var periodCloseContainer = document.getElementById('periodCloseBtnContainer');
  if (periodCloseContainer && !canClosePeriod) {
    periodCloseContainer.style.display = 'none';
  } else if (periodCloseContainer) {
    periodCloseContainer.style.display = 'inline-block';
  }

  // 6.1 Period Working Days (Only Super Admin, Admin, or calc_payroll can change)
  var canSetWorkDays = isSuperAdmin() || hasPermission('calc_payroll');
  var btnSetWorkDays = document.querySelector('button[onclick="setPeriodWorkingDays()"]');
  var btnActualWorkDays = document.querySelector('button[onclick="resetToActualWorkDays()"]');
  var inputWorkDays = document.getElementById('periodWorkingDaysInput');

  if (btnSetWorkDays) btnSetWorkDays.style.display = canSetWorkDays ? 'inline-flex' : 'none';
  if (btnActualWorkDays) btnActualWorkDays.style.display = canSetWorkDays ? 'inline-flex' : 'none';
  if (inputWorkDays) {
    inputWorkDays.readOnly = !canSetWorkDays;
    inputWorkDays.disabled = !canSetWorkDays;
    inputWorkDays.style.backgroundColor = canSetWorkDays ? '#ffffff' : '#f1f5f9';
    inputWorkDays.style.cursor = canSetWorkDays ? 'text' : 'not-allowed';
    inputWorkDays.title = canSetWorkDays ? 'ระบุจำนวนวันทำงาน' : 'สงวนสิทธิ์การแก้ไขเฉพาะ Admin / ฝ่ายคำนวณเงินเดือน';
  }

  // 7. History Print & 50 Twi Buttons
  var btnPrintActive = document.querySelector('button[onclick="printActiveHistoryReport()"]');
  if (btnPrintActive) btnPrintActive.style.display = canPrintHistory ? 'inline-flex' : 'none';
  var btnPrintBatch = document.querySelector('button[onclick="printAllEmployeesBatch()"]');
  if (btnPrintBatch) btnPrintBatch.style.display = (canPrintHistory && canViewSalary) ? 'inline-flex' : 'none';
  var btn50Twi = document.getElementById('btnHistPrint50Twi');
  if (btn50Twi) btn50Twi.style.display = canViewSalary ? 'inline-flex' : 'none';

  // 8. Export CSV Buttons
  var exportBtns = document.querySelectorAll('button[onclick*="exportToCSV"], button[onclick*="exportActiveHistoryCsv"], button[onclick*="exportAllEmployeeHistory"]');
  exportBtns.forEach(function(b) {
    b.style.display = canExportCsv ? 'inline-flex' : 'none';
  });

  // 8.1 Export Bank Files Buttons (TTB CSV & TXT Direct Credit)
  var ttbExportBtns = document.querySelectorAll('button[onclick*="exportTtbPayrollCsv"], button[onclick*="exportTtbDirectCreditTxt"]');
  ttbExportBtns.forEach(function(b) {
    b.style.display = canExportBankFiles ? 'inline-flex' : 'none';
  });

  // 9. Save & View Payslip Dual Buttons (Hide if no salary or payslip view permission)
  var canViewPayslipStrict = hasPermission('view_payslip') && hasPermission('view_salary');
  var btnInpSlip = document.getElementById('btnInputSaveAndPayslip');
  var btnEmpSlip = document.getElementById('btnEmpSaveAndPayslip');
  if (btnInpSlip) btnInpSlip.style.display = canViewPayslipStrict ? 'inline-flex' : 'none';
  if (btnEmpSlip) btnEmpSlip.style.display = canViewPayslipStrict ? 'inline-flex' : 'none';

  // 10. Time Attendance Actions
  var btnAttQr = document.getElementById('btnAttMasterQr');
  if (btnAttQr) btnAttQr.style.display = canUnlockDevice ? 'inline-flex' : 'none';
  var btnAttSync = document.getElementById('btnAttSyncPeriod');
  if (btnAttSync) btnAttSync.style.display = canSyncPtnTime ? 'inline-flex' : 'none';
  var btnAttBranches = document.getElementById('btnAttManageBranches');
  if (btnAttBranches) btnAttBranches.style.display = canManageAttendanceSettings ? 'inline-flex' : 'none';
  var cardAttSettings = document.getElementById('cardAttendanceSettings');
  if (cardAttSettings) cardAttSettings.style.display = canManageAttendanceSettings ? 'block' : 'none';

  // 11. Document Center Categories
  var btnDocCert = document.getElementById('btnDocCatCert');
  if (btnDocCert) btnDocCert.style.display = canIssueSalaryCert ? 'inline-flex' : 'none';
  var btnDocTax = document.getElementById('btnDocCatTax');
  if (btnDocTax) btnDocTax.style.display = canExportTaxSso ? 'inline-flex' : 'none';
  var btnDocSso = document.getElementById('btnDocCatSso');
  if (btnDocSso) btnDocSso.style.display = canExportTaxSso ? 'inline-flex' : 'none';
  var btnDocBank = document.getElementById('btnDocCatBank');
  if (btnDocBank) btnDocBank.style.display = canExportBankFiles ? 'inline-flex' : 'none';

  // 12. Company Settings Sections Visibility
  var cardComp = document.getElementById('cardCompanyProfile');
  if (cardComp) cardComp.style.display = (hasPermission('manage_company') || isSuperAdmin()) ? 'block' : 'none';
  var cardBkp = document.getElementById('cardBackupHub');
  if (cardBkp) cardBkp.style.display = (hasPermission('manage_backup') || isSuperAdmin()) ? 'block' : 'none';
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
  currentUser: { username: 'Admin', role: 'Admin / HR' },
  payrollDefaults: {
    defaultOtRate: 40,
    defaultWorkDays: 30,
    absentFactor: 1.5,
    leaveFactor: 1.0,
    sickLeaveQuota: 10,
    defaultPfRate: 0.05,
    defaultProbationDays: 119
  },
  annualSickMap: {}
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
  if (typeof action === 'object' && action !== null) {
    payload = action;
    action = payload.action;
  }
  payload = payload || {};
  payload.action = action;
  payload.period = payload.period || State.period;
  if (State.currentUser && State.currentUser.username) {
    if (!payload.currentUsername) payload.currentUsername = State.currentUser.username;
    if (!payload.username) payload.username = State.currentUser.username;
  }

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
  initAdminNotificationCenter();
  initDraggableAiChatBtn();
});

function navigateToAuthorizedTab() {
  var curActiveTab = document.querySelector('.tab-content.active');
  var curId = curActiveTab ? curActiveTab.id : '';

  // If on a forbidden tab or first login, switch to primary allowed tab
  var isAllowed = false;
  if (curId === 'tab-dashboard' && hasPermission('view_dash')) isAllowed = true;
  else if (curId === 'tab-attendance' && (isSuperAdmin() || hasPermission('view_attendance'))) isAllowed = true;
  else if (curId === 'tab-payroll' && hasPermission('view_payroll')) isAllowed = true;
  else if (curId === 'tab-input' && hasPermission('view_inputs')) isAllowed = true;
  else if (curId === 'tab-employees' && hasPermission('view_emp')) isAllowed = true;
  else if (curId === 'tab-history' && hasPermission('view_history')) isAllowed = true;
  else if (curId === 'tab-analytics' && (hasPermission('view_analytics') || isSuperAdmin())) isAllowed = true;
  else if (curId === 'tab-documents' && (isSuperAdmin() || hasPermission('view_documents') || hasPermission('all'))) isAllowed = true;
  else if (curId === 'tab-company' && (hasPermission('manage_company') || hasPermission('manage_backup') || isSuperAdmin())) isAllowed = true;
  else if (curId === 'tab-users' && (hasPermission('manage_users') || isSuperAdmin())) isAllowed = true;

  if (!isAllowed) {
    if (hasPermission('view_dash')) switchTab('dashboard');
    else if (hasPermission('view_attendance')) switchTab('attendance');
    else if (hasPermission('view_emp')) switchTab('employees');
    else if (hasPermission('view_inputs')) switchTab('input');
    else if (hasPermission('view_payroll')) switchTab('payroll');
    else if (hasPermission('view_history')) switchTab('history');
    else if (hasPermission('manage_company')) switchTab('company');
    else if (hasPermission('manage_users')) switchTab('users');
  }
}

function checkAuth() {
  var savedUser = localStorage.getItem('ptn_user') || sessionStorage.getItem('ptn_user');
  if (savedUser) {
    try {
      State.currentUser = JSON.parse(savedUser);
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appShell').classList.add('active');
      applyRolePermissions();
      navigateToAuthorizedTab();
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
        State.currentUser = {
          username: r.username,
          role: r.role,
          permissions: r.permissions || []
        };
        localStorage.setItem('ptn_user', JSON.stringify(State.currentUser));
        sessionStorage.setItem('ptn_user', JSON.stringify(State.currentUser));
        showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ ' + r.username);

        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appShell').classList.add('active');
        applyRolePermissions();
        navigateToAuthorizedTab();
        loadAppData();
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
  State.currentUser = null;

  // Clear login inputs
  var uInput = document.getElementById('loginUsername');
  var pInput = document.getElementById('loginPassword');
  if (uInput) uInput.value = '';
  if (pInput) pInput.value = '';

  // Reset tabs to default state
  document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.nav-tab-btn').forEach(function(el) { el.classList.remove('active'); });
  var dashTab = document.getElementById('tab-dashboard');
  var dashBtn = document.getElementById('navBtn-dashboard');
  if (dashTab) dashTab.classList.add('active');
  if (dashBtn) dashBtn.classList.add('active');

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
  // If no saved period, leave State.period empty so server returns the latest active period with data
  State.period = '';
}

function onPeriodChanged() {
  var m = document.getElementById('periodMonthSelect').value;
  var y = document.getElementById('periodYearSelect').value;
  State.period = m + ' ' + y;
  localStorage.setItem('ptn_last_period', State.period);
  loadAppData(true);
}

function setPeriodWorkingDays() {
  var canSetWorkDays = isSuperAdmin() || hasPermission('calc_payroll');
  if (!canSetWorkDays) {
    showToast('สิทธิ์ไม่เพียงพอ: การตั้งค่าวันทำงานสงวนสิทธิ์เฉพาะ Super Admin และ Admin เท่านั้น', 'warning');
    return;
  }
  var inputEl = document.getElementById('periodWorkingDaysInput');
  var days = Number(inputEl ? inputEl.value : 30) || 30;
  if (days < 1 || days > 31) {
    showToast('กรุณาระบุจำนวนวันทำงานระหว่าง 1 ถึง 31 วัน', 'error');
    return;
  }
  callApi('savePeriodWorkDays', {
    workingDays: days,
    period: State.period,
    forcePeriod: true,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      State.workingDays = days;
      showToast(r.message || ('บันทึกจำนวนวันทำงานงวด ' + (r.period || State.period) + ' เป็น ' + days + ' วัน สำเร็จ'));
      loadAppData(true);
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function resetToActualWorkDays() {
  var canSetWorkDays = isSuperAdmin() || hasPermission('calc_payroll');
  if (!canSetWorkDays) {
    showToast('สิทธิ์ไม่เพียงพอ: การตั้งค่าวันทำงานสงวนสิทธิ์เฉพาะ Super Admin และ Admin เท่านั้น', 'warning');
    return;
  }
  callApi('getActualWorkDays', { period: State.period, forcePeriod: true })
    .then(function(r) {
      if (!r.success) { showToast(r.message || 'ไม่สามารถคำนวณวันทำงานได้', 'error'); return; }
      var inputEl = document.getElementById('periodWorkingDaysInput');
      if (inputEl) inputEl.value = r.actualDays;
      State.workingDays = r.actualDays;
      showToast('คำนวณวันทำงานจริงงวด ' + r.period + ' (จ.-ส.): ' + r.actualDays + ' วัน กำลังบันทึก...');
      return callApi('savePeriodWorkDays', {
        workingDays: r.actualDays,
        period: State.period,
        forcePeriod: true,
        username: (State.currentUser && State.currentUser.username) || 'Admin'
      });
    })
    .then(function(r) {
      if (r) {
        showToast(r.message || ('บันทึกวันทำงานจริงงวด ' + (r.period || State.period) + ' เรียบร้อยแล้ว'));
        loadAppData(true);
      }
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// DATA LOADER & STATE SYNC
function loadAppData(isExplicitPeriodChange) {
  var payload = {};
  if (State.period) payload.period = State.period;
  if (isExplicitPeriodChange) payload.forcePeriod = true;
  return callApi('getAppInitialData', payload)
    .then(function(r) {
      if (!r.success) { showToast(r.message, 'error'); return; }

      // If initial load or current period has no records, but another latest period has data, auto-switch to it
      if (!isExplicitPeriodChange && (!r.inputRecords || r.inputRecords.length === 0) && r.latestActivePeriod && r.latestActivePeriod !== r.period) {
        State.period = r.latestActivePeriod;
        localStorage.setItem('ptn_last_period', State.period);
        return loadAppData(true);
      }

      State.period = r.period;
      localStorage.setItem('ptn_last_period', State.period);
      State.workingDays = r.workingDays || 30;
      State.isClosed = r.isClosed || false;
      State.closedInfo = r.closedInfo || '';
      State.company = r.settings || State.company;
      State.payrollDefaults = r.payrollDefaults || State.payrollDefaults;
      State.annualSickMap = r.annualSickMap || {};
      State.employees = r.employees || [];
      State.inputRecords = r.inputRecords || [];
      State.payrollList = r.payrollList || [];
      State.stats = r.stats || { totalEmployees: 0, totalGross: 0, totalDeductions: 0, totalNet: 0 };
      State.users = r.users || [];
      State.branches = r.branches || [];
      populateBranchSelects();

      renderAllViews();
      return r;
    })
    .catch(function(err) {
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message, 'error');
    });
}

function renderAllViews() {
  try { applyRolePermissions(); } catch(e) { console.error('applyRolePermissions error:', e); }

  // Update Period Bar
  try {
    var pill = document.getElementById('periodPillDisplay');
    if (pill) pill.textContent = State.period;
    var wInput = document.getElementById('periodWorkingDaysInput');
    if (wInput) wInput.value = State.workingDays;
    if (State.period && State.period.indexOf(' ') > 0) {
      var pParts = State.period.split(' ');
      var mSel = document.getElementById('periodMonthSelect');
      var ySel = document.getElementById('periodYearSelect');
      if (mSel && pParts[0]) mSel.value = pParts[0];
      if (ySel && pParts[1]) ySel.value = pParts[1];
    }
    var statusEl = document.getElementById('periodStatusDisplay');
    var closeBtnCont = document.getElementById('periodCloseBtnContainer');
    if (statusEl) {
      if (State.isClosed) {
        statusEl.innerHTML = '<span class="status-badge" style="background:#fef2f2;color:#dc2626;border-color:#fecaca"><i class="fa-solid fa-lock"></i> ปิดงวดแล้ว</span>';
        if (closeBtnCont) closeBtnCont.innerHTML = '<button type="button" class="btn btn-slate btn-sm" onclick="reopenPeriod()"><i class="fa-solid fa-lock-open"></i> ปลดล็อคงวด</button>';
      } else {
        statusEl.innerHTML = '<span class="status-badge"><i class="fa-solid fa-circle-check"></i> เปิดใช้งานอยู่</span>';
        if (closeBtnCont) closeBtnCont.innerHTML = '<button type="button" class="btn btn-danger btn-sm" onclick="closePeriod()"><i class="fa-solid fa-lock"></i> ปิดงวดนี้</button>';
      }
    }

    var compName = (State.company && State.company.companyName) || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
    var topBrand = document.getElementById('topBrandName');
    if (topBrand) topBrand.textContent = compName;
    var footerBrand = document.getElementById('footerBrandName');
    if (footerBrand) footerBrand.textContent = compName;
    var dashTitle = document.getElementById('dashTitle');
    if (dashTitle) dashTitle.textContent = 'แดชบอร์ดสรุปยอดเงินเดือน - ' + compName;
  } catch(e) {
    console.error('Header update error:', e);
  }

  try { renderDashboard(); } catch(e) { console.error('renderDashboard error:', e); }
  try { renderPayrollTable(); } catch(e) { console.error('renderPayrollTable error:', e); }
  try { renderInputTable(); } catch(e) { console.error('renderInputTable error:', e); }
  try { renderEmployeesTable(); } catch(e) { console.error('renderEmployeesTable error:', e); }
  try { renderHistoryTab(true); } catch(e) { console.error('renderHistoryTab error:', e); }
  try {
    if (document.getElementById('tab-analytics') && document.getElementById('tab-analytics').classList.contains('active')) {
      renderAnalyticsTab(true);
    }
  } catch(e) { console.error('renderAnalyticsTab error:', e); }
  try { renderDocumentsTab(true); } catch(e) { console.error('renderDocumentsTab error:', e); }
  try { renderCompanySettings(); } catch(e) { console.error('renderCompanySettings error:', e); }
  try { renderUsersTable(); } catch(e) { console.error('renderUsersTable error:', e); }
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
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(row.baseSalary) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + (canViewSalary ? fmt(row.grossPay) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light">' + (canViewSalary ? fmt(row.totalDeductions) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light">' + (canViewSalary ? fmt(row.netPay) : '฿***') + '</td>' +
      '<td class="text-center">' + (canViewSalary ? '<button type="button" class="btn btn-slate btn-sm" onclick="viewPayslip(\'' + esc(row.empId) + '\')"><i class="fa-solid fa-file-invoice"></i> สลิป</button>' : '<span class="text-muted" style="font-size:11px">-</span>') + '</td>' +
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
  var canViewSalary = hasPermission('view_salary');
  var canViewPayslip = hasPermission('view_payslip') && hasPermission('view_salary');

  var h = '';
  list.forEach(function(row) {
    var baseSal = Number(row.baseSalary) || 0;
    var dailyRate = workDays > 0 ? Math.round(baseSal / workDays * 100) / 100 : 0;

    h += '<tr>' +
      '<td class="font-mono font-bold">' + esc(row.empId) + '</td>' +
      '<td class="font-bold">' + esc(row.name) + '</td>' +
      '<td><span class="period-pill">' + esc(row.department || '-') + '</span> ' + esc(row.position || '') + '</td>' +
      '<td class="text-muted" style="font-size:11px">' + esc(row.bankName || '-') + '<br>' + esc(row.bankAccount || '-') + '</td>' +
      '<td class="text-right font-mono font-bold">' + (canViewSalary ? fmt(baseSal) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-blue font-bold bg-blue-light">' + (canViewSalary ? fmt(dailyRate) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (row.otHours || 0) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + (canViewSalary ? fmt(row.otPay) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + (canViewSalary ? fmt(row.allowance) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(row.bonus) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (canViewSalary ? fmt(row.leaveDeduction) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + (canViewSalary ? fmt(row.grossPay) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(row.sso) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-blue">' + (canViewSalary ? fmt(row.pf) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(row.tax) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red">' + (canViewSalary ? fmt(row.advanceDeduct) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red">' + (canViewSalary ? fmt(row.otherDeduct) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light">' + (canViewSalary ? fmt(row.totalDeductions) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light" style="font-size:13px">' + (canViewSalary ? fmt(row.netPay) : '฿***') + '</td>' +
      '<td class="text-center">' +
        (canViewPayslip ? '<button type="button" class="btn btn-primary btn-sm" onclick="viewPayslip(\'' + esc(row.empId) + '\')"><i class="fa-solid fa-print"></i> สลิป</button>' : '<span class="text-muted">-</span>') +
      '</td>' +
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
    tbody.innerHTML = '<tr><td colspan="20" class="text-center text-muted" style="padding:32px">' +
      '<div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:6px"><i class="fa-solid fa-calendar-days"></i> ' + (q ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา "' + esc(q) + '"' : 'ยังไม่มีข้อมูลในงวด ' + esc(State.period)) + '</div>' +
      '<div style="font-size:12px;color:#94a3b8">กดปุ่มสีเหลือง <strong>"👥 ดึงพนักงานทุกคนเข้างวดนี้"</strong> ด้านบนเพื่อนำเข้าข้อมูลอัตโนมัติ</div>' +
    '</td></tr>';
    updateInputBatchToolbar();
    return;
  }

  var workDays = State.workingDays > 0 ? State.workingDays : 30;
  var h = '';
  list.forEach(function(i, idx) {
    var baseSal = Number(i.baseSalary) || 0;
    var dailyRate = workDays > 0 ? Math.round(baseSal / workDays * 100) / 100 : 0;
    var pfRate = (i.pfRate !== null && i.pfRate !== undefined && !isNaN(Number(i.pfRate))) ? Number(i.pfRate) : 0;
    var pfAmt = (pfRate > 0) ? ((i.pfAmount !== undefined && i.pfAmount > 0) ? Number(i.pfAmount) : Math.round(baseSal * pfRate * 100) / 100) : 0;

    var canViewSalary = hasPermission('view_salary') || isSuperAdmin();
    var canEditInputs = hasPermission('edit_inputs') || isSuperAdmin();
    var canSyncPtnTime = hasPermission('sync_ptn_time') || isSuperAdmin();

    h += '<tr>' +
      '<td class="text-center" style="width:40px">' +
        (canEditInputs ? '<input type="checkbox" class="input-row-checkbox" value="' + esc(i.empId) + '" onchange="onInputCheckboxChanged()" style="cursor:pointer;accent-color:#e11d48;width:15px;height:15px">' : '<span class="text-muted">-</span>') +
      '</td>' +
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
        (canSyncPtnTime ? '<button type="button" class="btn-icon" style="color:#0284c7;background:#e0f2fe;border:1px solid #bae6fd;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:4px;font-weight:600" onclick="syncFromPtnTimeForEmp(\'' + esc(i.empId) + '\', \'' + esc(i.empName || '') + '\')" title="ดึงข้อมูล OT, วันลา และยอดเบิกเงินของ ' + esc(i.empName || i.empId) + ' จาก PTN Time"><i class="fa-solid fa-rotate"></i> ดึงเฉพาะคนนี้</button> ' : '') +
        (canEditInputs ?
          '<button type="button" class="btn-icon edit" onclick="openEditInputModal(\'' + esc(i.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button> ' +
          '<button type="button" class="btn-icon del" onclick="deleteInputRecord(\'' + esc(i.empId) + '\')"><i class="fa-solid fa-trash"></i> ลบ</button>' : '') +
        (!canSyncPtnTime && !canEditInputs ? '<span class="text-muted">-</span>' : '') +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
  updateInputBatchToolbar();
}

// BATCH OPERATIONS ON MONTHLY INPUTS
function toggleSelectAllInputs(master) {
  var cbs = document.querySelectorAll('.input-row-checkbox');
  cbs.forEach(function(cb) {
    cb.checked = master.checked;
  });
  updateInputBatchToolbar();
}

function onInputCheckboxChanged() {
  updateInputBatchToolbar();
}

function updateInputBatchToolbar() {
  var cbs = document.querySelectorAll('.input-row-checkbox:checked');
  var count = cbs.length;
  var bar = document.getElementById('inputBatchToolbar');
  var countDisplay = document.getElementById('inputSelectedCount');
  if (countDisplay) countDisplay.textContent = count;
  if (bar) {
    bar.style.display = count > 0 ? 'flex' : 'none';
  }
  var allCbs = document.querySelectorAll('.input-row-checkbox');
  var master = document.getElementById('inputSelectAll');
  if (master) {
    master.checked = (allCbs.length > 0 && count === allCbs.length);
  }
}

function deselectAllInputRecords() {
  var master = document.getElementById('inputSelectAll');
  if (master) master.checked = false;
  var cbs = document.querySelectorAll('.input-row-checkbox');
  cbs.forEach(function(cb) { cb.checked = false; });
  updateInputBatchToolbar();
}

function batchDeleteInputRecords() {
  if (!hasPermission('edit_inputs') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ลบข้อมูลประจำงวด', 'warning');
    return;
  }
  var cbs = document.querySelectorAll('.input-row-checkbox:checked');
  var empIds = Array.from(cbs).map(function(cb) { return cb.value; });
  if (empIds.length === 0) {
    showToast('กรุณาเลือกรายการที่ต้องการลบอย่างน้อย 1 รายการ', 'warning');
    return;
  }

  if (!confirm('ยืนยันลบข้อมูลประจำงวด ' + State.period + ' ที่เลือกทั้งหมด ' + empIds.length + ' รายการ ใช่หรือไม่? (ไม่สามารถกู้คืนได้)')) return;

  callApi('batchDeleteInputRecords', {
    empIds: empIds,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      showToast(r.message || 'ลบข้อมูลประจำงวดเรียบร้อยแล้ว');
      deselectAllInputRecords();
      loadAppData();
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบรายการ', 'error');
    });
}

// 4. HYBRID EMPLOYEE MASTER RENDERER (V6.0)
var currentEmpViewMode = 'table'; // 'table' or 'cards'
var currentEmpStatusFilter = 'all'; // 'all', 'Active', 'Probation', 'Resigned'

function switchEmpViewMode(mode) {
  currentEmpViewMode = mode;
  var btnT = document.getElementById('btnEmpViewTable');
  var btnC = document.getElementById('btnEmpViewCards');
  var tableArea = document.getElementById('empTableViewArea');
  var cardsArea = document.getElementById('empCardsViewArea');

  if (mode === 'table') {
    if (btnT) { btnT.className = 'btn btn-primary btn-sm'; }
    if (btnC) { btnC.className = 'btn btn-slate btn-sm'; }
    if (tableArea) tableArea.style.display = 'block';
    if (cardsArea) cardsArea.style.display = 'none';
  } else {
    if (btnC) { btnC.className = 'btn btn-primary btn-sm'; }
    if (btnT) { btnT.className = 'btn btn-slate btn-sm'; }
    if (tableArea) tableArea.style.display = 'none';
    if (cardsArea) cardsArea.style.display = 'grid';
  }
  renderEmployeesTable();
}

function setEmpStatusFilter(status) {
  currentEmpStatusFilter = status;
  var btns = {
    all: document.getElementById('btnEmpFilterAll'),
    Active: document.getElementById('btnEmpFilterActive'),
    Probation: document.getElementById('btnEmpFilterProbation'),
    Resigned: document.getElementById('btnEmpFilterResigned')
  };

  Object.keys(btns).forEach(function(k) {
    if (btns[k]) {
      btns[k].className = (k === status) ? 'btn btn-primary btn-sm' : 'btn btn-slate btn-sm';
    }
  });
  renderEmployeesTable();
}

function renderEmployeesTable() {
  var tbody = document.getElementById('employeesTableBody');
  var thead = document.getElementById('employeesTableHead');
  var cardsDiv = document.getElementById('empCardsViewArea');
  if (!tbody) return;

  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();
  var canEditEmp = hasPermission('edit_emp') || isSuperAdmin();
  var canDelEmp = hasPermission('del_emp') || isSuperAdmin();
  var canUnlockDevice = hasPermission('unlock_device') || isSuperAdmin();
  var isGeneralUser = !canViewSalary;

  // 1. Calculate and Update Top KPI Metrics
  var emps = State.employees || [];
  var totalEmps = emps.length;
  var activeCount = 0;
  var probCount = 0;
  var resignedCount = 0;
  var totalBaseSalary = 0;

  var deptSet = {};
  (State.employees || []).forEach(function(e) {
    var st = e.status || 'Active';
    if (st === 'Active') activeCount++;
    else if (st === 'Probation') probCount++;
    else if (st === 'Resigned') resignedCount++;
    totalBaseSalary += Number(e.baseSalary) || 0;
    if (e.department) deptSet[e.department] = true;
  });

  if (document.getElementById('empKpiTotal')) document.getElementById('empKpiTotal').innerHTML = totalEmps + ' <span style="font-size:13px;font-weight:400;color:var(--text-muted)">คน</span>';
  if (document.getElementById('empKpiActive')) document.getElementById('empKpiActive').innerHTML = activeCount + ' <span style="font-size:13px;font-weight:400;color:var(--text-muted)">คน</span>';
  if (document.getElementById('empKpiProbation')) document.getElementById('empKpiProbation').innerHTML = probCount + ' <span style="font-size:13px;font-weight:400;color:var(--text-muted)">คน</span>';
  if (document.getElementById('empKpiTotalSalary')) {
    document.getElementById('empKpiTotalSalary').textContent = canViewSalary ? fmt(totalBaseSalary) : '฿***';
  }

  // Update filter pill counts
  if (document.getElementById('countFilterAll')) document.getElementById('countFilterAll').textContent = totalEmps;
  if (document.getElementById('countFilterActive')) document.getElementById('countFilterActive').textContent = activeCount;
  if (document.getElementById('countFilterProbation')) document.getElementById('countFilterProbation').textContent = probCount;
  if (document.getElementById('countFilterResigned')) document.getElementById('countFilterResigned').textContent = resignedCount;

  // Populate department filter dropdown
  var deptSel = document.getElementById('empDeptFilter');
  if (deptSel && (!deptSel.options || deptSel.options.length <= 1)) {
    var curVal = deptSel.value;
    var dOpts = '<option value="">ทุกแผนก</option>';
    Object.keys(deptSet).sort().forEach(function(d) {
      dOpts += '<option value="' + esc(d) + '">' + esc(d) + '</option>';
    });
    deptSel.innerHTML = dOpts;
    deptSel.value = curVal;
  }

  // Populate employee select dropdowns for inputs and history
  var sel = '<option value="">-- เลือกรหัสพนักงาน --</option>';
  (State.employees || []).forEach(function(e) {
    var nickDisplay = e.nickname ? ' (' + e.nickname + ')' : '';
    var empPf = (e.pfRate !== null && e.pfRate !== undefined && !isNaN(Number(e.pfRate))) ? Number(e.pfRate) : 0;
    var empSso = (e.defaultSso !== null && e.defaultSso !== undefined && !isNaN(Number(e.defaultSso))) ? Number(e.defaultSso) : 0;
    sel += '<option value="' + e.empId + '" data-name="' + esc(e.fullName) + '" data-salary="' + e.baseSalary + '" data-pf="' + empPf + '" data-sso="' + empSso + '" data-tax="' + (e.defaultTax || 0) + '" data-remark="' + esc(e.remark || '') + '">' + esc(e.empId) + ' - ' + esc(e.fullName) + nickDisplay + '</option>';
  });
  var miSel = document.getElementById('miEmpId');
  if (miSel) miSel.innerHTML = sel;
  var histSel = document.getElementById('histEmpSelect');
  if (histSel) histSel.innerHTML = sel;

  // Filter list by status, department, and search query
  var q = (document.getElementById('empSearchInput') ? document.getElementById('empSearchInput').value : '').trim().toLowerCase();
  var selectedDept = deptSel ? deptSel.value : '';

  var list = emps.filter(function(e) {
    var st = e.status || 'Active';
    if (currentEmpStatusFilter !== 'all' && st !== currentEmpStatusFilter) return false;
    if (selectedDept && e.department !== selectedDept) return false;
    if (!q) return true;
    return (e.empId && e.empId.toLowerCase().indexOf(q) >= 0) ||
           (e.fullName && e.fullName.toLowerCase().indexOf(q) >= 0) ||
           (e.nickname && e.nickname.toLowerCase().indexOf(q) >= 0) ||
           (e.phone && e.phone.toLowerCase().indexOf(q) >= 0) ||
           (e.department && e.department.toLowerCase().indexOf(q) >= 0) ||
           (e.position && e.position.toLowerCase().indexOf(q) >= 0);
  });

  // Adjust table header based on role
  if (thead) {
    if (isGeneralUser || !canViewSalary) {
      thead.innerHTML = '<tr>' +
        '<th style="width:85px">รหัส</th>' +
        '<th>พนักงาน</th>' +
        '<th>แผนก / ตำแหน่ง</th>' +
        '<th class="text-center" style="width:130px">สถานะ</th>' +
        '<th>วันเกิด / อายุ</th>' +
        '<th>เบอร์โทรศัพท์</th>' +
        '<th>ธนาคาร / เลขบัญชี</th>' +
        '<th>วันเริ่มงาน</th>' +
        '<th class="text-center" style="width:90px">จัดการ</th>' +
      '</tr>';
    } else {
      thead.innerHTML = '<tr>' +
        '<th style="width:85px">รหัส</th>' +
        '<th>พนักงาน</th>' +
        '<th>แผนก / ตำแหน่ง</th>' +
        '<th class="text-center" style="width:130px">สถานะ</th>' +
        '<th class="text-right" style="width:105px">เงินเดือนฐาน</th>' +
        '<th class="text-right" style="width:65px">PF %</th>' +
        '<th class="text-right text-red font-bold" style="width:95px">SSO</th>' +
        '<th>ธนาคาร / เลขบัญชี</th>' +
        '<th>วันเริ่มงาน</th>' +
        '<th class="text-center" style="width:125px">จัดการ</th>' +
      '</tr>';
    }
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + ((isGeneralUser || !canViewSalary) ? '9' : '10') + '" class="text-center text-muted" style="padding:32px">' + (q ? 'ไม่พบพนักงานที่ตรงกับคำค้นหา "' + esc(q) + '"' : 'ไม่มีรายการพนักงานในหมวดนี้') + '</td></tr>';
    if (cardsDiv) cardsDiv.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-muted);font-size:13px"><i class="fa-solid fa-users-slash" style="font-size:24px;margin-bottom:8px;display:block"></i>ไม่พบข้อมูลพนักงาน</div>';
    return;
  }

  var hTable = '';
  var hCards = '';

  list.forEach(function(e) {
    var birthText = e.birthDate ? (e.birthDate + (e.age ? ' (' + e.age + ' ปี)' : '')) : (e.age ? (e.age + ' ปี') : '-');
    var initials = (e.fullName || '').substring(0, 2);

    // Status Badge
    var st = e.status || 'Active';
    var stBadge = '<span class="period-pill" style="background:#dcfce7;color:#15803d;border-color:#bbf7d0;font-size:11px">🟢 ทำงานอยู่</span>';
    if (st === 'Probation') {
      var daysLeft = getProbationDaysRemaining(e);
      var probText = daysLeft !== null ? ('ทดลองงาน (' + (daysLeft > 0 ? ('เหลือ ' + daysLeft + ' วัน') : 'ครบกำหนด') + ')') : 'ทดลองงาน';
      var probBg = daysLeft !== null && daysLeft <= 15 ? '#fee2e2' : '#ffedd5';
      var probCol = daysLeft !== null && daysLeft <= 15 ? '#b91c1c' : '#c2410c';
      var probBrd = daysLeft !== null && daysLeft <= 15 ? '#fecaca' : '#fed7aa';
      stBadge = '<span class="period-pill" style="background:' + probBg + ';color:' + probCol + ';border-color:' + probBrd + ';font-size:11px;font-weight:700">🟠 ' + esc(probText) + '</span>';
    } else if (st === 'Resigned') {
      stBadge = '<span class="period-pill" style="background:#fee2e2;color:#b91c1c;border-color:#fecaca;font-size:11px">🔴 ลาออกแล้ว</span>';
    } else if (st === 'Suspended') {
      stBadge = '<span class="period-pill" style="background:#fef3c7;color:#b45309;border-color:#fde68a;font-size:11px">🟡 พักงาน</span>';
    }

    // Bank Badge & Color
    var bName = e.bankName || 'กสิกรไทย';
    var bankPill = '<span class="period-pill" style="font-size:10.5px">' + esc(bName) + '</span>';
    if (bName.indexOf('กสิกร') >= 0) bankPill = '<span class="period-pill" style="background:#ecfdf5;color:#059669;border-color:#a7f3d0;font-size:10.5px">KBANK</span>';
    else if (bName.indexOf('ไทยพาณิชย์') >= 0) bankPill = '<span class="period-pill" style="background:#f5f3ff;color:#7c3aed;border-color:#ddd6fe;font-size:10.5px">SCB</span>';
    else if (bName.indexOf('กรุงเทพ') >= 0) bankPill = '<span class="period-pill" style="background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;font-size:10.5px">BBL</span>';
    else if (bName.indexOf('ทหารไทย') >= 0 || bName.indexOf('TTB') >= 0) bankPill = '<span class="period-pill" style="background:#fff7ed;color:#c2410c;border-color:#fed7aa;font-size:10.5px">TTB</span>';

    // Device Lock Badge & Button (PTN Time Integration)
    var devBadge = e.isDeviceBound ? (' <span class="period-pill" style="background:#eff6ff;color:#0284c7;border-color:#bae6fd;font-size:10px;padding:1px 6px" title="ผูกเครื่องแล้ว: ' + esc((e.boundDevice && e.boundDevice.deviceName) || 'Mobile Web') + '">📱 ผูกเครื่อง</span>') : '';
    var devUnlockBtn = (e.isDeviceBound && canUnlockDevice) ? ('<button type="button" class="btn-icon" style="background:#fef2f2;color:#dc2626;border-color:#fecaca;font-weight:700" onclick="remoteResetDevice(\'' + esc(e.empId) + '\')" title="ปลดล็อกเครื่องในระบบ PTN Time"><i class="fa-solid fa-unlock"></i> ปลดเครื่อง</button> ') : '';

    // Avatar HTML for Table & Card
    var avatarTableHtml = e.photoUrl
      ? ('<img src="' + esc(e.photoUrl) + '" alt="' + esc(e.fullName) + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid #cbd5e1;background:#f1f5f9" onerror="this.onerror=null;this.outerHTML=\'<div style=\\\'width:28px;height:28px;border-radius:50%;background:#e0e7ff;color:#3730a3;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0\\\'>' + esc(initials) + '</div>\'">')
      : ('<div style="width:28px;height:28px;border-radius:50%;background:#e0e7ff;color:#3730a3;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + esc(initials) + '</div>');

    var avatarCardHtml = e.photoUrl
      ? ('<img src="' + esc(e.photoUrl) + '" alt="' + esc(e.fullName) + '" style="width:42px;height:42px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1.5px solid #cbd5e1;box-shadow:0 2px 4px rgba(0,0,0,0.1);background:#f1f5f9" onerror="this.onerror=null;this.outerHTML=\'<div style=\\\'width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg, #2563eb, #4f46e5);color:#ffffff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 6px -1px rgba(37,99,235,0.25)\\\'>' + esc(initials) + '</div>\'">')
      : ('<div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg, #2563eb, #4f46e5);color:#ffffff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 6px -1px rgba(37,99,235,0.25)">' + esc(initials) + '</div>');

    var branchObj = (State.branches || []).find(function(b) { return b.branch_id === e.branchId; });
    var branchNameDisplay = branchObj ? branchObj.branch_name : (e.branchId === 'B02' ? 'สาขา 2' : (e.branchId === 'B03' ? 'สาขา 3' : (e.branchId === 'B04' ? 'สาขา 4' : 'สำนักงานใหญ่')));
    var roamingText = e.allowAllBranches ? ' <span style="color:#0284c7;font-size:10px;font-weight:700" title="ลงเวลาได้ทุกสาขา">(ทุกสาขา)</span>' : '';
    var branchBadgeHtml = '<div style="font-size:11px;color:#0369a1;font-weight:600;margin-top:2px"><i class="fa-solid fa-store" style="font-size:10px;margin-right:2px"></i> ' + esc(branchNameDisplay) + roamingText + '</div>';

    // 1. Render Table Row
    if (isGeneralUser || !canViewSalary) {
      hTable += '<tr>' +
        '<td class="font-mono font-bold text-blue">' + esc(e.empId) + '</td>' +
        '<td>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            avatarTableHtml +
            '<div>' +
              '<div style="font-weight:700;color:var(--text-main)">' + esc(e.fullName) + ' ' + (e.nickname ? ('<span class="period-pill" style="background:#f1f5f9;color:#2563eb;font-size:10px;padding:1px 6px">' + esc(e.nickname) + '</span>') : '') + devBadge + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);font-family:monospace">' + esc(e.phone || '-') + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><span class="period-pill">' + esc(e.department || '-') + '</span><div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + esc(e.position || '-') + '</div>' + branchBadgeHtml + '</td>' +
        '<td class="text-center">' + stBadge + '</td>' +
        '<td>' + esc(birthText) + '</td>' +
        '<td class="font-mono">' + esc(e.phone || '-') + '</td>' +
        '<td>' + bankPill + '<div class="font-mono" style="font-size:11px;color:var(--text-muted);margin-top:2px">' + esc(e.bankAccount || '-') + '</div></td>' +
        '<td>' + esc(e.joinDate || '-') + '</td>' +
        '<td class="text-center nowrap">' +
          devUnlockBtn +
          (canEditEmp ? '<button type="button" class="btn-icon edit" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button>' : '<span class="text-muted">-</span>') +
        '</td>' +
      '</tr>';
    } else {
      hTable += '<tr>' +
        '<td class="font-mono font-bold text-blue">' + esc(e.empId) + '</td>' +
        '<td>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            avatarTableHtml +
            '<div>' +
              '<div style="font-weight:700;color:var(--text-main)">' + esc(e.fullName) + ' ' + (e.nickname ? ('<span class="period-pill" style="background:#f1f5f9;color:#2563eb;font-size:10px;padding:1px 6px">' + esc(e.nickname) + '</span>') : '') + devBadge + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);font-family:monospace">' + esc(e.phone || '-') + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><span class="period-pill">' + esc(e.department || '-') + '</span><div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + esc(e.position || '-') + '</div>' + branchBadgeHtml + '</td>' +
        '<td class="text-center">' + stBadge + '</td>' +
        '<td class="text-right font-mono font-bold">' + fmt(e.baseSalary) + '</td>' +
        '<td class="text-right font-mono">' + (Number(e.pfRate) > 0 ? (((Number(e.pfRate) * 100).toFixed(0)) + '%') : '<span class="text-muted" style="font-size:11px">0%</span>') + '</td>' +
        '<td class="text-right font-mono text-red font-bold">' + (Number(e.defaultSso) > 0 ? fmt(e.defaultSso) : '<span class="text-muted" style="font-size:11px">฿0</span>') + '</td>' +
        '<td>' + bankPill + '<div class="font-mono font-bold text-blue" style="font-size:11px;margin-top:2px">' + esc(e.bankAccount || '-') + '</div></td>' +
        '<td>' + esc(e.joinDate || '-') + '</td>' +
        '<td class="text-center nowrap">' +
          devUnlockBtn +
          (st === 'Probation' ? '<button type="button" class="btn-icon edit" style="background:#ecfdf5;color:#059669;border-color:#a7f3d0;font-weight:700" onclick="passProbation(\'' + esc(e.empId) + '\')" title="อนุมัติผ่านโปร"><i class="fa-solid fa-check"></i> ผ่านโปร</button> ' : '') +
          (canEditEmp ? '<button type="button" class="btn-icon edit" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button> ' : '') +
          (canDelEmp ? '<button type="button" class="btn-icon del" onclick="deleteEmployee(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-trash"></i> ลบ</button>' : '') +
          (!canEditEmp && !canDelEmp && !e.isDeviceBound ? '<span class="text-muted">-</span>' : '') +
        '</td>' +
      '</tr>';
    }

    // 2. Render Profile Card
    hCards += '<div style="background:#ffffff;border:1.5px solid #e2e8f0;border-radius:var(--radius-lg);padding:16px;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:12px;transition:all 0.2s ease" class="emp-profile-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          avatarCardHtml +
          '<div>' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<span style="font-family:monospace;font-size:12px;font-weight:700;color:#2563eb">' + esc(e.empId) + '</span>' +
              (e.nickname ? ('<span class="period-pill" style="background:#eff6ff;color:#1d4ed8;font-size:10px;padding:1px 6px">ชื่อเล่น: ' + esc(e.nickname) + '</span>') : '') +
              devBadge +
            '</div>' +
            '<div style="font-weight:700;font-size:13.5px;color:var(--text-main);margin-top:2px">' + esc(e.fullName) + '</div>' +
            branchBadgeHtml +
          '</div>' +
        '</div>' +
        stBadge +
      '</div>' +

      '<div style="background:#f8fafc;border-radius:var(--radius-md);padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11.5px">' +
        '<div>' +
          '<span style="color:#64748b;font-size:10.5px;display:block">แผนก / ตำแหน่ง</span>' +
          '<span style="font-weight:700;color:#0f172a">' + esc(e.department || '-') + '</span>' +
          '<span style="color:#64748b;display:block;font-size:10.5px">' + esc(e.position || '-') + '</span>' +
        '</div>' +
        '<div>' +
          '<span style="color:#64748b;font-size:10.5px;display:block">เงินเดือนฐาน &amp; PF</span>' +
          '<span style="font-weight:800;color:#1d4ed8">' + (canViewSalary ? fmt(e.baseSalary) : '฿***') + '</span>' +
          '<span style="color:#64748b;display:block;font-size:10.5px">PF: ' + (Number(e.pfRate) > 0 ? (((Number(e.pfRate) * 100).toFixed(0)) + '%') : '0%') + '</span>' +
        '</div>' +
      '</div>' +

      '<div style="font-size:11px;color:#64748b;padding-top:4px;border-top:1px dashed #e2e8f0;display:flex;flex-direction:column;gap:4px">' +
        '<div style="display:flex;justify-content:space-between">' +
          '<span><i class="fa-solid fa-phone" style="color:#94a3b8;margin-right:4px"></i> ' + esc(e.phone || '-') + '</span>' +
          '<span><i class="fa-solid fa-calendar-check" style="color:#94a3b8;margin-right:4px"></i> เริ่มงาน: ' + esc(e.joinDate || '-') + '</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span><i class="fa-solid fa-building-columns" style="color:#94a3b8;margin-right:4px"></i> ' + esc(e.bankName || '-') + '</span>' +
          '<span class="font-mono font-bold" style="color:#1e40af">' + esc(e.bankAccount || '-') + '</span>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;align-items:center;gap:6px;padding-top:6px">' +
        ((e.isDeviceBound && canUnlockDevice) ? '<button type="button" class="btn btn-slate btn-sm" style="color:#dc2626;border-color:#fecaca;background:#fef2f2;font-weight:700" onclick="remoteResetDevice(\'' + esc(e.empId) + '\')" title="ปลดล็อกเครื่องในระบบ PTN Time"><i class="fa-solid fa-unlock"></i> ปลดเครื่อง</button>' : '') +
        (st === 'Probation' ? '<button type="button" class="btn btn-success btn-sm" style="flex:1" onclick="passProbation(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-check"></i> ผ่านโปร</button>' : '') +
        (canEditEmp ? '<button type="button" class="btn btn-slate btn-sm" style="flex:1" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไขประวัติ</button>' : '') +
        (canDelEmp ? '<button type="button" class="btn btn-slate btn-sm" style="color:#dc2626;padding:4px 8px" onclick="deleteEmployee(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-trash"></i></button>' : '') +
      '</div>' +
    '</div>';
  });

  tbody.innerHTML = hTable;
  if (cardsDiv) cardsDiv.innerHTML = hCards;
}

// REMOTE RESET DEVICE (Method 3: Remote Reset from Payroll)
function remoteResetDevice(empId, empName) {
  if (!hasPermission('unlock_device') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ปลดล็อคเครื่องพนักงาน', 'warning');
    return;
  }
  if (!empName) {
    var foundEmp = (State.employees || []).find(function(x) { return x.empId === empId; });
    empName = foundEmp ? foundEmp.fullName : empId;
  }

  function executeReset() {
    callApi('resetEmployeeDevice', {
      empId: empId,
      username: State.currentUser ? State.currentUser.username : 'Admin'
    }).then(function(data) {
      if (data && data.success) {
        showToast(data.message || 'ปลดล็อกเครื่องสำเร็จแล้ว', 'success');
        // Update local state
        var found = (State.employees || []).find(function(x) { return x.empId === empId; });
        if (found) {
          found.isDeviceBound = false;
          found.boundDevice = null;
        }
        renderEmployeesTable();
      } else {
        showToast((data && data.message) || 'ปลดล็อกไม่สำเร็จ', 'error');
      }
    }).catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
  }

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'ปลดล็อกเครื่องพนักงาน?',
      html: '<div style="font-size:13px;text-align:left;color:#475569;line-height:1.6">' +
        '<p>ต้องการปลดล็อกอุปกรณ์ประจำตัวของ <b>[' + esc(empId) + '] ' + esc(empName) + '</b> ใช่หรือไม่?</p>' +
        '<p style="margin-top:10px;font-size:12px;color:#0369a1;background:#f0f9ff;border:1px solid #bae6fd;padding:10px;border-radius:8px">💡 <b>ผลลัพธ์:</b> เมื่อปลดล็อกแล้ว พนักงานจะสามารถเลือกหรือผูกเข้ากับโทรศัพท์เครื่องใหม่ในระบบ PTN Time ได้ทันที</p>' +
        '</div>',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '<i class="fa-solid fa-unlock"></i> ใช่, ปลดล็อกทันที',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626'
    }).then(function(res) {
      if (res && res.isConfirmed) {
        executeReset();
      }
    });
  } else {
    var confirmed = confirm('ต้องการปลดล็อกอุปกรณ์ประจำตัวของ [' + empId + '] ' + empName + ' ใช่หรือไม่?\n\nเมื่อปลดล็อกแล้ว พนักงานจะสามารถเลือกหรือผูกเข้ากับโทรศัพท์เครื่องใหม่ในระบบ PTN Time ได้ทันที');
    if (confirmed) {
      executeReset();
    }
  }
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
    (State.employees || []).forEach(function(e) {
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
  var canViewSalary = hasPermission('view_salary');
  var gt = currentGrandTotalData || {};
  if (document.getElementById('statYearlyEmps')) document.getElementById('statYearlyEmps').textContent = (gt.activeEmployees || 0) + ' / ' + (gt.totalEmployees || 0) + ' คน';
  if (document.getElementById('statYearlyGross')) document.getElementById('statYearlyGross').textContent = canViewSalary ? fmt(gt.totalGrossPay || 0) : '฿***';
  if (document.getElementById('statYearlyDeductions')) document.getElementById('statYearlyDeductions').textContent = canViewSalary ? fmt(gt.totalDeductions || 0) : '฿***';
  if (document.getElementById('statYearlyNet')) document.getElementById('statYearlyNet').textContent = canViewSalary ? fmt(gt.totalNetPay || 0) : '฿***';

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
    var canViewSalary = hasPermission('view_salary');

    h += '<tr>' +
      '<td class="text-center font-mono">' + (idx + 1) + '</td>' +
      '<td class="font-mono font-bold">' + esc(r.empId) + '</td>' +
      '<td class="font-bold">' + esc(r.fullName) + nick + '</td>' +
      '<td>' + esc(r.department || '-') + '</td>' +
      '<td class="text-center font-mono font-bold" style="color:#2563eb">' + (r.totalPeriods || 0) + ' งวด</td>' +
      '<td class="text-right font-mono font-bold" style="color:#1e3a8a">' + (canViewSalary ? fmt(r.baseSalaryLatest) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (r.totalAbsentDays || 0) + '</td>' +
      '<td class="text-right font-mono">' + (r.totalLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + (r.totalSickLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + (canViewSalary ? fmt(r.totalLateDeduct || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + (canViewSalary ? fmt(r.totalOtPay || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + (canViewSalary ? fmt(r.totalAllowance || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(r.totalBonus || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + (canViewSalary ? fmt(r.totalGrossPay || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (canViewSalary ? fmt(r.totalSso || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + (canViewSalary ? fmt(r.totalPf || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(r.totalTax || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red font-bold bg-red-light">' + (canViewSalary ? fmt(r.totalDeductions || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light">' + (canViewSalary ? fmt(r.totalNetPay || 0) : '฿***') + '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;

  // Render Grand Total row in tfoot
  if (tfoot) {
    var canViewSalary = hasPermission('view_salary');
    tfoot.innerHTML = '<tr style="background:#f1f5f9;font-weight:700;font-size:12px;border-top:2px solid #94a3b8">' +
      '<td colspan="4" class="text-center font-bold" style="color:#0f172a;font-size:12.5px">รวมยอดทั้งบริษัท (' + list.length + ' คน)</td>' +
      '<td class="text-center font-mono font-bold" style="color:#2563eb">-</td>' +
      '<td class="text-right font-mono font-bold" style="color:#1e3a8a">-</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (gt.totalAbsentDays || 0) + '</td>' +
      '<td class="text-right font-mono">' + (gt.totalLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + (gt.totalSickLeaveDays || 0) + '</td>' +
      '<td class="text-right font-mono text-red">' + (canViewSalary ? fmt(gt.totalLateDeduct || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + (canViewSalary ? fmt(gt.totalOtPay || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + (canViewSalary ? fmt(gt.totalAllowance || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(gt.totalBonus || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light" style="font-size:13px">' + (canViewSalary ? fmt(gt.totalGrossPay || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (canViewSalary ? fmt(gt.totalSso || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + (canViewSalary ? fmt(gt.totalPf || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(gt.totalTax || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red font-bold bg-red-light" style="font-size:13px">' + (canViewSalary ? fmt(gt.totalDeductions || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light" style="font-size:14px;color:#15803d">' + (canViewSalary ? fmt(gt.totalNetPay || 0) : '฿***') + '</td>' +
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

      var initials = (emp.fullName || '').substring(0, 2);
      var histAvatarEl = document.getElementById('histEmpAvatarInitials');
      if (histAvatarEl) {
        if (emp.photoUrl) {
          histAvatarEl.innerHTML = '<img src="' + esc(emp.photoUrl) + '" alt="' + esc(emp.fullName) + '" style="width:100%;height:100%;border-radius:16px;object-fit:cover">';
        } else {
          histAvatarEl.textContent = initials || '-';
        }
      }
      if (document.getElementById('histEmpIdBadge')) document.getElementById('histEmpIdBadge').textContent = emp.empId || 'EMP---';
      if (document.getElementById('histEmpNicknameBadge')) document.getElementById('histEmpNicknameBadge').textContent = 'ชื่อเล่น: ' + (emp.nickname || '-');
      
      var st = emp.status || 'Active';
      var stBadgeEl = document.getElementById('histEmpStatusBadge');
      if (stBadgeEl) {
        if (st === 'Active') {
          stBadgeEl.textContent = '🟢 พนักงานประจำ';
          stBadgeEl.style.background = '#059669';
        } else if (st === 'Probation') {
          stBadgeEl.textContent = '🟠 ทดลองงาน';
          stBadgeEl.style.background = '#ea580c';
        } else if (st === 'Resigned') {
          stBadgeEl.textContent = '🔴 ลาออกแล้ว';
          stBadgeEl.style.background = '#dc2626';
        } else {
          stBadgeEl.textContent = '🟡 ' + st;
          stBadgeEl.style.background = '#d97706';
        }
      }

      if (document.getElementById('histEmpCardName')) document.getElementById('histEmpCardName').textContent = emp.fullName + (emp.nickname ? ' (' + emp.nickname + ')' : '') + ' [' + (emp.empId || '') + ']';
      if (document.getElementById('histEmpCardDept')) document.getElementById('histEmpCardDept').innerHTML = '<i class="fa-solid fa-briefcase" style="color:#94a3b8;margin-right:4px"></i> ' + esc(emp.department || '-') + ' / ' + esc(emp.position || '-');
      if (document.getElementById('histEmpTenureText')) document.getElementById('histEmpTenureText').innerHTML = '<i class="fa-solid fa-calendar-check" style="color:#94a3b8;margin-right:4px"></i> เริ่มงาน: ' + esc(emp.joinDate || '-');
      if (document.getElementById('histEmpCardCitizen')) document.getElementById('histEmpCardCitizen').textContent = emp.citizenId || '-';
      if (document.getElementById('histEmpCardPhone')) document.getElementById('histEmpCardPhone').textContent = emp.phone || '-';
      if (document.getElementById('histEmpCardBank')) document.getElementById('histEmpCardBank').textContent = emp.bankName || '-';
      if (document.getElementById('histEmpCardAccount')) document.getElementById('histEmpCardAccount').textContent = emp.bankAccount || '-';

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

    var canViewSalary = hasPermission('view_salary');
    var canViewPayslip = hasPermission('view_payslip');
    var slipBtn = (canViewSalary && canViewPayslip) ? ('<button type="button" class="btn btn-primary btn-sm" style="padding:2px 8px;font-size:11px" onclick="viewPayslip(\'' + esc(r.empId || '') + '\', \'' + esc(r.period || '') + '\')"><i class="fa-solid fa-file-invoice-dollar"></i> สลิป</button>') : '<span class="text-muted">-</span>';

    h += '<tr>' +
      '<td class="font-bold font-mono">' + esc(r.period) + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(base) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red">' + abs + '</td>' +
      '<td class="text-right font-mono">' + lev + '</td>' +
      '<td class="text-right font-mono text-red">' + sck + '</td>' +
      '<td class="text-right font-mono text-red">' + (canViewSalary ? fmt(late) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + otH + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + (canViewSalary ? fmt(otP) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + (canViewSalary ? fmt(allow) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(bon) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red">' + (canViewSalary ? fmt(lDed) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + (canViewSalary ? fmt(grs) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-red">' + (canViewSalary ? fmt(ssoVal) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + (canViewSalary ? fmt(pfVal) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(taxVal) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light">' + (canViewSalary ? fmt(totDed) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light">' + (canViewSalary ? fmt(net) : '฿***') + '</td>' +
      '<td class="text-center no-print-col">' + slipBtn + '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;

  // Update YTD Top Square KPI Tiles
  var canViewSalary = hasPermission('view_salary');
  if (document.getElementById('histYtdGross')) document.getElementById('histYtdGross').textContent = canViewSalary ? fmt(sumGross) : '฿***';
  if (document.getElementById('histYtdPf')) document.getElementById('histYtdPf').textContent = canViewSalary ? fmt(sumPf) : '฿***';
  if (document.getElementById('histYtdAttendance')) document.getElementById('histYtdAttendance').textContent = 'ขาด ' + sumAbsent + ' | ลา ' + (sumLeave + sumSick) + ' | OT ' + sumOtHours + ' ชม.';
  if (document.getElementById('histYtdNet')) document.getElementById('histYtdNet').textContent = canViewSalary ? fmt(sumNet) : '฿***';

  // Individual Annual Total Row in tfoot
  if (tfoot) {
    tfoot.innerHTML = '<tr style="background:#eff6ff;font-weight:700;font-size:12px;border-top:2px solid #60a5fa">' +
      '<td class="font-bold" style="color:#1e40af">รวมสะสม (' + list.length + ' งวด)</td>' +
      '<td class="text-right font-mono font-bold" style="color:#1e3a8a">' + (canViewSalary ? fmt(sumBase) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + sumAbsent + '</td>' +
      '<td class="text-right font-mono">' + sumLeave + '</td>' +
      '<td class="text-right font-mono text-red">' + sumSick + '</td>' +
      '<td class="text-right font-mono text-red">' + (canViewSalary ? fmt(sumLate) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + sumOtHours + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + (canViewSalary ? fmt(sumOtPay) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + (canViewSalary ? fmt(sumAllowance) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(sumBonus) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red">' + (canViewSalary ? fmt(sumLeaveDed) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light" style="font-size:13px">' + (canViewSalary ? fmt(sumGross) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-red">' + (canViewSalary ? fmt(sumSso) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + (canViewSalary ? fmt(sumPf) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(sumTax) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light" style="font-size:13px">' + (canViewSalary ? fmt(sumDed) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light" style="font-size:14px;color:#15803d">' + (canViewSalary ? fmt(sumNet) : '฿***') + '</td>' +
      '<td class="text-center no-print-col">-</td>' +
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
  var yrSel = document.getElementById('histYearSelect');
  var yr = yrSel ? yrSel.value : 'ALL';
  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด (PTN PHARMA CENTER CO., LTD.)';
  var compTax = State.company.taxId || '0105559876543';
  var count = currentYearlySummaryData ? currentYearlySummaryData.length : 0;

  var d = new Date();
  var thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var dateStr = d.getDate() + ' ' + thaiMonths[d.getMonth()] + ' ' + (d.getFullYear() + 543) + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ' น.';

  if (document.getElementById('yearlyPrintCompName')) document.getElementById('yearlyPrintCompName').textContent = compName;
  if (document.getElementById('yearlyPrintTaxId')) document.getElementById('yearlyPrintTaxId').textContent = compTax;
  if (document.getElementById('yearlyPrintYearDisplay')) document.getElementById('yearlyPrintYearDisplay').textContent = yr === 'ALL' ? 'ทั้งหมดทุกปี' : yr;
  if (document.getElementById('yearlyPrintEmpCount')) document.getElementById('yearlyPrintEmpCount').textContent = count + ' คน';
  if (document.getElementById('yearlyPrintDate')) document.getElementById('yearlyPrintDate').textContent = dateStr;

  clearAllPrintClasses();
  document.body.classList.add('printing-yearly-summary');

  setTimeout(function() {
    window.print();
    setTimeout(clearAllPrintClasses, 1500);
  }, 50);
}

function printHistoryReport() {
  var area = document.getElementById('histContentArea');
  var sel = document.getElementById('histEmpSelect');
  var empId = sel ? sel.value : '';
  if (!area || area.style.display === 'none' || !empId) {
    showToast('กรุณาเลือกพนักงานก่อนพิมพ์รายงานประวัติ', 'warning');
    return;
  }

  var yrSel = document.getElementById('histYearSelect');
  var yr = yrSel ? yrSel.value : 'ALL';
  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด (PTN PHARMA CENTER CO., LTD.)';
  var compTax = State.company.taxId || '0105559876543';

  var curEmp = (State.employees || []).find(function(e) { return e.empId === empId; }) || {};
  var empSummary = (curEmp.empId || empId) + ' - ' + (curEmp.fullName || '') + (curEmp.nickname ? ' (' + curEmp.nickname + ')' : '') + ' | แผนก: ' + (curEmp.department || '-') + ' / ' + (curEmp.position || '-');

  var d = new Date();
  var thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var dateStr = d.getDate() + ' ' + thaiMonths[d.getMonth()] + ' ' + (d.getFullYear() + 543) + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ' น.';

  if (document.getElementById('indivPrintCompName')) document.getElementById('indivPrintCompName').textContent = compName;
  if (document.getElementById('indivPrintTaxId')) document.getElementById('indivPrintTaxId').textContent = compTax;
  if (document.getElementById('indivPrintYearDisplay')) document.getElementById('indivPrintYearDisplay').textContent = yr === 'ALL' ? 'ทั้งหมดทุกปี' : yr;
  if (document.getElementById('indivPrintEmpSummary')) document.getElementById('indivPrintEmpSummary').textContent = empSummary;
  if (document.getElementById('indivPrintDate')) document.getElementById('indivPrintDate').textContent = dateStr;

  clearAllPrintClasses();
  document.body.classList.add('printing-history');

  setTimeout(function() {
    window.print();
    setTimeout(clearAllPrintClasses, 1500);
  }, 50);
}

function exportActiveHistoryCsv() {
  if (!hasPermission('view_salary')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกข้อมูลเงินเดือน', 'warning');
    return;
  }
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
  if (document.getElementById('cfgCompanyBranch')) document.getElementById('cfgCompanyBranch').value = State.company.companyBranch || '00000';
  if (document.getElementById('cfgEmployerSsoId')) document.getElementById('cfgEmployerSsoId').value = State.company.employerSsoId || '';
  if (document.getElementById('cfgSignatoryName')) document.getElementById('cfgSignatoryName').value = State.company.signatoryName || '';
  if (document.getElementById('cfgSignatoryTitle')) document.getElementById('cfgSignatoryTitle').value = State.company.signatoryTitle || '';
  if (document.getElementById('cfgSignatoryNameEn')) document.getElementById('cfgSignatoryNameEn').value = State.company.signatoryNameEn || '';
  if (document.getElementById('cfgSignatoryTitleEn')) document.getElementById('cfgSignatoryTitleEn').value = State.company.signatoryTitleEn || '';
  if (document.getElementById('inputGeminiApiKey')) {
    document.getElementById('inputGeminiApiKey').value = (State.company && State.company.geminiApiKey) || '';
  }

  // Payroll Defaults fields
  var pd = State.payrollDefaults || {};
  if (document.getElementById('cfgDefaultOtRate')) document.getElementById('cfgDefaultOtRate').value = pd.defaultOtRate !== undefined ? pd.defaultOtRate : 40;
  if (document.getElementById('cfgDefaultWorkDays')) document.getElementById('cfgDefaultWorkDays').value = pd.defaultWorkDays !== undefined ? pd.defaultWorkDays : 30;
  if (document.getElementById('cfgAbsentFactor')) document.getElementById('cfgAbsentFactor').value = pd.absentFactor !== undefined ? pd.absentFactor : 1.5;
  if (document.getElementById('cfgLeaveFactor')) document.getElementById('cfgLeaveFactor').value = pd.leaveFactor !== undefined ? pd.leaveFactor : 1.0;
  if (document.getElementById('cfgSickLeaveQuota')) document.getElementById('cfgSickLeaveQuota').value = pd.sickLeaveQuota !== undefined ? pd.sickLeaveQuota : 10;
  if (document.getElementById('cfgDefaultPfRate')) document.getElementById('cfgDefaultPfRate').value = pd.defaultPfRate !== undefined ? pd.defaultPfRate : 0.05;
  if (document.getElementById('cfgDefaultProbationDays')) document.getElementById('cfgDefaultProbationDays').value = pd.defaultProbationDays !== undefined ? pd.defaultProbationDays : 119;

  // Load PTN Time announcement settings
  loadAppAnnouncementSettings();
}

function savePayrollDefaults(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!hasPermission('manage_company') && !hasPermission('calc_payroll')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์ตั้งค่านโยบายเงินเดือน', 'error');
    return;
  }
  var d = {
    defaultOtRate: Number(document.getElementById('cfgDefaultOtRate').value) || 40,
    defaultWorkDays: Number(document.getElementById('cfgDefaultWorkDays').value) || 30,
    absentFactor: Number(document.getElementById('cfgAbsentFactor').value) || 1.5,
    leaveFactor: Number(document.getElementById('cfgLeaveFactor').value) || 1.0,
    sickLeaveQuota: Number(document.getElementById('cfgSickLeaveQuota').value) || 10,
    defaultPfRate: Number(document.getElementById('cfgDefaultPfRate').value) || 0.05,
    defaultProbationDays: Number(document.getElementById('cfgDefaultProbationDays').value) || 119
  };
  callApi('savePayrollDefaults', { defaults: d })
    .then(function(r) {
      showToast(r.message || 'บันทึกค่านโยบายเงินเดือนเรียบร้อยแล้ว');
      loadAppData();
    })
    .catch(function(err) {
      showToast(err.message, 'error');
    });
}

function saveCompanySettings(e) {
  if (e) e.preventDefault();
  if (!hasPermission('manage_company')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์จัดการข้อมูลบริษัท', 'error');
    return;
  }
  var d = {
    companyName: document.getElementById('cfgCompanyName').value.trim(),
    address: document.getElementById('cfgCompanyAddress').value.trim(),
    phone: document.getElementById('cfgCompanyPhone').value.trim(),
    taxId: document.getElementById('cfgCompanyTaxId').value.trim(),
    companyBranch: document.getElementById('cfgCompanyBranch') ? document.getElementById('cfgCompanyBranch').value.trim() : '00000',
    employerSsoId: document.getElementById('cfgEmployerSsoId') ? document.getElementById('cfgEmployerSsoId').value.trim() : '',
    signatoryName: document.getElementById('cfgSignatoryName') ? document.getElementById('cfgSignatoryName').value.trim() : '',
    signatoryTitle: document.getElementById('cfgSignatoryTitle') ? document.getElementById('cfgSignatoryTitle').value.trim() : '',
    signatoryNameEn: document.getElementById('cfgSignatoryNameEn') ? document.getElementById('cfgSignatoryNameEn').value.trim() : '',
    signatoryTitleEn: document.getElementById('cfgSignatoryTitleEn') ? document.getElementById('cfgSignatoryTitleEn').value.trim() : '',
    geminiApiKey: document.getElementById('inputGeminiApiKey') ? document.getElementById('inputGeminiApiKey').value.trim() : undefined
  };
  callApi('saveCompanyInfo', { settings: d })
    .then(function(r) {
      showToast(r.message || 'บันทึกข้อมูลบริษัทเรียบร้อยแล้ว');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// 6.1 PTN TIME APP POPUP ANNOUNCEMENT CONTROLLERS
function updateAnnToggleState(el) {
  var isChecked = el ? el.checked : false;
  var lbl = document.getElementById('annToggleStatusText');
  if (lbl) {
    lbl.textContent = isChecked ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
    lbl.style.color = isChecked ? '#16a34a' : '#dc2626';
  }
}

function loadAppAnnouncementSettings() {
  callApi('getAppAnnouncement', {})
    .then(function(r) {
      if (r && r.announcement) {
        var a = r.announcement;
        var actCheck = document.getElementById('cfgAnnActive');
        if (actCheck) {
          actCheck.checked = (a.active !== false && a.active !== 'false');
          updateAnnToggleState(actCheck);
        }
        if (document.getElementById('cfgAnnTag')) document.getElementById('cfgAnnTag').value = a.tag || '🚨 ประกาศสำคัญ';
        if (document.getElementById('cfgAnnBannerTitle')) document.getElementById('cfgAnnBannerTitle').value = a.bannerTitle || 'PTN TIME GO LIVE!';
        if (document.getElementById('cfgAnnTitle')) document.getElementById('cfgAnnTitle').value = a.title || 'เริ่มใช้งานระบบ PTN Time บันทึกเวลาเต็มรูปแบบ';
        if (document.getElementById('cfgAnnBody')) document.getElementById('cfgAnnBody').value = a.body || '';
        if (document.getElementById('cfgAnnSubnote')) document.getElementById('cfgAnnSubnote').value = a.subnote || '';
      }
    })
    .catch(function(err) {
      console.warn('Load announcement note:', err);
    });
}

function saveAppAnnouncementFromAdmin(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!hasPermission('manage_company')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์จัดการประกาศ', 'error');
    return;
  }
  var actCheck = document.getElementById('cfgAnnActive');
  var isActive = actCheck ? actCheck.checked : true;

  var annObj = {
    id: 'ann_' + Date.now(),
    active: isActive,
    tag: (document.getElementById('cfgAnnTag') ? document.getElementById('cfgAnnTag').value.trim() : '') || '🚨 ประกาศสำคัญ',
    bannerTitle: (document.getElementById('cfgAnnBannerTitle') ? document.getElementById('cfgAnnBannerTitle').value.trim() : '') || 'PTN TIME GO LIVE!',
    title: (document.getElementById('cfgAnnTitle') ? document.getElementById('cfgAnnTitle').value.trim() : '') || 'ประกาศสำคัญ',
    body: (document.getElementById('cfgAnnBody') ? document.getElementById('cfgAnnBody').value.trim() : '') || '',
    subnote: document.getElementById('cfgAnnSubnote') ? document.getElementById('cfgAnnSubnote').value.trim() : '',
    updatedAt: new Date().toISOString()
  };

  callApi('saveAppAnnouncement', {
    announcement: annObj,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      showToast(r.message || 'บันทึกประกาศเรียบร้อยแล้ว');
      loadAppAnnouncementSettings();
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการบันทึกประกาศ', 'error');
    });
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

  // Dashboard tab
  if (tabId === 'dashboard' && !hasPermission('view_dash')) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานแดชบอร์ดสรุปยอดเงินเดือน', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Payroll tab
  if (tabId === 'payroll' && !hasPermission('view_payroll')) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานระบบคำนวณเงินเดือน', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Input tab
  if (tabId === 'input' && !hasPermission('view_inputs')) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานบันทึกข้อมูลประจำงวด', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Attendance tab
  var canAccessAttendance = isSuperAdmin() || hasPermission('view_attendance');
  if (tabId === 'attendance' && !canAccessAttendance) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานระบบลงเวลา', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Employees tab
  if (tabId === 'employees' && !hasPermission('view_emp')) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานทะเบียนพนักงาน', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // History tab
  if (tabId === 'history' && !hasPermission('view_history')) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานประวัติการทำงาน', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Analytics tab
  var canAccessAnalytics = Boolean(
    String(State.currentUser && State.currentUser.username || '').toLowerCase() === 'admin' ||
    String(role).toLowerCase().indexOf('admin') >= 0 ||
    hasPermission('all') ||
    hasPermission('view_analytics')
  );
  if (tabId === 'analytics' && !canAccessAnalytics) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานระบบวิเคราะห์ Payroll Analytics', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Documents tab
  var canAccessDocuments = isSuperAdmin() || hasPermission('view_documents') || hasPermission('all');
  if (tabId === 'documents' && !canAccessDocuments) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานศูนย์เอกสาร', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Company tab
  if (tabId === 'company' && !(hasPermission('manage_company') || hasPermission('manage_backup'))) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานข้อมูลบริษัท', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Users tab
  if (tabId === 'users' && !hasPermission('manage_users')) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานจัดการผู้ใช้งาน', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.nav-tab-btn').forEach(function(el) { el.classList.remove('active'); });
  var target = document.getElementById('tab-' + tabId);
  var btn = document.getElementById('navBtn-' + tabId);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');

  if (tabId === 'history') {
    renderHistoryTab();
  } else if (tabId === 'analytics') {
    renderAnalyticsTab();
  } else if (tabId === 'documents') {
    renderDocumentsTab();
  } else if (tabId === 'attendance') {
    loadTimeAttendanceDashboard();
  } else if (tabId === 'employees') {
    renderEmployeesTable();
  } else if (tabId === 'company') {
    renderCompanySettings();
  } else if (tabId === 'users') {
    renderUsersTable();
  } else if (tabId === 'dashboard') {
    renderDashboard();
  } else if (tabId === 'payroll') {
    renderPayrollTable();
  } else if (tabId === 'input') {
    renderInputTable();
  }
}

var _modalZIndexCounter = 500;
function openModal(id) {
  var el = document.getElementById(id);
  if (el) {
    _modalZIndexCounter += 20;
    if (id === 'modalAttendancePhotoPreview') {
      el.style.zIndex = Math.max(_modalZIndexCounter, 1200);
    } else {
      el.style.zIndex = _modalZIndexCounter;
    }
    el.classList.add('active');
  }
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) {
    el.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active, .modal.active')) {
      _modalZIndexCounter = 500;
    }
  }
}

// POPULATE ALL EMPLOYEES
function batchPopulateEmployees() {
  if (!hasPermission('populate_inputs') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดึงพนักงานเข้างวดนี้', 'warning');
    return;
  }
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

// 1-CLICK SYNC ATTENDANCE, LEAVE, OT & SALARY ADVANCES FROM PTN TIME
function syncFromPtnTime() {
  if (!hasPermission('sync_ptn_time') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดึงข้อมูลจากระบบ PTN Time', 'warning');
    return;
  }
  if (State.isClosed) {
    if (!confirm('คำเตือน: งวด ' + State.period + ' ถูกปิดงวดแล้ว ต้องการดึงข้อมูลหรือไม่?')) return;
  }

  var cutDay = (State.settings && State.settings.cutoff_day) ? Number(State.settings.cutoff_day) : 25;
  var cutRangeText = cutDay >= 30 ? 'วันที่ 1 ถึงสิ้นเดือน' : ('วันที่ ' + (cutDay + 1) + ' ถึง ' + cutDay);
  var msg = 'ต้องการดึงข้อมูลบันทึกเวลา, วันลา, ชั่วโมง OT และยอดเบิกเงินล่วงหน้า (รอบตัดวิก ' + cutRangeText + ') จากระบบ PTN Time เข้าสู่งวด ' + State.period + ' อัตโนมัติใช่หรือไม่?\n\n' +
            '✨ ระบบจะอัปเดตยอดเบิกเงินล่วงหน้า, OT, วันลา และคำนวณเงินเดือนงวดนี้ให้อัตโนมัติทันที';
  
  if (!confirm(msg)) return;

  showToast('กำลังดึงข้อมูลจากระบบ PTN Time (' + cutRangeText + ')...');
  callApi('syncFromPtnTime', { period: State.period })
    .then(function(r) {
      if (r.success) {
        alert('✅ ' + r.message);
        showToast(r.message);
        loadAppData();
      } else {
        alert('เกิดข้อผิดพลาด: ' + (r.message || 'ไม่สามารถดึงข้อมูลได้'));
        showToast(r.message, 'error');
      }
    })
    .catch(function(e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
      showToast(e.message, 'error');
    });
}

// SYNC INDIVIDUAL EMPLOYEE ATTENDANCE, LEAVE, OT & ADVANCE FROM PTN TIME
function syncFromPtnTimeForEmp(empId, empName) {
  if (!hasPermission('sync_ptn_time') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดึงข้อมูลจากระบบ PTN Time', 'warning');
    return Promise.resolve(null);
  }
  if (!empId) return Promise.resolve(null);
  var nameStr = empName ? (' (' + empName + ')') : '';
  if (State.isClosed) {
    if (!confirm('คำเตือน: งวด ' + State.period + ' ถูกปิดงวดแล้ว ต้องการดึงข้อมูลของ [' + empId + ']' + nameStr + ' หรือไม่?')) {
      return Promise.resolve(null);
    }
  } else {
    if (!confirm('ต้องการดึงข้อมูล OT, วันลา และยอดเบิกเงินล่วงหน้าของ [' + empId + ']' + nameStr + ' จากระบบ PTN Time เข้าสู่งวด ' + State.period + ' ใช่หรือไม่?')) {
      return Promise.resolve(null);
    }
  }

  showToast('กำลังดึงข้อมูลของ ' + empId + ' จาก PTN Time...', 'info');
  return callApi('syncFromPtnTime', {
    period: State.period,
    empId: empId,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (r && r.success) {
        showToast(r.message || 'ดึงข้อมูลสำเร็จ');
        loadAppData();
        return r;
      } else {
        alert('เกิดข้อผิดพลาด: ' + (r ? r.message : 'ไม่สามารถดึงข้อมูลได้'));
        showToast((r && r.message) || 'ดึงข้อมูลไม่สำเร็จ', 'error');
        return null;
      }
    })
    .catch(function(e) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
      showToast(e.message, 'error');
      return null;
    });
}

// SYNC BUTTON HANDLER INSIDE MONTHLY INPUT MODAL
function syncCurrentEmpFromModal() {
  var empId = (document.getElementById('miEmpId') ? document.getElementById('miEmpId').value : '').trim();
  var empName = (document.getElementById('miEmpName') ? document.getElementById('miEmpName').value : '').trim();
  if (!empId) {
    showToast('กรุณาเลือกรหัสพนักงานก่อนดึงข้อมูล', 'warning');
    return;
  }
  syncFromPtnTimeForEmp(empId, empName).then(function(r) {
    if (r && r.success) {
      // Refresh modal form values from the freshly synced record
      setTimeout(function() {
        var rRecord = State.inputRecords.find(function(x) { return x.empId === empId; });
        if (rRecord) {
          if (document.getElementById('miOtHours')) document.getElementById('miOtHours').value = rRecord.otHours || 0;
          if (document.getElementById('miAdvanceDeduct')) document.getElementById('miAdvanceDeduct').value = rRecord.advanceDeduct || 0;
          if (document.getElementById('miSickLeaveDays')) document.getElementById('miSickLeaveDays').value = rRecord.sickLeaveDays || 0;
          if (document.getElementById('miUnpaidSickLeaveDays')) {
            document.getElementById('miUnpaidSickLeaveDays').value = rRecord.unpaidSickLeaveDays || 0;
          }
          if (document.getElementById('miLeaveDays')) document.getElementById('miLeaveDays').value = rRecord.leaveDays || 0;
          updateSickQuotaBadge();
          showToast('อัปเดตข้อมูลในแบบฟอร์มเรียบร้อยแล้ว');
        }
      }, 500);
    }
  });
}

// INPUT MODAL
// SICK LEAVE ANNUAL QUOTA TRACKING HELPER
function updateSickQuotaBadge() {
  var empId = (document.getElementById('miEmpId') ? document.getElementById('miEmpId').value : '').trim();
  var badge = document.getElementById('miSickQuotaBadge');
  var alertEl = document.getElementById('miSickQuotaAlert');
  if (!badge) return;

  var quota = (State.payrollDefaults && State.payrollDefaults.sickLeaveQuota !== undefined) ? Number(State.payrollDefaults.sickLeaveQuota) : 10;
  var currentSick = Number(document.getElementById('miSickLeaveDays') ? document.getElementById('miSickLeaveDays').value : 0) || 0;

  var origRecord = State.inputRecords.find(function(r) { return r.empId === empId; });
  var currentPeriodSavedSick = origRecord ? Number(origRecord.sickLeaveDays || 0) : 0;
  var totalAnnualSaved = (State.annualSickMap && State.annualSickMap[empId] !== undefined) ? Number(State.annualSickMap[empId]) : 0;
  var priorUsedSick = Math.max(0, totalAnnualSaved - currentPeriodSavedSick);

  var totalProjected = priorUsedSick + currentSick;
  var remaining = Math.max(0, quota - totalProjected);

  if (totalProjected <= quota) {
    badge.style.color = '#059669';
    badge.textContent = 'สิทธิ์ปีนี้: ใช้สะสม ' + totalProjected + '/' + quota + ' วัน (คงเหลือ ' + remaining + ' วัน)';
    if (alertEl) {
      if (currentSick > 0) {
        alertEl.style.display = 'block';
        alertEl.style.background = '#f0fdf4';
        alertEl.style.border = '1px solid #bbf7d0';
        alertEl.style.color = '#166534';
        alertEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> ลาป่วย ' + currentSick + ' วัน อยู่ในโควตา ' + quota + ' วัน/ปี (ไม่หักค่าจ้าง)';
      } else {
        alertEl.style.display = 'none';
      }
    }
  } else {
    var exceeded = totalProjected - quota;
    var paidThisPeriod = Math.max(0, currentSick - exceeded);
    badge.style.color = '#dc2626';
    badge.textContent = 'สิทธิ์ปีนี้: ใช้สะสม ' + totalProjected + '/' + quota + ' วัน (เกินโควตา ' + exceeded + ' วัน)';
    if (alertEl) {
      alertEl.style.display = 'block';
      alertEl.style.background = '#fef2f2';
      alertEl.style.border = '1px solid #fecaca';
      alertEl.style.color = '#991b1b';
      alertEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> สิทธิ์ลาป่วยฟรีครบ ' + quota + ' วัน/ปีแล้ว! (งวดนี้ได้รับค่าจ้าง ' + paidThisPeriod + ' วัน, ส่วนเกิน ' + exceeded + ' วัน ระบบจะคำนวณหักค่าจ้างอัตโนมัติ)';
    }
  }
}

function onInputSickLeaveChanged() {
  updateSickQuotaBadge();
}

function syncInputRulesNotices() {
  var pd = State.payrollDefaults || {};
  var absF = pd.absentFactor !== undefined ? pd.absentFactor : 1.5;
  var levF = pd.leaveFactor !== undefined ? pd.leaveFactor : 1.0;
  var sQuota = pd.sickLeaveQuota !== undefined ? pd.sickLeaveQuota : 10;

  if (document.getElementById('lblAbsentFactor')) document.getElementById('lblAbsentFactor').textContent = absF;
  if (document.getElementById('lblLeaveFactor')) document.getElementById('lblLeaveFactor').textContent = levF;
  if (document.getElementById('lblUnpaidSickFactor')) document.getElementById('lblUnpaidSickFactor').textContent = levF;
  if (document.getElementById('miLeaveRulesNotice')) {
    document.getElementById('miLeaveRulesNotice').textContent = 'ขาดหัก ' + absF + 'x | ลากิจหัก ' + levF + 'x | ลาป่วยฟรี ' + sQuota + ' วัน/ปี';
  }
}

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
  if (document.getElementById('miUnpaidSickLeaveDays')) document.getElementById('miUnpaidSickLeaveDays').value = '0';
  document.getElementById('miLateDeduct').value = '0';
  var defOt = (State.payrollDefaults && State.payrollDefaults.defaultOtRate) ? State.payrollDefaults.defaultOtRate : 40;
  document.getElementById('miOtHours').value = '0';
  document.getElementById('miOtRate').value = defOt;
  document.getElementById('miAllowance').value = '0';
  document.getElementById('miBonus').value = '0';
  document.getElementById('miAdvanceDeduct').value = '0';
  document.getElementById('miOtherDeduct').value = '0';
  document.getElementById('miSso').value = '0';
  document.getElementById('miTax').value = '0';
  updateModalDailyRate(0);
  syncInputRulesNotices();
  updateSickQuotaBadge();
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
  if (document.getElementById('miUnpaidSickLeaveDays')) document.getElementById('miUnpaidSickLeaveDays').value = r.unpaidSickLeaveDays || 0;
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
  syncInputRulesNotices();
  updateSickQuotaBadge();
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
    var defOt = (State.payrollDefaults && State.payrollDefaults.defaultOtRate) ? State.payrollDefaults.defaultOtRate : 40;
    if (!document.getElementById('miOtRate').value || Number(document.getElementById('miOtRate').value) === 0) {
      document.getElementById('miOtRate').value = defOt;
    }
    updateSickQuotaBadge();
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
  var canViewSalary = hasPermission('view_salary');
  if (document.getElementById('miModalWorkingDays')) document.getElementById('miModalWorkingDays').textContent = days;
  if (document.getElementById('miModalDailyRate')) {
    document.getElementById('miModalDailyRate').textContent = canViewSalary ? fmt(daily) : '฿***';
  }
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
    unpaidSickLeaveDays: Number(document.getElementById('miUnpaidSickLeaveDays') ? document.getElementById('miUnpaidSickLeaveDays').value : 0) || 0,
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
  callApi('deleteInputRecord', {
    empId: empId,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      showToast(r.message || 'ลบข้อมูลสำเร็จ');
      deselectAllInputRecords();
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// EMPLOYEE PROFILE PHOTO MANAGEMENT
function updateEmployeePhotoPreview(url) {
  var img = document.getElementById('mPhotoPreviewImg');
  var icon = document.getElementById('mPhotoPlaceholderIcon');
  var removeBtn = document.getElementById('mPhotoRemoveBtn');
  var hiddenInput = document.getElementById('mPhotoUrl');
  var fileInput = document.getElementById('mPhotoInput');

  if (fileInput) fileInput.value = '';
  if (hiddenInput) hiddenInput.value = url || '';

  if (url) {
    if (img) { img.src = url; img.style.display = 'block'; }
    if (icon) icon.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-flex';
  } else {
    if (img) { img.src = ''; img.style.display = 'none'; }
    if (icon) icon.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function removeEmployeePhoto() {
  updateEmployeePhotoPreview('');
}

function handleEmployeePhotoSelect(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!file.type.match(/^image\//)) {
    showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP)', 'error');
    return;
  }

  var reader = new FileReader();
  reader.onload = function(evt) {
    var rawDataUrl = evt.target.result;
    compressEmployeePhoto(rawDataUrl, 400, 400, 0.82, function(compressedUrl) {
      updateEmployeePhotoPreview(compressedUrl);
      showToast('อัปโหลดและปรับขนาดรูปภาพสำเร็จ');
    });
  };
  reader.readAsDataURL(file);
}

function compressEmployeePhoto(dataUrl, maxW, maxH, quality, callback) {
  var img = new Image();
  img.onload = function() {
    var w = img.width;
    var h = img.height;
    if (w > maxW || h > maxH) {
      if (w / h > maxW / maxH) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      } else {
        w = Math.round((w * maxH) / h);
        h = maxH;
      }
    }
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    var compressed = canvas.toDataURL('image/jpeg', quality || 0.82);
    callback(compressed);
  };
  img.onerror = function() {
    callback(dataUrl);
  };
  img.src = dataUrl;
}

// EMPLOYEE MASTER MODAL
function populateBranchSelects() {
  var bList = State.branches || [];
  if (!bList.length) {
    bList = [
      { branch_id: 'B01', branch_name: 'สำนักงานใหญ่', work_start_time: '08:30', work_end_time: '17:30' },
      { branch_id: 'B02', branch_name: 'สาขาที่ 2 (หน้าร้าน A)', work_start_time: '09:30', work_end_time: '19:00' },
      { branch_id: 'B03', branch_name: 'สาขาที่ 3 (หน้าร้าน B)', work_start_time: '10:00', work_end_time: '20:00' },
      { branch_id: 'B04', branch_name: 'สาขาที่ 4 (คลังสินค้า/สำรอง)', work_start_time: '09:00', work_end_time: '18:00' }
    ];
  }

  // 1. Employee modal branch selector
  var mBranchSel = document.getElementById('mBranchId');
  if (mBranchSel) {
    var curVal = mBranchSel.value || 'B01';
    var html = '';
    bList.forEach(function(b) {
      html += '<option value="' + esc(b.branch_id) + '">' + esc(b.branch_id) + ': ' + esc(b.branch_name) + ' (' + (b.work_start_time || '09:30') + '-' + (b.work_end_time || '19:00') + ')</option>';
    });
    mBranchSel.innerHTML = html;
    if (curVal) mBranchSel.value = curVal;
  }

  // 2. Attendance log filter dropdown
  var attFilterSel = document.getElementById('attFilterBranch');
  if (attFilterSel) {
    var curFilter = attFilterSel.value || 'ALL';
    var fHtml = '<option value="ALL">🏢 ทุกสาขา (All Branches)</option>';
    bList.forEach(function(b) {
      fHtml += '<option value="' + esc(b.branch_id) + '">' + esc(b.branch_id) + ': ' + esc(b.branch_name) + '</option>';
    });
    attFilterSel.innerHTML = fHtml;
    if (curFilter) attFilterSel.value = curFilter;
  }
}

function openAddEmployeeModal() {
  var isGeneralUser = (State.currentUser && String(State.currentUser.role).trim().toLowerCase() === 'user');
  var finSection = document.getElementById('empModalFinancialSection');
  if (finSection) finSection.style.display = isGeneralUser ? 'none' : 'block';
  var salInput = document.getElementById('mBaseSalary');
  if (salInput) salInput.required = !isGeneralUser;

  populateBranchSelects();
  var bSel = document.getElementById('mBranchId');
  if (bSel) bSel.value = 'B01';
  var allBranchesCheck = document.getElementById('mAllowAllBranches');
  if (allBranchesCheck) allBranchesCheck.checked = false;
  var isOtCheck = document.getElementById('mIsOtEligible');
  if (isOtCheck) isOtCheck.checked = true;
  var isUndertimeCheck = document.getElementById('mIsUndertimeExempt');
  if (isUndertimeCheck) isUndertimeCheck.checked = false;

  document.getElementById('empModalTitle').innerHTML = '<i class="fa-solid fa-user-plus"></i> เพิ่มพนักงานใหม่';
  document.getElementById('empOrigId').value = '';
  ['mEmpId','mFullName','mNickname','mBirthDate','mAge','mCitizenId','mPhone','mAddress','mDepartment','mPosition','mBankAccount','mJoinDate','mRemark'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  updateEmployeePhotoPreview('');
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

  populateBranchSelects();
  var bSel = document.getElementById('mBranchId');
  if (bSel) bSel.value = e.branchId || 'B01';
  var allBranchesCheck = document.getElementById('mAllowAllBranches');
  if (allBranchesCheck) allBranchesCheck.checked = (e.allowAllBranches === true || e.allowAllBranches === 'true');
  var isOtCheck = document.getElementById('mIsOtEligible');
  if (isOtCheck) isOtCheck.checked = (e.isOtEligible !== false && e.isOtEligible !== 'false');
  var isUndertimeCheck = document.getElementById('mIsUndertimeExempt');
  if (isUndertimeCheck) isUndertimeCheck.checked = (e.isUndertimeExempt === true || e.isUndertimeExempt === 'true');

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
  updateEmployeePhotoPreview(e.photoUrl || '');
  if (document.getElementById('mStatus')) document.getElementById('mStatus').value = e.status || 'Active';
  if (document.getElementById('mProbationDays')) document.getElementById('mProbationDays').value = e.probationDays || 119;
  if (document.getElementById('mProbationEndDate')) document.getElementById('mProbationEndDate').value = e.probationEndDate || '';
  onEmployeeStatusChanged();
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

  var branchIdVal = (document.getElementById('mBranchId') && document.getElementById('mBranchId').value) || 'B01';
  var allowAllBranchesVal = (document.getElementById('mAllowAllBranches') && document.getElementById('mAllowAllBranches').checked) || false;

  var d = {
    empId: document.getElementById('mEmpId').value.trim(),
    fullName: document.getElementById('mFullName').value.trim(),
    nickname: document.getElementById('mNickname').value.trim(),
    photoUrl: document.getElementById('mPhotoUrl') ? document.getElementById('mPhotoUrl').value : '',
    birthDate: document.getElementById('mBirthDate').value,
    age: Number(document.getElementById('mAge').value) || 0,
    citizenId: document.getElementById('mCitizenId').value.trim(),
    phone: document.getElementById('mPhone').value.trim(),
    address: document.getElementById('mAddress').value.trim(),
    department: document.getElementById('mDepartment').value.trim(),
    position: document.getElementById('mPosition').value.trim(),
    branchId: branchIdVal,
    allowAllBranches: allowAllBranchesVal,
    isOtEligible: (document.getElementById('mIsOtEligible') ? document.getElementById('mIsOtEligible').checked : true),
    isUndertimeExempt: (document.getElementById('mIsUndertimeExempt') ? document.getElementById('mIsUndertimeExempt').checked : false),
    status: (document.getElementById('mStatus') ? document.getElementById('mStatus').value : 'Active'),
    probationDays: (document.getElementById('mProbationDays') ? Number(document.getElementById('mProbationDays').value) : 119),
    probationEndDate: (document.getElementById('mProbationEndDate') ? document.getElementById('mProbationEndDate').value : ''),
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

function populatePayslipModal(row) {
  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  var compAddr = State.company.address || '';
  var compPhone = State.company.phone || '';
  var compTax = State.company.taxId || '';

  document.getElementById('psCompName').textContent = compName;
  document.getElementById('psCompAddr').textContent = compAddr ? 'ที่อยู่: ' + compAddr : '';
  document.getElementById('psCompTax').textContent = (compTax ? 'เลขประจำตัวผู้เสียภาษี: ' + compTax + ' ' : '') + (compPhone ? 'โทร: ' + compPhone : '');
  document.getElementById('psPeriod').textContent = row.period || State.period;
  document.getElementById('psEmpId').textContent = row.empId;
  document.getElementById('psEmpName').textContent = row.name;
  document.getElementById('psDeptPos').textContent = (row.department || '-') + ' / ' + (row.position || '-');
  document.getElementById('psBankAcc').textContent = (row.bankName || '-') + ' ' + (row.bankAccount || '-');

  document.getElementById('psBaseSalary').textContent = fmt(row.baseSalary);
  document.getElementById('psOtHours').textContent = row.otHours || 0;
  if (document.getElementById('psOtRate')) {
    var rOtRate = (row.otRate !== null && row.otRate !== undefined && !isNaN(Number(row.otRate))) ? Number(row.otRate) : ((State.payrollDefaults && State.payrollDefaults.defaultOtRate) ? State.payrollDefaults.defaultOtRate : 40);
    document.getElementById('psOtRate').textContent = rOtRate;
  }
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

// PAYSLIP MODAL
function viewPayslip(empId) {
  if (!hasPermission('view_salary') || !hasPermission('view_payslip')) {
    showToast('คุณไม่มีสิทธิ์เข้าถึงใบแจ้งยอดเงินเดือน (Payslip)', 'warning');
    return;
  }
  var row = State.payrollList.find(function(x) { return x.empId === empId; });
  if (!row) return;
  populatePayslipModal(row);
}

function printPayslip() {
  clearAllPrintClasses();
  document.body.classList.add('printing-payslip');
  setTimeout(function() {
    window.print();
    setTimeout(clearAllPrintClasses, 1500);
  }, 50);
}

// (Legacy printHistoryReport removed - using upgraded version in History Controller)

// PERIOD CLOSE / REOPEN
function closePeriod() {
  if (!hasPermission('close_period')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์ปิดงวดเงินเดือน', 'error');
    return;
  }
  var lbl = document.getElementById('lblClosePeriodTarget');
  if (lbl) lbl.textContent = State.period;
  var chk = document.getElementById('chkClosePeriodAutoBackup');
  if (chk) chk.checked = true;
  openModal('modalClosePeriodConfirm');
}

function confirmClosePeriodAction() {
  if (!hasPermission('close_period')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์ปิดงวดเงินเดือน', 'error');
    return;
  }
  var btn = document.getElementById('btnExecuteClosePeriod');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังดำเนินการ...';
  }

  var doBackup = document.getElementById('chkClosePeriodAutoBackup') ? document.getElementById('chkClosePeriodAutoBackup').checked : false;

  var executeClose = function() {
    callApi('closePeriod', { username: (State.currentUser && State.currentUser.username) || (window.currentUser && window.currentUser.username) || 'Admin' })
      .then(function(r) {
        closeModal('modalClosePeriodConfirm');
        showToast(r.message || 'ปิดงวดประจำเดือนสำเร็จ (ล็อคผลการคำนวณแล้ว)');
        loadAppData();
      })
      .catch(function(e) {
        showToast(e.message, 'error');
      })
      .finally(function() {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-lock"></i> ยืนยันปิดงวดและล็อคข้อมูล';
        }
      });
  };

  if (doBackup) {
    showToast('กำลังดาวน์โหลดสำรองข้อมูลประจำงวด ' + State.period + ' ก่อนปิดงวด...', 'info');
    backupDatabase(true)
      .then(function() {
        setTimeout(executeClose, 800);
      })
      .catch(function() {
        executeClose();
      });
  } else {
    executeClose();
  }
}

function reopenPeriod() {
  if (!hasPermission('close_period')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์เปิดงวดเงินเดือน', 'error');
    return;
  }
  if (!confirm('ยืนยันการปลดล็อคและเปิดงวด ' + State.period + ' ใช่หรือไม่?')) return;
  callApi('reopenPeriod', { username: (State.currentUser && State.currentUser.username) || (window.currentUser && window.currentUser.username) || 'Admin' })
    .then(function(r) {
      showToast(r.message || 'เปิดงวดสำเร็จ');
      loadAppData();
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function runPayrollRecalc() {
  if (!hasPermission('calc_payroll')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์ประมวลผลคำนวณเงินเดือน', 'error');
    return;
  }
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
      (State.employees || []).forEach(function(e) {
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
      (State.employees || []).forEach(function(e) {
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
function getDefaultRolePermissions(role) {
  var r = String(role || '').toLowerCase();
  if (r.indexOf('super') >= 0 || r === 'admin / hr' || r === 'admin') {
    return ['all'];
  } else if (r.indexOf('supervisor') >= 0) {
    return [
      'view_emp', 'view_attendance', 'approve_attendance', 'unlock_device'
    ];
  } else if (r.indexOf('payroll') >= 0 || r === 'hr') {
    return [
      'view_dash', 'view_emp', 'view_salary', 'edit_emp',
      'view_inputs', 'edit_inputs', 'populate_inputs',
      'view_payroll', 'calc_payroll', 'view_payslip',
      'view_history', 'print_history', 'export_csv',
      'view_analytics', 'view_documents', 'issue_salary_cert',
      'export_bank_files', 'export_tax_sso', 'view_attendance', 'sync_ptn_time'
    ];
  } else if (r.indexOf('attendance') >= 0) {
    return [
      'view_emp', 'view_inputs', 'edit_inputs', 'populate_inputs',
      'view_attendance', 'approve_attendance', 'unlock_device',
      'sync_ptn_time', 'view_history', 'print_history'
    ];
  } else if (r.indexOf('accounting') >= 0 || r.indexOf('finance') >= 0) {
    return [
      'view_dash', 'view_payroll', 'view_payslip',
      'view_history', 'print_history', 'export_csv',
      'view_analytics', 'view_documents', 'export_bank_files', 'export_tax_sso'
    ];
  } else {
    // General User
    return ['view_emp'];
  }
}

function onRoleTemplateChanged() {
  var role = document.getElementById('mRole').value;
  var allPerms = [
    'perm_view_emp', 'perm_view_salary', 'perm_edit_emp', 'perm_del_emp',
    'perm_view_inputs', 'perm_edit_inputs', 'perm_populate_inputs',
    'perm_view_payroll', 'perm_calc_payroll', 'perm_view_payslip', 'perm_close_period',
    'perm_view_attendance', 'perm_approve_attendance', 'perm_unlock_device', 'perm_sync_ptn_time', 'perm_manage_attendance_settings',
    'perm_view_documents', 'perm_issue_salary_cert', 'perm_export_bank_files', 'perm_export_tax_sso',
    'perm_view_dash', 'perm_view_history', 'perm_print_history', 'perm_export_csv', 'perm_view_analytics',
    'perm_manage_users', 'perm_company_settings', 'perm_backup_restore'
  ];

  if (role === 'Super Admin' || role === 'Admin / HR' || role === 'Admin') {
    allPerms.forEach(function(p) {
      var el = document.getElementById(p);
      if (el) el.checked = true;
    });
  } else if (role === 'Supervisor') {
    var supPerms = ['perm_view_emp', 'perm_view_attendance', 'perm_approve_attendance', 'perm_unlock_device'];
    allPerms.forEach(function(p) {
      var el = document.getElementById(p);
      if (el) el.checked = (supPerms.indexOf(p) >= 0);
    });
  } else if (role === 'HR Payroll') {
    var hrPerms = [
      'perm_view_emp', 'perm_view_salary', 'perm_edit_emp',
      'perm_view_inputs', 'perm_edit_inputs', 'perm_populate_inputs',
      'perm_view_payroll', 'perm_calc_payroll', 'perm_view_payslip',
      'perm_view_attendance', 'perm_sync_ptn_time',
      'perm_view_documents', 'perm_issue_salary_cert', 'perm_export_bank_files', 'perm_export_tax_sso',
      'perm_view_dash', 'perm_view_history', 'perm_print_history', 'perm_export_csv', 'perm_view_analytics'
    ];
    allPerms.forEach(function(p) {
      var el = document.getElementById(p);
      if (el) el.checked = (hrPerms.indexOf(p) >= 0);
    });
  } else if (role === 'HR Time Attendance') {
    var attPerms = [
      'perm_view_emp', 'perm_view_inputs', 'perm_edit_inputs', 'perm_populate_inputs',
      'perm_view_attendance', 'perm_approve_attendance', 'perm_unlock_device', 'perm_sync_ptn_time',
      'perm_view_history', 'perm_print_history'
    ];
    allPerms.forEach(function(p) {
      var el = document.getElementById(p);
      if (el) el.checked = (attPerms.indexOf(p) >= 0);
    });
  } else if (role === 'Accounting / Finance') {
    var accPerms = [
      'perm_view_payroll', 'perm_view_payslip',
      'perm_view_documents', 'perm_export_bank_files', 'perm_export_tax_sso',
      'perm_view_dash', 'perm_view_history', 'perm_print_history', 'perm_export_csv', 'perm_view_analytics'
    ];
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
  var passInput = document.getElementById('mPassword');
  if (passInput) {
    passInput.value = '';
    passInput.required = true;
    passInput.placeholder = 'รหัสผ่าน';
  }
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
  var passInput = document.getElementById('mPassword');
  if (passInput) {
    passInput.value = '';
    passInput.required = false;
    passInput.placeholder = 'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน';
  }

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
  var perms = u.permissions;
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms); } catch(e) { perms = []; }
  }
  if (!perms || !Array.isArray(perms) || perms.length === 0) {
    perms = getDefaultRolePermissions(u.role);
  }
  perms = perms || [];
  var isAll = perms.indexOf('all') >= 0 || u.username === 'admin' || (u.role && (u.role.toLowerCase().indexOf('super') >= 0 || u.role.toLowerCase().indexOf('admin') >= 0));

  var permMapping = {
    'perm_view_emp': ['view_emp'],
    'perm_view_salary': ['view_salary'],
    'perm_edit_emp': ['edit_emp'],
    'perm_del_emp': ['del_emp'],
    'perm_view_inputs': ['view_inputs'],
    'perm_edit_inputs': ['edit_inputs'],
    'perm_populate_inputs': ['populate_inputs'],
    'perm_view_payroll': ['view_payroll'],
    'perm_calc_payroll': ['calc_payroll'],
    'perm_view_payslip': ['view_payslip'],
    'perm_close_period': ['close_period'],
    'perm_view_attendance': ['view_attendance'],
    'perm_approve_attendance': ['approve_attendance'],
    'perm_unlock_device': ['unlock_device'],
    'perm_sync_ptn_time': ['sync_ptn_time'],
    'perm_manage_attendance_settings': ['manage_attendance_settings'],
    'perm_view_documents': ['view_documents'],
    'perm_issue_salary_cert': ['issue_salary_cert'],
    'perm_export_bank_files': ['export_bank_files'],
    'perm_export_tax_sso': ['export_tax_sso'],
    'perm_view_dash': ['view_dash'],
    'perm_view_history': ['view_history'],
    'perm_print_history': ['print_history'],
    'perm_export_csv': ['export_csv'],
    'perm_view_analytics': ['view_analytics'],
    'perm_manage_users': ['manage_users'],
    'perm_company_settings': ['manage_company', 'company_settings'],
    'perm_backup_restore': ['manage_backup', 'backup_restore']
  };

  Object.keys(permMapping).forEach(function(pId) {
    var el = document.getElementById(pId);
    if (el) {
      var keys = permMapping[pId];
      var hasIt = isAll || keys.some(function(k) { return perms.indexOf(k) >= 0 || perms.indexOf('perm_' + k) >= 0; });
      el.checked = hasIt;
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
  if (role === 'Super Admin' || role === 'Admin / HR' || role === 'Admin' || u === 'admin') {
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
      { id: 'perm_view_attendance', key: 'view_attendance' },
      { id: 'perm_approve_attendance', key: 'approve_attendance' },
      { id: 'perm_unlock_device', key: 'unlock_device' },
      { id: 'perm_sync_ptn_time', key: 'sync_ptn_time' },
      { id: 'perm_manage_attendance_settings', key: 'manage_attendance_settings' },
      { id: 'perm_view_documents', key: 'view_documents' },
      { id: 'perm_issue_salary_cert', key: 'issue_salary_cert' },
      { id: 'perm_export_bank_files', key: 'export_bank_files' },
      { id: 'perm_export_tax_sso', key: 'export_tax_sso' },
      { id: 'perm_view_dash', key: 'view_dash' },
      { id: 'perm_view_history', key: 'view_history' },
      { id: 'perm_print_history', key: 'print_history' },
      { id: 'perm_export_csv', key: 'export_csv' },
      { id: 'perm_view_analytics', key: 'view_analytics' },
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
  if (!hasPermission('manage_users')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์จัดการผู้ใช้งาน', 'error');
    return;
  }
  if (username.toLowerCase() === 'admin') {
    showToast('ไม่สามารถลบผู้ใช้งาน Admin หลักของระบบได้', 'error');
    return;
  }
  if (!confirm('ยืนยันการลบผู้ใช้งาน ' + username + ' ออกจากระบบ?')) return;
  callApi('deleteUser', { targetUsername: username, usernameToDelete: username })
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

// (Legacy filterHistoryTable removed - using upgraded version with privacy guards)

// BACKUP & RESTORE HANDLERS (ENTERPRISE FULL TABLE COVERAGE & SELECTIVE RESTORE)
window.pendingRestoreBackupData = null;

function backupDatabase(isAutoSafety) {
  if (!isAutoSafety && !hasPermission('manage_backup')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์สำรองข้อมูลระบบ', 'error');
    return Promise.reject(new Error('สิทธิ์ไม่เพียงพอ'));
  }
  if (!isAutoSafety) showToast('กำลังเตรียมไฟล์สำรองข้อมูลทั้งระบบ...', 'info');
  return callApi('backupDatabase', { username: (State.currentUser && State.currentUser.username) || (window.currentUser && window.currentUser.username) || 'Admin' })
    .then(function(r) {
      if (!r.success || !r.backup) {
        showToast(r.message || 'ไม่สามารถสำรองข้อมูลได้', 'error');
        return null;
      }
      var jsonStr = JSON.stringify(r.backup, null, 2);
      var nowStr = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      var prefix = isAutoSafety ? 'SAFETY_PRE_RESTORE_BACKUP_' : 'PTN_FULL_SYSTEM_BACKUP_';
      var filename = prefix + nowStr + '.json';

      var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (!isAutoSafety) {
        showToast('ดาวน์โหลดไฟล์สำรองข้อมูลสมบูรณ์ทุกตารางเรียบร้อย');
      }
      return r.backup;
    })
    .catch(function(err) {
      showToast('Error Backup: ' + err.message, 'error');
      return null;
    });
}

function triggerRestoreBackup() {
  if (!hasPermission('manage_backup')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์กู้คืนข้อมูลระบบ', 'error');
    return;
  }
  var fileInput = document.getElementById('restoreBackupFileInput');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function handleRestoreBackupFile(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var backupData = JSON.parse(e.target.result);
      var data = backupData.data || backupData;

      if (!data.employees && !data.settings && !data.users && !data.monthly_inputs && !data.branches) {
        showToast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของระบบ PTN หรือโครงสร้างข้อมูลไม่ถูกต้อง', 'error');
        return;
      }

      window.pendingRestoreBackupData = backupData;

      // Extract metadata
      var metaName = file.name + ' (' + (file.size > 1048576 ? (file.size/1048576).toFixed(2) + ' MB' : (file.size/1024).toFixed(1) + ' KB') + ')';
      var lblMeta = document.getElementById('restoreFileMetaName');
      if (lblMeta) lblMeta.textContent = metaName;

      var bDate = backupData.backupDate || backupData.date;
      var dateDisplay = '-';
      if (bDate) {
        try {
          var d = new Date(bDate);
          dateDisplay = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch(ex) { dateDisplay = String(bDate); }
      } else {
        dateDisplay = 'ไม่ระบุในไฟล์';
      }

      var empCount = (data.employees || []).length;
      var branchCount = (data.branches || []).length;

      // Extract unique periods from monthly_inputs or payroll_calcs
      var periodSet = new Set();
      (data.monthly_inputs || []).forEach(function(i) { if (i.period) periodSet.add(i.period); });
      (data.payroll_calcs || []).forEach(function(p) { if (p.period) periodSet.add(p.period); });
      var periods = Array.from(periodSet).sort();

      var elDate = document.getElementById('lblRestoreDate');
      if (elDate) elDate.textContent = dateDisplay;
      var elEmp = document.getElementById('lblRestoreEmpCount');
      if (elEmp) elEmp.textContent = empCount + ' คน';
      var elBranch = document.getElementById('lblRestoreBranchCount');
      if (elBranch) elBranch.textContent = branchCount > 0 ? branchCount + ' สาขา' : 'ไม่มีในไฟล์';
      var elPeriods = document.getElementById('lblRestorePeriodsCount');
      if (elPeriods) elPeriods.textContent = periods.length + ' งวด';

      // Populate Period Checkboxes
      var periodBox = document.getElementById('restorePeriodCheckboxes');
      if (periodBox) {
        if (periods.length === 0) {
          periodBox.innerHTML = '<span style="color:#94a3b8">ไม่มีรายการงวดเงินเดือนในไฟล์</span>';
        } else {
          periodBox.innerHTML = periods.map(function(p) {
            return '<label style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer">' +
              '<input type="checkbox" class="restore-period-chk" value="' + p + '" checked style="accent-color:#2563eb"> ' +
              '<span>' + p + '</span>' +
            '</label>';
          }).join('');
        }
      }

      // Reset checkboxes
      if (document.getElementById('chkAutoSafetyBackup')) document.getElementById('chkAutoSafetyBackup').checked = true;
      if (document.getElementById('chkRestoreEmployees')) document.getElementById('chkRestoreEmployees').checked = true;
      if (document.getElementById('chkRestoreDevices')) document.getElementById('chkRestoreDevices').checked = (data.employee_devices || []).length > 0;
      if (document.getElementById('chkRestorePayroll')) document.getElementById('chkRestorePayroll').checked = periods.length > 0;
      if (document.getElementById('chkRestorePtnTime')) document.getElementById('chkRestorePtnTime').checked = Boolean(data.time_logs || data.leave_requests || data.ot_requests || data.advance_requests);
      if (document.getElementById('chkRestorePushSubs')) document.getElementById('chkRestorePushSubs').checked = (data.push_subscriptions || []).length > 0;
      if (document.getElementById('chkRestoreSettings')) document.getElementById('chkRestoreSettings').checked = true;
      if (document.getElementById('chkRestoreUsers')) document.getElementById('chkRestoreUsers').checked = false; // default false for security

      toggleRestorePeriodOptions();

      // Open Modal
      openModal('modalRestoreInspection');

    } catch(err) {
      showToast('ไฟล์ JSON ไม่ถูกต้อง หรือเสียหาย: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function toggleRestorePeriodOptions() {
  var chkPayroll = document.getElementById('chkRestorePayroll');
  var area = document.getElementById('restorePeriodScopeArea');
  if (area && chkPayroll) {
    area.style.display = chkPayroll.checked ? 'flex' : 'none';
  }
}

function toggleSelectAllRestorePeriods() {
  var chks = document.querySelectorAll('.restore-period-chk');
  if (chks.length === 0) return;
  var allChecked = Array.from(chks).every(function(c) { return c.checked; });
  chks.forEach(function(c) { c.checked = !allChecked; });
}

function executeSelectiveRestore() {
  if (!hasPermission('manage_backup')) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่ได้รับสิทธิ์กู้คืนข้อมูลระบบ', 'error');
    return;
  }
  if (!window.pendingRestoreBackupData) {
    showToast('ไม่พบข้อมูลไฟล์สำรอง กรุณาเลือกไฟล์ใหม่อีกครั้ง', 'error');
    return;
  }

  var doSafety = document.getElementById('chkAutoSafetyBackup') ? document.getElementById('chkAutoSafetyBackup').checked : false;
  var doEmployees = document.getElementById('chkRestoreEmployees') ? document.getElementById('chkRestoreEmployees').checked : true;
  var doDevices = document.getElementById('chkRestoreDevices') ? document.getElementById('chkRestoreDevices').checked : true;
  var doPayroll = document.getElementById('chkRestorePayroll') ? document.getElementById('chkRestorePayroll').checked : true;
  var doPtnTime = document.getElementById('chkRestorePtnTime') ? document.getElementById('chkRestorePtnTime').checked : true;
  var doPushSubs = document.getElementById('chkRestorePushSubs') ? document.getElementById('chkRestorePushSubs').checked : true;
  var doSettings = document.getElementById('chkRestoreSettings') ? document.getElementById('chkRestoreSettings').checked : true;
  var doUsers = document.getElementById('chkRestoreUsers') ? document.getElementById('chkRestoreUsers').checked : false;

  var selectedPeriods = [];
  if (doPayroll) {
    var periodChks = document.querySelectorAll('.restore-period-chk:checked');
    periodChks.forEach(function(c) { selectedPeriods.push(c.value); });
    var allPeriodChks = document.querySelectorAll('.restore-period-chk');
    if (allPeriodChks.length > 0 && selectedPeriods.length === 0) {
      showToast('กรุณาเลือกงวดเงินเดือนอย่างน้อย 1 งวด หรือยกเลิกการเลือกหมวดเงินเดือน', 'warning');
      return;
    }
  }

  var btn = document.getElementById('btnConfirmExecuteRestore');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังดำเนินการ...';
  }

  var proceedRestore = function() {
    showToast('กำลังกู้คืนข้อมูลเข้าสู่ฐานข้อมูล Cloudflare D1...', 'info');

    var options = {
      selectiveMode: true,
      restoreEmployees: doEmployees,
      restoreBranches: doEmployees,
      restoreDevices: doDevices,
      restorePayroll: doPayroll,
      selectedPeriods: selectedPeriods,
      restorePtnTime: doPtnTime,
      restorePushSubs: doPushSubs,
      restoreSettings: doSettings,
      restoreUsers: doUsers
    };

    callApi('restoreDatabase', {
      backup: window.pendingRestoreBackupData,
      options: options,
      username: (State.currentUser && State.currentUser.username) || (window.currentUser && window.currentUser.username) || 'Admin'
    })
      .then(function(r) {
        if (r.success) {
          closeModal('modalRestoreInspection');
          window.pendingRestoreBackupData = null;
          showToast(r.message || 'กู้คืนข้อมูลสำเร็จเรียบร้อยแล้ว');
          setTimeout(function() {
            loadAppData();
          }, 600);
        } else {
          showToast(r.message || 'เกิดข้อผิดพลาดในการกู้คืนข้อมูล', 'error');
        }
      })
      .catch(function(err) {
        showToast('Restore Error: ' + err.message, 'error');
      })
      .finally(function() {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-check-double"></i> ยืนยันการกู้คืนข้อมูล';
        }
      });
  };

  if (doSafety) {
    showToast('กำลังดาวน์โหลดข้อมูลสำรองปัจจุบัน (Auto-Safety Snapshot)...', 'info');
    backupDatabase(true)
      .then(function() {
        setTimeout(proceedRestore, 800);
      })
      .catch(function() {
        proceedRestore();
      });
  } else {
    proceedRestore();
  }
}

function exportAllEmployeeHistory() {
  if (!hasPermission('view_salary') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่มีสิทธิ์ดาวน์โหลดรายงานเงินเดือน', 'warning');
    return;
  }
  if (!hasPermission('export_csv') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่มีสิทธิ์ส่งออกข้อมูล CSV', 'warning');
    return;
  }
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
  if (!hasPermission('view_salary') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่มีสิทธิ์พิมพ์รายงานประวัติพนักงาน', 'warning');
    return;
  }
  if (!hasPermission('print_history') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: คุณไม่มีสิทธิ์พิมพ์รายงานประวัติพนักงาน', 'warning');
    return;
  }
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
      (State.employees || []).forEach(function(e) {
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

      clearAllPrintClasses();
      document.body.classList.add('printing-batch-history');

      setTimeout(function() {
        window.print();
        setTimeout(clearAllPrintClasses, 1500);
      }, 50);
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}


// ==============================================================================
// GEMINI SETTINGS & DRAGGABLE AI ASSISTANT CONTROLLER
// ==============================================================================
function toggleGeminiKeyVisibility() {
  var inp = document.getElementById('inputGeminiApiKey');
  var icon = document.getElementById('iconToggleGeminiKey');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
  } else {
    inp.type = 'password';
    if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
  }
}

function testGeminiConnection() {
  var inp = document.getElementById('inputGeminiApiKey');
  var key = inp ? inp.value.trim() : '';
  if (!key) {
    showToast('กรุณากรอก API Key ก่อนทดสอบ', 'warning');
    return;
  }
  showToast('กำลังทดสอบเชื่อมต่อ Google Gemini 3.6 Flash...', 'info');
  callApi('testGeminiApiKey', { apiKey: key })
    .then(function(r) {
      if (r.success) {
        showToast(r.message || 'เชื่อมต่อสำเร็จ');
        var badge = document.getElementById('geminiConnectionStatusBadge');
        if (badge) {
          badge.style.background = '#ecfdf5';
          badge.style.color = '#059669';
          badge.style.borderColor = '#a7f3d0';
          badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> พร้อมใช้งาน';
        }
      } else {
        showToast(r.message || 'เชื่อมต่อไม่สำเร็จ', 'error');
        var badge = document.getElementById('geminiConnectionStatusBadge');
        if (badge) {
          badge.style.background = '#fef2f2';
          badge.style.color = '#dc2626';
          badge.style.borderColor = '#fecaca';
          badge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> ผิดพลาด';
        }
      }
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

function saveGeminiApiKey() {
  var inp = document.getElementById('inputGeminiApiKey');
  var key = inp ? inp.value.trim() : '';
  showToast('กำลังบันทึก Google Gemini API Key...', 'info');
  callApi('saveCompanyInfo', { settings: { geminiApiKey: key } })
    .then(function(r) {
      showToast('บันทึก API Key สำเร็จเรียบร้อย');
      if (State.company) State.company.geminiApiKey = key;
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

var isAiChatOpen = false;

function toggleAiChat() {
  isAiChatOpen = !isAiChatOpen;
  var drawer = document.getElementById('aiChatDrawer');
  var btn = document.getElementById('aiChatToggleBtn');
  if (drawer) {
    if (isAiChatOpen) {
      if (btn) {
        var rect = btn.getBoundingClientRect();
        if (rect.left < window.innerWidth / 2) {
          drawer.style.left = Math.max(16, rect.left) + 'px';
          drawer.style.right = 'auto';
        } else {
          drawer.style.right = Math.max(16, window.innerWidth - rect.right) + 'px';
          drawer.style.left = 'auto';
        }
      }
      drawer.classList.add('active');
      if (btn) btn.style.display = 'none';
      var inp = document.getElementById('aiChatInput');
      if (inp) setTimeout(function() { inp.focus(); }, 300);
    } else {
      drawer.classList.remove('active');
      if (btn) btn.style.display = 'flex';
    }
  }
}

function initDraggableAiChatBtn() {
  var btn = document.getElementById('aiChatToggleBtn');
  if (!btn) return;

  // Restore saved position
  try {
    var savedPos = localStorage.getItem('ptn_ai_btn_pos');
    if (savedPos) {
      var p = JSON.parse(savedPos);
      var maxLeft = window.innerWidth - (btn.offsetWidth || 130) - 10;
      var maxTop = window.innerHeight - (btn.offsetHeight || 44) - 10;
      var left = Math.max(10, Math.min(p.left, maxLeft));
      var top = Math.max(10, Math.min(p.top, maxTop));
      btn.style.left = left + 'px';
      btn.style.top = top + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
  } catch(e) {}

  var isDragging = false;
  var hasMoved = false;
  var startX = 0, startY = 0;
  var origLeft = 0, origTop = 0;

  function onPointerDown(e) {
    if (e.type === 'mousedown' && e.button !== 0) return;

    isDragging = true;
    hasMoved = false;
    var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
    var clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
    startX = clientX;
    startY = clientY;

    var rect = btn.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;

    btn.style.transition = 'none';

    document.addEventListener('mousemove', onPointerMove, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
    var clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);

    var dx = clientX - startX;
    var dy = clientY - startY;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      hasMoved = true;
      if (e.cancelable) e.preventDefault();
    }

    if (hasMoved) {
      var newLeft = origLeft + dx;
      var newTop = origTop + dy;

      var maxLeft = window.innerWidth - btn.offsetWidth - 10;
      var maxTop = window.innerHeight - btn.offsetHeight - 10;

      newLeft = Math.max(10, Math.min(newLeft, maxLeft));
      newTop = Math.max(10, Math.min(newTop, maxTop));

      btn.style.left = newLeft + 'px';
      btn.style.top = newTop + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;

    btn.style.transition = '';

    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);

    if (hasMoved) {
      var rect = btn.getBoundingClientRect();
      try {
        localStorage.setItem('ptn_ai_btn_pos', JSON.stringify({ left: rect.left, top: rect.top }));
      } catch(ex) {}
    } else {
      toggleAiChat();
    }
  }

  btn.addEventListener('mousedown', onPointerDown);
  btn.addEventListener('touchstart', onPointerDown, { passive: false });
}

function clearAiChat() {
  var body = document.getElementById('aiChatBody');
  if (body) {
    body.innerHTML = '<div class="ai-msg bot">' +
      '<div class="ai-avatar" style="width:28px;height:28px;font-size:14px;background:#e0e7ff;color:#4338ca"><i class="fa-solid fa-robot"></i></div>' +
      '<div class="ai-msg-bubble">' +
        'ล้างประวัติการสนทนาเรียบร้อยครับ! สามารถพิมพ์ถามข้อมูลเงินเดือนหรือพนักงานได้เลยครับ 😊' +
      '</div>' +
    '</div>';
  }
}

function askQuickPrompt(text) {
  var inp = document.getElementById('aiChatInput');
  if (inp) {
    inp.value = text;
    handleSendAiMessage();
  }
}

function formatAiMarkdown(text) {
  if (!text) return '';
  var html = text;

  // Escape HTML tags
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<strong style="font-size:13.5px;color:#1e3a8a;display:block;margin:6px 0 4px">$1</strong>');
  html = html.replace(/^## (.*$)/gim, '<strong style="font-size:14px;color:#0f172a;display:block;margin:8px 0 4px">$1</strong>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Markdown Tables
  if (html.indexOf('|') >= 0) {
    var lines = html.split('\n');
    var inTable = false;
    var tableHtml = '';
    var newLines = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (line.indexOf('---') >= 0) continue; // skip separator row
        var cells = line.split('|').filter(function(c, idx, arr) { return idx > 0 && idx < arr.length - 1; });
        if (!inTable) {
          inTable = true;
          tableHtml = '<table><thead><tr>';
          cells.forEach(function(c) { tableHtml += '<th>' + c.trim() + '</th>'; });
          tableHtml += '</tr></thead><tbody>';
        } else {
          tableHtml += '<tr>';
          cells.forEach(function(c) { tableHtml += '<td>' + c.trim() + '</td>'; });
          tableHtml += '</tr>';
        }
      } else {
        if (inTable) {
          tableHtml += '</tbody></table>';
          newLines.push(tableHtml);
          inTable = false;
        }
        newLines.push(line);
      }
    }
    if (inTable) {
      tableHtml += '</tbody></table>';
      newLines.push(tableHtml);
    }
    html = newLines.join('\n');
  }

  // Bullet points
  html = html.replace(/^\* (.*$)/gim, '<li style="margin-left:14px">$1</li>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

function handleSendAiMessage(e) {
  if (e && e.preventDefault) e.preventDefault();
  var inp = document.getElementById('aiChatInput');
  if (!inp) return;
  var msg = inp.value.trim();
  if (!msg) return;

  var body = document.getElementById('aiChatBody');
  if (!body) return;

  // Append user message
  var userDiv = document.createElement('div');
  userDiv.className = 'ai-msg user';
  userDiv.innerHTML = '<div class="ai-msg-bubble">' + esc(msg) + '</div>';
  body.appendChild(userDiv);
  inp.value = '';

  // Append typing indicator
  var typingDiv = document.createElement('div');
  typingDiv.className = 'ai-typing';
  typingDiv.id = 'aiTypingIndicator';
  typingDiv.innerHTML = '<div class="ai-typing-dot"></div><div class="ai-typing-dot"></div><div class="ai-typing-dot"></div>';
  body.appendChild(typingDiv);
  body.scrollTop = body.scrollHeight;

  // Call API
  callApi('askAiAssistant', {
    message: msg,
    period: State.period,
    user: State.currentUser
  })
  .then(function(r) {
    var indicator = document.getElementById('aiTypingIndicator');
    if (indicator) indicator.remove();

    var botDiv = document.createElement('div');
    botDiv.className = 'ai-msg bot';
    var replyHtml = formatAiMarkdown(r.reply || 'ขออภัยครับ ไม่สามารถประมวลผลคำตอบได้ในขณะนี้');
    botDiv.innerHTML = '<div class="ai-avatar" style="width:28px;height:28px;font-size:14px;background:#e0e7ff;color:#4338ca"><i class="fa-solid fa-robot"></i></div>' +
      '<div class="ai-msg-bubble">' + replyHtml + '</div>';
    body.appendChild(botDiv);
    body.scrollTop = body.scrollHeight;
  })
  .catch(function(err) {
    var indicator = document.getElementById('aiTypingIndicator');
    if (indicator) indicator.remove();

    var botDiv = document.createElement('div');
    botDiv.className = 'ai-msg bot';
    botDiv.innerHTML = '<div class="ai-avatar" style="width:28px;height:28px;font-size:14px;background:#fee2e2;color:#dc2626"><i class="fa-solid fa-triangle-exclamation"></i></div>' +
      '<div class="ai-msg-bubble" style="color:#dc2626">เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + esc(err.message) + '</div>';
    body.appendChild(botDiv);
    body.scrollTop = body.scrollHeight;
  });
}


// ==============================================================================
// TTB BANK PAYROLL EXPORT & 50 TWI TAX CERTIFICATE
// ==============================================================================

// Bank Code Mapping Table for Thai Banks
var THAI_BANK_CODES = {
  'ttb': '011',
  'tmb': '011',
  'ทหารไทย': '011',
  'ธนชาต': '011',
  'ทหารไทยธนชาต': '011',
  'kbank': '004',
  'กสิกร': '004',
  'กสิกรไทย': '004',
  'scb': '014',
  'ไทยพาณิชย์': '014',
  'bbl': '002',
  'กรุงเทพ': '002',
  'ktb': '006',
  'กรุงไทย': '006',
  'bay': '025',
  'krungsri': '025',
  'กรุงศรี': '025',
  'gsb': '030',
  'ออมสิน': '030',
  'baac': '034',
  'ธกส': '034'
};

function getBankCode(bankName) {
  if (!bankName) return '011'; // default to TTB
  var clean = bankName.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
  for (var key in THAI_BANK_CODES) {
    if (clean.indexOf(key) >= 0) return THAI_BANK_CODES[key];
  }
  return '011';
}

function exportTtbPayrollCsv() {
  if (!hasPermission('view_salary') || !hasPermission('export_csv')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์โอนเงินเดือน', 'warning');
    return;
  }
  if (!State.payrollList || State.payrollList.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var csv = '\uFEFF';
  // Official ttb business one CSV Headers
  csv += 'Receiving Bank Code,Account Number,Beneficiary Name,Transfer Amount,Citizen ID,Remark,Charge Type\n';

  var periodText = 'เงินเดือน ' + State.period.replace(/\s+/g, '_');
  State.payrollList.forEach(function(r) {
    var emp = State.employees.find(function(e) { return e.empId === r.empId; }) || {};
    var bankCode = getBankCode(r.bankName || emp.bankName);
    var accNum = String(r.bankAccount || emp.bankAccount || '').replace(/[^0-9]/g, '');
    var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '');
    var netAmt = Number(r.netPay) > 0 ? Number(r.netPay).toFixed(2) : '0.00';

    var line = [
      bankCode,
      accNum,
      '"' + (r.name || '').replace(/"/g, '""') + '"',
      netAmt,
      citizen,
      '"' + periodText + '"',
      'OUR'
    ];
    csv += line.join(',') + '\n';
  });

  var filename = 'TTB_Payroll_' + State.period.replace(/\s+/g, '_') + '.csv';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์โอนเงินเดือน TTB (CSV) สำเร็จ');
}

function exportTtbDirectCreditTxt() {
  if (!hasPermission('view_salary') || !hasPermission('export_csv')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์โอนเงินเดือน', 'warning');
    return;
  }
  if (!State.payrollList || State.payrollList.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var totalAmt = 0;
  var lines = [];
  var d = new Date();
  var dateStr = d.getFullYear().toString() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');

  // Header Record: H
  lines.push('H' + 'PTNPAYROLL'.padEnd(20, ' ') + dateStr + String(State.payrollList.length).padStart(6, '0'));

  // Detail Records: D
  State.payrollList.forEach(function(r, idx) {
    var emp = State.employees.find(function(e) { return e.empId === r.empId; }) || {};
    var bankCode = getBankCode(r.bankName || emp.bankName);
    var accNum = String(r.bankAccount || emp.bankAccount || '').replace(/[^0-9]/g, '').padEnd(15, ' ');
    var netAmtCents = Math.round((Number(r.netPay) || 0) * 100);
    totalAmt += (Number(r.netPay) || 0);
    var amtStr = String(netAmtCents).padStart(12, '0');
    var empName = (r.name || '').padEnd(50, ' ');
    var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '').padEnd(13, ' ');

    lines.push('D' + String(idx+1).padStart(6, '0') + bankCode + accNum + amtStr + citizen + empName);
  });

  // Trailer Record: T
  var totalCents = Math.round(totalAmt * 100);
  lines.push('T' + String(State.payrollList.length).padStart(6, '0') + String(totalCents).padStart(15, '0'));

  var txtContent = lines.join('\r\n');
  var filename = 'TTB_DIRECT_CREDIT_' + State.period.replace(/\s+/g, '_') + '.txt';
  var blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์ TTB Direct Credit (.txt) สำเร็จ');
}

// 50 TWI TAX CERTIFICATE CONTROLLER
function open50TwiModalFromHistory() {
  if (!hasPermission('view_salary')) {
    showToast('คุณไม่มีสิทธิ์เข้าถึงหนังสือรับรองภาษี 50 ทวิ', 'warning');
    return;
  }
  var empId = document.getElementById('histEmpSelect') ? document.getElementById('histEmpSelect').value : '';
  if (!empId) {
    showToast('กรุณาเลือกพนักงานที่ต้องการพิมพ์ใบ 50 ทวิ', 'warning');
    return;
  }
  var yrSel = document.getElementById('histYearSelect');
  var yr = yrSel ? yrSel.value : '';
  if (!yr || yr === 'ALL') {
    yr = String(new Date().getFullYear() + 543);
  }

  showToast('กำลังเตรียมเอกสาร 50 ทวิ ของ ' + empId + '...', 'info');
  callApi('get50TwiData', { empId: empId, year: yr })
    .then(function(r) {
      if (!r.success) {
        showToast(r.message || 'ไม่พบข้อมูล 50 ทวิ', 'error');
        return;
      }
      var c = r.company || {};
      var e = r.employee || {};
      var t = r.totals || {};

      document.getElementById('twiYearDisplay').textContent = r.year;
      document.getElementById('twiCompName').textContent = c.name;
      document.getElementById('twiCompTax').textContent = c.taxId;
      document.getElementById('twiCompAddr').textContent = c.address;

      document.getElementById('twiEmpName').textContent = e.fullName;
      document.getElementById('twiEmpId').textContent = e.empId;
      document.getElementById('twiEmpCitizen').textContent = e.citizenId || '-';
      document.getElementById('twiEmpAddr').textContent = e.address || '-';
      document.getElementById('twiEmpDeptPos').textContent = (e.department || '-') + ' / ' + (e.position || '-');

      document.getElementById('twiTableGross').textContent = fmt(t.totalGross);
      document.getElementById('twiTableTax').textContent = fmt(t.totalTax);
      document.getElementById('twiTotalGross').textContent = fmt(t.totalGross);
      document.getElementById('twiTotalTax').textContent = fmt(t.totalTax);
      document.getElementById('twiTotalSso').textContent = fmt(t.totalSso);
      document.getElementById('twiTotalPf').textContent = fmt(t.totalPf);

      var d = new Date();
      var thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      document.getElementById('twiIssueDate').textContent = d.getDate() + ' ' + thaiMonths[d.getMonth()] + ' ' + (d.getFullYear() + 543);

      openModal('twi50Modal');
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

function print50TwiDocument() {
  clearAllPrintClasses();
  document.body.classList.add('printing-50twi');

  setTimeout(function() {
    window.print();
    setTimeout(clearAllPrintClasses, 1500);
  }, 50);
}

// AUDIT TRAIL MODAL CONTROLLER
function openActivityLogModal() {
  showToast('กำลังโหลดบันทึกประวัติการใช้งาน...', 'info');
  callApi('getActivityLogs')
    .then(function(r) {
      var tbody = document.getElementById('activityLogTableBody');
      if (!tbody) return;
      var logs = r.logs || [];
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:20px">ยังไม่มีบันทึกประวัติการใช้งาน</td></tr>';
      } else {
        var h = '';
        logs.forEach(function(l) {
          var actionBadgeClass = 'blue';
          if (l.action === 'LOGIN') actionBadgeClass = 'green';
          else if (l.action === 'PERIOD_CLOSE') actionBadgeClass = 'red';
          else if (l.action === 'USER_SAVE') actionBadgeClass = 'purple';

          h += '<tr>' +
            '<td class="font-mono text-muted" style="font-size:11px">' + esc(l.timestamp) + '</td>' +
            '<td class="font-bold">' + esc(l.username) + '</td>' +
            '<td><span class="period-pill" style="font-size:10.5px">' + esc(l.action) + '</span></td>' +
            '<td>' + esc(l.details) + '</td>' +
          '</tr>';
        });
        tbody.innerHTML = h;
      }
      openModal('activityLogModal');
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}


// ==============================================================================
// MONTHLY PAYROLL SUMMARY SIGN-OFF SHEET CONTROLLER
// ==============================================================================
function openMonthlyPayrollSummaryModal() {
  if (!hasPermission('view_salary')) {
    showToast('คุณไม่มีสิทธิ์ดูใบสรุปยอดเงินเดือน', 'warning');
    return;
  }
  if (!State.payrollList || State.payrollList.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  var compAddr = State.company.address || '';
  if (document.getElementById('signoffCompName')) document.getElementById('signoffCompName').textContent = compName;
  if (document.getElementById('signoffCompAddr')) document.getElementById('signoffCompAddr').textContent = compAddr ? 'ที่อยู่: ' + compAddr : '';
  if (document.getElementById('signoffPeriodDisplay')) document.getElementById('signoffPeriodDisplay').textContent = State.period;

  var tbody = document.getElementById('signoffTableBody');
  var tfoot = document.getElementById('signoffTableFoot');
  if (!tbody) return;

  var sumBase = 0, sumOt = 0, sumAllow = 0, sumBonus = 0, sumLeaveDed = 0;
  var sumGross = 0, sumSso = 0, sumPf = 0, sumTax = 0, sumOtherDed = 0, sumTotDed = 0, sumNet = 0;

  var h = '';
  State.payrollList.forEach(function(r, idx) {
    var base = Number(r.baseSalary) || 0;
    var ot = Number(r.otPay) || 0;
    var allow = Number(r.allowance) || 0;
    var bon = Number(r.bonus) || 0;
    var lDed = Number(r.leaveDeduction) || 0;
    var grs = Number(r.grossPay) || 0;
    var sso = Number(r.sso) || 0;
    var pf = Number(r.pf) || 0;
    var tax = Number(r.tax) || 0;
    var othDed = (Number(r.advanceDeduct) || 0) + (Number(r.otherDeduct) || 0);
    var totDed = Number(r.totalDeductions) || 0;
    var net = Number(r.netPay) || 0;

    sumBase += base; sumOt += ot; sumAllow += allow; sumBonus += bon; sumLeaveDed += lDed;
    sumGross += grs; sumSso += sso; sumPf += pf; sumTax += tax; sumOtherDed += othDed; sumTotDed += totDed; sumNet += net;

    var emp = State.employees.find(function(e) { return e.empId === r.empId; }) || {};
    var bankInfo = (r.bankName || emp.bankName || '-') + ' ' + (r.bankAccount || emp.bankAccount || '-');

    h += '<tr style="border-bottom:1px solid #e2e8f0">' +
      '<td style="padding:4px 3px;text-align:center">' + (idx + 1) + '</td>' +
      '<td style="padding:4px 3px;font-family:monospace;font-weight:700">' + esc(r.empId) + '</td>' +
      '<td style="padding:4px 3px;font-weight:700">' + esc(r.name) + '</td>' +
      '<td style="padding:4px 3px">' + esc(r.department || '-') + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace">' + fmt(base) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace">' + fmt(ot) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace">' + fmt(allow) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace">' + fmt(bon) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace;color:#dc2626">' + fmt(lDed) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace;font-weight:700">' + fmt(grs) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace;color:#dc2626">' + fmt(sso) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace;color:#2563eb">' + fmt(pf) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace">' + fmt(tax) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace;color:#dc2626">' + fmt(othDed) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace;font-weight:700;color:#dc2626">' + fmt(totDed) + '</td>' +
      '<td style="padding:4px 3px;text-align:right;font-family:monospace;font-weight:700;color:#15803d">' + fmt(net) + '</td>' +
      '<td style="padding:4px 3px;font-size:10px;color:#475569">' + esc(bankInfo) + '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;

  if (tfoot) {
    tfoot.innerHTML = '<tr style="background:#f1f5f9;font-weight:700;border-top:2px solid #0f172a;border-bottom:2px solid #0f172a">' +
      '<td colspan="4" style="padding:6px 3px;text-align:center">รวมยอดทั้งสิ้น (' + State.payrollList.length + ' คน)</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace">' + fmt(sumBase) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace">' + fmt(sumOt) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace">' + fmt(sumAllow) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace">' + fmt(sumBonus) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace;color:#dc2626">' + fmt(sumLeaveDed) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace">' + fmt(sumGross) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace;color:#dc2626">' + fmt(sumSso) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace;color:#2563eb">' + fmt(sumPf) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace">' + fmt(sumTax) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace;color:#dc2626">' + fmt(sumOtherDed) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace;color:#dc2626">' + fmt(sumTotDed) + '</td>' +
      '<td style="padding:6px 3px;text-align:right;font-family:monospace;color:#15803d">' + fmt(sumNet) + '</td>' +
      '<td></td>' +
    '</tr>';
  }

  openModal('payrollSignoffModal');
}

function printMonthlyPayrollSummaryDocument() {
  clearAllPrintClasses();
  document.body.classList.add('printing-payroll-summary');

  setTimeout(function() {
    window.print();
    setTimeout(clearAllPrintClasses, 1500);
  }, 50);
}

function printMonthlyPayrollSummary() {
  openMonthlyPayrollSummaryModal();
}

// ==============================================================================
// ATTENDANCE BATCH IMPORT CONTROLLER
// ==============================================================================
var parsedAttendanceRecords = [];

function openImportAttendanceModal() {
  if (!hasPermission('edit_inputs')) {
    showToast('คุณไม่มีสิทธิ์นำเข้าข้อมูลเวลาทำงาน', 'warning');
    return;
  }
  parsedAttendanceRecords = [];
  var fileInp = document.getElementById('attendanceFileInput');
  if (fileInp) fileInp.value = '';
  var prevArea = document.getElementById('attendanceImportPreviewArea');
  if (prevArea) prevArea.style.display = 'none';
  var btnConfirm = document.getElementById('btnConfirmImportAttendance');
  if (btnConfirm) btnConfirm.style.display = 'none';
  openModal('importAttendanceModal');
}

function downloadAttendanceTemplateCsv() {
  var csv = '\uFEFF';
  csv += 'รหัสพนักงาน,ชื่อ-นามสกุล,แผนก,ขาด(วัน),ลากิจ(วัน),ลาป่วย(วัน),หักสาย(บาท),ชั่วโมงOT,เบี้ยขยัน\n';

  var emps = State.employees.filter(function(e) { return e.status !== 'Resigned'; });
  (State.employees || []).forEach(function(e) {
    csv += [
      e.empId,
      '"' + (e.fullName || '').replace(/"/g, '""') + '"',
      '"' + (e.department || '').replace(/"/g, '""') + '"',
      '0', '0', '0', '0', '0', '0'
    ].join(',') + '\n';
  });

  var filename = 'Attendance_Template_' + State.period.replace(/\s+/g, '_') + '.csv';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์แม่แบบเวลาทำงานสำเร็จ');
}

function handleAttendanceFileSelected(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(evt) {
    try {
      var text = evt.target.result;
      parseAttendanceCsvText(text);
    } catch(err) {
      showToast('ไม่สามารถอ่านไฟล์ได้: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function parseAttendanceCsvText(text) {
  var lines = text.split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
  if (lines.length <= 1) {
    showToast('ไฟล์ไม่มีข้อมูล', 'warning');
    return;
  }

  parsedAttendanceRecords = [];
  var tbody = document.getElementById('attendanceImportPreviewBody');
  if (!tbody) return;

  var h = '';
  // Skip header line
  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(',').map(function(c) { return c.trim().replace(/^["']|["']$/g, ''); });
    if (cols.length < 2) continue;

    var empId = cols[0];
    var empMatch = State.employees.find(function(e) { return e.empId === empId; }) || {};
    var empName = cols[1] || empMatch.fullName || empId;
    var abs = Number(cols[3]) || 0;
    var lev = Number(cols[4]) || 0;
    var sck = Number(cols[5]) || 0;
    var late = Number(cols[6]) || 0;
    var otH = Number(cols[7]) || 0;
    var allow = Number(cols[8]) || 0;

    parsedAttendanceRecords.push({
      empId: empId,
      empName: empName,
      absentDays: abs,
      leaveDays: lev,
      sickLeaveDays: sck,
      lateDeduct: late,
      otHours: otH,
      allowance: allow
    });

    h += '<tr>' +
      '<td class="font-mono font-bold">' + esc(empId) + '</td>' +
      '<td>' + esc(empName) + '</td>' +
      '<td class="text-right font-mono text-red">' + abs + '</td>' +
      '<td class="text-right font-mono">' + lev + '</td>' +
      '<td class="text-right font-mono text-red">' + sck + '</td>' +
      '<td class="text-right font-mono text-red">' + fmt(late) + '</td>' +
      '<td class="text-right font-mono text-blue font-bold">' + otH + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(allow) + '</td>' +
    '</tr>';
  }

  tbody.innerHTML = h;
  if (document.getElementById('importPreviewCount')) document.getElementById('importPreviewCount').textContent = parsedAttendanceRecords.length;
  if (document.getElementById('importPreviewPeriod')) document.getElementById('importPreviewPeriod').textContent = State.period;

  var prevArea = document.getElementById('attendanceImportPreviewArea');
  if (prevArea) prevArea.style.display = 'block';
  var btnConfirm = document.getElementById('btnConfirmImportAttendance');
  if (btnConfirm) btnConfirm.style.display = 'inline-flex';

  showToast('อ่านข้อมูลสำเร็จ ' + parsedAttendanceRecords.length + ' รายการ กรุณาตรวจสอบก่อนกดยืนยัน', 'info');
}

function confirmImportAttendance() {
  if (parsedAttendanceRecords.length === 0) {
    showToast('ไม่มีข้อมูลที่พร้อมนำเข้า', 'warning');
    return;
  }

  showToast('กำลังนำเข้าข้อมูลและคำนวณเงินเดือน...', 'info');
  callApi('importAttendanceBatch', {
    period: State.period,
    records: parsedAttendanceRecords,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
  .then(function(r) {
    if (!r.success) {
      showToast(r.message || 'เกิดข้อผิดพลาดในการนำเข้า', 'error');
      return;
    }
    showToast(r.message, 'success');
    closeModal('importAttendanceModal');
    loadCurrentPeriodInputs();
    runPayrollRecalc();
  })
  .catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// ==============================================================================
// SESSION TIMEOUT CONTROLLER (AUTO-LOGOUT 30 MINS)
// ==============================================================================
var idleTimer = null;
var IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  if (!State.currentUser || !State.currentUser.username) return;

  idleTimer = setTimeout(function() {
    if (State.currentUser && State.currentUser.username) {
      handleLogout();
      showToast('⚠️ คุณไม่ได้ใช้งานระบบเกิน 30 นาที ระบบได้ทำการล็อกเอาต์อัตโนมัติเพื่อความปลอดภัย', 'warning');
    }
  }, IDLE_TIMEOUT_MS);
}

['mousemove', 'keydown', 'touchstart', 'click', 'scroll'].forEach(function(evt) {
  window.addEventListener(evt, resetIdleTimer, { passive: true });
});


// ==============================================================================
// PROBATION MANAGEMENT CONTROLLER (V5.5)
// ==============================================================================
function getProbationDaysRemaining(emp) {
  if (!emp) return null;
  var endDateStr = emp.probationEndDate;
  if (!endDateStr && emp.joinDate) {
    var probDays = Number(emp.probationDays) || 119;
    var jd = new Date(emp.joinDate);
    jd.setDate(jd.getDate() + probDays);
    endDateStr = jd.toISOString().substring(0, 10);
  }
  if (!endDateStr) return null;

  var today = new Date();
  today.setHours(0,0,0,0);
  var target = new Date(endDateStr);
  target.setHours(0,0,0,0);
  var diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function onEmployeeStatusChanged() {
  var st = document.getElementById('mStatus') ? document.getElementById('mStatus').value : 'Active';
  var sec = document.getElementById('probationConfigSection');
  if (sec) {
    sec.style.display = (st === 'Probation') ? 'block' : 'none';
  }
  if (st === 'Probation') {
    calculateProbationEndDate();
  }
}

function calculateProbationEndDate() {
  var joinDateVal = document.getElementById('mJoinDate') ? document.getElementById('mJoinDate').value : '';
  var daysVal = document.getElementById('mProbationDays') ? Number(document.getElementById('mProbationDays').value) : 119;
  var endInp = document.getElementById('mProbationEndDate');
  var txt = document.getElementById('mProbationCountdownText');

  if (!joinDateVal) {
    if (endInp) endInp.value = '';
    if (txt) txt.textContent = 'กรุณาระบุวันเริ่มงาน';
    return;
  }

  var jd = new Date(joinDateVal);
  if (isNaN(jd.getTime())) return;

  jd.setDate(jd.getDate() + daysVal);
  var endIso = jd.toISOString().substring(0, 10);
  if (endInp) endInp.value = endIso;

  var today = new Date();
  today.setHours(0,0,0,0);
  jd.setHours(0,0,0,0);
  var diffDays = Math.ceil((jd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (txt) {
    if (diffDays > 0) {
      txt.innerHTML = '<span style="color:#c2410c">⏳ เหลือเวลาอีก <strong>' + diffDays + ' วัน</strong></span>';
    } else if (diffDays === 0) {
      txt.innerHTML = '<span style="color:#b91c1c;font-weight:700">🚨 ครบกำหนดวันนี้!</span>';
    } else {
      txt.innerHTML = '<span style="color:#b91c1c">⚠️ เกินกำหนดแล้ว ' + Math.abs(diffDays) + ' วัน</span>';
    }
  }
}

function passProbation(empId) {
  if (!empId) return;
  var emp = State.employees.find(function(e) { return e.empId === empId; }) || {};
  var name = emp.fullName || empId;

  if (!confirm('ยืนยันอนุมัติให้ ' + name + ' (' + empId + ') ผ่านการทดลองงาน ปรับเป็นพนักงานประจำใช่หรือไม่?')) {
    return;
  }

  showToast('กำลังปรับสถานะผ่านทดลองงาน...', 'info');
  callApi('passProbation', {
    empId: empId,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
  .then(function(r) {
    if (!r.success) {
      showToast(r.message || 'ไม่สามารถปรับสถานะได้', 'error');
      return;
    }
    showToast(r.message, 'success');
    loadAppData();
  })
  .catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

function updateProbationDashboardAlerts() {
  var banner = document.getElementById('probationAlertBanner');
  var listDiv = document.getElementById('probationAlertList');
  var countSpan = document.getElementById('probationAlertCount');
  if (!banner || !listDiv) return;

  var probEmps = (State.employees || []).filter(function(e) {
    return e.status === 'Probation';
  });

  if (probEmps.length === 0) {
    banner.style.display = 'none';
    return;
  }

  if (countSpan) countSpan.textContent = probEmps.length;
  var h = '';
  probEmps.forEach(function(e) {
    var daysLeft = getProbationDaysRemaining(e);
    var statusText = daysLeft !== null ? (daysLeft > 0 ? ('เหลืออีก ' + daysLeft + ' วัน') : 'ครบกำหนดแล้ว') : 'ช่วงทดลองงาน';
    var isUrgent = daysLeft !== null && daysLeft <= 30;

    h += '<div style="background:#ffffff;border:1.5px solid ' + (isUrgent ? '#fca5a5' : '#fed7aa') + ';border-radius:var(--radius-md);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<div>' +
        '<div style="font-weight:700;font-size:12.5px;color:#0f172a">' + esc(e.fullName) + ' [' + esc(e.empId) + ']</div>' +
        '<div style="font-size:11px;color:#64748b">' + esc(e.department || '-') + ' / ' + esc(e.position || '-') + ' | เริ่มงาน: ' + esc(e.joinDate || '-') + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<span class="period-pill" style="background:' + (isUrgent ? '#fee2e2' : '#ffedd5') + ';color:' + (isUrgent ? '#b91c1c' : '#c2410c') + ';font-weight:700;font-size:11px">' + statusText + '</span>' +
        '<button type="button" class="btn btn-success btn-sm" onclick="passProbation(\'' + esc(e.empId) + '\')" title="อนุมัติผ่านโปร ปรับเป็นพนักงานประจำ">' +
          '<i class="fa-solid fa-check"></i> ผ่านโปร' +
        '</button>' +
      '</div>' +
    '</div>';
  });

  listDiv.innerHTML = h;
  banner.style.display = 'block';
}


// ==========================================================================
// ANALYTICS & EXECUTIVE DECISION HUB MODULE (V6.5)
// ==========================================================================
var analyticsTrendChartInstance = null;
var analyticsDeptChartInstance = null;
var analyticsOtBarChartInstance = null;
var cachedAllHistoryData = null;
var cachedAnalyticsBranches = [];
var cachedAdvanceStats = [];
var cachedCurrentMatrixData = [];
var currentAnalyticsCategory = 'ALL';

var THAI_MONTHS_NAMES = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function periodMatchesYear(period, yr) {
  if (!period || !yr || yr === 'ALL') return true;
  var p = String(period).trim();
  var y = String(yr).trim();
  if (p.indexOf(y) >= 0) return true;
  var n = Number(y);
  if (!isNaN(n)) {
    if (n > 2400) {
      var ce = String(n - 543);
      if (p.indexOf(ce) >= 0) return true;
    } else {
      var be = String(n + 543);
      if (p.indexOf(be) >= 0) return true;
    }
  }
  return false;
}

function getMonthIndexFromPeriod(period) {
  if (!period) return -1;
  var p = String(period).trim();
  for (var i = 0; i < THAI_MONTHS_NAMES.length; i++) {
    if (p.indexOf(THAI_MONTHS_NAMES[i]) >= 0) {
      return i;
    }
  }
  if (p.indexOf('-') > 0) {
    var parts = p.split('-');
    if (parts.length >= 2) {
      var m = parseInt(parts[1], 10);
      if (!isNaN(m) && m >= 1 && m <= 12) return m - 1;
    }
  }
  return -1;
}

function initAnalyticsYearDropdown() {
  var sel = document.getElementById('analyticsYearSelect');
  if (!sel) return;

  var curYear = new Date().getFullYear() + 543;
  var yearsSet = {};
  yearsSet[curYear] = true;
  yearsSet[curYear - 1] = true;

  if (cachedAllHistoryData) {
    cachedAllHistoryData.forEach(function(r) {
      if (r.period) {
        var m = r.period.match(/\d{4}/);
        if (m) yearsSet[m[0]] = true;
      }
    });
  }
  if (State.period) {
    var m2 = State.period.match(/\d{4}/);
    if (m2) yearsSet[m2[0]] = true;
  }

  var sortedYears = Object.keys(yearsSet).sort().reverse();
  var curVal = sel.value;
  var h = '';
  sortedYears.forEach(function(y) {
    var num = Number(y);
    var label = (num > 2400) ? (y + ' (' + (num - 543) + ')') : (y + ' (' + (num + 543) + ')');
    h += '<option value="' + y + '">' + label + '</option>';
  });
  h += '<option value="ALL">ทุกปีสะสม (All Years)</option>';
  sel.innerHTML = h;
  if (curVal && (curVal === 'ALL' || sortedYears.indexOf(curVal) >= 0)) {
    sel.value = curVal;
  } else if (sortedYears.length > 0) {
    sel.value = sortedYears[0];
  }
}

function renderAnalyticsTab(silent) {
  var isAdmin = Boolean(State.currentUser && (
    String(State.currentUser.username || '').toLowerCase() === 'admin' ||
    String(State.currentUser.role || '').toLowerCase().indexOf('admin') >= 0 ||
    hasPermission('all')
  ));
  if (!isAdmin) {
    var cont = document.getElementById('tab-analytics');
    if (cont) {
      cont.innerHTML = '<div style="padding:60px 20px;text-align:center;color:#64748b;max-width:500px;margin:40px auto;background:#fff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05)">' +
        '<div style="width:64px;height:64px;background:#fee2e2;color:#dc2626;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px"><i class="fa-solid fa-lock"></i></div>' +
        '<h3 style="font-size:18px;font-weight:800;color:#1e293b;margin-bottom:8px">สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin Only)</h3>' +
        '<p style="font-size:13px;color:#64748b;line-height:1.6">ฟีเจอร์การวิเคราะห์ข้อมูลและประเมินผลบุคลากร เปิดให้เข้าถึงได้เฉพาะผู้ดูแลระบบที่มีบทบาท Admin เท่านั้น</p>' +
      '</div>';
    }
    return;
  }

  initAnalyticsYearDropdown();
  loadAnalyticsData(silent);
}

function loadAnalyticsData(silent) {
  var isTabActive = document.getElementById('tab-analytics') && document.getElementById('tab-analytics').classList.contains('active');
  if (!silent && isTabActive) {
    showToast('กำลังประมวลผลข้อมูลสถิติและการวิเคราะห์...', 'info');
  }

  callApi('getAllEmployeeHistory')
    .then(function(r) {
      if (!r.success || !r.allHistory) {
        if (isTabActive) showToast(r.message || 'ไม่สามารถโหลดข้อมูลประวัติได้', 'error');
        return;
      }

      var combined = (r.allHistory || []).slice();

      // Ensure current State.period / State.payrollList is integrated if not already in DB
      if (State.period && State.payrollList && State.payrollList.length > 0) {
        var hasCurrentPeriod = combined.some(function(x) { return x.period === State.period; });
        if (!hasCurrentPeriod) {
          State.payrollList.forEach(function(p) {
            var inp = (State.inputs || {})[p.empId] || {};
            combined.push({
              period: State.period,
              empId: p.empId,
              fullName: p.fullName || '',
              nickname: p.nickname || '',
              department: p.department || '',
              position: p.position || '',
              baseSalary: Number(p.baseSalary) || 0,
              absentDays: Number(inp.absentDays) || 0,
              leaveDays: Number(inp.leaveDays) || 0,
              sickLeaveDays: Number(inp.sickLeaveDays) || 0,
              lateDeduct: Number(inp.lateDeduct) || 0,
              otHours: Number(p.otHours) || 0,
              otRate: Number(p.otRate) || 40,
              otPay: Number(p.otPay) || 0,
              allowance: Number(p.allowance) || 0,
              bonus: Number(p.bonus) || 0,
              leaveDeduction: Number(p.leaveDeduction) || 0,
              grossPay: Number(p.grossPay) || 0,
              sso: Number(p.sso) || 0,
              pf: Number(p.pf) || 0,
              tax: Number(p.tax) || 0,
              advanceDeduct: Number(p.advanceDeduct) || 0,
              otherDeduct: Number(p.otherDeduct) || 0,
              totalDeductions: Number(p.totalDeductions) || 0,
              netPay: Number(p.netPay) || 0
            });
          });
        }
      }

      cachedAllHistoryData = combined;
      cachedAnalyticsBranches = r.branches || [];
      cachedAdvanceStats = r.advanceStats || [];
      initAnalyticsYearDropdown();
      updateAnalyticsBranchDropdown(cachedAllHistoryData, cachedAnalyticsBranches);
      updateAnalyticsDepartmentDropdown(cachedAllHistoryData);
      computeAndRenderAnalytics();
    })
    .catch(function(err) {
      if (isTabActive) showToast('Error: ' + err.message, 'error');
    });
}

function getBranchName(branchId) {
  if (!branchId) return 'สำนักงานใหญ่ (B01)';
  var bList = cachedAnalyticsBranches && cachedAnalyticsBranches.length > 0 ? cachedAnalyticsBranches : (State.branches || []);
  var found = bList.find(function(b) { return b.id === branchId || b.code === branchId; });
  if (found) return (found.name || branchId) + ' (' + (found.id || branchId) + ')';
  if (branchId === 'B01') return 'สำนักงานใหญ่ (B01)';
  if (branchId === 'B02') return 'สาขา 2 (B02)';
  return 'สาขา ' + branchId;
}

function updateAnalyticsBranchDropdown(list, branches) {
  var sel = document.getElementById('analyticsBranchSelect');
  if (!sel) return;
  var curVal = sel.value || 'ALL';
  var branchMap = {};

  (branches || State.branches || []).forEach(function(b) {
    if (b.id) branchMap[b.id] = b.name ? (b.name + ' (' + b.id + ')') : b.id;
  });
  (State.employees || []).forEach(function(e) {
    var bid = e.branch_id || e.branchId;
    if (bid && !branchMap[bid]) {
      branchMap[bid] = getBranchName(bid);
    }
  });
  (list || []).forEach(function(x) {
    var bid = x.branchId || x.branch_id;
    if (bid && !branchMap[bid]) {
      branchMap[bid] = getBranchName(bid);
    }
  });

  if (Object.keys(branchMap).length === 0) {
    branchMap['B01'] = 'สำนักงานใหญ่ (B01)';
  }

  var h = '<option value="ALL">🏢 ทุกสาขา (All Branches)</option>';
  Object.keys(branchMap).sort().forEach(function(bid) {
    h += '<option value="' + esc(bid) + '">' + esc(branchMap[bid]) + '</option>';
  });
  sel.innerHTML = h;
  if (branchMap[curVal]) {
    sel.value = curVal;
  } else {
    sel.value = 'ALL';
  }
}

function updateAnalyticsDepartmentDropdown(list) {
  var sel = document.getElementById('analyticsDeptSelect');
  if (!sel) return;
  var curVal = sel.value || 'ALL';
  var depts = {};
  (list || []).forEach(function(x) {
    if (x.department && x.department.trim()) depts[x.department.trim()] = true;
  });
  (State.employees || []).forEach(function(e) {
    if (e.department && e.department.trim()) depts[e.department.trim()] = true;
  });
  var h = '<option value="ALL">ทุกแผนก (All)</option>';
  Object.keys(depts).sort().forEach(function(d) {
    h += '<option value="' + esc(d) + '">' + esc(d) + '</option>';
  });
  sel.innerHTML = h;
  if (depts[curVal]) {
    sel.value = curVal;
  } else {
    sel.value = 'ALL';
  }
}

function onAnalyticsFilterChanged() {
  computeAndRenderAnalytics();
}

function computeAndRenderAnalytics() {
  if (!cachedAllHistoryData) return;

  var yrSel = document.getElementById('analyticsYearSelect');
  var branchSel = document.getElementById('analyticsBranchSelect');
  var deptSel = document.getElementById('analyticsDeptSelect');
  var selYear = yrSel ? yrSel.value : '';
  var selBranch = branchSel ? branchSel.value : 'ALL';
  var selDept = deptSel ? deptSel.value : 'ALL';

  var list = cachedAllHistoryData;
  if (selYear && selYear !== 'ALL') {
    list = list.filter(function(item) {
      return periodMatchesYear(item.period, selYear);
    });
  }
  if (selBranch && selBranch !== 'ALL') {
    list = list.filter(function(item) {
      var b = item.branchId || item.branch_id || 'B01';
      return b === selBranch;
    });
  }
  if (selDept && selDept !== 'ALL') {
    list = list.filter(function(item) {
      return (item.department || '').trim() === selDept.trim();
    });
  }

  var totalGross = 0;
  var totalBase = 0;
  var totalOtPay = 0;
  var totalOtHours = 0;
  var totalPf = 0;
  var totalAbsent = 0;
  var totalLeave = 0;
  var totalSick = 0;
  var totalLateDeduct = 0;
  var countAllowanceEarned = 0;
  var totalPeriodsActive = list.length;

  var monthlyData = [];
  for (var m = 0; m < 12; m++) {
    monthlyData.push({ base: 0, gross: 0, ot: 0, count: 0 });
  }

  var deptGross = {};
  var deptOt = {};
  var branchGross = {};
  var branchOt = {};

  list.forEach(function(r) {
    var g = Number(r.grossPay) || 0;
    var b = Number(r.baseSalary) || 0;
    var otP = Number(r.otPay) || 0;
    var otH = Number(r.otHours) || 0;
    var pf = Number(r.pf) || 0;
    var ab = Number(r.absentDays) || 0;
    var lv = Number(r.leaveDays) || 0;
    var sk = Number(r.sickLeaveDays) || 0;
    var ld = Number(r.lateDeduct) || 0;
    var al = Number(r.allowance) || 0;

    totalGross += g;
    totalBase += b;
    totalOtPay += otP;
    totalOtHours += otH;
    totalPf += pf;
    totalAbsent += ab;
    totalLeave += lv;
    totalSick += sk;
    totalLateDeduct += ld;
    if (al > 0) countAllowanceEarned++;

    var mIdx = getMonthIndexFromPeriod(r.period);
    if (mIdx >= 0 && mIdx < 12) {
      monthlyData[mIdx].base += b;
      monthlyData[mIdx].gross += g;
      monthlyData[mIdx].ot += otP;
      monthlyData[mIdx].count++;
    }

    var d = (r.department || 'ไม่ระบุ').trim();
    deptGross[d] = (deptGross[d] || 0) + g;
    deptOt[d] = (deptOt[d] || 0) + otH;

    var br = r.branchId || r.branch_id || 'B01';
    branchGross[br] = (branchGross[br] || 0) + g;
    branchOt[br] = (branchOt[br] || 0) + otH;
  });

  var totalEmpDays = totalPeriodsActive * 30;
  var attendanceRate = 100;
  if (totalEmpDays > 0) {
    var deductedDays = totalAbsent + totalLeave + totalSick;
    attendanceRate = Math.max(0, Math.min(100, ((totalEmpDays - deductedDays) / totalEmpDays) * 100));
  }

  var activeEmpIds = {};
  list.forEach(function(x) { activeEmpIds[x.empId] = true; });
  var empCount = Object.keys(activeEmpIds).length || 1;
  var avgPeriodsPerEmp = totalPeriodsActive > 0 ? (totalPeriodsActive / empCount) : 1;
  var avgMonthlyGross = totalPeriodsActive > 0 ? (totalGross / (avgPeriodsPerEmp || 1)) : 0;
  var costPerHeadMonthly = empCount > 0 ? (avgMonthlyGross / empCount) : 0;

  var elGrossVal = document.getElementById('kpiGrossVal');
  if (elGrossVal) elGrossVal.textContent = '฿' + fmt(totalGross);
  var elGrossSub = document.getElementById('kpiGrossSub');
  if (elGrossSub) elGrossSub.innerHTML = '<i class="fa-solid fa-circle-info" style="color:var(--primary)"></i> เฉลี่ย ฿' + fmt(avgMonthlyGross) + ' / งวด (รวม ' + empCount + ' คน)';

  var elAttendVal = document.getElementById('kpiAttendVal');
  if (elAttendVal) elAttendVal.textContent = attendanceRate.toFixed(1) + '%';
  var elAttendSub = document.getElementById('kpiAttendSub');
  if (elAttendSub) elAttendSub.innerHTML = '<i class="fa-solid fa-award" style="color:var(--success)"></i> รับเบี้ยขยัน ' + countAllowanceEarned + ' ครั้งสะสม';

  var elOtVal = document.getElementById('kpiOtVal');
  if (elOtVal) elOtVal.textContent = '฿' + fmt(totalOtPay);
  var elOtSub = document.getElementById('kpiOtSub');
  if (elOtSub) elOtSub.innerHTML = '<i class="fa-solid fa-clock" style="color:#7c3aed"></i> รวม ' + totalOtHours.toLocaleString() + ' ชม. (เฉลี่ย ฿' + (totalOtHours > 0 ? (totalOtPay/totalOtHours).toFixed(1) : 0) + '/ชม.)';

  var elCostPerHeadVal = document.getElementById('kpiCostPerHeadVal');
  if (elCostPerHeadVal) elCostPerHeadVal.textContent = '฿' + fmt(costPerHeadMonthly);
  var elCostPerHeadSub = document.getElementById('kpiCostPerHeadSub');
  if (elCostPerHeadSub) elCostPerHeadSub.innerHTML = '<i class="fa-solid fa-user-tag" style="color:#0d9488"></i> ต้นทุนเฉลี่ยต่อคนต่อเดือน (พนักงาน ' + empCount + ' คน)';

  var elPfVal = document.getElementById('kpiPfVal');
  if (elPfVal) elPfVal.textContent = '฿' + fmt(totalPf);
  var elPfSub = document.getElementById('kpiPfSub');
  if (elPfSub) elPfSub.innerHTML = '<i class="fa-solid fa-shield-halved" style="color:#d97706"></i> สะสมทั้งปี (บริษัท + สมาชิก)';

  renderAnalyticsTrendChart(monthlyData);
  renderAnalyticsDeptChart(deptGross);
  renderAnalyticsOtBarChart(deptOt);

  renderAnalyticsLeaderboard(cachedAllHistoryData, selYear, selBranch, selDept);
  renderAnalyticsInsights(totalGross, totalOtPay, totalOtHours, totalLateDeduct, totalAbsent, attendanceRate, deptGross, deptOt, branchGross, branchOt, selBranch, selDept);
  renderAnalyticsEmployeeMatrix(cachedAllHistoryData, selYear, selBranch, selDept);
}

function renderAnalyticsTrendChart(monthlyData) {
  var canvas = document.getElementById('analyticsTrendChart');
  if (!canvas) return;
  if (typeof Chart === 'undefined') { console.warn('Chart.js not loaded'); return; }
  var ctx = canvas.getContext('2d');

  if (analyticsTrendChartInstance) {
    analyticsTrendChartInstance.destroy();
  }

  var monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var baseArr = [];
  var grossArr = [];
  var otArr = [];

  for (var m = 0; m < 12; m++) {
    var d = monthlyData[m] || { base: 0, gross: 0, ot: 0 };
    baseArr.push(d.base);
    grossArr.push(d.gross);
    otArr.push(d.ot);
  }

  analyticsTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthNames,
      datasets: [
        {
          label: 'เงินเดือนฐาน (Base Salary)',
          data: baseArr,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'เงินได้รวม (Gross Pay)',
          data: grossArr,
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.08)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'ค่าล่วงเวลา (OT Pay)',
          data: otArr,
          borderColor: '#7c3aed',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11, family: 'Prompt' } } },
        tooltip: {
          callbacks: {
            label: function(c) {
              return c.dataset.label + ': ฿' + (Number(c.raw) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: function(v) { return '฿' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v); },
            font: { size: 10 }
          },
          grid: { color: 'rgba(0,0,0,0.04)' }
        },
        x: {
          ticks: { font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
}

function renderAnalyticsDeptChart(deptGross) {
  var canvas = document.getElementById('analyticsDeptChart');
  if (!canvas) return;
  if (typeof Chart === 'undefined') return;
  var ctx = canvas.getContext('2d');

  if (analyticsDeptChartInstance) {
    analyticsDeptChartInstance.destroy();
  }

  var labels = Object.keys(deptGross);
  var values = labels.map(function(k) { return deptGross[k]; });

  if (labels.length === 0) {
    labels = ['ไม่มีข้อมูล'];
    values = [0];
  }

  var palette = [
    '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777',
    '#0891b2', '#ea580c', '#4f46e5', '#16a34a', '#ca8a04'
  ];

  analyticsDeptChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: palette.slice(0, labels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10, family: 'Prompt' } } },
        tooltip: {
          callbacks: {
            label: function(c) {
              var val = Number(c.raw) || 0;
              var total = c.dataset.data.reduce(function(a, b) { return a + b; }, 0);
              var pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return c.label + ': ฿' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' (' + pct + '%)';
            }
          }
        }
      },
      cutout: '62%'
    }
  });
}

function renderAnalyticsOtBarChart(deptOt) {
  var canvas = document.getElementById('analyticsOtBarChart');
  if (!canvas) return;
  if (typeof Chart === 'undefined') return;
  var ctx = canvas.getContext('2d');

  if (analyticsOtBarChartInstance) {
    analyticsOtBarChartInstance.destroy();
  }

  var labels = Object.keys(deptOt);
  var values = labels.map(function(k) { return deptOt[k]; });

  if (labels.length === 0) {
    labels = ['ไม่มีข้อมูล'];
    values = [0];
  }

  analyticsOtBarChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'ชั่วโมง OT สะสม (ชม.)',
        data: values,
        backgroundColor: 'rgba(124, 58, 237, 0.75)',
        borderColor: '#7c3aed',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(c) {
              return (Number(c.raw) || 0).toLocaleString() + ' ชั่วโมง';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.04)' }
        },
        x: {
          ticks: { font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
}

function renderAnalyticsLeaderboard(allHistory, selYear, selBranch, selDept) {
  var tbody = document.getElementById('analyticsLeaderboardBody');
  if (!tbody) return;

  var list = allHistory || [];
  if (selYear && selYear !== 'ALL') {
    list = list.filter(function(x) { return periodMatchesYear(x.period, selYear); });
  }
  if (selBranch && selBranch !== 'ALL') {
    list = list.filter(function(x) {
      var b = x.branchId || x.branch_id || 'B01';
      return b === selBranch;
    });
  }
  if (selDept && selDept !== 'ALL') {
    list = list.filter(function(x) { return (x.department || '').trim() === selDept.trim(); });
  }

  var empMap = {};
  list.forEach(function(r) {
    if (!empMap[r.empId]) {
      empMap[r.empId] = {
        empId: r.empId,
        fullName: r.fullName,
        nickname: r.nickname,
        branchId: r.branchId || r.branch_id || 'B01',
        department: r.department,
        totalAllowance: 0,
        totalAbsent: 0,
        totalLateDeduct: 0,
        periods: 0
      };
    }
    empMap[r.empId].totalAllowance += Number(r.allowance) || 0;
    empMap[r.empId].totalAbsent += Number(r.absentDays) || 0;
    empMap[r.empId].totalLateDeduct += Number(r.lateDeduct) || 0;
    empMap[r.empId].periods++;
  });

  var emps = Object.values(empMap);
  emps.sort(function(a, b) {
    if (b.totalAllowance !== a.totalAllowance) return b.totalAllowance - a.totalAllowance;
    if (a.totalAbsent !== b.totalAbsent) return a.totalAbsent - b.totalAbsent;
    return a.totalLateDeduct - b.totalLateDeduct;
  });

  var top5 = emps.slice(0, 5);
  if (top5.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:16px">ไม่มีข้อมูลสถิติ</td></tr>';
    return;
  }

  var h = '';
  top5.forEach(function(e, idx) {
    var rankClass = idx === 0 ? 'top1' : (idx === 1 ? 'top2' : (idx === 2 ? 'top3' : ''));
    var nick = e.nickname ? ' (' + esc(e.nickname) + ')' : '';
    var brName = getBranchName(e.branchId);
    h += '<tr>' +
      '<td><span class="analytics-rank-badge ' + rankClass + '">' + (idx + 1) + '</span></td>' +
      '<td><strong>' + esc(e.fullName) + '</strong><span style="font-size:10.5px;color:#64748b">' + nick + '</span><div style="font-size:10px;color:#6b7280"><i class="fa-solid fa-store" style="color:#0284c7;font-size:9.5px"></i> ' + esc(brName) + '</div></td>' +
      '<td>' + esc(e.department || '-') + '</td>' +
      '<td style="text-align:right;font-family:monospace;font-weight:700;color:var(--success)">฿' + fmt(e.totalAllowance) + '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
}

function renderAnalyticsInsights(totalGross, totalOtPay, totalOtHours, totalLateDeduct, totalAbsent, attendanceRate, deptGross, deptOt, branchGross, branchOt, selBranch, selDept) {
  var container = document.getElementById('analyticsInsightsContainer');
  if (!container) return;

  var otPercent = totalGross > 0 ? (totalOtPay / totalGross * 100) : 0;
  var topOtDept = '';
  var maxOtHours = 0;
  Object.keys(deptOt).forEach(function(k) {
    if (deptOt[k] > maxOtHours) {
      maxOtHours = deptOt[k];
      topOtDept = k;
    }
  });

  var topBranch = '';
  var maxBranchGross = 0;
  Object.keys(branchGross).forEach(function(b) {
    if (branchGross[b] > maxBranchGross) {
      maxBranchGross = branchGross[b];
      topBranch = b;
    }
  });

  // Calculate Advance Request metrics from PTN Time
  var advList = cachedAdvanceStats || [];
  var advTotalAmount = 0;
  var advCount = advList.length;
  var advEmpSet = {};
  advList.forEach(function(a) {
    advTotalAmount += Number(a.amount) || 0;
    if (a.emp_id) advEmpSet[a.emp_id] = true;
  });
  var advEmpCount = Object.keys(advEmpSet).length;

  var h = '';

  // 1. Branch & Dept OT Optimization Insight
  var otImpact = Math.round(totalOtPay * 0.2);
  var branchContext = (topBranch ? ' สาขาหลักที่มีค่าใช้จ่ายสูงสุดคือ ' + getBranchName(topBranch) : '');
  var deptContext = (topOtDept ? ' แผนกที่มีชั่วโมง OT สูงสุดคือ ' + esc(topOtDept) + ' (' + maxOtHours.toLocaleString() + ' ชม.)' : '');

  h += '<div class="insight-card-item orange">' +
    '<div class="insight-card-top">' +
      '<span class="insight-badge orange"><i class="fa-solid fa-store"></i> 🏢 บริหารจัดการสาขา &amp; ค่าล่วงเวลา (OT สะสม ' + otPercent.toFixed(1) + '%)</span>' +
      '<span class="insight-impact orange">โอกาสประหยัด: ~฿' + fmt(otImpact) + '</span>' +
    '</div>' +
    '<p style="font-size:12px;color:#475569;margin-bottom:6px">' +
      '<strong>สรุปวิเคราะห์ข้อมูล:</strong> ' + deptContext + branchContext +
      ' สัดส่วนค่าล่วงเวลาคิดเป็น ' + otPercent.toFixed(1) + '% ของต้นทุนค่าจ้างทั้งหมด ซึ่งมักเกิดจากการเร่งส่งมอบงานช่วงสุดสัปดาห์หรือปลายงวด' +
    '</p>' +
    '<div class="insight-action-box orange">' +
      '<div style="font-weight:700;color:#9a3412;margin-bottom:3px"><i class="fa-solid fa-wrench"></i> ข้อเสนอแนะ &amp; แนวทางแก้ไข (Action Plan):</div>' +
      '<ul style="margin-left:16px;color:#334155;line-height:1.5;font-size:11.5px">' +
        '<li><strong>ปรับรอบงานและเวลาตัดรอบ (Shift Scheduling):</strong> ปรับขยับเวลาเตรียมสินค้า/เบิกจ่ายให้เร็วขึ้น 1 ชม. ลดการค้างคาของงานช่วงเย็น</li>' +
        '<li><strong>เสริมอัตราจ้างพาร์ทไทม์ช่วงพีค:</strong> พิจารณาจ้างพนักงานรายวันเฉพาะวันศุกร์-เสาร์ จะช่วยประหยัดต้นทุน OT รายชั่วโมงได้ถึง 20-25%</li>' +
        '<li><strong>กระจายภาระงานระหว่างสาขา:</strong> ใช้ข้อมูลเปรียบเทียบข้ามสาขาเพื่อโยกย้ายกำลังคนชั่วคราวแทนการอนุมัติ OT ต่อเนื่อง</li>' +
      '</ul>' +
    '</div>' +
  '</div>';

  // 2. Attendance Discipline & Emergency Advances (PTN Time Integration)
  var advSubText = advCount > 0 ? (' มีคำขอเบิกเงินฉุกเฉินผ่านระบบ PTN Time จำนวน ' + advCount + ' รายการ (พนักงาน ' + advEmpCount + ' คน รวม ฿' + fmt(advTotalAmount) + ')') : ' ไม่มีรายการขอเบิกเงินฉุกเฉินค้างในงวด';
  h += '<div class="insight-card-item pink">' +
    '<div class="insight-card-top">' +
      '<span class="insight-badge pink"><i class="fa-solid fa-stopwatch"></i> ⏱️ วินัยเวลาทำงาน &amp; ขอเบิกเงินฉุกเฉิน (PTN Time)</span>' +
      '<span class="insight-impact pink">หักสายสะสม: ฿' + fmt(totalLateDeduct) + '</span>' +
    '</div>' +
    '<p style="font-size:12px;color:#475569;margin-bottom:6px">' +
      '<strong>สรุปวิเคราะห์ข้อมูล:</strong> พบสถิติขาดงานสะสม ' + totalAbsent + ' วัน และหักเงินมาสาย ฿' + fmt(totalLateDeduct) + ' บาท' + advSubText + ' ซึ่งสะท้อนทั้งวินัยการทำงานและสภาพคล่องทางการเงินของพนักงาน' +
    '</p>' +
    '<div class="insight-action-box pink">' +
      '<div style="font-weight:700;color:#831843;margin-bottom:3px"><i class="fa-solid fa-wrench"></i> ข้อเสนอแนะ &amp; แนวทางแก้ไข (Action Plan):</div>' +
      '<ul style="margin-left:16px;color:#334155;line-height:1.5;font-size:11.5px">' +
        '<li><strong>จัดกะเวลาเข้างานแบบยืดหยุ่น (Flexible Shifts):</strong> เสนอกะ 08:30-17:30 น. หรือ 09:00-18:00 น. สำหรับพนักงานที่เดินทางไกลเพื่อลดปัญหาจราจรติดขัด</li>' +
        '<li><strong>ระบบแจ้งเตือนก่อนหลุดเบี้ยขยัน (Early Warning System):</strong> แจ้งเตือนผ่านไลน์หรือระบบเมื่อพนักงานสายครบ 2 ครั้ง เพื่อเตือนสติและรักษาสิทธิ์</li>' +
        '<li><strong>ให้คำปรึกษาพนักงานที่ขอเบิกเงินถี่ (Financial Wellness):</strong> หัวหน้างานหรือ HR ควรเข้าพูดคุยสอบถามปัญหาสำหรับพนักงานที่ขอเบิกเงินล่วงหน้าบ่อยครั้ง</li>' +
      '</ul>' +
    '</div>' +
  '</div>';

  // 3. Workforce Stability, Retention & Provident Fund (Cost per Headcount)
  h += '<div class="insight-card-item green">' +
    '<div class="insight-card-top">' +
      '<span class="insight-badge green"><i class="fa-solid fa-shield-heart"></i> 👥 เสถียรภาพกำลังคน &amp; กองทุนสำรองเลี้ยงชีพ (PF)</span>' +
      '<span class="insight-impact green">อัตราการมาทำงาน ' + attendanceRate.toFixed(1) + '%</span>' +
    '</div>' +
    '<p style="font-size:12px;color:#475569;margin-bottom:6px">' +
      '<strong>สรุปวิเคราะห์ข้อมูล:</strong> องค์กรมีอัตราความพร้อมในการทำงาน (Attendance Rate) อยู่ที่ ' + attendanceRate.toFixed(1) + '% มีกองทุนสำรองเลี้ยงชีพสะสม ฿' + fmt(totalGross > 0 ? (totalGross * 0.05) : 0) + ' เป็นจุดแข็งในการสร้างความมั่นคงและจูงใจพนักงานที่มีศักยภาพ' +
    '</p>' +
    '<div class="insight-action-box green">' +
      '<div style="font-weight:700;color:#14532d;margin-bottom:3px"><i class="fa-solid fa-wrench"></i> ข้อเสนอแนะ &amp; แนวทางแก้ไข (Action Plan):</div>' +
      '<ul style="margin-left:16px;color:#334155;line-height:1.5;font-size:11.5px">' +
        '<li><strong>ส่งเสริมพนักงานบรรจุใหม่สมัคร PF ทันที:</strong> จัดอบรมแนะนำสิทธิประโยชน์ของการออมและการสมทบของบริษัททันทีที่ผ่านการทดลองงาน (Probation)</li>' +
        '<li><strong>นำผลประเมินรายบุคคลไปจัดทำ Talent Roadmap:</strong> พนักงานกลุ่มเด่น (เกรด A/A+) ควรได้รับการพัฒนาทักษะหัวหน้างาน (Succession Plan)</li>' +
        '<li><strong>ติดตามพนักงานกลุ่มเฝ้าระวังด้วยแผน PIP:</strong> จัดทำ Performance Improvement Plan ภายใน 30-60 วัน เพื่อให้โอกาสปรับปรุงตัวก่อนมาตรการขั้นเด็ดขาด</li>' +
      '</ul>' +
    '</div>' +
  '</div>';

  container.innerHTML = h;
}

function renderAnalyticsEmployeeMatrix(allHistory, selYear, selBranch, selDept) {
  var tbody = document.getElementById('analyticsMatrixBody');
  if (!tbody) return;

  var list = allHistory || [];
  if (selYear && selYear !== 'ALL') {
    list = list.filter(function(x) { return periodMatchesYear(x.period, selYear); });
  }
  if (selBranch && selBranch !== 'ALL') {
    list = list.filter(function(x) {
      var b = x.branchId || x.branch_id || 'B01';
      return b === selBranch;
    });
  }
  if (selDept && selDept !== 'ALL') {
    list = list.filter(function(x) { return (x.department || '').trim() === selDept.trim(); });
  }

  // Pre-calculate Advance Requests by Employee
  var empAdvMap = {};
  (cachedAdvanceStats || []).forEach(function(a) {
    if (a.emp_id) {
      empAdvMap[a.emp_id] = (empAdvMap[a.emp_id] || 0) + (Number(a.amount) || 0);
    }
  });

  var empMap = {};
  list.forEach(function(r) {
    if (!empMap[r.empId]) {
      empMap[r.empId] = {
        empId: r.empId,
        fullName: r.fullName,
        nickname: r.nickname,
        branchId: r.branchId || r.branch_id || 'B01',
        department: r.department,
        baseSalary: Number(r.baseSalary) || 0,
        totalAbsent: 0,
        totalLeave: 0,
        totalSick: 0,
        totalLateDeduct: 0,
        lateCount: 0,
        totalAllowance: 0,
        totalOtHours: 0,
        periodsCount: 0,
        advanceRequests: empAdvMap[r.empId] || 0
      };
    }
    var e = empMap[r.empId];
    e.totalAbsent += Number(r.absentDays) || 0;
    e.totalLeave += Number(r.leaveDays) || 0;
    e.totalSick += Number(r.sickLeaveDays) || 0;
    var ld = Number(r.lateDeduct) || 0;
    e.totalLateDeduct += ld;
    if (ld > 0) e.lateCount++;
    e.totalAllowance += Number(r.allowance) || 0;
    e.totalOtHours += Number(r.otHours) || 0;
    e.periodsCount++;
    if (Number(r.baseSalary) > 0) e.baseSalary = Number(r.baseSalary);
  });

  // Include active employees who may not have payroll history in selected period if branch/dept permits
  (State.employees || []).forEach(function(emp) {
    var b = emp.branch_id || emp.branchId || 'B01';
    var d = (emp.department || '').trim();
    var matchBranch = (!selBranch || selBranch === 'ALL' || b === selBranch);
    var matchDept = (!selDept || selDept === 'ALL' || d === selDept.trim());
    if (matchBranch && matchDept && !empMap[emp.empId]) {
      empMap[emp.empId] = {
        empId: emp.empId,
        fullName: emp.fullName,
        nickname: emp.nickname,
        branchId: b,
        department: emp.department,
        baseSalary: Number(emp.baseSalary) || 0,
        totalAbsent: 0,
        totalLeave: 0,
        totalSick: 0,
        totalLateDeduct: 0,
        lateCount: 0,
        totalAllowance: 0,
        totalOtHours: 0,
        periodsCount: 0,
        advanceRequests: empAdvMap[emp.empId] || 0
      };
    }
  });

  var emps = Object.values(empMap);
  if (emps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted" style="padding:24px">ไม่มีข้อมูลพนักงานในช่วงเวลาที่เลือก</td></tr>';
    updateMatrixCounters(0, 0, 0, 0, 0);
    cachedCurrentMatrixData = [];
    return;
  }

  emps.sort(function(a, b) {
    return (a.empId || '').localeCompare(b.empId || '', undefined, { numeric: true });
  });

  var countAll = emps.length;
  var countPromo = 0;
  var countStd = 0;
  var countWarn = 0;
  var countTerm = 0;

  var processedData = [];

  emps.forEach(function(e) {
    var cat = 'STANDARD';
    var badgeHtml = '';
    var recText = '';
    var totalLeaves = e.totalLeave + e.totalSick;

    if (e.totalAbsent >= 4 || (e.totalAbsent >= 3 && e.totalLateDeduct >= 1000)) {
      cat = 'TERMINATION';
      countTerm++;
      badgeHtml = '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-weight:800;font-size:11px;display:inline-block"><i class="fa-solid fa-triangle-exclamation"></i> 🚨 เข้าข่ายเลิกจ้าง</span>';
      recText = '<span style="color:#991b1b"><strong>เข้าข่ายความผิดวินัยร้ายแรงตามกฎหมายแรงงาน (ม.119):</strong> ขาดงานเกินเกณฑ์สะสม ' + e.totalAbsent + ' วัน ควรออกหนังสือเตือนขั้นเด็ดขาด หรือรวบรวมหลักฐานพิจารณาพักงาน/เลิกจ้าง</span>';
    } else if (e.totalAbsent >= 2 || e.totalLateDeduct >= 600 || totalLeaves >= 10 || e.lateCount >= 4) {
      cat = 'WARNING';
      countWarn++;
      badgeHtml = '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-weight:800;font-size:11px;display:inline-block"><i class="fa-solid fa-circle-exclamation"></i> ⚠️ เฝ้าระวัง / ตักเตือน</span>';
      recText = '<span style="color:#92400e"><strong>ชะลอการปรับเงินเดือน + ออกหนังสือตักเตือนฉบับที่ 1:</strong> สถิติมาสาย ' + (e.lateCount > 0 ? e.lateCount + ' ครั้ง (฿' + fmt(e.totalLateDeduct) + ')' : '') + (e.totalAbsent > 0 ? ' ขาด ' + e.totalAbsent + ' วัน' : '') + ' ให้หัวหน้างานเรียกทำแผนปรับปรุงพฤติกรรม (PIP) ภายใน 30-60 วัน</span>';
    } else if (e.totalAbsent === 0 && e.totalLateDeduct === 0 && totalLeaves <= 3 && (e.totalAllowance >= 2000 || e.periodsCount >= 2)) {
      cat = 'PROMOTION';
      countPromo++;
      badgeHtml = '<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:20px;font-weight:800;font-size:11px;display:inline-block"><i class="fa-solid fa-star"></i> 🌟 เกรด A+ (เด่นมาก)</span>';
      recText = '<span style="color:#14532d"><strong>เสนอปรับขึ้นเงินเดือน +5% ถึง +7%:</strong> (สถิติมาทำงานสม่ำเสมอ 100% ไม่เคยขาด ไม่เคยสาย ได้เบี้ยขยันสะสม ฿' + fmt(e.totalAllowance) + ') ควรพิจารณาเป็น Talent / ผู้ช่วยหัวหน้างาน</span>';
    } else {
      cat = 'STANDARD';
      countStd++;
      badgeHtml = '<span style="background:#eff6ff;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-weight:800;font-size:11px;display:inline-block">✓ เกรด B/B+ (ตามเกณฑ์)</span>';
      recText = '<span style="color:#334155"><strong>เสนอปรับขึ้นเงินเดือนตามเกณฑ์ปกติประจำปี (+2% ถึง +4%):</strong> ปฏิบัติงานตามมาตรฐาน OT สม่ำเสมอ ลาตามสิทธิ์ถูกต้อง</span>';
    }

    e.category = cat;
    e.badgeHtml = badgeHtml;
    e.recText = recText;
    e.totalLeaves = totalLeaves;
    e.branchName = getBranchName(e.branchId);
    processedData.push(e);
  });

  cachedCurrentMatrixData = processedData;
  updateMatrixCounters(countAll, countPromo, countStd, countWarn, countTerm);
  renderMatrixTableRows();
}

function updateMatrixCounters(all, promo, std, warn, term) {
  var elAll = document.getElementById('matrixCountAll');
  var elPromo = document.getElementById('matrixCountPromo');
  var elStd = document.getElementById('matrixCountStd');
  var elWarn = document.getElementById('matrixCountWarn');
  var elTerm = document.getElementById('matrixCountTerm');

  if (elAll) elAll.textContent = all;
  if (elPromo) elPromo.textContent = promo;
  if (elStd) elStd.textContent = std;
  if (elWarn) elWarn.textContent = warn;
  if (elTerm) elTerm.textContent = term;

  var pillPromo = document.getElementById('pillCountPromo');
  var pillStd = document.getElementById('pillCountStd');
  var pillWarn = document.getElementById('pillCountWarn');
  var pillTerm = document.getElementById('pillCountTerm');

  if (pillPromo) pillPromo.textContent = promo;
  if (pillStd) pillStd.textContent = std;
  if (pillWarn) pillWarn.textContent = warn;
  if (pillTerm) pillTerm.textContent = term;
}

function renderMatrixTableRows() {
  var tbody = document.getElementById('analyticsMatrixBody');
  if (!tbody) return;

  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();
  var searchInput = document.getElementById('analyticsMatrixSearchInput');
  var query = (searchInput ? searchInput.value : '').trim().toLowerCase();

  var filtered = (cachedCurrentMatrixData || []).filter(function(e) {
    if (currentAnalyticsCategory !== 'ALL' && e.category !== currentAnalyticsCategory) {
      return false;
    }
    if (query) {
      var matchEmpId = (e.empId || '').toLowerCase().indexOf(query) >= 0;
      var matchName = (e.fullName || '').toLowerCase().indexOf(query) >= 0;
      var matchNick = (e.nickname || '').toLowerCase().indexOf(query) >= 0;
      var matchDept = (e.department || '').toLowerCase().indexOf(query) >= 0;
      var matchBranch = (e.branchName || '').toLowerCase().indexOf(query) >= 0;
      if (!matchEmpId && !matchName && !matchNick && !matchDept && !matchBranch) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted" style="padding:24px">ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา</td></tr>';
    return;
  }

  var rowsHtml = '';
  filtered.forEach(function(e) {
    var nick = e.nickname ? ' (' + esc(e.nickname) + ')' : '';
    var absentStyle = e.totalAbsent > 0 ? 'color:#dc2626;font-weight:800' : 'color:#16a34a';
    var lateStyle = e.totalLateDeduct > 0 ? 'color:#dc2626;font-weight:800' : 'color:#16a34a';
    var advStyle = e.advanceRequests > 0 ? 'color:#d97706;font-weight:700' : 'color:#64748b';

    rowsHtml += '<tr class="analytics-matrix-row" data-cat="' + e.category + '">' +
      '<td><strong style="color:var(--primary)">' + esc(e.empId) + '</strong></td>' +
      '<td><strong>' + esc(e.fullName) + '</strong><span style="font-size:10.5px;color:#64748b">' + nick + '</span></td>' +
      '<td><span style="font-size:11px;color:#334155"><i class="fa-solid fa-store" style="color:#0284c7;font-size:10px"></i> ' + esc(e.branchName) + '</span></td>' +
      '<td>' + esc(e.department || '-') + '</td>' +
      '<td style="text-align:right;font-family:monospace;font-weight:700">' + (canViewSalary ? ('฿' + fmt(e.baseSalary)) : '฿***') + '</td>' +
      '<td style="text-align:center;font-family:monospace;' + absentStyle + '">' + e.totalAbsent + '</td>' +
      '<td style="text-align:center;font-family:monospace">' + e.totalLeaves + '</td>' +
      '<td style="text-align:center;font-family:monospace;' + lateStyle + '">' + (e.lateCount > 0 ? e.lateCount + ' ครั้ง / ฿' + fmt(e.totalLateDeduct) : '0 / ฿0') + '</td>' +
      '<td style="text-align:right;font-family:monospace;font-weight:700;color:var(--success)">฿' + fmt(e.totalAllowance) + '</td>' +
      '<td style="text-align:right;font-family:monospace;' + advStyle + '">' + (e.advanceRequests > 0 ? '฿' + fmt(e.advanceRequests) : '-') + '</td>' +
      '<td style="text-align:center">' + e.badgeHtml + '</td>' +
      '<td style="font-size:11.5px;line-height:1.4">' + e.recText + '</td>' +
    '</tr>';
  });

  tbody.innerHTML = rowsHtml;
}

function onAnalyticsMatrixSearch(query) {
  renderMatrixTableRows();
}

function filterAnalyticsMatrix(cat) {
  currentAnalyticsCategory = cat;
  document.querySelectorAll('.analytics-filter-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  var activeBtn = document.getElementById('btnFilter-' + cat);
  if (activeBtn) activeBtn.classList.add('active');
  renderMatrixTableRows();
}

function exportAnalyticsMatrixToExcel() {
  if (!cachedCurrentMatrixData || cachedCurrentMatrixData.length === 0) {
    showToast('ไม่มีข้อมูลในตารางสำหรับส่งออก Excel', 'warning');
    return;
  }

  var yrSel = document.getElementById('analyticsYearSelect');
  var yr = yrSel ? yrSel.value : '2569';
  var branchSel = document.getElementById('analyticsBranchSelect');
  var branch = branchSel ? branchSel.value : 'ALL';
  var deptSel = document.getElementById('analyticsDeptSelect');
  var dept = deptSel ? deptSel.value : 'ALL';

  var headers = [
    'รหัสพนักงาน',
    'ชื่อ-นามสกุล',
    'ชื่อเล่น',
    'สาขา',
    'แผนก',
    'ฐานเงินเดือน (บาท)',
    'ขาดงาน (วัน)',
    'ลากิจ/ป่วย (วัน)',
    'มาสาย (ครั้ง)',
    'หักเงินมาสาย (บาท)',
    'เบี้ยขยันสะสม (บาท)',
    'เบิกเงินฉุกเฉิน (บาท)',
    'สถานะผลการประเมิน',
    'ข้อเสนอแนะเชิงบริหาร & มาตรการ'
  ];

  var csvRows = [];
  csvRows.push(headers.map(function(h) { return '"' + h.replace(/"/g, '""') + '"'; }).join(','));

  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();
  cachedCurrentMatrixData.forEach(function(e) {
    var catText = '';
    if (e.category === 'PROMOTION') catText = 'เกรด A+ (เด่นมาก / ปรับขึ้นเงินเดือน)';
    else if (e.category === 'STANDARD') catText = 'เกรด B/B+ (มาตรฐานตามเกณฑ์)';
    else if (e.category === 'WARNING') catText = 'เฝ้าระวัง / ตักเตือนลายลักษณ์อักษร (PIP)';
    else if (e.category === 'TERMINATION') catText = 'เข้าข่ายพักงาน / พิจารณาเลิกจ้าง (ม.119)';

    var cleanRec = (e.recText || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    var row = [
      e.empId || '',
      e.fullName || '',
      e.nickname || '',
      e.branchName || '',
      e.department || '',
      canViewSalary ? (e.baseSalary || 0) : '***',
      e.totalAbsent || 0,
      e.totalLeaves || 0,
      e.lateCount || 0,
      e.totalLateDeduct || 0,
      e.totalAllowance || 0,
      e.advanceRequests || 0,
      catText,
      cleanRec
    ];

    csvRows.push(row.map(function(val) {
      return '"' + String(val).replace(/"/g, '""') + '"';
    }).join(','));
  });

  // Prepend UTF-8 BOM (\uFEFF) for Excel Thai encoding support
  var csvContent = '\uFEFF' + csvRows.join('\r\n');
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'PTN_Performance_Appraisal_Matrix_' + yr + '_' + branch + '_' + dept + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('ส่งออกไฟล์ Excel (CSV) สำเร็จเรียบร้อย', 'success');
}

function printAnalyticsReport() {
  var yrSel = document.getElementById('analyticsYearSelect');
  var yr = yrSel ? yrSel.value : '2569';
  var branchSel = document.getElementById('analyticsBranchSelect');
  var branch = branchSel ? branchSel.value : 'ALL';
  var deptSel = document.getElementById('analyticsDeptSelect');
  var dept = deptSel ? deptSel.value : 'ALL';

  var branchText = (branch === 'ALL') ? 'ทุกสาขา' : getBranchName(branch);
  var deptText = (dept === 'ALL') ? 'ทุกแผนก' : ('แผนก ' + dept);

  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  var d = new Date();
  var thaiShortMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var printDate = d.getDate() + ' ' + thaiShortMonths[d.getMonth()] + ' ' + (d.getFullYear() + 543) + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ' น.';

  if (document.getElementById('analyticsPrintCompName')) document.getElementById('analyticsPrintCompName').textContent = compName;
  if (document.getElementById('analyticsPrintYearDisplay')) document.getElementById('analyticsPrintYearDisplay').textContent = yr;
  if (document.getElementById('analyticsPrintBranchDisplay')) document.getElementById('analyticsPrintBranchDisplay').textContent = branchText;
  if (document.getElementById('analyticsPrintDeptDisplay')) document.getElementById('analyticsPrintDeptDisplay').textContent = deptText;
  if (document.getElementById('analyticsPrintDateDisplay')) document.getElementById('analyticsPrintDateDisplay').textContent = printDate;

  clearAllPrintClasses();
  document.body.classList.add('printing-analytics');

  setTimeout(function() {
    window.print();
    setTimeout(clearAllPrintClasses, 1500);
  }, 100);
}


// ==============================================================================
// DOCUMENT & STATUTORY COMPLIANCE CENTER CONTROLLER
// ==============================================================================

// Helper: Convert Number to Thai Baht Text
function bahtText(num) {
  num = Number(num) || 0;
  if (num === 0) return 'ศูนย์บาทถ้วน';
  var isNeg = num < 0;
  num = Math.abs(num);

  var parts = num.toFixed(2).split('.');
  var integerPart = parts[0];
  var decimalPart = parts[1];

  var digits = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  var units = ['','สิบ','ร้อย','พัน','หมื่น','แสน','ล้าน'];

  function convertGroup(nStr) {
    var res = '';
    var len = nStr.length;
    for (var i = 0; i < len; i++) {
      var d = parseInt(nStr.charAt(i), 10);
      var pos = len - i - 1;
      if (d !== 0) {
        if (pos === 1 && d === 1) {
          res += 'สิบ';
        } else if (pos === 1 && d === 2) {
          res += 'ยี่สิบ';
        } else if (pos === 0 && d === 1 && len > 1 && res !== '') {
          res += 'เอ็ด';
        } else {
          res += digits[d] + units[pos];
        }
      }
    }
    return res;
  }

  var intText = '';
  if (integerPart.length > 6) {
    var high = integerPart.substring(0, integerPart.length - 6);
    var low = integerPart.substring(integerPart.length - 6);
    intText = convertGroup(high) + 'ล้าน' + convertGroup(low);
  } else {
    intText = convertGroup(integerPart);
  }
  if (!intText) intText = 'ศูนย์';

  var decText = '';
  if (decimalPart === '00') {
    decText = 'ถ้วน';
  } else {
    var decHigh = parseInt(decimalPart.charAt(0), 10);
    var decLow = parseInt(decimalPart.charAt(1), 10);
    var decStr = '';
    if (decHigh !== 0) {
      if (decHigh === 1) decStr += 'สิบ';
      else if (decHigh === 2) decStr += 'ยี่สิบ';
      else decStr += digits[decHigh] + 'สิบ';
    }
    if (decLow !== 0) {
      if (decLow === 1 && decHigh !== 0) decStr += 'เอ็ด';
      else decStr += digits[decLow];
    }
    decText = decStr + 'สตางค์';
  }

  return (isNeg ? 'ลบ' : '') + intText + 'บาท' + decText;
}

// Category Switcher
function switchDocCategory(cat) {
  var cats = ['cert', 'tax', 'sso', 'bank'];
  cats.forEach(function(c) {
    var btn = document.getElementById('btnDocCat' + c.charAt(0).toUpperCase() + c.slice(1));
    var pnl = document.getElementById('docPanel-' + c);
    if (btn) {
      if (c === cat) {
        btn.classList.remove('btn-slate');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-slate');
      }
    }
    if (pnl) {
      pnl.style.display = (c === cat) ? 'block' : 'none';
    }
  });
}

// Render Document Center Main Tab
function renderDocumentsTab(silent) {
  if (!hasPermission('view_salary') && !hasPermission('all') && !hasPermission('manage_company')) {
    if (!silent) showToast('คุณไม่มีสิทธิ์เข้าถึงศูนย์เอกสาร', 'warning');
    return;
  }

  // 1. Fill Employee Dropdown
  var empSel = document.getElementById('docCertEmpSelect');
  if (empSel) {
    var curVal = empSel.value;
    var opts = '';
    (State.employees || []).forEach(function(e) {
      opts += '<option value="' + esc(e.empId) + '">' + esc(e.empId) + ' - ' + esc(e.fullName) + (e.nickname ? ' (' + esc(e.nickname) + ')' : '') + ' [' + esc(e.department || '-') + ']</option>';
    });
    empSel.innerHTML = opts || '<option value="">ไม่มีข้อมูลพนักงาน</option>';
    if (curVal) empSel.value = curVal;
  }

  // 2. Set Default Certificate Date
  var dateInput = document.getElementById('docCertDate');
  if (dateInput && !dateInput.value) {
    var d = new Date();
    var thaiMonthsFull = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    dateInput.value = d.getDate() + ' ' + thaiMonthsFull[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  }

  // 3. Render Tax PND 1 Summary & Preview
  renderPnd1Summary();

  // 4. Render SSO Summary & Preview
  renderSsoSummary();

  // 5. Update Bank Period
  if (document.getElementById('bankPeriodDisplay')) {
    document.getElementById('bankPeriodDisplay').textContent = State.period;
  }
}

function onDocCertParamChanged() {
  // If modal is open, re-render
  var modal = document.getElementById('salaryCertModal');
  if (modal && modal.classList.contains('active')) {
    renderCertModalPaper();
  }
}

// ------------------------------------------------------------------------------
// SALARY & EMPLOYMENT CERTIFICATE CONTROLLER
// ------------------------------------------------------------------------------
function openSalaryCertificateModal(targetEmpId) {
  if (!hasPermission('view_salary') && !hasPermission('all')) {
    showToast('คุณไม่มีสิทธิ์ออกหนังสือรับรองเงินเดือน', 'warning');
    return;
  }

  var sel = document.getElementById('docCertEmpSelect');
  if (targetEmpId && sel) {
    sel.value = targetEmpId;
  }

  var empId = sel ? sel.value : (State.employees && State.employees[0] ? State.employees[0].empId : '');
  if (!empId) {
    showToast('กรุณาเลือกพนักงานที่ต้องการออกหนังสือรับรอง', 'warning');
    return;
  }

  var lang = document.getElementById('docCertLang') ? document.getElementById('docCertLang').value : 'TH';
  var signNameInput = document.getElementById('modalCertSignName');
  var signTitleInput = document.getElementById('modalCertSignTitle');
  var dateInput = document.getElementById('modalCertDate');

  var defSignName = (lang === 'EN' ? State.company.signatoryNameEn : State.company.signatoryName) || State.company.signatoryName || 'นางสาวประภัสสร เกียรติดำรง';
  var defSignTitle = (lang === 'EN' ? State.company.signatoryTitleEn : State.company.signatoryTitle) || State.company.signatoryTitle || 'ผู้จัดการฝ่ายทรัพยากรบุคคล';
  var curDate = document.getElementById('docCertDate') ? document.getElementById('docCertDate').value : '';

  if (signNameInput) signNameInput.value = defSignName;
  if (signTitleInput) signTitleInput.value = defSignTitle;
  if (dateInput) dateInput.value = curDate;

  renderCertModalPaper();
  openModal('salaryCertModal');
}

function renderCertModalPaper() {
  var paper = document.getElementById('salaryCertPaper');
  if (!paper) return;

  var sel = document.getElementById('docCertEmpSelect');
  var empId = sel ? sel.value : '';
  var emp = (State.employees || []).find(function(e) { return e.empId === empId; }) || {};

  var purpose = document.getElementById('docCertPurpose') ? document.getElementById('docCertPurpose').value : 'loan';
  var lang = document.getElementById('docCertLang') ? document.getElementById('docCertLang').value : 'TH';
  var certDate = (document.getElementById('modalCertDate') && document.getElementById('modalCertDate').value) ? document.getElementById('modalCertDate').value : (document.getElementById('docCertDate') ? document.getElementById('docCertDate').value : '');
  var signatoryName = (document.getElementById('modalCertSignName') && document.getElementById('modalCertSignName').value) ? document.getElementById('modalCertSignName').value : (State.company.signatoryName || 'นางสาวประภัสสร เกียรติดำรง');
  var signatoryTitle = (document.getElementById('modalCertSignTitle') && document.getElementById('modalCertSignTitle').value) ? document.getElementById('modalCertSignTitle').value : (State.company.signatoryTitle || 'ผู้จัดการฝ่ายทรัพยากรบุคคล');

  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  var compAddress = State.company.address || '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110';
  var compTaxId = State.company.taxId || '0105559876543';
  var compPhone = State.company.phone || '02-123-4567';

  // Base salary and extra regular allowances
  var baseSal = Number(emp.baseSalary) || 0;
  var regularAllow = 0;
  var totalMonthly = baseSal + regularAllow;

  // Tenure calculation
  var tenureText = '';
  var tenureTextEn = '';
  if (emp.startDate) {
    try {
      var sDate = new Date(emp.startDate);
      var now = new Date();
      var diffYears = now.getFullYear() - sDate.getFullYear();
      var diffMonths = now.getMonth() - sDate.getMonth();
      if (diffMonths < 0) { diffYears--; diffMonths += 12; }
      if (diffYears > 0 && diffMonths > 0) {
        tenureText = diffYears + ' ปี ' + diffMonths + ' เดือน';
        tenureTextEn = diffYears + ' year(s) ' + diffMonths + ' month(s)';
      } else if (diffYears > 0) {
        tenureText = diffYears + ' ปี';
        tenureTextEn = diffYears + ' year(s)';
      } else {
        tenureText = (diffMonths || 1) + ' เดือน';
        tenureTextEn = (diffMonths || 1) + ' month(s)';
      }
    } catch(ex) {
      tenureText = '-';
      tenureTextEn = '-';
    }
  }

  // Format start date nicely
  var startDateDisplay = emp.startDate || '-';
  var startDateDisplayEn = emp.startDate || '-';
  if (emp.startDate && emp.startDate.indexOf('-') > 0) {
    var parts = emp.startDate.split('-');
    if (parts.length === 3) {
      var thaiMonthsFull = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
      var enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var mIdx = parseInt(parts[1], 10) - 1;
      startDateDisplay = parseInt(parts[2], 10) + ' ' + (thaiMonthsFull[mIdx] || '') + ' ' + (parseInt(parts[0], 10) + 543);
      startDateDisplayEn = (enMonths[mIdx] || '') + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
    }
  }

  var h = '';

  if (lang === 'EN') {
    // ENGLISH VERSION
    var purposeStrEn = 'applying for financial credit / personal loan';
    if (purpose === 'visa') purposeStrEn = 'applying for a visa to travel abroad';
    else if (purpose === 'general') purposeStrEn = 'general employment and income verification';

    var docNoEn = 'PTN-HR-' + String(new Date().getMonth() + 1).padStart(2,'0') + String(new Date().getDate()).padStart(2,'0') + '/' + new Date().getFullYear();

    h += '<div style="text-align:center;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:22px">' +
      '<div style="font-size:18px;font-weight:800;color:#0f172a;letter-spacing:0.5px">' + esc(compName) + '</div>' +
      '<div style="font-size:11px;color:#475569;margin-top:4px">Tax Identification No.: ' + esc(compTaxId) + '</div>' +
      '<div style="font-size:11px;color:#64748b">' + esc(compAddress) + ' | Tel: ' + esc(compPhone) + '</div>' +
    '</div>' +

    '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:22px">' +
      '<div><strong>Ref No.:</strong> ' + esc(docNoEn) + '</div>' +
      '<div><strong>Date:</strong> <span id="certPaperDate">' + esc(certDate || new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })) + '</span></div>' +
    '</div>' +

    '<div style="text-align:center;margin:24px 0 28px">' +
      '<h2 contenteditable="true" spellcheck="false" title="คลิกเพื่อแก้ไขหัวข้อ" style="font-size:18px;font-weight:800;color:#0f172a;letter-spacing:1px;text-transform:uppercase;margin:0">SALARY &amp; EMPLOYMENT VERIFICATION LETTER</h2>' +
    '</div>' +

    '<div id="certPaperBody" contenteditable="true" spellcheck="false" title="คลิกเพื่อแก้ไขข้อความได้โดยตรง" style="font-size:13.5px;text-align:justify;line-height:2;color:#1e293b">' +
      '<p style="text-indent:2.5rem;margin-bottom:16px">' +
        'This letter is officially issued to certify that <strong>' + esc(emp.fullName || '-') + '</strong>, ' +
        'Identification / Citizen Card No. <strong style="font-family:monospace">' + esc(emp.citizenId || '-') + '</strong>, ' +
        'is a bona fide permanent employee of <strong>' + esc(compName) + '</strong>, ' +
        'having been employed with the company since <strong>' + esc(startDateDisplayEn) + '</strong> ' +
        (tenureTextEn ? '(with continuous service of <strong>' + esc(tenureTextEn) + '</strong>) ' : '') +
        'to the present date.' +
      '</p>' +
      '<p style="text-indent:2.5rem;margin-bottom:16px">' +
        'Presently, ' + esc(emp.fullName || '-') + ' holds the position of <strong>' + esc(emp.position || '-') + '</strong> ' +
        'in the <strong>' + esc(emp.department || '-') + ' Department</strong>, ' +
        'earning a current basic monthly salary of <strong style="font-family:monospace;font-size:14px">THB ' + fmt(baseSal) + '</strong>.' +
      '</p>' +
      '<p style="text-indent:2.5rem;margin-bottom:24px">' +
        'This certificate is issued upon the request of the employee for the sole purpose of <strong>' + esc(purposeStrEn) + '</strong>.' +
      '</p>' +
      '<p style="text-indent:2.5rem;margin-bottom:36px">' +
        'Certified true, accurate, and correct.' +
      '</p>' +
    '</div>' +

    '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;page-break-inside:avoid">' +
      '<div style="width:120px;height:120px;border:2px dashed #cbd5e1;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;font-size:10.5px;text-align:center">' +
        '<i class="fa-solid fa-stamp" style="font-size:24px;margin-bottom:4px;color:#cbd5e1"></i>' +
        '<span>( Company Seal /<br>Official Stamp )</span>' +
      '</div>' +
      '<div style="text-align:center;min-width:240px">' +
        '<div style="height:54px;border-bottom:1px solid #475569;margin-bottom:8px"></div>' +
        '<div style="font-weight:800;font-size:13.5px;color:#0f172a">( <span id="certPaperSignName" contenteditable="true" spellcheck="false">' + esc(signatoryName) + '</span> )</div>' +
        '<div style="font-size:12px;color:#475569;margin-top:2px"><span id="certPaperSignTitle" contenteditable="true" spellcheck="false">' + esc(signatoryTitle) + '</span></div>' +
        '<div style="font-size:11px;color:#64748b">' + esc(compName) + '</div>' +
      '</div>' +
    '</div>' +

    '<div style="text-align:center;font-size:10px;color:#94a3b8;margin-top:36px;border-top:1px solid #f1f5f9;padding-top:10px">' +
      'This document is valid for 30 days from date of issuance. For verification, please contact HR Department at ' + esc(compPhone) + '.' +
    '</div>';

  } else {
    // THAI VERSION (OFFICIAL STANDARD)
    var purposeStrTh = 'ยื่นขอสินเชื่อ / ธุรกรรมทางการเงินกับสถาบันการเงิน';
    if (purpose === 'visa') purposeStrTh = 'ยื่นขอวีซ่าเพื่อการเดินทางไปต่างประเทศ';
    else if (purpose === 'general') purposeStrTh = 'ใช้เป็นหลักฐานรับรองสถานะการทำงานทั่วไป';

    var docNoTh = 'พทน. บค. ' + String(new Date().getMonth() + 1).padStart(2,'0') + String(new Date().getDate()).padStart(2,'0') + '/' + (new Date().getFullYear() + 543);

    h += '<div style="text-align:center;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:22px">' +
      '<div style="font-size:19px;font-weight:800;color:#0f172a;letter-spacing:0.5px">' + esc(compName) + '</div>' +
      '<div style="font-size:11px;color:#475569;margin-top:4px">เลขประจำตัวผู้เสียภาษีอากร: <strong style="font-family:monospace">' + esc(compTaxId) + '</strong> | โทรศัพท์: ' + esc(compPhone) + '</div>' +
      '<div style="font-size:11px;color:#64748b">' + esc(compAddress) + '</div>' +
    '</div>' +

    '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:20px">' +
      '<div>ที่ ' + esc(docNoTh) + '</div>' +
      '<div>วันที่ <strong id="certPaperDate">' + esc(certDate) + '</strong></div>' +
    '</div>' +

    '<div style="text-align:center;margin:24px 0 28px">' +
      '<h2 contenteditable="true" spellcheck="false" title="คลิกเพื่อแก้ไขหัวข้อ" style="font-size:19px;font-weight:800;color:#0f172a;letter-spacing:1px;margin:0">หนังสือรับรองเงินเดือนและการทำงาน</h2>' +
    '</div>' +

    '<div id="certPaperBody" contenteditable="true" spellcheck="false" title="คลิกเพื่อแก้ไขข้อความได้โดยตรง" style="font-size:14px;text-align:justify;line-height:2.1;color:#1e293b">' +
      '<p style="text-indent:2.8rem;margin-bottom:16px">' +
        'หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า <strong>' + esc(emp.fullName || '-') + '</strong> ' +
        'เลขประจำตัวประชาชน <strong style="font-family:monospace">' + esc(emp.citizenId || '-') + '</strong> ' +
        'เป็นพนักงานประจำของ <strong>' + esc(compName) + '</strong> จริง ' +
        'โดยได้เริ่มเข้าปฏิบัติงานตั้งแต่วันที่ <strong>' + esc(startDateDisplay) + '</strong> ' +
        (tenureText ? 'จนถึงปัจจุบัน รวมระยะเวลาการปฏิบัติงาน <strong>' + esc(tenureText) + '</strong> ' : '') +
        'ปัจจุบันดำรงตำแหน่ง <strong>' + esc(emp.position || '-') + '</strong> ' +
        'สังกัดฝ่าย/แผนก <strong>' + esc(emp.department || '-') + '</strong>' +
      '</p>' +
      '<p style="text-indent:2.8rem;margin-bottom:16px">' +
        'ได้รับเงินเดือนในอัตราเดือนละ <strong style="font-family:monospace;font-size:15px">' + fmt(baseSal) + '</strong> บาท ' +
        '(<strong style="color:#0f172a">' + bahtText(baseSal) + '</strong>)' +
      '</p>' +
      '<p style="text-indent:2.8rem;margin-bottom:24px">' +
        'บริษัทฯ ออกหนังสือรับรองฉบับนี้ให้ไว้ตามความประสงค์ของพนักงาน เพื่อใช้เป็นหลักฐานประกอบการ <strong>' + esc(purposeStrTh) + '</strong> เท่านั้น' +
      '</p>' +
      '<p style="text-indent:2.8rem;margin-bottom:36px">' +
        'ขอรับรองว่าเป็นความจริงทุกประการ' +
      '</p>' +
    '</div>' +

    '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:46px;page-break-inside:avoid">' +
      '<div style="width:125px;height:125px;border:2px dashed #cbd5e1;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;text-align:center">' +
        '<i class="fa-solid fa-stamp" style="font-size:26px;margin-bottom:4px;color:#cbd5e1"></i>' +
        '<span>(ประทับตราสำคัญ<br>ของบริษัท)</span>' +
      '</div>' +
      '<div style="text-align:center;min-width:240px">' +
        '<div style="height:54px;border-bottom:1px solid #475569;margin-bottom:8px"></div>' +
        '<div style="font-weight:800;font-size:14px;color:#0f172a">( <span id="certPaperSignName" contenteditable="true" spellcheck="false">' + esc(signatoryName) + '</span> )</div>' +
        '<div style="font-size:12px;color:#475569;margin-top:2px"><span id="certPaperSignTitle" contenteditable="true" spellcheck="false">' + esc(signatoryTitle) + '</span></div>' +
        '<div style="font-size:11px;color:#64748b">' + esc(compName) + '</div>' +
      '</div>' +
    '</div>' +

    '<div style="text-align:center;font-size:10px;color:#94a3b8;margin-top:36px;border-top:1px solid #f1f5f9;padding-top:10px">' +
      'เอกสารนี้มีอายุการใช้งาน 30 วันนับจากวันที่ออกหนังสือ | หากมีข้อสงสัยติดต่อฝ่ายทรัพยากรบุคคล โทร ' + esc(compPhone) + '' +
    '</div>';
  }

  paper.innerHTML = h;
}

function updateSignatoryInPaper() {
  var name = document.getElementById('modalCertSignName') ? document.getElementById('modalCertSignName').value : '';
  var title = document.getElementById('modalCertSignTitle') ? document.getElementById('modalCertSignTitle').value : '';
  var elName = document.getElementById('certPaperSignName');
  var elTitle = document.getElementById('certPaperSignTitle');
  if (elName) elName.textContent = name;
  if (elTitle) elTitle.textContent = title;
}

function updateDateInPaper() {
  var d = document.getElementById('modalCertDate') ? document.getElementById('modalCertDate').value : '';
  var el = document.getElementById('certPaperDate');
  if (el) el.textContent = d;
}

function resetCertModalPaper() {
  if (!confirm('ต้องการคืนค่าข้อความกลับเป็นค่าเริ่มต้นตามฐานข้อมูลใช่หรือไม่? (การแก้ไขที่คุณพิมพ์ไว้บนกระดาษจะถูกรีเซ็ต)')) return;
  renderCertModalPaper();
  showToast('คืนค่าข้อความเริ่มต้นเรียบร้อยแล้ว', 'info');
}

function printSalaryCertificate() {
  clearAllPrintClasses();
  document.body.classList.add('printing-salary-cert');

  setTimeout(function() {
    window.print();
    setTimeout(clearAllPrintClasses, 1500);
  }, 100);
}

function open50TwiFromDocCenter() {
  if (!hasPermission('view_salary')) {
    showToast('คุณไม่มีสิทธิ์เข้าถึงหนังสือรับรองภาษี 50 ทวิ', 'warning');
    return;
  }
  var sel = document.getElementById('docCertEmpSelect');
  var empId = sel ? sel.value : '';
  if (!empId) {
    showToast('กรุณาเลือกพนักงานก่อนพิมพ์ 50 ทวิ', 'warning');
    return;
  }

  if (document.getElementById('histEmpSelect')) {
    document.getElementById('histEmpSelect').value = empId;
  }

  var yr = '';
  var yrSel = document.getElementById('histYearSelect');
  if (yrSel && yrSel.value && yrSel.value !== 'ALL') {
    yr = yrSel.value;
  } else {
    yr = String(new Date().getFullYear() + 543);
  }

  showToast('กำลังเตรียมเอกสาร 50 ทวิ ของ ' + empId + '...', 'info');
  callApi('get50TwiData', { empId: empId, year: yr })
    .then(function(r) {
      if (!r.success) {
        showToast(r.message || 'ไม่พบข้อมูล 50 ทวิ', 'error');
        return;
      }
      var c = r.company || {};
      var e = r.employee || {};
      var t = r.totals || {};

      document.getElementById('twiYearDisplay').textContent = r.year;
      document.getElementById('twiCompName').textContent = c.name;
      document.getElementById('twiCompTax').textContent = c.taxId;
      document.getElementById('twiCompAddr').textContent = c.address;

      document.getElementById('twiEmpName').textContent = e.fullName;
      document.getElementById('twiEmpId').textContent = e.empId;
      document.getElementById('twiEmpCitizen').textContent = e.citizenId || '-';
      document.getElementById('twiEmpAddr').textContent = e.address || '-';
      document.getElementById('twiEmpDeptPos').textContent = (e.department || '-') + ' / ' + (e.position || '-');

      document.getElementById('twiTableGross').textContent = fmt(t.totalGross);
      document.getElementById('twiTableTax').textContent = fmt(t.totalTax);
      document.getElementById('twiTotalGross').textContent = fmt(t.totalGross);
      document.getElementById('twiTotalTax').textContent = fmt(t.totalTax);
      document.getElementById('twiTotalSso').textContent = fmt(t.totalSso);
      document.getElementById('twiTotalPf').textContent = fmt(t.totalPf);

      var d = new Date();
      var thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      document.getElementById('twiIssueDate').textContent = d.getDate() + ' ' + thaiMonths[d.getMonth()] + ' ' + (d.getFullYear() + 543);

      openModal('twi50Modal');
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

function openPayslipFromDocCenter() {
  if (!hasPermission('view_salary') || !hasPermission('view_payslip')) {
    showToast('คุณไม่มีสิทธิ์เข้าถึงใบแจ้งยอดเงินเดือน (Payslip)', 'warning');
    return;
  }
  var sel = document.getElementById('docCertEmpSelect');
  var empId = sel ? sel.value : '';
  if (!empId) {
    showToast('กรุณาเลือกพนักงานก่อนดูสลิป', 'warning');
    return;
  }

  var row = (State.payrollList || []).find(function(x) { return x.empId === empId; });
  if (row) {
    populatePayslipModal(row);
    return;
  }

  showToast('กำลังโหลดสลิปเงินเดือนของ ' + empId + '...', 'info');
  callApi('getEmployeeHistory', { empId: empId })
    .then(function(r) {
      if (r.success && r.historyList && r.historyList.length > 0) {
        var latestRow = r.historyList[0];
        var emp = (State.employees || []).find(function(e) { return e.empId === empId; }) || {};
        latestRow.bankName = latestRow.bankName || emp.bankName;
        latestRow.bankAccount = latestRow.bankAccount || emp.bankAccount;
        populatePayslipModal(latestRow);
      } else {
        showToast('ไม่พบข้อมูลการจ่ายเงินเดือนของพนักงานท่านนี้ (ยังไม่มีการคำนวณเงินเดือน)', 'warning');
      }
    })
    .catch(function(err) {
      showToast('Error: ' + err.message, 'error');
    });
}

// ------------------------------------------------------------------------------
// REVENUE DEPARTMENT TAX: ภ.ง.ด. 1 CONTROLLER
// ------------------------------------------------------------------------------
function renderPnd1Summary() {
  var list = State.payrollList || [];
  var compTax = State.company.taxId || '0105559876543';
  var branch = State.company.companyBranch || '00000';

  if (document.getElementById('pnd1PeriodDisplay')) {
    document.getElementById('pnd1PeriodDisplay').textContent = State.period;
  }

  var count = 0;
  var sumIncome = 0;
  var sumTax = 0;

  var lines = [];
  list.forEach(function(r, idx) {
    var gross = Number(r.grossPay) || 0;
    var tax = Number(r.tax) || 0;
    if (gross > 0) {
      count++;
      sumIncome += gross;
      sumTax += tax;

      var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
      var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '').padEnd(13, '0');
      var names = (r.name || '').split(' ');
      var firstName = names[0] || '';
      var lastName = names.slice(1).join(' ') || '';
      var prefix = 'นาย';
      if (firstName.indexOf('นางสาว') === 0) { prefix = 'นางสาว'; firstName = firstName.replace('นางสาว',''); }
      else if (firstName.indexOf('นาง') === 0) { prefix = 'นาง'; firstName = firstName.replace('นาง',''); }
      else if (firstName.indexOf('นาย') === 0) { prefix = 'นาย'; firstName = firstName.replace('นาย',''); }

      var d = new Date();
      var payDateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');

      lines.push((idx+1) + '|' + compTax + '|' + branch + '|' + citizen + '|' + prefix + '|' + firstName + '|' + lastName + '|' + (emp.address || compTax) + '|' + payDateStr + '|1|0.00|' + gross.toFixed(2) + '|' + tax.toFixed(2) + '|1');
    }
  });

  if (document.getElementById('pnd1EmpCount')) document.getElementById('pnd1EmpCount').textContent = count + ' คน';
  if (document.getElementById('pnd1TotalIncome')) document.getElementById('pnd1TotalIncome').textContent = fmt(sumIncome) + ' บาท';
  if (document.getElementById('pnd1TotalTax')) document.getElementById('pnd1TotalTax').textContent = fmt(sumTax) + ' บาท';

  lines.push('TOTAL|' + compTax + '|' + branch + '|' + count + '|' + sumIncome.toFixed(2) + '|' + sumTax.toFixed(2));

  var previewArea = document.getElementById('pnd1FilePreview');
  if (previewArea) {
    previewArea.textContent = lines.slice(0, 10).join('\n') + (lines.length > 10 ? '\n... (และอีก ' + (lines.length - 10) + ' รายการ)' : '');
  }
}

function exportPnd1TextFile() {
  if (!hasPermission('view_salary') && !hasPermission('all')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์ภาษี ภ.ง.ด. 1', 'warning');
    return;
  }
  var list = State.payrollList || [];
  if (list.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var compTax = State.company.taxId || '0105559876543';
  var branch = State.company.companyBranch || '00000';
  var count = 0, sumIncome = 0, sumTax = 0;
  var lines = [];

  list.forEach(function(r, idx) {
    var gross = Number(r.grossPay) || 0;
    var tax = Number(r.tax) || 0;
    if (gross > 0) {
      count++;
      sumIncome += gross;
      sumTax += tax;

      var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
      var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '').padEnd(13, '0');
      var names = (r.name || '').split(' ');
      var firstName = names[0] || '';
      var lastName = names.slice(1).join(' ') || '';
      var prefix = 'นาย';
      if (firstName.indexOf('นางสาว') === 0) { prefix = 'นางสาว'; firstName = firstName.replace('นางสาว',''); }
      else if (firstName.indexOf('นาง') === 0) { prefix = 'นาง'; firstName = firstName.replace('นาง',''); }
      else if (firstName.indexOf('นาย') === 0) { prefix = 'นาย'; firstName = firstName.replace('นาย',''); }

      var d = new Date();
      var payDateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');

      lines.push((count) + '|' + compTax + '|' + branch + '|' + citizen + '|' + prefix + '|' + firstName + '|' + lastName + '|' + (emp.address || '-') + '|' + payDateStr + '|1|0.00|' + gross.toFixed(2) + '|' + tax.toFixed(2) + '|1');
    }
  });

  lines.push('TOTAL|' + compTax + '|' + branch + '|' + count + '|' + sumIncome.toFixed(2) + '|' + sumTax.toFixed(2));

  var txtContent = lines.join('\r\n');
  var filename = 'PND1_' + State.period.replace(/\s+/g, '_') + '.txt';
  var blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์ Text ภ.ง.ด. 1 สำเร็จ (พร้อมยื่น RD e-Filing)');
}

// ------------------------------------------------------------------------------
// SOCIAL SECURITY: สปส. 1-10 CONTROLLER
// ------------------------------------------------------------------------------
function renderSsoSummary() {
  var list = State.payrollList || [];
  var ssoAcc = State.company.employerSsoId || '10-1234567-8';
  var branch = State.company.companyBranch || '0000';

  if (document.getElementById('ssoEmployerDisplay')) document.getElementById('ssoEmployerDisplay').textContent = ssoAcc;
  if (document.getElementById('ssoBranchDisplay')) document.getElementById('ssoBranchDisplay').textContent = branch;

  var count = 0;
  var sumWages = 0;
  var sumSso = 0;

  var lines = [];
  // Header: Account(10) + Branch(4) + Period(MMYYYY) + Count(6) + TotalContribution(9)
  var d = new Date();
  var ssoPeriod = String(d.getMonth()+1).padStart(2,'0') + (d.getFullYear() + 543);
  var cleanAcc = ssoAcc.replace(/[^0-9]/g, '').padEnd(10, '0');
  var cleanBranch = branch.replace(/[^0-9]/g, '').padStart(4, '0');

  list.forEach(function(r) {
    var base = Number(r.baseSalary) || 0;
    var sso = Number(r.sso) || 0;
    if (sso > 0) {
      count++;
      var wage = Math.min(Math.max(base, 1650), 15000);
      sumWages += wage;
      sumSso += sso;

      var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
      var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '').padEnd(13, '0');
      var names = (r.name || '').split(' ');
      var firstName = (names[0] || '').padEnd(20, ' ');
      var lastName = (names.slice(1).join(' ') || '').padEnd(20, ' ');
      var wageCents = String(Math.round(wage * 100)).padStart(9, '0');
      var ssoCents = String(Math.round(sso * 100)).padStart(7, '0');

      lines.push('2' + citizen + firstName + lastName + wageCents + ssoCents + ssoCents);
    }
  });

  var totalSsoContrib = sumSso * 2; // employee + employer
  var header = '1' + cleanAcc + cleanBranch + ssoPeriod + String(count).padStart(6, '0') + String(Math.round(totalSsoContrib * 100)).padStart(10, '0');
  lines.unshift(header);

  if (document.getElementById('ssoEmpCount')) document.getElementById('ssoEmpCount').textContent = count + ' คน';
  if (document.getElementById('ssoEmployeeSum')) document.getElementById('ssoEmployeeSum').textContent = fmt(sumSso) + ' บาท';
  if (document.getElementById('ssoTotalSum')) document.getElementById('ssoTotalSum').textContent = fmt(totalSsoContrib) + ' บาท';

  var previewArea = document.getElementById('ssoFilePreview');
  if (previewArea) {
    previewArea.textContent = lines.slice(0, 10).join('\n') + (lines.length > 10 ? '\n... (และอีก ' + (lines.length - 10) + ' รายการ)' : '');
  }
}

function exportSso1_10TextFile() {
  if (!hasPermission('view_salary') && !hasPermission('all')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์ สปส. 1-10', 'warning');
    return;
  }
  var list = State.payrollList || [];
  if (list.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var ssoAcc = State.company.employerSsoId || '10-1234567-8';
  var branch = State.company.companyBranch || '0000';
  var d = new Date();
  var ssoPeriod = String(d.getMonth()+1).padStart(2,'0') + (d.getFullYear() + 543);
  var cleanAcc = ssoAcc.replace(/[^0-9]/g, '').padEnd(10, '0');
  var cleanBranch = branch.replace(/[^0-9]/g, '').padStart(4, '0');

  var count = 0, sumSso = 0;
  var lines = [];

  list.forEach(function(r) {
    var base = Number(r.baseSalary) || 0;
    var sso = Number(r.sso) || 0;
    if (sso > 0) {
      count++;
      var wage = Math.min(Math.max(base, 1650), 15000);
      sumSso += sso;

      var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
      var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '').padEnd(13, '0');
      var names = (r.name || '').split(' ');
      var firstName = (names[0] || '').padEnd(20, ' ');
      var lastName = (names.slice(1).join(' ') || '').padEnd(20, ' ');
      var wageCents = String(Math.round(wage * 100)).padStart(9, '0');
      var ssoCents = String(Math.round(sso * 100)).padStart(7, '0');

      lines.push('2' + citizen + firstName + lastName + wageCents + ssoCents + ssoCents);
    }
  });

  var totalSsoContrib = sumSso * 2;
  var header = '1' + cleanAcc + cleanBranch + ssoPeriod + String(count).padStart(6, '0') + String(Math.round(totalSsoContrib * 100)).padStart(10, '0');
  lines.unshift(header);

  var txtContent = lines.join('\r\n');
  var filename = 'SSO_1_10_' + State.period.replace(/\s+/g, '_') + '.txt';
  var blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์ Text สปส. 1-10 สำเร็จ (พร้อมยื่น SSO e-Service)');
}

// ------------------------------------------------------------------------------
// MULTI-BANK PAYROLL EXPORT CONTROLLER (KBANK, SCB, BBL, KTB)
// ------------------------------------------------------------------------------

// 1. KBANK
function exportKbankPayrollCsv() {
  if (!hasPermission('view_salary') || !hasPermission('export_csv')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์โอนเงินเดือน', 'warning');
    return;
  }
  var list = State.payrollList || [];
  if (list.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var csv = '\uFEFF';
  csv += 'CustRef,BeneficiaryName,BankCode,AccountNo,Amount,CitizenID,PayType,Remark\n';

  list.forEach(function(r) {
    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
    var bCode = getBankCode(r.bankName || emp.bankName);
    var acc = String(r.bankAccount || emp.bankAccount || '').replace(/[^0-9]/g, '');
    var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '');
    var netAmt = Number(r.netPay) > 0 ? Number(r.netPay).toFixed(2) : '0.00';

    csv += [
      r.empId,
      '"' + (r.name || '').replace(/"/g, '""') + '"',
      bCode,
      acc,
      netAmt,
      citizen,
      '01',
      '"เงินเดือน ' + State.period + '"'
    ].join(',') + '\n';
  });

  var filename = 'KBANK_PAYROLL_' + State.period.replace(/\s+/g, '_') + '.csv';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์โอนเงินเดือน KBANK (CSV) สำเร็จ');
}

function exportKbankPayrollTxt() {
  if (!hasPermission('view_salary') || !hasPermission('export_csv')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์โอนเงินเดือน', 'warning');
    return;
  }
  var list = State.payrollList || [];
  if (list.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var lines = [];
  var d = new Date();
  var dateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');

  // KBANK Header
  lines.push('H' + 'KBANK' + dateStr + String(list.length).padStart(6, '0'));

  list.forEach(function(r, idx) {
    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
    var bCode = getBankCode(r.bankName || emp.bankName);
    var acc = String(r.bankAccount || emp.bankAccount || '').replace(/[^0-9]/g, '').padEnd(15, ' ');
    var amtCents = String(Math.round((Number(r.netPay) || 0) * 100)).padStart(12, '0');
    var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '').padEnd(13, ' ');
    var name = (r.name || '').padEnd(50, ' ');

    lines.push('D' + String(idx+1).padStart(6, '0') + bCode + acc + amtCents + citizen + name);
  });

  lines.push('T' + String(list.length).padStart(6, '0'));

  var txtContent = lines.join('\r\n');
  var filename = 'KBANK_PAYROLL_' + State.period.replace(/\s+/g, '_') + '.txt';
  var blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์โอนเงินเดือน KBANK (TXT) สำเร็จ');
}

// 2. SCB
function exportScbPayrollCsv() {
  if (!hasPermission('view_salary') || !hasPermission('export_csv')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์โอนเงินเดือน', 'warning');
    return;
  }
  var list = State.payrollList || [];
  if (list.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var csv = '\uFEFF';
  csv += 'RecordType,BankCode,AccountNumber,Amount,BeneficiaryName,CitizenID,RefNo,FeeType\n';

  list.forEach(function(r) {
    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
    var bCode = getBankCode(r.bankName || emp.bankName);
    var acc = String(r.bankAccount || emp.bankAccount || '').replace(/[^0-9]/g, '');
    var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '');
    var netAmt = Number(r.netPay) > 0 ? Number(r.netPay).toFixed(2) : '0.00';

    csv += [
      'D',
      bCode,
      acc,
      netAmt,
      '"' + (r.name || '').replace(/"/g, '""') + '"',
      citizen,
      r.empId,
      'OUR'
    ].join(',') + '\n';
  });

  var filename = 'SCB_PAYROLL_' + State.period.replace(/\s+/g, '_') + '.csv';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์โอนเงินเดือน SCB (CSV) สำเร็จ');
}

function exportScbPayrollTxt() {
  if (!hasPermission('view_salary') || !hasPermission('export_csv')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์โอนเงินเดือน', 'warning');
    return;
  }
  var list = State.payrollList || [];
  if (list.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var lines = [];
  var d = new Date();
  var dateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');

  lines.push('H' + 'SCBPAYROLL'.padEnd(20, ' ') + dateStr + String(list.length).padStart(6, '0'));
  list.forEach(function(r, idx) {
    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
    var bCode = getBankCode(r.bankName || emp.bankName);
    var acc = String(r.bankAccount || emp.bankAccount || '').replace(/[^0-9]/g, '').padEnd(15, ' ');
    var amtCents = String(Math.round((Number(r.netPay) || 0) * 100)).padStart(12, '0');
    var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '').padEnd(13, ' ');
    var name = (r.name || '').padEnd(50, ' ');

    lines.push('D' + String(idx+1).padStart(6, '0') + bCode + acc + amtCents + citizen + name);
  });
  lines.push('T' + String(list.length).padStart(6, '0'));

  var txtContent = lines.join('\r\n');
  var filename = 'SCB_PAYROLL_' + State.period.replace(/\s+/g, '_') + '.txt';
  var blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์โอนเงินเดือน SCB (TXT) สำเร็จ');
}

// 3. BBL
function exportBblPayrollCsv() {
  if (!hasPermission('view_salary') || !hasPermission('export_csv')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์โอนเงินเดือน', 'warning');
    return;
  }
  var list = State.payrollList || [];
  if (list.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var csv = '\uFEFF';
  csv += 'TransactionDate,BankCode,AccountNumber,Amount,BeneficiaryName,CitizenID,Reference\n';
  var d = new Date();
  var dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

  list.forEach(function(r) {
    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
    var bCode = getBankCode(r.bankName || emp.bankName);
    var acc = String(r.bankAccount || emp.bankAccount || '').replace(/[^0-9]/g, '');
    var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '');
    var netAmt = Number(r.netPay) > 0 ? Number(r.netPay).toFixed(2) : '0.00';

    csv += [
      dateStr,
      bCode,
      acc,
      netAmt,
      '"' + (r.name || '').replace(/"/g, '""') + '"',
      citizen,
      r.empId
    ].join(',') + '\n';
  });

  var filename = 'BBL_PAYROLL_' + State.period.replace(/\s+/g, '_') + '.csv';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์โอนเงินเดือน BBL (CSV) สำเร็จ');
}

function exportBblPayrollTxt() {
  if (!hasPermission('view_salary') || !hasPermission('export_csv')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์โอนเงินเดือน', 'warning');
    return;
  }
  var list = State.payrollList || [];
  if (list.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var lines = [];
  var d = new Date();
  var dateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');

  lines.push('H' + 'BBLPAYROLL'.padEnd(20, ' ') + dateStr + String(list.length).padStart(6, '0'));
  list.forEach(function(r, idx) {
    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
    var bCode = getBankCode(r.bankName || emp.bankName);
    var acc = String(r.bankAccount || emp.bankAccount || '').replace(/[^0-9]/g, '').padEnd(15, ' ');
    var amtCents = String(Math.round((Number(r.netPay) || 0) * 100)).padStart(12, '0');
    var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '').padEnd(13, ' ');
    var name = (r.name || '').padEnd(50, ' ');

    lines.push('D' + String(idx+1).padStart(6, '0') + bCode + acc + amtCents + citizen + name);
  });
  lines.push('T' + String(list.length).padStart(6, '0'));

  var txtContent = lines.join('\r\n');
  var filename = 'BBL_PAYROLL_' + State.period.replace(/\s+/g, '_') + '.txt';
  var blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์โอนเงินเดือน BBL (TXT) สำเร็จ');
}

// 4. KTB
function exportKtbPayrollCsv() {
  if (!hasPermission('view_salary') || !hasPermission('export_csv')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์โอนเงินเดือน', 'warning');
    return;
  }
  var list = State.payrollList || [];
  if (list.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var csv = '\uFEFF';
  csv += 'VendorCode,BankCode,AccountNumber,AccountName,Amount,NationalID,Ref1\n';

  list.forEach(function(r) {
    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
    var bCode = getBankCode(r.bankName || emp.bankName);
    var acc = String(r.bankAccount || emp.bankAccount || '').replace(/[^0-9]/g, '');
    var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '');
    var netAmt = Number(r.netPay) > 0 ? Number(r.netPay).toFixed(2) : '0.00';

    csv += [
      r.empId,
      bCode,
      acc,
      '"' + (r.name || '').replace(/"/g, '""') + '"',
      netAmt,
      citizen,
      '"' + State.period + '"'
    ].join(',') + '\n';
  });

  var filename = 'KTB_PAYROLL_' + State.period.replace(/\s+/g, '_') + '.csv';
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์โอนเงินเดือน KTB (CSV) สำเร็จ');
}

function exportKtbPayrollTxt() {
  if (!hasPermission('view_salary') || !hasPermission('export_csv')) {
    showToast('คุณไม่มีสิทธิ์ส่งออกไฟล์โอนเงินเดือน', 'warning');
    return;
  }
  var list = State.payrollList || [];
  if (list.length === 0) {
    showToast('ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + State.period, 'warning');
    return;
  }

  var lines = [];
  var d = new Date();
  var dateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');

  lines.push('H' + 'KTBPAYROLL'.padEnd(20, ' ') + dateStr + String(list.length).padStart(6, '0'));
  list.forEach(function(r, idx) {
    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
    var bCode = getBankCode(r.bankName || emp.bankName);
    var acc = String(r.bankAccount || emp.bankAccount || '').replace(/[^0-9]/g, '').padEnd(15, ' ');
    var amtCents = String(Math.round((Number(r.netPay) || 0) * 100)).padStart(12, '0');
    var citizen = String(emp.citizenId || '').replace(/[^0-9]/g, '').padEnd(13, ' ');
    var name = (r.name || '').padEnd(50, ' ');

    lines.push('D' + String(idx+1).padStart(6, '0') + bCode + acc + amtCents + citizen + name);
  });
  lines.push('T' + String(list.length).padStart(6, '0'));

  var txtContent = lines.join('\r\n');
  var filename = 'KTB_PAYROLL_' + State.period.replace(/\s+/g, '_') + '.txt';
  var blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดไฟล์โอนเงินเดือน KTB (TXT) สำเร็จ');
}

// ==========================================
// TIME ATTENDANCE & PTN TIME DASHBOARD (ADMIN/SUPERVISOR)
// ==========================================

var _payrollMasterQrInterval = null;
var _payrollMasterQrSecondsLeft = 60;
var _payrollMasterQrObj = null;
var _currentAttendanceLogs = [];
var _currentAttendanceSettings = {};
var _currentAttendanceRequestStatus = 'PENDING';
var _currentAttendanceRequestType = 'ALL';
var _currentAttendanceRequestDateMode = 'ALL';
var _currentAttendanceRequestDate = '';
var _currentAttendanceRequestMonth = '';
var _currentAttendanceRequestPeriod = '';
var _currentAttendanceRequestStartDate = '';
var _currentAttendanceRequestEndDate = '';
var _currentAttendanceRequestEmpId = 'ALL';
var _currentAttendanceEmpId = 'ALL';
var _currentAttendanceDateMode = 'SINGLE';
var _currentAttendancePeriod = '';
var _currentAttendanceEmployeeList = [];
var _currentAttendanceEmpSummary = null;
var _currentAttendanceIsIndividual = false;
var _currentAttendanceSelectedEmpInfo = null;

function getAttendanceCutoffDatesClient(periodStr, customCutDay) {
  var cutDay = customCutDay;
  if (!cutDay) {
    if (_currentAttendanceSettings && _currentAttendanceSettings.cutoff_day) {
      cutDay = Number(_currentAttendanceSettings.cutoff_day);
    } else if (State.settings && State.settings.cutoff_day) {
      cutDay = Number(State.settings.cutoff_day);
    } else {
      var cutEl = document.getElementById('attSetCutoffDay');
      if (cutEl && cutEl.value) cutDay = Number(cutEl.value);
    }
  }
  if (!cutDay || isNaN(cutDay) || cutDay < 1 || cutDay > 31) cutDay = 25;

  var yearCE = new Date().getFullYear();
  var month = new Date().getMonth() + 1;

  if (periodStr) {
    var str = String(periodStr).trim();
    var ym = str.match(/^(\d{4})-(\d{1,2})$/);
    if (ym) {
      var y = parseInt(ym[1], 10);
      if (y > 2400) y -= 543;
      yearCE = y;
      month = parseInt(ym[2], 10);
    }
  }

  var prevMonth = month - 1;
  var prevYear = yearCE;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }

  var startDate, endDate;
  if (cutDay >= 30) {
    var daysInMonth = new Date(yearCE, month, 0).getDate();
    var actualEndDay = Math.min(cutDay, daysInMonth);
    startDate = yearCE + '-' + String(month).padStart(2, '0') + '-01';
    endDate = yearCE + '-' + String(month).padStart(2, '0') + '-' + String(actualEndDay).padStart(2, '0');
  } else {
    var startDay = cutDay + 1;
    startDate = prevYear + '-' + String(prevMonth).padStart(2, '0') + '-' + String(startDay).padStart(2, '0');
    endDate = yearCE + '-' + String(month).padStart(2, '0') + '-' + String(cutDay).padStart(2, '0');
  }

  var thaiShortMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var sParts = startDate.split('-');
  var eParts = endDate.split('-');
  var sDay = parseInt(sParts[2], 10);
  var sMon = thaiShortMonths[parseInt(sParts[1], 10) - 1];
  var sYear = parseInt(sParts[0], 10) + 543;
  var eDay = parseInt(eParts[2], 10);
  var eMon = thaiShortMonths[parseInt(eParts[1], 10) - 1];
  var eYear = parseInt(eParts[0], 10) + 543;

  var label = sDay + ' ' + sMon + ' ' + sYear + ' - ' + eDay + ' ' + eMon + ' ' + eYear;

  return {
    startDate: startDate,
    endDate: endDate,
    month: month,
    yearCE: yearCE,
    cutoffDay: cutDay,
    label: label
  };
}

function updateAttendancePeriodBadge() {
  var periodInput = document.getElementById('attFilterPeriod');
  var badge = document.getElementById('attFilterPeriodCutoffBadge');
  if (badge) {
    var pVal = periodInput ? periodInput.value : '';
    if (!pVal) {
      var nowUtc = new Date();
      var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
      pVal = bangkok.toISOString().substring(0, 7);
      if (periodInput) periodInput.value = pVal;
    }
    var info = getAttendanceCutoffDatesClient(pVal);
    badge.innerHTML = '<i class="fa-solid fa-arrows-rotate" style="font-size:10px"></i> ' + esc(info.label);
  }
}

function onAttendancePeriodChanged() {
  var periodInput = document.getElementById('attFilterPeriod');
  _currentAttendancePeriod = periodInput ? periodInput.value : '';
  updateAttendancePeriodBadge();
  loadTimeAttendanceDashboard();
}

function setAttendanceFilterThisPeriod() {
  var periodInput = document.getElementById('attFilterPeriod');
  if (periodInput) {
    var nowUtc = new Date();
    var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    periodInput.value = bangkok.toISOString().substring(0, 7);
    _currentAttendancePeriod = periodInput.value;
  }
  updateAttendancePeriodBadge();
  loadTimeAttendanceDashboard();
}

function setAttendanceRequestFilter(status) {
  _currentAttendanceRequestStatus = status || 'PENDING';
  ['PENDING', 'APPROVED', 'REJECTED', 'ALL'].forEach(function(s) {
    var btn = document.getElementById('btnAttReqFilter_' + s);
    if (btn) {
      if (s === _currentAttendanceRequestStatus) {
        btn.style.background = '#fff';
        btn.style.color = '#0f172a';
        btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#64748b';
        btn.style.boxShadow = 'none';
      }
    }
  });
  loadTimeAttendanceDashboard();
}

function onAttendanceDateModeChanged() {
  var modeEl = document.getElementById('attFilterDateMode');
  _currentAttendanceDateMode = modeEl ? modeEl.value : 'SINGLE';

  var wrapSingle = document.getElementById('attFilterDateWrapSingle');
  var wrapMonth = document.getElementById('attFilterDateWrapMonth');
  var wrapPeriod = document.getElementById('attFilterDateWrapPeriod');
  var wrapRange = document.getElementById('attFilterDateWrapRange');

  if (wrapSingle) wrapSingle.style.display = (_currentAttendanceDateMode === 'SINGLE' ? 'flex' : 'none');
  if (wrapMonth) wrapMonth.style.display = (_currentAttendanceDateMode === 'MONTH' ? 'flex' : 'none');
  if (wrapPeriod) wrapPeriod.style.display = (_currentAttendanceDateMode === 'PERIOD' ? 'flex' : 'none');
  if (wrapRange) wrapRange.style.display = (_currentAttendanceDateMode === 'RANGE' ? 'flex' : 'none');

  if (_currentAttendanceDateMode === 'MONTH') {
    var monthInput = document.getElementById('attFilterMonth');
    if (monthInput && !monthInput.value) {
      var nowUtc = new Date();
      var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
      monthInput.value = bangkok.toISOString().substring(0, 7);
    }
  } else if (_currentAttendanceDateMode === 'PERIOD') {
    var periodInput = document.getElementById('attFilterPeriod');
    if (periodInput && !periodInput.value) {
      var nowUtc = new Date();
      var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
      periodInput.value = bangkok.toISOString().substring(0, 7);
    }
    updateAttendancePeriodBadge();
  } else if (_currentAttendanceDateMode === 'RANGE') {
    var startInput = document.getElementById('attFilterStartDate');
    var endInput = document.getElementById('attFilterEndDate');
    var nowUtc = new Date();
    var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    var todayStr = bangkok.toISOString().substring(0, 10);
    if (startInput && !startInput.value) {
      var firstDay = new Date(bangkok.getFullYear(), bangkok.getMonth(), 1);
      var m = String(firstDay.getMonth() + 1).padStart(2, '0');
      var d = String(firstDay.getDate()).padStart(2, '0');
      startInput.value = firstDay.getFullYear() + '-' + m + '-' + d;
    }
    if (endInput && !endInput.value) {
      endInput.value = todayStr;
    }
  }

  loadTimeAttendanceDashboard();
}

function setAttendanceFilterThisMonth() {
  var monthInput = document.getElementById('attFilterMonth');
  if (monthInput) {
    var nowUtc = new Date();
    var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    monthInput.value = bangkok.toISOString().substring(0, 7);
  }
  loadTimeAttendanceDashboard();
}

var _activeAttendanceEmpDropdownIdx = -1;

function openAttendanceEmpDropdown() {
  var menu = document.getElementById('attFilterEmpDropdown');
  if (menu) {
    var searchInput = document.getElementById('attFilterEmpSearchInput');
    filterAttendanceEmpDropdown(searchInput ? searchInput.value : '');
    menu.style.display = 'block';
  }
}

function closeAttendanceEmpDropdown() {
  var menu = document.getElementById('attFilterEmpDropdown');
  if (menu) {
    menu.style.display = 'none';
  }
  _activeAttendanceEmpDropdownIdx = -1;
}

function toggleAttendanceEmpDropdown(e) {
  if (e) e.stopPropagation();
  var menu = document.getElementById('attFilterEmpDropdown');
  if (menu) {
    if (menu.style.display === 'block') {
      closeAttendanceEmpDropdown();
    } else {
      openAttendanceEmpDropdown();
    }
  }
}

function selectAttendanceEmp(empId, displayText) {
  _currentAttendanceEmpId = empId || 'ALL';
  var selMain = document.getElementById('attFilterEmp');
  if (selMain) selMain.value = _currentAttendanceEmpId;

  var searchInput = document.getElementById('attFilterEmpSearchInput');
  var clearBtn = document.getElementById('btnAttEmpSearchClear');
  var chevronIcon = document.getElementById('iconAttEmpDropdownChevron');

  if (searchInput) {
    if (_currentAttendanceEmpId === 'ALL') {
      searchInput.value = '';
      searchInput.placeholder = '🔍 พิมพ์ชื่อ / รหัส / ชื่อเล่น...';
    } else {
      searchInput.value = displayText || _currentAttendanceEmpId;
    }
  }

  if (clearBtn && chevronIcon) {
    if (_currentAttendanceEmpId === 'ALL') {
      clearBtn.style.display = 'none';
      chevronIcon.style.display = 'block';
    } else {
      clearBtn.style.display = 'block';
      chevronIcon.style.display = 'none';
    }
  }

  closeAttendanceEmpDropdown();
  loadTimeAttendanceDashboard();
}

function clearAttendanceEmpSearch(e) {
  if (e) e.stopPropagation();
  selectAttendanceEmp('ALL', '');
}

function filterAttendanceEmpDropdown(query) {
  var menu = document.getElementById('attFilterEmpDropdown');
  if (!menu) return;

  var q = (query || '').trim().toLowerCase();
  var list = _currentAttendanceEmployeeList || [];

  // Filter items matching query
  var filtered = list.filter(function(e) {
    if (!q) return true;
    var idMatch = (e.emp_id || '').toLowerCase().includes(q);
    var nameMatch = (e.name || e.full_name || '').toLowerCase().includes(q);
    var nickMatch = (e.nickname || '').toLowerCase().includes(q);
    var deptMatch = (e.department || '').toLowerCase().includes(q);
    return idMatch || nameMatch || nickMatch || deptMatch;
  });

  var html = '';

  // Top item: All Employees
  var isAllSelected = (_currentAttendanceEmpId === 'ALL');
  html += '<div class="att-emp-item ' + (isAllSelected ? 'selected' : '') + '" onclick="selectAttendanceEmp(\'ALL\', \'\')" style="padding:7px 10px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;background:' + (isAllSelected ? '#eff6ff' : 'transparent') + ';color:' + (isAllSelected ? '#1d4ed8' : '#0f172a') + ';margin-bottom:2px;font-weight:' + (isAllSelected ? '700' : '500') + '">' +
    '<div style="display:flex;align-items:center;gap:8px">' +
      '<span style="width:24px;height:24px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:11px">👥</span>' +
      '<span style="font-size:12px">พนักงานทุกคน (All)</span>' +
    '</div>' +
    (isAllSelected ? '<i class="fa-solid fa-check text-blue" style="font-size:11px"></i>' : '') +
  '</div>';

  if (filtered.length === 0) {
    html += '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px"><i class="fa-solid fa-user-slash" style="font-size:18px;display:block;margin-bottom:4px;opacity:0.6"></i>ไม่พบพนักงานที่ค้นหา</div>';
  } else {
    html += '<div style="height:1px;background:#e2e8f0;margin:3px 0"></div>';
    filtered.forEach(function(e) {
      var isSelected = (_currentAttendanceEmpId === e.emp_id);
      var displayName = (e.name || e.full_name || '') + (e.nickname ? ' (' + e.nickname + ')' : '');
      var displayFull = e.emp_id + ' - ' + displayName;

      html += '<div class="att-emp-item ' + (isSelected ? 'selected' : '') + '" onclick="selectAttendanceEmp(\'' + esc(e.emp_id) + '\', \'' + esc(displayFull) + '\')" style="padding:6px 10px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;background:' + (isSelected ? '#eff6ff' : 'transparent') + ';color:' + (isSelected ? '#1d4ed8' : '#0f172a') + ';font-size:12px;margin-bottom:1px;transition:background 0.15s" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'' + (isSelected ? '#eff6ff' : 'transparent') + '\'">' +
        '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          '<div style="font-weight:' + (isSelected ? '700' : '600') + ';overflow:hidden;text-overflow:ellipsis">' + esc(displayName) + '</div>' +
          '<div style="font-size:10.5px;color:#64748b;display:flex;gap:4px;align-items:center;margin-top:1px">' +
            '<span style="background:#e0f2fe;color:#0369a1;padding:0 4px;border-radius:3px;font-weight:600">' + esc(e.emp_id) + '</span>' +
            (e.department ? '<span style="color:#64748b">• ' + esc(e.department) + '</span>' : '') +
          '</div>' +
        '</div>' +
        (isSelected ? '<i class="fa-solid fa-check text-blue" style="font-size:11px;flex-shrink:0"></i>' : '') +
      '</div>';
    });
  }

  menu.innerHTML = html;
  menu.style.display = 'block';
}

function handleAttendanceEmpKeydown(e) {
  var menu = document.getElementById('attFilterEmpDropdown');
  if (!menu || menu.style.display !== 'block') {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      openAttendanceEmpDropdown();
    }
    return;
  }

  var items = menu.querySelectorAll('.att-emp-item');
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _activeAttendanceEmpDropdownIdx++;
    if (_activeAttendanceEmpDropdownIdx >= items.length) _activeAttendanceEmpDropdownIdx = 0;
    updateAttendanceDropdownHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _activeAttendanceEmpDropdownIdx--;
    if (_activeAttendanceEmpDropdownIdx < 0) _activeAttendanceEmpDropdownIdx = items.length - 1;
    updateAttendanceDropdownHighlight(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_activeAttendanceEmpDropdownIdx >= 0 && _activeAttendanceEmpDropdownIdx < items.length) {
      items[_activeAttendanceEmpDropdownIdx].click();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeAttendanceEmpDropdown();
  }
}

function updateAttendanceDropdownHighlight(items) {
  items.forEach(function(it, idx) {
    if (idx === _activeAttendanceEmpDropdownIdx) {
      it.style.background = '#e2e8f0';
      it.scrollIntoView({ block: 'nearest' });
    } else {
      it.style.background = it.classList.contains('selected') ? '#eff6ff' : 'transparent';
    }
  });
}

// Global click listener to close dropdowns when clicking outside
if (typeof window._attEmpClickBound === 'undefined') {
  window._attEmpClickBound = true;
  document.addEventListener('click', function(e) {
    var comboWrapper = document.getElementById('attFilterEmpComboWrapper');
    if (comboWrapper && !comboWrapper.contains(e.target)) {
      closeAttendanceEmpDropdown();
    }
    var reqComboWrapper = document.getElementById('attReqEmpComboWrapper');
    if (reqComboWrapper && !reqComboWrapper.contains(e.target)) {
      closeAttendanceReqEmpDropdown();
    }
  });
}

function onAttendanceEmpFilterChanged() {
  var empEl = document.getElementById('attFilterEmp');
  _currentAttendanceEmpId = empEl ? empEl.value : 'ALL';
  loadTimeAttendanceDashboard();
}

function resetAttendanceEmpFilter() {
  selectAttendanceEmp('ALL', '');
}

function populateAttendanceEmployeeSelects(empList) {
  if (!empList || !Array.isArray(empList)) return;
  _currentAttendanceEmployeeList = empList;

  // 1. Main filter dropdown & search input
  var selMain = document.getElementById('attFilterEmp');
  if (selMain) {
    var currVal = selMain.value || _currentAttendanceEmpId || 'ALL';
    var opts = '<option value="ALL">👥 พนักงานทุกคน (All)</option>';
    empList.forEach(function(e) {
      var display = e.emp_id + ' - ' + (e.name || e.full_name || '') + (e.nickname ? ' (' + e.nickname + ')' : '');
      opts += '<option value="' + esc(e.emp_id) + '">' + esc(display) + '</option>';
    });
    selMain.innerHTML = opts;
    if (currVal && (currVal === 'ALL' || empList.some(function(x) { return x.emp_id === currVal; }))) {
      selMain.value = currVal;
    } else {
      selMain.value = 'ALL';
    }
  }

  // Update Search input text & clear button
  var searchInput = document.getElementById('attFilterEmpSearchInput');
  var clearBtn = document.getElementById('btnAttEmpSearchClear');
  var chevronIcon = document.getElementById('iconAttEmpDropdownChevron');
  if (searchInput) {
    if (_currentAttendanceEmpId && _currentAttendanceEmpId !== 'ALL') {
      var found = empList.find(function(x) { return x.emp_id === _currentAttendanceEmpId; });
      if (found) {
        searchInput.value = found.emp_id + ' - ' + (found.name || found.full_name || '') + (found.nickname ? ' (' + found.nickname + ')' : '');
      }
      if (clearBtn) clearBtn.style.display = 'block';
      if (chevronIcon) chevronIcon.style.display = 'none';
    } else {
      if (clearBtn) clearBtn.style.display = 'none';
      if (chevronIcon) chevronIcon.style.display = 'block';
    }
  }

  // 2. Request filter dropdown & search input
  var selReq = document.getElementById('attReqEmpFilter');
  if (selReq) {
    var currReqVal = selReq.value || _currentAttendanceRequestEmpId || 'ALL';
    var reqOpts = '<option value="ALL">👥 ทุกคน</option>';
    empList.forEach(function(e) {
      var display = e.emp_id + ' - ' + (e.name || e.full_name || '');
      reqOpts += '<option value="' + esc(e.emp_id) + '">' + esc(display) + '</option>';
    });
    selReq.innerHTML = reqOpts;
    if (currReqVal && (currReqVal === 'ALL' || empList.some(function(x) { return x.emp_id === currReqVal; }))) {
      selReq.value = currReqVal;
    } else {
      selReq.value = 'ALL';
    }
  }

  // Update Request Search input text & clear button
  var reqSearchInput = document.getElementById('attReqEmpSearchInput');
  var reqClearBtn = document.getElementById('btnAttReqEmpSearchClear');
  var reqChevronIcon = document.getElementById('iconAttReqEmpDropdownChevron');
  if (reqSearchInput) {
    if (_currentAttendanceRequestEmpId && _currentAttendanceRequestEmpId !== 'ALL') {
      var foundReq = empList.find(function(x) { return x.emp_id === _currentAttendanceRequestEmpId; });
      if (foundReq) {
        reqSearchInput.value = foundReq.emp_id + ' - ' + (foundReq.name || foundReq.full_name || '') + (foundReq.nickname ? ' (' + foundReq.nickname + ')' : '');
      }
      if (reqClearBtn) reqClearBtn.style.display = 'block';
      if (reqChevronIcon) reqChevronIcon.style.display = 'none';
    } else {
      if (reqClearBtn) reqClearBtn.style.display = 'none';
      if (reqChevronIcon) reqChevronIcon.style.display = 'block';
    }
  }
}

var _activeAttendanceReqEmpDropdownIdx = -1;

function openAttendanceReqEmpDropdown() {
  var menu = document.getElementById('attReqEmpDropdown');
  if (menu) {
    var searchInput = document.getElementById('attReqEmpSearchInput');
    filterAttendanceReqEmpDropdown(searchInput ? searchInput.value : '');
    menu.style.display = 'block';
  }
}

function closeAttendanceReqEmpDropdown() {
  var menu = document.getElementById('attReqEmpDropdown');
  if (menu) {
    menu.style.display = 'none';
  }
  _activeAttendanceReqEmpDropdownIdx = -1;
}

function toggleAttendanceReqEmpDropdown(e) {
  if (e) e.stopPropagation();
  var menu = document.getElementById('attReqEmpDropdown');
  if (menu) {
    if (menu.style.display === 'block') {
      closeAttendanceReqEmpDropdown();
    } else {
      openAttendanceReqEmpDropdown();
    }
  }
}

function selectAttendanceReqEmp(empId, displayText) {
  _currentAttendanceRequestEmpId = empId || 'ALL';
  var selReq = document.getElementById('attReqEmpFilter');
  if (selReq) selReq.value = _currentAttendanceRequestEmpId;

  var searchInput = document.getElementById('attReqEmpSearchInput');
  var clearBtn = document.getElementById('btnAttReqEmpSearchClear');
  var chevronIcon = document.getElementById('iconAttReqEmpDropdownChevron');

  if (searchInput) {
    if (_currentAttendanceRequestEmpId === 'ALL') {
      searchInput.value = '';
      searchInput.placeholder = '🔍 ค้นหาพนักงาน...';
    } else {
      searchInput.value = displayText || _currentAttendanceRequestEmpId;
    }
  }

  if (clearBtn && chevronIcon) {
    if (_currentAttendanceRequestEmpId === 'ALL') {
      clearBtn.style.display = 'none';
      chevronIcon.style.display = 'block';
    } else {
      clearBtn.style.display = 'block';
      chevronIcon.style.display = 'none';
    }
  }

  closeAttendanceReqEmpDropdown();
  loadTimeAttendanceDashboard();
}

function clearAttendanceReqEmpSearch(e) {
  if (e) e.stopPropagation();
  selectAttendanceReqEmp('ALL', '');
}

function filterAttendanceReqEmpDropdown(query) {
  var menu = document.getElementById('attReqEmpDropdown');
  if (!menu) return;

  var q = (query || '').trim().toLowerCase();
  var list = _currentAttendanceEmployeeList || [];

  var filtered = list.filter(function(e) {
    if (!q) return true;
    var idMatch = (e.emp_id || '').toLowerCase().includes(q);
    var nameMatch = (e.name || e.full_name || '').toLowerCase().includes(q);
    var nickMatch = (e.nickname || '').toLowerCase().includes(q);
    var deptMatch = (e.department || '').toLowerCase().includes(q);
    return idMatch || nameMatch || nickMatch || deptMatch;
  });

  var html = '';

  var isAllSelected = (_currentAttendanceRequestEmpId === 'ALL');
  html += '<div class="att-req-emp-item ' + (isAllSelected ? 'selected' : '') + '" onclick="selectAttendanceReqEmp(\'ALL\', \'\')" style="padding:6px 8px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;background:' + (isAllSelected ? '#eff6ff' : 'transparent') + ';color:' + (isAllSelected ? '#1d4ed8' : '#0f172a') + ';margin-bottom:2px;font-weight:' + (isAllSelected ? '700' : '500') + '">' +
    '<div style="display:flex;align-items:center;gap:6px">' +
      '<span style="width:20px;height:20px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:10px">👥</span>' +
      '<span style="font-size:11.5px">ทุกคน (All)</span>' +
    '</div>' +
    (isAllSelected ? '<i class="fa-solid fa-check text-blue" style="font-size:10px"></i>' : '') +
  '</div>';

  if (filtered.length === 0) {
    html += '<div style="padding:14px;text-align:center;color:#94a3b8;font-size:11.5px"><i class="fa-solid fa-user-slash" style="font-size:16px;display:block;margin-bottom:3px;opacity:0.6"></i>ไม่พบพนักงาน</div>';
  } else {
    html += '<div style="height:1px;background:#e2e8f0;margin:3px 0"></div>';
    filtered.forEach(function(e) {
      var isSelected = (_currentAttendanceRequestEmpId === e.emp_id);
      var displayName = (e.name || e.full_name || '') + (e.nickname ? ' (' + e.nickname + ')' : '');
      var displayFull = e.emp_id + ' - ' + displayName;

      html += '<div class="att-req-emp-item ' + (isSelected ? 'selected' : '') + '" onclick="selectAttendanceReqEmp(\'' + esc(e.emp_id) + '\', \'' + esc(displayFull) + '\')" style="padding:5px 8px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:6px;background:' + (isSelected ? '#eff6ff' : 'transparent') + ';color:' + (isSelected ? '#1d4ed8' : '#0f172a') + ';font-size:11.5px;margin-bottom:1px;transition:background 0.15s" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'' + (isSelected ? '#eff6ff' : 'transparent') + '\'">' +
        '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          '<div style="font-weight:' + (isSelected ? '700' : '600') + ';overflow:hidden;text-overflow:ellipsis">' + esc(displayName) + '</div>' +
          '<div style="font-size:10px;color:#64748b;display:flex;gap:4px;align-items:center;margin-top:1px">' +
            '<span style="background:#e0f2fe;color:#0369a1;padding:0 3px;border-radius:3px;font-weight:600">' + esc(e.emp_id) + '</span>' +
            (e.department ? '<span style="color:#64748b">• ' + esc(e.department) + '</span>' : '') +
          '</div>' +
        '</div>' +
        (isSelected ? '<i class="fa-solid fa-check text-blue" style="font-size:10px;flex-shrink:0"></i>' : '') +
      '</div>';
    });
  }

  menu.innerHTML = html;
  menu.style.display = 'block';
}

function handleAttendanceReqEmpKeydown(e) {
  var menu = document.getElementById('attReqEmpDropdown');
  if (!menu || menu.style.display !== 'block') {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      openAttendanceReqEmpDropdown();
    }
    return;
  }

  var items = menu.querySelectorAll('.att-req-emp-item');
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _activeAttendanceReqEmpDropdownIdx++;
    if (_activeAttendanceReqEmpDropdownIdx >= items.length) _activeAttendanceReqEmpDropdownIdx = 0;
    updateAttendanceReqDropdownHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _activeAttendanceReqEmpDropdownIdx--;
    if (_activeAttendanceReqEmpDropdownIdx < 0) _activeAttendanceReqEmpDropdownIdx = items.length - 1;
    updateAttendanceReqDropdownHighlight(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_activeAttendanceReqEmpDropdownIdx >= 0 && _activeAttendanceReqEmpDropdownIdx < items.length) {
      items[_activeAttendanceReqEmpDropdownIdx].click();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeAttendanceReqEmpDropdown();
  }
}

function updateAttendanceReqDropdownHighlight(items) {
  items.forEach(function(it, idx) {
    if (idx === _activeAttendanceReqEmpDropdownIdx) {
      it.style.background = '#e2e8f0';
      it.scrollIntoView({ block: 'nearest' });
    } else {
      it.style.background = it.classList.contains('selected') ? '#eff6ff' : 'transparent';
    }
  });
}

function onAttendanceReqDateModeChanged() {
  var modeEl = document.getElementById('attReqDateMode');
  _currentAttendanceRequestDateMode = modeEl ? modeEl.value : 'ALL';

  var wrapSingle = document.getElementById('attReqDateWrapSingle');
  var wrapMonth = document.getElementById('attReqDateWrapMonth');
  var wrapPeriod = document.getElementById('attReqDateWrapPeriod');
  var wrapRange = document.getElementById('attReqDateWrapRange');

  if (wrapSingle) wrapSingle.style.display = (_currentAttendanceRequestDateMode === 'SINGLE' ? 'inline-flex' : 'none');
  if (wrapMonth) wrapMonth.style.display = (_currentAttendanceRequestDateMode === 'MONTH' ? 'inline-flex' : 'none');
  if (wrapPeriod) wrapPeriod.style.display = (_currentAttendanceRequestDateMode === 'PERIOD' ? 'inline-flex' : 'none');
  if (wrapRange) wrapRange.style.display = (_currentAttendanceRequestDateMode === 'RANGE' ? 'inline-flex' : 'none');

  var nowUtc = new Date();
  var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
  var todayStr = bangkok.toISOString().substring(0, 10);
  var currentMonthStr = bangkok.toISOString().substring(0, 7);

  if (_currentAttendanceRequestDateMode === 'SINGLE') {
    var dateInput = document.getElementById('attReqDate') || document.getElementById('attReqDateFilter');
    if (dateInput && !dateInput.value) {
      dateInput.value = todayStr;
    }
  } else if (_currentAttendanceRequestDateMode === 'MONTH') {
    var monthInput = document.getElementById('attReqMonth');
    if (monthInput && !monthInput.value) {
      monthInput.value = currentMonthStr;
    }
  } else if (_currentAttendanceRequestDateMode === 'PERIOD') {
    var periodInput = document.getElementById('attReqPeriod');
    if (periodInput && !periodInput.value) {
      periodInput.value = currentMonthStr;
    }
    updateAttendanceReqPeriodBadge();
  } else if (_currentAttendanceRequestDateMode === 'RANGE') {
    var startInput = document.getElementById('attReqStartDate');
    var endInput = document.getElementById('attReqEndDate');
    if (startInput && !startInput.value) {
      var firstDay = new Date(bangkok.getFullYear(), bangkok.getMonth(), 1);
      var m = String(firstDay.getMonth() + 1).padStart(2, '0');
      var d = String(firstDay.getDate()).padStart(2, '0');
      startInput.value = firstDay.getFullYear() + '-' + m + '-' + d;
    }
    if (endInput && !endInput.value) {
      endInput.value = todayStr;
    }
  }

  loadTimeAttendanceDashboard();
}

function updateAttendanceReqPeriodBadge() {
  var periodInput = document.getElementById('attReqPeriod');
  var badge = document.getElementById('attReqPeriodCutoffBadge');
  if (badge) {
    var pVal = periodInput ? periodInput.value : '';
    if (!pVal) {
      var nowUtc = new Date();
      var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
      pVal = bangkok.toISOString().substring(0, 7);
      if (periodInput) periodInput.value = pVal;
    }
    var info = getAttendanceCutoffDatesClient(pVal);
    badge.innerHTML = '<i class="fa-solid fa-arrows-rotate" style="font-size:9.5px"></i> ' + esc(info.label);
  }
}

function onAttendanceReqPeriodChanged() {
  updateAttendanceReqPeriodBadge();
  loadTimeAttendanceDashboard();
}

function setAttendanceReqPeriodCurrent() {
  var periodInput = document.getElementById('attReqPeriod');
  if (periodInput) {
    var nowUtc = new Date();
    var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    periodInput.value = bangkok.toISOString().substring(0, 7);
  }
  updateAttendanceReqPeriodBadge();
  loadTimeAttendanceDashboard();
}

function setAttendanceReqMonthCurrent() {
  var monthInput = document.getElementById('attReqMonth');
  if (monthInput) {
    var nowUtc = new Date();
    var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    monthInput.value = bangkok.toISOString().substring(0, 7);
  }
  loadTimeAttendanceDashboard();
}

function onAttendanceReqFiltersChanged() {
  var typeEl = document.getElementById('attReqTypeFilter');
  var empEl = document.getElementById('attReqEmpFilter');
  var dateEl = document.getElementById('attReqDate') || document.getElementById('attReqDateFilter');
  var monthEl = document.getElementById('attReqMonth');
  var periodEl = document.getElementById('attReqPeriod');
  var startEl = document.getElementById('attReqStartDate');
  var endEl = document.getElementById('attReqEndDate');

  _currentAttendanceRequestType = typeEl ? typeEl.value : 'ALL';
  _currentAttendanceRequestEmpId = empEl ? empEl.value : 'ALL';
  _currentAttendanceRequestDate = dateEl ? dateEl.value : '';
  _currentAttendanceRequestMonth = monthEl ? monthEl.value : '';
  _currentAttendanceRequestPeriod = periodEl ? periodEl.value : '';
  _currentAttendanceRequestStartDate = startEl ? startEl.value : '';
  _currentAttendanceRequestEndDate = endEl ? endEl.value : '';

  loadTimeAttendanceDashboard();
}

function clearAttendanceReqDateFilter() {
  var modeEl = document.getElementById('attReqDateMode');
  if (modeEl) modeEl.value = 'ALL';
  _currentAttendanceRequestDateMode = 'ALL';
  onAttendanceReqDateModeChanged();
}

function setAttendanceReqDateToday() {
  var dateEl = document.getElementById('attReqDate') || document.getElementById('attReqDateFilter');
  var nowUtc = new Date();
  var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
  var todayStr = bangkok.toISOString().substring(0, 10);
  if (dateEl) dateEl.value = todayStr;
  _currentAttendanceRequestDate = todayStr;
  loadTimeAttendanceDashboard();
}

function resetAttendanceRequestFilters() {
  _currentAttendanceRequestStatus = 'PENDING';
  _currentAttendanceRequestType = 'ALL';
  _currentAttendanceRequestDateMode = 'ALL';
  _currentAttendanceRequestDate = '';
  _currentAttendanceRequestMonth = '';
  _currentAttendanceRequestPeriod = '';
  _currentAttendanceRequestStartDate = '';
  _currentAttendanceRequestEndDate = '';
  selectAttendanceReqEmp('ALL', '');
  var typeEl = document.getElementById('attReqTypeFilter');
  if (typeEl) typeEl.value = 'ALL';
  var modeEl = document.getElementById('attReqDateMode');
  if (modeEl) modeEl.value = 'ALL';
  onAttendanceReqDateModeChanged();
  ['PENDING', 'APPROVED', 'REJECTED', 'ALL'].forEach(function(s) {
    var btn = document.getElementById('btnAttReqFilter_' + s);
    if (btn) {
      if (s === 'PENDING') {
        btn.style.background = '#fff';
        btn.style.color = '#0f172a';
        btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#64748b';
        btn.style.boxShadow = 'none';
      }
    }
  });
}

function calcHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  var R = 6371e3;
  var p1 = (lat1 * Math.PI) / 180;
  var p2 = (lat2 * Math.PI) / 180;
  var dp = ((lat2 - lat1) * Math.PI) / 180;
  var dl = ((lon2 - lon1) * Math.PI) / 180;
  var a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function loadTimeAttendanceDashboard() {
  if (!isSuperAdmin() && !hasPermission('view_attendance')) {
    showToast('สิทธิ์ไม่เพียงพอ: หน้าลงเวลาสงวนสิทธิ์เฉพาะผู้มีสิทธิ์เข้าใช้งานระบบลงเวลาเท่านั้น', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  var filterInput = document.getElementById('attFilterDate');
  if (filterInput && !filterInput.value) {
    var nowUtc = new Date();
    var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    filterInput.value = bangkok.toISOString().substring(0, 10);
  }
  var filterDate = filterInput ? filterInput.value : '';
  var filterBranch = (document.getElementById('attFilterBranch') && document.getElementById('attFilterBranch').value) || 'ALL';
  var filterEmp = (document.getElementById('attFilterEmp') && document.getElementById('attFilterEmp').value) || _currentAttendanceEmpId || 'ALL';
  var dateMode = (document.getElementById('attFilterDateMode') && document.getElementById('attFilterDateMode').value) || _currentAttendanceDateMode || 'SINGLE';
  var filterMonth = (document.getElementById('attFilterMonth') && document.getElementById('attFilterMonth').value) || '';
  var filterPeriod = (document.getElementById('attFilterPeriod') && document.getElementById('attFilterPeriod').value) || _currentAttendancePeriod || '';
  var filterStartDate = (document.getElementById('attFilterStartDate') && document.getElementById('attFilterStartDate').value) || '';
  var filterEndDate = (document.getElementById('attFilterEndDate') && document.getElementById('attFilterEndDate').value) || '';

  var reqEmpId = (document.getElementById('attReqEmpFilter') && document.getElementById('attReqEmpFilter').value) || _currentAttendanceRequestEmpId || 'ALL';
  var reqDateMode = (document.getElementById('attReqDateMode') && document.getElementById('attReqDateMode').value) || _currentAttendanceRequestDateMode || 'ALL';
  var reqDate = (document.getElementById('attReqDate') && document.getElementById('attReqDate').value) || _currentAttendanceRequestDate || '';
  var reqMonth = (document.getElementById('attReqMonth') && document.getElementById('attReqMonth').value) || _currentAttendanceRequestMonth || '';
  var reqPeriod = (document.getElementById('attReqPeriod') && document.getElementById('attReqPeriod').value) || _currentAttendanceRequestPeriod || '';
  var reqStartDate = (document.getElementById('attReqStartDate') && document.getElementById('attReqStartDate').value) || _currentAttendanceRequestStartDate || '';
  var reqEndDate = (document.getElementById('attReqEndDate') && document.getElementById('attReqEndDate').value) || _currentAttendanceRequestEndDate || '';

  var logsBody = document.getElementById('attLogsTableBody');
  if (logsBody) {
    logsBody.innerHTML = '<tr><td colspan="14" class="text-center text-muted" style="padding:24px"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูลเวลาทำงานและรูปถ่าย...</td></tr>';
  }

  callApi('getTimeAttendanceDashboard', {
    date: filterDate,
    branchId: filterBranch,
    empId: filterEmp,
    dateMode: dateMode,
    month: filterMonth,
    period: filterPeriod,
    startDate: filterStartDate,
    endDate: filterEndDate,
    requestStatus: _currentAttendanceRequestStatus,
    requestType: _currentAttendanceRequestType,
    requestDateMode: reqDateMode,
    requestDate: reqDate,
    requestMonth: reqMonth,
    requestPeriod: reqPeriod,
    requestStartDate: reqStartDate,
    requestEndDate: reqEndDate,
    requestEmpId: reqEmpId,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (!r || !r.success) {
        showToast(r && r.message ? r.message : 'ไม่สามารถโหลดข้อมูลเวลาทำงานได้', 'error');
        return;
      }

      if (r.branches) {
        State.branches = r.branches;
        populateBranchSelects();
        renderBranchEarlyDismissalBar();
      }

      if (r.employeeList) {
        populateAttendanceEmployeeSelects(r.employeeList);
      }

      _currentAttendanceLogs = r.logsToday || [];
      _currentAttendanceSettings = r.settings || {};
      _currentAttendanceEmpSummary = r.empSummary || null;
      _currentAttendanceIsIndividual = !!r.isIndividualView;
      _currentAttendanceSelectedEmpInfo = r.selectedEmpInfo || null;

      // Toggle Print Timesheet button
      var btnPrintTimesheet = document.getElementById('btnAttPrintTimesheet');
      if (btnPrintTimesheet) {
        btnPrintTimesheet.style.display = _currentAttendanceIsIndividual ? 'inline-flex' : 'none';
      }

      // Update Cutoff Badges from backend response
      if (r.cutoffDates && r.cutoffDates.label) {
        var badge = document.getElementById('attFilterPeriodCutoffBadge');
        if (badge) badge.innerHTML = '<i class="fa-solid fa-arrows-rotate" style="font-size:10px"></i> ' + esc(r.cutoffDates.label);
      }
      if (r.reqCutoffDates && r.reqCutoffDates.label) {
        var reqBadge = document.getElementById('attReqPeriodCutoffBadge');
        if (reqBadge) reqBadge.innerHTML = '<i class="fa-solid fa-arrows-rotate" style="font-size:9.5px"></i> ' + esc(r.reqCutoffDates.label);
      }

      // 1. Update KPI
      if (r.kpi) {
        var elIn = document.getElementById('attKpiClockedIn');
        var elLate = document.getElementById('attKpiLate');
        var elPend = document.getElementById('attKpiPending');
        var elTot = document.getElementById('attKpiTotal');
        if (elIn) elIn.innerHTML = (r.kpi.clockedIn || 0) + ' <span style="font-size:12px;font-weight:400;color:var(--text-muted)">คน</span>';
        if (elLate) elLate.innerHTML = (r.kpi.late || 0) + ' <span style="font-size:12px;font-weight:400;color:var(--text-muted)">คน</span>';
        if (elPend) elPend.innerHTML = (r.kpi.pendingApprovals || 0) + ' <span style="font-size:12px;font-weight:400;color:var(--text-muted)">รายการ</span>';
        if (elTot) elTot.innerHTML = (r.kpi.totalEmployees || 0) + ' <span style="font-size:12px;font-weight:400;color:var(--text-muted)">คน</span>';
      }

      // 2. Subtitle & Individual Summary Bar
      var subTitle = document.getElementById('attLogsSubTitle');
      var indivBar = document.getElementById('attIndividualSummaryBar');

      if (_currentAttendanceIsIndividual && indivBar) {
        indivBar.style.display = 'block';
        var empInfo = r.selectedEmpInfo || {};
        var nameDisplay = (empInfo.name || filterEmp) + (empInfo.nickname ? ' (' + empInfo.nickname + ')' : '');
        var subDisplay = 'รหัส: ' + (empInfo.emp_id || filterEmp) + ' | แผนก: ' + (empInfo.department || '-') + ' | ตำแหน่ง: ' + (empInfo.position || '-') + ' | สาขา: ' + (empInfo.branch_name || 'สำนักงานใหญ่');

        var nameEl = document.getElementById('attIndivEmpName');
        var subEl = document.getElementById('attIndivEmpSub');
        var badgeEl = document.getElementById('attIndivPeriodBadge');
        if (nameEl) nameEl.textContent = nameDisplay;
        if (subEl) subEl.textContent = subDisplay;
        if (badgeEl) badgeEl.innerHTML = '<i class="fa-regular fa-calendar"></i> ' + (r.dateDisplay || r.month || r.date || 'ช่วงที่เลือก');

        var s = r.empSummary || {};
        var elDays = document.getElementById('attIndivDaysWorked');
        var elHrs = document.getElementById('attIndivTotalHours');
        var elOt = document.getElementById('attIndivOtHours');
        var elLateCount = document.getElementById('attIndivLateCount');
        var elMiss = document.getElementById('attIndivMissingOut');
        var elLeave = document.getElementById('attIndivLeaveDays');
        var elAdv = document.getElementById('attIndivAdvanceAmount');

        if (elDays) elDays.innerHTML = (s.daysWorked || 0) + ' <span style="font-size:11px;font-weight:500;color:#64748b">วัน</span>';
        if (elHrs) elHrs.innerHTML = (s.totalWorkHours || 0) + ' <span style="font-size:11px;font-weight:500;color:#64748b">ชม.</span>';
        if (elOt) elOt.innerHTML = (s.approvedOtHours || 0) + ' <span style="font-size:11px;font-weight:500;color:#64748b">ชม.</span>';
        if (elLateCount) elLateCount.innerHTML = (s.lateCount || 0) + ' <span style="font-size:11px;font-weight:500;color:#64748b">ครั้ง' + ((s.totalLateMinutes || 0) > 0 ? ' (' + s.totalLateMinutes + 'น.)' : '') + '</span>';
        if (elMiss) elMiss.innerHTML = (s.missingClockOutCount || 0) + ' <span style="font-size:11px;font-weight:500;color:#64748b">วัน</span>';
        if (elLeave) elLeave.innerHTML = (s.approvedLeaveDays || 0) + ' <span style="font-size:11px;font-weight:500;color:#64748b">วัน</span>';
        if (elAdv) elAdv.textContent = '฿' + Number(s.approvedAdvanceAmount || 0).toLocaleString();

        if (subTitle) {
          subTitle.textContent = 'ประวัติการลงเวลาทำงานของ ' + nameDisplay + ' (' + (r.dateDisplay || r.month || r.date || '') + ') - พบ ' + _currentAttendanceLogs.length + ' บันทึก';
        }
      } else {
        if (indivBar) indivBar.style.display = 'none';
        if (subTitle) {
          var displayPeriod = r.dateDisplay || (r.date || r.today);
          subTitle.textContent = 'บันทึกเวลาเข้า-ออก พิกัด และรูปถ่ายยืนยันตัวตน ' + (r.dateMode === 'SINGLE' ? 'ประจำวันที่ ' : 'ช่วง ') + displayPeriod;
        }
      }

      // 3. Settings Form Values
      if (r.settings) {
        var setStart = document.getElementById('attSetShiftStart');
        var setEnd = document.getElementById('attSetShiftEnd');
        var setGrace = document.getElementById('attSetGraceMinutes');
        var setRadius = document.getElementById('attSetRadiusMeters');
        var setLat = document.getElementById('attSetLat');
        var setLng = document.getElementById('attSetLng');
        var setToggleLeave = document.getElementById('attSetEnableLeave');
        var setToggleOt = document.getElementById('attSetEnableOt');
        var setToggleAdvance = document.getElementById('attSetEnableAdvance');
        var setToggleDirectGps = document.getElementById('attSetAllowDirectGps');
        var setAdvDay = document.getElementById('attSetAdvanceDay');
        var setAdvRate = document.getElementById('attSetAdvanceDailyRate');
        var setOtStart = document.getElementById('attSetOtStart');
        var setOtRounding = document.getElementById('attSetOtRounding');
        var setQrMode = document.getElementById('attSetQrMode');

        if (setStart && (r.settings.shift_start || r.settings.work_start_time)) {
          setStart.value = r.settings.shift_start || r.settings.work_start_time;
        }
        if (setEnd && (r.settings.shift_end || r.settings.work_end_time)) {
          setEnd.value = r.settings.shift_end || r.settings.work_end_time;
        }
        if (setGrace && (r.settings.grace_minutes !== undefined || r.settings.grace_period_morning_minutes !== undefined)) {
          setGrace.value = r.settings.grace_minutes ?? r.settings.grace_period_morning_minutes;
        }
        var setCutoffDay = document.getElementById('attSetCutoffDay');
        if (setCutoffDay && r.settings.cutoff_day) setCutoffDay.value = r.settings.cutoff_day;
        if (setRadius && r.settings.geofence_radius_meters) setRadius.value = r.settings.geofence_radius_meters;
        if (setLat && r.settings.office_lat) setLat.value = r.settings.office_lat;
        if (setLng && r.settings.office_lng) setLng.value = r.settings.office_lng;

        if (setToggleLeave) setToggleLeave.checked = (r.settings.enable_leave_requests !== 'false');
        if (setToggleOt) setToggleOt.checked = (r.settings.enable_ot_requests !== 'false');
        if (setToggleAdvance) setToggleAdvance.checked = (r.settings.enable_advance_requests !== 'false');
        if (setToggleDirectGps) setToggleDirectGps.checked = (r.settings.allow_direct_gps !== 'false');
        var setToggleFaceDetect = document.getElementById('attSetEnableFaceDetect');
        if (setToggleFaceDetect) setToggleFaceDetect.checked = (r.settings.enable_face_detection !== 'false');
        var setUnlockPassword = document.getElementById('attSetUnlockPassword');
        var setUnlockQr = document.getElementById('attSetUnlockQr');
        var setUnlockRemote = document.getElementById('attSetUnlockRemote');
        if (setUnlockPassword) setUnlockPassword.checked = (r.settings.unlock_method_password !== 'false');
        if (setUnlockQr) setUnlockQr.checked = (r.settings.unlock_method_qr !== 'false');
        if (setUnlockRemote) setUnlockRemote.checked = (r.settings.unlock_method_remote !== 'false');
        var setLeaveSickCert = document.getElementById('attSetLeaveTypeSickWithCert');
        var setLeaveSickNoCert = document.getElementById('attSetLeaveTypeSickNoCert');
        var setLeaveBusiness = document.getElementById('attSetLeaveTypeBusiness');
        var setLeaveAnnual = document.getElementById('attSetLeaveTypeAnnual');
        var setLeaveWithoutPay = document.getElementById('attSetLeaveTypeWithoutPay');
        if (setLeaveSickCert) setLeaveSickCert.checked = (r.settings.leave_type_sick_with_cert !== 'false');
        if (setLeaveSickNoCert) setLeaveSickNoCert.checked = (r.settings.leave_type_sick_no_cert !== 'false');
        if (setLeaveBusiness) setLeaveBusiness.checked = (r.settings.leave_type_business === 'true');
        if (setLeaveAnnual) setLeaveAnnual.checked = (r.settings.leave_type_annual === 'true');
        if (setLeaveWithoutPay) setLeaveWithoutPay.checked = (r.settings.leave_type_without_pay === 'true');
        if (setAdvDay && r.settings.advance_day_of_week) setAdvDay.value = r.settings.advance_day_of_week;
        if (setAdvRate && r.settings.advance_daily_rate !== undefined) setAdvRate.value = r.settings.advance_daily_rate;
        var setAdvStartTime = document.getElementById('attSetAdvanceStartTime');
        var setAdvEndTime = document.getElementById('attSetAdvanceEndTime');
        if (setAdvStartTime && r.settings.advance_start_time) setAdvStartTime.value = r.settings.advance_start_time;
        if (setAdvEndTime && r.settings.advance_end_time) setAdvEndTime.value = r.settings.advance_end_time;
        if (setOtStart && (r.settings.ot_start_time || r.settings.shift_end || r.settings.work_end_time)) {
          setOtStart.value = r.settings.ot_start_time || r.settings.shift_end || r.settings.work_end_time;
        }
        if (setOtRounding && r.settings.ot_rounding_mode) setOtRounding.value = r.settings.ot_rounding_mode;
        if (setQrMode && r.settings.qr_mode) setQrMode.value = r.settings.qr_mode;
        var setBreakMode = document.getElementById('attSetBreakMode');
        var setBreakDuration = document.getElementById('attSetBreakDuration');
        if (setBreakMode && r.settings.break_tracking_mode) setBreakMode.value = r.settings.break_tracking_mode;
        if (setBreakDuration && r.settings.break_duration_minutes !== undefined) setBreakDuration.value = r.settings.break_duration_minutes;

        var setTimeWindowLock = document.getElementById('attSetEnableTimeWindows');
        var setWinInStart = document.getElementById('attSetWindowInStart');
        var setWinInEnd = document.getElementById('attSetWindowInEnd');
        var setWinBreakOutStart = document.getElementById('attSetWindowBreakOutStart');
        var setWinBreakOutEnd = document.getElementById('attSetWindowBreakOutEnd');
        var setWinBreakInStart = document.getElementById('attSetWindowBreakInStart');
        var setWinBreakInEnd = document.getElementById('attSetWindowBreakInEnd');
        var setWinOutStart = document.getElementById('attSetWindowOutStart');
        var setWinOutEnd = document.getElementById('attSetWindowOutEnd');

        if (setTimeWindowLock) setTimeWindowLock.checked = (r.settings.enable_time_window_restrictions === 'true');
        if (setWinInStart && r.settings.window_in_start) setWinInStart.value = r.settings.window_in_start;
        if (setWinInEnd && r.settings.window_in_end) setWinInEnd.value = r.settings.window_in_end;
        if (setWinBreakOutStart && r.settings.window_break_out_start) setWinBreakOutStart.value = r.settings.window_break_out_start;
        if (setWinBreakOutEnd && r.settings.window_break_out_end) setWinBreakOutEnd.value = r.settings.window_break_out_end;
        if (setWinBreakInStart && r.settings.window_break_in_start) setWinBreakInStart.value = r.settings.window_break_in_start;
        if (setWinBreakInEnd && r.settings.window_break_in_end) setWinBreakInEnd.value = r.settings.window_break_in_end;
        if (setWinOutStart && r.settings.window_out_start) setWinOutStart.value = r.settings.window_out_start;
        if (setWinOutEnd && r.settings.window_out_end) setWinOutEnd.value = r.settings.window_out_end;
        toggleTimeWindowsUI(setTimeWindowLock ? setTimeWindowLock.checked : false);

        var setKioskLock = document.getElementById('attSetEnableKioskLock');
        var setKioskPin = document.getElementById('attSetKioskPin');
        var setKioskGeofence = document.getElementById('attSetKioskRequireGeofence');
        if (setKioskLock) setKioskLock.checked = (r.settings.enable_kiosk_lock !== 'false');
        if (setKioskPin && r.settings.kiosk_pin) setKioskPin.value = r.settings.kiosk_pin;
        if (setKioskGeofence) setKioskGeofence.checked = (r.settings.kiosk_require_geofence !== 'false');

        var setMaintMode = document.getElementById('attSetMaintenanceMode');
        var setMaintMsg = document.getElementById('attSetMaintenanceMessage');
        if (setMaintMode) setMaintMode.checked = (r.settings.system_maintenance_mode === 'true');
        if (setMaintMsg && r.settings.system_maintenance_message) setMaintMsg.value = r.settings.system_maintenance_message;

        var setEnablePayslip = document.getElementById('attSetEnablePayslip');
        var setPayslipMode = document.getElementById('attSetPayslipReleaseMode');
        var setBroadcastPeriod = document.getElementById('attBroadcastPeriod');
        if (setEnablePayslip) setEnablePayslip.checked = (r.settings.enable_payslip !== 'false');
        if (setPayslipMode && r.settings.payslip_release_mode) setPayslipMode.value = r.settings.payslip_release_mode;
        if (setBroadcastPeriod && !setBroadcastPeriod.value) {
          setBroadcastPeriod.value = State.currentPeriod || new Date().toISOString().substring(0, 7);
        }
      }

      // 4. Render Tables & Approvals
      renderTimeAttendanceTodayLogs(_currentAttendanceLogs, _currentAttendanceIsIndividual);
      renderTimeAttendanceApprovals(r.pendingLeaves || [], r.pendingOts || [], r.pendingAdvances || []);

      // Reset selection
      var masterCb = document.getElementById('attSelectAllLogs');
      if (masterCb) masterCb.checked = false;
      updateAttendanceBatchToolbar();
    })
    .catch(function(err) {
      if (logsBody) {
        logsBody.innerHTML = '<tr><td colspan="14" class="text-center text-red" style="padding:24px">โหลดข้อมูลไม่สำเร็จ: ' + (err.message || err) + '</td></tr>';
      }
    });
}

function setAttendanceFilterToday() {
  var filterInput = document.getElementById('attFilterDate');
  if (filterInput) {
    var nowUtc = new Date();
    var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    filterInput.value = bangkok.toISOString().substring(0, 10);
  }
  loadTimeAttendanceDashboard();
}

function renderTimeAttendanceTodayLogs(logs, isIndividual) {
  var tbody = document.getElementById('attLogsTableBody');
  if (!tbody) return;

  var isIndiv = (isIndividual !== undefined) ? isIndividual : _currentAttendanceIsIndividual;
  var thDate = document.getElementById('thAttDate');
  if (thDate) thDate.style.display = isIndiv ? '' : 'none';

  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted" style="padding:28px"><i class="fa-solid fa-clock-rotate-left" style="font-size:24px;margin-bottom:8px;display:block;opacity:0.4"></i>ไม่พบข้อมูลการลงเวลาในช่วงที่เลือก</td></tr>';
    return;
  }

  var nowUtc = new Date();
  var bangkokToday = new Date(nowUtc.getTime() + (7 * 3600 * 1000)).toISOString().substring(0, 10);
  var thaiDays = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];

  var html = '';
  logs.forEach(function(l, idx) {
    var inPhotoHtml = '<span style="color:#94a3b8;font-size:11px">-</span>';
    if (l.in_photo_url) {
      inPhotoHtml = '<img src="' + l.in_photo_url + '" alt="IN" style="width:36px;height:36px;border-radius:8px;object-fit:cover;border:2px solid #10b981;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.1);display:inline-block;vertical-align:middle" onclick="previewAttendancePhoto(\'' + l.in_photo_url + '\', \'รูปถ่ายเข้างาน: ' + (l.full_name || l.emp_id) + '\', \'เวลาเข้า: ' + (l.clock_in || '-') + ' น. | พิกัด: ' + (l.in_lat ? l.in_lat.toFixed(4) + ', ' + l.in_lng.toFixed(4) : '-') + '\')" title="คลิกเพื่อดูรูปขยาย">';
    }

    var outPhotoHtml = '<span style="color:#94a3b8;font-size:11px">-</span>';
    if (l.out_photo_url) {
      outPhotoHtml = '<img src="' + l.out_photo_url + '" alt="OUT" style="width:36px;height:36px;border-radius:8px;object-fit:cover;border:2px solid #ef4444;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.1);display:inline-block;vertical-align:middle" onclick="previewAttendancePhoto(\'' + l.out_photo_url + '\', \'รูปถ่ายออกงาน: ' + (l.full_name || l.emp_id) + '\', \'เวลาออก: ' + (l.clock_out || '-') + ' น. | พิกัด: ' + (l.out_lat ? l.out_lat.toFixed(4) + ', ' + l.out_lng.toFixed(4) : '-') + '\')" title="คลิกเพื่อดูรูปขยาย">';
    }

    var lateBadge = '';
    if ((Number(l.late_minutes) || 0) > 0) {
      lateBadge = '<span style="background:#fff7ed;color:#c2410c;font-weight:700;font-size:11px;padding:2px 6px;border-radius:4px;border:1px solid #fed7aa">สาย ' + l.late_minutes + ' น.</span>';
    } else {
      lateBadge = '<span style="background:#ecfdf5;color:#059669;font-weight:600;font-size:11px;padding:2px 6px;border-radius:4px;border:1px solid #a7f3d0">ปกติ</span>';
    }

    var hrsText = '';
    if ((Number(l.work_hours) || 0) > 0) {
      hrsText = '<div style="font-size:10.5px;color:#64748b;margin-top:2px">' + l.work_hours + ' ชม.</div>';
    }

    var statusHtml = '';
    if (l.status === 'GEOFENCE_FAIL') {
      statusHtml = '<span style="background:#fef2f2;color:#b91c1c;font-size:10.5px;padding:2px 6px;border-radius:4px;border:1px solid #fecaca;font-weight:600"><i class="fa-solid fa-location-dot"></i> นอกพิกัด</span>';
    } else if (l.status === 'SUNDAY_WORK') {
      statusHtml = '<span style="background:#eff6ff;color:#1d4ed8;font-size:10.5px;padding:2px 6px;border-radius:4px;border:1px solid #bfdbfe;font-weight:600">วันอาทิตย์</span>';
    } else {
      statusHtml = '<span style="background:#f0fdf4;color:#15803d;font-size:10.5px;padding:2px 6px;border-radius:4px;border:1px solid #bbf7d0;font-weight:600"><i class="fa-solid fa-check"></i> ในสาขา</span>';
    }

    var nameDisplay = (l.full_name || '-') + (l.nickname ? ' (' + l.nickname + ')' : '');
    var branchDisplay = l.branch_name || l.branch_id || 'สำนักงานใหญ่';

    var dateColHtml = '';
    if (isIndiv) {
      var dObj = new Date(l.date + 'T00:00:00');
      var dayName = isNaN(dObj.getDay()) ? '' : thaiDays[dObj.getDay()];
      var dayBadge = '';
      if (dObj.getDay() === 0) {
        dayBadge = '<span style="background:#fee2e2;color:#b91c1c;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700">อาทิตย์</span>';
      } else {
        dayBadge = '<span style="background:#f1f5f9;color:#475569;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:600">' + dayName + '</span>';
      }
      dateColHtml = '<td class="text-center" style="font-size:11.5px;font-weight:700;color:#1e3a8a;white-space:nowrap;padding:4px">' +
        '<div>' + (l.date || '-') + '</div>' +
        '<div style="margin-top:2px">' + dayBadge + '</div>' +
      '</td>';
    }

    // Missing clock out anomaly check
    var missingOutAnomaly = '';
    if (l.clock_in && (!l.clock_out || l.clock_out.trim() === '') && l.date < bangkokToday) {
      missingOutAnomaly = '<div style="font-size:10px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:2px 6px;margin-top:3px;font-weight:700;display:inline-flex;align-items:center;gap:3px"><i class="fa-solid fa-triangle-exclamation"></i> <span>ยังไม่สแกนออก</span></div>';
    }

    html += '<tr id="attLogRow_' + l.id + '">' +
      '<td class="text-center" style="padding:4px">' +
        '<input type="checkbox" class="att-log-checkbox" value="' + l.id + '" onchange="onAttendanceCheckboxChanged()" style="cursor:pointer;accent-color:#2563eb;width:15px;height:15px">' +
      '</td>' +
      '<td class="text-center font-bold" style="color:#64748b">' + (idx + 1) + '</td>' +
      dateColHtml +
      '<td class="text-center" style="padding:4px">' + inPhotoHtml + '</td>' +
      '<td class="text-center" style="padding:4px">' + outPhotoHtml + '</td>' +
      '<td class="font-bold" style="color:#1e40af;cursor:pointer" onclick="viewAttendanceLogDetail(' + l.id + ')" title="ดูรายละเอียด">' + (l.emp_id || '-') + '</td>' +
      '<td>' +
        '<div style="font-weight:700;color:#0f172a;cursor:pointer;display:inline-block" onclick="viewAttendanceLogDetail(' + l.id + ')" title="คลิกเพื่อดูรายละเอียดเชิงลึก">' +
          nameDisplay + ' <i class="fa-solid fa-circle-info text-blue" style="font-size:11px;opacity:0.7"></i>' +
        '</div>' +
        '<div style="font-size:11px;color:#64748b">' + (l.position || '-') + '</div>' +
        (l.break_out ? '<div style="font-size:10.5px;color:#b45309;font-weight:700;margin-top:2px"><i class="fa-solid fa-mug-hot"></i> พัก ' + l.break_out + (l.break_in ? ' - ' + l.break_in : ' (กำลังพัก)') + (l.break_minutes > 0 ? ' (' + l.break_minutes + 'น.)' : '') + '</div>' : '') +
        missingOutAnomaly +
        (l.has_leave_conflict ? '<div style="font-size:10px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:2px 6px;margin-top:3px;display:inline-flex;align-items:center;gap:4px" title="พนักงานมีใบลาที่อนุมัติไว้ในวันนี้ แต่มาทำงานจริง ระบบตรวจจับอัตโนมัติและยกเว้นการหักวันลา"><i class="fa-solid fa-shield-halved text-amber"></i> <span>มีใบลาอนุมัติไว้แต่วันนี้มาทำงานจริง (ระบบบันทึกเวลาทำงานปกติ ไม่หักวันลา)</span></div>' : '') +
        ((l.remark && l.remark.includes('สิทธิ์ประจำตำแหน่ง')) ? '<div style="font-size:10px;color:#6b21a8;background:#faf5ff;border:1px solid #d8b4fe;border-radius:4px;padding:2px 6px;margin-top:3px;display:inline-flex;align-items:center;gap:4px;font-weight:700" title="สิทธิ์ประจำตำแหน่ง: ยกเว้นการหักเงินชั่วโมงออกก่อนให้อัตโนมัติ (หากเข้าสายหักตามปกติ)"><i class="fa-solid fa-sparkles text-purple"></i> <span>✨ สิทธิ์เต็มวัน (ไม่หักออกก่อน)</span></div>' : ((l.is_full_pay === 1 || l.is_full_pay === '1' || (l.remark && l.remark.includes('งานเสร็จเลิกงานก่อน-จ่ายเต็มวัน'))) ? '<div style="font-size:10px;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:4px;padding:2px 6px;margin-top:3px;display:inline-flex;align-items:center;gap:4px;font-weight:700" title="ได้รับอนุมัติเลิกงานก่อนเนื่องจากงานเสร็จ ได้รับค่าแรงเต็มวัน ไม่หักเงิน"><i class="fa-solid fa-circle-check text-green"></i> <span>งานเสร็จ-จ่ายเต็มวัน (ไม่หักเงิน)</span></div>' : '')) +
      '</td>' +
      '<td><span class="period-pill" style="font-size:10.5px">' + (l.department || '-') + '</span></td>' +
      '<td><span class="period-pill" style="font-size:10.5px;background:#e0f2fe;color:#0369a1;border-color:#bae6fd;font-weight:700"><i class="fa-solid fa-store" style="margin-right:3px"></i>' + esc(branchDisplay) + '</span></td>' +
      '<td class="text-center font-bold text-green" style="font-size:12.5px">' + (l.clock_in ? l.clock_in + ' น.' : '-') + '</td>' +
      '<td class="text-center font-bold text-red" style="font-size:12.5px">' + (l.clock_out ? l.clock_out + ' น.' : '-') + '</td>' +
      '<td class="text-center">' + lateBadge + hrsText + '</td>' +
      '<td class="text-center">' + statusHtml + '</td>' +
      '<td class="text-center" style="padding:4px;white-space:nowrap">' +
        '<div style="display:inline-flex;gap:4px">' +
          '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 6px;background:#f8fafc;color:#334155;border:1px solid #cbd5e1;border-radius:4px" onclick="viewAttendanceLogDetail(' + l.id + ')" title="ดูรายละเอียดการลงเวลา">' +
            '<i class="fa-solid fa-eye text-blue"></i>' +
          '</button>' +
          '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 6px;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;border-radius:4px" onclick="openEditAttendanceLogModal(' + l.id + ')" title="แก้ไขเวลาเข้า-ออก">' +
            '<i class="fa-solid fa-pen-to-square"></i>' +
          '</button>' +
          '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 6px;background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;border-radius:4px" onclick="deleteSingleAttendanceLog(' + l.id + ', \'' + esc(l.full_name || l.emp_id) + '\')" title="ลบรายการนี้">' +
            '<i class="fa-solid fa-trash-can"></i>' +
          '</button>' +
          '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 7px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;border-radius:4px;font-weight:600" onclick="syncFromPtnTimeForEmp(\'' + esc(l.emp_id) + '\', \'' + esc(l.full_name || '') + '\')" title="ดึงข้อมูลเข้าสู่คำนวณเงินเดือน">' +
            '<i class="fa-solid fa-cloud-arrow-down"></i>' +
          '</button>' +
        '</div>' +
      '</td>' +
      '</tr>';
  });

  tbody.innerHTML = html;
}

function printIndividualAttendanceTimesheet() {
  if (!_currentAttendanceIsIndividual || !_currentAttendanceSelectedEmpInfo) {
    showToast('โปรดเลือกพนักงานที่ต้องการพิมพ์ Timesheet ก่อน', 'warning');
    return;
  }

  var emp = _currentAttendanceSelectedEmpInfo || {};
  var summary = _currentAttendanceEmpSummary || {};
  var logs = _currentAttendanceLogs || [];

  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด (PTN PHARMA CENTER CO., LTD.)';
  var compTax = State.company.taxId || '0105559876543';
  var periodStr = document.getElementById('attIndivPeriodBadge') ? document.getElementById('attIndivPeriodBadge').textContent.trim() : '';

  var printWin = window.open('', '_blank');
  if (!printWin) {
    showToast('โปรดอนุญาตให้เปิดหน้าต่าง Pop-up เพื่อพิมพ์เอกสาร', 'warning');
    return;
  }

  var now = new Date();
  var thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var printDateStr = now.getDate() + ' ' + thaiMonths[now.getMonth()] + ' ' + (now.getFullYear() + 543) + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ' น.';

  var rowsHtml = '';
  logs.forEach(function(l, i) {
    var dObj = new Date(l.date + 'T00:00:00');
    var thaiDays = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
    var dayName = isNaN(dObj.getDay()) ? '' : thaiDays[dObj.getDay()];
    var lateStr = (Number(l.late_minutes) || 0) > 0 ? ('สาย ' + l.late_minutes + ' น.') : '-';
    var breakStr = (l.break_out && l.break_in) ? (l.break_out + ' - ' + l.break_in) : '-';
    var note = [];
    if (l.status === 'GEOFENCE_FAIL') note.push('นอกพิกัด');
    if (l.has_leave_conflict) note.push('ลาแต่มาทำงาน');
    if (l.is_full_pay === 1 || l.is_full_pay === '1') note.push('จ่ายเต็มวัน');
    if (l.clock_in && !l.clock_out) note.push('ขาดสแกนออก');
    if (l.remark) note.push(l.remark);

    rowsHtml += '<tr style="' + (dObj.getDay() === 0 ? 'background:#fef2f2;' : '') + '">' +
      '<td style="text-align:center;border:1px solid #cbd5e1;padding:4px 6px;">' + (i + 1) + '</td>' +
      '<td style="text-align:center;border:1px solid #cbd5e1;padding:4px 6px;font-weight:600">' + (l.date || '-') + '</td>' +
      '<td style="text-align:center;border:1px solid #cbd5e1;padding:4px 6px;">' + dayName + '</td>' +
      '<td style="text-align:center;border:1px solid #cbd5e1;padding:4px 6px;color:#047857;font-weight:700">' + (l.clock_in || '-') + '</td>' +
      '<td style="text-align:center;border:1px solid #cbd5e1;padding:4px 6px;color:#b91c1c;font-weight:700">' + (l.clock_out || '-') + '</td>' +
      '<td style="text-align:center;border:1px solid #cbd5e1;padding:4px 6px;font-size:11px">' + breakStr + '</td>' +
      '<td style="text-align:center;border:1px solid #cbd5e1;padding:4px 6px;">' + (l.work_hours ? l.work_hours + ' ชม.' : '-') + '</td>' +
      '<td style="text-align:center;border:1px solid #cbd5e1;padding:4px 6px;color:#c2410c;">' + lateStr + '</td>' +
      '<td style="text-align:center;border:1px solid #cbd5e1;padding:4px 6px;">' + (l.branch_name || 'สำนักงานใหญ่') + '</td>' +
      '<td style="text-align:left;border:1px solid #cbd5e1;padding:4px 6px;font-size:11px">' + (note.join(', ') || '-') + '</td>' +
    '</tr>';
  });

  var docHtml = '<!DOCTYPE html>' +
    '<html><head><meta charset="utf-8"><title>Timesheet - ' + (emp.name || emp.emp_id) + '</title>' +
    '<style>' +
      '@page { size: A4 portrait; margin: 12mm; }' +
      'body { font-family: "Sarabun", "Segoe UI", Arial, sans-serif; font-size: 12px; color: #0f172a; margin: 0; padding: 10px; }' +
      'table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; }' +
      'th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px; text-align: center; }' +
      '.kpi-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 10px 0; }' +
      '.kpi-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; background: #fafafa; }' +
      '.kpi-title { font-size: 10px; color: #64748b; font-weight: 600; }' +
      '.kpi-val { font-size: 13px; font-weight: bold; margin-top: 2px; }' +
      '.sign-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 30px; text-align: center; }' +
      '.sign-line { border-bottom: 1px dotted #64748b; width: 80%; margin: 35px auto 6px; }' +
    '</style>' +
    '</head><body>' +
    '<div style="text-align:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:12px">' +
      '<div style="font-size:16px;font-weight:bold">' + compName + '</div>' +
      '<div style="font-size:11px;color:#475569">เลขประจำตัวผู้เสียภาษี: ' + compTax + '</div>' +
      '<div style="font-size:14px;font-weight:bold;margin-top:6px;color:#1d4ed8">ใบรายงานบันทึกเวลาทำงานรายบุคคล (Individual Timesheet Report)</div>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;font-size:11.5px">' +
      '<div>' +
        '<div><b>รหัสพนักงาน:</b> ' + (emp.emp_id || '-') + ' &nbsp;&nbsp; <b>ชื่อ-สกุล:</b> ' + (emp.name || '-') + (emp.nickname ? ' (' + emp.nickname + ')' : '') + '</div>' +
        '<div style="margin-top:3px"><b>แผนก:</b> ' + (emp.department || '-') + ' &nbsp;&nbsp; <b>ตำแหน่ง:</b> ' + (emp.position || '-') + ' &nbsp;&nbsp; <b>สาขา:</b> ' + (emp.branch_name || 'สำนักงานใหญ่') + '</div>' +
      '</div>' +
      '<div style="text-align:right">' +
        '<div><b>รอบ/ช่วงเวลา:</b> ' + periodStr + '</div>' +
        '<div style="margin-top:3px;color:#64748b">พิมพ์เมื่อ: ' + printDateStr + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="kpi-grid">' +
      '<div class="kpi-box"><div class="kpi-title">วันทำงานจริง</div><div class="kpi-val" style="color:#047857">' + (summary.daysWorked || 0) + ' วัน</div></div>' +
      '<div class="kpi-box"><div class="kpi-title">ชม.ทำงานรวม</div><div class="kpi-val" style="color:#1d4ed8">' + (summary.totalWorkHours || 0) + ' ชม.</div></div>' +
      '<div class="kpi-box"><div class="kpi-title">OT ที่อนุมัติ</div><div class="kpi-val" style="color:#b45309">' + (summary.approvedOtHours || 0) + ' ชม.</div></div>' +
      '<div class="kpi-box"><div class="kpi-title">มาสาย</div><div class="kpi-val" style="color:#c2410c">' + (summary.lateCount || 0) + ' ครั้ง (' + (summary.totalLateMinutes || 0) + 'น.)</div></div>' +
      '<div class="kpi-box"><div class="kpi-title">ยังไม่สแกนออก</div><div class="kpi-val" style="color:#dc2626">' + (summary.missingClockOutCount || 0) + ' วัน</div></div>' +
      '<div class="kpi-box"><div class="kpi-title">ลางาน (อนุมัติ)</div><div class="kpi-val" style="color:#2563eb">' + (summary.approvedLeaveDays || 0) + ' วัน</div></div>' +
      '<div class="kpi-box"><div class="kpi-title">เบิกเงิน (อนุมัติ)</div><div class="kpi-val" style="color:#059669">฿' + Number(summary.approvedAdvanceAmount || 0).toLocaleString() + '</div></div>' +
    '</div>' +
    '<table>' +
      '<thead>' +
        '<tr>' +
          '<th style="width:30px">#</th>' +
          '<th style="width:75px">วันที่</th>' +
          '<th style="width:65px">วัน</th>' +
          '<th style="width:55px">เข้างาน</th>' +
          '<th style="width:55px">ออกงาน</th>' +
          '<th style="width:75px">พักกลางวัน</th>' +
          '<th style="width:60px">ชม.ทำงาน</th>' +
          '<th style="width:60px">สาย</th>' +
          '<th style="width:90px">สาขา</th>' +
          '<th>หมายเหตุ / สถานะ</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' + (rowsHtml || '<tr><td colspan="10" style="text-align:center;padding:15px;color:#94a3b8">ไม่มีบันทึกเวลาทำงานในช่วงนี้</td></tr>') + '</tbody>' +
    '</table>' +
    '<div class="sign-grid">' +
      '<div>' +
        '<div class="sign-line"></div>' +
        '<div>( ' + (emp.name || 'พนักงาน') + ' )</div>' +
        '<div style="font-size:10.5px;color:#64748b;margin-top:2px">ลายมือชื่อพนักงานผู้ปฏิบัติงาน</div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-top:2px">วันที่ ...../...../..........</div>' +
      '</div>' +
      '<div>' +
        '<div class="sign-line"></div>' +
        '<div>( .................................................... )</div>' +
        '<div style="font-size:10.5px;color:#64748b;margin-top:2px">ผู้ตรวจสอบ / หัวหน้างาน</div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-top:2px">วันที่ ...../...../..........</div>' +
      '</div>' +
      '<div>' +
        '<div class="sign-line"></div>' +
        '<div>( .................................................... )</div>' +
        '<div style="font-size:10.5px;color:#64748b;margin-top:2px">กรรมการผู้จัดการ / ผู้อนุมัติ</div>' +
        '<div style="font-size:10px;color:#94a3b8;margin-top:2px">วันที่ ...../...../..........</div>' +
      '</div>' +
    '</div>' +
    '<script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };<\/script>' +
    '</body></html>';

  printWin.document.open();
  printWin.document.write(docHtml);
  printWin.document.close();
}

// BATCH OPERATIONS & CHECKBOXES
function toggleSelectAllAttendanceLogs(master) {
  var cbs = document.querySelectorAll('.att-log-checkbox');
  cbs.forEach(function(cb) {
    cb.checked = master.checked;
  });
  updateAttendanceBatchToolbar();
}

function onAttendanceCheckboxChanged() {
  updateAttendanceBatchToolbar();
}

function updateAttendanceBatchToolbar() {
  var cbs = document.querySelectorAll('.att-log-checkbox:checked');
  var count = cbs.length;
  var bar = document.getElementById('attBatchToolbar');
  var countDisplay = document.getElementById('attSelectedCount');
  if (countDisplay) countDisplay.textContent = count;
  if (bar) {
    bar.style.display = count > 0 ? 'flex' : 'none';
  }
  var allCbs = document.querySelectorAll('.att-log-checkbox');
  var master = document.getElementById('attSelectAllLogs');
  if (master) {
    master.checked = (allCbs.length > 0 && count === allCbs.length);
  }
}

function deselectAllAttendanceLogs() {
  var master = document.getElementById('attSelectAllLogs');
  if (master) master.checked = false;
  var cbs = document.querySelectorAll('.att-log-checkbox');
  cbs.forEach(function(cb) { cb.checked = false; });
  updateAttendanceBatchToolbar();
}

function batchDeleteAttendanceLogs() {
  var cbs = document.querySelectorAll('.att-log-checkbox:checked');
  var ids = Array.from(cbs).map(function(cb) { return Number(cb.value); });
  if (ids.length === 0) {
    showToast('กรุณาเลือกรายการที่ต้องการลบอย่างน้อย 1 รายการ', 'warning');
    return;
  }

  if (!confirm('ยืนยันลบรายการลงเวลาทำงานที่เลือกทั้งหมด ' + ids.length + ' รายการ ใช่หรือไม่? (ไม่สามารถกู้คืนได้)')) return;

  callApi('batchDeleteAttendanceLogs', {
    ids: ids,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      showToast(r.message || 'ลบรายการลงเวลาเรียบร้อยแล้ว');
      loadTimeAttendanceDashboard();
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบรายการ', 'error');
    });
}

function deleteSingleAttendanceLog(id, name) {
  if (!confirm('ยืนยันลบข้อมูลการลงเวลาของ "' + (name || 'พนักงาน') + '" ใช่หรือไม่? (ไม่สามารถกู้คืนได้)')) return;

  callApi('deleteAttendanceLog', {
    id: id,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      showToast(r.message || 'ลบรายการบันทึกเวลาเรียบร้อยแล้ว');
      closeModal('modalAttendanceDetail');
      loadTimeAttendanceDashboard();
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบรายการ', 'error');
    });
}

// ATTENDANCE DETAIL MODAL CONTROLLER
function viewAttendanceLogDetail(id) {
  var log = (_currentAttendanceLogs || []).find(function(x) { return x.id === Number(id); });
  if (!log) {
    showToast('ไม่พบข้อมูลรายการลงเวลานี้', 'error');
    return;
  }

  var offLat = Number(_currentAttendanceSettings.office_lat || 13.727896);
  var offLng = Number(_currentAttendanceSettings.office_lng || 100.524123);

  // 1. Employee header
  var nameDisplay = (log.full_name || '-') + (log.nickname ? ' (' + log.nickname + ')' : '');
  document.getElementById('dtlEmpName').textContent = nameDisplay;
  document.getElementById('dtlEmpId').textContent = log.emp_id || '-';
  document.getElementById('dtlEmpDept').textContent = 'แผนก: ' + (log.department || '-');
  document.getElementById('dtlEmpPosition').textContent = 'ตำแหน่ง: ' + (log.position || '-');
  document.getElementById('dtlDate').textContent = log.date || '-';

  var isExempt = (log.remark && log.remark.includes('สิทธิ์ประจำตำแหน่ง'));
  var isBranchFullPay = !isExempt && (log.is_full_pay === 1 || log.is_full_pay === '1' || (log.remark && log.remark.includes('งานเสร็จเลิกงานก่อน-จ่ายเต็มวัน')));

  var badgeHtml = '';
  if (log.status === 'GEOFENCE_FAIL') {
    badgeHtml = '<span style="background:#fef2f2;color:#b91c1c;font-size:11.5px;padding:3px 8px;border-radius:6px;border:1px solid #fecaca;font-weight:700"><i class="fa-solid fa-triangle-exclamation"></i> นอกพิกัดสาขา</span>';
  } else if (log.status === 'SUNDAY_WORK') {
    badgeHtml = '<span style="background:#eff6ff;color:#1d4ed8;font-size:11.5px;padding:3px 8px;border-radius:6px;border:1px solid #bfdbfe;font-weight:700"><i class="fa-solid fa-calendar-check"></i> ทำงานวันอาทิตย์</span>';
  } else if ((Number(log.late_minutes) || 0) > 0) {
    badgeHtml = '<span style="background:#fff7ed;color:#c2410c;font-size:11.5px;padding:3px 8px;border-radius:6px;border:1px solid #fed7aa;font-weight:700"><i class="fa-solid fa-clock"></i> มาสาย ' + log.late_minutes + ' นาที</span>' + (isExempt ? ' <span style="background:#faf5ff;color:#6b21a8;font-size:10.5px;padding:2px 6px;border-radius:5px;border:1px solid #d8b4fe;font-weight:700;margin-left:4px">✨ ไม่หักออกก่อน</span>' : '');
  } else if (isExempt) {
    badgeHtml = '<span style="background:#faf5ff;color:#6b21a8;font-size:11.5px;padding:3px 8px;border-radius:6px;border:1px solid #d8b4fe;font-weight:700"><i class="fa-solid fa-sparkles text-purple"></i> ✨ สิทธิ์เต็มวัน (ไม่หักออกก่อน)</span>';
  } else if (isBranchFullPay) {
    badgeHtml = '<span style="background:#ecfdf5;color:#047857;font-size:11.5px;padding:3px 8px;border-radius:6px;border:1px solid #a7f3d0;font-weight:700"><i class="fa-solid fa-circle-check text-green"></i> ✨ งานเสร็จ-จ่ายเต็มวัน</span>';
  } else {
    badgeHtml = '<span style="background:#f0fdf4;color:#15803d;font-size:11.5px;padding:3px 8px;border-radius:6px;border:1px solid #bbf7d0;font-weight:700"><i class="fa-solid fa-check"></i> ปกติ (ในสาขา)</span>';
  }
  document.getElementById('dtlStatusBadge').innerHTML = badgeHtml;

  var exemptBox = document.getElementById('dtlExemptNoticeBox');
  if (exemptBox) {
    exemptBox.style.display = isExempt ? 'block' : 'none';
  }

  // 2. In section
  document.getElementById('dtlClockInTime').textContent = log.clock_in ? log.clock_in + ' น.' : 'ยังไม่บันทึก';
  var inPhotoBox = document.getElementById('dtlInPhotoContainer');
  if (log.in_photo_url) {
    inPhotoBox.innerHTML = '<img src="' + log.in_photo_url + '" alt="IN" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="previewAttendancePhoto(\'' + log.in_photo_url + '\', \'รูปถ่ายเข้างาน: ' + esc(nameDisplay) + '\', \'เวลาเข้า: ' + (log.clock_in || '-') + '\')" title="คลิกเพื่อดูรูปขนาดใหญ่">';
  } else {
    inPhotoBox.innerHTML = '<span style="color:#94a3b8;font-size:12px">ไม่มีรูปถ่ายเข้างาน</span>';
  }

  if (log.in_lat && log.in_lng) {
    var inDist = calcHaversineDistanceMeters(log.in_lat, log.in_lng, offLat, offLng);
    document.getElementById('dtlInCoords').textContent = log.in_lat.toFixed(6) + ', ' + log.in_lng.toFixed(6);
    document.getElementById('dtlInDistance').textContent = inDist !== null ? (inDist + ' เมตร จากสาขา') : '-';
    document.getElementById('dtlInMapLink').innerHTML = '<a href="https://www.google.com/maps?q=' + log.in_lat + ',' + log.in_lng + '" target="_blank" style="color:#1d4ed8;font-weight:700;text-decoration:underline"><i class="fa-solid fa-map-location-dot"></i> ดูพิกัดบน Google Maps</a>';
  } else {
    document.getElementById('dtlInCoords').textContent = 'ไม่มีข้อมูล GPS';
    document.getElementById('dtlInDistance').textContent = '-';
    document.getElementById('dtlInMapLink').innerHTML = '<span style="color:#94a3b8">ไม่ได้บันทึกพิกัด</span>';
  }

  // 3. Out section
  document.getElementById('dtlClockOutTime').textContent = log.clock_out ? log.clock_out + ' น.' : 'ยังไม่บันทึก';
  var outPhotoBox = document.getElementById('dtlOutPhotoContainer');
  if (log.out_photo_url) {
    outPhotoBox.innerHTML = '<img src="' + log.out_photo_url + '" alt="OUT" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="previewAttendancePhoto(\'' + log.out_photo_url + '\', \'รูปถ่ายออกงาน: ' + esc(nameDisplay) + '\', \'เวลาออก: ' + (log.clock_out || '-') + '\')" title="คลิกเพื่อดูรูปขนาดใหญ่">';
  } else {
    outPhotoBox.innerHTML = '<span style="color:#94a3b8;font-size:12px">ไม่มีรูปถ่ายออกงาน</span>';
  }

  if (log.out_lat && log.out_lng) {
    var outDist = calcHaversineDistanceMeters(log.out_lat, log.out_lng, offLat, offLng);
    document.getElementById('dtlOutCoords').textContent = log.out_lat.toFixed(6) + ', ' + log.out_lng.toFixed(6);
    document.getElementById('dtlOutDistance').textContent = outDist !== null ? (outDist + ' เมตร จากสาขา') : '-';
    document.getElementById('dtlOutMapLink').innerHTML = '<a href="https://www.google.com/maps?q=' + log.out_lat + ',' + log.out_lng + '" target="_blank" style="color:#b91c1c;font-weight:700;text-decoration:underline"><i class="fa-solid fa-map-location-dot"></i> ดูพิกัดบน Google Maps</a>';
  } else {
    document.getElementById('dtlOutCoords').textContent = 'ไม่มีข้อมูล GPS';
    document.getElementById('dtlOutDistance').textContent = '-';
    document.getElementById('dtlOutMapLink').innerHTML = '<span style="color:#94a3b8">ไม่ได้บันทึกพิกัด</span>';
  }

  // 3.5 Break section
  var breakSec = document.getElementById('dtlBreakSection');
  var breakBadge = document.getElementById('dtlBreakDurationBadge');
  var bOutTime = document.getElementById('dtlBreakOutTime');
  var bInTime = document.getElementById('dtlBreakInTime');
  var bOutPhotoBox = document.getElementById('dtlBreakOutPhotoContainer');
  var bInPhotoBox = document.getElementById('dtlBreakInPhotoContainer');
  var bOutCoords = document.getElementById('dtlBreakOutCoords');
  var bOutMap = document.getElementById('dtlBreakOutMapLink');
  var bInCoords = document.getElementById('dtlBreakInCoords');
  var bInMap = document.getElementById('dtlBreakInMapLink');

  if (log.break_out || log.break_in || _currentAttendanceSettings.break_tracking_mode === 'BREAK_PUNCH') {
    if (breakSec) breakSec.style.display = 'flex';
    if (bOutTime) bOutTime.textContent = log.break_out ? log.break_out + ' น.' : 'ยังไม่บันทึก';
    if (bInTime) bInTime.textContent = log.break_in ? log.break_in + ' น.' : 'ยังไม่บันทึก';

    if (breakBadge) {
      if (log.break_minutes > 0) {
        breakBadge.textContent = 'พัก ' + log.break_minutes + ' นาที' + (log.overbreak_minutes > 0 ? ' (เกิน ' + log.overbreak_minutes + ' น.)' : '');
        breakBadge.style.color = log.overbreak_minutes > 0 ? '#b91c1c' : '#047857';
        breakBadge.style.borderColor = log.overbreak_minutes > 0 ? '#fca5a5' : '#a7f3d0';
        breakBadge.style.background = log.overbreak_minutes > 0 ? '#fef2f2' : '#ecfdf5';
      } else if (log.break_out) {
        breakBadge.textContent = 'กำลังพักผ่อนอยู่';
        breakBadge.style.color = '#c2410c';
        breakBadge.style.background = '#fff7ed';
        breakBadge.style.borderColor = '#fed7aa';
      } else {
        breakBadge.textContent = 'ยังไม่พัก';
        breakBadge.style.color = '#64748b';
        breakBadge.style.background = '#f8fafc';
        breakBadge.style.borderColor = '#cbd5e1';
      }
    }

    if (bOutPhotoBox) {
      if (log.break_out_photo_url) {
        bOutPhotoBox.innerHTML = '<img src="' + log.break_out_photo_url + '" alt="BREAK_OUT" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="previewAttendancePhoto(\'' + log.break_out_photo_url + '\', \'รูปถ่ายออกพัก: ' + esc(nameDisplay) + '\', \'เวลาออกพัก: ' + (log.break_out || '-') + '\')" title="คลิกเพื่อดูรูปขนาดใหญ่">';
      } else {
        bOutPhotoBox.innerHTML = '<span style="color:#94a3b8;font-size:11px">ไม่มีรูปถ่ายออกพัก</span>';
      }
    }

    if (bInPhotoBox) {
      if (log.break_in_photo_url) {
        bInPhotoBox.innerHTML = '<img src="' + log.break_in_photo_url + '" alt="BREAK_IN" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="previewAttendancePhoto(\'' + log.break_in_photo_url + '\', \'รูปถ่ายเข้าหลังพัก: ' + esc(nameDisplay) + '\', \'เวลาเข้าหลังพัก: ' + (log.break_in || '-') + '\')" title="คลิกเพื่อดูรูปขนาดใหญ่">';
      } else {
        bInPhotoBox.innerHTML = '<span style="color:#94a3b8;font-size:11px">ไม่มีรูปถ่ายเข้าหลังพัก</span>';
      }
    }

    if (bOutCoords) {
      if (log.break_out_lat && log.break_out_lng) {
        bOutCoords.textContent = log.break_out_lat.toFixed(6) + ', ' + log.break_out_lng.toFixed(6);
        if (bOutMap) bOutMap.innerHTML = '<a href="https://www.google.com/maps?q=' + log.break_out_lat + ',' + log.break_out_lng + '" target="_blank" style="color:#b45309;font-weight:700;text-decoration:underline"><i class="fa-solid fa-map-location-dot"></i> ดูพิกัดบนแผนที่</a>';
      } else {
        bOutCoords.textContent = 'ไม่มีพิกัด';
        if (bOutMap) bOutMap.innerHTML = '<span style="color:#94a3b8">-</span>';
      }
    }

    if (bInCoords) {
      if (log.break_in_lat && log.break_in_lng) {
        bInCoords.textContent = log.break_in_lat.toFixed(6) + ', ' + log.break_in_lng.toFixed(6);
        if (bInMap) bInMap.innerHTML = '<a href="https://www.google.com/maps?q=' + log.break_in_lat + ',' + log.break_in_lng + '" target="_blank" style="color:#0f766e;font-weight:700;text-decoration:underline"><i class="fa-solid fa-map-location-dot"></i> ดูพิกัดบนแผนที่</a>';
      } else {
        bInCoords.textContent = 'ไม่มีพิกัด';
        if (bInMap) bInMap.innerHTML = '<span style="color:#94a3b8">-</span>';
      }
    }
  } else {
    if (breakSec) breakSec.style.display = 'none';
  }

  // 4. Summary strip
  document.getElementById('dtlWorkHours').textContent = (log.work_hours || 0) + ' ชม.';
  document.getElementById('dtlLateMinutes').textContent = (log.late_minutes || 0) + ' นาที';
  document.getElementById('dtlOtHours').textContent = (log.ot_hours || 0) + ' ชม.';
  document.getElementById('dtlRemark').textContent = log.remark || '-';

  // 5. Wire action buttons
  var btnDel = document.getElementById('btnDetailDeleteLog');
  if (btnDel) {
    btnDel.onclick = function() {
      deleteSingleAttendanceLog(log.id, nameDisplay);
    };
  }

  var btnEdit = document.getElementById('btnDetailEditLog');
  if (btnEdit) {
    btnEdit.onclick = function() {
      closeModal('modalAttendanceDetail');
      openEditAttendanceLogModal(log.id);
    };
  }

  openModal('modalAttendanceDetail');
}

// ATTENDANCE EDIT MODAL CONTROLLER
function openEditAttendanceLogModal(id) {
  var log = (_currentAttendanceLogs || []).find(function(x) { return x.id === Number(id); });
  if (!log) {
    showToast('ไม่พบข้อมูลรายการลงเวลานี้', 'error');
    return;
  }

  var nameDisplay = (log.full_name || '-') + (log.nickname ? ' (' + log.nickname + ')' : '');
  document.getElementById('editAttId').value = log.id;
  document.getElementById('editAttEmpDisplay').innerHTML = '<i class="fa-solid fa-user text-blue"></i> ' + esc(nameDisplay) + ' (' + esc(log.emp_id || '') + ') - ' + esc(log.department || '-') + ' / ' + esc(log.position || '-');
  document.getElementById('editAttDate').value = log.date || '';
  document.getElementById('editAttStatus').value = log.status || 'NORMAL';
  document.getElementById('editAttClockIn').value = log.clock_in || '';
  document.getElementById('editAttClockOut').value = log.clock_out || '';
  document.getElementById('editAttBreakOut').value = log.break_out || '';
  document.getElementById('editAttBreakIn').value = log.break_in || '';
  document.getElementById('editAttBreakMinutes').value = log.break_minutes || 0;
  document.getElementById('editAttLateMinutes').value = log.late_minutes || 0;
  document.getElementById('editAttWorkHours').value = log.work_hours || 0;
  document.getElementById('editAttRemark').value = log.remark || '';

  var isFullPay = (log.is_full_pay === 1 || log.is_full_pay === '1' || (log.remark && log.remark.includes('งานเสร็จเลิกงานก่อน-จ่ายเต็มวัน')));
  if (document.getElementById('editAttIsFullPay')) {
    document.getElementById('editAttIsFullPay').checked = !!isFullPay;
  }

  openModal('modalAttendanceEdit');
}

function saveAttendanceLogEditForm(e) {
  if (e) e.preventDefault();

  var id = Number(document.getElementById('editAttId').value);
  var clockIn = document.getElementById('editAttClockIn').value.trim();
  var clockOut = document.getElementById('editAttClockOut').value.trim();
  var breakOut = document.getElementById('editAttBreakOut').value.trim();
  var breakIn = document.getElementById('editAttBreakIn').value.trim();
  var breakMinutes = Number(document.getElementById('editAttBreakMinutes').value) || 0;
  var lateMinutes = Number(document.getElementById('editAttLateMinutes').value) || 0;
  var workHours = Number(document.getElementById('editAttWorkHours').value) || 0;
  var status = document.getElementById('editAttStatus').value;
  var remark = document.getElementById('editAttRemark').value.trim();
  var isFullPay = (document.getElementById('editAttIsFullPay') && document.getElementById('editAttIsFullPay').checked) ? 1 : 0;

  callApi('updateAttendanceLog', {
    id: id,
    clockIn: clockIn,
    clockOut: clockOut,
    breakOut: breakOut,
    breakIn: breakIn,
    breakMinutes: breakMinutes,
    lateMinutes: lateMinutes,
    workHours: workHours,
    status: status,
    remark: remark,
    isFullPay: isFullPay,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      showToast(r.message || 'บันทึกการแก้ไขข้อมูลสำเร็จ');
      closeModal('modalAttendanceEdit');
      loadTimeAttendanceDashboard();
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
    });
}

function getAttendanceStatusBadge(status) {
  if (status === 'APPROVED') {
    return '<span style="font-size:11px;font-weight:700;color:#166534;background:#dcfce7;padding:2px 8px;border-radius:12px"><i class="fa-solid fa-circle-check"></i> อนุมัติแล้ว</span>';
  }
  if (status === 'REJECTED') {
    return '<span style="font-size:11px;font-weight:700;color:#991b1b;background:#fee2e2;padding:2px 8px;border-radius:12px"><i class="fa-solid fa-circle-xmark"></i> ปฏิเสธแล้ว</span>';
  }
  return '<span style="font-size:11px;font-weight:700;color:#854d0e;background:#fef9c3;padding:2px 8px;border-radius:12px"><i class="fa-solid fa-clock"></i> รออนุมัติ</span>';
}

function getAttendanceActionButtons(type, item) {
  var canApprove = hasPermission('approve_attendance') || isSuperAdmin();
  if (!canApprove) {
    return '<span style="font-size:11px;color:#94a3b8;font-style:italic">ดูได้อย่างเดียว</span>';
  }
  var status = item.status || 'PENDING';
  var html = '';
  if (status === 'PENDING') {
    html += '<button type="button" class="btn btn-sm" style="background:#fee2e2;color:#991b1b;font-weight:700" onclick="approveAttendanceRequest(\'' + type + '\', ' + item.id + ', \'REJECT\')"><i class="fa-solid fa-xmark"></i> ปฏิเสธ</button>';
    html += '<button type="button" class="btn btn-sm btn-green" style="font-weight:700" onclick="approveAttendanceRequest(\'' + type + '\', ' + item.id + ', \'APPROVE\')"><i class="fa-solid fa-check"></i> อนุมัติ</button>';
    html += '<button type="button" class="btn btn-sm" style="background:#fff;color:#ef4444;font-weight:600;border:1px solid #fca5a5" title="ลบคำขอนี้ออกจากระบบถาวร" onclick="deleteAttendanceRequest(\'' + type + '\', ' + item.id + ')"><i class="fa-solid fa-trash-can"></i> ลบ</button>';
  } else if (status === 'APPROVED') {
    html += '<button type="button" class="btn btn-sm" style="background:#fff7ed;color:#c2410c;font-weight:700;border:1px solid #fed7aa" title="ยกเลิกการอนุมัติและลบคำขอ" onclick="approveAttendanceRequest(\'' + type + '\', ' + item.id + ', \'DELETE\')"><i class="fa-solid fa-ban"></i> ยกเลิกอนุมัติ</button>';
    html += '<button type="button" class="btn btn-sm" style="background:#fee2e2;color:#dc2626;font-weight:700;border:1px solid #fca5a5" title="ลบคำขอนี้ออกจากระบบถาวร" onclick="deleteAttendanceRequest(\'' + type + '\', ' + item.id + ')"><i class="fa-solid fa-trash-can"></i> ลบคำขอ</button>';
  } else {
    // REJECTED
    html += '<button type="button" class="btn btn-sm" style="background:#fee2e2;color:#dc2626;font-weight:700;border:1px solid #fca5a5" title="ลบคำขอนี้ออกจากระบบถาวร" onclick="deleteAttendanceRequest(\'' + type + '\', ' + item.id + ')"><i class="fa-solid fa-trash-can"></i> ลบคำขอ</button>';
  }
  return html;
}

function renderTimeAttendanceApprovals(leaves, ots, advances) {
  var container = document.getElementById('attPendingListContainer');
  var countEl = document.getElementById('attPendingCountDisplay');
  if (!container) return;

  var total = (leaves ? leaves.length : 0) + (ots ? ots.length : 0) + (advances ? advances.length : 0);
  if (countEl) countEl.textContent = total;

  if (total === 0) {
    var statusLabels = {
      'PENDING': 'รออนุมัติ',
      'APPROVED': 'อนุมัติแล้ว',
      'REJECTED': 'ปฏิเสธแล้ว',
      'ALL': 'ทั้งหมด'
    };
    var typeLabels = {
      'ALL': '',
      'LEAVE': 'ขอลางาน',
      'OT': 'ขอทำ OT',
      'ADVANCE': 'ขอเบิกเงินล่วงหน้า'
    };
    var filterDescs = [];
    if (_currentAttendanceRequestType && _currentAttendanceRequestType !== 'ALL') {
      filterDescs.push('ประเภท: ' + (typeLabels[_currentAttendanceRequestType] || _currentAttendanceRequestType));
    }
    if (_currentAttendanceRequestDate) {
      filterDescs.push('วันที่: ' + _currentAttendanceRequestDate);
    }
    
    var emptyTitle = 'ไม่พบคำขอ' + (statusLabels[_currentAttendanceRequestStatus] ? 'สถานะ ' + statusLabels[_currentAttendanceRequestStatus] : '');
    var emptySub = filterDescs.length > 0 ? filterDescs.join(' | ') : 'ไม่มีรายการคำขอในช่วงที่เลือก';

    container.innerHTML = '<div class="text-muted text-center" style="padding:28px 16px;font-size:12.5px">' +
      '<i class="fa-solid fa-filter-circle-xmark" style="font-size:26px;color:#94a3b8;display:block;margin-bottom:8px"></i>' +
      '<div style="font-weight:700;color:#334155;font-size:13px">' + emptyTitle + '</div>' +
      '<div style="font-size:11.5px;color:#64748b;margin-top:2px">' + emptySub + '</div>' +
      (filterDescs.length > 0 || _currentAttendanceRequestStatus !== 'PENDING' ? 
        '<div style="margin-top:10px"><button type="button" class="btn btn-sm" onclick="resetAttendanceRequestFilters()" style="font-size:11px;padding:4px 10px;background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;border-radius:6px;cursor:pointer"><i class="fa-solid fa-rotate-left"></i> ล้างตัวกรองทั้งหมด</button></div>' : '') +
      '</div>';
    return;
  }

  var html = '';

  // Leaves
  (leaves || []).forEach(function(item) {
    var typeLabel = 'ขอลางาน (' + (item.leave_type || 'ทั่วไป') + ')';
    html += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:8px;padding:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px">' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<span style="font-size:11px;font-weight:700;color:#1d4ed8;background:#dbeafe;padding:2px 8px;border-radius:12px">' + typeLabel + '</span>' +
          getAttendanceStatusBadge(item.status) +
        '</div>' +
        '<span style="font-size:11px;color:#64748b" title="วันที่ยื่นคำขอ"><i class="fa-regular fa-clock" style="font-size:10px"></i> ยื่น: ' + (item.created_at ? String(item.created_at).substring(0, 16) : '') + '</span>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px">' + (item.full_name || item.emp_id) + ' <span style="font-size:11px;font-weight:400;color:#64748b">(' + (item.department || '-') + ')</span></div>' +
      '<div style="font-size:12px;color:#334155;margin-bottom:4px"><i class="fa-regular fa-calendar text-blue"></i> วันที่ลา: <b>' + (item.start_date || '-') + '</b> ถึง <b>' + (item.end_date || '-') + '</b> (' + (item.days_count || 1) + ' วัน)</div>' +
      (item.reason ? '<div style="font-size:11.5px;color:#475569;background:#fff;padding:6px 8px;border-radius:6px;border:1px dashed #cbd5e1;margin-bottom:8px">เหตุผล: ' + item.reason + '</div>' : '') +
      '<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px">' +
        getAttendanceActionButtons('leave', item) +
      '</div>' +
    '</div>';
  });

  // OTs
  (ots || []).forEach(function(item) {
    html += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:8px;padding:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px">' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<span style="font-size:11px;font-weight:700;color:#b45309;background:#fef3c7;padding:2px 8px;border-radius:12px">ขอทำ OT</span>' +
          getAttendanceStatusBadge(item.status) +
        '</div>' +
        '<span style="font-size:11px;color:#64748b" title="วันที่ยื่นคำขอ"><i class="fa-regular fa-clock" style="font-size:10px"></i> ยื่น: ' + (item.created_at ? String(item.created_at).substring(0, 16) : '') + '</span>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px">' + (item.full_name || item.emp_id) + ' <span style="font-size:11px;font-weight:400;color:#64748b">(' + (item.department || '-') + ')</span></div>' +
      '<div style="font-size:12px;color:#334155;margin-bottom:4px"><i class="fa-regular fa-calendar text-orange"></i> วันที่ทำ OT: <b>' + (item.date || '-') + '</b> | จำนวน <b>' + (item.planned_hours || item.actual_hours || 0) + ' ชม.</b></div>' +
      (item.reason ? '<div style="font-size:11.5px;color:#475569;background:#fff;padding:6px 8px;border-radius:6px;border:1px dashed #cbd5e1;margin-bottom:8px">เหตุผล: ' + item.reason + '</div>' : '') +
      '<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px">' +
        getAttendanceActionButtons('ot', item) +
      '</div>' +
    '</div>';
  });

  // Advances
  (advances || []).forEach(function(item) {
    html += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #10b981;border-radius:8px;padding:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px">' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<span style="font-size:11px;font-weight:700;color:#047857;background:#d1fae5;padding:2px 8px;border-radius:12px">ขอเบิกเงินล่วงหน้า</span>' +
          getAttendanceStatusBadge(item.status) +
        '</div>' +
        '<span style="font-size:11px;color:#64748b" title="วันที่ยื่นคำขอ"><i class="fa-regular fa-clock" style="font-size:10px"></i> ยื่น: ' + (item.created_at ? String(item.created_at).substring(0, 16) : '') + '</span>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px">' + (item.full_name || item.emp_id) + ' <span style="font-size:11px;font-weight:400;color:#64748b">(' + (item.department || '-') + ')</span></div>' +
      '<div style="font-size:12px;color:#334155;margin-bottom:2px"><i class="fa-regular fa-calendar text-green"></i> วันที่ขอเบิก: <b>' + (item.request_date || '-') + '</b></div>' +
      '<div style="font-size:13px;color:#047857;font-weight:700;margin-bottom:4px"><i class="fa-solid fa-money-bill-wave"></i> จำนวนเงิน: ฿' + Number(item.amount || 0).toLocaleString() + ' บาท</div>' +
      (item.reason ? '<div style="font-size:11.5px;color:#475569;background:#fff;padding:6px 8px;border-radius:6px;border:1px dashed #cbd5e1;margin-bottom:8px">เหตุผล: ' + item.reason + '</div>' : '') +
      '<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px">' +
        getAttendanceActionButtons('advance', item) +
      '</div>' +
    '</div>';
  });

  container.innerHTML = html;
}

function approveAttendanceRequest(type, id, decision) {
  var actionText = decision === 'APPROVE' ? 'อนุมัติ' : (decision === 'DELETE' ? 'ยกเลิกการอนุมัติ' : 'ปฏิเสธ');
  if (!confirm('ยืนยัน ' + actionText + ' คำขอนี้ ?')) return;

  var reason = '';
  if (decision === 'REJECT') {
    reason = prompt('โปรดระบุเหตุผลการปฏิเสธ (ถ้ามี):', '') || '';
  }

  callApi('handleAttendanceApproval', {
    type: type,
    id: id,
    decision: decision,
    rejectionReason: reason,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      showToast(r.message || ('ดำเนินการ ' + actionText + ' สำเร็จ'));
      loadTimeAttendanceDashboard();
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการดำเนินการ', 'error');
    });
}

function deleteAttendanceRequest(type, id) {
  var typeName = type === 'advance' ? 'เบิกเงินล่วงหน้า' : (type === 'leave' ? 'ลางาน' : 'ทำ OT');
  if (!confirm('คำเตือน: คุณต้องการลบคำขอ' + typeName + 'นี้ออกจากระบบอย่างถาวรใช่หรือไม่?\n(ข้อมูลจะถูกลบออกจากฐานข้อมูลทันที)')) {
    return;
  }

  callApi('deleteAttendanceRequest', {
    type: type,
    id: id,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      showToast(r.message || 'ลบคำขอสำเร็จแล้ว', 'success');
      loadTimeAttendanceDashboard();
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบคำขอ', 'error');
    });
}

function previewAttendancePhoto(url, title, sub) {
  var img = document.getElementById('photoPreviewModalImg');
  var titleEl = document.getElementById('photoPreviewModalTitle');
  var subEl = document.getElementById('photoPreviewModalSub');

  if (img) img.src = url || '';
  if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-image text-blue"></i> <span>' + (title || 'ภาพถ่ายเซลฟี่ยืนยันตัวตน') + '</span>';
  if (subEl) subEl.textContent = sub || '';

  openModal('modalAttendancePhotoPreview');
}

function saveAttendanceSettingsFromPayroll(e) {
  if (e) e.preventDefault();

  var sStart = document.getElementById('attSetShiftStart').value || '09:30';
  var sEnd = document.getElementById('attSetShiftEnd').value || '19:00';
  var sCutoffDay = Number(document.getElementById('attSetCutoffDay') ? document.getElementById('attSetCutoffDay').value : 25) || 25;
  var sGrace = Number(document.getElementById('attSetGraceMinutes').value) || 0;
  var sRadius = Number(document.getElementById('attSetRadiusMeters').value) || 200;
  var sLat = Number(document.getElementById('attSetLat').value) || 13.727896;
  var sLng = Number(document.getElementById('attSetLng').value) || 100.524123;
  
  var enableLeave = document.getElementById('attSetEnableLeave') ? (document.getElementById('attSetEnableLeave').checked ? 'true' : 'false') : 'true';
  var enableOt = document.getElementById('attSetEnableOt') ? (document.getElementById('attSetEnableOt').checked ? 'true' : 'false') : 'true';
  var enableAdv = document.getElementById('attSetEnableAdvance') ? (document.getElementById('attSetEnableAdvance').checked ? 'true' : 'false') : 'true';
  var allowDirectGps = document.getElementById('attSetAllowDirectGps') ? (document.getElementById('attSetAllowDirectGps').checked ? 'true' : 'false') : 'true';
  var enableFaceDetect = document.getElementById('attSetEnableFaceDetect') ? (document.getElementById('attSetEnableFaceDetect').checked ? 'true' : 'false') : 'true';
  var unlockPassword = document.getElementById('attSetUnlockPassword') ? (document.getElementById('attSetUnlockPassword').checked ? 'true' : 'false') : 'true';
  var unlockQr = document.getElementById('attSetUnlockQr') ? (document.getElementById('attSetUnlockQr').checked ? 'true' : 'false') : 'true';
  var unlockRemote = document.getElementById('attSetUnlockRemote') ? (document.getElementById('attSetUnlockRemote').checked ? 'true' : 'false') : 'true';
  
  var leaveSickCert = document.getElementById('attSetLeaveTypeSickWithCert') ? (document.getElementById('attSetLeaveTypeSickWithCert').checked ? 'true' : 'false') : 'true';
  var leaveSickNoCert = document.getElementById('attSetLeaveTypeSickNoCert') ? (document.getElementById('attSetLeaveTypeSickNoCert').checked ? 'true' : 'false') : 'true';
  var leaveBusiness = document.getElementById('attSetLeaveTypeBusiness') ? (document.getElementById('attSetLeaveTypeBusiness').checked ? 'true' : 'false') : 'false';
  var leaveAnnual = document.getElementById('attSetLeaveTypeAnnual') ? (document.getElementById('attSetLeaveTypeAnnual').checked ? 'true' : 'false') : 'false';
  var leaveWithoutPay = document.getElementById('attSetLeaveTypeWithoutPay') ? (document.getElementById('attSetLeaveTypeWithoutPay').checked ? 'true' : 'false') : 'false';

  var advDay = document.getElementById('attSetAdvanceDay') ? document.getElementById('attSetAdvanceDay').value : 'SATURDAY';
  var advRate = document.getElementById('attSetAdvanceDailyRate') ? Number(document.getElementById('attSetAdvanceDailyRate').value) : 250;
  var advStartTime = document.getElementById('attSetAdvanceStartTime') ? document.getElementById('attSetAdvanceStartTime').value : '09:00';
  var advEndTime = document.getElementById('attSetAdvanceEndTime') ? document.getElementById('attSetAdvanceEndTime').value : '18:00';
  var otStart = document.getElementById('attSetOtStart') ? document.getElementById('attSetOtStart').value : '19:00';
  var otRounding = document.getElementById('attSetOtRounding') ? document.getElementById('attSetOtRounding').value : 'HALF_HOUR';
  var qrMode = document.getElementById('attSetQrMode') ? document.getElementById('attSetQrMode').value : 'HYBRID';
  var breakMode = document.getElementById('attSetBreakMode') ? document.getElementById('attSetBreakMode').value : 'AUTO_DEDUCT';
  var breakDuration = document.getElementById('attSetBreakDuration') ? Number(document.getElementById('attSetBreakDuration').value) : 60;

  var enableTimeWindows = document.getElementById('attSetEnableTimeWindows') ? (document.getElementById('attSetEnableTimeWindows').checked ? 'true' : 'false') : 'false';
  var winInStart = document.getElementById('attSetWindowInStart') ? document.getElementById('attSetWindowInStart').value : '06:00';
  var winInEnd = document.getElementById('attSetWindowInEnd') ? document.getElementById('attSetWindowInEnd').value : '12:00';
  var winBreakOutStart = document.getElementById('attSetWindowBreakOutStart') ? document.getElementById('attSetWindowBreakOutStart').value : '11:30';
  var winBreakOutEnd = document.getElementById('attSetWindowBreakOutEnd') ? document.getElementById('attSetWindowBreakOutEnd').value : '14:30';
  var winBreakInStart = document.getElementById('attSetWindowBreakInStart') ? document.getElementById('attSetWindowBreakInStart').value : '12:00';
  var winBreakInEnd = document.getElementById('attSetWindowBreakInEnd') ? document.getElementById('attSetWindowBreakInEnd').value : '15:30';
  var winOutStart = document.getElementById('attSetWindowOutStart') ? document.getElementById('attSetWindowOutStart').value : '17:00';
  var winOutEnd = document.getElementById('attSetWindowOutEnd') ? document.getElementById('attSetWindowOutEnd').value : '23:59';

  var enableKioskLock = document.getElementById('attSetEnableKioskLock') ? (document.getElementById('attSetEnableKioskLock').checked ? 'true' : 'false') : 'true';
  var kioskPin = document.getElementById('attSetKioskPin') ? document.getElementById('attSetKioskPin').value : '123456';
  var kioskRequireGeofence = document.getElementById('attSetKioskRequireGeofence') ? (document.getElementById('attSetKioskRequireGeofence').checked ? 'true' : 'false') : 'true';

  var maintMode = document.getElementById('attSetMaintenanceMode') ? (document.getElementById('attSetMaintenanceMode').checked ? 'true' : 'false') : 'false';
  var maintMsg = document.getElementById('attSetMaintenanceMessage') ? document.getElementById('attSetMaintenanceMessage').value.trim() : '';

  var enablePayslip = document.getElementById('attSetEnablePayslip') ? (document.getElementById('attSetEnablePayslip').checked ? 'true' : 'false') : 'true';
  var payslipReleaseMode = document.getElementById('attSetPayslipReleaseMode') ? document.getElementById('attSetPayslipReleaseMode').value : 'CLOSED_PERIODS_ONLY';

  var settings = {
    shift_start: sStart,
    work_start_time: sStart,
    shift_end: sEnd,
    work_end_time: sEnd,
    cutoff_day: sCutoffDay,
    grace_minutes: sGrace,
    grace_period_morning_minutes: sGrace,
    geofence_radius_meters: sRadius,
    office_lat: sLat,
    office_lng: sLng,
    enable_leave_requests: enableLeave,
    enable_ot_requests: enableOt,
    enable_advance_requests: enableAdv,
    allow_direct_gps: allowDirectGps,
    enable_face_detection: enableFaceDetect,
    unlock_method_password: unlockPassword,
    unlock_method_qr: unlockQr,
    unlock_method_remote: unlockRemote,
    leave_type_sick_with_cert: leaveSickCert,
    leave_type_sick_no_cert: leaveSickNoCert,
    leave_type_business: leaveBusiness,
    leave_type_annual: leaveAnnual,
    leave_type_without_pay: leaveWithoutPay,
    advance_day_of_week: advDay,
    advance_daily_rate: advRate,
    advance_start_time: advStartTime,
    advance_end_time: advEndTime,
    ot_start_time: otStart,
    ot_rounding_mode: otRounding,
    qr_mode: qrMode,
    break_tracking_mode: breakMode,
    break_duration_minutes: breakDuration,
    enable_time_window_restrictions: enableTimeWindows,
    window_in_start: winInStart,
    window_in_end: winInEnd,
    window_break_out_start: winBreakOutStart,
    window_break_out_end: winBreakOutEnd,
    window_break_in_start: winBreakInStart,
    window_break_in_end: winBreakInEnd,
    window_out_start: winOutStart,
    window_out_end: winOutEnd,
    enable_kiosk_lock: enableKioskLock,
    kiosk_pin: kioskPin,
    kiosk_require_geofence: kioskRequireGeofence,
    system_maintenance_mode: maintMode,
    system_maintenance_message: maintMsg,
    enable_payslip: enablePayslip,
    payslip_release_mode: payslipReleaseMode
  };

  callApi('saveAttendanceSettings', {
    settings: settings,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      showToast(r.message || 'บันทึกการตั้งค่าระบบลงเวลา & สวัสดิการเรียบร้อยแล้ว');
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
    });
}

function triggerBroadcastPayslipFromPayroll() {
  var periodInput = document.getElementById('attBroadcastPeriod');
  var period = periodInput ? periodInput.value.trim() : '';
  if (!period) {
    showToast('กรุณาระบุงวดเงินเดือน เช่น 2026-09', 'warning');
    return;
  }

  if (!confirm('ยืนยันส่งการแจ้งเตือนสลิปเงินเดือนงวด "' + period + '" ไปยังพนักงานทุกคนใช่หรือไม่?\n(ระบบจะส่ง Push Notification บนมือถือ และขึ้นจุดแจ้งเตือนสีแดงในแอป PTN Time)')) {
    return;
  }

  callApi('broadcastPayslipNotification', {
    period: period,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (r && r.success) {
        showToast(r.message || ('ส่งแจ้งเตือนสลิปงวด ' + period + ' เรียบร้อยแล้ว'), 'success');
      } else {
        showToast(r && r.message ? r.message : 'ส่งแจ้งเตือนไม่สำเร็จ', 'error');
      }
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน', 'error');
    });
}

function toggleTimeWindowsUI(enabled) {
  var grid = document.getElementById('attTimeWindowsGrid');
  if (grid) {
    grid.style.opacity = enabled ? '1' : '0.45';
    grid.style.pointerEvents = enabled ? 'auto' : 'none';
  }
}

// ==========================================
// 🏢 MULTI-BRANCH MANAGEMENT CONTROLLERS
// ==========================================
function openBranchManagerModal() {
  if (!isSuperAdmin() && !hasPermission('manage_attendance_settings')) {
    showToast('สิทธิ์ไม่เพียงพอ: จัดการสาขาสงวนสิทธิ์เฉพาะผู้ได้รับสิทธิ์จัดการสาขาหรือ Super Admin เท่านั้น', 'warning');
    return;
  }
  openModal('modalBranchManager');
  renderBranchManagerTable();
}

function renderBranchManagerTable() {
  var tbody = document.getElementById('branchManagerTableBody');
  if (!tbody) return;

  var bList = State.branches || [];
  if (!bList.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:24px">ไม่พบข้อมูลสาขา</td></tr>';
    return;
  }

  var html = '';
  bList.forEach(function(b) {
    var statusBadge = (b.status === 'ACTIVE' || !b.status)
      ? '<span class="period-pill" style="background:#ecfdf5;color:#059669;border-color:#a7f3d0;font-size:11px">🟢 เปิดใช้งาน</span>'
      : '<span class="period-pill" style="background:#fef2f2;color:#dc2626;border-color:#fecaca;font-size:11px">🔴 ปิดชั่วคราว</span>';

    var workTime = (b.work_start_time || '09:30') + ' - ' + (b.work_end_time || '19:00');
    var lunchTime = (b.lunch_start_time || '13:00') + ' - ' + (b.lunch_end_time || '14:00');
    var otTime = b.ot_start_time || b.work_end_time || '19:00';
    var coords = (b.lat ? Number(b.lat).toFixed(4) : '-') + ', ' + (b.lng ? Number(b.lng).toFixed(4) : '-');
    var radius = (b.radius_meters || 200) + ' ม.';

    html += '<tr>' +
      '<td class="font-bold text-blue font-mono" style="font-size:12.5px">' + esc(b.branch_id) + '</td>' +
      '<td>' +
        '<div style="font-weight:700;color:#0f172a">' + esc(b.branch_name) + '</div>' +
        (b.grace_minutes > 0 ? '<div style="font-size:10.5px;color:#c2410c">ผ่อนผัน ' + b.grace_minutes + ' นาที</div>' : '') +
      '</td>' +
      '<td class="text-center font-bold font-mono" style="color:#1e40af;font-size:12px">' + workTime + '</td>' +
      '<td class="text-center font-mono" style="color:#b45309;font-size:12px">' + lunchTime + '</td>' +
      '<td class="text-center font-mono font-bold" style="color:#7c3aed;font-size:12px">' + otTime + '</td>' +
      '<td style="font-size:11px;color:#475569">' +
        '<div><i class="fa-solid fa-location-dot text-green"></i> ' + coords + '</div>' +
        '<div style="color:#64748b;font-size:10.5px">รัศมี: ' + radius + '</div>' +
      '</td>' +
      '<td class="text-center font-mono" style="font-size:11.5px;color:#0f766e;letter-spacing:1px">••••••</td>' +
      '<td class="text-center">' + statusBadge + '</td>' +
      (function() {
        var isEarly = (b.early_dismissal_full_pay === 1 || b.early_dismissal_full_pay === '1' || b.early_dismissal_full_pay === 'true' || b.early_dismissal_full_pay === true);
        var earlyBtn = '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 8px;font-weight:700;background:' + (isEarly ? '#ecfdf5' : '#f8fafc') + ';color:' + (isEarly ? '#059669' : '#64748b') + ';border:1.5px solid ' + (isEarly ? '#10b981' : '#cbd5e1') + '" onclick="toggleBranchEarlyDismissal(\'' + esc(b.branch_id) + '\', ' + !isEarly + ')" title="คลิกเพื่อเปิด/ปิดโหมดงานเสร็จ">' +
          (isEarly ? '🟢 เปิด (จ่ายเต็ม)' : '⚪ ปิด (ปกติ)') +
        '</button>';
        return '<td class="text-center">' + earlyBtn + '</td>';
      })() +
      '<td class="text-center" style="white-space:nowrap">' +
        '<div style="display:inline-flex;gap:4px">' +
          '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 8px;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd" onclick="openEditBranchModal(\'' + esc(b.branch_id) + '\')" title="แก้ไขสาขานี้">' +
            '<i class="fa-solid fa-pen-to-square"></i> แก้ไข' +
          '</button>' +
          '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 6px;background:#fee2e2;color:#b91c1c;border:1px solid #fecaca" onclick="deleteBranchPrompt(\'' + esc(b.branch_id) + '\', \'' + esc(b.branch_name) + '\')" title="ลบสาขา">' +
            '<i class="fa-solid fa-trash-can"></i>' +
          '</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  });

  tbody.innerHTML = html;
}

function renderBranchEarlyDismissalBar() {
  var container = document.getElementById('containerBranchEarlySwitches');
  if (!container) return;

  var bList = State.branches || [];
  if (!bList.length) {
    container.innerHTML = '<span style="font-size:12px;color:#94a3b8">กำลังโหลดข้อมูลสาขา...</span>';
    return;
  }

  var html = '';
  bList.forEach(function(b) {
    var isEarly = (b.early_dismissal_full_pay === 1 || b.early_dismissal_full_pay === '1' || b.early_dismissal_full_pay === 'true' || b.early_dismissal_full_pay === true);
    var badgeBg = isEarly ? '#ecfdf5' : '#f8fafc';
    var badgeBorder = isEarly ? '#10b981' : '#cbd5e1';
    var textColor = isEarly ? '#047857' : '#475569';
    var statusText = isEarly ? '🟢 เปิด (จ่ายเต็มวัน)' : '⚪ ปกติ';

    html += '<div style="display:flex;align-items:center;gap:8px;background:' + badgeBg + ';border:1.5px solid ' + badgeBorder + ';padding:6px 12px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,0.04);transition:all 0.2s">' +
      '<div style="font-weight:700;font-size:12px;color:' + textColor + '">' +
        '<i class="fa-solid fa-store" style="margin-right:4px"></i>' + esc(b.branch_name) +
      '</div>' +
      '<label class="switch-toggle" style="position:relative;display:inline-block;width:38px;height:20px;cursor:pointer">' +
        '<input type="checkbox" ' + (isEarly ? 'checked' : '') + ' onchange="toggleBranchEarlyDismissal(\'' + esc(b.branch_id) + '\', this.checked)" style="opacity:0;width:0;height:0">' +
        '<span style="position:absolute;top:0;left:0;right:0;bottom:0;background:' + (isEarly ? '#10b981' : '#cbd5e1') + ';border-radius:20px;transition:0.3s;box-shadow:inset 0 1px 2px rgba(0,0,0,0.1)">' +
          '<span style="position:absolute;content:\'\';height:14px;width:14px;left:' + (isEarly ? '20px' : '3px') + ';bottom:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>' +
        '</span>' +
      '</label>' +
      '<span style="font-size:11px;font-weight:700;color:' + textColor + '">' + statusText + '</span>' +
    '</div>';
  });

  container.innerHTML = html;
}

function toggleBranchEarlyDismissal(branchId, enabled) {
  var b = (State.branches || []).find(function(x) { return x.branch_id === branchId; });
  var bName = b ? b.branch_name : branchId;

  showToast('กำลัง' + (enabled ? 'เปิด' : 'ปิด') + 'โหมดงานเสร็จสาขา ' + bName + '...', 'info');

  callApi('toggleBranchEarlyDismissal', {
    branchId: branchId,
    enabled: enabled,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (r && r.success) {
        showToast(r.message || 'อัปเดตโหมดงานเสร็จสำเร็จ');
        if (b) {
          b.early_dismissal_full_pay = enabled ? 1 : 0;
        }
        renderBranchEarlyDismissalBar();
        renderBranchManagerTable();
      } else {
        showToast(r ? r.message : 'ไม่สามารถอัปเดตได้', 'error');
        renderBranchEarlyDismissalBar();
        renderBranchManagerTable();
      }
    })
    .catch(function(err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
      renderBranchEarlyDismissalBar();
      renderBranchManagerTable();
    });
}

function openEditBranchModal(branchId) {
  var b = null;
  if (branchId && State.branches) {
    b = State.branches.find(function(x) { return x.branch_id === branchId; });
  }

  var titleEl = document.getElementById('modalEditBranchTitle');
  var bIdInput = document.getElementById('bBranchId');

  if (b) {
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-pen-to-square text-blue"></i> <span>แก้ไขสาขา [' + esc(b.branch_id) + '] ' + esc(b.branch_name) + '</span>';
    if (bIdInput) { bIdInput.value = b.branch_id; bIdInput.readOnly = true; }
    document.getElementById('bBranchName').value = b.branch_name || '';
    document.getElementById('bWorkStart').value = b.work_start_time || '09:30';
    document.getElementById('bWorkEnd').value = b.work_end_time || '19:00';
    document.getElementById('bLunchStart').value = b.lunch_start_time || '13:00';
    document.getElementById('bLunchEnd').value = b.lunch_end_time || '14:00';
    document.getElementById('bGraceMinutes').value = b.grace_minutes || 0;
    document.getElementById('bOtStart').value = b.ot_start_time || b.work_end_time || '19:00';
    document.getElementById('bLat').value = b.lat || 13.727896;
    document.getElementById('bLng').value = b.lng || 100.524123;
    document.getElementById('bRadius').value = b.radius_meters || 200;
    document.getElementById('bKioskPin').value = b.kiosk_pin || '123456';
    document.getElementById('bStatus').value = b.status || 'ACTIVE';
    var isEarly = (b.early_dismissal_full_pay === 1 || b.early_dismissal_full_pay === '1' || b.early_dismissal_full_pay === 'true' || b.early_dismissal_full_pay === true);
    if (document.getElementById('bEarlyDismissal')) document.getElementById('bEarlyDismissal').checked = !!isEarly;
  } else {
    var nextId = 'B0' + ((State.branches ? State.branches.length : 0) + 1);
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-plus text-blue"></i> <span>เพิ่มสาขาใหม่</span>';
    if (bIdInput) { bIdInput.value = nextId; bIdInput.readOnly = false; }
    document.getElementById('bBranchName').value = '';
    document.getElementById('bWorkStart').value = '09:30';
    document.getElementById('bWorkEnd').value = '19:00';
    document.getElementById('bLunchStart').value = '13:00';
    document.getElementById('bLunchEnd').value = '14:00';
    document.getElementById('bGraceMinutes').value = 0;
    document.getElementById('bOtStart').value = '19:00';
    document.getElementById('bLat').value = 13.727896;
    document.getElementById('bLng').value = 100.524123;
    document.getElementById('bRadius').value = 200;
    document.getElementById('bKioskPin').value = '123456';
    document.getElementById('bStatus').value = 'ACTIVE';
    if (document.getElementById('bEarlyDismissal')) document.getElementById('bEarlyDismissal').checked = false;
  }

  openModal('modalEditBranch');
}

function saveBranchForm(e) {
  if (e && e.preventDefault) e.preventDefault();

  var branchId = (document.getElementById('bBranchId').value || '').trim().toUpperCase();
  var branchName = (document.getElementById('bBranchName').value || '').trim();
  if (!branchId || !branchName) {
    showToast('กรุณาระบุรหัสและชื่อสาขา', 'error');
    return;
  }

  var branchObj = {
    branch_id: branchId,
    branch_name: branchName,
    work_start_time: document.getElementById('bWorkStart').value || '09:30',
    work_end_time: document.getElementById('bWorkEnd').value || '19:00',
    lunch_start_time: document.getElementById('bLunchStart').value || '13:00',
    lunch_end_time: document.getElementById('bLunchEnd').value || '14:00',
    grace_minutes: Number(document.getElementById('bGraceMinutes').value) || 0,
    ot_start_time: document.getElementById('bOtStart').value || '19:00',
    lat: Number(document.getElementById('bLat').value) || 13.727896,
    lng: Number(document.getElementById('bLng').value) || 100.524123,
    radius_meters: Number(document.getElementById('bRadius').value) || 200,
    kiosk_pin: (document.getElementById('bKioskPin').value || '123456').trim(),
    status: document.getElementById('bStatus').value || 'ACTIVE',
    early_dismissal_full_pay: (document.getElementById('bEarlyDismissal') && document.getElementById('bEarlyDismissal').checked) ? 1 : 0
  };

  callApi('saveBranch', {
    branch: branchObj,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (r && r.success) {
        showToast(r.message || 'บันทึกข้อมูลสาขาสำเร็จ');
        closeModal('modalEditBranch');
        callApi('getBranches').then(function(res) {
          if (res && res.branches) {
            State.branches = res.branches;
            populateBranchSelects();
            renderBranchManagerTable();
            loadTimeAttendanceDashboard();
          }
        });
      } else {
        showToast(r ? r.message : 'บันทึกไม่สำเร็จ', 'error');
      }
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการบันทึกสาขา', 'error');
    });
}

function deleteBranchPrompt(branchId, branchName) {
  if (!confirm('ยืนยันการลบสาขา [' + branchId + '] ' + branchName + ' ?')) return;

  callApi('deleteBranch', {
    branchId: branchId,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (r && r.success) {
        showToast(r.message || 'ลบสาขาสำเร็จ');
        callApi('getBranches').then(function(res) {
          if (res && res.branches) {
            State.branches = res.branches;
            populateBranchSelects();
            renderBranchManagerTable();
            loadTimeAttendanceDashboard();
          }
        });
      } else {
        showToast(r ? r.message : 'ลบไม่สำเร็จ', 'error');
      }
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบสาขา', 'error');
    });
}

function getCurrentLocationForBranchEdit() {
  if (!navigator.geolocation) {
    showToast('เบราว์เซอร์ไม่รองรับ Geolocation', 'warning');
    return;
  }
  showToast('กำลังตรวจหาพิกัด GPS...', 'info');
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      document.getElementById('bLat').value = pos.coords.latitude.toFixed(6);
      document.getElementById('bLng').value = pos.coords.longitude.toFixed(6);
      showToast('ดึงพิกัดสำเร็จ: ' + pos.coords.latitude.toFixed(6) + ', ' + pos.coords.longitude.toFixed(6));
    },
    function(err) {
      showToast('ไม่สามารถดึงพิกัดได้: ' + err.message, 'error');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function syncAttendanceToPayrollPeriod() {
  if (!confirm('ยืนยันดึงข้อมูลเวลาทำงาน OT วันลา และยอดเบิกเงินจาก PTN Time เข้าสู่งวดเงินเดือนปัจจุบัน (' + State.period + ') ?')) return;

  showToast('กำลังดึงข้อมูลและประมวลผลเงินเดือนงวด ' + State.period + '...', 'info');
  callApi('syncFromPtnTime', {
    period: State.period,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      showToast(r.message || 'ดึงข้อมูลสำเร็จ');
      loadAppData();
    })
    .catch(function(e) {
      showToast(e.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
    });
}

// ==============================================================================
// TIME ATTENDANCE CSV EXPORT CONTROLLER (DAILY & PERIOD / RANGE)
// ==============================================================================
function generateAttendanceCsvString(logs) {
  var csv = '\uFEFF';
  csv += 'วันที่,รหัสพนักงาน,ชื่อ-นามสกุล,ชื่อเล่น,แผนก,ตำแหน่ง,สาขา,เวลาเข้างาน,เวลาออกพัก,เวลากลับเข้าพัก,เวลาพักจริง(นาที),พักเกินเกณฑ์(นาที),เวลาเลิกงาน,นาทีสาย,ชั่วโมงทำงานปกติ,ชั่วโมงOT,สถานะ,พิกัดเข้างาน,พิกัดออกงาน,หมายเหตุ\n';

  (logs || []).forEach(function(l) {
    var branchName = l.branch_name || '';
    if (!branchName && l.branch_id) {
      var foundB = (State.branches || []).find(function(b) { return b.branch_id === l.branch_id; });
      branchName = foundB ? foundB.branch_name : l.branch_id;
    }
    if (!branchName && l.emp_branch_id) {
      var foundEB = (State.branches || []).find(function(b) { return b.branch_id === l.emp_branch_id; });
      branchName = foundEB ? foundEB.branch_name : l.emp_branch_id;
    }
    if (!branchName) branchName = 'สำนักงานใหญ่';

    var inGps = (l.in_lat && l.in_lng) ? (l.in_lat + ' ' + l.in_lng) : '';
    var outGps = (l.out_lat && l.out_lng) ? (l.out_lat + ' ' + l.out_lng) : '';

    var row = [
      l.date || '',
      l.emp_id || '',
      '"' + (l.full_name || '').replace(/"/g, '""') + '"',
      '"' + (l.nickname || '').replace(/"/g, '""') + '"',
      '"' + (l.department || '').replace(/"/g, '""') + '"',
      '"' + (l.position || '').replace(/"/g, '""') + '"',
      '"' + branchName.replace(/"/g, '""') + '"',
      l.clock_in || '',
      l.break_out || '',
      l.break_in || '',
      (l.break_minutes != null) ? l.break_minutes : 0,
      (l.overbreak_minutes != null) ? l.overbreak_minutes : 0,
      l.clock_out || '',
      l.late_minutes || 0,
      l.work_hours || 0,
      l.ot_hours || 0,
      '"' + (l.status || 'NORMAL') + '"',
      '"' + inGps + '"',
      '"' + outGps + '"',
      '"' + (l.remark || '').replace(/"/g, '""') + '"'
    ];
    csv += row.join(',') + '\n';
  });

  return csv;
}

function exportAttendanceTodayCsv() {
  if (!_currentAttendanceLogs || _currentAttendanceLogs.length === 0) {
    showToast('ไม่พบข้อมูลลงเวลาในช่วงที่เลือก', 'warning');
    return;
  }

  var filterInput = document.getElementById('attFilterDate');
  var dateStr = filterInput ? filterInput.value : 'today';
  var branchSelect = document.getElementById('attFilterBranch');
  var branchStr = branchSelect ? branchSelect.value : 'ALL';

  var filename = '';
  if (_currentAttendanceIsIndividual) {
    var periodSuffix = '';
    if (_currentAttendanceDateMode === 'PERIOD') {
      var pInput = document.getElementById('attFilterPeriod');
      periodSuffix = (pInput ? pInput.value : 'period') + '_cutoff';
    } else if (_currentAttendanceDateMode === 'MONTH') {
      var mInput = document.getElementById('attFilterMonth');
      periodSuffix = mInput ? mInput.value : 'monthly';
    } else if (_currentAttendanceDateMode === 'RANGE') {
      var sInput = document.getElementById('attFilterStartDate');
      var eInput = document.getElementById('attFilterEndDate');
      periodSuffix = (sInput ? sInput.value : '') + '_to_' + (eInput ? eInput.value : '');
    } else {
      periodSuffix = dateStr;
    }
    filename = 'PTN_Timesheet_' + (_currentAttendanceEmpId || 'EMP') + '_' + periodSuffix + '.csv';
  } else {
    var periodSuffixAll = '';
    if (_currentAttendanceDateMode === 'PERIOD') {
      var pInputAll = document.getElementById('attFilterPeriod');
      periodSuffixAll = (pInputAll ? pInputAll.value : 'period') + '_cutoff';
    } else if (_currentAttendanceDateMode === 'MONTH') {
      var mInputAll = document.getElementById('attFilterMonth');
      periodSuffixAll = mInputAll ? mInputAll.value : 'monthly';
    } else if (_currentAttendanceDateMode === 'RANGE') {
      var sInputAll = document.getElementById('attFilterStartDate');
      var eInputAll = document.getElementById('attFilterEndDate');
      periodSuffixAll = (sInputAll ? sInputAll.value : '') + '_to_' + (eInputAll ? eInputAll.value : '');
    } else {
      periodSuffixAll = dateStr;
    }
    filename = 'PTN_Attendance_' + periodSuffixAll + (branchStr !== 'ALL' ? ('_' + branchStr) : '') + '.csv';
  }

  var csv = generateAttendanceCsvString(_currentAttendanceLogs);
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('ดาวน์โหลดข้อมูลลงเวลาสำเร็จ (' + _currentAttendanceLogs.length + ' รายการ)', 'success');
}

function formatLocalYmd(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function openExportAttendanceModal() {
  // Populate branch select
  var bSel = document.getElementById('expAttBranch');
  if (bSel) {
    bSel.innerHTML = '<option value="ALL">🏢 ทุกสาขา (All Branches)</option>';
    var branches = State.branches || [];
    if (branches.length === 0) {
      // Fallback from filter select if available
      var mainBSel = document.getElementById('attFilterBranch');
      if (mainBSel && mainBSel.options) {
        for (var i = 0; i < mainBSel.options.length; i++) {
          var val = mainBSel.options[i].value;
          var txt = mainBSel.options[i].textContent;
          if (val && val !== 'ALL') {
            var opt = document.createElement('option');
            opt.value = val;
            opt.textContent = txt;
            bSel.appendChild(opt);
          }
        }
      }
    } else {
      branches.forEach(function(b) {
        var opt = document.createElement('option');
        opt.value = b.branch_id;
        opt.textContent = b.branch_id + ' - ' + b.branch_name;
        bSel.appendChild(opt);
      });
    }
  }

  // Populate department select
  var dSel = document.getElementById('expAttDept');
  if (dSel) {
    dSel.innerHTML = '<option value="ALL">👥 ทุกแผนก (All Departments)</option>';
    var depts = {};
    (State.employees || []).forEach(function(e) {
      if (e.department) depts[e.department] = true;
    });
    Object.keys(depts).sort().forEach(function(dept) {
      var opt = document.createElement('option');
      opt.value = dept;
      opt.textContent = dept;
      dSel.appendChild(opt);
    });
  }

  // Default to cutoff preset
  setExportAttendancePreset('cutoff');
  openModal('modalExportAttendanceRange');
}

function setExportAttendancePreset(preset) {
  var now = new Date();
  var startInput = document.getElementById('expAttStartDate');
  var endInput = document.getElementById('expAttEndDate');
  if (!startInput || !endInput) return;

  var cutDay = 25;
  if (_currentAttendanceSettings && _currentAttendanceSettings.cutoff_day) {
    cutDay = Number(_currentAttendanceSettings.cutoff_day);
  } else if (State.settings && State.settings.cutoff_day) {
    cutDay = Number(State.settings.cutoff_day);
  } else {
    var cutEl = document.getElementById('attSetCutoffDay');
    if (cutEl && cutEl.value) cutDay = Number(cutEl.value);
  }
  if (!cutDay || isNaN(cutDay)) cutDay = 25;

  var currentYear = now.getFullYear();
  var currentMonth = now.getMonth() + 1; // 1-12
  var currentDate = now.getDate();

  if (preset === 'cutoff') {
    var startYear, startMonth, startDayNum;
    var endYear, endMonth, endDayNum;

    if (currentDate > cutDay) {
      startYear = currentYear;
      startMonth = currentMonth;
      startDayNum = cutDay + 1;

      endMonth = currentMonth + 1;
      endYear = currentYear;
      if (endMonth > 12) {
        endMonth = 1;
        endYear += 1;
      }
      endDayNum = cutDay;
    } else {
      endYear = currentYear;
      endMonth = currentMonth;
      endDayNum = cutDay;

      startMonth = currentMonth - 1;
      startYear = currentYear;
      if (startMonth < 1) {
        startMonth = 12;
        startYear -= 1;
      }
      startDayNum = cutDay + 1;
    }

    var maxDaysStart = new Date(startYear, startMonth, 0).getDate();
    if (startDayNum > maxDaysStart) startDayNum = 1;

    var maxDaysEnd = new Date(endYear, endMonth, 0).getDate();
    if (endDayNum > maxDaysEnd) endDayNum = maxDaysEnd;

    startInput.value = startYear + '-' + String(startMonth).padStart(2, '0') + '-' + String(startDayNum).padStart(2, '0');
    endInput.value = endYear + '-' + String(endMonth).padStart(2, '0') + '-' + String(endDayNum).padStart(2, '0');
  } else if (preset === 'this_month') {
    var lastDay = new Date(currentYear, currentMonth, 0).getDate();
    startInput.value = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-01';
    endInput.value = currentYear + '-' + String(currentMonth).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
  } else if (preset === 'last_month') {
    var prevMonth = currentMonth - 1;
    var prevYear = currentYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    var lastDay = new Date(prevYear, prevMonth, 0).getDate();
    startInput.value = prevYear + '-' + String(prevMonth).padStart(2, '0') + '-01';
    endInput.value = prevYear + '-' + String(prevMonth).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
  } else if (preset === 'last_7') {
    var past = new Date(now.getTime() - (6 * 24 * 3600 * 1000));
    startInput.value = formatLocalYmd(past);
    endInput.value = formatLocalYmd(now);
  } else if (preset === 'last_30') {
    var past = new Date(now.getTime() - (29 * 24 * 3600 * 1000));
    startInput.value = formatLocalYmd(past);
    endInput.value = formatLocalYmd(now);
  }
}

function submitExportAttendanceRangeCsv() {
  var startDate = document.getElementById('expAttStartDate').value;
  var endDate = document.getElementById('expAttEndDate').value;
  var branchId = document.getElementById('expAttBranch').value;
  var dept = document.getElementById('expAttDept').value;
  var btn = document.getElementById('btnSubmitExportAttRange');

  if (!startDate || !endDate) {
    showToast('กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด', 'warning');
    return;
  }
  if (startDate > endDate) {
    showToast('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด', 'warning');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังดึงข้อมูล...';
  }

  showToast('กำลังดึงข้อมูลลงเวลาระหว่าง ' + startDate + ' ถึง ' + endDate + '...', 'info');

  callApi('getAttendanceLogsRange', {
    startDate: startDate,
    endDate: endDate,
    branchId: branchId,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-arrow-down"></i> ดาวน์โหลด Excel (CSV)';
      }

      if (!r || !r.success) {
        showToast(r && r.message ? r.message : 'เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
        return;
      }

      var logs = r.logs || [];
      if (dept && dept !== 'ALL') {
        logs = logs.filter(function(l) { return l.department === dept; });
      }

      if (logs.length === 0) {
        showToast('ไม่พบข้อมูลลงเวลาในช่วงวันที่ ' + startDate + ' ถึง ' + endDate, 'warning');
        return;
      }

      var csv = generateAttendanceCsvString(logs);
      var branchSuffix = branchId !== 'ALL' ? ('_' + branchId) : '';
      var deptSuffix = dept !== 'ALL' ? ('_' + dept) : '';
      var filename = 'PTN_Attendance_' + startDate + '_to_' + endDate + branchSuffix + deptSuffix + '.csv';

      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      closeModal('modalExportAttendanceRange');
      showToast('ดาวน์โหลดข้อมูลลงเวลาสำเร็จ (' + logs.length + ' รายการ)', 'success');
    })
    .catch(function(e) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-arrow-down"></i> ดาวน์โหลด Excel (CSV)';
      }
      showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    });
}

// Master QR Modal Controllers
function openMasterQrModalFromPayroll() {
  openModal('modalPayrollMasterQr');
  refreshPayrollMasterQrCode();
}

function closePayrollMasterQrModal() {
  if (_payrollMasterQrInterval) {
    clearInterval(_payrollMasterQrInterval);
    _payrollMasterQrInterval = null;
  }
  closeModal('modalPayrollMasterQr');
}

function refreshPayrollMasterQrCode() {
  if (_payrollMasterQrInterval) {
    clearInterval(_payrollMasterQrInterval);
    _payrollMasterQrInterval = null;
  }

  var container = document.getElementById('payrollMasterQrContainer');
  if (container) container.innerHTML = '<div style="padding:40px;color:#64748b;font-size:12px"><i class="fa-solid fa-spinner fa-spin"></i> กำลังสร้างรหัส QR...</div>';

  callApi('getMasterUnlockQr')
    .then(function(r) {
      if (!r || !r.token) {
        showToast('ไม่สามารถสร้าง Master QR ได้', 'error');
        return;
      }

      if (container) {
        container.innerHTML = '';
        _payrollMasterQrObj = new QRCode(container, {
          text: r.token,
          width: 180,
          height: 180,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }

      _payrollMasterQrSecondsLeft = r.secondsLeft || 60;
      updatePayrollMasterQrCountdownDisplay();

      _payrollMasterQrInterval = setInterval(function() {
        _payrollMasterQrSecondsLeft--;
        if (_payrollMasterQrSecondsLeft <= 0) {
          refreshPayrollMasterQrCode();
        } else {
          updatePayrollMasterQrCountdownDisplay();
        }
      }, 1000);
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการสร้าง Master QR', 'error');
    });
}

function updatePayrollMasterQrCountdownDisplay() {
  var countEl = document.getElementById('payrollMasterQrCountdown');
  var barEl = document.getElementById('payrollMasterQrProgressBar');
  if (countEl) countEl.textContent = _payrollMasterQrSecondsLeft + 's';
  if (barEl) {
    var pct = Math.max(0, Math.min(100, (_payrollMasterQrSecondsLeft / 60) * 100));
    barEl.style.width = pct + '%';
    if (_payrollMasterQrSecondsLeft <= 10) {
      barEl.style.background = '#ef4444';
    } else if (_payrollMasterQrSecondsLeft <= 25) {
      barEl.style.background = '#f59e0b';
    } else {
      barEl.style.background = '#10b981';
    }
  }
}

// =======================================================
// REALTIME IN-APP NOTIFICATION CENTER & ALERTS (PAYROLL ADMIN)
// =======================================================

var AdminNotifState = {
  soundEnabled: localStorage.getItem('ptn_admin_notif_sound') !== 'false',
  unreadCount: 0,
  seenItemIds: new Set(JSON.parse(localStorage.getItem('ptn_admin_seen_items') || '[]')),
  lastData: null,
  pollerInterval: null
};

function initAdminNotificationCenter() {
  updateSoundIcon();
  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    var wrapper = document.querySelector('.notif-dropdown-wrapper');
    var dropdown = document.getElementById('adminNotifDropdown');
    if (dropdown && wrapper && !wrapper.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Start periodic polling every 30 seconds
  if (AdminNotifState.pollerInterval) clearInterval(AdminNotifState.pollerInterval);
  AdminNotifState.pollerInterval = setInterval(pollAdminRealtimeAlerts, 30000);

  // Poll when browser tab gains focus
  window.addEventListener('focus', function() {
    pollAdminRealtimeAlerts();
  });

  // Initial poll after auth
  setTimeout(pollAdminRealtimeAlerts, 2000);
}

function toggleAdminNotifDropdown() {
  var dropdown = document.getElementById('adminNotifDropdown');
  if (!dropdown) return;
  if (dropdown.style.display === 'none' || !dropdown.style.display) {
    dropdown.style.display = 'block';
    // Mark badge as seen
    AdminNotifState.unreadCount = 0;
    updateAdminNotifBadge();
    // Render current or fetch fresh
    pollAdminRealtimeAlerts();
  } else {
    dropdown.style.display = 'none';
  }
}

function pollAdminRealtimeAlerts() {
  if (!State.currentUser || !State.currentUser.username) return;

  callApi('getAdminRealtimeAlerts', { username: State.currentUser.username })
    .then(function(res) {
      if (res && res.success) {
        processAdminAlerts(res);
      }
    })
    .catch(function(err) {
      console.warn('Realtime poller note:', err);
    });
}

function processAdminAlerts(data) {
  AdminNotifState.lastData = data;
  var leaves = data.pendingLeaves || [];
  var ots = data.pendingOts || [];
  var advances = data.pendingAdvances || [];
  var anomalies = data.anomalies || [];

  var newItems = [];

  // Check leaves
  leaves.forEach(function(lv) {
    var key = 'lv_' + lv.id;
    if (!AdminNotifState.seenItemIds.has(key)) {
      newItems.push({
        type: 'leave',
        title: 'มีคำขอลางานใหม่ 🏖️',
        desc: (lv.full_name || ('พนักงาน ' + lv.emp_id)) + ' ขอลางาน ' + (lv.days || 1) + ' วัน (' + (lv.start_date || '') + ')'
      });
      AdminNotifState.seenItemIds.add(key);
    }
  });

  // Check OTs
  ots.forEach(function(ot) {
    var key = 'ot_' + ot.id;
    if (!AdminNotifState.seenItemIds.has(key)) {
      newItems.push({
        type: 'ot',
        title: 'มีคำขอ OT เข้าใหม่ ⏳',
        desc: (ot.full_name || ('พนักงาน ' + ot.emp_id)) + ' ร้องขอ OT ' + (ot.ot_hours || 0) + ' ชม. วันที่ ' + (ot.ot_date || '')
      });
      AdminNotifState.seenItemIds.add(key);
    }
  });

  // Check Advances
  advances.forEach(function(ad) {
    var key = 'ad_' + ad.id;
    if (!AdminNotifState.seenItemIds.has(key)) {
      newItems.push({
        type: 'advance',
        title: 'มีคำขอเบิกเงินล่วงหน้า 💵',
        desc: (ad.full_name || ('พนักงาน ' + ad.emp_id)) + ' ขอเบิกเงิน ฿' + Number(ad.amount || 0).toLocaleString()
      });
      AdminNotifState.seenItemIds.add(key);
    }
  });

  // Check Anomalies
  anomalies.forEach(function(an) {
    var key = 'an_' + an.id + '_' + (an.overbreak_minutes || 0);
    if (!AdminNotifState.seenItemIds.has(key)) {
      newItems.push({
        type: 'anomaly',
        title: '⚠️ แจ้งเตือนพักเกินเวลา',
        desc: (an.full_name || an.emp_id) + ' พักเกินเกณฑ์ ' + an.overbreak_minutes + ' นาที'
      });
      AdminNotifState.seenItemIds.add(key);
    }
  });

  // Save seen IDs (cap at 100)
  var arr = Array.from(AdminNotifState.seenItemIds);
  if (arr.length > 100) arr = arr.slice(arr.length - 100);
  AdminNotifState.seenItemIds = new Set(arr);
  localStorage.setItem('ptn_admin_seen_items', JSON.stringify(arr));

  // If there are new incoming items and not first load: trigger alerts
  if (newItems.length > 0) {
    AdminNotifState.unreadCount += newItems.length;
    updateAdminNotifBadge();

    // Trigger Toast & Audio for first few items
    newItems.slice(0, 2).forEach(function(item) {
      showToast(item.title + ': ' + item.desc, item.type === 'anomaly' ? 'error' : 'success');
      triggerDesktopNotification(item.title, item.desc);
    });

    if (AdminNotifState.soundEnabled) {
      playAdminNotificationSound();
    }
  }

  renderAdminNotifList(data);
}

function updateAdminNotifBadge() {
  var badge = document.getElementById('adminNotifBadge');
  if (!badge) return;
  var total = (AdminNotifState.lastData && AdminNotifState.lastData.totalPending) || 0;
  var displayCount = AdminNotifState.unreadCount > 0 ? AdminNotifState.unreadCount : total;

  if (displayCount > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = displayCount > 99 ? '99+' : displayCount;
  } else {
    badge.style.display = 'none';
  }
}

function renderAdminNotifList(data) {
  var container = document.getElementById('adminNotifList');
  if (!container) return;

  var leaves = data.pendingLeaves || [];
  var ots = data.pendingOts || [];
  var advances = data.pendingAdvances || [];
  var anomalies = data.anomalies || [];

  var allItems = [];

  ots.forEach(function(ot) {
    allItems.push({
      type: 'ot',
      icon: 'fa-clock',
      iconCol: '#f59e0b',
      iconBg: '#fef3c7',
      title: 'คำขอ OT: ' + (ot.full_name || ot.emp_id),
      desc: 'ขอทำ OT ' + (ot.ot_hours || 0) + ' ชม. (' + (ot.ot_date || '-') + ')',
      actionTab: 'attendance',
      actionSection: 'ot'
    });
  });

  leaves.forEach(function(lv) {
    allItems.push({
      type: 'leave',
      icon: 'fa-umbrella-beach',
      iconCol: '#10b981',
      iconBg: '#ecfdf5',
      title: 'คำขอลางาน: ' + (lv.full_name || lv.emp_id),
      desc: 'ขอลางาน ' + (lv.days || 1) + ' วัน (' + (lv.start_date || '-') + ')',
      actionTab: 'attendance',
      actionSection: 'leave'
    });
  });

  advances.forEach(function(ad) {
    allItems.push({
      type: 'advance',
      icon: 'fa-money-bill-wave',
      iconCol: '#3b82f6',
      iconBg: '#eff6ff',
      title: 'ขอเบิกเงิน: ' + (ad.full_name || ad.emp_id),
      desc: 'ขอเบิกเงิน ฿' + Number(ad.amount || 0).toLocaleString() + ' วันที่ ' + (ad.request_date || '-'),
      actionTab: 'attendance',
      actionSection: 'advance'
    });
  });

  anomalies.forEach(function(an) {
    allItems.push({
      type: 'anomaly',
      icon: 'fa-triangle-exclamation',
      iconCol: '#ef4444',
      iconBg: '#fef2f2',
      title: 'พักเกินเวลา: ' + (an.full_name || an.emp_id),
      desc: 'เกินเกณฑ์ ' + an.overbreak_minutes + ' นาที (พัก ' + (an.break_out || '-') + ' ถึง ' + (an.break_in || '-') + ')',
      actionTab: 'attendance',
      actionSection: 'today'
    });
  });

  if (allItems.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:24px 12px;color:#94a3b8;font-size:12px">' +
      '<i class="fa-regular fa-bell-slash" style="font-size:24px;display:block;margin-bottom:6px"></i>' +
      'ไม่มีการแจ้งเตือนใหม่ในขณะนี้ ✨' +
      '</div>';
    return;
  }

  var html = '';
  allItems.forEach(function(item) {
    html += '<div onclick="handleAdminNotifClick(\'' + item.actionTab + '\')" style="display:flex;align-items:flex-start;gap:10px;padding:9px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer;transition:all 0.15s ease" onmouseover="this.style.background=\'#eff6ff\'" onmouseout="this.style.background=\'#f8fafc\'">' +
      '<div style="width:30px;height:30px;border-radius:8px;background:' + item.iconBg + ';color:' + item.iconCol + ';display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">' +
        '<i class="fa-solid ' + item.icon + '"></i>' +
      '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:700;font-size:12px;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(item.title) + '</div>' +
        '<div style="font-size:11px;color:#64748b;margin-top:1px;line-height:1.3">' + esc(item.desc) + '</div>' +
      '</div>' +
    '</div>';
  });

  container.innerHTML = html;
}

function handleAdminNotifClick(tabName) {
  var dropdown = document.getElementById('adminNotifDropdown');
  if (dropdown) dropdown.style.display = 'none';
  if (typeof switchTab === 'function') {
    switchTab(tabName);
  }
}

function clearAdminNotifications() {
  AdminNotifState.unreadCount = 0;
  updateAdminNotifBadge();
  var container = document.getElementById('adminNotifList');
  if (container) {
    container.innerHTML = '<div style="text-align:center;padding:24px 12px;color:#94a3b8;font-size:12px">' +
      '<i class="fa-regular fa-bell-slash" style="font-size:24px;display:block;margin-bottom:6px"></i>' +
      'ล้างการแจ้งเตือนแล้ว' +
      '</div>';
  }
}

function toggleSoundAlert() {
  AdminNotifState.soundEnabled = !AdminNotifState.soundEnabled;
  localStorage.setItem('ptn_admin_notif_sound', AdminNotifState.soundEnabled ? 'true' : 'false');
  updateSoundIcon();
  if (AdminNotifState.soundEnabled) {
    playAdminNotificationSound();
    showToast('เปิดเสียงแจ้งเตือนแล้ว', 'success');
  } else {
    showToast('ปิดเสียงแจ้งเตือนแล้ว', 'info');
  }
}

function updateSoundIcon() {
  var icon = document.getElementById('iconSoundToggle');
  if (!icon) return;
  if (AdminNotifState.soundEnabled) {
    icon.className = 'fa-solid fa-volume-high';
    icon.style.color = '#2563eb';
  } else {
    icon.className = 'fa-solid fa-volume-xmark';
    icon.style.color = '#94a3b8';
  }
}

function playAdminNotificationSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

// ==============================================================================
// WEB PUSH NOTIFICATION CLIENT CONTROLLER (VAPID + SERVICE WORKER)
// ==============================================================================
var _currentPushSubscription = null;

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function initServiceWorkerAndPush() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker is not supported by this browser');
    return;
  }

  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then(function(reg) {
      console.log('PTN Service Worker active:', reg.scope);
      checkPushSubscriptionStatus(reg);
    })
    .catch(function(err) {
      console.warn('Service Worker registration note:', err);
    });
}

function checkPushSubscriptionStatus(reg) {
  if (!reg || !reg.pushManager) return;
  reg.pushManager.getSubscription().then(function(sub) {
    _currentPushSubscription = sub;
    updatePushUiStatus(Boolean(sub));
  }).catch(function(e) {
    console.warn('getSubscription note:', e);
  });
}

function updatePushUiStatus(isSubscribed) {
  var btn = document.getElementById('btnToggleWebPush');
  var statusText = document.getElementById('webPushStatusText');
  if (btn) {
    if (isSubscribed) {
      btn.innerHTML = '<i class="fa-solid fa-bell-slash"></i> ปิดรับแจ้งเตือน (Web Push)';
      btn.className = 'btn btn-outline btn-sm';
      btn.style.borderColor = '#cbd5e1';
      btn.style.color = '#64748b';
    } else {
      btn.innerHTML = '<i class="fa-solid fa-bell"></i> เปิดรับแจ้งเตือนหน้าจอ (Web Push)';
      btn.className = 'btn btn-primary btn-sm';
      btn.style.borderColor = '';
      btn.style.color = '';
    }
  }
  if (statusText) {
    if (isSubscribed) {
      statusText.innerHTML = '<span style="color:#059669;font-weight:700"><i class="fa-solid fa-circle-check"></i> เปิดรับแจ้งเตือนแล้ว (เด้งเตือน Real-time 1-3 วิ)</span>';
    } else {
      statusText.innerHTML = '<span style="color:#64748b">⚪ ยังไม่ได้เปิดรับแจ้งเตือนบนอุปกรณ์นี้</span>';
    }
  }
}

function toggleWebPushSubscription() {
  if (_currentPushSubscription) {
    unsubscribeWebPush();
  } else {
    subscribeWebPush();
  }
}

function subscribeWebPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Web Push Notification\n(หากใช้ iPhone ต้องกด "เพิ่มไปยังหน้าจอโฮม / Add to Home Screen" ก่อน)');
    return;
  }

  showToast('กำลังขออนุญาตและลงทะเบียนรับการแจ้งเตือน...', 'info');

  callApi('getVapidPublicKey')
    .then(function(res) {
      if (!res || !res.publicKey) {
        throw new Error('ไม่สามารถดึง VAPID Public Key จากเซิร์ฟเวอร์ได้');
      }
      var vapidKey = res.publicKey;
      return navigator.serviceWorker.ready.then(function(reg) {
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      });
    })
    .then(function(sub) {
      _currentPushSubscription = sub;
      var subJson = sub.toJSON();
      var p256dh = (subJson.keys && subJson.keys.p256dh) || '';
      var auth = (subJson.keys && subJson.keys.auth) || '';
      var endpoint = sub.endpoint;

      return callApi('savePushSubscription', {
        empId: (State.currentUser && State.currentUser.empId) || (State.currentUser && State.currentUser.username) || 'ADMIN',
        endpoint: endpoint,
        p256dh: p256dh,
        auth: auth,
        userAgent: navigator.userAgent
      });
    })
    .then(function(saveRes) {
      updatePushUiStatus(true);
      showToast('เปิดรับการแจ้งเตือน Web Push สำเร็จ! พร้อมเด้งเตือนแบบ Real-time', 'success');
      // Trigger instant test notification
      sendTestWebPush();
    })
    .catch(function(err) {
      console.error('Subscription error:', err);
      showToast('ไม่สามารถเปิดการแจ้งเตือนได้: ' + err.message, 'error');
    });
}

function unsubscribeWebPush() {
  if (!_currentPushSubscription) return;
  var endpoint = _currentPushSubscription.endpoint;
  _currentPushSubscription.unsubscribe()
    .then(function() {
      _currentPushSubscription = null;
      updatePushUiStatus(false);
      return callApi('removePushSubscription', { endpoint: endpoint });
    })
    .then(function() {
      showToast('ยกเลิกการรับแจ้งเตือนบนอุปกรณ์นี้เรียบร้อยแล้ว', 'info');
    })
    .catch(function(err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    });
}

function sendTestWebPush() {
  showToast('กำลังส่งการแจ้งเตือนทดสอบ...', 'info');
  callApi('sendTestPushNotification', {
    endpoint: _currentPushSubscription ? _currentPushSubscription.endpoint : null,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
  .then(function(r) {
    if (r.success) {
      showToast(r.message || 'ส่งแจ้งเตือนสำเร็จ', 'success');
    } else {
      showToast(r.message || 'เกิดข้อผิดพลาด', 'warning');
    }
  })
  .catch(function(e) {
    showToast('Error: ' + e.message, 'error');
  });
}

function broadcastPayslipPushNotification(period) {
  if (!hasPermission('calc_payroll') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: สงวนสิทธิ์การส่งแจ้งเตือนเฉพาะผู้มีสิทธิ์คำนวณเงินเดือนหรือ Super Admin เท่านั้น', 'warning');
    return;
  }
  var targetPeriod = period || State.period || 'ล่าสุด';
  var msg = 'เงินเดือนงวด ' + targetPeriod + '  เช็กสลิปออนไลน์ได้ทันที';
  if (!confirm('ยืนยันส่งการแจ้งเตือน Web Push ไปยังพนักงานทุกคนใช่หรือไม่?\n\nข้อความที่จะส่ง:\n"บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด: ' + msg + '"')) {
    return;
  }

  showToast('กำลังส่งการแจ้งเตือนสลิปเงินเดือนไปยังอุปกรณ์พนักงานทุกคน...', 'info');
  callApi('broadcastPayslipNotification', {
    period: targetPeriod,
    title: 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด',
    body: msg,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
  .then(function(r) {
    if (r.success) {
      showToast(r.message, 'success');
    } else {
      showToast(r.message || 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน', 'error');
    }
  })
  .catch(function(e) {
    showToast('Error: ' + e.message, 'error');
  });
}

function requestAdminBrowserNotification() {
  toggleWebPushSubscription();
}

function triggerDesktopNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: 'https://cdn-icons-png.flaticon.com/512/2972/2972531.png'
      });
    } catch(e) {}
  }
}

function testAdminNotification() {
  sendTestWebPush();
}

// Auto-register Service Worker on startup
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', function() {
    initServiceWorkerAndPush();
  });
}

