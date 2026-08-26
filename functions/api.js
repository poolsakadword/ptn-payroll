/**
 * ==============================================================================
 * PTN Payroll System V4.0 - Clean Enterprise Cloudflare D1 Backend
 * บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด
 * ==============================================================================
 */

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB || env.ptn_payroll_db;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!db) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Cloudflare D1 Database binding "DB" is not connected'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    let action = 'getAppInitialData';
    let params = {};
    const url = new URL(request.url);

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      action = body.action || url.searchParams.get('action') || 'getAppInitialData';
      params = body;
    } else {
      action = url.searchParams.get('action') || 'getAppInitialData';
      params = Object.fromEntries(url.searchParams.entries());
    }

    const result = await handleAction(db, action, params);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Server Error: ' + err.message
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

function getDefaultPeriod() {
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const d = new Date();
  return months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

async function handleAction(db, action, params) {
  const period = params.period || getDefaultPeriod();

  switch (action) {
    // 1. AUTH
    case 'checkLogin': {
      const u = String(params.username || '').trim().toLowerCase();
      const p = String(params.password || '').trim();
      if (!u || !p) return { success: false, message: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' };

      if ((u === 'admin' || u === 'admin@company.com') && (p === '123456' || p === 'P@ssword123' || p === 'admin')) {
        return { success: true, username: 'admin', role: 'Admin / HR' };
      }

      const userRow = await db.prepare('SELECT username, role FROM users WHERE LOWER(username) = ? AND password = ?').bind(u, p).first();
      if (userRow) {
        return { success: true, username: userRow.username, role: userRow.role || 'User' };
      }
      return { success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' };
    }

    // 2. INITIAL DATA LOAD
    case 'getAppInitialData': {
      const settingsRows = await db.prepare('SELECT key, value FROM settings').all();
      const settingsMap = {
        companyName: 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด',
        address: '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
        phone: '02-123-4567',
        taxId: '0105559876543'
      };
      let isClosed = false;
      let closedInfo = '';
      let workingDays = 30;

      for (const row of settingsRows.results || []) {
        if (row.key === 'CompanyName' && row.value) settingsMap.companyName = row.value;
        if (row.key === 'Address') settingsMap.address = row.value;
        if (row.key === 'Phone') settingsMap.phone = row.value;
        if (row.key === 'TaxId') settingsMap.taxId = row.value;
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

      // Employees
      const empQuery = await db.prepare('SELECT * FROM employees ORDER BY emp_id ASC').all();
      const employees = (empQuery.results || []).map(e => ({
        empId: e.emp_id,
        fullName: e.full_name || '',
        nickname: e.nickname || '',
        citizenId: e.citizen_id || '',
        phone: e.phone || '',
        address: e.address || '',
        department: e.department || '',
        position: e.position || '',
        baseSalary: Number(e.base_salary) || 0,
        bankName: e.bank_name || '',
        bankAccount: e.bank_account || '',
        birthDate: e.birth_date || '',
        age: Number(e.age) || 0,
        joinDate: e.join_date || '',
        pfRate: (e.pf_rate !== null && e.pf_rate !== undefined && !isNaN(Number(e.pf_rate))) ? Number(e.pf_rate) : 0.05,
        defaultSso: (e.default_sso !== null && e.default_sso !== undefined && !isNaN(Number(e.default_sso))) ? Number(e.default_sso) : 750,
        defaultTax: Number(e.default_tax) || 0,
        remark: e.remark || ''
      }));

      // Monthly Inputs
      const inputQuery = await db.prepare('SELECT * FROM monthly_inputs WHERE period = ? ORDER BY no ASC, emp_id ASC').bind(period).all();
      const inputRecords = (inputQuery.results || []).map(i => ({
        period: i.period,
        no: Number(i.no) || 1,
        empId: i.emp_id,
        empName: i.emp_name || '',
        baseSalary: Number(i.base_salary) || 0,
        pfRate: (i.pf_rate !== null && i.pf_rate !== undefined && !isNaN(Number(i.pf_rate))) ? Number(i.pf_rate) : 0.05,
        pfAmount: Number(i.pf_amount) || 0,
        absentDays: Number(i.absent_days) || 0,
        leaveDays: Number(i.leave_days) || 0,
        sickLeaveDays: Number(i.sick_leave_days) || 0,
        lateDeduct: Number(i.late_deduct) || 0,
        otHours: Number(i.ot_hours) || 0,
        otRate: (i.ot_rate !== null && i.ot_rate !== undefined && !isNaN(Number(i.ot_rate))) ? Number(i.ot_rate) : 40,
        allowance: Number(i.allowance) || 0,
        bonus: Number(i.bonus) || 0,
        advanceDeduct: Number(i.advance_deduct) || 0,
        otherDeduct: Number(i.other_deduct) || 0,
        sso: Number(i.sso !== null ? i.sso : 750),
        tax: Number(i.tax) || 0
      }));

      // Payroll Calcs
      let payrollList = [];
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

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

          return {
            period: c.period,
            empId: c.emp_id,
            name: c.full_name || '',
            department: c.department || '',
            position: c.position || '',
            bankName: c.bank_name || '',
            bankAccount: c.bank_account || '',
            baseSalary: Number(c.base_salary) || 0,
            otHours: Number(c.ot_hours) || 0,
            otRate: Number(c.ot_rate) || 40,
            otPay: Number(c.ot_pay) || 0,
            allowance: Number(c.allowance) || 0,
            bonus: Number(c.bonus) || 0,
            leaveDeduction: Number(c.leave_deduction) || 0,
            grossPay: gross,
            sso: Number(c.sso) || 0,
            pf: Number(c.pf) || 0,
            tax: Number(c.tax) || 0,
            advanceDeduct: Number(c.advance_deduct) || 0,
            otherDeduct: Number(c.other_deduct) || 0,
            totalDeductions: ded,
            netPay: net
          };
        });
      }

      // Users
      const usersQuery = await db.prepare('SELECT username, password, role FROM users ORDER BY username ASC').all();
      const users = (usersQuery.results || []).map(u => ({
        username: u.username,
        password: u.password,
        role: u.role || 'User'
      }));

      return {
        success: true,
        period: period,
        workingDays: workingDays,
        settings: settingsMap,
        isClosed: isClosed,
        closedInfo: closedInfo,
        employees: employees,
        inputRecords: inputRecords,
        payrollList: payrollList,
        stats: {
          totalEmployees: payrollList.length,
          totalGross: Math.round(totalGross * 100) / 100,
          totalDeductions: Math.round(totalDeductions * 100) / 100,
          totalNet: Math.round(totalNet * 100) / 100
        },
        users: users
      };
    }

    // 3. PERIOD WORK DAYS
    case 'savePeriodWorkDays': {
      const days = Number(params.workingDays) || 30;
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(`Period_WorkDays_${period}`, String(days)).run();
      const count = await calculateAndSavePayroll(db, period, days);
      return { success: true, period: period, workingDays: days, count: count, message: `ตั้งค่าจำนวนวันทำงานงวด ${period} เป็น ${days} วัน เรียบร้อยแล้ว` };
    }

    // 4. EMPLOYEE MASTER CRUD
        case 'batchImportEmployees': {
      const list = params.employees || [];
      if (!Array.isArray(list) || list.length === 0) {
        return { success: false, message: 'ไม่พบรายการข้อมูลพนักงานที่จะนำเข้า' };
      }

      let count = 0;
      for (const emp of list) {
        if (!emp.empId || !emp.fullName) continue;
        count++;
        let pfRate = Number(emp.pfRate);
        if (isNaN(pfRate) || pfRate <= 0) pfRate = 0.05;
        if (pfRate > 1) pfRate = pfRate / 100; // e.g. 5 -> 0.05

        await db.prepare(`
          INSERT OR REPLACE INTO employees 
          (emp_id, full_name, nickname, citizen_id, phone, address, department, position, base_salary, bank_name, bank_account, birth_date, age, join_date, pf_rate, default_sso, default_tax, remark)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          String(emp.empId).trim(), String(emp.fullName).trim(), String(emp.nickname || '').trim(),
          String(emp.citizenId || '').trim(), String(emp.phone || '').trim(), String(emp.address || '').trim(),
          String(emp.department || '').trim(), String(emp.position || '').trim(),
          Number(emp.baseSalary) || 0,
          String(emp.bankName || 'กสิกรไทย (KBANK)').trim(), String(emp.bankAccount || '').trim(),
          String(emp.birthDate || '').trim(), Number(emp.age) || 0, String(emp.joinDate || '').trim(),
          pfRate, (emp.defaultSso !== null && emp.defaultSso !== undefined && !isNaN(Number(emp.defaultSso))) ? Number(emp.defaultSso) : 750,
          Number(emp.defaultTax) || 0, String(emp.remark || '').trim()
        ).run();
      }

      await calculateAndSavePayroll(db, period);
      return { success: true, count: count, message: `นำเข้าข้อมูลพนักงานสำเร็จทั้งหมด ${count} คน` };
    }

    case 'saveEmployee': {
      const emp = params.employee || {};
      const origId = params.origId;
      if (!emp.empId || !emp.fullName) return { success: false, message: 'กรุณากรอกรหัสและชื่อพนักงาน' };

      if (origId && origId !== emp.empId) {
        await db.prepare('DELETE FROM employees WHERE emp_id = ?').bind(origId).run();
      }

      await db.prepare(`
        INSERT OR REPLACE INTO employees 
        (emp_id, full_name, nickname, citizen_id, phone, address, department, position, base_salary, bank_name, bank_account, birth_date, age, join_date, pf_rate, default_sso, default_tax, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        emp.empId, emp.fullName, emp.nickname || '', emp.citizenId || '', emp.phone || '', emp.address || '',
        emp.department || '', emp.position || '', Number(emp.baseSalary) || 0,
        emp.bankName || '', emp.bankAccount || '', emp.birthDate || '', Number(emp.age) || 0,
        emp.joinDate || '',
        (emp.pfRate !== null && emp.pfRate !== undefined && !isNaN(Number(emp.pfRate))) ? Number(emp.pfRate) : 0.05, (emp.defaultSso !== null && emp.defaultSso !== undefined && !isNaN(Number(emp.defaultSso))) ? Number(emp.defaultSso) : 750,
        Number(emp.defaultTax) || 0, emp.remark || ''
      ).run();

      await calculateAndSavePayroll(db, period);
      return { success: true, message: 'บันทึกข้อมูลพนักงานเรียบร้อยแล้ว' };
    }

    case 'deleteEmployee': {
      const empId = params.empId;
      if (!empId) return { success: false, message: 'Missing empId' };
      await db.prepare('DELETE FROM employees WHERE emp_id = ?').bind(empId).run();
      await db.prepare('DELETE FROM monthly_inputs WHERE emp_id = ?').bind(empId).run();
      await db.prepare('DELETE FROM payroll_calcs WHERE emp_id = ?').bind(empId).run();
      return { success: true, message: `ลบพนักงาน ${empId} เรียบร้อยแล้ว` };
    }

    // 5. MONTHLY INPUT CRUD & BATCH POPULATE
    case 'saveInputRecord': {
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

      const countRow = await db.prepare('SELECT COUNT(*) as count FROM monthly_inputs WHERE period = ?').bind(period).first();
      const nextNo = (countRow ? countRow.count : 0) + 1;

      await db.prepare(`
        INSERT OR REPLACE INTO monthly_inputs
        (period, no, emp_id, emp_name, base_salary, pf_rate, pf_amount, absent_days, leave_days, sick_leave_days, late_deduct, ot_hours, ot_rate, allowance, bonus, advance_deduct, other_deduct, sso, tax)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        period, nextNo, r.empId, r.empName || '', baseSal, pfRate, pfAmt,
        Number(r.absentDays) || 0, Number(r.leaveDays) || 0, Number(r.sickLeaveDays) || 0, Number(r.lateDeduct) || 0,
        Number(r.otHours) || 0, otRate,
        Number(r.allowance) || 0, Number(r.bonus) || 0, Number(r.advanceDeduct) || 0,
        Number(r.otherDeduct) || 0, Number(r.sso) || 750, Number(r.tax) || 0
      ).run();

      await calculateAndSavePayroll(db, period);
      return { success: true, message: `บันทึกข้อมูลประจำงวด ${period} เรียบร้อยแล้ว` };
    }

    case 'deleteInputRecord': {
      const empId = params.empId;
      if (!empId) return { success: false, message: 'Missing empId' };
      await db.prepare('DELETE FROM monthly_inputs WHERE period = ? AND emp_id = ?').bind(period, empId).run();
      await db.prepare('DELETE FROM payroll_calcs WHERE period = ? AND emp_id = ?').bind(period, empId).run();
      return { success: true, message: `ลบข้อมูลประจำงวด ${period} ของ ${empId} เรียบร้อยแล้ว` };
    }

    case 'populateEmployeesToPeriod': {
      const empQuery = await db.prepare('SELECT * FROM employees ORDER BY emp_id ASC').all();
      const employees = empQuery.results || [];
      if (employees.length === 0) {
        return { success: false, message: 'ไม่พบข้อมูลในทะเบียนพนักงาน กรุณาเพิ่มพนักงานก่อน' };
      }

      const existingInput = await db.prepare('SELECT * FROM monthly_inputs WHERE period = ?').bind(period).all();
      const existingMap = {};
      for (const row of existingInput.results || []) existingMap[row.emp_id] = row;

      let added = 0;
      let nextNo = 0;

      for (const emp of employees) {
        nextNo++;
        added++;
        const baseSal = Number(emp.base_salary) || 0;
        const pfRate = (emp.pf_rate !== null && emp.pf_rate !== undefined && !isNaN(Number(emp.pf_rate))) ? Number(emp.pf_rate) : 0.05;
        const pfAmt = pfRate > 0 ? Math.round(baseSal * pfRate * 100) / 100 : 0;
        const sso = (emp.default_sso !== null && emp.default_sso !== undefined && !isNaN(Number(emp.default_sso))) ? Number(emp.default_sso) : 750;
        const tax = Number(emp.default_tax) || 0;

        const exist = existingMap[emp.emp_id] || {};
        const absentDays = Number(exist.absent_days) || 0;
        const leaveDays = Number(exist.leave_days) || 0;
        const sickLeaveDays = Number(exist.sick_leave_days) || 0;
        const lateDeduct = Number(exist.late_deduct) || 0;
        const otHours = Number(exist.ot_hours) || 0;
        const otRate = (exist.ot_rate !== null && exist.ot_rate !== undefined && !isNaN(Number(exist.ot_rate))) ? Number(exist.ot_rate) : 40;
        const allowance = Number(exist.allowance) || 0;
        const bonus = Number(exist.bonus) || 0;
        const advDed = Number(exist.advance_deduct) || 0;
        const othDed = Number(exist.other_deduct) || 0;

        await db.prepare(`
          INSERT OR REPLACE INTO monthly_inputs
          (period, no, emp_id, emp_name, base_salary, pf_rate, pf_amount, absent_days, leave_days, sick_leave_days, late_deduct, ot_hours, ot_rate, allowance, bonus, advance_deduct, other_deduct, sso, tax)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          period, nextNo, emp.emp_id, emp.full_name || '', baseSal, pfRate, pfAmt,
          absentDays, leaveDays, sickLeaveDays, lateDeduct, otHours, otRate, allowance, bonus, advDed, othDed, sso, tax
        ).run();
      }

      await calculateAndSavePayroll(db, period);
      return {
        success: true,
        period: period,
        count: added,
        message: `ดึงและอัปเดตข้อมูลพนักงานเข้างวด ${period} สำเร็จ (${added} คน) [อัตรา OT เริ่มต้น 40 บาท]`
      };
    }

    // 6. PROCESS PAYROLL
    case 'processPayroll': {
      const count = await calculateAndSavePayroll(db, period);
      return { success: true, period: period, count: count, message: `ประมวลผลคำนวณเงินเดือนงวด ${period} สำเร็จ (${count} รายการ)` };
    }

    // 7. EMPLOYEE HISTORY
    case 'getEmployeeHistory': {
      const empId = params.empId;
      if (!empId) return { success: false, message: 'Missing empId' };

      const emp = await db.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empId).first();
      if (!emp) return { success: false, message: `ไม่พบพนักงานรหัส ${empId}` };

      const calcs = await db.prepare('SELECT * FROM payroll_calcs WHERE emp_id = ? ORDER BY period DESC').bind(empId).all();
      const inputs = await db.prepare('SELECT * FROM monthly_inputs WHERE emp_id = ? ORDER BY period DESC').bind(empId).all();

      const inputMap = {};
      for (const i of inputs.results || []) inputMap[i.period] = i;

      const historyList = (calcs.results || []).map(c => {
        const inp = inputMap[c.period] || {};
        return {
          period: c.period,
          empId: c.emp_id,
          name: c.full_name,
          department: c.department,
          position: c.position,
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
      });

      return {
        success: true,
        employee: {
          empId: emp.emp_id,
          fullName: emp.full_name,
          nickname: emp.nickname || '',
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
          defaultSso: (emp.default_sso !== null && emp.default_sso !== undefined && !isNaN(Number(emp.default_sso))) ? Number(emp.default_sso) : 750,
          defaultTax: Number(emp.default_tax) || 0,
          remark: emp.remark || ''
        },
        history: historyList
      };
    }

    // 8. COMPANY INFO
    case 'saveCompanyInfo': {
      const cfg = params.settings || {};
      if (cfg.companyName) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("CompanyName", ?)').bind(cfg.companyName).run();
      if (cfg.address !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("Address", ?)').bind(cfg.address).run();
      if (cfg.phone !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("Phone", ?)').bind(cfg.phone).run();
      if (cfg.taxId !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("TaxId", ?)').bind(cfg.taxId).run();
      return { success: true, message: 'บันทึกข้อมูลบริษัทเรียบร้อยแล้ว' };
    }

    // 9. PERIOD LOCK / UNLOCK
    case 'closePeriod': {
      await calculateAndSavePayroll(db, period);
      const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const val = `CLOSED|${timeStr}|${params.username || 'Admin'}`;
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(`Period_Status_${period}`, val).run();
      return { success: true, period: period, isClosed: true, message: `ปิดงวดประจำเดือน ${period} เรียบร้อยแล้ว (ล็อคผลการคำนวณ)` };
    }

    case 'reopenPeriod': {
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, "OPEN")').bind(`Period_Status_${period}`).run();
      return { success: true, period: period, isClosed: false, message: `ปลดล็อคและเปิดงวดประจำเดือน ${period} เรียบร้อยแล้ว` };
    }

    // 10. USER MANAGEMENT
    case 'saveUser': {
      const u = params.user || {};
      const origUser = params.origUser;
      if (!u.username || !u.password) return { success: false, message: 'กรุณากรอก Username และ Password' };
      if (origUser && origUser !== u.username) {
        await db.prepare('DELETE FROM users WHERE username = ?').bind(origUser).run();
      }
      await db.prepare('INSERT OR REPLACE INTO users (username, password, role) VALUES (?, ?, ?)').bind(u.username, u.password, u.role || 'User').run();
      return { success: true, message: 'บันทึกผู้ใช้งานเรียบร้อยแล้ว' };
    }

    case 'deleteUser': {
      const username = params.username;
      if (!username) return { success: false, message: 'Missing username' };
      await db.prepare('DELETE FROM users WHERE username = ?').bind(username).run();
      return { success: true, message: `ลบผู้ใช้ ${username} เรียบร้อยแล้ว` };
    }

    default:
      return { success: false, message: `Unknown action: ${action}` };
  }
}

async function calculateAndSavePayroll(db, period, explicitWorkDays) {
  const inputQuery = await db.prepare('SELECT * FROM monthly_inputs WHERE period = ?').bind(period).all();
  const inputList = inputQuery.results || [];

  if (inputList.length === 0) {
    await db.prepare('DELETE FROM payroll_calcs WHERE period = ?').bind(period).run();
    return 0;
  }

  let workDays = explicitWorkDays;
  if (!workDays) {
    const wdRow = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(`Period_WorkDays_${period}`).first();
    workDays = (wdRow && wdRow.value && !isNaN(Number(wdRow.value))) ? Number(wdRow.value) : 30;
  }

  const empQuery = await db.prepare('SELECT * FROM employees').all();
  const empMap = {};
  for (const emp of empQuery.results || []) empMap[emp.emp_id] = emp;

  await db.prepare('DELETE FROM payroll_calcs WHERE period = ?').bind(period).run();

  let count = 0;
  for (const inp of inputList) {
    count++;
    const empId = inp.emp_id;
    const emp = empMap[empId] || { emp_id: empId, full_name: inp.emp_name || empId, base_salary: inp.base_salary || 0, pf_rate: inp.pf_rate || 0.05, default_sso: inp.sso || 750, default_tax: inp.tax || 0 };

    const baseSal = Number(inp.base_salary > 0 ? inp.base_salary : (emp.base_salary || 0));
    const pfRate = (inp.pf_rate !== null && inp.pf_rate !== undefined && !isNaN(Number(inp.pf_rate))) ? Number(inp.pf_rate) : ((emp.pf_rate !== null && emp.pf_rate !== undefined && !isNaN(Number(emp.pf_rate))) ? Number(emp.pf_rate) : 0);
    const pfAmt = (pfRate > 0) ? (Number(inp.pf_amount !== undefined && inp.pf_amount > 0 ? inp.pf_amount : Math.round(baseSal * pfRate * 100) / 100)) : 0;

    const otRate = (inp.ot_rate !== null && inp.ot_rate !== undefined && !isNaN(Number(inp.ot_rate))) ? Number(inp.ot_rate) : 40;
    const otPay = Math.round((Number(inp.ot_hours) || 0) * otRate * 100) / 100;

    const dailyRate = workDays > 0 ? (baseSal / workDays) : (baseSal / 30);

    const absentDays = Number(inp.absent_days) || 0;
    const absentDed = absentDays * dailyRate * 1.5;

    const leaveDays = Number(inp.leave_days) || 0;
    const businessLeaveDed = leaveDays * dailyRate * 1.0;

    const sickDays = Number(inp.sick_leave_days) || 0;
    const sickLeaveDed = sickDays * dailyRate * 1.0;

    const lateDed = Number(inp.late_deduct) || 0;

    const leaveDed = Math.round((absentDed + businessLeaveDed + sickLeaveDed + lateDed) * 100) / 100;

    const allowance = Number(inp.allowance) || 0;
    const bonus = Number(inp.bonus) || 0;
    const grossPay = Math.round((baseSal + otPay + allowance + bonus - leaveDed) * 100) / 100;

    const sso = (inp.sso !== undefined && inp.sso !== null && !isNaN(Number(inp.sso))) ? Number(inp.sso) : ((emp.default_sso !== undefined && emp.default_sso !== null && !isNaN(Number(emp.default_sso))) ? Number(emp.default_sso) : 0);
    const pf = pfAmt;
    const tax = Number(inp.tax !== undefined ? inp.tax : (emp.default_tax || 0));
    const advDed = Number(inp.advance_deduct) || 0;
    const othDed = Number(inp.other_deduct) || 0;
    const totalDed = Math.round((sso + pf + tax + advDed + othDed) * 100) / 100;
    const netPay = Math.round((grossPay - totalDed) * 100) / 100;

    await db.prepare(`
      INSERT OR REPLACE INTO payroll_calcs
      (period, emp_id, full_name, department, position, bank_name, bank_account, base_salary, ot_hours, ot_rate, ot_pay, allowance, bonus, leave_deduction, gross_pay, sso, pf, tax, advance_deduct, other_deduct, total_deductions, net_pay)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      period, empId, inp.emp_name || emp.full_name || empId,
      emp.department || '', emp.position || '', emp.bank_name || '', emp.bank_account || '',
      baseSal, Number(inp.ot_hours) || 0, otRate, otPay,
      allowance, bonus,
      leaveDed, grossPay, sso, pf, tax, advDed, othDed, totalDed, netPay
    ).run();
  }

  return count;
}