import React, { useEffect } from 'react';
import {
  X,
  Scale,
  Calendar,
  Clock,
  CheckCircle2,
  Edit3,
  ShieldAlert,
  FileText,
  User,
  Users,
  Send,
  ExternalLink,
  History,
  Image as ImageIcon,
  PauseCircle,
  Scissors,
  Truck,
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import {
  formatThaiDate,
  getDaysRemaining,
  getAppealUrgency,
  hasCaseFilingAfterJudgmentAnomaly,
} from '../utils/dateUtils';
import {
  getAppointmentLabel,
  isCaseConfessed,
  isCaseDenied,
  isCaseRequisition,
  isCaseUnspecifiedStage,
} from '../utils/appointmentUtils';
import { CaseNoteHighlight } from './CaseNoteHighlight';

interface CaseDetailModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  onClose: () => void;
  canEdit?: boolean;
  canComplete?: boolean;
  onEditCase?: (caseItem: AppealCase) => void;
  onMarkComplete?: (caseItem: AppealCase) => void;
  onExtendDeadline?: (caseItem: AppealCase) => void;
  onRecordJudgment?: (caseItem: AppealCase) => void;
  onOpenRecheck?: (caseItem: AppealCase) => void;
  onOpenRevisions?: (caseId: string, blackCaseNo: string) => void;
}

