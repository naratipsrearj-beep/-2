import React, { useState, useMemo } from 'react';
import {
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Download,
  Printer,
  Search,
  Scale,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  Eye,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Sparkles,
  ExternalLink,
  HelpCircle,
  TrendingUp,
  Info,
  Edit3,
  Save,
  X,
  CheckCircle2,
  Clock,
  Shield
} from 'lucide-react';
import { AppealCase, CourtAppointmentType } from '../types/appeal';
import { formatThaiDate, getTodayString } from '../utils/dateUtils';
import {
  getAvailableFilingMonths,
  getMonthlyProsecutorSummary,
  formatMonthlyProsecutorSummaryTsv,
  formatMonthlyProsecutorSummaryHtml,
  downloadMonthlyProsecutorCsv,
  ProsecutorMonthlySummary,
} from '../utils/monthlyProsecutorSummaryUtils';
import {
  isCaseConfessed,
  isCaseDenied,
  isCaseRequisition,
  getAppointmentLabel
} from '../utils/appointmentUtils';

interface MonthlyProsecutorSummaryViewProps {
  cases: AppealCase[];
  initialYearMonth?: string;
  onSelectCase?: (caseItem: AppealCase) => void;
  onUpdateCase?: (updatedCase: AppealCase) => Promise<void> | void;
  onQuickChangePleaStatus?: (caseItem: AppealCase, newStatus: 'confessed' | 'denied' | 'pending') => Promise<void> | void;
  onToast?: (message: string) => void;
}

