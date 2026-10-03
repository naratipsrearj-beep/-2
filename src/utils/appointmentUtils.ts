import { CourtAppointmentType } from '../types/appeal';
import { formatThaiDate } from './dateUtils';

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
    case 'other':
      return { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300', icon: '📌' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: '⏳' };
  }
}
