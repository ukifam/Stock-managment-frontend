import { useEffect, useState } from 'react'
import { api, type AvailableItem, type EntryStatus, type SaleRow } from '../api'
import { Topbar } from '../components/Topbar'
import { CameraScanner } from '../components/CameraScanner'
import type { EntryMode, FilterPeriod, ThemePageProps } from '../types'
import { exportRows, periodLabels } from '../utils/export'

type SalesProps = ThemePageProps & {
  startSelling?: boolean
  entryMode?: EntryMode
  onNewEntry?: () => void
  currency?: string
}

type ScannedItem = {
  sku: string
  item: string
  quantity: number
  price: number
}

export function Sales({ theme, toggleTheme, startSelling = false, entryMode = 'scan', onNewEntry, currency = 'RWF' }: SalesProps) {
  const [isSelling, setIsSelling] = useState(startSelling)
  const [period, setPeriod] = useState<FilterPeriod>('daily')
  const [rows, setRows] = useState<SaleRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
  const [selectedItem, setSelectedItem] = useState<AvailableItem | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState('')
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const isManual = entryMode === 'manual'

  useEffect(() => {
    api.sales(period).then((response) => {
      setRows(response.rows)
      setSelectedId((current) => current || response.rows[0]?.id || '')
    }).catch(() => setRows([]))
  }, [period])

  const selectedSale = rows.find((row) => row.id === selectedId) ?? rows[0]

  useEffect(() => {
    if (isSelling && isManual) {
      api.getAvailableItems()
        .then((response) => setAvailableItems(response.items))
        .catch(() => {
          setAvailableItems([])
          setError('Failed to load available items')
        })
    }
  }, [isSelling, isManual])

  const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sku = e.target.value
    const item = availableItems.find((i) => i.sku === sku) || null
    setSelectedItem(item)
    setQuantity(1)
    setError('')
  }

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0
    
    if (selectedItem && value > selectedItem.stock) {
      setError(`Only ${selectedItem.stock} units available in stock`)
      setQuantity(selectedItem.stock)
    } else if (value < 0) {
      setError('Quantity must be positive')
      setQuantity(0)
    } else {
      setError('')
      setQuantity(value)
    }
  }

  const handleRemoveScannedItem = (sku: string) => {
    setScannedItems((current) => current.filter((item) => item.sku !== sku))
  }

  const handleScannedQuantityChange = (sku: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveScannedItem(sku)
    } else {
      setScannedItems((current) =>
        current.map((item) =>
          item.sku === sku ? { ...item, quantity: newQuantity } : item
        )
      )
    }
  }

  const scanTotal = scannedItems.reduce((sum, item) => sum + item.quantity * item.price, 0)

  const handleExport = () => {
    exportRows(`sales-${period}.csv`, rows.map((row) => ({
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

  const handleStatusChange = async (id: string, status: EntryStatus) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row))

    try {
      const updated = await api.updateSaleStatus(id, status)
      setRows((current) => current.map((row) => row.id === id ? updated : row))
    } catch {
      api.sales(period).then((response) => setRows(response.rows)).catch(() => undefined)
      window.alert('Could not update status. Please try again.')
    }
  }

  if (!isSelling) {
    return (
      <>
        <Topbar placeholder="Search orders, serials..." theme={theme} toggleTheme={toggleTheme} />
        <div className="list-detail-layout">
          <section className="sales-list-page page-pad list-page">
            <div className="inventory-title">
              <div><h1>Sales & Checkout</h1><p>Review orders, carts, and checkout activity before scanning items.</p></div>
              <div className="toolbar"><PeriodSelect period={period} setPeriod={setPeriod} /><button type="button" onClick={handleExport}>Export</button><button className="primary-action" type="button" onClick={onNewEntry ?? (() => setIsSelling(true))}>New Sale</button></div>
            </div>
            <div className="table-frame">
              <table>
                <thead><tr><th>Date</th><th>Sale ID</th><th>Item Name</th><th>Customer Name</th><th>Phone Number</th><th>Items</th><th>Net Value</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className={row.id === selectedSale?.id ? 'selected-row clickable-row' : 'clickable-row'} key={row.id} onClick={() => setSelectedId(row.id)}>
                      <td>{row.date}</td>
                      <td><strong>{row.id}</strong><span>{row.payment} payment</span></td>
                      <td>{row.item}</td><td>{row.customer}</td><td>{row.phone}</td><td>{row.items}</td><td>{row.value}</td>
                      <td onClick={(event) => event.stopPropagation()}><StatusSelect value={row.status} onChange={(status) => handleStatusChange(row.id, status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="inventory-stats"><div><span>Orders</span><strong>{rows.length}</strong></div><div><span>Given</span><strong>{rows.filter((row) => row.status === 'Given').length}</strong></div><div><span>Returned</span><strong>{rows.filter((row) => row.status === 'Returned').length}</strong></div></div>
          </section>
          <SaleDetailPanel row={selectedSale} />
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
          <div className="cart-list">{rows.slice(0, 3).map((item) => <article className="cart-item" key={item.id}><div className="cart-visual keyboard" /><div><strong>{item.item}</strong><span>Order: {item.id}</span><div className="qty"><button type="button">-</button><b>{item.items}</b><button type="button">+</button></div></div><b>{item.value}</b><button type="button" aria-label="Remove item">x</button></article>)}</div>
          <div className="items-count"><span>Items Count</span><b>4 Units</b></div>
        </section>
        <aside className="checkout-panel">
          <h2>Customer & Payment</h2>
          {error && <div style={{ color: '#d32f2f', padding: '8px', marginBottom: '8px', backgroundColor: '#ffebee', borderRadius: '4px', fontSize: '14px' }}>{error}</div>}
          {isManual && (
            <>
              <label>
                Item Name
                <select value={selectedItem?.sku || ''} onChange={handleItemSelect}>
                  <option value="">-- Select an item --</option>
                  {availableItems.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.item} ({item.stock} in stock)
                    </option>
                  ))}
                </select>
              </label>
              {selectedItem && (
                <div style={{ padding: '8px', marginBottom: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px', fontSize: '14px' }}>
                  <div><strong>Category:</strong> {selectedItem.category}</div>
                  <div><strong>Price:</strong> ${selectedItem.price.toFixed(2)}</div>
                  <div><strong>Stock Available:</strong> {selectedItem.stock} units</div>
                </div>
              )}
              <label>
                Quantity
                <input
                  type="number"
                  min="1"
                  max={selectedItem?.stock || 1}
                  value={quantity}
                  onChange={handleQuantityChange}
                  disabled={!selectedItem}
                  placeholder="Enter quantity..."
                />
              </label>
            </>
          )}
          {!isManual && (
            <>
              <CameraScanner
                onScan={(barcode) => {
                  (async () => {
                    try {
                      const response = await api.searchInventory(barcode)
                      if (response.rows.length === 0) {
                        setError('Item not found. Try scanning another barcode.')
                        return
                      }
                      
                      const foundItem = response.rows[0]
                      const existing = scannedItems.find((item) => item.sku === foundItem.sku)
                      
                      if (existing) {
                        setScannedItems((current) =>
                          current.map((item) =>
                            item.sku === foundItem.sku
                              ? { ...item, quantity: item.quantity + 1 }
                              : item
                          )
                        )
                      } else {
                        setScannedItems((current) => [
                          ...current,
                          {
                            sku: foundItem.sku,
                            item: foundItem.item,
                            quantity: 1,
                            price: foundItem.rawPrice,
                          },
                        ])
                      }
                      setError('')
                    } catch {
                      setError('Failed to process scanned item.')
                    }
                  })()
                }}
                isActive={isSelling && !isManual}
              />
              {scannedItems.length > 0 && (
                <div style={{ marginTop: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                  <h3>Scanned Items ({scannedItems.length})</h3>
                  {scannedItems.map((item) => (
                    <div key={item.sku} style={{ padding: '8px', marginBottom: '6px', backgroundColor: '#f5f5f5', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <div>
                        <div><strong>{item.item}</strong></div>
                        <div style={{ fontSize: '11px', color: '#666' }}>SKU: {item.sku}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleScannedQuantityChange(item.sku, parseInt(e.target.value) || 0)}
                          style={{ width: '50px', fontSize: '12px' }}
                        />
                        <div style={{ minWidth: '60px', textAlign: 'right' }}>
                          <strong>${(item.quantity * item.price).toFixed(2)}</strong>
                        </div>
                        <button type="button" onClick={() => handleRemoveScannedItem(item.sku)} style={{ padding: '2px 6px', color: '#d32f2f', fontSize: '12px' }}>x</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <label>Customer Name<input defaultValue="Alexander Sterling" /></label>
          <label>Phone Number<input defaultValue="+1 (555) 892-4410" /></label>
          <div className="summary-box"><h3>Order Summary</h3><p><span>Subtotal</span><b>{formatMoney(isManual ? (selectedItem?.price ?? 0) * quantity : scanTotal, currency)}</b></p><p><span>Estimated Tax (8.5%)</span><b>{formatMoney((isManual ? (selectedItem?.price ?? 0) * quantity : scanTotal) * 0.085, currency)}</b></p><p><span>Total</span><b>{formatMoney((isManual ? (selectedItem?.price ?? 0) * quantity : scanTotal) * 1.085, currency)}</b></p></div>
          <div className="payment-grid"><button className="selected" type="button">Credit</button><button type="button">Cash</button><button type="button">Crypto</button></div>
          <button className="checkout-button" type="button" disabled={isManual && (!selectedItem || quantity <= 0)}>Complete Sale & Print</button>
          <div className="checkout-links"><span>Save as Draft</span><span>Void Transaction</span></div>
        </aside>
      </div>
    </>
  )
}

function formatMoney(value: number, currency = 'RWF') {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'RWF' ? 0 : 2,
  }).format(value)
}

function SaleDetailPanel({ row }: { row?: SaleRow }) {
  return (
    <aside className="detail-panel transaction-detail">
      <div className="detail-head"><h2>Sale Details</h2></div>
      <div className="detail-image" />
      <h2>{row?.item ?? 'No sale selected'}</h2>
      <p>Sale ID: {row?.id ?? '-'}</p>
      <section>
        <h3>Customer & Payment</h3>
        <dl>
          <div><dt>Customer</dt><dd>{row?.customer ?? '-'}</dd></div>
          <div><dt>Phone</dt><dd>{row?.phone ?? '-'}</dd></div>
          <div><dt>SKU / Barcode</dt><dd>{row?.sku || '-'}</dd></div>
          <div><dt>Category</dt><dd>{row?.category || '-'}</dd></div>
          <div><dt>Items</dt><dd>{row?.items ?? '-'}</dd></div>
          <div><dt>Net Value</dt><dd>{row?.value ?? '-'}</dd></div>
          <div><dt>Payment</dt><dd>{row?.payment ?? '-'}</dd></div>
          <div><dt>Status</dt><dd>{row?.status ?? '-'}</dd></div>
          <div><dt>Date</dt><dd>{row?.date ?? '-'}</dd></div>
        </dl>
      </section>
      {row?.extractedText && <section><h3>Scanned Image Text</h3><pre className="detail-extracted-text">{row.extractedText}</pre></section>}
    </aside>
  )
}

function StatusSelect({ value, onChange }: { value: string; onChange: (status: EntryStatus) => void }) {
  const options: EntryStatus[] = ['Received', 'Returned', 'Given']
  const selected = options.includes(value as EntryStatus) ? value : 'Given'

  return (
    <select className="period-select" value={selected} onChange={(event) => onChange(event.target.value as EntryStatus)} aria-label="Change sale status">
      {options.map((status) => <option key={status} value={status}>{status}</option>)}
    </select>
  )
}

function PeriodSelect({ period, setPeriod }: { period: FilterPeriod; setPeriod: (period: FilterPeriod) => void }) {
  return (
    <select className="period-select" value={period} onChange={(event) => setPeriod(event.target.value as FilterPeriod)} aria-label="Filter sales period">
      {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  )
}
