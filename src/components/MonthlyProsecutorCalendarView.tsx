import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Users,
  Search,
  Clock,
  CheckCircle2,
  Eye,
  Send,
  Plus,
  CalendarPlus,
  CheckSquare,
  ChevronRight,
  Building2,
  UserCheck,
  Filter,
  X,
} from 'lucide-react';
import { AppealCase, MonthlyDutyRoster } from '../types/appeal';
import { formatThaiDate, getTodayString } from '../utils/dateUtils';
import {
  ProsecutorHearingAppointment,
  MonthHearingScheduleResult,
  ProsecutorDirectoryEntry,
  buildMonthlyCalendarGrid,
  buildProsecutorDirectory,
  getCalendarCategoryDisplay,
} from '../utils/monthlyProsecutorAppointmentUtils';
import { CaseNoteHighlight } from './CaseNoteHighlight';

interface MonthlyProsecutorCalendarViewProps {
  cases: AppealCase[];
  dutyRosters?: MonthlyDutyRoster[];
  yearMonth: string;
  monthResult: MonthHearingScheduleResult;
  filteredAppointments: ProsecutorHearingAppointment[];
  selectedProsecutorFilter: string;
  onSelectProsecutor: (prosecutorName: string) => void;
  canEdit?: boolean;
  canComplete?: boolean;
  onSelectCase?: (caseItem: AppealCase) => void;
  onOpenAppointmentModal?: (caseItem: AppealCase) => void;
  onOpenSubmitToDuty?: (caseItem: AppealCase) => void;
  onMarkComplete?: (caseItem: AppealCase) => void;
  onAddNewCaseForDate?: (dateStr: string) => void;
}

const WEEKDAY_HEADERS = [
  { label: 'อาทิตย์', short: 'อา.', isSunday: true, isSaturday: false },
  { label: 'จันทร์', short: 'จ.', isSunday: false, isSaturday: false },
  { label: 'อังคาร', short: 'อ.', isSunday: false, isSaturday: false },
  { label: 'พุธ', short: 'พ.', isSunday: false, isSaturday: false },
  { label: 'พฤหัสบดี', short: 'พฤ.', isSunday: false, isSaturday: false },
  { label: 'ศุกร์', short: 'ศ.', isSunday: false, isSaturday: false },
  { label: 'เสาร์', short: 'ส.', isSunday: false, isSaturday: true },
];

function shortenProsecutorName(name: string): string {
  const cleaned = name
    .replace(/^(ว่าที่ร้อยตรี|ดร\.|นาย|นางสาว|นาง|อัยการ)\s*/i, '')
    .trim();
  const firstPart = cleaned.split(/\s+/)[0] || cleaned;
  if (firstPart.length > 14) return `${firstPart.slice(0, 13)}…`;
  return firstPart;
}

