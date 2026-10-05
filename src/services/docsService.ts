import { AppealCase, DailyFilingDocConfig } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';
import { CourtPetitionData, generateCourtPetitionText } from '../utils/petitionUtils';

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

/**
 * สร้างบันทึกข้อความราชการ ขอขยายระยะเวลาอุทธรณ์ ลงใน Google Docs
 */
export async function createAppealExtensionMemoDoc(
  accessToken: string,
  caseItem: AppealCase,
  newDeadline: string,
  extensionCount: number,
  notes?: string
): Promise<{ docId: string; docUrl: string; docTitle: string }> {
  const formattedToday = formatThaiDate(new Date().toISOString().slice(0, 10), { short: false });
  const title = `บันทึกข้อความขอขยายเวลาอุทธรณ์ (ครั้งที่ ${extensionCount}) ดำ ${caseItem.blackCaseNo} แดง ${caseItem.redCaseNo || '-'}`;

  const res = await fetch(DOCS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถสร้างเอกสาร Google Docs ได้: ${errorText}`);
  }

  const data = await res.json();
  const documentId = data.documentId;
  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  const content = [
    `บันทึกข้อความ`,
    `ส่วนราชการ: สำนักงานอัยการจังหวัดเพชรบุรี โทร. ๐ ๓๒๔๒ ๕๕๕๕`,
    `ที่: อส ๐๐๕๐ / ........................................ วันที่: ${formattedToday}`,
    `เรื่อง: ขอขยายระยะเวลาอุทธรณ์ คดีหมายเลขดำที่ ${caseItem.blackCaseNo} คดีหมายเลขแดงที่ ${caseItem.redCaseNo || '........................'}`,
    `--------------------------------------------------------------------------------`,
    `เรียน: ศาลจังหวัดเพชรบุรี (ผ่านพนักงานอัยการจังหวัดเพชรบุรี)`,
    `\n`,
    `      ด้วยคดีเรื่องนี้ พนักงานอัยการจังหวัดเพชรบุรี โจทก์ ยื่นฟ้อง ${caseItem.defendant} เป็นจำเลย`,
    `ในความผิดตาม ${caseItem.caseType || 'ประมวลกฎหมายอาญา'} ต่อ ${caseItem.court || 'ศาลจังหวัดเพชรบุรี'}`,
    `ศาลได้โปรดอ่านคำพิพากษาเมื่อวันที่ ${caseItem.judgmentDate ? formatThaiDate(caseItem.judgmentDate, { short: false }) : '................................................'}`,
    `โดยมีผลคำพิพากษาคือ: ${caseItem.judgmentOutcome || '................................................................................'}`,
    `\n`,
    `      คดีนี้จะครบกำหนดระยะเวลาอุทธรณ์ ๑ เดือน ตามกฎหมาย ในวันที่ ${caseItem.appealDeadline ? formatThaiDate(caseItem.appealDeadline, { short: false }) : '................................................'}`,
    `แต่เนื่องจาก ${notes || 'พนักงานอัยการเจ้าของสำนวนอยู่ระหว่างรวบรวมข้อเท็จจริง คัดถ่ายสำเนาคำพิพากษาและรายงานกระบวนพิจารณาเพื่อประกอบการพิจารณาทำความเห็นอุทธรณ์ ซึ่งมีข้อเท็จจริงและข้อกฎหมายที่ต้องพิจารณาโดยละเอียดรอบคอบ ยังไม่แล้วเสร็จ'}`,
    `\n`,
    `      จึงเรียนมาเพื่อโปรดพิจารณาขอประทานศาลได้โปรดอนุญาตขยายระยะเวลาอุทธรณ์ออกไปอีก เป็นครั้งที่ ${extensionCount}`,
    `นับแต่วันครบกำหนดเดิม จนถึงวันที่ ${formatThaiDate(newDeadline, { short: false })} จักเป็นพระคุณ`,
    `\n\n\n`,
    `                                    (ลงชื่อ) ..............................................................`,
    `                                          ( ${caseItem.prosecutorName || caseItem.responsiblePerson || '..............................................................'} )`,
    `                                             พนักงานอัยการเจ้าของสำนวน`,
    `\n--------------------------------------------------------------------------------\n`,
    `คำสั่งศาล: [  ] อนุญาตให้ขยายถึงวันที่ ........................................   [  ] ไม่อนุญาต`,
    `\n                                    (ลงชื่อ) .............................................................. ผู้พิพากษา`,
  ].join('\n');

  await fetch(`${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: content } }],
    }),
  });

  return { docId: documentId, docUrl, docTitle: title };
}

/**
 * สร้างบันทึกข้อความ รายงานสรุปผลการชี้คดีและผลคำพิพากษาประจำวัน เสนออัยการจังหวัด
 */
