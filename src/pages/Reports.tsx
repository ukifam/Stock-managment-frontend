import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { api, type ReportsResponse } from '../api'
import { Topbar } from '../components/Topbar'
import type { FilterPeriod, ThemePageProps } from '../types'

export function Reports({ theme, toggleTheme }: ThemePageProps) {
  const [period, setPeriod] = useState<FilterPeriod>('daily')
  const [reports, setReports] = useState<ReportsResponse>({
    metrics: [],
    reportBars: [],
    recentTransactions: [],
  })
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadReports = () => {
      api.reports(period)
        .then((response) => {
          if (!isMounted) return
          setReports(response)
          setError('')
        })
        .catch(() => {
          if (isMounted) setError('Could not refresh report data.')
        })
    }

    loadReports()
    const refreshId = window.setInterval(loadReports, 5000)
    window.addEventListener('focus', loadReports)

    return () => {
      isMounted = false
      window.clearInterval(refreshId)
      window.removeEventListener('focus', loadReports)
    }
  }, [period])

  const topItems = reports.recentTransactions.slice(0, 5)
  const topValue = Math.max(...topItems.map((row) => Number(row.rawValue ?? 0)), 0)

  return (
    <>
      <Topbar theme={theme} toggleTheme={toggleTheme} />
      <div className="reports-page page-pad">
        {error && <div style={{ color: '#ff6f00', padding: '8px', marginBottom: '12px', backgroundColor: '#fff3e0', borderRadius: '4px', fontSize: '14px' }}>{error}</div>}
        <div className="report-head"><div><h1>Executive Performance</h1><p>Real-time throughput and financial velocity metrics.</p></div><div className="toolbar"><button type="button" className={period === 'daily' ? 'selected' : ''} onClick={() => setPeriod('daily')}>Daily</button><button type="button" className={period === 'weekly' ? 'selected' : ''} onClick={() => setPeriod('weekly')}>Last 7 Days</button><button type="button" className={period === 'monthly' ? 'selected' : ''} onClick={() => setPeriod('monthly')}>Monthly</button><button type="button" className={period === 'quarterly' ? 'selected' : ''} onClick={() => setPeriod('quarterly')}>Quarterly</button><button type="button">Export PDF</button><button className="primary-action" type="button">Export Excel</button></div></div>
        <section className="report-metrics">
          {reports.metrics.map(({ label, value, note }) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}
        </section>
        <section className="reports-grid">
          <article className="panel revenue-panel"><div className="panel-head"><h2>Revenue Distribution</h2><p><b>Current</b> Forecast</p></div><div className="line-chart">{reports.reportBars.map((height, index) => <i key={index} style={{ '--h': `${height}%` } as CSSProperties} />)}</div><div className="chart-times"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></article>
          <article className="panel categories"><h2>Top Items</h2>{topItems.map((row, index) => <div className="category-row" key={`${row.id}-${index}`}><span>{row.item}</span><b>{row.value}</b><i style={{ width: `${barWidth(Number(row.rawValue ?? 0), topValue)}%` }} /></div>)}</article>
        </section>
        <article className="panel transaction-panel"><div className="section-head"><h2>Recent Transactions</h2><span>Status: All</span></div><table><tbody>{reports.recentTransactions.map((row, index) => <tr key={row.id ?? index}><td>{row.id}</td><td>{row.item}</td><td><i className={row.status === 'Delayed' || row.status === 'Draft' ? 'status low' : 'status'}>{row.status}</i></td><td>{row.items ?? row.quantity}</td><td>{row.value}</td></tr>)}</tbody></table></article>
      </div>
    </>
  )
}

function barWidth(value: number, max: number) {
  if (!max) return 0
  return Math.max(8, Math.round((value / max) * 100))
}
