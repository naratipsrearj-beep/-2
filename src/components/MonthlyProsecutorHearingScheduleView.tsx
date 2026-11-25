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
  Send,
  LayoutGrid
} from 'lucide-react';
import { AppealCase, MonthlyDutyRoster } from '../types/appeal';
import { getTodayString, formatThaiDate } from '../utils/dateUtils';
import {
  extractProsecutorMonthlyHearings,
  getAvailableHearingMonths,
  formatProsecutorHearingSummaryTsv,
  formatProsecutorHearingSummaryHtml,
  downloadProsecutorHearingCsv,
  CalendarAppointmentCategory,
  ProsecutorHearingAppointment,
  getCalendarCategoryDisplay,
} from '../utils/monthlyProsecutorAppointmentUtils';
import { MonthlyProsecutorCalendarView } from './MonthlyProsecutorCalendarView';
import { CaseNoteHighlight } from './CaseNoteHighlight';

interface MonthlyProsecutorHearingScheduleViewProps {
  cases: AppealCase[];
  dutyRosters?: MonthlyDutyRoster[];
  initialYearMonth?: string;
  canEdit?: boolean;
  canComplete?: boolean;
  onSelectCase?: (caseItem: AppealCase) => void;
  onOpenAppointmentModal?: (caseItem: AppealCase) => void;
  onOpenSubmitToDuty?: (caseItem: AppealCase) => void;
  onMarkComplete?: (caseItem: AppealCase) => void;
  onAddNewCaseForDate?: (dateStr: string) => void;
  onToast?: (message: string) => void;
}

