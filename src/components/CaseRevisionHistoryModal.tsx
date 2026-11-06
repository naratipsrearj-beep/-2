import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  X,
  Search,
  Clock,
  User,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  Undo2,
  CheckCircle2,
  Sparkles,
  FileText,
  Calendar,
  Scale,
  RefreshCw,
} from 'lucide-react';
import { CaseRevision, AppealCase, DeletedCaseBackup } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';

interface CaseRevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  revisions: CaseRevision[];
  deletedCases: DeletedCaseBackup[];
  initialCaseId?: string;
  initialBlackCaseNo?: string;
  canRevert: boolean;
  onRevertToRevision: (revision: CaseRevision) => void;
  onRestoreDeletedCase: (deletedBackup: DeletedCaseBackup) => void;
  onRefresh?: () => void;
}

export const CaseRevisionHistoryModal: React.FC<CaseRevisionHistoryModalProps> = ({
  isOpen,
  onClose,
  revisions,
  deletedCases,
  initialCaseId,
  initialBlackCaseNo,
  canRevert,
  onRevertToRevision,
  onRestoreDeletedCase,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'revisions' | 'trash'>('revisions');
  const [searchQuery, setSearchQuery] = useState(initialBlackCaseNo || '');
  const [selectedCaseFilter, setSelectedCaseFilter] = useState<string | undefined>(initialCaseId);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedRevisionIds, setExpandedRevisionIds] = useState<Record<string, boolean>>({});
  const [confirmRevertTarget, setConfirmRevertTarget] = useState<CaseRevision | null>(null);
  const [confirmRestoreTarget, setConfirmRestoreTarget] = useState<DeletedCaseBackup | null>(null);

  // Toggle diff expansion
  const toggleExpand = (id: string) => {
    setExpandedRevisionIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Filter revisions
  const filteredRevisions = useMemo(() => {
    return revisions.filter((rev) => {
      // Case filter
      if (selectedCaseFilter && rev.caseId !== selectedCaseFilter) {
        return false;
      }

      // Action type filter
      if (actionFilter !== 'all' && rev.actionType !== actionFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesBlack = rev.blackCaseNo?.toLowerCase().includes(q);
        const matchesRed = rev.redCaseNo?.toLowerCase().includes(q);
        const matchesCourt = rev.court?.toLowerCase().includes(q);
        const matchesProsecutor = rev.prosecutorName?.toLowerCase().includes(q);
        const matchesEditor = rev.editorName?.toLowerCase().includes(q);
        const matchesSummary = rev.changeSummary?.toLowerCase().includes(q);

        if (
          !matchesBlack &&
          !matchesRed &&
          !matchesCourt &&
          !matchesProsecutor &&
          !matchesEditor &&
          !matchesSummary
        ) {
          return false;
        }
      }

      return true;
    });
  }, [revisions, selectedCaseFilter, actionFilter, searchQuery]);

  // Filter deleted cases
  const filteredDeletedCases = useMemo(() => {
    return deletedCases.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        item.blackCaseNo?.toLowerCase().includes(q) ||
        item.redCaseNo?.toLowerCase().includes(q) ||
        item.court?.toLowerCase().includes(q) ||
        item.deletedBy?.toLowerCase().includes(q) ||
        item.caseData.defendant?.toLowerCase().includes(q) ||
        item.caseData.responsiblePerson?.toLowerCase().includes(q)
      );
    });
  }, [deletedCases, searchQuery]);

  // Format time nicely
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const datePart = formatThaiDate(isoString.slice(0, 10));
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${datePart} เวลา ${hours}:${minutes} น.`;
    } catch {
      return isoString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold font-['Prompt'] text-white">
                  ระบบย้อนกลับข้อมูล & ประวัติการแก้ไข (Data Rollback & Revision History)
                </h2>
                <span className="bg-amber-400 text-slate-950 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                  {revisions.length} เวอร์ชัน
                </span>
                {deletedCases.length > 0 && (
                  <span className="bg-rose-500/30 text-rose-200 border border-rose-400/30 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    ถังขยะ {deletedCases.length} รายการ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                ตรวจสอบและย้อนกลับข้อมูลสำนวนคดีที่เคยกรอกหรือแก้ไขไปแล้ว คืนค่าสู่เวอร์ชันเดิมได้อย่างปลอดภัย
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                title="รีเฟรชประวัติการแก้ไข"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Tabs: Revisions vs Deleted Trash */}
            <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('revisions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'revisions'
                    ? 'bg-white text-indigo-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>ประวัติการแก้ไข & จุดย้อนกลับ</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-900 font-mono px-1.5 py-0.2 rounded-full font-bold">
                  {revisions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('trash')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'trash'
                    ? 'bg-white text-rose-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>สำนวนที่ถูกลบ (กู้คืนได้)</span>
                {deletedCases.length > 0 && (
                  <span className="text-[10px] bg-rose-100 text-rose-900 font-mono px-1.5 py-0.2 rounded-full font-bold">
                    {deletedCases.length}
                  </span>
                )}
              </button>
            </div>

            {/* Selected case indicator filter */}
            {selectedCaseFilter && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs text-indigo-900">
                <span className="font-semibold">กำลังกรองเฉพาะสำนวนนี้</span>
                <button
                  type="button"
                  onClick={() => setSelectedCaseFilter(undefined)}
                  className="text-indigo-600 hover:text-indigo-900 font-bold underline cursor-pointer"
                >
                  แสดงประวัติทุกสำนวน
                </button>
              </div>
            )}
          </div>

          {/* Search and Action Type filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาเลขคดีดำ / คดีแดง / ศาล / อัยการ / ผู้ทำการแก้ไข..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeTab === 'revisions' && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 shrink-0">
                {[
                  { id: 'all', label: 'ทั้งหมด' },
                  { id: 'edit', label: 'แก้ไขสำนวน' },
                  { id: 'judgment', label: 'คำพิพากษา' },
                  { id: 'extension', label: 'ขยายเวลา' },
                  { id: 'completion', label: 'เสร็จสิ้น' },
                  { id: 'revert', label: 'การย้อนกลับ' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActionFilter(f.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      actionFilter === f.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {activeTab === 'revisions' ? (
            filteredRevisions.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700 font-['Prompt']">
                  ไม่พบประวัติการแก้ไขข้อมูลตามเงื่อนไขที่ค้นหา
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  เมื่อมีการบันทึกหรือแก้ไขข้อมูลสำนวนคดีในระบบ ระบบจะเก็บประวัติเวอร์ชันและจุดย้อนกลับข้อมูลไว้ที่นี่โดยอัตโนมัติ
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-xs text-indigo-600 font-bold hover:underline"
                  >
                    ล้างการค้นหา
                  </button>
                )}
              </div>
            ) : (
              filteredRevisions.map((rev, index) => {
                const isExpanded = expandedRevisionIds[rev.id] ?? (index === 0 && filteredRevisions.length <= 3);

                return (
                  <div
                    key={rev.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition duration-150 overflow-hidden"
                  >
                    {/* Item Card Header */}
                    <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/80 to-white">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 font-['Prompt'] text-sm">
                            คดีดำ {rev.blackCaseNo}
                          </span>
                          {rev.redCaseNo && (
                            <span className="text-xs text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              แดง {rev.redCaseNo}
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                              rev.actionType === 'revert'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : rev.actionType === 'judgment'
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : rev.actionType === 'completion'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : rev.actionType === 'extension'
                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                : 'bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {rev.actionTitle}
                          </span>
                          {rev.court && (
                            <span className="text-xs text-slate-500 font-medium">📍 {rev.court}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatTime(rev.timestamp)}</span>
                          </span>
                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>แก้ไขโดย: <strong>{rev.editorName}</strong> ({rev.editorRole})</span>
                          </span>
                          {rev.prosecutorName && (
                            <span className="text-slate-500">
                              อัยการ: <strong>{rev.prosecutorName}</strong>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-indigo-950 font-medium pt-0.5">
                          <span className="text-slate-500">สิ่งที่เปลี่ยนแปลง:</span>{' '}
                          <span className="bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100 font-semibold text-indigo-900">
                            {rev.changeSummary} ({rev.diffs.length} จุด)
                          </span>
                        </div>
                      </div>

                      {/* Right Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleExpand(rev.id)}
                          className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <span>{isExpanded ? 'ซ่อนการเปรียบเทียบ' : 'ดูรายละเอียดที่เปลี่ยน'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {canRevert && (
                          <button
                            type="button"
                            onClick={() => setConfirmRevertTarget(rev)}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="ย้อนกลับข้อมูลสำนวนนี้ไปเป็นข้อมูลก่อนการแก้ไขในเวลานี้"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>↩️ ย้อนกลับข้อมูล</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Diff Details Box */}
                    {isExpanded && (
                      <div className="p-3.5 border-t border-slate-200 bg-slate-50/50 space-y-2">
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>เปรียบเทียบข้อมูลก่อนและหลังการแก้ไขในรอบนี้:</span>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs divide-y divide-slate-200">
                            <thead className="bg-slate-100/80 text-slate-700 text-[11px] font-bold">
                              <tr>
                                <th className="px-3 py-2 w-1/4">หัวข้อข้อมูล (Field)</th>
                                <th className="px-3 py-2 w-3/8 text-rose-900 bg-rose-50/50">
                                  สภาพก่อนแก้ไข (Snapshot Before)
                                </th>
                                <th className="px-3 py-2 w-3/8 text-emerald-900 bg-emerald-50/50">
                                  สภาพหลังแก้ไข (Snapshot After)
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                              {rev.diffs.map((diff, i) => (
                                <tr key={i} className="hover:bg-slate-50/80">
                                  <td className="px-3 py-2 font-sans font-semibold text-slate-800">
                                    {diff.fieldLabel}
                                  </td>
                                  <td className="px-3 py-2 text-rose-700 bg-rose-50/20 break-words font-medium">
                                    {diff.oldValueFormatted}
                                  </td>
                                  <td className="px-3 py-2 text-emerald-700 bg-emerald-50/20 break-words font-medium">
                                    {diff.newValueFormatted}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span>
                            * หากกดย้อนกลับ ระบบจะนำข้อมูลในช่อง <strong>"สภาพก่อนแก้ไข"</strong> กลับมาเป็นข้อมูลปัจจุบันของสำนวนนี้ทันที
                          </span>
                          {canRevert && (
                            <button
                              type="button"
                              onClick={() => setConfirmRevertTarget(rev)}
                              className="text-amber-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <span>กดย้อนกลับใช้สภาพก่อนแก้ไขนี้</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            /* Tab: Deleted Cases Trash */
            filteredDeletedCases.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <Trash2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700 font-['Prompt']">
                  ไม่มีสำนวนในถังขยะ
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  เมื่อมีการลบสำนวนคดีในระบบ สำนวนจะถูกสำรองไว้ที่นี่ เพื่อให้สามารถกู้คืนกลับสู่ระบบได้ตลอดเวลา
                </p>
              </div>
            ) : (
              filteredDeletedCases.map((del) => (
                <div
                  key={del.id}
                  className="bg-white rounded-xl border border-rose-200 shadow-2xs hover:border-rose-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 font-['Prompt'] text-sm">
                        คดีดำ {del.blackCaseNo}
                      </span>
                      {del.redCaseNo && (
                        <span className="text-xs text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          แดง {del.redCaseNo}
                        </span>
                      )}
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                        ถูกลบเมื่อ: {formatTime(del.deletedAt)}
                      </span>
                      {del.court && (
                        <span className="text-xs text-slate-500 font-medium">📍 {del.court}</span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                      <span>ลบโดย: <strong>{del.deletedBy}</strong> ({del.deletedRole})</span>
                      <span>• โจทก์: {del.caseData.plaintiff || '-'}</span>
                      <span>• จำเลย: {del.caseData.defendant || '-'}</span>
                      <span>• อัยการ: {del.caseData.responsiblePerson || '-'}</span>
                    </div>
                  </div>

                  {canRevert && (
                    <button
                      type="button"
                      onClick={() => setConfirmRestoreTarget(del)}
                      className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>♻️ กู้คืนสำนวนกลับคืน</span>
                    </button>
                  )}
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <span>ระบบเก็บประวัติ Snapshot ทุกการแก้ไขอัตโนมัติเพื่อป้องกันข้อมูลสูญหาย</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Revert Confirmation Modal */}
      {confirmRevertTarget && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Undo2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 font-['Prompt']">
                  ยืนยันการย้อนกลับข้อมูลสำนวน?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  คุณต้องการย้อนกลับข้อมูลคดีดำ <strong>{confirmRevertTarget.blackCaseNo}</strong> ไปเป็นสภาพก่อนการแก้ไขเมื่อ{' '}
                  <strong className="text-slate-900">{formatTime(confirmRevertTarget.timestamp)}</strong> ใช่หรือไม่?
                </p>
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold">รายการที่จะถูกย้อนกลับ ({confirmRevertTarget.diffs.length} จุด):</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 font-medium">
                {confirmRevertTarget.diffs.slice(0, 4).map((d, i) => (
                  <li key={i}>
                    {d.fieldLabel}: <span className="line-through">{d.newValueFormatted}</span> ➔{' '}
                    <strong>{d.oldValueFormatted}</strong>
                  </li>
                ))}
                {confirmRevertTarget.diffs.length > 4 && (
                  <li>และฟิลด์อื่นๆ อีก {confirmRevertTarget.diffs.length - 4} รายการ</li>
                )}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRevertTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onRevertToRevision(confirmRevertTarget);
                  setConfirmRevertTarget(null);
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Undo2 className="w-4 h-4" />
                <span>ยืนยันย้อนกลับข้อมูล</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Deleted Case Confirmation Modal */}
      {confirmRestoreTarget && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 font-['Prompt']">
                  กู้คืนสำนวนคดีกลับสู่ระบบ?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  สำนวนคดีดำ <strong>{confirmRestoreTarget.blackCaseNo}</strong> {confirmRestoreTarget.redCaseNo ? `(แดง ${confirmRestoreTarget.redCaseNo})` : ''} จะถูกนำกลับคืนสู่สารบบและแสดงในตารางคดีตามปกติ
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRestoreTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onRestoreDeletedCase(confirmRestoreTarget);
                  setConfirmRestoreTarget(null);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ยืนยันกู้คืนสำนวน</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
