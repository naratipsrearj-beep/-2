import React from 'react';
import { X, ExternalLink, Copy, Check, Scale, Calendar, AlertCircle } from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';
import { isCaseConfessed, isCaseDenied, isJudgmentRecorded } from '../utils/appointmentUtils';
import { copyTextToClipboard } from '../utils/copyCaseUtils';

interface LinkedCasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCase: AppealCase;
  linkedCases: AppealCase[];
  onSelectCase?: (caseItem: AppealCase) => void;
  onEditCase?: (caseItem: AppealCase) => void;
}

export const LinkedCasesModal: React.FC<LinkedCasesModalProps> = ({
  isOpen,
  onClose,
  currentCase,
  linkedCases,
  onSelectCase,
  onEditCase,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen || !currentCase) return null;

  const allRelatedCases = [currentCase, ...linkedCases];

  const handleCopySummary = async (c: AppealCase) => {
    const lines = [
      `【สำนวนคดี${c.isSeveredCase ? ' (ศาลสั่งแยกฟ้อง)' : ''}】`,
      `หมายเลขคดีดำ: ${c.blackCaseNo}`,
      c.redCaseNo ? `หมายเลขคดีแดง: ${c.redCaseNo}` : '',
      c.receivedNumberS1 ? `เลขรับ ส.1: ${c.receivedNumberS1}` : '',
      c.filingNumberS4 ? `เลขฟ้อง ส.4: ${c.filingNumberS4}` : '',
      c.originalBlackCaseNo ? `คดีดำเดิมที่ศาลแยกฟ้อง: ${c.originalBlackCaseNo}` : '',
      `ศาล: ${c.court}`,
      `โจทก์: ${c.plaintiff}`,
      `จำเลย: ${c.defendant}`,
      c.prosecutorName ? `อัยการเวรชี้: ${c.prosecutorName}` : '',
      c.responsiblePerson ? `อัยการเจ้าของสำนวน: ${c.responsiblePerson}` : '',
      c.filingDate ? `วันที่ยื่นฟ้อง: ${formatThaiDate(c.filingDate)}` : '',
      c.severedOrderDate ? `วันที่ศาลสั่งแยกฟ้อง: ${formatThaiDate(c.severedOrderDate)}` : '',
      c.severedDeadlineDate ? `กำหนดยื่นฟ้องใหม่: ${formatThaiDate(c.severedDeadlineDate)}` : '',
      c.severedNotes ? `หมายเหตุการแยกฟ้อง: ${c.severedNotes}` : '',
      c.judgmentOutcome ? `ผลคำพิพากษา/ความคืบหน้า: ${c.judgmentOutcome}` : '',
    ].filter(Boolean).join('\n');

    await copyTextToClipboard(lines);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 px-6 py-4.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-white shrink-0 shadow-xs">
              <span className="text-xl">🔗</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-['Prompt'] text-white">
                  สำนวนคดีที่เชื่อมโยงกัน (สำนวนที่ศาลแยกฟ้อง / สำนวนเดิม)
                </h3>
                <span className="text-xs bg-purple-500/30 text-purple-200 border border-purple-400/40 px-2 py-0.5 rounded-full font-medium">
                  พบ {allRelatedCases.length} สำนวนที่เกี่ยวพัน
                </span>
              </div>
              <p className="text-xs text-purple-200/90 mt-0.5">
                เชื่อมโยงผ่านเลขรับ ส.1, เลขฟ้อง ส.4, หมายเลขคดีดำเดิม หรือคำสั่งแยกฟ้องของศาล
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-purple-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allRelatedCases.map((c, index) => {
              const isCurrent = c.id === currentCase.id;
              const hasJudgment = isJudgmentRecorded(c);
              const isDenied = isCaseDenied(c);
              const isConfessed = isCaseConfessed(c);

              return (
                <div
                  key={c.id}
                  className={`rounded-2xl p-4.5 border transition relative flex flex-col justify-between ${
                    c.isSeveredCase
                      ? 'bg-purple-50/60 border-purple-300 ring-1 ring-purple-400/30 shadow-xs'
                      : isCurrent
                        ? 'bg-white border-amber-300 ring-2 ring-amber-400/30 shadow-xs'
                        : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  {/* Top Badges */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.isSeveredCase ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-950 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-md shadow-2xs">
                            <span>✂️</span>
                            <span>สำนวนที่ศาลแยกฟ้อง</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-950 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md shadow-2xs">
                            <span>🏛️</span>
                            <span>สำนวนต้นทาง / สำนวนเดิม</span>
                          </span>
                        )}

                        {isCurrent && (
                          <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                            สำนวนปัจจุบันที่เปิดดู
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopySummary(c)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition inline-flex items-center gap-1 text-[11px]"
                        title="คัดลอกข้อมูลสรุปสำนวนนี้"
                      >
                        {copiedId === c.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>คัดลอก</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Case Numbers */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200/80 mb-3 space-y-1.5 shadow-2xs">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-['Prompt'] font-extrabold text-sm text-slate-900">
                          ดำ <span className="text-slate-950 text-base">{c.blackCaseNo}</span>
                        </div>
                        {c.redCaseNo ? (
                          <div className="text-rose-700 font-bold text-xs font-['Prompt']">
                            แดง {c.redCaseNo}
                          </div>
                        ) : (
                          <div className="text-slate-400 text-[10px]">
                            (ยังไม่มีเลขคดีแดง)
                          </div>
                        )}
                      </div>

                      {/* S.1 and S.4 Docket numbers */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap">
                        {c.receivedNumberS1 ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md"
                            title={`เลขรับ ส.1 (สารบบรับสำนวน): ${c.receivedNumberS1}`}
                          >
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                            <span>ส.1: {c.receivedNumberS1}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">ส.1: ไม่ได้ระบุ</span>
                        )}

                        {c.filingNumberS4 ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"
                            title={`เลขฟ้อง ส.4 (สารบบการยื่นฟ้อง): ${c.filingNumberS4}`}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                            <span>ส.4: {c.filingNumberS4}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">ส.4: ไม่ได้ระบุ</span>
                        )}
                      </div>

                      {/* If severed, show original black case no */}
                      {c.originalBlackCaseNo && (
                        <div className="text-[11px] text-purple-900 bg-purple-50/70 border border-purple-200 px-2 py-1 rounded-md mt-1 flex items-center justify-between">
                          <span>ศาลสั่งแยกฟ้องมาจากคดีดำ:</span>
                          <span className="font-bold text-purple-950">
                            {c.originalBlackCaseNo}
                            {c.originalRedCaseNo ? ` (แดง ${c.originalRedCaseNo})` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Parties & Details */}
                    <div className="space-y-1.5 text-xs text-slate-700 mb-3">
                      <div className="flex items-start gap-1.5">
                        <span className="text-slate-400 shrink-0">📍 ศาล:</span>
                        <span className="font-medium text-slate-800">{c.court}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-slate-400 shrink-0">👤 จำเลย:</span>
                        <span className="font-bold text-slate-900">{c.defendant}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-slate-400 shrink-0">⚖️ โจทก์:</span>
                        <span className="text-slate-700 truncate">{c.plaintiff}</span>
                      </div>
                      {c.responsiblePerson && (
                        <div className="flex items-start gap-1.5">
                          <span className="text-indigo-600 shrink-0">👔 อัยการเจ้าของสำนวน:</span>
                          <span className="font-semibold text-indigo-950">{c.responsiblePerson}</span>
                        </div>
                      )}
                      {c.filingDate && (
                        <div className="flex items-start gap-1.5">
                          <span className="text-slate-400 shrink-0">📅 วันที่ยื่นฟ้อง:</span>
                          <span>{formatThaiDate(c.filingDate)}</span>
                        </div>
                      )}
                    </div>

                    {/* Severed Order Details */}
                    {c.isSeveredCase && (
                      <div className="bg-purple-100/60 border border-purple-200/90 rounded-xl p-2.5 text-xs text-purple-950 mb-3 space-y-1">
                        {c.severedOrderDate && (
                          <div className="flex items-center justify-between">
                            <span className="text-purple-800">วันที่ศาลสั่งแยกฟ้อง:</span>
                            <span className="font-bold">{formatThaiDate(c.severedOrderDate)}</span>
                          </div>
                        )}
                        {c.severedDeadlineDate && (
                          <div className="flex items-center justify-between text-rose-800 font-medium">
                            <span>กำหนดยื่นฟ้องใหม่:</span>
                            <span className="font-bold">{formatThaiDate(c.severedDeadlineDate)}</span>
                          </div>
                        )}
                        {c.severedNotes && (
                          <div className="text-[11px] text-purple-900 italic pt-1 border-t border-purple-200/60">
                            "{c.severedNotes}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Outcome / Status */}
                    <div className="text-xs rounded-xl p-2.5 bg-slate-100/80 border border-slate-200 text-slate-800">
                      <div className="font-semibold text-[11px] text-slate-600 mb-0.5 flex items-center justify-between">
                        <span>สถานะ / ผลการดำเนินคดี</span>
                        {hasJudgment ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                            พิพากษาแล้ว
                          </span>
                        ) : isDenied ? (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                            จำเลยปฏิเสธ
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-1.5 py-0.2 rounded">
                            มีนัดศาล
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-slate-700">
                        {c.judgmentOutcome || c.notes || 'ยังไม่มีบันทึกผลคำพิพากษาหรือความคืบหน้า'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-200/70 mt-3 flex items-center justify-end gap-2">
                    {onEditCase && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEditCase(c);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition font-medium flex items-center gap-1"
                      >
                        ✏️ แก้ไขสำนวน
                      </button>
                    )}
                    {onSelectCase && !isCurrent && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCase(c);
                          onClose();
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition flex items-center gap-1 shadow-2xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>เปิดดูสำนวนนี้</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-600 flex items-center gap-1.5">
            <span className="text-purple-600 font-bold">ℹ️ เกร็ดระบบ:</span>
            <span>เมื่อค้นหาเลขคดีดำ, ส.1 หรือ ส.4 ระบบจะแสดงทั้งสำนวนเดิมและสำนวนที่ศาลสั่งแยกฟ้องร่วมกันโดยอัตโนมัติ</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
