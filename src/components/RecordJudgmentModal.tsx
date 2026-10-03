import React, { useState, useEffect } from 'react';
import { X, Scale, Calendar, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { calculateAppealDeadline, formatThaiDate, getTodayString } from '../utils/dateUtils';

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
    },
    syncToCalendar: boolean
  ) => void;
}

export const RecordJudgmentModal: React.FC<RecordJudgmentModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  onSaveJudgmentDate,
}) => {
  const [judgmentDate, setJudgmentDate] = useState<string>(getTodayString());
  const [redCaseNo, setRedCaseNo] = useState<string>('');
  const [judgmentOutcome, setJudgmentOutcome] = useState<string>('');
  const [syncToCalendar, setSyncToCalendar] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      setErrorMsg(null);
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

  if (!isOpen || !caseItem) return null;

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

    onSaveJudgmentDate(
      caseItem.id,
      {
        judgmentDate,
        redCaseNo: redCaseNo.trim() || undefined,
        judgmentOutcome: judgmentOutcome.trim(),
        appealDeadline: deadlineInfo.deadlineDate,
      },
      syncToCalendar
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt'] text-white">
                บันทึกคำพิพากษา & เริ่มคุมอุทธรณ์ 1 เดือน
              </h3>
              <p className="text-xs text-slate-300">
                สำนวนคดีดำ {caseItem.blackCaseNo} • {caseItem.court}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">โจทก์: {caseItem.plaintiff}</span>
              <span className="text-slate-500">จำเลย: {caseItem.defendant}</span>
            </div>
            {caseItem.prosecutorName && (
              <div className="text-amber-800">
                <span>อัยการเจ้าของสำนวน: {caseItem.prosecutorName}</span>
              </div>
            )}
            <div className="text-[11px] text-indigo-700 bg-indigo-50/80 p-1.5 rounded border border-indigo-100 mt-1">
              🛡️ สำนวนเดิม: จำเลยให้การปฏิเสธ / มีนัดพิจารณา เมื่อศาลมีคำพิพากษาแล้ว ระบบจะเริ่มคำนวณและแจ้งเตือนกำหนดเวลาอุทธรณ์ 1 เดือน
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Judgment Date & Appeal Deadline */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-amber-950 mb-1 flex items-center justify-between">
                <span>วันที่ศาลอ่านคำพิพากษา *</span>
                <span className="text-[10px] text-amber-800 font-normal">เริ่มนับกำหนดเวลาอุทธรณ์ 1 เดือน</span>
              </label>
              <input
                type="date"
                required
                value={judgmentDate}
                onChange={(e) => setJudgmentDate(e.target.value)}
                className="w-full text-xs border border-amber-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
              {judgmentDate && (
                <span className="text-[11px] text-amber-900 font-semibold block mt-1">
                  ตรงกับ: {formatThaiDate(judgmentDate, { short: false })}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-rose-950 mb-1">
                วันครบกำหนดอุทธรณ์ 1 เดือน (คำนวณอัตโนมัติ)
              </label>
              <div className="text-sm font-bold text-rose-700 bg-white border border-rose-300 rounded-xl px-3 py-2">
                {deadlineInfo.deadlineDate ? formatThaiDate(deadlineInfo.deadlineDate, { short: false }) : 'กรุณาระบุวันพิพากษา'}
              </div>
              {deadlineInfo.isAdjustedForWeekend && (
                <span className="text-[10px] text-amber-700 font-medium block mt-1">
                  ⚡ วันครบกำหนดเดิมตรงกับวันหยุดเสาร์-อาทิตย์ กฎหมายเลื่อนเป็นวันทำการถัดไป (ป.พ.พ. มาตรา 193/8)
                </span>
              )}
            </div>
          </div>

          {/* Red Case No. */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              หมายเลขคดีแดง (ถ้าทราบ)
            </label>
            <input
              type="text"
              placeholder="เช่น อ.891/2569"
              value={redCaseNo}
              onChange={(e) => setRedCaseNo(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Judgment Outcome */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              ผลคำพิพากษาโดยย่อ
            </label>
            <input
              type="text"
              placeholder="เช่น ลงโทษจำคุก 2 ปี ปรับ 50,000 บาท รอการลงโทษ 2 ปี, ยกฟ้อง"
              value={judgmentOutcome}
              onChange={(e) => setJudgmentOutcome(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
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
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>เริ่มคุมระยะเวลาอุทธรณ์ 1 เดือน</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
