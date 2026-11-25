import { AppealCase } from '../types/appeal';
import {
  formatThaiDate,
  getAppealUrgency,
  getDaysRemaining,
  getTodayString,
  calculateAppealDeadline,
  isKunchartCompletedPendingNoAppealAlert,
} from '../utils/dateUtils';

export type BrowserNotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export interface BrowserNotificationSettings {
  enabled: boolean;
  notify3Days: boolean;
  notify2Days: boolean;
  notify1Day: boolean;
  notify0Days: boolean; // วันครบกำหนดวันนี้
  notifyOverdue: boolean;
  onlyWhenHidden: boolean; // แจ้งเตือนเฉพาะเมื่อไม่ได้เปิดหน้าต่างแอปค้างไว้ (background/minimized)
  soundEnabled: boolean;
  checkIntervalMinutes: 5 | 15 | 30 | 60;
}

export interface NotificationEligibleCase {
  caseItem: AppealCase;
  daysLeft: number;
  deadlineDate: string;
  bucket: '3_days' | '2_days' | '1_day' | 'today' | 'overdue';
  bucketLabel: string;
  dedupKey: string;
  alreadyNotifiedToday: boolean;
}

export interface NotificationDispatchResult {
  triggeredCount: number;
  sentNotifications: number;
  skippedReason?: 'disabled' | 'no_permission' | 'visible_only_hidden' | 'no_new_cases' | 'unsupported';
  notifiedCases: NotificationEligibleCase[];
}

const SETTINGS_STORAGE_KEY = 'appeal_browser_notification_settings_v1';
const SENT_LOG_STORAGE_KEY = 'appeal_browser_notification_sent_log_v1';

export const DEFAULT_NOTIFICATION_SETTINGS: BrowserNotificationSettings = {
  enabled: false,
  notify3Days: true,
  notify2Days: false,
  notify1Day: true,
  notify0Days: true,
  notifyOverdue: false,
  onlyWhenHidden: false,
  soundEnabled: true,
  checkIntervalMinutes: 15,
};

