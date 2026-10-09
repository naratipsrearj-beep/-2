import { AppealCase, CourtAppointmentType } from '../types/appeal';
import { formatThaiDate } from './dateUtils';

export function isCaseRequisition(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  return Boolean(c.isRequisitionCase || c.appointmentType === 'requisition');
}

/**
 * ตรวจสอบว่าคดีนี้จำเลยให้การปฏิเสธหรือไม่
 * หมายเหตุ:
 * - จำเลยระบุคำให้การปฏิเสธ (denied)
 * - นัดคุ้มครองสิทธิ (rights_protection) ซึ่งจัดให้สำหรับจำเลยที่ให้การปฏิเสธ
 * - นัดสืบพยาน (witness_examination) หรือ นัดพร้อมตรวจพยาน (pre_trial)
 * - มีข้อความระบุว่า "ปฏิเสธ" หรือ "ให้การปฏิเสธ" ในหมายเหตุ หรือผลคำพิพากษา
 */
export function isCaseDenied(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  if (isCaseRequisition(c)) return false;
  if (c.defendantPlea === 'denied') return true;
  if (c.appointmentType === 'rights_protection') return true;
  if (c.appointmentType === 'witness_examination' || c.appointmentType === 'pre_trial') return true;
  if (typeof c.notes === 'string' && c.notes.includes('ปฏิเสธ')) return true;
  if (typeof c.appointmentNotes === 'string' && c.appointmentNotes.includes('ปฏิเสธ')) return true;
  if (typeof c.judgmentOutcome === 'string' && c.judgmentOutcome.includes('ปฏิเสธ')) return true;
  return false;
}

/**
 * ตรวจสอบว่าคดีนี้จำเลยให้การรับสารภาพหรือไม่
 * ทั้งจากคำให้การโดยตรง, ผลคำพิพากษา, บันทึกหมายเหตุ, หรือคดีที่มีคำพิพากษาแล้ว
 * หมายเหตุ:
 * - สำนวนเบิกฟ้อง: ยังไม่ทราบว่ารับสารภาพหรือปฏิเสธ คืนค่า false
 * - สำนวนที่จำเลยปฏิเสธ: คืนค่า false เสมอ
 */
export function isCaseConfessed(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  // สำนวนเบิกฟ้อง: ยังไม่ทราบคำให้การว่ารับสารภาพหรือปฏิเสธ
  if (isCaseRequisition(c)) return false;
  // สำนวนที่ปฏิเสธ: ต้องไม่ถือว่ารับสารภาพเด็ดขาด
  if (isCaseDenied(c)) return false;
  // จำเลยระบุคำให้การรับสารภาพโดยตรง
  if (c.defendantPlea === 'confessed') return true;

  // ตรวจสอบข้อความปฏิเสธ
  const textHasDenied = (txt?: string | null) => {
    if (!txt) return false;
    const l = txt.toLowerCase();
    return l.includes('ปฏิเสธ') || l.includes('ไม่รับสารภาพ');
  };
  if (textHasDenied(c.notes) || textHasDenied(c.appointmentNotes) || textHasDenied(c.judgmentOutcome)) {
    return false;
  }

  // มีข้อความ "รับสารภาพ" ในผลคำพิพากษา
  if (typeof c.judgmentOutcome === 'string' && c.judgmentOutcome.toLowerCase().includes('รับสารภาพ')) return true;
  // มีข้อความ "รับสารภาพ" ในหมายเหตุ
  if (typeof c.notes === 'string' && c.notes.toLowerCase().includes('รับสารภาพ')) return true;
  // มีข้อความ "รับสารภาพ" ในหมายเหตุนัด
  if (typeof c.appointmentNotes === 'string' && c.appointmentNotes.toLowerCase().includes('รับสารภาพ')) return true;
  // คดีที่มีคำพิพากษาและวันที่พิพากษาแล้ว โดยไม่ได้ระบุว่าปฏิเสธ
  if (Boolean(c.hasJudgment && c.judgmentDate) && c.defendantPlea !== 'denied') return true;
  return false;
}

/**
 * ตรวจสอบว่าสำนวนคดีมีนัดต่อหรือไม่ (เช่น จำเลยปฏิเสธ มีนัดสืบพยาน, มีนัดพร้อม, นัดคุ้มครองสิทธิ, นัดไกล่เกลี่ย, นัดฟังคำสั่ง, นัดอื่นๆ หรือสำนวนเบิกฟ้อง)
 * ตามคำขอ: ในสำนวนที่มีนัดต่อ ไม่ต้องให้ขึ้น ผลคำพิพากษา/ความคืบหน้า โดยย่อ
 */
export function hasContinuousAppointment(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  // สำนวนเบิกฟ้อง ถือว่ามีนัดต่อเบิกตัวมาฟ้อง
  if (isCaseRequisition(c)) return true;
  // มีวันนัดศาล หรือประเภทนัดที่ไม่ใช่ none
  if (c.appointmentDate) return true;
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
