import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  Printer,
  Scale,
  Search,
  Send,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';
import {
  PendingDuty10DayEntry,
  PendingDuty10DayRangeFilter,
  downloadPendingDuty10DayCsv,
  extractPendingDuty10DaySummary,
  formatPendingDuty10DayHtml,
  formatPendingDuty10DayTsv,
} from '../utils/appeal10DaySummaryUtils';

interface Appeal10DayPendingDutyLedgerViewProps {
  cases: AppealCase[];
  canEdit?: boolean;
  canComplete?: boolean;
  onOpenSubmitToDuty?: (caseItem: AppealCase) => void;
  onEditCase?: (caseItem: AppealCase) => void;
  onExtendDeadline?: (caseItem: AppealCase) => void;
  onMarkComplete?: (caseItem: AppealCase) => void;
  onToast?: (message: string) => void;
}

const RANGE_LABELS: Record<PendingDuty10DayRangeFilter, string> = {
  all_le_10: 'ทั้งหมดที่เหลือ ≤ 10 วัน (รวมเกินกำหนด)',
  exact_10: 'เหลือ 10 วันพอดี',
  days_0_to_10: 'เหลือ 0–10 วัน (ยังไม่เกินกำหนด)',
  overdue: 'เกินกำหนด (< 0 วัน)',
};

