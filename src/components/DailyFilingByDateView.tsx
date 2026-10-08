import React, { useState, useMemo, useEffect } from 'react';
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
  Check,
  QrCode,
  Copy,
  Table,
  Loader2,
  Trash2,
  RotateCcw,
  Truck,
  Palette
} from 'lucide-react';
import { AppealCase, MonthlyDutyRoster, SheetConfig } from '../types/appeal';
import {
  formatThaiDate,
  getAppealUrgency,
  getDaysRemaining,
  getTodayString
} from '../utils/dateUtils';
import { CopyCaseDropdown } from './CopyCaseDropdown';
import {
  getAppointmentLabel,
  getAppointmentBadgeStyle,
  isCaseConfessed,
  isCaseDenied,
  hasContinuousAppointment,
  isJudgmentRecorded
} from '../utils/appointmentUtils';
import { useVoiceSearch, VoiceSearchResult } from '../hooks/useVoiceSearch';
import { DutyOfficerPickerModal } from './DutyOfficerPickerModal';
import { getDutyOfficersForDate } from '../services/dutyService';
import { DailyCasesToSheetsModal } from './DailyCasesToSheetsModal';
import { formatCasesBatchForOfficeTsv, copyTextToClipboard } from '../utils/copyCaseUtils';
import { createDailyDutySummaryDoc } from '../services/docsService';
import { getAccessToken } from '../services/auth';

export type DailyProcedureFilter = 'all' | 'confessed' | 'denied_scheduled' | 'other_scheduled' | 'unknown_pending';

