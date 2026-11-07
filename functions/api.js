/**
 * ==============================================================================
 * PTN Payroll System V4.0 - Clean Enterprise Cloudflare D1 Backend (Modular)
 * บริษัท พีทีเอ็น ฟาร์มาเซ็นเตอร์ จำกัด
 * ==============================================================================
 */

import { ensureGlobalSchemas } from './_modules/db.js';
import { verifySessionToken } from './_modules/security.js';
import { getDefaultPeriod, getNextPeriodStr } from './_modules/date-utils.js';
import { authHandlers } from './_modules/auth.js';
import { payrollHandlers } from './_modules/payroll.js';
import { attendanceHandlers } from './_modules/attendance.js';
import { employeeHandlers } from './_modules/employees.js';
import { branchHandlers } from './_modules/branches.js';
import { holidayHandlers } from './_modules/holidays.js';
import { notificationHandlers } from './_modules/notifications.js';
import { backupHandlers } from './_modules/backup.js';
import { aiHandlers } from './_modules/ai.js';
import { storageHandlers } from './_modules/storage.js';

const actionHandlers = {
  ...authHandlers,
  ...payrollHandlers,
  ...attendanceHandlers,
  ...employeeHandlers,
  ...branchHandlers,
  ...holidayHandlers,
  ...notificationHandlers,
  ...backupHandlers,
  ...aiHandlers,
  ...storageHandlers,
};

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

    if (params.verifiedUser) {
      params.username = params.verifiedUser;
      params.currentUsername = params.verifiedUser;
    } else {
      // Disallow spoofing username without a verified cryptographic token for protected actions
      if (action !== 'checkLogin' && action !== 'kioskScanQrAttendance' && action !== 'checkBranchGpsOnly') {
        params.username = '';
        params.currentUsername = '';
      }
    }

    // Resolve active period context (preserved from monolithic backend)
    let period = params.period;
    if (!period) {
      const latestRow = await db.prepare('SELECT period FROM monthly_inputs ORDER BY rowid DESC LIMIT 1').first().catch(() => null);
      period = (latestRow && latestRow.period) ? latestRow.period : getDefaultPeriod();
      if (latestRow && latestRow.period) {
        const closedSetting = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(`Period_Status_${latestRow.period}`).first().catch(() => null);
        if (closedSetting && closedSetting.value && closedSetting.value.startsWith('CLOSED')) {
          const nextP = getNextPeriodStr(latestRow.period);
          if (nextP) period = nextP;
        }
      }
    }
    params.period = period;

    // Special Binary Handler: Stream Photo directly from Cloudflare R2
    if (action === 'getPhoto') {
      const key = params.key || url.searchParams.get('key');
      const r2 = env.PHOTOS_BUCKET || env.R2 || env.BUCKET;
      if (key && r2 && typeof r2.get === 'function') {
        const object = await r2.get(key);
        if (object) {
          const headers = new Headers();
          headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          headers.set('Access-Control-Allow-Origin', '*');
          return new Response(object.body, { headers });
        }
      }
      return new Response(null, { status: 404, headers: corsHeaders });
    }

    const handler = actionHandlers[action];
    if (!handler) {
      return new Response(JSON.stringify({
        success: false,
        message: `Unknown action: ${action}`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const result = await handler(db, params, period, env);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      message: err.message || 'เกิดข้อผิดพลาดในการประมวลผล'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
