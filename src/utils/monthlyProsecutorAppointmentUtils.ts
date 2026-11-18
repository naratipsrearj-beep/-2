import { AppealCase, CourtAppointmentType, MonthlyDutyRoster, DailyDutyRecord } from '../types/appeal';
import { classifyTargetAppointmentCategory, getAppointmentLabel, shouldDisplayAppointment } from './appointmentUtils';
import { formatThaiDate, getCurrentMonthString, getTodayString } from './dateUtils';

export type TargetAppointmentCategory = 'rights_protection' | 'investigation' | 'witness_confessed';

export type CalendarAppointmentCategory = Exclude<CourtAppointmentType, 'none'>;

export interface ProsecutorHearingAppointment {
  uniqueKey: string;
  caseId: string;
  caseItem: AppealCase;
  blackCaseNo: string;
  redCaseNo?: string;
  court: string;
  plaintiff: string;
  defendant: string;
  prosecutorName: string;
  category: CalendarAppointmentCategory;
  categoryLabel: string;
  appointmentType: CourtAppointmentType;
  appointmentTypeName?: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime?: string;
  courtRoom?: string;
  notes?: string;
  isSubsequent: boolean;
  orderIndex: number;
  isCompleted: boolean;
  completedDate?: string;
  completionReason?: string;
  isSubmittedToDuty?: boolean;
  submittedToDutyDate?: string;
  submittedToDutyOfficer?: string;
  submittedToDutyNotes?: string;
  isTemporarilyDischarged?: boolean;
}

export interface ProsecutorDateSchedule {
  date: string; // YYYY-MM-DD
  thaiDateLabel: string;
  dayOfWeekThai: string;
  dayNumber: number;
  appointments: ProsecutorHearingAppointment[];
  countsByCategory: {
    rights_protection: number;
    investigation: number;
    witness_confessed: number;
    other_appointments: number;
    total: number;
  };
  countsByStatus?: {
    total: number;
    incomplete: number;
    completed: number;
    submittedToDuty: number;
  };
}

export interface ProsecutorMonthlyHearingSummary {
  prosecutorName: string;
  totalAppointments: number;
  uniqueDatesCount: number;
  countsByCategory: {
    rights_protection: number;
    investigation: number;
    witness_confessed: number;
    other_appointments: number;
  };
  countsByStatus?: {
    total: number;
    incomplete: number;
    completed: number;
    submittedToDuty: number;
  };
  dateSchedules: ProsecutorDateSchedule[]; // sorted asc by date
}

export interface MonthHearingScheduleResult {
  yearMonth: string; // "YYYY-MM"
  monthLabel: string; // e.g. "พฤศจิกายน 2569"
  totalAppointments: number;
  totalProsecutors: number;
  totalActiveDays: number;
  countsByCategory: {
    rights_protection: number;
    investigation: number;
    witness_confessed: number;
    pre_trial: number;
    witness_examination: number;
    mediation: number;
    judgment: number;
    requisition: number;
    other: number;
    other_appointments: number;
  };
  countsByStatus: {
    total: number;
    incomplete: number;
    completed: number;
    submittedToDuty: number;
  };
  prosecutors: ProsecutorMonthlyHearingSummary[];
  allAppointments: ProsecutorHearingAppointment[];
  dailySchedules: {
    date: string;
    thaiDateLabel: string;
    dayOfWeekThai: string;
    appointments: ProsecutorHearingAppointment[];
    prosecutors: string[];
    countsByCategory: {
      rights_protection: number;
      investigation: number;
      witness_confessed: number;
      other_appointments: number;
    };
    countsByStatus?: {
      total: number;
      incomplete: number;
      completed: number;
      submittedToDuty: number;
    };
  }[];
}

export interface CalendarGridCell {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  dayOfWeek: number; // 0 = Sun ... 6 = Sat
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  appointments: ProsecutorHearingAppointment[];
  dutyRecord?: DailyDutyRecord;
  countsByStatus: {
    total: number;
    incomplete: number;
    completed: number;
    submittedToDuty: number;
  };
}

export interface ProsecutorDirectoryEntry {
  prosecutorName: string;
  totalCasesInDb: number;
  incompleteCasesInDb: number;
  completedCasesInDb: number;
  monthAppointments: number;
  monthIncomplete: number;
  monthCompleted: number;
  monthRightsProtection: number;
  monthInvestigation: number;
  monthOtherAppointments: number;
  isInDutyRoster: boolean;
}

/**
 * จำแนกประเภทนัดศาลทั้งหมดในระบบ (คุ้มครองสิทธิ, สืบเสาะ, สืบประกอบ, นัดพร้อม, สืบพยาน, ไกล่เกลี่ย, ฟังคำพิพากษา, เบิกฟ้อง, นัดอื่นๆ)
 */
