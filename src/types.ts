export type Page =
  | 'landing'
  | 'login'
  | 'register'
  | 'dashboard'
  | 'inventory'
  | 'stock-movements'
  | 'stock-adjustments'
  | 'purchases'
  | 'purchase-items'
  | 'purchases-report'
  | 'sales'
  | 'sale-items'
  | 'sales-report'
  | 'expenses'
  | 'expense-items'
  | 'expenses-report'
  | 'loans'
  | 'loans-given'
  | 'loans-taken'
  | 'loans-repayments'
  | 'reports'
  | 'settings'
export type Theme = 'dark' | 'light'
export type EntryType = 'purchase' | 'sale'
export type EntryMode = 'scan' | 'manual'
export type FilterPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type ReportScope = 'all' | 'purchases' | 'sales' | 'expenses'

import type { ReactNode } from 'react'

export type ThemePageProps = {
  theme: Theme
  toggleTheme: () => void
}

export type PageRenderProps = ThemePageProps & {
  page?: Page
  openEntryModal: (type?: EntryType) => void
  setPage: (page: Page) => void
  entryRequest: { type: EntryType; mode: EntryMode; id: number } | null
  currency: string
  isLight: boolean
  onCurrencyChange: (currency: string) => void
  listRefreshId: number
  reportScope: ReportScope
  setReportScope: (scope: ReportScope) => void
}

export type PageDefinition = {
  id: Page
  label: string
  icon: string
  render: (props: PageRenderProps) => ReactNode
}
