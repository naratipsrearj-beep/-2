import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { AppealCase } from '../types/appeal';
import {
  formatThaiDate,
  formatThaiMonth,
  getCurrentMonthString,
  getTodayString,
} from './dateUtils';
import {
  isCaseConfessed,
  isCaseDenied,
  isCaseRequisition,
  isCaseTemporarilyDischarged,
  isJudgmentRecorded,
} from './appointmentUtils';
import {
  formatS1S4,
  formatBlackCaseNo,
  formatRedCaseNo,
  formatProsecutorName,
  formatDefendant,
  formatProcedureStatus,
  getProcedureStyleInfo,
  formatCompletedDate,
  ProcedureCategory,
} from './dailyExportUtils';

export type MonthlyPdfOrientation = 'landscape' | 'portrait';
export type MonthlyPdfReportMode = 'complete' | 'summary_only' | 'cases_only';
export type MonthlyPdfStatusFilter =
  | 'all'
  | 'confessed'
  | 'denied'
  | 'requisition'
  | 'completed'
  | 'in_progress';
export type MonthlyPdfSortBy =
  | 'filing_date_asc'
  | 'filing_date_desc'
  | 'prosecutor'
  | 'black_case_no';

export interface MonthlyPdfConfig {
  yearMonth: string; // YYYY-MM
  prosecutorFilter: string; // 'all' or prosecutor name
  statusFilter: MonthlyPdfStatusFilter;
  sortBy: MonthlyPdfSortBy;
  reportMode: MonthlyPdfReportMode;
  orientation: MonthlyPdfOrientation;
  officeName: string;
  reportTitle: string;
  documentRefNo: string;
  preparerName: string;
  preparerTitle: string;
  approverName: string;
  approverTitle: string;
  showGaruda: boolean;
  showKpiCards: boolean;
  showJudgmentColumn: boolean;
  showColorCoding: boolean;
  showSignatureBlock: boolean;
}

export interface MonthlyPdfProsecutorRow {
  prosecutorName: string;
  totalCases: number;
  confessedCases: number;
  deniedCases: number;
  requisitionCases: number;
  otherCases: number;
  judgedCases: number;
  completedCases: number;
  inProgressCases: number;
  submittedToDutyCases: number;
  temporarilyDischargedCases: number;
  confessedPercent: number;
  deniedPercent: number;
  completionPercent: number;
}

export interface MonthlyPdfCaseRow {
  index: number;
  id: string;
  filingDate: string;
  filingDateThai: string;
  s1s4: string;
  blackCaseNo: string;
  redCaseNo: string;
  prosecutorName: string;
  defendant: string;
  caseType: string;
  court: string;
  procedureText: string;
  procedureCategory: ProcedureCategory;
  procedureBgHex: string;
  procedureTextHex: string;
  judgmentDateThai: string;
  appealDeadlineThai: string;
  judgmentSummary: string;
  completedText: string;
  isCompleted: boolean;
  isSubmittedToDuty: boolean;
  isTemporarilyDischarged: boolean;
  estimatedRowWeight: number;
}

export interface MonthlyPdfReportData {
  yearMonth: string;
  monthLabel: string;
  monthLabelShort: string;
  generatedDateThai: string;
  totalCases: number;
  totalConfessed: number;
  totalDenied: number;
  totalRequisition: number;
  totalOther: number;
  totalJudged: number;
  totalCompleted: number;
  totalInProgress: number;
  totalSubmittedToDuty: number;
  totalTemporarilyDischarged: number;
  confessedPercent: number;
  deniedPercent: number;
  requisitionPercent: number;
  completionPercent: number;
  prosecutors: MonthlyPdfProsecutorRow[];
  caseRows: MonthlyPdfCaseRow[];
  allProsecutorsInMonth: string[];
}

