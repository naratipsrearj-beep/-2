import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Scale,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  PlusCircle,
  Check,
  Clock,
  Shield,
  Plus,
  Trash2,
  CalendarPlus,
  Sparkles,
  Info,
  UserCheck
} from 'lucide-react';
import { AppealCase, CourtAppointmentType, CaseAppointment, MonthlyDutyRoster } from '../types/appeal';
import { calculateAppealDeadline, formatThaiDate, getTodayString } from '../utils/dateUtils';
import { appointmentTypeOptions } from './CourtAppointmentModal';
import { DutyOfficerPickerModal } from './DutyOfficerPickerModal';
import { getDutyOfficersForDate, getAllOfficersGroupedByMonth } from '../services/dutyService';

interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (caseData: Omit<AppealCase, 'id' | 'createdAt' | 'updatedAt'>, saveToCalendar: boolean) => void;
  initialFilingDate?: string;
  initialResponsiblePerson?: string;
  suggestedDutyOfficer?: string;
  dutyRosters?: MonthlyDutyRoster[];
  hasSheetConnected: boolean;
}

export const AddCaseModal: React.FC<AddCaseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialFilingDate,
  initialResponsiblePerson,
  suggestedDutyOfficer,
  dutyRosters = [],
  hasSheetConnected,
}) => {
  const [filingDate, setFilingDate] = useState<string>(initialFilingDate || getTodayString());
  const [blackCaseNo, setBlackCaseNo] = useState('');
  const [redCaseNo, setRedCaseNo] = useState('');
  const [receivedNumberS1, setReceivedNumberS1] = useState('');
  const [filingNumberS4, setFilingNumberS4] = useState('');
  const [prosecutorName, setProsecutorName] = useState('');
  const [court, setCourt] = useState('ศาลอาญา');
  const [plaintiff, setPlaintiff] = useState('');
  const [defendant, setDefendant] = useState('');
  const [caseType, setCaseType] = useState('อาญา');
  const [isDutyPickerOpen, setIsDutyPickerOpen] = useState(false);

  // Case Status: Has Judgment rendered vs. Pending Hearings / Rights Protection / Denied Plea
  const [hasJudgment, setHasJudgment] = useState<boolean>(false);
  const [defendantPlea, setDefendantPlea] = useState<'denied' | 'confessed' | 'pending'>('denied');

  const [judgmentDate, setJudgmentDate] = useState<string>('');
  const [judgmentOutcome, setJudgmentOutcome] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState(initialResponsiblePerson || suggestedDutyOfficer || '');
  const [notes, setNotes] = useState('');
  const [saveToCalendar, setSaveToCalendar] = useState(false);

  // Initial Court Appointment (เช่น นัดคุ้มครองสิทธิ)
  const [appointmentType, setAppointmentType] = useState<CourtAppointmentType>('rights_protection');
  const [appointmentTypeName, setAppointmentTypeName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('09:00 น.');
  const [appointmentCourtRoom, setAppointmentCourtRoom] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  // Subsequent / Next Court Appointments ("วันนัดต่อๆ ไป")
  const [subsequentAppointments, setSubsequentAppointments] = useState<CaseAppointment[]>([]);

  // Duty officers for the filing date & grouped by month from uploaded PDF rosters
  const onDutyOfficersOnFilingDate = useMemo(() => {
    if (!filingDate || !dutyRosters.length) return [];
    return getDutyOfficersForDate(dutyRosters, filingDate);
  }, [dutyRosters, filingDate]);

  const monthsOfficersData = useMemo(() => {
    return getAllOfficersGroupedByMonth(dutyRosters);
  }, [dutyRosters]);

  // Auto-calculated 1-month appeal deadline (only if judgmentDate is present)
  const [deadlineInfo, setDeadlineInfo] = useState({
    deadlineDate: '',
    originalDeadline: '',
    isAdjustedForWeekend: false,
  });

  useEffect(() => {
    if (judgmentDate && hasJudgment) {
      const info = calculateAppealDeadline(judgmentDate);
      setDeadlineInfo(info);
    } else {
      setDeadlineInfo({ deadlineDate: '', originalDeadline: '', isAdjustedForWeekend: false });
    }
  }, [judgmentDate, hasJudgment]);

  useEffect(() => {
    if (initialFilingDate) {
      setFilingDate(initialFilingDate);
    }
  }, [initialFilingDate]);

  useEffect(() => {
    if (initialResponsiblePerson) {
      setResponsiblePerson(initialResponsiblePerson);
    } else if (suggestedDutyOfficer && !responsiblePerson) {
      setResponsiblePerson(suggestedDutyOfficer);
    }
  }, [initialResponsiblePerson, suggestedDutyOfficer]);

  if (!isOpen) return null;

  // Add subsequent appointment row
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

  // Add quick preset subsequent appointment
  const handleAddSubsequentPreset = (type: CourtAppointmentType, label: string, notes: string) => {
    const newAppt: CaseAppointment = {
      id: `appt_${Date.now()}_${subsequentAppointments.length + 1}`,
      type,
      typeName: type === 'other' ? label : undefined,
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

    if (!blackCaseNo.trim()) {
      alert('กรุณากรอกหมายเลขคดีดำ');
      return;
    }

    if (hasJudgment) {
      if (!judgmentDate) {
        alert('กรุณาระบุวันที่ศาลอ่านคำพิพากษา สำหรับสำนวนที่มีคำพิพากษาแล้ว');
        return;
      }
    } else {
      // Pending trial / rights protection / denied plea
      if (appointmentType !== 'none' && !appointmentDate) {
        alert('กรุณาระบุวันที่นัดของศาล (เช่น วันนัดคุ้มครองสิทธิ หรือวันนัดแรก)');
        return;
      }
    }

    onSave(
      {
        filingDate,
        blackCaseNo: blackCaseNo.trim(),
        redCaseNo: redCaseNo.trim() || undefined,
        receivedNumberS1: receivedNumberS1.trim() || undefined,
        filingNumberS4: filingNumberS4.trim() || undefined,
        prosecutorName: prosecutorName.trim() || undefined,
        court,
        plaintiff: plaintiff.trim(),
        defendant: defendant.trim(),
        caseType,
        hasJudgment,
        defendantPlea: hasJudgment ? undefined : defendantPlea,
        judgmentDate: hasJudgment && judgmentDate ? judgmentDate : undefined,
        appealDeadline: hasJudgment && deadlineInfo.deadlineDate ? deadlineInfo.deadlineDate : undefined,
        judgmentOutcome: hasJudgment ? judgmentOutcome.trim() : (appointmentType !== 'none' ? `อยู่ระหว่าง${appointmentType === 'rights_protection' ? 'นัดคุ้มครองสิทธิ' : 'นัดพิจารณา'} (จำเลยให้การปฏิเสธ)` : ''),
        responsiblePerson: responsiblePerson.trim() || 'ผู้ดูแลสำนวน',
        isCompleted: false,
        notes: notes.trim() || undefined,
        appointmentType,
        appointmentTypeName: appointmentType === 'other' ? appointmentTypeName.trim() : undefined,
        appointmentDate: appointmentType !== 'none' && appointmentDate ? appointmentDate : undefined,
        appointmentTime: appointmentTime || undefined,
        appointmentCourtRoom: appointmentCourtRoom.trim() || undefined,
        appointmentNotes: appointmentNotes.trim() || undefined,
        subsequentAppointments: subsequentAppointments.length > 0 ? subsequentAppointments : undefined,
      },
      saveToCalendar
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt'] text-white">
                เพิ่มสำนวนคดีที่ฟ้องประจำวัน
              </h3>
              <p className="text-xs text-slate-300">
                รองรับทั้งสำนวนที่มีคำพิพากษา และสำนวนที่จำเลยให้การปฏิเสธ / มีนัดคุ้มครองสิทธิหรือวันนัดต่อๆ ไป
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Key Option: Case Stage / Judgment Toggle */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600" />
              <span>สถานะสำนวนในการพิจารณาของศาล:</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setHasJudgment(false);
                  setDefendantPlea('denied');
                  if (appointmentType === 'none') {
                    setAppointmentType('rights_protection');
                  }
                }}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                  !hasJudgment
                    ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-500/20 text-indigo-950'
                    : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border mt-0.5 ${!hasJudgment ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'}`}>
                  {!hasJudgment && <Check className="w-3 h-3" />}
                </div>
                <div>
                  <span className="text-xs font-bold block">
                    🛡️ คุ้มครองสิทธิ หรือสำนวนที่มีนัด (จำเลยให้การปฏิเสธ)
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-tight">
                    ไม่บังคับใส่วันที่พิพากษา • ให้เลือกวันนัดต่อๆ ไปแทน
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHasJudgment(true);
                  if (!judgmentDate) setJudgmentDate(getTodayString());
                }}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                  hasJudgment
                    ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20 text-amber-950'
                    : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border mt-0.5 ${hasJudgment ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300'}`}>
                  {hasJudgment && <Check className="w-3 h-3" />}
                </div>
                <div>
                  <span className="text-xs font-bold block">
                    ⚖️ ศาลมีคำพิพากษาแล้ว (จำเลยรับสารภาพ / พิพากษาในวันฟ้อง)
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-tight">
                    ใส่วันที่ศาลพิพากษา เพื่อเริ่มนับเวลาอุทธรณ์ 1 เดือน
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Row 1: Filing date & Case Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                วันที่ยื่นฟ้อง (สำหรับแยกสำนวนรายวัน) *
              </label>
              <input
                type="date"
                required
                value={filingDate}
                onChange={(e) => setFilingDate(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[10px] text-slate-500">
                {formatThaiDate(filingDate, { short: false })}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ประเภทคดี *
              </label>
              <select
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="อาญา">คดีอาญา</option>
                <option value="แพ่ง">คดีแพ่ง</option>
                <option value="ผู้บริโภค">คดีผู้บริโภค (ผบ.)</option>
                <option value="ปกครอง">คดีปกครอง</option>
                <option value="แรงงาน">คดีแรงงาน</option>
                <option value="เยาวชนและครอบครัว">คดีเยาวชนและครอบครัว</option>
                <option value="ล้มละลาย">คดีล้มละลาย</option>
              </select>
            </div>
          </div>

          {/* Row 2: Black & Red Case No. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมายเลขคดีดำ *
              </label>
              <input
                type="text"
                required
                placeholder="เช่น อ.452/2569"
                value={blackCaseNo}
                onChange={(e) => setBlackCaseNo(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>หมายเลขคดีแดง</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {hasJudgment ? 'จำเป็นเมื่อมีคำพิพากษา' : 'ไม่บังคับ (ยังไม่มีคำพิพากษา)'}
                </span>
              </label>
              <input
                type="text"
                placeholder={hasJudgment ? 'เช่น อ.891/2569' : 'รอกำหนดเมื่อศาลมีคำพิพากษา'}
                value={redCaseNo}
                onChange={(e) => setRedCaseNo(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Row 2.5: OAG Case Docket Numbers (เลขรับ ส.1 และ เลขฟ้อง ส.4) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>ข้อมูลเลขรับ ส.1</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">สารบบรับสำนวน</span>
              </label>
              <input
                type="text"
                placeholder="เช่น 124/2569 หรือ ส.1 124/2569"
                value={receivedNumberS1}
                onChange={(e) => setReceivedNumberS1(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>ข้อมูลเลขฟ้อง ส.4</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">สารบบการยื่นฟ้อง</span>
              </label>
              <input
                type="text"
                placeholder="เช่น 45/2569 หรือ ส.4 45/2569"
                value={filingNumberS4}
                onChange={(e) => setFilingNumberS4(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          {/* Row 3: Court & Prosecutor / Duty Officer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ศาลที่ฟ้องคดี *
              </label>
              <input
                type="text"
                required
                placeholder="เช่น ศาลอาญา, ศาลจังหวัดเชียงใหม่"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>เวรชี้ / อัยการเจ้าของสำนวน</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsDutyPickerOpen(true)}
                  className="text-xs text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded-lg flex items-center gap-1 font-bold transition shadow-2xs cursor-pointer"
                  title="เปิดหน้าต่างเลือกรายชื่อเวรชี้จากไฟล์ PDF แต่ละเดือนที่อัปโหลดไว้"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>เลือกเวรชี้ (PDF)</span>
                </button>
              </div>

              {/* Quick Dropdown: populated by months from uploaded PDF rosters */}
              {monthsOfficersData.length > 0 && (
                <div className="space-y-1">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setProsecutorName(e.target.value);
                        if (!responsiblePerson || responsiblePerson === 'ผู้ดูแลสำนวน') {
                          setResponsiblePerson(e.target.value);
                        }
                      }
                    }}
                    className="w-full text-xs border border-amber-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="">— 📋 ดึงรายชื่อจากตารางเวรชี้ประจำเดือน (PDF) —</option>
                    {monthsOfficersData.map((m: any) => (
                      <optgroup key={m.monthYear} label={`📅 ตารางเวรชี้ ${m.monthNameThai} (${m.officers.length} ท่าน)`}>
                        {m.officers.map((off: any, oIdx: number) => (
                          <option key={oIdx} value={off.name}>
                            ⚖️ {off.name} ({off.role}) - เข้าเวร {off.dutyCount} วัน
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Pills: if officers are on duty on this exact filing date */}
              {onDutyOfficersOnFilingDate.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-amber-900">
                    ⚡ ตรงวันฟ้อง ({formatThaiDate(filingDate, { short: true })}):
                  </span>
                  {onDutyOfficersOnFilingDate.map((off: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setProsecutorName(off.name);
                        if (!responsiblePerson || responsiblePerson === 'ผู้ดูแลสำนวน') {
                          setResponsiblePerson(off.name);
                        }
                      }}
                      className="text-[11px] bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-semibold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                      title={`เลือก ${off.name} (${off.role})`}
                    >
                      <span>+ {off.name}</span>
                      <span className="text-[9px] text-amber-700">({off.role})</span>
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                placeholder="ชื่ออัยการเวรชี้ เช่น นายธนพล บุญเจริญ (เลือกจากตาราง PDF หรือพิมพ์)"
                value={prosecutorName}
                onChange={(e) => setProsecutorName(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          {/* Row 4: Plaintiff & Defendant */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                โจทก์
              </label>
              <input
                type="text"
                placeholder="ชื่อโจทก์ / พนักงานอัยการ"
                value={plaintiff}
                onChange={(e) => setPlaintiff(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                จำเลย
              </label>
              <input
                type="text"
                placeholder="ชื่อจำเลย"
                value={defendant}
                onChange={(e) => setDefendant(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* SECTION A: Judgment Section (Active ONLY when hasJudgment is true) */}
          {hasJudgment ? (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-amber-950 mb-1">
                    วันที่ศาลอ่านคำพิพากษา *
                  </label>
                  <input
                    type="date"
                    required
                    value={judgmentDate}
                    onChange={(e) => setJudgmentDate(e.target.value)}
                    className="w-full text-xs border border-amber-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  {judgmentDate && (
                    <span className="text-[10px] text-amber-800">
                      {formatThaiDate(judgmentDate, { short: false })}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-950 mb-1">
                    วันครบกำหนดอุทธรณ์ 1 เดือน (คำนวณอัตโนมัติ)
                  </label>
                  <div className="text-sm font-bold text-rose-700 bg-white border border-rose-300 rounded-xl px-3 py-2">
                    {deadlineInfo.deadlineDate ? formatThaiDate(deadlineInfo.deadlineDate, { short: false }) : 'กรุณาระบุวันพิพากษา'}
                  </div>
                  {deadlineInfo.isAdjustedForWeekend && (
                    <span className="text-[10px] text-amber-700 font-medium">
                      ⚡ วันครบกำหนดเดิมตรงกับวันหยุดเสาร์-อาทิตย์ กฎหมายเลื่อนเป็นวันทำการถัดไป
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผลคำพิพากษาโดยย่อ
                </label>
                <input
                  type="text"
                  placeholder="เช่น ยกฟ้อง, ลงโทษจำคุก 2 ปี ปรับ 50,000 บาท รอการลงโทษ, พิพากษาตามยอม"
                  value={judgmentOutcome}
                  onChange={(e) => setJudgmentOutcome(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="text-[11px] text-amber-900 bg-amber-100/60 p-2.5 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>หลักกฎหมาย:</strong> กำหนดเวลาอุทธรณ์ 1 เดือน นับแต่วันอ่านหรือถือว่าได้อ่านคำพิพากษา (ป.วิ.พ. มาตรา 229 / ป.วิ.อ. มาตรา 198) หากไม่ยื่นอุทธรณ์หรือขอขยายระยะเวลาอุทธรณ์ภายในกำหนดนี้ คดีจะขาดอายุความอุทธรณ์และถึงที่สุดทันที
                </span>
              </div>
            </div>
          ) : (
            /* SECTION B: Case Without Judgment (Rights Protection / Denied Plea / Next Appointments) */
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-200/80">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-700" />
                  <span className="text-xs font-bold text-indigo-950 font-['Prompt']">
                    กำหนดขั้นตอนนัดของศาลและวันนัดต่อๆ ไป (จำเลยให้การปฏิเสธ / ยังไม่มีคำพิพากษา)
                  </span>
                </div>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  ไม่บังคับใส่วันที่พิพากษา
                </span>
              </div>

              {/* Informative legal explanation */}
              <div className="p-2.5 bg-white border border-indigo-100 rounded-lg text-xs text-indigo-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <span>
                  ในชั้นฟ้องคดีหรือชั้นเวรชี้ หากจำเลยให้การปฏิเสธ ศาลจะยังไม่มีคำพิพากษา แต่จะกำหนดนัดพิจารณา เช่น <strong>นัดคุ้มครองสิทธิ</strong>, <strong>นัดพร้อม/ตรวจพยานหลักฐาน</strong> หรือ <strong>นัดสืบพยาน</strong> ระบบจึงไม่บังคับให้เลือกวันที่พิพากษา และจะเริ่มนับเวลาอุทธรณ์ 1 เดือนเมื่อคดีมีคำพิพากษาแล้วเท่านั้น
                </span>
              </div>

              {/* Quick Preset Buttons for Common Appointment Types */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                  เลือกประเภทนัดแรกอย่างรวดเร็ว:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: 'rights_protection', label: '🛡️ นัดคุ้มครองสิทธิ' },
                    { value: 'pre_trial', label: '📋 นัดพร้อม / ตรวจพยาน' },
                    { value: 'witness_examination', label: '🎙️ นัดสืบพยาน' },
                    { value: 'investigation', label: '🔍 นัดสืบเสาะ' },
                    { value: 'mediation', label: '🤝 นัดไกล่เกลี่ย' },
                    { value: 'judgment', label: '⚖️ นัดฟังคำพิพากษา' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setAppointmentType(preset.value as CourtAppointmentType)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        appointmentType === preset.value
                          ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* First Appointment Details Card */}
              <div className="bg-white p-3.5 rounded-xl border border-indigo-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>นัดแรกของสำนวน:</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ประเภทนัด *
                    </label>
                    <select
                      value={appointmentType}
                      onChange={(e) => setAppointmentType(e.target.value as CourtAppointmentType)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      {appointmentTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.icon} {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      วันที่นัดของศาล *
                    </label>
                    <input
                      type="date"
                      required
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      className="w-full text-xs border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    {appointmentDate && (
                      <span className="text-[10px] text-indigo-700 font-medium block mt-0.5">
                        {formatThaiDate(appointmentDate, { short: false })}
                      </span>
                    )}
                  </div>
                </div>

                {appointmentType === 'other' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ระบุชื่อนัดอื่นๆ *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น นัดฟังคำสั่งคำร้อง, นัดชี้สองสถาน"
                      value={appointmentTypeName}
                      onChange={(e) => setAppointmentTypeName(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      เวลานัด / รอบเวลา
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 09:00 น., 13:30 น."
                      value={appointmentTime}
                      onChange={(e) => setAppointmentTime(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ห้องพิจารณาคดี / บัลลังก์
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ห้องพิจารณา 803, บัลลังก์ 5"
                      value={appointmentCourtRoom}
                      onChange={(e) => setAppointmentCourtRoom(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    รายละเอียดหรือบันทึกของนัด
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น จำเลยให้การปฏิเสธ นัดคุ้มครองสิทธิเพื่อสอบถามความประสงค์ทนายความ"
                    value={appointmentNotes}
                    onChange={(e) => setAppointmentNotes(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Subsequent Court Appointments ("เลือกวันนัดต่อๆ ไป") */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <CalendarPlus className="w-4 h-4 text-indigo-600" />
                    <span>วันนัดต่อๆ ไปในสำนวน (ถ้ามีกำหนดไว้แล้ว):</span>
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

                {/* Quick Presets for Subsequent Hearings */}
                <div className="flex flex-wrap items-center gap-1.5 bg-indigo-100/50 p-2 rounded-lg">
                  <span className="text-[10px] font-bold text-indigo-900 mr-1">เพิ่มนัดถัดไปด่วน:</span>
                  <button
                    type="button"
                    onClick={() => handleAddSubsequentPreset('pre_trial', 'นัดพร้อม', 'นัดพร้อมตรวจพยานหลักฐาน')}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 transition"
                  >
                    + 📋 นัดพร้อม/ตรวจพยาน
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSubsequentPreset('witness_examination', 'สืบพยานโจทก์', 'นัดสืบพยานโจทก์')}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 transition"
                  >
                    + 🎙️ นัดสืบพยานโจทก์
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSubsequentPreset('witness_examination', 'สืบพยานจำเลย', 'นัดสืบพยานจำเลย')}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-orange-50 text-orange-800 border border-orange-200 transition"
                  >
                    + 🎙️ นัดสืบพยานจำเลย
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSubsequentPreset('judgment', 'ฟังคำพิพากษา', 'นัดฟังคำพิพากษาศาล')}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 transition"
                  >
                    + ⚖️ นัดฟังคำพิพากษา
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSubsequentPreset('rights_protection', 'คุ้มครองสิทธิ', 'นัดคุ้มครองสิทธิรอบสอง')}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 transition"
                  >
                    + 🛡️ คุ้มครองสิทธิ (นัด 2)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSubsequentPreset('investigation', 'สืบเสาะ', 'นัดรายงานสืบเสาะพินิจ')}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 transition"
                  >
                    + 🔍 นัดสืบเสาะ
                  </button>
                </div>

                {subsequentAppointments.length === 0 ? (
                  <div className="p-3 bg-white/70 border border-dashed border-indigo-200 rounded-xl text-center text-xs text-slate-500">
                    ยังไม่มีวันนัดถัดไปเพิ่มเติม สามารถกด <strong>"+ เพิ่มวันนัดถัดไป"</strong> เพื่อระบุวันนัดพร้อม วันสืบพยาน หรือนัดอื่นๆ ต่อจากนัดแรกได้ครับ
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {subsequentAppointments.map((appt, idx) => (
                      <div
                        key={appt.id}
                        className="bg-white p-3 rounded-xl border border-indigo-200 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          <span className="flex items-center gap-1.5 text-indigo-800">
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                            <span>นัดถัดไปลำดับที่ {idx + 2}:</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubsequentAppointment(appt.id)}
                            className="text-rose-500 hover:text-rose-700 p-0.5 text-[11px] flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>ลบนัดนี้</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5">ประเภทนัด:</span>
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
                            <span className="text-[10px] text-slate-500 block mb-0.5">วันที่นัด:</span>
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
                              <span className="text-[9px] text-indigo-700 block">
                                {formatThaiDate(appt.date)}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-500 block mb-0.5">เวลา / ห้อง:</span>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                placeholder="09:00 น."
                                value={appt.time || ''}
                                onChange={(e) =>
                                  handleUpdateSubsequentAppointment(appt.id, 'time', e.target.value)
                                }
                                className="w-1/2 text-xs border border-slate-300 rounded px-1.5 py-1"
                              />
                              <input
                                type="text"
                                placeholder="ห้องพิจารณา"
                                value={appt.courtRoom || ''}
                                onChange={(e) =>
                                  handleUpdateSubsequentAppointment(appt.id, 'courtRoom', e.target.value)
                                }
                                className="w-1/2 text-xs border border-slate-300 rounded px-1.5 py-1"
                              />
                            </div>
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
            </div>
          )}

          {/* Row 7: Assignee & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>เจ้าของสำนวน / ผู้รับผิดชอบ</span>
                {suggestedDutyOfficer && (
                  <button
                    type="button"
                    onClick={() => setResponsiblePerson(suggestedDutyOfficer)}
                    className="text-[10px] text-amber-600 hover:text-amber-800 font-medium underline"
                  >
                    ใส่ชื่อเวรชี้วันนี้ ({suggestedDutyOfficer})
                  </button>
                )}
              </label>
              <input
                type="text"
                placeholder="ชื่อนิติกร / พนักงานอัยการ / ทนายความ"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              {suggestedDutyOfficer && responsiblePerson !== suggestedDutyOfficer && (
                <span className="text-[10px] text-amber-700 block mt-1">
                  💡 แนะนำจากตารางเวรชี้: <strong className="cursor-pointer underline" onClick={() => setResponsiblePerson(suggestedDutyOfficer)}>{suggestedDutyOfficer}</strong>
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                หมายเหตุเพิ่มเติม
              </label>
              <input
                type="text"
                placeholder="บันทึกข้อความ คำสั่ง หรือเงื่อนไขเพิ่มเติม"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Google Calendar Sync Option */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <div>
                <span className="text-xs font-semibold text-slate-800 block">
                  เพิ่มการแจ้งเตือนลงใน Google Calendar
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {hasJudgment
                    ? 'เตือนก่อนวันครบกำหนดอุทธรณ์ 1 เดือน (7 วัน, 3 วัน และ 1 วัน)'
                    : 'แจ้งเตือนวันนัดของศาล (นัดคุ้มครองสิทธิ / วันนัดพิจารณา)'}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={saveToCalendar}
              onChange={(e) => setSaveToCalendar(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
            />
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{hasJudgment ? 'บันทึกสำนวนคุมอุทธรณ์ 1 เดือน' : 'บันทึกสำนวน (มีนัดคุ้มครองสิทธิ/ปฏิเสธ)'}</span>
            </button>
          </div>
        </form>

        {/* Duty Officer Picker Modal */}
        <DutyOfficerPickerModal
          isOpen={isDutyPickerOpen}
          onClose={() => setIsDutyPickerOpen(false)}
          rosters={dutyRosters}
          targetDate={filingDate}
          onSelectOfficer={(officerName) => {
            setProsecutorName(officerName);
            if (!responsiblePerson || responsiblePerson === 'ผู้ดูแลสำนวน') {
              setResponsiblePerson(officerName);
            }
          }}
          title="เลือกเวรชี้สำหรับสำนวนที่ยื่นฟ้อง"
          subtitle={`วันที่ฟ้อง: ${formatThaiDate(filingDate)}`}
        />
      </div>
    </div>
  );
};
