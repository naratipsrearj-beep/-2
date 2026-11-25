import { AppealCase } from '../types/appeal';
import {
  formatThaiDate,
  getAppealUrgency,
  getDaysRemaining,
  isKunchartCompletedPendingNoAppealAlert,
  parseDateStringRobust,
} from './dateUtils';
import {
  isCaseConfessed,
  isCaseDenied,
  isCaseRequisition,
  isCaseTemporarilyDischarged,
  isCaseUnspecifiedStage,
  isJudgmentRecorded,
} from './appointmentUtils';

export type AnnualYearMode = 'calendar_be' | 'fiscal_be';

export interface AnnualSequenceInfo {
  yearBE: number;
  sequenceNo: number;
  yearTotal: number;
  formattedNo: string; // e.g., "1/2569"
}

export interface AnnualMonthBucket {
  monthKey: string; // "YYYY-MM"
  yearCE: number;
  yearBE: number;
  monthIndex: number; // 0-11
  monthLabel: string; // e.g., "มกราคม 2569"
  shortLabel: string; // e.g., "ม.ค."
  totalCases: number;
  cumulativeTotal: number;
  seqStart: number | null;
  seqEnd: number | null;
  confessedCount: number;
  deniedCount: number;
  requisitionCount: number;
  dischargedCount: number;
  unspecifiedCount: number;
  otherCount: number;
  hasJudgmentCount: number;
  submittedToDutyCount: number;
  completedCount: number;
  pendingCount: number;
  urgentCount: number;
  cases: AppealCase[];
}

export interface AnnualProsecutorBucket {
  prosecutorName: string;
  totalCases: number;
  sharePercent: number;
  confessedCount: number;
  deniedCount: number;
  requisitionCount: number;
  dischargedCount: number;
  unspecifiedCount: number;
  completedCount: number;
  pendingCount: number;
  urgentCount: number;
  completionRate: number;
  cases: AppealCase[];
}

export interface AnnualCaseWithSequence {
  caseItem: AppealCase;
  sequenceNo: number;
  yearBE: number;
  formattedNo: string;
}

export interface AnnualYearSummary {
  yearBE: number;
  mode: AnnualYearMode;
  isCurrentYear: boolean;
  isFutureYear: boolean;
  periodLabel: string; // e.g., "1 ม.ค. 2569 – 31 ธ.ค. 2569" or "1 ต.ค. 2568 – 30 ก.ย. 2569"
  totalFiledThisYear: number;
  previousYearBE: number;
  previousYearTotal: number;
  yoyDelta: number;
  yoyPercent: number | null;
  carryOverCases: AppealCase[];
  carryOverUrgentCount: number;
  completedThisYear: number;
  pendingThisYear: number;
  urgentThisYear: number;
  overdueThisYear: number;
  completionRate: number;
  confessedCount: number;
  deniedCount: number;
  requisitionCount: number;
  dischargedCount: number;
  unspecifiedCount: number;
  otherCount: number;
  hasJudgmentCount: number;
  submittedToDutyCount: number;
  activeMonthsCount: number;
  avgPerActiveMonth: number;
  peakMonth: AnnualMonthBucket | null;
  months: AnnualMonthBucket[];
  prosecutors: AnnualProsecutorBucket[];
  yearCasesWithSequence: AnnualCaseWithSequence[];
}

export interface AnnualYearComparisonRow {
  yearBE: number;
  isCurrentYear: boolean;
  isFutureYear: boolean;
  totalFiled: number;
  avgPerActiveMonth: number;
  confessedCount: number;
  deniedCount: number;
  requisitionCount: number;
  dischargedCount: number;
  completedCount: number;
  pendingCount: number;
  urgentCount: number;
  completionRate: number;
  carryOverIntoYearCount: number;
}

const THAI_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

/**
 * คืนค่าปี พ.ศ. ปัจจุบัน (ตามปีปฏิทิน หรือปีงบประมาณ)
 */
export function getCurrentBuddhistYear(
  mode: AnnualYearMode = 'calendar_be',
  refDate: Date = new Date()
): number {
  const calendarBE = refDate.getFullYear() + 543;
  if (mode === 'fiscal_be') {
    // ปีงบประมาณไทยเริ่ม 1 ตุลาคม (เดือน index 9) -> นับเป็นปี พ.ศ. ถัดไป
    return refDate.getMonth() >= 9 ? calendarBE + 1 : calendarBE;
  }
  return calendarBE;
}

/**
 * สกัดวันที่ยื่นฟ้อง (Date) ของสำนวนอย่างแม่นยำ
 */
