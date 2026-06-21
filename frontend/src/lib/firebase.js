import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

/**
 * Firebase client configuration.
 * Values are supplied via REACT_APP_FIREBASE_* environment variables.
 * Never commit real keys — add frontend/.env to .gitignore.
 */
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

/** Firebase Authentication instance */
export const auth = getAuth(app);

/** Google OAuth provider (for future Google Sign-In support) */
export const googleProvider = new GoogleAuthProvider();

export default app;
