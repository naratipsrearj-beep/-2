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
  Info,
  Trash2,
  Edit3,
  Plus,
  UploadCloud,
  X
} from 'lucide-react';
import { MonthlyDutyRoster, DailyDutyRecord, DutyOfficerEntry } from '../types/appeal';
import { formatThaiDateLong } from '../services/dutyService';

interface DailyDutyInspectorProps {
  rosters: MonthlyDutyRoster[];
  currentRoster: MonthlyDutyRoster | null;
  selectedDate: string;
  canEdit?: boolean;
  onSelectDate: (date: string) => void;
  onUpdateDutyRecord?: (rosterId: string, updatedRecord: DailyDutyRecord) => void;
  onOpenUploadModal?: () => void;
  onUseOfficerForNewCase?: (officerName: string, date: string) => void;
  onFilterCasesByOfficer?: (officerName: string) => void;
  showToast: (msg: string) => void;
}

export const DailyDutyInspector: React.FC<DailyDutyInspectorProps> = ({
  rosters,
  currentRoster,
  selectedDate,
  canEdit = true,
  onSelectDate,
  onUpdateDutyRecord,
  onOpenUploadModal,
  onUseOfficerForNewCase,
  onFilterCasesByOfficer,
  showToast,
}) => {
  const [copiedName, setCopiedName] = useState<string | null>(null);

  // Modal states for deleting, editing, and adding officers
  const [officerToDelete, setOfficerToDelete] = useState<{ index: number; name: string } | null>(null);
  const [officerToEdit, setOfficerToEdit] = useState<{ index: number; data: DutyOfficerEntry } | null>(null);
  const [isAddOfficerOpen, setIsAddOfficerOpen] = useState(false);
  const [newOfficerForm, setNewOfficerForm] = useState<DutyOfficerEntry>({
    name: '',
    role: 'อัยการเวรชี้',
    courtRoom: '',
    session: 'ตลอดวัน',
    contact: '',
    notes: '',
  });

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

  // Confirm delete officer
  const handleConfirmDeleteOfficer = () => {
    if (!officerToDelete || !sourceRoster || !matchedDuty || !onUpdateDutyRecord) return;
    const remainingOfficers = matchedDuty.officers.filter((_, idx) => idx !== officerToDelete.index);
    const updatedDuty: DailyDutyRecord = {
      ...matchedDuty,
      officers: remainingOfficers,
    };
    onUpdateDutyRecord(sourceRoster.id, updatedDuty);
    showToast(`ลบชื่ออัยการเวรชี้ "${officerToDelete.name}" ออกจากวันนี้เรียบร้อยแล้ว`);
    setOfficerToDelete(null);
  };

  // Save edit officer
  const handleSaveEditOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerToEdit || !sourceRoster || !matchedDuty || !onUpdateDutyRecord) return;
    const updatedOfficers = [...matchedDuty.officers];
    updatedOfficers[officerToEdit.index] = officerToEdit.data;
    const updatedDuty: DailyDutyRecord = {
      ...matchedDuty,
      officers: updatedOfficers,
    };
    onUpdateDutyRecord(sourceRoster.id, updatedDuty);
    showToast(`บันทึกการแก้ไขข้อมูลเวรชี้ "${officerToEdit.data.name}" แล้ว`);
    setOfficerToEdit(null);
  };

  // Save add new officer
  const handleSaveNewOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficerForm.name.trim() || !onUpdateDutyRecord) return;
    const targetRoster = sourceRoster || currentRoster || rosters[0];
    if (!targetRoster) {
      showToast('กรุณาสร้างหรืออัปโหลดตารางเวรประจำเดือนก่อน');
      return;
    }

    if (matchedDuty) {
      const updatedDuty: DailyDutyRecord = {
        ...matchedDuty,
        isHoliday: false,
        officers: [...matchedDuty.officers, { ...newOfficerForm, name: newOfficerForm.name.trim() }],
      };
      onUpdateDutyRecord(targetRoster.id, updatedDuty);
    } else {
      const newDutyRecord: DailyDutyRecord = {
        id: `duty_${selectedDate}_${Date.now()}`,
        date: selectedDate,
        dayOfWeek: new Intl.DateTimeFormat('th-TH', { weekday: 'long' }).format(new Date(selectedDate)),
        isHoliday: false,
        dutyType: 'เวรชี้สองฝ่าย',
        officers: [{ ...newOfficerForm, name: newOfficerForm.name.trim() }],
      };
      onUpdateDutyRecord(targetRoster.id, newDutyRecord);
    }

    showToast(`เพิ่มชื่อเวรชี้ "${newOfficerForm.name}" ในวันที่ ${selectedDate} เรียบร้อยแล้ว`);
    setIsAddOfficerOpen(false);
    setNewOfficerForm({
      name: '',
      role: 'อัยการเวรชี้',
      courtRoom: '',
      session: 'ตลอดวัน',
      contact: '',
      notes: '',
    });
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
                เลือกวันที่เพื่อดูรายชื่ออัยการ/เจ้าหน้าที่เวรชี้ ห้องพิจารณาคดี และรอบเวลา หรืออัพโหลดภาพให้ AI วิเคราะห์
              </p>
            </div>
          </div>

          {/* Quick Date Selectors & Upload Button */}
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

            {/* Upload image / PDF button in inspector top bar */}
            {canEdit && onOpenUploadModal && (
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                title="อัพโหลดภาพถ่ายหรือเอกสาร PDF ตารางเวรชี้ เพื่อให้ AI สกัดรายชื่อเวรชี้"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>อัพโหลดภาพ/PDF ให้ AI วิเคราะห์</span>
              </button>
            )}
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

          <div className="flex items-center gap-2 flex-wrap">
            {sourceRoster && (
              <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>จาก: {sourceRoster.monthNameThai}</span>
                <span className="text-slate-400">({sourceRoster.uploadedFileName || 'ตารางเวร'})</span>
              </div>
            )}

            {/* Quick Add Officer Button for this date */}
            {canEdit && onUpdateDutyRecord && (
              <button
                type="button"
                onClick={() => setIsAddOfficerOpen(true)}
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>เพิ่มชื่อเวรชี้ในวันนี้</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Details */}
        {matchedDuty ? (
          matchedDuty.isHoliday ? (
            /* Holiday Notice */
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-rose-900">
                {matchedDuty.holidayName || 'วันหยุดทำการของศาลและหน่วยงาน'}
              </h4>
              <p className="text-xs text-rose-700 max-w-md mx-auto">
                {matchedDuty.notes || 'ในวันนี้เป็นวันหยุดราชการ/วันหยุดทำการ ไม่มีรายชื่อเวรชี้คดี'}
              </p>
              {canEdit && onUpdateDutyRecord && (
                <button
                  type="button"
                  onClick={() => setIsAddOfficerOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มเวรชี้พิเศษในวันนี้</span>
                </button>
              )}
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

                      {/* Header Actions: Copy, Edit, Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyName(officer.name)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          title="คัดลอกชื่อเวรชี้"
                        >
                          {copiedName === officer.name ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {canEdit && onUpdateDutyRecord && sourceRoster && (
                          <>
                            <button
                              type="button"
                              onClick={() => setOfficerToEdit({ index, data: { ...officer } })}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="แก้ไขข้อมูลเวรชี้นี้"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setOfficerToDelete({ index, name: officer.name })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title={`ลบชื่อ ${officer.name} ออกจากเวรชี้วันนี้`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
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
            <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500 space-y-3">
              <p>ไม่พบรายชื่อเวรชี้ที่ระบุไว้สำหรับวันที่นี้ในตาราง</p>
              {canEdit && onUpdateDutyRecord && (
                <button
                  type="button"
                  onClick={() => setIsAddOfficerOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มชื่อเวรชี้ในวันที่นี้</span>
                </button>
              )}
            </div>
          )
        ) : (
          /* Not Found in Roster */
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700">
                ยังไม่มีข้อมูลเวรชี้สำหรับวันที่ {formatThaiDateLong(selectedDate)}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                ท่านสามารถอัปโหลดไฟล์ภาพหรือ PDF ของตารางเวรชี้ประจำเดือนนี้ เพื่อให้ AI สกัดรายชื่อเวรชี้โดยอัตโนมัติ หรือเพิ่มรายชื่อเวรชี้ด้วยตนเอง
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {canEdit && onOpenUploadModal && (
                <button
                  type="button"
                  onClick={onOpenUploadModal}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>อัพโหลดภาพหรือ PDF ตารางเวรให้ AI วิเคราะห์</span>
                </button>
              )}

              {canEdit && onUpdateDutyRecord && (
                <button
                  type="button"
                  onClick={() => setIsAddOfficerOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-300 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มรายชื่อเวรชี้ด้วยตนเอง</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Officer Confirmation Modal */}
      {officerToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800 font-['Prompt']">ยืนยันการลบชื่อเวรชี้</h4>
                <p className="text-xs text-slate-500">การกระทำนี้จะลบชื่อออกจากเวรชี้ของวันนี้</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              ต้องการลบชื่อ <strong className="text-slate-900">"{officerToDelete.name}"</strong> ออกจากรายชื่อเวรชี้ประจำวันที่ <strong className="text-slate-900">{formatThaiDateLong(selectedDate)}</strong> หรือไม่?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOfficerToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOfficer}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition"
              >
                ลบรายชื่อนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Officer Modal */}
      {officerToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <h4 className="text-sm font-bold font-['Prompt']">แก้ไขข้อมูลเวรชี้</h4>
              <button onClick={() => setOfficerToEdit(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditOfficer} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700">ชื่อ-นามสกุล:</label>
                <input
                  type="text"
                  value={officerToEdit.data.name}
                  onChange={(e) =>
                    setOfficerToEdit({
                      ...officerToEdit,
                      data: { ...officerToEdit.data, name: e.target.value },
                    })
                  }
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">ตำแหน่ง / บทบาท:</label>
                <input
                  type="text"
                  value={officerToEdit.data.role || ''}
                  onChange={(e) =>
                    setOfficerToEdit({
                      ...officerToEdit,
                      data: { ...officerToEdit.data, role: e.target.value },
                    })
                  }
                  placeholder="เช่น อัยการเวรชี้ 1, อัยการจังหวัดประจำสำนักงาน"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">ห้องพิจารณา / บัลลังก์:</label>
                  <input
                    type="text"
                    value={officerToEdit.data.courtRoom || ''}
                    onChange={(e) =>
                      setOfficerToEdit({
                        ...officerToEdit,
                        data: { ...officerToEdit.data, courtRoom: e.target.value },
                      })
                    }
                    placeholder="เช่น 803"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">รอบเวลา:</label>
                  <input
                    type="text"
                    value={officerToEdit.data.session || ''}
                    onChange={(e) =>
                      setOfficerToEdit({
                        ...officerToEdit,
                        data: { ...officerToEdit.data, session: e.target.value },
                      })
                    }
                    placeholder="ตลอดวัน / เช้า / บ่าย"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setOfficerToEdit(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Officer Modal */}
      {isAddOfficerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-amber-600 px-5 py-4 text-white flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold font-['Prompt']">เพิ่มชื่อเวรชี้</h4>
                <p className="text-[11px] text-amber-100">{formatThaiDateLong(selectedDate)}</p>
              </div>
              <button onClick={() => setIsAddOfficerOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveNewOfficer} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700">ชื่อ-นามสกุล อัยการ/เวรชี้ *:</label>
                <input
                  type="text"
                  value={newOfficerForm.name}
                  onChange={(e) => setNewOfficerForm({ ...newOfficerForm, name: e.target.value })}
                  placeholder="เช่น นายธนากร สุขเกษม"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg mt-1"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">ตำแหน่ง / บทบาท:</label>
                <input
                  type="text"
                  value={newOfficerForm.role || ''}
                  onChange={(e) => setNewOfficerForm({ ...newOfficerForm, role: e.target.value })}
                  placeholder="เช่น อัยการเวรชี้, อัยการจังหวัดประจำสำนักงาน"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">ห้องพิจารณา / บัลลังก์:</label>
                  <input
                    type="text"
                    value={newOfficerForm.courtRoom || ''}
                    onChange={(e) => setNewOfficerForm({ ...newOfficerForm, courtRoom: e.target.value })}
                    placeholder="เช่น 803 หรือ บัลลังก์ 2"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">รอบเวลา:</label>
                  <input
                    type="text"
                    value={newOfficerForm.session || ''}
                    onChange={(e) => setNewOfficerForm({ ...newOfficerForm, session: e.target.value })}
                    placeholder="ตลอดวัน"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddOfficerOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs"
                >
                  เพิ่มรายชื่อ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

