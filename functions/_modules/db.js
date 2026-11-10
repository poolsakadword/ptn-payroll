/**
 * Database Schemas & Audit Trail Module
 */
import { hashUserPassword } from './security.js';

export async function logSystemActivity(db, username, action, details) {
  try {
    await db.prepare('CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, username TEXT, action TEXT, details TEXT)').run().catch(() => {});
    const bkk = new Date(Date.now() + (7 * 3600 * 1000));
    const now = bkk.toISOString().replace('T', ' ').substring(0, 19);
    await db.prepare('INSERT INTO activity_logs (timestamp, username, action, details) VALUES (?, ?, ?, ?)').bind(now, username || 'System', action, details || '').run();
  } catch(e) {
    console.error('Failed to log activity:', e);
  }
}

export async function ensureBranchTables(db) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS branches (
        branch_id TEXT PRIMARY KEY,
        branch_name TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        radius_meters INTEGER DEFAULT 200,
        work_start_time TEXT DEFAULT '09:30',
        work_end_time TEXT DEFAULT '19:00',
        lunch_start_time TEXT DEFAULT '13:00',
        lunch_end_time TEXT DEFAULT '14:00',
        grace_minutes INTEGER DEFAULT 0,
        ot_start_time TEXT DEFAULT '19:00',
        kiosk_pin TEXT DEFAULT '123456',
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});

    // Seed default 4 branches if empty
    const countRow = await db.prepare('SELECT COUNT(*) as count FROM branches').first().catch(() => null);
    if (!countRow || countRow.count === 0) {
      await db.prepare(`
        INSERT OR IGNORE INTO branches (branch_id, branch_name, lat, lng, radius_meters, work_start_time, work_end_time, lunch_start_time, lunch_end_time, grace_minutes, ot_start_time, kiosk_pin, status)
        VALUES 
          ('B01', 'สำนักงานใหญ่', 15.678794, 100.090403, 50, '09:30', '19:00', '13:00', '14:00', 0, '19:00', '123456', 'ACTIVE'),
          ('B02', 'สาขาที่ 2 (หน้าร้าน A)', 13.756300, 100.501800, 150, '09:30', '19:00', '13:00', '14:00', 0, '19:00', '123456', 'ACTIVE'),
          ('B03', 'สาขาที่ 3 (หน้าร้าน B)', 13.712000, 100.589000, 150, '10:00', '20:00', '13:30', '14:30', 0, '20:00', '123456', 'ACTIVE'),
          ('B04', 'สาขาที่ 4 (คลังสินค้า/สำรอง)', 13.789000, 100.550000, 200, '09:00', '18:00', '12:00', '13:00', 0, '18:00', '123456', 'ACTIVE')
      `).run().catch(() => {});
    }

    await db.prepare("ALTER TABLE employees ADD COLUMN branch_id TEXT DEFAULT 'B01'").run().catch(() => {});
    await db.prepare("ALTER TABLE employees ADD COLUMN allow_all_branches TEXT DEFAULT 'false'").run().catch(() => {});
    await db.prepare("ALTER TABLE employees ADD COLUMN diligence_allowance REAL").run().catch(() => {});
    await db.prepare("ALTER TABLE employees ADD COLUMN is_break_exempt TEXT DEFAULT 'false'").run().catch(() => {});
    await db.prepare("ALTER TABLE time_logs ADD COLUMN branch_id TEXT").run().catch(() => {});
    await db.prepare("ALTER TABLE time_logs ADD COLUMN branch_name TEXT").run().catch(() => {});
    await db.prepare("UPDATE employees SET branch_id = 'B01' WHERE branch_id IS NULL OR branch_id = ''").run().catch(() => {});
  } catch(e) {
    console.error('ensureBranchTables note:', e);
  }
}

export async function ensurePushTables(db) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emp_id TEXT,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        app_type TEXT DEFAULT 'PAYROLL',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});
    await db.prepare("ALTER TABLE push_subscriptions ADD COLUMN app_type TEXT DEFAULT 'PAYROLL'").run().catch(() => {});
  } catch(e) {
    console.error('ensurePushTables note:', e);
  }
}

