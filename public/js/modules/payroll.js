/**
 * ==============================================================================
 * PTN Payroll - Payroll Engine, Monthly Inputs & Analytics Module
 * ==============================================================================
 */

// PHASE 2: POST-SYNC DELTA TRACKER & CONFLICT DETECTOR
// ==============================================================================
function captureInputRecordsSnapshot() {
  var snapshot = {};
  (State.inputRecords || []).forEach(function(r) {
    snapshot[r.empId] = {
      baseSalary: Number(r.baseSalary) || 0,
      absentDays: Number(r.absentDays) || 0,
      leaveDays: Number(r.leaveDays) || 0,
      sickLeaveDays: Number(r.sickLeaveDays) || 0,
      unpaidSickLeaveDays: Number(r.unpaidSickLeaveDays) || 0,
      lateMinutes: Number(r.lateMinutes) || 0,
      lateDeduct: Number(r.lateDeduct) || 0,
      otHours: Number(r.otHours) || 0,
      allowance: Number(r.allowance) || 0,
      advanceDeduct: Number(r.advanceDeduct) || 0,
      bonus: Number(r.bonus) || 0,
      otherDeduct: Number(r.otherDeduct) || 0
    };
  });
  return snapshot;
}

function computeSyncDelta(beforeSnapshot) {
  if (!beforeSnapshot) return;
  State.syncDeltaMap = {};
  var changedEmps = 0;

  (State.inputRecords || []).forEach(function(after) {
    var before = beforeSnapshot[after.empId];
    var changedFields = {};
    var isNew = !before;

    var fieldsToCheck = ['absentDays', 'leaveDays', 'sickLeaveDays', 'unpaidSickLeaveDays', 'lateMinutes', 'lateDeduct', 'otHours', 'allowance', 'advanceDeduct'];
    fieldsToCheck.forEach(function(f) {
      var bVal = before ? (Number(before[f]) || 0) : 0;
      var aVal = Number(after[f]) || 0;
      if (Math.abs(bVal - aVal) > 0.001) {
        changedFields[f] = { before: bVal, after: aVal };
      }
    });

    if (isNew || Object.keys(changedFields).length > 0) {
      State.syncDeltaMap[after.empId] = {
        isNew: isNew,
        changedFields: changedFields
      };
      changedEmps++;
    }
  });

  renderSyncDeltaBanners(changedEmps);
  renderInputTable();
  renderPayrollTable();
}

function renderSyncDeltaBanners(count) {
  var pBanner = document.getElementById('payrollSyncDeltaBanner');
  var iBanner = document.getElementById('inputSyncDeltaBanner');
  if (count <= 0) {
    if (pBanner) pBanner.style.display = 'none';
    if (iBanner) iBanner.style.display = 'none';
    return;
  }

  var curOnlyChanged = Boolean(State.filterOnlyChanged);
  var html = '<div class="sync-banner">' +
    '<div style="display:flex;align-items:center;gap:10px">' +
      '<i class="fa-solid fa-circle-check" style="color:#16a34a;font-size:20px"></i>' +
      '<div>' +
        '<div style="font-size:13px;font-weight:700;color:#15803d"><i class="fa-solid fa-bolt"></i> ดึงข้อมูลจาก PTN Time สำเร็จ!</div>' +
        '<div style="font-size:11.5px;color:#166534;margin-top:2px">' +
          'ตรวจพบพนักงานที่มีข้อมูลอัปเดต <strong style="font-size:13px;color:#047857">' + count + ' ท่าน</strong> ' +
          '(มีไฮไลท์สีเขียวที่แถวและเซลล์ที่ตัวเลขเปลี่ยนแปลง)' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:8px">' +
      '<button type="button" class="btn btn-sm" onclick="toggleFilterOnlyChanged()" style="background:' + (curOnlyChanged ? '#047857' : '#16a34a') + ';color:#ffffff;border:none;font-weight:700;font-size:12px;padding:5px 12px;border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,0.1)">' +
        (curOnlyChanged ? '<i class="fa-solid fa-users"></i> แสดงทุกคน' : '<i class="fa-solid fa-filter"></i> กรองดูเฉพาะคนที่อัปเดต (' + count + ')') +
      '</button>' +
      '<button type="button" class="btn btn-slate btn-sm" onclick="clearSyncDeltaHighlight()" style="font-size:12px;padding:5px 10px;border-radius:6px">' +
        '<i class="fa-solid fa-xmark"></i> ซ่อนไฮไลท์' +
      '</button>' +
    '</div>' +
  '</div>';

  if (pBanner) { pBanner.innerHTML = html; pBanner.style.display = 'block'; }
  if (iBanner) { iBanner.innerHTML = html; iBanner.style.display = 'block'; }
}

function clearSyncDeltaHighlight() {
  State.syncDeltaMap = {};
  State.filterOnlyChanged = false;
  var pBanner = document.getElementById('payrollSyncDeltaBanner');
  var iBanner = document.getElementById('inputSyncDeltaBanner');
  if (pBanner) pBanner.style.display = 'none';
  if (iBanner) iBanner.style.display = 'none';
  renderInputTable();
  renderPayrollTable();
}

function toggleFilterOnlyChanged() {
  State.filterOnlyChanged = !State.filterOnlyChanged;
  var count = Object.keys(State.syncDeltaMap || {}).length;
  renderSyncDeltaBanners(count);
  renderInputTable();
  renderPayrollTable();
}

function normalizeDateToIso(str) {
  if (!str) return '';
  var s = String(str).trim();
  var dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    var d = String(dmyMatch[1]).padStart(2, '0');
    var m = String(dmyMatch[2]).padStart(2, '0');
    var y = parseInt(dmyMatch[3], 10);
    if (y > 2400) y -= 543;
    return y + '-' + m + '-' + d;
  }
  var ymdMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    var y = parseInt(ymdMatch[1], 10);
    if (y > 2400) y -= 543;
    var m = String(ymdMatch[2]).padStart(2, '0');
    var d = String(ymdMatch[3]).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  return s.substring(0, 10);
}

// CONFLICT & ANOMALY DETECTOR FOR AN EMPLOYEE ROW
function getEmployeeConflictInfo(empId, record) {
  var badges = [];
  var hasWarning = false;
  var hasDanger = false;

  try {
    var emp = (State.employees || []).find(function(e) { return e.empId === empId; });

    if (emp) {
      var st = emp.status || 'Active';
      var absentDays = record ? Number(record.absentDays || 0) : 0;
      var lateMins = record ? Number(record.lateMinutes || 0) : 0;
      var lateCnt = record ? Number(record.lateCount || 0) : 0;

      // 1. Resigned employee conflict check (similar to EMP032)
      if (st === 'Resigned') {
        if (absentDays > 0) {
          badges.push('<span class="conflict-tag-danger" title="พนักงานมีสถานะลาออก แต่มีวันขาดงานในงวด กรุณาตรวจเช็กวันลาออกจริง"><i class="fa-solid fa-triangle-exclamation"></i> ลาออกแต่มีขาดงาน ' + absentDays + ' วัน</span>');
          hasDanger = true;
        } else {
          var rDate = emp.resignDate || emp.resign_date;
          badges.push('<span class="conflict-tag-warning"><i class="fa-solid fa-user-slash"></i> ลาออกแล้ว' + (rDate && typeof formatDateThaiBE === 'function' ? ' (' + formatDateThaiBE(rDate) + ')' : '') + '</span>');
          hasWarning = true;
        }
      }

      // 2. New hire mid-period check (similar to EMP043)
      var jDateRaw = emp.joinDate || emp.join_date;
      if (jDateRaw) {
        var jDate = normalizeDateToIso(jDateRaw);
        var dates = (typeof getAttendanceCutoffDatesClient === 'function') ? getAttendanceCutoffDatesClient(State.period) : null;
        if (dates && dates.startDate && dates.endDate && jDate >= dates.startDate && jDate <= dates.endDate) {
          badges.push('<span class="conflict-tag-info"><i class="fa-solid fa-seedling"></i> เข้าใหม่กลางงวด (' + (typeof formatDateThaiBE === 'function' ? formatDateThaiBE(jDateRaw) : jDateRaw) + ')</span>');
        }
      }

      // 3. High late arrivals check
      if (lateCnt >= 3 || lateMins >= 60) {
        badges.push('<span class="conflict-tag-danger" title="มาสายสะสมเกินเกณฑ์"><i class="fa-solid fa-clock"></i> สายสะสม ' + lateMins + ' นาที (' + lateCnt + ' ครั้ง)</span>');
        hasDanger = true;
      }
    }
  } catch(err) {
    console.error('getEmployeeConflictInfo error:', err);
  }

  return {
    hasConflict: hasDanger || hasWarning,
    hasDanger: hasDanger,
    hasWarning: hasWarning,
    badgeHtml: badges.join(' ')
  };
}

// ==============================================================================
// MINI KPI DASHBOARD TILES & SMART QUICK-FILTERS (PHASE 2 UX/UI)
// ==============================================================================
function isEmployeeChanges(row, record, emp) {
  var empId = (row && row.empId) || (record && record.empId);
  if (!emp && empId) {
    emp = (State.employees || []).find(function(e) { return e.empId === empId; });
  }
  if (!record && empId) {
    record = (State.inputRecords || []).find(function(i) { return i.empId === empId; });
  }
  if (!row && empId) {
    row = (State.payrollList || []).find(function(p) { return p.empId === empId; });
  }

  var standardDays = State.workingDays > 0 ? State.workingDays : 30;
  if (row && Number(row.workDays) > 0 && Number(row.workDays) < standardDays) return true;
  if (record && Number(record.workDays) > 0 && Number(record.workDays) < standardDays) return true;

  if (emp) {
    var st = (emp.status || '').toLowerCase();
    if (st === 'resigned' || st === 'ลาออก') return true;

    var cutoff = (typeof getAttendanceCutoffDatesClient === 'function') ? getAttendanceCutoffDatesClient(State.period) : null;
    if (cutoff && cutoff.startDate && cutoff.endDate) {
      var jDateRaw = emp.joinDate || emp.join_date;
      if (jDateRaw) {
        var jDate = normalizeDateToIso(jDateRaw);
        if (jDate >= cutoff.startDate && jDate <= cutoff.endDate) return true;
      }
      var rDateRaw = emp.resignDate || emp.resign_date;
      if (rDateRaw) {
        var rDate = normalizeDateToIso(rDateRaw);
        if (rDate >= cutoff.startDate && rDate <= cutoff.endDate) return true;
      }
    }
  }
  return false;
}

function setPayrollQuickFilter(type) {
  if (State.payrollQuickFilter === type && type !== 'ALL') {
    State.payrollQuickFilter = 'ALL';
  } else {
    State.payrollQuickFilter = type;
  }
  renderPayrollTable();
}

function setInputQuickFilter(type) {
  if (State.inputQuickFilter === type && type !== 'ALL') {
    State.inputQuickFilter = 'ALL';
  } else {
    State.inputQuickFilter = type;
  }
  renderInputTable();
}

function updatePayrollKpiDeck(branchList) {
  var countAll = (branchList || []).length;
  var sumNet = 0;
  var countOt = 0;
  var sumOtHours = 0;
  var sumOtPay = 0;
  var countDeduct = 0;
  var sumLeaveDeduct = 0;
  var countAdvance = 0;
  var sumAdvance = 0;
  var countChanges = 0;

  var isEarned = (State.payrollCalcMode === 'EARNED' && (State.isMidPeriod || (branchList[0] && branchList[0].isMidPeriod)));

  (branchList || []).forEach(function(r) {
    var net = (isEarned && r.earnedNetPay !== undefined) ? Number(r.earnedNetPay) : (Number(r.netPay) || 0);
    var otH = Number(r.otHours) || 0;
    var otP = Number(r.otPay) || 0;
    var lDed = Number(r.leaveDeduction) || 0;
    var ltDed = Number(r.lateDeduct) || 0;
    var adv = Number(r.advanceDeduct) || 0;

    sumNet += net;

    if (otH > 0 || otP > 0) {
      countOt++;
      sumOtHours += otH;
      sumOtPay += otP;
    }

    if (lDed > 0 || ltDed > 0 || (Number(r.absentDays) || 0) > 0 || (Number(r.leaveDays) || 0) > 0 || (Number(r.sickLeaveDays) || 0) > 0) {
      countDeduct++;
      sumLeaveDeduct += (lDed + ltDed);
    }

    if (adv > 0) {
      countAdvance++;
      sumAdvance += adv;
    }

    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; });
    if (isEmployeeChanges(r, null, emp)) {
      countChanges++;
    }
  });

  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();

  var elAllCount = document.getElementById('payroll-kpi-all-count');
  var elAllSub = document.getElementById('payroll-kpi-all-sub');
  if (elAllCount) elAllCount.textContent = countAll + ' คน';
  if (elAllSub) elAllSub.textContent = (isEarned ? 'สุทธิสะสมถึงวันนี้ ' : 'ยอดจ่ายสุทธิ ') + (canViewSalary ? fmt(sumNet) : '฿***');

  var elOtCount = document.getElementById('payroll-kpi-ot-count');
  var elOtSub = document.getElementById('payroll-kpi-ot-sub');
  if (elOtCount) elOtCount.textContent = countOt + ' คน';
  if (elOtSub) elOtSub.textContent = 'รวม ' + (Math.round(sumOtHours * 10) / 10) + ' ชม. (' + (canViewSalary ? fmt(sumOtPay) : '฿***') + ')';

  var elDeductCount = document.getElementById('payroll-kpi-deduct-count');
  var elDeductSub = document.getElementById('payroll-kpi-deduct-sub');
  if (elDeductCount) elDeductCount.textContent = countDeduct + ' คน';
  if (elDeductSub) elDeductSub.textContent = 'หักเวลาทำงานรวม ' + (canViewSalary ? fmt(sumLeaveDeduct) : '฿***');

  var elAdvCount = document.getElementById('payroll-kpi-advance-count');
  var elAdvSub = document.getElementById('payroll-kpi-advance-sub');
  if (elAdvCount) elAdvCount.textContent = countAdvance + ' คน';
  if (elAdvSub) elAdvSub.textContent = 'ยอดเบิกทั้งสิ้น ' + (canViewSalary ? fmt(sumAdvance) : '฿***');

  var elChangesCount = document.getElementById('payroll-kpi-changes-count');
  var elChangesSub = document.getElementById('payroll-kpi-changes-sub');
  if (elChangesCount) elChangesCount.textContent = countChanges + ' คน';
  if (elChangesSub) elChangesSub.textContent = 'คิดตามสัดส่วน (Pro-rata)';

  var qFilter = State.payrollQuickFilter || 'ALL';
  ['all', 'ot', 'deduct', 'advance', 'changes'].forEach(function(k) {
    var tile = document.getElementById('payroll-kpi-' + k);
    if (tile) {
      tile.classList.toggle('active', qFilter === k.toUpperCase());
    }
  });
}

function updateInputKpiDeck(branchList) {
  var countAll = (branchList || []).length;
  var sumBaseSal = 0;
  var countOt = 0;
  var sumOtHours = 0;
  var sumOtPay = 0;
  var countDeduct = 0;
  var sumLateMinutes = 0;
  var countAdvance = 0;
  var sumAdvance = 0;
  var countChanges = 0;

  (branchList || []).forEach(function(i) {
    var base = Number(i.baseSalary) || 0;
    var otH = Number(i.otHours) || 0;
    var otR = Number(i.otRate) || 40;
    var otP = otH * otR;
    var absD = Number(i.absentDays) || 0;
    var lvD = Number(i.leaveDays) || 0;
    var skD = Number(i.sickLeaveDays) || 0;
    var unpSkD = Number(i.unpaidSickLeaveDays) || 0;
    var ltM = Number(i.lateMinutes) || 0;
    var ltDed = Number(i.lateDeduct) || 0;
    var adv = Number(i.advanceDeduct) || 0;

    sumBaseSal += base;

    if (otH > 0) {
      countOt++;
      sumOtHours += otH;
      sumOtPay += otP;
    }

    if (absD > 0 || lvD > 0 || skD > 0 || unpSkD > 0 || ltM > 0 || ltDed > 0) {
      countDeduct++;
      sumLateMinutes += ltM;
    }

    if (adv > 0) {
      countAdvance++;
      sumAdvance += adv;
    }

    var emp = (State.employees || []).find(function(e) { return e.empId === i.empId; });
    if (isEmployeeChanges(null, i, emp)) {
      countChanges++;
    }
  });

  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();

  var elAllCount = document.getElementById('input-kpi-all-count');
  var elAllSub = document.getElementById('input-kpi-all-sub');
  if (elAllCount) elAllCount.textContent = countAll + ' คน';
  if (elAllSub) elAllSub.textContent = 'ฐานเงินเดือนรวม ' + (canViewSalary ? fmt(sumBaseSal) : '฿***');

  var elOtCount = document.getElementById('input-kpi-ot-count');
  var elOtSub = document.getElementById('input-kpi-ot-sub');
  if (elOtCount) elOtCount.textContent = countOt + ' คน';
  if (elOtSub) elOtSub.textContent = 'รวม ' + (Math.round(sumOtHours * 10) / 10) + ' ชม. (' + (canViewSalary ? fmt(sumOtPay) : '฿***') + ')';

  var elDeductCount = document.getElementById('input-kpi-deduct-count');
  var elDeductSub = document.getElementById('input-kpi-deduct-sub');
  if (elDeductCount) elDeductCount.textContent = countDeduct + ' คน';
  if (elDeductSub) elDeductSub.textContent = sumLateMinutes > 0 ? ('สายสะสม ' + sumLateMinutes + ' นาที') : 'มีรายการขาด/ลา/สาย';

  var elAdvCount = document.getElementById('input-kpi-advance-count');
  var elAdvSub = document.getElementById('input-kpi-advance-sub');
  if (elAdvCount) elAdvCount.textContent = countAdvance + ' คน';
  if (elAdvSub) elAdvSub.textContent = 'ยอดเบิกทั้งสิ้น ' + (canViewSalary ? fmt(sumAdvance) : '฿***');

  var elChangesCount = document.getElementById('input-kpi-changes-count');
  var elChangesSub = document.getElementById('input-kpi-changes-sub');
  if (elChangesCount) elChangesCount.textContent = countChanges + ' คน';
  if (elChangesSub) elChangesSub.textContent = 'วันทำงานไม่เต็มเดือน';

  var qFilter = State.inputQuickFilter || 'ALL';
  ['all', 'ot', 'deduct', 'advance', 'changes'].forEach(function(k) {
    var tile = document.getElementById('input-kpi-' + k);
    if (tile) {
      tile.classList.toggle('active', qFilter === k.toUpperCase());
    }
  });
}

