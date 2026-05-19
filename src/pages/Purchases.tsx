import { useState } from 'react'
import { Topbar } from '../components/Topbar'
import { purchaseRows } from '../data'
import type { EntryMode, FilterPeriod, ThemePageProps } from '../types'
import { exportRows, filterByPeriod, periodLabels } from '../utils/export'

type PurchasesProps = ThemePageProps & {
  startAdding?: boolean
  entryMode?: EntryMode
}

export function Purchases({ theme, toggleTheme, startAdding = false, entryMode = 'scan' }: PurchasesProps) {
  const [isAdding, setIsAdding] = useState(startAdding)
  const [period, setPeriod] = useState<FilterPeriod>('daily')
  const isManual = entryMode === 'manual'
  const filteredRows = filterByPeriod(purchaseRows, period)
  const handleExport = () => {
    exportRows(`purchases-${period}.csv`, filteredRows.map((row) => ({
      Date: row.date,
      PurchaseId: row.id,
      Item: row.item,
      Supplier: row.supplier,
      Phone: row.phone,
      Quantity: row.quantity,
      Value: row.value,
      Status: row.status,
    })))
  }

  if (isAdding) {
    return (
      <>
        <Topbar placeholder="Global identification..." theme={theme} toggleTheme={toggleTheme} />
        <div className="purchase-page page-pad">
          <div className="crumbs">Logistics / Purchases / <b>{isManual ? 'Manual Entry' : 'Smart Entry'}</b></div>
          <div className="form-head"><h1>{isManual ? 'Manual Add Purchase' : 'Smart Add Purchase'}</h1><div className="toolbar"><button type="button" onClick={() => setIsAdding(false)}>Back to Table</button><button type="button">Discard</button><button className="primary-action" type="button">Commit Transaction</button></div></div>
          <section className={isManual ? 'purchase-grid manual-entry-grid' : 'purchase-grid'}>
            {!isManual && (
              <div className="scan-column">
                <div className="scanner-hero"><span>Scanning Active...</span><b>94.2%</b><i /></div>
                <div className="scan-actions"><button type="button">Scan Barcode</button><button type="button">Scan Serial</button><button type="button">Take Photo</button></div>
              </div>
            )}
            <div className="entry-column">
              {!isManual && (
                <article className="panel compact-panel">
                  <div className="section-head"><h2>AI Recognition</h2><span>Live Mode</span></div>
                  <div className="recognition-grid"><div><b>Model Match</b><strong>ProBook Elite X1</strong></div><div><b>Brand ID</b><strong>Zenith-Core</strong></div></div>
                </article>
              )}
              <article className="panel compact-panel">
                <h2>Item Details</h2>
                <div className="field-grid"><label>Item Name<input defaultValue={isManual ? '' : 'ProBook Elite X1 Series'} placeholder="Enter item name..." /></label><label>Brand<input defaultValue={isManual ? '' : 'Zenith-Core'} placeholder="Enter brand..." /></label><label>Category<select defaultValue="Laptops"><option>Laptops</option><option>Visual Displays</option><option>Peripherals</option></select></label><label>Serial Number<input defaultValue={isManual ? '' : 'ZN-99Z-PX86'} placeholder="Enter serial number..." /></label><label>Barcode<input defaultValue={isManual ? '' : '4599021083'} placeholder="Enter barcode..." /></label></div>
              </article>
              <article className="panel compact-panel">
                <h2>Purchase Information</h2>
                <div className="field-grid">
                  <label>Supplier Name<input placeholder="Search suppliers..." /></label>
                  <label>Phone Number<input placeholder="+1 (555) 000-0000" /></label>
                </div>
                <div className="field-grid money-grid"><label>Quantity<input defaultValue="1" /></label><label>Unit Price<input defaultValue="$ 1,249.00" /></label><label>Total<input defaultValue="$ 1,249.00" /></label></div>
              </article>
            </div>
          </section>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar placeholder="Global identification..." theme={theme} toggleTheme={toggleTheme} />
      <div className="purchase-page page-pad list-page">
        <div className="inventory-title">
          <div><h1>Purchase Orders</h1><p>Receive supplier shipments and convert scanned products into stock.</p></div>
          <div className="toolbar"><PeriodSelect period={period} setPeriod={setPeriod} /><button type="button" onClick={handleExport}>Export</button><button className="primary-action" type="button" onClick={() => setIsAdding(true)}>New Purchase</button></div>
        </div>
        <div className="table-frame">
          <table>
            <thead><tr><th>Date</th><th>Purchase ID</th><th>Item Name</th><th>Supplier Name</th><th>Phone Number</th><th>Quantity</th><th>Total Value</th><th>Status</th></tr></thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr className={index === 0 ? 'selected-row' : ''} key={row.id}>
                  <td>{row.date}</td>
                  <td><strong>{row.id}</strong><span>Inbound stock order</span></td>
                  <td>{row.item}</td><td>{row.supplier}</td><td>{row.phone}</td><td>{row.quantity}</td><td>{row.value}</td>
                  <td><i className={row.status === 'Delayed' ? 'status low' : 'status'}>{row.status}</i></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inventory-stats"><div><span>Open Orders</span><strong>18</strong></div><div><span>Inbound Value</span><strong>$312k</strong></div><div><span>Awaiting Scan</span><strong>7</strong></div></div>
      </div>
    </>
  )
}

function PeriodSelect({ period, setPeriod }: { period: FilterPeriod; setPeriod: (period: FilterPeriod) => void }) {
  return (
    <select className="period-select" value={period} onChange={(event) => setPeriod(event.target.value as FilterPeriod)} aria-label="Filter purchase period">
      {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  )
}
