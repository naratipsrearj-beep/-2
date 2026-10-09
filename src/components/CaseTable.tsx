import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  MoreVertical,
  Plus,
  ArrowUpDown,
  Download,
  Trash2,
  Edit2,
  Mic,
  MicOff,
  X,
  Volume2,
  FileText,
  ExternalLink,
  Mail,
  Copy,
  QrCode,
  Scale,
  Palette
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate, getDaysRemaining, getAppealUrgency } from '../utils/dateUtils';
import { useVoiceSearch, VoiceSearchResult } from '../hooks/useVoiceSearch';
import {
  getAppointmentLabel,
  getAppointmentBadgeStyle,
  isCaseConfessed,
  isCaseDenied,
  getRequisitionStatus,
  isJudgmentRecorded,
  shouldAlertMissingJudgment
} from '../utils/appointmentUtils';
import { CopyCaseDropdown } from './CopyCaseDropdown';
import { formatJudgmentForClipboard, copyTextToClipboard } from '../utils/copyCaseUtils';
import { getCaseCardStyle } from './DailyFilingByDateView';
import { LinkedCasesModal } from './LinkedCasesModal';
import { buildLinkedCasesMap, caseMatchesWithLinkedSearch, baseCaseMatcher } from '../utils/linkedCaseUtils';

interface CaseTableProps {
  cases: AppealCase[];
  canEdit?: boolean;
  onMarkComplete: (caseItem: AppealCase) => void;
  onExtendDeadline: (caseItem: AppealCase) => void;
  onRecordJudgment?: (caseItem: AppealCase) => void;
  onEditCase?: (caseItem: AppealCase) => void;
  onCreateSeveredCase?: (parentCase: AppealCase) => void;
  onSyncCalendar?: (caseItem: AppealCase) => void;
  onOpenJudgmentDoc?: (caseItem: AppealCase) => void;
  onSendEmailAlert?: (caseItem: AppealCase) => void;
  onOpenAppointmentModal?: (caseItem: AppealCase) => void;
  onDeleteCase: (id: string) => void;
  onAddNewCase: () => void;
  onOpenFileLabel?: (caseItem: AppealCase) => void;
  onOpenCourtPetition?: (caseItem: AppealCase) => void;
  onToast?: (message: string) => void;
  initialFilter?: string;
  externalSearchTerm?: string;
}

