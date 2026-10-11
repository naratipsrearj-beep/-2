import { AppealCase } from '../types/appeal';
import { isCaseConfessed, isCaseDenied, isCaseRequisition } from './appointmentUtils';
import { formatThaiMonth, getCurrentMonthString } from './dateUtils';

export interface ProsecutorMonthlySummary {
  prosecutorName: string;
  totalCases: number;
  confessedCases: number;     // จำเลยรับสารภาพ (สีเหลือง)
  deniedCases: number;        // จำเลยปฏิเสธ (สีส้ม)
  requisitionCases: number;   // สำนวนมีเบิกฟ้อง (สีเขียว)
  otherCases: number;         // สำนวนอื่นๆ / รอผล
  confessedPercent: number;   // ร้อยละ
  deniedPercent: number;      // ร้อยละ
  cases: AppealCase[];        // สำนวนทั้งหมดของอัยการคนนี้ในเดือนนั้น
}

export interface MonthFilingSummary {
  yearMonth: string;          // e.g. "2026-10"
  monthLabel: string;         // e.g. "ตุลาคม 2569"
  monthLabelShort: string;    // e.g. "ต.ค. 69"
  totalCases: number;
  totalConfessed: number;
  totalDenied: number;
  totalRequisition: number;
  totalOther: number;
  confessedPercent: number;
  deniedPercent: number;
  prosecutors: ProsecutorMonthlySummary[];
  allCasesInMonth: AppealCase[];
}

/**
 * ดึงรายการเดือน (YYYY-MM) ทั้งหมดที่มีการยื่นฟ้องคดี เรียงจากใหม่ไปเก่า
 */
