import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Default Google Auth Provider for basic login and Firestore access
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account'
});

// Flag to indicate ongoing sign-in flow
let isSigningIn = false;
// Cache access token in memory (never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string | null } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export interface AppAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isPinAdmin?: boolean;
}

export const DEFAULT_ADMIN_PIN = '951753';
export const PIN_SESSION_KEY = 'appeal_app_admin_pin_session';

export const getSavedPinAdminSession = (): AppAuthUser | null => {
  try {
    const raw = localStorage.getItem(PIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.isPinAdmin) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to parse PIN session', err);
  }
  return null;
};

export const savePinAdminSession = (user: AppAuthUser) => {
  try {
    localStorage.setItem(PIN_SESSION_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Failed to save PIN session', err);
  }
};

export const clearPinAdminSession = () => {
  try {
    localStorage.removeItem(PIN_SESSION_KEY);
  } catch (err) {
    console.error('Failed to clear PIN session', err);
  }
};

export const loginWithAdminPin = (inputPin: string, expectedPin: string = DEFAULT_ADMIN_PIN): AppAuthUser => {
  const cleanInput = (inputPin || '').trim();
  const cleanExpected = (expectedPin || DEFAULT_ADMIN_PIN).trim();

  // Accept 951753 or configured PIN
  if (cleanInput === cleanExpected || cleanInput === '951753') {
    const adminUser: AppAuthUser = {
      uid: 'admin-pin-' + Date.now(),
      email: 'naratipsrearj@gmail.com',
      displayName: 'ผู้ดูแลระบบ (Admin PIN)',
      photoURL: null,
      isPinAdmin: true
    };
    savePinAdminSession(adminUser);
    return adminUser;
  }
  throw new Error('รหัสผ่าน PIN ไม่ถูกต้อง โปรดตรวจสอบรหัสผ่านอีกครั้ง');
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('SignOut error or not signed in via Google', e);
  }
  cachedAccessToken = null;
  clearPinAdminSession();
};

