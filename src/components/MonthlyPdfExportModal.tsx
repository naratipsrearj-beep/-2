import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  FileDown,
  Printer,
  Calendar,
  Users,
  Filter,
  ArrowUpDown,
  FileText,
  LayoutList,
  BookOpen,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiMonth } from '../utils/dateUtils';
import { GarudaEmblem } from './GarudaEmblem';
import {
  MonthlyPdfConfig,
  MonthlyPdfOrientation,
  MonthlyPdfReportMode,
  MonthlyPdfStatusFilter,
  MonthlyPdfSortBy,
  MonthlyPdfReportData,
  MonthlyPdfPageBlock,
  getAvailableReportMonths,
  loadSavedMonthlyPdfMeta,
  saveMonthlyPdfMeta,
  buildMonthlyPdfReportData,
  paginateMonthlyPdfReport,
  getStatusFilterLabel,
  buildPdfFileName,
  exportPaginatedSheetsToPdf,
  printPaginatedSheetsInIframe,
} from '../utils/monthlyPdfReportUtils';

interface MonthlyPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: AppealCase[];
  initialYearMonth?: string;
  initialProsecutor?: string;
  onToast?: (message: string) => void;
}

// Exact A4 pixel dimensions at 96 DPI (297mm x 210mm / 210mm x 297mm)
const A4_LANDSCAPE_W = 1123;
const A4_LANDSCAPE_H = 794;
const A4_PORTRAIT_W = 794;
const A4_PORTRAIT_H = 1123;

interface A4SheetRendererProps {
  page: MonthlyPdfPageBlock;
  data: MonthlyPdfReportData;
  config: MonthlyPdfConfig;
  sheetWidth: number;
  sheetHeight: number;
}

/**
 * เรนเดอร์เอกสารแต่ละหน้า A4 ด้วยสไตล์เอกสารราชการสมัยใหม่ คมชัด ใช้สี Hex ล้วน
 * เพื่อให้ทั้งภาพตัวอย่าง ไฟล์ PDF ที่ส่งออก และการพิมพ์กระดาษมีคุณภาพเหมือนกัน 100%
 */