export function classifyAnyAppointmentCategory(
  type?: CourtAppointmentType,
  typeName?: string,
  notes?: string
): CalendarAppointmentCategory | null {
  // 1. ตรวจสอบ 3 กลุ่มเป้าหมายหลักก่อนเพื่อความแม่นยำ (รองรับ keyword ใน typeName/notes ด้วย)
  const coreCat = classifyTargetAppointmentCategory(type, typeName, notes);
  if (coreCat) return coreCat;

  if (type && type !== 'none') {
    return type;
  }

  // 2. กรณีไม่ได้ระบุ type ชัดเจน แต่มีข้อความบอกประเภทนัดใน typeName หรือ notes
  const combined = `${typeName || ''} ${notes || ''}`.toLowerCase();
  if (!combined.trim()) return null;

  if (combined.includes('พิพากษา') || combined.includes('ฟังคำสั่ง')) return 'judgment';
  if (combined.includes('สืบพยาน')) return 'witness_examination';
  if (combined.includes('นัดพร้อม') || combined.includes('ตรวจพยาน')) return 'pre_trial';
  if (combined.includes('ไกล่เกลี่ย') || combined.includes('ประนอม')) return 'mediation';
  if (combined.includes('เบิกฟ้อง') || combined.includes('เบิกตัว')) return 'requisition';

  return 'other';
}

export function getCalendarCategoryDisplay(
  category: CalendarAppointmentCategory,
  customName?: string
): {
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
  dotColor: string;
} {
  switch (category) {
    case 'rights_protection':
      return {
        label: 'นัดคุ้มครองสิทธิ',
        shortLabel: 'คุ้มครองสิทธิ',
        icon: '🛡️',
        badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
        chipBg: 'bg-indigo-50/90 hover:bg-indigo-100',
        chipBorder: 'border-indigo-200',
        chipText: 'text-indigo-950',
        dotColor: 'bg-indigo-600',
      };
    case 'investigation':
      return {
        label: 'นัดสืบเสาะ',
        shortLabel: 'สืบเสาะ',
        icon: '🔍',
        badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
        chipBg: 'bg-purple-50/90 hover:bg-purple-100',
        chipBorder: 'border-purple-200',
        chipText: 'text-purple-950',
        dotColor: 'bg-purple-600',
      };
    case 'witness_confessed':
      return {
        label: 'นัดสืบประกอบรับสารภาพ',
        shortLabel: 'สืบประกอบฯ',
        icon: '📝',
        badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
        chipBg: 'bg-amber-50/90 hover:bg-amber-100',
        chipBorder: 'border-amber-200',
        chipText: 'text-amber-950',
        dotColor: 'bg-amber-600',
      };
    case 'pre_trial':
      return {
        label: 'นัดพร้อม / ตรวจพยาน',
        shortLabel: 'นัดพร้อม',
        icon: '📋',
        badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
        chipBg: 'bg-sky-50/90 hover:bg-sky-100',
        chipBorder: 'border-sky-200',
        chipText: 'text-sky-950',
        dotColor: 'bg-sky-600',
      };
    case 'witness_examination':
      return {
        label: 'นัดสืบพยาน',
        shortLabel: 'สืบพยาน',
        icon: '🎙️',
        badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300',
        chipBg: 'bg-cyan-50/90 hover:bg-cyan-100',
        chipBorder: 'border-cyan-200',
        chipText: 'text-cyan-950',
        dotColor: 'bg-cyan-600',
      };
    case 'mediation':
      return {
        label: 'นัดไกล่เกลี่ย',
        shortLabel: 'ไกล่เกลี่ย',
        icon: '🤝',
        badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
        chipBg: 'bg-teal-50/90 hover:bg-teal-100',
        chipBorder: 'border-teal-200',
        chipText: 'text-teal-950',
        dotColor: 'bg-teal-600',
      };
    case 'judgment':
      return {
        label: 'นัดฟังคำพิพากษา',
        shortLabel: 'ฟังคำพิพากษา',
        icon: '⚖️',
        badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
        chipBg: 'bg-rose-50/90 hover:bg-rose-100',
        chipBorder: 'border-rose-200',
        chipText: 'text-rose-950',
        dotColor: 'bg-rose-600',
      };
    case 'requisition':
      return {
        label: 'นัดเบิกฟ้อง',
        shortLabel: 'เบิกฟ้อง',
        icon: '🚚',
        badgeClass: 'bg-orange-100 text-orange-950 border-orange-300',
        chipBg: 'bg-orange-50/90 hover:bg-orange-100',
        chipBorder: 'border-orange-200',
        chipText: 'text-orange-950',
        dotColor: 'bg-orange-600',
      };
    case 'other':
    default: {
      const label = customName?.trim() || getAppointmentLabel('other', customName) || 'นัดอื่นๆ';
      return {
        label,
        shortLabel: label.length > 16 ? `${label.slice(0, 15)}…` : label,
        icon: '📌',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
        chipBg: 'bg-slate-50 hover:bg-slate-100',
        chipBorder: 'border-slate-200',
        chipText: 'text-slate-900',
        dotColor: 'bg-slate-600',
      };
    }
  }
}

/**
 * ดึงรายการเดือน (YYYY-MM) ทั้งหมดที่มีนัดศาล, วันฟ้อง หรือตารางเวรชี้
 */
