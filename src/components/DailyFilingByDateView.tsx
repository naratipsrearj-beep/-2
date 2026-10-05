import React, { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Filter,
  Mic,
  MicOff,
  X,
  Volume2,
  FileText,
  ExternalLink,
  Edit3,
  Scale,
  Shield,
  CalendarDays,
  CalendarCheck2,
  ChevronLeft,
  Search,
  Layers,
  Sparkles,
  UserCheck,
  Undo2,
  FileSpreadsheet,
  ShieldAlert,
  HelpCircle,
  Check
} from 'lucide-react';
import { AppealCase, MonthlyDutyRoster, SheetConfig } from '../types/appeal';
import {
  formatThaiDate,
  getAppealUrgency,
  getDaysRemaining,
  getTodayString
} from '../utils/dateUtils';
import { CopyCaseDropdown } from './CopyCaseDropdown';
import { getAppointmentLabel, getAppointmentBadgeStyle } from '../utils/appointmentUtils';
import { useVoiceSearch, VoiceSearchResult } from '../hooks/useVoiceSearch';
import { DutyOfficerPickerModal } from './DutyOfficerPickerModal';
import { getDutyOfficersForDate } from '../services/dutyService';
import { DailyCasesToSheetsModal } from './DailyCasesToSheetsModal';

export type DailyProcedureFilter = 'all' | 'confessed' | 'denied_scheduled' | 'other_scheduled' | 'unknown_pending';

export function getCaseProcedureCategory(c: AppealCase): 'confessed' | 'denied_scheduled' | 'other_scheduled' | 'unknown_pending' {
  // 1. รับสารภาพ: มีคำพิพากษา หรือระบุคำให้การรับสารภาพ
  const isConfessed =
    c.defendantPlea === 'confessed' ||
    (c.judgmentOutcome && c.judgmentOutcome.toLowerCase().includes('รับสารภาพ')) ||
    Boolean(c.hasJudgment && c.judgmentDate);

  if (isConfessed) {
    return 'confessed';
  }

  // 2. ปฏิเสธมีนัดต่อ: จำเลยปฏิเสธ หรือมีนัดสืบพยาน/นัดพร้อมตรวจพยาน
  const isDenied =
    c.defendantPlea === 'denied' ||
    c.appointmentType === 'witness_examination' ||
    c.appointmentType === 'pre_trial';

  if (isDenied && c.appointmentType && c.appointmentType !== 'none') {
    return 'denied_scheduled';
  }
  if (c.defendantPlea === 'denied') {
    return 'denied_scheduled';
  }

  // 3. มีนัดอื่นๆ: เช่น นัดพร้อม, นัดไกล่เกลี่ย, นัดฟังคำสั่ง
  if (c.appointmentType && c.appointmentType !== 'none') {
    return 'other_scheduled';
  }

  // 4. ยังไม่ทราบผล / รอรายงานผล
  return 'unknown_pending';
}

export function getProcedureFilterLabel(filter: DailyProcedureFilter): string {
  switch (filter) {
    case 'confessed': return 'จำเลยรับสารภาพ';
    case 'denied_scheduled': return 'จำเลยปฏิเสธ - มีนัดต่อ';
    case 'other_scheduled': return 'สำนวนมีนัดอื่นๆ';
    case 'unknown_pending': return 'ยังไม่ทราบผล / รอความคืบหน้า';
    default: return 'ทั้งหมด';
  }
}

