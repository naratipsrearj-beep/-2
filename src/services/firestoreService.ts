import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  deleteDoc,
  writeBatch,
  getDocFromServer,
  deleteField
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppealCase, MonthlyDutyRoster, DailyJudgmentFollowUp } from '../types/appeal';

// Initialize Firebase App & Firestore singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const customDbId =
  firebaseConfig.firestoreDatabaseId &&
  firebaseConfig.firestoreDatabaseId !== '(default)' &&
  firebaseConfig.firestoreDatabaseId.trim() !== ''
    ? firebaseConfig.firestoreDatabaseId
    : undefined;
export const db = customDbId ? getFirestore(app, customDbId) : getFirestore(app);

export const ADMIN_EMAIL = 'naratipsrearj@gmail.com';
export const DEFAULT_ADMIN_PIN = '951753';
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

/**
 * Test real-time connection status to Firestore
 */
export async function testConnectionStatus(): Promise<{
  success: boolean;
  error?: string;
  code?: string;
  projectId: string;
}> {
  try {
    await getDocs(collection(db, 'cases'));
    return { success: true, projectId: firebaseConfig.projectId };
  } catch (err: any) {
    console.warn('testConnectionStatus error:', err);
    return {
      success: false,
      code: err.code || 'unknown',
      error: err.message || String(err),
      projectId: firebaseConfig.projectId,
    };
  }
}

export type UserRole = 'admin' | 'editor' | 'appeal_officer' | 'viewer';

export interface ProjectSettings {
  adminEmail: string;
  allowedEditors: string[];
  allowedAppealOfficers?: string[]; // เจ้าหน้าที่คุมอุทธรณ์: ดูสำนวนได้ และกดได้แค่เสร็จสิ้นเท่านั้น
  adminPin?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PermissionRequest {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  requestedAt: string;
  requestedRole?: 'editor' | 'appeal_officer';
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
}

// Default settings
export const DEFAULT_SETTINGS: ProjectSettings = {
  adminEmail: ADMIN_EMAIL,
  allowedEditors: [],
  allowedAppealOfficers: [],
  adminPin: DEFAULT_ADMIN_PIN,
  updatedAt: new Date().toISOString(),
};

/**
 * Validate connection on boot as mandated by Firebase skill
 */
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'settings', 'permissions'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration or network connection.');
    }
  }
}

/**
 * Check user role
 */
export function getUserRole(
  email: string | null | undefined,
  settings: ProjectSettings = DEFAULT_SETTINGS,
  isPinAdmin?: boolean
): UserRole {
  if (isPinAdmin) {
    return 'admin';
  }
  if (!email) return 'viewer';
  const cleanEmail = email.toLowerCase().trim();

  // Project Owner / Main Admin
  if (cleanEmail === ADMIN_EMAIL.toLowerCase()) {
    return 'admin';
  }

  // Allowed editors list authorized by Admin
  const isAllowedEditor = (settings.allowedEditors || []).some(
    (e) => e.toLowerCase().trim() === cleanEmail
  );
  if (isAllowedEditor) {
    return 'editor';
  }

  // Allowed appeal officers list authorized by Admin (ดูสำนวนได้ และกดได้แค่เสร็จสิ้นเท่านั้น)
  const isAllowedAppealOfficer = (settings.allowedAppealOfficers || []).some(
    (e) => e.toLowerCase().trim() === cleanEmail
  );
  if (isAllowedAppealOfficer) {
    return 'appeal_officer';
  }

  return 'viewer';
}