export function getAvailableHearingMonths(
  cases: AppealCase[],
  dutyRosters: MonthlyDutyRoster[] = []
): string[] {
  const monthSet = new Set<string>();
  const currentMonth = getCurrentMonthString();
  monthSet.add(currentMonth);

  // เพิ่มเดือนใกล้เคียง (-1 และ +1 เดือน) เพื่อให้เลื่อนดูปฏิทินล่วงหน้า/ย้อนหลังได้เสมอ
  try {
    const [cy, cm] = currentMonth.split('-').map(Number);
    const prevDate = new Date(cy, cm - 2, 1);
    const nextDate = new Date(cy, cm, 1);
    monthSet.add(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
    monthSet.add(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  } catch {
    // ignore
  }

  dutyRosters.forEach((r) => {
    if (r.monthYear && /^\d{4}-\d{2}$/.test(r.monthYear)) {
      monthSet.add(r.monthYear);
    }
  });

  cases.forEach((c) => {
    // 1. นัดแรก/นัดหลัก
    if (c.appointmentDate && c.appointmentDate.length >= 7) {
      const ym = c.appointmentDate.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        monthSet.add(ym);
      }
    }

    // 2. นัดเบิกฟ้อง
    if (c.requisitionDate && c.requisitionDate.length >= 7) {
      const ym = c.requisitionDate.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        monthSet.add(ym);
      }
    }

    // 3. นัดต่อๆ ไป
    if (Array.isArray(c.subsequentAppointments)) {
      c.subsequentAppointments.forEach((appt) => {
        if (appt.date && appt.date.length >= 7) {
          const ym = appt.date.slice(0, 7);
          if (/^\d{4}-\d{2}$/.test(ym)) {
            monthSet.add(ym);
          }
        }
      });
    }

    // 4. เดือนที่ฟ้อง
    if (c.filingDate && c.filingDate.length >= 7) {
      const ym = c.filingDate.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        monthSet.add(ym);
      }
    }
  });

  return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
}

/**
 * สกัดและสรุปวันนัดศาลประจำเดือนของอัยการเจ้าของสำนวน
 * ครอบคลุม: นัดคุ้มครองสิทธิ, สืบเสาะ, นัดสืบประกอบรับสารภาพ และนัดอื่นๆ ทั้งหมด
 * รวมถึงทั้งสำนวนที่กดเสร็จสิ้นแล้ว และยังไม่กดเสร็จสิ้น
 */
