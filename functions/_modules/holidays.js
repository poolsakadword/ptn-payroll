/**
 * Company Holidays, Announcements & Activity Logs Module
 */
import { ensureBranchTables, logSystemActivity } from './db.js';
import { isUserSuperAdmin, userHasPermission } from './security.js';
import { calculateAndSavePayroll } from './payroll.js';

export const holidayHandlers = {
  getCompanyHolidays: async (db, params) => {
      const rows = await db.prepare('SELECT * FROM company_holidays ORDER BY date ASC').all().catch(() => ({ results: [] }));
      return { success: true, holidays: rows.results || [] };
  },

  saveCompanyHoliday: async (db, params) => {
    let period = params.period;
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
  },

  deleteCompanyHoliday: async (db, params) => {
    let period = params.period;
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
  },

  saveCompanyInfo: async (db, params) => {
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
  },

  getAppAnnouncement: async (db, params) => {
      let announcement = null;
      try {
        const annRow = await db.prepare("SELECT value FROM settings WHERE key = 'app_announcement'").first();
        if (annRow && annRow.value) {
          announcement = JSON.parse(annRow.value);
        }
      } catch (e) {}
      return { success: true, announcement };
  },

  saveAppAnnouncement: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_company')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์จัดการประกาศ' };

      const ann = params.announcement || {};
      const val = typeof ann === 'string' ? ann : JSON.stringify(ann);
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES ("app_announcement", ?)').bind(val).run();
      await logSystemActivity(db, params.username || 'Admin', 'SAVE_ANNOUNCEMENT', `ตั้งค่าประกาศแอป PTN Time: ${ann.title || '-'} (สถานะ: ${ann.active ? 'เปิด' : 'ปิด'})`);
      return { success: true, message: 'บันทึกข้อมูลประกาศเรียบร้อยแล้ว' };
  },

  getActivityLogs: async (db, params) => {
      const callerUser = params.username || '';
      const allowed = (await userHasPermission(db, callerUser, 'manage_backup')) || (await userHasPermission(db, callerUser, 'view_analytics')) || (await isUserSuperAdmin(db, callerUser));
      if (!allowed) return { success: false, message: 'สิทธิ์ไม่เพียงพอ: บัญชีของคุณไม่ได้รับสิทธิ์ดูบันทึกกิจกรรมระบบ' };

      await db.prepare('CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT, username TEXT, action TEXT, details TEXT)').run().catch(() => {});
      const limitNum = Math.min(2000, Math.max(50, Number(params.limit) || 500));
      const sqlParts = ['SELECT * FROM activity_logs WHERE 1=1'];
      const binds = [];

      if (params.actionFilter && params.actionFilter !== 'ALL') {
        if (params.actionFilter === 'PTN_TIME') {
          sqlParts.push("AND action LIKE 'PTN_TIME%'");
        } else if (params.actionFilter === 'INCIDENT') {
          sqlParts.push("AND action LIKE 'INCIDENT%'");
        } else if (params.actionFilter === 'PAYROLL') {
          sqlParts.push("AND (action LIKE '%PAYROLL%' OR action LIKE 'PERIOD_%' OR action = 'SET_WORK_DAYS')");
        } else if (params.actionFilter === 'AUTH') {
          sqlParts.push("AND (action = 'LOGIN' OR action LIKE 'USER_%')");
        } else {
          sqlParts.push('AND action = ?');
          binds.push(params.actionFilter);
        }
      }

      if (params.search) {
        const q = '%' + String(params.search).trim() + '%';
        sqlParts.push('AND (username LIKE ? OR action LIKE ? OR details LIKE ? OR timestamp LIKE ?)');
        binds.push(q, q, q, q);
      }

      sqlParts.push('ORDER BY id DESC LIMIT ?');
      binds.push(limitNum);

      const logs = (await db.prepare(sqlParts.join(' ')).bind(...binds).all()).results || [];
      return { success: true, logs: logs };
  }
};
