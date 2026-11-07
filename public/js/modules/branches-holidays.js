/**
 * ==============================================================================
 * PTN Payroll - Branches, Settings & Company Holidays Module
 * ==============================================================================
 */

// COMPANY HOLIDAYS MANAGEMENT (ระบบจัดการวันหยุดบริษัท / วันหยุดนักขัตฤกษ์)
// ==========================================
function openCompanyHolidaysModal() {
  try {
    var canManage = isSuperAdmin() || hasPermission('manage_company') || hasPermission('calc_payroll') || hasPermission('all') || hasPermission('edit_emp');

    var formContainer = document.getElementById('formAddCompanyHoliday');
    if (formContainer) {
      formContainer.style.display = canManage ? 'grid' : 'none';
      var addHeader = formContainer.previousElementSibling;
      if (addHeader) addHeader.style.display = canManage ? 'flex' : 'none';
    }

    // Pre-fill today's date in form if empty
    var dateInput = document.getElementById('inputHolidayDate');
    if (dateInput && !dateInput.value) {
      var nowUtc = new Date();
      var bkk = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
      dateInput.value = bkk.toISOString().substring(0, 10);
    }

    renderCompanyHolidaysList();
    openModal('companyHolidaysModal');

    // Always fetch fresh holidays from API in background to ensure up-to-date list
    callApi('getCompanyHolidays').then(function(res) {
      if (res && res.success && Array.isArray(res.holidays)) {
        State.companyHolidays = res.holidays;
        renderCompanyHolidaysList();
      }
    }).catch(function(e) {
      console.warn('getCompanyHolidays background fetch note:', e);
    });
  } catch(err) {
    console.error('openCompanyHolidaysModal error:', err);
    showToast('เกิดข้อผิดพลาดในการเปิดหน้าต่างวันหยุด: ' + err.message, 'error');
  }
}

