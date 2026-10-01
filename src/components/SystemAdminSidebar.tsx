import type { Page } from '../types'
import { useAuth } from '../context/AuthContext'

type SystemAdminSidebarProps = {
  page: Page
  setPage: (page: Page) => void
}

const PLATFORM_PAGES: Array<{ id: Page; label: string; icon: string }> = [
  { id: 'system-admin', label: 'Platform Overview', icon: 'grid' },
  { id: 'system-admin-shops', label: 'Shops', icon: 'box' },
  { id: 'system-admin-users', label: 'User Accounts', icon: 'user' },
  { id: 'system-admin-activity', label: 'Activity Log', icon: 'reports' },
]

export function SystemAdminSidebar({ page, setPage }: SystemAdminSidebarProps) {
  const { user, logout } = useAuth()

  return (
    <aside className="sidebar system-admin-sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">T</div>
        <div className="brand-text">
          <strong>TRI LTD</strong>
          <span>Platform Console</span>
        </div>
      </div>

      <nav className="nav" aria-label="System administration">
        <p className="system-admin-nav-label">Platform</p>
        {PLATFORM_PAGES.map((item) => (
          <button key={item.id} type="button" className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}>
            <span className={`nav-icon ${item.icon}`} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && <div className="system-admin-identity"><strong>{user.username}</strong><span>System Administrator</span></div>}
        <button type="button" className="system-admin-signout" onClick={() => { logout(); setPage('landing') }}>Sign out</button>
      </div>
    </aside>
  )
}
