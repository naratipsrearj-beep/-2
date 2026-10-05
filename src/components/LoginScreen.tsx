import React, { useState } from 'react';
import { Scale, ShieldCheck, Users, Eye, Sparkles, AlertCircle, ArrowRight, Lock, Copy, Check, ExternalLink } from 'lucide-react';
import { ADMIN_EMAIL } from '../services/firestoreService';

interface LoginScreenProps {
  onLogin: () => Promise<void>;
  isLoggingIn: boolean;
  loginError?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  isLoggingIn,
  loginError,
}) => {
  const [hasCopied, setHasCopied] = useState(false);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isUnauthorizedDomain = Boolean(loginError && loginError.includes('unauthorized-domain'));

  const handleCopyHostname = () => {
    if (!currentHostname) return;
    navigator.clipboard.writeText(currentHostname);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 3000);
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden font-['Sarabun',sans-serif]">
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative z-10">
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
            <Sparkles className="w-3.5 h-3.5" />
            <span>อัปเดตข้อมูลเป็นปัจจุบันแบบ Real-time</span>
          </div>
        </div>

        {/* Security / Roles Notice Box */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 border-b border-slate-700/60 pb-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>การยืนยันตัวตนและความปลอดภัยของระบบ</span>
          </div>

          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[10px]">
                👑
              </div>
              <div>
                <span className="font-semibold text-amber-300">แอดมิน / เจ้าของระบบ ({ADMIN_EMAIL})</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  มีสิทธิ์แก้ไขข้อมูล บันทึกคำพิพากษา มอบหมายเวรชี้ และอนุมัติสิทธิ์ผู้ใช้งาน
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[10px]">
                👁️
              </div>
              <div>
                <span className="font-semibold text-blue-300">ผู้ใช้งานทั่วไปที่ได้รับลิงก์</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  เข้าชมข้อมูลแบบ Real-time และสามารถกดขอสิทธิ์แก้ไขข้อมูลเพิ่มเติมจากแอดมินได้
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {loginError && (
          <div className="mb-5 bg-rose-500/15 border border-rose-500/40 rounded-xl p-3.5 text-xs text-rose-200 space-y-2.5">
            <div className="flex items-start gap-2.5">
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
                <p className="text-[10px] text-slate-400 leading-normal">
                  ไปที่ <strong>Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</strong> แล้วกด <strong>Add domain</strong> วางโดเมนนี้ลงไปครับ
                </p>
              </div>
            )}
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={onLogin}
          disabled={isLoggingIn}
          className="w-full bg-white hover:bg-slate-50 text-slate-800 font-medium py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 border border-slate-200 disabled:opacity-60 active:scale-[0.99] group"
        >
          {isLoggingIn ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold">กำลังเชื่อมต่อบัญชี Google...</span>
            </div>
          ) : (
            <>
              {/* Google Colored Logo */}
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span className="text-sm font-semibold tracking-wide">เข้าสู่ระบบด้วย Google / Gmail</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-slate-400">
          <p>เข้าสู่ระบบเพื่อความปลอดภัยและการซิงค์ข้อมูลแบบเรียลไทม์</p>
          <p className="mt-1 text-slate-400">
            เมื่อเข้าสู่ระบบแล้วจะแสดงข้อมูลสำนวนคดีและตารางเวรชี้ทันที
          </p>
        </div>
      </div>

      {/* Bottom watermark */}
      <div className="text-center mt-8 text-xs text-slate-400 relative z-10">
        ระบบสารบบคดีและคุมระยะเวลาอุทธรณ์ 1 เดือน นับแต่วันมีคำพิพากษา
      </div>
    </div>
  );
};
