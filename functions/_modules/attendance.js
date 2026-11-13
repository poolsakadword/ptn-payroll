/**
 * Time Attendance, Requests & Biometric Logging Module
 */
import { ensureBranchTables, ensureTimeAttendanceTables, logSystemActivity } from './db.js';
import { getMasterUnlockToken, isUserSuperAdmin, userHasPermission } from './security.js';
import { getBranchShiftSessions } from './branches.js';
import { sendPushToEmployee, sendPushToAdmins, broadcastPushNotification } from './notifications.js';
import { calculateAndSavePayroll } from './payroll.js';
import {
  timeStringToMinutes, normalizeDateToIso, getPeriodSortKey, getDefaultPeriod,
  parsePeriodYearMonth, getPreviousPeriodStr, getCutoffDatesForPeriod,
  getActualWorkingDaysInCutoff, calculatePeriodProRataRatio, calculateNewHireProRataRatio,
  getElapsedWorkingDaysInCutoff, getCompanyHolidayDatesSet, isPeriodLocked
} from './date-utils.js';

export function categorizeLeaveType(leaveType, medicalCertUrl) {
  const raw = String(leaveType || '').trim();
  const rawUpper = raw.toUpperCase();
  const rawLower = raw.toLowerCase();

  // 1. Sick with Medical Certificate
  if (
    rawUpper === 'SICK_WITH_CERT' ||
    rawLower.includes('มีใบ') ||
    rawLower.includes('with_cert') ||
    ((rawUpper === 'SICK' || rawLower === 'ลาป่วย') && medicalCertUrl)
  ) {
    return 'SICK_WITH_CERT';
  }

  // 2. Sick without Medical Certificate
  if (
    rawUpper === 'SICK_NO_CERT' ||
    rawLower.includes('ไม่มีใบ') ||
    rawLower.includes('no_cert') ||
    rawUpper === 'SICK' ||
    rawLower === 'ลาป่วย'
  ) {
    return 'SICK_NO_CERT';
  }

  // 3. Annual Leave
  if (rawUpper === 'ANNUAL' || rawLower.includes('พักร้อน')) {
    return 'ANNUAL';
  }

  // 4. Business Leave / Unpaid / Others
  if (
    rawUpper === 'BUSINESS' ||
    rawUpper === 'WITHOUT_PAY' ||
    rawLower.includes('กิจ') ||
    rawLower.includes('ไม่รับค่าจ้าง') ||
    rawLower.includes('without_pay')
  ) {
    return 'BUSINESS';
  }

  return rawUpper || 'OTHER';
}

export function buildAttendanceRequestFilters(params, reqCutoff) {
  const reqStatus = String(params.requestStatus || 'PENDING').toUpperCase();
  const reqType = String(params.requestType || 'ALL').toUpperCase();
  const reqDateMode = String(params.requestDateMode || (params.requestDate ? 'SINGLE' : 'ALL')).toUpperCase();
  const reqDate = params.requestDate ? String(params.requestDate).trim() : '';
  const reqMonth = params.requestMonth ? String(params.requestMonth).trim() : '';
  const reqPeriod = params.requestPeriod ? String(params.requestPeriod).trim() : '';
  const reqStartDate = params.requestStartDate ? String(params.requestStartDate).trim() : '';
  const reqEndDate = params.requestEndDate ? String(params.requestEndDate).trim() : '';
  const reqEmpFilter = String(params.requestEmpId || params.empId || 'ALL').trim();
  const reqLimit = Math.min(Math.max(Number(params.requestLimit) || 200, 10), 1000);

  // 1. Leave conditions
  const leaveConds = [];
  const leaveBinds = [];
  if (reqStatus === 'APPROVED' || reqStatus === 'REJECTED') {
    leaveConds.push("lr.status = ?");
    leaveBinds.push(reqStatus);
  } else if (reqStatus === 'PENDING') {
    leaveConds.push("lr.status = 'PENDING'");
  }
  if (reqEmpFilter && reqEmpFilter !== 'ALL') {
    leaveConds.push("lr.emp_id = ?");
    leaveBinds.push(reqEmpFilter);
  }
  if (reqDateMode === 'SINGLE' && reqDate) {
    leaveConds.push("(substr(datetime(lr.created_at, '+7 hours'), 1, 10) = ? OR (? BETWEEN lr.start_date AND lr.end_date))");
    leaveBinds.push(reqDate, reqDate);
  } else if (reqDateMode === 'MONTH' && reqMonth) {
    leaveConds.push("(lr.start_date LIKE ? OR lr.end_date LIKE ? OR substr(datetime(lr.created_at, '+7 hours'), 1, 7) = ?)");
    leaveBinds.push(reqMonth + '-%', reqMonth + '-%', reqMonth);
  } else if (reqDateMode === 'PERIOD' && reqCutoff) {
    leaveConds.push("((lr.start_date <= ? AND lr.end_date >= ?) OR (substr(datetime(lr.created_at, '+7 hours'), 1, 10) BETWEEN ? AND ?))");
    leaveBinds.push(reqCutoff.endDate, reqCutoff.startDate, reqCutoff.startDate, reqCutoff.endDate);
  } else if (reqDateMode === 'RANGE' && reqStartDate && reqEndDate) {
    leaveConds.push("((lr.start_date <= ? AND lr.end_date >= ?) OR (substr(datetime(lr.created_at, '+7 hours'), 1, 10) BETWEEN ? AND ?))");
    leaveBinds.push(reqEndDate, reqStartDate, reqStartDate, reqEndDate);
  }
  const leaveWhere = leaveConds.length > 0 ? "WHERE " + leaveConds.join(" AND ") : "";

  // 2. OT conditions
  const otConds = [];
  const otBinds = [];
  otConds.push("(COALESCE(ot.reason, '') NOT LIKE '%OT งานเสร็จประจำวัน%' AND COALESCE(ot.reason, '') NOT LIKE '%(Admin ปรับปรุงเวลา)%' AND COALESCE(ot.reason, '') NOT LIKE '%(HR ลงเวลาแทน)%')");

  if (reqStatus === 'APPROVED' || reqStatus === 'REJECTED') {
    otConds.push("ot.status = ?");
    otBinds.push(reqStatus);
  } else if (reqStatus === 'PENDING') {
    otConds.push("ot.status = 'PENDING'");
  }
  if (reqEmpFilter && reqEmpFilter !== 'ALL') {
    otConds.push("ot.emp_id = ?");
    otBinds.push(reqEmpFilter);
  }
  if (reqDateMode === 'SINGLE' && reqDate) {
    otConds.push("(ot.date = ? OR substr(datetime(ot.created_at, '+7 hours'), 1, 10) = ?)");
    otBinds.push(reqDate, reqDate);
  } else if (reqDateMode === 'MONTH' && reqMonth) {
    otConds.push("(ot.date LIKE ? OR substr(datetime(ot.created_at, '+7 hours'), 1, 7) = ?)");
    otBinds.push(reqMonth + '-%', reqMonth);
  } else if (reqDateMode === 'PERIOD' && reqCutoff) {
    otConds.push("((ot.date BETWEEN ? AND ?) OR (substr(datetime(ot.created_at, '+7 hours'), 1, 10) BETWEEN ? AND ?))");
    otBinds.push(reqCutoff.startDate, reqCutoff.endDate, reqCutoff.startDate, reqCutoff.endDate);
  } else if (reqDateMode === 'RANGE' && reqStartDate && reqEndDate) {
    otConds.push("((ot.date BETWEEN ? AND ?) OR (substr(datetime(ot.created_at, '+7 hours'), 1, 10) BETWEEN ? AND ?))");
    otBinds.push(reqStartDate, reqEndDate, reqStartDate, reqEndDate);
  }
  const otWhere = otConds.length > 0 ? "WHERE " + otConds.join(" AND ") : "";

  // 3. Advance conditions
  const advConds = [];
  const advBinds = [];
  if (reqStatus === 'APPROVED' || reqStatus === 'REJECTED') {
    advConds.push("ar.status = ?");
    advBinds.push(reqStatus);
  } else if (reqStatus === 'PENDING') {
    advConds.push("ar.status = 'PENDING'");
  }
  if (reqEmpFilter && reqEmpFilter !== 'ALL') {
    advConds.push("ar.emp_id = ?");
    advBinds.push(reqEmpFilter);
  }
  if (reqDateMode === 'SINGLE' && reqDate) {
    advConds.push("(ar.request_date = ? OR substr(datetime(ar.created_at, '+7 hours'), 1, 10) = ?)");
    advBinds.push(reqDate, reqDate);
  } else if (reqDateMode === 'MONTH' && reqMonth) {
    advConds.push("(ar.request_date LIKE ? OR substr(datetime(ar.created_at, '+7 hours'), 1, 7) = ?)");
    advBinds.push(reqMonth + '-%', reqMonth);
  } else if (reqDateMode === 'PERIOD' && reqCutoff) {
    advConds.push("((ar.request_date BETWEEN ? AND ?) OR (substr(datetime(ar.created_at, '+7 hours'), 1, 10) BETWEEN ? AND ?))");
    advBinds.push(reqCutoff.startDate, reqCutoff.endDate, reqCutoff.startDate, reqCutoff.endDate);
  } else if (reqDateMode === 'RANGE' && reqStartDate && reqEndDate) {
    advConds.push("((ar.request_date BETWEEN ? AND ?) OR (substr(datetime(ar.created_at, '+7 hours'), 1, 10) BETWEEN ? AND ?))");
    advBinds.push(reqStartDate, reqEndDate, reqStartDate, reqEndDate);
  }
  const advWhere = advConds.length > 0 ? "WHERE " + advConds.join(" AND ") : "";

  return {
    reqStatus,
    reqType,
    reqDateMode,
    reqDate,
    reqMonth,
    reqPeriod,
    reqStartDate,
    reqEndDate,
    reqEmpFilter,
    reqLimit,
    leaveWhere,
    leaveBinds,
    otWhere,
    otBinds,
    advWhere,
    advBinds
  };
}

export async function fetchAttendanceRequests(db, filterObj, customLimit) {
  const { reqType, reqLimit, leaveWhere, leaveBinds, otWhere, otBinds, advWhere, advBinds } = filterObj;
  const limit = customLimit || reqLimit || 150;

  const [leavesQuery, otsQuery, advQuery] = await Promise.all([
    (reqType === 'ALL' || reqType === 'LEAVE')
      ? db.prepare(`SELECT lr.*, datetime(lr.created_at, '+7 hours') AS created_at, e.full_name, e.nickname, e.department FROM leave_requests lr LEFT JOIN employees e ON lr.emp_id = e.emp_id ${leaveWhere} ORDER BY lr.created_at DESC LIMIT ${limit}`).bind(...leaveBinds).all().catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] }),
    (reqType === 'ALL' || reqType === 'OT')
      ? db.prepare(`SELECT ot.*, datetime(ot.created_at, '+7 hours') AS created_at, e.full_name, e.nickname, e.department FROM ot_requests ot LEFT JOIN employees e ON ot.emp_id = e.emp_id ${otWhere} ORDER BY ot.created_at DESC LIMIT ${limit}`).bind(...otBinds).all().catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] }),
    (reqType === 'ALL' || reqType === 'ADVANCE')
      ? db.prepare(`SELECT ar.*, datetime(ar.created_at, '+7 hours') AS created_at, e.full_name, e.nickname, e.department FROM advance_requests ar LEFT JOIN employees e ON ar.emp_id = e.emp_id ${advWhere} ORDER BY ar.created_at DESC LIMIT ${limit}`).bind(...advBinds).all().catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] })
  ]);

  return {
    pendingLeaves: leavesQuery.results || [],
    pendingOts: otsQuery.results || [],
    pendingAdvances: advQuery.results || []
  };
}

export async function executeDeleteAttendanceRequest(db, type, id, callerUser) {
  if (type === 'leave') {
    await db.prepare('DELETE FROM leave_requests WHERE id = ?').bind(id).run();
  } else if (type === 'ot') {
    await db.prepare('DELETE FROM ot_requests WHERE id = ?').bind(id).run();
  } else if (type === 'advance') {
    await db.prepare('DELETE FROM advance_requests WHERE id = ?').bind(id).run();
  } else {
    return { success: false, message: 'ประเภทคำขอไม่ถูกต้อง' };
  }
  await logSystemActivity(db, callerUser, 'DELETE_ATTENDANCE_REQUEST', `ลบคำขอ ${type} (ID: ${id})`);
  return { success: true, message: `ลบคำขอ ${type} ออกจากระบบเรียบร้อยแล้ว` };
}

