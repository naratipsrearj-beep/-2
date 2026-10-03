import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, Shield, Search, FileText, AlertCircle, Clock, Plus, Trash2, CalendarPlus } from 'lucide-react';
import { AppealCase, CourtAppointmentType, CaseAppointment } from '../types/appeal';
import { formatThaiDate, getTodayString } from '../utils/dateUtils';

interface CourtAppointmentModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  onClose: () => void;
  onSaveAppointment: (
    caseId: string,
    appointmentData: {
      appointmentType: CourtAppointmentType;
      appointmentTypeName?: string;
      appointmentDate?: string;
      appointmentTime?: string;
      appointmentCourtRoom?: string;
      appointmentNotes?: string;
      subsequentAppointments?: CaseAppointment[];
    },
    syncToCalendar?: boolean
  ) => void;
}

export const appointmentTypeOptions: { value: CourtAppointmentType; label: string; description: string; icon: string }[] = [
  { value: 'none', label: 'ไม่มีนัด (รอคุมระยะเวลาอุทธรณ์)', description: 'ไม่มีนัดของศาลในระหว่างนี้', icon: '⏳' },
  { value: 'rights_protection', label: 'นัดคุ้มครองสิทธิ', description: 'นัดชี้สองสถาน / คุ้มครองสิทธิและเสรีภาพ', icon: '🛡️' },
  { value: 'investigation', label: 'นัดสืบเสาะ', description: 'นัดสืบเสาะและพินิจพฤติการณ์จำเลย', icon: '🔍' },
  { value: 'judgment', label: 'นัดฟังคำพิพากษา / คำสั่ง', description: 'ศาลนัดฟังคำพิพากษาหรือคำสั่งศาล', icon: '⚖️' },
  { value: 'mediation', label: 'นัดไกล่เกลี่ย', description: 'นัดศูนย์ไกล่เกลี่ยและประนอมข้อพิพาท', icon: '🤝' },
  { value: 'pre_trial', label: 'นัดพร้อม / ตรวจพยานหลักฐาน', description: 'นัดพร้อมเพื่อกำหนดประเด็นและตรวจพยาน', icon: '📋' },
  { value: 'witness_examination', label: 'นัดสืบพยานโจทก์ / จำเลย', description: 'นัดพิจารณาสืบพยานในบัลลังก์', icon: '🎙️' },
  { value: 'other', label: 'นัดอื่นๆ', description: 'นัดเฉพาะเรื่องตามคำสั่งศาล', icon: '📌' },
];

