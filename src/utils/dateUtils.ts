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
export function calculateAppealDeadline(judgmentDateStr: string): {
  deadlineDate: string;
  originalDeadline: string;
  isAdjustedForWeekend: boolean;
} {
  if (!judgmentDateStr) {
    return { deadlineDate: '', originalDeadline: '', isAdjustedForWeekend: false };
  }

  const [year, month, day] = judgmentDateStr.split('-').map(Number);
  const judgmentDate = new Date(year, month - 1, day);

  if (!isValid(judgmentDate)) {
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
 * คำนวณจำนวนวันที่เหลือจนถึงวันครบกำหนดอุทธรณ์
 */
export function getDaysRemaining(caseItem: AppealCase, refDate: Date = new Date()): number {
  const targetDateStr = caseItem.extendedDeadline || caseItem.appealDeadline;
  if (!targetDateStr) return 999;

  const [tYear, tMonth, tDay] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(tYear, tMonth - 1, tDay);

  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  return differenceInCalendarDays(targetDate, today);
}

/**
 * ประเมินระดับความเร่งด่วนในการคุมอุทธรณ์
 */
export function getAppealUrgency(caseItem: AppealCase, refDate: Date = new Date()): AppealUrgency {
  if (caseItem.isCompleted) {
    return 'completed';
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
      const shortYear = (buddhistYear % 100).toString().padStart(2, '0');
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
