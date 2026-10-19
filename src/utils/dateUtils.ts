import { addMonths, differenceInCalendarDays, format, isValid, isWeekend, addDays, parseISO } from 'date-fns';
import { AppealCase, AppealUrgency } from '../types/appeal';

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

/**
 * คำนวณวันครบกำหนดอุทธรณ์ 1 เดือน นับแต่วันมีคำพิพากษา
 * ตามประมวลกฎหมายวิธีพิจารณาความแพ่ง/อาญา
 * หากวันครบกำหนดตรงกับวันหยุดเสาร์-อาทิตย์ กฎหมายให้นับวันทำการถัดไป (ป.พ.พ. มาตรา 193/8)
 */
function normalizeThaiDigits(str: string): string {
  return str.replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50));
}

const THAI_MONTH_MAP: Record<string, number> = {
  'มกราคม': 1, 'ม.ค.': 1, 'ม.ค': 1,
  'กุมภาพันธ์': 2, 'ก.พ.': 2, 'ก.พ': 2,
  'มีนาคม': 3, 'มี.ค.': 3, 'มี.ค': 3,
  'เมษายน': 4, 'เม.ย.': 4, 'เม.ย': 4,
  'พฤษภาคม': 5, 'พ.ค.': 5, 'พ.ค': 5,
  'มิถุนายน': 6, 'มิ.ย.': 6, 'มิ.ย': 6,
  'กรกฎาคม': 7, 'ก.ค.': 7, 'ก.ค': 7,
  'สิงหาคม': 8, 'ส.ค.': 8, 'ส.ค': 8,
  'กันยายน': 9, 'ก.ย.': 9, 'ก.ย': 9,
  'ตุลาคม': 10, 'ต.ค.': 10, 'ต.ค': 10,
  'พฤศจิกายน': 11, 'พ.ย.': 11, 'พ.ย': 11,
  'ธันวาคม': 12, 'ธ.ค.': 12, 'ธ.ค': 12,
};

export function parseDateStringRobust(rawStr?: string | null): Date | null {
  if (!rawStr || !rawStr.trim()) return null;
  const cleanStr = normalizeThaiDigits(rawStr.trim());

  // 1. Check for Thai month text format e.g. "16 ต.ค. 2569", "16 ตุลาคม 2569", "16 ต.ค. 69"
  for (const [mName, mNum] of Object.entries(THAI_MONTH_MAP)) {
    if (cleanStr.includes(mName)) {
      const match = cleanStr.match(/(\d{1,2})\s*[\s\.\-\/]*([^\d\s]+)\s*[\s\.\-\/]*(\d{2,4})/);
      if (match) {
        const day = parseInt(match[1], 10);
        let year = parseInt(match[3], 10);
        if (year >= 50 && year < 100) year = 2500 + year - 543;
        else if (year < 50) year = 2000 + year;
        else if (year > 2400) year -= 543;
        if (day >= 1 && day <= 31 && year > 1900 && year < 2200) {
          const d = new Date(year, mNum - 1, day);
          if (isValid(d)) return d;
        }
      }
    }
  }

  // 2. Format with ISO timestamp like "2026-10-16T..." or "2026-10-16 ..."
  const isoPrefix = cleanStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoPrefix) {
    let year = parseInt(isoPrefix[1], 10);
    const month = parseInt(isoPrefix[2], 10);
    const day = parseInt(isoPrefix[3], 10);
    if (year > 2400) year -= 543;
    const d = new Date(year, month - 1, day);
    if (isValid(d)) return d;
  }

  // 3. Format with separators: "-", "/", "."
  const sepMatch = cleanStr.split(/[-\/\.\s]+/).filter(Boolean);
  if (sepMatch.length >= 3) {
    const p0 = parseInt(sepMatch[0], 10);
    const p1 = parseInt(sepMatch[1], 10);
    const p2 = parseInt(sepMatch[2], 10);

    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      let year = 0, month = 0, day = 0;
      if (p0 > 1000) {
        // YYYY-MM-DD
        year = p0;
        month = p1;
        day = p2;
      } else if (p2 > 1000) {
        // DD-MM-YYYY
        day = p0;
        month = p1;
        year = p2;
      } else if (p2 >= 50 && p2 <= 99) {
        // DD-MM-YY (Buddhist era 2-digit e.g. 69 -> 2569)
        day = p0;
        month = p1;
        year = 2500 + p2 - 543;
      } else if (p2 >= 20 && p2 < 50) {
        // DD-MM-YY (CE 2-digit e.g. 26 -> 2026)
        day = p0;
        month = p1;
        year = 2000 + p2;
      } else if (p0 >= 20 && p0 < 50 && p2 <= 31) {
        // YY-MM-DD
        year = 2000 + p0;
        month = p1;
        day = p2;
      } else {
        // Default to DD-MM-YYYY
        day = p0;
        month = p1;
        year = p2 > 2400 ? p2 - 543 : (p2 < 100 ? (p2 >= 50 ? 2500 + p2 - 543 : 2000 + p2) : p2);
      }

      if (year > 2400) year -= 543;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(year, month - 1, day);
        if (isValid(d)) return d;
      }
    }
  }

  // 4. Fallback to parseISO
  try {
    const parsed = parseISO(cleanStr);
    if (isValid(parsed)) return parsed;
  } catch {}

  // 5. Fallback native Date
  try {
    const nativeD = new Date(cleanStr);
    if (isValid(nativeD) && !isNaN(nativeD.getTime())) return nativeD;
  } catch {}

  return null;
}

