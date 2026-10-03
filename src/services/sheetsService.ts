import { AppealCase, DailyJudgmentFollowUp, CaseCompletionReason, FollowUpStatus } from '../types/appeal';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

export const SHEET_NAME_APPEAL = 'คุมระยะเวลาอุทธรณ์';
export const SHEET_NAME_DAILY_JUDGMENT = 'ติดตามคำพิพากษารายวัน';

export const APPEAL_HEADERS = [
  'ลำดับ',
  'วันที่ฟ้อง',
  'เลขคดีดำ',
  'เลขคดีแดง',
  'ศาล',
  'โจทก์',
  'จำเลย',
  'ประเภทคดี',
  'วันที่พิพากษา',
  'ผลคำพิพากษาโดยย่อ',
  'วันครบกำหนดอุทธรณ์ 1 เดือน',
  'วันขยายเวลาอุทธรณ์',
  'จำนวนครั้งที่ขยาย',
  'สถานะการดำเนินการ',
  'วันที่เสร็จสิ้น',
  'ผลการเสร็จสิ้น',
  'ผู้รับผิดชอบ',
  'หมายเหตุ',
  'ID_ระบบ',
  'เลขรับ ส.1',
  'เลขฟ้อง ส.4',
];

export const FOLLOW_UP_HEADERS = [
  'ลำดับ',
  'วันที่ต้องตามคำพิพากษา',
  'เลขคดีดำ/แดง',
  'ศาล',
  'โจทก์',
  'จำเลย',
  'เวลานัดฟังคำพิพากษา',
  'สถานะ',
  'สรุปผลคำพิพากษา/ผลการติดตาม',
  'ส่งต่อคุมอุทธรณ์แล้ว',
  'ผู้รับผิดชอบ',
  'หมายเหตุ',
  'ID_ระบบ',
];

/**
 * สร้าง Google Spreadsheet ใหม่พร้อมเทมเพลต 2 แผ่นงาน
 */