export type MonthlyPdfPageBlock =
  | {
      type: 'summary';
      pageNumber: number;
      totalPages: number;
      isFirstSummaryPage: boolean;
      prosecutorRows: MonthlyPdfProsecutorRow[];
      startIndex: number;
      includeTotalRow: boolean;
      includeSignatureHere: boolean;
    }
  | {
      type: 'cases';
      pageNumber: number;
      totalPages: number;
      isFirstCasesPage: boolean;
      caseRows: MonthlyPdfCaseRow[];
      includeSignatureHere: boolean;
    };

const STORAGE_KEY = 'monthly_pdf_report_settings_v1';

export interface SavedMonthlyPdfMeta {
  officeName: string;
  reportTitle: string;
  documentRefNo: string;
  preparerName: string;
  preparerTitle: string;
  approverName: string;
  approverTitle: string;
}

export const DEFAULT_MONTHLY_PDF_META: SavedMonthlyPdfMeta = {
  officeName: 'สำนักงานอัยการจังหวัด',
  reportTitle: 'รายงานสรุปผลงานการดำเนินคดีและสำนวนคดีประจำเดือน',
  documentRefNo: '',
  preparerName: '',
  preparerTitle: 'เจ้าหน้าที่บริหารงานทั่วไป / ผู้จัดทำรายงาน',
  approverName: '',
  approverTitle: 'อัยการจังหวัด / หัวหน้าสำนักงาน',
};

export function loadSavedMonthlyPdfMeta(): SavedMonthlyPdfMeta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MONTHLY_PDF_META;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_MONTHLY_PDF_META,
      ...parsed,
    };
  } catch {
    return DEFAULT_MONTHLY_PDF_META;
  }
}

export function saveMonthlyPdfMeta(meta: SavedMonthlyPdfMeta): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // ignore storage quota errors
  }
}

export function getAvailableReportMonths(cases: AppealCase[]): string[] {
  const monthSet = new Set<string>();
  monthSet.add(getCurrentMonthString());
  cases.forEach((c) => {
    if (c.filingDate && c.filingDate.length >= 7) {
      const ym = c.filingDate.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        monthSet.add(ym);
      }
    }
  });
  return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
}

function getProsecutorDisplayName(c: AppealCase): string {
  const raw = c.responsiblePerson || c.prosecutorName;
  return raw && raw.trim() ? raw.trim() : 'ไม่ระบุอัยการเจ้าของสำนวน';
}

function matchesStatusFilter(c: AppealCase, filter: MonthlyPdfStatusFilter): boolean {
  switch (filter) {
    case 'confessed':
      return isCaseConfessed(c);
    case 'denied':
      return isCaseDenied(c);
    case 'requisition':
      return isCaseRequisition(c);
    case 'completed':
      return Boolean(c.isCompleted);
    case 'in_progress':
      return !c.isCompleted && !isCaseTemporarilyDischarged(c);
    case 'all':
    default:
      return true;
  }
}

function estimateCaseRowWeight(
  row: Omit<MonthlyPdfCaseRow, 'estimatedRowWeight'>,
  orientation: MonthlyPdfOrientation,
  showJudgmentColumn: boolean
): number {
  const defendantCharsPerLine = orientation === 'landscape' ? (showJudgmentColumn ? 24 : 32) : 16;
  const procedureCharsPerLine = orientation === 'landscape' ? (showJudgmentColumn ? 24 : 30) : 18;
  const judgmentCharsPerLine = orientation === 'landscape' ? 24 : 16;

  const defendantLines = Math.max(1, Math.ceil((row.defendant.length + 4) / defendantCharsPerLine));
  const procedureLines = Math.max(1, Math.ceil(row.procedureText.length / procedureCharsPerLine));
  const judgmentLines = showJudgmentColumn
    ? Math.max(
        1,
        Math.ceil((row.judgmentSummary.length + row.completedText.length) / judgmentCharsPerLine)
      )
    : 1;
  const s1s4Lines = row.s1s4.includes('/') ? 2 : 1;
  const caseNoLines = row.redCaseNo && row.redCaseNo !== 'ยังไม่มีเลขแดง' ? 2 : 1;

  const maxLines = Math.max(defendantLines, procedureLines, judgmentLines, s1s4Lines, caseNoLines);
  // Base row weight 1.0 (~28px), each extra wrapped line adds ~0.46 weight
  return 1 + (Math.min(maxLines, 5) - 1) * 0.46;
}

