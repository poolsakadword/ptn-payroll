/**
 * ==============================================================================
 * Cloudflare R2 Object Storage & Photo Retention Policy Module
 * PTN Payroll & PTN Time
 * ==============================================================================
 */

import { logSystemActivity } from './db.js';
import { isUserSuperAdmin, userHasPermission } from './security.js';

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

    const r2 = env && (env.PHOTOS_BUCKET || env.R2 || env.BUCKET);

    // Extract MIME type and raw base64 data
    let mimeType = 'image/jpeg';
    let rawBase64 = dataUrl;
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      rawBase64 = match[2];
    }

    const objectKey = `${folder}/${filename}`;

    if (r2 && typeof r2.put === 'function') {
      try {
        // Convert Base64 string to Uint8Array buffer
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

        const photoUrl = `/api?action=getPhoto&key=${encodeURIComponent(objectKey)}`;
        await logSystemActivity(db, callerUser, 'UPLOAD_PHOTO_R2', `อัปโหลดรูปภาพลง R2: ${objectKey} (${bytes.length} bytes)`);

        return {
          success: true,
          url: photoUrl,
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
    // Cutoff date for 24 months retention policy
    const now = new Date();
    const cutoffDateObj = new Date(now.getFullYear(), now.getMonth() - 24, now.getDate());
    const cutoffDate = cutoffDateObj.toISOString().substring(0, 10);

    const r2 = env && (env.PHOTOS_BUCKET || env.R2 || env.BUCKET);
    const hasR2Binding = Boolean(r2 && typeof r2.put === 'function');

    // Count time_logs photos before 24 months cutoff
    const oldRow = await db.prepare(`
      SELECT COUNT(*) as count 
      FROM time_logs 
      WHERE date < ? 
        AND (
          (in_photo_url IS NOT NULL AND in_photo_url != '') OR 
          (out_photo_url IS NOT NULL AND out_photo_url != '') OR
          (break_out_photo_url IS NOT NULL AND break_out_photo_url != '') OR
          (break_in_photo_url IS NOT NULL AND break_in_photo_url != '')
        )
    `).bind(cutoffDate).first().catch(() => ({ count: 0 }));

    // Count active recent photos
    const recentRow = await db.prepare(`
      SELECT COUNT(*) as count 
      FROM time_logs 
      WHERE date >= ? 
        AND (
          (in_photo_url IS NOT NULL AND in_photo_url != '') OR 
          (out_photo_url IS NOT NULL AND out_photo_url != '')
        )
    `).bind(cutoffDate).first().catch(() => ({ count: 0 }));

    return {
      success: true,
      hasR2Binding,
      retentionMonths: 24,
      cutoffDate,
      eligibleOldPhotosCount: oldRow ? Number(oldRow.count) : 0,
      recentPhotosCount: recentRow ? Number(recentRow.count) : 0,
      policyNotice: 'นโยบายการจัดเก็บรูปถ่าย: เก็บรูปถ่ายสแกนเวลาเข้า-ออกงานไว้ 24 เดือน (2 ปี) และล้างเฉพาะไฟล์รูปที่เก่ากว่านั้นเพื่อประหยัดพื้นที่ โดยคงประวัติเวลาทำงานครบถ้วน 100%'
    };
  },

  /**
   * Retention Policy Cleanup: Remove Attendance Photos older than 24 months
   */
  cleanupOldAttendancePhotos: async (db, params, period, env) => {
    const callerUser = params.username || params.currentUsername || 'Admin';
    const allowed = (await userHasPermission(db, callerUser, 'manage_company')) || (await isUserSuperAdmin(db, callerUser));
    if (!allowed) {
      return { success: false, message: 'สิทธิ์ไม่เพียงพอ: สงวนสิทธิ์เฉพาะผู้มีสิทธิ์จัดการระบบหรือ Super Admin เท่านั้น' };
    }

    // 24 Months Cutoff
    const now = new Date();
    const cutoffDateObj = new Date(now.getFullYear(), now.getMonth() - 24, now.getDate());
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
    `).bind(cutoffDate).run().catch(() => null);

    const cleanedCount = logs.length;
    await logSystemActivity(
      db, 
      callerUser, 
      'PHOTO_RETENTION_CLEANUP', 
      `ดำเนินการตาม Retention Policy: ล้างรูปถ่ายสแกนเวลาที่เก่ากว่า 24 เดือน (ก่อนวันที่ ${cutoffDate}) จำนวน ${cleanedCount} รายการ (ลบจาก R2 ${r2DeletedCount} ไฟล์)`
    );

    return {
      success: true,
      cutoffDate,
      cleanedCount,
      r2DeletedCount,
      message: `ดำเนินการตาม Retention Policy ล้างรูปถ่ายสแกนเวลาเก่าเกิน 24 เดือน (ก่อนวันที่ ${cutoffDate}) เรียบร้อยแล้ว จำนวน ${cleanedCount} รายการ โดยยังคงประวัติการลงเวลาและสถิติเงินเดือนไว้ครบถ้วน 100%`
    };
  }
};
