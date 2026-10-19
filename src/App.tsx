import { useEffect, useState } from 'react'
import { EntryFlowModal } from './components/EntryFlowModal'
import { ACTIVE_BRANCH_STORAGE_KEY, api, type GlobalSearchResult, type ManualEntryPayload } from './api'
import { Sidebar } from './components/Sidebar'
import { SystemAdminSidebar } from './components/SystemAdminSidebar'
import { pageRegistry } from './pages'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GLOBAL_SEARCH_NAVIGATION_EVENT } from './types'
import type { EntryMode, EntryType, Page, ReportScope, Theme } from './types'
import './App.css'

function AppContent() {
  const { isAuthenticated, loading, user } = useAuth()
  const [processingEnabled, setProcessingEnabled] = useState(false)
  const [loadedFeatureScope, setLoadedFeatureScope] = useState('')
  const [businessFeatureError, setBusinessFeatureError] = useState('')
  const [page, setPage] = useState<Page>(() => {
    if (new URLSearchParams(window.location.search).get('page') === 'forgot-password') return 'forgot-password'
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
  const isShopAdmin = String(user?.role || '').trim().toLowerCase() === 'admin'
  const featureScope = `${user?.id || ''}:${isSystemAdmin ? activeShopOwnerKey : 'business'}`
  const businessFeaturesReady = Boolean(isAuthenticated && featureScope && loadedFeatureScope === featureScope)
  const activeProcessingEnabled = businessFeaturesReady && processingEnabled
  const platformAdminPages: Page[] = ['system-admin', 'system-admin-shops', 'system-admin-users', 'system-admin-activity']
  const selectedShopAdminPages: Page[] = ['organization', 'quality-control', 'access-control', 'shop-users']
  const systemAdminPages = [...platformAdminPages, ...selectedShopAdminPages]
  const isPublicRoute = page === 'landing' || page === 'login' || page === 'register' || page === 'forgot-password'
  const canViewPage = (candidate: Page) =>
    isSystemAdmin
    || isShopAdmin
    || Boolean(user?.permissions?.find((permission) => permission.module === moduleForPage(candidate))?.actions.includes('view'))
  const roleSafePage = !isPublicRoute && !canViewPage(page) ? 'dashboard' : page
  const featureSafePage = businessFeaturesReady && !activeProcessingEnabled && isProcessingFeaturePage(roleSafePage)
    ? 'dashboard'
    : roleSafePage
  const effectivePage: Page = isSystemAdmin
    ? (platformAdminPages.includes(page) || (activeShopOwnerKey && selectedShopAdminPages.includes(page)) ? featureSafePage : 'system-admin')
    : platformAdminPages.includes(featureSafePage) ? 'dashboard' : featureSafePage

  useEffect(() => {
    if (!isAuthenticated || (isSystemAdmin && !activeShopOwnerKey)) return

    let isMounted = true
    const refreshBusinessFeatures = () => {
      setProcessingEnabled(false)
      setLoadedFeatureScope('')
      setBusinessFeatureError('')
      api.businessFeatures()
        .then((result) => {
          if (isMounted) {
            setProcessingEnabled(result.features.processing)
            setLoadedFeatureScope(featureScope)
          }
        })
        .catch((error: unknown) => {
          if (isMounted) {
            setProcessingEnabled(false)
            setLoadedFeatureScope(featureScope)
            const reason = error instanceof Error ? ` ${error.message}` : ''
            setBusinessFeatureError(`Could not determine this business template. Processing features are hidden until the business settings can be loaded.${reason}`)
          }
        })
    }

    refreshBusinessFeatures()
    window.addEventListener('tri:business-template-updated', refreshBusinessFeatures)
    return () => {
      isMounted = false
      window.removeEventListener('tri:business-template-updated', refreshBusinessFeatures)
    }
  }, [activeShopOwnerKey, featureScope, isAuthenticated, isSystemAdmin])

  useEffect(() => {
    const isPublic = effectivePage === 'landing' || effectivePage === 'login' || effectivePage === 'register' || effectivePage === 'forgot-password'
    const redirect = window.setTimeout(() => {
      if (!loading && !isAuthenticated && !isPublic) setPage('landing')
    }, 0)
    return () => window.clearTimeout(redirect)
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
    localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY)
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

  const isPublicPage = effectivePage === 'landing' || effectivePage === 'login' || effectivePage === 'register' || effectivePage === 'forgot-password'

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
    activeShopOwnerKey,
    activeShopName,
    processingEnabled: activeProcessingEnabled,
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
        <SystemAdminSidebar
          page={effectivePage}
          setPage={setPage}
          activeShopOwnerKey={activeShopOwnerKey}
          processingEnabled={activeProcessingEnabled}
        />
        <section className="workspace">
          {businessFeatureError && <div role="alert" style={{ padding: '0.75rem 1rem', color: '#b45309', background: '#fffbeb' }}>{businessFeatureError}</div>}
          {activePageDef?.render(pageProps)}
        </section>
      </main>
    )
  }

  return (
    <main className={`shell ${theme} ${effectivePage === 'reports' ? 'reports-mode' : ''}`}>
      <Sidebar page={effectivePage} setPage={setPage} onNewEntry={() => openEntryModal()} processingEnabled={activeProcessingEnabled} />
      <section className="workspace">
        {businessFeatureError && <div role="alert" style={{ padding: '0.75rem 1rem', color: '#b45309', background: '#fffbeb' }}>{businessFeatureError}</div>}
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

function moduleForPage(page: Page) {
  if (page === 'dashboard') return 'dashboard'
  if (page === 'organization') return 'organization'
  if (page === 'shop-users' || page === 'access-control') return 'users'
  if (page === 'inventory' || page === 'inventory-control') return 'inventory'
  if (page === 'stock-movements' || page === 'stock-adjustments') return 'stock_movements'
  if (page === 'purchases' || page === 'purchase-items' || page === 'purchases-report') return 'purchases'
  if (page === 'sales' || page === 'sale-items' || page === 'sales-report') return 'sales'
  if (page === 'expenses' || page === 'expense-items' || page === 'expenses-report') return 'expenses'
  if (page === 'loans' || page === 'loans-given' || page === 'loans-taken' || page === 'loans-repayments') return 'loans'
  if (page === 'transfers') return 'transfers'
  if (page === 'quality-control') return 'quality'
  if (page === 'production' || page === 'production-recipes' || page === 'production-processes' || page === 'production-orders' || page === 'production-resources' || page === 'production-waste' || page === 'production-pipeline') return 'production'
  if (page === 'reports') return 'reports'
  if (page === 'settings') return 'settings'
  return 'dashboard'
}

function isProcessingFeaturePage(page: Page) {
  return page === 'quality-control'
    || ['production', 'production-objectives', 'production-recipes', 'production-processes', 'production-orders', 'production-procurement', 'production-resources', 'production-waste', 'production-pipeline'].includes(page)
}
