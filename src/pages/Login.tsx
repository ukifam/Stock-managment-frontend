import { useState } from 'react'
import type React from 'react'
import type { Page, Theme } from '../types'
import { useAuth } from '../context/AuthContext'

type LoginProps = {
  theme: Theme
  toggleTheme: () => void
  setPage: (page: Page) => void
}

export function Login({ theme, toggleTheme, setPage }: LoginProps) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.')
      return
    }

    setLoading(true)
    try {
      await login(email.trim(), password)
      setPage('dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.')
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
          <h2>Welcome Back</h2>
          <p>Sign in to your TRI LTD Business Suite account</p>
        </div>

        {error && (
          <div className="auth-alert error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="login-email">Email Address</label>
            <div className="input-wrap">
              <span className="input-icon">✉️</span>
              <input
                id="login-email"
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="login-password">Password</label>
            </div>
            <div className="input-wrap">
              <span className="input-icon">🔒</span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <button
              type="button"
              className="auth-link"
              onClick={() => setPage('register')}
            >
              Sign up
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
