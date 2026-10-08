import React, { useState } from 'react';
import {
  Scale,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  Calendar,
  Clock,
  UserCheck,
  Plus,
  FileText,
  Table,
  Check,
  Loader2,
  Truck,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
} from 'lucide-react';
import { AppealCase, MonthlyDutyRoster } from '../types/appeal';
import { formatThaiDate, getTodayString } from '../utils/dateUtils';
import { isCaseConfessed } from '../utils/appointmentUtils';
import { getDutyOfficersForDate } from '../services/dutyService';
import { formatCasesBatchForOfficeTsv, copyTextToClipboard } from '../utils/copyCaseUtils';
import { createDailyDutySummaryDoc } from '../services/docsService';
import { getAccessToken } from '../services/auth';
import { getCaseProcedureCategory } from './DailyFilingByDateView';

export type DailyProcedureFilter =
  | 'all'
  | 'confessed'
  | 'denied_scheduled'
  | 'other_scheduled'
  | 'requisition'
  | 'unknown_pending';

export interface DailyFilingHeroBannerProps {
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  cases: AppealCase[];
  dutyRosters: MonthlyDutyRoster[];
  procedureFilter: DailyProcedureFilter;
  onSelectProcedureFilter: (filter: DailyProcedureFilter) => void;
  canEdit?: boolean;
  onAddNewCaseForDate?: (dateStr: string) => void;
  onExportDailyDoc?: (dateStr: string, cases: AppealCase[]) => void;
  onOpenSheetsExport?: (dateStr: string, cases: AppealCase[]) => void;
  token?: string | null;
  onToast?: (msg: string) => void;
  onOpenDutyPicker?: () => void;
  isLayoutSwapped?: boolean;
  onToggleLayoutSwap?: () => void;
}

