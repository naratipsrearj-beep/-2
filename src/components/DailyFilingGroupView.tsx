import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Filter,
  Mic,
  MicOff,
  X,
  Volume2,
  FileText,
  ExternalLink,
  Edit3,
  Scale,
  Shield
} from 'lucide-react';
import { AppealCase } from '../types/appeal';
import { formatThaiDate, getDaysRemaining, getAppealUrgency } from '../utils/dateUtils';
import { useVoiceSearch, VoiceSearchResult } from '../hooks/useVoiceSearch';
import { getAppointmentLabel, getAppointmentBadgeStyle } from '../utils/appointmentUtils';

interface DailyFilingGroupViewProps {
  cases: AppealCase[];
  onMarkComplete: (caseItem: AppealCase) => void;
  onExtendDeadline: (caseItem: AppealCase) => void;
  onAddNewCaseForDate?: (dateStr: string) => void;
  onEditCase?: (caseItem: AppealCase) => void;
  onRecordJudgment?: (caseItem: AppealCase) => void;
  onOpenJudgmentDoc?: (caseItem: AppealCase) => void;
  onExportDailyDoc?: (filingDate: string, cases: AppealCase[]) => void;
  onOpenAppointmentModal?: (caseItem: AppealCase) => void;
  externalDateSearch?: string;
}

