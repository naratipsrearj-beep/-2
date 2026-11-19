import { AppealCase } from '../types/appeal';
import {
  calculateAppealDeadline,
  formatThaiDate,
  getAppealUrgency,
  getDaysRemaining,
} from './dateUtils';

export type PendingDuty10DayRangeFilter =
  | 'all_le_10'    // เหลือ <= 10 วัน (รวมครบวันนี้และเกินกำหนด)
  | 'exact_10'     // เหลือ 10 วันพอดี
  | 'days_0_to_10' // เหลือ 0 - 10 วัน (ยังไม่เกินกำหนด)
  | 'overdue';     // เกินกำหนด (< 0 วัน)

export interface PendingDuty10DayEntry {
  caseItem: AppealCase;
  daysLeft: number;
  effectiveDeadline: string;
  isExtended: boolean;
  ownerProsecutor: string;
  pleaLabel: string;
  urgencyLevel: 'overdue' | 'due_today' | 'urgent_1_3' | 'warning_4_9' | 'exact_10';
  remainingLabel: string;
}

export interface PendingDutyProsecutorGroup {
  prosecutorName: string;
  totalCount: number;
  exact10Count: number;
  urgent0To9Count: number;
  overdueCount: number;
}

export interface PendingDuty10DaySummary {
  entries: PendingDuty10DayEntry[];
  totalCount: number;
  exact10Count: number;
  days0To10Count: number;
  days0To9Count: number;
  overdueCount: number;
  prosecutorGroups: PendingDutyProsecutorGroup[];
}

/**
 * ดึงวันครบกำหนดอุทธรณ์ที่มีผลจริง (วันขยายเวลา หรือ วันครบกำหนด 1 เดือน)
 */
export function getEffectiveAppealDeadline(caseItem: AppealCase): string {
  if (caseItem.extendedDeadline && caseItem.extendedDeadline.trim()) {
    return caseItem.extendedDeadline.trim();
  }
  if (caseItem.appealDeadline && caseItem.appealDeadline.trim()) {
    return caseItem.appealDeadline.trim();
  }
  if (caseItem.judgmentDate && caseItem.judgmentDate.trim()) {
    return calculateAppealDeadline(caseItem.judgmentDate).deadlineDate;
  }
  return '';
}

/**
 * ตรวจสอบว่าสำนวนเข้าเกณฑ์:
 * 1) ยังไม่กดเสร็จสิ้น และไม่ได้จำหน่ายชั่วคราว
 * 2) มีคำพิพากษา / เริ่มคุมระยะเวลาอุทธรณ์แล้ว
 * 3) ยังไม่ได้กดเสนอเวรชี้ (!isSubmittedToDuty)
 * 4) เหลือระยะเวลาอุทธรณ์ <= 10 วัน
 */
export function isCasePendingDutyWithin10Days(
  caseItem: AppealCase,
  refDate: Date = new Date()
): boolean {
  if (caseItem.isCompleted) return false;
  if (caseItem.isTemporarilyDischarged) return false;
  if (caseItem.isSubmittedToDuty) return false;

  const urgency = getAppealUrgency(caseItem, refDate);
  if (
    urgency === 'pending_trial' ||
    urgency === 'temporarily_discharged' ||
    urgency === 'completed'
  ) {
    return false;
  }

  const effectiveDeadline = getEffectiveAppealDeadline(caseItem);
  if (!effectiveDeadline) return false;

  const daysLeft = getDaysRemaining(caseItem, refDate);
  return daysLeft <= 10;
}

function getPleaLabel(caseItem: AppealCase): string {
  if (caseItem.defendantPlea === 'confessed') return 'รับสารภาพ';
  if (caseItem.defendantPlea === 'denied') return 'ปฏิเสธ';
  if (caseItem.hasJudgment) return 'มีคำพิพากษาแล้ว';
  return 'รอตรวจสอบ';
}

function getRemainingStatus(daysLeft: number): {
  urgencyLevel: PendingDuty10DayEntry['urgencyLevel'];
  remainingLabel: string;
} {
  if (daysLeft < 0) {
    return {
      urgencyLevel: 'overdue',
      remainingLabel: `เกินกำหนด ${Math.abs(daysLeft)} วัน`,
    };
  }
  if (daysLeft === 0) {
    return {
      urgencyLevel: 'due_today',
      remainingLabel: 'ครบกำหนดวันนี้ (0 วัน)',
    };
  }
  if (daysLeft <= 3) {
    return {
      urgencyLevel: 'urgent_1_3',
      remainingLabel: `ด่วน เหลือ ${daysLeft} วัน`,
    };
  }
  if (daysLeft === 10) {
    return {
      urgencyLevel: 'exact_10',
      remainingLabel: 'เหลือ 10 วัน',
    };
  }
  return {
    urgencyLevel: 'warning_4_9',
    remainingLabel: `เหลือ ${daysLeft} วัน`,
  };
}

