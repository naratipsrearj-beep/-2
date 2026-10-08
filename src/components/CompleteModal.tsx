import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X, ShieldCheck, Undo2, Edit3, Save } from 'lucide-react';
import { AppealCase, CaseCompletionReason } from '../types/appeal';
import { formatThaiDate, getTodayString } from '../utils/dateUtils';

interface CompleteModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  onClose: () => void;
  onConfirmComplete: (
    caseId: string,
    reason: CaseCompletionReason,
    completedDate: string,
    notes?: string
  ) => void;
  onReopenCase?: (caseId: string) => void;
  onEditCase?: (caseItem: AppealCase) => void;
}

export const CompleteModal: React.FC<CompleteModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  onConfirmComplete,
  onReopenCase,
  onEditCase,
}) => {
  const [reason, setReason] = useState<CaseCompletionReason>('appealed');
  const [completedDate, setCompletedDate] = useState<string>(getTodayString());
  const [notes, setNotes] = useState('');

  // Pre-populate with case details when opening
  useEffect(() => {
    if (caseItem && isOpen) {
      setReason(caseItem.completionReason || 'appealed');
      setCompletedDate(caseItem.completedDate || getTodayString());
      setNotes(caseItem.notes || '');
    }
  }, [caseItem, isOpen]);

  if (!isOpen || !caseItem) return null;

  const isAlreadyCompleted = caseItem.isCompleted;

  const handleConfirm = () => {
    onConfirmComplete(caseItem.id, reason, completedDate, notes);
    onClose();
  };

  const handleReopen = () => {
    if (onReopenCase) {
      onReopenCase(caseItem.id);
      onClose();
    }
  };

  const handleOpenEditFullCase = () => {
    onClose();
    if (onEditCase) {
      onEditCase(caseItem);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className={`px-6 py-4 text-white flex items-center justify-between ${isAlreadyCompleted ? 'bg-slate-800' : 'bg-emerald-700'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt']">
                {isAlreadyCompleted ? 'แก้ไขวันที่เสร็จสิ้น / รายละเอียดการเสร็จสิ้น' : 'กรอกวันที่เสร็จสิ้น / บันทึกเสร็จสิ้นสำนวนคดี'}
              </h3>
              <p className="text-xs text-white/80">
                {isAlreadyCompleted
                  ? 'สามารถแก้ไขวันที่เสร็จสิ้น รายละเอียดการเสร็จสิ้น หรือกดยกเลิกเพื่อนำกลับมาติดตามใหม่'
                  : 'ระบุวันที่ดำเนินการเสร็จสิ้น (ยื่นอุทธรณ์/ยุติสำนวน) เมื่อบันทึกแล้วระบบจะหยุดการแจ้งเตือนสำหรับสำนวนนี้'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Case Info Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-bold text-slate-900 font-['Prompt'] text-sm">
                ดำ {caseItem.blackCaseNo} {caseItem.redCaseNo ? `/ แดง ${caseItem.redCaseNo}` : '(ยังไม่มีเลขแดง)'}
              </span>
              <span className="text-slate-500 font-medium">📍 {caseItem.court}</span>
            </div>
            <div className="text-slate-600">
              <span className="text-slate-500">โจทก์:</span> {caseItem.plaintiff} | <span className="text-slate-500">จำเลย:</span> {caseItem.defendant}
            </div>
            {caseItem.judgmentDate && (
              <div className="text-slate-600">
                <span className="text-slate-500">วันพิพากษา:</span> {formatThaiDate(caseItem.judgmentDate)}
              </div>
            )}
            {(caseItem.appealDeadline || caseItem.extendedDeadline) && (
              <div className="text-rose-700 font-semibold">
                <span>วันครบกำหนดอุทธรณ์ 1 เดือน:</span> {formatThaiDate(caseItem.extendedDeadline || caseItem.appealDeadline)}
              </div>
            )}
          </div>

          {/* Already completed notice & options */}
          {isAlreadyCompleted && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>สำนวนนี้ถูกบันทึกสถานะ "เสร็จสิ้นแล้ว"</span>
              </div>
              <p className="text-[11px] text-amber-800">
                เสร็จสิ้นเมื่อวันที่: <strong>{formatThaiDate(caseItem.completedDate)}</strong> (หยุดการแจ้งเตือน)
              </p>
              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleReopen}
                  className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-200/90 hover:bg-amber-300 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Undo2 className="w-3.5 h-3.5 text-amber-800" />
                  <span>กดยกเลิกเสร็จสิ้น (นำกลับมาติดตามใหม่)</span>
                </button>
                {onEditCase && (
                  <button
                    type="button"
                    onClick={handleOpenEditFullCase}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    <span>แก้ไขข้อมูลสำนวนทั้งหมด</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Editable Details Form */}
          <div className="space-y-3.5">
            {/* Reason Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                ผลการดำเนินการ / เหตุผลที่เสร็จสิ้น *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as CaseCompletionReason)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
              >
                <option value="appealed">ยื่นอุทธรณ์ต่อศาลเรียบร้อยแล้ว</option>
                <option value="no_appeal">มีคำสั่งไม่อุทธรณ์ / ยุติการดำเนินคดี</option>
                <option value="finalized">คดีถึงที่สุดตามคำพิพากษาศาลชั้นต้น</option>
                <option value="settled">คู่ความตกลงยอมความหรือชำระหนี้ครบถ้วนแล้ว</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>

            {/* Completed Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                วันที่ดำเนินการเสร็จสิ้น *
              </label>
              <input
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
              {completedDate && (
                <span className="text-[10px] text-emerald-700 block mt-0.5">
                  {formatThaiDate(completedDate)}
                </span>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                บันทึกข้อความ / รายละเอียดการยื่น / หมายเหตุเสร็จสิ้น
              </label>
              <textarea
                rows={2}
                placeholder="เช่น ยื่นอุทธรณ์ต่อศาลอาญาแล้ว มีใบเสร็จรับเงินค่าธรรมเนียม เลขที่..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {!isAlreadyCompleted && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">ผลกระทบของการกดเสร็จสิ้น:</strong>
                  <p className="text-[11px] mt-0.5 text-emerald-700">
                    สำนวนนี้จะถูกทำเครื่องหมายว่า "เสร็จสิ้นแล้ว" และ<strong>ระบบจะไม่นำมาแจ้งเตือนเตือนภัยอีกต่อไป</strong> โดยท่านสามารถกดยกเลิกเสร็จสิ้นหรือแก้ไขรายละเอียดได้ทุกเมื่อ
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
            {isAlreadyCompleted ? (
              <button
                type="button"
                onClick={handleReopen}
                className="px-3.5 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Undo2 className="w-4 h-4" />
                <span>กดยกเลิกเสร็จสิ้น</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                ปิด
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isAlreadyCompleted ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>บันทึกการแก้ไขวันที่เสร็จสิ้น</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>บันทึกวันที่เสร็จสิ้น (หยุดแจ้งเตือน)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

