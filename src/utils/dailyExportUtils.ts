import { AppealCase } from '../types/appeal';
import { formatThaiDate } from './dateUtils';
import { getAppointmentLabel, isCaseConfessed, isCaseDenied, isJudgmentRecorded } from './appointmentUtils';

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
  // 1. สำนวนรับสารภาพ -> สีเหลือง (หากเคยเป็นสำนวนเบิกฟ้องแล้วเปลี่ยนมารับสารภาพ จะเข้าเงื่อนไขนี้)
  if (isCaseConfessed(c) || c.defendantPlea === 'confessed') {
    if (!concise && isJudgmentRecorded(c) && c.judgmentDate) {
      return `สำนวนรับสารภาพ (พิพากษา ${formatThaiDate(c.judgmentDate, { short: true })})`;
    }
    return 'สำนวนรับสารภาพ';
  }

  // 2. สำนวนปฏิเสธ (จำเลยปฏิเสธ / นัดคุ้มครองสิทธิ) -> สีส้ม
  if (c.appointmentType === 'rights_protection' || c.defendantPlea === 'denied' || isCaseDenied(c)) {
    if (c.appointmentType && c.appointmentType !== 'none') {
      const apptName = getAppointmentLabel(c.appointmentType, c.appointmentTypeName);
      if (!concise && c.appointmentDate) {
        const dateStr = formatThaiDate(c.appointmentDate, { short: true });
        const timeStr = c.appointmentTime ? ` ${c.appointmentTime}` : '';
        return `สำนวนปฏิเสธ (${apptName} ${dateStr}${timeStr})`;
      }
      return concise ? 'สำนวนปฏิเสธ' : `สำนวนปฏิเสธ (${apptName})`;
    }
    return concise ? 'สำนวนปฏิเสธ' : 'สำนวนปฏิเสธ (มีนัดต่อ)';
  }

  // 3. สำนวนเบิกฟ้อง (ยังไม่ทราบคำให้การว่ารับสารภาพหรือปฏิเสธ) -> สีเขียว
  if (c.isRequisitionCase || c.appointmentType === 'requisition') {
    const targetDate = c.requisitionDate || c.appointmentDate;
    if (targetDate) {
      return `สำนวนเบิกฟ้อง (นัด ${formatThaiDate(targetDate, { short: true })})`;
    }
    return 'สำนวนเบิกฟ้อง (รอเบิกตัว)';
  }

  // 4. นัดอื่นๆ
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

  return 'สำนวนมีนัดต่อ';
}

export type ProcedureCategory = 'confessed' | 'denied' | 'requisition' | 'other';

export interface ProcedureStyleInfo {
  category: ProcedureCategory;
  name: string;
  badgeClass: string;
  hexBg: string;
  hexText: string;
  hexBorder: string;
  sheetsRgb: { red: number; green: number; blue: number };
  icon: string;
}

/**
 * ดึงข้อมูลการจัดสีพื้นหลังช่อง "การดำเนินการ" ตามคำสั่งผู้ใช้:
 * - สำนวนรับสารภาพให้ใช้สีเหลือง
 * - สำนวนปฏิเสธให้ใช้สีส้ม
 * - สำนวนมีเบิกฟ้องให้ใช้สีเขียว
 */