export function getCaseFilingDateObj(caseItem: AppealCase): Date | null {
  if (caseItem.filingDate) {
    const parsed = parseDateStringRobust(caseItem.filingDate);
    if (parsed) return parsed;
  }
  if (caseItem.createdAt) {
    const parsedCreated = parseDateStringRobust(caseItem.createdAt);
    if (parsedCreated) return parsedCreated;
  }
  return null;
}

/**
 * สกัดปี พ.ศ. (ตามปีปฏิทิน 1 ม.ค. – 31 ธ.ค.) จากวันที่ยื่นฟ้อง หรือ fallback จากเลขคดี
 */
export function getCaseFilingBuddhistYear(caseItem: AppealCase): number | null {
  const d = getCaseFilingDateObj(caseItem);
  if (d) {
    return d.getFullYear() + 543;
  }

  // Fallback: ค้นหาปี พ.ศ. 4 หลักหลังเครื่องหมาย / ในเลขคดีดำ หรือ ส.4 หรือ ส.1
  const candidates = [caseItem.blackCaseNo, caseItem.filingNumberS4, caseItem.receivedNumberS1];
  for (const text of candidates) {
    if (!text) continue;
    const match = text.match(/\/(25\d{2})\b/);
    if (match) {
      const y = parseInt(match[1], 10);
      if (y >= 2540 && y <= 2650) return y;
    }
  }
  return null;
}

/**
 * สกัดปี พ.ศ. ของสำนวนตามโหมด (ปีปฏิทิน หรือ ปีงบประมาณ)
 */
export function getCaseBuddhistYearByMode(
  caseItem: AppealCase,
  mode: AnnualYearMode = 'calendar_be'
): number | null {
  const d = getCaseFilingDateObj(caseItem);
  if (d) {
    const calendarBE = d.getFullYear() + 543;
    if (mode === 'fiscal_be') {
      return d.getMonth() >= 9 ? calendarBE + 1 : calendarBE;
    }
    return calendarBE;
  }
  return getCaseFilingBuddhistYear(caseItem);
}

/**
 * ตรวจสอบว่าสำนวนอยู่ในสถานะ "เร่งด่วน" (เกินกำหนด / ≤ 7 วัน / อ.กุลชาติรอยืนยัน)
 */
function isCaseUrgentActive(caseItem: AppealCase): boolean {
  if (caseItem.isCompleted && !isKunchartCompletedPendingNoAppealAlert(caseItem)) {
    return false;
  }
  const u = getAppealUrgency(caseItem);
  return u === 'overdue' || u === 'critical' || u === 'warning';
}

/**
 * ตรวจสอบว่าสำนวนเป็น "สำนวนค้างยกมาจากปีก่อน" (ฟ้องในปี < targetYearBE และยังไม่เสร็จสิ้น ไม่ได้จำหน่ายชั่วคราว)
 */
export function isCaseCarryOverFromPriorYear(
  caseItem: AppealCase,
  targetYearBE: number,
  mode: AnnualYearMode = 'calendar_be'
): boolean {
  const caseYear = getCaseBuddhistYearByMode(caseItem, mode);
  if (caseYear === null || caseYear >= targetYearBE) return false;
  if (isCaseTemporarilyDischarged(caseItem)) return false;
  if (caseItem.isCompleted && !isKunchartCompletedPendingNoAppealAlert(caseItem)) {
    return false;
  }
  return true;
}

/**
 * ดึงรายการปี พ.ศ. ทั้งหมดที่มีข้อมูลในระบบ (รวมปี พ.ศ. ปัจจุบันเสมอ) เรียงจากปีล่าสุดไปเก่าสุด
 */
export function getAvailableBuddhistYears(
  cases: AppealCase[],
  mode: AnnualYearMode = 'calendar_be',
  refDate: Date = new Date()
): number[] {
  const currentBE = getCurrentBuddhistYear(mode, refDate);
  const yearSet = new Set<number>([currentBE]);

  for (const c of cases) {
    const y = getCaseBuddhistYearByMode(c, mode);
    if (y !== null && y >= 2540 && y <= 2650) {
      yearSet.add(y);
    }
  }

  return Array.from(yearSet).sort((a, b) => b - a);
}

/**
 * เรียงลำดับสำนวนภายในปี พ.ศ. เดียวกัน เพื่อออกเลขลำดับคุมสำนวนประจำปี (1/พ.ศ., 2/พ.ศ., ...)
 * เมื่อขึ้นปี พ.ศ. ใหม่ ลำดับจะเริ่มนับ 1 ใหม่อัตโนมัติ
 */
function sortCasesChronologicallyForSequence(a: AppealCase, b: AppealCase): number {
  const da = getCaseFilingDateObj(a)?.getTime() ?? 0;
  const db = getCaseFilingDateObj(b)?.getTime() ?? 0;
  if (da !== db) return da - db;

  const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (ca !== cb) return ca - cb;

  return (a.blackCaseNo || '').localeCompare(b.blackCaseNo || '', 'th');
}

