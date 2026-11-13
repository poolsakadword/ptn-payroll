/**
 * ==============================================================================
 * PTN Payroll - Employee Master, Profile & Registry Module
 * ==============================================================================
 */

window._empPhotoCache = window._empPhotoCache || {};
window._empPhotoPending = window._empPhotoPending || {};
window._empPhotoExplicitlyRemoved = false;

function buildEmployeeAvatarImgHtml(photoUrl, empName, size, isCard) {
  var s = Number(size) || 28;
  var radius = isCard ? '12px' : '50%';
  var initials = (empName || '').substring(0, 2);
  if (isCard) {
    return '<img src="' + esc(photoUrl) + '" alt="' + esc(empName) + '" style="width:' + s + 'px;height:' + s + 'px;border-radius:' + radius + ';object-fit:cover;flex-shrink:0;border:1.5px solid #cbd5e1;box-shadow:0 2px 4px rgba(0,0,0,0.1);background:#f1f5f9" onerror="this.onerror=null;this.outerHTML=\'<div style=\\\'width:' + s + 'px;height:' + s + 'px;border-radius:' + radius + ';background:linear-gradient(135deg, #2563eb, #4f46e5);color:#ffffff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 6px -1px rgba(37,99,235,0.25)\\\'>' + esc(initials) + '</div>\'">';
  }
  return '<img src="' + esc(photoUrl) + '" alt="' + esc(empName) + '" style="width:' + s + 'px;height:' + s + 'px;border-radius:' + radius + ';object-fit:cover;flex-shrink:0;border:1px solid #cbd5e1;background:#f1f5f9" onerror="this.onerror=null;this.outerHTML=\'<div style=\\\'width:' + s + 'px;height:' + s + 'px;border-radius:' + radius + ';background:#e0e7ff;color:#3730a3;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0\\\'>' + esc(initials) + '</div>\'">';
}

function applyEmployeePhotoToDom(empId, photoUrl) {
  if (!empId || !photoUrl) return;
  var nodes = document.querySelectorAll('[data-emp-avatar-box="' + empId + '"]');
  nodes.forEach(function(box) {
    var empName = box.getAttribute('data-emp-name') || empId;
    var size = Number(box.getAttribute('data-emp-size')) || 28;
    var isCard = box.getAttribute('data-emp-card') === '1';
    box.outerHTML = buildEmployeeAvatarImgHtml(photoUrl, empName, size, isCard);
  });
}

function ensureEmployeePhotosLoaded(empIds, callback) {
  var list = Array.isArray(empIds) ? empIds : [];
  var missingIds = [];
  var empMap = {};
  (State.employees || []).forEach(function(e) {
    if (e.empId) empMap[e.empId] = e;
  });

  list.forEach(function(id) {
    if (!id) return;
    var emp = empMap[id];
    var cached = window._empPhotoCache[id];
    if (cached) {
      if (emp && !emp.photoUrl) emp.photoUrl = cached;
      applyEmployeePhotoToDom(id, cached);
      return;
    }
    if (emp && emp.photoUrl) {
      window._empPhotoCache[id] = emp.photoUrl;
      applyEmployeePhotoToDom(id, emp.photoUrl);
      return;
    }
    if (emp && emp.hasPhoto && !window._empPhotoPending[id]) {
      window._empPhotoPending[id] = true;
      missingIds.push(id);
    }
  });

  if (missingIds.length === 0) {
    if (typeof callback === 'function') callback();
    return;
  }

  var chunk = missingIds.slice(0, 80);
  callApi('getEmployeePhotos', { empIds: chunk })
    .then(function(r) {
      var photos = (r && r.success && r.photos) ? r.photos : {};
      chunk.forEach(function(id) {
        delete window._empPhotoPending[id];
        if (photos[id]) {
          window._empPhotoCache[id] = photos[id];
          if (empMap[id]) empMap[id].photoUrl = photos[id];
          applyEmployeePhotoToDom(id, photos[id]);
        }
      });
      if (typeof callback === 'function') callback();
    })
    .catch(function() {
      chunk.forEach(function(id) { delete window._empPhotoPending[id]; });
      if (typeof callback === 'function') callback();
    });
}

