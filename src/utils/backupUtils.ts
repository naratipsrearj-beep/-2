import { AppealCase, DailyJudgmentFollowUp, MonthlyDutyRoster } from '../types/appeal';
import { formatThaiDate } from './dateUtils';

export interface ApplicationBackupData {
  metadata: {
    systemName: string;
    version: string;
    exportedAt: string;
    exportedAtThai: string;
    exportedBy?: string;
    description: string;
    counts: {
      cases: number;
      dutyRosters: number;
      followUps: number;
    };
  };
  cases: AppealCase[];
  dutyRosters: MonthlyDutyRoster[];
  followUps: DailyJudgmentFollowUp[];
}

export interface BackupDownloadResult {
  success: boolean;
  filename: string;
  fileSizeBytes: number;
  counts: {
    cases: number;
    dutyRosters: number;
    followUps: number;
  };
}

/**
 * สร้างและดาวน์โหลดไฟล์สำรองข้อมูลของแอปพลิเคชันทั้งหมด (สำนวนคดี, ตารางเวรชี้, รายการติดตาม)
 * ในรูปแบบ JSON สำหรับการจัดเก็บข้อมูลแบบออฟไลน์ (Offline Archival)
 */
export function downloadApplicationJsonBackup(params: {
  cases: AppealCase[];
  dutyRosters: MonthlyDutyRoster[];
  followUps: DailyJudgmentFollowUp[];
  userEmail?: string;
}): BackupDownloadResult {
  const { cases, dutyRosters, followUps, userEmail } = params;

  const now = new Date();
  const isoString = now.toISOString();

  // สร้างชื่อไฟล์ตามวันและเวลา เช่น appeal_tracker_backup_2026-10-19_1305.json
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const filename = `appeal_tracker_backup_${year}-${month}-${day}_${hours}${minutes}.json`;

  const dateStr = `${year}-${month}-${day}`;
  const thaiDateFormatted = formatThaiDate(dateStr, { short: false });
  const exportedAtThai = `${thaiDateFormatted} เวลา ${hours}:${minutes} น.`;

  const backupData: ApplicationBackupData = {
    metadata: {
      systemName: 'ระบบคุมระยะเวลาอุทธรณ์ 1 เดือน (Appeal Period Tracker)',
      version: '1.0.0',
      exportedAt: isoString,
      exportedAtThai,
      exportedBy: userEmail || 'Admin',
      description:
        'ไฟล์สำรองข้อมูลระบบทั้งหมด (สำนวนคดี, ตารางเวรชี้อัยการประจำเดือน, และรายการติดตามคำพิพากษารายวัน) สำหรับการจัดเก็บออฟไลน์',
      counts: {
        cases: cases.length,
        dutyRosters: dutyRosters.length,
        followUps: followUps.length,
      },
    },
    cases,
    dutyRosters,
    followUps,
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const fileSizeBytes = blob.size;

  // Trigger download via temporary anchor
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return {
    success: true,
    filename,
    fileSizeBytes,
    counts: {
      cases: cases.length,
      dutyRosters: dutyRosters.length,
      followUps: followUps.length,
    },
  };
}
