import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Scale,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sliders,
  Upload,
  Check,
  Search,
  Maximize2,
  Columns,
  Eye,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { calculateAppealDeadline, formatThaiDate, getTodayString } from '../utils/dateUtils';
import { isJudgmentRecorded } from '../utils/appointmentUtils';

interface RecordJudgmentModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  onClose: () => void;
  onSaveJudgmentDate: (
    caseId: string,
    judgmentData: {
      judgmentDate: string;
      redCaseNo?: string;
      judgmentOutcome: string;
      appealDeadline: string;
      fullJudgmentText?: string;
      judgmentPhotoUrl?: string | null;
      judgmentPhotoName?: string;
      judgmentVerified?: boolean;
      judgmentVerifiedBy?: string;
      judgmentRecheckNotes?: string;
    },
    syncToCalendar: boolean
  ) => void;
  onClearJudgment?: (caseId: string) => void;
  onOpenFullRecheckModal?: (caseItem: AppealCase) => void;
}

const QUICK_OUTCOME_SUGGESTIONS = [
  'ลงโทษตามฟ้อง',
  'จำคุก รอการลงโทษ',
  'ยกฟ้อง',
  'รอการกำหนดโทษ',
  'จำคุก ไม่รอลงอาญา',
  'ปรับอย่างเดียว',
  'ยอมความ / ถอนฟ้อง',
];

const SPOT_CHECK_KEYWORDS = [
  'จำคุก',
  'รอการลงโทษ',
  'รอลงอาญา',
  'ปรับ',
  'ยกฟ้อง',
  'ริบทรัพย์สิน',
  'คดีแดง',
  'คืนของกลาง',
  'ค่าฤชาธรรมเนียม'
];