// ==============================================================================
// BRANCH FILTER CHIPS CONTROLLER (PHASE 1 UX/UI)
// ==============================================================================
function renderPayrollBranchChips() {
  var container = document.getElementById('payrollBranchChips');
  if (!container) return;
  var bList = State.branches || [];
  if (!bList.length) {
    bList = [
      { branch_id: 'B01', branch_name: 'สำนักงานใหญ่' },
      { branch_id: 'B02', branch_name: 'สาขาที่ 2 (หน้าร้าน A)' },
      { branch_id: 'B03', branch_name: 'สาขาที่ 3 (หน้าร้าน B)' },
      { branch_id: 'B04', branch_name: 'สาขาที่ 4 (คลังสินค้า/สำรอง)' }
    ];
  }

  // Count employees in current payrollList per branch
  var counts = { ALL: (State.payrollList || []).length };
  bList.forEach(function(b) { counts[b.branch_id] = 0; });
  (State.payrollList || []).forEach(function(r) {
    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; });
    var bId = emp ? getEmpBranchId(emp) : 'B01';
    if (!counts[bId]) counts[bId] = 0;
    counts[bId]++;
  });

  var cur = State.payrollBranchFilter || 'ALL';
  var html = '<button type="button" class="branch-chip-btn' + (cur === 'ALL' && !State.filterOnlyChanged ? ' active' : '') + '" onclick="filterPayrollBranch(\'ALL\')">' +
    '<span>🏢 ทุกสาขา</span> <span class="badge-count">' + (counts.ALL || 0) + '</span></button>';

  bList.forEach(function(b) {
    var cnt = counts[b.branch_id] || 0;
    html += '<button type="button" class="branch-chip-btn' + (cur === b.branch_id && !State.filterOnlyChanged ? ' active' : '') + '" onclick="filterPayrollBranch(\'' + esc(b.branch_id) + '\')">' +
      '<span>' + esc(b.branch_name) + '</span> <span class="badge-count">' + cnt + '</span></button>';
  });

  var deltaCount = Object.keys(State.syncDeltaMap || {}).length;
  if (deltaCount > 0) {
    html += '<button type="button" class="branch-chip-btn' + (State.filterOnlyChanged ? ' active' : '') + '" style="background:' + (State.filterOnlyChanged ? '#15803d' : '#dcfce7') + ';color:' + (State.filterOnlyChanged ? '#ffffff' : '#166534') + ';border-color:#86efac" onclick="toggleFilterOnlyChanged()">' +
      '<i class="fa-solid fa-bolt"></i> มีข้อมูลเปลี่ยน <span class="badge-count">' + deltaCount + '</span></button>';
  }

  container.innerHTML = html;
}

function filterPayrollBranch(bId) {
  State.payrollBranchFilter = bId;
  State.filterOnlyChanged = false;
  renderPayrollBranchChips();
  renderPayrollTable();
}

function renderInputBranchChips() {
  var container = document.getElementById('inputBranchChips');
  if (!container) return;
  var bList = State.branches || [];
  if (!bList.length) {
    bList = [
      { branch_id: 'B01', branch_name: 'สำนักงานใหญ่' },
      { branch_id: 'B02', branch_name: 'สาขาที่ 2 (หน้าร้าน A)' },
      { branch_id: 'B03', branch_name: 'สาขาที่ 3 (หน้าร้าน B)' },
      { branch_id: 'B04', branch_name: 'สาขาที่ 4 (คลังสินค้า/สำรอง)' }
    ];
  }

  // Count employees in current inputRecords per branch
  var counts = { ALL: (State.inputRecords || []).length };
  bList.forEach(function(b) { counts[b.branch_id] = 0; });
  (State.inputRecords || []).forEach(function(i) {
    var emp = (State.employees || []).find(function(e) { return e.empId === i.empId; });
    var bId = emp ? getEmpBranchId(emp) : 'B01';
    if (!counts[bId]) counts[bId] = 0;
    counts[bId]++;
  });

  var cur = State.inputBranchFilter || 'ALL';
  var html = '<button type="button" class="branch-chip-btn' + (cur === 'ALL' && !State.filterOnlyChanged ? ' active' : '') + '" onclick="filterInputBranch(\'ALL\')">' +
    '<span>🏢 ทุกสาขา</span> <span class="badge-count">' + (counts.ALL || 0) + '</span></button>';

  bList.forEach(function(b) {
    var cnt = counts[b.branch_id] || 0;
    html += '<button type="button" class="branch-chip-btn' + (cur === b.branch_id && !State.filterOnlyChanged ? ' active' : '') + '" onclick="filterInputBranch(\'' + esc(b.branch_id) + '\')">' +
      '<span>' + esc(b.branch_name) + '</span> <span class="badge-count">' + cnt + '</span></button>';
  });

  var deltaCount = Object.keys(State.syncDeltaMap || {}).length;
  if (deltaCount > 0) {
    html += '<button type="button" class="branch-chip-btn' + (State.filterOnlyChanged ? ' active' : '') + '" style="background:' + (State.filterOnlyChanged ? '#15803d' : '#dcfce7') + ';color:' + (State.filterOnlyChanged ? '#ffffff' : '#166534') + ';border-color:#86efac" onclick="toggleFilterOnlyChanged()">' +
      '<i class="fa-solid fa-bolt"></i> มีข้อมูลเปลี่ยน <span class="badge-count">' + deltaCount + '</span></button>';
  }

  container.innerHTML = html;
}

function filterInputBranch(bId) {
  State.inputBranchFilter = bId;
  State.filterOnlyChanged = false;
  renderInputBranchChips();
  renderInputTable();
}

function setPayrollViewMode(mode) {
  State.payrollViewMode = mode;
  try { localStorage.setItem('ptn_payroll_view_mode', mode); } catch(e) {}
  var btnTable = document.getElementById('btnViewTable');
  var btnCards = document.getElementById('btnViewCards');
  if (btnTable) btnTable.classList.toggle('active', mode === 'TABLE');
  if (btnCards) btnCards.classList.toggle('active', mode === 'CARD');
  renderPayrollTable();
}

function setPayrollCalcMode(mode) {
  State.payrollCalcMode = mode;
  try { localStorage.setItem('ptn_payroll_calc_mode', mode); } catch(e) {}
  var btnEarned = document.getElementById('btnPayrollModeEarned');
  var btnFull = document.getElementById('btnPayrollModeFull');
  if (btnEarned) btnEarned.classList.toggle('active', mode === 'EARNED');
  if (btnFull) btnFull.classList.toggle('active', mode === 'FULL');
  renderPayrollTable();
}

