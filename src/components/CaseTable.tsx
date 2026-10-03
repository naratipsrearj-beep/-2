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
  Mail
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate, getDaysRemaining, getAppealUrgency } from '../utils/dateUtils';
import { useVoiceSearch, VoiceSearchResult } from '../hooks/useVoiceSearch';
import { getAppointmentLabel, getAppointmentBadgeStyle } from '../utils/appointmentUtils';

interface CaseTableProps {
  cases: AppealCase[];
  onMarkComplete: (caseItem: AppealCase) => void;
  onExtendDeadline: (caseItem: AppealCase) => void;
  onEditCase?: (caseItem: AppealCase) => void;
  onSyncCalendar?: (caseItem: AppealCase) => void;
  onOpenJudgmentDoc?: (caseItem: AppealCase) => void;
  onSendEmailAlert?: (caseItem: AppealCase) => void;
  onOpenAppointmentModal?: (caseItem: AppealCase) => void;
  onDeleteCase: (id: string) => void;
  onAddNewCase: () => void;
  initialFilter?: string;
  externalSearchTerm?: string;
}

export const CaseTable: React.FC<CaseTableProps> = ({
  cases,
  onMarkComplete,
  onExtendDeadline,
  onEditCase,
  onSyncCalendar,
  onOpenJudgmentDoc,
  onSendEmailAlert,
  onOpenAppointmentModal,
  onDeleteCase,
  onAddNewCase,
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

          <button
            onClick={onAddNewCase}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มสำนวนคุมอุทธรณ์</span>
          </button>
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
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-medium">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">วันที่ฟ้อง</th>
              <th className="py-3 px-4">เลขคดีดำ / คดีแดง</th>
              <th className="py-3 px-4">ศาล & คู่ความ</th>
              <th className="py-3 px-4">วันที่พิพากษา</th>
              <th className="py-3 px-4">
                <button
                  onClick={() => setSortBy(sortBy === 'deadline' ? 'filing' : 'deadline')}
                  className="inline-flex items-center gap-1 text-slate-700 hover:text-amber-600 font-semibold"
                >
                  <span>ครบกำหนดอุทธรณ์ 1 เดือน</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4">สถานะ & การเตือน</th>
              <th className="py-3 px-4 text-center w-36">การดำเนินการ</th>
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

                return (
                  <tr
                    key={caseItem.id}
                    className={`hover:bg-slate-50/80 transition ${
                      isCompleted
                        ? 'bg-slate-50/30 text-slate-500'
                        : urgency === 'critical' || urgency === 'overdue'
                        ? 'bg-rose-50/20'
                        : ''
                    }`}
                  >
                    {/* Index */}
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>

                    {/* Filing Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        {formatThaiDate(caseItem.filingDate)}
                      </div>
                      <span className="text-[10px] text-slate-400">วันยื่นฟ้อง</span>
                    </td>

                    {/* Case Numbers */}
                    <td className="py-3.5 px-4">
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
                          className="text-[10px] text-blue-700 font-medium bg-blue-50/80 border border-blue-200/60 rounded px-1.5 py-0.5 mt-0.5 flex items-center gap-1 truncate max-w-[170px]"
                          title={`ข้อมูลเลขรับ ส.1: ${caseItem.receivedNumberS1}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                          <span className="font-semibold text-blue-900">ส.1:</span> {caseItem.receivedNumberS1}
                        </div>
                      )}
                      {caseItem.filingNumberS4 && (
                        <div
                          className="text-[10px] text-emerald-700 font-medium bg-emerald-50/80 border border-emerald-200/60 rounded px-1.5 py-0.5 mt-0.5 flex items-center gap-1 truncate max-w-[170px]"
                          title={`ข้อมูลเลขฟ้อง ส.4: ${caseItem.filingNumberS4}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="font-semibold text-emerald-900">ส.4:</span> {caseItem.filingNumberS4}
                        </div>
                      )}
                      {caseItem.prosecutorName && (
                        <div
                          className="text-[11px] font-medium text-amber-950 bg-amber-50/90 border border-amber-200/80 rounded px-1.5 py-0.5 mt-1 truncate max-w-[170px]"
                          title={`อัยการเจ้าของสำนวน: ${caseItem.prosecutorName}`}
                        >
                          <span className="text-amber-800 font-semibold">อัยการ:</span> {caseItem.prosecutorName}
                        </div>
                      )}
                      <div className="mt-1">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {caseItem.caseType}
                        </span>
                      </div>
                    </td>

                    {/* Court & Parties */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-medium text-slate-800 truncate" title={caseItem.court}>
                        📍 {caseItem.court}
                      </div>
                      <div className="text-slate-500 truncate text-[11px]" title={`โจทก์: ${caseItem.plaintiff} / จำเลย: ${caseItem.defendant}`}>
                        จ: {caseItem.plaintiff} | ล: {caseItem.defendant}
                      </div>
                      {caseItem.prosecutorName && (
                        <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1 mt-0.5" title={`อัยการเวรชี้: ${caseItem.prosecutorName}`}>
                          <span>⚖️ เวรชี้:</span>
                          <span className="bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">{caseItem.prosecutorName}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        ผู้รับผิดชอบ: {caseItem.responsiblePerson}
                      </div>

                      {/* Court Appointment Badge */}
                      {caseItem.appointmentType && caseItem.appointmentType !== 'none' && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getAppointmentBadgeStyle(caseItem.appointmentType).bg} ${getAppointmentBadgeStyle(caseItem.appointmentType).text} ${getAppointmentBadgeStyle(caseItem.appointmentType).border}`}
                            title={caseItem.appointmentNotes || undefined}
                          >
                            <span>{getAppointmentBadgeStyle(caseItem.appointmentType).icon}</span>
                            <span>{getAppointmentLabel(caseItem.appointmentType, caseItem.appointmentTypeName)}</span>
                            {caseItem.appointmentDate && (
                              <span className="font-bold">: {formatThaiDate(caseItem.appointmentDate)}</span>
                            )}
                          </span>

                          {/* Subsequent Appointments */}
                          {caseItem.subsequentAppointments && caseItem.subsequentAppointments.map((appt, aIdx) => (
                            <span
                              key={appt.id || aIdx}
                              className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                              title={appt.notes || undefined}
                            >
                              <span>นัดถัดไป ({aIdx + 2}): {getAppointmentLabel(appt.type, appt.typeName)} {formatThaiDate(appt.date)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Judgment Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {caseItem.judgmentDate ? (
                        <>
                          <div className="text-slate-800 font-medium">
                            {formatThaiDate(caseItem.judgmentDate)}
                          </div>
                          {caseItem.judgmentOutcome && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[120px]" title={caseItem.judgmentOutcome}>
                              {caseItem.judgmentOutcome}
                            </div>
                          )}
                        </>
                      ) : (
                        <div>
                          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                            ยังไม่มีคำพิพากษา
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">จำเลยให้การปฏิเสธ</span>
                        </div>
                      )}
                    </td>

                    {/* Appeal Deadline (1 month) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {caseItem.appealDeadline || caseItem.extendedDeadline ? (
                        <>
                          <div className={`font-bold ${isCompleted ? 'text-slate-500' : 'text-rose-700'}`}>
                            {formatThaiDate(caseItem.extendedDeadline || caseItem.appealDeadline)}
                          </div>
                          {caseItem.extendedDeadline ? (
                            <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                              ขยายครั้งที่ {caseItem.extensionCount || 1}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">1 เดือนนับแต่พิพากษา</span>
                          )}
                        </>
                      ) : (
                        <div>
                          <span className="text-xs text-slate-500 font-medium">รอนัดคำพิพากษา</span>
                          <span className="text-[10px] text-slate-400 block">ยังไม่เริ่มนับระยะเวลา</span>
                        </div>
                      )}
                    </td>

                    {/* Urgency / Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
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
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {!isCompleted ? (
                          <button
                            onClick={() => onMarkComplete(caseItem)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] py-1 px-2.5 rounded-lg flex items-center gap-1 transition shadow-xs"
                            title="กดเสร็จสิ้นเมื่อยื่นอุทธรณ์แล้ว (จะหยุดเตือนทันที)"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>เสร็จสิ้น</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onMarkComplete(caseItem)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] py-1 px-2 rounded-lg transition"
                            title="แก้ไขสถานะเสร็จสิ้น"
                          >
                            แก้ไข
                          </button>
                        )}

                        {!isCompleted && (
                          <button
                            onClick={() => onExtendDeadline(caseItem)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] py-1 px-2 rounded-lg transition"
                            title="ขอขยายเวลาอุทธรณ์"
                          >
                            ขยาย
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

                        {onOpenAppointmentModal && (
                          <button
                            onClick={() => onOpenAppointmentModal(caseItem)}
                            className={`p-1.5 rounded-lg transition ${
                              caseItem.appointmentType && caseItem.appointmentType !== 'none'
                                ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 ring-1 ring-indigo-200'
                                : 'text-slate-500 hover:text-indigo-700 hover:bg-indigo-50'
                            }`}
                            title={
                              caseItem.appointmentType && caseItem.appointmentType !== 'none'
                                ? `นัดศาล: ${getAppointmentLabel(caseItem.appointmentType, caseItem.appointmentTypeName)} (${caseItem.appointmentDate ? formatThaiDate(caseItem.appointmentDate) : '-'}) - คลิกเพื่อแก้ไข`
                                : 'ระบุขั้นตอนนัดของศาล (นัดคุ้มครองสิทธิ, สืบเสาะ หรืออื่นๆ)'
                            }
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}

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
