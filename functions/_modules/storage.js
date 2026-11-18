/**
 * ==============================================================================
 * Cloudflare R2 Object Storage & Photo Retention Policy Module
 * PTN Payroll & PTN Time
 * ==============================================================================
 */

import { logSystemActivity, executeBatch } from './db.js';
import { isUserSuperAdmin, userHasPermission } from './security.js';

function getR2Bucket(env) {
  const r2 = env && (env.PHOTOS_BUCKET || env.R2 || env.BUCKET);
  return (r2 && typeof r2.put === 'function') ? r2 : null;
}

async function uploadDataUrlToR2(r2, objectKey, dataUrl) {
  let mimeType = 'image/jpeg';
  let rawBase64 = dataUrl;
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    rawBase64 = match[2];
  }
  const binaryStr = atob(rawBase64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  await r2.put(objectKey, bytes, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable'
    }
  });
  return {
    bytesCount: len,
    url: `/api?action=getPhoto&key=${encodeURIComponent(objectKey)}`
  };
}

export const storageHandlers = {
  /**
   * Upload Photo to Cloudflare R2 with fallback
   */
  uploadPhoto: async (db, params, period, env) => {
    const callerUser = params.username || params.currentUsername || 'Admin';
    const dataUrl = params.dataUrl || params.image || '';
    const folder = String(params.folder || 'employees').replace(/[^a-zA-Z0-9_\-]/g, '');
    const filename = String(params.filename || `photo_${Date.now()}.jpg`).replace(/[^a-zA-Z0-9_\-\.]/g, '');

    if (!dataUrl) {
      return { success: false, message: 'ไม่พบข้อมูลรูปภาพที่ต้องการอัปโหลด' };
    }

    const r2 = getR2Bucket(env);
    const objectKey = `${folder}/${filename}`;

    if (r2) {
      try {
        const uploaded = await uploadDataUrlToR2(r2, objectKey, dataUrl);
        await logSystemActivity(db, callerUser, 'UPLOAD_PHOTO_R2', `อัปโหลดรูปภาพลง R2: ${objectKey} (${uploaded.bytesCount} bytes)`);

        return {
          success: true,
          url: uploaded.url,
          key: objectKey,
          storage: 'R2',
          message: 'อัปโหลดรูปภาพสู่ Cloudflare R2 สำเร็จเรียบร้อย'
        };
      } catch (err) {
        console.error('R2 upload error:', err);
        return {
          success: false,
          message: 'เกิดข้อผิดพลาดในการบันทึกรูปภาพลง R2: ' + (err.message || String(err))
        };
      }
    }

    // Graceful Fallback if R2 Bucket is not bound yet:
    // Return the compressed Data URL directly so app keeps working smoothly
    return {
      success: true,
      url: dataUrl,
      key: objectKey,
      storage: 'OPTIMIZED_BASE64',
      message: 'บันทึกรูปภาพสำเร็จ (พร้อมใช้งานและย้ายสู่ R2 อัตโนมัติเมื่อผูก Bucket)'
    };
  },

  /**
   * Photo Storage Statistics & Retention Audit
   */
  getPhotoStorageStats: async (db, params, period, env) => {
    const months = Math.max(1, Math.min(60, parseInt(params && params.retentionMonths, 10) || 24));
    const calcCutoff = (m) => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() - m, now.getDate()).toISOString().substring(0, 10);
    };
    const cutoffDate = calcCutoff(months);
    const c1 = calcCutoff(1);
    const c3 = calcCutoff(3);
    const c6 = calcCutoff(6);
    const c12 = calcCutoff(12);
    const c24 = calcCutoff(24);

    const r2 = env && (env.PHOTOS_BUCKET || env.R2 || env.BUCKET);
    const hasR2Binding = Boolean(r2 && typeof r2.put === 'function');

    const hasAnyPhotoCond = `(
      (in_photo_url IS NOT NULL AND in_photo_url != '') OR
      (out_photo_url IS NOT NULL AND out_photo_url != '') OR
      (break_out_photo_url IS NOT NULL AND break_out_photo_url != '') OR
      (break_in_photo_url IS NOT NULL AND break_in_photo_url != '')
    )`;

    const statsRow = await db.prepare(`
      SELECT
        SUM(CASE WHEN date < ? THEN 1 ELSE 0 END) AS eligible_count,
        SUM(CASE WHEN date >= ? THEN 1 ELSE 0 END) AS recent_count,
        SUM(CASE WHEN date < ? THEN 1 ELSE 0 END) AS m1,
        SUM(CASE WHEN date < ? THEN 1 ELSE 0 END) AS m3,
        SUM(CASE WHEN date < ? THEN 1 ELSE 0 END) AS m6,
        SUM(CASE WHEN date < ? THEN 1 ELSE 0 END) AS m12,
        SUM(CASE WHEN date < ? THEN 1 ELSE 0 END) AS m24,
        SUM(CASE WHEN (in_photo_url LIKE 'data:image%' OR out_photo_url LIKE 'data:image%' OR break_out_photo_url LIKE 'data:image%' OR break_in_photo_url LIKE 'data:image%') THEN 1 ELSE 0 END) AS base64_count,
        SUM(CASE WHEN (in_photo_url LIKE '/api?action=getPhoto%' OR out_photo_url LIKE '/api?action=getPhoto%' OR break_out_photo_url LIKE '/api?action=getPhoto%' OR break_in_photo_url LIKE '/api?action=getPhoto%') THEN 1 ELSE 0 END) AS r2_count,
        COUNT(*) AS total_with_photos
      FROM time_logs
      WHERE ${hasAnyPhotoCond}
    `).bind(cutoffDate, cutoffDate, c1, c3, c6, c12, c24).first().catch(() => null);

    return {
      success: true,
      hasR2Binding,
      retentionMonths: months,
      cutoffDate,
      eligibleOldPhotosCount: statsRow ? Number(statsRow.eligible_count) || 0 : 0,
      recentPhotosCount: statsRow ? Number(statsRow.recent_count) || 0 : 0,
      totalWithPhotos: statsRow ? Number(statsRow.total_with_photos) || 0 : 0,
      base64TimeLogsCount: statsRow ? Number(statsRow.base64_count) || 0 : 0,
      r2TimeLogsCount: statsRow ? Number(statsRow.r2_count) || 0 : 0,
      breakdown: {
        m1: statsRow ? Number(statsRow.m1) || 0 : 0,
        m3: statsRow ? Number(statsRow.m3) || 0 : 0,
        m6: statsRow ? Number(statsRow.m6) || 0 : 0,
        m12: statsRow ? Number(statsRow.m12) || 0 : 0,
        m24: statsRow ? Number(statsRow.m24) || 0 : 0
      },
      policyNotice: 'นโยบายการจัดเก็บรูปถ่าย: สามารถเลือกช่วงเวลาล้างเฉพาะไฟล์รูปถ่ายสแกนเวลาเก่าเพื่อประหยัดพื้นที่ฐานข้อมูล D1 โดยคงประวัติวัน-เวลาทำงาน, OT และเงินเดือนไว้ครบถ้วน 100%'
    };
  },

  /**
   * Retention Policy Cleanup: Remove Attendance Photos older than N months (default 24)
   */
  cleanupOldAttendancePhotos: async (db, params, period, env) => {
    const callerUser = params.username || params.currentUsername || 'Admin';
    const allowed = (await userHasPermission(db, callerUser, 'manage_company')) || (await isUserSuperAdmin(db, callerUser));
    if (!allowed) {
      return { success: false, message: 'สิทธิ์ไม่เพียงพอ: สงวนสิทธิ์เฉพาะผู้มีสิทธิ์จัดการระบบหรือ Super Admin เท่านั้น' };
    }

    const months = Math.max(1, Math.min(60, parseInt(params && params.retentionMonths, 10) || 24));
    const now = new Date();
    const cutoffDateObj = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    const cutoffDate = cutoffDateObj.toISOString().substring(0, 10);

    const r2 = env && (env.PHOTOS_BUCKET || env.R2 || env.BUCKET);

    // Query old logs with photos
    const oldLogsQuery = await db.prepare(`
      SELECT id, in_photo_url, out_photo_url, break_out_photo_url, break_in_photo_url 
      FROM time_logs 
      WHERE date < ? 
        AND (
          (in_photo_url IS NOT NULL AND in_photo_url != '') OR 
          (out_photo_url IS NOT NULL AND out_photo_url != '') OR
          (break_out_photo_url IS NOT NULL AND break_out_photo_url != '') OR
          (break_in_photo_url IS NOT NULL AND break_in_photo_url != '')
        )
      LIMIT 1000
    `).bind(cutoffDate).all().catch(() => ({ results: [] }));

    const logs = oldLogsQuery.results || [];
    let r2DeletedCount = 0;

    // Delete photos from R2 bucket if stored as R2 keys
    if (r2 && typeof r2.delete === 'function' && logs.length > 0) {
      for (const log of logs) {
        const photoFields = [log.in_photo_url, log.out_photo_url, log.break_out_photo_url, log.break_in_photo_url];
        for (const p of photoFields) {
          if (p && typeof p === 'string' && p.includes('key=')) {
            try {
              const urlMatch = p.match(/key=([^&]+)/);
              if (urlMatch) {
                const key = decodeURIComponent(urlMatch[1]);
                await r2.delete(key).catch(() => {});
                r2DeletedCount++;
              }
            } catch(e) {}
          }
        }
      }
    }

    // Clear photo references in SQLite D1 (Preserving all date, hours, overtime, and salary calculations!)
    const updateResult = await db.prepare(`
      UPDATE time_logs 
      SET in_photo_url = NULL, 
          out_photo_url = NULL, 
          break_out_photo_url = NULL, 
          break_in_photo_url = NULL 
      WHERE date < ?
        AND (
          (in_photo_url IS NOT NULL AND in_photo_url != '') OR
          (out_photo_url IS NOT NULL AND out_photo_url != '') OR
          (break_out_photo_url IS NOT NULL AND break_out_photo_url != '') OR
          (break_in_photo_url IS NOT NULL AND break_in_photo_url != '')
        )
    `).bind(cutoffDate).run().catch(() => null);

    const cleanedCount = (updateResult && updateResult.meta && typeof updateResult.meta.changes === 'number')
      ? updateResult.meta.changes
      : logs.length;

    await logSystemActivity(
      db, 
      callerUser, 
      'PHOTO_RETENTION_CLEANUP', 
      `ล้างรูปถ่ายสแกนเวลาที่เก่ากว่า ${months} เดือน (ก่อนวันที่ ${cutoffDate}) จำนวน ${cleanedCount} รายการ (ลบจาก R2 ${r2DeletedCount} ไฟล์)`
    );

    return {
      success: true,
      retentionMonths: months,
      cutoffDate,
      cleanedCount,
      r2DeletedCount,
      message: `ล้างรูปถ่ายสแกนเวลาที่เก่ากว่า ${months} เดือน (ก่อนวันที่ ${cutoffDate}) เรียบร้อยแล้ว จำนวน ${cleanedCount} รายการ โดยยังคงประวัติการลงเวลาและสถิติเงินเดือนไว้ครบถ้วน 100%`
    };
  },

  /**
   * Batch migrate Base64 photos from D1 time_logs into Cloudflare R2
   */
  migrateD1PhotosToR2: async (db, params, period, env) => {
    const callerUser = params.username || params.currentUsername || 'Admin';
    const allowed = (await userHasPermission(db, callerUser, 'manage_company')) || (await isUserSuperAdmin(db, callerUser));
    if (!allowed) {
      return { success: false, message: 'สิทธิ์ไม่เพียงพอ: สงวนสิทธิ์เฉพาะผู้มีสิทธิ์จัดการระบบหรือ Super Admin เท่านั้น' };
    }

    const r2 = getR2Bucket(env);
    if (!r2) {
      return { success: false, message: 'ยังไม่ได้ผูก Cloudflare R2 Bucket (PHOTOS_BUCKET)' };
    }

    const batchLimit = Math.max(1, Math.min(20, parseInt(params && params.limit, 10) || 10));
    const rows = (await db.prepare(`
      SELECT id, emp_id, date, in_photo_url, out_photo_url, break_out_photo_url, break_in_photo_url
      FROM time_logs
      WHERE in_photo_url LIKE 'data:image%'
         OR out_photo_url LIKE 'data:image%'
         OR break_out_photo_url LIKE 'data:image%'
         OR break_in_photo_url LIKE 'data:image%'
      ORDER BY id ASC
      LIMIT ?
    `).bind(batchLimit).all()).results || [];

    const updateStmts = [];
    let migratedPhotos = 0;

    for (const row of rows) {
      const fields = [
        { col: 'in_photo_url', tag: 'in', val: row.in_photo_url },
        { col: 'out_photo_url', tag: 'out', val: row.out_photo_url },
        { col: 'break_out_photo_url', tag: 'break_out', val: row.break_out_photo_url },
        { col: 'break_in_photo_url', tag: 'break_in', val: row.break_in_photo_url }
      ];
      const nextVals = {
        in_photo_url: row.in_photo_url,
        out_photo_url: row.out_photo_url,
        break_out_photo_url: row.break_out_photo_url,
        break_in_photo_url: row.break_in_photo_url
      };
      let changed = false;

      for (const f of fields) {
        if (f.val && typeof f.val === 'string' && f.val.startsWith('data:image')) {
          const safeDate = String(row.date || 'unknown').replace(/[^0-9\-]/g, '');
          const safeEmp = String(row.emp_id || 'emp').replace(/[^a-zA-Z0-9_\-]/g, '');
          const ext = f.val.startsWith('data:image/png') ? 'png' : (f.val.startsWith('data:image/webp') ? 'webp' : 'jpg');
          const key = `time_logs/${safeDate}/${safeEmp}_${row.id}_${f.tag}.${ext}`;
          const uploaded = await uploadDataUrlToR2(r2, key, f.val);
          nextVals[f.col] = uploaded.url;
          migratedPhotos++;
          changed = true;
        }
      }

      if (changed) {
        updateStmts.push(
          db.prepare(`
            UPDATE time_logs
            SET in_photo_url = ?, out_photo_url = ?, break_out_photo_url = ?, break_in_photo_url = ?
            WHERE id = ?
          `).bind(
            nextVals.in_photo_url || null,
            nextVals.out_photo_url || null,
            nextVals.break_out_photo_url || null,
            nextVals.break_in_photo_url || null,
            row.id
          )
        );
      }
    }

    if (updateStmts.length > 0) {
      await executeBatch(db, updateStmts, 10);
    }

    const remRow = await db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM time_logs
      WHERE in_photo_url LIKE 'data:image%'
         OR out_photo_url LIKE 'data:image%'
         OR break_out_photo_url LIKE 'data:image%'
         OR break_in_photo_url LIKE 'data:image%'
    `).first().catch(() => ({ cnt: 0 }));

    const remaining = remRow ? Number(remRow.cnt) || 0 : 0;
    if (remaining === 0 && updateStmts.length > 0) {
      await logSystemActivity(
        db,
        callerUser,
        'PHOTO_R2_MIGRATION',
        `ย้ายรูปถ่ายสแกนเวลาจาก D1 ขึ้น Cloudflare R2 (ptn-photos) เสร็จสมบูรณ์`
      );
    }

    return {
      success: true,
      migratedRows: updateStmts.length,
      migratedPhotos,
      remaining
    };
  }
};
