/**
 * User Authentication & Management Module
 */
import { logSystemActivity } from './db.js';
import {
  verifyUserPassword, hashUserPassword, generateSessionToken,
  getDefaultRolePermissions, isUserSuperAdmin, userHasPermission
} from './security.js';

export const authHandlers = {
  checkLogin: async (db, params) => {
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
  },

  saveUser: async (db, params) => {
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
  },

  deleteUser: async (db, params) => {
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
};
