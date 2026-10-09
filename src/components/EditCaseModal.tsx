import React, { useState, useEffect } from 'react';
import {
  X,
  Scale,
  Calendar,
  AlertCircle,
  Check,
  Clock,
  Shield,
  Plus,
  Trash2,
  CalendarPlus,
  Info,
  Edit3,
  Save,
  UserCheck,
  CheckCircle2
} from 'lucide-react';
import { AppealCase, CourtAppointmentType, CaseAppointment, MonthlyDutyRoster, CaseCompletionReason } from '../types/appeal';
import { calculateAppealDeadline, formatThaiDate, getTodayString } from '../utils/dateUtils';
import { isJudgmentRecorded } from '../utils/appointmentUtils';
import { appointmentTypeOptions } from './CourtAppointmentModal';
import { DutyOfficerPickerModal } from './DutyOfficerPickerModal';
import { getDutyOfficersForDate, getAllOfficersGroupedByMonth } from '../services/dutyService';

interface EditCaseModalProps {
  isOpen: boolean;
  caseItem: AppealCase | null;
  onClose: () => void;
  onSave: (updatedCase: AppealCase) => void;
  suggestedDutyOfficer?: string;
  dutyRosters?: MonthlyDutyRoster[];
  existingCases?: AppealCase[];
}

