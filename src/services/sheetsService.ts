import { AppealCase, DailyJudgmentFollowUp, CaseCompletionReason, FollowUpStatus } from '../types/appeal';
import { DAILY_EXPORT_HEADERS, getDailyExportRows } from '../utils/dailyExportUtils';
import { formatThaiDate } from '../utils/dateUtils';

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

/**
 * นำออกข้อมูลคดีที่ฟ้องในแต่ละวัน เชื่อมไปยัง Google Sheet 
 * 6 คอลัมน์ตามลำดับที่ผู้ใช้กำหนด:
 * 1. ข้อมูล ส.1 และ ส.4
 * 2. เลขคดีดำ
 * 3. เลขคดีแดง
 * 4. ชื่ออัยการเจ้าของสำนวน
 * 5. ชื่อผู้ต้องหา
 * 6. การดำเนินการ (สำนวนรับสารภาพ / สำนวนมีนัดต่อ)
 */
export async function exportDailyFilingCasesToGoogleSheet(
  accessToken: string,
  filingDate: string,
  cases: AppealCase[],
  options?: {
    spreadsheetId?: string;
    conciseProcedure?: boolean;
    customTitle?: string;
  }
): Promise<{ id: string; url: string; title: string; sheetName: string; isNewSpreadsheet: boolean }> {
  const rows = getDailyExportRows(cases, options?.conciseProcedure || false);
  const sheetTabName = `ฟ้อง_${filingDate}`;

  // 1. กรณีต้องการเพิ่มเป็นแท็บใหม่ใน Google Sheet ที่มีอยู่เดิม
  if (options?.spreadsheetId) {
    const spreadsheetId = options.spreadsheetId;
    try {
      // พยายามสร้างแท็บชีทใหม่
      await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTabName,
                  gridProperties: {
                    rowCount: Math.max(rows.length + 15, 30),
                    columnCount: 10,
                    frozenRowCount: 1,
                  },
                },
              },
            },
          ],
        }),
      });
    } catch {
      // หากมีชีทชื่อนี้อยู่แล้ว ให้เขียนต่อหรือทับ
    }

    // เขียน Header + ข้อมูล 7 คอลัมน์ (พร้อมหัวเรื่องวันที่ฟ้อง)
    const titleRow = [`วันที่ฟ้อง: ${formatThaiDate(filingDate)}`];
    const allValues = [titleRow, [...DAILY_EXPORT_HEADERS], ...rows];
    const writeRes = await fetch(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(`'${sheetTabName}'!A1`)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: allValues,
        }),
      }
    );

    if (!writeRes.ok) {
      const errText = await writeRes.text();
      throw new Error(`ไม่สามารถบันทึกข้อมูลลงใน Sheet ได้: ${errText}`);
    }

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return {
      id: spreadsheetId,
      url: sheetUrl,
      title: options.customTitle || `คดีฟ้องประจำวันที่ ${filingDate}`,
      sheetName: sheetTabName,
      isNewSpreadsheet: false,
    };
  }

  // 2. กรณีสร้างไฟล์ Google Spreadsheet ใหม่ใน Google Drive ของผู้ใช้
  const defaultTitle = options?.customTitle || `บัญชีคดีฟ้องประจำวันที่_${filingDate} (${cases.length} คดี)`;
  const createPayload = {
    properties: {
      title: defaultTitle,
    },
    sheets: [
      {
        properties: {
          title: sheetTabName,
          gridProperties: {
            rowCount: Math.max(rows.length + 15, 35),
            columnCount: 10,
            frozenRowCount: 2,
          },
        },
      },
    ],
  };

  const createRes = await fetch(SHEETS_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`ไม่สามารถสร้าง Google Sheet ได้: ${errorText}`);
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = createdData.spreadsheetUrl;

  // บันทึกหัวเรื่องวันที่ฟ้อง + Header 7 คอลัมน์ และแถวข้อมูล
  const titleRow = [`วันที่ฟ้อง: ${formatThaiDate(filingDate)}`];
  const allValues = [titleRow, [...DAILY_EXPORT_HEADERS], ...rows];
  const writeRes = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(`'${sheetTabName}'!A1`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: allValues,
      }),
    }
  );

  if (!writeRes.ok) {
    const errText = await writeRes.text();
    throw new Error(`สร้างไฟล์แล้ว แต่ไม่สามารถเขียนข้อมูลได้: ${errText}`);
  }

  // ตกแต่งหัวตาราง (แถวที่ 1: วันที่ฟ้อง, แถวที่ 2: 7 คอลัมน์สีเขียวมรกต, จัดความกว้างคอลัมน์)
  try {
    await fetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          // 1. ผสานเซลล์แถวที่ 1 สำหรับหัวเรื่อง "วันที่ฟ้องในแต่ละวัน" (A1:G1)
          {
            mergeCells: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 7,
              },
              mergeType: 'MERGE_ALL',
            },
          },
          // จัดสีและตัวหนาแถวที่ 1 (Title Header: วันที่ฟ้อง)
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 7,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.05, green: 0.35, blue: 0.18 }, // Deep Emerald 800
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 13 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          // 2. จัดสีและตัวหนาแถวที่ 2 (Header 7 คอลัมน์)
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 1,
                endRowIndex: 2,
                startColumnIndex: 0,
                endColumnIndex: 7,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.09, green: 0.48, blue: 0.24 }, // Emerald 700
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          // 3. ปรับความกว้าง 7 คอลัมน์
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 180 }, // 1. ส.1 และ ส.4
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
              properties: { pixelSize: 130 }, // 2. เลขคดีดำ
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
              properties: { pixelSize: 130 }, // 3. เลขคดีแดง
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
              properties: { pixelSize: 220 }, // 4. ชื่ออัยการเจ้าของสำนวน
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },
              properties: { pixelSize: 200 }, // 5. ชื่อผู้ต้องหา
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 },
              properties: { pixelSize: 240 }, // 6. การดำเนินการ
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 },
              properties: { pixelSize: 230 }, // 7. วันที่เสร็จสิ้นสำนวน
              fields: 'pixelSize',
            },
          },
        ],
      }),
    });
  } catch (formatErr) {
    console.warn('Formatting spreadsheet headers encountered a non-fatal error:', formatErr);
  }

  return {
    id: spreadsheetId,
    url: spreadsheetUrl,
    title: defaultTitle,
    sheetName: sheetTabName,
    isNewSpreadsheet: true,
  };
}
