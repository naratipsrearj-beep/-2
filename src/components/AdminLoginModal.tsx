import React, { useState } from 'react';
import { X, KeyRound, ShieldAlert, Sparkles, AlertCircle, Eye, EyeOff, CheckCircle2, Scale, ShieldCheck } from 'lucide-react';
import { DEFAULT_ADMIN_PIN, APPEAL_OFFICER_PIN } from '../services/firestoreService';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
  adminPin?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  adminPin = DEFAULT_ADMIN_PIN,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successRole, setSuccessRole] = useState<'admin' | 'officer' | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = pinInput.trim();
    const cleanExpected = (adminPin || DEFAULT_ADMIN_PIN).trim();

    // 1. เจ้าหน้าที่คุมอุทธรณ์ (PIN: 000111)
    if (cleanInput === APPEAL_OFFICER_PIN || cleanInput === '000111') {
      setSuccessRole('officer');
      setTimeout(() => {
        onSuccess(cleanInput);
        onClose();
        setSuccessRole(null);
        setPinInput('');
      }, 500);
      return;
    }

    // 2. แอดมิน (PIN: 951753 หรือรหัสที่ตั้งไว้)
    if (cleanInput === cleanExpected || cleanInput === '951753') {
      setSuccessRole('admin');
      setTimeout(() => {
        onSuccess(cleanInput);
        onClose();
        setSuccessRole(null);
        setPinInput('');
      }, 500);
      return;
    }

    setErrorMessage('รหัส PIN ไม่ถูกต้อง โปรดตรวจสอบรหัสผ่านอีกครั้ง');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 font-['Sarabun',sans-serif]">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Prompt'] text-white">
                เข้าสู่ระบบด้วยรหัสผ่าน PIN
              </h2>
              <p className="text-xs text-slate-400">
                สำหรับเจ้าหน้าที่คุมอุทธรณ์ และผู้ดูแลระบบ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Information Notice for PIN Roles */}
          <div className="space-y-2">
            <div className="bg-purple-500/15 border border-purple-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-purple-200">
              <Scale className="w-4 h-4 text-purple-300 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-purple-300">สำหรับเจ้าหน้าที่คุมอุทธรณ์: </span>
                <span>
                  (มีอำนาจในการกดเสร็จสิ้น และตรวจดูสำนวนในเว็ปแอ๊พนี้ได้เท่านั้น)
                </span>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
              <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300">สำหรับผู้ดูแลระบบ (Admin): </span>
                <span>
                  (สิทธิ์แก้ไขข้อมูลและจัดการระบบทั้งหมด)
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              กรอกรหัสผ่าน PIN (PIN Code)
            </label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={10}
                required
                autoFocus
                placeholder="กรอกรหัสผ่าน PIN (เฉพาะผู้มีรหัส)"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white text-base tracking-widest font-mono focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-md transition cursor-pointer"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successRole === 'officer' && (
            <div className="bg-purple-500/20 border border-purple-500/40 rounded-xl p-3 text-xs text-purple-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>ยืนยันรหัสถูกต้อง! กำลังเข้าสู่ระบบในฐานะเจ้าหน้าที่คุมอุทธรณ์ (สิทธิ์กดเสร็จสิ้น และตรวจดูสำนวน)...</span>
            </div>
          )}

          {successRole === 'admin' && (
            <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>ยืนยันรหัสถูกต้อง! กำลังเข้าสู่ระบบในฐานะผู้ดูแลระบบ (แอดมิน)...</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={Boolean(successRole) || !pinInput.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <KeyRound className="w-4 h-4" />
              <span>ยืนยันรหัสผ่าน PIN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
