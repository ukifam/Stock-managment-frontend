import { useState } from 'react'
import { Topbar } from '../components/Topbar'
import { inventoryRows } from '../data'
import type { FilterPeriod, ThemePageProps } from '../types'
import { exportRows, filterByPeriod, periodLabels } from '../utils/export'

export function Inventory({ theme, toggleTheme }: ThemePageProps) {
  const [period, setPeriod] = useState<FilterPeriod>('daily')
  const filteredRows = filterByPeriod(inventoryRows, period)
  const handleExport = () => {
    exportRows(`inventory-${period}.csv`, filteredRows.map((row) => ({
      Date: row.date,
      Item: row.item,
      SKU: row.sku,
      Category: row.category,
      Stock: row.stock,
      Price: row.price,
      Status: row.status,
    })))
  }

  return (
    <>
      <Topbar placeholder="Search Global Inventory..." theme={theme} toggleTheme={toggleTheme} />
      <div className="inventory-layout">
        <section className="inventory-content page-pad">
          <div className="inventory-title">
            <div><h1>Inventory Management</h1><p>Real-time status of 1,284 high-value assets.</p></div>
            <div className="toolbar"><PeriodSelect period={period} setPeriod={setPeriod} /><button type="button" onClick={handleExport}>Export</button></div>
          </div>
          <InventoryTable rows={filteredRows} />
          <div className="inventory-stats"><div><span>Operational</span><strong>94.4%</strong></div><div><span>Total Asset</span><strong>$8.42M</strong></div><div><span>Outbound Load</span><strong>318</strong></div></div>
        </section>
        <DetailPanel />
      </div>
    </>
  )
}

function PeriodSelect({ period, setPeriod }: { period: FilterPeriod; setPeriod: (period: FilterPeriod) => void }) {
  return (
    <select className="period-select" value={period} onChange={(event) => setPeriod(event.target.value as FilterPeriod)} aria-label="Filter inventory period">
      {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  )
}

function InventoryTable({ rows }: { rows: typeof inventoryRows }) {
  return (
    <div className="table-frame">
      <table>
        <thead><tr><th>Date</th><th>Item Name</th><th>SKU</th><th>Category</th><th>Stock Level</th><th>Unit Price</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className={index === 0 ? 'selected-row' : ''} key={row.sku}>
              <td>{row.date}</td>
              <td><strong>{row.item}</strong><span>{row.meta}</span></td>
              <td>{row.sku}</td><td>{row.category}</td><td className={row.status === 'Low' ? 'danger' : ''}>{row.stock}</td><td>{row.price}</td>
              <td><i className={row.status === 'Low' ? 'status low' : 'status'}>{row.status}</i></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetailPanel() {
  return (
    <aside className="detail-panel">
      <div className="detail-head"><h2>Inventory Details</h2><button type="button" aria-label="Close">x</button></div>
      <div className="detail-image" />
      <h2>Samsung Neo QLED 8K</h2>
      <p>SKU: SAM-8K-900B - SERIAL: #7902-X-22</p>
      <div className="detail-actions"><button type="button" className="primary">Sell Item</button><button type="button">Edit Item</button></div>
      <section><h3>Logistics Data</h3><dl><div><dt>Shelf Location</dt><dd>Z-14 / Bay 04</dd></div><div><dt>Supplier</dt><dd>Samsung Global</dd></div><div><dt>Lead Time</dt><dd>14 Days</dd></div><div><dt>Warranty</dt><dd>Active (24m)</dd></div></dl></section>
      <section><h3>Recent Activity</h3><ol className="activity"><li><strong>Batch Purchase: +10 units</strong><span>24 Oct 2025 - Vendor Order #882</span></li><li><strong>Stock Movement: -2 units</strong><span>21 Oct 2025 - Showroom Floor 5</span></li><li><strong>Inventory Audit Passed</strong><span>15 Oct 2025 - Auditor J. Smith</span></li></ol></section>
    </aside>
  )
}
