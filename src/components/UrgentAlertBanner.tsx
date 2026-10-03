import React from 'react';
import { AlertTriangle, Clock, CheckCircle, Calendar, ArrowRight, ShieldAlert, Sparkles, Mail, Send } from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { getDaysRemaining, getAppealUrgency, formatThaiDate } from '../utils/dateUtils';

interface UrgentAlertBannerProps {
  cases: AppealCase[];
  onMarkComplete: (caseItem: AppealCase) => void;
  onExtendDeadline: (caseItem: AppealCase) => void;
  onSyncCalendar?: (caseItem: AppealCase) => void;
  onSendEmailAlert?: (caseItem: AppealCase) => void;
  onSendAllUrgentEmails?: () => void;
}

export const UrgentAlertBanner: React.FC<UrgentAlertBannerProps> = ({
  cases,
  onMarkComplete,
  onExtendDeadline,
  onSyncCalendar,
  onSendEmailAlert,
  onSendAllUrgentEmails,
}) => {
  // กรองเฉพาะสำนวนที่ "ยังไม่เสร็จสิ้น" และ "ใกล้ครบกำหนด หรือขาดอุทธรณ์แล้ว" (urgency: overdue, critical, warning)
  const urgentCases = cases
    .filter((c) => {
      if (c.isCompleted) return false; // สำนวนที่เสร็จสิ้นแล้วไม่ต้องแจ้งเตือนอีกต่อไป!
      const urgency = getAppealUrgency(c);
      return urgency === 'overdue' || urgency === 'critical' || urgency === 'warning';
    })
    .sort((a, b) => getDaysRemaining(a) - getDaysRemaining(b));

  if (urgentCases.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 flex items-center justify-between shadow-xs mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-emerald-950 font-['Prompt'] text-sm">
              ไม่มีสำนวนคดีที่ใกล้ครบกำหนดอุทธรณ์ 1 เดือนในระยะวิกฤต
            </h4>
            <p className="text-xs text-emerald-700 mt-0.5">
              ทุกสำนวนที่มีคำพิพากษาได้รับการดำเนินการเรียบร้อย หรือยังมีระยะเวลาอุทธรณ์เกินกว่า 7 วัน
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-white/70 px-3 py-1.5 rounded-lg border border-emerald-200">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>ระบบคุมอุทธรณ์ทำงานปกติ</span>
        </div>
      </div>
    );
  }

  const overdueCount = urgentCases.filter((c) => getDaysRemaining(c) < 0).length;
  const criticalCount = urgentCases.filter((c) => {
    const d = getDaysRemaining(c);
    return d >= 0 && d <= 3;
  }).length;

  return (
    <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-2 border-rose-300/80 rounded-2xl p-4 sm:p-5 shadow-sm mb-6 transition-all">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-rose-200/70 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20 animate-pulse flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-rose-950 font-['Prompt']">
                แจ้งเตือนเร่งด่วน: พบ {urgentCases.length} สำนวนใกล้ครบกำหนดอุทธรณ์ 1 เดือน
              </h3>
              {overdueCount > 0 && (
                <span className="bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                  พ้นกำหนด {overdueCount} สำนวน
                </span>
              )}
              {criticalCount > 0 && (
                <span className="bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                  เหลือ ≤ 3 วัน {criticalCount} สำนวน
                </span>
              )}
            </div>
            <p className="text-xs text-rose-800/90 mt-0.5">
              คดีเหล่านี้ยังไม่ได้กดเสร็จสิ้น โปรดรีบยื่นอุทธรณ์ หรือยื่นคำร้องขอขยายเวลา หรือกดเสร็จสิ้นเมื่อดำเนินการแล้ว (ระบบจะหยุดเตือนทันที)
            </p>
          </div>
        </div>

        {onSendAllUrgentEmails && (
          <button
            onClick={onSendAllUrgentEmails}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0"
            title="ส่งอีเมลแจ้งเตือนทุกคดีที่เหลือเวลา 3 วัน และ 1 วันไปยังอีเมลของผู้ใช้"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>ส่งอีเมลเตือนทุกคดีด่วน</span>
          </button>
        )}
      </div>

      {/* Grid of urgent cases */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3.5">
        {urgentCases.map((caseItem) => {
          const daysLeft = getDaysRemaining(caseItem);
          const isOverdue = daysLeft < 0;
          const isCritical = daysLeft >= 0 && daysLeft <= 3;
          const effectiveDeadline = caseItem.extendedDeadline || caseItem.appealDeadline;

          return (
            <div
              key={caseItem.id}
              className={`rounded-xl p-3.5 border bg-white shadow-xs flex flex-col justify-between transition hover:shadow-md ${
                isOverdue
                  ? 'border-rose-400 bg-rose-50/40 ring-1 ring-rose-400/50'
                  : isCritical
                  ? 'border-amber-400 bg-amber-50/30'
                  : 'border-yellow-300 bg-yellow-50/20'
              }`}
            >
              <div>
                {/* Badge & Days left */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm font-['Prompt']">
                      ดำ {caseItem.blackCaseNo}
                    </span>
                    <span className="text-xs text-rose-700 font-semibold bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200">
                      แดง {caseItem.redCaseNo}
                    </span>
                    {caseItem.prosecutorName && (
                      <span className="text-[10px] text-amber-900 bg-amber-100/80 font-medium px-1.5 py-0.5 rounded border border-amber-200" title={`อัยการเจ้าของสำนวน: ${caseItem.prosecutorName}`}>
                        ⚖️ {caseItem.prosecutorName}
                      </span>
                    )}
                  </div>

                  {isOverdue ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      เกินกำหนด {Math.abs(daysLeft)} วัน
                    </span>
                  ) : isCritical ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full animate-bounce">
                      <Clock className="w-3 h-3 text-amber-600" />
                      เหลืออีก {daysLeft} วัน!
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3 text-yellow-600" />
                      เหลืออีก {daysLeft} วัน
                    </span>
                  )}
                </div>

                {/* Court & Parties */}
                <div className="text-xs text-slate-700 space-y-1 mb-2.5">
                  <div className="font-medium text-slate-800 truncate" title={caseItem.court}>
                    📍 {caseItem.court}
                  </div>
                  <div className="text-slate-600 truncate text-[11px]">
                    <span className="font-medium text-slate-700">โจทก์:</span> {caseItem.plaintiff}
                  </div>
                  <div className="text-slate-600 truncate text-[11px]">
                    <span className="font-medium text-slate-700">จำเลย:</span> {caseItem.defendant}
                  </div>
                </div>

                {/* Deadline Info */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 text-[11px] text-slate-700 space-y-0.5 mb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">วันพิพากษา:</span>
                    <span className="font-medium text-slate-800">{formatThaiDate(caseItem.judgmentDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ครบกำหนด 1 เดือน:</span>
                    <span className="font-bold text-rose-700">{formatThaiDate(effectiveDeadline)}</span>
                  </div>
                  {caseItem.extendedDeadline && (
                    <div className="text-amber-700 text-[10px] text-right font-medium">
                      (ขยายเวลาครั้งที่ {caseItem.extensionCount || 1})
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                <button
                  onClick={() => onMarkComplete(caseItem)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition shadow-xs"
                  title="เมื่อกดแล้ว สำนวนนี้จะไม่แจ้งเตือนอีกต่อไป"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>กดเสร็จสิ้นสำนวน</span>
                </button>

                <button
                  onClick={() => onExtendDeadline(caseItem)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-1.5 px-2.5 rounded-lg font-medium transition"
                  title="ขอขยายระยะเวลาอุทธรณ์"
                >
                  ขยายเวลา
                </button>

                {onSyncCalendar && (
                  <button
                    onClick={() => onSyncCalendar(caseItem)}
                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                    title="เพิ่มแจ้งเตือนลง Google Calendar"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                  </button>
                )}

                {onSendEmailAlert && (
                  <button
                    onClick={() => onSendEmailAlert(caseItem)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                    title="ส่งอีเมลแจ้งเตือนคดีนี้ไปยัง Gmail ทันที"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
