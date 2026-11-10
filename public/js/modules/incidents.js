/**
 * Incident & Damage Deductions Management Module (PTN Payroll V4.0)
 * บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด
 */

var cachedIncidents = [];
var activeReviewingIncidentId = null;
var activeCreatingIncidentId = null;

function getIncidentActiveUser() {
  return (State.currentUser && State.currentUser.username) || (window.currentUser && window.currentUser.username) || 'Admin';
}

function getThaiDefaultPeriodClient() {
  var months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var d = new Date();
  return months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

// ==============================================================================
// 1. OPEN INCIDENTS LEDGER MODAL & KPI OVERVIEW
// ==============================================================================
function openIncidentsLedgerModal() {
  if (typeof openModal === 'function') {
    openModal('modalIncidentsLedger');
  } else {
    document.getElementById('modalIncidentsLedger')?.classList.add('active');
  }

  // Populate branch filter options
  var branchSelect = document.getElementById('incFilterBranch');
  if (branchSelect && Array.isArray(State.branches) && branchSelect.options.length <= 1) {
    State.branches.forEach(function(b) {
      var opt = document.createElement('option');
      opt.value = b.branch_id || b.branchId;
      opt.textContent = b.branch_name || b.name || b.branch_id;
      branchSelect.appendChild(opt);
    });
  }

  loadIncidents();
}

async function loadIncidents() {
  var statusFilter = document.getElementById('incFilterStatus')?.value || 'ALL';
  var branchFilter = document.getElementById('incFilterBranch')?.value || 'ALL';
  var tbody = document.getElementById('incidentsTableBody');

  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:30px;color:#94a3b8"><i class="fa-solid fa-spinner fa-spin" style="font-size:22px;margin-bottom:8px;display:block"></i>กำลังโหลดรายการเหตุการณ์ความเสียหาย...</td></tr>';
  }

  try {
    var data = await callApi('getIncidents', {
      status: statusFilter,
      branchId: branchFilter
    });

    if (data && data.success && Array.isArray(data.incidents)) {
      cachedIncidents = data.incidents;
      renderIncidentsTable(cachedIncidents);
      updateIncidentKpiCards(cachedIncidents);
    } else {
      cachedIncidents = [];
      if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:30px;color:#ef4444">ไม่สามารถโหลดข้อมูลได้: ' + ((data && data.message) || 'เกิดข้อผิดพลาด') + '</td></tr>';
    }
  } catch (err) {
    console.error('loadIncidents error:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:30px;color:#ef4444">เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ' + (err.message || '') + '</td></tr>';
  }
}

function updateIncidentKpiCards(list) {
  var pendingCount = 0;
  var approvedCount = 0;
  var totalDamage = 0;
  var totalCompany = 0;
  var totalNetStaff = 0;

  list.forEach(function(i) {
    if (i.status === 'PENDING') pendingCount++;
    if (i.status === 'APPROVED') approvedCount++;
    totalDamage += Number(i.total_incident_amount) || 0;
    totalCompany += Number(i.company_absorbed_amount) || 0;
    totalNetStaff += Number(i.net_employee_amount) || 0;
  });

  var pEl = document.getElementById('incKpiPendingCount');
  if (pEl) pEl.textContent = pendingCount + ' รายการ';

  var aEl = document.getElementById('incKpiApprovedCount');
  if (aEl) aEl.textContent = approvedCount + ' รายการ';

  var dEl = document.getElementById('incKpiTotalDamage');
  if (dEl) dEl.textContent = '฿' + totalDamage.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  var cEl = document.getElementById('incKpiTotalCompany');
  if (cEl) cEl.textContent = '฿' + totalCompany.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  var sEl = document.getElementById('incKpiTotalNetStaff');
  if (sEl) sEl.textContent = '฿' + totalNetStaff.toLocaleString('th-TH', { minimumFractionDigits: 2 });
}

function renderIncidentsTable(list) {
  var tbody = document.getElementById('incidentsTableBody');
  if (!tbody) return;

  var searchQ = (document.getElementById('incSearchInput')?.value || '').trim().toLowerCase();
  var filtered = list.filter(function(i) {
    if (!searchQ) return true;
    return (
      (i.incident_code || '').toLowerCase().includes(searchQ) ||
      (i.title || '').toLowerCase().includes(searchQ) ||
      (i.description || '').toLowerCase().includes(searchQ) ||
      (i.branch_name || '').toLowerCase().includes(searchQ) ||
      (i.involvedEmployeesText || '').toLowerCase().includes(searchQ)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:30px;color:#94a3b8"><i class="fa-regular fa-folder-open" style="font-size:24px;display:block;margin-bottom:8px"></i>ไม่พบรายการเหตุการณ์ความเสียหายตามเงื่อนไขที่เลือก</td></tr>';
    return;
  }

  var catMap = {
    CASH_SHORT: { label: '💵 เงินสดขาด', color: '#dc2626' },
    GOODS_DAMAGE: { label: '📦 สินค้าเสียหาย', color: '#d97706' },
    STOCK_LOSS: { label: '🔍 สต็อกหาย', color: '#7c3aed' },
    PROPERTY_DAMAGE: { label: '🏢 ทรัพย์สินร้าน', color: '#0284c7' },
    OTHER: { label: '📝 อื่นๆ', color: '#475569' }
  };

  var statusMap = {
    PENDING: { label: 'รอตรวจสอบ/อนุมัติ', bg: '#fef3c7', color: '#92400e', icon: 'fa-clock' },
    APPROVED: { label: 'อนุมัติหักเงินแล้ว', bg: '#dcfce7', color: '#166534', icon: 'fa-check' },
    REJECTED: { label: 'ปฏิเสธ / ยกเลิก', bg: '#fee2e2', color: '#991b1b', icon: 'fa-xmark' }
  };

  tbody.innerHTML = filtered.map(function(i) {
    var cat = catMap[i.category] || { label: i.category, color: '#475569' };
    var st = statusMap[i.status] || { label: i.status, bg: '#f1f5f9', color: '#475569', icon: 'fa-circle' };
    var empCount = i.involvedEmpCount || 1;
    var netAmt = Number(i.net_employee_amount) || 0;
    var perPerson = Math.round((netAmt / empCount) * 100) / 100;
    var instCount = (i.schedules && i.schedules[0] && i.schedules[0].total_installments) || 1;

    var staffListHtml = (i.involvedEmployeesList || []).map(function(emp) {
      return '<span style="display:inline-block;background:#f1f5f9;border:1px solid #cbd5e1;padding:2px 6px;border-radius:6px;font-size:11px;font-weight:600;margin:1px 2px">' + emp + '</span>';
    }).join('');
    if (!staffListHtml) staffListHtml = '<span style="color:#64748b;font-size:11.5px">' + (i.involvedEmployeesText || '-') + '</span>';

    return (
      '<tr style="border-bottom:1px solid #e2e8f0;transition:background 0.2s">' +
        '<td style="padding:10px 12px;font-family:monospace;font-weight:700;color:#0f172a;white-space:nowrap">' + (i.incident_code || '#' + i.id) + '</td>' +
        '<td style="padding:10px 12px;white-space:nowrap;font-size:11.5px;color:#334155">' + i.incident_date + '</td>' +
        '<td style="padding:10px 12px;white-space:nowrap;font-size:11.5px;font-weight:600;color:#1e293b">' + (i.branch_name || i.branch_id) + '</td>' +
        '<td style="padding:10px 12px;white-space:nowrap;font-size:11.5px;font-weight:700;color:' + cat.color + '">' + cat.label + '</td>' +
        '<td style="padding:10px 12px">' +
          '<div style="font-weight:700;color:#0f172a;font-size:12.5px">' + i.title + '</div>' +
          (i.description ? '<div style="font-size:11px;color:#64748b;margin-top:2px;max-width:280px;line-height:1.3">' + i.description + '</div>' : '') +
          (i.evidence_photo_url ? '<a href="' + i.evidence_photo_url + '" target="_blank" style="font-size:11px;color:#0284c7;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:3px;margin-top:3px"><i class="fa-solid fa-camera"></i> ดูรูปหลักฐาน</a>' : '') +
        '</td>' +
        '<td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:800;color:#b91c1c">฿' + (Number(i.total_incident_amount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }) + '</td>' +
        '<td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:700;color:#059669">฿' + (Number(i.company_absorbed_amount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }) + '</td>' +
        '<td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:800;color:#b91c1c">฿' + netAmt.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + '</td>' +
        '<td style="padding:10px 12px;max-width:240px">' +
          '<div style="font-size:11px;color:#64748b;margin-bottom:3px">' + empCount + ' ท่าน • คนละ ฿' + perPerson.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + '</div>' +
          '<div>' + staffListHtml + '</div>' +
        '</td>' +
        '<td style="padding:10px 12px;text-align:center;white-space:nowrap">' +
          '<span style="font-weight:700;font-size:11.5px;color:#4338ca">' + instCount + ' งวด</span>' +
        '</td>' +
        '<td style="padding:10px 12px;text-align:center;white-space:nowrap">' +
          '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;background:' + st.bg + ';color:' + st.color + '">' +
            '<i class="fa-solid ' + st.icon + '"></i> ' + st.label +
          '</span>' +
        '</td>' +
        '<td style="padding:10px 12px;text-align:center;white-space:nowrap">' +
          '<div style="display:inline-flex;gap:4px">' +
            '<button type="button" class="btn btn-xs ' + (i.status === 'PENDING' ? 'btn-primary' : 'btn-outline') + '" onclick="openReviewIncidentModal(' + i.id + ')" title="ตรวจสอบรายละเอียดและอนุมัติ">' +
              '<i class="fa-solid fa-magnifying-glass"></i> ' + (i.status === 'PENDING' ? 'อนุมัติ' : 'ดูข้อมูล') +
            '</button>' +
            '<button type="button" class="btn btn-xs btn-slate" onclick="openCreateIncidentModal(' + i.id + ')" title="แก้ไขรายการ">' +
              '<i class="fa-solid fa-pen-to-square"></i>' +
            '</button>' +
            '<button type="button" class="btn btn-xs btn-danger" onclick="deleteIncidentAction(' + i.id + ')" title="ลบรายการ">' +
              '<i class="fa-solid fa-trash"></i>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }).join('');
}

// ==============================================================================
// 2. CREATE / EDIT INCIDENT MODAL (BY ADMIN / HR)
// ==============================================================================
function openCreateIncidentModal(existingId) {
  existingId = existingId || null;
  activeCreatingIncidentId = existingId;
  var modal = document.getElementById('modalCreateIncident');
  var titleEl = document.getElementById('modalCreateIncidentTitle');
  if (titleEl) titleEl.textContent = existingId ? 'แก้ไขรายการความเสียหาย' : 'บันทึกเหตุการณ์ความเสียหายใหม่';

  // Populate branch select
  var branchSelect = document.getElementById('adminIncBranch');
  if (branchSelect && Array.isArray(State.branches) && State.branches.length > 0) {
    branchSelect.innerHTML = State.branches.map(function(b) {
      return '<option value="' + (b.branch_id || b.branchId) + '">' + (b.branch_name || b.name || b.branch_id) + '</option>';
    }).join('');
  }

  // Populate staff checklist
  var staffContainer = document.getElementById('adminIncStaffChecklist');
  if (staffContainer && Array.isArray(State.employees)) {
    var sorted = State.employees.slice().sort(function(a, b) {
      return (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '', 'th');
    });
    staffContainer.innerHTML = sorted.map(function(emp) {
      var empName = emp.fullName || emp.name || emp.full_name || emp.empId;
      var nick = emp.nickname ? ' (' + emp.nickname + ')' : '';
      return (
        '<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">' +
          '<input type="checkbox" name="adminIncEmpCheckbox" value="' + emp.empId + '" onchange="updateAdminIncLiveSplit()" style="width:16px;height:16px">' +
          '<span>[' + emp.empId + '] ' + empName + nick + ' - <span style="color:#64748b">' + (emp.department || '-') + '</span></span>' +
        '</label>'
      );
    }).join('');
  }

  // Fill default values or existing values
  if (existingId) {
    var existing = cachedIncidents.find(function(i) { return i.id === existingId; });
    if (existing) {
      document.getElementById('adminIncDate').value = existing.incident_date;
      document.getElementById('adminIncBranch').value = existing.branch_id;
      document.getElementById('adminIncCategory').value = existing.category;
      document.getElementById('adminIncTitle').value = existing.title;
      document.getElementById('adminIncTotalAmount').value = existing.total_incident_amount;
      document.getElementById('adminIncCompanyAbsorbed').value = existing.company_absorbed_amount || 0;
      document.getElementById('adminIncDescription').value = existing.description || '';
      document.getElementById('adminIncPhotoUrl').value = existing.evidence_photo_url || '';

      // Check involved staff
      var involvedIds = new Set((existing.schedules || []).map(function(s) { return s.emp_id; }));
      document.querySelectorAll('input[name="adminIncEmpCheckbox"]').forEach(function(cb) {
        cb.checked = involvedIds.has(cb.value);
      });
    }
  } else {
    document.getElementById('adminIncDate').value = new Date().toISOString().substring(0, 10);
    document.getElementById('adminIncCategory').value = 'CASH_SHORT';
    document.getElementById('adminIncTitle').value = '';
    document.getElementById('adminIncTotalAmount').value = '';
    document.getElementById('adminIncCompanyAbsorbed').value = '0';
    document.getElementById('adminIncDescription').value = '';
    document.getElementById('adminIncPhotoUrl').value = '';
    document.querySelectorAll('input[name="adminIncEmpCheckbox"]').forEach(function(cb) { cb.checked = false; });
  }

  updateAdminIncLiveSplit();

  if (typeof openModal === 'function') {
    openModal('modalCreateIncident');
  } else {
    modal?.classList.add('active');
  }
}

function updateAdminIncLiveSplit() {
  var totalAmt = Math.max(0, parseFloat(document.getElementById('adminIncTotalAmount')?.value) || 0);
  var companyAmt = Math.max(0, parseFloat(document.getElementById('adminIncCompanyAbsorbed')?.value) || 0);
  var netAmt = Math.max(0, totalAmt - companyAmt);

  var netDisplay = document.getElementById('adminIncNetStaffDisplay');
  if (netDisplay) netDisplay.textContent = '฿' + netAmt.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  var checkedBoxes = document.querySelectorAll('input[name="adminIncEmpCheckbox"]:checked');
  var count = checkedBoxes.length;

  var countBadge = document.getElementById('adminIncStaffSelectedCount');
  if (countBadge) countBadge.textContent = 'เลือก ' + count + ' คน';

  var perPersonDisplay = document.getElementById('adminIncPerPersonDisplay');
  if (perPersonDisplay) {
    if (count > 0 && netAmt > 0) {
      var perPerson = Math.round((netAmt / count) * 100) / 100;
      perPersonDisplay.textContent = 'คนละ ฿' + perPerson.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + ' (หาร ' + count + ' คน)';
    } else {
      perPersonDisplay.textContent = count === 0 ? 'กรุณาเลือกพนักงานผู้รับผิดชอบ' : '฿0.00';
    }
  }
}

async function handleAdminIncPhotoUpload(event) {
  var file = event.target.files?.[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('adminIncPhotoUrl').value = e.target.result;
    Swal.fire({ icon: 'success', title: 'อัปโหลดรูปสำเร็จ', timer: 1000, showConfirmButton: false });
  };
  reader.readAsDataURL(file);
}

async function submitAdminIncidentForm(event) {
  event.preventDefault();

  var date = document.getElementById('adminIncDate')?.value;
  var branch = document.getElementById('adminIncBranch')?.value;
  var category = document.getElementById('adminIncCategory')?.value;
  var title = document.getElementById('adminIncTitle')?.value.trim();
  var totalAmount = parseFloat(document.getElementById('adminIncTotalAmount')?.value) || 0;
  var companyAbsorbed = parseFloat(document.getElementById('adminIncCompanyAbsorbed')?.value) || 0;
  var description = document.getElementById('adminIncDescription')?.value.trim();
  var photoUrl = document.getElementById('adminIncPhotoUrl')?.value.trim();

  var checkedBoxes = document.querySelectorAll('input[name="adminIncEmpCheckbox"]:checked');
  var involvedEmpIds = Array.from(checkedBoxes).map(function(cb) { return cb.value; });

  if (!date || !title) {
    Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุวันที่และหัวข้อเรื่อง', 'warning');
    return;
  }
  if (totalAmount <= 0) {
    Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุยอดความเสียหายที่มากกว่า 0', 'warning');
    return;
  }
  if (involvedEmpIds.length === 0) {
    Swal.fire('ข้อมูลไม่ครบ', 'กรุณาเลือกพนักงานผู้รับผิดชอบอย่างน้อย 1 คน', 'warning');
    return;
  }

  try {
    var data = await callApi('saveIncident', {
      id: activeCreatingIncidentId,
      incidentDate: date,
      branchId: branch,
      category: category,
      title: title,
      description: description,
      totalIncidentAmount: totalAmount,
      companyAbsorbedAmount: companyAbsorbed,
      involvedEmpIds: involvedEmpIds,
      evidencePhotoUrl: photoUrl,
      username: getIncidentActiveUser()
    });

    if (data && data.success) {
      Swal.fire('บันทึกสำเร็จ', data.message || 'บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
      closeModal('modalCreateIncident');
      loadIncidents();
    } else {
      Swal.fire('บันทึกไม่สำเร็จ', (data && data.message) || 'เกิดข้อผิดพลาด', 'error');
    }
  } catch (err) {
    console.error('submitAdminIncidentForm error:', err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

// ==============================================================================
// 3. REVIEW & APPROVE INCIDENT MODAL (INSTALLMENT & START PERIOD)
// ==============================================================================
function getThaiNextPeriodsList(startPeriodStr, count) {
  var months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var month = 0;
  var yearBE = 2569;

  if (startPeriodStr) {
    for (var i = 0; i < months.length; i++) {
      if (startPeriodStr.includes(months[i])) {
        month = i;
        break;
      }
    }
    var num = startPeriodStr.match(/\d{4}/);
    if (num) yearBE = parseInt(num[0], 10);
  } else {
    var d = new Date();
    month = d.getMonth();
    yearBE = d.getFullYear() + 543;
  }

  var list = [];
  for (var c = 0; c < count; c++) {
    list.push(months[month] + ' ' + yearBE);
    month++;
    if (month >= 12) {
      month = 0;
      yearBE++;
    }
  }
  return list;
}

function openReviewIncidentModal(id) {
  activeReviewingIncidentId = id;
  var inc = cachedIncidents.find(function(i) { return i.id === id; });
  if (!inc) return;

  // Set Details
  document.getElementById('revIncCode').textContent = inc.incident_code || '#' + inc.id;
  document.getElementById('revIncDate').textContent = inc.incident_date;
  document.getElementById('revIncBranch').textContent = inc.branch_name || inc.branch_id;
  document.getElementById('revIncTitle').textContent = inc.title;
  document.getElementById('revIncTotalAmount').textContent = '฿' + (Number(inc.total_incident_amount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
  document.getElementById('revIncReporter').textContent = inc.reporter_username || 'HR';

  var descEl = document.getElementById('revIncDescription');
  if (descEl) descEl.textContent = inc.description || 'ไม่มีรายละเอียดเพิ่มเติม';

  // Photo
  var photoWrap = document.getElementById('revIncPhotoWrapper');
  var photoImg = document.getElementById('revIncPhotoImg');
  var photoLink = document.getElementById('revIncPhotoLink');
  if (photoWrap && photoImg) {
    if (inc.evidence_photo_url) {
      photoImg.src = inc.evidence_photo_url;
      if (photoLink) photoLink.href = inc.evidence_photo_url;
      photoWrap.style.display = 'block';
    } else {
      photoWrap.style.display = 'none';
    }
  }

  // Populate Start Period Select
  var periodSelect = document.getElementById('revIncStartPeriod');
  if (periodSelect) {
    var activePeriod = State.period || getThaiDefaultPeriodClient();
    var periods = getThaiNextPeriodsList(activePeriod, 12);
    periodSelect.innerHTML = periods.map(function(p) {
      return '<option value="' + p + '">' + p + '</option>';
    }).join('');
    periodSelect.value = activePeriod;
  }

  // Pre-fill editable fields
  document.getElementById('revIncCompanyAbsorbed').value = inc.company_absorbed_amount || 0;
  
  // Installments count
  var existingInstallments = (inc.schedules && inc.schedules[0] && inc.schedules[0].total_installments) || 1;
  document.getElementById('revIncInstallments').value = String(existingInstallments);

  updateReviewSchedulePreview();

  // Show/hide approve & reject buttons according to status
  var btnApprove = document.getElementById('btnRevApprove');
  var btnReject = document.getElementById('btnRevReject');
  if (inc.status === 'APPROVED') {
    if (btnApprove) btnApprove.style.display = 'none';
    if (btnReject) btnReject.style.display = 'inline-block';
  } else if (inc.status === 'REJECTED') {
    if (btnApprove) btnApprove.style.display = 'inline-block';
    if (btnReject) btnReject.style.display = 'none';
  } else {
    if (btnApprove) btnApprove.style.display = 'inline-block';
    if (btnReject) btnReject.style.display = 'inline-block';
  }

  if (typeof openModal === 'function') {
    openModal('modalReviewIncident');
  } else {
    document.getElementById('modalReviewIncident')?.classList.add('active');
  }
}

function updateReviewSchedulePreview() {
  var inc = cachedIncidents.find(function(i) { return i.id === activeReviewingIncidentId; });
  if (!inc) return;

  var totalDamage = Number(inc.total_incident_amount) || 0;
  var companyAbsorbed = Math.max(0, parseFloat(document.getElementById('revIncCompanyAbsorbed')?.value) || 0);
  var netStaffTotal = Math.max(0, totalDamage - companyAbsorbed);
  var installments = parseInt(document.getElementById('revIncInstallments')?.value, 10) || 1;
  var startPeriod = document.getElementById('revIncStartPeriod')?.value;

  var netDisplay = document.getElementById('revIncNetStaffAmount');
  if (netDisplay) netDisplay.textContent = '฿' + netStaffTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 });

  var involvedList = inc.involvedEmployeesList || [];
  var empCount = involvedList.length || inc.involvedEmpCount || 1;
  var perPersonTotal = Math.round((netStaffTotal / empCount) * 100) / 100;
  var perPersonPerInstallment = Math.round((perPersonTotal / installments) * 100) / 100;

  var summaryText = document.getElementById('revIncScheduleSummaryText');
  if (summaryText) {
    summaryText.innerHTML =
      'พนักงานผู้รับผิดชอบ <strong>' + empCount + ' ท่าน</strong> (คนละ <strong>฿' + perPersonTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + '</strong>) ' +
      '• แบ่งผ่อนชำระ <strong>' + installments + ' งวด</strong> ตกคนละประมาณ <strong>฿' + perPersonPerInstallment.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + ' / งวด</strong>';
  }

  // Generate period lines preview
  var futurePeriods = getThaiNextPeriodsList(startPeriod, installments);
  var tableContainer = document.getElementById('revIncSchedulePreviewTable');
  if (tableContainer) {
    tableContainer.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:11.5px">' +
        '<thead>' +
          '<tr style="background:#f1f5f9;color:#475569;text-align:left">' +
            '<th style="padding:6px 10px">งวดที่</th>' +
            '<th style="padding:6px 10px">งวดเงินเดือนเป้าหมาย</th>' +
            '<th style="padding:6px 10px;text-align:right">ยอดหักต่อคน</th>' +
            '<th style="padding:6px 10px;text-align:right">ยอดหักรวม (' + empCount + ' คน)</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          futurePeriods.map(function(p, idx) {
            return (
              '<tr style="border-bottom:1px solid #e2e8f0">' +
                '<td style="padding:6px 10px;font-weight:700">' + (idx + 1) + ' / ' + installments + '</td>' +
                '<td style="padding:6px 10px;font-weight:600;color:#1e3a8a"><i class="fa-solid fa-calendar-days" style="margin-right:4px"></i> ' + p + '</td>' +
                '<td style="padding:6px 10px;text-align:right;font-family:monospace;font-weight:700;color:#dc2626">฿' + perPersonPerInstallment.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + '</td>' +
                '<td style="padding:6px 10px;text-align:right;font-family:monospace;font-weight:800;color:#b91c1c">฿' + (perPersonPerInstallment * empCount).toLocaleString('th-TH', { minimumFractionDigits: 2 }) + '</td>' +
              '</tr>'
            );
          }).join('') +
        '</tbody>' +
      '</table>';
  }
}

async function approveIncidentAction() {
  if (!activeReviewingIncidentId) return;

  var inc = cachedIncidents.find(function(i) { return i.id === activeReviewingIncidentId; });
  var companyAbsorbed = Math.max(0, parseFloat(document.getElementById('revIncCompanyAbsorbed')?.value) || 0);
  var installments = parseInt(document.getElementById('revIncInstallments')?.value, 10) || 1;
  var startPeriod = document.getElementById('revIncStartPeriod')?.value;

  var confirmRes = await Swal.fire({
    title: 'ยืนยันอนุมัติรายการหักเงิน?',
    html:
      '<div style="text-align:left;font-size:12px;line-height:1.6;background:#f8fafc;padding:12px;border-radius:10px;border:1px solid #e2e8f0">' +
        '<div><strong>รายการ:</strong> ' + (inc ? inc.title : '') + '</div>' +
        '<div><strong>บ. ช่วยรับผิดชอบ:</strong> ฿' + companyAbsorbed.toLocaleString() + '</div>' +
        '<div><strong>แบ่งผ่อนชำระ:</strong> ' + installments + ' งวด</div>' +
        '<div><strong>เริ่มหักงวดแรก:</strong> <span style="color:#1d4ed8;font-weight:700">' + startPeriod + '</span></div>' +
        '<div style="color:#059669;margin-top:6px"><i class="fa-solid fa-bell"></i> ระบบจะส่ง Web Push แจ้งเตือนไปยังพนักงาน และนำยอดไปรวมใน <strong>"หักอื่นๆ"</strong> ประจำงวดอัตโนมัติ</div>' +
      '</div>',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '✅ อนุมัติและบันทึกตารางงวด',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#059669'
  });

  if (!confirmRes.isConfirmed) return;

  try {
    var data = await callApi('approveIncident', {
      id: activeReviewingIncidentId,
      companyAbsorbedAmount: companyAbsorbed,
      installments: installments,
      startPeriod: startPeriod,
      username: getIncidentActiveUser()
    });

    if (data && data.success) {
      await Swal.fire('อนุมัติเรียบร้อยแล้ว', data.message || 'บันทึกตารางการหักเงินเรียบร้อยแล้ว', 'success');
      closeModal('modalReviewIncident');
      loadIncidents();
      // Reload payroll table if startPeriod matches current period
      if (startPeriod === State.period && typeof loadAppData === 'function') {
        loadAppData();
      }
    } else {
      Swal.fire('เกิดข้อผิดพลาด', (data && data.message) || 'ไม่สามารถอนุมัติได้', 'error');
    }
  } catch (err) {
    console.error('approveIncidentAction error:', err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

async function rejectIncidentAction() {
  if (!activeReviewingIncidentId) return;

  var confirmRes = await Swal.fire({
    title: 'ยืนยันปฏิเสธ / ยกเลิกรายการนี้?',
    text: 'ยอดหักเงินที่กำหนดไว้ในตารางจะถูกยกเลิกทั้งหมด',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ปฏิเสธรายการ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626'
  });

  if (!confirmRes.isConfirmed) return;

  try {
    var data = await callApi('rejectIncident', {
      id: activeReviewingIncidentId,
      username: getIncidentActiveUser()
    });

    if (data && data.success) {
      Swal.fire('ปฏิเสธรายการเรียบร้อย', data.message || 'ยกเลิกรายการเรียบร้อยแล้ว', 'success');
      closeModal('modalReviewIncident');
      loadIncidents();
      if (typeof loadAppData === 'function') loadAppData();
    } else {
      Swal.fire('เกิดข้อผิดพลาด', (data && data.message) || 'ไม่สามารถทำรายการได้', 'error');
    }
  } catch (err) {
    console.error('rejectIncidentAction error:', err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

async function deleteIncidentAction(id) {
  var confirmRes = await Swal.fire({
    title: 'ยืนยันลบรายการความเสียหายนี้?',
    text: 'ข้อมูลเหตุการณ์และตารางการหักเงินทั้งหมดจะถูกลบถาวร',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบถาวร',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626'
  });

  if (!confirmRes.isConfirmed) return;

  try {
    var data = await callApi('deleteIncident', {
      id: id,
      username: getIncidentActiveUser()
    });

    if (data && data.success) {
      Swal.fire('ลบรายการสำเร็จ', data.message || 'ลบข้อมูลเรียบร้อยแล้ว', 'success');
      loadIncidents();
      if (typeof loadAppData === 'function') loadAppData();
    } else {
      Swal.fire('ลบไม่สำเร็จ', (data && data.message) || 'เกิดข้อผิดพลาด', 'error');
    }
  } catch (err) {
    console.error('deleteIncidentAction error:', err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

// ==============================================================================
// 4. EMPLOYEE INCIDENT BREAKDOWN POPUP (FROM PAYSLIP / INSPECTOR)
// ==============================================================================
async function viewEmployeeIncidentBreakdown(empId, period) {
  var modal = document.getElementById('modalEmployeeIncidentBreakdown');
  var titleEl = document.getElementById('empIncBreakdownTitle');
  var contentEl = document.getElementById('empIncBreakdownContent');
  var sumEl = document.getElementById('empIncBreakdownTotalSum');

  var emp = (State.employees || []).find(function(e) { return e.empId === empId; }) || { empId: empId, fullName: empId };
  var targetPeriod = period || State.period;

  if (titleEl) {
    titleEl.innerHTML = 'รายการหักค่าเสียหาย: <strong>[' + emp.empId + '] ' + (emp.fullName || emp.name || emp.full_name) + '</strong> • งวด: <strong>' + targetPeriod + '</strong>';
  }
  if (contentEl) {
    contentEl.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8"><i class="fa-solid fa-spinner fa-spin" style="font-size:20px;margin-bottom:8px;display:block"></i>กำลังโหลดรายการแจกแจง...</div>';
  }

  if (typeof openModal === 'function') {
    openModal('modalEmployeeIncidentBreakdown');
  } else {
    modal?.classList.add('active');
  }

  try {
    var data = await callApi('getEmployeeIncidentBreakdown', {
      empId: empId,
      period: targetPeriod
    });

    if (data && data.success && Array.isArray(data.items) && data.items.length > 0) {
      var catMap = {
        CASH_SHORT: '💵 เงินสดขาด',
        GOODS_DAMAGE: '📦 สินค้าเสียหาย',
        STOCK_LOSS: '🔍 สต็อกหาย',
        PROPERTY_DAMAGE: '🏢 ทรัพย์สินร้าน',
        OTHER: '📝 อื่นๆ'
      };

      contentEl.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:10px">' +
          data.items.map(function(it, idx) {
            var cat = catMap[it.category] || it.category;
            var instText = it.total_installments > 1 ? ('งวดที่ ' + it.installment_no + ' จาก ' + it.total_installments + ' งวด') : 'หักงวดเดียว';
            return (
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px">' +
                '<div style="display:flex;align-items:center;justify-content:space-between">' +
                  '<span style="font-family:monospace;font-weight:700;font-size:12px;color:#0f172a">' + (it.incident_code || '#' + (it.incident_id || idx + 1)) + '</span>' +
                  '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">' + instText + '</span>' +
                '</div>' +
                '<div style="font-weight:700;color:#0f172a;font-size:13px">' + it.title + '</div>' +
                '<div style="display:flex;align-items:center;justify-content:space-between;font-size:11.5px;color:#64748b">' +
                  '<span>📅 เกิดเหตุวันที่ ' + it.incident_date + ' • ' + cat + ' • ' + (it.branch_name || it.branch_id) + '</span>' +
                  '<span style="font-family:monospace;font-weight:800;font-size:14px;color:#dc2626">฿' + (Number(it.amount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }) + '</span>' +
                '</div>' +
                (it.description ? '<div style="font-size:11.5px;color:#475569;background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0">' + it.description + '</div>' : '') +
                (it.evidence_photo_url ? (
                  '<div style="margin-top:2px">' +
                    '<a href="' + it.evidence_photo_url + '" target="_blank" style="font-size:11.5px;color:#0284c7;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px">' +
                      '<i class="fa-solid fa-camera"></i> ดูรูปภาพหลักฐานความเสียหาย' +
                    '</a>' +
                  '</div>'
                ) : '') +
              '</div>'
            );
          }).join('') +
        '</div>';

      if (sumEl) sumEl.textContent = '฿' + (Number(data.totalAmount) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
    } else {
      contentEl.innerHTML =
        '<div style="text-align:center;padding:30px 20px;color:#64748b;font-size:12.5px">' +
          '<i class="fa-regular fa-circle-check" style="font-size:32px;color:#059669;display:block;margin-bottom:8px"></i>' +
          'ไม่มีรายการหักเงินค่าเสียหายในงวด <strong>' + targetPeriod + '</strong><br>' +
          '<span style="font-size:11px;color:#94a3b8">(ยอดหักอื่นๆ ในสลิปอาจมาจากการกรอกตัวเลขแบบ Manual ในหน้าบันทึกข้อมูลประจำงวด)</span>' +
        '</div>';
      if (sumEl) sumEl.textContent = '฿0.00';
    }
  } catch (err) {
    console.error('viewEmployeeIncidentBreakdown error:', err);
    if (contentEl) contentEl.innerHTML = '<div style="text-align:center;padding:20px;color:#dc2626">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
  }
}
