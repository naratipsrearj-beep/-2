import { AppealCase, CourtAppointmentType } from '../types/appeal';
import { formatThaiDate } from './dateUtils';

/**
 * ตรวจสอบว่าสำนวนนี้ยังไม่ได้เลือกสถานะการพิจารณาของศาลหรือไม่
 * (เช่น ผู้ใช้บันทึกคุมสำนวนที่จะฟ้องในวันไว้ก่อน โดยยังไม่ระบุผลการพิจารณา)
 */
export function isCaseUnspecifiedStage(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  if (c.isUnspecifiedStage === true || c.courtStageStatus === 'unspecified') return true;
  // หากไม่มีคำพิพากษา, ไม่มีคำให้การ, ไม่มีนัด, ไม่ใช่เบิกฟ้อง, ไม่ใช่แยกฟ้อง และยังไม่เสร็จสิ้น
  if (
    !c.hasJudgment &&
    !c.judgmentDate &&
    !c.defendantPlea &&
    (!c.appointmentType || c.appointmentType === 'none') &&
    !c.isRequisitionCase &&
    !c.isSeveredCase &&
    !c.isCompleted
  ) {
    return true;
  }
  return false;
}

export function isCaseRequisition(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  if (isCaseUnspecifiedStage(c)) return false;
  // หากทราบผลคำให้การแล้วว่าจำเลยรับสารภาพหรือปฏิเสธ จะไม่ถือว่าเป็นสำนวนเบิกฟ้องที่รอผลอีกต่อไป
  if (c.defendantPlea === 'confessed' || c.defendantPlea === 'denied') return false;
  return Boolean(c.isRequisitionCase || c.appointmentType === 'requisition');
}

/**
 * ตรวจสอบว่าคดีนี้จำเลยให้การปฏิเสธหรือไม่
 * หมายเหตุ:
 * - จำเลยระบุคำให้การปฏิเสธ (denied)
 * - หากเดิมเป็นสำนวนมีนัดอื่นๆ หรือเบิกฟ้อง แล้วต่อมาทราบว่าปฏิเสธ ให้ถือว่าปฏิเสธทันที
 * - นัดคุ้มครองสิทธิ (rights_protection) ซึ่งจัดให้สำหรับจำเลยที่ให้การปฏิเสธ
 * - นัดสืบพยาน (witness_examination) หรือ นัดพร้อมตรวจพยาน (pre_trial)
 * - มีข้อความระบุว่า "ปฏิเสธ" หรือ "ให้การปฏิเสธ" ในหมายเหตุ หรือผลคำพิพากษา
 */
export function isCaseDenied(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  if (isCaseUnspecifiedStage(c)) return false;
  // หากจำเลยระบุว่ารับสารภาพโดยตรง ต้องไม่ถือว่าปฏิเสธเด็ดขาด
  if (c.defendantPlea === 'confessed') return false;

  // 1. จำเลยระบุคำให้การปฏิเสธชัดเจน (มีความสำคัญสูงสุด หากเดิมเป็นสำนวนมีนัดอื่นแล้วต่อมาทราบว่าปฏิเสธ)
  if (c.defendantPlea === 'denied') return true;

  // หากคดีมีคำพิพากษาและวันที่พิพากษาแล้ว (และไม่ได้ระบุว่าปฏิเสธข้างต้น) ถือว่าคดีเสร็จไปด้วยคำพิพากษา/รับสารภาพ
  if (Boolean(c.hasJudgment && c.judgmentDate)) return false;

  // สำนวนเบิกฟ้องที่ยังรอผล (และยังไม่ทราบคำให้การ)
  if (isCaseRequisition(c)) return false;

  // 2. นัดคุ้มครองสิทธิ (rights_protection) ซึ่งจัดให้สำหรับจำเลยที่ปฏิเสธ และยังไม่มีคำพิพากษา
  if (c.appointmentType === 'rights_protection') return true;

  // 3. นัดสืบพยาน หรือนัดพร้อมตรวจพยานหลักฐาน
  if (c.appointmentType === 'witness_examination' || c.appointmentType === 'pre_trial') return true;

  // 4. มีข้อความระบุว่า "ปฏิเสธ" ในหมายเหตุ หรือผลคำพิพากษา
  if (typeof c.notes === 'string' && c.notes.includes('ปฏิเสธ')) return true;
  if (typeof c.appointmentNotes === 'string' && c.appointmentNotes.includes('ปฏิเสธ')) return true;
  if (typeof c.judgmentOutcome === 'string' && c.judgmentOutcome.includes('ปฏิเสธ')) return true;
  return false;
}

