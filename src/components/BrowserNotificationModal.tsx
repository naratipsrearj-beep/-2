import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  X,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Clock,
  RefreshCw,
  Send,
  ShieldAlert,
  ExternalLink,
  Info,
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';
import {
  BrowserNotificationPermissionState,
  BrowserNotificationSettings,
  getNotificationEligibleCases,
  isRunningInIframe,
  sendTestBrowserNotification,
  clearTodayNotificationHistory,
} from '../services/browserNotificationService';

interface BrowserNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: AppealCase[];
  settings: BrowserNotificationSettings;
  permission: BrowserNotificationPermissionState;
  lastCheckedAt: string | null;
  onChangeSettings: (next: BrowserNotificationSettings) => void;
  onRequestPermissionAndEnable: () => Promise<BrowserNotificationPermissionState>;
  onCheckAndNotifyNow: (forceResend: boolean) => void;
  onSelectCase: (caseItem: AppealCase) => void;
  onToast?: (message: string) => void;
}

export const BrowserNotificationModal: React.FC<BrowserNotificationModalProps> = ({
  isOpen,
  onClose,
  cases,
  settings,
  permission,
  lastCheckedAt,
  onChangeSettings,
  onRequestPermissionAndEnable,
  onCheckAndNotifyNow,
  onSelectCase,
  onToast,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const inIframe = useMemo(() => isRunningInIframe(), []);

  const eligibleCases = useMemo(
    () => getNotificationEligibleCases(cases, settings),
    [cases, settings]
  );

  if (!isOpen) return null;

  const isGranted = permission === 'granted';
  const isDenied = permission === 'denied';
  const isUnsupported = permission === 'unsupported';
  const isActive = isGranted && settings.enabled;

  const handleEnableToggle = async () => {
    setStatusFeedback(null);
    if (isUnsupported) {
      setStatusFeedback({
        type: 'error',
        message: 'เบราว์เซอร์นี้ไม่รองรับ Browser Notification API',
      });
      return;
    }

    if (!isGranted) {
      setIsRequesting(true);
      try {
        const result = await onRequestPermissionAndEnable();
        if (result === 'granted') {
          setStatusFeedback({
            type: 'success',
            message: 'เปิดรับการแจ้งเตือนเดสก์ท็อปสำเร็จ! ระบบจะตรวจสอบคดีใกล้ครบอุทธรณ์ให้อัตโนมัติแม้เปิดแอปไว้ในเบื้องหลัง',
          });
        } else if (result === 'denied') {
          setStatusFeedback({
            type: 'error',
            message:
              'เบราว์เซอร์ปฏิเสธสิทธิ์การแจ้งเตือน กรุณาคลิกไอคอนรูปกุญแจ/ตั้งค่าข้างแถบ URL เพื่ออนุญาตการแจ้งเตือนแล้วลองอีกครั้ง',
          });
        } else {
          setStatusFeedback({
            type: 'info',
            message: inIframe
              ? 'หากหน้าต่างขอสิทธิ์ไม่แสดงในกรอบตัวอย่าง ให้เปิดแอปในแท็บเบราว์เซอร์เต็มหน้าจอแล้วกดเปิดการแจ้งเตือนอีกครั้ง'
              : 'ยังไม่ได้กดอนุญาตการแจ้งเตือน กรุณากด "อนุญาต (Allow)" เมื่อเบราว์เซอร์สอบถาม',
          });
        }
      } finally {
        setIsRequesting(false);
      }
      return;
    }

    const nextEnabled = !settings.enabled;
    onChangeSettings({ ...settings, enabled: nextEnabled });
    setStatusFeedback({
      type: 'info',
      message: nextEnabled
        ? 'เปิดการแจ้งเตือนเบื้องหลังเรียบร้อยแล้ว'
        : 'พักการแจ้งเตือนเบื้องหลังชั่วคราวแล้ว',
    });
  };

  const handleSendTest = () => {
    setStatusFeedback(null);
    const res = sendTestBrowserNotification(settings.soundEnabled);
    if (res.ok) {
      setStatusFeedback({
        type: 'success',
        message: 'ส่งการแจ้งเตือนทดสอบไปยังเดสก์ท็อปแล้ว (หากไม่เห็น โปรดตรวจสอบโหมดห้ามรบกวน / Do Not Disturb ของเครื่อง)',
      });
      onToast?.('ส่งการแจ้งเตือนทดสอบไปยังเบราว์เซอร์เรียบร้อยแล้ว');
    } else {
      setStatusFeedback({
        type: 'error',
        message: res.error || 'ไม่สามารถส่งการแจ้งเตือนทดสอบได้',
      });
    }
  };

  const handleForceCheckNow = () => {
    setStatusFeedback(null);
    clearTodayNotificationHistory();
    onCheckAndNotifyNow(true);
    if (eligibleCases.length === 0) {
      setStatusFeedback({
        type: 'info',
        message: 'ไม่พบสำนวนคดีที่เข้าเกณฑ์แจ้งเตือนตามเงื่อนไขที่เลือกในวันนี้',
      });
    } else {
      setStatusFeedback({
        type: 'success',
        message: `ส่งการแจ้งเตือนสำนวนที่ใกล้ครบกำหนดจำนวน ${eligibleCases.length} สำนวนเรียบร้อยแล้ว`,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="browser-notification-modal-title"
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
              }`}
            >
              {isActive ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2
                id="browser-notification-modal-title"
                className="text-base font-bold font-['Prompt'] text-white truncate"
              >
                ตั้งค่าการแจ้งเตือนผ่านเบราว์เซอร์ (Browser Notification)
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                แจ้งเตือนเดสก์ท็อปเมื่อคดีใกล้ครบกำหนดอุทธรณ์ใน 3 วัน หรือ 1 วัน แม้พับหน้าต่างแอปไว้ในเบื้องหลัง
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            aria-label="ปิดหน้าต่างตั้งค่าการแจ้งเตือน"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Master Permission & Status Card */}
          <div
            className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              isActive
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : isDenied || isUnsupported
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <div className="space-y-1">
              <div className="font-bold text-sm font-['Prompt'] flex items-center gap-2">
                {isActive ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>เปิดการแจ้งเตือนอัตโนมัติแล้ว</span>
                  </>
                ) : isDenied ? (
                  <>
                    <BellOff className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>เบราว์เซอร์บล็อกการแจ้งเตือนอยู่</span>
                  </>
                ) : isUnsupported ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>เบราว์เซอร์ไม่รองรับ Notification API</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 text-slate-700 shrink-0" />
                    <span>{isGranted ? 'พักการแจ้งเตือนชั่วคราว' : 'ยังไม่ได้เปิดสิทธิ์การแจ้งเตือน'}</span>
                  </>
                )}
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                {isActive
                  ? `ระบบจะตรวจสอบทุก ${settings.checkIntervalMinutes} นาที และเมื่อมีข้อมูลซิงค์ใหม่ (เปิดแท็บแอปทิ้งไว้ในเบื้องหลังเพื่อรับแจ้งเตือน)`
                  : isDenied
                  ? 'คลิกไอคอนตั้งค่าไซต์ (รูปกุญแจ) ด้านซ้ายของแถบ URL เบราว์เซอร์ เปลี่ยน "การแจ้งเตือน (Notifications)" เป็น "อนุญาต (Allow)" แล้วรีโหลดหน้า'
                  : 'กดปุ่มด้านขวาเพื่อขออนุญาตแสดงหน้าต่างแจ้งเตือนบนเดสก์ท็อปของคอมพิวเตอร์หรือมือถือ'}
              </p>
              {lastCheckedAt && isActive && (
                <div className="text-[11px] text-emerald-800 font-medium tabular-nums pt-0.5">
                  ตรวจสอบล่าสุดเมื่อเวลา {lastCheckedAt} น.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleEnableToggle}
              disabled={isRequesting || isUnsupported}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                isActive
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
              }`}
            >
              {isRequesting
                ? 'กำลังขอสิทธิ์...'
                : isActive
                ? 'พักการแจ้งเตือน'
                : isGranted
                ? 'เปิดใช้งานการแจ้งเตือน'
                : 'อนุญาตและเปิดแจ้งเตือน'}
            </button>
          </div>

          {/* Feedback Message */}
          {statusFeedback && (
            <div
              className={`rounded-xl border p-3 flex items-start gap-2.5 text-xs ${
                statusFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : statusFeedback.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-sky-50 border-sky-300 text-sky-950'
              }`}
            >
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{statusFeedback.message}</span>
            </div>
          )}

          {/* Iframe Notice (if previewing embedded) */}
          {inIframe && !isGranted && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>หมายเหตุสำหรับหน้าต่างฝังตัว (Preview):</strong> เบราว์เซอร์บางรุ่นไม่อนุญาตให้ขอสิทธิ์ Notification ภายในกรอบ iframe หากกดแล้วไม่มีหน้าต่างขออนุญาตขึ้น ให้เปิดแอปในแท็บเบราว์เซอร์เต็มหน้าต่างเพื่อเปิดสิทธิ์การแจ้งเตือนเดสก์ท็อป
              </div>
            </div>
          )}

          {/* Threshold Settings */}
          <div className="space-y-3">
            <div className="font-bold text-slate-900 text-sm font-['Prompt']">
              เกณฑ์ระยะเวลาอุทธรณ์ที่ต้องการให้แจ้งเตือน
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {
                  key: 'notify3Days' as const,
                  title: 'ใกล้ครบกำหนดในอีก 3 วัน',
                  desc: 'แจ้งเตือนล่วงหน้าเมื่อเหลือเวลาอุทธรณ์ 3 วัน',
                  recommended: true,
                },
                {
                  key: 'notify1Day' as const,
                  title: 'ด่วนมาก! ใกล้ครบกำหนดในอีก 1 วัน',
                  desc: 'แจ้งเตือนด่วนพร้อมค้างหน้าต่างเตือนจนกว่าจะกดปิด',
                  recommended: true,
                },
                {
                  key: 'notify0Days' as const,
                  title: 'วันครบกำหนดอุทธรณ์วันนี้ (0 วัน)',
                  desc: 'เตือนวันสุดท้ายก่อนขาดอุทธรณ์',
                  recommended: true,
                },
                {
                  key: 'notify2Days' as const,
                  title: 'แจ้งเตือนเพิ่มเติมเมื่อเหลือ 2 วัน',
                  desc: 'เตือนซ้ำในวันที่ 2 ก่อนครบกำหนด',
                  recommended: false,
                },
                {
                  key: 'notifyOverdue' as const,
                  title: 'คดีที่เกินกำหนดอุทธรณ์แล้ว',
                  desc: 'เตือนสำนวนที่เลยกำหนดแต่ยังไม่กดเสร็จสิ้น',
                  recommended: false,
                },
              ].map((item) => {
                const checked = settings[item.key];
                return (
                  <label
                    key={item.key}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border transition cursor-pointer select-none ${
                      checked
                        ? 'bg-slate-50 border-slate-400 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50/70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        onChangeSettings({ ...settings, [item.key]: e.target.checked })
                      }
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 leading-snug">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {item.desc}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Background Behavior & Sound */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="font-bold text-slate-900 text-sm font-['Prompt']">
              การทำงานในเบื้องหลังและเสียงเตือน
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block font-medium text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>รอบตรวจสอบอัตโนมัติในเบื้องหลัง</span>
                </label>
                <select
                  value={settings.checkIntervalMinutes}
                  onChange={(e) =>
                    onChangeSettings({
                      ...settings,
                      checkIntervalMinutes: Number(e.target.value) as 5 | 15 | 30 | 60,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                >
                  <option value={5}>ทุก 5 นาที</option>
                  <option value={15}>ทุก 15 นาที (แนะนำ)</option>
                  <option value={30}>ทุก 30 นาที</option>
                  <option value={60}>ทุก 1 ชั่วโมง</option>
                </select>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 font-medium">
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, soundEnabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                  {settings.soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-slate-700 shrink-0" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span>ส่งเสียงเตือนนุ่มนวลประกอบการแจ้งเตือน</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 font-medium">
                  <input
                    type="checkbox"
                    checked={settings.onlyWhenHidden}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, onlyWhenHidden: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                  <span>แจ้งเตือนเฉพาะเมื่อพับหน้าต่าง / ใช้งานแอปอื่นอยู่</span>
                </label>
              </div>
            </div>
          </div>

          {/* Live Preview of Currently Eligible Cases */}
          <div className="border-t border-slate-200 pt-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-bold text-slate-900 text-sm font-['Prompt'] flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>สำนวนที่เข้าเกณฑ์แจ้งเตือนวันนี้</span>
              </div>
              <span className="text-xs text-slate-600 font-medium tabular-nums">
                พบ {eligibleCases.length} สำนวน
              </span>
            </div>

            {eligibleCases.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-500">
                วันนี้ยังไม่มีสำนวนคดีที่ใกล้ครบกำหนดอุทธรณ์ตามเกณฑ์ที่เลือก
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-200 overflow-hidden">
                {eligibleCases.map((entry) => {
                  const isCritical = entry.daysLeft <= 1;
                  return (
                    <div
                      key={entry.dedupKey}
                      className="p-3 bg-white hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">
                            คดีดำ {entry.caseItem.blackCaseNo}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span
                            className={`font-bold tabular-nums ${
                              isCritical ? 'text-rose-700' : 'text-amber-800'
                            }`}
                          >
                            {entry.bucketLabel}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-slate-600 tabular-nums">
                            ครบอุทธรณ์ {formatThaiDate(entry.deadlineDate, { short: true })}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 truncate">
                          จำเลย: {entry.caseItem.defendant || '-'} · อัยการ:{' '}
                          {entry.caseItem.responsiblePerson || entry.caseItem.prosecutorName || '-'}
                          {entry.alreadyNotifiedToday ? ' · แจ้งเตือนวันนี้แล้ว' : ' · รอแจ้งเตือน'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectCase(entry.caseItem);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer self-start sm:self-center whitespace-nowrap"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>เปิดดูสำนวน</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSendTest}
              disabled={!isGranted}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              title="ส่งการแจ้งเตือนทดสอบไปยังเดสก์ท็อป 1 ครั้ง"
            >
              <Send className="w-3.5 h-3.5 text-slate-600" />
              <span>ทดสอบแจ้งเตือน</span>
            </button>

            <button
              type="button"
              onClick={handleForceCheckNow}
              disabled={!isGranted}
              className="px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              title="ตรวจสอบสำนวนที่เข้าเกณฑ์และส่งแจ้งเตือนซ้ำทันที"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>แจ้งเตือนคดีเข้าเกณฑ์ทันที ({eligibleCases.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
};