// 2. PAYROLL TABLE & CARDS RENDERER (PHASE 3 MULTI-VIEW)
function renderPayrollTable() {
  var tbody = document.getElementById('payrollTableBody');
  var cardsWrapper = document.getElementById('payrollCardsView');
  var tblWrapper = document.getElementById('payrollTableViewWrapper');
  if (!tbody && !cardsWrapper) return;

  renderPayrollBranchChips();

  var mode = State.payrollViewMode || 'TABLE';
  var btnTable = document.getElementById('btnViewTable');
  var btnCards = document.getElementById('btnViewCards');
  if (btnTable) btnTable.classList.toggle('active', mode === 'TABLE');
  if (btnCards) btnCards.classList.toggle('active', mode === 'CARD');

  var calcMode = State.payrollCalcMode || 'EARNED';
  var btnEarned = document.getElementById('btnPayrollModeEarned');
  var btnFull = document.getElementById('btnPayrollModeFull');
  if (btnEarned) btnEarned.classList.toggle('active', calcMode === 'EARNED');
  if (btnFull) btnFull.classList.toggle('active', calcMode === 'FULL');

  var q = (document.getElementById('payrollSearchInput') ? document.getElementById('payrollSearchInput').value : '').trim().toLowerCase();
  var bFilter = State.payrollBranchFilter || 'ALL';

  var branchList = (State.payrollList || []).filter(function(r) {
    if (State.filterOnlyChanged && (!State.syncDeltaMap || !State.syncDeltaMap[r.empId])) return false;
    if (bFilter !== 'ALL') {
      var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; });
      var empBranch = emp ? getEmpBranchId(emp) : 'B01';
      if (empBranch !== bFilter) return false;
    }
    if (!q) return true;
    var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; }) || {};
    var nick = (r.nickname || emp.nickname || getEmpNickname(r.empId) || '').toLowerCase();
    return (r.empId && r.empId.toLowerCase().indexOf(q) >= 0) ||
           (r.name && r.name.toLowerCase().indexOf(q) >= 0) ||
           (nick && nick.indexOf(q) >= 0) ||
           (r.department && r.department.toLowerCase().indexOf(q) >= 0) ||
           (r.position && r.position.toLowerCase().indexOf(q) >= 0);
  });

  updatePayrollKpiDeck(branchList);

  var isMid = Boolean(State.isMidPeriod || (branchList[0] && branchList[0].isMidPeriod));
  var isEarned = (calcMode === 'EARNED' && isMid);

  // Render Mid-Period Earned Wage Preview Banner
  var banner = document.getElementById('payrollMidPeriodBanner');
  if (banner) {
    if (isMid) {
      banner.style.display = 'block';
      var elDays = State.elapsedWorkDays || (branchList[0] && branchList[0].elapsedWorkDays) || 0;
      var totDays = State.workingDays || (branchList[0] && branchList[0].totalWorkDays) || 26;
      var asOfDate = State.asOfDate || (branchList[0] && branchList[0].asOfDate) || '';
      var asOfThai = formatDateThaiBE(asOfDate);
      var pct = totDays > 0 ? Math.round((elDays / totDays) * 100) : 0;

      if (isEarned) {
        banner.className = 'alert alert-info';
        banner.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);border:1.5px solid #bfdbfe;border-radius:10px;padding:10px 14px;margin-bottom:12px;gap:12px;flex-wrap:wrap';
        banner.innerHTML = '<div style="display:flex;align-items:center;gap:10px">' +
          '<div style="width:36px;height:36px;border-radius:8px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0"><i class="fa-solid fa-chart-line"></i></div>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:800;color:#1e40af"><i class="fa-solid fa-bolt" style="color:#d97706"></i> การคำนวณระหว่างงวด: ฐานเงินเดือนสะสมตามวันที่ผ่านมาจริง (Earned Wage to-Date)</div>' +
            '<div style="font-size:11.5px;color:#475569;margin-top:2px">ประเมิน ณ วันที่ <strong>' + esc(asOfThai) + '</strong> • ผ่านไปแล้ว <strong>' + elDays + ' / ' + totDays + ' วันทำงาน</strong> (' + pct + '%) • ฐานเงินเดือนคิดตามสัดส่วนวันทำงานจริงเพื่อให้ตัวเลขสะท้อนความเป็นจริงในแต่ละวัน</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<button type="button" class="btn btn-xs" onclick="setPayrollCalcMode(\'FULL\')" style="background:#ffffff;border:1px solid #cbd5e1;color:#334155;font-weight:700;padding:5px 10px;border-radius:6px;cursor:pointer">' +
            '<i class="fa-solid fa-calendar-check" style="color:#2563eb"></i> ดูยอดคาดการณ์เต็มงวด' +
          '</button>' +
        '</div>';
      } else {
        banner.className = 'alert alert-warning';
        banner.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:12px;gap:12px;flex-wrap:wrap';
        banner.innerHTML = '<div style="display:flex;align-items:center;gap:10px">' +
          '<div style="width:36px;height:36px;border-radius:8px;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0"><i class="fa-solid fa-calendar-check"></i></div>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:800;color:#92400e"><i class="fa-solid fa-file-invoice-dollar"></i> มุมมองคาดการณ์เต็มงวด (Full Period Projection)</div>' +
            '<div style="font-size:11.5px;color:#78350f;margin-top:2px">กำลังแสดงฐานเงินเดือนเต็มเดือนสำหรับเตรียมความพร้อมก่อนปิดงวดบัญชี • สามารถสลับไปดู <strong>"ยอดสะสมจริงถึงวันนี้"</strong> เพื่อดูตัวเลขสะท้อนจริง ณ ปัจจุบัน</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<button type="button" class="btn btn-xs btn-primary" onclick="setPayrollCalcMode(\'EARNED\')" style="font-weight:700;padding:5px 12px;border-radius:6px;cursor:pointer">' +
            '<i class="fa-solid fa-bolt" style="color:#fde68a"></i> สลับเป็นยอดสะสมจริง' +
          '</button>' +
        '</div>';
      }
    } else {
      banner.style.display = 'none';
    }
  }

  // Update table header labels
  var thBase = document.getElementById('thPayrollBaseSalary');
  var thGross = document.getElementById('thPayrollGross');
  var thNet = document.getElementById('thPayrollNet');
  if (isEarned) {
    if (thBase) thBase.innerHTML = 'ฐานสะสม <span style="font-size:10px;color:#d97706;font-weight:700">(Earned)</span>';
    if (thGross) thGross.innerHTML = 'Gross สะสม <span style="font-size:10px;color:#2563eb;font-weight:700">(Earned)</span>';
    if (thNet) thNet.innerHTML = 'สุทธิสะสม (Earned Net)';
  } else {
    if (thBase) thBase.innerHTML = 'เงินเดือนฐาน';
    if (thGross) thGross.innerHTML = 'Gross';
    if (thNet) thNet.innerHTML = 'สุทธิ (Net)';
  }

  var qFilter = State.payrollQuickFilter || 'ALL';
  var list = branchList.filter(function(r) {
    if (qFilter === 'ALL') return true;
    if (qFilter === 'OT') return (Number(r.otHours) || 0) > 0 || (Number(r.otPay) || 0) > 0;
    if (qFilter === 'DEDUCT') return (Number(r.leaveDeduction) || 0) > 0 || (Number(r.lateDeduct) || 0) > 0 || (Number(r.absentDays) || 0) > 0 || (Number(r.leaveDays) || 0) > 0 || (Number(r.sickLeaveDays) || 0) > 0;
    if (qFilter === 'ADVANCE') return (Number(r.advanceDeduct) || 0) > 0;
    if (qFilter === 'CHANGES') {
      var emp = (State.employees || []).find(function(e) { return e.empId === r.empId; });
      return isEmployeeChanges(r, null, emp);
    }
    return true;
  });

  if (mode === 'CARD') {
    if (tblWrapper) tblWrapper.style.display = 'none';
    if (cardsWrapper) {
      cardsWrapper.style.display = 'grid';
      renderPayrollCardsView(list, cardsWrapper, q, bFilter);
    }
    return;
  }

  // TABLE VIEW
  if (tblWrapper) tblWrapper.style.display = 'block';
  if (cardsWrapper) cardsWrapper.style.display = 'none';

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="20" class="text-center text-muted" style="padding:36px">' +
      '<div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:6px"><i class="fa-solid fa-calculator"></i> ' + (q || bFilter !== 'ALL' || State.filterOnlyChanged ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา' : 'ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + esc(State.period)) + '</div>' +
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

    var emp = (State.employees || []).find(function(e) { return e.empId === row.empId; });
    var empNick = (emp && emp.nickname) ? emp.nickname : (row.nickname || getEmpNickname(row.empId));
    var nickHtml = empNick ? (' <span style="font-size:11px;font-weight:700;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:1px 6px;border-radius:4px;white-space:nowrap;margin-left:4px">(' + esc(empNick) + ')</span>') : '';

    var delta = State.syncDeltaMap && State.syncDeltaMap[row.empId];
    var rowClass = 'clickable-row' + (delta ? ' row-delta-updated' : '');
    var conflictInfo = getEmployeeConflictInfo(row.empId, row);
    var conflictHtml = conflictInfo.badgeHtml ? (' ' + conflictInfo.badgeHtml) : '';

    var otDelta = delta && delta.changedFields && delta.changedFields.otHours;
    var otClass = otDelta ? 'text-right font-mono text-blue font-bold cell-delta-updated' : 'text-right font-mono text-blue font-bold';
    var otTag = otDelta ? ' <span class="delta-tag" title="เดิม: ' + otDelta.before + ' -> ใหม่: ' + otDelta.after + '">ใหม่</span>' : '';

    var displayBase = (isEarned && row.earnedBaseSalary !== undefined) ? Number(row.earnedBaseSalary) : baseSal;
    var displayGross = (isEarned && row.earnedGrossPay !== undefined) ? Number(row.earnedGrossPay) : Number(row.grossPay);
    var displayNet = (isEarned && row.earnedNetPay !== undefined) ? Number(row.earnedNetPay) : Number(row.netPay);

    h += '<tr class="' + rowClass + '" onclick="openInspector(\'' + esc(row.empId) + '\')" title="คลิกเพื่อดูสรุปรายได้-รายการหักอย่างละเอียด">' +
      '<td class="font-mono font-bold sticky-col" style="left:0;width:80px;min-width:80px;max-width:80px">' + esc(row.empId) + '</td>' +
      '<td class="font-bold sticky-col sticky-col-divider" style="left:80px;min-width:180px">' + esc(row.name) + nickHtml + conflictHtml + '</td>' +
      '<td><span class="period-pill">' + esc(row.department || '-') + '</span> ' + esc(row.position || '') + '</td>' +
      '<td class="text-muted" style="font-size:11px">' + esc(row.bankName || '-') + '<br>' + esc(row.bankAccount || '-') + '</td>' +
      '<td class="text-right font-mono font-bold">' +
        (canViewSalary ? (
          (isEarned && row.earnedBaseSalary !== undefined) ? (
            '<div><span style="color:#d97706">฿' + fmt(displayBase) + '</span></div>' +
            '<div style="font-size:10px;color:#94a3b8;font-weight:normal" title="ฐานสัญญาเต็มเดือน">เต็มงวด: ฿' + fmt(baseSal) + '</div>'
          ) : fmt(baseSal)
        ) : '฿***') +
      '</td>' +
      '<td class="text-right font-mono text-blue font-bold bg-blue-light">' + (canViewSalary ? fmt(dailyRate) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (row.otHours || 0) + '</td>' +
      '<td class="' + otClass + '">' + (canViewSalary ? fmt(row.otPay) : '฿***') + otTag + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + (canViewSalary ? fmt(row.allowance) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(row.bonus) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red font-bold">' + (canViewSalary ? fmt(row.leaveDeduction) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-blue bg-blue-light">' +
        (canViewSalary ? (
          (isEarned && row.earnedGrossPay !== undefined) ? (
            '<div><span style="color:#1e40af">฿' + fmt(displayGross) + '</span></div>' +
            '<div style="font-size:10px;color:#94a3b8;font-weight:normal" title="Gross คาดการณ์เต็มงวด">เต็มงวด: ฿' + fmt(row.grossPay) + '</div>'
          ) : fmt(row.grossPay)
        ) : '฿***') +
      '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(row.sso) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-blue">' + (canViewSalary ? fmt(row.pf) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(row.tax) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red">' + (canViewSalary ? fmt(row.advanceDeduct) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-red">' + (canViewSalary ? fmt(row.otherDeduct) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold text-red bg-red-light">' + (canViewSalary ? fmt(row.totalDeductions || 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono font-bold bg-green-light" style="font-size:13px">' +
        (canViewSalary ? (
          (isEarned && row.earnedNetPay !== undefined) ? (
            '<div><span class="text-green" style="font-size:13.5px;font-weight:800">฿' + fmt(displayNet) + '</span> <span style="font-size:10px;font-weight:700;background:#fef3c7;color:#b45309;padding:1px 4px;border-radius:4px;border:1px solid #fde68a">สะสม</span></div>' +
            '<div style="font-size:10px;color:#94a3b8;font-weight:normal" title="สุทธิคาดการณ์เต็มงวด">เต็มงวด: ฿' + fmt(row.netPay) + '</div>'
          ) : (
            '<span class="text-green">' + fmt(row.netPay) + '</span>'
          ) +
          (Number(row.carriedDebt) > 0 ? '<div style="font-size:10px;font-weight:700;color:#dc2626;white-space:nowrap;margin-top:2px"><i class="fa-solid fa-triangle-exclamation"></i> หนี้ยกยอด ' + fmt(row.carriedDebt) + '</div>' : '')
        ) : '฿***') +
      '</td>' +
      '<td class="text-center">' +
        (canViewPayslip ? '<button type="button" class="btn btn-primary btn-sm" onclick="event.stopPropagation();viewPayslip(\'' + esc(row.empId) + '\')"><i class="fa-solid fa-print"></i> สลิป</button>' : '<span class="text-muted">-</span>') +
      '</td>' +
    '</tr>';
  });
  tbody.innerHTML = h;
}

// RENDER PAYROLL CARDS VIEW (PHASE 3)
function renderPayrollCardsView(list, container, q, bFilter) {
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: #64748b;">' +
      '<div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;"><i class="fa-solid fa-users-slash"></i> ' + (q || bFilter !== 'ALL' || State.filterOnlyChanged ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา' : 'ยังไม่มีข้อมูลการคำนวณเงินเดือนในงวด ' + esc(State.period)) + '</div>' +
      '<div style="font-size: 12.5px; color: #94a3b8;">กรุณาไปที่แท็บ "บันทึกข้อมูลประจำงวด" เพื่อดึงข้อมูลพนักงาน</div>' +
    '</div>';
    return;
  }

  var canViewSalary = hasPermission('view_salary');
  var isEarned = (State.payrollCalcMode === 'EARNED' && (State.isMidPeriod || (list[0] && list[0].isMidPeriod)));
  var html = '';

  list.forEach(function(row) {
    var emp = (State.employees || []).find(function(e) { return e.empId === row.empId; }) || {};
    var empNick = emp.nickname || row.nickname || getEmpNickname(row.empId) || '';
    var initial = empNick ? empNick.substring(0, 1) : (row.name ? row.name.substring(0, 1) : '?');
    var bName = getEmpBranchName(emp);

    var delta = State.syncDeltaMap && State.syncDeltaMap[row.empId];
    var deltaClass = delta ? ' row-delta-updated' : '';
    var conflictInfo = getEmployeeConflictInfo(row.empId, row);
    var conflictBadges = conflictInfo.badgeHtml ? ('<div style="margin-top:4px">' + conflictInfo.badgeHtml + '</div>') : '';

    var baseSal = Number(row.baseSalary) || 0;
    var otHours = Number(row.otHours) || 0;
    var otPay = Number(row.otPay) || 0;
    var totalDeduct = Number(row.totalDeductions) || 0;
    var netPay = Number(row.netPay) || 0;

    var displayBase = (isEarned && row.earnedBaseSalary !== undefined) ? Number(row.earnedBaseSalary) : baseSal;
    var displayNet = (isEarned && row.earnedNetPay !== undefined) ? Number(row.earnedNetPay) : netPay;
    var displayDed = (isEarned && row.earnedTotalDeductions !== undefined) ? Number(row.earnedTotalDeductions) : totalDeduct;

    html += '<div class="emp-payroll-card' + deltaClass + '" onclick="openInspector(\'' + esc(row.empId) + '\')">' +
      '<div class="emp-card-header">' +
        '<div class="emp-card-info">' +
          '<div class="emp-card-avatar">' + esc(initial) + '</div>' +
          '<div>' +
            '<div class="emp-card-name">' + esc(row.name) + (empNick ? ' <span style="font-size:11px;font-weight:700;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:1px 5px;border-radius:4px">(' + esc(empNick) + ')</span>' : '') + '</div>' +
            '<div class="emp-card-sub"><strong style="color:#1e40af;font-family:var(--font-mono, monospace)">' + esc(row.empId) + '</strong> • ' + esc(row.position || '-') + ' • ' + esc(bName) + '</div>' +
          '</div>' +
        '</div>' +
        (delta ? '<span class="delta-tag" title="มีข้อมูลอัปเดตใหม่">ใหม่</span>' : '') +
      '</div>' +
      conflictBadges +
      '<div class="emp-card-metrics">' +
        '<div class="emp-card-metric-item">' +
          '<span class="emp-card-metric-label">' + (isEarned ? 'ฐานสะสม (Earned):' : 'เงินเดือนฐาน:') + '</span>' +
          '<span class="emp-card-metric-value">' + (canViewSalary ? (
            isEarned ? ('<span style="color:#d97706">฿' + fmt(displayBase) + '</span>') : fmt(baseSal)
          ) : '฿***') + '</span>' +
        '</div>' +
        '<div class="emp-card-metric-item">' +
          '<span class="emp-card-metric-label">OT (' + otHours + 'h):</span>' +
          '<span class="emp-card-metric-value" style="color:' + (otHours > 0 ? '#0284c7' : '#64748b') + '">' + (canViewSalary ? (otHours > 0 ? fmt(otPay) : '-') : '฿***') + '</span>' +
        '</div>' +
        '<div class="emp-card-metric-item">' +
          '<span class="emp-card-metric-label">เบี้ยขยัน/อื่นๆ:</span>' +
          '<span class="emp-card-metric-value" style="color:#15803d">' + (canViewSalary ? fmt((Number(row.allowance) || 0) + (Number(row.bonus) || 0)) : '฿***') + '</span>' +
        '</div>' +
        '<div class="emp-card-metric-item">' +
          '<span class="emp-card-metric-label">รวมหัก:</span>' +
          '<span class="emp-card-metric-value" style="color:#dc2626">' + (canViewSalary ? '-' + fmt(displayDed) : '฿***') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="emp-card-footer">' +
        '<div>' +
          '<div class="emp-card-net-label">' + (isEarned ? 'สุทธิสะสม (Earned Net)' : 'สุทธิ (Net Pay)') + '</div>' +
          '<div style="font-size:10px;color:#94a3b8"><i class="fa-solid fa-credit-card"></i> ' + esc(row.bankName || 'TTB') + '</div>' +
        '</div>' +
        '<div class="text-right">' +
          '<div class="emp-card-net-val"' + (isEarned ? ' style="color:#15803d;font-weight:800"' : '') + '>' + (canViewSalary ? fmt(displayNet) : '฿***') + '</div>' +
          '<button type="button" class="btn btn-outline btn-xs" style="margin-top:3px;font-size:11px;padding:2px 8px" onclick="event.stopPropagation();viewPayslip(\'' + esc(row.empId) + '\')">' +
            '<i class="fa-solid fa-file-invoice-dollar text-blue"></i> สลิป' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  });

  container.innerHTML = html;
}

// ==============================================================================
// PHASE 3: SLIDE-OVER INSPECTOR DRAWER CONTROLLER
// ==============================================================================
function openInspector(empId) {
  var emp = (State.employees || []).find(function(e) { return e.empId === empId; }) || {};
  var payroll = (State.payrollList || []).find(function(p) { return p.empId === empId; }) || {};
  var input = (State.inputRecords || []).find(function(i) { return i.empId === empId; }) || {};

  var drawer = document.getElementById('inspectorDrawer');
  var backdrop = document.getElementById('inspectorBackdrop');
  if (!drawer || !backdrop) return;

  var nick = emp.nickname || payroll.nickname || input.nickname || getEmpNickname(empId) || '';
  var fullName = emp.fullName || payroll.name || input.empName || empId;
  var bName = getEmpBranchName(emp);
  var initial = nick ? nick.substring(0, 1) : fullName.substring(0, 1);

  var insAvatar = document.getElementById('insAvatar');
  var insTitle = document.getElementById('insTitle');
  var insSub = document.getElementById('insSub');
  var insContent = document.getElementById('insContent');

  if (insAvatar) insAvatar.textContent = initial;
  if (insTitle) insTitle.innerHTML = esc(fullName) + (nick ? ' <span style="font-size:12px;font-weight:700;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:1px 6px;border-radius:4px">(' + esc(nick) + ')</span>' : '');
  if (insSub) insSub.textContent = empId + ' • ' + (emp.position || payroll.position || 'พนักงาน') + ' • ' + bName;

  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();
  var baseSal = Number(payroll.baseSalary || input.baseSalary || emp.baseSalary || 0);
  var otHours = Number(payroll.otHours || input.otHours || 0);
  var otPay = Number(payroll.otPay || (otHours * (Number(input.otRate) || 40)));
  var allowance = Number(payroll.allowance || input.allowance || 0);
  var bonus = Number(payroll.bonus || input.bonus || 0);
  var grossPay = Number(payroll.grossPay || 0);

  var leaveDeduct = Number(payroll.leaveDeduction || 0);
  var sso = Number(payroll.sso || input.sso || 0);
  var pf = Number(payroll.pf || 0);
  var tax = Number(payroll.tax || input.tax || 0);
  var advanceDeduct = Number(payroll.advanceDeduct || input.advanceDeduct || 0);
  var otherDeduct = Number(payroll.otherDeduct || input.otherDeduct || 0);
  var carriedDebt = Number(payroll.carriedDebt || input.carriedDebt || 0);
  var totalDeduct = Number(payroll.totalDeductions || (leaveDeduct + sso + pf + tax + advanceDeduct + otherDeduct));
  var netPay = Number(payroll.netPay || (grossPay - totalDeduct));

  var conflictInfo = getEmployeeConflictInfo(empId, input);

  var html = '';

  // 1. Net Pay Banner
  html += '<div class="inspector-net-banner">' +
    '<div class="ins-net-title"><i class="fa-solid fa-wallet"></i> ยอดเงินรับสุทธิ (Net Pay) ประจำงวด ' + esc(State.period) + '</div>' +
    '<div class="ins-net-amount">' + (canViewSalary ? fmt(netPay) : '฿***') + '</div>' +
    '<div class="ins-net-bank"><i class="fa-solid fa-building-columns"></i> ธนาคาร: ' + esc(emp.bankName || payroll.bankName || 'TTB') + ' ' + esc(emp.bankAccount || payroll.bankAccount || '-') + '</div>' +
  '</div>';

  // 2. Conflict / Anomaly Badges if any
  if (conflictInfo.badgeHtml) {
    html += '<div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:10px 12px;font-size:12px;display:flex;flex-direction:column;gap:4px">' +
      '<div style="font-weight:700;color:#b45309"><i class="fa-solid fa-triangle-exclamation"></i> ข้อสังเกตประจำงวด:</div>' +
      '<div>' + conflictInfo.badgeHtml + '</div>' +
    '</div>';
  }

  // 2.1 Mid-Period Accrued/Earned Wage Preview Card (if period is active/in-progress)
  var isMidPeriod = Boolean(payroll.isMidPeriod || State.isMidPeriod);
  if (isMidPeriod) {
    var elDays = Number(payroll.elapsedWorkDays || State.elapsedWorkDays || 0);
    var totDays = Number(payroll.totalWorkDays || State.workingDays || 26);
    var pct = totDays > 0 ? Math.round((elDays / totDays) * 100) : 0;
    var dRate = Number(payroll.dailyRate) || (totDays > 0 ? Math.round(baseSal / totDays * 100) / 100 : 0);
    var eBase = (payroll.earnedBaseSalary !== undefined) ? Number(payroll.earnedBaseSalary) : Math.round(dRate * elDays * 100) / 100;
    var eGross = (payroll.earnedGrossPay !== undefined) ? Number(payroll.earnedGrossPay) : Math.round((eBase + otPay + allowance + bonus - leaveDeduct) * 100) / 100;
    var eNet = (payroll.earnedNetPay !== undefined) ? Number(payroll.earnedNetPay) : netPay;
    var eSso = (payroll.earnedSso !== undefined) ? Number(payroll.earnedSso) : Math.min(750, Math.round(eBase * 0.05 * 100) / 100);
    var ePf = (payroll.earnedPf !== undefined) ? Number(payroll.earnedPf) : 0;
    var asOfThai = formatDateThaiBE(payroll.asOfDate || State.asOfDate);

    html += '<div class="calc-breakdown-card" style="border:1.5px solid #bfdbfe;background:linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)">' +
      '<div class="calc-breakdown-title" style="color:#1d4ed8;display:flex;align-items:center;justify-content:space-between">' +
        '<span><i class="fa-solid fa-chart-line"></i> คำนวณระหว่างงวด (Earned to-Date)</span>' +
        '<span style="font-size:11px;font-weight:700;background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:12px">' +
          elDays + ' / ' + totDays + ' วัน (' + pct + '%)' +
        '</span>' +
      '</div>' +
      '<div style="font-size:11.5px;color:#475569;margin-bottom:8px">ประเมิน ณ วันที่ <strong>' + esc(asOfThai) + '</strong> (สะท้อนผลงานจริงตามวันทำงานที่ผ่านมา)</div>' +
      '<div class="calc-row"><span>ฐานสัญญาเต็มเดือน</span><span class="val font-mono">' + (canViewSalary ? fmt(baseSal) : '฿***') + '</span></div>' +
      '<div class="calc-row"><span>อัตราค่าจ้างต่อวัน (หาร ' + totDays + ' วัน)</span><span class="val font-mono text-blue font-bold">' + (canViewSalary ? fmt(dRate) + ' / วัน' : '฿***') + '</span></div>' +
      '<div class="calc-row font-bold" style="background:#dbeafe;padding:4px 6px;border-radius:4px">' +
        '<span style="color:#1e40af"><i class="fa-solid fa-circle-check" style="color:#2563eb"></i> ฐานสะสมตามวันจริง (' + elDays + ' วัน)</span>' +
        '<span class="val font-mono" style="color:#1e40af;font-size:13px">' + (canViewSalary ? fmt(eBase) : '฿***') + '</span>' +
      '</div>' +
      '<div class="calc-row"><span>หักขาด/ลา/สาย สะสมถึงวันนี้</span><span class="val font-mono text-red">' + (canViewSalary ? (leaveDeduct > 0 ? '-' + fmt(leaveDeduct) : '฿0') : '฿***') + '</span></div>' +
      '<div class="calc-row"><span>OT สะสมถึงวันนี้ (' + otHours + ' ชม.)</span><span class="val font-mono text-blue">' + (canViewSalary ? (otPay > 0 ? '+' + fmt(otPay) : '฿0') : '฿***') + '</span></div>' +
      '<div class="calc-row"><span>ประกันสังคมสะสม (5% ไม่เกิน 750)</span><span class="val font-mono text-red">' + (canViewSalary ? (eSso > 0 ? '-' + fmt(eSso) : '฿0') : '฿***') + '</span></div>' +
      (ePf > 0 ? '<div class="calc-row"><span>กองทุน PF สะสม</span><span class="val font-mono text-red">' + (canViewSalary ? '-' + fmt(ePf) : '฿***') + '</span></div>' : '') +
      (advanceDeduct > 0 ? '<div class="calc-row"><span>หักเบิกล่วงหน้า</span><span class="val font-mono text-red">' + (canViewSalary ? '-' + fmt(advanceDeduct) : '฿***') + '</span></div>' : '') +
      '<div class="calc-row total" style="background:#ecfdf5;border-top:1.5px solid #a7f3d0;padding:6px;border-radius:4px;margin-top:4px">' +
        '<span style="color:#065f46;font-size:12.5px;font-weight:700"><i class="fa-solid fa-wallet" style="color:#059669"></i> ยอดสุทธิสะสม ณ วันนี้ (Earned Net)</span>' +
        '<span class="val font-mono" style="color:#059669;font-size:15px;font-weight:800">' + (canViewSalary ? fmt(eNet) : '฿***') + '</span>' +
      '</div>' +
      '<div style="font-size:11px;color:#64748b;margin-top:6px;line-height:1.4">' +
        '<i class="fa-solid fa-circle-info" style="color:#3b82f6"></i> หากทำงานจนครบงวดโดยไม่ขาด/ลาเพิ่ม ยอดสุทธิสิ้นงวดจะเป็น <strong>' + (canViewSalary ? fmt(netPay) : '฿***') + '</strong>' +
      '</div>' +
    '</div>';
  }

  // 3. Earnings Breakdown
  html += '<div class="calc-breakdown-card">' +
    '<div class="calc-breakdown-title" style="color:#1e40af"><i class="fa-solid fa-circle-plus"></i> รายได้ (Earnings)</div>' +
    '<div class="calc-row"><span>เงินเดือนฐาน (Base Salary)</span><span class="val">' + (canViewSalary ? fmt(baseSal) : '฿***') + '</span></div>' +
    '<div class="calc-row"><span>ค่าล่วงเวลา OT (' + otHours + ' ชม.)</span><span class="val" style="color:' + (otHours > 0 ? '#0284c7' : 'inherit') + '">' + (canViewSalary ? fmt(otPay) : '฿***') + '</span></div>' +
    '<div class="calc-row"><span>เบี้ยขยัน / ค่าเบี้ยเลี้ยง</span><span class="val" style="color:#15803d">' + (canViewSalary ? fmt(allowance) : '฿***') + '</span></div>' +
    (bonus > 0 ? '<div class="calc-row"><span>เงินโบนัส / พิเศษ</span><span class="val" style="color:#15803d">' + (canViewSalary ? fmt(bonus) : '฿***') + '</span></div>' : '') +
    '<div class="calc-row total"><span>รวมรายได้ (Gross Earnings)</span><span class="val" style="color:#1e40af">' + (canViewSalary ? fmt(grossPay) : '฿***') + '</span></div>' +
  '</div>';

  // 4. Deductions Breakdown
  html += '<div class="calc-breakdown-card">' +
    '<div class="calc-breakdown-title" style="color:#dc2626"><i class="fa-solid fa-circle-minus"></i> รายการหัก (Deductions)</div>' +
    '<div class="calc-row"><span>หักขาด/ลา/มาสาย</span><span class="val" style="color:' + (leaveDeduct > 0 ? '#dc2626' : 'inherit') + '">' + (canViewSalary ? fmt(leaveDeduct) : '฿***') + '</span></div>' +
    '<div class="calc-row"><span>ประกันสังคม (SSO)</span><span class="val">' + (canViewSalary ? fmt(sso) : '฿***') + '</span></div>' +
    (pf > 0 ? '<div class="calc-row"><span>กองทุนสำรองเลี้ยงชีพ (PF)</span><span class="val">' + (canViewSalary ? fmt(pf) : '฿***') + '</span></div>' : '') +
    (tax > 0 ? '<div class="calc-row"><span>ภาษีหัก ณ ที่จ่าย (WHT)</span><span class="val">' + (canViewSalary ? fmt(tax) : '฿***') + '</span></div>' : '') +
    (advanceDeduct > 0 ? '<div class="calc-row"><span>หักเบิกล่วงหน้า (Advance)</span><span class="val" style="color:#dc2626">' + (canViewSalary ? fmt(advanceDeduct) : '฿***') + '</span></div>' : '') +
    (otherDeduct > 0 ? '<div class="calc-row"><span>หักอื่นๆ</span><span class="val" style="color:#dc2626">' + (canViewSalary ? fmt(otherDeduct) : '฿***') + '</span></div>' : '') +
    (carriedDebt > 0 ? '<div class="calc-row"><span>หนี้คงค้างยกยอด</span><span class="val" style="color:#dc2626">' + (canViewSalary ? fmt(carriedDebt) : '฿***') + '</span></div>' : '') +
    '<div class="calc-row total"><span>รวมรายการหัก (Total Deductions)</span><span class="val" style="color:#dc2626">' + (canViewSalary ? '-' + fmt(totalDeduct) : '฿***') + '</span></div>' +
  '</div>';

  // 5. Time & Attendance Summary
  var workDays = State.workingDays > 0 ? State.workingDays : 30;
  var absDays = Number(input.absentDays || 0);
  var leaveDays = Number(input.leaveDays || 0);
  var sickDays = Number(input.sickLeaveDays || 0);
  var unpaidSickDays = Number(input.unpaidSickLeaveDays || 0);
  var lateMins = Number(input.lateMinutes || 0);
  var lateCnt = Number(input.lateCount || 0);
  var actualWorkDays = Math.max(0, workDays - absDays - leaveDays - unpaidSickDays);

  var sickText = sickDays + ' วัน';
  if (unpaidSickDays > 0) {
    if (sickDays > 0) {
      sickText = sickDays + ' วัน <span style="color:#dc2626;font-weight:700">(+ไม่มีใบ ' + unpaidSickDays + ' วัน)</span>';
    } else {
      sickText = unpaidSickDays + ' วัน <span style="color:#dc2626;font-weight:700">(ไม่มีใบแพทย์)</span>';
    }
  }

  html += '<div class="calc-breakdown-card">' +
    '<div class="calc-breakdown-title" style="color:#0f172a"><i class="fa-solid fa-clock-rotate-left"></i> สรุปเวลาทำงานงวดนี้ (PTN Time)</div>' +
    '<div class="calc-row"><span>วันทำงานจริง (จาก ' + workDays + ' วัน)</span><span class="val font-bold" style="color:#15803d">' + actualWorkDays + ' วัน</span></div>' +
    '<div class="calc-row"><span>ขาดงาน</span><span class="val" style="color:' + (absDays > 0 ? '#dc2626' : 'inherit') + '">' + absDays + ' วัน</span></div>' +
    '<div class="calc-row"><span>ลากิจ / พักร้อน</span><span class="val">' + leaveDays + ' วัน</span></div>' +
    '<div class="calc-row"><span>ลาป่วย</span><span class="val">' + sickText + '</span></div>' +
    '<div class="calc-row"><span>มาสายสะสม</span><span class="val" style="color:' + (lateMins > 0 ? '#d97706' : 'inherit') + '">' + lateMins + ' นาที (' + lateCnt + ' ครั้ง)</span></div>' +
  '</div>';

  // 6. Action Footer
  html += '<div style="display:flex;gap:8px;margin-top:6px">' +
    '<button type="button" class="btn btn-primary btn-sm" style="flex:1" onclick="viewPayslip(\'' + esc(empId) + '\')">' +
      '<i class="fa-solid fa-file-invoice-dollar"></i> พิมพ์สลิปเงินเดือน' +
    '</button>' +
    '<button type="button" class="btn btn-slate btn-sm" style="flex:1" onclick="closeInspector();switchTab(\'input\');setTimeout(function(){openEditInputModal(\'' + esc(empId) + '\');},200)">' +
      '<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูลประจำงวด' +
    '</button>' +
  '</div>';

  if (insContent) insContent.innerHTML = html;

  backdrop.classList.add('show');
  drawer.classList.add('open');
}

function closeAllDrawers() {
  closeInspector();
  closeInputFastEditDrawer();
}

function closeInspector() {
  var drawer = document.getElementById('inspectorDrawer');
  if (drawer) drawer.classList.remove('open');
  var otherDrawer = document.getElementById('inputFastEditDrawer');
  if (!otherDrawer || !otherDrawer.classList.contains('open')) {
    var backdrop = document.getElementById('inspectorBackdrop');
    if (backdrop) backdrop.classList.remove('show');
  }
}

function closeInputFastEditDrawer() {
  var drawer = document.getElementById('inputFastEditDrawer');
  if (drawer) drawer.classList.remove('open');
  var otherDrawer = document.getElementById('inspectorDrawer');
  if (!otherDrawer || !otherDrawer.classList.contains('open')) {
    var backdrop = document.getElementById('inspectorBackdrop');
    if (backdrop) backdrop.classList.remove('show');
  }
}

// Global keyboard escape listener for Inspector & Fast-Edit Drawers
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      closeAllDrawers();
    }
  });
}

