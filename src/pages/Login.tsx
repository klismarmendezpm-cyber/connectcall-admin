import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck
} from 'lucide-react';
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
    <div className="login-page">
      <div className="login-bg" aria-hidden="true" />

      <div className="login-shell">
        <div className="login-card">
          <section className="login-art-panel">
            <div className="login-logo">
              <KeyRound className="login-logo-icon" />
              <div className="login-logo-text">
                Vault<span className="text-emerald-500">SYS</span>
              </div>
            </div>

            <div className="login-illustration-wrap">
              <img
                src="/login-illustration.png"
                alt=""
                className="login-illustration" />
            </div>
          </section>

          <section className="login-form-panel">
            <div className="login-locale">
              HND
              <span className="login-flag" />
            </div>

            <div className="login-form-box">
              <div className="login-mobile-brand">
                <div className="login-mobile-icon">
                  <KeyRound className="login-mobile-key" />
                </div>
                <div className="login-mobile-title">
                  Vault<span className="text-emerald-500">Sys</span>
                </div>
              </div>

              <div className="login-heading">
                <h1>Login</h1>
                <p>
                  Welcome back. Please login to your account.
                </p>
              </div>

              <form className="login-form" onSubmit={handleSubmit}>
                {error &&
                <div className="login-error">
                    <ShieldCheck className="login-error-icon" />
                    <p>{error}</p>
                  </div>
                }

                <div className="login-field">
                  <label
                    htmlFor="username"
                    className="login-label">
                    Your email
                  </label>
                  <div className="login-input-wrap">
                    <Mail className="login-input-icon" />
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="login-input login-input-active"
                      placeholder="admin@example.com" />
                  </div>
                </div>

                <div className="login-field">
                  <label
                    htmlFor="password"
                    className="login-label">
                    Your password
                  </label>
                  <div className="login-input-wrap">
                    <Lock className="login-input-icon" />
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="login-input"
                      placeholder="Password" />
                  </div>
                </div>

                {settings.requireMfa &&
                <div className="login-field">
                    <label
                    htmlFor="mfaCode"
                    className="login-label">
                      Security code
                    </label>
                    <div className="login-input-wrap">
                      <ShieldCheck className="login-input-icon" />
                      <input
                      id="mfaCode"
                      name="mfaCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      className="login-input"
                      placeholder="123456" />
                    </div>
                  </div>
                }

                <label className="login-remember">
                  <input
                    type="checkbox"
                    className="login-checkbox" />
                  Keep me logged in
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="login-submit">
                  {isSubmitting ?
                  <Loader2 className="login-spinner" /> :
                  'Login'
                  }
                </button>
              </form>

              <div className="login-footer">
                @ 2026 All rights reserved.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>);
};
