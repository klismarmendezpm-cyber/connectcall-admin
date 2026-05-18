import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, ShieldCheck, Loader2 } from 'lucide-react';
import { getAppSettings } from '../lib/appSettings';
export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const settings = getAppSettings();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await login(username, password, mfaCode);
      if (result.success) {
        navigate(from, {
          replace: true
        });
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-brand-primary rounded-2xl flex items-center justify-center shadow-lg mb-6">
            <KeyRound className="h-8 w-8 text-brand-accent" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900 tracking-tight">
            Vault<span className="text-brand-primary">Sys</span>
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Secure Enterprise Credentials Management
          </p>
        </div>

        <div className="card p-8 shadow-xl border-slate-200/60">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error &&
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ShieldCheck className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            }

            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-700">
                
                Username or Email
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field"
                  placeholder="admin" />
                
              </div>
            </div>

            {settings.requireMfa &&
            <div>
                <label
                htmlFor="mfaCode"
                className="block text-sm font-medium text-slate-700">
                  Security Code
                </label>
                <div className="mt-1">
                  <input
                  id="mfaCode"
                  name="mfaCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="input-field"
                  placeholder="123456" />
                </div>
              </div>
            }

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700">
                
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••" />
                
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-70 disabled:cursor-not-allowed transition-all">
                
                {isSubmitting ?
                <Loader2 className="w-5 h-5 animate-spin" /> :

                'Sign in securely'
                }
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <div className="text-xs text-center text-slate-500">
              <p>Prototype Access:</p>
              <p className="font-mono mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                admin / password123
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>);

};