export function extractProsecutorMonthlyHearings(
  cases: AppealCase[],
  yearMonth: string,
  options: { includeAllAppointmentTypes?: boolean } = { includeAllAppointmentTypes: true }
): MonthHearingScheduleResult {
  const includeAll = options.includeAllAppointmentTypes !== false;
  const allAppointments: ProsecutorHearingAppointment[] = [];

  cases.forEach((c) => {
    const rawProsecutor = c.responsiblePerson || c.prosecutorName;
    const prosecutorName =
      rawProsecutor && rawProsecutor.trim() ? rawProsecutor.trim() : 'ไม่ระบุอัยการเจ้าของสำนวน';

    let hasPrimaryOnDate: string | null = null;

    // 1. ตรวจสอบนัดแรก/นัดหลัก
    if (c.appointmentDate && c.appointmentDate.startsWith(yearMonth)) {
      const cat = includeAll
        ? classifyAnyAppointmentCategory(c.appointmentType, c.appointmentTypeName, c.appointmentNotes)
        : classifyTargetAppointmentCategory(c.appointmentType, c.appointmentTypeName, c.appointmentNotes);

      const effectiveCat: CalendarAppointmentCategory | null =
        cat || (includeAll && c.appointmentDate ? 'other' : null);

      const allowedByPlea =
        !effectiveCat ||
        shouldDisplayAppointment(effectiveCat, c) ||
        effectiveCat !== 'rights_protection';

      if (effectiveCat && allowedByPlea && c.appointmentType !== 'none') {
        const display = getCalendarCategoryDisplay(effectiveCat, c.appointmentTypeName);
        hasPrimaryOnDate = `${c.appointmentDate}_${effectiveCat}`;

        allAppointments.push({
          uniqueKey: `main_${c.id}_${c.appointmentDate}`,
          caseId: c.id,
          caseItem: c,
          blackCaseNo: c.blackCaseNo || 'ไม่ระบุเลขดำ',
          redCaseNo: c.redCaseNo,
          court: c.court || 'ศาล',
          plaintiff: c.plaintiff || 'พนักงานอัยการ',
          defendant: c.defendant || '-',
          prosecutorName,
          category: effectiveCat,
          categoryLabel: display.label,
          appointmentType: c.appointmentType || effectiveCat,
          appointmentTypeName: c.appointmentTypeName,
          appointmentDate: c.appointmentDate,
          appointmentTime: c.appointmentTime || '09:00 น.',
          courtRoom: c.appointmentCourtRoom || '',
          notes: c.appointmentNotes || '',
          isSubsequent: false,
          orderIndex: 1,
          isCompleted: Boolean(c.isCompleted),
          completedDate: c.completedDate,
          completionReason: c.completionReason,
          isSubmittedToDuty: Boolean(c.isSubmittedToDuty),
          submittedToDutyDate: c.submittedToDutyDate,
          submittedToDutyOfficer: c.submittedToDutyOfficer,
          submittedToDutyNotes: c.submittedToDutyNotes,
          isTemporarilyDischarged: Boolean(c.isTemporarilyDischarged),
        });
      }
    }

    // 1.5 กรณีเป็นสำนวนเบิกฟ้องที่มี requisitionDate แยกจาก appointmentDate
    if (
      includeAll &&
      c.isRequisitionCase &&
      c.requisitionDate &&
      c.requisitionDate.startsWith(yearMonth) &&
      hasPrimaryOnDate !== `${c.requisitionDate}_requisition`
    ) {
      const display = getCalendarCategoryDisplay('requisition');
      allAppointments.push({
        uniqueKey: `req_${c.id}_${c.requisitionDate}`,
        caseId: c.id,
        caseItem: c,
        blackCaseNo: c.blackCaseNo || 'ไม่ระบุเลขดำ',
        redCaseNo: c.redCaseNo,
        court: c.court || 'ศาล',
        plaintiff: c.plaintiff || 'พนักงานอัยการ',
        defendant: c.defendant || '-',
        prosecutorName,
        category: 'requisition',
        categoryLabel: display.label,
        appointmentType: 'requisition',
        appointmentDate: c.requisitionDate,
        appointmentTime: c.appointmentTime || '09:00 น.',
        courtRoom: c.appointmentCourtRoom || '',
        notes: c.requisitionNotes || c.appointmentNotes || '',
        isSubsequent: false,
        orderIndex: 1,
        isCompleted: Boolean(c.isCompleted),
        completedDate: c.completedDate,
        completionReason: c.completionReason,
        isSubmittedToDuty: Boolean(c.isSubmittedToDuty),
        submittedToDutyDate: c.submittedToDutyDate,
        submittedToDutyOfficer: c.submittedToDutyOfficer,
        submittedToDutyNotes: c.submittedToDutyNotes,
        isTemporarilyDischarged: Boolean(c.isTemporarilyDischarged),
      });
    }

    // 2. ตรวจสอบนัดถัดไป (subsequentAppointments)
    if (Array.isArray(c.subsequentAppointments)) {
      c.subsequentAppointments.forEach((appt, sIdx) => {
        if (appt.date && appt.date.startsWith(yearMonth)) {
          const cat = includeAll
            ? classifyAnyAppointmentCategory(appt.type, appt.typeName, appt.notes)
            : classifyTargetAppointmentCategory(appt.type, appt.typeName, appt.notes);

          const effectiveCat: CalendarAppointmentCategory | null =
            cat || (includeAll ? 'other' : null);

          const allowedByPlea =
            !effectiveCat ||
            shouldDisplayAppointment(effectiveCat, c) ||
            effectiveCat !== 'rights_protection';

          if (effectiveCat && allowedByPlea && appt.type !== 'none') {
            const display = getCalendarCategoryDisplay(effectiveCat, appt.typeName);

            allAppointments.push({
              uniqueKey: `sub_${c.id}_${appt.id || sIdx}_${appt.date}`,
              caseId: c.id,
              caseItem: c,
              blackCaseNo: c.blackCaseNo || 'ไม่ระบุเลขดำ',
              redCaseNo: c.redCaseNo,
              court: c.court || 'ศาล',
              plaintiff: c.plaintiff || 'พนักงานอัยการ',
              defendant: c.defendant || '-',
              prosecutorName,
              category: effectiveCat,
              categoryLabel: display.label,
              appointmentType: appt.type || effectiveCat,
              appointmentTypeName: appt.typeName,
              appointmentDate: appt.date,
              appointmentTime: appt.time || '09:00 น.',
              courtRoom: appt.courtRoom || '',
              notes: appt.notes || '',
              isSubsequent: true,
              orderIndex: sIdx + 2,
              isCompleted: Boolean(c.isCompleted),
              completedDate: c.completedDate,
              completionReason: c.completionReason,
              isSubmittedToDuty: Boolean(c.isSubmittedToDuty),
              submittedToDutyDate: c.submittedToDutyDate,
              submittedToDutyOfficer: c.submittedToDutyOfficer,
              submittedToDutyNotes: c.submittedToDutyNotes,
              isTemporarilyDischarged: Boolean(c.isTemporarilyDischarged),
            });
          }
        }
      });
    }
  });

  // เรียงลำดับนัดตามวันที่ (asc), สถานะยังไม่เสร็จขึ้นก่อน, เวลา และเลขคดีดำ
  allAppointments.sort((a, b) => {
    const dComp = a.appointmentDate.localeCompare(b.appointmentDate);
    if (dComp !== 0) return dComp;
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    const tComp = (a.appointmentTime || '').localeCompare(b.appointmentTime || '');
    if (tComp !== 0) return tComp;
    return a.blackCaseNo.localeCompare(b.blackCaseNo, 'th');
  });

  // จัดกลุ่มตามอัยการเจ้าของสำนวน
  const prosecutorMap = new Map<string, ProsecutorHearingAppointment[]>();
  allAppointments.forEach((appt) => {
    if (!prosecutorMap.has(appt.prosecutorName)) {
      prosecutorMap.set(appt.prosecutorName, []);
    }
    prosecutorMap.get(appt.prosecutorName)!.push(appt);
  });

  const catTotals = {
    rights_protection: 0,
    investigation: 0,
    witness_confessed: 0,
    pre_trial: 0,
    witness_examination: 0,
    mediation: 0,
    judgment: 0,
    requisition: 0,
    other: 0,
    other_appointments: 0,
  };

  allAppointments.forEach((a) => {
    catTotals[a.category] = (catTotals[a.category] || 0) + 1;
    if (
      a.category !== 'rights_protection' &&
      a.category !== 'investigation' &&
      a.category !== 'witness_confessed'
    ) {
      catTotals.other_appointments++;
    }
  });

  const prosecutorsSummary: ProsecutorMonthlyHearingSummary[] = [];

  prosecutorMap.forEach((appts, pName) => {
    const dateMap = new Map<string, ProsecutorHearingAppointment[]>();
    appts.forEach((a) => {
      if (!dateMap.has(a.appointmentDate)) {
        dateMap.set(a.appointmentDate, []);
      }
      dateMap.get(a.appointmentDate)!.push(a);
    });

    const dateSchedules: ProsecutorDateSchedule[] = [];
    let pRights = 0;
    let pInves = 0;
    let pConfessed = 0;
    let pOther = 0;

    dateMap.forEach((dAppts, dateStr) => {
      let dRights = 0;
      let dInves = 0;
      let dConfessed = 0;
      let dOther = 0;

      dAppts.forEach((a) => {
        if (a.category === 'rights_protection') dRights++;
        else if (a.category === 'investigation') dInves++;
        else if (a.category === 'witness_confessed') dConfessed++;
        else dOther++;
      });

      pRights += dRights;
      pInves += dInves;
      pConfessed += dConfessed;
      pOther += dOther;

      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const daysThai = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
      const dayOfWeekThai = daysThai[dateObj.getDay()] || '';

      dateSchedules.push({
        date: dateStr,
        thaiDateLabel: formatThaiDate(dateStr),
        dayOfWeekThai,
        dayNumber: d,
        appointments: dAppts,
        countsByCategory: {
          rights_protection: dRights,
          investigation: dInves,
          witness_confessed: dConfessed,
          other_appointments: dOther,
          total: dAppts.length,
        },
        countsByStatus: {
          total: dAppts.length,
          incomplete: dAppts.filter((a) => !a.isCompleted).length,
          completed: dAppts.filter((a) => a.isCompleted).length,
          submittedToDuty: dAppts.filter((a) => a.isSubmittedToDuty).length,
        },
      });
    });

    dateSchedules.sort((a, b) => a.date.localeCompare(b.date));

    prosecutorsSummary.push({
      prosecutorName: pName,
      totalAppointments: appts.length,
      uniqueDatesCount: dateSchedules.length,
      countsByCategory: {
        rights_protection: pRights,
        investigation: pInves,
        witness_confessed: pConfessed,
        other_appointments: pOther,
      },
      countsByStatus: {
        total: appts.length,
        incomplete: appts.filter((a) => !a.isCompleted).length,
        completed: appts.filter((a) => a.isCompleted).length,
        submittedToDuty: appts.filter((a) => a.isSubmittedToDuty).length,
      },
      dateSchedules,
    });
  });

  prosecutorsSummary.sort((a, b) => {
    if (b.totalAppointments !== a.totalAppointments) {
      return b.totalAppointments - a.totalAppointments;
    }
    return a.prosecutorName.localeCompare(b.prosecutorName, 'th');
  });

  // จัดกลุ่มภาพรวมตามรายวัน
  const globalDateMap = new Map<string, ProsecutorHearingAppointment[]>();
  allAppointments.forEach((a) => {
    if (!globalDateMap.has(a.appointmentDate)) {
      globalDateMap.set(a.appointmentDate, []);
    }
    globalDateMap.get(a.appointmentDate)!.push(a);
  });

  const dailySchedules: MonthHearingScheduleResult['dailySchedules'] = [];
  globalDateMap.forEach((dAppts, dateStr) => {
    let dRights = 0;
    let dInves = 0;
    let dConfessed = 0;
    let dOther = 0;
    const pSet = new Set<string>();

    dAppts.forEach((a) => {
      pSet.add(a.prosecutorName);
      if (a.category === 'rights_protection') dRights++;
      else if (a.category === 'investigation') dInves++;
      else if (a.category === 'witness_confessed') dConfessed++;
      else dOther++;
    });

    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const daysThai = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const dayOfWeekThai = daysThai[dateObj.getDay()] || '';

    dailySchedules.push({
      date: dateStr,
      thaiDateLabel: formatThaiDate(dateStr),
      dayOfWeekThai,
      appointments: dAppts,
      prosecutors: Array.from(pSet),
      countsByCategory: {
        rights_protection: dRights,
        investigation: dInves,
        witness_confessed: dConfessed,
        other_appointments: dOther,
      },
      countsByStatus: {
        total: dAppts.length,
        incomplete: dAppts.filter((a) => !a.isCompleted).length,
        completed: dAppts.filter((a) => a.isCompleted).length,
        submittedToDuty: dAppts.filter((a) => a.isSubmittedToDuty).length,
      },
    });
  });

  dailySchedules.sort((a, b) => a.date.localeCompare(b.date));

  const [yearStr, monthStr] = yearMonth.split('-');
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];
  const mIdx = parseInt(monthStr, 10) - 1;
  const thaiYear = parseInt(yearStr, 10) + 543;
  const monthLabel = `${thaiMonths[mIdx] || ''} ${thaiYear}`;

  const totalCompleted = allAppointments.filter((a) => a.isCompleted).length;
  const totalIncomplete = allAppointments.length - totalCompleted;
  const totalSubmitted = allAppointments.filter((a) => a.isSubmittedToDuty).length;

  return {
    yearMonth,
    monthLabel,
    totalAppointments: allAppointments.length,
    totalProsecutors: prosecutorsSummary.length,
    totalActiveDays: dailySchedules.length,
    countsByCategory: catTotals,
    countsByStatus: {
      total: allAppointments.length,
      incomplete: totalIncomplete,
      completed: totalCompleted,
      submittedToDuty: totalSubmitted,
    },
    prosecutors: prosecutorsSummary,
    allAppointments,
    dailySchedules,
  };
}

