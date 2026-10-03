import React, { useState } from 'react';
import { Clock, Calendar, AlertCircle, X, Check } from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate, getTodayString } from '../utils/dateUtils';

interface ExtendDeadlineModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  onClose: () => void;
  onConfirmExtend: (caseId: string, newDeadline: string, extensionCount: number, notes?: string) => void;
}

export const ExtendDeadlineModal: React.FC<ExtendDeadlineModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  onConfirmExtend,
}) => {
  if (!isOpen || !caseItem) return null;

  const currentDeadline = caseItem.extendedDeadline || caseItem.appealDeadline || getTodayString();
  const nextCount = (caseItem.extensionCount || 0) + 1;

  // Default new deadline to +30 days from current deadline
  const calculateDefaultNewDate = (): string => {
    try {
      const [y, m, d] = currentDeadline.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + 30);
      return dt.toISOString().slice(0, 10);
    } catch {
      return currentDeadline || getTodayString();
    }
  };

  const [newDeadline, setNewDeadline] = useState<string>(calculateDefaultNewDate());
  const [extensionCount, setExtensionCount] = useState<number>(nextCount);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeadline) {
      alert('กรุณาระบุวันครบกำหนดขยายเวลาใหม่');
      return;
    }
    onConfirmExtend(caseItem.id, newDeadline, extensionCount, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-amber-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt']">
                บันทึกการขอขยายระยะเวลาอุทธรณ์
              </h3>
              <p className="text-xs text-white/80">
                ดำ {caseItem.blackCaseNo} / แดง {caseItem.redCaseNo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">วันครบกำหนดเดิม:</span>
              <span className="font-bold text-rose-700">{formatThaiDate(currentDeadline)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ศาล:</span>
              <span>{caseItem.court}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ขยายเวลาครั้งที่ *
              </label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={extensionCount}
                onChange={(e) => setExtensionCount(parseInt(e.target.value, 10))}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                วันครบกำหนดใหม่ *
              </label>
              <input
                type="date"
                required
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              วันครบกำหนดใหม่: <strong>{formatThaiDate(newDeadline, { short: false })}</strong>
              <br />
              ระบบจะนับถอยหลังและแจ้งเตือนตามวันครบกำหนดขยายเวลานี้
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              คำสั่งศาล / เหตุผลการขอขยายเวลา
            </label>
            <input
              type="text"
              placeholder="เช่น ศาลอนุญาตให้ขยายเวลาอุทธรณ์ถึงวันที่..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
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
              <Check className="w-4 h-4" />
              <span>บันทึกการขยายเวลา</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
