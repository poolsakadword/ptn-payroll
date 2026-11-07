/**
 * ==============================================================================
 * PTN Payroll - Auth & User Management Module
 * ==============================================================================
 */

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

  var canAccessAttendance = canAccessTimeAttendanceModule();

  var canAccessPayroll = hasPermission('view_payroll') || hasPermission('calc_payroll') || hasPermission('view_payslip') || hasPermission('close_period') || isSuperAdmin();
  var canAccessInputs = hasPermission('view_inputs') || hasPermission('edit_inputs') || hasPermission('populate_inputs') || isSuperAdmin();
  var canAccessEmp = hasPermission('view_emp') || hasPermission('edit_emp') || hasPermission('del_emp') || hasPermission('view_salary') || hasPermission('unlock_device') || isSuperAdmin();
  var canAccessHistory = hasPermission('view_history') || hasPermission('print_history') || isSuperAdmin();

  // If on a forbidden tab or first login, switch to primary allowed tab
  var isAllowed = false;
  if (curId === 'tab-dashboard' && hasPermission('view_dash')) isAllowed = true;
  else if (curId === 'tab-attendance' && canAccessAttendance) isAllowed = true;
  else if (curId === 'tab-payroll' && canAccessPayroll) isAllowed = true;
  else if (curId === 'tab-input' && canAccessInputs) isAllowed = true;
  else if (curId === 'tab-employees' && canAccessEmp) isAllowed = true;
  else if (curId === 'tab-history' && canAccessHistory) isAllowed = true;
  else if (curId === 'tab-analytics' && (hasPermission('view_analytics') || isSuperAdmin())) isAllowed = true;
  else if (curId === 'tab-documents' && (isSuperAdmin() || hasPermission('view_documents') || hasPermission('all'))) isAllowed = true;
  else if (curId === 'tab-company' && (hasPermission('manage_company') || hasPermission('manage_backup') || isSuperAdmin())) isAllowed = true;
  else if (curId === 'tab-users' && (hasPermission('manage_users') || isSuperAdmin())) isAllowed = true;

  if (!isAllowed) {
    if (hasPermission('view_dash')) switchTab('dashboard');
    else if (canAccessAttendance) switchTab('attendance');
    else if (canAccessEmp) switchTab('employees');
    else if (canAccessInputs) switchTab('input');
    else if (canAccessPayroll) switchTab('payroll');
    else if (canAccessHistory) switchTab('history');
    else if (hasPermission('view_analytics')) switchTab('analytics');
    else if (hasPermission('view_documents')) switchTab('documents');
    else if (hasPermission('manage_company')) switchTab('company');
    else if (hasPermission('manage_users')) switchTab('users');
    else {
      var firstVisibleNav = document.querySelector('.nav-tab-btn:not([style*="display: none"])');
      if (firstVisibleNav && firstVisibleNav.id) {
        var targetTabName = firstVisibleNav.id.replace('navBtn-', '');
        switchTab(targetTabName);
      }
    }
  }
}

function checkAuth() {
  var savedUser = localStorage.getItem('ptn_user') || sessionStorage.getItem('ptn_user');
  if (savedUser) {
    try {
      State.currentUser = JSON.parse(savedUser);
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appShell').classList.add('active');
      try { applyRolePermissions(); } catch(err) { console.error('applyRolePermissions error:', err); }
      try { navigateToAuthorizedTab(); } catch(err) { console.error('navigateToAuthorizedTab error:', err); }
      try { loadAppData(); } catch(err) { console.error('loadAppData error:', err); }
    } catch(e) {
      console.warn('Invalid saved auth token, logging out:', e);
      handleLogout();
    }
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appShell').classList.remove('active');
  }
}

