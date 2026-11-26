import React, { useMemo, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle, Calendar, ArrowRight, ShieldAlert, Sparkles, Mail, Send, Truck, Edit3, Shield, Scale, Users, Check, Eye, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { getDaysRemaining, getAppealUrgency, formatThaiDate, isKunchartCompletedPendingNoAppealAlert, getSeveredFilingAlertInfo, hasCaseFilingAfterJudgmentAnomaly } from '../utils/dateUtils';
import {
  getRequisitionStatus,
  isPendingRequisitionCase,
  getRequisitionAlertInfo,
  getMissingJudgmentAlertInfo,
  getUnspecifiedStageAlertInfo,
  isCaseUnspecifiedStage,
} from '../utils/appointmentUtils';
import { findDuplicateCases, DuplicateFieldType, DUPLICATE_FIELD_ORDER, DUPLICATE_FIELD_META } from '../utils/duplicateCaseUtils';

interface UrgentAlertBannerProps {
  cases: AppealCase[];
  onViewCaseDetail?: (caseItem: AppealCase) => void;
  onMarkComplete?: (caseItem: AppealCase) => void;
  onExtendDeadline?: (caseItem: AppealCase) => void;
  onConfirmNoAppeal?: (caseId: string) => void;
  onSyncCalendar?: (caseItem: AppealCase) => void;
  onSendEmailAlert?: (caseItem: AppealCase) => void;
  onSendAllUrgentEmails?: () => void;
  onQuickChangeRequisitionStatus?: (caseItem: AppealCase, newStatus: 'confessed' | 'denied') => void;
  onQuickChangePleaStatus?: (caseItem: AppealCase, newStatus: 'confessed' | 'denied' | 'pending' | 'requisition') => void;
  onEditCase?: (caseItem: AppealCase) => void;
  onRecordJudgment?: (caseItem: AppealCase) => void;
  onMarkSeveredCompleted?: (caseItem: AppealCase, newBlackNo?: string) => void;
  onCreateSeveredCase?: (parentCase: AppealCase) => void;
}

export const UrgentAlertBanner: React.FC<UrgentAlertBannerProps> = ({
  cases,
  onViewCaseDetail,
  onMarkComplete,
  onExtendDeadline,
  onConfirmNoAppeal,
  onSyncCalendar,
  onSendEmailAlert,
  onSendAllUrgentEmails,
  onQuickChangeRequisitionStatus,
  onQuickChangePleaStatus,
  onEditCase,
  onRecordJudgment,
  onMarkSeveredCompleted,
  onCreateSeveredCase,
}) => {
  // สำนวนเฉพาะของ อ.กุลชาติ: หากกดเสร็จสิ้นแล้ว ก็ยังให้เตือนตอนก่อนครบอุทธรณ์ 5 วันอยู่
  // จนกว่าจะกดยืนยันว่าสำนวนไม่อุทธรณ์แล้ว
  const kunchartPendingCases = cases
    .filter((c) => isKunchartCompletedPendingNoAppealAlert(c))
    .sort((a, b) => getDaysRemaining(a) - getDaysRemaining(b));

  // สำนวนที่ต้องเตือนแยกฟ้องภายใน 7 วัน (กรณีจำเลยรับสารภาพ และมีกรณีจำเลยหลายคน บางคนปฏิเสธ หรือมีคำสั่งแยกฟ้อง)
  const pendingSeveredAlertCases = cases
    .map((c) => ({
      caseItem: c,
      alertInfo: getSeveredFilingAlertInfo(c),
    }))
    .filter(({ alertInfo }) => alertInfo.isAlertDue && alertInfo.isPending)
    .sort((a, b) => a.alertInfo.daysRemaining - b.alertInfo.daysRemaining);

  // สำนวนที่มีคำพิพากษาแล้ว แต่ยังไม่มีการกรอกข้อมูลวันพิพากษา (แจ้งเตือนเมื่อครบกำหนด 15 วัน)
  const pendingMissingJudgmentAlertCases = cases
    .map((c) => ({
      caseItem: c,
      alertInfo: getMissingJudgmentAlertInfo(c),
    }))
    .filter(({ alertInfo }) => alertInfo.isEligible && alertInfo.isAlertDue)
    .sort((a, b) => b.alertInfo.daysElapsed - a.alertInfo.daysElapsed);

  // สำนวนที่ยังไม่เลือกสถานะ: แจ้งเตือนทุกๆ 5 วัน เพื่อตรวจสอบว่าจำเลยให้การอย่างไร สถานะไหน
  const pendingUnspecifiedAlertCases = cases
    .filter((c) => isCaseUnspecifiedStage(c) && !c.isCompleted && !c.isTemporarilyDischarged)
    .map((c) => ({
      caseItem: c,
      alertInfo: getUnspecifiedStageAlertInfo(c),
    }))
    .filter(({ alertInfo }) => alertInfo.isAlertDue)
    .sort((a, b) => b.alertInfo.daysElapsed - a.alertInfo.daysElapsed);

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

  // สำนวนที่มีข้อมูลวันที่ผิดปกติ: วันที่ฟ้องเกิดขึ้นหลังวันพิพากษา (จะพิพากษาก่อนฟ้องไม่ได้)
  const filingAfterJudgmentAnomalyCases = cases
    .map((c) => ({
      caseItem: c,
      anomaly: hasCaseFilingAfterJudgmentAnomaly(c),
    }))
    .filter(({ anomaly }) => anomaly.isAnomalous)
    .sort((a, b) => {
      if (Boolean(a.caseItem.isCompleted) !== Boolean(b.caseItem.isCompleted)) {
        return a.caseItem.isCompleted ? 1 : -1;
      }
      return b.anomaly.daysDifference - a.anomaly.daysDifference;
    });

  // ตรวจสอบเลขสำนวนซ้ำกัน (หมายเลขคดีดำ, หมายเลขคดีแดง, หมายเลข ส.1, หมายเลข ส.4)
  const duplicateCheck = useMemo(() => findDuplicateCases(cases), [cases]);
  const [duplicateFieldFilter, setDuplicateFieldFilter] = useState<'all' | DuplicateFieldType>('all');
  const [showAllDuplicateGroups, setShowAllDuplicateGroups] = useState(false);

  const visibleDuplicateGroups = useMemo(() => {
    const list =
      duplicateFieldFilter === 'all'
        ? duplicateCheck.groups
        : duplicateCheck.byField[duplicateFieldFilter];
    return showAllDuplicateGroups ? list : list.slice(0, 6);
  }, [duplicateCheck, duplicateFieldFilter, showAllDuplicateGroups]);

  const totalFilteredDuplicateGroups =
    duplicateFieldFilter === 'all'
      ? duplicateCheck.groups.length
      : duplicateCheck.byField[duplicateFieldFilter].length;

  if (
    filingAfterJudgmentAnomalyCases.length === 0 &&
    duplicateCheck.groups.length === 0 &&
    urgentCases.length === 0 &&
    pendingRequisitionCasesWithAlert.length === 0 &&
    pendingUnspecifiedAlertCases.length === 0 &&
    kunchartPendingCases.length === 0 &&
    pendingSeveredAlertCases.length === 0 &&
    pendingMissingJudgmentAlertCases.length === 0
  ) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 flex items-center justify-between shadow-xs mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-emerald-950 font-['Prompt'] text-sm">
              ไม่มีสำนวนคดีที่ใกล้ครบกำหนดอุทธรณ์ สำนวนที่ต้องแยกฟ้อง หรือสำนวนเบิกฟ้องที่ต้องติดตามผล
            </h4>
            <p className="text-xs text-emerald-700 mt-0.5">
              ทุกสำนวนได้รับการดำเนินการเรียบร้อย หรือยังไม่ถึงกำหนดระยะเวลาเร่งด่วน
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-white/70 px-3 py-1.5 rounded-lg border border-emerald-200">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>ระบบคุมอุทธรณ์ & เตือนแยกฟ้อง 7 วัน ทำงานปกติ</span>
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
      {/* -1. แจ้งเตือนข้อมูลวันที่ผิดปกติ: วันที่ฟ้องเกิดหลังวันพิพากษา (จะพิพากษาก่อนฟ้องไม่ได้) */}
      {filingAfterJudgmentAnomalyCases.length > 0 && (
        <div className="bg-cyan-950 text-white rounded-2xl p-4 sm:p-5 shadow-md border-2 border-cyan-400">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-cyan-700/80 gap-2">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-white font-['Prompt'] tabular-nums">
                  แจ้งเตือนข้อมูลวันที่ผิดปกติ: พบ {filingAfterJudgmentAnomalyCases.length} สำนวนที่วันที่ฟ้องเกิดหลังวันพิพากษา
                </h3>
                <p className="text-xs text-cyan-100 mt-0.5 leading-relaxed">
                  ข้อมูลไม่สอดคล้องตามลำดับกระบวนพิจารณา เพราะจะพิพากษาก่อนฟ้องไม่ได้ กรุณาตรวจสอบและแก้ไขวันที่ยื่นฟ้องหรือวันพิพากษาให้ถูกต้อง
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3.5">
            {filingAfterJudgmentAnomalyCases.map(({ caseItem, anomaly }) => (
              <div
                key={caseItem.id}
                className="rounded-xl p-3.5 border border-cyan-400/60 bg-cyan-900/55 text-white flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-cyan-200 text-sm font-['Prompt'] truncate">
                        ดำ {caseItem.blackCaseNo}
                        {caseItem.redCaseNo ? ` / แดง ${caseItem.redCaseNo}` : ''}
                      </div>
                      <div className="text-[11px] text-cyan-100 truncate">
                        จำเลย: {caseItem.defendant || '-'}
                        {caseItem.responsiblePerson ? ` · อัยการ: ${caseItem.responsiblePerson}` : ''}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-cyan-100 tabular-nums flex-wrap mt-0.5">
                        <span>
                          <span className="font-semibold text-cyan-300">ส.1:</span>{' '}
                          <span className={caseItem.receivedNumberS1?.trim() ? 'font-semibold text-white' : 'text-cyan-300/70'}>
                            {caseItem.receivedNumberS1?.trim() || '-'}
                          </span>
                        </span>
                        <span className="text-cyan-600" aria-hidden="true">·</span>
                        <span>
                          <span className="font-semibold text-emerald-300">ส.4:</span>{' '}
                          <span className={caseItem.filingNumberS4?.trim() ? 'font-semibold text-white' : 'text-cyan-300/70'}>
                            {caseItem.filingNumberS4?.trim() || '-'}
                          </span>
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-300 tabular-nums shrink-0">
                      คลาดเคลื่อน {anomaly.daysDifference} วัน
                    </span>
                  </div>

                  <div className="bg-cyan-950/80 border border-cyan-600/60 rounded-lg p-2.5 text-xs space-y-1 tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-cyan-200">วันที่ยื่นฟ้อง (บันทึกไว้):</span>
                      <span className="font-bold text-cyan-300">{formatThaiDate(caseItem.filingDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-cyan-200">วันอ่านคำพิพากษา:</span>
                      <span className="font-bold text-white">{formatThaiDate(caseItem.judgmentDate)}</span>
                    </div>
                  </div>
                </div>

                {(onViewCaseDetail || onEditCase || onRecordJudgment) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {onViewCaseDetail && (
                      <button
                        type="button"
                        onClick={() => onViewCaseDetail(caseItem)}
                        className="bg-cyan-800 hover:bg-cyan-700 text-white border border-cyan-400/60 font-bold text-xs py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        title="ดูรายละเอียดสำนวนทั้งหมด"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-200" />
                        <span>ดูรายละเอียด</span>
                      </button>
                    )}
                    {onEditCase && (
                      <button
                        type="button"
                        onClick={() => onEditCase(caseItem)}
                        className="flex-1 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-950" />
                        <span>แก้ไขวันฟ้อง/สำนวน</span>
                      </button>
                    )}
                    {onRecordJudgment && (
                      <button
                        type="button"
                        onClick={() => onRecordJudgment(caseItem)}
                        className="flex-1 bg-white hover:bg-cyan-50 text-cyan-950 font-bold text-xs py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Scale className="w-3.5 h-3.5 text-cyan-800" />
                        <span>แก้วันพิพากษา</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -0.5 แจ้งเตือนตรวจสอบหมายเลขสำนวนซ้ำกัน (หมายเลขคดีดำ, หมายเลขคดีแดง, ส.1, ส.4) */}
      {duplicateCheck.groups.length > 0 && (
        <div className="bg-indigo-50/95 border-2 border-indigo-400 rounded-2xl p-4 sm:p-5 shadow-sm transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-3 border-b border-indigo-200 gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-indigo-950 font-['Prompt'] tabular-nums">
                  แจ้งเตือนตรวจสอบเลขสำนวนซ้ำ: พบ {duplicateCheck.groups.length} รายการซ้ำ ({duplicateCheck.affectedCaseIds.size} สำนวนที่เกี่ยวข้อง)
                </h3>
                <p className="text-xs text-indigo-900/90 mt-0.5 leading-relaxed">
                  ตรวจพบหมายเลขคดีดำ หมายเลขคดีแดง หมายเลข ส.1 หรือหมายเลข ส.4 ซ้ำกันระหว่างสำนวน กรุณาตรวจสอบว่าเป็นการบันทึกซ้ำหรือพิมพ์เลขคลาดเคลื่อน
                </p>
              </div>
            </div>

            {/* Interactive Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-white/90 border border-indigo-200 rounded-xl overflow-x-auto self-start lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDuplicateFieldFilter('all');
                  setShowAllDuplicateGroups(false);
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  duplicateFieldFilter === 'all'
                    ? 'bg-indigo-700 text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-900'
                }`}
              >
                ทั้งหมด ({duplicateCheck.groups.length})
              </button>
              {DUPLICATE_FIELD_ORDER.map((fieldKey) => {
                const count = duplicateCheck.byField[fieldKey].length;
                if (count === 0) return null;
                const meta = DUPLICATE_FIELD_META[fieldKey];
                const isActive = duplicateFieldFilter === fieldKey;
                return (
                  <button
                    key={fieldKey}
                    type="button"
                    onClick={() => {
                      setDuplicateFieldFilter(fieldKey);
                      setShowAllDuplicateGroups(false);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                      isActive
                        ? 'bg-indigo-700 text-white shadow-2xs'
                        : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-900'
                    }`}
                  >
                    {meta.shortLabel} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3.5">
            {visibleDuplicateGroups.map((group) => {
              const fieldAccentClass =
                group.field === 'redCaseNo'
                  ? 'text-rose-700'
                  : group.field === 'receivedNumberS1'
                  ? 'text-blue-700'
                  : group.field === 'filingNumberS4'
                  ? 'text-emerald-700'
                  : 'text-indigo-800';

              return (
                <div
                  key={group.key}
                  className="rounded-xl border border-indigo-200 bg-white p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-indigo-400 transition"
                >
                  <div>
                    {/* Group Header (Clean unboxed metadata) */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 flex-wrap">
                          <span className={fieldAccentClass}>{group.fieldLabel}ซ้ำ</span>
                          {group.isAllLinkedSevered && (
                            <>
                              <span className="text-slate-300" aria-hidden="true">·</span>
                              <span className="text-purple-700">เชื่อมโยงแยกฟ้อง</span>
                            </>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 text-sm font-['Prompt'] tabular-nums truncate mt-0.5" title={group.displayValue}>
                          {group.shortLabel}: {group.displayValue}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-indigo-800 tabular-nums shrink-0 whitespace-nowrap">
                        ซ้ำ {group.cases.length} สำนวน
                      </span>
                    </div>

                    {/* Matching Cases List */}
                    <div className="divide-y divide-slate-100 mt-1">
                      {group.cases.map((caseItem) => (
                        <div key={caseItem.id} className="py-2 first:pt-1.5 last:pb-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-bold text-slate-900 font-['Prompt'] tabular-nums truncate">
                              ดำ {caseItem.blackCaseNo || '-'}
                              {caseItem.redCaseNo ? ` / แดง ${caseItem.redCaseNo}` : ''}
                            </div>
                            <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                              {caseItem.filingDate ? formatThaiDate(caseItem.filingDate, { short: true }) : '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 tabular-nums flex-wrap">
                            <span>
                              <span className="font-semibold text-blue-800">ส.1:</span>{' '}
                              <span className={caseItem.receivedNumberS1?.trim() ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                                {caseItem.receivedNumberS1?.trim() || '-'}
                              </span>
                            </span>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span>
                              <span className="font-semibold text-emerald-800">ส.4:</span>{' '}
                              <span className={caseItem.filingNumberS4?.trim() ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                                {caseItem.filingNumberS4?.trim() || '-'}
                              </span>
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 truncate">
                            จำเลย: <span className="font-medium text-slate-800">{caseItem.defendant || '-'}</span>
                            {caseItem.responsiblePerson ? ` · ${caseItem.responsiblePerson}` : ''}
                          </div>
                          {(onViewCaseDetail || onEditCase) && (
                            <div className="flex items-center gap-1.5 pt-1">
                              {onViewCaseDetail && (
                                <button
                                  type="button"
                                  onClick={() => onViewCaseDetail(caseItem)}
                                  className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-[11px] py-1 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-indigo-200 cursor-pointer whitespace-nowrap"
                                >
                                  <Eye className="w-3 h-3 shrink-0" />
                                  <span>ดูรายละเอียด</span>
                                </button>
                              )}
                              {onEditCase && (
                                <button
                                  type="button"
                                  onClick={() => onEditCase(caseItem)}
                                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] py-1 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-slate-200 cursor-pointer whitespace-nowrap"
                                >
                                  <Edit3 className="w-3 h-3 shrink-0" />
                                  <span>แก้ไขเลขสำนวน</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalFilteredDuplicateGroups > 6 && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllDuplicateGroups((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-indigo-900 bg-white hover:bg-indigo-100 border border-indigo-300 rounded-xl transition cursor-pointer whitespace-nowrap"
              >
                {showAllDuplicateGroups ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>ย่อรายการ (แสดง 6 รายการแรก)</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>แสดงรายการเลขซ้ำทั้งหมด ({totalFilteredDuplicateGroups} รายการ)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 0. แจ้งเตือนกรณีต้องแยกฟ้องจำเลยที่ปฏิเสธภายใน 7 วัน (ป.วิ.อ. ม.176) */}
      {pendingSeveredAlertCases.length > 0 && (
        <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border-2 border-purple-500/50 transition-all animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-purple-500/40 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/30 text-purple-200 border border-purple-400/50 flex items-center justify-center shadow-md animate-pulse shrink-0">
                <span className="text-xl">✂️</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base sm:text-lg text-white font-['Prompt']">
                    เตือนต้องแยกฟ้องจำเลยที่ปฏิเสธ (ภายใน 7 หรือ 15 วัน): พบ {pendingSeveredAlertCases.length} สำนวน
                  </h3>
                  <span className="bg-purple-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs border border-purple-400/60">
                    ป.วิ.อ. มาตรา 176 วรรคสอง
                  </span>
                </div>
                <p className="text-xs text-purple-200 mt-0.5">
                  คดีที่มีจำเลยหลายคน โดยจำเลยบางคนรับสารภาพและบางคนให้การปฏิเสธ ศาลมีคำสั่งให้พนักงานอัยการแยกฟ้องจำเลยที่ปฏิเสธภายในกำหนด (7 วัน หรือ 15 วัน)
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3.5">
            {pendingSeveredAlertCases.map(({ caseItem, alertInfo }) => {
              const isOverdue = alertInfo.status === 'overdue';
              const isDueToday = alertInfo.status === 'due_today';

              return (
                <div
                  key={caseItem.id}
                  className="rounded-xl p-3.5 border border-purple-400/40 bg-slate-800/90 text-white shadow-xs flex flex-col justify-between transition hover:shadow-lg hover:border-purple-300"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-amber-300 text-sm font-['Prompt']">
                          ดำ {caseItem.blackCaseNo}
                        </span>
                        {caseItem.redCaseNo && (
                          <span className="text-xs text-rose-300 font-semibold bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                            แดง {caseItem.redCaseNo}
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        isOverdue
                          ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                          : isDueToday
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold animate-pulse'
                          : 'bg-purple-500/40 text-purple-200 border-purple-400'
                      }`}>
                        {alertInfo.alertBadgeText}
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5 text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60 mb-3">
                      <div className="flex items-center gap-2 text-[11px] text-slate-300 tabular-nums flex-wrap pb-1 border-b border-slate-700/40">
                        <span>
                          <span className="font-semibold text-blue-300">ส.1:</span>{' '}
                          <span className={caseItem.receivedNumberS1?.trim() ? 'font-semibold text-white' : 'text-slate-500'}>
                            {caseItem.receivedNumberS1?.trim() || '-'}
                          </span>
                        </span>
                        <span className="text-slate-600" aria-hidden="true">·</span>
                        <span>
                          <span className="font-semibold text-emerald-300">ส.4:</span>{' '}
                          <span className={caseItem.filingNumberS4?.trim() ? 'font-semibold text-white' : 'text-slate-500'}>
                            {caseItem.filingNumberS4?.trim() || '-'}
                          </span>
                        </span>
                      </div>
                      {caseItem.confessedDefendants && (
                        <div className="flex items-start gap-1">
                          <span className="text-yellow-400 font-semibold shrink-0">🟡 รับสารภาพ:</span>
                          <span className="text-slate-200 font-medium truncate">{caseItem.confessedDefendants}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-1">
                        <span className="text-orange-400 font-bold shrink-0">🟠 ปฏิเสธ (ต้องแยกฟ้อง):</span>
                        <span className="text-white font-bold truncate">{caseItem.deniedDefendants || caseItem.defendant}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-700/40 text-slate-400">
                        <span>ศาลสั่ง: {formatThaiDate(alertInfo.orderDate)}</span>
                        <span className="text-rose-300 font-semibold">ครบ {caseItem.severedFilingDaysLimit || 7} วัน: {formatThaiDate(alertInfo.deadlineDate)}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <span>👔 เจ้าของสำนวน: {caseItem.responsiblePerson || 'รอกำหนด'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-700/60 flex-wrap">
                    {onViewCaseDetail && (
                      <button
                        type="button"
                        onClick={() => onViewCaseDetail(caseItem)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg shadow-xs transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                        title="ดูรายละเอียดสำนวนทั้งหมด"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>ดูรายละเอียด</span>
                      </button>
                    )}
                    {onMarkSeveredCompleted && (
                      <button
                        type="button"
                        onClick={() => onMarkSeveredCompleted(caseItem)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg shadow-xs transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap"
                        title="บันทึกว่ายื่นแยกฟ้องเสร็จเรียบร้อยแล้ว"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>ยื่นแยกฟ้องแล้ว</span>
                      </button>
                    )}
                    {onCreateSeveredCase && (
                      <button
                        type="button"
                        onClick={() => onCreateSeveredCase(caseItem)}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg shadow-xs transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap"
                        title="เปิดฟอร์มสร้างสำนวนแยกฟ้องที่เชื่อมโยงกับคดีนี้ทันที"
                      >
                        <span>➕ สร้างสำนวนแยกฟ้อง</span>
                      </button>
                    )}
                    {onEditCase && (
                      <button
                        type="button"
                        onClick={() => onEditCase(caseItem)}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-1.5 px-2 rounded-lg transition cursor-pointer"
                        title="แก้ไขรายละเอียดสำนวน"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 0.1 แจ้งเตือนกรณีมีคำพิพากษาแล้วแต่ยังไม่ได้กรอกวันพิพากษา (ครบกำหนด 15 วัน) เพื่อป้องกันการลืมลงบันทึกในระบบ */}
      {pendingMissingJudgmentAlertCases.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950 via-stone-900 to-amber-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border-2 border-amber-500/60 transition-all animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-amber-500/40 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/30 text-amber-300 border border-amber-400/50 flex items-center justify-center shadow-md animate-pulse shrink-0">
                <Scale className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base sm:text-lg text-white font-['Prompt']">
                    เตือนค้างบันทึกวันพิพากษา (ครบกำหนด 15 วัน): พบ {pendingMissingJudgmentAlertCases.length} สำนวน
                  </h3>
                  <span className="bg-amber-500 text-stone-950 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs border border-amber-300">
                    ครบ 15 วัน
                  </span>
                </div>
                <p className="text-xs text-amber-200 mt-0.5">
                  คดีที่มีคำพิพากษาแล้ว (เช่น จำเลยรับสารภาพ, มีเลขคดีแดง หรือผ่านวันนัดพิพากษา) แต่ยังไม่มีการลงวันพิพากษาในระบบ เพื่อป้องกันการลืมลงบันทึก
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3.5">
            {pendingMissingJudgmentAlertCases.map(({ caseItem, alertInfo }) => {
              const isOver30Days = alertInfo.daysElapsed >= 30;

              return (
                <div
                  key={caseItem.id}
                  className="rounded-xl p-3.5 border border-amber-400/40 bg-stone-900/90 text-white shadow-xs flex flex-col justify-between transition hover:shadow-lg hover:border-amber-300"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-amber-300 text-sm font-['Prompt']">
                          ดำ {caseItem.blackCaseNo}
                        </span>
                        {caseItem.redCaseNo && caseItem.redCaseNo !== 'ยังไม่มีเลขแดง' && (
                          <span className="text-xs text-rose-300 font-semibold bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                            แดง {caseItem.redCaseNo}
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        isOver30Days
                          ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                          : 'bg-amber-500 text-stone-950 border-amber-300 font-extrabold animate-pulse'
                      }`}>
                        ค้าง {alertInfo.daysElapsed} วัน {alertInfo.daysOverdue > 0 ? `(เกิน ${alertInfo.daysOverdue} วัน)` : ''}
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5 text-stone-300 bg-stone-950/70 p-2.5 rounded-lg border border-amber-900/40 mb-3">
                      <div className="flex items-center gap-2 text-[11px] text-stone-300 tabular-nums flex-wrap pb-1 border-b border-stone-800">
                        <span>
                          <span className="font-semibold text-blue-300">ส.1:</span>{' '}
                          <span className={caseItem.receivedNumberS1?.trim() ? 'font-semibold text-white' : 'text-stone-500'}>
                            {caseItem.receivedNumberS1?.trim() || '-'}
                          </span>
                        </span>
                        <span className="text-stone-600" aria-hidden="true">·</span>
                        <span>
                          <span className="font-semibold text-emerald-300">ส.4:</span>{' '}
                          <span className={caseItem.filingNumberS4?.trim() ? 'font-semibold text-white' : 'text-stone-500'}>
                            {caseItem.filingNumberS4?.trim() || '-'}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-amber-400 font-semibold shrink-0">สถานะ:</span>
                        <span className="text-amber-200 font-medium">{alertInfo.reason}</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-stone-400 shrink-0">จำเลย:</span>
                        <span className="text-white font-medium truncate">{caseItem.defendant || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-800">
                        <span>อัยการ: {caseItem.responsiblePerson || caseItem.prosecutorName || 'รอกำหนด'}</span>
                        {alertInfo.baseDate && (
                          <span>วันที่ฟ้อง: {formatThaiDate(alertInfo.baseDate, { short: true })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-stone-800">
                    {onViewCaseDetail && (
                      <button
                        type="button"
                        onClick={() => onViewCaseDetail(caseItem)}
                        className="bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-500/40 text-xs font-bold py-1.5 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        title="ดูรายละเอียดสำนวนทั้งหมด"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>ดูรายละเอียด</span>
                      </button>
                    )}
                    {onRecordJudgment && (
                      <button
                        type="button"
                        onClick={() => onRecordJudgment(caseItem)}
                        className="flex-1 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold py-1.5 px-2.5 rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
                        title="คลิกเพื่อบันทึกวันพิพากษาและเริ่มคุมระยะเวลาอุทธรณ์"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>ลงบันทึกวันพิพากษา</span>
                      </button>
                    )}
                    {onEditCase && (
                      <button
                        type="button"
                        onClick={() => onEditCase(caseItem)}
                        className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs py-1.5 px-2 rounded-lg transition cursor-pointer"
                        title="แก้ไขรายละเอียดสำนวน"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 0. แจ้งเตือนเฉพาะกรณีเจ้าของสำนวนเป็น อ.กุลชาติ: หากกดเสร็จสิ้นแล้ว ก็ยังให้เตือนตอนก่อนครบอุทธรณ์ 5 วันอยู่ */}
      {kunchartPendingCases.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 border-2 border-purple-300 rounded-2xl p-4 sm:p-5 shadow-sm transition-all animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-purple-200/80 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shadow-md shadow-purple-600/20 animate-pulse flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base sm:text-lg text-purple-950 font-['Prompt']">
                    เตือนเฉพาะสำนวน อ.กุลชาติ: พบ {kunchartPendingCases.length} สำนวนเตือนก่อนครบอุทธรณ์ 5 วัน
                  </h3>
                  <span className="bg-purple-700 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                    เสร็จสิ้นแล้ว แต่รอการยืนยันไม่อุทธรณ์
                  </span>
                </div>
                <p className="text-xs text-purple-900 mt-0.5">
                  สำนวนของ <strong>อ.กุลชาติ</strong> แม้กดเสร็จสิ้นแล้ว ระบบจะยังคงแจ้งเตือนตอนก่อนครบอุทธรณ์ 5 วัน จนกว่าจะกดยืนยันว่า <strong>"สำนวนไม่อุทธรณ์แล้ว"</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3.5">
            {kunchartPendingCases.map((caseItem) => {
              const daysLeft = getDaysRemaining(caseItem);
              const isOverdue = daysLeft < 0;
              const effectiveDeadline = caseItem.extendedDeadline || caseItem.appealDeadline;

              return (
                <div
                  key={caseItem.id}
                  className="rounded-xl p-3.5 border border-purple-300 bg-white shadow-xs flex flex-col justify-between transition hover:shadow-md"
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
                        <span className="text-[10px] text-purple-950 bg-purple-100 font-bold px-2 py-0.5 rounded border border-purple-300" title="อัยการเจ้าของสำนวน">
                          👔 {caseItem.responsiblePerson || caseItem.prosecutorName || 'อ.กุลชาติ'}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isOverdue
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : daysLeft <= 3
                            ? 'bg-purple-100 text-purple-900 border border-purple-300 animate-pulse'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {isOverdue ? `เลยกำหนด ${Math.abs(daysLeft)} วัน` : `เหลืออีก ${daysLeft} วัน`}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 space-y-1 mb-2.5">
                      <div className="font-medium text-slate-800 truncate" title={caseItem.court}>
                        📍 {caseItem.court}
                      </div>
                      <div className="text-slate-600 truncate text-[11px]">
                        <span className="font-medium text-slate-700">จำเลย:</span> {caseItem.defendant}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 tabular-nums flex-wrap">
                        <span>
                          <span className="font-semibold text-blue-800">ส.1:</span>{' '}
                          <span className={caseItem.receivedNumberS1?.trim() ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                            {caseItem.receivedNumberS1?.trim() || '-'}
                          </span>
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span>
                          <span className="font-semibold text-emerald-800">ส.4:</span>{' '}
                          <span className={caseItem.filingNumberS4?.trim() ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                            {caseItem.filingNumberS4?.trim() || '-'}
                          </span>
                        </span>
                      </div>
                      <div className="bg-purple-50/90 border border-purple-200 rounded-lg p-2 text-[11px] text-purple-950 space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-purple-700 font-medium">วันครบอุทธรณ์:</span>
                          <span className="font-bold text-rose-700">{formatThaiDate(effectiveDeadline)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700">สถานะปัจจุบัน:</span>
                          <span className="text-emerald-700 font-semibold">กดเสร็จสิ้นแล้ว</span>
                        </div>
                        <div className="text-[10px] text-purple-800 pt-0.5">
                          ⚠️ อยู่ในเกณฑ์เตือนก่อนครบอุทธรณ์ 5 วัน
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-purple-100 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`ยืนยันว่าสำนวน ${caseItem.blackCaseNo} ไม่อุทธรณ์แล้วใช่หรือไม่?\n\nเมื่อยืนยันแล้ว ระบบจะหยุดการแจ้งเตือนสำหรับสำนวนนี้ทันที`)) {
                          onConfirmNoAppeal?.(caseItem.id);
                        }
                      }}
                      className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
                      title="กดยืนยันว่าสำนวนไม่อุทธรณ์แล้ว เพื่อหยุดการแจ้งเตือนเตือนภัยเฉพาะ อ.กุลชาติ"
                    >
                      <CheckCircle className="w-4 h-4 text-purple-200" />
                      <span>✓ ยืนยันว่าสำนวนไม่อุทธรณ์แล้ว (หยุดเตือน)</span>
                    </button>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      {onViewCaseDetail && (
                        <button
                          type="button"
                          onClick={() => onViewCaseDetail(caseItem)}
                          className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-indigo-200 cursor-pointer whitespace-nowrap"
                          title="ดูรายละเอียดสำนวนทั้งหมด"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ดูรายละเอียด</span>
                        </button>
                      )}
                      {onEditCase && (
                        <button
                          type="button"
                          onClick={() => onEditCase(caseItem)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-slate-200 cursor-pointer whitespace-nowrap"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>แก้ไข</span>
                        </button>
                      )}
                      {onExtendDeadline && (
                        <button
                          type="button"
                          onClick={() => onExtendDeadline(caseItem)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-amber-200 cursor-pointer whitespace-nowrap"
                        >
                          <Calendar className="w-3 h-3 text-amber-700" />
                          <span>ขยายเวลา</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 0.9 แจ้งเตือนสำนวนที่ยังไม่เลือกสถานะ (เตือนทุกๆ 5 วัน ให้ตรวจสอบว่ามีจำเลยให้การอย่างไร สถานะไหน) */}
      {pendingUnspecifiedAlertCases.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-red-50 to-rose-100/90 border-2 border-rose-400 rounded-2xl p-4 sm:p-5 shadow-sm transition-all animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-rose-200/90 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/30 animate-pulse flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base sm:text-lg text-rose-950 font-['Prompt']">
                    แจ้งเตือนสำนวนยังไม่เลือกสถานะ: พบ {pendingUnspecifiedAlertCases.length} สำนวนที่ต้องตรวจสอบคำให้การ
                  </h3>
                  <span className="bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    เตือนทุก 5 วัน
                  </span>
                </div>
                <p className="text-xs text-rose-800 mt-0.5">
                  สำนวนที่คุมการฟ้องไว้โดยยังไม่ระบุสถานะ จะได้รับการแจ้งเตือนทุกๆ 5 วัน เพื่อให้ตรวจสอบว่า <strong>จำเลยให้การอย่างไร</strong> (รับสารภาพ / ปฏิเสธ) หรือ <strong>อยู่ในสถานะไหน</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-3.5">
            {pendingUnspecifiedAlertCases.map(({ caseItem, alertInfo }) => {
              const changeStatus = (st: 'confessed' | 'denied' | 'requisition') => {
                if (onQuickChangePleaStatus) {
                  onQuickChangePleaStatus(caseItem, st);
                } else if (onQuickChangeRequisitionStatus && (st === 'confessed' || st === 'denied')) {
                  onQuickChangeRequisitionStatus(caseItem, st);
                }
              };

              return (
                <div
                  key={caseItem.id}
                  className="rounded-xl p-3.5 border-2 border-rose-300 bg-white shadow-xs flex flex-col justify-between transition hover:shadow-md"
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
                      <span className="text-[10px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-full shrink-0 shadow-2xs">
                        🚨 รอบที่ {alertInfo.cycle}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 space-y-1 mb-2.5">
                      <div className="font-medium text-slate-800 truncate" title={caseItem.court}>
                        📍 {caseItem.court}
                      </div>
                      <div className="text-slate-600 truncate text-[11px]">
                        <span className="font-medium text-slate-700">จำเลย:</span> {caseItem.defendant}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 tabular-nums flex-wrap">
                        <span>
                          <span className="font-semibold text-blue-800">ส.1:</span>{' '}
                          <span className={caseItem.receivedNumberS1?.trim() ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                            {caseItem.receivedNumberS1?.trim() || '-'}
                          </span>
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span>
                          <span className="font-semibold text-emerald-800">ส.4:</span>{' '}
                          <span className={caseItem.filingNumberS4?.trim() ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                            {caseItem.filingNumberS4?.trim() || '-'}
                          </span>
                        </span>
                      </div>
                      {caseItem.filingDate && (
                        <div className="text-slate-500 text-[11px]">
                          📅 วันที่ยื่นฟ้อง: {formatThaiDate(caseItem.filingDate)}
                        </div>
                      )}
                    </div>

                    {/* กล่องข้อความแจ้งเตือน 5 วัน */}
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-[11px] text-rose-950 space-y-1 mb-3">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-rose-900">
                          {alertInfo.badgeLabel}
                        </span>
                        <span className="text-[10px] text-rose-600 font-medium">
                          {alertInfo.isExactIntervalToday ? '🔥 ครบ 5 วันพอดีวันนี้' : `รอบถัดไปอีก ${alertInfo.daysUntilNextAlert} วัน`}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-rose-800 leading-snug">
                        ⚠️ <strong>คำแนะนำ:</strong> กรุณาตรวจสอบว่าจำเลยให้การอย่างไร และเลือกสถานะของสำนวนคดี
                      </div>
                    </div>
                  </div>

                  {/* Quick Change Status Buttons */}
                  <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-600">เลือกสถานะคำให้การทันที:</div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => changeStatus('confessed')}
                        className="bg-yellow-200 hover:bg-yellow-300 text-yellow-950 border border-yellow-400 font-bold text-[10px] py-1.5 px-1 rounded-lg flex items-center justify-center gap-0.5 transition shadow-2xs cursor-pointer active:scale-95"
                        title="ระบุว่าจำเลยรับสารภาพ (แถวสีเหลือง)"
                      >
                        <span>🟡 รับสารภาพ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => changeStatus('denied')}
                        className="bg-orange-200 hover:bg-orange-300 text-orange-950 border border-orange-400 font-bold text-[10px] py-1.5 px-1 rounded-lg flex items-center justify-center gap-0.5 transition shadow-2xs cursor-pointer active:scale-95"
                        title="ระบุว่าจำเลยปฏิเสธ (คุ้มครองสิทธิ แถวสีส้ม)"
                      >
                        <span>🟠 ปฏิเสธ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => changeStatus('requisition')}
                        className="bg-emerald-200 hover:bg-emerald-300 text-emerald-950 border border-emerald-400 font-bold text-[10px] py-1.5 px-1 rounded-lg flex items-center justify-center gap-0.5 transition shadow-2xs cursor-pointer active:scale-95"
                        title="ระบุว่าเป็นสำนวนเบิกฟ้อง (แถวสีเขียว)"
                      >
                        <span>🟢 เบิกฟ้อง</span>
                      </button>
                    </div>
                    {(onViewCaseDetail || onEditCase) && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        {onViewCaseDetail && (
                          <button
                            type="button"
                            onClick={() => onViewCaseDetail(caseItem)}
                            className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-indigo-200 cursor-pointer whitespace-nowrap"
                            title="ดูรายละเอียดสำนวนทั้งหมด"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>ดูรายละเอียด</span>
                          </button>
                        )}
                        {onEditCase && (
                          <button
                            type="button"
                            onClick={() => onEditCase(caseItem)}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-slate-200 cursor-pointer whitespace-nowrap"
                            title="เปิดแบบฟอร์มเพื่อแก้ไขรายละเอียดสำนวน"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>แก้ไขสำนวน</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                        {caseItem.isSubmittedToDuty && (
                          <span className="text-[10px] text-blue-900 bg-blue-100 font-bold px-1.5 py-0.5 rounded border border-blue-300 flex items-center gap-1 shadow-2xs" title="สำนวนนี้เสนอเวรชี้แล้ว (ยังคงคุมระยะเวลาอุทธรณ์)">
                            <Send className="w-2.5 h-2.5 text-blue-700" />
                            <span>เสนอเวรชี้แล้ว{caseItem.submittedToDutyOfficer ? `: ${caseItem.submittedToDutyOfficer}` : ''}</span>
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
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 tabular-nums flex-wrap">
                        <span>
                          <span className="font-semibold text-blue-800">ส.1:</span>{' '}
                          <span className={caseItem.receivedNumberS1?.trim() ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                            {caseItem.receivedNumberS1?.trim() || '-'}
                          </span>
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span>
                          <span className="font-semibold text-emerald-800">ส.4:</span>{' '}
                          <span className={caseItem.filingNumberS4?.trim() ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                            {caseItem.filingNumberS4?.trim() || '-'}
                          </span>
                        </span>
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
                      {onViewCaseDetail && (
                        <button
                          type="button"
                          onClick={() => onViewCaseDetail(caseItem)}
                          className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-indigo-200 cursor-pointer whitespace-nowrap"
                          title="ดูรายละเอียดสำนวนทั้งหมด"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ดูรายละเอียด</span>
                        </button>
                      )}
                      {onEditCase && (
                        <button
                          type="button"
                          onClick={() => onEditCase(caseItem)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-slate-200 cursor-pointer whitespace-nowrap"
                          title="เปิดแบบฟอร์มเพื่อแก้ไขรายละเอียดสำนวน"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>แก้ไข</span>
                        </button>
                      )}
                      {onMarkComplete && (
                        <button
                          type="button"
                          onClick={() => onMarkComplete(caseItem)}
                          className="flex-1 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition border border-slate-200 cursor-pointer whitespace-nowrap"
                          title="กดเสร็จสิ้นเมื่อดำเนินการเบิกฟ้องเรียบร้อย"
                        >
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>เสร็จสิ้น</span>
                        </button>
                      )}
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
                        {caseItem.isSubmittedToDuty && (
                          <span className="text-[10px] text-blue-900 bg-blue-100 font-bold px-1.5 py-0.5 rounded border border-blue-300 flex items-center gap-1 shadow-2xs" title="สำนวนนี้เสนอเวรชี้แล้ว (ยังคงคุมระยะเวลาอุทธรณ์)">
                            <Send className="w-2.5 h-2.5 text-blue-700" />
                            <span>เสนอเวรชี้แล้ว{caseItem.submittedToDutyOfficer ? `: ${caseItem.submittedToDutyOfficer}` : ''}</span>
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
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 tabular-nums flex-wrap">
                        <span>
                          <span className="font-semibold text-blue-800">ส.1:</span>{' '}
                          <span className={caseItem.receivedNumberS1?.trim() ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                            {caseItem.receivedNumberS1?.trim() || '-'}
                          </span>
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span>
                          <span className="font-semibold text-emerald-800">ส.4:</span>{' '}
                          <span className={caseItem.filingNumberS4?.trim() ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                            {caseItem.filingNumberS4?.trim() || '-'}
                          </span>
                        </span>
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
                  <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      {onViewCaseDetail && (
                        <button
                          type="button"
                          onClick={() => onViewCaseDetail(caseItem)}
                          className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                          title="เปิดดูรายละเอียดสำนวนทั้งหมด"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span>ดูรายละเอียด</span>
                        </button>
                      )}

                      {onMarkComplete && (
                        <button
                          type="button"
                          onClick={() => onMarkComplete(caseItem)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer whitespace-nowrap"
                          title="เมื่อกดแล้ว สำนวนนี้จะไม่แจ้งเตือนอีกต่อไป"
                        >
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>กดเสร็จสิ้นสำนวน</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onExtendDeadline && (
                        <button
                          type="button"
                          onClick={() => onExtendDeadline(caseItem)}
                          className={`flex-1 text-xs py-1.5 px-2.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
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
                      )}

                      {onSyncCalendar && (
                        <button
                          type="button"
                          onClick={() => onSyncCalendar(caseItem)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer shrink-0"
                          title="เพิ่มแจ้งเตือนลง Google Calendar"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {onSendEmailAlert && (
                        <button
                          type="button"
                          onClick={() => onSendEmailAlert(caseItem)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer shrink-0"
                          title="ส่งอีเมลแจ้งเตือนคดีนี้ไปยัง Gmail ทันที"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
