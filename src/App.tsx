import { useEffect, useState } from 'react'
import { EntryFlowModal } from './components/EntryFlowModal'
import { api, type GlobalSearchResult, type ManualEntryPayload } from './api'
import { Sidebar } from './components/Sidebar'
import { SystemAdminSidebar } from './components/SystemAdminSidebar'
import { pageRegistry } from './pages'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GLOBAL_SEARCH_NAVIGATION_EVENT } from './types'
import type { EntryMode, EntryType, Page, ReportScope, Theme } from './types'
import './App.css'

function AppContent() {
  const { isAuthenticated, loading, user } = useAuth()
  const [page, setPage] = useState<Page>(() => {
    const hasToken = localStorage.getItem('tri_ltd_auth_token')
    return hasToken ? 'dashboard' : 'landing'
  })
  const [theme, setTheme] = useState<Theme>('dark')
  const [currency, setCurrency] = useState('RWF')
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [entryModalType, setEntryModalType] = useState<EntryType | undefined>()
  const [entryRequest, setEntryRequest] = useState<{ type: EntryType; mode: EntryMode; id: number } | null>(null)
  const [listRefreshId, setListRefreshId] = useState(0)
  const [reportScope, setReportScope] = useState<ReportScope>('all')
  const [activeShopOwnerKey, setActiveShopOwnerKey] = useState(() => localStorage.getItem('tri_system_admin_shop_owner_key') || '')
  const [activeShopName, setActiveShopName] = useState(() => localStorage.getItem('tri_system_admin_shop_name') || '')
  const isLight = theme === 'light'
  const isSystemAdmin = isSystemAdminRole(user?.role)
  const isStaff = String(user?.role || '').trim().toLowerCase() === 'staff'
  const systemAdminPages: Page[] = ['system-admin', 'system-admin-shops', 'system-admin-users', 'system-admin-activity']
  const staffPages: Page[] = ['dashboard', 'inventory', 'sales', 'sale-items', 'sales-report', 'expenses', 'expense-items', 'expenses-report', 'transfers']
  const roleSafePage = isStaff && !staffPages.includes(page) ? 'dashboard' : page
  const effectivePage: Page = isSystemAdmin
    ? (systemAdminPages.includes(page) || activeShopOwnerKey ? page : 'system-admin')
    : systemAdminPages.includes(roleSafePage) ? 'dashboard' : roleSafePage

  useEffect(() => {
    const isPublic = effectivePage === 'landing' || effectivePage === 'login' || effectivePage === 'register'
    if (!loading && !isAuthenticated && !isPublic) {
      setPage('landing')
    }
  }, [effectivePage, isAuthenticated, loading])

  useEffect(() => {
    if (isSystemAdmin && !activeShopOwnerKey) return
    api.settings().then((settings) => setCurrency(settings.financial.currency)).catch(() => undefined)
  }, [activeShopOwnerKey, isSystemAdmin])

  useEffect(() => {
    const navigateToSearchResult = (event: Event) => {
      const result = (event as CustomEvent<GlobalSearchResult>).detail
      if (result?.page && (!isSystemAdmin || activeShopOwnerKey)) setPage(result.page)
    }
    window.addEventListener(GLOBAL_SEARCH_NAVIGATION_EVENT, navigateToSearchResult)
    return () => window.removeEventListener(GLOBAL_SEARCH_NAVIGATION_EVENT, navigateToSearchResult)
  }, [activeShopOwnerKey, isSystemAdmin])

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))

  const openEntryModal = (type?: EntryType) => {
    setEntryModalType(type)
    setIsEntryModalOpen(true)
  }

  const closeEntryModal = () => {
    setIsEntryModalOpen(false)
    setEntryModalType(undefined)
  }

  const openShop = (ownerKey: string, shopName: string) => {
    localStorage.setItem('tri_system_admin_shop_owner_key', ownerKey)
    localStorage.setItem('tri_system_admin_shop_name', shopName)
    setActiveShopOwnerKey(ownerKey)
    setActiveShopName(shopName)
    setPage('dashboard')
  }

  const handleEntrySubmit = async (type: EntryType, mode: EntryMode, payload?: ManualEntryPayload) => {
    if (payload) {
      try {
        if (type === 'purchase') {
          await api.createPurchase(payload)
        } else {
          await api.createSale(payload)
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Could not save the entry. Please check the backend connection and try again.')
        return
      }

      closeEntryModal()
      setEntryRequest(null)
      setListRefreshId(Date.now())
      setPage(type === 'purchase' ? 'purchases' : 'sales')
      return
    }

    closeEntryModal()
    setEntryRequest({ type, mode, id: Date.now() })
    setPage(type === 'purchase' ? 'purchases' : 'sales')
  }

  const isPublicPage = effectivePage === 'landing' || effectivePage === 'login' || effectivePage === 'register'

  const activePageDef = pageRegistry.find((entry) => entry.id === effectivePage)

  const pageProps = {
    page: effectivePage,
    theme,
    toggleTheme,
    openEntryModal,
    setPage,
    entryRequest,
    currency,
    isLight,
    onCurrencyChange: setCurrency,
    listRefreshId,
    reportScope,
    setReportScope,
    activeShopName,
    onOpenShop: openShop,
  }

  if (loading) {
    return <main className={`shell ${theme}`} aria-busy="true" />
  }

  if (isPublicPage) {
    return (
      <div className={`public-shell ${theme}`}>
        {activePageDef?.render(pageProps)}
      </div>
    )
  }

  if (isSystemAdmin && systemAdminPages.includes(effectivePage)) {
    return (
      <main className={`shell system-admin-shell ${theme}`}>
        <SystemAdminSidebar page={effectivePage} setPage={setPage} />
        <section className="workspace">
          {activePageDef?.render(pageProps)}
        </section>
      </main>
    )
  }

  return (
    <main className={`shell ${theme} ${effectivePage === 'reports' ? 'reports-mode' : ''}`}>
      <Sidebar page={effectivePage} setPage={setPage} onNewEntry={() => openEntryModal()} />
      <section className="workspace">
        {activePageDef?.render(pageProps)}
      </section>
      {isEntryModalOpen && <EntryFlowModal initialType={entryModalType} currency={currency} onClose={closeEntryModal} onSubmit={handleEntrySubmit} />}
    </main>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App

function isSystemAdminRole(role?: string) {
  return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_') === 'system_admin'
}