export const MonthlyProsecutorHearingScheduleView: React.FC<MonthlyProsecutorHearingScheduleViewProps> = ({
  cases,
  dutyRosters = [],
  initialYearMonth,
  canEdit = false,
  canComplete = false,
  onSelectCase,
  onOpenAppointmentModal,
  onOpenSubmitToDuty,
  onMarkComplete,
  onAddNewCaseForDate,
  onToast,
}) => {
  const todayStr = useMemo(() => getTodayString(), []);
  const availableMonths = useMemo(() => getAvailableHearingMonths(cases, dutyRosters), [cases, dutyRosters]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialYearMonth && /^\d{4}-\d{2}$/.test(initialYearMonth)) {
      return initialYearMonth;
    }
    return todayStr.slice(0, 7) || availableMonths[0] || '2026-11';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'other_group' | CalendarAppointmentCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'incomplete' | 'completed' | 'submitted_duty'>('all');
  const [selectedProsecutorFilter, setSelectedProsecutorFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'by_prosecutor' | 'by_date' | 'table'>('calendar');
  const [expandedProsecutors, setExpandedProsecutors] = useState<Record<string, boolean>>({});
  const [isCopied, setIsCopied] = useState(false);

  // สกัดและสรุปข้อมูลนัดศาลประจำเดือน (ครอบคลุมทุกประเภทนัด ทั้งเสร็จสิ้นและยังไม่เสร็จสิ้น)
  const result = useMemo(() => {
    return extractProsecutorMonthlyHearings(cases, selectedMonth, { includeAllAppointmentTypes: true });
  }, [cases, selectedMonth]);

  // ตัวเลือกเดือนใน dropdown (รวม selectedMonth เสมอแม้เพิ่งเลื่อนไปเดือนใหม่)
  const monthDropdownOptions = useMemo(() => {
    const set = new Set(availableMonths);
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) set.add(selectedMonth);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [availableMonths, selectedMonth]);

  // เลื่อนเดือนก่อนหน้า / ถัดไป แบบปฏิทินต่อเนื่องได้ทุกเดือน
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    if (!y || !m) return;
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    if (!y || !m) return;
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Toggle expand all/individual
  const toggleProsecutorExpand = (prosecutorName: string) => {
    setExpandedProsecutors((prev) => ({
      ...prev,
      [prosecutorName]: prev[prosecutorName] === false ? true : false,
    }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    result.prosecutors.forEach((p) => {
      next[p.prosecutorName] = true;
    });
    setExpandedProsecutors(next);
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    result.prosecutors.forEach((p) => {
      next[p.prosecutorName] = false;
    });
    setExpandedProsecutors(next);
  };

  const prosecutorNamesList = useMemo(() => {
    return result.prosecutors.map((p) => p.prosecutorName);
  }, [result.prosecutors]);

  const currentProsecutorIndex = prosecutorNamesList.indexOf(selectedProsecutorFilter);

  const handlePrevProsecutor = () => {
    if (currentProsecutorIndex > 0) {
      setSelectedProsecutorFilter(prosecutorNamesList[currentProsecutorIndex - 1]);
    } else {
      setSelectedProsecutorFilter(prosecutorNamesList[prosecutorNamesList.length - 1]);
    }
  };

  const handleNextProsecutor = () => {
    if (currentProsecutorIndex < prosecutorNamesList.length - 1) {
      setSelectedProsecutorFilter(prosecutorNamesList[currentProsecutorIndex + 1]);
    } else {
      setSelectedProsecutorFilter(prosecutorNamesList[0]);
    }
  };

  const matchesCategoryFilter = (cat: CalendarAppointmentCategory) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'other_group') {
      return cat !== 'rights_protection' && cat !== 'investigation' && cat !== 'witness_confessed';
    }
    return cat === selectedCategory;
  };

  const filteredAllAppointments = useMemo(() => {
    return result.allAppointments.filter((a) => {
      if (selectedProsecutorFilter !== 'all' && a.prosecutorName !== selectedProsecutorFilter) return false;
      if (!matchesCategoryFilter(a.category)) return false;
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
          a.categoryLabel.toLowerCase().includes(q) ||
          (a.courtRoom && a.courtRoom.toLowerCase().includes(q)) ||
          (a.notes && a.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [result.allAppointments, selectedProsecutorFilter, selectedCategory, statusFilter, searchQuery]);

  // คัดกรองข้อมูลตาม search query และ filter
  const filteredProsecutors = useMemo(() => {
    return result.prosecutors
      .filter((p) => {
        if (selectedProsecutorFilter !== 'all' && p.prosecutorName !== selectedProsecutorFilter) {
          return false;
        }
        return true;
      })
      .map((p) => {
        const filteredDateSchedules = p.dateSchedules
          .map((ds) => {
            const filteredAppts = ds.appointments.filter((a) => {
              if (!matchesCategoryFilter(a.category)) return false;
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
                  a.categoryLabel.toLowerCase().includes(q) ||
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
          if (!matchesCategoryFilter(a.category)) return false;
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
              a.categoryLabel.toLowerCase().includes(q) ||
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-800 via-blue-600 to-amber-500" />
        <div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          {/* Left: High-Contrast Title & Scope */}
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-blue-800 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <Calendar className="w-6 h-6 text-amber-300" />
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold text-blue-800">
                <span>ปฏิทินนัดอัยการเชื่อมโยงฐานข้อมูล</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-700 font-semibold">
                  คุ้มครองสิทธิ · สืบเสาะ · สืบประกอบฯ · นัดพร้อม / สืบพยาน / นัดอื่นๆ
                </span>
              </div>

              <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-950 font-['Prompt'] leading-snug flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span>ปฏิทินวันนัดอัยการเจ้าของสำนวน</span>
                <span className="text-blue-700 font-bold">
                  ประจำเดือน{result.monthLabel}
                </span>
              </h1>

              <p className="text-sm text-slate-700 leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>เชื่อมโยงข้อมูลสำนวนคดีและตารางเวรชี้แบบเรียลไทม์ ครอบคลุมทั้ง</span>
                <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>สำนวนที่ยังไม่กดเสร็จสิ้น</span>
                </span>
                <span>และ</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>สำนวนที่กดเสร็จสิ้นแล้ว</span>
                </span>
              </p>
            </div>
          </div>

          {/* Right: Prominent Month Switcher Controls */}
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 self-start xl:self-center">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 font-bold text-sm flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
              title="ดูเดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
              <span>เดือนก่อน</span>
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="เลือกเดือนและปีที่ต้องการดูปฏิทิน"
              className="min-h-[42px] bg-white hover:bg-blue-50/40 text-blue-950 text-sm sm:text-base font-bold px-4 py-2 rounded-lg border-2 border-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer tabular-nums"
            >
              {monthDropdownOptions.map((ym) => {
                const [y, m] = ym.split('-');
                const tYear = parseInt(y, 10) + 543;
                const tFullMonths = [
                  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
                ];
                const tMonthLabel = tFullMonths[parseInt(m, 10) - 1] || '';
                return (
                  <option key={ym} value={ym} className="bg-white text-slate-900 font-semibold">
                    {tMonthLabel} {tYear} ({ym})
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              onClick={handleNextMonth}
              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 font-bold text-sm flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
              title="ดูเดือนถัดไป"
            >
              <span>เดือนถัดไป</span>
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </button>

            {selectedMonth !== todayStr.slice(0, 7) ? (
              <button
                type="button"
                onClick={() => setSelectedMonth(todayStr.slice(0, 7))}
                className="min-h-[42px] px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <Calendar className="w-4 h-4" />
                <span>เดือนปัจจุบัน</span>
              </button>
            ) : (
              <span className="min-h-[42px] px-3 py-2 text-xs font-bold text-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>เดือนปัจจุบัน</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Key Statistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            อัยการที่มีนัด
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 tabular-nums">
            <span className="text-xl font-bold text-slate-800">{result.totalProsecutors}</span>
            <span className="text-[11px] text-slate-400">ท่าน</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            วันที่มีนัดในเดือน
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 tabular-nums">
            <span className="text-xl font-bold text-emerald-700">{result.totalActiveDays}</span>
            <span className="text-[11px] text-slate-400">วัน</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-indigo-200/80 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1">
            <span>🛡️</span>
            นัดคุ้มครองสิทธิ
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 tabular-nums">
            <span className="text-xl font-bold text-indigo-900">{result.countsByCategory.rights_protection}</span>
            <span className="text-[11px] text-indigo-500">นัด</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-purple-200/80 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-purple-700 flex items-center gap-1">
            <span>🔍</span>
            นัดสืบเสาะ
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 tabular-nums">
            <span className="text-xl font-bold text-purple-900">{result.countsByCategory.investigation}</span>
            <span className="text-[11px] text-purple-500">นัด</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <span>📝</span>
            นัดสืบประกอบ
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 tabular-nums">
            <span className="text-xl font-bold text-amber-900">{result.countsByCategory.witness_confessed}</span>
            <span className="text-[11px] text-amber-600">นัด</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-sky-200/80 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-sky-800 flex items-center gap-1">
            <span>📌</span>
            นัดต่างๆ อื่นๆ
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 tabular-nums">
            <span className="text-xl font-bold text-sky-900">{result.countsByCategory.other_appointments}</span>
            <span className="text-[11px] text-sky-600">นัด</span>
          </div>
        </div>

        <div className="bg-slate-900 text-white p-3.5 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            รวมนัดทั้งหมด
          </span>
          <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
            <span className="text-xl font-bold text-amber-300">{result.totalAppointments}</span>
            <span className="text-[11px] text-slate-300">
              (⏳{result.countsByStatus.incomplete} · ✓{result.countsByStatus.completed})
            </span>
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

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ทุกประเภทนัด ({result.totalAppointments})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('rights_protection')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                selectedCategory === 'rights_protection'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
              }`}
            >
              <span>🛡️</span>
              <span>คุ้มครองสิทธิ ({result.countsByCategory.rights_protection})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('investigation')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                selectedCategory === 'investigation'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200'
              }`}
            >
              <span>🔍</span>
              <span>สืบเสาะ ({result.countsByCategory.investigation})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('witness_confessed')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                selectedCategory === 'witness_confessed'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              <span>📝</span>
              <span>สืบประกอบ ({result.countsByCategory.witness_confessed})</span>
            </button>
            <select
              value={
                selectedCategory === 'all' ||
                selectedCategory === 'rights_protection' ||
                selectedCategory === 'investigation' ||
                selectedCategory === 'witness_confessed'
                  ? ''
                  : selectedCategory
              }
              onChange={(e) => {
                const v = e.target.value;
                setSelectedCategory(v ? (v as any) : 'all');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                selectedCategory !== 'all' &&
                selectedCategory !== 'rights_protection' &&
                selectedCategory !== 'investigation' &&
                selectedCategory !== 'witness_confessed'
                  ? 'bg-sky-700 text-white border-sky-700'
                  : 'bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100'
              }`}
              title="เลือกกรองนัดประเภทอื่นๆ"
            >
              <option value="">📌 นัดต่างๆ อื่นๆ ({result.countsByCategory.other_appointments})</option>
              <option value="other_group">ทุกนัดอื่นๆ รวมกัน ({result.countsByCategory.other_appointments})</option>
              <option value="pre_trial">📋 นัดพร้อม / ตรวจพยาน ({result.countsByCategory.pre_trial})</option>
              <option value="witness_examination">🎙️ นัดสืบพยาน ({result.countsByCategory.witness_examination})</option>
              <option value="mediation">🤝 นัดไกล่เกลี่ย ({result.countsByCategory.mediation})</option>
              <option value="judgment">⚖️ นัดฟังคำพิพากษา ({result.countsByCategory.judgment})</option>
              <option value="requisition">🚚 นัดเบิกฟ้อง ({result.countsByCategory.requisition})</option>
              <option value="other">📌 นัดอื่นๆ เฉพาะเรื่อง ({result.countsByCategory.other})</option>
            </select>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>สถานะ:</span>
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-blue-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ทุกสถานะ ({result.countsByStatus.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('incomplete')}
              className={`px-2.5 py-0.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                statusFilter === 'incomplete'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
              title="คัดกรองเฉพาะสำนวนที่ยังไม่กดเสร็จสิ้น"
            >
              <Clock className="w-3 h-3" />
              <span>ยังไม่เสร็จสิ้น ({result.countsByStatus.incomplete})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-2.5 py-0.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
              title="คัดกรองเฉพาะสำนวนที่กดเสร็จสิ้นแล้ว"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>กดเสร็จสิ้นแล้ว ({result.countsByStatus.completed})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('submitted_duty')}
              className={`px-2.5 py-0.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                statusFilter === 'submitted_duty'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200'
              }`}
              title="คัดกรองเฉพาะสำนวนที่เสนอเวรชี้แล้ว"
            >
              <Send className="w-3 h-3" />
              <span>เสนอเวรชี้แล้ว ({result.countsByStatus.submittedToDuty})</span>
            </button>
          </div>
        </div>

        {/* View Mode & Export Actions */}
        <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto shrink-0">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center flex-wrap">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
                viewMode === 'calendar'
                  ? 'bg-white text-blue-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ตารางปฏิทินรายเดือน (เชื่อมโยงฐานข้อมูลอัยการ)"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-700" />
              <span>ตารางปฏิทิน</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('by_prosecutor')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
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
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
                viewMode === 'by_date'
                  ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="ไทม์ไลน์เรียงตามวันนัดในเดือน"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>ไทม์ไลน์รายวัน</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
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
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition flex items-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            title="คัดลอกข้อมูลสำหรับวางลง Excel หรือตาราง"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
            <span>{isCopied ? 'คัดลอกแล้ว' : 'คัดลอก Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition flex items-center gap-1 cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            title="ดาวน์โหลดไฟล์ CSV สำหรับเปิดใน Microsoft Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>ดาวน์โหลด CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition flex items-center gap-1 cursor-pointer active:scale-95 print:hidden whitespace-nowrap shrink-0"
            title="พิมพ์รายงานสรุปวันนัด"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>พิมพ์</span>
          </button>
        </div>
      </div>

      {/* 4. Main Content Area */}
      {viewMode === 'calendar' ? (
        <MonthlyProsecutorCalendarView
          cases={cases}
          dutyRosters={dutyRosters}
          yearMonth={selectedMonth}
          monthResult={result}
          filteredAppointments={filteredAllAppointments}
          selectedProsecutorFilter={selectedProsecutorFilter}
          onSelectProsecutor={(name) => setSelectedProsecutorFilter(name)}
          canEdit={canEdit}
          canComplete={canComplete}
          onSelectCase={onSelectCase}
          onOpenAppointmentModal={onOpenAppointmentModal}
          onOpenSubmitToDuty={onOpenSubmitToDuty}
          onMarkComplete={onMarkComplete}
          onAddNewCaseForDate={onAddNewCaseForDate}
        />
      ) : result.totalAppointments === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            ไม่พบนัดศาลในเดือน{result.monthLabel}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            ในเดือนนี้ยังไม่มีสำนวนที่ระบุวันนัดในระบบ ท่านสามารถสลับไปมุมมองตารางปฏิทินเพื่อเพิ่มวันนัด หรือเปลี่ยนไปเดือนอื่นๆ ด้านบนได้ครับ
          </p>
        </div>
      ) : viewMode === 'by_prosecutor' ? (
        /* ================== VIEW 1: BY PROSECUTOR (แยกรายอัยการ) ================== */
        <div className="space-y-4">
          {/* Prosecutor Quick Selection Bar & Directory (แถบเลือกดูแยกตามอัยการ) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold shadow-2xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 font-['Prompt']">
                    เลือกดูแยกตามอัยการเจ้าของสำนวน
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    คลิกเลือกอัยการเพื่อโฟกัสดูตารางนัดเฉพาะท่าน หรือเลือกดูอัยการทุกท่าน
                  </p>
                </div>
              </div>

              {/* Quick Actions: All vs Expand/Collapse */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedProsecutorFilter === 'all' ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={handleExpandAll}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="ขยายทุกรายชื่ออัยการเพื่อดูรายละเอียดทั้งหมด"
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      <span>ขยายทุกท่าน</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCollapseAll}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="ยุบทุกรายชื่อเพื่อดูเฉพาะแถบสรุป"
                    >
                      <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      <span>ยุบทุกท่าน</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedProsecutorFilter('all')}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <span>✕ แสดงอัยการทั้งหมด ({result.prosecutors.length} ท่าน)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Prosecutor Chips Carousel */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedProsecutorFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 border ${
                  selectedProsecutorFilter === 'all'
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm ring-2 ring-blue-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>อัยการทั้งหมด ({result.prosecutors.length} ท่าน)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  selectedProsecutorFilter === 'all' ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                }`}>
                  {result.totalAppointments} นัด
                </span>
              </button>

              {result.prosecutors.map((p) => {
                const isSelected = selectedProsecutorFilter === p.prosecutorName;
                const initials = p.prosecutorName.replace(/นาย|นางสาว|นาง|ว่าที่ร้อยตรี|ดร\./g, '').trim().slice(0, 2) || 'อย';
                const hasIncomplete = p.countsByStatus && p.countsByStatus.incomplete > 0;

                return (
                  <button
                    key={p.prosecutorName}
                    type="button"
                    onClick={() => {
                      setSelectedProsecutorFilter(p.prosecutorName);
                      setViewMode('by_prosecutor');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 shrink-0 border ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-700 to-indigo-800 text-white border-blue-800 shadow-md ring-2 ring-blue-400'
                        : 'bg-white hover:bg-blue-50/50 text-slate-800 border-slate-200 hover:border-blue-300 shadow-2xs'
                    }`}
                    title={`คลิกเพื่อดูวันนัดของ ${p.prosecutorName} (${p.totalAppointments} สำนวน)`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isSelected ? 'bg-white text-blue-900' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {initials}
                    </div>
                    <span className="font-['Prompt']">{p.prosecutorName}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : hasIncomplete
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {p.totalAppointments} นัด
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Focused Single Prosecutor Banner (เมื่อเลือกดูเฉพาะอัยการท่านนั้น) */}
          {selectedProsecutorFilter !== 'all' && filteredProsecutors.length > 0 && (() => {
            const p = filteredProsecutors[0];
            const initials = p.prosecutorName.replace(/นาย|นางสาว|นาง|ว่าที่ร้อยตรี|ดร\./g, '').trim().slice(0, 2) || 'อย';

            return (
              <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-5 border border-blue-800/60 shadow-lg relative overflow-hidden animate-in fade-in duration-200">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white text-lg font-bold flex items-center justify-center shrink-0 shadow-md ring-4 ring-white/10 font-['Prompt']">
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-bold font-['Prompt'] text-white">
                          {p.prosecutorName}
                        </h2>
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-2.5 py-0.5 rounded-full font-medium">
                          👔 อัยการเจ้าของสำนวน
                        </span>
                      </div>
                      <p className="text-xs text-blue-200/90 mt-1">
                        ตารางนัดพิจารณาประจำเดือน{result.monthLabel} • มีนัดทั้งหมด <strong className="text-white font-bold">{p.uniqueDatesCount} วัน</strong> ({p.totalAppointments} สำนวน)
                      </p>
                    </div>
                  </div>

                  {/* Navigation & Controls */}
                  <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={handlePrevProsecutor}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="ไปที่อัยการท่านก่อนหน้า"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>ท่านก่อนหน้า</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextProsecutor}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                      title="ไปที่อัยการท่านถัดไป"
                    >
                      <span>ท่านถัดไป</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProsecutorFilter('all')}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-1 cursor-pointer shadow-md"
                    >
                      <span>✕ แสดงทุกท่าน</span>
                    </button>
                  </div>
                </div>

                {/* Prosecutor Stat Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-4 pt-4 border-t border-white/15">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-indigo-300 font-medium">🛡️ คุ้มครองสิทธิ</div>
                    <div className="text-lg font-bold text-white mt-0.5">{p.countsByCategory.rights_protection} นัด</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-purple-300 font-medium">🔍 สืบเสาะ</div>
                    <div className="text-lg font-bold text-white mt-0.5">{p.countsByCategory.investigation} นัด</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-amber-300 font-medium">📝 สืบประกอบ</div>
                    <div className="text-lg font-bold text-white mt-0.5">{p.countsByCategory.witness_confessed} นัด</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-amber-400 font-medium">⏳ ยังไม่เสร็จสิ้น</div>
                    <div className="text-lg font-bold text-amber-300 mt-0.5">{p.countsByStatus?.incomplete ?? 0} สำนวน</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-emerald-400 font-medium">✅ เสร็จสิ้นแล้ว</div>
                    <div className="text-lg font-bold text-emerald-300 mt-0.5">{p.countsByStatus?.completed ?? 0} สำนวน</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] text-blue-300 font-medium">📋 เสนอเวรชี้</div>
                    <div className="text-lg font-bold text-blue-300 mt-0.5">{p.countsByStatus?.submittedToDuty ?? 0} สำนวน</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Main Prosecutor Schedule Cards */}
          {filteredProsecutors.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-2">
              <Search className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">ไม่พบข้อมูลอัยการตามเงื่อนไขการค้นหา/ตัวกรอง</p>
              <p className="text-xs text-slate-500">ลองล้างคำค้นหาหรือเลือกดูอัยการทุกท่าน</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedProsecutorFilter('all');
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setStatusFilter('all');
                }}
                className="mt-2 px-3 py-1.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 hover:bg-blue-100 transition cursor-pointer"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          ) : (
            filteredProsecutors.map((p) => {
              const isExpanded = expandedProsecutors[p.prosecutorName] !== false;
              const isSingleFocused = selectedProsecutorFilter === p.prosecutorName;
              const initials = p.prosecutorName.replace(/นาย|นางสาว|นาง|ว่าที่ร้อยตรี|ดร\./g, '').trim().slice(0, 2) || 'อย';

              // Date previews for this prosecutor (e.g. 5, 10, 17, 24 พ.ย.)
              const datePreviewList = p.dateSchedules
                .slice(0, 5)
                .map((ds) => ds.thaiDateLabel.replace(/\d{4}/g, '').trim());

              return (
                <div
                  key={p.prosecutorName}
                  className={`bg-white rounded-2xl border shadow-xs overflow-hidden transition ${
                    isSingleFocused
                      ? 'border-blue-400 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Prosecutor Card Header */}
                  <div
                    onClick={() => toggleProsecutorExpand(p.prosecutorName)}
                    className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/60 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white font-bold flex items-center justify-center shrink-0 shadow-sm font-['Prompt']">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900 font-['Prompt']">
                            {p.prosecutorName}
                          </h3>
                          <span className="text-xs text-slate-500 font-medium">
                            (อัยการเจ้าของสำนวน)
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-semibold border border-blue-200">
                            📅 มีนัด {p.uniqueDatesCount} วันในเดือนนี้
                          </span>
                          <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                            รวมทั้งหมด <strong>{p.totalAppointments}</strong> สำนวน
                          </span>
                          {datePreviewList.length > 0 && (
                            <span className="text-[11px] text-slate-500 hidden md:inline">
                              (วันนัด: {datePreviewList.join(', ')}{p.dateSchedules.length > 5 ? ' ...' : ''})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Category Badges for Prosecutor, Focus Button & Toggle Arrow */}
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
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

                      {/* Focus Button */}
                      {!isSingleFocused && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProsecutorFilter(p.prosecutorName);
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer shadow-2xs"
                          title="ดูตารางนัดเฉพาะอัยการท่านนี้"
                        >
                          🎯 โฟกัสเฉพาะท่านนี้
                        </button>
                      )}

                      <div className="text-slate-400 p-1">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Prosecutor Dates List */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-4 bg-slate-50/60">
                      {p.dateSchedules.map((ds) => {
                        const isToday = ds.date === todayStr;

                        return (
                          <div
                            key={ds.date}
                            className={`rounded-2xl border transition ${
                              isToday
                                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30 shadow-xs'
                                : 'bg-white border-slate-200 shadow-2xs'
                            }`}
                          >
                            {/* Date Header Strip */}
                            <div className="px-4 py-3 bg-gradient-to-r from-slate-100/90 to-slate-50 border-b border-slate-200 rounded-t-2xl flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-3 h-3 rounded-full ${isToday ? 'bg-amber-500 animate-pulse' : 'bg-blue-600'}`} />
                                <span className="text-xs sm:text-sm font-bold text-slate-900 font-['Prompt']">
                                  {ds.thaiDateLabel} ({ds.dayOfWeekThai})
                                </span>
                                {isToday && (
                                  <span className="bg-amber-500 text-slate-950 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-2xs">
                                    ★ นัดวันนี้
                                  </span>
                                )}
                              </div>

                              <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                {ds.appointments.length} สำนวน
                              </span>
                            </div>

                            {/* Appointments list for this date */}
                            <div className="p-3 sm:p-4 divide-y divide-slate-100">
                              {ds.appointments.map((a) => {
                                const catDisplay = getCalendarCategoryDisplay(a.category, a.appointmentTypeName);
                                const categoryBadge = (
                                  <span className={`text-xs font-bold border px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs ${catDisplay.badgeClass}`}>
                                    <span>{catDisplay.icon}</span>
                                    <span>{catDisplay.label}</span>
                                  </span>
                                );

                                return (
                                  <div
                                    key={a.uniqueKey}
                                    onClick={() => onSelectCase && onSelectCase(a.caseItem)}
                                    className="py-3.5 first:pt-1 last:pb-1 flex flex-col md:flex-row md:items-center justify-between gap-3 group hover:bg-blue-50/20 p-2.5 rounded-xl transition cursor-pointer"
                                  >
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {categoryBadge}

                                        {/* Time & Court Room */}
                                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200">
                                          <Clock className="w-3 h-3 text-slate-500" />
                                          {a.appointmentTime || '09:00 น.'}
                                        </span>

                                        {a.courtRoom && (
                                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                            🏛️ {a.courtRoom}
                                          </span>
                                        )}

                                        {a.isSubsequent && (
                                          <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                                            (นัดลำดับที่ {a.orderIndex})
                                          </span>
                                        )}
                                      </div>

                                      {/* Case Details */}
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pt-0.5">
                                        <span className="font-bold text-slate-950 text-sm font-['Prompt'] group-hover:text-blue-700 transition">
                                          คดีดำ {a.blackCaseNo}
                                        </span>
                                        {a.redCaseNo && a.redCaseNo !== '-' && (
                                          <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                            คดีแดง {a.redCaseNo}
                                          </span>
                                        )}
                                        <span className="text-slate-800">
                                          <strong>จำเลย:</strong> {a.defendant}
                                        </span>
                                        <span className="text-slate-500 text-[11px]">
                                          ({a.court})
                                        </span>
                                      </div>

                                      {/* Status Badges */}
                                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        {a.isCompleted ? (
                                          <span className="text-[11px] font-bold text-emerald-950 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>เสร็จสิ้นแล้ว{a.completedDate ? ` (${formatThaiDate(a.completedDate, { short: true })})` : ''}</span>
                                            <span className="text-[10px] text-emerald-800 font-semibold">• ดูประวัตินัด</span>
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
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
                                        <div className="pt-0.5">
                                          <CaseNoteHighlight notes={a.notes} compact />
                                        </div>
                                      )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1.5 self-start md:self-center shrink-0">
                                      {onOpenSubmitToDuty && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenSubmitToDuty(a.caseItem);
                                          }}
                                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs ${
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
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectCase(a.caseItem);
                                          }}
                                          className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                          title="เปิดดูรายละเอียดสำนวนคดีนี้"
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

                            {(() => {
                              const catDisplay = getCalendarCategoryDisplay(a.category, a.appointmentTypeName);
                              return (
                                <span className={`text-xs font-bold border px-2 py-0.5 rounded ${catDisplay.badgeClass}`}>
                                  {catDisplay.icon} {catDisplay.label}
                                </span>
                              );
                            })()}

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
                            <div className="pt-0.5">
                              <CaseNoteHighlight notes={a.notes} compact />
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
                {filteredAllAppointments.map((a, idx) => (
                    <tr key={a.uniqueKey} className={`hover:bg-slate-50 transition ${a.isCompleted ? 'bg-emerald-50/20' : ''}`}>
                      <td className="p-3 text-center text-slate-400 font-medium tabular-nums">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{a.prosecutorName}</td>
                      <td className="p-3 text-slate-700 whitespace-nowrap tabular-nums">
                        {formatThaiDate(a.appointmentDate)}
                      </td>
                      <td className="p-3 text-center text-slate-600 whitespace-nowrap tabular-nums">
                        {a.appointmentTime || '09:00 น.'}
                      </td>
                      <td className="p-3 text-center text-slate-600 whitespace-nowrap">
                        {a.courtRoom || '-'}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {(() => {
                          const catDisplay = getCalendarCategoryDisplay(a.category, a.appointmentTypeName);
                          return (
                            <span className={`font-semibold border px-2 py-0.5 rounded text-[11px] ${catDisplay.badgeClass}`}>
                              {catDisplay.icon} {catDisplay.shortLabel}
                            </span>
                          );
                        })()}
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
