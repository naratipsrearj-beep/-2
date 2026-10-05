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
  HelpCircle,
  Smartphone,
  Laptop
} from 'lucide-react';
import { ADMIN_EMAIL } from '../services/firestoreService';

interface LoginScreenProps {
  onLogin: () => Promise<void>;
  onLoginRedirect?: () => Promise<void>;
  isLoggingIn: boolean;
  loginError?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onLoginRedirect,
  isLoggingIn,
  loginError,
}) => {
  const [hasCopied, setHasCopied] = useState(false);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isUnauthorizedDomain = Boolean(loginError && loginError.includes('unauthorized-domain'));
  const isPopupBlocked = Boolean(
    loginError &&
      (loginError.includes('popup-blocked') ||
        loginError.includes('ป๊อปอัป') ||
        loginError.includes('บล็อกหน้าต่าง'))
  );

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
            <span>ศาลจังหวัดเพชรบุรี • อัปเดตข้อมูลแบบ Real-time</span>
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
                  มีสิทธิ์แก้ไขข้อมูล บันทึกคำพิพากษา ขอขยายเวลา และอนุมัติสิทธิ์ผู้ใช้งาน
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
                  เข้าชมข้อมูลสำนวนคดีและตารางเวรชี้ และสามารถกดขอสิทธิ์แก้ไขข้อมูลเพิ่มเติมได้
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert Box */}
        {loginError && (
          <div className="mb-5 bg-rose-500/15 border border-rose-500/40 rounded-xl p-3.5 text-xs text-rose-200 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed font-medium">{loginError}</span>
            </div>

            {/* Special Solution Box for popup-blocked */}
            {isPopupBlocked && (
              <div className="bg-slate-950/80 border border-amber-500/40 rounded-xl p-3.5 space-y-3 text-slate-200">
                <div className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>วิธีแก้ไขเพื่อให้เข้าสู่ระบบได้ทุกเครื่อง:</span>
                </div>

                {/* Option 1: Direct Redirect Sign-In (Best Solution) */}
                <div className="bg-gradient-to-r from-emerald-950/70 to-teal-950/70 border border-emerald-500/40 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[11px]">
                      1
                    </span>
                    <strong className="text-emerald-300 text-xs">
                      วิธีที่ 1 (แนะนำที่สุด): เข้าสู่ระบบแบบเปลี่ยนหน้า (Redirect)
                    </strong>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    ระบบจะนำไปยังหน้าล็อกอิน Google โดยตรงในหน้าต่างเดิม และพากลับมาหน้านี้อัตโนมัติ โดย<strong>ไม่ต้องเปิดป๊อปอัป</strong> จึงใช้งานได้ 100% บนมือถือ แท็บเล็ต และคอมพิวเตอร์ทุกเครื่อง
                  </p>
                  {onLoginRedirect && (
                    <button
                      type="button"
                      onClick={onLoginRedirect}
                      disabled={isLoggingIn}
                      className="w-full mt-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-[0.99]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>กดที่นี่เพื่อเข้าสู่ระบบแบบเปลี่ยนหน้า (ไม่ใช้ป๊อปอัป)</span>
                    </button>
                  )}
                </div>

                {/* Option 2: How to unblock popup in browser */}
                <div className="bg-slate-900/80 border border-slate-700/80 rounded-lg p-3 space-y-1.5 text-[11px] text-slate-300">
                  <div className="flex items-center gap-2 text-slate-200 font-semibold">
                    <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-[11px]">
                      2
                    </span>
                    <span>วิธีที่ 2: ปลดล็อกป๊อปอัปใน Google Chrome / Edge</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1 leading-relaxed">
                    <li>
                      คลิกที่ไอคอน <strong>"ตั้งค่าเว็บไซต์" หรือรูปแม่กุญแจ 🔒 ที่อยู่ด้านหน้า (ซ้ายมือสุด) ของแถบ URL</strong>
                    </li>
                    <li>
                      เลือกเมนู <strong>"การตั้งค่าไซต์" (Site settings)</strong> &gt; เลื่อนหาหัวข้อ <strong>"ป็อปอัปและการเปลี่ยนเส้นทาง" (Pop-ups and redirects)</strong>
                    </li>
                    <li>
                      เปลี่ยนค่าเป็น <strong>"อนุญาต" (Allow)</strong> แล้วรีเฟรชหน้าเว็บกดเข้าสู่ระบบอีกครั้ง
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* Unauthorized Domain Guide */}
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

        {/* Primary Google Sign-In Button (Popup) */}
        <button
          type="button"
          onClick={onLogin}
          disabled={isLoggingIn}
          className="w-full bg-white hover:bg-slate-50 text-slate-800 font-medium py-3.5 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 border border-slate-200 disabled:opacity-60 active:scale-[0.99] group cursor-pointer"
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

        {/* Secondary Direct Redirect Option for Mobile / Locked Down PCs */}
        {onLoginRedirect && (
          <button
            type="button"
            onClick={onLoginRedirect}
            disabled={isLoggingIn}
            className="w-full mt-3 text-xs text-slate-400 hover:text-amber-300 underline font-medium py-1 transition flex items-center justify-center gap-1.5 cursor-pointer"
            title="สำหรับเปิดใช้งานบนโทรศัพท์มือถือ แท็บเล็ต หรือเครื่องที่เบราว์เซอร์บล็อกป๊อปอัป"
          >
            <Smartphone className="w-3.5 h-3.5 text-slate-500" />
            <span>หรือ เข้าสู่ระบบแบบเปลี่ยนหน้า (สำหรับมือถือ / เครื่องที่บล็อกป๊อปอัป) ↗</span>
          </button>
        )}

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-slate-400 border-t border-slate-800 pt-4 space-y-1">
          <div className="flex items-center justify-center gap-3 text-slate-400">
            <span className="flex items-center gap-1"><Laptop className="w-3 h-3" /> คอมพิวเตอร์</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> มือถือ & แท็บเล็ต</span>
          </div>
          <p className="mt-1 text-slate-400">
            เมื่อเข้าสู่ระบบแล้วจะแสดงข้อมูลสำนวนคดีและตารางเวรชี้ทันที
          </p>
        </div>
      </div>

      {/* Bottom watermark */}
      <div className="text-center mt-8 text-xs text-slate-400 relative z-10">
        ระบบสารบบคดีและคุมระยะเวลาอุทธรณ์ 1 เดือน นับแต่วันมีคำพิพากษา • ศาลจังหวัดเพชรบุรี
      </div>
    </div>
  );
};
