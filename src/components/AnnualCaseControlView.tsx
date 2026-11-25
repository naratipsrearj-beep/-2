import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  FolderClock,
  Layers,
  Plus,
  Printer,
  RotateCw,
  Scale,
  Search,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate, getAppealUrgency, getDaysRemaining } from '../utils/dateUtils';
import {
  AnnualYearMode,
  downloadAnnualCasesLedgerCsv,
  downloadAnnualMonthlyCsv,
  formatAnnualMonthlyHtml,
  formatAnnualMonthlyTsv,
  getAnnualCaseControlSummary,
  getAvailableBuddhistYears,
  getCaseFilingBuddhistYear,
  getCurrentBuddhistYear,
  getMultiYearComparison,
} from '../utils/annualCaseControlUtils';
import {
  isCaseConfessed,
  isCaseDenied,
  isCaseRequisition,
  isCaseTemporarilyDischarged,
  isCaseUnspecifiedStage,
} from '../utils/appointmentUtils';

interface AnnualCaseControlViewProps {
  cases: AppealCase[];
  initialYearBE?: number;
  globalSelectedYearScope: number | 'all';
  canEdit?: boolean;
  canComplete?: boolean;
  onApplyGlobalYearScope?: (yearBE: number | 'all') => void;
  onJumpToMonthlySummary?: (yearMonth: string) => void;
  onAddNewCaseForDate?: (dateStr: string) => void;
  onEditCase?: (caseItem: AppealCase) => void;
  onOpenSubmitToDuty?: (caseItem: AppealCase) => void;
  onMarkComplete?: (caseItem: AppealCase) => void;
  onToast?: (message: string) => void;
}

type AnnualSubView = 'monthly' | 'ledger' | 'prosecutors' | 'carryover';