export const RecordJudgmentModal: React.FC<RecordJudgmentModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  onSaveJudgmentDate,
  onClearJudgment,
  onOpenFullRecheckModal,
}) => {
  const [judgmentDate, setJudgmentDate] = useState<string>(getTodayString());
  const [redCaseNo, setRedCaseNo] = useState<string>('');
  const [judgmentOutcome, setJudgmentOutcome] = useState<string>('');
  const [fullJudgmentText, setFullJudgmentText] = useState<string>('');
  const [syncToCalendar, setSyncToCalendar] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Screenshot image & verification state
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>('');
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [verifiedBy, setVerifiedBy] = useState<string>('');
  const [recheckNotes, setRecheckNotes] = useState<string>('');

  // Dual view and image manipulation
  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deadlineInfo, setDeadlineInfo] = useState({
    deadlineDate: '',
    originalDeadline: '',
    isAdjustedForWeekend: false,
  });

  useEffect(() => {
    if (caseItem) {
      setJudgmentDate(caseItem.judgmentDate || getTodayString());
      setRedCaseNo(caseItem.redCaseNo || '');
      setJudgmentOutcome(caseItem.judgmentOutcome || '');
      setFullJudgmentText(caseItem.fullJudgmentText || '');
      setPhotoUrl(caseItem.judgmentPhotoUrl || null);
      setPhotoName(caseItem.judgmentPhotoName || (caseItem.judgmentPhotoUrl ? 'ภาพแคปคำพิพากษา.png' : ''));
      setIsVerified(!!caseItem.judgmentVerified);
      setVerifiedBy(caseItem.judgmentVerifiedBy || caseItem.responsiblePerson || '');
      setRecheckNotes(caseItem.judgmentRecheckNotes || '');
      // Automatically show split view if an image already exists
      if (caseItem.judgmentPhotoUrl) {
        setIsSplitView(true);
      } else {
        setIsSplitView(false);
      }
      setZoomLevel(1);
      setRotation(0);
      setHighContrast(false);
      setErrorMsg(null);
      setPasteNotice(null);
    }
  }, [caseItem, isOpen]);

  useEffect(() => {
    if (judgmentDate) {
      const info = calculateAppealDeadline(judgmentDate);
      setDeadlineInfo(info);
    } else {
      setDeadlineInfo({ deadlineDate: '', originalDeadline: '', isAdjustedForWeekend: false });
    }
  }, [judgmentDate]);

  // Handle global clipboard paste of screenshot images
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                const dataUrl = event.target.result as string;
                setPhotoUrl(dataUrl);
                const generatedName = `ภาพแคปคำพิพากษา_${caseItem?.blackCaseNo || 'ศาล'}_${new Date().toISOString().slice(0, 10)}.png`;
                setPhotoName(generatedName);
                setIsSplitView(true);
                setPasteNotice('📸 วางภาพแคปหน้าจอคำพิพากษาเรียบร้อยแล้ว ตรวจทานข้อความได้ทันที');
                setTimeout(() => setPasteNotice(null), 4000);
              }
            };
            reader.readAsDataURL(file);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, caseItem]);

  if (!isOpen || !caseItem) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoUrl(event.target.result as string);
        setIsSplitView(true);
        setPasteNotice('📸 โหลดภาพคำพิพากษาเรียบร้อยแล้ว');
        setTimeout(() => setPasteNotice(null), 3500);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setPhotoName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoUrl(event.target.result as string);
          setIsSplitView(true);
          setPasteNotice('📸 วางภาพแคปหน้าจอคำพิพากษาเรียบร้อยแล้ว');
          setTimeout(() => setPasteNotice(null), 3500);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
    setPhotoName('');
    setIsSplitView(false);
    setIsVerified(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judgmentDate) {
      setErrorMsg('กรุณาระบุวันที่ศาลอ่านคำพิพากษา');
      return;
    }
    if (!deadlineInfo.deadlineDate) {
      setErrorMsg('ไม่สามารถคำนวณวันครบกำหนดอุทธรณ์ได้ กรุณาตรวจสอบวันที่');
      return;
    }
    if (!judgmentOutcome.trim() && !fullJudgmentText.trim()) {
      setErrorMsg('กรุณาระบุหรือเลือกผลคำพิพากษา (เช่น ลงโทษตามฟ้อง, จำคุก รอการลงโทษ, ยกฟ้อง) เพื่อบันทึกคำพิพากษา');
      return;
    }

    onSaveJudgmentDate(
      caseItem.id,
      {
        judgmentDate,
        redCaseNo: redCaseNo.trim() || undefined,
        judgmentOutcome: judgmentOutcome.trim(),
        appealDeadline: deadlineInfo.deadlineDate,
        fullJudgmentText: fullJudgmentText.trim() || undefined,
        judgmentPhotoUrl: photoUrl || null,
        judgmentPhotoName: photoName || undefined,
        judgmentVerified: isVerified,
        judgmentVerifiedBy: verifiedBy.trim() || undefined,
        judgmentRecheckNotes: recheckNotes.trim() || undefined,
      },
      syncToCalendar
    );
    onClose();
  };

  const isEditingExisting = isJudgmentRecorded(caseItem);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div
        className={`bg-white rounded-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[94vh] flex flex-col transition-all ${
          isSplitView && photoUrl ? 'max-w-6xl' : 'max-w-xl'
        }`}
      >
        {/* Header */}
        <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Prompt'] text-white">
                  {isEditingExisting ? 'กรอก/แก้ไขคำพิพากษา & คุมอุทธรณ์ 1 เดือน' : 'กรอกคำพิพากษา & เริ่มคุมอุทธรณ์ 1 เดือน'}
                </h3>
                {photoUrl && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isVerified
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    }`}
                  >
                    {isVerified ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ตรวจทานตรงกันแล้ว</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        <span>รอตรวจทานเทียบภาพ</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                สำนวนคดีดำ {caseItem.blackCaseNo} • {caseItem.court}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {photoUrl && (
              <button
                type="button"
                onClick={() => setIsSplitView(!isSplitView)}
                className="px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 border border-slate-700"
                title={isSplitView ? 'สลับเป็นมุมมองปกติ' : 'เปิดมุมมองตรวจทานเทียบ 2 ฝั่ง'}
              >
                <Columns className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">
                  {isSplitView ? 'มุมมองปกติ' : 'ตรวจทานเทียบ 2 ฝั่ง'}
                </span>
              </button>
            )}

            {onOpenFullRecheckModal && photoUrl && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullRecheckModal(caseItem);
                }}
                className="px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1 shadow-xs"
                title="ขยายเปิดหน้าต่างตรวจทานเต็มหน้าจอ"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">เต็มจอ</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Paste notification banner */}
        {pasteNotice && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5 font-medium">
              <Check className="w-4 h-4" />
              <span>{pasteNotice}</span>
            </span>
            <button
              onClick={() => setPasteNotice(null)}
              className="text-emerald-100 hover:text-white text-[11px] underline cursor-pointer"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*,.pdf"
          className="hidden"
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* LEFT PANEL: Screenshot Viewer (Shown when in split view with image) */}
          {isSplitView && photoUrl && (
            <div className="w-full md:w-1/2 bg-slate-950 flex flex-col border-b md:border-b-0 md:border-r border-slate-800 max-h-[45vh] md:max-h-none flex-shrink-0">
              {/* Viewer Toolbar */}
              <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-1.5 text-slate-300 truncate max-w-[220px]">
                  <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate font-medium text-[11px]" title={photoName}>
                    {photoName}
                  </span>
                  <span className="text-[10px] bg-slate-800 px-1 py-0.2 rounded text-slate-400 shrink-0">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3.5))}
                    className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title="ซูมเข้า"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                    className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title="ซูมออก"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoomLevel(1);
                      setRotation(0);
                    }}
                    className="px-1.5 py-0.5 text-[10px] rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title="รีเซ็ตขนาดปกติ 100%"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title="หมุนภาพ 90 องศา"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHighContrast(!highContrast)}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer flex items-center gap-0.5 ${
                      highContrast ? 'bg-amber-500 text-slate-950 font-bold' : 'hover:bg-slate-800 text-slate-300'
                    }`}
                    title="เร่งความคมชัด (ช่วยอ่านหมึกจาง)"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>คมชัด</span>
                  </button>

                  <div className="w-px h-3.5 bg-slate-700 mx-0.5" />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] text-amber-400 hover:text-amber-300 hover:underline px-1 py-0.5 cursor-pointer"
                  >
                    เปลี่ยนภาพ
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline px-1 py-0.5 cursor-pointer"
                  >
                    ลบ
                  </button>
                </div>
              </div>

              {/* Viewport */}
              <div className="flex-1 overflow-auto p-3 flex items-center justify-center relative select-none bg-slate-950/70">
                <div
                  className="transition-transform duration-100 ease-out origin-center"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    filter: highContrast ? 'contrast(175%) brightness(95%)' : 'none',
                  }}
                >
                  <img
                    src={photoUrl}
                    alt="ภาพแคปคำพิพากษาศาล"
                    className="max-w-full max-h-[70vh] rounded shadow-2xl object-contain border border-slate-800"
                    draggable={false}
                  />
                </div>
              </div>

              {/* Bottom hint */}
              <div className="px-3 py-1.5 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                <span>💡 ซูมดูคำพิพากษาเทียบกับข้อความฝั่งขวา</span>
                <span className="text-amber-400 font-medium">กด Ctrl+V เพื่อวางภาพใหม่แทนได้</span>
              </div>
            </div>
          )}

          {/* RIGHT PANEL (or Full Panel): Form inputs & Verdict text */}
          <form
            onSubmit={handleSubmit}
            className={`p-5 space-y-4 overflow-y-auto flex-1 ${
              isSplitView && photoUrl ? 'md:w-1/2' : 'w-full'
            }`}
          >
            {/* Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
              <div className="flex justify-between font-medium">
                <span className="text-slate-600">โจทก์: {caseItem.plaintiff}</span>
                <span className="text-slate-600">จำเลย: {caseItem.defendant}</span>
              </div>
              {(caseItem.responsiblePerson || caseItem.prosecutorName) && (
                <div className="text-indigo-950 font-medium flex items-center gap-1.5 flex-wrap">
                  <span className="text-indigo-700 font-semibold">👔 อัยการเจ้าของสำนวน:</span>
                  <span className="font-semibold">{caseItem.responsiblePerson || 'รอกำหนด'}</span>
                  {caseItem.prosecutorName && (
                    <span className="text-slate-500 text-[11px]">(⚖️ เวรชี้: {caseItem.prosecutorName})</span>
                  )}
                </div>
              )}
              <div className="text-[11px] text-indigo-700 bg-indigo-50/80 p-1.5 rounded border border-indigo-100 mt-1">
                🛡️ เมื่อบันทึกคำพิพากษาแล้ว ระบบจะเริ่มนับระยะเวลาคุมอุทธรณ์ 1 เดือน (คำนวณวันทำการอัตโนมัติ)
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* DEDICATED IMAGE PASTE / SCREENSHOT DROPZONE (When no image or not split view) */}
            {(!isSplitView || !photoUrl) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-600" />
                    <span>ช่องสำหรับวางรูปภาพ ที่แคปหน้าจอคำพิพากษา</span>
                  </label>
                  <span className="text-[10px] text-slate-500">สำหรับตรวจทานข้อความ</span>
                </div>

                {photoUrl ? (
                  <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={photoUrl}
                        alt="ภาพตัวอย่าง"
                        className="w-12 h-12 object-cover rounded-lg border border-amber-200 shadow-2xs"
                      />
                      <div>
                        <div className="text-xs font-bold text-amber-950 truncate max-w-[200px]">
                          {photoName || 'ภาพแคปคำพิพากษา'}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>แนบภาพแคปหน้าจอแล้ว</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsSplitView(true)}
                        className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                      >
                        <Columns className="w-3.5 h-3.5" />
                        <span>เปิดตรวจทานเทียบ 2 ฝั่ง</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="ลบภาพ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center group ${
                      isDragging
                        ? 'border-amber-500 bg-amber-50/80 scale-[0.99]'
                        : 'border-amber-300 hover:border-amber-500 bg-amber-50/30 hover:bg-amber-50/70'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white flex items-center justify-center mb-2 transition shadow-2xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-800 font-['Prompt']">
                      วางภาพแคปหน้าจอคำพิพากษาที่นี่ (กด Ctrl + V)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      คัดลอกรูปภาพหรือแคปหน้าจอคำพิพากษา แล้วกด <strong className="text-amber-700 font-bold">Ctrl + V</strong> เพื่อตรวจทานทันที <br />
                      หรือคลิกเพื่อเลือกไฟล์รูปภาพจากเครื่อง
                    </div>
                    <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100/70 group-hover:bg-amber-200/80 px-2.5 py-1 rounded-lg">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>เลือกไฟล์ภาพ หรือลากไฟล์มาวาง</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Judgment Date & Appeal Deadline */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-amber-950 mb-1 flex items-center justify-between">
                    <span>วันที่ศาลอ่านคำพิพากษา *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={judgmentDate}
                    onChange={(e) => setJudgmentDate(e.target.value)}
                    className="w-full text-xs border border-amber-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                  {judgmentDate && (
                    <span className="text-[10px] text-amber-900 font-semibold block mt-1">
                      {formatThaiDate(judgmentDate, { short: false })}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-950 mb-1">
                    วันครบกำหนดอุทธรณ์ 1 เดือน (อัตโนมัติ)
                  </label>
                  <div className="text-xs font-bold text-rose-700 bg-white border border-rose-300 rounded-xl px-3 py-2">
                    {deadlineInfo.deadlineDate ? formatThaiDate(deadlineInfo.deadlineDate, { short: false }) : 'กรุณาระบุวันพิพากษา'}
                  </div>
                  {deadlineInfo.isAdjustedForWeekend && (
                    <span className="text-[10px] text-amber-700 font-medium block mt-1">
                      ⚡ เลื่อนเป็นวันทำการถัดไป (ป.พ.พ. 193/8)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Red Case No. */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                หมายเลขคดีแดง (ถ้าทราบ)
              </label>
              <input
                type="text"
                placeholder="เช่น อ.891/2569 หรือ แดง 124/2569"
                value={redCaseNo}
                onChange={(e) => setRedCaseNo(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Judgment Outcome */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-800">
                  ผลคำพิพากษาโดยย่อ
                </label>
                <span className="text-[10px] text-slate-400">เลือกผลด่วนได้</span>
              </div>

              {/* Quick Chips */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_OUTCOME_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setJudgmentOutcome(suggestion)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition cursor-pointer ${
                      judgmentOutcome === suggestion
                        ? 'bg-amber-600 text-white border-amber-600 font-semibold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300'
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="เช่น ลงโทษจำคุก 2 ปี ปรับ 50,000 บาท รอการลงโทษ 2 ปี, ยกฟ้อง"
                value={judgmentOutcome}
                onChange={(e) => setJudgmentOutcome(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Full Judgment Text / Verdict Details */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>สาระสำคัญ / ข้อความคำพิพากษาฉบับเต็ม</span>
                </label>
                <span className="text-[10px] text-slate-400">คัดลอกข้อความมาวางที่นี่</span>
              </div>

              <textarea
                rows={isSplitView ? 6 : 4}
                placeholder="คัดลอกข้อความคำพิพากษา คำวินิจฉัยของศาล หรือรายละเอียดการลงโทษมาวางที่นี่..."
                value={fullJudgmentText}
                onChange={(e) => setFullJudgmentText(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-sans leading-relaxed"
              />

              {/* Spot-Check Keyword Indicators */}
              <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium mb-1.5">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>ตัวช่วยตรวจทานคำสำคัญในข้อความ (Spot-Check):</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {fullJudgmentText.length} ตัวอักษร
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {SPOT_CHECK_KEYWORDS.map((kw) => {
                    const combined = `${judgmentOutcome} ${fullJudgmentText}`;
                    const isFound = combined.includes(kw);
                    return (
                      <span
                        key={kw}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition flex items-center gap-1 ${
                          isFound
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                            : 'bg-white text-slate-400 border-slate-200'
                        }`}
                        title={isFound ? `พบคำว่า "${kw}" ในข้อความ` : `ไม่พบคำว่า "${kw}"`}
                      >
                        {isFound ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : null}
                        <span>{kw}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Verification Checkbox (เมื่อตรวจทานเทียบภาพแล้ว) */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mt-0.5 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-emerald-950 block">
                    ยืนยันการตรวจทาน: คัดลอกข้อความคำพิพากษามาวางตรงกับภาพแคปหน้าจอแล้ว
                  </span>
                  <span className="text-[11px] text-emerald-800 block">
                    ตรวจสอบแล้วว่ารายละเอียดโทษ, ข้อหา, และสาระสำคัญถูกต้องตรงกับคำพิพากษาจริง
                  </span>
                </div>
              </label>

              {isVerified && (
                <div className="pt-2 border-t border-emerald-200/80 flex items-center gap-2">
                  <span className="text-[11px] text-slate-600 shrink-0 font-medium">ชื่อผู้ตรวจทาน:</span>
                  <input
                    type="text"
                    placeholder="เช่น นิติกร / เจ้าหน้าที่ประจำวัน"
                    value={verifiedBy}
                    onChange={(e) => setVerifiedBy(e.target.value)}
                    className="flex-1 text-xs border border-emerald-300 rounded-lg px-2.5 py-1 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Google Calendar option */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    เพิ่มการแจ้งเตือนลงใน Google Calendar
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    เตือนก่อนวันครบกำหนดอุทธรณ์ 1 เดือน (7 วัน, 3 วัน และ 1 วัน)
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={syncToCalendar}
                onChange={(e) => setSyncToCalendar(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5 flex-shrink-0">
              <div>
                {onClearJudgment && (caseItem.judgmentDate || caseItem.hasJudgment || caseItem.judgmentOutcome) && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearJudgment(caseItem.id);
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer flex items-center gap-1 active:scale-95"
                    title="ยกเลิกคำพิพากษา และตั้งสถานะสำนวนเป็นยังไม่กรอกคำพิพากษา"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ล้างคำพิพากษา</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEditingExisting ? 'บันทึกคำพิพากษา' : 'บันทึกคำพิพากษาและเริ่มคุมอุทธรณ์ 1 เดือน'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