/**
 * สร้างตารางปฏิทิน 7 คอลัมน์ (อาทิตย์ - เสาร์) ประจำเดือนที่เลือก
 * เชื่อมโยงทั้งรายการนัดหมายจากฐานข้อมูลสำนวน และข้อมูลเวรชี้/วันหยุดจากฐานข้อมูลตารางเวรชี้
 */
export function buildMonthlyCalendarGrid(
  yearMonth: string,
  appointments: ProsecutorHearingAppointment[],
  dutyRosters: MonthlyDutyRoster[] = []
): CalendarGridCell[] {
  const [yStr, mStr] = yearMonth.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10); // 1-12
  if (isNaN(year) || isNaN(month)) return [];

  const todayStr = getTodayString();

  // Map appointments by YYYY-MM-DD
  const apptsByDate = new Map<string, ProsecutorHearingAppointment[]>();
  appointments.forEach((a) => {
    if (!apptsByDate.has(a.appointmentDate)) {
      apptsByDate.set(a.appointmentDate, []);
    }
    apptsByDate.get(a.appointmentDate)!.push(a);
  });

  // Map duty roster records by YYYY-MM-DD
  const dutyByDate = new Map<string, DailyDutyRecord>();
  dutyRosters.forEach((roster) => {
    roster.duties?.forEach((d) => {
      if (d.date && !dutyByDate.has(d.date)) {
        dutyByDate.set(d.date, d);
      }
    });
  });

  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
  const daysInMonth = lastDayOfMonth.getDate();

  const totalCellsNeeded = startDayOfWeek + daysInMonth;
  const totalGridCells = Math.ceil(totalCellsNeeded / 7) * 7;

  const cells: CalendarGridCell[] = [];
  const startDate = new Date(year, month - 1, 1 - startDayOfWeek);

  for (let i = 0; i < totalGridCells; i++) {
    const cellDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const cy = cellDate.getFullYear();
    const cm = String(cellDate.getMonth() + 1).padStart(2, '0');
    const cd = String(cellDate.getDate()).padStart(2, '0');
    const dateStr = `${cy}-${cm}-${cd}`;
    const dayOfWeek = cellDate.getDay();
    const dayAppts = apptsByDate.get(dateStr) || [];

    cells.push({
      date: dateStr,
      dayNumber: cellDate.getDate(),
      dayOfWeek,
      isCurrentMonth: cellDate.getMonth() === month - 1 && cellDate.getFullYear() === year,
      isToday: dateStr === todayStr,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      appointments: dayAppts,
      dutyRecord: dutyByDate.get(dateStr),
      countsByStatus: {
        total: dayAppts.length,
        incomplete: dayAppts.filter((a) => !a.isCompleted).length,
        completed: dayAppts.filter((a) => a.isCompleted).length,
        submittedToDuty: dayAppts.filter((a) => a.isSubmittedToDuty).length,
      },
    });
  }

  return cells;
}