const COMPLETION_REASON_LABELS: Record<string, string> = {
  submitted_appellate: 'เสนออัยการศาลสูงแล้ว',
  appealed: 'ยื่นอุทธรณ์แล้ว',
  no_appeal: 'มีคำสั่งไม่อุทธรณ์ / ยุติ',
  finalized: 'คดีถึงที่สุดแล้ว',
  settled: 'คู่ความตกลงยอมความกันได้',
  other: 'อื่นๆ',
};

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  canEdit = false,
  canComplete = false,
  onEditCase,
  onMarkComplete,
  onExtendDeadline,
  onRecordJudgment,
  onOpenRecheck,
  onOpenRevisions,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !caseItem) return null;

  const urgency = getAppealUrgency(caseItem);
  const daysLeft = getDaysRemaining(caseItem);
  const effectiveDeadline = caseItem.extendedDeadline || caseItem.appealDeadline;
  const hasDeadline = Boolean(effectiveDeadline || caseItem.judgmentDate);
  const dateAnomaly = hasCaseFilingAfterJudgmentAnomaly(caseItem);

  const stageLabel = caseItem.isTemporarilyDischarged
    ? 'จำหน่ายคดีชั่วคราว (จำเลยหลบหนี)'
    : caseItem.isSeveredCase
    ? 'สำนวนที่ศาลสั่งแยกฟ้อง'
    : isCaseUnspecifiedStage(caseItem)
    ? 'ยังไม่เลือกสถานะสำนวน'
    : isCaseRequisition(caseItem)
    ? 'สำนวนเบิกฟ้อง (รอผลคำให้การ)'
    : isCaseConfessed(caseItem)
    ? 'จำเลยรับสารภาพ'
    : isCaseDenied(caseItem)
    ? 'จำเลยให้การปฏิเสธ / นัดคุ้มครองสิทธิ'
    : 'อยู่ระหว่างพิจารณา / มีนัดศาล';

  const statusSummary = (() => {
    if (caseItem.isTemporarilyDischarged) {
      return {
        label: 'พักการคุมอุทธรณ์ชั่วคราว (จำหน่ายคดีชั่วคราว)',
        tone: 'bg-slate-700 text-slate-100 border-slate-500',
      };
    }
    if (caseItem.isCompleted) {
      return {
        label: 'ดำเนินการเสร็จสิ้นแล้ว',
        tone: 'bg-emerald-600/25 text-emerald-200 border-emerald-400/50',
      };
    }
    if (urgency === 'overdue') {
      return {
        label: `พ้นกำหนดอุทธรณ์แล้ว ${Math.abs(daysLeft)} วัน`,
        tone: 'bg-rose-600 text-white border-rose-400',
      };
    }
    if (urgency === 'critical') {
      return {
        label: `ด่วนที่สุด · เหลืออีก ${daysLeft} วัน`,
        tone: 'bg-amber-500 text-slate-950 border-amber-300',
      };
    }
    if (urgency === 'warning') {
      return {
        label: `ใกล้ครบกำหนด · เหลืออีก ${daysLeft} วัน`,
        tone: 'bg-yellow-400 text-slate-950 border-yellow-300',
      };
    }
    if (urgency === 'pending_trial') {
      return {
        label: 'ยังไม่มีคำพิพากษา (อยู่ระหว่างพิจารณา)',
        tone: 'bg-sky-500/25 text-sky-200 border-sky-400/50',
      };
    }
    return {
      label: hasDeadline ? `ปกติ · เหลืออีก ${daysLeft} วัน` : 'อยู่ระหว่างติดตามสำนวน',
      tone: 'bg-slate-700 text-slate-100 border-slate-500',
    };
  })();

  const hasPrimaryAppointment = Boolean(
    caseItem.appointmentType && caseItem.appointmentType !== 'none'
  );
  const subsequentAppointments = caseItem.subsequentAppointments || [];
  const hasAppointmentsSection =
    hasPrimaryAppointment ||
    subsequentAppointments.length > 0 ||
    caseItem.isRequisitionCase ||
    Boolean(caseItem.requisitionDate) ||
    caseItem.isTemporarilyDischarged ||
    caseItem.isSeveredCase ||
    caseItem.hasPendingSeveredFiling ||
    Boolean(caseItem.severedNewBlackCaseNo);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-detail-modal-title"
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-start justify-between gap-4 shrink-0 border-b border-slate-800">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Scale className="w-4 h-4 text-amber-400 shrink-0" />
              <span>รายละเอียดสำนวนคดี</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{caseItem.court || '-'}</span>
            </div>
            <h2
              id="case-detail-modal-title"
              className="text-lg sm:text-xl font-bold font-['Prompt'] text-white tracking-tight flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5"
            >
              <span>คดีดำ {caseItem.blackCaseNo}</span>
              {caseItem.redCaseNo && caseItem.redCaseNo !== 'ยังไม่มีเลขแดง' && (
                <span className="text-rose-300 text-base font-semibold">
                  / คดีแดง {caseItem.redCaseNo}
                </span>
              )}
            </h2>
            <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border font-semibold tabular-nums ${statusSummary.tone}`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{statusSummary.label}</span>
              </span>
              <span className="text-slate-300">{stageLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            aria-label="ปิดหน้าต่างรายละเอียดสำนวน"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm text-slate-800">
          {/* Anomaly Warning (Cyan theme matching system anomaly alerts) */}
          {dateAnomaly.isAnomalous && (
            <div className="rounded-xl bg-cyan-950 text-white border-2 border-cyan-400 p-3.5 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-cyan-200 font-['Prompt'] text-sm">
                  พบความผิดปกติของวันที่: วันที่ยื่นฟ้องอยู่หลังวันอ่านคำพิพากษา ({dateAnomaly.daysDifference} วัน)
                </div>
                <p className="text-cyan-100 leading-relaxed">
                  วันที่ยื่นฟ้องที่บันทึกไว้ ({formatThaiDate(caseItem.filingDate)}) เกิดขึ้นหลังวันพิพากษา ({formatThaiDate(caseItem.judgmentDate)}) กรุณาตรวจสอบและแก้ไขให้ถูกต้อง
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Core Identifiers & Prosecutors */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 mb-2.5 font-['Prompt'] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>ข้อมูลสารบบและผู้รับผิดชอบ</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 border-y border-slate-200 py-3 text-xs sm:text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-500 shrink-0">วันที่ยื่นฟ้อง</span>
                <span className="font-semibold text-slate-900 tabular-nums text-right">
                  {formatThaiDate(caseItem.filingDate)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-500 shrink-0">ประเภทคดี</span>
                <span className="font-semibold text-slate-900 text-right">
                  {caseItem.caseType || '-'}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-500 shrink-0">เลขรับ ส.1</span>
                <span className="font-semibold text-slate-900 tabular-nums text-right">
                  {caseItem.receivedNumberS1 || '-'}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-500 shrink-0">เลขฟ้อง ส.4</span>
                <span className="font-semibold text-slate-900 tabular-nums text-right">
                  {caseItem.filingNumberS4 || '-'}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-500 shrink-0">อัยการเจ้าของสำนวน</span>
                <span className="font-semibold text-indigo-900 text-right">
                  {caseItem.responsiblePerson || 'รอกำหนด'}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-500 shrink-0">อัยการเวรชี้</span>
                <span className="font-semibold text-slate-900 text-right">
                  {caseItem.prosecutorName || '-'}
                </span>
              </div>
              <div className="sm:col-span-2 flex items-baseline justify-between gap-3 pt-1.5 border-t border-slate-100">
                <span className="text-slate-500 shrink-0">สถานะเสนอเวรชี้</span>
                <span className="font-semibold text-right">
                  {caseItem.isSubmittedToDuty ? (
                    <span className="text-blue-700 inline-flex items-center gap-1">
                      <Send className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        เสนอเวรชี้แล้ว
                        {caseItem.submittedToDutyOfficer ? ` (${caseItem.submittedToDutyOfficer})` : ''}
                        {caseItem.submittedToDutyDate ? ` · ${formatThaiDate(caseItem.submittedToDutyDate)}` : ''}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-500">ยังไม่เสนอเวรชี้</span>
                  )}
                </span>
              </div>
              {caseItem.submittedToDutyNotes && (
                <div className="sm:col-span-2 text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span className="font-semibold">หมายเหตุเสนอเวรชี้: </span>
                  <span>{caseItem.submittedToDutyNotes}</span>
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Parties */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 mb-2.5 font-['Prompt'] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>คู่ความในคดี</span>
            </h3>
            <div className="space-y-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                <span className="text-slate-500 sm:w-28 shrink-0 font-medium">โจทก์</span>
                <span className="text-slate-900 font-semibold">{caseItem.plaintiff || '-'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 pt-2 border-t border-slate-200/80">
                <span className="text-slate-500 sm:w-28 shrink-0 font-medium">จำเลย</span>
                <span className="text-slate-900 font-semibold break-words">{caseItem.defendant || '-'}</span>
              </div>
              {caseItem.confessedDefendants && (
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 pt-2 border-t border-slate-200/80">
                  <span className="text-amber-700 sm:w-28 shrink-0 font-semibold">จำเลยรับสารภาพ</span>
                  <span className="text-slate-900">{caseItem.confessedDefendants}</span>
                </div>
              )}
              {caseItem.deniedDefendants && (
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 pt-2 border-t border-slate-200/80">
                  <span className="text-orange-700 sm:w-28 shrink-0 font-semibold">จำเลยปฏิเสธ</span>
                  <span className="text-slate-900 font-semibold">{caseItem.deniedDefendants}</span>
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Judgment & 1-Month Appeal Period */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 mb-2.5 font-['Prompt'] flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              <span>คำพิพากษาและกำหนดระยะเวลาอุทธรณ์ 1 เดือน</span>
            </h3>
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
                <div>
                  <div className="text-xs text-slate-500">วันอ่านคำพิพากษา</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {caseItem.judgmentDate ? formatThaiDate(caseItem.judgmentDate) : 'ยังไม่มีคำพิพากษา'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">ครบกำหนดอุทธรณ์ 1 เดือน</div>
                  <div className="font-bold text-rose-700 mt-0.5">
                    {caseItem.appealDeadline ? formatThaiDate(caseItem.appealDeadline) : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">
                    {caseItem.extendedDeadline
                      ? `ขยายเวลา (ครั้งที่ ${caseItem.extensionCount || 1})`
                      : 'คงเหลือเวลาอุทธรณ์'}
                  </div>
                  <div className="font-bold mt-0.5">
                    {caseItem.extendedDeadline ? (
                      <span className="text-amber-700">
                        {formatThaiDate(caseItem.extendedDeadline)}
                      </span>
                    ) : caseItem.isCompleted ? (
                      <span className="text-emerald-700">เสร็จสิ้นแล้ว</span>
                    ) : hasDeadline ? (
                      <span
                        className={
                          daysLeft < 0
                            ? 'text-rose-700'
                            : daysLeft <= 3
                            ? 'text-amber-700'
                            : 'text-slate-900'
                        }
                      >
                        {daysLeft < 0
                          ? `เกินกำหนด ${Math.abs(daysLeft)} วัน`
                          : daysLeft === 0
                          ? 'ครบกำหนดวันนี้'
                          : `เหลืออีก ${daysLeft} วัน`}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                </div>
              </div>

              {caseItem.judgmentOutcome && (
                <div className="pt-2.5 border-t border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">ผลคำพิพากษา / คำสั่งโดยย่อ</div>
                  <div className="text-slate-900 font-medium leading-relaxed whitespace-pre-wrap break-words">
                    {caseItem.judgmentOutcome}
                  </div>
                </div>
              )}

              {caseItem.fullJudgmentText && (
                <div className="pt-2.5 border-t border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">เนื้อหาคำพิพากษาฉบับเต็ม</div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {caseItem.fullJudgmentText}
                  </div>
                </div>
              )}

              {(caseItem.judgmentPhotoUrl || caseItem.googleDocUrl) && (
                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                  {caseItem.judgmentPhotoUrl && onOpenRecheck && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenRecheck(caseItem);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                      <span>เปิดดูภาพถ่ายคำพิพากษา / ตรวจทาน</span>
                    </button>
                  )}
                  {caseItem.googleDocUrl && (
                    <a
                      href={caseItem.googleDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold transition whitespace-nowrap shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิดเอกสาร Google Docs</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Section 4: Appointments / Special Status */}
          {hasAppointmentsSection && (
            <section>
              <h3 className="text-xs font-bold text-slate-500 mb-2.5 font-['Prompt'] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>กำหนดวันนัดศาลและสถานะพิเศษ</span>
              </h3>
              <div className="space-y-2.5 text-xs sm:text-sm">
                {caseItem.isTemporarilyDischarged && (
                  <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <PauseCircle className="w-4 h-4 text-slate-600" />
                      <span>จำหน่ายคดีชั่วคราว (จำเลยหลบหนี)</span>
                    </div>
                    <div className="text-xs text-slate-700 space-y-0.5 tabular-nums">
                      {caseItem.temporaryDischargeDate && (
                        <div>วันที่สั่งจำหน่ายชั่วคราว: {formatThaiDate(caseItem.temporaryDischargeDate)}</div>
                      )}
                      {caseItem.arrestWarrantNo && (
                        <div>หมายจับเลขที่: {caseItem.arrestWarrantNo}</div>
                      )}
                      {caseItem.temporaryDischargeReason && (
                        <div>เหตุผล: {caseItem.temporaryDischargeReason}</div>
                      )}
                      {caseItem.temporaryDischargeNotes && (
                        <div>หมายเหตุ: {caseItem.temporaryDischargeNotes}</div>
                      )}
                    </div>
                  </div>
                )}

                {(caseItem.isRequisitionCase || caseItem.requisitionDate) && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-3 space-y-1">
                    <div className="font-bold text-orange-950 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-orange-600" />
                      <span>ข้อมูลสำนวนเบิกฟ้อง</span>
                    </div>
                    <div className="text-xs text-orange-900 space-y-0.5 tabular-nums">
                      {caseItem.requisitionDate && (
                        <div>วันนัดเบิกฟ้อง: {formatThaiDate(caseItem.requisitionDate)}</div>
                      )}
                      {caseItem.requisitionNotes && (
                        <div>รายละเอียด: {caseItem.requisitionNotes}</div>
                      )}
                    </div>
                  </div>
                )}

                {(caseItem.isSeveredCase || caseItem.hasPendingSeveredFiling || caseItem.severedNewBlackCaseNo) && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3 space-y-1">
                    <div className="font-bold text-purple-950 flex items-center gap-1.5">
                      <Scissors className="w-4 h-4 text-purple-600" />
                      <span>ข้อมูลการแยกฟ้อง</span>
                    </div>
                    <div className="text-xs text-purple-900 space-y-0.5 tabular-nums">
                      {caseItem.originalBlackCaseNo && (
                        <div>แยกฟ้องจากคดีเดิม: ดำ {caseItem.originalBlackCaseNo}{caseItem.originalRedCaseNo ? ` / แดง ${caseItem.originalRedCaseNo}` : ''}</div>
                      )}
                      {(caseItem.severedFilingOrderDate || caseItem.severedOrderDate) && (
                        <div>วันที่ศาลสั่งแยกฟ้อง: {formatThaiDate(caseItem.severedFilingOrderDate || caseItem.severedOrderDate)}</div>
                      )}
                      {(caseItem.severedFilingDeadline || caseItem.severedDeadlineDate) && (
                        <div>กำหนดเวลายื่นแยกฟ้อง: {formatThaiDate(caseItem.severedFilingDeadline || caseItem.severedDeadlineDate)}</div>
                      )}
                      {caseItem.severedNewBlackCaseNo && (
                        <div>เลขคดีดำสำนวนแยกฟ้องใหม่: {caseItem.severedNewBlackCaseNo}</div>
                      )}
                      {caseItem.severedNotes && (
                        <div>รายละเอียด: {caseItem.severedNotes}</div>
                      )}
                    </div>
                  </div>
                )}

                {hasPrimaryAppointment && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 space-y-1">
                    <div className="font-bold text-indigo-950">
                      นัดหลัก: {getAppointmentLabel(caseItem.appointmentType, caseItem.appointmentTypeName)}
                    </div>
                    <div className="text-xs text-indigo-900 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                      {caseItem.appointmentDate && (
                        <span>วันที่: {formatThaiDate(caseItem.appointmentDate)}</span>
                      )}
                      {caseItem.appointmentTime && <span>เวลา: {caseItem.appointmentTime}</span>}
                      {caseItem.appointmentCourtRoom && (
                        <span>ห้องพิจารณา: {caseItem.appointmentCourtRoom}</span>
                      )}
                    </div>
                    {caseItem.appointmentNotes && (
                      <div className="text-xs text-indigo-900 pt-0.5">
                        หมายเหตุนัด: {caseItem.appointmentNotes}
                      </div>
                    )}
                  </div>
                )}

                {subsequentAppointments.length > 0 && (
                  <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-700">
                      กำหนดนัดต่อเนื่อง ({subsequentAppointments.length} นัด)
                    </div>
                    <div className="divide-y divide-slate-100">
                      {subsequentAppointments.map((appt) => (
                        <div key={appt.id} className="py-1.5 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div className="font-semibold text-slate-900">
                            {getAppointmentLabel(appt.type, appt.typeName)}
                            {appt.notes ? <span className="font-normal text-slate-600"> · {appt.notes}</span> : null}
                          </div>
                          <div className="text-slate-600 tabular-nums shrink-0">
                            {formatThaiDate(appt.date)}
                            {appt.time ? ` · ${appt.time}` : ''}
                            {appt.courtRoom ? ` · ${appt.courtRoom}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 5: Highlighted Notes */}
          {caseItem.notes && caseItem.notes.trim() !== '' && (
            <section>
              <CaseNoteHighlight notes={caseItem.notes} className="w-full" />
            </section>
          )}

          {/* Section 6: Completion Info */}
          {caseItem.isCompleted && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs sm:text-sm space-y-1">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>บันทึกเสร็จสิ้นสำนวนแล้ว</span>
              </div>
              <div className="text-xs text-emerald-900 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                {caseItem.completedDate && (
                  <span>วันที่เสร็จสิ้น: {formatThaiDate(caseItem.completedDate)}</span>
                )}
                {caseItem.completionReason && (
                  <span>
                    เหตุผล: {COMPLETION_REASON_LABELS[caseItem.completionReason] || caseItem.completionReason}
                  </span>
                )}
                {caseItem.isNoAppealConfirmed && (
                  <span className="font-semibold text-emerald-800">· ยืนยันไม่อุทธรณ์แล้ว</span>
                )}
              </div>
            </section>
          )}

          {/* Meta footer timestamp */}
          <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 tabular-nums">
            <span className="inline-flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>อัปเดตล่าสุด: {caseItem.updatedAt ? formatThaiDate(caseItem.updatedAt) : '-'}</span>
            </span>
            {canEdit && onOpenRevisions && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRevisions(caseItem.id, caseItem.blackCaseNo);
                }}
                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-semibold transition cursor-pointer whitespace-nowrap"
              >
                <History className="w-3.5 h-3.5" />
                <span>ดูประวัติการแก้ไขสำนวนนี้</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            ปิดหน้าต่าง
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && onRecordJudgment && !caseItem.judgmentDate && !caseItem.isCompleted && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRecordJudgment(caseItem);
                }}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>บันทึกคำพิพากษา</span>
              </button>
            )}

            {canEdit && onExtendDeadline && !caseItem.isCompleted && hasDeadline && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExtendDeadline(caseItem);
                }}
                className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                <span>{caseItem.extendedDeadline ? 'แก้ไขขยายเวลา' : 'ขยายเวลาอุทธรณ์'}</span>
              </button>
            )}

            {canComplete && onMarkComplete && !caseItem.isCompleted && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onMarkComplete(caseItem);
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>กดเสร็จสิ้นสำนวน</span>
              </button>
            )}

            {canEdit && onEditCase && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditCase(caseItem);
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>แก้ไขข้อมูลสำนวน</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
