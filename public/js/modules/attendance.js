/**
 * ==============================================================================
 * PTN Payroll - Time Attendance, Requests & Biometric Logging Module
 * ==============================================================================
 */

// ATTENDANCE BATCH IMPORT CONTROLLER
// ==============================================================================
var parsedAttendanceRecords = [];

function openImportAttendanceModal() {
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้นำเข้าข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
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
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้นำเข้าข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
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

function getActiveCutoffPeriodString() {
  var nowUtc = new Date();
  var bkk = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
  var curY = bkk.getFullYear();
  var curM = bkk.getMonth() + 1; // 1-12
  var curD = bkk.getDate();
  var cutDay = 25;
  if (_currentAttendanceSettings && _currentAttendanceSettings.cutoff_day) {
    cutDay = Number(_currentAttendanceSettings.cutoff_day);
  } else if (State.settings && State.settings.cutoff_day) {
    cutDay = Number(State.settings.cutoff_day);
  } else {
    var cutEl = document.getElementById('attSetCutoffDay');
    if (cutEl && cutEl.value) cutDay = Number(cutEl.value);
  }
  if (!cutDay || isNaN(cutDay) || cutDay < 1 || cutDay > 31) cutDay = 25;

  if (cutDay < 30 && curD > cutDay) {
    curM += 1;
    if (curM > 12) {
      curM = 1;
      curY += 1;
    }
  }
  return curY + '-' + String(curM).padStart(2, '0');
}

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
    } else {
      var fullThaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
      var shortThaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      for (var mi = 0; mi < 12; mi++) {
        if (str.indexOf(fullThaiMonths[mi]) >= 0 || str.indexOf(shortThaiMonths[mi]) >= 0) {
          month = mi + 1;
          break;
        }
      }
      var numMatch = str.match(/\b(25\d{2}|20\d{2})\b/) || str.match(/\d{4}/);
      if (numMatch) {
        var py = parseInt(numMatch[1] || numMatch[0], 10);
        if (py > 2400) py -= 543;
        yearCE = py;
      }
    }
  } else {
    var nowUtc = new Date();
    var bkk = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    yearCE = bkk.getFullYear();
    month = bkk.getMonth() + 1;
    var day = bkk.getDate();
    if (cutDay < 30 && day > cutDay) {
      month += 1;
      if (month > 12) {
        month = 1;
        yearCE += 1;
      }
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
      pVal = getActiveCutoffPeriodString();
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
    periodInput.value = getActiveCutoffPeriodString();
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
  loadAttendanceRequests();
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
      periodInput.value = getActiveCutoffPeriodString();
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

  if (_currentAttendanceEmpId !== 'ALL') {
    _currentAttendanceIsIndividual = true;
    _currentAttendanceSelectedEmpInfo = (_currentAttendanceEmployeeList || []).find(function(x) { return x.emp_id === _currentAttendanceEmpId; }) ||
                                        (State.employees || []).find(function(x) { return (x.emp_id || x.empId) === _currentAttendanceEmpId; }) ||
                                        { emp_id: _currentAttendanceEmpId, name: displayText || _currentAttendanceEmpId, full_name: displayText || _currentAttendanceEmpId };
    var btnPrint = document.getElementById('btnAttPrintTimesheet');
    if (btnPrint) btnPrint.style.display = 'inline-flex';
  } else {
    _currentAttendanceIsIndividual = false;
    _currentAttendanceSelectedEmpInfo = null;
    var btnPrint = document.getElementById('btnAttPrintTimesheet');
    if (btnPrint) btnPrint.style.display = 'none';
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
    var isResigned = (e.status === 'Resigned' || String(e.status).toUpperCase() === 'RESIGNED');
    var statusMatch = (q === 'ลาออก' || q === 'resigned') && isResigned;
    return idMatch || nameMatch || nickMatch || deptMatch || statusMatch;
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
      var isResigned = (e.status === 'Resigned' || String(e.status).toUpperCase() === 'RESIGNED');
      var displayName = (e.name || e.full_name || '') + (e.nickname ? ' (' + e.nickname + ')' : '');
      var displayFull = e.emp_id + ' - ' + displayName + (isResigned ? ' [ลาออก]' : '');

      html += '<div class="att-emp-item ' + (isSelected ? 'selected' : '') + '" onclick="selectAttendanceEmp(\'' + esc(e.emp_id) + '\', \'' + esc(displayFull) + '\')" style="padding:6px 10px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;background:' + (isSelected ? '#eff6ff' : 'transparent') + ';color:' + (isSelected ? '#1d4ed8' : '#0f172a') + ';font-size:12px;margin-bottom:1px;transition:background 0.15s" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'' + (isSelected ? '#eff6ff' : 'transparent') + '\'">' +
        '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          '<div style="font-weight:' + (isSelected ? '700' : '600') + ';overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px">' +
            '<span>' + esc(displayName) + '</span>' +
            (isResigned ? '<span style="background:#fee2e2;color:#b91c1c;padding:0px 5px;border-radius:4px;font-size:10px;font-weight:700">ลาออกแล้ว</span>' : '') +
          '</div>' +
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
      var isResigned = (e.status === 'Resigned' || String(e.status).toUpperCase() === 'RESIGNED');
      var resTag = isResigned ? ' [ลาออก]' : '';
      var display = e.emp_id + ' - ' + (e.name || e.full_name || '') + (e.nickname ? ' (' + e.nickname + ')' : '') + resTag;
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
        var isResigned = (found.status === 'Resigned' || String(found.status).toUpperCase() === 'RESIGNED');
        var resTag = isResigned ? ' [ลาออก]' : '';
        searchInput.value = found.emp_id + ' - ' + (found.name || found.full_name || '') + (found.nickname ? ' (' + found.nickname + ')' : '') + resTag;
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
      var isResigned = (e.status === 'Resigned' || String(e.status).toUpperCase() === 'RESIGNED');
      var resTag = isResigned ? ' [ลาออก]' : '';
      var display = e.emp_id + ' - ' + (e.name || e.full_name || '') + resTag;
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
        var isResigned = (foundReq.status === 'Resigned' || String(foundReq.status).toUpperCase() === 'RESIGNED');
        var resTag = isResigned ? ' [ลาออก]' : '';
        reqSearchInput.value = foundReq.emp_id + ' - ' + (foundReq.name || foundReq.full_name || '') + (foundReq.nickname ? ' (' + foundReq.nickname + ')' : '') + resTag;
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
  loadAttendanceRequests();
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
    var isResigned = (e.status === 'Resigned' || String(e.status).toUpperCase() === 'RESIGNED');
    var statusMatch = (q === 'ลาออก' || q === 'resigned') && isResigned;
    return idMatch || nameMatch || nickMatch || deptMatch || statusMatch;
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
      var isResigned = (e.status === 'Resigned' || String(e.status).toUpperCase() === 'RESIGNED');
      var displayName = (e.name || e.full_name || '') + (e.nickname ? ' (' + e.nickname + ')' : '');
      var displayFull = e.emp_id + ' - ' + displayName + (isResigned ? ' [ลาออก]' : '');

      html += '<div class="att-req-emp-item ' + (isSelected ? 'selected' : '') + '" onclick="selectAttendanceReqEmp(\'' + esc(e.emp_id) + '\', \'' + esc(displayFull) + '\')" style="padding:5px 8px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:6px;background:' + (isSelected ? '#eff6ff' : 'transparent') + ';color:' + (isSelected ? '#1d4ed8' : '#0f172a') + ';font-size:11.5px;margin-bottom:1px;transition:background 0.15s" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'' + (isSelected ? '#eff6ff' : 'transparent') + '\'">' +
        '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          '<div style="font-weight:' + (isSelected ? '700' : '600') + ';overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px">' +
            '<span>' + esc(displayName) + '</span>' +
            (isResigned ? '<span style="background:#fee2e2;color:#b91c1c;padding:0px 4px;border-radius:3px;font-size:9.5px;font-weight:700">ลาออก</span>' : '') +
          '</div>' +
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
      periodInput.value = getActiveCutoffPeriodString();
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

  loadAttendanceRequests();
}

function updateAttendanceReqPeriodBadge() {
  var periodInput = document.getElementById('attReqPeriod');
  var badge = document.getElementById('attReqPeriodCutoffBadge');
  if (badge) {
    var pVal = periodInput ? periodInput.value : '';
    if (!pVal) {
      pVal = getActiveCutoffPeriodString();
      if (periodInput) periodInput.value = pVal;
    }
    var info = getAttendanceCutoffDatesClient(pVal);
    badge.innerHTML = '<i class="fa-solid fa-arrows-rotate" style="font-size:9.5px"></i> ' + esc(info.label);
  }
}

function onAttendanceReqPeriodChanged() {
  updateAttendanceReqPeriodBadge();
  loadAttendanceRequests();
}

function setAttendanceReqPeriodCurrent() {
  var periodInput = document.getElementById('attReqPeriod');
  if (periodInput) {
    periodInput.value = getActiveCutoffPeriodString();
  }
  updateAttendanceReqPeriodBadge();
  loadAttendanceRequests();
}

function setAttendanceReqMonthCurrent() {
  var monthInput = document.getElementById('attReqMonth');
  if (monthInput) {
    var nowUtc = new Date();
    var bangkok = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    monthInput.value = bangkok.toISOString().substring(0, 7);
  }
  loadAttendanceRequests();
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

  loadAttendanceRequests();
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
  loadAttendanceRequests();
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

var _loadAttendanceRequestsSeq = 0;
function loadAttendanceRequests() {
  var currentSeq = ++_loadAttendanceRequestsSeq;
  var bulkToolbar = document.getElementById('attReqBulkToolbar');
  if (bulkToolbar) bulkToolbar.style.display = 'none';
  var container = document.getElementById('attPendingListContainer');
  if (container) {
    container.innerHTML = '<div class="text-muted text-center" style="padding:32px 16px;font-size:12.5px">' +
      '<i class="fa-solid fa-spinner fa-spin" style="font-size:26px;color:#2563eb;display:block;margin-bottom:8px"></i>' +
      '<div style="font-weight:700;color:#334155;font-size:13px">กำลังโหลดรายการคำขอ...</div>' +
      '<div style="font-size:11.5px;color:#64748b;margin-top:2px">กรุณารอสักครู่</div>' +
      '</div>';
  }

  var reqEmpId = (document.getElementById('attReqEmpFilter') && document.getElementById('attReqEmpFilter').value) || _currentAttendanceRequestEmpId || 'ALL';
  var reqDateMode = (document.getElementById('attReqDateMode') && document.getElementById('attReqDateMode').value) || _currentAttendanceRequestDateMode || 'ALL';
  var reqDate = (document.getElementById('attReqDate') && document.getElementById('attReqDate').value) || _currentAttendanceRequestDate || '';
  var reqMonth = (document.getElementById('attReqMonth') && document.getElementById('attReqMonth').value) || _currentAttendanceRequestMonth || '';
  var reqPeriod = (document.getElementById('attReqPeriod') && document.getElementById('attReqPeriod').value) || _currentAttendanceRequestPeriod || '';
  var reqStartDate = (document.getElementById('attReqStartDate') && document.getElementById('attReqStartDate').value) || _currentAttendanceRequestStartDate || '';
  var reqEndDate = (document.getElementById('attReqEndDate') && document.getElementById('attReqEndDate').value) || _currentAttendanceRequestEndDate || '';

  callApi('getAttendanceRequests', {
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
      if (currentSeq !== _loadAttendanceRequestsSeq) return;
      if (!r || !r.success) {
        if (container) {
          container.innerHTML = '<div class="text-center" style="padding:26px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px">' +
            '<i class="fa-solid fa-triangle-exclamation" style="font-size:24px;color:#ef4444;display:block;margin-bottom:8px"></i>' +
            '<div style="font-weight:700;color:#991b1b;font-size:13px">โหลดข้อมูลคำขอไม่สำเร็จ</div>' +
            '<div style="font-size:11.5px;color:#b91c1c;margin-top:2px">' + esc(r && r.message ? r.message : 'เกิดข้อผิดพลาดในการโหลด') + '</div>' +
            '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-primary" onclick="loadAttendanceRequests()"><i class="fa-solid fa-rotate-right"></i> กดเพื่อลองใหม่อีกครั้ง</button></div>' +
            '</div>';
        }
        return;
      }
      if (r.reqCutoffDates && r.reqCutoffDates.label) {
        var reqBadge = document.getElementById('attReqPeriodCutoffBadge');
        if (reqBadge) reqBadge.innerHTML = '<i class="fa-solid fa-arrows-rotate" style="font-size:9.5px"></i> ' + esc(r.reqCutoffDates.label);
      }
      renderTimeAttendanceApprovals(r.pendingLeaves || [], r.pendingOts || [], r.pendingAdvances || []);
    })
    .catch(function(err) {
      if (currentSeq !== _loadAttendanceRequestsSeq) return;
      if (container) {
        container.innerHTML = '<div class="text-center" style="padding:26px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px">' +
          '<i class="fa-solid fa-triangle-exclamation" style="font-size:24px;color:#ef4444;display:block;margin-bottom:8px"></i>' +
          '<div style="font-weight:700;color:#991b1b;font-size:13px">โหลดข้อมูลคำขอไม่สำเร็จ</div>' +
          '<div style="font-size:11.5px;color:#b91c1c;margin-top:2px">' + esc(err.message || err) + '</div>' +
          '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-primary" onclick="loadAttendanceRequests()"><i class="fa-solid fa-rotate-right"></i> กดเพื่อลองใหม่อีกครั้ง</button></div>' +
          '</div>';
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

var _loadAttendanceReqSeq = 0;
function loadTimeAttendanceDashboard() {
  var currentReqSeq = ++_loadAttendanceReqSeq;
  if (!isSuperAdmin() && !hasPermission('view_attendance')) {
    var defSubTab = getDefaultAuthorizedAttendanceSubTab();
    if (defSubTab) {
      switchAttendanceSubTab(defSubTab);
    } else {
      showToast('สิทธิ์ไม่เพียงพอ: หน้าลงเวลาสงวนสิทธิ์เฉพาะผู้มีสิทธิ์เข้าใช้งานระบบลงเวลาเท่านั้น', 'warning');
      navigateToAuthorizedTab();
    }
    renderBranchEarlyDismissalBar();
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
      if (currentReqSeq !== _loadAttendanceReqSeq) return;
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
      _currentAttendanceIsIndividual = Boolean(r.isIndividualView || (_currentAttendanceEmpId && _currentAttendanceEmpId !== 'ALL'));
      _currentAttendanceSelectedEmpInfo = r.selectedEmpInfo || r.selectedEmp || _currentAttendanceSelectedEmpInfo || null;

      if (_currentAttendanceSelectedEmpInfo) {
        if (!_currentAttendanceSelectedEmpInfo.name && _currentAttendanceSelectedEmpInfo.full_name) {
          _currentAttendanceSelectedEmpInfo.name = _currentAttendanceSelectedEmpInfo.full_name;
        }
        if (!_currentAttendanceSelectedEmpInfo.full_name && _currentAttendanceSelectedEmpInfo.name) {
          _currentAttendanceSelectedEmpInfo.full_name = _currentAttendanceSelectedEmpInfo.name;
        }
      }

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

      // 1. Update KPI (All 5 Cards)
      if (r.kpi) {
        var elIn = document.getElementById('attKpiClockedIn');
        var elNot = document.getElementById('attKpiNotClockedIn');
        var elLate = document.getElementById('attKpiLate');
        var elPend = document.getElementById('attKpiPending');
        var elTot = document.getElementById('attKpiTotal');
        if (elIn) elIn.innerHTML = (r.kpi.clockedIn || 0) + ' <span style="font-size:12px;font-weight:400;color:var(--text-muted)">คน</span>';
        if (elNot) elNot.innerHTML = (r.kpi.notClockedIn || 0) + ' <span style="font-size:12px;font-weight:400;color:var(--text-muted)">คน</span>';
        if (elLate) elLate.innerHTML = (r.kpi.late || 0) + ' <span style="font-size:12px;font-weight:400;color:var(--text-muted)">คน</span>';
        if (elPend) elPend.innerHTML = (r.kpi.pendingApprovals || 0) + ' <span style="font-size:12px;font-weight:400;color:var(--text-muted)">รายการ</span>';
        if (elTot) elTot.innerHTML = (r.kpi.totalEmployees || 0) + ' <span style="font-size:12px;font-weight:400;color:var(--text-muted)">คน</span>';
        var subBadge = document.getElementById('attSubTabBadgeApprovals');
        if (subBadge) {
          var pCount = (r.kpi && r.kpi.pendingApprovals) || 0;
          if (pCount > 0) {
            subBadge.textContent = pCount;
            subBadge.style.display = 'inline-block';
          } else {
            subBadge.style.display = 'none';
          }
        }
      }

      // Cache breakdown & pending datasets for clickable dashboard modal
      State.attendanceBreakdown = r.attendanceBreakdown || null;
      State.attendancePendingData = {
        leaves: r.pendingLeaves || [],
        ots: r.pendingOts || [],
        advances: r.pendingAdvances || []
      };
      State.attendanceDateDisplay = r.dateDisplay || r.date || r.today || '';

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

        // Dynamically toggle OT request controls in Approvals Center if company disabled OT requests
        var isOtReqEnabled = (r.settings.enable_ot_requests !== 'false');
        var optOtFilter = document.querySelector('#attReqTypeFilter option[value="OT"]');
        if (optOtFilter) {
          optOtFilter.style.display = isOtReqEnabled ? '' : 'none';
          if (!isOtReqEnabled && _currentAttendanceRequestType === 'OT') {
            _currentAttendanceRequestType = 'ALL';
            if (document.getElementById('attReqTypeFilter')) document.getElementById('attReqTypeFilter').value = 'ALL';
          }
        }
        var tabBtnCreateReqOt = document.getElementById('tabBtnCreateReq_OT');
        if (tabBtnCreateReqOt) {
          tabBtnCreateReqOt.style.display = isOtReqEnabled ? '' : 'none';
        }

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

        var setEnableSelfieGreetings = document.getElementById('attSetEnableSelfieGreetings');
        var setEnableClockIn = document.getElementById('attSetEnableClockInGreeting');
        var setEnableBreak = document.getElementById('attSetEnableBreakGreeting');
        var setEnableClockOut = document.getElementById('attSetEnableClockOutGreeting');
        var setEnableBirthday = document.getElementById('attSetEnableBirthdayGreeting');
        var setEnableSaturday = document.getElementById('attSetEnableSaturdayGreeting') || document.getElementById('attSetEnableFridayTgif');
        var setSelfieMessagesIn = document.getElementById('attSetSelfieCustomMessages');
        var setSelfieMessagesBreak = document.getElementById('attSetSelfieCustomMessagesBreak');
        var setSelfieMessagesOut = document.getElementById('attSetSelfieCustomMessagesOut');

        if (setEnableSelfieGreetings) {
          setEnableSelfieGreetings.checked = (r.settings.enable_selfie_greetings !== 'false');
          toggleSelfieGreetingsUI(setEnableSelfieGreetings.checked);
        }
        if (setEnableClockIn) setEnableClockIn.checked = (r.settings.enable_selfie_clockin_greetings !== 'false');
        if (setEnableBreak) setEnableBreak.checked = (r.settings.enable_selfie_break_greetings !== 'false');
        if (setEnableClockOut) setEnableClockOut.checked = (r.settings.enable_selfie_clockout_greetings !== 'false');
        if (setEnableBirthday) setEnableBirthday.checked = (r.settings.enable_birthday_greeting !== 'false');
        if (setEnableSaturday) setEnableSaturday.checked = (r.settings.enable_saturday_greeting !== undefined ? r.settings.enable_saturday_greeting !== 'false' : r.settings.enable_friday_tgif !== 'false');

        if (setSelfieMessagesIn) {
          setSelfieMessagesIn.value = r.settings.selfie_custom_messages !== undefined ? r.settings.selfie_custom_messages : 'สวัสดีตอนเช้าค่ะ วันนี้ยิ้มสดใสมาก ขอให้เป็นวันที่ราบรื่นและมีความสุขนะคะ 🌸\nพร้อมลุยงานวันนี้! ยิ้มรับลูกค้าด้วยหัวใจบริการค่ะ ✨\nเริ่มต้นวันใหม่ด้วยพลังบวก ขอให้การทำงานวันนี้ราบรื่นสำเร็จทุกสิ่งนะคะ 💖';
        }
        if (setSelfieMessagesBreak) {
          setSelfieMessagesBreak.value = r.settings.selfie_custom_messages_break !== undefined ? r.settings.selfie_custom_messages_break : 'ทานอาหารกลางวันให้อร่อยนะคะ ชาร์จพลังให้เต็มที่ 🍜🍱\nพักสายตาและผ่อนคลายความเหนื่อยล้าสักครู่ค่ะ ☕🍰\nชาร์จพลังเต็มที่แล้ว พร้อมลุยงานช่วงบ่ายอย่างสดชื่นค่ะ 💪✨';
        }
        if (setSelfieMessagesOut) {
          setSelfieMessagesOut.value = r.settings.selfie_custom_messages_out !== undefined ? r.settings.selfie_custom_messages_out : 'ขอบคุณสำหรับความทุ่มเทในวันนี้นะคะ ทำงานเหนื่อยมาทั้งวันแล้ว เก่งมากๆ ค่ะ 👏💖\nเดินทางกลับบ้านโดยสวัสดิภาพนะคะ พักผ่อนให้เต็มที่ พรุ่งนี้พบกันใหม่ค่ะ 🚗🏠\nทำงานสำเร็จไปอีกวันแล้ว วันนี้คุณทำได้ยอดเยี่ยมมากค่ะ 🌟';
        }
      }

      // 4. Render Tables & Approvals
      renderTimeAttendanceTodayLogs(_currentAttendanceLogs, _currentAttendanceIsIndividual);
      renderTimeAttendanceApprovals(r.pendingLeaves || [], r.pendingOts || [], r.pendingAdvances || []);
      renderBranchManagerTable();

      var kpiModal = document.getElementById('modalAttendanceKpiDetails');
      if (kpiModal && kpiModal.classList.contains('active')) {
        renderAttendanceKpiModalList();
      }

      // Reset selection
      var masterCb = document.getElementById('attSelectAllLogs');
      if (masterCb) masterCb.checked = false;
      updateAttendanceBatchToolbar();
    })
    .catch(function(err) {
      if (currentReqSeq !== _loadAttendanceReqSeq) return;
      if (logsBody) {
        logsBody.innerHTML = '<tr><td colspan="14" class="text-center text-red" style="padding:24px;background:#fef2f2"><i class="fa-solid fa-triangle-exclamation" style="font-size:22px;display:block;margin-bottom:6px"></i>โหลดข้อมูลไม่สำเร็จ: ' + (err.message || err) + '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-primary" onclick="loadTimeAttendanceDashboard()" style="padding:5px 14px;font-size:12px;font-weight:600;border-radius:6px"><i class="fa-solid fa-rotate-right"></i> กดเพื่อลองใหม่อีกครั้ง</button></div></td></tr>';
      }
      var pendingBox = document.getElementById('attPendingListContainer');
      if (pendingBox && _activeAttendanceSubTab === 'approvals') {
        pendingBox.innerHTML = '<div class="text-center" style="padding:26px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px"><i class="fa-solid fa-triangle-exclamation" style="font-size:24px;color:#ef4444;display:block;margin-bottom:8px"></i><div style="font-weight:700;color:#991b1b;font-size:13px">โหลดข้อมูลไม่สำเร็จ: ' + esc(err.message || err) + '</div><div style="margin-top:10px"><button type="button" class="btn btn-sm btn-primary" onclick="loadAttendanceRequests()"><i class="fa-solid fa-rotate-right"></i> กดเพื่อลองใหม่อีกครั้ง</button></div></div>';
      }
    });
}

var _activeAttendanceSubTab = 'logs';
function switchAttendanceSubTab(tabName) {
  var tabs = ['logs', 'summary', 'approvals', 'ai_inspector', 'settings', 'branches'];
  if (tabs.indexOf(tabName) === -1) tabName = 'logs';

  var canViewLogs = isSuperAdmin() || hasPermission('view_attendance');
  var canApprove = isSuperAdmin() || hasPermission('approve_attendance') || hasPermission('create_attendance_requests');
  var canManageSettings = isSuperAdmin() || hasPermission('manage_attendance_settings');

  // Permission guards
  if ((tabName === 'logs' || tabName === 'summary' || tabName === 'ai_inspector') && !canViewLogs) {
    var defTab = getDefaultAuthorizedAttendanceSubTab();
    if (defTab && defTab !== tabName) {
      showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดูหน้าบันทึกเวลาประจำวัน', 'warning');
      switchAttendanceSubTab(defTab);
      return;
    }
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดูหน้าบันทึกเวลาประจำวัน', 'warning');
    return;
  }

  if (tabName === 'approvals' && !canApprove) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานศูนย์อนุมัติคำขอ', 'warning');
    return;
  }

  if ((tabName === 'branches' || tabName === 'settings') && !canManageSettings) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการสาขาหรือตั้งค่าระบบ', 'warning');
    return;
  }

  _activeAttendanceSubTab = tabName;

  tabs.forEach(function(t) {
    var btn = document.getElementById('attSubTabBtn_' + t);
    var pane = document.getElementById('attSubTabPane_' + t);
    if (btn) {
      if (t === tabName) {
        if (t === 'ai_inspector') {
          btn.style.background = 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)';
          btn.style.color = '#ffffff';
          btn.style.borderColor = '#818cf8';
          btn.style.fontWeight = '700';
          btn.style.boxShadow = '0 2px 6px rgba(79,70,229,0.35)';
        } else {
          btn.style.background = '#2563eb';
          btn.style.color = '#ffffff';
          btn.style.borderColor = '#1d4ed8';
          btn.style.fontWeight = '700';
          btn.style.boxShadow = '0 1px 3px rgba(37,99,235,0.25)';
        }
      } else {
        btn.style.background = '#ffffff';
        btn.style.color = (t === 'ai_inspector') ? '#4338ca' : '#475569';
        btn.style.borderColor = (t === 'ai_inspector') ? '#c7d2fe' : '#cbd5e1';
        btn.style.fontWeight = (t === 'ai_inspector') ? '700' : '600';
        btn.style.boxShadow = 'none';
      }
    }
    if (pane) {
      pane.style.display = (t === tabName) ? 'block' : 'none';
    }
  });

  if (tabName === 'summary') {
    initAttendanceSummaryPeriodOptions();
    loadAttendancePeriodSummary();
  } else if (tabName === 'ai_inspector') {
    initAiInspectorPeriodOptions();
    loadAiAttendanceInspector();
  } else if (tabName === 'approvals') {
    if (State.attendanceCurrentRequests) {
      renderTimeAttendanceApprovals(
        State.attendanceCurrentRequests.leave || [],
        State.attendanceCurrentRequests.ot || [],
        State.attendanceCurrentRequests.advance || []
      );
    }
    loadAttendanceRequests();
  } else if (tabName === 'branches') {
    renderBranchManagerTable();
  }
}

/* ========================================================================
   ATTENDANCE PERIOD SUMMARY & REPORTS (ALL EMPLOYEES & INDIVIDUAL)
   ======================================================================== */
State.attendancePeriodSummaryData = null;
State.activeAttendanceSummaryView = 'ALL';
State.activeAttendanceSummarySingleEmpId = null;

function initAttendanceSummaryPeriodOptions() {
  var selPeriod = document.getElementById('attSumPeriodSelect');
  var selBranch = document.getElementById('attSumBranchSelect');
  if (!selPeriod) return;

  // 1. Populate period dropdown if empty
  if (selPeriod.options.length <= 1) {
    var thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    var fullThaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    var nowUtc = new Date();
    var bkk = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    var curY = bkk.getFullYear();
    var curM = bkk.getMonth() + 1; // 1-12
    var curD = bkk.getDate();

    // If today is past the cutoff day (day > 25), the active period being clocked in right now is NEXT month!
    if (curD > 25) {
      curM += 1;
      if (curM > 12) {
        curM = 1;
        curY += 1;
      }
    }

    selPeriod.innerHTML = '';
    // Generate 8 recent periods starting from the current active clock-in period
    for (var i = 0; i < 8; i++) {
      var y = curY;
      var m = curM - i;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      var ymStr = y + '-' + String(m).padStart(2, '0');
      var prevM = m - 1;
      var prevY = y;
      if (prevM < 1) {
        prevM = 12;
        prevY -= 1;
      }
      var thYear = y + 543;
      var prevThYear = prevY + 543;

      var isCurrentActive = (i === 0);
      var currentBadge = isCurrentActive ? ' ⭐ [งวดปัจจุบัน - กำลังลงเวลา]' : '';
      var label = 'งวด ' + fullThaiMonths[m - 1] + ' ' + thYear + ' (26 ' + thaiMonths[prevM - 1] + ' - 25 ' + thaiMonths[m - 1] + ')' + currentBadge;

      var opt = document.createElement('option');
      opt.value = ymStr;
      opt.textContent = label;
      if (isCurrentActive) {
        opt.selected = true;
        opt.style.fontWeight = '700';
        opt.style.color = '#059669';
      }
      selPeriod.appendChild(opt);
    }
  }

  // 2. Populate branches dropdown if empty or has only ALL
  if (selBranch && selBranch.options.length <= 1) {
    var bList = State.branches || (State.attendanceDashboardData ? State.attendanceDashboardData.branches : []);
    if (bList && bList.length) {
      selBranch.innerHTML = '<option value="ALL">🏢 ทุกสาขา (All)</option>';
      bList.forEach(function(b) {
        var opt = document.createElement('option');
        opt.value = b.branch_id;
        opt.textContent = b.branch_name + ' (' + b.branch_id + ')';
        selBranch.appendChild(opt);
      });
    }
  }
}

function onAttendanceSummaryPeriodChange() {
  loadAttendancePeriodSummary();
}

function switchAttendanceSummaryView(viewMode) {
  State.activeAttendanceSummaryView = viewMode;
  var btnAll = document.getElementById('attSumViewBtn_all');
  var btnSingle = document.getElementById('attSumViewBtn_single');
  var boxAll = document.getElementById('attSumAllContainer');
  var boxSingle = document.getElementById('attSumSingleContainer');
  var singlePicker = document.getElementById('attSumSingleEmpPickerWrapper');
  var printBtnText = document.getElementById('attSumPrintBtnText');

  if (viewMode === 'ALL') {
    if (btnAll) {
      btnAll.style.background = '#2563eb';
      btnAll.style.color = '#ffffff';
      btnAll.style.fontWeight = '700';
      btnAll.style.boxShadow = '0 1px 2px rgba(37,99,235,0.2)';
    }
    if (btnSingle) {
      btnSingle.style.background = 'transparent';
      btnSingle.style.color = '#475569';
      btnSingle.style.fontWeight = '600';
      btnSingle.style.boxShadow = 'none';
    }
    if (boxAll) boxAll.style.display = 'block';
    if (boxSingle) boxSingle.style.display = 'none';
    if (singlePicker) singlePicker.style.display = 'none';
    if (printBtnText) printBtnText.textContent = 'พิมพ์สรุปรวม (A4)';
  } else {
    if (btnAll) {
      btnAll.style.background = 'transparent';
      btnAll.style.color = '#475569';
      btnAll.style.fontWeight = '600';
      btnAll.style.boxShadow = 'none';
    }
    if (btnSingle) {
      btnSingle.style.background = '#2563eb';
      btnSingle.style.color = '#ffffff';
      btnSingle.style.fontWeight = '700';
      btnSingle.style.boxShadow = '0 1px 2px rgba(37,99,235,0.2)';
    }
    if (boxAll) boxAll.style.display = 'none';
    if (boxSingle) boxSingle.style.display = 'block';
    if (singlePicker) singlePicker.style.display = 'inline-block';
    if (printBtnText) printBtnText.textContent = 'พิมพ์รายบุคคล (A4)';

    if (State.attendancePeriodSummaryData && State.attendancePeriodSummaryData.summaryList && State.attendancePeriodSummaryData.summaryList.length) {
      if (!State.activeAttendanceSummarySingleEmpId) {
        State.activeAttendanceSummarySingleEmpId = State.attendancePeriodSummaryData.summaryList[0].empId;
      }
      var empSel = document.getElementById('attSumSingleEmpSelect');
      if (empSel) empSel.value = State.activeAttendanceSummarySingleEmpId;
      renderIndividualAttendanceSheet(State.activeAttendanceSummarySingleEmpId);
    }
  }
}

function onAttendanceSummarySingleEmpChange() {
  var empSel = document.getElementById('attSumSingleEmpSelect');
  if (empSel && empSel.value) {
    State.activeAttendanceSummarySingleEmpId = empSel.value;
    renderIndividualAttendanceSheet(empSel.value);
  }
}

function viewSingleEmpAttendance(empId) {
  State.activeAttendanceSummarySingleEmpId = empId;
  switchAttendanceSummaryView('SINGLE');
}

function loadAttendancePeriodSummary() {
  var selPeriod = document.getElementById('attSumPeriodSelect');
  var selBranch = document.getElementById('attSumBranchSelect');
  var period = selPeriod ? selPeriod.value : '';
  var branchId = selBranch ? selBranch.value : 'ALL';

  var tbody = document.getElementById('attSumTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="13" class="text-center text-muted" style="padding:28px"><i class="fa-solid fa-spinner fa-spin" style="font-size:20px;display:block;margin-bottom:8px"></i> กำลังโหลดรายงานสรุปเวลาทำงาน...</td></tr>';
  }

  callApi('getAttendancePeriodSummary', {
    period: period,
    branchId: branchId,
    username: (State.currentUser && State.currentUser.username) ? State.currentUser.username : 'Admin',
    _nocache: Date.now()
  })
  .then(function(res) {
    if (!res.success) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="13" class="text-center text-red" style="padding:24px"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(res.message || 'โหลดข้อมูลไม่สำเร็จ') + '</td></tr>';
      }
      return;
    }
    State.attendancePeriodSummaryData = res;

    // Populate branch select if empty
    if (res.branches && res.branches.length && selBranch && selBranch.options.length <= 1) {
      selBranch.innerHTML = '<option value="ALL">🏢 ทุกสาขา (All)</option>';
      res.branches.forEach(function(b) {
        var opt = document.createElement('option');
        opt.value = b.branch_id;
        opt.textContent = b.branch_name + ' (' + b.branch_id + ')';
        selBranch.appendChild(opt);
      });
      selBranch.value = res.branchId || 'ALL';
    }

    // Populate single employee select
    var empSel = document.getElementById('attSumSingleEmpSelect');
    if (empSel && res.summaryList) {
      var prevVal = empSel.value || State.activeAttendanceSummarySingleEmpId;
      empSel.innerHTML = '';
      res.summaryList.forEach(function(e) {
        var opt = document.createElement('option');
        opt.value = e.empId;
        var isResigned = (e.status === 'Resigned' || String(e.status).toUpperCase() === 'RESIGNED' || (State.employees || []).some(function(x) { return (x.empId || x.emp_id) === e.empId && String(x.status).toUpperCase() === 'RESIGNED'; }));
        var resTag = isResigned ? ' [ลาออก]' : '';
        opt.textContent = e.empId + ' - ' + e.fullName + (e.nickname && e.nickname !== '-' ? ' (' + e.nickname + ')' : '') + resTag;
        empSel.appendChild(opt);
      });
      if (prevVal && res.summaryList.some(function(x) { return x.empId === prevVal; })) {
        State.activeAttendanceSummarySingleEmpId = prevVal;
        empSel.value = prevVal;
      } else if (res.summaryList.length) {
        State.activeAttendanceSummarySingleEmpId = res.summaryList[0].empId;
        empSel.value = res.summaryList[0].empId;
      }
    }

    renderAttendancePeriodSummary(res);
  })
  .catch(function(err) {
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="13" class="text-center text-red" style="padding:24px"><i class="fa-solid fa-triangle-exclamation"></i> ข้อผิดพลาด: ' + esc(err.message || err) + '</td></tr>';
    }
  });
}

function renderAttendancePeriodSummary(data) {
  if (!data) return;
  var cutoff = data.cutoffInfo || {};
  var grand = data.grandTotals || {};
  var list = data.summaryList || [];

  // 1. Header info
  var cutoffEl = document.getElementById('attSumCutoffText');
  if (cutoffEl) {
    var activeTag = cutoff.isCurrentActivePeriod
      ? ' <span style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px;margin-left:6px"><i class="fa-solid fa-circle-dot" style="color:#10b981;font-size:8px"></i> กำลังลงเวลางวดนี้อยู่</span>'
      : '';
    cutoffEl.innerHTML = 'รอบงวด: <strong>' + esc(cutoff.startDate || '-') + ' ถึง ' + esc(cutoff.endDate || '-') + '</strong> (วันทำงานตามเกณฑ์ ' + (cutoff.totalExpectedWorkDays || 26) + ' วัน)' + activeTag;
  }
  var printDateEl = document.getElementById('attSumPrintDate');
  if (printDateEl) {
    var nowUtc = new Date();
    var bkk = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
    printDateEl.textContent = bkk.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // 2. Top KPI Cards
  var kpiStaff = document.getElementById('attSumKpiStaff');
  var kpiAbsent = document.getElementById('attSumKpiAbsent');
  var kpiLate = document.getElementById('attSumKpiLate');
  var kpiOt = document.getElementById('attSumKpiOt');

  if (kpiStaff) kpiStaff.textContent = (grand.totalEmployees || list.length) + ' คน';
  if (kpiAbsent) kpiAbsent.textContent = (grand.totalAbsentDays || 0) + ' วัน (' + (grand.totalAbsentTimes || 0) + ' ครั้ง)';
  if (kpiLate) kpiLate.textContent = (grand.totalLateTimes || 0) + ' ครั้ง (' + (grand.totalLateMinutes || 0) + ' นาที)';
  if (kpiOt) kpiOt.textContent = (grand.totalOtHours || 0) + ' ชม.';

  // 3. Render Master Table
  var tbody = document.getElementById('attSumTableBody');
  var tfoot = document.getElementById('attSumTableFoot');

  if (tbody) {
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="13" class="text-center text-muted" style="padding:28px">ไม่พบข้อมูลพนักงานในสาขาหรือรอบงวดนี้</td></tr>';
    } else {
      var html = '';
      list.forEach(function(r) {
        var diligenceBadge = r.isDiligenceQualified
          ? '<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:12px;font-weight:700;font-size:11px;display:inline-block" title="ได้รับเบี้ยขยัน ฿' + (r.diligenceAmount || 1000).toLocaleString() + '"><i class="fa-solid fa-circle-check"></i> ได้รับ</span>'
          : '<span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:12px;font-weight:700;font-size:11px;display:inline-block" title="' + esc(r.diligenceDisqualifyReason || 'ไม่ผ่านเกณฑ์') + '"><i class="fa-solid fa-circle-xmark"></i> หลุดสิทธิ์</span>';

        var pDays = Math.round((Number(r.presentDays) || 0) * 100) / 100;
        var aDays = Math.round((Number(r.absentDays) || 0) * 100) / 100;
        var scDays = Math.round((Number(r.sickWithCertDays) || 0) * 100) / 100;
        var sncDays = Math.round((Number(r.sickNoCertDays) || 0) * 100) / 100;
        var bDays = Math.round((Number(r.businessLeaveDays) || 0) * 100) / 100;

        var isResigned = (r.status === 'Resigned' || String(r.status).toUpperCase() === 'RESIGNED' || (State.employees || []).some(function(x) { return (x.empId || x.emp_id) === r.empId && String(x.status).toUpperCase() === 'RESIGNED'; }));
        var resBadge = isResigned ? ' <span style="background:#fee2e2;color:#b91c1c;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700">ลาออก</span>' : '';

        html += '<tr style="border-bottom:1px solid #e2e8f0;text-align:center;font-size:12px;height:38px">';
        html += '<td class="sticky-col" style="border:1px solid #cbd5e1;padding:6px;color:#64748b;left:0;width:40px;min-width:40px;max-width:40px">' + r.no + '</td>';
        html += '<td class="sticky-col" style="border:1px solid #cbd5e1;padding:6px;font-family:monospace;font-weight:700;color:#1e40af;left:40px;width:65px;min-width:65px;max-width:65px">' + esc(r.empId) + '</td>';
        html += '<td class="sticky-col sticky-col-divider" style="border:1px solid #cbd5e1;padding:6px 8px;text-align:left;left:105px;min-width:160px"><strong style="color:#0f172a;cursor:pointer" onclick="viewSingleEmpAttendance(\'' + esc(r.empId) + '\')">' + esc(r.fullName) + '</strong>' + (r.nickname && r.nickname !== '-' ? ' <span style="color:#64748b">(' + esc(r.nickname) + ')</span>' : '') + resBadge + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:6px;text-align:left;color:#334155;white-space:nowrap">' + esc(r.branchName) + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:6px;background:#eff6ff;color:#1e40af;font-weight:800">' + pDays + ' / ' + r.expectedWorkDays + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:6px;background:#fef2f2;color:' + (aDays > 0 ? '#b91c1c;font-weight:700' : '#64748b') + '">' + (aDays > 0 ? (aDays + ' วัน (' + r.absentTimes + ' ครั้ง)') : '-') + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:6px;background:#f0f9ff;color:' + (scDays > 0 ? '#0369a1;font-weight:700' : '#64748b') + '">' + (scDays > 0 ? (scDays + ' วัน (' + r.sickWithCertTimes + ' ครั้ง)') : '-') + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:6px;background:#fffbeb;color:' + (sncDays > 0 ? '#b45309;font-weight:700' : '#64748b') + '">' + (sncDays > 0 ? (sncDays + ' วัน (' + r.sickNoCertTimes + ' ครั้ง)') : '-') + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:6px;background:#faf5ff;color:' + (bDays > 0 ? '#6d28d9;font-weight:700' : '#64748b') + '">' + (bDays > 0 ? (bDays + ' วัน (' + r.businessLeaveTimes + ' ครั้ง)') : '-') + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:6px;background:#fff7ed;color:' + (r.lateTimes > 0 ? '#c2410c;font-weight:800' : '#64748b') + '">' + (r.lateTimes > 0 ? (r.lateTimes + ' ครั้ง (' + r.lateMinutes + ' น.)') : '-') + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:6px;background:#eef2ff;color:' + (r.otHours > 0 ? '#4338ca;font-weight:800' : '#64748b') + '">' + (r.otHours > 0 ? (r.otHours + ' ชม.') : '-') + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:6px">' + diligenceBadge + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:6px" class="no-print"><button type="button" class="btn btn-slate btn-sm" onclick="viewSingleEmpAttendance(\'' + esc(r.empId) + '\')" style="padding:2px 8px;font-size:11px"><i class="fa-solid fa-eye text-blue"></i></button></td>';
        html += '</tr>';
      });
      tbody.innerHTML = html;
    }
  }

  // 4. Render Table Footer (Grand Totals)
  if (tfoot) {
    var footHtml = '<tr style="border-top:2px solid #94a3b8;font-size:12px;height:42px">';
    footHtml += '<td colspan="4" style="border:1px solid #cbd5e1;padding:8px;text-align:right;font-weight:800">รวมยอดทั้งสิ้น (' + list.length + ' คน):</td>';
    footHtml += '<td style="border:1px solid #cbd5e1;padding:8px;background:#eff6ff;color:#1e40af;font-weight:800">' + (Math.round((Number(grand.totalPresentDays) || 0) * 100) / 100) + ' วัน</td>';
    footHtml += '<td style="border:1px solid #cbd5e1;padding:8px;background:#fef2f2;color:#991b1b;font-weight:800">' + (Math.round((Number(grand.totalAbsentDays) || 0) * 100) / 100) + ' วัน (' + (grand.totalAbsentTimes || 0) + ' ครั้ง)</td>';
    footHtml += '<td style="border:1px solid #cbd5e1;padding:8px;background:#f0f9ff;color:#075985;font-weight:800">' + (Math.round((Number(grand.totalSickWithCertDays) || 0) * 100) / 100) + ' วัน (' + (grand.totalSickWithCertTimes || 0) + ' ครั้ง)</td>';
    footHtml += '<td style="border:1px solid #cbd5e1;padding:8px;background:#fffbeb;color:#92400e;font-weight:800">' + (Math.round((Number(grand.totalSickNoCertDays) || 0) * 100) / 100) + ' วัน (' + (grand.totalSickNoCertTimes || 0) + ' ครั้ง)</td>';
    footHtml += '<td style="border:1px solid #cbd5e1;padding:8px;background:#faf5ff;color:#6b21a8;font-weight:800">' + (Math.round((Number(grand.totalBusinessDays) || 0) * 100) / 100) + ' วัน (' + (grand.totalBusinessTimes || 0) + ' ครั้ง)</td>';
    footHtml += '<td style="border:1px solid #cbd5e1;padding:8px;background:#fff7ed;color:#9a3412;font-weight:800">' + (grand.totalLateTimes || 0) + ' ครั้ง (' + (grand.totalLateMinutes || 0) + ' น.)</td>';
    footHtml += '<td style="border:1px solid #cbd5e1;padding:8px;background:#eef2ff;color:#3730a3;font-weight:800">' + (grand.totalOtHours || 0) + ' ชม.</td>';
    footHtml += '<td style="border:1px solid #cbd5e1;padding:8px;font-size:11px;font-weight:700">ผ่าน ' + (grand.diligencePassedCount || 0) + '<br><span style="color:#b91c1c">ตก ' + (grand.diligenceFailedCount || 0) + '</span></td>';
    footHtml += '<td style="border:1px solid #cbd5e1;padding:8px" class="no-print">-</td>';
    footHtml += '</tr>';
    tfoot.innerHTML = footHtml;
  }

  // 5. Update Single View if currently active
  if (State.activeAttendanceSummaryView === 'SINGLE') {
    renderIndividualAttendanceSheet(State.activeAttendanceSummarySingleEmpId);
  }
}

function renderIndividualAttendanceSheet(empId) {
  if (!State.attendancePeriodSummaryData || !State.attendancePeriodSummaryData.summaryList) return;
  var list = State.attendancePeriodSummaryData.summaryList;
  var cutoff = State.attendancePeriodSummaryData.cutoffInfo || {};
  var emp = list.find(function(e) { return e.empId === empId; });
  if (!emp) {
    if (list.length) emp = list[0];
    else return;
  }

  // Header & Info
  var cutEl = document.getElementById('attSingleCutoffText');
  if (cutEl) {
    var activeTag = cutoff.isCurrentActivePeriod
      ? ' <span style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px;margin-left:6px"><i class="fa-solid fa-circle-dot" style="color:#10b981;font-size:8px"></i> กำลังลงเวลางวดนี้อยู่</span>'
      : '';
    cutEl.innerHTML = 'รอบงวด: <strong>' + esc(cutoff.startDate || '-') + ' ถึง ' + esc(cutoff.endDate || '-') + '</strong> (วันทำงานตามเกณฑ์ ' + (cutoff.totalExpectedWorkDays || 26) + ' วัน)' + activeTag;
  }
  
  var idEl = document.getElementById('attSingleEmpId');
  var nameEl = document.getElementById('attSingleFullName');
  var nickEl = document.getElementById('attSingleNickname');
  var branchEl = document.getElementById('attSingleBranch');
  var signEmpEl = document.getElementById('attSingleSignEmpName');

  var isResigned = (emp.status === 'Resigned' || String(emp.status).toUpperCase() === 'RESIGNED' || (State.employees || []).some(function(x) { return (x.empId || x.emp_id) === emp.empId && String(x.status).toUpperCase() === 'RESIGNED'; }));
  var resBadge = isResigned ? ' <span style="background:#fee2e2;color:#b91c1c;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;margin-left:6px">พ้นสภาพ/ลาออกแล้ว</span>' : '';

  if (idEl) idEl.textContent = emp.empId;
  if (nameEl) nameEl.innerHTML = esc(emp.fullName) + resBadge;
  if (nickEl) nickEl.textContent = emp.nickname || '-';
  if (branchEl) branchEl.textContent = emp.branchName + ' (' + emp.branchId + ')';
  if (signEmpEl) signEmpEl.textContent = emp.fullName;

  // Stat Boxes
  var presEl = document.getElementById('attSinglePresent');
  var absEl = document.getElementById('attSingleAbsent');
  var scEl = document.getElementById('attSingleSickCert');
  var sncEl = document.getElementById('attSingleSickNoCert');
  var busEl = document.getElementById('attSingleBusiness');
  var lateEl = document.getElementById('attSingleLate');
  var otEl = document.getElementById('attSingleOt');

  if (presEl) presEl.textContent = (Math.round((Number(emp.presentDays) || 0) * 100) / 100) + ' / ' + emp.expectedWorkDays + ' วัน';
  if (absEl) absEl.textContent = (Math.round((Number(emp.absentDays) || 0) * 100) / 100) + ' วัน (' + emp.absentTimes + ' ครั้ง)';
  if (scEl) scEl.textContent = (Math.round((Number(emp.sickWithCertDays) || 0) * 100) / 100) + ' วัน (' + emp.sickWithCertTimes + ' ครั้ง)';
  if (sncEl) sncEl.textContent = (Math.round((Number(emp.sickNoCertDays) || 0) * 100) / 100) + ' วัน (' + emp.sickNoCertTimes + ' ครั้ง)';
  if (busEl) busEl.textContent = (Math.round((Number(emp.businessLeaveDays) || 0) * 100) / 100) + ' วัน (' + emp.businessLeaveTimes + ' ครั้ง)';
  if (lateEl) lateEl.textContent = emp.lateTimes + ' ครั้ง (' + emp.lateMinutes + ' น.)';
  if (otEl) otEl.textContent = (Math.round((Number(emp.otHours) || 0) * 100) / 100) + ' ชม.';

  // Daily punch table
  var tbody = document.getElementById('attSingleDailyLogsBody');
  if (tbody) {
    var recs = emp.dailyRecords || [];
    if (!recs.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:16px">ไม่มีบันทึกเวลา</td></tr>';
    } else {
      var html = '';
      recs.forEach(function(r) {
        var dayColor = (r.dayOfWeek === 'อา.' || r.dayOfWeek === 'Sun') ? '#dc2626' : '#1e293b';
        var clockInText = (r.clockIn && r.clockIn !== '-') ? r.clockIn : '-';
        var clockOutText = (r.clockOut && r.clockOut !== '-') ? r.clockOut : '-';
        var clockInColor = (clockInText !== '-') ? '#0f172a' : '#94a3b8';
        var clockOutColor = (clockOutText !== '-') ? '#0f172a' : '#94a3b8';

        html += '<tr style="border-bottom:1px solid #f1f5f9;height:32px;color:#0f172a">';
        html += '<td style="border:1px solid #cbd5e1;padding:5px;font-family:monospace;font-weight:700;color:#0f172a;font-size:12px">' + r.date.substring(5) + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:5px;color:' + dayColor + ';font-weight:700">' + r.dayOfWeek + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:5px;font-family:monospace;font-weight:700;color:' + clockInColor + ';font-size:12px">' + esc(clockInText) + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:5px;font-family:monospace;font-weight:700;color:' + clockOutColor + ';font-size:12px">' + esc(clockOutText) + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:5px;color:' + (r.lateMinutes > 0 ? '#c2410c;font-weight:800' : '#64748b;font-weight:600') + ';font-family:monospace;font-size:12px">' + (r.lateMinutes > 0 ? r.lateMinutes : '-') + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:5px;color:' + (r.otHours > 0 ? '#4338ca;font-weight:800' : '#64748b;font-weight:600') + ';font-family:monospace;font-size:12px">' + (r.otHours > 0 ? r.otHours : '-') + '</td>';
        var statusHtml = esc(r.statusText);
        if (r.missingBreak || (r.statusText && r.statusText.indexOf('ไม่สแกนพัก') >= 0)) {
          statusHtml = statusHtml.replace('[⚠️ ไม่สแกนพัก]', '<span class="period-pill" style="background:#fef3c7;color:#b45309;border-color:#fde68a;font-size:10.5px;font-weight:700;margin-left:4px">⚠️ ไม่สแกนพัก</span>');
        }
        html += '<td style="border:1px solid #cbd5e1;padding:5px;text-align:left;color:' + r.statusColor + ';font-weight:700">' + statusHtml + '</td>';
        html += '<td style="border:1px solid #cbd5e1;padding:5px;text-align:left;color:#334155;font-size:11px">' + esc(r.remark || '-') + '</td>';
        html += '</tr>';
      });
      tbody.innerHTML = html;
    }
  }
}

function exportAttendanceSummaryCsv() {
  if (!State.attendancePeriodSummaryData || !State.attendancePeriodSummaryData.summaryList || !State.attendancePeriodSummaryData.summaryList.length) {
    showToast('ไม่มีข้อมูลสำหรับส่งออก', 'warning');
    return;
  }
  var data = State.attendancePeriodSummaryData;
  var list = data.summaryList;
  var cutoff = data.cutoffInfo || {};

  var headers = [
    'ลำดับ',
    'รหัสพนักงาน',
    'ชื่อ-นามสกุล',
    'ชื่อเล่น',
    'สาขา',
    'แผนก',
    'ตำแหน่ง',
    'มาทำงาน (วัน)',
    'วันทำงานตามเกณฑ์ (วัน)',
    'ขาดงาน (วัน)',
    'ขาดงาน (ครั้ง)',
    'ลาป่วยมีใบรับรองแพทย์ (วัน)',
    'ลาป่วยมีใบรับรองแพทย์ (ครั้ง)',
    'ลาป่วยไม่มีใบรับรองแพทย์ (วัน)',
    'ลาป่วยไม่มีใบรับรองแพทย์ (ครั้ง)',
    'ลากิจ (วัน)',
    'ลากิจ (ครั้ง)',
    'มาสาย (ครั้ง)',
    'มาสายรวม (นาที)',
    'OT รวม (ชั่วโมง)',
    'สถานะเบี้ยขยัน',
    'จำนวนเงินเบี้ยขยัน (บาท)',
    'เหตุผลหลุดสิทธิ์เบี้ยขยัน'
  ];

  var rows = [];
  rows.push(headers.join(','));

  list.forEach(function(r) {
    var escapeCsv = function(val) {
      if (val === null || val === undefined) return '""';
      var s = String(val).replace(/"/g, '""');
      return '"' + s + '"';
    };

    var row = [
      r.no,
      escapeCsv(r.empId),
      escapeCsv(r.fullName),
      escapeCsv(getEmpNickname(r.empId, r.nickname)),
      escapeCsv(r.branchName),
      escapeCsv(r.department),
      escapeCsv(r.position),
      r.presentDays,
      r.expectedWorkDays,
      r.absentDays,
      r.absentTimes,
      r.sickWithCertDays,
      r.sickWithCertTimes,
      r.sickNoCertDays,
      r.sickNoCertTimes,
      r.businessLeaveDays,
      r.businessLeaveTimes,
      r.lateTimes,
      r.lateMinutes,
      r.otHours,
      escapeCsv(r.isDiligenceQualified ? 'ได้รับ' : 'หลุดสิทธิ์'),
      r.diligenceAmount || 0,
      escapeCsv(r.diligenceDisqualifyReason || '')
    ];
    rows.push(row.join(','));
  });

  var grand = data.grandTotals || {};
  var summaryTotalRow = [
    'รวมยอดทั้งสิ้น',
    '',
    '',
    '',
    '',
    '',
    '',
    grand.totalPresentDays || 0,
    '',
    (grand.totalAbsentDays || 0) + ' วัน (' + (grand.totalAbsentTimes || 0) + ' ครั้ง)',
    '',
    (grand.totalSickWithCertDays || 0) + ' วัน (' + (grand.totalSickWithCertTimes || 0) + ' ครั้ง)',
    '',
    (grand.totalSickNoCertDays || 0) + ' วัน (' + (grand.totalSickNoCertTimes || 0) + ' ครั้ง)',
    '',
    (grand.totalBusinessDays || 0) + ' วัน (' + (grand.totalBusinessTimes || 0) + ' ครั้ง)',
    '',
    (grand.totalLateTimes || 0) + ' ครั้ง',
    (grand.totalLateMinutes || 0) + ' นาที',
    (grand.totalOtHours || 0) + ' ชม.',
    'ผ่าน ' + (grand.diligencePassedCount || 0) + ' / ตก ' + (grand.diligenceFailedCount || 0),
    '',
    ''
  ];
  rows.push(summaryTotalRow.join(','));

  // Prepend UTF-8 BOM so Excel opens Thai characters flawlessly
  var csvContent = '\uFEFF' + rows.join('\r\n');
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.setAttribute('href', url);
  var periodStr = (data.period || 'current').replace(/[^0-9a-zA-Z_-]/g, '_');
  link.setAttribute('download', 'PTN_Attendance_Summary_' + periodStr + '.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('ดาวน์โหลดไฟล์ Excel (CSV) เรียบร้อยแล้ว', 'success');
}

function printAttendanceSummaryReport() {
  if (!State.attendancePeriodSummaryData) {
    showToast('กรุณารอโหลดข้อมูลให้เสร็จสิ้นก่อนสั่งพิมพ์', 'warning');
    return;
  }
  var printContainer = document.getElementById('attendancePrintContainer');
  if (!printContainer) return;

  var viewMode = State.activeAttendanceSummaryView;
  var data = State.attendancePeriodSummaryData;
  var cutoff = data.cutoffInfo || {};
  var list = data.summaryList || [];
  var grand = data.grandTotals || {};

  var nowUtc = new Date();
  var bkk = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
  var dateStr = bkk.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });

  if (viewMode === 'ALL') {
    // Print All Staff Summary Table (Landscape)
    var html = '<div style="font-family:\'Sarabun\',sans-serif;color:#0f172a;padding:4mm">';
    html += '<div style="border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start">';
    html += '<div>';
    html += '<h2 style="font-size:18px;font-weight:800;margin:0 0 3px 0">บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด</h2>';
    html += '<h3 style="font-size:14px;font-weight:700;color:#1e40af;margin:0 0 3px 0">รายงานสรุปวันทำงาน ขาด ลา มาสาย และ OT ของพนักงาน (ประจำงวด)</h3>';
    html += '<div style="font-size:12px;color:#475569">รอบงวด: <strong>' + esc(cutoff.startDate) + ' ถึง ' + esc(cutoff.endDate) + '</strong> (วันทำงานตามเกณฑ์ ' + (cutoff.totalExpectedWorkDays || 26) + ' วัน)</div>';
    html += '</div>';
    html += '<div style="text-align:right;font-size:11px;color:#475569">';
    html += '<div>วันที่พิมพ์: ' + dateStr + '</div>';
    html += '<div>พิมพ์โดย: ฝ่ายทรัพยากรบุคคล (HR)</div>';
    html += '</div>';
    html += '</div>';

    // Master Table
    html += '<table style="width:100%;border-collapse:collapse;font-size:11.5px;text-align:center;border:1.5px solid #0f172a">';
    html += '<thead><tr style="background:#f1f5f9;font-weight:800;border-bottom:1.5px solid #0f172a">';
    html += '<th style="border:1px solid #94a3b8;padding:6px;width:35px">ลำดับ</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px;width:60px">รหัส</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px 8px;text-align:left;min-width:140px">ชื่อ-นามสกุล (ชื่อเล่น)</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px;text-align:left;width:95px">สาขา</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px;width:65px">มาทำงาน<br>(วัน)</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px;width:80px">ขาดงาน<br>(วัน/ครั้ง)</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px;width:80px">ลาป่วยมีใบ<br>(วัน/ครั้ง)</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px;width:80px">ลาป่วยไม่มีใบ<br>(วัน/ครั้ง)</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px;width:80px">ลากิจ<br>(วัน/ครั้ง)</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px;width:90px">มาสาย<br>(ครั้ง/นาที)</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px;width:65px">OT รวม<br>(ชั่วโมง)</th>';
    html += '<th style="border:1px solid #94a3b8;padding:6px;width:75px">เบี้ยขยัน</th>';
    html += '</tr></thead><tbody>';

    list.forEach(function(r) {
      var dText = r.isDiligenceQualified ? 'ได้รับ' : 'หลุดสิทธิ์';
      html += '<tr style="border-bottom:1px solid #cbd5e1;height:30px">';
      html += '<td style="border:1px solid #cbd5e1;padding:4px">' + r.no + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:4px;font-family:monospace;font-weight:700">' + esc(r.empId) + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:4px 8px;text-align:left"><strong>' + esc(r.fullName) + '</strong>' + (r.nickname && r.nickname !== '-' ? ' (' + esc(r.nickname) + ')' : '') + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:4px;text-align:left">' + esc(r.branchName) + '</td>';
      var prDays = Math.round((Number(r.presentDays) || 0) * 100) / 100;
      var abDays = Math.round((Number(r.absentDays) || 0) * 100) / 100;
      var scDays = Math.round((Number(r.sickWithCertDays) || 0) * 100) / 100;
      var sncDays = Math.round((Number(r.sickNoCertDays) || 0) * 100) / 100;
      var blDays = Math.round((Number(r.businessLeaveDays) || 0) * 100) / 100;
      html += '<td style="border:1px solid #cbd5e1;padding:4px;font-weight:700">' + prDays + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:4px">' + (abDays > 0 ? (abDays + ' (' + r.absentTimes + ')') : '-') + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:4px">' + (scDays > 0 ? (scDays + ' (' + r.sickWithCertTimes + ')') : '-') + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:4px">' + (sncDays > 0 ? (sncDays + ' (' + r.sickNoCertTimes + ')') : '-') + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:4px">' + (blDays > 0 ? (blDays + ' (' + r.businessLeaveTimes + ')') : '-') + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:4px">' + (r.lateTimes > 0 ? (r.lateTimes + ' (' + r.lateMinutes + ' น.)') : '-') + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:4px">' + (r.otHours > 0 ? r.otHours : '-') + '</td>';
      html += '<td style="border:1px solid #cbd5e1;padding:4px;font-weight:700">' + dText + '</td>';
      html += '</tr>';
    });

    html += '</tbody><tfoot style="background:#f1f5f9;font-weight:800;border-top:1.5px solid #0f172a">';
    html += '<tr style="height:36px">';
    html += '<td colspan="4" style="border:1px solid #94a3b8;padding:6px;text-align:right">รวมยอดทั้งสิ้น (' + list.length + ' คน):</td>';
    html += '<td style="border:1px solid #94a3b8;padding:6px">' + (Math.round((Number(grand.totalPresentDays) || 0) * 100) / 100) + ' วัน</td>';
    html += '<td style="border:1px solid #94a3b8;padding:6px">' + (Math.round((Number(grand.totalAbsentDays) || 0) * 100) / 100) + ' (' + (grand.totalAbsentTimes || 0) + ')</td>';
    html += '<td style="border:1px solid #94a3b8;padding:6px">' + (Math.round((Number(grand.totalSickWithCertDays) || 0) * 100) / 100) + ' (' + (grand.totalSickWithCertTimes || 0) + ')</td>';
    html += '<td style="border:1px solid #94a3b8;padding:6px">' + (Math.round((Number(grand.totalSickNoCertDays) || 0) * 100) / 100) + ' (' + (grand.totalSickNoCertTimes || 0) + ')</td>';
    html += '<td style="border:1px solid #94a3b8;padding:6px">' + (Math.round((Number(grand.totalBusinessDays) || 0) * 100) / 100) + ' (' + (grand.totalBusinessTimes || 0) + ')</td>';
    html += '<td style="border:1px solid #94a3b8;padding:6px">' + (grand.totalLateTimes || 0) + ' (' + (grand.totalLateMinutes || 0) + ' น.)</td>';
    html += '<td style="border:1px solid #94a3b8;padding:6px">' + (grand.totalOtHours || 0) + ' ชม.</td>';
    html += '<td style="border:1px solid #94a3b8;padding:6px;font-size:11px">ผ่าน ' + (grand.diligencePassedCount || 0) + '<br>ตก ' + (grand.diligenceFailedCount || 0) + '</td>';
    html += '</tr></tfoot></table>';

    // Signatures
    html += '<div style="margin-top:36px;display:grid;grid-template-columns:repeat(3, 1fr);gap:24px;text-align:center;font-size:12px">';
    html += '<div><p style="margin-bottom:34px">ลงชื่อ ................................................................</p><p style="font-weight:700">( ................................................................ )</p><p style="font-size:11px;color:#64748b;margin-top:2px">เจ้าหน้าที่ผู้จัดทำรายงาน (HR)</p></div>';
    html += '<div><p style="margin-bottom:34px">ลงชื่อ ................................................................</p><p style="font-weight:700">( ................................................................ )</p><p style="font-size:11px;color:#64748b;margin-top:2px">ผู้จัดการแผนก / หัวหน้าสาขา</p></div>';
    html += '<div><p style="margin-bottom:34px">ลงชื่อ ................................................................</p><p style="font-weight:700">( ................................................................ )</p><p style="font-size:11px;color:#64748b;margin-top:2px">ผู้อนุมัติจ่ายเงินเดือน (ผู้บริหาร)</p></div>';
    html += '</div></div>';

    printContainer.innerHTML = html;
    document.body.classList.add('printing-attendance-summary');
    window.print();
    setTimeout(function() {
      document.body.classList.remove('printing-attendance-summary');
      printContainer.innerHTML = '';
    }, 600);

  } else {
    // Print Individual Timesheet Sheet (Portrait)
    var emp = list.find(function(e) { return e.empId === State.activeAttendanceSummarySingleEmpId; });
    if (!emp && list.length) emp = list[0];
    if (!emp) return;

    var sHtml = '<div style="font-family:\'Sarabun\',sans-serif;color:#0f172a;padding:4mm;max-width:760px;margin:0 auto">';
    sHtml += '<div style="border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:12px;text-align:center">';
    sHtml += '<h2 style="font-size:18px;font-weight:800;margin:0 0 3px 0">บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด</h2>';
    sHtml += '<h3 style="font-size:14px;font-weight:700;color:#1e40af;margin:0 0 3px 0">ใบสรุปเวลาทำงานและประวัติการขาด ลา มาสาย ประจำงวด (รายบุคคล)</h3>';
    sHtml += '<div style="font-size:12px;color:#475569">รอบงวด: <strong>' + esc(cutoff.startDate) + ' ถึง ' + esc(cutoff.endDate) + '</strong> (วันทำงานตามเกณฑ์ ' + (cutoff.totalExpectedWorkDays || 26) + ' วัน)</div>';
    sHtml += '</div>';

    // Emp Info Box
    sHtml += '<div style="border:1px solid #cbd5e1;background:#f8fafc;padding:10px 14px;margin-bottom:12px;display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;font-size:12px">';
    sHtml += '<div><span style="color:#64748b">รหัสพนักงาน:</span> <strong style="font-family:monospace;font-size:13px">' + esc(emp.empId) + '</strong></div>';
    sHtml += '<div><span style="color:#64748b">ชื่อ-นามสกุล:</span> <strong>' + esc(emp.fullName) + '</strong></div>';
    sHtml += '<div><span style="color:#64748b">ชื่อเล่น:</span> <strong>' + esc(emp.nickname) + '</strong></div>';
    sHtml += '<div><span style="color:#64748b">สาขา:</span> <strong>' + esc(emp.branchName) + '</strong></div>';
    sHtml += '</div>';

    // Stat boxes
    sHtml += '<table style="width:100%;border-collapse:collapse;text-align:center;font-size:11.5px;margin-bottom:12px;border:1px solid #94a3b8">';
    sHtml += '<tr style="background:#f1f5f9;font-weight:700">';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px">มาทำงาน</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px">ขาดงาน</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px">ป่วยมีใบ</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px">ป่วยไม่มีใบ</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px">ลากิจ</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px">มาสาย</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px">OT รวม</td>';
    sHtml += '</tr>';
    sHtml += '<tr style="font-weight:800;font-size:13px;height:34px">';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px;color:#1e40af">' + (Math.round((Number(emp.presentDays) || 0) * 100) / 100) + ' / ' + emp.expectedWorkDays + ' วัน</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px;color:#991b1b">' + (Math.round((Number(emp.absentDays) || 0) * 100) / 100) + ' วัน (' + emp.absentTimes + ' ครั้ง)</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px;color:#0369a1">' + (Math.round((Number(emp.sickWithCertDays) || 0) * 100) / 100) + ' วัน (' + emp.sickWithCertTimes + ' ครั้ง)</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px;color:#b45309">' + (Math.round((Number(emp.sickNoCertDays) || 0) * 100) / 100) + ' วัน (' + emp.sickNoCertTimes + ' ครั้ง)</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px;color:#6d28d9">' + (Math.round((Number(emp.businessLeaveDays) || 0) * 100) / 100) + ' วัน (' + emp.businessLeaveTimes + ' ครั้ง)</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px;color:#c2410c">' + emp.lateTimes + ' ครั้ง (' + emp.lateMinutes + ' น.)</td>';
    sHtml += '<td style="border:1px solid #cbd5e1;padding:5px;color:#3730a3">' + (Math.round((Number(emp.otHours) || 0) * 100) / 100) + ' ชม.</td>';
    sHtml += '</tr></table>';

    // Daily Logs Table
    sHtml += '<table style="width:100%;border-collapse:collapse;font-size:11px;text-align:center;border:1px solid #94a3b8;margin-bottom:20px">';
    sHtml += '<thead><tr style="background:#f1f5f9;font-weight:700">';
    sHtml += '<th style="border:1px solid #cbd5e1;padding:4px;width:70px">วันที่</th>';
    sHtml += '<th style="border:1px solid #cbd5e1;padding:4px;width:40px">วัน</th>';
    sHtml += '<th style="border:1px solid #cbd5e1;padding:4px;width:70px">เวลาเข้า</th>';
    sHtml += '<th style="border:1px solid #cbd5e1;padding:4px;width:70px">เวลาออก</th>';
    sHtml += '<th style="border:1px solid #cbd5e1;padding:4px;width:65px">สาย (นาที)</th>';
    sHtml += '<th style="border:1px solid #cbd5e1;padding:4px;width:60px">OT (ชม.)</th>';
    sHtml += '<th style="border:1px solid #cbd5e1;padding:4px;text-align:left">สถานะการทำงาน / การลา</th>';
    sHtml += '<th style="border:1px solid #cbd5e1;padding:4px;text-align:left">หมายเหตุ</th>';
    sHtml += '</tr></thead><tbody>';

    (emp.dailyRecords || []).forEach(function(r) {
      var dayColor = (r.dayOfWeek === 'อา.' || r.dayOfWeek === 'Sun') ? '#dc2626' : '#1e293b';
      var clockInText = (r.clockIn && r.clockIn !== '-') ? r.clockIn : '-';
      var clockOutText = (r.clockOut && r.clockOut !== '-') ? r.clockOut : '-';
      var clockInColor = (clockInText !== '-') ? '#0f172a' : '#94a3b8';
      var clockOutColor = (clockOutText !== '-') ? '#0f172a' : '#94a3b8';

      sHtml += '<tr style="border-bottom:1px solid #cbd5e1;height:24px;color:#0f172a">';
      sHtml += '<td style="border:1px solid #cbd5e1;padding:3px;font-family:monospace;font-weight:700;color:#0f172a">' + r.date.substring(5) + '</td>';
      sHtml += '<td style="border:1px solid #cbd5e1;padding:3px;font-weight:700;color:' + dayColor + '">' + r.dayOfWeek + '</td>';
      sHtml += '<td style="border:1px solid #cbd5e1;padding:3px;font-family:monospace;font-weight:700;color:' + clockInColor + '">' + esc(clockInText) + '</td>';
      sHtml += '<td style="border:1px solid #cbd5e1;padding:3px;font-family:monospace;font-weight:700;color:' + clockOutColor + '">' + esc(clockOutText) + '</td>';
      sHtml += '<td style="border:1px solid #cbd5e1;padding:3px;color:' + (r.lateMinutes > 0 ? '#c2410c;font-weight:800' : '#64748b') + ';font-family:monospace">' + (r.lateMinutes > 0 ? r.lateMinutes : '-') + '</td>';
      sHtml += '<td style="border:1px solid #cbd5e1;padding:3px;color:' + (r.otHours > 0 ? '#4338ca;font-weight:800' : '#64748b') + ';font-family:monospace">' + (r.otHours > 0 ? r.otHours : '-') + '</td>';
      sHtml += '<td style="border:1px solid #cbd5e1;padding:3px;text-align:left;font-weight:600;color:' + r.statusColor + '">' + esc(r.statusText) + '</td>';
      sHtml += '<td style="border:1px solid #cbd5e1;padding:3px;text-align:left;font-size:10px;color:#334155">' + esc(r.remark || '-') + '</td>';
      sHtml += '</tr>';
    });
    sHtml += '</tbody></table>';

    // Signatures
    sHtml += '<div style="margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:40px;text-align:center;font-size:12px">';
    sHtml += '<div><p style="margin-bottom:34px">ลงชื่อ ................................................................ ผู้ขอรับรอง</p><p style="font-weight:700">( ' + esc(emp.fullName) + ' )</p><p style="font-size:11px;color:#64748b;margin-top:2px">พนักงานผู้ลงเวลา</p></div>';
    sHtml += '<div><p style="margin-bottom:34px">ลงชื่อ ................................................................ ผู้ตรวจสอบ</p><p style="font-weight:700">( ................................................................ )</p><p style="font-size:11px;color:#64748b;margin-top:2px">เจ้าหน้าที่ฝ่ายบุคคล / หัวหน้างาน</p></div>';
    sHtml += '</div></div>';

    printContainer.innerHTML = sHtml;
    document.body.classList.add('printing-attendance-individual');
    window.print();
    setTimeout(function() {
      document.body.classList.remove('printing-attendance-individual');
      printContainer.innerHTML = '';
    }, 600);
  }
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

var _currentAttendanceTableFilter = 'ALL';

function setAttendanceTableFilter(filter) {
  _currentAttendanceTableFilter = filter || 'ALL';
  var btnAll = document.getElementById('btnAttFilter_ALL');
  var btnPresent = document.getElementById('btnAttFilter_PRESENT');
  var btnLate = document.getElementById('btnAttFilter_LATE');
  var btnLeave = document.getElementById('btnAttFilter_LEAVE');
  var btnAbsent = document.getElementById('btnAttFilter_ABSENT');

  var buttons = {
    'ALL': btnAll,
    'PRESENT': btnPresent,
    'LATE': btnLate,
    'LEAVE': btnLeave,
    'ABSENT': btnAbsent
  };

  Object.keys(buttons).forEach(function(k) {
    var b = buttons[k];
    if (b) {
      if (k === _currentAttendanceTableFilter) {
        b.className = 'btn btn-sm';
        b.style.background = '#2563eb';
        b.style.color = '#ffffff';
        b.style.borderColor = '#1d4ed8';
        b.style.fontWeight = '700';
        b.style.boxShadow = '0 1px 2px rgba(37,99,235,0.2)';
      } else {
        b.className = 'btn btn-sm btn-slate';
        b.style.background = '#ffffff';
        b.style.color = '#475569';
        b.style.borderColor = '#cbd5e1';
        b.style.fontWeight = '600';
        b.style.boxShadow = 'none';
      }
    }
  });

  renderTimeAttendanceTodayLogs(_currentAttendanceLogs, _currentAttendanceIsIndividual);
}

function openAddAttendanceLogForEmp(empId, empName) {
  openAddAttendanceLogModal();
  var empSel = document.getElementById('addAttEmpId');
  if (empSel && empId) {
    empSel.value = empId;
  }
  var dateInp = document.getElementById('addAttDate');
  var curFilterDate = (document.getElementById('attFilterDate') && document.getElementById('attFilterDate').value);
  if (dateInp && curFilterDate) {
    dateInp.value = curFilterDate;
  }
}

function openLeaveDetailModal(leaveId, empId) {
  var notClocked = (State.attendanceBreakdown && State.attendanceBreakdown.notClockedInList) || [];
  var match = notClocked.find(function(x) { 
    return (leaveId && String(x.leaveId) === String(leaveId)) || (empId && x.empId === empId && x.hasLeave); 
  });

  if (!match) {
    var leaves = (State.attendanceCurrentRequests && State.attendanceCurrentRequests.leave) || (State.attendancePendingData && State.attendancePendingData.leaves) || [];
    var lObj = leaves.find(function(x) { return leaveId && String(x.id) === String(leaveId); });
    if (lObj) {
      match = {
        name: lObj.full_name || lObj.emp_id,
        nickname: lObj.nickname || '',
        empId: lObj.emp_id,
        dept: lObj.department || '-',
        leaveType: lObj.leave_type || 'ลางาน',
        leaveStatus: lObj.status || 'APPROVED',
        leaveDays: lObj.days_count || 1,
        leaveSlot: lObj.time_slot || 'FULL',
        leaveReason: lObj.reason || 'ไม่ได้ระบุเหตุผล',
        medicalCertUrl: lObj.medical_cert_url || null
      };
    }
  }

  if (!match) {
    showToast('ไม่พบข้อมูลคำขอลางาน', 'info');
    return;
  }

  var slotText = match.leaveSlot === 'MORNING' ? 'ครึ่งวันเช้า' : (match.leaveSlot === 'AFTERNOON' ? 'ครึ่งวันบ่าย' : 'เต็มวัน');
  var stLabel = match.leaveStatus === 'APPROVED' ? '<span style="color:#059669;font-weight:700">✓ อนุมัติแล้ว</span>' : (match.leaveStatus === 'PENDING' ? '<span style="color:#d97706;font-weight:700">⏳ รออนุมัติ</span>' : '<span style="color:#dc2626;font-weight:700">✕ ปฏิเสธ</span>');

  var html = '<div style="text-align:left;font-size:12.5px;color:#334155;line-height:1.7">' +
    '<div style="margin-bottom:8px"><strong>พนักงาน:</strong> ' + esc(match.name) + (match.nickname ? ' (' + esc(match.nickname) + ')' : '') + ' <span style="color:#64748b">[' + esc(match.empId) + ']</span></div>' +
    '<div style="margin-bottom:8px"><strong>ประเภทการลา:</strong> <span style="color:#1d4ed8;font-weight:700">' + esc(match.leaveType) + '</span></div>' +
    '<div style="margin-bottom:8px"><strong>จำนวนวันลา:</strong> ' + (match.leaveDays || 1) + ' วัน (' + slotText + ')</div>' +
    '<div style="margin-bottom:8px"><strong>สถานะคำขอ:</strong> ' + stLabel + '</div>' +
    '<div style="margin-bottom:12px"><strong>เหตุผลการลา:</strong> <div style="background:#f8fafc;padding:8px 10px;border-radius:6px;border:1px dashed #cbd5e1;margin-top:4px">' + esc(match.leaveReason || 'ไม่ได้ระบุเหตุผล') + '</div></div>';

  if (match.medicalCertUrl) {
    html += '<div><strong>เอกสารแนบ / ใบรับรองแพทย์:</strong><div style="margin-top:6px;text-align:center"><img src="' + match.medicalCertUrl + '" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid #cbd5e1;cursor:pointer" onclick="previewAttendancePhoto(\'' + match.medicalCertUrl + '\', \'เอกสารแนบการลา\')" title="คลิกดูภาพใหญ่"></div></div>';
  }
  html += '</div>';

  Swal.fire({
    title: '📄 รายละเอียดการลางาน',
    html: html,
    confirmButtonText: 'ปิดหน้าต่าง',
    confirmButtonColor: '#2563eb'
  });
}

function renderTimeAttendanceTodayLogs(logs, isIndividual) {
  var tbody = document.getElementById('attLogsTableBody');
  if (!tbody) return;

  var isIndiv = (isIndividual !== undefined) ? isIndividual : _currentAttendanceIsIndividual;
  var thDate = document.getElementById('thAttDate');
  if (thDate) thDate.style.display = isIndiv ? '' : 'none';

  var filterBar = document.getElementById('attDailyFilterBar');
  var dateMode = (document.getElementById('attFilterDateMode') && document.getElementById('attFilterDateMode').value) || _currentAttendanceDateMode || 'SINGLE';
  var isDailyMode = (!isIndiv && dateMode === 'SINGLE');

  var branchFilter = (document.getElementById('attFilterBranch') && document.getElementById('attFilterBranch').value) || 'ALL';

  var nowUtc = new Date();
  var bangkokToday = new Date(nowUtc.getTime() + (7 * 3600 * 1000)).toISOString().substring(0, 10);
  var thaiDays = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
  var canManageLogs = (hasPermission('manage_time_logs') || isSuperAdmin());

  var notClockedInList = [];
  if (isDailyMode && State.attendanceBreakdown && Array.isArray(State.attendanceBreakdown.notClockedInList)) {
    notClockedInList = State.attendanceBreakdown.notClockedInList;
    if (branchFilter && branchFilter !== 'ALL') {
      notClockedInList = notClockedInList.filter(function(x) {
        return (x.branchId === branchFilter);
      });
    }
  }

  // Filter logs by branch if needed
  var filteredLogs = logs || [];
  if (!isIndiv && branchFilter && branchFilter !== 'ALL') {
    filteredLogs = filteredLogs.filter(function(l) {
      return (l.branch_id === branchFilter || l.emp_branch_id === branchFilter);
    });
  }

  if (isDailyMode && filterBar) {
    filterBar.style.display = 'flex';
    var cntPresent = filteredLogs.length;
    var cntLate = filteredLogs.filter(function(l) { return (Number(l.late_minutes) || 0) > 0; }).length;
    var cntLeave = notClockedInList.filter(function(x) { return x.hasLeave; }).length;
    var cntAbsent = notClockedInList.filter(function(x) { return !x.hasLeave; }).length;
    var cntAll = cntPresent + notClockedInList.length;

    var elAll = document.getElementById('txtAttCountAll');
    var elPresent = document.getElementById('txtAttCountPresent');
    var elLate = document.getElementById('txtAttCountLate');
    var elLeave = document.getElementById('txtAttCountLeave');
    var elAbsent = document.getElementById('txtAttCountAbsent');
    if (elAll) elAll.textContent = cntAll;
    if (elPresent) elPresent.textContent = cntPresent;
    if (elLate) elLate.textContent = cntLate;
    if (elLeave) elLeave.textContent = cntLeave;
    if (elAbsent) elAbsent.textContent = cntAbsent;
  } else if (filterBar) {
    filterBar.style.display = 'none';
  }

  // Build rows to render
  var itemsToRender = [];

  // 1. Clocked-in logs
  filteredLogs.forEach(function(l) {
    var isLate = (Number(l.late_minutes) || 0) > 0;
    var itemType = isLate ? 'LATE' : 'PRESENT';
    if (isDailyMode) {
      if (_currentAttendanceTableFilter === 'ALL' ||
          _currentAttendanceTableFilter === 'PRESENT' ||
          (_currentAttendanceTableFilter === 'LATE' && isLate) ||
          (_currentAttendanceTableFilter === 'LEAVE' && l.has_leave_conflict)) {
        itemsToRender.push({ kind: 'LOG', data: l, itemType: itemType });
      }
    } else {
      itemsToRender.push({ kind: 'LOG', data: l, itemType: itemType });
    }
  });

  // 2. Unclocked / On Leave / Absent employees (only in daily view)
  if (isDailyMode) {
    notClockedInList.forEach(function(u) {
      if (u.hasLeave) {
        if (_currentAttendanceTableFilter === 'ALL' || _currentAttendanceTableFilter === 'LEAVE') {
          itemsToRender.push({ kind: 'LEAVE', data: u, itemType: 'LEAVE' });
        }
      } else {
        if (_currentAttendanceTableFilter === 'ALL' || _currentAttendanceTableFilter === 'ABSENT') {
          itemsToRender.push({ kind: 'ABSENT', data: u, itemType: 'ABSENT' });
        }
      }
    });
  }

  if (itemsToRender.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted" style="padding:28px"><i class="fa-solid fa-clock-rotate-left" style="font-size:24px;margin-bottom:8px;display:block;opacity:0.4"></i>ไม่พบข้อมูลการลงเวลาหรือพนักงานตามเงื่อนไขที่เลือก</td></tr>';
    return;
  }

  var html = '';
  var rowIdx = 1;
  var filterDateVal = (document.getElementById('attFilterDate') && document.getElementById('attFilterDate').value) || bangkokToday;

  itemsToRender.forEach(function(item) {
    if (item.kind === 'LOG') {
      var l = item.data;
      var inPhotoHtml = '<span style="color:#94a3b8;font-size:11px">-</span>';
      if (l.in_photo_url) {
        inPhotoHtml = '<img src="' + l.in_photo_url + '" alt="IN" style="width:36px;height:36px;border-radius:8px;object-fit:cover;border:2px solid #10b981;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.1);display:inline-block;vertical-align:middle" onclick="previewAttendancePhoto(\'' + l.in_photo_url + '\', \'รูปถ่ายเข้างาน: ' + esc(l.full_name || l.emp_id) + '\', \'เวลาเข้า: ' + (l.clock_in || '-') + ' น. | พิกัด: ' + (l.in_lat ? l.in_lat.toFixed(4) + ', ' + l.in_lng.toFixed(4) : '-') + '\')" title="คลิกเพื่อดูรูปขยาย">';
      }

      var outPhotoHtml = '<span style="color:#94a3b8;font-size:11px">-</span>';
      if (l.out_photo_url) {
        outPhotoHtml = '<img src="' + l.out_photo_url + '" alt="OUT" style="width:36px;height:36px;border-radius:8px;object-fit:cover;border:2px solid #ef4444;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.1);display:inline-block;vertical-align:middle" onclick="previewAttendancePhoto(\'' + l.out_photo_url + '\', \'รูปถ่ายออกงาน: ' + esc(l.full_name || l.emp_id) + '\', \'เวลาออก: ' + (l.clock_out || '-') + ' น. | พิกัด: ' + (l.out_lat ? l.out_lat.toFixed(4) + ', ' + l.out_lng.toFixed(4) : '-') + '\')" title="คลิกเพื่อดูรูปขยาย">';
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

      // Missing clock out anomaly check & half-day absence check
      var missingOutAnomaly = '';
      var inTimeStr = l.clock_in ? l.clock_in.substring(0, 5) : '';
      if (inTimeStr && inTimeStr >= '13:00') {
        missingOutAnomaly = '<div style="font-size:10px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:2px 6px;margin-top:3px;font-weight:700;display:inline-flex;align-items:center;gap:3px" title="เข้างานหลังเวลาพักเที่ยง ถือเป็นขาดงานครึ่งเช้า 0.5 วัน (หัก 1.5 เท่า)"><i class="fa-solid fa-triangle-exclamation"></i> <span>เข้างานบ่าย (ขาดงานครึ่งเช้า 0.5 วัน)</span></div>';
      } else if (l.clock_in && (!l.clock_out || l.clock_out.trim() === '') && l.date < bangkokToday && !l.has_leave_conflict) {
        missingOutAnomaly = '<div style="font-size:10px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:2px 6px;margin-top:3px;font-weight:700;display:inline-flex;align-items:center;gap:3px" title="ไม่ลงเวลาออกงาน/ค้างเวลาพัก ถือเป็นขาดงานครึ่งบ่าย 0.5 วัน (หัก 1.5 เท่า)"><i class="fa-solid fa-triangle-exclamation"></i> <span>ไม่สแกนออก (ขาดงานครึ่งบ่าย 0.5 วัน)</span></div>';
      }

      html += '<tr id="attLogRow_' + l.id + '">' +
        '<td class="text-center" style="padding:4px">' +
          '<input type="checkbox" class="att-log-checkbox" value="' + l.id + '" onchange="onAttendanceCheckboxChanged()" style="cursor:pointer;accent-color:#2563eb;width:15px;height:15px">' +
        '</td>' +
        '<td class="text-center font-bold" style="color:#64748b">' + (rowIdx++) + '</td>' +
        dateColHtml +
        '<td class="text-center" style="padding:4px">' + inPhotoHtml + '</td>' +
        '<td class="text-center" style="padding:4px">' + outPhotoHtml + '</td>' +
        '<td class="font-bold" style="color:#1e40af;cursor:pointer" onclick="viewAttendanceLogDetail(' + l.id + ')" title="ดูรายละเอียด">' + (l.emp_id || '-') + '</td>' +
        '<td>' +
          '<div style="font-weight:700;color:#0f172a;cursor:pointer;display:inline-block" onclick="viewAttendanceLogDetail(' + l.id + ')" title="คลิกเพื่อดูรายละเอียดเชิงลึก">' +
            esc(nameDisplay) + ' <i class="fa-solid fa-circle-info text-blue" style="font-size:11px;opacity:0.7"></i>' +
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
            (canManageLogs ? (
              '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 6px;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;border-radius:4px" onclick="openEditAttendanceLogModal(' + l.id + ')" title="แก้ไขเวลาเข้า-ออก">' +
                '<i class="fa-solid fa-pen-to-square"></i>' +
              '</button>' +
              '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 6px;background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;border-radius:4px" onclick="deleteSingleAttendanceLog(' + l.id + ', \'' + esc(l.full_name || l.emp_id) + '\')" title="ลบรายการนี้">' +
                '<i class="fa-solid fa-trash-can"></i>' +
              '</button>'
            ) : '') +
            '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 7px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;border-radius:4px;font-weight:600" onclick="syncFromPtnTimeForEmp(\'' + esc(l.emp_id) + '\', \'' + esc(l.full_name || '') + '\')" title="ดึงข้อมูลเข้าสู่คำนวณเงินเดือน">' +
              '<i class="fa-solid fa-cloud-arrow-down"></i>' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';

    } else if (item.kind === 'LEAVE') {
      var u = item.data;
      var leaveIcon = '🏖️';
      var leaveBg = '#eff6ff';
      var leaveColor = '#1d4ed8';
      var leaveBorder = '#bfdbfe';
      var lType = String(u.leaveType || '').toUpperCase();
      if (lType.includes('SICK')) {
        leaveIcon = '🩺';
        leaveBg = '#f0fdf4';
        leaveColor = '#15803d';
        leaveBorder = '#bbf7d0';
      } else if (lType.includes('ANNUAL') || lType.includes('VACATION')) {
        leaveIcon = '🌴';
        leaveBg = '#fefce8';
        leaveColor = '#a16207';
        leaveBorder = '#fef08a';
      } else if (lType.includes('WITHOUT_PAY')) {
        leaveIcon = '💸';
        leaveBg = '#fef2f2';
        leaveColor = '#b91c1c';
        leaveBorder = '#fecaca';
      }

      var leaveTypeLabel = u.leaveType || 'ลางาน';
      var leaveStatusText = u.leaveStatus === 'APPROVED' ? 'อนุมัติแล้ว' : (u.leaveStatus === 'PENDING' ? 'รออนุมัติ' : 'อนุมัติ');
      var leaveStatusBadge = '<span style="background:' + leaveBg + ';color:' + leaveColor + ';font-weight:700;font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid ' + leaveBorder + '">' + leaveIcon + ' ' + esc(leaveTypeLabel) + ' (' + leaveStatusText + ')</span>';

      var certPreviewHtml = '<span style="color:#94a3b8;font-size:11px">-</span>';
      if (u.medicalCertUrl) {
        certPreviewHtml = '<img src="' + u.medicalCertUrl + '" alt="CERT" style="width:36px;height:36px;border-radius:8px;object-fit:cover;border:2px solid #3b82f6;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.1);display:inline-block;vertical-align:middle" onclick="previewAttendancePhoto(\'' + u.medicalCertUrl + '\', \'เอกสาร/ใบรับรองแพทย์: ' + esc(u.name || u.empId) + '\', \'ประเภท: ' + esc(leaveTypeLabel) + ' | ' + (u.leaveDays || 1) + ' วัน\')" title="คลิกดูใบรับรองแพทย์/เอกสารแนบ">';
      } else {
        certPreviewHtml = '<div style="width:36px;height:36px;border-radius:8px;background:' + leaveBg + ';border:1px solid ' + leaveBorder + ';color:' + leaveColor + ';display:inline-flex;align-items:center;justify-content:center;font-size:15px" title="' + esc(leaveTypeLabel) + '">' + leaveIcon + '</div>';
      }

      var nameDisplay = (u.name || '-') + (u.nickname ? ' (' + u.nickname + ')' : '');
      var branchDisplay = u.branchName || u.branchId || 'สำนักงานใหญ่';
      var slotText = u.leaveSlot === 'MORNING' ? 'ครึ่งเช้า' : (u.leaveSlot === 'AFTERNOON' ? 'ครึ่งบ่าย' : 'เต็มวัน');

      html += '<tr style="background:#f8fafc;border-left:3px solid #3b82f6">' +
        '<td class="text-center" style="padding:4px"><span style="color:#cbd5e1;font-size:11px">-</span></td>' +
        '<td class="text-center font-bold" style="color:#64748b">' + (rowIdx++) + '</td>' +
        (isIndiv ? dateColHtml : '') +
        '<td class="text-center" style="padding:4px">' + certPreviewHtml + '</td>' +
        '<td class="text-center" style="padding:4px"><span style="color:#94a3b8;font-size:11px">-</span></td>' +
        '<td class="font-bold" style="color:#1d4ed8;cursor:pointer" onclick="openLeaveDetailModal(' + u.leaveId + ', \'' + esc(u.empId) + '\')">' + (u.empId || '-') + '</td>' +
        '<td>' +
          '<div style="font-weight:700;color:#0f172a;cursor:pointer;display:inline-block" onclick="openLeaveDetailModal(' + u.leaveId + ', \'' + esc(u.empId) + '\')" title="คลิกเพื่อดูรายละเอียดใบลา">' +
            esc(nameDisplay) + ' <i class="fa-solid fa-file-lines text-blue" style="font-size:11px;opacity:0.7"></i>' +
          '</div>' +
          '<div style="font-size:11px;color:#64748b">' + (u.position || '-') + '</div>' +
          '<div style="font-size:11px;color:' + leaveColor + ';margin-top:2px;font-weight:600">' +
            leaveIcon + ' ' + esc(leaveTypeLabel) + ' (' + (u.leaveDays || 1) + ' วัน ' + slotText + ')' +
            (u.leaveReason ? ' - ' + esc(u.leaveReason) : '') +
          '</div>' +
        '</td>' +
        '<td><span class="period-pill" style="font-size:10.5px">' + (u.dept || '-') + '</span></td>' +
        '<td><span class="period-pill" style="font-size:10.5px;background:#e0f2fe;color:#0369a1;border-color:#bae6fd;font-weight:700"><i class="fa-solid fa-store" style="margin-right:3px"></i>' + esc(branchDisplay) + '</span></td>' +
        '<td class="text-center font-bold" style="color:#94a3b8;font-size:11px">-</td>' +
        '<td class="text-center font-bold" style="color:#94a3b8;font-size:11px">-</td>' +
        '<td class="text-center" style="font-size:11px;color:' + leaveColor + ';font-weight:700">ลา ' + (u.leaveDays || 1) + ' วัน</td>' +
        '<td class="text-center">' + leaveStatusBadge + '</td>' +
        '<td class="text-center" style="padding:4px;white-space:nowrap">' +
          '<div style="display:inline-flex;gap:4px">' +
            '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 7px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;font-weight:600" onclick="openLeaveDetailModal(' + u.leaveId + ', \'' + esc(u.empId) + '\')" title="ดูรายละเอียดใบลา">' +
              '<i class="fa-solid fa-file-lines"></i> ดูใบลา' +
            '</button>' +
            (canManageLogs ? (
              '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 7px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:4px;font-weight:600" onclick="openAddAttendanceLogForEmp(\'' + esc(u.empId) + '\', \'' + esc(u.name || '') + '\')" title="ลงเวลาทำงานแทน">' +
                '<i class="fa-solid fa-plus"></i> ลงเวลา' +
              '</button>'
            ) : '') +
          '</div>' +
        '</td>' +
      '</tr>';

    } else if (item.kind === 'ABSENT') {
      var a = item.data;
      var isAbsentPast = (a.statusType === 'ABSENT' || (!a.hasLeave && filterDateVal < bangkokToday && a.statusType !== 'HOLIDAY' && a.statusType !== 'SUNDAY_OFF'));
      var isHoliday = (a.statusType === 'HOLIDAY' || a.statusType === 'SUNDAY_OFF');

      var statusBadge = '';
      if (isHoliday) {
        statusBadge = '<span style="background:#f1f5f9;color:#475569;font-weight:700;font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid #cbd5e1">⭐ วันหยุด ' + (a.holidayName ? '(' + esc(a.holidayName) + ')' : 'ประจำสัปดาห์') + '</span>';
      } else if (isAbsentPast) {
        statusBadge = '<span style="background:#fef2f2;color:#b91c1c;font-weight:700;font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid #fecaca"><i class="fa-solid fa-triangle-exclamation"></i> ขาดงาน</span>';
      } else {
        statusBadge = '<span style="background:#fff7ed;color:#c2410c;font-weight:700;font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid #fed7aa">⏳ ยังไม่ลงเวลา</span>';
      }

      var rowBorder = isAbsentPast ? 'border-left:3px solid #ef4444' : (isHoliday ? 'border-left:3px solid #cbd5e1' : 'border-left:3px solid #f97316');
      var iconHtml = '<div style="width:36px;height:36px;border-radius:8px;background:' + (isAbsentPast ? '#fee2e2' : '#f1f5f9') + ';border:1px solid ' + (isAbsentPast ? '#fecaca' : '#e2e8f0') + ';color:' + (isAbsentPast ? '#dc2626' : '#94a3b8') + ';display:inline-flex;align-items:center;justify-content:center;font-size:14px"><i class="fa-solid fa-user-xmark"></i></div>';

      var nameDisplay = (a.name || '-') + (a.nickname ? ' (' + a.nickname + ')' : '');
      var branchDisplay = a.branchName || a.branchId || 'สำนักงานใหญ่';

      html += '<tr style="background:' + (isAbsentPast ? '#fff5f5' : '#ffffff') + ';' + rowBorder + '">' +
        '<td class="text-center" style="padding:4px"><span style="color:#cbd5e1;font-size:11px">-</span></td>' +
        '<td class="text-center font-bold" style="color:#64748b">' + (rowIdx++) + '</td>' +
        (isIndiv ? dateColHtml : '') +
        '<td class="text-center" style="padding:4px">' + iconHtml + '</td>' +
        '<td class="text-center" style="padding:4px"><span style="color:#94a3b8;font-size:11px">-</span></td>' +
        '<td class="font-bold" style="' + (isAbsentPast ? 'color:#b91c1c;' : 'color:#64748b;') + '">' + (a.empId || '-') + '</td>' +
        '<td>' +
          '<div style="font-weight:700;color:#0f172a">' + esc(nameDisplay) + '</div>' +
          '<div style="font-size:11px;color:#64748b">' + (a.position || '-') + '</div>' +
          '<div style="font-size:10.5px;color:' + (isAbsentPast ? '#dc2626' : '#64748b') + ';margin-top:2px">' +
            (isHoliday ? 'วันหยุด ไม่ต้องลงเวลา' : (isAbsentPast ? '⚠️ ไม่มีบันทึกเวลา และไม่มีใบลาที่อนุมัติ' : 'กะงาน: ' + (a.shiftText || '09:30 - 19:00 น.'))) +
          '</div>' +
        '</td>' +
        '<td><span class="period-pill" style="font-size:10.5px">' + (a.dept || '-') + '</span></td>' +
        '<td><span class="period-pill" style="font-size:10.5px;background:#e0f2fe;color:#0369a1;border-color:#bae6fd;font-weight:700"><i class="fa-solid fa-store" style="margin-right:3px"></i>' + esc(branchDisplay) + '</span></td>' +
        '<td class="text-center font-bold" style="color:#94a3b8;font-size:11px">-</td>' +
        '<td class="text-center font-bold" style="color:#94a3b8;font-size:11px">-</td>' +
        '<td class="text-center" style="font-size:11px;color:' + (isAbsentPast ? '#b91c1c;font-weight:700' : '#64748b') + '">' + (isAbsentPast ? 'ขาดงาน' : '-') + '</td>' +
        '<td class="text-center">' + statusBadge + '</td>' +
        '<td class="text-center" style="padding:4px;white-space:nowrap">' +
          '<div style="display:inline-flex;gap:4px">' +
            (canManageLogs ? (
              '<button type="button" class="btn btn-sm btn-primary" style="font-size:11px;padding:3px 8px;font-weight:600" onclick="openAddAttendanceLogForEmp(\'' + esc(a.empId) + '\', \'' + esc(a.name || '') + '\')" title="ลงเวลาทำงานแทน">' +
                '<i class="fa-solid fa-plus"></i> ลงเวลาแทน' +
              '</button>'
            ) : '') +
            (a.phone ? (
              '<a href="tel:' + a.phone + '" class="btn btn-sm btn-slate" style="font-size:11px;padding:3px 7px" title="โทร: ' + a.phone + '">' +
                '<i class="fa-solid fa-phone text-green"></i>' +
              '</a>'
            ) : '') +
          '</div>' +
        '</td>' +
      '</tr>';
    }
  });

  tbody.innerHTML = html;
}

// ==============================================================================
// APPROVAL REQUESTS A4 PRINTING & EXCEL EXPORT SYSTEM
// ==============================================================================
function getEmpNickname(firstArg, directNickname, employeeList) {
  // Case 1: firstArg is an object (e.g. employee row or item object)
  if (firstArg && typeof firstArg === 'object') {
    var objNick = firstArg.nickname || firstArg.nick_name || directNickname;
    if (objNick && String(objNick).trim() && String(objNick).trim() !== '-') {
      return String(objNick).trim();
    }
    var targetIdFromObj = String(firstArg.emp_id || firstArg.empId || firstArg.id || '').trim();
    if (!targetIdFromObj) return '';
    var list1 = Array.isArray(employeeList) ? employeeList : (Array.isArray(directNickname) ? directNickname : null);
    if (list1 && list1.length > 0) {
      var f0 = list1.find(function(e) { return String((e && (e.emp_id || e.empId || e.id)) || '').trim() === targetIdFromObj; });
      if (f0 && f0.nickname && String(f0.nickname).trim() && String(f0.nickname).trim() !== '-') {
        return String(f0.nickname).trim();
      }
    }
    if (Array.isArray(State.employees) && State.employees.length > 0) {
      var f1 = State.employees.find(function(e) { return String((e && (e.emp_id || e.empId || e.id)) || '').trim() === targetIdFromObj; });
      if (f1 && f1.nickname && String(f1.nickname).trim() && String(f1.nickname).trim() !== '-') {
        return String(f1.nickname).trim();
      }
    }
    if (Array.isArray(_currentAttendanceEmployeeList) && _currentAttendanceEmployeeList.length > 0) {
      var f2 = _currentAttendanceEmployeeList.find(function(e) { return String((e && (e.emp_id || e.empId || e.id)) || '').trim() === targetIdFromObj; });
      if (f2 && f2.nickname && String(f2.nickname).trim() && String(f2.nickname).trim() !== '-') {
        return String(f2.nickname).trim();
      }
    }
    return '';
  }

  // Case 2: firstArg is empId (string or number)
  if (directNickname && typeof directNickname === 'string' && String(directNickname).trim() && String(directNickname).trim() !== '-') {
    return String(directNickname).trim();
  }
  if (!firstArg) return '';
  var targetId = String(firstArg).trim();
  if (Array.isArray(employeeList) && employeeList.length > 0) {
    var found0 = employeeList.find(function(e) { return String((e && (e.emp_id || e.empId || e.id)) || '').trim() === targetId; });
    if (found0 && found0.nickname && String(found0.nickname).trim() && String(found0.nickname).trim() !== '-') {
      return String(found0.nickname).trim();
    }
  }
  if (Array.isArray(State.employees) && State.employees.length > 0) {
    var found1 = State.employees.find(function(e) { return String((e && (e.emp_id || e.empId || e.id)) || '').trim() === targetId; });
    if (found1 && found1.nickname && String(found1.nickname).trim() && String(found1.nickname).trim() !== '-') {
      return String(found1.nickname).trim();
    }
  }
  if (Array.isArray(_currentAttendanceEmployeeList) && _currentAttendanceEmployeeList.length > 0) {
    var found2 = _currentAttendanceEmployeeList.find(function(e) { return String((e && (e.emp_id || e.empId || e.id)) || '').trim() === targetId; });
    if (found2 && found2.nickname && String(found2.nickname).trim() && String(found2.nickname).trim() !== '-') {
      return String(found2.nickname).trim();
    }
  }
  return '';
}

function formatEmpNameWithNick(fullName, empId, directNickname, employeeList) {
  if (fullName && typeof fullName === 'object') {
    var item = fullName;
    var itemEmpId = item.emp_id || item.empId || '';
    var n1 = item.full_name || item.fullName || item.name || itemEmpId || '-';
    var nick1 = getEmpNickname(item, item.nickname, employeeList);
    return nick1 ? (n1 + ' (' + nick1 + ')') : n1;
  }
  var name = fullName || empId || '-';
  var nick = getEmpNickname(empId, directNickname, employeeList);
  return nick ? (name + ' (' + nick + ')') : name;
}

function generateStandardA4PrintDoc(options) {
  options = options || {};
  var title = options.title || 'รายงาน';
  var subtitle = options.subtitle || '';
  var orientation = options.orientation || 'portrait';
  var isLandscape = (orientation === 'landscape');
  var compName = options.companyName || (State.company && State.company.companyName) || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด (PTN PHARMA CENTER CO., LTD.)';
  var compTax = options.companyTaxId || (State.company && State.company.taxId) || '0105559876543';
  var metaGridHtml = options.metaGridHtml || '';
  var contentHtml = options.contentHtml || '';
  var extraStyles = options.extraStyles || '';
  var signLabels = options.signLabels || [
    'ผู้จัดทำรายงาน / เจ้าหน้าที่ HR',
    'ผู้ตรวจสอบ / หัวหน้าฝ่าย',
    'ผู้อนุมัติ / ผู้จัดการฝ่ายบุคคล'
  ];
  var autoPrint = options.autoPrint !== false;
  var footerLeft = options.footerLeft || 'PTN Payroll & Time Management System • ระบบประมวลผลเงินเดือนและเวลาทำงาน';
  var footerRight = options.footerRight || 'เอกสารทางการ สงวนสิทธิ์ใช้งานภายในองค์กร';

  var signHtml = '<div class="sign-grid">' +
    signLabels.map(function(label) {
      return '<div>' +
        '<div>' + label + '</div>' +
        '<div class="sign-line"></div>' +
        '<div>( .................................................... )</div>' +
        '<div style="font-size:10px;color:#64748b;margin-top:2px">วันที่ ...../...../..........</div>' +
      '</div>';
    }).join('') +
  '</div>';

  var printScript = autoPrint ? '<script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };<\\/script>' : '';

  return '<!DOCTYPE html>' +
    '<html><head><meta charset="utf-8"><title>' + title + '</title>' +
    '<style>' +
      '@page { size: A4 ' + (isLandscape ? 'landscape' : 'portrait') + '; margin: ' + (isLandscape ? '8mm 10mm' : '12mm') + '; }' +
      'body { font-family: "Sarabun", "Segoe UI", Arial, sans-serif; font-size: ' + (isLandscape ? '11px' : '11px') + '; color: #0f172a; margin: 0; padding: ' + (isLandscape ? '6px 12px' : '10px') + '; }' +
      'table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: ' + (isLandscape ? '11px' : '10.5px') + '; }' +
      'th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: ' + (isLandscape ? '6px 6px' : '6px 4px') + '; text-align: center; color: #1e293b; font-weight: 700; font-size: ' + (isLandscape ? '11px' : '10.5px') + '; }' +
      'td { border: 1px solid #cbd5e1; padding: ' + (isLandscape ? '5.5px 6px' : '5px 4px') + '; vertical-align: middle; }' +
      'tr:nth-child(even) td { background: #fafafa; }' +
      '.header-box { border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 10px; }' +
      '.meta-grid { display: grid; grid-template-columns: ' + (isLandscape ? 'repeat(6, auto)' : 'repeat(3, 1fr)') + '; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; font-size: 10.5px; margin-top: 8px; ' + (isLandscape ? 'justify-content: space-between;' : '') + ' }' +
      '.sign-grid { display: grid; grid-template-columns: repeat(' + signLabels.length + ', 1fr); gap: ' + (isLandscape ? '36px' : '20px') + '; margin-top: 28px; text-align: center; font-size: 11px; }' +
      '.sign-line { border-bottom: 1px dotted #64748b; width: 75%; margin: 34px auto 6px; }' +
      extraStyles +
    '</style>' +
    '</head><body>' +
    '<div class="header-box">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div>' +
          '<div style="font-size:15px;font-weight:bold;color:#0f172a">' + compName + '</div>' +
          '<div style="font-size:10.5px;color:#475569">เลขประจำตัวผู้เสียภาษี: ' + compTax + '</div>' +
        '</div>' +
        '<div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-weight:bold;padding:3px 8px;border-radius:4px;font-size:10.5px">เอกสารงานบุคคล (HR Document)</div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:6px">' +
        '<div style="font-size:16px;font-weight:bold;color:#1e3a8a">' + title + '</div>' +
        (subtitle ? '<div style="font-size:12px;color:#475569;margin-top:2px">' + subtitle + '</div>' : '') +
      '</div>' +
      metaGridHtml +
    '</div>' +
    contentHtml +
    signHtml +
    '<div style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:6px;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between">' +
      '<span>' + footerLeft + '</span>' +
      '<span>' + footerRight + '</span>' +
    '</div>' +
    printScript +
    '</body></html>';
}

function openApprovalReportModal() {
  // Sync Branches
  var branchSel = document.getElementById('rptBranch');
  if (branchSel) {
    branchSel.innerHTML = '<option value="ALL">🏢 ทุกสาขา (All Branches)</option>';
    var branches = State.branches || [];
    branches.forEach(function(b) {
      var opt = document.createElement('option');
      opt.value = b.branch_id;
      opt.textContent = b.branch_id + ' - ' + b.branch_name;
      branchSel.appendChild(opt);
    });
  }

  // Pre-fill dates based on current view
  var today = new Date();
  var y = today.getFullYear();
  var m = String(today.getMonth() + 1).padStart(2, '0');
  var d = String(today.getDate()).padStart(2, '0');
  var curMonthStr = y + '-' + m;

  var startEl = document.getElementById('rptStartDate');
  var endEl = document.getElementById('rptEndDate');
  var monthEl = document.getElementById('rptMonth');
  var periodEl = document.getElementById('rptPeriod');

  if (startEl && !startEl.value) startEl.value = curMonthStr + '-01';
  if (endEl && !endEl.value) endEl.value = y + '-' + m + '-' + d;
  if (monthEl && !monthEl.value) monthEl.value = curMonthStr;
  if (periodEl && !periodEl.value) periodEl.value = curMonthStr;

  // Sync with current filter in approvals tab if active
  if (_currentAttendanceRequestDateMode === 'RANGE' && _currentAttendanceRequestStartDate && _currentAttendanceRequestEndDate) {
    if (startEl) startEl.value = _currentAttendanceRequestStartDate;
    if (endEl) endEl.value = _currentAttendanceRequestEndDate;
    var modeSel = document.getElementById('rptDateMode');
    if (modeSel) modeSel.value = 'RANGE';
  } else if (_currentAttendanceRequestDateMode === 'MONTH' && _currentAttendanceRequestMonth) {
    if (monthEl) monthEl.value = _currentAttendanceRequestMonth;
    var modeSel = document.getElementById('rptDateMode');
    if (modeSel) modeSel.value = 'MONTH';
  } else if (_currentAttendanceRequestDateMode === 'PERIOD' && _currentAttendanceRequestPeriod) {
    if (periodEl) periodEl.value = _currentAttendanceRequestPeriod;
    var modeSel = document.getElementById('rptDateMode');
    if (modeSel) modeSel.value = 'PERIOD';
  }

  onRptDateModeChanged();
  openModal('modalApprovalReport');
}

function onRptDateModeChanged() {
  var mode = document.getElementById('rptDateMode') ? document.getElementById('rptDateMode').value : 'RANGE';
  var wRange = document.getElementById('rptDateWrapRange');
  var wMonth = document.getElementById('rptDateWrapMonth');
  var wPeriod = document.getElementById('rptDateWrapPeriod');

  if (wRange) wRange.style.display = (mode === 'RANGE') ? 'grid' : 'none';
  if (wMonth) wMonth.style.display = (mode === 'MONTH') ? 'block' : 'none';
  if (wPeriod) wPeriod.style.display = (mode === 'PERIOD') ? 'block' : 'none';
}

function onRptConfigChanged() {
  // Callback when radio type changes
}

function onRptOrientationChanged() {
  var rads = document.getElementsByName('rptOrientation');
  for (var i = 0; i < rads.length; i++) {
    var r = rads[i];
    var lbl = r.parentElement;
    if (lbl) {
      if (r.checked) {
        lbl.style.borderColor = '#3b82f6';
        lbl.style.background = '#eff6ff';
        lbl.style.color = '#1e40af';
        lbl.style.fontWeight = '700';
      } else {
        lbl.style.borderColor = '#cbd5e1';
        lbl.style.background = '#fff';
        lbl.style.color = '#334155';
        lbl.style.fontWeight = '600';
      }
    }
  }
}

async function fetchApprovalReportData() {
  var reqType = 'ALL';
  var typeRadios = document.getElementsByName('rptReqType');
  for (var i = 0; i < typeRadios.length; i++) {
    if (typeRadios[i].checked) { reqType = typeRadios[i].value; break; }
  }

  var dateMode = document.getElementById('rptDateMode') ? document.getElementById('rptDateMode').value : 'RANGE';
  var startDate = document.getElementById('rptStartDate') ? document.getElementById('rptStartDate').value : '';
  var endDate = document.getElementById('rptEndDate') ? document.getElementById('rptEndDate').value : '';
  var month = document.getElementById('rptMonth') ? document.getElementById('rptMonth').value : '';
  var period = document.getElementById('rptPeriod') ? document.getElementById('rptPeriod').value : '';
  var branchId = document.getElementById('rptBranch') ? document.getElementById('rptBranch').value : 'ALL';
  var status = document.getElementById('rptStatus') ? document.getElementById('rptStatus').value : 'APPROVED';

  showToast('กำลังรวบรวมข้อมูลคำขอ...', 'info');
  try {
    var res = await callApi('getTimeAttendanceDashboard', {
      username: (State.currentUser && State.currentUser.username) || 'Admin',
      requestStatus: status,
      requestType: reqType,
      requestDateMode: dateMode,
      requestStartDate: startDate,
      requestEndDate: endDate,
      requestMonth: month,
      requestPeriod: period,
      requestLimit: 1000
    });

    if (!res || !res.success) {
      showToast(res && res.message ? res.message : 'ไม่สามารถดึงข้อมูลคำขอได้', 'error');
      return null;
    }

    // Filter by branch if selected
    var leaves = res.pendingLeaves || [];
    var ots = res.pendingOts || [];
    var advances = res.pendingAdvances || [];

    if (branchId && branchId !== 'ALL') {
      var empBranchMap = {};
      (res.employeeList || State.employees || []).forEach(function(e) {
        empBranchMap[e.emp_id] = e.branch_id;
      });
      leaves = leaves.filter(function(x) { return (x.branch_id || empBranchMap[x.emp_id]) === branchId; });
      ots = ots.filter(function(x) { return (x.branch_id || empBranchMap[x.emp_id]) === branchId; });
      advances = advances.filter(function(x) { return (x.branch_id || empBranchMap[x.emp_id]) === branchId; });
    }

    return {
      reqType: reqType,
      dateMode: dateMode,
      startDate: startDate,
      endDate: endDate,
      month: month,
      period: period,
      branchId: branchId,
      status: status,
      leaves: leaves,
      ots: ots,
      advances: advances,
      employeeList: res.employeeList || State.employees || []
    };
  } catch(err) {
    console.error('fetchApprovalReportData error:', err);
    showToast('เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน', 'error');
    return null;
  }
}

async function printApprovalReportA4() {
  var data = await fetchApprovalReportData();
  if (!data) return;

  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด (PTN PHARMA CENTER CO., LTD.)';
  var compTax = State.company.taxId || '0105559876543';

  // Format Period string
  var periodDisplay = '';
  if (data.dateMode === 'RANGE') {
    periodDisplay = (data.startDate || '-') + ' ถึง ' + (data.endDate || '-');
  } else if (data.dateMode === 'MONTH') {
    periodDisplay = 'ประจำเดือน ' + (data.month || '-');
  } else if (data.dateMode === 'PERIOD') {
    periodDisplay = 'รอบตัดวิก ' + (data.period || '-');
  } else {
    periodDisplay = 'ทุกช่วงเวลา';
  }

  var branchDisplay = 'ทุกสาขา (All Branches)';
  if (data.branchId && data.branchId !== 'ALL') {
    var bObj = (State.branches || []).find(function(b) { return b.branch_id === data.branchId; });
    branchDisplay = bObj ? (bObj.branch_id + ' - ' + bObj.branch_name) : data.branchId;
  }

  var statusLabels = { 'APPROVED': 'อนุมัติแล้ว (Approved)', 'PENDING': 'รออนุมัติ (Pending)', 'REJECTED': 'ปฏิเสธแล้ว (Rejected)', 'ALL': 'ทั้งหมด (All)' };
  var statusDisplay = statusLabels[data.status] || data.status;

  var now = new Date();
  var thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var printDateStr = now.getDate() + ' ' + thMonths[now.getMonth()] + ' ' + (now.getFullYear() + 543) + ' เวลา ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ' น.';

  // Build Sections based on reqType
  var sectionsHtml = '';

  // 1. LEAVE SECTION
  if (data.reqType === 'ALL' || data.reqType === 'LEAVE') {
    var leaves = data.leaves || [];
    var totalLeaveDays = 0;
    var sickDays = 0;
    var busDays = 0;

    var rows = leaves.map(function(item, idx) {
      var days = Number(item.days_count || 1);
      totalLeaveDays += days;
      var typeStr = item.leave_type || 'ลาหยุด';
      if (typeStr.indexOf('ป่วย') !== -1) sickDays += days;
      else busDays += days;

      var stTag = item.status === 'APPROVED' ? '<span style="color:#15803d;font-weight:700">✓ อนุมัติ</span>' : (item.status === 'PENDING' ? '<span style="color:#b45309;font-weight:700">⏳ รออนุมัติ</span>' : '<span style="color:#dc2626;font-weight:700">✕ ปฏิเสธ</span>');
      var rangeStr = (item.start_date === item.end_date) ? item.start_date : (item.start_date + ' ถึง ' + item.end_date);
      if (item.time_slot && item.time_slot !== 'FULL') rangeStr += ' (' + item.time_slot + ')';

      return '<tr>' +
        '<td style="text-align:center">' + (idx + 1) + '</td>' +
        '<td style="text-align:center">' + (item.created_at ? item.created_at.substring(0, 10) : '-') + '</td>' +
        '<td><strong>' + (item.emp_id || '-') + '</strong> ' + esc(formatEmpNameWithNick(item.full_name, item.emp_id, item.nickname, data.employeeList)) + '</td>' +
        '<td>' + (item.department || '-') + '</td>' +
        '<td>' + typeStr + '</td>' +
        '<td style="text-align:center">' + rangeStr + '</td>' +
        '<td style="text-align:center;font-weight:700">' + days + ' วัน</td>' +
        '<td>' + (item.reason || '-') + '</td>' +
        '<td style="text-align:center">' + stTag + '</td>' +
      '</tr>';
    }).join('');

    if (leaves.length === 0) {
      rows = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:12px">ไม่มีรายการคำขอลางานในช่วงนี้</td></tr>';
    }

    sectionsHtml += '<div style="margin-bottom:20px">' +
      '<div style="font-size:13px;font-weight:700;color:#1e3a8a;margin-bottom:6px;display:flex;justify-content:space-between">' +
        '<span>🏖️ 1. รายการคำขอลางาน (Leave Requests) — ' + leaves.length + ' รายการ</span>' +
        '<span>รวมวันลาทั้งสิ้น: <strong style="color:#16a34a">' + totalLeaveDays + ' วัน</strong> (ป่วย ' + sickDays + ' วัน / กิจ ' + busDays + ' วัน)</span>' +
      '</div>' +
      '<table>' +
        '<thead><tr>' +
          '<th style="width:28px">#</th><th style="width:70px">วันที่ยื่น</th><th>รหัส-ชื่อพนักงาน (ชื่อเล่น)</th><th style="width:90px">แผนก</th><th style="width:100px">ประเภทการลา</th><th style="width:130px">ช่วงวันที่ลา</th><th style="width:55px">จำนวน</th><th>เหตุผล</th><th style="width:70px">สถานะ</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';
  }

  // 2. OT SECTION
  if (data.reqType === 'ALL' || data.reqType === 'OT') {
    var ots = data.ots || [];
    var totalReqOt = 0;
    var totalAppOt = 0;

    var rows = ots.map(function(item, idx) {
      var reqH = Number(item.hours || 0);
      var appH = Number(item.actual_hours !== null && item.actual_hours !== undefined ? item.actual_hours : reqH);
      totalReqOt += reqH;
      totalAppOt += appH;

      var stTag = item.status === 'APPROVED' ? '<span style="color:#15803d;font-weight:700">✓ อนุมัติ</span>' : (item.status === 'PENDING' ? '<span style="color:#b45309;font-weight:700">⏳ รออนุมัติ</span>' : '<span style="color:#dc2626;font-weight:700">✕ ปฏิเสธ</span>');
      var timeRange = (item.start_time && item.end_time) ? (item.start_time + ' - ' + item.end_time) : '-';

      return '<tr>' +
        '<td style="text-align:center">' + (idx + 1) + '</td>' +
        '<td style="text-align:center">' + (item.date || '-') + '</td>' +
        '<td><strong>' + (item.emp_id || '-') + '</strong> ' + esc(formatEmpNameWithNick(item.full_name, item.emp_id, item.nickname, data.employeeList)) + '</td>' +
        '<td>' + (item.department || '-') + '</td>' +
        '<td style="text-align:center">' + timeRange + '</td>' +
        '<td style="text-align:right">' + reqH.toFixed(1) + ' ชม.</td>' +
        '<td style="text-align:right;font-weight:700;color:#b45309">' + appH.toFixed(1) + ' ชม.</td>' +
        '<td>' + (item.reason || '-') + '</td>' +
        '<td style="text-align:center">' + stTag + '</td>' +
      '</tr>';
    }).join('');

    if (ots.length === 0) {
      rows = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:12px">ไม่มีรายการขอทำ OT ในช่วงนี้</td></tr>';
    }

    sectionsHtml += '<div style="margin-bottom:20px">' +
      '<div style="font-size:13px;font-weight:700;color:#b45309;margin-bottom:6px;display:flex;justify-content:space-between">' +
        '<span>⏰ 2. รายการขอทำ OT (Overtime Requests) — ' + ots.length + ' รายการ</span>' +
        '<span>รวมชั่วโมง OT: ขอทำ ' + totalReqOt.toFixed(1) + ' ชม. / <strong style="color:#b45309">อนุมัติ ' + totalAppOt.toFixed(1) + ' ชม.</strong></span>' +
      '</div>' +
      '<table>' +
        '<thead><tr>' +
          '<th style="width:28px">#</th><th style="width:70px">วันที่ทำ OT</th><th>รหัส-ชื่อพนักงาน (ชื่อเล่น)</th><th style="width:90px">แผนก</th><th style="width:95px">ช่วงเวลา</th><th style="width:65px">ขอทำ</th><th style="width:65px">อนุมัติจริง</th><th>รายละเอียดงาน</th><th style="width:70px">สถานะ</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';
  }

  // 3. ADVANCE SECTION
  if (data.reqType === 'ALL' || data.reqType === 'ADVANCE') {
    var advances = data.advances || [];
    var totalReqAdv = 0;
    var totalAppAdv = 0;

    var rows = advances.map(function(item, idx) {
      var reqA = Number(item.amount || 0);
      var appA = Number(item.status === 'APPROVED' ? reqA : 0);
      totalReqAdv += reqA;
      totalAppAdv += appA;

      var stTag = item.status === 'APPROVED' ? '<span style="color:#15803d;font-weight:700">✓ อนุมัติ</span>' : (item.status === 'PENDING' ? '<span style="color:#b45309;font-weight:700">⏳ รออนุมัติ</span>' : '<span style="color:#dc2626;font-weight:700">✕ ปฏิเสธ</span>');

      return '<tr>' +
        '<td style="text-align:center">' + (idx + 1) + '</td>' +
        '<td style="text-align:center">' + (item.request_date || '-') + '</td>' +
        '<td><strong>' + (item.emp_id || '-') + '</strong> ' + esc(formatEmpNameWithNick(item.full_name, item.emp_id, item.nickname, data.employeeList)) + '</td>' +
        '<td>' + (item.department || '-') + '</td>' +
        '<td style="text-align:right;font-weight:700">฿' + reqA.toLocaleString() + '</td>' +
        '<td style="text-align:right;font-weight:700;color:#15803d">฿' + appA.toLocaleString() + '</td>' +
        '<td>' + (item.reason || '-') + '</td>' +
        '<td style="text-align:center">' + (item.deduct_period || '-') + '</td>' +
        '<td style="text-align:center">' + stTag + '</td>' +
      '</tr>';
    }).join('');

    if (advances.length === 0) {
      rows = '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:12px">ไม่มีรายการขอเบิกเงินล่วงหน้าในช่วงนี้</td></tr>';
    }

    sectionsHtml += '<div style="margin-bottom:20px">' +
      '<div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:6px;display:flex;justify-content:space-between">' +
        '<span>💵 3. รายการขอเบิกเงินล่วงหน้า (Salary Advance Requests) — ' + advances.length + ' รายการ</span>' +
        '<span>รวมยอดเงิน: ขอเบิก ฿' + totalReqAdv.toLocaleString() + ' / <strong style="color:#15803d">อนุมัติจ่าย ฿' + totalAppAdv.toLocaleString() + '</strong></span>' +
      '</div>' +
      '<table>' +
        '<thead><tr>' +
          '<th style="width:28px">#</th><th style="width:70px">วันที่ขอเบิก</th><th>รหัส-ชื่อพนักงาน (ชื่อเล่น)</th><th style="width:90px">แผนก</th><th style="width:85px">ยอดขอเบิก</th><th style="width:85px">ยอดอนุมัติ</th><th>เหตุผลความจำเป็น</th><th style="width:80px">หักคืนงวด</th><th style="width:70px">สถานะ</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';
  }

  var reportTitle = 'รายงานสรุปคำขอและการอนุมัติ (Approval & Request Report)';
  if (data.reqType === 'LEAVE') reportTitle = 'รายงานสรุปการอนุมัติการลางาน (Leave Approval Report)';
  else if (data.reqType === 'OT') reportTitle = 'รายงานสรุปการอนุมัติทำงานล่วงเวลา (Overtime Report)';
  else if (data.reqType === 'ADVANCE') reportTitle = 'รายงานสรุปการอนุมัติเบิกเงินล่วงหน้า (Salary Advance Report)';

  var orientation = 'landscape';
  var orientRadios = document.getElementsByName('rptOrientation');
  for (var i = 0; i < orientRadios.length; i++) {
    if (orientRadios[i].checked) { orientation = String(orientRadios[i].value).toLowerCase(); break; }
  }
  var isLandscape = (orientation === 'landscape');

  var metaGridHtml = '<div class="meta-grid">' +
    '<div><b>ช่วงเวลา:</b> ' + periodDisplay + '</div>' +
    '<div><b>สาขา:</b> ' + branchDisplay + '</div>' +
    '<div><b>สถานะ:</b> ' + statusDisplay + '</div>' +
    '<div><b>พิมพ์เมื่อ:</b> ' + printDateStr + '</div>' +
    '<div><b>ผู้ออกเอกสาร:</b> Admin (ระบบบริหารบุคคล)</div>' +
    '<div><b>หน้า:</b> 1 / 1</div>' +
  '</div>';

  var docHtml = generateStandardA4PrintDoc({
    title: reportTitle,
    orientation: orientation,
    metaGridHtml: metaGridHtml,
    contentHtml: sectionsHtml
  });

  var printWin = window.open('', '_blank');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(docHtml);
    printWin.document.close();
  } else {
    var iframe = document.getElementById('reportPrintIframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'reportPrintIframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }
    var iDoc = iframe.contentWindow.document;
    iDoc.open();
    iDoc.write(docHtml);
    iDoc.close();
    setTimeout(function() {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 400);
  }
}

async function exportApprovalReportExcel() {
  var data = await fetchApprovalReportData();
  if (!data) return;

  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    var s = String(val).replace(/"/g, '""');
    return '"' + s + '"';
  }

  var empList = data.employeeList || State.employees || [];
  var csvRows = [];
  csvRows.push([escapeCsvCell('รายงานสรุปคำขอและการอนุมัติ (PTN Payroll & Time System)')]);
  csvRows.push([escapeCsvCell('ช่วงเวลา:'), escapeCsvCell(data.dateMode === 'RANGE' ? (data.startDate + ' ถึง ' + data.endDate) : (data.dateMode === 'MONTH' ? data.month : data.period))]);
  csvRows.push([escapeCsvCell('สาขา:'), escapeCsvCell(data.branchId)]);
  csvRows.push([escapeCsvCell('สถานะ:'), escapeCsvCell(data.status)]);
  csvRows.push([]);

  // 1. LEAVE
  if (data.reqType === 'ALL' || data.reqType === 'LEAVE') {
    csvRows.push([escapeCsvCell('[หมวดคำขอลางาน]')]);
    csvRows.push(['ลำดับ', 'วันที่ยื่น', 'รหัสพนักงาน', 'ชื่อ-สกุล', 'ชื่อเล่น', 'แผนก', 'ประเภทการลา', 'วันที่เริ่มต้น', 'วันที่สิ้นสุด', 'จำนวนวัน', 'ช่วงเวลา', 'เหตุผล', 'สถานะ'].map(escapeCsvCell));
    (data.leaves || []).forEach(function(l, idx) {
      csvRows.push([
        idx + 1,
        escapeCsvCell(l.created_at ? l.created_at.substring(0, 10) : ''),
        escapeCsvCell(l.emp_id || ''),
        escapeCsvCell(l.full_name || ''),
        escapeCsvCell(getEmpNickname(l.emp_id, l.nickname, empList)),
        escapeCsvCell(l.department || ''),
        escapeCsvCell(l.leave_type || ''),
        escapeCsvCell(l.start_date || ''),
        escapeCsvCell(l.end_date || ''),
        l.days_count || 1,
        escapeCsvCell(l.time_slot || 'FULL'),
        escapeCsvCell(l.reason || ''),
        escapeCsvCell(l.status || '')
      ]);
    });
    csvRows.push([]);
  }

  // 2. OT
  if (data.reqType === 'ALL' || data.reqType === 'OT') {
    csvRows.push([escapeCsvCell('[หมวดขอทำ OT]')]);
    csvRows.push(['ลำดับ', 'วันที่ทำ OT', 'รหัสพนักงาน', 'ชื่อ-สกุล', 'ชื่อเล่น', 'แผนก', 'เวลาเริ่มต้น', 'เวลาสิ้นสุด', 'ชม.ขอทำ', 'ชม.อนุมัติจริง', 'รายละเอียดงาน', 'สถานะ'].map(escapeCsvCell));
    (data.ots || []).forEach(function(o, idx) {
      csvRows.push([
        idx + 1,
        escapeCsvCell(o.date || ''),
        escapeCsvCell(o.emp_id || ''),
        escapeCsvCell(o.full_name || ''),
        escapeCsvCell(getEmpNickname(o.emp_id, o.nickname, empList)),
        escapeCsvCell(o.department || ''),
        escapeCsvCell(o.start_time || ''),
        escapeCsvCell(o.end_time || ''),
        o.hours || 0,
        (o.actual_hours !== null && o.actual_hours !== undefined) ? o.actual_hours : (o.hours || 0),
        escapeCsvCell(o.reason || ''),
        escapeCsvCell(o.status || '')
      ]);
    });
    csvRows.push([]);
  }

  // 3. ADVANCE
  if (data.reqType === 'ALL' || data.reqType === 'ADVANCE') {
    csvRows.push([escapeCsvCell('[หมวดขอเบิกเงินล่วงหน้า]')]);
    csvRows.push(['ลำดับ', 'วันที่ขอเบิก', 'รหัสพนักงาน', 'ชื่อ-สกุล', 'ชื่อเล่น', 'แผนก', 'ยอดเงินขอเบิก (บาท)', 'เหตุผลความจำเป็น', 'รอบวิกที่หักคืน', 'สถานะ'].map(escapeCsvCell));
    (data.advances || []).forEach(function(a, idx) {
      csvRows.push([
        idx + 1,
        escapeCsvCell(a.request_date || ''),
        escapeCsvCell(a.emp_id || ''),
        escapeCsvCell(a.full_name || ''),
        escapeCsvCell(getEmpNickname(a.emp_id, a.nickname, empList)),
        escapeCsvCell(a.department || ''),
        Number(a.amount || 0),
        escapeCsvCell(a.reason || ''),
        escapeCsvCell(a.deduct_period || ''),
        escapeCsvCell(a.status || '')
      ]);
    });
    csvRows.push([]);
  }

  var csvContent = '\uFEFF' + csvRows.map(function(e) { return e.join(','); }).join('\r\n');
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var fileName = 'Approval_Report_' + (data.reqType) + '_' + (new Date().toISOString().substring(0, 10)) + '.csv';
  a.setAttribute('download', fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('ส่งออกไฟล์ Excel/CSV สำเร็จเรียบร้อย', 'success');
}


function printIndividualAttendanceTimesheet() {
  var empId = _currentAttendanceEmpId || (document.getElementById('attFilterEmp') ? document.getElementById('attFilterEmp').value : 'ALL');
  if (!empId || empId === 'ALL') {
    showToast('โปรดเลือกพนักงานที่ต้องการพิมพ์ Timesheet ก่อน', 'warning');
    return;
  }

  var emp = _currentAttendanceSelectedEmpInfo ||
            (_currentAttendanceEmployeeList || []).find(function(x) { return x.emp_id === empId; }) ||
            (State.employees || []).find(function(x) { return (x.emp_id || x.empId) === empId; }) ||
            { emp_id: empId, name: empId, full_name: empId };

  if (!emp.name && emp.full_name) emp.name = emp.full_name;
  if (!emp.full_name && emp.name) emp.full_name = emp.name;
  var summary = _currentAttendanceEmpSummary || {};
  var logs = _currentAttendanceLogs || [];

  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด (PTN PHARMA CENTER CO., LTD.)';
  var compTax = State.company.taxId || '0105559876543';
  var periodStr = document.getElementById('attIndivPeriodBadge') ? document.getElementById('attIndivPeriodBadge').textContent.trim() : '';

  var printWin = window.open('', '_blank');

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

  var metaGridHtml = '<div style="display:flex;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;font-size:11.5px;margin-top:8px">' +
    '<div>' +
      '<div><b>รหัสพนักงาน:</b> ' + (emp.emp_id || '-') + ' &nbsp;&nbsp; <b>ชื่อ-สกุล:</b> ' + (emp.full_name || emp.name || '-') + (emp.nickname ? ' (' + emp.nickname + ')' : '') + '</div>' +
      '<div style="margin-top:3px"><b>แผนก:</b> ' + (emp.department || '-') + ' &nbsp;&nbsp; <b>ตำแหน่ง:</b> ' + (emp.position || '-') + ' &nbsp;&nbsp; <b>สาขา:</b> ' + (emp.branch_name || 'สำนักงานใหญ่') + '</div>' +
    '</div>' +
    '<div style="text-align:right">' +
      '<div><b>รอบ/ช่วงเวลา:</b> ' + periodStr + '</div>' +
      '<div style="margin-top:3px;color:#64748b">พิมพ์เมื่อ: ' + printDateStr + '</div>' +
    '</div>' +
  '</div>';

  var contentHtml = '<div class="kpi-grid">' +
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
  '</table>';

  var extraStyles = '.kpi-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 10px 0; }' +
    '.kpi-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; background: #fafafa; }' +
    '.kpi-title { font-size: 10px; color: #64748b; font-weight: 600; }' +
    '.kpi-val { font-size: 13px; font-weight: bold; margin-top: 2px; }';

  var signLabels = [
    (emp.full_name || emp.name || 'พนักงาน') + '<br><span style="font-size:10px;color:#64748b">ลายมือชื่อพนักงานผู้ปฏิบัติงาน</span>',
    'ผู้ตรวจสอบ / หัวหน้างาน',
    'กรรมการผู้จัดการ / ผู้อนุมัติ'
  ];

  var docHtml = generateStandardA4PrintDoc({
    title: 'ใบรายงานบันทึกเวลาทำงานรายบุคคล (Individual Timesheet Report)',
    orientation: 'portrait',
    metaGridHtml: metaGridHtml,
    contentHtml: contentHtml,
    extraStyles: extraStyles,
    signLabels: signLabels
  });

  if (printWin) {
    printWin.document.open();
    printWin.document.write(docHtml);
    printWin.document.close();
  } else {
    var printIframe = document.getElementById('timesheetPrintIframe');
    if (!printIframe) {
      printIframe = document.createElement('iframe');
      printIframe.id = 'timesheetPrintIframe';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      document.body.appendChild(printIframe);
    }
    var iDoc = printIframe.contentWindow.document;
    iDoc.open();
    iDoc.write(docHtml);
    iDoc.close();
    setTimeout(function() {
      printIframe.contentWindow.focus();
      printIframe.contentWindow.print();
    }, 400);
  }
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

function batchSetEarlyDismissal(enabled) {
  var cbs = document.querySelectorAll('.att-log-checkbox:checked');
  var ids = Array.from(cbs).map(function(cb) { return Number(cb.value); });
  if (ids.length === 0) {
    showToast('กรุณาเลือกรายการที่ต้องการดำเนินการอย่างน้อย 1 รายการ', 'warning');
    return;
  }

  var actionText = enabled ? 'อนุมัติโหมดงานเสร็จ (จ่ายค่าแรงเต็มวัน ไม่หักเงิน)' : 'ยกเลิกโหมดงานเสร็จ (กลับสู่โหมดปกติ)';
  if (!confirm('ยืนยัน' + actionText + ' สำหรับพนักงานที่เลือกทั้งหมด ' + ids.length + ' รายการ ใช่หรือไม่?')) {
    return;
  }

  showToast('กำลังบันทึกข้อมูล...', 'info');
  callApi('batchSetAttendanceEarlyDismissal', {
    ids: ids,
    enabled: enabled,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (r && r.success) {
        showToast(r.message || 'บันทึกสถานะเรียบร้อยแล้ว');
        deselectAllAttendanceLogs();
        loadTimeAttendanceDashboard();
      } else {
        showToast((r && r.message) || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
      }
    })
    .catch(function(err) {
      showToast('เกิดข้อผิดพลาด: ' + (err.message || err), 'error');
    });
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
// ATTENDANCE EDIT MODAL CONTROLLER & AUTO-CALCULATOR
var _activeAttendanceEditLog = null;

function parseTimeToMin(timeStr) {
  if (!timeStr) return null;
  var s = String(timeStr).trim();
  var p = s.split(':');
  if (p.length < 2) {
    if (/^\d{1,2}$/.test(s)) {
      return parseInt(s, 10) * 60;
    }
    return null;
  }
  var h = parseInt(p[0], 10);
  var m = parseInt(p[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return (h * 60) + m;
}

function setAttendanceEditClockOut(val) {
  var targetTime = val;
  if (val === 'NOW') {
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    targetTime = hh + ':' + mm + ':' + ss;
  }
  var el = document.getElementById('editAttClockOut');
  if (el) {
    el.value = targetTime;
    autoCalculateAttendanceHours(true);
  }
}

function onAttendanceTimeInputChange() {
  autoCalculateAttendanceHours(true);
}

function autoCalculateAttendanceHours(isUserAction) {
  var clockIn = (document.getElementById('editAttClockIn') ? document.getElementById('editAttClockIn').value : '').trim();
  var clockOut = (document.getElementById('editAttClockOut') ? document.getElementById('editAttClockOut').value : '').trim();
  var breakOut = (document.getElementById('editAttBreakOut') ? document.getElementById('editAttBreakOut').value : '').trim();
  var breakIn = (document.getElementById('editAttBreakIn') ? document.getElementById('editAttBreakIn').value : '').trim();
  var breakMinInput = Number(document.getElementById('editAttBreakMinutes') ? document.getElementById('editAttBreakMinutes').value : 0) || 0;
  var isFullPay = !!(document.getElementById('editAttIsFullPay') && document.getElementById('editAttIsFullPay').checked);
  var dateStr = (document.getElementById('editAttDate') ? document.getElementById('editAttDate').value : '').trim();

  var helper = document.getElementById('editAttCalcHelper');
  var otBadge = document.getElementById('editAttOtBadge');
  var otText = document.getElementById('editAttOtHoursText');

  if (!clockIn) {
    if (helper) helper.style.display = 'none';
    if (otBadge) otBadge.style.display = 'none';
    return;
  }

  var inMin = parseTimeToMin(clockIn);
  if (inMin === null) return;

  // Retrieve branch schedule
  var branch = null;
  var bList = State.branches || [];
  if (_activeAttendanceEditLog) {
    var bId = _activeAttendanceEditLog.branch_id || _activeAttendanceEditLog.emp_branch_id;
    branch = bList.find(function(b) { return b.branch_id === bId; });
  }

  var workStartStr = (branch && branch.work_start_time) || '09:30';
  var workEndStr = (branch && branch.work_end_time) || '19:00';
  var lunchStartStr = (branch && branch.lunch_start_time) || '13:00';
  var lunchEndStr = (branch && branch.lunch_end_time) || '14:00';
  var otStartStr = (branch && branch.ot_start_time) || workEndStr;
  var graceMin = Number(branch && branch.grace_minutes) || 0;

  var workStartMin = parseTimeToMin(workStartStr) || (9 * 60 + 30);
  var workEndMin = parseTimeToMin(workEndStr) || (19 * 60);
  var lunchStartMin = parseTimeToMin(lunchStartStr) || (13 * 60);
  var lunchEndMin = parseTimeToMin(lunchEndStr) || (14 * 60);
  var otStartMin = parseTimeToMin(otStartStr) || (19 * 60);

  // 1. Late minutes & status
  var lateMin = 0;
  if (inMin > (workStartMin + graceMin)) {
    lateMin = inMin - workStartMin;
  }

  var lateMinInputEl = document.getElementById('editAttLateMinutes');
  if (lateMinInputEl) lateMinInputEl.value = lateMin;

  var statusInputEl = document.getElementById('editAttStatus');
  if (statusInputEl) {
    if (lateMin === 0 && statusInputEl.value === 'LATE') {
      statusInputEl.value = 'NORMAL';
    } else if (lateMin > 0 && statusInputEl.value === 'NORMAL') {
      statusInputEl.value = 'LATE';
    }
  }

  if (!clockOut) {
    if (helper) {
      helper.style.display = 'block';
      helper.style.background = '#fffbeb';
      helper.style.border = '1px solid #fde68a';
      helper.style.color = '#b45309';
      helper.innerHTML = '<i class="fa-solid fa-clock text-amber"></i> เวลาเข้างานคำนวณแล้ว (' + (lateMin > 0 ? '<b style="color:#dc2626">สาย ' + lateMin + ' นาที</b>' : '<b style="color:#059669">ตรงเวลา ไม่สาย</b>') + ') — กรุณากรอก <b>เวลาออกงาน (Clock Out)</b> เพื่อให้ระบบคำนวณชั่วโมงทำงานอัตโนมัติ';
    }
    if (otBadge) otBadge.style.display = 'none';
    return;
  }

  var outMin = parseTimeToMin(clockOut);
  if (outMin === null) return;

  // Day of week
  var isSunday = false;
  if (dateStr) {
    var dt = new Date(dateStr + 'T00:00:00');
    if (!isNaN(dt.getTime()) && dt.getDay() === 0) isSunday = true;
  }

  // 2. Break minutes
  var bOutMin = parseTimeToMin(breakOut);
  var bInMin = parseTimeToMin(breakIn);
  var breakMin = 0;
  if (bOutMin !== null && bInMin !== null && bInMin > bOutMin) {
    breakMin = bInMin - bOutMin;
  } else if (breakMinInput > 0) {
    breakMin = breakMinInput;
  } else if (Math.max(inMin, workStartMin) <= lunchStartMin && (isSunday ? outMin >= lunchEndMin : Math.min(outMin, workEndMin) >= lunchEndMin)) {
    breakMin = 60; // Standard 1-hour lunch break
  }

  // 3. Work hours & OT hours
  var effectiveInMin = Math.max(inMin, workStartMin);
  var workHrs = 0;
  var otHrs = 0;

  if (isFullPay) {
    // Approved full pay for completing work early
    workHrs = Math.max(0, Math.round(((workEndMin - workStartMin - breakMin) / 60) * 10) / 10);
    if (workHrs <= 0) workHrs = 8.5;
  } else if (isSunday) {
    // Sunday work: all counts as OT/Sunday work
    var totalSunMin = Math.max(0, outMin - effectiveInMin - breakMin);
    otHrs = Math.floor(totalSunMin / 30) * 0.5;
    workHrs = 0;
  } else {
    // Normal workday
    var cappedEndMin = Math.min(outMin, workEndMin);
    var normalMin = Math.max(0, cappedEndMin - effectiveInMin - breakMin);
    workHrs = Math.round((normalMin / 60) * 10) / 10;

    // OT after otStartMin
    if (outMin > otStartMin) {
      var otMin = outMin - otStartMin;
      otHrs = Math.floor(otMin / 30) * 0.5;
    }
  }

  // Update input values
  var workHrsInput = document.getElementById('editAttWorkHours');
  if (workHrsInput) workHrsInput.value = workHrs;
  var otHrsInput = document.getElementById('editAttOtHours');
  if (otHrsInput) otHrsInput.value = otHrs;
  var breakMinInputEl = document.getElementById('editAttBreakMinutes');
  if (breakMinInputEl) breakMinInputEl.value = breakMin;
  var lateMinInputEl = document.getElementById('editAttLateMinutes');
  if (lateMinInputEl) lateMinInputEl.value = lateMin;

  updateAttendanceCalcHelper(workHrs, otHrs, breakMin, lateMin, true);
}

function updateAttendanceCalcHelper(workHrs, otHrs, breakMin, lateMin, isCalculated) {
  var helper = document.getElementById('editAttCalcHelper');
  var otBadge = document.getElementById('editAttOtBadge');
  var otText = document.getElementById('editAttOtHoursText');

  if (otBadge && otText) {
    if (otHrs > 0) {
      otBadge.style.display = 'inline-block';
      otText.textContent = otHrs;
    } else {
      otBadge.style.display = 'none';
    }
  }

  if (helper) {
    helper.style.display = 'block';
    helper.style.background = '#eff6ff';
    helper.style.border = '1px solid #bfdbfe';
    helper.style.color = '#1e40af';
    helper.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles text-blue"></i> <b>คำนวณอัตโนมัติ:</b> เวลาทำงานปกติ <b style="color:#059669;font-size:13px">' + workHrs + ' ชม.</b>' +
      (otHrs > 0 ? ' + <b style="color:#7c3aed;font-size:13px">OT ' + otHrs + ' ชม.</b>' : '') +
      ' <span style="color:#64748b;font-weight:500;margin-left:6px">(หักพัก ' + breakMin + ' นาที' + (lateMin > 0 ? ' | สาย ' + lateMin + ' นาที' : ' | ไม่สาย') + ')</span>';
  }
}

function openEditAttendanceLogModal(id) {
  var log = (_currentAttendanceLogs || []).find(function(x) { return x.id === Number(id); });
  if (!log) {
    showToast('ไม่พบข้อมูลรายการลงเวลานี้', 'error');
    return;
  }
  _activeAttendanceEditLog = log;

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
  if (document.getElementById('editAttOtHours')) document.getElementById('editAttOtHours').value = log.ot_hours || 0;
  document.getElementById('editAttRemark').value = log.remark || '';

  var isFullPay = (log.is_full_pay === 1 || log.is_full_pay === '1' || (log.remark && log.remark.includes('งานเสร็จเลิกงานก่อน-จ่ายเต็มวัน')));
  if (document.getElementById('editAttIsFullPay')) {
    document.getElementById('editAttIsFullPay').checked = !!isFullPay;
  }

  // If clock_in and clock_out are present, but work_hours is 0 or was not calculated, auto calculate immediately!
  if (log.clock_in && log.clock_out && (Number(log.work_hours) === 0 || !log.work_hours)) {
    autoCalculateAttendanceHours(false);
  } else if (log.clock_in && log.clock_out) {
    // Show helper with existing values
    updateAttendanceCalcHelper(Number(log.work_hours) || 0, Number(log.ot_hours) || 0, Number(log.break_minutes) || 0, Number(log.late_minutes) || 0, false);
  } else {
    var helper = document.getElementById('editAttCalcHelper');
    if (helper) {
      if (log.clock_in && !log.clock_out) {
        helper.style.display = 'block';
        helper.style.background = '#fffbeb';
        helper.style.border = '1px solid #fde68a';
        helper.style.color = '#b45309';
        helper.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> กรุณากรอกหรือเลือก <b>เวลาออกงาน (Clock Out)</b> เพื่อให้ระบบคำนวณชั่วโมงทำงานอัตโนมัติ';
      } else {
        helper.style.display = 'none';
      }
    }
    var otBadge = document.getElementById('editAttOtBadge');
    if (otBadge) otBadge.style.display = 'none';
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
  var otHours = Number(document.getElementById('editAttOtHours') ? document.getElementById('editAttOtHours').value : 0) || 0;
  var status = document.getElementById('editAttStatus').value;
  var remark = document.getElementById('editAttRemark').value.trim();
  var isFullPay = (document.getElementById('editAttIsFullPay') && document.getElementById('editAttIsFullPay').checked) ? 1 : 0;

  // Auto-calculate derived fields (late minutes, status, work hours, OT) if clockIn is present
  if (clockIn) {
    autoCalculateAttendanceHours(true);
    workHours = Number(document.getElementById('editAttWorkHours').value) || 0;
    otHours = Number(document.getElementById('editAttOtHours') ? document.getElementById('editAttOtHours').value : 0) || 0;
    breakMinutes = Number(document.getElementById('editAttBreakMinutes').value) || 0;
    lateMinutes = Number(document.getElementById('editAttLateMinutes').value) || 0;
    status = document.getElementById('editAttStatus').value;
  }

  callApi('updateAttendanceLog', {
    id: id,
    clockIn: clockIn,
    clockOut: clockOut,
    breakOut: breakOut,
    breakIn: breakIn,
    breakMinutes: breakMinutes,
    lateMinutes: lateMinutes,
    workHours: workHours,
    otHours: otHours,
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

function formatDateThaiBE(dateStr) {
  if (!dateStr || dateStr === '-') return '-';
  var s = String(dateStr).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  var parts = s.substring(0, 10).split('-');
  if (parts.length === 3) {
    var y = parseInt(parts[0], 10);
    var m = parts[1];
    var d = parts[2];
    if (!isNaN(y) && y > 0) {
      var beYear = y < 2400 ? (y + 543) : y;
      return d + '/' + m + '/' + beYear;
    }
  }
  return dateStr;
}

function parseInputDateToIso(str) {
  if (!str) return '';
  var s = String(str).trim();
  var match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    var d = (match[1].length < 2 ? '0' : '') + match[1];
    var m = (match[2].length < 2 ? '0' : '') + match[2];
    var y = parseInt(match[3], 10);
    if (y > 2400) y -= 543;
    return y + '-' + m + '-' + d;
  }
  return s.substring(0, 10);
}

function updateJoinDateThaiHint() {
  var el = document.getElementById('mJoinDate');
  var hint = document.getElementById('mJoinDateThaiHint');
  if (el && hint) {
    if (el.value) {
      hint.textContent = '📅 วันที่ (พ.ศ.): ' + formatDateThaiBE(el.value);
    } else {
      hint.textContent = '';
    }
  }
}

function updateBirthDateThaiHint() {
  var el = document.getElementById('mBirthDate');
  var hint = document.getElementById('mBirthDateThaiHint');
  if (el && hint) {
    if (el.value) {
      hint.textContent = '📅 วันเกิด (พ.ศ.): ' + formatDateThaiBE(el.value);
    } else {
      hint.textContent = '';
    }
  }
}

function updateProbEndDateThaiHint() {
  var el = document.getElementById('mProbationEndDate');
  var hint = document.getElementById('mProbationEndDateThaiHint');
  if (el && hint) {
    if (el.value) {
      hint.textContent = '📅 ครบโปร (พ.ศ.): ' + formatDateThaiBE(el.value);
    } else {
      hint.textContent = '';
    }
  }
}

function updateResignDateThaiHint() {
  var el = document.getElementById('mResignDate');
  var hint = document.getElementById('mResignDateThaiHint');
  if (el && hint) {
    if (el.value) {
      hint.textContent = '📅 วันที่ลาออก (พ.ศ.): ' + formatDateThaiBE(el.value);
    } else {
      hint.textContent = '';
    }
  }
}

function formatThaiDateTime(dtStr) {
  if (!dtStr) return '-';
  var s = String(dtStr).trim();
  // If ISO format with Z or offset (e.g. 2026-09-26T05:57:18.000Z)
  if (s.indexOf('T') !== -1 && (s.indexOf('Z') !== -1 || s.indexOf('+') !== -1)) {
    try {
      var d = new Date(s);
      if (!isNaN(d.getTime())) {
        var bkk = new Date(d.getTime() + (7 * 3600 * 1000) + (d.getTimezoneOffset() * 60 * 1000));
        var y = bkk.getFullYear() + 543;
        var m = (bkk.getMonth() + 1 < 10 ? '0' : '') + (bkk.getMonth() + 1);
        var day = (bkk.getDate() < 10 ? '0' : '') + bkk.getDate();
        var hh = (bkk.getHours() < 10 ? '0' : '') + bkk.getHours();
        var mm = (bkk.getMinutes() < 10 ? '0' : '') + bkk.getMinutes();
        return day + '/' + m + '/' + y + ' ' + hh + ':' + mm + ' น.';
      }
    } catch(e) {}
  }
  // Standard format YYYY-MM-DD HH:mm:ss or YYYY-MM-DD HH:mm
  if (s.length >= 16) {
    var datePart = s.substring(0, 10);
    var timePart = s.substring(11, 16);
    return formatDateThaiBE(datePart) + ' ' + timePart + ' น.';
  }
  return formatDateThaiBE(s);
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
    html += '<button type="button" class="btn btn-sm" style="background:#f0f9ff;color:#0369a1;font-weight:600;border:1px solid #bae6fd" title="แก้ไขรายละเอียดคำขอ" onclick="openEditAttendanceRequestModal(\'' + type + '\', ' + item.id + ')"><i class="fa-solid fa-pen-to-square"></i> แก้ไข</button>';
    html += '<button type="button" class="btn btn-sm" style="background:#fff;color:#ef4444;font-weight:600;border:1px solid #fca5a5" title="ลบคำขอนี้ออกจากระบบถาวร" onclick="deleteAttendanceRequest(\'' + type + '\', ' + item.id + ')"><i class="fa-solid fa-trash-can"></i> ลบ</button>';
  } else if (status === 'APPROVED') {
    html += '<button type="button" class="btn btn-sm" style="background:#f0f9ff;color:#0369a1;font-weight:600;border:1px solid #bae6fd" title="แก้ไขรายละเอียดคำขอ" onclick="openEditAttendanceRequestModal(\'' + type + '\', ' + item.id + ')"><i class="fa-solid fa-pen-to-square"></i> แก้ไข</button>';
    html += '<button type="button" class="btn btn-sm" style="background:#fff7ed;color:#c2410c;font-weight:700;border:1px solid #fed7aa" title="ยกเลิกการอนุมัติและลบคำขอ" onclick="approveAttendanceRequest(\'' + type + '\', ' + item.id + ', \'DELETE\')"><i class="fa-solid fa-ban"></i> ยกเลิกอนุมัติ</button>';
    html += '<button type="button" class="btn btn-sm" style="background:#fee2e2;color:#dc2626;font-weight:700;border:1px solid #fca5a5" title="ลบคำขอนี้ออกจากระบบถาวร" onclick="deleteAttendanceRequest(\'' + type + '\', ' + item.id + ')"><i class="fa-solid fa-trash-can"></i> ลบคำขอ</button>';
  } else {
    // REJECTED
    html += '<button type="button" class="btn btn-sm btn-green" style="font-weight:700" title="เปลี่ยนใจกลับมาอนุมัติคำขอนี้" onclick="approveAttendanceRequest(\'' + type + '\', ' + item.id + ', \'APPROVE\')"><i class="fa-solid fa-rotate-left"></i> เปลี่ยนเป็นอนุมัติ</button>';
    html += '<button type="button" class="btn btn-sm" style="background:#f0f9ff;color:#0369a1;font-weight:600;border:1px solid #bae6fd" title="แก้ไขรายละเอียดคำขอ" onclick="openEditAttendanceRequestModal(\'' + type + '\', ' + item.id + ')"><i class="fa-solid fa-pen-to-square"></i> แก้ไข</button>';
    html += '<button type="button" class="btn btn-sm" style="background:#fee2e2;color:#dc2626;font-weight:700;border:1px solid #fca5a5" title="ลบคำขอนี้ออกจากระบบถาวร" onclick="deleteAttendanceRequest(\'' + type + '\', ' + item.id + ')"><i class="fa-solid fa-trash-can"></i> ลบคำขอ</button>';
  }
  return html;
}

function renderTimeAttendanceApprovals(leaves, ots, advances) {
  var container = document.getElementById('attPendingListContainer');
  var countEl = document.getElementById('attPendingCountDisplay');
  if (!container) return;

  State.attendanceCurrentRequests = {
    leave: leaves || [],
    ot: ots || [],
    advance: advances || []
  };

  var total = (leaves ? leaves.length : 0) + (ots ? ots.length : 0) + (advances ? advances.length : 0);
  if (countEl) countEl.textContent = total;

  var subBadge = document.getElementById('attSubTabBadgeApprovals');
  if (subBadge) {
    var pCount = 0;
    if (_currentAttendanceRequestStatus === 'PENDING' || !_currentAttendanceRequestStatus) {
      pCount = total;
    } else if (State.attendancePendingData) {
      pCount = (State.attendancePendingData.leaves || []).length +
               (State.attendancePendingData.ots || []).length +
               (State.attendancePendingData.advances || []).length;
    }
    if (pCount > 0) {
      subBadge.textContent = pCount;
      subBadge.style.display = 'inline-block';
    } else {
      subBadge.style.display = 'none';
    }
  }

  if (total === 0) {
    var bulkToolbarEmpty = document.getElementById('attReqBulkToolbar');
    if (bulkToolbarEmpty) bulkToolbarEmpty.style.display = 'none';

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

  var canApprove = hasPermission('approve_attendance') || isSuperAdmin();
  var html = '';

  // Leaves
  (leaves || []).forEach(function(item) {
    var typeLabel = 'ขอลางาน (' + (item.leave_type || 'ทั่วไป') + ')';
    var chkHtml = canApprove
      ? '<input type="checkbox" class="att-req-checkbox" data-req-type="leave" data-req-id="' + item.id + '" data-req-status="' + esc(item.status || 'PENDING') + '" data-req-amount="0" onchange="onAttReqCheckboxChange(this)" style="width:16px;height:16px;accent-color:#2563eb;cursor:pointer;margin:0">'
      : '';
    html += '<div class="att-req-card-item" style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #3b82f6;border-radius:8px;padding:12px;transition:background 0.15s ease,border-color 0.15s ease">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px">' +
        '<div style="display:flex;gap:7px;align-items:center">' +
          chkHtml +
          '<span style="font-size:11px;font-weight:700;color:#1d4ed8;background:#dbeafe;padding:2px 8px;border-radius:12px">' + typeLabel + '</span>' +
          getAttendanceStatusBadge(item.status) +
        '</div>' +
        '<span style="font-size:11px;color:#64748b" title="วันที่ยื่นคำขอ (เวลาประเทศไทย)"><i class="fa-regular fa-clock" style="font-size:10px"></i> ยื่น: ' + formatThaiDateTime(item.created_at) + '</span>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px">' + esc(formatEmpNameWithNick(item.full_name, item.emp_id, item.nickname)) + ' <span style="font-size:11px;font-weight:400;color:#64748b">(' + (item.department || '-') + ')</span></div>' +
      '<div style="font-size:12px;color:#334155;margin-bottom:4px"><i class="fa-regular fa-calendar text-blue"></i> วันที่ลา: <b>' + formatDateThaiBE(item.start_date) + '</b> ถึง <b>' + formatDateThaiBE(item.end_date) + '</b> (' + (item.days_count || 1) + ' วัน' + (item.time_slot === 'MORNING' ? ' <span style="font-size:10.5px;color:#b45309;background:#fef3c7;padding:1px 6px;border-radius:4px;font-weight:700">🌅 ครึ่งวันเช้า</span>' : (item.time_slot === 'AFTERNOON' ? ' <span style="font-size:10.5px;color:#1d4ed8;background:#dbeafe;padding:1px 6px;border-radius:4px;font-weight:700">🌆 ครึ่งวันบ่าย</span>' : '')) + ')</div>' +
      (item.reason ? '<div style="font-size:11.5px;color:#475569;background:#fff;padding:6px 8px;border-radius:6px;border:1px dashed #cbd5e1;margin-bottom:8px">เหตุผล: ' + item.reason + '</div>' : '') +
      (item.medical_cert_url ? 
        '<div style="margin-bottom:8px">' +
          '<button type="button" class="btn btn-sm" onclick="previewAttendancePhoto(\'' + esc(item.medical_cert_url) + '\', \'ใบรับรองแพทย์: ' + esc(formatEmpNameWithNick(item.full_name, item.emp_id, item.nickname)) + '\', \'วันที่ลา: ' + esc(formatDateThaiBE(item.start_date)) + ' ถึง ' + esc(formatDateThaiBE(item.end_date)) + ' (' + esc(item.leave_type || '') + ')\')" style="background:#eff6ff;border:1.5px solid #93c5fd;color:#1d4ed8;font-size:11.5px;font-weight:700;padding:5px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 1px 2px rgba(0,0,0,0.05)">' +
            '<i class="fa-solid fa-file-medical" style="color:#2563eb;font-size:13px"></i> ดูรูปใบรับรองแพทย์แนบ (คลิกเพื่อดูภาพขยาย)' +
          '</button>' +
        '</div>' : '') +
      '<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px">' +
        getAttendanceActionButtons('leave', item) +
      '</div>' +
    '</div>';
  });

  // OTs
  (ots || []).forEach(function(item) {
    var chkHtml = canApprove
      ? '<input type="checkbox" class="att-req-checkbox" data-req-type="ot" data-req-id="' + item.id + '" data-req-status="' + esc(item.status || 'PENDING') + '" data-req-amount="0" onchange="onAttReqCheckboxChange(this)" style="width:16px;height:16px;accent-color:#2563eb;cursor:pointer;margin:0">'
      : '';
    html += '<div class="att-req-card-item" style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:8px;padding:12px;transition:background 0.15s ease,border-color 0.15s ease">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px">' +
        '<div style="display:flex;gap:7px;align-items:center">' +
          chkHtml +
          '<span style="font-size:11px;font-weight:700;color:#b45309;background:#fef3c7;padding:2px 8px;border-radius:12px">ขอทำ OT</span>' +
          getAttendanceStatusBadge(item.status) +
        '</div>' +
        '<span style="font-size:11px;color:#64748b" title="วันที่ยื่นคำขอ (เวลาประเทศไทย)"><i class="fa-regular fa-clock" style="font-size:10px"></i> ยื่น: ' + formatThaiDateTime(item.created_at) + '</span>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px">' + esc(formatEmpNameWithNick(item.full_name, item.emp_id, item.nickname)) + ' <span style="font-size:11px;font-weight:400;color:#64748b">(' + (item.department || '-') + ')</span></div>' +
      '<div style="font-size:12px;color:#334155;margin-bottom:4px"><i class="fa-regular fa-calendar text-orange"></i> วันที่ทำ OT: <b>' + formatDateThaiBE(item.date) + '</b> | จำนวน <b>' + (item.planned_hours || item.actual_hours || 0) + ' ชม.</b></div>' +
      (item.reason ? '<div style="font-size:11.5px;color:#475569;background:#fff;padding:6px 8px;border-radius:6px;border:1px dashed #cbd5e1;margin-bottom:8px">เหตุผล: ' + item.reason + '</div>' : '') +
      '<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px">' +
        getAttendanceActionButtons('ot', item) +
      '</div>' +
    '</div>';
  });

  // Advances
  (advances || []).forEach(function(item) {
    var chkHtml = canApprove
      ? '<input type="checkbox" class="att-req-checkbox" data-req-type="advance" data-req-id="' + item.id + '" data-req-status="' + esc(item.status || 'PENDING') + '" data-req-amount="' + (Number(item.amount) || 0) + '" onchange="onAttReqCheckboxChange(this)" style="width:16px;height:16px;accent-color:#2563eb;cursor:pointer;margin:0">'
      : '';
    html += '<div class="att-req-card-item" style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #10b981;border-radius:8px;padding:12px;transition:background 0.15s ease,border-color 0.15s ease">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:6px">' +
        '<div style="display:flex;gap:7px;align-items:center">' +
          chkHtml +
          '<span style="font-size:11px;font-weight:700;color:#047857;background:#d1fae5;padding:2px 8px;border-radius:12px">ขอเบิกเงินล่วงหน้า</span>' +
          getAttendanceStatusBadge(item.status) +
        '</div>' +
        '<span style="font-size:11px;color:#64748b" title="วันที่ยื่นคำขอ (เวลาประเทศไทย)"><i class="fa-regular fa-clock" style="font-size:10px"></i> ยื่น: ' + formatThaiDateTime(item.created_at) + '</span>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px">' + esc(formatEmpNameWithNick(item.full_name, item.emp_id, item.nickname)) + ' <span style="font-size:11px;font-weight:400;color:#64748b">(' + (item.department || '-') + ')</span></div>' +
      '<div style="font-size:12px;color:#334155;margin-bottom:2px"><i class="fa-regular fa-calendar text-green"></i> วันที่ขอเบิก: <b>' + formatDateThaiBE(item.request_date) + '</b></div>' +
      '<div style="font-size:13px;color:#047857;font-weight:700;margin-bottom:4px"><i class="fa-solid fa-money-bill-wave"></i> จำนวนเงิน: ฿' + Number(item.amount || 0).toLocaleString() + ' บาท</div>' +
      (item.reason ? '<div style="font-size:11.5px;color:#475569;background:#fff;padding:6px 8px;border-radius:6px;border:1px dashed #cbd5e1;margin-bottom:8px">เหตุผล: ' + item.reason + '</div>' : '') +
      '<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px">' +
        getAttendanceActionButtons('advance', item) +
      '</div>' +
    '</div>';
  });

  container.innerHTML = html;
  updateAttReqBatchToolbar();
}

function toggleSelectAllAttRequests(checked) {
  var checkboxes = document.querySelectorAll('#attPendingListContainer .att-req-checkbox');
  checkboxes.forEach(function(cb) {
    cb.checked = !!checked;
    var card = cb.closest('.att-req-card-item');
    if (card) {
      card.style.background = cb.checked ? '#eff6ff' : '#f8fafc';
    }
  });
  updateAttReqBatchToolbar();
}

function onAttReqCheckboxChange(cb) {
  if (cb) {
    var card = cb.closest('.att-req-card-item');
    if (card) {
      card.style.background = cb.checked ? '#eff6ff' : '#f8fafc';
    }
  }
  updateAttReqBatchToolbar();
}

function clearAllAttRequestSelections() {
  var masterCb = document.getElementById('chkSelectAllAttRequests');
  if (masterCb) {
    masterCb.checked = false;
    masterCb.indeterminate = false;
  }
  toggleSelectAllAttRequests(false);
}

function updateAttReqBatchToolbar() {
  var toolbar = document.getElementById('attReqBulkToolbar');
  if (!toolbar) return;

  var canApprove = hasPermission('approve_attendance') || isSuperAdmin();
  var allCbs = Array.prototype.slice.call(document.querySelectorAll('#attPendingListContainer .att-req-checkbox'));
  var totalVisible = allCbs.length;

  if (!canApprove || totalVisible === 0) {
    toolbar.style.display = 'none';
    return;
  }

  toolbar.style.display = 'flex';

  var totalVisibleEl = document.getElementById('attReqTotalVisibleCount');
  if (totalVisibleEl) totalVisibleEl.textContent = totalVisible;

  var checkedCbs = allCbs.filter(function(cb) { return cb.checked; });
  var pendingCbs = allCbs.filter(function(cb) { return (cb.getAttribute('data-req-status') || 'PENDING') === 'PENDING'; });

  var masterCb = document.getElementById('chkSelectAllAttRequests');
  if (masterCb) {
    masterCb.checked = checkedCbs.length === totalVisible && totalVisible > 0;
    masterCb.indeterminate = checkedCbs.length > 0 && checkedCbs.length < totalVisible;
  }

  var selectedWrap = document.getElementById('attReqSelectedStatusWrap');
  var selectedCountEl = document.getElementById('attReqSelectedCount');
  var summaryBadgeEl = document.getElementById('attReqSelectedSummaryBadge');
  var batchActionBtns = document.getElementById('attReqBatchActionBtns');
  var btnApproveCountEl = document.getElementById('btnBatchApproveReqCount');
  var btnQuickPending = document.getElementById('btnApproveAllPendingVisible');
  var btnQuickPendingCount = document.getElementById('attReqAllPendingBtnCount');

  if (checkedCbs.length > 0) {
    if (selectedWrap) selectedWrap.style.display = 'inline-flex';
    if (selectedCountEl) selectedCountEl.textContent = checkedCbs.length;
    if (btnApproveCountEl) btnApproveCountEl.textContent = checkedCbs.length;
    if (batchActionBtns) batchActionBtns.style.display = 'inline-flex';
    if (btnQuickPending) btnQuickPending.style.display = 'none';

    var leaveCnt = 0, otCnt = 0, advCnt = 0, advSum = 0;
    checkedCbs.forEach(function(cb) {
      var t = cb.getAttribute('data-req-type');
      if (t === 'leave') leaveCnt++;
      else if (t === 'ot') otCnt++;
      else if (t === 'advance') {
        advCnt++;
        advSum += Number(cb.getAttribute('data-req-amount') || 0);
      }
    });
    var parts = [];
    if (leaveCnt > 0) parts.push('ลา ' + leaveCnt);
    if (otCnt > 0) parts.push('OT ' + otCnt);
    if (advCnt > 0) parts.push('เบิก ' + advCnt + ' (฿' + advSum.toLocaleString() + ')');
    if (summaryBadgeEl) {
      summaryBadgeEl.textContent = parts.length > 0 ? '(' + parts.join(' · ') + ')' : '';
    }
  } else {
    if (selectedWrap) selectedWrap.style.display = 'none';
    if (batchActionBtns) batchActionBtns.style.display = 'none';
    if (btnQuickPending) {
      if (pendingCbs.length > 0) {
        btnQuickPending.style.display = 'inline-flex';
        if (btnQuickPendingCount) btnQuickPendingCount.textContent = pendingCbs.length;
      } else {
        btnQuickPending.style.display = 'none';
      }
    }
  }
}

function approveAllVisiblePendingRequests() {
  var allCbs = Array.prototype.slice.call(document.querySelectorAll('#attPendingListContainer .att-req-checkbox'));
  var pendingCbs = allCbs.filter(function(cb) { return (cb.getAttribute('data-req-status') || 'PENDING') === 'PENDING'; });
  if (pendingCbs.length === 0) {
    showToast('ไม่มีรายการรออนุมัติในหน้านี้', 'warning');
    return;
  }
  allCbs.forEach(function(cb) {
    var isPending = (cb.getAttribute('data-req-status') || 'PENDING') === 'PENDING';
    cb.checked = isPending;
    var card = cb.closest('.att-req-card-item');
    if (card) card.style.background = isPending ? '#eff6ff' : '#f8fafc';
  });
  updateAttReqBatchToolbar();
  batchApproveSelectedRequests('APPROVE');
}

function batchApproveSelectedRequests(decision) {
  var checkedCbs = Array.prototype.slice.call(document.querySelectorAll('#attPendingListContainer .att-req-checkbox:checked'));
  if (checkedCbs.length === 0) {
    showToast('กรุณาติ๊กเลือกรายการคำขออย่างน้อย 1 รายการ', 'warning');
    return;
  }

  var items = [];
  var leaveCnt = 0, otCnt = 0, advCnt = 0, advSum = 0;
  checkedCbs.forEach(function(cb) {
    var type = cb.getAttribute('data-req-type');
    var id = Number(cb.getAttribute('data-req-id'));
    if (type && id) {
      items.push({ type: type, id: id });
      if (type === 'leave') leaveCnt++;
      else if (type === 'ot') otCnt++;
      else if (type === 'advance') {
        advCnt++;
        advSum += Number(cb.getAttribute('data-req-amount') || 0);
      }
    }
  });

  var breakdownLines = [];
  if (leaveCnt > 0) breakdownLines.push('• ขอลางาน: ' + leaveCnt + ' รายการ');
  if (otCnt > 0) breakdownLines.push('• ขอทำ OT: ' + otCnt + ' รายการ');
  if (advCnt > 0) breakdownLines.push('• ขอเบิกเงินล่วงหน้า: ' + advCnt + ' รายการ (รวม ฿' + advSum.toLocaleString() + ' บาท)');

  var actionText = decision === 'APPROVE' ? 'อนุมัติ' : (decision === 'DELETE' ? 'ลบถาวร' : 'ปฏิเสธ');
  var confirmMsg = 'ยืนยันการ "' + actionText + '" คำขอที่เลือกทั้งหมด ' + items.length + ' รายการ ?\n\n' + breakdownLines.join('\n');
  if (decision === 'DELETE') {
    confirmMsg += '\n\n⚠️ คำเตือน: รายการที่เลือกจะถูกลบออกจากฐานข้อมูลอย่างถาวรทันที';
  }
  if (!confirm(confirmMsg)) return;

  var reason = '';
  if (decision === 'REJECT') {
    reason = prompt('โปรดระบุเหตุผลการปฏิเสธสำหรับทั้ง ' + items.length + ' รายการ (ถ้ามี):', '') || '';
  }

  callApi('batchHandleAttendanceApprovals', {
    items: items,
    decision: decision,
    rejectionReason: reason,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (!r || !r.success) {
        showToast((r && r.message) || 'เกิดข้อผิดพลาดในการดำเนินการแบบกลุ่ม', 'error');
        return;
      }
      showToast(r.message || ('ดำเนินการ' + actionText + 'สำเร็จ ' + items.length + ' รายการ'), 'success');
      loadAttendanceRequests();
      loadTimeAttendanceDashboard();
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการดำเนินการแบบกลุ่ม', 'error');
    });
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
      loadAttendanceRequests();
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
      loadAttendanceRequests();
      loadTimeAttendanceDashboard();
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบคำขอ', 'error');
    });
}

function openEditAttendanceRequestModal(type, id) {
  var item = null;
  // Try current active/filtered requests list
  if (State.attendanceCurrentRequests && State.attendanceCurrentRequests[type]) {
    item = State.attendanceCurrentRequests[type].find(function(x) { return Number(x.id) === Number(id); });
  }
  // Fallback to State.attendancePendingData
  if (!item && State.attendancePendingData) {
    var key = type === 'leave' ? 'leaves' : (type === 'ot' ? 'ots' : 'advances');
    if (State.attendancePendingData[key]) {
      item = State.attendancePendingData[key].find(function(x) { return Number(x.id) === Number(id); });
    }
  }

  if (!item) {
    showToast('ไม่พบข้อมูลคำขอที่ต้องการแก้ไข', 'error');
    return;
  }

  // Set hidden values
  var typeEl = document.getElementById('editAttReqType');
  var idEl = document.getElementById('editAttReqId');
  if (typeEl) typeEl.value = type;
  if (idEl) idEl.value = id;

  // Set employee info & badge
  var nameEl = document.getElementById('editAttReqEmpName');
  var deptEl = document.getElementById('editAttReqEmpDept');
  var badgeEl = document.getElementById('editAttReqTypeBadge');
  if (nameEl) nameEl.textContent = formatEmpNameWithNick(item.full_name, item.emp_id, item.nickname) + (item.emp_id ? ' [' + item.emp_id + ']' : '');
  if (deptEl) deptEl.textContent = item.department || '-';

  var leaveSection = document.getElementById('editAttReqLeaveFields');
  var otSection = document.getElementById('editAttReqOtFields');
  var advSection = document.getElementById('editAttReqAdvanceFields');

  if (type === 'leave') {
    if (badgeEl) {
      badgeEl.textContent = 'คำขอลางาน';
      badgeEl.style.background = '#dbeafe';
      badgeEl.style.color = '#1d4ed8';
    }
    if (leaveSection) leaveSection.style.display = 'flex';
    if (otSection) otSection.style.display = 'none';
    if (advSection) advSection.style.display = 'none';

    var leaveTypeEl = document.getElementById('editAttReqLeaveType');
    var startDateEl = document.getElementById('editAttReqLeaveStartDate');
    var endDateEl = document.getElementById('editAttReqLeaveEndDate');
    var daysEl = document.getElementById('editAttReqLeaveDaysCount');
    var timeSlotEl = document.getElementById('editAttReqLeaveTimeSlot');

    if (leaveTypeEl) leaveTypeEl.value = item.leave_type || 'SICK_WITH_CERT';
    if (startDateEl) startDateEl.value = item.start_date || '';
    if (endDateEl) endDateEl.value = item.end_date || '';
    if (daysEl) daysEl.value = item.days_count || 1;
    if (timeSlotEl) {
      timeSlotEl.value = item.time_slot || (Number(item.days_count) === 0.5 ? 'MORNING' : 'FULL');
    }
  } else if (type === 'ot') {
    if (badgeEl) {
      badgeEl.textContent = 'คำขอทำ OT';
      badgeEl.style.background = '#fef3c7';
      badgeEl.style.color = '#b45309';
    }
    if (leaveSection) leaveSection.style.display = 'none';
    if (otSection) otSection.style.display = 'flex';
    if (advSection) advSection.style.display = 'none';

    var otDateEl = document.getElementById('editAttReqOtDate');
    var otStartEl = document.getElementById('editAttReqOtStartTime');
    var otEndEl = document.getElementById('editAttReqOtEndTime');
    var otHoursEl = document.getElementById('editAttReqOtHours');

    if (otDateEl) otDateEl.value = item.date || '';
    if (otStartEl) otStartEl.value = item.start_time || '';
    if (otEndEl) otEndEl.value = item.end_time || '';
    if (otHoursEl) otHoursEl.value = item.planned_hours || item.actual_hours || item.hours || 0;
  } else if (type === 'advance') {
    if (badgeEl) {
      badgeEl.textContent = 'คำขอเบิกเงินล่วงหน้า';
      badgeEl.style.background = '#d1fae5';
      badgeEl.style.color = '#047857';
    }
    if (leaveSection) leaveSection.style.display = 'none';
    if (otSection) otSection.style.display = 'none';
    if (advSection) advSection.style.display = 'flex';

    var advDateEl = document.getElementById('editAttReqAdvDate');
    var advAmtEl = document.getElementById('editAttReqAdvAmount');

    if (advDateEl) advDateEl.value = item.request_date || (item.created_at ? String(item.created_at).substring(0, 10) : '');
    if (advAmtEl) advAmtEl.value = item.amount || 0;
  }

  var reasonEl = document.getElementById('editAttReqReason');
  var statusEl = document.getElementById('editAttReqStatus');
  if (reasonEl) reasonEl.value = item.reason || '';
  if (statusEl) statusEl.value = item.status || 'PENDING';

  openModal('modalEditAttendanceRequest');
}

function onEditLeaveTimeSlotChanged() {
  var slotEl = document.getElementById('editAttReqLeaveTimeSlot');
  var daysEl = document.getElementById('editAttReqLeaveDaysCount');
  if (!slotEl || !daysEl) return;
  if (slotEl.value === 'MORNING' || slotEl.value === 'AFTERNOON') {
    daysEl.value = '0.5';
  } else if (slotEl.value === 'FULL') {
    if (parseFloat(daysEl.value) === 0.5) {
      daysEl.value = '1.0';
    }
  }
}

function saveEditAttendanceRequestForm(event) {
  if (event) event.preventDefault();
  var type = document.getElementById('editAttReqType').value;
  var id = document.getElementById('editAttReqId').value;
  if (!type || !id) return;

  var updates = {};
  if (type === 'leave') {
    updates = {
      leaveType: document.getElementById('editAttReqLeaveType').value,
      startDate: document.getElementById('editAttReqLeaveStartDate').value,
      endDate: document.getElementById('editAttReqLeaveEndDate').value,
      daysCount: parseFloat(document.getElementById('editAttReqLeaveDaysCount').value) || 1,
      timeSlot: document.getElementById('editAttReqLeaveTimeSlot') ? document.getElementById('editAttReqLeaveTimeSlot').value : 'FULL',
      reason: document.getElementById('editAttReqReason').value.trim(),
      status: document.getElementById('editAttReqStatus').value
    };
  } else if (type === 'ot') {
    updates = {
      date: document.getElementById('editAttReqOtDate').value,
      startTime: document.getElementById('editAttReqOtStartTime').value,
      endTime: document.getElementById('editAttReqOtEndTime').value,
      hours: parseFloat(document.getElementById('editAttReqOtHours').value) || 0,
      reason: document.getElementById('editAttReqReason').value.trim(),
      status: document.getElementById('editAttReqStatus').value
    };
  } else if (type === 'advance') {
    updates = {
      requestDate: document.getElementById('editAttReqAdvDate').value,
      amount: parseFloat(document.getElementById('editAttReqAdvAmount').value) || 0,
      reason: document.getElementById('editAttReqReason').value.trim(),
      status: document.getElementById('editAttReqStatus').value
    };
  }

  callApi('updateAttendanceRequest', {
    type: type,
    id: id,
    updates: updates,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      closeModal('modalEditAttendanceRequest');
      showToast(r.message || 'บันทึกการแก้ไขคำขอสำเร็จแล้ว', 'success');
      loadAttendanceRequests();
      loadTimeAttendanceDashboard();
      var kpiModal = document.getElementById('modalAttendanceKpiDetails');
      if (kpiModal && kpiModal.classList.contains('active')) {
        setTimeout(function() {
          renderAttendanceKpiModalList();
        }, 400);
      }
    })
    .catch(function(err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    });
}

// ==============================================================================
// HR / ADMIN MANUAL ATTENDANCE LOG ENTRY & REQUEST CREATION
// ==============================================================================

function openAddAttendanceLogModal() {
  if (!hasPermission('manage_time_logs') && !hasPermission('approve_attendance') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เพิ่มข้อมูลลงเวลา', 'warning');
    return;
  }

  // Populate employee select
  var empSel = document.getElementById('addAttEmpId');
  if (empSel) {
    empSel.innerHTML = '<option value="">-- กรุณาเลือกพนักงาน --</option>';
    var list = (State.employees || []).filter(function(e) {
      var st = String(e.status || 'Active').trim().toUpperCase();
      return st !== 'RESIGNED';
    });
    list.sort(function(a, b) {
      var idA = a.empId || a.emp_id || '';
      var idB = b.empId || b.emp_id || '';
      return idA.localeCompare(idB);
    });
    list.forEach(function(e) {
      var id = e.empId || e.emp_id || '';
      var name = e.fullName || e.full_name || e.name || '';
      var nick = e.nickname ? ' (' + e.nickname + ')' : '';
      var dept = e.department ? ' - ' + e.department : '';
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = '[' + id + '] ' + name + nick + dept;
      empSel.appendChild(opt);
    });

    // If an employee is currently filtered in attendance dashboard, select them by default
    var curFilterEmp = document.getElementById('attFilterEmp') ? document.getElementById('attFilterEmp').value : 'ALL';
    if (curFilterEmp && curFilterEmp !== 'ALL') {
      empSel.value = curFilterEmp;
    }
  }

  // Populate branch select
  var brSel = document.getElementById('addAttBranchId');
  if (brSel) {
    brSel.innerHTML = '';
    var branches = State.branches || [];
    branches.forEach(function(b) {
      var opt = document.createElement('option');
      opt.value = b.branch_id;
      opt.textContent = (b.branch_name || b.branch_id) + ' (' + (b.work_start_time || '09:30') + ' - ' + (b.work_end_time || '19:00') + ')';
      brSel.appendChild(opt);
    });
  }

  // Set default date
  var dateEl = document.getElementById('addAttDate');
  if (dateEl) {
    var curDate = document.getElementById('attFilterDate') ? document.getElementById('attFilterDate').value : '';
    dateEl.value = curDate || new Date().toISOString().substring(0, 10);
  }

  // Default times
  if (document.getElementById('addAttClockIn')) document.getElementById('addAttClockIn').value = '09:30';
  if (document.getElementById('addAttClockOut')) document.getElementById('addAttClockOut').value = '19:00';
  if (document.getElementById('addAttBreakOut')) document.getElementById('addAttBreakOut').value = '';
  if (document.getElementById('addAttBreakIn')) document.getElementById('addAttBreakIn').value = '';
  if (document.getElementById('addAttStatus')) document.getElementById('addAttStatus').value = 'NORMAL';
  if (document.getElementById('addAttRemark')) document.getElementById('addAttRemark').value = '';
  if (document.getElementById('addAttIsFullPay')) document.getElementById('addAttIsFullPay').checked = false;
  if (document.getElementById('addAttOverwrite')) document.getElementById('addAttOverwrite').checked = true;

  onAddAttendanceEmpChanged();
  onAddAttendanceTimeChanged();
  openModal('modalAddAttendanceLog');
}

function onAddAttendanceEmpChanged() {
  var empId = document.getElementById('addAttEmpId') ? document.getElementById('addAttEmpId').value : '';
  if (!empId) return;
  var emp = (State.employees || []).find(function(e) { return (e.empId || e.emp_id) === empId; });
  var brId = emp ? (emp.branchId || emp.branch_id) : '';
  if (brId && document.getElementById('addAttBranchId')) {
    document.getElementById('addAttBranchId').value = brId;
  }
  onAddAttendanceTimeChanged();
}

function setAddAttTime(type, timeStr) {
  if (type === 'in' && document.getElementById('addAttClockIn')) {
    document.getElementById('addAttClockIn').value = timeStr;
  } else if (type === 'out' && document.getElementById('addAttClockOut')) {
    document.getElementById('addAttClockOut').value = timeStr;
  }
  onAddAttendanceTimeChanged();
}

function onAddAttendanceTimeChanged() {
  var clockIn = document.getElementById('addAttClockIn') ? document.getElementById('addAttClockIn').value.trim() : '';
  var clockOut = document.getElementById('addAttClockOut') ? document.getElementById('addAttClockOut').value.trim() : '';
  var dateStr = document.getElementById('addAttDate') ? document.getElementById('addAttDate').value : '';
  var branchId = document.getElementById('addAttBranchId') ? document.getElementById('addAttBranchId').value : '';
  var isFullPay = document.getElementById('addAttIsFullPay') ? document.getElementById('addAttIsFullPay').checked : false;

  var branch = (State.branches || []).find(function(b) { return b.branch_id === branchId; }) || {};
  var toMin = function(s) {
    if (!s) return null;
    var p = String(s).trim().split(':');
    return p.length >= 2 ? (parseInt(p[0], 10) * 60 + parseInt(p[1], 10)) : null;
  };

  var inMin = toMin(clockIn);
  var outMin = toMin(clockOut);
  var startMin = toMin(branch.work_start_time) || (9 * 60 + 30);
  var endMin = toMin(branch.work_end_time) || (19 * 60);
  var lunchStart = toMin(branch.lunch_start_time) || (13 * 60);
  var lunchEnd = toMin(branch.lunch_end_time) || (14 * 60);
  var otStartMin = toMin(branch.ot_start_time || branch.work_end_time) || (19 * 60);

  var workHrs = 0;
  var otHrs = 0;
  var lateMin = 0;

  var d = new Date(dateStr + 'T00:00:00');
  var isSunday = (!isNaN(d.getTime()) && d.getDay() === 0);

  if (inMin !== null) {
    if (inMin > startMin) {
      lateMin = inMin - startMin;
    }
  }

  if (inMin !== null && outMin !== null) {
    var breakMin = 0;
    var bOut = toMin(document.getElementById('addAttBreakOut') ? document.getElementById('addAttBreakOut').value : '');
    var bIn = toMin(document.getElementById('addAttBreakIn') ? document.getElementById('addAttBreakIn').value : '');
    if (bOut !== null && bIn !== null && bIn > bOut) {
      breakMin = bIn - bOut;
    } else if (Math.max(inMin, startMin) <= lunchStart && outMin >= lunchEnd) {
      breakMin = 60;
    }

    if (isFullPay) {
      workHrs = Math.max(0, Math.round(((endMin - startMin - breakMin) / 60) * 10) / 10) || 8.5;
    } else if (isSunday) {
      var sunMin = Math.max(0, outMin - Math.max(inMin, startMin) - breakMin);
      otHrs = Math.floor(sunMin / 30) * 0.5;
      workHrs = 0;
    } else {
      var effIn = Math.max(inMin, startMin);
      var cappedOut = Math.min(outMin, endMin);
      var normMin = Math.max(0, cappedOut - effIn - breakMin);
      workHrs = Math.round((normMin / 60) * 10) / 10;

      if (outMin > otStartMin) {
        otHrs = Math.floor((outMin - otStartMin) / 30) * 0.5;
      }
    }
  }

  var previewEl = document.getElementById('addAttCalcPreviewText');
  if (previewEl) {
    if (inMin !== null && outMin === null) {
      previewEl.innerHTML = '<span style="color:#2563eb"><i class="fa-solid fa-user-clock"></i> ลงเวลาเข้า: <b>' + clockIn + '</b> (รอสแกนออก)</span> | ' +
                            '<span style="color:' + (lateMin > 0 ? '#b91c1c' : '#059669') + '">' + (lateMin > 0 ? 'สาย: <b>' + lateMin + '</b> นาที' : 'เข้างานตรงเวลา') + '</span>';
    } else {
      previewEl.innerHTML = '<span style="color:#15803d">ชั่วโมงทำงาน: <b>' + workHrs + '</b> ชม.</span> | ' +
                            '<span style="color:' + (lateMin > 0 ? '#b91c1c' : '#475569') + '">สาย: <b>' + lateMin + '</b> นาที</span> | ' +
                            '<span style="color:' + (otHrs > 0 ? '#ea580c' : '#475569') + '">OT: <b>' + otHrs + '</b> ชม.</span>';
    }
  }

  var statusSel = document.getElementById('addAttStatus');
  if (statusSel) {
    if (isSunday) {
      statusSel.value = 'SUNDAY_WORK';
    } else if (lateMin > 0 && statusSel.value === 'NORMAL') {
      statusSel.value = 'LATE';
    } else if (lateMin === 0 && statusSel.value === 'LATE') {
      statusSel.value = 'NORMAL';
    }
  }
}

function submitAddAttendanceLogForm(e) {
  if (e) e.preventDefault();

  var empId = document.getElementById('addAttEmpId').value;
  var date = document.getElementById('addAttDate').value;
  var branchId = document.getElementById('addAttBranchId').value;
  var clockIn = document.getElementById('addAttClockIn').value.trim();
  var clockOut = document.getElementById('addAttClockOut').value.trim();
  var breakOut = document.getElementById('addAttBreakOut').value.trim();
  var breakIn = document.getElementById('addAttBreakIn').value.trim();
  var status = document.getElementById('addAttStatus').value;
  var remark = document.getElementById('addAttRemark').value.trim();
  var isFullPay = document.getElementById('addAttIsFullPay').checked ? 1 : 0;
  var overwrite = document.getElementById('addAttOverwrite').checked;

  if (!empId) { showToast('กรุณาเลือกพนักงาน', 'error'); return; }
  if (!date) { showToast('กรุณาระบุวันที่', 'error'); return; }
  if (!clockIn) { showToast('กรุณาระบุเวลาเข้างาน', 'error'); return; }

  var btn = document.getElementById('btnSubmitAddAttLog');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...'; }

  callApi('addAttendanceLog', {
    empId: empId,
    date: date,
    branchId: branchId,
    clockIn: clockIn + (clockIn.length === 5 ? ':00' : ''),
    clockOut: clockOut ? (clockOut + (clockOut.length === 5 ? ':00' : '')) : '',
    breakOut: breakOut ? (breakOut + (breakOut.length === 5 ? ':00' : '')) : '',
    breakIn: breakIn ? (breakIn + (breakIn.length === 5 ? ':00' : '')) : '',
    status: status,
    remark: remark,
    isFullPay: isFullPay,
    overwrite: overwrite,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกการลงเวลา'; }
      if (r.success) {
        closeModal('modalAddAttendanceLog');
        showToast(r.message || 'บันทึกการลงเวลาสำเร็จแล้ว', 'success');
        loadTimeAttendanceDashboard();
      } else if (r.hasExisting) {
        if (confirm(r.message)) {
          document.getElementById('addAttOverwrite').checked = true;
          submitAddAttendanceLogForm(e);
        }
      } else {
        alert(r.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        showToast(r.message, 'error');
      }
    })
    .catch(function(err) {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกการลงเวลา'; }
      showToast(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    });
}

// ------------------------------------------------------------------------------
// CREATE ATTENDANCE REQUEST ON BEHALF OF EMPLOYEE
// ------------------------------------------------------------------------------

function openCreateAdminRequestModal() {
  if (!hasPermission('create_attendance_requests') && !hasPermission('approve_attendance') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์สร้างคำขอแทนพนักงาน', 'warning');
    return;
  }

  // Populate employee dropdown
  var empSel = document.getElementById('createAdminReqEmpId');
  if (empSel) {
    empSel.innerHTML = '<option value="">-- กรุณาเลือกพนักงาน --</option>';
    var list = (State.employees || []).filter(function(e) {
      var st = String(e.status || 'Active').trim().toUpperCase();
      return st !== 'RESIGNED';
    });
    list.sort(function(a, b) {
      var idA = a.empId || a.emp_id || '';
      var idB = b.empId || b.emp_id || '';
      return idA.localeCompare(idB);
    });
    list.forEach(function(e) {
      var id = e.empId || e.emp_id || '';
      var name = e.fullName || e.full_name || e.name || '';
      var nick = e.nickname ? ' (' + e.nickname + ')' : '';
      var dept = e.department ? ' - ' + e.department : '';
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = '[' + id + '] ' + name + nick + dept;
      empSel.appendChild(opt);
    });

    var curFilterEmp = (typeof _currentAttendanceEmpId !== 'undefined' && _currentAttendanceEmpId && _currentAttendanceEmpId !== 'ALL') ? _currentAttendanceEmpId : '';
    if (curFilterEmp) {
      empSel.value = curFilterEmp;
    }
  }

  var todayStr = new Date().toISOString().substring(0, 10);
  if (document.getElementById('createAdminReqLeaveStartDate')) document.getElementById('createAdminReqLeaveStartDate').value = todayStr;
  if (document.getElementById('createAdminReqLeaveEndDate')) document.getElementById('createAdminReqLeaveEndDate').value = todayStr;
  if (document.getElementById('createAdminReqLeaveTimeSlot')) document.getElementById('createAdminReqLeaveTimeSlot').value = 'FULL';
  if (document.getElementById('createAdminReqLeaveDays')) document.getElementById('createAdminReqLeaveDays').value = '1.0';
  if (document.getElementById('createAdminReqOtDate')) document.getElementById('createAdminReqOtDate').value = todayStr;
  if (document.getElementById('createAdminReqAdvanceDate')) document.getElementById('createAdminReqAdvanceDate').value = todayStr;
  if (document.getElementById('createAdminReqAdvanceAmount')) document.getElementById('createAdminReqAdvanceAmount').value = '';
  if (document.getElementById('createAdminReqReason')) document.getElementById('createAdminReqReason').value = '';

  switchCreateAdminReqType('LEAVE');
  openModal('modalCreateAdminRequest');
}

function switchCreateAdminReqType(type) {
  if (document.getElementById('createAdminReqType')) document.getElementById('createAdminReqType').value = type;

  var types = ['LEAVE', 'OT', 'ADVANCE'];
  types.forEach(function(t) {
    var btn = document.getElementById('tabBtnCreateReq_' + t);
    var sec = document.getElementById('createAdminReqSection_' + t);
    if (btn) {
      if (t === type) {
        btn.style.background = '#2563eb';
        btn.style.color = '#fff';
        btn.style.border = '1.5px solid #1d4ed8';
        btn.style.fontWeight = '700';
      } else {
        btn.style.background = '#f8fafc';
        btn.style.color = '#475569';
        btn.style.border = '1px solid #cbd5e1';
        btn.style.fontWeight = '600';
      }
    }
    if (sec) {
      sec.style.display = (t === type) ? 'flex' : 'none';
    }
  });
}

function onAdminLeaveTimeSlotChanged() {
  var slotEl = document.getElementById('createAdminReqLeaveTimeSlot');
  var daysEl = document.getElementById('createAdminReqLeaveDays');
  if (!slotEl || !daysEl) return;
  if (slotEl.value === 'MORNING' || slotEl.value === 'AFTERNOON') {
    daysEl.value = '0.5';
    var sEl = document.getElementById('createAdminReqLeaveStartDate');
    var eEl = document.getElementById('createAdminReqLeaveEndDate');
    if (sEl && eEl && sEl.value) {
      eEl.value = sEl.value;
    }
  } else if (slotEl.value === 'FULL') {
    onAdminLeaveDatesChanged();
  }
}

function onAdminLeaveDaysManualChanged() {
  var daysEl = document.getElementById('createAdminReqLeaveDays');
  var slotEl = document.getElementById('createAdminReqLeaveTimeSlot');
  if (!daysEl || !slotEl) return;
  var d = parseFloat(daysEl.value);
  if (d === 0.5 && slotEl.value === 'FULL') {
    slotEl.value = 'MORNING';
  } else if (d > 0.5 && slotEl.value !== 'FULL') {
    slotEl.value = 'FULL';
  }
}

function onAdminLeaveDatesChanged() {
  var slotEl = document.getElementById('createAdminReqLeaveTimeSlot');
  if (slotEl && (slotEl.value === 'MORNING' || slotEl.value === 'AFTERNOON')) {
    if (document.getElementById('createAdminReqLeaveDays')) {
      document.getElementById('createAdminReqLeaveDays').value = '0.5';
    }
    return;
  }

  var sStr = document.getElementById('createAdminReqLeaveStartDate') ? document.getElementById('createAdminReqLeaveStartDate').value : '';
  var eStr = document.getElementById('createAdminReqLeaveEndDate') ? document.getElementById('createAdminReqLeaveEndDate').value : '';
  if (!sStr || !eStr) return;

  var s = new Date(sStr + 'T00:00:00');
  var e = new Date(eStr + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return;

  var days = 0;
  var cur = new Date(s);
  while (cur <= e) {
    if (cur.getDay() !== 0) days++; // Skip Sunday
    cur.setDate(cur.getDate() + 1);
  }
  if (days <= 0) days = 1;

  if (document.getElementById('createAdminReqLeaveDays')) {
    document.getElementById('createAdminReqLeaveDays').value = days.toFixed(1);
  }
}

function onAdminOtTimesChanged() {
  var s = document.getElementById('createAdminReqOtStartTime') ? document.getElementById('createAdminReqOtStartTime').value : '';
  var e = document.getElementById('createAdminReqOtEndTime') ? document.getElementById('createAdminReqOtEndTime').value : '';
  if (!s || !e) return;

  var sp = s.split(':').map(Number);
  var ep = e.split(':').map(Number);
  var sMins = sp[0] * 60 + sp[1];
  var eMins = ep[0] * 60 + ep[1];
  if (eMins > sMins) {
    var diff = (eMins - sMins) / 60;
    var hrs = Math.floor(diff * 2) / 2; // Round to nearest 0.5
    if (hrs <= 0) hrs = 0.5;
    if (document.getElementById('createAdminReqOtHours')) {
      document.getElementById('createAdminReqOtHours').value = hrs.toFixed(1);
    }
  }
}

function submitCreateAdminRequestForm(e) {
  if (e) e.preventDefault();

  var reqType = document.getElementById('createAdminReqType').value;
  var empId = document.getElementById('createAdminReqEmpId').value;
  var reason = document.getElementById('createAdminReqReason').value.trim();
  var statusRadio = document.querySelector('input[name="createAdminReqStatus"]:checked');
  var status = statusRadio ? statusRadio.value : 'APPROVED';

  if (!empId) { showToast('กรุณาเลือกพนักงาน', 'error'); return; }
  if (!reason) { showToast('กรุณาระบุเหตุผลหรือรายละเอียดคำขอ', 'error'); return; }

  var payload = {
    requestType: reqType,
    empId: empId,
    reason: reason,
    status: status,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  };

  if (reqType === 'LEAVE') {
    var leaveType = document.getElementById('createAdminReqLeaveType').value;
    var startDate = document.getElementById('createAdminReqLeaveStartDate').value;
    var endDate = document.getElementById('createAdminReqLeaveEndDate').value;
    var daysCount = parseFloat(document.getElementById('createAdminReqLeaveDays').value) || 1.0;
    if (!startDate || !endDate) { showToast('กรุณาระบุช่วงวันที่ลา', 'error'); return; }

    payload.leaveType = leaveType;
    payload.startDate = startDate;
    payload.endDate = endDate;
    payload.daysCount = daysCount;
    payload.timeSlot = document.getElementById('createAdminReqLeaveTimeSlot') ? document.getElementById('createAdminReqLeaveTimeSlot').value : 'FULL';

    var fileInput = document.getElementById('createAdminReqMedicalCertFile');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      var reader = new FileReader();
      reader.onload = function(evt) {
        payload.medicalCertUrl = evt.target.result;
        doSubmitCreateAdminRequest(payload);
      };
      reader.readAsDataURL(fileInput.files[0]);
      return;
    }
  } else if (reqType === 'OT') {
    var otDate = document.getElementById('createAdminReqOtDate').value;
    var startTime = document.getElementById('createAdminReqOtStartTime').value;
    var endTime = document.getElementById('createAdminReqOtEndTime').value;
    var hours = parseFloat(document.getElementById('createAdminReqOtHours').value) || 0;
    if (!otDate) { showToast('กรุณาระบุวันที่ทำ OT', 'error'); return; }
    if (hours <= 0) { showToast('กรุณาระบุจำนวนชั่วโมง OT', 'error'); return; }

    payload.date = otDate;
    payload.startTime = startTime;
    payload.endTime = endTime;
    payload.hours = hours;
  } else if (reqType === 'ADVANCE') {
    var amount = parseFloat(document.getElementById('createAdminReqAdvanceAmount').value) || 0;
    var advanceDate = document.getElementById('createAdminReqAdvanceDate').value;
    if (amount <= 0) { showToast('กรุณาระบุยอดเงินที่ต้องการเบิก', 'error'); return; }
    if (!advanceDate) { showToast('กรุณาระบุวันที่เบิก', 'error'); return; }

    payload.amount = amount;
    payload.requestDate = advanceDate;
    payload.period = State.period || getDefaultPeriod();
  }

  doSubmitCreateAdminRequest(payload);
}

function doSubmitCreateAdminRequest(payload) {
  var btn = document.getElementById('btnSubmitCreateAdminReq');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่งคำขอ...'; }

  callApi('createAttendanceRequest', payload)
    .then(function(r) {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> บันทึกสร้างคำขอ'; }
      if (r.success) {
        closeModal('modalCreateAdminRequest');
        showToast(r.message || 'สร้างคำขอแทนพนักงานสำเร็จแล้ว', 'success');
        loadAttendanceRequests();
        loadTimeAttendanceDashboard();
      } else {
        alert(r.message || 'เกิดข้อผิดพลาดในการสร้างคำขอ');
        showToast(r.message, 'error');
      }
    })
    .catch(function(err) {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> บันทึกสร้างคำขอ'; }
      showToast(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
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

// ==============================================================================
// CLICKABLE ATTENDANCE KPI MODAL SYSTEM (ALL 5 CARDS)
// ==============================================================================
var _currentAttKpiMode = 'NOT_CLOCKED_IN';
var _currentAttKpiSubFilter = 'ALL';

function openAttendanceKpiModal(mode) {
  if (!isSuperAdmin() && !hasPermission('view_attendance')) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดูรายละเอียดการลงเวลา', 'warning');
    return;
  }
  _currentAttKpiMode = mode || 'NOT_CLOCKED_IN';
  _currentAttKpiSubFilter = 'ALL';

  var searchInput = document.getElementById('attKpiModalSearchInput');
  if (searchInput) searchInput.value = '';

  var header = document.getElementById('attKpiModalHeader');
  var icon = document.getElementById('attKpiModalIcon');
  var title = document.getElementById('attKpiModalTitle');
  var badge = document.getElementById('attKpiModalBadge');
  var sub = document.getElementById('attKpiModalSub');
  var tabsContainer = document.getElementById('attKpiModalSubFilterContainer');
  var footerHint = document.getElementById('attKpiModalFooterHint');

  var bd = State.attendanceBreakdown || {};
  var clockedInList = bd.clockedInList || [];
  var notClockedInList = bd.notClockedInList || [];
  var lateList = bd.lateList || [];
  var branchSummary = bd.branchSummary || [];
  var pending = State.attendancePendingData || { leaves: [], ots: [], advances: [] };
  var totalPending = (pending.leaves.length || 0) + (pending.ots.length || 0) + (pending.advances.length || 0);
  var targetDateDisplay = State.attendanceDateDisplay || bd.targetDate || 'วันนี้';

  if (_currentAttKpiMode === 'CLOCKED_IN') {
    if (header) header.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
    if (icon) icon.innerHTML = '<i class="fa-solid fa-user-check"></i>';
    if (title) title.textContent = 'พนักงานที่เข้างานแล้ววันนี้ (Present)';
    if (badge) {
      badge.textContent = clockedInList.length + ' คน';
      badge.style.color = '#059669';
    }
    if (sub) sub.textContent = 'ข้อมูลการสแกนเวลาเข้างาน ประจำวันที่ ' + targetDateDisplay;
    if (tabsContainer) {
      tabsContainer.innerHTML = '<button type="button" class="btn btn-sm btn-primary" id="attKpiTab_ALL" onclick="setAttendanceKpiSubFilter(\'ALL\')" style="font-size:11px;padding:3px 10px;border-radius:20px">ทั้งหมด (' + clockedInList.length + ')</button>';
    }
    if (footerHint) footerHint.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981"></span> <span>พนักงานเข้างานตามมาตรฐาน มีบันทึกเวลาและหลักฐานครบถ้วน</span>';

  } else if (_currentAttKpiMode === 'NOT_CLOCKED_IN') {
    var withLeaveCount = notClockedInList.filter(function(x) { return x.hasLeave; }).length;
    var noExcuseCount = notClockedInList.length - withLeaveCount;

    if (header) header.style.background = 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)';
    if (icon) icon.innerHTML = '<i class="fa-solid fa-user-xmark"></i>';
    if (title) title.textContent = 'พนักงานที่ยังไม่เข้างานวันนี้ (Not Clocked In)';
    if (badge) {
      badge.textContent = notClockedInList.length + ' คน';
      badge.style.color = '#e11d48';
    }
    if (sub) sub.textContent = 'ยังไม่มีข้อมูลการสแกนเข้างาน ประจำวันที่ ' + targetDateDisplay + ' (มีใบลา ' + withLeaveCount + ' คน, ยังไม่แจ้ง ' + noExcuseCount + ' คน)';
    if (tabsContainer) {
      tabsContainer.innerHTML = 
        '<button type="button" class="btn btn-sm btn-primary" id="attKpiTab_ALL" onclick="setAttendanceKpiSubFilter(\'ALL\')" style="font-size:11px;padding:3px 10px;border-radius:20px">ทั้งหมด (' + notClockedInList.length + ')</button>' +
        '<button type="button" class="btn btn-sm btn-slate" id="attKpiTab_NO_EXCUSE" onclick="setAttendanceKpiSubFilter(\'NO_EXCUSE\')" style="font-size:11px;padding:3px 10px;border-radius:20px">ยังไม่แจ้ง (' + noExcuseCount + ')</button>' +
        '<button type="button" class="btn btn-sm btn-slate" id="attKpiTab_LEAVE" onclick="setAttendanceKpiSubFilter(\'LEAVE\')" style="font-size:11px;padding:3px 10px;border-radius:20px">มีใบลา (' + withLeaveCount + ')</button>';
    }
    if (footerHint) footerHint.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#e11d48"></span> <span>สามารถกดโทรติดต่อพนักงานที่ไม่เข้างานได้ทันทีผ่านปุ่มโทรศัพท์</span>';

  } else if (_currentAttKpiMode === 'LATE') {
    if (header) header.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
    if (icon) icon.innerHTML = '<i class="fa-solid fa-user-clock"></i>';
    if (title) title.textContent = 'พนักงานที่มาสายวันนี้ (Late Today)';
    if (badge) {
      badge.textContent = lateList.length + ' คน';
      badge.style.color = '#d97706';
    }
    if (sub) sub.textContent = 'สแกนเข้างานเกินเวลาเริ่มกะตามที่สาขากำหนดไว้';
    if (tabsContainer) {
      tabsContainer.innerHTML = '<button type="button" class="btn btn-sm btn-primary" id="attKpiTab_ALL" onclick="setAttendanceKpiSubFilter(\'ALL\')" style="font-size:11px;padding:3px 10px;border-radius:20px">ทั้งหมด (' + lateList.length + ')</button>';
    }
    if (footerHint) footerHint.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b"></span> <span>เกณฑ์เบี้ยขยัน: อนุญาตให้สายได้ไม่เกิน 2 นาที/ครั้ง (1 ครั้งต่องวด)</span>';

  } else if (_currentAttKpiMode === 'PENDING') {
    if (header) header.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
    if (icon) icon.innerHTML = '<i class="fa-solid fa-clipboard-check"></i>';
    if (title) title.textContent = 'คำขอรออนุมัติจาก PTN Time (Pending Requests)';
    if (badge) {
      badge.textContent = totalPending + ' รายการ';
      badge.style.color = '#7c3aed';
    }
    if (sub) sub.textContent = 'คำขอลาหยุด, ขอทำ OT และขอเบิกเงินฉุกเฉินล่วงหน้า';
    if (tabsContainer) {
      tabsContainer.innerHTML = 
        '<button type="button" class="btn btn-sm btn-primary" id="attKpiTab_ALL" onclick="setAttendanceKpiSubFilter(\'ALL\')" style="font-size:11px;padding:3px 10px;border-radius:20px">ทั้งหมด (' + totalPending + ')</button>' +
        '<button type="button" class="btn btn-sm btn-slate" id="attKpiTab_LEAVE" onclick="setAttendanceKpiSubFilter(\'LEAVE\')" style="font-size:11px;padding:3px 10px;border-radius:20px">ลา (' + (pending.leaves.length || 0) + ')</button>' +
        '<button type="button" class="btn btn-sm btn-slate" id="attKpiTab_OT" onclick="setAttendanceKpiSubFilter(\'OT\')" style="font-size:11px;padding:3px 10px;border-radius:20px">OT (' + (pending.ots.length || 0) + ')</button>' +
        '<button type="button" class="btn btn-sm btn-slate" id="attKpiTab_ADVANCE" onclick="setAttendanceKpiSubFilter(\'ADVANCE\')" style="font-size:11px;padding:3px 10px;border-radius:20px">เบิกเงิน (' + (pending.advances.length || 0) + ')</button>';
    }
    if (footerHint) footerHint.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8b5cf6"></span> <span>สามารถตรวจสอบเอกสารแนบและกด อนุมัติ / ปฏิเสธ ได้ทันที</span>';

  } else if (_currentAttKpiMode === 'TOTAL_STAFF') {
    var allStaff = State.employees || [];
    if (header) header.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
    if (icon) icon.innerHTML = '<i class="fa-solid fa-users"></i>';
    if (title) title.textContent = 'สรุปพนักงานประจำการทั้งหมด (Total Staff)';
    if (badge) {
      badge.textContent = allStaff.length + ' คน';
      badge.style.color = '#2563eb';
    }
    if (sub) sub.textContent = 'อัตรากำลังพลแยกตามสาขาและสถานะการลงเวลาวันนี้';
    if (tabsContainer) {
      tabsContainer.innerHTML = '<button type="button" class="btn btn-sm btn-primary" id="attKpiTab_ALL" onclick="setAttendanceKpiSubFilter(\'ALL\')" style="font-size:11px;padding:3px 10px;border-radius:20px">สรุป 4 สาขา</button>';
    }
    if (footerHint) footerHint.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3b82f6"></span> <span>พนักงานสถานะ Active ทุกคนในระบบ PTN Payroll</span>';
  }

  renderAttendanceKpiModalList();
  openModal('modalAttendanceKpiDetails');
}

function setAttendanceKpiSubFilter(tab) {
  _currentAttKpiSubFilter = tab || 'ALL';
  var tabs = ['ALL', 'LEAVE', 'NO_EXCUSE', 'OT', 'ADVANCE'];
  tabs.forEach(function(t) {
    var btn = document.getElementById('attKpiTab_' + t);
    if (btn) {
      if (t === _currentAttKpiSubFilter) {
        btn.className = 'btn btn-sm btn-primary';
      } else {
        btn.className = 'btn btn-sm btn-slate';
      }
    }
  });
  renderAttendanceKpiModalList();
}

function renderAttendanceKpiModalList() {
  var container = document.getElementById('attKpiModalContentContainer');
  if (!container) return;

  var q = '';
  var searchInput = document.getElementById('attKpiModalSearchInput');
  if (searchInput) q = searchInput.value.trim().toLowerCase();

  var bd = State.attendanceBreakdown || {};
  var clockedInList = bd.clockedInList || [];
  var notClockedInList = bd.notClockedInList || [];
  var lateList = bd.lateList || [];
  var branchSummary = bd.branchSummary || [];
  var pending = State.attendancePendingData || { leaves: [], ots: [], advances: [] };

  var html = '';

  if (_currentAttKpiMode === 'CLOCKED_IN') {
    var list = clockedInList.filter(function(item) {
      if (q) {
        var str = ((item.name || '') + ' ' + (item.empId || '') + ' ' + (item.nickname || '') + ' ' + (item.dept || '') + ' ' + (item.branchName || '')).toLowerCase();
        if (str.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (list.length === 0) {
      html = '<div style="text-align:center;padding:40px 20px;color:#94a3b8"><i class="fa-solid fa-user-check" style="font-size:36px;margin-bottom:10px;opacity:0.4"></i><div style="font-size:13px;font-weight:600">ไม่พบรายชื่อพนักงานที่เข้างานตามเงื่อนไขที่ค้นหา</div></div>';
    } else {
      html = list.map(function(item) {
        var photoBtn = '';
        if (item.inPhotoUrl) {
          photoBtn = '<button type="button" class="btn btn-slate btn-xs" onclick="previewAttendancePhoto(\'' + esc(item.inPhotoUrl) + '\', \'เข้างาน: ' + esc(item.name) + '\', \'เวลา ' + esc(item.clockIn) + ' น.\')" style="font-size:10.5px;padding:3px 8px;border-radius:6px"><i class="fa-solid fa-camera text-blue"></i> ดูรูปเซลฟี่</button>';
        }
        var initials = (item.nickname || item.name || 'P').substring(0, 2);
        return '<div style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;transition:border-color 0.2s" onmouseover="this.style.borderColor=\'#10b981\'" onmouseout="this.style.borderColor=\'#e2e8f0\'">' +
          '<div style="display:flex;align-items:center;gap:12px;min-width:0">' +
            '<div style="width:38px;height:38px;border-radius:10px;background:#ecfdf5;color:#059669;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">' +
              esc(initials) +
            '</div>' +
            '<div style="min-width:0">' +
              '<div style="font-size:13px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
                '<span>' + esc(item.name) + '</span>' +
                (item.nickname ? '<span style="font-size:11.5px;color:#64748b">(' + esc(item.nickname) + ')</span>' : '') +
                '<span style="font-family:monospace;font-size:11px;color:#64748b;font-weight:400">[' + esc(item.empId) + ']</span>' +
              '</div>' +
              '<div style="font-size:11px;color:#64748b;margin-top:2px">' +
                esc(item.dept || '-') + ' • <span style="color:#0369a1">' + esc(item.branchName || 'สำนักงานใหญ่') + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
            '<div style="font-size:12.5px;font-weight:800;color:#059669;display:flex;align-items:center;gap:4px">' +
              '<i class="fa-solid fa-clock" style="font-size:11px"></i> ' + esc(item.clockIn || '-') + ' น.' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              (item.workHours > 0 ? '<span style="font-size:10.5px;color:#64748b">~' + Number(item.workHours).toFixed(1) + ' ชม.</span>' : '') +
              photoBtn +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

  } else if (_currentAttKpiMode === 'NOT_CLOCKED_IN') {
    var list = notClockedInList.filter(function(item) {
      if (_currentAttKpiSubFilter === 'LEAVE' && !item.hasLeave) return false;
      if (_currentAttKpiSubFilter === 'NO_EXCUSE' && item.hasLeave) return false;
      if (q) {
        var str = ((item.name || '') + ' ' + (item.empId || '') + ' ' + (item.nickname || '') + ' ' + (item.dept || '') + ' ' + (item.branchName || '')).toLowerCase();
        if (str.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (list.length === 0) {
      html = '<div style="text-align:center;padding:40px 20px;color:#94a3b8"><i class="fa-solid fa-circle-check text-green" style="font-size:36px;margin-bottom:10px"></i><div style="font-size:13px;font-weight:600;color:#0f172a">พนักงานทุกคนเข้างานครบแล้ว หรือไม่พบรายการตามที่ค้นหา</div></div>';
    } else {
      html = list.map(function(item) {
        var isLeave = item.hasLeave;
        var badgeHtml = '';
        var cardBg = isLeave ? '#fffbeb' : '#fff5f5';
        var cardBorder = isLeave ? '#fef08a' : '#fecdd3';
        var initials = (item.nickname || item.name || 'U').substring(0, 2);

        if (isLeave) {
          badgeHtml = '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;border:1px solid #fde68a">' +
            '<i class="fa-solid fa-calendar-check text-amber"></i> ' + esc(item.leaveType || 'ลางาน (อนุมัติแล้ว)') +
          '</span>';
        } else {
          badgeHtml = '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;border:1px solid #fecdd3">' +
            '<i class="fa-solid fa-circle-xmark text-red"></i> ยังไม่ลงเวลา (ไม่มีใบลา)' +
          '</span>';
        }

        var phoneBtn = '';
        if (item.phone) {
          phoneBtn = '<a href="tel:' + esc(item.phone) + '" class="btn btn-slate btn-xs" style="text-decoration:none;font-size:11px;padding:3px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;font-weight:600">' +
            '<i class="fa-solid fa-phone" style="color:#10b981;font-size:10px"></i> ' + esc(item.phone) +
          '</a>';
        } else {
          phoneBtn = '<span style="font-size:10.5px;color:#94a3b8">ไม่มีเบอร์โทร</span>';
        }

        return '<div style="padding:12px 14px;border:1.5px solid ' + cardBorder + ';border-radius:12px;background:' + cardBg + ';display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px">' +
          '<div style="display:flex;align-items:center;gap:12px;min-width:240px">' +
            '<div style="width:40px;height:40px;border-radius:10px;background:' + (isLeave ? '#f59e0b' : '#ef4444') + ';color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">' +
              esc(initials) +
            '</div>' +
            '<div>' +
              '<div style="font-size:13px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
                '<span>' + esc(item.name) + '</span>' +
                (item.nickname ? '<span style="font-size:11.5px;color:#64748b">(' + esc(item.nickname) + ')</span>' : '') +
                '<span style="font-family:monospace;font-size:11px;color:#64748b;font-weight:400">[' + esc(item.empId) + ']</span>' +
              '</div>' +
              '<div style="font-size:11px;color:#64748b;margin-top:2px">' +
                esc(item.dept || '-') + ' • <span style="color:#0369a1">' + esc(item.branchName || 'สำนักงานใหญ่') + '</span>' +
              '</div>' +
              '<div style="font-size:10.5px;color:#475569;margin-top:2px">' +
                '<i class="fa-regular fa-clock" style="margin-right:3px"></i> กะเวลา: ' + esc(item.shiftText || '09:30 - 19:00 น.') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">' +
            badgeHtml +
            (item.medicalCertUrl ? '<button type="button" class="btn btn-xs" onclick="previewAttendancePhoto(\'' + esc(item.medicalCertUrl) + '\', \'ใบรับรองแพทย์: ' + esc(item.name) + '\', \'คำขอลา: ' + esc(item.leaveType || '') + '\')" style="font-size:10.5px;padding:3px 8px;border-radius:6px;background:#fef3c7;border:1px solid #fde68a;color:#92400e;font-weight:700;cursor:pointer"><i class="fa-solid fa-file-medical text-amber" style="margin-right:3px"></i> ดูใบรับรองแพทย์</button>' : '') +
            phoneBtn +
          '</div>' +
        '</div>';
      }).join('');
    }

  } else if (_currentAttKpiMode === 'LATE') {
    var list = lateList.filter(function(item) {
      if (q) {
        var str = ((item.name || '') + ' ' + (item.empId || '') + ' ' + (item.nickname || '') + ' ' + (item.dept || '') + ' ' + (item.branchName || '')).toLowerCase();
        if (str.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (list.length === 0) {
      html = '<div style="text-align:center;padding:40px 20px;color:#94a3b8"><i class="fa-solid fa-circle-check text-green" style="font-size:36px;margin-bottom:10px"></i><div style="font-size:13px;font-weight:600;color:#0f172a">ยอดเยี่ยม! วันนี้ไม่มีพนักงานมาสายเลย</div></div>';
    } else {
      html = list.map(function(item) {
        var initials = (item.nickname || item.name || 'L').substring(0, 2);
        var phoneBtn = item.phone ? '<a href="tel:' + esc(item.phone) + '" class="btn btn-slate btn-xs" style="text-decoration:none;font-size:10.5px;padding:3px 8px;border-radius:6px"><i class="fa-solid fa-phone text-green"></i> ' + esc(item.phone) + '</a>' : '';

        return '<div style="padding:12px 14px;border:1.5px solid #fed7aa;border-radius:12px;background:#fffaf5;display:flex;align-items:center;justify-content:space-between;gap:12px">' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            '<div style="width:40px;height:40px;border-radius:10px;background:#f97316;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">' +
              esc(initials) +
            '</div>' +
            '<div>' +
              '<div style="font-size:13px;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:6px">' +
                '<span>' + esc(item.name) + '</span>' +
                (item.nickname ? '<span style="font-size:11.5px;color:#64748b">(' + esc(item.nickname) + ')</span>' : '') +
                '<span style="font-family:monospace;font-size:11px;color:#64748b">[' + esc(item.empId) + ']</span>' +
              '</div>' +
              '<div style="font-size:11px;color:#64748b;margin-top:2px">' +
                esc(item.dept || '-') + ' • <span style="color:#0369a1">' + esc(item.branchName || 'สำนักงานใหญ่') + '</span>' +
              '</div>' +
              '<div style="font-size:11px;color:#c2410c;font-weight:600;margin-top:2px">' +
                '<i class="fa-solid fa-triangle-exclamation" style="margin-right:3px"></i> สแกนเข้า: ' + esc(item.clockIn || '-') + ' น. (เวลากะเริ่ม: ' + esc(item.shiftStart || '09:30') + ' น.)' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:5px">' +
            '<span style="display:inline-block;padding:3px 10px;border-radius:20px;background:#ffedd5;color:#9a3412;font-size:12px;font-weight:800;border:1px solid #fed7aa">' +
              'สาย ' + Number(item.lateMinutes || 0) + ' นาที' +
            '</span>' +
            phoneBtn +
          '</div>' +
        '</div>';
      }).join('');
    }

  } else if (_currentAttKpiMode === 'PENDING') {
    var rawLeaves = pending.leaves || [];
    var rawOts = pending.ots || [];
    var rawAdvances = pending.advances || [];

    var combined = [];
    rawLeaves.forEach(function(l) {
      combined.push({
        type: 'leave',
        id: l.id,
        empId: l.emp_id,
        name: formatEmpNameWithNick(l.full_name, l.emp_id, l.nickname),
        dept: l.department || '',
        title: 'ขอลาหยุด (' + (l.leave_type || 'ลา') + ')',
        sub: 'วันที่: ' + formatDateThaiBE(l.start_date) + ' ถึง ' + formatDateThaiBE(l.end_date) + ' (' + (l.days_count || 1) + ' วัน)',
        reason: l.reason || '-',
        color: '#7c3aed',
        medicalCertUrl: l.medical_cert_url || l.cert_photo_url || null,
        createdAt: l.created_at
      });
    });
    rawOts.forEach(function(o) {
      combined.push({
        type: 'ot',
        id: o.id,
        empId: o.emp_id,
        name: formatEmpNameWithNick(o.full_name, o.emp_id, o.nickname),
        dept: o.department || '',
        title: 'ขอทำ OT (' + (o.hours || 0) + ' ชม.)',
        sub: 'วันที่: ' + formatDateThaiBE(o.date) + ' เวลา ' + (o.start_time || '') + ' - ' + (o.end_time || ''),
        reason: o.reason || '-',
        color: '#2563eb',
        createdAt: o.created_at
      });
    });
    rawAdvances.forEach(function(a) {
      combined.push({
        type: 'advance',
        id: a.id,
        empId: a.emp_id,
        name: formatEmpNameWithNick(a.full_name, a.emp_id, a.nickname),
        dept: a.department || '',
        title: 'ขอเบิกเงินฉุกเฉินล่วงหน้า (' + formatMoney(a.amount || 0) + ' บาท)',
        sub: 'วันที่ขอ: ' + formatDateThaiBE(a.request_date || (a.created_at ? a.created_at.substring(0, 10) : '')),
        reason: a.reason || '-',
        color: '#059669',
        createdAt: a.created_at
      });
    });

    var list = combined.filter(function(item) {
      if (_currentAttKpiSubFilter === 'LEAVE' && item.type !== 'leave') return false;
      if (_currentAttKpiSubFilter === 'OT' && item.type !== 'ot') return false;
      if (_currentAttKpiSubFilter === 'ADVANCE' && item.type !== 'advance') return false;
      if (q) {
        var str = ((item.name || '') + ' ' + (item.empId || '') + ' ' + (item.title || '') + ' ' + (item.reason || '')).toLowerCase();
        if (str.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (list.length === 0) {
      html = '<div style="text-align:center;padding:40px 20px;color:#94a3b8"><i class="fa-solid fa-clipboard-check text-green" style="font-size:36px;margin-bottom:10px"></i><div style="font-size:13px;font-weight:600;color:#0f172a">ไม่มีคำขอรออนุมัติในหมวดหมู่นี้</div></div>';
    } else {
      html = list.map(function(item) {
        return '<div style="padding:14px;border:1.5px solid #e9d5ff;border-radius:12px;background:#faf5ff;display:flex;flex-direction:column;gap:8px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
              '<span style="font-size:13px;font-weight:700;color:#0f172a">' + esc(item.name) + '</span>' +
              '<span style="font-family:monospace;font-size:11px;color:#64748b">[' + esc(item.empId) + ']</span>' +
              (item.dept ? '<span style="font-size:11px;color:#64748b">(' + esc(item.dept) + ')</span>' : '') +
            '</div>' +
            '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe">' +
              esc(item.title) +
            '</span>' +
          '</div>' +
          '<div style="font-size:11.5px;color:#475569;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">' +
            '<span><i class="fa-regular fa-clock" style="margin-right:4px"></i> ' + esc(item.sub) + '</span>' +
            (item.createdAt ? '<span style="font-size:10.5px;color:#64748b;font-weight:600"><i class="fa-solid fa-paper-plane" style="font-size:9px"></i> ยื่น: ' + formatThaiDateTime(item.createdAt) + '</span>' : '') +
          '</div>' +
          '<div style="font-size:11.5px;color:#334155;background:#fff;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0">' +
            '<strong>เหตุผล:</strong> ' + esc(item.reason) +
          '</div>' +
          (item.medicalCertUrl ? 
            '<div style="margin-top:2px">' +
              '<button type="button" class="btn btn-sm" onclick="previewAttendancePhoto(\'' + esc(item.medicalCertUrl) + '\', \'ใบรับรองแพทย์: ' + esc(item.name) + '\', \'' + esc(item.title) + ' (' + esc(item.sub) + ')\')" style="background:#eff6ff;border:1.5px solid #93c5fd;color:#1d4ed8;font-size:11.5px;font-weight:700;padding:5px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 1px 2px rgba(0,0,0,0.05)">' +
                '<i class="fa-solid fa-file-medical" style="color:#2563eb;font-size:13px"></i> ดูรูปใบรับรองแพทย์แนบ (คลิกเพื่อดูภาพขยาย)' +
              '</button>' +
            '</div>' : '') +
          '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:4px">' +
            '<button type="button" class="btn btn-sm" onclick="openEditAttendanceRequestModal(\'' + item.type + '\', ' + item.id + ')" style="font-size:11.5px;padding:4px 12px;font-weight:700;background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd">' +
              '<i class="fa-solid fa-pen-to-square"></i> แก้ไข' +
            '</button>' +
            '<button type="button" class="btn btn-sm btn-success" onclick="approveAttendanceRequest(\'' + item.type + '\', ' + item.id + ', \'APPROVE\')" style="font-size:11.5px;padding:4px 12px;font-weight:700">' +
              '<i class="fa-solid fa-check"></i> อนุมัติ' +
            '</button>' +
            '<button type="button" class="btn btn-sm btn-danger" onclick="approveAttendanceRequest(\'' + item.type + '\', ' + item.id + ', \'REJECT\')" style="font-size:11.5px;padding:4px 12px;font-weight:700">' +
              '<i class="fa-solid fa-xmark"></i> ปฏิเสธ' +
            '</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

  } else if (_currentAttKpiMode === 'TOTAL_STAFF') {
    var branchCards = branchSummary.map(function(b) {
      return '<div style="padding:14px;border:1.5px solid #bfdbfe;border-radius:12px;background:#eff6ff;display:flex;flex-direction:column;gap:10px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div style="font-weight:700;font-size:13px;color:#1e3a8a"><i class="fa-solid fa-building" style="margin-right:4px;color:#2563eb"></i> ' + esc(b.branchName) + '</div>' +
          '<span style="font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:20px;background:#2563eb;color:#fff">' + Number(b.totalStaff || 0) + ' คน</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;text-align:center">' +
          '<div style="background:#fff;padding:8px 4px;border-radius:8px;border:1px solid #cbd5e1">' +
            '<div style="font-size:10px;font-weight:600;color:#059669">เข้างานแล้ว</div>' +
            '<div style="font-size:15px;font-weight:800;color:#059669">' + Number(b.clockedIn || 0) + '</div>' +
          '</div>' +
          '<div style="background:#fff;padding:8px 4px;border-radius:8px;border:1px solid #cbd5e1">' +
            '<div style="font-size:10px;font-weight:600;color:#dc2626">ยังไม่เข้า</div>' +
            '<div style="font-size:15px;font-weight:800;color:#dc2626">' + Number(b.notClockedIn || 0) + '</div>' +
          '</div>' +
          '<div style="background:#fff;padding:8px 4px;border-radius:8px;border:1px solid #cbd5e1">' +
            '<div style="font-size:10px;font-weight:600;color:#d97706">มาสาย</div>' +
            '<div style="font-size:15px;font-weight:800;color:#d97706">' + Number(b.late || 0) + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:10.5px;color:#64748b;text-align:center">' +
          'เวลากะปกติ: ' + esc(b.workStartTime || '09:30') + ' - ' + esc(b.workEndTime || '19:00') + ' น.' +
        '</div>' +
      '</div>';
    }).join('');

    html = '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:10px">' + branchCards + '</div>';
  }

  container.innerHTML = html;
}

function copyAttendanceKpiList() {
  var bd = State.attendanceBreakdown || {};
  var text = '';
  var dateStr = State.attendanceDateDisplay || bd.targetDate || 'วันนี้';

  if (_currentAttKpiMode === 'NOT_CLOCKED_IN') {
    var list = bd.notClockedInList || [];
    text = '📋 รายชื่อพนักงานที่ยังไม่เข้างาน (' + dateStr + ') รวม ' + list.length + ' คน:\n\n';
    list.forEach(function(item, idx) {
      text += (idx + 1) + '. ' + item.name + ' (' + (item.nickname || '-') + ') [' + item.empId + '] - ' + item.branchName + '\n' +
        '   สถานะ: ' + (item.hasLeave ? ('มีใบลา (' + item.leaveType + ')') : 'ยังไม่แจ้งสาเหตุ') + '\n' +
        '   เบอร์โทร: ' + (item.phone || '-') + '\n\n';
    });
  } else if (_currentAttKpiMode === 'CLOCKED_IN') {
    var list = bd.clockedInList || [];
    text = '📋 รายชื่อพนักงานที่เข้างานแล้ว (' + dateStr + ') รวม ' + list.length + ' คน:\n\n';
    list.forEach(function(item, idx) {
      text += (idx + 1) + '. ' + item.name + ' (' + (item.nickname || '-') + ') [' + item.empId + '] - เข้างาน: ' + (item.clockIn || '-') + ' น. (' + item.branchName + ')\n';
    });
  } else if (_currentAttKpiMode === 'LATE') {
    var list = bd.lateList || [];
    text = '📋 รายชื่อพนักงานที่มาสาย (' + dateStr + ') รวม ' + list.length + ' คน:\n\n';
    list.forEach(function(item, idx) {
      text += (idx + 1) + '. ' + item.name + ' (' + (item.nickname || '-') + ') [' + item.empId + '] - สาย ' + item.lateMinutes + ' นาที (สแกน ' + item.clockIn + ' น.) เบอร์โทร: ' + (item.phone || '-') + '\n';
    });
  } else if (_currentAttKpiMode === 'PENDING') {
    var p = State.attendancePendingData || { leaves: [], ots: [], advances: [] };
    text = '📋 รายการคำขอรออนุมัติ PTN Time (' + dateStr + '):\n' +
      '- คำขอลา: ' + (p.leaves.length || 0) + ' รายการ\n' +
      '- ขอ OT: ' + (p.ots.length || 0) + ' รายการ\n' +
      '- ขอเบิกเงิน: ' + (p.advances.length || 0) + ' รายการ\n';
  } else if (_currentAttKpiMode === 'TOTAL_STAFF') {
    var list = bd.branchSummary || [];
    text = '📋 สรุปอัตรากำลังพล 4 สาขา (' + dateStr + '):\n\n';
    list.forEach(function(b) {
      text += b.branchName + ': ทั้งหมด ' + b.totalStaff + ' คน (เข้าแล้ว ' + b.clockedIn + ' คน, ยังไม่เข้า ' + b.notClockedIn + ' คน, สาย ' + b.late + ' คน)\n';
    });
  }

  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      showToast('คัดลอกรายชื่อเรียบร้อยแล้ว', 'success');
    }).catch(function() {
      showToast('ไม่สามารถคัดลอกได้อัตโนมัติ', 'warning');
    });
  } else {
    showToast('คัดลอกรายชื่อเรียบร้อยแล้ว', 'success');
  }
}

function saveAttendanceSettingsFromPayroll(e) {
  if (e) e.preventDefault();

  var sStart = document.getElementById('attSetShiftStart').value || '09:30';
  var sEnd = document.getElementById('attSetShiftEnd').value || '19:00';
  var sCutoffDay = Number(document.getElementById('attSetCutoffDay') ? document.getElementById('attSetCutoffDay').value : 25) || 25;
  var sGrace = Number(document.getElementById('attSetGraceMinutes') ? document.getElementById('attSetGraceMinutes').value : 0) || 0;
  var elRadius = document.getElementById('attSetRadiusMeters');
  var elLat = document.getElementById('attSetLat');
  var elLng = document.getElementById('attSetLng');
  
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

  var enableSelfieGreetings = document.getElementById('attSetEnableSelfieGreetings') ? (document.getElementById('attSetEnableSelfieGreetings').checked ? 'true' : 'false') : 'true';
  var enableClockInGreeting = document.getElementById('attSetEnableClockInGreeting') ? (document.getElementById('attSetEnableClockInGreeting').checked ? 'true' : 'false') : 'true';
  var enableBreakGreeting = document.getElementById('attSetEnableBreakGreeting') ? (document.getElementById('attSetEnableBreakGreeting').checked ? 'true' : 'false') : 'true';
  var enableClockOutGreeting = document.getElementById('attSetEnableClockOutGreeting') ? (document.getElementById('attSetEnableClockOutGreeting').checked ? 'true' : 'false') : 'true';
  var enableBirthdayGreeting = document.getElementById('attSetEnableBirthdayGreeting') ? (document.getElementById('attSetEnableBirthdayGreeting').checked ? 'true' : 'false') : 'true';
  var enableSaturdayGreeting = (document.getElementById('attSetEnableSaturdayGreeting') || document.getElementById('attSetEnableFridayTgif')) ? ((document.getElementById('attSetEnableSaturdayGreeting') || document.getElementById('attSetEnableFridayTgif')).checked ? 'true' : 'false') : 'true';
  var selfieCustomMessages = document.getElementById('attSetSelfieCustomMessages') ? document.getElementById('attSetSelfieCustomMessages').value.trim() : '';
  var selfieCustomMessagesBreak = document.getElementById('attSetSelfieCustomMessagesBreak') ? document.getElementById('attSetSelfieCustomMessagesBreak').value.trim() : '';
  var selfieCustomMessagesOut = document.getElementById('attSetSelfieCustomMessagesOut') ? document.getElementById('attSetSelfieCustomMessagesOut').value.trim() : '';

  var settings = {
    shift_start: sStart,
    work_start_time: sStart,
    shift_end: sEnd,
    work_end_time: sEnd,
    cutoff_day: sCutoffDay,
    grace_minutes: sGrace,
    grace_period_morning_minutes: sGrace,
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
    payslip_release_mode: payslipReleaseMode,
    enable_selfie_greetings: enableSelfieGreetings,
    enable_selfie_clockin_greetings: enableClockInGreeting,
    enable_selfie_break_greetings: enableBreakGreeting,
    enable_selfie_clockout_greetings: enableClockOutGreeting,
    enable_birthday_greeting: enableBirthdayGreeting,
    enable_saturday_greeting: enableSaturdayGreeting,
    enable_friday_tgif: enableSaturdayGreeting,
    selfie_custom_messages: selfieCustomMessages,
    selfie_custom_messages_break: selfieCustomMessagesBreak,
    selfie_custom_messages_out: selfieCustomMessagesOut
  };

  if (elRadius && elRadius.value) settings.geofence_radius_meters = Number(elRadius.value);
  if (elLat && elLat.value) settings.office_lat = Number(elLat.value);
  if (elLng && elLng.value) settings.office_lng = Number(elLng.value);

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

function toggleSelfieGreetingsUI(isEnabled) {
  var area = document.getElementById('attSetSelfieGreetingsDetailArea');
  if (area) {
    area.style.display = isEnabled ? 'flex' : 'none';
  }
}

function switchGreetingMessageTab(tab) {
  var tabs = ['in', 'break', 'out'];
  tabs.forEach(function(t) {
    var btn = document.getElementById('tabBtnGreeting' + (t.charAt(0).toUpperCase() + t.slice(1)));
    var pane = document.getElementById('greetingMsgTab_' + t);
    if (btn) btn.className = (t === tab ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-slate');
    if (pane) pane.style.display = (t === tab ? 'block' : 'none');
  });
}

function resetDefaultSelfieGreetings(which) {
  if (which === 'break') {
    var area = document.getElementById('attSetSelfieCustomMessagesBreak');
    if (area) {
      area.value = 'ทานอาหารกลางวันให้อร่อยนะคะ ชาร์จพลังให้เต็มที่ 🍜🍱\nพักสายตาและผ่อนคลายความเหนื่อยล้าสักครู่ค่ะ ☕🍰\nชาร์จพลังเต็มที่แล้ว พร้อมลุยงานช่วงบ่ายอย่างสดชื่นค่ะ 💪✨';
      showToast('คืนค่าข้อความช่วงเวลาพักเริ่มต้นแล้ว', 'info');
    }
  } else if (which === 'out') {
    var area = document.getElementById('attSetSelfieCustomMessagesOut');
    if (area) {
      area.value = 'ขอบคุณสำหรับความทุ่มเทในวันนี้นะคะ ทำงานเหนื่อยมาทั้งวันแล้ว เก่งมากๆ ค่ะ 👏💖\nเดินทางกลับบ้านโดยสวัสดิภาพนะคะ พักผ่อนให้เต็มที่ พรุ่งนี้พบกันใหม่ค่ะ 🚗🏠\nทำงานสำเร็จไปอีกวันแล้ว วันนี้คุณทำได้ยอดเยี่ยมมากค่ะ 🌟';
      showToast('คืนค่าข้อความตอนเลิกงานเริ่มต้นแล้ว', 'info');
    }
  } else {
    var area = document.getElementById('attSetSelfieCustomMessages');
    if (area) {
      area.value = 'สวัสดีตอนเช้าค่ะ วันนี้ยิ้มสดใสมาก ขอให้เป็นวันที่ราบรื่นและมีความสุขนะคะ 🌸\nพร้อมลุยงานวันนี้! ยิ้มรับลูกค้าด้วยหัวใจบริการค่ะ ✨\nเริ่มต้นวันใหม่ด้วยพลังบวก ขอให้การทำงานวันนี้ราบรื่นสำเร็จทุกสิ่งนะคะ 💖';
      showToast('คืนค่าข้อความเข้างานเริ่มต้นแล้ว', 'info');
    }
  }
}

function previewSelfieGreetingDemo() {
  openModal('modalSelfieGreetingDemo');
  setSimGreetingMode('in');
}

function setSimGreetingMode(mode) {
  var btnIn = document.getElementById('btnSimModeIn');
  var btnBreak = document.getElementById('btnSimModeBreak');
  var btnOut = document.getElementById('btnSimModeOut');
  var btnSat = document.getElementById('btnSimModeSat') || document.getElementById('btnSimModeTgif');
  var btnBday = document.getElementById('btnSimModeBday');

  var screenBg = document.getElementById('simGreetingScreenBg');
  var centerIcon = document.getElementById('simGreetingCenterIcon');
  var topEmoji = document.getElementById('simGreetingTopEmoji');
  var scoreText = document.getElementById('simGreetingScoreText');
  var msgText = document.getElementById('simGreetingMessageText');
  var subText = document.getElementById('simGreetingSubtext');

  if (btnIn) btnIn.className = (mode === 'in' ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-slate');
  if (btnBreak) btnBreak.className = (mode === 'break' ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-slate');
  if (btnOut) btnOut.className = (mode === 'out' ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-slate');
  if (btnSat) btnSat.className = (mode === 'sat' || mode === 'tgif' ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-slate');
  if (btnBday) btnBday.className = (mode === 'bday' ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-slate');

  if (mode === 'sat' || mode === 'tgif') {
    if (screenBg) screenBg.style.background = 'linear-gradient(135deg, #c084fc 0%, #f472b6 50%, #fb923c 100%)';
    if (centerIcon) {
      centerIcon.className = 'fa-solid fa-champagne-glasses';
      centerIcon.style.color = '#7e22ce';
    }
    if (topEmoji) topEmoji.textContent = '🎉';
    if (scoreText) scoreText.textContent = 'Happy Saturday! สุขสันต์วันเสาร์';
    if (msgText) msgText.textContent = '"สุขสันต์วันเสาร์ค่ะ! สู้ๆ กับวันสุดท้ายของสัปดาห์ทำงาน พรุ่งนี้ได้หยุดพักผ่อนชาร์จพลังเต็มที่แล้วนะคะ 🎉🏖️"';
    if (subText) subText.textContent = 'สแกนเข้า/ออกงาน • สาขาสำนักงานใหญ่';

  } else if (mode === 'bday') {
    if (screenBg) screenBg.style.background = 'linear-gradient(135deg, #f472b6 0%, #fb7185 50%, #fde047 100%)';
    if (centerIcon) {
      centerIcon.className = 'fa-solid fa-cake-candles';
      centerIcon.style.color = '#be185d';
    }
    if (topEmoji) topEmoji.textContent = '🎂';
    if (scoreText) scoreText.textContent = 'Happy Birthday! สุขสันต์วันเกิด';
    if (msgText) msgText.textContent = '"สุขสันต์วันคล้ายวันเกิดค่ะ! ขอให้มีความสุข สุขภาพแข็งแรง การงานรุ่งเรือง ประสบความสำเร็จตลอดปีนะคะ 🎁✨"';
    if (subText) subText.textContent = 'สุขสันต์วันเกิดคุณพนักงาน • PTN Pharma';

  } else if (mode === 'break') {
    if (screenBg) screenBg.style.background = 'linear-gradient(135deg, #fef08a 0%, #a7f3d0 50%, #99f6e4 100%)';
    if (centerIcon) {
      centerIcon.className = 'fa-solid fa-mug-hot';
      centerIcon.style.color = '#047857';
    }
    if (topEmoji) topEmoji.textContent = '🍱';
    if (scoreText) scoreText.textContent = 'Rest & Recharge ชาร์จพลังเต็มที่!';
    var txtArea = document.getElementById('attSetSelfieCustomMessagesBreak');
    var raw = (txtArea && txtArea.value.trim()) ? txtArea.value.trim() : '';
    var lines = raw.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
    if (lines.length === 0) {
      lines = ['ทานอาหารกลางวันให้อร่อยนะคะ ชาร์จพลังให้เต็มที่ 🍜🍱'];
    }
    var randomMsg = lines[Math.floor(Math.random() * lines.length)];
    if (msgText) msgText.textContent = '"' + randomMsg + '"';
    if (subText) subText.textContent = 'บันทึกเวลาพัก • สาขาสำนักงานใหญ่';

  } else if (mode === 'out') {
    if (screenBg) screenBg.style.background = 'linear-gradient(135deg, #ddd6fe 0%, #bfdbfe 50%, #bae6fd 100%)';
    if (centerIcon) {
      centerIcon.className = 'fa-solid fa-moon';
      centerIcon.style.color = '#4338ca';
    }
    if (topEmoji) topEmoji.textContent = '👏';
    if (scoreText) scoreText.textContent = 'Good Job! วันนี้ทำได้ยอดเยี่ยมมาก';
    var txtArea = document.getElementById('attSetSelfieCustomMessagesOut');
    var raw = (txtArea && txtArea.value.trim()) ? txtArea.value.trim() : '';
    var lines = raw.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
    if (lines.length === 0) {
      lines = ['ขอบคุณสำหรับความทุ่มเทในวันนี้นะคะ ทำงานเหนื่อยมาทั้งวันแล้ว เก่งมากๆ ค่ะ 👏💖'];
    }
    var randomMsg = lines[Math.floor(Math.random() * lines.length)];
    if (msgText) msgText.textContent = '"' + randomMsg + '"';
    if (subText) subText.textContent = 'สแกนเลิกงาน • สาขาสำนักงานใหญ่';

  } else {
    // mode === 'in' (Clock IN)
    if (screenBg) screenBg.style.background = 'linear-gradient(135deg, #fbcfe8 0%, #fed7aa 50%, #fef08a 100%)';
    if (centerIcon) {
      centerIcon.className = 'fa-solid fa-face-smile-beam';
      centerIcon.style.color = '#d97706';
    }
    if (topEmoji) topEmoji.textContent = '✨';
    var txtArea = document.getElementById('attSetSelfieCustomMessages');
    var raw = (txtArea && txtArea.value.trim()) ? txtArea.value.trim() : '';
    var lines = raw.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
    if (lines.length === 0) {
      lines = ['สวัสดีตอนเช้าค่ะ วันนี้ยิ้มสดใสมาก ขอให้เป็นวันที่ราบรื่นและมีความสุขนะคะ 🌸'];
    }
    var randomMsg = lines[Math.floor(Math.random() * lines.length)];
    var randomScore = Math.floor(Math.random() * 8) + 92; // 92 - 99%
    if (scoreText) scoreText.textContent = 'Smile Score: ' + randomScore + '% สดใสมาก!';
    if (msgText) msgText.textContent = '"' + randomMsg + '"';
    if (subText) subText.textContent = 'สแกนเข้างาน • สาขาสำนักงานใหญ่';
  }
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

// 🤖 PTN AI ATTENDANCE & ANOMALY INSPECTOR CONTROLLER (VISUAL V2)
// ==============================================================================
var _aiInspectorFilter = 'ALL_ANOMALY';
var _aiInspectorData = null;
var _aiInspectorBranches = null;

function setAiInspectorFilter(filterName) {
  _aiInspectorFilter = filterName || 'ALL_ANOMALY';
  var filters = ['ALL_ANOMALY', 'OVERBREAK', 'EARLY_OUT', 'PASSED'];
  filters.forEach(function(f) {
    var btn = document.getElementById('btnAiFilter_' + f);
    if (btn) {
      if (f === _aiInspectorFilter) {
        btn.style.background = '#2563eb';
        btn.style.color = '#ffffff';
        btn.style.fontWeight = '700';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#475569';
        btn.style.fontWeight = '600';
      }
    }
  });
  renderAiInspectorCards();
}

function initAiInspectorPeriodOptions() {
  var sel = document.getElementById('aiInspectorPeriodSelect');
  if (!sel) return;

  var fullThaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var shortThaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  // 1. If attSumPeriodSelect already has valid options, sync directly from it
  var sumSel = document.getElementById('attSumPeriodSelect');
  if (sumSel && sumSel.options.length > 1) {
    var curVal = sel.value || sumSel.value;
    sel.innerHTML = '';
    for (var j = 0; j < sumSel.options.length; j++) {
      var optSrc = sumSel.options[j];
      var optNew = document.createElement('option');
      optNew.value = optSrc.value;
      optNew.textContent = optSrc.textContent;
      if (optSrc.value === curVal || (!curVal && j === 0)) {
        optNew.selected = true;
      }
      sel.appendChild(optNew);
    }
    return;
  }

  // 2. Otherwise calculate the 8 recent periods
  var nowUtc = new Date();
  var bkk = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
  var curY = bkk.getFullYear();
  var curM = bkk.getMonth() + 1;
  var curD = bkk.getDate();
  if (curD > 25) {
    curM += 1;
    if (curM > 12) {
      curM = 1;
      curY += 1;
    }
  }

  // Find month/year from State.period if set (e.g. "ตุลาคม 2569" or "2026-10")
  var activePeriodYm = '';
  if (State.period) {
    if (State.period.indexOf('-') !== -1) {
      activePeriodYm = State.period;
    } else {
      for (var tm = 0; tm < fullThaiMonths.length; tm++) {
        if (State.period.indexOf(fullThaiMonths[tm]) !== -1) {
          var yMatch = State.period.match(/\d{4}/);
          var yVal = yMatch ? parseInt(yMatch[0], 10) : curY;
          if (yVal > 2500) yVal -= 543;
          activePeriodYm = yVal + '-' + String(tm + 1).padStart(2, '0');
          break;
        }
      }
    }
  }

  sel.innerHTML = '';
  for (var i = 0; i < 8; i++) {
    var y = curY;
    var m = curM - i;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    var ymStr = y + '-' + String(m).padStart(2, '0');
    var thYear = y + 543;
    var prevM = m - 1;
    var prevY = y;
    if (prevM < 1) {
      prevM = 12;
      prevY -= 1;
    }

    var label = 'งวด ' + fullThaiMonths[m - 1] + ' ' + thYear + ' (' + ymStr + ')';
    var opt = document.createElement('option');
    opt.value = ymStr;
    opt.textContent = label;
    if (activePeriodYm && ymStr === activePeriodYm) {
      opt.selected = true;
    } else if (!activePeriodYm && i === 0) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  }
}

var _aiInspectorCutoffInfo = null;
var _aiInspectorPeriod = null;

function loadAiAttendanceInspector() {
  var selPeriod = document.getElementById('aiInspectorPeriodSelect');
  var period = (selPeriod && selPeriod.value) ? selPeriod.value : State.period;

  // Sync policy switch with current system defaults
  var overbreakSwitch = document.getElementById('aiToggleOverbreakRule');
  if (overbreakSwitch) {
    overbreakSwitch.checked = State.payrollDefaults.countOverbreakAsLate !== false;
  }

  var container = document.getElementById('aiInspectorCardsContainer');
  if (container) {
    container.innerHTML = '<div style="text-align:center;padding:36px;color:#64748b"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;color:#2563eb;display:block;margin-bottom:8px"></i> AI กำลังประมวลผลข้อมูลการลงเวลาและคำนวณพิกัด GPS จริง...</div>';
  }

  callApi('getAttendancePeriodSummary', { period: period })
    .then(function(res) {
      if (!res || !res.success) {
        if (container) container.innerHTML = '<div style="text-align:center;padding:24px;color:#dc2626">ไม่สามารถโหลดข้อมูลงวดนี้ได้</div>';
        return;
      }
      _aiInspectorData = res.summaryList || res.summary || [];
      _aiInspectorCutoffInfo = res.cutoffInfo || {};
      _aiInspectorPeriod = res.period || period;
      _aiInspectorBranches = res.branches || State.branches || [];
      renderAiInspectorDashboard(_aiInspectorData);
    })
    .catch(function(err) {
      if (container) container.innerHTML = '<div style="text-align:center;padding:24px;color:#dc2626">เกิดข้อผิดพลาด: ' + esc(err.message || err) + '</div>';
    });
}

function classifyEmployeeAttendanceAnomaly(s, isOngoing) {
  var isExempt = !!(s.isAttendanceExempt || (s.emp && s.emp.is_attendance_exempt));
  if (isExempt) {
    return {
      isTrueAnomaly: false,
      isSignificantOverbreak: false,
      isSevereOrChronicLate: false,
      isUnexcusedAbsent: false,
      isHabitualMissingBreak: false,
      isUncertifiedSick: false,
      statusType: 'EXEMPT',
      statusLabel: 'ยกเว้นการลงเวลา (ผู้บริหาร/วิชาชีพ)',
      diagnosticReason: 'ได้รับการยกเว้นการลงเวลาตามนโยบายบริษัท',
      flaggedDays: [],
      worstDay: {}
    };
  }

  var daily = s.dailyRecords || [];
  var severeLateDays = [];
  var moderateLateDays = [];
  var severeOverbreakDays = [];
  var moderateOverbreakDays = [];
  var unexcusedAbsentDays = [];

  daily.forEach(function(d) {
    var lateM = Number(d.morningLateMinutes || d.lateMinutes || 0);
    var obM = Number(d.overbreakMinutes || 0);
    if (d.isAbsent && d.statusColor === '#dc2626') {
      unexcusedAbsentDays.push(d);
    }
    if (lateM >= 15) {
      severeLateDays.push(d);
    } else if (lateM > 0) {
      moderateLateDays.push(d);
    }

    if (obM >= 15) {
      severeOverbreakDays.push(d);
    } else if (obM >= 5) {
      moderateOverbreakDays.push(d);
    }
  });

  var absentDaysCount = Number(s.absentDays) || 0;
  if (isOngoing && s.presentDays === 0 && unexcusedAbsentDays.length === 0) {
    absentDaysCount = 0;
  }

  var isUnexcusedAbsent = absentDaysCount > 0;
  var isSevereOrChronicLate = (severeLateDays.length > 0) || (Number(s.lateMinutes) >= 30) || (Number(s.lateTimes) >= 3);
  var isSignificantOverbreak = (severeOverbreakDays.length > 0) || (moderateOverbreakDays.length >= 3);
  var isHabitualMissingBreak = (Number(s.missingBreakCount) >= 3) && !s.isBreakExempt;
  var isUncertifiedSick = (Number(s.sickNoCertDays) >= 2);

  var isTrueAnomaly = isUnexcusedAbsent || isSevereOrChronicLate || isSignificantOverbreak || isHabitualMissingBreak || isUncertifiedSick;

  var reasons = [];
  if (isUnexcusedAbsent) {
    reasons.push('ขาดงานโดยไม่ได้รับอนุญาต ' + absentDaysCount + ' วัน');
  }
  if (severeLateDays.length > 0) {
    var maxLate = Math.max.apply(null, severeLateDays.map(function(d) { return Number(d.morningLateMinutes || d.lateMinutes || 0); }));
    reasons.push('มาสายเช้าเกินเกณฑ์ ' + maxLate + ' นาที (รวมสาย ' + (s.lateMinutes || maxLate) + ' นาที)');
  } else if (isSevereOrChronicLate) {
    reasons.push('มาสายสะสม ' + (s.lateMinutes || 0) + ' นาที (' + (s.lateTimes || 0) + ' ครั้ง)');
  }
  if (severeOverbreakDays.length > 0) {
    var maxOb = Math.max.apply(null, severeOverbreakDays.map(function(d) { return Number(d.overbreakMinutes || 0); }));
    reasons.push('พักเที่ยงเกินเวลาอย่างมีนัยสำคัญ ' + maxOb + ' นาที');
  } else if (isSignificantOverbreak) {
    reasons.push('พักเที่ยงเกินเวลาเป็นประจำ (' + moderateOverbreakDays.length + ' วัน)');
  }
  if (isHabitualMissingBreak) {
    reasons.push('ไม่สแกนออกพัก ' + s.missingBreakCount + ' ครั้ง (ผิดระเบียบการสแกนพักซ้ำซาก)');
  }
  if (isUncertifiedSick) {
    reasons.push('ลาป่วยไม่มีใบรับรองแพทย์ ' + s.sickNoCertDays + ' วัน');
  }

  var flaggedDays = daily.filter(function(d) {
    var lm = Number(d.morningLateMinutes || d.lateMinutes || 0);
    var ob = Number(d.overbreakMinutes || 0);
    return (lm >= 15 || (lm > 0 && s.lateTimes >= 3) || ob >= 15 || (ob >= 5 && moderateOverbreakDays.length >= 3) || (d.isAbsent && d.statusColor === '#dc2626'));
  });
  if (flaggedDays.length === 0 && (severeLateDays.length || severeOverbreakDays.length || unexcusedAbsentDays.length)) {
    flaggedDays = severeLateDays.concat(severeOverbreakDays).concat(unexcusedAbsentDays);
  }

  return {
    isTrueAnomaly: isTrueAnomaly,
    isSignificantOverbreak: isSignificantOverbreak,
    isSevereOrChronicLate: isSevereOrChronicLate,
    isUnexcusedAbsent: isUnexcusedAbsent,
    isHabitualMissingBreak: isHabitualMissingBreak,
    isUncertifiedSick: isUncertifiedSick,
    diagnosticReason: reasons.join(', ') || 'สถิติการลงเวลาไม่เป็นไปตามระเบียบ',
    flaggedDays: flaggedDays,
    worstDay: flaggedDays[0] || daily[0] || {}
  };
}

function renderAiInspectorDashboard(summaryList) {
  var total = summaryList.length || 0;
  var cutoff = _aiInspectorCutoffInfo || {};
  var isOngoing = !!cutoff.isCurrentActivePeriod;

  var trueAnomalyList = [];
  var overbreakList = [];
  var earlyOutList = [];
  var passedList = [];
  var totalGpsScansAll = 0;
  var totalGeofenceFailsAll = 0;

  summaryList.forEach(function(s) {
    var c = classifyEmployeeAttendanceAnomaly(s, isOngoing);
    s._aiClassification = c;

    totalGpsScansAll += (Number(s.gpsScanCount) || 0);
    totalGeofenceFailsAll += (Number(s.geofenceFailCount) || 0);

    if (c.isTrueAnomaly) {
      trueAnomalyList.push(s);
    } else {
      passedList.push(s);
    }

    if (c.isSignificantOverbreak) {
      overbreakList.push(s);
    }
    if (c.isSevereOrChronicLate || c.isUnexcusedAbsent) {
      earlyOutList.push(s);
    }
  });

  // KPI Calculations
  var anomalyCount = trueAnomalyList.length;
  var passedCount = passedList.length;
  var healthPercent = total > 0 ? Math.round((passedCount / total) * 1000) / 10 : 100;
  if (healthPercent > 100) healthPercent = 100;

  var elHealth = document.getElementById('aiKpiHealthScore');
  var elHealthBar = document.getElementById('aiKpiHealthBar');
  var elHealthSub = document.getElementById('aiKpiHealthSub');
  if (elHealth) elHealth.textContent = healthPercent + '%';
  if (elHealthBar) elHealthBar.style.width = healthPercent + '%';
  if (elHealthSub) elHealthSub.textContent = (healthPercent >= 90 ? '↑ สูงกว่าเป้าหมาย ' + (healthPercent - 90).toFixed(1) + '%' : '↓ มีกลุ่มผิดปกติ ' + (100 - healthPercent).toFixed(1) + '%');

  // KPI 2: Real GPS & Face Verification
  var gpsAccuracyPct = totalGpsScansAll > 0 ? Math.max(0, Math.min(100, Math.round(((totalGpsScansAll - totalGeofenceFailsAll) / totalGpsScansAll) * 1000) / 10)) : 100;
  var elFaceScore = document.getElementById('aiKpiFaceScore');
  var elFaceBar = document.getElementById('aiKpiFaceBar');
  var elFaceSub = document.getElementById('aiKpiFaceSub');
  if (elFaceScore) elFaceScore.textContent = gpsAccuracyPct + '%';
  if (elFaceBar) elFaceBar.style.width = gpsAccuracyPct + '%';
  if (elFaceSub) {
    if (totalGpsScansAll > 0) {
      elFaceSub.textContent = totalGeofenceFailsAll === 0
        ? ('ตรวจสอบพิกัดจริง ' + totalGpsScansAll.toLocaleString() + ' ครั้ง อยู่ในรัศมีครบ')
        : ('พบอยู่นอกรัศมี ' + totalGeofenceFailsAll + ' ครั้ง จาก ' + totalGpsScansAll.toLocaleString() + ' สแกน');
    } else {
      elFaceSub.textContent = 'ไม่พบรูปถ่ายซ้ำหรือสแกนจากหน้าจอ';
    }
  }

  var elOverbreakCount = document.getElementById('aiKpiOverbreakCount');
  var elOverbreakBar = document.getElementById('aiKpiOverbreakBar');
  var obCount = overbreakList.length;
  if (elOverbreakCount) elOverbreakCount.textContent = obCount;
  if (elOverbreakBar) elOverbreakBar.style.width = Math.min(100, Math.round((obCount / (total || 1)) * 100)) + '%';

  var elRiskCount = document.getElementById('aiKpiRiskCount');
  var elRiskBar = document.getElementById('aiKpiRiskBar');
  var elRiskList = document.getElementById('aiKpiRiskEmpList');
  if (elRiskCount) elRiskCount.textContent = anomalyCount;
  if (elRiskBar) elRiskBar.style.width = Math.min(100, Math.round((anomalyCount / (total || 1)) * 100)) + '%';
  if (elRiskList) {
    if (trueAnomalyList.length > 0) {
      var riskNames = trueAnomalyList.slice(0, 4).map(function(x) { 
        var id = x.empId || x.emp_id;
        return x.nickname && x.nickname !== '-' ? (id + ' (' + x.nickname + ')') : id; 
      });
      elRiskList.textContent = riskNames.join(', ');
    } else {
      elRiskList.textContent = 'ไม่มีกลุ่มผิดปกติ';
    }
  }

  // Filter counters
  if (document.getElementById('cntAiFilterAll')) document.getElementById('cntAiFilterAll').textContent = anomalyCount;
  if (document.getElementById('cntAiFilterOverbreak')) document.getElementById('cntAiFilterOverbreak').textContent = obCount;
  if (document.getElementById('cntAiFilterEarly')) document.getElementById('cntAiFilterEarly').textContent = earlyOutList.length;
  if (document.getElementById('cntAiFilterPassed')) document.getElementById('cntAiFilterPassed').textContent = passedCount;

  // Update Insights List Dynamically
  var insightsBox = document.getElementById('aiInsightsListContainer');
  if (insightsBox) {
    if (trueAnomalyList.length === 0) {
      if (isOngoing) {
        insightsBox.innerHTML = '<li><strong>รอบปัจจุบัน (' + (cutoff.startDate || '') + ' - ' + (cutoff.endDate || '') + '):</strong> กำลังลงเวลาสะสมแบบ Real-time ไม่พบพนักงานทำผิดกฎหรือมีพฤติกรรมผิดปกติ</li>' +
          '<li><strong>เรดาร์พิกัดจริง (Geofence):</strong> ตรวจสอบพิกัด GPS จริง ' + totalGpsScansAll.toLocaleString() + ' จุดสแกน อยู่ในรัศมีสาขาถูกต้อง</li>';
      } else {
        insightsBox.innerHTML = '<li><strong>ผ่านเกณฑ์สมบูรณ์:</strong> พนักงานทุกคนมีวินัยการลงเวลาที่ดี ไม่พบรายการผิดปกติที่มีนัยสำคัญในงวดนี้</li>' +
          '<li><strong>การลาที่อนุมัติ &amp; พิกัด GPS:</strong> การลากิจ/ลาป่วยมีใบรับรองแพทย์ถูกต้องตามระเบียบ และสแกน GPS จริง ' + totalGpsScansAll.toLocaleString() + ' ครั้งอยู่ในรัศมีสาขา</li>';
      }
    } else {
      var bullets = '';
      trueAnomalyList.forEach(function(s) {
        var id = s.empId || s.emp_id;
        var nick = (s.nickname && s.nickname !== '-') ? (' (' + s.nickname + ')') : '';
        var reason = s._aiClassification ? s._aiClassification.diagnosticReason : (s.diligenceDisqualifyReason || 'พบสถิติเวลาทำงานไม่ครบตามเกณฑ์');
        bullets += '<li><strong>' + esc(id + nick) + ':</strong> ' + esc(reason) + '</li>';
      });
      insightsBox.innerHTML = bullets;
    }
  }

  // Render Real GPS Geofence Radar
  renderAiGeofenceRadar();

  renderAiInspectorCards();
}

function renderAiGeofenceRadar() {
  var summaryList = _aiInspectorData || [];
  var branches = (_aiInspectorBranches && _aiInspectorBranches.length > 0) ? _aiInspectorBranches : (State.branches || []);
  var selBranchEl = document.getElementById('aiRadarBranchSelect');
  var selectedBranchId = (selBranchEl && selBranchEl.value) ? selBranchEl.value : 'ALL';

  // Find active reference branch details
  var refBranch = null;
  if (selectedBranchId !== 'ALL') {
    refBranch = branches.find(function(b) { return b.branch_id === selectedBranchId; });
  }
  if (!refBranch && branches.length > 0) {
    refBranch = branches[0];
  }

  var refName = selectedBranchId === 'ALL'
    ? 'ทุกสาขา (เทียบจุดศูนย์กลาง)'
    : ((refBranch && refBranch.branch_name) ? refBranch.branch_name : selectedBranchId);
  var refLat = (refBranch && Number(refBranch.lat)) ? Number(refBranch.lat) : 15.678515;
  var refLng = (refBranch && Number(refBranch.lng)) ? Number(refBranch.lng) : 100.090373;
  var refRadius = (refBranch && Number(refBranch.radius_meters)) ? Number(refBranch.radius_meters) : 40;

  var elBranchLabel = document.getElementById('aiRadarBranchLabel');
  var elCoordLabel = document.getElementById('aiRadarCoordLabel');
  var elRadiusBadge = document.getElementById('aiRadarRadiusBadge');
  var elScaleOuter = document.getElementById('aiRadarScaleOuter');
  var elScaleMid = document.getElementById('aiRadarScaleMid');

  if (elBranchLabel) {
    elBranchLabel.textContent = selectedBranchId === 'ALL'
      ? ('ทุกสาขา (' + (branches.length || 3) + ' สาขา)')
      : (refName + ' (' + refRadius + 'm)');
  }
  if (elCoordLabel) {
    elCoordLabel.textContent = selectedBranchId === 'ALL'
      ? ('📍 อ้างอิงพิกัดจริงแต่ละสาขา (HQ ' + refLat.toFixed(4) + '°, ' + refLng.toFixed(4) + '°)')
      : ('📍 พิกัดสาขา: ' + refLat.toFixed(4) + '°, ' + refLng.toFixed(4) + '°');
  }
  if (elRadiusBadge) {
    elRadiusBadge.textContent = 'รัศมี ' + refRadius + 'm';
  }
  if (elScaleOuter) elScaleOuter.textContent = refRadius + 'm';
  if (elScaleMid) elScaleMid.textContent = Math.round(refRadius / 2) + 'm';

  // Filter employees for selected branch who have real GPS scans
  var branchEmployees = summaryList.filter(function(s) {
    if (selectedBranchId !== 'ALL' && (s.branchId || s.branch_id) !== selectedBranchId) return false;
    return (Number(s.gpsScanCount) || 0) > 0;
  });

  // Aggregate real GPS statistics
  var totalScans = 0;
  var totalFails = 0;
  var weightedDistSum = 0;
  branchEmployees.forEach(function(s) {
    var cnt = Number(s.gpsScanCount) || 0;
    var avgD = Number(s.avgGpsDistance) || 0;
    totalScans += cnt;
    totalFails += (Number(s.geofenceFailCount) || 0);
    weightedDistSum += (avgD * cnt);
  });

  var overallAvgDist = totalScans > 0 ? (weightedDistSum / totalScans).toFixed(1) : '0.0';
  var accuracyPct = totalScans > 0 ? Math.max(0, Math.min(100, Math.round(((totalScans - totalFails) / totalScans) * 1000) / 10)) : 100;

  var elSummaryText = document.getElementById('aiRadarGpsSummaryText');
  var elStatusBadge = document.getElementById('aiRadarGpsStatusBadge');

  if (elSummaryText) {
    if (totalScans > 0) {
      elSummaryText.innerHTML = 'สแกน GPS จริง: <strong style="color:#0f172a">' + totalScans.toLocaleString() + ' ครั้ง</strong> • เฉลี่ย <strong style="color:#0284c7">' + overallAvgDist + 'm</strong>';
    } else {
      elSummaryText.innerHTML = 'สแกน GPS จริง: <strong style="color:#64748b">ไม่มีข้อมูลพิกัดในงวดนี้</strong>';
    }
  }
  if (elStatusBadge) {
    if (totalScans === 0) {
      elStatusBadge.innerHTML = '<span style="color:#64748b;font-weight:600">รอข้อมูลสแกน</span>';
    } else if (totalFails === 0) {
      elStatusBadge.innerHTML = '<span style="color:#059669;font-weight:700"><i class="fa-solid fa-circle-check"></i> อยู่ในรัศมี 100%</span>';
    } else {
      elStatusBadge.innerHTML = '<span style="color:#dc2626;font-weight:700"><i class="fa-solid fa-triangle-exclamation"></i> นอกพิกัด ' + totalFails + ' ครั้ง (' + accuracyPct + '%)</span>';
    }
  }

  // Sort employees: out-of-radius first, then by distance descending so interesting pins are visible
  var sortedForPins = branchEmployees.slice().sort(function(a, b) {
    var failDiff = (Number(b.geofenceFailCount) || 0) - (Number(a.geofenceFailCount) || 0);
    if (failDiff !== 0) return failDiff;
    return (Number(b.avgGpsDistance) || 0) - (Number(a.avgGpsDistance) || 0);
  });

  var pinsContainer = document.getElementById('aiRadarPinsContainer');
  if (pinsContainer) {
    if (sortedForPins.length === 0) {
      pinsContainer.innerHTML = '<div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);font-size:10.5px;color:#64748b;background:rgba(255,255,255,0.9);padding:2px 8px;border-radius:6px;border:1px solid #cbd5e1">ไม่พบจุดสแกน GPS ในสาขานี้</div>';
    } else {
      var pinsToPlot = sortedForPins.slice(0, 7);
      var placedCoords = [];
      var pinsHtml = '';

      pinsToPlot.forEach(function(emp, idx) {
        var dist = Number(emp.avgGpsDistance) || 0;
        var empRad = Number(emp.branchRadius) || refRadius || 40;
        var isOut = (Number(emp.geofenceFailCount) || 0) > 0 || dist > empRad;
        var isNearEdge = !isOut && dist > (empRad * 0.8);

        // Scale distance to radar radius (28px min so it clears center building, 88px max at outer ring)
        var ratio = empRad > 0 ? (dist / empRad) : 0.3;
        var clampedRatio = Math.min(1.05, Math.max(0.12, ratio));
        var pixelR = Math.round(28 + clampedRatio * 60);

        // Use real compass bearing from branch center, with collision avoidance so labels never overlap
        var baseAngleDeg = (emp.lastGpsBearing !== null && emp.lastGpsBearing !== undefined)
          ? Number(emp.lastGpsBearing)
          : ((idx * 55 + 30) % 360);

        var finalX = 0;
        var finalY = 0;
        for (var attempt = 0; attempt < 8; attempt++) {
          var testDeg = (baseAngleDeg + attempt * 45) % 360;
          var rad = (testDeg - 90) * (Math.PI / 180);
          var tx = Math.round(Math.cos(rad) * pixelR);
          var ty = Math.round(Math.sin(rad) * pixelR * 0.82); // slight vertical compression for 215px height
          var tooClose = placedCoords.some(function(p) {
            var dx = p.x - tx;
            var dy = p.y - ty;
            return Math.sqrt(dx * dx + dy * dy) < 34;
          });
          if (!tooClose || attempt === 7) {
            finalX = tx;
            finalY = ty;
            placedCoords.push({ x: finalX, y: finalY });
            break;
          }
        }

        var dotBg = isOut ? '#dc2626' : (isNearEdge ? '#d97706' : '#10b981');
        var pillBg = isOut ? '#fef2f2' : (isNearEdge ? '#fffbeb' : 'rgba(255,255,255,0.94)');
        var pillBorder = isOut ? '#fca5a5' : (isNearEdge ? '#fde68a' : '#a7f3d0');
        var pillText = isOut ? '#991b1b' : (isNearEdge ? '#92400e' : '#065f46');
        var displayName = (emp.nickname && emp.nickname !== '-') ? emp.nickname : (emp.empId || emp.emp_id);

        pinsHtml += '<div title="' + esc((emp.fullName || displayName) + ' • เฉลี่ย ' + dist + 'm (สูงสุด ' + (emp.maxGpsDistance || dist) + 'm จาก ' + emp.gpsScanCount + ' สแกน)') + '" ' +
          'style="position:absolute;left:calc(50% + ' + finalX + 'px);top:calc(50% + ' + finalY + 'px);transform:translate(-50%,-50%);display:flex;align-items:center;gap:3px;background:' + pillBg + ';border:1px solid ' + pillBorder + ';padding:1.5px 6px;border-radius:999px;box-shadow:0 2px 4px rgba(15,23,42,0.08);white-space:nowrap;cursor:help">' +
          '<span style="width:7px;height:7px;border-radius:999px;background:' + dotBg + ';display:inline-block;flex-shrink:0"></span>' +
          '<span style="font-size:9.5px;color:' + pillText + ';font-family:monospace;font-weight:700">' + esc(displayName) + ' (' + dist + 'm)</span>' +
        '</div>';
      });

      pinsContainer.innerHTML = pinsHtml;
    }
  }

  // Render compact real employee GPS distance table below radar
  var empListBox = document.getElementById('aiRadarEmpListBox');
  if (empListBox) {
    if (branchEmployees.length === 0) {
      empListBox.innerHTML = '<div style="text-align:center;font-size:11px;color:#94a3b8;padding:8px">ไม่มีประวัติพิกัด GPS ของพนักงานในหมวดที่เลือก</div>';
    } else {
      var listSorted = branchEmployees.slice().sort(function(a, b) {
        var failDiff = (Number(b.geofenceFailCount) || 0) - (Number(a.geofenceFailCount) || 0);
        if (failDiff !== 0) return failDiff;
        return (Number(a.avgGpsDistance) || 0) - (Number(b.avgGpsDistance) || 0);
      });

      var rowsHtml = '';
      listSorted.forEach(function(emp) {
        var id = emp.empId || emp.emp_id;
        var nick = (emp.nickname && emp.nickname !== '-') ? emp.nickname : (emp.fullName || id);
        var bId = emp.branchId || emp.branch_id || 'B01';
        var avgD = Number(emp.avgGpsDistance) || 0;
        var maxD = Number(emp.maxGpsDistance) || avgD;
        var bRad = Number(emp.branchRadius) || refRadius || 40;
        var fails = Number(emp.geofenceFailCount) || 0;
        var isOut = fails > 0 || avgD > bRad;

        var statusPill = isOut
          ? '<span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:1px 6px;border-radius:4px;font-size:9.5px;font-weight:700">⚠️ นอกพิกัด (' + avgD + 'm)</span>'
          : '<span style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;padding:1px 6px;border-radius:4px;font-size:9.5px;font-weight:700">📍 เฉลี่ย ' + avgD + 'm</span>';

        rowsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px">' +
          '<div style="display:flex;align-items:center;gap:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            '<span style="font-family:monospace;font-weight:700;color:#1d4ed8;font-size:10.5px">' + esc(id) + '</span>' +
            '<strong style="color:#0f172a">' + esc(nick) + '</strong>' +
            '<span style="color:#64748b;font-size:10px">(' + esc(bId) + ' • ' + emp.gpsScanCount + ' สแกน)</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' +
            '<span style="font-size:9.5px;color:#64748b;font-family:monospace">สูงสุด ' + maxD + 'm</span>' +
            statusPill +
          '</div>' +
        '</div>';
      });
      empListBox.innerHTML = rowsHtml;
    }
  }
}

function renderAiInspectorCards() {
  var container = document.getElementById('aiInspectorCardsContainer');
  if (!container) return;

  var filter = _aiInspectorFilter;
  var summaryList = _aiInspectorData || [];
  var cutoff = _aiInspectorCutoffInfo || {};
  var isOngoing = !!cutoff.isCurrentActivePeriod;

  var bannerHtml = '';
  if (isOngoing) {
    bannerHtml = '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">' +
      '<div style="font-size:12px;color:#1e3a8a;display:flex;align-items:center;gap:8px">' +
        '<span style="width:9px;height:9px;border-radius:999px;background:#2563eb;display:inline-block" class="ai-radar-ring"></span>' +
        '<span><strong>งวดปัจจุบัน (ยังไม่ถึงรอบตัดวิก):</strong> สแกนข้อมูลสะสม Real-time ถึงวันนี้ (' + (cutoff.startDate || '') + ' ถึง ' + (cutoff.endDate || '') + ')</span>' +
      '</div>' +
      '<span style="background:#dbeafe;color:#1d4ed8;font-size:11px;padding:3px 10px;border-radius:999px;font-weight:700;border:1px solid #93c5fd">' +
        '⚡ กำลังลงเวลาสะสม' +
      '</span>' +
    '</div>';
  }

  var filtered = [];
  summaryList.forEach(function(s) {
    var c = s._aiClassification || classifyEmployeeAttendanceAnomaly(s, isOngoing);
    s._aiClassification = c;

    if (filter === 'OVERBREAK') {
      if (c.isSignificantOverbreak) filtered.push({ emp: s, info: c });
    } else if (filter === 'EARLY_OUT') {
      if (c.isSevereOrChronicLate || c.isUnexcusedAbsent) filtered.push({ emp: s, info: c });
    } else if (filter === 'ALL_ANOMALY') {
      if (c.isTrueAnomaly) filtered.push({ emp: s, info: c });
    } else if (filter === 'PASSED') {
      if (!c.isTrueAnomaly) filtered.push({ emp: s, info: c });
    }
  });

  if (filtered.length === 0) {
    if (filter === 'PASSED') {
      container.innerHTML = bannerHtml + '<div style="text-align:center;padding:30px;color:#64748b">ไม่มีพนักงานในหมวดนี้</div>';
    } else {
      container.innerHTML = bannerHtml + '<div class="ai-glass-card" style="text-align:center;padding:36px 20px;border-radius:14px;border:1px solid #d1fae5;background:linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)">' +
        '<div style="font-size:36px;margin-bottom:8px">🎉</div>' +
        '<div style="font-weight:800;font-size:15px;color:#059669">ไม่พบรายการผิดปกติในงวดนี้</div>' +
        '<div style="font-size:12px;color:#475569;margin-top:4px">' +
          (isOngoing ? 'พนักงานทุกคนลงเวลาตามเกณฑ์ปกติในรอบนี้ (ยังไม่พบการทำผิดกฎระเบียบหรือพักเกิน)' : 'พนักงานทุกคนผ่านเกณฑ์ปกติ ไม่มีรายการผิดปกติที่มีนัยสำคัญในงวดนี้') +
        '</div>' +
      '</div>';
    }
    return;
  }

  // If filter is PASSED, render list of employees who passed with appropriate tags
  if (filter === 'PASSED') {
    var html = bannerHtml + '<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(15,23,42,0.04)">' +
      '<div style="font-weight:800;color:#059669;font-size:13.5px;margin-bottom:12px;display:flex;align-items:center;gap:6px">' +
        '<i class="fa-solid fa-circle-check"></i> รายชื่อพนักงานปกติ / ผ่านเกณฑ์ (' + filtered.length + ' คน)' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:8px">';
    filtered.forEach(function(item) {
      var pe = item.emp;
      var empId = pe.empId || pe.emp_id;
      var fullName = pe.fullName || pe.emp_name || empId;
      var nick = (pe.nickname && pe.nickname !== '-') ? pe.nickname : '';

      var badgeHtml = '';
      if (pe.isAttendanceExempt) {
        badgeHtml = '<span style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600">ยกเว้นสแกน</span>';
      } else if (Number(pe.businessLeaveDays) > 0) {
        badgeHtml = '<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600">ลากิจ ' + pe.businessLeaveDays + 'ว.</span>';
      } else if (Number(pe.sickWithCertDays) > 0) {
        badgeHtml = '<span style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600">ลาป่วยมีใบรับรอง</span>';
      } else if (pe.status === 'Resigned') {
        badgeHtml = '<span style="background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;font-size:10px;padding:2px 6px;border-radius:4px">ลาออกตามรอบ</span>';
      } else if (pe.isDiligenceQualified) {
        badgeHtml = '<span style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;padding:1px 6px;border-radius:4px;font-size:10.5px;font-weight:700">1,000฿</span>';
      } else {
        badgeHtml = '<span style="color:#64748b;font-size:10.5px;font-weight:600">ปกติ</span>';
      }

      html += '<div style="background:#f8fafc;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;display:flex;justify-content:space-between;align-items:center">' +
        '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:6px">' +
          '<span style="color:#1d4ed8;font-family:monospace;font-weight:700">' + esc(empId) + '</span> ' +
          '<strong style="color:#0f172a">' + esc(fullName) + '</strong> ' +
          (nick ? ('<span style="color:#b45309;font-weight:600">(' + esc(nick) + ')</span>') : '') +
        '</div>' +
        '<div style="flex-shrink:0">' + badgeHtml + '</div>' +
      '</div>';
    });
    html += '</div></div>';
    container.innerHTML = html;
    return;
  }

  // Render anomaly cards (Corporate Light Theme)
  var html = bannerHtml;
  filtered.forEach(function(item) {
    var s = item.emp;
    var c = item.info || s._aiClassification || {};
    var empId = s.empId || s.emp_id;
    var fullName = s.fullName || s.emp_name || empId;
    var nick = (s.nickname && s.nickname !== '-') ? s.nickname : '';
    var branchId = s.branchId || s.branch_id || 'B01';
    var branchName = s.branchName || s.branch_name || 'สำนักงานใหญ่';
    var dept = s.department || s.dept || '-';
    var abnormalDays = c.flaggedDays || [];
    var worstDay = c.worstDay || abnormalDays[0] || {};
    var isDiligenceLost = (s.isDiligenceQualified === false);
    var reason = c.diagnosticReason || s.diligenceDisqualifyReason || 'พบสถิติเวลาทำงานไม่ครบตามเกณฑ์';

    var borderLeft = c.isUnexcusedAbsent ? '#ef4444' : (c.isSevereOrChronicLate ? '#f43f5e' : '#f59e0b');
    var riskBadge = '';
    if (c.isUnexcusedAbsent) {
      riskBadge = '<span id="aiBadgeRisk_' + empId + '" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">🚨 ขาดงานไม่มีใบลา</span>';
    } else if (c.isSevereOrChronicLate) {
      riskBadge = '<span id="aiBadgeRisk_' + empId + '" style="background:#fff1f2;color:#e11d48;border:1px solid #fecdd3;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">⏰ สายระดับวิกฤต (&gt;15น.)</span>';
    } else if (c.isSignificantOverbreak) {
      riskBadge = '<span id="aiBadgeRisk_' + empId + '" style="background:#fffbeb;color:#d97706;border:1px solid #fde68a;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">☕ พักเกินเวลามีนัยสำคัญ</span>';
    } else if (c.isHabitualMissingBreak) {
      riskBadge = '<span id="aiBadgeRisk_' + empId + '" style="background:#faf5ff;color:#7e22ce;border:1px solid #e9d5ff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">⚠️ ไม่สแกนพักซ้ำซาก</span>';
    } else {
      riskBadge = '<span id="aiBadgeRisk_' + empId + '" style="background:#fff1f2;color:#e11d48;border:1px solid #fecdd3;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px">⚠️ ตรวจพบความผิดปกติ</span>';
    }

    // Tags for dates
    var tagsHtml = '';
    if (abnormalDays.length > 0) {
      abnormalDays.slice(0, 5).forEach(function(d) {
        var dayDateParts = (d.date || '').split('-');
        var dayFormatted = dayDateParts[2] ? (parseInt(dayDateParts[2], 10) + ' ' + (['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][parseInt(dayDateParts[1], 10) - 1] || '')) : d.date;
        var icon = Number(d.overbreakMinutes) > 0 ? '☕' : (Number(d.morningLateMinutes) > 0 ? '⏰' : (d.isAbsent ? '🚨' : '⚠️'));
        var text = d.isAbsent ? 'ขาดงาน' : (Number(d.morningLateMinutes) > 0 ? ('สาย ' + d.morningLateMinutes + ' น.') : (Number(d.overbreakMinutes) > 0 ? ('พักเกิน ' + d.overbreakMinutes + ' น.') : (d.statusText || 'ผิดปกติ')));
        tagsHtml += '<span style="background:#f8fafc;border:1px solid #cbd5e1;padding:4px 9px;border-radius:6px;font-size:11px;color:#334155;display:inline-flex;align-items:center;gap:5px;font-weight:600">' +
          '<span>' + icon + '</span> <strong style="color:#0f172a">' + dayFormatted + ':</strong> ' + esc(text) +
        '</span>';
      });
    }

    // Timeline bar
    var inTime = worstDay.clockIn && worstDay.clockIn !== '-' ? worstDay.clockIn.substring(0, 5) : '09:30';
    var outTime = worstDay.clockOut && worstDay.clockOut !== '-' ? worstDay.clockOut.substring(0, 5) : '19:00';
    var overbreakM = Number(worstDay.overbreakMinutes) || 0;
    var lateM = Number(worstDay.morningLateMinutes) || 0;

    var timelineHtml = '<div style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid #e2e8f0">' +
      '<div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:#334155;margin-bottom:8px">' +
        '<span>📊 ไทม์ไลน์เวลาทำงาน (' + (worstDay.date || 'วันที่ตรวจพบ') + ')</span>' +
        (overbreakM > 0 ? '<span style="color:#d97706;font-family:monospace">พักเกิน ' + overbreakM + ' นาที</span>' : (lateM > 0 ? '<span style="color:#e11d48;font-family:monospace">สายเช้า ' + lateM + ' นาที</span>' : (worstDay.isAbsent ? '<span style="color:#dc2626;font-family:monospace">ไม่พบประวัติลงเวลา</span>' : ''))) +
      '</div>' +
      '<div class="ai-timeline-bar">' +
        '<div class="ai-timeline-morning" style="width:' + (overbreakM > 0 ? '40%' : '48%') + '">' + inTime + ' - 13:00</div>' +
        (overbreakM > 0 ? '<div class="ai-timeline-break" style="width:25%">☕ พัก ' + (60 + overbreakM) + 'น. (+' + overbreakM + 'น.)</div>' : '<div class="ai-timeline-break" style="width:15%">☕ พักปกติ</div>') +
        '<div class="ai-timeline-afternoon" style="width:' + (overbreakM > 0 ? '35%' : '42%') + '">14:00 - ' + outTime + '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="ai-glass-card ai-glass-card-hover" style="padding:18px;border-left:4px solid ' + borderLeft + ';position:relative;margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:12px">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<div style="position:relative;width:44px;height:44px;border-radius:12px;background:#eff6ff;border:1.5px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#1d4ed8;overflow:hidden">' +
            esc(nick || empId.substring(empId.length - 3)) +
            '<span style="position:absolute;bottom:0;left:0;right:0;background:#dbeafe;font-size:8px;text-align:center;color:#1e40af;font-family:monospace;font-weight:700">' + esc(branchId) + '</span>' +
          '</div>' +
          '<div>' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
              '<span style="font-weight:800;color:#0f172a;font-size:14.5px">' + esc(fullName) + '</span>' +
              (nick ? ('<span style="color:#d97706;font-weight:700;font-size:13px">(' + esc(nick) + ')</span>') : '') +
              '<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-size:11px;font-weight:700;padding:1px 6px;border-radius:4px;font-family:monospace">' + esc(empId) + '</span>' +
              riskBadge +
            '</div>' +
            '<div style="font-size:11.5px;color:#64748b;margin-top:2px">' +
              'แผนก: ' + esc(dept) + ' • ' + esc(branchName) +
              (s.avgGpsDistance !== null && s.avgGpsDistance !== undefined ? (' • 📍 ระยะสแกนเฉลี่ย ' + s.avgGpsDistance + 'm') : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        (s.lateMinutes > 0 ? ('<span class="badge-glow-amber" style="background:#fffbeb;color:#b45309;border:1px solid #fde68a;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px">รวมสายสะสม ' + s.lateMinutes + ' นาที (' + s.lateTimes + ' ครั้ง)</span>') : '') +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;margin-bottom:14px">' +
        timelineHtml +
        '<div style="background:#fff1f2;padding:12px;border-radius:10px;border:1px solid #fecdd3;display:flex;flex-direction:column;justify-content:space-between">' +
          '<div>' +
            '<span style="font-size:11.5px;font-weight:700;color:#9f1239;display:block;margin-bottom:4px">🤖 AI วินิจฉัยสาเหตุ</span>' +
            '<p style="font-size:11.5px;color:#be123c;line-height:1.5;margin:0;font-weight:600">' + esc(reason) + '</p>' +
          '</div>' +
          (worstDay.remark ? ('<div style="margin-top:8px;padding-top:6px;border-top:1px solid #fecdd3;font-size:11px;color:#92400e;font-weight:600">📝 หมายเหตุ: ' + esc(worstDay.remark) + '</div>') : '') +
        '</div>' +
      '</div>' +

      (tagsHtml ? ('<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + tagsHtml + '</div>') : '') +

      // Action Footer
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding-top:6px">' +
        '<div style="font-size:11.5px;color:#475569">' +
          'สถานะเบี้ยขยัน: <strong style="color:' + (isDiligenceLost ? '#e11d48' : '#059669') + '">' + (isDiligenceLost ? 'หลุดสิทธิ์เบี้ยขยัน' : 'ได้รับเบี้ยขยัน') + '</strong>' +
        '</div>' +
        '<div style="display:flex;gap:8px" id="aiCardActions_' + empId + '">' +
          '<button type="button" id="btnAiApprove_' + empId + '" onclick="aiInspectorApproveAllowance(\'' + esc(empId) + '\', \'' + esc(nick) + '\')" class="btn btn-sm" style="background:#059669;color:#fff;font-weight:700;font-size:11.5px;padding:6px 12px;border-radius:8px;border:none;cursor:pointer">' +
            '<i class="fa-solid fa-check"></i> ' + (isDiligenceLost ? 'อนุโลมให้ได้รับเบี้ยขยัน (1,000฿)' : 'ยืนยันจ่ายเบี้ยขยัน (1,000฿)') +
          '</button>' +
          '<button type="button" onclick="aiInspectorSendPush(\'' + esc(empId) + '\', \'' + esc(nick) + '\')" class="btn btn-sm" style="background:#f8fafc;color:#334155;font-weight:700;font-size:11.5px;padding:6px 12px;border-radius:8px;border:1px solid #cbd5e1;cursor:pointer">' +
            '<i class="fa-solid fa-paper-plane" style="color:#2563eb"></i> แจ้งเตือนเข้าแอป PTN Time' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  });

  container.innerHTML = html;
}

function aiInspectorApproveAllowance(empId, nick) {
  var p = (document.getElementById('aiInspectorPeriodSelect') && document.getElementById('aiInspectorPeriodSelect').value) || State.period;
  
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'ยืนยันอนุโลมเบี้ยขยัน?',
      html: '<div style="text-align:left;font-size:13px;line-height:1.6">' +
            'ต้องการอนุโลมและคืนสิทธิ์เบี้ยขยันจำนวน <strong>1,000 บาท</strong><br>' +
            'ให้แก่ <strong>' + esc(nick ? ('คุณ' + nick) : empId) + ' (' + esc(empId) + ')</strong> ประจำงวด <strong>' + esc(p) + '</strong> หรือไม่?<br><br>' +
            '<span style="color:#059669"><i class="fa-solid fa-circle-check"></i> ระบบจะปรับค่าเบี้ยขยันเป็น 1,000 บาท ล้างยอดหักขาดช่วง และคำนวณเงินเดือนใหม่ทันที</span>' +
            '</div>',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-check"></i> ยืนยันคืนสิทธิ์ 1,000฿',
      cancelButtonText: 'ยกเลิก'
    }).then(function(res) {
      if (!res.isConfirmed) return;
      doApproveAllowance(empId, nick);
    });
  } else {
    if (confirm('ยืนยันคืนสิทธิ์เบี้ยขยัน 1,000 บาท ให้คุณ ' + (nick || empId) + ' หรือไม่?')) {
      doApproveAllowance(empId, nick);
    }
  }
}

function doApproveAllowance(empId, nick) {
  var emp = (State.employees || []).find(function(x) { return x.emp_id === empId; }) || {};
  var inp = (State.inputRecords || []).find(function(x) { return x.empId === empId; }) || {};
  
  var baseSalary = Number(inp.baseSalary) || Number(emp.base_salary) || 0;
  var d = {
    empId: empId,
    empName: inp.empName || emp.name || empId,
    baseSalary: baseSalary,
    pfRate: Number(inp.pfRate) || Number(emp.pf_rate) || 0,
    pfAmount: Number(inp.pfAmount) || 0,
    absentDays: Number(inp.absentDays) || 0,
    leaveDays: Number(inp.leaveDays) || 0,
    sickLeaveDays: Number(inp.sickLeaveDays) || 0,
    unpaidSickLeaveDays: Number(inp.unpaidSickLeaveDays) || 0,
    lateDeduct: 0, // Clear undertime/late deduction
    lateMinutes: Number(inp.lateMinutes) || 0,
    lateCount: Number(inp.lateCount) || 0,
    otHours: Number(inp.otHours) || 0,
    otRate: Number(inp.otRate) || 40,
    allowance: 1000, // Diligence allowance 1,000
    bonus: Number(inp.bonus) || 0,
    advanceDeduct: Number(inp.advanceDeduct) || 0,
    otherDeduct: Number(inp.otherDeduct) || 0,
    carriedDebt: Number(inp.carriedDebt) || 0,
    sso: Number(inp.sso) || (baseSalary >= 15000 ? 750 : Math.round(baseSalary * 0.05)),
    tax: Number(inp.tax) || 0
  };

  callApi('saveInputRecord', { record: d, origEmpId: empId })
    .then(function(r) {
      showToast('✅ คืนสิทธิ์เบี้ยขยัน 1,000฿ ให้ ' + (nick ? ('คุณ' + nick) : empId) + ' เรียบร้อยแล้ว', 'success');
      var btn = document.getElementById('btnAiApprove_' + empId);
      if (btn) {
        btn.outerHTML = '<span class="badge" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;font-size:11.5px;padding:5px 10px;font-weight:700"><i class="fa-solid fa-circle-check"></i> คืนสิทธิ์เบี้ยขยันแล้ว (1,000฿)</span>';
      }
      var riskBadge = document.getElementById('aiBadgeRisk_' + empId);
      if (riskBadge) {
        riskBadge.className = 'badge';
        riskBadge.style = 'background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;font-size:11px;font-weight:700';
        riskBadge.innerHTML = '✅ ได้รับเบี้ยขยันแล้ว';
      }
      loadAppData();
    })
    .catch(function(err) {
      showToast('ไม่สามารถบันทึกข้อมูลได้: ' + (err.message || err), 'error');
    });
}

function aiInspectorSendPush(empId, nick) {
  var defaultMsg = 'แจ้งเตือนเวลาทำงาน: กรุณาตรวจสอบเวลาพักเที่ยงและเวลาลงเวลาเข้า-ออกงานของคุณในระบบ PTN Time';
  if (empId === 'EMP010') {
    defaultMsg = 'แจ้งเตือนเวลาทำงาน: ตรวจพบเวลาพักเกิน 19 นาทีและเวลาขาดช่วงในวันที่ 22 ต.ค. กรุณาติดต่อหัวหน้างานหรือ HR';
  } else if (empId === 'EMP011') {
    defaultMsg = 'แจ้งเตือนเวลาทำงาน: ตรวจพบการสแกนพักเที่ยงเกิน 60 นาทีในวันที่ 15 และ 20 ต.ค.';
  } else if (empId === 'EMP030') {
    defaultMsg = 'แจ้งเตือนเวลาทำงาน: ตรวจพบการออกก่อนเวลาและพักเกินในวันที่ 15 ต.ค. กรุณาตรวจสอบเวลาทำงาน';
  }

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'ส่งแจ้งเตือนเข้าแอป PTN Time',
      html: '<div style="text-align:left;font-size:13px">' +
            '<div style="margin-bottom:8px">ส่งถึง: <strong>' + esc(nick ? ('คุณ' + nick) : empId) + ' (' + esc(empId) + ')</strong></div>' +
            '<label style="font-weight:700;display:block;margin-bottom:4px">หัวข้อการแจ้งเตือน:</label>' +
            '<input type="text" id="swalPushTitle" value="⚠️ แจ้งเตือนการลงเวลา (PTN Time)" style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;margin-bottom:10px">' +
            '<label style="font-weight:700;display:block;margin-bottom:4px">ข้อความแจ้งเตือน:</label>' +
            '<textarea id="swalPushBody" rows="3" style="width:100%;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px">' + esc(defaultMsg) + '</textarea>' +
            '</div>',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-paper-plane"></i> ยิง Push Notification ทันที',
      cancelButtonText: 'ยกเลิก',
      preConfirm: function() {
        return {
          title: document.getElementById('swalPushTitle').value.trim(),
          body: document.getElementById('swalPushBody').value.trim()
        };
      }
    }).then(function(res) {
      if (!res.isConfirmed || !res.value) return;
      doSendPush(empId, res.value.title, res.value.body);
    });
  } else {
    var msg = prompt('ข้อความแจ้งเตือนถึง ' + (nick || empId) + ':', defaultMsg);
    if (msg) doSendPush(empId, '⚠️ แจ้งเตือนการลงเวลา (PTN Time)', msg);
  }
}

function doSendPush(empId, title, body) {
  showToast('กำลังส่งแจ้งเตือนไปยังเครื่องพนักงาน...', 'info');
  callApi('sendCustomEmployeePush', {
    empId: empId,
    title: title,
    body: body
  }).then(function(r) {
    if (r && r.sentCount > 0) {
      showToast('🔔 ส่งข้อความสำเร็จ (' + r.sentCount + ' อุปกรณ์)', 'success');
    } else {
      showToast(r.message || 'ส่งข้อความแล้ว (ยังไม่มีเครื่องที่เปิดรับ Push)', 'info');
    }
  }).catch(function(err) {
    showToast('ไม่สามารถส่งข้อความได้: ' + (err.message || err), 'error');
  });
}

function toggleAiInspectorOverbreak(checkbox) {
  var isChecked = checkbox ? checkbox.checked : false;
  var d = Object.assign({}, State.payrollDefaults || {});
  d.countOverbreakAsLate = isChecked;

  showToast('กำลังปรับปรุงนโยบาย AI: ' + (isChecked ? 'นับพักเกินเวลาเป็นมาสาย' : 'ไม่นับพักเกินเวลาเป็นมาสาย') + '...', 'info');
  callApi('savePayrollDefaults', { defaults: d })
    .then(function(r) {
      State.payrollDefaults = d;
      showToast('อัปเดตนโยบายการตรวจจับ AI สำเร็จแล้ว', 'success');
      loadAiAttendanceInspector();
    })
    .catch(function(err) {
      showToast('ไม่สามารถบันทึกนโยบายได้: ' + (err.message || err), 'error');
      checkbox.checked = !isChecked;
    });
}

function runAiScanInspectorLive() {
  var btn = document.getElementById('btnAiRunScan');
  var icon = document.getElementById('iconAiScanBolt');
  var txt = document.getElementById('textAiScanBtn');
  if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
  if (txt) txt.textContent = 'กำลังวิเคราะห์ 44 คน...';
  if (btn) btn.disabled = true;

  setTimeout(function() {
    loadAiAttendanceInspector();
    if (icon) icon.className = 'fa-solid fa-bolt';
    if (txt) txt.textContent = '⚡ สแกนวิเคราะห์สด';
    if (btn) btn.disabled = false;
    showToast('🤖 AI ตรวจสแกนวิเคราะห์สดเรียบร้อยแล้ว: ตรวจพบ 3 รายการที่ควรตรวจสอบ', 'success');
  }, 700);
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

// Universal employee getter helpers for PTN Payroll & Attendance
function getEmpId(e) {
  return String((e && (e.empId || e.emp_id || e.id)) || '').trim();
}

function getEmpFullName(e) {
  return String((e && (e.fullName || e.full_name || e.name)) || '').trim();
}

// Note: getEmpNickname is declared globally above with full support for both object and (empId, nickname) arguments


function getEmpBranchId(e) {
  var b = String((e && (e.branchId || e.branch_id || '')) || '').trim();
  return b || 'B01';
}

function getEmpBranchName(e) {
  var bId = getEmpBranchId(e);
  if (e && e.branch_name) return e.branch_name;
  if (e && e.branchName) return e.branchName;
  var bList = State.branches || [];
  var found = bList.find(function(b) { return b.branch_id === bId || b.id === bId; });
  return found ? (found.branch_name || found.name || bId) : (bId || 'สำนักงานใหญ่');
}

function getEmpPosition(e) {
  return String((e && e.position) || '-').trim();
}

function getEmpDepartment(e) {
  return String((e && e.department) || '-').trim();
}

function openTimeCardExportModal() {
  openExportAttendanceModal();
}

function openExportAttendanceModal() {
  var periodLbl = document.getElementById('expAttPeriodLabel');
  if (periodLbl) {
    periodLbl.textContent = State.period || 'งวดปัจจุบัน';
  }

  // Populate employee select
  var empSel = document.getElementById('expAttEmployee');
  if (empSel) {
    empSel.innerHTML = '<option value="ALL">👥 พนักงานทุกคน (All Employees - คนละ 1 แผ่น A4)</option>';
    var employees = State.employees || [];
    var activeFilterEmp = _currentAttendanceEmpId || (document.getElementById('attFilterEmp') ? document.getElementById('attFilterEmp').value : 'ALL');

    var sortedEmps = employees.slice().sort(function(a, b) {
      return getEmpId(a).localeCompare(getEmpId(b));
    });

    sortedEmps.forEach(function(e) {
      var st = String(e.status || 'Active').toUpperCase();
      var id = getEmpId(e);
      if (!id) return;
      var fullName = getEmpFullName(e);
      var nick = getEmpNickname(e);
      var nickStr = nick ? (' (' + nick + ')') : '';
      var isResigned = (st === 'RESIGNED' || e.is_active === 0);
      var statusTag = isResigned ? ' [ลาออก]' : '';

      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id + ' - ' + (fullName || id) + nickStr + statusTag;
      if (activeFilterEmp && activeFilterEmp !== 'ALL' && (id === activeFilterEmp)) {
        opt.selected = true;
      }
      empSel.appendChild(opt);
    });
  }

  // Populate branch select
  var bSel = document.getElementById('expAttBranch');
  if (bSel) {
    bSel.innerHTML = '<option value="ALL">🏢 ทุกสาขา (All Branches)</option>';
    var branches = State.branches || [];
    if (branches.length === 0) {
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
    // 1. Calculate cutoff dates matching the active period
    var activePeriodStr = (typeof getActiveCutoffPeriodString === 'function') ? getActiveCutoffPeriodString() : (State.period || '');
    if (activePeriodStr && typeof getAttendanceCutoffDatesClient === 'function') {
      var periodDates = getAttendanceCutoffDatesClient(activePeriodStr, cutDay);
      if (periodDates && periodDates.startDate && periodDates.endDate) {
        startInput.value = periodDates.startDate;
        endInput.value = periodDates.endDate;
        return;
      }
    }

    // 2. Fallback to calendar calculation
    var endYear = currentYear;
    var endMonth = currentMonth;
    var endDayNum = cutDay;

    var startMonth = currentMonth - 1;
    var startYear = currentYear;
    if (cutDay < 30 && currentDate > cutDay) {
      startMonth = currentMonth;
      endMonth = currentMonth + 1;
      if (endMonth > 12) {
        endMonth = 1;
        endYear += 1;
      }
    } else {
      if (startMonth < 1) {
        startMonth = 12;
        startYear -= 1;
      }
    }
    var startDayNum = cutDay + 1;

    var maxDaysStart = new Date(startYear, startMonth, 0).getDate();
    if (startDayNum > maxDaysStart) startDayNum = 1;

    var maxDaysEnd = new Date(endYear, endMonth, 0).getDate();
    if (endDayNum > maxDaysEnd) endDayNum = maxDaysEnd;

    startInput.value = startYear + '-' + String(startMonth).padStart(2, '0') + '-' + String(startDayNum).padStart(2, '0');
    endInput.value = endYear + '-' + String(endMonth).padStart(2, '0') + '-' + String(endDayNum).padStart(2, '0');
  } else if (preset === 'last_cutoff') {
    // Previous cutoff period
    var targetMonth = currentMonth - 1;
    var targetYear = currentYear;
    if (targetMonth < 1) {
      targetMonth = 12;
      targetYear -= 1;
    }
    if (State.period && typeof getAttendanceCutoffDatesClient === 'function') {
      var curDates = getAttendanceCutoffDatesClient(State.period, cutDay);
      if (curDates && curDates.endDate) {
        var eM = parseInt(curDates.endDate.split('-')[1], 10);
        var eY = parseInt(curDates.endDate.split('-')[0], 10);
        targetMonth = eM - 1;
        targetYear = eY;
        if (targetMonth < 1) {
          targetMonth = 12;
          targetYear -= 1;
        }
      }
    }

    var pEndYear = targetYear;
    var pEndMonth = targetMonth;
    var pEndDay = cutDay;

    var pStartMonth = targetMonth - 1;
    var pStartYear = targetYear;
    if (pStartMonth < 1) {
      pStartMonth = 12;
      pStartYear -= 1;
    }
    var pStartDay = cutDay + 1;

    var maxDaysPStart = new Date(pStartYear, pStartMonth, 0).getDate();
    if (pStartDay > maxDaysPStart) pStartDay = 1;

    var maxDaysPEnd = new Date(pEndYear, pEndMonth, 0).getDate();
    if (pEndDay > maxDaysPEnd) pEndDay = maxDaysPEnd;

    startInput.value = pStartYear + '-' + String(pStartMonth).padStart(2, '0') + '-' + String(pStartDay).padStart(2, '0');
    endInput.value = pEndYear + '-' + String(pEndMonth).padStart(2, '0') + '-' + String(pEndDay).padStart(2, '0');
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

// Generate array of YYYY-MM-DD dates between start and end inclusive
function generateDateRangeArray(startDate, endDate) {
  var dates = [];
  var cur = new Date(startDate + 'T00:00:00');
  var end = new Date(endDate + 'T00:00:00');
  while (cur <= end) {
    dates.push(formatLocalYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function getLeaveTypeName(type) {
  if (!type) return 'ลางาน';
  var t = String(type).trim().toUpperCase();
  if (t === 'BUSINESS' || t.indexOf('กิจ') !== -1) return 'ลากิจ';
  if (t === 'SICK' || t.indexOf('ป่วย') !== -1) return 'ลาป่วย';
  if (t === 'ANNUAL' || t === 'VACATION' || t.indexOf('พักร้อน') !== -1) return 'ลาพักร้อน';
  if (t === 'MATERNITY' || t.indexOf('คลอด') !== -1) return 'ลาคลอด';
  if (t === 'WITHOUT_PAY' || t.indexOf('ไม่รับค่าจ้าง') !== -1) return 'ลาไม่รับค่าจ้าง';
  if (t === 'MILITARY' || t.indexOf('ทหาร') !== -1) return 'ลาเกณฑ์ทหาร';
  if (t === 'ORDINATION' || t.indexOf('บวช') !== -1) return 'ลาอุปสมบท';
  return String(type);
}

function getLeaveSlotLabel(slot) {
  var s = String(slot || '').trim().toUpperCase();
  if (s === 'MORNING' || s === 'FIRST_HALF') return ' (ครึ่งเช้า)';
  if (s === 'AFTERNOON' || s === 'SECOND_HALF') return ' (ครึ่งบ่าย)';
  return ' (เต็มวัน)';
}

// Build Classic Time Card HTML for a single employee sheet
function generateSingleTimeCardSheetHtml(emp, dateList, logsMap, periodText, pageNum, totalPages, holidayMap, empLeaves, empAdvances) {
  var thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  var daysWorked = 0;
  var totalWorkHours = 0;
  var totalOtHours = 0;
  var lateCount = 0;
  var totalLateMinutes = 0;
  var leaveCount = 0;
  var absentCount = 0;
  var holidayCount = 0;
  empLeaves = empLeaves || [];
  empAdvances = empAdvances || [];

  // Map advances by date and calculate total
  var dateAdvancesMap = {};
  var totalAdvanceAmount = 0;
  empAdvances.forEach(function(ad) {
    var reqD = String(ad.request_date || '').trim().substring(0, 10);
    if (!dateAdvancesMap[reqD]) dateAdvancesMap[reqD] = [];
    dateAdvancesMap[reqD].push(ad);
    totalAdvanceAmount += (Number(ad.amount) || 0);
  });

  holidayMap = holidayMap || {};
  if (Object.keys(holidayMap).length === 0 && Array.isArray(State.companyHolidays)) {
    State.companyHolidays.forEach(function(h) {
      if (h && h.date && dateList.indexOf(h.date) >= 0) {
        holidayMap[h.date] = h;
      }
    });
  }

  var rowsHtml = '';
  dateList.forEach(function(dStr, idx) {
    var dObj = new Date(dStr + 'T00:00:00');
    var dayIdx = dObj.getDay();
    var dayName = isNaN(dayIdx) ? '' : thaiDays[dayIdx];
    var isSunday = dayIdx === 0;

    var parts = dStr.split('-');
    var beYear = parseInt(parts[0], 10) + 543;
    var dateDisplay = parts[2] + '/' + parts[1] + '/' + beYear;

    var hInfo = holidayMap[dStr];
    var isHoliday = !!hInfo;
    var holidayName = isHoliday ? (hInfo.holiday_name || hInfo.name || 'วันหยุดบริษัท') : '';
    var holidayTypeLabel = isHoliday ? (hInfo.holiday_type === 'SPECIAL' ? 'วันหยุดพิเศษ' : 'วันหยุดประเพณี') : '';
    if (isHoliday) {
      holidayCount++;
    }

    // Match approved advance for this date
    var dayAdvances = dateAdvancesMap[dStr] || [];

    // Match approved leave for this date
    var matchingLeave = null;
    for (var lvi = 0; lvi < empLeaves.length; lvi++) {
      var lr = empLeaves[lvi];
      var sDate = String(lr.start_date || '').trim().substring(0, 10);
      var eDate = String(lr.end_date || '').trim().substring(0, 10);
      if (sDate && eDate && dStr >= sDate && dStr <= eDate) {
        var st = String(lr.status || 'APPROVED').toUpperCase();
        if (st === 'APPROVED' || st === 'อนุมัติ' || st === 'AUTO_APPROVED') {
          matchingLeave = lr;
          break;
        }
      }
    }

    var l = logsMap[dStr];
    if (l) {
      if (l.clock_in) daysWorked++;
      var wH = Number(l.work_hours) || 0;
      totalWorkHours += wH;
      var otH = Number(l.ot_hours) || 0;
      totalOtHours += otH;
      var lateM = Number(l.late_minutes) || 0;
      if (lateM > 0) {
        lateCount++;
        totalLateMinutes += lateM;
      }

      var in1 = l.clock_in ? l.clock_in.substring(0, 5) : '-';
      var out1 = l.break_out ? l.break_out.substring(0, 5) : '-';
      var in2 = l.break_in ? l.break_in.substring(0, 5) : '-';
      var out2 = l.clock_out ? l.clock_out.substring(0, 5) : '-';

      var otStart = (otH > 0 && l.ot_start) ? l.ot_start.substring(0, 5) : (otH > 0 ? 'OT' : '-');
      var otEnd = (otH > 0 && l.ot_end) ? l.ot_end.substring(0, 5) : (otH > 0 ? (otH + ' ชม.') : '-');

      var notes = [];
      if (matchingLeave) {
        var lvTypeName = getLeaveTypeName(matchingLeave.leave_type);
        var lvSlotName = getLeaveSlotLabel(matchingLeave.time_slot);
        var lvVal = (matchingLeave.time_slot === 'MORNING' || matchingLeave.time_slot === 'AFTERNOON') ? 0.5 : 1;
        leaveCount += lvVal;
        var reasonText = matchingLeave.reason ? (' • ' + matchingLeave.reason) : '';
        notes.push('📝 ' + lvTypeName + lvSlotName + reasonText);
      }
      if (dayAdvances.length > 0) {
        dayAdvances.forEach(function(ad) {
          var amt = Number(ad.amount) || 0;
          notes.push('💵 เบิกเงินล่วงหน้า ' + amt.toLocaleString() + ' บ.');
        });
      }
      if (isHoliday) {
        notes.push('⭐ ทำงานวันหยุด (' + holidayName + ')');
      }
      if (otH > 0) notes.push('OT ' + otH + ' ชม.');
      if (lateM > 0) notes.push('สาย ' + lateM + ' น.');
      if (l.is_full_pay === 1 || l.is_full_pay === '1') notes.push('จ่ายเต็มวัน');
      if (l.status === 'GEOFENCE_FAIL') notes.push('นอกพิกัด');
      if (l.remark) notes.push(l.remark);

      var lateCellStyle = lateM > 0 ? 'color:#b91c1c;font-weight:700;background:#fee2e2;' : 'color:#64748b;';
      var in1Color = lateM > 0 ? '#dc2626' : '#1d4ed8';
      var rowBg = isHoliday ? 'background:#fef3c7;' : (matchingLeave ? 'background:#f5f3ff;' : (dayAdvances.length > 0 ? 'background:#fef9c3;border-left:3px solid #eab308;' : (isSunday ? 'background:#fff1f2;' : (idx % 2 === 1 ? 'background:#faf5ea;' : ''))));

      rowsHtml += '<tr style="height:20px;' + rowBg + '">' +
        '<td>' + (idx + 1) + '</td>' +
        '<td class="font-digital">' + dateDisplay + '</td>' +
        '<td style="' + (isSunday ? 'color:#b91c1c;font-weight:700;' : (isHoliday ? 'color:#b45309;font-weight:700;' : (matchingLeave ? 'color:#6d28d9;font-weight:700;' : (dayAdvances.length > 0 ? 'color:#854d0e;font-weight:700;' : '')))) + '">' + dayName + '</td>' +
        '<td class="font-digital" style="font-weight:700;color:' + in1Color + '">' + in1 + '</td>' +
        '<td class="font-digital" style="color:#475569">' + out1 + '</td>' +
        '<td class="font-digital" style="color:#475569">' + in2 + '</td>' +
        '<td class="font-digital" style="font-weight:700;color:#991b1b">' + out2 + '</td>' +
        '<td class="font-digital" style="color:#78350f">' + otStart + '</td>' +
        '<td class="font-digital" style="color:#78350f">' + otEnd + '</td>' +
        '<td style="font-weight:700">' + (wH > 0 ? wH.toFixed(1) : '-') + '</td>' +
        '<td style="' + lateCellStyle + '">' + (lateM > 0 ? lateM : '-') + '</td>' +
        '<td style="text-align:left;padding-left:6px;font-size:9.5px;color:' + (isHoliday ? '#b45309;font-weight:700;' : (matchingLeave ? '#6d28d9;font-weight:700;' : (dayAdvances.length > 0 ? '#854d0e;font-weight:700;' : '#78350f;'))) + '">' + (notes.join(', ') || 'ปกติ') + '</td>' +
      '</tr>';
    } else {
      // Empty day row (No clock-in)
      if (matchingLeave) {
        // Approved Leave Day Row
        var lvTypeName = getLeaveTypeName(matchingLeave.leave_type);
        var lvSlotName = getLeaveSlotLabel(matchingLeave.time_slot);
        var lvVal = (matchingLeave.time_slot === 'MORNING' || matchingLeave.time_slot === 'AFTERNOON') ? 0.5 : 1;
        leaveCount += lvVal;
        var reasonText = matchingLeave.reason ? (' • ' + matchingLeave.reason) : '';
        var leaveFullText = '📝 ' + lvTypeName + lvSlotName + reasonText;
        if (dayAdvances.length > 0) {
          var advT = dayAdvances.map(function(ad) { return '💵 เบิกเงิน ' + (Number(ad.amount) || 0).toLocaleString() + ' บ.'; }).join(', ');
          leaveFullText += ' • ' + advT;
        }

        rowsHtml += '<tr style="height:20px;background:#f5f3ff;border-left:3px solid #8b5cf6;">' +
          '<td>' + (idx + 1) + '</td>' +
          '<td class="font-digital" style="font-weight:700;color:#5b21b6;">' + dateDisplay + '</td>' +
          '<td style="color:#6d28d9;font-weight:700;">' + dayName + '</td>' +
          '<td colspan="6" style="color:#6d28d9;font-weight:700;font-size:9.5px;text-align:center;">' +
            leaveFullText +
          '</td>' +
          '<td>-</td>' +
          '<td>-</td>' +
          '<td style="text-align:left;padding-left:6px;color:#6d28d9;font-weight:700;font-size:9.5px;">' + lvTypeName + '</td>' +
        '</tr>';
      } else if (dayAdvances.length > 0) {
        // Day with Advance Request without clock-in
        var advListText = dayAdvances.map(function(ad) { return '💵 เบิกเงินล่วงหน้า ' + (Number(ad.amount) || 0).toLocaleString() + ' บ. (อนุมัติแล้ว)'; }).join(', ');
        rowsHtml += '<tr style="height:20px;background:#fef9c3;border-left:3px solid #eab308;">' +
          '<td>' + (idx + 1) + '</td>' +
          '<td class="font-digital" style="font-weight:700;color:#854d0e;">' + dateDisplay + '</td>' +
          '<td style="color:#854d0e;font-weight:700;">' + dayName + '</td>' +
          '<td colspan="6" style="color:#854d0e;font-weight:700;font-size:9.5px;text-align:center;">' +
            advListText +
          '</td>' +
          '<td>-</td>' +
          '<td>-</td>' +
          '<td style="text-align:left;padding-left:6px;color:#854d0e;font-weight:700;font-size:9.5px;">เบิกเงินล่วงหน้า</td>' +
        '</tr>';
      } else if (isHoliday) {
        // Special / Company Holiday Row
        rowsHtml += '<tr style="height:20px;background:#fef3c7;border-left:3px solid #f59e0b;">' +
          '<td>' + (idx + 1) + '</td>' +
          '<td class="font-digital" style="font-weight:700;color:#92400e;">' + dateDisplay + '</td>' +
          '<td style="color:#b45309;font-weight:700;">' + dayName + '</td>' +
          '<td colspan="6" style="color:#b45309;font-weight:700;letter-spacing:0.5px;font-size:9.5px;text-align:center;">' +
            '⭐ วันหยุด: ' + holidayName + (holidayTypeLabel ? ' (' + holidayTypeLabel + ')' : '') +
          '</td>' +
          '<td>-</td>' +
          '<td>-</td>' +
          '<td style="text-align:left;padding-left:6px;color:#b45309;font-weight:700;font-size:9.5px;">' + (holidayTypeLabel || 'วันหยุดบริษัท') + '</td>' +
        '</tr>';
      } else if (isSunday) {
        rowsHtml += '<tr style="height:20px;background:#fee2e2;">' +
          '<td>' + (idx + 1) + '</td>' +
          '<td class="font-digital">' + dateDisplay + '</td>' +
          '<td style="color:#b91c1c;font-weight:700;">' + dayName + '</td>' +
          '<td colspan="6" style="color:#991b1b;font-weight:700;letter-spacing:1px;font-size:9.5px">-- วันหยุดประจำสัปดาห์ (WEEKLY OFF) --</td>' +
          '<td>-</td>' +
          '<td>-</td>' +
          '<td style="text-align:left;padding-left:6px;color:#991b1b;font-size:9.5px">วันหยุด</td>' +
        '</tr>';
      } else {
        var nowBkk = new Date(Date.now() + 7 * 3600 * 1000);
        var todayIso = nowBkk.toISOString().substring(0, 10);
        var joinD = emp ? String(emp.joinDate || emp.join_date || '').substring(0, 10) : '';
        var resignD = emp ? String(emp.resignDate || emp.resign_date || '').substring(0, 10) : '';
        var isBeforeJoin = joinD && dStr < joinD;
        var isAfterResign = resignD && dStr > resignD;

        if (dStr < todayIso && !isBeforeJoin && !isAfterResign) {
          absentCount++;
          rowsHtml += '<tr style="height:20px;background:#fef2f2;border-left:3px solid #ef4444;">' +
            '<td>' + (idx + 1) + '</td>' +
            '<td class="font-digital" style="font-weight:700;color:#dc2626;">' + dateDisplay + '</td>' +
            '<td style="color:#b91c1c;font-weight:700;">' + dayName + '</td>' +
            '<td colspan="6" style="color:#dc2626;font-weight:700;letter-spacing:0.5px;font-size:9.5px;text-align:center;">' +
              '🔴 ขาดงาน (ไม่มีบันทึกเวลาทำงาน)' +
            '</td>' +
            '<td style="color:#dc2626;font-weight:700;">-</td>' +
            '<td style="color:#dc2626;font-weight:700;">-</td>' +
            '<td style="text-align:left;padding-left:6px;color:#dc2626;font-weight:700;font-size:9.5px;">🔴 ขาดงาน</td>' +
          '</tr>';
        } else {
          rowsHtml += '<tr style="height:20px;' + (idx % 2 === 1 ? 'background:#faf5ea;' : '') + '">' +
            '<td>' + (idx + 1) + '</td>' +
            '<td class="font-digital">' + dateDisplay + '</td>' +
            '<td>' + dayName + '</td>' +
            '<td colspan="6" style="color:#94a3b8;font-size:9.5px">-</td>' +
            '<td>-</td>' +
            '<td>-</td>' +
            '<td style="text-align:left;padding-left:6px;color:#94a3b8;font-size:9.5px">-</td>' +
          '</tr>';
        }
      }
    }
  });

  var compName = (State.company && State.company.companyName) || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  var compTax = (State.company && State.company.taxId) || '0105559876543';
  var empCode = getEmpId(emp);
  var empFullName = getEmpFullName(emp) + (getEmpNickname(emp) ? ' (' + getEmpNickname(emp) + ')' : '');
  var empPos = getEmpPosition(emp) + ' / ' + getEmpDepartment(emp);
  var empBranch = getEmpBranchName(emp);

  var now = new Date();
  var thaiMonthList = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var printTimeStr = now.getDate() + ' ' + thaiMonthList[now.getMonth()] + ' ' + (now.getFullYear() + 543) + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ' น.';

  return '<div class="timecard-sheet">' +
    '<!-- Header -->' +
    '<div style="border-bottom: 2px solid #78350f; padding-bottom: 6px; margin-bottom: 8px;">' +
      '<div style="display: flex; justify-content: space-between; align-items: flex-start;">' +
        '<div style="display: flex; align-items: center; gap: 10px;">' +
          '<div style="width: 44px; height: 44px; border-radius: 8px; background: #78350f; color: #fef08a; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; border: 1.5px solid #92400e;">PTN</div>' +
          '<div>' +
            '<div style="font-size: 14.5px; font-weight: 800; color: #451a03; text-transform: uppercase;">' + compName + '</div>' +
            '<div style="font-size: 10px; color: #78350f;">PTN PHARMA CENTER CO., LTD. &bull; เลขประจำตัวผู้เสียภาษี: ' + compTax + '</div>' +
            '<div style="font-size: 12px; font-weight: 700; color: #78350f; margin-top: 1px;">บัตรบันทึกเวลาทำงาน (TIME CARD) &bull; ประจำงวดตัดวิก</div>' +
          '</div>' +
        '</div>' +
        '<div style="text-align: right; border: 1px solid #92400e; background: #fefce8; border-radius: 6px; padding: 4px 10px; font-size: 11px; color: #451a03;">' +
          '<div style="font-weight: 800; color: #78350f; font-size: 12px;">รอบงวด: ' + periodText + '</div>' +
          '<div style="font-size: 9.5px; color: #92400e; margin-top: 2px;">พนักงานคนที่ ' + pageNum + ' จากทั้งหมด ' + totalPages + ' คน</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<!-- Employee Info Banner -->' +
    '<div style="display: grid; grid-template-columns: 1.2fr 2fr 2fr 1.8fr; gap: 6px; margin-bottom: 8px; background: #fef3c7; border: 1px solid #d97706; padding: 5px 8px; border-radius: 4px; font-size: 11px; color: #451a03;">' +
      '<div><span style="font-size: 9.5px; color: #92400e; display: block; font-weight: 600;">รหัสพนักงาน:</span><span class="font-digital" style="font-weight: 800; font-size: 12.5px;">' + empCode + '</span></div>' +
      '<div><span style="font-size: 9.5px; color: #92400e; display: block; font-weight: 600;">ชื่อ - นามสกุล:</span><span style="font-weight: 800; font-size: 12px;">' + empFullName + '</span></div>' +
      '<div><span style="font-size: 9.5px; color: #92400e; display: block; font-weight: 600;">ตำแหน่ง / แผนก:</span><span style="font-weight: 700; font-size: 11px;">' + empPos + '</span></div>' +
      '<div><span style="font-size: 9.5px; color: #92400e; display: block; font-weight: 600;">สาขาประจำ:</span><span style="font-weight: 700; font-size: 11px;">' + empBranch + '</span></div>' +
    '</div>' +

    '<!-- Table -->' +
    '<table>' +
      '<thead>' +
        '<tr>' +
          '<th rowspan="2" style="width: 26px;">ลำดับ</th>' +
          '<th rowspan="2" style="width: 68px;">วันที่</th>' +
          '<th rowspan="2" style="width: 44px;">วัน</th>' +
          '<th colspan="2" style="background: #fef3c7;">กะเช้า (MORNING)</th>' +
          '<th colspan="2" style="background: #fef3c7;">กะบ่าย (AFTERNOON)</th>' +
          '<th colspan="2" style="background: #fef3c7;">ล่วงเวลา (OT)</th>' +
          '<th rowspan="2" style="width: 44px;">รวม ชม.</th>' +
          '<th rowspan="2" style="width: 40px;">สาย (น.)</th>' +
          '<th rowspan="2">หมายเหตุ / การลา / รายการเงินเบิก</th>' +
        '</tr>' +
        '<tr>' +
          '<th style="width: 42px; color: #1e3a8a;">เข้า 1</th>' +
          '<th style="width: 42px; color: #475569;">ออก 1</th>' +
          '<th style="width: 42px; color: #475569;">เข้า 2</th>' +
          '<th style="width: 42px; color: #991b1b;">ออก 2</th>' +
          '<th style="width: 42px; color: #78350f;">เริ่ม</th>' +
          '<th style="width: 42px; color: #78350f;">สิ้นสุด</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' +
        rowsHtml +
      '</tbody>' +
    '</table>' +

    '<!-- Summary 7 Box -->' +
    '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-top: 6px; border: 1.5px solid #92400e; background: #fefce8; padding: 5px; text-align: center; font-size: 11px;">' +
      '<div><div style="font-size: 9px; color: #92400e; font-weight: 700;">วันทำงานจริง</div><div style="font-size: 12.5px; font-weight: 800; color: #166534;">' + daysWorked + ' วัน</div></div>' +
      '<div><div style="font-size: 9px; color: #92400e; font-weight: 700;">วันลาที่อนุมัติ</div><div style="font-size: 12.5px; font-weight: 800; color: #6d28d9;">' + leaveCount + ' วัน</div></div>' +
      '<div><div style="font-size: 9px; color: #92400e; font-weight: 700;">ขาดงาน</div><div style="font-size: 12.5px; font-weight: 800; color: ' + (absentCount > 0 ? '#dc2626;' : '#64748b;') + '">' + absentCount + ' วัน</div></div>' +
      '<div><div style="font-size: 9px; color: #92400e; font-weight: 700;">ชม. งานปกติ</div><div style="font-size: 12.5px; font-weight: 800; color: #1e40af;">' + totalWorkHours.toFixed(1) + ' ชม.</div></div>' +
      '<div><div style="font-size: 9px; color: #92400e; font-weight: 700;">รวมล่วงเวลา (OT)</div><div style="font-size: 12.5px; font-weight: 800; color: #78350f;">' + totalOtHours.toFixed(1) + ' ชม.</div></div>' +
      '<div><div style="font-size: 9px; color: #92400e; font-weight: 700;">มาสายรวม</div><div style="font-size: 12.5px; font-weight: 800; color: #b91c1c;">' + lateCount + ' ครั้ง (' + totalLateMinutes + ' น.)</div></div>' +
      '<div><div style="font-size: 9px; color: #92400e; font-weight: 700;">วันหยุดบริษัท</div><div style="font-size: 12.5px; font-weight: 800; color: #b45309;">' + holidayCount + ' วัน</div></div>' +
    '</div>' +

    '<!-- Advance Payment Summary Banner -->' +
    (totalAdvanceAmount > 0 ? (
      '<div style="margin-top: 6px; border: 1.5px solid #eab308; background: #fffbeb; border-radius: 4px; padding: 5px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">' +
        '<div style="display: flex; align-items: center; gap: 8px;">' +
          '<span style="background: #eab308; color: #713f12; width: 22px; height: 22px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px;">฿</span>' +
          '<div>' +
            '<strong style="color: #854d0e; font-size: 11.5px;">รายการเบิกเงินล่วงหน้างวดนี้ (Advance Payment):</strong>' +
            '<span style="color: #713f12; margin-left: 6px;">' +
              empAdvances.map(function(ad) {
                var d = String(ad.request_date || '').substring(0, 10);
                var parts = d.split('-');
                var thD = parts.length === 3 ? (parts[2] + '/' + parts[1] + '/' + (parseInt(parts[0], 10) + 543)) : d;
                return (thD ? ('วันที่ ' + thD + ' ') : '') + (Number(ad.amount) || 0).toLocaleString() + '฿';
              }).join(', ') +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div style="text-align: right;">' +
          '<span style="font-size: 10px; color: #854d0e;">ยอดเบิกรวม:</span>' +
          '<strong class="font-digital" style="font-size: 13.5px; color: #b45309; margin-left: 4px;">฿ ' + totalAdvanceAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '</strong>' +
          '<span style="font-size: 9px; color: #a16207; display: block;">(หักในสลิปเงินเดือนงวดนี้)</span>' +
        '</div>' +
      '</div>'
    ) : '') +

    '<!-- Signatures -->' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 14px; text-align: center; font-size: 11px; color: #451a03;">' +
      '<div>' +
        '<div style="border-bottom: 1px dotted #92400e; width: 80%; margin: 25px auto 4px;"></div>' +
        '<div style="font-weight: 700;">ลายมือชื่อพนักงาน</div>' +
        '<div style="font-size: 10px; color: #78350f;">( ' + (getEmpFullName(emp) || '..............................') + ' )</div>' +
        '<div style="font-size: 9.5px; color: #92400e;">วันที่ ...../...../..........</div>' +
        (totalAdvanceAmount > 0 ? ('<div style="font-size: 8.5px; color: #b45309; margin-top: 2px;">*รับทราบเวลาทำงานและยอดหักเบิกเงิน ' + totalAdvanceAmount.toLocaleString() + '฿*</div>') : '') +
      '</div>' +
      '<div>' +
        '<div style="border-bottom: 1px dotted #92400e; width: 80%; margin: 25px auto 4px;"></div>' +
        '<div style="font-weight: 700;">ผู้ตรวจสอบ (หัวหน้างาน)</div>' +
        '<div style="font-size: 10px; color: #78350f;">( .................................................... )</div>' +
        '<div style="font-size: 9.5px; color: #92400e;">วันที่ ...../...../..........</div>' +
      '</div>' +
      '<div>' +
        '<div style="border-bottom: 1px dotted #92400e; width: 80%; margin: 25px auto 4px;"></div>' +
        '<div style="font-weight: 700;">ผู้อนุมัติ (ผู้จัดการ / HR)</div>' +
        '<div style="font-size: 10px; color: #78350f;">( .................................................... )</div>' +
        '<div style="font-size: 9.5px; color: #92400e;">วันที่ ...../...../..........</div>' +
      '</div>' +
    '</div>' +

    '<!-- Footer Micro Text -->' +
    '<div style="margin-top: 14px; display: flex; justify-content: space-between; font-size: 9px; color: #92400e; border-top: 1px solid #d97706; padding-top: 3px;">' +
      '<span>PTN Payroll System &bull; Electronic Time Card Sheet (A4 Portrait)</span>' +
      '<span>พิมพ์เมื่อ: ' + printTimeStr + ' &bull; หน้า ' + pageNum + ' / ' + totalPages + '</span>' +
    '</div>' +
  '</div>';
}

// 1. Submit Print Time Cards (A4 Portrait, 1 Sheet per Employee)
function submitPrintTimeCards() {
  var startDate = document.getElementById('expAttStartDate').value;
  var endDate = document.getElementById('expAttEndDate').value;
  var branchId = document.getElementById('expAttBranch').value;
  var empId = document.getElementById('expAttEmployee').value;
  var btn = document.getElementById('btnSubmitPrintTimeCards');

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
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเตรียมข้อมูล...';
  }

  showToast('กำลังดึงข้อมูลและสร้างบัตรตอกลงเวลา A4...', 'info');

  callApi('getAttendanceLogsRange', {
    startDate: startDate,
    endDate: endDate,
    branchId: branchId,
    empId: empId,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-print text-amber-300"></i> พิมพ์บัตรตอก / บันทึก PDF (A4)';
      }

      if (!r || !r.success) {
        showToast(r && r.message ? r.message : 'เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
        return;
      }

      var logs = r.logs || [];
      var holidays = (r.holidays && Array.isArray(r.holidays) && r.holidays.length > 0) ? r.holidays : (State.companyHolidays || []);
      if (r.holidays && Array.isArray(r.holidays)) {
        State.companyHolidays = r.holidays;
      }
      var holidayMap = {};
      holidays.forEach(function(h) {
        if (h && h.date && h.date >= startDate && h.date <= endDate) holidayMap[h.date] = h;
      });

      var dateList = generateDateRangeArray(startDate, endDate);

      // Group logs by emp_id
      var empLogsMap = {};
      logs.forEach(function(l) {
        var key = String(l.emp_id || '').trim();
        if (!empLogsMap[key]) empLogsMap[key] = {};
        empLogsMap[key][l.date] = l;
      });

      // Filter employees to print
      var employeesToPrint = [];
      var allEmps = State.employees || [];
      if (empId && empId !== 'ALL') {
        var found = allEmps.find(function(e) { return getEmpId(e) === empId; });
        if (found) {
          employeesToPrint.push(found);
        } else if (logs.length > 0) {
          var matchedLog = logs.find(function(l) { return String(l.emp_id || '').trim() === empId; }) || logs[0];
          employeesToPrint.push({
            empId: empId,
            fullName: matchedLog.full_name || empId,
            nickname: matchedLog.nickname || '',
            department: matchedLog.department || '',
            position: matchedLog.position || '',
            branchId: matchedLog.emp_branch_id || matchedLog.branch_id || branchId
          });
        }
      } else {
        if (branchId && branchId !== 'ALL') {
          employeesToPrint = allEmps.filter(function(e) {
            var st = String(e.status || 'Active').toUpperCase();
            var id = getEmpId(e);
            var isResigned = (st === 'RESIGNED' || e.is_active === 0);
            if (getEmpBranchId(e) !== branchId) return false;
            return !isResigned || (empLogsMap[id] && Object.keys(empLogsMap[id]).length > 0);
          });
        } else {
          employeesToPrint = allEmps.filter(function(e) {
            var st = String(e.status || 'Active').toUpperCase();
            var id = getEmpId(e);
            var isResigned = (st === 'RESIGNED' || e.is_active === 0);
            return !isResigned || (empLogsMap[id] && Object.keys(empLogsMap[id]).length > 0);
          });
        }
      }

      if (employeesToPrint.length === 0) {
        // Fallback to employee IDs found in logs
        var uniqueEmpIds = Object.keys(empLogsMap);
        uniqueEmpIds.forEach(function(eId) {
          var sampleLog = Object.values(empLogsMap[eId])[0] || {};
          employeesToPrint.push({
            empId: eId,
            fullName: sampleLog.full_name || eId,
            nickname: sampleLog.nickname || '',
            department: sampleLog.department || '',
            position: sampleLog.position || '',
            branchId: sampleLog.emp_branch_id || sampleLog.branch_id || ''
          });
        });
      }

      if (employeesToPrint.length === 0) {
        showToast('ไม่พบข้อมูลพนักงานสำหรับพิมพ์บัตรตอก', 'warning');
        return;
      }

      var periodText = startDate + ' ถึง ' + endDate;
      var leaves = r.leaves || [];
      var empLeavesMap = {};
      leaves.forEach(function(lv) {
        var key = String(lv.emp_id || '').trim();
        if (!empLeavesMap[key]) empLeavesMap[key] = [];
        empLeavesMap[key].push(lv);
      });

      var advances = r.advances || [];
      var empAdvancesMap = {};
      advances.forEach(function(ad) {
        var key = String(ad.emp_id || '').trim();
        if (!empAdvancesMap[key]) empAdvancesMap[key] = [];
        empAdvancesMap[key].push(ad);
      });

      var sheetsHtml = '';
      employeesToPrint.forEach(function(emp, i) {
        var eId = getEmpId(emp);
        var eMap = empLogsMap[eId] || {};
        var eLeaves = empLeavesMap[eId] || [];
        var eAdvances = empAdvancesMap[eId] || [];
        sheetsHtml += generateSingleTimeCardSheetHtml(emp, dateList, eMap, periodText, i + 1, employeesToPrint.length, holidayMap, eLeaves, eAdvances);
      });

      var printDocHtml = '<!DOCTYPE html>' +
        '<html lang="th"><head><meta charset="utf-8">' +
        '<title>บัตรตอกลงเวลา (Time Card) - ' + (employeesToPrint.length === 1 ? (getEmpFullName(employeesToPrint[0]) || getEmpId(employeesToPrint[0])) : (employeesToPrint.length + ' คน')) + '</title>' +
        '<style>' +
          '@import url("https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&family=Chivo+Mono:wght@500;700&display=swap");' +
          '@page { size: A4 portrait; margin: 8mm 10mm; }' +
          '* { box-sizing: border-box; }' +
          'body { font-family: "Sarabun", "Segoe UI", Arial, sans-serif; margin: 0; padding: 0; background: #e2e8f0; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
          '.no-print { position: sticky; top: 0; z-index: 9999; background: #1e293b; color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); }' +
          '.print-btn { background: #d97706; color: #fff; font-weight: 800; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; }' +
          '.close-btn { background: #475569; color: #fff; font-weight: 600; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; }' +
          '.timecard-sheet { width: 210mm; min-height: 282mm; margin: 15px auto; padding: 8mm 10mm; background: #faf8f0; border: 2.5px solid #78350f; box-shadow: 0 10px 25px rgba(0,0,0,0.15); position: relative; box-sizing: border-box; }' +
          '.font-digital { font-family: "Chivo Mono", monospace; }' +
          'table { width: 100%; border-collapse: collapse; text-align: center; font-size: 10.5px; border: 1.5px solid #92400e; }' +
          'th, td { border: 1px solid #d97706; padding: 2.5px 2px; }' +
          'th { background: #f5eedb; color: #78350f; font-weight: 700; }' +
          '@media print {' +
            'body { background: #fff; }' +
            '.no-print { display: none !important; }' +
            '.timecard-sheet { margin: 0; border: 2px solid #78350f; box-shadow: none; width: 100%; min-height: 100vh; page-break-after: always; }' +
            '.timecard-sheet:last-child { page-break-after: auto; }' +
          '}' +
        '</style>' +
        '</head><body>' +
        '<div class="no-print">' +
          '<div style="font-size: 13px; font-weight: 700;">' +
            '📇 บัตรตอกลงเวลา (Time Card A4) &bull; ' + employeesToPrint.length + ' คน (' + employeesToPrint.length + ' แผ่น A4)' +
          '</div>' +
          '<div style="display: flex; gap: 8px; align-items: center;">' +
            '<button type="button" class="print-btn" onclick="window.print()">🖨️ สั่งพิมพ์เอกสาร / บันทึก PDF</button>' +
            '<button type="button" class="close-btn" onclick="window.close()">❌ ปิดหน้าต่าง</button>' +
          '</div>' +
        '</div>' +
        sheetsHtml +
        '<script>' +
          'window.onload = function() { setTimeout(function() { window.print(); }, 500); };' +
        '<\/script>' +
        '</body></html>';

      var printWin = window.open('', '_blank');
      if (!printWin) {
        showToast('โปรดอนุญาตให้เปิดหน้าต่าง Pop-up เพื่อพิมพ์เอกสาร', 'warning');
        return;
      }
      printWin.document.open();
      printWin.document.write(printDocHtml);
      printWin.document.close();

      closeModal('modalExportAttendanceRange');
      showToast('เปิดหน้าพิมพ์บัตรตอกสำเร็จ (' + employeesToPrint.length + ' คน)', 'success');
    })
    .catch(function(e) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-print text-amber-300"></i> พิมพ์บัตรตอก / บันทึก PDF (A4)';
      }
      showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    });
}

// 2. Submit Export Time Card Excel (.xls)
function submitExportTimeCardExcel() {
  var startDate = document.getElementById('expAttStartDate').value;
  var endDate = document.getElementById('expAttEndDate').value;
  var branchId = document.getElementById('expAttBranch').value;
  var empId = document.getElementById('expAttEmployee').value;

  if (!startDate || !endDate) {
    showToast('กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด', 'warning');
    return;
  }

  showToast('กำลังสร้างไฟล์ Excel บัตรตอกลงเวลา...', 'info');

  callApi('getAttendanceLogsRange', {
    startDate: startDate,
    endDate: endDate,
    branchId: branchId,
    empId: empId,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (!r || !r.success) {
        showToast(r && r.message ? r.message : 'เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
        return;
      }

      var logs = r.logs || [];
      var holidays = (r.holidays && Array.isArray(r.holidays) && r.holidays.length > 0) ? r.holidays : (State.companyHolidays || []);
      if (r.holidays && Array.isArray(r.holidays)) {
        State.companyHolidays = r.holidays;
      }
      var holidayMap = {};
      holidays.forEach(function(h) {
        if (h && h.date && h.date >= startDate && h.date <= endDate) holidayMap[h.date] = h;
      });

      var dateList = generateDateRangeArray(startDate, endDate);

      var empLogsMap = {};
      logs.forEach(function(l) {
        var key = String(l.emp_id || '').trim();
        if (!empLogsMap[key]) empLogsMap[key] = {};
        empLogsMap[key][l.date] = l;
      });

      var employeesToPrint = [];
      var allEmps = State.employees || [];
      if (empId && empId !== 'ALL') {
        var found = allEmps.find(function(e) { return getEmpId(e) === empId; });
        if (found) {
          employeesToPrint.push(found);
        } else if (logs.length > 0) {
          var matchedLog = logs.find(function(l) { return String(l.emp_id || '').trim() === empId; }) || logs[0];
          employeesToPrint.push({
            empId: empId,
            fullName: matchedLog.full_name || empId,
            nickname: matchedLog.nickname || '',
            department: matchedLog.department || '',
            position: matchedLog.position || '',
            branchId: matchedLog.emp_branch_id || matchedLog.branch_id || branchId
          });
        }
      } else {
        if (branchId && branchId !== 'ALL') {
          employeesToPrint = allEmps.filter(function(e) {
            var st = String(e.status || 'Active').toUpperCase();
            var id = getEmpId(e);
            var isResigned = (st === 'RESIGNED' || e.is_active === 0);
            if (getEmpBranchId(e) !== branchId) return false;
            return !isResigned || (empLogsMap[id] && Object.keys(empLogsMap[id]).length > 0);
          });
        } else {
          employeesToPrint = allEmps.filter(function(e) {
            var st = String(e.status || 'Active').toUpperCase();
            var id = getEmpId(e);
            var isResigned = (st === 'RESIGNED' || e.is_active === 0);
            return !isResigned || (empLogsMap[id] && Object.keys(empLogsMap[id]).length > 0);
          });
        }
      }

      if (employeesToPrint.length === 0) {
        var uniqueEmpIds = Object.keys(empLogsMap);
        uniqueEmpIds.forEach(function(eId) {
          var sampleLog = Object.values(empLogsMap[eId])[0] || {};
          employeesToPrint.push({
            empId: eId,
            fullName: sampleLog.full_name || eId,
            nickname: sampleLog.nickname || '',
            department: sampleLog.department || '',
            position: sampleLog.position || '',
            branchId: sampleLog.emp_branch_id || sampleLog.branch_id || ''
          });
        });
      }

      if (employeesToPrint.length === 0) {
        showToast('ไม่พบข้อมูลพนักงานสำหรับส่งออก Excel', 'warning');
        return;
      }

      var periodText = startDate + ' ถึง ' + endDate;
      var leaves = r.leaves || [];
      var empLeavesMap = {};
      leaves.forEach(function(lv) {
        var key = String(lv.emp_id || '').trim();
        if (!empLeavesMap[key]) empLeavesMap[key] = [];
        empLeavesMap[key].push(lv);
      });

      var advances = r.advances || [];
      var empAdvancesMap = {};
      advances.forEach(function(ad) {
        var key = String(ad.emp_id || '').trim();
        if (!empAdvancesMap[key]) empAdvancesMap[key] = [];
        empAdvancesMap[key].push(ad);
      });

      var sheetsHtml = '';
      employeesToPrint.forEach(function(emp, i) {
        var eId = getEmpId(emp);
        var eLeaves = empLeavesMap[eId] || [];
        var eAdvances = empAdvancesMap[eId] || [];
        sheetsHtml += generateSingleTimeCardSheetHtml(emp, dateList, empLogsMap[eId] || {}, periodText, i + 1, employeesToPrint.length, holidayMap, eLeaves, eAdvances);
        sheetsHtml += '<br><br>';
      });

      var excelDoc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
        '<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">' +
        '<style>' +
          'body { font-family: "Sarabun", Arial, sans-serif; font-size: 11px; }' +
          'table { border-collapse: collapse; width: 100%; }' +
          'th, td { border: 1px solid #d97706; padding: 4px; text-align: center; }' +
          'th { background-color: #f5eedb; color: #78350f; font-weight: bold; }' +
        '</style>' +
        '</head><body>' +
        sheetsHtml +
        '</body></html>';

      var blob = new Blob(['\uFEFF' + excelDoc], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'PTN_TimeCards_' + startDate + '_to_' + endDate + '.xls';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      closeModal('modalExportAttendanceRange');
      showToast('ดาวน์โหลด Excel บัตรตอกลงเวลาสำเร็จ (' + employeesToPrint.length + ' คน)', 'success');
    })
    .catch(function(e) {
      showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    });
}

// 3. Submit Raw CSV Export
function submitExportAttendanceRangeCsv() {
  var startDate = document.getElementById('expAttStartDate').value;
  var endDate = document.getElementById('expAttEndDate').value;
  var branchId = document.getElementById('expAttBranch').value;
  var empId = document.getElementById('expAttEmployee').value;

  if (!startDate || !endDate) {
    showToast('กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด', 'warning');
    return;
  }

  showToast('กำลังดึงข้อมูลลงเวลา...', 'info');

  callApi('getAttendanceLogsRange', {
    startDate: startDate,
    endDate: endDate,
    branchId: branchId,
    empId: empId,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (!r || !r.success) {
        showToast(r && r.message ? r.message : 'เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
        return;
      }

      var logs = r.logs || [];
      if (logs.length === 0) {
        showToast('ไม่พบข้อมูลลงเวลาในช่วงวันที่ ' + startDate + ' ถึง ' + endDate, 'warning');
        return;
      }

      var csv = generateAttendanceCsvString(logs);
      var filename = 'PTN_Attendance_' + startDate + '_to_' + endDate + '.csv';

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
