/**
 * ==============================================================================
 * PTN Payroll - Documents, Statutory Compliance, TTB Bank & History Module
 * ==============================================================================
 */

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

var histPeriodSortOrder = 'asc';

function getPeriodSortKey(period) {
  if (!period) return 0;
  var p = String(period).trim();

  // 1. Check Thai full month names
  var thaiMonths = [
    'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
  ];
  var mIdx = -1;
  for (var i = 0; i < thaiMonths.length; i++) {
    if (p.indexOf(thaiMonths[i]) >= 0) {
      mIdx = i + 1;
      break;
    }
  }

  // 2. Check Thai abbreviated month names
  if (mIdx < 0) {
    var thaiShort = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    for (var j = 0; j < thaiShort.length; j++) {
      if (p.indexOf(thaiShort[j]) >= 0) {
        mIdx = j + 1;
        break;
      }
    }
  }

  // 3. Check ISO YYYY-MM
  var iso = p.match(/^(\d{4})[-/](\d{1,2})/);
  if (iso) {
    var iy = parseInt(iso[1], 10);
    if (iy > 2400) iy -= 543;
    var im = parseInt(iso[2], 10);
    return iy * 100 + im;
  }

  // 4. Extract year from Thai period (e.g. "สิงหาคม 2569")
  var yMatch = p.match(/\d{4}/);
  var yr = yMatch ? parseInt(yMatch[0], 10) : 0;
  if (yr > 2400) yr -= 543;

  if (yr > 0 && mIdx > 0) {
    return yr * 100 + mIdx;
  }
  if (mIdx > 0) return mIdx;
  return 0;
}

function toggleHistoryPeriodSort() {
  histPeriodSortOrder = (histPeriodSortOrder === 'asc') ? 'desc' : 'asc';
  var icon = document.getElementById('histPeriodSortIcon');
  if (icon) icon.textContent = (histPeriodSortOrder === 'asc') ? '▲' : '▼';
  if (currentHistoryList && currentHistoryList.length > 0) {
    currentHistoryList.sort(function(a, b) {
      var diff = getPeriodSortKey(a.period) - getPeriodSortKey(b.period);
      return histPeriodSortOrder === 'desc' ? -diff : diff;
    });
    filterHistoryTable();
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
          return periodMatchesYear(h.period, yr);
        });
      }

      // Sort chronologically by month
      currentHistoryList.sort(function(a, b) {
        var diff = getPeriodSortKey(a.period) - getPeriodSortKey(b.period);
        return histPeriodSortOrder === 'desc' ? -diff : diff;
      });

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
      if (document.getElementById('histEmpTenureText')) document.getElementById('histEmpTenureText').innerHTML = '<i class="fa-solid fa-calendar-check" style="color:#94a3b8;margin-right:4px"></i> เริ่มงาน: ' + esc(formatDateThaiBE(emp.joinDate));
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
// ------------------------------------------------------------------------------
// SALARY & EMPLOYMENT CERTIFICATE CONTROLLER
// ------------------------------------------------------------------------------
function openSalaryCertificateModal(targetEmpId) {
  if (!hasPermission('view_salary') && !hasPermission('view_documents') && !hasPermission('all') && !isSuperAdmin()) {
    showToast('คุณไม่มีสิทธิ์ออกหนังสือรับรองเงินเดือนและการทำงาน', 'warning');
    return;
  }

  var sel = document.getElementById('docCertEmpSelect');
  if (targetEmpId && sel) {
    var foundOpt = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === targetEmpId) {
        foundOpt = true;
        break;
      }
    }
    if (!foundOpt) {
      var foundEmp = (State.employees || []).find(function(e) { return e.empId === targetEmpId; });
      if (foundEmp) {
        var opt = document.createElement('option');
        opt.value = foundEmp.empId;
        opt.textContent = foundEmp.empId + ' - ' + foundEmp.fullName + (foundEmp.status === 'Resigned' ? ' [พ้นสภาพ/ลาออก]' : '');
        sel.appendChild(opt);
      }
    }
    sel.value = targetEmpId;
  }

  var empId = targetEmpId || (sel ? sel.value : (State.employees && State.employees[0] ? State.employees[0].empId : ''));
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
  if (dateInput) {
    var todayThaiStr = formatDateThaiBE(new Date().toISOString().substring(0, 10));
    dateInput.value = curDate || todayThaiStr;
  }

  renderCertModalPaper(empId);
  openModal('salaryCertModal');
}

