import { AppealCase } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * เพิ่มกำหนดเวลาอุทธรณ์ 1 เดือนลงใน Google Calendar ของผู้ใช้
 */
export async function createAppealCalendarEvent(
  accessToken: string,
  caseItem: AppealCase
): Promise<string> {
  const deadline = caseItem.extendedDeadline || caseItem.appealDeadline;
  const summary = `🚨 ครบกำหนดอุทธรณ์ (1 เดือน): คดีดำ ${caseItem.blackCaseNo} / แดง ${caseItem.redCaseNo}`;
  const description = [
    `ศาล: ${caseItem.court}`,
    `โจทก์: ${caseItem.plaintiff}`,
    `จำเลย: ${caseItem.defendant}`,
    `ประเภทคดี: ${caseItem.caseType}`,
    `วันที่พิพากษา: ${formatThaiDate(caseItem.judgmentDate)}`,
    `วันครบกำหนดอุทธรณ์ 1 เดือน: ${formatThaiDate(caseItem.appealDeadline)}`,
    caseItem.extendedDeadline ? `ขอขยายเวลาถึง: ${formatThaiDate(caseItem.extendedDeadline)} (ครั้งที่ ${caseItem.extensionCount || 1})` : '',
    caseItem.judgmentOutcome ? `ผลคำพิพากษา: ${caseItem.judgmentOutcome}` : '',
    `ผู้รับผิดชอบ: ${caseItem.responsiblePerson}`,
    `คำเตือน: ต้องยื่นอุทธรณ์หรือยื่นคำร้องขอขยายระยะเวลาอุทธรณ์ก่อนสิ้นสุดวันนี้เพื่อมิให้อายุความอุทธรณ์ขาด`,
  ].filter(Boolean).join('\n');

  const eventPayload = {
    summary: summary,
    description: description,
    start: {
      date: deadline, // All-day event
    },
    end: {
      date: deadline,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 7 * 24 * 60 }, // 7 วันล่วงหน้า
        { method: 'popup', minutes: 3 * 24 * 60 }, // 3 วันล่วงหน้า
        { method: 'popup', minutes: 1 * 24 * 60 }, // 1 วันล่วงหน้า
        { method: 'popup', minutes: 9 * 60 },      // เช้าวันครบกำหนด
      ],
    },
  };

  const res = await fetch(CALENDAR_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถเพิ่มการแจ้งเตือนลงใน Google Calendar ได้: ${errorText}`);
  }

  const data = await res.json();
  return data.id;
}

/**
 * ลบการแจ้งเตือนใน Calendar
 */
export async function removeAppealCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(`${CALENDAR_BASE}/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error('ไม่สามารถลบรายการแจ้งเตือนใน Google Calendar ได้');
  }
}
