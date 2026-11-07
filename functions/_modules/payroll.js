/**
 * Payroll Engine & Calculation Module
 */
import { ensureBranchTables, ensureTimeAttendanceTables, logSystemActivity } from './db.js';
import { isUserSuperAdmin, userHasPermission, getDefaultRolePermissions } from './security.js';
import { getBranchShiftSessions } from './branches.js';
import {
  getDefaultPeriod, parsePeriodYearMonth, getPreviousPeriodStr, getNextPeriodStr,
  getCutoffDatesForPeriod, getActualWorkingDaysInCutoff, calculatePeriodProRataRatio,
  calculateNewHireProRataRatio, getElapsedWorkingDaysInCutoff, getCompanyHolidayDatesSet,
  isPeriodLocked, getPeriodSortKey, normalizeDateToIso
} from './date-utils.js';

export function mapPayrollCalcHistoryRecord(c, inputMap, empMap) {
  const inp = (inputMap && inputMap[`${c.period}_${c.emp_id}`]) || (inputMap && inputMap[c.period]) || {};
  const emp = (empMap && empMap[c.emp_id]) || {};
  return {
    period: c.period,
    empId: c.emp_id,
    fullName: c.full_name || emp.full_name || '',
    name: c.full_name || emp.full_name || '',
    nickname: emp.nickname || '',
    department: c.department || emp.department || '',
    position: c.position || emp.position || '',
    branchId: emp.branch_id || c.branch_id || 'B01',
    joinDate: emp.join_date || '',
    status: emp.status || 'ACTIVE',
    baseSalary: Number(c.base_salary) || 0,
    absentDays: Number(inp.absent_days) || 0,
    leaveDays: Number(inp.leave_days) || 0,
    sickLeaveDays: Number(inp.sick_leave_days) || 0,
    lateDeduct: Number(inp.late_deduct) || 0,
    otHours: Number(c.ot_hours) || 0,
    otRate: Number(c.ot_rate) || 40,
    otPay: Number(c.ot_pay) || 0,
    allowance: Number(c.allowance) || 0,
    bonus: Number(c.bonus) || 0,
    leaveDeduction: Number(c.leave_deduction) || 0,
    grossPay: Number(c.gross_pay) || 0,
    sso: Number(c.sso) || 0,
    pf: Number(c.pf) || 0,
    tax: Number(c.tax) || 0,
    advanceDeduct: Number(c.advance_deduct) || 0,
    otherDeduct: Number(c.other_deduct) || 0,
    totalDeductions: Number(c.total_deductions) || 0,
    netPay: Number(c.net_pay) || 0
  };
}

