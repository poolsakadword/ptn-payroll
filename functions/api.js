
// ==============================================================================
// SECURITY & AUDIT TRAIL HELPERS
// ==============================================================================
async function sha256Hex(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashUserPassword(password) {
  const salt = 'PTN_PAYROLL_SECURE_SALT_2026';
  const hashed = await sha256Hex(password + ':' + salt);
  return 'sha256:' + hashed;
}

async function verifyUserPassword(inputPassword, storedPassword) {
  if (!storedPassword) return false;
  if (storedPassword.startsWith('sha256:')) {
    const salt = 'PTN_PAYROLL_SECURE_SALT_2026';
    const inputHashed = 'sha256:' + await sha256Hex(inputPassword + ':' + salt);
    return inputHashed === storedPassword;
  }
  // Fallback / legacy plaintext match
  return inputPassword === storedPassword;
}

async function logSystemActivity(db, username, action, details) {
  try {
    await db.prepare('CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, username TEXT, action TEXT, details TEXT)').run().catch(() => {});
    const bkk = new Date(Date.now() + (7 * 3600 * 1000));
    const now = bkk.toISOString().replace('T', ' ').substring(0, 19);
    await db.prepare('INSERT INTO activity_logs (timestamp, username, action, details) VALUES (?, ?, ?, ?)').bind(now, username || 'System', action, details || '').run();
  } catch(e) {
    console.error('Failed to log activity:', e);
  }
}

const MASTER_UNLOCK_SALT = 'PTN_MASTER_UNLOCK_TOKEN_SALT_2026';
async function getMasterUnlockToken(windowOffset = 0) {
  const windowIndex = Math.floor(Date.now() / 60000) + windowOffset;
  const raw = `${MASTER_UNLOCK_SALT}:${windowIndex}`;
  const fullHash = await sha256Hex(raw);
  return 'PTN-UNLOCK-' + fullHash.substring(0, 12).toUpperCase();
}

function getDefaultRolePermissions(role) {
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

function timeStringToMinutes(t) {
  if (!t) return null;
  const p = String(t).trim().split(':');
  return p.length >= 2 ? (parseInt(p[0], 10) * 60 + parseInt(p[1], 10)) : null;
}

async function isUserSuperAdmin(db, username) {
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

async function userHasPermission(db, username, requiredPerm) {
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

async function ensureBranchTables(db) {
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
    await db.prepare("ALTER TABLE time_logs ADD COLUMN branch_id TEXT").run().catch(() => {});
    await db.prepare("ALTER TABLE time_logs ADD COLUMN branch_name TEXT").run().catch(() => {});
    await db.prepare("UPDATE employees SET branch_id = 'B01' WHERE branch_id IS NULL OR branch_id = ''").run().catch(() => {});
  } catch(e) {
    console.error('ensureBranchTables note:', e);
  }
}

// ==============================================================================
// WEB PUSH NOTIFICATION (VAPID + RFC 8291 / 8292 ZERO-DEPENDENCY ENGINE)
// ==============================================================================
const VAPID_PUBLIC_KEY = 'BFIl918yWYb9YE1JrQvdjqVIDumstq7AoG68thcEd-eeVbOIMA5uhUO6SAlBaO7Ulj2CR3mcJQNHUrx1Crg4g7A';
const VAPID_PRIVATE_KEY = 'LlUhEMxj03FGhpNmJ854Ht5XjxT7aOAFTEDWDs_SxIw';
const VAPID_SUBJECT = 'mailto:admin@ptn-pharma.com';

function base64UrlToBytes(b64url) {
  const b64 = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createVapidJwt(audience) {
  const pubBytes = base64UrlToBytes(VAPID_PUBLIC_KEY);
  const x = bytesToBase64Url(pubBytes.slice(1, 33));
  const y = bytesToBase64Url(pubBytes.slice(33, 65));

  const privKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d: VAPID_PRIVATE_KEY },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToBase64Url(encoder.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT
  })));

  const data = encoder.encode(header + '.' + claims);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, data);
  return header + '.' + claims + '.' + bytesToBase64Url(new Uint8Array(sig));
}

async function encryptWebPushPayload(clientP256dhB64, clientAuthB64, payloadString) {
  const clientPublicKeyBytes = base64UrlToBytes(clientP256dhB64);
  const clientAuthBytes = base64UrlToBytes(clientAuthB64);

  // 1. Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // 2. Import client public key for ECDH
  const clientKeyJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(clientPublicKeyBytes.slice(1, 33)),
    y: bytesToBase64Url(clientPublicKeyBytes.slice(33, 65))
  };
  const clientPublicKey = await crypto.subtle.importKey(
    'jwk',
    clientKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 3. Derive shared secret (32 bytes)
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    localKeyPair.privateKey,
    256
  );

  // 4. Export local public key in raw format (65 bytes)
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));

  // 5. HKDF for PRK using auth secret
  const encoder = new TextEncoder();
  const authInfoPrefix = encoder.encode('WebPush: info\0');
  const authInfo = new Uint8Array(authInfoPrefix.length + clientPublicKeyBytes.length + localPublicKeyRaw.length);
  authInfo.set(authInfoPrefix, 0);
  authInfo.set(clientPublicKeyBytes, authInfoPrefix.length);
  authInfo.set(localPublicKeyRaw, authInfoPrefix.length + clientPublicKeyBytes.length);

  const ikmKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const prkBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: clientAuthBytes, info: authInfo },
    ikmKey,
    256
  );

  // 6. Generate 16 bytes random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 7. Derive Content Encryption Key (CEK, 16 bytes) and Nonce (12 bytes)
  const prkKey = await crypto.subtle.importKey('raw', prkBits, 'HKDF', false, ['deriveBits']);
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt, info: encoder.encode('Content-Encoding: aes128gcm\0') },
    prkKey,
    128
  );
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt, info: encoder.encode('Content-Encoding: nonce\0') },
    prkKey,
    96
  );

  // 8. Encrypt payload with AES-GCM
  const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);
  const payloadBytes = encoder.encode(payloadString);
  const record = new Uint8Array(payloadBytes.length + 1);
  record.set(payloadBytes, 0);
  record[payloadBytes.length] = 2; // record delimiter

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBits, tagLength: 128 },
    cek,
    record
  );

  // 9. Build aes128gcm body header
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = 65;
  header.set(localPublicKeyRaw, 21);

  const finalBody = new Uint8Array(header.length + ciphertext.byteLength);
  finalBody.set(header, 0);
  finalBody.set(new Uint8Array(ciphertext), header.length);

  return finalBody;
}

