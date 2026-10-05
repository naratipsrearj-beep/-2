import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Copy,
  Check,
  X,
  ExternalLink,
  Loader2,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { getTodayString } from '../utils/dateUtils';
import {
  CourtPetitionData,
  PRESET_PETITION_REASONS,
  generateCourtPetitionText,
  formatCourtThaiDate
} from '../utils/petitionUtils';
import { createCourtPetitionDoc } from '../services/docsService';
import { getAccessToken } from '../services/auth';

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
  const [extensionCount, setExtensionCount] = useState<number>(1);
  const [newDeadline, setNewDeadline] = useState<string>('');
  const [reason, setReason] = useState<string>(PRESET_PETITION_REASONS[0].text);
  const [prosecutorName, setProsecutorName] = useState<string>('');
  const [forPreprintedGaruda, setForPreprintedGaruda] = useState<boolean>(true);

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

    // Calculate default new deadline (+30 days from previous)
    if (defaultNewDeadline) {
      setNewDeadline(defaultNewDeadline);
    } else {
      const baseDate = caseItem.extendedDeadline || caseItem.appealDeadline || getTodayString();
      try {
        const [y, m, d] = baseDate.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() + 30);
        setNewDeadline(dt.toISOString().slice(0, 10));
      } catch {
        setNewDeadline(getTodayString());
      }
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
    forPreprintedGarudaPaper: forPreprintedGaruda,
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
      const res = await createCourtPetitionDoc(currentToken, petitionData, forPreprintedGaruda);
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
      if (onToast) onToast('คัดลอกข้อความคำร้องศาลแล้ว (พร้อมวางลงใน Word ได้ทันที)');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Handle Direct Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Header (Hidden in Print) */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Prompt'] text-white">
                  แบบฟอร์มคำร้องศาล (แบบพิมพ์ศาล ๗)
                </h3>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  พร้อมพิมพ์ลงกระดาษตราครุฑ
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                ดึงข้อมูลสำนวนคดีดำ {caseItem.blackCaseNo} {caseItem.redCaseNo ? `คดีแดง ${caseItem.redCaseNo}` : ''} ศาลจังหวัดเพชรบุรี อัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 flex flex-col lg:flex-row gap-6">
          {/* Left Column: Form Controls (Hidden in Print) */}
          <div className="w-full lg:w-80 shrink-0 space-y-4 print:hidden text-xs">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>ตั้งค่ารายละเอียดคำร้อง</span>
              </div>

              {/* Court */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">ศาลที่ยื่นคำร้อง</label>
                <input
                  type="text"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Petition Date */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">วันที่ยื่นคำร้อง</label>
                <input
                  type="date"
                  value={petitionDate}
                  onChange={(e) => setPetitionDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Extension Count & New Deadline */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">ขยายครั้งที่</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={extensionCount}
                    onChange={(e) => setExtensionCount(Number(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">ขอขยายถึงวันที่</label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-2 py-1.5 border border-amber-300 bg-amber-50/50 rounded-lg text-xs font-bold text-amber-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Prosecutor Name */}
              <div>
                <label className="block text-slate-600 font-semibold mb-1">พนักงานอัยการผู้เรียงและยื่น</label>
                <input
                  type="text"
                  placeholder="เช่น นายสมชาย นามสมมุติ"
                  value={prosecutorName}
                  onChange={(e) => setProsecutorName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Paper Format Option */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-slate-600 font-semibold mb-1.5">รูปแบบกระดาษที่จะพิมพ์</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      name="paperType"
                      checked={forPreprintedGaruda}
                      onChange={() => setForPreprintedGaruda(true)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-semibold text-slate-800 block">กระดาษตราครุฑพิมพ์สำเร็จ</span>
                      <span className="text-slate-400 text-[10px]">(เว้นที่ด้านบน 4-5 ซม.)</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      name="paperType"
                      checked={!forPreprintedGaruda}
                      onChange={() => setForPreprintedGaruda(false)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-semibold text-slate-800 block">กระดาษ A4 เปล่า</span>
                      <span className="text-slate-400 text-[10px]">(แสดงข้อความตราครุฑด้านบน)</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Select Preset Reason */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <label className="block text-slate-800 font-bold text-xs flex items-center justify-between">
                <span>เหตุผลในการขอขยายระยะเวลา</span>
                <span className="text-[10px] text-amber-700 font-normal">คลิกเลือกเหตุผลลัดได้</span>
              </label>

              <div className="space-y-1">
                {PRESET_PETITION_REASONS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setReason(preset.text)}
                    className={`w-full text-left p-2 rounded-lg border text-[11px] transition flex items-start gap-1.5 cursor-pointer ${
                      reason === preset.text
                        ? 'bg-amber-50 border-amber-300 text-amber-950 font-semibold'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="shrink-0 text-amber-600 mt-0.5">•</span>
                    <span className="line-clamp-2 leading-tight">{preset.title}</span>
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="พิมพ์หรือปรับแก้เหตุผลเพิ่มเติมที่นี่..."
                className="w-full mt-2 p-2 border border-slate-300 rounded-lg text-[11px] focus:ring-2 focus:ring-amber-500 font-sans"
              />
            </div>
          </div>

          {/* Right Column: Court Petition Paper Preview */}
          <div className="flex-1 bg-white p-6 sm:p-10 rounded-xl border border-slate-300 shadow-md min-h-[600px] font-['TH_Sarabun_New',_'Cordia_New',_sans-serif] text-slate-900 text-sm leading-relaxed overflow-x-auto print:border-none print:shadow-none print:p-0">
            {/* Top Garuda Spacing / Header */}
            {forPreprintedGaruda ? (
              <div className="h-20 sm:h-24 flex items-center justify-center border-b border-dashed border-slate-200 text-slate-300 text-xs italic mb-4 print:border-none print:text-transparent">
                (พื้นที่ว่างสำหรับกระดาษตราครุฑพิมพ์สำเร็จรูปของศาล)
              </div>
            ) : (
              <div className="text-center font-bold text-base mb-4 print:block">
                [ ตราครุฑ ]
              </div>
            )}

            {/* Right corner form number and case numbers */}
            <div className="flex justify-end text-xs sm:text-sm font-semibold mb-1">
              <div className="w-56 text-right">
                <div className="text-right text-xs text-slate-500 mb-1">(๗)</div>
                <div>คดีหมายเลขดำที่ <span className="font-bold border-b border-dotted border-slate-400 px-2">{caseItem.blackCaseNo}</span></div>
                <div>คดีหมายเลขแดงที่ <span className="font-bold border-b border-dotted border-slate-400 px-2">{caseItem.redCaseNo || '............................'}</span></div>
              </div>
            </div>

            {/* Court name and date centered */}
            <div className="text-center my-3">
              <div className="font-bold text-base">{court || 'ศาลจังหวัดเพชรบุรี'}</div>
              <div className="mt-1 text-xs sm:text-sm">
                {formatCourtThaiDate(petitionDate)}
              </div>
              <div className="text-xs sm:text-sm mt-0.5">
                ความ <span className="font-semibold underline">{caseItem.caseType || 'อาญา'}</span>
              </div>
            </div>

            {/* Parties */}
            <div className="my-4 text-xs sm:text-sm space-y-1">
              <div className="flex justify-between items-baseline border-b border-dotted border-slate-200 pb-1">
                <span>{caseItem.plaintiff || 'พนักงานอัยการจังหวัดเพชรบุรี'}</span>
                <span className="font-bold">โจทก์</span>
              </div>
              <div className="text-center font-semibold text-xs py-0.5">ระหว่าง</div>
              <div className="flex justify-between items-baseline border-b border-dotted border-slate-200 pb-1">
                <span>{caseItem.defendant}</span>
                <span className="font-bold">จำเลย</span>
              </div>
            </div>

            {/* Petition Title */}
            <div className="text-center font-bold text-sm sm:text-base my-4 underline">
              คำร้องขอขยายระยะเวลาอุทธรณ์ {extensionCount > 1 ? `(ครั้งที่ ${extensionCount})` : '(ครั้งที่ ๑)'}
            </div>

            {/* Petition Body */}
            <div className="text-xs sm:text-sm text-justify space-y-3 indent-8 leading-relaxed">
              <p>
                ข้าพเจ้า {caseItem.plaintiff || 'พนักงานอัยการจังหวัดเพชรบุรี'} โจทก์ ขอยื่นคำร้องต่อศาล มีข้อความตามที่จะกราบเรียนต่อไปนี้
              </p>

              <p>
                <strong>ข้อ ๑.</strong> คดีนี้ ศาลได้โปรดอ่านคำพิพากษาเมื่อ {caseItem.judgmentDate ? formatCourtThaiDate(caseItem.judgmentDate) : '................................................'}{' '}
                {caseItem.judgmentOutcome ? `โดยมีคำพิพากษาคือ "${caseItem.judgmentOutcome}"` : ''}{' '}
                {extensionCount > 1
                  ? `และคดีนี้ ศาลได้เคยอนุญาตให้โจทก์ขยายระยะเวลาอุทธรณ์มาแล้ว โดยจะครบกำหนดใน${formatCourtThaiDate(originalDeadline)}`
                  : `และคดีนี้จะครบกำหนดระยะเวลาอุทธรณ์ ๑ เดือน ตามกฎหมายใน${formatCourtThaiDate(originalDeadline)}`}
              </p>

              <p>
                <strong>ข้อ ๒.</strong> เนื่องจาก {reason}
              </p>

              <p>
                ด้วยเหตุดังกล่าวข้างต้น โจทก์จึงมีความจำเป็นอย่างยิ่งที่จะต้องกราบเรียนต่อศาล เพื่อขอประทานศาลได้โปรดมีคำสั่งอนุญาตให้ขยายระยะเวลาอุทธรณ์ของโจทก์ออกไปอีก (เป็นครั้งที่ {extensionCount}) นับแต่วันครบกำหนดเดิม จนถึง{formatCourtThaiDate(newDeadline)} เพื่อประโยชน์แห่งความยุติธรรม
              </p>

              <div className="text-right indent-0 pr-12 my-3">
                ควรมิควรแล้วแต่จะโปรด
              </div>

              {/* Signatures */}
              <div className="pt-6 text-right indent-0 space-y-1">
                <div>(ลงชื่อ) .............................................................. โจทก์ / ผู้เรียงและยื่น</div>
                <div className="pr-4">( {prosecutorName || caseItem.prosecutorName || caseItem.responsiblePerson || '..............................................................'} )</div>
                <div className="pr-8 text-xs text-slate-500">พนักงานอัยการเจ้าของสำนวน</div>
              </div>

              <div className="pt-8 text-xs text-slate-500 indent-0 border-t border-slate-200 mt-6">
                <div>คำร้องฉบับนี้ ข้าพเจ้า {prosecutorName || caseItem.prosecutorName || caseItem.responsiblePerson || '..............................................................'} พนักงานอัยการผู้เรียงและยื่น</div>
                <div className="flex justify-between mt-3 text-right">
                  <div>(ลงชื่อ) .............................................................. ผู้เรียงและยื่น</div>
                  <div>(ลงชื่อ) .............................................................. ผู้เขียนหรือพิมพ์</div>
                </div>
              </div>
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
              <span>พร้อมพิมพ์ลงกระดาษตราครุฑ หรือส่งออกเป็น Google Docs</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Text Button */}
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              title="คัดลอกข้อความทั้งหมดเพื่อนำไปวางใน Word หรือโปรแกรมของสำนักงาน"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกลง Word'}</span>
            </button>

            {/* Direct Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="สั่งพิมพ์ลงกระดาษตราครุฑโดยตรง (Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์ลงกระดาษตราครุฑ</span>
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
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs rounded-xl transition cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
