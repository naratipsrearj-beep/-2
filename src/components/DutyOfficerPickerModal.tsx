import React, { useState, useEffect, useMemo } from 'react';
import { X, UserCheck, Calendar, Search, FileText, Check, Sparkles, Building2, UploadCloud, ChevronRight } from 'lucide-react';
import { MonthlyDutyRoster } from '../types/appeal';
import { formatThaiDate } from '../utils/dateUtils';
import { getDutyOfficersForDate, getAllOfficersGroupedByMonth } from '../services/dutyService';

interface DutyOfficerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  rosters: MonthlyDutyRoster[];
  targetDate?: string; // วันที่ฟ้อง เพื่อไฮไลต์เวรชี้ตรงวัน
  onSelectOfficer: (officerName: string, officerRole?: string) => void;
  onOpenUploadModal?: () => void;
  title?: string;
  subtitle?: string;
}

export const DutyOfficerPickerModal: React.FC<DutyOfficerPickerModalProps> = ({
  isOpen,
  onClose,
  rosters,
  targetDate,
  onSelectOfficer,
  onOpenUploadModal,
  title = 'เลือกเวรชี้จากตารางประจำเดือน (PDF)',
  subtitle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);

  // Grouped officers by month from uploaded PDF rosters
  const monthsData = useMemo(() => {
    return getAllOfficersGroupedByMonth(rosters);
  }, [rosters]);

  // Auto select month matching targetDate when modal opens or targetDate changes
  useEffect(() => {
    if (isOpen && targetDate && monthsData.length > 0) {
      const targetMonthYear = targetDate.slice(0, 7); // e.g. "2026-10"
      const foundIdx = monthsData.findIndex((m) => m.monthYear === targetMonthYear);
      if (foundIdx !== -1) {
        setSelectedMonthIndex(foundIdx);
      } else {
        setSelectedMonthIndex(0);
      }
    }
  }, [isOpen, targetDate, monthsData]);

  // Officers on duty on the exact targetDate
  const onDutyToday = useMemo(() => {
    if (!targetDate) return [];
    return getDutyOfficersForDate(rosters, targetDate);
  }, [rosters, targetDate]);

  const activeMonthData = monthsData[selectedMonthIndex] || monthsData[0];

  // Filter officers by search term
  const filteredOfficers = useMemo(() => {
    if (!activeMonthData) return [];
    if (!searchTerm.trim()) return activeMonthData.officers;
    const q = searchTerm.toLowerCase().trim();
    return activeMonthData.officers.filter(
      (off) => off.name.toLowerCase().includes(q) || off.role.toLowerCase().includes(q)
    );
  }, [activeMonthData, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 my-6 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base font-['Prompt'] text-white">
                {title}
              </h3>
              <p className="text-xs text-slate-300">
                {subtitle || (targetDate ? `เลือกเวรชี้สำหรับวันที่ฟ้อง: ${formatThaiDate(targetDate)}` : 'เลือกตามตารางเวรชี้แต่ละเดือนที่อัปโหลดไฟล์ PDF')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Section 1: Exact Match for Target Date (if available) */}
          {targetDate && onDutyToday.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>เวรชี้ตรงตามวันที่ฟ้อง ({formatThaiDate(targetDate, { short: true })})</span>
                </span>
                <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  แนะนำตรงวัน
                </span>
              </div>
              <div className="space-y-1.5">
                {onDutyToday.map((off, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelectOfficer(off.name, off.role);
                      onClose();
                    }}
                    className="w-full text-left bg-white hover:bg-amber-100/70 border border-amber-300 p-2.5 rounded-xl transition flex items-center justify-between group shadow-2xs cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 group-hover:text-amber-900 block font-['Prompt']">
                        ⚖️ {off.name}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {off.role} {off.courtRoom ? `• ${off.courtRoom}` : ''}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-800 bg-amber-100 group-hover:bg-amber-600 group-hover:text-white px-3 py-1 rounded-lg transition border border-amber-200">
                      เลือกชื่อนี้
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Month Selector Tabs (เลือกตามเวรชี้แต่ละเดือนที่อัปโหลดไฟล์ PDF) */}
          {monthsData.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>เลือกรอบเดือนตารางเวรชี้ (จาก PDF):</span>
                </span>
                {monthsData.length > 1 && (
                  <span className="text-[11px] text-slate-400">
                    อัปโหลดแล้ว {monthsData.length} รอบเดือน
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
                {monthsData.map((m, mIdx) => {
                  const isSelected = selectedMonthIndex === mIdx;
                  return (
                    <button
                      key={m.monthYear}
                      type="button"
                      onClick={() => {
                        setSelectedMonthIndex(mIdx);
                        setSearchTerm('');
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      <span>📅 {m.monthNameThai}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {m.officers.length} ท่าน
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeMonthData && (
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-xs flex items-center justify-between text-slate-600">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">
                      ไฟล์ PDF: <strong className="text-slate-800">{activeMonthData.fileName || `ตารางเวรชี้_${activeMonthData.monthYear}.pdf`}</strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0 ml-2">
                    {activeMonthData.officers.length} รายชื่อ
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 bg-amber-50/50 rounded-xl border border-dashed border-amber-300 space-y-2">
              <UserCheck className="w-8 h-8 text-amber-600 mx-auto" />
              <p className="font-semibold text-slate-800">ยังไม่มีข้อมูลตารางเวรชี้ประจำเดือน</p>
              <p className="text-[11px] text-slate-500">
                โปรดอัปโหลดไฟล์ PDF ตารางเวรชี้ในแท็บ &quot;ตารางเวรชี้ประจำเดือน (AI)&quot; เพื่อให้ระบบอ่านรายชื่อเวรชี้แต่ละเดือนมาให้เลือกโดยอัตโนมัติ
              </p>
              {onOpenUploadModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenUploadModal();
                  }}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>อัปโหลดไฟล์ PDF ตารางเวรชี้</span>
                </button>
              )}
            </div>
          )}

          {/* Search box for officers */}
          {activeMonthData && (
            <div className="relative">
              <input
                type="text"
                placeholder={`ค้นหาชื่ออัยการเวรชี้ในเดือน ${activeMonthData.monthNameThai}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-8 py-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* List of Officers from Uploaded PDF */}
          {activeMonthData && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  รายชื่อเวรชี้ประจำเดือน <strong>{activeMonthData.monthNameThai}</strong>{' '}
                  ({filteredOfficers.length} ท่าน)
                </span>
                <span className="text-[11px] text-amber-700">คลิกที่ชื่อเพื่อเลือกทันที</span>
              </div>

              {filteredOfficers.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-white shadow-2xs">
                  {filteredOfficers.map((off, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onSelectOfficer(off.name, off.role);
                        onClose();
                      }}
                      className="w-full text-left p-3 hover:bg-amber-50/60 transition flex items-center justify-between gap-2 group cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 group-hover:text-amber-800 font-['Prompt'] truncate flex items-center gap-1.5">
                          <span>⚖️</span>
                          <span>{off.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {off.role} • เข้าเวรชี้ {off.dutyCount} วัน
                        </div>
                      </div>
                      <span className="text-xs font-bold text-amber-800 bg-amber-50 group-hover:bg-amber-600 group-hover:text-white px-2.5 py-1 rounded-lg transition border border-amber-200 flex-shrink-0 flex items-center gap-1">
                        <span>เลือก</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  {searchTerm
                    ? `ไม่พบรายชื่อเวรชี้ที่ตรงกับ "${searchTerm}" ในเดือน ${activeMonthData.monthNameThai}`
                    : `ยังไม่มีรายชื่อเวรชี้ในรอบเดือน ${activeMonthData.monthNameThai}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>ข้อมูลจากไฟล์ PDF ตารางเวรชี้ที่อัปโหลด</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-lg font-medium transition cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