export async function createDailyDutySummaryDoc(
  accessToken: string,
  filingDate: string,
  casesInDay: AppealCase[],
  dutyOfficers: string[] = []
): Promise<{ docId: string; docUrl: string; docTitle: string }> {
  const formattedDate = formatThaiDate(filingDate, { short: false });
  const title = `รายงานผลการชี้คดีและผลคำพิพากษา ประจำวันที่ ${formattedDate}`;

  const res = await fetch(DOCS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถสร้างเอกสาร Google Docs ได้: ${errorText}`);
  }

  const data = await res.json();
  const documentId = data.documentId;
  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  const confessedCount = casesInDay.filter((c) => c.defendantPlea === 'confessed' || c.hasJudgment || Boolean(c.judgmentDate)).length;
  const deniedCount = casesInDay.filter((c) => c.defendantPlea === 'denied' || c.appointmentType === 'witness_examination' || c.appointmentType === 'pre_trial').length;
  const otherCount = casesInDay.length - confessedCount - deniedCount;

  const content = [
    `บันทึกข้อความ`,
    `ส่วนราชการ: สำนักงานอัยการจังหวัดเพชรบุรี`,
    `ที่: อส ๐๐๕๐ / ........................................ วันที่: ${formattedDate}`,
    `เรื่อง: รายงานผลการชี้คดีและคำพิพากษาคดีที่ยื่นฟ้องประจำวัน`,
    `--------------------------------------------------------------------------------`,
    `เรียน: อัยการจังหวัดเพชรบุรี`,
    `\n`,
    `      ด้วยในวันนี้ (${formattedDate}) มีคดีที่พนักงานอัยการได้ยื่นฟ้องต่อศาลจังหวัดเพชรบุรี รวมทั้งสิ้น ${casesInDay.length} สำนวน`,
    `โดยมีพนักงานอัยการเวรชี้คดี/รับผิดชอบในวันนี้ ได้แก่: ${dutyOfficers.length > 0 ? dutyOfficers.join(', ') : 'ตามที่ระบุในแต่ละสำนวน'}`,
    `\n`,
    `[ สรุปสถิติผลการดำเนินกระบวนพิจารณาในศาล ]`,
    `  ๑. จำเลยให้การรับสารภาพ / ศาลมีคำพิพากษาในวันฟ้อง: ${confessedCount} สำนวน`,
    `  ๒. จำเลยให้การปฏิเสธ / ศาลมีนัดตรวจพยานหลักฐานหรือสืบพยาน: ${deniedCount} สำนวน`,
    `  ๓. สำนวนมีนัดอื่น ๆ / อยู่ระหว่างรอผล: ${otherCount < 0 ? 0 : otherCount} สำนวน`,
    `\n--------------------------------------------------------------------------------\n`,
    `[ บัญชีรายละเอียดสำนวนคดี ]\n`,
    ...casesInDay.map((c, i) =>
      [
        `${i + 1}. คดีหมายเลขดำที่ ${c.blackCaseNo} ${c.redCaseNo ? `/ แดง ${c.redCaseNo}` : ''}`,
        `   โจทก์: ${c.plaintiff} | จำเลย: ${c.defendant}`,
        `   ผลการชี้คดี/คำพิพากษา: ${c.judgmentOutcome || (c.hasJudgment ? 'ตัดสินแล้ว' : 'จำเลยปฏิเสธ/มีนัดต่อ')}`,
        c.appealDeadline ? `   วันครบกำหนดอุทธรณ์ ๑ เดือน: ${formatThaiDate(c.extendedDeadline || c.appealDeadline)}` : '',
        `   เวรชี้/เจ้าของสำนวน: ${c.prosecutorName || c.responsiblePerson}`,
        `\n`,
      ].filter(Boolean).join('\n')
    ),
    `\n\n                                    (ลงชื่อ) ..............................................................`,
    `                                          ( ${dutyOfficers[0] || 'พนักงานอัยการเวรชี้คดี'} )`,
    `                                             พนักงานอัยการเวรชี้คดีประจำวัน`,
  ].join('\n');

  await fetch(`${DOCS_BASE}/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: content } }],
    }),
  });

  return { docId: documentId, docUrl, docTitle: title };
}

/**
 * สร้างแบบคำร้องขอขยายระยะเวลาอุทธรณ์ต่อศาล (แบบพิมพ์ศาล ๗ สำหรับพิมพ์ลงกระดาษตราครุฑ)
 * ใน Google Docs
 */
export async function createCourtPetitionDoc(
  accessToken: string,
  data: CourtPetitionData,
  forPreprintedGarudaPaper: boolean = true
): Promise<{ docId: string; docUrl: string; docTitle: string }> {
  const countStr = data.extensionCount > 1 ? `ครั้งที่ ${data.extensionCount}` : 'ครั้งที่ ๑';
  const title = `คำร้องขอขยายเวลาอุทธรณ์ (${countStr}) คดีดำ ${data.blackCaseNo} ศาลจังหวัดเพชรบุรี`;

  const res = await fetch(DOCS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถสร้างเอกสาร Google Docs ได้: ${errorText}`);
  }

  const result = await res.json();
  const documentId = result.documentId;
  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  const petitionContent = generateCourtPetitionText(data, {
    forPreprintedGarudaPaper,
  });

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
            text: petitionContent,
          },
        },
      ],
    }),
  });

  return { docId: documentId, docUrl, docTitle: title };
}
