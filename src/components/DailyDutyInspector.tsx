import React, { useState } from 'react';
import {
  Calendar,
  UserCheck,
  Building2,
  Clock,
  Phone,
  FilePlus2,
  Filter,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  Info
} from 'lucide-react';
import { MonthlyDutyRoster, DailyDutyRecord, DutyOfficerEntry } from '../types/appeal';
import { formatThaiDateLong } from '../services/dutyService';

interface DailyDutyInspectorProps {
  rosters: MonthlyDutyRoster[];
  currentRoster: MonthlyDutyRoster | null;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onUseOfficerForNewCase?: (officerName: string, date: string) => void;
  onFilterCasesByOfficer?: (officerName: string) => void;
  showToast: (msg: string) => void;
}

export const DailyDutyInspector: React.FC<DailyDutyInspectorProps> = ({
  rosters,
  currentRoster,
  selectedDate,
  onSelectDate,
  onUseOfficerForNewCase,
  onFilterCasesByOfficer,
  showToast,
}) => {
  const [copiedName, setCopiedName] = useState<string | null>(null);

  // Today in local YYYY-MM-DD
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;

  // Tomorrow in YYYY-MM-DD
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(
    tomorrow.getDate()
  ).padStart(2, '0')}`;

  // Find duty record for selectedDate
  let matchedDuty: DailyDutyRecord | undefined;
  let sourceRoster: MonthlyDutyRoster | undefined;

  if (currentRoster) {
    matchedDuty = currentRoster.duties.find((d) => d.date === selectedDate);
    sourceRoster = currentRoster;
  }

  if (!matchedDuty) {
    for (const r of rosters) {
      const found = r.duties.find((d) => d.date === selectedDate);
      if (found) {
        matchedDuty = found;
        sourceRoster = r;
        break;
      }
    }
  }

  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedName(name);
    showToast(`คัดลอกชื่อ "${name}" เรียบร้อยแล้ว`);
    setTimeout(() => setCopiedName(null), 2500);
  };

  const isToday = selectedDate === todayStr;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-6">
      {/* Top Banner / Date Selector Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-4 sm:p-5 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-['Prompt'] text-white">
                  ตรวจสอบ: ใครเป็นเวรชี้ในวันนั้น
                </h2>
                {isToday && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                    เวรชี้วันนี้
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                เลือกวันที่เพื่อดูรายชื่ออัยการ/เจ้าหน้าที่เวรชี้ ห้องพิจารณาคดี และรอบเวลาตามเอกสารตารางเวรที่อัปโหลด
              </p>
            </div>
          </div>

          {/* Quick Date Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onSelectDate(todayStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                selectedDate === todayStr
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <span>วันนี้</span>
            </button>

            <button
              onClick={() => onSelectDate(tomorrowStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                selectedDate === tomorrowStr
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <span>พรุ่งนี้</span>
            </button>

            {/* Date Input */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-amber-400 mr-2 flex-shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onSelectDate(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-hidden cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Selected Date Result View */}
      <div className="p-5 sm:p-6 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-200 gap-2">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ผลการตรวจสอบเวรชี้ประจำวัน
            </span>
            <h3 className="text-lg font-bold text-slate-800 font-['Prompt'] flex items-center gap-2">
              <span>{formatThaiDateLong(selectedDate)}</span>
              {matchedDuty?.isHoliday && (
                <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-0.5 rounded-full font-medium border border-rose-200">
                  {matchedDuty.holidayName || 'วันหยุดราชการ'}
                </span>
              )}
            </h3>
          </div>

          {sourceRoster && (
            <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>จาก: {sourceRoster.monthNameThai}</span>
              <span className="text-slate-400">({sourceRoster.uploadedFileName || 'ตารางเวร'})</span>
            </div>
          )}
        </div>

        {/* Content Details */}
        {matchedDuty ? (
          matchedDuty.isHoliday ? (
            /* Holiday Notice */
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-rose-900">
                {matchedDuty.holidayName || 'วันหยุดทำการของศาลและหน่วยงาน'}
              </h4>
              <p className="text-xs text-rose-700 max-w-md mx-auto">
                {matchedDuty.notes || 'ในวันนี้เป็นวันหยุดราชการ/วันหยุดทำการ ไม่มีรายชื่อเวรชี้คดี'}
              </p>
            </div>
          ) : matchedDuty.officers.length > 0 ? (
            /* Officers List Cards */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span className="font-semibold flex items-center gap-1">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>มีเวรชี้ปฏิบัติหน้าที่ทั้งหมด {matchedDuty.officers.length} ท่าน:</span>
                </span>
                {matchedDuty.dutyType && (
                  <span className="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-md font-medium text-[11px]">
                    {matchedDuty.dutyType}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {matchedDuty.officers.map((officer, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs hover:border-amber-400 transition space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white font-bold flex items-center justify-center text-sm shadow-xs flex-shrink-0">
                          {officer.name.replace(/^(นาย|นางสาว|นาง|ว่าที่ร\.ต\.|ดร\.)/, '').trim().charAt(0) || 'ว'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-800">{officer.name}</h4>
                            {officer.role && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium px-2 py-0.2 rounded-md">
                                {officer.role}
                              </span>
                            )}
                          </div>
                          {officer.courtRoom && (
                            <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>{officer.courtRoom}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopyName(officer.name)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="คัดลอกชื่อเวรชี้"
                      >
                        {copiedName === officer.name ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                      {officer.session && (
                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>รอบ: {officer.session}</span>
                        </span>
                      )}
                      {officer.contact && (
                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{officer.contact}</span>
                        </span>
                      )}
                      {officer.notes && (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                          หมายเหตุ: {officer.notes}
                        </span>
                      )}
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      {onUseOfficerForNewCase && (
                        <button
                          onClick={() => onUseOfficerForNewCase(officer.name, selectedDate)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-1.5 px-2.5 rounded-lg transition shadow-xs"
                        >
                          <FilePlus2 className="w-3.5 h-3.5" />
                          <span>ใช้ชื่อนี้เพิ่มสำนวน</span>
                        </button>
                      )}

                      {onFilterCasesByOfficer && (
                        <button
                          onClick={() => onFilterCasesByOfficer(officer.name)}
                          className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-1.5 px-2.5 rounded-lg transition"
                          title="กรองดูสำนวนที่เวรชี้นี้รับผิดชอบ"
                        >
                          <Filter className="w-3.5 h-3.5 text-slate-500" />
                          <span>กรองดูสำนวน</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {matchedDuty.notes && (
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.2" />
                  <span>หมายเหตุประจำวัน: {matchedDuty.notes}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
              ไม่พบรายชื่อเวรชี้ที่ระบุไว้สำหรับวันที่นี้ในตาราง
            </div>
          )
        ) : (
          /* Not Found in Roster */
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700">
                ยังไม่มีข้อมูลเวรชี้สำหรับวันที่ {formatThaiDateLong(selectedDate)}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                ท่านสามารถอัปโหลดไฟล์ภาพหรือ PDF ของตารางเวรชี้ประจำเดือนนี้ เพื่อให้ AI สกัดรายชื่อเวรชี้โดยอัตโนมัติ
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
