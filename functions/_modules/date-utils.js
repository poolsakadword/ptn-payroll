/**
 * Date & Period Calculation Utilities Module
 */

export function timeStringToMinutes(t) {
  if (!t) return null;
  const p = String(t).trim().split(':');
  return p.length >= 2 ? (parseInt(p[0], 10) * 60 + parseInt(p[1], 10)) : null;
}

export function normalizeDateToIso(str) {
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

export const THAI_MONTH_NAMES_LIST = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
];

export const THAI_SHORT_MONTH_NAMES_LIST = [
  'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'
];

export function getPeriodSortKey(period) {
  if (!period) return 0;
  const p = String(period).trim();

  // 1. Check Thai full month names
  let mIdx = -1;
  for (let i = 0; i < THAI_MONTH_NAMES_LIST.length; i++) {
    if (p.includes(THAI_MONTH_NAMES_LIST[i])) {
      mIdx = i + 1;
      break;
    }
  }

  // 2. Check Thai abbreviated month names
  if (mIdx < 0) {
    for (let j = 0; j < THAI_SHORT_MONTH_NAMES_LIST.length; j++) {
      if (p.includes(THAI_SHORT_MONTH_NAMES_LIST[j])) {
        mIdx = j + 1;
        break;
      }
    }
  }

  // 3. Check ISO YYYY-MM
  const iso = p.match(/^(\d{4})[-/](\d{1,2})/);
  if (iso) {
    let iy = parseInt(iso[1], 10);
    if (iy > 2400) iy -= 543;
    const im = parseInt(iso[2], 10);
    return iy * 100 + im;
  }

  // 4. Extract year from Thai period (e.g. "สิงหาคม 2569")
  const yMatch = p.match(/\d{4}/);
  let yr = yMatch ? parseInt(yMatch[0], 10) : 0;
  if (yr > 2400) yr -= 543;

  if (yr > 0 && mIdx > 0) {
    return yr * 100 + mIdx;
  }
  if (mIdx > 0) return mIdx;
  return 0;
}

export function getDefaultPeriod() {
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const d = new Date();
  return months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

export function parsePeriodYearMonth(periodStr) {
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

export function getPreviousPeriodStr(periodStr) {
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

export function getNextPeriodStr(periodStr) {
  const thaiMonths = [
    'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
  ];
  const { yearBE, month } = parsePeriodYearMonth(periodStr);
  let nextMonth = month + 1;
  let nextYearBE = yearBE;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYearBE += 1;
  }
  return `${thaiMonths[nextMonth - 1]} ${nextYearBE}`;
}

export async function getCutoffDatesForPeriod(db, periodStr) {
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

export function getActualWorkingDaysInCutoff(startDate, endDate, holidayDatesSet = new Set()) {
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

export function calculatePeriodProRataRatio(joinDateStr, resignDateStr, startDate, endDate, holidayDatesSet = new Set()) {
  const totalDays = getActualWorkingDaysInCutoff(startDate, endDate, holidayDatesSet);
  if (totalDays <= 0) return { isMidPeriod: false, notStarted: false, ratio: 1.0, eligibleDays: 26, totalDays: 26 };

  let effStart = startDate;
  if (joinDateStr && joinDateStr > startDate) {
    effStart = joinDateStr;
  }

  let effEnd = endDate;
  if (resignDateStr && resignDateStr < endDate) {
    effEnd = resignDateStr;
  }

  if (joinDateStr && joinDateStr > endDate) {
    return { isMidPeriod: false, notStarted: true, isExitMidPeriod: false, ratio: 0, eligibleDays: 0, totalDays };
  }
  if (resignDateStr && resignDateStr < startDate) {
    return { isMidPeriod: false, notStarted: false, isAlreadyResigned: true, isExitMidPeriod: true, ratio: 0, eligibleDays: 0, totalDays };
  }
  if (effStart > effEnd) {
    return { isMidPeriod: true, notStarted: false, isExitMidPeriod: Boolean(resignDateStr && resignDateStr < endDate), ratio: 0, eligibleDays: 0, totalDays };
  }

  const isNewHireMidPeriod = Boolean(joinDateStr && joinDateStr > startDate);
  const isExitMidPeriod = Boolean(resignDateStr && resignDateStr < endDate);
  const isMidPeriod = isNewHireMidPeriod || isExitMidPeriod;

  if (!isMidPeriod) {
    return { isMidPeriod: false, notStarted: false, isNewHireMidPeriod: false, isExitMidPeriod: false, ratio: 1.0, eligibleDays: totalDays, totalDays };
  }

  const eligibleDays = getActualWorkingDaysInCutoff(effStart, effEnd, holidayDatesSet);
  const ratio = totalDays > 0 ? (eligibleDays / totalDays) : 1.0;
  return { isMidPeriod: true, notStarted: false, isNewHireMidPeriod, isExitMidPeriod, ratio, eligibleDays, totalDays };
}

export function calculateNewHireProRataRatio(joinDateStr, startDate, endDate, holidayDatesSet = new Set()) {
  return calculatePeriodProRataRatio(joinDateStr, null, startDate, endDate, holidayDatesSet);
}

export function getElapsedWorkingDaysInCutoff(startDate, endDate, asOfDate, holidayDatesSet = new Set(), joinDateStr = '', resignDateStr = '') {
  const totalDays = getActualWorkingDaysInCutoff(startDate, endDate, holidayDatesSet);
  if (totalDays <= 0) return { elapsedDays: 0, totalDays: 26, ratio: 0 };

  let effStart = startDate;
  if (joinDateStr && joinDateStr > startDate) {
    effStart = joinDateStr;
  }

  let effEnd = endDate;
  if (asOfDate && asOfDate < endDate) {
    effEnd = asOfDate;
  }
  if (resignDateStr && resignDateStr < effEnd) {
    effEnd = resignDateStr;
  }

  if (joinDateStr && joinDateStr > effEnd) {
    return { elapsedDays: 0, totalDays, ratio: 0 };
  }
  if (effStart > effEnd) {
    return { elapsedDays: 0, totalDays, ratio: 0 };
  }

  let count = 0;
  let cur = new Date(effStart + 'T00:00:00Z');
  const end = new Date(effEnd + 'T00:00:00Z');
  while (cur <= end) {
    const day = cur.getUTCDay(); // 0 = Sunday
    const dStr = cur.toISOString().substring(0, 10);
    if (day !== 0 && !holidayDatesSet.has(dStr)) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const ratio = totalDays > 0 ? (count / totalDays) : 0;
  return { elapsedDays: count, totalDays, ratio };
}

export async function getCompanyHolidayDatesSet(db, startDate, endDate) {
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

export async function isPeriodLocked(db, period) {
  if (!period) return false;
  try {
    const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(`Period_Status_${period}`).first();
    return !!(row && row.value && row.value.startsWith('CLOSED'));
  } catch (e) {
    return false;
  }
}
