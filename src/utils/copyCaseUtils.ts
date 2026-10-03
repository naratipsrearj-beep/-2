import { AppealCase } from '../types/appeal';
import { formatThaiDate } from './dateUtils';

/**
 * Format judgment details for quick copying into office legal systems
 */
export function formatJudgmentForClipboard(c: AppealCase): string {
  const lines: string[] = [];
  lines.push('【ข้อมูลคำพิพากษา】');
  lines.push(`คดีหมายเลขดำที่: ${c.blackCaseNo}`);
  if (c.redCaseNo) {
    lines.push(`คดีหมายเลขแดงที่: ${c.redCaseNo}`);
  }
  lines.push(`ศาล: ${c.court}`);
  lines.push(`โจทก์: ${c.plaintiff}`);
  lines.push(`จำเลย: ${c.defendant}`);

  if (c.prosecutorName) {
    lines.push(`พนักงานอัยการ/เวรชี้: ${c.prosecutorName}`);
  }

  if (c.judgmentDate) {
    lines.push(`วันที่ศาลมีคำพิพากษา: ${formatThaiDate(c.judgmentDate)}`);
  } else {
    lines.push('วันที่ศาลมีคำพิพากษา: (ยังไม่มีคำพิพากษา)');
  }

  lines.push(`ผลคำพิพากษา: ${c.judgmentOutcome || 'ยังไม่ได้ระบุ'}`);

  if (c.fullJudgmentText && c.fullJudgmentText.trim()) {
    lines.push('\n--- สรุป/เนื้อหาคำพิพากษา ---');
    lines.push(c.fullJudgmentText.trim());
    lines.push('-----------------------------');
  }

  const deadline = c.extendedDeadline || c.appealDeadline;
  if (deadline) {
    lines.push(
      `ครบกำหนดระยะเวลาอุทธรณ์ 1 เดือน: ${formatThaiDate(deadline)}${
        c.extensionCount ? ` (ขอขยายเวลาครั้งที่ ${c.extensionCount})` : ''
      }`
    );
  }

  if (c.isCompleted) {
    lines.push(`สถานะ: เสร็จสิ้น (${c.completionReason || 'ยื่นอุทธรณ์แล้ว'}) เมื่อ ${c.completedDate ? formatThaiDate(c.completedDate) : '-'}`);
  }

  return lines.join('\n');
}

/**
 * Format full case summary for copying into office memos, line chats, or external systems
 */
export function formatCaseSummaryForClipboard(c: AppealCase): string {
  const lines: string[] = [];
  lines.push('【สรุปรายละเอียดสำนวนคดีและการคุมอุทธรณ์】');
  lines.push(`คดีหมายเลขดำที่: ${c.blackCaseNo}`);
  if (c.redCaseNo) {
    lines.push(`คดีหมายเลขแดงที่: ${c.redCaseNo}`);
  }
  if (c.receivedNumberS1) {
    lines.push(`เลขรับ ส.1: ${c.receivedNumberS1}`);
  }
  if (c.filingNumberS4) {
    lines.push(`เลขฟ้อง ส.4: ${c.filingNumberS4}`);
  }

  lines.push(`วันที่ยื่นฟ้อง: ${formatThaiDate(c.filingDate)}`);
  lines.push(`ศาล: ${c.court}`);
  lines.push(`ประเภทคดี: ${c.caseType}`);
  lines.push(`โจทก์: ${c.plaintiff}`);
  lines.push(`จำเลย: ${c.defendant}`);

  if (c.prosecutorName) {
    lines.push(`พนักงานอัยการ/เวรชี้: ${c.prosecutorName}`);
  }
  lines.push(`ผู้รับผิดชอบ: ${c.responsiblePerson}`);

  if (c.judgmentDate) {
    lines.push(`วันที่พิพากษา: ${formatThaiDate(c.judgmentDate)}`);
    lines.push(`ผลคำพิพากษา: ${c.judgmentOutcome || '-'}`);
  } else {
    lines.push('สถานะคำพิพากษา: ยังไม่มีคำพิพากษา (อยู่ระหว่างพิจารณา)');
  }

  if (c.fullJudgmentText && c.fullJudgmentText.trim()) {
    lines.push(`ย่อคำพิพากษา: ${c.fullJudgmentText.trim()}`);
  }

  const deadline = c.extendedDeadline || c.appealDeadline;
  if (deadline) {
    lines.push(
      `ครบกำหนดอุทธรณ์ 1 เดือน: ${formatThaiDate(deadline)}${
        c.extensionCount ? ` (ขยายครั้งที่ ${c.extensionCount})` : ''
      }`
    );
  }

  lines.push(
    `สถานะสำนวน: ${
      c.isCompleted
        ? `เสร็จสิ้น (${c.completionReason || 'ยื่นอุทธรณ์แล้ว'})`
        : 'อยู่ระหว่างติดตามคุมระยะเวลาอุทธรณ์'
    }`
  );

  if (c.notes) {
    lines.push(`หมายเหตุ: ${c.notes}`);
  }

  return lines.join('\n');
}

/**
 * Format single-line concise case for quick chat pasting
 */
export function formatCompactCaseForClipboard(c: AppealCase): string {
  const parts = [
    `ดำ ${c.blackCaseNo}`,
    c.redCaseNo ? `แดง ${c.redCaseNo}` : null,
    `ศาล${c.court}`,
    `จำเลย: ${c.defendant}`,
    c.judgmentOutcome ? `ผล: ${c.judgmentOutcome}` : null,
    c.appealDeadline || c.extendedDeadline
      ? `ครบอุทธรณ์: ${formatThaiDate(c.extendedDeadline || c.appealDeadline)}`
      : null,
  ].filter(Boolean);

  return parts.join(' | ');
}

/**
 * Universal copy helper with fallback for iframe/cross-origin security
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn('navigator.clipboard failed, using fallback', e);
  }

  // Fallback for document.execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Fallback copy failed', err);
    return false;
  }
}
