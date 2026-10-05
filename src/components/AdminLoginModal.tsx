import React, { useState } from 'react';
import {
  X,
  Lock,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';
import { ADMIN_EMAIL } from '../services/firestoreService';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginGoogle: () => Promise<void>;
  onLoginRedirect?: () => Promise<void>;
  onLoginPin: (pin: string) => void;
  isLoggingIn: boolean;
  loginError?: string | null;
  adminPin?: string;
  actionTitle?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginGoogle,
  onLoginRedirect,
  onLoginPin,
  isLoggingIn,
  loginError,
  adminPin = '5555',
  actionTitle,
}) => {
  const [activeTab, setActiveTab] = useState<'pin' | 'google'>('pin');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isUnauthorizedDomain = Boolean(loginError && loginError.includes('unauthorized-domain'));

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!pinInput.trim()) {
      setPinError('กรุณากรอกรหัสผ่าน PIN');
      return;
    }
    try {
      onLoginPin(pinInput.trim());
      onClose();
    } catch (err: any) {
      setPinError(err.message || 'รหัสผ่าน PIN ไม่ถูกต้อง');
    }
  };

  const handleCopyHostname = () => {
    if (!currentHostname) return;
    navigator.clipboard.writeText(currentHostname);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-['Sarabun',sans-serif]">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl shadow-black/70 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          title="ปิด"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center flex-shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-['Prompt']">
              เข้าสู่ระบบสำหรับเจ้าหน้าที่ / แอดมิน
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {actionTitle || 'เพื่อปลดล็อกสิทธิ์บันทึกและแก้ไขข้อมูลสำนวนคดี'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-800/90 rounded-xl p-1 mb-5 border border-slate-700 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setActiveTab('pin');
              setPinError(null);
            }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'pin'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>รหัส PIN แอดมิน (แนะนำ)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('google')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'google'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span>บัญชี Google / Gmail</span>
          </button>
        </div>

        {/* Tab 1: PIN Login */}
        {activeTab === 'pin' && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>เข้าสู่ระบบด้วยรหัส PIN เจ้าหน้าที่</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                ใช้งานได้ 100% บนคอมพิวเตอร์และมือถือทุกเครื่อง โดยไม่ต้องใช้หน้าต่างป๊อปอัป
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                กรอกรหัสผ่าน PIN แอดมิน:
              </label>
              <input
                type="password"
                maxLength={20}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(null);
                }}
                placeholder="กรอกรหัสผ่าน PIN แอดมิน"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-lg tracking-widest text-amber-300 focus:outline-none focus:border-amber-500 font-mono"
                autoFocus
              />
              <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400">
                <span>🔒 เฉพาะแอดมินและเจ้าหน้าที่ที่ได้รับรหัสผ่าน</span>
                <span>สิทธิ์: แอดมิน</span>
              </div>
            </div>

            {pinError && (
              <div className="bg-rose-500/15 border border-rose-500/40 rounded-lg p-2.5 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.99] cursor-pointer"
            >
              <span>ยืนยันเข้าสู่ระบบแอดมิน</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Tab 2: Google Login */}
        {activeTab === 'google' && (
          <div className="space-y-4">
            {loginError && (
              <div className="bg-rose-500/15 border border-rose-500/40 rounded-lg p-3 text-xs text-rose-200 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
                {isUnauthorizedDomain && currentHostname && (
                  <div className="bg-slate-950/80 rounded p-2 text-[11px] space-y-1 text-slate-300 border border-slate-700">
                    <p>คัดลอกโดเมนนี้ไปใส่ที่ Firebase Console &gt; Authorized domains:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-amber-300 bg-slate-800 px-2 py-1 rounded text-[10px] select-all flex-1 truncate">
                        {currentHostname}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyHostname}
                        className="bg-amber-500 text-slate-950 px-2 py-1 rounded text-[10px] font-bold"
                      >
                        {hasCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Standard Google Popup */}
            <button
              type="button"
              onClick={onLoginGoogle}
              disabled={isLoggingIn}
              className="w-full bg-white hover:bg-slate-50 text-slate-800 font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2.5 shadow-md border border-slate-200 transition disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google (ป๊อปอัป)'}</span>
            </button>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-[11px] text-slate-300 space-y-1.5 text-center">
              <p className="font-semibold text-amber-300">
                💡 คำแนะนำความปลอดภัย:
              </p>
              <p className="text-slate-400 text-[10.5px] leading-relaxed">
                Google ไม่อนุญาตให้ล็อกอินแบบเปลี่ยนหน้าภายในกรอบหน้าต่าง หากป๊อปอัปไม่เปิดขึ้นมา แนะนำให้สลับไปใช้แท็บ <strong>"รหัส PIN แอดมิน"</strong> ด้านบนเพื่อเข้าสู่ระบบได้ทันที 100%
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
