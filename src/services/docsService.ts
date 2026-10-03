import { AppealCase, DailyFilingDocConfig } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';

const DOCS_BASE = 'https://docs.googleapis.com/v1/documents';

/**
 * สร้าง Google Docs สำหรับรวบรวมคดีที่ยื่นฟ้องในแต่ละวัน พร้อมพื้นที่บันทึกคำพิพากษา
 */
export async function createDailyFilingDoc(
  accessToken: string,
  filingDate: string,
  casesInDay: AppealCase[]
): Promise<DailyFilingDocConfig> {
  const formattedDate = formatThaiDate(filingDate, { short: false });
  const title = `บัญชีคดีฟ้องวันที่ ${formattedDate} และบันทึกคำพิพากษา (${casesInDay.length} คดี)`;

  // 1. สร้างเอกสารเปล่า
  const res = await fetch(DOCS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถสร้างเอกสาร Google Docs ได้: ${errorText}`);
  }

  const data = await res.json();
  const documentId = data.documentId;
  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  // 2. เตรียมเนื้อหาเอกสาร
  const headerContent = [
    `บัญชีสำนวนคดีที่ยื่นฟ้อง ประจำวันที่ ${formattedDate}`,
    `จำนวนคดีที่ยื่นฟ้องทั้งสิ้น: ${casesInDay.length} สำนวน`,
    `จัดทำโดย: ระบบคุมระยะเวลาอุทธรณ์ 1 เดือน นับแต่วันมีคำพิพากษา`,
    `วันที่พิมพ์/สร้างเอกสาร: ${formatThaiDate(new Date().toISOString().slice(0, 10))}`,
    `--------------------------------------------------------------------------------`,
    `\n`,
  ].join('\n');

  let casesBody = '';
  casesInDay.forEach((c, index) => {
    const effectiveDeadline = c.extendedDeadline || c.appealDeadline;
    const judgmentText = c.fullJudgmentText || c.judgmentOutcome || (c.hasJudgment ? '(ยังไม่มีการบันทึกคำพิพากษาฉบับเต็ม - สามารถกรอกเพิ่มเติมได้ในเอกสารนี้)' : '(จำเลยให้การปฏิเสธ / อยู่ระหว่างขั้นตอนนัดพิจารณาของศาล ยังไม่มีคำพิพากษา)');

    casesBody += [
      `ลำดับที่ ${index + 1}: หมายเลขคดีดำ ${c.blackCaseNo} ${c.redCaseNo ? `/ คดีแดง ${c.redCaseNo}` : '(ยังไม่มีเลขคดีแดง)'}`,
      `เลขรับ ส.1: ${c.receivedNumberS1 || '-'} | เลขฟ้อง ส.4: ${c.filingNumberS4 || '-'}`,
      `ศาล: ${c.court} | ประเภทคดี: ${c.caseType}`,
      `โจทก์: ${c.plaintiff} | จำเลย: ${c.defendant}`,
      `อัยการเจ้าของสำนวน: ${c.prosecutorName || '-'} | ผู้รับผิดชอบ: ${c.responsiblePerson}`,
      c.judgmentDate
        ? `วันที่ศาลอ่านคำพิพากษา: ${formatThaiDate(c.judgmentDate, { short: false })} | วันครบกำหนดอุทธรณ์ 1 เดือน: ${formatThaiDate(effectiveDeadline, { short: false })}`
        : `สถานะคำพิพากษา: ยังไม่มีคำพิพากษา (จำเลยให้การปฏิเสธ / สำนวนมีนัด)`,
      `สถานะสำนวน: ${c.isCompleted ? 'เสร็จสิ้นแล้ว (ไม่แจ้งเตือน)' : (c.hasJudgment ? 'อยู่ระหว่างคุมระยะเวลาอุทธรณ์ 1 เดือน' : 'อยู่ระหว่างขั้นตอนพิจารณาคดี')}`,
      `\n[ สาระสำคัญหรือผลการพิจารณา/คำพิพากษา ]`,
      `${judgmentText}`,
      `\nบันทึก/คำสั่งเพิ่มเติม: ${c.notes || '-'}`,
      `\n================================================================================\n\n`,
    ].join('\n');
  });

  const fullText = headerContent + casesBody;

  // 3. แทรกเนื้อหาลงใน Google Doc
  await fetch(`${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: fullText,
          },
        },
      ],
    }),
  });

  return {
    filingDate,
    docId: documentId,
    docTitle: title,
    docUrl: docUrl,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * สร้างหรืออัปเดต Google Doc สำหรับบันทึกคำพิพากษาของคดีเฉพาะรายสำนวน
 */
export async function createCaseJudgmentDoc(
  accessToken: string,
  caseItem: AppealCase,
  judgmentText: string
): Promise<{ docId: string; docUrl: string; docTitle: string }> {
  const title = `คำพิพากษา คดีดำ ${caseItem.blackCaseNo} แดง ${caseItem.redCaseNo} - ${caseItem.court}`;

  const res = await fetch(DOCS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถสร้างเอกสาร Google Docs ได้: ${errorText}`);
  }

  const data = await res.json();
  const documentId = data.documentId;
  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  const effectiveDeadline = caseItem.extendedDeadline || caseItem.appealDeadline;

  const content = [
    `บันทึกคำพิพากษาและคุมระยะเวลาอุทธรณ์`,
    `คดีหมายเลขดำที่: ${caseItem.blackCaseNo}`,
    `คดีหมายเลขแดงที่: ${caseItem.redCaseNo}`,
    `ศาล: ${caseItem.court}`,
    `วันที่ยื่นฟ้อง: ${formatThaiDate(caseItem.filingDate, { short: false })}`,
    `วันที่ศาลอ่านคำพิพากษา: ${formatThaiDate(caseItem.judgmentDate, { short: false })}`,
    `วันครบกำหนดระยะเวลาอุทธรณ์ 1 เดือน: ${formatThaiDate(effectiveDeadline, { short: false })}`,
    `โจทก์: ${caseItem.plaintiff}`,
    `จำเลย: ${caseItem.defendant}`,
    `ผู้รับผิดชอบ: ${caseItem.responsiblePerson}`,
    `--------------------------------------------------------------------------------`,
    `\nสาระสำคัญของคำพิพากษา (Judgment Text):\n`,
    `${judgmentText || '(ระบุคำวินิจฉัยและคำพิพากษาของศาลโดยละเอียดที่นี่)'}`,
    `\n\n--------------------------------------------------------------------------------`,
    `คำเตือน: ต้องยื่นอุทธรณ์หรือขอขยายระยะเวลาอุทธรณ์ก่อนครบกำหนด 1 เดือนข้างต้น เพื่อมิให้อายุความอุทธรณ์ขาด\n`,
  ].join('\n');

  await fetch(`${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content,
          },
        },
      ],
    }),
  });

  return {
    docId: documentId,
    docUrl: docUrl,
    docTitle: title,
  };
}
