import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleSafeReset = () => {
    try {
      // Clear potentially huge image strings from local storage if quota error occurred
      const raw = localStorage.getItem('court_appeal_cases');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const sanitized = parsed.map((c: any) => ({
              ...c,
              judgmentPhotoUrl: null,
            }));
            localStorage.setItem('court_appeal_cases', JSON.stringify(sanitized));
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'ข้อผิดพลาดไม่ทราบสาเหตุ';
      const isQuotaError =
        errorMsg.includes('quota') ||
        errorMsg.includes('QuotaExceeded') ||
        errorMsg.includes('storage') ||
        errorMsg.includes('exceeded the quota');

      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-['Sarabun',sans-serif]">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 text-center space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 mx-auto bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-800 font-['Prompt']">
                {this.props.fallbackTitle || 'เกิดข้อผิดพลาดในการแสดงผล'}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {isQuotaError
                  ? 'หน่วยความจำเบราว์เซอร์เต็มจากการบันทึกภาพถ่ายที่มีขนาดใหญ่เกินไป ระบบได้เตรียมฟังก์ชันกู้คืนข้อมูลให้ท่านแล้ว'
                  : 'ระบบตรวจพบข้อผิดพลาดชั่วคราว ข้อมูลสำนวนคดีในฐานข้อมูลของท่านยังคงปลอดภัย'}
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                  <span>รายละเอียดทางเทคนิค:</span>
                </div>
                <p className="text-xs font-mono text-rose-600 break-words line-clamp-3">
                  {errorMsg}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>รีโหลดหน้าเว็บใหม่</span>
              </button>

              <button
                type="button"
                onClick={this.handleSafeReset}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Home className="w-4 h-4" />
                <span>กู้คืนหน้าจอ & ล้างแคชภาพ</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