export const DailyFilingGroupView: React.FC<DailyFilingGroupViewProps> = ({
  cases,
  onMarkComplete,
  onExtendDeadline,
  onAddNewCaseForDate,
  onEditCase,
  onRecordJudgment,
  onOpenJudgmentDoc,
  onExportDailyDoc,
  onOpenAppointmentModal,
  externalDateSearch = '',
}) => {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [dateSearch, setDateSearch] = useState(externalDateSearch);
  const [filterOnlyActive, setFilterOnlyActive] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  useEffect(() => {
    if (externalDateSearch !== undefined) {
      setDateSearch(externalDateSearch);
    }
  }, [externalDateSearch]);

  const handleVoiceResult = (result: VoiceSearchResult) => {
    const raw = result.rawTranscript;
    setDateSearch(raw);
    setVoiceNotice(raw);
    setTimeout(() => setVoiceNotice(null), 4000);
  };

  const { isListening, transcript, startListening, stopListening, errorMessage } = useVoiceSearch(handleVoiceResult);

  // จัดกลุ่มตามวันที่ฟ้อง (filingDate)
  const groupedByFilingDate = cases.reduce<Record<string, AppealCase[]>>((acc, caseItem) => {
    const key = caseItem.filingDate || 'ไม่ระบุวันฟ้อง';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(caseItem);
    return acc;
  }, {});

  // เรียงลำดับวันที่ฟ้องจากใหม่ไปเก่า
  const sortedDates = Object.keys(groupedByFilingDate).sort((a, b) => {
    if (a === 'ไม่ระบุวันฟ้อง') return 1;
    if (b === 'ไม่ระบุวันฟ้อง') return -1;
    return b.localeCompare(a);
  });

  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateKey]: prev[dateKey] !== undefined ? !prev[dateKey] : false, // default was open
    }));
  };

  const isExpanded = (dateKey: string) => {
    // If user searched a date or case number, auto-expand matching dates!
    if (dateSearch.trim()) return true;
    return expandedDates[dateKey] !== false;
  };

  // กรองตามคำค้นหาวันที่ หรือกรองเฉพาะสำนวนที่ยังไม่เสร็จสิ้น
  const filteredDates = sortedDates.filter((dateKey) => {
    const casesInGroup = groupedByFilingDate[dateKey];
    if (filterOnlyActive) {
      const hasUnfinished = casesInGroup.some((c) => !c.isCompleted);
      if (!hasUnfinished) return false;
    }
    if (dateSearch) {
      const cleanSearch = dateSearch
        .replace(/ค้นหา/g, '')
        .replace(/ฟ้องวันที่/g, '')
        .replace(/วันที่ฟ้อง/g, '')
        .replace(/ยื่นฟ้อง/g, '')
        .replace(/คดีดำ/g, '')
        .replace(/คดีแดง/g, '')
        .replace(/ส\.1/g, '')
        .replace(/ส\.4/g, '')
        .replace(/เลขรับ/g, '')
        .replace(/เลขฟ้อง/g, '')
        .trim()
        .toLowerCase();

      const dateFormatted = formatThaiDate(dateKey).toLowerCase();
      const rawDate = dateKey.toLowerCase();
      const hasMatchingCase = casesInGroup.some(
        (c) =>
          c.blackCaseNo.toLowerCase().includes(cleanSearch) ||
          Boolean(c.redCaseNo && c.redCaseNo.toLowerCase().includes(cleanSearch)) ||
          Boolean(c.receivedNumberS1 && c.receivedNumberS1.toLowerCase().includes(cleanSearch)) ||
          Boolean(c.filingNumberS4 && c.filingNumberS4.toLowerCase().includes(cleanSearch)) ||
          c.blackCaseNo.toLowerCase().includes(dateSearch.toLowerCase()) ||
          Boolean(c.redCaseNo && c.redCaseNo.toLowerCase().includes(dateSearch.toLowerCase())) ||
          Boolean(c.receivedNumberS1 && c.receivedNumberS1.toLowerCase().includes(dateSearch.toLowerCase())) ||
          Boolean(c.filingNumberS4 && c.filingNumberS4.toLowerCase().includes(dateSearch.toLowerCase())) ||
          c.court.toLowerCase().includes(cleanSearch) ||
          c.plaintiff.toLowerCase().includes(cleanSearch) ||
          c.defendant.toLowerCase().includes(cleanSearch)
      );
      return (
        dateFormatted.includes(cleanSearch) ||
        dateFormatted.includes(dateSearch.toLowerCase()) ||
        rawDate.includes(cleanSearch) ||
        hasMatchingCase
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm font-['Prompt']">
              แยกสำนวนตามวันที่ยื่นฟ้อง (รายวัน)
            </h3>
            <p className="text-xs text-slate-500">
              รวม {cases.length} สำนวน แยกเป็น {sortedDates.length} วันที่ฟ้อง
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-72">
            <input
              type="text"
              placeholder={isListening ? transcript || 'กำลังฟังเสียง...' : 'ค้นหาวันที่ฟ้อง หรือเลขคดี...'}
              value={isListening ? transcript : dateSearch}
              onChange={(e) => setDateSearch(e.target.value)}
              className={`w-full text-xs pl-3 pr-14 py-2 border rounded-xl focus:outline-none transition ${
                isListening
                  ? 'border-rose-400 bg-rose-50/40 text-rose-900 ring-2 ring-rose-300'
                  : 'border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500'
              }`}
            />

            {dateSearch && !isListening && (
              <button
                type="button"
                onClick={() => setDateSearch('')}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="ล้างคำค้น"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Voice button */}
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse shadow-xs'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
              }`}
              title={isListening ? 'หยุดฟัง' : 'พูดเพื่อค้นหาวันที่ฟ้อง หรือเลขคดี (เช่น "ฟ้องวันที่ 15 มิถุนายน")'}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button
            onClick={() => setFilterOnlyActive(!filterOnlyActive)}
            className={`text-xs px-3 py-2 rounded-xl border font-medium flex items-center gap-1.5 transition ${
              filterOnlyActive
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>เฉพาะที่ยังไม่เสร็จสิ้น</span>
          </button>
        </div>
      </div>

      {/* Voice notice */}
      {voiceNotice && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-amber-700" />
            <span>ค้นหาด้วยคำสั่งเสียง: <strong>"{voiceNotice}"</strong></span>
          </div>
          <button
            onClick={() => {
              setVoiceNotice(null);
              setDateSearch('');
            }}
            className="text-[11px] text-amber-800 underline"
          >
            ล้างคำค้น
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl text-xs text-rose-700">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Date Groups */}
      {filteredDates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          <p className="text-sm font-medium">ไม่พบสำนวนฟ้องที่ตรงกับเงื่อนไขการค้นหา</p>
        </div>
      ) : (
        filteredDates.map((dateKey) => {
          const casesInGroup = groupedByFilingDate[dateKey];
          const uncompletedInGroup = casesInGroup.filter((c) => !c.isCompleted);
          const urgentInGroup = uncompletedInGroup.filter((c) => {
            const u = getAppealUrgency(c);
            return u === 'overdue' || u === 'critical' || u === 'warning';
          });
          const open = isExpanded(dateKey);

          return (
            <div
              key={dateKey}
              className={`bg-white border rounded-xl overflow-hidden shadow-xs transition ${
                urgentInGroup.length > 0 ? 'border-amber-300 ring-1 ring-amber-300/40' : 'border-slate-200'
              }`}
            >
              {/* Group Header */}
              <div
                onClick={() => toggleDate(dateKey)}
                className="p-3.5 sm:p-4 bg-slate-50/70 hover:bg-slate-100/80 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition select-none"
              >
                <div className="flex items-center gap-3">
                  <button className="text-slate-500 hover:text-slate-800 transition">
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-['Prompt'] text-sm sm:text-base">
                      {dateKey === 'ไม่ระบุวันฟ้อง' ? 'ไม่ระบุวันฟ้อง' : `ยื่นฟ้องวันที่: ${formatThaiDate(dateKey, { short: false })}`}
                    </span>
                    <span className="text-xs bg-slate-200/80 text-slate-700 font-medium px-2 py-0.5 rounded-full">
                      {casesInGroup.length} สำนวน
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pl-7 sm:pl-0">
                  {urgentInGroup.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      ใกล้ครบกำหนด {urgentInGroup.length} สำนวน
                    </span>
                  )}

                  {uncompletedInGroup.length > 0 ? (
                    <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      คุมอุทธรณ์อยู่ {uncompletedInGroup.length} สำนวน
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      เสร็จสิ้นครบทุกสำนวน
                    </span>
                  )}

                  {onExportDailyDoc && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportDailyDoc(dateKey, casesInGroup);
                      }}
                      className="text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 font-medium px-2.5 py-1 rounded-lg transition flex items-center gap-1.5"
                      title="เชื่อมโยงและสร้างเอกสาร Google Docs รวบรวมคดีและคำพิพากษาที่ฟ้องในวันนี้"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>สร้าง Google Doc วันฟ้องนี้</span>
                    </button>
                  )}

                  {onAddNewCaseForDate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddNewCaseForDate(dateKey);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-medium px-2 py-1 rounded transition flex items-center gap-1"
                      title="เพิ่มสำนวนที่ฟ้องในวันนี้"
                    >
                      <Plus className="w-3 h-3" />
                      <span>เพิ่มสำนวน</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Group Body: List of cases */}
              {open && (
                <div className="divide-y divide-slate-100 border-t border-slate-200/70">
                  {casesInGroup.map((caseItem) => {
                    const daysLeft = getDaysRemaining(caseItem);
                    const urgency = getAppealUrgency(caseItem);
                    const isCompleted = caseItem.isCompleted;

                    return (
                      <div
                        key={caseItem.id}
                        className={`p-3.5 sm:p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                          isCompleted ? 'bg-slate-50/40 opacity-75' : urgency === 'critical' || urgency === 'overdue' ? 'bg-rose-50/20' : ''
                        }`}
                      >
                        {/* Case Details */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 font-['Prompt'] text-sm">
                              ดำ {caseItem.blackCaseNo}
                            </span>
                            {caseItem.redCaseNo ? (
                              <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                แดง {caseItem.redCaseNo}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200">
                                ยังไม่มีเลขแดง
                              </span>
                            )}
                            {caseItem.receivedNumberS1 && (
                              <span
                                className="text-xs font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1"
                                title={`ข้อมูลเลขรับ ส.1: ${caseItem.receivedNumberS1}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                                <span>ส.1: {caseItem.receivedNumberS1}</span>
                              </span>
                            )}
                            {caseItem.filingNumberS4 && (
                              <span
                                className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1"
                                title={`ข้อมูลเลขฟ้อง ส.4: ${caseItem.filingNumberS4}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <span>ส.4: {caseItem.filingNumberS4}</span>
                              </span>
                            )}
                            {caseItem.prosecutorName && (
                              <span
                                className="text-xs font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1"
                                title={`อัยการเจ้าของสำนวน: ${caseItem.prosecutorName}`}
                              >
                                <span className="text-amber-700">⚖️ อัยการ:</span> {caseItem.prosecutorName}
                              </span>
                            )}
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {caseItem.caseType}
                            </span>
                            <span className="text-xs text-slate-700 font-medium">
                              📍 {caseItem.court}
                            </span>

                            {/* Court Appointment Badge */}
                            {caseItem.appointmentType && caseItem.appointmentType !== 'none' && (
                              <div className="flex flex-wrap items-center gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getAppointmentBadgeStyle(caseItem.appointmentType).bg} ${getAppointmentBadgeStyle(caseItem.appointmentType).text} ${getAppointmentBadgeStyle(caseItem.appointmentType).border}`}
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
                                    <span>นัดที่ {aIdx + 2}: {getAppointmentLabel(appt.type, appt.typeName)} {formatThaiDate(appt.date)}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {caseItem.googleDocUrl && (
                              <a
                                href={caseItem.googleDocUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full hover:bg-blue-100 transition"
                                title="เปิดคำพิพากษาใน Google Docs"
                              >
                                <FileText className="w-3 h-3 text-blue-600" />
                                <span>ดูใน Google Docs</span>
                                <ExternalLink className="w-2.5 h-2.5 text-blue-500" />
                              </a>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                            <div><span className="text-slate-500">โจทก์:</span> {caseItem.plaintiff}</div>
                            <div><span className="text-slate-500">จำเลย:</span> {caseItem.defendant}</div>
                            <div><span className="text-slate-500">ผู้รับผิดชอบ:</span> {caseItem.responsiblePerson}</div>
                          </div>

                          {caseItem.fullJudgmentText ? (
                            <div className="text-xs text-slate-800 bg-blue-50/50 p-2 rounded border border-blue-200/60">
                              <span className="font-semibold text-blue-900">คำพิพากษา (Google Doc):</span>{' '}
                              <span className="line-clamp-2">{caseItem.fullJudgmentText}</span>
                            </div>
                          ) : caseItem.judgmentOutcome ? (
                            <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-200/70">
                              <span className="font-medium text-slate-800">ผลคำพิพากษา:</span> {caseItem.judgmentOutcome}
                            </div>
                          ) : null}
                        </div>

                        {/* Deadlines & Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:border-l md:border-slate-200 md:pl-4 flex-shrink-0">
                          {/* Deadline Info */}
                          <div className="text-xs text-slate-700 space-y-0.5">
                            {caseItem.judgmentDate ? (
                              <>
                                <div>
                                  <span className="text-slate-500">พิพากษา:</span> {formatThaiDate(caseItem.judgmentDate)}
                                </div>
                                <div className="font-medium">
                                  <span className="text-slate-500">ครบอุทธรณ์ 1 ด.:</span>{' '}
                                  <span className={isCompleted ? 'text-slate-600' : 'text-rose-700 font-bold'}>
                                    {formatThaiDate(caseItem.extendedDeadline || caseItem.appealDeadline)}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                  <Shield className="w-3 h-3 text-indigo-600" />
                                  <span>จำเลยปฏิเสธ (ยังไม่มีคำพิพากษา)</span>
                                </div>
                                {caseItem.appointmentDate && (
                                  <div className="font-semibold text-slate-800">
                                    <span className="text-slate-500 font-normal">นัดถัดไป:</span>{' '}
                                    <span className="text-indigo-700">{getAppointmentLabel(caseItem.appointmentType, caseItem.appointmentTypeName)}</span>{' '}
                                    <span className="font-bold">{formatThaiDate(caseItem.appointmentDate)}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Status indicator */}
                            <div className="pt-0.5">
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  เสร็จสิ้นแล้ว (ไม่แจ้งเตือน)
                                </span>
                              ) : !caseItem.judgmentDate && !caseItem.appealDeadline ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                  <Clock className="w-3 h-3 text-indigo-600" />
                                  รอนัดพิจารณา {caseItem.subsequentAppointments && caseItem.subsequentAppointments.length > 0 ? `(มีอีก ${caseItem.subsequentAppointments.length} นัด)` : ''}
                                </span>
                              ) : urgency === 'overdue' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                  <Clock className="w-3 h-3" />
                                  ขาดอุทธรณ์แล้ว ({Math.abs(daysLeft)} วัน)
                                </span>
                              ) : urgency === 'critical' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full animate-bounce">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  เตือนด่วน: เหลืออีก {daysLeft} วัน
                                </span>
                              ) : urgency === 'warning' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full">
                                  <Clock className="w-3 h-3 text-yellow-600" />
                                  เหลืออีก {daysLeft} วัน
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  เหลืออีก {daysLeft} วัน
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick buttons */}
                          <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                            {/* Edit Button - PROMINENTLY DISPLAYED */}
                            {onEditCase && (
                              <button
                                onClick={() => onEditCase(caseItem)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs py-1.5 px-3 rounded-lg transition font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                                title="แก้ไขหรือเพิ่มเติมข้อมูลสำนวนคดีที่กรอกไปแล้ว (เลขคดี, วันนัดต่อๆ ไป, วันพิพากษา, คู่ความ, ผู้รับผิดชอบ ฯลฯ)"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                                <span>แก้ไข / เพิ่มเติมข้อมูล</span>
                              </button>
                            )}

                            {onRecordJudgment && !caseItem.judgmentDate && (
                              <button
                                onClick={() => onRecordJudgment(caseItem)}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs py-1.5 px-2.5 rounded-lg transition font-medium flex items-center gap-1 shadow-2xs"
                                title="เมื่อศาลมีคำพิพากษาแล้ว ระบุวันพิพากษาเพื่อเริ่มคุมกำหนดเวลาอุทธรณ์ 1 เดือน"
                              >
                                <Scale className="w-3.5 h-3.5 text-indigo-700" />
                                <span>พิพากษาแล้ว</span>
                              </button>
                            )}

                            {onOpenAppointmentModal && (
                              <button
                                onClick={() => onOpenAppointmentModal(caseItem)}
                                className={`text-xs py-1.5 px-2.5 rounded-lg transition font-medium flex items-center gap-1 ${
                                  caseItem.appointmentType && caseItem.appointmentType !== 'none'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                                    : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700'
                                }`}
                                title="ระบุหรือแก้ไขขั้นตอนนัดของศาล (นัดคุ้มครองสิทธิ, สืบเสาะ หรืออื่นๆ)"
                              >
                                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                <span>{caseItem.appointmentType && caseItem.appointmentType !== 'none' ? 'นัดศาล' : 'ระบุนัด'}</span>
                              </button>
                            )}

                            {onOpenJudgmentDoc && (
                              <button
                                onClick={() => onOpenJudgmentDoc(caseItem)}
                                className={`text-xs py-1.5 px-2.5 rounded-lg transition font-medium flex items-center gap-1 ${
                                  caseItem.googleDocUrl
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                    : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700'
                                }`}
                                title="กรอกคำพิพากษาและเชื่อมโยงลง Google Docs"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>{caseItem.googleDocUrl ? 'คำพิพากษา (Doc)' : 'กรอกคำพิพากษา'}</span>
                              </button>
                            )}

                            {!isCompleted ? (
                              <button
                                onClick={() => onMarkComplete(caseItem)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 transition shadow-xs"
                                title="กดเสร็จสิ้นเมื่อยื่นอุทธรณ์หรือยุติสำนวนแล้ว (จะหยุดแจ้งเตือน)"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>เสร็จสิ้นสำนวน</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onMarkComplete(caseItem)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs py-1.5 px-2.5 rounded-lg transition"
                                title="แก้ไขสถานะหรือเปิดสำนวนใหม่"
                              >
                                แก้ไขสถานะ
                              </button>
                            )}

                            {!isCompleted && caseItem.judgmentDate && (
                              <button
                                onClick={() => onExtendDeadline(caseItem)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-1.5 px-2.5 rounded-lg transition"
                                title="ขอขยายระยะเวลาอุทธรณ์"
                              >
                                ขยายเวลา
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
