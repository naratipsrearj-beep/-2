import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  X,
  UserCheck,
  Scale,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  Clock,
  Sparkles,
  Info,
  Check,
  ShieldAlert
} from 'lucide-react';
import { AppealCase, MonthlyDutyRoster } from '../types/appeal';
import { getTodayString, formatThaiDate } from '../utils/dateUtils';
import { getDutyOfficersForDate, getAllOfficersGroupedByMonth } from '../services/dutyService';

interface SubmitToDutyModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  dutyRosters: MonthlyDutyRoster[];
  existingCases?: AppealCase[];
  onClose: () => void;
  onConfirmSubmitToDuty: (
    caseId: string,
    dutyOfficer: string,
    submissionDate: string,
    notes?: string
  ) => Promise<void> | void;
  onCancelSubmitToDuty?: (caseId: string) => Promise<void> | void;
  onToast?: (message: string) => void;
}

export const SubmitToDutyModal: React.FC<SubmitToDutyModalProps> = ({
  isOpen,
  caseItem,
  dutyRosters,
  existingCases = [],
  onClose,
  onConfirmSubmitToDuty,
  onCancelSubmitToDuty,
  onToast,
}) => {
  const [dutyOfficer, setDutyOfficer] = useState('');
  const [submissionDate, setSubmissionDate] = useState(getTodayString());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ดึงรายชื่อเวรชี้ประจำวันตามวันที่ยื่นฟ้องหรือวันที่เสนอ
  const officersOnFilingDate = useMemo(() => {
    if (!caseItem?.filingDate) return [];
    return getDutyOfficersForDate(dutyRosters, caseItem.filingDate);
  }, [dutyRosters, caseItem?.filingDate]);

  const officersOnToday = useMemo(() => {
    return getDutyOfficersForDate(dutyRosters, getTodayString());
  }, [dutyRosters]);

  // ดึงรายชื่อเวรชี้และอัยการทั้งหมดที่เคยมีในระบบ
  const allKnownOfficers = useMemo(() => {
    const names = new Set<string>();

    // จากตารางเวรชี้
    dutyRosters.forEach((r) => {
      r.duties.forEach((d) => {
        d.officers?.forEach((o) => {
          if (o.name && o.name.trim()) names.add(o.name.trim());
        });
      });
    });

    // จากสำนวนคดี
    existingCases.forEach((c) => {
      if (c.prosecutorName && c.prosecutorName.trim()) names.add(c.prosecutorName.trim());
      if (c.responsiblePerson && c.responsiblePerson.trim() && c.responsiblePerson !== 'ผู้ดูแลสำนวน') {
        names.add(c.responsiblePerson.trim());
      }
      if (c.submittedToDutyOfficer && c.submittedToDutyOfficer.trim()) {
        names.add(c.submittedToDutyOfficer.trim());
      }
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b, 'th'));
  }, [dutyRosters, existingCases]);

  useEffect(() => {
    if (caseItem) {
      const initialOfficer =
        caseItem.submittedToDutyOfficer ||
        caseItem.prosecutorName ||
        officersOnFilingDate[0]?.name ||
        officersOnToday[0]?.name ||
        '';
      setDutyOfficer(initialOfficer);
      setSubmissionDate(caseItem.submittedToDutyDate || getTodayString());
      setNotes(caseItem.submittedToDutyNotes || '');
    }
  }, [caseItem, officersOnFilingDate, officersOnToday]);

  if (!isOpen || !caseItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalOfficer = dutyOfficer.trim() || caseItem.prosecutorName || '';

    try {
      setIsSubmitting(true);
      await onConfirmSubmitToDuty(
        caseItem.id,
        finalOfficer,
        submissionDate || getTodayString(),
        notes.trim()
      );
      onClose();
    } catch (err) {
      console.error('Error submitting to duty officer:', err);
      onToast?.('เกิดข้อผิดพลาดในการบันทึกเสนอเวรชี้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmission = async () => {
    if (!onCancelSubmitToDuty) return;
    if (window.confirm(`ต้องการยกเลิกสถานะ "เสนอเวรชี้" สำหรับสำนวน ${caseItem.blackCaseNo} ใช่หรือไม่?`)) {
      try {
        setIsSubmitting(true);
        await onCancelSubmitToDuty(caseItem.id);
        onClose();
      } catch (err) {
        console.error('Error cancelling duty submission:', err);
        onToast?.('เกิดข้อผิดพลาดในการยกเลิกสถานะเสนอเวรชี้');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const notePresets = [
    'เสนอเวรชี้ตรวจสอบคำให้การและผลการชี้คดี',
    'เสนอพร้อมสำนวนฟ้อง',
    'เสนอเวรชี้เพื่อทราบวันนัดศาล',
    'เวรชี้ลงนามตรวจสอบเรียบร้อยแล้ว',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-blue-200 shadow-inner">
              <Send className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white font-['Prompt']">
                  {caseItem.isSubmittedToDuty ? 'แก้ไขข้อมูลการเสนอเวรชี้' : 'เสนอเวรชี้ (ส่งสำนวนให้อัยการเวรชี้)'}
                </h3>
                {caseItem.isSubmittedToDuty && (
                  <span className="text-[10px] bg-emerald-400 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                    เสนอแล้ว
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                ดำ {caseItem.blackCaseNo} {caseItem.redCaseNo ? `• แดง ${caseItem.redCaseNo}` : ''} • {caseItem.court || 'ศาล'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm text-slate-700">
          {/* Crucial Banner: ยังคุมอุทธรณ์อยู่จนกว่าจะกดเสร็จสิ้น */}
          <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-start gap-2.5 shadow-2xs">
            <Scale className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-blue-950">
              <strong className="font-bold text-blue-900 block mb-0.5 font-['Prompt']">
                ⚖️ ระบบคุมระยะเวลาอุทธรณ์ยังคงทำงานอย่างต่อเนื่อง:
              </strong>
              <span>
                เมื่อกดบันทึก <strong>"เสนอเวรชี้"</strong> แล้ว สำนวนนี้จะ<strong>ยังคงถูกคุมระยะเวลาอุทธรณ์ 1 เดือน</strong> (หรือคุมขั้นตอนนัดพิจารณา) ต่อไปตามปกติ ไม่ถูกปิดการติดตาม จนกว่าจะมีการกด <strong>"เสร็จสิ้น"</strong> สำนวนจริง
              </span>
            </div>
          </div>

          {/* Case Info Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">เลขคดีดำ:</span>
              <span className="font-bold text-slate-800">{caseItem.blackCaseNo}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">จำเลย:</span>
              <span className="font-semibold text-slate-800 truncate block">{caseItem.defendant || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">วันที่ยื่นฟ้อง:</span>
              <span className="font-medium text-slate-700">{caseItem.filingDate ? formatThaiDate(caseItem.filingDate) : '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">อัยการเจ้าของสำนวน:</span>
              <span className="font-semibold text-indigo-900 truncate block">{caseItem.responsiblePerson || 'ไม่ระบุ'}</span>
            </div>
          </div>

          {/* Field 1: เลือกอัยการเวรชี้ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>ระบุ / แก้ไขชื่ออัยการเวรชี้ที่เสนอ (ไม่บังคับ):</span>
              </label>
              {caseItem.prosecutorName && (
                <span className="text-[11px] text-slate-500">
                  เวรชี้เดิม: <strong className="text-slate-700">{caseItem.prosecutorName}</strong>
                </span>
              )}
            </div>

            {/* Quick duty officer pills */}
            {(officersOnFilingDate.length > 0 || officersOnToday.length > 0) && (
              <div className="mb-2 p-2 bg-amber-50/70 border border-amber-200 rounded-lg">
                <div className="text-[11px] font-semibold text-amber-900 mb-1 flex items-center gap-1">
                  <span>⚡ เลือกเวรชี้จากตารางเวร:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {officersOnFilingDate.map((off, idx) => (
                    <button
                      key={`filing_${idx}`}
                      type="button"
                      onClick={() => setDutyOfficer(off.name)}
                      className={`px-2 py-0.5 text-xs rounded-md transition border cursor-pointer flex items-center gap-1 ${
                        dutyOfficer === off.name
                          ? 'bg-blue-600 text-white border-blue-700 font-bold shadow-2xs'
                          : 'bg-white text-slate-800 border-amber-300 hover:bg-amber-100 font-medium'
                      }`}
                      title={`เวรชี้วันฟ้อง (${formatThaiDate(caseItem.filingDate)}): ${off.name}`}
                    >
                      <UserCheck className="w-3 h-3 text-amber-600" />
                      <span>{off.name} (เวรวันฟ้อง)</span>
                    </button>
                  ))}
                  {officersOnToday
                    .filter((off) => !officersOnFilingDate.some((f) => f.name === off.name))
                    .map((off, idx) => (
                      <button
                        key={`today_${idx}`}
                        type="button"
                        onClick={() => setDutyOfficer(off.name)}
                        className={`px-2 py-0.5 text-xs rounded-md transition border cursor-pointer flex items-center gap-1 ${
                          dutyOfficer === off.name
                            ? 'bg-blue-600 text-white border-blue-700 font-bold shadow-2xs'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100 font-medium'
                        }`}
                        title={`เวรชี้วันนี้ (${formatThaiDate(getTodayString())}): ${off.name}`}
                      >
                        <Clock className="w-3 h-3 text-blue-500" />
                        <span>{off.name} (เวรวันนี้)</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <input
                type="text"
                value={dutyOfficer}
                onChange={(e) => setDutyOfficer(e.target.value)}
                placeholder="พิมพ์ชื่อ-สกุล อัยการเวรชี้ (หรือเว้นว่างไว้)..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />

              {/* Quick select dropdown */}
              {allKnownOfficers.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-slate-400 shrink-0">หรือเลือกจากรายชื่อ:</span>
                  <select
                    value={dutyOfficer}
                    onChange={(e) => setDutyOfficer(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs bg-white text-slate-700 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">-- เลือกจากรายชื่ออัยการ / เวรชี้ --</option>
                    {allKnownOfficers.map((name, idx) => (
                      <option key={idx} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Field 2: วันที่เสนอเวรชี้ */}
          <div>
            <label className="font-semibold text-slate-800 text-xs flex items-center gap-1.5 mb-1">
              <Calendar className="w-4 h-4 text-slate-600" />
              <span>วันที่เสนอเวรชี้:</span>
              <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                required
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <span className="text-xs text-slate-600 font-medium">
                {submissionDate ? formatThaiDate(submissionDate) : ''}
              </span>
              <button
                type="button"
                onClick={() => setSubmissionDate(getTodayString())}
                className="ml-auto text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                ใส่วันนี้
              </button>
            </div>
          </div>

          {/* Field 3: หมายเหตุ / รายละเอียดการเสนอ */}
          <div>
            <label className="font-semibold text-slate-800 text-xs flex items-center gap-1.5 mb-1">
              <FileText className="w-4 h-4 text-slate-600" />
              <span>หมายเหตุการเสนอเวรชี้ (ถ้ามี):</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ระบุข้อความหรือบันทึกที่เสนอให้อัยการเวรชี้ เช่น เสนอพร้อมสำนวน, แจ้งวันนัดสืบเสาะ..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            {/* Presets */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {notePresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNotes(preset)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            <div>
              {caseItem.isSubmittedToDuty && onCancelSubmitToDuty && (
                <button
                  type="button"
                  onClick={handleCancelSubmission}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer active:scale-95 disabled:opacity-50"
                  title="ยกเลิกสถานะเสนอเวรชี้สำหรับสำนวนนี้"
                >
                  ✕ ยกเลิกสถานะเสนอเวรชี้
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 active:scale-95 rounded-xl transition shadow-md shadow-blue-700/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmitting ? 'กำลังบันทึก...' : '✓ บันทึกเสนอเวรชี้ (ยังคุมอุทธรณ์)'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
