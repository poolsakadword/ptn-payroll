/**
 * Incident & Damage Deductions Management Module
 * บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด
 */
import { logSystemActivity } from './db.js';
import { isUserSuperAdmin, userHasPermission } from './security.js';
import { getDefaultPeriod, getNextPeriodStr, normalizeDateToIso } from './date-utils.js';
import { calculateAndSavePayroll } from './payroll.js';
import { sendPushToEmployee } from './notifications.js';

export const incidentHandlers = {
  getIncidents: async (db, params) => {
    const callerUser = params.currentUsername || params.username || '';
    const statusFilter = params.status || 'ALL';
    const branchFilter = params.branchId || 'ALL';

    let sql = `
      SELECT i.*, b.branch_name
      FROM incident_deductions i
      LEFT JOIN branches b ON i.branch_id = b.branch_id
      WHERE 1=1
    `;
    const binds = [];
    if (statusFilter && statusFilter !== 'ALL') {
      sql += ' AND i.status = ?';
      binds.push(statusFilter);
    }
    if (branchFilter && branchFilter !== 'ALL') {
      sql += ' AND i.branch_id = ?';
      binds.push(branchFilter);
    }
    sql += ' ORDER BY i.id DESC';

    const incidentsRes = await db.prepare(sql).bind(...binds).all().catch(() => ({ results: [] }));
    const incidents = incidentsRes.results || [];

    // Fetch all schedules for these incidents
    const schedulesRes = await db.prepare(`
      SELECT s.*, e.full_name, e.nickname, e.department
      FROM incident_deduction_schedules s
      LEFT JOIN employees e ON s.emp_id = e.emp_id
      ORDER BY s.incident_id DESC, s.installment_no ASC
    `).all().catch(() => ({ results: [] }));

    const schedMap = {};
    for (const s of (schedulesRes.results || [])) {
      if (!schedMap[s.incident_id]) schedMap[s.incident_id] = [];
      schedMap[s.incident_id].push(s);
    }

    const items = incidents.map(inc => {
      const incScheds = schedMap[inc.id] || [];
      const empSet = new Set(incScheds.map(s => s.emp_id));
      const empNames = Array.from(empSet).map(empId => {
        const item = incScheds.find(s => s.emp_id === empId);
        return item ? `[${empId}] ${item.full_name}${item.nickname ? ' (' + item.nickname + ')' : ''}` : empId;
      });

      return {
        ...inc,
        schedules: incScheds,
        involvedEmpCount: empSet.size || inc.split_count || 1,
        involvedEmployeesList: empNames,
        involvedEmployeesText: empNames.join(', ')
      };
    });

    return {
      success: true,
      incidents: items
    };
  },

  saveIncident: async (db, params) => {
    const callerUser = params.currentUsername || params.username || 'Admin';
    const isSuper = (await isUserSuperAdmin(db, callerUser));
    const canManage = (await userHasPermission(db, callerUser, 'manage_payroll'));
    const isSupervisor = (await userHasPermission(db, callerUser, 'manage_attendance')) || (await userHasPermission(db, callerUser, 'view_attendance'));
    if (!isSuper && !canManage && !isSupervisor && callerUser !== 'admin') {
      return { success: false, message: 'สิทธิ์ไม่เพียงพอในการบันทึกเหตุการณ์ความเสียหาย' };
    }

    const incId = params.id ? Number(params.id) : null;
    const incidentDate = normalizeDateToIso(params.incidentDate) || new Date().toISOString().substring(0, 10);
    const branchId = params.branchId || 'B01';
    const category = params.category || 'OTHER';
    const title = String(params.title || '').trim();
    const description = String(params.description || '').trim();
    const evidencePhotoUrl = params.evidencePhotoUrl || '';
    const totalAmount = Math.max(0, Number(params.totalIncidentAmount !== undefined ? params.totalIncidentAmount : (params.amount || 0)));
    const companyAbsorbed = Math.max(0, Number(params.companyAbsorbedAmount || 0));
    const netEmployeeAmount = Math.max(0, totalAmount - companyAbsorbed);

    let involvedEmpIds = Array.isArray(params.involvedEmpIds) ? params.involvedEmpIds.filter(Boolean) : [];
    if (involvedEmpIds.length === 0 && params.empId) {
      involvedEmpIds = [String(params.empId).trim()];
    }
    if (involvedEmpIds.length === 0) {
      return { success: false, message: 'กรุณาระบุพนักงานผู้รับผิดชอบอย่างน้อย 1 ท่าน' };
    }
    if (totalAmount <= 0) {
      return { success: false, message: 'กรุณาระบุจำนวนเงินความเสียหาย' };
    }
    if (!title) {
      return { success: false, message: 'กรุณาระบุหัวข้อหรือสาเหตุของเหตุการณ์' };
    }

    const splitCount = involvedEmpIds.length;
    const splitAmount = Math.round((netEmployeeAmount / splitCount) * 100) / 100;
    const installments = Math.max(1, parseInt(params.installments || 1, 10));
    let startPeriod = params.startPeriod || getDefaultPeriod();

    const isAutoApprove = (isSuper || canManage) && (params.autoApprove === true || params.status === 'APPROVED');
    const status = isAutoApprove ? 'APPROVED' : (params.status || 'PENDING');

    let savedIncidentId = incId;
    if (incId) {
      await db.prepare(`
        UPDATE incident_deductions
        SET incident_date = ?, branch_id = ?, category = ?, title = ?, description = ?,
            evidence_photo_url = COALESCE(?, evidence_photo_url), total_incident_amount = ?,
            company_absorbed_amount = ?, net_employee_amount = ?, split_count = ?,
            status = ?
        WHERE id = ?
      `).bind(
        incidentDate, branchId, category, title, description,
        evidencePhotoUrl || null, totalAmount, companyAbsorbed, netEmployeeAmount, splitCount,
        status, incId
      ).run();
    } else {
      const ym = incidentDate.replace(/-/g, '').substring(0, 6);
      const countRow = await db.prepare('SELECT COUNT(*) as c FROM incident_deductions WHERE incident_date LIKE ?').bind(incidentDate.substring(0, 7) + '%').first().catch(() => ({ c: 0 }));
      const nextNum = (countRow?.c || 0) + 1;
      const code = `INC-${ym}-${String(nextNum).padStart(3, '0')}`;

      const insertRes = await db.prepare(`
        INSERT INTO incident_deductions
        (incident_code, incident_date, branch_id, category, title, description, evidence_photo_url, total_incident_amount, company_absorbed_amount, net_employee_amount, split_count, status, reporter_username, approver_username, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        code, incidentDate, branchId, category, title, description, evidencePhotoUrl || '',
        totalAmount, companyAbsorbed, netEmployeeAmount, splitCount, status, callerUser,
        isAutoApprove ? callerUser : null, isAutoApprove ? new Date().toISOString() : null
      ).run();
      savedIncidentId = insertRes.meta?.last_row_id || insertRes.lastRowId;
    }

    if (savedIncidentId) {
      await db.prepare('DELETE FROM incident_deduction_schedules WHERE incident_id = ?').bind(savedIncidentId).run();

      const schedStatus = isAutoApprove ? 'SCHEDULED' : 'PENDING';
      let curPeriod = startPeriod;
      const periodList = [curPeriod];
      for (let i = 1; i < installments; i++) {
        curPeriod = getNextPeriodStr(curPeriod);
        periodList.push(curPeriod);
      }

      for (const empId of involvedEmpIds) {
        let remaining = splitAmount;
        for (let instNo = 1; instNo <= installments; instNo++) {
          const targetP = periodList[instNo - 1];
          let instAmt = 0;
          if (instNo === installments) {
            instAmt = Math.round(remaining * 100) / 100;
          } else {
            instAmt = Math.floor((splitAmount / installments) * 100) / 100;
            remaining -= instAmt;
          }

          await db.prepare(`
            INSERT INTO incident_deduction_schedules
            (incident_id, emp_id, target_period, installment_no, total_installments, amount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(savedIncidentId, empId, targetP, instNo, installments, instAmt, schedStatus).run();
        }
      }
    }

    if (isAutoApprove) {
      await calculateAndSavePayroll(db, startPeriod).catch(() => {});
      for (const empId of involvedEmpIds) {
        sendPushToEmployee(db, empId, {
          title: 'แจ้งเตือนรายการหักเงินค่าเสียหาย',
          body: `รายการ: ${title} ยอดชดใช้ ${splitAmount.toLocaleString()} บาท (${installments} งวด)`,
          url: '/#payslip'
        }).catch(() => {});
      }
    }

    await logSystemActivity(db, callerUser, 'INCIDENT_SAVE', `บันทึกรายการความเสียหาย: ${title} (${totalAmount} บาท)`);

    return {
      success: true,
      incidentId: savedIncidentId,
      message: isAutoApprove ? 'บันทึกและอนุมัติรายการหักเงินเรียบร้อยแล้ว' : 'บันทึกเหตุการณ์ความเสียหายเรียบร้อยแล้ว (รอ HR อนุมัติ)'
    };
  },

  approveIncident: async (db, params) => {
    const callerUser = params.currentUsername || params.username || 'Admin';
    const isSuper = (await isUserSuperAdmin(db, callerUser));
    const canManage = (await userHasPermission(db, callerUser, 'manage_payroll'));
    if (!isSuper && !canManage && callerUser !== 'admin') {
      return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์อนุมัติการหักเงิน' };
    }

    const incId = Number(params.id);
    if (!incId) return { success: false, message: 'ไม่พบรหัสรายการ' };

    const inc = await db.prepare('SELECT * FROM incident_deductions WHERE id = ?').bind(incId).first();
    if (!inc) return { success: false, message: 'ไม่พบรายการความเสียหายนี้ในระบบ' };

    const totalAmount = Number(params.totalIncidentAmount !== undefined ? params.totalIncidentAmount : inc.total_incident_amount);
    const companyAbsorbed = Math.max(0, Number(params.companyAbsorbedAmount !== undefined ? params.companyAbsorbedAmount : inc.company_absorbed_amount));
    const netEmployeeAmount = Math.max(0, totalAmount - companyAbsorbed);
    const installments = Math.max(1, parseInt(params.installments || 1, 10));
    const startPeriod = params.startPeriod || getDefaultPeriod();

    let involvedEmpIds = Array.isArray(params.involvedEmpIds) ? params.involvedEmpIds.filter(Boolean) : [];
    if (involvedEmpIds.length === 0) {
      const curScheds = await db.prepare('SELECT DISTINCT emp_id FROM incident_deduction_schedules WHERE incident_id = ?').bind(incId).all();
      involvedEmpIds = (curScheds.results || []).map(r => r.emp_id);
    }
    if (involvedEmpIds.length === 0) {
      return { success: false, message: 'ไม่พบรายชื่อพนักงานที่เกี่ยวข้อง' };
    }

    const splitCount = involvedEmpIds.length;
    const splitAmount = Math.round((netEmployeeAmount / splitCount) * 100) / 100;

    await db.prepare(`
      UPDATE incident_deductions
      SET total_incident_amount = ?, company_absorbed_amount = ?, net_employee_amount = ?,
          split_count = ?, status = 'APPROVED', approver_username = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(totalAmount, companyAbsorbed, netEmployeeAmount, splitCount, callerUser, incId).run();

    await db.prepare('DELETE FROM incident_deduction_schedules WHERE incident_id = ?').bind(incId).run();

    let curPeriod = startPeriod;
    const periodList = [curPeriod];
    for (let i = 1; i < installments; i++) {
      curPeriod = getNextPeriodStr(curPeriod);
      periodList.push(curPeriod);
    }

    for (const empId of involvedEmpIds) {
      let remaining = splitAmount;
      for (let instNo = 1; instNo <= installments; instNo++) {
        const targetP = periodList[instNo - 1];
        let instAmt = 0;
        if (instNo === installments) {
          instAmt = Math.round(remaining * 100) / 100;
        } else {
          instAmt = Math.floor((splitAmount / installments) * 100) / 100;
          remaining -= instAmt;
        }

        await db.prepare(`
          INSERT INTO incident_deduction_schedules
          (incident_id, emp_id, target_period, installment_no, total_installments, amount, status)
          VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED')
        `).bind(incId, empId, targetP, instNo, installments, instAmt).run();
      }
    }

    await calculateAndSavePayroll(db, startPeriod).catch(() => {});

    for (const empId of involvedEmpIds) {
      sendPushToEmployee(db, empId, {
        title: 'อนุมัติการหักเงินค่าชดใช้ความเสียหาย',
        body: `รายการ: ${inc.title} ยอดหัก ${splitAmount.toLocaleString()} บาท (ผ่อน ${installments} งวด เริ่มงวด ${startPeriod})`,
        url: '/#payslip'
      }).catch(() => {});
    }

    await logSystemActivity(db, callerUser, 'INCIDENT_APPROVE', `อนุมัติรายการหักเงิน [${inc.incident_code || incId}]: ${inc.title} ยอดสุทธิ ${netEmployeeAmount} บาท`);

    return {
      success: true,
      message: `อนุมัติรายการหักเงินเรียบร้อยแล้ว (เริ่มหักงวด ${startPeriod})`
    };
  },

  rejectIncident: async (db, params) => {
    const callerUser = params.currentUsername || params.username || 'Admin';
    const isSuper = (await isUserSuperAdmin(db, callerUser));
    const canManage = (await userHasPermission(db, callerUser, 'manage_payroll'));
    if (!isSuper && !canManage && callerUser !== 'admin') {
      return { success: false, message: 'สิทธิ์ไม่เพียงพอ' };
    }

    const incId = Number(params.id);
    await db.prepare("UPDATE incident_deductions SET status = 'REJECTED', approver_username = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?").bind(callerUser, incId).run();
    await db.prepare("UPDATE incident_deduction_schedules SET status = 'CANCELLED' WHERE incident_id = ?").bind(incId).run();
    await logSystemActivity(db, callerUser, 'INCIDENT_REJECT', `ปฏิเสธรายการหักเงิน ID: ${incId}`);

    return { success: true, message: 'ปฏิเสธรายการเรียบร้อยแล้ว' };
  },

  deleteIncident: async (db, params) => {
    const callerUser = params.currentUsername || params.username || 'Admin';
    const isSuper = (await isUserSuperAdmin(db, callerUser));
    const canManage = (await userHasPermission(db, callerUser, 'manage_payroll'));
    if (!isSuper && !canManage && callerUser !== 'admin') {
      return { success: false, message: 'สิทธิ์ไม่เพียงพอ' };
    }

    const incId = Number(params.id);
    await db.prepare('DELETE FROM incident_deductions WHERE id = ?').bind(incId).run();
    await db.prepare('DELETE FROM incident_deduction_schedules WHERE incident_id = ?').bind(incId).run();
    await logSystemActivity(db, callerUser, 'INCIDENT_DELETE', `ลบรายการหักเงิน ID: ${incId}`);

    return { success: true, message: 'ลบรายการความเสียหายเรียบร้อยแล้ว' };
  },

  getEmployeeIncidentBreakdown: async (db, params) => {
    const empId = params.empId ? String(params.empId).trim() : '';
    const period = params.period ? String(params.period).trim() : getDefaultPeriod();
    if (!empId) return { success: false, message: 'ระบุ empId' };

    const rows = await db.prepare(`
      SELECT s.*, i.incident_code, i.incident_date, i.branch_id, i.category, i.title, i.description, i.evidence_photo_url, b.branch_name
      FROM incident_deduction_schedules s
      JOIN incident_deductions i ON s.incident_id = i.id
      LEFT JOIN branches b ON i.branch_id = b.branch_id
      WHERE s.emp_id = ? AND s.target_period = ? AND s.status = 'SCHEDULED'
      ORDER BY i.incident_date ASC
    `).bind(empId, period).all().catch(() => ({ results: [] }));

    const items = rows.results || [];
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    return {
      success: true,
      empId,
      period,
      totalAmount,
      items
    };
  }
};