async function sendWebPush(subscription, payload) {
  try {
    const endpoint = subscription.endpoint;
    const url = new URL(endpoint);
    const audience = url.protocol + '//' + url.host;

    const jwt = await createVapidJwt(audience);
    const bodyBytes = await encryptWebPushPayload(subscription.p256dh, subscription.auth, typeof payload === 'string' ? payload : JSON.stringify(payload));

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'high',
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`
      },
      body: bodyBytes
    });

    if (res.status === 404 || res.status === 410) {
      return { success: false, expired: true, status: res.status };
    }
    return { success: res.ok, status: res.status };
  } catch(e) {
    console.error('sendWebPush error:', e);
    return { success: false, error: e.message };
  }
}

async function ensurePushTables(db) {
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

async function sendPushToEmployee(db, empId, payload) {
  if (!empId) return 0;
  try {
    const subs = (await db.prepare('SELECT * FROM push_subscriptions WHERE emp_id = ?').bind(empId).all().catch(() => ({ results: [] }))).results || [];
    let count = 0;
    for (const sub of subs) {
      const res = await sendWebPush(sub, payload);
      if (res.success) count++;
      else if (res.expired) {
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run().catch(() => {});
      }
    }
    return count;
  } catch(e) {
    console.error('sendPushToEmployee error:', e);
    return 0;
  }
}

async function sendPushToAdmins(db, payload) {
  try {
    const subs = (await db.prepare("SELECT * FROM push_subscriptions WHERE app_type = 'PAYROLL' OR emp_id = 'ADMIN' OR emp_id LIKE 'ADMIN%'").all().catch(() => ({ results: [] }))).results || [];
    let count = 0;
    for (const sub of subs) {
      const res = await sendWebPush(sub, payload);
      if (res.success) count++;
      else if (res.expired) {
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run().catch(() => {});
      }
    }
    return count;
  } catch(e) {
    console.error('sendPushToAdmins error:', e);
    return 0;
  }
}

async function broadcastPushNotification(db, payload, appTypeFilter = null) {
  try {
    let sql = 'SELECT * FROM push_subscriptions';
    let binds = [];
    if (appTypeFilter) {
      sql += ' WHERE app_type = ? OR app_type = "ALL"';
      binds.push(appTypeFilter);
    }
    const subs = (await db.prepare(sql).bind(...binds).all().catch(() => ({ results: [] }))).results || [];
    let count = 0;
    for (const sub of subs) {
      const res = await sendWebPush(sub, payload);
      if (res.success) count++;
      else if (res.expired) {
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run().catch(() => {});
      }
    }
    return count;
  } catch(e) {
    console.error('broadcastPushNotification error:', e);
    return 0;
  }
}

async function ensureTimeAttendanceTables(db) {
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
  } catch(e) {
    console.error('ensureTimeAttendanceTables note:', e);
  }
}

let _globalSchemaEnsured = false;
async function ensureGlobalSchemas(db) {
  if (_globalSchemaEnsured) return;
  _globalSchemaEnsured = true;
  try {
    await ensureBranchTables(db);
    await ensurePushTables(db);
    await ensureTimeAttendanceTables(db);

    // Consolidated Core Migrations (Single run per cold start to eliminate D1 lock contention)
    await db.prepare('ALTER TABLE users ADD COLUMN permissions TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN status TEXT DEFAULT "Active"').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN probation_days INTEGER DEFAULT 119').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN probation_end_date TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN photo_url TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN is_ot_eligible TEXT DEFAULT "true"').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN is_undertime_exempt TEXT DEFAULT "false"').run().catch(() => {});
    await db.prepare('ALTER TABLE employees ADD COLUMN diligence_allowance REAL').run().catch(() => {});
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
  } catch(e) {
    console.warn('ensureGlobalSchemas note:', e);
  }
}

// ==============================================================================
// SESSION TOKEN AUTHENTICATION (HMAC-SHA256 SIGNED TOKEN)
// ==============================================================================
const JWT_SESSION_SECRET = 'PTN_SECRET_KEY_PAYROLL_2026_ENTERPRISE_HMAC';

async function generateSessionToken(username, role) {
  const payload = JSON.stringify({
    u: username,
    r: role,
    exp: Date.now() + (7 * 24 * 3600 * 1000) // 7 days expiration
  });
  const b64Payload = btoa(unescape(encodeURIComponent(payload)));
  const sig = await sha256Hex(b64Payload + ':' + JWT_SESSION_SECRET);
  return `${b64Payload}.${sig}`;
}

async function verifySessionToken(token) {
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

function getBranchShiftSessions(branch) {
  if (!branch) {
    return {
      morningHours: 3.5,
      afternoonHours: 5.0,
      totalHours: 8.5,
      morningFraction: 0.412,
      afternoonFraction: 0.588,
      lunchStartMin: 13 * 60,
      lunchEndMin: 14 * 60
    };
  }
  const start = branch.work_start_time || '09:30';
  const end = branch.work_end_time || '19:00';
  const lunchStart = branch.lunch_start_time || '13:00';
  const lunchEnd = branch.lunch_end_time || '14:00';

  const [sh, sm] = (start || '09:30').split(':').map(Number);
  const [eh, em] = (end || '19:00').split(':').map(Number);
  const [lsh, lsm] = (lunchStart || '13:00').split(':').map(Number);
  const [leh, lem] = (lunchEnd || '14:00').split(':').map(Number);

  const morningMins = (lsh * 60 + lsm) - (sh * 60 + sm);
  const afternoonMins = (eh * 60 + em) - (leh * 60 + lem);
  const morningHours = morningMins > 0 ? Math.round((morningMins / 60) * 100) / 100 : 3.5;
  const afternoonHours = afternoonMins > 0 ? Math.round((afternoonMins / 60) * 100) / 100 : 5.0;
  const totalHours = Math.round((morningHours + afternoonHours) * 100) / 100 || 8.5;

  const morningFraction = Math.round((morningHours / totalHours) * 1000) / 1000;
  const afternoonFraction = Math.round((afternoonHours / totalHours) * 1000) / 1000;

  return {
    morningHours,
    afternoonHours,
    totalHours,
    morningFraction,
    afternoonFraction,
    lunchStartMin: lsh * 60 + lsm,
    lunchEndMin: leh * 60 + lem
  };
}

function normalizeDateToIso(str) {
  if (!str) return '';
  const s = String(str).trim();
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    let y = parseInt(dmyMatch[3], 10);
    if (y > 2400) y -= 543; // Convert B.E. to C.E.
    return `${y}-${m}-${d}`;
  }
  const ymdMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    let y = parseInt(ymdMatch[1], 10);
    if (y > 2400) y -= 543; // Convert B.E. to C.E.
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s.substring(0, 10);
}

function categorizeLeaveType(leaveType, medicalCertUrl) {
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  // Ensure schemas are initialized once per isolate
  await ensureGlobalSchemas(db);

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

    // Verify session token from Authorization Header or params
    const authHeader = request.headers.get('Authorization') || '';
    let token = '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (params.token) {
      token = params.token;
    }
    if (token) {
      const session = await verifySessionToken(token);
      if (session) {
        params.verifiedUser = session.u;
        params.verifiedRole = session.r;
      }
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

function parsePeriodYearMonth(periodStr) {
  const thaiMonths = [
    'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
  ];
  let yearCE = new Date().getFullYear();
  let month = new Date().getMonth() + 1; // 1-12

  if (periodStr) {
    const str = String(periodStr).trim();
    const ymMatch = str.match(/^(\d{4})-(\d{1,2})$/);
    if (ymMatch) {
      let y = parseInt(ymMatch[1], 10);
      if (y > 2400) y -= 543; // BE to CE
      yearCE = y;
      month = parseInt(ymMatch[2], 10);
    } else {
      for (let i = 0; i < thaiMonths.length; i++) {
        if (str.includes(thaiMonths[i])) {
          month = i + 1;
          break;
        }
      }
      const numMatches = str.match(/\d{4}/);
      if (numMatches) {
        let y = parseInt(numMatches[0], 10);
        if (y > 2400) y -= 543; // BE to CE
        yearCE = y;
      }
    }
  }
  return { yearCE, yearBE: yearCE + 543, month };
}

function getPreviousPeriodStr(periodStr) {
  const thaiMonths = [
    'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
  ];
  const { yearBE, month } = parsePeriodYearMonth(periodStr);
  let prevMonth = month - 1;
  let prevYearBE = yearBE;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYearBE -= 1;
  }
  return `${thaiMonths[prevMonth - 1]} ${prevYearBE}`;
}

async function getCutoffDatesForPeriod(db, periodStr) {
  let cutoffDay = 25;
  if (db) {
    const row = await db.prepare("SELECT value FROM attendance_settings WHERE key = 'cutoff_day'").first().catch(() => null);
    if (row && row.value) {
      const parsed = parseInt(row.value, 10);
      if (parsed >= 1 && parsed <= 31) cutoffDay = parsed;
    }
  }

  const { yearCE, month } = parsePeriodYearMonth(periodStr);

  let prevMonth = month - 1;
  let prevYear = yearCE;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }

  let startDate, endDate;
  if (cutoffDay >= 30) {
    // End of month cycle: 1st of month to end of month
    const daysInMonth = new Date(yearCE, month, 0).getDate();
    const actualEndDay = Math.min(cutoffDay, daysInMonth);
    startDate = `${yearCE}-${String(month).padStart(2, '0')}-01`;
    endDate = `${yearCE}-${String(month).padStart(2, '0')}-${String(actualEndDay).padStart(2, '0')}`;
  } else {
    const startDay = cutoffDay + 1;
    startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    endDate = `${yearCE}-${String(month).padStart(2, '0')}-${String(cutoffDay).padStart(2, '0')}`;
  }

  return { startDate, endDate, month, yearCE, cutoffDay };
}

function getActualWorkingDaysInCutoff(startDate, endDate, holidayDatesSet = new Set()) {
  let count = 0;
  let cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (cur <= end) {
    const day = cur.getUTCDay(); // 0 = Sunday
    const dStr = cur.toISOString().substring(0, 10);
    if (day !== 0 && !holidayDatesSet.has(dStr)) { // Monday to Saturday and not a company holiday
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count > 0 ? count : 26;
}

function calculateNewHireProRataRatio(joinDateStr, startDate, endDate, holidayDatesSet = new Set()) {
  if (!joinDateStr || joinDateStr <= startDate) {
    return { isMidPeriod: false, notStarted: false, ratio: 1.0, eligibleDays: 0, totalDays: 0 };
  }
  if (joinDateStr > endDate) {
    return { isMidPeriod: false, notStarted: true, ratio: 0, eligibleDays: 0, totalDays: 0 };
  }
  const totalDays = getActualWorkingDaysInCutoff(startDate, endDate, holidayDatesSet);
  const eligibleDays = getActualWorkingDaysInCutoff(joinDateStr, endDate, holidayDatesSet);
  const ratio = totalDays > 0 ? (eligibleDays / totalDays) : 1.0;
  return { isMidPeriod: true, notStarted: false, ratio, eligibleDays, totalDays };
}

async function getCompanyHolidayDatesSet(db, startDate, endDate) {
  try {
    let sql = 'SELECT date FROM company_holidays';
    const binds = [];
    if (startDate && endDate) {
      sql += ' WHERE date BETWEEN ? AND ?';
      binds.push(startDate, endDate);
    }
    const rows = await db.prepare(sql).bind(...binds).all().catch(() => ({ results: [] }));
    const set = new Set();
    for (const r of (rows.results || [])) {
      if (r.date) set.add(r.date);
    }
    return set;
  } catch(e) {
    return new Set();
  }
}

async function isPeriodLocked(db, period) {
  if (!period) return false;
  try {
    const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(`Period_Status_${period}`).first();
    return !!(row && row.value && row.value.startsWith('CLOSED'));
  } catch (e) {
    return false;
  }
}

async function handleAction(db, action, params) {
  if (params.verifiedUser) {
    params.username = params.verifiedUser;
    params.currentUsername = params.verifiedUser;
  }

  let period = params.period;
  if (!period) {
    const latestRow = await db.prepare('SELECT period FROM monthly_inputs ORDER BY rowid DESC LIMIT 1').first().catch(() => null);
    period = (latestRow && latestRow.period) ? latestRow.period : getDefaultPeriod();
  }

  switch (action) {
    // 1. AUTH (STRICT D1 DATABASE AUTHENTICATION WITH SECURE SESSION TOKEN)
    case 'checkLogin': {
      const u = String(params.username || '').trim().toLowerCase();
      const p = String(params.password || '').trim();
      if (!u || !p) return { success: false, message: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' };

      // Ensure default admin user exists in D1 database if table is empty
      const userCountRow = await db.prepare('SELECT COUNT(*) as count FROM users').first();
      if (!userCountRow || userCountRow.count === 0) {
        await db.prepare('INSERT OR REPLACE INTO users (username, password, role) VALUES (?, ?, ?)').bind('admin', '123456', 'Admin / HR').run();
      }

      // Check strictly against D1 users database (Using Secure Password Verification)
      const userRow = await db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').bind(u).first();
      const isPasswordValid = userRow ? await verifyUserPassword(p, userRow.password) : false;
      if (userRow && isPasswordValid) {
        // Auto-upgrade legacy plaintext password to secure SHA-256 hash
        if (!userRow.password.startsWith('sha256:')) {
          const newHashed = await hashUserPassword(p);
          await db.prepare('UPDATE users SET password = ? WHERE username = ?').bind(newHashed, userRow.username).run().catch(() => {});
        }
        await logSystemActivity(db, userRow.username, 'LOGIN', 'เข้าสู่ระบบสำเร็จ');
        let perms = [];
        try {
          perms = userRow.permissions ? JSON.parse(userRow.permissions) : getDefaultRolePermissions(userRow.role);
        } catch(e) {
          perms = getDefaultRolePermissions(userRow.role);
        }
        if (userRow.username === 'admin' || userRow.role === 'Admin / HR' || userRow.role === 'Admin') {
          perms = ['all'];
        }
        const sessionToken = await generateSessionToken(userRow.username, userRow.role || 'User');
        return { success: true, username: userRow.username, role: userRow.role || 'User', permissions: perms, token: sessionToken };
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
        diligenceAllowance: (e.diligence_allowance !== null && e.diligence_allowance !== undefined && !isNaN(Number(e.diligence_allowance))) ? Number(e.diligence_allowance) : null,
        isDeviceBound: !!deviceMap[e.emp_id],
        boundDevice: deviceMap[e.emp_id] || null
      }));

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
            carriedDebt: Number(c.carried_debt) || 0,
            totalDeductions: ded,
            netPay: net
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
      const latestActivePeriod = (latestRowPeriod && latestRowPeriod.period) ? latestRowPeriod.period : period;

      const getSetNum = (k, def) => {
        const row = (settingsRows.results || []).find(r => r.key === k);
        return (row && row.value !== undefined && row.value !== null && !isNaN(Number(row.value))) ? Number(row.value) : def;
      };
      const getSetBool = (k, def) => {
        const row = (settingsRows.results || []).find(r => r.key === k);
        return row ? (row.value !== 'false') : def;
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
        autoDiligenceEnabled: getSetBool('AutoDiligenceEnabled', true)
      };

      return {
        success: true,
        period: period,
        latestActivePeriod: latestActivePeriod,
        workingDays: workingDays,
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
          totalNet: Math.round(totalNet * 100) / 100
        },
        users: users,
        branches: branchRows.results || [],
        companyHolidays: companyHolidays
      };
    }

    // 2.11 COMPANY HOLIDAYS MANAGEMENT
    case 'getCompanyHolidays': {
      const rows = await db.prepare('SELECT * FROM company_holidays ORDER BY date ASC').all().catch(() => ({ results: [] }));
      return { success: true, holidays: rows.results || [] };
    }

    case 'saveCompanyHoliday': {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_company')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการวันหยุดบริษัท' };

      const h = params.holiday || {};
      const date = String(h.date || '').trim();
      const name = String(h.holidayName || h.holiday_name || '').trim();
      const type = String(h.holidayType || h.holiday_type || 'COMPANY').trim();
      const note = String(h.note || '').trim();
      if (!date || !name) return { success: false, message: 'กรุณากรอกวันที่และชื่อวันหยุด' };

      await db.prepare(`
        INSERT INTO company_holidays (date, holiday_name, holiday_type, note)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET holiday_name=excluded.holiday_name, holiday_type=excluded.holiday_type, note=excluded.note
      `).bind(date, name, type, note).run();

      await logSystemActivity(db, callerUser, 'SAVE_HOLIDAY', `บันทึกวันหยุดบริษัท: ${date} (${name})`);
      await calculateAndSavePayroll(db, period);

      const updated = (await db.prepare('SELECT * FROM company_holidays ORDER BY date ASC').all().catch(() => ({ results: [] }))).results || [];
      return { success: true, holidays: updated, message: `บันทึกวันหยุด "${name}" (${date}) เรียบร้อยแล้ว` };
    }

    case 'deleteCompanyHoliday': {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_company')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการวันหยุดบริษัท' };

      const id = params.id;
      const date = params.date;
      if (id) {
        await db.prepare('DELETE FROM company_holidays WHERE id = ?').bind(id).run();
      } else if (date) {
        await db.prepare('DELETE FROM company_holidays WHERE date = ?').bind(date).run();
      }
      await logSystemActivity(db, callerUser, 'DELETE_HOLIDAY', `ลบวันหยุดบริษัท: ${id || date}`);
      await calculateAndSavePayroll(db, period);

      const updated = (await db.prepare('SELECT * FROM company_holidays ORDER BY date ASC').all().catch(() => ({ results: [] }))).results || [];
      return { success: true, holidays: updated, message: 'ลบวันหยุดเรียบร้อยแล้ว' };
    }

    // 2.1 SAVE PAYROLL DEFAULTS
    case 'savePayrollDefaults': {
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

      await calculateAndSavePayroll(db, period);
      await logSystemActivity(db, callerUser || 'Admin', 'SETTINGS_UPDATE', 'อัปเดตค่านโยบายและค่าเริ่มต้นการคำนวณเงินเดือน');
      return { success: true, message: 'บันทึกค่านโยบายและค่าเริ่มต้นระบบเงินเดือนเรียบร้อยแล้ว' };
    }

    // 3. PERIOD WORK DAYS
    case 'savePeriodWorkDays': {
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
    }

    case 'getActualWorkDays': {
      const dates = await getCutoffDatesForPeriod(db, period);
      const holidayDatesSet = await getCompanyHolidayDatesSet(db, dates.startDate, dates.endDate);
      const actualDays = getActualWorkingDaysInCutoff(dates.startDate, dates.endDate, holidayDatesSet);
      return { success: true, period: period, startDate: dates.startDate, endDate: dates.endDate, actualDays: actualDays, holidaysCount: holidayDatesSet.size };
    }

    // 4. EMPLOYEE MASTER CRUD
    case 'batchImportEmployees': {
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
    }

    case 'saveEmployee': {
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
      const diligenceAllowanceVal = (emp.diligenceAllowance !== undefined && emp.diligenceAllowance !== null && emp.diligenceAllowance !== '' && !isNaN(Number(emp.diligenceAllowance)))
        ? Number(emp.diligenceAllowance)
        : null;

      await db.prepare(`
        INSERT OR REPLACE INTO employees 
        (emp_id, full_name, nickname, citizen_id, phone, address, department, position, base_salary, bank_name, bank_account, birth_date, age, join_date, pf_rate, default_sso, default_tax, remark, status, probation_days, probation_end_date, photo_url, branch_id, allow_all_branches, is_ot_eligible, is_undertime_exempt, diligence_allowance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        diligenceAllowanceVal
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

        await calculateAndSavePayroll(db, period);
      }
      return { success: true, message: 'บันทึกข้อมูลพนักงานเรียบร้อยแล้ว' };
    }

    case 'deleteEmployee': {
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
    }

    case 'resetEmployeeDevice': {
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
    }

    // 5. MONTHLY INPUT CRUD & BATCH POPULATE
    case 'saveInputRecord': {
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
    }

    case 'deleteInputRecord': {
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
    }

    case 'batchDeleteInputRecords': {
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
    }

    case 'populateEmployeesToPeriod': {
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

      let added = 0;
      let nextNo = 0;

      for (const emp of employees) {
        if (emp.status === 'Resigned') continue;
        const joinDateStr = emp.join_date ? normalizeDateToIso(emp.join_date) : '';
        if (joinDateStr && joinDateStr > dates.endDate) continue; // Not started yet

        nextNo++;
        added++;

        const proRata = calculateNewHireProRataRatio(joinDateStr, dates.startDate, dates.endDate, holidayDatesSet);
        const contractBaseSal = Number(emp.base_salary) || 0;
        const effectiveBaseSal = proRata.isMidPeriod
          ? (Math.round((contractBaseSal * proRata.ratio) * 100) / 100)
          : contractBaseSal;

        const exist = existingMap[emp.emp_id] || {};
        let baseSal = effectiveBaseSal;
        if (exist.base_salary !== undefined && exist.base_salary !== null && Number(exist.base_salary) > 0) {
          if (proRata.isMidPeriod && Number(exist.base_salary) === contractBaseSal) {
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
        const advDed = Number(exist.advance_deduct) || 0;
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
    }

    // 5.1 SYNC ATTENDANCE, LEAVES, OT & ADVANCE FROM PTN TIME (ALL OR INDIVIDUAL)
    case 'syncFromPtnTime': {
      const callerUser = params.username || '';
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
      let missingHoursMap = {};
      let earlyDeductMap = {};
      let employeeHasLogs = {};
      let logsByEmpDate = {};
      let timeLogsList = [];
      let empLateMinutes = {};
      let empLateCount = {};
      try {
        let tlSql = `
          SELECT id, emp_id, date, clock_in, clock_out, break_out, break_in, work_hours, ot_hours, late_minutes, status, branch_id, is_full_pay, remark
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
          const origDays = Number(lr.days_count) || 1.0;
          let daysDeductedDueToWork = 0;

          // Check each date covered by this leave within cutoff window
          const sDate = String(lr.start_date || '').trim().substring(0, 10);
          const eDate = String(lr.end_date || '').trim().substring(0, 10);
          if (!sDate || !eDate) continue;

          let dCur = new Date(sDate + 'T00:00:00Z');
          const dEnd = new Date(eDate + 'T00:00:00Z');

          while (dCur <= dEnd) {
            const dStr = dCur.toISOString().substring(0, 10);
            if (dStr >= startDate && dStr <= endDate) {
              const tl = logsByEmpDate[`${lrEmpId}_${dStr}`] || logsByEmpDate[`${lr.emp_id}_${dStr}`];
              if (tl && tl.clock_in) {
                const branch = branchMap[tl.branch_id] || (emp ? branchMap[emp.branch_id] : null);
                const shiftHours = getShiftHoursForBranch(branch);
                const wHours = Number(tl.work_hours) || 0;

                // FULL WORK DAY: clocked out with sufficient hours, or work_hours >= (shiftHours - 1.0), or work_hours >= 6
                if ((tl.clock_out && wHours >= Math.max(6.0, shiftHours - 1.0)) || (tl.clock_out && wHours >= shiftHours * 0.75)) {
                  daysDeductedDueToWork += 1.0;
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
                    adjustedDeduction: 1.0,
                    note: `มีใบลา ${lr.leave_type} แต่วันนี้มาทำงานจริง ${wHours} ชม. (เต็มกะ)`
                  });
                } else if (wHours >= 3.5) {
                  // HALF WORK DAY: worked at least half day (3.5+ hrs)
                  daysDeductedDueToWork += 0.5;
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
                    adjustedDeduction: 0.5,
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
            d += Number(lr.days_count) || 1.0;
            if (lr.time_slot) timeSlot = String(lr.time_slot).toUpperCase();
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
        const lateMins = Number(row.late_minutes) || 0;

        const leaveInfo = getLeaveInfoOnDate(row.emp_id, row.date);
        const approvedLeaveDays = leaveInfo.days;
        const leaveSlot = leaveInfo.timeSlot;

        let coversMorning = (leaveSlot === 'FULL' && approvedLeaveDays >= 1.0) || leaveSlot === 'MORNING';
        let coversAfternoon = (leaveSlot === 'FULL' && approvedLeaveDays >= 1.0) || leaveSlot === 'AFTERNOON';
        if (!coversMorning && !coversAfternoon && approvedLeaveDays === 0.5) {
          if (inMin !== null && inMin >= lunchStart) coversMorning = true;
          else coversAfternoon = true;
        }

        if (coversMorning && coversAfternoon) continue; // Fully covered by approved leave

        const coveredHours = approvedLeaveDays * shiftHours;
        const targetHours = Math.max(0, shiftHours - coveredHours);

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
          // 1. หักตามนาทีสายจริง (Deduct strictly based on actual late minutes)
          let lateHours = 0;
          if (lateMins > 0 && !isMorningAbsence && !isAfternoonAbsence) {
            lateHours = Math.round((lateMins / 60) * 100) / 100;
            const lateDeductAmt = lateHours * hourlyRate;
            empLateMinutes[row.emp_id] = (empLateMinutes[row.emp_id] || 0) + lateMins;
            empLateCount[row.emp_id] = (empLateCount[row.emp_id] || 0) + 1;
            missingHoursMap[row.emp_id] = (missingHoursMap[row.emp_id] || 0) + lateHours;
            earlyDeductMap[row.emp_id] = (earlyDeductMap[row.emp_id] || 0) + lateDeductAmt;
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
              missingHoursMap[row.emp_id] = (missingHoursMap[row.emp_id] || 0) + earlyMissing;
              earlyDeductMap[row.emp_id] = (earlyDeductMap[row.emp_id] || 0) + (earlyMissing * hourlyRate);
            }
          }
        }
      }

      // 5. Merge into monthly_inputs & Evaluate Diligence Allowance
      const getSetVal = (k, def) => {
        const row = settingsList.find(r => r.key === k);
        return (row && row.value !== undefined && row.value !== null && !isNaN(Number(row.value))) ? Number(row.value) : def;
      };
      const fallbackOtRate = getSetVal('DefaultOtRate', 40);
      const diligenceAllowance = getSetVal('DiligenceAllowance', 1000);
      const diligenceLateGraceMins = getSetVal('DiligenceLateGraceMins', 2);
      const diligenceLateMaxCount = getSetVal('DiligenceLateMaxCount', 1);
      const autoDiligenceRow = settingsList.find(r => r.key === 'AutoDiligenceEnabled');
      const autoDiligenceEnabled = autoDiligenceRow ? (autoDiligenceRow.value !== 'false') : true;

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
        if (emp.status === 'Resigned' && !existingMap[emp.emp_id]) {
          continue;
        }
        const joinDateStr = emp.join_date ? normalizeDateToIso(emp.join_date) : '';
        if (joinDateStr && joinDateStr > endDate && !existingMap[emp.emp_id]) {
          continue; // Not started yet
        }

        if (!targetEmpId) {
          nextNo++;
        }
        syncedCount++;

        const proRata = calculateNewHireProRataRatio(joinDateStr, startDate, endDate, holidayDatesSet);
        const contractBaseSal = Number(emp.base_salary) || 0;
        const effectiveBaseSal = proRata.isMidPeriod
          ? (Math.round((contractBaseSal * proRata.ratio) * 100) / 100)
          : contractBaseSal;

        const exist = existingMap[emp.emp_id] || {};
        let baseSal = effectiveBaseSal;
        if (exist.base_salary !== undefined && exist.base_salary !== null && Number(exist.base_salary) > 0) {
          if (proRata.isMidPeriod && Number(exist.base_salary) === contractBaseSal) {
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
        if (emp.status !== 'Resigned') {
          const joinDateStr = emp.join_date ? normalizeDateToIso(emp.join_date) : null;
          for (const dStr of periodWorkingDates) {
            if (dStr > todayStr) continue; // Skip future dates in active/current period
            if (holidayDatesSet.has(dStr)) continue; // Skip company holidays
            if (joinDateStr && dStr < joinDateStr) continue; // Skip days before hire date

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
            if (!coversMorning && !coversAfternoon && approvedLeaveDays === 0.5) {
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

        const absentDays = Math.round(autoAbsentDays * 100) / 100;
        totalAbsentCount += absentDays;

        // Deduct missing hours / early departure based on actual workdays
        const calcEarlyDeduct = earlyDeductMap[emp.emp_id] !== undefined
          ? Math.round(earlyDeductMap[emp.emp_id] * 100) / 100
          : 0;

        let lateDeduct = Number(exist.late_deduct) || 0;
        if (calcEarlyDeduct > 0) {
          lateDeduct = calcEarlyDeduct;
        } else if (employeeHasLogs[emp.emp_id]) {
          lateDeduct = 0;
        }

        const lateMins = empLateMinutes[emp.emp_id] !== undefined
          ? empLateMinutes[emp.emp_id]
          : (Number(exist.late_minutes) || 0);

        const lateCnt = empLateCount[emp.emp_id] !== undefined
          ? empLateCount[emp.emp_id]
          : (Number(exist.late_count) || 0);

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
            if (calcEarlyDeduct > 0) {
              const mHrs = Math.round((missingHoursMap[emp.emp_id] || 0) * 100) / 100;
              empDisqualifyReasons.push(`ออกก่อนเวลา/ขาดช่วง ${mHrs} ชม.`);
            }

            // Check late arrivals in non-Sunday logs
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

              const lMins = Number(l.late_minutes) || 0;
              if (lMins > 0) {
                lateOccurrences++;
                if (lMins > diligenceLateGraceMins) {
                  excessiveLateDays.push(`วันที่ ${l.date.substring(8)} (สาย ${lMins} น. > เกณฑ์ ${diligenceLateGraceMins} น.)`);
                }
              }
            }

            if (excessiveLateDays.length > 0) {
              empDisqualifyReasons.push(`สายเกินเกณฑ์: ${excessiveLateDays.join(', ')}`);
            } else if (lateOccurrences > diligenceLateMaxCount) {
              empDisqualifyReasons.push(`มาสาย ${lateOccurrences} ครั้ง (เกินโควตา ${diligenceLateMaxCount} ครั้ง)`);
            }
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
    }

    // 5.1.5 REALTIME ALERTS & NOTIFICATIONS FOR ADMIN
    case 'getAdminRealtimeAlerts': {
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
    }

    // 5.2.1 DEDICATED LIGHTWEIGHT ATTENDANCE REQUESTS FOR APPROVALS CENTER TAB
    case 'getAttendanceRequests': {
      const callerUser = params.username || 'Admin';
      const isAllowed = await userHasPermission(db, callerUser, 'view_attendance');
      if (!isAllowed) {
        return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เข้าใช้งานระบบลงเวลา' };
      }

      const reqStatus = String(params.requestStatus || 'PENDING').toUpperCase(); // 'PENDING', 'APPROVED', 'REJECTED', 'ALL'
      const reqType = String(params.requestType || 'ALL').toUpperCase(); // 'ALL', 'LEAVE', 'OT', 'ADVANCE'
      const reqDateMode = String(params.requestDateMode || 'ALL').toUpperCase(); // 'ALL', 'SINGLE', 'MONTH', 'PERIOD', 'RANGE'
      const reqDate = params.requestDate ? String(params.requestDate).trim() : '';
      const reqMonth = params.requestMonth ? String(params.requestMonth).trim() : '';
      const reqPeriod = params.requestPeriod ? String(params.requestPeriod).trim() : '';
      const reqStartDate = params.requestStartDate ? String(params.requestStartDate).trim() : '';
      const reqEndDate = params.requestEndDate ? String(params.requestEndDate).trim() : '';
      const reqEmpFilter = String(params.requestEmpId || params.empId || 'ALL').trim();

      let reqCutoff = null;
      if (reqDateMode === 'PERIOD' && reqPeriod) {
        reqCutoff = await getCutoffDatesForPeriod(db, reqPeriod);
      }

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
      // Always exclude automated daily punch-clock OT records from approvals center
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

      // Sequential execution (ultra fast & zero Worker limit risk)
      let pendingLeaves = [];
      if (reqType === 'ALL' || reqType === 'LEAVE') {
        const r = await db.prepare(`SELECT lr.*, datetime(lr.created_at, '+7 hours') AS created_at, e.full_name, e.department FROM leave_requests lr LEFT JOIN employees e ON lr.emp_id = e.emp_id ${leaveWhere} ORDER BY lr.created_at DESC LIMIT 150`).bind(...leaveBinds).all().catch(() => ({ results: [] }));
        pendingLeaves = r.results || [];
      }

      let pendingOts = [];
      if (reqType === 'ALL' || reqType === 'OT') {
        const r = await db.prepare(`SELECT ot.*, datetime(ot.created_at, '+7 hours') AS created_at, e.full_name, e.department FROM ot_requests ot LEFT JOIN employees e ON ot.emp_id = e.emp_id ${otWhere} ORDER BY ot.created_at DESC LIMIT 150`).bind(...otBinds).all().catch(() => ({ results: [] }));
        pendingOts = r.results || [];
      }

      let pendingAdvances = [];
      if (reqType === 'ALL' || reqType === 'ADVANCE') {
        const r = await db.prepare(`SELECT ar.*, datetime(ar.created_at, '+7 hours') AS created_at, e.full_name, e.department FROM advance_requests ar LEFT JOIN employees e ON ar.emp_id = e.emp_id ${advWhere} ORDER BY ar.created_at DESC LIMIT 150`).bind(...advBinds).all().catch(() => ({ results: [] }));
        pendingAdvances = r.results || [];
      }

      return {
        success: true,
        pendingLeaves,
        pendingOts,
        pendingAdvances,
        reqCutoffDates: reqCutoff
      };
    }

    // 5.2 TIME ATTENDANCE ADMIN DASHBOARD (CENTRALIZED IN PAYROLL)
    case 'getTimeAttendanceDashboard': {
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
      const filterPeriod = params.period ? String(params.period).trim() : filterMonth;
      const startDate = params.startDate ? String(params.startDate).trim() : '';
      const endDate = params.endDate ? String(params.endDate).trim() : '';

      let cutoffInfo = null;
      if (dateMode === 'PERIOD') {
        cutoffInfo = await getCutoffDatesForPeriod(db, filterPeriod);
      }

      // 1.0 Employees list for search & selector
      const empRows = await db.prepare(`
        SELECT emp_id, full_name, nickname, department, position, branch_id, photo_url, phone
        FROM employees
        WHERE status != 'Resigned'
        ORDER BY emp_id ASC
      `).all().catch(() => ({ results: [] }));
      const employeeList = empRows.results || [];

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
        
        logsQuery = await db.prepare(`
          SELECT l.*, e.full_name, e.nickname, e.department, e.position, e.phone, e.photo_url, e.branch_id as emp_branch_id, b.branch_name
          FROM time_logs l
          LEFT JOIN employees e ON l.emp_id = e.emp_id
          LEFT JOIN branches b ON b.branch_id = COALESCE(l.branch_id, e.branch_id)
          WHERE l.emp_id = ? AND ${dateClause}
          ORDER BY l.date DESC, l.clock_in DESC
        `).bind(empFilter, ...dateBinds).all().catch(() => ({ results: [] }));

      } else {
        if (branchFilter && branchFilter !== 'ALL') {
          logsQuery = await db.prepare(`
            SELECT l.*, e.full_name, e.nickname, e.department, e.position, e.phone, e.photo_url, e.branch_id as emp_branch_id, b.branch_name
            FROM time_logs l
            LEFT JOIN employees e ON l.emp_id = e.emp_id
            LEFT JOIN branches b ON b.branch_id = COALESCE(l.branch_id, e.branch_id)
            WHERE ${dateClause} AND (l.branch_id = ? OR (l.branch_id IS NULL AND e.branch_id = ?))
            ORDER BY l.date DESC, l.clock_in DESC
            LIMIT 500
          `).bind(...dateBinds, branchFilter, branchFilter).all().catch(() => ({ results: [] }));
        } else {
          logsQuery = await db.prepare(`
            SELECT l.*, e.full_name, e.nickname, e.department, e.position, e.phone, e.photo_url, e.branch_id as emp_branch_id, b.branch_name
            FROM time_logs l
            LEFT JOIN employees e ON l.emp_id = e.emp_id
            LEFT JOIN branches b ON b.branch_id = COALESCE(l.branch_id, e.branch_id)
            WHERE ${dateClause}
            ORDER BY l.date DESC, l.clock_in DESC
            LIMIT 500
          `).bind(...dateBinds).all().catch(() => ({ results: [] }));
        }
      }
      const logsToday = logsQuery.results || [];

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
          if ((Number(l.late_minutes) || 0) > 0) {
            lateCount++;
            totalLateMinutes += Number(l.late_minutes || 0);
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
        }

        const appLeavesQ = await db.prepare(`
          SELECT SUM(COALESCE(days_count, 1)) as sum_days FROM leave_requests WHERE ${sumLeaveClause}
        `).bind(...sumBindsLeave).first().catch(() => null);
        const appAdvQ = await db.prepare(`
          SELECT SUM(amount) as sum_amount FROM advance_requests WHERE ${sumAdvClause}
        `).bind(...sumBindsAdv).first().catch(() => null);
        const appOtQ = await db.prepare(`
          SELECT SUM(actual_hours) as sum_ot FROM ot_requests WHERE ${sumOtClause}
        `).bind(...sumBindsOt).first().catch(() => null);

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

      const reqStatus = String(params.requestStatus || 'PENDING').toUpperCase();
      const reqType = String(params.requestType || 'ALL').toUpperCase(); // 'ALL', 'LEAVE', 'OT', 'ADVANCE'
      const reqDateMode = String(params.requestDateMode || (params.requestDate ? 'SINGLE' : 'ALL')).toUpperCase(); // 'ALL', 'SINGLE', 'MONTH', 'PERIOD', 'RANGE'
      const reqDate = params.requestDate ? String(params.requestDate).trim() : ''; // 'YYYY-MM-DD'
      const reqMonth = params.requestMonth ? String(params.requestMonth).trim() : ''; // 'YYYY-MM'
      const reqPeriod = params.requestPeriod ? String(params.requestPeriod).trim() : (reqMonth || filterPeriod);
      const reqStartDate = params.requestStartDate ? String(params.requestStartDate).trim() : '';
      const reqEndDate = params.requestEndDate ? String(params.requestEndDate).trim() : '';

      let reqCutoff = null;
      if (reqDateMode === 'PERIOD') {
        reqCutoff = await getCutoffDatesForPeriod(db, reqPeriod);
      }

      // 2. Prepare WHERE clauses for Requests (Leaves, OTs, Advances)
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

      const otConds = [];
      const otBinds = [];
      // Always exclude automated daily punch-clock OT records from approvals center
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

      // 3. EXECUTE INDEPENDENT QUERIES SEQUENTIALLY TO PREVENT CLOUDFLARE WORKER RESOURCE LIMIT (ERROR 1102 / 503)
      const branchRows = await db.prepare('SELECT * FROM branches ORDER BY branch_id ASC').all().catch(() => ({ results: [] }));
      const leavesQuery = (reqType === 'ALL' || reqType === 'LEAVE')
        ? await db.prepare(`SELECT lr.*, datetime(lr.created_at, '+7 hours') AS created_at, e.full_name, e.department FROM leave_requests lr LEFT JOIN employees e ON lr.emp_id = e.emp_id ${leaveWhere} ORDER BY lr.created_at DESC LIMIT 100`).bind(...leaveBinds).all().catch(() => ({ results: [] }))
        : { results: [] };
      const otsQuery = (reqType === 'ALL' || reqType === 'OT')
        ? await db.prepare(`SELECT ot.*, datetime(ot.created_at, '+7 hours') AS created_at, e.full_name, e.department FROM ot_requests ot LEFT JOIN employees e ON ot.emp_id = e.emp_id ${otWhere} ORDER BY ot.created_at DESC LIMIT 100`).bind(...otBinds).all().catch(() => ({ results: [] }))
        : { results: [] };
      const advQuery = (reqType === 'ALL' || reqType === 'ADVANCE')
        ? await db.prepare(`SELECT ar.*, datetime(ar.created_at, '+7 hours') AS created_at, e.full_name, e.department FROM advance_requests ar LEFT JOIN employees e ON ar.emp_id = e.emp_id ${advWhere} ORDER BY ar.created_at DESC LIMIT 100`).bind(...advBinds).all().catch(() => ({ results: [] }))
        : { results: [] };
      const approvedLeavesOnDate = await db.prepare(`SELECT lr.*, e.full_name, e.nickname, e.phone FROM leave_requests lr LEFT JOIN employees e ON lr.emp_id = e.emp_id WHERE UPPER(TRIM(lr.status)) = 'APPROVED' AND ? >= substr(lr.start_date, 1, 10) AND ? <= substr(lr.end_date, 1, 10)`).bind(targetDate, targetDate).all().catch(() => ({ results: [] }));
      const pendingCountRow = await db.prepare(`SELECT (SELECT COUNT(*) FROM leave_requests WHERE status = 'PENDING') + (SELECT COUNT(*) FROM ot_requests WHERE status = 'PENDING' AND (COALESCE(reason, '') NOT LIKE '%OT งานเสร็จประจำวัน%' AND COALESCE(reason, '') NOT LIKE '%(Admin ปรับปรุงเวลา)%' AND COALESCE(reason, '') NOT LIKE '%(HR ลงเวลาแทน)%')) + (SELECT COUNT(*) FROM advance_requests WHERE status = 'PENDING') as total_pending`).first().catch(() => ({ total_pending: 0 }));
      const setRows = await db.prepare('SELECT key, value FROM attendance_settings').all().catch(() => ({ results: [] }));

      const branches = branchRows.results || [];
      const pendingLeaves = leavesQuery.results || [];
      const pendingOts = otsQuery.results || [];
      const pendingAdvances = advQuery.results || [];
      const pendingApprovals = pendingCountRow?.total_pending || 0;

      // 4. Map approved leaves on targetDate and check conflicts
      const leaveOnTargetDateMap = {};
      for (const lr of (approvedLeavesOnDate.results || [])) {
        const k = String(lr.emp_id || '').trim();
        if (k) leaveOnTargetDateMap[k] = lr;
        leaveOnTargetDateMap[lr.emp_id] = lr;
      }
      for (const l of logsToday) {
        if (leaveOnTargetDateMap[l.emp_id]) {
          const lr = leaveOnTargetDateMap[l.emp_id];
          l.has_leave_conflict = true;
          l.leave_conflict_info = {
            leave_type: lr.leave_type,
            days_count: lr.days_count,
            reason: lr.reason || ''
          };
        }
      }

      // 5. KPI & Attendance Breakdown for All 5 Cards
      const branchMap = {};
      for (const b of branches) branchMap[b.branch_id] = b;

      const activeEmps = (branchFilter && branchFilter !== 'ALL')
        ? employeeList.filter(e => e.branch_id === branchFilter)
        : employeeList;

      // Map logs on targetDate
      const targetLogsMap = {};
      const clockedInList = [];
      const lateList = [];

      for (const log of logsToday) {
        if (log.clock_in && (!log.date || log.date === targetDate)) {
          if (!targetLogsMap[log.emp_id]) {
            targetLogsMap[log.emp_id] = log;
          }
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
            lateMinutes: Number(log.late_minutes || 0),
            status: log.status || 'NORMAL',
            phone: log.phone || ''
          });

          if ((Number(log.late_minutes) || 0) > 0) {
            const bInfo = branchMap[log.branch_id || log.emp_branch_id] || {};
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
              lateMinutes: Number(log.late_minutes || 0),
              shiftStart: bInfo.work_start_time || '09:30',
              phone: log.phone || ''
            });
          }
        }
      }

      // Unclocked employees (Active employees who did NOT clock in on targetDate)
      const notClockedInList = [];
      for (const emp of activeEmps) {
        if (!targetLogsMap[emp.emp_id]) {
          const empBranch = branchMap[emp.branch_id] || {};
          const branchName = empBranch.branch_name || emp.branch_id || 'สำนักงานใหญ่';
          const shiftStart = empBranch.work_start_time || '09:30';
          const shiftEnd = empBranch.work_end_time || '19:00';
          const lr = leaveOnTargetDateMap[emp.emp_id];

          notClockedInList.push({
            empId: emp.emp_id,
            name: emp.full_name || '',
            nickname: emp.nickname || '',
            dept: emp.department || '',
            position: emp.position || '',
            branchId: emp.branch_id || 'B01',
            branchName: branchName,
            phone: emp.phone || '',
            photoUrl: emp.photo_url || '',
            shiftStart: shiftStart,
            shiftEnd: shiftEnd,
            shiftText: `${shiftStart} - ${shiftEnd} น.`,
            hasLeave: Boolean(lr),
            leaveType: lr ? (lr.leave_type || 'ลาหยุด') : null,
            leaveReason: lr ? (lr.reason || '') : null,
            leaveDays: lr ? (lr.days_count || 1) : 0,
            medicalCertUrl: lr ? (lr.medical_cert_url || null) : null,
            type: lr ? 'LEAVE' : 'NO_EXCUSE'
          });
        }
      }

      // Branch staffing summary
      const branchSummary = branches.map(b => {
        const bEmps = employeeList.filter(e => e.branch_id === b.branch_id);
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
          branchSummary
        }
      };
    }

    // 5.2.5 ATTENDANCE PERIOD SUMMARY & REPORTS (ALL EMPLOYEES & INDIVIDUAL)
    case 'getAttendancePeriodSummary': {
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
      const holidaysRows = await db.prepare('SELECT * FROM company_holidays ORDER BY date ASC').all().catch(() => ({ results: [] }));
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

      // Load Employees (Include all active working staff: Active, Probation, etc.)
      let empSql = "SELECT emp_id, full_name, nickname, department, position, branch_id, base_salary, is_ot_eligible, diligence_allowance, status, join_date FROM employees WHERE (status IS NULL OR UPPER(TRIM(status)) != 'RESIGNED')";
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
      let tlSql = "SELECT id, emp_id, date, clock_in, clock_out, break_out, break_in, work_hours, ot_hours, late_minutes, status, branch_id, is_full_pay, remark FROM time_logs WHERE date BETWEEN ? AND ? ORDER BY date ASC, clock_in ASC";
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
      const setQuery = await db.prepare("SELECT key, value FROM settings WHERE key IN ('DiligenceAllowance', 'DiligenceLateGraceMins', 'DiligenceLateMaxCount', 'AutoDiligenceEnabled')").all().catch(() => ({ results: [] }));
      const setMap = {};
      for (const r of (setQuery.results || [])) setMap[r.key] = r.value;
      const fallbackAllowance = !isNaN(Number(setMap['DiligenceAllowance'])) ? Number(setMap['DiligenceAllowance']) : 1000;
      const graceMins = !isNaN(Number(setMap['DiligenceLateGraceMins'])) ? Number(setMap['DiligenceLateGraceMins']) : 2;
      const maxLateCount = !isNaN(Number(setMap['DiligenceLateMaxCount'])) ? Number(setMap['DiligenceLateMaxCount']) : 1;
      const autoDiligenceEnabled = setMap['AutoDiligenceEnabled'] !== 'false';

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

        for (const dateStr of workingDates) {
          const log = empLogs[dateStr];
          let statusText = 'ปกติ';
          let statusColor = '#16a34a';
          let isPresent = false;
          let isLeave = false;
          let isAbsent = false;
          let isHoliday = false;
          let curLateMins = 0;
          let curOtHrs = 0;
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
              // Legacy 0.5 without slot: covers whichever half employee did not work
              if (log && log.clock_in) {
                const inM = timeStringToMinutes(log.clock_in);
                if (inM !== null && inM >= lunchStart) coversMorning = true;
                else coversAfternoon = true;
              } else {
                coversMorning = true;
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
              presentDays++;
              curLateMins = Number(log.late_minutes) || 0;
              if (curLateMins > 0) {
                lateTimes++;
                lateMinutes += curLateMins;
                statusText = `สาย ${curLateMins} น.`;
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
            } else if (dateStr < today) {
              isAbsent = true;
              absentDays += 1.0;
              statusText = 'ขาดงาน';
              statusColor = '#dc2626';
              currentlyAbsentSequence = true;
            } else if (dateStr === today) {
              statusText = 'ยังไม่ลงเวลา';
              statusColor = '#94a3b8';
              if (currentlyAbsentSequence) {
                absentTimes++;
                currentlyAbsentSequence = false;
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
            lateMinutes: curLateMins,
            otHours: curOtHrs,
            statusText,
            statusColor,
            isPresent,
            isLeave,
            isAbsent,
            isHoliday,
            holidayName: holidayInfo ? holidayInfo.holiday_name : '',
            remark: (log && log.remark) ? log.remark : ''
          });
        }

        if (currentlyAbsentSequence) {
          absentTimes++;
          currentlyAbsentSequence = false;
        }

        // Calculate leave counts
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
            daysInCutoff = Number(lr.days_count);
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
            if (rec.lateMinutes > graceMins && !rec.isHoliday) {
              disqualifyReasons.push(`สายเกินเกณฑ์ วันที่ ${rec.date.substring(8)} (${rec.lateMinutes} นาที > ${graceMins} นาที)`);
              break;
            }
          }

          if (disqualifyReasons.length > 0) {
            isDiligenceQualified = false;
          }
        }

        const empRow = {
          no: i + 1,
          empId: emp.emp_id,
          fullName: emp.full_name || emp.emp_id,
          nickname: emp.nickname || '-',
          branchId: emp.branch_id || '-',
          branchName: branch.branch_name || '-',
          position: emp.position || '-',
          department: emp.department || '-',
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
          isDiligenceQualified,
          diligenceAmount: isDiligenceQualified ? targetAllowance : 0,
          diligenceDisqualifyReason: disqualifyReasons.join(', '),
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
        branchId: branchId || 'ALL',
        branches,
        grandTotals,
        summaryList,
        companyHolidays
      };
    }

    // 5.3 HANDLE ATTENDANCE APPROVALS (LEAVE, OT, ADVANCE)
    case 'handleAttendanceApproval': {
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
        if (type === 'leave') {
          await db.prepare('DELETE FROM leave_requests WHERE id = ?').bind(id).run();
        } else if (type === 'ot') {
          await db.prepare('DELETE FROM ot_requests WHERE id = ?').bind(id).run();
        } else if (type === 'advance') {
          await db.prepare('DELETE FROM advance_requests WHERE id = ?').bind(id).run();
        }
        await logSystemActivity(db, approverId, 'DELETE_ATTENDANCE_REQUEST', `ลบคำขอ ${type} (ID: ${id})`);
        return { success: true, message: `ลบคำขอ ${type} ออกจากระบบเรียบร้อยแล้ว` };
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
    }

    // 5.3.1 DELETE ATTENDANCE REQUEST (PERMANENT DELETE FOR LEAVE, OT, ADVANCE)
    case 'deleteAttendanceRequest': {
      const callerUser = params.username || 'Admin';
      const allowed = await userHasPermission(db, callerUser, 'approve_attendance');
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ลบคำขอ' };

      const { type, id } = params;
      if (!type || !id) return { success: false, message: 'ระบุ type และ id' };

      if (type === 'leave') {
        await db.prepare('DELETE FROM leave_requests WHERE id = ?').bind(id).run();
      } else if (type === 'ot') {
        await db.prepare('DELETE FROM ot_requests WHERE id = ?').bind(id).run();
      } else if (type === 'advance') {
        await db.prepare('DELETE FROM advance_requests WHERE id = ?').bind(id).run();
      } else {
        return { success: false, message: 'ประเภทคำขอไม่ถูกต้อง' };
      }

      await logSystemActivity(db, callerUser, 'DELETE_ATTENDANCE_REQUEST', `ลบคำขอ ${type} ID: ${id}`);
      return { success: true, message: `ลบคำขอ ${type} ออกจากระบบเรียบร้อยแล้ว` };
    }

    // 5.3.2 UPDATE ATTENDANCE REQUEST (EDIT DETAILS FOR LEAVE, OT, ADVANCE)
    case 'updateAttendanceRequest': {
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
    }

    // 5.3.5 CREATE ATTENDANCE REQUEST (LEAVE, OT, ADVANCE ON BEHALF OF EMPLOYEE)
    case 'createAttendanceRequest': {
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
    }

    // 5.4 GET MASTER UNLOCK QR TOKEN
    case 'getMasterUnlockQr': {
      const token = await getMasterUnlockToken(0);
      const secondsLeft = 60 - (Math.floor(Date.now() / 1000) % 60);
      return {
        success: true,
        token,
        secondsLeft
      };
    }

    // 5.4.1 BRANCH MANAGEMENT (MULTI-BRANCH)
    case 'getBranches': {
      const branches = (await db.prepare('SELECT * FROM branches ORDER BY branch_id ASC').all()).results || [];
      return { success: true, branches };
    }

    case 'saveBranch': {
      const callerUser = params.username || 'Admin';
      const allowed = await userHasPermission(db, callerUser, 'manage_attendance_settings');
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการสาขา' };

      const b = params.branch || {};
      const branchId = String(b.branch_id || b.branchId || '').trim();
      const branchName = String(b.branch_name || b.branchName || '').trim();
      if (!branchId || !branchName) return { success: false, message: 'กรุณาระบุรหัสและชื่อสาขา' };

      const lat = Number(b.lat) || 13.727896;
      const lng = Number(b.lng) || 100.524123;
      const radius = Number(b.radius_meters || b.radiusMeters) || 200;
      const workStart = String(b.work_start_time || b.workStartTime || '09:30').trim();
      const workEnd = String(b.work_end_time || b.workEndTime || '19:00').trim();
      const lunchStart = String(b.lunch_start_time || b.lunchStartTime || '13:00').trim();
      const lunchEnd = String(b.lunch_end_time || b.lunchEndTime || '14:00').trim();
      const grace = Number(b.grace_minutes || b.graceMinutes) || 0;
      const otStart = String(b.ot_start_time || b.otStartTime || workEnd).trim();
      const kioskPin = String(b.kiosk_pin || b.kioskPin || '123456').trim();
      const status = String(b.status || 'ACTIVE').toUpperCase();

      await db.prepare(`
        INSERT INTO branches (branch_id, branch_name, lat, lng, radius_meters, work_start_time, work_end_time, lunch_start_time, lunch_end_time, grace_minutes, ot_start_time, kiosk_pin, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(branch_id) DO UPDATE SET
          branch_name = excluded.branch_name,
          lat = excluded.lat,
          lng = excluded.lng,
          radius_meters = excluded.radius_meters,
          work_start_time = excluded.work_start_time,
          work_end_time = excluded.work_end_time,
          lunch_start_time = excluded.lunch_start_time,
          lunch_end_time = excluded.lunch_end_time,
          grace_minutes = excluded.grace_minutes,
          ot_start_time = excluded.ot_start_time,
          kiosk_pin = excluded.kiosk_pin,
          status = excluded.status
      `).bind(branchId, branchName, lat, lng, radius, workStart, workEnd, lunchStart, lunchEnd, grace, otStart, kioskPin, status).run();

      // If B01, keep global attendance_settings in sync
      if (branchId === 'B01') {
        const syncMap = {
          work_start_time: workStart,
          work_end_time: workEnd,
          lunch_start_time: lunchStart,
          lunch_end_time: lunchEnd,
          ot_start_time: otStart,
          office_lat: lat,
          office_lng: lng,
          geofence_radius_meters: radius,
          kiosk_pin: kioskPin
        };
        for (const [k, v] of Object.entries(syncMap)) {
          await db.prepare("INSERT INTO attendance_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, String(v)).run().catch(() => {});
        }
      }

      await logSystemActivity(db, callerUser, 'SAVE_BRANCH', `บันทึกข้อมูลสาขา [${branchId}] ${branchName} (${workStart}-${workEnd})`);
      return { success: true, message: `บันทึกข้อมูลสาขา [${branchId}] ${branchName} เรียบร้อยแล้ว` };
    }

    case 'deleteBranch': {
      const callerUser = params.username || 'Admin';
      const allowed = await userHasPermission(db, callerUser, 'manage_attendance_settings');
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ลบสาขา' };

      const branchId = String(params.branchId || params.branch_id || '').trim();
      if (!branchId) return { success: false, message: 'กรุณาระบุรหัสสาขาที่ต้องการลบ' };

      const countRow = await db.prepare('SELECT COUNT(*) as count FROM branches').first();
      if (countRow && countRow.count <= 1) {
        return { success: false, message: 'ไม่สามารถลบสาขาสุดท้ายได้' };
      }

      await db.prepare('DELETE FROM branches WHERE branch_id = ?').bind(branchId).run();
      await logSystemActivity(db, callerUser, 'DELETE_BRANCH', `ลบข้อมูลสาขา [${branchId}]`);
      return { success: true, message: `ลบสาขา ${branchId} เรียบร้อยแล้ว` };
    }

    // Toggle Branch Early Dismissal Mode (โหมดงานเสร็จ - จ่ายเต็มวัน)
    case 'toggleBranchEarlyDismissal': {
      const callerUser = params.username || 'Admin';
      const allowed = (await userHasPermission(db, callerUser, 'manage_attendance_settings')) || (await userHasPermission(db, callerUser, 'approve_attendance'));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการสาขา' };

      const branchId = String(params.branchId || params.branch_id || '').trim();
      const enabled = (params.enabled === true || params.enabled === 'true' || params.enabled === 1 || params.enabled === '1') ? 1 : 0;
      if (!branchId) return { success: false, message: 'กรุณาระบุรหัสสาขา' };

      await db.prepare('ALTER TABLE branches ADD COLUMN early_dismissal_full_pay INTEGER DEFAULT 0').run().catch(() => {});
      await db.prepare('UPDATE branches SET early_dismissal_full_pay = ? WHERE branch_id = ?').bind(enabled, branchId).run();

      const branch = await db.prepare('SELECT branch_name FROM branches WHERE branch_id = ?').bind(branchId).first();
      const branchName = branch?.branch_name || branchId;
      const statusText = enabled ? 'เปิดโหมดงานเสร็จ-เลิกงานก่อน (จ่ายค่าแรงเต็มวัน)' : 'ปิดโหมดงานเสร็จ (กลับสู่โหมดปกติ)';

      await logSystemActivity(db, callerUser, 'TOGGLE_EARLY_DISMISSAL', `${statusText} สำหรับสาขา [${branchId}] ${branchName}`);
      return { 
        success: true, 
        branchId, 
        enabled: enabled === 1,
        message: `${statusText} สำหรับสาขา ${branchName} เรียบร้อยแล้ว` 
      };
    }

    // 5.4.2 GET ATTENDANCE LOGS FOR DATE RANGE (EXPORT)
    case 'getAttendanceLogsRange': {
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
        SELECT l.*, e.full_name, e.nickname, e.department, e.position, e.branch_id as emp_branch_id
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

      const query = await db.prepare(sql).bind(...binds).all().catch(() => ({ results: [] }));
      const holidaysQuery = await db.prepare('SELECT * FROM company_holidays ORDER BY date ASC').all().catch(() => ({ results: [] }));

      return {
        success: true,
        logs: query.results || [],
        holidays: holidaysQuery.results || [],
        startDate,
        endDate,
        branchId: branchFilter
      };
    }

    // 5.5 SAVE ATTENDANCE SETTINGS
    case 'saveAttendanceSettings': {
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
    }

    // 5.5.1 BROADCAST PAYSLIP NOTIFICATION
    case 'broadcastPayslipNotification': {
      const callerUser = params.username || 'Admin';
      const allowed = await userHasPermission(db, callerUser, 'calc_payroll') || await isUserSuperAdmin(db, callerUser);
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ส่งการแจ้งเตือนสลิปเงินเดือน' };

      const period = params.period ? String(params.period).trim() : 'ล่าสุด';
      const title = params.title || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
      const body = params.body || `เงินเดือนงวด ${period}  เช็กสลิปออนไลน์ได้ทันที`;

      await db.prepare(`
        CREATE TABLE IF NOT EXISTS broadcast_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          tag TEXT DEFAULT 'payslip',
          target_emp_id TEXT DEFAULT 'ALL',
          period TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run().catch(() => {});

      await db.prepare(`
        INSERT INTO broadcast_notifications (title, body, tag, target_emp_id, period)
        VALUES (?, ?, 'payslip', 'ALL', ?)
      `).bind(title, body, period).run();

      // Dispatch Web Push to all registered devices
      let sentCount = 0;
      let expiredCount = 0;
      try {
        const subs = (await db.prepare('SELECT * FROM push_subscriptions').all().catch(() => ({ results: [] }))).results || [];
        for (const sub of subs) {
          const pushRes = await sendWebPush(sub, {
            title: title,
            body: body,
            url: '/?tab=payroll',
            tag: 'payslip-' + period
          });
          if (pushRes.success) {
            sentCount++;
          } else if (pushRes.expired) {
            expiredCount++;
            await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run().catch(() => {});
          }
        }
      } catch(pushErr) {
        console.error('Broadcast push error:', pushErr);
      }

      await logSystemActivity(db, callerUser, 'BROADCAST_PAYSLIP', `ส่งการแจ้งเตือนสลิปเงินเดือนงวด ${period} (Web Push: ${sentCount} เครื่อง)`);

      return {
        success: true,
        period,
        title,
        body,
        sentCount,
        message: `ส่งการแจ้งเตือนสลิปเงินเดือนงวด ${period} สำเร็จ (ส่งแจ้งเตือน Web Push ไปยัง ${sentCount} อุปกรณ์)`
      };
    }

    // 5.5.2 WEB PUSH NOTIFICATION CONTROLLERS
    case 'getVapidPublicKey': {
      return {
        success: true,
        publicKey: VAPID_PUBLIC_KEY
      };
    }

    case 'savePushSubscription': {
      const { empId, endpoint, p256dh, auth, userAgent, appType } = params;
      if (!endpoint || !p256dh || !auth) {
        return { success: false, message: 'ข้อมูล Subscription ไม่ครบถ้วน' };
      }

      const finalAppType = appType || 'PAYROLL';
      await db.prepare(`
        INSERT INTO push_subscriptions (emp_id, endpoint, p256dh, auth, user_agent, app_type, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(endpoint) DO UPDATE SET
          emp_id = COALESCE(excluded.emp_id, push_subscriptions.emp_id),
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          user_agent = excluded.user_agent,
          app_type = excluded.app_type,
          updated_at = datetime('now')
      `).bind(empId || null, endpoint, p256dh, auth, userAgent || '', finalAppType).run();

      return { success: true, message: 'บันทึกอุปกรณ์เพื่อรับการแจ้งเตือน Web Push สำเร็จ' };
    }

    case 'removePushSubscription': {
      const endpoint = params.endpoint;
      if (endpoint) {
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
      }
      return { success: true, message: 'ยกเลิกการรับแจ้งเตือนบนอุปกรณ์นี้เรียบร้อยแล้ว' };
    }

    case 'getPushSubscriptionStatus': {
      const countRow = await db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').first().catch(() => ({ count: 0 }));
      return {
        success: true,
        totalSubscribers: countRow ? Number(countRow.count) : 0
      };
    }

    case 'sendTestPushNotification': {
      const callerUser = params.username || 'Admin';
      const endpoint = params.endpoint;
      let subs = [];

      if (endpoint) {
        const row = await db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).first();
        if (row) subs.push(row);
      }
      if (subs.length === 0) {
        subs = (await db.prepare('SELECT * FROM push_subscriptions').all().catch(() => ({ results: [] }))).results || [];
      }

      if (subs.length === 0) {
        return {
          success: false,
          message: 'ยังไม่มีอุปกรณ์ที่ลงทะเบียนรับแจ้งเตือน กรุณากดปุ่มเปิดรับการแจ้งเตือนบนอุปกรณ์นี้ก่อน'
        };
      }

      const testPayload = {
        title: '🔔 ทดสอบระบบการแจ้งเตือน PTN',
        body: 'ระบบ Web Push Notification เชื่อมต่อและทำงานสมบูรณ์แบบแล้ว!',
        url: '/',
        tag: 'ptn-test-' + Date.now()
      };

      let successCount = 0;
      for (const s of subs) {
        const res = await sendWebPush(s, testPayload);
        if (res.success) {
          successCount++;
        } else if (res.expired) {
          await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(s.endpoint).run().catch(() => {});
        }
      }

      await logSystemActivity(db, callerUser, 'TEST_WEB_PUSH', `ทดสอบส่ง Web Push สำเร็จ ${successCount} อุปกรณ์`);

      return {
        success: true,
        sentCount: successCount,
        message: `ส่งการแจ้งเตือนทดสอบสำเร็จไปยัง ${successCount} อุปกรณ์ (เด้งเตือนทันทีภายใน 1-3 วินาที)`
      };
    }

    // 5.5.9 ADD TIME LOG (MANUAL ENTRY BY ADMIN / HR)
    case 'addAttendanceLog': {
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

          if (inMin !== null) {
            if (inMin > (startMin + graceMin)) {
              finalLateMinutes = inMin - startMin;
            } else {
              finalLateMinutes = 0;
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
                finalWorkHours = Math.max(0, Math.round(((endMin - startMin - finalBreakMinutes) / 60) * 10) / 10) || 8.5;
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
      return {
        success: true,
        id: savedId,
        workHours: finalWorkHours,
        otHours: finalOtHours,
        message: `เพิ่มการลงเวลาให้ ${empRow.full_name} วันที่ ${date} สำเร็จ (ชั่วโมงทำงาน: ${finalWorkHours} ชม.${finalOtHours > 0 ? ' + OT: ' + finalOtHours + ' ชม.' : ''})`
      };
    }

    // 5.6 UPDATE TIME LOG
    case 'updateAttendanceLog': {
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

      // Recalculate late minutes dynamically if clockIn is provided
      if (inMin !== null) {
        if (inMin > (startMin + graceMin)) {
          finalLateMinutes = inMin - startMin;
        } else {
          finalLateMinutes = 0;
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
              finalWorkHours = Math.max(0, Math.round(((endMin - startMin - finalBreakMinutes) / 60) * 10) / 10) || 8.5;
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
        clockIn || null,
        clockOut || null,
        breakOut || null,
        breakIn || null,
        finalBreakMinutes,
        overbreakMinutes !== undefined && overbreakMinutes !== null ? Number(overbreakMinutes) : 0,
        finalLateMinutes,
        finalWorkHours,
        finalOtHours,
        finalStatus,
        remark || '',
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
    }

    // 5.7 DELETE TIME LOG
    case 'deleteAttendanceLog': {
      const callerUser = params.username || 'Admin';
      const allowed = (await userHasPermission(db, callerUser, 'approve_attendance')) || (await userHasPermission(db, callerUser, 'manage_attendance_settings'));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ลบข้อมูลลงเวลา' };

      const { id } = params;
      if (!id) return { success: false, message: 'ไม่พบรหัสรายการที่ต้องการลบ' };

      await db.prepare('DELETE FROM time_logs WHERE id = ?').bind(id).run();
      await logSystemActivity(db, callerUser, 'DELETE_TIME_LOG', `ลบข้อมูลการลงเวลา ID: ${id}`);
      return { success: true, message: 'ลบรายการบันทึกเวลาเรียบร้อยแล้ว' };
    }

    // 5.8 BATCH DELETE TIME LOGS
    case 'batchDeleteAttendanceLogs': {
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
    }

    // 6. PROCESS PAYROLL
    case 'processPayroll': {
      const callerUser = params.currentUsername || params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'calc_payroll')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ประมวลผลเงินเดือน' };
      if (await isPeriodLocked(db, period)) {
        return { success: false, message: `งวดประจำเดือน ${period} ถูกปิดและล็อคแล้ว ผลการคำนวณถูกล็อคถาวร ไม่อนุญาตให้คำนวณใหม่ กรุณาปลดล็อคงวดก่อนดำเนินการ` };
      }

      const count = await calculateAndSavePayroll(db, period);
      await logSystemActivity(db, callerUser || 'Admin', 'CALC_PAYROLL', `ประมวลผลคำนวณเงินเดือนงวด ${period} (${count} รายการ)`);
      return { success: true, period: period, count: count, message: `ประมวลผลคำนวณเงินเดือนงวด ${period} สำเร็จ (${count} รายการ)` };
    }

    // 7. EMPLOYEE HISTORY
        // 7.1 GET ALL EMPLOYEES HISTORY
        // 7.2 GET YEARLY SUMMARY (1 ROW PER EMPLOYEE)
    case 'getYearlySummary': {
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
    }

    case 'getAllEmployeeHistory': {
      const calcs = (await db.prepare('SELECT * FROM payroll_calcs ORDER BY period DESC, emp_id ASC').all()).results || [];
      const inputs = (await db.prepare('SELECT * FROM monthly_inputs ORDER BY period DESC, emp_id ASC').all()).results || [];
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

      const allRecords = calcs.map(c => {
        const inp = inputMap[`${c.period}_${c.emp_id}`] || {};
        const emp = empMap[c.emp_id] || {};
        return {
          period: c.period,
          empId: c.emp_id,
          fullName: c.full_name || emp.full_name || '',
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
      });

      return { success: true, allHistory: allRecords, branches, advanceStats };
    }

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
    }

    // 8. COMPANY INFO
    // 12. AI PAYROLL ASSISTANT (POWERED BY GOOGLE GEMINI 3.6 FLASH)
    case 'testGeminiApiKey': {
      const apiKey = (params.apiKey || '').trim();
      if (!apiKey) return { success: false, message: 'กรุณาระบุ API Key' };
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'สวัสดี ทดสอบการเชื่อมต่อ' }] }] })
        });
        const data = await res.json();
        if (data.candidates && data.candidates[0]) {
          return { success: true, message: 'เชื่อมต่อ Google Gemini 3.6 Flash สำเร็จสมบูรณ์ 🟢' };
        } else {
          const errMsg = data.error?.message || 'ไม่สามารถเชื่อมต่อได้';
          return { success: false, message: 'การเชื่อมต่อล้มเหลว: ' + errMsg };
        }
      } catch(e) {
        return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + e.message };
      }
    }

    case 'askAiAssistant': {
      const userMsg = (params.message || '').trim();
      const currentPeriod = period;
      const currentUser = params.user || {};
      const userRole = currentUser.role || 'User';
      const perms = currentUser.permissions || [];
      const canViewSalary = (currentUser.username === 'admin' || userRole.indexOf('Admin') >= 0 || perms.includes('all') || perms.includes('view_salary'));

      if (!userMsg) {
        return { success: false, message: 'กรุณาระบุคำถาม' };
      }

      // Gather Live Data Context from D1
      const employees = (await db.prepare('SELECT * FROM employees ORDER BY emp_id ASC').all()).results || [];
      const calcs = (await db.prepare('SELECT * FROM payroll_calcs WHERE period = ?').bind(currentPeriod).all()).results || [];
      const inputs = (await db.prepare('SELECT * FROM monthly_inputs WHERE period = ?').bind(currentPeriod).all()).results || [];
      const compName = (await db.prepare('SELECT value FROM settings WHERE key = "CompanyName"').first())?.value || 'บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด';
      const isPeriodClosed = (await db.prepare('SELECT value FROM settings WHERE key = ?').bind(`Period_Status_${currentPeriod}`).first())?.value?.startsWith('CLOSED') || false;

      // Department Aggregation
      const deptCounts = {};
      employees.forEach(e => {
        const d = e.department || 'ไม่ระบุ';
        deptCounts[d] = (deptCounts[d] || 0) + 1;
      });

      // Calculate totals for current period
      const totalEmployees = employees.length;
      const totalGross = calcs.reduce((a, b) => a + Number(b.gross_pay || 0), 0);
      const totalDeductions = calcs.reduce((a, b) => a + Number(b.total_deductions || 0), 0);
      const totalNet = calcs.reduce((a, b) => a + Number(b.net_pay || 0), 0);
      const totalOtPay = calcs.reduce((a, b) => a + Number(b.ot_pay || 0), 0);
      const totalOtHours = inputs.reduce((a, b) => a + Number(b.ot_hours || 0), 0);
      const totalAllowance = calcs.reduce((a, b) => a + Number(b.allowance || 0), 0);
      const totalBonus = calcs.reduce((a, b) => a + Number(b.bonus || 0), 0);
      const totalAbsent = inputs.reduce((a, b) => a + Number(b.absent_days || 0), 0);
      const totalLeave = inputs.reduce((a, b) => a + Number(b.leave_days || 0), 0);
      const totalSick = inputs.reduce((a, b) => a + Number(b.sick_leave_days || 0), 0);
      const totalLate = inputs.reduce((a, b) => a + Number(b.late_deduct || 0), 0);

      // Top OT Earners
      const topOtList = [...inputs].filter(i => Number(i.ot_hours) > 0).sort((a, b) => Number(b.ot_hours) - Number(a.ot_hours)).slice(0, 5).map(i => {
        const emp = employees.find(e => e.emp_id === i.emp_id) || {};
        return {
          empId: i.emp_id,
          name: emp.full_name || i.emp_name,
          dept: emp.department || '-',
          otHours: Number(i.ot_hours),
          otRate: Number(i.ot_rate || 40),
          otPay: canViewSalary ? (Number(i.ot_hours) * Number(i.ot_rate || 40)) : '฿***'
        };
      });

      // Allowance Earners
      const allowanceList = [...inputs].filter(i => Number(i.allowance) > 0).map(i => {
        const emp = employees.find(e => e.emp_id === i.emp_id) || {};
        return {
          empId: i.emp_id,
          name: emp.full_name || i.emp_name,
          dept: emp.department || '-',
          allowance: canViewSalary ? `฿${Number(i.allowance).toLocaleString('th-TH', {minimumFractionDigits:2})}` : '฿***'
        };
      });

      // Absent / Leave Staff
      const leaveList = [...inputs].filter(i => Number(i.absent_days) > 0 || Number(i.leave_days) > 0 || Number(i.sick_leave_days) > 0 || Number(i.late_deduct) > 0).map(i => {
        const emp = employees.find(e => e.emp_id === i.emp_id) || {};
        return {
          empId: i.emp_id,
          name: emp.full_name || i.emp_name,
          absent: Number(i.absent_days || 0),
          leave: Number(i.leave_days || 0),
          sick: Number(i.sick_leave_days || 0),
          lateDeduct: canViewSalary ? `฿${Number(i.late_deduct || 0).toLocaleString('th-TH', {minimumFractionDigits:2})}` : (Number(i.late_deduct) > 0 ? 'มีหักสาย' : '-')
        };
      });

      // Extra Context: Branches & Today PTN Time
      const branchRows = (await db.prepare('SELECT branch_id, branch_name, work_start_time, work_end_time FROM branches').all().catch(() => ({ results: [] }))).results || [];
      const todayDate = new Date().toISOString().substring(0, 10);
      const todayLogs = (await db.prepare('SELECT status, late_minutes FROM time_logs WHERE date = ?').bind(todayDate).all().catch(() => ({ results: [] }))).results || [];
      const pendingRow = await db.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM leave_requests WHERE status = 'PENDING') as pending_leaves,
          (SELECT COUNT(*) FROM ot_requests WHERE status = 'PENDING' AND (COALESCE(reason, '') NOT LIKE '%OT งานเสร็จประจำวัน%' AND COALESCE(reason, '') NOT LIKE '%(Admin ปรับปรุงเวลา)%' AND COALESCE(reason, '') NOT LIKE '%(HR ลงเวลาแทน)%')) as pending_ots,
          (SELECT COUNT(*) FROM advance_requests WHERE status = 'PENDING') as pending_advances
      `).first().catch(() => null);

      // 1. TRY GOOGLE GEMINI 3.6 FLASH
      let geminiKey = (await db.prepare('SELECT value FROM settings WHERE key = "GeminiApiKey"').first().catch(() => null))?.value;
      geminiKey = (geminiKey || '').trim();

      if (geminiKey) {
        try {
          const systemContext = `