function handleLogin(e) {
  if (e) e.preventDefault();
  var u = (document.getElementById('loginUsername') ? document.getElementById('loginUsername').value : '').trim();
  var p = (document.getElementById('loginPassword') ? document.getElementById('loginPassword').value : '').trim();
  if (!u || !p) { showToast('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'error'); return; }

  var btn = document.getElementById('btnLoginSubmit') || (e && e.target ? e.target.querySelector('button[type="submit"]') : null);
  var origBtnHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...';
  }

  callApi('checkLogin', { username: u, password: p })
    .then(function(r) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
      }
      if (r && r.success) {
        State.currentUser = {
          username: r.username,
          role: r.role,
          permissions: r.permissions || [],
          token: r.token || ''
        };
        localStorage.setItem('ptn_user', JSON.stringify(State.currentUser));
        sessionStorage.setItem('ptn_user', JSON.stringify(State.currentUser));
        showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ ' + r.username);

        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appShell').classList.add('active');
        try { applyRolePermissions(); } catch(err) { console.error('applyRolePermissions error:', err); }
        try { navigateToAuthorizedTab(); } catch(err) { console.error('navigateToAuthorizedTab error:', err); }
        try { loadAppData(); } catch(err) { console.error('loadAppData error:', err); }
      } else {
        var msg = (r && r.message) ? r.message : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        showToast(msg, 'error');
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: 'error',
            title: 'เข้าสู่ระบบไม่สำเร็จ',
            text: msg,
            confirmButtonColor: '#e11d48'
          });
        }
      }
    })
    .catch(function(err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
      }
      var errMsg = err ? (err.message || String(err)) : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
      showToast('ไม่สามารถเชื่อมต่อฐานข้อมูลได้: ' + errMsg, 'error');
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'ข้อผิดพลาดในการเชื่อมต่อ',
          text: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้: ' + errMsg,
          confirmButtonColor: '#e11d48'
        });
      }
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
    'perm_view_attendance', 'perm_manage_time_logs', 'perm_create_attendance_requests', 'perm_approve_attendance', 'perm_unlock_device', 'perm_sync_ptn_time', 'perm_toggle_early_dismissal', 'perm_manage_attendance_settings',
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
    var supPerms = ['perm_view_emp', 'perm_view_attendance', 'perm_manage_time_logs', 'perm_create_attendance_requests', 'perm_approve_attendance', 'perm_unlock_device', 'perm_toggle_early_dismissal'];
    allPerms.forEach(function(p) {
      var el = document.getElementById(p);
      if (el) el.checked = (supPerms.indexOf(p) >= 0);
    });
  } else if (role === 'HR Payroll') {
    var hrPerms = [
      'perm_view_emp', 'perm_view_salary', 'perm_edit_emp',
      'perm_view_inputs', 'perm_edit_inputs', 'perm_populate_inputs',
      'perm_view_payroll', 'perm_calc_payroll', 'perm_view_payslip',
      'perm_view_attendance', 'perm_manage_time_logs', 'perm_create_attendance_requests', 'perm_sync_ptn_time',
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
      'perm_view_attendance', 'perm_manage_time_logs', 'perm_create_attendance_requests', 'perm_approve_attendance', 'perm_unlock_device', 'perm_sync_ptn_time', 'perm_toggle_early_dismissal',
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
  var elEarly = document.getElementById('perm_toggle_early_dismissal');
  if (elEarly) onToggleEarlyDismissalPermChange(elEarly.checked);
}

function attachPermissionCheckboxListeners() {
  var permInputs = document.querySelectorAll('#userModal input[id^="perm_"]');
  permInputs.forEach(function(input) {
    input.onchange = function() {
      var roleSel = document.getElementById('mRole');
      if (roleSel && roleSel.value !== 'Custom') {
        roleSel.value = 'Custom';
      }
      if (input.id === 'perm_toggle_early_dismissal') {
        onToggleEarlyDismissalPermChange(input.checked);
      }
    };
  });
}

function onToggleEarlyDismissalPermChange(checked) {
  var sublist = document.getElementById('earlyDismissalBranchSublist');
  if (sublist) sublist.style.display = checked ? 'block' : 'none';
  if (checked) {
    var items = document.querySelectorAll('.perm-early-branch-item');
    if (items.length === 0) renderEarlyDismissalBranchCheckboxes(['toggle_early_dismissal']);
  }
}

function renderEarlyDismissalBranchCheckboxes(userPerms) {
  var container = document.getElementById('earlyDismissalBranchCheckboxes');
  if (!container) return;
  var branches = (State.branches && State.branches.length > 0) ? State.branches : [
    { branch_id: 'B01', branch_name: 'สำนักงานใหญ่' },
    { branch_id: 'B02', branch_name: 'พัฒนาเภสัช' },
    { branch_id: 'B03', branch_name: 'พัฒนาชุมชน' }
  ];
  var isAll = !userPerms || userPerms.indexOf('all') >= 0 || userPerms.indexOf('toggle_early_dismissal') >= 0;

  var html = '<label style="display:inline-flex;align-items:center;gap:4px;font-weight:700;color:#581c87;cursor:pointer">' +
    '<input type="checkbox" id="perm_early_branch_all" ' + (isAll ? 'checked' : '') + ' onchange="onToggleEarlyBranchAll(this.checked)"> ทุกสาขา' +
  '</label>';

  branches.forEach(function(b) {
    var hasBranch = isAll || (userPerms && userPerms.indexOf('toggle_early_dismissal:' + b.branch_id) >= 0);
    html += '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;color:#334155">' +
      '<input type="checkbox" class="perm-early-branch-item" data-branch="' + esc(b.branch_id) + '" ' + (hasBranch ? 'checked' : '') + ' onchange="onToggleEarlyBranchItem()">' +
      esc(b.branch_name || b.branch_id) +
    '</label>';
  });
  container.innerHTML = html;
}

function onToggleEarlyBranchAll(isChecked) {
  var items = document.querySelectorAll('.perm-early-branch-item');
  items.forEach(function(el) { el.checked = isChecked; });
}

function onToggleEarlyBranchItem() {
  var allCheck = document.getElementById('perm_early_branch_all');
  var items = document.querySelectorAll('.perm-early-branch-item');
  var allChecked = true;
  items.forEach(function(el) { if (!el.checked) allChecked = false; });
  if (allCheck) allCheck.checked = allChecked;
}

function canToggleBranchEarlyDismissal(branchId) {
  if (isSuperAdmin() || hasPermission('manage_attendance_settings') || hasPermission('toggle_early_dismissal')) return true;
  var perms = (State.currentUser && State.currentUser.permissions) || [];
  return perms.indexOf('toggle_early_dismissal:' + branchId) >= 0;
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
  attachPermissionCheckboxListeners();
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
    'perm_manage_time_logs': ['manage_time_logs'],
    'perm_create_attendance_requests': ['create_attendance_requests'],
    'perm_approve_attendance': ['approve_attendance'],
    'perm_unlock_device': ['unlock_device'],
    'perm_sync_ptn_time': ['sync_ptn_time'],
    'perm_toggle_early_dismissal': ['toggle_early_dismissal'],
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

  var hasEarlyPerm = isAll || perms.some(function(k) { return k === 'toggle_early_dismissal' || String(k).indexOf('toggle_early_dismissal:') === 0; });
  var elEarly = document.getElementById('perm_toggle_early_dismissal');
  if (elEarly) elEarly.checked = hasEarlyPerm;
  var sublistEarly = document.getElementById('earlyDismissalBranchSublist');
  if (sublistEarly) sublistEarly.style.display = hasEarlyPerm ? 'block' : 'none';
  renderEarlyDismissalBranchCheckboxes(isAll ? ['toggle_early_dismissal'] : perms);

  attachPermissionCheckboxListeners();
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
      { id: 'perm_manage_time_logs', key: 'manage_time_logs' },
      { id: 'perm_create_attendance_requests', key: 'create_attendance_requests' },
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

    if (document.getElementById('perm_toggle_early_dismissal') && document.getElementById('perm_toggle_early_dismissal').checked) {
      var allCheck = document.getElementById('perm_early_branch_all');
      if (allCheck && allCheck.checked) {
        perms.push('toggle_early_dismissal');
      } else {
        var branchItems = document.querySelectorAll('.perm-early-branch-item:checked');
        if (branchItems.length === 0) {
          perms.push('toggle_early_dismissal');
        } else {
          branchItems.forEach(function(item) {
            perms.push('toggle_early_dismissal:' + item.getAttribute('data-branch'));
          });
        }
      }
    }
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
