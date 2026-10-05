import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, ShieldAlert, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';

interface FirebaseRulesGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onRetryConnection: () => Promise<boolean>;
}

export const FirebaseRulesGuideModal: React.FC<FirebaseRulesGuideModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onRetryConnection,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<'success' | 'failed' | null>(null);

  if (!isOpen) return null;

  const rulesCode = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(rulesCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTest = async () => {
    setIsRetrying(true);
    setRetryResult(null);
    try {
      const ok = await onRetryConnection();
      setRetryResult(ok ? 'success' : 'failed');
      if (ok) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const consoleUrl = `https://console.firebase.google.com/project/${projectId}/firestore/rules`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 font-['Sarabun',sans-serif]">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Prompt'] text-white">
                วิธีเปิดสิทธิ์เรียลไทม์ใน Firebase ({projectId})
              </h2>
              <p className="text-xs text-rose-300">
                สาเหตุที่เครื่องอื่นยังไม่เห็นข้อมูล: ติดสิทธิ์ใน Firebase Security Rules
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 text-slate-300 leading-relaxed">
            <span className="font-bold text-rose-300">ทำไมเครื่องอื่นถึงไม่เห็นข้อมูล?</span><br />
            ฐานข้อมูล Firebase ของโปรเจ็กต์ <strong className="text-white font-mono">{projectId}</strong> กำลังปฏิเสธการเชื่อมต่อจากอุปกรณ์อื่นเนื่องจากกฎความปลอดภัย (Security Rules) บน Firebase Console ยังไม่ได้เปิดให้อนุญาตอ่าน/เขียน ทำให้แต่ละเครื่องตกไปใช้ข้อมูลจำลองในเครื่องตัวเองแทน
          </div>

          <div className="space-y-3">
            <div className="font-bold text-sm text-amber-300 font-['Prompt'] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>วิธีแก้ไขให้ใช้งานเรียลไทม์ได้ทุกเครื่อง (ทำเพียงครั้งเดียว):</span>
            </div>

            {/* Step 1 */}
            <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80 space-y-2">
              <div className="font-bold text-white flex items-center justify-between">
                <span>1. เปิดหน้าแก้ไข Rules ใน Firebase Console</span>
                <a
                  href={consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-lg transition"
                >
                  <span>เปิด Firebase Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-slate-400">
                หรือไปที่ console.firebase.google.com &gt; โปรเจ็กต์ {projectId} &gt; เมนู <strong>Firestore Database</strong> &gt; แท็บ <strong>Rules</strong>
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">2. วางกฎให้อนุญาต (allow read, write: if true;) แล้วกด Publish</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด'}</span>
                </button>
              </div>

              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-700/70 font-mono text-[11px] text-emerald-300 overflow-x-auto select-all">
                {rulesCode}
              </pre>
            </div>
          </div>

          {/* Test connection result */}
          {retryResult === 'success' && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-3 text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>สำเร็จ! เชื่อมต่อกับ Firebase สำเร็จแล้ว ตอนนี้ทุกเครื่องจะได้รับข้อมูลเรียลไทม์ทันที</span>
            </div>
          )}

          {retryResult === 'failed' && (
            <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-3 text-rose-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>ยังคงติดสิทธิ์อยู่ โปรดตรวจสอบว่าได้กดปุ่ม "Publish" ใน Firebase Console หรือยัง</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={isRetrying}
            className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'กำลังทดสอบเชื่อมต่อ...' : 'ทดสอบการเชื่อมต่อใหม่'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
