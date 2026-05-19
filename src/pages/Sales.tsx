import { useState } from 'react'
import { Topbar } from '../components/Topbar'
import { cartItems, saleRows } from '../data'
import type { EntryMode, FilterPeriod, ThemePageProps } from '../types'
import { exportRows, filterByPeriod, periodLabels } from '../utils/export'

type SalesProps = ThemePageProps & {
  startSelling?: boolean
  entryMode?: EntryMode
}

export function Sales({ theme, toggleTheme, startSelling = false, entryMode = 'scan' }: SalesProps) {
  const [isSelling, setIsSelling] = useState(startSelling)
  const [period, setPeriod] = useState<FilterPeriod>('daily')
  const isManual = entryMode === 'manual'
  const filteredRows = filterByPeriod(saleRows, period)
  const handleExport = () => {
    exportRows(`sales-${period}.csv`, filteredRows.map((row) => ({
      Date: row.date,
      SaleId: row.id,
      Item: row.item,
      Customer: row.customer,
      Phone: row.phone,
      Items: row.items,
      Value: row.value,
      Payment: row.payment,
      Status: row.status,
    })))
  }

  if (!isSelling) {
    return (
      <>
        <Topbar placeholder="Search orders, serials..." theme={theme} toggleTheme={toggleTheme} />
        <div className="sales-list-page page-pad list-page">
          <div className="inventory-title">
            <div><h1>Sales & Checkout</h1><p>Review orders, carts, and checkout activity before scanning items.</p></div>
            <div className="toolbar"><PeriodSelect period={period} setPeriod={setPeriod} /><button type="button" onClick={handleExport}>Export</button><button className="primary-action" type="button" onClick={() => setIsSelling(true)}>New Sale</button></div>
          </div>
          <div className="table-frame">
            <table>
              <thead><tr><th>Date</th><th>Sale ID</th><th>Item Name</th><th>Customer Name</th><th>Phone Number</th><th>Items</th><th>Net Value</th><th>Status</th></tr></thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr className={index === 0 ? 'selected-row' : ''} key={row.id}>
                    <td>{row.date}</td>
                    <td><strong>{row.id}</strong><span>{row.payment} payment</span></td>
                    <td>{row.item}</td><td>{row.customer}</td><td>{row.phone}</td><td>{row.items}</td><td>{row.value}</td>
                    <td><i className={row.status === 'Draft' ? 'status low' : 'status'}>{row.status}</i></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inventory-stats"><div><span>Active Carts</span><strong>6</strong></div><div><span>Today Revenue</span><strong>$48.9k</strong></div><div><span>Awaiting Payment</span><strong>3</strong></div></div>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar placeholder="Search orders, serials..." theme={theme} toggleTheme={toggleTheme} />
      <div className="sales-page">
        <section className="cart-panel page-pad">
          <div className="cart-head"><div><span>{isManual ? 'Manual Sale' : 'Active Cart'}</span><p>Transaction ID: TXN-90210-A</p></div><div className="toolbar"><button type="button" onClick={() => setIsSelling(false)}>Back to Table</button>{!isManual && <button className="primary-action" type="button">Smart Scan</button>}</div></div>
          <div className="cart-list">{(isManual ? [{ name: 'Manual Item Entry', sn: 'Enter serial manually', price: '$0.00', qty: '01', visual: 'keyboard' }] : cartItems).map((item) => <article className="cart-item" key={item.sn}><div className={`cart-visual ${item.visual}`} /><div><strong>{item.name}</strong><span>SN: {item.sn}</span><div className="qty"><button type="button">-</button><b>{item.qty}</b><button type="button">+</button></div></div><b>{item.price}</b><button type="button" aria-label="Remove item">x</button></article>)}</div>
          <div className="items-count"><span>Items Count</span><b>4 Units</b></div>
        </section>
        <aside className="checkout-panel">
          <h2>Customer & Payment</h2>
          <label>Item Name<input defaultValue={isManual ? '' : 'Neural Pad Pro X1'} placeholder="Enter item name..." /></label>
          <label>Customer Name<input defaultValue="Alexander Sterling" /></label>
          <label>Phone Number<input defaultValue="+1 (555) 892-4410" /></label>
          <div className="summary-box"><h3>Order Summary</h3><p><span>Subtotal</span><b>$2,186.00</b></p><p><span>Estimated Tax (8.5%)</span><b>$185.81</b></p><p><span>Total</span><b>$2,371.81</b></p></div>
          <div className="payment-grid"><button className="selected" type="button">Credit</button><button type="button">Cash</button><button type="button">Crypto</button></div>
          <button className="checkout-button" type="button">Complete Sale & Print</button>
          <div className="checkout-links"><span>Save as Draft</span><span>Void Transaction</span></div>
        </aside>
      </div>
    </>
  )
}

function PeriodSelect({ period, setPeriod }: { period: FilterPeriod; setPeriod: (period: FilterPeriod) => void }) {
  return (
    <select className="period-select" value={period} onChange={(event) => setPeriod(event.target.value as FilterPeriod)} aria-label="Filter sales period">
      {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  )
}
