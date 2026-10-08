import { AppealCase } from '../types/appeal';
import { formatThaiDate } from './dateUtils';
import { getAppointmentLabel, isCaseConfessed, isJudgmentRecorded } from './appointmentUtils';

/**
 * 7 Column Headers as specifically requested by user:
 * 1. ข้อมูล ส.1 และ ส.4
 * 2. ข้อมูลเลขคดีดำ
 * 3. ข้อมูลเลขคดีแดง
 * 4. ชื่ออัยการเจ้าของสำนวน
 * 5. ชื่อผู้ต้องหา
 * 6. การดำเนินการว่าเป็นสำนวนรับสารภาพหรือสำนวนมีนัดต่อ
 * 7. ข้อมูลสำนวนเสร็จไปวันที่เท่าใดจากการกดเสร็จสิ้นในเว็ปแอพนี้
 */
export const DAILY_EXPORT_HEADERS = [
  'ข้อมูล ส.1 และ ส.4',
  'เลขคดีดำ',
  'เลขคดีแดง',
  'ชื่ออัยการเจ้าของสำนวน',
  'ชื่อผู้ต้องหา',
  'การดำเนินการ',
  'วันที่เสร็จสิ้นสำนวน',
] as const;

/**
 * ช่องที่ 1: ข้อมูล ส.1 และ ส.4
 */
export function formatS1S4(c: AppealCase): string {
  const parts: string[] = [];
  if (c.receivedNumberS1 && c.receivedNumberS1.trim()) {
    parts.push(`ส.1: ${c.receivedNumberS1.trim()}`);
  }
  if (c.filingNumberS4 && c.filingNumberS4.trim()) {
    parts.push(`ส.4: ${c.filingNumberS4.trim()}`);
  }
  return parts.length > 0 ? parts.join(' / ') : '-';
}

/**
 * ช่องที่ 2: เลขคดีดำ
 */
export function formatBlackCaseNo(c: AppealCase): string {
  return c.blackCaseNo ? c.blackCaseNo.trim() : '-';
}

/**
 * ช่องที่ 3: เลขคดีแดง
 */
export function formatRedCaseNo(c: AppealCase): string {
  if (c.redCaseNo && c.redCaseNo.trim()) {
    return c.redCaseNo.trim();
  }
  return 'ยังไม่มีเลขแดง';
}

/**
 * ช่องที่ 4: ชื่ออัยการเจ้าของสำนวน
 * ดึงชื่ออัยการเจ้าของสำนวนที่รับผิดชอบสำนวนคดี (responsiblePerson)
 * หมายเหตุ: ต้องดึงชื่ออัยการเจ้าของสำนวนที่รับผิดชอบโดยตรง ไม่ดึงอัยการเวรชี้ (prosecutorName) มาใส่แทน
 */
export function formatProsecutorName(c: AppealCase): string {
  // ดึงชื่ออัยการเจ้าของสำนวนที่รับผิดชอบสำนวนคดีโดยตรง (responsiblePerson) ก่อนเสมอ
  if (c.responsiblePerson && c.responsiblePerson.trim()) {
    return c.responsiblePerson.trim();
  }
  // กรณีสำนวนยังไม่ได้ระบุชื่อเจ้าของสำนวน
  if (c.prosecutorName && c.prosecutorName.trim()) {
    return c.prosecutorName.trim();
  }
  return 'รอกำหนด';
}

/**
 * ช่องที่ 5: ชื่อผู้ต้องหา
 */
export function formatDefendant(c: AppealCase): string {
  return c.defendant ? c.defendant.trim() : '-';
}

/**
 * ช่องที่ 6: การดำเนินการว่าเป็นสำนวนรับสารภาพหรือสำนวนมีนัดต่อ
 */
export function formatProcedureStatus(c: AppealCase, concise: boolean = false): string {
  // 1. สำนวนเบิกฟ้อง (ยังไม่ทราบคำให้การว่ารับสารภาพหรือปฏิเสธ)
  if (c.isRequisitionCase || c.appointmentType === 'requisition') {
    const targetDate = c.requisitionDate || c.appointmentDate;
    if (targetDate) {
      return `สำนวนเบิกฟ้อง (นัด ${formatThaiDate(targetDate, { short: true })})`;
    }
    return 'สำนวนเบิกฟ้อง (รอเบิกตัว)';
  }

  // 2. สำนวนรับสารภาพ
  if (isCaseConfessed(c)) {
    if (!concise && isJudgmentRecorded(c) && c.judgmentDate) {
      return `สำนวนรับสารภาพ (พิพากษา ${formatThaiDate(c.judgmentDate, { short: true })})`;
    }
    return 'สำนวนรับสารภาพ';
  }

  // 2. สำนวนมีนัดต่อ
  if (c.appointmentType && c.appointmentType !== 'none') {
    const apptName = getAppointmentLabel(c.appointmentType, c.appointmentTypeName);
    if (!concise && c.appointmentDate) {
      const dateStr = formatThaiDate(c.appointmentDate, { short: true });
      const timeStr = c.appointmentTime ? ` ${c.appointmentTime}` : '';
      return `สำนวนมีนัดต่อ (${apptName} ${dateStr}${timeStr})`;
    }
    if (!concise) {
      return `สำนวนมีนัดต่อ (${apptName})`;
    }
    return 'สำนวนมีนัดต่อ';
  }

  if (c.defendantPlea === 'denied') {
    return concise ? 'สำนวนมีนัดต่อ' : 'สำนวนมีนัดต่อ (จำเลยปฏิเสธ)';
  }

  return 'สำนวนมีนัดต่อ';
}

