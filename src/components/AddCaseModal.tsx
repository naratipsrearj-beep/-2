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
  UserCheck,
  FileText,
  Image as ImageIcon,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sliders,
  Loader2,
  Users
} from 'lucide-react';
import { AppealCase, CourtAppointmentType, CaseAppointment, MonthlyDutyRoster } from '../types/appeal';
import { calculateAppealDeadline, calculateSeveredDeadline, formatThaiDate, getTodayString } from '../utils/dateUtils';
import { appointmentTypeOptions } from './CourtAppointmentModal';
import { DutyOfficerPickerModal } from './DutyOfficerPickerModal';
import { getDutyOfficersForDate, getAllOfficersGroupedByMonth } from '../services/dutyService';
import { compressImageFile } from '../utils/imageUtils';

interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (caseData: Omit<AppealCase, 'id' | 'createdAt' | 'updatedAt'>, saveToCalendar: boolean) => void;
  initialFilingDate?: string;
  initialResponsiblePerson?: string;
  suggestedDutyOfficer?: string;
  dutyRosters?: MonthlyDutyRoster[];
  hasSheetConnected: boolean;
  existingCases?: AppealCase[];
  initialPrefillCase?: Partial<AppealCase>;
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
  existingCases = [],
  initialPrefillCase,
}) => {
  const [filingDate, setFilingDate] = useState<string>(initialFilingDate || getTodayString());
  const [blackCaseNo, setBlackCaseNo] = useState('');
  const [redCaseNo, setRedCaseNo] = useState('');
  const [receivedNumberS1, setReceivedNumberS1] = useState('');
  const [filingNumberS4, setFilingNumberS4] = useState('');
  const [prosecutorName, setProsecutorName] = useState('');
  const [court, setCourt] = useState('ศาลจังหวัดเพชรบุรี');
  const [plaintiff, setPlaintiff] = useState('พนักงานอัยการ');
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

  // กรณีจำเลยหลายคน: บางคนรับสารภาพ บางคนปฏิเสธ และมีคำสั่งแยกฟ้อง (ป.วิ.อ. ม.176)
  const [hasMultipleDefendants, setHasMultipleDefendants] = useState<boolean>(false);
  const [hasPartialDenial, setHasPartialDenial] = useState<boolean>(false);
  const [confessedDefendants, setConfessedDefendants] = useState<string>('');
  const [deniedDefendants, setDeniedDefendants] = useState<string>('');
  const [hasPendingSeveredFiling, setHasPendingSeveredFiling] = useState<boolean>(false);
  const [severedFilingOrderDate, setSeveredFilingOrderDate] = useState<string>('');
  const [severedFilingDeadline, setSeveredFilingDeadline] = useState<string>('');
  const [isSeveredFilingCompleted, setIsSeveredFilingCompleted] = useState<boolean>(false);
  const [severedNewBlackCaseNo, setSeveredNewBlackCaseNo] = useState<string>('');

  // สำนวนที่ยังไม่เลือกสถานะสำนวน (คุมสำนวนที่จะฟ้องในวันไว้ก่อน)
  const [isUnspecifiedStage, setIsUnspecifiedStage] = useState<boolean>(true);

  // Case Status: Has Judgment rendered vs. Pending Hearings / Rights Protection / Denied Plea
  const [hasJudgment, setHasJudgment] = useState<boolean>(false);
  const [defendantPlea, setDefendantPlea] = useState<'denied' | 'confessed' | 'pending'>('pending');

  const [judgmentDate, setJudgmentDate] = useState<string>('');
  const [judgmentOutcome, setJudgmentOutcome] = useState('');
  const [fullJudgmentText, setFullJudgmentText] = useState<string>('');
  const [judgmentPhotoUrl, setJudgmentPhotoUrl] = useState<string | null>(null);
  const [judgmentPhotoName, setJudgmentPhotoName] = useState<string>('');
  const [judgmentVerified, setJudgmentVerified] = useState<boolean>(false);
  const [judgmentVerifiedBy, setJudgmentVerifiedBy] = useState<string>('');
  const [photoZoom, setPhotoZoom] = useState<number>(1);
  const [photoRotation, setPhotoRotation] = useState<number>(0);
  const [photoHighContrast, setPhotoHighContrast] = useState<boolean>(false);
  const judgmentFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const [responsiblePerson, setResponsiblePerson] = useState(initialResponsiblePerson || '');
  const [notes, setNotes] = useState('');
  const [saveToCalendar, setSaveToCalendar] = useState(false);

  // สำนวนเบิกฟ้อง
  const [isRequisitionCase, setIsRequisitionCase] = useState(false);
  const [requisitionDate, setRequisitionDate] = useState('');
  const [requisitionNotes, setRequisitionNotes] = useState('');

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

  // Auto-calculated 1-month appeal deadline whenever judgmentDate is present
  const deadlineInfo = useMemo(() => {
    if (!judgmentDate || !judgmentDate.trim()) {
      return { deadlineDate: '', originalDeadline: '', isAdjustedForWeekend: false };
    }
    return calculateAppealDeadline(judgmentDate);
  }, [judgmentDate]);

  // Reset form inputs whenever modal opens for a new case entry (กรอกใหม่ทุกครั้ง ยกเว้นประเภทคดีอาญา)
  useEffect(() => {
    if (isOpen) {
      if (initialPrefillCase) {
        setBlackCaseNo(initialPrefillCase.blackCaseNo || '');
        setRedCaseNo(initialPrefillCase.redCaseNo || '');
        setReceivedNumberS1(initialPrefillCase.receivedNumberS1 || '');
        setFilingNumberS4(initialPrefillCase.filingNumberS4 || '');
        setPlaintiff(initialPrefillCase.plaintiff || 'พนักงานอัยการ');
        setDefendant(initialPrefillCase.defendant || '');
        setCourt(initialPrefillCase.court || 'ศาลจังหวัดเพชรบุรี');
        setCaseType(initialPrefillCase.caseType || 'อาญา');
        setResponsiblePerson(initialPrefillCase.responsiblePerson || initialResponsiblePerson || suggestedDutyOfficer || '');
        setProsecutorName(initialPrefillCase.prosecutorName || suggestedDutyOfficer || '');
        setFilingDate(initialPrefillCase.filingDate || initialFilingDate || getTodayString());
        setNotes(initialPrefillCase.notes || '');

        setIsSeveredCase(Boolean(initialPrefillCase.isSeveredCase));
        setSeveredFromCaseId(initialPrefillCase.severedFromCaseId || '');
        setOriginalBlackCaseNo(initialPrefillCase.originalBlackCaseNo || '');
        setOriginalRedCaseNo(initialPrefillCase.originalRedCaseNo || '');
        setOriginalReceivedNumberS1(initialPrefillCase.originalReceivedNumberS1 || '');
        setOriginalFilingNumberS4(initialPrefillCase.originalFilingNumberS4 || '');
        setSeveredOrderDate(initialPrefillCase.severedOrderDate || '');
        setSeveredDeadlineDate(initialPrefillCase.severedDeadlineDate || '');
        setSeveredNotes(initialPrefillCase.severedNotes || '');

        setIsUnspecifiedStage(false);
        setHasJudgment(false);
        setDefendantPlea(initialPrefillCase.defendantPlea || 'denied');
        setAppointmentType(initialPrefillCase.appointmentType || 'pre_trial');
        setAppointmentTypeName(initialPrefillCase.appointmentTypeName || '');
        setIsRequisitionCase(false);
        setSubsequentAppointments([]);

        setHasMultipleDefendants(false);
        setHasPartialDenial(false);
        setConfessedDefendants('');
        setDeniedDefendants('');
        setHasPendingSeveredFiling(false);
        setSeveredFilingOrderDate('');
        setSeveredFilingDeadline('');
        setIsSeveredFilingCompleted(false);
        setSeveredNewBlackCaseNo('');
      } else {
        setBlackCaseNo('');
        setRedCaseNo('');
        setReceivedNumberS1('');
        setFilingNumberS4('');
        setPlaintiff('');
        setDefendant('');
        setJudgmentDate('');
        setJudgmentOutcome('');
        setFullJudgmentText('');
        setJudgmentPhotoUrl(null);
        setJudgmentPhotoName('');
        setJudgmentVerified(false);
        setJudgmentVerifiedBy('');
        setPhotoZoom(1);
        setPhotoRotation(0);
        setPhotoHighContrast(false);
        setNotes('');
        setSaveToCalendar(false);
        setAppointmentDate('');
        setAppointmentNotes('');
        setAppointmentCourtRoom('');
        setSubsequentAppointments([]);
        setIsUnspecifiedStage(true); // เริ่มต้น: ยังไม่เลือกสถานะสำนวน (คุมสำนวนที่จะฟ้องในวันไว้ก่อน มีแถบสีแดงเตือน)
        setHasJudgment(false);
        setDefendantPlea('pending');
        setAppointmentType('none');
        setIsRequisitionCase(false);
        setIsSeveredCase(false);
        setSeveredFromCaseId('');
        setOriginalBlackCaseNo('');
        setOriginalRedCaseNo('');
        setOriginalReceivedNumberS1('');
        setOriginalFilingNumberS4('');
        setSeveredOrderDate('');
        setSeveredDeadlineDate('');
        setSeveredNotes('');

        setHasMultipleDefendants(false);
        setHasPartialDenial(false);
        setConfessedDefendants('');
        setDeniedDefendants('');
        setHasPendingSeveredFiling(false);
        setSeveredFilingOrderDate('');
        setSeveredFilingDeadline('');
        setIsSeveredFilingCompleted(false);
        setSeveredNewBlackCaseNo('');

        setCaseType('อาญา'); // คงประเภทคดีอาญาไว้เช่นเดิม
        setCourt('ศาลจังหวัดเพชรบุรี');
        setFilingDate(initialFilingDate || getTodayString());
        setResponsiblePerson(initialResponsiblePerson || suggestedDutyOfficer || '');
        setProsecutorName(suggestedDutyOfficer || '');
      }
    }
  }, [isOpen, initialFilingDate, initialResponsiblePerson, suggestedDutyOfficer, initialPrefillCase]);

  // Paste listener for screenshot of judgment with compression
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            setIsProcessingPhoto(true);
            try {
              const compressed = await compressImageFile(file, { maxWidth: 1600, maxHeight: 2200, quality: 0.82 });
              setJudgmentPhotoUrl(compressed.dataUrl);
              setJudgmentPhotoName(`ภาพแคปคำพิพากษา_${blackCaseNo || 'ศาล'}.jpg`);
              setIsUnspecifiedStage(false);
              setHasJudgment(true);
              setDefendantPlea('confessed');
            } catch (err) {
              console.error('Paste error in AddCaseModal:', err);
            } finally {
              setIsProcessingPhoto(false);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, blackCaseNo]);

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

    if (isUnspecifiedStage) {
      // กรณียังไม่เลือกสถานะสำนวน (คุมสำนวนที่จะฟ้องในวันไว้ก่อน)
      // ไม่บังคับวันที่นัดหรือคำพิพากษา
    } else if (hasJudgment) {
      if (!judgmentDate) {
        alert('กรุณาระบุวันที่ศาลอ่านคำพิพากษา สำหรับสำนวนที่มีคำพิพากษาแล้ว');
        return;
      }
      if (!judgmentOutcome.trim()) {
        alert('กรุณากรอกผลคำพิพากษาโดยย่อ (เช่น ลงโทษจำคุก, ปรับ, รอการลงโทษ, ยกฟ้อง) หากศาลยังไม่อ่านคำพิพากษา กรุณาเอาเครื่องหมายถูกออกจากช่อง "ศาลมีคำพิพากษาแล้ว"');
        return;
      }
    } else {
      // Pending trial / rights protection / denied plea
      if (appointmentType !== 'none' && !appointmentDate) {
        alert('กรุณาระบุวันที่นัดของศาล (เช่น วันนัดคุ้มครองสิทธิ หรือวันนัดแรก)');
        return;
      }
    }

    let finalRedCaseNo = redCaseNo.trim() || undefined;
    if (!finalRedCaseNo) {
      const match = `${fullJudgmentText} ${judgmentOutcome} ${notes}`.match(
        /(?:คดีหมายเลขแดงที่|เลขคดีแดงที่|เลขคดีแดง|คดีแดงที่|คดีแดง|แดงที่|แดง)\s*([^\s,;()]+)/i
      );
      if (match && match[1]) {
        const extracted = match[1].replace(/^[.:\s]+/, '').trim();
        if (extracted && extracted !== '-' && extracted !== 'ยังไม่มีเลขแดง' && extracted.length >= 2) {
          finalRedCaseNo = extracted;
        }
      }
    }

    onSave(
      {
        filingDate,
        blackCaseNo: blackCaseNo.trim(),
        redCaseNo: finalRedCaseNo,
        receivedNumberS1: receivedNumberS1.trim() || undefined,
        filingNumberS4: filingNumberS4.trim() || undefined,
        prosecutorName: prosecutorName.trim() || undefined,
        court,
        plaintiff: plaintiff?.trim() || 'พนักงานอัยการ',
        defendant: defendant.trim(),
        caseType,
        isUnspecifiedStage,
        courtStageStatus: isUnspecifiedStage
          ? 'unspecified'
          : (defendantPlea === 'confessed' || hasJudgment)
            ? 'confessed'
            : isSeveredCase
              ? 'severed'
              : (isRequisitionCase || appointmentType === 'requisition')
                ? 'requisition'
                : defendantPlea === 'denied'
                  ? 'rights_protection'
                  : 'other',
        hasJudgment: isUnspecifiedStage
          ? false
          : defendantPlea === 'confessed'
            ? Boolean(judgmentDate.trim() || judgmentOutcome.trim() || fullJudgmentText.trim())
            : hasJudgment,
        defendantPlea: isUnspecifiedStage
          ? undefined
          : (defendantPlea === 'confessed' || hasJudgment)
            ? 'confessed'
            : (isRequisitionCase || appointmentType === 'requisition' ? 'pending' : defendantPlea),
        judgmentDate: !isUnspecifiedStage && (defendantPlea === 'confessed' || hasJudgment || Boolean(judgmentDate)) && judgmentDate ? judgmentDate : undefined,
        appealDeadline: !isUnspecifiedStage && (defendantPlea === 'confessed' || hasJudgment || Boolean(judgmentDate))
          ? (deadlineInfo.deadlineDate || (judgmentDate ? calculateAppealDeadline(judgmentDate).deadlineDate : undefined))
          : undefined,
        judgmentOutcome: isUnspecifiedStage
          ? ''
          : (defendantPlea === 'confessed' || hasJudgment)
            ? (judgmentOutcome.trim() || fullJudgmentText.trim() || '')
            : (isRequisitionCase || appointmentType === 'requisition')
              ? (judgmentOutcome.trim() || 'สำนวนเบิกฟ้อง (รอเบิกตัวมาฟ้อง / ยังไม่ทราบคำให้การ)')
              : (appointmentType !== 'none'
                ? `อยู่ระหว่าง${appointmentType === 'rights_protection' ? 'นัดคุ้มครองสิทธิ' : 'นัดพิจารณา'} (${defendantPlea === 'denied' ? 'จำเลยให้การปฏิเสธ' : 'รอคำให้การ'})`
                : ''),
        fullJudgmentText: (!isUnspecifiedStage && (defendantPlea === 'confessed' || hasJudgment)) ? (fullJudgmentText.trim() || judgmentOutcome.trim() || undefined) : undefined,
        judgmentPhotoUrl: hasJudgment ? (judgmentPhotoUrl || null) : null,
        judgmentPhotoName: hasJudgment ? (judgmentPhotoName || undefined) : undefined,
        judgmentVerified: hasJudgment ? judgmentVerified : undefined,
        judgmentVerifiedBy: hasJudgment && judgmentVerified ? (judgmentVerifiedBy.trim() || undefined) : undefined,
        responsiblePerson: responsiblePerson.trim() || 'ผู้ดูแลสำนวน',
        isCompleted: false,
        notes: notes.trim() || undefined,
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

        // กรณีจำเลยหลายคน: บางคนรับสารภาพ บางคนปฏิเสธ และมีคำสั่งแยกฟ้อง (ป.วิ.อ. ม.176)
        hasMultipleDefendants: hasMultipleDefendants || hasPartialDenial,
        hasPartialDenial,
        confessedDefendants: hasPartialDenial ? (confessedDefendants.trim() || undefined) : undefined,
        deniedDefendants: hasPartialDenial ? (deniedDefendants.trim() || undefined) : undefined,
        hasPendingSeveredFiling: hasPartialDenial ? hasPendingSeveredFiling : false,
        severedFilingOrderDate: (hasPartialDenial && hasPendingSeveredFiling) ? (severedFilingOrderDate || judgmentDate || filingDate || undefined) : undefined,
        severedFilingDeadline: (hasPartialDenial && hasPendingSeveredFiling)
          ? (severedFilingDeadline || calculateSeveredDeadline(severedFilingOrderDate || judgmentDate || filingDate, 7).deadlineDate)
          : undefined,
        isSeveredFilingCompleted: (hasPartialDenial && hasPendingSeveredFiling) ? isSeveredFilingCompleted : undefined,
        severedNewBlackCaseNo: (hasPartialDenial && hasPendingSeveredFiling && isSeveredFilingCompleted) ? (severedNewBlackCaseNo.trim() || undefined) : undefined,

        appointmentType: (hasJudgment || defendantPlea === 'confessed') && appointmentType === 'rights_protection' ? 'none' : appointmentType,
        appointmentTypeName: appointmentType === 'other' ? appointmentTypeName.trim() : undefined,
        appointmentDate: ((hasJudgment || defendantPlea === 'confessed') && appointmentType === 'rights_protection') ? undefined : (appointmentType !== 'none' && appointmentDate ? appointmentDate : undefined),
        appointmentTime: appointmentTime || undefined,
        appointmentCourtRoom: appointmentCourtRoom.trim() || undefined,
        appointmentNotes: appointmentNotes.trim() || undefined,
        subsequentAppointments: (hasJudgment || defendantPlea === 'confessed')
          ? subsequentAppointments.filter((a) => a.type !== 'rights_protection')
          : (subsequentAppointments.length > 0 ? subsequentAppointments : undefined),
      },
      saveToCalendar
    );
    setBlackCaseNo('');
    setRedCaseNo('');
    setReceivedNumberS1('');
    setFilingNumberS4('');
    setPlaintiff('');
    setDefendant('');
    setJudgmentDate('');
    setJudgmentOutcome('');
    setNotes('');
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
          {/* สถานะสำนวนในการพิจารณาของศาล - ปรับ UI ให้สั้นลง สบายตา ไม่กินพื้นที่ (ตามที่ผู้ใช้ร้องขอ) */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-['Prompt']">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>สถานะสำนวน:</span>
              </label>
              <span className="text-[10px] text-slate-500">เลือกผลการพิจารณาหรือคุมสำนวน</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
              {/* Option 0: ยังไม่เลือกสถานะสำนวน */}
              <button
                type="button"
                onClick={() => {
                  setIsUnspecifiedStage(true);
                  setIsSeveredCase(false);
                  setHasJudgment(false);
                  setDefendantPlea('pending');
                  setIsRequisitionCase(false);
                  setAppointmentType('none');
                  setAppointmentDate('');
                }}
                className={`py-1.5 px-2 rounded-lg border text-left transition flex items-center gap-1.5 cursor-pointer text-xs ${
                  isUnspecifiedStage
                    ? 'border-rose-500 bg-rose-100/90 text-rose-950 font-bold shadow-2xs ring-1 ring-rose-400'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                }`}
                title="คุมสำนวนที่จะฟ้องในวันไว้ก่อน (แถบสีแดงเตือน)"
              >
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 ${
                  isUnspecifiedStage ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300'
                }`}>
                  {isUnspecifiedStage && <Check className="w-2.5 h-2.5" />}
                </div>
                <div className="truncate">
                  <span className="font-bold block leading-tight truncate">🚨 ยังไม่เลือกสถานะ</span>
                </div>
              </button>

              {/* Option 1: จำเลยรับสารภาพ */}
              <button
                type="button"
                onClick={() => {
                  setIsUnspecifiedStage(false);
                  setIsSeveredCase(false);
                  setDefendantPlea('confessed');
                  setHasJudgment(true);
                  setIsRequisitionCase(false);
                  if (!judgmentDate) {
                    setJudgmentDate(getTodayString());
                  }
                  if (appointmentType === 'rights_protection' || appointmentType === 'requisition') {
                    setAppointmentType('none');
                    setAppointmentDate('');
                  }
                }}
                className={`py-1.5 px-2 rounded-lg border text-left transition flex items-center gap-1.5 cursor-pointer text-xs ${
                  !isUnspecifiedStage && !isSeveredCase && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'confessed'
                    ? 'border-yellow-500 bg-yellow-100 text-yellow-950 font-bold shadow-2xs ring-1 ring-yellow-400'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                }`}
                title="จำเลยรับสารภาพ (กรอกวันที่พิพากษาได้เลย คำพิพากษากรอกทีหลังได้)"
              >
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 ${
                  !isSeveredCase && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'confessed'
                    ? 'border-yellow-600 bg-yellow-500 text-yellow-950'
                    : 'border-slate-300'
                }`}>
                  {!isSeveredCase && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'confessed' && (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  )}
                </div>
                <div className="truncate">
                  <span className="font-bold block leading-tight truncate">🟡 จำเลยรับสารภาพ</span>
                </div>
              </button>

              {/* Option 2: คุ้มครองสิทธิ (จำเลยปฏิเสธ) */}
              <button
                type="button"
                onClick={() => {
                  setIsUnspecifiedStage(false);
                  setIsSeveredCase(false);
                  setHasJudgment(false);
                  setDefendantPlea('denied');
                  setIsRequisitionCase(false);
                  if (appointmentType === 'none' || appointmentType === 'requisition') {
                    setAppointmentType('rights_protection');
                  }
                }}
                className={`py-1.5 px-2 rounded-lg border text-left transition flex items-center gap-1.5 cursor-pointer text-xs ${
                  !isUnspecifiedStage && !isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && (defendantPlea === 'denied' || appointmentType === 'rights_protection')
                    ? 'border-orange-500 bg-orange-100 text-orange-950 font-bold shadow-2xs ring-1 ring-orange-400'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                }`}
                title="จำเลยให้การปฏิเสธ (นัดคุ้มครองสิทธิ/สืบพยาน)"
              >
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 ${
                  !isUnspecifiedStage && !isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && (defendantPlea === 'denied' || appointmentType === 'rights_protection')
                    ? 'border-orange-600 bg-orange-500 text-white'
                    : 'border-slate-300'
                }`}>
                  {!isUnspecifiedStage && !isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && (defendantPlea === 'denied' || appointmentType === 'rights_protection') && (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  )}
                </div>
                <div className="truncate">
                  <span className="font-bold block leading-tight truncate">🟠 จำเลยปฏิเสธ</span>
                </div>
              </button>

              {/* Option 3: สำนวนเบิกฟ้อง */}
              <button
                type="button"
                onClick={() => {
                  setIsUnspecifiedStage(false);
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
                className={`py-1.5 px-2 rounded-lg border text-left transition flex items-center gap-1.5 cursor-pointer text-xs ${
                  !isUnspecifiedStage && !isSeveredCase && (isRequisitionCase || appointmentType === 'requisition')
                    ? 'border-emerald-500 bg-emerald-100 text-emerald-950 font-bold shadow-2xs ring-1 ring-emerald-400'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                }`}
                title="ยังไม่ทราบคำให้การ • แจ้งเตือนวันเบิกฟ้อง"
              >
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 ${
                  !isUnspecifiedStage && !isSeveredCase && (isRequisitionCase || appointmentType === 'requisition')
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300'
                }`}>
                  {!isUnspecifiedStage && !isSeveredCase && (isRequisitionCase || appointmentType === 'requisition') && (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  )}
                </div>
                <div className="truncate">
                  <span className="font-bold block leading-tight truncate">🟢 สำนวนเบิกฟ้อง</span>
                </div>
              </button>

              {/* Option 4: อื่นๆ / มีนัดอื่นๆ */}
              <button
                type="button"
                onClick={() => {
                  setIsUnspecifiedStage(false);
                  setIsSeveredCase(false);
                  setHasJudgment(false);
                  setDefendantPlea('pending');
                  setIsRequisitionCase(false);
                  if (appointmentType === 'rights_protection' || appointmentType === 'requisition') {
                    setAppointmentType('other');
                  }
                }}
                className={`py-1.5 px-2 rounded-lg border text-left transition flex items-center gap-1.5 cursor-pointer text-xs ${
                  !isUnspecifiedStage && !isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'pending' && appointmentType !== 'rights_protection'
                    ? 'border-sky-500 bg-sky-100 text-sky-950 font-bold shadow-2xs ring-1 ring-sky-400'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                }`}
                title="ยังไม่ทราบคำให้การ • นัดพร้อม / นัดไกล่เกลี่ย / รอผล"
              >
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 ${
                  !isUnspecifiedStage && !isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'pending' && appointmentType !== 'rights_protection'
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300'
                }`}>
                  {!isUnspecifiedStage && !isSeveredCase && !hasJudgment && !isRequisitionCase && appointmentType !== 'requisition' && defendantPlea === 'pending' && appointmentType !== 'rights_protection' && (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  )}
                </div>
                <div className="truncate">
                  <span className="font-bold block leading-tight truncate">🔵 มีนัดอื่นๆ</span>
                </div>
              </button>

              {/* Option 5: สำนวนที่ศาลแยกฟ้อง */}
              <button
                type="button"
                onClick={() => {
                  setIsUnspecifiedStage(false);
                  setIsSeveredCase(true);
                  setHasJudgment(false);
                  setDefendantPlea('denied');
                  setIsRequisitionCase(false);
                  if (appointmentType === 'none' || appointmentType === 'requisition') {
                    setAppointmentType('pre_trial');
                  }
                }}
                className={`py-1.5 px-2 rounded-lg border text-left transition flex items-center gap-1.5 cursor-pointer text-xs ${
                  !isUnspecifiedStage && isSeveredCase
                    ? 'border-purple-500 bg-purple-100 text-purple-950 font-bold shadow-2xs ring-1 ring-purple-400'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                }`}
                title="ศาลสั่งแยกฟ้อง • เชื่อมโยง ส.1 / ส.4"
              >
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 ${
                  !isUnspecifiedStage && isSeveredCase ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'
                }`}>
                  {!isUnspecifiedStage && isSeveredCase && <Check className="w-2.5 h-2.5" />}
                </div>
                <div className="truncate">
                  <span className="font-bold block leading-tight truncate">✂️ ศาลแยกฟ้อง</span>
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
                        if (!court) setCourt(parent.court);
                        if (!plaintiff) setPlaintiff(parent.plaintiff);
                        if (!prosecutorName) setProsecutorName(parent.prosecutorName || '');
                      }
                    }}
                    className="w-full text-xs border border-purple-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="">-- เลือกสำนวนคดีเดิม (หรือเว้นว่างเพื่อพิมพ์เอง) --</option>
                    {existingCases.map((c) => (
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
                <span className="text-[10px] text-slate-500 font-normal">
                  {(hasJudgment || defendantPlea === 'confessed')
                    ? 'ระบุเมื่อศาลตัดสิน (คุมอุทธรณ์)'
                    : 'ไม่บังคับ (ยังไม่มีคำพิพากษา)'}
                </span>
              </label>
              <input
                type="text"
                placeholder={
                  (hasJudgment || defendantPlea === 'confessed')
                    ? 'เช่น อ.891/2569 หรือ แดง 124/2569'
                    : 'รอกำหนดเมื่อศาลมีคำพิพากษา (หรือระบุล่วงหน้า)'
                }
                value={redCaseNo}
                onChange={(e) => setRedCaseNo(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
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

          {/* อัยการเวรชี้ (เวรศาลประจำวัน) - ปรับช่องกรอกให้เล็กลง ดูสบายตา ไม่เกะกะ */}
          <div className="p-2 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-1.5 text-slate-700">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-['Prompt'] text-[11px]">อัยการเวรชี้ (เวรศาลประจำวัน)</span>
              </label>
              <div className="flex items-center gap-1.5">
                {onDutyOfficersOnFilingDate.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 hidden sm:inline">ตรงวันฟ้อง:</span>
                    {onDutyOfficersOnFilingDate.map((off: any, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setProsecutorName(off.name)}
                        className="text-[10px] text-slate-600 hover:text-indigo-700 bg-white hover:bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded transition cursor-pointer"
                        title={`เลือก ${off.name} (${off.role})`}
                      >
                        + {off.name}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsDutyPickerOpen(true)}
                  className="text-[10px] text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5"
                  title="เปิดหน้าต่างเลือกรายชื่ออัยการเวรชี้จากตารางเวรชี้แต่ละเดือน"
                >
                  <UserCheck className="w-2.5 h-2.5 text-slate-400" />
                  <span>เลือกจากตารางเวรชี้</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {monthsOfficersData.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setProsecutorName(e.target.value);
                  }}
                  className="w-1/3 text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 cursor-pointer truncate"
                >
                  <option value="">— ดึงจากตารางเวรชี้ —</option>
                  {monthsOfficersData.map((m: any) => (
                    <optgroup key={m.monthYear} label={`ตารางเวรชี้ ${m.monthNameThai}`}>
                      {m.officers.map((off: any, oIdx: number) => (
                        <option key={oIdx} value={off.name}>
                          {off.name} ({off.role})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="ชื่ออัยการเวรชี้ เช่น นายสมคิด ยุติธรรม"
                value={prosecutorName}
                onChange={(e) => setProsecutorName(e.target.value)}
                className="flex-1 text-[11px] border border-slate-200 rounded-lg px-2.5 py-1 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-slate-300 font-normal"
              />
            </div>
          </div>

          {/* ช่องกรอกจำเลย (ลบช่องโจทก์ออกตามที่ผู้ใช้ร้องขอ เนื่องจากเป็นพนักงานอัยการอยู่แล้วทุกสำนวน) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              จำเลย *
            </label>
            <input
              type="text"
              required
              placeholder="ชื่อจำเลย"
              value={defendant}
              onChange={(e) => setDefendant(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          {/* SECTION UNSELECTED: สำนวนยังไม่เลือกสถานะสำนวน (คุมสำนวนที่จะฟ้องในวันไว้ก่อน) */}
          {isUnspecifiedStage ? (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs text-sm">
                  ⚠️
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-950 font-['Prompt']">
                    คุมสำนวนที่จะฟ้องในวันไว้ก่อน (ยังไม่เลือกสถานะสำนวน)
                  </h4>
                  <p className="text-[11px] text-rose-800 leading-relaxed mt-0.5">
                    ท่านสามารถบันทึกข้อมูลคดีดำ, โจทก์, จำเลย, ส.1, ส.4 และอัยการเวรชี้ เพื่อคุมจำนวนสำนวนที่ยื่นฟ้องในวันนี้ไว้ก่อนได้ทันที โดยยังไม่ต้องระบุคำพิพากษาหรือวันนัด
                  </p>
                  <p className="text-[11px] text-rose-700 font-semibold mt-1">
                    🚨 ในหน้าสำนวนคดีที่ฟ้องรายวันจะมี <strong className="text-rose-900 underline">แถบสีแดงเตือน</strong> ให้ทราบอย่างเด่นชัด และสามารถกดเลือกผลการพิจารณา (รับสารภาพ / ปฏิเสธ / เบิกฟ้อง) ได้ทันทีเมื่อศาลพิจารณาเสร็จ
                  </p>
                </div>
              </div>
            </div>
          ) : defendantPlea === 'confessed' ? (
            <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-4 space-y-3.5 animate-in fade-in shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-yellow-400 text-yellow-950 flex items-center justify-center text-xs font-bold shadow-2xs">
                    🟡
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-950 font-['Prompt']">
                      จำเลยรับสารภาพ — วันที่ศาลอ่านคำพิพากษา
                    </h4>
                    <p className="text-[11px] text-amber-800">
                      กรอกเฉพาะวันที่พิพากษาได้เลย เพื่อเริ่มคุมระยะเวลาอุทธรณ์ 1 เดือน (ส่วนคำพิพากษากรอกทีหลังได้)
                    </p>
                  </div>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                  (judgmentOutcome.trim() || fullJudgmentText.trim())
                    ? 'bg-emerald-200 text-emerald-900 font-bold'
                    : 'bg-amber-200 text-amber-900'
                }`}>
                  {(judgmentOutcome.trim() || fullJudgmentText.trim()) ? 'กรอกคำพิพากษาแล้ว' : 'ข้อความคำพิพากษากรอกทีหลังได้'}
                </span>
              </div>

              {/* กรณีมีจำเลยหลายคน และบางคนให้การปฏิเสธ (ป.วิ.อ. ม.176 ศาลสั่งแยกฟ้อง) */}
              <div className="bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-amber-50/50 border-2 border-purple-300 rounded-xl p-3.5 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-purple-200">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-purple-700 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                      👥
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-purple-950 font-['Prompt'] flex items-center gap-1.5">
                        <span>กรณีจำเลยหลายคน: บางคนรับสารภาพ และบางคนปฏิเสธ (ป.วิ.อ. ม.176)</span>
                      </h4>
                      <p className="text-[11px] text-purple-800">
                        หากศาลสั่งให้แยกฟ้องจำเลยที่ปฏิเสธ ระบบจะเชื่อมโยงกับระบบแยกฟ้อง และเริ่มเตือนภายใน 7 วัน
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-purple-300 shadow-2xs hover:bg-purple-50 transition shrink-0">
                    <input
                      type="checkbox"
                      checked={hasPartialDenial}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHasPartialDenial(checked);
                        setHasMultipleDefendants(checked);
                        if (checked) {
                          setHasPendingSeveredFiling(true);
                          const ordDate = judgmentDate || filingDate || getTodayString();
                          setSeveredFilingOrderDate(ordDate);
                          setSeveredFilingDeadline(calculateSeveredDeadline(ordDate, 7).deadlineDate);
                          if (!confessedDefendants && defendant) {
                            setConfessedDefendants(`จำเลยที่ 1 (หรือระบุชื่อ)`);
                          }
                          if (!deniedDefendants) {
                            setDeniedDefendants(`จำเลยที่ 2 (ที่ให้การปฏิเสธ)`);
                          }
                        }
                      }}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-purple-300"
                    />
                    <span className="text-xs font-bold text-purple-950 font-['Prompt']">
                      มีจำเลยหลายคน & บางคนปฏิเสธ
                    </span>
                  </label>
                </div>

                {hasPartialDenial && (
                  <div className="space-y-3 pt-1 animate-in fade-in">
                    {/* ข้อมูลจำเลยที่รับสารภาพ & จำเลยที่ปฏิเสธ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-yellow-950 mb-1 flex items-center gap-1">
                          <span>🟡 จำเลยที่รับสารภาพ</span>
                          <span className="text-[10px] text-yellow-800">(มีคำพิพากษา/คุมอุทธรณ์)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น จำเลยที่ 1 นายก... หรือระบุชื่อ"
                          value={confessedDefendants}
                          onChange={(e) => setConfessedDefendants(e.target.value)}
                          className="w-full text-xs border border-yellow-400 bg-white rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-yellow-500 font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-orange-950 mb-1 flex items-center gap-1">
                          <span>🟠 จำเลยที่ปฏิเสธ</span>
                          <span className="text-[10px] text-orange-800 font-bold">(ต้องแยกฟ้องใหม่) *</span>
                        </label>
                        <input
                          type="text"
                          placeholder="เช่น จำเลยที่ 2 นายข... (ที่ศาลสั่งแยกฟ้อง)"
                          value={deniedDefendants}
                          onChange={(e) => setDeniedDefendants(e.target.value)}
                          className="w-full text-xs border border-orange-400 bg-white rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-semibold text-orange-950"
                        />
                      </div>
                    </div>

                    {/* ตัวเลือกคำสั่งศาลให้แยกฟ้อง */}
                    <div className="bg-white/80 p-3 rounded-lg border border-purple-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-950">
                          <input
                            type="checkbox"
                            checked={hasPendingSeveredFiling}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setHasPendingSeveredFiling(checked);
                              if (checked && !severedFilingOrderDate) {
                                const ordDate = judgmentDate || filingDate || getTodayString();
                                setSeveredFilingOrderDate(ordDate);
                                setSeveredFilingDeadline(calculateSeveredDeadline(ordDate, 7).deadlineDate);
                              }
                            }}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-purple-300"
                          />
                          <span>⚖️ ศาลมีคำสั่งให้พนักงานอัยการแยกฟ้องจำเลยที่ปฏิเสธ (ป.วิ.อ. ม.176 วรรคสอง)</span>
                        </label>
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                          กำหนด 7 วัน
                        </span>
                      </div>

                      {hasPendingSeveredFiling && (
                        <div className="pt-2 border-t border-purple-100 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-purple-950">
                                  วันที่ศาลสั่งแยกฟ้อง
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const today = getTodayString();
                                    setSeveredFilingOrderDate(today);
                                    setSeveredFilingDeadline(calculateSeveredDeadline(today, 7).deadlineDate);
                                  }}
                                  className="text-[10px] text-purple-700 hover:text-purple-950 underline cursor-pointer"
                                >
                                  ใช้วันนี้
                                </button>
                              </div>
                              <input
                                type="date"
                                value={severedFilingOrderDate}
                                onChange={(e) => {
                                  const ord = e.target.value;
                                  setSeveredFilingOrderDate(ord);
                                  if (ord) {
                                    setSeveredFilingDeadline(calculateSeveredDeadline(ord, 7).deadlineDate);
                                  }
                                }}
                                className="w-full text-xs border border-purple-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-purple-950 mb-1 flex items-center justify-between">
                                <span>กำหนดเวลายื่นแยกฟ้อง (เตือนภายใน 7 วัน) *</span>
                                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  7 วัน
                                </span>
                              </label>
                              <input
                                type="date"
                                value={severedFilingDeadline}
                                onChange={(e) => setSeveredFilingDeadline(e.target.value)}
                                className="w-full text-xs border border-purple-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-bold text-rose-700"
                              />
                              {severedFilingDeadline && (
                                <span className="text-[10px] text-purple-800 block mt-0.5">
                                  ครบกำหนด: {formatThaiDate(severedFilingDeadline, { short: false })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* สถานะการยื่นแยกฟ้อง */}
                          <div className="p-2 bg-purple-50 rounded-lg border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-800">
                                <input
                                  type="radio"
                                  name="severedStatusRadio"
                                  checked={!isSeveredFilingCompleted}
                                  onChange={() => setIsSeveredFilingCompleted(false)}
                                  className="text-purple-600 focus:ring-purple-500"
                                />
                                <span>⏳ รอแยกฟ้อง (ระบบจะเตือนนับถอยหลัง 7 วัน)</span>
                              </label>

                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-800">
                                <input
                                  type="radio"
                                  name="severedStatusRadio"
                                  checked={isSeveredFilingCompleted}
                                  onChange={() => setIsSeveredFilingCompleted(true)}
                                  className="text-emerald-600 focus:ring-emerald-500"
                                />
                                <span>✅ ยื่นแยกฟ้องแล้ว</span>
                              </label>
                            </div>

                            {isSeveredFilingCompleted && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-600 shrink-0">คดีดำที่แยกฟ้อง:</span>
                                <input
                                  type="text"
                                  placeholder="เช่น อ.125/2569"
                                  value={severedNewBlackCaseNo}
                                  onChange={(e) => setSeveredNewBlackCaseNo(e.target.value)}
                                  className="text-xs border border-emerald-300 bg-white rounded-lg px-2 py-1 w-32 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800"
                                />
                              </div>
                            )}
                          </div>

                          {/* คำแนะนำการเชื่อมโยงระบบแยกฟ้อง */}
                          <div className="text-[11px] text-purple-900 bg-purple-100/70 p-2 rounded-lg border border-purple-200 flex items-start gap-1.5">
                            <span className="shrink-0 text-xs">🔗</span>
                            <div>
                              <span><strong>ระบบเชื่อมโยงหัวข้อแยกฟ้อง:</strong> สำนวนนี้จะปรากฏในแท็บ/ตัวกรอง <strong>"✂️ สำนวนที่ศาลแยกฟ้อง"</strong> พร้อมแสดงการแจ้งเตือนเตือนด่วนภายใน 7 วัน และเชื่อมโยงผ่าน ส.1, ส.4 โดยอัตโนมัติ</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ช่องกรอกเฉพาะวันที่พิพากษาและหมายเลขคดีแดง (ตามที่ผู้ใช้ร้องขอ) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-amber-950">
                      วันที่ศาลอ่านคำพิพากษา
                    </label>
                    <button
                      type="button"
                      onClick={() => setJudgmentDate(getTodayString())}
                      className="text-[10px] text-amber-800 hover:text-amber-950 underline font-semibold cursor-pointer"
                    >
                      ใช้วันนี้
                    </button>
                  </div>
                  <input
                    type="date"
                    value={judgmentDate}
                    onChange={(e) => setJudgmentDate(e.target.value)}
                    className="w-full text-xs border border-amber-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium text-slate-800"
                  />
                  {judgmentDate && (
                    <span className="text-[10px] text-amber-800 block mt-1">
                      {formatThaiDate(judgmentDate, { short: false })}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-950 mb-1 flex items-center justify-between">
                    <span>หมายเลขคดีแดง (ถ้าทราบ)</span>
                    <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                      เชื่อมโยงเลขแดง
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น อ.891/2569"
                    value={redCaseNo}
                    onChange={(e) => setRedCaseNo(e.target.value)}
                    className="w-full text-xs border border-rose-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-bold text-rose-800"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {redCaseNo ? `เชื่อมโยง: แดง ${redCaseNo}` : 'ระบุเมื่อศาลตัดสิน'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-950 mb-1">
                    วันครบกำหนดอุทธรณ์ 1 เดือน (คำนวณอัตโนมัติ)
                  </label>
                  <div className="text-sm font-bold text-rose-700 bg-white border border-rose-300 rounded-xl px-3 py-2 flex items-center justify-between min-h-[38px]">
                    <span>
                      {deadlineInfo.deadlineDate
                        ? formatThaiDate(deadlineInfo.deadlineDate, { short: false })
                        : judgmentDate
                        ? formatThaiDate(calculateAppealDeadline(judgmentDate).deadlineDate, { short: false })
                        : 'กรุณาระบุวันพิพากษา'}
                    </span>
                    {(deadlineInfo.deadlineDate || judgmentDate) && (
                      <span className="text-[10px] font-normal text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                        1 เดือน
                      </span>
                    )}
                  </div>
                  {deadlineInfo.isAdjustedForWeekend && (
                    <span className="text-[10px] text-amber-700 font-medium block mt-1">
                      ⚡ วันครบกำหนดตรงวันหยุดเสาร์-อาทิตย์ เลื่อนเป็นวันทำการถัดไป
                    </span>
                  )}
                </div>
              </div>

              {/* ช่องกรอกคำพิพากษาเป็นช่องเดียว - ส่วนคำพิพากษาให้กรอกทีหลังได้ */}
              <div className="pt-2 border-t border-amber-200/70">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-['Prompt']">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    <span>คำพิพากษา / ผลการตัดสินของศาล</span>
                    <span className="text-[10px] font-normal text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                      กรอกทีหลังได้
                    </span>
                  </label>
                  <span className="text-[10px] text-slate-500">เว้นว่างไว้เพื่อกรอกทีหลังได้</span>
                </div>

                {/* Quick suggestion chips */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {['ลงโทษตามฟ้อง', 'จำคุก รอการลงโทษ', 'ยกฟ้อง', 'รอการกำหนดโทษ', 'จำคุก ไม่รอลงอาญา', 'ปรับอย่างเดียว', 'ยอมความ / ถอนฟ้อง'].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setJudgmentOutcome(suggestion);
                        setFullJudgmentText(suggestion);
                      }}
                      className={`text-[10px] px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                        (judgmentOutcome === suggestion || fullJudgmentText === suggestion)
                          ? 'bg-amber-600 text-white border-amber-600 font-semibold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  placeholder="กรอกคำพิพากษา หรือเว้นว่างไว้ก่อนเพื่อมากรอกทีหลังในหน้าคุมสำนวนรายวัน (กดปุ่ม '+ กรอกคำพิพากษา')..."
                  value={fullJudgmentText || judgmentOutcome}
                  onChange={(e) => {
                    const val = e.target.value;
                    setJudgmentOutcome(val);
                    setFullJudgmentText(val);
                    if (!redCaseNo.trim()) {
                      const match = val.match(
                        /(?:คดีหมายเลขแดงที่|เลขคดีแดงที่|เลขคดีแดง|คดีแดงที่|คดีแดง|แดงที่|แดง)\s*([^\s,;()]+)/i
                      );
                      if (match && match[1]) {
                        const extracted = match[1].replace(/^[.:\s]+/, '').trim();
                        if (extracted && extracted !== '-' && extracted !== 'ยังไม่มีเลขแดง' && extracted.length >= 2) {
                          setRedCaseNo(extracted);
                        }
                      }
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-sans leading-relaxed bg-white"
                />

                {/* Spot-Check Keywords */}
                <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-slate-500 flex items-center gap-0.5 mr-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>คำสำคัญ:</span>
                  </span>
                  {['จำคุก', 'รอการลงโทษ', 'ปรับ', 'ยกฟ้อง', 'ริบ', 'คดีแดง'].map((kw) => {
                    const combined = `${judgmentOutcome} ${fullJudgmentText}`;
                    const isFound = combined.includes(kw);
                    return (
                      <span
                        key={kw}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition flex items-center gap-0.5 ${
                          isFound
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                            : 'bg-white text-slate-400 border-slate-200'
                        }`}
                      >
                        {isFound && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                        <span>{kw}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* ช่องสำหรับวางรูปภาพ ที่แคปหน้าจอคำพิพากษา (ถ้ามี) */}
              <div className="pt-2 border-t border-amber-200/70">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-600" />
                    <span>ช่องสำหรับวางรูปภาพ ที่แคปหน้าจอคำพิพากษา (ถ้ามี)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">สำหรับตรวจทานว่าข้อความตรงกันไหม</span>
                </div>

                <input
                  type="file"
                  ref={judgmentFileInputRef}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      e.target.value = '';
                      if (!file.type.startsWith('image/')) return;
                      setIsProcessingPhoto(true);
                      try {
                        const compressed = await compressImageFile(file, { maxWidth: 1600, maxHeight: 2200, quality: 0.82 });
                        setJudgmentPhotoName(file.name || 'ภาพแคปคำพิพากษา.jpg');
                        setJudgmentPhotoUrl(compressed.dataUrl);
                      } catch (err) {
                        console.error('AddCaseModal upload error:', err);
                      } finally {
                        setIsProcessingPhoto(false);
                      }
                    }
                  }}
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                />

                {isProcessingPhoto ? (
                  <div className="border-2 border-dashed border-amber-400 bg-amber-50/80 rounded-xl p-4 text-center flex flex-col items-center justify-center space-y-1.5 animate-pulse">
                    <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
                    <span className="text-xs font-bold text-amber-950">กำลังปรับขนาดและบีบอัดภาพแคปหน้าจอ...</span>
                    <span className="text-[10px] text-amber-800">ระบบรักษาความคมชัดของตัวหนังสือเพื่อให้อ่านง่ายและไม่ทำให้หน้าจอค้าง</span>
                  </div>
                ) : judgmentPhotoUrl ? (
                  <div className="bg-slate-900 text-white rounded-xl p-3 space-y-2 border border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate max-w-[220px]">
                        <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-semibold text-slate-200 truncate text-[11px]">
                          {judgmentPhotoName || 'ภาพแคปคำพิพากษา'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPhotoZoom((z) => Math.min(z + 0.25, 3))}
                          className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                          title="ซูมเข้า"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoZoom((z) => Math.max(z - 0.25, 0.5))}
                          className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                          title="ซูมออก"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoRotation((r) => (r + 90) % 360)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                          title="หมุน 90 องศา"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoHighContrast(!photoHighContrast)}
                          className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer flex items-center gap-0.5 ${
                            photoHighContrast ? 'bg-amber-500 text-slate-950 font-bold' : 'hover:bg-slate-800 text-slate-300'
                          }`}
                          title="เร่งความคมชัด"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>คมชัด</span>
                        </button>
                        <div className="w-px h-3.5 bg-slate-700 mx-0.5" />
                        <button
                          type="button"
                          onClick={() => judgmentFileInputRef.current?.click()}
                          className="text-[10px] text-amber-400 hover:text-amber-300 underline cursor-pointer px-1"
                        >
                          เปลี่ยนภาพ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setJudgmentPhotoUrl(null);
                            setJudgmentPhotoName('');
                            setJudgmentVerified(false);
                          }}
                          className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer px-1"
                        >
                          ลบภาพ
                        </button>
                      </div>
                    </div>

                    {/* Image Viewer */}
                    <div className="max-h-64 overflow-auto rounded-lg bg-slate-950/80 p-2 flex items-center justify-center border border-slate-800">
                      <img
                        src={judgmentPhotoUrl}
                        alt="ภาพแคปคำพิพากษา"
                        className="max-h-56 object-contain rounded transition-transform"
                        style={{
                          transform: `scale(${photoZoom}) rotate(${photoRotation}deg)`,
                          filter: photoHighContrast ? 'contrast(175%) brightness(95%)' : 'none',
                        }}
                      />
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>💡 เทียบข้อความในกล่องด้านบนกับภาพแคปหน้าจอ</span>
                      <span className="text-amber-400">กด Ctrl + V เพื่อวางภาพใหม่แทนได้</span>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => judgmentFileInputRef.current?.click()}
                    className="border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-xl p-3 text-center cursor-pointer transition bg-amber-50/40 hover:bg-amber-50/80 flex flex-col items-center group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white flex items-center justify-center mb-1 transition shadow-2xs">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-slate-800 font-['Prompt']">
                      วางภาพแคปหน้าจอคำพิพากษาที่นี่ (กด Ctrl + V หรือคลิกเพื่อแนบ)
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      (ไม่บังคับ สามารถแนบภายหลังได้)
                    </div>
                  </div>
                )}
              </div>

              {/* ตัวเลือกสำหรับคดีรับสารภาพที่ศาลสั่งสืบเสาะ */}
              <div className="pt-2 border-t border-amber-200/70">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={appointmentType === 'investigation' || (appointmentType !== 'none' && Boolean(appointmentDate))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAppointmentType('investigation');
                      } else {
                        setAppointmentType('none');
                        setAppointmentDate('');
                      }
                    }}
                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">
                    🔍 กรณีศาลมีคำสั่งให้สืบเสาะและพินิจ หรือมีนัดฟังคำพิพากษาอื่น (ติ๊กหากต้องการระบุวันนัด)
                  </span>
                </label>

                {(appointmentType === 'investigation' || (appointmentType !== 'none' && Boolean(appointmentDate))) && (
                  <div className="mt-2.5 p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between pb-1.5 border-b border-indigo-200/80">
                      <span className="text-xs font-bold text-indigo-950">
                        กำหนดวันนัดสืบเสาะ / นัดฟังคำพิพากษา:
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          ประเภทนัด
                        </label>
                        <select
                          value={appointmentType}
                          onChange={(e) => setAppointmentType(e.target.value as CourtAppointmentType)}
                          className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                        >
                          <option value="investigation">🔍 นัดสืบเสาะ</option>
                          <option value="judgment">⚖️ นัดฟังคำพิพากษา</option>
                          <option value="other">📌 นัดอื่นๆ</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          วันที่นัดของศาล
                        </label>
                        <input
                          type="date"
                          value={appointmentDate}
                          onChange={(e) => setAppointmentDate(e.target.value)}
                          className="w-full text-xs border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : hasJudgment ? (
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
                  <div className="text-sm font-bold text-rose-700 bg-white border border-rose-300 rounded-xl px-3 py-2 flex items-center justify-between min-h-[38px]">
                    <span>
                      {deadlineInfo.deadlineDate
                        ? formatThaiDate(deadlineInfo.deadlineDate, { short: false })
                        : judgmentDate
                        ? formatThaiDate(calculateAppealDeadline(judgmentDate).deadlineDate, { short: false })
                        : 'กรุณาระบุวันพิพากษา'}
                    </span>
                    {(deadlineInfo.deadlineDate || judgmentDate) && (
                      <span className="text-[10px] font-normal text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                        1 เดือน
                      </span>
                    )}
                  </div>
                  {deadlineInfo.isAdjustedForWeekend && (
                    <span className="text-[10px] text-amber-700 font-medium">
                      ⚡ วันครบกำหนดเดิมตรงกับวันหยุดเสาร์-อาทิตย์ กฎหมายเลื่อนเป็นวันทำการถัดไป
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5 font-['Prompt']">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>คำพิพากษา / ผลการตัดสินของศาล *</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="เช่น ยกฟ้อง, ลงโทษจำคุก 2 ปี ปรับ 50,000 บาท รอการลงโทษ, พิพากษาตามยอม"
                  value={fullJudgmentText || judgmentOutcome}
                  onChange={(e) => {
                    const val = e.target.value;
                    setJudgmentOutcome(val);
                    setFullJudgmentText(val);
                  }}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-sans leading-relaxed"
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
            /* SECTION B: Case Without Judgment (เฉพาะกรณีเลือก ปฏิเสธ / สืบเสาะ / หรือนัดอื่นๆ เท่านั้น) */
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
                      required={appointmentType !== 'none'}
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
                  {defendantPlea === 'confessed' || hasJudgment || Boolean(judgmentDate)
                    ? 'เตือนก่อนวันครบกำหนดอุทธรณ์ 1 เดือน (7 วัน, 3 วัน และ 1 วัน)'
                    : isRequisitionCase || appointmentType === 'requisition'
                      ? 'แจ้งเตือนวันเบิกฟ้อง'
                      : appointmentType !== 'none' || defendantPlea === 'denied'
                        ? 'แจ้งเตือนวันนัดของศาล (นัดคุ้มครองสิทธิ / วันนัดพิจารณา)'
                        : 'แจ้งเตือนกำหนดเวลาของศาล'}
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
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                isUnspecifiedStage
                  ? 'bg-rose-600 hover:bg-rose-700 ring-2 ring-rose-500/20'
                  : defendantPlea === 'confessed'
                    ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400/30'
                    : hasJudgment || Boolean(judgmentDate)
                      ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400/30'
                      : isRequisitionCase || appointmentType === 'requisition'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : isSeveredCase
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : defendantPlea === 'denied' || appointmentType === 'rights_protection'
                            ? 'bg-orange-600 hover:bg-orange-700'
                            : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {isUnspecifiedStage
                  ? 'บันทึกสำนวน (ยังไม่เลือกสถานะ - คุมสำนวนไว้ก่อน)'
                  : defendantPlea === 'confessed'
                    ? 'บันทึกสำนวน (จำเลยรับสารภาพ)'
                    : hasJudgment || Boolean(judgmentDate)
                      ? 'บันทึกสำนวนคุมอุทธรณ์ 1 เดือน (มีคำพิพากษา)'
                      : isRequisitionCase || appointmentType === 'requisition'
                        ? 'บันทึกสำนวน (สำนวนมีเบิกฟ้อง)'
                        : isSeveredCase
                          ? 'บันทึกสำนวน (สำนวนแยกฟ้อง)'
                          : defendantPlea === 'denied' || appointmentType === 'rights_protection'
                            ? 'บันทึกสำนวน (มีนัดคุ้มครองสิทธิ/ปฏิเสธ)'
                            : appointmentType !== 'none'
                              ? 'บันทึกสำนวน (มีวันนัดของศาล)'
                              : 'บันทึกสำนวนคดีใหม่'}
              </span>
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
