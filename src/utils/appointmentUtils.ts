import { AppealCase, CourtAppointmentType } from '../types/appeal';
import { formatThaiDate } from './dateUtils';

/**
 * ตรวจสอบว่าคดีนี้จำเลยให้การรับสารภาพหรือไม่
 * ทั้งจากคำให้การโดยตรง, ผลคำพิพากษา, บันทึกหมายเหตุ, หรือคดีที่มีคำพิพากษาแล้ว
 */
export function isCaseConfessed(c?: Partial<AppealCase> | null): boolean {
  if (!c) return false;
  // จำเลยระบุคำให้การรับสารภาพโดยตรง
  if (c.defendantPlea === 'confessed') return true;
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
