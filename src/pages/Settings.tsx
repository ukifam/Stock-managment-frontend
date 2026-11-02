import { useEffect, useState } from 'react'
import { api, type SettingsPatch, type SettingsResponse, type WeeklyEmailStatus } from '../api'
import { Topbar } from '../components/Topbar'
import { useAuth } from '../context/AuthContext'
import type { Page } from '../types'

type SettingsProps = {
  isLight: boolean
  toggleTheme: () => void
  onCurrencyChange?: (currency: string) => void
  setPage?: (page: Page) => void
}

const CURRENCIES = [
  ['RWF', 'Rwandan Franc'],
  ['USD', 'US Dollar'],
  ['EUR', 'Euro'],
  ['GBP', 'British Pound'],
  ['KES', 'Kenyan Shilling'],
  ['UGX', 'Ugandan Shilling'],
  ['TZS', 'Tanzanian Shilling'],
  ['BIF', 'Burundian Franc'],
  ['CDF', 'Congolese Franc'],
]

export function Settings({ isLight, toggleTheme, onCurrencyChange, setPage }: SettingsProps) {
  const { user, logout } = useAuth()
  const [settings, setSettings] = useState<SettingsResponse | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [threshold, setThreshold] = useState('')
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [weekly, setWeekly] = useState<WeeklyEmailStatus | null>(null)
  const [sendingWeekly, setSendingWeekly] = useState(false)
  const isAdmin = ['admin', 'system_admin'].includes(String(user?.role || '').toLowerCase().replace(/[\s-]+/g, '_'))
  const canEdit = isAdmin || Boolean(user?.permissions?.find((p) => p.module === 'settings')?.actions.includes('edit'))

  useEffect(() => {
    api.settings()
      .then((loaded) => {
        setSettings(loaded)
        setDisplayName(loaded.profile.displayName || '')
        setThreshold(String(loaded.inventory.lowStockThreshold ?? ''))
      })
      .catch(() => setStatus({ text: 'Could not load settings.', error: true }))
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    api.weeklyEmailStatus().then(setWeekly).catch(() => setWeekly(null))
  }, [isAdmin])

  const sendWeeklyNow = async () => {
    setSendingWeekly(true)
    setStatus(null)
    try {
      const result = await api.sendWeeklyEmail()
      setStatus({ text: `Report sent to ${result.recipients.length} admin${result.recipients.length === 1 ? '' : 's'}.` })
      setWeekly(await api.weeklyEmailStatus())
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : 'Could not send the report.', error: true })
    } finally {
      setSendingWeekly(false)
    }
  }

  const save = async (patch: SettingsPatch, message: string) => {
    setSaving(true)
    setStatus(null)
    try {
      const updated = await api.updateSettings(patch)
      setSettings(updated)
      onCurrencyChange?.(updated.financial.currency)
      setStatus({ text: message })
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : 'Could not save settings.', error: true })
    } finally {
      setSaving(false)
    }
  }

  const thresholdValue = Number(threshold)
  const thresholdChanged = settings !== null && threshold !== '' && thresholdValue !== settings.inventory.lowStockThreshold
  const nameChanged = settings !== null && displayName.trim() !== (settings.profile.displayName || '')

  return (
    <>
      <Topbar theme={isLight ? 'light' : 'dark'} toggleTheme={toggleTheme} />
      <div className="settings-page page-pad">
        <div className="page-title-row">
          <h1>Settings</h1>
          {status && <span className={`notice inline ${status.error ? 'error' : 'success'}`} role="status">{status.text}</span>}
        </div>
        <section className="settings-grid">
          <article className="panel">
            <h2>Account</h2>
            <dl className="kv-list">
              <div><dt>User</dt><dd>{user?.username || '-'}</dd></div>
              <div><dt>Email</dt><dd>{user?.email || '-'}</dd></div>
              <div><dt>Role</dt><dd>{String(user?.role || '-').replace(/_/g, ' ')}</dd></div>
            </dl>
            <div className="button-row">
              <button type="button" onClick={() => setPage?.('forgot-password')}>Change password</button>
              <button type="button" className="danger-button" onClick={() => { logout(); setPage?.('landing') }}>Sign out</button>
            </div>
          </article>

          <article className="panel">
            <h2>Appearance</h2>
            <div className="segmented" role="group" aria-label="Theme">
              <button type="button" className={!isLight ? 'active' : ''} onClick={() => { if (isLight) toggleTheme() }}>Dark</button>
              <button type="button" className={isLight ? 'active' : ''} onClick={() => { if (!isLight) toggleTheme() }}>Light</button>
            </div>
          </article>

          <article className="panel">
            <h2>Business</h2>
            <label>Display name
              <span className="input-with-action">
                <input value={displayName} disabled={!canEdit || !settings} onChange={(event) => setDisplayName(event.target.value)} />
                {nameChanged && <button type="button" className="primary-action" disabled={saving} onClick={() => save({ profile: { displayName: displayName.trim() } }, 'Display name saved.')}>Save</button>}
              </span>
            </label>
            <label>Currency
              <select value={settings?.financial.currency || 'RWF'} disabled={!canEdit || !settings || saving} onChange={(event) => save({ financial: { currency: event.target.value } }, 'Currency saved.')}>
                {CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
              </select>
            </label>
            <label>Low stock alert at
              <span className="input-with-action">
                <input type="number" min="0" step="any" value={threshold} disabled={!canEdit || !settings} onChange={(event) => setThreshold(event.target.value)} />
                {thresholdChanged && <button type="button" className="primary-action" disabled={saving || !(thresholdValue >= 0)} onClick={() => save({ inventory: { lowStockThreshold: thresholdValue } }, 'Low stock level saved.')}>Save</button>}
              </span>
            </label>
            {isAdmin && <button type="button" className="link-button" onClick={() => setPage?.('organization')}>Business type, branches &amp; warehouses →</button>}
          </article>

          {isAdmin && weekly && (
            <article className="panel">
              <h2>Weekly email report</h2>
              {!weekly.emailConfigured && <p className="notice warning">Email is not set up on the server.</p>}
              <dl className="kv-list">
                <div><dt>Schedule</dt><dd>{weekly.schedule}</dd></div>
                <div><dt>Last sent</dt><dd>{weekly.lastSentFor ? `Week ending ${weekly.lastSentFor}` : 'Never'}</dd></div>
                <div><dt>Recipients</dt><dd className="recipient-list">{weekly.recipients.length ? weekly.recipients.map((email) => <span key={email}>{email}</span>) : '-'}</dd></div>
              </dl>
              <div className="button-row">
                <button type="button" disabled={sendingWeekly || !weekly.emailConfigured} onClick={() => void sendWeeklyNow()}>{sendingWeekly ? 'Sending…' : 'Send now'}</button>
              </div>
            </article>
          )}
        </section>
      </div>
    </>
  )
}
