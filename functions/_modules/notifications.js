/**
 * Web Push Notifications & VAPID Engine Module
 */
import { ensurePushTables, logSystemActivity } from './db.js';
import { base64UrlToBytes, bytesToBase64Url, isUserSuperAdmin, userHasPermission } from './security.js';

export const VAPID_PUBLIC_KEY = 'BFIl918yWYb9YE1JrQvdjqVIDumstq7AoG68thcEd-eeVbOIMA5uhUO6SAlBaO7Ulj2CR3mcJQNHUrx1Crg4g7A';
export const VAPID_PRIVATE_KEY = 'LlUhEMxj03FGhpNmJ854Ht5XjxT7aOAFTEDWDs_SxIw';
export const VAPID_SUBJECT = 'mailto:admin@ptn-pharma.com';

export async function createVapidJwt(audience) {
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

export async function encryptWebPushPayload(clientP256dhB64, clientAuthB64, payloadString) {
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

export async function sendWebPush(subscription, payload) {
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

export async function sendPushToEmployee(db, empId, payload) {
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

export async function sendPushToAdmins(db, payload) {
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

export async function broadcastPushNotification(db, payload, appTypeFilter = null) {
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

export const notificationHandlers = {
  broadcastPayslipNotification: async (db, params) => {
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
  },

  getVapidPublicKey: async (db, params) => {
      return {
        success: true,
        publicKey: VAPID_PUBLIC_KEY
      };
  },

  savePushSubscription: async (db, params) => {
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
  },

  removePushSubscription: async (db, params) => {
      const endpoint = params.endpoint;
      if (endpoint) {
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
      }
      return { success: true, message: 'ยกเลิกการรับแจ้งเตือนบนอุปกรณ์นี้เรียบร้อยแล้ว' };
  },

  getPushSubscriptionStatus: async (db, params) => {
      const countRow = await db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').first().catch(() => ({ count: 0 }));
      return {
        success: true,
        totalSubscribers: countRow ? Number(countRow.count) : 0
      };
  },

  sendTestPushNotification: async (db, params) => {
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
  },

  sendCustomEmployeePush: async (db, params) => {
      const callerUser = params.username || params.currentUsername || 'Admin';
      const allowed = (await userHasPermission(db, callerUser, 'approve_attendance')) ||
                      (await userHasPermission(db, callerUser, 'calc_payroll')) ||
                      (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอในการส่งแจ้งเตือนพนักงาน' };

      const { empId, title, body } = params;
      if (!empId) {
        return { success: false, message: 'กรุณาระบุรหัสพนักงาน' };
      }
      const sentCount = await sendPushToEmployee(db, empId, {
        title: title || '⚠️ แจ้งเตือนการลงเวลา (PTN Time)',
        body: body || 'กรุณาตรวจสอบบันทึกการลงเวลาและสิทธิ์เบี้ยขยันของคุณในระบบ PTN Time',
        url: '/?tab=history',
        tag: 'ptn-ai-alert-' + Date.now()
      });
      await logSystemActivity(db, callerUser, 'AI_EMPLOYEE_PUSH', `ส่ง Push Notification ถึง ${empId} (${sentCount} เครื่อง): ${title || ''}`);
      return {
        success: true,
        sentCount,
        message: sentCount > 0 
          ? `ส่งการแจ้งเตือนไปยังแอป PTN Time ของพนักงาน ${empId} สำเร็จ (${sentCount} เครื่อง)` 
          : `ส่งข้อความแล้ว (ยังไม่มีอุปกรณ์ของพนักงาน ${empId} ที่เปิดรับ Push Notification)`
      };
  }
};
