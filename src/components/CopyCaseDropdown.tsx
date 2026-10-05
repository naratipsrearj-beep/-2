import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, ChevronDown, Scale, FileText, Sparkles, Share2, FileSpreadsheet, QrCode, Table } from 'lucide-react';
import { AppealCase } from '../types/appeal';
import {
  formatJudgmentForClipboard,
  formatCaseSummaryForClipboard,
  formatCompactCaseForClipboard,
  formatCaseForOfficeTsv,
  copyTextToClipboard
} from '../utils/copyCaseUtils';
import { getDailyExportRow } from '../utils/dailyExportUtils';

interface CopyCaseDropdownProps {
  caseItem: AppealCase;
  onToast?: (message: string) => void;
  onOpenFileLabel?: (caseItem: AppealCase) => void;
  onOpenCourtPetition?: (caseItem: AppealCase) => void;
  variant?: 'compact' | 'button' | 'badge';
  className?: string;
}

export const CopyCaseDropdown: React.FC<CopyCaseDropdownProps> = ({
  caseItem,
  onToast,
  onOpenFileLabel,
  onOpenCourtPetition,
  variant = 'compact',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<'judgment' | 'summary' | 'compact' | 'sheets' | 'office' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCopy = async (
    type: 'judgment' | 'summary' | 'compact' | 'sheets' | 'office',
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    let textToCopy = '';
    let successMessage = '';

    if (type === 'judgment') {
      textToCopy = formatJudgmentForClipboard(caseItem);
      successMessage = `คัดลอกเฉพาะคำพิพากษาคดีดำ ${caseItem.blackCaseNo} เรียบร้อยแล้ว`;
    } else if (type === 'summary') {
      textToCopy = formatCaseSummaryForClipboard(caseItem);
      successMessage = `คัดลอกสรุปรายละเอียดสำนวน ${caseItem.blackCaseNo} เรียบร้อยแล้ว`;
    } else if (type === 'sheets') {
      textToCopy = getDailyExportRow(caseItem).join('\t');
      successMessage = `คัดลอกข้อมูล 7 คอลัมน์สำหรับ Google Sheets (${caseItem.blackCaseNo}) แล้ว (พร้อมกด Ctrl+V)`;
    } else if (type === 'office') {
      textToCopy = formatCaseForOfficeTsv(caseItem);
      successMessage = `คัดลอกแถวสำหรับวางลง Excel / โปรแกรมสารบบ (${caseItem.blackCaseNo}) เรียบร้อยแล้ว (กด Ctrl+V วางได้ทันที)`;
    } else {
      textToCopy = formatCompactCaseForClipboard(caseItem);
      successMessage = `คัดลอกข้อความแบบย่อ ${caseItem.blackCaseNo} แล้ว`;
    }

    const ok = await copyTextToClipboard(textToCopy);
    if (ok) {
      setCopiedType(type);
      if (onToast) onToast(successMessage);
      setTimeout(() => {
        setCopiedType(null);
        setIsOpen(false);
      }, 1500);
    }
  };

  // Default quick action when clicking the main copy button (copies judgment if available, else summary)
  const handleQuickCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (caseItem.judgmentDate || caseItem.judgmentOutcome) {
      handleCopy('judgment', e);
    } else {
      handleCopy('summary', e);
    }
  };

  if (variant === 'button') {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <div className="inline-flex rounded-lg shadow-2xs border border-slate-200 bg-white hover:bg-slate-50 overflow-hidden">
          <button
            type="button"
            onClick={handleQuickCopy}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-amber-800 hover:bg-amber-50 flex items-center gap-1.5 transition cursor-pointer"
            title="คลิกเพื่อคัดลอกคำพิพากษา / รายละเอียดสำนวน"
          >
            {copiedType ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">คัดลอกแล้ว!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-600" />
                <span>คัดลอกคำพิพากษา</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="px-1.5 py-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-l border-slate-200 transition cursor-pointer"
            title="เลือกรูปแบบการคัดลอก"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-1 w-64 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in-50 zoom-in-95 text-xs font-['Sarabun',sans-serif]">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              ตัวเลือกการคัดลอกสำนวน
            </div>

            {/* Option 1: Copy Judgment (Highlighted) */}
            <button
              type="button"
              onClick={(e) => handleCopy('judgment', e)}
              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-900 flex items-start gap-2.5 transition group cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-500 group-hover:text-white transition">
                <Scale className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <span>คัดลอกคำพิพากษา</span>
                  <span className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0.2 rounded font-bold">
                    แนะนำ
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  คัดลอกเฉพาะเนื้อหาและผลคำพิพากษาเท่านั้น
                </div>
              </div>
              {copiedType === 'judgment' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            </button>

            {/* Option 2: Copy Full Summary */}
            <button
              type="button"
              onClick={(e) => handleCopy('summary', e)}
              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-900 flex items-start gap-2.5 transition group cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-500 group-hover:text-white transition">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">คัดลอกสรุปสำนวนครบถ้วน</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  คู่ความ, วันฟ้อง, เวรชี้, กำหนดอุทธรณ์ 1 เดือน เหมาะส่งใน LINE
                </div>
              </div>
              {copiedType === 'summary' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            </button>

            {/* Option 3: Copy Compact */}
            <button
              type="button"
              onClick={(e) => handleCopy('compact', e)}
              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 flex items-start gap-2.5 transition group cursor-pointer"
            >
              <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-slate-300 transition">
                <Copy className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800">คัดลอกแบบย่อบรรทัดเดียว</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  ดำ/แดง ศาล ผลคำพิพากษา ครบอุทธรณ์
                </div>
              </div>
              {copiedType === 'compact' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            </button>

            {/* Option 4: Copy 7 Columns for Google Sheets */}
            <button
              type="button"
              onClick={(e) => handleCopy('sheets', e)}
              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 flex items-start gap-2.5 transition group cursor-pointer border-t border-slate-100"
            >
              <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <span>คัดลอก 7 ช่องสำหรับ Google Sheets</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1 py-0.2 rounded font-bold">
                    ใหม่
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  ส.1/ส.4, ดำ, แดง, อัยการ, ผู้ต้องหา, ดำเนินการ, วันเสร็จสิ้น (วาง Ctrl+V)
                </div>
              </div>
              {copiedType === 'sheets' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            </button>

            {/* Option 5: Copy for Office System / Excel (TSV) */}
            <button
              type="button"
              onClick={(e) => handleCopy('office', e)}
              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-950 flex items-start gap-2.5 transition group cursor-pointer border-t border-slate-100"
            >
              <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-600 group-hover:text-white transition">
                <Table className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <span>คัดลอกแถวสำหรับ Excel / โปรแกรมสารบบ</span>
                  <span className="bg-amber-100 text-amber-900 text-[9px] px-1 py-0.2 rounded font-bold">
                    TSV
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  แยกคอลัมน์ให้อัตโนมัติ (ดำ, แดง, ส.1, ส.4, ศาล, คู่ความ, ครบอุทธรณ์) พร้อมกด Ctrl+V
                </div>
              </div>
              {copiedType === 'office' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            </button>

            {/* Option 5.5: Court Petition Form (7) */}
            {onOpenCourtPetition && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOpenCourtPetition(caseItem);
                }}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-950 flex items-start gap-2.5 transition group cursor-pointer border-t border-slate-100"
              >
                <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-600 group-hover:text-white transition">
                  <Scale className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 flex items-center gap-1">
                    <span>แบบคำร้องขอขยายเวลาอุทธรณ์</span>
                    <span className="bg-amber-200 text-amber-900 text-[9px] px-1 py-0.2 rounded font-bold">
                      แบบพิมพ์ศาล (๗)
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    ดึงเลขคดี คู่ความ ศาลเพชรบุรี กำหนดเดิม/ใหม่ พิมพ์ลงกระดาษตราครุฑ / Google Docs
                  </div>
                </div>
              </button>
            )}

            {/* Option 6: Print Folder Label & QR Code */}
            {onOpenFileLabel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOpenFileLabel(caseItem);
                }}
                className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-start gap-2.5 transition group cursor-pointer border-t border-slate-100"
              >
                <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-slate-800 group-hover:text-white transition">
                  <QrCode className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 flex items-center gap-1">
                    <span>พิมพ์ป้ายหน้าแฟ้ม & ใบปะหน้า (QR Code)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    ป้ายติดหน้าซองสำนวน พร้อม QR Code สแกนดูคดีได้ทันที
                  </div>
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Compact icon button for table rows
  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleQuickCopy}
          className={`p-1.5 rounded-l-lg border border-r-0 transition cursor-pointer ${
            copiedType
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'text-slate-600 bg-white hover:text-amber-700 hover:bg-amber-50 border-slate-200'
          }`}
          title="คัดลอกคำพิพากษา/รายละเอียดสำนวน (คลิกลูกศรเพื่อดูตัวเลือก)"
        >
          {copiedType ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`p-1.5 rounded-r-lg border transition cursor-pointer ${
            copiedType
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'text-slate-400 bg-white hover:text-slate-700 hover:bg-slate-50 border-slate-200'
          }`}
          title="ตัวเลือกการคัดลอก"
        >
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in-50 zoom-in-95 text-xs text-left font-['Sarabun',sans-serif]">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
            <span>คัดลอกข้อมูลคดี</span>
            <span className="text-amber-700 font-bold">ดำ {caseItem.blackCaseNo}</span>
          </div>

          {/* Option 1: Copy Judgment */}
          <button
            type="button"
            onClick={(e) => handleCopy('judgment', e)}
            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-900 flex items-start gap-2.5 transition group cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-500 group-hover:text-white transition">
              <Scale className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <span>คัดลอกคำพิพากษา</span>
                <span className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0.2 rounded font-bold">
                  เน้น
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                ผลคำพิพากษา, วันตัดสิน, เลขดำแดง วางในระบบอื่น
              </div>
            </div>
            {copiedType === 'judgment' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
          </button>

          {/* Option 2: Copy Full Summary */}
          <button
            type="button"
            onClick={(e) => handleCopy('summary', e)}
            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-900 flex items-start gap-2.5 transition group cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-500 group-hover:text-white transition">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900">คัดลอกสรุปสำนวนครบถ้วน</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                คู่ความ, วันฟ้อง, อัยการเวรชี้, กำหนดอุทธรณ์ 1 เดือน
              </div>
            </div>
            {copiedType === 'summary' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
          </button>

          {/* Option 3: Copy Compact */}
          <button
            type="button"
            onClick={(e) => handleCopy('compact', e)}
            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 flex items-start gap-2.5 transition group cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-slate-300 transition">
              <Copy className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-800">คัดลอกแบบย่อบรรทัดเดียว</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                ดำ/แดง ศาล ผลคำพิพากษา ครบอุทธรณ์
              </div>
            </div>
            {copiedType === 'compact' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
          </button>

          {/* Option 4: Copy 7 Columns for Google Sheets */}
          <button
            type="button"
            onClick={(e) => handleCopy('sheets', e)}
            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 flex items-start gap-2.5 transition group cursor-pointer border-t border-slate-100"
          >
            <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 flex items-center gap-1">
                <span>คัดลอก 7 ช่องสำหรับ Google Sheets</span>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1 py-0.2 rounded font-bold">
                  ใหม่
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                ส.1/ส.4, ดำ, แดง, อัยการ, ผู้ต้องหา, ดำเนินการ, วันเสร็จสิ้น (วาง Ctrl+V)
              </div>
            </div>
            {copiedType === 'sheets' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
          </button>

          {/* Option 5: Copy for Office System / Excel (TSV) */}
          <button
            type="button"
            onClick={(e) => handleCopy('office', e)}
            className="w-full text-left px-3 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-950 flex items-start gap-2.5 transition group cursor-pointer border-t border-slate-100"
          >
            <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-600 group-hover:text-white transition">
              <Table className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 flex items-center gap-1">
                <span>คัดลอกแถวสำหรับ Excel / โปรแกรมสารบบ</span>
                <span className="bg-amber-100 text-amber-900 text-[9px] px-1 py-0.2 rounded font-bold">
                  TSV
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                แยกคอลัมน์ให้อัตโนมัติ (ดำ, แดง, ส.1, ส.4, ศาล, คู่ความ, ครบอุทธรณ์) พร้อมกด Ctrl+V
              </div>
            </div>
            {copiedType === 'office' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
          </button>

          {/* Option 5.5: Court Petition Form (7) */}
          {onOpenCourtPetition && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onOpenCourtPetition(caseItem);
              }}
              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-950 flex items-start gap-2.5 transition group cursor-pointer border-t border-slate-100"
            >
              <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-600 group-hover:text-white transition">
                <Scale className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <span>แบบคำร้องขอขยายเวลาอุทธรณ์</span>
                  <span className="bg-amber-200 text-amber-900 text-[9px] px-1 py-0.2 rounded font-bold">
                    แบบพิมพ์ศาล (๗)
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  ดึงเลขคดี คู่ความ ศาลเพชรบุรี กำหนดเดิม/ใหม่ พิมพ์ลงกระดาษตราครุฑ / Google Docs
                </div>
              </div>
            </button>
          )}

          {/* Option 6: Print Folder Label & QR Code */}
          {onOpenFileLabel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onOpenFileLabel(caseItem);
              }}
              className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-start gap-2.5 transition group cursor-pointer border-t border-slate-100"
            >
              <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-slate-800 group-hover:text-white transition">
                <QrCode className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <span>พิมพ์ป้ายหน้าแฟ้ม & ใบปะหน้า (QR Code)</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  ป้ายติดหน้าซองสำนวน พร้อม QR Code สแกนดูคดีได้ทันที
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