export function buildMonthlyPdfReportData(
  cases: AppealCase[],
  config: Pick<
    MonthlyPdfConfig,
    'yearMonth' | 'prosecutorFilter' | 'statusFilter' | 'sortBy' | 'orientation' | 'showJudgmentColumn'
  >
): MonthlyPdfReportData {
  const monthCases = cases.filter((c) => c.filingDate && c.filingDate.startsWith(config.yearMonth));

  const prosecutorSet = new Set<string>();
  monthCases.forEach((c) => prosecutorSet.add(getProsecutorDisplayName(c)));
  const allProsecutorsInMonth = Array.from(prosecutorSet).sort((a, b) => a.localeCompare(b, 'th'));

  // Apply prosecutor & status filters
  const filteredCases = monthCases.filter((c) => {
    if (config.prosecutorFilter !== 'all') {
      if (getProsecutorDisplayName(c) !== config.prosecutorFilter) {
        return false;
      }
    }
    return matchesStatusFilter(c, config.statusFilter);
  });

  // Sort detailed case list
  const sortedCases = [...filteredCases].sort((a, b) => {
    switch (config.sortBy) {
      case 'filing_date_asc': {
        const cmp = (a.filingDate || '').localeCompare(b.filingDate || '');
        if (cmp !== 0) return cmp;
        return (a.blackCaseNo || '').localeCompare(b.blackCaseNo || '', 'th');
      }
      case 'filing_date_desc': {
        const cmp = (b.filingDate || '').localeCompare(a.filingDate || '');
        if (cmp !== 0) return cmp;
        return (a.blackCaseNo || '').localeCompare(b.blackCaseNo || '', 'th');
      }
      case 'prosecutor': {
        const pCmp = getProsecutorDisplayName(a).localeCompare(getProsecutorDisplayName(b), 'th');
        if (pCmp !== 0) return pCmp;
        return (a.filingDate || '').localeCompare(b.filingDate || '');
      }
      case 'black_case_no':
        return (a.blackCaseNo || '').localeCompare(b.blackCaseNo || '', 'th');
      default:
        return 0;
    }
  });

  // Group by prosecutor
  const prosecutorMap = new Map<string, AppealCase[]>();
  sortedCases.forEach((c) => {
    const pName = getProsecutorDisplayName(c);
    if (!prosecutorMap.has(pName)) {
      prosecutorMap.set(pName, []);
    }
    prosecutorMap.get(pName)!.push(c);
  });

  let totalConfessed = 0;
  let totalDenied = 0;
  let totalRequisition = 0;
  let totalOther = 0;
  let totalJudged = 0;
  let totalCompleted = 0;
  let totalInProgress = 0;
  let totalSubmittedToDuty = 0;
  let totalTemporarilyDischarged = 0;

  const prosecutors: MonthlyPdfProsecutorRow[] = [];

  prosecutorMap.forEach((list, prosecutorName) => {
    let confessed = 0;
    let denied = 0;
    let requisition = 0;
    let other = 0;
    let judged = 0;
    let completed = 0;
    let inProgress = 0;
    let submittedToDuty = 0;
    let discharged = 0;

    list.forEach((c) => {
      if (isCaseConfessed(c)) confessed++;
      else if (isCaseDenied(c)) denied++;
      else if (isCaseRequisition(c)) requisition++;
      else other++;

      if (isJudgmentRecorded(c) || Boolean(c.hasJudgment && c.judgmentDate)) judged++;
      if (c.isCompleted) completed++;
      if (isCaseTemporarilyDischarged(c)) discharged++;
      if (!c.isCompleted && !isCaseTemporarilyDischarged(c)) inProgress++;
      if (c.isSubmittedToDuty) submittedToDuty++;
    });

    totalConfessed += confessed;
    totalDenied += denied;
    totalRequisition += requisition;
    totalOther += other;
    totalJudged += judged;
    totalCompleted += completed;
    totalInProgress += inProgress;
    totalSubmittedToDuty += submittedToDuty;
    totalTemporarilyDischarged += discharged;

    const total = list.length;
    prosecutors.push({
      prosecutorName,
      totalCases: total,
      confessedCases: confessed,
      deniedCases: denied,
      requisitionCases: requisition,
      otherCases: other,
      judgedCases: judged,
      completedCases: completed,
      inProgressCases: inProgress,
      submittedToDutyCases: submittedToDuty,
      temporarilyDischargedCases: discharged,
      confessedPercent: total > 0 ? Math.round((confessed / total) * 100) : 0,
      deniedPercent: total > 0 ? Math.round((denied / total) * 100) : 0,
      completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    });
  });

  prosecutors.sort((a, b) => {
    if (b.totalCases !== a.totalCases) return b.totalCases - a.totalCases;
    return a.prosecutorName.localeCompare(b.prosecutorName, 'th');
  });

  const caseRows: MonthlyPdfCaseRow[] = sortedCases.map((c, idx) => {
    const procedureText = isCaseTemporarilyDischarged(c)
      ? 'จำหน่ายคดีชั่วคราว (จำเลยหลบหนี)'
      : formatProcedureStatus(c, false, c.filingDate);
    const procStyle = getProcedureStyleInfo(c, procedureText);
    const judgmentDateThai = c.judgmentDate ? formatThaiDate(c.judgmentDate, { short: true }) : '-';
    const effectiveDeadline = c.extendedDeadline || c.appealDeadline;
    const appealDeadlineThai = effectiveDeadline
      ? formatThaiDate(effectiveDeadline, { short: true })
      : '-';

    const outcomeParts: string[] = [];
    if (c.judgmentOutcome && c.judgmentOutcome.trim() && c.judgmentOutcome.trim() !== '-') {
      const cleanOutcome = c.judgmentOutcome.trim();
      outcomeParts.push(cleanOutcome.length > 60 ? `${cleanOutcome.slice(0, 58)}…` : cleanOutcome);
    } else if (c.judgmentDate) {
      outcomeParts.push(`พิพากษา ${judgmentDateThai}`);
    }
    if (effectiveDeadline && !c.isCompleted && !isCaseTemporarilyDischarged(c)) {
      outcomeParts.push(`ครบอุทธรณ์ ${appealDeadlineThai}`);
    }

    const baseRow: Omit<MonthlyPdfCaseRow, 'estimatedRowWeight'> = {
      index: idx + 1,
      id: c.id,
      filingDate: c.filingDate,
      filingDateThai: formatThaiDate(c.filingDate, { short: true }),
      s1s4: formatS1S4(c),
      blackCaseNo: formatBlackCaseNo(c),
      redCaseNo: formatRedCaseNo(c),
      prosecutorName: formatProsecutorName(c),
      defendant: formatDefendant(c),
      caseType: c.caseType || 'คดีอาญา',
      court: c.court || '-',
      procedureText,
      procedureCategory: procStyle.category,
      procedureBgHex: isCaseTemporarilyDischarged(c) ? '#E2E8F0' : procStyle.hexBg,
      procedureTextHex: isCaseTemporarilyDischarged(c) ? '#334155' : procStyle.hexText,
      judgmentDateThai,
      appealDeadlineThai,
      judgmentSummary: outcomeParts.join(' · ') || '-',
      completedText: isCaseTemporarilyDischarged(c)
        ? 'พักการคุมอุทธรณ์'
        : formatCompletedDate(c, true),
      isCompleted: Boolean(c.isCompleted),
      isSubmittedToDuty: Boolean(c.isSubmittedToDuty),
      isTemporarilyDischarged: isCaseTemporarilyDischarged(c),
    };

    return {
      ...baseRow,
      estimatedRowWeight: estimateCaseRowWeight(baseRow, config.orientation, config.showJudgmentColumn),
    };
  });

  const totalCases = sortedCases.length;

  return {
    yearMonth: config.yearMonth,
    monthLabel: formatThaiMonth(config.yearMonth, { short: false }),
    monthLabelShort: formatThaiMonth(config.yearMonth, { short: true }),
    generatedDateThai: formatThaiDate(getTodayString(), { short: false }),
    totalCases,
    totalConfessed,
    totalDenied,
    totalRequisition,
    totalOther,
    totalJudged,
    totalCompleted,
    totalInProgress,
    totalSubmittedToDuty,
    totalTemporarilyDischarged,
    confessedPercent: totalCases > 0 ? Math.round((totalConfessed / totalCases) * 100) : 0,
    deniedPercent: totalCases > 0 ? Math.round((totalDenied / totalCases) * 100) : 0,
    requisitionPercent: totalCases > 0 ? Math.round((totalRequisition / totalCases) * 100) : 0,
    completionPercent: totalCases > 0 ? Math.round((totalCompleted / totalCases) * 100) : 0,
    prosecutors,
    caseRows,
    allProsecutorsInMonth,
  };
}