export async function createTrackerSpreadsheet(accessToken: string, title?: string): Promise<{ id: string; url: string; title: string }> {
  const finalTitle = title || `ระบบคุมระยะเวลาอุทธรณ์และติดตามคำพิพากษา_${new Date().toISOString().slice(0, 10)}`;
  
  const payload = {
    properties: {
      title: finalTitle,
    },
    sheets: [
      {
        properties: {
          title: SHEET_NAME_APPEAL,
          gridProperties: { rowCount: 100, columnCount: APPEAL_HEADERS.length + 2 },
        },
      },
      {
        properties: {
          title: SHEET_NAME_DAILY_JUDGMENT,
          gridProperties: { rowCount: 100, columnCount: FOLLOW_UP_HEADERS.length + 2 },
        },
      },
    ],
  };

  const res = await fetch(SHEETS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถสร้าง Google Sheet ได้: ${errorText}`);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl;

  // เขียน Header ลงทั้งสอง Sheet พร้อมแต่งสีหัวตาราง
  await updateHeadersAndStyles(accessToken, spreadsheetId);

  return { id: spreadsheetId, url: spreadsheetUrl, title: finalTitle };
}

/**
 * เพิ่มส่วนหัวตารางและจัดฟอร์แมต
 */
async function updateHeadersAndStyles(accessToken: string, spreadsheetId: string) {
  // บันทึก headers
  const headerData = [
    {
      range: `'${SHEET_NAME_APPEAL}'!A1:U1`,
      values: [APPEAL_HEADERS],
    },
    {
      range: `'${SHEET_NAME_DAILY_JUDGMENT}'!A1:M1`,
      values: [FOLLOW_UP_HEADERS],
    },
  ];

  await fetch(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: headerData,
    }),
  });
}

/**
 * ค้นหาไฟล์ Google Sheets ของผู้ใช้ใน Google Drive
 */
export async function searchUserSheets(accessToken: string): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const res = await fetch(`${DRIVE_BASE}/files?q=${q}&orderBy=modifiedTime desc&pageSize=15&fields=files(id,name,modifiedTime)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error('ไม่สามารถค้นหา Google Sheets ในบัญชีของคุณได้');
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * ดึงข้อมูลสำนวนคดีจาก Google Sheet
 */
export async function fetchAppealCases(accessToken: string, spreadsheetId: string): Promise<AppealCase[]> {
  const range = `'${SHEET_NAME_APPEAL}'!A2:S`;
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    // หากไม่พบชีทนี้อาจเป็นไฟล์ใหม่
    return [];
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

  return rows.map((row, index) => {
    const isCompleted = (row[13] || '').trim() === 'เสร็จสิ้นแล้ว';
    const completionReason = parseCompletionReason(row[15]);
    const rawJudgmentDate = (row[8] || '').trim();
    const hasJudgment = Boolean(rawJudgmentDate);

    return {
      id: row[18] || `case_${Date.now()}_${index}`,
      filingDate: row[1] || '',
      blackCaseNo: row[2] || '',
      redCaseNo: row[3] || undefined,
      receivedNumberS1: row[19] || undefined,
      filingNumberS4: row[20] || undefined,
      court: row[4] || '',
      plaintiff: row[5] || '',
      defendant: row[6] || '',
      caseType: row[7] || 'คดีทั่วไป',
      hasJudgment: hasJudgment,
      defendantPlea: hasJudgment ? undefined : 'denied',
      judgmentDate: rawJudgmentDate || undefined,
      judgmentOutcome: row[9] || '',
      appealDeadline: (row[10] || '').trim() || undefined,
      extendedDeadline: row[11] || undefined,
      extensionCount: row[12] ? parseInt(row[12], 10) : undefined,
      isCompleted: isCompleted,
      completedDate: row[14] || undefined,
      completionReason: completionReason,
      responsiblePerson: row[16] || '',
      notes: row[17] || '',
      sheetRowIndex: index + 2, // 1-based index (Header is row 1)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * ดึงข้อมูลรายการติดตามคำพิพากษารายวัน
 */
export async function fetchDailyFollowUps(accessToken: string, spreadsheetId: string): Promise<DailyJudgmentFollowUp[]> {
  const range = `'${SHEET_NAME_DAILY_JUDGMENT}'!A2:M`;
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const rows: any[][] = data.values || [];

  return rows.map((row, index) => {
    let status: FollowUpStatus = 'pending';
    const rawStatus = (row[7] || '').trim();
    if (rawStatus.includes('อ่านคำพิพากษาแล้ว')) status = 'delivered';
    else if (rawStatus.includes('เลื่อน')) status = 'postponed';
    else if (rawStatus.includes('เสร็จสิ้น')) status = 'completed';

    return {
      id: row[12] || `followup_${Date.now()}_${index}`,
      followUpDate: row[1] || '',
      caseNumber: row[2] || '',
      court: row[3] || '',
      plaintiff: row[4] || '',
      defendant: row[5] || '',
      hearingTime: row[6] || '',
      status: status,
      judgmentSummary: row[8] || '',
      transferredToAppealTracker: (row[9] || '').trim() === 'ใช่',
      responsiblePerson: row[10] || '',
      notes: row[11] || '',
      sheetRowIndex: index + 2,
      createdAt: new Date().toISOString(),
    };
  });
}

/**
 * เพิ่มแถวสำนวนคดีใหม่ลง Google Sheet
 */
export async function appendAppealCase(
  accessToken: string,
  spreadsheetId: string,
  caseItem: AppealCase,
  caseNumberIndex: number
): Promise<number> {
  const range = `'${SHEET_NAME_APPEAL}'!A:U`;
  const rowValues = [
    caseNumberIndex,
    caseItem.filingDate,
    caseItem.blackCaseNo,
    caseItem.redCaseNo || '',
    caseItem.court,
    caseItem.plaintiff,
    caseItem.defendant,
    caseItem.caseType,
    caseItem.judgmentDate || '',
    caseItem.judgmentOutcome || '',
    caseItem.appealDeadline || '',
    caseItem.extendedDeadline || '',
    caseItem.extensionCount ? caseItem.extensionCount.toString() : '',
    caseItem.isCompleted ? 'เสร็จสิ้นแล้ว' : 'ยังไม่เสร็จสิ้น',
    caseItem.completedDate || '',
    formatCompletionReason(caseItem.completionReason),
    caseItem.responsiblePerson,
    caseItem.notes || '',
    caseItem.id,
    caseItem.receivedNumberS1 || '',
    caseItem.filingNumberS4 || '',
  ];

  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถบันทึกสำนวนลง Google Sheets ได้: ${errorText}`);
  }

  const data = await res.json();
  const updatedRange = data.updates?.updatedRange || '';
  const match = updatedRange.match(/A(\d+):/);
  return match ? parseInt(match[1], 10) : 2;
}

/**
 * อัปเดตสำนวนคดีเดิมใน Google Sheet (เช่น เมื่อกดเสร็จสิ้น หรือขยายเวลา)
 */
export async function updateAppealCaseInSheet(
  accessToken: string,
  spreadsheetId: string,
  caseItem: AppealCase
): Promise<void> {
  if (!caseItem.sheetRowIndex) {
    throw new Error('ไม่พบตำแหน่งแถวใน Google Sheet ของสำนวนนี้');
  }

  const rowNum = caseItem.sheetRowIndex;
  const range = `'${SHEET_NAME_APPEAL}'!A${rowNum}:U${rowNum}`;

  const rowValues = [
    rowNum - 1, // ลำดับ
    caseItem.filingDate,
    caseItem.blackCaseNo,
    caseItem.redCaseNo || '',
    caseItem.court,
    caseItem.plaintiff,
    caseItem.defendant,
    caseItem.caseType,
    caseItem.judgmentDate || '',
    caseItem.judgmentOutcome || '',
    caseItem.appealDeadline || '',
    caseItem.extendedDeadline || '',
    caseItem.extensionCount ? caseItem.extensionCount.toString() : '',
    caseItem.isCompleted ? 'เสร็จสิ้นแล้ว' : 'ยังไม่เสร็จสิ้น',
    caseItem.completedDate || '',
    formatCompletionReason(caseItem.completionReason),
    caseItem.responsiblePerson,
    caseItem.notes || '',
    caseItem.id,
    caseItem.receivedNumberS1 || '',
    caseItem.filingNumberS4 || '',
  ];

  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถอัปเดตข้อมูลใน Google Sheets: ${errorText}`);
  }
}

/**
 * บันทึกรายการติดตามคำพิพากษารายวันลงใน Google Sheet
 */
export async function appendFollowUpToSheet(
  accessToken: string,
  spreadsheetId: string,
  item: DailyJudgmentFollowUp,
  indexNum: number
): Promise<number> {
  const range = `'${SHEET_NAME_DAILY_JUDGMENT}'!A:M`;
  const statusThai = item.status === 'delivered' ? 'ศาลอ่านคำพิพากษาแล้ว'
    : item.status === 'postponed' ? 'เลื่อนนัดอ่านคำพิพากษา'
    : item.status === 'completed' ? 'ดำเนินการเสร็จสิ้น'
    : 'รอฟังคำพิพากษา';

  const rowValues = [
    indexNum,
    item.followUpDate,
    item.caseNumber,
    item.court,
    item.plaintiff,
    item.defendant,
    item.hearingTime || '',
    statusThai,
    item.judgmentSummary || '',
    item.transferredToAppealTracker ? 'ใช่' : 'ยัง',
    item.responsiblePerson,
    item.notes || '',
    item.id,
  ];

  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถบันทึกรายการติดตามคำพิพากษาได้: ${errorText}`);
  }

  const data = await res.json();
  const updatedRange = data.updates?.updatedRange || '';
  const match = updatedRange.match(/A(\d+):/);
  return match ? parseInt(match[1], 10) : 2;
}

/**
 * อัปเดตรายการติดตามคำพิพากษาเดิมใน Sheet
 */
export async function updateFollowUpInSheet(
  accessToken: string,
  spreadsheetId: string,
  item: DailyJudgmentFollowUp
): Promise<void> {
  if (!item.sheetRowIndex) return;

  const rowNum = item.sheetRowIndex;
  const range = `'${SHEET_NAME_DAILY_JUDGMENT}'!A${rowNum}:M${rowNum}`;

  const statusThai = item.status === 'delivered' ? 'ศาลอ่านคำพิพากษาแล้ว'
    : item.status === 'postponed' ? 'เลื่อนนัดอ่านคำพิพากษา'
    : item.status === 'completed' ? 'ดำเนินการเสร็จสิ้น'
    : 'รอฟังคำพิพากษา';

  const rowValues = [
    rowNum - 1,
    item.followUpDate,
    item.caseNumber,
    item.court,
    item.plaintiff,
    item.defendant,
    item.hearingTime || '',
    statusThai,
    item.judgmentSummary || '',
    item.transferredToAppealTracker ? 'ใช่' : 'ยัง',
    item.responsiblePerson,
    item.notes || '',
    item.id,
  ];

  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถอัปเดตรายการติดตามใน Sheet: ${errorText}`);
  }
}

function parseCompletionReason(text?: string): CaseCompletionReason | undefined {
  if (!text) return undefined;
  if (text.includes('ยื่นอุทธรณ์')) return 'appealed';
  if (text.includes('ไม่อุทธรณ์') || text.includes('ยุติ')) return 'no_appeal';
  if (text.includes('ที่สุด')) return 'finalized';
  if (text.includes('ยอมความ')) return 'settled';
  return 'other';
}

function formatCompletionReason(reason?: CaseCompletionReason): string {
  switch (reason) {
    case 'appealed': return 'ยื่นอุทธรณ์แล้ว';
    case 'no_appeal': return 'มีคำสั่งไม่อุทธรณ์ / ยุติ';
    case 'finalized': return 'คดีถึงที่สุด';
    case 'settled': return 'ยอมความ/ประนีประนอม';
    case 'other': return 'อื่นๆ';
    default: return '';
  }
}
