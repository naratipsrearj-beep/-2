import React, { useState } from 'react';
import { X, Send, ShieldAlert, CheckCircle2, Clock, Mail } from 'lucide-react';
import { User } from 'firebase/auth';
import { AppAuthUser } from '../services/auth';
import { ADMIN_EMAIL } from '../services/firestoreService';

interface RequestEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | AppAuthUser;
  onRequest: (note: string, requestedRole?: 'editor' | 'appeal_officer') => Promise<void>;
  existingRequestStatus?: 'pending' | 'approved' | 'rejected' | null;
}

export const RequestEditModal: React.FC<RequestEditModalProps> = ({
  isOpen,
  onClose,
  user,
  onRequest,
  existingRequestStatus,
}) => {
  const [requestedRole, setRequestedRole] = useState<'editor' | 'appeal_officer'>('appeal_officer');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onRequest(note, requestedRole);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 font-['Sarabun',sans-serif]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold font-['Prompt'] text-white">
              ขอสิทธิ์การใช้งานในระบบ
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {existingRequestStatus === 'pending' || isSubmitted ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 font-['Prompt']">
                ส่งคำขอเรียบร้อยแล้ว
              </h3>
              <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                คำขอสิทธิ์ของคุณถูกส่งไปยังแอดมิน ({ADMIN_EMAIL}) แล้ว
                เมื่อแอดมินอนุมัติ ระบบจะเปิดสิทธิ์การใช้งานให้คุณตามประเภทสิทธิ์ที่ได้รับอนุมัติทันที
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition"
              >
                รับทราบ
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold">บัญชีของคุณ:</span>
                  <span className="font-mono text-slate-900 font-bold">{user.email}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  ระบบนี้จำกัดสิทธิ์เฉพาะเจ้าของระบบ ({ADMIN_EMAIL}) หรือผู้ที่ได้รับอนุญาตเท่านั้น
                </p>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ประเภทสิทธิ์ที่ต้องการขอ:
                </label>
                <div className="space-y-2">
                  <label className={`block p-2.5 rounded-xl border cursor-pointer transition ${
                    requestedRole === 'appeal_officer'
                      ? 'bg-purple-50/80 border-purple-300 ring-1 ring-purple-400'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="reqRole"
                        value="appeal_officer"
                        checked={requestedRole === 'appeal_officer'}
                        onChange={() => setRequestedRole('appeal_officer')}
                        className="mt-0.5 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-purple-950 flex items-center gap-1">
                          <span>⚖️ เจ้าหน้าที่คุมอุทธรณ์</span>
                          <span className="text-[10px] bg-purple-200/80 text-purple-900 px-1.5 py-0.2 rounded font-semibold">(แนะนำ)</span>
                        </div>
                        <p className="text-[11px] text-purple-800/80 mt-0.5">
                          สามารถดูสำนวนคดีและตรวจสอบวันนัดได้ทั้งหมด และกดปุ่ม <strong>"เสร็จสิ้น"</strong> สำนวนได้ (ไม่สามารถแก้ไขหรือลบคดีได้)
                        </p>
                      </div>
                    </div>
                  </label>

                  <label className={`block p-2.5 rounded-xl border cursor-pointer transition ${
                    requestedRole === 'editor'
                      ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}>
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="reqRole"
                        value="editor"
                        checked={requestedRole === 'editor'}
                        onChange={() => setRequestedRole('editor')}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-emerald-950">
                          ✍️ ผู้มีสิทธิ์แก้ไขทั้งหมด (Editor)
                        </div>
                        <p className="text-[11px] text-emerald-800/80 mt-0.5">
                          สามารถเพิ่มคดี ลบคดี แก้ไขข้อมูล กรอกคำพิพากษา และขยายเวลาได้
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เหตุผลหรือข้อความแจ้งแอดมิน (ทางเลือก):
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={requestedRole === 'appeal_officer' ? 'เช่น เจ้าหน้าที่ธุรการคุมระยะเวลาอุทธรณ์ ต้องการกดเสร็จสิ้นสำนวน' : 'เช่น ต้องการช่วยลงข้อมูลสำนวนคดีและบันทึกผลคำพิพากษา'}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอสิทธิ์ถึงแอดมิน'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
