/**
 * Branch Management Module
 */
import { ensureBranchTables, logSystemActivity } from './db.js';
import { isUserSuperAdmin, userHasPermission } from './security.js';

export function getBranchShiftSessions(branch) {
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

export const branchHandlers = {
  getBranches: async (db, params) => {
      const branches = (await db.prepare('SELECT * FROM branches ORDER BY branch_id ASC').all()).results || [];
      return { success: true, branches };
  },

  saveBranch: async (db, params) => {
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
  },

  deleteBranch: async (db, params) => {
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
  },

  toggleBranchEarlyDismissal: async (db, params) => {
      const callerUser = params.username || 'Admin';
      const branchId = String(params.branchId || params.branch_id || '').trim();
      const enabled = (params.enabled === true || params.enabled === 'true' || params.enabled === 1 || params.enabled === '1') ? 1 : 0;
      if (!branchId) return { success: false, message: 'กรุณาระบุรหัสสาขา' };

      const allowed = (await isUserSuperAdmin(db, callerUser)) ||
                      (await userHasPermission(db, callerUser, 'manage_attendance_settings')) ||
                      (await userHasPermission(db, callerUser, 'toggle_early_dismissal')) ||
                      (await userHasPermission(db, callerUser, 'toggle_early_dismissal:' + branchId));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์เปิด/ปิดโหมดงานเสร็จของสาขานี้' };

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
};