/**
 * คำนวณวันครบกำหนดอุทธรณ์ 1 เดือน นับแต่วันมีคำพิพากษา
 * ตามประมวลกฎหมายวิธีพิจารณาความแพ่ง/อาญา
 * หากวันครบกำหนดตรงกับวันหยุดเสาร์-อาทิตย์ กฎหมายให้นับวันทำการถัดไป (ป.พ.พ. มาตรา 193/8)
 */
export function calculateAppealDeadline(judgmentDateStr: string): {
  deadlineDate: string;
  originalDeadline: string;
  isAdjustedForWeekend: boolean;
} {
  if (!judgmentDateStr || !judgmentDateStr.trim()) {
    return { deadlineDate: '', originalDeadline: '', isAdjustedForWeekend: false };
  }

  const judgmentDate = parseDateStringRobust(judgmentDateStr);
  if (!judgmentDate || !isValid(judgmentDate)) {
    return { deadlineDate: '', originalDeadline: '', isAdjustedForWeekend: false };
  }

  // บวก 1 เดือนตามปฏิทิน
  const oneMonthAfter = addMonths(judgmentDate, 1);
  const originalStr = format(oneMonthAfter, 'yyyy-MM-dd');

  let finalDate = oneMonthAfter;
  let isAdjusted = false;

  // ตรวจสอบวันหยุดเสาร์-อาทิตย์
  if (isWeekend(finalDate)) {
    isAdjusted = true;
    const dayOfWeek = finalDate.getDay();
    if (dayOfWeek === 6) {
      // วันเสาร์ -> เลื่อนไปวันจันทร์ (+2 วัน)
      finalDate = addDays(finalDate, 2);
    } else if (dayOfWeek === 0) {
      // วันอาทิตย์ -> เลื่อนไปวันจันทร์ (+1 วัน)
      finalDate = addDays(finalDate, 1);
    }
  }

  return {
    deadlineDate: format(finalDate, 'yyyy-MM-dd'),
    originalDeadline: originalStr,
    isAdjustedForWeekend: isAdjusted,
  };
}

/**
 * คำนวณวันครบกำหนดยื่นแยกฟ้อง (เช่น ภายใน 7 วัน ตามคำสั่งศาล หรือ ป.วิ.อ. มาตรา 176)
 * หากวันครบกำหนดตรงกับวันหยุดเสาร์-อาทิตย์ กฎหมายให้นับวันทำการถัดไป (ป.พ.พ. มาตรา 193/8)
 */
export function calculateSeveredDeadline(orderDateStr: string, days: number = 7): {
  deadlineDate: string;
  originalDeadline: string;
  isAdjustedForWeekend: boolean;
} {
  if (!orderDateStr || !orderDateStr.trim()) {
    return { deadlineDate: '', originalDeadline: '', isAdjustedForWeekend: false };
  }

  const orderDate = parseDateStringRobust(orderDateStr);
  if (!orderDate || !isValid(orderDate)) {
    return { deadlineDate: '', originalDeadline: '', isAdjustedForWeekend: false };
  }

  const targetDate = addDays(orderDate, days);
  const originalStr = format(targetDate, 'yyyy-MM-dd');

  let finalDate = targetDate;
  let isAdjusted = false;

  // ตรวจสอบวันหยุดเสาร์-อาทิตย์
  if (isWeekend(finalDate)) {
    isAdjusted = true;
    const dayOfWeek = finalDate.getDay();
    if (dayOfWeek === 6) {
      // วันเสาร์ -> เลื่อนไปวันจันทร์ (+2 วัน)
      finalDate = addDays(finalDate, 2);
    } else if (dayOfWeek === 0) {
      // วันอาทิตย์ -> เลื่อนไปวันจันทร์ (+1 วัน)
      finalDate = addDays(finalDate, 1);
    }
  }

  return {
    deadlineDate: format(finalDate, 'yyyy-MM-dd'),
    originalDeadline: originalStr,
    isAdjustedForWeekend: isAdjusted,
  };
}