export const CaseTable: React.FC<CaseTableProps> = ({
  cases,
  canEdit = true,
  onMarkComplete,
  onExtendDeadline,
  onRecordJudgment,
  onEditCase,
  onCreateSeveredCase,
  onSyncCalendar,
  onOpenJudgmentDoc,
  onSendEmailAlert,
  onOpenAppointmentModal,
  onDeleteCase,
  onAddNewCase,
  onOpenFileLabel,
  onOpenCourtPetition,
  onToast,
  initialFilter = 'all',
  externalSearchTerm = '',
}) => {
  const [searchTerm, setSearchTerm] = useState(externalSearchTerm);
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [sortBy, setSortBy] = useState<'deadline' | 'filing' | 'judgment'>('deadline');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [selectedLinkedModalData, setSelectedLinkedModalData] = useState<{ current: AppealCase; linked: AppealCase[] } | null>(null);

  // แคชความเชื่อมโยงของสำนวนคดีทั้งหมดเพื่อการค้นหาและการแสดงผลที่รวดเร็ว
  const prebuiltLinkedMap = React.useMemo(() => buildLinkedCasesMap(cases), [cases]);

  useEffect(() => {
    if (externalSearchTerm !== undefined) {
      setSearchTerm(externalSearchTerm);
    }
  }, [externalSearchTerm]);

  useEffect(() => {
    if (initialFilter) {
      setStatusFilter(initialFilter);
    }
  }, [initialFilter]);

  const handleVoiceResult = (result: VoiceSearchResult) => {
    const raw = result.rawTranscript;
    setSearchTerm(raw);
    setVoiceNotice(raw);
    setTimeout(() => setVoiceNotice(null), 4000);
  };

  const { isListening, transcript, startListening, stopListening, errorMessage } = useVoiceSearch(handleVoiceResult);

  const filteredCases = cases
    .filter((c) => {
      // Status filter
      if (statusFilter === 'urgent') {
        if (c.isCompleted) return false;
        const u = getAppealUrgency(c);
        return u === 'overdue' || u === 'critical' || u === 'warning';
      }
      if (statusFilter === 'active') {
        return !c.isCompleted && getAppealUrgency(c) === 'normal';
      }
      if (statusFilter === 'requisition') {
        return !c.isCompleted && (c.isRequisitionCase || c.appointmentType === 'requisition');
      }
      if (statusFilter === 'pending_trial') {
        return !c.isCompleted && !isJudgmentRecorded(c);
      }
      if (statusFilter === 'severed') {
        return c.isSeveredCase || Boolean(c.originalBlackCaseNo) || Boolean(c.severedFromCaseId);
      }
      if (statusFilter === 'completed') {
        return c.isCompleted;
      }
      return true;
    })
    .filter((c) => {
      // ค้นหาโดยรวมสำนวนที่เชื่อมโยงกัน (Linked Cases Search)
      if (!searchTerm) return true;
      const linkedRes = caseMatchesWithLinkedSearch(c, cases, searchTerm, baseCaseMatcher, prebuiltLinkedMap);
      return linkedRes.matches;
    })
    .sort((a, b) => {
      if (sortBy === 'deadline') {
        // Active first, then by days remaining
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1;
        }
        return getDaysRemaining(a) - getDaysRemaining(b);
      }
      if (sortBy === 'filing') {
        return (b.filingDate || '').localeCompare(a.filingDate || '');
      }
      return (b.judgmentDate || '').localeCompare(a.judgmentDate || '');
    });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Search & Filter Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({cases.length})
            </button>
            <button
              onClick={() => setStatusFilter('urgent')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'urgent'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              🚨 ใกล้ครบเตือนด่วน (
              {
                cases.filter((c) => {
                  if (c.isCompleted) return false;
                  const u = getAppealUrgency(c);
                  return u === 'overdue' || u === 'critical' || u === 'warning';
                }).length
              }
              )
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'active' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              คุมอยู่ปกติ (
              {cases.filter((c) => !c.isCompleted && getAppealUrgency(c) === 'normal').length}
              )
            </button>
            <button
              onClick={() => setStatusFilter('pending_trial')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'pending_trial'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              มีนัดพิจารณา/ปฏิเสธ/รอพิพากษา (
              {cases.filter((c) => !c.isCompleted && !isJudgmentRecorded(c)).length}
              )
            </button>
            <button
              onClick={() => setStatusFilter('requisition')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'requisition'
                  ? 'bg-orange-600 text-white font-bold shadow-xs'
                  : 'text-orange-700 hover:bg-orange-50'
              }`}
            >
              🚚 สำนวนเบิกฟ้อง (
              {cases.filter((c) => !c.isCompleted && (c.isRequisitionCase || c.appointmentType === 'requisition')).length}
              )
            </button>
            <button
              onClick={() => setStatusFilter('severed')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'severed'
                  ? 'bg-purple-700 text-white font-bold shadow-xs'
                  : 'text-purple-800 hover:bg-purple-50'
              }`}
            >
              ✂️ สำนวนที่ศาลแยกฟ้อง (
              {cases.filter((c) => c.isSeveredCase || Boolean(c.originalBlackCaseNo) || Boolean(c.severedFromCaseId)).length}
              )
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              เสร็จสิ้นแล้ว ({cases.filter((c) => c.isCompleted).length})
            </button>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isListening ? transcript || 'กำลังฟังเสียง...' : 'ค้นหาเลขคดีดำ, คดีแดง, วันที่ฟ้อง...'}
              value={isListening ? transcript : searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-16 py-2 text-xs rounded-xl border transition focus:outline-none ${
                isListening
                  ? 'bg-rose-50 border-rose-400 text-rose-900 ring-2 ring-rose-300'
                  : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-amber-500'
              }`}
            />

            {searchTerm && !isListening && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-9 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="ล้างคำค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Voice-to-Text Button */}
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition ${
                isListening
                  ? 'bg-rose-600 text-white shadow-xs animate-pulse'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
              }`}
              title={isListening ? 'หยุดฟัง' : 'กดเพื่อค้นหาด้วยเสียง (พูดเลขคดีดำ, แดง หรือวันฟ้อง)'}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={onAddNewCase}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs flex-shrink-0 cursor-pointer active:scale-95"
              title="เพิ่มสำนวนคุมอุทธรณ์ 1 เดือน"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มสำนวนคุมอุทธรณ์</span>
            </button>
          )}
        </div>
      </div>

      {/* Voice Status Alert if active */}
      {voiceNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-amber-700" />
            <span>ค้นหาด้วยคำสั่งเสียง: <strong>"{voiceNotice}"</strong></span>
          </div>
          <button
            onClick={() => {
              setVoiceNotice(null);
              setSearchTerm('');
            }}
            className="text-[11px] text-amber-800 underline"
          >
            ล้างคำค้น
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-700">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* แถบสีอธิบายสถานะพื้นหลังสำนวนตามคำขอที่ 6 */}
      <div className="bg-white border-b border-slate-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-800 font-bold">
          <Palette className="w-4 h-4 text-indigo-600" />
          <span>สีแถวสำนวนจำแนกตามคำให้การ / นัด:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-950 border-l-4 border-l-emerald-500 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>สีเขียว = จำเลยรับสารภาพ</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-950 border-l-4 border-l-amber-500 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>สีส้ม/อำพัน = จำเลยปฏิเสธ (มีนัดต่อ)</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-300 text-sky-950 border-l-4 border-l-sky-500 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
            <span>สีฟ้า = มีนัดอื่นๆ ที่จำเลยยังไม่ให้การ / เบิกฟ้อง</span>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs table-auto">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-medium text-[11px]">
              <th className="py-2.5 px-2 w-8 text-center">#</th>
              <th className="py-2.5 px-2 whitespace-nowrap">วันที่ฟ้อง</th>
              <th className="py-2.5 px-2">เลขคดีดำ / แดง</th>
              <th className="py-2.5 px-2">ศาล & คู่ความ</th>
              <th className="py-2.5 px-2 whitespace-nowrap">วันที่พิพากษา</th>
              <th className="py-2.5 px-2 whitespace-nowrap">
                <button
                  onClick={() => setSortBy(sortBy === 'deadline' ? 'filing' : 'deadline')}
                  className="inline-flex items-center gap-1 text-slate-700 hover:text-amber-600 font-semibold"
                >
                  <span>ครบอุทธรณ์ 1 ด.</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-2.5 px-2 whitespace-nowrap">สถานะ & การเตือน</th>
              <th className="py-2.5 px-2 text-center min-w-[190px]">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCases.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  ไม่พบข้อมูลสำนวนคดีที่ตรงกับเงื่อนไข
                </td>
              </tr>
            ) : (
              filteredCases.map((caseItem, idx) => {
                const daysLeft = getDaysRemaining(caseItem);
                const urgency = getAppealUrgency(caseItem);
                const isCompleted = caseItem.isCompleted;
                const tableStyle = getCaseCardStyle(caseItem);

                return (
                  <tr
                    key={caseItem.id}
                    className={`transition border-b border-slate-100 ${
                      isCompleted
                        ? 'bg-slate-50/50 text-slate-500 opacity-80'
                        : tableStyle.colorName === 'emerald'
                        ? 'bg-emerald-50/50 hover:bg-emerald-50/80 border-l-4 border-l-emerald-500'
                        : tableStyle.colorName === 'amber'
                        ? 'bg-amber-50/50 hover:bg-amber-50/80 border-l-4 border-l-amber-500'
                        : 'bg-sky-50/50 hover:bg-sky-50/80 border-l-4 border-l-sky-500'
                    }`}
                  >
                    {/* Index */}
                    <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Filing Date */}
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <div className="font-medium text-slate-800 text-[11px]">
                        {formatThaiDate(caseItem.filingDate)}
                      </div>
                      <span className="text-[10px] text-slate-400">วันยื่นฟ้อง</span>
                    </td>

                    {/* Case Numbers */}
                    <td className="py-2.5 px-2">
                      <div className="font-bold text-slate-900 font-['Prompt'] text-xs">
                        ดำ {caseItem.blackCaseNo}
                      </div>
                      {caseItem.redCaseNo ? (
                        <div className="text-rose-700 font-semibold text-[11px]">
                          แดง {caseItem.redCaseNo}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[10px]">
                          (ยังไม่มีเลขแดง)
                        </div>
                      )}
                      {caseItem.receivedNumberS1 && (
                        <div
                          className="text-[10px] text-blue-700 font-medium bg-blue-50/80 border border-blue-200/60 rounded px-1.5 py-0.5 mt-0.5 flex items-center gap-1 truncate max-w-[160px]"
                          title={`ข้อมูลเลขรับ ส.1: ${caseItem.receivedNumberS1}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                          <span className="font-semibold text-blue-900">ส.1:</span> {caseItem.receivedNumberS1}
                        </div>
                      )}
                      {caseItem.filingNumberS4 && (
                        <div
                          className="text-[10px] text-emerald-700 font-medium bg-emerald-50/80 border border-emerald-200/60 rounded px-1.5 py-0.5 mt-0.5 flex items-center gap-1 truncate max-w-[160px]"
                          title={`ข้อมูลเลขฟ้อง ส.4: ${caseItem.filingNumberS4}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="font-semibold text-emerald-900">ส.4:</span> {caseItem.filingNumberS4}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {caseItem.caseType}
                        </span>
                        {(caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition') && (
                          <span className="text-[10px] font-semibold text-orange-800 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded shadow-2xs" title={`สำนวนเบิกฟ้อง ${caseItem.requisitionDate || caseItem.appointmentDate || ''}`}>
                            🚚 เบิกฟ้อง
                          </span>
                        )}
                        {caseItem.isSeveredCase && (
                          <span
                            className="text-[10px] font-bold text-purple-900 bg-purple-100 border border-purple-300 px-1.5 py-0.5 rounded shadow-2xs flex items-center gap-0.5"
                            title={`สำนวนที่ศาลแยกฟ้อง ${caseItem.severedOrderDate ? `เมื่อ ${formatThaiDate(caseItem.severedOrderDate)}` : ''}`}
                          >
                            <span>✂️</span>
                            <span>ศาลสั่งแยกฟ้อง</span>
                          </span>
                        )}
                      </div>

                      {/* ข้อมูลเลขคดีเดิม (กรณีเป็นสำนวนแยกฟ้อง) */}
                      {caseItem.isSeveredCase && caseItem.originalBlackCaseNo && (
                        <div className="text-[10px] text-purple-900 bg-purple-50/80 border border-purple-200 rounded px-1.5 py-0.5 mt-1 font-medium truncate max-w-[170px]" title={`ศาลสั่งแยกฟ้องมาจากคดีเดิม: ดำ ${caseItem.originalBlackCaseNo}`}>
                          <span className="text-purple-600 font-semibold">เดิม:</span> ดำ {caseItem.originalBlackCaseNo}
                        </div>
                      )}

                      {/* สำนวนที่เชื่อมโยงกัน (Linked Cases Badge & Match Indicator) */}
                      {(() => {
                        const linked = prebuiltLinkedMap.get(caseItem.id) || [];
                        const searchStatus = searchTerm.trim()
                          ? caseMatchesWithLinkedSearch(caseItem, cases, searchTerm, baseCaseMatcher, prebuiltLinkedMap)
                          : null;

                        return (
                          <div className="mt-1 flex flex-col gap-1">
                            {searchStatus?.isLinkedMatch && searchStatus.matchedViaCases.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-900 bg-purple-100 border border-purple-300 rounded px-1.5 py-0.5 shadow-2xs w-fit"
                                title={`พบสำนวนนี้เพราะเชื่อมโยงกับสำนวน ${searchStatus.matchedViaCases.map((m) => `ดำ ${m.blackCaseNo}`).join(', ')} ที่ตรงกับคำค้นหา`}
                              >
                                <span>🔗</span>
                                <span>พบจากเชื่อมโยง: ดำ {searchStatus.matchedViaCases[0].blackCaseNo}</span>
                              </span>
                            )}

                            {linked.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedLinkedModalData({ current: caseItem, linked })}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded px-1.5 py-0.5 transition cursor-pointer text-left w-fit shadow-2xs"
                                title={`คลิกเพื่อดูและเปรียบเทียบสำนวนที่เชื่อมโยงกัน (${linked.length} สำนวน) เช่น สำนวนเดิม / สำนวนแยกฟ้อง`}
                              >
                                <span>🔗</span>
                                <span>เชื่อมโยง {linked.length} สำนวน</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Court & Parties */}
                    <td className="py-2.5 px-2 max-w-[210px]">
                      <div className="font-medium text-slate-800 truncate" title={caseItem.court}>
                        📍 {caseItem.court}
                      </div>
                      <div className="text-slate-500 truncate text-[11px]" title={`โจทก์: ${caseItem.plaintiff}`}>
                        จ: {caseItem.plaintiff}
                      </div>
                      <div className="mt-0.5">
                        <span
                          className="inline-flex items-center gap-1 bg-white/95 border border-amber-300 text-slate-950 px-1.5 py-0.5 rounded font-['Prompt'] text-[11px] font-bold shadow-2xs max-w-full"
                          title={`จำเลย: ${caseItem.defendant}`}
                        >
                          <span className="text-amber-800 font-extrabold text-[10px] shrink-0">👤 ล:</span>
                          <span className="truncate">{caseItem.defendant}</span>
                        </span>
                      </div>

                      {/* แสดงอัยการเจ้าของสำนวน (เด่นชัด ชัดเจน) และ อัยการเวรชี้ (ไม่แย่งจุดสนใจ) แยกบทบาทชัดเจน */}
                      <div className="mt-1 space-y-1">
                        {caseItem.responsiblePerson && caseItem.responsiblePerson !== 'ผู้ดูแลสำนวน' && (
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-950 bg-indigo-50/90 border border-indigo-200 px-1.5 py-0.5 rounded-md shadow-2xs max-w-full" title={`อัยการเจ้าของสำนวน: ${caseItem.responsiblePerson}`}>
                            <span className="text-indigo-700 font-bold shrink-0">👔 อัยการเจ้าของสำนวน:</span>
                            <span className="text-indigo-950 font-bold truncate">{caseItem.responsiblePerson}</span>
                          </div>
                        )}
                        {caseItem.prosecutorName && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded max-w-full" title={`อัยการเวรชี้: ${caseItem.prosecutorName}`}>
                            <span className="text-slate-500 font-medium shrink-0">⚖️ อัยการเวรชี้:</span>
                            <span className="text-slate-700 truncate">{caseItem.prosecutorName}</span>
                          </div>
                        )}
                      </div>

                      {/* Court Appointment Badge (คดีที่จำเลยรับสารภาพจะไม่แสดงนัดคุ้มครองสิทธิ) */}
                      {(() => {
                        const isConfessed = isCaseConfessed(caseItem);

                        const showAppt =
                          caseItem.appointmentType &&
                          caseItem.appointmentType !== 'none' &&
                          !(isConfessed && caseItem.appointmentType === 'rights_protection');

                        const filteredSubsequent = (caseItem.subsequentAppointments || []).filter(
                          (appt) => !(isConfessed && appt.type === 'rights_protection')
                        );

                        if (!showAppt && filteredSubsequent.length === 0) return null;

                        return (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {showAppt && (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getAppointmentBadgeStyle(caseItem.appointmentType!).bg} ${getAppointmentBadgeStyle(caseItem.appointmentType!).text} ${getAppointmentBadgeStyle(caseItem.appointmentType!).border}`}
                                title={caseItem.appointmentNotes || undefined}
                              >
                                <span>{getAppointmentBadgeStyle(caseItem.appointmentType!).icon}</span>
                                <span>{getAppointmentLabel(caseItem.appointmentType!, caseItem.appointmentTypeName)}</span>
                                {caseItem.appointmentDate && (
                                  <span className="font-bold">: {formatThaiDate(caseItem.appointmentDate)}</span>
                                )}
                              </span>
                            )}

                            {filteredSubsequent.map((appt, aIdx) => (
                              <span
                                key={appt.id || aIdx}
                                className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                                title={appt.notes || undefined}
                              >
                                <span>นัดถัดไป ({aIdx + 2}): {getAppointmentLabel(appt.type, appt.typeName)} {formatThaiDate(appt.date)}</span>
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Judgment Date */}
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      {isJudgmentRecorded(caseItem) ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>⚖️ {formatThaiDate(caseItem.judgmentDate!, { short: true })}</span>
                            </span>
                            {canEdit && onRecordJudgment && (
                              <button
                                type="button"
                                onClick={() => onRecordJudgment(caseItem)}
                                className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 p-0.5 rounded transition cursor-pointer"
                                title="คลิกเพื่อดูหรือแก้ไขคำพิพากษา"
                              >
                                <Scale className="w-3.5 h-3.5 text-amber-600 hover:text-amber-800" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await copyTextToClipboard(formatJudgmentForClipboard(caseItem));
                                if (ok && onToast) onToast(`คัดลอกคำพิพากษาคดีดำ ${caseItem.blackCaseNo} แล้ว`);
                              }}
                              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100/80 p-0.5 rounded transition cursor-pointer"
                              title="คลิกเพื่อคัดลอกคำพิพากษา เพื่อนำไปวางในระบบอื่นของสำนักงาน"
                            >
                              <Copy className="w-3.5 h-3.5 text-amber-600 hover:text-amber-800" />
                            </button>
                          </div>
                          {caseItem.judgmentOutcome && (
                            <div className="text-[10px] text-slate-600 truncate max-w-[130px] font-medium" title={caseItem.judgmentOutcome}>
                              {caseItem.judgmentOutcome}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                            ยังไม่มีคำพิพากษา
                          </span>
                          {(caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition') ? (
                            <span className="text-[10px] font-semibold text-orange-800 block mt-0.5">
                              🚚 เบิกฟ้อง (ยังไม่ทราบคำให้การ)
                            </span>
                          ) : caseItem.defendantPlea === 'pending' ? (
                            <span className="text-[10px] text-sky-700 font-medium block mt-0.5">
                              รอนัดพิจารณา (ยังไม่ทราบคำให้การ)
                            </span>
                          ) : isCaseConfessed(caseItem) ? (
                            <span className="text-[10px] font-semibold text-emerald-800 block mt-0.5">
                              🟢 จำเลยรับสารภาพ (ยังไม่กรอกคำพิพากษา)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              จำเลยให้การปฏิเสธ
                            </span>
                          )}
                          {canEdit && onRecordJudgment && shouldAlertMissingJudgment(caseItem) && (
                            <button
                              type="button"
                              onClick={() => onRecordJudgment(caseItem)}
                              className="mt-1 text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition shadow-2xs cursor-pointer active:scale-95"
                              title="จำเลยรับสารภาพ คลิกเพื่อกรอกคำพิพากษาและเริ่มคุมอุทธรณ์ 1 เดือน"
                            >
                              <Scale className="w-3 h-3 text-amber-700" />
                              <span>+ กรอกคำพิพากษา (รับสารภาพ)</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Appeal Deadline (1 month) */}
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      {caseItem.appealDeadline || caseItem.extendedDeadline ? (
                        <div
                          onClick={() => !isCompleted && onExtendDeadline(caseItem)}
                          className={`group inline-block text-left rounded-lg p-1.5 -m-1.5 transition ${
                            !isCompleted
                              ? 'cursor-pointer hover:bg-amber-50/80 hover:ring-1 hover:ring-amber-300'
                              : ''
                          }`}
                          title={
                            !isCompleted
                              ? caseItem.extendedDeadline
                                ? 'คลิกเพื่อแก้ไขวันขยายเวลา หรือขอขยายเวลาเพิ่ม'
                                : 'คลิกเพื่อขอขยายระยะเวลาอุทธรณ์'
                              : undefined
                          }
                        >
                          <div className="flex items-center gap-1.5">
                            <div className={`font-bold ${isCompleted ? 'text-slate-500' : 'text-rose-700'}`}>
                              {formatThaiDate(caseItem.extendedDeadline || caseItem.appealDeadline)}
                            </div>
                            {!isCompleted && (
                              <Edit2 className="w-3 h-3 text-slate-300 group-hover:text-amber-600 transition" />
                            )}
                          </div>
                          {caseItem.extendedDeadline ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 font-bold bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded shadow-2xs group-hover:bg-amber-100 mt-0.5">
                              <span>ขยายครั้งที่ {caseItem.extensionCount || 1}</span>
                              <span className="text-[9px] text-amber-600 underline font-normal">(แก้ไข)</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 block mt-0.5">1 เดือนนับแต่พิพากษา</span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="text-xs text-slate-500 font-medium">รอนัดคำพิพากษา</span>
                          <span className="text-[10px] text-slate-400 block">ยังไม่เริ่มนับระยะเวลา</span>
                        </div>
                      )}
                    </td>

                    {/* Urgency / Status Badge */}
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      {isCompleted ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            เสร็จสิ้น (ไม่แจ้งเตือน)
                          </span>
                          {caseItem.completedDate && (
                            <div className="text-[10px] text-slate-400">
                              เมื่อ {formatThaiDate(caseItem.completedDate)}
                            </div>
                          )}
                        </div>
                      ) : urgency === 'pending_trial' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                          <Calendar className="w-3 h-3 text-indigo-600" />
                          <span>อยู่ระหว่างนัดพิจารณา</span>
                        </span>
                      ) : urgency === 'overdue' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-full animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          ขาดอุทธรณ์แล้ว ({Math.abs(daysLeft)} วัน)
                        </span>
                      ) : urgency === 'critical' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full">
                          <Clock className="w-3 h-3 text-amber-600" />
                          เตือนด่วน: เหลืออีก {daysLeft} วัน
                        </span>
                      ) : urgency === 'warning' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-yellow-800 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-yellow-600" />
                          เหลืออีก {daysLeft} วัน
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-slate-400" />
                          เหลืออีก {daysLeft} วัน
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {canEdit ? (
                          <>
                            {/* กรอกคำพิพากษา / แก้ไขคำพิพากษา */}
                            {onRecordJudgment && (
                              <button
                                onClick={() => onRecordJudgment(caseItem)}
                                className={`text-[11px] py-1 px-2.5 rounded-lg flex items-center gap-1 transition font-bold cursor-pointer active:scale-95 ${
                                  isJudgmentRecorded(caseItem)
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                                    : shouldAlertMissingJudgment(caseItem)
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                }`}
                                title={
                                  isJudgmentRecorded(caseItem)
                                    ? `คำพิพากษาเมื่อ ${formatThaiDate(caseItem.judgmentDate || '')} - คลิกเพื่อแก้ไขคำพิพากษา`
                                    : shouldAlertMissingJudgment(caseItem)
                                    ? 'จำเลยรับสารภาพ กรอกคำพิพากษาเพื่อเริ่มคุมระยะเวลาอุทธรณ์ 1 เดือน'
                                    : 'กรอกคำพิพากษา (เมื่อศาลมีคำตัดสิน)'
                                }
                              >
                                <Scale className={`w-3 h-3 ${isJudgmentRecorded(caseItem) ? 'text-amber-800' : shouldAlertMissingJudgment(caseItem) ? 'text-white' : 'text-slate-500'}`} />
                                <span>{isJudgmentRecorded(caseItem) ? 'แก้คำพิพากษา' : shouldAlertMissingJudgment(caseItem) ? '+ กรอกคำพิพากษา' : 'กรอกคำพิพากษา'}</span>
                              </button>
                            )}

                            {!isCompleted ? (
                              <button
                                onClick={() => onMarkComplete(caseItem)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] py-1 px-2.5 rounded-lg flex items-center gap-1 transition shadow-xs cursor-pointer active:scale-95"
                                title="กรอกวันที่เสร็จสิ้นสำนวน (ยื่นอุทธรณ์/ยุติ)"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>+ วันที่เสร็จ</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onMarkComplete(caseItem)}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold text-[11px] py-1 px-2 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="แก้ไขวันที่เสร็จสิ้น หรือเปลี่ยนสถานะ"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{caseItem.completedDate ? `แก้วันเสร็จ (${formatThaiDate(caseItem.completedDate, { short: true })})` : 'แก้วันเสร็จ'}</span>
                              </button>
                            )}

                            {!isCompleted && (
                              <button
                                onClick={() => onExtendDeadline(caseItem)}
                                className={`text-[11px] py-1 px-2.5 rounded-lg transition font-medium cursor-pointer ${
                                  caseItem.extendedDeadline
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                                title={
                                  caseItem.extendedDeadline
                                    ? 'แก้ไขวันขยายเวลาที่กรอกไว้ หรือขอขยายเวลาเพิ่ม'
                                    : 'ขอขยายเวลาอุทธรณ์'
                                }
                              >
                                {caseItem.extendedDeadline ? 'แก้ไขขยายเวลา' : 'ขยาย'}
                              </button>
                            )}

                            {onOpenJudgmentDoc && (
                              <button
                                onClick={() => onOpenJudgmentDoc(caseItem)}
                                className={`p-1.5 rounded-lg transition ${
                                  caseItem.googleDocUrl
                                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                    : 'text-slate-500 hover:text-blue-700 hover:bg-slate-100'
                                }`}
                                title={caseItem.googleDocUrl ? 'เปิด/แก้ไขคำพิพากษาใน Google Docs' : 'กรอกคำพิพากษาลง Google Docs'}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onOpenAppointmentModal && (() => {
                              const isConfessed = isCaseConfessed(caseItem);
                              const hasActiveAppt =
                                caseItem.appointmentType &&
                                caseItem.appointmentType !== 'none' &&
                                !(isConfessed && caseItem.appointmentType === 'rights_protection');

                              return (
                                <button
                                  onClick={() => onOpenAppointmentModal(caseItem)}
                                  className={`p-1.5 rounded-lg transition ${
                                    hasActiveAppt
                                      ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 ring-1 ring-indigo-200'
                                      : 'text-slate-500 hover:text-indigo-700 hover:bg-indigo-50'
                                  }`}
                                  title={
                                    hasActiveAppt
                                      ? `นัดศาล: ${getAppointmentLabel(caseItem.appointmentType, caseItem.appointmentTypeName)} (${caseItem.appointmentDate ? formatThaiDate(caseItem.appointmentDate) : '-'}) - คลิกเพื่อแก้ไข`
                                      : 'ระบุขั้นตอนนัดของศาล (สืบเสาะ, นัดฟังคำพิพากษา หรืออื่นๆ)'
                                  }
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                              );
                            })()}

                            {onSyncCalendar && (
                              <button
                                onClick={() => onSyncCalendar(caseItem)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                                title="บันทึกเตือนลง Google Calendar"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onSendEmailAlert && (
                              <button
                                onClick={() => onSendEmailAlert(caseItem)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="ส่งอีเมลแจ้งเตือนคดีนี้ไปยัง Gmail"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Copy Case Details & Judgment Dropdown */}
                            <CopyCaseDropdown
                              caseItem={caseItem}
                              onToast={onToast}
                              onOpenFileLabel={onOpenFileLabel}
                              onOpenCourtPetition={onOpenCourtPetition}
                            />

                            {onEditCase && (
                              <button
                                onClick={() => onEditCase(caseItem)}
                                className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition"
                                title="แก้ไข / เพิ่มเติมข้อมูลสำนวนคดี"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => onDeleteCase(caseItem.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              title="ลบสำนวน"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs">
                            {/* Copy Case Details & Judgment Dropdown for viewers */}
                            <CopyCaseDropdown
                              caseItem={caseItem}
                              onToast={onToast}
                              onOpenFileLabel={onOpenFileLabel}
                              onOpenCourtPetition={onOpenCourtPetition}
                            />

                            {onOpenJudgmentDoc && (
                              <button
                                onClick={() => onOpenJudgmentDoc(caseItem)}
                                className={`p-1.5 rounded-lg transition ${
                                  caseItem.googleDocUrl
                                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                    : 'text-slate-500 hover:text-blue-700 hover:bg-slate-100'
                                }`}
                                title={caseItem.googleDocUrl ? 'เปิดคำพิพากษาใน Google Docs' : 'ดูคำพิพากษา'}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <span className="text-[11px] text-slate-400">
                              {isCompleted ? 'เสร็จสิ้นแล้ว' : 'กำลังคุม'}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
