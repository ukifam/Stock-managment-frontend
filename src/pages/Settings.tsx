import { Topbar } from '../components/Topbar'

type SettingsProps = {
  isLight: boolean
  toggleTheme: () => void
}

export function Settings({ isLight, toggleTheme }: SettingsProps) {
  return (
    <>
      <Topbar placeholder="Search parameters..." theme={isLight ? 'light' : 'dark'} toggleTheme={toggleTheme} />
      <div className="settings-page page-pad">
        <div className="settings-head"><h1>Configuration</h1><p>Manage global system parameters and hardware integrations.</p></div>
        <section className="settings-grid">
          <article className="panel profile-panel"><h2>User Profile</h2><label>Display Name<input defaultValue="System Operator 01" /></label><label>Email Address<input defaultValue="operator@quantum-ai.nexus" /></label><div className="two-buttons"><button className="primary-action" type="button">Update Identity</button><button type="button">Reset Password</button></div></article>
          <article className="panel system-panel"><h2>System Settings</h2><div className="setting-list"><SettingToggle label="Dark Mode" note="Switch between dark and white mode" checked={!isLight} onClick={toggleTheme} /><SettingToggle label="Biometric Login" note="FaceID & Fingerprint" checked={false} /><SettingToggle label="Telemetry Reports" note="Share usage metrics" checked /><SettingToggle label="Quantum Sync" note="Real-time DB mirroring" checked /></div></article>
          <article className="panel inventory-config"><h2>Inventory Configuration</h2><label>Low Stock Threshold<input defaultValue="25 Units" /></label><label>Auto-backup Frequency<select defaultValue="Daily"><option>Daily at 00:00</option></select></label><div className="connection-box"><b>External Database Connection</b><span>SSL encryption active | node-72.nexus.cloud</span><button type="button">Re-authenticate</button></div></article>
          <article className="panel hardware-panel"><h2>Hardware</h2>{['Handheld Scanner #02', 'Thermal Label Printer', 'Precision Scale v4'].map((item, index) => <div className="hardware-row" key={item}><span>{item}</span><i className={index === 2 ? 'danger-dot' : ''} /></div>)}<button type="button" className="ghost-button">Register New Hardware</button></article>
        </section>
        <div className="settings-footer"><button type="button">Discard Changes</button><button className="primary-action" type="button">Commit All Updates</button></div>
      </div>
    </>
  )
}

function SettingToggle({ label, note, checked, onClick }: { label: string; note: string; checked: boolean; onClick?: () => void }) {
  return <button className="setting-toggle" type="button" onClick={onClick} aria-pressed={checked}><span><b>{label}</b><small>{note}</small></span><i className={checked ? 'on' : ''} /></button>
}