/**
 * สร้างแผนที่เลขลำดับคุมสำนวนรายปี พ.ศ. สำหรับทุกสำนวนในระบบ (caseId -> AnnualSequenceInfo)
 * เช่น ปี พ.ศ. 2569 นับ 1/2569..N/2569 และเมื่อขึ้นปี พ.ศ. 2570 เริ่มนับ 1/2570 ใหม่ทันที
 */
export function buildAnnualRunningSequenceMap(
  cases: AppealCase[],
  mode: AnnualYearMode = 'calendar_be'
): Map<string, AnnualSequenceInfo> {
  const groupedByYear = new Map<number, AppealCase[]>();

  for (const c of cases) {
    const yearBE = getCaseBuddhistYearByMode(c, mode);
    if (yearBE === null) continue;
    const list = groupedByYear.get(yearBE) || [];
    list.push(c);
    groupedByYear.set(yearBE, list);
  }

  const seqMap = new Map<string, AnnualSequenceInfo>();

  groupedByYear.forEach((yearCases, yearBE) => {
    const sorted = [...yearCases].sort(sortCasesChronologicallyForSequence);
    const total = sorted.length;
    sorted.forEach((c, idx) => {
      const seqNo = idx + 1;
      seqMap.set(c.id, {
        yearBE,
        sequenceNo: seqNo,
        yearTotal: total,
        formattedNo: `${seqNo}/${yearBE}`,
      });
    });
  });

  return seqMap;
}

/**
 * คาดการณ์เลขลำดับคุมสำนวนประจำปี พ.ศ. สำหรับสำนวนใหม่ที่กำลังจะบันทึกตามวันที่ยื่นฟ้อง
 * หากวันที่ยื่นฟ้องเข้าสู่ปี พ.ศ. ใหม่ที่ยังไม่มีสำนวน จะแสดงผลว่า "เริ่มนับลำดับที่ 1/พ.ศ. ใหม่"
 */
export function getNextAnnualSequencePreview(
  existingCases: AppealCase[],
  filingDateStr: string,
  mode: AnnualYearMode = 'calendar_be'
): {
  yearBE: number;
  existingCountInYear: number;
  nextSequenceNo: number;
  formattedNo: string;
  isNewYearStart: boolean;
} | null {
  const parsed = parseDateStringRobust(filingDateStr);
  if (!parsed) return null;

  const calendarBE = parsed.getFullYear() + 543;
  const yearBE = mode === 'fiscal_be' && parsed.getMonth() >= 9 ? calendarBE + 1 : calendarBE;

  const existingCountInYear = existingCases.filter(
    (c) => getCaseBuddhistYearByMode(c, mode) === yearBE
  ).length;
  const nextSequenceNo = existingCountInYear + 1;

  return {
    yearBE,
    existingCountInYear,
    nextSequenceNo,
    formattedNo: `${nextSequenceNo}/${yearBE}`,
    isNewYearStart: existingCountInYear === 0,
  };
}

/**
 * กรองรายชื่อสำนวนตามขอบเขตปี พ.ศ. ที่เลือก
 */
export function filterCasesByYearScope(
  cases: AppealCase[],
  yearScope: number | 'all',
  options: {
    mode?: AnnualYearMode;
    includeCarryOver?: boolean;
  } = {}
): {
  scopedCases: AppealCase[];
  pureYearCases: AppealCase[];
  carryOverCases: AppealCase[];
} {
  const mode = options.mode ?? 'calendar_be';
  const includeCarryOver = options.includeCarryOver ?? false;

  if (yearScope === 'all') {
    return {
      scopedCases: cases,
      pureYearCases: cases,
      carryOverCases: [],
    };
  }

  const pureYearCases: AppealCase[] = [];
  const carryOverCases: AppealCase[] = [];

  for (const c of cases) {
    const caseYear = getCaseBuddhistYearByMode(c, mode);
    if (caseYear === yearScope) {
      pureYearCases.push(c);
    } else if (isCaseCarryOverFromPriorYear(c, yearScope, mode)) {
      carryOverCases.push(c);
    }
  }

  return {
    scopedCases: includeCarryOver ? [...pureYearCases, ...carryOverCases] : pureYearCases,
    pureYearCases,
    carryOverCases,
  };
}

/**
 * สร้างรายการโครงสร้าง 12 เดือนของปี พ.ศ. ที่เลือก (รองรับทั้งปีปฏิทินและปีงบประมาณ)
 */
