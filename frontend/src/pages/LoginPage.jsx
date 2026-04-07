import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/inventory';

function firebaseErrorMessage(code) {
  const map = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found for this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, loginLegacy } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error('Please enter email and password');
      }

      if (auth) {
        if (isRegister) {
          await createUserWithEmailAndPassword(auth, email.trim(), password);
          setNotice('Account created. You are signed in.');
        } else {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        }
        navigate('/', { replace: true });
        return;
      }

      // Legacy: no Firebase web config — old backend demo login (only if API does not require Firebase tokens)
      const { data } = await authApi.login(email.trim(), password);
      const token = data?.token || data?.accessToken;
      const userData = data?.user || { username: email.trim() };

      if (!token) {
        throw new Error('Login response missing auth token.');
      }

      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(userData));
      loginLegacy(userData);
      navigate('/');
    } catch (err) {
      if (err?.code && String(err.code).startsWith('auth/')) {
        setError(firebaseErrorMessage(err.code));
      } else if (!err.response && !auth) {
        const mockToken = 'mock-jwt-token-' + Date.now();
        const mockUser = { username: email.trim() };
        localStorage.setItem('authToken', mockToken);
        localStorage.setItem('user', JSON.stringify(mockUser));
        loginLegacy(mockUser);
        setNotice('Backend unavailable. Signed in using demo mode.');
        navigate('/');
      } else {
        setError(err.response?.data?.message || err.message || 'Sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-card p-8 border border-neutral-200">
          <div className="text-center mb-8">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600/10 text-primary-600"
              aria-hidden
            >
              <Warehouse size={32} strokeWidth={2} />
            </div>
            <h1 className="text-3xl font-bold text-neutral-900">Warehouse Inventory</h1>
            <p className="text-neutral-600 mt-2">
              {isRegister ? 'Create an account' : 'Sign in to your account'}
            </p>
          </div>

          {!auth && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              Firebase is not configured (missing <code className="text-xs">VITE_FIREBASE_*</code> in{' '}
              <code className="text-xs">.env.local</code>). Using legacy demo login — your API must not require
              Firebase tokens, or add the web config.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg bg-white border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'At least 6 characters' : 'Enter your password'}
                className="w-full px-4 py-3 rounded-lg bg-white border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                disabled={loading}
              />
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                {error}
              </div>
            )}
            {notice && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                {notice}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {auth && (
            <p className="mt-4 text-center text-sm text-neutral-600">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                className="text-primary-600 font-medium hover:underline"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                  setNotice('');
                }}
              >
                {isRegister ? 'Sign in' : 'Register'}
              </button>
            </p>
          )}

          <p className="mt-6 text-center text-neutral-500 text-sm">
            {auth
              ? 'Use the email and password from Firebase Authentication (Email/Password enabled in console).'
              : 'Or use legacy backend login if configured.'}
          </p>
        </div>
      </div>
    </div>
  );
}
