/**
 * Employee Management Module
 */
import { logSystemActivity } from './db.js';
import { isUserSuperAdmin, userHasPermission } from './security.js';
import { normalizeDateToIso, isPeriodLocked } from './date-utils.js';
import { calculateAndSavePayroll } from './payroll.js';

export const employeeHandlers = {
  batchImportEmployees: async (db, params) => {
    let period = params.period;
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'edit_emp')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์นำเข้าข้อมูลพนักงาน' };

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
          normalizeDateToIso(emp.birthDate || ''), Number(emp.age) || 0, normalizeDateToIso(emp.joinDate || ''),
          pfRate, (emp.defaultSso !== null && emp.defaultSso !== undefined && !isNaN(Number(emp.defaultSso))) ? Number(emp.defaultSso) : 750,
          Number(emp.defaultTax) || 0, String(emp.remark || '').trim()
        ).run();
      }

      await calculateAndSavePayroll(db, period);
      return { success: true, count: count, message: `นำเข้าข้อมูลพนักงานสำเร็จทั้งหมด ${count} คน` };
  },

  saveEmployee: async (db, params) => {
    let period = params.period;
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'edit_emp')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เพิ่มหรือแก้ไขข้อมูลพนักงาน' };

      const emp = params.employee || {};
      const origId = params.origId;
      if (!emp.empId || !emp.fullName) return { success: false, message: 'กรุณากรอกรหัสและชื่อพนักงาน' };

      if (origId && origId !== emp.empId) {
        await db.prepare('DELETE FROM employees WHERE emp_id = ?').bind(origId).run();
      }

      const pfRateVal = (emp.pfRate !== null && emp.pfRate !== undefined && !isNaN(Number(emp.pfRate))) ? Number(emp.pfRate) : 0.05;
      const baseSalaryVal = Number(emp.baseSalary) || 0;
      const pfAmtVal = pfRateVal > 0 ? Math.round(baseSalaryVal * pfRateVal * 100) / 100 : 0;
      const ssoVal = (emp.defaultSso !== null && emp.defaultSso !== undefined && !isNaN(Number(emp.defaultSso))) ? Number(emp.defaultSso) : 750;
      const taxVal = Number(emp.defaultTax) || 0;

      const cleanBirthDate = normalizeDateToIso(emp.birthDate || '');
      const cleanJoinDate = normalizeDateToIso(emp.joinDate || '');
      let probEndDate = normalizeDateToIso(emp.probationEndDate || '');
      const probDays = Number(emp.probationDays) || 119;
      if (emp.status === 'Probation' && cleanJoinDate && !probEndDate) {
        try {
          const jd = new Date(cleanJoinDate);
          jd.setDate(jd.getDate() + probDays);
          probEndDate = jd.toISOString().substring(0, 10);
        } catch(err) {}
      }
      const statusVal = emp.status || 'Active';

      let photoUrlVal = emp.photoUrl;
      if (photoUrlVal === undefined && (origId || emp.empId)) {
        const existingEmp = await db.prepare('SELECT photo_url FROM employees WHERE emp_id = ?').bind(origId || emp.empId).first();
        photoUrlVal = existingEmp?.photo_url || '';
      } else {
        photoUrlVal = photoUrlVal || '';
      }

      const branchIdVal = String(emp.branchId || emp.branch_id || 'B01').trim();
      const allowAllVal = (emp.allowAllBranches === 'true' || emp.allowAllBranches === true) ? 'true' : 'false';
      const isOtEligibleVal = (emp.isOtEligible === false || emp.isOtEligible === 'false') ? 'false' : 'true';
      const isUndertimeExemptVal = (emp.isUndertimeExempt === true || emp.isUndertimeExempt === 'true' || emp.isUndertimeExempt === 1 || emp.isUndertimeExempt === '1') ? 'true' : 'false';
      const isAttendanceExemptVal = (emp.isAttendanceExempt === true || emp.isAttendanceExempt === 'true' || emp.isAttendanceExempt === 1 || emp.isAttendanceExempt === '1') ? 'true' : 'false';
      const isBreakExemptVal = (emp.isBreakExempt === true || emp.isBreakExempt === 'true' || emp.isBreakExempt === 1 || emp.isBreakExempt === '1') ? 'true' : 'false';
      const diligenceAllowanceVal = (emp.diligenceAllowance !== undefined && emp.diligenceAllowance !== null && emp.diligenceAllowance !== '' && !isNaN(Number(emp.diligenceAllowance)))
        ? Number(emp.diligenceAllowance)
        : null;
      const cleanResignDate = emp.resignDate ? normalizeDateToIso(emp.resignDate) : null;

      await db.prepare(`
        INSERT OR REPLACE INTO employees 
        (emp_id, full_name, nickname, citizen_id, phone, address, department, position, base_salary, bank_name, bank_account, birth_date, age, join_date, pf_rate, default_sso, default_tax, remark, status, probation_days, probation_end_date, photo_url, branch_id, allow_all_branches, is_ot_eligible, is_undertime_exempt, diligence_allowance, is_attendance_exempt, resign_date, is_break_exempt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        emp.empId, emp.fullName, emp.nickname || '', emp.citizenId || '', emp.phone || '', emp.address || '',
        emp.department || '', emp.position || '', baseSalaryVal,
        emp.bankName || '', emp.bankAccount || '', cleanBirthDate, Number(emp.age) || 0,
        cleanJoinDate,
        pfRateVal, ssoVal,
        taxVal, emp.remark || '',
        statusVal, probDays, probEndDate,
        photoUrlVal,
        branchIdVal, allowAllVal,
        isOtEligibleVal,
        isUndertimeExemptVal,
        diligenceAllowanceVal,
        isAttendanceExemptVal,
        cleanResignDate,
        isBreakExemptVal
      ).run();

      // Immediately sync changes to current period monthly_inputs if employee exists in current period and period is not locked
      const targetEmpId = origId || emp.empId;
      const isCurPeriodLocked = await isPeriodLocked(db, period);
      if (!isCurPeriodLocked) {
        await db.prepare(`
          UPDATE monthly_inputs 
          SET emp_id = ?, emp_name = ?, base_salary = ?, pf_rate = ?, pf_amount = ?, sso = ?, tax = ?
          WHERE emp_id = ? AND period = ?
        `).bind(
          emp.empId, emp.fullName, baseSalaryVal, pfRateVal, pfAmtVal, ssoVal, taxVal,
          targetEmpId, period
        ).run();
        if (isAttendanceExemptVal === 'true') {
          await db.prepare(`
            UPDATE monthly_inputs 
            SET absent_days = 0, leave_days = 0, sick_leave_days = 0, unpaid_sick_leave_days = 0,
                late_deduct = 0, late_minutes = 0, late_count = 0, ot_hours = 0
            WHERE emp_id = ? AND period = ?
          `).bind(targetEmpId, period).run().catch(() => {});
          await calculateAndSavePayroll(db, period);
        }

        await calculateAndSavePayroll(db, period);
      }
      return { success: true, message: 'บันทึกข้อมูลพนักงานเรียบร้อยแล้ว' };
  },

  deleteEmployee: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'del_emp')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ลบข้อมูลพนักงาน' };

      const empId = params.empId;
      if (!empId) return { success: false, message: 'Missing empId' };
      const emp = await db.prepare('SELECT full_name FROM employees WHERE emp_id = ?').bind(empId).first();
      const empName = emp ? emp.full_name : empId;

      await db.prepare('DELETE FROM employees WHERE emp_id = ?').bind(empId).run();
      await db.prepare('DELETE FROM monthly_inputs WHERE emp_id = ?').bind(empId).run();
      await db.prepare('DELETE FROM payroll_calcs WHERE emp_id = ?').bind(empId).run();

      await logSystemActivity(db, params.username || 'Admin', 'DELETE_EMPLOYEE', `ลบข้อมูลพนักงาน: ${empId} (${empName}) พร้อมรายการคำนวณเงินเดือน`);
      return { success: true, message: `ลบพนักงาน ${empName} (${empId}) ออกจากระบบเรียบร้อยแล้ว` };
  },

  resetEmployeeDevice: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'unlock_device')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ปลดล็อคเครื่องพนักงาน' };

      const empId = params.empId;
      if (!empId) return { success: false, message: 'Missing empId' };

      const emp = await db.prepare('SELECT full_name FROM employees WHERE emp_id = ?').bind(empId).first();
      const empName = emp ? emp.full_name : empId;

      await db.prepare('DELETE FROM employee_devices WHERE emp_id = ?').bind(empId).run();
      await logSystemActivity(db, params.username || 'Admin', 'RESET_DEVICE_LOCK', `ปลดล็อกอุปกรณ์ประจำตัว (Device Lock) ของพนักงาน: ${empId} (${empName}) จากระบบ PTN Payroll`);

      return {
        success: true,
        message: `ปลดล็อกอุปกรณ์ของพนักงาน [${empId}] ${empName} เรียบร้อยแล้ว พนักงานสามารถเลือกหรือผูกเครื่องใหม่ได้ทันที`
      };
  },

  passProbation: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'edit_emp')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์อนุมัติผ่านโปร' };

      const empId = params.empId;
      if (!empId) return { success: false, message: 'Missing empId' };

      const emp = await db.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empId).first();
      if (!emp) return { success: false, message: 'Employee not found' };

      await db.prepare('UPDATE employees SET status = "Active" WHERE emp_id = ?').bind(empId).run();
      await logSystemActivity(db, params.username || 'Admin', 'PASS_PROBATION', `อนุมัติผ่านการทดลองงาน: ${empId} (${emp.full_name}) ปรับเป็นสถานะ ทำงานอยู่ (Active)`);

      return {
        success: true,
        message: `อนุมัติผ่านการทดลองงานของ ${emp.full_name} (${empId}) เรียบร้อยแล้ว (ปรับเป็นสถานะพนักงานประจำ)`
      };
  },

  rehireEmployee: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'edit_emp')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์รับพนักงานกลับเข้าทำงาน' };

      const empId = params.empId;
      if (!empId) return { success: false, message: 'กรุณาระบุรหัสพนักงาน' };

      const emp = await db.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empId).first();
      if (!emp) return { success: false, message: 'ไม่พบข้อมูลพนักงาน' };

      const newJoinDate = normalizeDateToIso(params.joinDate || new Date().toISOString().substring(0, 10));
      const newStatus = params.status || 'Active';
      const probationDays = (newStatus === 'Probation') ? (Number(params.probationDays) || 90) : 0;
      let probationEndDate = '';
      if (newStatus === 'Probation' && newJoinDate) {
        const d = new Date(newJoinDate);
        d.setDate(d.getDate() + probationDays);
        probationEndDate = d.toISOString().substring(0, 10);
      }
      const newBaseSalary = (params.baseSalary !== undefined && params.baseSalary !== null && !isNaN(Number(params.baseSalary))) ? Number(params.baseSalary) : emp.base_salary;
      const newRemark = params.remark !== undefined ? String(params.remark).trim() : (emp.remark || '');

      await db.prepare(`
        UPDATE employees 
        SET status = ?, join_date = ?, resign_date = NULL, probation_days = ?, probation_end_date = ?, base_salary = ?, remark = ?
        WHERE emp_id = ?
      `).bind(newStatus, newJoinDate, probationDays, probationEndDate, newBaseSalary, newRemark, empId).run();

      await logSystemActivity(db, callerUser || 'Admin', 'REHIRE_EMPLOYEE', `รับพนักงานกลับเข้าทำงาน: ${empId} (${emp.full_name}) สถานะ: ${newStatus}, เริ่มงานรอบใหม่: ${newJoinDate}`);

      return {
        success: true,
        message: `รับพนักงาน [${empId}] ${emp.full_name} กลับเข้าทำงานเรียบร้อยแล้ว`
      };
  },

  get50TwiData: async (db, params) => {
    let period = params.period;
      const empId = params.empId;
      const year = params.year || (new Date().getFullYear() + 543).toString();
      if (!empId) return { success: false, message: 'Missing empId' };

      const emp = await db.prepare('SELECT * FROM employees WHERE emp_id = ?').bind(empId).first();
      if (!emp) return { success: false, message: 'Employee not found' };

      const compName = (await db.prepare('SELECT value FROM settings WHERE key = "CompanyName"').first())?.value || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
      const compAddr = (await db.prepare('SELECT value FROM settings WHERE key = "Address"').first())?.value || 'กรุงเทพมหานคร';
      const compTax = (await db.prepare('SELECT value FROM settings WHERE key = "TaxId"').first())?.value || '0105557000000';

      const calcs = (await db.prepare('SELECT * FROM payroll_calcs WHERE emp_id = ? ORDER BY period ASC').bind(empId).all()).results || [];
      const yearCalcs = year === 'ALL' ? calcs : calcs.filter(c => c.period && c.period.includes(year));

      const totalGross = yearCalcs.reduce((a, b) => a + Number(b.gross_pay || 0), 0);
      const totalTax = yearCalcs.reduce((a, b) => a + Number(b.tax || 0), 0);
      const totalSso = yearCalcs.reduce((a, b) => a + Number(b.sso || 0), 0);
      const totalPf = yearCalcs.reduce((a, b) => a + Number(b.pf || 0), 0);

      return {
        success: true,
        year: year,
        company: {
          name: compName,
          address: compAddr,
          taxId: compTax
        },
        employee: {
          empId: emp.emp_id,
          fullName: emp.full_name,
          citizenId: emp.citizen_id || '',
          address: emp.address || '',
          department: emp.department || '',
          position: emp.position || ''
        },
        totals: {
          periodsCount: yearCalcs.length,
          totalGross: totalGross,
          totalTax: totalTax,
          totalSso: totalSso,
          totalPf: totalPf
        }
      };
  }
};
