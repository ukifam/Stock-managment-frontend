import { navItems } from '../data'
import type { Page } from '../types'

type SidebarProps = {
  page: Page
  setPage: (page: Page) => void
  onNewEntry: () => void
}

export function Sidebar({ page, setPage, onNewEntry }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <strong>QUANTUM AI</strong>
        <span>Electronics Logistics</span>
      </div>

      <nav className="nav">
        {navItems.map((item) => (
          <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)} type="button">
            <span className={`nav-icon ${item.icon}`} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>

      <button className="new-entry" type="button" onClick={onNewEntry}>
        <span aria-hidden="true">+</span> New Entry
      </button>
    </aside>
  )
}