/**
 * ช่องที่ 7: ข้อมูลสำนวนเสร็จไปวันที่เท่าใดจากการกดเสร็จสิ้นในเว็ปแอพนี้
 */
export function formatCompletedDate(c: AppealCase, concise: boolean = false): string {
  if (c.isCompleted) {
    if (c.completedDate) {
      const dateStr = formatThaiDate(c.completedDate, { short: true });
      if (!concise && c.completionReason) {
        const reasonMap: Record<string, string> = {
          appealed: 'ยื่นอุทธรณ์แล้ว',
          no_appeal: 'มีคำสั่งไม่อุทธรณ์/ยุติ',
          finalized: 'คดีถึงที่สุด',
          settled: 'ยอมความ/ประนีประนอม',
          other: 'อื่นๆ',
        };
        const reasonStr = reasonMap[c.completionReason] || c.completionReason;
        return `เสร็จสิ้นเมื่อ ${dateStr} (${reasonStr})`;
      }
      return `เสร็จสิ้นเมื่อ ${dateStr}`;
    }
    return 'เสร็จสิ้นแล้ว';
  }
  return 'ยังไม่เสร็จสิ้น';
}

/**
 * แปลงรายการคดีเป็น Array 7 ช่องตรงตามที่ผู้ใช้กำหนด
 */
export function getDailyExportRow(c: AppealCase, conciseProcedure: boolean = false): string[] {
  return [
    formatS1S4(c),
    formatBlackCaseNo(c),
    formatRedCaseNo(c),
    formatProsecutorName(c),
    formatDefendant(c),
    formatProcedureStatus(c, conciseProcedure),
    formatCompletedDate(c, conciseProcedure),
  ];
}

export function getDailyExportRows(cases: AppealCase[], conciseProcedure: boolean = false): string[][] {
  return cases.map((c) => getDailyExportRow(c, conciseProcedure));
}

/**
 * จัดรูปแบบ TSV (Tab-Separated Values) สำหรับกดคัดลอกแล้วไปวางลง Google Sheets ทันที
 * พร้อมหัวข้อ "วันที่ฟ้องในแต่ละวัน" ชัดเจน
 */
export function formatDailyCasesTsv(
  filingDate: string,
  cases: AppealCase[],
  options?: {
    conciseProcedure?: boolean;
    includeTitleRow?: boolean;
  }
): string {
  const concise = options?.conciseProcedure ?? false;
  const includeTitle = options?.includeTitleRow ?? true;

  const lines: string[] = [];
  if (includeTitle && filingDate) {
    lines.push(`วันที่ฟ้อง: ${formatThaiDate(filingDate)}`);
  }
  lines.push(DAILY_EXPORT_HEADERS.join('\t'));
  cases.forEach((c) => {
    lines.push(getDailyExportRow(c, concise).join('\t'));
  });

  return lines.join('\n');
}

/**
 * จัดรูปแบบ CSV (Comma-Separated Values) พร้อม Escape เครื่องหมายจุลภาคและคำพูด
 */
export function formatDailyCasesCsv(
  filingDate: string,
  cases: AppealCase[],
  options?: {
    conciseProcedure?: boolean;
    includeTitleRow?: boolean;
  }
): string {
  const concise = options?.conciseProcedure ?? false;
  const includeTitle = options?.includeTitleRow ?? true;

  const escapeCell = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines: string[] = [];
  if (includeTitle && filingDate) {
    lines.push(escapeCell(`วันที่ฟ้อง: ${formatThaiDate(filingDate)}`));
  }
  lines.push(DAILY_EXPORT_HEADERS.map(escapeCell).join(','));
  cases.forEach((c) => {
    lines.push(getDailyExportRow(c, concise).map(escapeCell).join(','));
  });

  return lines.join('\r\n');
}

/**
 * สั่งให้เบราว์เซอร์ดาวน์โหลดไฟล์ CSV พร้อม UTF-8 BOM เพื่อให้ภาษาไทยใน Google Sheets / Excel ไม่เพี้ยน
 */
export function downloadDailyCasesCsv(
  filingDate: string,
  cases: AppealCase[],
  options?: {
    conciseProcedure?: boolean;
    includeTitleRow?: boolean;
  }
): void {
  const csvContent = formatDailyCasesCsv(filingDate, cases, options);
  // เพิ่ม UTF-8 BOM (\uFEFF)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `คดีที่ฟ้องประจำวันที่_${filingDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
