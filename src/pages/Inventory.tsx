import { useEffect, useState } from 'react'
import { api, type InventoryRow } from '../api'
import { Topbar } from '../components/Topbar'
import type { FilterPeriod, ThemePageProps } from '../types'
import { exportRows, periodLabels } from '../utils/export'

export function Inventory({ theme, toggleTheme }: ThemePageProps) {
  const [period, setPeriod] = useState<FilterPeriod>('daily')
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [selectedSku, setSelectedSku] = useState('')

  useEffect(() => {
    api.inventory(period).then((response) => {
      setRows(response.rows)
      setSelectedSku((current) => current || response.rows[0]?.sku || '')
    }).catch(() => setRows([]))
  }, [period])

  const selectedRow = rows.find((row) => row.sku === selectedSku) ?? rows[0]

  const handleExport = () => {
    exportRows(`inventory-${period}.csv`, rows.map((row) => ({
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
          <InventoryTable rows={rows} selectedSku={selectedRow?.sku ?? ''} onSelect={setSelectedSku} />
          <div className="inventory-stats"><div><span>Items</span><strong>{rows.length}</strong></div><div><span>Low Stock</span><strong>{rows.filter((row) => row.status === 'Low').length}</strong></div><div><span>Out of Stock</span><strong>{rows.filter((row) => row.status.includes('Out')).length}</strong></div></div>
        </section>
        <DetailPanel row={selectedRow} />
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

function InventoryTable({ rows, selectedSku, onSelect }: { rows: InventoryRow[]; selectedSku: string; onSelect: (sku: string) => void }) {
  return (
    <div className="table-frame">
      <table>
        <thead><tr><th>Date</th><th>Item Name</th><th>SKU</th><th>Category</th><th>Stock Level</th><th>Unit Price</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr className={row.sku === selectedSku ? 'selected-row clickable-row' : 'clickable-row'} key={row.sku} onClick={() => onSelect(row.sku)}>
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

function DetailPanel({ row }: { row?: InventoryRow }) {
  return (
    <aside className="detail-panel">
      <div className="detail-head"><h2>Inventory Details</h2><button type="button" aria-label="Close">x</button></div>
      <div className="detail-image" />
      <h2>{row?.item ?? 'No item selected'}</h2>
      <p>SKU: {row?.sku ?? '-'} - SERIAL: #{row?.serial ?? '-'}</p>
      <div className="detail-actions"><button type="button" className="primary">Sell Item</button><button type="button">Edit Item</button></div>
      <section><h3>Logistics Data</h3><dl><div><dt>Shelf Location</dt><dd>{row?.shelfLocation ?? '-'}</dd></div><div><dt>Supplier</dt><dd>{row?.supplier ?? '-'}</dd></div><div><dt>Lead Time</dt><dd>{row?.leadTime ?? '-'}</dd></div><div><dt>Warranty</dt><dd>{row?.warranty ?? '-'}</dd></div></dl></section>
      {row?.extractedText && <section><h3>Scanned Image Text</h3><pre className="detail-extracted-text">{row.extractedText}</pre></section>}
    </aside>
  )
}
