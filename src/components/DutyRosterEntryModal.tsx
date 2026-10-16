import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  UserCheck,
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  Copy,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Users,
  ChevronDown,
  Building2,
  Clock,
  RotateCcw
} from 'lucide-react';
import { MonthlyDutyRoster, DailyDutyRecord, DutyOfficerEntry, AppealCase } from '../types/appeal';

interface DutyRosterEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (roster: MonthlyDutyRoster) => void;
  existingRosters: MonthlyDutyRoster[];
  existingCases?: AppealCase[];
  initialRosterId?: string;
  showToast: (msg: string) => void;
}

const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const THAI_DAY_NAMES = [
  'วันอาทิตย์',
  'วันจันทร์',
  'วันอังคาร',
  'วันพุธ',
  'วันพฤหัสบดี',
  'วันศุกร์',
  'วันเสาร์',
];

// Typical Thai official public holidays helper (month is 1-12)
function getKnownThaiHoliday(month: number, day: number): string | null {
  if (month === 1 && day === 1) return 'วันขึ้นปีใหม่';
  if (month === 4 && day === 6) return 'วันจักรี';
  if (month === 4 && (day >= 13 && day <= 15)) return 'วันสงกรานต์';
  if (month === 5 && day === 1) return 'วันแรงงานแห่งชาติ';
  if (month === 5 && day === 4) return 'วันฉัตรมงคล';
  if (month === 6 && day === 3) return 'วันเฉลิมพระชนมพรรษา สมเด็จพระราชินี';
  if (month === 7 && day === 28) return 'วันเฉลิมพระชนมพรรษา ร.10';
  if (month === 8 && day === 12) return 'วันแม่แห่งชาติ';
  if (month === 10 && day === 13) return 'วันนวมินทรมหาราช';
  if (month === 10 && day === 23) return 'วันปิยมหาราช';
  if (month === 12 && day === 5) return 'วันพ่อแห่งชาติ (วันชาติ)';
  if (month === 12 && day === 10) return 'วันรัฐธรรมนูญ';
  if (month === 12 && day === 31) return 'วันสิ้นปี';
  return null;
}