export const DailyFilingHeroBanner: React.FC<DailyFilingHeroBannerProps> = ({
  selectedDate,
  onSelectDate,
  cases,
  dutyRosters,
  procedureFilter,
  onSelectProcedureFilter,
  canEdit = false,
  onAddNewCaseForDate,
  onExportDailyDoc,
  onOpenSheetsExport,
  token,
  onToast,
  onOpenDutyPicker,
  isLayoutSwapped,
  onToggleLayoutSwap,
}) => {
  const todayStr = getTodayString();
  const [copiedBatchTsv, setCopiedBatchTsv] = useState(false);
  const [isCreatingDailyMemo, setIsCreatingDailyMemo] = useState(false);

  // Cases filed on selected date
  const casesOnSelectedDate = cases.filter((c) => c.filingDate === selectedDate);
  const total = casesOnSelectedDate.length;

  const confessedCount = casesOnSelectedDate.filter((c) => getCaseProcedureCategory(c) === 'confessed').length;
  const deniedCount = casesOnSelectedDate.filter((c) => getCaseProcedureCategory(c) === 'denied_scheduled').length;

  const requisitionCount = casesOnSelectedDate.filter((c) => {
    return c.isRequisitionCase || c.appointmentType === 'requisition';
  }).length;

  const otherScheduledCount = casesOnSelectedDate.filter((c) => {
    if (c.isRequisitionCase || c.appointmentType === 'requisition') return false;
    return getCaseProcedureCategory(c) === 'other_scheduled';
  }).length;

  const unknownPendingCount = casesOnSelectedDate.filter((c) => {
    if (c.isRequisitionCase || c.appointmentType === 'requisition') return false;
    return getCaseProcedureCategory(c) === 'unknown_pending';
  }).length;

  // Duty officers for selected date
  const officersOnSelectedDate = getDutyOfficersForDate(dutyRosters, selectedDate);
  const unassignedCasesOnSelectedDate = casesOnSelectedDate.filter(
    (c) => !c.prosecutorName && !c.responsiblePerson
  );

  const handleShiftDay = (days: number) => {
    if (!onSelectDate) return;
    try {
      const d = new Date(selectedDate);
      if (isNaN(d.getTime())) {
        onSelectDate(todayStr);
        return;
      }
      d.setDate(d.getDate() + days);
      onSelectDate(d.toISOString().slice(0, 10));
    } catch {
      onSelectDate(todayStr);
    }
  };

  const handleCopyBatchTsv = async () => {
    if (casesOnSelectedDate.length === 0) return;
    const tsv = formatCasesBatchForOfficeTsv(casesOnSelectedDate, true);
    const ok = await copyTextToClipboard(tsv);
    if (ok) {
      setCopiedBatchTsv(true);
      if (onToast)
        onToast(
          `คัดลอกข้อมูล ${casesOnSelectedDate.length} สำนวน สำหรับวางลง Excel / โปรแกรมสารบบ (Ctrl+V) แล้ว`
        );
      setTimeout(() => setCopiedBatchTsv(false), 2000);
    }
  };

  const handleCreateDailyDutyMemo = async () => {
    if (casesOnSelectedDate.length === 0) return;
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      if (onToast) onToast('โปรดเข้าสู่ระบบ Google เพื่อสร้างรายงานสรุป Google Docs');
      return;
    }
    try {
      setIsCreatingDailyMemo(true);
      const dutyNames = officersOnSelectedDate.map((o) => o.name);
      const res = await createDailyDutySummaryDoc(
        currentToken,
        selectedDate,
        casesOnSelectedDate,
        dutyNames
      );
      if (onToast)
        onToast(`สร้างบันทึกข้อความรายงานผลการชี้คดีประจำวันใน Google Docs เรียบร้อยแล้ว`);
      window.open(res.docUrl, '_blank');
    } catch (err: any) {
      console.error('Failed to create daily summary doc:', err);
      if (onToast) onToast(`ไม่สามารถสร้างเอกสารได้: ${err.message || 'เกิดข้อผิดพลาด'}`);
    } finally {
      setIsCreatingDailyMemo(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 relative overflow-hidden mb-5">
      {/* Background glowing flair */}
      <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row with Date & Big Count */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider font-semibold text-indigo-300">
              ข้อมูลประจำวันยื่นฟ้อง
            </span>
            {selectedDate === todayStr && (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                ● วันนี้
              </span>
            )}
            {onToggleLayoutSwap && (
              <button
                type="button"
                onClick={onToggleLayoutSwap}
                className="text-[11px] bg-white/10 hover:bg-white/20 text-indigo-200 border border-white/15 px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                title="สลับตำแหน่ง UI ระหว่างแถบค้นหากับแบนเนอร์สรุปสถิติประจำวัน"
              >
                <ArrowLeftRight className="w-3 h-3 text-amber-300" />
                <span>{isLayoutSwapped ? 'สลับตำแหน่ง UI คืน' : 'สลับตำแหน่ง UI'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <h3 className="text-xl sm:text-2xl font-bold font-['Prompt'] text-white">
              {formatThaiDate(selectedDate, { short: false })}
            </h3>
            {onSelectDate && (
              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5 border border-white/15">
                <button
                  type="button"
                  onClick={() => handleShiftDay(-1)}
                  className="p-1 hover:bg-white/20 rounded transition text-slate-300 hover:text-white"
                  title="วันก่อนหน้า (-1 วัน)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftDay(1)}
                  className="p-1 hover:bg-white/20 rounded transition text-slate-300 hover:text-white"
                  title="วันถัดไป (+1 วัน)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-300 mt-1">
            รวบรวมสำนวนคดีที่ยื่นฟ้องต่อศาลในวันที่ {formatThaiDate(selectedDate, { short: true })}
          </p>
        </div>

        {/* Big Count Badge */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:px-6 flex items-center gap-4 self-start md:self-auto shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/30">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-indigo-200 block">จำนวนคดีที่ฟ้องในวันที่นี้</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-['Prompt'] text-amber-300 tracking-tight">
                {total}
              </span>
              <span className="text-sm font-semibold text-slate-200">สำนวนคดี</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selectable Cards: Procedure Status Summary */}
      <div className="mt-5 pt-4 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              สรุปสถิติผลการดำเนินคดีที่ฟ้องในวันนี้ (คลิกเลือกหัวข้อเพื่อกรองสำนวน)
            </span>
          </div>
          {procedureFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectProcedureFilter('all')}
              className="text-xs text-amber-300 hover:text-white underline underline-offset-2 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>✕ ล้างตัวกรอง (แสดงทั้งหมด {total} สำนวน)</span>
            </button>
          )}
        </div>

        {/* Selectable Procedure Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* 1. ทั้งหมด */}
          <button
            type="button"
            onClick={() => onSelectProcedureFilter('all')}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              procedureFilter === 'all'
                ? 'bg-indigo-600/40 border-indigo-400 text-white ring-2 ring-indigo-400/50 shadow-md'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
            }`}
            title="คลิกเพื่อดูคดีที่ฟ้องในวันนี้ทั้งหมด"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-300">คดีทั้งหมด</span>
              <Scale className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-['Prompt'] text-white">{total}</span>
              <span className="text-xs text-slate-300">สำนวน</span>
            </div>
          </button>

          {/* 2. จำเลยรับสารภาพ */}
          <button
            type="button"
            onClick={() =>
              onSelectProcedureFilter(procedureFilter === 'confessed' ? 'all' : 'confessed')
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              procedureFilter === 'confessed'
                ? 'bg-emerald-600/40 border-emerald-400 text-white ring-2 ring-emerald-400/50 shadow-md'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
            }`}
            title="คลิกเพื่อกรองเฉพาะสำนวนที่จำเลยรับสารภาพหรือมีคำพิพากษา"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>จำเลยรับสารภาพ</span>
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-['Prompt'] text-emerald-300">
                {confessedCount}
              </span>
              <span className="text-xs text-emerald-200/80">ราย</span>
            </div>
          </button>

          {/* 3. ปฏิเสธมีนัดต่อ */}
          <button
            type="button"
            onClick={() =>
              onSelectProcedureFilter(
                procedureFilter === 'denied_scheduled' ? 'all' : 'denied_scheduled'
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              procedureFilter === 'denied_scheduled'
                ? 'bg-amber-600/40 border-amber-400 text-white ring-2 ring-amber-400/50 shadow-md'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
            }`}
            title="คลิกเพื่อกรองเฉพาะสำนวนที่จำเลยปฏิเสธและมีนัดสืบพยาน/ตรวจพยาน"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>ปฏิเสธมีนัด</span>
              </span>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-['Prompt'] text-amber-300">
                {deniedCount}
              </span>
              <span className="text-xs text-amber-200/80">ราย</span>
            </div>
          </button>

          {/* 4. มีนัดอื่นๆ */}
          <button
            type="button"
            onClick={() =>
              onSelectProcedureFilter(
                procedureFilter === 'other_scheduled' ? 'all' : 'other_scheduled'
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              procedureFilter === 'other_scheduled'
                ? 'bg-sky-600/40 border-sky-400 text-white ring-2 ring-sky-400/50 shadow-md'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
            }`}
            title="คลิกเพื่อกรองสำนวนที่มีนัดพร้อม นัดไกล่เกลี่ย หรือนัดฟังคำสั่ง"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-sky-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>มีนัดอื่นๆ</span>
              </span>
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-['Prompt'] text-sky-300">
                {otherScheduledCount}
              </span>
              <span className="text-xs text-sky-200/80">ราย</span>
            </div>
          </button>

          {/* 5. สำนวนเบิกฟ้อง (รอเบิกตัวมาฟ้อง • ยังไม่ทราบว่ารับสารภาพหรือปฏิเสธ) */}
          <button
            type="button"
            onClick={() =>
              onSelectProcedureFilter(procedureFilter === 'requisition' ? 'all' : 'requisition')
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              procedureFilter === 'requisition'
                ? 'bg-purple-600/40 border-purple-400 text-white ring-2 ring-purple-400/50 shadow-md'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
            }`}
            title="คลิกเพื่อกรองสำนวนเบิกฟ้อง (รอเบิกตัวมาฟ้อง ยังไม่ทราบคำให้การ)"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-purple-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>สำนวนเบิกฟ้อง</span>
              </span>
              <Truck className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-['Prompt'] text-purple-300">
                {requisitionCount}
              </span>
              <span className="text-xs text-purple-200/80">ราย</span>
            </div>
          </button>

          {/* 6. ยังไม่ทราบผล */}
          <button
            type="button"
            onClick={() =>
              onSelectProcedureFilter(
                procedureFilter === 'unknown_pending' ? 'all' : 'unknown_pending'
              )
            }
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              procedureFilter === 'unknown_pending'
                ? 'bg-slate-600/50 border-slate-300 text-white ring-2 ring-slate-300/50 shadow-md'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
            }`}
            title="คลิกเพื่อกรองสำนวนที่ยังไม่ระบุผลหรือยังอยู่ระหว่างรอความคืบหน้า"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>ยังไม่ทราบผล</span>
              </span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-['Prompt'] text-slate-200">
                {unknownPendingCount}
              </span>
              <span className="text-xs text-slate-400">ราย</span>
            </div>
          </button>
        </div>
      </div>

      {/* Duty Prosecutor Information */}
      <div className="mt-4 pt-3.5 border-t border-white/10 bg-white/5 rounded-2xl p-4 border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                อัยการเวรชี้ประจำวันยื่นฟ้อง ({formatThaiDate(selectedDate, { short: true })})
              </span>
            </div>
            {officersOnSelectedDate.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {officersOnSelectedDate.map((off, oIdx) => (
                  <span
                    key={oIdx}
                    className="text-xs bg-amber-500/20 text-amber-100 border border-amber-400/40 px-3 py-1 rounded-xl font-medium flex items-center gap-1.5 shadow-xs"
                  >
                    <span>
                      ⚖️ <strong>{off.name}</strong>
                    </span>
                    <span className="text-[11px] text-amber-300/80">({off.role})</span>
                    {off.courtRoom && (
                      <span className="text-[11px] text-amber-200/70">• {off.courtRoom}</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-300 pt-0.5">
                ยังไม่มีข้อมูลเวรชี้ตรงตามวันที่นี้ในตาราง PDF (คุณสามารถคลิกเพื่อเลือกจากรายชื่อเวรชี้ประจำเดือนได้)
              </p>
            )}
          </div>

          {/* Duty Prosecutor Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenDutyPicker && (
              <button
                type="button"
                onClick={onOpenDutyPicker}
                className="text-xs font-semibold text-amber-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>ดูตารางเวรชี้ประจำเดือน (PDF)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons for Selected Date */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {canEdit && onAddNewCaseForDate && (
          <button
            type="button"
            onClick={() => onAddNewCaseForDate(selectedDate)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ กรอกข้อมูลคดีใหม่ (ยื่นฟ้องวันที่ {formatThaiDate(selectedDate, { short: true })})</span>
          </button>
        )}

        {!canEdit && (
          <div className="bg-white/10 text-slate-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-white/10">
            <span>👁️ สิทธิ์ดูข้อมูลอย่างเดียว (อัปเดตแบบ Real-time จากเจ้าของระบบ)</span>
          </div>
        )}

        {onExportDailyDoc && total > 0 && (
          <button
            type="button"
            onClick={() => onExportDailyDoc(selectedDate, casesOnSelectedDate)}
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/20 flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-blue-300" />
            <span>สร้างบัญชีคดี Google Docs ({total} คดี)</span>
          </button>
        )}

        {onOpenSheetsExport && total > 0 && (
          <button
            type="button"
            onClick={() => onOpenSheetsExport(selectedDate, casesOnSelectedDate)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-emerald-500 flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Table className="w-4 h-4" />
            <span>ส่งออก 7 ช่อง (Google Sheets)</span>
          </button>
        )}

        {total > 0 && (
          <button
            type="button"
            onClick={handleCopyBatchTsv}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
              copiedBatchTsv
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-amber-200 hover:text-white border-white/20'
            }`}
          >
            {copiedBatchTsv ? <Check className="w-4 h-4 text-emerald-300" /> : <Table className="w-4 h-4 text-amber-200" />}
            <span>
              {copiedBatchTsv
                ? 'คัดลอกแถวเรียบร้อยแล้ว!'
                : `คัดลอกวางลง Excel/สารบบ (${total} คดี)`}
            </span>
          </button>
        )}

        {total > 0 && (
          <button
            type="button"
            onClick={handleCreateDailyDutyMemo}
            disabled={isCreatingDailyMemo}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-blue-500 flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="สร้างบันทึกข้อความสรุปผลการชี้คดีและผลคำพิพากษาประจำวันเสนออัยการจังหวัดลง Google Docs"
          >
            {isCreatingDailyMemo ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
            ) : (
              <FileText className="w-4 h-4 text-blue-200" />
            )}
            <span>{isCreatingDailyMemo ? 'กำลังสร้างบันทึก...' : 'บันทึกรายงานผลชี้คดี (Docs)'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
