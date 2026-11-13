/**
 * AI Assistant Module (Gemini Integration)
 */
import { isUserSuperAdmin, userHasPermission } from './security.js';
import { getDefaultPeriod } from './date-utils.js';

export const aiHandlers = {
  testGeminiApiKey: async (db, params) => {
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
  },

  askAiAssistant: async (db, params) => {
    let period = params.period;
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
      const employees = (await db.prepare('SELECT emp_id, full_name, nickname, department, position, base_salary, status, join_date, branch_id FROM employees ORDER BY emp_id ASC').all()).results || [];
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
      const todayLogs = (await db.prepare('SELECT status, late_minutes, overbreak_minutes FROM time_logs WHERE date = ?').bind(todayDate).all().catch(() => ({ results: [] }))).results || [];
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
- สถิติ PTN Time วันนี้ (${todayDate}): เข้างานแล้ว ${todayLogs.length} คน, สาย ${todayLogs.filter(t => (t.late_minutes||0) > 0 || (t.overbreak_minutes||0) > 0).length} คน
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
};