const A4SheetRenderer: React.FC<A4SheetRendererProps> = ({
  page,
  data,
  config,
  sheetWidth,
  sheetHeight,
}) => {
  const isLandscape = config.orientation === 'landscape';
  const showFullHeader =
    (page.type === 'summary' && page.isFirstSummaryPage) ||
    (page.type === 'cases' && page.isFirstCasesPage && config.reportMode === 'cases_only');

  const scopeLabelParts: string[] = [`ประจำเดือน ${data.monthLabel}`];
  if (config.prosecutorFilter !== 'all') {
    scopeLabelParts.push(`อัยการเจ้าของสำนวน: ${config.prosecutorFilter}`);
  } else {
    scopeLabelParts.push(`อัยการเจ้าของสำนวนทั้งหมด (${data.prosecutors.length} ท่าน)`);
  }
  if (config.statusFilter !== 'all') {
    scopeLabelParts.push(getStatusFilterLabel(config.statusFilter));
  }

  return (
    <div
      className="pdf-a4-sheet"
      style={{
        width: `${sheetWidth}px`,
        height: `${sheetHeight}px`,
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        fontFamily: "'Sarabun', 'Prompt', sans-serif",
        padding: isLandscape ? '24px 28px 20px 28px' : '28px 30px 22px 30px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Full Official Header on Cover / First Page */}
        {showFullHeader ? (
          <div
            style={{
              borderBottom: '2px solid #0F172A',
              paddingBottom: '10px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                {config.showGaruda && (
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0F172A',
                    }}
                  >
                    <GarudaEmblem width={46} height={46} className="" />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155',
                      letterSpacing: '0.01em',
                      marginBottom: '2px',
                    }}
                  >
                    {config.officeName.trim() || 'สำนักงานอัยการจังหวัด'}
                    {config.documentRefNo.trim() ? ` · เลขที่อ้างอิง ${config.documentRefNo.trim()}` : ''}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Prompt', 'Sarabun', sans-serif",
                      fontSize: isLandscape ? '18px' : '16px',
                      fontWeight: 700,
                      color: '#0F172A',
                      lineHeight: 1.3,
                    }}
                  >
                    {config.reportTitle.trim() || 'รายงานสรุปผลงานการดำเนินคดีและสำนวนคดีประจำเดือน'}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#475569',
                      marginTop: '3px',
                    }}
                  >
                    {scopeLabelParts.join(' · ')}
                  </div>
                </div>
              </div>

              <div
                style={{
                  textAlign: 'right',
                  flexShrink: 0,
                  borderLeft: '1px solid #CBD5E1',
                  paddingLeft: '14px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748B',
                    fontWeight: 600,
                  }}
                >
                  รอบเดือนที่รายงาน
                </div>
                <div
                  style={{
                    fontFamily: "'Prompt', 'Sarabun', sans-serif",
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#0F172A',
                    marginTop: '1px',
                  }}
                >
                  {data.monthLabel}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  จัดพิมพ์เมื่อ {data.generatedDateThai}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Running Header on Continuation Pages */
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              borderBottom: '1.5px solid #334155',
              paddingBottom: '6px',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
              <span
                style={{
                  fontFamily: "'Prompt', 'Sarabun', sans-serif",
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#0F172A',
                }}
              >
                {page.type === 'summary'
                  ? 'ตารางสรุปผลงานแยกรายอัยการเจ้าของสำนวน (ต่อ)'
                  : page.isFirstCasesPage
                  ? 'ส่วนที่ 2: บัญชีรายละเอียดสำนวนคดีประจำเดือน'
                  : 'บัญชีรายละเอียดสำนวนคดีประจำเดือน (ต่อ)'}
              </span>
              <span style={{ fontSize: '11.5px', color: '#475569' }}>
                — {scopeLabelParts.join(' · ')}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {config.officeName.trim() || 'สำนักงานอัยการจังหวัด'}
            </div>
          </div>
        )}

        {/* Executive KPI Summary Strip (on Cover Page if enabled) */}
        {showFullHeader && config.showKpiCards && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isLandscape ? 'repeat(6, 1fr)' : 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            {[
              {
                label: 'คดีที่ฟ้องทั้งหมด',
                value: `${data.totalCases}`,
                sub: `อัยการ ${data.prosecutors.length} ท่าน`,
                bg: '#F8FAFC',
                border: '#CBD5E1',
                valColor: '#0F172A',
              },
              {
                label: 'จำเลยรับสารภาพ',
                value: `${data.totalConfessed}`,
                sub: `ร้อยละ ${data.confessedPercent}%`,
                bg: config.showColorCoding ? '#FEFCE8' : '#F8FAFC',
                border: config.showColorCoding ? '#FDE047' : '#CBD5E1',
                valColor: config.showColorCoding ? '#854D0E' : '#0F172A',
              },
              {
                label: 'จำเลยปฏิเสธ',
                value: `${data.totalDenied}`,
                sub: `ร้อยละ ${data.deniedPercent}%`,
                bg: config.showColorCoding ? '#FFF7ED' : '#F8FAFC',
                border: config.showColorCoding ? '#FDBA74' : '#CBD5E1',
                valColor: config.showColorCoding ? '#9A3412' : '#0F172A',
              },
              {
                label: 'สำนวนมีเบิกฟ้อง',
                value: `${data.totalRequisition}`,
                sub: `ร้อยละ ${data.requisitionPercent}%`,
                bg: config.showColorCoding ? '#ECFDF5' : '#F8FAFC',
                border: config.showColorCoding ? '#6EE7B7' : '#CBD5E1',
                valColor: config.showColorCoding ? '#065F46' : '#0F172A',
              },
              {
                label: 'มีคำพิพากษาแล้ว',
                value: `${data.totalJudged}`,
                sub: `เสนอเวรชี้ ${data.totalSubmittedToDuty} สำนวน`,
                bg: '#F8FAFC',
                border: '#CBD5E1',
                valColor: '#1E3A8A',
              },
              {
                label: 'เสร็จสิ้นสำนวนแล้ว',
                value: `${data.totalCompleted}`,
                sub: `คืบหน้าร้อยละ ${data.completionPercent}%`,
                bg: '#F8FAFC',
                border: '#CBD5E1',
                valColor: '#047857',
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  backgroundColor: kpi.bg,
                  border: `1px solid ${kpi.border}`,
                  borderRadius: '6px',
                  padding: '7px 10px',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569' }}>
                  {kpi.label}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginTop: '2px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Prompt', 'Sarabun', sans-serif",
                      fontSize: '18px',
                      fontWeight: 700,
                      color: kpi.valColor,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1.15,
                    }}
                  >
                    {kpi.value}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#475569',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {kpi.sub}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TABLE 1: Prosecutor Performance Summary Table */}
        {page.type === 'summary' && (
          <div>
            {page.isFirstSummaryPage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Prompt', 'Sarabun', sans-serif",
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0F172A',
                  }}
                >
                  {config.reportMode === 'complete'
                    ? 'ส่วนที่ 1: ตารางสรุปผลงานการดำเนินคดีแยกรายอัยการเจ้าของสำนวน'
                    : 'ตารางสรุปผลงานการดำเนินคดีแยกรายอัยการเจ้าของสำนวน'}
                </div>
                <div style={{ fontSize: '11px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                  เรียงตามปริมาณสำนวนคดี (ทั้งหมด {data.prosecutors.length} ท่าน · {data.totalCases} สำนวน)
                </div>
              </div>
            )}

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: isLandscape ? '11.5px' : '11px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                  <th style={{ border: '1px solid #334155', padding: '7px 6px', textAlign: 'center', width: '42px', fontWeight: 700 }}>
                    ลำดับ
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '7px 10px', textAlign: 'left', fontWeight: 700 }}>
                    อัยการเจ้าของสำนวน
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '7px 6px', textAlign: 'center', width: '74px', fontWeight: 700 }}>
                    ฟ้องรวม
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '7px 6px', textAlign: 'center', width: '74px', fontWeight: 700 }}>
                    รับสารภาพ
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '7px 6px', textAlign: 'center', width: '68px', fontWeight: 700 }}>
                    ปฏิเสธ
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '7px 6px', textAlign: 'center', width: '68px', fontWeight: 700 }}>
                    เบิกฟ้อง
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '7px 6px', textAlign: 'center', width: '64px', fontWeight: 700 }}>
                    นัดอื่นๆ
                  </th>
                  {isLandscape && (
                    <th style={{ border: '1px solid #334155', padding: '7px 6px', textAlign: 'center', width: '76px', fontWeight: 700 }}>
                      มีคำพิพากษา
                    </th>
                  )}
                  <th style={{ border: '1px solid #334155', padding: '7px 6px', textAlign: 'center', width: '72px', fontWeight: 700 }}>
                    เสร็จสิ้น
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '7px 6px', textAlign: 'center', width: '74px', fontWeight: 700 }}>
                    ดำเนินการ
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '7px 6px', textAlign: 'center', width: '82px', fontWeight: 700 }}>
                    % รับสารภาพ
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.prosecutorRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isLandscape ? 11 : 10}
                      style={{
                        border: '1px solid #CBD5E1',
                        padding: '28px 12px',
                        textAlign: 'center',
                        color: '#64748B',
                      }}
                    >
                      ไม่พบข้อมูลสำนวนคดีในเงื่อนไขที่เลือกสำหรับเดือน {data.monthLabel}
                    </td>
                  </tr>
                ) : (
                  page.prosecutorRows.map((p, i) => {
                    const rowNum = page.startIndex + i + 1;
                    const rowBg = i % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
                    return (
                      <tr key={p.prosecutorName} style={{ backgroundColor: rowBg }}>
                        <td style={{ border: '1px solid #CBD5E1', padding: '6px', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
                          {rowNum}
                        </td>
                        <td style={{ border: '1px solid #CBD5E1', padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>
                          {p.prosecutorName}
                        </td>
                        <td style={{ border: '1px solid #CBD5E1', padding: '6px', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>
                          {p.totalCases}
                        </td>
                        <td
                          style={{
                            border: '1px solid #CBD5E1',
                            padding: '6px',
                            textAlign: 'center',
                            fontWeight: p.confessedCases > 0 ? 700 : 400,
                            backgroundColor:
                              config.showColorCoding && p.confessedCases > 0 ? '#FEF9C3' : rowBg,
                            color:
                              config.showColorCoding && p.confessedCases > 0 ? '#713F12' : '#475569',
                          }}
                        >
                          {p.confessedCases > 0 ? p.confessedCases : '-'}
                        </td>
                        <td
                          style={{
                            border: '1px solid #CBD5E1',
                            padding: '6px',
                            textAlign: 'center',
                            fontWeight: p.deniedCases > 0 ? 700 : 400,
                            backgroundColor:
                              config.showColorCoding && p.deniedCases > 0 ? '#FFEDD5' : rowBg,
                            color:
                              config.showColorCoding && p.deniedCases > 0 ? '#9A3412' : '#475569',
                          }}
                        >
                          {p.deniedCases > 0 ? p.deniedCases : '-'}
                        </td>
                        <td
                          style={{
                            border: '1px solid #CBD5E1',
                            padding: '6px',
                            textAlign: 'center',
                            fontWeight: p.requisitionCases > 0 ? 700 : 400,
                            backgroundColor:
                              config.showColorCoding && p.requisitionCases > 0 ? '#D1FAE5' : rowBg,
                            color:
                              config.showColorCoding && p.requisitionCases > 0 ? '#065F46' : '#475569',
                          }}
                        >
                          {p.requisitionCases > 0 ? p.requisitionCases : '-'}
                        </td>
                        <td style={{ border: '1px solid #CBD5E1', padding: '6px', textAlign: 'center', color: '#475569' }}>
                          {p.otherCases > 0 ? p.otherCases : '-'}
                        </td>
                        {isLandscape && (
                          <td style={{ border: '1px solid #CBD5E1', padding: '6px', textAlign: 'center', color: '#1E3A8A', fontWeight: 600 }}>
                            {p.judgedCases > 0 ? p.judgedCases : '-'}
                          </td>
                        )}
                        <td style={{ border: '1px solid #CBD5E1', padding: '6px', textAlign: 'center', color: '#047857', fontWeight: 700 }}>
                          {p.completedCases > 0 ? p.completedCases : '-'}
                        </td>
                        <td style={{ border: '1px solid #CBD5E1', padding: '6px', textAlign: 'center', color: '#334155' }}>
                          {p.inProgressCases > 0 ? p.inProgressCases : '-'}
                        </td>
                        <td style={{ border: '1px solid #CBD5E1', padding: '6px', textAlign: 'center', fontWeight: 600, color: '#0F172A' }}>
                          {p.confessedPercent}%
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Grand Total Row */}
                {page.includeTotalRow && data.prosecutors.length > 0 && (
                  <tr style={{ backgroundColor: '#E2E8F0', fontWeight: 700, color: '#0F172A' }}>
                    <td
                      colSpan={2}
                      style={{
                        border: '1px solid #94A3B8',
                        padding: '7px 10px',
                        textAlign: 'center',
                        fontWeight: 700,
                      }}
                    >
                      รวมทั้งสิ้น ({data.prosecutors.length} ท่าน)
                    </td>
                    <td style={{ border: '1px solid #94A3B8', padding: '7px 6px', textAlign: 'center', fontWeight: 700 }}>
                      {data.totalCases}
                    </td>
                    <td
                      style={{
                        border: '1px solid #94A3B8',
                        padding: '7px 6px',
                        textAlign: 'center',
                        fontWeight: 700,
                        backgroundColor: config.showColorCoding ? '#FEF08A' : '#E2E8F0',
                        color: config.showColorCoding ? '#713F12' : '#0F172A',
                      }}
                    >
                      {data.totalConfessed}
                    </td>
                    <td
                      style={{
                        border: '1px solid #94A3B8',
                        padding: '7px 6px',
                        textAlign: 'center',
                        fontWeight: 700,
                        backgroundColor: config.showColorCoding ? '#FED7AA' : '#E2E8F0',
                        color: config.showColorCoding ? '#7C2D12' : '#0F172A',
                      }}
                    >
                      {data.totalDenied}
                    </td>
                    <td
                      style={{
                        border: '1px solid #94A3B8',
                        padding: '7px 6px',
                        textAlign: 'center',
                        fontWeight: 700,
                        backgroundColor: config.showColorCoding ? '#A7F3D0' : '#E2E8F0',
                        color: config.showColorCoding ? '#064E3B' : '#0F172A',
                      }}
                    >
                      {data.totalRequisition}
                    </td>
                    <td style={{ border: '1px solid #94A3B8', padding: '7px 6px', textAlign: 'center' }}>
                      {data.totalOther}
                    </td>
                    {isLandscape && (
                      <td style={{ border: '1px solid #94A3B8', padding: '7px 6px', textAlign: 'center', color: '#1E3A8A' }}>
                        {data.totalJudged}
                      </td>
                    )}
                    <td style={{ border: '1px solid #94A3B8', padding: '7px 6px', textAlign: 'center', color: '#047857' }}>
                      {data.totalCompleted}
                    </td>
                    <td style={{ border: '1px solid #94A3B8', padding: '7px 6px', textAlign: 'center' }}>
                      {data.totalInProgress}
                    </td>
                    <td style={{ border: '1px solid #94A3B8', padding: '7px 6px', textAlign: 'center' }}>
                      {data.confessedPercent}%
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Summary Legend / Footnote */}
            {page.includeTotalRow && data.totalCases > 0 && (
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '10.5px',
                  color: '#475569',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  หมายเหตุ: จำนวนสำนวนนับตามวันที่ยื่นฟ้องในรอบเดือน {data.monthLabel}
                  {data.totalTemporarilyDischarged > 0
                    ? ` (รวมสำนวนจำหน่ายคดีชั่วคราว ${data.totalTemporarilyDischarged} สำนวน)`
                    : ''}
                </div>
                <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                  สัดส่วนภาพรวม: รับสารภาพ {data.confessedPercent}% · ปฏิเสธ {data.deniedPercent}% · เสร็จสิ้นแล้ว {data.completionPercent}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* TABLE 2: Detailed Monthly Case Register Table */}
        {page.type === 'cases' && (
          <div>
            {page.isFirstCasesPage && showFullHeader && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Prompt', 'Sarabun', sans-serif",
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0F172A',
                  }}
                >
                  บัญชีรายละเอียดสำนวนคดีประจำเดือน {data.monthLabel}
                </div>
                <div style={{ fontSize: '11px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                  จำนวนทั้งหมด {data.totalCases} สำนวน
                </div>
              </div>
            )}

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: isLandscape ? '10.5px' : '9.8px',
                lineHeight: 1.35,
                fontVariantNumeric: 'tabular-nums',
                tableLayout: 'fixed',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}>
                  <th style={{ border: '1px solid #334155', padding: '6px 4px', textAlign: 'center', width: '34px', fontWeight: 700 }}>
                    ลำดับ
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '6px 5px', textAlign: 'center', width: isLandscape ? '76px' : '64px', fontWeight: 700 }}>
                    วันที่ฟ้อง
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '6px 5px', textAlign: 'center', width: isLandscape ? '102px' : '80px', fontWeight: 700 }}>
                    เลข ส.1 / ส.4
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '6px 6px', textAlign: 'left', width: isLandscape ? '112px' : '92px', fontWeight: 700 }}>
                    เลขคดีดำ / แดง
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '6px 6px', textAlign: 'left', width: isLandscape ? '130px' : '98px', fontWeight: 700 }}>
                    อัยการเจ้าของสำนวน
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '6px 6px', textAlign: 'left', fontWeight: 700 }}>
                    จำเลย / ศาล
                  </th>
                  <th style={{ border: '1px solid #334155', padding: '6px 6px', textAlign: 'left', width: isLandscape ? '195px' : '130px', fontWeight: 700 }}>
                    คำให้การ / การดำเนินการ
                  </th>
                  {config.showJudgmentColumn && (
                    <th style={{ border: '1px solid #334155', padding: '6px 6px', textAlign: 'left', width: isLandscape ? '195px' : '125px', fontWeight: 700 }}>
                      คำพิพากษา / สถานะเสร็จสิ้น
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {page.caseRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={config.showJudgmentColumn ? 8 : 7}
                      style={{
                        border: '1px solid #CBD5E1',
                        padding: '28px 12px',
                        textAlign: 'center',
                        color: '#64748B',
                      }}
                    >
                      ไม่พบรายการสำนวนคดีในเดือน {data.monthLabel} ตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  page.caseRows.map((row, idx) => {
                    const rowBg = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
                    return (
                      <tr key={row.id} style={{ backgroundColor: rowBg }}>
                        <td style={{ border: '1px solid #CBD5E1', padding: '5px 4px', textAlign: 'center', color: '#475569', fontWeight: 600, verticalAlign: 'top' }}>
                          {row.index}
                        </td>
                        <td style={{ border: '1px solid #CBD5E1', padding: '5px 4px', textAlign: 'center', color: '#0F172A', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          {row.filingDateThai}
                        </td>
                        <td style={{ border: '1px solid #CBD5E1', padding: '5px 5px', textAlign: 'center', color: '#1E3A8A', verticalAlign: 'top', wordBreak: 'break-word' }}>
                          {row.s1s4}
                        </td>
                        <td style={{ border: '1px solid #CBD5E1', padding: '5px 6px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A' }}>{row.blackCaseNo}</div>
                          {row.redCaseNo && row.redCaseNo !== 'ยังไม่มีเลขแดง' && row.redCaseNo !== '-' && (
                            <div style={{ color: '#B91C1C', fontWeight: 600, fontSize: isLandscape ? '10px' : '9.2px' }}>
                              แดง {row.redCaseNo}
                            </div>
                          )}
                        </td>
                        <td style={{ border: '1px solid #CBD5E1', padding: '5px 6px', fontWeight: 600, color: '#0F172A', verticalAlign: 'top', wordBreak: 'break-word' }}>
                          {row.prosecutorName}
                        </td>
                        <td style={{ border: '1px solid #CBD5E1', padding: '5px 6px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{row.defendant}</div>
                          <div style={{ fontSize: isLandscape ? '9.5px' : '8.8px', color: '#64748B' }}>
                            {row.court} · {row.caseType}
                          </div>
                        </td>
                        <td
                          style={{
                            border: '1px solid #CBD5E1',
                            padding: '5px 6px',
                            verticalAlign: 'top',
                            wordBreak: 'break-word',
                            backgroundColor: config.showColorCoding ? row.procedureBgHex : rowBg,
                            color: config.showColorCoding ? row.procedureTextHex : '#0F172A',
                            fontWeight: 600,
                          }}
                        >
                          {row.procedureText}
                        </td>
                        {config.showJudgmentColumn && (
                          <td style={{ border: '1px solid #CBD5E1', padding: '5px 6px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                            <div
                              style={{
                                fontWeight: 700,
                                color: row.isCompleted
                                  ? '#047857'
                                  : row.isTemporarilyDischarged
                                  ? '#475569'
                                  : '#334155',
                              }}
                            >
                              {row.completedText}
                              {row.isSubmittedToDuty && !row.isCompleted ? ' (เสนอเวรชี้แล้ว)' : ''}
                            </div>
                            {row.judgmentSummary !== '-' && (
                              <div style={{ fontSize: isLandscape ? '9.5px' : '8.8px', color: '#475569', marginTop: '1px' }}>
                                {row.judgmentSummary}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Signature Block on Final Page */}
        {page.includeSignatureHere && (
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '18px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '48px',
            }}
          >
            <div style={{ textAlign: 'center', fontSize: '11.5px', color: '#0F172A' }}>
              <div style={{ marginBottom: '26px', color: '#334155' }}>ขอรับรองว่าข้อมูลข้างต้นถูกต้องตรงตามสารบบคดี</div>
              <div style={{ width: '210px', borderBottom: '1px dotted #64748B', margin: '0 auto 5px auto' }} />
              <div style={{ fontWeight: 600 }}>
                ({config.preparerName.trim() || '......................................................'})
              </div>
              <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '2px' }}>
                {config.preparerTitle.trim() || 'ผู้จัดทำรายงานสรุปประจำเดือน'}
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '11.5px', color: '#0F172A' }}>
              <div style={{ marginBottom: '26px', color: '#334155' }}>ทราบ / ตรวจรับรายงานผลงานประจำเดือน</div>
              <div style={{ width: '210px', borderBottom: '1px dotted #64748B', margin: '0 auto 5px auto' }} />
              <div style={{ fontWeight: 600 }}>
                ({config.approverName.trim() || '......................................................'})
              </div>
              <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '2px' }}>
                {config.approverTitle.trim() || 'อัยการจังหวัด / หัวหน้าสำนักงาน'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Consistent Running Footer */}
      <div
        style={{
          borderTop: '1px solid #CBD5E1',
          paddingTop: '6px',
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#64748B',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div>
          {config.officeName.trim() || 'สำนักงานอัยการจังหวัด'} · รายงานผลงานอัยการประจำเดือน {data.monthLabel}
        </div>
        <div>
          หน้า {page.pageNumber} / {page.totalPages}
        </div>
      </div>
    </div>
  );
};

export const MonthlyPdfExportModal: React.FC<MonthlyPdfExportModalProps> = ({
  isOpen,
  onClose,
  cases,
  initialYearMonth,
  initialProsecutor,
  onToast,
}) => {
  const availableMonths = useMemo(() => getAvailableReportMonths(cases), [cases]);

  const [config, setConfig] = useState<MonthlyPdfConfig>(() => {
    const saved = loadSavedMonthlyPdfMeta();
    return {
      yearMonth:
        initialYearMonth && availableMonths.includes(initialYearMonth)
          ? initialYearMonth
          : availableMonths[0] || '2026-11',
      prosecutorFilter: initialProsecutor || 'all',
      statusFilter: 'all',
      sortBy: 'filing_date_asc',
      reportMode: 'complete',
      orientation: 'landscape',
      officeName: saved.officeName,
      reportTitle: saved.reportTitle,
      documentRefNo: saved.documentRefNo,
      preparerName: saved.preparerName,
      preparerTitle: saved.preparerTitle,
      approverName: saved.approverName,
      approverTitle: saved.approverTitle,
      showGaruda: true,
      showKpiCards: true,
      showJudgmentColumn: true,
      showColorCoding: true,
      showSignatureBlock: true,
    };
  });

  // Sync initial month/prosecutor whenever modal opens with new context
  useEffect(() => {
    if (!isOpen) return;
    setConfig((prev) => ({
      ...prev,
      yearMonth:
        initialYearMonth && availableMonths.includes(initialYearMonth)
          ? initialYearMonth
          : prev.yearMonth || availableMonths[0] || '2026-11',
      prosecutorFilter: initialProsecutor || 'all',
    }));
  }, [isOpen, initialYearMonth, initialProsecutor, availableMonths]);

  // Persist office & signer details for future months
  useEffect(() => {
    saveMonthlyPdfMeta({
      officeName: config.officeName,
      reportTitle: config.reportTitle,
      documentRefNo: config.documentRefNo,
      preparerName: config.preparerName,
      preparerTitle: config.preparerTitle,
      approverName: config.approverName,
      approverTitle: config.approverTitle,
    });
  }, [
    config.officeName,
    config.reportTitle,
    config.documentRefNo,
    config.preparerName,
    config.preparerTitle,
    config.approverName,
    config.approverTitle,
  ]);

  const [showOrgSettings, setShowOrgSettings] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<'fit' | number>('fit');
  const [previewContainerWidth, setPreviewContainerWidth] = useState(860);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccessFile, setExportSuccessFile] = useState<string | null>(null);

  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const captureContainerRef = useRef<HTMLDivElement | null>(null);

  // Measure preview viewport width for responsive "fit" zoom
  useEffect(() => {
    if (!isOpen) return;
    const node = previewScrollRef.current;
    if (!node) return;
    const updateWidth = () => {
      setPreviewContainerWidth(Math.max(320, node.clientWidth - 48));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOpen]);

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, isExporting, onClose]);

  const reportData = useMemo(
    () =>
      buildMonthlyPdfReportData(cases, {
        yearMonth: config.yearMonth,
        prosecutorFilter: config.prosecutorFilter,
        statusFilter: config.statusFilter,
        sortBy: config.sortBy,
        orientation: config.orientation,
        showJudgmentColumn: config.showJudgmentColumn,
      }),
    [
      cases,
      config.yearMonth,
      config.prosecutorFilter,
      config.statusFilter,
      config.sortBy,
      config.orientation,
      config.showJudgmentColumn,
    ]
  );

  // Reset prosecutor filter if chosen prosecutor has no cases in newly chosen month
  useEffect(() => {
    if (
      config.prosecutorFilter !== 'all' &&
      !reportData.allProsecutorsInMonth.includes(config.prosecutorFilter)
    ) {
      setConfig((prev) => ({ ...prev, prosecutorFilter: 'all' }));
    }
  }, [config.prosecutorFilter, reportData.allProsecutorsInMonth]);

  const pages = useMemo(
    () => paginateMonthlyPdfReport(reportData, config),
    [reportData, config]
  );

  const sheetWidth = config.orientation === 'landscape' ? A4_LANDSCAPE_W : A4_PORTRAIT_W;
  const sheetHeight = config.orientation === 'landscape' ? A4_LANDSCAPE_H : A4_PORTRAIT_H;

  const computedScale = useMemo(() => {
    if (previewZoom === 'fit') {
      return Math.min(1, Math.max(0.35, previewContainerWidth / sheetWidth));
    }
    return previewZoom;
  }, [previewZoom, previewContainerWidth, sheetWidth]);

  const fileNamePreview = useMemo(() => buildPdfFileName(config), [config]);

  const handleDownloadPdf = async () => {
    if (reportData.totalCases === 0) return;
    setExportError(null);
    setExportSuccessFile(null);
    setIsExporting(true);
    setExportProgress({ current: 0, total: pages.length });

    try {
      // Wait for off-screen unscaled capture sheets to mount cleanly
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const container = captureContainerRef.current;
      if (!container) {
        throw new Error('ไม่สามารถเตรียมหน้าเอกสารสำหรับสร้างไฟล์ PDF ได้');
      }
      const sheetNodes = Array.from(
        container.querySelectorAll<HTMLElement>('.pdf-a4-sheet')
      );
      const savedName = await exportPaginatedSheetsToPdf(sheetNodes, config, (current, total) => {
        setExportProgress({ current, total });
      });
      setExportSuccessFile(savedName);
      onToast?.(`ส่งออกไฟล์ PDF "${savedName}" (${pages.length} หน้า A4) เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('PDF export failed:', err);
      setExportError(
        err instanceof Error
          ? err.message
          : 'เกิดข้อผิดพลาดระหว่างสร้างไฟล์ PDF โปรดลองใหม่อีกครั้งหรือใช้ปุ่มพิมพ์ A4'
      );
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handlePrintA4 = () => {
    if (reportData.totalCases === 0) return;
    // Render using a temporary container cloned from unscaled specs or directly render offscreen
    setExportError(null);
    setIsExporting(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const container = captureContainerRef.current;
          if (container) {
            printPaginatedSheetsInIframe(container, config);
          }
        } finally {
          setIsExporting(false);
        }
      });
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="monthly-pdf-export-title"
    >
      <div className="bg-white rounded-2xl w-full max-w-[1400px] h-[94vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        {/* Top Bar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <h2
              id="monthly-pdf-export-title"
              className="text-base sm:text-lg font-bold font-['Prompt'] tracking-tight text-white truncate"
            >
              ส่งออกรายงานผลงานอัยการประจำเดือน (PDF)
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5 flex-wrap tabular-nums">
              <span>เดือน {reportData.monthLabel}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{reportData.totalCases} สำนวน</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>อัยการ {reportData.prosecutors.length} ท่าน</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>
                {pages.length} หน้า ({config.orientation === 'landscape' ? 'A4 แนวนอน' : 'A4 แนวตั้ง'})
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-40 shrink-0"
            aria-label="ปิดหน้าต่างส่งออก PDF"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 2-Column Workspace: Left Controls Rail + Right Live A4 Preview */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left Configuration Rail */}
          <aside className="w-full lg:w-[375px] xl:w-[395px] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col min-h-0 shrink-0 max-h-[45vh] lg:max-h-none">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* Section 1: Data Scope */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-900 font-['Prompt'] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <span>1. เลือกรอบเดือนและขอบเขตข้อมูล</span>
                </div>

                {/* Month Picker */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    รอบเดือนที่รายงาน
                  </label>
                  <select
                    value={config.yearMonth}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        yearMonth: e.target.value,
                        prosecutorFilter: 'all',
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    {availableMonths.map((ym) => (
                      <option key={ym} value={ym}>
                        {formatThaiMonth(ym, { short: false })} ({ym})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Prosecutor Picker */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>อัยการเจ้าของสำนวน</span>
                  </label>
                  <select
                    value={config.prosecutorFilter}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, prosecutorFilter: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value="all">
                      อัยการทุกท่านในเดือนนี้ ({reportData.allProsecutorsInMonth.length} ท่าน)
                    </option>
                    {reportData.allProsecutorsInMonth.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter & Sort */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-slate-500" />
                      <span>สถานะสำนวน</span>
                    </label>
                    <select
                      value={config.statusFilter}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          statusFilter: e.target.value as MonthlyPdfStatusFilter,
                        }))
                      }
                      className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                    >
                      <option value="all">ทั้งหมด</option>
                      <option value="confessed">จำเลยรับสารภาพ</option>
                      <option value="denied">จำเลยปฏิเสธ</option>
                      <option value="requisition">สำนวนมีเบิกฟ้อง</option>
                      <option value="completed">เสร็จสิ้นแล้ว</option>
                      <option value="in_progress">กำลังดำเนินการ</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 flex items-center gap-1">
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                      <span>เรียงลำดับตาราง</span>
                    </label>
                    <select
                      value={config.sortBy}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          sortBy: e.target.value as MonthlyPdfSortBy,
                        }))
                      }
                      className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                    >
                      <option value="filing_date_asc">วันที่ฟ้อง (เก่า → ใหม่)</option>
                      <option value="filing_date_desc">วันที่ฟ้อง (ใหม่ → เก่า)</option>
                      <option value="prosecutor">ตามชื่ออัยการ (ก → ฮ)</option>
                      <option value="black_case_no">ตามเลขคดีดำ</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200" />

              {/* Section 2: Report Mode & Paper Orientation */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-900 font-['Prompt'] flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-slate-600" />
                  <span>2. รูปแบบรายงานและหน้ากระดาษ</span>
                </div>

                {/* Report Mode Selector */}
                <div className="space-y-1.5">
                  {[
                    {
                      id: 'complete' as MonthlyPdfReportMode,
                      title: 'รายงานฉบับสมบูรณ์ (แนะนำ)',
                      desc: 'ตารางสรุปผลงานรายอัยการ + บัญชีรายละเอียดสำนวนทั้งหมด',
                      icon: BookOpen,
                    },
                    {
                      id: 'summary_only' as MonthlyPdfReportMode,
                      title: 'สรุปผลงานแยกรายอัยการ',
                      desc: 'เฉพาะสถิติรวมและตารางยอดรับสารภาพ/ปฏิเสธ/เสร็จสิ้นรายคน',
                      icon: FileText,
                    },
                    {
                      id: 'cases_only' as MonthlyPdfReportMode,
                      title: 'บัญชีรายละเอียดสำนวนรายเดือน',
                      desc: 'แสดงตารางรายการสำนวนคดีทุกเรื่องพร้อมเลข ส.1/ส.4 และผลคดี',
                      icon: LayoutList,
                    },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const active = config.reportMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, reportMode: mode.id }))}
                        className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2.5 cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            active ? 'text-amber-400' : 'text-slate-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-snug">{mode.title}</div>
                          <div
                            className={`text-[11px] leading-snug mt-0.5 ${
                              active ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {mode.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Paper Orientation Segmented Control */}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-700">แนวกระดาษ A4</div>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        { id: 'landscape', label: 'A4 แนวนอน (แนะนำ)' },
                        { id: 'portrait', label: 'A4 แนวตั้ง' },
                      ] as { id: MonthlyPdfOrientation; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, orientation: opt.id }))}
                        className={`py-1.5 px-2.5 text-xs font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                          config.orientation === opt.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Element Toggles */}
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-medium text-slate-700">องค์ประกอบในเอกสาร</div>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    {[
                      { key: 'showGaruda' as const, label: 'แสดงตราครุฑส่วนหัวเอกสาร' },
                      { key: 'showKpiCards' as const, label: 'แสดงแถบสรุปสถิติผลงานรวมหน้าแรก' },
                      {
                        key: 'showJudgmentColumn' as const,
                        label: 'แสดงคอลัมน์คำพิพากษาและสถานะเสร็จสิ้น',
                      },
                      {
                        key: 'showColorCoding' as const,
                        label: 'ไฮไลต์สีแยกประเภทคำให้การ (เหลือง/ส้ม/เขียว)',
                      },
                      {
                        key: 'showSignatureBlock' as const,
                        label: 'แสดงช่องลงนามผู้จัดทำและหัวหน้าหน่วยงานท้ายรายงาน',
                      },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center gap-2 cursor-pointer select-none py-0.5 hover:text-slate-950"
                      >
                        <input
                          type="checkbox"
                          checked={config[item.key]}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, [item.key]: e.target.checked }))
                          }
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200" />

              {/* Section 3: Collapsible Organization & Signer Fields */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowOrgSettings((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-900 font-['Prompt'] py-1 cursor-pointer hover:text-slate-700"
                >
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-600" />
                    <span>3. ข้อมูลหน่วยงานและผู้ลงนาม</span>
                  </span>
                  {showOrgSettings ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {showOrgSettings && (
                  <div className="mt-3 space-y-2.5 text-xs">
                    <div className="space-y-1">
                      <label className="block text-slate-600 font-medium">ชื่อสำนักงาน / หน่วยงาน</label>
                      <input
                        type="text"
                        value={config.officeName}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, officeName: e.target.value }))
                        }
                        placeholder="เช่น สำนักงานอัยการจังหวัดเพชรบุรี"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-600 font-medium">หัวข้อรายงาน</label>
                      <input
                        type="text"
                        value={config.reportTitle}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, reportTitle: e.target.value }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-600 font-medium">เลขที่หนังสือ / เอกสาร (ถ้ามี)</label>
                      <input
                        type="text"
                        value={config.documentRefNo}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, documentRefNo: e.target.value }))
                        }
                        placeholder="เช่น อส 0023(พบ)/..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-medium">ชื่อผู้จัดทำรายงาน</label>
                        <input
                          type="text"
                          value={config.preparerName}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, preparerName: e.target.value }))
                          }
                          placeholder="เว้นว่างไว้หากต้องการเซ็นด้วยปากกา"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-medium">ตำแหน่งผู้จัดทำ</label>
                        <input
                          type="text"
                          value={config.preparerTitle}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, preparerTitle: e.target.value }))
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-medium">ชื่อผู้ตรวจรับ / หัวหน้าสำนักงาน</label>
                        <input
                          type="text"
                          value={config.approverName}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, approverName: e.target.value }))
                          }
                          placeholder="เว้นว่างไว้หากต้องการเซ็นด้วยปากกา"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-medium">ตำแหน่งผู้ตรวจรับ</label>
                        <input
                          type="text"
                          value={config.approverTitle}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, approverTitle: e.target.value }))
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Export Action Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2.5 shrink-0">
              {exportError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{exportError}</span>
                </div>
              )}

              {exportSuccessFile && !isExporting && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span className="break-all">บันทึกไฟล์ {exportSuccessFile} แล้ว</span>
                </div>
              )}

              <div className="text-[11px] text-slate-500 truncate" title={fileNamePreview}>
                ชื่อไฟล์: <span className="font-medium text-slate-700">{fileNamePreview}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExporting || reportData.totalCases === 0}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="tabular-nums">
                        {exportProgress && exportProgress.total > 0
                          ? `กำลังสร้าง PDF (${exportProgress.current}/${exportProgress.total})...`
                          : 'กำลังเตรียมเอกสาร...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      <span>ดาวน์โหลดไฟล์ PDF</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePrintA4}
                  disabled={isExporting || reportData.totalCases === 0}
                  className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                  title="สั่งพิมพ์เอกสารขนาด A4 โดยตรงผ่านเครื่องพิมพ์หรือบันทึก PDF แบบเวกเตอร์"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>พิมพ์ A4</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Right Live A4 Preview Canvas */}
          <section className="flex-1 bg-slate-200/80 flex flex-col min-w-0 min-h-0">
            {/* Preview Toolbar */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 shrink-0 text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-medium tabular-nums">
                <span>ตัวอย่างหน้าเอกสารจริง</span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span>ทั้งหมด {pages.length} หน้า A4</span>
              </div>

              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewZoom((prev) => {
                      const curr = prev === 'fit' ? computedScale : prev;
                      return Math.max(0.4, Number((curr - 0.15).toFixed(2)));
                    })
                  }
                  className="p-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                  title="ย่อขนาดตัวอย่าง"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom('fit')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                    previewZoom === 'fit'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="ปรับขนาดให้พอดีหน้าจอ"
                >
                  <span className="inline-flex items-center gap-1">
                    <Maximize2 className="w-3 h-3" />
                    <span>พอดีจอ ({Math.round(computedScale * 100)}%)</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(1)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer tabular-nums ${
                    previewZoom === 1
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewZoom((prev) => {
                      const curr = prev === 'fit' ? computedScale : prev;
                      return Math.min(1.25, Number((curr + 0.15).toFixed(2)));
                    })
                  }
                  className="p-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                  title="ขยายขนาดตัวอย่าง"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable A4 Pages Stack */}
            <div
              ref={previewScrollRef}
              className="flex-1 overflow-auto p-5 sm:p-6"
            >
              {reportData.totalCases === 0 ? (
                <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center max-w-md mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
                    <FileText className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 font-['Prompt']">
                    ไม่พบสำนวนคดีในรอบเดือน {reportData.monthLabel}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    ลองเปลี่ยนรอบเดือนที่รายงาน หรือปรับตัวกรองอัยการและสถานะสำนวนทางด้านซ้ายเพื่อแสดงตารางรายงานและส่งออกเป็น PDF
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 pb-8">
                  {pages.map((page) => (
                    <div
                      key={`${page.type}-${page.pageNumber}`}
                      className="flex flex-col items-center"
                    >
                      <div className="text-[11px] font-medium text-slate-600 mb-1.5 tabular-nums">
                        หน้า {page.pageNumber} จาก {page.totalPages} ·{' '}
                        {page.type === 'summary'
                          ? 'สรุปผลงานแยกรายอัยการ'
                          : 'บัญชีรายละเอียดสำนวนคดี'}
                      </div>
                      <div
                        style={{
                          width: `${Math.round(sheetWidth * computedScale)}px`,
                          height: `${Math.round(sheetHeight * computedScale)}px`,
                          position: 'relative',
                        }}
                        className="shadow-lg border border-slate-300 bg-white rounded-xs overflow-hidden"
                      >
                        <div
                          style={{
                            transform: `scale(${computedScale})`,
                            transformOrigin: 'top left',
                            width: `${sheetWidth}px`,
                            height: `${sheetHeight}px`,
                          }}
                        >
                          <A4SheetRenderer
                            page={page}
                            data={reportData}
                            config={config}
                            sheetWidth={sheetWidth}
                            sheetHeight={sheetHeight}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Off-screen unscaled 1:1 capture container mounted strictly during PDF generation or printing */}
      {isExporting && reportData.totalCases > 0 && (
        <div
          ref={captureContainerRef}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-20000px',
            top: 0,
            width: `${sheetWidth}px`,
            backgroundColor: '#FFFFFF',
            zIndex: -1,
            pointerEvents: 'none',
          }}
        >
          {pages.map((page) => (
            <A4SheetRenderer
              key={`capture-${page.type}-${page.pageNumber}`}
              page={page}
              data={reportData}
              config={config}
              sheetWidth={sheetWidth}
              sheetHeight={sheetHeight}
            />
          ))}
        </div>
      )}
    </div>
  );
};