export function getCaseProcedureCategory(c: AppealCase): 'confessed' | 'denied_scheduled' | 'other_scheduled' | 'unknown_pending' {
  // 1. สำนวนเบิกฟ้อง: ยังไม่ทราบว่ารับสารภาพหรือปฏิเสธ
  if (c.isRequisitionCase || c.appointmentType === 'requisition') {
    return 'other_scheduled';
  }

  // 2. รับสารภาพ: มีคำพิพากษา หรือระบุคำให้การรับสารภาพ
  const isConfessed = isCaseConfessed(c);

  if (isConfessed) {
    return 'confessed';
  }

  // 3. ปฏิเสธมีนัดต่อ: จำเลยปฏิเสธ หรือมีนัดสืบพยาน/นัดพร้อมตรวจพยาน
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

  // 4. มีนัดอื่นๆ: เช่น นัดพร้อม, นัดไกล่เกลี่ย, นัดฟังคำสั่ง
  if (c.appointmentType && c.appointmentType !== 'none') {
    return 'other_scheduled';
  }

  // 5. ยังไม่ทราบผล / รอรายงานผล
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

/**
 * กำหนดสไตล์และสีพื้นหลังของการ์ดสำนวนตามคำขอที่ 6:
 * - กรณีรับสารภาพ: สีเขียวอ่อน สบายตา เด่นชัด (emerald)
 * - กรณีปฏิเสธ: สีส้ม/อำพัน ชัดเจน มีนัดสืบพยาน/ตรวจพยาน (amber)
 * - กรณีมีนัดอื่นๆ ที่จำเลยยังไม่ให้การ / สำนวนเบิกฟ้อง: สีฟ้าอ่อน นุ่มนวล ชัดเจน (sky)
 * - กรณีเสร็จสิ้นแล้ว: สีเทา/slate พร้อมสัญลักษณ์เสร็จสิ้น
 */
export function getCaseCardStyle(caseItem: AppealCase): {
  cardClass: string;
  badgeText: string;
  badgeClass: string;
  categoryLabel: string;
  colorName: 'emerald' | 'amber' | 'sky' | 'slate';
} {
  const isCompleted = caseItem.isCompleted;
  const procCat = getCaseProcedureCategory(caseItem);

  if (isCompleted) {
    return {
      cardClass: 'bg-slate-50/80 border-slate-300/80 border-l-4 border-l-slate-400 opacity-85',
      badgeText: 'เสร็จสิ้นแล้ว',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      categoryLabel: 'เสร็จสิ้นสำนวน',
      colorName: 'slate',
    };
  }

  if (procCat === 'confessed') {
    return {
      cardClass: 'bg-emerald-50/70 border-emerald-300 border-l-4 border-l-emerald-500 hover:bg-emerald-50/95 hover:border-emerald-400',
      badgeText: '🟢 จำเลยรับสารภาพ',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      categoryLabel: 'จำเลยรับสารภาพ',
      colorName: 'emerald',
    };
  }

  if (procCat === 'denied_scheduled') {
    return {
      cardClass: 'bg-amber-50/70 border-amber-300 border-l-4 border-l-amber-500 hover:bg-amber-50/95 hover:border-amber-400',
      badgeText: '🟠 จำเลยปฏิเสธ (มีนัดต่อ)',
      badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
      categoryLabel: 'จำเลยปฏิเสธ',
      colorName: 'amber',
    };
  }

  // other_scheduled หรือ unknown_pending (รวมสำนวนเบิกฟ้อง, นัดคุ้มครองสิทธิ, นัดพร้อม, รอนัด)
  const isReq = caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition';
  return {
    cardClass: 'bg-sky-50/70 border-sky-300 border-l-4 border-l-sky-500 hover:bg-sky-50/95 hover:border-sky-400',
    badgeText: isReq ? '🚚 สำนวนเบิกฟ้อง (ยังไม่ทราบคำให้การ)' : '🔵 มีนัดอื่นๆ (ยังไม่ทราบคำให้การ)',
    badgeClass: 'bg-sky-100 text-sky-950 border-sky-300',
    categoryLabel: isReq ? 'สำนวนเบิกฟ้อง' : 'มีนัดอื่นๆ',
    colorName: 'sky',
  };
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

/**
 * ฟังก์ชันค้นหาสำนวนคดีในมุมมองวันที่ฟ้อง
 * รองรับการพิมพ์ "วันที่ฟ้อง", วันที่ภาษาไทย, วันที่สากล, เลขคดีดำ, เลขคดีแดง, เลขรับ ส.1, ส.4, คู่ความ และอัยการ
 */
export function caseMatchesDailySearch(c: AppealCase, search: string): boolean {
  if (!search || !search.trim()) return true;
  const term = search.toLowerCase().trim();
  const cleanTerm = term
    .replace(/ค้นหา/g, '')
    .replace(/คดีดำ/g, '')
    .replace(/คดีแดง/g, '')
    .replace(/ส\.1/g, '')
    .replace(/ส\.4/g, '')
    .replace(/เลขรับ/g, '')
    .replace(/เลขฟ้อง/g, '')
    .replace(/ฟ้องวันที่/g, '')
    .replace(/วันที่ฟ้อง/g, '')
    .replace(/วันฟ้อง/g, '')
    .replace(/วันที่/g, '')
    .replace(/ยื่นฟ้อง/g, '')
    .replace(/ฟ้อง/g, '')
    .trim();

  // หากผู้ใช้พิมพ์เพียง "วันที่ฟ้อง", "ฟ้อง", "ค้นหา" ให้ถือว่าผ่านทั้งหมด
  if (!cleanTerm && (term.includes('ฟ้อง') || term.includes('วันที่') || term.includes('ค้นหา'))) {
    return true;
  }

  const q = cleanTerm || term;
  const rawFilingDate = (c.filingDate || '').toLowerCase();
  const thaiFilingDate = formatThaiDate(c.filingDate).toLowerCase();

  return (
    rawFilingDate.includes(q) ||
    thaiFilingDate.includes(q) ||
    (cleanTerm !== '' && (rawFilingDate.includes(cleanTerm) || thaiFilingDate.includes(cleanTerm))) ||
    c.blackCaseNo.toLowerCase().includes(q) ||
    c.blackCaseNo.toLowerCase().includes(term) ||
    Boolean(c.redCaseNo && (c.redCaseNo.toLowerCase().includes(q) || c.redCaseNo.toLowerCase().includes(term))) ||
    Boolean(c.receivedNumberS1 && (c.receivedNumberS1.toLowerCase().includes(q) || c.receivedNumberS1.toLowerCase().includes(term))) ||
    Boolean(c.filingNumberS4 && (c.filingNumberS4.toLowerCase().includes(q) || c.filingNumberS4.toLowerCase().includes(term))) ||
    Boolean(c.prosecutorName && (c.prosecutorName.toLowerCase().includes(q) || c.prosecutorName.toLowerCase().includes(term))) ||
    Boolean(c.responsiblePerson && (c.responsiblePerson.toLowerCase().includes(q) || c.responsiblePerson.toLowerCase().includes(term))) ||
    c.court.toLowerCase().includes(q) ||
    c.plaintiff.toLowerCase().includes(q) ||
    c.defendant.toLowerCase().includes(q) ||
    c.caseType.toLowerCase().includes(q) ||
    Boolean(c.judgmentOutcome && c.judgmentOutcome.toLowerCase().includes(q)) ||
    Boolean(c.notes && c.notes.toLowerCase().includes(q)) ||
    Boolean(c.requisitionNotes && c.requisitionNotes.toLowerCase().includes(q))
  );
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
  onOpenFileLabel?: (caseItem: AppealCase) => void;
  onOpenCourtPetition?: (caseItem: AppealCase) => void;
  onDeleteCase?: (caseId: string) => void;
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
  onOpenFileLabel,
  onOpenCourtPetition,
  onDeleteCase,
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

  // Sync external search query (เช่น จากแถบค้นหาด้วยเสียงด้านบน หรือปุ่มคลิกจากแท็บอื่น)
  useEffect(() => {
    if (externalDateSearch !== undefined) {
      setDateSearch(externalDateSearch);
    }
  }, [externalDateSearch]);

  // Batch office copy and Docs memo state
  const [copiedBatchTsv, setCopiedBatchTsv] = useState(false);
  const [isCreatingDailyMemo, setIsCreatingDailyMemo] = useState(false);

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

  // Distinct filing dates filtered by search and active status
  const filteredDistinctFilingDates = useMemo(() => {
    return distinctFilingDates.filter((dateKey) => {
      const casesInGroup = groupedByFilingDate[dateKey] || [];
      if (filterOnlyActive && !casesInGroup.some((c) => !c.isCompleted)) {
        return false;
      }
      if (!dateSearch.trim()) return true;
      const rawDate = dateKey.toLowerCase();
      const thaiDate = formatThaiDate(dateKey).toLowerCase();
      const q = dateSearch.toLowerCase().trim();
      if (rawDate.includes(q) || thaiDate.includes(q)) return true;
      return casesInGroup.some((c) => caseMatchesDailySearch(c, dateSearch));
    });
  }, [distinctFilingDates, groupedByFilingDate, dateSearch, filterOnlyActive]);

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
        return caseMatchesDailySearch(c, dateSearch);
      }
      return true;
    });
  }, [groupedByFilingDate, selectedDate, filterOnlyActive, procedureFilter, dateSearch]);

  // Cases matching search on OTHER filing dates (ช่วยแสดงผลกรณีค้นหาเลขคดีหรือวันที่ที่ไม่ได้อยู่ใน selectedDate ปัจจุบัน)
  const casesMatchingOtherDates = useMemo(() => {
    if (!dateSearch.trim()) return [];
    return cases.filter((c) => {
      const dateKey = c.filingDate || 'ไม่ระบุวันที่ฟ้อง';
      if (dateKey === selectedDate) return false;
      if (filterOnlyActive && c.isCompleted) return false;
      return caseMatchesDailySearch(c, dateSearch);
    });
  }, [cases, selectedDate, dateSearch, filterOnlyActive]);

  // Group matching cases in other dates by filing date
  const otherDatesWithMatches = useMemo(() => {
    const groups: Record<string, AppealCase[]> = {};
    casesMatchingOtherDates.forEach((c) => {
      const d = c.filingDate || 'ไม่ระบุวันที่ฟ้อง';
      if (!groups[d]) groups[d] = [];
      groups[d].push(c);
    });
    return groups;
  }, [casesMatchingOtherDates]);

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

  // Copy all cases on selected date as TSV for pasting into Excel / Office System
  const handleCopyDayForOfficeTsv = async () => {
    if (casesOnSelectedDate.length === 0) return;
    const tsv = formatCasesBatchForOfficeTsv(casesOnSelectedDate, true);
    const ok = await copyTextToClipboard(tsv);
    if (ok) {
      setCopiedBatchTsv(true);
      if (onToast) onToast(`คัดลอกข้อมูล ${casesOnSelectedDate.length} สำนวน สำหรับวางลง Excel / โปรแกรมสารบบ (Ctrl+V) แล้ว`);
      setTimeout(() => setCopiedBatchTsv(false), 2000);
    }
  };

  // Create Google Docs Memo Report for Daily Duty Prosecutor & Statistics
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
      if (onToast) onToast(`สร้างบันทึกข้อความรายงานผลการชี้คดีประจำวันใน Google Docs เรียบร้อยแล้ว`);
      window.open(res.docUrl, '_blank');
    } catch (err: any) {
      console.error('Failed to create daily summary doc:', err);
      if (onToast) onToast(`ไม่สามารถสร้างเอกสารได้: ${err.message || 'เกิดข้อผิดพลาด'}`);
    } finally {
      setIsCreatingDailyMemo(false);
    }
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
                placeholder={isListening ? transcript || 'กำลังฟัง...' : 'ค้นหาเลขคดี, วันที่ฟ้อง, ส.1, ส.4, คู่ความ...'}
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
                  <span>+ กรอกข้อมูลคดีใหม่ (ยื่นฟ้องวันที่ {formatThaiDate(selectedDate, { short: true })})</span>
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

              {/* Office / Excel TSV One-Click Copy */}
              {casesOnSelectedDate.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyDayForOfficeTsv}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-amber-500 flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title="คัดลอกแถวข้อมูลทุกคดีในวันนี้ นำไปกด Ctrl+V วางใน Excel หรือโปรแกรมสารบบของสำนักงานได้ทันที"
                >
                  {copiedBatchTsv ? <Check className="w-4 h-4 text-emerald-300" /> : <Table className="w-4 h-4 text-amber-200" />}
                  <span>{copiedBatchTsv ? 'คัดลอกแถวเรียบร้อยแล้ว!' : `คัดลอกวางลง Excel/สารบบ (${statsForSelectedDate.total} คดี)`}</span>
                </button>
              )}

              {/* Daily Duty Memo Report in Google Docs */}
              {casesOnSelectedDate.length > 0 && (
                <button
                  type="button"
                  onClick={handleCreateDailyDutyMemo}
                  disabled={isCreatingDailyMemo}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-blue-500 flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
                  title="สร้างบันทึกข้อความสรุปผลการชี้คดีและผลคำพิพากษาประจำวันเสนออัยการจังหวัดลง Google Docs"
                >
                  {isCreatingDailyMemo ? <Loader2 className="w-4 h-4 animate-spin text-blue-200" /> : <FileText className="w-4 h-4 text-blue-200" />}
                  <span>{isCreatingDailyMemo ? 'กำลังสร้างบันทึก...' : 'บันทึกรายงานผลชี้คดี (Docs)'}</span>
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
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                    กรองตามคำค้นหา: &quot;{dateSearch}&quot;
                  </span>
                )}
              </div>

              {/* Notice if additional matching cases exist on other filing dates */}
              {casesMatchingOtherDates.length > 0 && (
                <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-blue-950 gap-2 shadow-2xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                    <span>
                      พบอีก <strong>{casesMatchingOtherDates.length} คดี</strong> ในวันที่ฟ้องอื่นๆ ({Object.keys(otherDatesWithMatches).length} วัน) ที่ตรงกับคำค้นหา &quot;{dateSearch}&quot;
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Object.keys(otherDatesWithMatches).slice(0, 3).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDate(d)}
                        className="text-[11px] bg-white border border-blue-300 px-2 py-0.5 rounded-lg text-blue-800 hover:bg-blue-100 font-semibold cursor-pointer shadow-2xs transition"
                      >
                        ไปดู {formatThaiDate(d, { short: true })} ({otherDatesWithMatches[d].length})
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setViewMode('all_dates')}
                      className="text-[11px] underline font-bold text-indigo-700 hover:text-indigo-900 ml-1 cursor-pointer"
                    >
                      ดูทุกวันพร้อมกัน →
                    </button>
                  </div>
                </div>
              )}

              {/* แถบสีอธิบายสถานะพื้นหลังสำนวนตามคำขอที่ 6 */}
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:px-3.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                  <Palette className="w-4 h-4 text-indigo-600" />
                  <span>สีพื้นหลังจำแนกตามคำให้การ / นัด:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 border-l-4 border-l-emerald-500 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>สีเขียว = จำเลยรับสารภาพ</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 border-l-4 border-l-amber-500 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>สีส้ม/อำพัน = จำเลยปฏิเสธ (มีนัดต่อ)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-300 text-sky-950 border-l-4 border-l-sky-500 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    <span>สีฟ้า = มีนัดอื่นๆ ที่จำเลยยังไม่ให้การ / เบิกฟ้อง</span>
                  </span>
                </div>
              </div>

              {casesOnSelectedDate.map((caseItem, idx) => {
                const daysLeft = getDaysRemaining(caseItem);
                const urgency = getAppealUrgency(caseItem);
                const isCompleted = caseItem.isCompleted;
                const procCat = getCaseProcedureCategory(caseItem);
                const cardStyle = getCaseCardStyle(caseItem);
                const hasNextAppt = hasContinuousAppointment(caseItem);
                const hasJudgmentRecorded = isJudgmentRecorded(caseItem);

                return (
                  <div
                    key={caseItem.id}
                    className={`rounded-xl p-3 sm:p-3.5 shadow-2xs hover:shadow-xs transition border ${cardStyle.cardClass}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      {/* Case Info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Number Badges & Badges Row */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="w-5 h-5 rounded text-[11px] font-mono font-bold bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>

                          <span className="font-bold text-slate-900 font-['Prompt'] text-sm sm:text-base">
                            ดำ {caseItem.blackCaseNo}
                          </span>

                          {caseItem.redCaseNo ? (
                            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              แดง {caseItem.redCaseNo}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 bg-slate-100/90 px-1.5 py-0.5 rounded-md border border-slate-200">
                              ยังไม่มีเลขแดง
                            </span>
                          )}

                          {/* สัญลักษณ์แสดงว่าสำนวนนี้มีการกรอกคำพิพากษาแล้วตามคำขอ */}
                          {hasJudgmentRecorded ? (
                            <span
                              className="text-xs font-bold text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1 shadow-2xs"
                              title={caseItem.judgmentDate ? `สำนวนนี้กรอกคำพิพากษาแล้ว (วันที่ ${formatThaiDate(caseItem.judgmentDate)})` : 'สำนวนนี้มีการกรอกคำพิพากษาแล้ว'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>⚖️ กรอกคำพิพากษาแล้ว</span>
                              {caseItem.judgmentDate && (
                                <span className="text-[11px] text-emerald-800 font-semibold">({formatThaiDate(caseItem.judgmentDate, { short: true })})</span>
                              )}
                            </span>
                          ) : (
                            (hasNextAppt || isCaseDenied(caseItem)) ? null : (
                              <span
                                className="text-[11px] font-medium text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded-md border border-slate-200 flex items-center gap-1"
                                title="สำนวนนี้ยังไม่ได้กรอกคำพิพากษา"
                              >
                                <Scale className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>ยังไม่กรอกคำพิพากษา</span>
                              </span>
                            )
                          )}

                          {/* สถิติผลการดำเนินคดี Badge */}
                          {procCat === 'confessed' && (
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>🟢 จำเลยรับสารภาพ</span>
                            </span>
                          )}
                          {procCat === 'denied_scheduled' && (
                            <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300 flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>🟠 ปฏิเสธ - มีนัดสืบต่อ</span>
                            </span>
                          )}
                          {procCat === 'other_scheduled' && (
                            (caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition') ? (
                              <span className="text-xs font-bold text-orange-950 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-300 flex items-center gap-1 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                <span>🚚 สำนวนเบิกฟ้อง</span>
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-sky-900 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-300 flex items-center gap-1 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                <span>🔵 มีนัดอื่นๆ</span>
                              </span>
                            )
                          )}
                          {procCat === 'unknown_pending' && (
                            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              <span>⚪ ยังไม่ทราบผล</span>
                            </span>
                          )}

                          {/* ส.1 Badge */}
                          {caseItem.receivedNumberS1 && (
                            <span
                              className="text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1"
                              title={`ข้อมูลเลขรับ ส.1: ${caseItem.receivedNumberS1}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              <span>ส.1: {caseItem.receivedNumberS1}</span>
                            </span>
                          )}

                          {/* ส.4 Badge */}
                          {caseItem.filingNumberS4 && (
                            <span
                              className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1"
                              title={`ข้อมูลเลขฟ้อง ส.4: ${caseItem.filingNumberS4}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>ส.4: {caseItem.filingNumberS4}</span>
                            </span>
                          )}

                          <span className="text-xs text-slate-500 bg-slate-100/90 px-1.5 py-0.5 rounded">
                            {caseItem.caseType}
                          </span>

                          <span className="text-xs text-slate-600 font-medium">
                            📍 {caseItem.court}
                          </span>
                        </div>

                        {/* Parties, Defendant & Prosecutor row */}
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                          {/* ชื่อจำเลย - แสดงเด่นชัดเจนในกรอบสีอำพัน */}
                          <div
                            className="inline-flex items-center gap-1 bg-amber-50/95 border border-amber-300 text-slate-950 px-2.5 py-0.5 rounded-lg shadow-2xs font-['Prompt']"
                            title={`จำเลย: ${caseItem.defendant || '-'}`}
                          >
                            <span className="text-amber-800 font-extrabold text-[11px] shrink-0">👤 จำเลย:</span>
                            <span className="text-slate-950 font-bold text-xs sm:text-sm tracking-wide">
                              {caseItem.defendant || '-'}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 font-medium">โจทก์:</span> {caseItem.plaintiff || '-'}
                          </div>

                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-950 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                            <span className="text-indigo-700">👔 เจ้าของสำนวน:</span>
                            <span>{caseItem.responsiblePerson || 'รอกำหนด'}</span>
                          </div>

                          {/* อัยการเวรชี้ */}
                          {caseItem.prosecutorName ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCaseForDutyPicker(caseItem);
                                setIsDutyPickerOpen(true);
                              }}
                              className="text-[11px] font-medium text-slate-700 bg-white/90 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300 flex items-center gap-1 transition cursor-pointer shadow-2xs"
                              title="คลิกเพื่อเลือกหรือเปลี่ยนอัยการเวรชี้จากตาราง PDF"
                            >
                              <span className="text-slate-500">⚖️ เวรชี้:</span>
                              <span className="text-slate-900 font-bold">{caseItem.prosecutorName}</span>
                              <UserCheck className="w-3 h-3 text-slate-400" />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCaseForDutyPicker(caseItem);
                                  setIsDutyPickerOpen(true);
                                }}
                                className="text-[10px] text-slate-500 bg-white/80 hover:bg-slate-100 border border-dashed border-slate-300 px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer"
                                title="เลือกอัยการเวรชี้จากตาราง PDF"
                              >
                                <UserCheck className="w-3 h-3 text-slate-400" />
                                <span>ระบุเวรชี้ (PDF)</span>
                              </button>
                              {officersOnSelectedDate.length > 0 && onQuickAssignOfficer && (
                                <button
                                  type="button"
                                  onClick={() => onQuickAssignOfficer(caseItem.id, officersOnSelectedDate[0].name)}
                                  className="text-[10px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 transition cursor-pointer"
                                  title={`กำหนดให้อัยการเวรชี้วันนี้ (${officersOnSelectedDate[0].name}) ทันที`}
                                >
                                  <span>⚡ ใช้เวรชี้วันนี้</span>
                                </button>
                              )}
                            </div>
                          )}

                          {(caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition') && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-800 bg-orange-50 border border-orange-300 px-2 py-0.5 rounded-md shadow-2xs">
                              <span>🚚 สำนวนเบิกฟ้อง</span>
                              {(caseItem.requisitionDate || caseItem.appointmentDate) && (
                                <span className="font-bold">: {formatThaiDate(caseItem.requisitionDate || caseItem.appointmentDate)}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Court Appointment Badge (คดีที่จำเลยรับสารภาพจะไม่แสดงนัดคุ้มครองสิทธิ) */}
                        {(() => {
                          const isConfessed = procCat === 'confessed' || isCaseConfessed(caseItem);

                          const showAppt =
                            caseItem.appointmentType &&
                            caseItem.appointmentType !== 'none' &&
                            !(isConfessed && caseItem.appointmentType === 'rights_protection');

                          const filteredSubsequent = (caseItem.subsequentAppointments || []).filter(
                            (appt) => !(isConfessed && appt.type === 'rights_protection')
                          );

                          if (!showAppt && filteredSubsequent.length === 0) return null;

                          return (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {showAppt && (
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${getAppointmentBadgeStyle(caseItem.appointmentType!).bg} ${getAppointmentBadgeStyle(caseItem.appointmentType!).text} ${getAppointmentBadgeStyle(caseItem.appointmentType!).border}`}
                                  title={caseItem.appointmentNotes || undefined}
                                >
                                  <span>{getAppointmentBadgeStyle(caseItem.appointmentType!).icon}</span>
                                  <span>{getAppointmentLabel(caseItem.appointmentType!, caseItem.appointmentTypeName)}</span>
                                  {caseItem.appointmentDate && (
                                    <span className="font-bold">: {formatThaiDate(caseItem.appointmentDate)}</span>
                                  )}
                                  {caseItem.appointmentTime && <span>({caseItem.appointmentTime})</span>}
                                </span>
                              )}

                              {filteredSubsequent.map((appt, aIdx) => (
                                <span
                                  key={appt.id || aIdx}
                                  className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                                  title={appt.notes || undefined}
                                >
                                  <span>นัดที่ {aIdx + 2}: {getAppointmentLabel(appt.type, appt.typeName)} {formatThaiDate(appt.date)}</span>
                                </span>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Judgment or Outcome Notes: ในสำนวนที่มีนัดต่อ ไม่ต้องให้ขึ้น ผลคำพิพากษา/ความคืบหน้า โดยย่อ */}
                        {!hasNextAppt && (
                          caseItem.fullJudgmentText ? (
                            <div className="text-xs text-slate-800 bg-blue-50/50 p-2 rounded-lg border border-blue-200/60">
                              <span className="font-semibold text-blue-900">คำพิพากษา (Google Doc):</span>{' '}
                              <span className="line-clamp-2">{caseItem.fullJudgmentText}</span>
                            </div>
                          ) : caseItem.judgmentOutcome ? (
                            <div className="text-xs text-slate-700 bg-white/80 p-2 rounded-lg border border-slate-200/70">
                              <span className="font-medium text-slate-800">ผลคำพิพากษา/ความคืบหน้า:</span> {caseItem.judgmentOutcome}
                            </div>
                          ) : null
                        )}

                        {caseItem.notes && (
                          <div className="text-[11px] text-slate-500 italic">
                            หมายเหตุ: {caseItem.notes}
                          </div>
                        )}
                      </div>

                      {/* Right Side: Deadline & Actions */}
                      <div className="flex flex-col sm:items-end gap-2 md:border-l md:border-slate-200/60 md:pl-3.5 flex-shrink-0">
                        {/* Status / Deadline Info */}
                        {isCompleted ? (
                          <div className="text-left sm:text-right">
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 font-bold shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>เสร็จสิ้นแล้ว {caseItem.completedDate ? `(${formatThaiDate(caseItem.completedDate, { short: true })})` : ''}</span>
                            </span>
                          </div>
                        ) : hasJudgmentRecorded && (caseItem.judgmentDate || caseItem.appealDeadline) ? (
                          <div className="text-left sm:text-right space-y-1">
                            <div
                              onClick={() => canEdit && onExtendDeadline(caseItem)}
                              className={`flex items-center gap-1 text-[11px] sm:justify-end ${canEdit ? 'cursor-pointer hover:text-amber-700' : ''}`}
                              title={canEdit ? 'คลิกเพื่อขอขยายระยะเวลาอุทธรณ์' : undefined}
                            >
                              <span className="text-slate-400">ครบอุทธรณ์ 1 ด.:</span>
                              <span className="text-xs font-bold text-slate-800">
                                {formatThaiDate(caseItem.extendedDeadline || caseItem.appealDeadline || '')}
                              </span>
                              {caseItem.extendedDeadline && (
                                <span className="text-[10px] text-amber-800 font-bold bg-amber-50 border border-amber-200 px-1 rounded">
                                  ขยาย #{caseItem.extensionCount || 1}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center sm:justify-end">
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
                        ) : (
                          <div className="text-left sm:text-right">
                            {hasNextAppt ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                                <Shield className="w-3.5 h-3.5 text-amber-600" />
                                <span>อยู่ระหว่างนัดพิจารณา</span>
                              </span>
                            ) : isCaseConfessed(caseItem) || procCat === 'confessed' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>จำเลยรับสารภาพ (รอคำพิพากษา)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-lg bg-sky-50 text-sky-900 border border-sky-200">
                                <Clock className="w-3.5 h-3.5 text-sky-600" />
                                <span>รอนัด / ยังไม่ทราบผล</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Action Buttons Toolbar */}
                        <div className="flex flex-wrap items-center gap-1 sm:justify-end pt-0.5">
                          {/* 1. Copy Case Details */}
                          <CopyCaseDropdown
                            caseItem={caseItem}
                            variant="compact"
                            onOpenFileLabel={onOpenFileLabel}
                            onOpenCourtPetition={onOpenCourtPetition}
                            onToast={onToast}
                          />

                          {canEdit ? (
                            <>
                              {/* 2. Record Judgment Button */}
                              {onRecordJudgment && (
                                <button
                                  type="button"
                                  onClick={() => onRecordJudgment(caseItem)}
                                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 ${
                                    hasJudgmentRecorded
                                      ? 'text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 font-bold'
                                      : 'text-white bg-amber-600 hover:bg-amber-700'
                                  }`}
                                  title={hasJudgmentRecorded && caseItem.judgmentDate ? `แก้ไขคำพิพากษา (กรอกแล้วเมื่อ ${formatThaiDate(caseItem.judgmentDate)})` : 'กรอกคำพิพากษา'}
                                >
                                  {hasJudgmentRecorded ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>แก้คำพิพากษา (กรอกแล้ว)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Scale className="w-3.5 h-3.5" />
                                      <span>+ กรอกคำพิพากษา</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* 3. Edit Case Info */}
                              {onEditCase && (
                                <button
                                  type="button"
                                  onClick={() => onEditCase(caseItem)}
                                  className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="กรอกหรือแก้ไขข้อมูลสำนวนคดีนี้"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>แก้ไข</span>
                                </button>
                              )}

                              {/* 4. Complete / Edit Completed Date */}
                              {onMarkComplete && (
                                <button
                                  type="button"
                                  onClick={() => onMarkComplete(caseItem)}
                                  className={`px-2 py-1 text-xs rounded-md transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 ${
                                    isCompleted
                                      ? 'text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 font-bold'
                                      : 'text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 font-semibold'
                                  }`}
                                  title={isCompleted ? 'แก้ไขวันที่เสร็จสิ้น' : 'กรอกวันที่เสร็จสิ้นสำนวน'}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{isCompleted ? 'แก้เสร็จ' : 'เสร็จสิ้น'}</span>
                                </button>
                              )}

                              {/* 5. Extend Deadline (if judgment exists and is recorded) */}
                              {hasJudgmentRecorded && (caseItem.judgmentDate || caseItem.hasJudgment) && (
                                <button
                                  type="button"
                                  onClick={() => onExtendDeadline(caseItem)}
                                  className={`px-2 py-1 text-xs font-medium rounded-md transition flex items-center gap-1 cursor-pointer ${
                                    caseItem.extendedDeadline
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                  }`}
                                  title={caseItem.extendedDeadline ? 'แก้ไขวันขยายเวลา' : 'ขอขยายระยะเวลาอุทธรณ์'}
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{caseItem.extendedDeadline ? `ขยาย #${caseItem.extensionCount || 1}` : 'ขยายเวลา'}</span>
                                </button>
                              )}

                              {/* 6. Court Appointment Modal */}
                              {onOpenAppointmentModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenAppointmentModal(caseItem)}
                                  className="p-1 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-md transition cursor-pointer"
                                  title="จัดการวันนัดศาล"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 7. File Label & QR Code */}
                              {onOpenFileLabel && (
                                <button
                                  type="button"
                                  onClick={() => onOpenFileLabel(caseItem)}
                                  className="p-1 text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-md transition cursor-pointer shadow-2xs"
                                  title="พิมพ์ป้ายติดหน้าซองสำนวนคดี & QR Code"
                                >
                                  <QrCode className="w-3.5 h-3.5 text-amber-600" />
                                </button>
                              )}

                              {/* 8. Delete Case */}
                              {onDeleteCase && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteCase(caseItem.id)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md transition cursor-pointer"
                                  title={`ลบสำนวนคดีดำ ${caseItem.blackCaseNo}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              {caseItem.prosecutorName && (
                                <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                  ⚖️ เวรชี้: {caseItem.prosecutorName}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : dateSearch.trim() && casesMatchingOtherDates.length > 0 ? (
            /* Search yielded matches on other dates */
            <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-6 sm:p-8 shadow-xs animate-in fade-in">
              <div className="flex items-start sm:items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 font-['Prompt'] text-base">
                    ไม่พบคดีที่ตรงกับคำค้นหา &quot;{dateSearch}&quot; ในวันที่ {formatThaiDate(selectedDate)}
                  </h4>
                  <p className="text-xs text-amber-900/90 mt-0.5">
                    แต่พบ <strong>{casesMatchingOtherDates.length} คดี</strong> ในวันที่ฟ้องอื่นๆ ({Object.keys(otherDatesWithMatches).length} วัน) ที่ตรงกับคำค้นหา:
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-amber-200/90 mb-5">
                {Object.keys(otherDatesWithMatches).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-700" />
                    <span>วันที่ {formatThaiDate(d)}</span>
                    <span className="bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                      {otherDatesWithMatches[d].length} คดี
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700">รายการคดีที่พบในวันอื่นๆ (คลิกเพื่อเปิดดูวันนั้นทันที):</div>
                {casesMatchingOtherDates.slice(0, 6).map((otherCase) => (
                  <div
                    key={otherCase.id}
                    onClick={() => {
                      if (otherCase.filingDate) setSelectedDate(otherCase.filingDate);
                    }}
                    className="bg-white p-3 rounded-xl border border-amber-200 hover:border-indigo-400 hover:shadow-xs transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">ดำ {otherCase.blackCaseNo}</span>
                      {otherCase.redCaseNo && <span className="text-rose-700 font-semibold">แดง {otherCase.redCaseNo}</span>}
                      <span className="text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-medium text-[11px]">
                        ฟ้องวันที่: {formatThaiDate(otherCase.filingDate)}
                      </span>
                      {otherCase.responsiblePerson && (
                        <span className="text-slate-600">👔 {otherCase.responsiblePerson}</span>
                      )}
                      <span className="text-slate-500">จ: {otherCase.plaintiff} | ล: {otherCase.defendant}</span>
                    </div>
                    <span className="text-indigo-600 font-bold hover:underline shrink-0 text-xs">
                      สลับไปดูวันที่นี้ →
                    </span>
                  </div>
                ))}
              </div>
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
                {dateSearch.trim()
                  ? `ไม่พบสำนวนคดีที่ตรงกับคำค้นหา "${dateSearch}" ในวันที่เลือกนี้`
                  : 'ในวันที่เลือกนี้ยังไม่มีรายการสำนวนคดีที่บันทึกไว้ในระบบ คุณสามารถเริ่มเพิ่มสำนวนที่ยื่นฟ้องในวันนี้ได้ทันที'}
              </p>
              {onAddNewCaseForDate && (
                <button
                  type="button"
                  onClick={() => onAddNewCaseForDate(selectedDate)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ กรอกข้อมูลคดีที่ยื่นฟ้องในวันที่ {formatThaiDate(selectedDate, { short: true })}</span>
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
            <span>
              แสดงภาพรวม {filteredDistinctFilingDates.length} วันที่ยื่นฟ้อง {dateSearch ? `(กรองตาม "${dateSearch}")` : `(ทั้งหมด ${distinctFilingDates.length} วัน)`} รวม {cases.length} สำนวน
            </span>
            <button
              onClick={() => setViewMode('single_date')}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              ← กลับไปเลือกดูเฉพาะวันที่
            </button>
          </div>

          {/* แถบสีอธิบายสถานะพื้นหลังสำนวน */}
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:px-3.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold">
              <Palette className="w-4 h-4 text-indigo-600" />
              <span>สีพื้นหลังจำแนกตามคำให้การ / นัด:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 border-l-4 border-l-emerald-500 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>สีเขียว = จำเลยรับสารภาพ</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 border-l-4 border-l-amber-500 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>สีส้ม/อำพัน = จำเลยปฏิเสธ (มีนัดต่อ)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-300 text-sky-950 border-l-4 border-l-sky-500 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                <span>สีฟ้า = มีนัดอื่นๆ ที่จำเลยยังไม่ให้การ / เบิกฟ้อง</span>
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {filteredDistinctFilingDates.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm text-slate-700">ไม่พบวันที่ฟ้องหรือสำนวนคดีที่ตรงกับคำค้นหา &quot;{dateSearch}&quot;</p>
                <p className="text-xs text-slate-400 mt-1">ลองพิมพ์วันที่ในรูปแบบ เช่น 15 ก.ย., 2026-09-15 หรือค้นหาด้วยเลขคดี</p>
              </div>
            ) : (
              filteredDistinctFilingDates.map((dateKey) => {
                const allCasesInGroup = groupedByFilingDate[dateKey] || [];
                const casesInGroup = dateSearch.trim()
                  ? allCasesInGroup.filter((c) => caseMatchesDailySearch(c, dateSearch))
                  : allCasesInGroup;
                const isOpen = dateSearch.trim() ? true : (expandedDates[dateKey] !== false);

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
                          className="text-xs text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg transition flex items-center gap-1 font-semibold"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ กรอกข้อมูลคดี</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Group Body */}
                  {isOpen && (
                    <div className="p-2.5 space-y-2.5">
                      {casesInGroup.map((caseItem) => {
                        const rowStyle = getCaseCardStyle(caseItem);
                        const hasJudgmentRecorded = isJudgmentRecorded(caseItem);
                        return (
                        <div key={caseItem.id} className={`p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs border transition ${rowStyle.cardClass}`}>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 font-['Prompt']">ดำ {caseItem.blackCaseNo}</span>
                              {caseItem.redCaseNo && <span className="text-rose-700 font-semibold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">แดง {caseItem.redCaseNo}</span>}
                              {hasJudgmentRecorded ? (
                                <span
                                  className="text-[11px] font-bold text-emerald-900 bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1 shadow-2xs"
                                  title={caseItem.judgmentDate ? `กรอกคำพิพากษาแล้ว (${formatThaiDate(caseItem.judgmentDate)})` : 'กรอกคำพิพากษาแล้ว'}
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>⚖️ กรอกคำพิพากษาแล้ว</span>
                                </span>
                              ) : (
                                (hasContinuousAppointment(caseItem) || isCaseDenied(caseItem)) ? null : (
                                  <span
                                    className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1"
                                    title="ยังไม่กรอกคำพิพากษา"
                                  >
                                    <Scale className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                    <span>ยังไม่กรอกคำพิพากษา</span>
                                  </span>
                                )
                              )}
                              {caseItem.receivedNumberS1 && <span className="text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-medium border border-blue-200">ส.1: {caseItem.receivedNumberS1}</span>}
                              {caseItem.filingNumberS4 && <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium border border-emerald-200">ส.4: {caseItem.filingNumberS4}</span>}
                              {caseItem.responsiblePerson && (
                                <span className="text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-semibold flex items-center gap-1 shadow-2xs">
                                  <span className="text-indigo-700">👔 อัยการเจ้าของสำนวน:</span>
                                  <span>{caseItem.responsiblePerson}</span>
                                </span>
                              )}
                              {caseItem.prosecutorName && (
                                <span className="text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 font-normal flex items-center gap-1">
                                  <span className="text-slate-500">⚖️ อัยการเวรชี้:</span>
                                  <span>{caseItem.prosecutorName}</span>
                                </span>
                              )}
                              {(caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition') && (
                                <span className="text-orange-950 bg-orange-50 px-2 py-0.5 rounded border border-orange-300 font-semibold flex items-center gap-1 shadow-2xs">
                                  <span>🚚 สำนวนเบิกฟ้อง</span>
                                  {(caseItem.requisitionDate || caseItem.appointmentDate) && (
                                    <span>: {formatThaiDate(caseItem.requisitionDate || caseItem.appointmentDate)}</span>
                                  )}
                                </span>
                              )}
                              <span className="text-slate-500">📍 {caseItem.court}</span>
                            </div>
                            <div className="text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>โจทก์: {caseItem.plaintiff}</span>
                              <div
                                className="inline-flex items-center gap-1 bg-white/95 border border-amber-300 text-slate-950 px-2.5 py-0.5 rounded-lg shadow-2xs font-['Prompt']"
                                title={`จำเลย: ${caseItem.defendant || '-'}`}
                              >
                                <span className="text-amber-800 font-extrabold text-[11px] shrink-0">👤 จำเลย:</span>
                                <span className="text-slate-950 font-bold text-xs tracking-wide">
                                  {caseItem.defendant || '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Copy Case Details & Judgment */}
                            <CopyCaseDropdown
                              caseItem={caseItem}
                              variant="compact"
                              onOpenFileLabel={onOpenFileLabel}
                              onOpenCourtPetition={onOpenCourtPetition}
                              onToast={onToast}
                            />

                            {canEdit && (
                              <>
                                {onRecordJudgment && (
                                  <button
                                    type="button"
                                    onClick={() => onRecordJudgment(caseItem)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 ${
                                      hasJudgmentRecorded
                                        ? 'text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300'
                                        : 'text-white bg-amber-600 hover:bg-amber-700'
                                    }`}
                                    title={
                                      hasJudgmentRecorded && caseItem.judgmentDate
                                        ? `คำพิพากษาเมื่อ ${formatThaiDate(caseItem.judgmentDate)} - คลิกเพื่อแก้ไขคำพิพากษา`
                                        : 'ศาลตัดสินแล้ว กรอกคำพิพากษาเพื่อเริ่มคุมอุทธรณ์ 1 เดือน'
                                    }
                                  >
                                    {hasJudgmentRecorded ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>แก้คำพิพากษา (กรอกแล้ว)</span>
                                      </>
                                    ) : (
                                      <>
                                        <Scale className="w-3.5 h-3.5" />
                                        <span>+ กรอกคำพิพากษา</span>
                                      </>
                                    )}
                                  </button>
                                )}

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
                                    className="px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition font-medium border border-indigo-200 cursor-pointer flex items-center gap-1"
                                    title="กรอกหรือแก้ไขข้อมูลคดีนี้"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>กรอก/แก้ไข</span>
                                  </button>
                                )}
                                {onMarkComplete && (
                                  <button
                                    type="button"
                                    onClick={() => onMarkComplete(caseItem)}
                                    className={`px-2 py-1 text-xs rounded-lg transition font-bold border cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 ${
                                      caseItem.isCompleted
                                        ? 'text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300'
                                        : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300'
                                    }`}
                                    title={
                                      caseItem.isCompleted
                                        ? `แก้ไขวันที่เสร็จสิ้น (ปัจจุบัน: ${caseItem.completedDate ? formatThaiDate(caseItem.completedDate) : 'เสร็จสิ้น'})`
                                        : 'กรอกวันที่เสร็จสิ้นสำนวน'
                                    }
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>
                                      {caseItem.isCompleted
                                        ? (caseItem.completedDate ? `แก้วันเสร็จ (${formatThaiDate(caseItem.completedDate, { short: true })})` : 'แก้วันเสร็จสิ้น')
                                        : '+ กรอกวันเสร็จสิ้น'}
                                    </span>
                                  </button>
                                )}
                                {onDeleteCase && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteCase(caseItem.id)}
                                    className="px-2 py-1 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition font-medium border border-rose-200 cursor-pointer flex items-center gap-1"
                                    title={`ลบสำนวนคดีดำ ${caseItem.blackCaseNo} ที่ยื่นฟ้องในวันนี้`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>ลบ</span>
                                  </button>
                                )}
                              </>
                            )}
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
                // Do not overwrite responsiblePerson (อัยการเจ้าของสำนวน) with duty officer
                responsiblePerson: caseForDutyPicker.responsiblePerson || '',
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
