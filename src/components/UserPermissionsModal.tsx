import React, { useState } from 'react';
import { X, ShieldCheck, UserPlus, Trash2, CheckCircle2, Clock, AlertTriangle, Shield, User, Users, Mail, KeyRound, Eye, EyeOff, Edit3, Check, Download } from 'lucide-react';
import { ProjectSettings, PermissionRequest, ADMIN_EMAIL, DEFAULT_ADMIN_PIN } from '../services/firestoreService';

interface UserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProjectSettings;
  requests: PermissionRequest[];
  onApproveRequest: (requestId: string, userEmail: string, role?: 'editor' | 'appeal_officer') => Promise<void>;
  onRejectRequest: (requestId: string) => Promise<void>;
  onAddEditor: (email: string) => Promise<void>;
  onRemoveEditor: (email: string) => Promise<void>;
  onAddAppealOfficer?: (email: string) => Promise<void>;
  onRemoveAppealOfficer?: (email: string) => Promise<void>;
  onUpdateAdminPin?: (newPin: string) => Promise<void>;
  onDownloadBackup?: () => void;
  onOpenBackupViewer?: () => void;
  backupCounts?: { cases: number; dutyRosters: number; followUps: number };
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
  onAddAppealOfficer,
  onRemoveAppealOfficer,
  onUpdateAdminPin,
  onDownloadBackup,
  onOpenBackupViewer,
  backupCounts,
  isProcessing = false,
}) => {
  const [newEditorEmail, setNewEditorEmail] = useState('');
  const [addRole, setAddRole] = useState<'editor' | 'appeal_officer'>('appeal_officer');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Admin PIN management state
  const [showPin, setShowPin] = useState(false);
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [newPinInput, setNewPinInput] = useState(settings.adminPin || DEFAULT_ADMIN_PIN);
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPin = settings.adminPin || DEFAULT_ADMIN_PIN;

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateAdminPin) return;
    const cleanPin = newPinInput.trim();
    if (cleanPin.length < 4) {
      setErrorMsg('รหัส PIN ต้องมีความยาวอย่างน้อย 4 หลัก');
      return;
    }
    try {
      await onUpdateAdminPin(cleanPin);
      setIsEditingPin(false);
      setPinSuccessMsg('อัปเดตรหัส PIN แอดมินเรียบร้อยแล้ว');
      setTimeout(() => setPinSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'บันทึกรหัส PIN ไม่สำเร็จ');
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const allowedEditors = settings.allowedEditors || [];
  const allowedAppealOfficers = settings.allowedAppealOfficers || [];

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

    if (addRole === 'appeal_officer') {
      if (allowedAppealOfficers.some((ed) => ed.toLowerCase() === clean)) {
        setErrorMsg('อีเมลนี้อยู่ในรายชื่อเจ้าหน้าที่คุมอุทธรณ์อยู่แล้ว');
        return;
      }
      try {
        await onAddAppealOfficer?.(clean);
        setNewEditorEmail('');
      } catch (err: any) {
        setErrorMsg(err.message || 'ไม่สามารถเพิ่มผู้ใช้งานได้');
      }
    } else {
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
                กำหนดรหัสผ่าน PIN แอดมินและผู้มีสิทธิ์แก้ไขสำนวนคดี
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
          {/* Admin PIN Settings Card */}
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center flex-shrink-0 shadow-sm font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 font-['Prompt']">
                      รหัสผ่าน PIN สำหรับแอดมิน:
                    </span>
                    <span className="font-mono text-base font-bold bg-white px-2.5 py-0.5 rounded border border-amber-300 text-amber-900 shadow-inner">
                      {showPin ? currentPin : '••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="text-slate-600 hover:text-slate-900 p-1"
                      title={showPin ? 'ซ่อนรหัส PIN' : 'แสดงรหัส PIN'}
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-amber-800 mt-1">
                    ใช้รหัสผ่านนี้เพื่อเข้าสู่ระบบในสถานะแอดมินโดยตรง พร้อมระบบซิงค์เรียลไทม์ (กดไอคอนดวงตาเพื่อดูหรือซ่อนรหัส)
                  </p>
                </div>
              </div>

              {onUpdateAdminPin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingPin(!isEditingPin);
                    setNewPinInput(currentPin);
                  }}
                  className="bg-white hover:bg-amber-50 text-slate-800 border border-amber-300 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 self-start sm:self-center transition"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isEditingPin ? 'ยกเลิก' : 'เปลี่ยนรหัส PIN'}</span>
                </button>
              )}
            </div>

            {/* Inline PIN edit form */}
            {isEditingPin && (
              <form onSubmit={handleSavePin} className="mt-3 pt-3 border-t border-amber-200/80 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={12}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="ระบุรหัส PIN ใหม่ (ตัวเลข)"
                  className="bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 flex-1"
                />
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>บันทึก PIN ใหม่</span>
                </button>
              </form>
            )}

            {pinSuccessMsg && (
              <p className="text-xs text-emerald-700 font-semibold mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{pinSuccessMsg}</span>
              </p>
            )}
          </div>

          {/* Owner Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
            <Shield className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700">
              <span className="font-bold text-slate-900">เจ้าของระบบ (Admin สูงสุด): </span>
              <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-900 font-semibold">
                {ADMIN_EMAIL}
              </span>
              <p className="mt-1 text-slate-600">
                สามารถเข้าใช้งานด้วยบัญชี Google ของแอดมิน หรือเข้าสู่ระบบด้วยรหัสผ่าน PIN แอดมิน
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
                          {req.requestedRole === 'appeal_officer' ? (
                            <span className="text-[10px] font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full border border-purple-200">
                              ⚖️ ขอสิทธิ์ จนท.คุมอุทธรณ์
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-200">
                              ✍️ ขอสิทธิ์ผู้แก้ไข
                            </span>
                          )}
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

                    <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => onApproveRequest(req.id, req.email, 'appeal_officer')}
                        disabled={isProcessing}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition disabled:opacity-50 cursor-pointer"
                        title="อนุมัติเป็นเจ้าหน้าที่คุมอุทธรณ์ (ดูสำนวนได้ และกดได้แค่เสร็จสิ้นเท่านั้น)"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>อนุมัติ จนท.คุมอุทธรณ์</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onApproveRequest(req.id, req.email, 'editor')}
                        disabled={isProcessing}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition disabled:opacity-50 cursor-pointer"
                        title="อนุมัติเป็นผู้แก้ไขข้อมูลทั้งหมด (Editor)"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>อนุมัติผู้แก้ไข</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectRequest(req.id)}
                        disabled={isProcessing}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-semibold px-2 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Add User Directly */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-amber-600" />
              <span>เพิ่มอีเมลผู้ใช้งานโดยตรง</span>
            </h3>

            {/* Select Role */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">เลือกสิทธิ์:</span>
              <button
                type="button"
                onClick={() => setAddRole('appeal_officer')}
                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition flex items-center gap-1 cursor-pointer ${
                  addRole === 'appeal_officer'
                    ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>⚖️ เจ้าหน้าที่คุมอุทธรณ์</span>
                <span className="text-[10px] opacity-80">(ดูและกดเสร็จสิ้นเท่านั้น)</span>
              </button>
              <button
                type="button"
                onClick={() => setAddRole('editor')}
                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition flex items-center gap-1 cursor-pointer ${
                  addRole === 'editor'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>✍️ ผู้มีสิทธิ์แก้ไขทั้งหมด</span>
                <span className="text-[10px] opacity-80">(Editor)</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={newEditorEmail}
                onChange={(e) => setNewEditorEmail(e.target.value)}
                placeholder="ระบุ Gmail เช่น officer@gmail.com"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
              />
              <button
                type="submit"
                disabled={isProcessing || !newEditorEmail.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>อนุญาตสิทธิ์</span>
              </button>
            </form>
            {errorMsg && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{errorMsg}</span>
              </p>
            )}
          </div>

          {/* Section 3: Allowed Users Lists */}
          <div className="space-y-4">
            {/* 3.1 เจ้าหน้าที่คุมอุทธรณ์ (ดูสำนวนได้ และกดได้แค่เสร็จสิ้นเท่านั้น) */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                <span>
                  รายชื่อเจ้าหน้าที่คุมอุทธรณ์ ({allowedAppealOfficers.length} บัญชี)
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mb-2">
                สิทธิ์นี้สามารถดูสำนวนคดีและตรวจสอบวันนัดได้ทั้งหมด และ<strong>กดได้เฉพาะปุ่ม "เสร็จสิ้น"</strong> สำนวน ไม่สามารถแก้ไขข้อมูลในคดีหรือลบคดีได้
              </p>

              <div className="divide-y divide-slate-100 border border-purple-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                {allowedAppealOfficers.length === 0 ? (
                  <div className="p-3.5 text-center text-xs text-slate-400 bg-purple-50/20">
                    ยังไม่มีรายชื่อเจ้าหน้าที่คุมอุทธรณ์ (เพิ่มได้จากช่องด้านบน หรืออนุมัติจากคำขอ)
                  </div>
                ) : (
                  allowedAppealOfficers.map((off) => (
                    <div key={off} className="p-3 flex items-center justify-between hover:bg-purple-50/40 transition">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                          ⚖️
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-800 font-mono">{off}</div>
                          <div className="text-[10px] text-purple-700 font-medium">ดูสำนวนได้ • กดได้แค่เสร็จสิ้นเท่านั้น</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveAppealOfficer?.(off)}
                        disabled={isProcessing}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition disabled:opacity-50 cursor-pointer"
                        title="เพิกถอนสิทธิ์เจ้าหน้าที่คุมอุทธรณ์"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3.2 ผู้มีสิทธิ์แก้ไขข้อมูลทั้งหมด */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>รายชื่อผู้มีสิทธิ์แก้ไขข้อมูลทั้งหมด ({allowedEditors.length + 1} บัญชี)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mb-2">
                สามารถเพิ่มคดี ลบคดี แก้ไขข้อมูล กรอกคำพิพากษา ขยายเวลา และกดเสร็จสิ้นสำนวนได้
              </p>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
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
                  <div className="p-3.5 text-center text-xs text-slate-400">
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
                          <div className="text-[10px] text-slate-500">ได้รับอนุญาตให้เพิ่ม/แก้ไขข้อมูลได้ทั้งหมด</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveEditor(ed)}
                        disabled={isProcessing}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition disabled:opacity-50 cursor-pointer"
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

          {/* Offline JSON Backup Card */}
          {onDownloadBackup && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm font-bold">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-emerald-950 font-['Prompt'] flex items-center gap-2">
                      <span>สำรองข้อมูลระบบทั้งหมด (Download JSON Backup)</span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                        Admin Only
                      </span>
                    </h3>
                    <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                      ดาวน์โหลดข้อมูลทั้งหมดของระบบในรูปแบบไฟล์ JSON สำหรับเก็บสำรองข้อมูลแบบออฟไลน์ (Offline Archival) โดยประกอบด้วยข้อมูลสำนวนคดี, ตารางเวรชี้ และรายการติดตามคำพิพากษาครบถ้วน
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-start sm:self-center shrink-0">
                  {onOpenBackupViewer && (
                    <button
                      type="button"
                      onClick={onOpenBackupViewer}
                      className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold px-3.5 py-2 rounded-lg shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      title="เปิดดูและค้นหาข้อมูลสำรองโดยไม่ต้องใช้โปรแกรมอื่น"
                    >
                      <Eye className="w-4 h-4 text-blue-600" />
                      <span>เปิดดู / ตรวจสอบไฟล์สำรอง</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onDownloadBackup}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดไฟล์ (.json)</span>
                  </button>
                </div>
              </div>

              {backupCounts && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/70 text-center">
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                    <div className="text-[10px] text-slate-500 font-medium">สำนวนคดีทั้งหมด</div>
                    <div className="text-base font-bold text-slate-900 font-mono">{backupCounts.cases}</div>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                    <div className="text-[10px] text-slate-500 font-medium">ตารางเวรชี้</div>
                    <div className="text-base font-bold text-slate-900 font-mono">{backupCounts.dutyRosters}</div>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                    <div className="text-[10px] text-slate-500 font-medium">รายการติดตาม</div>
                    <div className="text-base font-bold text-slate-900 font-mono">{backupCounts.followUps}</div>
                  </div>
                </div>
              )}
            </div>
          )}
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