export const EditCaseModal: React.FC<EditCaseModalProps> = ({
  isOpen,
  caseItem,
  onClose,
  onSave,
  suggestedDutyOfficer,
  dutyRosters = [],
  existingCases = [],
}) => {
  const [filingDate, setFilingDate] = useState<string>('');
  const [blackCaseNo, setBlackCaseNo] = useState('');
  const [redCaseNo, setRedCaseNo] = useState('');
  const [receivedNumberS1, setReceivedNumberS1] = useState('');
  const [filingNumberS4, setFilingNumberS4] = useState('');
  const [prosecutorName, setProsecutorName] = useState('');
  const [court, setCourt] = useState('');
  const [plaintiff, setPlaintiff] = useState('');
  const [defendant, setDefendant] = useState('');
  const [caseType, setCaseType] = useState('อาญา');
  const [isDutyPickerOpen, setIsDutyPickerOpen] = useState(false);

  // สำนวนที่ศาลสั่งแยกฟ้อง
  const [isSeveredCase, setIsSeveredCase] = useState(false);
  const [severedFromCaseId, setSeveredFromCaseId] = useState('');
  const [originalBlackCaseNo, setOriginalBlackCaseNo] = useState('');
  const [originalRedCaseNo, setOriginalRedCaseNo] = useState('');
  const [originalReceivedNumberS1, setOriginalReceivedNumberS1] = useState('');
  const [originalFilingNumberS4, setOriginalFilingNumberS4] = useState('');
  const [severedOrderDate, setSeveredOrderDate] = useState('');
  const [severedDeadlineDate, setSeveredDeadlineDate] = useState('');
  const [severedNotes, setSeveredNotes] = useState('');

  // Case Status: Has Judgment vs. Pending Hearings / Rights Protection / Denied Plea
  const [hasJudgment, setHasJudgment] = useState<boolean>(false);
  const [defendantPlea, setDefendantPlea] = useState<'denied' | 'confessed' | 'pending'>('denied');

  const [judgmentDate, setJudgmentDate] = useState<string>('');
  const [judgmentOutcome, setJudgmentOutcome] = useState('');
  const [hasExtension, setHasExtension] = useState<boolean>(false);
  const [extendedDeadline, setExtendedDeadline] = useState<string>('');
  const [extensionCount, setExtensionCount] = useState<number>(1);
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [notes, setNotes] = useState('');

  // สถานะเสร็จสิ้นสำนวน & วันที่เสร็จสิ้น
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [completedDate, setCompletedDate] = useState<string>('');
  const [completionReason, setCompletionReason] = useState<CaseCompletionReason>('appealed');

  // สำนวนเบิกฟ้อง
  const [isRequisitionCase, setIsRequisitionCase] = useState(false);
  const [requisitionDate, setRequisitionDate] = useState('');
  const [requisitionNotes, setRequisitionNotes] = useState('');

  // Primary Court Appointment (เช่น นัดคุ้มครองสิทธิ)
  const [appointmentType, setAppointmentType] = useState<CourtAppointmentType>('rights_protection');
  const [appointmentTypeName, setAppointmentTypeName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('09:00 น.');
  const [appointmentCourtRoom, setAppointmentCourtRoom] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  // Subsequent / Next Court Appointments ("วันนัดต่อๆ ไป")
  const [subsequentAppointments, setSubsequentAppointments] = useState<CaseAppointment[]>([]);

  // Duty officers for filing date & grouped by month from uploaded PDF rosters
  const onDutyOfficersOnFilingDate = React.useMemo(() => {
    if (!filingDate || !dutyRosters.length) return [];
    return getDutyOfficersForDate(dutyRosters, filingDate);
  }, [dutyRosters, filingDate]);

  const monthsOfficersData = React.useMemo(() => {
    return getAllOfficersGroupedByMonth(dutyRosters);
  }, [dutyRosters]);

  // Auto-calculated 1-month appeal deadline
  const [deadlineInfo, setDeadlineInfo] = useState({
    deadlineDate: '',
    originalDeadline: '',
    isAdjustedForWeekend: false,
  });

  useEffect(() => {
    if (caseItem && isOpen) {
      setFilingDate(caseItem.filingDate || getTodayString());
      setBlackCaseNo(caseItem.blackCaseNo || '');
      setRedCaseNo(caseItem.redCaseNo || '');
      setReceivedNumberS1(caseItem.receivedNumberS1 || '');
      setFilingNumberS4(caseItem.filingNumberS4 || '');
      setProsecutorName(caseItem.prosecutorName || '');
      setCourt(caseItem.court || 'ศาลจังหวัดเพชรบุรี');
      setPlaintiff(caseItem.plaintiff || '');
      setDefendant(caseItem.defendant || '');
      setCaseType(caseItem.caseType || 'อาญา');

      const isReq = Boolean(caseItem.isRequisitionCase || caseItem.appointmentType === 'requisition');
      setIsRequisitionCase(isReq);
      setRequisitionDate(caseItem.requisitionDate || (caseItem.appointmentType === 'requisition' ? caseItem.appointmentDate : '') || '');
      setRequisitionNotes(caseItem.requisitionNotes || '');

      // สำนวนที่ศาลแยกฟ้อง
      setIsSeveredCase(Boolean(caseItem.isSeveredCase));
      setSeveredFromCaseId(caseItem.severedFromCaseId || '');
      setOriginalBlackCaseNo(caseItem.originalBlackCaseNo || '');
      setOriginalRedCaseNo(caseItem.originalRedCaseNo || '');
      setOriginalReceivedNumberS1(caseItem.originalReceivedNumberS1 || '');
      setOriginalFilingNumberS4(caseItem.originalFilingNumberS4 || '');
      setSeveredOrderDate(caseItem.severedOrderDate || '');
      setSeveredDeadlineDate(caseItem.severedDeadlineDate || '');
      setSeveredNotes(caseItem.severedNotes || '');

      const caseHasJudgment = isJudgmentRecorded(caseItem);
      setHasJudgment(caseHasJudgment);
      setDefendantPlea(caseItem.defendantPlea || (caseHasJudgment ? 'confessed' : (isReq ? 'pending' : 'denied')));

      setJudgmentDate(caseHasJudgment ? (caseItem.judgmentDate || '') : '');
      setJudgmentOutcome(caseHasJudgment ? (caseItem.judgmentOutcome || '') : '');
      setHasExtension(Boolean(caseItem.extendedDeadline));
      setExtendedDeadline(caseItem.extendedDeadline || '');
      setExtensionCount(caseItem.extensionCount || 1);
      setResponsiblePerson(caseItem.responsiblePerson || '');
      setNotes(caseItem.notes || '');

      setIsCompleted(Boolean(caseItem.isCompleted));
      setCompletedDate(caseItem.completedDate || (caseItem.isCompleted ? getTodayString() : ''));
      setCompletionReason(caseItem.completionReason || 'appealed');

      setAppointmentType(caseItem.appointmentType || (caseHasJudgment ? 'none' : (isReq ? 'requisition' : 'rights_protection')));
      setAppointmentTypeName(caseItem.appointmentTypeName || '');
      setAppointmentDate(caseItem.appointmentDate || '');
      setAppointmentTime(caseItem.appointmentTime || '09:00 น.');
      setAppointmentCourtRoom(caseItem.appointmentCourtRoom || '');
      setAppointmentNotes(caseItem.appointmentNotes || '');

      setSubsequentAppointments(caseItem.subsequentAppointments || []);
    }
  }, [caseItem, isOpen]);

  useEffect(() => {
    if (judgmentDate && hasJudgment) {
      const info = calculateAppealDeadline(judgmentDate);
      setDeadlineInfo(info);
    } else {
      setDeadlineInfo({ deadlineDate: '', originalDeadline: '', isAdjustedForWeekend: false });
    }
  }, [judgmentDate, hasJudgment]);

  if (!isOpen || !caseItem) return null;

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
  const handleAddSubsequentPreset = (type: CourtAppointmentType, label: string, defaultNote: string) => {
    const newAppt: CaseAppointment = {
      id: `appt_${Date.now()}_${subsequentAppointments.length + 1}`,
      type,
      typeName: type === 'other' ? label : undefined,
      date: '',
      time: appointmentTime || '09:00 น.',
      courtRoom: appointmentCourtRoom || '',
      notes: defaultNote,
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
      if (!judgmentOutcome.trim()) {
        alert('กรุณากรอกผลคำพิพากษาโดยย่อ (เช่น ลงโทษจำคุก, ปรับ, รอการลงโทษ, ยกฟ้อง) หากศาลยังไม่อ่านคำพิพากษา หรือยังไม่ทราบผลคำพิพากษา กรุณาเอาเครื่องหมายถูกออกจากช่อง "ศาลมีคำพิพากษาแล้ว"');
        return;
      }
    } else {
      // Pending trial / rights protection / denied plea
      if (appointmentType !== 'none' && !appointmentDate) {
        alert('กรุณาระบุวันที่นัดของศาล (เช่น วันนัดคุ้มครองสิทธิ หรือวันนัดแรก)');
        return;
      }
    }

    const updatedCase: AppealCase = {
      ...caseItem,
      filingDate,
      blackCaseNo: blackCaseNo.trim(),
      redCaseNo: redCaseNo.trim() || undefined,
      receivedNumberS1: receivedNumberS1.trim() || undefined,
      filingNumberS4: filingNumberS4.trim() || undefined,
      prosecutorName: prosecutorName.trim() || undefined,
      court: court.trim(),
      plaintiff: plaintiff.trim(),
      defendant: defendant.trim(),
      caseType,
      hasJudgment,
      defendantPlea: hasJudgment
        ? (caseItem.defendantPlea === 'denied' ? 'denied' : 'confessed')
        : (isRequisitionCase || appointmentType === 'requisition' ? 'pending' : defendantPlea),
      judgmentDate: hasJudgment && judgmentDate ? judgmentDate : undefined,
      appealDeadline: hasJudgment && deadlineInfo.deadlineDate ? deadlineInfo.deadlineDate : (hasJudgment ? caseItem.appealDeadline : undefined),
      extendedDeadline: hasJudgment && hasExtension && extendedDeadline ? extendedDeadline : undefined,
      extensionCount: hasJudgment && hasExtension && extendedDeadline ? extensionCount : undefined,
      judgmentOutcome: hasJudgment
        ? judgmentOutcome.trim()
        : (isRequisitionCase || appointmentType === 'requisition')
          ? (judgmentOutcome.trim() || 'สำนวนเบิกฟ้อง (รอเบิกตัวมาฟ้อง / ยังไม่ทราบคำให้การ)')
          : (appointmentType !== 'none'
            ? `อยู่ระหว่าง${appointmentType === 'rights_protection' ? 'นัดคุ้มครองสิทธิ' : 'นัดพิจารณา'} (${defendantPlea === 'denied' ? 'จำเลยให้การปฏิเสธ' : 'รอคำให้การ'})`
            : judgmentOutcome),
      responsiblePerson: responsiblePerson.trim() || 'ผู้ดูแลสำนวน',
      notes: notes.trim() || undefined,
      isCompleted,
      completedDate: isCompleted ? (completedDate || getTodayString()) : undefined,
      completionReason: isCompleted ? completionReason : undefined,
      isRequisitionCase: isRequisitionCase || appointmentType === 'requisition',
      requisitionDate: isRequisitionCase ? (requisitionDate || appointmentDate || undefined) : (appointmentType === 'requisition' ? appointmentDate : undefined),
      requisitionNotes: requisitionNotes.trim() || undefined,

      // สำนวนที่ศาลแยกฟ้อง
      isSeveredCase,
      severedFromCaseId: isSeveredCase ? (severedFromCaseId || undefined) : undefined,
      originalBlackCaseNo: isSeveredCase ? (originalBlackCaseNo.trim() || undefined) : undefined,
      originalRedCaseNo: isSeveredCase ? (originalRedCaseNo.trim() || undefined) : undefined,
      originalReceivedNumberS1: isSeveredCase ? (originalReceivedNumberS1.trim() || undefined) : undefined,
      originalFilingNumberS4: isSeveredCase ? (originalFilingNumberS4.trim() || undefined) : undefined,
      severedOrderDate: isSeveredCase ? (severedOrderDate || undefined) : undefined,
      severedDeadlineDate: isSeveredCase ? (severedDeadlineDate || undefined) : undefined,
      severedNotes: isSeveredCase ? (severedNotes.trim() || undefined) : undefined,

      appointmentType: (hasJudgment || defendantPlea === 'confessed') && appointmentType === 'rights_protection' ? 'none' : appointmentType,
      appointmentTypeName: appointmentType === 'other' ? appointmentTypeName.trim() : undefined,
      appointmentDate: ((hasJudgment || defendantPlea === 'confessed') && appointmentType === 'rights_protection') ? undefined : (appointmentType !== 'none' && appointmentDate ? appointmentDate : undefined),
      appointmentTime: appointmentTime || undefined,
      appointmentCourtRoom: appointmentCourtRoom.trim() || undefined,
      appointmentNotes: appointmentNotes.trim() || undefined,
      subsequentAppointments: (hasJudgment || defendantPlea === 'confessed')
        ? subsequentAppointments.filter((a) => a.type !== 'rights_protection')
        : (subsequentAppointments.length > 0 ? subsequentAppointments : undefined),
      updatedAt: new Date().toISOString(),
    };

    onSave(updatedCase);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden my-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base font-['Prompt'] text-white">
                แก้ไข / เพิ่มเติมข้อมูลสำนวนคดี
              </h3>
              <p className="text-xs text-slate-300">
                คดีดำ {caseItem.blackCaseNo} {caseItem.redCaseNo ? `(แดง ${caseItem.redCaseNo})` : ''} • ฟ้องวันที่ {formatThaiDate(caseItem.filingDate)}
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
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span>สถานะสำนวนในการพิจารณาของศาล:</span>
              </span>
              <span className="text-[11px] font-normal text-slate-500">เลือกสถานะของสำนวน</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {/* Option 1: จำเลยรับสารภาพ */}
              <button
                type="button"
                onClick={() => {
                  setIsSeveredCase(false);
                  setDefendantPlea('confessed');
                  setIsRequisitionCase(false);
                  if (appointmentType === 'rights_protection' || appointmentType === 'requisition') {
                    setAppointmentType('none');
                    setAppointmentDate('');
                  }
                }}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                  !isSeveredCase && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'confessed'
                    ? 'border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500/20 text-emerald-950 font-medium'
                    : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border mt-0.5 shrink-0 ${
                  !isSeveredCase && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'confessed'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300'
                }`}>
                  {!isSeveredCase && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'confessed' && (
                    <Check className="w-3 h-3" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold block leading-tight">
                    🟢 จำเลยรับสารภาพ
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-tight">
                    {hasJudgment ? 'ศาลอ่านคำพิพากษาแล้ว (คุมอุทธรณ์ 1 ด.)' : 'ยังไม่กรอกคำพิพากษา / รอศาลพิพากษา'}
                  </span>
                </div>
              </button>

              {/* Option 2: คุ้มครองสิทธิ */}
              <button
                type="button"
                onClick={() => {
                  setIsSeveredCase(false);
                  setHasJudgment(false);
                  setDefendantPlea('denied');
                  setIsRequisitionCase(false);
                  if (appointmentType === 'none' || appointmentType === 'requisition') {
                    setAppointmentType('rights_protection');
                  }
                }}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                  !isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && (defendantPlea === 'denied' || appointmentType === 'rights_protection')
                    ? 'border-indigo-500 bg-indigo-50/90 ring-2 ring-indigo-500/20 text-indigo-950 font-medium'
                    : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border mt-0.5 shrink-0 ${
                  !isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && (defendantPlea === 'denied' || appointmentType === 'rights_protection')
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-300'
                }`}>
                  {!isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && (defendantPlea === 'denied' || appointmentType === 'rights_protection') && (
                    <Check className="w-3 h-3" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold block leading-tight">
                    🛡️ คุ้มครองสิทธิ
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-tight">
                    จำเลยปฏิเสธ • กำหนดวันนัดต่อๆ ไป
                  </span>
                </div>
              </button>

              {/* Option 3: สำนวนเบิกฟ้อง (ยังไม่ทราบว่ารับสารภาพหรือปฏิเสธ) */}
              <button
                type="button"
                onClick={() => {
                  setIsSeveredCase(false);
                  setHasJudgment(false);
                  setDefendantPlea('pending');
                  setIsRequisitionCase(true);
                  setAppointmentType('requisition');
                  if (!requisitionDate && appointmentDate) {
                    setRequisitionDate(appointmentDate);
                  } else if (!requisitionDate) {
                    setRequisitionDate(getTodayString());
                  }
                }}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                  !isSeveredCase && (isRequisitionCase || appointmentType === 'requisition')
                    ? 'border-orange-500 bg-orange-50/90 ring-2 ring-orange-500/20 text-orange-950 font-medium'
                    : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border mt-0.5 shrink-0 ${
                  !isSeveredCase && (isRequisitionCase || appointmentType === 'requisition')
                    ? 'border-orange-600 bg-orange-600 text-white'
                    : 'border-slate-300'
                }`}>
                  {!isSeveredCase && (isRequisitionCase || appointmentType === 'requisition') && (
                    <Check className="w-3 h-3" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold block leading-tight text-orange-950">
                    🚚 สำนวนเบิกฟ้อง (รอเบิกตัว)
                  </span>
                  <span className="text-[11px] text-orange-800/80 block mt-0.5 leading-tight">
                    ยังไม่ทราบคำให้การ • แจ้งเตือนวันเบิกฟ้อง
                  </span>
                </div>
              </button>

              {/* Option 4: อื่นๆ / ยังไม่ทราบผล */}
              <button
                type="button"
                onClick={() => {
                  setIsSeveredCase(false);
                  setHasJudgment(false);
                  setDefendantPlea('pending');
                  setIsRequisitionCase(false);
                  if (appointmentType === 'rights_protection' || appointmentType === 'requisition') {
                    setAppointmentType('other');
                  }
                }}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                  !isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'pending' && appointmentType !== 'rights_protection'
                    ? 'border-sky-500 bg-sky-50/90 ring-2 ring-sky-500/20 text-sky-950 font-medium'
                    : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border mt-0.5 shrink-0 ${
                  !isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'pending' && appointmentType !== 'rights_protection'
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300'
                }`}>
                  {!isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'pending' && appointmentType !== 'rights_protection' && (
                    <Check className="w-3 h-3" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold block leading-tight">
                    📋 อื่นๆ / ยังไม่ทราบผล
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-tight">
                    ยังไม่ทราบคำให้การ • รอผลการพิจารณา
                  </span>
                </div>
              </button>

              {/* Option 5: สำนวนที่ศาลแยกฟ้อง */}
              <button
                type="button"
                onClick={() => {
                  setIsSeveredCase(true);
                  setHasJudgment(false);
                  setDefendantPlea('denied');
                  setIsRequisitionCase(false);
                  if (appointmentType === 'none' || appointmentType === 'requisition') {
                    setAppointmentType('pre_trial');
                  }
                }}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                  isSeveredCase
                    ? 'border-purple-500 bg-purple-50/90 ring-2 ring-purple-500/20 text-purple-950 font-medium'
                    : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border mt-0.5 shrink-0 ${
                  isSeveredCase
                    ? 'border-purple-600 bg-purple-600 text-white'
                    : 'border-slate-300'
                }`}>
                  {isSeveredCase && <Check className="w-3 h-3" />}
                </div>
                <div>
                  <span className="text-xs font-bold block leading-tight text-purple-950">
                    ✂️ สำนวนที่ศาลแยกฟ้อง
                  </span>
                  <span className="text-[11px] text-purple-800/80 block mt-0.5 leading-tight">
                    ศาลสั่งแยกฟ้อง • เชื่อมโยง ส.1 / ส.4
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* ข้อมูลสำนวนที่ศาลสั่งแยกฟ้อง (เชื่อมโยง ส.1 และ ส.4) */}
          {isSeveredCase && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3.5 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    ✂️
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-purple-950">
                      ข้อมูลสำนวนที่ศาลสั่งแยกฟ้อง (เชื่อมโยง ส.1 และ ส.4)
                    </h4>
                    <p className="text-[11px] text-purple-800/80">
                      กรอกเลข ส.1 และ ส.4 เพื่อให้ระบบค้นหาและแสดงผลเชื่อมโยงกับสำนวนเดิมโดยอัตโนมัติ
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  คดีแยกฟ้อง
                </span>
              </div>

              {/* เลือกสำนวนเดิมจากระบบเพื่อดึงข้อมูล ส.1, ส.4 และเลขคดีดำเดิมอัตโนมัติ */}
              {existingCases && existingCases.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1 flex items-center justify-between">
                    <span>🔗 เลือกสำนวนเดิมในระบบที่ศาลสั่งแยกฟ้อง (ช่วยกรอกข้อมูลอัตโนมัติ)</span>
                    <span className="text-[10px] text-purple-700 font-normal">เลือกเพื่อดึงข้อมูล หรือพิมพ์เองด้านล่าง</span>
                  </label>
                  <select
                    value={severedFromCaseId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setSeveredFromCaseId(selId);
                      const parent = existingCases.find((c) => c.id === selId);
                      if (parent) {
                        setOriginalBlackCaseNo(parent.blackCaseNo);
                        setOriginalRedCaseNo(parent.redCaseNo || '');
                        if (!receivedNumberS1) setReceivedNumberS1(parent.receivedNumberS1 || '');
                        if (!filingNumberS4) setFilingNumberS4(parent.filingNumberS4 || '');
                        if (!originalReceivedNumberS1) setOriginalReceivedNumberS1(parent.receivedNumberS1 || '');
                        if (!originalFilingNumberS4) setOriginalFilingNumberS4(parent.filingNumberS4 || '');
                      }
                    }}
                    className="w-full text-xs border border-purple-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="">-- เลือกสำนวนคดีเดิม (หรือเว้นว่างเพื่อพิมพ์เอง) --</option>
                    {existingCases.filter((c) => c.id !== caseItem.id).map((c) => (
                      <option key={c.id} value={c.id}>
                        ดำ {c.blackCaseNo} {c.redCaseNo ? `(แดง ${c.redCaseNo})` : ''} - {c.defendant} {c.receivedNumberS1 ? `[ส.1: ${c.receivedNumberS1}]` : ''} {c.filingNumberS4 ? `[ส.4: ${c.filingNumberS4}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1">
                    หมายเลขคดีดำเดิมที่ศาลสั่งแยกฟ้อง *
                  </label>
                  <input
                    type="text"
                    required={isSeveredCase}
                    placeholder="เช่น อ.120/2569"
                    value={originalBlackCaseNo}
                    onChange={(e) => setOriginalBlackCaseNo(e.target.value)}
                    className="w-full text-xs border border-purple-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                  <p className="text-[10px] text-purple-700 mt-1">
                    เมื่อค้นหาเลขคดีดำเดิมนี้ ระบบจะค้นพบสำนวนนี้ด้วย
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1">
                    หมายเลขคดีแดงเดิม (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น อ.234/2569 (ถ้าศาลมีคำพิพากษาบางส่วน)"
                    value={originalRedCaseNo}
                    onChange={(e) => setOriginalRedCaseNo(e.target.value)}
                    className="w-full text-xs border border-purple-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1 flex items-center justify-between">
                    <span>ข้อมูลเลขรับ ส.1 (สารบบรับสำนวน) *</span>
                    <span className="text-[10px] text-purple-700 font-semibold bg-purple-100 px-1.5 py-0.2 rounded">
                      🔗 เลขเชื่อมโยง
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น 124/2569 หรือ ส.1 124/2569"
                    value={receivedNumberS1}
                    onChange={(e) => setReceivedNumberS1(e.target.value)}
                    className="w-full text-xs border border-purple-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-bold text-slate-800"
                  />
                  <p className="text-[10px] text-purple-700 mt-1">
                    ใช้ค้นหาสำนวนที่เชื่อมโยงกันด้วยเลข ส.1
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1 flex items-center justify-between">
                    <span>ข้อมูลเลขฟ้อง ส.4 (สารบบการยื่นฟ้อง) *</span>
                    <span className="text-[10px] text-purple-700 font-semibold bg-purple-100 px-1.5 py-0.2 rounded">
                      🔗 เลขเชื่อมโยง
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น 45/2569 หรือ ส.4 45/2569"
                    value={filingNumberS4}
                    onChange={(e) => setFilingNumberS4(e.target.value)}
                    className="w-full text-xs border border-purple-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-bold text-slate-800"
                  />
                  <p className="text-[10px] text-purple-700 mt-1">
                    ใช้ค้นหาสำนวนที่เชื่อมโยงกันด้วยเลข ส.4
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1">
                    วันที่ศาลสั่งแยกฟ้อง
                  </label>
                  <input
                    type="date"
                    value={severedOrderDate}
                    onChange={(e) => setSeveredOrderDate(e.target.value)}
                    className="w-full text-xs border border-purple-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-900 mb-1">
                    กำหนดเวลายื่นฟ้องใหม่ตามคำสั่งศาล
                  </label>
                  <input
                    type="date"
                    value={severedDeadlineDate}
                    onChange={(e) => setSeveredDeadlineDate(e.target.value)}
                    className="w-full text-xs border border-purple-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-900 mb-1">
                  หมายเหตุ / เหตุผลที่ศาลสั่งแยกฟ้อง
                </label>
                <input
                  type="text"
                  placeholder="เช่น จำเลยที่ 2 ให้การปฏิเสธ ศาลสั่งให้พนักงานอัยการแยกฟ้องภายใน 15 วัน"
                  value={severedNotes}
                  onChange={(e) => setSeveredNotes(e.target.value)}
                  className="w-full text-xs border border-purple-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

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
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
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
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
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
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>หมายเลขคดีแดง</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {hasJudgment ? 'จำเป็นเมื่อมีคำพิพากษา' : 'ไม่บังคับ (ยังไม่มีคำพิพากษา/จำเลยปฏิเสธ)'}
                </span>
              </label>
              <input
                type="text"
                placeholder={hasJudgment ? 'เช่น อ.891/2569' : 'ไม่บังคับ (รอกำหนดเมื่อศาลมีคำพิพากษา)'}
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

          {/* Row 3: Court & Case Owner Prosecutor (อัยการเจ้าของสำนวน - เด่นชัดเจน) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ศาลที่ฟ้องคดี *
              </label>
              <input
                type="text"
                required
                placeholder="เช่น ศาลจังหวัดเพชรบุรี, ศาลแขวงเพชรบุรี"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            {/* อัยการเจ้าของสำนวน (ผู้รับผิดชอบสำนวนหลัก - ปรับให้ชัดเจน เด่นชัด) */}
            <div className="bg-indigo-50/80 p-3 rounded-xl border-2 border-indigo-300 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <span className="text-sm">👔</span>
                  <span className="font-['Prompt']">อัยการเจ้าของสำนวน *</span>
                </label>
                <span className="text-[10px] text-indigo-800 bg-indigo-100 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  ผู้รับผิดชอบสำนวนหลัก
                </span>
              </div>
              <input
                type="text"
                required
                placeholder="ชื่ออัยการเจ้าของสำนวน เช่น นายธนพล บุญเจริญ"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                className="w-full text-xs border border-indigo-300 rounded-lg px-2.5 py-1.5 bg-white text-indigo-950 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
              <p className="text-[10px] text-indigo-700">
                ระบุชื่อพนักงานอัยการเจ้าของสำนวนผู้รับผิดชอบคดีนี้โดยตรง
              </p>
            </div>
          </div>

          {/* อัยการเวรชี้ (ข้อมูลตรงเวรชี้ ไม่ต้องเด่นมาก แยกบทบาทชัดเจน) */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-2 text-slate-700">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-['Prompt']">อัยการเวรชี้ (เวรศาลประจำวัน)</span>
              </label>
              <button
                type="button"
                onClick={() => setIsDutyPickerOpen(true)}
                className="text-[11px] text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition shadow-2xs cursor-pointer"
                title="เปิดหน้าต่างเลือกรายชื่ออัยการเวรชี้จากไฟล์ PDF แต่ละเดือนที่อัปโหลดไว้"
              >
                <UserCheck className="w-3 h-3 text-slate-500" />
                <span>เลือกอัยการเวรชี้ (PDF)</span>
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
                      // Do not overwrite responsiblePerson (อัยการเจ้าของสำนวน)
                    }
                  }}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-normal focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
                >
                  <option value="">— 📋 ดึงรายชื่อจากตารางอัยการเวรชี้ประจำเดือน (PDF) —</option>
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
                <span className="text-[10px] text-slate-500">
                  ตรงวันฟ้อง ({formatThaiDate(filingDate, { short: true })}):
                </span>
                {onDutyOfficersOnFilingDate.map((off: any, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setProsecutorName(off.name);
                      // Do not overwrite responsiblePerson
                    }}
                    className="text-[11px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-normal transition flex items-center gap-1 shadow-2xs cursor-pointer"
                    title={`เลือก ${off.name} (${off.role})`}
                  >
                    <span>+ {off.name}</span>
                    <span className="text-[9px] text-slate-400">({off.role})</span>
                  </button>
                ))}
              </div>
            )}

            <input
              type="text"
              placeholder="ชื่ออัยการเวรชี้ เช่น นายสมคิด ยุติธรรม (เลือกจากตาราง PDF หรือพิมพ์)"
              value={prosecutorName}
              onChange={(e) => setProsecutorName(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-slate-300 font-normal"
            />
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

          {/* SECTION A: Judgment Section */}
          <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasJudgment}
                onChange={(e) => {
                  const val = e.target.checked;
                  setHasJudgment(val);
                  if (!val) {
                    setJudgmentDate('');
                    setJudgmentOutcome('');
                  } else if (!judgmentDate) {
                    setJudgmentDate(getTodayString());
                  }
                }}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800">
                {hasJudgment
                  ? 'ศาลมีคำพิพากษาแล้ว (กรอกวันและผลคำพิพากษาด้านล่าง เพื่อเริ่มคุมระยะเวลาอุทธรณ์ 1 เดือน)'
                  : 'สำนวนนี้ยังไม่กรอกคำพิพากษา / ศาลยังไม่อ่านคำพิพากษา (ติ๊กถูกหากต้องการกรอกคำพิพากษา)'}
              </span>
            </label>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${hasJudgment ? 'bg-emerald-200 text-emerald-900 font-bold' : 'bg-slate-200 text-slate-700'}`}>
              {hasJudgment ? 'กรอกคำพิพากษาแล้ว' : 'ยังไม่กรอกคำพิพากษา'}
            </span>
          </div>

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
                    className="w-full text-xs border border-amber-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
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

              {/* การขยายระยะเวลาอุทธรณ์ */}
              <div className="pt-3 border-t border-amber-200/80">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasExtension}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHasExtension(checked);
                        if (checked && !extendedDeadline) {
                          try {
                            const baseDate = deadlineInfo.deadlineDate || judgmentDate || getTodayString();
                            const [y, m, d] = baseDate.split('-').map(Number);
                            const dt = new Date(y, m - 1, d);
                            dt.setDate(dt.getDate() + 30);
                            setExtendedDeadline(dt.toISOString().slice(0, 10));
                          } catch {
                            setExtendedDeadline('');
                          }
                        }
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>มีการขอขยายระยะเวลาอุทธรณ์ (แก้ไขวันที่ขยายเวลาได้ที่นี่)</span>
                    </span>
                  </label>
                  {hasExtension && (
                    <span className="text-[10px] text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                      ขยายครั้งที่ {extensionCount}
                    </span>
                  )}
                </div>

                {hasExtension && (
                  <div className="bg-white/90 p-3 rounded-xl border border-amber-300 space-y-3 mt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          วันครบกำหนดที่ขอขยายเวลา *
                        </label>
                        <input
                          type="date"
                          required={hasExtension}
                          value={extendedDeadline}
                          onChange={(e) => setExtendedDeadline(e.target.value)}
                          className="w-full text-xs border border-amber-300 rounded-xl px-3 py-2 bg-amber-50/20 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold text-rose-800"
                        />
                        {extendedDeadline && (
                          <span className="text-[10px] text-rose-700 font-bold block mt-1">
                            วันครบกำหนดใหม่: {formatThaiDate(extendedDeadline, { short: false })}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          ขยายเวลาครั้งที่
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={extensionCount}
                          onChange={(e) => setExtensionCount(parseInt(e.target.value, 10) || 1)}
                          className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-amber-900 bg-amber-100/60 p-2.5 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>หลักกฎหมาย:</strong> กำหนดเวลาอุทธรณ์ 1 เดือน นับแต่วันอ่านคำพิพากษา (ป.วิ.พ. 229 / ป.วิ.อ. 198)
                </span>
              </div>
            </div>
          ) : (
            /* SECTION B: Case Without Judgment (Rights Protection / Denied Plea / Next Appointments) */
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-200/80">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-700" />
                  <span className="text-xs font-bold text-indigo-950 font-['Prompt']">
                    กำหนดขั้นตอนนัดของศาลและเลือกวันนัดต่อๆ ไปแทน (จำเลยให้การปฏิเสธ)
                  </span>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  ไม่บังคับใส่วันที่พิพากษา
                </span>
              </div>

              {/* Informative notice */}
              <div className="p-2.5 bg-white border border-indigo-100 rounded-lg text-xs text-indigo-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <span>
                  จำเลยให้การปฏิเสธ: ศาลยังไม่มีคำพิพากษาในวันฟ้อง ระบบจึงไม่บังคับให้ต้องเลือกวันที่พิพากษา (ยังไม่เริ่มนับกำหนดเวลาอุทธรณ์ 1 เดือน) โดยเปลี่ยนเป็นให้กำหนดนัดคุ้มครองสิทธิและเลือกวันนัดต่อๆ ไปแทน เมื่อศาลมีคำพิพากษาในอนาคต จึงค่อยมาระบุวันพิพากษาเพื่อเริ่มนับระยะเวลาอุทธรณ์ 1 เดือน
                </span>
              </div>

              {/* Quick Preset Buttons for Primary Appointment */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                  เลือกประเภทนัดแรกอย่างรวดเร็ว:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: 'rights_protection', label: '🛡️ นัดคุ้มครองสิทธิ' },
                    { value: 'requisition', label: '🚚 สำนวนเบิกฟ้อง' },
                    { value: 'pre_trial', label: '📋 นัดพร้อม / ตรวจพยาน' },
                    { value: 'witness_examination', label: '🎙️ นัดสืบพยาน' },
                    { value: 'investigation', label: '🔍 นัดสืบเสาะ' },
                    { value: 'mediation', label: '🤝 นัดไกล่เกลี่ย' },
                    { value: 'judgment', label: '⚖️ นัดฟังคำพิพากษา' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        setAppointmentType(preset.value as CourtAppointmentType);
                        if (preset.value === 'requisition') {
                          setIsRequisitionCase(true);
                        }
                      }}
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

              {/* Primary Appointment Details */}
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
                      className="w-full text-xs border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
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
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
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
                  <div className="p-3 bg-white/80 border border-dashed border-indigo-200 rounded-xl text-center text-xs text-slate-500">
                    ยังไม่มีวันนัดถัดไปเพิ่มเติม สามารถกดปุ่มเพิ่มนัดด่วนด้านบน หรือกด <strong>"+ เพิ่มวันนัดถัดไป"</strong> เพื่อระบุวันนัดพร้อม วันสืบพยาน หรือนัดอื่นๆ ได้ครับ
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
                              className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white font-medium"
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
                              className="w-full text-xs border border-slate-300 rounded px-2 py-1 font-medium"
                            />
                            {appt.date && (
                              <span className="text-[9px] text-indigo-700 block mt-0.5">
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

          {/* สำนวนเบิกฟ้อง & หมายเหตุเพิ่มเติม */}
          <div className="space-y-3">
            <div className={`p-3.5 rounded-xl border transition ${isRequisitionCase ? 'bg-orange-50/90 border-orange-300 ring-1 ring-orange-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRequisitionCase}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsRequisitionCase(checked);
                      if (checked) {
                        setDefendantPlea('pending');
                        if (!requisitionDate && appointmentDate) {
                          setRequisitionDate(appointmentDate);
                        }
                      }
                    }}
                    className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                  />
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-['Prompt']">
                    <span>🚚 สำนวนเบิกฟ้อง</span>
                    <span className="text-[10px] bg-orange-100 text-orange-800 font-semibold px-2 py-0.5 rounded-full border border-orange-200">
                      ระบบจะคอยแจ้งเตือนเมื่อใกล้ถึงวันเบิกฟ้อง
                    </span>
                  </span>
                </label>
              </div>

              {isRequisitionCase && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-orange-200/80 animate-in fade-in">
                  <div>
                    <label className="block text-[11px] font-semibold text-orange-950 mb-1">
                      วันที่เบิกฟ้อง *
                    </label>
                    <input
                      type="date"
                      required={isRequisitionCase}
                      value={requisitionDate || appointmentDate}
                      onChange={(e) => {
                        setRequisitionDate(e.target.value);
                        if (!appointmentDate) setAppointmentDate(e.target.value);
                      }}
                      className="w-full text-xs border border-orange-300 rounded-lg px-2.5 py-1.5 bg-white text-orange-950 font-medium focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-orange-950 mb-1">
                      หมายเหตุการเบิกฟ้อง
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น เบิกตัวจำเลยจากเรือนจำ, ขอหมายเบิกตัว"
                      value={requisitionNotes}
                      onChange={(e) => setRequisitionNotes(e.target.value)}
                      className="w-full text-xs border border-orange-300 rounded-lg px-2.5 py-1.5 bg-white text-orange-950 focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
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

            {/* สถานะเสร็จสิ้นสำนวน & วันที่เสร็จสิ้น */}
            <div className={`p-4 rounded-xl border transition space-y-3 ${
              isCompleted
                ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-300'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsCompleted(checked);
                      if (checked && !completedDate) {
                        setCompletedDate(getTodayString());
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-['Prompt']">
                      <span>✅ บันทึกสถานะ "เสร็จสิ้นสำนวน"</span>
                      {isCompleted && (
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                          หยุดแจ้งเตือนแล้ว
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      ยื่นอุทธรณ์แล้ว หรือยุติการดำเนินคดี (ระบบจะไม่นำสำนวนนี้มาแจ้งเตือนเตือนภัยอีก)
                    </span>
                  </div>
                </label>
              </div>

              {isCompleted && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-emerald-200/80 animate-in fade-in">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                      วันที่ดำเนินการเสร็จสิ้น *
                    </label>
                    <input
                      type="date"
                      required={isCompleted}
                      value={completedDate}
                      onChange={(e) => setCompletedDate(e.target.value)}
                      className="w-full text-xs border border-emerald-300 rounded-lg px-2.5 py-1.5 bg-white text-emerald-950 font-bold focus:ring-2 focus:ring-emerald-500"
                    />
                    {completedDate && (
                      <span className="text-[10px] text-emerald-700 block mt-0.5 font-medium">
                        {formatThaiDate(completedDate)}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                      ผลการดำเนินการ / เหตุผลที่เสร็จสิ้น
                    </label>
                    <select
                      value={completionReason}
                      onChange={(e) => setCompletionReason(e.target.value as CaseCompletionReason)}
                      className="w-full text-xs border border-emerald-300 rounded-lg px-2.5 py-1.5 bg-white text-emerald-950 font-medium focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="appealed">ยื่นอุทธรณ์ต่อศาลเรียบร้อยแล้ว</option>
                      <option value="no_appeal">มีคำสั่งไม่อุทธรณ์ / ยุติการดำเนินคดี</option>
                      <option value="finalized">คดีถึงที่สุดตามคำพิพากษาศาลชั้นต้น</option>
                      <option value="settled">คู่ความตกลงยอมความหรือชำระหนี้ครบถ้วนแล้ว</option>
                      <option value="other">อื่นๆ</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
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
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกการแก้ไขข้อมูล</span>
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
          title="เลือกเวรชี้สำหรับสำนวนนี้"
          subtitle={`คดีดำ ${caseItem?.blackCaseNo || ''} (วันที่ฟ้อง: ${formatThaiDate(filingDate)})`}
        />
      </div>
    </div>
  );
};
