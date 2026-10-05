import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { ADMIN_EMAIL } from './firestoreService';

export interface AppAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isStaffAdmin?: boolean;
}

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

export const getSavedAuthSession = (): AppAuthUser | null => {
  try {
    const raw = localStorage.getItem('app_auth_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveAuthSession = (user: AppAuthUser | null) => {
  try {
    if (user) {
      localStorage.setItem('app_auth_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('app_auth_session');
    }
  } catch (err) {
    console.warn('Could not save auth session:', err);
  }
};

export const isGuestModeEnabled = (): boolean => {
  try {
    return localStorage.getItem('app_guest_mode') === 'true';
  } catch {
    return false;
  }
};

export const setGuestMode = (enabled: boolean) => {
  try {
    if (enabled) {
      localStorage.setItem('app_guest_mode', 'true');
    } else {
      localStorage.removeItem('app_guest_mode');
    }
  } catch (err) {
    console.warn('Could not set guest mode:', err);
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User | AppAuthUser, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  // Capture redirect sign-in result if user returned from signInWithRedirect
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
        }
        const appUser: AppAuthUser = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
        };
        saveAuthSession(appUser);
        if (onAuthSuccess) {
          onAuthSuccess(result.user, cachedAccessToken);
        }
      }
    })
    .catch((err) => {
      console.warn('Redirect sign-in check error:', err);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const appUser: AppAuthUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };
      saveAuthSession(appUser);
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      // Check if local staff / admin session exists
      const saved = getSavedAuthSession();
      if (saved) {
        if (onAuthSuccess) onAuthSuccess(saved, cachedAccessToken);
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
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
    const appUser: AppAuthUser = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    };
    saveAuthSession(appUser);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Sign in using redirect (does not require pop-ups, works on all browsers and mobile devices)
 */
export const googleSignInRedirect = async (): Promise<void> => {
  try {
    isSigningIn = true;
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Redirect sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Sign in using staff/admin PIN code (100% works on all PCs, tablets, phones without Google OAuth popup)
 */
export const loginWithAdminPin = (pin: string, expectedPin: string = '5555'): AppAuthUser => {
  const cleanPin = pin.trim();
  const cleanExpected = (expectedPin || '5555').trim();
  if (!cleanPin || cleanPin !== cleanExpected) {
    throw new Error('รหัสผ่าน PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
  }
  const adminUser: AppAuthUser = {
    uid: 'staff-admin-session',
    email: ADMIN_EMAIL,
    displayName: 'แอดมินเจ้าของระบบ (Admin PIN)',
    photoURL: null,
    isStaffAdmin: true,
  };
  saveAuthSession(adminUser);
  return adminUser;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('SignOut error:', err);
  }
  cachedAccessToken = null;
  saveAuthSession(null);
};

