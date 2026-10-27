import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Palette,
  BarChart3,
  Eye,
  Image as ImageIcon,
  Send
} from 'lucide-react';
import { AppealCase, MonthlyDutyRoster, SheetConfig } from '../types/appeal';
import {
  formatThaiDate,
  getAppealUrgency,
  getDaysRemaining,
  getTodayString,
  isKunchartCase,
  isKunchartCompletedPendingNoAppealAlert,
  getSeveredFilingAlertInfo
} from '../utils/dateUtils';
import { CopyCaseDropdown } from './CopyCaseDropdown';
import {
  getAppointmentLabel,
  getAppointmentBadgeStyle,
  isCaseConfessed,
  isCaseDenied,
  hasContinuousAppointment,
  isJudgmentRecorded,
  shouldAlertMissingJudgment,
  isCaseRequisition,
  isPendingRequisitionCase,
  getRequisitionAlertInfo,
  isCaseUnspecifiedStage,
  isCaseTemporarilyDischarged,
} from '../utils/appointmentUtils';
import { useVoiceSearch, VoiceSearchResult } from '../hooks/useVoiceSearch';
import { DutyOfficerPickerModal } from './DutyOfficerPickerModal';
import { getDutyOfficersForDate } from '../services/dutyService';
import { DailyCasesToSheetsModal } from './DailyCasesToSheetsModal';
import { formatCasesBatchForOfficeTsv, copyTextToClipboard } from '../utils/copyCaseUtils';
import { createDailyDutySummaryDoc } from '../services/docsService';
import { getAccessToken } from '../services/auth';

export type DailyProcedureFilter = 
  | 'all' 
  | 'unspecified' 
  | 'confessed' 
  | 'denied_scheduled' 
  | 'other_scheduled' 
  | 'temporarily_discharged'
  | 'unknown_pending';

export type DailyCompletionFilter = 'all' | 'incomplete' | 'completed';

export function getCaseProcedureCategory(c: AppealCase): 'unspecified' | 'confessed' | 'denied_scheduled' | 'other_scheduled' | 'temporarily_discharged' | 'unknown_pending' {
  // -1. จำหน่ายคดีชั่วคราวเนื่องจากจำเลยหลบหนี (ไม่ต้องคุมสำนวนอุทธรณ์)
  if (isCaseTemporarilyDischarged(c)) {
    return 'temporarily_discharged';
  }

  // 0. ยังไม่เลือกสถานะสำนวน (คุมสำนวนที่จะฟ้องในวันไว้ก่อน มีแถบสีแดงเตือน)
  if (isCaseUnspecifiedStage(c)) {
    return 'unspecified';
  }

  // 1. รับสารภาพ: ให้ความสำคัญสูงสุดกับคำให้การจำเลยที่ระบุโดยตรง หรือมีคำพิพากษาแล้ว
  if (c.defendantPlea === 'confessed' || isCaseConfessed(c)) {
    return 'confessed';
  }

  // 2. ปฏิเสธมีนัดต่อ: จำเลยระบุปฏิเสธ หรือมีนัดคุ้มครองสิทธิ/สืบพยาน
  if (c.defendantPlea === 'denied' || isCaseDenied(c) || c.appointmentType === 'rights_protection' || c.appointmentType === 'witness_examination' || c.appointmentType === 'pre_trial') {
    return 'denied_scheduled';
  }

  // 3. สำนวนเบิกฟ้อง: ยังไม่ทราบว่ารับสารภาพหรือปฏิเสธ
  if (c.isRequisitionCase || c.appointmentType === 'requisition') {
    return 'other_scheduled';
  }

  // 4. มีนัดอื่นๆ: เช่น นัดพร้อม, นัดไกล่เกลี่ย, นัดฟังคำสั่ง (ที่ยังไม่ทราบคำให้การ)
  if (c.appointmentType && c.appointmentType !== 'none') {
    return 'other_scheduled';
  }

  // 5. ยังไม่ทราบผล / รอรายงานผล
  return 'unknown_pending';
}

export function getProcedureFilterLabel(filter: DailyProcedureFilter): string {
  switch (filter) {
    case 'unspecified': return '🚨 ยังไม่เลือกสถานะสำนวน (เตือนแถบสีแดง)';
    case 'confessed': return '🟡 จำเลยรับสารภาพ (สีเหลือง)';
    case 'denied_scheduled': return '🟠 จำเลยปฏิเสธ - มีนัดต่อ (สีส้ม)';
    case 'other_scheduled': return 'สำนวนมีนัดอื่นๆ / เบิกฟ้อง';
    case 'temporarily_discharged': return '⏸️ จำหน่ายคดีชั่วคราว - จำเลยหลบหนี (ไม่ต้องคุมอุทธรณ์)';
    case 'unknown_pending': return 'ยังไม่ทราบผล / รอความคืบหน้า';
    default: return 'ทั้งหมด';
  }
}

/**
 * กำหนดสไตล์และสีพื้นหลังของการ์ดสำนวนตามคำขอ:
 * - สำนวนยังไม่เลือกสถานะ -> แถบสีแดงเตือน (Rose / Red) ชัดเจนมาก
 * - สำนวนรับสารภาพ -> สีเหลือง (Yellow / Amber) ชัดเจน โดดเด่น
 * - สำนวนปฏิเสธ -> สีส้ม (Orange) ชัดเจน โดดเด่น
 * - สำนวนมีเบิกฟ้อง -> สีเขียว (Emerald / Green) ชัดเจน โดดเด่น
 * - สำนวนมีนัดอื่นๆ -> สีฟ้า (Sky / Blue) ชัดเจน
 */