/**
 * สร้างบัญชีสรุปข้อมูลสำนวนใกล้ครบอุทธรณ์ (เหลือ <= 10 วัน) ที่ยังไม่กดเสนอเวรชี้
 */
export function extractPendingDuty10DaySummary(
  cases: AppealCase[],
  refDate: Date = new Date()
): PendingDuty10DaySummary {
  const entries: PendingDuty10DayEntry[] = [];
  const groupMap = new Map<string, PendingDutyProsecutorGroup>();

  for (const caseItem of cases) {
    if (!isCasePendingDutyWithin10Days(caseItem, refDate)) continue;

    const daysLeft = getDaysRemaining(caseItem, refDate);
    const effectiveDeadline = getEffectiveAppealDeadline(caseItem);
    const isExtended = Boolean(caseItem.extendedDeadline && caseItem.extendedDeadline.trim());
    const ownerProsecutor =
      (caseItem.responsiblePerson || caseItem.prosecutorName || '').trim() ||
      'ไม่ระบุชื่ออัยการ';
    const { urgencyLevel, remainingLabel } = getRemainingStatus(daysLeft);

    entries.push({
      caseItem,
      daysLeft,
      effectiveDeadline,
      isExtended,
      ownerProsecutor,
      pleaLabel: getPleaLabel(caseItem),
      urgencyLevel,
      remainingLabel,
    });

    const existing = groupMap.get(ownerProsecutor) || {
      prosecutorName: ownerProsecutor,
      totalCount: 0,
      exact10Count: 0,
      urgent0To9Count: 0,
      overdueCount: 0,
    };

    existing.totalCount += 1;
    if (daysLeft === 10) existing.exact10Count += 1;
    else if (daysLeft >= 0 && daysLeft <= 9) existing.urgent0To9Count += 1;
    else if (daysLeft < 0) existing.overdueCount += 1;

    groupMap.set(ownerProsecutor, existing);
  }

  // เรียงตามวันที่เหลือ (น้อยที่สุด/ใกล้ครบที่สุดขึ้นก่อน) แล้วตามด้วยเลขคดีดำ
  entries.sort((a, b) => {
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    return a.caseItem.blackCaseNo.localeCompare(b.caseItem.blackCaseNo, 'th');
  });

  const prosecutorGroups = Array.from(groupMap.values()).sort((a, b) => {
    if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
    return a.prosecutorName.localeCompare(b.prosecutorName, 'th');
  });

  return {
    entries,
    totalCount: entries.length,
    exact10Count: entries.filter((e) => e.daysLeft === 10).length,
    days0To10Count: entries.filter((e) => e.daysLeft >= 0 && e.daysLeft <= 10).length,
    days0To9Count: entries.filter((e) => e.daysLeft >= 0 && e.daysLeft <= 9).length,
    overdueCount: entries.filter((e) => e.daysLeft < 0).length,
    prosecutorGroups,
  };
}

/**
 * สร้างข้อความ TSV สำหรับคัดลอกลง Excel
 */
export function formatPendingDuty10DayTsv(
  entries: PendingDuty10DayEntry[],
  subtitle: string
): string {
  const headerLines = [
    `บัญชีสรุปข้อมูลสำนวนใกล้ครบอุทธรณ์ (เหลือ <= 10 วัน) ที่ยังไม่กดเสนอเวรชี้`,
    `เงื่อนไข: ${subtitle} | จำนวนทั้งหมด ${entries.length} สำนวน`,
    '',
    [
      'ลำดับ',
      'เลขคดีดำ',
      'เลขคดีแดง',
      'เลข ส.1',
      'เลข ส.4',
      'จำเลย',
      'อัยการเจ้าของสำนวน',
      'คำให้การ',
      'วันอ่านคำพิพากษา',
      'วันครบกำหนดอุทธรณ์',
      'ระยะเวลาคงเหลือ',
      'สถานะเสนอเวรชี้',
      'ผลคำพิพากษาโดยย่อ',
    ].join('\t'),
  ];

  const rows = entries.map((e, idx) => {
    const c = e.caseItem;
    const outcome = (c.judgmentOutcome || c.fullJudgmentText || '-').replace(/[\t\r\n]+/g, ' ');
    return [
      String(idx + 1),
      c.blackCaseNo || '-',
      c.redCaseNo || '-',
      c.receivedNumberS1 || '-',
      c.filingNumberS4 || '-',
      c.defendant || '-',
      e.ownerProsecutor,
      e.pleaLabel,
      formatThaiDate(c.judgmentDate),
      formatThaiDate(e.effectiveDeadline),
      e.remainingLabel,
      'ยังไม่เสนอเวรชี้',
      outcome,
    ].join('\t');
  });

  return [...headerLines, ...rows].join('\n');
}