// ==============================================================================
// MONTHLY INPUT FAST-EDIT & AUDIT DRAWER (PHASE 3)
// ==============================================================================
function openInputFastEditDrawer(empId) {
  var drawer = document.getElementById('inputFastEditDrawer');
  var backdrop = document.getElementById('inspectorBackdrop');
  if (!drawer || !backdrop) return;

  var q = (document.getElementById('inputSearchInput') ? document.getElementById('inputSearchInput').value : '').trim().toLowerCase();
  var bFilter = State.inputBranchFilter || 'ALL';
  var qFilter = State.inputQuickFilter || 'ALL';

  var visibleList = (State.inputRecords || []).filter(function(i) {
    if (State.filterOnlyChanged && (!State.syncDeltaMap || !State.syncDeltaMap[i.empId])) return false;
    if (bFilter !== 'ALL') {
      var emp = (State.employees || []).find(function(e) { return e.empId === i.empId; });
      var empBranch = emp ? getEmpBranchId(emp) : 'B01';
      if (empBranch !== bFilter) return false;
    }
    if (qFilter === 'OT' && !((Number(i.otHours) || 0) > 0)) return false;
    if (qFilter === 'DEDUCT' && !((Number(i.absentDays) || 0) > 0 || (Number(i.leaveDays) || 0) > 0 || (Number(i.sickLeaveDays) || 0) > 0 || (Number(i.unpaidSickLeaveDays) || 0) > 0 || (Number(i.lateMinutes) || 0) > 0 || (Number(i.lateDeduct) || 0) > 0)) return false;
    if (qFilter === 'ADVANCE' && !((Number(i.advanceDeduct) || 0) > 0)) return false;
    if (qFilter === 'CHANGES') {
      var emp = (State.employees || []).find(function(e) { return e.empId === i.empId; });
      if (!isEmployeeChanges(null, i, emp)) return false;
    }
    if (!q) return true;
    var emp = (State.employees || []).find(function(e) { return e.empId === i.empId; }) || {};
    var nick = (i.nickname || emp.nickname || getEmpNickname(i.empId) || '').toLowerCase();
    return (i.empId && i.empId.toLowerCase().indexOf(q) >= 0) ||
           (i.empName && i.empName.toLowerCase().indexOf(q) >= 0) ||
           (nick && nick.indexOf(q) >= 0);
  });

  var curIndex = visibleList.findIndex(function(x) { return x.empId === empId; });
  if (curIndex === -1) {
    curIndex = (State.inputRecords || []).findIndex(function(x) { return x.empId === empId; });
    visibleList = State.inputRecords || [];
  }
  if (curIndex === -1) return;

  var rec = visibleList[curIndex];
  var emp = (State.employees || []).find(function(e) { return e.empId === empId; }) || {};
  var nick = rec.nickname || emp.nickname || getEmpNickname(empId) || '';
  var fullName = rec.empName || emp.fullName || empId;
  var bName = getEmpBranchName(emp);
  var initial = nick ? nick.substring(0, 1) : fullName.substring(0, 1);

  // Header
  var ifeAvatar = document.getElementById('ifeAvatar');
  var ifeTitle = document.getElementById('ifeTitle');
  var ifeSub = document.getElementById('ifeSub');
  var ifeContent = document.getElementById('ifeContent');
  var ifeFooter = document.getElementById('ifeFooter');

  var exemptBadges = '';
  if (emp.isBreakExempt === true || emp.isBreakExempt === 'true') {
    exemptBadges += ' <span style="font-size:11px;font-weight:700;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;padding:1px 6px;border-radius:4px"><i class="fa-solid fa-mug-hot"></i> ไม่ต้องสแกนพัก</span>';
  }
  if (emp.isAttendanceExempt === true || emp.isAttendanceExempt === 'true') {
    exemptBadges += ' <span style="font-size:11px;font-weight:700;color:#1e40af;background:#eff6ff;border:1px solid #bfdbfe;padding:1px 6px;border-radius:4px"><i class="fa-solid fa-crown"></i> ยกเว้นลงเวลา</span>';
  }
  if (ifeAvatar) ifeAvatar.textContent = initial;
  if (ifeTitle) ifeTitle.innerHTML = esc(fullName) + (nick ? ' <span style="font-size:12px;font-weight:700;color:#15803d;background:#dcfce7;border:1px solid #86efac;padding:1px 6px;border-radius:4px">(' + esc(nick) + ')</span>' : '') + exemptBadges;
  if (ifeSub) ifeSub.textContent = empId + ' • ' + (emp.position || 'พนักงาน') + ' • ' + bName;

  var conflictInfo = getEmployeeConflictInfo(empId, rec);

  var workDays = State.workingDays > 0 ? State.workingDays : 30;
  var absDays = Number(rec.absentDays || 0);
  var leaveDays = Number(rec.leaveDays || 0);
  var sickDays = Number(rec.sickLeaveDays || 0);
  var unpaidSickDays = Number(rec.unpaidSickLeaveDays || 0);
  var lateMins = Number(rec.lateMinutes || 0);
  var lateCnt = Number(rec.lateCount || 0);
  var actualWorkDays = Math.max(0, workDays - absDays - leaveDays - unpaidSickDays);

  var baseSal = Number(rec.baseSalary) || 0;
  var dailyRate = workDays > 0 ? Math.round(baseSal / workDays * 100) / 100 : 0;
  var pfRate = (rec.pfRate !== null && rec.pfRate !== undefined && !isNaN(Number(rec.pfRate))) ? Number(rec.pfRate) : 0;

  var canEdit = !State.isClosed && (hasPermission('edit_inputs') || isSuperAdmin());
  var canSync = !State.isClosed && (hasPermission('sync_ptn_time') || isSuperAdmin());
  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();

  var html = '';

  // 1. Attendance & PTN Time Status Card
  html += '<div class="ife-section" style="background:#f8fafc">' +
    '<div class="ife-section-title" style="color:#0284c7"><i class="fa-solid fa-clock-rotate-left"></i> สรุปเวลาจาก PTN Time ประจำงวด ' + esc(State.period) + '</div>' +
    (conflictInfo.badgeHtml ? '<div style="margin-bottom:6px">' + conflictInfo.badgeHtml + '</div>' : '') +
    '<div class="ife-grid-3">' +
      '<div class="ife-field"><label>วันทำงานจริง</label><div class="font-mono font-bold" style="color:#15803d;font-size:13px">' + actualWorkDays + ' วัน</div></div>' +
      '<div class="ife-field"><label>ขาดงาน</label><div class="font-mono font-bold" style="color:' + (absDays > 0 ? '#dc2626' : '#64748b') + ';font-size:13px">' + absDays + ' วัน</div></div>' +
      '<div class="ife-field"><label>ลากิจ/ป่วย</label><div class="font-mono" style="font-size:12px">' + leaveDays + ' / ' + sickDays + (unpaidSickDays > 0 ? (' <span style="color:#dc2626;font-weight:700">(ไม่มีใบ ' + unpaidSickDays + ' วัน)</span>') : '') + ' วัน</div></div>' +
    '</div>' +
    '<div class="ife-grid-2" style="margin-top:6px">' +
      '<div class="ife-field"><label>มาสายสะสม</label><div class="font-mono font-bold" style="color:' + (lateMins > 0 ? '#d97706' : '#64748b') + ';font-size:13px">' + lateMins + ' นาที (' + lateCnt + ' ครั้ง)</div></div>' +
      '<div class="ife-field"><label>ชั่วโมง OT</label><div class="font-mono font-bold" style="color:' + ((Number(rec.otHours) || 0) > 0 ? '#0284c7' : '#64748b') + ';font-size:13px">' + (rec.otHours || 0) + ' ชม.</div></div>' +
    '</div>' +
    (canSync ? (
      '<button type="button" class="btn btn-outline btn-xs" style="margin-top:8px;border-color:#38bdf8;color:#0284c7;background:#f0f9ff;font-size:11.5px;padding:5px 8px;border-radius:6px" onclick="syncFromPtnTimeForEmp(\'' + esc(empId) + '\', \'' + esc(fullName) + '\').then(function(){ openInputFastEditDrawer(\'' + esc(empId) + '\'); })">' +
        '<i class="fa-solid fa-rotate"></i> ดึงเวลาคนนี้ใหม่จาก PTN Time (1-Click)' +
      '</button>'
    ) : '') +
  '</div>';

  // 2. Interactive Edit Inputs
  html += '<form id="ifeForm" onsubmit="event.preventDefault();saveInputFastEditDrawer(\'' + esc(empId) + '\')">' +
    '<input type="hidden" id="ifeEmpId" value="' + esc(empId) + '">' +
    '<input type="hidden" id="ifeEmpName" value="' + esc(fullName) + '">' +

    '<div class="ife-section">' +
      '<div class="ife-section-title" style="color:#1e40af"><i class="fa-solid fa-sack-dollar"></i> ฐานเงินเดือน & ข้อมูลสัญญา</div>' +
      '<div class="ife-grid-2">' +
        '<div class="ife-field">' +
          '<label>เงินเดือนฐาน (บาท)</label>' +
          '<input type="number" step="any" id="ifeBaseSalary" class="ife-input font-mono" value="' + baseSal + '" oninput="updateIfeLiveCalculation()" ' + (canEdit && canViewSalary ? '' : 'readonly') + '>' +
        '</div>' +
        '<div class="ife-field">' +
          '<label>ค่าจ้างเฉลี่ย / วัน (บาท)</label>' +
          '<input type="text" id="ifeDailyRateDisplay" class="ife-input font-mono" value="' + fmt(dailyRate) + '" readonly style="background:#f8fafc;color:#1e40af">' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="ife-section" style="margin-top:12px">' +
      '<div class="ife-section-title" style="color:#b45309"><i class="fa-solid fa-calendar-check"></i> เวลาทำงาน ขาด/ลา/มาสาย & OT</div>' +
      '<div class="ife-grid-2">' +
        '<div class="ife-field">' +
          '<label>ขาดงาน (วัน)</label>' +
          '<input type="number" step="any" id="ifeAbsentDays" class="ife-input font-mono" value="' + absDays + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
        '<div class="ife-field">' +
          '<label>ลากิจ / พักร้อน (วัน)</label>' +
          '<input type="number" step="any" id="ifeLeaveDays" class="ife-input font-mono" value="' + leaveDays + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
      '</div>' +
      '<div class="ife-grid-2" style="margin-top:8px">' +
        '<div class="ife-field">' +
          '<label style="color:#15803d;font-weight:700"><i class="fa-solid fa-file-medical"></i> ป่วย (มีใบแพทย์)</label>' +
          '<input type="number" step="any" id="ifeSickLeaveDays" class="ife-input font-mono" value="' + sickDays + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + ' title="สิทธิ์ฟรีตามโควตา 10 วันต่อปี">' +
        '</div>' +
        '<div class="ife-field">' +
          '<label style="color:#dc2626;font-weight:700"><i class="fa-solid fa-bed"></i> ป่วย (ไม่มีใบแพทย์)</label>' +
          '<input type="number" step="any" id="ifeUnpaidSickLeaveDays" class="ife-input font-mono" value="' + unpaidSickDays + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + ' style="border-color:#fca5a5;background:#fff5f5" title="หักเงินเดือนตามจริง (1.0x เท่าค่าจ้างรายวัน)">' +
        '</div>' +
      '</div>' +
      '<div class="ife-grid-3" style="margin-top:8px">' +
        '<div class="ife-field">' +
          '<label>หักเงินสาย (บาท)</label>' +
          '<input type="number" step="any" id="ifeLateDeduct" class="ife-input font-mono" value="' + (Number(rec.lateDeduct) || 0) + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
        '<div class="ife-field">' +
          '<label>OT (ชั่วโมง)</label>' +
          '<input type="number" step="any" id="ifeOtHours" class="ife-input font-mono" value="' + (Number(rec.otHours) || 0) + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
        '<div class="ife-field">' +
          '<label>อัตรา OT (฿/ชม.)</label>' +
          '<input type="number" step="any" id="ifeOtRate" class="ife-input font-mono" value="' + (Number(rec.otRate) || 40) + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="ife-section" style="margin-top:12px">' +
      '<div class="ife-section-title" style="color:#15803d"><i class="fa-solid fa-gift"></i> เงินได้อื่นๆ & เบี้ยเลี้ยง</div>' +
      '<div class="ife-grid-2">' +
        '<div class="ife-field">' +
          '<label>เบี้ยเลี้ยง / เงินเพิ่มพิเศษ (บาท)</label>' +
          '<input type="number" step="any" id="ifeAllowance" class="ife-input font-mono" value="' + (Number(rec.allowance) || 0) + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
        '<div class="ife-field">' +
          '<label>โบนัสประจำงวด (บาท)</label>' +
          '<input type="number" step="any" id="ifeBonus" class="ife-input font-mono" value="' + (Number(rec.bonus) || 0) + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="ife-section" style="margin-top:12px">' +
      '<div class="ife-section-title" style="color:#dc2626"><i class="fa-solid fa-file-invoice"></i> รายการหัก & หนี้ยกยอด</div>' +
      '<div class="ife-grid-2">' +
        '<div class="ife-field">' +
          '<label>หักเบิกล่วงหน้า (บาท)</label>' +
          '<input type="number" step="any" id="ifeAdvanceDeduct" class="ife-input font-mono" value="' + (Number(rec.advanceDeduct) || 0) + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
        '<div class="ife-field">' +
          '<label>หักอื่นๆ (บาท)</label>' +
          '<input type="number" step="any" id="ifeOtherDeduct" class="ife-input font-mono" value="' + (Number(rec.otherDeduct) || 0) + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
      '</div>' +
      '<div class="ife-grid-3" style="margin-top:8px">' +
        '<div class="ife-field">' +
          '<label>ประกันสังคม (บาท)</label>' +
          '<input type="number" step="any" id="ifeSso" class="ife-input font-mono" value="' + (rec.sso !== undefined && rec.sso !== null ? rec.sso : 0) + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
        '<div class="ife-field">' +
          '<label>กองทุน PF (%)</label>' +
          '<input type="number" step="0.01" id="ifePfRate" class="ife-input font-mono" value="' + pfRate + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
        '<div class="ife-field">' +
          '<label>ภาษี หัก ณ ที่จ่าย (บาท)</label>' +
          '<input type="number" step="any" id="ifeTax" class="ife-input font-mono" value="' + (Number(rec.tax) || 0) + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
        '</div>' +
      '</div>' +
      '<div class="ife-field" style="margin-top:8px">' +
        '<label>หนี้ค้างยกยอดมาจากงวดก่อน (บาท)</label>' +
        '<input type="number" step="any" id="ifeCarriedDebt" class="ife-input font-mono" value="' + (Number(rec.carriedDebt) || 0) + '" oninput="updateIfeLiveCalculation()" ' + (canEdit ? '' : 'readonly') + '>' +
      '</div>' +
    '</div>' +
  '</form>';

  // 3. Live Preview Calculation Box
  html += '<div class="ife-live-calc-box" id="ifeCalcBox" style="margin-top:12px">' +
    '<div style="font-size:12px;font-weight:700;color:#15803d;display:flex;align-items:center;justify-content:space-between">' +
      '<span><i class="fa-solid fa-calculator"></i> ประมาณการยอดสุทธิ (Realtime)</span>' +
      '<span style="font-size:11px;font-weight:normal;color:#166534">คำนวณอัตโนมัติขณะพิมพ์</span>' +
    '</div>' +
    '<div class="ife-calc-row"><span>รวมรายได้ (Gross):</span><span class="font-mono font-bold" id="ifePreviewGross">฿0.00</span></div>' +
    '<div class="ife-calc-row"><span>รวมรายการหัก (Deductions):</span><span class="font-mono font-bold" id="ifePreviewDeduct" style="color:#dc2626">-฿0.00</span></div>' +
    '<div class="ife-calc-row total">' +
      '<span>ยอดรับสุทธิโดยประมาณ:</span>' +
      '<span class="font-mono" id="ifePreviewNet" style="font-size:18px">฿0.00</span>' +
    '</div>' +
  '</div>';

  if (ifeContent) ifeContent.innerHTML = html;

  // Footer Actions: Prev, Save, Next
  var prevEmpId = curIndex > 0 ? visibleList[curIndex - 1].empId : null;
  var nextEmpId = curIndex < visibleList.length - 1 ? visibleList[curIndex + 1].empId : null;

  var footerHtml = '<div style="display:flex;align-items:center;gap:6px">' +
    '<button type="button" class="btn btn-slate btn-sm" ' + (prevEmpId ? 'onclick="openInputFastEditDrawer(\'' + esc(prevEmpId) + '\')"' : 'disabled style="opacity:0.4;cursor:not-allowed"') + ' title="ดูคนก่อนหน้า">' +
      '<i class="fa-solid fa-chevron-left"></i> คนก่อนหน้า' +
    '</button>' +
    '<span style="font-size:11px;color:#64748b;font-weight:600;padding:0 4px">' + (curIndex + 1) + '/' + visibleList.length + '</span>' +
    '<button type="button" class="btn btn-slate btn-sm" ' + (nextEmpId ? 'onclick="openInputFastEditDrawer(\'' + esc(nextEmpId) + '\')"' : 'disabled style="opacity:0.4;cursor:not-allowed"') + ' title="ดูคนถัดไป">' +
      'คนถัดไป <i class="fa-solid fa-chevron-right"></i>' +
    '</button>' +
  '</div>' +
  '<div style="display:flex;align-items:center;gap:6px">' +
    (canEdit ? (
      '<button type="button" id="ifeBtnSave" class="btn btn-success btn-sm" style="background:#15803d;border-color:#15803d;font-weight:700;padding:6px 14px" onclick="saveInputFastEditDrawer(\'' + esc(empId) + '\')">' +
        '<i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูล' +
      '</button>'
    ) : '') +
  '</div>';

  if (ifeFooter) ifeFooter.innerHTML = footerHtml;

  // Initial calculation preview
  updateIfeLiveCalculation();

  backdrop.classList.add('show');
  drawer.classList.add('open');
}