function getUrgencyBadgeStyle(urgency: string) {
  switch (urgency) {
    case 'overdue':
      return 'bg-rose-100 text-rose-800 border-rose-300';
    case 'critical':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'warning':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'normal':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'pending_trial':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

interface DailyFilingByDateViewProps {
  cases: AppealCase[];
  dutyRosters?: MonthlyDutyRoster[];
  initialSelectedDate?: string;
  externalDateSearch?: string;
  canEdit?: boolean;
  token?: string | null;
  sheetConfig?: SheetConfig | null;
  onMarkComplete: (caseItem: AppealCase) => void;
  onReopenCase?: (caseId: string) => void;
  onExtendDeadline: (caseItem: AppealCase) => void;
  onEditCase?: (caseItem: AppealCase) => void;
  onRecordJudgment?: (caseItem: AppealCase) => void;
  onOpenJudgmentDoc?: (caseItem: AppealCase) => void;
  onExportDailyDoc?: (filingDate: string, cases: AppealCase[]) => void;
  onOpenAppointmentModal?: (caseItem: AppealCase) => void;
  onAddNewCaseForDate?: (dateStr: string) => void;
  onQuickAssignOfficer?: (caseId: string, officerName: string) => void;
  onBatchAssignOfficerToDate?: (filingDate: string, officerName: string) => void;
  onToast?: (message: string) => void;
}

export const DailyFilingByDateView: React.FC<DailyFilingByDateViewProps> = ({
  cases,
  dutyRosters = [],
  initialSelectedDate,
  externalDateSearch = '',
  canEdit = true,
  token,
  sheetConfig,
  onMarkComplete,
  onReopenCase,
  onExtendDeadline,
  onEditCase,
  onRecordJudgment,
  onOpenJudgmentDoc,
  onExportDailyDoc,
  onOpenAppointmentModal,
  onAddNewCaseForDate,
  onQuickAssignOfficer,
  onBatchAssignOfficerToDate,
  onToast,
}) => {
  // วันที่เลือกเริ่มต้น
  const todayStr = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(initialSelectedDate || todayStr);
  const [viewMode, setViewMode] = useState<'single_date' | 'all_dates'>('single_date');
  const [filterOnlyActive, setFilterOnlyActive] = useState<boolean>(false);
  const [procedureFilter, setProcedureFilter] = useState<DailyProcedureFilter>('all');
  const [dateSearch, setDateSearch] = useState<string>(externalDateSearch);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Google Sheets Export Modal state
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [sheetsExportDate, setSheetsExportDate] = useState<string>(selectedDate);
  const [sheetsExportCases, setSheetsExportCases] = useState<AppealCase[]>([]);

  const handleOpenSheetsExport = (dateStr: string, casesList: AppealCase[]) => {
    setSheetsExportDate(dateStr);
    setSheetsExportCases(casesList);
    setIsSheetsModalOpen(true);
  };

  // Duty Officer Picker state
  const [isDutyPickerOpen, setIsDutyPickerOpen] = useState(false);
  const [caseForDutyPicker, setCaseForDutyPicker] = useState<AppealCase | null>(null);

  // Duty officers for the currently selected date
  const officersOnSelectedDate = useMemo(() => {
    return getDutyOfficersForDate(dutyRosters, selectedDate);
  }, [dutyRosters, selectedDate]);

  // Voice Search setup
  const handleVoiceResult = (result: VoiceSearchResult) => {
    setDateSearch(result.rawTranscript);
  };
  const { isListening, transcript, startListening, stopListening } = useVoiceSearch(handleVoiceResult);

  // Group cases by filing date
  const groupedByFilingDate = useMemo(() => {
    const groups: Record<string, AppealCase[]> = {};
    cases.forEach((c) => {
      const dateKey = c.filingDate || 'ไม่ระบุวันที่ฟ้อง';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(c);
    });
    return groups;
  }, [cases]);

  // Distinct filing dates sorted descending
  const distinctFilingDates = useMemo(() => {
    return Object.keys(groupedByFilingDate).sort((a, b) => b.localeCompare(a));
  }, [groupedByFilingDate]);

  // Count unassigned cases on selected date
  const unassignedCasesOnSelectedDate = useMemo(() => {
    const list = groupedByFilingDate[selectedDate] || [];
    return list.filter((c) => !c.prosecutorName && !c.responsiblePerson);
  }, [groupedByFilingDate, selectedDate]);

  // Cases filed on the currently selected date (filtered by search, active, and procedureFilter)
  const casesOnSelectedDate = useMemo(() => {
    return (groupedByFilingDate[selectedDate] || []).filter((c) => {
      if (filterOnlyActive && c.isCompleted) return false;
      if (procedureFilter !== 'all') {
        const cat = getCaseProcedureCategory(c);
        if (cat !== procedureFilter) return false;
      }
      if (dateSearch.trim()) {
        const q = dateSearch.toLowerCase().trim();
        return (
          c.blackCaseNo.toLowerCase().includes(q) ||
          Boolean(c.redCaseNo && c.redCaseNo.toLowerCase().includes(q)) ||
          Boolean(c.receivedNumberS1 && c.receivedNumberS1.toLowerCase().includes(q)) ||
          Boolean(c.filingNumberS4 && c.filingNumberS4.toLowerCase().includes(q)) ||
          Boolean(c.prosecutorName && c.prosecutorName.toLowerCase().includes(q)) ||
          Boolean(c.responsiblePerson && c.responsiblePerson.toLowerCase().includes(q)) ||
          c.court.toLowerCase().includes(q) ||
          c.plaintiff.toLowerCase().includes(q) ||
          c.defendant.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [groupedByFilingDate, selectedDate, filterOnlyActive, procedureFilter, dateSearch]);

  // Statistics for selected date (สถิติฟ้องรายวัน: รับสารภาพ / ปฏิเสธมีนัด / มีนัดอื่นๆ / ยังไม่ทราบผล)
  const statsForSelectedDate = useMemo(() => {
    const list = groupedByFilingDate[selectedDate] || [];
    const total = list.length;
    const confessed = list.filter((c) => getCaseProcedureCategory(c) === 'confessed').length;
    const deniedScheduled = list.filter((c) => getCaseProcedureCategory(c) === 'denied_scheduled').length;
    const otherScheduled = list.filter((c) => getCaseProcedureCategory(c) === 'other_scheduled').length;
    const unknownPending = list.filter((c) => getCaseProcedureCategory(c) === 'unknown_pending').length;

    const criminal = list.filter((c) => c.caseType.includes('อาญา')).length;
    const civil = list.filter((c) => !c.caseType.includes('อาญา')).length;
    const withJudgment = list.filter((c) => c.hasJudgment || c.judgmentDate).length;
    const pendingTrial = list.filter((c) => !c.hasJudgment && !c.judgmentDate).length;
    const completed = list.filter((c) => c.isCompleted).length;
    const urgent = list.filter((c) => {
      if (c.isCompleted) return false;
      const u = getAppealUrgency(c);
      return u === 'critical' || u === 'overdue' || u === 'warning';
    }).length;

    return {
      total,
      confessed,
      deniedScheduled,
      otherScheduled,
      unknownPending,
      criminal,
      civil,
      withJudgment,
      pendingTrial,
      completed,
      urgent,
    };
  }, [groupedByFilingDate, selectedDate]);

  // Quick navigation handlers
  const handleShiftDay = (days: number) => {
    try {
      const d = new Date(selectedDate);
      if (isNaN(d.getTime())) {
        setSelectedDate(todayStr);
        return;
      }
      d.setDate(d.getDate() + days);
      setSelectedDate(d.toISOString().slice(0, 10));
    } catch {
      setSelectedDate(todayStr);
    }
  };

  const handleToggleExpand = (dateKey: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: prev[dateKey] !== undefined ? !prev[dateKey] : false,
    }));
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner & Mode Toggle */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 flex-shrink-0">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 font-['Prompt']">
                  วันที่ฟ้อง
                </h2>
                <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  ค้นหาและตรวจสอบสำนวนประจำวัน
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือกวันที่ต้องการเพื่อดูจำนวนคดีที่ฟ้อง และรายละเอียดสำนวนทั้งหมดในวันนั้น
              </p>
            </div>
          </div>

          {/* View Mode Toggle: Single Date vs All Dates Overview */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setViewMode('single_date')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'single_date'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              <span>เลือกดูตามวันที่ฟ้อง</span>
            </button>
            <button
              onClick={() => setViewMode('all_dates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'all_dates'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>ดูทุกวันที่ฟ้อง ({distinctFilingDates.length} วัน)</span>
            </button>
          </div>
        </div>

        {/* Date Selector Section */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main Date Picker + Quick Arrow Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700">เลือกวันที่ต้องการ:</span>
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleShiftDay(-1)}
                className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition"
                title="วันก่อนหน้า (ย้อนหลัง 1 วัน)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                    if (viewMode === 'all_dates') setViewMode('single_date');
                  }
                }}
                className="text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />

              <button
                type="button"
                onClick={() => handleShiftDay(1)}
                className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition"
                title="วันถัดไป (+1 วัน)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Date Jump Buttons */}
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${
                selectedDate === todayStr
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              วันนี้
            </button>

            <button
              type="button"
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                setSelectedDate(y.toISOString().slice(0, 10));
              }}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
            >
              เมื่อวาน
            </button>
          </div>

          {/* Search box within selected date/cases */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder={isListening ? transcript || 'กำลังฟัง...' : 'ค้นหาเลขคดี, ส.1, ส.4, คู่ความ...'}
                value={isListening ? transcript : dateSearch}
                onChange={(e) => setDateSearch(e.target.value)}
                className={`w-full text-xs pl-8 pr-8 py-1.5 border rounded-xl focus:outline-none transition ${
                  isListening
                    ? 'border-rose-400 bg-rose-50/50 text-rose-900 ring-2 ring-rose-300'
                    : 'border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500'
                }`}
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              {dateSearch && (
                <button
                  onClick={() => setDateSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`p-1.5 rounded-xl border transition flex items-center justify-center ${
                isListening
                  ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="ค้นหาด้วยเสียง"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setFilterOnlyActive(!filterOnlyActive)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-xl border transition flex items-center gap-1 ${
                filterOnlyActive
                  ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>ยังไม่เสร็จ</span>
            </button>
          </div>
        </div>

        {/* Existing Dates Chips */}
        {distinctFilingDates.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">วันที่มีสำนวนในระบบ:</span>
            {distinctFilingDates.slice(0, 8).map((d) => {
              const count = groupedByFilingDate[d]?.length || 0;
              const isSelected = selectedDate === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelectedDate(d);
                    if (viewMode === 'all_dates') setViewMode('single_date');
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
                  }`}
                >
                  <span>{formatThaiDate(d, { short: true })}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count} คดี
                  </span>
                </button>
              );
            })}
            {distinctFilingDates.length > 8 && (
              <button
                type="button"
                onClick={() => setViewMode('all_dates')}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
              >
                ดูวันที่อื่นอีก {distinctFilingDates.length - 8} วัน...
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: SINGLE DATE VIEW (เด่นชัดเรื่องจำนวนคดีที่ฟ้องในวันที่เลือก)       */}
      {/* ========================================================================= */}
      {viewMode === 'single_date' && (
        <div className="space-y-4">
          {/* PROMINENT HERO COUNT BANNER ("ปรากฎจำนวนคดีที่ฟ้องในวันที่นั้น") */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 relative overflow-hidden">
            {/* Background glowing flair */}
            <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-semibold text-indigo-300">
                    ข้อมูลประจำวันยื่นฟ้อง
                  </span>
                  {selectedDate === todayStr && (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ● วันนี้
                    </span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold font-['Prompt'] text-white mt-1">
                  {formatThaiDate(selectedDate, { short: false })}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  รวบรวมสำนวนคดีที่ยื่นฟ้องต่อศาลในวันที่ {formatThaiDate(selectedDate, { short: true })}
                </p>
              </div>

              {/* Big Count Badge */}
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:px-6 flex items-center gap-4 self-start md:self-auto">
                <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/30">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-indigo-200 block">จำนวนคดีที่ฟ้องในวันที่นี้</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-extrabold font-['Prompt'] text-amber-300 tracking-tight">
                      {statsForSelectedDate.total}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">สำนวนคดี</span>
                  </div>
                </div>
              </div>
            </div>

            {/* หัวข้อให้เลือก สรุปสถิติที่ฟ้องรายวัน (ตามคำขอที่ 6) */}
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
                    onClick={() => setProcedureFilter('all')}
                    className="text-xs text-amber-300 hover:text-white underline underline-offset-2 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <span>✕ ล้างตัวกรอง (แสดงทั้งหมด {statsForSelectedDate.total} สำนวน)</span>
                  </button>
                )}
              </div>

              {/* 5 Selectable Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {/* 1. ทั้งหมด */}
                <button
                  type="button"
                  onClick={() => setProcedureFilter('all')}
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
                    <span className="text-2xl font-bold font-['Prompt'] text-white">
                      {statsForSelectedDate.total}
                    </span>
                    <span className="text-xs text-slate-300">สำนวน</span>
                  </div>
                </button>

                {/* 2. จำเลยรับสารภาพ */}
                <button
                  type="button"
                  onClick={() => setProcedureFilter(procedureFilter === 'confessed' ? 'all' : 'confessed')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    procedureFilter === 'confessed'
                      ? 'bg-emerald-600/40 border-emerald-400 text-white ring-2 ring-emerald-400/50 shadow-md'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  }`}
                  title="คลิกเพื่อกรองเฉพาะสำนวนที่จำเลยรับสารภาพหรือมีคำพิพากษา"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-emerald-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>จำเลยรับสารภาพ</span>
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-['Prompt'] text-emerald-300">
                      {statsForSelectedDate.confessed}
                    </span>
                    <span className="text-xs text-emerald-200/80">ราย</span>
                  </div>
                </button>

                {/* 3. ปฏิเสธมีนัดต่อ */}
                <button
                  type="button"
                  onClick={() => setProcedureFilter(procedureFilter === 'denied_scheduled' ? 'all' : 'denied_scheduled')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    procedureFilter === 'denied_scheduled'
                      ? 'bg-amber-600/40 border-amber-400 text-white ring-2 ring-amber-400/50 shadow-md'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  }`}
                  title="คลิกเพื่อกรองเฉพาะสำนวนที่จำเลยปฏิเสธและมีนัดสืบพยาน/ตรวจพยาน"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-amber-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>ปฏิเสธมีนัด</span>
                    </span>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-['Prompt'] text-amber-300">
                      {statsForSelectedDate.deniedScheduled}
                    </span>
                    <span className="text-xs text-amber-200/80">ราย</span>
                  </div>
                </button>

                {/* 4. มีนัดอื่นๆ */}
                <button
                  type="button"
                  onClick={() => setProcedureFilter(procedureFilter === 'other_scheduled' ? 'all' : 'other_scheduled')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    procedureFilter === 'other_scheduled'
                      ? 'bg-sky-600/40 border-sky-400 text-white ring-2 ring-sky-400/50 shadow-md'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  }`}
                  title="คลิกเพื่อกรองสำนวนที่มีนัดพร้อม นัดไกล่เกลี่ย หรือนัดฟังคำสั่ง"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-sky-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                      <span>มีนัดอื่นๆ</span>
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-['Prompt'] text-sky-300">
                      {statsForSelectedDate.otherScheduled}
                    </span>
                    <span className="text-xs text-sky-200/80">ราย</span>
                  </div>
                </button>

                {/* 5. ยังไม่ทราบผล */}
                <button
                  type="button"
                  onClick={() => setProcedureFilter(procedureFilter === 'unknown_pending' ? 'all' : 'unknown_pending')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between col-span-2 sm:col-span-1 ${
                    procedureFilter === 'unknown_pending'
                      ? 'bg-slate-600/50 border-slate-300 text-white ring-2 ring-slate-300/50 shadow-md'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  }`}
                  title="คลิกเพื่อกรองสำนวนที่ยังไม่ระบุผลหรือยังอยู่ระหว่างรอความคืบหน้า"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      <span>ยังไม่ทราบผล</span>
                    </span>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-['Prompt'] text-slate-200">
                      {statsForSelectedDate.unknownPending}
                    </span>
                    <span className="text-xs text-slate-400">ราย</span>
                  </div>
                </button>
              </div>
            </div>

            {/* ส่วนระบุอัยการเวรชี้ประจำวันยื่นฟ้อง (ระบุอัยการเวรชี้ในวันนั้นด้วย) */}
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
                          <span>⚖️ <strong>{off.name}</strong></span>
                          <span className="text-[11px] text-amber-300/80">({off.role})</span>
                          {off.courtRoom && <span className="text-[11px] text-amber-200/70">• {off.courtRoom}</span>}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 pt-0.5">
                      ยังไม่มีข้อมูลเวรชี้ตรงตามวันที่นี้ในตาราง PDF (คุณสามารถคลิกเพื่อเลือกจากรายชื่อเวรชี้ประจำเดือนได้)
                    </p>
                  )}
                </div>

                {/* Duty Prosecutor Actions & Quick Link */}
                <div className="flex items-center gap-2 flex-wrap">
                  {officersOnSelectedDate.length > 0 && unassignedCasesOnSelectedDate.length > 0 && canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetName = officersOnSelectedDate[0].name;
                        if (onBatchAssignOfficerToDate) {
                          onBatchAssignOfficerToDate(selectedDate, targetName);
                        } else if (onQuickAssignOfficer) {
                          unassignedCasesOnSelectedDate.forEach((c) => onQuickAssignOfficer(c.id, targetName));
                          if (onToast) onToast(`เชื่อมโยงอัยการเวรชี้ "${targetName}" ให้ ${unassignedCasesOnSelectedDate.length} สำนวนเรียบร้อยแล้ว`);
                        }
                      }}
                      className="text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      title="เชื่อมโยงชื่ออัยการเวรชี้ท่านนี้ให้สำนวนที่ยังไม่มีอัยการในวันนี้ทั้งหมด"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                      <span>⚡ เชื่อมโยงอัยการเวรชี้ให้คดีในวันนี้ ({unassignedCasesOnSelectedDate.length} สำนวน)</span>
                    </button>
                  )}

                  {dutyRosters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCaseForDutyPicker(null);
                        setIsDutyPickerOpen(true);
                      }}
                      className="text-xs font-semibold text-amber-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>ดูตารางเวรชี้ประจำเดือน (PDF)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Actions for this specific date */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {canEdit && onAddNewCaseForDate && (
                <button
                  type="button"
                  onClick={() => onAddNewCaseForDate(selectedDate)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มสำนวนที่ฟ้องในวันที่ {formatThaiDate(selectedDate, { short: true })}</span>
                </button>
              )}

              {!canEdit && (
                <div className="bg-white/10 text-slate-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-white/10">
                  <span>👁️ สิทธิ์ดูข้อมูลอย่างเดียว (อัปเดตแบบ Real-time จากเจ้าของระบบ)</span>
                </div>
              )}

              {onExportDailyDoc && statsForSelectedDate.total > 0 && (
                <button
                  type="button"
                  onClick={() => onExportDailyDoc(selectedDate, casesOnSelectedDate)}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3.5 py-2 rounded-xl border border-white/20 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-blue-300" />
                  <span>สร้างบัญชีคดี Google Docs ({statsForSelectedDate.total} คดี)</span>
                </button>
              )}

              {/* Google Sheets 7-Columns Export Button */}
              {casesOnSelectedDate.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleOpenSheetsExport(selectedDate, casesOnSelectedDate)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-emerald-500 flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title="นำออกข้อมูลคดีที่ฟ้องในวันนี้ เชื่อมไปยัง Google Sheet (7 คอลัมน์ พร้อมวันที่เสร็จสิ้น)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-white" />
                  <span>ส่งออก Google Sheets (7 คอลัมน์)</span>
                </button>
              )}
            </div>
          </div>

          {/* List of Cases filed on this date */}
          {casesOnSelectedDate.length > 0 ? (
            <div className="space-y-3">
              {/* Active Filter Bar if filtered */}
              {procedureFilter !== 'all' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between text-xs text-indigo-950">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <span>
                      กำลังกรองแสดงเฉพาะ: <strong className="text-indigo-900">{getProcedureFilterLabel(procedureFilter)}</strong> ({casesOnSelectedDate.length} สำนวน)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProcedureFilter('all')}
                    className="font-bold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 cursor-pointer"
                  >
                    ✕ แสดงสำนวนทั้งหมดในวันนี้
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  รายการคดีที่ฟ้องวันที่ {formatThaiDate(selectedDate)} ทั้งหมด{' '}
                  <strong className="text-slate-800 font-bold">{casesOnSelectedDate.length}</strong> คดี
                </span>
                {dateSearch && (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    กรองตามคำค้นหา: &quot;{dateSearch}&quot;
                  </span>
                )}
              </div>

              {casesOnSelectedDate.map((caseItem, idx) => {
                const daysLeft = getDaysRemaining(caseItem);
                const urgency = getAppealUrgency(caseItem);
                const isCompleted = caseItem.isCompleted;
                const procCat = getCaseProcedureCategory(caseItem);

                return (
                  <div
                    key={caseItem.id}
                    className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition ${
                      isCompleted
                        ? 'border-slate-200 bg-slate-50/50 opacity-80'
                        : urgency === 'critical' || urgency === 'overdue'
                        ? 'border-rose-300 bg-rose-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Case Info */}
                      <div className="space-y-2 flex-1 min-w-0">
                        {/* Number Badges & Badges Row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>

                          <span className="font-bold text-slate-900 font-['Prompt'] text-sm sm:text-base">
                            ดำ {caseItem.blackCaseNo}
                          </span>

                          {caseItem.redCaseNo ? (
                            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                              แดง {caseItem.redCaseNo}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                              ยังไม่มีเลขแดง
                            </span>
                          )}

                          {/* สถิติผลการดำเนินคดี Badge */}
                          {procCat === 'confessed' && (
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>🟢 จำเลยรับสารภาพ</span>
                            </span>
                          )}
                          {procCat === 'denied_scheduled' && (
                            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1.5 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>🟠 ปฏิเสธ - มีนัดสืบต่อ</span>
                            </span>
                          )}
                          {procCat === 'other_scheduled' && (
                            <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-200 flex items-center gap-1.5 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                              <span>🔵 มีนัดอื่นๆ</span>
                            </span>
                          )}
                          {procCat === 'unknown_pending' && (
                            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              <span>⚪ ยังไม่ทราบผล</span>
                            </span>
                          )}

                          {/* ส.1 Badge */}
                          {caseItem.receivedNumberS1 && (
                            <span
                              className="text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 flex items-center gap-1.5"
                              title={`ข้อมูลเลขรับ ส.1: ${caseItem.receivedNumberS1}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              <span>ส.1: {caseItem.receivedNumberS1}</span>
                            </span>
                          )}

                          {/* ส.4 Badge */}
                          {caseItem.filingNumberS4 && (
                            <span
                              className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1.5"
                              title={`ข้อมูลเลขฟ้อง ส.4: ${caseItem.filingNumberS4}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>ส.4: {caseItem.filingNumberS4}</span>
                            </span>
                          )}

                          {/* Duty Officer / Prosecutor Badge */}
                          {caseItem.prosecutorName ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCaseForDutyPicker(caseItem);
                                setIsDutyPickerOpen(true);
                              }}
                              className="text-xs font-semibold text-amber-950 bg-amber-50 hover:bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1 transition cursor-pointer"
                              title="คลิกเพื่อเลือกหรือเปลี่ยนเวรชี้จากตาราง PDF"
                            >
                              <span className="text-amber-700">⚖️ เวรชี้:</span> {caseItem.prosecutorName}
                              <UserCheck className="w-3 h-3 text-amber-600" />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCaseForDutyPicker(caseItem);
                                  setIsDutyPickerOpen(true);
                                }}
                                className="text-xs font-semibold text-amber-800 bg-amber-50/80 hover:bg-amber-100 border border-dashed border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                                title="เลือกเวรชี้จากตารางเวรชี้ประจำเดือนที่อัปโหลดไฟล์ PDF"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                                <span>+ เลือกเวรชี้ (PDF)</span>
                              </button>
                              {officersOnSelectedDate.length > 0 && onQuickAssignOfficer && (
                                <button
                                  type="button"
                                  onClick={() => onQuickAssignOfficer(caseItem.id, officersOnSelectedDate[0].name)}
                                  className="text-[11px] font-semibold text-amber-900 bg-amber-200/70 hover:bg-amber-300 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                                  title={`กำหนดให้อัยการเวรชี้วันนี้ (${officersOnSelectedDate[0].name}) ทันที`}
                                >
                                  <span>⚡ ใช้เวรชี้วันนี้</span>
                                </button>
                              )}
                            </div>
                          )}

                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                            {caseItem.caseType}
                          </span>

                          <span className="text-xs text-slate-700 font-medium">
                            📍 {caseItem.court}
                          </span>
                        </div>

                        {/* Court Appointment Badge */}
                        {caseItem.appointmentType && caseItem.appointmentType !== 'none' && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${getAppointmentBadgeStyle(caseItem.appointmentType).bg} ${getAppointmentBadgeStyle(caseItem.appointmentType).text} ${getAppointmentBadgeStyle(caseItem.appointmentType).border}`}
                              title={caseItem.appointmentNotes || undefined}
                            >
                              <span>{getAppointmentBadgeStyle(caseItem.appointmentType).icon}</span>
                              <span>{getAppointmentLabel(caseItem.appointmentType, caseItem.appointmentTypeName)}</span>
                              {caseItem.appointmentDate && (
                                <span className="font-bold">: {formatThaiDate(caseItem.appointmentDate)}</span>
                              )}
                              {caseItem.appointmentTime && <span>({caseItem.appointmentTime})</span>}
                            </span>

                            {/* Subsequent Appointments */}
                            {caseItem.subsequentAppointments && caseItem.subsequentAppointments.map((appt, aIdx) => (
                              <span
                                key={appt.id || aIdx}
                                className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200"
                                title={appt.notes || undefined}
                              >
                                <span>นัดที่ {aIdx + 2}: {getAppointmentLabel(appt.type, appt.typeName)} {formatThaiDate(appt.date)}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Parties */}
                        <div className="text-xs text-slate-600 flex flex-wrap gap-x-5 gap-y-1">
                          <div><span className="text-slate-400">โจทก์:</span> {caseItem.plaintiff}</div>
                          <div><span className="text-slate-400">จำเลย:</span> {caseItem.defendant}</div>
                          <div><span className="text-slate-400">ผู้รับผิดชอบ:</span> {caseItem.responsiblePerson}</div>
                        </div>

                        {/* Judgment or Outcome Notes */}
                        {caseItem.fullJudgmentText ? (
                          <div className="text-xs text-slate-800 bg-blue-50/50 p-2.5 rounded-xl border border-blue-200/60">
                            <span className="font-semibold text-blue-900">คำพิพากษา (Google Doc):</span>{' '}
                            <span className="line-clamp-2">{caseItem.fullJudgmentText}</span>
                          </div>
                        ) : caseItem.judgmentOutcome ? (
                          <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                            <span className="font-medium text-slate-800">ผลคำพิพากษา/ความคืบหน้า:</span> {caseItem.judgmentOutcome}
                          </div>
                        ) : null}

                        {caseItem.notes && (
                          <div className="text-[11px] text-slate-500 italic">
                            หมายเหตุ: {caseItem.notes}
                          </div>
                        )}
                      </div>

                      {/* Right Side: Deadline & Actions */}
                      <div className="flex flex-col sm:flex-row md:flex-col sm:items-end gap-3 md:border-l md:border-slate-100 md:pl-4 flex-shrink-0">
                        {/* Appeal Deadline Info */}
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>เสร็จสิ้นแล้ว</span>
                          </span>
                        ) : !caseItem.judgmentDate && !caseItem.appealDeadline ? (
                          <div className="text-left sm:text-right">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                              <Shield className="w-3.5 h-3.5 text-amber-600" />
                              <span>จำเลยปฏิเสธ (อยู่ระหว่างนัด)</span>
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              ยังไม่มีคำพิพากษา
                            </span>
                          </div>
                        ) : (
                          <div className="text-left sm:text-right">
                            <div
                              onClick={() => canEdit && onExtendDeadline(caseItem)}
                              className={`flex items-center gap-1.5 sm:justify-end ${
                                canEdit ? 'cursor-pointer group' : ''
                              }`}
                              title={
                                canEdit
                                  ? caseItem.extendedDeadline
                                    ? 'คลิกเพื่อแก้ไขวันขยายเวลา หรือขอขยายเวลาเพิ่ม'
                                    : 'คลิกเพื่อขอขยายระยะเวลาอุทธรณ์'
                                  : undefined
                              }
                            >
                              <span className="text-[11px] text-slate-500">ครบอุทธรณ์ 1 ด.:</span>
                              <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition">
                                {formatThaiDate(caseItem.extendedDeadline || caseItem.appealDeadline || '')}
                              </span>
                              {caseItem.extendedDeadline && (
                                <span className="text-[10px] text-amber-800 font-bold bg-amber-50 border border-amber-200 px-1 py-0.2 rounded">
                                  ขยาย #{caseItem.extensionCount || 1}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-1 sm:justify-end">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getUrgencyBadgeStyle(urgency)}`}
                              >
                                {daysLeft < 0
                                  ? `เกินกำหนด ${Math.abs(daysLeft)} วัน`
                                  : daysLeft === 0
                                  ? 'ครบกำหนดวันนี้!'
                                  : `เหลืออีก ${daysLeft} วัน`}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {canEdit ? (
                            <>
                              {/* 1. Edit Case Button */}
                              {onEditCase && (
                                <button
                                  type="button"
                                  onClick={() => onEditCase(caseItem)}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                                  title="แก้ไขหรือเพิ่มเติมข้อมูลสำนวนนี้"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>แก้ไขข้อมูล</span>
                                </button>
                              )}

                              {/* 2. Record Judgment Button */}
                              {!caseItem.judgmentDate && onRecordJudgment && (
                                <button
                                  type="button"
                                  onClick={() => onRecordJudgment(caseItem)}
                                  className="px-2.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                  title="ศาลตัดสินแล้ว บันทึกคำพิพากษาเพื่อเริ่มคุมอุทธรณ์ 1 เดือน"
                                >
                                  <Scale className="w-3.5 h-3.5" />
                                  <span>บันทึกคำพิพากษา</span>
                                </button>
                              )}

                              {/* 2.5. Extend / Edit Appeal Deadline Button */}
                              {(caseItem.judgmentDate || caseItem.hasJudgment) && onExtendDeadline && (
                                <button
                                  type="button"
                                  onClick={() => onExtendDeadline(caseItem)}
                                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer ${
                                    caseItem.extendedDeadline
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                  }`}
                                  title={
                                    caseItem.extendedDeadline
                                      ? 'แก้ไขวันขยายเวลาที่กรอกไว้ หรือขอขยายเวลาเพิ่ม'
                                      : 'ขอขยายระยะเวลาอุทธรณ์'
                                  }
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{caseItem.extendedDeadline ? `แก้ไขขยายเวลา (#${caseItem.extensionCount || 1})` : 'ขยายเวลา'}</span>
                                </button>
                              )}

                              {/* 3. Court Appointment Modal */}
                              {onOpenAppointmentModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenAppointmentModal(caseItem)}
                                  className="p-1.5 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                                  title="จัดการวันนัดศาล"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 3.5. Duty Officer Picker Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setCaseForDutyPicker(caseItem);
                                  setIsDutyPickerOpen(true);
                                }}
                                className="px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="เลือกเวรชี้ตามตารางเวรชี้แต่ละเดือนที่อัปโหลดไฟล์ PDF"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                                <span>{caseItem.prosecutorName ? `⚖️ ${caseItem.prosecutorName}` : '⚖️ เลือกเวรชี้ (PDF)'}</span>
                              </button>

                              {/* 3.8. Copy Case Details & Judgment */}
                              <CopyCaseDropdown
                                caseItem={caseItem}
                                variant="button"
                                onToast={onToast}
                              />

                              {/* 4. Complete button */}
                              {!isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => onMarkComplete(caseItem)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition"
                                  title="บันทึกเสร็จสิ้นสำนวน (ยื่นอุทธรณ์/ยุติ)"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* Copy Case Details & Judgment for viewers */}
                              <CopyCaseDropdown
                                caseItem={caseItem}
                                variant="button"
                                onToast={onToast}
                              />
                              {caseItem.prosecutorName && (
                                <span className="text-xs bg-amber-50 text-amber-900 px-2 py-1 rounded-lg border border-amber-200 font-medium">
                                  ⚖️ เวรชี้: {caseItem.prosecutorName}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400 italic">
                                [โหมดดูข้อมูลแบบเรียลไทม์]
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State for Selected Date */
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-base text-slate-800 font-['Prompt']">
                ไม่พบคดีที่ยื่นฟ้องในวันที่ {formatThaiDate(selectedDate)}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                ในวันที่เลือกนี้ยังไม่มีรายการสำนวนคดีที่บันทึกไว้ในระบบ คุณสามารถเริ่มเพิ่มสำนวนที่ยื่นฟ้องในวันนี้ได้ทันที
              </p>
              {onAddNewCaseForDate && (
                <button
                  type="button"
                  onClick={() => onAddNewCaseForDate(selectedDate)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มสำนวนที่ฟ้องในวันที่ {formatThaiDate(selectedDate, { short: true })}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: ALL DATES OVERVIEW (ดูทุกวันที่ฟ้องทั้งหมด)                       */}
      {/* ========================================================================= */}
      {viewMode === 'all_dates' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs text-slate-600">
            <span>แสดงภาพรวมทุกวันที่ยื่นฟ้อง ({distinctFilingDates.length} วัน) รวมทั้งหมด {cases.length} สำนวน</span>
            <button
              onClick={() => setViewMode('single_date')}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              ← กลับไปเลือกดูเฉพาะวันที่
            </button>
          </div>

          <div className="space-y-3">
            {distinctFilingDates.map((dateKey) => {
              const casesInGroup = groupedByFilingDate[dateKey] || [];
              const isOpen = expandedDates[dateKey] !== false;

              return (
                <div key={dateKey} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  {/* Group Header */}
                  <div
                    onClick={() => handleToggleExpand(dateKey)}
                    className="p-3.5 sm:p-4 bg-slate-50/80 hover:bg-slate-100/70 transition cursor-pointer flex items-center justify-between gap-3 border-b border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 font-['Prompt'] text-sm">
                            วันที่ฟ้อง: {formatThaiDate(dateKey)}
                          </span>
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.2 rounded-full">
                            {casesInGroup.length} คดี
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(dateKey);
                          setViewMode('single_date');
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg transition"
                      >
                        ดูเฉพาะวันนี้
                      </button>

                      {casesInGroup.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenSheetsExport(dateKey, casesInGroup)}
                          className="text-xs text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer font-medium"
                          title="นำออกข้อมูลคดีที่ฟ้องวันที่นี้ไปยัง Google Sheets (6 คอลัมน์)"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ส่งออก Sheets</span>
                        </button>
                      )}

                      {canEdit && onAddNewCaseForDate && (
                        <button
                          type="button"
                          onClick={() => onAddNewCaseForDate(dateKey)}
                          className="text-xs text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-2 py-1 rounded-lg transition flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>เพิ่มคดี</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Group Body */}
                  {isOpen && (
                    <div className="divide-y divide-slate-100 p-2 space-y-2">
                      {casesInGroup.map((caseItem) => (
                        <div key={caseItem.id} className="p-3 hover:bg-slate-50 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">ดำ {caseItem.blackCaseNo}</span>
                              {caseItem.redCaseNo && <span className="text-rose-700 font-semibold">แดง {caseItem.redCaseNo}</span>}
                              {caseItem.receivedNumberS1 && <span className="text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-medium">ส.1: {caseItem.receivedNumberS1}</span>}
                              {caseItem.filingNumberS4 && <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium">ส.4: {caseItem.filingNumberS4}</span>}
                              {caseItem.prosecutorName && (
                                <span className="text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold flex items-center gap-1">
                                  <span>⚖️ เวรชี้:</span>
                                  <span>{caseItem.prosecutorName}</span>
                                </span>
                              )}
                              <span className="text-slate-500">📍 {caseItem.court}</span>
                            </div>
                            <div className="text-slate-500">
                              โจทก์: {caseItem.plaintiff} | จำเลย: {caseItem.defendant}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Copy Case Details & Judgment */}
                            <CopyCaseDropdown
                              caseItem={caseItem}
                              variant="compact"
                              onToast={onToast}
                            />

                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCaseForDutyPicker(caseItem);
                                    setIsDutyPickerOpen(true);
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="เลือกหรือเปลี่ยนเวรชี้จากตารางเวรชี้ประจำเดือนที่อัปโหลดไฟล์ PDF"
                                >
                                  <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{caseItem.prosecutorName ? 'เปลี่ยนเวรชี้' : 'เลือกเวรชี้ (PDF)'}</span>
                                </button>
                                {onEditCase && (
                                  <button
                                    type="button"
                                    onClick={() => onEditCase(caseItem)}
                                    className="px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition font-medium border border-indigo-200 cursor-pointer"
                                  >
                                    แก้ไข
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Duty Officer Picker Modal (เลือกเวรชี้จากตารางเวรชี้แต่ละเดือนที่อัปโหลดไฟล์ PDF) */}
      <DutyOfficerPickerModal
        isOpen={isDutyPickerOpen}
        onClose={() => {
          setIsDutyPickerOpen(false);
          setCaseForDutyPicker(null);
        }}
        rosters={dutyRosters}
        targetDate={caseForDutyPicker ? caseForDutyPicker.filingDate : selectedDate}
        onSelectOfficer={(officerName) => {
          if (caseForDutyPicker) {
            if (onQuickAssignOfficer) {
              onQuickAssignOfficer(caseForDutyPicker.id, officerName);
            } else if (onEditCase) {
              onEditCase({
                ...caseForDutyPicker,
                prosecutorName: officerName,
                responsiblePerson: caseForDutyPicker.responsiblePerson || officerName,
              });
            }
          }
        }}
        title={
          caseForDutyPicker
            ? `เลือกเวรชี้สำหรับคดีดำ ${caseForDutyPicker.blackCaseNo}`
            : `รายชื่อเวรชี้ประจำเดือน`
        }
        subtitle={`วันที่ฟ้อง: ${formatThaiDate(
          caseForDutyPicker ? caseForDutyPicker.filingDate : selectedDate
        )}`}
      />

      {/* Daily Cases to Google Sheets Modal (6 Columns: ส.1/ส.4, คดีดำ, คดีแดง, อัยการ, ผู้ต้องหา, รับสารภาพ/มีนัด) */}
      <DailyCasesToSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        filingDate={sheetsExportDate}
        cases={sheetsExportCases}
        token={token}
        sheetConfig={sheetConfig}
        onToast={onToast}
      />
    </div>
  );
};