/**
 * แบ่งหน้าเอกสาร A4 อัตโนมัติ (Page-by-Page Pagination)
 * ป้องกันไม่ให้แถวตารางถูกตัดขาดครึ่งบรรทัดข้ามหน้า
 */
type DraftMonthlyPdfPageBlock =
  | Omit<Extract<MonthlyPdfPageBlock, { type: 'summary' }>, 'pageNumber' | 'totalPages'>
  | Omit<Extract<MonthlyPdfPageBlock, { type: 'cases' }>, 'pageNumber' | 'totalPages'>;

export function paginateMonthlyPdfReport(
  data: MonthlyPdfReportData,
  config: MonthlyPdfConfig
): MonthlyPdfPageBlock[] {
  const pages: DraftMonthlyPdfPageBlock[] = [];
  const isLandscape = config.orientation === 'landscape';

  const includeSummary = config.reportMode === 'complete' || config.reportMode === 'summary_only';
  const includeCases = config.reportMode === 'complete' || config.reportMode === 'cases_only';

  // 1. Summary Section Pages (ตารางสรุปผลงานรายอัยการ)
  if (includeSummary) {
    const headerBudgetOffset =
      (config.showGaruda ? 2 : 0) + (config.showKpiCards ? 3 : 0);
    const firstSummaryMaxRows = isLandscape
      ? Math.max(5, 11 - headerBudgetOffset)
      : Math.max(10, 21 - headerBudgetOffset);
    const contSummaryMaxRows = isLandscape ? 14 : 25;

    if (data.prosecutors.length === 0) {
      pages.push({
        type: 'summary',
        isFirstSummaryPage: true,
        prosecutorRows: [],
        startIndex: 0,
        includeTotalRow: false,
        includeSignatureHere: !includeCases && config.showSignatureBlock,
      });
    } else {
      let cursor = 0;
      let isFirst = true;
      while (cursor < data.prosecutors.length) {
        const capacity = isFirst ? firstSummaryMaxRows : contSummaryMaxRows;
        const remaining = data.prosecutors.length - cursor;
        const isLastSummaryChunk = remaining <= capacity;
        // Reserve room for signature block if this is the final page of the entire document
        const needsSignatureOnThisPage =
          isLastSummaryChunk && !includeCases && config.showSignatureBlock;
        const effectiveCapacity = needsSignatureOnThisPage
          ? Math.max(3, capacity - 3)
          : capacity;

        const slice = data.prosecutors.slice(cursor, cursor + effectiveCapacity);
        const reachedEnd = cursor + slice.length >= data.prosecutors.length;

        pages.push({
          type: 'summary',
          isFirstSummaryPage: isFirst,
          prosecutorRows: slice,
          startIndex: cursor,
          includeTotalRow: reachedEnd,
          includeSignatureHere: reachedEnd && !includeCases && config.showSignatureBlock,
        });

        cursor += slice.length;
        isFirst = false;
      }
    }
  }

  // 2. Detailed Monthly Case Register Pages (บัญชีรายละเอียดสำนวนคดี)
  if (includeCases) {
    // Budget units per page (1.0 unit ≈ 1 single-line table row)
    const firstPageBudget = includeSummary
      ? isLandscape
        ? 13.5
        : 22.5
      : isLandscape
      ? Math.max(7.5, 13.5 - (config.showGaruda ? 1.8 : 0) - (config.showKpiCards ? 2.4 : 0))
      : Math.max(12, 23 - (config.showGaruda ? 2.2 : 0) - (config.showKpiCards ? 3 : 0));

    const continuationBudget = isLandscape ? 14.5 : 24.0;
    const signatureCost = config.showSignatureBlock ? 3.2 : 0;

    if (data.caseRows.length === 0) {
      pages.push({
        type: 'cases',
        isFirstCasesPage: true,
        caseRows: [],
        includeSignatureHere: config.showSignatureBlock,
      });
    } else {
      let currentRows: MonthlyPdfCaseRow[] = [];
      let currentWeight = 0;
      let isFirst = true;
      let budget = firstPageBudget;

      for (let i = 0; i < data.caseRows.length; i++) {
        const row = data.caseRows[i];
        if (currentRows.length > 0 && currentWeight + row.estimatedRowWeight > budget) {
          pages.push({
            type: 'cases',
            isFirstCasesPage: isFirst,
            caseRows: currentRows,
            includeSignatureHere: false,
          });
          currentRows = [row];
          currentWeight = row.estimatedRowWeight;
          isFirst = false;
          budget = continuationBudget;
        } else {
          currentRows.push(row);
          currentWeight += row.estimatedRowWeight;
        }
      }

      if (currentRows.length > 0) {
        const fitsSignature = currentWeight + signatureCost <= budget;
        if (fitsSignature || !config.showSignatureBlock) {
          pages.push({
            type: 'cases',
            isFirstCasesPage: isFirst,
            caseRows: currentRows,
            includeSignatureHere: config.showSignatureBlock,
          });
        } else {
          // Move last 1–2 rows onto a clean final page together with signature block so signature isn't orphaned alone
          const moveCount = currentRows.length > 2 ? 2 : 0;
          if (moveCount > 0) {
            const head = currentRows.slice(0, currentRows.length - moveCount);
            const tail = currentRows.slice(currentRows.length - moveCount);
            pages.push({
              type: 'cases',
              isFirstCasesPage: isFirst,
              caseRows: head,
              includeSignatureHere: false,
            });
            pages.push({
              type: 'cases',
              isFirstCasesPage: false,
              caseRows: tail,
              includeSignatureHere: true,
            });
          } else {
            pages.push({
              type: 'cases',
              isFirstCasesPage: isFirst,
              caseRows: currentRows,
              includeSignatureHere: true,
            });
          }
        }
      }
    }
  }

  const totalPages = Math.max(1, pages.length);
  return pages.map((p, idx) => ({
    ...p,
    pageNumber: idx + 1,
    totalPages,
  })) as MonthlyPdfPageBlock[];
}