function updateIfeLiveCalculation() {
  var baseSal = Number(document.getElementById('ifeBaseSalary') ? document.getElementById('ifeBaseSalary').value : 0) || 0;
  var workDays = State.workingDays > 0 ? State.workingDays : 30;
  var dailyRate = workDays > 0 ? Math.round(baseSal / workDays * 100) / 100 : 0;

  var rateDisp = document.getElementById('ifeDailyRateDisplay');
  if (rateDisp) rateDisp.value = fmt(dailyRate);

  var otHours = Number(document.getElementById('ifeOtHours') ? document.getElementById('ifeOtHours').value : 0) || 0;
  var otRate = Number(document.getElementById('ifeOtRate') ? document.getElementById('ifeOtRate').value : 40) || 40;
  var otPay = Math.round(otHours * otRate * 100) / 100;

  var allowance = Number(document.getElementById('ifeAllowance') ? document.getElementById('ifeAllowance').value : 0) || 0;
  var bonus = Number(document.getElementById('ifeBonus') ? document.getElementById('ifeBonus').value : 0) || 0;

  var absentDays = Number(document.getElementById('ifeAbsentDays') ? document.getElementById('ifeAbsentDays').value : 0) || 0;
  var leaveDays = Number(document.getElementById('ifeLeaveDays') ? document.getElementById('ifeLeaveDays').value : 0) || 0;
  var sickLeaveDays = Number(document.getElementById('ifeSickLeaveDays') ? document.getElementById('ifeSickLeaveDays').value : 0) || 0;
  var unpaidSickDays = Number(document.getElementById('ifeUnpaidSickLeaveDays') ? document.getElementById('ifeUnpaidSickLeaveDays').value : 0) || 0;

  var absentDeduct = Math.round(absentDays * dailyRate * 1.5 * 100) / 100;
  var businessLeaveDeduct = Math.round(leaveDays * dailyRate * 100) / 100;
  var unpaidSickDeduct = Math.round(unpaidSickDays * dailyRate * 100) / 100;
  var leaveDeduct = absentDeduct + businessLeaveDeduct + unpaidSickDeduct;
  var lateDeduct = Number(document.getElementById('ifeLateDeduct') ? document.getElementById('ifeLateDeduct').value : 0) || 0;

  var sso = Number(document.getElementById('ifeSso') ? document.getElementById('ifeSso').value : 0) || 0;
  var pfRate = Number(document.getElementById('ifePfRate') ? document.getElementById('ifePfRate').value : 0) || 0;
  var pf = pfRate > 0 ? Math.round(baseSal * pfRate * 100) / 100 : 0;
  var tax = Number(document.getElementById('ifeTax') ? document.getElementById('ifeTax').value : 0) || 0;
  var advance = Number(document.getElementById('ifeAdvanceDeduct') ? document.getElementById('ifeAdvanceDeduct').value : 0) || 0;
  var other = Number(document.getElementById('ifeOtherDeduct') ? document.getElementById('ifeOtherDeduct').value : 0) || 0;

  var gross = baseSal + otPay + allowance + bonus;
  var totalDeduct = leaveDeduct + lateDeduct + sso + pf + tax + advance + other;
  var net = Math.max(0, gross - totalDeduct);

  var canViewSalary = hasPermission('view_salary') || isSuperAdmin();
  var grossEl = document.getElementById('ifePreviewGross');
  var deductEl = document.getElementById('ifePreviewDeduct');
  var netEl = document.getElementById('ifePreviewNet');

  if (grossEl) grossEl.textContent = canViewSalary ? fmt(gross) : '฿***';
  if (deductEl) deductEl.textContent = canViewSalary ? ('-' + fmt(totalDeduct)) : '฿***';
  if (netEl) netEl.textContent = canViewSalary ? fmt(net) : '฿***';
}