export async function calculateAndSavePayroll(db, period, explicitWorkDays) {
  const inputQuery = await db.prepare('SELECT * FROM monthly_inputs WHERE period = ?').bind(period).all();
  const inputList = inputQuery.results || [];

  if (inputList.length === 0) {
    await db.prepare('DELETE FROM payroll_calcs WHERE period = ?').bind(period).run();
    return 0;
  }

  // Load payroll policy defaults from settings
  const settingsRows = (await db.prepare('SELECT key, value FROM settings').all()).results || [];
  let defaultOtRate = 40;
  let defaultWorkDays = 30;
  let absentFactor = 1.5;
  let leaveFactor = 1.0;
  let sickLeaveQuota = 10;

  for (const s of settingsRows) {
    if (s.key === 'DefaultOtRate' && !isNaN(Number(s.value))) defaultOtRate = Number(s.value);
    if (s.key === 'DefaultWorkDays' && !isNaN(Number(s.value))) defaultWorkDays = Number(s.value);
    if (s.key === 'AbsentFactor' && !isNaN(Number(s.value))) absentFactor = Number(s.value);
    if (s.key === 'LeaveFactor' && !isNaN(Number(s.value))) leaveFactor = Number(s.value);
    if (s.key === 'SickLeaveQuota' && !isNaN(Number(s.value))) sickLeaveQuota = Number(s.value);
  }

  const dates = await getCutoffDatesForPeriod(db, period);
  const holidayDatesSet = await getCompanyHolidayDatesSet(db, dates.startDate, dates.endDate);

  let workDays = explicitWorkDays;
  if (!workDays) {
    const wdRow = settingsRows.find(s => s.key === `Period_WorkDays_${period}`);
    if (wdRow && wdRow.value && !isNaN(Number(wdRow.value))) {
      workDays = Number(wdRow.value);
    } else {
      workDays = getActualWorkingDaysInCutoff(dates.startDate, dates.endDate, holidayDatesSet);
    }
  }
  if (!workDays || workDays <= 0) workDays = 26;

  const empQuery = await db.prepare('SELECT * FROM employees').all();
  const empMap = {};
  for (const emp of empQuery.results || []) empMap[emp.emp_id] = emp;

  // Calendar year & month parsing for sick leave annual quota tracking (resets every January)
  const parsedPeriod = parsePeriodYearMonth(period);
  const targetYearBE = parsedPeriod.yearBE;
  const targetMonth = parsedPeriod.month;

  const priorSickMap = {};
  if (targetMonth > 1) {
    // Only query prior periods of the same year (January is month 1, resets quota completely)
    const priorInputsQuery = await db.prepare(`
      SELECT period, emp_id, COALESCE(sick_leave_days, 0) as sick_days
      FROM monthly_inputs
      WHERE sick_leave_days > 0
    `).all().catch(() => ({ results: [] }));

    for (const row of (priorInputsQuery.results || [])) {
      if (!row.period || row.period === period) continue;
      const rowParsed = parsePeriodYearMonth(row.period);
      if (rowParsed.yearBE === targetYearBE && rowParsed.month < targetMonth) {
        const rowEmpId = String(row.emp_id || '').trim();
        priorSickMap[rowEmpId] = (priorSickMap[rowEmpId] || 0) + (Number(row.sick_days) || 0);
      }
    }
  }

  await db.prepare('DELETE FROM payroll_calcs WHERE period = ?').bind(period).run();

  let count = 0;
  for (const inp of inputList) {
    count++;
    const empId = inp.emp_id;
    const emp = empMap[empId] || { emp_id: empId, full_name: inp.emp_name || empId, base_salary: inp.base_salary || 0, pf_rate: inp.pf_rate || 0.05, default_sso: (inp.sso !== undefined && inp.sso !== null && !isNaN(Number(inp.sso))) ? Number(inp.sso) : 0, default_tax: inp.tax || 0 };

    const contractBaseSal = Number(emp.base_salary) || 0;
    const joinDateStr = emp.join_date ? normalizeDateToIso(emp.join_date) : '';
    const resignDateStr = emp.resign_date ? normalizeDateToIso(emp.resign_date) : '';
    const proRata = calculatePeriodProRataRatio(joinDateStr, resignDateStr, dates.startDate, dates.endDate, holidayDatesSet);

    let baseSal = Number(inp.base_salary > 0 ? inp.base_salary : contractBaseSal);
    // If mid-period (new hire or resigned) and input base salary equals full contract salary, apply pro-rata:
    if (proRata.isMidPeriod && (baseSal === contractBaseSal || !inp.base_salary || (proRata.isExitMidPeriod && baseSal > (Math.round((contractBaseSal * proRata.ratio) * 100) / 100)))) {
      baseSal = Math.round((contractBaseSal * proRata.ratio) * 100) / 100;
    }

    const pfRate = (inp.pf_rate !== null && inp.pf_rate !== undefined && !isNaN(Number(inp.pf_rate))) ? Number(inp.pf_rate) : ((emp.pf_rate !== null && emp.pf_rate !== undefined && !isNaN(Number(emp.pf_rate))) ? Number(emp.pf_rate) : 0);
    const pfAmt = (pfRate > 0) ? (Number(inp.pf_amount !== undefined && inp.pf_amount > 0 ? inp.pf_amount : Math.round(baseSal * pfRate * 100) / 100)) : 0;

    const otRate = (inp.ot_rate !== null && inp.ot_rate !== undefined && !isNaN(Number(inp.ot_rate))) ? Number(inp.ot_rate) : defaultOtRate;
    const otPay = Math.round((Number(inp.ot_hours) || 0) * otRate * 100) / 100;

    // Daily rate is ALWAYS based on contractBaseSal and workDays so absence on eligible days is docked at standard rate
    const dailyRate = workDays > 0 ? (contractBaseSal / workDays) : (contractBaseSal / 30);

    const absentDays = Number(inp.absent_days) || 0;
    const absentDed = absentDays * dailyRate * absentFactor;

    const leaveDays = Number(inp.leave_days) || 0;
    const businessLeaveDed = leaveDays * dailyRate * leaveFactor;

    // SMART SICK LEAVE DEDUCTION:
    // 1) Sick leave WITH medical certificate (counts against annual quota e.g. 10 days/yr)
    const currentSickDays = Number(inp.sick_leave_days) || 0;
    const priorUsedSick = priorSickMap[empId] || 0;
    const availableQuota = Math.max(0, sickLeaveQuota - priorUsedSick);
    const paidSickDays = Math.min(currentSickDays, availableQuota);
    const unpaidSickDays = Math.max(0, currentSickDays - paidSickDays);
    const sickLeaveDed = unpaidSickDays * dailyRate * leaveFactor;

    // 2) Sick leave WITHOUT medical certificate (always unpaid, deducted at leaveFactor, DOES NOT consume the 10-day quota)
    const unpaidSickNoCertDays = Number(inp.unpaid_sick_leave_days) || 0;
    const unpaidSickNoCertDed = unpaidSickNoCertDays * dailyRate * leaveFactor;

    const lateDed = Number(inp.late_deduct) || 0;

    const leaveDed = Math.round((absentDed + businessLeaveDed + sickLeaveDed + unpaidSickNoCertDed + lateDed) * 100) / 100;

    const allowance = Number(inp.allowance) || 0;
    const bonus = Number(inp.bonus) || 0;
    const grossPay = Math.round((baseSal + otPay + allowance + bonus - leaveDed) * 100) / 100;

    const sso = (inp.sso !== undefined && inp.sso !== null && !isNaN(Number(inp.sso))) ? Number(inp.sso) : ((emp.default_sso !== undefined && emp.default_sso !== null && !isNaN(Number(emp.default_sso))) ? Number(emp.default_sso) : 0);
    const pf = pfAmt;
    const tax = Number(inp.tax !== undefined ? inp.tax : (emp.default_tax || 0));
    const advDed = Number(inp.advance_deduct) || 0;
    const othDed = Number(inp.other_deduct) || 0;
    const carriedDebtIn = Number(inp.carried_debt) || 0;
    const totalDed = Math.round((sso + pf + tax + advDed + othDed + carriedDebtIn) * 100) / 100;
    const rawNetPay = Math.round((grossPay - totalDed) * 100) / 100;

    let carriedDebtOut = 0;
    let netPay = 0;
    if (rawNetPay < 0) {
      carriedDebtOut = Math.round(Math.abs(rawNetPay) * 100) / 100;
      netPay = 0;
    } else {
      carriedDebtOut = 0;
      // คิดทศนิยมเต็มในสูตร แล้วปัดเศษสตางค์ 2 ตำแหน่ง ปัดขึ้นเป็นบาทถ้วน (เช่น 14,352.50 -> 14,353.00 บาท)
      netPay = Math.ceil(rawNetPay);
    }

    await db.prepare(`
      INSERT OR REPLACE INTO payroll_calcs
      (period, emp_id, full_name, department, position, bank_name, bank_account, base_salary, ot_hours, ot_rate, ot_pay, allowance, bonus, leave_deduction, gross_pay, sso, pf, tax, advance_deduct, other_deduct, carried_debt, total_deductions, net_pay)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      period, empId, inp.emp_name || emp.full_name || empId,
      emp.department || '', emp.position || '', emp.bank_name || '', emp.bank_account || '',
      baseSal, Number(inp.ot_hours) || 0, otRate, otPay,
      allowance, bonus,
      leaveDed, grossPay, sso, pf, tax, advDed, othDed, carriedDebtOut, totalDed, netPay
    ).run();

    if (carriedDebtOut > 0) {
      await db.prepare('UPDATE monthly_inputs SET carried_debt = ? WHERE period = ? AND emp_id = ?').bind(carriedDebtOut, period, empId).run().catch(() => {});
    }
  }

  return count;
}

export const payrollHandlers = {
  getAppInitialData: async (db, params) => {
      const settingsRows = await db.prepare('SELECT key, value FROM settings').all();
      const settingsMap = {
        companyName: 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด',
        address: '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
        phone: '02-123-4567',
        taxId: '0105559876543',
        signatoryName: 'นางสาวประภัสสร เกียรติดำรง',
        signatoryTitle: 'ผู้จัดการฝ่ายทรัพยากรบุคคล',
        signatoryNameEn: 'Ms. Praphassorn Kiatdamrong',
        signatoryTitleEn: 'HR Manager',
        employerSsoId: '10-1234567-8',
        companyBranch: '00000'
      };
      let isClosed = false;
      let closedInfo = '';
      let workingDays = 30;

      for (const row of settingsRows.results || []) {
        if (row.key === 'CompanyName' && row.value) settingsMap.companyName = row.value;
        if (row.key === 'Address') settingsMap.address = row.value;
        if (row.key === 'Phone') settingsMap.phone = row.value;
        if (row.key === 'TaxId') settingsMap.taxId = row.value;
        if (row.key === 'SignatoryName') settingsMap.signatoryName = row.value;
        if (row.key === 'SignatoryTitle') settingsMap.signatoryTitle = row.value;
        if (row.key === 'SignatoryNameEn') settingsMap.signatoryNameEn = row.value;
        if (row.key === 'SignatoryTitleEn') settingsMap.signatoryTitleEn = row.value;
        if (row.key === 'EmployerSsoId') settingsMap.employerSsoId = row.value;
        if (row.key === 'CompanyBranch') settingsMap.companyBranch = row.value;
        if (row.key === 'GeminiApiKey') settingsMap.geminiApiKey = row.value;
        if (row.key === `Period_Status_${period}`) {
          if (row.value && row.value.startsWith('CLOSED')) {
            isClosed = true;
            closedInfo = row.value;
          }
        }
        if (row.key === `Period_WorkDays_${period}`) {
          if (row.value && !isNaN(Number(row.value))) {
            workingDays = Number(row.value);
          }
        }
      }

      // Load company holidays and calculate actual working days in cutoff (subtracting company holidays)
      const dates = await getCutoffDatesForPeriod(db, period);
      const holidaysRows = await db.prepare('SELECT * FROM company_holidays ORDER BY date ASC').all().catch(() => ({ results: [] }));
      const companyHolidays = holidaysRows.results || [];
      const holidayDatesSet = new Set(companyHolidays.map(h => h.date));

      const wdRowExplicit = (settingsRows.results || []).find(r => r.key === `Period_WorkDays_${period}`);
      if (!wdRowExplicit || !wdRowExplicit.value) {
        workingDays = getActualWorkingDaysInCutoff(dates.startDate, dates.endDate, holidayDatesSet);
      }

      // Load Device Locks and Employees (Schema is pre-ensured at cold start)
      const deviceRows = await db.prepare('SELECT emp_id, device_id, device_name, bound_at FROM employee_devices').all().catch(() => ({ results: [] }));
      const deviceMap = {};
      for (const d of deviceRows.results || []) {
        deviceMap[d.emp_id] = {
          deviceId: d.device_id,
          deviceName: d.device_name,
          boundAt: d.bound_at
        };
      }

      const branchRows = await db.prepare('SELECT * FROM branches ORDER BY branch_id ASC').all().catch(() => ({ results: [] }));

      const empQuery = await db.prepare('SELECT * FROM employees ORDER BY emp_id ASC').all();
      const employees = (empQuery.results || []).map(e => ({
        empId: e.emp_id,
        fullName: e.full_name || '',
        nickname: e.nickname || '',
        photoUrl: e.photo_url || '',
        citizenId: e.citizen_id || '',
        phone: e.phone || '',
        address: e.address || '',
        department: e.department || '',
        position: e.position || '',
        branchId: e.branch_id || 'B01',
        allowAllBranches: e.allow_all_branches === 'true',
        isOtEligible: (e.is_ot_eligible !== 'false' && e.is_ot_eligible !== false),
        isUndertimeExempt: (e.is_undertime_exempt === 'true' || e.is_undertime_exempt === true || e.is_undertime_exempt === 1 || e.is_undertime_exempt === '1'),
        isAttendanceExempt: (e.is_attendance_exempt === 'true' || e.is_attendance_exempt === true || e.is_attendance_exempt === 1 || e.is_attendance_exempt === '1'),
        isBreakExempt: (e.is_break_exempt === 'true' || e.is_break_exempt === true || e.is_break_exempt === 1 || e.is_break_exempt === '1'),
        baseSalary: Number(e.base_salary) || 0,
        bankName: e.bank_name || '',
        bankAccount: e.bank_account || '',
        birthDate: e.birth_date || '',
        age: Number(e.age) || 0,
        joinDate: e.join_date || '',
        pfRate: (e.pf_rate !== null && e.pf_rate !== undefined && !isNaN(Number(e.pf_rate))) ? Number(e.pf_rate) : 0.05,
        defaultSso: (e.default_sso !== null && e.default_sso !== undefined && !isNaN(Number(e.default_sso))) ? Number(e.default_sso) : 0,
        defaultTax: Number(e.default_tax) || 0,
        status: e.status || 'Active',
        probationDays: Number(e.probation_days) || 119,
        probationEndDate: e.probation_end_date || '',
        remark: e.remark || '',
        resignDate: e.resign_date || '',
        diligenceAllowance: (e.diligence_allowance !== null && e.diligence_allowance !== undefined && !isNaN(Number(e.diligence_allowance))) ? Number(e.diligence_allowance) : null,
        isDeviceBound: !!deviceMap[e.emp_id],
        boundDevice: deviceMap[e.emp_id] || null
      }));

      // Employee nickname lookup map
      const empNickMap = {};
      for (const e of employees) {
        if (e.empId && e.nickname) empNickMap[e.empId] = e.nickname;
      }

      // Monthly Inputs
      const inputQuery = await db.prepare('SELECT * FROM monthly_inputs WHERE period = ? ORDER BY no ASC, emp_id ASC').bind(period).all();
      let rawInputs = inputQuery.results || [];
      const uniqueNos = new Set(rawInputs.map(r => r.no));
      if (rawInputs.length > 1 && (uniqueNos.size === 1 || rawInputs.some(r => !r.no || Number(r.no) <= 0))) {
        // Auto-heal duplicate or corrupted sequence numbers in DB sequentially 1..N by emp_id
        for (let idx = 0; idx < rawInputs.length; idx++) {
          const correctNo = idx + 1;
          rawInputs[idx].no = correctNo;
          await db.prepare('UPDATE monthly_inputs SET no = ? WHERE period = ? AND emp_id = ?')
            .bind(correctNo, period, rawInputs[idx].emp_id).run().catch(() => {});
        }
      }
      const inputRecords = rawInputs.map((i, idx) => ({
        period: i.period,
        no: Number(i.no) || (idx + 1),
        empId: i.emp_id,
        empName: i.emp_name || '',
        nickname: empNickMap[i.emp_id] || '',
        baseSalary: Number(i.base_salary) || 0,
        pfRate: (i.pf_rate !== null && i.pf_rate !== undefined && !isNaN(Number(i.pf_rate))) ? Number(i.pf_rate) : 0.05,
        pfAmount: Number(i.pf_amount) || 0,
        absentDays: Number(i.absent_days) || 0,
        leaveDays: Number(i.leave_days) || 0,
        sickLeaveDays: Number(i.sick_leave_days) || 0,
        unpaidSickLeaveDays: Number(i.unpaid_sick_leave_days) || 0,
        lateDeduct: Number(i.late_deduct) || 0,
        lateMinutes: Number(i.late_minutes) || 0,
        lateCount: Number(i.late_count) || 0,
        otHours: Number(i.ot_hours) || 0,
        otRate: (i.ot_rate !== null && i.ot_rate !== undefined && !isNaN(Number(i.ot_rate))) ? Number(i.ot_rate) : 40,
        allowance: Number(i.allowance) || 0,
        bonus: Number(i.bonus) || 0,
        advanceDeduct: Number(i.advance_deduct) || 0,
        otherDeduct: Number(i.other_deduct) || 0,
        carriedDebt: Number(i.carried_debt) || 0,
        sso: (i.sso !== null && i.sso !== undefined && !isNaN(Number(i.sso))) ? Number(i.sso) : 0,
        tax: Number(i.tax) || 0
      }));

      // Payroll Calcs
      let payrollList = [];
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;
      let totalEarnedBase = 0;
      let totalEarnedGross = 0;
      let totalEarnedNet = 0;

      const bkkTime = new Date(Date.now() + (7 * 3600 * 1000));
      const todayBangkok = bkkTime.toISOString().substring(0, 10);
      const isMidPeriod = (!isClosed && todayBangkok >= dates.startDate && todayBangkok <= dates.endDate);
      const generalElapsed = getElapsedWorkingDaysInCutoff(dates.startDate, dates.endDate, todayBangkok, holidayDatesSet);

      const empObjMap = {};
      for (const e of employees) {
        if (e.empId) empObjMap[e.empId] = e;
      }

      if (inputRecords.length === 0) {
        await db.prepare('DELETE FROM payroll_calcs WHERE period = ?').bind(period).run();
      } else {
        let calcQuery = await db.prepare('SELECT * FROM payroll_calcs WHERE period = ? ORDER BY emp_id ASC').bind(period).all();
        if (!calcQuery.results || calcQuery.results.length === 0) {
          await calculateAndSavePayroll(db, period, workingDays);
          calcQuery = await db.prepare('SELECT * FROM payroll_calcs WHERE period = ? ORDER BY emp_id ASC').bind(period).all();
        }

        payrollList = (calcQuery.results || []).map(c => {
          const gross = Number(c.gross_pay) || 0;
          const ded = Number(c.total_deductions) || 0;
          const net = Number(c.net_pay) || 0;
          totalGross += gross;
          totalDeductions += ded;
          totalNet += net;

          const emp = empObjMap[c.emp_id] || {};
          const contractBaseSal = Number(emp.baseSalary) || Number(c.base_salary) || 0;
          const dailyRate = workingDays > 0 ? (contractBaseSal / workingDays) : (contractBaseSal / 30);
          const empElapsed = getElapsedWorkingDaysInCutoff(dates.startDate, dates.endDate, todayBangkok, holidayDatesSet, emp.joinDate, emp.resignDate);

          // Earned Base Salary based on actual elapsed working days to-date
          const earnedBaseSalary = Math.round(dailyRate * empElapsed.elapsedDays * 100) / 100;
          const otPay = Number(c.ot_pay) || 0;
          const allowance = Number(c.allowance) || 0;
          const bonus = Number(c.bonus) || 0;
          const leaveDeduction = Number(c.leave_deduction) || 0;
          const earnedGrossPay = Math.round((earnedBaseSalary + otPay + allowance + bonus - leaveDeduction) * 100) / 100;

          // Statutory & Mid-Period Deductions to-date
          const earnedSso = Math.min(Number(c.sso) || 750, Math.round(earnedBaseSalary * 0.05 * 100) / 100);
          const pfRate = (Number(c.pf) > 0 && contractBaseSal > 0) ? (Number(c.pf) / contractBaseSal) : (Number(emp.pfRate) || 0);
          const earnedPf = Math.round(earnedBaseSalary * pfRate * 100) / 100;
          const earnedTax = Math.round((Number(c.tax) || 0) * empElapsed.ratio * 100) / 100;
          const advDed = Number(c.advance_deduct) || 0;
          const othDed = Number(c.other_deduct) || 0;
          const carriedDebt = Number(c.carried_debt) || 0;
          const earnedTotalDeductions = Math.round((earnedSso + earnedPf + earnedTax + advDed + othDed + carriedDebt) * 100) / 100;
          const rawEarnedNet = Math.round((earnedGrossPay - earnedTotalDeductions) * 100) / 100;
          const earnedNetPay = rawEarnedNet > 0 ? Math.ceil(rawEarnedNet) : 0;
          const earnedCarriedDebt = rawEarnedNet < 0 ? Math.round(Math.abs(rawEarnedNet) * 100) / 100 : 0;

          totalEarnedBase += earnedBaseSalary;
          totalEarnedGross += earnedGrossPay;
          totalEarnedNet += earnedNetPay;

          return {
            period: c.period,
            empId: c.emp_id,
            name: c.full_name || '',
            nickname: empNickMap[c.emp_id] || '',
            department: c.department || '',
            position: c.position || '',
            bankName: c.bank_name || '',
            bankAccount: c.bank_account || '',
            baseSalary: Number(c.base_salary) || 0,
            otHours: Number(c.ot_hours) || 0,
            otRate: Number(c.ot_rate) || 40,
            otPay: otPay,
            allowance: allowance,
            bonus: bonus,
            leaveDeduction: leaveDeduction,
            grossPay: gross,
            sso: Number(c.sso) || 0,
            pf: Number(c.pf) || 0,
            tax: Number(c.tax) || 0,
            advanceDeduct: advDed,
            otherDeduct: othDed,
            carriedDebt: carriedDebt,
            totalDeductions: ded,
            netPay: net,
            // Mid-Period Accrued/Earned Wage Preview Fields
            dailyRate: Math.round(dailyRate * 100) / 100,
            elapsedWorkDays: empElapsed.elapsedDays,
            totalWorkDays: workingDays,
            asOfDate: todayBangkok,
            isMidPeriod: isMidPeriod,
            earnedBaseSalary: earnedBaseSalary,
            earnedGrossPay: earnedGrossPay,
            earnedSso: earnedSso,
            earnedPf: earnedPf,
            earnedTax: earnedTax,
            earnedTotalDeductions: earnedTotalDeductions,
            earnedNetPay: earnedNetPay,
            earnedCarriedDebt: earnedCarriedDebt
          };
        });
      }

      // Users
      const usersQuery = await db.prepare('SELECT username, password, role, permissions FROM users ORDER BY username ASC').all();
      const users = (usersQuery.results || []).map(u => {
        let perms = [];
        try {
          perms = u.permissions ? (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions) : getDefaultRolePermissions(u.role);
        } catch(e) {
          perms = getDefaultRolePermissions(u.role);
        }
        return {
          username: u.username,
          password: u.password,
          role: u.role || 'User',
          permissions: perms
        };
      });

      const latestRowPeriod = await db.prepare('SELECT period FROM monthly_inputs ORDER BY rowid DESC LIMIT 1').first().catch(() => null);
      let latestActivePeriod = (latestRowPeriod && latestRowPeriod.period) ? latestRowPeriod.period : period;
      if (latestRowPeriod && latestRowPeriod.period) {
        const closedRow = (settingsRows.results || []).find(r => r.key === `Period_Status_${latestRowPeriod.period}`);
        if (closedRow && closedRow.value && closedRow.value.startsWith('CLOSED')) {
          const nextP = getNextPeriodStr(latestRowPeriod.period);
          if (nextP) latestActivePeriod = nextP;
        }
      }

      const getSetNum = (k, def) => {
        const row = (settingsRows.results || []).find(r => r.key === k);
        return (row && row.value !== undefined && row.value !== null && !isNaN(Number(row.value))) ? Number(row.value) : def;
      };
      const getSetBool = (k, def) => {
        const row = (settingsRows.results || []).find(r => r.key === k);
        return row ? (row.value !== 'false') : def;
      };
      const getSetStr = (k, def) => {
        const row = (settingsRows.results || []).find(r => r.key === k);
        return (row && row.value !== undefined && row.value !== null && row.value !== '') ? String(row.value) : def;
      };

      const payrollDefaults = {
        defaultOtRate: getSetNum('DefaultOtRate', 40),
        defaultWorkDays: getSetNum('DefaultWorkDays', 30),
        absentFactor: getSetNum('AbsentFactor', 1.5),
        leaveFactor: getSetNum('LeaveFactor', 1.0),
        sickLeaveQuota: getSetNum('SickLeaveQuota', 10),
        defaultPfRate: getSetNum('DefaultPfRate', 0.05),
        defaultProbationDays: getSetNum('DefaultProbationDays', 119),
        diligenceAllowance: getSetNum('DiligenceAllowance', 1000),
        diligenceLateGraceMins: getSetNum('DiligenceLateGraceMins', 2),
        diligenceLateMaxCount: getSetNum('DiligenceLateMaxCount', 1),
        autoDiligenceEnabled: getSetBool('AutoDiligenceEnabled', true),
        countOverbreakAsLate: getSetBool('CountOverbreakAsLate', true),
        missingBreakPenaltyMode: getSetStr('MissingBreakPenaltyMode', 'ALERT_ONLY')
      };

      return {
        success: true,
        period: period,
        latestActivePeriod: latestActivePeriod,
        workingDays: workingDays,
        isMidPeriod: isMidPeriod,
        asOfDate: todayBangkok,
        elapsedWorkDays: generalElapsed.elapsedDays,
        periodCutoff: { startDate: dates.startDate, endDate: dates.endDate },
        settings: settingsMap,
        payrollDefaults: payrollDefaults,
        isClosed: isClosed,
        closedInfo: closedInfo,
        employees: employees,
        inputRecords: inputRecords,
        payrollList: payrollList,
        stats: {
          totalEmployees: payrollList.length,
          totalGross: Math.round(totalGross * 100) / 100,
          totalDeductions: Math.round(totalDeductions * 100) / 100,
          totalNet: Math.round(totalNet * 100) / 100,
          totalEarnedBase: Math.round(totalEarnedBase * 100) / 100,
          totalEarnedGross: Math.round(totalEarnedGross * 100) / 100,
          totalEarnedNet: Math.round(totalEarnedNet * 100) / 100
        },
        users: users,
        branches: branchRows.results || [],
        companyHolidays: companyHolidays
      };
  },

  savePayrollDefaults: async (db, params) => {
      const callerUser = params.currentUsername || params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_company')) || (await userHasPermission(db, callerUser, 'calc_payroll')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ตั้งค่านโยบายเงินเดือน' };

      const d = params.defaults || {};
      if (d.defaultOtRate !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("DefaultOtRate", ?)').bind(String(d.defaultOtRate)).run();
      if (d.defaultWorkDays !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("DefaultWorkDays", ?)').bind(String(d.defaultWorkDays)).run();
      if (d.absentFactor !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("AbsentFactor", ?)').bind(String(d.absentFactor)).run();
      if (d.leaveFactor !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("LeaveFactor", ?)').bind(String(d.leaveFactor)).run();
      if (d.sickLeaveQuota !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("SickLeaveQuota", ?)').bind(String(d.sickLeaveQuota)).run();
      if (d.defaultPfRate !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("DefaultPfRate", ?)').bind(String(d.defaultPfRate)).run();
      if (d.defaultProbationDays !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("DefaultProbationDays", ?)').bind(String(d.defaultProbationDays)).run();
      if (d.diligenceAllowance !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("DiligenceAllowance", ?)').bind(String(d.diligenceAllowance)).run();
      if (d.diligenceLateGraceMins !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("DiligenceLateGraceMins", ?)').bind(String(d.diligenceLateGraceMins)).run();
      if (d.diligenceLateMaxCount !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("DiligenceLateMaxCount", ?)').bind(String(d.diligenceLateMaxCount)).run();
      if (d.autoDiligenceEnabled !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("AutoDiligenceEnabled", ?)').bind(String(d.autoDiligenceEnabled)).run();
      if (d.countOverbreakAsLate !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("CountOverbreakAsLate", ?)').bind(String(d.countOverbreakAsLate)).run();
      if (d.missingBreakPenaltyMode !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("MissingBreakPenaltyMode", ?)').bind(String(d.missingBreakPenaltyMode)).run();

      await calculateAndSavePayroll(db, period);
      await logSystemActivity(db, callerUser || 'Admin', 'SETTINGS_UPDATE', 'อัปเดตค่านโยบายและค่าเริ่มต้นการคำนวณเงินเดือน');
      return { success: true, message: 'บันทึกค่านโยบายและค่าเริ่มต้นระบบเงินเดือนเรียบร้อยแล้ว' };
  },

  savePeriodWorkDays: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const allowed = (await isUserSuperAdmin(db, callerUser)) || (await userHasPermission(db, callerUser, 'calc_payroll'));
      if (!allowed) {
        return { success: false, message: 'สิทธิ์ไม่เพียงพอ: การตั้งค่าวันทำงานสงวนสิทธิ์เฉพาะ Super Admin และ Admin เท่านั้น' };
      }
      if (await isPeriodLocked(db, period)) {
        return { success: false, message: `งวดประจำเดือน ${period} ถูกปิดและล็อคแล้ว ไม่อนุญาตให้แก้ไขจำนวนวันทำงาน กรุณาปลดล็อคงวดก่อนดำเนินการ` };
      }
      const days = Number(params.workingDays) || 30;
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(`Period_WorkDays_${period}`, String(days)).run();
      const count = await calculateAndSavePayroll(db, period, days);
      await logSystemActivity(db, callerUser, 'SET_WORK_DAYS', `ตั้งค่าจำนวนวันทำงานงวด ${period} เป็น ${days} วัน`);
      return { success: true, period: period, workingDays: days, count: count, message: `ตั้งค่าจำนวนวันทำงานงวด ${period} เป็น ${days} วัน เรียบร้อยแล้ว` };
  },

  getActualWorkDays: async (db, params) => {
      const dates = await getCutoffDatesForPeriod(db, period);
      const holidayDatesSet = await getCompanyHolidayDatesSet(db, dates.startDate, dates.endDate);
      const actualDays = getActualWorkingDaysInCutoff(dates.startDate, dates.endDate, holidayDatesSet);
      return { success: true, period: period, startDate: dates.startDate, endDate: dates.endDate, actualDays: actualDays, holidaysCount: holidayDatesSet.size };
  },

  saveInputRecord: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'edit_inputs')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์บันทึกข้อมูลประจำงวด' };
      if (await isPeriodLocked(db, period)) {
        return { success: false, message: `งวดประจำเดือน ${period} ถูกปิดและล็อคแล้ว ไม่อนุญาตให้แก้ไขหรือบันทึกข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ` };
      }

      const r = params.record || {};
      const origEmpId = params.origEmpId;
      if (!r.empId) return { success: false, message: 'กรุณาเลือกรหัสพนักงาน' };

      const baseSal = Number(r.baseSalary) || 0;
      const pfRate = (r.pfRate !== null && r.pfRate !== undefined && !isNaN(Number(r.pfRate))) ? Number(r.pfRate) : 0.05;
      const pfAmt = pfRate > 0 ? (Number(r.pfAmount !== undefined && r.pfAmount !== null ? r.pfAmount : Math.round(baseSal * pfRate * 100) / 100)) : 0;
      const otRate = (r.otRate !== null && r.otRate !== undefined && !isNaN(Number(r.otRate))) ? Number(r.otRate) : 40;

      if (origEmpId && origEmpId !== r.empId) {
        await db.prepare('DELETE FROM monthly_inputs WHERE period = ? AND emp_id = ?').bind(period, origEmpId).run();
      }

      let recordNo = Number(r.no) || 0;
      if (!recordNo) {
        const existRow = await db.prepare('SELECT no FROM monthly_inputs WHERE period = ? AND emp_id = ?').bind(period, origEmpId || r.empId).first();
        if (existRow && existRow.no) {
          recordNo = Number(existRow.no);
        } else {
          const maxRow = await db.prepare('SELECT COALESCE(MAX(no), 0) as max_no FROM monthly_inputs WHERE period = ?').bind(period).first();
          recordNo = (maxRow ? Number(maxRow.max_no) : 0) + 1;
        }
      }

      const lateMins = (r.lateMinutes !== undefined && r.lateMinutes !== null) ? Number(r.lateMinutes) : 0;
      const lateCnt = (r.lateCount !== undefined && r.lateCount !== null) ? Number(r.lateCount) : 0;
      const carriedDebt = (r.carriedDebt !== undefined && r.carriedDebt !== null) ? Number(r.carriedDebt) : 0;

      await db.prepare(`
        INSERT OR REPLACE INTO monthly_inputs
        (period, no, emp_id, emp_name, base_salary, pf_rate, pf_amount, absent_days, leave_days, sick_leave_days, unpaid_sick_leave_days, late_deduct, late_minutes, late_count, ot_hours, ot_rate, allowance, bonus, advance_deduct, other_deduct, carried_debt, sso, tax)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        period, recordNo, r.empId, r.empName || '', baseSal, pfRate, pfAmt,
        Number(r.absentDays) || 0, Number(r.leaveDays) || 0, Number(r.sickLeaveDays) || 0, Number(r.unpaidSickLeaveDays) || 0, Number(r.lateDeduct) || 0,
        lateMins, lateCnt,
        Number(r.otHours) || 0, otRate,
        Number(r.allowance) || 0, Number(r.bonus) || 0, Number(r.advanceDeduct) || 0,
        Number(r.otherDeduct) || 0, carriedDebt, (r.sso !== null && r.sso !== undefined && !isNaN(Number(r.sso))) ? Number(r.sso) : 0, Number(r.tax) || 0
      ).run();

      await calculateAndSavePayroll(db, period);
      return { success: true, message: `บันทึกข้อมูลประจำงวด ${period} เรียบร้อยแล้ว` };
  },

  deleteInputRecord: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'edit_inputs')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ลบข้อมูลประจำงวด' };
      if (await isPeriodLocked(db, period)) {
        return { success: false, message: `งวดประจำเดือน ${period} ถูกปิดและล็อคแล้ว ไม่อนุญาตให้ลบข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ` };
      }

      const empId = params.empId;
      if (!empId) return { success: false, message: 'Missing empId' };
      await db.prepare('DELETE FROM monthly_inputs WHERE period = ? AND emp_id = ?').bind(period, empId).run();
      await db.prepare('DELETE FROM payroll_calcs WHERE period = ? AND emp_id = ?').bind(period, empId).run();
      await calculateAndSavePayroll(db, period).catch(() => {});
      await logSystemActivity(db, params.username || 'Admin', 'DELETE_INPUT_RECORD', `ลบข้อมูลประจำงวด ${period} ของ ${empId}`);
      return { success: true, message: `ลบข้อมูลประจำงวด ${period} ของ ${empId} เรียบร้อยแล้ว` };
  },

  batchDeleteInputRecords: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'edit_inputs')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ลบข้อมูลประจำงวด' };
      if (await isPeriodLocked(db, period)) {
        return { success: false, message: `งวดประจำเดือน ${period} ถูกปิดและล็อคแล้ว ไม่อนุญาตให้ลบข้อมูล กรุณาปลดล็อคงวดก่อนดำเนินการ` };
      }

      const empIds = Array.isArray(params.empIds) ? params.empIds : [];
      if (empIds.length === 0) return { success: false, message: 'กรุณาเลือกรายการที่ต้องการลบ' };

      let deletedCount = 0;
      for (const empId of empIds) {
        await db.prepare('DELETE FROM monthly_inputs WHERE period = ? AND emp_id = ?').bind(period, empId).run().catch(() => {});
        await db.prepare('DELETE FROM payroll_calcs WHERE period = ? AND emp_id = ?').bind(period, empId).run().catch(() => {});
        deletedCount++;
      }

      await calculateAndSavePayroll(db, period).catch(() => {});
      await logSystemActivity(db, params.username || 'Admin', 'BATCH_DELETE_INPUTS', `ลบข้อมูลประจำงวด ${period} จำนวน ${deletedCount} รายการ`);
      return { success: true, count: deletedCount, message: `ลบข้อมูลประจำงวดสำเร็จ ${deletedCount} รายการ` };
  },

  populateEmployeesToPeriod: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'populate_inputs')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดึงพนักงานเข้างวดนี้' };
      if (await isPeriodLocked(db, period)) {
        return { success: false, message: `งวดประจำเดือน ${period} ถูกปิดและล็อคแล้ว ไม่อนุญาตให้ดึงพนักงานเข้างวด กรุณาปลดล็อคงวดก่อนดำเนินการ` };
      }

      const empQuery = await db.prepare('SELECT * FROM employees ORDER BY emp_id ASC').all();
      const employees = empQuery.results || [];
      if (employees.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลในทะเบียนพนักงาน กรุณาเพิ่มพนักงานก่อน' };
      }

      const existingInput = await db.prepare('SELECT * FROM monthly_inputs WHERE period = ?').bind(period).all();
      const existingMap = {};
      for (const row of existingInput.results || []) existingMap[row.emp_id] = row;

      const dates = await getCutoffDatesForPeriod(db, period);
      const holidayDatesSet = await getCompanyHolidayDatesSet(db, dates.startDate, dates.endDate);

      // Query carried debt from previous period
      const prevPeriodStr = getPreviousPeriodStr(period);
      const prevCalcs = await db.prepare('SELECT emp_id, carried_debt FROM payroll_calcs WHERE period = ? AND carried_debt > 0').bind(prevPeriodStr).all().catch(() => ({ results: [] }));
      const prevDebtMap = {};
      for (const r of (prevCalcs.results || [])) {
        if (r.emp_id && Number(r.carried_debt) > 0) prevDebtMap[r.emp_id] = Number(r.carried_debt);
      }

      // Query approved advance requests in this cutoff window
      let advMap = {};
      try {
        const advQuery = await db.prepare(`
          SELECT emp_id, SUM(amount) as total_amt
          FROM advance_requests
          WHERE status = 'APPROVED'
            AND (request_date BETWEEN ? AND ? OR period = ?)
          GROUP BY emp_id
        `).bind(dates.startDate, dates.endDate, period).all().catch(() => ({ results: [] }));
        for (const row of (advQuery.results || [])) {
          advMap[row.emp_id] = Number(row.total_amt) || 0;
        }
      } catch (e) {
        console.warn('advance_requests in populate error:', e);
      }

      // Check which employees have time logs in this cutoff window
      const activeLogsQuery = await db.prepare(`
        SELECT DISTINCT emp_id FROM time_logs WHERE date BETWEEN ? AND ?
      `).bind(dates.startDate, dates.endDate).all().catch(() => ({ results: [] }));
      const activeLogsEmpSet = new Set((activeLogsQuery.results || []).map(r => r.emp_id));

      let added = 0;
      let nextNo = 0;

      for (const emp of employees) {
        if (emp.status === 'Resigned') {
          const resignDateStr = emp.resign_date ? normalizeDateToIso(emp.resign_date) : '';
          const hasResignInPeriod = resignDateStr && resignDateStr >= dates.startDate && resignDateStr <= dates.endDate;
          const hasLogsInPeriod = activeLogsEmpSet.has(emp.emp_id);
          const alreadyInPeriod = Boolean(existingMap[emp.emp_id]);
          if (!hasResignInPeriod && !hasLogsInPeriod && !alreadyInPeriod) {
            continue; // Skip past resigned employees
          }
        }
        const joinDateStr = emp.join_date ? normalizeDateToIso(emp.join_date) : '';
        if (joinDateStr && joinDateStr > dates.endDate) continue; // Not started yet

        nextNo++;
        added++;

        let resignDateStr = emp.resign_date ? normalizeDateToIso(emp.resign_date) : '';
        const proRata = calculatePeriodProRataRatio(joinDateStr, resignDateStr, dates.startDate, dates.endDate, holidayDatesSet);
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

        const absentDays = Number(exist.absent_days) || 0;
        const leaveDays = Number(exist.leave_days) || 0;
        const sickLeaveDays = Number(exist.sick_leave_days) || 0;
        const unpaidSickLeaveDays = Number(exist.unpaid_sick_leave_days) || 0;
        const lateDeduct = Number(exist.late_deduct) || 0;
        const lateMins = Number(exist.late_minutes) || 0;
        const lateCnt = Number(exist.late_count) || 0;
        const otHours = Number(exist.ot_hours) || 0;
        const defOtRow = await db.prepare('SELECT value FROM settings WHERE key = "DefaultOtRate"').first().catch(() => null);
        const fallbackOtRate = (defOtRow && defOtRow.value && !isNaN(Number(defOtRow.value))) ? Number(defOtRow.value) : 40;
        const otRate = (exist.ot_rate !== null && exist.ot_rate !== undefined && !isNaN(Number(exist.ot_rate))) ? Number(exist.ot_rate) : fallbackOtRate;
        const allowance = Number(exist.allowance) || 0;
        const bonus = Number(exist.bonus) || 0;
        const advDed = (exist.advance_deduct !== undefined && exist.advance_deduct !== null && Number(exist.advance_deduct) > 0)
          ? Number(exist.advance_deduct)
          : (advMap[emp.emp_id] || 0);
        const othDed = Number(exist.other_deduct) || 0;
        const carriedDebt = (exist.carried_debt !== undefined && exist.carried_debt !== null && Number(exist.carried_debt) > 0)
          ? Number(exist.carried_debt)
          : (prevDebtMap[emp.emp_id] || 0);

        await db.prepare(`
          INSERT OR REPLACE INTO monthly_inputs
          (period, no, emp_id, emp_name, base_salary, pf_rate, pf_amount, absent_days, leave_days, sick_leave_days, unpaid_sick_leave_days, late_deduct, late_minutes, late_count, ot_hours, ot_rate, allowance, bonus, advance_deduct, other_deduct, carried_debt, sso, tax)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          period, nextNo, emp.emp_id, emp.full_name || '', baseSal, pfRate, pfAmt,
          absentDays, leaveDays, sickLeaveDays, unpaidSickLeaveDays, lateDeduct, lateMins, lateCnt, otHours, otRate, allowance, bonus, advDed, othDed, carriedDebt, sso, tax
        ).run();
      }

      await calculateAndSavePayroll(db, period);
      return {
        success: true,
        period: period,
        count: added,
        message: `ดึงและอัปเดตข้อมูลพนักงานเข้างวด ${period} สำเร็จ (${added} คน)`
      };
  },

  processPayroll: async (db, params) => {
      const callerUser = params.currentUsername || params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'calc_payroll')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ประมวลผลเงินเดือน' };
      if (await isPeriodLocked(db, period)) {
        return { success: false, message: `งวดประจำเดือน ${period} ถูกปิดและล็อคแล้ว ผลการคำนวณถูกล็อคถาวร ไม่อนุญาตให้คำนวณใหม่ กรุณาปลดล็อคงวดก่อนดำเนินการ` };
      }

      const count = await calculateAndSavePayroll(db, period);
      await logSystemActivity(db, callerUser || 'Admin', 'CALC_PAYROLL', `ประมวลผลคำนวณเงินเดือนงวด ${period} (${count} รายการ)`);
      return { success: true, period: period, count: count, message: `ประมวลผลคำนวณเงินเดือนงวด ${period} สำเร็จ (${count} รายการ)` };
  },

  getYearlySummary: async (db, params) => {
      const year = String(params.year || '').trim();
      let calcsQuery = 'SELECT * FROM payroll_calcs';
      let inputsQuery = 'SELECT * FROM monthly_inputs';
      const bindings = [];

      if (year && year !== 'ALL') {
        calcsQuery += ' WHERE period LIKE ?';
        inputsQuery += ' WHERE period LIKE ?';
        bindings.push(`% ${year}`);
      }

      calcsQuery += ' ORDER BY period ASC, emp_id ASC';
      inputsQuery += ' ORDER BY period ASC, emp_id ASC';

      const calcs = (bindings.length > 0 ? await db.prepare(calcsQuery).bind(...bindings).all() : await db.prepare(calcsQuery).all()).results || [];
      const inputs = (bindings.length > 0 ? await db.prepare(inputsQuery).bind(...bindings).all() : await db.prepare(inputsQuery).all()).results || [];
      const emps = (await db.prepare('SELECT * FROM employees ORDER BY emp_id ASC').all()).results || [];

      const empMap = {};
      for (const e of emps) empMap[e.emp_id] = e;

      const inputMap = {};
      for (const i of inputs) {
        inputMap[`${i.period}_${i.emp_id}`] = i;
      }

      // Group by emp_id
      const empSummaryMap = {};
      for (const e of emps) {
        empSummaryMap[e.emp_id] = {
          empId: e.emp_id,
          fullName: e.full_name,
          nickname: e.nickname || '',
          photoUrl: e.photo_url || '',
          department: e.department || '',
          position: e.position || '',
          bankName: e.bank_name || '',
          bankAccount: e.bank_account || '',
          citizenId: e.citizen_id || '',
          totalPeriods: 0,
          periodsList: [],
          baseSalaryLatest: Number(e.base_salary) || 0,
          totalBaseSalary: 0,
          totalAbsentDays: 0,
          totalLeaveDays: 0,
          totalSickLeaveDays: 0,
          totalLateDeduct: 0,
          totalOtHours: 0,
          totalOtPay: 0,
          totalAllowance: 0,
          totalBonus: 0,
          totalLeaveDeduction: 0,
          totalGrossPay: 0,
          totalSso: 0,
          totalPf: 0,
          totalTax: 0,
          totalAdvanceDeduct: 0,
          totalOtherDeduct: 0,
          totalDeductions: 0,
          totalNetPay: 0
        };
      }

      for (const c of calcs) {
        if (!empSummaryMap[c.emp_id]) {
          const emp = empMap[c.emp_id] || {};
          empSummaryMap[c.emp_id] = {
            empId: c.emp_id,
            fullName: c.full_name || emp.full_name || '',
            nickname: emp.nickname || '',
            photoUrl: emp.photo_url || '',
            department: c.department || emp.department || '',
            position: c.position || emp.position || '',
            bankName: c.bank_name || emp.bank_name || '',
            bankAccount: c.bank_account || emp.bank_account || '',
            citizenId: emp.citizen_id || '',
            totalPeriods: 0,
            periodsList: [],
            baseSalaryLatest: Number(c.base_salary) || 0,
            totalBaseSalary: 0,
            totalAbsentDays: 0,
            totalLeaveDays: 0,
            totalSickLeaveDays: 0,
            totalLateDeduct: 0,
            totalOtHours: 0,
            totalOtPay: 0,
            totalAllowance: 0,
            totalBonus: 0,
            totalLeaveDeduction: 0,
            totalGrossPay: 0,
            totalSso: 0,
            totalPf: 0,
            totalTax: 0,
            totalAdvanceDeduct: 0,
            totalOtherDeduct: 0,
            totalDeductions: 0,
            totalNetPay: 0
          };
        }

        const s = empSummaryMap[c.emp_id];
        const inp = inputMap[`${c.period}_${c.emp_id}`] || {};

        s.totalPeriods += 1;
        s.periodsList.push(c.period);
        s.baseSalaryLatest = Number(c.base_salary) || s.baseSalaryLatest;
        s.totalBaseSalary += Number(c.base_salary) || 0;
        s.totalAbsentDays += Number(inp.absent_days) || 0;
        s.totalLeaveDays += Number(inp.leave_days) || 0;
        s.totalSickLeaveDays += Number(inp.sick_leave_days) || 0;
        s.totalLateDeduct += Number(inp.late_deduct) || 0;
        s.totalOtHours += Number(c.ot_hours) || 0;
        s.totalOtPay += Number(c.ot_pay) || 0;
        s.totalAllowance += Number(c.allowance) || 0;
        s.totalBonus += Number(c.bonus) || 0;
        s.totalLeaveDeduction += Number(c.leave_deduction) || 0;
        s.totalGrossPay += Number(c.gross_pay) || 0;
        s.totalSso += Number(c.sso) || 0;
        s.totalPf += Number(c.pf) || 0;
        s.totalTax += Number(c.tax) || 0;
        s.totalAdvanceDeduct += Number(c.advance_deduct) || 0;
        s.totalOtherDeduct += Number(c.other_deduct) || 0;
        s.totalDeductions += Number(c.total_deductions) || 0;
        s.totalNetPay += Number(c.net_pay) || 0;
      }

      for (const s of Object.values(empSummaryMap)) {
        s.periodsList.sort((a, b) => getPeriodSortKey(a) - getPeriodSortKey(b));
      }

      const summaryList = Object.values(empSummaryMap).sort((a,b) => a.empId.localeCompare(b.empId));

      const grandTotal = {
        totalEmployees: summaryList.length,
        activeEmployees: summaryList.filter(x => x.totalPeriods > 0).length,
        totalBaseSalary: summaryList.reduce((acc, x) => acc + x.totalBaseSalary, 0),
        totalAbsentDays: summaryList.reduce((acc, x) => acc + x.totalAbsentDays, 0),
        totalLeaveDays: summaryList.reduce((acc, x) => acc + x.totalLeaveDays, 0),
        totalSickLeaveDays: summaryList.reduce((acc, x) => acc + x.totalSickLeaveDays, 0),
        totalLateDeduct: summaryList.reduce((acc, x) => acc + x.totalLateDeduct, 0),
        totalOtHours: summaryList.reduce((acc, x) => acc + x.totalOtHours, 0),
        totalOtPay: summaryList.reduce((acc, x) => acc + x.totalOtPay, 0),
        totalAllowance: summaryList.reduce((acc, x) => acc + x.totalAllowance, 0),
        totalBonus: summaryList.reduce((acc, x) => acc + x.totalBonus, 0),
        totalLeaveDeduction: summaryList.reduce((acc, x) => acc + x.totalLeaveDeduction, 0),
        totalGrossPay: summaryList.reduce((acc, x) => acc + x.totalGrossPay, 0),
        totalSso: summaryList.reduce((acc, x) => acc + x.totalSso, 0),
        totalPf: summaryList.reduce((acc, x) => acc + x.totalPf, 0),
        totalTax: summaryList.reduce((acc, x) => acc + x.totalTax, 0),
        totalAdvanceDeduct: summaryList.reduce((acc, x) => acc + x.totalAdvanceDeduct, 0),
        totalOtherDeduct: summaryList.reduce((acc, x) => acc + x.totalOtherDeduct, 0),
        totalDeductions: summaryList.reduce((acc, x) => acc + x.totalDeductions, 0),
        totalNetPay: summaryList.reduce((acc, x) => acc + x.totalNetPay, 0)
      };

      return { success: true, year: year, yearlySummary: summaryList, grandTotal: grandTotal };
  },

  getAllEmployeeHistory: async (db, params) => {
      const calcs = (await db.prepare('SELECT * FROM payroll_calcs ORDER BY emp_id ASC').all()).results || [];
      const inputs = (await db.prepare('SELECT * FROM monthly_inputs ORDER BY emp_id ASC').all()).results || [];
      const emps = (await db.prepare('SELECT * FROM employees ORDER BY emp_id ASC').all()).results || [];
      const branches = (await db.prepare('SELECT * FROM branches ORDER BY branch_id ASC').all().catch(() => ({ results: [] }))).results || [];

      let advanceStats = [];
      try {
        advanceStats = (await db.prepare('SELECT emp_id, amount, status, request_date, period FROM advance_requests').all()).results || [];
      } catch(e) {}

      const empMap = {};
      for (const e of emps) empMap[e.emp_id] = e;

      const inputMap = {};
      for (const i of inputs) {
        inputMap[`${i.period}_${i.emp_id}`] = i;
      }

      const allRecords = calcs.map(c => mapPayrollCalcHistoryRecord(c, inputMap, empMap));
      allRecords.sort((a, b) => {
        const pDiff = getPeriodSortKey(a.period) - getPeriodSortKey(b.period);
        if (pDiff !== 0) return pDiff;
        return String(a.empId || '').localeCompare(String(b.empId || ''));
      });

      return { success: true, allHistory: allRecords, branches, advanceStats };
  },

  getEmployeeHistory: async (db, params) => {
      const empId = params.empId;
      if (!empId) return { success: false, message: 'Missing empId' };

      const emp = await db.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empId).first();
      if (!emp) return { success: false, message: `ไม่พบพนักงานรหัส ${empId}` };

      const calcs = await db.prepare('SELECT * FROM payroll_calcs WHERE emp_id = ?').bind(empId).all();
      const inputs = await db.prepare('SELECT * FROM monthly_inputs WHERE emp_id = ?').bind(empId).all();

      const inputMap = {};
      for (const i of inputs.results || []) inputMap[i.period] = i;

      const empMap = { [empId]: emp };
      const historyList = (calcs.results || []).map(c => mapPayrollCalcHistoryRecord(c, inputMap, empMap));
      historyList.sort((a, b) => getPeriodSortKey(a.period) - getPeriodSortKey(b.period));

      return {
        success: true,
        employee: {
          empId: emp.emp_id,
          fullName: emp.full_name,
          nickname: emp.nickname || '',
          photoUrl: emp.photo_url || '',
          citizenId: emp.citizen_id,
          phone: emp.phone,
          address: emp.address,
          department: emp.department,
          position: emp.position,
          baseSalary: Number(emp.base_salary) || 0,
          bankName: emp.bank_name,
          bankAccount: emp.bank_account,
          birthDate: emp.birth_date || '',
          age: Number(emp.age) || 0,
          joinDate: emp.join_date || '',
          pfRate: (emp.pf_rate !== null && emp.pf_rate !== undefined && !isNaN(Number(emp.pf_rate))) ? Number(emp.pf_rate) : 0.05,
          defaultSso: (emp.default_sso !== null && emp.default_sso !== undefined && !isNaN(Number(emp.default_sso))) ? Number(emp.default_sso) : 0,
          defaultTax: Number(emp.default_tax) || 0,
          remark: emp.remark || ''
        },
        history: historyList
      };
  },

  closePeriod: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'close_period')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ปิดงวดเงินเดือน' };

      await calculateAndSavePayroll(db, period);
      const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const val = `CLOSED|${timeStr}|${params.username || 'Admin'}`;
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(`Period_Status_${period}`, val).run();
      await logSystemActivity(db, params.username || 'Admin', 'PERIOD_CLOSE', `ปิดงวดประจำเดือน ${period}`);
      const nextP = getNextPeriodStr(period);
      return {
        success: true,
        period: period,
        isClosed: true,
        nextPeriod: nextP,
        message: `ปิดงวดประจำเดือน ${period} เรียบร้อยแล้ว (ล็อคผลการคำนวณ)`
      };
  },

  reopenPeriod: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'close_period')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เปิดงวดเงินเดือน' };

      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, "OPEN")').bind(`Period_Status_${period}`).run();
      await logSystemActivity(db, params.username || 'Admin', 'PERIOD_REOPEN', `ปลดล็อคเปิดงวดประจำเดือน ${period}`);
      return { success: true, period: period, isClosed: false, message: `ปลดล็อคและเปิดงวดประจำเดือน ${period} เรียบร้อยแล้ว` };
  }
};