export function getStatusFilterLabel(filter: MonthlyPdfStatusFilter): string {
  switch (filter) {
    case 'confessed':
      return 'เฉพาะจำเลยรับสารภาพ';
    case 'denied':
      return 'เฉพาะจำเลยปฏิเสธ';
    case 'requisition':
      return 'เฉพาะสำนวนมีเบิกฟ้อง';
    case 'completed':
      return 'เฉพาะสำนวนเสร็จสิ้นแล้ว';
    case 'in_progress':
      return 'เฉพาะสำนวนอยู่ระหว่างดำเนินการ';
    case 'all':
    default:
      return 'สำนวนคดีทั้งหมด';
  }
}

export function buildPdfFileName(config: MonthlyPdfConfig): string {
  const [y, m] = config.yearMonth.split('-');
  const thaiYear = y ? String(Number(y) + 543) : '';
  const ymThai = thaiYear && m ? `${thaiYear}-${m}` : config.yearMonth;
  const prosecutorSuffix =
    config.prosecutorFilter !== 'all'
      ? `_${config.prosecutorFilter.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9._-]/g, '').slice(0, 24)}`
      : '';
  const modeSuffix =
    config.reportMode === 'summary_only'
      ? '_สรุปรายอัยการ'
      : config.reportMode === 'cases_only'
      ? '_บัญชีสำนวน'
      : '';
  return `รายงานผลงานอัยการประจำเดือน_${ymThai}${prosecutorSuffix}${modeSuffix}.pdf`;
}