// Crisp inline SVG icon (Scales of Justice badge) so OS notifications never break on missing images
const NOTIFICATION_ICON_DATA_URI =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="28" fill="#0F172A"/>
      <rect x="8" y="8" width="112" height="112" rx="22" fill="none" stroke="#F59E0B" stroke-width="5"/>
      <path d="M64 26v66M40 94h48M32 46h64M38 46l-12 24h24L38 46zm52 0L78 70h24L90 46z" stroke="#FBBF24" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`
  );

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function getBrowserNotificationPermission(): BrowserNotificationPermissionState {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return window.Notification.permission as BrowserNotificationPermissionState;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    // Support both modern Promise-based and legacy callback-based Notification.requestPermission
    const result = await new Promise<NotificationPermission>((resolve, reject) => {
      try {
        const maybePromise = window.Notification.requestPermission((perm) => resolve(perm));
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(resolve, reject);
        }
      } catch (err) {
        reject(err);
      }
    });
    return result as BrowserNotificationPermissionState;
  } catch {
    return getBrowserNotificationPermission();
  }
}

export function loadNotificationSettings(): BrowserNotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(settings: BrowserNotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

interface SentLogStorage {
  date: string;
  keys: Record<string, string>; // dedupKey -> ISO timestamp
}

function loadTodaySentLog(todayStr: string = getTodayString()): SentLogStorage {
  try {
    const raw = localStorage.getItem(SENT_LOG_STORAGE_KEY);
    if (!raw) return { date: todayStr, keys: {} };
    const parsed = JSON.parse(raw) as SentLogStorage;
    if (parsed.date !== todayStr || !parsed.keys) {
      return { date: todayStr, keys: {} };
    }
    return parsed;
  } catch {
    return { date: todayStr, keys: {} };
  }
}

function saveTodaySentLog(log: SentLogStorage): void {
  try {
    localStorage.setItem(SENT_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // ignore storage errors
  }
}

export function clearTodayNotificationHistory(): void {
  saveTodaySentLog({ date: getTodayString(), keys: {} });
}

export function getTodayNotifiedCount(): number {
  const log = loadTodaySentLog();
  return Object.keys(log.keys).length;
}

/**
 * คัดกรองสำนวนที่เข้าเกณฑ์แจ้งเตือนระยะเวลาอุทธรณ์ (เช่น เหลือ 3 วัน, 1 วัน, วันนี้)
 * เคารพเงื่อนไขธุรกิจทั้งหมดของระบบ (ไม่เตือนสำนวนเสร็จสิ้น/จำหน่ายชั่วคราว ยกเว้นกรณีพิเศษ อ.กุลชาติ)
 */
export function getNotificationEligibleCases(
  cases: AppealCase[],
  settings: BrowserNotificationSettings,
  refDate: Date = new Date()
): NotificationEligibleCase[] {
  const todayStr = getTodayString();
  const sentLog = loadTodaySentLog(todayStr);
  const results: NotificationEligibleCase[] = [];

  for (const c of cases) {
    if (c.isTemporarilyDischarged) continue;

    // หากกดเสร็จสิ้นแล้ว จะไม่เตือน ยกเว้นเงื่อนไขพิเศษ อ.กุลชาติที่ยังไม่ยืนยันไม่อุทธรณ์
    if (c.isCompleted && !isKunchartCompletedPendingNoAppealAlert(c, refDate)) {
      continue;
    }

    const urgency = getAppealUrgency(c, refDate);
    if (urgency === 'pending_trial' || urgency === 'completed' || urgency === 'temporarily_discharged') {
      continue;
    }

    let deadlineDate = c.extendedDeadline || c.appealDeadline || '';
    if (!deadlineDate && c.judgmentDate) {
      deadlineDate = calculateAppealDeadline(c.judgmentDate).deadlineDate;
    }
    if (!deadlineDate) continue;

    const daysLeft = getDaysRemaining(c, refDate);
    let bucket: NotificationEligibleCase['bucket'] | null = null;
    let bucketLabel = '';

    if (daysLeft === 3 && settings.notify3Days) {
      bucket = '3_days';
      bucketLabel = 'เหลืออีก 3 วัน';
    } else if (daysLeft === 2 && settings.notify2Days) {
      bucket = '2_days';
      bucketLabel = 'เหลืออีก 2 วัน';
    } else if (daysLeft === 1 && settings.notify1Day) {
      bucket = '1_day';
      bucketLabel = 'ด่วนมาก! เหลืออีก 1 วัน';
    } else if (daysLeft === 0 && settings.notify0Days) {
      bucket = 'today';
      bucketLabel = 'ครบกำหนดอุทธรณ์วันนี้!';
    } else if (daysLeft < 0 && settings.notifyOverdue) {
      bucket = 'overdue';
      bucketLabel = `เกินกำหนดแล้ว ${Math.abs(daysLeft)} วัน`;
    }

    if (!bucket) continue;

    const dedupKey = `${todayStr}::${c.id}::${bucket}`;
    results.push({
      caseItem: c,
      daysLeft,
      deadlineDate,
      bucket,
      bucketLabel,
      dedupKey,
      alreadyNotifiedToday: Boolean(sentLog.keys[dedupKey]),
    });
  }

  // เรียงคดีด่วนที่สุดขึ้นก่อน (วันเหลือน้อยสุดขึ้นก่อน)
  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * ส่งเสียงเตือนนุ่มนวลผ่าน Web Audio API (ไม่ต้องพึ่งไฟล์เสียงภายนอก)
 */
export function playGentleNotificationChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.09, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playTone(659.25, 0, 0.22); // E5
    playTone(880.0, 0.14, 0.32); // A5

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Autoplay policy may prevent chime before user interaction
  }
}

/**
 * แสดง Browser Notification สำหรับสำนวนที่เข้าเกณฑ์และยังไม่ถูกแจ้งเตือนในวันนี้
 * หากมีหลายสำนวนพร้อมกัน (> 3 สำนวน) จะรวมเป็นแจ้งเตือนสรุปเพื่อไม่ให้รบกวนถาดแจ้งเตือน
 */
export function dispatchAppealBrowserNotifications(
  cases: AppealCase[],
  settings: BrowserNotificationSettings,
  options?: {
    forceResend?: boolean;
    onSelectCase?: (caseItem: AppealCase) => void;
    onFocusApp?: () => void;
  }
): NotificationDispatchResult {
  if (!isBrowserNotificationSupported()) {
    return { triggeredCount: 0, sentNotifications: 0, skippedReason: 'unsupported', notifiedCases: [] };
  }

  if (!settings.enabled && !options?.forceResend) {
    return { triggeredCount: 0, sentNotifications: 0, skippedReason: 'disabled', notifiedCases: [] };
  }

  if (window.Notification.permission !== 'granted') {
    return { triggeredCount: 0, sentNotifications: 0, skippedReason: 'no_permission', notifiedCases: [] };
  }

  const isAppVisibleAndFocused =
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    document.hasFocus();

  if (settings.onlyWhenHidden && isAppVisibleAndFocused && !options?.forceResend) {
    return {
      triggeredCount: 0,
      sentNotifications: 0,
      skippedReason: 'visible_only_hidden',
      notifiedCases: [],
    };
  }

  const eligible = getNotificationEligibleCases(cases, settings);
  const toNotify = options?.forceResend
    ? eligible
    : eligible.filter((item) => !item.alreadyNotifiedToday);

  if (toNotify.length === 0) {
    return {
      triggeredCount: 0,
      sentNotifications: 0,
      skippedReason: 'no_new_cases',
      notifiedCases: [],
    };
  }

  const todayStr = getTodayString();
  const sentLog = loadTodaySentLog(todayStr);
  const nowIso = new Date().toISOString();
  let sentCount = 0;

  if (toNotify.length <= 3) {
    // แสดงแจ้งเตือนแยกทีละสำนวนอย่างละเอียด
    for (const entry of toNotify) {
      const { caseItem, deadlineDate, bucketLabel, daysLeft, dedupKey } = entry;
      const prosecutor = caseItem.responsiblePerson || caseItem.prosecutorName || 'ไม่ระบุอัยการ';
      const title =
        daysLeft <= 1
          ? `ด่วนที่สุด: คดีดำ ${caseItem.blackCaseNo} (${bucketLabel})`
          : `แจ้งเตือนอุทธรณ์: คดีดำ ${caseItem.blackCaseNo} (${bucketLabel})`;

      const bodyLines = [
        `ครบกำหนดอุทธรณ์: ${formatThaiDate(deadlineDate, { short: true })}`,
        `จำเลย: ${caseItem.defendant || '-'}`,
        `อัยการเจ้าของสำนวน: ${prosecutor}`,
      ];
      if (!caseItem.isSubmittedToDuty) {
        bodyLines.push('สถานะ: ยังไม่เสนอเวรชี้');
      }

      try {
        const notification = new window.Notification(title, {
          body: bodyLines.join('\n'),
          icon: NOTIFICATION_ICON_DATA_URI,
          badge: NOTIFICATION_ICON_DATA_URI,
          tag: dedupKey,
          requireInteraction: daysLeft <= 1,
        });

        notification.onclick = () => {
          window.focus();
          options?.onSelectCase?.(caseItem);
          notification.close();
        };

        sentLog.keys[dedupKey] = nowIso;
        sentCount++;
      } catch (err) {
        console.warn('Browser Notification dispatch failed:', err);
      }
    }
  } else {
    // กรณีมีมากกว่า 3 สำนวนพร้อมกัน รวมเป็นแจ้งเตือนสรุป 1 ชุดพร้อมรายชื่อคดีด่วน
    const count1Day = toNotify.filter((x) => x.daysLeft === 1).length;
    const count3Days = toNotify.filter((x) => x.daysLeft === 3).length;
    const countToday = toNotify.filter((x) => x.daysLeft === 0).length;
    const countOverdue = toNotify.filter((x) => x.daysLeft < 0).length;

    const summaryParts: string[] = [];
    if (countToday > 0) summaryParts.push(`ครบกำหนดวันนี้ ${countToday} คดี`);
    if (count1Day > 0) summaryParts.push(`เหลือ 1 วัน ${count1Day} คดี`);
    if (count3Days > 0) summaryParts.push(`เหลือ 3 วัน ${count3Days} คดี`);
    if (countOverdue > 0) summaryParts.push(`เกินกำหนด ${countOverdue} คดี`);

    const sampleCases = toNotify
      .slice(0, 4)
      .map((x) => `• ${x.caseItem.blackCaseNo} (${x.bucketLabel})`)
      .join('\n');
    const moreText = toNotify.length > 4 ? `\nและอีก ${toNotify.length - 4} สำนวน — คลิกเพื่อเปิดดู` : '';

    try {
      const notification = new window.Notification(
        `เตือนอุทธรณ์ด่วน: พบ ${toNotify.length} สำนวนใกล้ครบกำหนด`,
        {
          body: `${summaryParts.join(' · ')}\n${sampleCases}${moreText}`,
          icon: NOTIFICATION_ICON_DATA_URI,
          badge: NOTIFICATION_ICON_DATA_URI,
          tag: `${todayStr}::batch_appeal_alert`,
          requireInteraction: count1Day > 0 || countToday > 0,
        }
      );

      notification.onclick = () => {
        window.focus();
        options?.onFocusApp?.();
        notification.close();
      };

      toNotify.forEach((entry) => {
        sentLog.keys[entry.dedupKey] = nowIso;
      });
      sentCount = 1;
    } catch (err) {
      console.warn('Batch Browser Notification dispatch failed:', err);
    }
  }

  if (sentCount > 0) {
    saveTodaySentLog(sentLog);
    if (settings.soundEnabled) {
      playGentleNotificationChime();
    }
  }

  return {
    triggeredCount: toNotify.length,
    sentNotifications: sentCount,
    notifiedCases: toNotify,
  };
}

/**
 * ส่งการแจ้งเตือนทดสอบ 1 ครั้งเพื่อยืนยันว่า OS / เบราว์เซอร์แสดงผลได้ปกติ
 */
export function sendTestBrowserNotification(
  soundEnabled: boolean,
  onClick?: () => void
): { ok: boolean; error?: string } {
  if (!isBrowserNotificationSupported()) {
    return { ok: false, error: 'เบราว์เซอร์นี้ไม่รองรับ Web Notification API' };
  }
  if (window.Notification.permission !== 'granted') {
    return { ok: false, error: 'กรุณากดอนุญาตการแจ้งเตือนของเบราว์เซอร์ก่อนทดสอบ' };
  }

  try {
    const notification = new window.Notification(
      'ทดสอบการแจ้งเตือนคุมอุทธรณ์ (ทำงานเบื้องหลังได้)',
      {
        body: 'ระบบพร้อมแจ้งเตือนอัตโนมัติเมื่อมีคดีใกล้ครบกำหนดอุทธรณ์ในอีก 3 วัน หรือ 1 วัน แม้พับหน้าต่างแอปไว้',
        icon: NOTIFICATION_ICON_DATA_URI,
        badge: NOTIFICATION_ICON_DATA_URI,
        tag: `test_notification_${Date.now()}`,
      }
    );
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
    if (soundEnabled) {
      playGentleNotificationChime();
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'ไม่สามารถส่งการแจ้งเตือนได้ โปรดตรวจสอบสิทธิ์ของเบราว์เซอร์หรือเปิดแอปในแท็บแยก',
    };
  }
}
