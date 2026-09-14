import { useState, useEffect } from 'react'
import { pageRegistry } from '../pages'
import type { Page } from '../types'

type SidebarProps = {
  page: Page
  setPage: (page: Page) => void
  onNewEntry: () => void
}

type NavSubItem = {
  id: Page
  label: string
  icon: string
}

type NavGroupConfig = {
  id: string
  label: string
  iconClass: string
  defaultPage: Page
  pages: Page[]
  items: NavSubItem[]
}

const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'inventory-group',
    label: 'Inventory',
    iconClass: 'box',
    defaultPage: 'inventory',
    pages: ['inventory', 'stock-movements', 'stock-adjustments'],
    items: [
      { id: 'inventory', label: 'Products', icon: '📦' },
      { id: 'stock-movements', label: 'Movements', icon: '↕️' },
      { id: 'stock-adjustments', label: 'Adjustments', icon: '✏️' },
    ],
  },
  {
    id: 'purchases-group',
    label: 'Purchases',
    iconClass: 'cart',
    defaultPage: 'purchases',
    pages: ['purchases', 'purchase-items', 'purchases-report'],
    items: [
      { id: 'purchases', label: 'All Purchases', icon: '🛒' },
      { id: 'purchase-items', label: 'Purchase Items', icon: '📋' },
      { id: 'purchases-report', label: 'Purchases Report', icon: '📊' },
    ],
  },
  {
    id: 'sales-group',
    label: 'Sales',
    iconClass: 'tag',
    defaultPage: 'sales',
    pages: ['sales', 'sale-items', 'sales-report'],
    items: [
      { id: 'sales', label: 'All Sales', icon: '🏷️' },
      { id: 'sale-items', label: 'Sale Items', icon: '📋' },
      { id: 'sales-report', label: 'Sales Report', icon: '📊' },
    ],
  },
  {
    id: 'expenses-group',
    label: 'Expenses',
    iconClass: 'receipt',
    defaultPage: 'expenses',
    pages: ['expenses', 'expense-items', 'expenses-report'],
    items: [
      { id: 'expenses', label: 'All Expenses', icon: '🧾' },
      { id: 'expense-items', label: 'Expense Items', icon: '📋' },
      { id: 'expenses-report', label: 'Expenses Report', icon: '📊' },
    ],
  },
  {
    id: 'loans-group',
    label: 'Loans & Debt',
    iconClass: 'credit-card',
    defaultPage: 'loans',
    pages: ['loans', 'loans-given', 'loans-taken', 'loans-repayments'],
    items: [
      { id: 'loans-given', label: 'Loans Given', icon: '📤' },
      { id: 'loans-taken', label: 'Loans Taken', icon: '📥' },
      { id: 'loans-repayments', label: 'Repayments', icon: '💳' },
    ],
  },
]

export function Sidebar({ page, setPage, onNewEntry }: SidebarProps) {
  // Track open state for each group
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    NAV_GROUPS.forEach((g) => {
      initial[g.id] = g.pages.includes(page)
    })
    return initial
  })

  // Automatically expand group when navigating to one of its sub-pages
  useEffect(() => {
    NAV_GROUPS.forEach((g) => {
      if (g.pages.includes(page)) {
        setOpenGroups((prev) => ({ ...prev, [g.id]: true }))
      }
    })
  }, [page])

  const toggleGroup = (group: NavGroupConfig) => {
    setOpenGroups((prev) => {
      const willOpen = !prev[group.id]
      if (willOpen && !group.pages.includes(page)) {
        setPage(group.defaultPage)
      }
      return { ...prev, [group.id]: willOpen }
    })
  }

  const dashPage = pageRegistry.find((p) => p.id === 'dashboard')
  const reportsPage = pageRegistry.find((p) => p.id === 'reports')
  const settingsPage = pageRegistry.find((p) => p.id === 'settings')

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
        {/* Dashboard */}
        {dashPage && (
          <button
            key="dashboard"
            className={page === 'dashboard' ? 'active' : ''}
            onClick={() => setPage('dashboard')}
            type="button"
          >
            <span className={`nav-icon ${dashPage.icon}`} aria-hidden="true" />
            {dashPage.label}
          </button>
        )}

        {/* 4 Accordion Groups: Inventory, Purchases, Sales, Expenses */}
        {NAV_GROUPS.map((group) => {
          const isOpen = Boolean(openGroups[group.id])
          const isActive = group.pages.includes(page)

          return (
            <div key={group.id} className="nav-group-container">
              <button
                className={`nav-group-toggle ${isActive ? 'active' : ''}`}
                onClick={() => toggleGroup(group)}
                type="button"
              >
                <span className={`nav-icon ${group.iconClass}`} aria-hidden="true" />
                {group.label}
                <span className="nav-caret" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
                  {isOpen ? '▾' : '▸'}
                </span>
              </button>
              {isOpen && (
                <div className="nav-sub-group">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className={`nav-sub-item ${page === item.id ? 'active' : ''}`}
                      onClick={() => setPage(item.id)}
                      type="button"
                    >
                      <span style={{ marginRight: '0.5rem' }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Top-level Reports */}
        {reportsPage && (
          <button
            key="reports"
            className={page === 'reports' ? 'active' : ''}
            onClick={() => setPage('reports')}
            type="button"
          >
            <span className={`nav-icon ${reportsPage.icon}`} aria-hidden="true" />
            {reportsPage.label}
          </button>
        )}

        {/* Top-level Settings */}
        {settingsPage && (
          <button
            key="settings"
            className={page === 'settings' ? 'active' : ''}
            onClick={() => setPage('settings')}
            type="button"
          >
            <span className={`nav-icon ${settingsPage.icon}`} aria-hidden="true" />
            {settingsPage.label}
          </button>
        )}
      </nav>

      <button className="new-entry" type="button" onClick={onNewEntry}>
        <span aria-hidden="true">+</span> New Entry
      </button>
    </aside>
  )
}
