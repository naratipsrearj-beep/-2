import React, { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle2, AlertTriangle, X, Clock, RefreshCw, User, ShieldAlert } from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate, getDaysRemaining } from '../utils/dateUtils';
import { sendAppealDeadlineAlertEmail } from '../services/gmailService';

interface EmailAlertModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  currentUserEmail?: string | null;
  token: string | null;
  onClose: () => void;
  onLoginPrompt: () => void;
  onEmailSentSuccess?: (caseItem: AppealCase, recipient: string) => void;
}

export const EmailAlertModal: React.FC<EmailAlertModalProps> = ({
  isOpen,
  caseItem,
  currentUserEmail,
  token,
  onClose,
  onLoginPrompt,
  onEmailSentSuccess,
}) => {
  const [recipientEmail, setRecipientEmail] = useState(currentUserEmail || '');
  const [customNotes, setCustomNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (currentUserEmail) {
      setRecipientEmail(currentUserEmail);
    }
  }, [currentUserEmail]);

  useEffect(() => {
    setStatusMessage(null);
  }, [isOpen, caseItem]);

  if (!isOpen || !caseItem) return null;

  const daysLeft = getDaysRemaining(caseItem);
  const effectiveDeadline = caseItem.extendedDeadline || caseItem.appealDeadline;

  const handleSendEmail = async () => {
    if (!token) {
      onLoginPrompt();
      return;
    }

    if (!recipientEmail || !recipientEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'กรุณาระบุที่อยู่อีเมลผู้รับที่ถูกต้อง' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      await sendAppealDeadlineAlertEmail(token, recipientEmail, caseItem, daysLeft);
      setStatusMessage({
        type: 'success',
        text: `ส่งอีเมลแจ้งเตือนไปยัง ${recipientEmail} เรียบร้อยแล้ว`,
      });
      if (onEmailSentSuccess) {
        onEmailSentSuccess(caseItem, recipientEmail);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'ไม่สามารถส่งอีเมลแจ้งเตือนได้ โปรดลองอีกครั้ง',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-rose-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center text-white">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt']">
                ส่งอีเมลแจ้งเตือนกำหนดเวลาอุทธรณ์
              </h3>
              <p className="text-xs text-rose-200">
                แจ้งเตือนล่วงหน้า 3 วัน / 1 วัน ป้องกันการขาดอายุความ
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-rose-300 hover:text-white p-1 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Case Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 font-['Prompt'] text-sm">
                ดำ {caseItem.blackCaseNo} / แดง {caseItem.redCaseNo}
              </span>
              <span className="text-slate-500">{caseItem.court}</span>
            </div>
            {caseItem.prosecutorName && (
              <div className="text-amber-900 font-semibold text-[11px]">
                <span className="text-slate-500 font-normal">อัยการเจ้าของสำนวน:</span> ⚖️ {caseItem.prosecutorName}
              </div>
            )}
            <div className="text-slate-600">
              <span className="text-slate-500">โจทก์:</span> {caseItem.plaintiff} | <span className="text-slate-500">จำเลย:</span> {caseItem.defendant}
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200/70">
              <span className="text-slate-600">วันครบกำหนดอุทธรณ์ 1 เดือน:</span>
              <span className="font-bold text-rose-700 text-sm">
                {formatThaiDate(effectiveDeadline, { short: false })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">ระยะเวลาคงเหลือ:</span>
              <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                daysLeft <= 1 ? 'bg-rose-100 text-rose-700 animate-pulse' : daysLeft <= 3 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {daysLeft < 0 ? `พ้นกำหนดแล้ว ${Math.abs(daysLeft)} วัน` : daysLeft === 0 ? 'ครบกำหนดในวันนี้!' : `เหลืออีก ${daysLeft} วัน`}
              </span>
            </div>
          </div>

          {/* Email Recipient Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              ที่อยู่อีเมลผู้รับการแจ้งเตือน *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="เช่น your-email@gmail.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50 focus:bg-white"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              ระบบจะส่งอีเมลแจ้งเตือนพร้อมรายละเอียดคดีและคำเตือนอายุความไปยังอีเมลนี้
            </p>
          </div>

          {/* Alert Preview Box */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>สาระสำคัญของอีเมลแจ้งเตือน:</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-800">
              <li>ระบุเลขคดีดำ / คดีแดง / ศาล / ชื่อโจทก์และจำเลยครบถ้วน</li>
              <li>แจ้งเตือนวันครบกำหนด 1 เดือนนับแต่พิพากษา ({formatThaiDate(effectiveDeadline)})</li>
              <li>คำเตือนข้อกฎหมายตาม ป.วิ.พ. ม.229 / ป.วิ.อ. ม.198 ก่อนอายุความอุทธรณ์ขาด</li>
              <li>คำแนะนำให้กดเสร็จสิ้นสำนวนเมื่อดำเนินการยื่นอุทธรณ์แล้ว</li>
            </ul>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              ปิด
            </button>

            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังส่งอีเมลผ่าน Gmail...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>ส่งอีเมลแจ้งเตือนทันที</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