/**
 * สร้างฐานข้อมูลอัยการทั้งหมดจากคลังสำนวนและตารางเวรชี้ เชื่อมโยงกับสถิติวันนัดในเดือนที่เลือก
 */
export function buildProsecutorDirectory(
  cases: AppealCase[],
  dutyRosters: MonthlyDutyRoster[],
  monthResult: MonthHearingScheduleResult
): ProsecutorDirectoryEntry[] {
  const dirMap = new Map<string, ProsecutorDirectoryEntry>();

  const ensureEntry = (rawName?: string): ProsecutorDirectoryEntry | null => {
    const name = (rawName || '').trim();
    if (!name) return null;
    if (!dirMap.has(name)) {
      dirMap.set(name, {
        prosecutorName: name,
        totalCasesInDb: 0,
        incompleteCasesInDb: 0,
        completedCasesInDb: 0,
        monthAppointments: 0,
        monthIncomplete: 0,
        monthCompleted: 0,
        monthRightsProtection: 0,
        monthInvestigation: 0,
        monthOtherAppointments: 0,
        isInDutyRoster: false,
      });
    }
    return dirMap.get(name)!;
  };

  cases.forEach((c) => {
    const pName = (c.responsiblePerson || c.prosecutorName || '').trim() || 'ไม่ระบุอัยการเจ้าของสำนวน';
    const entry = ensureEntry(pName);
    if (!entry) return;
    entry.totalCasesInDb++;
    if (c.isCompleted) entry.completedCasesInDb++;
    else entry.incompleteCasesInDb++;
  });

  dutyRosters.forEach((r) => {
    r.duties?.forEach((d) => {
      d.officers?.forEach((o) => {
        const entry = ensureEntry(o.name);
        if (entry) entry.isInDutyRoster = true;
      });
    });
  });

  monthResult.prosecutors.forEach((p) => {
    const entry = ensureEntry(p.prosecutorName);
    if (!entry) return;
    entry.monthAppointments = p.totalAppointments;
    entry.monthIncomplete = p.countsByStatus?.incomplete ?? 0;
    entry.monthCompleted = p.countsByStatus?.completed ?? 0;
    entry.monthRightsProtection = p.countsByCategory.rights_protection;
    entry.monthInvestigation = p.countsByCategory.investigation;
    entry.monthOtherAppointments =
      p.countsByCategory.witness_confessed + p.countsByCategory.other_appointments;
  });

  return Array.from(dirMap.values()).sort((a, b) => {
    if (b.monthAppointments !== a.monthAppointments) {
      return b.monthAppointments - a.monthAppointments;
    }
    if (b.totalCasesInDb !== a.totalCasesInDb) {
      return b.totalCasesInDb - a.totalCasesInDb;
    }
    return a.prosecutorName.localeCompare(b.prosecutorName, 'th');
  });
}