export const attendanceHandlers = {
  syncFromPtnTime: async (db, params) => {
    let period = params.period;
      const callerUser = params.username || 'Admin';
      const allowed = (await userHasPermission(db, callerUser, 'sync_ptn_time')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดึงข้อมูลจากระบบ PTN Time' };
      if (await isPeriodLocked(db, period)) {
        return { success: false, message: `งวดประจำเดือน ${period} ถูกปิดและล็อคแล้ว ไม่อนุญาตให้ดึงข้อมูลจาก PTN Time กรุณาปลดล็อคงวดก่อนดำเนินการ` };
      }

      const dates = await getCutoffDatesForPeriod(db, period);
      const startDate = dates.startDate;
      const endDate = dates.endDate;
      const targetEmpId = params.empId ? String(params.empId).trim() : null;

      // 0. Determine actual work days for this period (from settings or calculated Mon-Sat non-Sundays minus holidays)
      const settingsRowsQuery = await db.prepare('SELECT key, value FROM settings').all().catch(() => ({ results: [] }));
      const settingsList = settingsRowsQuery.results || [];
      const wdRowExplicit = settingsList.find(r => r.key === `Period_WorkDays_${period}`);
      const holidayDatesSet = await getCompanyHolidayDatesSet(db, startDate, endDate);
      let periodWorkDays = (wdRowExplicit && wdRowExplicit.value && !isNaN(Number(wdRowExplicit.value)))
        ? Number(wdRowExplicit.value)
        : getActualWorkingDaysInCutoff(startDate, endDate, holidayDatesSet);
      if (periodWorkDays <= 0) periodWorkDays = 26;

      // 0.1 Load branch configurations for standard shift hours calculation
      const branchRowsQuery = await db.prepare('SELECT * FROM branches').all().catch(() => ({ results: [] }));
      const branchMap = {};
      for (const b of (branchRowsQuery.results || [])) branchMap[b.branch_id] = b;

      function getShiftHoursForBranch(branch) {
        if (!branch) return 8.5;
        const start = branch.work_start_time || '09:30';
        const end = branch.work_end_time || '19:00';
        const lunchStart = branch.lunch_start_time || '13:00';
        const lunchEnd = branch.lunch_end_time || '14:00';
        const [sh, sm] = (start || '09:30').split(':').map(Number);
        const [eh, em] = (end || '19:00').split(':').map(Number);
        const [lsh, lsm] = (lunchStart || '13:00').split(':').map(Number);
        const [leh, lem] = (lunchEnd || '14:00').split(':').map(Number);
        const totalShiftMins = (eh * 60 + em) - (sh * 60 + sm);
        const lunchMins = (leh * 60 + lem) - (lsh * 60 + lsm);
        const netMins = totalShiftMins - Math.max(0, lunchMins);
        return netMins > 0 ? Math.round((netMins / 60) * 100) / 100 : 8.5;
      }

      // 0.2 Load employees and existing monthly inputs upfront
      let employees = [];
      let existingMap = {};

      if (targetEmpId) {
        const singleEmp = await db.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(targetEmpId).first();
        if (!singleEmp) {
          return { success: false, message: `ไม่พบข้อมูลพนักงานรหัส ${targetEmpId}` };
        }
        employees = [singleEmp];
        const existingInput = await db.prepare('SELECT * FROM monthly_inputs WHERE period = ? AND emp_id = ?').bind(period, targetEmpId).first();
        if (existingInput) existingMap[targetEmpId] = existingInput;
      } else {
        const empQuery = await db.prepare('SELECT * FROM employees ORDER BY emp_id ASC').all();
        employees = empQuery.results || [];
        const existingInput = await db.prepare('SELECT * FROM monthly_inputs WHERE period = ?').bind(period).all();
        for (const row of (existingInput.results || [])) existingMap[row.emp_id] = row;
      }

      // 1. Query approved advance requests in this cutoff window (26th to 25th)
      let advMap = {};
      let totalAdvAmount = 0;
      try {
        let advSql = `
          SELECT emp_id, SUM(amount) as total_amt
          FROM advance_requests
          WHERE status = 'APPROVED'
            AND (request_date BETWEEN ? AND ? OR period = ?)
        `;
        let advBinds = [startDate, endDate, period];
        if (targetEmpId) {
          advSql += ` AND emp_id = ?`;
          advBinds.push(targetEmpId);
        }
        advSql += ` GROUP BY emp_id`;

        const advQuery = await db.prepare(advSql).bind(...advBinds).all();
        for (const row of (advQuery.results || [])) {
          const amt = Number(row.total_amt) || 0;
          advMap[row.emp_id] = amt;
          totalAdvAmount += amt;
        }
      } catch (e) {
        console.warn('advance_requests query note:', e);
      }

      // 2. Query approved OT requests in this cutoff window
      let otMap = {};
      let totalOtHours = 0;
      try {
        let otSql = `
          SELECT emp_id, SUM(COALESCE(actual_hours, planned_hours)) as total_hours
          FROM ot_requests
          WHERE status = 'APPROVED'
            AND (date BETWEEN ? AND ?)
        `;
        let otBinds = [startDate, endDate];
        if (targetEmpId) {
          otSql += ` AND emp_id = ?`;
          otBinds.push(targetEmpId);
        }
        otSql += ` GROUP BY emp_id`;

        const otQuery = await db.prepare(otSql).bind(...otBinds).all();
        for (const row of (otQuery.results || [])) {
          const emp = employees.find(e => e.emp_id === row.emp_id);
          const isOtEligible = !(emp && (emp.is_ot_eligible === 'false' || emp.is_ot_eligible === false));
          const hrs = isOtEligible ? (Number(row.total_hours) || 0) : 0;
          otMap[row.emp_id] = hrs;
          totalOtHours += hrs;
        }
      } catch (e) {
        console.warn('ot_requests query note:', e);
      }

      // 3. Query time_logs for the cutoff window
      const overbreakRow = settingsList.find(r => r.key === 'CountOverbreakAsLate');
      const countOverbreakAsLate = overbreakRow ? (overbreakRow.value !== 'false' && overbreakRow.value !== '0') : true;

      let missingHoursMap = {};
      let earlyDeductMap = {};
      let empLateDeductAmt = {};
      let empEarlyDepartureAmt = {};
      let empEarlyDepartureHours = {};
      let employeeHasLogs = {};
      let logsByEmpDate = {};
      let lastClockInDateByEmp = {};
      let timeLogsList = [];
      let empLateMinutes = {};
      let empLateCount = {};
      try {
        let tlSql = `
          SELECT id, emp_id, date, clock_in, clock_out, break_out, break_in, work_hours, ot_hours, late_minutes, break_minutes, overbreak_minutes, status, branch_id, is_full_pay, remark
          FROM time_logs
          WHERE date BETWEEN ? AND ?
        `;
        let tlBinds = [startDate, endDate];
        if (targetEmpId) {
          tlSql += ` AND emp_id = ?`;
          tlBinds.push(targetEmpId);
        }
        const tlQuery = await db.prepare(tlSql).bind(...tlBinds).all();
        timeLogsList = tlQuery.results || [];
        for (const row of timeLogsList) {
          employeeHasLogs[row.emp_id] = true;
          logsByEmpDate[`${row.emp_id}_${row.date}`] = row;
          if (row.clock_in) {
            if (!lastClockInDateByEmp[row.emp_id] || row.date > lastClockInDateByEmp[row.emp_id]) {
              lastClockInDateByEmp[row.emp_id] = row.date;
            }
          }

          // Merge any OT logged directly in time_logs if not already in otMap (only if eligible)
          const empForOt = employees.find(e => e.emp_id === row.emp_id);
          const isRowOtEligible = !(empForOt && (empForOt.is_ot_eligible === 'false' || empForOt.is_ot_eligible === false));
          const logOt = isRowOtEligible ? (Number(row.ot_hours) || 0) : 0;
          if (logOt > (otMap[row.emp_id] || 0)) {
            totalOtHours += (logOt - (otMap[row.emp_id] || 0));
            otMap[row.emp_id] = logOt;
          }
        }
      } catch (e) {
        console.warn('time_logs sync note:', e);
      }

      // 4. Query approved leave requests & apply Automatic Attendance Overrides (ระบบตรวจจับการมาทำงานจริงในวันลาอัตโนมัติ)
      let leaveMap = {};
      let totalLeaveCount = 0;
      let detailedLeaves = [];
      let autoAdjustedLeaves = [];
      let overriddenDatesByEmp = {}; // { 'EMP_YYYY-MM-DD': 'FULL' | 'HALF' }
      let pendingLeavesCount = 0;

      try {
        // Check pending leaves in this cutoff window to notify HR
        let penSql = `
          SELECT COUNT(*) as count
          FROM leave_requests
          WHERE UPPER(TRIM(status)) = 'PENDING'
            AND ((substr(start_date, 1, 10) BETWEEN ? AND ?) OR (substr(end_date, 1, 10) BETWEEN ? AND ?) OR (substr(start_date, 1, 10) <= ? AND substr(end_date, 1, 10) >= ?))
        `;
        let penBinds = [startDate, endDate, startDate, endDate, startDate, endDate];
        if (targetEmpId) {
          penSql += ` AND TRIM(emp_id) = TRIM(?)`;
          penBinds.push(targetEmpId);
        }
        const penRes = await db.prepare(penSql).bind(...penBinds).first();
        pendingLeavesCount = penRes ? (Number(penRes.count) || 0) : 0;

        let detSql = `
          SELECT id, emp_id, start_date, end_date, COALESCE(days_count, 1) as days_count, COALESCE(time_slot, 'FULL') as time_slot, leave_type, reason, medical_cert_url
          FROM leave_requests
          WHERE UPPER(TRIM(status)) = 'APPROVED'
            AND ((substr(start_date, 1, 10) BETWEEN ? AND ?) OR (substr(end_date, 1, 10) BETWEEN ? AND ?) OR (substr(start_date, 1, 10) <= ? AND substr(end_date, 1, 10) >= ?))
        `;
        let detBinds = [startDate, endDate, startDate, endDate, startDate, endDate];
        if (targetEmpId) {
          detSql += ` AND TRIM(emp_id) = TRIM(?)`;
          detBinds.push(targetEmpId);
        }
        const detQuery = await db.prepare(detSql).bind(...detBinds).all();
        detailedLeaves = detQuery.results || [];

        for (const lr of detailedLeaves) {
          const lrEmpId = String(lr.emp_id || '').trim();
          const emp = employees.find(e => String(e.emp_id).trim() === lrEmpId);
          const branch = emp ? branchMap[emp.branch_id] : null;
          const sessions = getBranchShiftSessions(branch);
          const timeSlot = String(lr.time_slot || '').toUpperCase();

          const sDate = String(lr.start_date || '').trim().substring(0, 10);
          const eDate = String(lr.end_date || '').trim().substring(0, 10);
          if (!sDate || !eDate) continue;

          let origDays = Number(lr.days_count) || 1.0;
          if (origDays === 0.5) {
            let effectiveSlot = timeSlot;
            if (!effectiveSlot || effectiveSlot === 'FULL') {
              const tl = logsByEmpDate[`${lrEmpId}_${sDate}`] || logsByEmpDate[`${lr.emp_id}_${sDate}`];
              if (tl && tl.clock_in) {
                const inM = timeStringToMinutes(tl.clock_in);
                if (inM !== null && inM >= sessions.lunchStartMin) {
                  effectiveSlot = 'MORNING';
                } else {
                  effectiveSlot = 'AFTERNOON';
                }
              }
            }
            if (effectiveSlot === 'MORNING') {
              origDays = sessions.morningFraction;
            } else if (effectiveSlot === 'AFTERNOON') {
              origDays = sessions.afternoonFraction;
            }
          }
          let daysDeductedDueToWork = 0;

          // Check each date covered by this leave within cutoff window
          let dCur = new Date(sDate + 'T00:00:00Z');
          const dEnd = new Date(eDate + 'T00:00:00Z');

          while (dCur <= dEnd) {
            const dStr = dCur.toISOString().substring(0, 10);
            if (dStr >= startDate && dStr <= endDate) {
              const tl = logsByEmpDate[`${lrEmpId}_${dStr}`] || logsByEmpDate[`${lr.emp_id}_${dStr}`];
              if (tl && tl.clock_in) {
                const branch = branchMap[tl.branch_id] || (emp ? branchMap[emp.branch_id] : null);
                const sessions = getBranchShiftSessions(branch);
                const shiftHours = sessions.totalHours;
                const inM = timeStringToMinutes(tl.clock_in);
                const isAfternoonClockIn = (inM !== null && inM >= sessions.lunchStartMin);
                let wHours = Number(tl.work_hours) || 0;
                // Cap afternoon clock-in work hours to afternoon shift hours so early-dismissal full-pay doesn't masquerade as 8.5h/9.5h full-day work
                if (isAfternoonClockIn && wHours > sessions.afternoonHours) {
                  wHours = sessions.afternoonHours;
                }

                // FULL WORK DAY: only when clocked in during the morning (not afternoon) and worked full shift
                if (!isAfternoonClockIn && ((tl.clock_out && wHours >= Math.max(6.0, shiftHours - 1.0)) || (tl.clock_out && wHours >= shiftHours * 0.75))) {
                  daysDeductedDueToWork += origDays;
                  overriddenDatesByEmp[`${lrEmpId}_${dStr}`] = 'FULL';
                  overriddenDatesByEmp[`${lr.emp_id}_${dStr}`] = 'FULL';
                  autoAdjustedLeaves.push({
                    empId: lr.emp_id,
                    empName: emp ? emp.full_name : lr.emp_id,
                    date: dStr,
                    leaveType: lr.leave_type,
                    type: 'FULL_WORK',
                    workHours: wHours,
                    shiftHours: shiftHours,
                    originalDays: origDays,
                    adjustedDeduction: origDays,
                    note: `มีใบลา ${lr.leave_type} แต่วันนี้มาทำงานจริง ${wHours} ชม. (เต็มกะ)`
                  });
                } else if (wHours >= 3.5 && (Number(lr.days_count) || 1.0) > 0.5) {
                  // HALF WORK DAY: worked at least half day (3.5+ hrs) on a FULL-DAY leave request
                  const deductPart = isAfternoonClockIn ? sessions.afternoonFraction : sessions.morningFraction;
                  daysDeductedDueToWork += deductPart;
                  overriddenDatesByEmp[`${lrEmpId}_${dStr}`] = 'HALF';
                  overriddenDatesByEmp[`${lr.emp_id}_${dStr}`] = 'HALF';
                  autoAdjustedLeaves.push({
                    empId: lr.emp_id,
                    empName: emp ? emp.full_name : lr.emp_id,
                    date: dStr,
                    leaveType: lr.leave_type,
                    type: 'HALF_WORK',
                    workHours: wHours,
                    shiftHours: shiftHours,
                    originalDays: origDays,
                    adjustedDeduction: deductPart,
                    note: `มีใบลา ${lr.leave_type} แต่วันนี้มาทำงานจริง ${wHours} ชม. (ครึ่งวัน)`
                  });
                }
              }
            }
            dCur.setUTCDate(dCur.getUTCDate() + 1);
          }

          const effectiveDays = Math.max(0, origDays - daysDeductedDueToWork);
          if (effectiveDays > 0) {
            if (!leaveMap[lrEmpId]) {
              leaveMap[lrEmpId] = { sickCert: 0, sickNoCert: 0, business: 0 };
            }
            if (lrEmpId !== lr.emp_id && !leaveMap[lr.emp_id]) {
              leaveMap[lr.emp_id] = leaveMap[lrEmpId];
            }
            totalLeaveCount += effectiveDays;
            const cat = categorizeLeaveType(lr.leave_type, lr.medical_cert_url);
            if (cat === 'SICK_WITH_CERT') {
              leaveMap[lrEmpId].sickCert += effectiveDays;
            } else if (cat === 'SICK_NO_CERT') {
              leaveMap[lrEmpId].sickNoCert += effectiveDays;
            } else {
              // ลากิจ, ลาพักร้อน (ANNUAL), หรือประเภทอื่นๆ ที่ได้รับอนุมัติ ให้รวมไว้ที่ช่องลากิจ ตามที่ผู้ใช้งานกำหนด
              leaveMap[lrEmpId].business += effectiveDays;
            }
          }
        }
      } catch (e) {
        console.warn('leave_requests query note:', e);
      }

      function getLeaveInfoOnDate(empId, dateStr) {
        const normEmpId = String(empId || '').trim();
        const override = overriddenDatesByEmp[`${normEmpId}_${dateStr}`] || overriddenDatesByEmp[`${empId}_${dateStr}`];
        if (override === 'FULL') return { days: 0, timeSlot: 'FULL', matchingLeave: null };
        if (override === 'HALF') return { days: 0.5, timeSlot: 'FULL', matchingLeave: null };
        let d = 0;
        let timeSlot = 'FULL';
        let matchingLeave = null;
        for (const lr of detailedLeaves) {
          const lrEmp = String(lr.emp_id || '').trim();
          const sDate = String(lr.start_date || '').trim().substring(0, 10);
          const eDate = String(lr.end_date || '').trim().substring(0, 10);
          if ((lrEmp === normEmpId || lr.emp_id === empId) && dateStr >= sDate && dateStr <= eDate) {
            let dc = Number(lr.days_count) || 1.0;
            let slot = String(lr.time_slot || '').toUpperCase();
            if (dc === 0.5) {
              const emp = employees.find(e => String(e.emp_id).trim() === lrEmp);
              const branch = emp ? branchMap[emp.branch_id] : null;
              const sessions = getBranchShiftSessions(branch);
              if (!slot || slot === 'FULL') {
                const tl = logsByEmpDate[`${lrEmp}_${dateStr}`] || logsByEmpDate[`${empId}_${dateStr}`];
                if (tl && tl.clock_in) {
                  const inM = timeStringToMinutes(tl.clock_in);
                  if (inM !== null && inM >= sessions.lunchStartMin) slot = 'MORNING';
                  else slot = 'AFTERNOON';
                }
              }
              if (slot === 'MORNING') dc = sessions.morningFraction;
              else if (slot === 'AFTERNOON') dc = sessions.afternoonFraction;
            }
            d += dc;
            if (slot) timeSlot = slot;
            matchingLeave = lr;
          }
        }
        return { days: d, timeSlot, matchingLeave };
      }

      function getLeaveDaysOnDate(empId, dateStr) {
        return getLeaveInfoOnDate(empId, dateStr).days;
      }

      const nowUtcSync = new Date();
      const bangkokTimeSync = new Date(nowUtcSync.getTime() + (7 * 3600 * 1000));
      const todayStr = bangkokTimeSync.toISOString().substring(0, 10);

      // Calculate missing hours / early departures from timeLogsList
      for (const row of timeLogsList) {
        const logDate = new Date(row.date + 'T00:00:00Z');
        if (logDate.getUTCDay() === 0 || holidayDatesSet.has(row.date)) continue; // Sunday = 0 or Company Holiday

        const emp = employees.find(e => e.emp_id === row.emp_id);
        const baseSal = emp ? (Number(emp.base_salary) || 0) : 0;
        const branch = branchMap[row.branch_id] || (emp ? branchMap[emp.branch_id] : null);
        const sessions = getBranchShiftSessions(branch);
        const shiftHours = sessions.totalHours;
        const morningHours = sessions.morningHours;
        const afternoonHours = sessions.afternoonHours;
        const morningFraction = sessions.morningFraction;
        const afternoonFraction = sessions.afternoonFraction;
        const lunchStart = sessions.lunchStartMin;
        const lunchEnd = sessions.lunchEndMin;

        const dailyRate = periodWorkDays > 0 ? (baseSal / periodWorkDays) : (baseSal / 30);
        const hourlyRate = shiftHours > 0 ? (dailyRate / shiftHours) : 0;

        const inMin = timeStringToMinutes(row.clock_in);
        const outMin = timeStringToMinutes(row.clock_out);
        const bOutMin = timeStringToMinutes(row.break_out);
        const bInMin = timeStringToMinutes(row.break_in);
        const workHours = Number(row.work_hours) || 0;
        let morningLateMins = Number(row.late_minutes) || 0;
        const overBreakMins = countOverbreakAsLate ? (Number(row.overbreak_minutes) || 0) : 0;

        const leaveInfo = getLeaveInfoOnDate(row.emp_id, row.date);
        const approvedLeaveDays = leaveInfo.days;
        const leaveSlot = leaveInfo.timeSlot;

        let coversMorning = (leaveSlot === 'FULL' && approvedLeaveDays >= 1.0) || leaveSlot === 'MORNING';
        let coversAfternoon = (leaveSlot === 'FULL' && approvedLeaveDays >= 1.0) || leaveSlot === 'AFTERNOON';
        if (!coversMorning && !coversAfternoon && (approvedLeaveDays === 0.5 || (approvedLeaveDays > 0 && approvedLeaveDays < 1.0))) {
          if (inMin !== null && inMin >= lunchStart) coversMorning = true;
          else coversAfternoon = true;
        }

        if (coversMorning && coversAfternoon) continue; // Fully covered by approved leave

        // If morning is covered by approved leave, employee is NOT late for the morning shift!
        if (coversMorning) {
          if (inMin !== null && inMin >= lunchStart) {
            const graceMin = branch ? Number(branch.grace_minutes || 0) : 0;
            morningLateMins = (lunchEnd && inMin > (lunchEnd + graceMin))
              ? (inMin - lunchEnd)
              : 0;
          } else {
            morningLateMins = 0;
          }
        }
        const totalDayLateMins = morningLateMins + overBreakMins;

        const coveredHours = approvedLeaveDays * shiftHours;
        const targetHours = Math.max(0, shiftHours - coveredHours);

        const isAttendanceExemptRow = (emp && (emp.is_attendance_exempt === 'true' || emp.is_attendance_exempt === true || emp.is_attendance_exempt === 1 || emp.is_attendance_exempt === '1'));
        if (isAttendanceExemptRow) continue;
        const isUndertimeExempt = (emp && (emp.is_undertime_exempt === 'true' || emp.is_undertime_exempt === true || emp.is_undertime_exempt === 1 || emp.is_undertime_exempt === '1'));

        // Check if morning or afternoon absence is active (penalized as pro-rata absent day at 1.5x)
        let isMorningAbsence = false;
        let isAfternoonAbsence = false;
        if (!coversMorning && inMin !== null && inMin >= lunchStart) {
          isMorningAbsence = true;
        } else if (!coversAfternoon && inMin !== null && inMin < lunchStart) {
          const isAfternoonMissing = (outMin !== null && outMin <= lunchEnd) ||
                                     (row.date < todayStr && (
                                       (bOutMin !== null && bInMin === null && outMin === null) ||
                                       (outMin === null && bInMin === null && workHours <= 0)
                                     ));
          if (isAfternoonMissing) {
            isAfternoonAbsence = true;
          }
        }

        if (row.clock_in) {
          // 1. หักตามนาทีสายจริง (Deduct strictly based on actual late minutes: รวมสายเช้า + เข้าบ่ายสาย/พักเกิน)
          let lateHours = 0;
          if (totalDayLateMins > 0 && !isMorningAbsence && !isAfternoonAbsence) {
            lateHours = Math.round((totalDayLateMins / 60) * 100) / 100;
            const lateDeductAmt = lateHours * hourlyRate;
            let dayLateCount = 0;
            if (morningLateMins > 0) dayLateCount++;
            if (overBreakMins > 0) dayLateCount++;

            empLateMinutes[row.emp_id] = (empLateMinutes[row.emp_id] || 0) + totalDayLateMins;
            empLateCount[row.emp_id] = (empLateCount[row.emp_id] || 0) + dayLateCount;
            missingHoursMap[row.emp_id] = (missingHoursMap[row.emp_id] || 0) + lateHours;
            earlyDeductMap[row.emp_id] = (earlyDeductMap[row.emp_id] || 0) + lateDeductAmt;
            empLateDeductAmt[row.emp_id] = (empLateDeductAmt[row.emp_id] || 0) + lateDeductAmt;
          }

          const isBranchEarlyDismissal = (row.is_full_pay === 1 || row.is_full_pay === '1' || (row.remark && row.remark.includes('งานเสร็จเลิกงานก่อน-จ่ายเต็มวัน')));
          if (isBranchEarlyDismissal) {
            // Whole-branch early dismissal mode: early departure/undertime waived
            continue;
          }

          // 2. ตรวจสอบเวลาออกก่อนเวลา/ขาดช่วง (Undertime / Early Departure) สำหรับพนักงานที่ไม่ได้รับการยกเว้น
          // ผ่อนผัน 15 นาที (0.25 ชม.) ก่อนเวลาเลิกงานกะ ไม่คิดหักเงิน
          if (!isUndertimeExempt && row.clock_out && workHours > 0 && !isMorningAbsence && !isAfternoonAbsence) {
            const expectedHours = Math.max(0, targetHours - lateHours);
            const earlyGraceHours = 15 / 60; // ผ่อนผัน 15 นาที
            if (workHours < (expectedHours - earlyGraceHours)) {
              const earlyMissing = Math.round((expectedHours - workHours) * 100) / 100;
              const earlyAmt = earlyMissing * hourlyRate;
              missingHoursMap[row.emp_id] = (missingHoursMap[row.emp_id] || 0) + earlyMissing;
              earlyDeductMap[row.emp_id] = (earlyDeductMap[row.emp_id] || 0) + earlyAmt;
              empEarlyDepartureAmt[row.emp_id] = (empEarlyDepartureAmt[row.emp_id] || 0) + earlyAmt;
              empEarlyDepartureHours[row.emp_id] = (empEarlyDepartureHours[row.emp_id] || 0) + earlyMissing;
            }
          }
        }
      }

      // 5. Merge into monthly_inputs & Evaluate Diligence Allowance
      const getSetVal = (k, def) => {
        const row = settingsList.find(r => r.key === k);
        return (row && row.value !== undefined && row.value !== null && !isNaN(Number(row.value))) ? Number(row.value) : def;
      };
      const getSetValStr = (k, def) => {
        const row = settingsList.find(r => r.key === k);
        return (row && row.value !== undefined && row.value !== null && row.value !== '') ? String(row.value) : def;
      };
      const fallbackOtRate = getSetVal('DefaultOtRate', 40);
      const diligenceAllowance = getSetVal('DiligenceAllowance', 1000);
      const diligenceLateGraceMins = getSetVal('DiligenceLateGraceMins', 2);
      const diligenceLateMaxCount = getSetVal('DiligenceLateMaxCount', 1);
      const autoDiligenceRow = settingsList.find(r => r.key === 'AutoDiligenceEnabled');
      const autoDiligenceEnabled = autoDiligenceRow ? (autoDiligenceRow.value !== 'false') : true;
      const missingBreakPenaltyMode = getSetValStr('MissingBreakPenaltyMode', 'ALERT_ONLY');

      let syncedCount = 0;
      let nextNo = 0;
      let diligenceQualifiedList = [];
      let diligenceDisqualifiedList = [];
      let targetEmpDiligenceResult = null;

      if (targetEmpId) {
        const exist = existingMap[targetEmpId];
        if (exist && exist.no) {
          nextNo = exist.no;
        } else {
          const maxNoRow = await db.prepare('SELECT COALESCE(MAX(no), 0) as max_no FROM monthly_inputs WHERE period = ?').bind(period).first();
          nextNo = (maxNoRow ? Number(maxNoRow.max_no) : 0) + 1;
        }
      }

      // Working dates in cutoff window (Mon-Sat, excluding Sundays)
      const periodWorkingDates = [];
      let dCurDate = new Date(startDate + 'T00:00:00Z');
      const dEndDate = new Date(endDate + 'T00:00:00Z');
      while (dCurDate <= dEndDate) {
        if (dCurDate.getUTCDay() !== 0) {
          periodWorkingDates.push(dCurDate.toISOString().substring(0, 10));
        }
        dCurDate.setUTCDate(dCurDate.getUTCDate() + 1);
      }
      let totalAbsentCount = 0;

      // Query carried debt from previous period
      const prevPeriodStr = getPreviousPeriodStr(period);
      const prevCalcs = await db.prepare('SELECT emp_id, carried_debt FROM payroll_calcs WHERE period = ? AND carried_debt > 0').bind(prevPeriodStr).all().catch(() => ({ results: [] }));
      const prevDebtMap = {};
      for (const r of (prevCalcs.results || [])) {
        if (r.emp_id && Number(r.carried_debt) > 0) prevDebtMap[r.emp_id] = Number(r.carried_debt);
      }

      for (const emp of employees) {
        // Determine resignation date (from employee profile or auto-detect from last clock-in in this period)
        let resignDateStr = emp.resign_date ? normalizeDateToIso(emp.resign_date) : '';
        if (!resignDateStr && emp.status === 'Resigned' && lastClockInDateByEmp[emp.emp_id]) {
          resignDateStr = lastClockInDateByEmp[emp.emp_id];
        }

        if (emp.status === 'Resigned') {
          const hasResignInPeriod = resignDateStr && resignDateStr >= startDate && resignDateStr <= endDate;
          const hasLogsInPeriod = Boolean(employeeHasLogs[emp.emp_id]) || Boolean(lastClockInDateByEmp[emp.emp_id]);
          const alreadyInPeriod = Boolean(existingMap[emp.emp_id]);

          // Skip past resigned employees who did NOT resign in this period and have NO logs in this period
          if (!hasResignInPeriod && !hasLogsInPeriod && !alreadyInPeriod && !targetEmpId) {
            continue;
          }
          if (resignDateStr && resignDateStr < startDate && !hasLogsInPeriod && !alreadyInPeriod && !targetEmpId) {
            continue;
          }
        }

        const joinDateStr = emp.join_date ? normalizeDateToIso(emp.join_date) : '';
        if (joinDateStr && joinDateStr > endDate && !existingMap[emp.emp_id]) {
          continue; // Not started yet
        }

        if (!targetEmpId) {
          nextNo++;
        }
        syncedCount++;

        const proRata = calculatePeriodProRataRatio(joinDateStr, resignDateStr, startDate, endDate, holidayDatesSet);
        const contractBaseSal = Number(emp.base_salary) || 0;
        const effectiveBaseSal = proRata.isMidPeriod
          ? (Math.round((contractBaseSal * proRata.ratio) * 100) / 100)
          : contractBaseSal;

        const exist = existingMap[emp.emp_id] || {};
        let baseSal = effectiveBaseSal;
        if (exist.base_salary !== undefined && exist.base_salary !== null && Number(exist.base_salary) > 0) {
          if (proRata.isMidPeriod && (Number(exist.base_salary) === contractBaseSal || emp.status === 'Resigned')) {
            baseSal = effectiveBaseSal;
          } else {
            baseSal = Number(exist.base_salary);
          }
        }

        const pfRate = (emp.pf_rate !== null && emp.pf_rate !== undefined && !isNaN(Number(emp.pf_rate))) ? Number(emp.pf_rate) : 0.05;
        const pfAmt = pfRate > 0 ? Math.round(baseSal * pfRate * 100) / 100 : 0;
        const sso = (emp.default_sso !== null && emp.default_sso !== undefined && !isNaN(Number(emp.default_sso))) ? Number(emp.default_sso) : 0;
        const tax = Number(emp.default_tax) || 0;

        const bonus = Number(exist.bonus) || 0;
        const othDed = Number(exist.other_deduct) || 0;
        const carriedDebt = (exist.carried_debt !== undefined && exist.carried_debt !== null && Number(exist.carried_debt) > 0)
          ? Number(exist.carried_debt)
          : (prevDebtMap[emp.emp_id] || 0);
        const otRate = (exist.ot_rate !== null && exist.ot_rate !== undefined && !isNaN(Number(exist.ot_rate))) ? Number(exist.ot_rate) : fallbackOtRate;

        // Apply synced data from PTN Time (strictly 0 if employee is not eligible for OT)
        const isEmpOtEligible = !(emp.is_ot_eligible === 'false' || emp.is_ot_eligible === false);
        const otHours = isEmpOtEligible ? (otMap[emp.emp_id] !== undefined ? otMap[emp.emp_id] : (Number(exist.ot_hours) || 0)) : 0;
        const advDed = advMap[emp.emp_id] !== undefined ? advMap[emp.emp_id] : (Number(exist.advance_deduct) || 0);
        
        const empKey = String(emp.emp_id || '').trim();
        const empLeave = leaveMap[empKey] || leaveMap[emp.emp_id] || {};
        const sickLeaveDays = empLeave.sickCert !== undefined ? empLeave.sickCert : (Number(exist.sick_leave_days) || 0);
        const unpaidSickLeaveDays = empLeave.sickNoCert !== undefined ? empLeave.sickNoCert : (Number(exist.unpaid_sick_leave_days) || 0);
        const leaveDays = empLeave.business !== undefined ? empLeave.business : (Number(exist.leave_days) || 0);

        // Auto-calculate absent days from PTN Time:
        // Any past/present working day (excluding Sundays & company holidays) with no clock-in and no approved leave
        let autoAbsentDays = 0;
        const isAttendanceExempt = (emp && (emp.is_attendance_exempt === 'true' || emp.is_attendance_exempt === true || emp.is_attendance_exempt === 1 || emp.is_attendance_exempt === '1'));
        if (!isAttendanceExempt) {
          const joinDateStr = emp.join_date ? normalizeDateToIso(emp.join_date) : null;
          for (const dStr of periodWorkingDates) {
            if (dStr > todayStr) continue; // Skip future dates in active/current period
            if (holidayDatesSet.has(dStr)) continue; // Skip company holidays
            if (joinDateStr && dStr < joinDateStr) continue; // Skip days before hire date
            if (resignDateStr && dStr > resignDateStr) continue; // Skip days after resignation date

            const tl = logsByEmpDate[`${emp.emp_id}_${dStr}`] || logsByEmpDate[`${empKey}_${dStr}`];
            const leaveInfo = getLeaveInfoOnDate(emp.emp_id, dStr);
            const approvedLeaveDays = leaveInfo.days;
            const leaveSlot = leaveInfo.timeSlot;

            const branch = branchMap[tl && tl.branch_id ? tl.branch_id : emp.branch_id] || (emp ? branchMap[emp.branch_id] : null);
            const sessions = getBranchShiftSessions(branch);
            const morningFraction = sessions.morningFraction;
            const afternoonFraction = sessions.afternoonFraction;
            const lunchStart = sessions.lunchStartMin;
            const lunchEnd = sessions.lunchEndMin;

            let coversMorning = (leaveSlot === 'FULL' && approvedLeaveDays >= 1.0) || leaveSlot === 'MORNING';
            let coversAfternoon = (leaveSlot === 'FULL' && approvedLeaveDays >= 1.0) || leaveSlot === 'AFTERNOON';
            if (!coversMorning && !coversAfternoon && (approvedLeaveDays === 0.5 || (approvedLeaveDays > 0 && approvedLeaveDays < 1.0))) {
              if (tl && tl.clock_in) {
                const inM = timeStringToMinutes(tl.clock_in);
                if (inM !== null && inM >= lunchStart) coversMorning = true;
                else coversAfternoon = true;
              } else {
                coversMorning = true;
              }
            }

            if (!tl || !tl.clock_in) {
              // Full-day absence check (accounting for approved leaves)
              if (dStr < todayStr) {
                if (coversMorning && coversAfternoon) {
                  // Fully covered by approved leave
                } else if (coversMorning && !coversAfternoon) {
                  autoAbsentDays += afternoonFraction;
                } else if (coversAfternoon && !coversMorning) {
                  autoAbsentDays += morningFraction;
                } else if (approvedLeaveDays === 0.5) {
                  autoAbsentDays += 0.5;
                } else {
                  autoAbsentDays += 1.0;
                }
              }
              continue;
            }

            // Has clock_in -> check half-day absence (Option 3: Hybrid pro-rata hours)
            const inMin = timeStringToMinutes(tl.clock_in);
            const outMin = timeStringToMinutes(tl.clock_out);
            const bOutMin = timeStringToMinutes(tl.break_out);
            const bInMin = timeStringToMinutes(tl.break_in);
            const wHours = Number(tl.work_hours) || 0;

            // 1. Morning absence: clocked in at or after lunch start (missed morning)
            if (inMin !== null && inMin >= lunchStart && !coversMorning) {
              autoAbsentDays += morningFraction;
            }
            // 2. Afternoon absence: clocked in morning, but missed afternoon without leave
            else if (inMin !== null && inMin < lunchStart && !coversAfternoon) {
              const isAfternoonMissing = (outMin !== null && outMin <= lunchEnd) ||
                                         (dStr < todayStr && (
                                           (bOutMin !== null && bInMin === null && outMin === null) ||
                                           (outMin === null && bInMin === null && wHours <= 0)
                                         ));
              if (isAfternoonMissing) {
                autoAbsentDays += afternoonFraction;
              }
            }
          }
        }

        const absentDays = isAttendanceExempt ? 0 : Math.round(autoAbsentDays * 100) / 100;
        if (!isAttendanceExempt) totalAbsentCount += absentDays;

        // Deduct missing hours / early departure based on actual workdays
        const calcEarlyDeduct = (!isAttendanceExempt && earlyDeductMap[emp.emp_id] !== undefined)
          ? Math.round(earlyDeductMap[emp.emp_id] * 100) / 100
          : 0;

        let lateDeduct = Number(exist.late_deduct) || 0;
        if (isAttendanceExempt) {
          lateDeduct = 0;
        } else if (calcEarlyDeduct > 0) {
          lateDeduct = calcEarlyDeduct;
        } else if (employeeHasLogs[emp.emp_id]) {
          lateDeduct = 0;
        }

        const lateMins = isAttendanceExempt ? 0 : (empLateMinutes[emp.emp_id] !== undefined
          ? empLateMinutes[emp.emp_id]
          : (Number(exist.late_minutes) || 0));

        const lateCnt = isAttendanceExempt ? 0 : (empLateCount[emp.emp_id] !== undefined
          ? empLateCount[emp.emp_id]
          : (Number(exist.late_count) || 0));

        // --- AUTOMATIC DILIGENCE ALLOWANCE (คำนวณเบี้ยขยันอัตโนมัติ) ---
        let allowance = 0;
        let empDisqualifyReasons = [];

        if (autoDiligenceEnabled) {
          if (!employeeHasLogs[emp.emp_id]) {
            empDisqualifyReasons.push('ไม่มีประวัติการลงเวลาในงวดนี้');
          } else {
            if (absentDays > 0) {
              empDisqualifyReasons.push(`ขาดงาน ${absentDays} วัน`);
            }
            if (leaveDays > 0) {
              empDisqualifyReasons.push(`ลากิจ ${leaveDays} วัน`);
            }
            if (sickLeaveDays > 0) {
              empDisqualifyReasons.push(`ลาป่วยมีใบรับรองแพทย์ ${sickLeaveDays} วัน`);
            }
            if (unpaidSickLeaveDays > 0) {
              empDisqualifyReasons.push(`ลาป่วยไม่มีใบรับรองแพทย์ ${unpaidSickLeaveDays} วัน`);
            }
            const earlyDeptAmt = empEarlyDepartureAmt[emp.emp_id] || 0;
            if (earlyDeptAmt > 0) {
              const eHrs = Math.round((empEarlyDepartureHours[emp.emp_id] || 0) * 100) / 100;
              empDisqualifyReasons.push(`ออกก่อนเวลา/ขาดช่วง ${eHrs} ชม.`);
            }
            if (proRata && proRata.isNewHireMidPeriod) {
              empDisqualifyReasons.push('พนักงานเข้าใหม่ระหว่างงวด (ทำงานไม่เต็มงวด)');
            }
            if (emp.status === 'Resigned' || (proRata && proRata.isExitMidPeriod)) {
              empDisqualifyReasons.push('พนักงานลาออกระหว่างงวด');
            }

            // Check late arrivals in non-Sunday logs (including morning late and afternoon overbreak)
            const empLogs = timeLogsList.filter(l => l.emp_id === emp.emp_id);
            let lateOccurrences = 0;
            let excessiveLateDays = [];

            for (const l of empLogs) {
              const logDate = new Date(l.date + 'T00:00:00Z');
              if (logDate.getUTCDay() === 0 || holidayDatesSet.has(l.date)) continue; // Skip Sunday and Company Holiday
              const lBranch = branchMap[l.branch_id || emp.branch_id] || (emp ? branchMap[emp.branch_id] : null);
              const lSessions = getBranchShiftSessions(lBranch);
              const lunchStart = lSessions.lunchStartMin;
              const lunchEnd = lSessions.lunchEndMin;

              const inM = timeStringToMinutes(l.clock_in);
              const outM = timeStringToMinutes(l.clock_out);
              const bOM = timeStringToMinutes(l.break_out);
              const bIM = timeStringToMinutes(l.break_in);
              const wH = Number(l.work_hours) || 0;
              const isMorningMiss = (inM !== null && inM >= lunchStart);
              const isAfternoonMiss = (outM !== null && outM <= lunchEnd) ||
                                      (l.date < todayStr && (
                                        (bOM !== null && bIM === null && outM === null) ||
                                        (outM === null && bIM === null && wH <= 0)
                                      ));
              if (isMorningMiss || isAfternoonMiss) continue;

              const morningMins = Number(l.late_minutes) || 0;
              const overBreakMins = countOverbreakAsLate ? (Number(l.overbreak_minutes) || 0) : 0;

              if (morningMins > 0) {
                lateOccurrences++;
                if (morningMins > diligenceLateGraceMins) {
                  excessiveLateDays.push(`วันที่ ${l.date.substring(8)} (สายเช้า ${morningMins} น. > เกณฑ์ ${diligenceLateGraceMins} น.)`);
                }
              }

              if (overBreakMins > 0) {
                lateOccurrences++;
                if (overBreakMins > diligenceLateGraceMins) {
                  excessiveLateDays.push(`วันที่ ${l.date.substring(8)} (เข้าบ่ายสาย/พักเกิน ${overBreakMins} น. > เกณฑ์ ${diligenceLateGraceMins} น.)`);
                }
              }
            }

            if (excessiveLateDays.length > 0) {
              empDisqualifyReasons.push(`สายเกินเกณฑ์: ${excessiveLateDays.join(', ')}`);
            } else if (lateOccurrences > diligenceLateMaxCount) {
              empDisqualifyReasons.push(`มาสาย ${lateOccurrences} ครั้ง (เกินโควตา ${diligenceLateMaxCount} ครั้ง)`);
            }

            // Check missing break scans for non-exempt staff
            const isEmpBreakExempt = (emp.is_break_exempt === 'true' || emp.is_break_exempt === true || emp.is_break_exempt === 1 || emp.is_break_exempt === '1') ||
                                    (emp.is_attendance_exempt === 'true' || emp.is_attendance_exempt === true || emp.is_attendance_exempt === 1 || emp.is_attendance_exempt === '1');
            let empMissingBreakCount = 0;
            if (!isEmpBreakExempt) {
              for (const l of empLogs) {
                const logDate = new Date(l.date + 'T00:00:00Z');
                if (logDate.getUTCDay() === 0 || holidayDatesSet.has(l.date)) continue;
                if (l.clock_in && l.clock_out && !l.break_out) {
                  empMissingBreakCount++;
                }
              }
            }

            if (missingBreakPenaltyMode === 'DILIGENCE_DISQUALIFY' && empMissingBreakCount > 0) {
              empDisqualifyReasons.push(`ไม่สแกนออกพัก ${empMissingBreakCount} ครั้ง`);
            } else if (missingBreakPenaltyMode === 'DILIGENCE_DISQUALIFY_EXCEED' && empMissingBreakCount > 1) {
              empDisqualifyReasons.push(`ไม่สแกนออกพัก ${empMissingBreakCount} ครั้ง (เกินเกณฑ์ 1 ครั้ง)`);
            }
            // In 'ALERT_ONLY' mode (Option 1): alert only, diligence allowance is NOT disqualified
          }

          const targetAllowance = (emp.diligence_allowance !== null && emp.diligence_allowance !== undefined && !isNaN(Number(emp.diligence_allowance)) && Number(emp.diligence_allowance) > 0)
            ? Number(emp.diligence_allowance)
            : diligenceAllowance;

          if (empDisqualifyReasons.length === 0) {
            allowance = targetAllowance;
            diligenceQualifiedList.push({
              empId: emp.emp_id,
              name: emp.full_name || emp.emp_id,
              allowance: targetAllowance
            });
            if (targetEmpId === emp.emp_id) {
              targetEmpDiligenceResult = { status: 'QUALIFIED', allowance: targetAllowance, reason: 'มาทำงานครบ ตรงต่อเวลา' };
            }
          } else {
            allowance = 0;
            diligenceDisqualifiedList.push({
              empId: emp.emp_id,
              name: emp.full_name || emp.emp_id,
              reasons: empDisqualifyReasons
            });
            if (targetEmpId === emp.emp_id) {
              targetEmpDiligenceResult = { status: 'DISQUALIFIED', allowance: 0, reason: empDisqualifyReasons.join('; ') };
            }
          }
        } else {
          allowance = Number(exist.allowance) || 0;
        }

        await db.prepare(`
          INSERT OR REPLACE INTO monthly_inputs
          (period, no, emp_id, emp_name, base_salary, pf_rate, pf_amount, absent_days, leave_days, sick_leave_days, unpaid_sick_leave_days, late_deduct, late_minutes, late_count, ot_hours, ot_rate, allowance, bonus, advance_deduct, other_deduct, carried_debt, sso, tax)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          period, nextNo, emp.emp_id, emp.full_name || '', baseSal, pfRate, pfAmt,
          Math.round(absentDays * 100) / 100,
          Math.round(leaveDays * 100) / 100,
          Math.round(sickLeaveDays * 100) / 100,
          Math.round(unpaidSickLeaveDays * 100) / 100,
          lateDeduct, lateMins, lateCnt,
          otHours, otRate, allowance, bonus, advDed, othDed, carriedDebt, sso, tax
        ).run();
      }

      await calculateAndSavePayroll(db, period, periodWorkDays);

      if (targetEmpId) {
        const empName = employees[0].full_name || targetEmpId;
        const empAdv = advMap[targetEmpId] || 0;
        const empOt = otMap[targetEmpId] || 0;
        const empL = leaveMap[targetEmpId] || {};
        const empLeaveTotal = (empL.sickCert || 0) + (empL.sickNoCert || 0) + (empL.business || 0);
        const empMissingHrs = Math.round((missingHoursMap[targetEmpId] || 0) * 100) / 100;
        const empEarlyDed = Math.round((earlyDeductMap[targetEmpId] || 0) * 100) / 100;
        const empLateM = empLateMinutes[targetEmpId] || 0;
        const empLateC = empLateCount[targetEmpId] || 0;
        const diligenceEarned = targetEmpDiligenceResult && targetEmpDiligenceResult.status === 'QUALIFIED';
        const empDiligenceMsg = autoDiligenceEnabled
          ? (diligenceEarned ? `, ได้รับเบี้ยขยัน ฿${targetEmpDiligenceResult.allowance.toLocaleString()}` : `, เบี้ยขยัน ฿0 (${targetEmpDiligenceResult ? targetEmpDiligenceResult.reason : 'ตัดสิทธิ์'})`)
          : '';
        const pendingNote = pendingLeavesCount > 0 ? `, คำขอลารออนุมัติ ${pendingLeavesCount} รายการ (ยังไม่ถูกดึงเข้า)` : '';

        await logSystemActivity(db, params.username || 'Admin', 'PTN_TIME_SYNC_EMP', `ดึงข้อมูลจาก PTN Time พนักงาน [${targetEmpId}] ${empName} เข้าสู่งวด ${period} (วันทำงานจริง ${periodWorkDays} วัน, ขาดงาน ${totalAbsentCount} วัน, เบิกเงิน ฿${empAdv.toLocaleString()}, OT ${empOt} ชม., ลารวม ${empLeaveTotal} วัน${empEarlyDed > 0 ? `, หักสาย ฿${empEarlyDed.toLocaleString()} (${empLateM} นาที / ${empLateC} ครั้ง)` : ''}${empDiligenceMsg}${pendingNote})`);

        return {
          success: true,
          period: period,
          empId: targetEmpId,
          empName: empName,
          absentDays: totalAbsentCount,
          advAmount: empAdv,
          otHours: empOt,
          leaveTotal: empLeaveTotal,
          missingHours: empMissingHrs,
          lateDeduct: empEarlyDed,
          lateMinutes: empLateM,
          lateCount: empLateC,
          pendingLeavesCount: pendingLeavesCount,
          allowance: targetEmpDiligenceResult ? targetEmpDiligenceResult.allowance : 0,
          diligenceStatus: targetEmpDiligenceResult ? targetEmpDiligenceResult.status : 'NONE',
          diligenceReason: targetEmpDiligenceResult ? targetEmpDiligenceResult.reason : '',
          workingDays: periodWorkDays,
          autoAdjustedLeaves: autoAdjustedLeaves.filter(a => a.empId === targetEmpId),
          message: `ดึงข้อมูลพนักงาน [${targetEmpId}] ${empName} สำเร็จ (วันทำงานจริง ${periodWorkDays} วัน, ขาดงาน ${totalAbsentCount} วัน, OT ${empOt} ชม., เบิกเงิน ฿${empAdv.toLocaleString()}, ลาสุทธิ ${empLeaveTotal} วัน${empEarlyDed > 0 ? `, หักสาย ฿${empEarlyDed.toLocaleString()} (${empLateM} นาที / ${empLateC} ครั้ง)` : ''}${empDiligenceMsg}${pendingNote}${autoAdjustedLeaves.filter(a => a.empId === targetEmpId).length > 0 ? `, ตรวจพบมาทำงานในวันลา ${autoAdjustedLeaves.filter(a => a.empId === targetEmpId).length} วัน (ยกเว้นการหักวันลาอัตโนมัติ)` : ''})`
        };
      }

      let totalMissingHours = 0;
      let totalEarlyDeduct = 0;
      let totalLateMins = 0;
      let totalLateCount = 0;
      for (const k in missingHoursMap) totalMissingHours += missingHoursMap[k];
      for (const k in earlyDeductMap) totalEarlyDeduct += earlyDeductMap[k];
      for (const k in empLateMinutes) totalLateMins += empLateMinutes[k];
      for (const k in empLateCount) totalLateCount += empLateCount[k];
      totalMissingHours = Math.round(totalMissingHours * 100) / 100;
      totalEarlyDeduct = Math.round(totalEarlyDeduct * 100) / 100;
      totalAbsentCount = Math.round(totalAbsentCount * 1000) / 1000;

      let adjustSummary = '';
      if (autoAdjustedLeaves.length > 0) {
        adjustSummary = `, ตรวจพบและยกเว้นวันลาที่มาทำงานจริง ${autoAdjustedLeaves.length} รายการ`;
      }
      let diligenceSummary = '';
      if (autoDiligenceEnabled) {
        diligenceSummary = `, เบี้ยขยัน: ได้รับ ${diligenceQualifiedList.length} คน, ตัดสิทธิ์ ${diligenceDisqualifiedList.length} คน`;
      }
      let pendingSummary = '';
      if (pendingLeavesCount > 0) {
        pendingSummary = `, คำขอลารออนุมัติ ${pendingLeavesCount} รายการ (ยังไม่ถูกดึงเข้าจนกว่าจะอนุมัติ)`;
      }

      await logSystemActivity(db, params.username || 'Admin', 'PTN_TIME_SYNC', `ดึงข้อมูลจาก PTN Time รอบ ${startDate} ถึง ${endDate} เข้าสู่งวด ${period} (พนักงาน ${syncedCount} คน, วันทำงานจริง ${periodWorkDays} วัน, ขาดงานรวม ${totalAbsentCount} วัน, เบิกเงิน ฿${totalAdvAmount.toLocaleString()}, OT ${totalOtHours} ชม., ลาสุทธิ ${totalLeaveCount} วัน, หักสายรวม ฿${totalEarlyDeduct.toLocaleString()} (${totalLateMins} นาที / ${totalLateCount} ครั้ง)${diligenceSummary}${pendingSummary}${adjustSummary})`);

      return {
        success: true,
        period: period,
        startDate: startDate,
        endDate: endDate,
        syncedCount: syncedCount,
        totalAbsentCount: totalAbsentCount,
        totalAdvAmount: totalAdvAmount,
        totalOtHours: totalOtHours,
        totalLeaveCount: totalLeaveCount,
        totalMissingHours: totalMissingHours,
        totalEarlyDeduct: totalEarlyDeduct,
        workingDays: periodWorkDays,
        autoAdjustedLeaves: autoAdjustedLeaves,
        diligenceQualifiedCount: diligenceQualifiedList.length,
        diligenceDisqualifiedCount: diligenceDisqualifiedList.length,
        totalLateMins: totalLateMins,
        totalLateCount: totalLateCount,
        pendingLeavesCount: pendingLeavesCount,
        message: `ดึงข้อมูลจาก PTN Time สำเร็จ (${syncedCount} คน, วันทำงานจริง ${periodWorkDays} วัน, ขาดงานรวม ${totalAbsentCount} วัน, OT รวม ${totalOtHours} ชม., เบิกเงินรวม ฿${totalAdvAmount.toLocaleString()}, ลาสุทธิ ${totalLeaveCount} วัน, หักสายรวม ฿${totalEarlyDeduct.toLocaleString()} (${totalLateMins} นาที / ${totalLateCount} ครั้ง)${diligenceSummary}${pendingSummary}${adjustSummary})`
      };
  },

  getAdminRealtimeAlerts: async (db, params) => {
      const nowUtc = new Date();
      const bangkokTime = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
      const today = bangkokTime.toISOString().substring(0, 10);

      // 1. Pending Leaves
      const leavesQ = await db.prepare(`
        SELECT lr.id, lr.emp_id, lr.leave_type, lr.start_date, COALESCE(lr.days_count, 1) as days_count, datetime(lr.created_at, '+7 hours') AS created_at, e.full_name
        FROM leave_requests lr
        LEFT JOIN employees e ON lr.emp_id = e.emp_id
        WHERE lr.status = 'PENDING'
        ORDER BY lr.created_at DESC
        LIMIT 10
      `).all().catch(() => ({ results: [] }));

      // 2. Pending OTs
      const otsQ = await db.prepare(`
        SELECT ot.id, ot.emp_id, ot.date, COALESCE(ot.actual_hours, ot.planned_hours, 0) as hours, datetime(ot.created_at, '+7 hours') AS created_at, e.full_name
        FROM ot_requests ot
        LEFT JOIN employees e ON ot.emp_id = e.emp_id
        WHERE ot.status = 'PENDING' AND (COALESCE(ot.reason, '') NOT LIKE '%OT งานเสร็จประจำวัน%' AND COALESCE(ot.reason, '') NOT LIKE '%(Admin ปรับปรุงเวลา)%' AND COALESCE(ot.reason, '') NOT LIKE '%(HR ลงเวลาแทน)%')
        ORDER BY ot.created_at DESC
        LIMIT 10
      `).all().catch(() => ({ results: [] }));

      // 3. Pending Advances
      const advQ = await db.prepare(`
        SELECT ar.id, ar.emp_id, ar.amount, ar.request_date, datetime(ar.created_at, '+7 hours') AS created_at, e.full_name
        FROM advance_requests ar
        LEFT JOIN employees e ON ar.emp_id = e.emp_id
        WHERE ar.status = 'PENDING'
        ORDER BY ar.created_at DESC
        LIMIT 10
      `).all().catch(() => ({ results: [] }));

      // 4. Anomalies Today (Overbreak or Anomaly)
      const anomQ = await db.prepare(`
        SELECT l.id, l.emp_id, l.clock_in, l.break_out, l.break_in, l.overbreak_minutes, l.status, l.remark, e.full_name
        FROM time_logs l
        LEFT JOIN employees e ON l.emp_id = e.emp_id
        WHERE l.date = ? AND (l.overbreak_minutes > 0 OR l.status = 'ANOMALY')
        ORDER BY l.id DESC
        LIMIT 10
      `).bind(today).all().catch(() => ({ results: [] }));

      const pendingLeaves = leavesQ.results || [];
      const pendingOts = otsQ.results || [];
      const pendingAdvances = advQ.results || [];
      const anomalies = anomQ.results || [];

      return {
        success: true,
        today,
        pendingLeaves,
        pendingOts,
        pendingAdvances,
        anomalies,
        totalPending: pendingLeaves.length + pendingOts.length + pendingAdvances.length
      };
  },

  getAttendanceRequests: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const isAllowed = (await userHasPermission(db, callerUser, 'view_attendance')) ||
                        (await userHasPermission(db, callerUser, 'approve_attendance')) ||
                        (await userHasPermission(db, callerUser, 'create_attendance_requests')) ||
                        (await isUserSuperAdmin(db, callerUser));
      if (!isAllowed) {
        return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานระบบลงเวลา' };
      }

      const reqDateMode = String(params.requestDateMode || 'ALL').toUpperCase();
      const reqPeriod = params.requestPeriod ? String(params.requestPeriod).trim() : '';
      let reqCutoff = null;
      if (reqDateMode === 'PERIOD' && reqPeriod) {
        reqCutoff = await getCutoffDatesForPeriod(db, reqPeriod);
      }

      const filters = buildAttendanceRequestFilters(params, reqCutoff);
      const reqData = await fetchAttendanceRequests(db, filters, 150);

      return {
        success: true,
        pendingLeaves: reqData.pendingLeaves,
        pendingOts: reqData.pendingOts,
        pendingAdvances: reqData.pendingAdvances,
        reqCutoffDates: reqCutoff
      };
  },

  getTimeAttendanceDashboard: async (db, params) => {
    let period = params.period;
      const callerUser = params.username || 'Admin';
      const isAllowed = await userHasPermission(db, callerUser, 'view_attendance');
      if (!isAllowed) {
        return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานระบบลงเวลา' };
      }

      const nowUtc = new Date();
      const bangkokTime = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
      const today = bangkokTime.toISOString().substring(0, 10);
      const filterDate = params.date || today;
      const branchFilter = String(params.branchId || params.branch_id || '').trim();
      const empFilter = String(params.empId || params.emp_id || '').trim();
      const reqEmpFilter = String(params.requestEmpId || params.request_emp_id || empFilter || '').trim();
      const dateMode = String(params.dateMode || 'SINGLE').toUpperCase(); // 'SINGLE', 'MONTH', 'PERIOD', 'RANGE'
      const filterMonth = params.month ? String(params.month).trim() : (filterDate ? filterDate.substring(0, 7) : today.substring(0, 7));

      // Determine active cutoff period if day > 25
      let defaultActivePeriod = today.substring(0, 7);
      const todayDay = parseInt(today.substring(8, 10), 10);
      if (todayDay > 25) {
        let m = parseInt(today.substring(5, 7), 10) + 1;
        let y = parseInt(today.substring(0, 4), 10);
        if (m > 12) { m = 1; y += 1; }
        defaultActivePeriod = `${y}-${String(m).padStart(2, '0')}`;
      }
      const filterPeriod = params.period ? String(params.period).trim() : defaultActivePeriod;
      const startDate = params.startDate ? String(params.startDate).trim() : '';
      const endDate = params.endDate ? String(params.endDate).trim() : '';

      let cutoffInfo = null;
      if (dateMode === 'PERIOD') {
        cutoffInfo = await getCutoffDatesForPeriod(db, filterPeriod);
      }

      // 1.0 Employees list for search & selector (include resigned employees so history & period logs can be inspected)
      const isCallerSuper = (await isUserSuperAdmin(db, callerUser));
      let empRowsSql = `
        SELECT emp_id, full_name, nickname, department, position, branch_id, phone, status, resign_date, is_attendance_exempt, is_confidential
        FROM employees
        WHERE 1=1
      `;
      if (!isCallerSuper) {
        empRowsSql += " AND (is_confidential IS NULL OR is_confidential = 0)";
      }
      empRowsSql += " ORDER BY emp_id ASC";
      const empRows = await db.prepare(empRowsSql).all().catch(() => ({ results: [] }));
      const allEmployees = empRows.results || [];
      const employeeList = allEmployees.map(e => ({
        emp_id: e.emp_id,
        name: e.full_name,
        full_name: e.full_name,
        nickname: e.nickname,
        department: e.department,
        position: e.position,
        branch_id: e.branch_id,
        phone: e.phone,
        status: e.status || 'Active',
        resign_date: e.resign_date || ''
      }));

      const isIndividual = Boolean(empFilter && empFilter !== 'ALL');
      let selectedEmp = null;
      let empSummary = null;

      // 1. Logs for Selected Date (or Today) or Multi-Day History
      let dateClause = "l.date = ?";
      let dateBinds = [filterDate];

      if (dateMode === 'RANGE' && startDate && endDate) {
        dateClause = "l.date BETWEEN ? AND ?";
        dateBinds = [startDate, endDate];
      } else if (dateMode === 'MONTH') {
        dateClause = "l.date LIKE ?";
        dateBinds = [filterMonth + '-%'];
      } else if (dateMode === 'PERIOD') {
        if (!cutoffInfo) cutoffInfo = await getCutoffDatesForPeriod(db, filterPeriod);
        dateClause = "l.date BETWEEN ? AND ?";
        dateBinds = [cutoffInfo.startDate, cutoffInfo.endDate];
      }

      let logsQuery;
      if (isIndividual) {
        selectedEmp = employeeList.find(e => e.emp_id === empFilter) || (await db.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empFilter).first().catch(() => null));
        if (selectedEmp) {
          selectedEmp.name = selectedEmp.name || selectedEmp.full_name;
          selectedEmp.full_name = selectedEmp.full_name || selectedEmp.name;
        }
        
        logsQuery = await db.prepare(`
          SELECT l.*, e.full_name, e.nickname, e.department, e.position, e.phone, e.photo_url, e.branch_id as emp_branch_id, b.branch_name
          FROM time_logs l
          LEFT JOIN employees e ON l.emp_id = e.emp_id
          LEFT JOIN branches b ON b.branch_id = COALESCE(l.branch_id, e.branch_id)
          WHERE l.emp_id = ? AND ${dateClause} ${!isCallerSuper ? 'AND (e.is_confidential IS NULL OR e.is_confidential = 0)' : ''}
          ORDER BY l.date DESC, l.clock_in DESC
        `).bind(empFilter, ...dateBinds).all().catch(() => ({ results: [] }));

      } else {
        if (branchFilter && branchFilter !== 'ALL') {
          logsQuery = await db.prepare(`
            SELECT l.*, e.full_name, e.nickname, e.department, e.position, e.phone, e.photo_url, e.branch_id as emp_branch_id, b.branch_name
            FROM time_logs l
            LEFT JOIN employees e ON l.emp_id = e.emp_id
            LEFT JOIN branches b ON b.branch_id = COALESCE(l.branch_id, e.branch_id)
            WHERE ${dateClause} AND (l.branch_id = ? OR (l.branch_id IS NULL AND e.branch_id = ?)) ${!isCallerSuper ? 'AND (e.is_confidential IS NULL OR e.is_confidential = 0)' : ''}
            ORDER BY l.date DESC, l.clock_in DESC
            LIMIT 500
          `).bind(...dateBinds, branchFilter, branchFilter).all().catch(() => ({ results: [] }));
        } else {
          logsQuery = await db.prepare(`
            SELECT l.*, e.full_name, e.nickname, e.department, e.position, e.phone, e.photo_url, e.branch_id as emp_branch_id, b.branch_name
            FROM time_logs l
            LEFT JOIN employees e ON l.emp_id = e.emp_id
            LEFT JOIN branches b ON b.branch_id = COALESCE(l.branch_id, e.branch_id)
            WHERE ${dateClause} ${!isCallerSuper ? 'AND (e.is_confidential IS NULL OR e.is_confidential = 0)' : ''}
            ORDER BY l.date DESC, l.clock_in DESC
            LIMIT 500
          `).bind(...dateBinds).all().catch(() => ({ results: [] }));
        }
      }
      const logsToday = logsQuery.results || [];
      const overbreakSettingRow = await db.prepare('SELECT value FROM settings WHERE key = "CountOverbreakAsLate"').first().catch(() => null);
      const countOverbreakAsLate = overbreakSettingRow ? (overbreakSettingRow.value !== 'false' && overbreakSettingRow.value !== '0') : true;

      // Compute Individual Mini Summary if individual mode
      if (isIndividual) {
        let daysWorked = 0;
        let totalWorkHours = 0;
        let totalOtHours = 0;
        let lateCount = 0;
        let totalLateMinutes = 0;
        let missingClockOutCount = 0;
        let anomalyCount = 0;

        for (const l of logsToday) {
          if (l.clock_in) daysWorked++;
          totalWorkHours += Number(l.work_hours || 0);
          totalOtHours += Number(l.ot_hours || 0);
          const morningLate = Number(l.late_minutes || 0);
          const overbreakLate = countOverbreakAsLate ? Number(l.overbreak_minutes || 0) : 0;
          if (morningLate > 0) lateCount++;
          if (overbreakLate > 0) lateCount++;
          if (morningLate + overbreakLate > 0) {
            totalLateMinutes += (morningLate + overbreakLate);
          }
          if (l.clock_in && !l.clock_out && l.date < today) {
            missingClockOutCount++;
          }
          if (l.status === 'ANOMALY' || l.status === 'GEOFENCE_FAIL' || (l.overbreak_minutes || 0) > 0) {
            anomalyCount++;
          }
        }

        let sumLeaveClause = "emp_id = ? AND status = 'APPROVED'";
        let sumAdvClause = "emp_id = ? AND status = 'APPROVED'";
        let sumOtClause = "emp_id = ? AND status = 'APPROVED'";
        let sumBindsLeave = [empFilter];
        let sumBindsAdv = [empFilter];
        let sumBindsOt = [empFilter];

        if (dateMode === 'RANGE' && startDate && endDate) {
          sumLeaveClause += " AND (start_date <= ? AND end_date >= ?)";
          sumBindsLeave.push(endDate, startDate);
          sumAdvClause += " AND (request_date BETWEEN ? AND ?)";
          sumBindsAdv.push(startDate, endDate);
          sumOtClause += " AND (date BETWEEN ? AND ?)";
          sumBindsOt.push(startDate, endDate);
        } else if (dateMode === 'MONTH') {
          sumLeaveClause += " AND (start_date LIKE ? OR end_date LIKE ?)";
          sumBindsLeave.push(filterMonth + '-%', filterMonth + '-%');
          sumAdvClause += " AND (request_date LIKE ?)";
          sumBindsAdv.push(filterMonth + '-%');
          sumOtClause += " AND (date LIKE ?)";
          sumBindsOt.push(filterMonth + '-%');
        } else if (dateMode === 'PERIOD') {
          if (!cutoffInfo) cutoffInfo = await getCutoffDatesForPeriod(db, filterPeriod);
          sumLeaveClause += " AND (start_date <= ? AND end_date >= ?)";
          sumBindsLeave.push(cutoffInfo.endDate, cutoffInfo.startDate);
          sumAdvClause += " AND (request_date BETWEEN ? AND ?)";
          sumBindsAdv.push(cutoffInfo.startDate, cutoffInfo.endDate);
          sumOtClause += " AND (date BETWEEN ? AND ?)";
          sumBindsOt.push(cutoffInfo.startDate, cutoffInfo.endDate);
        }        const [appLeavesQ, appAdvQ, appOtQ] = await Promise.all([
          db.prepare(`SELECT SUM(COALESCE(days_count, 1)) as sum_days FROM leave_requests WHERE ${sumLeaveClause}`).bind(...sumBindsLeave).first().catch(() => null),
          db.prepare(`SELECT SUM(amount) as sum_amount FROM advance_requests WHERE ${sumAdvClause}`).bind(...sumBindsAdv).first().catch(() => null),
          db.prepare(`SELECT SUM(actual_hours) as sum_ot FROM ot_requests WHERE ${sumOtClause}`).bind(...sumBindsOt).first().catch(() => null)
        ]);

        empSummary = {
          daysWorked,
          totalWorkHours: Math.round(totalWorkHours * 100) / 100,
          totalOtHours: Math.round(totalOtHours * 100) / 100,
          lateCount,
          totalLateMinutes,
          missingClockOutCount,
          anomalyCount,
          approvedLeaveDays: Number(appLeavesQ?.sum_days || 0),
          approvedAdvanceAmount: Number(appAdvQ?.sum_amount || 0),
          approvedOtHours: Number(appOtQ?.sum_ot || 0)
        };
      }

      const targetDate = filterDate || today;

      const reqDateMode = String(params.requestDateMode || (params.requestDate ? 'SINGLE' : 'ALL')).toUpperCase();
      const reqMonth = params.requestMonth ? String(params.requestMonth).trim() : '';
      const reqPeriod = params.requestPeriod ? String(params.requestPeriod).trim() : (reqMonth || filterPeriod);
      let reqCutoff = null;
      if (reqDateMode === 'PERIOD') {
        reqCutoff = await getCutoffDatesForPeriod(db, reqPeriod);
      }

      const reqFilters = buildAttendanceRequestFilters({ ...params, requestEmpId: reqEmpFilter, requestPeriod: reqPeriod }, reqCutoff);

      let minLeaveQueryDate = targetDate;
      let maxLeaveQueryDate = targetDate;
      for (const l of logsToday) {
        if (l.date) {
          if (l.date < minLeaveQueryDate) minLeaveQueryDate = l.date;
          if (l.date > maxLeaveQueryDate) maxLeaveQueryDate = l.date;
        }
      }

      // 3. EXECUTE INDEPENDENT QUERIES IN PARALLEL FOR HIGH PERFORMANCE
      const [
        branchRows,
        reqData,
        approvedLeavesOnDate,
        pendingCountRow,
        setRows,
        targetHolidayRow
      ] = await Promise.all([
        db.prepare('SELECT * FROM branches ORDER BY branch_id ASC').all().catch(() => ({ results: [] })),
        fetchAttendanceRequests(db, reqFilters, reqFilters.reqLimit),
        db.prepare(`SELECT lr.*, e.full_name, e.nickname, e.phone FROM leave_requests lr LEFT JOIN employees e ON lr.emp_id = e.emp_id WHERE UPPER(TRIM(lr.status)) IN ('APPROVED', 'PENDING') AND substr(lr.start_date, 1, 10) <= ? AND substr(lr.end_date, 1, 10) >= ?`).bind(maxLeaveQueryDate, minLeaveQueryDate).all().catch(() => ({ results: [] })),
        db.prepare(`SELECT (SELECT COUNT(*) FROM leave_requests WHERE status = 'PENDING') + (SELECT COUNT(*) FROM ot_requests WHERE status = 'PENDING' AND (COALESCE(reason, '') NOT LIKE '%OT งานเสร็จประจำวัน%' AND COALESCE(reason, '') NOT LIKE '%(Admin ปรับปรุงเวลา)%' AND COALESCE(reason, '') NOT LIKE '%(HR ลงเวลาแทน)%')) + (SELECT COUNT(*) FROM advance_requests WHERE status = 'PENDING') as total_pending`).first().catch(() => ({ total_pending: 0 })),
        db.prepare('SELECT key, value FROM attendance_settings').all().catch(() => ({ results: [] })),
        db.prepare('SELECT holiday_name, holiday_type FROM company_holidays WHERE date = ?').bind(targetDate).first().catch(() => null)
      ]);

      const branches = branchRows.results || [];
      const pendingLeaves = reqData.pendingLeaves;
      const pendingOts = reqData.pendingOts;
      const pendingAdvances = reqData.pendingAdvances;
      const pendingApprovals = pendingCountRow?.total_pending || 0;
      const targetHoliday = targetHolidayRow || null;
      const isSunday = (new Date(targetDate + 'T00:00:00').getDay() === 0);

      // 4. Map approved leaves on targetDate and check conflicts for each log's own date
      const allWindowLeaves = approvedLeavesOnDate.results || [];
      const leaveOnTargetDateMap = {};
      for (const lr of allWindowLeaves) {
        const sD = String(lr.start_date || '').substring(0, 10);
        const eD = String(lr.end_date || '').substring(0, 10);
        if (targetDate >= sD && targetDate <= eD) {
          const k = String(lr.emp_id || '').trim();
          if (k) leaveOnTargetDateMap[k] = lr;
          leaveOnTargetDateMap[lr.emp_id] = lr;
        }
      }
      for (const l of logsToday) {
        const lEmp = String(l.emp_id || '').trim();
        const lDate = String(l.date || targetDate).substring(0, 10);
        const matchedLr = allWindowLeaves.find(lr => {
          const k = String(lr.emp_id || '').trim();
          const sD = String(lr.start_date || '').substring(0, 10);
          const eD = String(lr.end_date || '').substring(0, 10);
          return (k === lEmp || lr.emp_id === l.emp_id) && lDate >= sD && lDate <= eD;
        });
        if (matchedLr) {
          l.has_leave_conflict = true;
          l.leave_conflict_info = {
            leave_type: matchedLr.leave_type,
            days_count: matchedLr.days_count,
            time_slot: matchedLr.time_slot || 'FULL',
            status: matchedLr.status,
            reason: matchedLr.reason || ''
          };
        }
      }

      // 5. KPI & Attendance Breakdown for All 5 Cards
      const branchMap = {};
      for (const b of branches) branchMap[b.branch_id] = b;

      // Active employees on targetDate for daily attendance KPI & breakdown (exclude employees who resigned before targetDate)
      const activeEmps = (branchFilter && branchFilter !== 'ALL')
        ? allEmployees.filter(e => e.branch_id === branchFilter && (e.status !== 'Resigned' || (e.resign_date && e.resign_date >= targetDate)))
        : allEmployees.filter(e => e.status !== 'Resigned' || (e.resign_date && e.resign_date >= targetDate));

      // Map logs on targetDate
      const targetLogsMap = {};
      const clockedInList = [];
      const lateList = [];

      for (const log of logsToday) {
        if (log.clock_in && (!log.date || log.date === targetDate)) {
          if (!targetLogsMap[log.emp_id]) {
            targetLogsMap[log.emp_id] = log;
          }
          const morningLate = Number(log.late_minutes || 0);
          const overbreakLate = countOverbreakAsLate ? Number(log.overbreak_minutes || 0) : 0;
          const totalLateToday = morningLate + overbreakLate;

          clockedInList.push({
            id: log.id,
            empId: log.emp_id,
            name: log.full_name || '',
            nickname: log.nickname || '',
            dept: log.department || '',
            position: log.position || '',
            branchId: log.branch_id || log.emp_branch_id || '',
            branchName: log.branch_name || (branchMap[log.branch_id || log.emp_branch_id]?.branch_name) || '',
            clockIn: log.clock_in || '',
            clockOut: log.clock_out || '',
            inPhotoUrl: log.in_photo_url || '',
            outPhotoUrl: log.out_photo_url || '',
            workHours: Number(log.work_hours || 0),
            lateMinutes: totalLateToday,
            morningLateMinutes: morningLate,
            overbreakMinutes: overbreakLate,
            status: log.status || 'NORMAL',
            phone: log.phone || ''
          });

          if (totalLateToday > 0) {
            const bInfo = branchMap[log.branch_id || log.emp_branch_id] || {};
            let lateParts = [];
            if (morningLate > 0) lateParts.push(`เช้า ${morningLate} น.`);
            if (overbreakLate > 0) lateParts.push(`บ่าย ${overbreakLate} น.`);
            lateList.push({
              id: log.id,
              empId: log.emp_id,
              name: log.full_name || '',
              nickname: log.nickname || '',
              dept: log.department || '',
              position: log.position || '',
              branchId: log.branch_id || log.emp_branch_id || '',
              branchName: log.branch_name || bInfo.branch_name || '',
              clockIn: log.clock_in || '',
              lateMinutes: totalLateToday,
              morningLateMinutes: morningLate,
              overbreakMinutes: overbreakLate,
              lateDetails: lateParts.join(', '),
              shiftStart: bInfo.work_start_time || '09:30',
              phone: log.phone || ''
            });
          }
        }
      }

      // Unclocked employees (Active employees who did NOT clock in on targetDate)
      const notClockedInList = [];
      for (const emp of activeEmps) {
        if (emp.is_attendance_exempt === 'true' || emp.is_attendance_exempt === true || emp.is_attendance_exempt === 1 || emp.is_attendance_exempt === '1') continue;
        if (!targetLogsMap[emp.emp_id]) {
          const empBranch = branchMap[emp.branch_id] || {};
          const branchName = empBranch.branch_name || emp.branch_id || 'สำนักงานใหญ่';
          const shiftStart = empBranch.work_start_time || '09:30';
          const shiftEnd = empBranch.work_end_time || '19:00';
          const lr = leaveOnTargetDateMap[emp.emp_id];

          let statusType = 'NOT_CLOCKED_IN';
          if (lr) {
            statusType = 'LEAVE';
          } else if (targetHoliday) {
            statusType = 'HOLIDAY';
          } else if (isSunday) {
            statusType = 'SUNDAY_OFF';
          } else if (targetDate < today) {
            statusType = 'ABSENT';
          } else {
            statusType = 'NOT_CLOCKED_IN';
          }

          notClockedInList.push({
            empId: emp.emp_id,
            name: emp.full_name || '',
            nickname: emp.nickname || '',
            dept: emp.department || '',
            position: emp.position || '',
            branchId: emp.branch_id || 'B01',
            branchName: branchName,
            phone: emp.phone || '',
            shiftStart: shiftStart,
            shiftEnd: shiftEnd,
            shiftText: `${shiftStart} - ${shiftEnd} น.`,
            hasLeave: Boolean(lr),
            leaveId: lr ? lr.id : null,
            leaveStatus: lr ? lr.status : null,
            leaveType: lr ? (lr.leave_type || 'ลาหยุด') : null,
            leaveReason: lr ? (lr.reason || '') : null,
            leaveDays: lr ? (lr.days_count || 1) : 0,
            leaveSlot: lr ? (lr.time_slot || 'FULL') : 'FULL',
            medicalCertUrl: lr ? (lr.medical_cert_url || null) : null,
            statusType: statusType,
            holidayName: targetHoliday ? targetHoliday.holiday_name : null,
            type: lr ? 'LEAVE' : (statusType === 'ABSENT' ? 'ABSENT' : 'NO_EXCUSE')
          });
        }
      }

      // Branch staffing summary
      const branchSummary = branches.map(b => {
        const bEmps = activeEmps.filter(e => e.branch_id === b.branch_id);
        const bIn = clockedInList.filter(c => (c.branchId === b.branch_id));
        const bNot = notClockedInList.filter(n => (n.branchId === b.branch_id));
        const bLate = lateList.filter(l => (l.branchId === b.branch_id));
        return {
          branchId: b.branch_id,
          branchName: b.branch_name,
          workStartTime: b.work_start_time || '09:30',
          workEndTime: b.work_end_time || '19:00',
          totalStaff: bEmps.length,
          clockedIn: bIn.length,
          notClockedIn: bNot.length,
          late: bLate.length
        };
      });

      const kpi = {
        totalEmployees: activeEmps.length,
        clockedIn: clockedInList.length,
        notClockedIn: notClockedInList.length,
        late: lateList.length,
        onLeave: notClockedInList.filter(x => x.hasLeave).length,
        absent: notClockedInList.filter(x => x.statusType === 'ABSENT').length,
        pendingApprovals
      };

      // Settings
      const attSettings = {
        allow_direct_gps: 'true',
        break_tracking_mode: 'AUTO_DEDUCT',
        break_duration_minutes: 60,
        enable_face_detection: 'true',
        unlock_method_password: 'true',
        unlock_method_qr: 'true',
        unlock_method_remote: 'true',
        advance_start_time: '09:00',
        advance_end_time: '18:00',
        leave_type_sick_with_cert: 'true',
        leave_type_sick_no_cert: 'true',
        leave_type_business: 'false',
        leave_type_annual: 'false',
        leave_type_without_pay: 'false',
        system_maintenance_mode: 'false',
        system_maintenance_message: 'ระบบลงเวลา PTN Time อยู่ระหว่างปิดปรับปรุงชั่วคราว เพื่อเพิ่มประสิทธิภาพการทำงาน ขออภัยในความไม่สะดวก',
        enable_payslip: 'true',
        payslip_release_mode: 'CLOSED_PERIODS_ONLY',
        enable_selfie_greetings: 'true',
        enable_selfie_clockin_greetings: 'true',
        enable_selfie_break_greetings: 'true',
        enable_selfie_clockout_greetings: 'true',
        enable_birthday_greeting: 'true',
        enable_saturday_greeting: 'true',
        enable_friday_tgif: 'true',
        selfie_custom_messages: 'สวัสดีตอนเช้าค่ะ วันนี้ยิ้มสดใสมาก ขอให้เป็นวันที่ราบรื่นและมีความสุขนะคะ 🌸\nพร้อมลุยงานวันนี้! ยิ้มรับลูกค้าด้วยหัวใจบริการค่ะ ✨\nเริ่มต้นวันใหม่ด้วยพลังบวก ขอให้การทำงานวันนี้ราบรื่นสำเร็จทุกสิ่งนะคะ 💖',
        selfie_custom_messages_break: 'ทานอาหารกลางวันให้อร่อยนะคะ ชาร์จพลังให้เต็มที่ 🍜🍱\nพักสายตาและผ่อนคลายความเหนื่อยล้าสักครู่ค่ะ ☕🍰\nชาร์จพลังเต็มที่แล้ว พร้อมลุยงานช่วงบ่ายอย่างสดชื่นค่ะ 💪✨',
        selfie_custom_messages_out: 'ขอบคุณสำหรับความทุ่มเทในวันนี้นะคะ ทำงานเหนื่อยมาทั้งวันแล้ว เก่งมากๆ ค่ะ 👏💖\nเดินทางกลับบ้านโดยสวัสดิภาพนะคะ พักผ่อนให้เต็มที่ พรุ่งนี้พบกันใหม่ค่ะ 🚗🏠\nทำงานสำเร็จไปอีกวันแล้ว วันนี้คุณทำได้ยอดเยี่ยมมากค่ะ 🌟'
      };
      for (const r of setRows.results || []) attSettings[r.key] = r.value;

      let dateDisplay = filterDate;
      if (dateMode === 'PERIOD' && cutoffInfo) {
        dateDisplay = `รอบตัดวิก (${cutoffInfo.startDate} ถึง ${cutoffInfo.endDate})`;
      } else if (dateMode === 'MONTH') {
        dateDisplay = `เดือน ${filterMonth}`;
      } else if (dateMode === 'RANGE') {
        dateDisplay = `${startDate} ถึง ${endDate}`;
      }

      return {
        success: true,
        today,
        date: filterDate,
        dateDisplay,
        dateMode,
        filterMonth,
        startDate,
        endDate,
        isIndividualView: isIndividual,
        selectedEmp,
        selectedEmpInfo: selectedEmp,
        empSummary,
        employeeList,
        logsToday,
        pendingLeaves,
        pendingOts,
        pendingAdvances,
        cutoffDates: cutoffInfo,
        reqCutoffDates: reqCutoff,
        settings: attSettings,
        branches,
        kpi,
        attendanceBreakdown: {
          targetDate,
          clockedInList,
          notClockedInList,
          lateList,
          branchSummary,
          targetHoliday: targetHoliday ? targetHoliday.holiday_name : null,
          isSunday
        }
      };
  },

  getAttendancePeriodSummary: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const isAllowed = await userHasPermission(db, callerUser, 'view_attendance');
      if (!isAllowed) {
        return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าถึงรายงานสรุปเวลา' };
      }

      const nowUtc = new Date();
      const bangkokTime = new Date(nowUtc.getTime() + (7 * 3600 * 1000));
      const today = bangkokTime.toISOString().substring(0, 10);

      let period = params.period ? String(params.period).trim() : '';
      if (!period) {
        let curY = bangkokTime.getFullYear();
        let curM = bangkokTime.getMonth() + 1;
        let curD = bangkokTime.getDate();
        if (curD > 25) {
          curM++;
          if (curM > 12) { curM = 1; curY++; }
        }
        period = `${curY}-${String(curM).padStart(2, '0')}`;
      }
      const branchId = String(params.branchId || params.branch_id || 'ALL').trim();
      const empId = params.empId ? String(params.empId).trim() : null;

      const cutoffInfo = await getCutoffDatesForPeriod(db, period);
      const startDate = cutoffInfo.startDate;
      const endDate = cutoffInfo.endDate;
      const isCurrentActivePeriod = (today >= startDate && today <= endDate);

      // Load Company Holidays
      const holidaysRows = await db.prepare('SELECT * FROM company_holidays WHERE date BETWEEN ? AND ? ORDER BY date ASC').bind(startDate, endDate).all().catch(() => ({ results: [] }));
      const companyHolidays = holidaysRows.results || [];
      const holidayMap = {};
      const holidayDatesSet = new Set();
      for (const h of companyHolidays) {
        holidayMap[h.date] = h;
        holidayDatesSet.add(h.date);
      }
      const totalExpectedWorkDays = getActualWorkingDaysInCutoff(startDate, endDate, holidayDatesSet) || 26;

      // Build working dates list (Mon-Sat, non-Sunday)
      const workingDates = [];
      let dCur = new Date(startDate + 'T00:00:00Z');
      const dEnd = new Date(endDate + 'T00:00:00Z');
      while (dCur <= dEnd) {
        if (dCur.getUTCDay() !== 0) {
          workingDates.push(dCur.toISOString().substring(0, 10));
        }
        dCur.setUTCDate(dCur.getUTCDate() + 1);
      }

      // Load Branches
      const branchQuery = await db.prepare("SELECT * FROM branches ORDER BY branch_id ASC").all().catch(() => ({ results: [] }));
      const branches = branchQuery.results || [];
      const branchMap = {};
      for (const b of branches) branchMap[b.branch_id] = b;

      // Load Employees (Include all active working staff: Active, Probation, and mid-period Resigned)
      const isCallerSuper = (await isUserSuperAdmin(db, callerUser));
      let empSql = "SELECT emp_id, full_name, nickname, department, position, branch_id, base_salary, is_ot_eligible, diligence_allowance, status, join_date, resign_date, is_attendance_exempt, is_break_exempt FROM employees WHERE 1=1";
      if (!isCallerSuper) {
        empSql += " AND (is_confidential IS NULL OR is_confidential = 0)";
      }
      const empBinds = [];
      if (branchId && branchId !== 'ALL') {
        empSql += " AND branch_id = ?";
        empBinds.push(branchId);
      }
      if (empId) {
        empSql += " AND emp_id = ?";
        empBinds.push(empId);
      }
      empSql += " ORDER BY emp_id ASC";
      const empQuery = await db.prepare(empSql).bind(...empBinds).all().catch(() => ({ results: [] }));
      const employees = empQuery.results || [];

      // Load Time Logs in Cutoff Window
      let tlSql = "SELECT id, emp_id, date, clock_in, clock_out, break_out, break_in, work_hours, ot_hours, late_minutes, break_minutes, overbreak_minutes, status, branch_id, is_full_pay, remark, in_lat, in_lng, out_lat, out_lng, break_out_lat, break_out_lng, break_in_lat, break_in_lng FROM time_logs WHERE date BETWEEN ? AND ? ORDER BY date ASC, clock_in ASC";
      const tlQuery = await db.prepare(tlSql).bind(startDate, endDate).all().catch(() => ({ results: [] }));
      const allLogs = tlQuery.results || [];

      // Load Approved Leaves
      let lvSql = "SELECT id, emp_id, start_date, end_date, COALESCE(days_count, 1) as days_count, COALESCE(time_slot, 'FULL') as time_slot, leave_type, reason, medical_cert_url FROM leave_requests WHERE UPPER(TRIM(status)) = 'APPROVED' AND ((substr(start_date, 1, 10) BETWEEN ? AND ?) OR (substr(end_date, 1, 10) BETWEEN ? AND ?) OR (substr(start_date, 1, 10) <= ? AND substr(end_date, 1, 10) >= ?))";
      const lvQuery = await db.prepare(lvSql).bind(startDate, endDate, startDate, endDate, startDate, endDate).all().catch(e => { console.error('lvQuery error in getAttendancePeriodSummary:', e); return { results: [] }; });
      const allLeaves = lvQuery.results || [];

      // Load Approved OTs
      let otSql = "SELECT id, emp_id, date, COALESCE(actual_hours, planned_hours, 0) as hours FROM ot_requests WHERE status = 'APPROVED' AND (date BETWEEN ? AND ?)";
      const otQuery = await db.prepare(otSql).bind(startDate, endDate).all().catch(() => ({ results: [] }));
      const allOts = otQuery.results || [];

      // Load Settings for Diligence Allowance
      const setQuery = await db.prepare("SELECT key, value FROM settings WHERE key IN ('DiligenceAllowance', 'DiligenceLateGraceMins', 'DiligenceLateMaxCount', 'AutoDiligenceEnabled', 'CountOverbreakAsLate', 'MissingBreakPenaltyMode')").all().catch(() => ({ results: [] }));
      const setMap = {};
      for (const r of (setQuery.results || [])) setMap[r.key] = r.value;
      const fallbackAllowance = !isNaN(Number(setMap['DiligenceAllowance'])) ? Number(setMap['DiligenceAllowance']) : 1000;
      const graceMins = !isNaN(Number(setMap['DiligenceLateGraceMins'])) ? Number(setMap['DiligenceLateGraceMins']) : 2;
      const maxLateCount = !isNaN(Number(setMap['DiligenceLateMaxCount'])) ? Number(setMap['DiligenceLateMaxCount']) : 1;
      const autoDiligenceEnabled = setMap['AutoDiligenceEnabled'] !== 'false';
      const countOverbreakAsLate = setMap['CountOverbreakAsLate'] !== undefined ? (setMap['CountOverbreakAsLate'] !== 'false' && setMap['CountOverbreakAsLate'] !== '0') : true;
      const missingBreakPenaltyMode = setMap['MissingBreakPenaltyMode'] || 'ALERT_ONLY';

      // Group logs, leaves, and ots by emp_id
      const logsByEmp = {};
      for (const l of allLogs) {
        const k = String(l.emp_id || '').trim();
        if (k) {
          if (!logsByEmp[k]) logsByEmp[k] = {};
          logsByEmp[k][l.date] = l;
        }
      }

      const leavesByEmp = {};
      for (const lr of allLeaves) {
        const k = String(lr.emp_id || '').trim();
        if (k) {
          if (!leavesByEmp[k]) leavesByEmp[k] = [];
          leavesByEmp[k].push(lr);
        }
      }

      const otsByEmp = {};
      for (const o of allOts) {
        const k = String(o.emp_id || '').trim();
        if (k) {
          if (!otsByEmp[k]) otsByEmp[k] = [];
          otsByEmp[k].push(o);
        }
      }

      const summaryList = [];
      const grandTotals = {
        totalEmployees: employees.length,
        totalPresentDays: 0,
        totalAbsentDays: 0,
        totalAbsentTimes: 0,
        totalSickWithCertDays: 0,
        totalSickWithCertTimes: 0,
        totalSickNoCertDays: 0,
        totalSickNoCertTimes: 0,
        totalBusinessDays: 0,
        totalBusinessTimes: 0,
        totalLateTimes: 0,
        totalLateMinutes: 0,
        totalOtHours: 0,
        diligencePassedCount: 0,
        diligenceFailedCount: 0
      };

      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];
        const empKey = String(emp.emp_id || '').trim();
        const empLogs = logsByEmp[empKey] || logsByEmp[emp.emp_id] || {};
        const empLeaves = leavesByEmp[empKey] || leavesByEmp[emp.emp_id] || [];
        const empOts = otsByEmp[empKey] || otsByEmp[emp.emp_id] || [];
        const branch = branchMap[emp.branch_id] || { branch_name: 'ทั่วไป' };

        let presentDays = 0;
        let lateTimes = 0;
        let lateMinutes = 0;
        let otHours = 0;

        // Check if resigned before this period with no logs
        const resignDateStr = emp.resign_date ? normalizeDateToIso(emp.resign_date) : '';
        if (emp.status === 'Resigned') {
          const hasResignInPeriod = resignDateStr && resignDateStr >= startDate;
          const hasLogsInPeriod = (allLogs || []).some(l => l.emp_id === emp.emp_id);
          if (!hasResignInPeriod && !hasLogsInPeriod) {
            continue; // Resigned in past period with no attendance
          }
        }

        // Sum approved OT requests
        const isOtEligible = !(emp.is_ot_eligible === 'false' || emp.is_ot_eligible === false);
        if (isOtEligible) {
          for (const o of empOts) otHours += Number(o.hours) || 0;
        }

        // Check each working date for attendance and late
        const joinDateStr = emp.join_date ? normalizeDateToIso(emp.join_date) : '';
        const dailyRecords = [];
        let absentDays = 0;
        let absentTimes = 0;
        let currentlyAbsentSequence = false;
        let missingBreakOccurrences = 0;
        const isAttendanceExempt = (emp && (emp.is_attendance_exempt === 'true' || emp.is_attendance_exempt === true || emp.is_attendance_exempt === 1 || emp.is_attendance_exempt === '1'));
        const isBreakExempt = (emp && (emp.is_break_exempt === 'true' || emp.is_break_exempt === true || emp.is_break_exempt === 1 || emp.is_break_exempt === '1')) || isAttendanceExempt;

        for (const dateStr of workingDates) {
          const log = empLogs[dateStr];
          let statusText = 'ปกติ';
          let statusColor = '#16a34a';
          let isPresent = false;
          let isLeave = false;
          let isAbsent = false;
          let isHoliday = false;
          let curLateMins = 0;
          let morningLateMins = 0;
          let overBreakMins = 0;
          let curOtHrs = 0;
          let isMissingBreak = false;
          const holidayInfo = holidayMap[dateStr];

          // Check approved leaves first
          let matchingLeave = null;
          for (const lr of empLeaves) {
            const sDate = String(lr.start_date || '').trim().substring(0, 10);
            const eDate = String(lr.end_date || '').trim().substring(0, 10);
            if (sDate && eDate && dateStr >= sDate && dateStr <= eDate) {
              matchingLeave = lr;
              break;
            }
          }

          const empBranch = branchMap[log && log.branch_id ? log.branch_id : emp.branch_id] || (emp ? branchMap[emp.branch_id] : null);
          const sessions = getBranchShiftSessions(empBranch);
          const lunchStart = sessions.lunchStartMin;
          const lunchEnd = sessions.lunchEndMin;
          const morningHours = sessions.morningHours;
          const afternoonHours = sessions.afternoonHours;
          const shiftHours = sessions.totalHours;
          const morningFraction = sessions.morningFraction;
          const afternoonFraction = sessions.afternoonFraction;

          let leaveTimeSlot = 'FULL';
          let leaveDaysCount = 1.0;
          let coversMorning = false;
          let coversAfternoon = false;

          if (matchingLeave) {
            leaveTimeSlot = String(matchingLeave.time_slot || 'FULL').toUpperCase();
            leaveDaysCount = Number(matchingLeave.days_count) || 1.0;
            if (leaveTimeSlot === 'MORNING') {
              coversMorning = true;
            } else if (leaveTimeSlot === 'AFTERNOON') {
              coversAfternoon = true;
            } else if (leaveTimeSlot === 'FULL' && leaveDaysCount >= 1.0) {
              coversMorning = true;
              coversAfternoon = true;
            } else if (leaveDaysCount === 0.5) {
              // 0.5 leave without slot or full: covers whichever half employee did not work
              if (log && log.clock_in) {
                const inM = timeStringToMinutes(log.clock_in);
                if (inM !== null && inM >= lunchStart) {
                  coversMorning = true;
                  leaveTimeSlot = 'MORNING';
                } else {
                  coversAfternoon = true;
                  leaveTimeSlot = 'AFTERNOON';
                }
              } else {
                coversMorning = true;
                leaveTimeSlot = 'MORNING';
              }
            } else {
              coversMorning = true;
              coversAfternoon = true;
            }
          }

          if (log && log.clock_in) {
            const inMin = timeStringToMinutes(log.clock_in);
            const outMin = timeStringToMinutes(log.clock_out);
            const bOutMin = timeStringToMinutes(log.break_out);
            const bInMin = timeStringToMinutes(log.break_in);
            const wHours = Number(log.work_hours) || 0;

            let isHalfAbsent = false;
            let halfAbsentLabel = '';
            let currentAbsentFraction = 0;

            // 1. Morning absence: clocked in at or after lunch start (missed morning) AND not covered by morning leave
            if (!isAttendanceExempt) {
              if (inMin !== null && inMin >= lunchStart && !coversMorning) {
                isHalfAbsent = true;
                currentAbsentFraction = morningFraction;
                halfAbsentLabel = `ขาดงาน (ครึ่งเช้า ${morningHours} ชม.)`;
              }
              // 2. Afternoon absence: clocked in morning, but missed afternoon AND not covered by afternoon leave
              else if (inMin !== null && inMin < lunchStart && !coversAfternoon) {
                const isAfternoonMissing = (outMin !== null && outMin <= lunchEnd) ||
                                           (dateStr < today && (
                                             (bOutMin !== null && bInMin === null && outMin === null) ||
                                             (outMin === null && bInMin === null && wHours <= 0)
                                           ));
                if (isAfternoonMissing) {
                  isHalfAbsent = true;
                  currentAbsentFraction = afternoonFraction;
                  halfAbsentLabel = `ขาดงาน (ครึ่งบ่าย ${afternoonHours} ชม.)`;
                }
              }
            }

            if (isHalfAbsent) {
              isAbsent = true;
              isPresent = true;
              const roundedCurAbsent = Math.round(currentAbsentFraction * 100) / 100;
              presentDays += Math.round((1.0 - roundedCurAbsent) * 100) / 100;
              absentDays += roundedCurAbsent;
              absentTimes++;
              statusText = halfAbsentLabel;
              statusColor = '#dc2626';
              if (currentlyAbsentSequence) {
                currentlyAbsentSequence = false;
              }
            } else {
              isPresent = true;
              if (matchingLeave && (leaveDaysCount === 0.5 || (leaveDaysCount > 0 && leaveDaysCount < 1.0))) {
                let workedFraction = 0.5;
                if (coversMorning) workedFraction = afternoonFraction;
                else if (coversAfternoon) workedFraction = morningFraction;
                presentDays += Math.round(workedFraction * 100) / 100;
              } else {
                presentDays++;
              }
              if (isAttendanceExempt) {
                morningLateMins = 0;
                overBreakMins = 0;
                curLateMins = 0;
              } else {
                morningLateMins = Number(log.late_minutes) || 0;
                if (coversMorning) {
                  if (inMin !== null && inMin >= lunchStart) {
                    const graceMin = branch ? Number(branch.grace_minutes || 0) : 0;
                    morningLateMins = (lunchEnd && inMin > (lunchEnd + graceMin))
                      ? (inMin - lunchEnd)
                      : 0;
                  } else {
                    morningLateMins = 0;
                  }
                }
                overBreakMins = countOverbreakAsLate ? (Number(log.overbreak_minutes) || 0) : 0;
                curLateMins = morningLateMins + overBreakMins;
              }

              let dayLateTimes = 0;
              if (morningLateMins > 0) dayLateTimes++;
              if (overBreakMins > 0) dayLateTimes++;

              if (curLateMins > 0) {
                lateTimes += dayLateTimes;
                lateMinutes += curLateMins;
                let lateDetails = [];
                if (morningLateMins > 0) lateDetails.push(`เช้า ${morningLateMins} น.`);
                if (overBreakMins > 0) lateDetails.push(`บ่าย ${overBreakMins} น.`);
                statusText = `สาย ${curLateMins} น. (${lateDetails.join(', ')})`;
                statusColor = '#ea580c';
              } else if (matchingLeave) {
                isLeave = true;
                const cat = categorizeLeaveType(matchingLeave.leave_type, matchingLeave.medical_cert_url);
                const baseLeaveName = cat === 'SICK_WITH_CERT' ? 'ลาป่วย (มีใบ)' : (cat === 'SICK_NO_CERT' ? 'ลาป่วย (ไม่มีใบ)' : (cat === 'ANNUAL' ? 'ลาพักร้อน' : 'ลากิจ'));
                const slotText = leaveTimeSlot === 'MORNING' ? ' (เช้า 0.5)' : (leaveTimeSlot === 'AFTERNOON' ? ' (บ่าย 0.5)' : ' (0.5)');
                statusText = baseLeaveName + slotText;
                statusColor = '#7c3aed';
              } else {
                statusText = 'ปกติ';
                statusColor = '#16a34a';
              }

              if (!isBreakExempt && log && log.clock_in && log.clock_out && !log.break_out) {
                isMissingBreak = true;
                missingBreakOccurrences++;
                statusText += ' [⚠️ ไม่สแกนพัก]';
                if (statusColor === '#16a34a') {
                  statusColor = '#d97706';
                }
              }

              if (isOtEligible && Number(log.ot_hours) > 0) {
                curOtHrs = Number(log.ot_hours);
                const alreadyInOtReq = empOts.some(o => o.date === dateStr);
                if (!alreadyInOtReq) otHours += curOtHrs;
              }

              if (currentlyAbsentSequence) {
                absentTimes++;
                currentlyAbsentSequence = false;
              }
            }
          } else {
            // Check approved leaves
            if (matchingLeave) {
              isLeave = true;
              const cat = categorizeLeaveType(matchingLeave.leave_type, matchingLeave.medical_cert_url);
              const baseLeaveName = cat === 'SICK_WITH_CERT' ? 'ลาป่วย (มีใบ)' : (cat === 'SICK_NO_CERT' ? 'ลาป่วย (ไม่มีใบ)' : (cat === 'ANNUAL' ? 'ลาพักร้อน' : 'ลากิจ'));

              if (coversMorning && coversAfternoon) {
                statusText = baseLeaveName + ' (เต็มวัน)';
                statusColor = cat === 'SICK_WITH_CERT' ? '#0284c7' : (cat === 'SICK_NO_CERT' ? '#d97706' : (cat === 'ANNUAL' ? '#6366f1' : '#7c3aed'));
              } else if (coversMorning && !coversAfternoon) {
                // Morning leave, but did not come afternoon -> afternoon absent
                if (dateStr < today) {
                  isAbsent = true;
                  absentDays += afternoonFraction;
                  absentTimes++;
                  statusText = `${baseLeaveName} (เช้า) / ขาดบ่าย (${afternoonHours} ชม.)`;
                  statusColor = '#dc2626';
                } else {
                  statusText = `${baseLeaveName} (เช้า 0.5)`;
                  statusColor = '#7c3aed';
                }
              } else if (coversAfternoon && !coversMorning) {
                // Afternoon leave, but did not come morning -> morning absent
                if (dateStr < today) {
                  isAbsent = true;
                  absentDays += morningFraction;
                  absentTimes++;
                  statusText = `ขาดเช้า (${morningHours} ชม.) / ${baseLeaveName} (บ่าย)`;
                  statusColor = '#dc2626';
                } else {
                  statusText = `${baseLeaveName} (บ่าย 0.5)`;
                  statusColor = '#7c3aed';
                }
              } else {
                // Legacy 0.5
                if (dateStr < today) {
                  isAbsent = true;
                  absentDays += 0.5;
                  absentTimes++;
                  statusText = `${baseLeaveName} 0.5 / ขาด 0.5`;
                  statusColor = '#dc2626';
                } else {
                  statusText = `${baseLeaveName} (0.5)`;
                  statusColor = '#7c3aed';
                }
              }

              if (currentlyAbsentSequence) {
                absentTimes++;
                currentlyAbsentSequence = false;
              }
            } else if (holidayInfo) {
              isHoliday = true;
              statusText = `วันหยุด: ${holidayInfo.holiday_name}`;
              statusColor = '#0d9488';
              if (currentlyAbsentSequence) {
                absentTimes++;
                currentlyAbsentSequence = false;
              }
            } else if (joinDateStr && dateStr < joinDateStr) {
              statusText = 'ยังไม่เริ่มงาน';
              statusColor = '#94a3b8';
              if (currentlyAbsentSequence) {
                absentTimes++;
                currentlyAbsentSequence = false;
              }
            } else if (resignDateStr && dateStr > resignDateStr) {
              statusText = 'ลาออกแล้ว';
              statusColor = '#94a3b8';
              if (currentlyAbsentSequence) {
                absentTimes++;
                currentlyAbsentSequence = false;
              }
            } else if (dateStr < today) {
              if (isAttendanceExempt) {
                isPresent = true;
                presentDays += 1.0;
                statusText = 'ยกเว้นการลงเวลา';
                statusColor = '#64748b';
              } else {
                isAbsent = true;
                absentDays += 1.0;
                statusText = 'ขาดงาน';
                statusColor = '#dc2626';
                currentlyAbsentSequence = true;
              }
            } else if (dateStr === today) {
              if (isAttendanceExempt) {
                isPresent = true;
                presentDays += 1.0;
                statusText = 'ยกเว้นการลงเวลา';
                statusColor = '#64748b';
              } else {
                statusText = 'ยังไม่ลงเวลา';
                statusColor = '#94a3b8';
                if (currentlyAbsentSequence) {
                  absentTimes++;
                  currentlyAbsentSequence = false;
                }
              }
            } else {
              statusText = 'ยังไม่ถึงวัน';
              statusColor = '#94a3b8';
            }
          }

          dailyRecords.push({
            date: dateStr,
            dayOfWeek: new Date(dateStr + 'T00:00:00Z').toLocaleDateString('th-TH', { weekday: 'short' }),
            clockIn: (log && log.clock_in) ? log.clock_in : '-',
            clockOut: (log && log.clock_out) ? log.clock_out : '-',
            breakOut: (log && log.break_out) ? log.break_out : '-',
            breakIn: (log && log.break_in) ? log.break_in : '-',
            morningLateMinutes: morningLateMins,
            overbreakMinutes: overBreakMins,
            lateMinutes: curLateMins,
            otHours: curOtHrs,
            statusText,
            statusColor,
            isPresent,
            isLeave,
            isAbsent,
            isHoliday,
            missingBreak: isMissingBreak,
            isBreakExempt,
            holidayName: holidayInfo ? holidayInfo.holiday_name : '',
            remark: (log && log.remark) ? log.remark : ''
          });
        }

        if (currentlyAbsentSequence) {
          absentTimes++;
          currentlyAbsentSequence = false;
        }

        // Calculate leave counts
        const empSessions = getBranchShiftSessions(branch);
        const morningFraction = empSessions.morningFraction;
        const afternoonFraction = empSessions.afternoonFraction;
        const lunchStart = empSessions.lunchStartMin;

        let sickWithCertDays = 0, sickWithCertTimes = 0;
        let sickNoCertDays = 0, sickNoCertTimes = 0;
        let businessLeaveDays = 0, businessLeaveTimes = 0;

        for (const lr of empLeaves) {
          const sDate = String(lr.start_date || '').trim().substring(0, 10);
          const eDate = String(lr.end_date || '').trim().substring(0, 10);
          let daysInCutoff = 0;
          if (sDate && eDate) {
            let dCurLv = new Date(sDate + 'T00:00:00Z');
            const dEndLv = new Date(eDate + 'T00:00:00Z');
            while (dCurLv <= dEndLv) {
              const dStr = dCurLv.toISOString().substring(0, 10);
              if (dStr >= startDate && dStr <= endDate && dCurLv.getUTCDay() !== 0) {
                daysInCutoff++;
              }
              dCurLv.setUTCDate(dCurLv.getUTCDate() + 1);
            }
          }

          if (sDate === eDate && Number(lr.days_count) > 0 && Number(lr.days_count) < daysInCutoff) {
            let origDaysInLeave = Number(lr.days_count);
            if (origDaysInLeave === 0.5) {
              let lrSlot = String(lr.time_slot || '').toUpperCase();
              if (!lrSlot || lrSlot === 'FULL') {
                const tl = empLogs[sDate];
                if (tl && tl.clock_in) {
                  const inM = timeStringToMinutes(tl.clock_in);
                  if (inM !== null && inM >= lunchStart) lrSlot = 'MORNING';
                  else lrSlot = 'AFTERNOON';
                }
              }
              if (lrSlot === 'MORNING') {
                origDaysInLeave = morningFraction;
              } else if (lrSlot === 'AFTERNOON') {
                origDaysInLeave = afternoonFraction;
              }
            }
            daysInCutoff = origDaysInLeave;
          }

          if (daysInCutoff > 0) {
            const cat = categorizeLeaveType(lr.leave_type, lr.medical_cert_url);
            if (cat === 'SICK_WITH_CERT') {
              sickWithCertDays += daysInCutoff;
              sickWithCertTimes++;
            } else if (cat === 'SICK_NO_CERT') {
              sickNoCertDays += daysInCutoff;
              sickNoCertTimes++;
            } else if (cat === 'BUSINESS') {
              businessLeaveDays += daysInCutoff;
              businessLeaveTimes++;
            }
          }
        }

        // Diligence allowance evaluation
        const targetAllowance = (emp.diligence_allowance !== null && !isNaN(Number(emp.diligence_allowance)) && Number(emp.diligence_allowance) > 0)
          ? Number(emp.diligence_allowance)
          : fallbackAllowance;

        let isDiligenceQualified = true;
        const disqualifyReasons = [];

        if (autoDiligenceEnabled) {
          if (isAttendanceExempt) {
            // Exempt personnel (e.g. executives, pharmacists) do not scan clock-in and are not disqualified
          } else {
            if (joinDateStr && joinDateStr > startDate) {
              disqualifyReasons.push('พนักงานเข้าใหม่ระหว่างงวด (ทำงานไม่เต็มงวด)');
            }
            if (emp.status === 'Resigned' || (emp.resign_date && normalizeDateToIso(emp.resign_date) < endDate)) {
              disqualifyReasons.push('พนักงานลาออกระหว่างงวด');
            }
            if (presentDays === 0) {
              disqualifyReasons.push('ไม่มีประวัติการลงเวลาในงวดนี้');
            }
            if (absentDays > 0) {
              disqualifyReasons.push(`ขาดงาน ${absentDays} วัน (${absentTimes} ครั้ง)`);
            }
            if (businessLeaveDays > 0) {
              disqualifyReasons.push(`ลากิจ ${businessLeaveDays} วัน`);
            }
            if (sickNoCertDays > 0) {
              disqualifyReasons.push(`ลาป่วยไม่มีใบรับรอง ${sickNoCertDays} วัน`);
            }
            if (sickWithCertDays > 0) {
              disqualifyReasons.push(`ลาป่วยมีใบรับรอง ${sickWithCertDays} วัน`);
            }
            if (lateTimes > maxLateCount) {
              disqualifyReasons.push(`มาสาย ${lateTimes} ครั้ง (เกินเกณฑ์ ${maxLateCount} ครั้ง)`);
            }

            for (const rec of dailyRecords) {
              if (!rec.isHoliday) {
                if (rec.morningLateMinutes > graceMins) {
                  disqualifyReasons.push(`สายเช้าเกินเกณฑ์ วันที่ ${rec.date.substring(8)} (${rec.morningLateMinutes} นาที > ${graceMins} นาที)`);
                  break;
                }
                if (countOverbreakAsLate && rec.overbreakMinutes > graceMins) {
                  disqualifyReasons.push(`เข้าบ่ายสายเกินเกณฑ์ วันที่ ${rec.date.substring(8)} (${rec.overbreakMinutes} นาที > ${graceMins} นาที)`);
                  break;
                }
              }
            }

            if (missingBreakPenaltyMode === 'DILIGENCE_DISQUALIFY' && missingBreakOccurrences > 0) {
              disqualifyReasons.push(`ไม่สแกนออกพัก ${missingBreakOccurrences} ครั้ง (ผิดระเบียบการสแกนพัก)`);
            } else if (missingBreakPenaltyMode === 'DILIGENCE_DISQUALIFY_EXCEED' && missingBreakOccurrences > 1) {
              disqualifyReasons.push(`ไม่สแกนออกพัก ${missingBreakOccurrences} ครั้ง (เกินโควตา 1 ครั้ง)`);
            }
          }

          if (disqualifyReasons.length > 0) {
            isDiligenceQualified = false;
          }
        }

        // Compute real GPS Geofence statistics for this employee across all logs in period
        const bLat = Number(branch.lat) || 15.678515;
        const bLng = Number(branch.lng) || 100.090373;
        const bRadius = Number(branch.radius_meters) || 40;
        let gpsScanCount = 0;
        let geofenceFailCount = 0;
        let sumGpsDist = 0;
        let maxGpsDist = 0;
        let lastGpsDist = null;
        let lastGpsBearing = null;
        let lastGpsLat = null;
        let lastGpsLng = null;

        const calcDistBrng = (lat1, lng1, lat2, lng2) => {
          const R = 6371000;
          const toRad = d => (d * Math.PI) / 180;
          const toDeg = r => (r * 180) / Math.PI;
          const dLat = toRad(lat2 - lat1);
          const dLng = toRad(lng2 - lng1);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const dist = Math.round(R * c * 10) / 10;
          const y = Math.sin(dLng) * Math.cos(toRad(lat2));
          const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
                    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
          const brng = Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
          return { dist, brng };
        };

        for (const dKey of Object.keys(empLogs)) {
          const lg = empLogs[dKey];
          if (!lg) continue;
          const logBranch = branchMap[lg.branch_id || emp.branch_id] || branch;
          const refLat = Number(logBranch.lat) || bLat;
          const refLng = Number(logBranch.lng) || bLng;
          const refRad = Number(logBranch.radius_meters) || bRadius;

          if (lg.status === 'GEOFENCE_FAIL') geofenceFailCount++;

          const pts = [
            [lg.in_lat, lg.in_lng],
            [lg.break_out_lat, lg.break_out_lng],
            [lg.break_in_lat, lg.break_in_lng],
            [lg.out_lat, lg.out_lng]
          ];
          for (const [pLat, pLng] of pts) {
            const nLat = Number(pLat);
            const nLng = Number(pLng);
            if (pLat !== null && pLat !== undefined && pLat !== '' && !isNaN(nLat) && !isNaN(nLng) && nLat > 5 && nLng > 90) {
              const { dist, brng } = calcDistBrng(refLat, refLng, nLat, nLng);
              gpsScanCount++;
              sumGpsDist += dist;
              if (dist > maxGpsDist) maxGpsDist = dist;
              lastGpsDist = dist;
              lastGpsBearing = brng;
              lastGpsLat = nLat;
              lastGpsLng = nLng;
              if (dist > refRad + 15 && lg.status !== 'GEOFENCE_FAIL') {
                geofenceFailCount++;
              }
            }
          }
        }
        const avgGpsDistance = gpsScanCount > 0 ? Math.round((sumGpsDist / gpsScanCount) * 10) / 10 : null;

        const empRow = {
          no: i + 1,
          empId: emp.emp_id,
          fullName: emp.full_name || emp.emp_id,
          nickname: emp.nickname || '-',
          branchId: emp.branch_id || '-',
          branchName: branch.branch_name || '-',
          position: emp.position || '-',
          department: emp.department || '-',
          status: emp.status || 'Active',
          resignDate: emp.resign_date || '',
          baseSalary: Number(emp.base_salary) || 0,
          expectedWorkDays: totalExpectedWorkDays,
          presentDays: Math.round(presentDays * 100) / 100,
          absentDays: Math.round(absentDays * 100) / 100,
          absentTimes,
          sickWithCertDays: Math.round(sickWithCertDays * 100) / 100,
          sickWithCertTimes,
          sickNoCertDays: Math.round(sickNoCertDays * 100) / 100,
          sickNoCertTimes,
          businessLeaveDays: Math.round(businessLeaveDays * 100) / 100,
          businessLeaveTimes,
          lateTimes,
          lateMinutes,
          otHours: Math.round(otHours * 100) / 100,
          missingBreakCount: missingBreakOccurrences,
          isBreakExempt: isBreakExempt,
          isAttendanceExempt: isAttendanceExempt,
          isDiligenceQualified,
          diligenceAmount: isDiligenceQualified ? targetAllowance : 0,
          diligenceDisqualifyReason: disqualifyReasons.join(', '),
          gpsScanCount,
          avgGpsDistance,
          maxGpsDistance: gpsScanCount > 0 ? maxGpsDist : null,
          lastGpsDistance: lastGpsDist,
          lastGpsBearing,
          lastGpsLat,
          lastGpsLng,
          geofenceFailCount,
          branchRadius: bRadius,
          branchLat: bLat,
          branchLng: bLng,
          dailyRecords
        };

        summaryList.push(empRow);

        grandTotals.totalPresentDays += presentDays;
        grandTotals.totalAbsentDays += absentDays;
        grandTotals.totalAbsentTimes += absentTimes;
        grandTotals.totalSickWithCertDays += sickWithCertDays;
        grandTotals.totalSickWithCertTimes += sickWithCertTimes;
        grandTotals.totalSickNoCertDays += sickNoCertDays;
        grandTotals.totalSickNoCertTimes += sickNoCertTimes;
        grandTotals.totalBusinessDays += businessLeaveDays;
        grandTotals.totalBusinessTimes += businessLeaveTimes;
        grandTotals.totalLateTimes += lateTimes;
        grandTotals.totalLateMinutes += lateMinutes;
        grandTotals.totalOtHours += empRow.otHours;
        if (isDiligenceQualified) {
          grandTotals.diligencePassedCount++;
        } else {
          grandTotals.diligenceFailedCount++;
        }
      }

      grandTotals.totalPresentDays = Math.round(grandTotals.totalPresentDays * 100) / 100;
      grandTotals.totalAbsentDays = Math.round(grandTotals.totalAbsentDays * 100) / 100;
      grandTotals.totalSickWithCertDays = Math.round(grandTotals.totalSickWithCertDays * 100) / 100;
      grandTotals.totalSickNoCertDays = Math.round(grandTotals.totalSickNoCertDays * 100) / 100;
      grandTotals.totalBusinessDays = Math.round(grandTotals.totalBusinessDays * 100) / 100;
      grandTotals.totalOtHours = Math.round(grandTotals.totalOtHours * 100) / 100;

      return {
        success: true,
        period,
        cutoffInfo: {
          startDate,
          endDate,
          totalExpectedWorkDays,
          cutoffDay: cutoffInfo.cutoffDay,
          isCurrentActivePeriod
        },
        countOverbreakAsLate,
        branchId: branchId || 'ALL',
        branches,
        grandTotals,
        summaryList,
        companyHolidays
      };
  },

  handleAttendanceApproval: async (db, params) => {
      const approverId = params.username || 'Admin';
      const allowed = await userHasPermission(db, approverId, 'approve_attendance');
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์อนุมัติคำขอ' };

      const { type, id, decision, rejectionReason } = params;
      let status = 'APPROVED';
      if (decision === 'REJECT') {
        status = 'REJECTED';
      } else if (decision === 'PENDING' || decision === 'RESET') {
        status = 'PENDING';
      }

      if (decision === 'DELETE') {
        return await executeDeleteAttendanceRequest(db, type, id, approverId);
      }

      // Fetch request details before update to get target employee
      let targetEmpId = null;
      let reqDesc = '';
      if (type === 'leave') {
        const row = await db.prepare('SELECT emp_id, leave_type, days_count FROM leave_requests WHERE id = ?').bind(id).first().catch(() => null);
        if (row) { targetEmpId = row.emp_id; reqDesc = `ขอลางาน (${row.leave_type || ''}) ${row.days_count || 1} วัน`; }
      } else if (type === 'ot') {
        const row = await db.prepare('SELECT emp_id, planned_hours, date FROM ot_requests WHERE id = ?').bind(id).first().catch(() => null);
        if (row) { targetEmpId = row.emp_id; reqDesc = `ขอทำ OT ${row.planned_hours || ''} ชม. (${row.date || ''})`; }
      } else if (type === 'advance') {
        const row = await db.prepare('SELECT emp_id, amount FROM advance_requests WHERE id = ?').bind(id).first().catch(() => null);
        if (row) { targetEmpId = row.emp_id; reqDesc = `ขอเบิกเงินล่วงหน้า ${Number(row.amount || 0).toLocaleString()} บาท`; }
      }

      if (type === 'leave') {
        await db.prepare(`
          UPDATE leave_requests 
          SET status = ?, approver_id = ?, approved_at = datetime('now', '+7 hours'), rejection_reason = ?
          WHERE id = ?
        `).bind(status, approverId, status === 'REJECTED' ? (rejectionReason || '') : '', id).run();
      } else if (type === 'ot') {
        await db.prepare(`
          UPDATE ot_requests 
          SET status = ?, approver_id = ?, approved_at = datetime('now', '+7 hours')
          WHERE id = ?
        `).bind(status, approverId, id).run();
      } else if (type === 'advance') {
        await db.prepare(`
          UPDATE advance_requests 
          SET status = ?, approver_id = ?, approved_at = datetime('now', '+7 hours'), rejection_reason = ?
          WHERE id = ?
        `).bind(status, approverId, status === 'REJECTED' ? (rejectionReason || '') : '', id).run();
      }

      // Send Real Web Push to employee
      if (targetEmpId && (status === 'APPROVED' || status === 'REJECTED')) {
        const isApproved = status === 'APPROVED';
        const notifTitle = isApproved ? '✅ คำขอได้รับการอนุมัติแล้ว' : '❌ คำขอไม่ได้รับการอนุมัติ';
        const notifBody = isApproved
          ? `คำขอ${reqDesc} ได้รับการอนุมัติแล้วโดย ${approverId || 'Admin'}`
          : `คำขอ${reqDesc} ไม่ได้รับการอนุมัติ ${rejectionReason ? `(เหตุผล: ${rejectionReason})` : ''}`;
        sendPushToEmployee(db, targetEmpId, {
          title: notifTitle,
          body: notifBody,
          url: '/?tab=history',
          tag: `approval-${type}-${id}`
        }).catch(err => console.error('sendPushToEmployee error:', err));
      }

      await logSystemActivity(db, approverId, 'ATTENDANCE_APPROVAL', `${status} คำขอ ${type} (ID: ${id})`);
      const msg = status === 'APPROVED' ? 'อนุมัติคำขอเรียบร้อยแล้ว' : (status === 'PENDING' ? 'เปลี่ยนสถานะเป็นรออนุมัติแล้ว' : 'ปฏิเสธคำขอเรียบร้อยแล้ว');
      return { success: true, message: msg };
  },

  batchHandleAttendanceApprovals: async (db, params) => {
      const approverId = params.username || 'Admin';
      const allowed = await userHasPermission(db, approverId, 'approve_attendance');
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์อนุมัติคำขอ' };

      const items = Array.isArray(params.items) ? params.items : [];
      const decision = params.decision || 'APPROVE';
      const rejectionReason = params.rejectionReason || '';

      if (items.length === 0) {
        return { success: false, message: 'กรุณาเลือกรายการคำขออย่างน้อย 1 รายการ' };
      }

      let status = 'APPROVED';
      if (decision === 'REJECT') {
        status = 'REJECTED';
      } else if (decision === 'PENDING' || decision === 'RESET') {
        status = 'PENDING';
      }

      let processedCount = 0;
      for (const reqItem of items) {
        const type = reqItem && reqItem.type;
        const id = reqItem && reqItem.id;
        if (!type || !id) continue;

        if (decision === 'DELETE') {
          const delRes = await executeDeleteAttendanceRequest(db, type, id, approverId).catch(() => null);
          if (delRes && delRes.success) processedCount++;
          continue;
        }

        let targetEmpId = null;
        let reqDesc = '';
        if (type === 'leave') {
          const row = await db.prepare('SELECT emp_id, leave_type, days_count FROM leave_requests WHERE id = ?').bind(id).first().catch(() => null);
          if (row) { targetEmpId = row.emp_id; reqDesc = `ขอลางาน (${row.leave_type || ''}) ${row.days_count || 1} วัน`; }
          await db.prepare(`
            UPDATE leave_requests 
            SET status = ?, approver_id = ?, approved_at = datetime('now', '+7 hours'), rejection_reason = ?
            WHERE id = ?
          `).bind(status, approverId, status === 'REJECTED' ? rejectionReason : '', id).run();
          processedCount++;
        } else if (type === 'ot') {
          const row = await db.prepare('SELECT emp_id, planned_hours, date FROM ot_requests WHERE id = ?').bind(id).first().catch(() => null);
          if (row) { targetEmpId = row.emp_id; reqDesc = `ขอทำ OT ${row.planned_hours || ''} ชม. (${row.date || ''})`; }
          await db.prepare(`
            UPDATE ot_requests 
            SET status = ?, approver_id = ?, approved_at = datetime('now', '+7 hours')
            WHERE id = ?
          `).bind(status, approverId, id).run();
          processedCount++;
        } else if (type === 'advance') {
          const row = await db.prepare('SELECT emp_id, amount FROM advance_requests WHERE id = ?').bind(id).first().catch(() => null);
          if (row) { targetEmpId = row.emp_id; reqDesc = `ขอเบิกเงินล่วงหน้า ${Number(row.amount || 0).toLocaleString()} บาท`; }
          await db.prepare(`
            UPDATE advance_requests 
            SET status = ?, approver_id = ?, approved_at = datetime('now', '+7 hours'), rejection_reason = ?
            WHERE id = ?
          `).bind(status, approverId, status === 'REJECTED' ? rejectionReason : '', id).run();
          processedCount++;
        }

        if (targetEmpId && (status === 'APPROVED' || status === 'REJECTED')) {
          const isApproved = status === 'APPROVED';
          const notifTitle = isApproved ? '✅ คำขอได้รับการอนุมัติแล้ว' : '❌ คำขอไม่ได้รับการอนุมัติ';
          const notifBody = isApproved
            ? `คำขอ${reqDesc} ได้รับการอนุมัติแล้วโดย ${approverId || 'Admin'}`
            : `คำขอ${reqDesc} ไม่ได้รับการอนุมัติ ${rejectionReason ? `(เหตุผล: ${rejectionReason})` : ''}`;
          sendPushToEmployee(db, targetEmpId, {
            title: notifTitle,
            body: notifBody,
            url: '/?tab=history',
            tag: `approval-${type}-${id}`
          }).catch(err => console.error('sendPushToEmployee error:', err));
        }
      }

      const actionLabel = decision === 'DELETE' ? 'ลบถาวร' : (status === 'APPROVED' ? 'อนุมัติ' : (status === 'REJECTED' ? 'ปฏิเสธ' : 'รีเซ็ตสถานะ'));
      await logSystemActivity(db, approverId, 'BATCH_ATTENDANCE_APPROVAL', `${actionLabel}คำขอแบบกลุ่ม จำนวน ${processedCount} รายการ`);
      return {
        success: true,
        count: processedCount,
        message: `${actionLabel}คำขอเรียบร้อยแล้ว ${processedCount} รายการ`
      };
  },

  deleteAttendanceRequest: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const allowed = await userHasPermission(db, callerUser, 'approve_attendance');
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ลบคำขอ' };

      const { type, id } = params;
      if (!type || !id) return { success: false, message: 'ระบุ type และ id' };

      return await executeDeleteAttendanceRequest(db, type, id, callerUser);
  },

  updateAttendanceRequest: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const allowed = await userHasPermission(db, callerUser, 'approve_attendance');
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์แก้ไขคำขอ' };

      const { type, id, updates } = params;
      if (!type || !id || !updates) return { success: false, message: 'ระบุข้อมูลไม่ครบถ้วน' };

      if (type === 'leave') {
        const { leaveType, startDate, endDate, daysCount, timeSlot, reason, status } = updates;
        const validStatus = status || 'PENDING';
        const finalSlot = String(timeSlot || (Number(daysCount) === 0.5 ? 'MORNING' : 'FULL')).toUpperCase();
        await db.prepare(`
          UPDATE leave_requests
          SET leave_type = ?, start_date = ?, end_date = ?, days_count = ?, time_slot = ?, reason = ?, status = ?
          WHERE id = ?
        `).bind(leaveType, normalizeDateToIso(startDate), normalizeDateToIso(endDate), Number(daysCount) || 1.0, finalSlot, reason || '', validStatus, id).run();
        if (validStatus === 'APPROVED' || validStatus === 'REJECTED') {
          const empRow = await db.prepare('SELECT emp_id FROM leave_requests WHERE id = ?').bind(id).first().catch(() => null);
          if (empRow && empRow.emp_id) {
            sendPushToEmployee(db, empRow.emp_id, {
              title: validStatus === 'APPROVED' ? '✅ คำขอลางานได้รับการอนุมัติแล้ว' : '❌ คำขอลางานไม่ได้รับการอนุมัติ',
              body: `คำขอลางานของคุณได้รับการปรับปรุงสถานะเป็น ${validStatus === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ'} โดยผู้ดูแลระบบ`,
              url: '/?tab=history',
              tag: `approval-leave-${id}`
            }).catch(() => {});
          }
        }
      } else if (type === 'ot') {
        const { date, startTime, endTime, hours, reason, status } = updates;
        const validStatus = status || 'PENDING';
        await db.prepare(`
          UPDATE ot_requests
          SET date = ?, start_time = ?, end_time = ?, planned_hours = ?, actual_hours = ?, reason = ?, status = ?
          WHERE id = ?
        `).bind(normalizeDateToIso(date), startTime || '', endTime || '', Number(hours) || 0, Number(hours) || 0, reason || '', validStatus, id).run();
        if (validStatus === 'APPROVED' || validStatus === 'REJECTED') {
          const empRow = await db.prepare('SELECT emp_id FROM ot_requests WHERE id = ?').bind(id).first().catch(() => null);
          if (empRow && empRow.emp_id) {
            sendPushToEmployee(db, empRow.emp_id, {
              title: validStatus === 'APPROVED' ? '✅ คำขอทำ OT ได้รับการอนุมัติแล้ว' : '❌ คำขอทำ OT ไม่ได้รับการอนุมัติ',
              body: `คำขอทำ OT ของคุณได้รับการปรับปรุงสถานะเป็น ${validStatus === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ'} โดยผู้ดูแลระบบ`,
              url: '/?tab=history',
              tag: `approval-ot-${id}`
            }).catch(() => {});
          }
        }
      } else if (type === 'advance') {
        const { requestDate, amount, reason, status } = updates;
        const validStatus = status || 'PENDING';
        await db.prepare(`
          UPDATE advance_requests
          SET request_date = ?, amount = ?, reason = ?, status = ?
          WHERE id = ?
        `).bind(normalizeDateToIso(requestDate), Number(amount) || 0, reason || '', validStatus, id).run();
        if (validStatus === 'APPROVED' || validStatus === 'REJECTED') {
          const empRow = await db.prepare('SELECT emp_id FROM advance_requests WHERE id = ?').bind(id).first().catch(() => null);
          if (empRow && empRow.emp_id) {
            sendPushToEmployee(db, empRow.emp_id, {
              title: validStatus === 'APPROVED' ? '✅ คำขอเบิกเงินล่วงหน้าได้รับการอนุมัติแล้ว' : '❌ คำขอเบิกเงินล่วงหน้าไม่ได้รับการอนุมัติ',
              body: `คำขอเบิกเงินของคุณได้รับการปรับปรุงสถานะเป็น ${validStatus === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ'} โดยผู้ดูแลระบบ`,
              url: '/?tab=history',
              tag: `approval-advance-${id}`
            }).catch(() => {});
          }
        }
      } else {
        return { success: false, message: 'ประเภทคำขอไม่ถูกต้อง' };
      }

      await logSystemActivity(db, callerUser, 'UPDATE_ATTENDANCE_REQUEST', `แก้ไขข้อมูลคำขอ ${type} (ID: ${id})`);
      return { success: true, message: `บันทึกการแก้ไขคำขอ ${type} เรียบร้อยแล้ว` };
  },

  createAttendanceRequest: async (db, params) => {
    let period = params.period;
      const callerUser = params.username || 'Admin';
      const allowed = (await userHasPermission(db, callerUser, 'create_attendance_requests')) ||
                      (await userHasPermission(db, callerUser, 'approve_attendance')) ||
                      (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์สร้างคำขอแทนพนักงาน' };

      const { requestType, empId, status: rawStatus } = params;
      if (!requestType) return { success: false, message: 'กรุณาระบุประเภทคำขอ (LEAVE, OT, ADVANCE)' };
      if (!empId) return { success: false, message: 'กรุณาระบุพนักงาน' };

      const empRow = await db.prepare('SELECT emp_id, full_name FROM employees WHERE emp_id = ?').bind(empId).first().catch(() => null);
      if (!empRow) return { success: false, message: `ไม่พบข้อมูลพนักงานรหัส ${empId}` };

      const targetStatus = (rawStatus === 'PENDING' || rawStatus === 'pending') ? 'PENDING' : 'APPROVED';
      const nowStr = new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      const auditNote = `[สร้างแทนโดย HR: ${callerUser} เมื่อ ${nowStr}]`;
      const approverId = targetStatus === 'APPROVED' ? callerUser : null;
      const approvedAt = targetStatus === 'APPROVED' ? nowStr : null;

      let resultMsg = '';

      if (requestType === 'LEAVE') {
        const { leaveType, startDate, endDate, daysCount, timeSlot, reason, medicalCertUrl } = params;
        if (!leaveType) return { success: false, message: 'กรุณาระบุประเภทการลา' };
        if (!startDate || !endDate) return { success: false, message: 'กรุณาระบุช่วงวันที่ลา' };

        const finalDays = Number(daysCount) > 0 ? Number(daysCount) : 1.0;
        const finalSlot = String(timeSlot || (finalDays === 0.5 ? 'MORNING' : 'FULL')).toUpperCase();
        const finalReason = reason ? `${reason} ${auditNote}` : auditNote;

        await db.prepare(`
          INSERT INTO leave_requests (emp_id, leave_type, start_date, end_date, days_count, time_slot, reason, medical_cert_url, status, approver_id, approved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          empId, leaveType, normalizeDateToIso(startDate), normalizeDateToIso(endDate), finalDays, finalSlot, finalReason, medicalCertUrl || null, targetStatus, approverId, approvedAt
        ).run();

        const slotLabel = finalSlot === 'MORNING' ? ' (ครึ่งเช้า)' : (finalSlot === 'AFTERNOON' ? ' (ครึ่งบ่าย)' : ' (เต็มวัน)');
        resultMsg = `สร้างคำขอลางาน (${leaveType} ${finalDays} วัน${slotLabel}) ให้ ${empRow.full_name} สำเร็จ (${targetStatus === 'APPROVED' ? 'อนุมัติทันที' : 'รออนุมัติ'})`;
      } else if (requestType === 'OT') {
        const { date, startTime, endTime, hours, plannedHours, actualHours, reason } = params;
        if (!date) return { success: false, message: 'กรุณาระบุวันที่ทำ OT' };

        const otHoursVal = Number(hours) || Number(actualHours) || Number(plannedHours) || 0;
        if (otHoursVal <= 0) return { success: false, message: 'กรุณาระบุจำนวนชั่วโมง OT' };

        const cleanDate = normalizeDateToIso(date);
        const d = new Date(cleanDate + 'T00:00:00');
        const isSunday = (!isNaN(d.getTime()) && d.getDay() === 0);
        const otType = isSunday ? 1.0 : 1.5;
        const finalReason = reason ? `${reason} ${auditNote}` : auditNote;

        await db.prepare(`
          INSERT INTO ot_requests (emp_id, date, start_time, end_time, planned_hours, actual_hours, ot_type, reason, status, approver_id, approved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          empId, cleanDate, startTime || null, endTime || null, otHoursVal, otHoursVal, otType, finalReason, targetStatus, approverId, approvedAt
        ).run();

        resultMsg = `สร้างคำขอ OT (${otHoursVal} ชม. วันที่ ${cleanDate}) ให้ ${empRow.full_name} สำเร็จ (${targetStatus === 'APPROVED' ? 'อนุมัติทันที' : 'รออนุมัติ'})`;
      } else if (requestType === 'ADVANCE') {
        const { amount, requestDate, period, reason } = params;
        const amtVal = Number(amount) || 0;
        if (amtVal <= 0) return { success: false, message: 'กรุณาระบุยอดเงินที่ต้องการเบิก' };

        const rDate = normalizeDateToIso(requestDate || new Date().toISOString().substring(0, 10));
        const targetPeriod = period || getDefaultPeriod();
        const finalReason = reason ? `${reason} ${auditNote}` : auditNote;

        await db.prepare(`
          INSERT INTO advance_requests (emp_id, amount, request_date, period, reason, status, approver_id, approved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          empId, amtVal, rDate, targetPeriod, finalReason, targetStatus, approverId, approvedAt
        ).run();

        resultMsg = `สร้างคำขอเบิกเงินล่วงหน้า (฿${amtVal.toLocaleString()}) ให้ ${empRow.full_name} สำเร็จ (${targetStatus === 'APPROVED' ? 'อนุมัติทันที' : 'รออนุมัติ'})`;
      } else {
        return { success: false, message: `ไม่รองรับประเภทคำขอ: ${requestType}` };
      }

      await logSystemActivity(db, callerUser, 'CREATE_ATTENDANCE_REQUEST', `สร้างคำขอ ${requestType} ให้ [${empId}] ${empRow.full_name} (${targetStatus})`);
      return { success: true, message: resultMsg };
  },

  getMasterUnlockQr: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'unlock_device')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าถึง Master Unlock Token' };

      const token = await getMasterUnlockToken(0);
      const secondsLeft = 60 - (Math.floor(Date.now() / 1000) % 60);
      return {
        success: true,
        token,
        secondsLeft
      };
  },

  getAttendanceLogsRange: async (db, params) => {
    let period = params.period;
      const callerUser = params.username || 'Admin';
      const allowed = await userHasPermission(db, callerUser, 'view_attendance');
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดูข้อมูลลงเวลา' };

      let startDate = String(params.startDate || '').trim();
      let endDate = String(params.endDate || '').trim();
      const periodStr = String(params.period || '').trim();

      if (!startDate || !endDate) {
        if (periodStr) {
          const cutDates = await getCutoffDatesForPeriod(db, periodStr);
          startDate = cutDates.startDate;
          endDate = cutDates.endDate;
        } else {
          return { success: false, message: 'กรุณาระบุช่วงวันที่เริ่มต้นและสิ้นสุด' };
        }
      }

      const branchFilter = String(params.branchId || params.branch_id || '').trim();
      const empFilter = String(params.empId || params.emp_id || '').trim();

      let sql = `
        SELECT 
          l.id, l.emp_id, l.date, l.clock_in, l.clock_out, l.break_out, l.break_in,
          l.work_hours, l.ot_hours,
          l.late_minutes, l.break_minutes, l.overbreak_minutes,
          l.status, l.remark, l.branch_id, l.is_full_pay,
          l.in_lat, l.in_lng, l.out_lat, l.out_lng,
          e.full_name, e.nickname, e.department, e.position, e.branch_id as emp_branch_id
        FROM time_logs l
        LEFT JOIN employees e ON l.emp_id = e.emp_id
        WHERE l.date >= ? AND l.date <= ?
      `;
      const binds = [startDate, endDate];

      if (branchFilter && branchFilter !== 'ALL') {
        sql += ` AND (l.branch_id = ? OR (l.branch_id IS NULL AND e.branch_id = ?))`;
        binds.push(branchFilter, branchFilter);
      }

      if (empFilter && empFilter !== 'ALL') {
        sql += ` AND l.emp_id = ?`;
        binds.push(empFilter);
      }

      sql += ` ORDER BY l.emp_id ASC, l.date ASC, l.clock_in ASC`;

      const query = await db.prepare(sql).bind(...binds).all().catch(e => {
        console.error('getAttendanceLogsRange error:', e);
        return { error: e.message || String(e), results: [] };
      });
      const holidaysQuery = await db.prepare('SELECT * FROM company_holidays WHERE date BETWEEN ? AND ? ORDER BY date ASC').bind(startDate, endDate).all().catch(() => ({ results: [] }));

      // Query approved leave requests in date range
      let lvSql = `
        SELECT 
          lr.id, lr.emp_id, lr.leave_type, lr.start_date, lr.end_date,
          COALESCE(lr.days_count, 1) as days_count,
          COALESCE(lr.time_slot, 'FULL') as time_slot,
          lr.reason, lr.status, lr.medical_cert_url,
          e.full_name, e.nickname, e.department, e.position
        FROM leave_requests lr
        LEFT JOIN employees e ON lr.emp_id = e.emp_id
        WHERE UPPER(TRIM(lr.status)) = 'APPROVED'
          AND ((substr(lr.start_date, 1, 10) BETWEEN ? AND ?) 
            OR (substr(lr.end_date, 1, 10) BETWEEN ? AND ?) 
            OR (substr(lr.start_date, 1, 10) <= ? AND substr(lr.end_date, 1, 10) >= ?))
      `;
      const lvBinds = [startDate, endDate, startDate, endDate, startDate, endDate];
      if (branchFilter && branchFilter !== 'ALL') {
        lvSql += ` AND (e.branch_id = ?)`;
        lvBinds.push(branchFilter);
      }
      if (empFilter && empFilter !== 'ALL') {
        lvSql += ` AND lr.emp_id = ?`;
        lvBinds.push(empFilter);
      }
      lvSql += ` ORDER BY lr.emp_id ASC, lr.start_date ASC`;

      const leavesQuery = await db.prepare(lvSql).bind(...lvBinds).all().catch(e => {
        console.error('getAttendanceLogsRange leaves error:', e);
        return { results: [] };
      });

      // Query approved advance requests in date range
      let advSql = `
        SELECT 
          ar.id, ar.emp_id, ar.amount, ar.request_date, ar.period, ar.reason, ar.status, ar.approved_at,
          e.full_name, e.nickname, e.department, e.position
        FROM advance_requests ar
        LEFT JOIN employees e ON ar.emp_id = e.emp_id
        WHERE UPPER(TRIM(ar.status)) = 'APPROVED'
          AND substr(ar.request_date, 1, 10) BETWEEN ? AND ?
      `;
      const advBinds = [startDate, endDate];
      if (branchFilter && branchFilter !== 'ALL') {
        advSql += ` AND (e.branch_id = ?)`;
        advBinds.push(branchFilter);
      }
      if (empFilter && empFilter !== 'ALL') {
        advSql += ` AND ar.emp_id = ?`;
        advBinds.push(empFilter);
      }
      advSql += ` ORDER BY ar.emp_id ASC, ar.request_date ASC`;

      const advancesQuery = await db.prepare(advSql).bind(...advBinds).all().catch(e => {
        console.error('getAttendanceLogsRange advances error:', e);
        return { results: [] };
      });

      const rangeLogs = query.results || [];
      const rangeLeaves = leavesQuery.results || [];
      for (const l of rangeLogs) {
        const lEmp = String(l.emp_id || '').trim();
        const lDate = String(l.date || '').substring(0, 10);
        const matchedLr = rangeLeaves.find(lr => {
          const k = String(lr.emp_id || '').trim();
          const sD = String(lr.start_date || '').substring(0, 10);
          const eD = String(lr.end_date || '').substring(0, 10);
          return (k === lEmp || lr.emp_id === l.emp_id) && lDate >= sD && lDate <= eD;
        });
        if (matchedLr) {
          l.has_leave_conflict = true;
          l.leave_conflict_info = {
            leave_type: matchedLr.leave_type,
            days_count: matchedLr.days_count,
            time_slot: matchedLr.time_slot || 'FULL',
            status: matchedLr.status,
            reason: matchedLr.reason || ''
          };
        }
      }

      return {
        success: !query.error,
        error: query.error || undefined,
        logs: rangeLogs,
        leaves: rangeLeaves,
        advances: advancesQuery.results || [],
        holidays: holidaysQuery.results || [],
        startDate,
        endDate,
        branchId: branchFilter
      };
  },

  saveAttendanceSettings: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const allowed = await userHasPermission(db, callerUser, 'manage_attendance_settings');
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ตั้งค่าระบบลงเวลา' };

      const newSettings = params.settings || {};
      for (const [k, v] of Object.entries(newSettings)) {
        await db.prepare(`
          INSERT INTO attendance_settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).bind(k, String(v)).run().catch(() => {});
      }

      // Keep B01 (สำนักงานใหญ่) in sync with attendance_settings
      const b01Updates = [];
      const b01Values = [];
      if (newSettings.work_start_time) { b01Updates.push('work_start_time = ?'); b01Values.push(String(newSettings.work_start_time)); }
      if (newSettings.work_end_time) { b01Updates.push('work_end_time = ?'); b01Values.push(String(newSettings.work_end_time)); }
      if (newSettings.lunch_start_time) { b01Updates.push('lunch_start_time = ?'); b01Values.push(String(newSettings.lunch_start_time)); }
      if (newSettings.lunch_end_time) { b01Updates.push('lunch_end_time = ?'); b01Values.push(String(newSettings.lunch_end_time)); }
      if (newSettings.ot_start_time) { b01Updates.push('ot_start_time = ?'); b01Values.push(String(newSettings.ot_start_time)); }
      if (newSettings.office_lat) { b01Updates.push('lat = ?'); b01Values.push(Number(newSettings.office_lat)); }
      if (newSettings.office_lng) { b01Updates.push('lng = ?'); b01Values.push(Number(newSettings.office_lng)); }
      if (newSettings.geofence_radius_meters) { b01Updates.push('radius_meters = ?'); b01Values.push(Number(newSettings.geofence_radius_meters)); }
      if (newSettings.kiosk_pin) { b01Updates.push('kiosk_pin = ?'); b01Values.push(String(newSettings.kiosk_pin)); }

      if (b01Updates.length > 0) {
        b01Values.push('B01');
        await db.prepare(`UPDATE branches SET ${b01Updates.join(', ')} WHERE branch_id = ?`).bind(...b01Values).run().catch(() => {});
      }

      await logSystemActivity(db, callerUser, 'UPDATE_ATTENDANCE_SETTINGS', 'อัปเดตการตั้งค่าเวลากะงานและพิกัด GPS');
      return { success: true, message: 'บันทึกการตั้งค่าระบบลงเวลาเรียบร้อยแล้ว' };
  },

  addAttendanceLog: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const allowed = (await userHasPermission(db, callerUser, 'manage_time_logs')) ||
                      (await userHasPermission(db, callerUser, 'approve_attendance')) ||
                      (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เพิ่มข้อมูลลงเวลา' };

      const { empId, date, branchId, clockIn, clockOut, breakOut, breakIn, breakMinutes, lateMinutes, workHours, otHours, status, remark, isFullPay, overwrite } = params;
      if (!empId) return { success: false, message: 'กรุณาระบุพนักงาน' };
      if (!date) return { success: false, message: 'กรุณาระบุวันที่' };

      const empRow = await db.prepare('SELECT emp_id, full_name, branch_id, is_ot_eligible FROM employees WHERE emp_id = ?').bind(empId).first().catch(() => null);
      if (!empRow) return { success: false, message: `ไม่พบข้อมูลพนักงานรหัส ${empId}` };

      // Check existing log on this date
      const existing = await db.prepare('SELECT id FROM time_logs WHERE emp_id = ? AND date = ?').bind(empId, date).first().catch(() => null);
      if (existing && !overwrite) {
        return {
          success: false,
          hasExisting: true,
          existingId: existing.id,
          message: `พนักงานรหัส ${empId} มีข้อมูลการลงเวลาของวันที่ ${date} อยู่แล้วในระบบ (ID: ${existing.id}) คุณต้องการบันทึกทับหรือไม่?`
        };
      }

      const finalBranchId = branchId || empRow.branch_id || 'B01';
      const isFullPayVal = (isFullPay === 1 || isFullPay === '1' || isFullPay === true || isFullPay === 'true') ? 1 : 0;

      // Auto-calc hours if not explicitly provided
      let finalWorkHours = Number(workHours) || 0;
      let finalOtHours = Number(otHours) || 0;
      let finalLateMinutes = Number(lateMinutes) || 0;
      let finalBreakMinutes = breakMinutes !== undefined && breakMinutes !== null ? Number(breakMinutes) : 0;

      if (clockIn) {
        try {
          const branchRow = await db.prepare('SELECT * FROM branches WHERE branch_id = ?').bind(finalBranchId).first().catch(() => null);
          const toMin = (s) => {
            if (!s) return null;
            const p = String(s).trim().split(':');
            return p.length >= 2 ? (parseInt(p[0], 10) * 60 + parseInt(p[1], 10)) : null;
          };
          const inMin = toMin(clockIn);
          const startMin = toMin(branchRow && branchRow.work_start_time) || (9 * 60 + 30);
          const graceMin = Number(branchRow && branchRow.grace_minutes) || 0;

          if (lateMinutes === undefined || lateMinutes === null) {
            if (inMin !== null) {
              let hasMorningLeave = false;
              try {
                const lv = await db.prepare(`
                  SELECT id, leave_type, days_count, time_slot FROM leave_requests
                  WHERE emp_id = ? AND status = 'APPROVED' AND ? >= start_date AND ? <= end_date
                `).bind(empId, date, date).first();
                if (lv) {
                  const lvDays = Number(lv.days_count) || 1;
                  const lvSlot = lv.time_slot || 'FULL';
                  const lStart = toMin(branchRow && branchRow.lunch_start_time) || (13 * 60);
                  if ((lvSlot === 'FULL' && lvDays >= 1.0) || lvSlot === 'MORNING' || (inMin >= lStart)) {
                    hasMorningLeave = true;
                  }
                }
              } catch(e) {}

              const lEnd = toMin(branchRow && branchRow.lunch_end_time) || (14 * 60);
              const lStart = toMin(branchRow && branchRow.lunch_start_time) || (13 * 60);
              if (hasMorningLeave) {
                if (inMin >= lStart) {
                  finalLateMinutes = (inMin > (lEnd + graceMin)) ? (inMin - lEnd) : 0;
                } else {
                  finalLateMinutes = 0;
                }
              } else if (inMin > (startMin + graceMin)) {
                finalLateMinutes = inMin - startMin;
              } else {
                finalLateMinutes = 0;
              }
            }
          }

          if (clockOut && finalWorkHours <= 0) {
            const outMin = toMin(clockOut);
            const endMin = toMin(branchRow && branchRow.work_end_time) || (19 * 60);
            const lunchStart = toMin(branchRow && branchRow.lunch_start_time) || (13 * 60);
            const lunchEnd = toMin(branchRow && branchRow.lunch_end_time) || (14 * 60);
            const otStartMin = toMin(branchRow && (branchRow.ot_start_time || branchRow.work_end_time)) || (19 * 60);

            if (inMin !== null && outMin !== null) {
              const d = new Date(date + 'T00:00:00');
              const isSunday = (!isNaN(d.getTime()) && d.getDay() === 0);

              if (finalBreakMinutes === 0 && Math.max(inMin, startMin) <= lunchStart && outMin >= lunchEnd) {
                finalBreakMinutes = 60;
              }

              if (isFullPayVal === 1) {
                if (inMin !== null && inMin >= lunchStart) {
                  const effAfternoonIn = Math.max(inMin, lunchEnd);
                  finalWorkHours = Math.max(0, Math.round(((endMin - effAfternoonIn) / 60) * 10) / 10) || 5.0;
                } else {
                  const fullDayBreak = finalBreakMinutes > 0 ? finalBreakMinutes : 60;
                  finalWorkHours = Math.max(0, Math.round(((endMin - startMin - fullDayBreak) / 60) * 10) / 10) || 8.5;
                }
              } else if (isSunday) {
                const sunMin = Math.max(0, outMin - Math.max(inMin, startMin) - finalBreakMinutes);
                finalOtHours = Math.floor(sunMin / 30) * 0.5;
                finalWorkHours = 0;
              } else {
                const effIn = Math.max(inMin, startMin);
                const cappedOut = Math.min(outMin, endMin);
                const normMin = Math.max(0, cappedOut - effIn - finalBreakMinutes);
                finalWorkHours = Math.round((normMin / 60) * 10) / 10;

                if (outMin > otStartMin) {
                  finalOtHours = Math.floor((outMin - otStartMin) / 30) * 0.5;
                }
              }
            }
          }
        } catch (e) {
          console.warn('addAttendanceLog auto-calc error:', e);
        }
      }

      const nowStr = new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      const auditTag = `[เพิ่มโดย HR: ${callerUser} เมื่อ ${nowStr}]`;
      const finalRemark = remark ? `${remark} ${auditTag}` : auditTag;
      const finalStatus = status || (finalLateMinutes > 0 ? 'LATE' : 'NORMAL');

      let savedId;
      if (existing) {
        await db.prepare(`
          UPDATE time_logs
          SET branch_id = ?, clock_in = ?, clock_out = ?, break_out = ?, break_in = ?, break_minutes = ?, late_minutes = ?, work_hours = ?, ot_hours = ?, status = ?, remark = ?, is_full_pay = ?
          WHERE id = ?
        `).bind(
          finalBranchId, clockIn || null, clockOut || null, breakOut || null, breakIn || null,
          finalBreakMinutes, finalLateMinutes, finalWorkHours, finalOtHours, finalStatus, finalRemark, isFullPayVal, existing.id
        ).run();
        savedId = existing.id;
      } else {
        const res = await db.prepare(`
          INSERT INTO time_logs (emp_id, branch_id, date, clock_in, clock_out, break_out, break_in, break_minutes, late_minutes, work_hours, ot_hours, status, remark, is_full_pay)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          empId, finalBranchId, date, clockIn || null, clockOut || null, breakOut || null, breakIn || null,
          finalBreakMinutes, finalLateMinutes, finalWorkHours, finalOtHours, finalStatus, finalRemark, isFullPayVal
        ).run();
        savedId = res.meta ? res.meta.last_row_id : null;
      }

      // If OT occurred and employee is eligible, sync to ot_requests
      if (finalOtHours > 0) {
        try {
          const isOtEligible = !(empRow.is_ot_eligible === 'false' || empRow.is_ot_eligible === false);
          if (isOtEligible) {
            const d = new Date(date + 'T00:00:00');
            const isSunday = (!isNaN(d.getTime()) && d.getDay() === 0);
            const otRate = isSunday ? 1.0 : 1.5;
            const existingOt = await db.prepare('SELECT id FROM ot_requests WHERE emp_id = ? AND date = ?').bind(empId, date).first().catch(() => null);
            if (existingOt) {
              await db.prepare(`UPDATE ot_requests SET actual_hours = ?, ot_type = ?, status = 'APPROVED' WHERE id = ?`).bind(finalOtHours, otRate, existingOt.id).run();
            } else {
              await db.prepare(`
                INSERT INTO ot_requests (emp_id, date, planned_hours, actual_hours, ot_type, reason, status)
                VALUES (?, ?, ?, ?, ?, ?, 'APPROVED')
              `).bind(empId, date, finalOtHours, finalOtHours, otRate, isSunday ? 'ทำงานวันอาทิตย์ (HR ลงเวลาแทน)' : 'OT งานเสร็จประจำวัน (HR ลงเวลาแทน)').run();
            }
          }
        } catch (e) {
          console.warn('ot_requests sync error in addAttendanceLog:', e);
        }
      }

      await logSystemActivity(db, callerUser, 'ADD_TIME_LOG', `เพิ่มการลงเวลาให้ [${empId}] ${empRow.full_name} วันที่ ${date} (เข้า: ${clockIn || '-'}, ออก: ${clockOut || '-'}, ชม.งาน: ${finalWorkHours}, OT: ${finalOtHours})`);
      const outSummary = clockOut
        ? `ชั่วโมงทำงาน: ${finalWorkHours} ชม.${finalOtHours > 0 ? ' + OT: ' + finalOtHours + ' ชม.' : ''}`
        : `ลงเวลาเข้า ${clockIn} (รอสแกนออก)`;
      return {
        success: true,
        id: savedId,
        workHours: finalWorkHours,
        otHours: finalOtHours,
        message: `เพิ่มการลงเวลาให้ ${empRow.full_name} วันที่ ${date} สำเร็จ (${outSummary})`
      };
  },

  updateAttendanceLog: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const allowed = (await userHasPermission(db, callerUser, 'manage_time_logs')) ||
                      (await userHasPermission(db, callerUser, 'approve_attendance')) ||
                      (await userHasPermission(db, callerUser, 'manage_attendance_settings')) ||
                      (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์แก้ไขข้อมูลลงเวลา' };

      const { id, clockIn, clockOut, breakOut, breakIn, breakMinutes, overbreakMinutes, lateMinutes, workHours, otHours, status, remark, isFullPay } = params;
      if (!id) return { success: false, message: 'ไม่พบรหัสรายการที่ต้องการแก้ไข' };

      const isFullPayVal = (isFullPay === 1 || isFullPay === '1' || isFullPay === true || isFullPay === 'true') ? 1 : 0;

      // Fetch existing log to verify or auto-calculate if workHours is 0
      const existing = await db.prepare('SELECT * FROM time_logs WHERE id = ?').bind(id).first().catch(() => null);
      if (!existing) return { success: false, message: 'ไม่พบรายการบันทึกเวลา' };

      const empRow = await db.prepare('SELECT emp_id, branch_id, is_ot_eligible FROM employees WHERE emp_id = ?').bind(existing.emp_id).first().catch(() => null);
      const branchId = existing.branch_id || (empRow && empRow.branch_id);
      const branchRow = branchId ? await db.prepare('SELECT * FROM branches WHERE branch_id = ?').bind(branchId).first().catch(() => null) : null;

      const toMin = (s) => {
        if (!s) return null;
        const p = String(s).trim().split(':');
        return p.length >= 2 ? (parseInt(p[0], 10) * 60 + parseInt(p[1], 10)) : null;
      };

      let finalWorkHours = Number(workHours) || 0;
      let finalOtHours = Number(otHours) || (Number(existing.ot_hours) || 0);
      let finalBreakMinutes = breakMinutes !== undefined && breakMinutes !== null ? Number(breakMinutes) : (Number(existing.break_minutes) || 0);
      let finalLateMinutes = lateMinutes !== undefined && lateMinutes !== null ? Number(lateMinutes) : (Number(existing.late_minutes) || 0);

      const inMin = toMin(clockIn);
      const startMin = toMin(branchRow && branchRow.work_start_time) || (9 * 60 + 30);
      const graceMin = Number(branchRow && branchRow.grace_minutes) || 0;

      // Only recalculate late minutes dynamically if lateMinutes was NOT explicitly passed by caller
      if (lateMinutes === undefined || lateMinutes === null) {
        if (inMin !== null) {
          let hasMorningLeave = false;
          try {
            const lv = await db.prepare(`
              SELECT id, leave_type, days_count, time_slot FROM leave_requests
              WHERE emp_id = ? AND status = 'APPROVED' AND ? >= start_date AND ? <= end_date
            `).bind(existing.emp_id, existing.date, existing.date).first();
            if (lv) {
              const lvDays = Number(lv.days_count) || 1;
              const lvSlot = lv.time_slot || 'FULL';
              const lStart = toMin(branchRow && branchRow.lunch_start_time) || (13 * 60);
              if ((lvSlot === 'FULL' && lvDays >= 1.0) || lvSlot === 'MORNING' || (inMin >= lStart)) {
                hasMorningLeave = true;
              }
            }
          } catch(e) {}

          const lEnd = toMin(branchRow && branchRow.lunch_end_time) || (14 * 60);
          const lStart = toMin(branchRow && branchRow.lunch_start_time) || (13 * 60);
          if (hasMorningLeave) {
            if (inMin >= lStart) {
              finalLateMinutes = (inMin > (lEnd + graceMin)) ? (inMin - lEnd) : 0;
            } else {
              finalLateMinutes = 0;
            }
          } else if (inMin > (startMin + graceMin)) {
            finalLateMinutes = inMin - startMin;
          } else {
            finalLateMinutes = 0;
          }
        }
      }

      let finalStatus = status || existing.status || 'NORMAL';
      if (finalLateMinutes === 0 && finalStatus === 'LATE') {
        finalStatus = 'NORMAL';
      } else if (finalLateMinutes > 0 && finalStatus === 'NORMAL') {
        finalStatus = 'LATE';
      }

      // Backend fallback calculation: If clockIn and clockOut exist but workHours is 0
      if (clockIn && clockOut && finalWorkHours <= 0) {
        try {
          const outMin = toMin(clockOut);
          const endMin = toMin(branchRow && branchRow.work_end_time) || (19 * 60);
          const lunchStart = toMin(branchRow && branchRow.lunch_start_time) || (13 * 60);
          const lunchEnd = toMin(branchRow && branchRow.lunch_end_time) || (14 * 60);
          const otStartMin = toMin(branchRow && (branchRow.ot_start_time || branchRow.work_end_time)) || (19 * 60);

          if (inMin !== null && outMin !== null) {
            const d = new Date((existing.date || '') + 'T00:00:00');
            const isSunday = (!isNaN(d.getTime()) && d.getDay() === 0);

            if (finalBreakMinutes === 0 && Math.max(inMin, startMin) <= lunchStart && outMin >= lunchEnd) {
              finalBreakMinutes = 60;
            }

            if (isFullPayVal === 1) {
              if (inMin !== null && inMin >= lunchStart) {
                const effAfternoonIn = Math.max(inMin, lunchEnd);
                finalWorkHours = Math.max(0, Math.round(((endMin - effAfternoonIn) / 60) * 10) / 10) || 5.0;
              } else {
                const fullDayBreak = finalBreakMinutes > 0 ? finalBreakMinutes : 60;
                finalWorkHours = Math.max(0, Math.round(((endMin - startMin - fullDayBreak) / 60) * 10) / 10) || 8.5;
              }
            } else if (isSunday) {
              const sunMin = Math.max(0, outMin - Math.max(inMin, startMin) - finalBreakMinutes);
              finalOtHours = Math.floor(sunMin / 30) * 0.5;
              finalWorkHours = 0;
            } else {
              const effIn = Math.max(inMin, startMin);
              const cappedOut = Math.min(outMin, endMin);
              const normMin = Math.max(0, cappedOut - effIn - finalBreakMinutes);
              finalWorkHours = Math.round((normMin / 60) * 10) / 10;

              if (outMin > otStartMin) {
                finalOtHours = Math.floor((outMin - otStartMin) / 30) * 0.5;
              }
            }
          }
        } catch (e) {
          console.warn('Backend auto-calc work hours error:', e);
        }
      }

      await db.prepare(`
        UPDATE time_logs
        SET clock_in = ?, clock_out = ?, break_out = ?, break_in = ?, break_minutes = ?, overbreak_minutes = ?, late_minutes = ?, work_hours = ?, ot_hours = ?, status = ?, remark = ?, is_full_pay = ?
        WHERE id = ?
      `).bind(
        clockIn !== undefined ? (clockIn || null) : existing.clock_in,
        clockOut !== undefined ? (clockOut || null) : existing.clock_out,
        breakOut !== undefined ? (breakOut || null) : existing.break_out,
        breakIn !== undefined ? (breakIn || null) : existing.break_in,
        finalBreakMinutes,
        overbreakMinutes !== undefined && overbreakMinutes !== null ? Number(overbreakMinutes) : (Number(existing.overbreak_minutes) || 0),
        finalLateMinutes,
        finalWorkHours,
        finalOtHours,
        finalStatus,
        remark !== undefined ? remark : (existing.remark || ''),
        isFullPayVal,
        id
      ).run();

      // If OT occurred and employee is eligible, record or update in ot_requests automatically
      if (finalOtHours > 0) {
        try {
          const isOtEligible = !(empRow && (empRow.is_ot_eligible === 'false' || empRow.is_ot_eligible === false));
          if (isOtEligible) {
            const d = new Date((existing.date || '') + 'T00:00:00');
            const isSunday = (!isNaN(d.getTime()) && d.getDay() === 0);
            const otRate = isSunday ? 1.0 : 1.5;
            const existingOt = await db.prepare('SELECT id FROM ot_requests WHERE emp_id = ? AND date = ?').bind(existing.emp_id, existing.date).first().catch(() => null);
            if (existingOt) {
              await db.prepare(`
                UPDATE ot_requests 
                SET actual_hours = ?, ot_type = ?, status = 'APPROVED'
                WHERE id = ?
              `).bind(finalOtHours, otRate, existingOt.id).run();
            } else {
              await db.prepare(`
                INSERT INTO ot_requests (emp_id, date, planned_hours, actual_hours, ot_type, reason, status)
                VALUES (?, ?, ?, ?, ?, ?, 'APPROVED')
              `).bind(existing.emp_id, existing.date, finalOtHours, finalOtHours, otRate, isSunday ? 'ทำงานวันอาทิตย์' : 'OT งานเสร็จประจำวัน (Admin ปรับปรุงเวลา)').run();
            }
          }
        } catch (e) {
          console.warn('ot_requests sync error:', e);
        }
      }

      await logSystemActivity(db, callerUser, 'UPDATE_TIME_LOG', `แก้ไขข้อมูลการลงเวลา ID: ${id} (เข้า: ${clockIn || '-'}, ออก: ${clockOut || '-'}, ชม.งาน: ${finalWorkHours}, OT: ${finalOtHours})`);
      return { success: true, workHours: finalWorkHours, otHours: finalOtHours, message: `บันทึกการแก้ไขข้อมูลสำเร็จ (ชั่วโมงทำงาน: ${finalWorkHours} ชม.${finalOtHours > 0 ? ' + OT: ' + finalOtHours + ' ชม.' : ''})` };
  },

  deleteAttendanceLog: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const allowed = (await userHasPermission(db, callerUser, 'approve_attendance')) || (await userHasPermission(db, callerUser, 'manage_attendance_settings'));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ลบข้อมูลลงเวลา' };

      const { id } = params;
      if (!id) return { success: false, message: 'ไม่พบรหัสรายการที่ต้องการลบ' };

      await db.prepare('DELETE FROM time_logs WHERE id = ?').bind(id).run();
      await logSystemActivity(db, callerUser, 'DELETE_TIME_LOG', `ลบข้อมูลการลงเวลา ID: ${id}`);
      return { success: true, message: 'ลบรายการบันทึกเวลาเรียบร้อยแล้ว' };
  },

  batchDeleteAttendanceLogs: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const allowed = (await userHasPermission(db, callerUser, 'approve_attendance')) || (await userHasPermission(db, callerUser, 'manage_attendance_settings'));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ลบข้อมูลลงเวลา' };

      const ids = Array.isArray(params.ids) ? params.ids : [];
      if (ids.length === 0) return { success: false, message: 'กรุณาเลือกรายการที่ต้องการลบ' };

      let deletedCount = 0;
      for (const id of ids) {
        const res = await db.prepare('DELETE FROM time_logs WHERE id = ?').bind(id).run().catch(() => {});
        if (res) deletedCount++;
      }

      await logSystemActivity(db, callerUser, 'BATCH_DELETE_TIME_LOGS', `ลบข้อมูลการลงเวลาจำนวน ${deletedCount} รายการ`);
      return { success: true, count: deletedCount, message: `ลบข้อมูลการลงเวลาสำเร็จ ${deletedCount} รายการ` };
  },

  batchSetAttendanceEarlyDismissal: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const isSuper = await isUserSuperAdmin(db, callerUser);
      const canManage = await userHasPermission(db, callerUser, 'manage_attendance_settings');
      const canAll = await userHasPermission(db, callerUser, 'toggle_early_dismissal');
      if (!isSuper && !canManage && !canAll) {
        const uRow = await db.prepare('SELECT permissions FROM users WHERE LOWER(username) = ?').bind(String(callerUser).toLowerCase()).first();
        const uPerms = uRow && uRow.permissions ? (typeof uRow.permissions === 'string' ? JSON.parse(uRow.permissions) : uRow.permissions) : [];
        const hasAnyEarlyBranch = uPerms.some(p => String(p).startsWith('toggle_early_dismissal:'));
        if (!hasAnyEarlyBranch) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการโหมดงานเสร็จ' };
      }

      const ids = Array.isArray(params.ids) ? params.ids : [];
      if (ids.length === 0) return { success: false, message: 'กรุณาเลือกรายการที่ต้องการดำเนินการ' };

      const enabled = (params.enabled === true || params.enabled === 'true' || params.enabled === 1 || params.enabled === '1') ? 1 : 0;
      let updatedCount = 0;

      // Load branch settings to calculate shift work hours
      const branchesRes = await db.prepare('SELECT branch_id, work_start_time, work_end_time, lunch_start_time, lunch_end_time FROM branches').all().catch(() => ({ results: [] }));
      const bMap = {};
      (branchesRes.results || []).forEach(b => { bMap[b.branch_id] = b; });

      for (const id of ids) {
        const log = await db.prepare('SELECT * FROM time_logs WHERE id = ?').bind(id).first();
        if (!log) continue;

        let curRemark = String(log.remark || '').trim();
        const tag = 'งานเสร็จเลิกงานก่อน-จ่ายเต็มวัน';

        if (enabled === 1) {
          if (!curRemark.includes(tag)) {
            curRemark = curRemark ? (curRemark + ' | ' + tag) : tag;
          }
          const branch = bMap[log.branch_id] || {};
          const sMin = timeStringToMinutes(branch.work_start_time || '09:30') || 570;
          const eMin = timeStringToMinutes(branch.work_end_time || '19:00') || 1140;
          const lStart = timeStringToMinutes(branch.lunch_start_time || '13:00') || 780;
          const lEnd = timeStringToMinutes(branch.lunch_end_time || '14:00') || 840;
          const breakMin = (lEnd > lStart) ? (lEnd - lStart) : 60;
          const logInMin = timeStringToMinutes(log.clock_in);

          let fullShiftHours;
          if (logInMin !== null && logInMin >= lStart) {
            const effAfternoonIn = Math.max(logInMin, lEnd);
            fullShiftHours = Math.max(0, Math.round(((eMin - effAfternoonIn) / 60) * 10) / 10) || 5.0;
          } else {
            fullShiftHours = Math.max(0, Math.round(((eMin - sMin - breakMin) / 60) * 10) / 10) || 8.5;
          }

          const newWorkHours = (logInMin !== null && logInMin >= lStart)
            ? fullShiftHours
            : Math.max(Number(log.work_hours) || 0, fullShiftHours);

          await db.prepare('UPDATE time_logs SET is_full_pay = 1, work_hours = ?, remark = ? WHERE id = ?')
            .bind(newWorkHours, curRemark, id).run();
          updatedCount++;
        } else {
          // Turn off: remove tag
          curRemark = curRemark.replace(new RegExp('\s*\|\s*' + tag, 'g'), '')
                               .replace(new RegExp(tag, 'g'), '').trim();
          await db.prepare('UPDATE time_logs SET is_full_pay = 0, remark = ? WHERE id = ?')
            .bind(curRemark, id).run();
          updatedCount++;
        }
      }

      const actionText = enabled === 1 ? 'อนุมัติโหมดงานเสร็จ (จ่ายเต็มวัน)' : 'ยกเลิกโหมดงานเสร็จ';
      await logSystemActivity(db, callerUser, 'BATCH_EARLY_DISMISSAL', `${actionText} จำนวน ${updatedCount} รายการ`);
      return {
        success: true,
        count: updatedCount,
        message: `${actionText} สำหรับ ${updatedCount} รายการเรียบร้อยแล้ว`
      };
  },

  importAttendanceBatch: async (db, params) => {
    let period = params.period;
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'edit_inputs')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์นำเข้าข้อมูลประจำงวด' };
      if (await isPeriodLocked(db, period)) {
        return { success: false, message: `งวดประจำเดือน ${period} ถูกปิดและล็อคแล้ว ไม่อนุญาตให้นำเข้าข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ` };
      }

      const records = params.records || [];
      if (!Array.isArray(records) || records.length === 0) {
        return { success: false, message: 'ไม่พบรายการข้อมูลที่ต้องการนำเข้า' };
      }

      const emps = (await db.prepare('SELECT * FROM employees').all()).results || [];
      let importedCount = 0;

      for (const r of records) {
        const empId = (r.empId || '').trim();
        if (!empId) continue;
        const emp = emps.find(e => e.emp_id === empId) || {};
        const empName = emp.full_name || r.empName || '';
        const baseSal = Number(r.baseSalary) || Number(emp.base_salary) || 0;
        const pfRate = (r.pfRate !== undefined && r.pfRate !== '') ? Number(r.pfRate) : (emp.pf_rate !== undefined ? Number(emp.pf_rate) : 0.05);
        const pfAmt = pfRate > 0 ? (Number(r.pfAmount) || Math.round(baseSal * pfRate * 100) / 100) : 0;
        const sso = (r.sso !== undefined && r.sso !== '') ? Number(r.sso) : (emp.default_sso !== undefined ? Number(emp.default_sso) : 750);
        const tax = (r.tax !== undefined && r.tax !== '') ? Number(r.tax) : (Number(emp.default_tax) || 0);

        await db.prepare(`
          INSERT OR REPLACE INTO monthly_inputs (
            period, emp_id, emp_name, base_salary, pf_rate, pf_amount,
            absent_days, leave_days, sick_leave_days, late_deduct,
            ot_hours, ot_rate, allowance, bonus, advance_deduct, other_deduct,
            sso, tax
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          period, empId, empName, baseSal, pfRate, pfAmt,
          Number(r.absentDays) || 0, Number(r.leaveDays) || 0, Number(r.sickLeaveDays) || 0, Number(r.lateDeduct) || 0,
          Number(r.otHours) || 0, Number(r.otRate) || 40, Number(r.allowance) || 0, Number(r.bonus) || 0,
          Number(r.advanceDeduct) || 0, Number(r.otherDeduct) || 0, sso, tax
        ).run();

        importedCount++;
      }

      await calculateAndSavePayroll(db, period);
      await logSystemActivity(db, params.username || 'Admin', 'ATTENDANCE_IMPORT', `นำเข้าข้อมูลเวลาทำงาน ${importedCount} รายการ งวด ${period}`);
      return { success: true, count: importedCount, message: `นำเข้าข้อมูลเวลาสำเร็จ ${importedCount} รายการ และคำนวณเงินเดือนเรียบร้อยแล้ว` };
  }
};
