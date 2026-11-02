import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Topbar } from '../components/Topbar'
import { api, type DashboardResponse } from '../api'
import { useAuth } from '../context/AuthContext'
import type { EntryType, Page, ThemePageProps } from '../types'

type DashboardProps = ThemePageProps & {
  onNewEntry?: (type?: EntryType) => void
  activeShopName?: string
  processingEnabled?: boolean
  setPage?: (page: Page) => void
  currency?: string
}

const PRESETS = [
  { label: 'Today', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export function Dashboard({ theme, toggleTheme, onNewEntry, activeShopName, processingEnabled = false, setPage }: DashboardProps) {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardResponse>({ categories: [], metrics: [], salesBars: [], salesLabels: [], lowStock: [], catalog: [] })
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [category, setCategory] = useState('')
  const [stockStatus, setStockStatus] = useState('all')
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DashboardResponse['catalog']>([])
  const [searching, setSearching] = useState(false)
  const searchRequestId = useRef(0)

  const role = String(user?.role || '').toLowerCase().replace(/[\s-]+/g, '_')
  const isAdmin = role === 'admin' || role === 'system_admin'
  const can = (module: string) => isAdmin || Boolean(user?.permissions?.find((p) => p.module === module)?.actions.includes('view'))
  const canCreate = (module: string) => isAdmin || Boolean(user?.permissions?.find((p) => p.module === module)?.actions.includes('create'))

  useEffect(() => {
    let isMounted = true
    const loadDashboard = () => {
      api.dashboard({ from: fromDate, to: toDate, category, stockStatus: stockStatus === 'all' ? undefined : stockStatus })
        .then((response) => { if (isMounted) { setDashboard(response); setError('') } })
        .catch(() => { if (isMounted) setError('Could not refresh dashboard data.') })
    }
    loadDashboard()
    const refreshId = window.setInterval(loadDashboard, 30000)
    window.addEventListener('focus', loadDashboard)
    return () => { isMounted = false; window.clearInterval(refreshId); window.removeEventListener('focus', loadDashboard) }
  }, [fromDate, toDate, category, stockStatus])

  useEffect(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    const requestId = ++searchRequestId.current
    if (!query) return

    const timeoutId = window.setTimeout(() => {
      setSearching(true)
      api.inventory(1000)
        .then((response) => {
          if (requestId !== searchRequestId.current) return
          setSearchResults(response.rows
            .filter((item) => `${item.item} ${item.sku}`.toLocaleLowerCase().includes(query))
            .slice(0, 12)
            .map((item) => ({ sku: item.sku, name: item.item, type: item.category, price: item.price, visual: '' })))
        })
        .catch(() => { if (requestId === searchRequestId.current) setSearchResults([]) })
        .finally(() => { if (requestId === searchRequestId.current) setSearching(false) })
    }, 200)

    return () => window.clearTimeout(timeoutId)
  }, [searchQuery])

  const activePreset = PRESETS.find((preset) => {
    if (!fromDate || !toDate) return false
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - preset.days + 1)
    return fromDate === formatDateInput(start) && toDate === formatDateInput(end)
  })?.label ?? (fromDate || toDate ? 'custom' : 'All')

  const setDatePreset = (days: number) => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - days + 1)
    setFromDate(formatDateInput(start))
    setToDate(formatDateInput(end))
  }

  const isFiltered = Boolean(fromDate || toDate || category || stockStatus !== 'all')
  const clearFilters = () => { setFromDate(''); setToDate(''); setCategory(''); setStockStatus('all') }
  const isSearching = Boolean(searchQuery.trim())
  const products = isSearching ? searchResults : dashboard.catalog
  const hasSales = dashboard.salesBars.some((height) => height > 0)

  const quickActions: Array<{ label: string; icon: string; onClick: () => void; show: boolean }> = [
    { label: 'New sale', icon: '＋', onClick: () => onNewEntry?.('sale'), show: canCreate('sales') },
    { label: 'New purchase', icon: '＋', onClick: () => onNewEntry?.('purchase'), show: canCreate('purchases') },
    { label: 'Expense', icon: '⊖', onClick: () => setPage?.('expenses'), show: can('expenses') },
    { label: 'Production', icon: '⚙', onClick: () => setPage?.('production-pipeline'), show: processingEnabled && can('production') },
    { label: 'Stock count', icon: '≡', onClick: () => setPage?.('stock-adjustments'), show: can('stock_movements') },
    { label: 'Reports', icon: '▤', onClick: () => setPage?.('reports'), show: can('reports') },
  ]

  return (
    <>
      <Topbar
        title={activeShopName || ''}
        placeholder="Find a product…"
        theme={theme}
        toggleTheme={toggleTheme}
        onSearchChange={setSearchQuery}
      />
      <div className="dashboard page-pad">
        <section className="dash-toolbar" aria-label="Dashboard filters">
          <div className="segmented" role="group" aria-label="Date range">
            <button type="button" className={activePreset === 'All' ? 'active' : ''} onClick={() => { setFromDate(''); setToDate('') }}>All</button>
            {PRESETS.map((preset) => (
              <button key={preset.label} type="button" className={activePreset === preset.label ? 'active' : ''} onClick={() => setDatePreset(preset.days)}>{preset.label}</button>
            ))}
          </div>
          <input type="date" aria-label="From date" value={fromDate} max={toDate || formatDateInput(new Date())} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" aria-label="To date" value={toDate} min={fromDate || undefined} max={formatDateInput(new Date())} onChange={(e) => setToDate(e.target.value)} />
          <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {dashboard.categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select aria-label="Stock status" value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}>
            <option value="all">All stock</option>
            <option value="available">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
          {isFiltered && <button className="link-button" type="button" onClick={clearFilters}>Reset</button>}
        </section>

        {error && <div className="notice error" role="alert">{error}</div>}

        <section className="metric-grid">
          {dashboard.metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              {metric.delta && <small className={metric.delta.startsWith('-') ? 'danger' : ''}>{metric.delta}</small>}
            </article>
          ))}
        </section>

        <nav className="quick-actions" aria-label="Quick actions">
          {quickActions.filter((action) => action.show).map((action) => (
            <button key={action.label} type="button" onClick={action.onClick}><span aria-hidden="true">{action.icon}</span>{action.label}</button>
          ))}
        </nav>

        <section className="dashboard-main">
          <article className="panel sales-panel">
            <div className="panel-head"><h2>Sales</h2></div>
            {hasSales ? (
              <>
                <div className="bar-chart" aria-label="Sales over the selected period">
                  {dashboard.salesBars.map((height, index) => <i key={index} style={{ '--h': `${height}%` } as CSSProperties} />)}
                </div>
                <div className="chart-times">{dashboard.salesLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
              </>
            ) : <div className="empty-state">No sales in this period</div>}
          </article>

          <article className="panel alerts-panel">
            <div className="panel-head">
              <h2>Low stock <b className="count-badge">{dashboard.lowStock.length}</b></h2>
              {can('inventory') && <button className="link-button" type="button" onClick={() => setPage?.('inventory')}>View all</button>}
            </div>
            <div className="alerts-list">
              {dashboard.lowStock.length === 0 && <div className="empty-state">All stock levels are healthy</div>}
              {dashboard.lowStock.map((item) => (
                <div className="alert-item" key={item.sku}>
                  <div><strong>{item.name}</strong><span>{item.sku}</span></div>
                  <b className={item.status.includes('Out') ? 'danger' : ''}>{item.status}</b>
                  {canCreate('purchases') && (
                    <button type="button" className={item.action.includes('Urgent') ? 'urgent' : ''} onClick={() => onNewEntry?.('purchase')}>Reorder</button>
                  )}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="catalog-section">
          <div className="section-head">
            <h2>{isSearching ? 'Search results' : 'Recently added'}</h2>
            {isSearching && <span>{searching ? 'Searching…' : `${searchResults.length} found`}</span>}
          </div>
          {isSearching && !searching && searchResults.length === 0 && <div className="empty-state">No products match “{searchQuery.trim()}”</div>}
          <div className="catalog-grid">
            {products.map((item) => (
              <article className="product-card" key={item.sku}>
                <span className="product-avatar" aria-hidden="true">{item.name.trim().charAt(0).toUpperCase() || '?'}</span>
                <div><strong>{item.name}</strong><small>{item.type} · {item.sku}</small></div>
                <b>{item.price}</b>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
