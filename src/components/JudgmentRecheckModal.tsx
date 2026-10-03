import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RefreshCw,
  Search,
  Sparkles,
  Eye,
  Sliders,
  Check,
  FileCheck2,
  ExternalLink
} from 'lucide-react';
import { AppealCase, DailyJudgmentFollowUp } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';
import { createCaseJudgmentDoc } from '../services/docsService';

interface JudgmentRecheckModalProps {
  isOpen: boolean;
  target: {
    type: 'case' | 'followup';
    data: AppealCase | DailyJudgmentFollowUp;
  } | null;
  onClose: () => void;
  token: string | null;
  onSaveCaseRecheck?: (
    caseId: string,
    judgmentText: string,
    photoUrl?: string,
    photoName?: string,
    isVerified?: boolean,
    verifiedBy?: string,
    notes?: string
  ) => void;
  onSaveFollowUpRecheck?: (
    followUpId: string,
    judgmentSummary: string,
    photoUrl?: string,
    photoName?: string,
    isVerified?: boolean,
    verifiedBy?: string,
    notes?: string
  ) => void;
  onLoginPrompt?: () => void;
}

export const JudgmentRecheckModal: React.FC<JudgmentRecheckModalProps> = ({
  isOpen,
  target,
  onClose,
  token,
  onSaveCaseRecheck,
  onSaveFollowUpRecheck,
  onLoginPrompt,
}) => {
  // Main form state
  const [judgmentText, setJudgmentText] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>('');
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [verifiedBy, setVerifiedBy] = useState<string>('');
  const [recheckNotes, setRecheckNotes] = useState<string>('');

  // Image manipulation state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [invertColors, setInvertColors] = useState<boolean>(false);

  // Search & spot check
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isExportingDoc, setIsExportingDoc] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!target) return;
    const item = target.data;
    if (target.type === 'case') {
      const c = item as AppealCase;
      setJudgmentText(c.fullJudgmentText || c.judgmentOutcome || '');
      setPhotoUrl(c.judgmentPhotoUrl || null);
      setPhotoName(c.judgmentPhotoName || 'ภาพถ่ายคำพิพากษา.jpg');
      setIsVerified(!!c.judgmentVerified);
      setVerifiedBy(c.judgmentVerifiedBy || c.responsiblePerson || 'นิติกรผู้ตรวจสอบ');
      setRecheckNotes(c.judgmentRecheckNotes || '');
    } else {
      const f = item as DailyJudgmentFollowUp;
      setJudgmentText(f.judgmentSummary || '');
      setPhotoUrl(f.judgmentPhotoUrl || null);
      setPhotoName(f.judgmentPhotoName || 'ภาพถ่ายคำพิพากษา.jpg');
      setIsVerified(!!f.judgmentVerified);
      setVerifiedBy(f.judgmentVerifiedBy || f.responsiblePerson || 'เจ้าหน้าที่ประจำวัน');
      setRecheckNotes(f.judgmentRecheckNotes || '');
    }

    // Reset viewer controls
    setZoomLevel(1);
    setRotation(0);
    setHighContrast(false);
    setInvertColors(false);
    setSearchKeyword('');
    setExportNotice(null);
  }, [target]);

  // Handle paste from clipboard (e.g. screenshot of judgment)
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
                setPhotoUrl(event.target.result as string);
                setPhotoName(`ภาพถ่ายคำพิพากษา_${new Date().toISOString().slice(0, 10)}.png`);
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen || !target) return null;

  const item = target.data;
  const isCase = target.type === 'case';
  const caseItem = isCase ? (item as AppealCase) : null;
  const followUpItem = !isCase ? (item as DailyJudgmentFollowUp) : null;

  const titleText = isCase
    ? `สำนวนดำ ${caseItem?.blackCaseNo} / แดง ${caseItem?.redCaseNo} • ${caseItem?.court}`
    : `คดี ${followUpItem?.caseNumber} • ${followUpItem?.court} (นัด ${formatThaiDate(followUpItem?.followUpDate || '')})`;

  // File Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
    setPhotoName('');
  };

  // Zoom and rotation
  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.25, 3.5));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  // Spot-check chips
  const quickChips = ['ยกฟ้อง', 'จำคุก', 'ปรับ', 'รอการลงโทษ', 'ริบทรัพย์สิน', 'ให้จำเลยชำระ', 'ขับไล่'];

  // Calculate Text Stats
  const wordCount = judgmentText.trim() ? judgmentText.trim().split(/\s+/).length : 0;
  const charCount = judgmentText.length;
  const lineCount = judgmentText ? judgmentText.split('\n').length : 0;

  // Save handler
  const handleSave = () => {
    if (isCase && caseItem && onSaveCaseRecheck) {
      onSaveCaseRecheck(
        caseItem.id,
        judgmentText,
        photoUrl || undefined,
        photoName || undefined,
        isVerified,
        verifiedBy,
        recheckNotes
      );
    } else if (!isCase && followUpItem && onSaveFollowUpRecheck) {
      onSaveFollowUpRecheck(
        followUpItem.id,
        judgmentText,
        photoUrl || undefined,
        photoName || undefined,
        isVerified,
        verifiedBy,
        recheckNotes
      );
    }
    onClose();
  };

  // Export to Google Docs
  const handleExportToGoogleDocs = async () => {
    if (!token) {
      if (onLoginPrompt) onLoginPrompt();
      return;
    }
    if (!judgmentText.trim()) {
      alert('กรุณากรอกข้อความคำพิพากษาก่อนส่งออก');
      return;
    }

    setIsExportingDoc(true);
    setExportNotice(null);
    try {
      if (isCase && caseItem) {
        const res = await createCaseJudgmentDoc(token, caseItem, judgmentText);
        setExportNotice(`ส่งออกเอกสารถึง Google Docs สำเร็จ: ${res.docUrl}`);
        if (onSaveCaseRecheck) {
          onSaveCaseRecheck(
            caseItem.id,
            judgmentText,
            photoUrl || undefined,
            photoName || undefined,
            isVerified,
            verifiedBy,
            recheckNotes
          );
        }
      } else if (followUpItem) {
        // Build mock case for follow-up
        const mockCase: AppealCase = {
          id: followUpItem.id,
          filingDate: followUpItem.followUpDate,
          blackCaseNo: followUpItem.caseNumber,
          redCaseNo: '-',
          court: followUpItem.court,
          plaintiff: followUpItem.plaintiff,
          defendant: followUpItem.defendant,
          caseType: 'คดีในศาล',
          judgmentDate: followUpItem.followUpDate,
          appealDeadline: followUpItem.followUpDate,
          isCompleted: false,
          responsiblePerson: followUpItem.responsiblePerson,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const res = await createCaseJudgmentDoc(token, mockCase, judgmentText);
        setExportNotice(`ส่งออกเอกสารถึง Google Docs สำเร็จ: ${res.docUrl}`);
      }
    } catch (e: any) {
      alert(`ไม่สามารถส่งออก Google Docs ได้: ${e.message}`);
    } finally {
      setIsExportingDoc(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full h-[92vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Prompt'] text-white">
                  สอบรีเช็คข้อความคำพิพากษา กับภาพถ่ายต้นฉบับ
                </h3>
                {isVerified ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    รีเช็คตรงกันแล้ว
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    รอการตรวจสอบ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{titleText}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg transition hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dual Panel Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden bg-slate-50">
          {/* Left Panel: ภาพถ่ายคำพิพากษา (Original Photo Viewer) */}
          <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
            {/* Toolbar for Image */}
            <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between flex-shrink-0 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-200">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span className="font-semibold truncate max-w-[200px]" title={photoName || 'ยังไม่มีภาพถ่าย'}>
                  {photoName || 'ภาพถ่ายคำพิพากษา'}
                </span>
                {photoUrl && (
                  <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                )}
              </div>

              {photoUrl ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleZoomIn}
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="ซูมเข้า"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="ซูมออก"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition text-[11px]"
                    title="รีเซ็ตขนาดปกติ"
                  >
                    100%
                  </button>
                  <button
                    onClick={handleRotate}
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="หมุนภาพ 90 องศา"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setHighContrast(!highContrast)}
                    className={`p-1.5 rounded text-[11px] transition flex items-center gap-0.5 ${
                      highContrast ? 'bg-amber-500 text-slate-950 font-bold' : 'hover:bg-slate-700 text-slate-300'
                    }`}
                    title="ปรับความคมชัดสูง (ช่วยให้อ่านหมึกพิมพ์จางง่ายขึ้น)"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">คมชัด</span>
                  </button>

                  <div className="w-px h-4 bg-slate-700 mx-1" />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline px-1.5 py-1"
                  >
                    เปลี่ยนภาพ
                  </button>
                  <button
                    onClick={handleRemovePhoto}
                    className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline px-1.5 py-1"
                  >
                    ลบภาพ
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>อัปโหลดภาพ</span>
                </button>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*,.pdf"
              className="hidden"
            />

            {/* Image Canvas / Viewport */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative select-none bg-slate-950/60">
              {photoUrl ? (
                <div
                  className="transition-transform duration-100 ease-out origin-center"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    filter: highContrast ? 'contrast(175%) brightness(95%)' : invertColors ? 'invert(1)' : 'none',
                  }}
                >
                  <img
                    src={photoUrl}
                    alt="ภาพถ่ายคำพิพากษาศาล"
                    className="max-w-full max-h-[70vh] rounded shadow-2xl object-contain border border-slate-700"
                    draggable={false}
                  />
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 rounded-2xl p-8 text-center max-w-sm cursor-pointer transition bg-slate-900/50 hover:bg-slate-900 flex flex-col items-center group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 flex items-center justify-center mb-3 transition">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-white font-['Prompt']">
                    ยังไม่มีภาพถ่ายคำพิพากษา
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    คลิกเพื่ออัปโหลดภาพถ่ายจากมือถือ กล้อง หรือสแกนเอกสาร <br />
                    <span className="text-amber-400 font-medium">หรือกดปุ่ม Ctrl + V เพื่อวางภาพที่แคปหน้าจอ</span>
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-600 group-hover:bg-amber-500 text-white px-3.5 py-1.5 rounded-xl transition shadow-xs">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์รูปภาพ</span>
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Tip */}
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>💡 คำแนะนำ: ซูมเข้าเพื่อเทียบข้อความคำพิพากษา เช่น หมายเลขคดี โทษจำคุก หรือคำสั่งยกฟ้อง</span>
              {photoUrl && (
                <span className="text-amber-300">หมุนภาพหรือกดปุ่มคมชัดเพื่อช่วยอ่านเอกสารจาง</span>
              )}
            </div>
          </div>

          {/* Right Panel: ข้อความคำพิพากษา & การรีเช็ค (Text Verification Editor) */}
          <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Search & Spot Check Bar */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>ข้อความคำพิพากษาที่กรอกในระบบ</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                  <span>{charCount} ตัวอักษร</span>
                  <span>•</span>
                  <span>{wordCount} คำ</span>
                  <span>•</span>
                  <span>{lineCount} บรรทัด</span>
                </div>
              </div>

              {/* Spot check keyword search */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="พิมพ์คำสำคัญเพื่อค้นหารีเช็คด่วน (เช่น จำคุก, ยกฟ้อง, ปรับ, บาท)..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {searchKeyword && (
                    <button
                      onClick={() => setSearchKeyword('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px]"
                    >
                      ล้าง
                    </button>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-1 flex-wrap">
                  {quickChips.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => setSearchKeyword(chip)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                        searchKeyword === chip
                          ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Textarea for Judgment Text */}
            <div className="flex-1 p-3.5 overflow-hidden flex flex-col relative">
              <textarea
                value={judgmentText}
                onChange={(e) => setJudgmentText(e.target.value)}
                placeholder="กรอกหรือคัดลอกข้อความคำพิพากษาฉบับเต็ม หรือคำพิพากษาโดยย่อลงที่นี่ เช่น:
ศาลพิเคราะห์พยานหลักฐานแล้ว เห็นว่าจำเลยมีความผิดตามประมวลกฎหมายอาญา มาตรา... ให้ลงโทษจำคุก 2 ปี ปรับ 40,000 บาท โทษจำคุกให้รอการลงโทษมีกำหนด 2 ปี..."
                className="w-full flex-1 p-3.5 text-xs font-mono leading-relaxed border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white resize-none"
              />

              {/* Keyword occurrences count if searched */}
              {searchKeyword && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      คำว่า <strong>"{searchKeyword}"</strong> ในข้อความ:{' '}
                      <strong className="text-amber-800">
                        {(judgmentText.match(new RegExp(searchKeyword, 'gi')) || []).length} ครั้ง
                      </strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-700">ตรวจดูว่าตรงกับภาพถ่ายคำพิพากษาด้านซ้ายหรือไม่</span>
                </div>
              )}
            </div>

            {/* Re-check Verification Form */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-3 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>ผลการสอบรีเช็คความถูกต้องระหว่างภาพถ่ายกับข้อความ:</span>
                </label>

                {/* Verification Toggle Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsVerified(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                      isVerified
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>ข้อความตรงกับภาพ 100%</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsVerified(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                      !isVerified
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>พบจุดต่าง / รอแก้ไข</span>
                  </button>
                </div>
              </div>

              {/* Inspector name and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block mb-0.5">
                    ผู้ตรวจรีเช็ค:
                  </span>
                  <input
                    type="text"
                    value={verifiedBy}
                    onChange={(e) => setVerifiedBy(e.target.value)}
                    placeholder="ชื่อผู้ตรวจรีเช็ค / เจ้าของสำนวน"
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-medium block mb-0.5">
                    บันทึกข้อสังเกตการรีเช็ค (ถ้ามี):
                  </span>
                  <input
                    type="text"
                    value={recheckNotes}
                    onChange={(e) => setRecheckNotes(e.target.value)}
                    placeholder="เช่น ตรวจสอบตัวเลขค่าปรับตรงกับคำพิพากษาแล้ว, ยกฟ้องจำเลยที่ 2"
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {exportNotice && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
                  <span>{exportNotice}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-500">
            {photoUrl ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                มีภาพถ่ายคำพิพากษาแนบพร้อมสำหรับสอบรีเช็ค
              </span>
            ) : (
              <span className="text-amber-700 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                ยังไม่มีภาพถ่าย (สามารถบันทึกข้อความก่อนได้ หรือกดอัปโหลดภาพ)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              ปิด
            </button>

            {token && (
              <button
                type="button"
                onClick={handleExportToGoogleDocs}
                disabled={isExportingDoc || !judgmentText.trim()}
                className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                title="ส่งออกข้อความที่รีเช็คแล้วไปยัง Google Docs"
              >
                {isExportingDoc ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>ส่งออก Google Docs</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>บันทึกผลการสอบรีเช็ค</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
