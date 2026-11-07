/**
 * Security, Auth Tokens, Roles & Cryptography Module
 */

export async function sha256Hex(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashUserPassword(password) {
  const salt = 'PTN_PAYROLL_SECURE_SALT_2026';
  const hashed = await sha256Hex(password + ':' + salt);
  return 'sha256:' + hashed;
}

export async function verifyUserPassword(inputPassword, storedPassword) {
  if (!storedPassword) return false;
  if (storedPassword.startsWith('sha256:')) {
    const salt = 'PTN_PAYROLL_SECURE_SALT_2026';
    const inputHashed = 'sha256:' + await sha256Hex(inputPassword + ':' + salt);
    return inputHashed === storedPassword;
  }
  // Fallback / legacy plaintext match
  return inputPassword === storedPassword;
}

const MASTER_UNLOCK_SALT = 'PTN_MASTER_UNLOCK_TOKEN_SALT_2026';
export async function getMasterUnlockToken(windowOffset = 0) {
  const windowIndex = Math.floor(Date.now() / 60000) + windowOffset;
  const raw = `${MASTER_UNLOCK_SALT}:${windowIndex}`;
  const fullHash = await sha256Hex(raw);
  return 'PTN-UNLOCK-' + fullHash.substring(0, 12).toUpperCase();
}

export function getDefaultRolePermissions(role) {
  const r = String(role || '').toLowerCase();
  if (r.includes('super') || r === 'admin / hr' || r === 'admin') {
    return ['all'];
  } else if (r.includes('supervisor')) {
    return [
      'view_emp', 'view_attendance', 'approve_attendance', 'unlock_device',
      'manage_time_logs', 'create_attendance_requests'
    ];
  } else if (r.includes('payroll') || r === 'hr') {
    return [
      'view_dash', 'view_emp', 'view_salary', 'edit_emp',
      'view_inputs', 'edit_inputs', 'populate_inputs',
      'view_payroll', 'calc_payroll', 'view_payslip',
      'view_history', 'print_history', 'export_csv',
      'view_analytics', 'view_documents', 'issue_salary_cert',
      'export_bank_files', 'export_tax_sso', 'view_attendance', 'sync_ptn_time',
      'manage_time_logs', 'create_attendance_requests'
    ];
  } else if (r.includes('attendance')) {
    return [
      'view_emp', 'view_inputs', 'edit_inputs', 'populate_inputs',
      'view_attendance', 'approve_attendance', 'unlock_device',
      'sync_ptn_time', 'view_history', 'print_history',
      'manage_time_logs', 'create_attendance_requests'
    ];
  } else if (r.includes('accounting') || r.includes('finance')) {
    return [
      'view_dash', 'view_payroll', 'view_payslip',
      'view_history', 'print_history', 'export_csv',
      'view_analytics', 'view_documents', 'export_bank_files', 'export_tax_sso'
    ];
  } else {
    // General User
    return ['view_emp'];
  }
}

export async function isUserSuperAdmin(db, username) {
  if (!username) return false;
  const u = String(username).trim().toLowerCase();
  if (u === 'admin') return true;
  const row = await db.prepare('SELECT role, permissions FROM users WHERE LOWER(username) = ?').bind(u).first();
  if (!row) return false;
  const r = String(row.role || '').toLowerCase();
  if (r.includes('super') || r === 'admin / hr' || r === 'admin') return true;
  try {
    const perms = row.permissions ? JSON.parse(row.permissions) : [];
    if (perms.includes('all') && (r.includes('admin') || u === 'admin')) return true;
  } catch(e) {}
  return false;
}

export async function userHasPermission(db, username, requiredPerm) {
  if (!username) return false;
  const u = String(username).trim().toLowerCase();
  if (u === 'admin') return true;
  const row = await db.prepare('SELECT role, permissions FROM users WHERE LOWER(username) = ?').bind(u).first();
  if (!row) return false;
  const r = String(row.role || '').toLowerCase();
  if (r.includes('super') || r === 'admin / hr' || r === 'admin') return true;
  try {
    const perms = row.permissions ? JSON.parse(row.permissions) : [];
    if (perms.includes('all') || perms.includes(requiredPerm)) return true;
  } catch(e) {}
  return false;
}

export function base64UrlToBytes(b64url) {
  const b64 = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64Url(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const JWT_SESSION_SECRET = 'PTN_SECRET_KEY_PAYROLL_2026_ENTERPRISE_HMAC';

export async function generateSessionToken(username, role) {
  const payload = JSON.stringify({
    u: username,
    r: role,
    exp: Date.now() + (7 * 24 * 3600 * 1000) // 7 days expiration
  });
  const b64Payload = btoa(unescape(encodeURIComponent(payload)));
  const sig = await sha256Hex(b64Payload + ':' + JWT_SESSION_SECRET);
  return `${b64Payload}.${sig}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64Payload, sig] = parts;
  const expectedSig = await sha256Hex(b64Payload + ':' + JWT_SESSION_SECRET);
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(b64Payload))));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload; // { u: username, r: role, exp: timestamp }
  } catch(e) {
    return null;
  }
}
