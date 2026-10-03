import React from 'react';
import { User } from 'firebase/auth';
import { FileSpreadsheet, Scale, ExternalLink, RefreshCw, LogIn, LogOut, CheckCircle2, ShieldAlert, UserCheck } from 'lucide-react';
import { SheetConfig } from '../types/appeal';

interface HeaderProps {
  user: User | null;
  token: string | null;
  sheetConfig: SheetConfig | null;
  todayDutyOfficer?: string;
  onOpenDutyRoster?: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onOpenSheetSettings: () => void;
  onSync: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  sheetConfig,
  todayDutyOfficer,
  onOpenDutyRoster,
  onLogin,
  onLogout,
  onOpenSheetSettings,
  onSync,
  isSyncing,
}) => {
  // วันที่ปัจจุบันแบบไทย
  const todayDateThai = new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white flex-shrink-0">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold font-['Prompt'] tracking-tight text-white">
                  ระบบคุมระยะเวลาอุทธรณ์ 1 เดือน
                </h1>
                <span className="bg-amber-500/20 text-amber-300 text-[11px] font-medium px-2 py-0.5 rounded-full border border-amber-500/30">
                  นับแต่พิพากษา
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>{todayDateThai}</span>
                <span className="text-slate-600">•</span>
                <span>เตือนก่อนครบกำหนด ป้องกันขาดอุทธรณ์</span>
              </p>
            </div>
          </div>

          {/* Right Side: Duty Officer, Google Sheets Connection & Auth */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Today Duty Officer Pill */}
            {todayDutyOfficer && (
              <button
                onClick={onOpenDutyRoster}
                className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-medium transition"
                title="คลิกเพื่อเปิดดูตารางเวรชี้ประจำเดือน"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline text-amber-200/80">เวรชี้วันนี้:</span>
                <span className="font-semibold text-amber-200 max-w-[130px] truncate">{todayDutyOfficer}</span>
              </button>
            )}

            {/* Sheet Link / Status */}
            {sheetConfig ? (
              <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-lg p-1 px-2.5 text-xs text-slate-300 gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]" title={sheetConfig.spreadsheetTitle}>
                  {sheetConfig.spreadsheetTitle}
                </span>
                <a
                  href={sheetConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-emerald-300 p-1 transition"
                  title="เปิดใน Google Sheets"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={onSync}
                  disabled={isSyncing}
                  className="text-slate-400 hover:text-white p-1 transition disabled:opacity-50"
                  title="ซิงค์ข้อมูลกับ Google Sheets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenSheetSettings}
                className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>เชื่อมต่อ Google Sheets</span>
              </button>
            )}

            {/* Google Account */}
            {user ? (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg pl-1.5 pr-2.5 py-1 text-xs">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 rounded-full border border-slate-600"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center font-bold text-white text-[10px]">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <div className="text-[11px] font-medium text-slate-200 truncate max-w-[120px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="text-slate-400 hover:text-rose-400 p-1 ml-0.5 transition"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="gsi-material-button inline-flex items-center gap-2 bg-white text-slate-800 hover:bg-slate-100 font-medium px-3 py-1.5 rounded-lg text-xs shadow-sm transition border border-slate-200"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>เข้าสู่ระบบ Google</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