/**
 * ตรวจสอบว่าคดีนี้จำเลยให้การรับสารภาพหรือไม่
 * ทั้งจากคำให้การโดยตรง, มีคำพิพากษาแล้ว, ผลคำพิพากษา, หรือบันทึกหมายเหตุ
 * หมายเหตุ:
 * - หากเดิมเป็นสำนวนมีนัดอื่นๆ หรือเบิกฟ้อง แล้วต่อมาทราบว่าจำเลยรับสารภาพ ให้ถือว่ารับสารภาพทันที
 */
export function isCaseConfessed(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  if (isCaseUnspecifiedStage(c)) return false;
  // หากจำเลยระบุว่าปฏิเสธชัดเจน ต้องไม่ถือว่ารับสารภาพ
  if (c.defendantPlea === 'denied') return false;

  // 1. จำเลยระบุคำให้การรับสารภาพโดยตรง (มีความสำคัญสูงสุด หากเดิมเป็นสำนวนมีนัดอื่นแล้วต่อมาทราบว่ารับสารภาพ)
  if (c.defendantPlea === 'confessed') return true;

  // สำนวนเบิกฟ้องที่ยังรอผล (และยังไม่ระบุคำให้การ)
  if (isCaseRequisition(c)) return false;

  // 2. คดีที่มีคำพิพากษาและวันที่พิพากษาแล้ว (และไม่ได้ระบุว่าปฏิเสธ)
  if (Boolean(c.hasJudgment && c.judgmentDate)) return true;

  // 3. ตรวจสอบข้อความปฏิเสธ
  if (isCaseDenied(c)) return false;

  // 4. มีข้อความ "รับสารภาพ" ในผลคำพิพากษา
  if (typeof c.judgmentOutcome === 'string' && c.judgmentOutcome.toLowerCase().includes('รับสารภาพ')) return true;
  // มีข้อความ "รับสารภาพ" ในหมายเหตุ
  if (typeof c.notes === 'string' && c.notes.toLowerCase().includes('รับสารภาพ')) return true;
  // มีข้อความ "รับสารภาพ" ในหมายเหตุนัด
  if (typeof c.appointmentNotes === 'string' && c.appointmentNotes.toLowerCase().includes('รับสารภาพ')) return true;

  return false;
}

/**
 * ตรวจสอบว่าสำนวนคดีมีนัดต่อหรือไม่ (เช่น จำเลยปฏิเสธ มีนัดสืบพยาน, มีนัดพร้อม, นัดคุ้มครองสิทธิ, นัดไกล่เกลี่ย, นัดฟังคำสั่ง, นัดอื่นๆ หรือสำนวนเบิกฟ้อง)
 * หมายเหตุ: หากคดีมีคำพิพากษาแล้ว หรือเป็นสำนวนที่จำเลยรับสารภาพ จะถือว่ากระบวนพิจารณานัดเสร็จสิ้นแล้ว ไม่ใช่นัดต่อ
 */
export function hasContinuousAppointment(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  // หากมีคำพิพากษาแล้ว หรือจำเลยรับสารภาพ ถือว่านัดเสร็จสิ้นแล้ว
  if (Boolean(c.hasJudgment && c.judgmentDate) || c.defendantPlea === 'confessed') return false;
  // สำนวนเบิกฟ้อง ถือว่ามีนัดต่อเบิกตัวมาฟ้อง
  if (isCaseRequisition(c)) return true;
  // มีวันนัดศาล หรือประเภทนัดที่ไม่ใช่ none
  if (c.appointmentDate && c.appointmentType && c.appointmentType !== 'none') return true;
  if (c.appointmentType && c.appointmentType !== 'none') return true;
  if (c.subsequentAppointments && c.subsequentAppointments.length > 0) return true;
  // จำเลยปฏิเสธ (อยู่ระหว่างนัดพิจารณาคดีต่อ)
  if (c.defendantPlea === 'denied') return true;
  return false;
}