คุณคือ "PTN AI Assistant" ผู้ช่วยปัญญาประดิษฐ์ประจำระบบเงินเดือนและบริหารบุคคล (PTN Payroll & PTN Time) ของ บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด
จงตอบคำถามเป็นภาษาไทยอย่างเป็นมิตร สุภาพ มีความเชี่ยวชาญด้านงาน HR และเงินเดือน ใช้ Markdown (เช่น ตาราง, ตัวหนา, bullet points) ให้อ่านง่าย

บริบทข้อมูลจริงของระบบในปัจจุบัน (Live System Context):
- ชื่อบริษัท: ${compName}
- งวดเงินเดือนปัจจุบัน: ${currentPeriod} (${isPeriodClosed ? '🔴 ปิดงวดแล้ว' : '🟢 กำลังเปิดคำนวณ'})
- สิทธิ์ผู้ใช้งาน: ${canViewSalary ? 'ผู้ดูแลระบบ/มีสิทธิ์ดูตัวเลขเงินเดือน' : 'พนักงานทั่วไป (ไม่มีสิทธิ์ดูตัวเลขเงินเดือน ห้ามบอกยอดเงินเด็ดขาด ให้แสดง ฿***)'}
- จำนวนพนักงานทั้งหมด: ${totalEmployees} คน
- แผนกทั้งหมด: ${JSON.stringify(deptCounts)}
- สาขาทั้งหมด: ${branchRows.map(b => `${b.branch_id}: ${b.branch_name} (เวลา ${b.work_start_time}-${b.work_end_time} น.)`).join(', ')}
- สถิติเงินเดือนงวดนี้: รวมชั่วโมง OT = ${totalOtHours} ชม., มีคนได้เบี้ยขยัน = ${allowanceList.length} คน, ขาดงานรวม = ${totalAbsent} วัน, ลากิจ = ${totalLeave} วัน, ลาป่วย = ${totalSick} วัน, หักสายรวม = ${totalLate > 0 ? 'มีหักสาย' : 'ไม่มี'}
${canViewSalary ? `- ยอดการเงินงวดนี้: เงินได้รวม Gross = ฿${totalGross.toLocaleString('th-TH')}, หักรวม = ฿${totalDeductions.toLocaleString('th-TH')}, จ่ายสุทธิ Net = ฿${totalNet.toLocaleString('th-TH')}, เงิน OT รวม = ฿${totalOtPay.toLocaleString('th-TH')}` : ''}
- ท็อป OT งวดนี้: ${JSON.stringify(topOtList)}
- พนักงานที่ได้เบี้ยขยัน: ${JSON.stringify(allowanceList.map(a => `${a.empId} ${a.name} (${a.dept})`))}
- รายการขาดลามาสาย: ${JSON.stringify(leaveList)}
- สถิติ PTN Time วันนี้ (${todayDate}): เข้างานแล้ว ${todayLogs.length} คน, สาย ${todayLogs.filter(t => (t.late_minutes||0) > 0).length} คน
- คำขอรออนุมัติ: คำขอลา ${pendingRow?.pending_leaves || 0} รายการ, ขอโอที ${pendingRow?.pending_ots || 0} รายการ, ขอเบิกฉุกเฉิน ${pendingRow?.pending_advances || 0} รายการ
- นโยบายบริษัท: เวลาทำงาน 09:30 - 19:00 น. (พัก 13:00 - 14:00 น.), โอทีปกติ 40 บาท/ชม., เบี้ยขยัน 1,000 บ./เดือน, โควตาลาป่วย 10 วัน/ปี (มีใบรับรองแพทย์), ขาดงานหัก 1.5 เท่า