export const CourtAppointmentModal: React.FC<CourtAppointmentModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  onSaveAppointment,
}) => {
  const [appointmentType, setAppointmentType] = useState<CourtAppointmentType>('none');
  const [appointmentTypeName, setAppointmentTypeName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('09:00 น.');
  const [appointmentCourtRoom, setAppointmentCourtRoom] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [subsequentAppointments, setSubsequentAppointments] = useState<CaseAppointment[]>([]);
  const [syncToCalendar, setSyncToCalendar] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (caseItem) {
      setAppointmentType(caseItem.appointmentType || 'none');
      setAppointmentTypeName(caseItem.appointmentTypeName || '');
      setAppointmentDate(caseItem.appointmentDate || getTodayString());
      setAppointmentTime(caseItem.appointmentTime || '09:00 น.');
      setAppointmentCourtRoom(caseItem.appointmentCourtRoom || '');
      setAppointmentNotes(caseItem.appointmentNotes || '');
      setSubsequentAppointments(caseItem.subsequentAppointments || []);
      setErrorMsg(null);
    }
  }, [caseItem, isOpen]);

  if (!isOpen || !caseItem) return null;

  // Has appointment date requirement: when user selects rights_protection, investigation, other, or any valid appointment
  const requiresDate = appointmentType !== 'none';

  const handleAddSubsequentAppointment = () => {
    const newAppt: CaseAppointment = {
      id: `appt_${Date.now()}_${subsequentAppointments.length + 1}`,
      type: 'pre_trial',
      typeName: '',
      date: '',
      time: appointmentTime || '09:00 น.',
      courtRoom: appointmentCourtRoom || '',
      notes: '',
    };
    setSubsequentAppointments([...subsequentAppointments, newAppt]);
  };

  const handleAddSubsequentPreset = (type: CourtAppointmentType, notes: string) => {
    const newAppt: CaseAppointment = {
      id: `appt_${Date.now()}_${subsequentAppointments.length + 1}`,
      type,
      typeName: '',
      date: '',
      time: appointmentTime || '09:00 น.',
      courtRoom: appointmentCourtRoom || '',
      notes,
    };
    setSubsequentAppointments([...subsequentAppointments, newAppt]);
  };

  const handleRemoveSubsequentAppointment = (id: string) => {
    setSubsequentAppointments(subsequentAppointments.filter((a) => a.id !== id));
  };

  const handleUpdateSubsequentAppointment = (id: string, field: keyof CaseAppointment, value: any) => {
    setSubsequentAppointments(
      subsequentAppointments.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresDate && !appointmentDate) {
      setErrorMsg('กรุณาระบุวันที่นัดของศาล');
      return;
    }

    if (appointmentType === 'other' && !appointmentTypeName.trim()) {
      setErrorMsg('กรุณาระบุชื่อนัดอื่นๆ');
      return;
    }

    onSaveAppointment(
      caseItem.id,
      {
        appointmentType,
        appointmentTypeName: appointmentType === 'other' ? appointmentTypeName.trim() : undefined,
        appointmentDate: requiresDate ? appointmentDate : undefined,
        appointmentTime: appointmentTime || undefined,
        appointmentCourtRoom: appointmentCourtRoom.trim() || undefined,
        appointmentNotes: appointmentNotes.trim() || undefined,
        subsequentAppointments: subsequentAppointments.length > 0 ? subsequentAppointments : undefined,
      },
      syncToCalendar
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-base">
              📅
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt']">
                ระบุขั้นตอนนัดของศาล
              </h3>
              <p className="text-xs text-slate-300">
                ดำ {caseItem.blackCaseNo} / แดง {caseItem.redCaseNo}
                {caseItem.prosecutorName && ` • อัยการ: ${caseItem.prosecutorName}`}
                {' '}• {caseItem.court}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Case summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 flex justify-between items-center">
            <div>
              <span className="text-slate-500">คู่ความ:</span> {caseItem.plaintiff} vs {caseItem.defendant}
            </div>
            <div className="text-rose-700 font-semibold">
              ครบอุทธรณ์: {formatThaiDate(caseItem.extendedDeadline || caseItem.appealDeadline)}
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Appointment Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              สำนวนนี้อยู่ในนัดอะไรของศาล *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {appointmentTypeOptions.map((opt) => {
                const isSelected = appointmentType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setAppointmentType(opt.value);
                      setErrorMsg(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500 font-medium'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <span className="text-base flex-shrink-0 mt-0.5">{opt.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-snug">{opt.label}</div>
                      <div className="text-[10px] text-slate-500 truncate">{opt.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional Field: Other Appointment Name */}
          {appointmentType === 'other' && (
            <div className="animate-in fade-in duration-150">
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                ระบุชื่อนัดอื่นๆ *
              </label>
              <input
                type="text"
                required
                placeholder="เช่น นัดฟังคำสั่งคำร้องขอปล่อยชั่วคราว, นัดชี้สองสถาน"
                value={appointmentTypeName}
                onChange={(e) => setAppointmentTypeName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
              />
            </div>
          )}

          {/* Conditional Date Field for appointments */}
          {requiresDate && (
            <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-bold text-indigo-950 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>วันที่นัดของศาล * (กำหนดนัดคุ้มครองสิทธิ / สืบเสาะ / อื่นๆ)</span>
                </label>
                <input
                  type="date"
                  required
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-indigo-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                />
                {appointmentDate && (
                  <p className="text-[11px] text-indigo-700 mt-1 font-semibold">
                    ตรงกับ: {formatThaiDate(appointmentDate, { short: false })}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-indigo-950 mb-1">
                  รายละเอียดนัด / สถานที่ / หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  placeholder="เช่น นัดสืบเสาะห้อง 302, ส่งรายงานสืบเสาะก่อน 3 วัน, นัดคุ้มครองสิทธิไกล่เกลี่ย"
                  value={appointmentNotes}
                  onChange={(e) => setAppointmentNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div className="pt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="syncCalendarAppt"
                  checked={syncToCalendar}
                  onChange={(e) => setSyncToCalendar(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="syncCalendarAppt" className="text-xs text-indigo-900 cursor-pointer">
                  บันทึกวันนัดนี้ลงใน Google Calendar ของฉันด้วย
                </label>
              </div>
            </div>
          )}

          {/* Subsequent Court Appointments ("เลือกวันนัดต่อๆ ไป") */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CalendarPlus className="w-4 h-4 text-indigo-600" />
                <span>วันนัดต่อๆ ไปในสำนวน (Subsequent Appointments):</span>
              </label>
              <button
                type="button"
                onClick={handleAddSubsequentAppointment}
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ เพิ่มวันนัดถัดไป</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 bg-indigo-50/70 p-2 rounded-lg">
              <span className="text-[10px] font-bold text-indigo-900 mr-1">เพิ่มนัดถัดไปด่วน:</span>
              <button
                type="button"
                onClick={() => handleAddSubsequentPreset('pre_trial', 'นัดพร้อมเพื่อกำหนดประเด็นและตรวจพยานหลักฐาน')}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 transition"
              >
                + 📋 นัดพร้อม/ตรวจพยาน
              </button>
              <button
                type="button"
                onClick={() => handleAddSubsequentPreset('witness_examination', 'นัดสืบพยานโจทก์')}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 transition"
              >
                + 🎙️ นัดสืบพยานโจทก์
              </button>
              <button
                type="button"
                onClick={() => handleAddSubsequentPreset('witness_examination', 'นัดสืบพยานจำเลย')}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-orange-50 text-orange-800 border border-orange-200 transition"
              >
                + 🎙️ นัดสืบพยานจำเลย
              </button>
              <button
                type="button"
                onClick={() => handleAddSubsequentPreset('judgment', 'นัดฟังคำพิพากษาหรือคำสั่งศาล')}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 transition"
              >
                + ⚖️ นัดฟังคำพิพากษา
              </button>
              <button
                type="button"
                onClick={() => handleAddSubsequentPreset('rights_protection', 'นัดคุ้มครองสิทธิรอบสอง')}
                className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 transition"
              >
                + 🛡️ นัดคุ้มครองสิทธิ (นัด 2)
              </button>
            </div>

            {subsequentAppointments.length === 0 ? (
              <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                ยังไม่มีวันนัดถัดไปเพิ่มเติม สามารถกดปุ่มเพิ่มนัดด่วนด้านบน หรือกด <strong>"+ เพิ่มวันนัดถัดไป"</strong> ได้ครับ
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {subsequentAppointments.map((appt, idx) => (
                  <div
                    key={appt.id}
                    className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1 text-indigo-800">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>นัดถัดไปลำดับที่ {idx + 2}:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubsequentAppointment(appt.id)}
                        className="text-rose-500 hover:text-rose-700 p-0.5 text-[11px] flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>ลบ</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <select
                          value={appt.type}
                          onChange={(e) =>
                            handleUpdateSubsequentAppointment(
                              appt.id,
                              'type',
                              e.target.value as CourtAppointmentType
                            )
                          }
                          className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                        >
                          <option value="pre_trial">📋 นัดพร้อม / ตรวจพยานหลักฐาน</option>
                          <option value="witness_examination">🎙️ นัดสืบพยานโจทก์-จำเลย</option>
                          <option value="rights_protection">🛡️ นัดคุ้มครองสิทธิ</option>
                          <option value="investigation">🔍 นัดสืบเสาะ</option>
                          <option value="mediation">🤝 นัดไกล่เกลี่ย</option>
                          <option value="judgment">⚖️ นัดฟังคำพิพากษา</option>
                          <option value="other">📌 นัดอื่นๆ</option>
                        </select>
                      </div>

                      <div>
                        <input
                          type="date"
                          required
                          value={appt.date}
                          onChange={(e) =>
                            handleUpdateSubsequentAppointment(appt.id, 'date', e.target.value)
                          }
                          className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                        />
                        {appt.date && (
                          <span className="text-[9px] text-indigo-700 block mt-0.5">
                            {formatThaiDate(appt.date)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="รายละเอียดนัด เช่น สืบพยานโจทก์ 2 ปาก..."
                        value={appt.notes || ''}
                        onChange={(e) =>
                          handleUpdateSubsequentAppointment(appt.id, 'notes', e.target.value)
                        }
                        className="w-full text-[11px] border border-slate-200 rounded px-2 py-1 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>บันทึกข้อมูลนัด</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