export function getAvailableFilingMonths(cases: AppealCase[]): string[] {
  const monthSet = new Set<string>();
  const currentMonth = getCurrentMonthString();
  monthSet.add(currentMonth);

  cases.forEach((c) => {
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
 * สรุปข้อมูลปริมาณคดีที่ฟ้องในเดือน แยกตามอัยการเจ้าของสำนวนแต่ละคน
 * ระบุ:
 * - ปริมาณคดีรวมในเดือน
 * - จำเลยรับสารภาพกี่สำนวน (สีเหลือง)
 * - จำเลยปฏิเสธกี่สำนวน (สีส้ม)
 * - สำนวนมีเบิกฟ้องกี่สำนวน (สีเขียว)
 */
export function getMonthlyProsecutorSummary(cases: AppealCase[], yearMonth: string): MonthFilingSummary {
  // กรองเฉพาะคดีที่ฟ้องในเดือนที่เลือก
  const casesInMonth = cases.filter((c) => c.filingDate && c.filingDate.startsWith(yearMonth));

  // จัดกลุ่มตามอัยการเจ้าของสำนวน
  const prosecutorMap = new Map<string, AppealCase[]>();

  casesInMonth.forEach((c) => {
    const rawName = c.responsiblePerson || c.prosecutorName;
    const name = rawName && rawName.trim() ? rawName.trim() : 'ไม่ระบุอัยการเจ้าของสำนวน';
    
    if (!prosecutorMap.has(name)) {
      prosecutorMap.set(name, []);
    }
    prosecutorMap.get(name)!.push(c);
  });

  let totalConfessed = 0;
  let totalDenied = 0;
  let totalRequisition = 0;
  let totalOther = 0;

  const prosecutorsSummary: ProsecutorMonthlySummary[] = [];

  prosecutorMap.forEach((caseList, name) => {
    let pConfessed = 0;
    let pDenied = 0;
    let pRequisition = 0;
    let pOther = 0;

    caseList.forEach((c) => {
      if (isCaseConfessed(c)) {
        pConfessed++;
      } else if (isCaseDenied(c)) {
        pDenied++;
      } else if (isCaseRequisition(c)) {
        pRequisition++;
      } else {
        pOther++;
      }
    });

    totalConfessed += pConfessed;
    totalDenied += pDenied;
    totalRequisition += pRequisition;
    totalOther += pOther;

    const count = caseList.length;
    const confessedPercent = count > 0 ? Math.round((pConfessed / count) * 100) : 0;
    const deniedPercent = count > 0 ? Math.round((pDenied / count) * 100) : 0;

    // เรียงคดีตามวันที่ฟ้องจากใหม่ไปเก่า
    const sortedCases = [...caseList].sort((a, b) => (b.filingDate || '').localeCompare(a.filingDate || ''));

    prosecutorsSummary.push({
      prosecutorName: name,
      totalCases: count,
      confessedCases: pConfessed,
      deniedCases: pDenied,
      requisitionCases: pRequisition,
      otherCases: pOther,
      confessedPercent,
      deniedPercent,
      cases: sortedCases,
    });
  });

  // เรียงลำดับอัยการ: เอาคนที่มีจำนวนคดีมากที่สุดขึ้นก่อน
  prosecutorsSummary.sort((a, b) => {
    if (b.totalCases !== a.totalCases) {
      return b.totalCases - a.totalCases;
    }
    return a.prosecutorName.localeCompare(b.prosecutorName, 'th');
  });

  const totalCases = casesInMonth.length;
  const overallConfessedPercent = totalCases > 0 ? Math.round((totalConfessed / totalCases) * 100) : 0;
  const overallDeniedPercent = totalCases > 0 ? Math.round((totalDenied / totalCases) * 100) : 0;

  return {
    yearMonth,
    monthLabel: formatThaiMonth(yearMonth, { short: false }),
    monthLabelShort: formatThaiMonth(yearMonth, { short: true }),
    totalCases,
    totalConfessed,
    totalDenied,
    totalRequisition,
    totalOther,
    confessedPercent: overallConfessedPercent,
    deniedPercent: overallDeniedPercent,
    prosecutors: prosecutorsSummary,
    allCasesInMonth: casesInMonth,
  };
}

export interface ExportMonthlyOptions {
  forExistingForm?: boolean;
  includeHeader?: boolean;
  includeTotal?: boolean;
}

/**
 * รูปแบบ TSV สำหรับกดคัดลอกไปวางลงใน Excel / Google Sheets
 * หาก forExistingForm เป็นจริง จะไม่ใส่หัวตารางและข้อความหัวเรื่อง เหมาะสำหรับนำไปวางลงในแบบฟอร์ม Excel ที่มีหัวตารางอยู่แล้ว
 */
export function formatMonthlyProsecutorSummaryTsv(
  summary: MonthFilingSummary,
  options: ExportMonthlyOptions = {}
): string {
  const { forExistingForm = false, includeHeader = !forExistingForm, includeTotal = true } = options;
  const lines: string[] = [];

  if (!forExistingForm) {
    lines.push(`รายงานสรุปปริมาณคดีที่ฟ้องและคำให้การจำเลยแยกตามอัยการเจ้าของสำนวน ประจำเดือน ${summary.monthLabel}`);
    lines.push(`ยอดรวมคดีทั้งหมด: ${summary.totalCases} สำนวน | รับสารภาพ: ${summary.totalConfessed} สำนวน (${summary.confessedPercent}%) | ปฏิเสธ: ${summary.totalDenied} สำนวน (${summary.deniedPercent}%) | มีเบิกฟ้อง: ${summary.totalRequisition} สำนวน`);
    lines.push('');
  }
  
  // Header
  if (includeHeader) {
    lines.push([
      'ลำดับ',
      'อัยการเจ้าของสำนวน',
      'ปริมาณคดีที่ฟ้อง (สำนวน)',
      'จำเลยรับสารภาพ (สำนวน)',
      'จำเลยปฏิเสธ (สำนวน)',
      'สำนวนมีเบิกฟ้อง (สำนวน)',
      'อื่นๆ / รอผล (สำนวน)',
      'ร้อยละรับสารภาพ (%)',
      'ร้อยละปฏิเสธ (%)',
    ].join('\t'));
  }

  // Data rows
  summary.prosecutors.forEach((p, idx) => {
    lines.push([
      (idx + 1).toString(),
      p.prosecutorName,
      p.totalCases.toString(),
      p.confessedCases.toString(),
      p.deniedCases.toString(),
      p.requisitionCases.toString(),
      p.otherCases.toString(),
      `${p.confessedPercent}%`,
      `${p.deniedPercent}%`,
    ].join('\t'));
  });

  // Total Row
  if (includeTotal && !forExistingForm) {
    lines.push([
      'รวมทั้งสิ้น',
      `- (${summary.prosecutors.length} ท่าน)`,
      summary.totalCases.toString(),
      summary.totalConfessed.toString(),
      summary.totalDenied.toString(),
      summary.totalRequisition.toString(),
      summary.totalOther.toString(),
      `${summary.confessedPercent}%`,
      `${summary.deniedPercent}%`,
    ].join('\t'));
  }

  return lines.join('\n');
}

/**
 * รูปแบบ HTML สำหรับคัดลอกลงใน Excel พร้อมสีพื้นหลัง (เหลือง/ส้ม/เขียว)
 * หาก forExistingForm เป็นจริง จะไม่มีกรอบตาราง ไม่มีหัวเรื่อง เพื่อให้วางลงในช่องเซลล์ของฟอร์มเดิมได้พอดี
 */
export function formatMonthlyProsecutorSummaryHtml(
  summary: MonthFilingSummary,
  options: ExportMonthlyOptions = {}
): string {
  const { forExistingForm = false, includeHeader = !forExistingForm, includeTotal = true } = options;
  let html = `<meta charset="utf-8">\n`;

  if (forExistingForm) {
    html += `<table cellpadding="0" cellspacing="0" style="border: none; border-collapse: collapse; font-family: 'Sarabun', 'Prompt', sans-serif; font-size: 11pt;">\n`;
  } else {
    html += `<table cellpadding="4" cellspacing="0" style="border-collapse: collapse; font-family: 'Sarabun', 'Prompt', sans-serif; font-size: 11pt;">\n`;
    
    // Title
    html += `  <tr style="background-color: #1E293B; color: #FFFFFF; font-weight: bold; text-align: center; font-size: 13pt;">\n`;
    html += `    <td colspan="9" style="padding: 10px; border: 1px solid #334155;">รายงานสรุปปริมาณคดีที่ฟ้องและคำให้การจำเลยแยกตามอัยการเจ้าของสำนวน ประจำเดือน ${summary.monthLabel}</td>\n`;
    html += `  </tr>\n`;
  }

  // Headers
  if (includeHeader) {
    html += `  <tr style="background-color: #0F172A; color: #FFFFFF; font-weight: bold; text-align: center;">\n`;
    const headers = [
      'ลำดับ',
      'อัยการเจ้าของสำนวน',
      'ปริมาณคดีที่ฟ้อง (สำนวน)',
      'จำเลยรับสารภาพ (สำนวน)',
      'จำเลยปฏิเสธ (สำนวน)',
      'สำนวนมีเบิกฟ้อง (สำนวน)',
      'อื่นๆ / รอผล (สำนวน)',
      'ร้อยละรับสารภาพ',
      'ร้อยละปฏิเสธ',
    ];
    headers.forEach((h) => {
      html += `    <th style="padding: 6px 8px; border: ${forExistingForm ? 'none' : '1px solid #475569'}; text-align: center;">${h}</th>\n`;
    });
    html += `  </tr>\n`;
  }

  // Rows
  const borderStyle = forExistingForm ? 'border: none;' : 'border: 1px solid #E2E8F0;';
  summary.prosecutors.forEach((p, idx) => {
    html += `  <tr>\n`;
    html += `    <td style="padding: 6px; ${borderStyle} text-align: center;">${idx + 1}</td>\n`;
    html += `    <td style="padding: 6px 10px; ${borderStyle} font-weight: 500;">${p.prosecutorName}</td>\n`;
    html += `    <td style="padding: 6px; ${borderStyle} text-align: center; font-weight: bold; color: #0F172A;">${p.totalCases}</td>\n`;
    html += `    <td style="padding: 6px; ${borderStyle} text-align: center; background-color: #FEF08A; color: #713F12; font-weight: bold;">${p.confessedCases}</td>\n`;
    html += `    <td style="padding: 6px; ${borderStyle} text-align: center; background-color: #FED7AA; color: #7C2D12; font-weight: bold;">${p.deniedCases}</td>\n`;
    html += `    <td style="padding: 6px; ${borderStyle} text-align: center; background-color: #A7F3D0; color: #064E3B; font-weight: bold;">${p.requisitionCases}</td>\n`;
    html += `    <td style="padding: 6px; ${borderStyle} text-align: center; color: #64748B;">${p.otherCases}</td>\n`;
    html += `    <td style="padding: 6px; ${borderStyle} text-align: center; color: #854D0E; font-weight: 500;">${p.confessedPercent}%</td>\n`;
    html += `    <td style="padding: 6px; ${borderStyle} text-align: center; color: #9A3412; font-weight: 500;">${p.deniedPercent}%</td>\n`;
    html += `  </tr>\n`;
  });

  // Footer / Total
  if (includeTotal && !forExistingForm) {
    html += `  <tr style="background-color: #F1F5F9; font-weight: bold;">\n`;
    html += `    <td colspan="2" style="padding: 8px; border: 1px solid #CBD5E1; text-align: center; font-weight: bold;">รวมทั้งสิ้น (${summary.prosecutors.length} ท่าน)</td>\n`;
    html += `    <td style="padding: 8px; border: 1px solid #CBD5E1; text-align: center; font-weight: bold; font-size: 12pt;">${summary.totalCases}</td>\n`;
    html += `    <td style="padding: 8px; border: 1px solid #CBD5E1; text-align: center; background-color: #FEF08A; color: #713F12; font-weight: bold; font-size: 12pt;">${summary.totalConfessed}</td>\n`;
    html += `    <td style="padding: 8px; border: 1px solid #CBD5E1; text-align: center; background-color: #FED7AA; color: #7C2D12; font-weight: bold; font-size: 12pt;">${summary.totalDenied}</td>\n`;
    html += `    <td style="padding: 8px; border: 1px solid #CBD5E1; text-align: center; background-color: #A7F3D0; color: #064E3B; font-weight: bold; font-size: 12pt;">${summary.totalRequisition}</td>\n`;
    html += `    <td style="padding: 8px; border: 1px solid #CBD5E1; text-align: center; color: #64748B;">${summary.totalOther}</td>\n`;
    html += `    <td style="padding: 8px; border: 1px solid #CBD5E1; text-align: center; color: #854D0E; font-weight: bold;">${summary.confessedPercent}%</td>\n`;
    html += `    <td style="padding: 8px; border: 1px solid #CBD5E1; text-align: center; color: #9A3412; font-weight: bold;">${summary.deniedPercent}%</td>\n`;
    html += `  </tr>\n`;
  }

  html += `</table>`;
  return html;
}

/**
 * ดาวน์โหลดไฟล์ CSV สรุปประจำเดือน พร้อม UTF-8 BOM
 */
export function downloadMonthlyProsecutorCsv(summary: MonthFilingSummary): void {
  const escapeCell = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines: string[] = [];
  lines.push(escapeCell(`รายงานสรุปปริมาณคดีที่ฟ้องและคำให้การจำเลยแยกตามอัยการเจ้าของสำนวน ประจำเดือน ${summary.monthLabel}`));
  lines.push('');
  lines.push([
    'ลำดับ',
    'อัยการเจ้าของสำนวน',
    'ปริมาณคดีที่ฟ้อง (สำนวน)',
    'จำเลยรับสารภาพ (สำนวน)',
    'จำเลยปฏิเสธ (สำนวน)',
    'สำนวนมีเบิกฟ้อง (สำนวน)',
    'อื่นๆ / รอผล (สำนวน)',
    'ร้อยละรับสารภาพ',
    'ร้อยละปฏิเสธ',
  ].map(escapeCell).join(','));

  summary.prosecutors.forEach((p, idx) => {
    lines.push([
      (idx + 1).toString(),
      p.prosecutorName,
      p.totalCases.toString(),
      p.confessedCases.toString(),
      p.deniedCases.toString(),
      p.requisitionCases.toString(),
      p.otherCases.toString(),
      `${p.confessedPercent}%`,
      `${p.deniedPercent}%`,
    ].map(escapeCell).join(','));
  });

  lines.push([
    'รวมทั้งสิ้น',
    `(${summary.prosecutors.length} ท่าน)`,
    summary.totalCases.toString(),
    summary.totalConfessed.toString(),
    summary.totalDenied.toString(),
    summary.totalRequisition.toString(),
    summary.totalOther.toString(),
    `${summary.confessedPercent}%`,
    `${summary.deniedPercent}%`,
  ].map(escapeCell).join(','));

  const csvContent = lines.join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `สรุปปริมาณคดีและคำให้การแยกรายอัยการ_${summary.yearMonth}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
