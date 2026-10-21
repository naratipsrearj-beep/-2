import { AppealCase, CourtAppointmentType } from '../types/appeal';
import { classifyTargetAppointmentCategory } from './appointmentUtils';
import { formatThaiDate, getCurrentMonthString } from './dateUtils';

export type TargetAppointmentCategory = 'rights_protection' | 'investigation' | 'witness_confessed';

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
  category: TargetAppointmentCategory;
  categoryLabel: string;
  appointmentType: CourtAppointmentType;
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
  monthLabel: string; // e.g. "ตุลาคม 2569"
  totalAppointments: number;
  totalProsecutors: number;
  totalActiveDays: number;
  countsByCategory: {
    rights_protection: number;
    investigation: number;
    witness_confessed: number;
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
    };
    countsByStatus?: {
      total: number;
      incomplete: number;
      completed: number;
      submittedToDuty: number;
    };
  }[];
}

/**
 * ดึงรายการเดือน (YYYY-MM) ทั้งหมดที่มีนัดคุ้มครองสิทธิ, สืบเสาะ, หรือสืบประกอบรับสารภาพ
 */
export function getAvailableHearingMonths(cases: AppealCase[]): string[] {
  const monthSet = new Set<string>();
  const currentMonth = getCurrentMonthString();
  monthSet.add(currentMonth);

  cases.forEach((c) => {
    // 1. ตรวจสอบนัดแรก/นัดหลัก
    if (c.appointmentDate && c.appointmentDate.length >= 7) {
      const cat = classifyTargetAppointmentCategory(c.appointmentType, c.appointmentTypeName, c.appointmentNotes);
      if (cat) {
        const ym = c.appointmentDate.slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(ym)) {
          monthSet.add(ym);
        }
      }
    }

    // 2. ตรวจสอบนัดต่อๆ ไป
    if (Array.isArray(c.subsequentAppointments)) {
      c.subsequentAppointments.forEach((appt) => {
        if (appt.date && appt.date.length >= 7) {
          const cat = classifyTargetAppointmentCategory(appt.type, appt.typeName, appt.notes);
          if (cat) {
            const ym = appt.date.slice(0, 7);
            if (/^\d{4}-\d{2}$/.test(ym)) {
              monthSet.add(ym);
            }
          }
        }
      });
    }

    // รวมเดือนที่ฟ้องด้วยเพื่อให้ผู้ใช้เลือกดูได้สะดวก
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
 * ครอบคลุม: นัดคุ้มครองสิทธิ, สืบเสาะ, นัดสืบประกอบรับสารภาพ
 */
export function extractProsecutorMonthlyHearings(
  cases: AppealCase[],
  yearMonth: string
): MonthHearingScheduleResult {
  const allAppointments: ProsecutorHearingAppointment[] = [];

  cases.forEach((c) => {
    const rawProsecutor = c.responsiblePerson || c.prosecutorName;
    const prosecutorName = rawProsecutor && rawProsecutor.trim() ? rawProsecutor.trim() : 'ไม่ระบุอัยการเจ้าของสำนวน';

    // 1. ตรวจสอบนัดแรก/นัดหลัก
    if (c.appointmentDate && c.appointmentDate.startsWith(yearMonth)) {
      const cat = classifyTargetAppointmentCategory(c.appointmentType, c.appointmentTypeName, c.appointmentNotes);
      if (cat) {
        const categoryLabel =
          cat === 'rights_protection'
            ? 'นัดคุ้มครองสิทธิ'
            : cat === 'investigation'
            ? 'นัดสืบเสาะ'
            : 'นัดสืบประกอบรับสารภาพ';

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
          category: cat,
          categoryLabel,
          appointmentType: c.appointmentType || 'other',
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
        });
      }
    }

    // 2. ตรวจสอบนัดถัดไป (subsequentAppointments)
    if (Array.isArray(c.subsequentAppointments)) {
      c.subsequentAppointments.forEach((appt, sIdx) => {
        if (appt.date && appt.date.startsWith(yearMonth)) {
          const cat = classifyTargetAppointmentCategory(appt.type, appt.typeName, appt.notes);
          if (cat) {
            const categoryLabel =
              cat === 'rights_protection'
                ? 'นัดคุ้มครองสิทธิ'
                : cat === 'investigation'
                ? 'นัดสืบเสาะ'
                : 'นัดสืบประกอบรับสารภาพ';

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
              category: cat,
              categoryLabel,
              appointmentType: appt.type || 'other',
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
            });
          }
        }
      });
    }
  });

  // เรียงลำดับนัดตามวันที่ (asc) และเวลา
  allAppointments.sort((a, b) => {
    const dComp = a.appointmentDate.localeCompare(b.appointmentDate);
    if (dComp !== 0) return dComp;
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

  let totalRights = 0;
  let totalInves = 0;
  let totalConfessed = 0;

  const prosecutorsSummary: ProsecutorMonthlyHearingSummary[] = [];

  prosecutorMap.forEach((appts, pName) => {
    // จัดกลุ่มตามวันนัดของอัยการคนนี้
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

    dateMap.forEach((dAppts, dateStr) => {
      let dRights = 0;
      let dInves = 0;
      let dConfessed = 0;

      dAppts.forEach((a) => {
        if (a.category === 'rights_protection') dRights++;
        else if (a.category === 'investigation') dInves++;
        else if (a.category === 'witness_confessed') dConfessed++;
      });

      pRights += dRights;
      pInves += dInves;
      pConfessed += dConfessed;

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

    // เรียงตามวันที่ asc
    dateSchedules.sort((a, b) => a.date.localeCompare(b.date));

    totalRights += pRights;
    totalInves += pInves;
    totalConfessed += pConfessed;

    prosecutorsSummary.push({
      prosecutorName: pName,
      totalAppointments: appts.length,
      uniqueDatesCount: dateSchedules.length,
      countsByCategory: {
        rights_protection: pRights,
        investigation: pInves,
        witness_confessed: pConfessed,
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

  // เรียงลำดับอัยการ: คนที่มีนัดมากสุดขึ้นก่อน
  prosecutorsSummary.sort((a, b) => {
    if (b.totalAppointments !== a.totalAppointments) {
      return b.totalAppointments - a.totalAppointments;
    }
    return a.prosecutorName.localeCompare(b.prosecutorName, 'th');
  });

  // จัดกลุ่มภาพรวมตามรายวัน (Daily Schedules สำหรับมุมมองปฏิทิน)
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
    const pSet = new Set<string>();

    dAppts.forEach((a) => {
      pSet.add(a.prosecutorName);
      if (a.category === 'rights_protection') dRights++;
      else if (a.category === 'investigation') dInves++;
      else if (a.category === 'witness_confessed') dConfessed++;
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

  // สร้างชื่อเดือนภาษาไทย เช่น "ตุลาคม 2569"
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
    countsByCategory: {
      rights_protection: totalRights,
      investigation: totalInves,
      witness_confessed: totalConfessed,
    },
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
 * จัดรูปแบบ TSV สำหรับวางลง Excel โดยตรง (รองรับภาษาไทย)
 */
export function formatProsecutorHearingSummaryTsv(result: MonthHearingScheduleResult): string {
  const rows: string[] = [];

  rows.push(`สรุปวันนัดศาลรายเดือนของอัยการเจ้าของสำนวน (คุ้มครองสิทธิ • สืบเสาะ • สืบประกอบรับสารภาพ) ประจำเดือน ${result.monthLabel}`);
  rows.push(`นัดทั้งหมด: ${result.totalAppointments} นัด (ยังไม่เสร็จสิ้น: ${result.countsByStatus.incomplete} นัด | เสร็จสิ้นแล้ว: ${result.countsByStatus.completed} นัด) | อัยการที่มีนัด: ${result.totalProsecutors} ท่าน | คุ้มครองสิทธิ: ${result.countsByCategory.rights_protection} | สืบเสาะ: ${result.countsByCategory.investigation} | สืบประกอบ: ${result.countsByCategory.witness_confessed}`);
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
          : 'ยังไม่เสร็จสิ้น (คุมอุทธรณ์)';
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
          สรุปวันนัดศาลรายเดือนของอัยการเจ้าของสำนวน (คุ้มครองสิทธิ • สืบเสาะ • สืบประกอบรับสารภาพ) ประจำเดือน ${result.monthLabel}
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
            : '#92400e; background-color: #fef3c7;';

        const statusText = a.isCompleted
          ? `<span style="color: #065f46; background-color: #d1fae5; padding: 2px 6px; border-radius: 4px; font-weight: bold;">เสร็จสิ้นแล้ว${a.completedDate ? ` (${formatThaiDate(a.completedDate, { short: true })})` : ''}</span>`
          : `<span style="color: #1e40af; background-color: #dbeafe; padding: 2px 6px; border-radius: 4px;">ยังไม่เสร็จสิ้น (คุมอุทธรณ์)</span>`;

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
          : 'ยังไม่เสร็จสิ้น (คุมอุทธรณ์)';
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
    `สรุปวันนัดศาลรายเดือน_${result.yearMonth.replace('-', '_')}_อัยการเจ้าของสำนวน.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