/**
 * ตรวจสอบว่าสำนวนคดีนี้มีการกรอกคำพิพากษาแล้วจริงหรือไม่
 * กฎเหล็ก:
 * 1. ต้องมีการยืนยันว่าศาลอ่านคำพิพากษาแล้ว (hasJudgment === true) ชัดเจน
 * 2. วันที่อ่านคำพิพากษาต้องมีจริงและไม่ว่างเปล่า (judgmentDate)
 * 3. ต้องมีการกรอกผลคำพิพากษา (judgmentOutcome) หรือเนื้อหาคำพิพากษา (fullJudgmentText) จริง
 *    ข้อความ placeholder หรือสถานะรอ เช่น "อยู่ระหว่างนัดคุ้มครองสิทธิ...", "สำนวนเบิกฟ้อง...",
 *    "รอฟังคำพิพากษา", "นัดฟังคำพิพากษา", "รอศาลพิพากษา", "ยังไม่มีคำพิพากษา", "รอผล", "สืบเสาะ",
 *    หรือกรณีที่ยังไม่มีการกรอกผลคำพิพากษาใดๆ แม้จะมีวันที่ที่ระบบใส่เริ่มต้นไว้
 *    จะถือว่า "ยังไม่ได้กรอกคำพิพากษา" เพื่อให้สอดคล้องกับข้อเท็จจริงของสำนวน
 */
export function isJudgmentRecorded(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  // 1. ถ้าคดีระบุชัดเจนว่ายังไม่มีคำพิพากษา หรือยังไม่ได้ระบุ hasJudgment เป็น true ถือว่ายังไม่กรอกคำพิพากษาเด็ดขาด
  if (c.hasJudgment !== true) return false;

  // 2. วันที่อ่านคำพิพากษาต้องมีจริงและไม่ว่างเปล่า
  if (!c.judgmentDate || typeof c.judgmentDate !== 'string' || c.judgmentDate.trim() === '') {
    return false;
  }

  // 3. ต้องมีผลคำพิพากษาหรือเนื้อหาคำพิพากษาที่กรอกไว้จริง
  const outcome = typeof c.judgmentOutcome === 'string' ? c.judgmentOutcome.trim() : '';
  const fullText = typeof c.fullJudgmentText === 'string' ? c.fullJudgmentText.trim() : '';

  if (outcome === '' && fullText === '') {
    return false;
  }

  // ตัวอักษรเครื่องหมายหรือคำว่างเปล่าที่ไม่ใช่เนื้อหาคำพิพากษา
  const placeholderTokens = ['-', '--', '---', '- -', 'n/a', 'na', 'null', 'undefined', 'ไม่มี', 'รอ', 'ยังไม่กรอก'];
  if (fullText === '' && placeholderTokens.includes(outcome.toLowerCase())) {
    return false;
  }

  // คำที่ไม่ใช่ผลคำพิพากษา (เป็นเพียงข้อความสถานะรอฟัง/นัดพิจารณา)
  const nonVerdictKeywords = [
    'อยู่ระหว่าง',
    'สำนวนเบิกฟ้อง',
    'รอคำให้การ',
    'รอฟังคำพิพากษา',
    'รออ่านคำพิพากษา',
    'นัดฟังคำพิพากษา',
    'นัดอ่านคำพิพากษา',
    'รอคำพิพากษา',
    'รอศาลพิพากษา',
    'ยังไม่อ่านคำพิพากษา',
    'ยังไม่มีคำพิพากษา',
    'ยังไม่กรอกคำพิพากษา',
    'ยังไม่กรอก',
    'ยังไม่ทราบ',
    'ยังไม่ทราบผล',
    'ยังไม่ทราบคำให้การ',
    'จำเลยปฏิเสธ',
    'จำเลยให้การปฏิเสธ',
    'รอคำสั่ง',
    'รอผล',
    'รอผลคำพิพากษา',
    'รอผลการชี้',
    'ยังไม่ตัดสิน',
    'รอตัดสิน',
    'รอเบิกตัว',
    'รอรายงานการสืบเสาะ',
    'รอสืบเสาะ',
    'สืบเสาะ',
    'ส่งตรวจพิสูจน์',
    'ส่งสถานพินิจ',
    'ไกล่เกลี่ย',
    'คุ้มครองสิทธิ',
    'สืบพยาน',
    'ตรวจพยาน',
    'นัดพร้อม',
    'รอนัด',
    'รอชี้',
    'เลื่อนนัด',
    'เลื่อน',
    'จำหน่ายคดีชั่วคราว',
    'ออกหมายจับ',
    'รอกำหนด',
    'ยังไม่ระบุ',
  ];

  if (fullText === '') {
    const isPendingStatus = nonVerdictKeywords.some((kw) => outcome.includes(kw));
    if (isPendingStatus && c.judgmentVerified !== true) {
      return false;
    }
  }

  return true;
}

