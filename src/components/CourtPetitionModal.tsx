import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Copy,
  Check,
  X,
  ExternalLink,
  Loader2,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { getTodayString } from '../utils/dateUtils';
import {
  CourtPetitionData,
  PRESET_PETITION_REASONS,
  generateCourtPetitionText,
  formatCourtThaiDate,
  formatDayMonthYearSimple,
  toThaiNumerals,
  addDaysToDateStr,
  addMonthsToDateStr,
  THAI_MONTHS_FULL
} from '../utils/petitionUtils';
import { createCourtPetitionDoc } from '../services/docsService';
import { getAccessToken } from '../services/auth';
import { GarudaEmblem } from './GarudaEmblem';

interface CourtPetitionModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  onClose: () => void;
  token?: string | null;
  onToast?: (msg: string) => void;
  defaultNewDeadline?: string;
  defaultExtensionCount?: number;
}

export const CourtPetitionModal: React.FC<CourtPetitionModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  token,
  onToast,
  defaultNewDeadline,
  defaultExtensionCount,
}) => {
  const [court, setCourt] = useState('ศาลจังหวัดเพชรบุรี');
  const [petitionDate, setPetitionDate] = useState<string>(getTodayString());
  const [leaveDayBlank, setLeaveDayBlank] = useState<boolean>(true); // ตามภาพตัวอย่าง "วันที่......เดือน ตุลาคม พุทธศักราช ๒๕๖๙"
  const [extensionCount, setExtensionCount] = useState<number>(1);
  const [newDeadline, setNewDeadline] = useState<string>('');
  const [reason, setReason] = useState<string>(PRESET_PETITION_REASONS[0].text);
  const [prosecutorName, setProsecutorName] = useState<string>('');
  const [hasGarudaOnPaper, setHasGarudaOnPaper] = useState<boolean>(true); // มีตราครุฑตรงกลางด้านบนตามภาพ
  const [highlightEnabled, setHighlightEnabled] = useState<boolean>(true); // ไฮไลท์สีเหลืองข้อมูลสำนวนใน ( ) ตามคำขอ

  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [createdDocUrl, setCreatedDocUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize data when modal opens
  useEffect(() => {
    if (!isOpen || !caseItem) return;

    setCourt(caseItem.court || 'ศาลจังหวัดเพชรบุรี');
    setPetitionDate(getTodayString());

    const count = defaultExtensionCount || (caseItem.extensionCount ? caseItem.extensionCount + 1 : 1);
    setExtensionCount(count);

    // คำนวณวันครบกำหนดใหม่ (+2 เดือนตามแบบฟอร์มคำร้อง ๒ เดือน)
    const baseDate = caseItem.extendedDeadline || caseItem.appealDeadline || getTodayString();
    if (defaultNewDeadline) {
      setNewDeadline(defaultNewDeadline);
    } else {
      const extended2m = addMonthsToDateStr(baseDate, 2);
      setNewDeadline(extended2m || getTodayString());
    }

    setReason(PRESET_PETITION_REASONS[0].text);
    setProsecutorName(caseItem.prosecutorName || caseItem.responsiblePerson || '');
    setCreatedDocUrl(null);
    setCopied(false);
  }, [isOpen, caseItem, defaultNewDeadline, defaultExtensionCount]);

  if (!isOpen || !caseItem) return null;

  const originalDeadline = caseItem.extendedDeadline || caseItem.appealDeadline || '';

  const petitionData: CourtPetitionData = {
    court: court || 'ศาลจังหวัดเพชรบุรี',
    blackCaseNo: caseItem.blackCaseNo,
    redCaseNo: caseItem.redCaseNo || '',
    caseType: caseItem.caseType || 'อาญา',
    plaintiff: caseItem.plaintiff || 'พนักงานอัยการจังหวัดเพชรบุรี',
    defendant: caseItem.defendant,
    judgmentDate: caseItem.judgmentDate || '',
    judgmentOutcome: caseItem.judgmentOutcome || '',
    originalDeadline: originalDeadline,
    newDeadline: newDeadline,
    extensionCount: extensionCount,
    reason: reason,
    prosecutorName: prosecutorName,
    petitionDate: petitionDate,
  };

  const petitionFullText = generateCourtPetitionText(petitionData, {
    forPreprintedGarudaPaper: !hasGarudaOnPaper,
  });

  // Handle Export to Google Docs
  const handleExportGoogleDocs = async () => {
    if (!newDeadline) {
      alert('กรุณาระบุวันครบกำหนดที่ขอขยายเวลาใหม่');
      return;
    }

    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      if (onToast) onToast('โปรดเข้าสู่ระบบ Google เพื่อสร้างเอกสาร Google Docs');
      return;
    }

    try {
      setIsCreatingDoc(true);
      const res = await createCourtPetitionDoc(currentToken, petitionData, !hasGarudaOnPaper);
      setCreatedDocUrl(res.docUrl);
      if (onToast) onToast('สร้างแบบคำร้องศาลใน Google Docs สำเร็จแล้ว');
      window.open(res.docUrl, '_blank');
    } catch (err: any) {
      console.error('Court petition doc creation error:', err);
      if (onToast) onToast(`ไม่สามารถสร้าง Google Docs ได้: ${err.message || 'เกิดข้อผิดพลาด'}`);
    } finally {
      setIsCreatingDoc(false);
    }
  };

  // Handle Copy to Clipboard (for Word)
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(petitionFullText);
      setCopied(true);
      if (onToast) onToast('คัดลอกข้อความคำร้องขอขยายอุทธรณ์แล้ว (พร้อมวางลงใน Word ได้ทันที)');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Handle Direct Print
  const handlePrint = () => {
    window.print();
  };

  const [py, pm, pd] = (petitionDate || getTodayString()).split('-').map(Number);
  const petitionDayThai = pd ? toThaiNumerals(pd) : '......';
  const petitionMonth = THAI_MONTHS_FULL[pm - 1] || 'ตุลาคม';
  const petitionYearThai = toThaiNumerals(py > 2400 ? py : py + 543);

  // ข้อมูลวันที่แบบภาษาไทยและเลขไทยสำหรับแบบฟอร์ม
  const judgmentDateFormatted = caseItem.judgmentDate
    ? formatDayMonthYearSimple(caseItem.judgmentDate, true)
    : '................................................';

  const originalDeadlineFormatted = originalDeadline
    ? formatDayMonthYearSimple(originalDeadline, true)
    : '................................................';

  const nextDay = originalDeadline ? addDaysToDateStr(originalDeadline, 1) : '';
  const nextDayDeadlineFormatted = nextDay
    ? formatDayMonthYearSimple(nextDay, true)
    : '................................................';

  const newDeadlineFormatted = newDeadline
    ? formatDayMonthYearSimple(newDeadline, true)
    : (originalDeadline ? formatDayMonthYearSimple(addMonthsToDateStr(originalDeadline, 2), true) : '................................................');

  // คอมโพเนนต์ไฮไลท์สีเหลืองพร้อมวงเล็บ ( ) ตามที่ผู้ใช้ระบุในภาพ
  const HighlightField = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
    if (!highlightEnabled) {
      return <span className={className}>({children})</span>;
    }
    return (
      <span className={`inline-block bg-yellow-200 text-slate-950 font-bold px-1.5 py-0.2 mx-0.5 rounded border border-yellow-400 shadow-2xs print:bg-yellow-200 print:border-yellow-400 print:text-black ${className}`}>
        (&nbsp;{children}&nbsp;)
      </span>
    );
  };

  const HighlightDateRow = ({ children }: { children: React.ReactNode }) => {
    if (!highlightEnabled) {
      return <span>{children}</span>;
    }
    return (
      <span className="inline-block bg-yellow-200 text-slate-950 font-bold px-3 py-0.5 rounded border border-yellow-400 print:bg-yellow-200 print:border-yellow-400 print:text-black">
        {children}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Print Stylesheet for exact layout and colors */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 20mm 15mm 20mm;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-court-petition, #printable-court-petition * {
            visibility: visible !important;
          }
          #printable-court-petition {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: ${hasGarudaOnPaper ? '10mm 15mm 15mm 20mm' : '45mm 15mm 15mm 20mm'} !important;
            background: white !important;
            color: black !important;
            border: none !important;
            box-shadow: none !important;
            z-index: 999999 !important;
            font-size: 15pt !important;
            line-height: 1.8 !important;
          }
          .print\\:bg-yellow-200 {
            background-color: #fef08a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:border-yellow-400 {
            border-color: #facc15 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:text-black {
            color: #000000 !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[94vh]">
        {/* Header Bar (Hidden in Print) */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Prompt'] text-white">
                  แบบฟอร์มคำร้องขอขยายระยะเวลาอุทธรณ์
                </h3>
                <span className="bg-yellow-400 text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                  เหมือนภาพตัวอย่าง 100%
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                ดึงข้อมูลสำนวนคดีดำ {caseItem.blackCaseNo} {caseItem.redCaseNo ? `คดีแดง ${caseItem.redCaseNo}` : ''} ศาลจังหวัดเพชรบุรี ใส่ใน ( ) พร้อมไฮไลท์สีเหลืองอัตโนมัติ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-md cursor-pointer active:scale-95"
              title="พิมพ์คำร้องขอขยายอุทธรณ์ทันที"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ขยายอุทธรณ์</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex flex-col lg:flex-row gap-6">
          {/* Left Column: Form Settings (Hidden in Print) */}
          <div className="w-full lg:w-80 shrink-0 space-y-4 print:hidden text-xs">
            {/* Highlight Toggle Box */}
            <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-xl space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highlightEnabled}
                  onChange={(e) => setHighlightEnabled(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 mt-0.5 cursor-pointer"
                />
                <div className="leading-tight">
                  <span className="font-bold text-amber-950 block">
                    ☑ ไฮไลท์สีเหลืองข้อมูลสำนวนใน ( )
                  </span>
                  <span className="text-[11px] text-amber-800">
                    แสดงแถบสีเหลืองจุดที่ดึงข้อมูลจากสำนวนตามภาพตัวอย่าง
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-yellow-200">
                <input
                  type="checkbox"
                  checked={leaveDayBlank}
                  onChange={(e) => setLeaveDayBlank(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 mt-0.5 cursor-pointer"
                />
                <div className="leading-tight">
                  <span className="font-bold text-amber-950 block">
                    เว้นช่องวันที่ ...... (สำหรับเขียนมือ)
                  </span>
                  <span className="text-[11px] text-amber-800">
                    {leaveDayBlank ? 'แสดงเป็น "วันที่......เดือน ... พุทธศักราช ..."' : `ระบุวันที่ "${petitionDayThai}" อัตโนมัติ`}
                  </span>
                </div>
              </label>
            </div>

            {/* Print Paper Options */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>การพิมพ์ตราครุฑ</span>
              </h4>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
                  <input
                    type="radio"
                    name="garudaMode"
                    checked={hasGarudaOnPaper}
                    onChange={() => setHasGarudaOnPaper(true)}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <div className="text-[11px] leading-tight">
                    <span className="font-bold text-slate-800 block">มีตราครุฑตรงกลาง (ตามภาพ)</span>
                    <span className="text-slate-500 text-[10px]">สำหรับพิมพ์ลงกระดาษ A4 เปล่า</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
                  <input
                    type="radio"
                    name="garudaMode"
                    checked={!hasGarudaOnPaper}
                    onChange={() => setHasGarudaOnPaper(false)}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <div className="text-[11px] leading-tight">
                    <span className="font-bold text-slate-800 block">เว้นที่ว่างตราครุฑ 4.5 ซม.</span>
                    <span className="text-slate-500 text-[10px]">สำหรับพิมพ์ลงกระดาษตราครุฑสำเร็จรูปของศาล</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Data summary */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
              <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between">
                <span>ข้อมูลที่ดึงจากสำนวน</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                  ดึงอัตโนมัติ
                </span>
              </h4>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">เลขคดีดำ:</span>
                  <span className="font-bold text-slate-900">{caseItem.blackCaseNo || '-'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">เลขคดีแดง:</span>
                  <span className="font-bold text-slate-900">{caseItem.redCaseNo || '-'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">จำเลย/ผู้ต้องหา:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[150px]">{caseItem.defendant || '-'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">วันที่พิพากษา:</span>
                  <span className="font-bold text-slate-900">{caseItem.judgmentDate ? formatCourtThaiDate(caseItem.judgmentDate) : '-'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">ครบอุทธรณ์เดิม:</span>
                  <span className="font-bold text-rose-700">{originalDeadline ? formatCourtThaiDate(originalDeadline) : '-'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">วันถัดไป (+1 วัน):</span>
                  <span className="font-bold text-amber-800">{nextDay ? formatCourtThaiDate(nextDay) : '-'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">ขยายไป ๒ เดือน:</span>
                  <span className="font-bold text-emerald-700">{newDeadline ? formatCourtThaiDate(newDeadline) : '-'}</span>
                </div>
              </div>

              {/* Editable inputs */}
              <div className="pt-2 space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    วันครบกำหนดใหม่ที่ขอขยายไป (๒ เดือน):
                  </label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                    อัยการเจ้าของสำนวน (ผู้เรียงและพิมพ์):
                  </label>
                  <input
                    type="text"
                    value={prosecutorName}
                    onChange={(e) => setProsecutorName(e.target.value)}
                    placeholder="ชื่อ-สกุล พนักงานอัยการ"
                    className="w-full text-xs p-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Court Petition Paper Preview (Exact 1:1 match with user image) */}
          <div
            id="printable-court-petition"
            className="flex-1 bg-white p-8 sm:p-14 rounded-2xl border border-slate-300 shadow-xl min-h-[850px] font-['TH_Sarabun_New',_'Cordia_New',_sans-serif] text-slate-900 text-base leading-relaxed overflow-x-auto print:border-none print:shadow-none print:p-0 print:m-0"
          >
            {/* Top Garuda Emblem */}
            {hasGarudaOnPaper ? (
              <div className="flex justify-center mb-3">
                <GarudaEmblem width={88} height={88} className="text-slate-950 drop-shadow-2xs" />
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center border-b border-dashed border-slate-200 text-slate-300 text-xs italic mb-4 print:border-none print:text-transparent">
                (พื้นที่เว้นว่าง 4.5 ซม. สำหรับกระดาษตราครุฑพิมพ์สำเร็จรูปของศาล)
              </div>
            )}

            {/* Top Row: Left Header & Right Case Numbers */}
            <div className="flex justify-between items-start text-sm sm:text-base mb-2">
              <div className="text-left space-y-0.5">
                <div className="font-normal">(คำร้อง) ขอขยายระยะเวลาอุทธรณ์</div>
                <div className="pl-6 font-normal">
                  {extensionCount > 1 ? `ครั้งที่ ${toThaiNumerals(extensionCount)}` : 'ครั้งที่ ๑'}
                </div>
              </div>

              <div className="text-right space-y-1">
                <div>
                  คดีหมายเลขดำที่ <HighlightField>{caseItem.blackCaseNo || '............................'}</HighlightField>
                </div>
                <div>
                  คดีหมายเลขแดงที่ <HighlightField>{caseItem.redCaseNo || '............................'}</HighlightField>
                </div>
              </div>
            </div>

            {/* Center Court */}
            <div className="text-center font-normal text-base sm:text-lg my-1">
              ศาล {court.replace(/^ศาล\s*/, '')}
            </div>

            {/* Center Date */}
            <div className="text-center my-2 text-sm sm:text-base">
              <HighlightDateRow>
                วันที่{leaveDayBlank ? '......' : ` ${petitionDayThai} `}เดือน {petitionMonth} พุทธศักราช {petitionYearThai}
              </HighlightDateRow>
            </div>

            {/* Center Case Type */}
            <div className="text-center font-normal text-sm sm:text-base my-2">
              ความ{caseItem.caseType || 'อาญา'}
            </div>

            {/* Parties Section (ระหว่าง { โจทก์ / จำเลย) */}
            <div className="flex items-center my-4 text-sm sm:text-base">
              <div className="w-16 shrink-0 text-right pr-2 font-normal">
                ระหว่าง
              </div>
              <div className="text-5xl font-extralight text-slate-800 leading-none select-none px-1">
                &#123;
              </div>
              <div className="flex-1 min-w-0 space-y-2 py-1">
                <div className="flex items-baseline justify-between gap-1 overflow-hidden">
                  <span className="shrink-0 font-normal">.....{caseItem.plaintiff || 'พนักงานอัยการจังหวัดเพชรบุรี'}</span>
                  <span className="flex-1 border-b border-dotted border-slate-700 min-w-8 mx-1"></span>
                  <span className="shrink-0 font-normal">โจทก์</span>
                </div>
                <div className="flex items-baseline justify-between gap-1 overflow-hidden">
                  <div className="shrink-0 font-normal">
                    <HighlightField>{caseItem.defendant || '................................................'}</HighlightField>
                  </div>
                  <span className="flex-1 border-b border-dotted border-slate-700 min-w-8 mx-1"></span>
                  <span className="shrink-0 font-normal">จำเลย</span>
                </div>
              </div>
            </div>

            {/* ข้าพเจ้าพนักงานอัยการ ... โจทก์ */}
            <div className="indent-16 leading-relaxed text-sm sm:text-base mt-4">
              ข้าพเจ้าพนักงานอัยการ .....จังหวัดเพชรบุรี...............................................โจทก์......
            </div>
            <div className="leading-relaxed text-sm sm:text-base">
              ขอยื่นคำร้องมีข้อความตามที่กล่าวต่อไปนี้
            </div>

            {/* Body: ข้อ ๑ */}
            <p className="indent-16 leading-relaxed text-sm sm:text-base text-justify mt-3">
              ...............ข้อ ๑. คดีนี้ ศาลจังหวัดเพชรบุรีได้มีคำพิพากษาจำเลย เมื่อวันที่ <HighlightField>{judgmentDateFormatted}</HighlightField> และจะครบกำหนดระยะเวลาอุทธรณ์ ในวันที่ <HighlightField>{originalDeadlineFormatted}</HighlightField> ซึ่งคดีนี้อยู่ระหว่างเสนอผู้บังคับบัญชา โจทก์ จึงยื่นคำร้องขอขยายระยะเวลาอุทธรณ์ออกไปอีก มีกำหนด ๒ เดือน นับแต่วันที่ <HighlightField>{nextDayDeadlineFormatted}</HighlightField> ถึงวันที่ <HighlightField>{newDeadlineFormatted}</HighlightField> ขอศาลได้โปรดอนุญาต................................
            </p>

            {/* ควรมิควรแล้วแต่จะโปรด */}
            <div className="text-center my-6 text-sm sm:text-base tracking-wider">
              ..................................................................ควรมิควรแล้วแต่จะโปรด................................................
            </div>

            {/* ลงชื่อ โจทก์ */}
            <div className="text-right pr-6 my-4 text-sm sm:text-base">
              ....................................................ลงชื่อ....................................................โจทก์
            </div>

            {/* คำร้องฉบับนี้ ข้าพเจ้า... เป็นผู้เรียงและพิมพ์ */}
            <p className="indent-16 leading-relaxed text-sm sm:text-base text-justify my-3">
              ...............คำร้องฉบับนี้ ข้าพเจ้า <HighlightField>{prosecutorName || caseItem.prosecutorName || caseItem.responsiblePerson || '................................................'}</HighlightField> พนักงานอัยการจังหวัดเพชรบุรี โจทก์ เป็นผู้เรียงและพิมพ์.............................................................................................................................
            </p>

            {/* ลงชื่อ ผู้เรียงและพิมพ์ */}
            <div className="text-right pr-6 my-4 text-sm sm:text-base">
              ....................................................ลงชื่อ....................................................ผู้เรียงและพิมพ์
            </div>

            {/* หมายเหตุ */}
            <div className="mt-8 text-sm sm:text-base leading-relaxed">
              <span className="font-bold underline">หมายเหตุ</span> ข้าพเจ้ารอฟังคำสั่งอยู่ ถ้าไม่รอให้ถือว่าทราบแล้ว
            </div>
            <div className="text-right pr-6 mt-3 text-sm sm:text-base">
              ....................................................ผู้ร้อง
            </div>
          </div>
        </div>

        {/* Footer Actions (Hidden in Print) */}
        <div className="bg-white px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {createdDocUrl ? (
              <a
                href={createdDocUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition"
              >
                <span>เปิดเอกสาร Google Docs ที่สร้างแล้ว</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span className="font-medium text-slate-700">แบบฟอร์มจำลองจากภาพตัวอย่าง พร้อมดึงข้อมูลสำนวนใส่ใน ( ) และไฮไลท์สีเหลืองแล้ว</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Text Button */}
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              title="คัดลอกข้อความทั้งหมดเพื่อนำไปวางใน Word หรือโปรแกรมของสำนักงาน"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกลง Word'}</span>
            </button>

            {/* Direct Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer active:scale-95"
              title="พิมพ์ขยายอุทธรณ์ลงกระดาษ หรือบันทึกเป็น PDF (Ctrl+P)"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ขยายอุทธรณ์</span>
            </button>

            {/* Export to Google Docs Button */}
            <button
              type="button"
              onClick={handleExportGoogleDocs}
              disabled={isCreatingDoc}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
              title="สร้างเป็นไฟล์ Google Docs และเปิดแท็บใหม่ทันที"
            >
              {isCreatingDoc ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังสร้าง Google Docs...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  <span>สร้างไฟล์ Google Docs</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs rounded-xl transition cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