export const MonthlyProsecutorCalendarView: React.FC<MonthlyProsecutorCalendarViewProps> = ({
  cases,
  dutyRosters = [],
  yearMonth,
  monthResult,
  filteredAppointments,
  selectedProsecutorFilter,
  onSelectProsecutor,
  canEdit = false,
  canComplete = false,
  onSelectCase,
  onOpenAppointmentModal,
  onOpenSubmitToDuty,
  onMarkComplete,
  onAddNewCaseForDate,
}) => {
  const todayStr = useMemo(() => getTodayString(), []);
  const dayInspectorRef = useRef<HTMLDivElement>(null);

  const [prosecutorSearch, setProsecutorSearch] = useState('');
  const [showAllDbProsecutors, setShowAllDbProsecutors] = useState(false);

  // วันเริ่มต้นที่เลือกดูรายละเอียดในแผงด้านล่าง
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (todayStr.startsWith(yearMonth)) return todayStr;
    return `${yearMonth}-01`;
  });

  // Sync selectedDate เฉพาะเมื่อเปลี่ยนเดือน (เพื่อให้คลิกดูวันต้น/ปลายเดือนข้างเคียงในตารางได้)
  const prevYearMonthRef = useRef(yearMonth);
  useEffect(() => {
    if (prevYearMonthRef.current === yearMonth) return;
    prevYearMonthRef.current = yearMonth;
    if (todayStr.startsWith(yearMonth)) {
      setSelectedDate(todayStr);
    } else if (filteredAppointments.length > 0) {
      setSelectedDate(filteredAppointments[0].appointmentDate);
    } else {
      setSelectedDate(`${yearMonth}-01`);
    }
  }, [yearMonth, todayStr, filteredAppointments]);

  // ฐานข้อมูลอัยการเชื่อมโยงกับคลังสำนวนและตารางเวรชี้
  const prosecutorDirectory = useMemo<ProsecutorDirectoryEntry[]>(() => {
    return buildProsecutorDirectory(cases, dutyRosters, monthResult);
  }, [cases, dutyRosters, monthResult]);

  const visibleProsecutors = useMemo(() => {
    return prosecutorDirectory.filter((p) => {
      if (!showAllDbProsecutors && p.monthAppointments === 0 && selectedProsecutorFilter !== p.prosecutorName) {
        return false;
      }
      if (prosecutorSearch.trim()) {
        return p.prosecutorName.toLowerCase().includes(prosecutorSearch.trim().toLowerCase());
      }
      return true;
    });
  }, [prosecutorDirectory, showAllDbProsecutors, prosecutorSearch, selectedProsecutorFilter]);

  // ตารางปฏิทิน 7 คอลัมน์
  const calendarCells = useMemo(() => {
    return buildMonthlyCalendarGrid(yearMonth, filteredAppointments, dutyRosters);
  }, [yearMonth, filteredAppointments, dutyRosters]);

  // แบ่งเป็นสัปดาห์ละ 7 วันสำหรับ <table>
  const calendarWeeks = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < calendarCells.length; i += 7) {
      weeks.push(calendarCells.slice(i, i + 7));
    }
    return weeks;
  }, [calendarCells]);

  // ข้อมูลของวันที่กำลังเลือกดูในแผงรายละเอียด
  const selectedCell = useMemo(() => {
    return (
      calendarCells.find((c) => c.date === selectedDate) || {
        date: selectedDate,
        dayNumber: parseInt(selectedDate.split('-')[2] || '1', 10),
        dayOfWeek: 0,
        isCurrentMonth: true,
        isToday: selectedDate === todayStr,
        isWeekend: false,
        appointments: filteredAppointments.filter((a) => a.appointmentDate === selectedDate),
        dutyRecord: undefined,
        countsByStatus: { total: 0, incomplete: 0, completed: 0, submittedToDuty: 0 },
      }
    );
  }, [calendarCells, selectedDate, todayStr, filteredAppointments]);

  const handleSelectDay = (dateStr: string, scrollToDetails = false) => {
    setSelectedDate(dateStr);
    if (scrollToDetails && dayInspectorRef.current) {
      setTimeout(() => {
        dayInspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 40);
    }
  };

  return (
    <div className="space-y-5">
      {/* Main 2-Zone Layout: Prosecutor Database Directory (Left) + 7-Column Calendar Table (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* LEFT PANEL: ฐานข้อมูลอัยการเจ้าของสำนวน (Prosecutor Directory) */}
        <aside className="xl:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 text-slate-700 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 font-['Prompt'] truncate">
                  ฐานข้อมูลอัยการเจ้าของสำนวน
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-600 tabular-nums whitespace-nowrap shrink-0">
                {prosecutorDirectory.length} ท่าน
              </span>
            </div>

            {/* Search Prosecutor */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={prosecutorSearch}
                onChange={(e) => setProsecutorSearch(e.target.value)}
                placeholder="ค้นหาชื่ออัยการ..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              {prosecutorSearch && (
                <button
                  type="button"
                  onClick={() => setProsecutorSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label="ล้างคำค้นหาอัยการ"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Toggle: Only this month vs All in DB */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowAllDbProsecutors((v) => !v)}
                className="text-xs font-medium text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline cursor-pointer"
              >
                {showAllDbProsecutors
                  ? 'แสดงเฉพาะท่านที่มีนัดเดือนนี้'
                  : `แสดงอัยการทั้งหมดในฐานข้อมูล (${prosecutorDirectory.length})`}
              </button>
              {selectedProsecutorFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => onSelectProsecutor('all')}
                  className="text-xs font-semibold text-rose-700 hover:text-rose-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>

          {/* All Prosecutors Option */}
          <div className="p-2 border-b border-slate-100">
            <button
              type="button"
              onClick={() => onSelectProsecutor('all')}
              className={`w-full text-left px-3 py-2 rounded-lg transition cursor-pointer flex items-center justify-between gap-2 ${
                selectedProsecutorFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">อัยการทุกท่าน (รวมทั้งสำนักงาน)</div>
                <div
                  className={`text-[11px] tabular-nums mt-0.5 ${
                    selectedProsecutorFilter === 'all' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  ยังไม่เสร็จ {monthResult.countsByStatus.incomplete} · เสร็จสิ้น {monthResult.countsByStatus.completed}
                </div>
              </div>
              <span
                className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-md shrink-0 ${
                  selectedProsecutorFilter === 'all'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {monthResult.totalAppointments} นัด
              </span>
            </button>
          </div>

          {/* Prosecutor List */}
          <div className="max-h-[460px] xl:max-h-[600px] overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {visibleProsecutors.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                ไม่พบรายชื่ออัยการที่ตรงกับเงื่อนไขในเดือนนี้
              </div>
            ) : (
              visibleProsecutors.map((p) => {
                const isSelected = selectedProsecutorFilter === p.prosecutorName;
                return (
                  <button
                    key={p.prosecutorName}
                    type="button"
                    onClick={() =>
                      onSelectProsecutor(isSelected ? 'all' : p.prosecutorName)
                    }
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-50 border border-blue-300 text-blue-950'
                        : 'hover:bg-slate-50 border border-transparent text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate" title={p.prosecutorName}>
                        {p.prosecutorName}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums mt-0.5 flex flex-wrap items-center gap-x-1.5">
                        {p.monthAppointments > 0 ? (
                          <>
                            <span className={p.monthIncomplete > 0 ? 'text-amber-700 font-semibold' : ''}>
                              ⏳ {p.monthIncomplete}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className={p.monthCompleted > 0 ? 'text-emerald-700 font-semibold' : ''}>
                              ✓ {p.monthCompleted}
                            </span>
                            {p.monthRightsProtection > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>คุ้มครองสิทธิ {p.monthRightsProtection}</span>
                              </>
                            )}
                            {p.monthInvestigation > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>สืบเสาะ {p.monthInvestigation}</span>
                              </>
                            )}
                          </>
                        ) : (
                          <span>ไม่มีนัดเดือนนี้ · คลัง {p.totalCasesInDb} คดี</span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-md shrink-0 ${
                        isSelected
                          ? 'bg-blue-700 text-white'
                          : p.monthAppointments > 0
                          ? 'bg-slate-100 text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {p.monthAppointments}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT PANEL: 7-Column Monthly Calendar Table (ตารางปฏิทินรายเดือน) */}
        <div className="xl:col-span-9 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Calendar Top Context Bar */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                <CalendarIcon className="w-4 h-4 text-blue-700 shrink-0" />
                <span className="font-bold text-slate-900 font-['Prompt'] text-sm">
                  ตารางปฏิทินนัดศาลประจำเดือน{monthResult.monthLabel}
                </span>
                {selectedProsecutorFilter !== 'all' && (
                  <>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="font-bold text-blue-800">
                      กรองเฉพาะ: {selectedProsecutorFilter}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 tabular-nums">
                <span>
                  แสดงทั้งหมด <strong className="text-slate-900">{filteredAppointments.length}</strong> นัด
                </span>
                <span aria-hidden="true" className="text-slate-300">|</span>
                <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>ยังไม่เสร็จสิ้น {filteredAppointments.filter((a) => !a.isCompleted).length}</span>
                </span>
                <span aria-hidden="true" className="text-slate-300">|</span>
                <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>เสร็จสิ้นแล้ว {filteredAppointments.filter((a) => a.isCompleted).length}</span>
                </span>
              </div>
            </div>

            {/* Legend Row (Clean unboxed typography) */}
            <div className="px-4 py-2 border-b border-slate-200 bg-white flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-800">สัญลักษณ์ในปฏิทิน:</span>
              <span>🛡️ คุ้มครองสิทธิ</span>
              <span>🔍 สืบเสาะ</span>
              <span>📝 สืบประกอบฯ</span>
              <span>📋 นัดพร้อม/ตรวจพยาน</span>
              <span>🎙️ สืบพยาน</span>
              <span>⚖️ ฟังคำพิพากษา</span>
              <span>🤝 ไกล่เกลี่ย</span>
              <span>🚚 เบิกฟ้อง</span>
              <span>📌 นัดอื่นๆ</span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <span className="text-amber-800 font-semibold">⏳ ยังไม่กดเสร็จสิ้น</span>
              <span className="text-emerald-700 font-semibold">✓ กดเสร็จสิ้นแล้ว</span>
            </div>

            {/* Desktop 7-Column Calendar Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    {WEEKDAY_HEADERS.map((wh) => (
                      <th
                        key={wh.label}
                        className={`py-2.5 px-2 text-center text-xs font-bold border-r last:border-r-0 border-slate-200 ${
                          wh.isSunday
                            ? 'text-rose-700 bg-rose-50/50'
                            : wh.isSaturday
                            ? 'text-slate-700 bg-slate-100/80'
                            : 'text-slate-800'
                        }`}
                      >
                        วัน{wh.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarWeeks.map((week, wIdx) => (
                    <tr key={wIdx}>
                      {week.map((cell) => {
                        const isSelected = cell.date === selectedDate;
                        const isHoliday = Boolean(cell.dutyRecord?.isHoliday);
                        const dutyOfficers = cell.dutyRecord?.officers || [];
                        const visibleAppts = cell.appointments.slice(0, 3);
                        const hiddenCount = Math.max(0, cell.appointments.length - 3);

                        return (
                          <td
                            key={cell.date}
                            onClick={() => handleSelectDay(cell.date, false)}
                            className={`align-top border border-slate-200 p-1.5 h-[144px] transition-colors cursor-pointer group ${
                              !cell.isCurrentMonth
                                ? 'bg-slate-50/80 text-slate-400'
                                : isSelected
                                ? 'bg-blue-50/60 ring-2 ring-inset ring-blue-600'
                                : isHoliday
                                ? 'bg-rose-50/35 hover:bg-rose-50/60'
                                : cell.isWeekend
                                ? 'bg-slate-50/50 hover:bg-slate-100/60'
                                : 'bg-white hover:bg-slate-50/80'
                            }`}
                          >
                            {/* Cell Header: Day Number + Counts + Add Button */}
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1 min-w-0">
                                <span
                                  className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1 rounded-md text-xs font-bold tabular-nums ${
                                    cell.isToday
                                      ? 'bg-blue-700 text-white'
                                      : !cell.isCurrentMonth
                                      ? 'text-slate-400'
                                      : cell.dayOfWeek === 0 || isHoliday
                                      ? 'text-rose-700'
                                      : 'text-slate-800'
                                  }`}
                                >
                                  {cell.dayNumber}
                                </span>
                                {cell.isToday && (
                                  <span className="text-[10px] font-bold text-blue-700 whitespace-nowrap">
                                    วันนี้
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {cell.countsByStatus.total > 0 && (
                                  <span className="text-[10px] font-bold tabular-nums text-slate-700 whitespace-nowrap">
                                    {cell.countsByStatus.incomplete > 0 && (
                                      <span className="text-amber-700">⏳{cell.countsByStatus.incomplete}</span>
                                    )}
                                    {cell.countsByStatus.incomplete > 0 && cell.countsByStatus.completed > 0 && (
                                      <span className="text-slate-400 mx-0.5">·</span>
                                    )}
                                    {cell.countsByStatus.completed > 0 && (
                                      <span className="text-emerald-700">✓{cell.countsByStatus.completed}</span>
                                    )}
                                  </span>
                                )}

                                {canEdit && onAddNewCaseForDate && cell.isCurrentMonth && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddNewCaseForDate(cell.date);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded bg-white border border-slate-300 text-slate-600 hover:text-blue-700 hover:border-blue-400 transition cursor-pointer"
                                    title={`เพิ่มสำนวน/วันนัดในวันที่ ${formatThaiDate(cell.date)}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Duty Roster / Holiday Linkage */}
                            {isHoliday ? (
                              <div className="text-[10px] font-medium text-rose-700 truncate mb-1" title={cell.dutyRecord?.holidayName || 'วันหยุดราชการ'}>
                                หยุด: {cell.dutyRecord?.holidayName || 'วันหยุดราชการ'}
                              </div>
                            ) : dutyOfficers.length > 0 ? (
                              <div
                                className="text-[10px] text-slate-500 truncate mb-1 flex items-center gap-1"
                                title={`เวรชี้ประจำวัน: ${dutyOfficers.map((o) => o.name).join(', ')}`}
                              >
                                <UserCheck className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                <span className="truncate">
                                  เวร: {shortenProsecutorName(dutyOfficers[0].name)}
                                </span>
                              </div>
                            ) : null}

                            {/* Appointment Entries in Day Cell */}
                            <div className="space-y-1">
                              {visibleAppts.map((a) => {
                                const catStyle = getCalendarCategoryDisplay(a.category, a.appointmentTypeName);
                                return (
                                  <button
                                    key={a.uniqueKey}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectDay(cell.date, true);
                                    }}
                                    title={`${a.categoryLabel} | คดีดำ ${a.blackCaseNo} | อัยการ: ${a.prosecutorName} | จำเลย: ${a.defendant} | สถานะ: ${a.isCompleted ? 'เสร็จสิ้นแล้ว' : 'ยังไม่เสร็จสิ้น'}`}
                                    className={`w-full text-left px-1.5 py-1 rounded border text-[11px] leading-tight transition cursor-pointer ${
                                      a.isCompleted
                                        ? 'bg-emerald-50/90 hover:bg-emerald-100 border-emerald-300 text-emerald-950'
                                        : `${catStyle.chipBg} ${catStyle.chipBorder} ${catStyle.chipText}`
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-bold truncate">
                                        {catStyle.icon} {a.blackCaseNo}
                                      </span>
                                      <span className="shrink-0 text-[10px] font-bold">
                                        {a.isCompleted ? (
                                          <span className="text-emerald-700">✓</span>
                                        ) : (
                                          <span className="text-amber-700">⏳</span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-1 text-[10px] opacity-85 truncate mt-0.5">
                                      <span className="truncate">{catStyle.shortLabel}</span>
                                      <span className="truncate font-medium shrink-0">
                                        {shortenProsecutorName(a.prosecutorName)}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}

                              {hiddenCount > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectDay(cell.date, true);
                                  }}
                                  className="w-full text-center py-0.5 text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition cursor-pointer"
                                >
                                  + อีก {hiddenCount} นัด (ดูทั้งหมด)
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Calendar List (for < md screens) */}
            <div className="md:hidden divide-y divide-slate-200">
              {calendarCells
                .filter((c) => c.isCurrentMonth && (c.appointments.length > 0 || c.isToday || c.dutyRecord?.isHoliday))
                .map((cell) => {
                  const isSelected = cell.date === selectedDate;
                  return (
                    <div
                      key={cell.date}
                      onClick={() => handleSelectDay(cell.date, true)}
                      className={`p-3 space-y-2 cursor-pointer ${
                        isSelected ? 'bg-blue-50/70' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 tabular-nums">
                            {formatThaiDate(cell.date)}
                          </span>
                          <span className="text-xs text-slate-500">
                            (วัน{WEEKDAY_HEADERS[cell.dayOfWeek]?.label})
                          </span>
                          {cell.isToday && (
                            <span className="text-[11px] font-bold text-blue-700">วันนี้</span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-700 tabular-nums">
                          {cell.appointments.length} นัด
                        </span>
                      </div>

                      {cell.appointments.map((a) => {
                        const catStyle = getCalendarCategoryDisplay(a.category, a.appointmentTypeName);
                        return (
                          <div
                            key={a.uniqueKey}
                            className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                              a.isCompleted
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                : `${catStyle.chipBg} ${catStyle.chipBorder} ${catStyle.chipText}`
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-bold truncate">
                                {catStyle.icon} {a.categoryLabel} · {a.blackCaseNo}
                              </div>
                              <div className="text-[11px] opacity-80 truncate">
                                อัยการ: {a.prosecutorName} · จำเลย: {a.defendant}
                              </div>
                            </div>
                            <span className="text-xs font-bold shrink-0">
                              {a.isCompleted ? '✓ เสร็จสิ้น' : '⏳ คุมอยู่'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* SELECTED DAY INSPECTOR PANEL (รายละเอียดนัดประจำวัน & ปุ่มจัดการฐานข้อมูล) */}
          <div
            ref={dayInspectorRef}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="px-4 py-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold font-['Prompt']">
                    รายการนัดประจำวันที่ {formatThaiDate(selectedCell.date, { short: false })}
                  </h3>
                  {selectedCell.isToday && (
                    <span className="text-xs font-bold text-amber-300">· วันนี้</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                  <span>
                    รวม <strong className="text-white tabular-nums">{selectedCell.appointments.length}</strong> นัด
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300 tabular-nums">
                    ยังไม่เสร็จสิ้น {selectedCell.countsByStatus.incomplete}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-300 tabular-nums">
                    เสร็จสิ้นแล้ว {selectedCell.countsByStatus.completed}
                  </span>
                  {selectedCell.dutyRecord && !selectedCell.dutyRecord.isHoliday && selectedCell.dutyRecord.officers.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-sky-300">
                        อัยการเวรชี้: {selectedCell.dutyRecord.officers.map((o) => o.name).join(', ')}
                      </span>
                    </>
                  )}
                  {selectedCell.dutyRecord?.isHoliday && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-rose-300 font-semibold">
                        วันหยุด: {selectedCell.dutyRecord.holidayName || 'วันหยุดราชการ'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canEdit && onAddNewCaseForDate && (
                  <button
                    type="button"
                    onClick={() => onAddNewCaseForDate(selectedCell.date)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มสำนวน/นัดวันนี้</span>
                  </button>
                )}
              </div>
            </div>

            {selectedCell.appointments.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  ไม่มีนัดศาลที่ตรงกับตัวกรองในวันที่ {formatThaiDate(selectedCell.date)}
                </p>
                <p className="text-xs text-slate-500">
                  คลิกที่วันอื่นในตารางปฏิทินด้านบน หรือเลือก &ldquo;อัยการทุกท่าน&rdquo; / &ldquo;นัดทั้งหมด&rdquo; เพื่อดูรายการนัดอื่นๆ ในเดือนนี้
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {selectedCell.appointments.map((a) => {
                  const catStyle = getCalendarCategoryDisplay(a.category, a.appointmentTypeName);
                  return (
                    <div
                      key={a.uniqueKey}
                      className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition ${
                        a.isCompleted ? 'bg-emerald-50/25 hover:bg-emerald-50/45' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        {/* Line 1: Category + Status + Metadata */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`px-2.5 py-0.5 rounded-md border font-bold inline-flex items-center gap-1 ${catStyle.badgeClass}`}
                          >
                            <span>{catStyle.icon}</span>
                            <span>{a.categoryLabel}</span>
                          </span>

                          {a.isCompleted ? (
                            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>
                                กดเสร็จสิ้นแล้ว
                                {a.completedDate ? ` (${formatThaiDate(a.completedDate, { short: true })})` : ''}
                              </span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-bold inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>ยังไม่กดเสร็จสิ้น</span>
                            </span>
                          )}

                          {a.isSubmittedToDuty && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-300 font-semibold inline-flex items-center gap-1">
                              <Send className="w-3 h-3 text-blue-700" />
                              <span>
                                เสนอเวรชี้แล้ว
                                {a.submittedToDutyOfficer ? `: ${a.submittedToDutyOfficer}` : ''}
                              </span>
                            </span>
                          )}

                          {a.isSubsequent && (
                            <span className="text-[11px] text-slate-600 font-medium">
                              · นัดลำดับที่ {a.orderIndex}
                            </span>
                          )}
                        </div>

                        {/* Line 2: Case Identity & Parties */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
                          <span className="text-sm font-bold text-slate-950 font-['Prompt'] tabular-nums">
                            คดีดำ {a.blackCaseNo}
                          </span>
                          {a.redCaseNo && a.redCaseNo !== '-' && (
                            <span className="font-bold text-rose-700 tabular-nums">
                              คดีแดง {a.redCaseNo}
                            </span>
                          )}
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span>
                            <strong className="text-slate-900">จำเลย:</strong> {a.defendant}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-slate-500">{a.court}</span>
                        </div>

                        {/* Line 3: Prosecutor Link, Time, Courtroom & Notes */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 font-semibold text-blue-900">
                            <Users className="w-3.5 h-3.5 text-blue-600" />
                            <span>อัยการเจ้าของสำนวน: {a.prosecutorName}</span>
                          </span>
                          {selectedProsecutorFilter !== a.prosecutorName && (
                            <button
                              type="button"
                              onClick={() => onSelectProsecutor(a.prosecutorName)}
                              className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer inline-flex items-center gap-0.5"
                            >
                              <Filter className="w-3 h-3" />
                              <span>ดูเฉพาะท่านนี้</span>
                            </button>
                          )}
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="tabular-nums">เวลา {a.appointmentTime || '09:00 น.'}</span>
                          {a.courtRoom && (
                            <>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                <span>{a.courtRoom}</span>
                              </span>
                            </>
                          )}
                        </div>
                        {a.notes && (
                          <div className="mt-2">
                            <CaseNoteHighlight notes={a.notes} compact />
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {canEdit && onOpenAppointmentModal && (
                          <button
                            type="button"
                            onClick={() => onOpenAppointmentModal(a.caseItem)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span>จัดการวันนัด</span>
                          </button>
                        )}

                        {onOpenSubmitToDuty && (
                          <button
                            type="button"
                            onClick={() => onOpenSubmitToDuty(a.caseItem)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                              a.isSubmittedToDuty
                                ? 'bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-300'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                            }`}
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{a.isSubmittedToDuty ? '✓ เสนอเวรชี้' : 'เสนอเวรชี้'}</span>
                          </button>
                        )}

                        {!a.isCompleted && canComplete && onMarkComplete && (
                          <button
                            type="button"
                            onClick={() => onMarkComplete(a.caseItem)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>กดเสร็จสิ้น</span>
                          </button>
                        )}

                        {onSelectCase && (
                          <button
                            type="button"
                            onClick={() => onSelectCase(a.caseItem)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>เปิดดูสำนวน</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
