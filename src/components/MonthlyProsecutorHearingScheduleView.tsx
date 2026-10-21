import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Users,
  Search,
  Filter,
  Download,
  Copy,
  Printer,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Scale,
  Shield,
  FileSpreadsheet,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  ListFilter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Send
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { getTodayString, formatThaiDate } from '../utils/dateUtils';
import {
  extractProsecutorMonthlyHearings,
  getAvailableHearingMonths,
  formatProsecutorHearingSummaryTsv,
  formatProsecutorHearingSummaryHtml,
  downloadProsecutorHearingCsv,
  TargetAppointmentCategory,
  ProsecutorHearingAppointment,
} from '../utils/monthlyProsecutorAppointmentUtils';

interface MonthlyProsecutorHearingScheduleViewProps {
  cases: AppealCase[];
  initialYearMonth?: string;
  onSelectCase?: (caseItem: AppealCase) => void;
  onOpenSubmitToDuty?: (caseItem: AppealCase) => void;
  onToast?: (message: string) => void;
}

export const MonthlyProsecutorHearingScheduleView: React.FC<MonthlyProsecutorHearingScheduleViewProps> = ({
  cases,
  initialYearMonth,
  onSelectCase,
  onOpenSubmitToDuty,
  onToast,
}) => {
  const availableMonths = useMemo(() => getAvailableHearingMonths(cases), [cases]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialYearMonth && availableMonths.includes(initialYearMonth)) {
      return initialYearMonth;
    }
    return availableMonths[0] || '2026-10';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | TargetAppointmentCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'incomplete' | 'completed' | 'submitted_duty'>('all');
  const [selectedProsecutorFilter, setSelectedProsecutorFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'by_prosecutor' | 'by_date' | 'table'>('by_prosecutor');
  const [expandedProsecutors, setExpandedProsecutors] = useState<Record<string, boolean>>({});
  const [isCopied, setIsCopied] = useState(false);

  // สกัดและสรุปข้อมูลนัดศาลประจำเดือน
  const result = useMemo(() => {
    return extractProsecutorMonthlyHearings(cases, selectedMonth);
  }, [cases, selectedMonth]);

  // วันนี้ในรูปแบบ YYYY-MM-DD
  const todayStr = useMemo(() => getTodayString(), []);

  // เดือนก่อนหน้า / ถัดไป
  const currentMonthIndex = availableMonths.indexOf(selectedMonth);
  const hasPrevious = currentMonthIndex < availableMonths.length - 1;
  const hasNext = currentMonthIndex > 0;

  const handlePrevMonth = () => {
    if (hasPrevious) setSelectedMonth(availableMonths[currentMonthIndex + 1]);
  };

  const handleNextMonth = () => {
    if (hasNext) setSelectedMonth(availableMonths[currentMonthIndex - 1]);
  };

  // Toggle expand all/individual
  const toggleProsecutorExpand = (prosecutorName: string) => {
    setExpandedProsecutors((prev) => ({
      ...prev,
      [prosecutorName]: prev[prosecutorName] === false ? true : false,
    }));
  };

  // คัดกรองข้อมูลตาม search query และ filter
  const filteredProsecutors = useMemo(() => {
    return result.prosecutors
      .filter((p) => {
        if (selectedProsecutorFilter !== 'all' && p.prosecutorName !== selectedProsecutorFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.prosecutorName.toLowerCase().includes(q);
          const matchCase = p.dateSchedules.some((ds) =>
            ds.appointments.some(
              (a) =>
                a.blackCaseNo.toLowerCase().includes(q) ||
                (a.redCaseNo && a.redCaseNo.toLowerCase().includes(q)) ||
                a.defendant.toLowerCase().includes(q) ||
                (a.courtRoom && a.courtRoom.toLowerCase().includes(q)) ||
                (a.notes && a.notes.toLowerCase().includes(q))
            )
          );
          if (!matchName && !matchCase) return false;
        }

        if (selectedCategory !== 'all') {
          if (p.countsByCategory[selectedCategory] === 0) return false;
        }

        if (statusFilter === 'incomplete' && p.countsByStatus && p.countsByStatus.incomplete === 0) {
          return false;
        }
        if (statusFilter === 'completed' && p.countsByStatus && p.countsByStatus.completed === 0) {
          return false;
        }
        if (statusFilter === 'submitted_duty' && p.countsByStatus && p.countsByStatus.submittedToDuty === 0) {
          return false;
        }

        return true;
      })
      .map((p) => {
        // กรอง appointments ภายในแต่ละ dateSchedule ให้ตรงกับ category, status และ search
        const filteredDateSchedules = p.dateSchedules
          .map((ds) => {
            const filteredAppts = ds.appointments.filter((a) => {
              if (selectedCategory !== 'all' && a.category !== selectedCategory) return false;
              if (statusFilter === 'incomplete' && a.isCompleted) return false;
              if (statusFilter === 'completed' && !a.isCompleted) return false;
              if (statusFilter === 'submitted_duty' && !a.isSubmittedToDuty) return false;

              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = a.prosecutorName.toLowerCase().includes(q);
                const matchCase =
                  a.blackCaseNo.toLowerCase().includes(q) ||
                  (a.redCaseNo && a.redCaseNo.toLowerCase().includes(q)) ||
                  a.defendant.toLowerCase().includes(q) ||
                  (a.courtRoom && a.courtRoom.toLowerCase().includes(q)) ||
                  (a.notes && a.notes.toLowerCase().includes(q));
                return matchName || matchCase;
              }
              return true;
            });

            return {
              ...ds,
              appointments: filteredAppts,
            };
          })
          .filter((ds) => ds.appointments.length > 0);

        return {
          ...p,
          dateSchedules: filteredDateSchedules,
          totalAppointments: filteredDateSchedules.reduce((acc, ds) => acc + ds.appointments.length, 0),
          uniqueDatesCount: filteredDateSchedules.length,
        };
      })
      .filter((p) => p.dateSchedules.length > 0);
  }, [result.prosecutors, searchQuery, selectedCategory, statusFilter, selectedProsecutorFilter]);

  // กรองสำหรับมุมมองรายวัน (Daily)
  const filteredDailySchedules = useMemo(() => {
    return result.dailySchedules
      .map((ds) => {
        const filteredAppts = ds.appointments.filter((a) => {
          if (selectedProsecutorFilter !== 'all' && a.prosecutorName !== selectedProsecutorFilter) return false;
          if (selectedCategory !== 'all' && a.category !== selectedCategory) return false;
          if (statusFilter === 'incomplete' && a.isCompleted) return false;
          if (statusFilter === 'completed' && !a.isCompleted) return false;
          if (statusFilter === 'submitted_duty' && !a.isSubmittedToDuty) return false;

          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = a.prosecutorName.toLowerCase().includes(q);
            const matchCase =
              a.blackCaseNo.toLowerCase().includes(q) ||
              (a.redCaseNo && a.redCaseNo.toLowerCase().includes(q)) ||
              a.defendant.toLowerCase().includes(q) ||
              (a.courtRoom && a.courtRoom.toLowerCase().includes(q)) ||
              (a.notes && a.notes.toLowerCase().includes(q));
            return matchName || matchCase;
          }
          return true;
        });

        const pSet = new Set(filteredAppts.map((a) => a.prosecutorName));

        return {
          ...ds,
          appointments: filteredAppts,
          prosecutors: Array.from(pSet),
        };
      })
      .filter((ds) => ds.appointments.length > 0);
  }, [result.dailySchedules, searchQuery, selectedCategory, statusFilter, selectedProsecutorFilter]);

  // Copy to Clipboard (TSV / HTML)
  const handleCopyClipboard = async () => {
    try {
      const tsv = formatProsecutorHearingSummaryTsv(result);
      const html = formatProsecutorHearingSummaryHtml(result);

      if (navigator.clipboard && (window as any).ClipboardItem) {
        try {
          const htmlBlob = new Blob([html], { type: 'text/html' });
          const textBlob = new Blob([tsv], { type: 'text/plain' });
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({
              'text/html': htmlBlob,
              'text/plain': textBlob,
            }),
          ]);
        } catch {
          await navigator.clipboard.writeText(tsv);
        }
      } else {
        await navigator.clipboard.writeText(tsv);
      }

      setIsCopied(true);
      if (onToast) onToast('คัดลอกสรุปวันนัดอัยการลงคลิปบอร์ดแล้ว พร้อมวางใน Excel');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      if (onToast) onToast('ไม่สามารถคัดลอกข้อมูลได้');
    }
  };

  // Download CSV
  const handleDownloadCsv = () => {
    downloadProsecutorHearingCsv(result);
    if (onToast) onToast(`ดาวน์โหลดไฟล์ CSV สรุปวันนัดเดือน ${result.monthLabel} แล้ว`);
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Month Selector */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-amber-400 text-slate-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <Calendar className="w-3.5 h-3.5" />
                สรุปวันนัดศาลรายเดือน
              </span>
              <span className="text-xs text-blue-200">
                (คุ้มครองสิทธิ • สืบเสาะ • นัดสืบประกอบรับสารภาพ)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>สรุปวันนัดของอัยการเจ้าของสำนวน</span>
              <span className="text-amber-300 font-semibold text-lg sm:text-xl">
                ประจำเดือน{result.monthLabel}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-3xl">
              รายงานและปฏิทินแสดงว่าในแต่ละเดือน อัยการเจ้าของสำนวนแต่ละท่านมีนัดศาลในวันใดบ้าง 
              สำหรับสำนวนที่มี <strong>นัดคุ้มครองสิทธิ</strong>, <strong>นัดสืบเสาะ</strong> และ <strong>นัดสืบประกอบรับสารภาพ</strong> เพื่อเตรียมความพร้อมในการปฏิบัติราชการ
            </p>
          </div>

          {/* Month Switcher Controls */}
          <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 flex flex-col sm:flex-row items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={!hasPrevious}
                className="p-1.5 rounded-lg hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition text-white"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-900/80 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/30 focus:outline-hidden focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                {availableMonths.map((ym) => {
                  const [y, m] = ym.split('-');
                  const tYear = parseInt(y, 10) + 543;
                  const tMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                  const tMonthLabel = tMonths[parseInt(m, 10) - 1] || '';
                  return (
                    <option key={ym} value={ym} className="bg-slate-900 text-white">
                      {tMonthLabel} {tYear} ({ym})
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={!hasNext}
                className="p-1.5 rounded-lg hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent transition text-white"
                title="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {selectedMonth !== todayStr.slice(0, 7) && (
              <button
                type="button"
                onClick={() => setSelectedMonth(todayStr.slice(0, 7))}
                className="text-[11px] font-medium bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1 rounded-lg transition shadow-xs w-full sm:w-auto text-center"
              >
                เดือนปัจจุบัน
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Key Statistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            อัยการที่มีนัด
          </span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-slate-800">{result.totalProsecutors}</span>
            <span className="text-[10px] text-slate-400">ท่าน</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            วันที่มีนัดในเดือน
          </span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-emerald-700">{result.totalActiveDays}</span>
            <span className="text-[10px] text-slate-400">วัน</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs flex flex-col justify-between bg-indigo-50/30">
          <span className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1">
            <span>🛡️</span>
            นัดคุ้มครองสิทธิ
          </span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-indigo-900">{result.countsByCategory.rights_protection}</span>
            <span className="text-[10px] text-indigo-500">นัด</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-xs flex flex-col justify-between bg-purple-50/30">
          <span className="text-[11px] font-semibold text-purple-700 flex items-center gap-1">
            <span>🔍</span>
            นัดสืบเสาะ
          </span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-purple-900">{result.countsByCategory.investigation}</span>
            <span className="text-[10px] text-purple-500">นัด</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-xs flex flex-col justify-between bg-amber-50/30">
          <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <span>📝</span>
            นัดสืบประกอบ
          </span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-amber-900">{result.countsByCategory.witness_confessed}</span>
            <span className="text-[10px] text-amber-600">นัด</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-3.5 rounded-xl shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            รวมนัด 3 ประเภท
          </span>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-amber-300">{result.totalAppointments}</span>
            <span className="text-[10px] text-slate-300">นัด</span>
          </div>
        </div>
      </div>

      {/* 3. Toolbar: Search, Filters, View Modes, & Export Actions */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search & Category Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่ออัยการ, เลขคดีดำ, จำเลย, บัลลังก์..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                selectedCategory === 'all'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              ทุกประเภทนัด ({result.totalAppointments})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('rights_protection')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                selectedCategory === 'rights_protection'
                  ? 'bg-indigo-700 text-white shadow-2xs'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
              }`}
            >
              <span>🛡️</span>
              <span>คุ้มครองสิทธิ ({result.countsByCategory.rights_protection})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('investigation')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                selectedCategory === 'investigation'
                  ? 'bg-purple-700 text-white shadow-2xs'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
              }`}
            >
              <span>🔍</span>
              <span>สืบเสาะ ({result.countsByCategory.investigation})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('witness_confessed')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                selectedCategory === 'witness_confessed'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              <span>📝</span>
              <span>สืบประกอบ ({result.countsByCategory.witness_confessed})</span>
            </button>
          </div>

          {/* Status Filter Pills: ทั้งหมด / ยังไม่เสร็จสิ้น / กดเสร็จสิ้นแล้ว / เสนอเวรชี้แล้ว */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>สถานะ:</span>
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-blue-900 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              นัดทั้งหมด ({result.countsByStatus.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('incomplete')}
              className={`px-2.5 py-0.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'incomplete'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
              title="คัดกรองเฉพาะสำนวนที่ยังไม่กดเสร็จสิ้น"
            >
              <Clock className="w-3 h-3 text-amber-600" />
              <span>ยังไม่เสร็จสิ้น ({result.countsByStatus.incomplete})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-2.5 py-0.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
              title="รวมสำนวนที่มีนัดที่กดเสร็จสิ้นไปแล้ว เอาไว้ดูเฉยๆ ว่ามีนัดวันไหน"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>✅ กดเสร็จสิ้นแล้ว ({result.countsByStatus.completed})</span>
              <span className="text-[10px] opacity-80">(ดูเฉยๆ)</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('submitted_duty')}
              className={`px-2.5 py-0.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                statusFilter === 'submitted_duty'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200'
              }`}
              title="คัดกรองเฉพาะสำนวนที่เสนอเวรชี้แล้ว (ยังคงคุมอุทธรณ์อยู่จนกว่าจะกดเสร็จสิ้น)"
            >
              <Send className="w-3 h-3 text-blue-600" />
              <span>📋 เสนอเวรชี้แล้ว ({result.countsByStatus.submittedToDuty})</span>
            </button>
          </div>
        </div>

        {/* View Mode & Export Actions */}
        <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto shrink-0">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center">
            <button
              type="button"
              onClick={() => setViewMode('by_prosecutor')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'by_prosecutor'
                  ? 'bg-white text-blue-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="สรุปแยกตามอัยการเจ้าของสำนวน"
            >
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>แยกรายอัยการ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('by_date')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'by_date'
                  ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="เรียงตามวันนัดในเดือน (ปฏิทิน)"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>ไทม์ไลน์รายวัน</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'table'
                  ? 'bg-white text-purple-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ตารางสรุปข้อมูลทั้งหมด"
            >
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>ตาราง</span>
            </button>
          </div>

          {/* Action buttons */}
          <button
            type="button"
            onClick={handleCopyClipboard}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition flex items-center gap-1 cursor-pointer active:scale-95"
            title="คัดลอกข้อมูลสำหรับวางลง Excel หรือตาราง"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
            <span>{isCopied ? 'คัดลอกแล้ว' : 'คัดลอก Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition flex items-center gap-1 cursor-pointer active:scale-95"
            title="ดาวน์โหลดไฟล์ CSV สำหรับเปิดใน Microsoft Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>ดาวน์โหลด CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition flex items-center gap-1 cursor-pointer active:scale-95 print:hidden"
            title="พิมพ์รายงานสรุปวันนัด"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>พิมพ์</span>
          </button>
        </div>
      </div>

      {/* 4. Main Content Area */}
      {result.totalAppointments === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            ไม่พบนัดคุ้มครองสิทธิ, สืบเสาะ หรือสืบประกอบรับสารภาพ ในเดือน{result.monthLabel}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            ในเดือนนี้ยังไม่มีสำนวนที่ระบุวันนัดใน 3 หมวดหมู่นี้ ท่านสามารถเพิ่มวันนัดในสำนวนคดี หรือสลับไปยังเดือนอื่นๆ ด้านบนได้ครับ
          </p>
        </div>
      ) : viewMode === 'by_prosecutor' ? (
        /* ================== VIEW 1: BY PROSECUTOR ================== */
        <div className="space-y-4">
          {filteredProsecutors.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              ไม่พบข้อมูลอัยการตามเงื่อนไขการค้นหา/ตัวกรอง
            </div>
          ) : (
            filteredProsecutors.map((p) => {
              const isExpanded = expandedProsecutors[p.prosecutorName] !== false;

              return (
                <div
                  key={p.prosecutorName}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition"
                >
                  {/* Prosecutor Card Header */}
                  <div
                    onClick={() => toggleProsecutorExpand(p.prosecutorName)}
                    className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/70 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                        {p.prosecutorName.replace(/นาย|นางสาว|นาง|ว่าที่ร้อยตรี|ดร\./g, '').trim().slice(0, 2) || 'อย'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900">{p.prosecutorName}</h3>
                          <span className="text-xs text-slate-500 font-medium">
                            (อัยการเจ้าของสำนวน)
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-semibold border border-blue-200">
                            📅 มีนัด {p.uniqueDatesCount} วันในเดือนนี้
                          </span>
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                            รวมทั้งหมด {p.totalAppointments} สำนวน
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Category Badges for Prosecutor & Toggle Arrow */}
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {p.countsByCategory.rights_protection > 0 && (
                          <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span>🛡️</span>
                            <span>คุ้มครองสิทธิ {p.countsByCategory.rights_protection}</span>
                          </span>
                        )}
                        {p.countsByCategory.investigation > 0 && (
                          <span className="text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span>🔍</span>
                            <span>สืบเสาะ {p.countsByCategory.investigation}</span>
                          </span>
                        )}
                        {p.countsByCategory.witness_confessed > 0 && (
                          <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span>📝</span>
                            <span>สืบประกอบ {p.countsByCategory.witness_confessed}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-slate-400 p-1">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Prosecutor Dates List */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50">
                      {p.dateSchedules.map((ds) => {
                        const isToday = ds.date === todayStr;

                        return (
                          <div
                            key={ds.date}
                            className={`rounded-xl border transition ${
                              isToday
                                ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30'
                                : 'bg-white border-slate-200 shadow-2xs'
                            }`}
                          >
                            {/* Date Strip */}
                            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 rounded-t-xl flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                <span className="text-xs sm:text-sm font-bold text-slate-800">
                                  {ds.thaiDateLabel} ({ds.dayOfWeekThai})
                                </span>
                                {isToday && (
                                  <span className="bg-amber-500 text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full shadow-2xs">
                                    ★ วันนี้
                                  </span>
                                )}
                              </div>

                              <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                                {ds.appointments.length} สำนวน
                              </span>
                            </div>

                            {/* Appointments list for this date */}
                            <div className="p-3 sm:p-4 divide-y divide-slate-100">
                              {ds.appointments.map((a) => {
                                const categoryBadge =
                                  a.category === 'rights_protection' ? (
                                    <span className="text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                      <span>🛡️</span>
                                      <span>นัดคุ้มครองสิทธิ</span>
                                    </span>
                                  ) : a.category === 'investigation' ? (
                                    <span className="text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                      <span>🔍</span>
                                      <span>นัดสืบเสาะ</span>
                                    </span>
                                  ) : (
                                    <span className="text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                      <span>📝</span>
                                      <span>นัดสืบประกอบรับสารภาพ</span>
                                    </span>
                                  );

                                return (
                                  <div
                                    key={a.uniqueKey}
                                    className="py-2.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {categoryBadge}

                                        {/* Time & Court Room */}
                                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-slate-500" />
                                          {a.appointmentTime || '09:00 น.'}
                                        </span>

                                        {a.courtRoom && (
                                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                            🏛️ {a.courtRoom}
                                          </span>
                                        )}

                                        {a.isSubsequent && (
                                          <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                            (นัดลำดับที่ {a.orderIndex})
                                          </span>
                                        )}
                                      </div>

                                      {/* Case Details */}
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pt-0.5">
                                        <span className="font-bold text-slate-900 text-sm">
                                          คดีดำ {a.blackCaseNo}
                                        </span>
                                        {a.redCaseNo && a.redCaseNo !== '-' && (
                                          <span className="font-semibold text-rose-700">
                                            คดีแดง {a.redCaseNo}
                                          </span>
                                        )}
                                        <span className="text-slate-600">
                                          <strong>จำเลย:</strong> {a.defendant}
                                        </span>
                                        <span className="text-slate-500 text-[11px]">
                                          ({a.court})
                                        </span>
                                      </div>

                                      {/* Status Badges */}
                                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        {a.isCompleted ? (
                                          <span className="text-[11px] font-bold text-emerald-950 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                            <span>เสร็จสิ้นแล้ว{a.completedDate ? ` (${formatThaiDate(a.completedDate, { short: true })})` : ''}</span>
                                            <span className="text-[10px] text-emerald-700 font-semibold">• ดูประวัตินัด</span>
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            ⏳ ยังไม่เสร็จสิ้น (คุมอุทธรณ์)
                                          </span>
                                        )}

                                        {a.isSubmittedToDuty && (
                                          <span className="text-[11px] font-bold text-blue-950 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs">
                                            <Send className="w-3 h-3 text-blue-600" />
                                            <span>📋 เสนอเวรชี้แล้ว{a.submittedToDutyOfficer ? `: ${a.submittedToDutyOfficer}` : ''}</span>
                                            <span className="text-[10px] text-blue-700 font-semibold">(ยังคุมอุทธรณ์)</span>
                                          </span>
                                        )}
                                      </div>

                                      {/* Notes if any */}
                                      {a.notes && (
                                        <div className="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block">
                                          <strong>หมายเหตุ:</strong> {a.notes}
                                        </div>
                                      )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1.5 self-start md:self-center shrink-0">
                                      {onOpenSubmitToDuty && (
                                        <button
                                          type="button"
                                          onClick={() => onOpenSubmitToDuty(a.caseItem)}
                                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                                            a.isSubmittedToDuty
                                              ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold hover:bg-blue-200'
                                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                                          }`}
                                          title="เสนอเวรชี้ (ยังคุมอุทธรณ์อยู่จนกว่าจะกดเสร็จสิ้น)"
                                        >
                                          <Send className="w-3.5 h-3.5 text-blue-600" />
                                          <span>{a.isSubmittedToDuty ? '✓ เสนอเวรชี้' : 'เสนอเวรชี้'}</span>
                                        </button>
                                      )}
                                      {onSelectCase && (
                                        <button
                                          type="button"
                                          onClick={() => onSelectCase(a.caseItem)}
                                          className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition flex items-center gap-1 cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          <span>เปิดดูสำนวน</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : viewMode === 'by_date' ? (
        /* ================== VIEW 2: DAILY TIMELINE ================== */
        <div className="space-y-4">
          {filteredDailySchedules.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              ไม่พบข้อมูลตามเงื่อนไขการค้นหา/ตัวกรอง
            </div>
          ) : (
            filteredDailySchedules.map((ds) => {
              const isToday = ds.date === todayStr;

              return (
                <div
                  key={ds.date}
                  className={`bg-white rounded-2xl border transition shadow-xs overflow-hidden ${
                    isToday ? 'border-amber-400 ring-2 ring-amber-300' : 'border-slate-200'
                  }`}
                >
                  {/* Daily Header */}
                  <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                        {ds.date.split('-')[2]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{ds.thaiDateLabel}</h4>
                          <span className="text-xs font-semibold text-slate-500">({ds.dayOfWeekThai})</span>
                          {isToday && (
                            <span className="bg-amber-500 text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full">
                              ★ วันนี้
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          อัยการที่มีนัดวันนี้: <strong>{ds.prosecutors.join(', ')}</strong>
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      รวม {ds.appointments.length} สำนวน
                    </span>
                  </div>

                  {/* Appointments list */}
                  <div className="p-4 divide-y divide-slate-100">
                    {ds.appointments.map((a) => (
                      <div
                        key={a.uniqueKey}
                        className="py-3 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-blue-900 bg-blue-100 border border-blue-300 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                              <Users className="w-3 h-3 text-blue-700" />
                              {a.prosecutorName}
                            </span>

                            {a.category === 'rights_protection' ? (
                              <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                                🛡️ นัดคุ้มครองสิทธิ
                              </span>
                            ) : a.category === 'investigation' ? (
                              <span className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                                🔍 นัดสืบเสาะ
                              </span>
                            ) : (
                              <span className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded">
                                📝 นัดสืบประกอบรับสารภาพ
                              </span>
                            )}

                            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              ⏰ {a.appointmentTime || '09:00 น.'}
                            </span>

                            {a.courtRoom && (
                              <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                🏛️ {a.courtRoom}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                            <span className="font-bold text-slate-900">คดีดำ {a.blackCaseNo}</span>
                            {a.redCaseNo && <span className="font-semibold text-rose-700">คดีแดง {a.redCaseNo}</span>}
                            <span><strong>จำเลย:</strong> {a.defendant}</span>
                            <span className="text-slate-400">({a.court})</span>
                          </div>

                          {/* Status Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {a.isCompleted ? (
                              <span className="text-[11px] font-bold text-emerald-950 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>เสร็จสิ้นแล้ว{a.completedDate ? ` (${formatThaiDate(a.completedDate, { short: true })})` : ''}</span>
                                <span className="text-[10px] text-emerald-700 font-semibold">• ดูประวัตินัด</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                ⏳ ยังไม่เสร็จสิ้น (คุมอุทธรณ์)
                              </span>
                            )}

                            {a.isSubmittedToDuty && (
                              <span className="text-[11px] font-bold text-blue-950 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs">
                                <Send className="w-3 h-3 text-blue-600" />
                                <span>📋 เสนอเวรชี้แล้ว{a.submittedToDutyOfficer ? `: ${a.submittedToDutyOfficer}` : ''}</span>
                                <span className="text-[10px] text-blue-700 font-semibold">(ยังคุมอุทธรณ์)</span>
                              </span>
                            )}
                          </div>

                          {a.notes && (
                            <div className="text-[11px] text-slate-500">
                              <strong>หมายเหตุ:</strong> {a.notes}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 self-start md:self-center shrink-0">
                          {onOpenSubmitToDuty && (
                            <button
                              type="button"
                              onClick={() => onOpenSubmitToDuty(a.caseItem)}
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                                a.isSubmittedToDuty
                                  ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold hover:bg-blue-200'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                              }`}
                              title="เสนอเวรชี้ (ยังคุมอุทธรณ์อยู่จนกว่าจะกดเสร็จสิ้น)"
                            >
                              <Send className="w-3.5 h-3.5 text-blue-600" />
                              <span>{a.isSubmittedToDuty ? '✓ เสนอเวรชี้' : 'เสนอเวรชี้'}</span>
                            </button>
                          )}
                          {onSelectCase && (
                            <button
                              type="button"
                              onClick={() => onSelectCase(a.caseItem)}
                              className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ดูสำนวน</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ================== VIEW 3: TABLE MATRIX ================== */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="p-3 text-center w-12">ลำดับ</th>
                  <th className="p-3">อัยการเจ้าของสำนวน</th>
                  <th className="p-3">วันที่นัด</th>
                  <th className="p-3 text-center">เวลา</th>
                  <th className="p-3 text-center">บัลลังก์</th>
                  <th className="p-3 text-center">ประเภทนัด</th>
                  <th className="p-3">เลขคดีดำ</th>
                  <th className="p-3">เลขคดีแดง</th>
                  <th className="p-3">จำเลย</th>
                  <th className="p-3 text-center">สถานะ / เสนอเวรชี้</th>
                  <th className="p-3">หมายเหตุ</th>
                  <th className="p-3 text-center w-28">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.allAppointments
                  .filter((a) => {
                    if (selectedProsecutorFilter !== 'all' && a.prosecutorName !== selectedProsecutorFilter) return false;
                    if (selectedCategory !== 'all' && a.category !== selectedCategory) return false;
                    if (statusFilter === 'incomplete' && a.isCompleted) return false;
                    if (statusFilter === 'completed' && !a.isCompleted) return false;
                    if (statusFilter === 'submitted_duty' && !a.isSubmittedToDuty) return false;

                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      return (
                        a.prosecutorName.toLowerCase().includes(q) ||
                        a.blackCaseNo.toLowerCase().includes(q) ||
                        (a.redCaseNo && a.redCaseNo.toLowerCase().includes(q)) ||
                        a.defendant.toLowerCase().includes(q) ||
                        (a.courtRoom && a.courtRoom.toLowerCase().includes(q)) ||
                        (a.notes && a.notes.toLowerCase().includes(q))
                      );
                    }
                    return true;
                  })
                  .map((a, idx) => (
                    <tr key={a.uniqueKey} className={`hover:bg-slate-50 transition ${a.isCompleted ? 'bg-emerald-50/20' : ''}`}>
                      <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{a.prosecutorName}</td>
                      <td className="p-3 text-slate-700 whitespace-nowrap">
                        {formatThaiDate(a.appointmentDate)}
                      </td>
                      <td className="p-3 text-center text-slate-600 whitespace-nowrap">
                        {a.appointmentTime || '09:00 น.'}
                      </td>
                      <td className="p-3 text-center text-slate-600 whitespace-nowrap">
                        {a.courtRoom || '-'}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {a.category === 'rights_protection' ? (
                          <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                            🛡️ คุ้มครองสิทธิ
                          </span>
                        ) : a.category === 'investigation' ? (
                          <span className="font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[11px]">
                            🔍 สืบเสาะ
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded text-[11px]">
                            📝 สืบประกอบ
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">{a.blackCaseNo}</td>
                      <td className="p-3 text-rose-700 whitespace-nowrap">{a.redCaseNo || '-'}</td>
                      <td className="p-3 text-slate-700 max-w-xs truncate">{a.defendant}</td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {a.isCompleted ? (
                          <span className="font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>เสร็จสิ้น{a.completedDate ? ` (${formatThaiDate(a.completedDate, { short: true })})` : ''}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                            ⏳ คุมอุทธรณ์
                          </span>
                        )}
                        {a.isSubmittedToDuty && (
                          <div className="mt-1">
                            <span className="text-[10px] font-bold text-blue-900 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                              <Send className="w-2.5 h-2.5 text-blue-600" />
                              <span>เสนอเวรชี้แล้ว</span>
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">{a.notes || '-'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onOpenSubmitToDuty && (
                            <button
                              type="button"
                              onClick={() => onOpenSubmitToDuty(a.caseItem)}
                              className={`p-1 rounded transition border cursor-pointer ${
                                a.isSubmittedToDuty
                                  ? 'text-blue-900 bg-blue-100 border-blue-300'
                                  : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50 border-slate-200'
                              }`}
                              title="เสนอเวรชี้ (ยังคุมอุทธรณ์อยู่จนกว่าจะกดเสร็จสิ้น)"
                            >
                              <Send className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                          )}
                          {onSelectCase && (
                            <button
                              type="button"
                              onClick={() => onSelectCase(a.caseItem)}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                              title="เปิดดูสำนวน"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
