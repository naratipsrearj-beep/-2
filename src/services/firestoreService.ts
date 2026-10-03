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
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppealCase, MonthlyDutyRoster, DailyJudgmentFollowUp } from '../types/appeal';

// Initialize Firebase App & Firestore singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const ADMIN_EMAIL = 'naratipsrearj@gmail.com';

export interface ProjectSettings {
  adminEmail: string;
  allowedEditors: string[];
  updatedAt?: string;
  updatedBy?: string;
}

// Default settings
export const DEFAULT_SETTINGS: ProjectSettings = {
  adminEmail: ADMIN_EMAIL,
  allowedEditors: [],
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
  settings: ProjectSettings = DEFAULT_SETTINGS
): 'admin' | 'editor' | 'viewer' {
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

  return 'viewer';
}

export function canUserEdit(role: 'admin' | 'editor' | 'viewer'): boolean {
  return role === 'admin' || role === 'editor';
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
    batch.set(docRef, cleanData, { merge: true });
  });
  await batch.commit();
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
 * Seed initial sample data to Firestore if collection is empty
 */
export async function seedInitialFirestoreDataIfEmpty(
  initialCases: AppealCase[],
  initialRosters: MonthlyDutyRoster[]
): Promise<boolean> {
  try {
    const casesSnap = await getDocs(collection(db, 'cases'));
    if (casesSnap.empty && initialCases.length > 0) {
      await saveCasesBatchToFirestore(initialCases);
      console.log('Seeded initial cases to Firestore');
    }

    const rostersSnap = await getDocs(collection(db, 'duty_rosters'));
    if (rostersSnap.empty && initialRosters.length > 0) {
      for (const r of initialRosters) {
        await saveDutyRosterToFirestore(r);
      }
      console.log('Seeded initial duty rosters to Firestore');
    }

    const settingsDoc = await getDoc(doc(db, 'settings', 'permissions'));
    if (!settingsDoc.exists()) {
      await setDoc(doc(db, 'settings', 'permissions'), DEFAULT_SETTINGS);
    }
    return true;
  } catch (err) {
    console.warn('Error during Firestore seed:', err);
    return false;
  }
}
