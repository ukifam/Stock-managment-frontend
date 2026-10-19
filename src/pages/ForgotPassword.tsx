import { useState, type FormEvent } from 'react'
import { api } from '../api'
import type { Page, Theme } from '../types'

type ForgotPasswordProps = {
  theme: Theme
  toggleTheme: () => void
  setPage: (page: Page) => void
}

export function ForgotPassword({ theme, toggleTheme, setPage }: ForgotPasswordProps) {
  const urlToken = new URLSearchParams(window.location.search).get('token') || ''
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(() => urlToken)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [requested, setRequested] = useState(() => Boolean(urlToken))
  const [message, setMessage] = useState('')
  const [infoNote, setInfoNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const requestReset = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }
    setLoading(true)
    setError('')
    setMessage('')
    setInfoNote('')
    try {
      const response = await api.requestPasswordReset(trimmedEmail)
      setRequested(true)
      setMessage(response.message)
      if (response.resetToken) {
        setToken(response.resetToken)
        if (!response.emailSent) {
          setInfoNote('Server SMTP is not configured yet. Your reset token was auto-filled below so you can proceed immediately.')
        }
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not request a password reset.')
    } finally {
      setLoading(false)
    }
  }

  const confirmReset = async (event: FormEvent) => {
    event.preventDefault()
    if (!token.trim()) {
      setError('A valid reset token is required.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await api.resetPassword(token.trim(), password)
      setMessage(response.message || 'Password reset complete! Redirecting to sign in...')
      window.setTimeout(() => setPage('login'), 1200)
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not reset the password.')
    } finally {
      setLoading(false)
    }
  }

  const handleChangeEmail = () => {
    setRequested(false)
    setError('')
    setMessage('')
    setInfoNote('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className={`auth-root ${theme}`}>
      <button type="button" className="auth-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">T</div>
          <h2>Reset Password</h2>
          <p>{requested ? 'Create a new secure password' : 'Restore access to your business account'}</p>
        </div>

        {error && (
          <div className="auth-alert error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="auth-alert success" role="status">
            <span>✅</span>
            <span>{message}</span>
          </div>
        )}
        {infoNote && (
          <div className="auth-alert info" role="status">
            <span>ℹ️</span>
            <span>{infoNote}</span>
          </div>
        )}

        {!requested ? (
          <form className="auth-form" onSubmit={requestReset}>
            <div className="auth-field">
              <label htmlFor="reset-email">Email Address</label>
              <div className="input-wrap">
                <span className="input-icon">✉️</span>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@business.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <span className="auth-field-hint">
                Enter your account email to receive a password reset link or generate an access key.
              </span>
            </div>

            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? 'Requesting…' : 'Request Password Reset'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '0.4rem' }}>
              <button
                type="button"
                className="auth-link-subtle"
                onClick={() => setRequested(true)}
              >
                Already have a reset token? Enter it directly
              </button>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={confirmReset}>
            {email && (
              <div className="auth-account-target">
                <span className="auth-target-icon">👤</span>
                <div className="auth-target-text">
                  <span className="auth-target-label">Account Email</span>
                  <span className="auth-target-email">{email}</span>
                </div>
                <button
                  type="button"
                  className="auth-target-action"
                  onClick={handleChangeEmail}
                  title="Use a different email address"
                >
                  Change
                </button>
              </div>
            )}

            <div className="auth-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="reset-token">Reset Token</label>
                {!email && (
                  <button
                    type="button"
                    className="auth-target-action"
                    onClick={handleChangeEmail}
                  >
                    Request a token
                  </button>
                )}
              </div>
              <div className="input-wrap">
                <span className="input-icon">🔑</span>
                <input
                  id="reset-token"
                  required
                  placeholder="Paste your reset token"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reset-password">New Password</label>
              <div className="input-wrap">
                <span className="input-icon">🔒</span>
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="toggle-pass-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reset-confirm">Confirm New Password</label>
              <div className="input-wrap">
                <span className="input-icon">🔒</span>
                <input
                  id="reset-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="toggle-pass-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? 'Setting Password…' : 'Set New Password'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '0.2rem' }}>
              <button
                type="button"
                className="auth-link-subtle"
                onClick={handleChangeEmail}
              >
                &larr; Request for a different email
              </button>
            </div>
          </form>
        )}

        <div className="auth-footer">
          <button type="button" className="auth-link-back" onClick={() => setPage('login')}>
            Return to sign in
          </button>
        </div>
      </div>
    </div>
  )
}
