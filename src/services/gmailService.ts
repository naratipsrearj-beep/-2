import { AppealCase } from '../types/appeal';
import { formatThaiDate, getDaysRemaining } from '../utils/dateUtils';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/**
 * แปลงสตริง UTF-8 เป็น Base64URL
 */
function toBase64Url(str: string): string {
  // Use TextEncoder to handle Thai UTF-8 characters safely
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * สร้าง MIME message ในรูปแบบ RFC 2822
 */
function createEmailMime(to: string, subject: string, htmlBody: string): string {
  // Encode subject in Base64 for RFC 2047
  const subjectBytes = new TextEncoder().encode(subject);
  let binarySubj = '';
  for (let i = 0; i < subjectBytes.byteLength; i++) {
    binarySubj += String.fromCharCode(subjectBytes[i]);
  }
  const encodedSubject = `=?UTF-8?B?${btoa(binarySubj)}?=`;

  const mime = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    htmlBody,
  ].join('\r\n');

  return toBase64Url(mime);
}

/**
 * ส่งอีเมลแจ้งเตือนคดีใกล้ครบกำหนดอุทธรณ์ 1 เดือนผ่าน Gmail API
 */
export async function sendAppealDeadlineAlertEmail(
  accessToken: string,
  recipientEmail: string,
  caseItem: AppealCase,
  daysLeftOverride?: number
): Promise<{ success: boolean; messageId: string }> {
  const daysLeft = daysLeftOverride !== undefined ? daysLeftOverride : getDaysRemaining(caseItem);
  const effectiveDeadline = caseItem.extendedDeadline || caseItem.appealDeadline;
  const formattedDeadline = formatThaiDate(effectiveDeadline, { short: false });

  let urgencyTitle = '';
  let badgeColor = '';
  if (daysLeft < 0) {
    urgencyTitle = `🚨 [เกินกำหนดแล้ว ${Math.abs(daysLeft)} วัน]`;
    badgeColor = '#dc2626';
  } else if (daysLeft <= 1) {
    urgencyTitle = `🚨 [ด่วนที่สุด! เหลืออีก 1 วัน]`;
    badgeColor = '#e11d48';
  } else if (daysLeft <= 3) {
    urgencyTitle = `⚡ [เตือนเร่งด่วน! เหลืออีก ${daysLeft} วัน]`;
    badgeColor = '#d97706';
  } else {
    urgencyTitle = `⏳ [แจ้งเตือน: เหลืออีก ${daysLeft} วัน]`;
    badgeColor = '#2563eb';
  }

  const subject = `${urgencyTitle} คดีดำ ${caseItem.blackCaseNo} / แดง ${caseItem.redCaseNo} ครบกำหนดอุทธรณ์ ${formattedDeadline}`;

  const htmlBody = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 24px; color: #ffffff; text-align: center; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #94a3b8; }
    .badge-bar { background: ${badgeColor}; color: #ffffff; padding: 12px 20px; font-weight: bold; text-align: center; font-size: 15px; }
    .content { padding: 24px; }
    .case-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
    .table-info { width: 100%; border-collapse: collapse; font-size: 14px; }
    .table-info td { padding: 8px 6px; vertical-align: top; }
    .table-info .label { color: #64748b; width: 38%; font-weight: 500; }
    .table-info .val { color: #0f172a; font-weight: 600; }
    .deadline-box { background: #fff1f2; border: 2px dashed #fda4af; border-radius: 10px; padding: 14px; margin: 18px 0; text-align: center; }
    .deadline-title { font-size: 13px; color: #9f1239; font-weight: bold; }
    .deadline-date { font-size: 20px; color: #be123c; font-weight: 800; margin-top: 4px; }
    .warning-note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #92400e; margin: 18px 0; line-height: 1.5; }
    .judgment-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; font-size: 13px; color: #1e3a8a; margin-top: 14px; }
    .footer { background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>⚖️ ระบบคุมระยะเวลาอุทธรณ์ 1 เดือน</h2>
      <p>แจ้งเตือนกำหนดเวลาอุทธรณ์เพื่อป้องกันการขาดอายุความ</p>
    </div>
    
    <div class="badge-bar">
      ${urgencyTitle} (ครบกำหนด: ${formattedDeadline})
    </div>

    <div class="content">
      <div class="case-card">
        <table class="table-info">
          <tr>
            <td class="label">หมายเลขคดีดำ:</td>
            <td class="val">${caseItem.blackCaseNo}</td>
          </tr>
          <tr>
            <td class="label">หมายเลขคดีแดง:</td>
            <td class="val" style="color: #be123c;">${caseItem.redCaseNo}</td>
          </tr>
          ${caseItem.prosecutorName ? `
          <tr>
            <td class="label">อัยการเจ้าของสำนวน:</td>
            <td class="val" style="color: #b45309; font-weight: bold;">⚖️ ${caseItem.prosecutorName}</td>
          </tr>
          ` : ''}
          <tr>
            <td class="label">ศาลที่พิพากษา:</td>
            <td class="val">${caseItem.court}</td>
          </tr>
          <tr>
            <td class="label">ประเภทคดี:</td>
            <td class="val">${caseItem.caseType}</td>
          </tr>
          <tr>
            <td class="label">วันที่ยื่นฟ้อง:</td>
            <td class="val">${formatThaiDate(caseItem.filingDate, { short: false })}</td>
          </tr>
          <tr>
            <td class="label">วันที่อ่านคำพิพากษา:</td>
            <td class="val">${formatThaiDate(caseItem.judgmentDate, { short: false })}</td>
          </tr>
          <tr>
            <td class="label">โจทก์:</td>
            <td class="val">${caseItem.plaintiff}</td>
          </tr>
          <tr>
            <td class="label">จำเลย:</td>
            <td class="val">${caseItem.defendant}</td>
          </tr>
          <tr>
            <td class="label">ผู้รับผิดชอบสำนวน:</td>
            <td class="val">${caseItem.responsiblePerson}</td>
          </tr>
        </table>

        ${caseItem.judgmentOutcome || caseItem.fullJudgmentText ? `
        <div class="judgment-box">
          <strong>ผลคำพิพากษา / สรุปสาระสำคัญ:</strong><br/>
          ${caseItem.fullJudgmentText || caseItem.judgmentOutcome}
        </div>
        ` : ''}
      </div>

      <div class="deadline-box">
        <div class="deadline-title">วันครบกำหนดระยะเวลาอุทธรณ์ 1 เดือน</div>
        <div class="deadline-date">${formattedDeadline}</div>
        <div style="font-size: 13px; color: ${badgeColor}; font-weight: bold; margin-top: 6px;">
          ${daysLeft < 0 ? `เกินกำหนดไปแล้ว ${Math.abs(daysLeft)} วัน` : daysLeft === 0 ? 'ครบกำหนดในวันนี้!' : `เหลือระยะเวลาอีกเพียง ${daysLeft} วันเท่านั้น!`}
        </div>
      </div>

      <div class="warning-note">
        <strong>คำเตือนตาม ป.วิ.พ. มาตรา 229 / ป.วิ.อ. มาตรา 198:</strong><br/>
        ต้องยื่นอุทธรณ์ต่อศาลชั้นต้น หรือยื่นคำร้องขอขยายระยะเวลาอุทธรณ์ก่อนสิ้นสุดวันดังกล่าว หากพ้นกำหนดนี้ คดีจะขาดอายุความอุทธรณ์และถึงที่สุดทันที
      </div>

      <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
        * หากท่านได้ดำเนินการยื่นอุทธรณ์หรือมีคำสั่งไม่อุทธรณ์เสร็จสิ้นแล้ว โปรดเข้าไปที่ระบบแล้วกด <strong>"เสร็จสิ้นสำนวน"</strong> เพื่อให้ระบบหยุดส่งการแจ้งเตือนสำหรับสำนวนนี้โดยถาวร
      </p>
    </div>

    <div class="footer">
      อีเมลนี้ถูกส่งโดยระบบอัตโนมัติคุมระยะเวลาอุทธรณ์ 1 เดือน • ป้องกันขาดอายุความคดีความ
    </div>
  </div>
</body>
</html>
  `.trim();

  const rawMime = createEmailMime(recipientEmail, subject, htmlBody);

  const res = await fetch(GMAIL_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: rawMime,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ไม่สามารถส่งอีเมลผ่าน Gmail ได้: ${errorText}`);
  }

  const data = await res.json();
  return {
    success: true,
    messageId: data.id,
  };
}

/**
 * ตรวจสอบและส่งอีเมลแจ้งเตือนอัตโนมัติสำหรับสำนวนคดีที่เหลือเวลา 3 วัน และ 1 วัน
 */
export async function checkAndSendAutomaticEmailAlerts(
  accessToken: string,
  recipientEmail: string,
  cases: AppealCase[],
  sentAlertHistory: Record<string, { lastSentDate: string; daysLeft: number }>
): Promise<{ sentCount: number; details: string[]; updatedHistory: Record<string, { lastSentDate: string; daysLeft: number }> }> {
  let sentCount = 0;
  const details: string[] = [];
  const updatedHistory = { ...sentAlertHistory };
  const todayStr = new Date().toISOString().slice(0, 10);

  // กรองเฉพาะสำนวนที่ยังไม่เสร็จสิ้น
  const activeCases = cases.filter((c) => !c.isCompleted);

  for (const c of activeCases) {
    const daysLeft = getDaysRemaining(c);

    // ตรวจสอบเงื่อนไข 3 วัน หรือ 1 วัน (หรือเกินกำหนด)
    // ส่งเมื่อ:
    // 1) เหลือเวลา 3 วัน (และยังไม่เคยส่งแจ้งเตือนของรอบ 3 วันในวันนี้)
    // 2) เหลือเวลา 1 วัน (และยังไม่เคยส่งแจ้งเตือนของรอบ 1 วันในวันนี้)
    const shouldAlert = (daysLeft === 3 || daysLeft === 1 || daysLeft === 0);

    const historyKey = `${c.id}_${daysLeft}`;
    const alreadySentToday = updatedHistory[historyKey]?.lastSentDate === todayStr;

    if (shouldAlert && !alreadySentToday) {
      try {
        await sendAppealDeadlineAlertEmail(accessToken, recipientEmail, c, daysLeft);
        sentCount++;
        details.push(`คดีดำ ${c.blackCaseNo} (เหลือ ${daysLeft} วัน)`);
        updatedHistory[historyKey] = {
          lastSentDate: todayStr,
          daysLeft: daysLeft,
        };
      } catch (err: any) {
        console.error(`Failed to send alert email for case ${c.blackCaseNo}`, err);
      }
    }
  }

  return {
    sentCount,
    details,
    updatedHistory,
  };
}
