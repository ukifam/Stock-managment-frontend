import type { Theme } from '../types'

type TopbarProps = {
  title?: string
  placeholder?: string
  theme: Theme
  toggleTheme: () => void
  minimal?: boolean
}

export function Topbar({
  title = 'TRI LTD Business Suite',
  placeholder = 'Search inventory, sales, reports...',
  theme,
  toggleTheme,
  minimal = false,
}: TopbarProps) {
  return (
    <header className={`topbar${minimal ? ' minimal' : ''}`}>
      <strong className="version">{title}</strong>
      {!minimal && (
        <label className="search">
          <span aria-hidden="true" />
          <input placeholder={placeholder} />
        </label>
      )}
      <div className="top-actions">
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        {!minimal && (
          <>
            <button type="button" className="scan-button">
              Scan
            </button>
            <button type="button" aria-label="Notifications" className="icon-button bell" />
            <button type="button" aria-label="Help" className="icon-button help" />
            <button type="button" aria-label="Apps" className="icon-button apps" />
            <div className="operator" aria-label="System operator">
              <span>JD</span>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