/**
 * จัดรูปแบบ TSV สำหรับวางลง Excel โดยตรง (รองรับภาษาไทย)
 */
export function formatProsecutorHearingSummaryTsv(result: MonthHearingScheduleResult): string {
  const rows: string[] = [];

  rows.push(`ปฏิทินสรุปวันนัดศาลรายเดือนของอัยการเจ้าของสำนวน ประจำเดือน ${result.monthLabel}`);
  rows.push(
    `นัดทั้งหมด: ${result.totalAppointments} นัด (ยังไม่เสร็จสิ้น: ${result.countsByStatus.incomplete} นัด | เสร็จสิ้นแล้ว: ${result.countsByStatus.completed} นัด) | อัยการที่มีนัด: ${result.totalProsecutors} ท่าน`
  );
  rows.push('');
  rows.push([
    'ลำดับ',
    'อัยการเจ้าของสำนวน',
    'วันที่นัด',
    'วันในสัปดาห์',
    'เวลา',
    'ห้องพิจารณา/บัลลังก์',
    'ประเภทนัด',
    'เลขคดีดำ',
    'เลขคดีแดง',
    'จำเลย',
    'โจทก์',
    'สถานะสำนวน',
    'การเสนอเวรชี้',
    'หมายเหตุ/รายละเอียด',
  ].join('\t'));

  let count = 0;
  result.prosecutors.forEach((p) => {
    p.dateSchedules.forEach((ds) => {
      ds.appointments.forEach((a) => {
        count++;
        const statusLabel = a.isCompleted
          ? `เสร็จสิ้นแล้ว${a.completedDate ? ` (${formatThaiDate(a.completedDate, { short: true })})` : ''}`
          : 'ยังไม่เสร็จสิ้น';
        const dutyLabel = a.isSubmittedToDuty
          ? `เสนอเวรชี้แล้ว${a.submittedToDutyOfficer ? ` (${a.submittedToDutyOfficer})` : ''}`
          : '-';

        rows.push([
          String(count),
          a.prosecutorName,
          ds.thaiDateLabel,
          ds.dayOfWeekThai,
          a.appointmentTime || '-',
          a.courtRoom || '-',
          a.categoryLabel,
          a.blackCaseNo,
          a.redCaseNo || '-',
          a.defendant,
          a.plaintiff,
          statusLabel,
          dutyLabel,
          a.notes || '-',
        ].join('\t'));
      });
    });
  });

  return rows.join('\n');
}

/**
 * สร้าง HTML Table สำหรับ Clipboard copy สวยงามเมื่อนำไปวางใน Word หรือ Excel
 */
