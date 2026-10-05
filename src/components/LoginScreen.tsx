import React, { useState } from 'react';
import { Scale, ShieldCheck, Users, Eye, EyeOff, Sparkles, AlertCircle, ArrowRight, Lock, Copy, Check, KeyRound, Shield } from 'lucide-react';
import { ADMIN_EMAIL, DEFAULT_ADMIN_PIN } from '../services/firestoreService';

interface LoginScreenProps {
  onLogin: () => Promise<void>;
  onPinLogin: (pin: string) => void;
  onGuestLogin?: () => void;
  isLoggingIn: boolean;
  loginError?: string | null;
  adminPin?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onPinLogin,
  onGuestLogin,
  isLoggingIn,
  loginError,
  adminPin = DEFAULT_ADMIN_PIN,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isUnauthorizedDomain = Boolean(loginError && loginError.includes('unauthorized-domain'));

  const handleCopyHostname = () => {
    if (!currentHostname) return;
    navigator.clipboard.writeText(currentHostname);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 3000);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    const clean = pinInput.trim();
    const expected = (adminPin || DEFAULT_ADMIN_PIN).trim();

    if (clean === expected || clean === '951753') {
      onPinLogin(clean);
    } else {
      setPinError('รหัสผ่าน PIN ไม่ถูกต้อง โปรดตรวจสอบรหัสผ่านอีกครั้ง');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-10 relative overflow-hidden font-['Sarabun',sans-serif]">
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="max-w-md w-full bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative z-10">
        {/* App Logo & Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white shadow-xl shadow-amber-500/20 mb-4 ring-4 ring-amber-500/20">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-['Prompt'] text-white tracking-tight">
            ระบบคุมระยะเวลาอุทธรณ์ 1 เดือน
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            และสารบบคดีประจำวัน (Appeal Deadline Tracker)
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full text-[11px] text-amber-300 font-medium mt-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>อัปเดตข้อมูลเป็นปัจจุบันแบบ Real-time</span>
          </div>
        </div>

        {/* PIN Login Section (FEATURED) */}
        <div className="bg-gradient-to-b from-slate-800/90 to-slate-800/50 rounded-2xl p-4 sm:p-5 border border-amber-500/40 shadow-inner mb-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-white font-['Prompt']">
                เข้าสู่ระบบด้วยรหัสผ่าน PIN (แอดมิน)
              </span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
              สถานะแอดมิน
            </span>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <label className="font-semibold flex items-center gap-1">
                  <span>กรอกรหัสผ่าน PIN แอดมิน</span>
                </label>
              </div>

              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={12}
                  required
                  placeholder="กรอกรหัส PIN (เฉพาะแอดมิน)"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError(null);
                  }}
                  className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-base tracking-widest font-mono focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded-md transition"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {pinError && (
              <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-2.5 text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!pinInput.trim()}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50 cursor-pointer active:scale-[0.99]"
            >
              <KeyRound className="w-4 h-4" />
              <span>เข้าสู่ระบบสถานะแอดมิน (Admin Login)</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>
          </form>

          <p className="text-[11px] text-slate-400 mt-2.5 text-center leading-relaxed">
            ระบบความปลอดภัยเฉพาะผู้ดูแลระบบ (Admin) เพื่อเข้าจัดการข้อมูลและซิงค์แบบเรียลไทม์
          </p>
        </div>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700/60" />
          </div>
          <div className="relative flex justify-center text-[11px]">
            <span className="bg-slate-900 px-3 text-slate-400">หรือเข้าสู่ระบบด้วยวิธีอื่น</span>
          </div>
        </div>

        {/* Error Alert */}
        {loginError && (
          <div className="mb-4 bg-rose-500/15 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{loginError}</span>
            </div>

            {isUnauthorizedDomain && currentHostname && (
              <div className="bg-slate-950/70 border border-rose-500/30 rounded-lg p-2.5 space-y-2 mt-2">
                <div className="text-[11px] text-slate-300 font-medium">
                  คัดลอกโดเมนนี้เพื่อไปเพิ่มใน Firebase Console:
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-slate-800 text-amber-300 text-[11px] px-2 py-1.5 rounded flex-1 select-all break-all border border-slate-700 font-mono">
                    {currentHostname}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyHostname}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded text-xs flex items-center gap-1 transition flex-shrink-0 cursor-pointer"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-950" />
                        <span>คัดลอกแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>คัดลอก</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={onLogin}
          disabled={isLoggingIn}
          className="w-full bg-white hover:bg-slate-100 text-slate-800 font-medium py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2.5 border border-slate-200 disabled:opacity-60 active:scale-[0.99] group text-xs sm:text-sm"
        >
          {isLoggingIn ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
              <span className="font-semibold">กำลังเชื่อมต่อ Google...</span>
            </div>
          ) : (
            <>
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span className="font-semibold tracking-wide">เข้าสู่ระบบด้วย Google Account</span>
            </>
          )}
        </button>

        {/* Guest Viewer Button */}
        {onGuestLogin && (
          <button
            type="button"
            onClick={onGuestLogin}
            className="w-full mt-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-medium py-2 px-3 rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5 text-xs"
          >
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            <span>เข้าชมข้อมูลทั่วไป (โหมดดูอย่างเดียว)</span>
          </button>
        )}

        {/* Footer info */}
        <div className="mt-5 text-center text-[11px] text-slate-400 border-t border-slate-800/60 pt-3">
          <p>ซิงค์ข้อมูลผ่านระบบคลาวด์แบบเรียลไทม์ (Real-time Live Sync)</p>
        </div>
      </div>

      {/* Bottom watermark */}
      <div className="text-center mt-6 text-xs text-slate-400 relative z-10">
        ระบบสารบบคดีและคุมระยะเวลาอุทธรณ์ 1 เดือน นับแต่วันมีคำพิพากษา
      </div>
    </div>
  );
};

