import type { CSSProperties } from 'react'
import { Topbar } from '../components/Topbar'
import { catalog, lowStock, metrics, salesBars } from '../data'
import type { ThemePageProps } from '../types'

export function Dashboard({ theme, toggleTheme }: ThemePageProps) {
  return (
    <>
      <Topbar title="" placeholder="Global system search..." theme={theme} toggleTheme={toggleTheme} />
      <div className="dashboard page-pad">
        <section className="metric-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <div className="metric-top"><span className="chip-icon" aria-hidden="true" /><small className={metric.delta.startsWith('-') ? 'danger' : ''}>{metric.delta}</small></div>
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
              {salesBars.map((height, index) => <i key={`${height}-${index}`} style={{ '--h': `${height}%` } as CSSProperties} />)}
            </div>
            <div className="chart-times"><span>08:00</span><span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span><span>18:00</span></div>
          </article>

          <article className="panel alerts-panel">
            <div className="alert-title"><h2>Low Stock Alerts</h2><span aria-hidden="true" /></div>
            {lowStock.map((item) => (
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
            {catalog.map((item) => (
              <article className="product-card" key={item.sku}>
                <div className={`product-visual ${item.visual}`} />
                <strong>SKU: {item.sku}</strong><span>{item.name}</span><p>{item.type} <b>{item.price}</b></p>
              </article>
            ))}
          </div>
        </section>
        <button className="floating-add" type="button" aria-label="Add item">+</button>
      </div>
    </>
  )
}