export function getProcedureStyleInfo(c?: AppealCase | null, procedureText?: string): ProcedureStyleInfo {
  const text = procedureText || (c ? formatProcedureStatus(c) : '');
  const isConfessed = (c && (isCaseConfessed(c) || c.defendantPlea === 'confessed')) || text.includes('รับสารภาพ');
  const isDenied = (c && (isCaseDenied(c) || c.defendantPlea === 'denied')) || text.includes('ปฏิเสธ') || text.includes('คุ้มครองสิทธิ');
  const isReq = !isConfessed && !isDenied && (((c && (c.isRequisitionCase || c.appointmentType === 'requisition')) || text.includes('เบิกฟ้อง')));

  // 1. สำนวนมีเบิกฟ้อง -> สีเขียว (Green)
  if (isReq) {
    return {
      category: 'requisition',
      name: 'สำนวนมีเบิกฟ้อง',
      badgeClass: 'bg-emerald-200 text-emerald-950 border-emerald-400 font-bold',
      hexBg: '#A7F3D0', // Light green
      hexText: '#064E3B',
      hexBorder: '#34D399',
      sheetsRgb: { red: 0.65, green: 0.95, blue: 0.81 },
      icon: '🚚',
    };
  }

  // 2. สำนวนรับสารภาพ -> สีเหลือง (Yellow)
  if (isConfessed) {
    return {
      category: 'confessed',
      name: 'สำนวนรับสารภาพ',
      badgeClass: 'bg-yellow-200 text-yellow-950 border-yellow-400 font-bold',
      hexBg: '#FEF08A', // Light yellow
      hexText: '#713F12',
      hexBorder: '#FACC15',
      sheetsRgb: { red: 1.0, green: 0.94, blue: 0.54 },
      icon: '⚖️',
    };
  }

  // 3. สำนวนปฏิเสธ -> สีส้ม (Orange)
  if (isDenied) {
    return {
      category: 'denied',
      name: 'สำนวนปฏิเสธ',
      badgeClass: 'bg-orange-200 text-orange-950 border-orange-400 font-bold',
      hexBg: '#FED7AA', // Light orange
      hexText: '#7C2D12',
      hexBorder: '#FB923C',
      sheetsRgb: { red: 1.0, green: 0.84, blue: 0.67 },
      icon: '🛡️',
    };
  }

  // อื่นๆ -> สีฟ้าอ่อน
  return {
    category: 'other',
    name: 'สำนวนมีนัดต่อ',
    badgeClass: 'bg-sky-100 text-sky-950 border-sky-300 font-semibold',
    hexBg: '#BAE6FD',
    hexText: '#0C4A6E',
    hexBorder: '#38BDF8',
    sheetsRgb: { red: 0.73, green: 0.90, blue: 0.99 },
    icon: '📅',
  };
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
 * จัดรูปแบบ TSV (Tab-Separated Values) สำหรับกดคัดลอกแล้วไปวางลง Google Sheets / Excel
 * สามารถเลือกให้เป็นเฉพาะแถวข้อมูล (สำหรับวางลงในฟอร์ม Excel ที่มีอยู่แล้ว) หรือรวมหัวตารางได้
 */
export function formatDailyCasesTsv(
  filingDate: string,
  cases: AppealCase[],
  options?: {
    conciseProcedure?: boolean;
    includeTitleRow?: boolean;
    includeHeaderRow?: boolean;
  }
): string {
  const concise = options?.conciseProcedure ?? false;
  const includeTitle = options?.includeTitleRow ?? false;
  const includeHeader = options?.includeHeaderRow ?? false;

  const lines: string[] = [];
  if (includeTitle && filingDate) {
    lines.push(`วันที่ฟ้อง: ${formatThaiDate(filingDate)}`);
  }
  if (includeHeader) {
    lines.push(DAILY_EXPORT_HEADERS.join('\t'));
  }
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
    includeHeaderRow?: boolean;
  }
): string {
  const concise = options?.conciseProcedure ?? false;
  const includeTitle = options?.includeTitleRow ?? false;
  const includeHeader = options?.includeHeaderRow ?? true;

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
  if (includeHeader) {
    lines.push(DAILY_EXPORT_HEADERS.map(escapeCell).join(','));
  }
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
    includeHeaderRow?: boolean;
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

/**
 * จัดรูปแบบ HTML สำหรับคัดลอกลง Google Sheets หรือ Excel
 * - เมื่อนำไปวางในแบบฟอร์ม Excel ที่มีอยู่แล้ว: asTableFrame = false, includeHeaderRow = false, includeTitleRow = false
 *   จะไม่ติดหัวตาราง ไม่ติดกรอบตาราง (border) ทำให้ข้อมูลลงช่องในฟอร์มเดิมพอดี และช่อง "การดำเนินการ" ยังคงมีสีพื้นหลังตามคำขอ
 * - ช่องการดำเนินการ: สีเหลืองสำหรับรับสารภาพ, สีส้มสำหรับปฏิเสธ, สีเขียวสำหรับเบิกฟ้อง
 */
export function formatDailyCasesHtml(
  filingDate: string,
  cases: AppealCase[],
  options?: {
    conciseProcedure?: boolean;
    includeTitleRow?: boolean;
    includeHeaderRow?: boolean;
    asTableFrame?: boolean;
  }
): string {
  const concise = options?.conciseProcedure ?? false;
  const includeTitle = options?.includeTitleRow ?? false;
  const includeHeader = options?.includeHeaderRow ?? false;
  const asTable = options?.asTableFrame ?? false;

  let html = `<meta charset="utf-8">\n`;
  if (asTable) {
    html += `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-family: 'Sarabun', 'Prompt', sans-serif; font-size: 11pt;">\n`;
  } else {
    // ไม่มีกรอบตาราง ไม่มีเส้นขอบนอก เพื่อไม่ให้ซ้อนทับหรือรบกวนฟอร์มใน Excel ที่มีอยู่แล้ว
    html += `<table cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-family: 'Sarabun', 'Prompt', sans-serif; font-size: 11pt;">\n`;
  }

  if (includeTitle && filingDate) {
    html += `  <tr style="background-color: #064E3B; color: #FFFFFF; font-weight: bold; font-size: 13pt; text-align: center;">\n`;
    html += `    <td colspan="7" style="padding: 8px; background-color: #064E3B; color: #FFFFFF; font-weight: bold; text-align: center;">วันที่ฟ้อง: ${formatThaiDate(filingDate)}</td>\n`;
    html += `  </tr>\n`;
  }

  // Header row (เมื่อเลือกให้มีหัวตารางเท่านั้น)
  if (includeHeader) {
    html += `  <tr style="background-color: #047857; color: #FFFFFF; font-weight: bold; text-align: center;">\n`;
    DAILY_EXPORT_HEADERS.forEach((h) => {
      html += `    <th style="padding: 6px 10px; background-color: #047857; color: #FFFFFF; ${asTable ? 'border: 1px solid #065F46;' : ''} text-align: center;">${h}</th>\n`;
    });
    html += `  </tr>\n`;
  }

  // Data rows
  cases.forEach((c) => {
    const row = getDailyExportRow(c, concise);
    const procStyle = getProcedureStyleInfo(c, row[5]);

    html += `  <tr>\n`;
    // 1. ส.1 และ ส.4
    html += `    <td style="padding: 4px 8px; ${asTable ? 'border: 1px solid #D1D5DB;' : ''} text-align: center; color: #1E3A8A;">${row[0]}</td>\n`;
    // 2. เลขคดีดำ
    html += `    <td style="padding: 4px 8px; ${asTable ? 'border: 1px solid #D1D5DB;' : ''} font-weight: bold; text-align: center;">${row[1]}</td>\n`;
    // 3. เลขคดีแดง
    html += `    <td style="padding: 4px 8px; ${asTable ? 'border: 1px solid #D1D5DB;' : ''} text-align: center; color: ${row[2] !== 'ยังไม่มีเลขแดง' && row[2] !== '-' ? '#B91C1C; font-weight: bold;' : '#6B7280;'}">${row[2]}</td>\n`;
    // 4. ชื่ออัยการเจ้าของสำนวน
    html += `    <td style="padding: 4px 8px; ${asTable ? 'border: 1px solid #D1D5DB;' : ''}">${row[3]}</td>\n`;
    // 5. ชื่อผู้ต้องหา
    html += `    <td style="padding: 4px 8px; ${asTable ? 'border: 1px solid #D1D5DB;' : ''}">${row[4]}</td>\n`;
    // 6. การดำเนินการ: สีเหลืองสำหรับรับสารภาพ, สีส้มสำหรับปฏิเสธ, สีเขียวสำหรับเบิกฟ้อง
    html += `    <td style="padding: 4px 8px; ${asTable ? 'border: 1px solid #D1D5DB;' : ''} background-color: ${procStyle.hexBg}; color: ${procStyle.hexText}; font-weight: bold; text-align: center;">${row[5]}</td>\n`;
    // 7. วันที่เสร็จสิ้นสำนวน
    html += `    <td style="padding: 4px 8px; ${asTable ? 'border: 1px solid #D1D5DB;' : ''} text-align: center;">${row[6]}</td>\n`;
    html += `  </tr>\n`;
  });

  html += `</table>`;
  return html;
}