export function formatProsecutorHearingSummaryHtml(result: MonthHearingScheduleResult): string {
  let html = `
  <table border="1" cellpadding="6" cellspacing="0" style="font-family: Sarabun, sans-serif; font-size: 13px; border-collapse: collapse; width: 100%;">
    <thead>
      <tr style="background-color: #1e3a8a; color: #ffffff;">
        <th colspan="13" style="text-align: center; font-size: 15px; padding: 10px;">
          ปฏิทินสรุปวันนัดศาลรายเดือนของอัยการเจ้าของสำนวน ประจำเดือน ${result.monthLabel}
        </th>
      </tr>
      <tr style="background-color: #f1f5f9; color: #0f172a; font-weight: bold;">
        <th>ลำดับ</th>
        <th>อัยการเจ้าของสำนวน</th>
        <th>วันที่นัด</th>
        <th>เวลา</th>
        <th>บัลลังก์</th>
        <th>ประเภทนัด</th>
        <th>เลขคดีดำ</th>
        <th>เลขคดีแดง</th>
        <th>จำเลย</th>
        <th>โจทก์</th>
        <th>สถานะสำนวน</th>
        <th>การเสนอเวรชี้</th>
        <th>หมายเหตุ</th>
      </tr>
    </thead>
    <tbody>
  `;

  let count = 0;
  result.prosecutors.forEach((p) => {
    p.dateSchedules.forEach((ds) => {
      ds.appointments.forEach((a) => {
        count++;
        const badgeColor =
          a.category === 'rights_protection'
            ? '#3730a3; background-color: #e0e7ff;'
            : a.category === 'investigation'
            ? '#6b21a8; background-color: #f3e8ff;'
            : a.category === 'witness_confessed'
            ? '#92400e; background-color: #fef3c7;'
            : '#0f172a; background-color: #f1f5f9;';

        const statusText = a.isCompleted
          ? `<span style="color: #065f46; background-color: #d1fae5; padding: 2px 6px; border-radius: 4px; font-weight: bold;">เสร็จสิ้นแล้ว${a.completedDate ? ` (${formatThaiDate(a.completedDate, { short: true })})` : ''}</span>`
          : `<span style="color: #92400e; background-color: #fef3c7; padding: 2px 6px; border-radius: 4px;">ยังไม่เสร็จสิ้น</span>`;

        const dutyText = a.isSubmittedToDuty
          ? `<span style="color: #1e3a8a; background-color: #eff6ff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">เสนอเวรชี้แล้ว${a.submittedToDutyOfficer ? ` (${a.submittedToDutyOfficer})` : ''}</span>`
          : '-';

        html += `
          <tr>
            <td style="text-align: center;">${count}</td>
            <td style="font-weight: 600;">${a.prosecutorName}</td>
            <td>${ds.thaiDateLabel} (${ds.dayOfWeekThai})</td>
            <td style="text-align: center;">${a.appointmentTime || '-'}</td>
            <td style="text-align: center;">${a.courtRoom || '-'}</td>
            <td style="color: ${badgeColor} font-weight: bold; border-radius: 4px; padding: 4px 8px; text-align: center;">${a.categoryLabel}</td>
            <td style="font-weight: bold;">${a.blackCaseNo}</td>
            <td>${a.redCaseNo || '-'}</td>
            <td>${a.defendant}</td>
            <td>${a.plaintiff}</td>
            <td style="text-align: center;">${statusText}</td>
            <td style="text-align: center;">${dutyText}</td>
            <td>${a.notes || '-'}</td>
          </tr>
        `;
      });
    });
  });

  html += `
    </tbody>
  </table>
  `;

  return html;
}

/**
 * ดาวน์โหลด CSV พร้อม UTF-8 BOM สำหรับเปิดใน MS Excel ภาษาไทย
 */
export function downloadProsecutorHearingCsv(result: MonthHearingScheduleResult): void {
  const headers = [
    'ลำดับ',
    'อัยการเจ้าของสำนวน',
    'วันที่นัด (ค.ศ.)',
    'วันที่นัด (พ.ศ.)',
    'วันในสัปดาห์',
    'เวลานัด',
    'ห้องพิจารณา/บัลลังก์',
    'ประเภทนัด',
    'เลขคดีดำ',
    'เลขคดีแดง',
    'จำเลย',
    'โจทก์',
    'ศาล',
    'สถานะสำนวน',
    'การเสนอเวรชี้',
    'หมายเหตุ/รายละเอียดนัด',
  ];

  const rows: string[][] = [];
  let count = 0;

  result.prosecutors.forEach((p) => {
    p.dateSchedules.forEach((ds) => {
      ds.appointments.forEach((a) => {
        count++;
        const statusLabel = a.isCompleted
          ? `เสร็จสิ้นแล้ว${a.completedDate ? ` (${formatThaiDate(a.completedDate, { short: true })})` : ''}`
          : 'ยังไม่เสร็จสิ้น';
        const dutyLabel = a.isSubmittedToDuty
          ? `เสนอเวรชี้แล้ว${a.submittedToDutyOfficer ? ` (${a.submittedToDutyOfficer})` : ''}`
          : '-';

        rows.push([
          String(count),
          a.prosecutorName,
          a.appointmentDate,
          ds.thaiDateLabel,
          ds.dayOfWeekThai,
          a.appointmentTime || '',
          a.courtRoom || '',
          a.categoryLabel,
          a.blackCaseNo,
          a.redCaseNo || '',
          a.defendant,
          a.plaintiff,
          a.court,
          statusLabel,
          dutyLabel,
          a.notes || '',
        ]);
      });
    });
  });

  const escapeCsv = (val: string) => {
    const s = String(val || '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `ปฏิทินนัดศาลรายเดือน_${result.yearMonth.replace('-', '_')}_อัยการเจ้าของสำนวน.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
