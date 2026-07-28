import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { Topbar } from '../components/Topbar'
import { api, type DashboardResponse } from '../api'
import type { ThemePageProps } from '../types'

export const page = { id: 'dashboard' as const, label: 'Dashboard', icon: 'grid' }

type DashboardProps = ThemePageProps & {
  onNewEntry?: () => void
}

export function Dashboard({ theme, toggleTheme, onNewEntry }: DashboardProps) {
  const [dashboard, setDashboard] = useState<DashboardResponse>({ metrics: [], salesBars: [], lowStock: [], catalog: [] })
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadDashboard = () => {
      api.dashboard()
        .then((response) => {
          if (!isMounted) return
          setDashboard(response)
          setError('')
        })
        .catch(() => {
          if (isMounted) setError('Could not refresh dashboard data.')
        })
    }

    loadDashboard()
    const refreshId = window.setInterval(loadDashboard, 5000)
    window.addEventListener('focus', loadDashboard)

    return () => {
      isMounted = false
      window.clearInterval(refreshId)
      window.removeEventListener('focus', loadDashboard)
    }
  }, [])

  return (
    <>
      <Topbar title="" placeholder="Global system search..." theme={theme} toggleTheme={toggleTheme} />
      <div className="dashboard page-pad">
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

        <section className="dashboard-main">
          <article className="panel sales-panel">
            <div className="panel-head">
              <div><h2>Today's Sales Activity</h2><p>Real-time throughput metrics</p></div>
              <div className="segmented"><button type="button">Hourly</button><button type="button" className="selected">Live Stream</button></div>
            </div>
            <div className="bar-chart" aria-label="Hourly sales chart">
              {dashboard.salesBars.map((height, index) => <i key={`${height}-${index}`} style={{ '--h': `${height}%` } as CSSProperties} />)}
            </div>
            <div className="chart-times"><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span><span>18:00</span></div>
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