export interface SeveredFilingAlertInfo {
  hasOrder: boolean;
  isPending: boolean;
  isCompleted: boolean;
  orderDate?: string;
  deadlineDate?: string;
  daysRemaining: number;
  status: 'overdue' | 'due_today' | 'critical' | 'warning' | 'normal' | 'completed' | 'none';
  alertBadgeText: string;
  alertBadgeClass: string;
  isAlertDue: boolean;
}

/**
 * คำนวณสถานะและข้อมูลแจ้งเตือนการยื่นแยกฟ้องภายใน 7 วัน (ตาม ป.วิ.อ. ม.176 หรือคำสั่งศาล)
 */
export function getSeveredFilingAlertInfo(
  caseItem: AppealCase,
  refDate: Date = new Date()
): SeveredFilingAlertInfo {
  // สำนวนนี้มีคำสั่งให้พนักงานอัยการแยกฟ้องและต้องติดตามการแยกฟ้องหรือไม่
  const hasOrder = Boolean(
    caseItem.hasPendingSeveredFiling ||
    (caseItem.hasMultipleDefendants && caseItem.hasPartialDenial) ||
    Boolean(caseItem.severedFilingOrderDate) ||
    Boolean(caseItem.severedFilingDeadline)
  );

  if (!hasOrder) {
    return {
      hasOrder: false,
      isPending: false,
      isCompleted: false,
      daysRemaining: 999,
      status: 'none',
      alertBadgeText: '',
      alertBadgeClass: '',
      isAlertDue: false,
    };
  }

  // หากดำเนินการยื่นแยกฟ้องเรียบร้อยแล้ว
  const isCompleted = Boolean(caseItem.isSeveredFilingCompleted || caseItem.severedNewBlackCaseNo);
  if (isCompleted) {
    return {
      hasOrder: true,
      isPending: false,
      isCompleted: true,
      orderDate: caseItem.severedFilingOrderDate || caseItem.severedOrderDate,
      deadlineDate: caseItem.severedFilingDeadline || caseItem.severedDeadlineDate,
      daysRemaining: 999,
      status: 'completed',
      alertBadgeText: caseItem.severedNewBlackCaseNo ? `แยกฟ้องแล้ว (${caseItem.severedNewBlackCaseNo})` : 'ยื่นแยกฟ้องแล้ว',
      alertBadgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      isAlertDue: false,
    };
  }

  // กำหนดวันที่คำนวณ: ใช้วันครบกำหนดที่มี หรือคำนวณจากวันที่ศาลสั่ง 7 วัน
  const orderDate = caseItem.severedFilingOrderDate || caseItem.severedOrderDate || caseItem.judgmentDate || caseItem.filingDate;
  let deadlineDate = caseItem.severedFilingDeadline || caseItem.severedDeadlineDate;
  if (!deadlineDate && orderDate) {
    deadlineDate = calculateSeveredDeadline(orderDate, 7).deadlineDate;
  }

  if (!deadlineDate) {
    return {
      hasOrder: true,
      isPending: true,
      isCompleted: false,
      orderDate,
      daysRemaining: 7,
      status: 'warning',
      alertBadgeText: 'มีคำสั่งแยกฟ้อง (เตือน 7 วัน)',
      alertBadgeClass: 'bg-purple-100 text-purple-950 border-purple-300',
      isAlertDue: true,
    };
  }

  const parsedDeadline = parseDateStringRobust(deadlineDate);
  if (!parsedDeadline || !isValid(parsedDeadline)) {
    return {
      hasOrder: true,
      isPending: true,
      isCompleted: false,
      orderDate,
      deadlineDate,
      daysRemaining: 999,
      status: 'normal',
      alertBadgeText: 'เตือนแยกฟ้อง 7 วัน',
      alertBadgeClass: 'bg-purple-100 text-purple-950 border-purple-300',
      isAlertDue: false,
    };
  }

  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const target = new Date(parsedDeadline.getFullYear(), parsedDeadline.getMonth(), parsedDeadline.getDate());
  const daysRemaining = differenceInCalendarDays(target, today);

  if (daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      hasOrder: true,
      isPending: true,
      isCompleted: false,
      orderDate,
      deadlineDate,
      daysRemaining,
      status: 'overdue',
      alertBadgeText: `🚨 เกินกำหนดแยกฟ้อง ${overdueDays} วัน!`,
      alertBadgeClass: 'bg-rose-100 text-rose-950 border-rose-400 font-bold animate-pulse',
      isAlertDue: true,
    };
  }

  if (daysRemaining === 0) {
    return {
      hasOrder: true,
      isPending: true,
      isCompleted: false,
      orderDate,
      deadlineDate,
      daysRemaining: 0,
      status: 'due_today',
      alertBadgeText: '⚡ ครบกำหนดแยกฟ้องวันนี้!',
      alertBadgeClass: 'bg-rose-500 text-white border-rose-600 font-bold animate-pulse',
      isAlertDue: true,
    };
  }

  if (daysRemaining <= 3) {
    return {
      hasOrder: true,
      isPending: true,
      isCompleted: false,
      orderDate,
      deadlineDate,
      daysRemaining,
      status: 'critical',
      alertBadgeText: `⏰ ด่วน! เหลือ ${daysRemaining} วัน ต้องแยกฟ้อง`,
      alertBadgeClass: 'bg-orange-100 text-orange-950 border-orange-400 font-bold',
      isAlertDue: true,
    };
  }

  if (daysRemaining <= 7) {
    return {
      hasOrder: true,
      isPending: true,
      isCompleted: false,
      orderDate,
      deadlineDate,
      daysRemaining,
      status: 'warning',
      alertBadgeText: `✂️ เตือนแยกฟ้องใน ${daysRemaining} วัน`,
      alertBadgeClass: 'bg-purple-100 text-purple-950 border-purple-300 font-semibold',
      isAlertDue: true,
    };
  }

  return {
    hasOrder: true,
    isPending: true,
    isCompleted: false,
    orderDate,
    deadlineDate,
    daysRemaining,
    status: 'normal',
    alertBadgeText: `กำหนดแยกฟ้องใน ${daysRemaining} วัน`,
    alertBadgeClass: 'bg-purple-50 text-purple-900 border-purple-200',
    isAlertDue: false,
  };
}