คำถามจากผู้ใช้: "${userMsg}"
ตอบคำถามโดยอ้างอิงข้อมูลด้านบนนี้อย่างแม่นยำ เป็นประโยชน์ หากขอคำแนะนำหรือวิเคราะห์ให้ตอบเชิงลึกแบบมืออาชีพ
          `.trim();

          const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                { role: 'user', parts: [{ text: systemContext }] }
              ],
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 1000
              }
            })
          });

          const gData = await gRes.json();
          const gReply = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (gReply && gReply.trim()) {
            return {
              success: true,
              reply: gReply.trim(),
              source: 'gemini'
            };
          }
        } catch(gErr) {
          console.warn('Gemini API call note, using fallback engine:', gErr);
        }
      }

      // 2. FALLBACK TO INTELLIGENT RULE-BASED ENGINE
      const q = userMsg.toLowerCase();
      let reply = '';

      if (q.includes('สรุป') && (q.includes('งวด') || q.includes('ภาพรวม') || q.includes('ประจำเดือน'))) {
        reply = `### 📊 สรุปภาพรวมงวดประจำเดือน **${currentPeriod}**\n` +
          `* 🏢 **บริษัท**: ${compName}\n` +
          `* 🔒 **สถานะงวด**: ${isPeriodClosed ? '🔴 ปิดงวดแล้ว (ล็อคผลการคำนวณ)' : '🟢 กำลังเปิดคำนวณ (Open)'}\n` +
          `* 👥 **พนักงานทั้งหมด**: ${totalEmployees} คน (คำนวณแล้ว ${calcs.length} คน)\n` +
          `* ⏱️ **รวมชั่วโมง OT**: ${totalOtHours} ชม. (เงิน OT รวม: ${canViewSalary ? '฿' + totalOtPay.toLocaleString('th-TH', {minimumFractionDigits:2}) : '฿***'})\n` +
          `* 🌟 **รวมเบี้ยขยัน**: ${canViewSalary ? '฿' + totalAllowance.toLocaleString('th-TH', {minimumFractionDigits:2}) : '฿***'}\n` +
          (canViewSalary ? `* 💰 **ยอดเงินได้รวม (Gross)**: **฿${totalGross.toLocaleString('th-TH', {minimumFractionDigits:2})}**\n` +
          `* 🧾 **รวมหักทั้งหมด**: ฿${totalDeductions.toLocaleString('th-TH', {minimumFractionDigits:2})}\n` +
          `* 💵 **ยอดจ่ายสุทธิ (Net Pay)**: **฿${totalNet.toLocaleString('th-TH', {minimumFractionDigits:2})}**` : `* 🔒 *ข้อมูลตัวเลขเงินเดือนและยอดจ่ายถูกปิดบังตามสิทธิ์ความปลอดภัย*`);
      } else if (q.includes('แผนก') || q.includes('กี่คน') || q.includes('ตำแหน่ง')) {
        let deptRows = Object.entries(deptCounts).map(([d, c]) => `| ${d} | **${c} คน** | ${((c/totalEmployees)*100).toFixed(1)}% |`).join('\n');
        reply = `### 🏢 สถิติพนักงานแยกตามแผนก (${totalEmployees} คน)\n\n` +
          `| แผนก | จำนวนพนักงาน | สัดส่วน |\n|---|---|---|\n` + deptRows +
          `\n\n💡 *แผนกหลักของบริษัทคือ **โกดัง** (${deptCounts['โกดัง'] || 0} คน)*`;
      } else if (q.includes('ot') || q.includes('โอที') || q.includes('ล่วงเวลา')) {
        if (topOtList.length === 0) {
          reply = `### ⏱️ ข้อมูลค่าล่วงเวลา (OT) งวด **${currentPeriod}**\nยังไม่มีการบันทึกชั่วโมง OT ในงวดนี้ครับ`;
        } else {
          let otRows = topOtList.map((x, idx) => `| ${idx+1} | ${x.empId} | ${x.name} | ${x.dept} | **${x.otHours} ชม.** | ${x.otPay} |`).join('\n');
          reply = `### ⏱️ อันดับพนักงานที่ทำ OT สูงสุดงวด **${currentPeriod}**\n\n` +
            `* รวมชั่วโมง OT ทั้งบริษัท: **${totalOtHours} ชั่วโมง**\n` +
            `* รวมเงิน OT: **${canViewSalary ? '฿' + totalOtPay.toLocaleString('th-TH', {minimumFractionDigits:2}) : '฿***'}**\n\n` +
            `| อันดับ | รหัส | ชื่อ-นามสกุล | แผนก | ชม. OT | รวมเงิน OT |\n|:---:|---|---|---|:---:|:---:|\n` + otRows;
        }
      } else if (q.includes('เบี้ยขยัน') || q.includes('โบนัส')) {
        if (allowanceList.length === 0) {
          reply = `### 🌟 ข้อมูลเบี้ยขยันและโบนัสงวด **${currentPeriod}**\nงวดนี้ยังไม่มีพนักงานที่ได้รับเบี้ยขยันครับ`;
        } else {
          let alRows = allowanceList.map((x, idx) => `| ${idx+1} | ${x.empId} | ${x.name} | ${x.dept} | ${x.allowance} |`).join('\n');
          reply = `### 🌟 รายชื่อพนักงานที่ได้รับเบี้ยขยันงวด **${currentPeriod}** (${allowanceList.length} คน)\n\n` +
            `* รวมเงินเบี้ยขยันทั้งหมด: **${canViewSalary ? '฿' + totalAllowance.toLocaleString('th-TH', {minimumFractionDigits:2}) : '฿***'}**\n\n` +
            `| # | รหัส | ชื่อ-นามสกุล | แผนก | เบี้ยขยัน |\n|:---:|---|---|---|:---:|\n` + alRows;
        }
      } else if (q.includes('ขาด') || q.includes('ลา') || q.includes('สาย') || q.includes('ป่วย')) {
        if (leaveList.length === 0) {
          reply = `### 📅 สถิติการขาด / ลา / มาสาย งวด **${currentPeriod}**\nยอดเยี่ยมมากครับ! งวดนี้ไม่มีพนักงานขาดงาน ลากิจ หรือลาป่วยเลยครับ 👏✨`;
        } else {
          let lvRows = leaveList.map((x, idx) => `| ${idx+1} | ${x.empId} | ${x.name} | ${x.absent} | ${x.leave} | ${x.sick} | ${x.lateDeduct} |`).join('\n');
          reply = `### 📅 สรุปรายการ ขาด / ลา / มาสาย งวด **${currentPeriod}** (${leaveList.length} คน)\n\n` +
            `* 🔴 รวมขาดงาน: **${totalAbsent} วัน** (หัก 1.5 เท่า)\n` +
            `* 🟡 รวมลากิจ: **${totalLeave} วัน**\n` +
            `* 🟢 รวมลาป่วย: **${totalSick} วัน**\n\n` +
            `| # | รหัส | ชื่อ-นามสกุล | ขาด (วัน) | ลากิจ (วัน) | ลาป่วย (วัน) | หักสาย |\n|:---:|---|---|:---:|:---:|:---:|:---:|\n` + lvRows;
        }
      } else if (q.includes('ช่วย') || q.includes('ทำอะไรได้') || q.includes('help')) {
        reply = `### 🤖 ผมคือ PTN AI Payroll Assistant\nคุณสามารถพิมพ์ถามข้อมูลได้หลากหลาย เช่น:\n\n` +
          `* 📊 *"สรุปภาพรวมงวดปัจจุบัน"* &rarr; รายงานยอดเงินรวม, สถานะงวด, จำนวนพนักงาน\n` +
          `* 🏢 *"สถิติพนักงานแยกตามแผนก"* &rarr; แจกแจงจำนวนคนในแต่ละแผนก\n` +
          `* ⏱️ *"ใครทำ OT สูงสุดในงวดนี้"* &rarr; จัดอันดับชั่วโมง OT รายคน\n` +
          `* 🌟 *"ใครได้เบี้ยขยันบ้าง"* &rarr; รายชื่อคนได้รับเบี้ยขยัน\n` +
          `* 📅 *"สรุปสถิติขาดลามาสาย"* &rarr; สรุปวันขาด ลา ป่วย และสายงวดนี้`;
      } else {
        // Fallback intelligent query
        reply = `### 💡 ผลการค้นหาข้อมูลสำหรับ: "${userMsg}"\n` +
          `* 🏢 **บริษัท**: ${compName}\n` +
          `* 📅 **งวดปัจจุบัน**: ${currentPeriod} (${isPeriodClosed ? 'ปิดงวดแล้ว' : 'กำลังเปิดคำนวณ'})\n` +
          `* 👥 **พนักงานทั้งหมด**: ${totalEmployees} คน\n` +
          (canViewSalary ? `* 💰 **ยอดจ่ายสุทธิประจำงวด**: **฿${totalNet.toLocaleString('th-TH', {minimumFractionDigits:2})}**\n` : '') +
          `\nท่านสามารถกดปุ่มหัวข้อด้านบน หรือพิมพ์ถาม เช่น *"สรุปภาพรวมงวด"*, *"ใครทำ OT มากที่สุด"*, หรือ *"สถิติแยกแผนก"* ได้เลยครับ 😊`;
      }

      return {
        success: true,
        reply: reply
      };
    }

        // 13. AUDIT TRAIL / ACTIVITY LOGS
    case 'getActivityLogs': {
      await db.prepare('CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, username TEXT, action TEXT, details TEXT)').run().catch(() => {});
      const logs = (await db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 100').all()).results || [];
      return { success: true, logs: logs };
    }

    // 14. 50 TWI TAX CERTIFICATE DATA
    case 'get50TwiData': {
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

        // 15. BATCH IMPORT ATTENDANCE CSV
    case 'importAttendanceBatch': {
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

        // 16. PASS PROBATION ACTION
    case 'passProbation': {
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
    }

    case 'saveCompanyInfo': {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_company')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการข้อมูลบริษัท' };

      const cfg = params.settings || {};
      if (cfg.companyName) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("CompanyName", ?)').bind(cfg.companyName).run();
      if (cfg.address !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("Address", ?)').bind(cfg.address).run();
      if (cfg.phone !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("Phone", ?)').bind(cfg.phone).run();
      if (cfg.taxId !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("TaxId", ?)').bind(cfg.taxId).run();
      if (cfg.signatoryName !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("SignatoryName", ?)').bind(cfg.signatoryName).run();
      if (cfg.signatoryTitle !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("SignatoryTitle", ?)').bind(cfg.signatoryTitle).run();
      if (cfg.signatoryNameEn !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("SignatoryNameEn", ?)').bind(cfg.signatoryNameEn).run();
      if (cfg.signatoryTitleEn !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("SignatoryTitleEn", ?)').bind(cfg.signatoryTitleEn).run();
      if (cfg.employerSsoId !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("EmployerSsoId", ?)').bind(cfg.employerSsoId).run();
      if (cfg.companyBranch !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("CompanyBranch", ?)').bind(cfg.companyBranch).run();
      if (cfg.geminiApiKey !== undefined) await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("GeminiApiKey", ?)').bind(cfg.geminiApiKey).run();
      return { success: true, message: 'บันทึกข้อมูลบริษัทเรียบร้อยแล้ว' };
    }

    // 8.1 PTN TIME APP POPUP ANNOUNCEMENT
    case 'getAppAnnouncement': {
      let announcement = null;
      try {
        const annRow = await db.prepare("SELECT value FROM settings WHERE key = 'app_announcement'").first();
        if (annRow && annRow.value) {
          announcement = JSON.parse(annRow.value);
        }
      } catch (e) {}
      return { success: true, announcement };
    }

    case 'saveAppAnnouncement': {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_company')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการประกาศ' };

      const ann = params.announcement || {};
      const val = typeof ann === 'string' ? ann : JSON.stringify(ann);
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("app_announcement", ?)').bind(val).run();
      await logSystemActivity(db, params.username || 'Admin', 'SAVE_ANNOUNCEMENT', `ตั้งค่าประกาศแอป PTN Time: ${ann.title || '-'} (สถานะ: ${ann.active ? 'เปิด' : 'ปิด'})`);
      return { success: true, message: 'บันทึกข้อมูลประกาศเรียบร้อยแล้ว' };
    }

    // 9. PERIOD LOCK / UNLOCK
    case 'closePeriod': {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'close_period')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ปิดงวดเงินเดือน' };

      await calculateAndSavePayroll(db, period);
      const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const val = `CLOSED|${timeStr}|${params.username || 'Admin'}`;
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(`Period_Status_${period}`, val).run();
      await logSystemActivity(db, params.username || 'Admin', 'PERIOD_CLOSE', `ปิดงวดประจำเดือน ${period}`);
      return { success: true, period: period, isClosed: true, message: `ปิดงวดประจำเดือน ${period} เรียบร้อยแล้ว (ล็อคผลการคำนวณ)` };
    }

    case 'reopenPeriod': {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'close_period')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เปิดงวดเงินเดือน' };

      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, "OPEN")').bind(`Period_Status_${period}`).run();
      await logSystemActivity(db, params.username || 'Admin', 'PERIOD_REOPEN', `ปลดล็อคเปิดงวดประจำเดือน ${period}`);
      return { success: true, period: period, isClosed: false, message: `ปลดล็อคและเปิดงวดประจำเดือน ${period} เรียบร้อยแล้ว` };
    }

    // 10. USER MANAGEMENT
    case 'saveUser': {
      const callerUser = params.currentUsername || params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_users')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการผู้ใช้งาน' };

      const u = params.user || {};
      const origUser = params.origUser;
      if (!u.username) return { success: false, message: 'กรุณากรอก Username' };
      if (!origUser && !u.password) return { success: false, message: 'กรุณากรอก Password' };
      if (origUser && origUser !== u.username) {
        await db.prepare('DELETE FROM users WHERE username = ?').bind(origUser).run();
      }
      const permsJson = JSON.stringify(u.permissions || getDefaultRolePermissions(u.role));
      const hashedPass = (u.password && !u.password.startsWith('sha256:')) ? await hashUserPassword(u.password) : (u.password || '');
      if (hashedPass) {
        await db.prepare('INSERT OR REPLACE INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)').bind(u.username, hashedPass, u.role || 'User', permsJson).run();
      } else {
        await db.prepare('UPDATE users SET role = ?, permissions = ? WHERE username = ?').bind(u.role || 'User', permsJson, u.username).run();
      }
      await logSystemActivity(db, params.currentUsername || 'Admin', 'USER_SAVE', `บันทึก/แก้ไขผู้ใช้: ${u.username} (${u.role})`);
      return { success: true, message: 'บันทึกผู้ใช้งานและกำหนดสิทธิ์เรียบร้อยแล้ว' };
    }

    case 'deleteUser': {
      const callerUser = params.currentUsername || params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_users')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการผู้ใช้งาน' };

      const username = params.targetUsername || params.usernameToDelete || params.username;
      if (!username) return { success: false, message: 'Missing username' };
      if (username.toLowerCase() === 'admin') return { success: false, message: 'ไม่สามารถลบผู้ใช้ Admin หลักได้' };
      await db.prepare('DELETE FROM users WHERE username = ?').bind(username).run();
      await logSystemActivity(db, callerUser || 'Admin', 'USER_DELETE', `ลบผู้ใช้งาน: ${username}`);
      return { success: true, message: `ลบผู้ใช้ ${username} เรียบร้อยแล้ว` };
    }

        // 11. BACKUP & RESTORE DATABASE (ENTERPRISE FULL TABLE COVERAGE & SELECTIVE RESTORE)
    case 'backupDatabase': {
      const callerUser = params.currentUsername || params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_backup')) || (await userHasPermission(db, callerUser, 'close_period')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์สำรองข้อมูล' };

      await ensureBranchTables(db);
      await ensurePushTables(db);

      const settings = (await db.prepare('SELECT * FROM settings').all().catch(() => ({ results: [] }))).results || [];
      const users = (await db.prepare('SELECT username, password, role, permissions FROM users').all().catch(() => ({ results: [] }))).results || [];
      const employees = (await db.prepare('SELECT * FROM employees').all().catch(() => ({ results: [] }))).results || [];
      const branches = (await db.prepare('SELECT * FROM branches').all().catch(() => ({ results: [] }))).results || [];
      const employee_devices = (await db.prepare('SELECT * FROM employee_devices').all().catch(() => ({ results: [] }))).results || [];
      const monthly_inputs = (await db.prepare('SELECT * FROM monthly_inputs').all().catch(() => ({ results: [] }))).results || [];
      const payroll_calcs = (await db.prepare('SELECT * FROM payroll_calcs').all().catch(() => ({ results: [] }))).results || [];
      const push_subscriptions = (await db.prepare('SELECT * FROM push_subscriptions').all().catch(() => ({ results: [] }))).results || [];
      const activity_logs = (await db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 500').all().catch(() => ({ results: [] }))).results || [];

      // PTN Time tables (if present in D1)
      const time_logs = (await db.prepare('SELECT * FROM time_logs').all().catch(() => ({ results: [] }))).results || [];
      const leave_requests = (await db.prepare('SELECT * FROM leave_requests').all().catch(() => ({ results: [] }))).results || [];
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
    }

    case 'restoreDatabase': {
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

        if (!opts.selectiveMode) {
          await db.prepare('DELETE FROM employees').run().catch(() => {});
        }
        const stmts = [];
        for (const e of data.employees) {
          if (e.emp_id && e.full_name) {
            stmts.push(db.prepare(`
              INSERT OR REPLACE INTO employees 
              (emp_id, full_name, nickname, citizen_id, phone, address, department, position, base_salary, bank_name, bank_account, birth_date, age, join_date, pf_rate, default_sso, default_tax, status, probation_days, probation_end_date, photo_url, remark, branch_id, allow_all_branches, is_ot_eligible, is_undertime_exempt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              String(e.is_undertime_exempt !== undefined && e.is_undertime_exempt !== null ? e.is_undertime_exempt : 'false')
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
    const proRata = calculateNewHireProRataRatio(joinDateStr, dates.startDate, dates.endDate, holidayDatesSet);

    let baseSal = Number(inp.base_salary > 0 ? inp.base_salary : contractBaseSal);
    // If mid-period new hire and input base salary equals full contract salary, apply pro-rata:
    if (proRata.isMidPeriod && (baseSal === contractBaseSal || !inp.base_salary)) {
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