/**
 * ==============================================================================
 * PTN Payroll - Core Module (State, Permissions, Utilities, Period & Data Loader)
 * ==============================================================================
 */

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
  'printing-analytics',
  'printing-emp-modal',
  'printing-emp-registry'
];

function clearAllPrintClasses() {
  ALL_PRINT_CLASSES.forEach(function(cls) {
    document.body.classList.remove(cls);
  });
  document.body.classList.remove('roster-orientation');
  document.body.classList.remove('profile-orientation');
  var payrollSumContainer = document.getElementById('payrollSummaryPrintContainer');
  if (payrollSumContainer) {
    payrollSumContainer.innerHTML = '';
  }
  var empRegContainer = document.getElementById('empRegistryPrintContainer');
  if (empRegContainer) {
    empRegContainer.innerHTML = '';
  }
  var orientStyle = document.getElementById('printPageOrientationStyle');
  if (orientStyle) {
    orientStyle.textContent = '';
  }
}

function preparePayrollSummaryPrintContainer() {
  var srcArea = document.getElementById('payrollSignoffPrintArea');
  var targetContainer = document.getElementById('payrollSummaryPrintContainer');
  if (srcArea && targetContainer) {
    targetContainer.innerHTML = '<div class="payroll-summary-print-wrapper" style="font-family:\'Sarabun\',sans-serif;color:#0f172a;background:#ffffff;">' + srcArea.innerHTML + '</div>';
  }
}

function prepareEmpRegistryPrintContainer() {
  var srcArea = document.getElementById('empPrintPaperContainer');
  var targetContainer = document.getElementById('empRegistryPrintContainer');
  if (srcArea && targetContainer) {
    targetContainer.innerHTML = srcArea.innerHTML;
  }
}

// Clean up print classes automatically when print dialog closes
window.addEventListener('afterprint', clearAllPrintClasses);

