import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, obj = user
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(false);
        setChecked(true);
        return;
      }
      try {
        const admin = await getDoc(doc(db, "admins", firebaseUser.uid));
        setUser(admin.exists() ? { uid: firebaseUser.uid, email: firebaseUser.email } : false);
        if (!admin.exists()) await signOut(auth);
      } catch {
        setUser(false);
      } finally {
        setChecked(true);
      }
    });
  }, []);

  const login = async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const admin = await getDoc(doc(db, "admins", credential.user.uid));
    if (!admin.exists()) {
      await signOut(auth);
      throw new Error("Kontot saknar funktionärsbehörighet.");
    }
    const data = { uid: credential.user.uid, email: credential.user.email };
    setUser(data);
    return data;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, checked, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
