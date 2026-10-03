import React, { useState, useEffect } from 'react';
import { FileText, ExternalLink, X, Check, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';
import { createCaseJudgmentDoc } from '../services/docsService';

interface JudgmentDocModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  onClose: () => void;
  token: string | null;
  onSaveJudgment: (caseId: string, judgmentText: string, docUrl?: string, docId?: string) => void;
  onLoginPrompt: () => void;
}

export const JudgmentDocModal: React.FC<JudgmentDocModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  token,
  onSaveJudgment,
  onLoginPrompt,
}) => {
  const [judgmentText, setJudgmentText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  useEffect(() => {
    if (caseItem) {
      setJudgmentText(caseItem.fullJudgmentText || caseItem.judgmentOutcome || '');
      setDocUrl(caseItem.googleDocUrl || null);
    }
  }, [caseItem]);

  if (!isOpen || !caseItem) return null;

  const handleSaveToGoogleDoc = async () => {
    if (!token) {
      onLoginPrompt();
      return;
    }

    if (!judgmentText.trim()) {
      setErrorMsg('กรุณากรอกเนื้อหาหรือข้อความคำพิพากษา');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const docResult = await createCaseJudgmentDoc(token, caseItem, judgmentText);
      setDocUrl(docResult.docUrl);
      onSaveJudgment(caseItem.id, judgmentText, docResult.docUrl, docResult.docId);
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถบันทึกลง Google Docs ได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLocalOnly = () => {
    onSaveJudgment(caseItem.id, judgmentText, caseItem.googleDocUrl, caseItem.googleDocId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-blue-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt']">
                บันทึกคำพิพากษาลง Google Docs
              </h3>
              <p className="text-xs text-blue-200">
                ดำ {caseItem.blackCaseNo} / แดง {caseItem.redCaseNo} • {caseItem.court}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-blue-300 hover:text-white p-1 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
            <div className="flex flex-wrap justify-between gap-1">
              <div>
                <span className="text-slate-500">วันที่ยื่นฟ้อง:</span>{' '}
                <strong className="text-slate-900">{formatThaiDate(caseItem.filingDate)}</strong>
              </div>
              <div>
                <span className="text-slate-500">วันที่อ่านคำพิพากษา:</span>{' '}
                <strong className="text-slate-900">{formatThaiDate(caseItem.judgmentDate)}</strong>
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-1">
              <div>
                <span className="text-slate-500">คู่ความ:</span> โจทก์: {caseItem.plaintiff} | จำเลย: {caseItem.defendant}
              </div>
              <div className="text-rose-700 font-semibold">
                ครบกำหนดอุทธรณ์ 1 เดือน: {formatThaiDate(caseItem.extendedDeadline || caseItem.appealDeadline)}
              </div>
            </div>
          </div>

          {/* Connected Google Doc Banner */}
          {docUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>เอกสาร Google Docs สำหรับคดีนี้ถูกบันทึกแล้ว</span>
              </div>
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 transition shadow-xs"
              >
                <span>เปิดใน Google Docs</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Judgment Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                กรอกข้อความ / คำวินิจฉัยและคำพิพากษาในคดีนี้ *
              </label>
              <span className="text-[11px] text-slate-400">
                จะถูกจัดรูปแบบและบันทึกลงใน Google Docs
              </span>
            </div>
            <textarea
              rows={8}
              value={judgmentText}
              onChange={(e) => setJudgmentText(e.target.value)}
              placeholder="กรอกรายละเอียดคำพิพากษา เช่น:
ศาลพิเคราะห์พยานหลักฐานของโจทก์และจำเลยแล้ว พิพากษาว่า จำเลยมีความผิดตามประมวลกฎหมายอาญา... ลงโทษจำคุก... ปี ปรับ... บาท หรือ ให้จำเลยชำระเงินแก่โจทก์จำนวน..."
              className="w-full text-xs font-mono leading-relaxed border border-slate-300 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="text-[11px] text-slate-500 flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <span>
              เมื่อกด <strong>"บันทึกลง Google Docs"</strong> ระบบจะสร้างเอกสาร Google Docs ใน Google Drive ของคุณโดยอัตโนมัติ โดยระบุข้อมูลวันที่ยื่นฟ้อง วันพิพากษา กำหนดเวลาอุทธรณ์ 1 เดือน และเนื้อหาคำพิพากษา เพื่อความสะดวกในการพิมพ์และเก็บสำเนาสำนวน
            </span>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              ปิด
            </button>

            <button
              type="button"
              onClick={handleSaveLocalOnly}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition"
              title="บันทึกเฉพาะในระบบนี้"
            >
              บันทึกในระบบ
            </button>

            <button
              type="button"
              onClick={handleSaveToGoogleDoc}
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกลง Google Docs...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>บันทึกและส่งเข้า Google Docs</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
