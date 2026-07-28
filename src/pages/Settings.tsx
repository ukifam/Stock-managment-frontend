import { useEffect, useState } from 'react'
import { api, type SettingsResponse } from '../api'
import { Topbar } from '../components/Topbar'

export const page = { id: 'settings' as const, label: 'Settings', icon: 'gear' }

type SettingsProps = {
  isLight: boolean
  toggleTheme: () => void
  onCurrencyChange?: (currency: string) => void
}

export function Settings({ isLight, toggleTheme, onCurrencyChange }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsResponse>({
    profile: { displayName: '', email: '' },
    system: { darkMode: !isLight, biometricLogin: false, telemetryReports: true, quantumSync: true },
    inventory: { lowStockThreshold: 0, autoBackupFrequency: '', externalDatabase: '' },
    financial: { currency: 'RWF' },
    hardware: [],
  })
  const [status, setStatus] = useState('')

  useEffect(() => {
    api.settings().then(setSettings).catch(() => undefined)
  }, [])

  const updateCurrency = async (currency: string) => {
    setSettings((current) => ({ ...current, financial: { ...current.financial, currency } }))
    setStatus('Saving currency...')

    try {
      const updated = await api.updateSettings({ financial: { currency } })
      setSettings(updated)
      onCurrencyChange?.(updated.financial.currency)
      setStatus('Currency saved.')
    } catch {
      setStatus('Could not save currency.')
    }
  }

  return (
    <>
      <Topbar placeholder="Search parameters..." theme={isLight ? 'light' : 'dark'} toggleTheme={toggleTheme} />
      <div className="settings-page page-pad">
        <div className="settings-head"><h1>Configuration</h1><p>Manage global system parameters and hardware integrations.</p></div>
        {status && <div style={{ color: status.includes('Could') ? '#d32f2f' : '#1565c0', padding: '8px', marginBottom: '12px', backgroundColor: status.includes('Could') ? '#ffebee' : '#e3f2fd', borderRadius: '4px', fontSize: '14px' }}>{status}</div>}
        <section className="settings-grid">
          <article className="panel profile-panel"><h2>User Profile</h2><label>Display Name<input value={settings.profile.displayName} readOnly /></label><label>Email Address<input value={settings.profile.email} readOnly /></label><div className="two-buttons"><button className="primary-action" type="button">Update Identity</button><button type="button">Reset Password</button></div></article>
          <article className="panel system-panel"><h2>System Settings</h2><div className="setting-list"><SettingToggle label="Dark Mode" note="Switch between dark and white mode" checked={!isLight} onClick={toggleTheme} /><SettingToggle label="Biometric Login" note="FaceID & Fingerprint" checked={settings.system.biometricLogin} /><SettingToggle label="Telemetry Reports" note="Share usage metrics" checked={settings.system.telemetryReports} /><SettingToggle label="Quantum Sync" note="Real-time DB mirroring" checked={settings.system.quantumSync} /></div></article>
          <article className="panel inventory-config"><h2>Inventory Configuration</h2><label>Low Stock Threshold<input value={`${settings.inventory.lowStockThreshold} Units`} readOnly /></label><label>Currency<select value={settings.financial.currency} onChange={(event) => updateCurrency(event.target.value)}><option value="RWF">RWF - Rwandan Franc</option><option value="USD">USD - US Dollar</option><option value="EUR">EUR - Euro</option><option value="GBP">GBP - British Pound</option><option value="KES">KES - Kenyan Shilling</option><option value="UGX">UGX - Ugandan Shilling</option><option value="TZS">TZS - Tanzanian Shilling</option></select></label><label>Auto-backup Frequency<select value={settings.inventory.autoBackupFrequency} disabled><option>{settings.inventory.autoBackupFrequency}</option></select></label><div className="connection-box"><b>External Database Connection</b><span>SSL encryption active | {settings.inventory.externalDatabase}</span><button type="button">Re-authenticate</button></div></article>
          <article className="panel hardware-panel"><h2>Hardware</h2>{settings.hardware.map((item) => <div className="hardware-row" key={item.name}><span>{item.name}</span><i className={item.status === 'attention' ? 'danger-dot' : ''} /></div>)}<button type="button" className="ghost-button">Register New Hardware</button></article>
        </section>
        <div className="settings-footer"><button type="button">Discard Changes</button><button className="primary-action" type="button">Commit All Updates</button></div>
      </div>
    </>
  )
}

function SettingToggle({ label, note, checked, onClick }: { label: string; note: string; checked: boolean; onClick?: () => void }) {
  return <button className="setting-toggle" type="button" onClick={onClick} aria-pressed={checked}><span><b>{label}</b><small>{note}</small></span><i className={checked ? 'on' : ''} /></button>
}