export const Appeal10DayPendingDutyLedgerView: React.FC<Appeal10DayPendingDutyLedgerViewProps> = ({
  cases,
  canEdit = false,
  canComplete = false,
  onOpenSubmitToDuty,
  onEditCase,
  onExtendDeadline,
  onMarkComplete,
  onToast,
}) => {
  const [rangeFilter, setRangeFilter] = useState<PendingDuty10DayRangeFilter>('all_le_10');
  const [selectedProsecutor, setSelectedProsecutor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'days_asc' | 'black_no' | 'prosecutor'>('days_asc');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // สกัดบัญชีสรุปข้อมูลสำนวนใกล้ครบอุทธรณ์ (เหลือ <= 10 วัน) ที่ยังไม่กดเสนอเวรชี้
  const summary = useMemo(() => extractPendingDuty10DaySummary(cases), [cases]);

  // กรองและเรียงลำดับตามตัวเลือกผู้ใช้
  const filteredEntries = useMemo<PendingDuty10DayEntry[]>(() => {
    const filtered = summary.entries.filter((entry) => {
      if (rangeFilter === 'exact_10' && entry.daysLeft !== 10) return false;
      if (rangeFilter === 'days_0_to_10' && (entry.daysLeft < 0 || entry.daysLeft > 10)) return false;
      if (rangeFilter === 'overdue' && entry.daysLeft >= 0) return false;

      if (selectedProsecutor !== 'all' && entry.ownerProsecutor !== selectedProsecutor) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const c = entry.caseItem;
        const haystack = [
          c.blackCaseNo,
          c.redCaseNo || '',
          c.receivedNumberS1 || '',
          c.filingNumberS4 || '',
          c.defendant || '',
          entry.ownerProsecutor,
          c.judgmentOutcome || '',
          c.fullJudgmentText || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    const sorted = [...filtered];
    if (sortBy === 'black_no') {
      sorted.sort((a, b) => a.caseItem.blackCaseNo.localeCompare(b.caseItem.blackCaseNo, 'th'));
    } else if (sortBy === 'prosecutor') {
      sorted.sort((a, b) => {
        const cmp = a.ownerProsecutor.localeCompare(b.ownerProsecutor, 'th');
        return cmp !== 0 ? cmp : a.daysLeft - b.daysLeft;
      });
    } else {
      sorted.sort((a, b) => {
        if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
        return a.caseItem.blackCaseNo.localeCompare(b.caseItem.blackCaseNo, 'th');
      });
    }

    return sorted;
  }, [summary.entries, rangeFilter, selectedProsecutor, searchQuery, sortBy]);

  const handleCopyTable = async () => {
    const label = RANGE_LABELS[rangeFilter];
    const tsv = formatPendingDuty10DayTsv(filteredEntries, label);
    const html = formatPendingDuty10DayHtml(filteredEntries, label);

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
      onToast?.(`คัดลอกบัญชีสรุปสำนวนใกล้ครบอุทธรณ์ (${filteredEntries.length} คดี) ลงคลิปบอร์ดแล้ว`);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      onToast?.('ไม่สามารถคัดลอกข้อมูลลงคลิปบอร์ดได้');
    }
  };

  const handleDownloadCsv = () => {
    downloadPendingDuty10DayCsv(filteredEntries, RANGE_LABELS[rangeFilter]);
    onToast?.(`ดาวน์โหลดไฟล์บัญชีสรุป (${filteredEntries.length} คดี) เรียบร้อยแล้ว`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* 1. High-Contrast Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-rose-700 via-amber-500 to-blue-800" />
        <div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-rose-700 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <ShieldAlert className="w-6 h-6 text-amber-200" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold text-rose-800">
                <span>ระบบบัญชีสรุปข้อมูลสำนวนเร่งด่วน</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-700 font-semibold">
                  ติดตามสำนวนใกล้ครบอุทธรณ์ที่ยังไม่ได้เสนอเวรชี้
                </span>
              </div>
              <h1 className="text-xl sm:text-[26px] font-bold tracking-tight text-slate-950 font-['Prompt'] leading-snug">
                บัญชีสำนวนใกล้ครบอุทธรณ์ (เหลือ ≤ 10 วัน) ที่ยังไม่กดเสนอเวรชี้
              </h1>
              <p className="text-sm text-slate-700 leading-relaxed">
                รวบรวมเฉพาะสำนวนที่มีคำพิพากษาและอยู่ระหว่างคุมระยะเวลาอุทธรณ์ 1 เดือน ที่เหลือเวลาไม่เกิน{' '}
                <strong className="text-rose-800">10 วัน</strong> และ{' '}
                <strong className="text-slate-950">ยังไม่กดเสนอเวรชี้</strong>{' '}
                เพื่อใช้เป็นบัญชีตรวจติดตามและกดเสนอเวรชี้ได้ทันที
              </p>
            </div>
          </div>

          {/* Official Export Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start xl:self-center">
            <button
              type="button"
              onClick={handleCopyTable}
              disabled={filteredEntries.length === 0}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg border text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                isCopied
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-300'
              }`}
            >
              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-blue-700" />}
              <span>{isCopied ? 'คัดลอกแล้ว' : 'คัดลอกลง Excel'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={filteredEntries.length === 0}
              className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>ดาวน์โหลด CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredEntries.length === 0}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>พิมพ์บัญชีสรุป</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4-Card Summary Metrics Strip (Interactive Range Switchers) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setRangeFilter('all_le_10')}
          className={`bg-white p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
            rangeFilter === 'all_le_10'
              ? 'border-rose-600 ring-2 ring-rose-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-rose-700 shrink-0" />
            <span>ทั้งหมดที่ยังไม่เสนอเวรชี้ (≤ 10 วัน)</span>
          </span>
          <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl sm:text-3xl font-bold font-['Prompt'] text-rose-700">
              {summary.totalCount}
            </span>
            <span className="text-xs font-medium text-slate-500">สำนวน</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRangeFilter('exact_10')}
          className={`bg-white p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
            rangeFilter === 'exact_10'
              ? 'border-blue-700 ring-2 ring-blue-600/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-blue-700 shrink-0" />
            <span>เหลือระยะเวลา 10 วันพอดี</span>
          </span>
          <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl sm:text-3xl font-bold font-['Prompt'] text-blue-800">
              {summary.exact10Count}
            </span>
            <span className="text-xs font-medium text-slate-500">สำนวน</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRangeFilter(summary.overdueCount > 0 && summary.days0To9Count === 0 ? 'overdue' : 'days_0_to_10')}
          className={`bg-white p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
            rangeFilter === 'days_0_to_10' || rangeFilter === 'overdue'
              ? 'border-amber-600 ring-2 ring-amber-500/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>เหลือ 0–9 วัน / เกินกำหนด</span>
          </span>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl sm:text-3xl font-bold font-['Prompt'] text-amber-800">
              {summary.days0To9Count + summary.overdueCount}
            </span>
            <span className="text-xs font-medium text-slate-600">
              (0–9 วัน: {summary.days0To9Count} · เกิน: {summary.overdueCount})
            </span>
          </div>
        </button>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-700 shrink-0" />
            <span>อัยการเจ้าของสำนวนที่เกี่ยวข้อง</span>
          </span>
          <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl sm:text-3xl font-bold font-['Prompt'] text-slate-900">
              {summary.prosecutorGroups.length}
            </span>
            <span className="text-xs font-medium text-slate-500">ท่าน</span>
          </div>
        </div>
      </div>

      {/* 3. Filter, Search & Prosecutor Summary Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเลขคดีดำ, คดีแดง, ส.1/ส.4, จำเลย, ชื่ออัยการ..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                aria-label="ล้างคำค้นหา"
              >
                ✕
              </button>
            )}
          </div>

          {/* Range Filter Segmented Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 inline-flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>ช่วงวัน:</span>
            </span>
            {(
              [
                { id: 'all_le_10', label: `ทั้งหมด ≤ 10 วัน (${summary.totalCount})` },
                { id: 'exact_10', label: `เหลือ 10 วันพอดี (${summary.exact10Count})` },
                { id: 'days_0_to_10', label: `0–10 วัน (${summary.days0To10Count})` },
                { id: 'overdue', label: `เกินกำหนด (${summary.overdueCount})` },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setRangeFilter(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                  rangeFilter === btn.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="เรียงลำดับข้อมูล"
              className="text-xs sm:text-sm font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="days_asc">เรียงตามวันครบอุทธรณ์ (เร่งด่วนสุดก่อน)</option>
              <option value="prosecutor">เรียงตามชื่ออัยการเจ้าของสำนวน</option>
              <option value="black_no">เรียงตามหมายเลขคดีดำ</option>
            </select>
          </div>
        </div>

        {/* Prosecutor Quick-Filter Bar */}
        {summary.prosecutorGroups.length > 0 && (
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-700 mr-1 whitespace-nowrap">
              แยกตามอัยการเจ้าของสำนวน:
            </span>
            <button
              type="button"
              onClick={() => setSelectedProsecutor('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                selectedProsecutor === 'all'
                  ? 'bg-blue-800 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              ทุกท่าน ({summary.totalCount})
            </button>
            {summary.prosecutorGroups.map((pg) => (
              <button
                key={pg.prosecutorName}
                type="button"
                onClick={() =>
                  setSelectedProsecutor(
                    selectedProsecutor === pg.prosecutorName ? 'all' : pg.prosecutorName
                  )
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums border ${
                  selectedProsecutor === pg.prosecutorName
                    ? 'bg-blue-800 text-white border-blue-900'
                    : 'bg-white hover:bg-blue-50 text-slate-800 border-slate-300'
                }`}
              >
                {pg.prosecutorName} ({pg.totalCount})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Official Accounting Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 font-['Prompt']">
            <Scale className="w-4 h-4 text-rose-700" />
            <span>รายการบัญชีสำนวน ({RANGE_LABELS[rangeFilter]})</span>
          </div>
          <span className="text-xs font-semibold text-slate-600 tabular-nums">
            แสดงผล <strong className="text-slate-950">{filteredEntries.length}</strong> จากทั้งหมด{' '}
            <strong className="text-slate-950">{summary.totalCount}</strong> สำนวน
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-10 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-['Prompt']">
              {summary.totalCount === 0
                ? 'ไม่มีสำนวนใกล้ครบอุทธรณ์ (≤ 10 วัน) ที่ค้างเสนอเวรชี้'
                : 'ไม่พบสำนวนที่ตรงกับเงื่อนไขตัวกรองที่เลือก'}
            </h3>
            <p className="text-sm text-slate-600 max-w-xl mx-auto">
              {summary.totalCount === 0
                ? 'สำนวนที่เหลือระยะเวลาอุทธรณ์ไม่เกิน 10 วันทั้งหมดได้รับการกดเสนอเวรชี้หรือดำเนินการเสร็จสิ้นเรียบร้อยแล้ว'
                : 'ลองเปลี่ยนตัวกรองช่วงวัน ล้างคำค้นหา หรือเลือกดูอัยการทุกท่านเพื่อตรวจสอบรายการทั้งหมด'}
            </p>
            {(rangeFilter !== 'all_le_10' || selectedProsecutor !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setRangeFilter('all_le_10');
                  setSelectedProsecutor('all');
                  setSearchQuery('');
                }}
                className="mt-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition"
              >
                แสดงทั้งหมดที่เหลือ ≤ 10 วัน
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-800">
                  <th className="py-3 px-3 text-center w-12">ลำดับ</th>
                  <th className="py-3 px-3 min-w-[165px]">เลขคดีดำ / แดง / ส.1–ส.4</th>
                  <th className="py-3 px-3 min-w-[160px]">จำเลย / ประเภทคดี</th>
                  <th className="py-3 px-3 min-w-[140px]">อัยการเจ้าของสำนวน</th>
                  <th className="py-3 px-3 min-w-[180px]">วันพิพากษา &amp; ผลคำพิพากษา</th>
                  <th className="py-3 px-3 min-w-[135px]">ครบกำหนดอุทธรณ์</th>
                  <th className="py-3 px-3 min-w-[155px]">ระยะเวลาคงเหลือ</th>
                  <th className="py-3 px-3 min-w-[230px] text-right">สถานะ &amp; การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredEntries.map((entry, index) => {
                  const c = entry.caseItem;
                  const outcomePreview = (c.judgmentOutcome || c.fullJudgmentText || '').trim();

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/90 transition-colors align-top"
                    >
                      {/* 1. ลำดับ */}
                      <td className="py-3.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                        {index + 1}
                      </td>

                      {/* 2. เลขคดีดำ / แดง / ส.1-ส.4 */}
                      <td className="py-3.5 px-3 space-y-1">
                        <div className="font-bold text-slate-950 font-['Prompt'] tabular-nums">
                          ดำ {c.blackCaseNo}
                        </div>
                        {c.redCaseNo && (
                          <div className="text-xs font-bold text-rose-700 tabular-nums">
                            แดง {c.redCaseNo}
                          </div>
                        )}
                        {(c.receivedNumberS1 || c.filingNumberS4) && (
                          <div className="text-xs text-slate-600 tabular-nums">
                            {c.receivedNumberS1 ? `ส.1: ${c.receivedNumberS1}` : ''}
                            {c.receivedNumberS1 && c.filingNumberS4 ? ' · ' : ''}
                            {c.filingNumberS4 ? `ส.4: ${c.filingNumberS4}` : ''}
                          </div>
                        )}
                      </td>

                      {/* 3. จำเลย / ประเภทคดี */}
                      <td className="py-3.5 px-3 space-y-1">
                        <div className="font-semibold text-slate-900">
                          {c.defendant || '-'}
                        </div>
                        <div className="text-xs text-slate-600">
                          {c.caseType || 'อาญา'} · {entry.pleaLabel}
                        </div>
                      </td>

                      {/* 4. อัยการเจ้าของสำนวน */}
                      <td className="py-3.5 px-3 space-y-1">
                        <div className="font-bold text-blue-900">
                          {entry.ownerProsecutor}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          ฟ้อง: {formatThaiDate(c.filingDate)}
                        </div>
                      </td>

                      {/* 5. วันพิพากษา & ผลคำพิพากษา */}
                      <td className="py-3.5 px-3 space-y-1 max-w-[260px]">
                        <div className="text-xs font-bold text-slate-800 tabular-nums">
                          พิพากษา: {formatThaiDate(c.judgmentDate)}
                        </div>
                        <div
                          className="text-xs text-slate-600 line-clamp-2"
                          title={outcomePreview || 'ยังไม่กรอกรายละเอียดคำพิพากษา'}
                        >
                          {outcomePreview || 'ยังไม่กรอกข้อความคำพิพากษา'}
                        </div>
                      </td>

                      {/* 6. วันครบกำหนดอุทธรณ์ */}
                      <td className="py-3.5 px-3 space-y-1">
                        <div className="font-bold text-slate-950 tabular-nums">
                          {formatThaiDate(entry.effectiveDeadline)}
                        </div>
                        {entry.isExtended && (
                          <div className="text-xs font-semibold text-amber-800">
                            ขยายเวลาครั้งที่ {c.extensionCount || 1}
                          </div>
                        )}
                      </td>

                      {/* 7. ระยะเวลาคงเหลือ */}
                      <td className="py-3.5 px-3">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold tabular-nums whitespace-nowrap ${
                            entry.urgencyLevel === 'overdue'
                              ? 'bg-rose-100 text-rose-950 border-rose-300'
                              : entry.urgencyLevel === 'due_today'
                              ? 'bg-rose-700 text-white border-rose-800'
                              : entry.urgencyLevel === 'urgent_1_3'
                              ? 'bg-orange-100 text-orange-950 border-orange-300'
                              : entry.urgencyLevel === 'exact_10'
                              ? 'bg-blue-100 text-blue-950 border-blue-300'
                              : 'bg-amber-100 text-amber-950 border-amber-300'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{entry.remainingLabel}</span>
                        </div>
                      </td>

                      {/* 8. สถานะเสนอเวรชี้ & ปุ่มจัดการ */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs font-bold text-rose-800 inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-rose-600" />
                            <span>ยังไม่กดเสนอเวรชี้</span>
                          </span>

                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {canEdit && onOpenSubmitToDuty && (
                              <button
                                type="button"
                                onClick={() => onOpenSubmitToDuty(c)}
                                className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shrink-0"
                                title="กดเสนอเวรชี้สำหรับสำนวนนี้ทันที"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>เสนอเวรชี้</span>
                              </button>
                            )}

                            {canEdit && onExtendDeadline && (
                              <button
                                type="button"
                                onClick={() => onExtendDeadline(c)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition whitespace-nowrap shrink-0"
                              >
                                <CalendarClock className="w-3.5 h-3.5" />
                                <span>ขยายเวลา</span>
                              </button>
                            )}

                            {canComplete && onMarkComplete && (
                              <button
                                type="button"
                                onClick={() => onMarkComplete(c)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition whitespace-nowrap shrink-0"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span>เสร็จสิ้น</span>
                              </button>
                            )}

                            {onEditCase && (
                              <button
                                type="button"
                                onClick={() => onEditCase(c)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition whitespace-nowrap shrink-0"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>ดู/แก้ไข</span>
                              </button>
                            )}
                          </div>
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
    </div>
  );
};
