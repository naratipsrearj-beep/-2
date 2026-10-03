import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Sparkles,
  AlertCircle,
  X,
  CheckCircle2,
  Calendar,
  Loader2
} from 'lucide-react';
import { analyzeDutyRosterFile } from '../services/dutyService';
import { MonthlyDutyRoster } from '../types/appeal';

interface UploadDutyRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (roster: MonthlyDutyRoster) => void;
  showToast: (msg: string) => void;
}

export const UploadDutyRosterModal: React.FC<UploadDutyRosterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customMonth, setCustomMonth] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    // Validate file type: PDF or image
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WEBP) หรือเอกสาร PDF เท่านั้น');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('ขนาดไฟล์เกิน 25MB กรุณาเลือกไฟล์ที่มีขนาดเล็กลง');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      showToast('กำลังส่งไฟล์ให้ AI วิเคราะห์ตารางเวรชี้...');
      const roster = await analyzeDutyRosterFile(selectedFile, customMonth.trim() || undefined);
      showToast(`วิเคราะห์สำเร็จ! พบข้อมูลเวรชี้ประจำเดือน "${roster.monthNameThai}" ทั้งหมด ${roster.duties.length} วัน`);
      onSuccess(roster);
      onClose();
    } catch (err: any) {
      console.error('Failed to analyze duty roster:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์ไฟล์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-bold font-['Prompt'] text-white">
                อัพโหลดไฟล์ภาพ / PDF ตารางเวรชี้
              </h3>
              <p className="text-xs text-amber-100">
                ระบบ AI จะอ่านเอกสารและวิเคราะห์รายชื่อเวรชี้ในแต่ละวันของรอบเดือนนั้นโดยอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isAnalyzing}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Upload Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
              selectedFile
                ? 'border-amber-500 bg-amber-50/50'
                : 'border-slate-300 hover:border-amber-400 bg-slate-50/70 hover:bg-amber-50/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp,image/heic"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            {selectedFile ? (
              <div className="w-full flex flex-col items-center gap-2">
                {previewUrl ? (
                  <div className="relative max-h-40 rounded-lg overflow-hidden border border-amber-300 shadow-sm">
                    <img src={previewUrl} alt="Preview" className="max-h-40 object-contain rounded-lg" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
                    <FileText className="w-8 h-8" />
                  </div>
                )}
                <div className="text-center mt-1">
                  <p className="text-sm font-semibold text-slate-800 break-all">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">
                    ขนาด: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • คลิกเพื่อเปลี่ยนไฟล์
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    ลากไฟล์มาวางที่นี่ หรือ <span className="text-amber-600 underline">คลิกเพื่อเลือกไฟล์</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    รองรับไฟล์เอกสาร PDF หรือภาพถ่ายตารางเวร (JPG, PNG, WEBP)
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Optional Month Specification */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>ระบุรอบเดือน (ไม่บังคับ - AI สามารถอ่านจากหัวกระดาษได้เอง):</span>
            </label>
            <input
              type="text"
              placeholder="เช่น ตุลาคม 2569, พฤศจิกายน 2569 หรือ 2026-10"
              value={customMonth}
              onChange={(e) => setCustomMonth(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            <p className="text-[11px] text-slate-500">
              💡 หากในภาพไม่ระบุเดือนชัดเจน หรือต้องการเจาะจงรอบเดือน สามารถพิมพ์กำกับไว้ได้ครับ
            </p>
          </div>

          {/* AI Info Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-950">AI จะวิเคราะห์อะไรบ้าง:</p>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-[11px]">
                <li>สกัดรายชื่อเวรชี้ทุกวันในรอบเดือน (เวรชี้ 1, เวรชี้ 2, อัยการประจำกอง, นิติกร)</li>
                <li>ตรวจจับห้องพิจารณาคดี บัลลังก์ และรอบเวลา (เช้า/บ่าย/ตลอดวัน)</li>
                <li>จำแนกวันหยุดราชการและวันเสาร์-อาทิตย์</li>
                <li>เชื่อมโยงเพื่อบอกได้ทันทีว่า "ใครเป็นเวรชี้ในวันนั้น" เมื่อคลิกเลือกวันที่</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isAnalyzing}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/60 transition disabled:opacity-50"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleStartAnalysis}
            disabled={!selectedFile || isAnalyzing}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-md shadow-amber-600/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>กำลังวิเคราะห์ตารางเวรด้วย AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>เริ่มวิเคราะห์ตารางเวรชี้</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
