/**
 * ==============================================================================
 * PTN Payroll System V4.0 - Clean Enterprise Client Application (Bootstrap)
 * บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด
 * ==============================================================================
 */

// ACTIONS & MODAL CONTROLLERS
function switchTab(tabId) {
  if (!tabId) return;
  tabId = String(tabId).replace(/^tab-/, '');
  var role = (State.currentUser && State.currentUser.role) ? String(State.currentUser.role).trim() : 'User';
  var isGeneralUser = (role.toLowerCase() === 'user');

  // If General User with no other permissions, force tab to employees only
  var hasOtherPerms = (State.currentUser && State.currentUser.permissions && State.currentUser.permissions.length > 1);
  if (isGeneralUser && !hasOtherPerms && tabId !== 'employees') {
    tabId = 'employees';
  }

  // Dashboard tab
  if (tabId === 'dashboard' && !hasPermission('view_dash')) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานแดชบอร์ดสรุปยอดเงินเดือน', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Payroll tab
  var canAccessPayroll = hasPermission('view_payroll') || hasPermission('calc_payroll') || hasPermission('view_payslip') || hasPermission('close_period') || isSuperAdmin();
  if (tabId === 'payroll' && !canAccessPayroll) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานระบบคำนวณเงินเดือน', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Input tab
  var canAccessInputs = hasPermission('view_inputs') || hasPermission('edit_inputs') || hasPermission('populate_inputs') || isSuperAdmin();
  if (tabId === 'input' && !canAccessInputs) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานบันทึกข้อมูลประจำงวด', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Attendance tab
  var canAccessAttendance = canAccessTimeAttendanceModule();
  if (tabId === 'attendance' && !canAccessAttendance) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานระบบลงเวลา', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // Employees tab
  var canAccessEmp = hasPermission('view_emp') || hasPermission('edit_emp') || hasPermission('del_emp') || hasPermission('view_salary') || hasPermission('unlock_device') || isSuperAdmin();
  if (tabId === 'employees' && !canAccessEmp) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานทะเบียนพนักงาน', 'warning');
    navigateToAuthorizedTab();
    return;
  }

  // History tab
  var canAccessHistory = hasPermission('view_history') || hasPermission('print_history') || isSuperAdmin();
  if (tabId === 'history' && !canAccessHistory) {
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
    if (!isSuperAdmin() && !hasPermission('view_attendance')) {
      var defSubTab = getDefaultAuthorizedAttendanceSubTab();
      if (defSubTab) {
        switchAttendanceSubTab(defSubTab);
      } else {
        ['logs', 'summary', 'approvals', 'settings', 'branches'].forEach(function(t) {
          var p = document.getElementById('attSubTabPane_' + t);
          if (p) p.style.display = 'none';
        });
      }
      renderBranchEarlyDismissalBar();
    } else {
      loadTimeAttendanceDashboard();
    }
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


// Global Keyboard Shortcuts & Backdrop Click Dismissals
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var modals = document.querySelectorAll('.modal-overlay.active, .modal.active');
    modals.forEach(function(m) {
      m.classList.remove('active');
    });
    if (typeof closeInspector === 'function') closeInspector();
    if (typeof closeInputFastEditDrawer === 'function') closeInputFastEditDrawer();
  }
});

// App Startup Bootstrap
document.addEventListener('DOMContentLoaded', function() {
  console.log('PTN Payroll Client Modular Bootstrap Initialized');
  if (typeof checkAuth === 'function') {
    checkAuth();
  }
});
