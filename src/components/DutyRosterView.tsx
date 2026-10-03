import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  UploadCloud,
  UserCheck,
  Search,
  Filter,
  FileText,
  Building2,
  Clock,
  Sparkles,
  Trash2,
  Edit3,
  CalendarCheck,
  LayoutGrid,
  List,
  AlertCircle,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { MonthlyDutyRoster, DailyDutyRecord, DutyOfficerEntry } from '../types/appeal';
import { DailyDutyInspector } from './DailyDutyInspector';
import { formatThaiDateLong } from '../services/dutyService';

interface DutyRosterViewProps {
  rosters: MonthlyDutyRoster[];
  activeRosterId?: string;
  onSelectRoster: (rosterId: string) => void;
  onOpenUploadModal: () => void;
  onDeleteRoster: (rosterId: string) => void;
  onUpdateDutyRecord: (rosterId: string, updatedRecord: DailyDutyRecord) => void;
  onUseOfficerForNewCase: (officerName: string, date: string) => void;
  onFilterCasesByOfficer: (officerName: string) => void;
  showToast: (msg: string) => void;
}

export const DutyRosterView: React.FC<DutyRosterViewProps> = ({
  rosters,
  activeRosterId,
  onSelectRoster,
  onOpenUploadModal,
  onDeleteRoster,
  onUpdateDutyRecord,
  onUseOfficerForNewCase,
  onFilterCasesByOfficer,
  showToast,
}) => {
  // Current active monthly roster
  const currentRoster = useMemo(() => {
    if (activeRosterId) {
      return rosters.find((r) => r.id === activeRosterId) || rosters[0] || null;
    }
    return rosters[0] || null;
  }, [rosters, activeRosterId]);

  // View mode: 'calendar' | 'table'
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selected date for inspector (default to today: YYYY-MM-DD)
  const today = new Date();
  const defaultToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const [inspectedDate, setInspectedDate] = useState<string>(defaultToday);

  // Edit duty modal state
  const [editingDuty, setEditingDuty] = useState<DailyDutyRecord | null>(null);

  // Filtered duties
  const filteredDuties = useMemo(() => {
    if (!currentRoster) return [];
    if (!searchQuery.trim()) return currentRoster.duties;

    const q = searchQuery.toLowerCase().trim();
    return currentRoster.duties.filter((d) => {
      const matchDate = d.date.includes(q) || (d.dayOfWeek && d.dayOfWeek.toLowerCase().includes(q));
      const matchHoliday = d.holidayName && d.holidayName.toLowerCase().includes(q);
      const matchNotes = d.notes && d.notes.toLowerCase().includes(q);
      const matchOfficer = d.officers.some(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.role && o.role.toLowerCase().includes(q)) ||
          (o.courtRoom && o.courtRoom.toLowerCase().includes(q))
      );
      return matchDate || matchHoliday || matchNotes || matchOfficer;
    });
  }, [currentRoster, searchQuery]);

  // Unique officers count in current month
  const uniqueOfficersCount = useMemo(() => {
    if (!currentRoster) return 0;
    const set = new Set<string>();
    currentRoster.duties.forEach((d) => {
      d.officers.forEach((o) => {
        if (o.name.trim()) set.add(o.name.trim());
      });
    });
    return set.size;
  }, [currentRoster]);

  // Working days count
  const workingDaysCount = useMemo(() => {
    if (!currentRoster) return 0;
    return currentRoster.duties.filter((d) => !d.isHoliday && d.officers.length > 0).length;
  }, [currentRoster]);

  // Save manual edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDuty || !currentRoster) return;
    onUpdateDutyRecord(currentRoster.id, editingDuty);
    setEditingDuty(null);
    showToast(`อัปเดตเวรชี้ประจำวันที่ ${editingDuty.date} สำเร็จ`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Roster Selection Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-['Prompt'] text-slate-800">
              ตารางเวรชี้ประจำเดือน (Duty Roster)
            </h2>
            <span className="bg-amber-100 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-medium border border-amber-200">
              ระบบวิเคราะห์ AI
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            อัปโหลดไฟล์ภาพหรือ PDF เพื่อวิเคราะห์ว่าใครเป็นเวรชี้ในแต่ละวัน พร้อมเช็คเวรชี้ประจำวันได้ทันที
          </p>
        </div>

        {/* Action Buttons & Month Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {rosters.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">รอบเดือน:</label>
              <select
                value={currentRoster?.id || ''}
                onChange={(e) => onSelectRoster(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
              >
                {rosters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.monthNameThai} ({r.duties.length} วัน)
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onOpenUploadModal}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition"
          >
            <UploadCloud className="w-4 h-4" />
            <span>อัพโหลดภาพ/PDF ตารางเวรใหม่</span>
          </button>

          {currentRoster && (
            <button
              onClick={() => onDeleteRoster(currentRoster.id)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition"
              title="ลบตารางเวรของรอบเดือนนี้"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Roster Overview Stats Cards */}
      {currentRoster && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium">รอบเดือนปัจจุบัน</span>
            <p className="text-base font-bold text-slate-800 mt-0.5">{currentRoster.monthNameThai}</p>
            <span className="text-[10px] text-slate-400 truncate block mt-0.5" title={currentRoster.uploadedFileName}>
              {currentRoster.uploadedFileName || 'ไฟล์ตารางเวร'}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium">วันทำการที่มีเวรชี้</span>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{workingDaysCount} วัน</p>
            <span className="text-[10px] text-emerald-600 font-medium">มีเวรชี้พร้อมปฏิบัติหน้าที่</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium">จำนวนเจ้าหน้าที่ในเวรชี้</span>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{uniqueOfficersCount} ท่าน</p>
            <span className="text-[10px] text-slate-500">ผลัดเปลี่ยนหมุนเวียน</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium">จำนวนวันทั้งหมดในตาราง</span>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{currentRoster.duties.length} วัน</p>
            <span className="text-[10px] text-slate-500">รวมวันหยุดราชการ</span>
          </div>
        </div>
      )}

      {/* Primary Feature: "ใครเป็นเวรชี้ในวันนั้น" - Daily Duty Inspector */}
      <DailyDutyInspector
        rosters={rosters}
        currentRoster={currentRoster}
        selectedDate={inspectedDate}
        onSelectDate={(d) => setInspectedDate(d)}
        onUseOfficerForNewCase={onUseOfficerForNewCase}
        onFilterCasesByOfficer={onFilterCasesByOfficer}
        showToast={showToast}
      />

      {/* View Switcher & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">มุมมองตารางเวรชี้:</span>
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                  viewMode === 'calendar'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>ปฏิทินรายเดือน</span>
              </button>

              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>ตารางรายชื่อแบบละเอียด</span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อเวรชี้, วันที่ หรือห้องพิจารณา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        </div>

        {/* Calendar View Mode */}
        {viewMode === 'calendar' && currentRoster && (
          <div className="mt-5 space-y-3">
            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>💡 คลิกที่ช่องวันใดก็ได้ เพื่อดูรายละเอียด "ใครเป็นเวรชี้ในวันนั้น"</span>
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md font-medium">
                {currentRoster.title}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredDuties.map((duty) => {
                const isSelected = duty.date === inspectedDate;
                const isCurrentDay = duty.date === defaultToday;

                return (
                  <div
                    key={duty.id}
                    onClick={() => setInspectedDate(duty.date)}
                    className={`rounded-xl border p-3 cursor-pointer transition flex flex-col justify-between min-h-[110px] ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-2 ring-amber-500/20'
                        : duty.isHoliday
                        ? 'border-rose-200/80 bg-rose-50/40 hover:bg-rose-50/70'
                        : 'border-slate-200/90 bg-white hover:border-amber-400 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Date Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 font-['Prompt']">
                          {duty.date.split('-')[2]} {currentRoster.monthNameThai.split(' ')[0]}
                        </span>
                        <span className="text-[11px] text-slate-500">{duty.dayOfWeek || ''}</span>
                      </div>

                      {/* Content: Holiday or Officers */}
                      {duty.isHoliday ? (
                        <div className="mt-2 text-rose-700 text-xs">
                          <span className="inline-block bg-rose-100 px-2 py-0.5 rounded text-[10px] font-medium border border-rose-200">
                            {duty.holidayName || 'วันหยุดทำการ'}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1.5">
                          {duty.officers.map((officer, oIdx) => (
                            <div key={oIdx} className="text-xs">
                              <p className="font-semibold text-slate-800 truncate" title={officer.name}>
                                • {officer.name}
                              </p>
                              {officer.courtRoom && (
                                <p className="text-[10px] text-slate-500 pl-2 truncate">{officer.courtRoom}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Status Badge */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      {isCurrentDay ? (
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">วันนี้</span>
                      ) : (
                        <span className="text-slate-400">{duty.dutyType || 'เวรชี้'}</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDuty(duty);
                        }}
                        className="text-slate-400 hover:text-amber-600 p-0.5"
                        title="แก้ไขข้อมูลเวรนี้"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detailed Table View Mode */}
        {viewMode === 'table' && currentRoster && (
          <div className="mt-5 overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">วันที่</th>
                  <th className="py-3 px-3">วันในสัปดาห์</th>
                  <th className="py-3 px-3">ประเภทเวร / วันหยุด</th>
                  <th className="py-3 px-3.5">รายชื่อเวรชี้</th>
                  <th className="py-3 px-3">ห้องพิจารณา / บัลลังก์</th>
                  <th className="py-3 px-3">รอบเวลา</th>
                  <th className="py-3 px-3">หมายเหตุ</th>
                  <th className="py-3 px-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDuties.map((duty) => (
                  <tr
                    key={duty.id}
                    onClick={() => setInspectedDate(duty.date)}
                    className={`cursor-pointer transition ${
                      duty.date === inspectedDate
                        ? 'bg-amber-50/80 font-medium'
                        : duty.isHoliday
                        ? 'bg-rose-50/20 hover:bg-rose-50/50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-3.5 font-semibold text-slate-800 whitespace-nowrap">
                      {duty.date}
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{duty.dayOfWeek || '-'}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {duty.isHoliday ? (
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-medium px-2 py-0.5 rounded-full border border-rose-200">
                          {duty.holidayName || 'วันหยุด'}
                        </span>
                      ) : (
                        <span className="text-slate-700">{duty.dutyType || 'เวรชี้สองฝ่าย'}</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5">
                      {duty.officers.length > 0 ? (
                        <div className="space-y-1">
                          {duty.officers.map((o, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-800">{o.name}</span>
                              {o.role && (
                                <span className="bg-blue-50 text-blue-700 text-[10px] px-1.5 rounded">
                                  {o.role}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {duty.officers.map((o) => o.courtRoom).filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {duty.officers.map((o) => o.session).filter(Boolean).join(', ') || 'ตลอดวัน'}
                    </td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={duty.notes}>
                      {duty.notes || '-'}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedDate(duty.date);
                          }}
                          className="px-2 py-1 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 rounded-md font-medium text-[11px] transition"
                        >
                          ดูเวรชี้
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDuty(duty);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
                          title="แก้ไข"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Edit / Swap Duty Modal */}
      {editingDuty && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-['Prompt']">
                  แก้ไขข้อมูลเวรชี้ / สลับเวรประจำวันที่ {editingDuty.date}
                </h3>
                <p className="text-xs text-slate-400">{editingDuty.dayOfWeek}</p>
              </div>
              <button
                onClick={() => setEditingDuty(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">ประเภทเวร / สถานะ:</label>
                <input
                  type="text"
                  value={editingDuty.dutyType || ''}
                  onChange={(e) => setEditingDuty({ ...editingDuty, dutyType: e.target.value })}
                  placeholder="เช่น เวรชี้สองฝ่าย, เวรชี้คดีอาญา"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg mt-1"
                />
              </div>

              {/* Officers edit */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>รายชื่อเวรชี้ ({editingDuty.officers.length} ท่าน):</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingDuty({
                        ...editingDuty,
                        officers: [
                          ...editingDuty.officers,
                          { name: '', role: 'เวรชี้', courtRoom: '', session: 'ตลอดวัน' },
                        ],
                      })
                    }
                    className="text-[11px] text-amber-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>เพิ่มเวรชี้อีก 1 ท่าน</span>
                  </button>
                </label>

                {editingDuty.officers.map((officer, oIdx) => (
                  <div key={oIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500">ชื่อ-นามสกุล:</span>
                        <input
                          type="text"
                          value={officer.name}
                          onChange={(e) => {
                            const newOfficers = [...editingDuty.officers];
                            newOfficers[oIdx] = { ...newOfficers[oIdx], name: e.target.value };
                            setEditingDuty({ ...editingDuty, officers: newOfficers });
                          }}
                          placeholder="ชื่อ-สกุล เวรชี้"
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white mt-0.5"
                          required
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">ตำแหน่ง / บทบาท:</span>
                        <input
                          type="text"
                          value={officer.role || ''}
                          onChange={(e) => {
                            const newOfficers = [...editingDuty.officers];
                            newOfficers[oIdx] = { ...newOfficers[oIdx], role: e.target.value };
                            setEditingDuty({ ...editingDuty, officers: newOfficers });
                          }}
                          placeholder="เช่น เวรชี้ 1, อัยการประจำกอง"
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white mt-0.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500">ห้องพิจารณาคดี / บัลลังก์:</span>
                        <input
                          type="text"
                          value={officer.courtRoom || ''}
                          onChange={(e) => {
                            const newOfficers = [...editingDuty.officers];
                            newOfficers[oIdx] = { ...newOfficers[oIdx], courtRoom: e.target.value };
                            setEditingDuty({ ...editingDuty, officers: newOfficers });
                          }}
                          placeholder="เช่น ห้อง 801, บัลลังก์ 4"
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white mt-0.5"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">รอบเวลา:</span>
                        <input
                          type="text"
                          value={officer.session || ''}
                          onChange={(e) => {
                            const newOfficers = [...editingDuty.officers];
                            newOfficers[oIdx] = { ...newOfficers[oIdx], session: e.target.value };
                            setEditingDuty({ ...editingDuty, officers: newOfficers });
                          }}
                          placeholder="เช้า / บ่าย / ตลอดวัน"
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white mt-0.5"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newOfficers = editingDuty.officers.filter((_, idx) => idx !== oIdx);
                          setEditingDuty({ ...editingDuty, officers: newOfficers });
                        }}
                        className="text-[10px] text-rose-600 hover:underline"
                      >
                        ลบรายชื่อนี้
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">หมายเหตุประจำวัน (เช่น สลับเวรกับ...):</label>
                <textarea
                  value={editingDuty.notes || ''}
                  onChange={(e) => setEditingDuty({ ...editingDuty, notes: e.target.value })}
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg mt-1"
                  placeholder="บันทึกข้อความหรือข้อตกลงสลับเวร..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingDuty(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  บันทึกการเปลี่ยนแปลง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
