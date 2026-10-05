import React, { useState } from 'react';
import {
  Scale,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Lock,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  KeyRound,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Smartphone,
  Laptop
} from 'lucide-react';
import { ADMIN_EMAIL } from '../services/firestoreService';

interface LoginScreenProps {
  onLogin: () => Promise<void>;
  onLoginRedirect?: () => Promise<void>;
  onLoginWithPin: (pin: string) => void;
  onEnterGuestMode: () => void;
  isLoggingIn: boolean;
  loginError?: string | null;
  adminPin?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onLoginRedirect,
  onLoginWithPin,
  onEnterGuestMode,
  isLoggingIn,
  loginError,
  adminPin = '5555',
}) => {
  const [activeTab, setActiveTab] = useState<'pin' | 'google'>('pin');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

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
      onLoginWithPin(pinInput.trim());
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-10 relative overflow-hidden font-['Sarabun',sans-serif]">
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="max-w-md w-full bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative z-10 space-y-6">
        {/* App Logo & Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white shadow-xl shadow-amber-500/20 mb-3 ring-4 ring-amber-500/20">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-['Prompt'] text-white tracking-tight">
            ระบบคุมระยะเวลาอุทธรณ์ 1 เดือน
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            และสารบบคดีประจำวัน (Appeal Deadline Tracker)
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full text-[11px] text-amber-300 font-medium mt-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ศาลจังหวัดเพชรบุรี • ใช้งานได้บนทุกเครื่อง</span>
          </div>
        </div>

        {/* Option 1: Direct Instant Access for Viewer (No Login Required) */}
        <div className="bg-gradient-to-br from-blue-950/70 to-slate-900 border-2 border-blue-500/40 rounded-xl p-4 shadow-lg space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                <Eye className="w-3.5 h-3.5" />
              </span>
              <div>
                <h2 className="text-xs font-bold text-blue-200 uppercase tracking-wide">
                  เข้าใช้งานทันที (ไม่ต้องล็อกอิน)
                </h2>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  สำหรับผู้ตรวจดูสำนวนคดี, ตรวจสอบวันครบกำหนด, ตารางเวรชี้ และพิมพ์แบบคำร้องศาล
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onEnterGuestMode}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition active:scale-[0.99] cursor-pointer"
          >
            <span>เข้าใช้งานระบบทันที (โหมดเข้าชมสำนวน)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-700"></div>
          <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 bg-slate-900 px-2 rounded-full border border-slate-700/60">
            หรือ เข้าสู่ระบบสำหรับเจ้าหน้าที่ / แอดมิน
          </span>
          <div className="flex-grow border-t border-slate-700"></div>
        </div>

        {/* Option 2: Admin / Staff Login */}
        <div className="space-y-4">
          {/* Tab Selector */}
          <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pin');
                setPinError(null);
              }}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'pin'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>รหัส PIN แอดมิน (ใช้ได้ทุกเครื่อง)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('google')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
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
              <span>Google / Gmail</span>
            </button>
          </div>

          {/* TAB 1: PIN CODE (Reliable on 100% of devices) */}
          {activeTab === 'pin' && (
            <form onSubmit={handlePinSubmit} className="space-y-3.5">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>เข้าสู่ระบบด้วยรหัส PIN ประจำสำนักงาน</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  วิธีนี้<strong>ไม่ต้องเปิดหน้าต่างป๊อปอัป</strong> จึงใช้งานได้ 100% บนมือถือ แท็บเล็ต และคอมพิวเตอร์ทุกเครื่องในสำนักงาน
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  กรอกรหัส PIN แอดมิน:
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-lg tracking-widest text-amber-300 focus:outline-none focus:border-amber-500 font-mono shadow-inner"
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
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-[0.99] cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>เข้าสู่ระบบในฐานะแอดมิน (Admin)</span>
              </button>
            </form>
          )}

          {/* TAB 2: Google Login */}
          {activeTab === 'google' && (
            <div className="space-y-3">
              {loginError && (
                <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>

                  {isUnauthorizedDomain && currentHostname && (
                    <div className="bg-slate-950/80 rounded p-2 text-[11px] space-y-1.5 text-slate-300 border border-slate-700">
                      <p className="font-semibold text-amber-300">
                        วิธีแก้ไขให้ใช้ Google Login ได้:
                      </p>
                      <p className="text-[10px] text-slate-400">
                        นำโดเมนนี้ไปเพิ่มใน Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="text-amber-300 bg-slate-800 px-2 py-1 rounded text-[10px] select-all flex-1 truncate font-mono">
                          {currentHostname}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyHostname}
                          className="bg-amber-500 text-slate-950 px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer"
                        >
                          {hasCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Primary Google Sign-In */}
              <button
                type="button"
                onClick={onLogin}
                disabled={isLoggingIn}
                className="w-full bg-white hover:bg-slate-50 text-slate-800 font-semibold py-3 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md border border-slate-200 transition disabled:opacity-60 cursor-pointer active:scale-[0.99]"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isLoggingIn ? 'กำลังเชื่อมต่อบัญชี Google...' : 'เข้าสู่ระบบด้วย Google (ป๊อปอัป)'}</span>
              </button>

              {/* Redirect Alternative */}
              {onLoginRedirect && (
                <button
                  type="button"
                  onClick={onLoginRedirect}
                  disabled={isLoggingIn}
                  className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>เข้าสู่ระบบ Google แบบเปลี่ยนหน้า (Redirect)</span>
                </button>
              )}

              <p className="text-[11px] text-slate-400 text-center leading-normal">
                หากเครื่องของท่านไม่แสดงป๊อปอัป ให้เลือกแท็บ <strong>"รหัส PIN แอดมิน"</strong> เพื่อเข้าใช้งานได้ทันที
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 border-t border-slate-800 pt-3 space-y-1">
          <div className="flex items-center justify-center gap-3 text-slate-400">
            <span className="flex items-center gap-1"><Laptop className="w-3 h-3" /> คอมพิวเตอร์สำนักงาน</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> มือถือ & แท็บเล็ต</span>
          </div>
          <p className="text-[10px] text-slate-400">
            ข้อมูลอัปเดตแบบ Real-time พร้อมกันทุกเครื่องผ่าน Cloud Firestore
          </p>
        </div>
      </div>

      {/* Bottom watermark */}
      <div className="text-center mt-6 text-xs text-slate-400 relative z-10">
        ระบบสารบบคดีและคุมระยะเวลาอุทธรณ์ 1 เดือน นับแต่วันมีคำพิพากษา • ศาลจังหวัดเพชรบุรี
      </div>
    </div>
  );
};
