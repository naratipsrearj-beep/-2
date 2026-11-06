import { AppealCase, CaseRevision, CaseFieldDiff, DeletedCaseBackup } from '../types/appeal';
import { formatThaiDate } from './dateUtils';

const STORAGE_KEY_REVISIONS = 'appeal_tracker_case_revisions_v1';
const STORAGE_KEY_DELETED = 'appeal_tracker_deleted_cases_v1';
const MAX_STORED_REVISIONS = 500;

// Field label definitions in Thai
const FIELD_LABELS: Record<string, string> = {
  blackCaseNo: 'เลขคดีดำ',
  redCaseNo: 'เลขคดีแดง',
  court: 'ศาล',
  defendant: 'จำเลย',
  plaintiff: 'โจทก์',
  filingDate: 'วันที่ยื่นฟ้อง',
  judgmentDate: 'วันที่ศาลอ่านคำพิพากษา',
  appealDeadline: 'วันครบกำหนดอุทธรณ์ 1 เดือน',
  extendedDeadline: 'วันขอขยายเวลาอุทธรณ์',
  extensionCount: 'จำนวนครั้งที่ขยายเวลา',
  isCompleted: 'สถานะเสร็จสิ้น',
  completedDate: 'วันที่เสร็จสิ้น',
  completionReason: 'เหตุผลที่เสร็จสิ้น',
  responsiblePerson: 'อัยการเจ้าของสำนวน',
  defendantPlea: 'คำให้การของจำเลย',
  courtStageStatus: 'สถานะขั้นตอนของสำนวน',
  isUnspecifiedStage: 'สถานะคุมสำนวนก่อนเลือกขั้นตอน',
  judgmentOutcome: 'ผลคำพิพากษา',
  notes: 'หมายเหตุ',
  isSubmittedToDuty: 'สถานะเสนอเวรชี้',
  submittedToDutyDate: 'วันที่เสนอเวรชี้',
  submittedToDutyOfficer: 'อัยการเวรชี้ที่เสนอ',
  submittedToDutyNotes: 'หมายเหตุการเสนอเวรชี้',
  hasPendingSeveredFiling: 'คำสั่งศาลให้แยกฟ้อง (ม.176)',
  severedFilingOrderDate: 'วันที่ศาลสั่งแยกฟ้อง',
  severedFilingDaysLimit: 'ระยะเวลาแยกฟ้องตามคำสั่งศาล',
  severedFilingDeadline: 'กำหนดเวลายื่นแยกฟ้อง',
  isSeveredFilingCompleted: 'สถานะการยื่นแยกฟ้อง',
  severedNewBlackCaseNo: 'เลขคดีดำที่แยกฟ้องใหม่',
  appointmentType: 'ประเภทวันนัดของศาล',
  appointmentDate: 'วันนัดของศาล',
  appointmentTime: 'เวลานัดของศาล',
  appointmentCourtRoom: 'ห้องพิจารณา/บัลลังก์',
  appointmentNotes: 'หมายเหตุวันนัด',
  isTemporarilyDischarged: 'สถานะจำหน่ายคดีชั่วคราว (หลบหนี)',
  temporaryDischargeDate: 'วันที่สั่งจำหน่ายคดีชั่วคราว',
  temporaryDischargeReason: 'เหตุผลจำหน่ายคดี',
  arrestWarrantNo: 'หมายจับเลขที่',
  arrestWarrantDate: 'วันที่ออกหมายจับ',
  recapturedDate: 'วันที่จับกุมตัวได้',
  receivedNumberS1: 'เลขรับ ส.1',
  filingNumberS4: 'เลขฟ้อง ส.4',
  isRequisitionCase: 'สำนวนเบิกฟ้อง',
  requisitionDate: 'วันที่เบิกฟ้อง',
  fullJudgmentText: 'ข้อความคำพิพากษาฉบับเต็ม',
};

