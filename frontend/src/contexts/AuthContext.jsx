import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { api, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

/**
 * After Firebase sign-in/sign-up we call the backend to upsert the
 * Firestore user profile document, then store that richer profile in state.
 */
async function syncProfile(fbUser, displayName) {
  try {
    const name = displayName || fbUser.displayName || fbUser.email.split("@")[0];
    const { data } = await api.post("/auth/profile", { name });
    return data;
  } catch (err) {
    console.error("[AuthContext] Failed to sync profile:", err);
    // Return a minimal shape so the app doesn't crash
    return {
      id: fbUser.uid,
      email: fbUser.email,
      name: fbUser.displayName || fbUser.email.split("@")[0],
      avatar: (fbUser.displayName || "U").slice(0, 2).toUpperCase(),
      xp: 0, level: 1, streak: 0, title: "Initiate",
      circles: [], achievements: [],
    };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * onAuthStateChanged is the single source of truth.
     * It fires on mount (restoring session from IndexedDB) and on any
     * sign-in / sign-out event.
     */
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Fetch the richer Firestore profile from our backend
        try {
          const { data } = await api.get("/auth/me");
          setUser(data);
        } catch {
          // Backend unreachable — degrade gracefully with Firebase data
          setUser({
            id: fbUser.uid,
            email: fbUser.email,
            name: fbUser.displayName || fbUser.email.split("@")[0],
            avatar: (fbUser.displayName || "U").slice(0, 2).toUpperCase(),
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /** Email + password sign-in */
  const login = async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will fire and set user automatically,
    // but we also sync the profile immediately so the caller gets the data.
    const profile = await syncProfile(auth.currentUser);
    setUser(profile);
    return profile;
  };

  /** Email + password registration */
  const register = async (name, email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const profile = await syncProfile(cred.user, name);
    setUser(profile);
    return profile;
  };

  /** Google OAuth sign-in (popup) */
  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const profile = await syncProfile(cred.user);
    setUser(profile);
    return profile;
  };

  /** Sign out */
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await signOut(auth);
    setUser(null);
  };

  /** Re-fetch the Firestore profile (e.g., after XP/streak updates) */
  const refreshUser = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
