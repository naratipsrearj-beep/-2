import React, { useState, useEffect } from 'react';
import { X, Scale, Calendar, CheckCircle2, AlertCircle, Clock, Sparkles, FileText, Trash2 } from 'lucide-react';
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
    },
    syncToCalendar: boolean
  ) => void;
  onClearJudgment?: (caseId: string) => void;
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

export const RecordJudgmentModal: React.FC<RecordJudgmentModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  onSaveJudgmentDate,
  onClearJudgment,
}) => {
  const [judgmentDate, setJudgmentDate] = useState<string>(getTodayString());
  const [redCaseNo, setRedCaseNo] = useState<string>('');
  const [judgmentOutcome, setJudgmentOutcome] = useState<string>('');
  const [fullJudgmentText, setFullJudgmentText] = useState<string>('');
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
      setFullJudgmentText(caseItem.fullJudgmentText || '');
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
      },
      syncToCalendar
    );
    onClose();
  };

  const isEditingExisting = isJudgmentRecorded(caseItem);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt'] text-white">
                {isEditingExisting ? 'กรอก/แก้ไขคำพิพากษา & คุมอุทธรณ์ 1 เดือน' : 'กรอกคำพิพากษา & เริ่มคุมอุทธรณ์ 1 เดือน'}
              </h3>
              <p className="text-xs text-slate-300">
                สำนวนคดีดำ {caseItem.blackCaseNo} • {caseItem.court}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">โจทก์: {caseItem.plaintiff}</span>
              <span className="text-slate-500">จำเลย: {caseItem.defendant}</span>
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
              🛡️ เมื่อกรอกคำพิพากษาแล้ว ระบบจะคำนวณและเริ่มนับระยะเวลาคุมอุทธรณ์ 1 เดือน (พร้อมแจ้งเตือนตามกำหนด)
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
              <span className="text-[10px] text-slate-400">เลือกผลคำพิพากษาด่วนได้</span>
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
            <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>สาระสำคัญ / ข้อความคำพิพากษาฉบับเต็ม</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">พิมพ์หรือวางข้อความคำพิพากษา</span>
            </label>
            <textarea
              rows={3}
              placeholder="กรอกสาระสำคัญของคำพิพากษา คำวินิจฉัยของศาล หรือคัดลอกข้อความคำพิพากษามาวางที่นี่..."
              value={fullJudgmentText}
              onChange={(e) => setFullJudgmentText(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-sans leading-relaxed"
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
                  <span>ล้างคำพิพากษา (ตั้งเป็นยังไม่กรอก)</span>
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
  );
};
