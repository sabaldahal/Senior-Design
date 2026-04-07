import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

function mapFirebaseUser(fbUser) {
  const email = fbUser.email || '';
  return {
    uid: fbUser.uid,
    email,
    username: fbUser.displayName || (email ? email.split('@')[0] : 'User'),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        setUser(fbUser ? mapFirebaseUser(fbUser) : null);
      });
      auth.authStateReady().finally(() => {
        setLoading(false);
      });
      return unsubscribe;
    }

    const token = localStorage.getItem('authToken');
    const saved = localStorage.getItem('user');
    if (token && saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser({
          uid: null,
          email: parsed.email || null,
          username: parsed.username || (parsed.email ? parsed.email.split('@')[0] : null) || 'User',
        });
      } catch {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
    return undefined;
  }, []);

  const loginLegacy = (userData) => {
    setUser({
      uid: null,
      email: userData.email || null,
      username: userData.username || (userData.email ? userData.email.split('@')[0] : null) || 'User',
    });
  };

  const logout = async () => {
    if (auth?.currentUser) {
      try {
        await signOut(auth);
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, logout, loading, loginLegacy }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
