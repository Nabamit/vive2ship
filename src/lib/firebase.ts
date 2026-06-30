import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-deadlinemate-7acf5ce3-3fb2-4bbe-b457-a5a4dec021ba");

export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');

provider.setCustomParameters({
  prompt: 'consent'
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // In development/reload we might need to restore access token. 
      // If we don't have it in memory, we can request a silent sign-in or let the app know.
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // Retrieve token from session storage strictly as a backup if cachedAccessToken is lost on reload,
        // but let's stick to in-memory as instructed or a temporary session-backed cache for durability in the iframe.
        const backupToken = sessionStorage.getItem('_gcal_token');
        if (backupToken) {
          cachedAccessToken = backupToken;
          if (onAuthSuccess) onAuthSuccess(user, backupToken);
        } else if (!isSigningIn) {
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem('_gcal_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Google Sign-In
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google provider');
    }

    cachedAccessToken = credential.accessToken;
    // We cache in memory, and also back it up in sessionStorage to survive fast preview refreshes.
    sessionStorage.setItem('_gcal_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  return sessionStorage.getItem('_gcal_token');
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  sessionStorage.removeItem('_gcal_token');
};