function saveInputFastEditDrawer(empId, callback) {
  if (State.isClosed) {
    showToast('งวดนี้ปิดแล้ว ไม่อนุญาตให้แก้ไขข้อมูล', 'error');
    return;
  }
  var baseSal = Number(document.getElementById('ifeBaseSalary').value) || 0;
  var pfRate = Number(document.getElementById('ifePfRate').value) || 0;
  var pfAmt = pfRate > 0 ? Math.round(baseSal * pfRate * 100) / 100 : 0;

  var origRec = (State.inputRecords || []).find(function(x) { return x.empId === empId; }) || {};

  var d = {
    empId: empId,
    empName: document.getElementById('ifeEmpName') ? document.getElementById('ifeEmpName').value.trim() : (origRec.empName || ''),
    baseSalary: baseSal,
    pfRate: pfRate,
    pfAmount: pfAmt,
    absentDays: Number(document.getElementById('ifeAbsentDays').value) || 0,
    leaveDays: Number(document.getElementById('ifeLeaveDays').value) || 0,
    sickLeaveDays: Number(document.getElementById('ifeSickLeaveDays').value) || 0,
    unpaidSickLeaveDays: Number(document.getElementById('ifeUnpaidSickLeaveDays') ? document.getElementById('ifeUnpaidSickLeaveDays').value : (origRec.unpaidSickLeaveDays || 0)) || 0,
    lateDeduct: Number(document.getElementById('ifeLateDeduct').value) || 0,
    lateMinutes: Number(origRec.lateMinutes || 0),
    lateCount: Number(origRec.lateCount || 0),
    otHours: Number(document.getElementById('ifeOtHours').value) || 0,
    otRate: Number(document.getElementById('ifeOtRate').value) || 40,
    allowance: Number(document.getElementById('ifeAllowance').value) || 0,
    bonus: Number(document.getElementById('ifeBonus').value) || 0,
    advanceDeduct: Number(document.getElementById('ifeAdvanceDeduct').value) || 0,
    otherDeduct: Number(document.getElementById('ifeOtherDeduct').value) || 0,
    carriedDebt: Number(document.getElementById('ifeCarriedDebt').value) || 0,
    sso: Number(document.getElementById('ifeSso').value) || 0,
    tax: Number(document.getElementById('ifeTax').value) || 0
  };

  var btn = document.getElementById('ifeBtnSave');
  var origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
  }

  callApi('saveInputRecord', { record: d, origEmpId: empId })
    .then(function(r) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
      showToast(r.message || 'บันทึกข้อมูลสำเร็จ');
      loadAppData().then(function() {
        if (typeof callback === 'function') {
          callback();
        } else {
          openInputFastEditDrawer(empId);
        }
      });
    })
    .catch(function(err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
      showToast('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || String(err)), 'error');
    });
}