function buildEmptyTwelveMonths(yearBE: number, mode: AnnualYearMode): AnnualMonthBucket[] {
  const months: AnnualMonthBucket[] = [];
  const yearCE = yearBE - 543;

  if (mode === 'fiscal_be') {
    // ปีงบประมาณ พ.ศ. X = ต.ค.–ธ.ค. ของปี (X-1) และ ม.ค.–ก.ย. ของปี X
    const prevYearCE = yearCE - 1;
    const prevYearBE = yearBE - 1;
    for (let m = 9; m <= 11; m++) {
      const mm = String(m + 1).padStart(2, '0');
      months.push({
        monthKey: `${prevYearCE}-${mm}`,
        yearCE: prevYearCE,
        yearBE: prevYearBE,
        monthIndex: m,
        monthLabel: `${THAI_MONTHS_FULL[m]} ${prevYearBE}`,
        shortLabel: `${THAI_MONTHS_SHORT[m]} ${String(prevYearBE).slice(-2)}`,
        totalCases: 0,
        cumulativeTotal: 0,
        seqStart: null,
        seqEnd: null,
        confessedCount: 0,
        deniedCount: 0,
        requisitionCount: 0,
        dischargedCount: 0,
        unspecifiedCount: 0,
        otherCount: 0,
        hasJudgmentCount: 0,
        submittedToDutyCount: 0,
        completedCount: 0,
        pendingCount: 0,
        urgentCount: 0,
        cases: [],
      });
    }
    for (let m = 0; m <= 8; m++) {
      const mm = String(m + 1).padStart(2, '0');
      months.push({
        monthKey: `${yearCE}-${mm}`,
        yearCE,
        yearBE,
        monthIndex: m,
        monthLabel: `${THAI_MONTHS_FULL[m]} ${yearBE}`,
        shortLabel: `${THAI_MONTHS_SHORT[m]} ${String(yearBE).slice(-2)}`,
        totalCases: 0,
        cumulativeTotal: 0,
        seqStart: null,
        seqEnd: null,
        confessedCount: 0,
        deniedCount: 0,
        requisitionCount: 0,
        dischargedCount: 0,
        unspecifiedCount: 0,
        otherCount: 0,
        hasJudgmentCount: 0,
        submittedToDutyCount: 0,
        completedCount: 0,
        pendingCount: 0,
        urgentCount: 0,
        cases: [],
      });
    }
  } else {
    // ปีปฏิทิน พ.ศ. X = ม.ค.–ธ.ค. ของปี X
    for (let m = 0; m < 12; m++) {
      const mm = String(m + 1).padStart(2, '0');
      months.push({
        monthKey: `${yearCE}-${mm}`,
        yearCE,
        yearBE,
        monthIndex: m,
        monthLabel: `${THAI_MONTHS_FULL[m]} ${yearBE}`,
        shortLabel: THAI_MONTHS_SHORT[m],
        totalCases: 0,
        cumulativeTotal: 0,
        seqStart: null,
        seqEnd: null,
        confessedCount: 0,
        deniedCount: 0,
        requisitionCount: 0,
        dischargedCount: 0,
        unspecifiedCount: 0,
        otherCount: 0,
        hasJudgmentCount: 0,
        submittedToDutyCount: 0,
        completedCount: 0,
        pendingCount: 0,
        urgentCount: 0,
        cases: [],
      });
    }
  }

  return months;
}

/**
 * จำแนกหมวดหมู่หลักของสำนวนแบบไม่ซ้ำซ้อน (mutually exclusive) เพื่อรวมยอดได้ตรง 100%
 */
function classifyPrimaryStage(
  caseItem: AppealCase
): 'discharged' | 'unspecified' | 'confessed' | 'denied' | 'requisition' | 'other' {
  if (isCaseTemporarilyDischarged(caseItem)) return 'discharged';
  if (isCaseUnspecifiedStage(caseItem)) return 'unspecified';
  if (isCaseConfessed(caseItem)) return 'confessed';
  if (isCaseDenied(caseItem)) return 'denied';
  if (isCaseRequisition(caseItem)) return 'requisition';
  return 'other';
}

/**
 * คำนวณรายงานคุมจำนวนสำนวนรายปี พ.ศ. แบบครบถ้วน
 */
