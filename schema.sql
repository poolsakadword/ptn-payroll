-- ==============================================================================
-- Schema for PTN Payroll System V3.0 (Cloudflare D1 SQLite)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT,
  role TEXT
);

CREATE TABLE IF NOT EXISTS employees (
  emp_id TEXT PRIMARY KEY,
  full_name TEXT,
  citizen_id TEXT,
  phone TEXT,
  address TEXT,
  department TEXT,
  position TEXT,
  base_salary REAL DEFAULT 0,
  bank_name TEXT,
  bank_account TEXT,
  birth_date TEXT,
  age INTEGER DEFAULT 0,
  join_date TEXT,
  pf_rate REAL DEFAULT 0.05,
  default_sso REAL DEFAULT 750,
  default_tax REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS monthly_inputs (
  period TEXT,
  no INTEGER,
  emp_id TEXT,
  emp_name TEXT,
  base_salary REAL DEFAULT 0,
  pf_rate REAL DEFAULT 0.05,
  pf_amount REAL DEFAULT 0,
  
  absent_days REAL DEFAULT 0,
  leave_days REAL DEFAULT 0,
  sick_leave_days REAL DEFAULT 0,
  late_deduct REAL DEFAULT 0,
  ot_hours REAL DEFAULT 0,
  ot_rate REAL DEFAULT 0,
  allowance REAL DEFAULT 0,
  bonus REAL DEFAULT 0,
  advance_deduct REAL DEFAULT 0,
  other_deduct REAL DEFAULT 0,
  sso REAL DEFAULT 750,
  tax REAL DEFAULT 0,
  PRIMARY KEY (period, emp_id)
);

CREATE TABLE IF NOT EXISTS payroll_calcs (
  period TEXT,
  emp_id TEXT,
  full_name TEXT,
  department TEXT,
  position TEXT,
  bank_name TEXT,
  bank_account TEXT,
  base_salary REAL DEFAULT 0,
  ot_hours REAL DEFAULT 0,
  ot_rate REAL DEFAULT 0,
  ot_pay REAL DEFAULT 0,
  allowance REAL DEFAULT 0,
  bonus REAL DEFAULT 0,
  leave_deduction REAL DEFAULT 0,
  gross_pay REAL DEFAULT 0,
  sso REAL DEFAULT 750,
  pf REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  advance_deduct REAL DEFAULT 0,
  other_deduct REAL DEFAULT 0,
  total_deductions REAL DEFAULT 0,
  net_pay REAL DEFAULT 0,
  PRIMARY KEY (period, emp_id)
);