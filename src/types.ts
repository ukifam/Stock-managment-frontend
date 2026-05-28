export type Page = 'dashboard' | 'inventory' | 'purchases' | 'sales' | 'reports' | 'settings'
export type Theme = 'dark' | 'light'
export type EntryType = 'purchase' | 'sale'
export type EntryMode = 'scan' | 'manual'
export type FilterPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export type ThemePageProps = {
  theme: Theme
  toggleTheme: () => void
}