/**
 * คำนวณจำนวนวันที่เหลือจนถึงวันครบกำหนดอุทธรณ์
 */
export function getDaysRemaining(caseItem: AppealCase, refDate: Date = new Date()): number {
  let targetDateStr = caseItem.extendedDeadline || caseItem.appealDeadline;
  if (!targetDateStr && caseItem.judgmentDate) {
    targetDateStr = calculateAppealDeadline(caseItem.judgmentDate).deadlineDate;
  }
  if (!targetDateStr) return 999;

  const [tYear, tMonth, tDay] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(tYear, tMonth - 1, tDay);

  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  return differenceInCalendarDays(targetDate, today);
}

/**
 * ตรวจสอบว่าเป็นสำนวนของ อัยการเจ้าของสำนวน "อ.กุลชาติ" หรือไม่
 */
export function isKunchartCase(caseItem: AppealCase): boolean {
  if (!caseItem) return false;
  const person = (caseItem.responsiblePerson || '').trim();
  const prosecutor = (caseItem.prosecutorName || '').trim();
  return person.includes('กุลชาติ') || prosecutor.includes('กุลชาติ');
}

/**
 * ตรวจสอบเงื่อนไขพิเศษเฉพาะกรณีเจ้าของสำนวนเป็น อ.กุลชาติ:
 * หากกดเสร็จสิ้นแล้ว ก็ยังให้เตือนตอนก่อนครบอุทธรณ์ 5 วันอยู่
 * โดยต้องให้กดยืนยันอีกครั้งว่าสำนวนไม่อุทธรณ์แล้ว (isNoAppealConfirmed) จึงจะไม่เตือน
 */
export function isKunchartCompletedPendingNoAppealAlert(
  caseItem: AppealCase,
  refDate: Date = new Date()
): boolean {
  if (!isKunchartCase(caseItem)) return false;
  if (!caseItem.isCompleted) return false;
  if (caseItem.isNoAppealConfirmed) return false; // กดยืนยันแล้วว่าไม่อุทธรณ์ จึงไม่เตือน
  if (!caseItem.appealDeadline && !caseItem.extendedDeadline && !caseItem.judgmentDate) return false;

  const daysLeft = getDaysRemaining(caseItem, refDate);
  // เตือนตอนก่อนครบอุทธรณ์ 5 วัน (daysLeft <= 5)
  return daysLeft <= 5;
}

/**
 * ประเมินระดับความเร่งด่วนในการคุมอุทธรณ์
 */