function formatFieldValue(field: string, val: any): string {
  if (val === undefined || val === null || val === '') return '(ว่าง)';
  if (typeof val === 'boolean') return val ? 'ใช่ / เปิดใช้งาน' : 'ไม่ใช่ / ปิด';

  // Date fields
  if (
    field.includes('Date') ||
    field.includes('Deadline') ||
    field === 'appealDeadline' ||
    field === 'extendedDeadline' ||
    field === 'filingDate' ||
    field === 'judgmentDate' ||
    field === 'completedDate'
  ) {
    return formatThaiDate(String(val));
  }

  // Completion Reason
  if (field === 'completionReason') {
    switch (val) {
      case 'submitted_appellate':
        return 'เสนออัยการศาลสูงแล้ว';
      case 'appealed':
        return 'ยื่นอุทธรณ์แล้ว';
      case 'no_appeal':
        return 'มีคำสั่งไม่อุทธรณ์ / ยุติ';
      case 'finalized':
        return 'คดีถึงที่สุด';
      case 'settled':
        return 'ยอมความ';
      default:
        return String(val);
    }
  }

  // Defendant Plea
  if (field === 'defendantPlea') {
    switch (val) {
      case 'confessed':
        return 'จำเลยให้การรับสารภาพ';
      case 'denied':
        return 'จำเลยให้การปฏิเสธ';
      case 'other':
        return 'อื่นๆ / ไกล่เกลี่ย';
      default:
        return String(val);
    }
  }

  // Appointment Type
  if (field === 'appointmentType') {
    switch (val) {
      case 'rights_protection':
        return 'คุ้มครองสิทธิ';
      case 'investigation':
        return 'สืบเสาะ';
      case 'witness_confessed':
        return 'สืบประกอบรับสารภาพ';
      case 'judgment':
        return 'ฟังคำพิพากษา';
      case 'requisition':
        return 'เบิกฟ้อง';
      case 'none':
        return 'ไม่มีนัด';
      default:
        return String(val);
    }
  }

  // Limit string length for display
  const str = String(val);
  return str.length > 80 ? str.slice(0, 80) + '...' : str;
}

/**
 * Compare two AppealCase snapshots and extract array of field diffs
 */
export function computeCaseDiffs(before: AppealCase, after: AppealCase): CaseFieldDiff[] {
  const diffs: CaseFieldDiff[] = [];
  const checkedKeys = new Set<string>();

  // Compare all keys in before & after
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  for (const key of allKeys) {
    if (key === 'updatedAt' || key === 'createdAt' || key === 'id' || key === 'sheetRowIndex') {
      continue; // Skip system timestamps and internal IDs
    }

    const valBefore = (before as any)[key];
    const valAfter = (after as any)[key];

    // Normalize empty strings and undefined
    const normBefore = valBefore === undefined || valBefore === null ? '' : valBefore;
    const normAfter = valAfter === undefined || valAfter === null ? '' : valAfter;

    // Deep compare or primitive compare
    const isDifferent =
      typeof normBefore === 'object' || typeof normAfter === 'object'
        ? JSON.stringify(normBefore) !== JSON.stringify(normAfter)
        : normBefore !== normAfter;

    if (isDifferent) {
      const fieldLabel = FIELD_LABELS[key] || key;
      diffs.push({
        field: key,
        fieldLabel,
        oldValue: valBefore,
        newValue: valAfter,
        oldValueFormatted: formatFieldValue(key, valBefore),
        newValueFormatted: formatFieldValue(key, valAfter),
      });
      checkedKeys.add(key);
    }
  }

  return diffs;
}

/**
 * Get all stored case revisions from localStorage
 */
export function getSavedRevisions(): CaseRevision[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REVISIONS);
    if (!raw) return [];
    const list: CaseRevision[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('Failed to parse saved case revisions:', err);
    return [];
  }
}

/**
 * Save case revisions to localStorage
 */