/**
 * ตรวจสอบว่าสำนวนนี้ควรแจ้งเตือนว่า "ยังไม่กรอกคำพิพากษา" หรือไม่
 * กฎสำคัญตามคำสั่งผู้ใช้:
 * - สำนวนที่จำเลยปฏิเสธ (denied): ไม่ต้องแจ้งเตือนว่ายังไม่กรอกคำพิพากษาเด็ดขาด!
 *   เนื่องจากคดีอยู่ระหว่างกระบวนการนัดพิจารณา/สืบพยาน ยังไม่มีคำพิพากษาในทันที
 * - สำนวนเบิกฟ้อง (requisition): รอเบิกตัวมาฟ้อง ไม่ต้องแจ้งเตือนว่ายังไม่กรอกคำพิพากษา
 * - ให้แจ้งเตือนเฉพาะสำนวนที่ "รับสารภาพ" (confessed) เท่านั้น ที่ยังไม่ได้กรอกคำพิพากษา
 */
export function shouldAlertMissingJudgment(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  if (c.isCompleted) return false;
  if (isCaseUnspecifiedStage(c)) return false;
  if (isJudgmentRecorded(c)) return false;
  if (isCaseDenied(c)) return false;
  if (isCaseRequisition(c)) return false;
  return isCaseConfessed(c);
}

/**
 * ตรวจสอบว่านัดนี้ควรแสดงผลหรือไม่
 * กฎสำคัญ: คดีที่จำเลยรับสารภาพ จะไม่แสดงหรือแจ้งเตือน "นัดคุ้มครองสิทธิ" เด็ดขาด
 */
export function shouldDisplayAppointment(
  appointmentType?: CourtAppointmentType,
  caseItem?: Partial<AppealCase> | null
): boolean {
  if (!appointmentType || appointmentType === 'none') return false;
  if (appointmentType === 'rights_protection' && isCaseConfessed(caseItem)) {
    return false;
  }
  return true;
}

export function getAppointmentLabel(
  type?: CourtAppointmentType,
  customName?: string
): string {
  if (!type || type === 'none') return '';
  switch (type) {
    case 'rights_protection':
      return 'นัดคุ้มครองสิทธิ';
    case 'investigation':
      return 'นัดสืบเสาะ';
    case 'judgment':
      return 'นัดฟังคำพิพากษา';
    case 'mediation':
      return 'นัดไกล่เกลี่ย';
    case 'pre_trial':
      return 'นัดพร้อม / ตรวจพยาน';
    case 'witness_examination':
      return 'นัดสืบพยาน';
    case 'requisition':
      return 'นัดเบิกฟ้อง';
    case 'other':
      return customName || 'นัดอื่นๆ';
    default:
      return '';
  }
}

export function getAppointmentBadgeStyle(type?: CourtAppointmentType): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  switch (type) {
    case 'rights_protection':
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', icon: '🛡️' };
    case 'investigation':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: '🔍' };
    case 'judgment':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: '⚖️' };
    case 'mediation':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: '🤝' };
    case 'pre_trial':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', icon: '📋' };
    case 'witness_examination':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: '🎙️' };
    case 'requisition':
      return { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300', icon: '🚚' };
    case 'other':
      return { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300', icon: '📌' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: '⏳' };
  }
}

/**
 * คำนวณสถานะการแจ้งเตือนสำหรับ "สำนวนเบิกฟ้อง"
 * แจ้งเตือนเมื่อใกล้ถึงวันเบิกฟ้อง (<= 3 วัน หรือวันนี้)
 */
