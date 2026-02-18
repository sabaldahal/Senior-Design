import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/inventory';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (!username.trim() || !password.trim()) {
        throw new Error('Please enter username and password');
      }

      // Try live backend first.
      const { data } = await authApi.login(username.trim(), password);
      const token = data?.token || data?.accessToken;
      const userData = data?.user || { username: username.trim() };

      if (!token) {
        throw new Error('Login response missing auth token.');
      }

      login(userData, token);
      navigate('/');
    } catch (err) {
      // If backend is unavailable during development, allow demo login.
      const isNetworkFailure = !err.response;
      if (isNetworkFailure) {
        const mockToken = 'mock-jwt-token-' + Date.now();
        const mockUser = { username: username.trim() };
        login(mockUser, mockToken);
        setNotice('Backend unavailable. Signed in using demo mode.');
        navigate('/');
      } else {
        setError(err.response?.data?.message || err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white">AI Inventory</h1>
            <p className="text-slate-300 mt-2">Sign in to your account</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                Username or Email
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoComplete="username"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 text-red-200 text-sm">
                {error}
              </div>
            )}
            {notice && (
              <div className="p-3 rounded-lg bg-emerald-500/20 text-emerald-100 text-sm">
                {notice}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-slate-400 text-sm">Use your backend credentials.</p>
        </div>
      </div>
    </div>
  );
}