// RENDER RESIGNED EMPLOYEES ARCHIVE TABLE
function renderResignedEmployeesTable() {
  var tbody = document.getElementById('resignedEmployeesTableBody');
  if (!tbody) return;

  var canEditEmp = hasPermission('edit_emp') || isSuperAdmin();
  var canDelEmp = hasPermission('del_emp') || isSuperAdmin();

  var emps = (State.employees || []).filter(function(e) {
    return (e.status || '') === 'Resigned';
  });

  // Update badge & header counter
  if (document.getElementById('resignedListCountDisplay')) {
    document.getElementById('resignedListCountDisplay').textContent = emps.length;
  }
  if (document.getElementById('subtabBadgeResignedCount')) {
    document.getElementById('subtabBadgeResignedCount').textContent = emps.length;
  }

  // Populate department filter dropdown for resigned
  var rDeptSel = document.getElementById('resignedDeptFilter');
  if (rDeptSel && (!rDeptSel.options || rDeptSel.options.length <= 1)) {
    var curVal = rDeptSel.value;
    var dSet = {};
    emps.forEach(function(e) { if (e.department) dSet[e.department] = true; });
    var dOpts = '<option value="">ทุกแผนก</option>';
    Object.keys(dSet).sort().forEach(function(d) {
      dOpts += '<option value="' + esc(d) + '">' + esc(d) + '</option>';
    });
    rDeptSel.innerHTML = dOpts;
    rDeptSel.value = curVal;
  }

  var q = (document.getElementById('resignedSearchInput') ? document.getElementById('resignedSearchInput').value : '').trim().toLowerCase();
  var selectedDept = rDeptSel ? rDeptSel.value : '';

  var list = emps.filter(function(e) {
    if (selectedDept && e.department !== selectedDept) return false;
    if (!q) return true;
    return (e.empId && e.empId.toLowerCase().indexOf(q) >= 0) ||
           (e.fullName && e.fullName.toLowerCase().indexOf(q) >= 0) ||
           (e.nickname && e.nickname.toLowerCase().indexOf(q) >= 0) ||
           (e.phone && e.phone.toLowerCase().indexOf(q) >= 0) ||
           (e.department && e.department.toLowerCase().indexOf(q) >= 0) ||
           (e.position && e.position.toLowerCase().indexOf(q) >= 0) ||
           (e.remark && e.remark.toLowerCase().indexOf(q) >= 0);
  });

  // Sort by resignDate descending (most recently resigned first)
  list.sort(function(a, b) {
    var da = a.resignDate || a.updatedAt || '';
    var db = b.resignDate || b.updatedAt || '';
    return db.localeCompare(da);
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:36px"><i class="fa-solid fa-folder-open" style="font-size:24px;margin-bottom:8px;display:block;color:#94a3b8"></i>' + (q ? 'ไม่พบพนักงานพ้นสภาพที่ตรงกับคำค้นหา "' + esc(q) + '"' : 'ไม่มีรายชื่อพนักงานพ้นสภาพหรือลาออกในระบบ') + '</td></tr>';
    return;
  }

  var html = '';
  list.forEach(function(e) {
    var initials = (e.fullName || '').substring(0, 2);
    var resolvedPhoto = e.photoUrl || window._empPhotoCache[e.empId] || '';
    var avatarHtml = resolvedPhoto
      ? ('<img src="' + esc(resolvedPhoto) + '" alt="' + esc(e.fullName) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid #cbd5e1;background:#f1f5f9" onerror="this.onerror=null;this.outerHTML=\'<div style=\\\'width:32px;height:32px;border-radius:50%;background:#fee2e2;color:#991b1b;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0\\\'>' + esc(initials) + '</div>\'">')
      : ('<div data-emp-avatar-box="' + esc(e.empId) + '" data-emp-name="' + esc(e.fullName) + '" data-emp-size="32" style="width:32px;height:32px;border-radius:50%;background:#fee2e2;color:#991b1b;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + esc(initials) + '</div>');

    var branchObj = (State.branches || []).find(function(b) { return b.branch_id === e.branchId; });
    var branchNameDisplay = branchObj ? branchObj.branch_name : (e.branchId === 'B02' ? 'สาขา 2' : (e.branchId === 'B03' ? 'สาขา 3' : (e.branchId === 'B04' ? 'สาขา 4' : 'สำนักงานใหญ่')));

    var tenureStr = calculateTenureString(e.joinDate, e.resignDate);
    var joinDateDisplay = e.joinDate ? formatDateThaiBE(e.joinDate) : '-';
    var resignDateDisplay = e.resignDate ? formatDateThaiBE(e.resignDate) : '<span style="color:#dc2626;font-style:italic">ไม่ระบุ</span>';

    html += '<tr style="background:#fff">' +
      '<td class="font-mono font-bold" style="color:#64748b">' + esc(e.empId) + '</td>' +
      '<td>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          avatarHtml +
          '<div>' +
            '<div style="font-weight:700;color:var(--text-main)">' + esc(e.fullName) + ' ' + (e.nickname ? ('<span class="period-pill" style="background:#f1f5f9;color:#64748b;font-size:10px;padding:1px 6px">' + esc(e.nickname) + '</span>') : '') + (e.isConfidential ? ' <span class="period-pill" style="background:#fef3c7;color:#92400e;border-color:#fde68a;font-size:10px;padding:1px 6px;font-weight:700" title="พนักงานกลุ่มความลับ"><i class="fa-solid fa-lock"></i> ความลับ</span>' : '') + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);font-family:monospace">' + esc(e.phone || '-') + '</div>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td>' +
        '<span class="period-pill" style="background:#f1f5f9;color:#475569">' + esc(e.department || '-') + '</span>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + esc(e.position || '-') + '</div>' +
        '<div style="font-size:10.5px;color:#64748b;margin-top:2px"><i class="fa-solid fa-store" style="font-size:9.5px;margin-right:2px"></i> ' + esc(branchNameDisplay) + '</div>' +
      '</td>' +
      '<td>' +
        '<div style="font-size:11.5px;color:#15803d"><i class="fa-solid fa-calendar-check" style="width:14px"></i> เริ่ม: ' + joinDateDisplay + '</div>' +
        '<div style="font-size:11.5px;color:#b91c1c;font-weight:700;margin-top:2px"><i class="fa-solid fa-person-walking-arrow-right" style="width:14px"></i> ออก: ' + resignDateDisplay + '</div>' +
      '</td>' +
      '<td>' +
        '<span class="period-pill" style="background:#fef3c7;color:#92400e;border-color:#fde68a;font-weight:700;font-size:11px">' +
          '<i class="fa-solid fa-hourglass-half" style="margin-right:3px"></i> ' + esc(tenureStr) +
        '</span>' +
      '</td>' +
      '<td>' +
        '<div style="font-size:11.5px;color:var(--text-main);max-width:220px;line-height:1.4">' + esc(e.remark || '-') + '</div>' +
      '</td>' +
      '<td class="text-center nowrap">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:4px">' +
          (canEditEmp ? '<button type="button" class="btn btn-sm btn-success" style="background:#059669;border-color:#059669;color:#fff;font-size:11px;padding:4px 8px;font-weight:700" onclick="openRehireModal(\'' + esc(e.empId) + '\')" title="รับพนักงานกลับเข้าทำงาน"><i class="fa-solid fa-user-plus"></i> รับกลับ</button> ' : '') +
          '<button type="button" class="btn btn-sm btn-slate" style="font-size:11px;padding:4px 8px;font-weight:600" onclick="openCertForEmployee(\'' + esc(e.empId) + '\')" title="ออกหนังสือรับรองงาน (A4)"><i class="fa-solid fa-file-signature text-blue"></i> ใบรับรอง</button> ' +
          (canEditEmp ? '<button type="button" class="btn-icon edit" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')" title="ดูหรือแก้ไขข้อมูล"><i class="fa-solid fa-pen"></i></button> ' : '') +
          (canDelEmp ? '<button type="button" class="btn-icon del" onclick="deleteEmployee(\'' + esc(e.empId) + '\')" title="ลบข้อมูลถาวร"><i class="fa-solid fa-trash"></i></button>' : '') +
        '</div>' +
      '</td>' +
    '</tr>';
  });

  tbody.innerHTML = html;
  ensureEmployeePhotosLoaded(list.map(function(x) { return x.empId; }));
}

// SHORTCUT TO CERTIFICATE MODAL FOR RESIGNED EMPLOYEE
function openCertForEmployee(empId) {
  openSalaryCertificateModal(empId);
}

// REHIRE EMPLOYEE MODAL CONTROLLERS
function openRehireModal(empId) {
  var emp = (State.employees || []).find(function(e) { return e.empId === empId; });
  if (!emp) {
    showToast('ไม่พบข้อมูลพนักงาน', 'error');
    return;
  }
  var idInput = document.getElementById('rehireEmpId');
  if (idInput) idInput.value = emp.empId;

  var nameEl = document.getElementById('rehireEmpName');
  if (nameEl) nameEl.textContent = (emp.fullName || emp.empId) + (emp.nickname ? (' (' + emp.nickname + ')') : '');

  var detailEl = document.getElementById('rehireEmpDetail');
  if (detailEl) detailEl.textContent = 'รหัส: ' + emp.empId + ' | แผนก: ' + (emp.department || '-') + ' | ตำแหน่ง: ' + (emp.position || '-');

  var avEl = document.getElementById('rehireAvatarContainer');
  if (avEl) {
    var rehirePhoto = emp.photoUrl || window._empPhotoCache[emp.empId] || '';
    if (rehirePhoto) {
      avEl.innerHTML = '<img src="' + esc(rehirePhoto) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
    } else {
      avEl.textContent = (emp.fullName || emp.empId).substring(0, 2);
      if (emp.hasPhoto) {
        ensureEmployeePhotosLoaded([empId], function() {
          var loadedPhoto = emp.photoUrl || window._empPhotoCache[empId] || '';
          if (loadedPhoto && document.getElementById('rehireEmpId') && document.getElementById('rehireEmpId').value === empId) {
            avEl.innerHTML = '<img src="' + esc(loadedPhoto) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
          }
        });
      }
    }
  }

  var todayStr = new Date().toISOString().substring(0, 10);
  var joinDateInput = document.getElementById('rehireJoinDate');
  if (joinDateInput) {
    joinDateInput.value = todayStr;
    updateRehireJoinDateHint();
  }

  var statusSel = document.getElementById('rehireStatus');
  if (statusSel) statusSel.value = 'Active';
  onRehireStatusChanged();

  var salInput = document.getElementById('rehireBaseSalary');
  if (salInput) salInput.value = emp.baseSalary || 0;

  var remarkInput = document.getElementById('rehireRemark');
  if (remarkInput) remarkInput.value = 'รับกลับเข้าทำงาน';

  openModal('rehireModal');
}

function updateRehireJoinDateHint() {
  var input = document.getElementById('rehireJoinDate');
  var hint = document.getElementById('rehireJoinDateHint');
  if (input && hint && input.value) {
    hint.textContent = 'วันเริ่มงานรอบใหม่: ' + formatDateThaiBE(input.value);
  }
}

function onRehireStatusChanged() {
  var statusSel = document.getElementById('rehireStatus');
  var probSec = document.getElementById('rehireProbationSection');
  if (statusSel && probSec) {
    probSec.style.display = (statusSel.value === 'Probation') ? 'block' : 'none';
  }
}

function submitRehireEmployeeForm(event) {
  if (event) event.preventDefault();
  var empId = document.getElementById('rehireEmpId').value;
  var joinDate = document.getElementById('rehireJoinDate').value;
  var status = document.getElementById('rehireStatus').value;
  var probationDays = document.getElementById('rehireProbationDays') ? Number(document.getElementById('rehireProbationDays').value) : 119;
  var baseSalary = Number(document.getElementById('rehireBaseSalary').value) || 0;
  var remark = document.getElementById('rehireRemark') ? document.getElementById('rehireRemark').value : '';

  if (!empId || !joinDate) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
    return;
  }

  var statusLabel = (status === 'Active') ? 'พนักงานประจำ' : 'ช่วงทดลองงาน (' + probationDays + ' วัน)';
  showConfirmDialog(
    'ยืนยันการรับพนักงานกลับเข้าทำงาน',
    'คุณต้องการรับพนักงานรหัส <strong>' + esc(empId) + '</strong> กลับเข้าทำงานในสถานะ <strong>' + statusLabel + '</strong> หรือไม่?<br><span style="color:#64748b;font-size:12px">ระบบจะล้างประวัติวันที่ลาออกเดิม และนำชื่อพนักงานกลับเข้าสู่รายชื่อพนักงานปัจจุบันทันที</span>',
    function() {
      callApi('rehireEmployee', {
        empId: empId,
        joinDate: joinDate,
        status: status,
        probationDays: probationDays,
        baseSalary: baseSalary,
        remark: remark,
        username: State.currentUser ? State.currentUser.username : 'Admin'
      }).then(function(res) {
        if (res && res.success) {
          showToast(res.message || 'รับพนักงานกลับเข้าทำงานสำเร็จ', 'success');
          closeModal('rehireModal');
          loadAppData();
          switchEmpSubTab('active');
        } else {
          showToast((res && res.message) || 'เกิดข้อผิดพลาดในการรับกลับเข้าทำงาน', 'error');
        }
      }).catch(function(err) {
        showToast(err.message, 'error');
      });
    }
  );
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

// MONTHLY INPUT MODAL EMPLOYEE SEARCHABLE COMBOBOX
// ==============================================================================
function renderMiEmpDropdown(query) {
  var listEl = document.getElementById('miEmpDropdownList');
  if (!listEl) return;
  var employees = State.employees || [];
  var q = (query || '').trim().toLowerCase();

  var filtered = employees.filter(function(e) {
    if (!q) return true;
    var id = String(e.empId || e.emp_id || '').toLowerCase();
    var name = String(e.fullName || e.name || '').toLowerCase();
    var nick = String(e.nickname || '').toLowerCase();
    var dept = String(e.department || '').toLowerCase();
    return id.indexOf(q) !== -1 || name.indexOf(q) !== -1 || nick.indexOf(q) !== -1 || dept.indexOf(q) !== -1;
  }).sort(function(a, b) {
    var aRes = String(a.status || '').trim().toUpperCase() === 'RESIGNED';
    var bRes = String(b.status || '').trim().toUpperCase() === 'RESIGNED';
    if (aRes !== bRes) return aRes ? 1 : -1;
    return String(a.empId || '').localeCompare(String(b.empId || ''));
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted, #888); font-size: 13px;">ไม่พบพนักงานที่ค้นหา</div>';
    listEl.style.display = 'block';
    return;
  }

  var curSelected = (document.getElementById('miEmpId') || {}).value || '';
  var html = '';
  filtered.forEach(function(e) {
    var id = e.empId || e.emp_id || '';
    var name = e.fullName || e.name || '';
    var nick = e.nickname ? ' (' + e.nickname + ')' : '';
    var dept = e.department || '-';
    var isResigned = String(e.status || '').trim().toUpperCase() === 'RESIGNED';
    var isSel = (id === curSelected);
    var rDate = e.resignDate || e.resign_date;
    var resignNotice = '';
    if (isResigned && rDate) {
      var dFormatted = (typeof formatDateThaiBE === 'function') ? formatDateThaiBE(rDate) : rDate;
      resignNotice = ' • ออก ' + dFormatted;
    }

    html += '<div class="combobox-item" onmousedown="selectMiEmp(\'' + esc(id) + '\')" onclick="selectMiEmp(\'' + esc(id) + '\')" style="padding: 9px 12px; cursor: pointer; border-bottom: 1px solid var(--border-color, #f1f5f9); display: flex; align-items: center; justify-content: space-between; ' + (isSel ? 'background: rgba(37,99,235,0.08); font-weight: 600;' : '') + '" onmouseover="this.style.background=\'rgba(0,0,0,0.04)\'" onmouseout="this.style.background=\'' + (isSel ? 'rgba(37,99,235,0.08)' : 'transparent') + '\'">'
      + '<div style="pointer-events: none;">'
      +   '<div style="display: flex; align-items: center; gap: 8px;">'
      +     '<span style="font-family: monospace; font-weight: 700; color: var(--primary, #2563eb);">' + esc(id) + '</span>'
      +     '<span style="color: var(--text, #1e293b);">' + esc(name) + nick + '</span>'
      +   '</div>'
      +   '<div style="font-size: 11px; color: var(--text-muted, #64748b); margin-top: 2px;">'
      +     'แผนก: ' + esc(dept) + resignNotice
      +   '</div>'
      + '</div>'
      + '<div style="pointer-events: none;">'
      +   (isResigned 
            ? '<span class="badge" style="background: #fee2e2; color: #dc2626; font-size: 10px; padding: 2px 6px; border-radius: 4px;">ลาออก</span>'
            : '<span class="badge" style="background: #dcfce7; color: #16a34a; font-size: 10px; padding: 2px 6px; border-radius: 4px;">ปกติ</span>')
      + '</div>'
      + '</div>';
  });

  listEl.innerHTML = html;
  listEl.style.display = 'block';
}

function selectMiEmp(empId) {
  var sel = document.getElementById('miEmpId');
  var searchInput = document.getElementById('miEmpSearch');
  var listEl = document.getElementById('miEmpDropdownList');
  if (listEl) listEl.style.display = 'none';

  if (!empId) {
    if (sel) sel.value = '';
    if (searchInput) searchInput.value = '';
    onInputEmpSelectChanged();
    return;
  }

  if (sel) {
    sel.value = empId;
  }
  var emp = (State.employees || []).find(function(e) { return (e.empId || e.emp_id) === empId; });
  if (searchInput && emp) {
    var nick = emp.nickname ? ' (' + emp.nickname + ')' : '';
    var isRes = String(emp.status || '').trim().toUpperCase() === 'RESIGNED';
    searchInput.value = emp.empId + ' - ' + (emp.fullName || emp.name || '') + nick + (isRes ? ' [ลาออก]' : '');
  }
  onInputEmpSelectChanged();
}

function onMiEmpSearchInput(val) {
  renderMiEmpDropdown(val);
}

function openMiEmpDropdown() {
  var searchInput = document.getElementById('miEmpSearch');
  var query = searchInput ? searchInput.value : '';
  if (query && (query.indexOf(' - ') !== -1 || query.charAt(0) === '[')) {
    query = '';
  }
  renderMiEmpDropdown(query);
}

function toggleMiEmpDropdown(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  var listEl = document.getElementById('miEmpDropdownList');
  if (!listEl) return;
  if (listEl.style.display === 'block') {
    listEl.style.display = 'none';
  } else {
    var searchInput = document.getElementById('miEmpSearch');
    if (searchInput) searchInput.focus();
    openMiEmpDropdown();
  }
}

// Global click outside listener for miEmpCombobox
document.addEventListener('click', function(evt) {
  var combobox = document.getElementById('miEmpCombobox');
  var listEl = document.getElementById('miEmpDropdownList');
  if (listEl && listEl.style.display === 'block') {
    if (combobox && !combobox.contains(evt.target)) {
      listEl.style.display = 'none';
    }
  }
});

function onInputEmpSelectChanged() {
  var sel = document.getElementById('miEmpId');
  var opt = sel.options[sel.selectedIndex];
  if (opt && opt.value) {
    var empId = opt.value;
    var emp = State.employees.find(function(e) { return e.empId === empId; });
    var searchInput = document.getElementById('miEmpSearch');
    if (searchInput && emp) {
      var nick = emp.nickname ? ' (' + emp.nickname + ')' : '';
      var isRes = String(emp.status || '').trim().toUpperCase() === 'RESIGNED';
      searchInput.value = emp.empId + ' - ' + (emp.fullName || emp.name || '') + nick + (isRes ? ' [ลาออก]' : '');
    }
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
    var searchInput = document.getElementById('miEmpSearch');
    if (searchInput) searchInput.value = '';
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
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้บันทึกข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
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
    lateMinutes: 0,
    lateCount: 0,
    otHours: Number(document.getElementById('miOtHours').value) || 0,
    otRate: Number(document.getElementById('miOtRate').value) || 40,
    allowance: Number(document.getElementById('miAllowance').value) || 0,
    bonus: Number(document.getElementById('miBonus').value) || 0,
    advanceDeduct: Number(document.getElementById('miAdvanceDeduct').value) || 0,
    otherDeduct: Number(document.getElementById('miOtherDeduct').value) || 0,
    carriedDebt: Number(document.getElementById('miCarriedDebt') ? document.getElementById('miCarriedDebt').value : 0) || 0,
    sso: (document.getElementById('miSso') && document.getElementById('miSso').value !== '' && !isNaN(Number(document.getElementById('miSso').value))) ? Number(document.getElementById('miSso').value) : 0,
    tax: Number(document.getElementById('miTax').value) || 0
  };

  if (!d.empId) { showToast('กรุณาเลือกรหัสพนักงาน', 'error'); return; }
  var orig = document.getElementById('inputOrigEmpId').value;
  var origRec = State.inputRecords.find(function(x) { return x.empId === (orig || d.empId); });
  if (origRec) {
    d.lateMinutes = Number(origRec.lateMinutes) || 0;
    d.lateCount = Number(origRec.lateCount) || 0;
  }

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
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้ลบข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
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
  window._empPhotoExplicitlyRemoved = true;
  updateEmployeePhotoPreview('');
}

function handleEmployeePhotoSelect(e) {
  window._empPhotoExplicitlyRemoved = false;
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
      var empId = document.getElementById('mEmpId') ? document.getElementById('mEmpId').value.trim() : 'temp';
      callApi('uploadPhoto', {
        dataUrl: compressedUrl,
        folder: 'employees',
        empId: empId,
        filename: 'emp_' + empId + '_' + Date.now() + '.jpg'
      })
      .then(function(res) {
        if (res && res.success && res.url) {
          var hiddenInput = document.getElementById('mPhotoUrl');
          if (hiddenInput) hiddenInput.value = res.url;
          if (res.storage === 'R2') {
            showToast('อัปโหลดรูปภาพสู่ Cloudflare R2 สำเร็จเรียบร้อย', 'success');
          } else {
            showToast('ปรับขนาดและบันทึกรูปภาพเรียบร้อยแล้ว', 'success');
          }
        }
      })
      .catch(function(err) {
        console.warn('R2 upload note:', err);
        showToast('อัปโหลดและปรับขนาดรูปภาพสำเร็จ');
      });
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

// ==============================================================================
// GLOBAL EMPLOYEE SELECTS SYNCHRONIZER
// Automatically updates ALL employee dropdowns/pickers across every menu & modal
// whenever employees are loaded, added, edited, or passed probation
// ==============================================================================
function refreshAllEmployeeSelects() {
  var employees = State.employees || [];
  var allEmpsSorted = employees.slice().sort(function(a, b) {
    var idA = String(a.empId || a.emp_id || '');
    var idB = String(b.empId || b.emp_id || '');
    return idA.localeCompare(idB);
  });
  var workingEmps = allEmpsSorted.filter(function(e) {
    var st = String(e.status || 'Active').trim().toUpperCase();
    return st !== 'RESIGNED';
  });

  // 1. miEmpId (Payroll Monthly Input Modal)
  var miSel = document.getElementById('miEmpId');
  if (miSel) {
    var curMiVal = miSel.value;
    var miOpts = '<option value="">-- เลือกรหัสพนักงาน --</option>';
    allEmpsSorted.forEach(function(e) {
      var id = e.empId || e.emp_id || '';
      var name = e.fullName || e.full_name || e.name || '';
      var nick = e.nickname ? ' (' + e.nickname + ')' : '';
      var isResigned = String(e.status || '').trim().toUpperCase() === 'RESIGNED';
      var resTag = isResigned ? ' [ลาออก]' : '';
      var empPf = (e.pfRate !== null && e.pfRate !== undefined && !isNaN(Number(e.pfRate))) ? Number(e.pfRate) : 0;
      var empSso = (e.defaultSso !== null && e.defaultSso !== undefined && !isNaN(Number(e.defaultSso))) ? Number(e.defaultSso) : 0;
      miOpts += '<option value="' + esc(id) + '" data-name="' + esc(name) + '" data-salary="' + (e.baseSalary || 0) + '" data-pf="' + empPf + '" data-sso="' + empSso + '" data-tax="' + (e.defaultTax || 0) + '" data-remark="' + esc(e.remark || '') + '">' + esc(id) + ' - ' + esc(name) + nick + resTag + '</option>';
    });
    miSel.innerHTML = miOpts;
    if (curMiVal) miSel.value = curMiVal;
  }

  // 2. histEmpSelect (History Tab)
  var histSel = document.getElementById('histEmpSelect');
  if (histSel) {
    var curHistVal = histSel.value;
    var histOpts = '<option value="">-- เลือกรหัสพนักงาน --</option>';
    allEmpsSorted.forEach(function(e) {
      var id = e.empId || e.emp_id || '';
      var name = e.fullName || e.full_name || e.name || '';
      var nick = e.nickname ? ' (' + e.nickname + ')' : '';
      var isResigned = String(e.status || '').trim().toUpperCase() === 'RESIGNED';
      var resTag = isResigned ? ' [ลาออก]' : '';
      histOpts += '<option value="' + esc(id) + '">' + esc(id) + ' - ' + esc(name) + nick + resTag + '</option>';
    });
    histSel.innerHTML = histOpts;
    if (curHistVal) histSel.value = curHistVal;
  }

  // 3. docCertEmpSelect (Document Center)
  var docSel = document.getElementById('docCertEmpSelect');
  if (docSel) {
    var curDocVal = docSel.value;
    var docOpts = '';
    allEmpsSorted.forEach(function(e) {
      var id = e.empId || e.emp_id || '';
      var name = e.fullName || e.full_name || e.name || '';
      var nick = e.nickname ? ' (' + e.nickname + ')' : '';
      var dept = e.department ? ' [' + e.department + ']' : '';
      var isResigned = String(e.status || '').trim().toUpperCase() === 'RESIGNED';
      var resTag = isResigned ? ' [พ้นสภาพ/ลาออก]' : '';
      docOpts += '<option value="' + esc(id) + '">' + esc(id) + ' - ' + esc(name) + nick + dept + resTag + '</option>';
    });
    docSel.innerHTML = docOpts || '<option value="">ไม่มีข้อมูลพนักงาน</option>';
    if (curDocVal) docSel.value = curDocVal;
  }

  // 4. addAttEmpId (Manual Attendance Clock-in Modal)
  var addAttSel = document.getElementById('addAttEmpId');
  if (addAttSel) {
    var curAddAttVal = addAttSel.value;
    var addAttOpts = '<option value="">-- กรุณาเลือกพนักงาน --</option>';
    allEmpsSorted.forEach(function(e) {
      var id = e.empId || e.emp_id || '';
      var name = e.fullName || e.full_name || e.name || '';
      var nick = e.nickname ? ' (' + e.nickname + ')' : '';
      var dept = e.department ? ' - ' + e.department : '';
      var isResigned = String(e.status || '').trim().toUpperCase() === 'RESIGNED';
      var resTag = isResigned ? ' [ลาออก]' : '';
      addAttOpts += '<option value="' + esc(id) + '">[' + esc(id) + '] ' + esc(name) + nick + dept + resTag + '</option>';
    });
    addAttSel.innerHTML = addAttOpts;
    if (curAddAttVal) addAttSel.value = curAddAttVal;
  }

  // 5. createAdminReqEmpId (Admin Create Request Modal)
  var adminReqSel = document.getElementById('createAdminReqEmpId');
  if (adminReqSel) {
    var curAdminReqVal = adminReqSel.value;
    var adminReqOpts = '<option value="">-- กรุณาเลือกพนักงาน --</option>';
    allEmpsSorted.forEach(function(e) {
      var id = e.empId || e.emp_id || '';
      var name = e.fullName || e.full_name || e.name || '';
      var nick = e.nickname ? ' (' + e.nickname + ')' : '';
      var dept = e.department ? ' - ' + e.department : '';
      var isResigned = String(e.status || '').trim().toUpperCase() === 'RESIGNED';
      var resTag = isResigned ? ' [ลาออก]' : '';
      adminReqOpts += '<option value="' + esc(id) + '">[' + esc(id) + '] ' + esc(name) + nick + dept + resTag + '</option>';
    });
    adminReqSel.innerHTML = adminReqOpts;
    if (curAdminReqVal) adminReqSel.value = curAdminReqVal;
  }

  // 6. expAttEmployee (Export Attendance CSV/Excel Modal)
  var expAttSel = document.getElementById('expAttEmployee');
  if (expAttSel) {
    var curExpVal = expAttSel.value || 'ALL';
    var expOpts = '<option value="ALL">👥 พนักงานทุกคน (All Employees - คนละ 1 แผ่น A4)</option>';
    allEmpsSorted.forEach(function(e) {
      var id = e.empId || e.emp_id || '';
      var name = e.fullName || e.full_name || e.name || '';
      var nick = e.nickname ? ' (' + e.nickname + ')' : '';
      var isResigned = String(e.status || '').trim().toUpperCase() === 'RESIGNED';
      var resTag = isResigned ? ' [ลาออก]' : '';
      expOpts += '<option value="' + esc(id) + '">' + esc(id) + ' - ' + esc(name) + nick + resTag + '</option>';
    });
    expAttSel.innerHTML = expOpts;
    if (curExpVal) expAttSel.value = curExpVal;
  }

  // 7. attSumSingleEmpSelect (Attendance Summary / ใบลงเวลารายบุคคล)
  var attSumSingleSel = document.getElementById('attSumSingleEmpSelect');
  if (attSumSingleSel) {
    var curAttSumVal = attSumSingleSel.value || State.activeAttendanceSummarySingleEmpId;
    var attSumOpts = '';
    allEmpsSorted.forEach(function(e) {
      var id = e.empId || e.emp_id || '';
      var name = e.fullName || e.full_name || e.name || '';
      var nick = e.nickname && e.nickname !== '-' ? ' (' + e.nickname + ')' : '';
      var isResigned = String(e.status || '').trim().toUpperCase() === 'RESIGNED';
      var resTag = isResigned ? ' [ลาออก]' : '';
      attSumOpts += '<option value="' + esc(id) + '">' + esc(id) + ' - ' + esc(name) + nick + resTag + '</option>';
    });
    if (attSumOpts) {
      attSumSingleSel.innerHTML = attSumOpts;
      if (curAttSumVal && allEmpsSorted.some(function(x) { return (x.empId || x.emp_id) === curAttSumVal; })) {
        attSumSingleSel.value = curAttSumVal;
        State.activeAttendanceSummarySingleEmpId = curAttSumVal;
      } else if (allEmpsSorted.length) {
        var firstId = allEmpsSorted[0].empId || allEmpsSorted[0].emp_id;
        attSumSingleSel.value = firstId;
        State.activeAttendanceSummarySingleEmpId = firstId;
      }
    }
  }

  // 8. Attendance Filters (attFilterEmp & attReqEmpFilter)
  if (typeof populateAttendanceEmployeeSelects === 'function') {
    populateAttendanceEmployeeSelects(allEmpsSorted.map(function(e) {
      return {
        emp_id: e.empId || e.emp_id,
        name: e.fullName || e.full_name || e.name,
        full_name: e.fullName || e.full_name || e.name,
        nickname: e.nickname,
        department: e.department,
        position: e.position,
        branch_id: e.branchId || e.branch_id,
        photo_url: e.photoUrl || e.photo_url,
        status: e.status || 'Active',
        resign_date: e.resignDate || e.resign_date || ''
      };
    }));
  }
}

function getNextEmployeeId() {
  var emps = State.employees || [];
  var maxNum = 0;
  emps.forEach(function(e) {
    var id = String(e.empId || e.emp_id || '').trim();
    var match = id.match(/^EMP(\d+)$/i);
    if (match) {
      var num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });
  var nextNum = maxNum + 1;
  return 'EMP' + (nextNum < 1000 ? String(nextNum).padStart(3, '0') : String(nextNum));
}

function openAddEmployeeModal() {
  window._empPhotoExplicitlyRemoved = false;
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
  ['mFullName','mNickname','mBirthDate','mAge','mCitizenId','mPhone','mAddress','mDepartment','mPosition','mBankAccount','mJoinDate','mRemark'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Auto-suggest next employee ID
  var autoId = getNextEmployeeId();
  var empIdInput = document.getElementById('mEmpId');
  if (empIdInput) {
    empIdInput.value = autoId;
    empIdInput.disabled = false;
    empIdInput.readOnly = false;
  }
  var autoBadge = document.getElementById('mEmpIdAutoBadge');
  if (autoBadge) autoBadge.style.display = 'inline-block';
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
  if (document.getElementById('mDiligenceAllowance')) document.getElementById('mDiligenceAllowance').value = '';
  var isAttendanceExemptCheck = document.getElementById('mIsAttendanceExempt');
  if (isAttendanceExemptCheck) isAttendanceExemptCheck.checked = false;
  var isBreakExemptCheck = document.getElementById('mIsBreakExempt');
  if (isBreakExemptCheck) isBreakExemptCheck.checked = false;
  var confWrapper = document.getElementById('wrapperEmpConfidential');
  var isConfCheck = document.getElementById('mIsConfidential');
  var isSuperOrAdmin = (typeof isSuperAdmin === 'function' && isSuperAdmin());
  if (confWrapper) confWrapper.style.display = isSuperOrAdmin ? 'block' : 'none';
  if (isConfCheck) isConfCheck.checked = false;
  if (document.getElementById('mResignDate')) document.getElementById('mResignDate').value = '';
  updateBirthDateThaiHint();
  updateJoinDateThaiHint();
  updateProbEndDateThaiHint();
  updateResignDateThaiHint();
  openModal('empModal');
}

function openEditEmployeeModal(empId) {
  window._empPhotoExplicitlyRemoved = false;
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
  var isAttendanceExemptCheck = document.getElementById('mIsAttendanceExempt');
  if (isAttendanceExemptCheck) isAttendanceExemptCheck.checked = (e.isAttendanceExempt === true || e.isAttendanceExempt === 'true');
  var isBreakExemptCheck = document.getElementById('mIsBreakExempt');
  if (isBreakExemptCheck) isBreakExemptCheck.checked = (e.isBreakExempt === true || e.isBreakExempt === 'true');
  var confWrapper = document.getElementById('wrapperEmpConfidential');
  var isConfCheck = document.getElementById('mIsConfidential');
  var isSuperOrAdmin = (typeof isSuperAdmin === 'function' && isSuperAdmin());
  if (confWrapper) confWrapper.style.display = isSuperOrAdmin ? 'block' : 'none';
  if (isConfCheck) isConfCheck.checked = (e.isConfidential === true || e.isConfidential === 1 || e.isConfidential === 'true');

  document.getElementById('empModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูลพนักงาน';
  document.getElementById('empOrigId').value = e.empId;
  document.getElementById('mEmpId').value = e.empId;
  var autoBadge = document.getElementById('mEmpIdAutoBadge');
  if (autoBadge) autoBadge.style.display = 'none';
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
  var resolvedEditPhoto = e.photoUrl || window._empPhotoCache[e.empId] || '';
  updateEmployeePhotoPreview(resolvedEditPhoto);
  if (!resolvedEditPhoto && e.hasPhoto) {
    ensureEmployeePhotosLoaded([e.empId], function() {
      var loadedPhoto = e.photoUrl || window._empPhotoCache[e.empId] || '';
      if (loadedPhoto && document.getElementById('mEmpId') && document.getElementById('mEmpId').value === e.empId) {
        updateEmployeePhotoPreview(loadedPhoto);
      }
    });
  }
  if (document.getElementById('mStatus')) document.getElementById('mStatus').value = e.status || 'Active';
  if (document.getElementById('mProbationDays')) document.getElementById('mProbationDays').value = e.probationDays || 119;
  if (document.getElementById('mProbationEndDate')) document.getElementById('mProbationEndDate').value = e.probationEndDate || '';
  if (document.getElementById('mResignDate')) document.getElementById('mResignDate').value = e.resignDate || '';
  onEmployeeStatusChanged();
  updateBirthDateThaiHint();
  updateJoinDateThaiHint();
  updateProbEndDateThaiHint();
  updateResignDateThaiHint();
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
  if (document.getElementById('mDiligenceAllowance')) {
    document.getElementById('mDiligenceAllowance').value = (e.diligenceAllowance !== undefined && e.diligenceAllowance !== null) ? e.diligenceAllowance : '';
  }
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
  var diligenceVal = (document.getElementById('mDiligenceAllowance') && document.getElementById('mDiligenceAllowance').value !== '') ? Number(document.getElementById('mDiligenceAllowance').value) : null;

  var branchIdVal = (document.getElementById('mBranchId') && document.getElementById('mBranchId').value) || 'B01';
  var allowAllBranchesVal = (document.getElementById('mAllowAllBranches') && document.getElementById('mAllowAllBranches').checked) || false;

  var d = {
    empId: document.getElementById('mEmpId').value.trim(),
    fullName: document.getElementById('mFullName').value.trim(),
    nickname: document.getElementById('mNickname').value.trim(),
    photoUrl: document.getElementById('mPhotoUrl') ? document.getElementById('mPhotoUrl').value : '',
    photoRemoved: Boolean(window._empPhotoExplicitlyRemoved),
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
    isAttendanceExempt: (document.getElementById('mIsAttendanceExempt') ? document.getElementById('mIsAttendanceExempt').checked : false),
    isBreakExempt: (document.getElementById('mIsBreakExempt') ? document.getElementById('mIsBreakExempt').checked : false),
    isConfidential: (function() {
      if (typeof isSuperAdmin === 'function' && !isSuperAdmin()) {
        return existingEmp ? (existingEmp.isConfidential === true || existingEmp.isConfidential === 1 || existingEmp.isConfidential === 'true') : false;
      }
      return (document.getElementById('mIsConfidential') ? document.getElementById('mIsConfidential').checked : false);
    })(),
    status: (document.getElementById('mStatus') ? document.getElementById('mStatus').value : 'Active'),
    probationDays: (document.getElementById('mProbationDays') ? Number(document.getElementById('mProbationDays').value) : 119),
    probationEndDate: (document.getElementById('mProbationEndDate') ? document.getElementById('mProbationEndDate').value : ''),
    resignDate: (document.getElementById('mResignDate') ? document.getElementById('mResignDate').value : ''),
    baseSalary: baseSal,
    bankName: document.getElementById('mBankName').value.trim(),
    bankAccount: document.getElementById('mBankAccount').value.trim(),
    joinDate: document.getElementById('mJoinDate').value,
    remark: document.getElementById('mRemark').value.trim(),
    pfRate: pfRate,
    defaultSso: ssoVal,
    defaultTax: taxVal,
    diligenceAllowance: diligenceVal
  };

  if (!d.empId || !d.fullName) { showToast('กรุณากรอกรหัสและชื่อพนักงาน', 'error'); return; }
  if (d.photoUrl) {
    window._empPhotoCache[d.empId] = d.photoUrl;
  } else if (d.photoRemoved) {
    delete window._empPhotoCache[d.empId];
  }
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
      try { refreshAllEmployeeSelects(); } catch(e) {}
      if (typeof loadAttendancePeriodSummary === 'function') {
        loadAttendancePeriodSummary();
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
      try { refreshAllEmployeeSelects(); } catch(e) {}
      if (typeof loadAttendancePeriodSummary === 'function') {
        loadAttendancePeriodSummary();
      }
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

// ==============================================================================

// EMPLOYEE REGISTRY PRINT CONTROLLER (ROSTER A4 LANDSCAPE & PROFILE A4 PORTRAIT)
// ==============================================================================
var _empPrintMode = 'roster'; // 'roster' | 'profile'

function openPrintEmployeesModal(empId) {
  var canViewEmp = hasPermission('view_emp') || isSuperAdmin();
  if (!canViewEmp) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานทะเบียนพนักงาน', 'warning');
    return;
  }

  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();
  var salaryLabel = document.getElementById('empPrintShowSalaryLabel');
  var salaryChk = document.getElementById('empPrintShowSalary');
  if (salaryLabel && salaryChk) {
    if (!canViewSalary) {
      salaryLabel.style.display = 'none';
      salaryChk.checked = false;
    } else {
      salaryLabel.style.display = 'flex';
      salaryChk.checked = true;
    }
  }

  // Populate employee dropdown for Profile mode
  var empSel = document.getElementById('empPrintSelectEmp');
  if (empSel) {
    var emps = State.employees || [];
    empSel.innerHTML = emps.map(function(e) {
      var resignedLabel = (e.status === 'Resigned') ? ' [ลาออก]' : '';
      return '<option value="' + esc(e.empId) + '">' + esc(e.empId) + ' - ' + esc(e.fullName) + (e.nickname ? ' (' + esc(e.nickname) + ')' : '') + resignedLabel + '</option>';
    }).join('');
    if (empId) {
      empSel.value = empId;
    }
  }

  // Populate department filter for Roster mode
  var deptSel = document.getElementById('empPrintFilterDept');
  if (deptSel) {
    var depts = {};
    (State.employees || []).forEach(function(e) {
      if (e.department) depts[e.department] = (depts[e.department] || 0) + 1;
    });
    var dHtml = '<option value="ALL">ทุกแผนก (' + (State.employees || []).length + ' ท่าน)</option>';
    Object.keys(depts).sort().forEach(function(d) {
      dHtml += '<option value="' + esc(d) + '">' + esc(d) + ' (' + depts[d] + ' ท่าน)</option>';
    });
    deptSel.innerHTML = dHtml;
  }

  // Populate status filter with counts
  var statusSel = document.getElementById('empPrintFilterStatus');
  if (statusSel) {
    var emps = State.employees || [];
    var actC = 0, probC = 0, resC = 0;
    emps.forEach(function(e) {
      var st = e.status || 'Active';
      if (st === 'Probation') probC++;
      else if (st === 'Resigned') resC++;
      else actC++;
    });
    var totActive = actC + probC;
    var totAll = emps.length;

    statusSel.innerHTML = '' +
      '<option value="ALL">พนักงานทั้งหมดทุกคน (' + totAll + ' ท่าน: รวมลาออก)</option>' +
      '<option value="ALL_ACTIVE">พนักงานปัจจุบันทั้งหมด (' + totActive + ' ท่าน: ประจำ + ทดลองงาน)</option>' +
      '<option value="Active">เฉพาะทำงานอยู่ประจำ (' + actC + ' ท่าน)</option>' +
      '<option value="Probation">เฉพาะช่วงทดลองงาน (' + probC + ' ท่าน)</option>' +
      '<option value="Resigned">เฉพาะพ้นสภาพ / ลาออกแล้ว (' + resC + ' ท่าน)</option>';
    statusSel.value = (typeof currentEmpSubTab !== 'undefined' && currentEmpSubTab === 'resigned') ? 'Resigned' : 'ALL';
  }

  if (empId) {
    setEmpPrintMode('profile');
  } else {
    setEmpPrintMode('roster');
  }

  openModal('printEmployeesModal');
}

function setEmpPrintMode(mode) {
  _empPrintMode = mode;
  var btnRoster = document.getElementById('btnEmpPrintModeRoster');
  var btnProfile = document.getElementById('btnEmpPrintModeProfile');
  var wrapEmp = document.getElementById('empPrintSelectWrap');
  var wrapDept = document.getElementById('empPrintDeptWrap');
  var wrapStatus = document.getElementById('empPrintStatusWrap');
  var container = document.getElementById('empPrintPaperContainer');

  if (btnRoster) btnRoster.className = (mode === 'roster') ? 'btn btn-primary btn-sm' : 'btn btn-slate btn-sm';
  if (btnProfile) btnProfile.className = (mode === 'profile') ? 'btn btn-primary btn-sm' : 'btn btn-slate btn-sm';

  if (wrapEmp) wrapEmp.style.display = (mode === 'profile') ? 'flex' : 'none';
  if (wrapDept) wrapDept.style.display = (mode === 'roster') ? 'flex' : 'none';
  if (wrapStatus) wrapStatus.style.display = (mode === 'roster') ? 'flex' : 'none';

  if (container) {
    if (mode === 'roster') {
      container.style.maxWidth = '100%';
    } else {
      container.style.maxWidth = '840px';
    }
  }

  renderEmpPrintModal();
}

function renderEmpPrintModal() {
  var container = document.getElementById('empPrintPaperContainer');
  if (!container) return;

  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด (PTN PHARMA CENTER CO., LTD.)';
  var compTax = State.company.taxId || '0105559876543';
  var compAddr = State.company.address || '';
  var compPhone = State.company.phone || '';

  var d = new Date();
  var thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var dateStr = d.getDate() + ' ' + thaiMonths[d.getMonth()] + ' ' + (d.getFullYear() + 543) + ' เวลา ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' น.';

  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();
  var showSalary = canViewSalary && document.getElementById('empPrintShowSalary') && document.getElementById('empPrintShowSalary').checked;

  if (_empPrintMode === 'roster') {
    // FORMAT 1: ROSTER TABLE A4 LANDSCAPE
    var filterDept = document.getElementById('empPrintFilterDept') ? document.getElementById('empPrintFilterDept').value : 'ALL';
    var filterStatus = document.getElementById('empPrintFilterStatus') ? document.getElementById('empPrintFilterStatus').value : 'ALL';

    var statusDesc = 'พนักงานทั้งหมดทุกคน';
    if (filterStatus === 'ALL_ACTIVE') statusDesc = 'พนักงานปัจจุบัน (ประจำ + ทดลองงาน)';
    else if (filterStatus === 'Active') statusDesc = 'เฉพาะพนักงานประจำ';
    else if (filterStatus === 'Probation') statusDesc = 'เฉพาะช่วงทดลองงาน';
    else if (filterStatus === 'Resigned') statusDesc = 'เฉพาะพ้นสภาพ/ลาออกแล้ว';

    var list = (State.employees || []).filter(function(e) {
      if (filterDept !== 'ALL' && e.department !== filterDept) return false;
      var st = e.status || 'Active';
      if (filterStatus === 'ALL_ACTIVE') {
        return st === 'Active' || st === 'Probation';
      } else if (filterStatus === 'ALL') {
        return true;
      } else {
        return st === filterStatus;
      }
    });

    var totalBaseSalary = 0;
    var rowsHtml = '';
    list.forEach(function(e, idx) {
      var sal = Number(e.baseSalary) || 0;
      totalBaseSalary += sal;
      var st = e.status || 'Active';
      var stText = '🟢 ทำงานอยู่';
      if (st === 'Probation') stText = '🟠 ทดลองงาน';
      else if (st === 'Resigned') stText = '🔴 ลาออก';
      else if (st === 'Suspended') stText = '🟡 พักงาน';

      var bName = e.bankName || '-';
      var bAcc = e.bankAccount || '-';

      rowsHtml += '<tr style="border-bottom: 1px solid #e2e8f0; page-break-inside: avoid; break-inside: avoid;">' +
        '<td style="padding: 6px 4px; text-align: center; color: #64748b; font-size: 11px;">' + (idx + 1) + '</td>' +
        '<td style="padding: 6px 6px; font-family: monospace; font-weight: 700; color: #1d4ed8; font-size: 11.5px;">' + esc(e.empId) + '</td>' +
        '<td style="padding: 6px 8px; font-weight: 700; color: #0f172a; font-size: 12px;">' +
          esc(e.fullName) + (e.nickname ? ' <span style="font-weight: normal; color: #2563eb;">(' + esc(e.nickname) + ')</span>' : '') +
        '</td>' +
        '<td style="padding: 6px 8px; font-size: 11.5px; color: #334155;">' +
          '<div>' + esc(e.position || '-') + '</div>' +
          '<div style="font-size: 10.5px; color: #64748b;">' + esc(e.department || '-') + '</div>' +
        '</td>' +
        '<td style="padding: 6px 6px; text-align: center; font-size: 11px; color: #475569;">' + esc(e.branch || 'สาขา 1') + '</td>' +
        '<td style="padding: 6px 6px; text-align: center; font-size: 11px; font-weight: 600;">' + stText + '</td>' +
        '<td style="padding: 6px 6px; text-align: center; font-family: monospace; font-size: 11px;">' + (e.joinDate ? formatDateThaiBE(e.joinDate) : '-') + '</td>' +
        '<td style="padding: 6px 6px; text-align: center; font-family: monospace; font-size: 11px; color: #334155;">' + esc(e.phone || '-') + '</td>' +
        '<td style="padding: 6px 6px; font-size: 11px;">' +
          '<div>' + esc(bName) + '</div>' +
          '<div style="font-family: monospace; font-size: 10.5px; color: #64748b;">' + esc(bAcc) + '</div>' +
        '</td>' +
        (showSalary ? ('<td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a; font-size: 11.5px; background: #f8fafc;">' + fmt(sal) + '</td>') : '') +
      '</tr>';
    });

    if (list.length === 0) {
      rowsHtml = '<tr><td colspan="' + (showSalary ? '10' : '9') + '" style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">ไม่พบข้อมูลพนักงานตามเงื่อนไขที่เลือก</td></tr>';
    }

    container.innerHTML = '' +
      '<div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start;">' +
        '<div>' +
          '<div style="font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.2;">' + esc(compName) + '</div>' +
          '<div style="font-size: 11.5px; color: #475569; margin-top: 2px;">' + (compTax ? 'เลขประจำตัวผู้เสียภาษี: ' + esc(compTax) + ' | ' : '') + (compAddr ? esc(compAddr) : '') + (compPhone ? ' โทร: ' + esc(compPhone) : '') + '</div>' +
          '<div style="display: inline-block; margin-top: 6px; padding: 2px 8px; background: #0f172a; color: #ffffff; font-size: 11.5px; font-weight: 700; border-radius: 4px;">' +
            'ทะเบียนประวัติพนักงานและทำเนียบบุคลากร (Staff Directory & Personnel Registry)' +
          '</div>' +
        '</div>' +
        '<div style="text-align: right; font-size: 11px; color: #475569; line-height: 1.5;">' +
          '<div><b>วันที่พิมพ์:</b> ' + dateStr + '</div>' +
          '<div><b>ขอบเขตข้อมูล:</b> แผนก: ' + (filterDept === 'ALL' ? 'ทั้งหมด' : esc(filterDept)) + ' | สถานะ: ' + esc(statusDesc) + '</div>' +
          '<div><b>จำนวนในรายงาน:</b> <span style="font-weight: 800; color: #1d4ed8; font-size: 13px;">' + list.length + '</span> / ' + (State.employees || []).length + ' ท่าน</div>' +
        '</div>' +
      '</div>' +

      '<table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">' +
        '<thead>' +
          '<tr style="background: #f1f5f9; border-top: 1.5px solid #0f172a; border-bottom: 1.5px solid #0f172a; font-weight: 700; color: #0f172a;">' +
            '<th style="padding: 7px 4px; text-align: center; width: 35px;">ที่</th>' +
            '<th style="padding: 7px 6px; text-align: left; width: 75px;">รหัส</th>' +
            '<th style="padding: 7px 8px; text-align: left;">ชื่อ - นามสกุล (ชื่อเล่น)</th>' +
            '<th style="padding: 7px 8px; text-align: left;">ตำแหน่ง / แผนก</th>' +
            '<th style="padding: 7px 6px; text-align: center; width: 90px;">สาขา</th>' +
            '<th style="padding: 7px 6px; text-align: center; width: 85px;">สถานะ</th>' +
            '<th style="padding: 7px 6px; text-align: center; width: 95px;">วันเริ่มงาน</th>' +
            '<th style="padding: 7px 6px; text-align: center; width: 95px;">เบอร์โทร</th>' +
            '<th style="padding: 7px 6px; text-align: left; width: 130px;">ธนาคาร / บัญชี</th>' +
            (showSalary ? '<th style="padding: 7px 8px; text-align: right; width: 105px; background: #e2e8f0;">ฐานเงินเดือน</th>' : '') +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
        (showSalary ? (
          '<tfoot>' +
            '<tr style="background: #f8fafc; border-top: 1.5px solid #0f172a; border-bottom: 1.5px solid #0f172a; font-weight: 700; font-size: 11.5px; page-break-inside: avoid; break-inside: avoid;">' +
              '<td colspan="9" style="padding: 8px 10px; text-align: right; color: #0f172a;">รวมฐานเงินเดือนพนักงานในรายงาน (' + list.length + ' ท่าน):</td>' +
              '<td style="padding: 8px 8px; text-align: right; font-family: monospace; font-size: 12px; color: #1d4ed8; background: #eff6ff;">' + fmt(totalBaseSalary) + '</td>' +
            '</tr>' +
          '</tfoot>'
        ) : '') +
      '</table>' +

      '<div style="margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; font-size: 11px; color: #334155; page-break-inside: avoid; break-inside: avoid;">' +
        '<div>' +
          '<div style="height: 38px; border-bottom: 1px dashed #94a3b8; margin-bottom: 6px;"></div>' +
          '<div style="font-weight: 700;">ลงชื่อ ................................................................</div>' +
          '<div style="color: #64748b; margin-top: 2px;">เจ้าหน้าที่ฝ่ายบุคคล (ผู้จัดทำ)</div>' +
          '<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">วันที่: ......./......./...........</div>' +
        '</div>' +
        '<div>' +
          '<div style="height: 38px; border-bottom: 1px dashed #94a3b8; margin-bottom: 6px;"></div>' +
          '<div style="font-weight: 700;">ลงชื่อ ................................................................</div>' +
          '<div style="color: #64748b; margin-top: 2px;">ผู้จัดการฝ่าย / หัวหน้าแผนก</div>' +
          '<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">วันที่: ......./......./...........</div>' +
        '</div>' +
        '<div>' +
          '<div style="height: 38px; border-bottom: 1px dashed #94a3b8; margin-bottom: 6px;"></div>' +
          '<div style="font-weight: 700;">ลงชื่อ ................................................................</div>' +
          '<div style="color: #64748b; margin-top: 2px;">กรรมการผู้จัดการ / ผู้มีอำนาจอนุมัติ</div>' +
          '<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">วันที่: ......./......./...........</div>' +
        '</div>' +
      '</div>';

  } else {
    // FORMAT 2: INDIVIDUAL PROFILE SHEET A4 PORTRAIT
    var empId = document.getElementById('empPrintSelectEmp') ? document.getElementById('empPrintSelectEmp').value : '';
    var emp = (State.employees || []).find(function(e) { return e.empId === empId; }) || (State.employees || [])[0];

    if (!emp) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">ไม่พบข้อมูลพนักงาน</div>';
      return;
    }

    var st = emp.status || 'Active';
    var stBadgeHtml = '<span style="display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;">🟢 พนักงานประจำ (Active)</span>';
    if (st === 'Probation') {
      stBadgeHtml = '<span style="display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa;">🟠 ช่วงทดลองงาน (Probation)</span>';
    } else if (st === 'Resigned') {
      stBadgeHtml = '<span style="display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca;">🔴 พ้นสภาพ / ลาออกแล้ว</span>';
    }

    var initials = (emp.fullName || '').substring(0, 2);
    var resolvedPrintPhoto = emp.photoUrl || window._empPhotoCache[emp.empId] || '';
    if (!resolvedPrintPhoto && emp.hasPhoto) {
      ensureEmployeePhotosLoaded([emp.empId], function() {
        if (_empPrintMode === 'profile' && (emp.photoUrl || window._empPhotoCache[emp.empId])) {
          renderEmpPrintModal();
        }
      });
    }
    var avatarHtml = resolvedPrintPhoto
      ? '<img src="' + esc(resolvedPrintPhoto) + '" alt="' + esc(emp.fullName) + '" style="width: 110px; height: 130px; object-fit: cover; border-radius: 8px; border: 1.5px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">'
      : '<div style="width: 110px; height: 130px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #e0e7ff; color: #3730a3; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800;">' + esc(initials) + '</div>';

    var tenureStr = calculateTenureString(emp.joinDate, emp.resignDate);
    var otText = (emp.isOtEligible === false || emp.isOtEligible === 'false') ? 'ไม่มีสิทธิ์รับค่าล่วงเวลา (Ineligible)' : 'มีสิทธิ์ได้รับค่าล่วงเวลา (ตามข้อตกลงบริษัท)';
    var breakText = (emp.isUndertimeExempt === true || emp.isUndertimeExempt === 'true') ? 'ยกเว้นการสแกนพักเที่ยง (Exempt)' : 'สแกนเวลาเข้า-ออกปกติ';
    var attText = (emp.isAttendanceExempt === true || emp.isAttendanceExempt === 'true') ? 'ยกเว้นการลงเวลาเข้า-ออกงาน (ผู้บริหาร)' : 'บันทึกเวลาทำงานตามระเบียบ';
    var devStatus = emp.isDeviceBound ? ('ผูกอุปกรณ์แล้ว: ' + ((emp.boundDevice && emp.boundDevice.deviceName) || 'Mobile Device')) : 'ยังไม่ผูกอุปกรณ์';

    container.innerHTML = '' +
      '<div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start;">' +
        '<div>' +
          '<div style="font-size: 19px; font-weight: 800; color: #0f172a; line-height: 1.2;">' + esc(compName) + '</div>' +
          '<div style="font-size: 11.5px; color: #475569; margin-top: 2px;">' + (compTax ? 'ทะเบียนนิติบุคคล: ' + esc(compTax) + ' | ' : '') + (compAddr ? esc(compAddr) : '') + '</div>' +
          '<div style="display: inline-block; margin-top: 6px; padding: 2px 10px; background: #1e3a8a; color: #ffffff; font-size: 11.5px; font-weight: 700; border-radius: 4px;">' +
            'ใบประวัติพนักงานรายบุคคล (Individual Employee Profile Record)' +
          '</div>' +
        '</div>' +
        '<div style="text-align: right; font-size: 11.5px; color: #475569; line-height: 1.5;">' +
          '<div><b>รหัสพนักงาน:</b> <span style="font-family: monospace; font-size: 14px; font-weight: 800; color: #1d4ed8;">' + esc(emp.empId) + '</span></div>' +
          '<div style="margin-top: 2px;"><b>วันที่พิมพ์:</b> ' + dateStr + '</div>' +
        '</div>' +
      '</div>' +

      '<div style="display: grid; grid-template-columns: 140px 1fr; gap: 18px; margin-bottom: 16px;">' +
        '<div style="display: flex; flex-direction: column; align-items: center; text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 8px;">' +
          avatarHtml +
          '<div style="margin-top: 10px;">' + stBadgeHtml + '</div>' +
          '<div style="font-size: 11px; color: #64748b; margin-top: 6px;">อายุงาน: <b style="color: #0f172a;">' + tenureStr + '</b></div>' +
        '</div>' +

        '<div style="display: flex; flex-direction: column; gap: 12px;">' +
          '<div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">' +
            '<div style="font-size: 12px; font-weight: 700; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">' +
              '<i class="fa-solid fa-address-card"></i> 1. ข้อมูลส่วนตัวและตำแหน่งงาน' +
            '</div>' +
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 11.5px;">' +
              '<div><span style="color: #64748b;">ชื่อ-นามสกุล:</span> <b style="color: #0f172a; font-size: 12.5px;">' + esc(emp.fullName) + (emp.nickname ? ' (' + esc(emp.nickname) + ')' : '') + '</b></div>' +
              '<div><span style="color: #64748b;">เลขบัตรประชาชน:</span> <span style="font-family: monospace; font-weight: 600;">' + esc(emp.citizenId || '-') + '</span></div>' +
              '<div><span style="color: #64748b;">ตำแหน่ง:</span> <b style="color: #0f172a;">' + esc(emp.position || '-') + '</b></div>' +
              '<div><span style="color: #64748b;">แผนก:</span> <span style="font-weight: 600;">' + esc(emp.department || '-') + '</span></div>' +
              '<div><span style="color: #64748b;">สาขาที่สังกัด:</span> <span>' + esc(emp.branch || 'สาขา 1 (สำนักงานใหญ่)') + '</span></div>' +
              '<div><span style="color: #64748b;">วันเริ่มงาน:</span> <span style="font-family: monospace;">' + (emp.joinDate ? formatDateThaiBE(emp.joinDate) : '-') + '</span></div>' +
              '<div><span style="color: #64748b;">วันเกิด / อายุ:</span> <span>' + (emp.birthDate ? (formatDateThaiBE(emp.birthDate) + (emp.age ? ' (อายุ ' + emp.age + ' ปี)' : '')) : '-') + '</span></div>' +
              '<div><span style="color: #64748b;">เบอร์โทรศัพท์:</span> <span style="font-family: monospace; font-weight: 600;">' + esc(emp.phone || '-') + '</span></div>' +
              '<div style="grid-column: 1 / -1;"><span style="color: #64748b;">ที่อยู่ตามทะเบียน/ติดต่อ:</span> <span>' + esc(emp.address || '-') + '</span></div>' +
            '</div>' +
          '</div>' +

          (showSalary ? (
            '<div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">' +
              '<div style="font-size: 12px; font-weight: 700; color: #059669; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">' +
                '<i class="fa-solid fa-money-check-dollar"></i> 2. สิทธิประโยชน์และการจ่ายเงินเดือน' +
              '</div>' +
              '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 11.5px;">' +
                '<div><span style="color: #64748b;">ฐานเงินเดือนประจำ:</span> <b style="color: #1d4ed8; font-family: monospace; font-size: 13px;">' + fmt(emp.baseSalary) + '</b></div>' +
                '<div><span style="color: #64748b;">ธนาคาร / เลขที่บัญชี:</span> <span style="font-weight: 600;">' + esc(emp.bankName || '-') + ' ' + esc(emp.bankAccount || '-') + '</span></div>' +
                '<div><span style="color: #64748b;">กองทุนสำรองเลี้ยงชีพ (PF):</span> <span>' + (Number(emp.pfRate) > 0 ? ('เข้าร่วมกองทุน (หัก ' + ((Number(emp.pfRate) * 100).toFixed(2)) + '%)') : 'ไม่เข้าร่วม') + '</span></div>' +
                '<div><span style="color: #64748b;">ประกันสังคม (SSO):</span> <span>' + (Number(emp.defaultSso) > 0 ? ('ผู้ประกันตน (หัก ' + fmt(emp.defaultSso) + '/เดือน)') : 'ไม่หัก SSO') + '</span></div>' +
              '</div>' +
            '</div>'
          ) : '') +
        '</div>' +
      '</div>' +

      '<div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 11.5px;">' +
        '<div style="font-size: 12px; font-weight: 700; color: #d97706; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px;">' +
          '<i class="fa-solid fa-clock"></i> 3. นโยบายการลงเวลาและเงื่อนไขการทำงาน (PTN Time Configuration)' +
        '</div>' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px;">' +
          '<div><span style="color: #64748b;">สิทธิ์การรับค่าล่วงเวลา (OT):</span> <span style="font-weight: 600;">' + esc(otText) + '</span></div>' +
          '<div><span style="color: #64748b;">การสแกนพักเที่ยง:</span> <span style="font-weight: 600;">' + esc(breakText) + '</span></div>' +
          '<div><span style="color: #64748b;">การลงเวลาเข้า-ออก:</span> <span>' + esc(attText) + '</span></div>' +
          '<div><span style="color: #64748b;">การผูกเครื่องลงเวลา:</span> <span style="color: #2563eb;">' + esc(devStatus) + '</span></div>' +
          (emp.remark ? ('<div style="grid-column: 1 / -1;"><span style="color: #64748b;">หมายเหตุฝ่ายบุคคล:</span> <span style="color: #0f172a;">' + esc(emp.remark) + '</span></div>') : '') +
        '</div>' +
      '</div>' +

      '<div style="margin-top: 32px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; font-size: 11px; color: #334155; page-break-inside: avoid; break-inside: avoid;">' +
        '<div>' +
          '<div style="height: 44px; border-bottom: 1px dashed #94a3b8; margin-bottom: 6px;"></div>' +
          '<div style="font-weight: 700;">ลงชื่อ ................................................................</div>' +
          '<div style="color: #475569; margin-top: 2px;">( ' + esc(emp.fullName) + ' )</div>' +
          '<div style="color: #64748b; font-size: 10px;">พนักงานผู้ถือประวัติ</div>' +
          '<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">วันที่: ......./......./...........</div>' +
        '</div>' +
        '<div>' +
          '<div style="height: 44px; border-bottom: 1px dashed #94a3b8; margin-bottom: 6px;"></div>' +
          '<div style="font-weight: 700;">ลงชื่อ ................................................................</div>' +
          '<div style="color: #475569; margin-top: 2px;">( ................................................................ )</div>' +
          '<div style="color: #64748b; font-size: 10px;">เจ้าหน้าที่ฝ่ายบุคคล / ผู้มีอำนาจลงนาม</div>' +
          '<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">วันที่: ......./......./...........</div>' +
        '</div>' +
      '</div>';
  }
}

function executePrintEmployees() {
  clearAllPrintClasses();
  prepareEmpRegistryPrintContainer();

  // Force dynamic @page orientation so all browsers (Chrome/Safari/Edge/Firefox) print landscape or portrait correctly
  var orientStyle = document.getElementById('printPageOrientationStyle');
  if (!orientStyle) {
    orientStyle = document.createElement('style');
    orientStyle.id = 'printPageOrientationStyle';
    document.head.appendChild(orientStyle);
  }

  if (_empPrintMode === 'roster') {
    orientStyle.textContent = '@page { size: A4 landscape !important; margin: 8mm 8mm !important; }';
  } else {
    orientStyle.textContent = '@page { size: A4 portrait !important; margin: 10mm 10mm !important; }';
  }

  document.body.classList.add('printing-emp-registry');

  setTimeout(function() {
    window.print();
    setTimeout(clearAllPrintClasses, 1500);
  }, 100);
}

function populatePayslipModal(row) {
  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  var compAddr = State.company.address || '';
  var compPhone = State.company.phone || '';
  var compTax = State.company.taxId || '';

  document.getElementById('psCompName').textContent = compName;
  document.getElementById('psCompAddr').textContent = compAddr ? 'ที่อยู่: ' + compAddr : '';
  document.getElementById('psCompTax').textContent = (compTax ? 'เลขประจำตัวผู้เสียภาษี: ' + compTax + ' ' : '') + (compPhone ? 'โทร: ' + compPhone : '');
  var isEarned = (State.payrollCalcMode === 'EARNED' && (row.isMidPeriod || State.isMidPeriod));
  var asOfThai = formatDateThaiBE(row.asOfDate || State.asOfDate);
  document.getElementById('psPeriod').innerHTML = esc(row.period || State.period) + (isEarned ? ' <span style="font-size:10.5px;font-weight:700;background:#eff6ff;color:#1e40af;padding:2px 6px;border-radius:4px;border:1px solid #bfdbfe;white-space:nowrap"><i class="fa-solid fa-chart-line"></i> ยอดสะสมถึงวันที่ ' + esc(asOfThai) + '</span>' : '');
  document.getElementById('psEmpId').textContent = row.empId;
  var empRowMatch = State.employees.find(function(e) { return e.empId === row.empId; });
  var psNick = row.nickname || (empRowMatch && empRowMatch.nickname) || getEmpNickname(row.empId);
  document.getElementById('psEmpName').textContent = row.name + (psNick ? ' (' + psNick + ')' : '');
  document.getElementById('psDeptPos').textContent = (row.department || '-') + ' / ' + (row.position || '-');
  document.getElementById('psBankAcc').textContent = (row.bankName || '-') + ' ' + (row.bankAccount || '-');

  var displayBase = (isEarned && row.earnedBaseSalary !== undefined) ? Number(row.earnedBaseSalary) : Number(row.baseSalary);
  var displayGross = (isEarned && row.earnedGrossPay !== undefined) ? Number(row.earnedGrossPay) : Number(row.grossPay);
  var displaySso = (isEarned && row.earnedSso !== undefined) ? Number(row.earnedSso) : Number(row.sso);
  var displayPf = (isEarned && row.earnedPf !== undefined) ? Number(row.earnedPf) : Number(row.pf);
  var displayTax = (isEarned && row.earnedTax !== undefined) ? Number(row.earnedTax) : Number(row.tax);
  var displayTotalDed = (isEarned && row.earnedTotalDeductions !== undefined) ? Number(row.earnedTotalDeductions) : Number(row.totalDeductions);
  var displayNet = (isEarned && row.earnedNetPay !== undefined) ? Number(row.earnedNetPay) : Number(row.netPay);

  document.getElementById('psBaseSalary').textContent = fmt(displayBase);
  document.getElementById('psOtHours').textContent = row.otHours || 0;
  if (document.getElementById('psOtRate')) {
    var rOtRate = (row.otRate !== null && row.otRate !== undefined && !isNaN(Number(row.otRate))) ? Number(row.otRate) : ((State.payrollDefaults && State.payrollDefaults.defaultOtRate) ? State.payrollDefaults.defaultOtRate : 40);
    document.getElementById('psOtRate').textContent = rOtRate;
  }
  document.getElementById('psOtPay').textContent = fmt(row.otPay);
  document.getElementById('psAllowance').textContent = fmt(row.allowance);
  document.getElementById('psBonus').textContent = fmt(row.bonus);
  document.getElementById('psLeaveDed').textContent = fmt(row.leaveDeduction);
  document.getElementById('psGrossPay').textContent = fmt(displayGross);

  document.getElementById('psSso').textContent = fmt(displaySso);
  document.getElementById('psPf').textContent = fmt(displayPf);
  document.getElementById('psTax').textContent = fmt(displayTax);
  document.getElementById('psAdvDed').textContent = fmt(row.advanceDeduct);
  document.getElementById('psOtherDed').textContent = fmt(row.otherDeduct);
  document.getElementById('psTotalDed').textContent = fmt(displayTotalDed);
  document.getElementById('psNetPay').textContent = fmt(displayNet);

  // Carried debt deduction from previous period (if any)
  var inputRec = State.inputRecords.find(function(x) { return x.empId === row.empId; });
  var carriedDebtIn = inputRec ? (Number(inputRec.carriedDebt) || 0) : 0;
  var carriedDebtRow = document.getElementById('psCarriedDebtDeductRow');
  if (carriedDebtRow) {
    if (carriedDebtIn > 0) {
      carriedDebtRow.style.display = 'flex';
      if (document.getElementById('psCarriedDebtDeduct')) {
        document.getElementById('psCarriedDebtDeduct').textContent = fmt(carriedDebtIn);
      }
    } else {
      carriedDebtRow.style.display = 'none';
    }
  }

  // Carried debt ending deficit to next period (if net pay would have been negative)
  var debtEndingAmt = Number(row.carriedDebt) || 0;
  var noticeEl = document.getElementById('psCarriedDebtNotice');
  if (noticeEl) {
    if (debtEndingAmt > 0) {
      noticeEl.style.display = 'block';
      if (document.getElementById('psCarriedDebtAmount')) {
        document.getElementById('psCarriedDebtAmount').textContent = fmt(debtEndingAmt);
      }
    } else {
      noticeEl.style.display = 'none';
    }
  }

  openModal('payslipModal');
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
  var resSec = document.getElementById('resignedConfigSection');
  if (resSec) {
    resSec.style.display = (st === 'Resigned') ? 'block' : 'none';
  }
  if (st === 'Probation') {
    calculateProbationEndDate();
  }
  if (st === 'Resigned') {
    updateResignDateThaiHint();
  }
}

function calculateProbationEndDate() {
  updateJoinDateThaiHint();
  var joinDateVal = document.getElementById('mJoinDate') ? document.getElementById('mJoinDate').value : '';
  var daysVal = document.getElementById('mProbationDays') ? Number(document.getElementById('mProbationDays').value) : 119;
  var endInp = document.getElementById('mProbationEndDate');
  var txt = document.getElementById('mProbationCountdownText');

  if (!joinDateVal) {
    if (endInp) endInp.value = '';
    updateProbEndDateThaiHint();
    if (txt) txt.textContent = 'กรุณาระบุวันเริ่มงาน';
    return;
  }

  var jd = new Date(joinDateVal);
  if (isNaN(jd.getTime())) {
    updateProbEndDateThaiHint();
    return;
  }

  jd.setDate(jd.getDate() + daysVal);
  var endIso = jd.toISOString().substring(0, 10);
  if (endInp) endInp.value = endIso;
  updateProbEndDateThaiHint();

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
    try { refreshAllEmployeeSelects(); } catch(e) {}
    if (typeof loadAttendancePeriodSummary === 'function') {
      loadAttendancePeriodSummary();
    }
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
        '<div style="font-size:11px;color:#64748b">' + esc(e.department || '-') + ' / ' + esc(e.position || '-') + ' | เริ่มงาน: ' + esc(formatDateThaiBE(e.joinDate)) + '</div>' +
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