export const MonthlyProsecutorSummaryView: React.FC<MonthlyProsecutorSummaryViewProps> = ({
  cases,
  initialYearMonth,
  onSelectCase,
  onUpdateCase,
  onQuickChangePleaStatus,
  onToast,
}) => {
  const availableMonths = useMemo(() => getAvailableFilingMonths(cases), [cases]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialYearMonth && availableMonths.includes(initialYearMonth)) {
      return initialYearMonth;
    }
    return availableMonths[0] || '2026-10';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlea, setFilterPlea] = useState<'all' | 'confessed' | 'denied' | 'requisition'>('all');
  const [expandedProsecutor, setExpandedProsecutor] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'excel_form' | 'excel_table' | 'tsv' | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // State สำหรับ Quick Plea Modal (ปรับปรุงคำให้การในหน้านี้)
  const [pleaModalCase, setPleaModalCase] = useState<AppealCase | null>(null);
  const [pleaModalChoice, setPleaModalChoice] = useState<'confessed' | 'denied' | 'requisition' | 'other'>('confessed');
  const [pleaModalJudgmentDate, setPleaModalJudgmentDate] = useState('');
  const [pleaModalOutcome, setPleaModalOutcome] = useState('');
  const [pleaModalApptType, setPleaModalApptType] = useState<CourtAppointmentType>('rights_protection');
  const [pleaModalApptDate, setPleaModalApptDate] = useState('');
  const [pleaModalNotes, setPleaModalNotes] = useState('');
  const [isSavingPlea, setIsSavingPlea] = useState(false);

  // คำนวณสรุปข้อมูลประจำเดือน
  const summary = useMemo(() => {
    return getMonthlyProsecutorSummary(cases, selectedMonth);
  }, [cases, selectedMonth]);

  // ตัวเลือกเดือนถัดไป / ก่อนหน้า
  const currentIndex = availableMonths.indexOf(selectedMonth);
  const hasPrevious = currentIndex < availableMonths.length - 1;
  const hasNext = currentIndex > 0;

  const handlePreviousMonth = () => {
    if (hasPrevious) {
      setSelectedMonth(availableMonths[currentIndex + 1]);
    }
  };

  const handleNextMonth = () => {
    if (hasNext) {
      setSelectedMonth(availableMonths[currentIndex - 1]);
    }
  };

  // กรองรายชื่ออัยการตามการค้นหาและตัวกรอง
  const filteredProsecutors = useMemo(() => {
    return summary.prosecutors.filter((p) => {
      // ค้นหาตามชื่อ
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.prosecutorName.toLowerCase().includes(q)) {
          return false;
        }
      }

      // กรองตามประเภท
      if (filterPlea === 'confessed' && p.confessedCases === 0) return false;
      if (filterPlea === 'denied' && p.deniedCases === 0) return false;
      if (filterPlea === 'requisition' && p.requisitionCases === 0) return false;

      return true;
    });
  }, [summary.prosecutors, searchQuery, filterPlea]);

  // คัดลอกข้อมูลสำหรับวางลงฟอร์ม Excel ที่มีอยู่แล้ว (ไม่มีหัวตาราง ไม่ติดเส้นขอบ)
  const handleCopyForExcelForm = async () => {
    try {
      const htmlText = formatMonthlyProsecutorSummaryHtml(summary, { forExistingForm: true, includeHeader: false, includeTotal: false });
      const tsvText = formatMonthlyProsecutorSummaryTsv(summary, { forExistingForm: true, includeHeader: false, includeTotal: false });

      if (navigator.clipboard && (window as any).ClipboardItem) {
        try {
          const htmlBlob = new Blob([htmlText], { type: 'text/html' });
          const textBlob = new Blob([tsvText], { type: 'text/plain' });
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({
              'text/html': htmlBlob,
              'text/plain': textBlob,
            }),
          ]);
        } catch {
          await navigator.clipboard.writeText(tsvText);
        }
      } else {
        await navigator.clipboard.writeText(tsvText);
      }

      setCopiedType('excel_form');
      setTimeout(() => setCopiedType(null), 2500);
      if (onToast) {
        onToast(`📋 คัดลอกข้อมูลสรุปประจำเดือน ${summary.monthLabel} สำหรับวางลงฟอร์ม Excel แล้ว! (ไม่มีหัวตาราง/ไม่ติดกรอบ กด Ctrl+V ได้เลย)`);
      }
    } catch {
      if (onToast) onToast('ไม่สามารถคัดลอกได้ โปรดลองอีกครั้ง');
    }
  };

  // คัดลอกตารางสรุปแบบครบชุด (มีหัวตาราง)
  const handleCopyForExcelFull = async () => {
    try {
      const htmlText = formatMonthlyProsecutorSummaryHtml(summary, { forExistingForm: false, includeHeader: true, includeTotal: true });
      const tsvText = formatMonthlyProsecutorSummaryTsv(summary, { forExistingForm: false, includeHeader: true, includeTotal: true });

      if (navigator.clipboard && (window as any).ClipboardItem) {
        try {
          const htmlBlob = new Blob([htmlText], { type: 'text/html' });
          const textBlob = new Blob([tsvText], { type: 'text/plain' });
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({
              'text/html': htmlBlob,
              'text/plain': textBlob,
            }),
          ]);
        } catch {
          await navigator.clipboard.writeText(tsvText);
        }
      } else {
        await navigator.clipboard.writeText(tsvText);
      }

      setCopiedType('excel_table');
      setTimeout(() => setCopiedType(null), 2500);
      if (onToast) {
        onToast(`คัดลอกตารางสรุปประจำเดือน ${summary.monthLabel} ครบชุด (มีหัวตาราง) สำหรับ Excel แล้ว!`);
      }
    } catch {
      if (onToast) onToast('ไม่สามารถคัดลอกได้ โปรดลองอีกครั้ง');
    }
  };

  // คัดลอกเฉพาะข้อความล้วน TSV
  const handleCopyTsv = async () => {
    try {
      const tsvText = formatMonthlyProsecutorSummaryTsv(summary, { forExistingForm: true, includeHeader: false });
      await navigator.clipboard.writeText(tsvText);
      setCopiedType('tsv');
      setTimeout(() => setCopiedType(null), 2500);
      if (onToast) {
        onToast(`คัดลอกข้อความสรุป TSV ประจำเดือน ${summary.monthLabel} แล้ว!`);
      }
    } catch {
      if (onToast) onToast('ไม่สามารถคัดลอกได้ โปรดลองอีกครั้ง');
    }
  };

  // ดาวน์โหลดไฟล์ CSV
  const handleDownloadCsv = () => {
    downloadMonthlyProsecutorCsv(summary);
    if (onToast) {
      onToast(`ดาวน์โหลดไฟล์ CSV สรุปประจำเดือน ${summary.monthLabel} เรียบร้อยแล้ว`);
    }
  };

  // 1-Click ปรับปรุงคำให้การด่วนในหน้านี้ (รับสารภาพ หรือ ปฏิเสธ)
  const handleQuickPleaClick = async (c: AppealCase, targetPlea: 'confessed' | 'denied') => {
    try {
      if (onQuickChangePleaStatus) {
        await onQuickChangePleaStatus(c, targetPlea);
        return;
      }

      let updatedCase: AppealCase;
      if (targetPlea === 'confessed') {
        updatedCase = {
          ...c,
          defendantPlea: 'confessed',
          isRequisitionCase: false,
          appointmentType: (c.appointmentType === 'rights_protection' || c.appointmentType === 'requisition') ? 'none' : c.appointmentType,
          updatedAt: new Date().toISOString(),
        };
        if (updatedCase.subsequentAppointments) {
          updatedCase.subsequentAppointments = updatedCase.subsequentAppointments.filter((a) => a.type !== 'rights_protection');
        }
      } else {
        updatedCase = {
          ...c,
          defendantPlea: 'denied',
          isRequisitionCase: false,
          hasJudgment: false,
          appointmentType: (!c.appointmentType || c.appointmentType === 'none' || c.appointmentType === 'requisition') ? 'rights_protection' : c.appointmentType,
          appointmentTypeName: (!c.appointmentType || c.appointmentType === 'none' || c.appointmentType === 'requisition') ? 'นัดคุ้มครองสิทธิ' : c.appointmentTypeName,
          appointmentDate: c.appointmentDate || getTodayString(),
          updatedAt: new Date().toISOString(),
        };
      }

      if (onUpdateCase) {
        await onUpdateCase(updatedCase);
      }
      const label = targetPlea === 'confessed' ? 'จำเลยรับสารภาพ (สีเหลือง)' : 'จำเลยให้การปฏิเสธ (สีส้ม)';
      if (onToast) {
        onToast(`ปรับปรุงคำให้การสำนวน ${c.blackCaseNo} เป็น "${label}" เรียบร้อยแล้ว ยอดสรุปสิ้นเดือนอัปเดตทันที`);
      }
    } catch (err) {
      console.error('Failed to quick change plea', err);
      if (onToast) onToast('เกิดข้อผิดพลาดในการปรับปรุงข้อมูล');
    }
  };

  // เปิด Modal ปรับปรุงคำให้การละเอียด
  const handleOpenPleaModal = (c: AppealCase) => {
    setPleaModalCase(c);
    if (isCaseConfessed(c) || c.defendantPlea === 'confessed') {
      setPleaModalChoice('confessed');
    } else if (isCaseDenied(c) || c.defendantPlea === 'denied') {
      setPleaModalChoice('denied');
    } else if (isCaseRequisition(c)) {
      setPleaModalChoice('requisition');
    } else {
      setPleaModalChoice('other');
    }
    setPleaModalJudgmentDate(c.judgmentDate || '');
    setPleaModalOutcome(c.judgmentOutcome || '');
    setPleaModalApptType(c.appointmentType && c.appointmentType !== 'none' ? c.appointmentType : 'rights_protection');
    setPleaModalApptDate(c.appointmentDate || getTodayString());
    setPleaModalNotes(c.notes || '');
  };

  // บันทึกคำให้การจาก Modal
  const handleSavePleaModal = async () => {
    if (!pleaModalCase) return;
    setIsSavingPlea(true);
    try {
      let updatedCase: AppealCase;
      if (pleaModalChoice === 'confessed') {
        updatedCase = {
          ...pleaModalCase,
          defendantPlea: 'confessed',
          isRequisitionCase: false,
          hasJudgment: Boolean(pleaModalJudgmentDate),
          judgmentDate: pleaModalJudgmentDate || pleaModalCase.judgmentDate,
          judgmentOutcome: pleaModalOutcome || pleaModalCase.judgmentOutcome || 'จำเลยรับสารภาพ',
          appointmentType: (pleaModalCase.appointmentType === 'rights_protection' || pleaModalCase.appointmentType === 'requisition') ? 'none' : pleaModalCase.appointmentType,
          notes: pleaModalNotes || pleaModalCase.notes,
          updatedAt: new Date().toISOString(),
        };
        if (updatedCase.subsequentAppointments) {
          updatedCase.subsequentAppointments = updatedCase.subsequentAppointments.filter((a) => a.type !== 'rights_protection');
        }
      } else if (pleaModalChoice === 'denied') {
        updatedCase = {
          ...pleaModalCase,
          defendantPlea: 'denied',
          isRequisitionCase: false,
          hasJudgment: false,
          appointmentType: pleaModalApptType,
          appointmentTypeName: pleaModalApptType === 'rights_protection' ? 'นัดคุ้มครองสิทธิ' : undefined,
          appointmentDate: pleaModalApptDate || getTodayString(),
          notes: pleaModalNotes || pleaModalCase.notes,
          updatedAt: new Date().toISOString(),
        };
      } else if (pleaModalChoice === 'requisition') {
        updatedCase = {
          ...pleaModalCase,
          defendantPlea: 'pending',
          isRequisitionCase: true,
          appointmentType: 'requisition',
          appointmentDate: pleaModalApptDate || pleaModalCase.appointmentDate,
          notes: pleaModalNotes || pleaModalCase.notes,
          updatedAt: new Date().toISOString(),
        };
      } else {
        updatedCase = {
          ...pleaModalCase,
          defendantPlea: 'pending',
          isRequisitionCase: false,
          appointmentType: pleaModalApptType !== 'requisition' ? pleaModalApptType : 'other',
          appointmentDate: pleaModalApptDate || pleaModalCase.appointmentDate,
          notes: pleaModalNotes || pleaModalCase.notes,
          updatedAt: new Date().toISOString(),
        };
      }

      if (onUpdateCase) {
        await onUpdateCase(updatedCase);
      } else if (onQuickChangePleaStatus) {
        await onQuickChangePleaStatus(
          pleaModalCase,
          pleaModalChoice === 'confessed' ? 'confessed' : pleaModalChoice === 'denied' ? 'denied' : 'pending'
        );
      }

      const choiceLabel =
        pleaModalChoice === 'confessed'
          ? 'จำเลยรับสารภาพ (สีเหลือง)'
          : pleaModalChoice === 'denied'
          ? 'จำเลยให้การปฏิเสธ (สีส้ม)'
          : pleaModalChoice === 'requisition'
          ? 'สำนวนมีเบิกฟ้อง (สีเขียว)'
          : 'สำนวนมีนัดอื่นๆ';

      if (onToast) {
        onToast(`ปรับปรุงคำให้การสำนวนคดีดำ ${pleaModalCase.blackCaseNo} เป็น "${choiceLabel}" เรียบร้อยแล้ว ยอดสรุปสิ้นเดือนอัปเดตทันที`);
      }
      setPleaModalCase(null);
    } catch (err) {
      console.error('Failed to save plea modal', err);
      if (onToast) onToast('เกิดข้อผิดพลาดในการบันทึกคำให้การ');
    } finally {
      setIsSavingPlea(false);
    }
  };

  // สูงสุดเพื่อทำ progress bar
  const maxCases = summary.prosecutors.length > 0 ? summary.prosecutors[0].totalCases : 1;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                <span>📊</span>
                <span>สรุปสิ้นเดือน / ประจำเดือน</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-400/20">
                แยกตามอัยการเจ้าของสำนวน
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5 flex-wrap">
              <span>สรุปปริมาณคดีที่ฟ้องประจำเดือน</span>
              <span className="text-amber-400 underline decoration-amber-400/40 underline-offset-4">
                {summary.monthLabel}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              สรุปจำนวนคดีที่ฟ้องทั้งหมดในรอบเดือน แยกตามอัยการเจ้าของสำนวนแต่ละคน พร้อมสถิติจำเลยรับสารภาพ (สีเหลือง) และปฏิเสธ (สีส้ม) อย่างชัดเจน
            </p>
          </div>

          {/* Month Selector Controls & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* Month Navigator */}
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-1.5 flex items-center gap-1 shadow-md">
              <button
                type="button"
                onClick={handlePreviousMonth}
                disabled={!hasPrevious}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/70 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex-1 sm:flex-none">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs sm:text-sm px-3 py-1.5 rounded-xl appearance-none pr-8 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 text-center w-full"
                >
                  {availableMonths.map((ym) => (
                    <option key={ym} value={ym} className="bg-slate-900 text-white">
                      {ym === availableMonths[0] ? `⭐️ ${summary.yearMonth === ym ? 'เดือนปัจจุบัน: ' : ''}` : ''}
                      {ym} ({formatThaiDate(`${ym}-01`, { includeYear: true }).replace(/^[0-9]+ /, '')})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={!hasNext}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/70 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                title="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons: Copy to Excel & Print */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={handleCopyForExcelForm}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                  copiedType === 'excel_form'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-emerald-900/30'
                }`}
                title="คัดลอกตารางสรุปรายอัยการสำหรับนำไปวางในแบบฟอร์ม Excel (Ctrl+V) ไม่เป็นตาราง/ไม่มีหัวตาราง"
              >
                {copiedType === 'excel_form' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-emerald-200" />}
                <span>{copiedType === 'excel_form' ? 'คัดลอกแล้ว!' : '📋 วางลงฟอร์ม Excel'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                title="พิมพ์หรือดูแบบบันทึกข้อความสรุปสิ้นเดือนเสนออัยการจังหวัด"
              >
                <Printer className="w-4 h-4 text-indigo-300" />
                <span className="hidden sm:inline">พิมพ์รายงาน</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="p-2.5 rounded-2xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center shadow-sm cursor-pointer"
                title="ดาวน์โหลดไฟล์ CSV (เปิดได้ทั้ง Excel และ Google Sheets)"
              >
                <Download className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Total Cases Filed in Month */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm col-span-2 lg:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>คดีที่ฟ้องทั้งหมด</span>
            <div className="p-2 rounded-2xl bg-indigo-50 text-indigo-700">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900">{summary.totalCases}</span>
              <span className="text-xs text-slate-500 font-medium">สำนวน</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
              <span>ประจำเดือน {summary.monthLabelShort}</span>
            </div>
          </div>
        </div>

        {/* 2. Confessed Cases (สีเหลือง) */}
        <div className="bg-amber-50/50 rounded-3xl p-4 sm:p-5 border border-yellow-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-yellow-900 text-xs font-bold mb-2">
            <span className="flex items-center gap-1">
              <span>⚖️</span>
              <span>จำเลยรับสารภาพ</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-950 font-black text-[11px]">
              {summary.confessedPercent}%
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-yellow-900">{summary.totalConfessed}</span>
              <span className="text-xs text-yellow-800 font-medium">สำนวน</span>
            </div>
            <div className="mt-2 text-[11px] text-yellow-800">
              ศาลมีคำพิพากษาตามคำรับ
            </div>
          </div>
        </div>

        {/* 3. Denied Cases (สีส้ม) */}
        <div className="bg-orange-50/50 rounded-3xl p-4 sm:p-5 border border-orange-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-orange-950 text-xs font-bold mb-2">
            <span className="flex items-center gap-1">
              <span>🛡️</span>
              <span>จำเลยปฏิเสธ</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-orange-200 text-orange-950 font-black text-[11px]">
              {summary.deniedPercent}%
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-orange-900">{summary.totalDenied}</span>
              <span className="text-xs text-orange-800 font-medium">สำนวน</span>
            </div>
            <div className="mt-2 text-[11px] text-orange-800">
              มีนัดคุ้มครองสิทธิ / สืบพยานต่อ
            </div>
          </div>
        </div>

        {/* 4. Requisition Cases (สีเขียว) */}
        <div className="bg-emerald-50/50 rounded-3xl p-4 sm:p-5 border border-emerald-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-950 text-xs font-bold mb-2">
            <span className="flex items-center gap-1">
              <span>🚚</span>
              <span>สำนวนมีเบิกฟ้อง</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-950 font-black text-[11px]">
              {summary.totalCases > 0 ? Math.round((summary.totalRequisition / summary.totalCases) * 100) : 0}%
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-emerald-900">{summary.totalRequisition}</span>
              <span className="text-xs text-emerald-800 font-medium">สำนวน</span>
            </div>
            <div className="mt-2 text-[11px] text-emerald-800">
              อยู่ระหว่างรอเบิกตัวจำเลย
            </div>
          </div>
        </div>

        {/* 5. Prosecutors Active */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-2">
            <span>อัยการเจ้าของสำนวน</span>
            <div className="p-2 rounded-2xl bg-slate-100 text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900">{summary.prosecutors.length}</span>
              <span className="text-xs text-slate-500 font-medium">ท่าน</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              เฉลี่ย {summary.prosecutors.length > 0 ? (summary.totalCases / summary.prosecutors.length).toFixed(1) : 0} สำนวน/คน
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Comparative Proportion Visualizer Bar */}
      {summary.totalCases > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>สัดส่วนผลคำให้การจำเลยในภาพรวมประจำเดือน {summary.monthLabel}:</span>
            </span>
            <div className="flex items-center gap-3 text-xs flex-wrap font-medium">
              <span className="flex items-center gap-1.5 text-yellow-900">
                <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
                <span>รับสารภาพ: {summary.totalConfessed} ({summary.confessedPercent}%)</span>
              </span>
              <span className="flex items-center gap-1.5 text-orange-950">
                <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
                <span>ปฏิเสธ: {summary.totalDenied} ({summary.deniedPercent}%)</span>
              </span>
              {summary.totalRequisition > 0 && (
                <span className="flex items-center gap-1.5 text-emerald-950">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                  <span>มีเบิกฟ้อง: {summary.totalRequisition}</span>
                </span>
              )}
            </div>
          </div>

          {/* Bar */}
          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${summary.confessedPercent}%` }}
              className="bg-yellow-400 hover:bg-yellow-500 transition-all cursor-pointer"
              title={`รับสารภาพ: ${summary.totalConfessed} สำนวน (${summary.confessedPercent}%)`}
            />
            <div
              style={{ width: `${summary.deniedPercent}%` }}
              className="bg-orange-400 hover:bg-orange-500 transition-all cursor-pointer"
              title={`ปฏิเสธ: ${summary.totalDenied} สำนวน (${summary.deniedPercent}%)`}
            />
            {summary.totalRequisition > 0 && (
              <div
                style={{ width: `${Math.round((summary.totalRequisition / summary.totalCases) * 100)}%` }}
                className="bg-emerald-400 hover:bg-emerald-500 transition-all cursor-pointer"
                title={`มีเบิกฟ้อง: ${summary.totalRequisition} สำนวน`}
              />
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่ออัยการเจ้าของสำนวน..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 pl-1">
            <Filter className="w-3.5 h-3.5" />
            <span>กรอง:</span>
          </span>
          <button
            type="button"
            onClick={() => setFilterPlea('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              filterPlea === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({summary.prosecutors.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterPlea('confessed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              filterPlea === 'confessed'
                ? 'bg-yellow-500 text-white'
                : 'bg-yellow-50 text-yellow-900 hover:bg-yellow-100 border border-yellow-200'
            }`}
          >
            <span>⚖️ มีรับสารภาพ</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterPlea('denied')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              filterPlea === 'denied'
                ? 'bg-orange-500 text-white'
                : 'bg-orange-50 text-orange-950 hover:bg-orange-100 border border-orange-200'
            }`}
          >
            <span>🛡️ มีปฏิเสธ</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterPlea('requisition')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              filterPlea === 'requisition'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <span>🚚 มีเบิกฟ้อง</span>
          </button>
        </div>
      </div>

      {/* Main Table: Summary by Each Prosecutor */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap bg-slate-50/60">
          <div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>ตารางสรุปปริมาณคดีและคำให้การ แยกตามอัยการเจ้าของสำนวน</span>
              <span className="text-xs text-slate-500 font-normal">
                ({filteredProsecutors.length} ท่าน)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              คลิกที่แถวของอัยการเพื่อขยายดูรายละเอียดสำนวนคดีทั้งหมดในเดือน {summary.monthLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyForExcelForm}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 ${
                copiedType === 'excel_form'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title="คัดลอกเฉพาะข้อมูลเซลล์แบบไม่เป็นตารางและไม่มีหัวตาราง เหมาะสำหรับนำไปกด Ctrl+V วางลงในแบบฟอร์ม Excel เดิมที่ตั้งตารางไว้แล้ว"
            >
              {copiedType === 'excel_form' ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span>📋 คัดลอกลงฟอร์ม Excel (ไม่มีหัวตาราง)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyForExcelFull}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-medium transition flex items-center gap-1 shadow-2xs cursor-pointer"
              title="คัดลอกตารางครบชุดพร้อมหัวตาราง"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>ตารางครบชุด</span>
            </button>

            <button
              type="button"
              onClick={handleCopyTsv}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
              title="คัดลอกเป็นข้อความล้วน TSV ไม่มีสี"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>TSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <th className="py-3 px-3 text-center w-12">ลำดับ</th>
                <th className="py-3 px-4 min-w-[200px]">อัยการเจ้าของสำนวน</th>
                <th className="py-3 px-3 text-center min-w-[130px]">
                  ปริมาณคดีที่ฟ้อง (สำนวน)
                </th>
                <th className="py-3 px-3 text-center min-w-[140px] bg-yellow-50 text-yellow-950 border-x border-yellow-200">
                  <div className="flex items-center justify-center gap-1">
                    <span>⚖️ รับสารภาพ</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-yellow-200 text-yellow-900 text-[10px] font-black">สีเหลือง</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center min-w-[140px] bg-orange-50 text-orange-950 border-r border-orange-200">
                  <div className="flex items-center justify-center gap-1">
                    <span>🛡️ ปฏิเสธ</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-orange-200 text-orange-900 text-[10px] font-black">สีส้ม</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center min-w-[130px] bg-emerald-50 text-emerald-950 border-r border-emerald-200">
                  <div className="flex items-center justify-center gap-1">
                    <span>🚚 มีเบิกฟ้อง</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-black">สีเขียว</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center min-w-[130px]">
                  สัดส่วน (รับสารภาพ/ปฏิเสธ)
                </th>
                <th className="py-3 px-3 text-center w-24">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProsecutors.length > 0 ? (
                filteredProsecutors.map((p, idx) => {
                  const isExpanded = expandedProsecutor === p.prosecutorName;
                  const ratioBarWidth = Math.max(8, Math.round((p.totalCases / maxCases) * 100));

                  return (
                    <React.Fragment key={p.prosecutorName}>
                      <tr
                        onClick={() => setExpandedProsecutor(isExpanded ? null : p.prosecutorName)}
                        className={`hover:bg-slate-50 transition cursor-pointer select-none ${
                          isExpanded ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        {/* Index */}
                        <td className="py-3 px-3 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Prosecutor Name */}
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs shrink-0">
                              {p.prosecutorName.charAt(0) || 'อ'}
                            </div>
                            <span className="text-slate-900 hover:text-indigo-600 transition">
                              {p.prosecutorName}
                            </span>
                          </div>
                        </td>

                        {/* Total Cases with Mini Bar */}
                        <td className="py-3 px-3 text-center">
                          <div className="font-black text-slate-900 text-sm">
                            {p.totalCases}
                          </div>
                          <div className="w-16 mx-auto bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-1.5 rounded-full"
                              style={{ width: `${ratioBarWidth}%` }}
                            />
                          </div>
                        </td>

                        {/* Confessed Cases (สีเหลือง) */}
                        <td className="py-3 px-3 text-center bg-yellow-50/70 border-x border-yellow-200">
                          <span
                            className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full font-black text-xs shadow-2xs ${
                              p.confessedCases > 0
                                ? 'bg-yellow-200 text-yellow-950 border border-yellow-400'
                                : 'text-slate-400 font-normal'
                            }`}
                          >
                            {p.confessedCases > 0 ? `${p.confessedCases} สำนวน` : '-'}
                          </span>
                        </td>

                        {/* Denied Cases (สีส้ม) */}
                        <td className="py-3 px-3 text-center bg-orange-50/70 border-r border-orange-200">
                          <span
                            className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full font-black text-xs shadow-2xs ${
                              p.deniedCases > 0
                                ? 'bg-orange-200 text-orange-950 border border-orange-400'
                                : 'text-slate-400 font-normal'
                            }`}
                          >
                            {p.deniedCases > 0 ? `${p.deniedCases} สำนวน` : '-'}
                          </span>
                        </td>

                        {/* Requisition Cases (สีเขียว) */}
                        <td className="py-3 px-3 text-center bg-emerald-50/70 border-r border-emerald-200">
                          <span
                            className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full font-black text-xs shadow-2xs ${
                              p.requisitionCases > 0
                                ? 'bg-emerald-200 text-emerald-950 border border-emerald-400'
                                : 'text-slate-400 font-normal'
                            }`}
                          >
                            {p.requisitionCases > 0 ? `${p.requisitionCases} สำนวน` : '-'}
                          </span>
                        </td>

                        {/* Ratio Visualizer */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                            <span className="text-yellow-800">{p.confessedPercent}%</span>
                            <span className="text-slate-300">/</span>
                            <span className="text-orange-900">{p.deniedPercent}%</span>
                          </div>
                          <div className="w-20 mx-auto h-2 bg-slate-100 rounded-full mt-1 flex overflow-hidden">
                            <div
                              style={{ width: `${p.confessedPercent}%` }}
                              className="bg-yellow-400"
                              title={`รับสารภาพ: ${p.confessedPercent}%`}
                            />
                            <div
                              style={{ width: `${p.deniedPercent}%` }}
                              className="bg-orange-400"
                              title={`ปฏิเสธ: ${p.deniedPercent}%`}
                            />
                          </div>
                        </td>

                        {/* Expand Button */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedProsecutor(isExpanded ? null : p.prosecutorName);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                            title={isExpanded ? 'ย่อรายละเอียด' : 'ดูรายชื่อคดี'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-Table: List of Cases for this Prosecutor */}
                      {isExpanded && (
                        <tr className="bg-indigo-50/20 border-b border-indigo-100">
                          <td colSpan={8} className="p-3 sm:p-5">
                            <div className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-inner space-y-3.5">
                              {/* Header & Tip Banner */}
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                                  <span>📁 รายการสำนวนคดีของ</span>
                                  <span className="text-indigo-700 underline font-black">{p.prosecutorName}</span>
                                  <span className="text-slate-500 font-normal">({p.cases.length} คดี ในเดือน {summary.monthLabel})</span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  คลิกเลขคดีเพื่อดูสำนวนเต็ม หรือกดปุ่มด้านขวาเพื่อปรับปรุงคำให้การ
                                </div>
                              </div>

                              {/* In-page Plea Update Guidance Box */}
                              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-2.5 px-3 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                  <span className="font-bold">ปรับปรุงคำให้การในหน้านี้: </span>
                                  หากเดิมทีเป็น <strong>สำนวนมีนัดอื่นๆ</strong> หรือ <strong>สำนวนมีเบิกฟ้อง</strong> แล้วต่อมาทราบว่าจำเลยให้การรับสารภาพ หรือปฏิเสธ สามารถกดปุ่ม <span className="inline-flex items-center px-1.5 py-0.2 rounded font-bold bg-yellow-200 text-yellow-950 border border-yellow-300 text-[11px]">🟡 รับสารภาพ</span> หรือ <span className="inline-flex items-center px-1.5 py-0.2 rounded font-bold bg-orange-200 text-orange-950 border border-orange-300 text-[11px]">🟠 ปฏิเสธ</span> ได้ทันที ยอดรวมสถิติสิ้นเดือนจะอัปเดตตรงตามข้อมูลจริงทันที
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                                      <th className="py-2.5 px-2.5 text-center w-10">ลำดับ</th>
                                      <th className="py-2.5 px-3 text-center whitespace-nowrap">วันที่ฟ้อง</th>
                                      <th className="py-2.5 px-3 whitespace-nowrap">เลขคดีดำ</th>
                                      <th className="py-2.5 px-3 whitespace-nowrap">เลขคดีแดง</th>
                                      <th className="py-2.5 px-3 min-w-[140px]">ผู้ต้องหา / จำเลย</th>
                                      <th className="py-2.5 px-3 text-center min-w-[150px]">คำให้การ / สถานะปัจจุบัน</th>
                                      <th className="py-2.5 px-3 text-center min-w-[260px] bg-indigo-50/70 border-x border-indigo-100 text-indigo-950">
                                        ✏️ ปรับปรุงคำให้การในหน้านี้ (รับสารภาพ / ปฏิเสธ)
                                      </th>
                                      <th className="py-2.5 px-3 text-center w-24">ศาล / จัดการ</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {p.cases.map((c, cIdx) => {
                                      const isConf = isCaseConfessed(c);
                                      const isDen = isCaseDenied(c);
                                      const isReq = isCaseRequisition(c);

                                      let badgeBg = 'bg-slate-100 text-slate-800 border-slate-300';
                                      let statusLabel = 'สำนวนมีนัดต่อ';
                                      let statusIcon = '📅';

                                      if (isConf) {
                                        badgeBg = 'bg-yellow-100 text-yellow-950 border-yellow-300 font-bold';
                                        statusLabel = 'จำเลยรับสารภาพ';
                                        statusIcon = '⚖️';
                                      } else if (isDen) {
                                        badgeBg = 'bg-orange-100 text-orange-950 border-orange-300 font-bold';
                                        statusLabel = 'จำเลยปฏิเสธ';
                                        statusIcon = '🛡️';
                                      } else if (isReq) {
                                        badgeBg = 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold';
                                        statusLabel = 'สำนวนมีเบิกฟ้อง';
                                        statusIcon = '🚚';
                                      }

                                      return (
                                        <tr
                                          key={c.id || cIdx}
                                          className="hover:bg-slate-50/90 transition select-none"
                                        >
                                          {/* Index */}
                                          <td className="py-2.5 px-2.5 text-center text-slate-400 font-medium">
                                            {cIdx + 1}
                                          </td>

                                          {/* Filing Date */}
                                          <td className="py-2.5 px-3 text-center text-slate-600 whitespace-nowrap">
                                            {formatThaiDate(c.filingDate, { short: true })}
                                          </td>

                                          {/* Black Case No */}
                                          <td
                                            className="py-2.5 px-3 font-bold text-indigo-700 whitespace-nowrap cursor-pointer hover:underline"
                                            onClick={() => onSelectCase && onSelectCase(c)}
                                            title="คลิกเพื่อเปิดแก้ไขรายละเอียดสำนวนเต็ม"
                                          >
                                            {c.blackCaseNo}
                                          </td>

                                          {/* Red Case No */}
                                          <td className="py-2.5 px-3 whitespace-nowrap font-medium text-rose-700">
                                            {c.redCaseNo && c.redCaseNo !== '-' ? c.redCaseNo : <span className="text-slate-400">-</span>}
                                          </td>

                                          {/* Defendant */}
                                          <td className="py-2.5 px-3 text-slate-800 max-w-xs truncate" title={c.defendant}>
                                            {c.defendant}
                                          </td>

                                          {/* Current Status Badge */}
                                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border shadow-2xs ${badgeBg}`}>
                                              <span>{statusIcon}</span>
                                              <span>{statusLabel}</span>
                                            </span>
                                          </td>

                                          {/* Quick Plea Modifier in this page */}
                                          <td className="py-2 px-3 text-center bg-indigo-50/30 border-x border-indigo-100">
                                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                              {/* 1. Button: รับสารภาพ */}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleQuickPleaClick(c, 'confessed');
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 ${
                                                  isConf
                                                    ? 'bg-yellow-400 text-yellow-950 border border-yellow-500 ring-2 ring-yellow-400/50'
                                                    : 'bg-white hover:bg-yellow-100 text-yellow-900 border border-yellow-300'
                                                }`}
                                                title="ปรับเป็น จำเลยรับสารภาพ (สีเหลือง)"
                                              >
                                                {isConf ? (
                                                  <Check className="w-3 h-3 text-yellow-950 stroke-[3]" />
                                                ) : (
                                                  <span>⚖️</span>
                                                )}
                                                <span>รับสารภาพ</span>
                                              </button>

                                              {/* 2. Button: ปฏิเสธ */}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleQuickPleaClick(c, 'denied');
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 ${
                                                  isDen
                                                    ? 'bg-orange-400 text-orange-950 border border-orange-500 ring-2 ring-orange-400/50'
                                                    : 'bg-white hover:bg-orange-100 text-orange-950 border border-orange-300'
                                                }`}
                                                title="ปรับเป็น จำเลยปฏิเสธ (สีส้ม)"
                                              >
                                                {isDen ? (
                                                  <Check className="w-3 h-3 text-orange-950 stroke-[3]" />
                                                ) : (
                                                  <span>🛡️</span>
                                                )}
                                                <span>ปฏิเสธ</span>
                                              </button>

                                              {/* 3. Button: ระบุรายละเอียด / วันนัด */}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenPleaModal(c);
                                                }}
                                                className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 transition text-[11px] font-medium flex items-center gap-0.5 cursor-pointer shadow-2xs"
                                                title="ระบุวันนัด / วันที่พิพากษา / หมายเหตุคำให้การ"
                                              >
                                                <Edit3 className="w-3 h-3" />
                                                <span>รายละเอียด</span>
                                              </button>
                                            </div>
                                          </td>

                                          {/* Court & Actions */}
                                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1.5">
                                              <span className="text-slate-600 text-[11px]">{c.court}</span>
                                              <button
                                                type="button"
                                                onClick={() => onSelectCase && onSelectCase(c)}
                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                                                title="เปิดดูสำนวนเต็ม"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <div>ไม่พบข้อมูลคดีที่ฟ้องในเดือน {summary.monthLabel}</div>
                    <div className="text-[11px] text-slate-400 mt-1">โปรดเลือกเดือนอื่นจากเมนูด้านบน</div>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Total Footer */}
            {summary.totalCases > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700 text-xs sm:text-sm">
                  <td colSpan={2} className="py-3.5 px-4 text-center font-black">
                    รวมทั้งสิ้น ({summary.prosecutors.length} ท่าน)
                  </td>
                  <td className="py-3.5 px-3 text-center font-black text-white text-base">
                    {summary.totalCases}
                  </td>
                  <td className="py-3.5 px-3 text-center bg-yellow-400 text-yellow-950 font-black text-base border-x border-yellow-500">
                    {summary.totalConfessed}
                  </td>
                  <td className="py-3.5 px-3 text-center bg-orange-400 text-orange-950 font-black text-base border-r border-orange-500">
                    {summary.totalDenied}
                  </td>
                  <td className="py-3.5 px-3 text-center bg-emerald-400 text-emerald-950 font-black text-base border-r border-emerald-500">
                    {summary.totalRequisition}
                  </td>
                  <td className="py-3.5 px-3 text-center text-amber-300 font-bold">
                    {summary.confessedPercent}% / {summary.deniedPercent}%
                  </td>
                  <td className="py-3.5 px-3 text-center text-slate-400 text-xs">
                    -
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Printable Memo Report Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm sm:text-base">
                  บันทึกข้อความรายงานสรุปสิ้นเดือน เสนออัยการจังหวัด
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>พิมพ์เอกสาร</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Document Body (Designed as Official Government Memo) */}
            <div className="p-6 sm:p-10 overflow-y-auto flex-1 font-serif text-slate-900 space-y-6 text-sm bg-white print:p-0">
              {/* Garuda Header */}
              <div className="text-center space-y-1">
                <div className="text-2xl font-black">บันทึกข้อความ</div>
                <div className="text-xs text-slate-500">สำนักงานอัยการ</div>
              </div>

              <div className="border-b-2 border-slate-900 pb-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <div><strong>ส่วนราชการ:</strong> สำนักงานคดี / สำนักงานอัยการ</div>
                  <div><strong>วันที่:</strong> สิ้นเดือน {summary.monthLabel}</div>
                </div>
                <div><strong>เรื่อง:</strong> สรุปปริมาณคดีที่ยื่นฟ้องต่อศาลและคำให้การของจำเลย ประจำเดือน {summary.monthLabel}</div>
                <div><strong>เรียน:</strong> อัยการจังหวัด</div>
              </div>

              <p className="indent-8 leading-relaxed text-xs sm:text-sm">
                ตามที่สำนักงานได้ดำเนินการรับฟ้องคดีอาญาในรอบเดือน <strong>{summary.monthLabel}</strong> นั้น ขอรายงานสรุปปริมาณคดีที่ฟ้องต่อศาลแยกตามอัยการเจ้าของสำนวนแต่ละคน โดยมีรายละเอียดคำให้การของจำเลย (รับสารภาพและปฏิเสธ) ดังนี้
              </p>

              {/* Table in Memo */}
              <table className="w-full border-collapse border border-slate-900 text-xs">
                <thead>
                  <tr className="bg-slate-100 font-bold text-center">
                    <th className="border border-slate-900 p-2 w-10">ลำดับ</th>
                    <th className="border border-slate-900 p-2 text-left">อัยการเจ้าของสำนวน</th>
                    <th className="border border-slate-900 p-2 w-24">คดีที่ฟ้อง (สำนวน)</th>
                    <th className="border border-slate-900 p-2 w-24">รับสารภาพ (สำนวน)</th>
                    <th className="border border-slate-900 p-2 w-24">ปฏิเสธ (สำนวน)</th>
                    <th className="border border-slate-900 p-2 w-24">มีเบิกฟ้อง (สำนวน)</th>
                    <th className="border border-slate-900 p-2 w-20">% รับสารภาพ</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.prosecutors.map((p, idx) => (
                    <tr key={p.prosecutorName}>
                      <td className="border border-slate-900 p-2 text-center">{idx + 1}</td>
                      <td className="border border-slate-900 p-2 font-medium">{p.prosecutorName}</td>
                      <td className="border border-slate-900 p-2 text-center font-bold">{p.totalCases}</td>
                      <td className="border border-slate-900 p-2 text-center">{p.confessedCases}</td>
                      <td className="border border-slate-900 p-2 text-center">{p.deniedCases}</td>
                      <td className="border border-slate-900 p-2 text-center">{p.requisitionCases}</td>
                      <td className="border border-slate-900 p-2 text-center">{p.confessedPercent}%</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-slate-100">
                    <td colSpan={2} className="border border-slate-900 p-2 text-center">รวมทั้งสิ้น ({summary.prosecutors.length} ท่าน)</td>
                    <td className="border border-slate-900 p-2 text-center">{summary.totalCases}</td>
                    <td className="border border-slate-900 p-2 text-center">{summary.totalConfessed}</td>
                    <td className="border border-slate-900 p-2 text-center">{summary.totalDenied}</td>
                    <td className="border border-slate-900 p-2 text-center">{summary.totalRequisition}</td>
                    <td className="border border-slate-900 p-2 text-center">{summary.confessedPercent}%</td>
                  </tr>
                </tbody>
              </table>

              <div className="pt-8 flex justify-end">
                <div className="text-center space-y-8 text-xs">
                  <div>จึงเรียนมาเพื่อโปรดทราบ</div>
                  <div>
                    <div className="border-b border-dotted border-slate-400 w-48 mx-auto mb-1" />
                    <div>(......................................................)</div>
                    <div className="text-slate-500 mt-0.5">ผู้จัดทำรายงานสรุปประจำเดือน</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Plea Modal: สำหรับปรับปรุงคำให้การในหน้านี้ (รับสารภาพ/ปฏิเสธ/มีเบิกฟ้อง/นัดอื่นๆ) */}
      {pleaModalCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                  <Scale className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base font-['Prompt']">
                    ปรับปรุงผลคำให้การจำเลย
                  </h3>
                  <p className="text-xs text-slate-300">
                    คดีดำ <span className="text-amber-300 font-bold">{pleaModalCase.blackCaseNo}</span> • {pleaModalCase.defendant}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPleaModalCase(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
              {/* Previous status & prosecutor info */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex justify-between items-center text-slate-600">
                  <span>อัยการเจ้าของสำนวน:</span>
                  <span className="font-bold text-slate-900">{pleaModalCase.responsiblePerson || pleaModalCase.prosecutorName || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>วันที่ฟ้อง:</span>
                  <span className="font-semibold text-slate-800">{formatThaiDate(pleaModalCase.filingDate)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-200/80">
                  <span>สถานะเดิมของสำนวน:</span>
                  <span className="font-bold text-indigo-700">
                    {isCaseConfessed(pleaModalCase)
                      ? '🟡 จำเลยรับสารภาพ'
                      : isCaseDenied(pleaModalCase)
                      ? '🟠 จำเลยปฏิเสธ'
                      : isCaseRequisition(pleaModalCase)
                      ? '🟢 สำนวนมีเบิกฟ้อง'
                      : '🔵 สำนวนมีนัดอื่นๆ / รอผล'}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-slate-600 text-xs">
                หากเดิมทีเป็นสำนวนมีนัดอื่นๆ หรือเบิกฟ้อง ต่อมาทราบแล้วว่าจำเลยให้การอย่างไร ให้เลือกสถานะที่ถูกต้องด้านล่าง:
              </div>

              {/* Choice Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Confessed */}
                <button
                  type="button"
                  onClick={() => setPleaModalChoice('confessed')}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                    pleaModalChoice === 'confessed'
                      ? 'border-yellow-400 bg-yellow-50/90 ring-2 ring-yellow-400/30'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-yellow-950 flex items-center gap-1.5">
                      <span>⚖️</span>
                      <span>จำเลยรับสารภาพ</span>
                    </span>
                    {pleaModalChoice === 'confessed' && (
                      <span className="w-4 h-4 rounded-full bg-yellow-500 text-white flex items-center justify-center text-[10px]">✓</span>
                    )}
                  </div>
                  <span className="text-[11px] text-yellow-800 leading-tight">
                    ศาลมีคำพิพากษาตามคำรับ • นับเข้ายอดรับสารภาพสีเหลือง
                  </span>
                </button>

                {/* 2. Denied */}
                <button
                  type="button"
                  onClick={() => setPleaModalChoice('denied')}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                    pleaModalChoice === 'denied'
                      ? 'border-orange-400 bg-orange-50/90 ring-2 ring-orange-400/30'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-orange-950 flex items-center gap-1.5">
                      <span>🛡️</span>
                      <span>จำเลยปฏิเสธ</span>
                    </span>
                    {pleaModalChoice === 'denied' && (
                      <span className="w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px]">✓</span>
                    )}
                  </div>
                  <span className="text-[11px] text-orange-800 leading-tight">
                    นัดคุ้มครองสิทธิ / สืบพยานต่อ • นับเข้ายอดปฏิเสธสีส้ม
                  </span>
                </button>

                {/* 3. Requisition */}
                <button
                  type="button"
                  onClick={() => setPleaModalChoice('requisition')}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                    pleaModalChoice === 'requisition'
                      ? 'border-emerald-400 bg-emerald-50/90 ring-2 ring-emerald-400/30'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                      <span>🚚</span>
                      <span>สำนวนมีเบิกฟ้อง</span>
                    </span>
                    {pleaModalChoice === 'requisition' && (
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>
                    )}
                  </div>
                  <span className="text-[11px] text-emerald-800 leading-tight">
                    รอเบิกตัวจำเลยมาฟ้อง • ยังไม่ทราบผลคำให้การ
                  </span>
                </button>

                {/* 4. Other Scheduled */}
                <button
                  type="button"
                  onClick={() => setPleaModalChoice('other')}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                    pleaModalChoice === 'other'
                      ? 'border-indigo-400 bg-indigo-50/90 ring-2 ring-indigo-400/30'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <span>📅</span>
                      <span>สำนวนมีนัดอื่นๆ</span>
                    </span>
                    {pleaModalChoice === 'other' && (
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">✓</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-600 leading-tight">
                    นัดสืบเสาะ, นัดไกล่เกลี่ย, นัดฟังคำสั่งศาล
                  </span>
                </button>
              </div>

              {/* Extra Inputs depending on choice */}
              {pleaModalChoice === 'confessed' && (
                <div className="bg-yellow-50/60 border border-yellow-200 rounded-2xl p-4 space-y-3">
                  <div className="font-bold text-yellow-950 flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-yellow-700" />
                    <span>ข้อมูลคำพิพากษา (ถ้ามี):</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-yellow-900 font-medium">วันที่ศาลอ่านคำพิพากษา (YYYY-MM-DD):</label>
                    <input
                      type="date"
                      value={pleaModalJudgmentDate}
                      onChange={(e) => setPleaModalJudgmentDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-yellow-300 bg-white text-xs focus:ring-2 focus:ring-yellow-400 text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-yellow-900 font-medium">ผลคำพิพากษาโดยย่อ (เช่น จำคุก 1 ปี ปรับ 5,000 บาท รอลงอาญา):</label>
                    <input
                      type="text"
                      value={pleaModalOutcome}
                      onChange={(e) => setPleaModalOutcome(e.target.value)}
                      placeholder="เช่น จำคุก 2 ปี ปรับ 10,000 บาท..."
                      className="w-full px-3 py-1.5 rounded-xl border border-yellow-300 bg-white text-xs focus:ring-2 focus:ring-yellow-400 text-slate-800"
                    />
                  </div>
                </div>
              )}

              {pleaModalChoice === 'denied' && (
                <div className="bg-orange-50/60 border border-orange-200 rounded-2xl p-4 space-y-3">
                  <div className="font-bold text-orange-950 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-orange-700" />
                    <span>ข้อมูลขั้นตอนนัดศาลหลังจำเลยปฏิเสธ:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] text-orange-900 font-medium">ประเภทนัด:</label>
                      <select
                        value={pleaModalApptType}
                        onChange={(e) => setPleaModalApptType(e.target.value as CourtAppointmentType)}
                        className="w-full px-3 py-1.5 rounded-xl border border-orange-300 bg-white text-xs focus:ring-2 focus:ring-orange-400 text-slate-800"
                      >
                        <option value="rights_protection">นัดคุ้มครองสิทธิ</option>
                        <option value="witness_examination">นัดสืบพยาน</option>
                        <option value="pre_trial">นัดพร้อม / ตรวจพยานหลักฐาน</option>
                        <option value="other">นัดอื่นๆ</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-orange-900 font-medium">วันนัดของศาล:</label>
                      <input
                        type="date"
                        value={pleaModalApptDate}
                        onChange={(e) => setPleaModalApptDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-orange-300 bg-white text-xs focus:ring-2 focus:ring-orange-400 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">หมายเหตุเพิ่มเติม:</label>
                <textarea
                  rows={2}
                  value={pleaModalNotes}
                  onChange={(e) => setPleaModalNotes(e.target.value)}
                  placeholder="เช่น ทราบผลคำให้การเมื่อ 10 ต.ค. 2569..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPleaModalCase(null)}
                disabled={isSavingPlea}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSavePleaModal}
                disabled={isSavingPlea}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingPlea ? 'กำลังบันทึก...' : '💾 บันทึกคำให้การ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