// Auto-detect active modal when user presses Ctrl+P or triggers browser print
window.addEventListener('beforeprint', function() {
  var salaryCertModal = document.getElementById('salaryCertModal');
  var payslipModal = document.getElementById('payslipModal');
  var twi50Modal = document.getElementById('twi50Modal');
  var payrollSignoffModal = document.getElementById('payrollSignoffModal');
  var printEmployeesModal = document.getElementById('printEmployeesModal');

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
    preparePayrollSummaryPrintContainer();
    document.body.classList.add('printing-payroll-summary');
  } else if (printEmployeesModal && printEmployeesModal.classList.contains('active')) {
    clearAllPrintClasses();
    prepareEmpRegistryPrintContainer();
    var orientStyle = document.getElementById('printPageOrientationStyle');
    if (!orientStyle) {
      orientStyle = document.createElement('style');
      orientStyle.id = 'printPageOrientationStyle';
      document.head.appendChild(orientStyle);
    }
    if (typeof _empPrintMode !== 'undefined' && _empPrintMode === 'roster') {
      orientStyle.textContent = '@page { size: A4 landscape !important; margin: 8mm 8mm !important; }';
    } else {
      orientStyle.textContent = '@page { size: A4 portrait !important; margin: 10mm 10mm !important; }';
    }
    document.body.classList.add('printing-emp-registry');
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

function canAccessTimeAttendanceModule() {
  if (isSuperAdmin()) return true;
  if (hasPermission('view_attendance') ||
      hasPermission('manage_time_logs') ||
      hasPermission('create_attendance_requests') ||
      hasPermission('approve_attendance') ||
      hasPermission('unlock_device') ||
      hasPermission('sync_ptn_time') ||
      hasPermission('manage_attendance_settings') ||
      hasPermission('toggle_early_dismissal')) {
    return true;
  }
  var perms = (State.currentUser && State.currentUser.permissions) || [];
  return perms.some(function(p) { return String(p).indexOf('toggle_early_dismissal:') === 0; });
}

function getDefaultAuthorizedAttendanceSubTab() {
  if (isSuperAdmin() || hasPermission('view_attendance')) return 'logs';
  if (hasPermission('approve_attendance') || hasPermission('create_attendance_requests')) return 'approvals';
  if (hasPermission('manage_attendance_settings')) return 'branches';
  return '';
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
  var canViewPayroll = hasPermission('view_payroll') ||
                       hasPermission('calc_payroll') ||
                       hasPermission('view_payslip') ||
                       hasPermission('close_period') ||
                       isSuperAdmin();
  var canViewInputs = hasPermission('view_inputs') ||
                      hasPermission('edit_inputs') ||
                      hasPermission('populate_inputs') ||
                      isSuperAdmin();
  var canViewEmp = hasPermission('view_emp') ||
                   hasPermission('edit_emp') ||
                   hasPermission('del_emp') ||
                   hasPermission('view_salary') ||
                   hasPermission('unlock_device') ||
                   isSuperAdmin();
  var canViewHistory = hasPermission('view_history') ||
                       hasPermission('print_history') ||
                       isSuperAdmin();
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
  var canViewAttendance = canAccessTimeAttendanceModule();
  var canViewAttendanceLogs = hasPermission('view_attendance') || isSuperAdmin();
  var canApproveAttendance = hasPermission('approve_attendance') || hasPermission('create_attendance_requests') || isSuperAdmin();
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
      else if (canManageCompany) switchTab('company');
      else if (canManageUsers) switchTab('users');
      else {
        // Fallback: user has no standard main tabs, switch to first visible tab
        var firstVisibleNav = document.querySelector('.nav-tab-btn:not([style*="display: none"])');
        if (firstVisibleNav && firstVisibleNav.id) {
          var targetTabName = firstVisibleNav.id.replace('navBtn-', '');
          switchTab(targetTabName);
        }
      }
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

  // Sub-tabs in Attendance Navigation
  var tabBtnLogs = document.getElementById('attSubTabBtn_logs');
  if (tabBtnLogs) tabBtnLogs.style.display = canViewAttendanceLogs ? 'inline-flex' : 'none';
  var tabBtnSummary = document.getElementById('attSubTabBtn_summary');
  if (tabBtnSummary) tabBtnSummary.style.display = canViewAttendanceLogs ? 'inline-flex' : 'none';
  var tabBtnApprovals = document.getElementById('attSubTabBtn_approvals');
  if (tabBtnApprovals) tabBtnApprovals.style.display = canApproveAttendance ? 'inline-flex' : 'none';
  var tabBtnBranches = document.getElementById('attSubTabBtn_branches');
  if (tabBtnBranches) tabBtnBranches.style.display = canManageAttendanceSettings ? 'inline-flex' : 'none';
  var tabBtnSettings = document.getElementById('attSubTabBtn_settings');
  if (tabBtnSettings) tabBtnSettings.style.display = canManageAttendanceSettings ? 'inline-flex' : 'none';

  // Fallback if currently viewing a restricted sub-tab
  var currentSubTabAllowed = true;
  if ((_activeAttendanceSubTab === 'logs' || _activeAttendanceSubTab === 'summary') && !canViewAttendanceLogs) {
    currentSubTabAllowed = false;
  } else if (_activeAttendanceSubTab === 'approvals' && !canApproveAttendance) {
    currentSubTabAllowed = false;
  } else if ((_activeAttendanceSubTab === 'branches' || _activeAttendanceSubTab === 'settings') && !canManageAttendanceSettings) {
    currentSubTabAllowed = false;
  }

  if (!currentSubTabAllowed) {
    var defTab = getDefaultAuthorizedAttendanceSubTab();
    if (defTab) {
      switchAttendanceSubTab(defTab);
    } else {
      ['logs', 'summary', 'approvals', 'settings', 'branches'].forEach(function(t) {
        var p = document.getElementById('attSubTabPane_' + t);
        if (p) p.style.display = 'none';
      });
    }
  }

  // Attendance Add Log Button
  var btnAddLog = document.getElementById('btnAddAttendanceLog');
  var canManageLogs = (hasPermission('manage_time_logs') || isSuperAdmin()) && canViewAttendanceLogs;
  if (btnAddLog) btnAddLog.style.display = canManageLogs ? 'inline-flex' : 'none';

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
  payrollBranchFilter: 'ALL',
  inputBranchFilter: 'ALL',
  payrollQuickFilter: 'ALL',
  inputQuickFilter: 'ALL',
  payrollViewMode: localStorage.getItem('ptn_payroll_view_mode') || 'TABLE',
  syncDeltaMap: {},
  filterOnlyChanged: false,
  payrollDefaults: {
    defaultOtRate: 40,
    defaultWorkDays: 30,
    absentFactor: 1.5,
    leaveFactor: 1.0,
    sickLeaveQuota: 10,
    defaultPfRate: 0.05,
    defaultProbationDays: 119,
    diligenceAllowance: 1000,
    diligenceLateGraceMins: 2,
    diligenceLateMaxCount: 1,
    autoDiligenceEnabled: true,
    countOverbreakAsLate: true,
    missingBreakPenaltyMode: 'ALERT_ONLY'
  },
  annualSickMap: {},
  companyHolidays: []
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

// API CLIENT (WITH AUTOMATIC RETRY FOR TRANSIENT SERVER/DATABASE LOCK ERRORS)
function callApi(action, payload, retryCount) {
  retryCount = retryCount || 0;
  if (typeof action === 'object' && action !== null) {
    payload = action;
    action = payload.action;
  }
  payload = payload || {};
  payload.action = action;
  payload.period = payload.period || State.period;
  var reqHeaders = { 'Content-Type': 'application/json' };
  if (State.currentUser && State.currentUser.token) {
    reqHeaders['Authorization'] = 'Bearer ' + State.currentUser.token;
    payload.token = State.currentUser.token;
  }

  return fetch(APP_CONFIG.getApiUrl(), {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(payload)
  })
  .then(function(res) {
    if (!res.ok) {
      if ((res.status === 502 || res.status === 503 || res.status === 504) && retryCount < 3) {
        var waitMs = 1000 * (retryCount + 1);
        return new Promise(function(resolve) { setTimeout(resolve, waitMs); })
          .then(function() {
            return callApi(action, payload, retryCount + 1);
          });
      }
      throw new Error('HTTP Error: ' + res.status);
    }
    return res.json();
  })
  .catch(function(err) {
    if (retryCount < 3 && err && err.message && (err.message.indexOf('Failed to fetch') !== -1 || err.message.indexOf('NetworkError') !== -1 || err.message.indexOf('503') !== -1 || err.message.indexOf('502') !== -1)) {
      var waitMs = 1000 * (retryCount + 1);
      return new Promise(function(resolve) { setTimeout(resolve, waitMs); })
        .then(function() {
          return callApi(action, payload, retryCount + 1);
        });
    }
    throw err;
  });
}


// PERIOD HELPER FUNCTIONS
function getNextPeriodStr(periodStr) {
  var months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  if (!periodStr || periodStr.indexOf(' ') < 0) return '';
  var parts = String(periodStr).trim().split(' ');
  var mIdx = months.indexOf(parts[0]);
  if (mIdx < 0) return '';
  var y = parseInt(parts[1], 10);
  if (isNaN(y)) return '';
  var nextMIdx = mIdx + 1;
  var nextY = y;
  if (nextMIdx >= 12) {
    nextMIdx = 0;
    nextY += 1;
  }
  return months[nextMIdx] + ' ' + nextY;
}

function getPreviousPeriodStr(periodStr) {
  var months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  if (!periodStr || periodStr.indexOf(' ') < 0) return '';
  var parts = String(periodStr).trim().split(' ');
  var mIdx = months.indexOf(parts[0]);
  if (mIdx < 0) return '';
  var y = parseInt(parts[1], 10);
  if (isNaN(y)) return '';
  var prevMIdx = mIdx - 1;
  var prevY = y;
  if (prevMIdx < 0) {
    prevMIdx = 11;
    prevY -= 1;
  }
  return months[prevMIdx] + ' ' + prevY;
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
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้แก้ไขจำนวนวันทำงาน กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
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
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้แก้ไขจำนวนวันทำงาน กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
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
      showToast('คำนวณวันทำงานจริงงวด ' + r.period + ' (จ.-ส. หักวันหยุด ' + (r.holidaysCount || 0) + ' วัน): ' + r.actualDays + ' วัน กำลังบันทึก...');
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

// ==========================================

// DATA LOADER & STATE SYNC
function loadAppData(isExplicitPeriodChange) {
  var payload = {};
  if (State.period) payload.period = State.period;
  if (isExplicitPeriodChange) payload.forcePeriod = true;
  return callApi('getAppInitialData', payload)
    .then(function(r) {
      if (!r.success) { showToast(r.message, 'error'); return; }

      // Smart Auto-Advance: If initial load (not an explicit selection in dropdown) and current period is CLOSED,
      // automatically advance to the next active working period so HR can immediately start work
      if (!isExplicitPeriodChange && r.isClosed) {
        var nextP = getNextPeriodStr(r.period);
        if (nextP && nextP !== r.period) {
          State.period = nextP;
          localStorage.setItem('ptn_last_period', State.period);
          return loadAppData(true);
        }
      }

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
      State.isMidPeriod = r.isMidPeriod || false;
      State.asOfDate = r.asOfDate || '';
      State.elapsedWorkDays = r.elapsedWorkDays || 0;
      State.periodCutoff = r.periodCutoff || null;
      var savedMode = localStorage.getItem('ptn_payroll_calc_mode');
      if (savedMode && (State.isClosed || !State.isMidPeriod)) {
        State.payrollCalcMode = 'FULL';
      } else if (savedMode) {
        State.payrollCalcMode = savedMode;
      } else {
        State.payrollCalcMode = State.isMidPeriod ? 'EARNED' : 'FULL';
      }
      State.company = r.settings || State.company;
      State.payrollDefaults = r.payrollDefaults || State.payrollDefaults;
      State.annualSickMap = r.annualSickMap || {};
      State.employees = r.employees || [];
      State.inputRecords = r.inputRecords || [];
      State.payrollList = r.payrollList || [];
      State.stats = r.stats || { totalEmployees: 0, totalGross: 0, totalDeductions: 0, totalNet: 0 };
      State.users = r.users || [];
      State.branches = r.branches || [];
      State.companyHolidays = r.companyHolidays || [];
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
  try { refreshAllEmployeeSelects(); } catch(e) { console.error('refreshAllEmployeeSelects error:', e); }
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
    var emp = State.employees.find(function(e) { return e.empId === r.empId; }) || {};
    var nick = (r.nickname || emp.nickname || getEmpNickname(r.empId) || '').toLowerCase();
    return (r.empId && r.empId.toLowerCase().indexOf(q) >= 0) ||
           (r.name && r.name.toLowerCase().indexOf(q) >= 0) ||
           (nick && nick.indexOf(q) >= 0) ||
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
    var emp = State.employees.find(function(e) { return e.empId === row.empId; }) || {};
    var empNick = row.nickname || emp.nickname || getEmpNickname(row.empId);
    var nickHtml = empNick ? (' <span style="font-size:11px;font-weight:700;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:1px 6px;border-radius:4px;white-space:nowrap;margin-left:4px">(' + esc(empNick) + ')</span>') : '';

    h += '<tr>' +
      '<td class="text-blue font-bold">' + esc(row.period) + '</td>' +
      '<td class="font-mono font-bold">' + esc(row.empId) + '</td>' +
      '<td class="font-bold">' + esc(row.name) + nickHtml + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(row.baseSalary) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' + (canViewSalary ? fmt(row.grossPay) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light">' + (canViewSalary ? fmt(row.totalDeductions || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-green bg-green-light">' +
        (canViewSalary ? (
          '<span class="text-green">' + fmt(row.netPay) + '</span>' +
          (Number(row.carriedDebt) > 0 ? '<div style="font-size:9.5px;font-weight:700;color:#dc2626"><i class="fa-solid fa-triangle-exclamation"></i> หนี้ ' + fmt(row.carriedDebt) + '</div>' : '')
        ) : '฿***') +
      '</td>' +
      '<td class="text-center">' + (canViewSalary ? '<button type="button" class="btn btn-slate btn-sm" onclick="viewPayslip(\'' + esc(row.empId) + '\')"><i class="fa-solid fa-file-invoice"></i> สลิป</button>' : '<span class="text-muted" style="font-size:11px">-</span>') + '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
}

// ==============================================================================
