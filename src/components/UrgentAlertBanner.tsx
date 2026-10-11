import React from 'react';
import { AlertTriangle, Clock, CheckCircle, Calendar, ArrowRight, ShieldAlert, Sparkles, Mail, Send, Truck, Edit3, Shield, Scale } from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { getDaysRemaining, getAppealUrgency, formatThaiDate } from '../utils/dateUtils';
import { getRequisitionStatus, isPendingRequisitionCase, getRequisitionAlertInfo } from '../utils/appointmentUtils';

interface UrgentAlertBannerProps {
  cases: AppealCase[];
  onMarkComplete: (caseItem: AppealCase) => void;
  onExtendDeadline: (caseItem: AppealCase) => void;
  onSyncCalendar?: (caseItem: AppealCase) => void;
  onSendEmailAlert?: (caseItem: AppealCase) => void;
  onSendAllUrgentEmails?: () => void;
  onQuickChangeRequisitionStatus?: (caseItem: AppealCase, newStatus: 'confessed' | 'denied') => void;
  onEditCase?: (caseItem: AppealCase) => void;
}

export const UrgentAlertBanner: React.FC<UrgentAlertBannerProps> = ({
  cases,
  onMarkComplete,
  onExtendDeadline,
  onSyncCalendar,
  onSendEmailAlert,
  onSendAllUrgentEmails,
  onQuickChangeRequisitionStatus,
  onEditCase,
}) => {
  // กรองเฉพาะสำนวนที่ "ยังไม่เสร็จสิ้น" และ "ใกล้ครบกำหนด หรือขาดอุทธรณ์แล้ว" (urgency: overdue, critical, warning)
  const urgentCases = cases
    .filter((c) => {
      if (c.isCompleted) return false; // สำนวนที่เสร็จสิ้นแล้วไม่ต้องแจ้งเตือนอีกต่อไป!
      const urgency = getAppealUrgency(c);
      return urgency === 'overdue' || urgency === 'critical' || urgency === 'warning';
    })
    .sort((a, b) => getDaysRemaining(a) - getDaysRemaining(b));

  // สำนวนเบิกฟ้องที่ต้องแจ้งเตือน:
  // 1. ตามคำขอผู้ใช้: แจ้งเตือนทุกๆ 5 วัน หากยังไม่เปลี่ยนสถานะเป็นสำนวนรับสารภาพ หรือ ปฏิเสธ (alertInfo.isAlertDue)
  // 2. หรือใกล้ถึงวันเบิกฟ้อง (<= 3 วัน, วันนี้, หรือเกินกำหนด และยังไม่เสร็จสิ้น)
  const pendingRequisitionCasesWithAlert = cases
    .filter((c) => isPendingRequisitionCase(c))
    .map((c) => {
      const alertInfo = getRequisitionAlertInfo(c);
      const targetDate = c.requisitionDate || (c.appointmentType === 'requisition' ? c.appointmentDate : undefined);
      const reqStatus = getRequisitionStatus(targetDate);
      return {
        caseItem: c,
        alertInfo,
        reqStatus,
        targetDate: targetDate || c.filingDate,
      };
    })
    .filter(({ alertInfo, reqStatus }) => alertInfo.isAlertDue || reqStatus.isUrgent || reqStatus.isPast)
    .sort((a, b) => b.alertInfo.daysElapsed - a.alertInfo.daysElapsed);

  if (urgentCases.length === 0 && pendingRequisitionCasesWithAlert.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 flex items-center justify-between shadow-xs mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-emerald-950 font-['Prompt'] text-sm">
              ไม่มีสำนวนคดีที่ใกล้ครบกำหนดอุทธรณ์หรือสำนวนเบิกฟ้องที่ต้องติดตามผล
            </h4>
            <p className="text-xs text-emerald-700 mt-0.5">
              ทุกสำนวนได้รับการดำเนินการเรียบร้อย หรือยังไม่ถึงกำหนดระยะเวลาเร่งด่วน
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-white/70 px-3 py-1.5 rounded-lg border border-emerald-200">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>ระบบคุมอุทธรณ์ & เบิกฟ้อง ทำงานปกติ</span>
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
    <div className="space-y-4 mb-6">
      {/* 1. แจ้งเตือนสำนวนเบิกฟ้อง (เตือนทุกๆ 5 วัน หากยังไม่เปลี่ยนสถานะเป็นรับสารภาพหรือปฏิเสธ) */}
      {pendingRequisitionCasesWithAlert.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-100/70 border-2 border-orange-300 rounded-2xl p-4 sm:p-5 shadow-sm transition-all animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-orange-200/80 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20 animate-pulse flex-shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base sm:text-lg text-orange-950 font-['Prompt']">
                    แจ้งเตือนสำนวนเบิกฟ้อง: พบ {pendingRequisitionCasesWithAlert.length} สำนวนที่ต้องติดตามผล
                  </h3>
                  <span className="bg-orange-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    เตือนทุก 5 วัน
                  </span>
                </div>
                <p className="text-xs text-orange-800 mt-0.5">
                  สำนวนเบิกฟ้องที่ยังไม่เปลี่ยนสถานะเป็น <strong>"รับสารภาพ"</strong> หรือ <strong>"ปฏิเสธ"</strong> จะได้รับการแจ้งเตือนทุกๆ 5 วัน
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3.5">
            {pendingRequisitionCasesWithAlert.map(({ caseItem, alertInfo, reqStatus, targetDate }) => {
              return (
                <div
                  key={caseItem.id}
                  className="rounded-xl p-3.5 border border-orange-300 bg-white shadow-xs flex flex-col justify-between transition hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm font-['Prompt']">
                          ดำ {caseItem.blackCaseNo}
                        </span>
                        {caseItem.redCaseNo && (
                          <span className="text-xs text-rose-700 font-semibold bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200">
                            แดง {caseItem.redCaseNo}
                          </span>
                        )}
                        {caseItem.responsiblePerson && (
                          <span className="text-[10px] text-indigo-950 bg-indigo-50 font-semibold px-1.5 py-0.5 rounded border border-indigo-200" title={`อัยการเจ้าของสำนวน: ${caseItem.responsiblePerson}`}>
                            👔 {caseItem.responsiblePerson}
                          </span>
                        )}
                        {caseItem.prosecutorName && (
                          <span className="text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200" title={`อัยการเวรชี้: ${caseItem.prosecutorName}`}>
                            ⚖️ {caseItem.prosecutorName}
                          </span>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          alertInfo.isAlertDue
                            ? alertInfo.isExactIntervalToday
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                            : reqStatus.isToday
                            ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-bounce'
                            : reqStatus.isUrgent
                            ? 'bg-orange-100 text-orange-800 border border-orange-300'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {alertInfo.isAlertDue ? alertInfo.badgeLabel : reqStatus.label || alertInfo.badgeLabel}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 space-y-1 mb-2.5">
                      <div className="font-medium text-slate-800 truncate" title={caseItem.court}>
                        📍 {caseItem.court}
                      </div>
                      <div className="text-slate-600 truncate text-[11px]">
                        <span className="font-medium text-slate-700">จำเลย:</span> {caseItem.defendant}
                      </div>
                      {caseItem.requisitionNotes && (
                        <div className="text-orange-900 bg-orange-50 border border-orange-200/80 rounded px-2 py-1 text-[11px]">
                          <strong>หมายเหตุเบิกฟ้อง:</strong> {caseItem.requisitionNotes}
                        </div>
                      )}
                    </div>

                    {/* กล่องข้อความแจ้งเตือน 5 วัน */}
                    <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-950 space-y-1 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-900">
                          {alertInfo.isAlertDue
                            ? `🔔 เตือนรอบที่ ${alertInfo.cycle} (รอผลมาแล้ว ${alertInfo.daysElapsed} วัน)`
                            : `🚚 รอผลมาแล้ว ${alertInfo.daysElapsed} วัน`}
                        </span>
                        <span className="text-[10px] text-amber-700">
                          {alertInfo.isAlertDue
                            ? `รอบถัดไปอีก ${alertInfo.daysUntilNextAlert} วัน`
                            : `เตือนในอีก ${alertInfo.daysUntilNextAlert} วัน`}
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-800 leading-tight">
                        ยังไม่เปลี่ยนสถานะเป็นรับสารภาพหรือปฏิเสธ (วันที่ฟ้อง: {formatThaiDate(caseItem.filingDate)})
                      </div>
                    </div>
                  </div>

                  {/* Quick Change Status Buttons */}
                  <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-600">เปลี่ยนสถานะทันทีเมื่อทราบผล:</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onQuickChangeRequisitionStatus?.(caseItem, 'confessed')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition shadow-2xs cursor-pointer active:scale-95"
                        title="เปลี่ยนเป็นจำเลยรับสารภาพ"
                      >
                        <Scale className="w-3 h-3" />
                        <span>🟢 รับสารภาพ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickChangeRequisitionStatus?.(caseItem, 'denied')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition shadow-2xs cursor-pointer active:scale-95"
                        title="เปลี่ยนเป็นจำเลยปฏิเสธ (คุ้มครองสิทธิ)"
                      >
                        <Shield className="w-3 h-3" />
                        <span>🛡️ ปฏิเสธ</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {onEditCase && (
                        <button
                          type="button"
                          onClick={() => onEditCase(caseItem)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] py-1 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-slate-200 cursor-pointer"
                          title="เปิดแบบฟอร์มเพื่อแก้ไขรายละเอียดสำนวน"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>แก้ไขสำนวน</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onMarkComplete(caseItem)}
                        className="flex-1 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-[11px] py-1 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-slate-200 cursor-pointer"
                        title="กดเสร็จสิ้นเมื่อดำเนินการเบิกฟ้องเรียบร้อย"
                      >
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>เสร็จสิ้น</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. แจ้งเตือนระยะเวลาอุทธรณ์ 1 เดือน */}
      {urgentCases.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-2 border-rose-300/80 rounded-2xl p-4 sm:p-5 shadow-sm transition-all">
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
                        {caseItem.responsiblePerson && (
                          <span className="text-[10px] text-indigo-950 bg-indigo-50 font-semibold px-1.5 py-0.5 rounded border border-indigo-200" title={`อัยการเจ้าของสำนวน: ${caseItem.responsiblePerson}`}>
                            👔 {caseItem.responsiblePerson}
                          </span>
                        )}
                        {caseItem.prosecutorName && (
                          <span className="text-[10px] text-slate-600 bg-slate-100 font-normal px-1.5 py-0.5 rounded border border-slate-200" title={`อัยการเวรชี้: ${caseItem.prosecutorName}`}>
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
                      className={`text-xs py-1.5 px-2.5 rounded-lg font-medium transition cursor-pointer ${
                        caseItem.extendedDeadline
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-semibold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title={
                        caseItem.extendedDeadline
                          ? 'แก้ไขวันขยายเวลาที่กรอกไว้ หรือขอขยายเวลาเพิ่ม'
                          : 'ขอขยายระยะเวลาอุทธรณ์'
                      }
                    >
                      {caseItem.extendedDeadline ? 'แก้ไขขยายเวลา' : 'ขยายเวลา'}
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
      )}
    </div>
  );
};