export function saveRevisions(revisions: CaseRevision[]): void {
  try {
    const trimmed = revisions.slice(0, MAX_STORED_REVISIONS);
    localStorage.setItem(STORAGE_KEY_REVISIONS, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Failed to save case revisions to localStorage:', err);
  }
}

/**
 * Record a new revision when a case is modified
 */
export function recordCaseRevision(
  before: AppealCase,
  after: AppealCase,
  actor: { name: string; role: string; email?: string },
  actionType: CaseRevision['actionType'] = 'edit',
  customTitle?: string
): CaseRevision | null {
  const diffs = computeCaseDiffs(before, after);

  // If there are no real differences, don't record a redundant revision
  if (diffs.length === 0) {
    return null;
  }

  // Build change summary
  const topChanges = diffs.slice(0, 3).map((d) => d.fieldLabel);
  const remainingCount = diffs.length - topChanges.length;
  let changeSummary = topChanges.join(', ');
  if (remainingCount > 0) {
    changeSummary += ` และอีก ${remainingCount} รายการ`;
  }

  let actionTitle = customTitle;
  if (!actionTitle) {
    switch (actionType) {
      case 'judgment':
        actionTitle = 'บันทึกคำพิพากษา';
        break;
      case 'extension':
        actionTitle = 'ขยายระยะเวลาอุทธรณ์';
        break;
      case 'completion':
        actionTitle = after.isCompleted ? 'บันทึกเสร็จสิ้นสำนวน' : 'ยกเลิกเสร็จสิ้นสำนวน';
        break;
      case 'revert':
        actionTitle = 'ย้อนกลับข้อมูลเดิม';
        break;
      case 'status_change':
        actionTitle = 'ปรับปรุงสถานะสำนวน';
        break;
      default:
        actionTitle = 'แก้ไขข้อมูลสำนวนคดี';
    }
  }

  const newRevision: CaseRevision = {
    id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    caseId: after.id,
    blackCaseNo: after.blackCaseNo,
    redCaseNo: after.redCaseNo,
    court: after.court,
    prosecutorName: after.responsiblePerson || after.prosecutorName,
    timestamp: new Date().toISOString(),
    editorName: actor.name || 'ผู้ใช้งาน',
    editorRole: actor.role || 'editor',
    editorEmail: actor.email,
    actionType,
    actionTitle,
    changeSummary,
    diffs,
    snapshotBefore: JSON.parse(JSON.stringify(before)),
    snapshotAfter: JSON.parse(JSON.stringify(after)),
  };

  const currentRevisions = getSavedRevisions();
  const updated = [newRevision, ...currentRevisions];
  saveRevisions(updated);

  return newRevision;
}

/**
 * Get revisions for a specific case
 */
export function getRevisionsForCase(caseId: string): CaseRevision[] {
  const all = getSavedRevisions();
  return all.filter((r) => r.caseId === caseId);
}

// ==================== Deleted Cases Storage & Restore ====================

export function getDeletedCases(): DeletedCaseBackup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED);
    if (!raw) return [];
    const list: DeletedCaseBackup[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('Failed to parse deleted cases:', err);
    return [];
  }
}

export function saveDeletedCases(list: DeletedCaseBackup[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DELETED, JSON.stringify(list.slice(0, 100)));
  } catch (err) {
    console.warn('Failed to save deleted cases:', err);
  }
}

export function recordDeletedCase(
  caseItem: AppealCase,
  actor: { name: string; role: string }
): DeletedCaseBackup {
  const backup: DeletedCaseBackup = {
    id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    caseId: caseItem.id,
    blackCaseNo: caseItem.blackCaseNo,
    redCaseNo: caseItem.redCaseNo,
    court: caseItem.court,
    deletedAt: new Date().toISOString(),
    deletedBy: actor.name || 'ผู้ใช้งาน',
    deletedRole: actor.role || 'editor',
    caseData: JSON.parse(JSON.stringify(caseItem)),
  };

  const current = getDeletedCases().filter((d) => d.caseId !== caseItem.id);
  const updated = [backup, ...current];
  saveDeletedCases(updated);

  return backup;
}

export function removeDeletedCase(caseId: string): void {
  const current = getDeletedCases().filter((d) => d.caseId !== caseId);
  saveDeletedCases(current);
}
