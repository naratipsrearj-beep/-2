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
  MoreHorizontal,
  Scale
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate, getDaysRemaining, getAppealUrgency } from '../utils/dateUtils';
import { useVoiceSearch, VoiceSearchResult } from '../hooks/useVoiceSearch';
import { getAppointmentLabel, getAppointmentBadgeStyle } from '../utils/appointmentUtils';
import { CopyCaseDropdown } from './CopyCaseDropdown';
import { formatJudgmentForClipboard, copyTextToClipboard } from '../utils/copyCaseUtils';

// Helper component for secondary tools (Google Docs, Calendar, Gmail)
const CaseMoreActionsMenu: React.FC<{
  caseItem: AppealCase;
  onOpenJudgmentDoc?: (caseItem: AppealCase) => void;
  onSyncCalendar?: (caseItem: AppealCase) => void;
  onSendEmailAlert?: (caseItem: AppealCase) => void;
}> = ({ caseItem, onOpenJudgmentDoc, onSyncCalendar, onSendEmailAlert }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!onOpenJudgmentDoc && !onSyncCalendar && !onSendEmailAlert) return null;

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
        title="เครื่องมือเสริม (Google Docs, Google Calendar, แจ้งเตือน Gmail)"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in-50 zoom-in-95 text-xs text-left">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
            เครื่องมือเสริม
          </div>

          {onOpenJudgmentDoc && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenJudgmentDoc(caseItem);
              }}
              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <div className="font-medium text-slate-800">Google Docs</div>
                <div className="text-[10px] text-slate-400">
                  {caseItem.googleDocUrl ? 'เปิดคำพิพากษาที่บันทึกไว้' : 'บันทึกคำพิพากษาลง Docs'}
                </div>
              </div>
            </button>
          )}

          {onSyncCalendar && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSyncCalendar(caseItem);
              }}
              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="font-medium text-slate-800">Google Calendar</div>
                <div className="text-[10px] text-slate-400">แจ้งเตือนวันครบกำหนดลงปฏิทิน</div>
              </div>
            </button>
          )}

          {onSendEmailAlert && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSendEmailAlert(caseItem);
              }}
              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition cursor-pointer"
            >
              <Mail className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <div className="font-medium text-slate-800">ส่งอีเมลเตือน</div>
                <div className="text-[10px] text-slate-400">ส่งรายละเอียดเข้า Gmail</div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface CaseTableProps {
  cases: AppealCase[];
  canEdit?: boolean;
  onMarkComplete: (caseItem: AppealCase) => void;
  onExtendDeadline: (caseItem: AppealCase) => void;
  onEditCase?: (caseItem: AppealCase) => void;
  onSyncCalendar?: (caseItem: AppealCase) => void;
  onOpenJudgmentDoc?: (caseItem: AppealCase) => void;
  onSendEmailAlert?: (caseItem: AppealCase) => void;
  onOpenAppointmentModal?: (caseItem: AppealCase) => void;
  onDeleteCase: (id: string) => void;
  onAddNewCase: () => void;
  onToast?: (message: string) => void;
  initialFilter?: string;
  externalSearchTerm?: string;
}

