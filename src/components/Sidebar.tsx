import { useState } from 'react'
import type { Page } from '../types'
import { useAuth } from '../context/AuthContext'
import { PRODUCTION_PAGES, canAccess, isSystemAdminRole, moduleForPage } from '../utils/access'

type SidebarProps = {
  page: Page
  setPage: (page: Page) => void
  onNewEntry: () => void
  processingEnabled?: boolean
}

type NavItem = { id: Page; label: string }

type NavGroup = {
  id: string
  label: string
  iconClass: string
  pages: Page[]
  items: NavItem[]
  processingOnly?: boolean
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'sales-group',
    label: 'Sales',
    iconClass: 'tag',
    pages: ['sales', 'sale-items', 'sales-report'],
    items: [
      { id: 'sales', label: 'Orders' },
      { id: 'sale-items', label: 'Items sold' },
      { id: 'sales-report', label: 'Report' },
    ],
  },
  {
    id: 'purchases-group',
    label: 'Purchases',
    iconClass: 'cart',
    pages: ['purchases', 'purchase-items', 'purchases-report'],
    items: [
      { id: 'purchases', label: 'Orders' },
      { id: 'purchase-items', label: 'Items bought' },
      { id: 'purchases-report', label: 'Report' },
    ],
  },
  {
    id: 'inventory-group',
    label: 'Inventory',
    iconClass: 'box',
    pages: ['inventory', 'inventory-control', 'stock-movements', 'stock-adjustments', 'transfers'],
    items: [
      { id: 'inventory', label: 'Products' },
      { id: 'stock-movements', label: 'Movements' },
      { id: 'stock-adjustments', label: 'Adjustments' },
      { id: 'transfers', label: 'Transfers' },
      { id: 'inventory-control', label: 'Setup' },
    ],
  },
  {
    id: 'production-group',
    label: 'Production',
    iconClass: 'box',
    pages: [...PRODUCTION_PAGES, 'quality-control'],
    processingOnly: true,
    items: [
      { id: 'production-pipeline', label: 'Pipeline' },
    ],
  },
  {
    id: 'money-group',
    label: 'Expenses & Loans',
    iconClass: 'receipt',
    pages: ['expenses', 'expense-items', 'expenses-report', 'loans', 'loans-given', 'loans-taken', 'loans-repayments'],
    items: [
      { id: 'expenses', label: 'Expenses' },
      { id: 'expenses-report', label: 'Expense report' },
      { id: 'loans-given', label: 'Loans given' },
      { id: 'loans-taken', label: 'Loans taken' },
      { id: 'loans-repayments', label: 'Repayments' },
    ],
  },
  {
    id: 'business-group',
    label: 'Business',
    iconClass: 'gear',
    pages: ['organization', 'shop-users', 'access-control'],
    items: [
      { id: 'organization', label: 'Business & branches' },
      { id: 'shop-users', label: 'Staff' },
      { id: 'access-control', label: 'Roles' },
    ],
  },
]

export function Sidebar({ page, setPage, onNewEntry, processingEnabled = false }: SidebarProps) {
  const { user, logout } = useAuth()
  const activeGroupId = NAV_GROUPS.find((group) => group.pages.includes(page))?.id ?? ''
  // Only one group is expanded at a time so the menu fits without scrolling.
  const [expanded, setExpanded] = useState<{ id: string; forPage: Page } | null>(null)
  const openGroupId = expanded && expanded.forPage === page ? expanded.id : activeGroupId
  const canView = (module: string) => canAccess(user, module)
  const visibleItems = (group: NavGroup) => group.items.filter((item) => canView(moduleForPage(item.id)))
  const visibleGroups = NAV_GROUPS.filter((group) => (!group.processingOnly || processingEnabled) && visibleItems(group).length > 0)

  const toggleGroup = (group: NavGroup) => {
    if (openGroupId === group.id) {
      setExpanded({ id: '', forPage: page })
      return
    }
    setExpanded({ id: group.id, forPage: page })
  }

  const topLink = (id: Page, label: string, iconClass: string) => (
    <button key={id} type="button" className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
      <span className={`nav-icon ${iconClass}`} aria-hidden="true" />
      {label}
    </button>
  )

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">T</div>
        <div className="brand-text">
          <strong>TRI LTD</strong>
          <span>Business Suite</span>
        </div>
      </div>

      <nav className="nav">
        {canView('dashboard') && topLink('dashboard', 'Dashboard', 'grid')}
        {isSystemAdminRole(user?.role) && topLink('system-admin', 'System Admin', 'gear')}

        {visibleGroups.map((group) => {
          const isOpen = openGroupId === group.id
          const items = visibleItems(group)
          // A group with a single page is just a link.
          if (items.length === 1) {
            return (
              <button
                key={group.id}
                type="button"
                className={group.pages.includes(page) ? 'active' : ''}
                onClick={() => setPage(items[0].id)}
              >
                <span className={`nav-icon ${group.iconClass}`} aria-hidden="true" />
                {group.label}
              </button>
            )
          }
          return (
            <div key={group.id} className="nav-group-container">
              <button
                className={`nav-group-toggle ${group.pages.includes(page) ? 'active' : ''}`}
                onClick={() => toggleGroup(group)}
                type="button"
                aria-expanded={isOpen}
              >
                <span className={`nav-icon ${group.iconClass}`} aria-hidden="true" />
                {group.label}
                <span className="nav-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="nav-sub-group">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      className={`nav-sub-item ${page === item.id ? 'active' : ''}`}
                      onClick={() => setPage(item.id)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {canView('reports') && topLink('reports', 'Reports', 'doc')}
        {canView('settings') && topLink('settings', 'Settings', 'gear')}
      </nav>

      <div className="sidebar-footer">
        {(canAccess(user, 'purchases', 'create') || canAccess(user, 'sales', 'create')) && (
          <button className="new-entry" type="button" onClick={onNewEntry}>
            <span aria-hidden="true">+</span> New entry
          </button>
        )}
        {user && (
          <div className="sidebar-user">
            <span className="sidebar-avatar" aria-hidden="true">{user.username.slice(0, 2).toUpperCase()}</span>
            <span className="sidebar-user-text"><strong>{user.username}</strong><small>{user.role.replace(/_/g, ' ')}</small></span>
            <button type="button" className="sidebar-signout" onClick={() => { logout(); setPage('landing') }} title="Sign out" aria-label="Sign out">⏻</button>
          </div>
        )}
      </div>
    </aside>
  )
}
