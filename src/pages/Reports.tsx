import type { CSSProperties } from 'react'
import { Topbar } from '../components/Topbar'
import { reportBars } from '../data'
import type { ThemePageProps } from '../types'

export function Reports({ theme, toggleTheme }: ThemePageProps) {
  return (
    <>
      <Topbar theme={theme} toggleTheme={toggleTheme} />
      <div className="reports-page page-pad">
        <div className="report-head"><div><h1>Executive Performance</h1><p>Real-time throughput and financial velocity metrics.</p></div><div className="toolbar"><button type="button" className="selected">Daily</button><button type="button">Last 7 Days</button><button type="button">Monthly</button><button type="button">Quarterly</button><button type="button">Export PDF</button><button className="primary-action" type="button">Export Excel</button></div></div>
        <section className="report-metrics">
          {[
            ['Total Revenue', '$4,892,120', '+12.4% vs last period'],
            ['Total Profit', '$1,240,500', '+8.1% vs last period'],
            ['Avg Order', '$3,480', '-2.4% vs last period'],
            ['Logistics Efficiency', '98.2%', 'Optimized target: 95%'],
          ].map(([label, value, note]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}
        </section>
        <section className="reports-grid">
          <article className="panel revenue-panel"><div className="panel-head"><h2>Revenue Distribution</h2><p><b>Current</b> Forecast</p></div><div className="line-chart">{reportBars.map((height, index) => <i key={index} style={{ '--h': `${height}%` } as CSSProperties} />)}</div><div className="chart-times"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></article>
          <article className="panel categories"><h2>Top Categories</h2>{['Microprocessors', 'Quantum Optics', 'Memory Modules', 'Logic Gates', 'Connectors'].map((name, index) => <div className="category-row" key={name}><span>{name}</span><b>{['$1.8M', '$1.2M', '$940k', '$620k', '$210k'][index]}</b><i style={{ width: `${92 - index * 14}%` }} /></div>)}</article>
        </section>
        <article className="panel transaction-panel"><div className="section-head"><h2>Recent Transactions</h2><span>Status: All</span></div><table><tbody>{['HX-982-LT', 'HX-981-LT', 'HX-980-LT', 'HX-979-LT'].map((id, index) => <tr key={id}><td>{id}</td><td>{['Neural Cores v3', 'ARM Architecture', 'Thermal Regulators', 'Optic Transceivers'][index]}</td><td><i className={index === 0 ? 'status' : index === 3 ? 'status low' : 'status'}>{index === 3 ? 'Delayed' : index === 0 ? 'Processing' : 'Confirmed'}</i></td><td>{['1,400 Units', '850 Units', '4,200 Units', '120 Units'][index]}</td><td>{['$412,000', '$128,500', '$89,200', '$34,000'][index]}</td></tr>)}</tbody></table></article>
      </div>
    </>
  )
}