export const CaseTable: React.FC<CaseTableProps> = ({
  cases,
  canEdit = true,
  onMarkComplete,
  onExtendDeadline,
  onEditCase,
  onSyncCalendar,
  onOpenJudgmentDoc,
  onSendEmailAlert,
  onOpenAppointmentModal,
  onDeleteCase,
  onAddNewCase,
  onToast,
  initialFilter = 'all',
  externalSearchTerm = '',
}) => {
  const [searchTerm, setSearchTerm] = useState(externalSearchTerm);
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [sortBy, setSortBy] = useState<'deadline' | 'filing' | 'judgment'>('deadline');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

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
      if (statusFilter === 'pending_trial') {
        return !c.isCompleted && (c.hasJudgment === false || (!c.judgmentDate && !c.appealDeadline));
      }
      if (statusFilter === 'completed') {
        return c.isCompleted;
      }
      return true;
    })
    .filter((c) => {
      // Search
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();

      // Clean prefix if user spoke "คดีดำ" or "คดีแดง" or "ฟ้องวันที่"
      const cleanTerm = term
        .replace(/ค้นหา/g, '')
        .replace(/คดีดำ/g, '')
        .replace(/คดีแดง/g, '')
        .replace(/ส\.1/g, '')
        .replace(/ส\.4/g, '')
        .replace(/เลขรับ/g, '')
        .replace(/เลขฟ้อง/g, '')
        .replace(/ฟ้องวันที่/g, '')
        .replace(/วันที่/g, '')
        .trim();

      // If user specifically searched black or red
      if (term.includes('ดำ') && !term.includes('แดง')) {
        return c.blackCaseNo.toLowerCase().includes(cleanTerm || term);
      }
      if (term.includes('แดง')) {
        return Boolean(c.redCaseNo && c.redCaseNo.toLowerCase().includes(cleanTerm || term));
      }
      if (term.includes('ส.1') || term.includes('เลขรับ')) {
        return Boolean(c.receivedNumberS1 && c.receivedNumberS1.toLowerCase().includes(cleanTerm || term));
      }
      if (term.includes('ส.4') || term.includes('เลขฟ้อง')) {
        return Boolean(c.filingNumberS4 && c.filingNumberS4.toLowerCase().includes(cleanTerm || term));
      }
      if (term.includes('ฟ้อง')) {
        return (
          (c.filingDate && c.filingDate.includes(cleanTerm)) ||
          formatThaiDate(c.filingDate).toLowerCase().includes(cleanTerm)
        );
      }

      return (
        c.blackCaseNo.toLowerCase().includes(term) ||
        c.blackCaseNo.toLowerCase().includes(cleanTerm) ||
        Boolean(c.redCaseNo && c.redCaseNo.toLowerCase().includes(term)) ||
        Boolean(c.redCaseNo && c.redCaseNo.toLowerCase().includes(cleanTerm)) ||
        Boolean(c.receivedNumberS1 && c.receivedNumberS1.toLowerCase().includes(term)) ||
        Boolean(c.receivedNumberS1 && c.receivedNumberS1.toLowerCase().includes(cleanTerm)) ||
        Boolean(c.filingNumberS4 && c.filingNumberS4.toLowerCase().includes(term)) ||
        Boolean(c.filingNumberS4 && c.filingNumberS4.toLowerCase().includes(cleanTerm)) ||
        (c.prosecutorName && c.prosecutorName.toLowerCase().includes(term)) ||
        (c.prosecutorName && c.prosecutorName.toLowerCase().includes(cleanTerm)) ||
        c.court.toLowerCase().includes(term) ||
        c.plaintiff.toLowerCase().includes(term) ||
        c.defendant.toLowerCase().includes(term) ||
        c.responsiblePerson.toLowerCase().includes(term) ||
        (c.filingDate && c.filingDate.includes(term)) ||
        formatThaiDate(c.filingDate).toLowerCase().includes(term)
      );
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
              มีนัดพิจารณา/ปฏิเสธ (
              {cases.filter((c) => !c.isCompleted && (c.hasJudgment === false || (!c.judgmentDate && !c.appealDeadline))).length}
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

          {canEdit ? (
            <button
              onClick={onAddNewCase}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มสำนวนคุมอุทธรณ์</span>
            </button>
          ) : (
            <div className="bg-slate-100 text-slate-600 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 flex-shrink-0 border border-slate-200">
              <span>👁️ โหมดดูข้อมูลอย่างเดียว</span>
            </div>
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-semibold text-xs">
              <th className="py-3 px-3.5 w-12 text-center text-slate-400">#</th>
              <th className="py-3 px-3.5 whitespace-nowrap">วันที่ฟ้อง</th>
              <th className="py-3 px-3.5 min-w-[170px]">เลขคดีดำ / คดีแดง</th>
              <th className="py-3 px-3.5 min-w-[200px]">ศาล & คู่ความ</th>
              <th className="py-3 px-3.5 whitespace-nowrap">คำพิพากษา</th>
              <th className="py-3 px-3.5 whitespace-nowrap">
                <button
                  onClick={() => setSortBy(sortBy === 'deadline' ? 'filing' : 'deadline')}
                  className="inline-flex items-center gap-1 text-slate-700 hover:text-amber-600 font-semibold cursor-pointer"
                >
                  <span>ครบกำหนดอุทธรณ์ 1 เดือน</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </button>
              </th>
              <th className="py-3 px-3.5 whitespace-nowrap">สถานะ & การเตือน</th>
              <th className="py-3 px-3.5 text-center min-w-[210px]">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCases.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Scale className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">ไม่พบข้อมูลสำนวนคดีที่ตรงกับเงื่อนไข</p>
                    <p className="text-xs text-slate-400">สามารถค้นหาด้วยคำอื่น หรือกด "เพิ่มสำนวนคุมอุทธรณ์" เพื่อเริ่มต้นบันทึก</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredCases.map((caseItem, idx) => {
                const daysLeft = getDaysRemaining(caseItem);
                const urgency = getAppealUrgency(caseItem);
                const isCompleted = caseItem.isCompleted;

                return (
                  <tr
                    key={caseItem.id}
                    className={`hover:bg-slate-50/90 transition-colors ${
                      isCompleted
                        ? 'bg-slate-50/40 text-slate-500'
                        : urgency === 'critical' || urgency === 'overdue'
                        ? 'bg-rose-50/25'
                        : ''
                    }`}
                  >
                    {/* Index */}
                    <td className="py-3.5 px-3.5 text-center text-slate-400 font-mono text-xs">
                      {idx + 1}
                    </td>

                    {/* Filing Date */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 text-xs">
                        {formatThaiDate(caseItem.filingDate)}
                      </div>
                      <span className="text-[10px] text-slate-400">วันยื่นฟ้อง</span>
                    </td>

                    {/* Case Numbers (Black, Red, S.1, S.4, Type) */}
                    <td className="py-3.5 px-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 font-['Prompt'] text-sm tracking-tight">
                          ดำ {caseItem.blackCaseNo}
                        </span>
                        {caseItem.redCaseNo ? (
                          <span className="text-rose-700 font-semibold text-xs bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded">
                            แดง {caseItem.redCaseNo}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/50">
                            (ยังไม่มีเลขแดง)
                          </span>
                        )}
                        <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {caseItem.caseType || 'อาญา'}
                        </span>
                      </div>

                      {/* S.1 / S.4 / Prosecutor tags */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px]">
                        {caseItem.receivedNumberS1 && (
                          <span
                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200/70 rounded px-1.5 py-0.5 font-mono"
                            title={`เลขรับ ส.1: ${caseItem.receivedNumberS1}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                            <span className="font-semibold text-blue-900">ส.1:</span> {caseItem.receivedNumberS1}
                          </span>
                        )}
                        {caseItem.filingNumberS4 && (
                          <span
                            className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200/70 rounded px-1.5 py-0.5 font-mono"
                            title={`เลขฟ้อง ส.4: ${caseItem.filingNumberS4}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="font-semibold text-emerald-900">ส.4:</span> {caseItem.filingNumberS4}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Court & Parties & Responsible Officer */}
                    <td className="py-3.5 px-3.5 max-w-xs">
                      <div className="font-medium text-slate-800 flex items-center gap-1 text-xs truncate" title={caseItem.court}>
                        <span className="text-rose-500 text-xs">📍</span>
                        <span>{caseItem.court || 'ศาลจังหวัดเพชรบุรี'}</span>
                      </div>

                      {/* Parties - only display if filled */}
                      {caseItem.plaintiff || caseItem.defendant ? (
                        <div className="text-slate-600 text-[11px] mt-0.5 truncate" title={`โจทก์: ${caseItem.plaintiff || '-'} | จำเลย: ${caseItem.defendant || '-'}`}>
                          {caseItem.plaintiff && (
                            <span><strong className="text-slate-400 font-normal">จ:</strong> {caseItem.plaintiff}</span>
                          )}
                          {caseItem.plaintiff && caseItem.defendant && (
                            <span className="text-slate-300 mx-1">|</span>
                          )}
                          {caseItem.defendant && (
                            <span><strong className="text-slate-400 font-normal">ล:</strong> {caseItem.defendant}</span>
                          )}
                        </div>
                      ) : null}

                      {/* Prosecutor / Duty officer & Responsible person */}
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
                        {caseItem.prosecutorName && (
                          <span className="text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                            ⚖️ อัยการ: {caseItem.prosecutorName}
                          </span>
                        )}
                        {caseItem.responsiblePerson && caseItem.responsiblePerson !== caseItem.prosecutorName && (
                          <span className="text-slate-400">
                            ผู้ดูแล: {caseItem.responsiblePerson}
                          </span>
                        )}
                      </div>

                      {/* Court Appointment Badge */}
                      {caseItem.appointmentType && caseItem.appointmentType !== 'none' && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getAppointmentBadgeStyle(caseItem.appointmentType).bg} ${getAppointmentBadgeStyle(caseItem.appointmentType).text} ${getAppointmentBadgeStyle(caseItem.appointmentType).border}`}
                            title={caseItem.appointmentNotes || undefined}
                          >
                            <span>{getAppointmentBadgeStyle(caseItem.appointmentType).icon}</span>
                            <span>{getAppointmentLabel(caseItem.appointmentType, caseItem.appointmentTypeName)}</span>
                            {caseItem.appointmentDate && (
                              <span className="font-bold">: {formatThaiDate(caseItem.appointmentDate, { short: true })}</span>
                            )}
                          </span>

                          {/* Subsequent Appointments */}
                          {caseItem.subsequentAppointments && caseItem.subsequentAppointments.map((appt, aIdx) => (
                            <span
                              key={appt.id || aIdx}
                              className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                              title={appt.notes || undefined}
                            >
                              <span>นัดถัดไป ({aIdx + 2}): {getAppointmentLabel(appt.type, appt.typeName)} {formatThaiDate(appt.date, { short: true })}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Judgment Date */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      {caseItem.judgmentDate ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-800 font-semibold text-xs">
                              {formatThaiDate(caseItem.judgmentDate)}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await copyTextToClipboard(formatJudgmentForClipboard(caseItem));
                                if (ok && onToast) onToast(`คัดลอกคำพิพากษาคดีดำ ${caseItem.blackCaseNo} แล้ว`);
                              }}
                              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100/80 p-0.5 rounded transition cursor-pointer"
                              title="คลิกเพื่อคัดลอกคำพิพากษา"
                            >
                              <Copy className="w-3.5 h-3.5 text-amber-600 hover:text-amber-800" />
                            </button>
                          </div>
                          {caseItem.judgmentOutcome && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[130px] font-medium mt-0.5" title={caseItem.judgmentOutcome}>
                              {caseItem.judgmentOutcome}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">
                            ⚖️ ยังไม่มีคำพิพากษา
                          </span>
                          {caseItem.defendantPlea && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {caseItem.defendantPlea === 'denied' ? 'จำเลยให้การปฏิเสธ' : caseItem.defendantPlea === 'confessed' ? 'จำเลยรับสารภาพ' : 'รอคำให้การ'}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Appeal Deadline (1 month) */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      {caseItem.appealDeadline || caseItem.extendedDeadline ? (
                        <div
                          onClick={() => !isCompleted && onExtendDeadline(caseItem)}
                          className={`group inline-block text-left rounded-lg p-1 -m-1 transition ${
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
                            <span className={`font-bold text-xs ${isCompleted ? 'text-slate-500' : 'text-rose-700'}`}>
                              {formatThaiDate(caseItem.extendedDeadline || caseItem.appealDeadline)}
                            </span>
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
                          <span className="text-xs text-slate-400 font-medium">— รอวันพิพากษา —</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">ยังไม่เริ่มนับระยะเวลา</span>
                        </div>
                      )}
                    </td>

                    {/* Urgency / Status Badge */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      {isCompleted ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            เสร็จสิ้น (ไม่แจ้งเตือน)
                          </span>
                          {caseItem.completedDate && (
                            <div className="text-[10px] text-slate-400">
                              เมื่อ {formatThaiDate(caseItem.completedDate, { short: true })}
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
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-slate-400" />
                          เหลืออีก {daysLeft} วัน
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {canEdit ? (
                          <>
                            {/* 1. Mark complete status */}
                            {!isCompleted ? (
                              <button
                                onClick={() => onMarkComplete(caseItem)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-1 px-2.5 rounded-lg flex items-center gap-1 transition shadow-xs cursor-pointer"
                                title="กดเสร็จสิ้นเมื่อยื่นอุทธรณ์แล้ว (จะหยุดเตือนทันที)"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>เสร็จสิ้น</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onMarkComplete(caseItem)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs py-1 px-2 rounded-lg transition cursor-pointer"
                                title="แก้ไขสถานะเสร็จสิ้น"
                              >
                                แก้ไขสถานะ
                              </button>
                            )}

                            {/* 2. Extend deadline button (if deadline exists) */}
                            {!isCompleted && (caseItem.appealDeadline || caseItem.extendedDeadline) && (
                              <button
                                onClick={() => onExtendDeadline(caseItem)}
                                className={`text-xs py-1 px-2 rounded-lg transition font-medium cursor-pointer ${
                                  caseItem.extendedDeadline
                                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-semibold'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                }`}
                                title={
                                  caseItem.extendedDeadline
                                    ? 'แก้ไขวันขยายเวลาที่กรอกไว้ หรือขอขยายเวลาเพิ่ม'
                                    : 'ขอขยายเวลาอุทธรณ์'
                                }
                              >
                                {caseItem.extendedDeadline ? 'แก้ไขขยาย' : 'ขยาย'}
                              </button>
                            )}

                            {/* 3. Court appointment modal */}
                            {onOpenAppointmentModal && (
                              <button
                                onClick={() => onOpenAppointmentModal(caseItem)}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  caseItem.appointmentType && caseItem.appointmentType !== 'none'
                                    ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200'
                                    : 'text-slate-500 hover:text-indigo-700 hover:bg-slate-100 border border-slate-200'
                                }`}
                                title={
                                  caseItem.appointmentType && caseItem.appointmentType !== 'none'
                                    ? `นัดศาล: ${getAppointmentLabel(caseItem.appointmentType, caseItem.appointmentTypeName)} - คลิกเพื่อแก้ไข`
                                    : 'ระบุขั้นตอนนัดของศาล (นัดคุ้มครองสิทธิ, สืบเสาะ ฯลฯ)'
                                }
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* 4. Edit case */}
                            {onEditCase && (
                              <button
                                onClick={() => onEditCase(caseItem)}
                                className="p-1.5 text-slate-600 hover:text-amber-800 hover:bg-amber-50 border border-slate-200 rounded-lg transition cursor-pointer"
                                title="แก้ไข / เพิ่มเติมข้อมูลสำนวนคดี"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* 5. Copy dropdown */}
                            <CopyCaseDropdown
                              caseItem={caseItem}
                              onToast={onToast}
                            />

                            {/* 6. More tools (Google Docs, Calendar, Gmail) */}
                            <CaseMoreActionsMenu
                              caseItem={caseItem}
                              onOpenJudgmentDoc={onOpenJudgmentDoc}
                              onSyncCalendar={onSyncCalendar}
                              onSendEmailAlert={onSendEmailAlert}
                            />

                            {/* 7. Delete case */}
                            <button
                              onClick={() => onDeleteCase(caseItem.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition cursor-pointer"
                              title="ลบสำนวน"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 text-xs">
                            <CopyCaseDropdown
                              caseItem={caseItem}
                              onToast={onToast}
                            />
                            <CaseMoreActionsMenu
                              caseItem={caseItem}
                              onOpenJudgmentDoc={onOpenJudgmentDoc}
                              onSyncCalendar={onSyncCalendar}
                              onSendEmailAlert={onSendEmailAlert}
                            />
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