export async function ensureTimeAttendanceTables(db) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS time_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emp_id TEXT NOT NULL,
        date TEXT NOT NULL,
        clock_in TEXT,
        clock_out TEXT,
        in_lat REAL,
        in_lng REAL,
        out_lat REAL,
        out_lng REAL,
        in_photo_url TEXT,
        out_photo_url TEXT,
        late_minutes INTEGER DEFAULT 0,
        work_hours REAL DEFAULT 0,
        ot_hours REAL DEFAULT 0,
        status TEXT DEFAULT 'NORMAL',
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});

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
    await db.prepare("ALTER TABLE leave_requests ADD COLUMN medical_cert_url TEXT").run().catch(() => {});
    await db.prepare("ALTER TABLE leave_requests ADD COLUMN days_count REAL DEFAULT 1.0").run().catch(() => {});
    await db.prepare("ALTER TABLE leave_requests ADD COLUMN time_slot TEXT DEFAULT 'FULL'").run().catch(() => {});

    // High Performance Indexes for Attendance & Requests
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_time_logs_date ON time_logs(date)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_time_logs_emp_date ON time_logs(emp_id, date)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_time_logs_branch_date ON time_logs(branch_id, date)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(emp_id)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ot_requests_emp_date ON ot_requests(emp_id, date)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_advance_requests_emp_date ON advance_requests(emp_id, request_date)").run().catch(() => {});
  } catch(e) {
    console.error('ensureTimeAttendanceTables note:', e);
  }
}

let _globalSchemaEnsured = false;
export async function ensureGlobalSchemas(db) {
  if (_globalSchemaEnsured) return;
  _globalSchemaEnsured = true;
  try {
    await ensureBranchTables(db);
    await ensurePushTables(db);
    await ensureTimeAttendanceTables(db);

    // Consolidated Core Migrations (Single run per cold start to eliminate D1 lock contention)
    await db.prepare('ALTER TABLE users ADD COLUMN permissions TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN status TEXT DEFAULT "Active"').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN resign_date TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN probation_days INTEGER DEFAULT 119').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN probation_end_date TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN photo_url TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN is_ot_eligible TEXT DEFAULT "true"').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN is_undertime_exempt TEXT DEFAULT "false"').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN is_attendance_exempt TEXT DEFAULT "false"').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN is_break_exempt TEXT DEFAULT "false"').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN diligence_allowance REAL').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN is_confidential INTEGER DEFAULT 0').run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_employees_confidential ON employees(is_confidential)').run().catch(() => {});
    await db.prepare('ALTER TABLE monthly_inputs ADD COLUMN unpaid_sick_leave_days REAL DEFAULT 0').run().catch(() => {});
    await db.prepare('ALTER TABLE monthly_inputs ADD COLUMN late_minutes INTEGER DEFAULT 0').run().catch(() => {});
    await db.prepare('ALTER TABLE monthly_inputs ADD COLUMN late_count INTEGER DEFAULT 0').run().catch(() => {});
    await db.prepare('ALTER TABLE monthly_inputs ADD COLUMN carried_debt REAL DEFAULT 0').run().catch(() => {});
    await db.prepare('ALTER TABLE payroll_calcs ADD COLUMN carried_debt REAL DEFAULT 0').run().catch(() => {});
    await db.prepare('ALTER TABLE branches ADD COLUMN early_dismissal_full_pay INTEGER DEFAULT 0').run().catch(() => {});
    await db.prepare('ALTER TABLE time_logs ADD COLUMN is_full_pay INTEGER DEFAULT 0').run().catch(() => {});
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS employee_devices (
        emp_id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_name TEXT,
        bound_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS company_holidays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        holiday_name TEXT NOT NULL,
        holiday_type TEXT DEFAULT 'COMPANY',
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON company_holidays(date)').run().catch(() => {});

    // Incident & Damage Deductions Tables
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS incident_deductions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_code TEXT UNIQUE,
        incident_date TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        evidence_photo_url TEXT,
        total_incident_amount REAL NOT NULL,
        company_absorbed_amount REAL DEFAULT 0,
        net_employee_amount REAL NOT NULL,
        split_count INTEGER DEFAULT 1,
        status TEXT DEFAULT 'PENDING',
        reporter_username TEXT,
        approver_username TEXT,
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_incident_deductions_date ON incident_deductions(incident_date)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_incident_deductions_status ON incident_deductions(status)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_incident_deductions_branch ON incident_deductions(branch_id)").run().catch(() => {});

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS incident_deduction_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id INTEGER NOT NULL,
        emp_id TEXT NOT NULL,
        target_period TEXT NOT NULL,
        installment_no INTEGER DEFAULT 1,
        total_installments INTEGER DEFAULT 1,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'SCHEDULED',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_incident_sched_emp_period ON incident_deduction_schedules(emp_id, target_period)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_incident_sched_incident ON incident_deduction_schedules(incident_id)").run().catch(() => {});

    // High Performance Indexes for Payroll, Employees & Activity Logs (Phase 3 Optimization)
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_monthly_inputs_period ON monthly_inputs(period)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_monthly_inputs_period_emp ON monthly_inputs(period, emp_id)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_payroll_calcs_period ON payroll_calcs(period)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_payroll_calcs_period_emp ON payroll_calcs(period, emp_id)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)").run().catch(() => {});
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id)").run().catch(() => {});
  } catch(e) {
    console.warn('ensureGlobalSchemas note:', e);
  }
}

export async function executeBatch(db, stmts, chunkSize = 50) {
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
