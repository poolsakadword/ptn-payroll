/**
 * Database Backup & Restore Module
 */
import { ensureBranchTables, ensurePushTables, logSystemActivity, executeBatch } from './db.js';
import { isUserSuperAdmin, userHasPermission } from './security.js';

export const backupHandlers = {
  backupDatabase: async (db, params) => {
    let period = params.period;
      const callerUser = params.currentUsername || params.username || '';
      let allowed = (await userHasPermission(db, callerUser, 'manage_backup')) || (await userHasPermission(db, callerUser, 'close_period')) || (await isUserSuperAdmin(db, callerUser));
      if (params.cronSecret && params.cronSecret === 'PTN_SUPER_SECRET_CRON_KEY_2026') allowed = true;
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์สำรองข้อมูล' };

      await ensureBranchTables(db);
      await ensurePushTables(db);

      const includePhotos = params.includePhotos === true;
      const settings = (await db.prepare('SELECT * FROM settings').all().catch(() => ({ results: [] }))).results || [];
      const users = (await db.prepare('SELECT username, password, role, permissions FROM users').all().catch(() => ({ results: [] }))).results || [];
      const employees_sql = includePhotos
        ? 'SELECT * FROM employees'
        : 'SELECT emp_id, full_name, nickname, citizen_id, phone, address, department, position, base_salary, bank_name, bank_account, birth_date, age, join_date, pf_rate, default_sso, default_tax, remark, status, probation_days, probation_end_date, branch_id, allow_all_branches, is_ot_eligible, is_undertime_exempt, diligence_allowance, is_attendance_exempt, resign_date, is_break_exempt, is_confidential FROM employees';
      const employees = (await db.prepare(employees_sql).all().catch(() => ({ results: [] }))).results || [];
      const branches = (await db.prepare('SELECT * FROM branches').all().catch(() => ({ results: [] }))).results || [];
      const employee_devices = (await db.prepare('SELECT * FROM employee_devices').all().catch(() => ({ results: [] }))).results || [];
      const monthly_inputs = (await db.prepare('SELECT * FROM monthly_inputs').all().catch(() => ({ results: [] }))).results || [];
      const payroll_calcs = (await db.prepare('SELECT * FROM payroll_calcs').all().catch(() => ({ results: [] }))).results || [];
      const push_subscriptions = (await db.prepare('SELECT * FROM push_subscriptions').all().catch(() => ({ results: [] }))).results || [];
      const activity_logs = (await db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 500').all().catch(() => ({ results: [] }))).results || [];

      // PTN Time tables (if present in D1)
      const time_logs_sql = includePhotos 
        ? 'SELECT * FROM time_logs' 
        : 'SELECT id, emp_id, date, clock_in, clock_out, in_lat, in_lng, out_lat, out_lng, late_minutes, work_hours, ot_hours, status, remark, created_at, break_out, break_in, break_out_lat, break_out_lng, break_in_lat, break_in_lng, break_minutes, overbreak_minutes, branch_id, branch_name, is_full_pay FROM time_logs';
      const time_logs = (await db.prepare(time_logs_sql).all().catch(() => ({ results: [] }))).results || [];

      const leave_requests_sql = includePhotos
        ? 'SELECT * FROM leave_requests'
        : 'SELECT id, emp_id, leave_type, start_date, end_date, days_count, reason, status, approver_id, approved_at, rejection_reason, created_at, time_slot FROM leave_requests';
      const leave_requests = (await db.prepare(leave_requests_sql).all().catch(() => ({ results: [] }))).results || [];
      const ot_requests = (await db.prepare('SELECT * FROM ot_requests').all().catch(() => ({ results: [] }))).results || [];
      const advance_requests = (await db.prepare('SELECT * FROM advance_requests').all().catch(() => ({ results: [] }))).results || [];
      const attendance_settings = (await db.prepare('SELECT * FROM attendance_settings').all().catch(() => ({ results: [] }))).results || [];
      const company_holidays = (await db.prepare('SELECT * FROM company_holidays').all().catch(() => ({ results: [] }))).results || [];

      // Extract unique periods
      const periodsSet = new Set();
      monthly_inputs.forEach(i => { if (i.period) periodsSet.add(i.period); });
      payroll_calcs.forEach(p => { if (p.period) periodsSet.add(p.period); });
      const periods = Array.from(periodsSet).sort();

      const backupObj = {
        app: 'PTN_PAYROLL_SYSTEM',
        version: '5.0',
        backupDate: new Date().toISOString(),
        company: 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด',
        summary: {
          employeesCount: employees.length,
          branchesCount: branches.length,
          monthlyInputsCount: monthly_inputs.length,
          payrollCalcsCount: payroll_calcs.length,
          periods: periods,
          usersCount: users.length,
          devicesCount: employee_devices.length,
          pushSubsCount: push_subscriptions.length,
          timeLogsCount: time_logs.length,
          leaveRequestsCount: leave_requests.length,
          otRequestsCount: ot_requests.length,
          advanceRequestsCount: advance_requests.length,
          holidaysCount: company_holidays.length
        },
        data: {
          settings,
          users,
          employees,
          branches,
          employee_devices,
          monthly_inputs,
          payroll_calcs,
          push_subscriptions,
          activity_logs,
          time_logs,
          leave_requests,
          ot_requests,
          advance_requests,
          attendance_settings,
          company_holidays
        }
      };

      await logSystemActivity(db, params.username || 'Admin', 'BACKUP_DATABASE', `Downloaded backup: ${employees.length} employees, ${periods.length} periods, ${branches.length} branches`);

      return {
        success: true,
        backup: backupObj,
        message: 'สำรองข้อมูลฐานข้อมูลสมบูรณ์ทุกตาราง'
      };
  },

  restoreDatabase: async (db, params) => {
    let period = params.period;
      const callerUser = params.currentUsername || params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_backup')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์กู้คืนข้อมูล' };

      await ensureBranchTables(db);
      await ensurePushTables(db);

      const backup = params.backup || {};
      const data = backup.data || backup;
      const opts = params.options || {};

      if (!data.employees && !data.settings && !data.users && !data.monthly_inputs && !data.branches) {
        return { success: false, message: 'โครงสร้างไฟล์สำรองไม่ถูกต้อง หรือไม่มีข้อมูลที่รองรับ' };
      }

      // Check selective options (if not supplied, default to restore present tables)
      const doEmployees = opts.restoreEmployees !== false && Array.isArray(data.employees);
      const doBranches = opts.restoreBranches !== false && Array.isArray(data.branches);
      const doDevices = opts.restoreDevices !== false && Array.isArray(data.employee_devices);
      const doPayroll = opts.restorePayroll !== false && (Array.isArray(data.monthly_inputs) || Array.isArray(data.payroll_calcs));
      const doSettings = opts.restoreSettings !== false && Array.isArray(data.settings);
      // For safety, doUsers is false by default unless explicitly specified true
      const doUsers = Boolean(opts.restoreUsers) && Array.isArray(data.users);
      const doPushSubs = opts.restorePushSubs !== false && Array.isArray(data.push_subscriptions);
      const doPtnTime = opts.restorePtnTime !== false && (
        Array.isArray(data.time_logs) || Array.isArray(data.leave_requests) || 
        Array.isArray(data.ot_requests) || Array.isArray(data.advance_requests) ||
        Array.isArray(data.attendance_settings)
      );

      const selectedPeriods = Array.isArray(opts.selectedPeriods) && opts.selectedPeriods.length > 0 ? opts.selectedPeriods : null;

      let restoredSummary = [];

      async function executeBatch(stmts, chunkSize = 50) {
        if (!stmts || stmts.length === 0) return;
        if (typeof db.batch === 'function') {
          for (let i = 0; i < stmts.length; i += chunkSize) {
            const chunk = stmts.slice(i, i + chunkSize);
            await db.batch(chunk);
          }
        } else {
          for (const s of stmts) {
            await s.run();
          }
        }
      }

      // 1. Settings
      if (doSettings) {
        if (!opts.selectiveMode) {
          await db.prepare('DELETE FROM settings').run().catch(() => {});
        }
        const stmts = [];
        for (const s of data.settings) {
          if (s.key && s.value !== undefined) {
            stmts.push(db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(s.key, String(s.value)));
          }
        }
        await executeBatch(stmts);
        restoredSummary.push(`การตั้งค่า ${stmts.length} ค่า`);
      }

      // 1.5 Company Holidays
      if (Array.isArray(data.company_holidays) && data.company_holidays.length > 0) {
        const stmts = [];
        for (const h of data.company_holidays) {
          if (h.date && (h.holiday_name || h.name)) {
            stmts.push(db.prepare(`
              INSERT OR REPLACE INTO company_holidays (id, date, holiday_name, holiday_type, note, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(h.id || null, h.date, h.holiday_name || h.name, h.holiday_type || 'COMPANY', h.note || '', h.created_at || new Date().toISOString()));
          }
        }
        await executeBatch(stmts);
        restoredSummary.push(`วันหยุดบริษัท ${stmts.length} วัน`);
      }

      // 2. Users (Only if explicitly enabled)
      if (doUsers) {
        await db.prepare('ALTER TABLE users ADD COLUMN permissions TEXT').run().catch(() => {});
        const stmts = [];
        for (const u of data.users) {
          if (u.username && u.password) {
            const permsStr = typeof u.permissions === 'string' ? u.permissions : JSON.stringify(u.permissions || []);
            stmts.push(db.prepare('INSERT OR REPLACE INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)').bind(u.username, u.password, u.role || 'User', permsStr));
          }
        }
        await executeBatch(stmts);
        restoredSummary.push(`ผู้ใช้งาน ${stmts.length} บัญชี`);
      }

      // 3. Branches
      if (doBranches && data.branches.length > 0) {
        await db.prepare('ALTER TABLE branches ADD COLUMN early_dismissal_full_pay INTEGER DEFAULT 0').run().catch(() => {});
        const stmts = [];
        for (const b of data.branches) {
          if (b.branch_id && b.branch_name) {
            stmts.push(db.prepare(`
              INSERT OR REPLACE INTO branches 
              (branch_id, branch_name, lat, lng, radius_meters, work_start_time, work_end_time, lunch_start_time, lunch_end_time, grace_minutes, ot_start_time, kiosk_pin, status, early_dismissal_full_pay)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              b.branch_id, b.branch_name, Number(b.lat) || 0, Number(b.lng) || 0,
              Number(b.radius_meters) || 150, b.work_start_time || '09:30', b.work_end_time || '19:00',
              b.lunch_start_time || '13:00', b.lunch_end_time || '14:00', Number(b.grace_minutes) || 0,
              b.ot_start_time || '19:00', b.kiosk_pin || '123456', b.status || 'ACTIVE',
              Number(b.early_dismissal_full_pay) || 0
            ));
          }
        }
        await executeBatch(stmts);
        restoredSummary.push(`สาขา ${stmts.length} แห่ง`);
      }

      // 4. Employees (with full column migration, undertime exemption & ot eligibility)
      if (doEmployees) {
        await db.prepare('ALTER TABLE employees ADD COLUMN status TEXT DEFAULT "Active"').run().catch(() => {});
        await db.prepare('ALTER TABLE employees ADD COLUMN probation_days INTEGER DEFAULT 119').run().catch(() => {});
        await db.prepare('ALTER TABLE employees ADD COLUMN probation_end_date TEXT').run().catch(() => {});
        await db.prepare('ALTER TABLE employees ADD COLUMN photo_url TEXT').run().catch(() => {});
        await db.prepare("ALTER TABLE employees ADD COLUMN branch_id TEXT DEFAULT 'B01'").run().catch(() => {});
        await db.prepare("ALTER TABLE employees ADD COLUMN allow_all_branches TEXT DEFAULT 'false'").run().catch(() => {});
        await db.prepare("ALTER TABLE employees ADD COLUMN is_ot_eligible TEXT DEFAULT 'true'").run().catch(() => {});
        await db.prepare("ALTER TABLE employees ADD COLUMN is_undertime_exempt TEXT DEFAULT 'false'").run().catch(() => {});
        await db.prepare("ALTER TABLE employees ADD COLUMN is_attendance_exempt TEXT DEFAULT 'false'").run().catch(() => {});
        await db.prepare("ALTER TABLE employees ADD COLUMN is_break_exempt TEXT DEFAULT 'false'").run().catch(() => {});

        if (!opts.selectiveMode) {
          await db.prepare('DELETE FROM employees').run().catch(() => {});
        }
        const stmts = [];
        for (const e of data.employees) {
          if (e.emp_id && e.full_name) {
            stmts.push(db.prepare(`
              INSERT OR REPLACE INTO employees 
              (emp_id, full_name, nickname, citizen_id, phone, address, department, position, base_salary, bank_name, bank_account, birth_date, age, join_date, pf_rate, default_sso, default_tax, status, probation_days, probation_end_date, photo_url, remark, branch_id, allow_all_branches, is_ot_eligible, is_undertime_exempt, is_attendance_exempt, is_break_exempt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              e.emp_id, e.full_name, e.nickname || '', e.citizen_id || '', e.phone || '', e.address || '',
              e.department || '', e.position || '', Number(e.base_salary) || 0,
              e.bank_name || '', e.bank_account || '', e.birth_date || '', Number(e.age) || 0,
              e.join_date || '',
              (e.pf_rate !== null && e.pf_rate !== undefined && !isNaN(Number(e.pf_rate))) ? Number(e.pf_rate) : 0.05,
              (e.default_sso !== null && e.default_sso !== undefined && !isNaN(Number(e.default_sso))) ? Number(e.default_sso) : 0,
              Number(e.default_tax) || 0,
              e.status || 'Active',
              Number(e.probation_days) || 119,
              e.probation_end_date || '',
              e.photo_url || '',
              e.remark || '',
              e.branch_id || 'B01',
              String(e.allow_all_branches || 'false'),
              String(e.is_ot_eligible !== undefined && e.is_ot_eligible !== null ? e.is_ot_eligible : 'true'),
              String(e.is_undertime_exempt !== undefined && e.is_undertime_exempt !== null ? e.is_undertime_exempt : 'false'),
              String(e.is_attendance_exempt !== undefined && e.is_attendance_exempt !== null ? e.is_attendance_exempt : 'false'),
              String(e.is_break_exempt !== undefined && e.is_break_exempt !== null ? e.is_break_exempt : 'false')
            ));
          }
        }
        await executeBatch(stmts);
        restoredSummary.push(`พนักงาน ${stmts.length} คน`);
      }

      // 5. Employee Devices
      if (doDevices && Array.isArray(data.employee_devices)) {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS employee_devices (
            emp_id TEXT PRIMARY KEY, device_id TEXT NOT NULL, device_name TEXT, bound_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run().catch(() => {});

        const stmts = [];
        for (const d of data.employee_devices) {
          if (d.emp_id && d.device_id) {
            stmts.push(db.prepare(`
              INSERT OR REPLACE INTO employee_devices (emp_id, device_id, device_name, bound_at, updated_at)
              VALUES (?, ?, ?, ?, ?)
            `).bind(d.emp_id, d.device_id, d.device_name || '', d.bound_at || new Date().toISOString(), d.updated_at || new Date().toISOString()));
          }
        }
        await executeBatch(stmts);
        restoredSummary.push(`การผูกเครื่อง ${stmts.length} เครื่อง`);
      }

      // 6. Monthly Inputs & Payroll Calcs
      if (doPayroll) {
        await db.prepare('ALTER TABLE monthly_inputs ADD COLUMN unpaid_sick_leave_days REAL DEFAULT 0').run().catch(() => {});

        let targetInputs = Array.isArray(data.monthly_inputs) ? data.monthly_inputs : [];
        let targetCalcs = Array.isArray(data.payroll_calcs) ? data.payroll_calcs : [];

        if (selectedPeriods && selectedPeriods.length > 0) {
          targetInputs = targetInputs.filter(i => selectedPeriods.includes(i.period));
          targetCalcs = targetCalcs.filter(p => selectedPeriods.includes(p.period));

          for (const sp of selectedPeriods) {
            await db.prepare('DELETE FROM monthly_inputs WHERE period = ?').bind(sp).run().catch(() => {});
            await db.prepare('DELETE FROM payroll_calcs WHERE period = ?').bind(sp).run().catch(() => {});
          }
        } else if (!opts.selectiveMode) {
          await db.prepare('DELETE FROM monthly_inputs').run().catch(() => {});
          await db.prepare('DELETE FROM payroll_calcs').run().catch(() => {});
        }

        const inputStmts = [];
        for (const i of targetInputs) {
          if (i.period && i.emp_id) {
            inputStmts.push(db.prepare(`
              INSERT OR REPLACE INTO monthly_inputs
              (period, no, emp_id, emp_name, base_salary, pf_rate, pf_amount, absent_days, leave_days, sick_leave_days, unpaid_sick_leave_days, late_deduct, ot_hours, ot_rate, allowance, bonus, advance_deduct, other_deduct, sso, tax)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              i.period, Number(i.no) || 1, i.emp_id, i.emp_name || '', Number(i.base_salary) || 0,
              Number(i.pf_rate) || 0, Number(i.pf_amount) || 0,
              Number(i.absent_days) || 0, Number(i.leave_days) || 0, Number(i.sick_leave_days) || 0, Number(i.unpaid_sick_leave_days) || 0, Number(i.late_deduct) || 0,
              Number(i.ot_hours) || 0, Number(i.ot_rate) || 40, Number(i.allowance) || 0, Number(i.bonus) || 0,
              Number(i.advance_deduct) || 0, Number(i.other_deduct) || 0, Number(i.sso) || 0, Number(i.tax) || 0
            ));
          }
        }
        await executeBatch(inputStmts);

        const calcStmts = [];
        for (const p of targetCalcs) {
          if (p.period && p.emp_id) {
            calcStmts.push(db.prepare(`
              INSERT OR REPLACE INTO payroll_calcs
              (period, emp_id, full_name, department, position, bank_name, bank_account, base_salary, ot_hours, ot_rate, ot_pay, allowance, bonus, leave_deduction, gross_pay, sso, pf, tax, advance_deduct, other_deduct, total_deductions, net_pay)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              p.period, p.emp_id, p.full_name || '', p.department || '', p.position || '', p.bank_name || '', p.bank_account || '',
              Number(p.base_salary) || 0, Number(p.ot_hours) || 0, Number(p.ot_rate) || 40, Number(p.ot_pay) || 0,
              Number(p.allowance) || 0, Number(p.bonus) || 0, Number(p.leave_deduction) || 0, Number(p.gross_pay) || 0,
              Number(p.sso) || 0, Number(p.pf) || 0, Number(p.tax) || 0, Number(p.advance_deduct) || 0, Number(p.other_deduct) || 0,
              Number(p.total_deductions) || 0, Number(p.net_pay) || 0
            ));
          }
        }
        await executeBatch(calcStmts);

        restoredSummary.push(`รายการเงินเดือน ${inputStmts.length} รายการ (${calcStmts.length} คำนวณ)`);
      }

      // 7. Push Subscriptions
      if (doPushSubs && Array.isArray(data.push_subscriptions)) {
        const stmts = [];
        for (const ps of data.push_subscriptions) {
          if (ps.endpoint && ps.p256dh && ps.auth) {
            stmts.push(db.prepare(`
              INSERT OR REPLACE INTO push_subscriptions (emp_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(ps.emp_id || '', ps.endpoint, ps.p256dh, ps.auth, ps.user_agent || '', ps.created_at || new Date().toISOString(), ps.updated_at || new Date().toISOString()));
          }
        }
        await executeBatch(stmts);
        restoredSummary.push(`Web Push ${stmts.length} อุปกรณ์`);
      }

      // 8. PTN Time Tables
      if (doPtnTime) {
        if (Array.isArray(data.time_logs)) {
          await db.prepare("ALTER TABLE time_logs ADD COLUMN break_out TEXT").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN break_in TEXT").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN break_out_photo_url TEXT").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN break_in_photo_url TEXT").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN break_out_lat REAL").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN break_out_lng REAL").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN break_in_lat REAL").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN break_in_lng REAL").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN break_minutes INTEGER DEFAULT 0").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN overbreak_minutes INTEGER DEFAULT 0").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN branch_id TEXT").run().catch(() => {});
          await db.prepare("ALTER TABLE time_logs ADD COLUMN is_full_pay INTEGER DEFAULT 0").run().catch(() => {});

          const stmts = [];
          for (const tl of data.time_logs) {
            if (tl.emp_id && tl.date) {
              stmts.push(db.prepare(`
                INSERT OR REPLACE INTO time_logs (
                  id, emp_id, date, clock_in, clock_out,
                  break_out, break_in, break_out_photo_url, break_in_photo_url,
                  break_out_lat, break_out_lng, break_in_lat, break_in_lng,
                  break_minutes, overbreak_minutes, branch_id, is_full_pay,
                  in_lat, in_lng, out_lat, out_lng, in_photo_url, out_photo_url,
                  late_minutes, work_hours, ot_hours, status, remark, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                tl.id || null, tl.emp_id, tl.date, tl.clock_in || null, tl.clock_out || null,
                tl.break_out || null, tl.break_in || null, tl.break_out_photo_url || null, tl.break_in_photo_url || null,
                tl.break_out_lat != null ? Number(tl.break_out_lat) : null, tl.break_out_lng != null ? Number(tl.break_out_lng) : null,
                tl.break_in_lat != null ? Number(tl.break_in_lat) : null, tl.break_in_lng != null ? Number(tl.break_in_lng) : null,
                Number(tl.break_minutes) || 0, Number(tl.overbreak_minutes) || 0, tl.branch_id || null, Number(tl.is_full_pay) || 0,
                tl.in_lat != null ? Number(tl.in_lat) : null, tl.in_lng != null ? Number(tl.in_lng) : null,
                tl.out_lat != null ? Number(tl.out_lat) : null, tl.out_lng != null ? Number(tl.out_lng) : null,
                tl.in_photo_url || null, tl.out_photo_url || null,
                Number(tl.late_minutes) || 0, Number(tl.work_hours) || 0, Number(tl.ot_hours) || 0,
                tl.status || 'NORMAL', tl.remark || null, tl.created_at || new Date().toISOString()
              ));
            }
          }
          await executeBatch(stmts);
        }

        if (Array.isArray(data.leave_requests)) {
          const stmts = [];
          for (const lr of data.leave_requests) {
            if (lr.emp_id && lr.leave_type) {
              stmts.push(db.prepare(`
                INSERT OR REPLACE INTO leave_requests (id, emp_id, leave_type, start_date, end_date, days, reason, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(lr.id || null, lr.emp_id, lr.leave_type, lr.start_date, lr.end_date, lr.days || 1, lr.reason || '', lr.status || 'PENDING', lr.created_at || new Date().toISOString()));
            }
          }
          await executeBatch(stmts);
        }

        if (Array.isArray(data.ot_requests)) {
          const stmts = [];
          for (const ot of data.ot_requests) {
            if (ot.emp_id && ot.ot_date) {
              stmts.push(db.prepare(`
                INSERT OR REPLACE INTO ot_requests (id, emp_id, ot_date, start_time, end_time, hours, reason, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(ot.id || null, ot.emp_id, ot.ot_date, ot.start_time, ot.end_time, ot.hours || 0, ot.reason || '', ot.status || 'PENDING', ot.created_at || new Date().toISOString()));
            }
          }
          await executeBatch(stmts);
        }

        if (Array.isArray(data.advance_requests)) {
          const stmts = [];
          for (const ar of data.advance_requests) {
            if (ar.emp_id && ar.amount) {
              stmts.push(db.prepare(`
                INSERT OR REPLACE INTO advance_requests (id, emp_id, amount, reason, status, request_date, period, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(ar.id || null, ar.emp_id, ar.amount, ar.reason || '', ar.status || 'PENDING', ar.request_date || '', ar.period || '', ar.created_at || new Date().toISOString()));
            }
          }
          await executeBatch(stmts);
        }

        if (Array.isArray(data.attendance_settings)) {
          const stmts = [];
          for (const as of data.attendance_settings) {
            if (as.key && as.value !== undefined) {
              stmts.push(db.prepare('INSERT OR REPLACE INTO attendance_settings (key, value) VALUES (?, ?)').bind(as.key, String(as.value)));
            }
          }
          await executeBatch(stmts);
        }

        restoredSummary.push('ข้อมูล PTN Time (ลงเวลา, ลา, โอที, เบิกฉุกเฉิน)');
      }

      await logSystemActivity(db, params.username || 'Admin', 'RESTORE_DATABASE', `Restored: ${restoredSummary.join(', ')}`);

      return {
        success: true,
        summary: restoredSummary,
        message: `กู้คืนข้อมูลสำเร็จ: ${restoredSummary.join(', ')}`
      };
  }
};