export const DutyRosterEntryModal: React.FC<DutyRosterEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingRosters,
  existingCases = [],
  initialRosterId,
  showToast,
}) => {
  // Current date
  const now = new Date();
  const currentYearCE = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Month & Year state (CE year)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYearBE, setSelectedYearBE] = useState<number>(currentYearCE + 543);
  const [rosterTitle, setRosterTitle] = useState<string>('');
  const [generalNotes, setGeneralNotes] = useState<string>('');

  // Days in roster
  const [duties, setDuties] = useState<DailyDutyRecord[]>([]);

  // Filter or quick view
  const [dayFilter, setDayFilter] = useState<'all' | 'workdays' | 'holidays'>('all');

  // Quick text batch paste modal/drawer
  const [showBatchPaste, setShowBatchPaste] = useState(false);
  const [batchText, setBatchText] = useState('');

  // Active focused input for quick chip insertion
  const [lastFocusedOfficer, setLastFocusedOfficer] = useState<{
    dutyIndex: number;
    officerIndex: number;
  } | null>(null);

  // Extract unique known prosecutor names from existing cases & rosters for fast autocomplete/chips
  const knownProsecutors = useMemo(() => {
    const names = new Set<string>();
    existingCases.forEach((c) => {
      if (c.responsiblePerson && c.responsiblePerson.trim()) names.add(c.responsiblePerson.trim());
      if (c.prosecutorName && c.prosecutorName.trim()) names.add(c.prosecutorName.trim());
    });
    existingRosters.forEach((r) => {
      r.duties.forEach((d) => {
        d.officers.forEach((o) => {
          if (o.name && o.name.trim()) names.add(o.name.trim());
        });
      });
    });
    return Array.from(names).filter((n) => n.length > 2);
  }, [existingCases, existingRosters]);

  // Generate days of month helper
  const generateMonthDays = (
    yearBE: number,
    month: number,
    weekdaysOnly: boolean = true,
    existingDutiesMap?: Map<string, DailyDutyRecord>
  ) => {
    const yearCE = yearBE - 543;
    const daysInMonth = new Date(yearCE, month, 0).getDate();
    const newDuties: DailyDutyRecord[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(yearCE, month - 1, day);
      const dayOfWeekNum = dateObj.getDay(); // 0 is Sunday, 6 is Saturday
      const isWeekend = dayOfWeekNum === 0 || dayOfWeekNum === 6;

      if (weekdaysOnly && isWeekend) {
        continue;
      }

      const dateStr = `${yearCE}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeekThai = THAI_DAY_NAMES[dayOfWeekNum];
      const holidayName = getKnownThaiHoliday(month, day);
      const isHoliday = !!holidayName || isWeekend;

      // If exists previously, keep existing data
      if (existingDutiesMap && existingDutiesMap.has(dateStr)) {
        newDuties.push(existingDutiesMap.get(dateStr)!);
      } else {
        newDuties.push({
          id: `duty_${dateStr}_${Date.now()}_${day}`,
          date: dateStr,
          dayOfWeek: dayOfWeekThai,
          isHoliday: isHoliday,
          holidayName: holidayName || (isWeekend ? 'วันหยุดสุดสัปดาห์' : undefined),
          dutyType: isHoliday ? 'วันหยุดราชการ' : 'เวรชี้สองฝ่าย',
          officers: isHoliday
            ? []
            : [
                {
                  name: '',
                  role: 'อัยการเวรชี้ 1',
                  courtRoom: '',
                  session: 'ตลอดวัน',
                },
                {
                  name: '',
                  role: 'อัยการเวรชี้ 2',
                  courtRoom: '',
                  session: 'ตลอดวัน',
                },
              ],
          notes: '',
        });
      }
    }

    return newDuties;
  };

  // Initialize or load roster when modal opens or selection changes
  useEffect(() => {
    if (!isOpen) return;

    // Check if initialRosterId provided
    if (initialRosterId) {
      const matched = existingRosters.find((r) => r.id === initialRosterId);
      if (matched) {
        const [yStr, mStr] = matched.monthYear.split('-');
        const yCE = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        setSelectedMonth(m);
        setSelectedYearBE(yCE + 543);
        setRosterTitle(matched.title || `ตารางเวรชี้คดีและเวรศาล ประจำเดือน${matched.monthNameThai}`);
        setGeneralNotes(matched.notes || '');
        setDuties(matched.duties);
        return;
      }
    }

    // Default to selectedMonth & selectedYearBE
    const yearCE = selectedYearBE - 543;
    const monthYearStr = `${yearCE}-${String(selectedMonth).padStart(2, '0')}`;
    const matched = existingRosters.find((r) => r.monthYear === monthYearStr);

    if (matched) {
      setRosterTitle(matched.title);
      setGeneralNotes(matched.notes || '');
      setDuties(matched.duties);
    } else {
      const monthThai = THAI_MONTH_NAMES[selectedMonth - 1];
      setRosterTitle(`ตารางเวรชี้คดีและเวรศาล ประจำเดือน${monthThai} ${selectedYearBE}`);
      setGeneralNotes('');
      setDuties(generateMonthDays(selectedYearBE, selectedMonth, true));
    }
  }, [isOpen, initialRosterId]);

  // When user changes month or year dropdown
  const handleMonthYearChange = (newMonth: number, newYearBE: number) => {
    setSelectedMonth(newMonth);
    setSelectedYearBE(newYearBE);

    const yearCE = newYearBE - 543;
    const monthYearStr = `${yearCE}-${String(newMonth).padStart(2, '0')}`;
    const matched = existingRosters.find((r) => r.monthYear === monthYearStr);

    if (matched) {
      setRosterTitle(matched.title);
      setGeneralNotes(matched.notes || '');
      setDuties(matched.duties);
      showToast(`โหลดข้อมูลตารางเวรชี้เดิมของเดือน ${matched.monthNameThai} เรียบร้อย`);
    } else {
      const monthThai = THAI_MONTH_NAMES[newMonth - 1];
      setRosterTitle(`ตารางเวรชี้คดีและเวรศาล ประจำเดือน${monthThai} ${newYearBE}`);
      setGeneralNotes('');
      setDuties(generateMonthDays(newYearBE, newMonth, true));
    }
  };

  if (!isOpen) return null;

  // Re-generate days
  const handleRegenerate = (weekdaysOnly: boolean) => {
    const existingMap = new Map<string, DailyDutyRecord>();
    duties.forEach((d) => existingMap.set(d.date, d));
    const generated = generateMonthDays(selectedYearBE, selectedMonth, weekdaysOnly, existingMap);
    setDuties(generated);
    showToast(
      weekdaysOnly
        ? 'สร้างรายการเฉพาะวันทำการ (จันทร์ - ศุกร์) เรียบร้อย'
        : 'สร้างรายการทุกวัน (รวมเสาร์ - อาทิตย์) เรียบร้อย'
    );
  };

  // Add individual custom date
  const handleAddCustomDate = () => {
    const yearCE = selectedYearBE - 543;
    const defaultDate = `${yearCE}-${String(selectedMonth).padStart(2, '0')}-01`;
    const newRecord: DailyDutyRecord = {
      id: `duty_custom_${Date.now()}`,
      date: defaultDate,
      dayOfWeek: 'วันทำการ',
      isHoliday: false,
      dutyType: 'เวรชี้สองฝ่าย',
      officers: [
        { name: '', role: 'อัยการเวรชี้ 1', courtRoom: '', session: 'ตลอดวัน' },
        { name: '', role: 'อัยการเวรชี้ 2', courtRoom: '', session: 'ตลอดวัน' },
      ],
      notes: '',
    };
    setDuties([...duties, newRecord]);
  };

  // Update specific duty
  const updateDuty = (index: number, updated: Partial<DailyDutyRecord>) => {
    setDuties((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updated };
      return next;
    });
  };

  // Update officer inside a duty
  const updateOfficer = (
    dutyIndex: number,
    officerIndex: number,
    updated: Partial<DutyOfficerEntry>
  ) => {
    setDuties((prev) => {
      const next = [...prev];
      const duty = next[dutyIndex];
      const nextOfficers = [...duty.officers];
      nextOfficers[officerIndex] = { ...nextOfficers[officerIndex], ...updated };
      next[dutyIndex] = { ...duty, officers: nextOfficers };
      return next;
    });
  };

  // Add officer to a duty
  const addOfficerToDuty = (dutyIndex: number) => {
    setDuties((prev) => {
      const next = [...prev];
      const duty = next[dutyIndex];
      const count = duty.officers.length + 1;
      const defaultRole = count <= 2 ? `อัยการเวรชี้ ${count}` : 'ผู้ช่วยเวรชี้';
      next[dutyIndex] = {
        ...duty,
        officers: [
          ...duty.officers,
          { name: '', role: defaultRole, courtRoom: '', session: 'ตลอดวัน' },
        ],
      };
      return next;
    });
  };

  // Remove officer from a duty
  const removeOfficerFromDuty = (dutyIndex: number, officerIndex: number) => {
    setDuties((prev) => {
      const next = [...prev];
      const duty = next[dutyIndex];
      next[dutyIndex] = {
        ...duty,
        officers: duty.officers.filter((_, idx) => idx !== officerIndex),
      };
      return next;
    });
  };

  // Delete a whole day
  const deleteDay = (dutyIndex: number) => {
    setDuties((prev) => prev.filter((_, idx) => idx !== dutyIndex));
  };

  // Quick fill prosecutor name from chip to active focused officer
  const handleInsertProsecutorName = (name: string) => {
    if (lastFocusedOfficer) {
      updateOfficer(lastFocusedOfficer.dutyIndex, lastFocusedOfficer.officerIndex, { name });
      showToast(`กรอกชื่อ "${name}" เรียบร้อยแล้ว`);
    } else {
      // Find first empty officer in duties
      for (let dIdx = 0; dIdx < duties.length; dIdx++) {
        const duty = duties[dIdx];
        if (duty.isHoliday) continue;
        for (let oIdx = 0; oIdx < duty.officers.length; oIdx++) {
          if (!duty.officers[oIdx].name.trim()) {
            updateOfficer(dIdx, oIdx, { name });
            showToast(`กรอกชื่อ "${name}" ในวันที่ ${duty.date}`);
            return;
          }
        }
      }
      showToast(`คลิกที่ช่องชื่ออัยการของวันที่ต้องการก่อน แล้วกดชื่อชิป "${name}" ได้เลยครับ`);
    }
  };

  // Quick text parser for batch import
  const handleParseBatchText = () => {
    if (!batchText.trim()) return;

    const lines = batchText.split('\n').map((l) => l.trim()).filter(Boolean);
    let updatedCount = 0;
    const yearCE = selectedYearBE - 543;
    const updatedDuties = [...duties];

    lines.forEach((line) => {
      // Supports formats:
      // "1: สมชาย, วิชัย"
      // "01/10: สมชาย"
      // "2026-10-01: สมชาย"
      const parts = line.split(/[:=|\t]/);
      if (parts.length >= 2) {
        const datePart = parts[0].trim();
        const namesPart = parts.slice(1).join(':').trim();

        let dayNumber: number | null = null;
        if (/^\d{1,2}$/.test(datePart)) {
          dayNumber = parseInt(datePart, 10);
        } else if (datePart.includes('/')) {
          const sub = datePart.split('/');
          dayNumber = parseInt(sub[0], 10);
        } else if (datePart.includes('-')) {
          const sub = datePart.split('-');
          dayNumber = parseInt(sub[sub.length - 1], 10);
        }

        if (dayNumber !== null) {
          const targetDateStr = `${yearCE}-${String(selectedMonth).padStart(2, '0')}-${String(
            dayNumber
          ).padStart(2, '0')}`;
          const targetIdx = updatedDuties.findIndex((d) => d.date === targetDateStr);

          const rawNames = namesPart
            .split(/[,;&/]/)
            .map((n) => n.trim())
            .filter(Boolean);

          if (rawNames.length > 0) {
            const officersList: DutyOfficerEntry[] = rawNames.map((n, idx) => ({
              name: n,
              role: idx === 0 ? 'อัยการเวรชี้ 1' : idx === 1 ? 'อัยการเวรชี้ 2' : 'ผู้ช่วยเวรชี้',
              courtRoom: '',
              session: 'ตลอดวัน',
            }));

            if (targetIdx !== -1) {
              updatedDuties[targetIdx] = {
                ...updatedDuties[targetIdx],
                isHoliday: false,
                officers: officersList,
              };
              updatedCount++;
            } else {
              const dateObj = new Date(yearCE, selectedMonth - 1, dayNumber);
              const dayThai = THAI_DAY_NAMES[dateObj.getDay()] || 'วันทำการ';
              updatedDuties.push({
                id: `duty_${targetDateStr}_${Date.now()}`,
                date: targetDateStr,
                dayOfWeek: dayThai,
                isHoliday: false,
                dutyType: 'เวรชี้สองฝ่าย',
                officers: officersList,
              });
              updatedCount++;
            }
          }
        }
      }
    });

    // Sort by date
    updatedDuties.sort((a, b) => a.date.localeCompare(b.date));
    setDuties(updatedDuties);
    setShowBatchPaste(false);
    setBatchText('');
    showToast(`แปลงข้อความและกรอกชื่อลงในตารางเวรชี้แล้ว ${updatedCount} วัน`);
  };

  // Submit & Save
  const handleSaveRoster = (e: React.FormEvent) => {
    e.preventDefault();

    if (duties.length === 0) {
      showToast('กรุณาสร้างหรือเพิ่มวันในตารางเวรชี้อย่างน้อย 1 วัน');
      return;
    }

    const yearCE = selectedYearBE - 543;
    const monthYear = `${yearCE}-${String(selectedMonth).padStart(2, '0')}`;
    const monthNameThai = `${THAI_MONTH_NAMES[selectedMonth - 1]} ${selectedYearBE}`;

    const newRoster: MonthlyDutyRoster = {
      id: `roster_${yearCE}_${String(selectedMonth).padStart(2, '0')}`,
      monthYear,
      monthNameThai,
      title: rosterTitle.trim() || `ตารางเวรชี้คดีและเวรศาล ประจำเดือน${monthNameThai}`,
      uploadedFileName: undefined,
      uploadedAt: new Date().toISOString(),
      totalDays: duties.length,
      duties: duties,
      notes: generalNotes.trim() || undefined,
    };

    onSuccess(newRoster);
    onClose();
  };

  // Filtered duties
  const visibleDuties = useMemo(() => {
    if (dayFilter === 'workdays') return duties.filter((d) => !d.isHoliday);
    if (dayFilter === 'holidays') return duties.filter((d) => d.isHoliday);
    return duties;
  }, [duties, dayFilter]);

  // Total officers entered count
  const totalOfficersEntered = useMemo(() => {
    return duties.reduce(
      (sum, d) => sum + d.officers.filter((o) => o.name && o.name.trim()).length,
      0
    );
  }, [duties]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <UserCheck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-['Prompt'] text-white">
                  พิมพ์กรอกตารางเวรชี้ประจำเดือน
                </h3>
                <span className="bg-amber-400 text-slate-950 font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                  ระบบกรอกฟอร์มโดยตรง
                </span>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                พิมพ์กรอกข้อมูลรอบเดือนและรายชื่อพนักงานอัยการเวรชี้แต่ละวันได้อย่างสะดวก รวดเร็ว โดยไม่ต้องใช้ไฟล์ PDF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-slate-800">
          {/* Top Controls: Month, Year, and Title */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Select Month */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  รอบเดือน:
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) =>
                    handleMonthYearChange(parseInt(e.target.value, 10), selectedYearBE)
                  }
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer shadow-xs"
                >
                  {THAI_MONTH_NAMES.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name} (เดือน {idx + 1})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Year BE */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ปี พ.ศ.:
                </label>
                <select
                  value={selectedYearBE}
                  onChange={(e) =>
                    handleMonthYearChange(selectedMonth, parseInt(e.target.value, 10))
                  }
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer shadow-xs"
                >
                  {[2567, 2568, 2569, 2570, 2571, 2572].map((y) => (
                    <option key={y} value={y}>
                      พ.ศ. {y} ({y - 543})
                    </option>
                  ))}
                </select>
              </div>

              {/* Summary badge */}
              <div className="flex flex-col justify-end">
                <div className="bg-amber-100/80 border border-amber-300/80 rounded-xl px-3 py-2 text-xs flex items-center justify-between text-amber-950 font-medium">
                  <span>สถานะตาราง:</span>
                  <span className="font-bold">
                    {duties.length} วัน • {totalOfficersEntered} เวรชี้
                  </span>
                </div>
              </div>
            </div>

            {/* Roster Title */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                หัวข้อตารางเวรชี้:
              </label>
              <input
                type="text"
                value={rosterTitle}
                onChange={(e) => setRosterTitle(e.target.value)}
                placeholder="เช่น ตารางเวรชี้คดีและเวรศาล ประจำเดือนตุลาคม 2569"
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Quick Prosecutor Suggestions Chips */}
          {knownProsecutors.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200/90 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-900">
                <span className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>รายชื่ออัยการในระบบ (คลิกที่ช่องชื่อในตารางด้านล่าง แล้วกดชื่อด้านล่างเพื่อเติมทันที):</span>
                </span>
                <span className="text-[11px] text-amber-700 font-medium">
                  {knownProsecutors.length} ท่าน
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                {knownProsecutors.map((pName, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertProsecutorName(pName)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-500 hover:text-white border border-amber-300 rounded-lg text-xs font-medium text-slate-700 transition shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3 h-3 opacity-60" />
                    <span>{pName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Batch Tools & Generation Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">เครื่องมือสร้างวัน:</span>
              <button
                type="button"
                onClick={() => handleRegenerate(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                title="สร้างเฉพาะวันจันทร์ - ศุกร์"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>วันทำการ (จันทร์ - ศุกร์)</span>
              </button>

              <button
                type="button"
                onClick={() => handleRegenerate(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                title="สร้างทุกวันในเดือนรวมวันหยุด"
              >
                <span>ทุกวัน (รวมเสาร์-อาทิตย์)</span>
              </button>

              <button
                type="button"
                onClick={handleAddCustomDate}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>+ เพิ่มวันกำหนดเอง</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBatchPaste(!showBatchPaste)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                <span>{showBatchPaste ? 'ซ่อนการวางข้อความเร็ว' : 'วางข้อความพิมพ์เร็ว (Batch Text)'}</span>
              </button>

              {/* Day Filter */}
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setDayFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    dayFilter === 'all'
                      ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งหมด ({duties.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDayFilter('workdays')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    dayFilter === 'workdays'
                      ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  วันทำการ ({duties.filter((d) => !d.isHoliday).length})
                </button>
                <button
                  type="button"
                  onClick={() => setDayFilter('holidays')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    dayFilter === 'holidays'
                      ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  วันหยุด ({duties.filter((d) => d.isHoliday).length})
                </button>
              </div>
            </div>
          </div>

          {/* Quick Batch Text Drawer */}
          {showBatchPaste && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-700 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold font-['Prompt'] text-amber-300">
                    นำเข้าตารางเวรชี้แบบพิมพ์เร็ว (Quick Batch Paste):
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchPaste(false)}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  ✕
                </button>
              </div>
              <p className="text-[11px] text-slate-300">
                วางข้อความรายวัน เช่น วันที่: รายชื่ออัยการ 1, รายชื่ออัยการ 2 (เช่น{' '}
                <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">
                  1: นายสมชาย นิติการ, นายวิชัย ยุติธรรม
                </code>{' '}
                หรือ{' '}
                <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">
                  02/10: นายชูศักดิ์ เกียรติไพบูลย์
                </code>
                )
              </p>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                rows={4}
                placeholder="1: นายสมชาย นิติการ, นายวิชัย ยุติธรรม&#10;2: นายชูศักดิ์ เกียรติไพบูลย์, นางสาวกัลยา ศรีสุข&#10;5: นายวรวิทย์ มุ่งเจริญ"
                className="w-full text-xs font-mono p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBatchText('')}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  ล้างข้อความ
                </button>
                <button
                  type="button"
                  onClick={handleParseBatchText}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>แปลงข้อความลงในตาราง</span>
                </button>
              </div>
            </div>
          )}

          {/* Days Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-36">วันที่ & วันในสัปดาห์</th>
                    <th className="py-2.5 px-3 w-32">ประเภทเวร / วันหยุด</th>
                    <th className="py-2.5 px-3">รายชื่ออัยการเวรชี้ & ห้องพิจารณา</th>
                    <th className="py-2.5 px-3 w-40">หมายเหตุประจำวัน</th>
                    <th className="py-2.5 px-2 text-center w-12">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {visibleDuties.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        ไม่มีข้อมูลวันในมุมมองนี้ กรุณากด &quot;สร้างวันทำการอัตโนมัติ&quot; หรือ &quot;+ เพิ่มวันกำหนดเอง&quot;
                      </td>
                    </tr>
                  ) : (
                    visibleDuties.map((duty, realIdx) => {
                      const actualIdx = duties.findIndex((d) => d.id === duty.id);

                      return (
                        <tr
                          key={duty.id}
                          className={`hover:bg-slate-50/80 transition ${
                            duty.isHoliday ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          {/* Date and Day */}
                          <td className="py-2.5 px-3 align-top whitespace-nowrap">
                            <input
                              type="date"
                              value={duty.date}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                if (!newDate) return;
                                const [y, m, d] = newDate.split('-').map(Number);
                                const dayThai =
                                  THAI_DAY_NAMES[new Date(y, m - 1, d).getDay()] || 'วันทำการ';
                                updateDuty(actualIdx, { date: newDate, dayOfWeek: dayThai });
                              }}
                              className="text-xs font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-amber-500 focus:outline-hidden pb-0.5 cursor-pointer block"
                            />
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-slate-500 font-medium">
                                {duty.dayOfWeek}
                              </span>
                              {duty.date.split('-')[2] && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded">
                                  วันที่ {parseInt(duty.date.split('-')[2], 10)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Holiday / Duty Type */}
                          <td className="py-2.5 px-3 align-top">
                            <label className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!duty.isHoliday}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  updateDuty(actualIdx, {
                                    isHoliday: checked,
                                    dutyType: checked ? 'วันหยุดราชการ' : 'เวรชี้สองฝ่าย',
                                    holidayName: checked ? duty.holidayName || 'วันหยุด' : undefined,
                                  });
                                }}
                                className="rounded text-amber-600 focus:ring-amber-500"
                              />
                              <span>วันหยุดราชการ/ศาลปิด</span>
                            </label>

                            {duty.isHoliday ? (
                              <input
                                type="text"
                                value={duty.holidayName || ''}
                                onChange={(e) =>
                                  updateDuty(actualIdx, { holidayName: e.target.value })
                                }
                                placeholder="ชื่อวันหยุด เช่น วันปิยมหาราช"
                                className="w-full text-[11px] px-2 py-1 bg-rose-50/80 border border-rose-200 rounded text-rose-800 mt-1 focus:outline-hidden focus:border-rose-400"
                              />
                            ) : (
                              <input
                                type="text"
                                value={duty.dutyType || 'เวรชี้สองฝ่าย'}
                                onChange={(e) =>
                                  updateDuty(actualIdx, { dutyType: e.target.value })
                                }
                                placeholder="เช่น เวรชี้สองฝ่าย, เวรศาล"
                                className="w-full text-[11px] px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-700 mt-1 focus:outline-hidden focus:border-amber-500"
                              />
                            )}
                          </td>

                          {/* Officers List */}
                          <td className="py-2.5 px-3 align-top">
                            {duty.isHoliday ? (
                              <span className="text-xs text-rose-600 font-medium italic">
                                วันหยุด — ไม่มีเวรชี้
                              </span>
                            ) : (
                              <div className="space-y-2">
                                {duty.officers.map((officer, oIdx) => (
                                  <div
                                    key={oIdx}
                                    className="p-2 rounded-xl bg-slate-50/90 border border-slate-200/80 flex flex-wrap items-center gap-2"
                                  >
                                    {/* Officer Name */}
                                    <div className="flex-1 min-w-[160px]">
                                      <input
                                        type="text"
                                        value={officer.name}
                                        onFocus={() =>
                                          setLastFocusedOfficer({
                                            dutyIndex: actualIdx,
                                            officerIndex: oIdx,
                                          })
                                        }
                                        onChange={(e) =>
                                          updateOfficer(actualIdx, oIdx, { name: e.target.value })
                                        }
                                        placeholder={`พิมพ์ชื่ออัยการเวรชี้ ${oIdx + 1}`}
                                        className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                      />
                                    </div>

                                    {/* Role */}
                                    <div className="w-32">
                                      <input
                                        type="text"
                                        value={officer.role || ''}
                                        onChange={(e) =>
                                          updateOfficer(actualIdx, oIdx, { role: e.target.value })
                                        }
                                        placeholder="เช่น อัยการเวรชี้ 1"
                                        className="w-full text-[11px] px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-600 focus:outline-hidden"
                                      />
                                    </div>

                                    {/* Court Room */}
                                    <div className="w-28">
                                      <input
                                        type="text"
                                        value={officer.courtRoom || ''}
                                        onChange={(e) =>
                                          updateOfficer(actualIdx, oIdx, { courtRoom: e.target.value })
                                        }
                                        placeholder="ห้อง/บัลลังก์"
                                        className="w-full text-[11px] px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-600 focus:outline-hidden"
                                      />
                                    </div>

                                    {/* Session */}
                                    <div className="w-24">
                                      <select
                                        value={officer.session || 'ตลอดวัน'}
                                        onChange={(e) =>
                                          updateOfficer(actualIdx, oIdx, { session: e.target.value })
                                        }
                                        className="w-full text-[11px] px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-hidden cursor-pointer"
                                      >
                                        <option value="ตลอดวัน">ตลอดวัน</option>
                                        <option value="เช้า">เช้า</option>
                                        <option value="บ่าย">บ่าย</option>
                                      </select>
                                    </div>

                                    {/* Delete officer button */}
                                    {duty.officers.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeOfficerFromDuty(actualIdx, oIdx)}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                        title="ลบเวรชี้นี้"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {/* Add officer button */}
                                <button
                                  type="button"
                                  onClick={() => addOfficerToDuty(actualIdx)}
                                  className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900 font-semibold hover:underline cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>+ เพิ่มผู้ปฏิบัติหน้าที่ในวันนี้ (เช่น ผู้ช่วยเวรชี้/นิติกร)</span>
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Notes */}
                          <td className="py-2.5 px-3 align-top">
                            <input
                              type="text"
                              value={duty.notes || ''}
                              onChange={(e) => updateDuty(actualIdx, { notes: e.target.value })}
                              placeholder="เช่น สลับเวรกับ..."
                              className="w-full text-[11px] px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-600 focus:outline-hidden focus:border-amber-500"
                            />
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-2 align-top text-center">
                            <button
                              type="button"
                              onClick={() => deleteDay(actualIdx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="ลบวันนี้ออกจากตาราง"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Notes / Remarks */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              ข้อกำหนดทั่วไปหรือหมายเหตุประจำรอบเดือน (จะแสดงในส่วนหัวตาราง):
            </label>
            <textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              rows={2}
              placeholder="เช่น หากติดราชการหรือต้องการสลับเวรชี้ กรุณาแจ้งล่วงหน้าอย่างน้อย 1 วันทำการ..."
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            รวมทั้งหมด <strong className="text-slate-800">{duties.length} วัน</strong> (วันทำการ{' '}
            <strong className="text-amber-700">{duties.filter((d) => !d.isHoliday).length} วัน</strong>)
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleSaveRoster}
              className="px-6 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-md shadow-amber-600/20 flex items-center gap-2 transition cursor-pointer"
            >
              <Check className="w-4 h-4 text-amber-200" />
              <span>บันทึกตารางเวรชี้ประจำเดือน</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
