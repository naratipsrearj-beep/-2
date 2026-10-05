import React, { useState, useEffect } from 'react';
import { Clock, Calendar, AlertCircle, X, Check, Edit3, Plus, RotateCcw, Trash2, FileText, ExternalLink, Loader2, Scale } from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate, getTodayString } from '../utils/dateUtils';
import { createAppealExtensionMemoDoc } from '../services/docsService';
import { getAccessToken } from '../services/auth';

interface ExtendDeadlineModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  onClose: () => void;
  onConfirmExtend: (caseId: string, newDeadline: string | null, extensionCount: number, notes?: string) => void;
  token?: string | null;
  onToast?: (msg: string) => void;
  onOpenCourtPetition?: (caseItem: AppealCase, newDeadline?: string, extensionCount?: number) => void;
}

export const ExtendDeadlineModal: React.FC<ExtendDeadlineModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  onConfirmExtend,
  token,
  onToast,
  onOpenCourtPetition,
}) => {
  const hasExistingExtension = Boolean(caseItem?.extendedDeadline);

  // Mode: 'edit' (แก้ไขวันเดิมที่เคยกรอกไว้), 'next' (ขอขยายเวลาครั้งถัดไป), 'new' (ขยายครั้งแรก)
  const [mode, setMode] = useState<'edit' | 'next' | 'new'>('edit');
  const [newDeadline, setNewDeadline] = useState<string>('');
  const [extensionCount, setExtensionCount] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [createdDocUrl, setCreatedDocUrl] = useState<string | null>(null);

  // Helper to add days to a date string YYYY-MM-DD
  const addDaysToDate = (baseDate: string, days: number): string => {
    try {
      const [y, m, d] = baseDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + days);
      return dt.toISOString().slice(0, 10);
    } catch {
      return baseDate || getTodayString();
    }
  };

  // Sync state whenever modal opens or caseItem changes
  useEffect(() => {
    if (!isOpen || !caseItem) return;

    if (caseItem.extendedDeadline) {
      setMode('edit');
      setNewDeadline(caseItem.extendedDeadline);
      setExtensionCount(caseItem.extensionCount || 1);
    } else {
      setMode('new');
      const base = caseItem.appealDeadline || getTodayString();
      setNewDeadline(addDaysToDate(base, 30));
      setExtensionCount(1);
    }
    setNotes('');
    setCreatedDocUrl(null);
  }, [isOpen, caseItem]);

  if (!isOpen || !caseItem) return null;

  const currentEffectiveDeadline = caseItem.extendedDeadline || caseItem.appealDeadline || getTodayString();

  // Create Google Docs Memo for Extension
  const handleCreateDoc = async () => {
    if (!newDeadline) {
      alert('กรุณาระบุวันครบกำหนดขยายเวลาใหม่ก่อนสร้างเอกสาร');
      return;
    }
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      if (onToast) onToast('โปรดเข้าสู่ระบบ Google เพื่อสร้างเอกสาร Google Docs');
      return;
    }

    try {
      setIsCreatingDoc(true);
      const res = await createAppealExtensionMemoDoc(
        currentToken,
        caseItem,
        newDeadline,
        extensionCount,
        notes
      );
      setCreatedDocUrl(res.docUrl);
      if (onToast) onToast('สร้างบันทึกข้อความขอขยายเวลาใน Google Docs สำเร็จแล้ว');
      window.open(res.docUrl, '_blank');
    } catch (err: any) {
      console.error('Doc creation error:', err);
      if (onToast) onToast(`ไม่สามารถสร้าง Google Docs ได้: ${err.message || 'เกิดข้อผิดพลาด'}`);
    } finally {
      setIsCreatingDoc(false);
    }
  };

  // Switch to Edit Mode (แก้ไขวันขยายเวลาเดิมที่กรอกไปแล้ว)
  const handleSwitchToEdit = () => {
    setMode('edit');
    setNewDeadline(caseItem.extendedDeadline || getTodayString());
    setExtensionCount(caseItem.extensionCount || 1);
  };

  // Switch to Next Extension Mode (ขอขยายเวลาเพิ่มอีก 1 ครั้ง)
  const handleSwitchToNext = () => {
    setMode('next');
    const base = caseItem.extendedDeadline || caseItem.appealDeadline || getTodayString();
    setNewDeadline(addDaysToDate(base, 30));
    setExtensionCount((caseItem.extensionCount || 1) + 1);
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeadline) {
      alert('กรุณาระบุวันครบกำหนดขยายเวลาให้ถูกต้อง');
      return;
    }
    onConfirmExtend(caseItem.id, newDeadline, extensionCount, notes.trim() || undefined);
    onClose();
  };

  // Clear / Revert Extension Handler
  const handleRevertExtension = () => {
    const originalText = caseItem.appealDeadline
      ? formatThaiDate(caseItem.appealDeadline, { short: false })
      : 'วันครบกำหนดเดิม';

    const confirmMsg = `ต้องการยกเลิกการขยายระยะเวลาอุทธรณ์ของสำนวน ดำ ${caseItem.blackCaseNo} ใช่หรือไม่?\n\nระบบจะคืนค่าวันครบกำหนดอุทธรณ์กลับเป็น: ${originalText}`;
    if (window.confirm(confirmMsg)) {
      onConfirmExtend(caseItem.id, null, 0, 'ยกเลิกการขยายเวลา (คืนค่าวันครบกำหนดเดิม)');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-amber-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt']">
                {hasExistingExtension ? 'จัดการ / แก้ไขวันขยายระยะเวลาอุทธรณ์' : 'บันทึกการขอขยายระยะเวลาอุทธรณ์'}
              </h3>
              <p className="text-xs text-white/90">
                ดำ {caseItem.blackCaseNo} {caseItem.redCaseNo ? `/ แดง ${caseItem.redCaseNo}` : ''} ({caseItem.court})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Extension Tabs Switcher */}
        {hasExistingExtension && (
          <div className="bg-amber-50/80 px-6 pt-3 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSwitchToEdit}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer border-t border-x ${
                  mode === 'edit'
                    ? 'bg-white text-amber-900 border-amber-300 -mb-px shadow-xs'
                    : 'bg-transparent text-amber-700/80 border-transparent hover:text-amber-900 hover:bg-amber-100/50'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                <span>แก้ไขวันที่ที่กรอกไว้ (ครั้งที่ {caseItem.extensionCount || 1})</span>
              </button>

              <button
                type="button"
                onClick={handleSwitchToNext}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 cursor-pointer border-t border-x ${
                  mode === 'next'
                    ? 'bg-white text-amber-900 border-amber-300 -mb-px shadow-xs'
                    : 'bg-transparent text-amber-700/80 border-transparent hover:text-amber-900 hover:bg-amber-100/50'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>ขอขยายเวลาเพิ่มอีก 1 ครั้ง (ครั้งที่ {(caseItem.extensionCount || 1) + 1})</span>
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Reference Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">วันพิพากษา:</span>
              <span className="font-medium text-slate-800">
                {caseItem.judgmentDate ? formatThaiDate(caseItem.judgmentDate) : 'ไม่ระบุ'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">วันครบกำหนด 1 เดือนตามคำพิพากษา:</span>
              <span className="font-semibold text-slate-700">
                {caseItem.appealDeadline ? formatThaiDate(caseItem.appealDeadline) : '-'}
              </span>
            </div>
            {hasExistingExtension && (
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/80">
                <span className="text-amber-700 font-medium">วันขยายเวลาที่บันทึกอยู่ในระบบปัจจุบัน:</span>
                <span className="font-bold text-rose-700">
                  {formatThaiDate(caseItem.extendedDeadline!)} (ครั้งที่ {caseItem.extensionCount || 1})
                </span>
              </div>
            )}
          </div>

          {/* Mode Guidance Alert */}
          {mode === 'edit' && (
            <div className="text-xs text-amber-900 bg-amber-50/90 border border-amber-200 p-3 rounded-xl flex items-start gap-2.5">
              <Edit3 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">โหมดแก้ไขวันขยายเวลาที่กรอกไว้</strong>
                <span>
                  หากกรอกวันครบกำหนดขยายเวลาผิด สามารถเลือกวันที่ถูกต้องใหม่ด้านล่างแล้วกดบันทึกเพื่อแก้ไขได้ทันที
                </span>
              </div>
            </div>
          )}

          {mode === 'next' && (
            <div className="text-xs text-indigo-900 bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-start gap-2.5">
              <Plus className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">โหมดขอขยายระยะเวลาอุทธรณ์เพิ่มอีก 1 ครั้ง</strong>
                <span>
                  ระบบได้ปรับลำดับครั้งที่ขยายเป็นครั้งที่ {extensionCount} และตั้งวันครบกำหนดถัดไปให้อัตโนมัติ (+30 วัน)
                </span>
              </div>
            </div>
          )}

          {/* Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ขยายเวลาครั้งที่ *
              </label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={extensionCount}
                onChange={(e) => setExtensionCount(parseInt(e.target.value, 10) || 1)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {mode === 'edit' ? 'วันครบกำหนดขยายเวลาที่ถูกต้อง *' : 'วันครบกำหนดใหม่ *'}
              </label>
              <input
                type="date"
                required
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="w-full text-xs border border-amber-300 rounded-xl px-3 py-2.5 bg-amber-50/30 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold text-rose-800"
              />
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>ปรับด่วน:</span>
            <button
              type="button"
              onClick={() => setNewDeadline(addDaysToDate(newDeadline || currentEffectiveDeadline, 15))}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition text-[11px]"
            >
              +15 วัน
            </button>
            <button
              type="button"
              onClick={() => setNewDeadline(addDaysToDate(newDeadline || currentEffectiveDeadline, 30))}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition text-[11px]"
            >
              +30 วัน
            </button>
            {caseItem.appealDeadline && (
              <button
                type="button"
                onClick={() => setNewDeadline(addDaysToDate(caseItem.appealDeadline!, 30))}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition text-[11px]"
                title="ตั้งเป็น 30 วันนับแต่วันครบกำหนด 1 เดือน"
              >
                +30 วันจากครบ 1 ด.
              </button>
            )}
          </div>

          {/* Date Preview Box */}
          {newDeadline && (
            <div className="text-xs text-amber-900 bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl flex items-center justify-between">
              <span className="text-slate-600 font-medium">วันครบกำหนดที่ระบุ:</span>
              <strong className="text-rose-700 font-bold">
                {formatThaiDate(newDeadline, { short: false })} (ขยายครั้งที่ {extensionCount})
              </strong>
            </div>
          )}

          {/* Notes / Court Order */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              คำสั่งศาล / หมายเหตุเหตุผลการขอขยายเวลา
            </label>
            <input
              type="text"
              placeholder="เช่น ศาลอนุญาตให้ขยายเวลาอุทธรณ์ถึงวันที่..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Court Petition Tool (แบบพิมพ์ศาล ๗ พร้อมพิมพ์ลงกระดาษตราครุฑ) */}
          {onOpenCourtPetition && (
            <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                  <Scale className="w-4 h-4" />
                </div>
                <div className="text-xs min-w-0">
                  <strong className="text-amber-950 block font-semibold truncate">
                    แบบคำร้องศาล (แบบพิมพ์ศาล ๗ พิมพ์ลงกระดาษตราครุฑ)
                  </strong>
                  <span className="text-amber-800/80 text-[11px] block truncate">
                    ดึงข้อมูลคดีดำ/แดง ศาลเพชรบุรี กำหนดเดิม/ใหม่ ออกแบบพิมพ์ศาลเปิดดูและพิมพ์ได้ทันที
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenCourtPetition(caseItem, newDeadline, extensionCount)}
                className="px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 border border-amber-400 rounded-lg transition shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>เปิดแบบคำร้อง ↗</span>
              </button>
            </div>
          )}

          {/* Google Docs Extension Memo Tool */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-xs min-w-0">
                <strong className="text-blue-950 block font-semibold truncate">สร้างบันทึกข้อความขอขยายเวลา (Google Docs)</strong>
                <span className="text-blue-700/80 text-[11px] block truncate">ดึงเลขคดี คู่ความ วันพิพากษา และเหตุผลทำเอกสารราชการพร้อมสั่งพิมพ์</span>
              </div>
            </div>
            {createdDocUrl ? (
              <a
                href={createdDocUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-2xs flex items-center gap-1 shrink-0"
              >
                <span>เปิด Docs ↗</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                type="button"
                onClick={handleCreateDoc}
                disabled={isCreatingDoc}
                className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg transition shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isCreatingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                <span>{isCreatingDoc ? 'กำลังสร้าง...' : 'สร้าง Docs'}</span>
              </button>
            )}
          </div>

          {/* Actions Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              {hasExistingExtension && (
                <button
                  type="button"
                  onClick={handleRevertExtension}
                  className="px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="ลบข้อมูลการขยายเวลาและคืนค่าวันครบกำหนดตามคำพิพากษาเดิม"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ยกเลิกการขยายเวลา (คืนค่าวันเดิม)</span>
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
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{mode === 'edit' ? 'บันทึกการแก้ไขวันขยายเวลา' : 'บันทึกการขยายเวลา'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
