import type { Theme } from '../types'

type TopbarProps = {
  title?: string
  placeholder?: string
  theme: Theme
  toggleTheme: () => void
}

export function Topbar({ title = 'Core Engine v2.4', placeholder = 'Search operational data...', theme, toggleTheme }: TopbarProps) {
  return (
    <header className="topbar">
      <strong className="version">{title}</strong>
      <label className="search">
        <span aria-hidden="true" />
        <input placeholder={placeholder} />
      </label>
      <div className="top-actions">
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button type="button" className="scan-button">Scan Mode</button>
        <button type="button" aria-label="Notifications" className="icon-button bell" />
        <button type="button" aria-label="Help" className="icon-button help" />
        <button type="button" aria-label="Apps" className="icon-button apps" />
        <div className="operator" aria-label="System operator"><span>JD</span></div>
      </div>
    </header>
  )
}
