import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { Topbar } from '../components/Topbar'
import { api, type DashboardResponse } from '../api'
import { useAuth } from '../context/AuthContext'
import type { Page, ThemePageProps } from '../types'

type DashboardProps = ThemePageProps & {
  onNewEntry?: () => void
  activeShopName?: string
  processingEnabled?: boolean
  setPage?: (page: Page) => void
}

export function Dashboard({ theme, toggleTheme, onNewEntry, activeShopName, processingEnabled = false, setPage }: DashboardProps) {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardResponse>({ categories: [], metrics: [], salesBars: [], salesLabels: [], lowStock: [], catalog: [] })
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [category, setCategory] = useState('')
  const [stockStatus, setStockStatus] = useState('all')
  const [error, setError] = useState('')

  const isAdmin = String(user?.role || '').toLowerCase() === 'admin'
    || String(user?.role || '').toLowerCase().replace(/[\s-]+/g, '_') === 'system_admin'
  const canViewProduction = isAdmin
    || Boolean(user?.permissions?.find((p) => p.module === 'production')?.actions.includes('view'))

  useEffect(() => {
    let isMounted = true
    const loadDashboard = () => {
      api.dashboard({ from: fromDate, to: toDate, category, stockStatus: stockStatus === 'all' ? undefined : stockStatus })
        .then((response) => { if (isMounted) { setDashboard(response); setError('') } })
        .catch(() => { if (isMounted) setError('Could not refresh dashboard data.') })
    }
    loadDashboard()
    const refreshId = window.setInterval(loadDashboard, 5000)
    window.addEventListener('focus', loadDashboard)
    return () => { isMounted = false; window.clearInterval(refreshId); window.removeEventListener('focus', loadDashboard) }
  }, [fromDate, toDate, category, stockStatus])

  const setDatePreset = (days: number) => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - days + 1)
    setFromDate(formatDateInput(start))
    setToDate(formatDateInput(end))
  }

  const clearFilters = () => { setFromDate(''); setToDate(''); setCategory(''); setStockStatus('all') }

  return (
    <>
      <Topbar title={activeShopName ? `Shop Dashboard: ${activeShopName}` : ''} placeholder="Global system search..." theme={theme} toggleTheme={toggleTheme} />
      <div className="dashboard page-pad">
        <section className="dashboard-filters" aria-label="Dashboard filters">
          <div className="dashboard-filter-dates">
            <label>From<input type="date" value={fromDate} max={toDate || formatDateInput(new Date())} onChange={(e) => setFromDate(e.target.value)} /></label>
            <label>To<input type="date" value={toDate} min={fromDate || undefined} max={formatDateInput(new Date())} onChange={(e) => setToDate(e.target.value)} /></label>
          </div>
          <div className="dashboard-filter-presets" aria-label="Date presets">
            <button type="button" onClick={() => setDatePreset(7)}>7 days</button>
            <button type="button" onClick={() => setDatePreset(30)}>30 days</button>
            <button type="button" onClick={() => setDatePreset(90)}>90 days</button>
          </div>
          <label className="dashboard-filter-select">Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {dashboard.categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="dashboard-filter-select">Stock
            <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}>
              <option value="all">All stock</option>
              <option value="available">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </label>
          <button className="dashboard-filter-reset" type="button" onClick={clearFilters}>Reset</button>
        </section>

        {error && <div style={{ color: '#ff6f00', padding: '8px', marginBottom: '12px', backgroundColor: '#fff3e0', borderRadius: '4px', fontSize: '14px' }}>{error}</div>}

        <section className="metric-grid">
          {dashboard.metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <div className="metric-top"><span className="chip-icon" aria-hidden="true" /><small className={metric.delta?.startsWith('-') ? 'danger' : ''}>{metric.delta}</small></div>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <div className="metric-line" />
            </article>
          ))}
        </section>

        {processingEnabled && canViewProduction && (
          <section className="panel" aria-label="Processing workspace" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
            <div className="panel-head">
              <div><h2>Production &amp; processing</h2><p>Plan production, manage recipes, and track orders for this processing business.</p></div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button className="ghost-button" type="button" onClick={() => setPage?.('production-pipeline')}>
                🏭 Open Production Pipeline
              </button>
            </div>
          </section>
        )}

        <section className="dashboard-main">
          <article className="panel sales-panel">
            <div className="panel-head">
              <div><h2>Sales Activity</h2><p>Sales within the selected date range</p></div>
            </div>
            <div className="bar-chart" aria-label="Hourly sales chart">
              {dashboard.salesBars.map((height, index) => <i key={`${height}-${index}`} style={{ '--h': `${height}%` } as CSSProperties} />)}
            </div>
            <div className="chart-times">{dashboard.salesLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
          </article>

          <article className="panel alerts-panel">
            <div className="alert-title"><h2>Low Stock Alerts</h2><span aria-hidden="true" /></div>
            {dashboard.lowStock.map((item) => (
              <div className="alert-item" key={item.sku}>
                <div><strong>{item.name}</strong><span>SKU: {item.sku}</span></div>
                <b className={item.status.includes('Out') ? 'danger' : ''}>{item.status}</b>
                <button type="button" className={item.action.includes('Urgent') ? 'urgent' : ''}>{item.action}</button>
              </div>
            ))}
            <button className="ghost-button" type="button">View All Alerts</button>
          </article>
        </section>

        <section className="catalog-section">
          <div className="section-head"><h2>Recently Cataloged</h2><span>Sorted by: Entry Date</span></div>
          <div className="catalog-grid">
            {dashboard.catalog.map((item) => (
              <article className="product-card" key={item.sku}>
                <div className={`product-visual ${item.visual}`} />
                <strong>SKU: {item.sku}</strong><span>{item.name}</span><p>{item.type} <b>{item.price}</b></p>
              </article>
            ))}
          </div>
        </section>
        <button className="floating-add" type="button" aria-label="Add entry" onClick={onNewEntry}>+</button>
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