/**
 * สร้างและดาวน์โหลดไฟล์ PDF จริงแบบหลายหน้า A4 ด้วยความละเอียดสูง
 * รองรับฟอนต์ภาษาไทย Sarabun / Prompt คมชัดไม่เพี้ยน และไม่ตัดแถวตารางขาดครึ่ง
 */
export async function exportPaginatedSheetsToPdf(
  pageElements: HTMLElement[],
  config: MonthlyPdfConfig,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  if (pageElements.length === 0) {
    throw new Error('ไม่พบหน้าเอกสารสำหรับสร้างไฟล์ PDF');
  }

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const isLandscape = config.orientation === 'landscape';
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidthMm = isLandscape ? 297 : 210;
  const pageHeightMm = isLandscape ? 210 : 297;

  for (let i = 0; i < pageElements.length; i++) {
    onProgress?.(i + 1, pageElements.length);
    const el = pageElements[i];

    // Yield briefly so UI progress bar paints smoothly
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: el.offsetWidth,
      height: el.offsetHeight,
      windowWidth: el.offsetWidth,
      windowHeight: el.offsetHeight,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.96);
    if (i > 0) {
      pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
    }
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');
  }

  const fileName = buildPdfFileName(config);
  pdf.save(fileName);
  return fileName;
}

