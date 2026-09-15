import { useState } from 'react'
import type React from 'react'
import type { Page, Theme } from '../types'
import { useAuth } from '../context/AuthContext'

type RegisterProps = {
  theme: Theme
  toggleTheme: () => void
  setPage: (page: Page) => void
}

export function Register({ theme, toggleTheme, setPage }: RegisterProps) {
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError('Please provide your full name or company username.')
      return
    }

    if (!email.trim()) {
      setError('Please provide a valid email address.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await register(username.trim(), email.trim(), password)
      setPage('dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`auth-root ${theme}`}>
      <div className="auth-theme-btn" onClick={toggleTheme} title="Toggle Theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo" onClick={() => setPage('landing')} style={{ cursor: 'pointer' }}>
            ▲
          </div>
          <h2>Create Your Account</h2>
          <p>Start managing your inventory and sales with TRI LTD Suite</p>
        </div>

        {error && (
          <div className="auth-alert error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="reg-username">Full Name / Username</label>
            <div className="input-wrap">
              <span className="input-icon">👤</span>
              <input
                id="reg-username"
                type="text"
                placeholder="John Doe or Acme Retail"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="reg-email">Email Address</label>
            <div className="input-wrap">
              <span className="input-icon">✉️</span>
              <input
                id="reg-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="reg-password">Password (min. 6 characters)</label>
            <div className="input-wrap">
              <span className="input-icon">🔒</span>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
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
            <label htmlFor="reg-confirm">Confirm Password</label>
            <div className="input-wrap">
              <span className="input-icon">🔑</span>
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? 'Creating Account…' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button
              type="button"
              className="auth-link"
              onClick={() => setPage('login')}
            >
              Sign in
            </button>
          </p>
          <button
            type="button"
            className="auth-link-back"
            onClick={() => setPage('landing')}
          >
            ← Return to Home
          </button>
        </div>
      </div>
    </div>
  )
}