export function getAnnualCaseControlSummary(
  cases: AppealCase[],
  yearBE: number,
  mode: AnnualYearMode = 'calendar_be',
  refDate: Date = new Date()
): AnnualYearSummary {
  const currentBE = getCurrentBuddhistYear(mode, refDate);
  const previousYearBE = yearBE - 1;

  const yearCases = cases
    .filter((c) => getCaseBuddhistYearByMode(c, mode) === yearBE)
    .sort(sortCasesChronologicallyForSequence);

  const previousYearTotal = cases.filter(
    (c) => getCaseBuddhistYearByMode(c, mode) === previousYearBE
  ).length;

  const carryOverCases = cases
    .filter((c) => isCaseCarryOverFromPriorYear(c, yearBE, mode))
    .sort((a, b) => {
      const ua = isCaseUrgentActive(a) ? 0 : 1;
      const ub = isCaseUrgentActive(b) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      const da = a.extendedDeadline || a.appealDeadline ? getDaysRemaining(a) : 9999;
      const db = b.extendedDeadline || b.appealDeadline ? getDaysRemaining(b) : 9999;
      return da - db;
    });

  const carryOverUrgentCount = carryOverCases.filter(isCaseUrgentActive).length;

  const months = buildEmptyTwelveMonths(yearBE, mode);
  const monthMap = new Map<string, AnnualMonthBucket>();
  months.forEach((m) => monthMap.set(m.monthKey, m));

  const prosecutorMap = new Map<string, AnnualProsecutorBucket>();

  let completedThisYear = 0;
  let pendingThisYear = 0;
  let urgentThisYear = 0;
  let overdueThisYear = 0;
  let confessedCount = 0;
  let deniedCount = 0;
  let requisitionCount = 0;
  let dischargedCount = 0;
  let unspecifiedCount = 0;
  let otherCount = 0;
  let hasJudgmentCount = 0;
  let submittedToDutyCount = 0;

  const yearCasesWithSequence: AnnualCaseWithSequence[] = yearCases.map((c, idx) => {
    const sequenceNo = idx + 1;
    const stage = classifyPrimaryStage(c);
    const hasJudg = isJudgmentRecorded(c);
    const isSubmitted = Boolean(c.isSubmittedToDuty);
    const isCompleted = Boolean(c.isCompleted);
    const isUrgent = isCaseUrgentActive(c);
    const urgency = getAppealUrgency(c);

    if (isCompleted) completedThisYear++;
    else pendingThisYear++;

    if (isUrgent) urgentThisYear++;
    if (!isCompleted && urgency === 'overdue') overdueThisYear++;
    if (hasJudg) hasJudgmentCount++;
    if (isSubmitted) submittedToDutyCount++;

    if (stage === 'confessed') confessedCount++;
    else if (stage === 'denied') deniedCount++;
    else if (stage === 'requisition') requisitionCount++;
    else if (stage === 'discharged') dischargedCount++;
    else if (stage === 'unspecified') unspecifiedCount++;
    else otherCount++;

    // เติมลงเดือน
    const d = getCaseFilingDateObj(c);
    if (d) {
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthMap.get(mKey);
      if (bucket) {
        bucket.totalCases++;
        bucket.cases.push(c);
        if (stage === 'confessed') bucket.confessedCount++;
        else if (stage === 'denied') bucket.deniedCount++;
        else if (stage === 'requisition') bucket.requisitionCount++;
        else if (stage === 'discharged') bucket.dischargedCount++;
        else if (stage === 'unspecified') bucket.unspecifiedCount++;
        else bucket.otherCount++;

        if (hasJudg) bucket.hasJudgmentCount++;
        if (isSubmitted) bucket.submittedToDutyCount++;
        if (isCompleted) bucket.completedCount++;
        else bucket.pendingCount++;
        if (isUrgent) bucket.urgentCount++;
      }
    }

    // เติมลงอัยการเจ้าของสำนวน
    const pName = (c.prosecutorName || c.responsiblePerson || '').trim() || 'ยังไม่ระบุชื่ออัยการ';
    let pBucket = prosecutorMap.get(pName);
    if (!pBucket) {
      pBucket = {
        prosecutorName: pName,
        totalCases: 0,
        sharePercent: 0,
        confessedCount: 0,
        deniedCount: 0,
        requisitionCount: 0,
        dischargedCount: 0,
        unspecifiedCount: 0,
        completedCount: 0,
        pendingCount: 0,
        urgentCount: 0,
        completionRate: 0,
        cases: [],
      };
      prosecutorMap.set(pName, pBucket);
    }
    pBucket.totalCases++;
    pBucket.cases.push(c);
    if (stage === 'confessed') pBucket.confessedCount++;
    else if (stage === 'denied') pBucket.deniedCount++;
    else if (stage === 'requisition') pBucket.requisitionCount++;
    else if (stage === 'discharged') pBucket.dischargedCount++;
    else if (stage === 'unspecified') pBucket.unspecifiedCount++;
    if (isCompleted) pBucket.completedCount++;
    else pBucket.pendingCount++;
    if (isUrgent) pBucket.urgentCount++;

    return {
      caseItem: c,
      sequenceNo,
      yearBE,
      formattedNo: `${sequenceNo}/${yearBE}`,
    };
  });

  // คำนวณยอดสะสมและช่วงลำดับที่ (1–N) สำหรับทั้ง 12 เดือน
  let runningTotal = 0;
  let activeMonthsCount = 0;
  let peakMonth: AnnualMonthBucket | null = null;

  for (const m of months) {
    if (m.totalCases > 0) {
      m.seqStart = runningTotal + 1;
      runningTotal += m.totalCases;
      m.seqEnd = runningTotal;
      activeMonthsCount++;
      if (!peakMonth || m.totalCases > peakMonth.totalCases) {
        peakMonth = m;
      }
    }
    m.cumulativeTotal = runningTotal;
  }

  const totalFiledThisYear = yearCases.length;
  const prosecutors = Array.from(prosecutorMap.values())
    .map((p) => ({
      ...p,
      sharePercent: totalFiledThisYear > 0 ? Math.round((p.totalCases / totalFiledThisYear) * 1000) / 10 : 0,
      completionRate: p.totalCases > 0 ? Math.round((p.completedCount / p.totalCases) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalCases - a.totalCases || a.prosecutorName.localeCompare(b.prosecutorName, 'th'));

  const yoyDelta = totalFiledThisYear - previousYearTotal;
  const yoyPercent =
    previousYearTotal > 0 ? Math.round((yoyDelta / previousYearTotal) * 1000) / 10 : null;

  const periodLabel =
    mode === 'fiscal_be'
      ? `1 ต.ค. ${yearBE - 1} – 30 ก.ย. ${yearBE}`
      : `1 ม.ค. ${yearBE} – 31 ธ.ค. ${yearBE}`;

  return {
    yearBE,
    mode,
    isCurrentYear: yearBE === currentBE,
    isFutureYear: yearBE > currentBE,
    periodLabel,
    totalFiledThisYear,
    previousYearBE,
    previousYearTotal,
    yoyDelta,
    yoyPercent,
    carryOverCases,
    carryOverUrgentCount,
    completedThisYear,
    pendingThisYear,
    urgentThisYear,
    overdueThisYear,
    completionRate:
      totalFiledThisYear > 0 ? Math.round((completedThisYear / totalFiledThisYear) * 1000) / 10 : 0,
    confessedCount,
    deniedCount,
    requisitionCount,
    dischargedCount,
    unspecifiedCount,
    otherCount,
    hasJudgmentCount,
    submittedToDutyCount,
    activeMonthsCount,
    avgPerActiveMonth:
      activeMonthsCount > 0 ? Math.round((totalFiledThisYear / activeMonthsCount) * 10) / 10 : 0,
    peakMonth,
    months,
    prosecutors,
    yearCasesWithSequence,
  };
}

/**
 * สร้างตารางเปรียบเทียบยอดสำนวนข้ามปี พ.ศ.
 */
export function getMultiYearComparison(
  cases: AppealCase[],
  mode: AnnualYearMode = 'calendar_be',
  includeNextYearPreview: boolean = true,
  refDate: Date = new Date()
): AnnualYearComparisonRow[] {
  const currentBE = getCurrentBuddhistYear(mode, refDate);
  const years = new Set<number>(getAvailableBuddhistYears(cases, mode, refDate));
  if (includeNextYearPreview) {
    years.add(currentBE + 1);
  }

  return Array.from(years)
    .sort((a, b) => b - a)
    .map((yearBE) => {
      const s = getAnnualCaseControlSummary(cases, yearBE, mode, refDate);
      return {
        yearBE,
        isCurrentYear: s.isCurrentYear,
        isFutureYear: s.isFutureYear,
        totalFiled: s.totalFiledThisYear,
        avgPerActiveMonth: s.avgPerActiveMonth,
        confessedCount: s.confessedCount,
        deniedCount: s.deniedCount,
        requisitionCount: s.requisitionCount,
        dischargedCount: s.dischargedCount,
        completedCount: s.completedThisYear,
        pendingCount: s.pendingThisYear,
        urgentCount: s.urgentThisYear,
        completionRate: s.completionRate,
        carryOverIntoYearCount: s.carryOverCases.length,
      };
    });
}

// ==================== Export Helpers (Excel TSV / HTML / CSV) ====================

function escapeCsvCell(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatAnnualMonthlyTsv(summary: AnnualYearSummary): string {
  const modeTitle =
    summary.mode === 'fiscal_be'
      ? `ปีงบประมาณ พ.ศ. ${summary.yearBE} (${summary.periodLabel})`
      : `ปี พ.ศ. ${summary.yearBE} (${summary.periodLabel})`;

  const lines: string[] = [
    `บัญชีคุมจำนวนสำนวนรายปี\t${modeTitle}`,
    `ยอดฟ้องใหม่ทั้งปี\t${summary.totalFiledThisYear} สำนวน\tค้างยกมาจากปีก่อน\t${summary.carryOverCases.length} สำนวน`,
    '',
    [
      'เดือน',
      'ช่วงลำดับที่ประจำปี',
      'จำนวนฟ้องใหม่ (สำนวน)',
      'ยอดสะสมต้นปี',
      'รับสารภาพ',
      'ปฏิเสธ',
      'เบิกฟ้อง',
      'จำหน่ายชั่วคราว',
      'ยังไม่ระบุ/อื่นๆ',
      'มีคำพิพากษาแล้ว',
      'เสนอเวรชี้แล้ว',
      'เสร็จสิ้นแล้ว',
      'คงค้างดำเนินการ',
    ].join('\t'),
  ];

  for (const m of summary.months) {
    const seqRange =
      m.seqStart !== null && m.seqEnd !== null
        ? `${m.seqStart}/${summary.yearBE}–${m.seqEnd}/${summary.yearBE}`
        : '-';
    lines.push(
      [
        m.monthLabel,
        seqRange,
        m.totalCases,
        m.cumulativeTotal,
        m.confessedCount,
        m.deniedCount,
        m.requisitionCount,
        m.dischargedCount,
        m.unspecifiedCount + m.otherCount,
        m.hasJudgmentCount,
        m.submittedToDutyCount,
        m.completedCount,
        m.pendingCount,
      ].join('\t')
    );
  }

  lines.push(
    [
      `รวมทั้งปี พ.ศ. ${summary.yearBE}`,
      summary.totalFiledThisYear > 0 ? `1/${summary.yearBE}–${summary.totalFiledThisYear}/${summary.yearBE}` : '-',
      summary.totalFiledThisYear,
      summary.totalFiledThisYear,
      summary.confessedCount,
      summary.deniedCount,
      summary.requisitionCount,
      summary.dischargedCount,
      summary.unspecifiedCount + summary.otherCount,
      summary.hasJudgmentCount,
      summary.submittedToDutyCount,
      summary.completedThisYear,
      summary.pendingThisYear,
    ].join('\t')
  );

  return lines.join('\n');
}

export function formatAnnualMonthlyHtml(summary: AnnualYearSummary): string {
  const modeTitle =
    summary.mode === 'fiscal_be'
      ? `ปีงบประมาณ พ.ศ. ${summary.yearBE} (${summary.periodLabel})`
      : `ปี พ.ศ. ${summary.yearBE} (${summary.periodLabel})`;

  const rowsHtml = summary.months
    .map((m) => {
      const seqRange =
        m.seqStart !== null && m.seqEnd !== null
          ? `${m.seqStart}/${summary.yearBE}–${m.seqEnd}/${summary.yearBE}`
          : '-';
      return `<tr>
        <td>${escapeHtml(m.monthLabel)}</td>
        <td style="text-align:center;">${escapeHtml(seqRange)}</td>
        <td style="text-align:right;font-weight:bold;">${m.totalCases}</td>
        <td style="text-align:right;">${m.cumulativeTotal}</td>
        <td style="text-align:right;">${m.confessedCount}</td>
        <td style="text-align:right;">${m.deniedCount}</td>
        <td style="text-align:right;">${m.requisitionCount}</td>
        <td style="text-align:right;">${m.dischargedCount}</td>
        <td style="text-align:right;">${m.unspecifiedCount + m.otherCount}</td>
        <td style="text-align:right;">${m.hasJudgmentCount}</td>
        <td style="text-align:right;">${m.submittedToDutyCount}</td>
        <td style="text-align:right;">${m.completedCount}</td>
        <td style="text-align:right;">${m.pendingCount}</td>
      </tr>`;
    })
    .join('');

  return `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:Sarabun,sans-serif;font-size:13px;">
    <thead>
      <tr style="background:#0f172a;color:#ffffff;">
        <th colspan="13" style="text-align:left;font-size:15px;">บัญชีคุมจำนวนสำนวนรายปี — ${escapeHtml(modeTitle)}</th>
      </tr>
      <tr style="background:#f1f5f9;">
        <th>เดือน</th>
        <th>ช่วงลำดับที่ประจำปี</th>
        <th>จำนวนฟ้องใหม่</th>
        <th>สะสมต้นปี</th>
        <th>รับสารภาพ</th>
        <th>ปฏิเสธ</th>
        <th>เบิกฟ้อง</th>
        <th>จำหน่ายชั่วคราว</th>
        <th>ยังไม่ระบุ/อื่นๆ</th>
        <th>มีคำพิพากษา</th>
        <th>เสนอเวรชี้</th>
        <th>เสร็จสิ้น</th>
        <th>คงค้าง</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr style="background:#fef3c7;font-weight:bold;">
        <td>รวมทั้งปี พ.ศ. ${summary.yearBE}</td>
        <td style="text-align:center;">${summary.totalFiledThisYear > 0 ? `1/${summary.yearBE}–${summary.totalFiledThisYear}/${summary.yearBE}` : '-'}</td>
        <td style="text-align:right;">${summary.totalFiledThisYear}</td>
        <td style="text-align:right;">${summary.totalFiledThisYear}</td>
        <td style="text-align:right;">${summary.confessedCount}</td>
        <td style="text-align:right;">${summary.deniedCount}</td>
        <td style="text-align:right;">${summary.requisitionCount}</td>
        <td style="text-align:right;">${summary.dischargedCount}</td>
        <td style="text-align:right;">${summary.unspecifiedCount + summary.otherCount}</td>
        <td style="text-align:right;">${summary.hasJudgmentCount}</td>
        <td style="text-align:right;">${summary.submittedToDutyCount}</td>
        <td style="text-align:right;">${summary.completedThisYear}</td>
        <td style="text-align:right;">${summary.pendingThisYear}</td>
      </tr>
    </tfoot>
  </table>`;
}

export function downloadAnnualMonthlyCsv(summary: AnnualYearSummary): void {
  const headers = [
    'เดือน',
    'ช่วงลำดับที่ประจำปี',
    'จำนวนฟ้องใหม่ (สำนวน)',
    'ยอดสะสมต้นปี',
    'รับสารภาพ',
    'ปฏิเสธ',
    'เบิกฟ้อง',
    'จำหน่ายชั่วคราว',
    'ยังไม่ระบุ/อื่นๆ',
    'มีคำพิพากษาแล้ว',
    'เสนอเวรชี้แล้ว',
    'เสร็จสิ้นแล้ว',
    'คงค้างดำเนินการ',
  ];

  const rows = summary.months.map((m) => [
    m.monthLabel,
    m.seqStart !== null && m.seqEnd !== null ? `${m.seqStart}/${summary.yearBE}-${m.seqEnd}/${summary.yearBE}` : '-',
    m.totalCases,
    m.cumulativeTotal,
    m.confessedCount,
    m.deniedCount,
    m.requisitionCount,
    m.dischargedCount,
    m.unspecifiedCount + m.otherCount,
    m.hasJudgmentCount,
    m.submittedToDutyCount,
    m.completedCount,
    m.pendingCount,
  ]);

  rows.push([
    `รวมทั้งปี พ.ศ. ${summary.yearBE}`,
    summary.totalFiledThisYear > 0 ? `1/${summary.yearBE}-${summary.totalFiledThisYear}/${summary.yearBE}` : '-',
    summary.totalFiledThisYear,
    summary.totalFiledThisYear,
    summary.confessedCount,
    summary.deniedCount,
    summary.requisitionCount,
    summary.dischargedCount,
    summary.unspecifiedCount + summary.otherCount,
    summary.hasJudgmentCount,
    summary.submittedToDutyCount,
    summary.completedThisYear,
    summary.pendingThisYear,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const suffix = summary.mode === 'fiscal_be' ? 'ปีงบประมาณ' : 'ปีพศ';
  link.download = `บัญชีคุมจำนวนสำนวนรายปี_${suffix}_${summary.yearBE}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadAnnualCasesLedgerCsv(summary: AnnualYearSummary): void {
  const headers = [
    'ลำดับคุมรายปี',
    'วันที่ยื่นฟ้อง',
    'เลขคดีดำ',
    'เลขคดีแดง',
    'เลขรับ ส.1',
    'เลขฟ้อง ส.4',
    'อัยการเจ้าของสำนวน',
    'จำเลย',
    'วันพิพากษา',
    'ครบกำหนดอุทธรณ์',
    'เสนอเวรชี้',
    'สถานะดำเนินการ',
  ];

  const rows = summary.yearCasesWithSequence.map(({ caseItem, formattedNo }) => {
    const deadline = caseItem.extendedDeadline || caseItem.appealDeadline || '';
    return [
      formattedNo,
      formatThaiDate(caseItem.filingDate, { short: true }),
      caseItem.blackCaseNo,
      caseItem.redCaseNo || '-',
      caseItem.receivedNumberS1 || '-',
      caseItem.filingNumberS4 || '-',
      caseItem.prosecutorName || caseItem.responsiblePerson || '-',
      caseItem.defendant || '-',
      caseItem.judgmentDate ? formatThaiDate(caseItem.judgmentDate, { short: true }) : '-',
      deadline ? formatThaiDate(deadline, { short: true }) : '-',
      caseItem.isSubmittedToDuty ? 'เสนอเวรชี้แล้ว' : 'ยังไม่เสนอเวรชี้',
      caseItem.isCompleted
        ? 'เสร็จสิ้นแล้ว'
        : isCaseTemporarilyDischarged(caseItem)
          ? 'จำหน่ายคดีชั่วคราว'
          : 'อยู่ระหว่างดำเนินการ',
    ];
  });

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ทะเบียนคุมลำดับสำนวนประจำปี_พศ_${summary.yearBE}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