function renderCertModalPaper(targetEmpId) {
  var paper = document.getElementById('salaryCertPaper');
  if (!paper) return;

  var sel = document.getElementById('docCertEmpSelect');
  var empId = targetEmpId || (sel ? sel.value : '');
  var emp = (State.employees || []).find(function(e) { return e.empId === empId; }) || {};

  var purpose = document.getElementById('docCertPurpose') ? document.getElementById('docCertPurpose').value : 'loan';
  var lang = document.getElementById('docCertLang') ? document.getElementById('docCertLang').value : 'TH';
  var certDate = (document.getElementById('modalCertDate') && document.getElementById('modalCertDate').value) ? document.getElementById('modalCertDate').value : (document.getElementById('docCertDate') ? document.getElementById('docCertDate').value : formatDateThaiBE(new Date().toISOString().substring(0, 10)));
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

  var isResigned = (String(emp.status || '').trim().toUpperCase() === 'RESIGNED');

  // Tenure and Start Date calculation (supports joinDate / join_date / startDate in YYYY-MM-DD or DD/MM/YYYY)
  var startRaw = String(emp.joinDate || emp.startDate || emp.join_date || '').trim();
  var tenureText = '';
  var tenureTextEn = '';
  var startDateDisplay = '-';
  var startDateDisplayEn = '-';
  var resignDateDisplay = emp.resignDate ? formatDateThaiBE(emp.resignDate) : '';

  if (startRaw && startRaw !== '-') {
    var sYear = null, sMonth = null, sDay = null;
    if (startRaw.indexOf('-') > 0) {
      var p = startRaw.substring(0, 10).split('-');
      if (p.length === 3) {
        sYear = parseInt(p[0], 10);
        sMonth = parseInt(p[1], 10);
        sDay = parseInt(p[2], 10);
      }
    } else if (startRaw.indexOf('/') > 0) {
      var p = startRaw.split('/');
      if (p.length === 3) {
        sDay = parseInt(p[0], 10);
        sMonth = parseInt(p[1], 10);
        sYear = parseInt(p[2], 10);
      }
    }

    if (sYear && sMonth && sDay && !isNaN(sYear) && !isNaN(sMonth) && !isNaN(sDay)) {
      var ceYear = sYear > 2400 ? (sYear - 543) : sYear;
      var beYear = sYear < 2400 ? (sYear + 543) : sYear;

      var thaiMonthsFull = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
      var enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var mIdx = Math.max(0, Math.min(11, sMonth - 1));

      startDateDisplay = sDay + ' ' + (thaiMonthsFull[mIdx] || '') + ' พ.ศ. ' + beYear;
      startDateDisplayEn = (enMonths[mIdx] || '') + ' ' + sDay + ', ' + ceYear;

      if (isResigned && emp.resignDate) {
        tenureText = calculateTenureString(emp.joinDate, emp.resignDate);
        tenureTextEn = tenureText.replace(/ปี/g, 'year(s)').replace(/เดือน/g, 'month(s)').replace(/วัน/g, 'day(s)');
      } else {
        try {
          var sDate = new Date(ceYear, sMonth - 1, sDay);
          var now = new Date();
          var diffYears = now.getFullYear() - sDate.getFullYear();
          var diffMonths = now.getMonth() - sDate.getMonth();
          if (now.getDate() < sDate.getDate()) {
            diffMonths--;
          }
          if (diffMonths < 0) { diffYears--; diffMonths += 12; }
          if (diffYears > 0 && diffMonths > 0) {
            tenureText = diffYears + ' ปี ' + diffMonths + ' เดือน';
            tenureTextEn = diffYears + ' year(s) ' + diffMonths + ' month(s)';
          } else if (diffYears > 0) {
            tenureText = diffYears + ' ปี';
            tenureTextEn = diffYears + ' year(s)';
          } else {
            var mOnly = Math.max(1, diffMonths);
            tenureText = mOnly + ' เดือน';
            tenureTextEn = mOnly + ' month(s)';
          }
        } catch(ex) {
          tenureText = '';
          tenureTextEn = '';
        }
      }
    } else {
      startDateDisplay = startRaw;
      startDateDisplayEn = startRaw;
    }
  }

  var h = '';

  if (lang === 'EN') {
    // ENGLISH VERSION
    var purposeStrEn = 'applying for financial credit / personal loan';
    if (purpose === 'visa') purposeStrEn = 'applying for a visa to travel abroad';
    else if (purpose === 'general') purposeStrEn = 'general employment and income verification';

    var docNoEn = 'PTN-HR-' + String(new Date().getMonth() + 1).padStart(2,'0') + String(new Date().getDate()).padStart(2,'0') + '/' + new Date().getFullYear();
    var certTitleEn = isResigned ? 'CERTIFICATE OF EMPLOYMENT &amp; SERVICE' : 'SALARY &amp; EMPLOYMENT VERIFICATION LETTER';

    var bodyParagraphsEn = '';
    if (isResigned) {
      bodyParagraphsEn = '<p style="text-indent:2.5rem;margin-bottom:16px">' +
        'This letter is officially issued to certify that <strong>' + esc(emp.fullName || '-') + '</strong>, ' +
        'Identification / Citizen Card No. <strong style="font-family:monospace">' + esc(emp.citizenId || '-') + '</strong>, ' +
        'was formerly employed as a regular employee of <strong>' + esc(compName) + '</strong>, ' +
        'having served with the company from <strong>' + esc(startDateDisplayEn) + '</strong> ' +
        (emp.resignDate ? 'to <strong>' + esc(formatDateThaiBE(emp.resignDate)) + '</strong> ' : '') +
        (tenureTextEn ? '(with continuous service of <strong>' + esc(tenureTextEn) + '</strong>). ' : '') +
      '</p>' +
      '<p style="text-indent:2.5rem;margin-bottom:16px">' +
        'During the employment, ' + esc(emp.fullName || '-') + ' held the position of <strong>' + esc(emp.position || '-') + '</strong> ' +
        'in the <strong>' + esc(emp.department || '-') + ' Department</strong>, ' +
        'earning a final basic monthly salary of <strong style="font-family:monospace;font-size:14px">THB ' + fmt(baseSal) + '</strong>.' +
      '</p>' +
      '<p style="text-indent:2.5rem;margin-bottom:24px">' +
        'During the tenure, the employee has performed duties satisfactorily and has officially separated from employment. This certificate is issued upon the request of the employee for the purpose of <strong>' + esc(purposeStrEn) + '</strong>.' +
      '</p>';
    } else {
      bodyParagraphsEn = '<p style="text-indent:2.5rem;margin-bottom:16px">' +
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
      '</p>';
    }

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
      '<h2 contenteditable="true" spellcheck="false" title="คลิกเพื่อแก้ไขหัวข้อ" style="font-size:18px;font-weight:800;color:#0f172a;letter-spacing:1px;text-transform:uppercase;margin:0">' + certTitleEn + '</h2>' +
    '</div>' +

    '<div id="certPaperBody" contenteditable="true" spellcheck="false" title="คลิกเพื่อแก้ไขข้อความได้โดยตรง" style="font-size:13.5px;text-align:justify;line-height:2;color:#1e293b">' +
      bodyParagraphsEn +
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
    var certTitleTh = isResigned ? 'หนังสือรับรองการทำงาน / ผ่านงาน' : 'หนังสือรับรองเงินเดือนและการทำงาน';

    var bodyParagraphsTh = '';
    if (isResigned) {
      bodyParagraphsTh = '<p style="text-indent:2.8rem;margin-bottom:16px">' +
        'หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า <strong>' + esc(emp.fullName || '-') + '</strong> ' +
        'เลขประจำตัวประชาชน <strong style="font-family:monospace">' + esc(emp.citizenId || '-') + '</strong> ' +
        'เคยเป็นพนักงานของ <strong>' + esc(compName) + '</strong> จริง ' +
        'โดยได้เริ่มเข้าปฏิบัติงานตั้งแต่วันที่ <strong>' + esc(startDateDisplay) + '</strong> ' +
        (resignDateDisplay ? 'จนถึงวันที่ <strong>' + esc(resignDateDisplay) + '</strong> ' : '') +
        (tenureText ? 'รวมระยะเวลาการปฏิบัติงานทั้งสิ้น <strong>' + esc(tenureText) + '</strong> ' : '') +
        'ในตำแหน่งสุดท้ายคือ <strong>' + esc(emp.position || '-') + '</strong> ' +
        'สังกัดฝ่าย/แผนก <strong>' + esc(emp.department || '-') + '</strong>' +
      '</p>' +
      '<p style="text-indent:2.8rem;margin-bottom:16px">' +
        'โดยในระหว่างปฏิบัติงานได้รับเงินเดือนอัตราสุดท้ายเดือนละ <strong style="font-family:monospace;font-size:15px">' + fmt(baseSal) + '</strong> บาท ' +
        '(<strong style="color:#0f172a">' + bahtText(baseSal) + '</strong>)' +
      '</p>' +
      '<p style="text-indent:2.8rem;margin-bottom:24px">' +
        'ตลอดระยะเวลาที่ปฏิบัติงานกับบริษัทฯ พนักงานได้ปฏิบัติหน้าที่ด้วยความตั้งใจ ซื่อสัตย์สุจริต และได้พ้นสภาพการเป็นพนักงานด้วยความเรียบร้อย บริษัทฯ จึงออกหนังสือรับรองฉบับนี้ให้ไว้ตามความประสงค์ของพนักงาน เพื่อใช้เป็นหลักฐานประกอบการ <strong>' + esc(purposeStrTh) + '</strong>' +
      '</p>';
    } else {
      bodyParagraphsTh = '<p style="text-indent:2.8rem;margin-bottom:16px">' +
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
      '</p>';
    }

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
      '<h2 contenteditable="true" spellcheck="false" title="คลิกเพื่อแก้ไขหัวข้อ" style="font-size:19px;font-weight:800;color:#0f172a;letter-spacing:1px;margin:0">' + certTitleTh + '</h2>' +
    '</div>' +

    '<div id="certPaperBody" contenteditable="true" spellcheck="false" title="คลิกเพื่อแก้ไขข้อความได้โดยตรง" style="font-size:14px;text-align:justify;line-height:2.1;color:#1e293b">' +
      bodyParagraphsTh +
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

// ==============================================================================
// SHARED HELPERS FOR EMPLOYMENT CONTRACT & RESIGNATION LETTER
// ==============================================================================
function getDocCenterSelectedEmployee(targetEmpId) {
  if (!hasPermission('view_salary') && !hasPermission('view_documents') && !hasPermission('all') && !isSuperAdmin()) {
    showToast('คุณไม่มีสิทธิ์ออกเอกสารบุคคล', 'warning');
    return null;
  }
  var sel = document.getElementById('docCertEmpSelect');
  if (targetEmpId && sel) {
    sel.value = targetEmpId;
  }
  var empId = targetEmpId || (sel ? sel.value : (State.employees && State.employees[0] ? State.employees[0].empId : ''));
  if (!empId) {
    showToast('กรุณาเลือกพนักงานก่อนสร้างเอกสาร', 'warning');
    return null;
  }
  var emp = (State.employees || []).find(function(e) { return e.empId === empId; });
  if (!emp) {
    showToast('ไม่พบข้อมูลพนักงานรหัส ' + empId, 'error');
    return null;
  }
  return { empId: empId, emp: emp };
}

function formatDocThaiFullDate(isoStr) {
  if (!isoStr) return '....................';
  var s = String(isoStr).trim().substring(0, 10);
  var p = s.split('-');
  if (p.length !== 3) return isoStr;
  var y = parseInt(p[0], 10);
  var m = parseInt(p[1], 10);
  var d = parseInt(p[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return isoStr;
  var thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  var beYear = y < 2400 ? y + 543 : y;
  return d + ' ' + (thaiMonths[m - 1] || '') + ' ' + beYear;
}

function printDocCenterModal(printClass) {
  clearAllPrintClasses();
  document.body.classList.add(printClass);
  setTimeout(function() {
    window.print();
    setTimeout(clearAllPrintClasses, 1500);
  }, 100);
}

// ==============================================================================
// EMPLOYMENT CONTRACT CONTROLLER (A4 EDITABLE)
// ==============================================================================
function openEmploymentContractModal(targetEmpId) {
  var picked = getDocCenterSelectedEmployee(targetEmpId);
  if (!picked) return;
  var emp = picked.emp;

  var typeSel = document.getElementById('modalContractType');
  if (typeSel) typeSel.value = 'PROBATION';

  var startInput = document.getElementById('modalContractStartDate');
  var todayIso = new Date().toISOString().substring(0, 10);
  if (startInput) startInput.value = emp.joinDate ? String(emp.joinDate).substring(0, 10) : todayIso;

  var probInput = document.getElementById('modalContractProbDays');
  if (probInput) probInput.value = Number(emp.probationDays) || 119;

  var endInput = document.getElementById('modalContractEndDate');
  if (endInput && !endInput.value) {
    var baseD = new Date((startInput && startInput.value ? startInput.value : todayIso) + 'T00:00:00');
    baseD.setFullYear(baseD.getFullYear() + 1);
    baseD.setDate(baseD.getDate() - 1);
    endInput.value = baseD.toISOString().substring(0, 10);
  }

  var dateInput = document.getElementById('modalContractDate');
  if (dateInput) dateInput.value = formatDocThaiFullDate(todayIso);

  var signName = document.getElementById('modalContractSignName');
  var signTitle = document.getElementById('modalContractSignTitle');
  if (signName) signName.value = State.company.signatoryName || 'นางสาวประภัสสร เกียรติดำรง';
  if (signTitle) signTitle.value = State.company.signatoryTitle || 'ผู้จัดการฝ่ายทรัพยากรบุคคล';

  onContractParamChanged();
  openModal('employmentContractModal');
}

function onContractParamChanged() {
  var cType = document.getElementById('modalContractType') ? document.getElementById('modalContractType').value : 'PROBATION';
  var probGrp = document.getElementById('contractProbDaysGroup');
  var endGrp = document.getElementById('contractEndDateGroup');
  if (probGrp) probGrp.style.display = (cType === 'PROBATION') ? 'flex' : 'none';
  if (endGrp) endGrp.style.display = (cType === 'FIXED_TERM') ? 'flex' : 'none';
  renderContractModalPaper();
}

function renderContractModalPaper(targetEmpId) {
  var paper = document.getElementById('contractPaper');
  if (!paper) return;
  var picked = getDocCenterSelectedEmployee(targetEmpId);
  if (!picked) return;
  var emp = picked.emp;

  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  var compAddress = State.company.address || '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110';
  var compTaxId = State.company.taxId || '0105559876543';
  var compPhone = State.company.phone || '02-123-4567';

  var cType = document.getElementById('modalContractType') ? document.getElementById('modalContractType').value : 'PROBATION';
  var startIso = document.getElementById('modalContractStartDate') ? document.getElementById('modalContractStartDate').value : (emp.joinDate || '');
  var probDays = Number(document.getElementById('modalContractProbDays') ? document.getElementById('modalContractProbDays').value : (emp.probationDays || 119)) || 119;
  var endIso = document.getElementById('modalContractEndDate') ? document.getElementById('modalContractEndDate').value : '';
  var contractDateStr = (document.getElementById('modalContractDate') && document.getElementById('modalContractDate').value) ? document.getElementById('modalContractDate').value : formatDocThaiFullDate(new Date().toISOString().substring(0, 10));
  var signName = (document.getElementById('modalContractSignName') && document.getElementById('modalContractSignName').value) ? document.getElementById('modalContractSignName').value : (State.company.signatoryName || 'นางสาวประภัสสร เกียรติดำรง');
  var signTitle = (document.getElementById('modalContractSignTitle') && document.getElementById('modalContractSignTitle').value) ? document.getElementById('modalContractSignTitle').value : (State.company.signatoryTitle || 'ผู้จัดการฝ่ายทรัพยากรบุคคล');

  var branch = (State.branches || []).find(function(b) { return b.branch_id === emp.branchId; }) || {};
  var branchLabel = branch.branch_name ? (branch.branch_name + ' (' + (emp.branchId || 'B01') + ')') : (emp.branchId || 'สำนักงานใหญ่');
  var workStart = branch.work_start_time || '09:30';
  var workEnd = branch.work_end_time || '19:00';

  var startTh = formatDocThaiFullDate(startIso);
  var endTh = formatDocThaiFullDate(endIso);
  var probEndIso = '';
  if (startIso && probDays > 0) {
    var dProb = new Date(startIso + 'T00:00:00');
    if (!isNaN(dProb.getTime())) {
      dProb.setDate(dProb.getDate() + probDays);
      probEndIso = dProb.toISOString().substring(0, 10);
    }
  }
  var probEndTh = formatDocThaiFullDate(probEndIso);

  var baseSal = Number(emp.baseSalary) || 0;
  var salaryText = baseSal > 0 ? ('เดือนละ ' + fmt(baseSal) + ' บาท') : 'ตามอัตราที่ตกลงกัน';

  var titleText = (cType === 'FIXED_TERM')
    ? 'สัญญาจ้างแรงงาน (แบบมีกำหนดระยะเวลา)'
    : 'หนังสือสัญญาการจ้างงาน';

  var clause2Html = (cType === 'FIXED_TERM')
    ? '<p style="margin:6px 0"><strong>ข้อ 2. ระยะเวลาการจ้าง:</strong> สัญญานี้มีกำหนดระยะเวลาตั้งแต่วันที่ <strong>' + esc(startTh) + '</strong> ถึงวันที่ <strong>' + esc(endTh) + '</strong> เว้นแต่คู่สัญญาจะตกลงต่ออายุสัญญาเป็นลายลักษณ์อักษร</p>'
    : '<p style="margin:6px 0"><strong>ข้อ 2. วันเริ่มงานและการทดลองงาน:</strong> ลูกจ้างตกลงเข้าเริ่มปฏิบัติงานตั้งแต่วันที่ <strong>' + esc(startTh) + '</strong> โดยมีระยะเวลาทดลองงาน <strong>' + probDays + ' วัน</strong> (ถึงวันที่ <strong>' + esc(probEndTh) + '</strong>) หากผ่านเกณฑ์การประเมินของบริษัทจะปรับสถานะเป็นพนักงานประจำต่อไป</p>';

  paper.innerHTML = '' +
    '<div style="text-align:center;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:18px">' +
      '<div style="font-size:18px;font-weight:800;color:#0f172a">' + esc(compName) + '</div>' +
      '<div style="font-size:11px;color:#475569;margin-top:3px">เลขประจำตัวผู้เสียภาษีอากร: <strong style="font-family:monospace">' + esc(compTaxId) + '</strong> | โทรศัพท์: ' + esc(compPhone) + '</div>' +
      '<div style="font-size:11px;color:#64748b">' + esc(compAddress) + '</div>' +
    '</div>' +
    '<div style="text-align:center;margin:14px 0 18px">' +
      '<h2 contenteditable="true" spellcheck="false" style="font-size:18px;font-weight:800;color:#0f172a;margin:0">' + titleText + '</h2>' +
    '</div>' +
    '<div id="contractPaperBody" contenteditable="true" spellcheck="false" style="font-size:13px;line-height:1.85;color:#1e293b;text-align:justify">' +
      '<p style="text-align:right;margin:0 0 12px">ทำที่ <strong>' + esc(compName) + '</strong><br>วันที่ <strong>' + esc(contractDateStr) + '</strong></p>' +
      '<p style="margin:6px 0">สัญญาฉบับนี้ทำขึ้นระหว่าง <strong>' + esc(compName) + '</strong> สำนักงานตั้งอยู่เลขที่ ' + esc(compAddress) + ' โดย <strong>' + esc(signName) + '</strong> ตำแหน่ง ' + esc(signTitle) + ' ผู้มีอำนาจลงนาม ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"นายจ้าง"</strong> ฝ่ายหนึ่ง กับ</p>' +
      '<p style="margin:6px 0;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">' +
        '<strong>' + esc(emp.fullName) + '</strong> (รหัสพนักงาน: <strong style="font-family:monospace">' + esc(emp.empId) + '</strong>)<br>' +
        'เลขประจำตัวประชาชน: <strong style="font-family:monospace">' + esc(emp.citizenId || '-') + '</strong> | โทรศัพท์: ' + esc(emp.phone || '-') + '<br>' +
        'ที่อยู่: ' + esc(emp.address || '-') + ' ซึ่งต่อไปในสัญญานี้เรียกว่า <strong>"ลูกจ้าง"</strong> อีกฝ่ายหนึ่ง' +
      '</p>' +
      '<p style="margin:8px 0">คู่สัญญาทั้งสองฝ่ายตกลงทำสัญญากันโดยมีข้อความดังต่อไปนี้</p>' +
      '<p style="margin:6px 0"><strong>ข้อ 1. ตำแหน่งและสถานที่ปฏิบัติงาน:</strong> นายจ้างตกลงจ้างลูกจ้างในตำแหน่ง <strong>' + esc(emp.position || '-') + '</strong> แผนก <strong>' + esc(emp.department || '-') + '</strong> ประจำสาขา <strong>' + esc(branchLabel) + '</strong> โดยลูกจ้างยินยอมปฏิบัติงานตามสถานที่หรือสาขาที่นายจ้างมอบหมายตามความเหมาะสม</p>' +
      clause2Html +
      '<p style="margin:6px 0"><strong>ข้อ 3. ค่าจ้างและการจ่ายเงิน:</strong> นายจ้างตกลงจ่ายค่าจ้างให้แก่ลูกจ้างในอัตรา <strong>' + esc(salaryText) + '</strong> โดยจะจ่ายเป็นรายเดือนผ่านบัญชีธนาคาร ' + esc(emp.bankName || '-') + ' เลขที่บัญชี ' + esc(emp.bankAccount || '-') + ' และหักภาษี ณ ที่จ่าย ประกันสังคม หรือเงินสมทบกองทุนตามเงื่อนไขและกฎหมายที่กำหนด</p>' +
      '<p style="margin:6px 0"><strong>ข้อ 4. เวลาทำงานปกติ:</strong> ลูกจ้างต้องปฏิบัติงานตามเวลาทำการของสาขา คือเวลา <strong>' + esc(workStart) + ' น. ถึง ' + esc(workEnd) + ' น.</strong> (พักระหว่างวัน 1 ชั่วโมง) และมีวันหยุดประจำสัปดาห์/วันหยุดตามประกาศบริษัท</p>' +
      '<p style="margin:6px 0"><strong>ข้อ 5. วินัยและการรักษาความลับ:</strong> ลูกจ้างตกลงปฏิบัติตามระเบียบข้อบังคับเกี่ยวกับการทำงานของบริษัทอย่างเคร่งครัด และจะเก็บรักษาข้อมูลทางธุรกิจ สูตรยา ข้อมูลลูกค้า และค่าตอบแทนของบริษัทไว้เป็นความลับ</p>' +
      '<p style="margin:6px 0"><strong>ข้อ 6. การเลิกสัญญา:</strong> หากฝ่ายใดฝ่ายหนึ่งประสงค์จะบอกเลิกสัญญา ให้บอกกล่าวล่วงหน้าเป็นลายลักษณ์อักษรไม่น้อยกว่า 1 งวดการจ่ายค่าจ้าง หรือตามที่กฎหมายแรงงานกำหนด</p>' +
      '<p style="margin:10px 0 18px">สัญญานี้ทำขึ้นเป็นสองฉบับมีข้อความถูกต้องตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงลงลายมือชื่อไว้เป็นหลักฐานต่อหน้าพยาน</p>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:26px;font-size:12.5px;page-break-inside:avoid">' +
      '<div style="text-align:center">' +
        '<div style="height:44px;border-bottom:1px solid #475569;margin-bottom:6px"></div>' +
        '<div contenteditable="true" spellcheck="false">ลงชื่อ <strong>( ' + esc(signName) + ' )</strong></div>' +
        '<div style="font-size:11.5px;color:#475569" contenteditable="true" spellcheck="false">นายจ้าง / ' + esc(signTitle) + '</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<div style="height:44px;border-bottom:1px solid #475569;margin-bottom:6px"></div>' +
        '<div contenteditable="true" spellcheck="false">ลงชื่อ <strong>( ' + esc(emp.fullName) + ' )</strong></div>' +
        '<div style="font-size:11.5px;color:#475569">ลูกจ้าง / ผู้รับจ้าง</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<div style="height:36px;border-bottom:1px dashed #94a3b8;margin-bottom:6px"></div>' +
        '<div contenteditable="true" spellcheck="false">ลงชื่อ ( ................................................ ) พยาน</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<div style="height:36px;border-bottom:1px dashed #94a3b8;margin-bottom:6px"></div>' +
        '<div contenteditable="true" spellcheck="false">ลงชื่อ ( ................................................ ) พยาน</div>' +
      '</div>' +
    '</div>';
}

function resetContractModalPaper() {
  if (!confirm('ต้องการคืนค่าข้อความสัญญาจ้างกลับเป็นค่าเริ่มต้นใช่หรือไม่?')) return;
  renderContractModalPaper();
  showToast('คืนค่าข้อความสัญญาจ้างเรียบร้อยแล้ว', 'info');
}

function printEmploymentContract() {
  printDocCenterModal('printing-employment-contract');
}

// ==============================================================================
// RESIGNATION LETTER CONTROLLER (A4 EDITABLE)
// ==============================================================================
function openResignationLetterModal(targetEmpId) {
  var picked = getDocCenterSelectedEmployee(targetEmpId);
  if (!picked) return;
  var emp = picked.emp;

  var todayIso = new Date().toISOString().substring(0, 10);
  var subInput = document.getElementById('modalResignSubmitDate');
  if (subInput) subInput.value = todayIso;

  var effInput = document.getElementById('modalResignEffectiveDate');
  if (effInput) effInput.value = emp.resignDate ? String(emp.resignDate).substring(0, 10) : todayIso;

  var reasonInput = document.getElementById('modalResignReason');
  if (reasonInput && !reasonInput.value) reasonInput.value = 'ภารกิจส่วนตัว / มีความจำเป็นส่วนตัว';

  var signName = document.getElementById('modalResignSignName');
  var signTitle = document.getElementById('modalResignSignTitle');
  if (signName) signName.value = State.company.signatoryName || 'นางสาวประภัสสร เกียรติดำรง';
  if (signTitle) signTitle.value = State.company.signatoryTitle || 'ผู้จัดการฝ่ายทรัพยากรบุคคล';

  renderResignationModalPaper();
  openModal('resignationLetterModal');
}

function onResignationParamChanged() {
  renderResignationModalPaper();
}

function renderResignationModalPaper(targetEmpId) {
  var paper = document.getElementById('resignationPaper');
  if (!paper) return;
  var picked = getDocCenterSelectedEmployee(targetEmpId);
  if (!picked) return;
  var emp = picked.emp;

  var compName = State.company.companyName || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
  var compAddress = State.company.address || '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110';
  var compPhone = State.company.phone || '02-123-4567';

  var subIso = document.getElementById('modalResignSubmitDate') ? document.getElementById('modalResignSubmitDate').value : '';
  var effIso = document.getElementById('modalResignEffectiveDate') ? document.getElementById('modalResignEffectiveDate').value : (emp.resignDate || '');
  var reasonText = (document.getElementById('modalResignReason') && document.getElementById('modalResignReason').value.trim()) ? document.getElementById('modalResignReason').value.trim() : 'ภารกิจส่วนตัว';
  var signName = (document.getElementById('modalResignSignName') && document.getElementById('modalResignSignName').value) ? document.getElementById('modalResignSignName').value : (State.company.signatoryName || 'นางสาวประภัสสร เกียรติดำรง');
  var signTitle = (document.getElementById('modalResignSignTitle') && document.getElementById('modalResignSignTitle').value) ? document.getElementById('modalResignSignTitle').value : (State.company.signatoryTitle || 'ผู้จัดการฝ่ายทรัพยากรบุคคล');

  var branch = (State.branches || []).find(function(b) { return b.branch_id === emp.branchId; }) || {};
  var branchLabel = branch.branch_name ? branch.branch_name : (emp.branchId || 'สำนักงานใหญ่');

  var subTh = formatDocThaiFullDate(subIso);
  var effTh = formatDocThaiFullDate(effIso);
  var joinTh = emp.joinDate ? formatDocThaiFullDate(emp.joinDate) : '-';

  paper.innerHTML = '' +
    '<div style="text-align:center;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:18px">' +
      '<div style="font-size:18px;font-weight:800;color:#0f172a">' + esc(compName) + '</div>' +
      '<div style="font-size:11px;color:#64748b;margin-top:2px">' + esc(compAddress) + ' | โทร: ' + esc(compPhone) + '</div>' +
    '</div>' +
    '<div style="text-align:center;margin:14px 0 20px">' +
      '<h2 contenteditable="true" spellcheck="false" style="font-size:18px;font-weight:800;color:#0f172a;margin:0">หนังสือขอลาออกจากการเป็นพนักงาน</h2>' +
    '</div>' +
    '<div id="resignationPaperBody" contenteditable="true" spellcheck="false" style="font-size:13.5px;line-height:1.95;color:#1e293b;text-align:justify">' +
      '<p style="text-align:right;margin:0 0 14px">เขียนที่ <strong>' + esc(compName) + '</strong><br>วันที่ <strong>' + esc(subTh) + '</strong></p>' +
      '<p style="margin:6px 0"><strong>เรื่อง:</strong> ขอลาออกจากการเป็นพนักงาน</p>' +
      '<p style="margin:6px 0 14px"><strong>เรียน:</strong> ' + esc(signTitle) + ' / กรรมการผู้จัดการ ' + esc(compName) + '</p>' +
      '<p style="text-indent:2.5rem;margin:8px 0">' +
        'ข้าพเจ้า <strong>' + esc(emp.fullName) + '</strong> (รหัสพนักงาน <strong style="font-family:monospace">' + esc(emp.empId) + '</strong>) ' +
        'เลขประจำตัวประชาชน <strong style="font-family:monospace">' + esc(emp.citizenId || '-') + '</strong> ' +
        'ตำแหน่ง <strong>' + esc(emp.position || '-') + '</strong> แผนก <strong>' + esc(emp.department || '-') + '</strong> ประจำสาขา <strong>' + esc(branchLabel) + '</strong> ' +
        '(เริ่มปฏิบัติงานเมื่อวันที่ ' + esc(joinTh) + ')' +
      '</p>' +
      '<p style="text-indent:2.5rem;margin:8px 0">' +
        'มีความประสงค์ขอลาออกจากการเป็นพนักงานของ <strong>' + esc(compName) + '</strong> เนื่องจาก <strong>' + esc(reasonText) + '</strong> ' +
        'โดยขอให้มีผลตั้งแต่วันทำงานวันสุดท้ายคือวันที่ <strong>' + esc(effTh) + '</strong> เป็นต้นไป' +
      '</p>' +
      '<p style="text-indent:2.5rem;margin:8px 0 18px">' +
        'ทั้งนี้ ข้าพเจ้ายินดีส่งมอบงานที่รับผิดชอบ เอกสาร และทรัพย์สินทั้งหมดของบริษัทให้เรียบร้อยก่อนวันพ้นสภาพ จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ' +
      '</p>' +
    '</div>' +
    '<div style="display:flex;justify-content:flex-end;margin:16px 0 24px;page-break-inside:avoid">' +
      '<div style="text-align:center;min-width:250px;font-size:13px">' +
        '<div style="margin-bottom:6px">ขอแสดงความนับถือ</div>' +
        '<div style="height:44px;border-bottom:1px solid #475569;margin-bottom:6px"></div>' +
        '<div contenteditable="true" spellcheck="false">( <strong>' + esc(emp.fullName) + '</strong> )</div>' +
        '<div style="font-size:11.5px;color:#64748b">ผู้ขอลาออก / วันที่ ........./........./.........</div>' +
      '</div>' +
    '</div>' +
    '<div contenteditable="true" spellcheck="false" style="border:1.5px solid #cbd5e1;border-radius:8px;padding:14px 16px;background:#f8fafc;font-size:12.5px;line-height:1.8;page-break-inside:avoid">' +
      '<div style="font-weight:800;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-bottom:10px">' +
        'ส่วนสำหรับหัวหน้างาน / ฝ่ายทรัพยากรบุคคล (การส่งมอบงานและรับทราบ)' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin-bottom:16px">' +
        '<div>[ &nbsp; ] ส่งมอบงานคงค้างเรียบร้อยแล้ว</div>' +
        '<div>[ &nbsp; ] คืนกุญแจ / บัตรพนักงาน / อุปกรณ์บริษัทแล้ว</div>' +
        '<div>[ &nbsp; ] เคลียร์ยอดเงินเบิกล่วงหน้า / หนี้คงค้างแล้ว</div>' +
        '<div>[ &nbsp; ] อื่นๆ: ....................................................</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;text-align:center;margin-top:12px">' +
        '<div>' +
          '<div style="height:40px;border-bottom:1px dashed #64748b;margin-bottom:6px"></div>' +
          '<div>ลงชื่อ ( ................................................ )</div>' +
          '<div style="font-size:11px;color:#475569">หัวหน้าแผนก / ผู้รับมอบงาน (วันที่ ...../...../.....)</div>' +
        '</div>' +
        '<div>' +
          '<div style="height:40px;border-bottom:1px dashed #64748b;margin-bottom:6px"></div>' +
          '<div>ลงชื่อ ( <strong>' + esc(signName) + '</strong> )</div>' +
          '<div style="font-size:11px;color:#475569">' + esc(signTitle) + ' / ผู้อนุมัติ (วันที่ ...../...../.....)</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function resetResignationModalPaper() {
  if (!confirm('ต้องการคืนค่าข้อความใบลาออกกลับเป็นค่าเริ่มต้นใช่หรือไม่?')) return;
  renderResignationModalPaper();
  showToast('คืนค่าข้อความใบลาออกเรียบร้อยแล้ว', 'info');
}

function printResignationLetter() {
  printDocCenterModal('printing-resignation-letter');
}

// ==========================================