/**
 * พิมพ์เอกสาร A4 แบบ Vector ผ่าน hidden iframe (ไม่ใช้ window.open และไม่กระทบหน้าหลัก)
 */
export function printPaginatedSheetsInIframe(
  containerEl: HTMLElement,
  config: MonthlyPdfConfig
): void {
  const isLandscape = config.orientation === 'landscape';
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  const fileNameTitle = buildPdfFileName(config).replace(/\.pdf$/i, '');
  const cloneHtml = containerEl.innerHTML;

  doc.open();
  doc.write(`<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>${fileNameTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Prompt:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4 ${isLandscape ? 'landscape' : 'portrait'};
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: 'Sarabun', 'Prompt', sans-serif;
      color: #0f172a;
    }
    .pdf-a4-sheet {
      width: ${isLandscape ? '297mm' : '210mm'} !important;
      height: ${isLandscape ? '210mm' : '297mm'} !important;
      margin: 0 !important;
      box-shadow: none !important;
      border: none !important;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .pdf-a4-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  </style>
</head>
<body>${cloneHtml}</body>
</html>`);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 2500);
    }
  };

  if (iframe.contentWindow) {
    iframe.onload = () => {
      const f = (iframe.contentDocument as Document & { fonts?: FontFaceSet })?.fonts;
      if (f && f.ready) {
        f.ready.then(() => setTimeout(triggerPrint, 250));
      } else {
        setTimeout(triggerPrint, 500);
      }
    };
  }
}