export function getRequisitionStatus(dateStr?: string): {
  daysLeft: number;
  isToday: boolean;
  isUrgent: boolean;
  isPast: boolean;
  label: string;
} {
  if (!dateStr) return { daysLeft: 999, isToday: false, isUrgent: false, isPast: false, label: '' };
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    const today = new Date();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((targetDate.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { daysLeft: 0, isToday: true, isUrgent: true, isPast: false, label: 'เบิกฟ้องวันนี้!' };
    }
    if (diffDays > 0 && diffDays <= 3) {
      return { daysLeft: diffDays, isToday: false, isUrgent: true, isPast: false, label: `เตือนด่วน: เบิกฟ้องอีก ${diffDays} วัน` };
    }
    if (diffDays > 3) {
      return { daysLeft: diffDays, isToday: false, isUrgent: false, isPast: false, label: `เบิกฟ้องอีก ${diffDays} วัน` };
    }
    return { daysLeft: diffDays, isToday: false, isUrgent: false, isPast: true, label: `ผ่านวันเบิกฟ้องแล้ว (${Math.abs(diffDays)} วัน)` };
  } catch {
    return { daysLeft: 999, isToday: false, isUrgent: false, isPast: false, label: '' };
  }
}

/**
 * ตรวจสอบว่าคดีนี้เป็น "สำนวนเบิกฟ้องที่ยังไม่เปลี่ยนสถานะเป็นรับสารภาพหรือปฏิเสธ" หรือไม่
 * ตามคำขอของผู้ใช้:
 * - ในการเลือกสำนวนเบิกฟ้อง ให้แจ้งเตือนทุกๆ 5 วัน หากยังไม่เปลี่ยนสถานะเป็นสำนวนรับสารภาพ หรือ ปฏิเสธ
 */
export function isPendingRequisitionCase(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  if (c.isCompleted) return false;
  // ต้องเป็นสำนวนเบิกฟ้อง
  if (!isCaseRequisition(c)) return false;
  // หากเปลี่ยนสถานะเป็นรับสารภาพแล้ว -> ไม่ต้องเตือน
  if (c.defendantPlea === 'confessed' || isCaseConfessed(c)) return false;
  // หากเปลี่ยนสถานะเป็นปฏิเสธแล้ว -> ไม่ต้องเตือน
  if (c.defendantPlea === 'denied' || isCaseDenied(c)) return false;
  return true;
}

export interface RequisitionIntervalAlertInfo {
  isPending: boolean;              // เป็นสำนวนเบิกฟ้องที่ค้างอยู่จริงหรือไม่
  daysElapsed: number;             // จำนวนวันที่รอมาแล้วนับแต่วันที่ฟ้อง/วันที่เริ่มเบิกฟ้อง
  isAlertDue: boolean;             // ถึงรอบการแจ้งเตือนแล้วหรือไม่ (daysElapsed >= 5)
  cycle: number;                   // รอบการเตือน (รอบที่ 1 เมื่อ >= 5, รอบที่ 2 เมื่อ >= 10, ...)
  isExactIntervalToday: boolean;   // ครบรอบ 5 วันพอดีในวันนี้ (เช่น วันที่ 5, 10, 15, 20...)
  daysUntilNextAlert: number;      // อีกกี่วันจะถึงรอบเตือนถัดไป (1 - 5)
  baseDate: string;                // วันที่ใช้อ้างอิงคำนวณ (filingDate / requisitionDate)
  alertTitle: string;              // ข้อความหัวเรื่องแจ้งเตือน
  alertDescription: string;        // รายละเอียด
  badgeLabel: string;              // ป้ายข้อความย่อ
  urgencyLevel: 'critical' | 'warning' | 'info' | 'none';
}

/**
 * คำนวณรอบการแจ้งเตือนทุกๆ 5 วัน สำหรับสำนวนเบิกฟ้องที่ยังไม่เปลี่ยนสถานะเป็นรับสารภาพหรือปฏิเสธ
 */
