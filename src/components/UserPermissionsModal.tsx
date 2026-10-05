import React, { useState } from 'react';
import { X, ShieldCheck, UserPlus, Trash2, CheckCircle2, Clock, AlertTriangle, Shield, User, Users, Mail } from 'lucide-react';
import { ProjectSettings, PermissionRequest, ADMIN_EMAIL } from '../services/firestoreService';

interface UserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  requests: PermissionRequest[];
  onApproveRequest: (requestId: string, userEmail: string) => Promise<void>;
  onRejectRequest: (requestId: string) => Promise<void>;
  onAddEditor: (email: string) => Promise<void>;
  onRemoveEditor: (email: string) => Promise<void>;
  isProcessing?: boolean;
}

export const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({
  isOpen,
  onClose,
  settings,
  requests,
  onApproveRequest,
  onRejectRequest,
  onAddEditor,
  onRemoveEditor,
  isProcessing = false,
}) => {
  const [newEditorEmail, setNewEditorEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const allowedEditors = settings.allowedEditors || [];

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = newEditorEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setErrorMsg('กรุณากรอกอีเมล Gmail ให้ถูกต้อง');
      return;
    }
    if (clean === ADMIN_EMAIL.toLowerCase()) {
      setErrorMsg('อีเมลนี้เป็นแอดมินหลักของระบบอยู่แล้ว');
      return;
    }
    if (allowedEditors.some((ed) => ed.toLowerCase() === clean)) {
      setErrorMsg('อีเมลนี้อยู่ในรายชื่อผู้มีสิทธิ์แก้ไขอยู่แล้ว');
      return;
    }

    try {
      await onAddEditor(clean);
      setNewEditorEmail('');
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถเพิ่มผู้ใช้งานได้');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 font-['Sarabun',sans-serif]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Prompt'] text-white">
                จัดการสิทธิ์การแก้ไขข้อมูล (Admin Control)
              </h2>
              <p className="text-xs text-slate-400">
                กำหนดผู้มีสิทธิ์แก้ไขสำนวนคดีและตารางเวรชี้
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Owner Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <span className="font-bold">เจ้าของระบบ (Admin สูงสุด): </span>
              <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-amber-950 font-semibold">
                {ADMIN_EMAIL}
              </span>
              <p className="mt-1 text-amber-800">
                ผู้ใช้งานที่เข้าสู่ระบบด้วยอีเมลนี้เท่านั้นที่มีสิทธิ์แก้ไขข้อมูลโดยตรง
                และมีสิทธิ์เพิ่มหรือถอดถอนผู้ช่วยแก้ไขข้อมูล (Editors)
              </p>
            </div>
          </div>

          {/* Section 1: Pending Permission Requests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>คำขอสิทธิ์แก้ไขข้อมูลที่รอดำเนินการ</span>
                {pendingRequests.length > 0 && (
                  <span className="bg-rose-500 text-white text-[11px] font-bold px-2 py-0.2 rounded-full">
                    {pendingRequests.length} คำขอ
                  </span>
                )}
              </h3>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
                ไม่มีคำขอสิทธิ์แก้ไขที่รอดำเนินการในขณะนี้
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      {req.photoURL ? (
                        <img
                          src={req.photoURL}
                          alt={req.displayName || req.email}
                          className="w-9 h-9 rounded-full border border-amber-300"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center font-bold text-xs">
                          {req.email.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {req.displayName || req.email}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-mono flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{req.email}</span>
                        </div>
                        {req.note && (
                          <p className="text-[11px] text-slate-500 mt-1 bg-white/70 rounded px-2 py-0.5 border border-amber-100">
                            "{req.note}"
                          </p>
                        )}
                        <span className="text-[10px] text-slate-400 block mt-1">
                          ขอเมื่อ {new Date(req.requestedAt).toLocaleString('th-TH')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => onApproveRequest(req.id, req.email)}
                        disabled={isProcessing}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>อนุมัติสิทธิ์</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectRequest(req.id)}
                        disabled={isProcessing}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Add Editor Manually */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2.5">
              <UserPlus className="w-4 h-4 text-amber-600" />
              <span>เพิ่มอีเมลผู้มีสิทธิ์แก้ไขโดยตรง</span>
            </h3>
            <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={newEditorEmail}
                onChange={(e) => setNewEditorEmail(e.target.value)}
                placeholder="ระบุ Gmail เช่น colleague@gmail.com"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isProcessing || !newEditorEmail.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>อนุญาตสิทธิ์</span>
              </button>
            </form>
            {errorMsg && (
              <p className="text-xs text-rose-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>

          {/* Section 3: Allowed Editors List */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>รายชื่อผู้มีสิทธิ์แก้ไขข้อมูลในระบบ ({allowedEditors.length + 1} บัญชี)</span>
            </h3>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {/* Owner */}
              <div className="p-3 bg-amber-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                    👑
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{ADMIN_EMAIL}</div>
                    <div className="text-[10px] text-amber-700 font-semibold">เจ้าของระบบ / แอดมินหลัก (สิทธิ์สูงสุด)</div>
                  </div>
                </div>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  Owner
                </span>
              </div>

              {/* Other Editors */}
              {allowedEditors.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  ยังไม่มีผู้ช่วยแก้ไขเพิ่มเติม (เฉพาะแอดมินหลักเท่านั้นที่มีสิทธิ์แก้ไข)
                </div>
              ) : (
                allowedEditors.map((ed) => (
                  <div key={ed} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-800 font-mono">{ed}</div>
                        <div className="text-[10px] text-slate-400">ได้รับอนุญาตให้เพิ่ม/แก้ไขข้อมูลได้</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveEditor(ed)}
                      disabled={isProcessing}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition disabled:opacity-50"
                      title="เพิกถอนสิทธิ์แก้ไข"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