export function getCaseCardStyle(caseItem: AppealCase): {
  cardClass: string;
  badgeText: string;
  badgeClass: string;
  categoryLabel: string;
  colorName: 'rose' | 'yellow' | 'orange' | 'emerald' | 'sky' | 'slate' | 'amber';
} {
  const isCompleted = caseItem.isCompleted;
  const procCat = getCaseProcedureCategory(caseItem);

  if (isCompleted) {
    return {
      cardClass: 'bg-slate-100/90 border-slate-300 border-l-4 border-l-slate-400 opacity-80',
      badgeText: 'เสร็จสิ้นแล้ว',
      badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
      categoryLabel: 'เสร็จสิ้นสำนวน',
      colorName: 'slate',
    };
  }

  // -1. สำนวนจำหน่ายคดีชั่วคราว (จำเลยหลบหนี) -> แถบสีเทาเข้ม/Slate ชัดเจน
  if (isCaseTemporarilyDischarged(caseItem) || procCat === 'temporarily_discharged') {
    return {
      cardClass: 'bg-slate-200/90 border-slate-400 border-l-4 border-l-slate-600 shadow-xs hover:bg-slate-200 text-slate-900',
      badgeText: '⏸️ จำหน่ายคดีชั่วคราว (จำเลยหลบหนี)',
      badgeClass: 'bg-slate-300 text-slate-950 border-slate-500 font-bold',
      categoryLabel: 'จำหน่ายคดีชั่วคราว',
      colorName: 'slate',
    };
  }

  // 0. ยังไม่เลือกสถานะสำนวน -> แถบสีแดงเตือน (Red / Rose) เด่นชัดมากตามคำขอ
  if (procCat === 'unspecified' || isCaseUnspecifiedStage(caseItem)) {
    return {
      cardClass: 'bg-rose-100/90 border-rose-400 border-l-4 border-l-rose-600 ring-2 ring-rose-400/30 shadow-xs hover:bg-rose-100 text-slate-900',
      badgeText: '🚨 ยังไม่เลือกสถานะสำนวน',
      badgeClass: 'bg-rose-200 text-rose-950 border-rose-400 font-bold',
      categoryLabel: 'ยังไม่เลือกสถานะสำนวน',
      colorName: 'rose',
    };
  }

  // 1. สำนวนรับสารภาพ -> สีเหลือง (Yellow / Amber) เด่นชัด ชัดเจน
  if (procCat === 'confessed' || caseItem.defendantPlea === 'confessed' || isCaseConfessed(caseItem)) {
    return {
      cardClass: 'bg-yellow-100/90 border-yellow-400 border-l-4 border-l-yellow-500 shadow-xs hover:bg-yellow-100 text-slate-900',
      badgeText: '🟡 จำเลยรับสารภาพ',
      badgeClass: 'bg-yellow-200 text-yellow-950 border-yellow-400 font-bold',
      categoryLabel: 'จำเลยรับสารภาพ',
      colorName: 'yellow',
    };
  }

  // 2. สำนวนปฏิเสธ -> สีส้ม (Orange) เด่นชัด ชัดเจน
  if (procCat === 'denied_scheduled' || caseItem.defendantPlea === 'denied' || isCaseDenied(caseItem)) {
    return {
      cardClass: 'bg-orange-100/90 border-orange-400 border-l-4 border-l-orange-500 shadow-xs hover:bg-orange-100 text-slate-900',
      badgeText: '🟠 จำเลยปฏิเสธ (มีนัดต่อ)',
      badgeClass: 'bg-orange-200 text-orange-950 border-orange-400 font-bold',
      categoryLabel: 'จำเลยปฏิเสธ',
      colorName: 'orange',
    };
  }

  // 3. สำนวนมีเบิกฟ้อง -> สีเขียว (Green / Emerald) เด่นชัด ชัดเจน
  const isReq = Boolean(caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition');
  if (isReq) {
    return {
      cardClass: 'bg-emerald-100/90 border-emerald-400 border-l-4 border-l-emerald-600 shadow-xs hover:bg-emerald-100 text-slate-900',
      badgeText: '🟢 สำนวนมีเบิกฟ้อง',
      badgeClass: 'bg-emerald-200 text-emerald-950 border-emerald-400 font-bold',
      categoryLabel: 'สำนวนมีเบิกฟ้อง',
      colorName: 'emerald',
    };
  }

  // other_scheduled หรือ unknown_pending (นัดอื่นๆ ที่ยังไม่ทราบคำให้การ) -> สีฟ้า (Sky / Blue)
  return {
    cardClass: 'bg-sky-100/85 border-sky-400 border-l-4 border-l-sky-500 shadow-xs hover:bg-sky-100 text-slate-900',
    badgeText: '🔵 มีนัดอื่นๆ (ยังไม่ทราบคำให้การ)',
    badgeClass: 'bg-sky-200 text-sky-950 border-sky-400 font-bold',
    categoryLabel: 'มีนัดอื่นๆ',
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
    Boolean(c.requisitionNotes && c.requisitionNotes.toLowerCase().includes(q)) ||
    Boolean(c.arrestWarrantNo && (c.arrestWarrantNo.toLowerCase().includes(q) || c.arrestWarrantNo.toLowerCase().includes(term))) ||
    Boolean(c.temporaryDischargeReason && (c.temporaryDischargeReason.toLowerCase().includes(q) || c.temporaryDischargeReason.toLowerCase().includes(term))) ||
    Boolean(c.temporaryDischargeNotes && (c.temporaryDischargeNotes.toLowerCase().includes(q) || c.temporaryDischargeNotes.toLowerCase().includes(term)))
  );
}

interface DailyFilingByDateViewProps {
  cases: AppealCase[];
  dutyRosters?: MonthlyDutyRoster[];
  initialSelectedDate?: string;
  externalDateSearch?: string;
  canEdit?: boolean;
  canComplete?: boolean;
  token?: string | null;
  sheetConfig?: SheetConfig | null;
  onMarkComplete: (caseItem: AppealCase) => void;
  onConfirmNoAppeal?: (caseId: string) => void;
  onReopenCase?: (caseId: string) => void;
  onExtendDeadline: (caseItem: AppealCase) => void;
  onEditCase?: (caseItem: AppealCase) => void;
  onRecordJudgment?: (caseItem: AppealCase) => void;
  onOpenJudgmentRecheck?: (caseItem: AppealCase) => void;
  onOpenJudgmentDoc?: (caseItem: AppealCase) => void;
  onExportDailyDoc?: (filingDate: string, cases: AppealCase[]) => void;
  onOpenAppointmentModal?: (caseItem: AppealCase) => void;
  onAddNewCaseForDate?: (dateStr: string) => void;
  onQuickAssignOfficer?: (caseId: string, officerName: string) => void;
  onBatchAssignOfficerToDate?: (filingDate: string, officerName: string) => void;
  onOpenFileLabel?: (caseItem: AppealCase) => void;
  onOpenCourtPetition?: (caseItem: AppealCase) => void;
  onDeleteCase?: (caseId: string) => void;
  onQuickChangeRequisitionStatus?: (caseItem: AppealCase, newStatus: 'confessed' | 'denied') => void;
  onQuickChangePleaStatus?: (caseItem: AppealCase, newPlea: 'confessed' | 'denied' | 'pending' | 'requisition' | 'unspecified') => void;
  onOpenMonthlyProsecutorSummary?: (yearMonth?: string) => void;
  onToast?: (message: string) => void;
  onOpenSubmitToDuty?: (caseItem: AppealCase) => void;
  onMarkSeveredCompleted?: (caseItem: AppealCase, newBlackNo?: string) => void;
  onCreateSeveredCase?: (parentCase: AppealCase) => void;
  onToggleTemporaryDischarge?: (caseItem: AppealCase, isDischarged: boolean, recapturedDate?: string) => void;
}

export const DailyFilingByDateView: React.FC<DailyFilingByDateViewProps> = ({
  cases,
  dutyRosters = [],
  initialSelectedDate,
  externalDateSearch = '',
  canEdit = true,
  canComplete = canEdit,
  token,
  sheetConfig,
  onMarkComplete,
  onConfirmNoAppeal,
  onReopenCase,
  onExtendDeadline,
  onEditCase,
  onRecordJudgment,
  onOpenJudgmentRecheck,
  onOpenJudgmentDoc,
  onExportDailyDoc,
  onOpenAppointmentModal,
  onAddNewCaseForDate,
  onQuickAssignOfficer,
  onBatchAssignOfficerToDate,
  onOpenFileLabel,
  onOpenCourtPetition,
  onDeleteCase,
  onQuickChangeRequisitionStatus,
  onQuickChangePleaStatus,
  onOpenMonthlyProsecutorSummary,
  onToast,
  onOpenSubmitToDuty,
  onMarkSeveredCompleted,
  onCreateSeveredCase,
  onToggleTemporaryDischarge,
}) => {
  // วันที่เลือกเริ่มต้น
  const todayStr = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(initialSelectedDate || todayStr);
  const [viewMode, setViewMode] = useState<'single_date' | 'all_dates'>('single_date');
  const [completionFilter, setCompletionFilter] = useState<DailyCompletionFilter>('all');
  const [procedureFilter, setProcedureFilter] = useState<DailyProcedureFilter>('all');
  const [dateSearch, setDateSearch] = useState<string>(externalDateSearch);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Convenience boolean for backward-compatible active/incomplete checks
  const filterOnlyActive = completionFilter === 'incomplete';

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

  // Voice Search setup for in-page search
  const handleVoiceResult = (result: VoiceSearchResult) => {
    setDateSearch(result.rawTranscript);
  };
  const { isListening, transcript, startListening, stopListening } = useVoiceSearch(handleVoiceResult);

  // Top quick search & filter state ("ปุ่มค้นหาตรงด้านบนของหน้านี้ เพื่อความสะดวกในการค้นหาแล้วกรอกข้อมูล")
  const topSearchInputRef = useRef<HTMLInputElement>(null);
  const [topSearchQuery, setTopSearchQuery] = useState<string>('');
  const [topFilterStatus, setTopFilterStatus] = useState<
    'all' | 'unrecorded' | 'recorded' | 'confessed' | 'denied' | 'requisition' | 'temporarily_discharged'
  >('all');
  const [isSearchPanelExplicitlyOpen, setIsSearchPanelExplicitlyOpen] = useState<boolean>(false);

  const isGlobalSearchActive = Boolean(topSearchQuery.trim() || topFilterStatus !== 'all' || isSearchPanelExplicitlyOpen);

  const globalFilteredCases = useMemo(() => {
    if (!isGlobalSearchActive) return [];
    return cases.filter((c) => {
      // 1. Text Search across key fields
      if (topSearchQuery.trim() && !caseMatchesDailySearch(c, topSearchQuery)) {
        return false;
      }
      // 2. Status filter
      // สำหรับ unrecorded: แจ้งเตือนเฉพาะสำนวนที่รับสารภาพเท่านั้น สำนวนที่ปฏิเสธจะไม่แจ้งเตือน/ไม่นำมาแสดง
      if (topFilterStatus === 'unrecorded' && !shouldAlertMissingJudgment(c)) return false;
      if (topFilterStatus === 'recorded' && !isJudgmentRecorded(c)) return false;
      if (topFilterStatus === 'confessed' && !isCaseConfessed(c)) return false;
      if (topFilterStatus === 'denied' && !isCaseDenied(c)) return false;
      if (topFilterStatus === 'requisition' && !isCaseRequisition(c)) return false;
      if (topFilterStatus === 'temporarily_discharged' && !isCaseTemporarilyDischarged(c)) return false;
      return true;
    });
  }, [cases, topSearchQuery, topFilterStatus, isGlobalSearchActive]);

  const allCasesStats = useMemo(() => {
    // แจ้งเตือนเฉพาะสำนวนที่รับสารภาพเท่านั้นที่ยังไม่กรอกคำพิพากษา (สำนวนที่ปฏิเสธไม่ต้องเตือน)
    const unrecorded = cases.filter((c) => shouldAlertMissingJudgment(c)).length;
    const recorded = cases.filter((c) => isJudgmentRecorded(c)).length;
    const confessed = cases.filter((c) => isCaseConfessed(c)).length;
    const denied = cases.filter((c) => isCaseDenied(c)).length;
    const requisition = cases.filter((c) => isCaseRequisition(c)).length;
    const temporarilyDischarged = cases.filter((c) => isCaseTemporarilyDischarged(c)).length;
    return {
      total: cases.length,
      unrecorded,
      recorded,
      confessed,
      denied,
      requisition,
      temporarilyDischarged,
    };
  }, [cases]);

  /**
   * ดำเนินการค้นหาสำนวนคดีทันที:
   * - หากพบสำนวนเดียว หรือตรงกับเลขคดีดำ/คดีแดงแบบเจาะจง ให้เปิดหน้าต่างแก้ไขข้อมูลสำนวนนั้นทันที
   * - หากพบหลายสำนวน ให้เปิดแถบผลการค้นหาเพื่อให้ผู้ใช้คลิกสำนวนที่ต้องการแก้ไขได้ทันที
   */
  const handleExecuteTopSearch = (forcedQuery?: string) => {
    const query = (forcedQuery !== undefined ? forcedQuery : topSearchQuery).trim();
    setIsSearchPanelExplicitlyOpen(true);

    if (!query) {
      if (onToast) {
        onToast(`แสดงสำนวนทั้งหมด (${globalFilteredCases.length} สำนวน) — คลิกที่สำนวนเพื่อแก้ไขได้ทันที`);
      }
      return;
    }

    // ค้นหาสำนวนที่ตรงในระบบ
    const matched = cases.filter((c) => caseMatchesDailySearch(c, query));

    // กรณีพบเพียง 1 สำนวนพอดี -> เปิดหน้าจอแก้ไขสำนวนทันที!
    if (matched.length === 1 && onEditCase) {
      onEditCase(matched[0]);
      if (onToast) {
        onToast(`พบ 1 สำนวน (คดีดำ ${matched[0].blackCaseNo}) — เปิดเข้าแก้ไขข้อมูลสำนวนทันที`);
      }
      return;
    }

    // กรณีพบมากกว่า 1 สำนวน แต่มีสำนวนที่เลขคดีดำหรือคดีแดงตรงกับที่พิมพ์เป๊ะๆ -> เปิดแก้ไขทันที
    if (matched.length > 1 && onEditCase) {
      const cleanQ = query.replace(/^(อ\.|คดีดำ|ดำ|แดง|คดีแดง)/gi, '').trim().toLowerCase();
      const exactMatch = matched.find((c) => {
        const cleanBlack = c.blackCaseNo.replace(/^(อ\.|ดำ)/gi, '').trim().toLowerCase();
        const cleanRed = (c.redCaseNo || '').replace(/^(อ\.|แดง)/gi, '').trim().toLowerCase();
        return (
          cleanBlack === cleanQ ||
          cleanRed === cleanQ ||
          c.blackCaseNo.toLowerCase() === query.toLowerCase() ||
          (c.redCaseNo && c.redCaseNo.toLowerCase() === query.toLowerCase())
        );
      });

      if (exactMatch) {
        onEditCase(exactMatch);
        if (onToast) {
          onToast(`พบสำนวนคดีดำ ${exactMatch.blackCaseNo} ตรงเป๊ะ — เปิดเข้าแก้ไขข้อมูลทันที`);
        }
        return;
      }
    }

    if (matched.length > 0) {
      if (onToast) {
        onToast(`พบ ${matched.length} สำนวนที่ตรงกับ "${query}" — คลิกเลือกสำนวนเพื่อแก้ไขได้ทันที`);
      }
    } else {
      if (onToast) {
        onToast(`ไม่พบสำนวนที่ตรงกับ "${query}" ในระบบ`);
      }
    }
  };

  const handleTopVoiceResult = (result: VoiceSearchResult) => {
    setTopSearchQuery(result.rawTranscript);
    handleExecuteTopSearch(result.rawTranscript);
  };
  const {
    isListening: isTopListening,
    transcript: topTranscript,
    startListening: startTopListening,
    stopListening: stopTopListening,
  } = useVoiceSearch(handleTopVoiceResult);

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

  // Distinct filing dates filtered by search and completion status
  const filteredDistinctFilingDates = useMemo(() => {
    return distinctFilingDates.filter((dateKey) => {
      const casesInGroup = groupedByFilingDate[dateKey] || [];
      if (completionFilter === 'incomplete' && !casesInGroup.some((c) => !c.isCompleted)) {
        return false;
      }
      if (completionFilter === 'completed' && !casesInGroup.some((c) => c.isCompleted)) {
        return false;
      }
      if (!dateSearch.trim()) return true;
      const rawDate = dateKey.toLowerCase();
      const thaiDate = formatThaiDate(dateKey).toLowerCase();
      const q = dateSearch.toLowerCase().trim();
      if (rawDate.includes(q) || thaiDate.includes(q)) return true;
      return casesInGroup.some((c) => caseMatchesDailySearch(c, dateSearch));
    });
  }, [distinctFilingDates, groupedByFilingDate, dateSearch, completionFilter]);

  // Count unassigned cases on selected date
  const unassignedCasesOnSelectedDate = useMemo(() => {
    const list = groupedByFilingDate[selectedDate] || [];
    return list.filter((c) => !c.prosecutorName && !c.responsiblePerson);
  }, [groupedByFilingDate, selectedDate]);

  // Cases filed on the currently selected date (filtered by search, completion, and procedureFilter)
  const casesOnSelectedDate = useMemo(() => {
    return (groupedByFilingDate[selectedDate] || []).filter((c) => {
      if (completionFilter === 'incomplete' && c.isCompleted) return false;
      if (completionFilter === 'completed' && !c.isCompleted) return false;
      if (procedureFilter !== 'all') {
        const cat = getCaseProcedureCategory(c);
        if (cat !== procedureFilter) return false;
      }
      if (dateSearch.trim()) {
        return caseMatchesDailySearch(c, dateSearch);
      }
      return true;
    });
  }, [groupedByFilingDate, selectedDate, completionFilter, procedureFilter, dateSearch]);

  // Cases matching search on OTHER filing dates (ช่วยแสดงผลกรณีค้นหาเลขคดีหรือวันที่ที่ไม่ได้อยู่ใน selectedDate ปัจจุบัน)
  const casesMatchingOtherDates = useMemo(() => {
    if (!dateSearch.trim()) return [];
    return cases.filter((c) => {
      const dateKey = c.filingDate || 'ไม่ระบุวันที่ฟ้อง';
      if (dateKey === selectedDate) return false;
      if (completionFilter === 'incomplete' && c.isCompleted) return false;
      if (completionFilter === 'completed' && !c.isCompleted) return false;
      return caseMatchesDailySearch(c, dateSearch);
    });
  }, [cases, selectedDate, dateSearch, completionFilter]);

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

  // Statistics for selected date (สถิติฟ้องรายวัน: ยังไม่เลือกสถานะ / รับสารภาพ / ปฏิเสธมีนัด / มีนัดอื่นๆ / ยังไม่ทราบผล / ยังไม่เสร็จสิ้น)
  const statsForSelectedDate = useMemo(() => {
    const list = groupedByFilingDate[selectedDate] || [];
    const total = list.length;
    const completed = list.filter((c) => c.isCompleted).length;
    const incomplete = list.filter((c) => !c.isCompleted).length;

    const unspecified = list.filter((c) => getCaseProcedureCategory(c) === 'unspecified').length;
    const confessed = list.filter((c) => getCaseProcedureCategory(c) === 'confessed').length;
    const deniedScheduled = list.filter((c) => getCaseProcedureCategory(c) === 'denied_scheduled').length;
    const otherScheduled = list.filter((c) => getCaseProcedureCategory(c) === 'other_scheduled').length;
    const unknownPending = list.filter((c) => getCaseProcedureCategory(c) === 'unknown_pending').length;

    const unspecifiedIncomplete = list.filter((c) => getCaseProcedureCategory(c) === 'unspecified' && !c.isCompleted).length;
    const confessedIncomplete = list.filter((c) => getCaseProcedureCategory(c) === 'confessed' && !c.isCompleted).length;
    const deniedScheduledIncomplete = list.filter((c) => getCaseProcedureCategory(c) === 'denied_scheduled' && !c.isCompleted).length;
    const otherScheduledIncomplete = list.filter((c) => getCaseProcedureCategory(c) === 'other_scheduled' && !c.isCompleted).length;
    const unknownPendingIncomplete = list.filter((c) => getCaseProcedureCategory(c) === 'unknown_pending' && !c.isCompleted).length;

    const temporarilyDischarged = list.filter((c) => isCaseTemporarilyDischarged(c)).length;
    const temporarilyDischargedIncomplete = list.filter((c) => isCaseTemporarilyDischarged(c) && !c.isCompleted).length;

    const criminal = list.filter((c) => c.caseType.includes('อาญา')).length;
    const civil = list.filter((c) => !c.caseType.includes('อาญา')).length;
    const withJudgment = list.filter((c) => isJudgmentRecorded(c)).length;
    const pendingTrial = list.filter((c) => !isJudgmentRecorded(c)).length;
    const urgent = list.filter((c) => {
      if (c.isCompleted) return false;
      const u = getAppealUrgency(c);
      return u === 'critical' || u === 'overdue' || u === 'warning';
    }).length;

    return {
      total,
      completed,
      incomplete,
      unspecified,
      confessed,
      deniedScheduled,
      otherScheduled,
      unknownPending,
      temporarilyDischarged,
      temporarilyDischargedIncomplete,
      unspecifiedIncomplete,
      confessedIncomplete,
      deniedScheduledIncomplete,
      otherScheduledIncomplete,
      unknownPendingIncomplete,
      criminal,
      civil,
      withJudgment,
      pendingTrial,
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
      {/* ========================================================================= */}
      {/* 1. TOP QUICK SEARCH BAR ("ช่วยเพิ่มปุ่มค้นหาตรงด้านบนของหน้านี้ เพื่อความสะดวกในการค้นหาแล้วกรอกข้อมูล") */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-900/50 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
        {/* Glow backdrop flair */}
        <div className="absolute right-0 top-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/25 shrink-0">
                <Search className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-white font-['Prompt']">
                    ค้นหาสำนวนเพื่อกรอกข้อมูล / บันทึกคำพิพากษา
                  </h3>
                  <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full shadow-2xs">
                    ค้นหาแล้วกรอกได้ทันที
                  </span>
                </div>
                <p className="text-xs text-indigo-200/80 mt-0.5">
                  ค้นหาด้วยเลขคดีดำ (เช่น อ.1858, 2570), เลขแดง, เลข ส.1, ส.4, จำเลย หรืออัยการ เพื่อเปิดบันทึกคำพิพากษาหรือแก้ไขข้อมูลได้ทันที
                </p>
              </div>
            </div>

            {/* Quick Summary Badges */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const next = topFilterStatus === 'unrecorded' ? 'all' : 'unrecorded';
                  setTopFilterStatus(next);
                  setIsSearchPanelExplicitlyOpen(next !== 'all');
                }}
                className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  topFilterStatus === 'unrecorded'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-2 ring-amber-300'
                    : 'bg-white/10 hover:bg-white/20 text-amber-300 border-amber-400/30'
                }`}
                title="คลิกเพื่อกรองเฉพาะสำนวนที่จำเลยรับสารภาพแต่ยังไม่ได้กรอกคำพิพากษา (สำนวนที่ปฏิเสธจะไม่แจ้งเตือน)"
              >
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                <span>รับสารภาพ (ยังไม่กรอกคำพิพากษา {allCasesStats.unrecorded})</span>
              </button>

              {canEdit && onAddNewCaseForDate && (
                <button
                  type="button"
                  onClick={() => onAddNewCaseForDate(selectedDate)}
                  className="text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ กรอกคดีใหม่</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Input Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={topSearchInputRef}
                type="text"
                value={isTopListening ? topTranscript : topSearchQuery}
                onChange={(e) => {
                  setTopSearchQuery(e.target.value);
                  if (e.target.value.trim()) {
                    setIsSearchPanelExplicitlyOpen(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExecuteTopSearch();
                  }
                }}
                placeholder="🔍 พิมพ์เลขคดีดำ (เช่น 2570, อ.1858), คดีแดง, เลข ส.1, ส.4, จำเลย, หรืออัยการเจ้าของสำนวน..."
                className={`w-full text-xs sm:text-sm pl-10 pr-20 py-2.5 rounded-xl border transition focus:outline-none ${
                  isTopListening
                    ? 'border-rose-400 bg-rose-50/20 text-rose-100 ring-2 ring-rose-400'
                    : 'border-white/20 bg-white/10 text-white placeholder-slate-400 focus:bg-white/15 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
                }`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {topSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setTopSearchQuery('');
                      setIsSearchPanelExplicitlyOpen(false);
                      topSearchInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                    title="ล้างคำค้นหา"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={isTopListening ? stopTopListening : startTopListening}
                  className={`p-1.5 rounded-lg border transition ${
                    isTopListening
                      ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300 border-white/20'
                  }`}
                  title="ค้นหาด้วยเสียง"
                >
                  {isTopListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* ค้นหา Button ("ช่วยเพิ่มปุ่มค้นหน้าตรงด้านบนของหน้านี้ เพื่อความสะดวกในการค้นหาแล้วกรอกข้อมูล") */}
            <button
              type="button"
              onClick={() => {
                handleExecuteTopSearch();
                topSearchInputRef.current?.focus();
              }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition shadow-md cursor-pointer shrink-0 active:scale-95"
              title="ค้นหาสำนวนเพื่อคลิกเปิดแก้ไขข้อมูลหรือกรอกคำพิพากษาได้ทันที"
            >
              <Search className="w-4 h-4 stroke-[2.5]" />
              <span>ค้นหาสำนวน</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
            <span className="text-slate-400 text-[11px] font-medium mr-1">กรองด่วน:</span>
            <button
              type="button"
              onClick={() => {
                setTopFilterStatus('all');
                setTopSearchQuery('');
                setIsSearchPanelExplicitlyOpen(false);
              }}
              className={`px-2.5 py-1 rounded-lg border transition text-[11px] cursor-pointer ${
                topFilterStatus === 'all' && !topSearchQuery.trim()
                  ? 'bg-white/20 text-white border-white/30 font-semibold'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              ทั้งหมด ({allCasesStats.total})
            </button>
            <button
              type="button"
              onClick={() => {
                const next = topFilterStatus === 'unrecorded' ? 'all' : 'unrecorded';
                setTopFilterStatus(next);
                setIsSearchPanelExplicitlyOpen(next !== 'all');
              }}
              className={`px-2.5 py-1 rounded-lg border transition text-[11px] flex items-center gap-1 cursor-pointer ${
                topFilterStatus === 'unrecorded'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-xs'
                  : 'bg-amber-500/15 text-amber-300 border-amber-400/30 hover:bg-amber-500/25'
              }`}
            >
              <span>⚖️ รับสารภาพ (ยังไม่กรอกคำพิพากษา {allCasesStats.unrecorded})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = topFilterStatus === 'recorded' ? 'all' : 'recorded';
                setTopFilterStatus(next);
                setIsSearchPanelExplicitlyOpen(next !== 'all');
              }}
              className={`px-2.5 py-1 rounded-lg border transition text-[11px] flex items-center gap-1 cursor-pointer ${
                topFilterStatus === 'recorded'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/25'
              }`}
            >
              <span>✅ กรอกคำพิพากษาแล้ว ({allCasesStats.recorded})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = topFilterStatus === 'confessed' ? 'all' : 'confessed';
                setTopFilterStatus(next);
                setIsSearchPanelExplicitlyOpen(next !== 'all');
              }}
              className={`px-2.5 py-1 rounded-lg border transition text-[11px] flex items-center gap-1 cursor-pointer ${
                topFilterStatus === 'confessed'
                  ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-bold'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <span>🟢 จำเลยรับสารภาพ ({allCasesStats.confessed})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = topFilterStatus === 'denied' ? 'all' : 'denied';
                setTopFilterStatus(next);
                setIsSearchPanelExplicitlyOpen(next !== 'all');
              }}
              className={`px-2.5 py-1 rounded-lg border transition text-[11px] flex items-center gap-1 cursor-pointer ${
                topFilterStatus === 'denied'
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <span>🟠 จำเลยปฏิเสธ ({allCasesStats.denied})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = topFilterStatus === 'requisition' ? 'all' : 'requisition';
                setTopFilterStatus(next);
                setIsSearchPanelExplicitlyOpen(next !== 'all');
              }}
              className={`px-2.5 py-1 rounded-lg border transition text-[11px] flex items-center gap-1 cursor-pointer ${
                topFilterStatus === 'requisition'
                  ? 'bg-orange-400 text-slate-950 border-orange-300 font-bold'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <span>🚚 เบิกฟ้อง ({allCasesStats.requisition})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = topFilterStatus === 'temporarily_discharged' ? 'all' : 'temporarily_discharged';
                setTopFilterStatus(next);
                setIsSearchPanelExplicitlyOpen(next !== 'all');
              }}
              className={`px-2.5 py-1 rounded-lg border transition text-[11px] flex items-center gap-1 cursor-pointer ${
                topFilterStatus === 'temporarily_discharged'
                  ? 'bg-slate-300 text-slate-950 border-white font-bold'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <span>⏸️ จำหน่ายชั่วคราว ({allCasesStats.temporarilyDischarged})</span>
            </button>

            {isGlobalSearchActive && (
              <button
                type="button"
                onClick={() => {
                  setTopSearchQuery('');
                  setTopFilterStatus('all');
                  setIsSearchPanelExplicitlyOpen(false);
                }}
                className="text-[11px] text-rose-300 hover:text-rose-100 underline underline-offset-2 ml-auto cursor-pointer"
              >
                ✕ ปิดผลการค้นหา
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Search Results Panel */}
        {isGlobalSearchActive && (
          <div className="mt-4 pt-4 border-t border-white/15 animate-in fade-in duration-150 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-indigo-200 gap-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  ผลการค้นหา: พบ <strong className="text-amber-300 font-bold">{globalFilteredCases.length}</strong> สำนวนคดี
                  {topSearchQuery && ` (คำค้น: "${topSearchQuery}")`}
                </span>
              </div>
              <span className="text-[12px] text-amber-300 font-semibold bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-400/30">
                👉 คลิกที่แถวสำนวนคดี หรือกดปุ่ม &quot;✏️ แก้ไขสำนวนนี้&quot; เพื่อเปิดแก้ไขข้อมูลได้ทันที
              </span>
            </div>

            {globalFilteredCases.length === 0 ? (
              <div className="bg-white/5 rounded-xl p-5 text-center border border-white/10">
                <Search className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
                <p className="text-sm font-semibold text-white">ไม่พบสำนวนคดีที่ตรงกับคำค้นหา &quot;{topSearchQuery}&quot;</p>
                <p className="text-xs text-slate-300 mt-1">ลองพิมพ์เฉพาะตัวเลขคดี เช่น 2570, 1858 หรือล้างคำค้นหา</p>
                {canEdit && onAddNewCaseForDate && (
                  <button
                    type="button"
                    onClick={() => onAddNewCaseForDate(selectedDate)}
                    className="mt-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ กรอกข้อมูลคดีใหม่ในระบบ</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {globalFilteredCases.map((c) => {
                  const hasJudgment = isJudgmentRecorded(c);
                  const isDischarged = isCaseTemporarilyDischarged(c);
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        if (canEdit && onEditCase) {
                          onEditCase(c);
                        }
                      }}
                      className={`bg-white text-slate-900 rounded-xl p-3 sm:p-3.5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                        canEdit && onEditCase
                          ? 'cursor-pointer hover:border-amber-400 hover:shadow-md hover:bg-amber-50/25 group'
                          : ''
                      }`}
                      title={canEdit && onEditCase ? 'คลิกที่นี่เพื่อเปิดแก้ไขข้อมูลสำนวนคดีนี้ได้ทันที' : undefined}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-950 font-['Prompt'] text-sm group-hover:text-amber-700 transition flex items-center gap-1">
                            ดำ {c.blackCaseNo}
                          </span>
                          {c.redCaseNo ? (
                            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              แดง {c.redCaseNo}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              ยังไม่มีเลขแดง
                            </span>
                          )}

                          {/* Status Badge */}
                          {hasJudgment ? (
                            <span
                              className="text-xs font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1"
                              title={c.judgmentDate ? `กรอกคำพิพากษาแล้วเมื่อ ${formatThaiDate(c.judgmentDate)}` : 'กรอกคำพิพากษาแล้ว'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>⚖️ กรอกคำพิพากษาแล้ว</span>
                              {c.judgmentDate && (
                                <span className="text-[11px] text-emerald-800">({formatThaiDate(c.judgmentDate, { short: true })})</span>
                              )}
                            </span>
                          ) : isDischarged ? (
                            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 flex items-center gap-1">
                              <span>⏸️ จำหน่ายชั่วคราว (จำเลยหลบหนี)</span>
                            </span>
                          ) : shouldAlertMissingJudgment(c) ? (
                            <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1 shadow-2xs">
                              <Scale className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>รับสารภาพ (ยังไม่กรอกคำพิพากษา)</span>
                            </span>
                          ) : isCaseDenied(c) ? (
                            <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              🟠 จำเลยให้การปฏิเสธ (อยู่ระหว่างนัดพิจารณา)
                            </span>
                          ) : isCaseRequisition(c) ? (
                            <span className="text-xs font-semibold text-orange-800 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                              🚚 สำนวนเบิกฟ้อง
                            </span>
                          ) : null}

                          {c.receivedNumberS1 && (
                            <span className="text-xs font-medium text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              ส.1: {c.receivedNumberS1}
                            </span>
                          )}
                          {c.filingNumberS4 && (
                            <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              ส.4: {c.filingNumberS4}
                            </span>
                          )}

                          {canEdit && onEditCase && (
                            <span className="text-[11px] font-medium text-amber-700 bg-amber-100/70 group-hover:bg-amber-200 px-1.5 py-0.5 rounded transition hidden sm:inline-flex items-center gap-1">
                              <Edit3 className="w-3 h-3" />
                              <span>คลิกเพื่อแก้ไข</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            <strong>วันที่ฟ้อง:</strong> {formatThaiDate(c.filingDate)}
                          </span>
                          <span>
                            <strong>จำเลย:</strong> {c.defendant || '-'}
                          </span>
                          <span>
                            <strong>👔 อัยการเจ้าของสำนวน:</strong> {c.responsiblePerson || c.prosecutorName || '-'}
                          </span>
                        </div>

                        {hasJudgment && c.judgmentOutcome && (
                          <div className="text-xs text-emerald-950 bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-200">
                            <strong>ผลคำพิพากษา:</strong> {c.judgmentOutcome}
                          </div>
                        )}
                      </div>

                      {/* Action buttons on this matched case */}
                      <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
                        {canEdit && onEditCase && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditCase(c);
                            }}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                            title="เปิดหน้าต่างแก้ไขข้อมูลสำนวนคดีนี้ทันที"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>✏️ แก้ไขสำนวนนี้</span>
                          </button>
                        )}

                        {canEdit && onRecordJudgment && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRecordJudgment(c);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 ${
                              hasJudgment
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : shouldAlertMissingJudgment(c)
                                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-600 font-extrabold shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                            title={
                              hasJudgment
                                ? 'แก้ไขคำพิพากษา'
                                : shouldAlertMissingJudgment(c)
                                ? 'จำเลยรับสารภาพ กรอกคำพิพากษาคดีนี้'
                                : 'กรอกคำพิพากษา (เมื่อศาลมีคำตัดสิน)'
                            }
                          >
                            <Scale className={`w-3.5 h-3.5 ${hasJudgment ? 'text-emerald-700' : shouldAlertMissingJudgment(c) ? 'text-slate-950' : 'text-slate-500'}`} />
                            <span>{hasJudgment ? 'แก้คำพิพากษา' : shouldAlertMissingJudgment(c) ? '+ กรอกคำพิพากษา' : 'กรอกคำพิพากษา'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (c.filingDate) {
                              setSelectedDate(c.filingDate);
                              setViewMode('single_date');
                              setTopSearchQuery('');
                              setTopFilterStatus('all');
                              setIsSearchPanelExplicitlyOpen(false);
                              if (onToast) onToast(`สลับไปดูวันที่ยื่นฟ้อง ${formatThaiDate(c.filingDate)}`);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                          title="ไปที่วันที่ยื่นฟ้องของสำนวนนี้"
                        >
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>ดูในวันที่ฟ้อง</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

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

          {/* View Mode Toggle & Quick Search Button */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={() => {
                topSearchInputRef.current?.focus();
                topSearchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs cursor-pointer active:scale-95"
              title="คลิกเพื่อเลื่อนไปค้นหาสำนวนเพื่อกรอกข้อมูลด้านบน"
            >
              <Search className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>ค้นหาสำนวนเพื่อกรอกข้อมูล</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
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
              onClick={() => setCompletionFilter(completionFilter === 'incomplete' ? 'all' : 'incomplete')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
                completionFilter === 'incomplete'
                  ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-sm ring-2 ring-amber-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300'
              }`}
              title="คัดกรองเฉพาะสำนวนที่ยังไม่กดเสร็จสิ้นในแต่ละวัน"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>⏳ ยังไม่กดเสร็จสิ้น ({statsForSelectedDate.incomplete})</span>
            </button>
          </div>
        </div>

        {/* Existing Dates Chips */}
        {distinctFilingDates.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">วันที่มีสำนวนในระบบ:</span>
            {distinctFilingDates.slice(0, 8).map((d) => {
              const casesInDate = groupedByFilingDate[d] || [];
              const count = casesInDate.length;
              const incompleteCount = casesInDate.filter((c) => !c.isCompleted).length;
              const isSelected = selectedDate === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setSelectedDate(d);
                    if (viewMode === 'all_dates') setViewMode('single_date');
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
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
                  {incompleteCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5 ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 font-extrabold'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                      title={`วันที่ ${formatThaiDate(d, { short: true })} มีสำนวนที่ยังไม่กดเสร็จสิ้น ${incompleteCount} สำนวน`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>{incompleteCount}</span>
                    </span>
                  )}
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
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 self-start md:self-auto">
                <div className="flex items-center gap-4">
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

                {/* Sub-counts: ยังไม่กดเสร็จสิ้น vs เสร็จสิ้นแล้ว (คลิกเพื่อกรองได้ทันที) */}
                <div className="flex sm:flex-col gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-white/15 sm:pl-4 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setCompletionFilter(completionFilter === 'incomplete' ? 'all' : 'incomplete')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center justify-between gap-2 cursor-pointer ${
                      completionFilter === 'incomplete'
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-sm'
                        : 'bg-white/10 hover:bg-white/20 text-amber-300'
                    }`}
                    title="คลิกเพื่อคัดกรองเฉพาะสำนวนที่ยังไม่กดเสร็จสิ้นในวันนี้"
                  >
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>ยังไม่เสร็จ:</span>
                    </span>
                    <span className="font-extrabold font-mono text-sm">{statsForSelectedDate.incomplete}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCompletionFilter(completionFilter === 'completed' ? 'all' : 'completed')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center justify-between gap-2 cursor-pointer ${
                      completionFilter === 'completed'
                        ? 'bg-emerald-400 text-slate-950 ring-2 ring-emerald-300 shadow-sm'
                        : 'bg-white/10 hover:bg-white/20 text-emerald-300'
                    }`}
                    title="คลิกเพื่อคัดกรองเฉพาะสำนวนที่กดเสร็จสิ้นแล้ว"
                  >
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>เสร็จสิ้น:</span>
                    </span>
                    <span className="font-extrabold font-mono text-sm">{statsForSelectedDate.completed}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* หัวข้อให้เลือก สรุปสถิติที่ฟ้องรายวัน พร้อมตัวกรองยังไม่กดเสร็จสิ้น */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    สรุปสถิติผลการดำเนินคดีที่ฟ้องในวันนี้ (คลิกเลือกหัวข้อเพื่อกรองสำนวน)
                  </span>
                </div>

                {/* แถบคัดกรองสถานะการเสร็จสิ้นสำนวนในแต่ละวัน (สำนวนที่ยังไม่กดเสร็จสิ้นในแต่ละวัน) */}
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/15 backdrop-blur-md self-start lg:self-auto flex-wrap">
                  <span className="text-[11px] text-indigo-200 px-2 font-medium flex items-center gap-1">
                    <Filter className="w-3 h-3 text-amber-400" />
                    <span>คัดกรอง:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCompletionFilter('all')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                      completionFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>ทั้งหมด ({statsForSelectedDate.total})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletionFilter('incomplete')}
                    className={`px-3 py-1 text-xs rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      completionFilter === 'incomplete'
                        ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300 font-extrabold'
                        : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-400/30'
                    }`}
                    title="คัดกรองเฉพาะสำนวนที่ยังไม่กดเสร็จสิ้นในวันนี้"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>⏳ ยังไม่กดเสร็จสิ้น ({statsForSelectedDate.incomplete})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletionFilter('completed')}
                    className={`px-3 py-1 text-xs rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      completionFilter === 'completed'
                        ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-300 font-extrabold'
                        : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-400/30'
                    }`}
                    title="คัดกรองเฉพาะสำนวนที่กดเสร็จสิ้นแล้วในวันนี้"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>✅ เสร็จสิ้นแล้ว ({statsForSelectedDate.completed})</span>
                  </button>

                  {(procedureFilter !== 'all' || completionFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setProcedureFilter('all');
                        setCompletionFilter('all');
                      }}
                      className="ml-1 px-2 py-1 text-xs text-amber-300 hover:text-white underline underline-offset-2 flex items-center gap-0.5 cursor-pointer font-medium"
                      title="ล้างตัวกรองทั้งหมด"
                    >
                      <X className="w-3 h-3" />
                      <span>ล้างตัวกรอง</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 7 Selectable Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
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
                    <span className="text-[11px] font-medium text-slate-300">
                      {completionFilter === 'incomplete' ? 'คดีทั้งหมด (ยังไม่เสร็จ)' : completionFilter === 'completed' ? 'คดีทั้งหมด (เสร็จแล้ว)' : 'คดีทั้งหมด'}
                    </span>
                    <Scale className="w-3.5 h-3.5 text-indigo-300" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-['Prompt'] text-white">
                      {completionFilter === 'incomplete' ? statsForSelectedDate.incomplete : completionFilter === 'completed' ? statsForSelectedDate.completed : statsForSelectedDate.total}
                    </span>
                    <span className="text-xs text-slate-300">สำนวน</span>
                  </div>
                  {completionFilter === 'all' && statsForSelectedDate.total > 0 && (
                    <span className="text-[10px] text-amber-300/90 font-medium block mt-1">
                      (ยังไม่เสร็จ {statsForSelectedDate.incomplete} • เสร็จ {statsForSelectedDate.completed})
                    </span>
                  )}
                </button>

                {/* 2. ยังไม่เลือกสถานะ (เตือนแถบสีแดง) */}
                <button
                  type="button"
                  onClick={() => setProcedureFilter(procedureFilter === 'unspecified' ? 'all' : 'unspecified')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    procedureFilter === 'unspecified'
                      ? 'bg-rose-600/50 border-rose-400 text-white ring-2 ring-rose-400/50 shadow-md'
                      : statsForSelectedDate.unspecified > 0
                        ? 'bg-rose-950/40 border-rose-500/60 text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-900/40'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  }`}
                  title="คลิกเพื่อกรองสำนวนที่ยังไม่ได้เลือกสถานะการพิจารณา (คุมสำนวนฟ้องไว้ก่อน)"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-rose-300 flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full bg-rose-500 ${statsForSelectedDate.unspecified > 0 ? 'animate-ping' : ''}`} />
                      <span>ยังไม่เลือกสถานะ</span>
                    </span>
                    <AlertTriangle className={`w-3.5 h-3.5 ${statsForSelectedDate.unspecified > 0 ? 'text-amber-300 animate-bounce' : 'text-rose-400'}`} />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className={`text-2xl font-bold font-['Prompt'] ${statsForSelectedDate.unspecified > 0 ? 'text-rose-300' : 'text-slate-300'}`}>
                      {completionFilter === 'incomplete' ? statsForSelectedDate.unspecifiedIncomplete : statsForSelectedDate.unspecified}
                    </span>
                    <span className="text-xs text-rose-300/80">สำนวน</span>
                  </div>
                  {completionFilter === 'all' && statsForSelectedDate.unspecified > 0 && statsForSelectedDate.unspecifiedIncomplete < statsForSelectedDate.unspecified && (
                    <span className="text-[10px] text-rose-200/80 font-medium block mt-1">
                      (ยังไม่เสร็จ {statsForSelectedDate.unspecifiedIncomplete})
                    </span>
                  )}
                </button>

                {/* 3. จำเลยรับสารภาพ */}
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
                      {completionFilter === 'incomplete' ? statsForSelectedDate.confessedIncomplete : statsForSelectedDate.confessed}
                    </span>
                    <span className="text-xs text-emerald-200/80">ราย</span>
                  </div>
                  {completionFilter === 'all' && statsForSelectedDate.confessed > 0 && statsForSelectedDate.confessedIncomplete < statsForSelectedDate.confessed && (
                    <span className="text-[10px] text-emerald-200/80 font-medium block mt-1">
                      (ยังไม่เสร็จ {statsForSelectedDate.confessedIncomplete})
                    </span>
                  )}
                </button>

                {/* 4. ปฏิเสธมีนัดต่อ */}
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
                      {completionFilter === 'incomplete' ? statsForSelectedDate.deniedScheduledIncomplete : statsForSelectedDate.deniedScheduled}
                    </span>
                    <span className="text-xs text-amber-200/80">ราย</span>
                  </div>
                  {completionFilter === 'all' && statsForSelectedDate.deniedScheduled > 0 && statsForSelectedDate.deniedScheduledIncomplete < statsForSelectedDate.deniedScheduled && (
                    <span className="text-[10px] text-amber-200/80 font-medium block mt-1">
                      (ยังไม่เสร็จ {statsForSelectedDate.deniedScheduledIncomplete})
                    </span>
                  )}
                </button>

                {/* 5. มีนัดอื่นๆ */}
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
                      {completionFilter === 'incomplete' ? statsForSelectedDate.otherScheduledIncomplete : statsForSelectedDate.otherScheduled}
                    </span>
                    <span className="text-xs text-sky-200/80">ราย</span>
                  </div>
                  {completionFilter === 'all' && statsForSelectedDate.otherScheduled > 0 && statsForSelectedDate.otherScheduledIncomplete < statsForSelectedDate.otherScheduled && (
                    <span className="text-[10px] text-sky-200/80 font-medium block mt-1">
                      (ยังไม่เสร็จ {statsForSelectedDate.otherScheduledIncomplete})
                    </span>
                  )}
                </button>

                {/* 6. ยังไม่ทราบผล */}
                <button
                  type="button"
                  onClick={() => setProcedureFilter(procedureFilter === 'unknown_pending' ? 'all' : 'unknown_pending')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
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
                      {completionFilter === 'incomplete' ? statsForSelectedDate.unknownPendingIncomplete : statsForSelectedDate.unknownPending}
                    </span>
                    <span className="text-xs text-slate-400">ราย</span>
                  </div>
                  {completionFilter === 'all' && statsForSelectedDate.unknownPending > 0 && statsForSelectedDate.unknownPendingIncomplete < statsForSelectedDate.unknownPending && (
                    <span className="text-[10px] text-slate-400 font-medium block mt-1">
                      (ยังไม่เสร็จ {statsForSelectedDate.unknownPendingIncomplete})
                    </span>
                  )}
                </button>

                {/* 7. จำหน่ายชั่วคราว (จำเลยหลบหนี) */}
                <button
                  type="button"
                  onClick={() => setProcedureFilter(procedureFilter === 'temporarily_discharged' ? 'all' : 'temporarily_discharged')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between col-span-2 sm:col-span-1 ${
                    procedureFilter === 'temporarily_discharged'
                      ? 'bg-slate-700/70 border-slate-400 text-white ring-2 ring-slate-400/50 shadow-md'
                      : statsForSelectedDate.temporarilyDischarged > 0
                        ? 'bg-slate-800/70 border-slate-500 text-slate-200 ring-1 ring-slate-400/30 hover:bg-slate-700/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                  }`}
                  title="คลิกเพื่อกรองสำนวนที่จำหน่ายคดีออกจากสารบบชั่วคราวเนื่องจากจำเลยหลบหนี (ไม่ต้องคุมอุทธรณ์)"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      <span>จำหน่ายชั่วคราว</span>
                    </span>
                    <span className="text-xs">⏸️</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-['Prompt'] text-slate-200">
                      {completionFilter === 'incomplete' ? statsForSelectedDate.temporarilyDischargedIncomplete : statsForSelectedDate.temporarilyDischarged}
                    </span>
                    <span className="text-xs text-slate-400">สำนวน</span>
                  </div>
                  {completionFilter === 'all' && statsForSelectedDate.temporarilyDischarged > 0 && statsForSelectedDate.temporarilyDischargedIncomplete < statsForSelectedDate.temporarilyDischarged && (
                    <span className="text-[10px] text-slate-400 font-medium block mt-1">
                      (ยังไม่เสร็จ {statsForSelectedDate.temporarilyDischargedIncomplete})
                    </span>
                  )}
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
                      ยังไม่มีข้อมูลเวรชี้ตรงตามวันที่นี้ในตารางเวรชี้ (คุณสามารถคลิกเพื่อเลือกจากรายชื่อเวรชี้ประจำเดือนได้)
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
                      <span>ดูตารางเวรชี้ประจำเดือน</span>
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

              {/* Monthly Prosecutor Summary Button (สรุปสิ้นเดือนแยกรายอัยการ) */}
              {onOpenMonthlyProsecutorSummary && (
                <button
                  type="button"
                  onClick={() => onOpenMonthlyProsecutorSummary(selectedDate ? selectedDate.slice(0, 7) : undefined)}
                  className="bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-indigo-600 flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title="ดูรายงานสรุปปริมาณคดีสิ้นเดือน แยกตามอัยการเจ้าของสำนวนแต่ละคน (รับสารภาพ/ปฏิเสธ)"
                >
                  <BarChart3 className="w-4 h-4 text-amber-300" />
                  <span>สรุปสิ้นเดือนแยกรายอัยการ</span>
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
              {completionFilter === 'incomplete' && (
                <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-amber-950 shadow-xs gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                    <span>
                      กำลังคัดกรองแสดงเฉพาะ: <strong className="text-amber-950 font-bold font-['Prompt'] text-sm">สำนวนที่ยังไม่กดเสร็จสิ้นในวันนี้</strong> ({casesOnSelectedDate.length} สำนวน จากทั้งหมด {statsForSelectedDate.total} สำนวน)
                      {procedureFilter !== 'all' && (
                        <span className="ml-1.5 text-indigo-900 font-semibold bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200">
                          หมวด: {getProcedureFilterLabel(procedureFilter)}
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCompletionFilter('all');
                      setProcedureFilter('all');
                    }}
                    className="font-bold text-amber-950 hover:bg-amber-200 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 transition cursor-pointer flex items-center gap-1 shadow-2xs self-start sm:self-auto shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>แสดงสำนวนทั้งหมดในวันนี้</span>
                  </button>
                </div>
              )}

              {completionFilter === 'completed' && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-emerald-950 shadow-xs gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      กำลังคัดกรองแสดงเฉพาะ: <strong className="text-emerald-900 font-bold">สำนวนที่กดเสร็จสิ้นแล้ว</strong> ({casesOnSelectedDate.length} สำนวน)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompletionFilter('all')}
                    className="font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 cursor-pointer flex items-center gap-1 self-start sm:self-auto shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>แสดงสำนวนทั้งหมดในวันนี้</span>
                  </button>
                </div>
              )}

              {procedureFilter !== 'all' && completionFilter === 'all' && (
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

              {/* แถบสีอธิบายสถานะพื้นหลังสำนวนตามคำขอ */}
              <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:px-3.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                  <Palette className="w-4 h-4 text-indigo-600" />
                  <span>สีพื้นหลังจำแนกตามคำให้การ / นัด:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 border border-rose-300 text-rose-950 border-l-4 border-l-rose-600 shadow-2xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                    <span>สีแดง = ยังไม่เลือกสถานะสำนวน (เตือน)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-100 border border-yellow-300 text-yellow-950 border-l-4 border-l-yellow-500 shadow-2xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    <span>สีเหลือง = จำเลยรับสารภาพ</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-100 border border-orange-300 text-orange-950 border-l-4 border-l-orange-500 shadow-2xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    <span>สีส้ม = จำเลยปฏิเสธ (มีนัดต่อ)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-950 border-l-4 border-l-emerald-600 shadow-2xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>สีเขียว = สำนวนมีเบิกฟ้อง</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-100 border border-sky-300 text-sky-950 border-l-4 border-l-sky-500 shadow-2xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    <span>สีฟ้า = มีนัดอื่นๆ</span>
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
                const isUnspecified = procCat === 'unspecified' || isCaseUnspecifiedStage(caseItem);

                return (
                  <div
                    key={caseItem.id}
                    className={`rounded-xl p-3 sm:p-3.5 shadow-2xs hover:shadow-xs transition border ${cardStyle.cardClass}`}
                  >
                    {/* แถบสีแดงเตือน: ยังไม่เลือกสถานะสำนวนในการพิจารณาของศาล (คุมสำนวนที่จะฟ้องในวันไว้ก่อน) */}
                    {isUnspecified && (
                      <div className="mb-2.5 bg-gradient-to-r from-rose-600 via-rose-600 to-red-600 text-white rounded-lg p-2.5 shadow-xs border border-rose-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-200 animate-bounce" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold font-['Prompt'] tracking-wide">
                                ⚠️ ยังไม่เลือกสถานะสำนวนในการพิจารณาของศาล
                              </span>
                              <span className="text-[10px] bg-rose-950/60 text-rose-100 px-1.5 py-0.2 rounded border border-rose-400 font-normal">
                                คุมสำนวนที่จะฟ้องในวันไว้ก่อน
                              </span>
                            </div>
                            <p className="text-[11px] text-rose-100 leading-tight mt-0.5">
                              เมื่อทราบผลการพิจารณาของศาลแล้ว กรุณาเลือกสถานะสำนวนด้านล่างนี้
                            </p>
                          </div>
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1 flex-wrap shrink-0">
                            <span className="text-[11px] text-rose-100 font-medium mr-0.5">เลือกผล:</span>
                            <button
                              type="button"
                              onClick={() => onQuickChangePleaStatus && onQuickChangePleaStatus(caseItem, 'confessed')}
                              className="text-[11px] font-bold text-yellow-950 bg-yellow-300 hover:bg-yellow-200 px-2.5 py-1 rounded shadow-xs cursor-pointer transition flex items-center gap-1 active:scale-95"
                              title="ระบุว่าจำเลยรับสารภาพ"
                            >
                              <span>🟡 รับสารภาพ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onQuickChangePleaStatus && onQuickChangePleaStatus(caseItem, 'denied')}
                              className="text-[11px] font-bold text-orange-950 bg-orange-200 hover:bg-orange-100 px-2.5 py-1 rounded shadow-xs cursor-pointer transition flex items-center gap-1 active:scale-95"
                              title="ระบุว่าจำเลยปฏิเสธ (มีนัดคุ้มครองสิทธิ)"
                            >
                              <span>🟠 ปฏิเสธ (คุ้มครองสิทธิ)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onQuickChangePleaStatus && onQuickChangePleaStatus(caseItem, 'requisition')}
                              className="text-[11px] font-bold text-emerald-950 bg-emerald-200 hover:bg-emerald-100 px-2 py-1 rounded shadow-xs cursor-pointer transition flex items-center gap-1 active:scale-95"
                              title="ระบุว่าเป็นสำนวนเบิกฟ้อง"
                            >
                              <span>🟢 เบิกฟ้อง</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onQuickChangePleaStatus && onQuickChangePleaStatus(caseItem, 'pending')}
                              className="text-[11px] font-bold text-sky-950 bg-sky-200 hover:bg-sky-100 px-2 py-1 rounded shadow-xs cursor-pointer transition flex items-center gap-1 active:scale-95"
                              title="ระบุว่ามีนัดอื่นๆ"
                            >
                              <span>🔵 นัดอื่นๆ</span>
                            </button>
                            {onEditCase && (
                              <button
                                type="button"
                                onClick={() => onEditCase(caseItem)}
                                className="text-[11px] font-semibold text-white bg-black/30 hover:bg-black/40 px-2 py-1 rounded cursor-pointer transition flex items-center gap-1"
                                title="เปิดฟอร์มแก้ไขเพื่อระบุรายละเอียดเพิ่มเติม"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>แก้ไข</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

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

                          {/* ป้ายแสดงสถานะการกดเสร็จสิ้นสำนวน */}
                          {isCompleted ? (
                            isKunchartCompletedPendingNoAppealAlert(caseItem) ? (
                              <span
                                className="text-[11px] font-bold text-purple-950 bg-purple-100 px-2 py-0.5 rounded-md border border-purple-300 inline-flex items-center gap-1 shadow-2xs animate-pulse"
                                title="อ.กุลชาติ: เตือนก่อนครบอุทธรณ์ 5 วัน (รอการยืนยันไม่อุทธรณ์)"
                              >
                                <AlertTriangle className="w-3 h-3 text-purple-700 shrink-0" />
                                <span>อ.กุลชาติ: เตือนก่อนครบ 5 วัน (รอไม่อุทธรณ์)</span>
                              </span>
                            ) : isKunchartCase(caseItem) && caseItem.isNoAppealConfirmed ? (
                              <span
                                className="text-[11px] font-bold text-emerald-950 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300 inline-flex items-center gap-1 shadow-2xs"
                                title="อ.กุลชาติ: ยืนยันไม่อุทธรณ์แล้ว (หยุดการแจ้งเตือน)"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>อ.กุลชาติ: ยืนยันไม่อุทธรณ์แล้ว</span>
                              </span>
                            ) : (
                              <span
                                className="text-[11px] font-bold text-emerald-950 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300 inline-flex items-center gap-1 shadow-2xs"
                                title={caseItem.completedDate ? `กดเสร็จสิ้นสำนวนแล้ว (${formatThaiDate(caseItem.completedDate)})` : 'กดเสร็จสิ้นสำนวนแล้ว'}
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>เสร็จสิ้นแล้ว</span>
                              </span>
                            )
                          ) : (
                            <span
                              className="text-[11px] font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 inline-flex items-center gap-1 shadow-2xs"
                              title="สำนวนนี้ยังไม่ได้กดเสร็จสิ้น"
                            >
                              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>⏳ ยังไม่กดเสร็จสิ้น</span>
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
                          ) : shouldAlertMissingJudgment(caseItem) ? (
                            <span
                              className="text-xs font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300 flex items-center gap-1 shadow-2xs"
                              title="สำนวนจำเลยรับสารภาพ ยังไม่ได้กรอกคำพิพากษา"
                            >
                              <Scale className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>รับสารภาพ (ยังไม่กรอกคำพิพากษา)</span>
                            </span>
                          ) : null}

                          {/* สถิติผลการดำเนินคดี Badge */}
                          {procCat === 'temporarily_discharged' && (
                            <span className="text-xs font-bold text-slate-900 bg-slate-200 px-2 py-0.5 rounded-md border border-slate-400 flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                              <span>⏸️ จำหน่ายคดีชั่วคราว (จำเลยหลบหนี - ไม่ต้องคุมอุทธรณ์)</span>
                            </span>
                          )}
                          {procCat === 'unspecified' && (
                            <span className="text-xs font-bold text-rose-950 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-400 flex items-center gap-1 shadow-2xs animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              <span>🚨 ยังไม่เลือกสถานะสำนวน</span>
                            </span>
                          )}
                          {procCat === 'confessed' && (
                            <span className="text-xs font-bold text-yellow-950 bg-yellow-100 px-2 py-0.5 rounded-md border border-yellow-300 flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                              <span>🟡 จำเลยรับสารภาพ</span>
                            </span>
                          )}
                          {procCat === 'denied_scheduled' && (
                            <span className="text-xs font-bold text-orange-950 bg-orange-100 px-2 py-0.5 rounded-md border border-orange-300 flex items-center gap-1 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                              <span>🟠 ปฏิเสธ - มีนัดสืบต่อ</span>
                            </span>
                          )}
                          {procCat === 'other_scheduled' && (
                            (caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition') ? (
                              <span className="text-xs font-bold text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span>🟢 สำนวนมีเบิกฟ้อง</span>
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
                              title="คลิกเพื่อเลือกหรือเปลี่ยนอัยการเวรชี้จากตารางเวรชี้"
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
                                title="เลือกอัยการเวรชี้จากตารางเวรชี้"
                              >
                                <UserCheck className="w-3 h-3 text-slate-400" />
                                <span>ระบุเวรชี้</span>
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

                          {(caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition') && (() => {
                            const reqAlert = getRequisitionAlertInfo(caseItem);
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-950 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md shadow-2xs">
                                  <span>🚚 สำนวนเบิกฟ้อง</span>
                                  {(caseItem.requisitionDate || caseItem.appointmentDate) && (
                                    <span>: {formatThaiDate(caseItem.requisitionDate || caseItem.appointmentDate)}</span>
                                  )}
                                </div>

                                {reqAlert.isPending && (
                                  reqAlert.isAlertDue ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md shadow-2xs animate-pulse">
                                      🔔 เตือนรอบที่ {reqAlert.cycle} (รอ {reqAlert.daysElapsed} วัน • เตือนทุก 5 วัน)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                      รอ {reqAlert.daysElapsed} วัน • เตือนในอีก {reqAlert.daysUntilNextAlert} วัน
                                    </span>
                                  )
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* สำนวนแยกฟ้องมาจากคดีเดิม */}
                        {caseItem.isSeveredCase && caseItem.originalBlackCaseNo && (
                          <div className="mt-1 text-[11px] text-purple-900 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1 font-medium flex items-center gap-1.5 w-fit">
                            <span className="font-bold">✂️ สำนวนแยกฟ้อง:</span>
                            <span>ศาลสั่งแยกฟ้องมาจากคดีเดิม ดำ {caseItem.originalBlackCaseNo}</span>
                          </div>
                        )}

                        {/* กรณีจำเลยหลายคน: บางคนรับสารภาพ & บางคนปฏิเสธ (ศาลสั่งแยกฟ้องภายใน 7 วัน ป.วิ.อ. ม.176) */}
                        {(caseItem.hasPartialDenial || caseItem.hasPendingSeveredFiling) && (() => {
                          const alertInfo = getSeveredFilingAlertInfo(caseItem);
                          return (
                            <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-purple-50/90 via-indigo-50/80 to-amber-50/50 border-2 border-purple-300 text-xs space-y-1.5 shadow-2xs">
                              <div className="flex items-center justify-between flex-wrap gap-1.5">
                                <span className="font-bold text-purple-950 flex items-center gap-1.5 font-['Prompt']">
                                  <span className="w-5 h-5 rounded-md bg-purple-700 text-white flex items-center justify-center text-[10px]">👥</span>
                                  <span>จำเลยหลายคน: บางคนรับสารภาพ & บางคนปฏิเสธ (ป.วิ.อ. ม.176)</span>
                                </span>
                                {caseItem.hasPendingSeveredFiling && (
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${
                                    caseItem.isSeveredFilingCompleted
                                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                      : alertInfo.status === 'overdue'
                                      ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                                      : alertInfo.status === 'due_today'
                                      ? 'bg-amber-400 text-slate-950 border-amber-500 font-extrabold animate-pulse'
                                      : 'bg-purple-200 text-purple-950 border-purple-300'
                                  }`}>
                                    ✂️ {caseItem.isSeveredFilingCompleted ? (caseItem.severedNewBlackCaseNo ? `แยกฟ้องแล้ว (${caseItem.severedNewBlackCaseNo})` : 'ยื่นแยกฟ้องแล้ว') : alertInfo.alertBadgeText}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                                {caseItem.confessedDefendants && (
                                  <div className="flex items-center gap-1 text-yellow-950 bg-white/80 px-2 py-1 rounded-lg border border-yellow-200">
                                    <span className="font-semibold shrink-0">🟡 รับสารภาพ:</span>
                                    <span className="truncate">{caseItem.confessedDefendants}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1 text-orange-950 bg-white/80 px-2 py-1 rounded-lg border border-orange-200 font-medium">
                                  <span className="font-bold shrink-0">🟠 ปฏิเสธ (ต้องแยกฟ้อง):</span>
                                  <span className="truncate">{caseItem.deniedDefendants || caseItem.defendant}</span>
                                </div>
                              </div>

                              {caseItem.hasPendingSeveredFiling && (
                                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-purple-200/80 text-purple-900 flex-wrap gap-1.5">
                                  <div>
                                    <span>ศาลสั่ง: <strong>{formatThaiDate(alertInfo.orderDate)}</strong> • </span>
                                    <span className="font-bold text-rose-700">ครบ 7 วัน: {formatThaiDate(alertInfo.deadlineDate)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {!caseItem.isSeveredFilingCompleted && onMarkSeveredCompleted && (
                                      <button
                                        type="button"
                                        onClick={() => onMarkSeveredCompleted(caseItem)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                                        title="บันทึกว่ายื่นแยกฟ้องเสร็จเรียบร้อยแล้ว"
                                      >
                                        <span>✓ ยื่นแยกฟ้องแล้ว</span>
                                      </button>
                                    )}
                                    {onCreateSeveredCase && (
                                      <button
                                        type="button"
                                        onClick={() => onCreateSeveredCase(caseItem)}
                                        className="bg-purple-700 hover:bg-purple-800 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                                        title="เปิดฟอร์มสร้างสำนวนแยกฟ้องที่เชื่อมโยงกับคดีนี้ทันที"
                                      >
                                        <span>➕ สร้างสำนวนแยกฟ้อง</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Interactive Plea Switcher (ปรับคำให้การจำเลย พร้อมปรับสีพื้นหลังให้ตรงกับประเภทสำนวนทันที) */}
                        {canEdit && onQuickChangePleaStatus && !isCompleted && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1.5 mt-1 border-t border-slate-300/60">
                            <span className="text-[10px] text-slate-700 font-bold flex items-center gap-1">
                              <Palette className="w-3 h-3 text-indigo-600" />
                              <span>✏️ ปรับคำให้การ:</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => onQuickChangePleaStatus(caseItem, 'confessed')}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition shadow-2xs active:scale-95 flex items-center gap-1 ${
                                (procCat === 'confessed' || caseItem.defendantPlea === 'confessed')
                                  ? 'bg-yellow-400 text-yellow-950 border border-yellow-500 ring-2 ring-yellow-400/40 shadow-xs'
                                  : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border border-yellow-300'
                              }`}
                              title="ปรับคำให้การเป็น จำเลยรับสารภาพ (พื้นหลังสีเหลือง)"
                            >
                              <span>🟡 รับสารภาพ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onQuickChangePleaStatus(caseItem, 'denied')}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition shadow-2xs active:scale-95 flex items-center gap-1 ${
                                (procCat === 'denied_scheduled' || caseItem.defendantPlea === 'denied')
                                  ? 'bg-orange-400 text-orange-950 border border-orange-500 ring-2 ring-orange-400/40 shadow-xs'
                                  : 'bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300'
                              }`}
                              title="ปรับคำให้การเป็น จำเลยปฏิเสธ/คุ้มครองสิทธิ (พื้นหลังสีส้ม)"
                            >
                              <span>🟠 ปฏิเสธ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onQuickChangePleaStatus(caseItem, 'requisition')}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition shadow-2xs active:scale-95 flex items-center gap-1 ${
                                (caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition') && caseItem.defendantPlea !== 'confessed' && caseItem.defendantPlea !== 'denied'
                                  ? 'bg-emerald-400 text-emerald-950 border border-emerald-500 ring-2 ring-emerald-400/40 shadow-xs'
                                  : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                              }`}
                              title="ปรับสถานะเป็น สำนวนเบิกฟ้อง (พื้นหลังสีเขียว)"
                            >
                              <span>🟢 เบิกฟ้อง</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onQuickChangePleaStatus(caseItem, 'pending')}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition shadow-2xs active:scale-95 flex items-center gap-1 ${
                                procCat === 'other_scheduled' && !caseItem.isRequisitionCase && caseItem.appointmentType !== 'requisition'
                                  ? 'bg-sky-400 text-sky-950 border border-sky-500 ring-2 ring-sky-400/40 shadow-xs'
                                  : 'bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300'
                              }`}
                              title="ปรับสถานะเป็น มีนัดอื่นๆ / ยังไม่ทราบคำให้การ (พื้นหลังสีฟ้า)"
                            >
                              <span>🔵 นัดอื่นๆ</span>
                            </button>
                          </div>
                        )}

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

                        {caseItem.isSubmittedToDuty && (
                          <div className="flex items-center gap-1.5 text-xs text-blue-950 bg-blue-100/90 border border-blue-300 px-2.5 py-1 rounded-lg w-fit font-medium shadow-2xs">
                            <Send className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            <span>
                              <strong className="text-blue-900 font-bold">สำนวนนี้เสนอเวรชี้แล้ว</strong>
                              {caseItem.submittedToDutyOfficer ? `: ${caseItem.submittedToDutyOfficer}` : ''}
                              {caseItem.submittedToDutyDate ? ` (${formatThaiDate(caseItem.submittedToDutyDate, { short: true })})` : ''}
                              <span className="text-[10px] text-blue-700 ml-1 font-normal">(ยังคงคุมระยะเวลาอุทธรณ์)</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right Side: Deadline & Actions */}
                      <div className="flex flex-col sm:items-end gap-2 md:border-l md:border-slate-200/60 md:pl-3.5 flex-shrink-0">
                        {/* Status / Deadline Info */}
                        {isCaseTemporarilyDischarged(caseItem) ? (
                          <div className="text-left sm:text-right space-y-1">
                            <span className="inline-flex items-center gap-1 text-xs text-slate-800 bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-400 font-bold shadow-2xs">
                              <span>⏸️ จำหน่ายชั่วคราว (จำเลยหลบหนี)</span>
                            </span>
                            <div className="text-[10px] text-slate-500">
                              {caseItem.temporaryDischargeDate ? `จำหน่ายชั่วคราวเมื่อ ${formatThaiDate(caseItem.temporaryDischargeDate, { short: true })}` : 'ไม่ต้องคุมอุทธรณ์'}
                            </div>
                            {caseItem.arrestWarrantNo && (
                              <div className="text-[10px] text-slate-600 font-medium">
                                หมายจับ: {caseItem.arrestWarrantNo}
                              </div>
                            )}
                            {canEdit && onToggleTemporaryDischarge && (
                              <div className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => onToggleTemporaryDischarge(caseItem, false)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-2.5 py-1 rounded-lg shadow-2xs transition cursor-pointer active:scale-95"
                                  title="คลิกเมื่อจับกุมตัวจำเลยได้แล้ว เพื่อกลับมาคุมอุทธรณ์ตามปกติต่อทันที"
                                >
                                  <span>🟢 จับตัวได้แล้ว / กลับมาคุมอุทธรณ์</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : isCompleted ? (
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
                                      : shouldAlertMissingJudgment(caseItem)
                                      ? 'text-white bg-amber-600 hover:bg-amber-700 font-bold'
                                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                                  }`}
                                  title={
                                    hasJudgmentRecorded && caseItem.judgmentDate
                                      ? `แก้ไขคำพิพากษา (กรอกแล้วเมื่อ ${formatThaiDate(caseItem.judgmentDate)})`
                                      : shouldAlertMissingJudgment(caseItem)
                                      ? 'จำเลยรับสารภาพ กรุณากรอกคำพิพากษา'
                                      : 'กรอกคำพิพากษา (เมื่อศาลมีคำตัดสิน)'
                                  }
                                >
                                  {hasJudgmentRecorded ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>แก้คำพิพากษา (กรอกแล้ว)</span>
                                    </>
                                  ) : shouldAlertMissingJudgment(caseItem) ? (
                                    <>
                                      <Scale className="w-3.5 h-3.5" />
                                      <span>+ กรอกคำพิพากษา</span>
                                    </>
                                  ) : (
                                    <>
                                      <Scale className="w-3.5 h-3.5 text-slate-500" />
                                      <span>กรอกคำพิพากษา</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* 2.5 Screenshot Recheck button */}
                              {caseItem.judgmentPhotoUrl && (
                                <button
                                  type="button"
                                  onClick={() => onOpenJudgmentRecheck ? onOpenJudgmentRecheck(caseItem) : (onRecordJudgment && onRecordJudgment(caseItem))}
                                  className="px-2 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                  title="เปิดตรวจทานข้อความคำพิพากษาเทียบภาพแคปหน้าจอ"
                                >
                                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{caseItem.judgmentVerified ? '✓ ตรวจทานเทียบภาพแล้ว' : '📸 ตรวจทานภาพ'}</span>
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

                              {/* ปุ่ม เสนอเวรชี้ (หากกดแล้วยังคุมอุทธรณ์อยู่จนกว่าจะกดเสร็จสิ้น) */}
                              {onOpenSubmitToDuty && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSubmitToDuty(caseItem)}
                                  className={`px-2 py-1 text-xs rounded-md transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 ${
                                    caseItem.isSubmittedToDuty
                                      ? 'text-blue-950 bg-blue-100 hover:bg-blue-200 border border-blue-300 font-bold'
                                      : 'text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 font-semibold'
                                  }`}
                                  title={
                                    caseItem.isSubmittedToDuty
                                      ? 'สำนวนนี้เสนอเวรชี้แล้ว - คลิกเพื่อแก้ไขข้อมูลเวรชี้หรือยกเลิก'
                                      : 'คลิกเพื่อเสนอเวรชี้ทันที (ไม่ต้องกรอกข้อมูล สำนวนยังคุมอุทธรณ์ตามปกติ)'
                                  }
                                >
                                  <Send className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{caseItem.isSubmittedToDuty ? '✓ เสนอเวรชี้แล้ว (แก้ไข)' : 'เสนอเวรชี้'}</span>
                                </button>
                              )}

                              {/* ปุ่มยืนยันไม่อุทธรณ์ เฉพาะกรณีเจ้าของสำนวนเป็น อ.กุลชาติ */}
                              {isKunchartCase(caseItem) && isCompleted && !caseItem.isNoAppealConfirmed && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`ยืนยันว่าสำนวน ${caseItem.blackCaseNo} ไม่อุทธรณ์แล้วใช่หรือไม่?\n\nเมื่อยืนยันแล้ว ระบบจะหยุดการแจ้งเตือนสำหรับสำนวนนี้ (เฉพาะ อ.กุลชาติ)`)) {
                                      onConfirmNoAppeal?.(caseItem.id);
                                    }
                                  }}
                                  className="px-2 py-1 text-xs rounded-md transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 bg-purple-700 hover:bg-purple-800 text-white font-bold animate-pulse"
                                  title="กดยืนยันว่าสำนวนไม่อุทธรณ์แล้ว เพื่อหยุดการเตือน (เฉพาะ อ.กุลชาติ)"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-200" />
                                  <span>✓ ยืนยันไม่อุทธรณ์</span>
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
                              {/* สิทธิ์เจ้าหน้าที่คุมอุทธรณ์: สามารถดูสำนวนได้ */}
                              {onEditCase && (
                                <button
                                  type="button"
                                  onClick={() => onEditCase(caseItem)}
                                  className="px-2 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="ดูรายละเอียดสำนวนคดี (อ่านอย่างเดียว)"
                                >
                                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>ดูสำนวน</span>
                                </button>
                              )}
                              {/* สิทธิ์เจ้าหน้าที่คุมอุทธรณ์: สามารถกดได้แค่เสร็จสิ้น แต่ไม่สามารถแก้ไขหรือลบคดีได้ */}
                              {canComplete && onMarkComplete && (
                                <button
                                  type="button"
                                  onClick={() => onMarkComplete(caseItem)}
                                  className={`px-2.5 py-1 text-xs rounded-md transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 ${
                                    isCompleted
                                      ? 'text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 font-bold'
                                      : 'text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 font-semibold'
                                  }`}
                                  title={isCompleted ? 'แก้ไขวันที่เสร็จสิ้น / เหตุผล' : 'กรอกวันที่เสร็จสิ้นสำนวน (ยื่นอุทธรณ์/ยุติ)'}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{isCompleted ? 'แก้เสร็จ' : 'เสร็จสิ้น'}</span>
                                </button>
                              )}
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
                {completionFilter === 'incomplete' && statsForSelectedDate.total > 0 ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                ) : (
                  <Calendar className="w-7 h-7" />
                )}
              </div>
              <h4 className="font-bold text-base text-slate-800 font-['Prompt']">
                {completionFilter === 'incomplete' && statsForSelectedDate.total > 0
                  ? `ไม่มีสำนวนค้างในวันที่ ${formatThaiDate(selectedDate)} (กดเสร็จสิ้นครบทั้ง ${statsForSelectedDate.total} สำนวนแล้ว)`
                  : `ไม่พบคดีที่ยื่นฟ้องในวันที่ ${formatThaiDate(selectedDate)}`}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                {completionFilter === 'incomplete' && statsForSelectedDate.total > 0
                  ? 'สำนวนคดีที่ยื่นฟ้องในวันที่เลือกนี้ได้รับการกดเสร็จสิ้นครบถ้วนเรียบร้อยแล้ว ไม่มีสำนวนค้าง'
                  : dateSearch.trim()
                  ? `ไม่พบสำนวนคดีที่ตรงกับคำค้นหา "${dateSearch}" ในวันที่เลือกนี้`
                  : 'ในวันที่เลือกนี้ยังไม่มีรายการสำนวนคดีที่บันทึกไว้ในระบบ คุณสามารถเริ่มเพิ่มสำนวนที่ยื่นฟ้องในวันนี้ได้ทันที'}
              </p>
              {completionFilter === 'incomplete' && statsForSelectedDate.total > 0 ? (
                <button
                  type="button"
                  onClick={() => setCompletionFilter('all')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>ดูสำนวนทั้งหมดในวันนี้ ({statsForSelectedDate.total} สำนวน)</span>
                </button>
              ) : onAddNewCaseForDate ? (
                <button
                  type="button"
                  onClick={() => onAddNewCaseForDate(selectedDate)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ กรอกข้อมูลคดีที่ยื่นฟ้องในวันที่ {formatThaiDate(selectedDate, { short: true })}</span>
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: ALL DATES OVERVIEW (ดูทุกวันที่ฟ้องทั้งหมด)                       */}
      {/* ========================================================================= */}
      {viewMode === 'all_dates' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between text-xs text-slate-600 gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                แสดงภาพรวม {filteredDistinctFilingDates.length} วันที่ยื่นฟ้อง {dateSearch ? `(กรองตาม "${dateSearch}")` : `(ทั้งหมด ${distinctFilingDates.length} วัน)`} รวม {cases.length} สำนวน
              </span>
              {/* แถบคัดกรองสถานะการกดเสร็จสิ้นในโหมดทุกวัน */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 px-1 font-medium flex items-center gap-1">
                  <Filter className="w-3 h-3 text-amber-500" />
                  <span>คัดกรอง:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setCompletionFilter('all')}
                  className={`px-2.5 py-0.5 text-xs rounded-lg font-semibold transition cursor-pointer ${
                    completionFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  ทั้งหมด ({cases.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCompletionFilter(completionFilter === 'incomplete' ? 'all' : 'incomplete')}
                  className={`px-2.5 py-0.5 text-xs rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    completionFilter === 'incomplete'
                      ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-2xs'
                      : 'text-amber-800 hover:bg-amber-50'
                  }`}
                  title="คัดกรองเฉพาะสำนวนที่ยังไม่กดเสร็จสิ้นในแต่ละวัน"
                >
                  <Clock className="w-3 h-3" />
                  <span>⏳ ยังไม่เสร็จ ({cases.filter((c) => !c.isCompleted).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompletionFilter(completionFilter === 'completed' ? 'all' : 'completed')}
                  className={`px-2.5 py-0.5 text-xs rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                    completionFilter === 'completed'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 shadow-2xs'
                      : 'text-emerald-800 hover:bg-emerald-50'
                  }`}
                  title="คัดกรองเฉพาะสำนวนที่กดเสร็จสิ้นแล้ว"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>✅ เสร็จสิ้น ({cases.filter((c) => c.isCompleted).length})</span>
                </button>
              </div>
            </div>
            <button
              onClick={() => setViewMode('single_date')}
              className="text-indigo-600 hover:text-indigo-800 font-semibold shrink-0 cursor-pointer self-start md:self-auto"
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 border border-rose-300 text-rose-950 border-l-4 border-l-rose-600 shadow-2xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                <span>สีแดง = ยังไม่เลือกสถานะสำนวน (เตือน)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-100 border border-yellow-300 text-yellow-950 border-l-4 border-l-yellow-500 shadow-2xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span>สีเหลือง = จำเลยรับสารภาพ</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-100 border border-orange-300 text-orange-950 border-l-4 border-l-orange-500 shadow-2xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                <span>สีส้ม = จำเลยปฏิเสธ (มีนัดต่อ)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-950 border-l-4 border-l-emerald-600 shadow-2xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span>สีเขียว = สำนวนมีเบิกฟ้อง</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-100 border border-sky-300 text-sky-950 border-l-4 border-l-sky-500 shadow-2xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                <span>สีฟ้า = มีนัดอื่นๆ</span>
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
                const incompleteInGroup = allCasesInGroup.filter((c) => !c.isCompleted).length;
                const completedInGroup = allCasesInGroup.filter((c) => c.isCompleted).length;
                const casesInGroup = allCasesInGroup.filter((c) => {
                  if (completionFilter === 'incomplete' && c.isCompleted) return false;
                  if (completionFilter === 'completed' && !c.isCompleted) return false;
                  if (dateSearch.trim()) return caseMatchesDailySearch(c, dateSearch);
                  return true;
                });
                const isOpen = dateSearch.trim() ? true : (expandedDates[dateKey] !== false);

              return (
                <div key={dateKey} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  {/* Group Header */}
                  <div
                    onClick={() => handleToggleExpand(dateKey)}
                    className="p-3.5 sm:p-4 bg-slate-50/80 hover:bg-slate-100/70 transition cursor-pointer flex items-center justify-between gap-3 border-b border-slate-100 flex-wrap"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 font-['Prompt'] text-sm">
                            วันที่ฟ้อง: {formatThaiDate(dateKey)}
                          </span>
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.2 rounded-full">
                            {casesInGroup.length} คดี
                          </span>
                          {incompleteInGroup > 0 ? (
                            <span className="text-[11px] font-bold text-amber-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>ยังไม่กดเสร็จสิ้น {incompleteInGroup} สำนวน</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>เสร็จสิ้นครบแล้ว ({completedInGroup})</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {incompleteInGroup > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(dateKey);
                            setCompletionFilter('incomplete');
                            setViewMode('single_date');
                          }}
                          className="text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 border border-amber-300 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          title={`คลิกเพื่อดูเฉพาะสำนวนที่ยังไม่กดเสร็จสิ้นในวันที่ ${formatThaiDate(dateKey)}`}
                        >
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>กรองยังไม่เสร็จ ({incompleteInGroup})</span>
                        </button>
                      )}

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
                              {/* ป้ายแสดงสถานะการกดเสร็จสิ้นสำนวน */}
                              {caseItem.isCompleted ? (
                                <span
                                  className="text-[11px] font-bold text-emerald-950 bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1 shadow-2xs"
                                  title={caseItem.completedDate ? `กดเสร็จสิ้นสำนวนแล้ว (${formatThaiDate(caseItem.completedDate)})` : 'กดเสร็จสิ้นสำนวนแล้ว'}
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>เสร็จสิ้นแล้ว</span>
                                </span>
                              ) : (
                                <span
                                  className="text-[11px] font-bold text-amber-950 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-1 shadow-2xs"
                                  title="สำนวนนี้ยังไม่ได้กดเสร็จสิ้น"
                                >
                                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>⏳ ยังไม่กดเสร็จสิ้น</span>
                                </span>
                              )}
                              {hasJudgmentRecorded ? (
                                <span
                                  className="text-[11px] font-bold text-emerald-900 bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1 shadow-2xs"
                                  title={caseItem.judgmentDate ? `กรอกคำพิพากษาแล้ว (${formatThaiDate(caseItem.judgmentDate)})` : 'กรอกคำพิพากษาแล้ว'}
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>⚖️ กรอกคำพิพากษาแล้ว</span>
                                </span>
                              ) : shouldAlertMissingJudgment(caseItem) ? (
                                <span
                                  className="text-[10px] font-semibold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-1 shadow-2xs"
                                  title="สำนวนจำเลยรับสารภาพ ยังไม่ได้กรอกคำพิพากษา"
                                >
                                  <Scale className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                  <span>รับสารภาพ (ยังไม่กรอกคำพิพากษา)</span>
                                </span>
                              ) : null}
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
                                <span className="text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 font-semibold flex items-center gap-1 shadow-2xs">
                                  <span>🚚 สำนวนเบิกฟ้อง</span>
                                  {(caseItem.requisitionDate || caseItem.appointmentDate) && (
                                    <span>: {formatThaiDate(caseItem.requisitionDate || caseItem.appointmentDate)}</span>
                                  )}
                                </span>
                              )}
                              {caseItem.isSubmittedToDuty && (
                                <span className="text-blue-950 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow-2xs" title="สำนวนนี้เสนอเวรชี้แล้ว (ยังคงคุมระยะเวลาอุทธรณ์)">
                                  <Send className="w-3 h-3 text-blue-700" />
                                  <span>สำนวนนี้เสนอเวรชี้แล้ว{caseItem.submittedToDutyOfficer ? `: ${caseItem.submittedToDutyOfficer}` : ''}</span>
                                  {caseItem.submittedToDutyDate && (
                                    <span className="text-[10px] text-blue-700 font-normal">({formatThaiDate(caseItem.submittedToDutyDate, { short: true })})</span>
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

                            {/* สิทธิ์เจ้าหน้าที่คุมอุทธรณ์: ดูสำนวนและกดเสร็จสิ้นได้ */}
                            {!canEdit && (
                              <div className="flex items-center gap-1.5 text-xs">
                                {onEditCase && (
                                  <button
                                    type="button"
                                    onClick={() => onEditCase(caseItem)}
                                    className="px-2 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                    title="ดูรายละเอียดสำนวนคดี (อ่านอย่างเดียว)"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>ดูสำนวน</span>
                                  </button>
                                )}
                                {canComplete && onMarkComplete && (
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
                                        : 'เสร็จสิ้น'}
                                    </span>
                                  </button>
                                )}
                              </div>
                            )}

                            {canEdit && (
                              <>
                                {onRecordJudgment && (
                                  <button
                                    type="button"
                                    onClick={() => onRecordJudgment(caseItem)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 ${
                                      hasJudgmentRecorded
                                        ? 'text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300'
                                        : shouldAlertMissingJudgment(caseItem)
                                        ? 'text-white bg-amber-600 hover:bg-amber-700'
                                        : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                                    }`}
                                    title={
                                      hasJudgmentRecorded && caseItem.judgmentDate
                                        ? `คำพิพากษาเมื่อ ${formatThaiDate(caseItem.judgmentDate)} - คลิกเพื่อแก้ไขคำพิพากษา`
                                        : shouldAlertMissingJudgment(caseItem)
                                        ? 'จำเลยรับสารภาพ กรอกคำพิพากษาเพื่อเริ่มคุมอุทธรณ์ 1 เดือน'
                                        : 'กรอกคำพิพากษา (เมื่อศาลมีคำตัดสิน)'
                                    }
                                  >
                                    {hasJudgmentRecorded ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>แก้คำพิพากษา (กรอกแล้ว)</span>
                                      </>
                                    ) : shouldAlertMissingJudgment(caseItem) ? (
                                      <>
                                        <Scale className="w-3.5 h-3.5" />
                                        <span>+ กรอกคำพิพากษา</span>
                                      </>
                                    ) : (
                                      <>
                                        <Scale className="w-3.5 h-3.5 text-slate-500" />
                                        <span>กรอกคำพิพากษา</span>
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
                                  title="เลือกหรือเปลี่ยนเวรชี้จากตารางเวรชี้ประจำเดือน"
                                >
                                  <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{caseItem.prosecutorName ? 'เปลี่ยนเวรชี้' : 'เลือกเวรชี้'}</span>
                                </button>
                                {onOpenSubmitToDuty && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenSubmitToDuty(caseItem)}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 ${
                                      caseItem.isSubmittedToDuty
                                        ? 'text-blue-950 bg-blue-100 hover:bg-blue-200 border border-blue-300 font-bold'
                                        : 'text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200'
                                    }`}
                                    title={
                                      caseItem.isSubmittedToDuty
                                        ? 'สำนวนนี้เสนอเวรชี้แล้ว - คลิกเพื่อแก้ไขข้อมูลเวรชี้หรือยกเลิก'
                                        : 'คลิกเพื่อเสนอเวรชี้ทันที (ไม่ต้องกรอกข้อมูล สำนวนยังคุมอุทธรณ์ตามปกติ)'
                                    }
                                  >
                                    <Send className="w-3.5 h-3.5 text-blue-600" />
                                    <span>{caseItem.isSubmittedToDuty ? '✓ เสนอเวรชี้แล้ว (แก้ไข)' : 'เสนอเวรชี้'}</span>
                                  </button>
                                )}
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

      {/* Duty Officer Picker Modal (เลือกเวรชี้จากตารางเวรชี้ประจำเดือน) */}
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
