import { MonthlyDutyRoster, DailyDutyRecord } from '../types/appeal';

/**
 * แปลงไฟล์ (File) เป็น Base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * เรียก API วิเคราะห์ตารางเวรชี้จากไฟล์ภาพหรือ PDF ผ่านเซิร์ฟเวอร์ Gemini Flash
 */
export async function analyzeDutyRosterFile(
  file: File,
  requestedMonth?: string
): Promise<MonthlyDutyRoster> {
  const base64Data = await fileToBase64(file);

  const response = await fetch('/api/analyze-duty-roster', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileData: base64Data,
      mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      fileName: file.name,
      requestedMonth,
    }),
  });

  if (!response.ok) {
    let errorMessage = 'เกิดข้อผิดพลาดในการวิเคราะห์ไฟล์';
    try {
      const errJson = await response.json();
      errorMessage = errJson.error || errorMessage;
    } catch {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (!data.success || !data.roster) {
    throw new Error(data.error || 'ไม่พบผลลัพธ์การวิเคราะห์');
  }

  return data.roster as MonthlyDutyRoster;
}

/**
 * ค้นหาข้อมูลเวรชี้สำหรับวันที่ที่ระบุ (รูปแบบ YYYY-MM-DD)
 */
export function findDutyForDate(
  rosters: MonthlyDutyRoster[],
  targetDate: string
): { roster: MonthlyDutyRoster; duty: DailyDutyRecord } | null {
  if (!targetDate || rosters.length === 0) return null;

  for (const roster of rosters) {
    const match = roster.duties.find((d) => d.date === targetDate);
    if (match) {
      return { roster, duty: match };
    }
  }

  return null;
}

/**
 * ดึงข้อมูลเวรชี้ประจำวัน (วันนี้)
 */
export function getTodayDuty(rosters: MonthlyDutyRoster[]): { roster: MonthlyDutyRoster; duty: DailyDutyRecord } | null {
  // วันนี้ในเวลาท้องถิ่น
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  return findDutyForDate(rosters, todayStr);
}

/**
 * ฟอร์แมตวันที่แบบไทย
 */
export function formatThaiDateLong(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * ดึงรายชื่อเวรชี้เฉพาะวันที่ระบุ
 */
export function getDutyOfficersForDate(
  rosters: MonthlyDutyRoster[],
  dateStr: string
): Array<{ name: string; role: string; courtRoom?: string; dutyType?: string; monthName: string }> {
  if (!dateStr || rosters.length === 0) return [];
  const results: Array<{ name: string; role: string; courtRoom?: string; dutyType?: string; monthName: string }> = [];

  for (const roster of rosters) {
    const dayRecord = roster.duties.find((d) => d.date === dateStr);
    if (dayRecord && dayRecord.officers) {
      dayRecord.officers.forEach((off) => {
        if (off.name && off.name.trim()) {
          results.push({
            name: off.name.trim(),
            role: off.role || 'เวรชี้',
            courtRoom: off.courtRoom,
            dutyType: dayRecord.dutyType,
            monthName: roster.monthNameThai,
          });
        }
      });
    }
  }

  return results;
}

/**
 * ดึงรายชื่อเวรชี้ทั้งหมดจากทุกรอบเดือนที่อัปโหลดไฟล์ PDF ไว้ (แยกตามเดือนและรายชื่อไม่ซ้ำ)
 */
export function getAllOfficersGroupedByMonth(
  rosters: MonthlyDutyRoster[]
): Array<{
  monthYear: string;
  monthNameThai: string;
  fileName?: string;
  officers: Array<{ name: string; role: string; dutyCount: number; dates: string[] }>;
}> {
  return rosters.map((roster) => {
    const officerMap: Record<string, { role: string; dutyCount: number; dates: string[] }> = {};

    roster.duties.forEach((d) => {
      d.officers.forEach((off) => {
        const trimmedName = off.name.trim();
        if (!trimmedName) return;
        if (!officerMap[trimmedName]) {
          officerMap[trimmedName] = {
            role: off.role || 'เวรชี้',
            dutyCount: 0,
            dates: [],
          };
        }
        officerMap[trimmedName].dutyCount += 1;
        if (d.date && !officerMap[trimmedName].dates.includes(d.date)) {
          officerMap[trimmedName].dates.push(d.date);
        }
      });
    });

    const officers = Object.keys(officerMap)
      .sort((a, b) => officerMap[b].dutyCount - officerMap[a].dutyCount)
      .map((name) => ({
        name,
        role: officerMap[name].role,
        dutyCount: officerMap[name].dutyCount,
        dates: officerMap[name].dates,
      }));

    return {
      monthYear: roster.monthYear,
      monthNameThai: roster.monthNameThai,
      fileName: roster.uploadedFileName,
      officers,
    };
  });
}
