-- ==============================================================================
-- Schema for PTN Payroll System V3.0 (Cloudflare D1 SQLite)
-- ==============================================================================

-- 1. Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT,
  role TEXT
);

-- 3. Employees
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
  join_date TEXT,
  pf_rate REAL DEFAULT 0.05,
  default_sso REAL DEFAULT 750,
  default_tax REAL DEFAULT 0
);

-- 4. Monthly Inputs
CREATE TABLE IF NOT EXISTS monthly_inputs (
  period TEXT,
  no INTEGER,
  emp_id TEXT,
  emp_name TEXT,
  base_salary REAL DEFAULT 0,
  pf_rate REAL DEFAULT 0.05,
  pf_amount REAL DEFAULT 0,
  leave_days REAL DEFAULT 0,
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

-- 5. Payroll Calculations
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

-- ==============================================================================
-- Initial Seed Data
-- ==============================================================================

-- Settings
INSERT OR REPLACE INTO settings (key, value) VALUES
('CompanyName', 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด'),
('Address', '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110'),
('Phone', '02-123-4567'),
('TaxId', '0105559876543'),
('Period_Status_สิงหาคม 2569', 'OPEN');

-- Users
INSERT OR REPLACE INTO users (username, password, role) VALUES
('admin', '123456', 'Admin / HR'),
('admin@company.com', 'P@ssword123', 'Admin / HR');

-- Employees
INSERT OR REPLACE INTO employees (emp_id, full_name, citizen_id, phone, address, department, position, base_salary, bank_name, bank_account, join_date, pf_rate, default_sso, default_tax) VALUES
('EMP001', 'สมชาย ใจดี', '1100200300401', '081-234-5678', 'กรุงเทพมหานคร', 'IT', 'Programmer', 45000, 'กสิกรไทย (KBANK)', '123-4-56789-0', '2023-01-15', 0.05, 750, 1200),
('EMP002', 'สมหญิง รักงาน', '3100500600702', '089-876-5432', 'นนทบุรี', 'HR', 'HR Manager', 40000, 'ไทยพาณิชย์ (SCB)', '234-5-67890-1', '2022-05-01', 0.05, 750, 950),
('EMP003', 'วิชัย มุ่งมั่น', '1100700800903', '086-555-7890', 'ปทุมธานี', 'Sales', 'Sales Executive', 30000, 'กรุงเทพ (BBL)', '345-6-78901-2', '2024-02-10', 0.03, 750, 800);

-- Monthly Inputs (Period: สิงหาคม 2569)
INSERT OR REPLACE INTO monthly_inputs (period, no, emp_id, emp_name, base_salary, pf_rate, pf_amount, leave_days, ot_hours, ot_rate, allowance, bonus, advance_deduct, other_deduct, sso, tax) VALUES
('สิงหาคม 2569', 1, 'EMP001', 'สมชาย ใจดี', 45000, 0.05, 2250, 0, 10, 281.25, 1500, 0, 0, 0, 750, 1200),
('สิงหาคม 2569', 2, 'EMP002', 'สมหญิง รักงาน', 40000, 0.05, 2000, 1, 5, 250, 1000, 0, 500, 0, 750, 950),
('สิงหาคม 2569', 3, 'EMP003', 'วิชัย มุ่งมั่น', 30000, 0.03, 900, 0, 15, 187.5, 3000, 5000, 1000, 0, 750, 800);

-- Payroll Calculations (Period: สิงหาคม 2569)
INSERT OR REPLACE INTO payroll_calcs (period, emp_id, full_name, department, position, bank_name, bank_account, base_salary, ot_hours, ot_rate, ot_pay, allowance, bonus, leave_deduction, gross_pay, sso, pf, tax, advance_deduct, other_deduct, total_deductions, net_pay) VALUES
('สิงหาคม 2569', 'EMP001', 'สมชาย ใจดี', 'IT', 'Programmer', 'กสิกรไทย (KBANK)', '123-4-56789-0', 45000, 10, 281.25, 2812.5, 1500, 0, 0, 49312.5, 750, 2250, 1200, 0, 0, 4200, 45112.5),
('สิงหาคม 2569', 'EMP002', 'สมหญิง รักงาน', 'HR', 'HR Manager', 'ไทยพาณิชย์ (SCB)', '234-5-67890-1', 40000, 5, 250, 1250, 1000, 0, 1333.33, 40916.67, 750, 2000, 950, 500, 0, 4200, 36716.67),
('สิงหาคม 2569', 'EMP003', 'วิชัย มุ่งมั่น', 'Sales', 'Sales Executive', 'กรุงเทพ (BBL)', '345-6-78901-2', 30000, 15, 187.5, 2812.5, 3000, 5000, 0, 40812.5, 750, 900, 800, 1000, 0, 3450, 37362.5);