// // 3. MONTHLY INPUT TABLE RENDERER (19 COLUMNS)
function renderInputTable() {
  var tbody = document.getElementById('inputTableBody');
  if (!tbody) return;

  var banner = document.getElementById('inputPeriodLockedBanner');
  if (banner) {
    banner.style.display = State.isClosed ? 'flex' : 'none';
    if (State.isClosed) {
      banner.innerHTML = '<div style="display:flex;align-items:center;gap:10px">' +
        '<i class="fa-solid fa-lock" style="font-size:18px;color:#dc2626"></i>' +
        '<div><div style="font-weight:700;font-size:13.5px;color:#991b1b">งวดประจำเดือน ' + esc(State.period) + ' ถูกปิดและล็อคแล้ว</div>' +
        '<div style="font-size:11.5px;color:#b91c1c;margin-top:2px">ผลการคำนวณและข้อมูลถูกล็อคถาวร ไม่อนุญาตให้แก้ไข ลบ หรือซิงค์ข้อมูลใหม่ หากต้องการแก้ไขกรุณากดปุ่ม "ปลดล็อคงวด" ด้านขวา</div></div>' +
        '</div>' +
        (hasPermission('close_period') || isSuperAdmin() ? '<button type="button" class="btn btn-slate btn-sm" onclick="reopenPeriod()" style="background:#ffffff;border:1px solid #fca5a5;color:#dc2626;font-weight:700;white-space:nowrap"><i class="fa-solid fa-lock-open"></i> ปลดล็อคงวด</button>' : '');
    }
  }

  var btnPopulate = document.getElementById('btnBatchPopulate');
  if (btnPopulate) {
    btnPopulate.disabled = State.isClosed;
    btnPopulate.style.opacity = State.isClosed ? '0.5' : '1';
    btnPopulate.style.cursor = State.isClosed ? 'not-allowed' : 'pointer';
    btnPopulate.title = State.isClosed ? 'งวดนี้ปิดแล้ว ไม่อนุญาตให้นำเข้าพนักงาน' : 'ดึงพนักงานทุกคนเข้างวดนี้';
  }
  var btnSync = document.getElementById('btnInputSyncFromPtnTime');
  if (btnSync) {
    btnSync.disabled = State.isClosed;
    btnSync.style.opacity = State.isClosed ? '0.5' : '1';
    btnSync.style.cursor = State.isClosed ? 'not-allowed' : 'pointer';
    btnSync.title = State.isClosed ? 'งวดนี้ปิดแล้ว ไม่อนุญาตให้ดึงข้อมูลจาก PTN Time' : 'ดึงข้อมูลจาก PTN Time (1-Click)';
  }
  var btnImp = document.getElementById('btnImportAttendance');
  if (btnImp) {
    btnImp.disabled = State.isClosed;
    btnImp.style.opacity = State.isClosed ? '0.5' : '1';
    btnImp.style.cursor = State.isClosed ? 'not-allowed' : 'pointer';
    btnImp.title = State.isClosed ? 'งวดนี้ปิดแล้ว ไม่อนุญาตให้นำเข้าข้อมูล' : 'นำเข้าเวลาจาก Excel/CSV';
  }
  var btnAddInp = document.getElementById('btnAddInputModal');
  if (btnAddInp) {
    btnAddInp.disabled = State.isClosed;
    btnAddInp.style.opacity = State.isClosed ? '0.5' : '1';
    btnAddInp.style.cursor = State.isClosed ? 'not-allowed' : 'pointer';
    btnAddInp.title = State.isClosed ? 'งวดนี้ปิดแล้ว ไม่อนุญาตให้เพิ่มข้อมูล' : 'บันทึกข้อมูลรายคน';
  }
  var selAll = document.getElementById('inputSelectAll');
  if (selAll) {
    selAll.disabled = State.isClosed;
    if (State.isClosed) selAll.checked = false;
  }

  renderInputBranchChips();

  var q = (document.getElementById('inputSearchInput') ? document.getElementById('inputSearchInput').value : '').trim().toLowerCase();
  var bFilter = State.inputBranchFilter || 'ALL';

  var branchList = (State.inputRecords || []).filter(function(i) {
    if (State.filterOnlyChanged && (!State.syncDeltaMap || !State.syncDeltaMap[i.empId])) return false;
    if (bFilter !== 'ALL') {
      var emp = (State.employees || []).find(function(e) { return e.empId === i.empId; });
      var empBranch = emp ? getEmpBranchId(emp) : 'B01';
      if (empBranch !== bFilter) return false;
    }
    if (!q) return true;
    var emp = (State.employees || []).find(function(e) { return e.empId === i.empId; }) || {};
    var nick = (i.nickname || emp.nickname || getEmpNickname(i.empId) || '').toLowerCase();
    return (i.empId && i.empId.toLowerCase().indexOf(q) >= 0) ||
           (i.empName && i.empName.toLowerCase().indexOf(q) >= 0) ||
           (nick && nick.indexOf(q) >= 0);
  });

  updateInputKpiDeck(branchList);

  var qFilter = State.inputQuickFilter || 'ALL';
  var list = branchList.filter(function(i) {
    if (qFilter === 'ALL') return true;
    if (qFilter === 'OT') return (Number(i.otHours) || 0) > 0;
    if (qFilter === 'DEDUCT') return (Number(i.absentDays) || 0) > 0 || (Number(i.leaveDays) || 0) > 0 || (Number(i.sickLeaveDays) || 0) > 0 || (Number(i.unpaidSickLeaveDays) || 0) > 0 || (Number(i.lateMinutes) || 0) > 0 || (Number(i.lateDeduct) || 0) > 0;
    if (qFilter === 'ADVANCE') return (Number(i.advanceDeduct) || 0) > 0;
    if (qFilter === 'CHANGES') {
      var emp = (State.employees || []).find(function(e) { return e.empId === i.empId; });
      return isEmployeeChanges(null, i, emp);
    }
    return true;
  });

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="20" class="text-center text-muted" style="padding:32px">' +
      '<div style="font-size:14px;font-weight:700;color:#64748b;margin-bottom:6px"><i class="fa-solid fa-calendar-days"></i> ' + (q || bFilter !== 'ALL' || State.filterOnlyChanged ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา' : 'ยังไม่มีข้อมูลในงวด ' + esc(State.period)) + '</div>' +
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
    var canEditInputs = !State.isClosed && (hasPermission('edit_inputs') || isSuperAdmin());
    var canSyncPtnTime = !State.isClosed && (hasPermission('sync_ptn_time') || isSuperAdmin());

    var delta = State.syncDeltaMap && State.syncDeltaMap[i.empId];
    var rowClass = delta ? ' class="row-delta-updated"' : '';
    var conflictInfo = getEmployeeConflictInfo(i.empId, i);
    var conflictHtml = conflictInfo.badgeHtml ? (' ' + conflictInfo.badgeHtml) : '';

    var absDelta = delta && delta.changedFields && delta.changedFields.absentDays;
    var absClass = absDelta ? 'text-right font-mono text-red font-bold cell-delta-updated' : 'text-right font-mono text-red font-bold';
    var absTag = absDelta ? ' <span class="delta-tag" title="เดิม: ' + absDelta.before + ' -> ใหม่: ' + absDelta.after + '">ใหม่</span>' : '';

    var sickDelta = delta && delta.changedFields && (delta.changedFields.sickLeaveDays || delta.changedFields.unpaidSickLeaveDays);
    var sickClass = sickDelta ? 'text-right font-mono text-red cell-delta-updated' : 'text-right font-mono text-red';
    var sickTag = sickDelta ? ' <span class="delta-tag">ใหม่</span>' : '';

    var sickWithCert = Number(i.sickLeaveDays) || 0;
    var sickNoCert = Number(i.unpaidSickLeaveDays) || 0;
    var sickDisplayHtml = '';
    if (sickNoCert > 0) {
      if (sickWithCert > 0) {
        sickDisplayHtml = (Math.round(sickWithCert * 100) / 100) + ' <span style="font-size:10px;color:#dc2626;font-weight:700;background:#fef2f2;border:1px solid #fecaca;padding:0px 4px;border-radius:3px;display:inline-block;white-space:nowrap;margin-top:2px" title="มีใบแพทย์ ' + sickWithCert + ' วัน + ไม่มีใบแพทย์ ' + sickNoCert + ' วัน (หักเงิน)">+' + sickNoCert + ' (ไม่มีใบ)</span>';
      } else {
        sickDisplayHtml = (Math.round(sickNoCert * 100) / 100) + ' <span style="font-size:10px;color:#dc2626;font-weight:700;background:#fef2f2;border:1px solid #fecaca;padding:0px 4px;border-radius:3px;display:inline-block;white-space:nowrap;margin-top:2px" title="ลาป่วยไม่มีใบรับรองแพทย์ ' + sickNoCert + ' วัน (หักเงินตามจริง)">ไม่มีใบแพทย์</span>';
      }
    } else {
      sickDisplayHtml = String(Math.round(sickWithCert * 100) / 100);
    }

    var otDelta = delta && delta.changedFields && delta.changedFields.otHours;
    var otClass = otDelta ? 'text-right font-mono cell-delta-updated' : 'text-right font-mono';
    var otTag = otDelta ? ' <span class="delta-tag" title="เดิม: ' + otDelta.before + ' -> ใหม่: ' + otDelta.after + '">ใหม่</span>' : '';

    var advDelta = delta && delta.changedFields && delta.changedFields.advanceDeduct;
    var advClass = advDelta ? 'text-right font-mono text-red font-bold cell-delta-updated' : 'text-right font-mono text-red font-bold';
    var advTag = advDelta ? ' <span class="delta-tag" title="เดิม: ' + advDelta.before + ' -> ใหม่: ' + advDelta.after + '">ใหม่</span>' : '';

    var rowClass = 'clickable-row' + (delta ? ' row-delta-updated' : '');
    h += '<tr class="' + rowClass + '" onclick="openInputFastEditDrawer(\'' + esc(i.empId) + '\')" title="คลิกเพื่อเปิดแผงตรวจเวลาและแก้ไขข้อมูลประจำงวด">' +
      '<td class="text-center sticky-col" style="left:0;width:40px;min-width:40px;max-width:40px" onclick="event.stopPropagation()">' +
        (State.isClosed ? '<span class="text-muted" title="งวดนี้ปิดแล้ว"><i class="fa-solid fa-lock" style="font-size:11px;color:#cbd5e1"></i></span>' :
          (canEditInputs ? '<input type="checkbox" class="input-row-checkbox" value="' + esc(i.empId) + '" onchange="onInputCheckboxChanged()" style="cursor:pointer;accent-color:#e11d48;width:15px;height:15px">' : '<span class="text-muted">-</span>')) +
      '</td>' +
      '<td class="text-center font-mono sticky-col" style="left:40px;width:50px;min-width:50px;max-width:50px">' + (idx + 1) + '</td>' +
      '<td class="font-mono font-bold sticky-col" style="left:90px;width:80px;min-width:80px;max-width:80px">' + esc(i.empId) + '</td>' +
      (function() {
      var emp = State.employees.find(function(e) { return e.empId === i.empId; });
      var empNick = (emp && emp.nickname) ? emp.nickname : (i.nickname || getEmpNickname(i.empId));
      var nickHtml = empNick ? (' <span style="font-size:11px;font-weight:700;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:1px 6px;border-radius:4px;white-space:nowrap;margin-left:4px">(' + esc(empNick) + ')</span>') : '';
      var remBadge = (emp && emp.remark) ? '<br><span style="font-size:11px;font-weight:normal;color:#d97706;background:#fffbeb;border:1px solid #fef3c7;padding:1px 6px;border-radius:4px;display:inline-block;margin-top:2px"><i class="fa-solid fa-note-sticky"></i> ' + esc(emp.remark) + '</span>' : '';
      return '<td class="font-bold sticky-col sticky-col-divider" style="left:170px;min-width:180px">' + esc(i.empName || '-') + nickHtml + remBadge + conflictHtml + '</td>';
    })() +
      '<td class="text-right font-mono font-bold" style="color:#1e3a8a">' + (canViewSalary ? fmt(baseSal) : '฿***') + '</td>' +
      '<td class="text-right font-mono text-blue font-bold bg-blue-light">' + (canViewSalary ? fmt(dailyRate) : '฿***') + '</td>' +
      '<td class="' + absClass + '">' + (Math.round((Number(i.absentDays) || 0) * 100) / 100) + absTag + '</td>' +
      '<td class="text-right font-mono">' + (Math.round((Number(i.leaveDays) || 0) * 100) / 100) + '</td>' +
      '<td class="' + sickClass + '">' + sickDisplayHtml + sickTag + '</td>' +
      (function() {
        var lateDed = Number(i.lateDeduct) || 0;
        var lateMins = Number(i.lateMinutes) || 0;
        var lateCnt = Number(i.lateCount) || 0;
        var badge = '';
        if (lateMins > 0 || lateCnt > 0) {
          badge = '<div style="font-size:10.5px;color:#dc2626;font-weight:600;line-height:1.2;margin-top:2px">' +
                  lateMins + ' นาที' + (lateCnt > 0 ? ' (' + lateCnt + ' ครั้ง)' : '') + '</div>';
        }
        var lateDelta = delta && delta.changedFields && (delta.changedFields.lateDeduct || delta.changedFields.lateMinutes);
        var lateCellClass = lateDelta ? 'text-right font-mono text-red font-bold cell-delta-updated' : 'text-right font-mono text-red font-bold';
        var lateTag = lateDelta ? ' <span class="delta-tag">ใหม่</span>' : '';
        return '<td class="' + lateCellClass + '">' + fmt(lateDed) + lateTag + badge + '</td>';
      })() +
      '<td class="' + otClass + '">' + (i.otHours || 0) + otTag + '</td>' +
      '<td class="text-right font-mono">' + fmt(i.otRate || 40) + '</td>' +
      '<td class="text-right font-mono text-green font-bold">' + fmt(i.allowance || 0) + '</td>' +
      '<td class="text-right font-mono">' + fmt(i.bonus || 0) + '</td>' +
      '<td class="text-right font-mono font-bold text-blue">' + (canViewSalary ? fmt(pfAmt) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(i.sso !== undefined && i.sso !== null ? i.sso : 0) : '฿***') + '</td>' +
      '<td class="text-right font-mono">' + (canViewSalary ? fmt(i.tax || 0) : '฿***') + '</td>' +
      '<td class="' + advClass + '">' + (canViewSalary ? fmt(Number(i.advanceDeduct) || 0) : '฿***') + advTag + '</td>' +
      (function() {
        var oth = Number(i.otherDeduct) || 0;
        var cDebt = Number(i.carriedDebt) || 0;
        var debtBadge = cDebt > 0 ? '<div style="font-size:10px;color:#dc2626;font-weight:700;line-height:1.2;margin-top:2px" title="หนี้ค้างยกยอดมาจากงวดก่อน"><i class="fa-solid fa-triangle-exclamation"></i> หนี้ ' + fmt(cDebt) + '</div>' : '';
        return '<td class="text-right font-mono text-red">' + fmt(oth) + debtBadge + '</td>';
      })() +
      '<td class="text-center" onclick="event.stopPropagation()">' +
        (State.isClosed ? '<span class="status-badge" style="background:#fef2f2;color:#dc2626;border-color:#fecaca;font-size:11px;padding:2px 8px;font-weight:600"><i class="fa-solid fa-lock"></i> ล็อคงวดแล้ว</span>' :
          ((canSyncPtnTime ? '<button type="button" class="btn-icon" style="color:#0284c7;background:#e0f2fe;border:1px solid #bae6fd;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:4px;font-weight:600" onclick="syncFromPtnTimeForEmp(\'' + esc(i.empId) + '\', \'' + esc(i.empName || '') + '\')" title="ดึงข้อมูล OT, วันลา และยอดเบิกเงินของ ' + esc(i.empName || i.empId) + ' จาก PTN Time"><i class="fa-solid fa-rotate"></i> ดึงเฉพาะคนนี้</button> ' : '') +
          (canEditInputs ?
            '<button type="button" class="btn-icon edit" onclick="openEditInputModal(\'' + esc(i.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button> ' +
            '<button type="button" class="btn-icon del" onclick="deleteInputRecord(\'' + esc(i.empId) + '\')"><i class="fa-solid fa-trash"></i> ลบ</button>' : '') +
          (!canSyncPtnTime && !canEditInputs ? '<span class="text-muted">-</span>' : ''))) +
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
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้ลบข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
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

var currentEmpSubTab = 'active';

function switchEmpSubTab(tabName) {
  currentEmpSubTab = tabName || 'active';
  var btnActive = document.getElementById('btnEmpSubActive');
  var btnResigned = document.getElementById('btnEmpSubResigned');
  var activeToolbar = document.getElementById('empSubtabActiveToolbar');
  var resignedToolbar = document.getElementById('empSubtabResignedToolbar');
  var activeArea = document.getElementById('empSubtabActiveArea');
  var resignedArea = document.getElementById('empSubtabResignedArea');

  if (btnActive) {
    btnActive.className = (currentEmpSubTab === 'active') ? 'btn btn-primary btn-sm' : 'btn btn-slate btn-sm';
  }
  if (btnResigned) {
    btnResigned.className = (currentEmpSubTab === 'resigned') ? 'btn btn-danger btn-sm' : 'btn btn-slate btn-sm';
  }

  if (activeToolbar) activeToolbar.style.display = (currentEmpSubTab === 'active') ? 'flex' : 'none';
  if (resignedToolbar) resignedToolbar.style.display = (currentEmpSubTab === 'resigned') ? 'flex' : 'none';
  if (activeArea) activeArea.style.display = (currentEmpSubTab === 'active') ? 'block' : 'none';
  if (resignedArea) resignedArea.style.display = (currentEmpSubTab === 'resigned') ? 'block' : 'none';

  if (currentEmpSubTab === 'resigned') {
    renderResignedEmployeesTable();
  } else {
    renderEmployeesTable();
  }
}

function setEmpStatusFilter(status) {
  if (status === 'Resigned') {
    switchEmpSubTab('resigned');
    return;
  }
  currentEmpStatusFilter = status;
  var btns = {
    all: document.getElementById('btnEmpFilterAll'),
    Active: document.getElementById('btnEmpFilterActive'),
    Probation: document.getElementById('btnEmpFilterProbation')
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

  // 1. Calculate and Update Top KPI Metrics (Active & Probation staff only)
  var emps = State.employees || [];
  var activeCount = 0;
  var probCount = 0;
  var resignedCount = 0;
  var totalActiveBaseSalary = 0;

  var deptSet = {};
  emps.forEach(function(e) {
    var st = e.status || 'Active';
    if (st === 'Active') {
      activeCount++;
      totalActiveBaseSalary += Number(e.baseSalary) || 0;
      if (e.department) deptSet[e.department] = true;
    } else if (st === 'Probation') {
      probCount++;
      totalActiveBaseSalary += Number(e.baseSalary) || 0;
      if (e.department) deptSet[e.department] = true;
    } else if (st === 'Resigned') {
      resignedCount++;
    } else {
      activeCount++;
      totalActiveBaseSalary += Number(e.baseSalary) || 0;
      if (e.department) deptSet[e.department] = true;
    }
  });

  var totalWorkingStaff = activeCount + probCount;

  if (document.getElementById('empKpiTotal')) document.getElementById('empKpiTotal').innerHTML = totalWorkingStaff + ' <span style="font-size:13px;font-weight:400;color:var(--text-muted)">คน</span>';
  if (document.getElementById('empKpiActive')) document.getElementById('empKpiActive').innerHTML = activeCount + ' <span style="font-size:13px;font-weight:400;color:var(--text-muted)">คน</span>';
  if (document.getElementById('empKpiProbation')) document.getElementById('empKpiProbation').innerHTML = probCount + ' <span style="font-size:13px;font-weight:400;color:var(--text-muted)">คน</span>';
  if (document.getElementById('empKpiTotalSalary')) {
    document.getElementById('empKpiTotalSalary').textContent = canViewSalary ? fmt(totalActiveBaseSalary) : '฿***';
  }

  // Update sub-tab counter badges
  if (document.getElementById('subtabBadgeActiveCount')) document.getElementById('subtabBadgeActiveCount').textContent = totalWorkingStaff;
  if (document.getElementById('subtabBadgeResignedCount')) document.getElementById('subtabBadgeResignedCount').textContent = resignedCount;

  // Update filter pill counts (Active view only)
  if (document.getElementById('countFilterAll')) document.getElementById('countFilterAll').textContent = totalWorkingStaff;
  if (document.getElementById('countFilterActive')) document.getElementById('countFilterActive').textContent = activeCount;
  if (document.getElementById('countFilterProbation')) document.getElementById('countFilterProbation').textContent = probCount;

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

  // Populate employee select dropdowns for inputs and history (exclude resigned from daily select where appropriate)
  var sel = '<option value="">-- เลือกรหัสพนักงาน --</option>';
  (State.employees || []).forEach(function(e) {
    var nickDisplay = e.nickname ? ' (' + e.nickname + ')' : '';
    var empPf = (e.pfRate !== null && e.pfRate !== undefined && !isNaN(Number(e.pfRate))) ? Number(e.pfRate) : 0;
    var empSso = (e.defaultSso !== null && e.defaultSso !== undefined && !isNaN(Number(e.defaultSso))) ? Number(e.defaultSso) : 0;
    var resignedSuffix = (e.status === 'Resigned') ? ' [ลาออกแล้ว]' : '';
    sel += '<option value="' + e.empId + '" data-name="' + esc(e.fullName) + '" data-salary="' + e.baseSalary + '" data-pf="' + empPf + '" data-sso="' + empSso + '" data-tax="' + (e.defaultTax || 0) + '" data-remark="' + esc(e.remark || '') + '">' + esc(e.empId) + ' - ' + esc(e.fullName) + nickDisplay + resignedSuffix + '</option>';
  });
  var miSel = document.getElementById('miEmpId');
  if (miSel) miSel.innerHTML = sel;
  var histSel = document.getElementById('histEmpSelect');
  if (histSel) histSel.innerHTML = sel;

  // Filter list by status, department, and search query (EXCLUDE RESIGNED)
  var q = (document.getElementById('empSearchInput') ? document.getElementById('empSearchInput').value : '').trim().toLowerCase();
  var selectedDept = deptSel ? deptSel.value : '';

  var list = emps.filter(function(e) {
    var st = e.status || 'Active';
    // Exclude Resigned staff from active table & cards view
    if (st === 'Resigned') return false;

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
        '<th class="sticky-col" style="left:0;width:85px;min-width:85px;max-width:85px">รหัส</th>' +
        '<th class="sticky-col sticky-col-divider" style="left:85px;min-width:180px">พนักงาน</th>' +
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
        '<th class="sticky-col" style="left:0;width:85px;min-width:85px;max-width:85px">รหัส</th>' +
        '<th class="sticky-col sticky-col-divider" style="left:85px;min-width:180px">พนักงาน</th>' +
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
    var birthText = e.birthDate ? (formatDateThaiBE(e.birthDate) + (e.age ? ' (' + e.age + ' ปี)' : '')) : (e.age ? (e.age + ' ปี') : '-');
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
    var breakExemptTag = (e.isBreakExempt === true || e.isBreakExempt === 'true') ? '<span class="period-pill" style="background:#f0fdf4;color:#166534;border-color:#bbf7d0;font-size:10px;padding:1px 5px" title="ยกเว้นการสแกนพักเที่ยง/บ่าย"><i class="fa-solid fa-mug-hot"></i> ไม่ต้องสแกนพัก</span>' : '';
    var attExemptTag = (e.isAttendanceExempt === true || e.isAttendanceExempt === 'true') ? '<span class="period-pill" style="background:#eff6ff;color:#1e40af;border-color:#bfdbfe;font-size:10px;padding:1px 5px" title="ผู้บริหาร/ยกเว้นลงเวลา"><i class="fa-solid fa-crown"></i> ยกเว้นลงเวลา</span>' : '';
    var policyBadgesHtml = (breakExemptTag || attExemptTag) ? ('<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px">' + breakExemptTag + attExemptTag + '</div>') : '';

    // 1. Render Table Row
    if (isGeneralUser || !canViewSalary) {
      hTable += '<tr>' +
        '<td class="font-mono font-bold text-blue sticky-col" style="left:0;width:85px;min-width:85px;max-width:85px">' + esc(e.empId) + '</td>' +
        '<td class="sticky-col sticky-col-divider" style="left:85px;min-width:180px">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            avatarTableHtml +
            '<div>' +
              '<div style="font-weight:700;color:var(--text-main)">' + esc(e.fullName) + ' ' + (e.nickname ? ('<span class="period-pill" style="background:#f1f5f9;color:#2563eb;font-size:10px;padding:1px 6px">' + esc(e.nickname) + '</span>') : '') + devBadge + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);font-family:monospace">' + esc(e.phone || '-') + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><span class="period-pill">' + esc(e.department || '-') + '</span><div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + esc(e.position || '-') + '</div>' + branchBadgeHtml + policyBadgesHtml + '</td>' +
        '<td class="text-center">' + stBadge + '</td>' +
        '<td>' + esc(birthText) + '</td>' +
        '<td class="font-mono">' + esc(e.phone || '-') + '</td>' +
        '<td>' + bankPill + '<div class="font-mono" style="font-size:11px;color:var(--text-muted);margin-top:2px">' + esc(e.bankAccount || '-') + '</div></td>' +
        '<td>' + esc(formatDateThaiBE(e.joinDate)) + '</td>' +
        '<td class="text-center nowrap">' +
          devUnlockBtn +
          '<button type="button" class="btn-icon" style="background:#eff6ff;color:#2563eb;border-color:#bfdbfe;font-weight:700" onclick="openPrintEmployeesModal(\'' + esc(e.empId) + '\')" title="พิมพ์ประวัติพนักงานคนนี้ (A4)"><i class="fa-solid fa-print"></i></button> ' +
          (canEditEmp ? '<button type="button" class="btn-icon edit" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไข</button>' : '<span class="text-muted">-</span>') +
        '</td>' +
      '</tr>';
    } else {
      hTable += '<tr>' +
        '<td class="font-mono font-bold text-blue sticky-col" style="left:0;width:85px;min-width:85px;max-width:85px">' + esc(e.empId) + '</td>' +
        '<td class="sticky-col sticky-col-divider" style="left:85px;min-width:180px">' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            avatarTableHtml +
            '<div>' +
              '<div style="font-weight:700;color:var(--text-main)">' + esc(e.fullName) + ' ' + (e.nickname ? ('<span class="period-pill" style="background:#f1f5f9;color:#2563eb;font-size:10px;padding:1px 6px">' + esc(e.nickname) + '</span>') : '') + devBadge + '</div>' +
              '<div style="font-size:11px;color:var(--text-muted);font-family:monospace">' + esc(e.phone || '-') + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><span class="period-pill">' + esc(e.department || '-') + '</span><div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + esc(e.position || '-') + '</div>' + branchBadgeHtml + policyBadgesHtml + '</td>' +
        '<td class="text-center">' + stBadge + '</td>' +
        '<td class="text-right font-mono font-bold">' + fmt(e.baseSalary) + '</td>' +
        '<td class="text-right font-mono">' + (Number(e.pfRate) > 0 ? (((Number(e.pfRate) * 100).toFixed(0)) + '%') : '<span class="text-muted" style="font-size:11px">0%</span>') + '</td>' +
        '<td class="text-right font-mono text-red font-bold">' + (Number(e.defaultSso) > 0 ? fmt(e.defaultSso) : '<span class="text-muted" style="font-size:11px">฿0</span>') + '</td>' +
        '<td>' + bankPill + '<div class="font-mono font-bold text-blue" style="font-size:11px;margin-top:2px">' + esc(e.bankAccount || '-') + '</div></td>' +
        '<td>' + esc(formatDateThaiBE(e.joinDate)) + '</td>' +
        '<td class="text-center nowrap">' +
          devUnlockBtn +
          '<button type="button" class="btn-icon" style="background:#eff6ff;color:#2563eb;border-color:#bfdbfe;font-weight:700" onclick="openPrintEmployeesModal(\'' + esc(e.empId) + '\')" title="พิมพ์ประวัติพนักงานคนนี้ (A4)"><i class="fa-solid fa-print"></i></button> ' +
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
          policyBadgesHtml +
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
          '<span><i class="fa-solid fa-calendar-check" style="color:#94a3b8;margin-right:4px"></i> เริ่มงาน: ' + esc(formatDateThaiBE(e.joinDate)) + '</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span><i class="fa-solid fa-building-columns" style="color:#94a3b8;margin-right:4px"></i> ' + esc(e.bankName || '-') + '</span>' +
          '<span class="font-mono font-bold" style="color:#1e40af">' + esc(e.bankAccount || '-') + '</span>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;align-items:center;gap:6px;padding-top:6px">' +
        ((e.isDeviceBound && canUnlockDevice) ? '<button type="button" class="btn btn-slate btn-sm" style="color:#dc2626;border-color:#fecaca;background:#fef2f2;font-weight:700" onclick="remoteResetDevice(\'' + esc(e.empId) + '\')" title="ปลดล็อกเครื่องในระบบ PTN Time"><i class="fa-solid fa-unlock"></i> ปลดเครื่อง</button>' : '') +
        '<button type="button" class="btn btn-slate btn-sm" style="color:#2563eb;padding:4px 8px;font-weight:700" onclick="openPrintEmployeesModal(\'' + esc(e.empId) + '\')" title="พิมพ์ประวัติพนักงาน (A4)"><i class="fa-solid fa-print"></i></button>' +
        (st === 'Probation' ? '<button type="button" class="btn btn-success btn-sm" style="flex:1" onclick="passProbation(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-check"></i> ผ่านโปร</button>' : '') +
        (canEditEmp ? '<button type="button" class="btn btn-slate btn-sm" style="flex:1" onclick="openEditEmployeeModal(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-pen"></i> แก้ไขประวัติ</button>' : '') +
        (canDelEmp ? '<button type="button" class="btn btn-slate btn-sm" style="color:#dc2626;padding:4px 8px" onclick="deleteEmployee(\'' + esc(e.empId) + '\')"><i class="fa-solid fa-trash"></i></button>' : '') +
      '</div>' +
    '</div>';
  });

  tbody.innerHTML = hTable;
  if (cardsDiv) cardsDiv.innerHTML = hCards;

  if (typeof renderResignedEmployeesTable === 'function') {
    renderResignedEmployeesTable();
  }
}

// TENURE CALCULATION (e.g. "1 ปี 4 เดือน 12 วัน")
function calculateTenureString(startStr, endStr) {
  if (!startStr) return '-';
  var startDate = new Date(startStr);
  if (isNaN(startDate.getTime())) return '-';
  var endDate = endStr ? new Date(endStr) : new Date();
  if (isNaN(endDate.getTime())) endDate = new Date();
  if (endDate < startDate) return '0 วัน';

  var years = endDate.getFullYear() - startDate.getFullYear();
  var months = endDate.getMonth() - startDate.getMonth();
  var days = endDate.getDate() - startDate.getDate();

  if (days < 0) {
    months--;
    var prevMonthDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
    days += prevMonthDate.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  var parts = [];
  if (years > 0) parts.push(years + ' ปี');
  if (months > 0) parts.push(months + ' เดือน');
  if (days > 0 || parts.length === 0) parts.push(days + ' วัน');
  return parts.join(' ');
}


// POPULATE ALL EMPLOYEES
function batchPopulateEmployees() {
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้นำเข้าพนักงาน กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
  if (!hasPermission('populate_inputs') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดึงพนักงานเข้างวดนี้', 'warning');
    return;
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
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้ดึงข้อมูลจาก PTN Time กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
  if (!hasPermission('sync_ptn_time') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดึงข้อมูลจากระบบ PTN Time', 'warning');
    return;
  }

  var cutDay = (State.settings && State.settings.cutoff_day) ? Number(State.settings.cutoff_day) : 25;
  var cutRangeText = cutDay >= 30 ? 'วันที่ 1 ถึงสิ้นเดือน' : ('วันที่ ' + (cutDay + 1) + ' ถึง ' + cutDay);
  var msg = 'ต้องการดึงข้อมูลบันทึกเวลา, วันลา, ชั่วโมง OT และยอดเบิกเงินล่วงหน้า (รอบตัดวิก ' + cutRangeText + ') จากระบบ PTN Time เข้าสู่งวด ' + State.period + ' อัตโนมัติใช่หรือไม่?\n\n' +
            '✨ ระบบจะอัปเดตยอดเบิกเงินล่วงหน้า, OT, วันลา และคำนวณเงินเดือนงวดนี้ให้อัตโนมัติทันที';
  
  if (!confirm(msg)) return;

  var beforeSnapshot = captureInputRecordsSnapshot();

  showToast('กำลังดึงข้อมูลจากระบบ PTN Time (' + cutRangeText + ')...');
  callApi('syncFromPtnTime', { period: State.period })
    .then(function(r) {
      if (r.success) {
        showToast(r.message);
        loadAppData().then(function() {
          computeSyncDelta(beforeSnapshot);
        });
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
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้ดึงข้อมูลจาก PTN Time กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return Promise.resolve(null);
  }
  if (!hasPermission('sync_ptn_time') && !isSuperAdmin()) {
    showToast('สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดึงข้อมูลจากระบบ PTN Time', 'warning');
    return Promise.resolve(null);
  }
  if (!empId) return Promise.resolve(null);
  var nameStr = empName ? (' (' + empName + ')') : '';
  if (!confirm('ต้องการดึงข้อมูล OT, วันลา และยอดเบิกเงินล่วงหน้าของ [' + empId + ']' + nameStr + ' จากระบบ PTN Time เข้าสู่งวด ' + State.period + ' ใช่หรือไม่?')) {
    return Promise.resolve(null);
  }

  var beforeSnapshot = captureInputRecordsSnapshot();

  showToast('กำลังดึงข้อมูลของ ' + empId + ' จาก PTN Time...', 'info');
  return callApi('syncFromPtnTime', {
    period: State.period,
    empId: empId,
    username: (State.currentUser && State.currentUser.username) || 'Admin'
  })
    .then(function(r) {
      if (r && r.success) {
        showToast(r.message || 'ดึงข้อมูลสำเร็จ');
        loadAppData().then(function() {
          computeSyncDelta(beforeSnapshot);
        });
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
          if (document.getElementById('miAllowance')) document.getElementById('miAllowance').value = rRecord.allowance || 0;
          if (document.getElementById('miLateDeduct')) document.getElementById('miLateDeduct').value = rRecord.lateDeduct || 0;
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
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้เพิ่มข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
  refreshAllEmployeeSelects();
  document.getElementById('inputModalTitle').innerHTML = '<i class="fa-solid fa-calendar-plus"></i> บันทึกข้อมูลประจำงวด';
  document.getElementById('inputOrigEmpId').value = '';
  document.getElementById('miEmpId').value = '';
  if (document.getElementById('miEmpSearch')) document.getElementById('miEmpSearch').value = '';
  var ddList = document.getElementById('miEmpDropdownList');
  if (ddList) ddList.style.display = 'none';
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
  if (document.getElementById('miCarriedDebt')) document.getElementById('miCarriedDebt').value = '0';
  document.getElementById('miSso').value = '0';
  document.getElementById('miTax').value = '0';
  updateModalDailyRate(0);
  syncInputRulesNotices();
  updateSickQuotaBadge();
  openModal('inputModal');
}

function openEditInputModal(empId) {
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ไม่อนุญาตให้แก้ไขข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ', 'error');
    return;
  }
  var r = State.inputRecords.find(function(x) { return x.empId === empId; });
  if (!r) return;

  refreshAllEmployeeSelects();
  document.getElementById('inputModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูลประจำงวด';
  document.getElementById('inputOrigEmpId').value = r.empId;
  document.getElementById('miEmpId').value = r.empId;
  document.getElementById('miEmpName').value = r.empName || '';
  var empMatch = State.employees.find(function(e) { return e.empId === r.empId; });
  if (document.getElementById('miEmpRemark')) document.getElementById('miEmpRemark').value = (empMatch && empMatch.remark) ? empMatch.remark : '-';
  if (document.getElementById('miEmpSearch')) {
    var nickStr = (empMatch && empMatch.nickname) ? ' (' + empMatch.nickname + ')' : '';
    document.getElementById('miEmpSearch').value = '[' + r.empId + '] ' + (r.empName || (empMatch ? empMatch.fullName : '')) + nickStr;
  }
  var ddList = document.getElementById('miEmpDropdownList');
  if (ddList) ddList.style.display = 'none';
  document.getElementById('miBaseSalary').value = r.baseSalary || '';
  var inpPfRate = (r.pfRate !== null && r.pfRate !== undefined && !isNaN(Number(r.pfRate))) ? Number(r.pfRate) : 0;
  document.getElementById('miPfRate').value = inpPfRate;
  document.getElementById('miPfAmount').value = inpPfRate > 0 ? (r.pfAmount !== undefined && r.pfAmount > 0 ? r.pfAmount : Math.round((r.baseSalary || 0) * inpPfRate * 100) / 100) : 0;
  document.getElementById('miAbsentDays').value = r.absentDays || 0;
  document.getElementById('miLeaveDays').value = r.leaveDays || 0;
  document.getElementById('miSickLeaveDays').value = r.sickLeaveDays || 0;
  if (document.getElementById('miUnpaidSickLeaveDays')) document.getElementById('miUnpaidSickLeaveDays').value = r.unpaidSickLeaveDays || 0;
  document.getElementById('miLateDeduct').value = r.lateDeduct || 0;
  var hintEl = document.getElementById('miLateDeductHint');
  if (hintEl) {
    var lm = Number(r.lateMinutes) || 0;
    var lc = Number(r.lateCount) || 0;
    hintEl.textContent = (lm > 0 || lc > 0) ? '(สาย ' + lm + ' นาที' + (lc > 0 ? ' / ' + lc + ' ครั้ง' : '') + ')' : '';
  }
  document.getElementById('miOtHours').value = r.otHours || 0;
  document.getElementById('miOtRate').value = (r.otRate !== null && r.otRate !== undefined && !isNaN(Number(r.otRate))) ? r.otRate : 40;
  document.getElementById('miAllowance').value = r.allowance || 0;
  document.getElementById('miBonus').value = r.bonus || 0;
  document.getElementById('miAdvanceDeduct').value = r.advanceDeduct || 0;
  document.getElementById('miOtherDeduct').value = r.otherDeduct || 0;
  if (document.getElementById('miCarriedDebt')) document.getElementById('miCarriedDebt').value = r.carriedDebt || 0;
  document.getElementById('miSso').value = (r.sso !== undefined && r.sso !== null) ? r.sso : 0;
  document.getElementById('miTax').value = r.tax || 0;
  updateModalDailyRate(r.baseSalary || 0);
  syncInputRulesNotices();
  updateSickQuotaBadge();
  openModal('inputModal');
}

// ==============================================================================

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
    var closedPeriodName = State.period;
    var nextPeriodName = getNextPeriodStr(closedPeriodName);
    callApi('closePeriod', { username: (State.currentUser && State.currentUser.username) || (window.currentUser && window.currentUser.username) || 'Admin' })
      .then(function(r) {
        closeModal('modalClosePeriodConfirm');
        var targetNextPeriod = r.nextPeriod || nextPeriodName;
        if (targetNextPeriod) {
          State.period = targetNextPeriod;
          localStorage.setItem('ptn_last_period', State.period);
          showToast('ปิดงวด ' + closedPeriodName + ' สำเร็จ! ระบบได้สลับไปยังงวดใหม่ (' + targetNextPeriod + ') ให้เรียบร้อยแล้ว', 'success');
          loadAppData(true);
        } else {
          showToast(r.message || 'ปิดงวดประจำเดือนสำเร็จ (ล็อคผลการคำนวณแล้ว)', 'success');
          loadAppData();
        }
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
      loadAppData(true);
    })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function runPayrollRecalc() {
  if (State.isClosed) {
    showToast('งวด ' + State.period + ' ถูกปิดและล็อคแล้ว ผลการคำนวณถูกล็อคถาวร กรุณาปลดล็อคงวดก่อนดำเนินการ', 'warning');
    return;
  }
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
    var isEarned = (State.payrollCalcMode === 'EARNED' && State.isMidPeriod);
    var workDays = State.workingDays > 0 ? State.workingDays : 30;
    if (isEarned) {
      csv += 'รหัส,ชื่อ-นามสกุล,ชื่อเล่น,แผนก,ตำแหน่ง,ธนาคาร,เลขบัญชี,ฐานสะสมถึงวันนี้,ฐานสัญญาเต็มเดือน,ค่าจ้างต่อวัน,วันทำงานที่ผ่านมา,วันทำงานทั้งงวด,OTชม,เงินOT,เบี้ยขยัน,โบนัส,หักขาดลาสาย,Grossสะสม,ประกันสังคมสะสม,กองทุนPFสะสม,ภาษีสะสม,หักเงินเบิก,หักอื่นๆ,รวมหักสะสม,สุทธิสะสมNet\n';
      State.payrollList.forEach(function(r) {
        var dRate = r.dailyRate || (workDays > 0 ? Math.round(Number(r.baseSalary) / workDays * 100) / 100 : 0);
        var nick = r.nickname || getEmpNickname(r.empId) || '';
        var eBase = (r.earnedBaseSalary !== undefined) ? r.earnedBaseSalary : r.baseSalary;
        var eGross = (r.earnedGrossPay !== undefined) ? r.earnedGrossPay : r.grossPay;
        var eNet = (r.earnedNetPay !== undefined) ? r.earnedNetPay : r.netPay;
        var eSso = (r.earnedSso !== undefined) ? r.earnedSso : r.sso;
        var ePf = (r.earnedPf !== undefined) ? r.earnedPf : r.pf;
        var eTax = (r.earnedTax !== undefined) ? r.earnedTax : r.tax;
        var eDed = (r.earnedTotalDeductions !== undefined) ? r.earnedTotalDeductions : r.totalDeductions;
        csv += [r.empId, '"' + (r.name || '').replace(/"/g, '""') + '"', '"' + nick.replace(/"/g, '""') + '"', '"' + r.department + '"', '"' + r.position + '"', '"' + r.bankName + '"', '"' + r.bankAccount + '"', eBase, r.baseSalary, dRate, r.elapsedWorkDays || 0, r.totalWorkDays || workDays, r.otHours, r.otPay, r.allowance, r.bonus, r.leaveDeduction, eGross, eSso, ePf, eTax, r.advanceDeduct, r.otherDeduct, eDed, eNet].join(',') + '\n';
      });
    } else {
      csv += 'รหัส,ชื่อ-นามสกุล,ชื่อเล่น,แผนก,ตำแหน่ง,ธนาคาร,เลขบัญชี,เงินเดือนฐาน,ค่าจ้างต่อวัน,OTชม,เงินOT,เบี้ยขยัน,โบนัส,หักขาดลาสาย,Gross,ประกันสังคม,กองทุนPF,ภาษี,หักเงินเบิก,หักอื่นๆ,รวมหัก,สุทธิNet\n';
      State.payrollList.forEach(function(r) {
        var dRate = workDays > 0 ? Math.round(Number(r.baseSalary) / workDays * 100) / 100 : 0;
        var nick = r.nickname || getEmpNickname(r.empId) || '';
        csv += [r.empId, '"' + (r.name || '').replace(/"/g, '""') + '"', '"' + nick.replace(/"/g, '""') + '"', '"' + r.department + '"', '"' + r.position + '"', '"' + r.bankName + '"', '"' + r.bankAccount + '"', r.baseSalary, dRate, r.otHours, r.otPay, r.allowance, r.bonus, r.leaveDeduction, r.grossPay, r.sso, r.pf, r.tax, r.advanceDeduct, r.otherDeduct, r.totalDeductions, r.netPay].join(',') + '\n';
      });
    }
  } else if (type === 'input') {
    csv += 'ลำดับ,รหัส,ชื่อ-นามสกุล,ชื่อเล่น,เงินเดือนฐาน,ขาดงานวัน,ลากิจวัน,ลาป่วยวัน,หักสายบาท,OTชม,อัตราOT,เบี้ยขยัน,โบนัส,กองทุนPF,ประกันสังคม,ภาษี,หักเงินเบิก,หักอื่นๆ\n';
    State.inputRecords.forEach(function(i) {
      var nick = i.nickname || getEmpNickname(i.empId) || '';
      csv += [i.no, i.empId, '"' + (i.empName || '').replace(/"/g, '""') + '"', '"' + nick.replace(/"/g, '""') + '"', i.baseSalary, i.absentDays, i.leaveDays, i.sickLeaveDays, i.lateDeduct, i.otHours, i.otRate, i.allowance, i.bonus, i.pfAmount, i.sso, i.tax, i.advanceDeduct, i.otherDeduct].join(',') + '\n';
    });
  } else if (type === 'employees') {
    var isUserRole = (State.currentUser && State.currentUser.role === 'User');
    var activeStaffList = (State.employees || []).filter(function(e) { return (e.status || '') !== 'Resigned'; });
    if (isUserRole) {
      csv += 'รหัส,ชื่อ-นามสกุล,ชื่อเล่น,วันเกิด,อายุ,บัตรประชาชน,เบอร์โทร,ที่อยู่,แผนก,ตำแหน่ง,ธนาคาร,เลขบัญชี,วันเริ่มงาน\n';
      activeStaffList.forEach(function(e) {
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
      activeStaffList.forEach(function(e) {
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
  } else if (type === 'resigned') {
    filename = 'PTN_resigned_employees_' + (new Date().toISOString().substring(0, 10)) + '.csv';
    csv += 'รหัส,ชื่อ-นามสกุล,ชื่อเล่น,แผนก,ตำแหน่ง,วันเริ่มงาน,วันที่ลาออก,อายุงานรวม,ธนาคาร,เลขบัญชี,เบอร์โทร,สาเหตุ_หมายเหตุ\n';
    (State.employees || []).filter(function(e) { return (e.status || '') === 'Resigned'; }).forEach(function(e) {
      csv += [
        e.empId,
        '"' + (e.fullName || '').replace(/"/g, '""') + '"',
        '"' + (e.nickname || '').replace(/"/g, '""') + '"',
        '"' + (e.department || '').replace(/"/g, '""') + '"',
        '"' + (e.position || '').replace(/"/g, '""') + '"',
        e.joinDate || '',
        e.resignDate || '',
        '"' + (calculateTenureString(e.joinDate, e.resignDate) || '').replace(/"/g, '""') + '"',
        '"' + (e.bankName || '').replace(/"/g, '""') + '"',
        '"' + (e.bankAccount || '').replace(/"/g, '""') + '"',
        '"' + (e.phone || '').replace(/"/g, '""') + '"',
        '"' + (e.remark || '').replace(/"/g, '""') + '"'
      ].join(',') + '\n';
    });
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
  updateBirthDateThaiHint();
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
    var empNick = r.nickname || emp.nickname || getEmpNickname(r.empId);
    var nickHtml = empNick ? (' <span style="font-weight:600;color:#1e40af">(' + esc(empNick) + ')</span>') : '';
    var bankInfo = (r.bankName || emp.bankName || '-') + ' ' + (r.bankAccount || emp.bankAccount || '-');

    h += '<tr style="border-bottom:1px solid #e2e8f0">' +
      '<td style="padding:4px 3px;text-align:center">' + (idx + 1) + '</td>' +
      '<td style="padding:4px 3px;font-family:monospace;font-weight:700">' + esc(r.empId) + '</td>' +
      '<td style="padding:4px 3px;font-weight:700">' + esc(r.name) + nickHtml + '</td>' +
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
  preparePayrollSummaryPrintContainer();
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