/**
 * สร้าง HTML Table สำหรับวางใน Word / Google Docs / Excel
 */
export function formatPendingDuty10DayHtml(
  entries: PendingDuty10DayEntry[],
  subtitle: string
): string {
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const rowsHtml = entries
    .map((e, idx) => {
      const c = e.caseItem;
      const outcome = escapeHtml((c.judgmentOutcome || c.fullJudgmentText || '-').replace(/[\r\n]+/g, ' '));
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><b>${escapeHtml(c.blackCaseNo || '-')}</b></td>
          <td>${escapeHtml(c.redCaseNo || '-')}</td>
          <td>${escapeHtml(c.receivedNumberS1 || '-')}</td>
          <td>${escapeHtml(c.filingNumberS4 || '-')}</td>
          <td>${escapeHtml(c.defendant || '-')}</td>
          <td>${escapeHtml(e.ownerProsecutor)}</td>
          <td>${escapeHtml(e.pleaLabel)}</td>
          <td>${escapeHtml(formatThaiDate(c.judgmentDate))}</td>
          <td><b>${escapeHtml(formatThaiDate(e.effectiveDeadline))}</b></td>
          <td><b>${escapeHtml(e.remainingLabel)}</b></td>
          <td>ยังไม่เสนอเวรชี้</td>
          <td>${outcome}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="font-family:'Sarabun',sans-serif;">
      <h3>บัญชีสรุปข้อมูลสำนวนใกล้ครบอุทธรณ์ (เหลือ &le; 10 วัน) ที่ยังไม่กดเสนอเวรชี้</h3>
      <p>เงื่อนไข: ${escapeHtml(subtitle)} | จำนวนทั้งหมด ${entries.length} สำนวน</p>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;font-weight:bold;">
            <th>ลำดับ</th>
            <th>เลขคดีดำ</th>
            <th>เลขคดีแดง</th>
            <th>เลข ส.1</th>
            <th>เลข ส.4</th>
            <th>จำเลย</th>
            <th>อัยการเจ้าของสำนวน</th>
            <th>คำให้การ</th>
            <th>วันอ่านคำพิพากษา</th>
            <th>วันครบกำหนดอุทธรณ์</th>
            <th>ระยะเวลาคงเหลือ</th>
            <th>สถานะเวรชี้</th>
            <th>ผลคำพิพากษาโดยย่อ</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * ดาวน์โหลดบัญชีสรุปเป็นไฟล์ CSV (UTF-8 BOM รองรับภาษาไทยใน Excel)
 */
export function downloadPendingDuty10DayCsv(
  entries: PendingDuty10DayEntry[],
  subtitle: string
): void {
  const escapeCsv = (val: string) => {
    const clean = (val || '').replace(/"/g, '""');
    return `"${clean}"`;
  };

  const headers = [
    'ลำดับ',
    'เลขคดีดำ',
    'เลขคดีแดง',
    'เลข ส.1',
    'เลข ส.4',
    'จำเลย',
    'ประเภทคดี',
    'อัยการเจ้าของสำนวน',
    'คำให้การ',
    'วันยื่นฟ้อง',
    'วันอ่านคำพิพากษา',
    'วันครบกำหนดอุทธรณ์',
    'ขยายเวลาแล้ว',
    'จำนวนวันที่เหลือ',
    'ระยะเวลาคงเหลือ',
    'สถานะเสนอเวรชี้',
    'ผลคำพิพากษาโดยย่อ',
  ];

  const rows = entries.map((e, idx) => {
    const c = e.caseItem;
    const outcome = (c.judgmentOutcome || c.fullJudgmentText || '-').replace(/[\r\n]+/g, ' ');
    return [
      String(idx + 1),
      c.blackCaseNo || '-',
      c.redCaseNo || '-',
      c.receivedNumberS1 || '-',
      c.filingNumberS4 || '-',
      c.defendant || '-',
      c.caseType || '-',
      e.ownerProsecutor,
      e.pleaLabel,
      formatThaiDate(c.filingDate),
      formatThaiDate(c.judgmentDate),
      formatThaiDate(e.effectiveDeadline),
      e.isExtended ? 'ขยายเวลาแล้ว' : 'ปกติ',
      String(e.daysLeft),
      e.remainingLabel,
      'ยังไม่เสนอเวรชี้',
      outcome,
    ]
      .map(escapeCsv)
      .join(',');
  });

  const csvContent =
    '\uFEFF' +
    [
      escapeCsv(`บัญชีสรุปข้อมูลสำนวนใกล้ครบอุทธรณ์ (เหลือ <= 10 วัน) ที่ยังไม่กดเสนอเวรชี้ - ${subtitle}`),
      headers.map(escapeCsv).join(','),
      ...rows,
    ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const todayStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `บัญชีสรุปอุทธรณ์_10วัน_ยังไม่เสนอเวรชี้_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
