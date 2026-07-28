import { pageRegistry } from '../pages'
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
        <div className="brand-mark" aria-hidden="true">
          T
        </div>
        <div className="brand-text">
          <strong>TRI LTD</strong>
          <span>Business Suite</span>
        </div>
      </div>

      <nav className="nav">
        {pageRegistry.map((item) => (
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