export const AnnualCaseControlView: React.FC<AnnualCaseControlViewProps> = ({
  cases,
  initialYearBE,
  globalSelectedYearScope,
  canEdit = false,
  canComplete = false,
  onApplyGlobalYearScope,
  onJumpToMonthlySummary,
  onAddNewCaseForDate,
  onEditCase,
  onOpenSubmitToDuty,
  onMarkComplete,
  onToast,
}) => {
  const [yearMode, setYearMode] = useState<AnnualYearMode>('calendar_be');
  const currentBE = useMemo(() => getCurrentBuddhistYear(yearMode), [yearMode]);
  const nextBE = currentBE + 1;

  const availableYears = useMemo(() => {
    const base = getAvailableBuddhistYears(cases, yearMode);
    if (!base.includes(nextBE)) {
      return [nextBE, ...base];
    }
    return base;
  }, [cases, yearMode, nextBE]);

  const [selectedYearBE, setSelectedYearBE] = useState<number>(() => {
    if (initialYearBE) return initialYearBE;
    if (typeof globalSelectedYearScope === 'number') return globalSelectedYearScope;
    return getCurrentBuddhistYear('calendar_be');
  });

  // ตรวจสอบให้ปีที่เลือกอยู่ในรายการเมื่อเปลี่ยนโหมด (ปฏิทิน / งบประมาณ)
  const effectiveYearBE = useMemo(() => {
    if (availableYears.includes(selectedYearBE)) return selectedYearBE;
    return currentBE;
  }, [availableYears, selectedYearBE, currentBE]);

  const [subView, setSubView] = useState<AnnualSubView>('monthly');
  const [ledgerMonthFilter, setLedgerMonthFilter] = useState<string>('all');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'all' | 'pending' | 'completed' | 'urgent'>('all');
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerSortOrder, setLedgerSortOrder] = useState<'seq_asc' | 'seq_desc'>('seq_asc');
  const [prosecutorSort, setProsecutorSort] = useState<'total' | 'pending' | 'completed'>('total');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const summary = useMemo(
    () => getAnnualCaseControlSummary(cases, effectiveYearBE, yearMode),
    [cases, effectiveYearBE, yearMode]
  );

  const multiYearRows = useMemo(
    () => getMultiYearComparison(cases, yearMode, true),
    [cases, yearMode]
  );

  const maxMonthlyCount = useMemo(
    () => Math.max(1, ...summary.months.map((m) => m.totalCases)),
    [summary.months]
  );

  // กรองรายการทะเบียนคุมลำดับสำนวนประจำปี พ.ศ.
  const filteredLedgerCases = useMemo(() => {
    const list = summary.yearCasesWithSequence.filter(({ caseItem, formattedNo }) => {
      if (ledgerMonthFilter !== 'all') {
        const mKey = (caseItem.filingDate || '').slice(0, 7);
        if (mKey !== ledgerMonthFilter) return false;
      }

      if (ledgerStatusFilter === 'completed' && !caseItem.isCompleted) return false;
      if (ledgerStatusFilter === 'pending' && caseItem.isCompleted) return false;
      if (ledgerStatusFilter === 'urgent') {
        const u = getAppealUrgency(caseItem);
        if (caseItem.isCompleted || (u !== 'overdue' && u !== 'critical' && u !== 'warning')) {
          return false;
        }
      }

      if (ledgerSearch.trim()) {
        const q = ledgerSearch.trim().toLowerCase();
        const haystack = [
          formattedNo,
          caseItem.blackCaseNo,
          caseItem.redCaseNo || '',
          caseItem.receivedNumberS1 || '',
          caseItem.filingNumberS4 || '',
          caseItem.prosecutorName || '',
          caseItem.responsiblePerson || '',
          caseItem.defendant || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    return ledgerSortOrder === 'seq_desc' ? [...list].reverse() : list;
  }, [summary.yearCasesWithSequence, ledgerMonthFilter, ledgerStatusFilter, ledgerSearch, ledgerSortOrder]);

  const sortedProsecutors = useMemo(() => {
    const list = [...summary.prosecutors];
    if (prosecutorSort === 'pending') {
      list.sort((a, b) => b.pendingCount - a.pendingCount || b.totalCases - a.totalCases);
    } else if (prosecutorSort === 'completed') {
      list.sort((a, b) => b.completedCount - a.completedCount || b.totalCases - a.totalCases);
    } else {
      list.sort((a, b) => b.totalCases - a.totalCases || a.prosecutorName.localeCompare(b.prosecutorName, 'th'));
    }
    return list;
  }, [summary.prosecutors, prosecutorSort]);

  const handleCopyMonthlyExcel = async () => {
    const tsv = formatAnnualMonthlyTsv(summary);
    const html = formatAnnualMonthlyHtml(summary);
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([tsv], { type: 'text/plain' }),
            }),
          ]);
        } catch {
          await navigator.clipboard.writeText(tsv);
        }
      } else {
        await navigator.clipboard.writeText(tsv);
      }
      setIsCopied(true);
      onToast?.(`คัดลอกตารางคุมจำนวนสำนวนรายปี พ.ศ. ${summary.yearBE} ลงคลิปบอร์ดแล้ว`);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      onToast?.('ไม่สามารถคัดลอกข้อมูลลงคลิปบอร์ดได้');
    }
  };

  const handleDownloadMonthlyCsv = () => {
    downloadAnnualMonthlyCsv(summary);
    onToast?.(`ดาวน์โหลดตารางคุมรายเดือน ปี พ.ศ. ${summary.yearBE} เรียบร้อยแล้ว`);
  };

  const handleDownloadCasesLedgerCsv = () => {
    downloadAnnualCasesLedgerCsv(summary);
    onToast?.(
      `ดาวน์โหลดทะเบียนคุมลำดับสำนวนประจำปี พ.ศ. ${summary.yearBE} (${summary.totalFiledThisYear} สำนวน) เรียบร้อยแล้ว`
    );
  };

  const handleAddFirstCaseInSelectedYear = () => {
    if (!onAddNewCaseForDate) return;
    const targetCE = summary.yearBE - 543;
    const defaultDate = summary.isCurrentYear
      ? new Date().toISOString().slice(0, 10)
      : summary.mode === 'fiscal_be'
        ? `${targetCE - 1}-10-01`
        : `${targetCE}-01-02`;
    onAddNewCaseForDate(defaultDate);
  };

  const getStageLabelText = (c: AppealCase): string => {
    if (isCaseTemporarilyDischarged(c)) return 'จำหน่ายชั่วคราว';
    if (isCaseUnspecifiedStage(c)) return 'ยังไม่เลือกสถานะ';
    if (isCaseConfessed(c)) return 'จำเลยรับสารภาพ';
    if (isCaseDenied(c)) return 'จำเลยปฏิเสธ';
    if (isCaseRequisition(c)) return 'สำนวนเบิกฟ้อง';
    return 'นัดอื่นๆ / รอพิจารณา';
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-slate-900 via-teal-600 to-amber-500" />
        <div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm font-semibold text-teal-800">
                <span>ระบบคุมจำนวนสำนวนรายปี พ.ศ.</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-600 tabular-nums">{summary.periodLabel}</span>
                {summary.isCurrentYear && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-slate-900 font-bold">ปี พ.ศ. ปัจจุบัน</span>
                  </>
                )}
                {summary.isFutureYear && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-indigo-700 font-bold">เตรียมพร้อมขึ้นปี พ.ศ. ใหม่</span>
                  </>
                )}
              </div>
              <h1 className="text-xl sm:text-[26px] font-bold tracking-tight text-slate-950 font-['Prompt'] leading-snug">
                บัญชีคุมจำนวนสำนวนประจำปี {yearMode === 'fiscal_be' ? 'งบประมาณ ' : ''}พ.ศ.{' '}
                <span className="tabular-nums">{summary.yearBE}</span>
              </h1>
              <p className="text-sm text-slate-700 leading-relaxed max-w-3xl">
                แยกยอดและรีเซ็ตเลขลำดับคุมสำนวนเริ่มต้นใหม่ที่{' '}
                <strong className="text-slate-950 font-mono tabular-nums">1/{summary.yearBE}</strong>{' '}
                อัตโนมัติเมื่อขึ้นปี พ.ศ. ใหม่ โดยแยก{' '}
                <strong className="text-slate-950">สำนวนฟ้องใหม่ประจำปี</strong> ออกจาก{' '}
                <strong className="text-amber-800">สำนวนค้างยกมาจากปีก่อน</strong>{' '}
                เพื่อไม่ให้ยอดรายปีคลาดเคลื่อนและไม่พลาดเตือนอุทธรณ์ข้ามปี
              </p>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start xl:self-center">
            <button
              type="button"
              onClick={handleCopyMonthlyExcel}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg border text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                isCopied
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-300'
              }`}
            >
              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-teal-700" />}
              <span>{isCopied ? 'คัดลอกแล้ว' : 'คัดลอกลง Excel'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadMonthlyCsv}
              className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>CSV รายเดือน</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCasesLedgerCsv}
              disabled={summary.totalFiledThisYear === 0}
              className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-700" />
              <span>CSV รายสำนวน</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>พิมพ์รายงาน</span>
            </button>
          </div>
        </div>

        {/* Year Switcher + Mode Controls */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Buddhist Era Year Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mr-1">
              <Calendar className="w-4 h-4 text-teal-700" />
              <span>เลือกปี พ.ศ.:</span>
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
              {availableYears.map((y) => {
                const count = multiYearRows.find((r) => r.yearBE === y)?.totalFiled ?? 0;
                const isSelected = effectiveYearBE === y;
                const isCurrent = y === currentBE;
                const isNext = y > currentBE;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setSelectedYearBE(y);
                      setLedgerMonthFilter('all');
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-white/80'
                    }`}
                  >
                    <span>พ.ศ. {y}</span>
                    {isCurrent && (
                      <span className={`text-[10px] font-semibold ${isSelected ? 'text-amber-300' : 'text-teal-700'}`}>
                        (ปัจจุบัน)
                      </span>
                    )}
                    {isNext && (
                      <span className={`text-[10px] font-semibold ${isSelected ? 'text-sky-300' : 'text-indigo-700'}`}>
                        (ปีใหม่)
                      </span>
                    )}
                    <span className={`text-[11px] font-mono ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      · {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode & Sync to Main Table */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setYearMode('calendar_be');
                  setLedgerMonthFilter('all');
                }}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  yearMode === 'calendar_be'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ปี พ.ศ. ปฏิทิน (ม.ค.–ธ.ค.)
              </button>
              <button
                type="button"
                onClick={() => {
                  setYearMode('fiscal_be');
                  setLedgerMonthFilter('all');
                }}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  yearMode === 'fiscal_be'
                    ? 'bg-white text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ปีงบประมาณ (ต.ค.–ก.ย.)
              </button>
            </div>

            {onApplyGlobalYearScope && yearMode === 'calendar_be' && (
              <button
                type="button"
                onClick={() => {
                  onApplyGlobalYearScope(effectiveYearBE);
                  onToast?.(`ปรับหน้าหลักให้แสดงสำนวนประจำปี พ.ศ. ${effectiveYearBE} แล้ว`);
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  globalSelectedYearScope === effectiveYearBE
                    ? 'bg-teal-50 text-teal-900 border-teal-300'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                }`}
              >
                <Filter className="w-3.5 h-3.5 text-teal-700" />
                <span>
                  {globalSelectedYearScope === effectiveYearBE
                    ? `กำลังกรองหน้าหลักที่ พ.ศ. ${effectiveYearBE}`
                    : `ใช้ พ.ศ. ${effectiveYearBE} กรองตารางหลัก`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. New-Year Rollover & Sequence Control Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              summary.totalFiledThisYear === 0
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-800'
            }`}
          >
            <RotateCw className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="text-sm font-bold text-slate-950 font-['Prompt']">
              {summary.totalFiledThisYear === 0
                ? `รอบปี พ.ศ. ${summary.yearBE} — พร้อมเริ่มนับจำนวนสำนวนใหม่ตั้งแต่ลำดับที่ 1/${summary.yearBE}`
                : `สถานะเลขลำดับคุมสำนวนประจำปี พ.ศ. ${summary.yearBE}`}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-700 tabular-nums">
              {summary.totalFiledThisYear > 0 ? (
                <>
                  <span>
                    ช่วงลำดับปัจจุบัน:{' '}
                    <strong className="font-mono text-slate-950">
                      1/{summary.yearBE} – {summary.totalFiledThisYear}/{summary.yearBE}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>
                    ลำดับสำนวนถัดไป:{' '}
                    <strong className="font-mono text-teal-800">
                      {summary.totalFiledThisYear + 1}/{summary.yearBE}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>
                    เมื่อขึ้นปี พ.ศ. {summary.yearBE + 1} ระบบจะเริ่มนับ{' '}
                    <strong className="font-mono text-slate-950">1/{summary.yearBE + 1}</strong> อัตโนมัติ
                  </span>
                </>
              ) : (
                <span>
                  ยังไม่มีสำนวนที่ยื่นฟ้องในปี พ.ศ. {summary.yearBE} — เมื่อบันทึกสำนวนแรกของปีนี้
                  ระบบจะออกลำดับคุมรายปีเป็น{' '}
                  <strong className="font-mono text-teal-800">1/{summary.yearBE}</strong> ทันที
                  {summary.carryOverCases.length > 0 && (
                    <>
                      {' '}
                      (มีสำนวนค้างดำเนินการยกมาจากปีก่อนหน้า{' '}
                      <strong className="text-amber-800">{summary.carryOverCases.length} สำนวน</strong>)
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {summary.carryOverCases.length > 0 && (
            <button
              type="button"
              onClick={() => setSubView('carryover')}
              className="min-h-[40px] px-3.5 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap tabular-nums"
            >
              <FolderClock className="w-4 h-4 text-amber-700" />
              <span>ตรวจสำนวนค้างยกมาจากปีก่อน ({summary.carryOverCases.length})</span>
            </button>
          )}
          {canEdit && onAddNewCaseForDate && (
            <button
              type="button"
              onClick={handleAddFirstCaseInSelectedYear}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>
                {summary.totalFiledThisYear === 0
                  ? `เพิ่มสำนวนที่ 1/${summary.yearBE}`
                  : `เพิ่มสำนวนในปี พ.ศ. ${summary.yearBE}`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 3. 4-Card Annual KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Filed This Year */}
        <button
          type="button"
          onClick={() => setSubView('ledger')}
          className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 p-4 text-left transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              สำนวนฟ้องใหม่ ปี พ.ศ. {summary.yearBE}
            </span>
            <Scale className="w-4 h-4 text-teal-700 shrink-0" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl sm:text-3xl font-bold font-['Prompt'] text-slate-950">
              {summary.totalFiledThisYear.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">สำนวน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-600 flex items-center gap-1 tabular-nums">
            {summary.previousYearTotal > 0 ? (
              <>
                {summary.yoyDelta >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                )}
                <span>
                  เทียบปี {summary.previousYearBE} ({summary.previousYearTotal.toLocaleString('th-TH')}):{' '}
                  <strong className="text-slate-900">
                    {summary.yoyDelta >= 0 ? '+' : ''}
                    {summary.yoyDelta.toLocaleString('th-TH')}
                    {summary.yoyPercent !== null ? ` (${summary.yoyDelta >= 0 ? '+' : ''}${summary.yoyPercent}%)` : ''}
                  </strong>
                </span>
              </>
            ) : (
              <span>
                เฉลี่ย {summary.avgPerActiveMonth} สำนวน/เดือน ({summary.activeMonthsCount} เดือนที่มีคดี)
              </span>
            )}
          </div>
        </button>

        {/* Card 2: Carry-Over From Prior Years */}
        <button
          type="button"
          onClick={() => setSubView('carryover')}
          className={`bg-white rounded-xl border p-4 text-left transition cursor-pointer flex flex-col justify-between ${
            summary.carryOverCases.length > 0
              ? 'border-amber-300 hover:border-amber-400'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              สำนวนค้างยกมาจากปีก่อน (&lt; พ.ศ. {summary.yearBE})
            </span>
            <FolderClock className="w-4 h-4 text-amber-700 shrink-0" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5 tabular-nums">
            <span
              className={`text-2xl sm:text-3xl font-bold font-['Prompt'] ${
                summary.carryOverCases.length > 0 ? 'text-amber-800' : 'text-slate-950'
              }`}
            >
              {summary.carryOverCases.length.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">สำนวน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-600 tabular-nums">
            {summary.carryOverUrgentCount > 0 ? (
              <span className="text-rose-700 font-semibold">
                เร่งด่วน/ใกล้ครบอุทธรณ์ {summary.carryOverUrgentCount} สำนวน
              </span>
            ) : summary.carryOverCases.length > 0 ? (
              <span>แยกยอดออกจากคดีฟ้องใหม่ปีนี้แล้ว</span>
            ) : (
              <span>ไม่มีสำนวนค้างยกมาจากปีก่อนหน้า</span>
            )}
          </div>
        </button>

        {/* Card 3: Completed This Year */}
        <button
          type="button"
          onClick={() => {
            setSubView('ledger');
            setLedgerStatusFilter('completed');
          }}
          className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 p-4 text-left transition cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              เสร็จสิ้นแล้ว (ปี พ.ศ. {summary.yearBE})
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl sm:text-3xl font-bold font-['Prompt'] text-emerald-800">
              {summary.completedThisYear.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">สำนวน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-600 tabular-nums">
            อัตราแล้วเสร็จ <strong className="text-emerald-800">{summary.completionRate}%</strong> · เสนอเวรชี้แล้ว{' '}
            {summary.submittedToDutyCount.toLocaleString('th-TH')}
          </div>
        </button>

        {/* Card 4: Pending This Year */}
        <button
          type="button"
          onClick={() => {
            setSubView('ledger');
            setLedgerStatusFilter('pending');
          }}
          className={`bg-white rounded-xl border p-4 text-left transition cursor-pointer flex flex-col justify-between ${
            summary.urgentThisYear > 0
              ? 'border-rose-300 hover:border-rose-400'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              คงค้างดำเนินการ (ปี พ.ศ. {summary.yearBE})
            </span>
            <Clock className="w-4 h-4 text-rose-700 shrink-0" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl sm:text-3xl font-bold font-['Prompt'] text-slate-950">
              {summary.pendingThisYear.toLocaleString('th-TH')}
            </span>
            <span className="text-xs text-slate-500">สำนวน</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-600 tabular-nums">
            {summary.urgentThisYear > 0 ? (
              <span className="text-rose-700 font-semibold">
                เตือนด่วน (≤ 7 วัน/เกินกำหนด) {summary.urgentThisYear} สำนวน
              </span>
            ) : (
              <span>มีคำพิพากษาแล้ว {summary.hasJudgmentCount.toLocaleString('th-TH')} สำนวน</span>
            )}
          </div>
        </button>
      </div>

      {/* 4. Sub-View Segmented Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-3 sm:px-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/70">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setSubView('monthly')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
                subView === 'monthly'
                  ? 'bg-white text-slate-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ตารางคุมรายเดือน (12 เดือน)
            </button>
            <button
              type="button"
              onClick={() => setSubView('ledger')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap tabular-nums ${
                subView === 'ledger'
                  ? 'bg-white text-slate-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทะเบียนลำดับคุมประจำปี ({summary.totalFiledThisYear})
            </button>
            <button
              type="button"
              onClick={() => setSubView('prosecutors')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap tabular-nums ${
                subView === 'prosecutors'
                  ? 'bg-white text-slate-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              สรุปรายอัยการประจำปี ({summary.prosecutors.length})
            </button>
            <button
              type="button"
              onClick={() => setSubView('carryover')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap tabular-nums ${
                subView === 'carryover'
                  ? 'bg-white text-amber-950 shadow-2xs'
                  : summary.carryOverCases.length > 0
                    ? 'text-amber-800 hover:text-amber-950'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              สำนวนค้างยกมาจากปีก่อน ({summary.carryOverCases.length})
            </button>
          </div>

          <div className="text-xs text-slate-500 tabular-nums">
            ฐานข้อมูลรวมทุกปี: <strong className="text-slate-800">{cases.length.toLocaleString('th-TH')}</strong> สำนวน
          </div>
        </div>

        {/* SUB-VIEW 1: Monthly 12-Month Breakdown + Multi-Year Comparison */}
        {subView === 'monthly' && (
          <div className="divide-y divide-slate-200">
            {/* 12-Month Table */}
            <div className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-950 font-['Prompt']">
                    ตารางคุมจำนวนสำนวนรายเดือน ประจำปี พ.ศ. {summary.yearBE}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    แสดงยอดยื่นฟ้องใหม่รายเดือน ช่วงเลขลำดับที่ประจำปี และยอดสะสมตั้งแต่ต้นปี พ.ศ. {summary.yearBE}
                  </p>
                </div>
                {summary.peakMonth && (
                  <div className="text-xs text-slate-600 tabular-nums">
                    เดือนที่ฟ้องสูงสุด:{' '}
                    <strong className="text-slate-950">{summary.peakMonth.monthLabel}</strong> (
                    {summary.peakMonth.totalCases} สำนวน)
                  </div>
                )}
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-semibold">
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">เดือน</th>
                      <th className="py-2.5 px-2.5 text-center whitespace-nowrap">ช่วงลำดับที่</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">ฟ้องใหม่</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap min-w-[120px]">สัดส่วนรายเดือน</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">สะสมต้นปี</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">รับสารภาพ</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">ปฏิเสธ</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">เบิกฟ้อง</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">จำหน่ายฯ</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">มีคำพิพากษา</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">เสร็จสิ้น</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">คงค้าง</th>
                      <th className="py-2.5 px-2.5 text-center whitespace-nowrap">ดูรายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 tabular-nums">
                    {summary.months.map((m) => {
                      const barPct = m.totalCases > 0 ? Math.max(6, Math.round((m.totalCases / maxMonthlyCount) * 100)) : 0;
                      const seqRange =
                        m.seqStart !== null && m.seqEnd !== null
                          ? `${m.seqStart}/${summary.yearBE}–${m.seqEnd}/${summary.yearBE}`
                          : '-';
                      return (
                        <tr
                          key={m.monthKey}
                          className={`transition-colors ${
                            m.totalCases > 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 text-slate-400'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                            {m.monthLabel}
                          </td>
                          <td className="py-2.5 px-2.5 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {seqRange}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-950 whitespace-nowrap">
                            {m.totalCases > 0 ? m.totalCases.toLocaleString('th-TH') : '0'}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              {barPct > 0 && (
                                <div
                                  className="h-full bg-teal-600 rounded-full"
                                  style={{ width: `${barPct}%` }}
                                />
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-semibold text-teal-900 whitespace-nowrap">
                            {m.cumulativeTotal.toLocaleString('th-TH')}
                          </td>
                          <td className="py-2.5 px-2 text-right text-amber-800 whitespace-nowrap">
                            {m.confessedCount || '-'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-orange-800 whitespace-nowrap">
                            {m.deniedCount || '-'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-emerald-800 whitespace-nowrap">
                            {m.requisitionCount || '-'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-600 whitespace-nowrap">
                            {m.dischargedCount || '-'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-700 whitespace-nowrap">
                            {m.hasJudgmentCount || '-'}
                          </td>
                          <td className="py-2.5 px-2 text-right text-emerald-800 font-semibold whitespace-nowrap">
                            {m.completedCount || '-'}
                          </td>
                          <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                            <span className={m.urgentCount > 0 ? 'font-bold text-rose-700' : 'text-slate-700'}>
                              {m.pendingCount || '-'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            {m.totalCases > 0 ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLedgerMonthFilter(m.monthKey);
                                    setLedgerStatusFilter('all');
                                    setSubView('ledger');
                                  }}
                                  className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                                  title={`ดูทะเบียนสำนวนในเดือน${m.monthLabel}`}
                                >
                                  รายสำนวน
                                </button>
                                {onJumpToMonthlySummary && (
                                  <button
                                    type="button"
                                    onClick={() => onJumpToMonthlySummary(m.monthKey)}
                                    className="px-2 py-1 rounded-md text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 transition cursor-pointer inline-flex items-center gap-0.5"
                                    title={`เปิดหน้าสรุปสิ้นเดือน (รายอัยการ) เดือน${m.monthLabel}`}
                                  >
                                    <span>รายอัยการ</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-950 tabular-nums">
                      <td className="py-3 px-3 whitespace-nowrap">
                        รวมทั้งปี พ.ศ. {summary.yearBE}
                      </td>
                      <td className="py-3 px-2.5 text-center font-mono text-[11px] whitespace-nowrap">
                        {summary.totalFiledThisYear > 0
                          ? `1/${summary.yearBE}–${summary.totalFiledThisYear}/${summary.yearBE}`
                          : '-'}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {summary.totalFiledThisYear.toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-3 text-[11px] font-medium text-slate-600">
                        เฉลี่ย {summary.avgPerActiveMonth}/เดือน
                      </td>
                      <td className="py-3 px-2.5 text-right text-teal-900 whitespace-nowrap">
                        {summary.totalFiledThisYear.toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-2 text-right text-amber-900 whitespace-nowrap">
                        {summary.confessedCount.toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-2 text-right text-orange-900 whitespace-nowrap">
                        {summary.deniedCount.toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-2 text-right text-emerald-900 whitespace-nowrap">
                        {summary.requisitionCount.toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-700 whitespace-nowrap">
                        {summary.dischargedCount.toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        {summary.hasJudgmentCount.toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-2 text-right text-emerald-900 whitespace-nowrap">
                        {summary.completedThisYear.toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-2.5 text-right text-rose-800 whitespace-nowrap">
                        {summary.pendingThisYear.toLocaleString('th-TH')}
                      </td>
                      <td className="py-3 px-2.5 text-center text-[11px] text-slate-600">
                        {summary.completionRate}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Multi-Year Comparison Table */}
            <div className="p-4 sm:p-5 bg-slate-50/40">
              <div className="mb-3">
                <h3 className="text-base font-bold text-slate-950 font-['Prompt'] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-700" />
                  <span>สรุปเปรียบเทียบจำนวนสำนวนข้ามปี พ.ศ.</span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  แสดงสถิติจำนวนสำนวนแยกตามปี พ.ศ. ทั้งหมดในฐานข้อมูล พร้อมสถานะรอบปี พ.ศ. ถัดไปที่พร้อมเริ่มนับลำดับที่ 1 ใหม่
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">ปี พ.ศ.</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">ฟ้องใหม่ทั้งปี</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">เฉลี่ย/เดือน</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">รับสารภาพ</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">ปฏิเสธ</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">เบิกฟ้อง</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">เสร็จสิ้นแล้ว</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">อัตราแล้วเสร็จ</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">คงค้างปีนั้น</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">ค้างยกมาจากปีก่อน</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 tabular-nums">
                    {multiYearRows.map((row) => {
                      const isSelected = row.yearBE === effectiveYearBE;
                      return (
                        <tr
                          key={row.yearBE}
                          className={isSelected ? 'bg-teal-50/60' : 'hover:bg-slate-50'}
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-950 whitespace-nowrap">
                            <span>พ.ศ. {row.yearBE}</span>
                            {row.isCurrentYear && (
                              <span className="ml-2 text-[11px] font-semibold text-teal-700">· ปัจจุบัน</span>
                            )}
                            {row.isFutureYear && (
                              <span className="ml-2 text-[11px] font-semibold text-indigo-700">· เตรียมขึ้นปีใหม่</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-950 whitespace-nowrap">
                            {row.totalFiled.toLocaleString('th-TH')} สำนวน
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap">
                            {row.avgPerActiveMonth}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-amber-800 whitespace-nowrap">
                            {row.confessedCount.toLocaleString('th-TH')}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-orange-800 whitespace-nowrap">
                            {row.deniedCount.toLocaleString('th-TH')}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-emerald-800 whitespace-nowrap">
                            {row.requisitionCount.toLocaleString('th-TH')}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-emerald-800 font-semibold whitespace-nowrap">
                            {row.completedCount.toLocaleString('th-TH')}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-slate-700 whitespace-nowrap">
                            {row.completionRate}%
                          </td>
                          <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                            <span className={row.urgentCount > 0 ? 'font-bold text-rose-700' : 'text-slate-700'}>
                              {row.pendingCount.toLocaleString('th-TH')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-800 font-semibold whitespace-nowrap">
                            {row.carryOverIntoYearCount.toLocaleString('th-TH')}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedYearBE(row.yearBE);
                                setLedgerMonthFilter('all');
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                isSelected
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                              }`}
                            >
                              {isSelected ? 'กำลังแสดง' : 'เลือกดูปีนี้'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUB-VIEW 2: Annual Running Sequence Register (1/พ.ศ. – N/พ.ศ.) */}
        {subView === 'ledger' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder={`ค้นหาลำดับที่ (เช่น 1/${summary.yearBE}), เลขคดีดำ, ส.1, ส.4, อัยการ...`}
                    className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <select
                  value={ledgerMonthFilter}
                  onChange={(e) => setLedgerMonthFilter(e.target.value)}
                  className="min-h-[40px] px-3 py-2 text-xs sm:text-sm font-medium border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                >
                  <option value="all">ทุกเดือนใน พ.ศ. {summary.yearBE}</option>
                  {summary.months.map((m) => (
                    <option key={m.monthKey} value={m.monthKey}>
                      {m.monthLabel} ({m.totalCases} สำนวน)
                    </option>
                  ))}
                </select>

                <select
                  value={ledgerStatusFilter}
                  onChange={(e) => setLedgerStatusFilter(e.target.value as any)}
                  className="min-h-[40px] px-3 py-2 text-xs sm:text-sm font-medium border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="pending">คงค้างดำเนินการ</option>
                  <option value="urgent">เร่งด่วน (≤ 7 วัน/เกินกำหนด)</option>
                  <option value="completed">เสร็จสิ้นแล้ว</option>
                </select>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setLedgerSortOrder((p) => (p === 'seq_asc' ? 'seq_desc' : 'seq_asc'))}
                  className="min-h-[40px] px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 transition cursor-pointer whitespace-nowrap"
                >
                  เรียงลำดับ: {ledgerSortOrder === 'seq_asc' ? `1/${summary.yearBE} → ล่าสุด` : `ล่าสุด → 1/${summary.yearBE}`}
                </button>
              </div>
            </div>

            {filteredLedgerCases.length === 0 ? (
              <div className="border border-slate-200 rounded-xl p-10 text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                  <CalendarRange className="w-6 h-6" />
                </div>
                <div className="text-base font-bold text-slate-900 font-['Prompt']">
                  {summary.totalFiledThisYear === 0
                    ? `ยังไม่มีสำนวนยื่นฟ้องในปี พ.ศ. ${summary.yearBE}`
                    : 'ไม่พบสำนวนที่ตรงกับเงื่อนไขการค้นหา'}
                </div>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                  {summary.totalFiledThisYear === 0
                    ? `เมื่อบันทึกสำนวนใหม่ที่มีวันที่ยื่นฟ้องในปี พ.ศ. ${summary.yearBE} ระบบจะเริ่มออกเลขลำดับคุมสำนวนประจำปีที่ 1/${summary.yearBE} อัตโนมัติ`
                    : 'ลองปรับตัวกรองเดือน สถานะ หรือคำค้นหาใหม่อีกครั้ง'}
                </p>
                {summary.totalFiledThisYear === 0 && canEdit && onAddNewCaseForDate && (
                  <button
                    type="button"
                    onClick={handleAddFirstCaseInSelectedYear}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>บันทึกสำนวนที่ 1/{summary.yearBE}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-semibold">
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">ลำดับประจำปี</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">วันที่ยื่นฟ้อง</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">เลขคดีดำ / แดง</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">เลขรับ ส.1 / ส.4</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">อัยการเจ้าของสำนวน</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">จำเลย</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">สถานะสำนวน</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">ครบอุทธรณ์ / เสร็จสิ้น</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 tabular-nums">
                    {filteredLedgerCases.map(({ caseItem, formattedNo }) => {
                      const deadline = caseItem.extendedDeadline || caseItem.appealDeadline;
                      const daysLeft = deadline ? getDaysRemaining(caseItem) : null;
                      return (
                        <tr key={caseItem.id} className="bg-white hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-teal-900 whitespace-nowrap">
                            {formattedNo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                            {formatThaiDate(caseItem.filingDate, { short: true })}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-950">ดำ {caseItem.blackCaseNo}</div>
                            {caseItem.redCaseNo && (
                              <div className="text-[11px] text-rose-700 font-semibold">แดง {caseItem.redCaseNo}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            <div>ส.1: {caseItem.receivedNumberS1 || '-'}</div>
                            <div className="text-[11px] text-slate-500">ส.4: {caseItem.filingNumberS4 || '-'}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 font-medium max-w-[180px] truncate">
                            {caseItem.prosecutorName || caseItem.responsiblePerson || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-[180px] truncate">
                            {caseItem.defendant || '-'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="text-slate-900 font-semibold">{getStageLabelText(caseItem)}</div>
                            <div className="text-[11px] text-slate-500">
                              {caseItem.isSubmittedToDuty ? 'เสนอเวรชี้แล้ว' : 'ยังไม่เสนอเวรชี้'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {caseItem.isCompleted ? (
                              <span className="font-semibold text-emerald-700">
                                เสร็จสิ้น {caseItem.completedDate ? `(${formatThaiDate(caseItem.completedDate, { short: true })})` : ''}
                              </span>
                            ) : deadline ? (
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {formatThaiDate(deadline, { short: true })}
                                </div>
                                {daysLeft !== null && (
                                  <div
                                    className={`text-[11px] font-semibold ${
                                      daysLeft < 0
                                        ? 'text-rose-700'
                                        : daysLeft <= 7
                                          ? 'text-amber-700'
                                          : 'text-slate-500'
                                    }`}
                                  >
                                    {daysLeft < 0 ? `เกินกำหนด ${Math.abs(daysLeft)} วัน` : `เหลือ ${daysLeft} วัน`}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">รอคำพิพากษา</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {onEditCase && (
                                <button
                                  type="button"
                                  onClick={() => onEditCase(caseItem)}
                                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{canEdit ? 'แก้ไข' : 'ดูข้อมูล'}</span>
                                </button>
                              )}
                              {!caseItem.isCompleted && canComplete && onMarkComplete && (
                                <button
                                  type="button"
                                  onClick={() => onMarkComplete(caseItem)}
                                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer"
                                >
                                  เสร็จสิ้น
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUB-VIEW 3: Annual Prosecutor Summary */}
        {subView === 'prosecutors' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-950 font-['Prompt'] flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-700" />
                  <span>สรุปจำนวนสำนวนรายอัยการ ประจำปี พ.ศ. {summary.yearBE}</span>
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  นับเฉพาะสำนวนที่ยื่นฟ้องในปี พ.ศ. {summary.yearBE} ทั้งสิ้น {summary.totalFiledThisYear.toLocaleString('th-TH')} สำนวน
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setProsecutorSort('total')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    prosecutorSort === 'total' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  เรียงตามยอดรวม
                </button>
                <button
                  type="button"
                  onClick={() => setProsecutorSort('pending')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    prosecutorSort === 'pending' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  เรียงตามคงค้าง
                </button>
                <button
                  type="button"
                  onClick={() => setProsecutorSort('completed')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    prosecutorSort === 'completed' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  เรียงตามเสร็จสิ้น
                </button>
              </div>
            </div>

            {sortedProsecutors.length === 0 ? (
              <div className="border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500 bg-slate-50/50">
                ยังไม่มีข้อมูลสำนวนรายอัยการในปี พ.ศ. {summary.yearBE}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-semibold">
                      <th className="py-2.5 px-3 text-center whitespace-nowrap w-12">ที่</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">อัยการเจ้าของสำนวน</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">รวมทั้งปี</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap min-w-[120px]">สัดส่วน (%)</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">รับสารภาพ</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">ปฏิเสธ</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">เบิกฟ้อง</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">เสร็จสิ้น</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">คงค้าง</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">อัตราเสร็จสิ้น</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 tabular-nums">
                    {sortedProsecutors.map((p, idx) => (
                      <tr key={p.prosecutorName} className="bg-white hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-950 whitespace-nowrap">
                          {p.prosecutorName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-950 whitespace-nowrap">
                          {p.totalCases.toLocaleString('th-TH')}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-slate-800 rounded-full"
                                style={{ width: `${Math.max(4, Math.round(p.sharePercent))}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-600 w-10 text-right">{p.sharePercent}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-amber-800">{p.confessedCount}</td>
                        <td className="py-2.5 px-2.5 text-right text-orange-800">{p.deniedCount}</td>
                        <td className="py-2.5 px-2.5 text-right text-emerald-800">{p.requisitionCount}</td>
                        <td className="py-2.5 px-2.5 text-right text-emerald-800 font-semibold">
                          {p.completedCount}
                        </td>
                        <td className="py-2.5 px-2.5 text-right">
                          <span className={p.urgentCount > 0 ? 'font-bold text-rose-700' : 'text-slate-800'}>
                            {p.pendingCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                          {p.completionRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUB-VIEW 4: Carry-Over Pending Cases from Prior Years */}
        {subView === 'carryover' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-950 font-['Prompt'] flex items-center gap-2">
                  <FolderClock className="w-4 h-4 text-amber-700" />
                  <span>สำนวนค้างดำเนินการยกมาจากปีก่อน พ.ศ. {summary.yearBE}</span>
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  สำนวนที่ยื่นฟ้องในปี พ.ศ. ก่อนหน้าแต่ยังไม่เสร็จสิ้น — ระบบแยกออกจากยอดฟ้องใหม่ปี พ.ศ. {summary.yearBE}{' '}
                  แต่ยังคงติดตามระยะเวลาอุทธรณ์อย่างต่อเนื่อง
                </p>
              </div>
            </div>

            {summary.carryOverCases.length === 0 ? (
              <div className="border border-slate-200 rounded-xl p-10 text-center space-y-2 bg-slate-50/50">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900 font-['Prompt']">
                  ไม่มีสำนวนค้างยกมาจากปีก่อน พ.ศ. {summary.yearBE}
                </div>
                <p className="text-xs text-slate-600">
                  สำนวนจากปี พ.ศ. ก่อนหน้าดำเนินการเสร็จสิ้นทั้งหมดแล้ว หรือยังไม่มีสำนวนข้ามปี
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-950 text-white text-[11px] font-semibold">
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">ปี พ.ศ. เดิม</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">วันที่ยื่นฟ้อง</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">เลขคดีดำ / แดง</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">อัยการเจ้าของสำนวน</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">จำเลย</th>
                      <th className="py-2.5 px-3 text-left whitespace-nowrap">ครบกำหนดอุทธรณ์</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 tabular-nums">
                    {summary.carryOverCases.map((c) => {
                      const origYear = getCaseFilingBuddhistYear(c);
                      const deadline = c.extendedDeadline || c.appealDeadline;
                      const daysLeft = deadline ? getDaysRemaining(c) : null;
                      return (
                        <tr key={c.id} className="bg-white hover:bg-amber-50/40">
                          <td className="py-2.5 px-3 text-center font-bold text-amber-900 whitespace-nowrap">
                            พ.ศ. {origYear ?? '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            {formatThaiDate(c.filingDate, { short: true })}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-950">ดำ {c.blackCaseNo}</div>
                            {c.redCaseNo && (
                              <div className="text-[11px] text-rose-700 font-semibold">แดง {c.redCaseNo}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 font-medium max-w-[180px] truncate">
                            {c.prosecutorName || c.responsiblePerson || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-[180px] truncate">
                            {c.defendant || '-'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {deadline ? (
                              <div>
                                <div className="font-semibold text-slate-900">
                                  {formatThaiDate(deadline, { short: true })}
                                </div>
                                {daysLeft !== null && (
                                  <div
                                    className={`text-[11px] font-bold flex items-center gap-1 ${
                                      daysLeft < 0
                                        ? 'text-rose-700'
                                        : daysLeft <= 7
                                          ? 'text-amber-700'
                                          : 'text-slate-600'
                                    }`}
                                  >
                                    {daysLeft <= 7 && <AlertTriangle className="w-3 h-3 shrink-0" />}
                                    <span>
                                      {daysLeft < 0 ? `เกินกำหนด ${Math.abs(daysLeft)} วัน` : `เหลือ ${daysLeft} วัน`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500">อยู่ระหว่างพิจารณา / รอคำพิพากษา</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {onEditCase && (
                                <button
                                  type="button"
                                  onClick={() => onEditCase(c)}
                                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{canEdit ? 'แก้ไข' : 'ดูข้อมูล'}</span>
                                </button>
                              )}
                              {canEdit && onOpenSubmitToDuty && !c.isSubmittedToDuty && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSubmitToDuty(c)}
                                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>เสนอเวรชี้</span>
                                </button>
                              )}
                              {canComplete && onMarkComplete && (
                                <button
                                  type="button"
                                  onClick={() => onMarkComplete(c)}
                                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer"
                                >
                                  เสร็จสิ้น
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