function renderCompanyHolidaysList() {
  var tbody = document.getElementById('companyHolidaysTableBody');
  var countEl = document.getElementById('countHolidaysTotal');
  var periodSummaryEl = document.getElementById('holidayInPeriodSummary');
  if (!tbody) return;

  var holidays = State.companyHolidays || [];
  if (countEl) countEl.textContent = holidays.length;

  // Determine current period cutoff window
  var cutoff = getAttendanceCutoffDatesClient(State.period);
  var startStr = cutoff ? cutoff.startDate : '';
  var endStr = cutoff ? cutoff.endDate : '';

  var inPeriodCount = 0;
  holidays.forEach(function(h) {
    if (h.date >= startStr && h.date <= endStr) inPeriodCount++;
  });

  if (periodSummaryEl) {
    var rangeText = cutoff && cutoff.label ? cutoff.label : (esc(startStr) + ' ถึง ' + esc(endStr));
    periodSummaryEl.innerHTML = '<i class="fa-solid fa-calendar-check"></i> ในงวด <strong>' + esc(State.period || 'ปัจจุบัน') + '</strong> (' + rangeText + ') มีวันหยุดบริษัท <strong>' + inPeriodCount + '</strong> วัน';
  }

  if (holidays.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:28px"><i class="fa-solid fa-calendar-xmark" style="font-size:24px;display:block;margin-bottom:8px;color:#94a3b8"></i> ยังไม่มีการบันทึกวันหยุดบริษัท</td></tr>';
    return;
  }

  var dayNamesTh = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var html = '';

  holidays.forEach(function(h) {
    var dObj = new Date(h.date + 'T00:00:00Z');
    var dayOfWeek = dayNamesTh[dObj.getUTCDay()] || '-';
    var isSunday = (dObj.getUTCDay() === 0);
    var isInCurrentPeriod = (h.date >= startStr && h.date <= endStr);

    var rowBg = isInCurrentPeriod ? '#f0fdfa' : '#fff';
    var typeBadge = h.holiday_type === 'SPECIAL'
      ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">วันหยุดพิเศษ</span>'
      : '<span style="background:#ccfbf1;color:#0f766e;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">วันหยุดประเพณี</span>';

    var inPeriodTag = isInCurrentPeriod
      ? ' <span style="background:#0d9488;color:#fff;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700">งวดนี้</span>'
      : '';

    var sundayNotice = isSunday
      ? ' <span style="color:#ef4444;font-size:10.5px" title="วันหยุดตรงกับวันอาทิตย์ (ปกติเป็นวันหยุดประจำสัปดาห์อยู่แล้ว)">(ตรงวันอาทิตย์)</span>'
      : '';

    html += '<tr style="background:' + rowBg + ';border-bottom:1px solid #e2e8f0;transition:background 0.15s">';
    html += '<td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#0f172a">' + esc(h.date) + inPeriodTag + '</td>';
    html += '<td style="padding:8px 12px;font-weight:700;color:' + (isSunday ? '#dc2626' : '#334155') + '">' + dayOfWeek + sundayNotice + '</td>';
    html += '<td style="padding:8px 12px;font-weight:700;color:#1e40af">' + esc(h.holiday_name) + '</td>';
    html += '<td style="padding:8px 12px">' + typeBadge + '</td>';
    html += '<td style="padding:8px 12px;color:#64748b;font-size:11.5px">' + esc(h.note || '-') + '</td>';
    var canManage = isSuperAdmin() || hasPermission('manage_company') || hasPermission('calc_payroll') || hasPermission('all') || hasPermission('edit_emp');
    html += '<td style="padding:8px 12px;text-align:center">';
    if (canManage) {
      html += '<button type="button" class="btn btn-danger btn-sm" style="padding:3px 8px;font-size:11px" onclick="deleteCompanyHoliday(' + (h.id || 'null') + ', \'' + esc(h.date) + '\', \'' + esc(h.holiday_name).replace(/'/g, "\\'") + '\')" title="ลบวันหยุดนี้">';
      html += '<i class="fa-solid fa-trash-can"></i>';
      html += '</button>';
    } else {
      html += '<span style="color:#94a3b8;font-size:11px">-</span>';
    }
    html += '</td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;
}

function saveCompanyHolidayFromForm() {
  var canManage = isSuperAdmin() || hasPermission('manage_company') || hasPermission('calc_payroll') || hasPermission('all') || hasPermission('edit_emp');
  if (!canManage) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการวันหยุดบริษัท', 'warning');
    return;
  }

  var dateEl = document.getElementById('inputHolidayDate');
  var nameEl = document.getElementById('inputHolidayName');
  var typeEl = document.getElementById('inputHolidayType');
  var noteEl = document.getElementById('inputHolidayNote');

  var date = dateEl ? dateEl.value.trim() : '';
  var name = nameEl ? nameEl.value.trim() : '';
  var type = typeEl ? typeEl.value.trim() : 'COMPANY';
  var note = noteEl ? noteEl.value.trim() : '';

  if (!date || !name) {
    showToast('กรุณากรอกวันที่และชื่อวันหยุดให้ครบถ้วน', 'warning');
    return;
  }

  showToast('กำลังบันทึกวันหยุดบริษัท...');

  callApi('saveCompanyHoliday', {
    holiday: {
      date: date,
      holiday_name: name,
      holiday_type: type,
      note: note
    },
    period: State.period,
    forcePeriod: true,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
  .then(function(r) {
    if (!r.success) {
      showToast(r.message || 'บันทึกวันหยุดไม่สำเร็จ', 'error');
      return;
    }
    showToast(r.message || 'บันทึกวันหยุดเรียบร้อยแล้ว');
    if (r.holidays) {
      State.companyHolidays = r.holidays;
    }
    if (nameEl) nameEl.value = '';
    if (noteEl) noteEl.value = '';
    renderCompanyHolidaysList();
    loadAppData(true);
  })
  .catch(function(e) {
    showToast(e.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
  });
}

function deleteCompanyHoliday(id, date, name) {
  var canManage = isSuperAdmin() || hasPermission('manage_company') || hasPermission('calc_payroll') || hasPermission('all') || hasPermission('edit_emp');
  if (!canManage) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการวันหยุดบริษัท', 'warning');
    return;
  }

  var msg = 'คุณแน่ใจหรือไม่ที่จะลบวันหยุด "' + (name || date) + '" (' + date + ')?\\n\\nเมื่อลบแล้ว ระบบจะคำนวณวันทำงานของงวดใหม่อัตโนมัติ';
  if (!confirm(msg)) return;

  showToast('กำลังลบวันหยุด...');

  callApi('deleteCompanyHoliday', {
    id: id,
    date: date,
    period: State.period,
    forcePeriod: true,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
  .then(function(r) {
    if (!r.success) {
      showToast(r.message || 'ลบวันหยุดไม่สำเร็จ', 'error');
      return;
    }
    showToast(r.message || 'ลบวันหยุดเรียบร้อยแล้ว');
    if (r.holidays) {
      State.companyHolidays = r.holidays;
    }
    renderCompanyHolidaysList();
    loadAppData(true);
  })
  .catch(function(e) {
    showToast(e.message || 'เกิดข้อผิดพลาดในการลบ', 'error');
  });
}


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
  if (document.getElementById('cfgDiligenceAllowance')) document.getElementById('cfgDiligenceAllowance').value = pd.diligenceAllowance !== undefined ? pd.diligenceAllowance : 1000;
  if (document.getElementById('cfgDiligenceLateGraceMins')) document.getElementById('cfgDiligenceLateGraceMins').value = pd.diligenceLateGraceMins !== undefined ? pd.diligenceLateGraceMins : 2;
  if (document.getElementById('cfgDiligenceLateMaxCount')) document.getElementById('cfgDiligenceLateMaxCount').value = pd.diligenceLateMaxCount !== undefined ? pd.diligenceLateMaxCount : 1;
  if (document.getElementById('cfgAutoDiligenceEnabled')) document.getElementById('cfgAutoDiligenceEnabled').checked = pd.autoDiligenceEnabled !== false;
  if (document.getElementById('cfgCountOverbreakAsLate')) document.getElementById('cfgCountOverbreakAsLate').checked = pd.countOverbreakAsLate !== false;
  if (document.getElementById('cfgMissingBreakPenaltyMode')) document.getElementById('cfgMissingBreakPenaltyMode').value = pd.missingBreakPenaltyMode || 'ALERT_ONLY';

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
    defaultProbationDays: Number(document.getElementById('cfgDefaultProbationDays').value) || 119,
    diligenceAllowance: document.getElementById('cfgDiligenceAllowance') ? Number(document.getElementById('cfgDiligenceAllowance').value) : 1000,
    diligenceLateGraceMins: document.getElementById('cfgDiligenceLateGraceMins') ? Number(document.getElementById('cfgDiligenceLateGraceMins').value) : 2,
    diligenceLateMaxCount: document.getElementById('cfgDiligenceLateMaxCount') ? Number(document.getElementById('cfgDiligenceLateMaxCount').value) : 1,
    autoDiligenceEnabled: document.getElementById('cfgAutoDiligenceEnabled') ? document.getElementById('cfgAutoDiligenceEnabled').checked : true,
    countOverbreakAsLate: document.getElementById('cfgCountOverbreakAsLate') ? document.getElementById('cfgCountOverbreakAsLate').checked : true,
    missingBreakPenaltyMode: document.getElementById('cfgMissingBreakPenaltyMode') ? document.getElementById('cfgMissingBreakPenaltyMode').value : 'ALERT_ONLY'
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
  var tbodyEmb = document.getElementById('branchManagerTableBodyEmbedded');
  if (!tbody && !tbodyEmb) return;

  var bList = State.branches || [];
  if (!bList.length) {
    var emptyRow = '<tr><td colspan="10" class="text-center text-muted" style="padding:24px">ไม่พบข้อมูลสาขา</td></tr>';
    if (tbody) tbody.innerHTML = emptyRow;
    if (tbodyEmb) tbodyEmb.innerHTML = emptyRow;
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
        var canToggle = canToggleBranchEarlyDismissal(b.branch_id);
        var earlyBtn = '<button type="button" class="btn btn-sm" ' + (!canToggle ? 'disabled style="font-size:11px;padding:3px 8px;font-weight:700;background:#f1f5f9;color:#94a3b8;border:1.5px solid #e2e8f0;cursor:not-allowed;opacity:0.6"' : 'style="font-size:11px;padding:3px 8px;font-weight:700;background:' + (isEarly ? '#ecfdf5' : '#f8fafc') + ';color:' + (isEarly ? '#059669' : '#64748b') + ';border:1.5px solid ' + (isEarly ? '#10b981' : '#cbd5e1') + '" onclick="toggleBranchEarlyDismissal(\'' + esc(b.branch_id) + '\', ' + !isEarly + ')"') + ' title="' + (!canToggle ? 'ไม่มีสิทธิ์ควบคุมสาขานี้' : 'คลิกเพื่อเปิด/ปิดโหมดงานเสร็จ') + '">' +
          (isEarly ? '🟢 เปิด (จ่ายเต็ม)' : '⚪ ปิด (ปกติ)') + (!canToggle ? ' 🔒' : '') +
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

  if (tbody) tbody.innerHTML = html;
  if (tbodyEmb) tbodyEmb.innerHTML = html;
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
    var canToggle = canToggleBranchEarlyDismissal(b.branch_id);
    var badgeBg = isEarly ? '#ecfdf5' : '#f8fafc';
    var badgeBorder = isEarly ? '#10b981' : '#cbd5e1';
    var textColor = isEarly ? '#047857' : '#475569';
    var statusText = isEarly ? '🟢 เปิด (จ่ายเต็มวัน)' : '⚪ ปกติ';

    if (!canToggle) {
      badgeBg = '#f1f5f9';
      badgeBorder = '#e2e8f0';
      textColor = '#94a3b8';
    }

    html += '<div style="display:flex;align-items:center;gap:8px;background:' + badgeBg + ';border:1.5px solid ' + badgeBorder + ';padding:6px 12px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,0.04);transition:all 0.2s;' + (!canToggle ? 'opacity:0.65;' : '') + '" title="' + (!canToggle ? 'บัญชีของคุณไม่มีสิทธิ์ควบคุมโหมดงานเสร็จของสาขานี้' : '') + '">' +
      '<div style="font-weight:700;font-size:12px;color:' + textColor + '">' +
        '<i class="fa-solid fa-store" style="margin-right:4px"></i>' + esc(b.branch_name) +
      '</div>' +
      '<label class="switch-toggle" style="position:relative;display:inline-block;width:38px;height:20px;' + (canToggle ? 'cursor:pointer' : 'cursor:not-allowed') + '">' +
        '<input type="checkbox" ' + (isEarly ? 'checked' : '') + ' ' + (!canToggle ? 'disabled' : '') + ' onchange="toggleBranchEarlyDismissal(\'' + esc(b.branch_id) + '\', this.checked)" style="opacity:0;width:0;height:0">' +
        '<span style="position:absolute;top:0;left:0;right:0;bottom:0;background:' + (isEarly ? '#10b981' : '#cbd5e1') + ';border-radius:20px;transition:0.3s;box-shadow:inset 0 1px 2px rgba(0,0,0,0.1)">' +
          '<span style="position:absolute;content:\'\';height:14px;width:14px;left:' + (isEarly ? '20px' : '3px') + ';bottom:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>' +
        '</span>' +
      '</label>' +
      '<span style="font-size:11px;font-weight:700;color:' + textColor + '">' + statusText + (!canToggle ? ' <i class="fa-solid fa-lock" style="font-size:10px" title="ไม่มีสิทธิ์ควบคุมสาขานี้"></i>' : '') + '</span>' +
    '</div>';
  });

  container.innerHTML = html;
}

function toggleBranchEarlyDismissal(branchId, enabled) {
  if (!canToggleBranchEarlyDismissal(branchId)) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เปิด/ปิดโหมดงานเสร็จของสาขานี้', 'error');
    return;
  }
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
  if (!isSuperAdmin() && !hasPermission('manage_attendance_settings')) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการสาขาหรือกะงาน', 'warning');
    return;
  }

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
    showToast('เบราว์เซอร์ไม่รองรับการดึงพิกัด Geolocation', 'warning');
    return;
  }

  var btn = document.getElementById('btnGetBranchLocation');
  var origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังหาพิกัด...';
  }
  showToast('กำลังตรวจหาพิกัด GPS จากอุปกรณ์...', 'info');

  function onSuccess(pos) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
    var lat = pos.coords.latitude.toFixed(6);
    var lng = pos.coords.longitude.toFixed(6);
    var acc = Math.round(pos.coords.accuracy || 0);
    document.getElementById('bLat').value = lat;
    document.getElementById('bLng').value = lng;
    showToast('ดึงพิกัดสำเร็จ: ' + lat + ', ' + lng + (acc ? ' (ความแม่นยำ ±' + acc + 'm)' : ''), 'success');
  }

  function handleGeoError(err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }

    if (err.code === 1) { // PERMISSION_DENIED
      alert('⚠️ ไม่สามารถดึงพิกัดได้: สิทธิ์เข้าถึงตำแหน่ง (Location) ถูกปิดอยู่\n\nวิธีเปิดสิทธิ์ในเบราว์เซอร์:\n1. กดที่ไอคอนแม่กุญแจ 🔒 หรือการตั้งค่าเว็บไซต์ ที่แถบ URL ด้านบน\n2. ไปที่หัวข้อ "ตำแหน่ง" (Location / Site Permissions)\n3. เลือกเปลี่ยนเป็น "อนุญาต" (Allow)\n4. กดยืนยันแล้วกด "ดึงพิกัดปัจจุบัน" อีกครั้งครับ\n\n(หรือสามารถกดปุ่ม "วางพิกัด" เพื่อคัดลอกจาก Google Maps มาใส่ได้ทันที)');
      showToast('เบราว์เซอร์ถูกปิดสิทธิ์ตำแหน่ง (Location Denied): กรุณากดไอคอนแม่กุญแจ 🔒 ที่แถบ URL ด้านบน แล้วเลือก "อนุญาต"', 'error');
    } else if (err.code === 3) { // TIMEOUT
      showToast('หมดเวลารอดึงพิกัด GPS (Timeout): แนะนำให้เปิด Wi-Fi หรือคัดลอกพิกัดจาก Google Maps มาวางแทนครับ', 'warning');
    } else if (err.code === 2) { // POSITION_UNAVAILABLE
      showToast('ไม่พบสัญญาณตำแหน่ง: อุปกรณ์ไม่พร้อมระบุพิกัด แนะนำให้คัดลอกพิกัดจาก Google Maps มาใส่แทนครับ', 'warning');
    } else {
      showToast('ไม่สามารถดึงพิกัดได้: ' + (err.message || 'เกิดข้อผิดพลาด'), 'error');
    }
  }

  function tryLowAccuracy() {
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      handleGeoError,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }

  // Attempt 1: High accuracy (fast timeout 6s)
  navigator.geolocation.getCurrentPosition(
    onSuccess,
    function(err) {
      if (err.code === 1) {
        // Permission denied directly -> do not retry, show instructions
        handleGeoError(err);
      } else {
        // Timeout or Position unavailable -> try low accuracy fallback (Wi-Fi / network)
        console.warn('GPS High accuracy failed, falling back to network positioning...', err);
        tryLowAccuracy();
      }
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
  );
}

function viewBranchOnGoogleMaps() {
  var lat = document.getElementById('bLat') ? document.getElementById('bLat').value.trim() : '';
  var lng = document.getElementById('bLng') ? document.getElementById('bLng').value.trim() : '';
  if (!lat || !lng) {
    showToast('กรุณาระบุพิกัด Latitude และ Longitude ก่อนตรวจสอบแผนที่', 'warning');
    return;
  }
  window.open('https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng), '_blank');
}

function pasteCoordinatesFromMaps() {
  var input = prompt('กรุณาวางพิกัดจาก Google Maps\n(เช่น 15.698765, 100.524123 หรือลิงก์ Google Maps):');
  if (!input) return;
  var match = input.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (match) {
    var lat = parseFloat(match[1]).toFixed(6);
    var lng = parseFloat(match[2]).toFixed(6);
    document.getElementById('bLat').value = lat;
    document.getElementById('bLng').value = lng;
    showToast('กำหนดพิกัดสำเร็จ: ' + lat + ', ' + lng, 'success');
  } else {
    showToast('ไม่พบรูปแบบพิกัด (ตัวอย่างที่ถูกต้อง: 15.698765, 100.524123)', 'warning');
  }
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