export async function updateAdminPin(
  newPin: string,
  currentSettings: ProjectSettings,
  updatedBy: string = 'admin'
) {
  const settingsRef = doc(db, 'settings', 'permissions');
  const cleanPin = (newPin || DEFAULT_ADMIN_PIN).trim();
  const updated: ProjectSettings = {
    ...currentSettings,
    adminPin: cleanPin,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await setDoc(settingsRef, updated, { merge: true });
  return updated;
}

/**
 * สิทธิ์แก้ไขข้อมูลทั้งหมด (เพิ่ม, ลบ, แก้ไข, กรอกคำพิพากษา, ขยายเวลา)
 */
export function canUserEdit(role: UserRole): boolean {
  return role === 'admin' || role === 'editor';
}

/**
 * สิทธิ์กดเสร็จสิ้นสำนวน (แอดมิน, ผู้มีสิทธิ์แก้ไข, และเจ้าหน้าที่คุมอุทธรณ์)
 */
export function canUserComplete(role: UserRole): boolean {
  return role === 'admin' || role === 'editor' || role === 'appeal_officer';
}

/**
 * ตรวจสอบว่าเป็นเจ้าหน้าที่คุมอุทธรณ์ (ดูสำนวนได้ และกดได้แค่เสร็จสิ้นเท่านั้น)
 */
export function isAppealOfficer(role: UserRole): boolean {
  return role === 'appeal_officer';
}

/**
 * Real-time subscription to cases collection
 */
export function subscribeToCases(
  onData: (cases: AppealCase[]) => void,
  onError?: (err: Error) => void
) {
  const casesCol = collection(db, 'cases');
  return onSnapshot(
    casesCol,
    (snapshot) => {
      const casesList: AppealCase[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        casesList.push({
          id: d.id,
          ...data,
        } as AppealCase);
      });
      // Sort descending by filingDate or createdAt
      casesList.sort((a, b) => {
        const dateA = a.filingDate || a.createdAt || '';
        const dateB = b.filingDate || b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      onData(casesList);
    },
    (err) => {
      console.warn('Firestore cases snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time subscription to monthly duty rosters
 */
export function subscribeToDutyRosters(
  onData: (rosters: MonthlyDutyRoster[]) => void,
  onError?: (err: Error) => void
) {
  const rostersCol = collection(db, 'duty_rosters');
  return onSnapshot(
    rostersCol,
    (snapshot) => {
      const list: MonthlyDutyRoster[] = [];
      snapshot.forEach((d) => {
        list.push({
          id: d.id,
          ...d.data(),
        } as MonthlyDutyRoster);
      });
      // Sort descending by monthYear
      list.sort((a, b) => b.monthYear.localeCompare(a.monthYear));
      onData(list);
    },
    (err) => {
      console.warn('Firestore duty rosters snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time subscription to project permissions settings
 */
export function subscribeToProjectSettings(
  onData: (settings: ProjectSettings) => void,
  onError?: (err: Error) => void
) {
  const settingsDocRef = doc(db, 'settings', 'permissions');
  return onSnapshot(
    settingsDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ProjectSettings;
        onData({
          adminEmail: data.adminEmail || ADMIN_EMAIL,
          allowedEditors: data.allowedEditors || [],
          adminPin: data.adminPin || DEFAULT_ADMIN_PIN,
          updatedAt: data.updatedAt,
        });
      } else {
        onData(DEFAULT_SETTINGS);
      }
    },
    (err) => {
      console.warn('Firestore settings snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Save or update case in Firestore
 */
export async function saveCaseToFirestore(caseItem: AppealCase): Promise<void> {
  const docRef = doc(db, 'cases', caseItem.id);
  // Clean undefined properties before saving to Firestore
  const cleanData = JSON.parse(JSON.stringify(caseItem));
  if (!caseItem.extendedDeadline) {
    cleanData.extendedDeadline = deleteField();
  }
  if (!caseItem.extensionCount) {
    cleanData.extensionCount = deleteField();
  }
  // Firestore per-document limit is 1 MiB (1,048,576 bytes). Ensure base64 string does not exceed safe margin
  if (cleanData.judgmentPhotoUrl && typeof cleanData.judgmentPhotoUrl === 'string' && cleanData.judgmentPhotoUrl.length > 850000) {
    console.warn('judgmentPhotoUrl is larger than 850KB, omitting from Firestore doc to avoid rejection');
    cleanData.judgmentPhotoUrl = deleteField();
  }
  await setDoc(docRef, cleanData, { merge: true });
}

/**
 * Batch save cases (for initial sync or bulk updates)
 */
export async function saveCasesBatchToFirestore(cases: AppealCase[]): Promise<void> {
  const batch = writeBatch(db);
  cases.forEach((c) => {
    const docRef = doc(db, 'cases', c.id);
    const cleanData = JSON.parse(JSON.stringify(c));
    if (!c.extendedDeadline) {
      cleanData.extendedDeadline = deleteField();
    }
    if (!c.extensionCount) {
      cleanData.extensionCount = deleteField();
    }
    if (cleanData.judgmentPhotoUrl && typeof cleanData.judgmentPhotoUrl === 'string' && cleanData.judgmentPhotoUrl.length > 850000) {
      cleanData.judgmentPhotoUrl = deleteField();
    }
    batch.set(docRef, cleanData, { merge: true });
  });
  await batch.commit();
}

/**
 * Upload all local cases, rosters, and follow-ups to Firestore
 */
export async function uploadAllLocalDataToFirestore(
  cases: AppealCase[],
  dutyRosters: MonthlyDutyRoster[],
  followUps: DailyJudgmentFollowUp[]
): Promise<{ casesCount: number; rostersCount: number; followUpsCount: number }> {
  if (cases.length > 0) {
    await saveCasesBatchToFirestore(cases);
  }
  for (const r of dutyRosters) {
    await saveDutyRosterToFirestore(r);
  }
  for (const f of followUps) {
    await saveFollowUpToFirestore(f);
  }
  return {
    casesCount: cases.length,
    rostersCount: dutyRosters.length,
    followUpsCount: followUps.length,
  };
}

/**
 * Delete case from Firestore
 */
export async function deleteCaseFromFirestore(caseId: string): Promise<void> {
  const docRef = doc(db, 'cases', caseId);
  await deleteDoc(docRef);
}

/**
 * Save monthly duty roster in Firestore
 */
export async function saveDutyRosterToFirestore(roster: MonthlyDutyRoster): Promise<void> {
  const docRef = doc(db, 'duty_rosters', roster.id);
  const cleanData = JSON.parse(JSON.stringify(roster));
  await setDoc(docRef, cleanData, { merge: true });
}

/**
 * Delete monthly duty roster from Firestore
 */
export async function deleteDutyRosterFromFirestore(rosterId: string): Promise<void> {
  const docRef = doc(db, 'duty_rosters', rosterId);
  await deleteDoc(docRef);
}

/**
 * Update project settings (Admin only)
 */
export async function updateProjectSettingsInFirestore(
  settings: ProjectSettings,
  userEmail: string
): Promise<void> {
  const docRef = doc(db, 'settings', 'permissions');
  await setDoc(
    docRef,
    {
      ...settings,
      adminEmail: ADMIN_EMAIL,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
    },
    { merge: true }
  );
}

/**
 * Real-time subscription to daily judgment follow-ups
 */
export function subscribeToFollowUps(
  onData: (followUps: DailyJudgmentFollowUp[]) => void,
  onError?: (err: Error) => void
) {
  const followUpsCol = collection(db, 'follow_ups');
  return onSnapshot(
    followUpsCol,
    (snapshot) => {
      const list: DailyJudgmentFollowUp[] = [];
      snapshot.forEach((d) => {
        list.push({
          id: d.id,
          ...d.data(),
        } as DailyJudgmentFollowUp);
      });
      list.sort((a, b) => b.followUpDate.localeCompare(a.followUpDate));
      onData(list);
    },
    (err) => {
      console.warn('Firestore follow_ups snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Save or update daily follow-up in Firestore
 */
export async function saveFollowUpToFirestore(followUp: DailyJudgmentFollowUp): Promise<void> {
  const docRef = doc(db, 'follow_ups', followUp.id);
  const cleanData = JSON.parse(JSON.stringify(followUp));
  await setDoc(docRef, cleanData, { merge: true });
}

/**
 * Delete follow-up from Firestore
 */
export async function deleteFollowUpFromFirestore(followUpId: string): Promise<void> {
  const docRef = doc(db, 'follow_ups', followUpId);
  await deleteDoc(docRef);
}

/**
 * Real-time subscription to permission requests
 */
export function subscribeToPermissionRequests(
  onData: (requests: PermissionRequest[]) => void,
  onError?: (err: Error) => void
) {
  const requestsCol = collection(db, 'permission_requests');
  return onSnapshot(
    requestsCol,
    (snapshot) => {
      const list: PermissionRequest[] = [];
      snapshot.forEach((d) => {
        list.push({
          id: d.id,
          ...d.data(),
        } as PermissionRequest);
      });
      list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
      onData(list);
    },
    (err) => {
      console.warn('Firestore permission requests snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Request edit permission from admin
 */
export async function requestEditPermission(
  user: { email: string; displayName?: string | null; photoURL?: string | null },
  note?: string,
  requestedRole: 'editor' | 'appeal_officer' = 'editor'
): Promise<void> {
  const cleanEmail = user.email.toLowerCase().trim();
  // Safe document ID using encoded email
  const docId = `req_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const docRef = doc(db, 'permission_requests', docId);
  const payload: PermissionRequest = {
    id: docId,
    email: cleanEmail,
    displayName: user.displayName || cleanEmail.split('@')[0],
    photoURL: user.photoURL || undefined,
    requestedAt: new Date().toISOString(),
    requestedRole,
    status: 'pending',
    note: note || (requestedRole === 'appeal_officer'
      ? 'ขอสิทธิ์เจ้าหน้าที่คุมอุทธรณ์ (ดูสำนวนและกดเสร็จสิ้นสำนวน)'
      : 'ขอสิทธิ์เพื่อร่วมแก้ไขและบันทึกข้อมูลสำนวนคดี'),
  };
  const cleanData = JSON.parse(JSON.stringify(payload));
  await setDoc(docRef, cleanData, { merge: true });
}

/**
 * Approve permission request and add user to allowedEditors or allowedAppealOfficers
 */
export async function approveEditPermission(
  requestId: string,
  userEmail: string,
  currentSettings: ProjectSettings,
  adminEmail: string,
  targetRole: 'editor' | 'appeal_officer' = 'editor'
): Promise<void> {
  const cleanEmail = userEmail.toLowerCase().trim();
  const currentEditors = currentSettings.allowedEditors || [];
  const currentOfficers = currentSettings.allowedAppealOfficers || [];

  let updatedEditors = [...currentEditors];
  let updatedOfficers = [...currentOfficers];

  if (targetRole === 'appeal_officer') {
    if (!updatedOfficers.some((e) => e.toLowerCase().trim() === cleanEmail)) {
      updatedOfficers.push(cleanEmail);
    }
    // หากเคยอยู่ใน editors ให้เอาออก
    updatedEditors = updatedEditors.filter((e) => e.toLowerCase().trim() !== cleanEmail);
  } else {
    if (!updatedEditors.some((e) => e.toLowerCase().trim() === cleanEmail)) {
      updatedEditors.push(cleanEmail);
    }
    // หากเคยอยู่ใน officers ให้เอาออก
    updatedOfficers = updatedOfficers.filter((e) => e.toLowerCase().trim() !== cleanEmail);
  }

  await updateProjectSettingsInFirestore(
    {
      ...currentSettings,
      allowedEditors: updatedEditors,
      allowedAppealOfficers: updatedOfficers,
    },
    adminEmail
  );

  // Update request doc status
  const reqDocRef = doc(db, 'permission_requests', requestId);
  await setDoc(reqDocRef, { status: 'approved', approvedRole: targetRole }, { merge: true });
}

/**
 * Reject permission request
 */
export async function rejectEditPermission(
  requestId: string
): Promise<void> {
  const reqDocRef = doc(db, 'permission_requests', requestId);
  await setDoc(reqDocRef, { status: 'rejected' }, { merge: true });
}

/**
 * Directly add email to allowed editors
 */
export async function addAllowedEditor(
  email: string,
  currentSettings: ProjectSettings,
  adminEmail: string
): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  const currentEditors = currentSettings.allowedEditors || [];
  const currentOfficers = currentSettings.allowedAppealOfficers || [];

  if (!currentEditors.some((e) => e.toLowerCase().trim() === cleanEmail)) {
    const updatedEditors = [...currentEditors, cleanEmail];
    // ถ้าเคยเป็น officer ให้อัปเกรดเป็น editor
    const updatedOfficers = currentOfficers.filter((e) => e.toLowerCase().trim() !== cleanEmail);
    await updateProjectSettingsInFirestore(
      {
        ...currentSettings,
        allowedEditors: updatedEditors,
        allowedAppealOfficers: updatedOfficers,
      },
      adminEmail
    );
  }
}

/**
 * Remove email from allowed editors
 */
export async function removeAllowedEditor(
  email: string,
  currentSettings: ProjectSettings,
  adminEmail: string
): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  const currentEditors = currentSettings.allowedEditors || [];
  const updatedEditors = currentEditors.filter(
    (e) => e.toLowerCase().trim() !== cleanEmail
  );
  await updateProjectSettingsInFirestore(
    {
      ...currentSettings,
      allowedEditors: updatedEditors,
    },
    adminEmail
  );
}

/**
 * Directly add email to allowed appeal officers (เจ้าหน้าที่คุมอุทธรณ์: ดูสำนวนได้ และกดเสร็จสิ้นได้เท่านั้น)
 */
export async function addAllowedAppealOfficer(
  email: string,
  currentSettings: ProjectSettings,
  adminEmail: string
): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  const currentOfficers = currentSettings.allowedAppealOfficers || [];
  const currentEditors = currentSettings.allowedEditors || [];

  if (!currentOfficers.some((e) => e.toLowerCase().trim() === cleanEmail)) {
    const updatedOfficers = [...currentOfficers, cleanEmail];
    // ถ้าเคยอยู่ใน editors ให้เอาออก
    const updatedEditors = currentEditors.filter((e) => e.toLowerCase().trim() !== cleanEmail);
    await updateProjectSettingsInFirestore(
      {
        ...currentSettings,
        allowedEditors: updatedEditors,
        allowedAppealOfficers: updatedOfficers,
      },
      adminEmail
    );
  }
}

/**
 * Remove email from allowed appeal officers
 */
export async function removeAllowedAppealOfficer(
  email: string,
  currentSettings: ProjectSettings,
  adminEmail: string
): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  const currentOfficers = currentSettings.allowedAppealOfficers || [];
  const updatedOfficers = currentOfficers.filter(
    (e) => e.toLowerCase().trim() !== cleanEmail
  );
  await updateProjectSettingsInFirestore(
    {
      ...currentSettings,
      allowedAppealOfficers: updatedOfficers,
    },
    adminEmail
  );
}

/**
 * Seed initial sample data to Firestore if collection is empty
 */
export async function seedInitialFirestoreDataIfEmpty(
  initialCases: AppealCase[],
  initialRosters: MonthlyDutyRoster[],
  initialFollowUps?: DailyJudgmentFollowUp[]
): Promise<boolean> {
  try {
    const casesSnap = await getDocs(collection(db, 'cases'));
    let didSeed = false;

    if (casesSnap.empty && initialCases.length > 0) {
      await saveCasesBatchToFirestore(initialCases);
      console.log('Seeded initial cases to Firestore');
      didSeed = true;
    }

    const rostersSnap = await getDocs(collection(db, 'duty_rosters'));
    if (rostersSnap.empty && initialRosters.length > 0) {
      for (const r of initialRosters) {
        await saveDutyRosterToFirestore(r);
      }
      console.log('Seeded initial duty rosters to Firestore');
      didSeed = true;
    }

    if (initialFollowUps && initialFollowUps.length > 0) {
      const followUpsSnap = await getDocs(collection(db, 'follow_ups'));
      if (followUpsSnap.empty) {
        for (const f of initialFollowUps) {
          await saveFollowUpToFirestore(f);
        }
        console.log('Seeded initial follow-ups to Firestore');
        didSeed = true;
      }
    }

    const settingsDocRef = doc(db, 'settings', 'permissions');
    await setDoc(
      settingsDocRef,
      {
        ...DEFAULT_SETTINGS,
        isInitialized: true,
        initializedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return didSeed;
  } catch (err) {
    console.warn('Error during Firestore seed:', err);
    return false;
  }
}