export function getAppealUrgency(caseItem: AppealCase, refDate: Date = new Date()): AppealUrgency {
  if (caseItem.isCompleted) {
    // เงื่อนไขพิเศษเฉพาะกรณีเจ้าของสำนวนเป็น อ.กุลชาติ:
    // หากกดเสร็จสิ้นแล้ว ก็ยังให้เตือนตอนก่อนครบอุทธรณ์ 5 วันอยู่
    // โดยต้องให้กดยืนยันอีกครั้งว่าสำนวนไม่อุทธรณ์แล้ว จึงจะไม่เตือน
    if (isKunchartCompletedPendingNoAppealAlert(caseItem, refDate)) {
      const daysLeft = getDaysRemaining(caseItem, refDate);
      if (daysLeft < 0) return 'overdue';
      if (daysLeft <= 3) return 'critical';
      return 'warning';
    }
    return 'completed';
  }

  // สำนวนเบิกฟ้องที่ยังไม่มีคำพิพากษา จะยังไม่เริ่มคุมระยะเวลาอุทธรณ์ 1 เดือน
  if ((caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition') && (!caseItem.hasJudgment && !caseItem.judgmentDate)) {
    return 'pending_trial';
  }

  // หากเป็นสำนวนที่ยังไม่มีคำพิพากษา (เช่น อยู่ระหว่างนัดคุ้มครองสิทธิ, จำเลยปฏิเสธ, มีวันนัดต่อๆ ไป)
  if (caseItem.hasJudgment === false || (!caseItem.judgmentDate && !caseItem.appealDeadline)) {
    return 'pending_trial';
  }

  const daysLeft = getDaysRemaining(caseItem, refDate);

  if (daysLeft < 0) {
    return 'overdue'; // ขาดอุทธรณ์แล้ว
  }
  if (daysLeft <= 3) {
    return 'critical'; // ด่วนที่สุด (0-3 วัน)
  }
  if (daysLeft <= 7) {
    return 'warning'; // เตือนด่วน (4-7 วัน)
  }
  return 'normal'; // ปกติ (> 7 วัน)
}

/**
 * แปลงวันที่เป็น พ.ศ. ภาษาไทย
 * เช่น "2026-10-15" -> "15 ต.ค. 2569" หรือ "15 ตุลาคม 2569"
 */
export function formatThaiDate(
  dateStr?: string,
  options: { short?: boolean; includeYear?: boolean } = { short: true, includeYear: true }
): string {
  if (!dateStr) return '-';
  try {
    const d = parseDateStringRobust(dateStr);
    if (d && isValid(d)) {
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      const buddhistYear = year + 543;
      const monthName = options.short ? THAI_MONTHS_SHORT[month] : THAI_MONTHS_FULL[month];

      if (options.includeYear === false) {
        return `${day} ${monthName}`;
      }

      if (options.short) {
        return `${day} ${monthName} ${buddhistYear}`;
      }

      return `${day} ${monthName} พ.ศ. ${buddhistYear}`;
    }

    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

    const buddhistYear = year + 543;
    const monthName = options.short ? THAI_MONTHS_SHORT[month] : THAI_MONTHS_FULL[month];

    if (options.includeYear === false) {
      return `${day} ${monthName}`;
    }

    if (options.short) {
      return `${day} ${monthName} ${buddhistYear}`;
    }

    return `${day} ${monthName} พ.ศ. ${buddhistYear}`;
  } catch {
    return dateStr;
  }
}

/**
 * คืนค่า YYYY-MM-DD ของวันนี้
 */
export function getTodayString(): string {
  const now = new Date();
  return format(now, 'yyyy-MM-dd');
}

/**
 * คืนค่า YYYY-MM ของเดือนปัจจุบัน เช่น "2026-10"
 */
export function getCurrentMonthString(): string {
  const now = new Date();
  return format(now, 'yyyy-MM');
}

/**
 * แปลงปี-เดือน (YYYY-MM) เป็นชื่อเดือนภาษาไทยและปี พ.ศ.
 * เช่น "2026-10" -> "ตุลาคม 2569" หรือ "ต.ค. 2569"
 */
export function formatThaiMonth(
  yearMonthStr?: string,
  options: { short?: boolean } = { short: false }
): string {
  if (!yearMonthStr) return '-';
  try {
    const parts = yearMonthStr.split('-');
    if (parts.length < 2) return yearMonthStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;

    if (isNaN(year) || isNaN(month) || month < 0 || month > 11) return yearMonthStr;

    const buddhistYear = year + 543;
    const monthName = options.short ? THAI_MONTHS_SHORT[month] : THAI_MONTHS_FULL[month];
    return `${monthName} ${buddhistYear}`;
  } catch {
    return yearMonthStr;
  }
}