export function getRequisitionAlertInfo(
  c?: Partial<AppealCase> | null,
  refDate: Date = new Date()
): RequisitionIntervalAlertInfo {
  if (!c || !isPendingRequisitionCase(c)) {
    return {
      isPending: false,
      daysElapsed: 0,
      isAlertDue: false,
      cycle: 0,
      isExactIntervalToday: false,
      daysUntilNextAlert: 0,
      baseDate: '',
      alertTitle: '',
      alertDescription: '',
      badgeLabel: '',
      urgencyLevel: 'none',
    };
  }

  // วันที่ตั้งต้นในการคำนวณ:
  // ใช้วันที่ฟ้อง (filingDate) หรือวันที่เบิกฟ้อง (requisitionDate)
  const baseDate = c.filingDate || c.requisitionDate || (c.createdAt ? c.createdAt.slice(0, 10) : '');
  
  if (!baseDate) {
    return {
      isPending: true,
      daysElapsed: 0,
      isAlertDue: false,
      cycle: 0,
      isExactIntervalToday: false,
      daysUntilNextAlert: 5,
      baseDate: '',
      alertTitle: 'สำนวนเบิกฟ้อง (รอผล)',
      alertDescription: 'ยังไม่เปลี่ยนสถานะเป็นรับสารภาพหรือปฏิเสธ',
      badgeLabel: '🚚 เบิกฟ้อง (รอผล)',
      urgencyLevel: 'info',
    };
  }

  try {
    const [y, m, d] = baseDate.split('-').map(Number);
    const baseZero = new Date(y, m - 1, d);
    const todayZero = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    
    const diffDays = Math.floor((todayZero.getTime() - baseZero.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.max(0, diffDays);

    const isAlertDue = daysElapsed >= 5;
    const cycle = isAlertDue ? Math.floor(daysElapsed / 5) : 0;
    const isExactIntervalToday = isAlertDue && daysElapsed % 5 === 0;
    
    // จำนวนวันจะถึงรอบ 5 วันถัดไป
    const remainder = daysElapsed % 5;
    const daysUntilNextAlert = remainder === 0 ? 5 : 5 - remainder;

    let urgencyLevel: 'critical' | 'warning' | 'info' | 'none' = 'info';
    if (daysElapsed >= 10) {
      urgencyLevel = 'critical';
    } else if (daysElapsed >= 5) {
      urgencyLevel = 'warning';
    }

    let badgeLabel = '';
    let alertTitle = '';
    let alertDescription = '';

    if (isAlertDue) {
      if (isExactIntervalToday) {
        badgeLabel = `🔔 เตือนรอบที่ ${cycle} (ครบ ${daysElapsed} วันพอดี)`;
        alertTitle = `แจ้งเตือนรอบที่ ${cycle}: สำนวนเบิกฟ้องครบกำหนด ${daysElapsed} วัน`;
        alertDescription = `ยังไม่เปลี่ยนสถานะเป็น "รับสารภาพ" หรือ "ปฏิเสธ" (แจ้งเตือนทุก 5 วัน)`;
      } else {
        badgeLabel = `🔔 เตือนรอบที่ ${cycle} (รอ ${daysElapsed} วัน)`;
        alertTitle = `แจ้งเตือนรอบที่ ${cycle}: สำนวนเบิกฟ้องค้างมาแล้ว ${daysElapsed} วัน`;
        alertDescription = `ยังไม่เปลี่ยนสถานะเป็น "รับสารภาพ" หรือ "ปฏิเสธ" (รอบถัดไปอีก ${daysUntilNextAlert} วัน)`;
      }
    } else {
      badgeLabel = `🚚 เบิกฟ้อง (รอ ${daysElapsed} วัน • เตือนในอีก ${daysUntilNextAlert} วัน)`;
      alertTitle = `สำนวนเบิกฟ้อง: รอผลมาแล้ว ${daysElapsed} วัน`;
      alertDescription = `รอบแจ้งเตือนถัดไปในอีก ${daysUntilNextAlert} วัน (แจ้งเตือนทุกๆ 5 วัน หากยังไม่เปลี่ยนสถานะ)`;
    }

    return {
      isPending: true,
      daysElapsed,
      isAlertDue,
      cycle,
      isExactIntervalToday,
      daysUntilNextAlert,
      baseDate,
      alertTitle,
      alertDescription,
      badgeLabel,
      urgencyLevel,
    };
  } catch {
    return {
      isPending: true,
      daysElapsed: 0,
      isAlertDue: false,
      cycle: 0,
      isExactIntervalToday: false,
      daysUntilNextAlert: 5,
      baseDate,
      alertTitle: 'สำนวนเบิกฟ้อง (รอผล)',
      alertDescription: 'ยังไม่เปลี่ยนสถานะเป็นรับสารภาพหรือปฏิเสธ',
      badgeLabel: '🚚 เบิกฟ้อง (รอผล)',
      urgencyLevel: 'info',
    };
  }
}

