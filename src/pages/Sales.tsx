import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { api, type AvailableItem, type EntryStatus, type SaleRow, type SaleUpdatePayload } from '../api'
import { Topbar } from '../components/Topbar'
import { ImportHelp } from '../components/ImportHelp'
import { CameraScanner } from '../components/CameraScanner'
import { useMemo } from 'react'
import { Reports } from './Reports'
import type { EntryMode, Page, ThemePageProps } from '../types'

export const page = { id: 'sales' as const, label: 'Sales', icon: 'tag' }
import { exportRows } from '../utils/export'
import { formatMoney } from '../utils/money'

function saleFormFromRow(row?: SaleRow): SaleUpdatePayload {
  return {
    date: row?.date ?? '',
    id: row?.id ?? '',
    customer: row?.customer ?? '',
    phone: row?.phone ?? '',
    item: row?.item ?? '',
    sku: row?.sku ?? '',
    category: row?.category ?? '',
    quantity: row?.rawQuantity != null ? String(row.rawQuantity) : row?.items ?? '1',
    value: row?.value ?? '',
    paidAmount: row?.paidAmount ?? '',
    payment: row?.payment ?? '',
    status: row?.status ?? '',
    extractedText: row?.extractedText,
  }
}
import { normalizeCsvRow, parseCsvFile, parseJsonFile } from '../utils/import'

type SalesProps = ThemePageProps & {
  page?: Page
  subTab?: 'all' | 'items' | 'report'
  setPage?: (page: Page) => void
  startSelling?: boolean
  entryMode?: EntryMode
  onNewEntry?: () => void
  currency?: string
  onOpenReport?: () => void
}

type ScannedItem = {
  sku: string
  item: string
  quantity: number
  price: number
}

export function Sales({
  page,
  subTab,
  setPage,
  theme,
  toggleTheme,
  startSelling = false,
  entryMode = 'scan',
  onNewEntry,
  currency = 'RWF',
  onOpenReport,
}: SalesProps) {
  const [isSelling, setIsSelling] = useState(startSelling)
  const [rows, setRows] = useState<SaleRow[]>([])
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [appliedFilterFrom, setAppliedFilterFrom] = useState('')
  const [appliedFilterTo, setAppliedFilterTo] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([])
  const [selectedItem, setSelectedItem] = useState<AvailableItem | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isEditingSale, setIsEditingSale] = useState(false)
  const [saleForm, setSaleForm] = useState<SaleUpdatePayload>({ customer: '', item: '', quantity: '1' })
  const [error, setError] = useState('')
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [importError, setImportError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const isManual = entryMode === 'manual'

  useEffect(() => {
    api.sales(undefined, appliedFilterFrom, appliedFilterTo).then((response) => {
      setRows(response.rows)
      setSelectedId((current) => current || response.rows[0]?.id || '')
    }).catch(() => setRows([]))
  }, [appliedFilterFrom, appliedFilterTo])

  const selectedSale = rows.find((row) => row.id === selectedId) ?? rows[0]

  useEffect(() => {
    setSaleForm(saleFormFromRow(selectedSale))
    setIsEditingSale(false)
  }, [selectedSale?.id])

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
  const filteredSalesTotal = rows.reduce((sum, row) => sum + Number(row.rawValue ?? row.value ?? 0), 0)
  const filteredItemsSold = rows.reduce((sum, row) => sum + Number(row.rawQuantity ?? row.items ?? 0), 0)

  const handleExport = () => {
    const suffix = [appliedFilterFrom, appliedFilterTo].filter(Boolean).join('_to_') || 'all'
    exportRows(`sales-${suffix}.csv`, rows.map((row) => ({
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

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    setImportError('')
    setIsImporting(true)

    try {
      const rawRows = file.name.toLowerCase().endsWith('.json')
        ? await parseJsonFile(file)
        : await parseCsvFile(file)

      const importedRows = Array.isArray(rawRows) ? rawRows : []
      const payloads = importedRows.map((rawRow) => {
        const row = normalizeCsvRow(rawRow)
        return {
          id: row.saleid || row.id || undefined,
          item: row.item || row.description || row.product || '',
          customer: row.customer || row.name || '',
          phone: row.phone || row.contact || '',
          sku: row.sku || row.barcode || '',
          category: row.category || '',
          quantity: row.quantity || row.qty || row.amount || '1',
          total: row.total || row.value || '0',
          payment: row.payment || 'Credit',
          status: row.status || 'Given',
        }
      }).filter((payload) => payload.item && payload.customer)

      if (payloads.length === 0) {
        setImportError('No valid rows were found in the file.')
        return
      }

      const result = await api.bulkImportSales(payloads)
      const skippedNote = result.skipped ? ` (${result.skipped} skipped)` : ''
      const failedNote = result.failed ? ` (${result.failed} failed)` : ''
      await api.sales(undefined, appliedFilterFrom, appliedFilterTo).then((response) => setRows(response.rows)).catch(() => undefined)
      setImportError(`Imported ${result.count} sales successfully${skippedNote}${failedNote}.`)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import file.')
    } finally {
      setIsImporting(false)
    }
  }

  const handleStatusChange = async (id: string, status: EntryStatus) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row))

    try {
      const updated = await api.updateSaleStatus(id, status)
      setRows((current) => current.map((row) => row.id === id ? updated : row))
    } catch {
      api.sales(undefined, appliedFilterFrom, appliedFilterTo).then((response) => setRows(response.rows)).catch(() => undefined)
      window.alert('Could not update status. Please try again.')
    }
  }

  const handleSaleUpdate = async (id: string, payload: SaleUpdatePayload) => {
    try {
      const updated = await api.updateSale(id, payload)
      setRows((current) => current.map((row) => row.id === id ? updated : row))
      setSelectedId(updated.id)
      setSaleForm(saleFormFromRow(updated))
      setIsEditingSale(false)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not update sale.')
    }
  }

  const handleSaleFormChange = (field: keyof SaleUpdatePayload, value: string) => {
    setSaleForm((current) => ({ ...current, [field]: value }))
  }

  const toggleSaleEditing = () => {
    if (isEditingSale) {
      setSaleForm(saleFormFromRow(selectedSale))
    }
    setIsEditingSale((current) => !current)
  }

  const currentTab: 'all' | 'items' | 'report' =
    subTab || (page === 'sale-items' ? 'items' : page === 'sales-report' ? 'report' : 'all')

  const handleTabSelect = (tab: 'all' | 'items' | 'report') => {
    if (tab === 'all') setPage?.('sales')
    else if (tab === 'items') setPage?.('sale-items')
    else if (tab === 'report') setPage?.('sales-report')
  }

  const flattenedSaleItems = useMemo(() => {
    const list: {
      key: string
      saleId: string
      date: string
      customer: string
      item: string
      sku: string
      category: string
      quantity: number
      unitPrice: number
      total: number
      payment: string
      status: string
    }[] = []

    rows.forEach((sale) => {
      if (sale.lineItems && sale.lineItems.length > 0) {
        sale.lineItems.forEach((it, idx) => {
          list.push({
            key: `${sale.id}-${it.sku || idx}-${it.item}`,
            saleId: sale.id,
            date: sale.date,
            customer: sale.customer || 'Walk-in Customer',
            item: it.item,
            sku: it.sku || sale.sku || '-',
            category: it.category || sale.category || 'General',
            quantity: Number(it.quantity || 1),
            unitPrice: Number(it.unitPrice || 0),
            total: Number(it.total || (it.quantity * it.unitPrice) || 0),
            payment: sale.payment || 'Cash',
            status: sale.status || 'Completed',
          })
        })
      } else {
        const qty = Number(sale.rawQuantity || 1)
        const val = Number(sale.rawValue || 0)
        list.push({
          key: `${sale.id}-main`,
          saleId: sale.id,
          date: sale.date,
          customer: sale.customer || 'Walk-in Customer',
          item: sale.item || 'General Item',
          sku: sale.sku || '-',
          category: sale.category || 'General',
          quantity: qty,
          unitPrice: qty > 0 ? val / qty : val,
          total: val,
          payment: sale.payment || 'Cash',
          status: sale.status || 'Completed',
        })
      }
    })

    return list
  }, [rows])

  if (!isSelling) {
    return (
      <>
        <Topbar placeholder="Search orders, serials..." theme={theme} toggleTheme={toggleTheme} />
        <div style={{ padding: '1rem 1.5rem 0 1.5rem' }}>
          <div className="subtabs-bar">
            <button
              type="button"
              className={`subtab-btn ${currentTab === 'all' ? 'active' : ''}`}
              onClick={() => handleTabSelect('all')}
            >
              <span className="subtab-icon">🏷️</span>
              <span className="subtab-label">All Sales</span>
              <span className="subtab-badge">{rows.length}</span>
            </button>
            <button
              type="button"
              className={`subtab-btn ${currentTab === 'items' ? 'active' : ''}`}
              onClick={() => handleTabSelect('items')}
            >
              <span className="subtab-icon">📋</span>
              <span className="subtab-label">Sale Items</span>
              <span className="subtab-badge">{flattenedSaleItems.length}</span>
            </button>
            <button
              type="button"
              className={`subtab-btn ${currentTab === 'report' ? 'active' : ''}`}
              onClick={() => handleTabSelect('report')}
            >
              <span className="subtab-icon">📊</span>
              <span className="subtab-label">Sales Report</span>
            </button>
          </div>
        </div>

        {currentTab === 'report' ? (
          <Reports theme={theme} toggleTheme={toggleTheme} currency={currency} reportScope="sales" />
        ) : currentTab === 'items' ? (
          <SaleItemsView items={flattenedSaleItems} currency={currency} totalOrders={rows.length} />
        ) : (
          <div className="list-detail-layout">
            <section className="sales-list-page page-pad list-page">
              <div className="inventory-title">
                <div><h1>Sales & Checkout</h1><p>Review orders, carts, and checkout activity before scanning items.</p></div>
                <div className="toolbar">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>From<input type="date" value={filterFrom} onChange={(event) => setFilterFrom(event.target.value)} /></label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>To<input type="date" value={filterTo} onChange={(event) => setFilterTo(event.target.value)} /></label>
                  <button type="button" onClick={() => { setAppliedFilterFrom(filterFrom); setAppliedFilterTo(filterTo) }}>Apply</button>
                  <button type="button" onClick={() => { setFilterFrom(''); setFilterTo(''); setAppliedFilterFrom(''); setAppliedFilterTo('') }}>Clear</button>
                  <button type="button" onClick={handleExport}>Export CSV</button>
                  {onOpenReport && (
                    <button type="button" onClick={onOpenReport}>Sales Report</button>
                  )}
                  <button type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
                    {isImporting ? 'Importing…' : 'Import'}
                  </button>
                  <button className="primary-action" type="button" onClick={onNewEntry ?? (() => setIsSelling(true))}>New Sale</button>
                  <input ref={importInputRef} type="file" accept=".csv,.json" hidden onChange={handleImportFile} />
                </div>
              </div>
              <ImportHelp kind="sales" />
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
              {importError && (
                <div style={{ marginTop: '12px', color: importError.startsWith('Imported') ? '#1b5e20' : '#d32f2f' }}>
                  {importError}
                </div>
              )}
              <div className="inventory-stats">
                <div><span>Orders</span><strong>{rows.length}</strong></div>
                <div><span>Filtered Total</span><strong>{formatMoney(filteredSalesTotal, currency)}</strong></div>
                <div><span>Items Sold</span><strong>{filteredItemsSold}</strong></div>
                <div><span>Given</span><strong>{rows.filter((row) => row.status === 'Given').length}</strong></div>
                <div><span>Returned</span><strong>{rows.filter((row) => row.status === 'Returned').length}</strong></div>
              </div>
            </section>
            <SaleDetailPanel
              row={selectedSale}
              isEditing={isEditingSale}
              form={saleForm}
              onEditToggle={toggleSaleEditing}
              onFieldChange={handleSaleFormChange}
              onSave={async () => {
                if (selectedSale) {
                  await handleSaleUpdate(selectedSale.id, saleForm)
                }
              }}
            />
          </div>
        )}
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

function SaleDetailPanel({
  row,
  isEditing,
  form,
  onEditToggle,
  onFieldChange,
  onSave,
}: {
  row?: SaleRow
  isEditing: boolean
  form: SaleUpdatePayload
  onEditToggle: () => void
  onFieldChange: (field: keyof SaleUpdatePayload, value: string) => void
  onSave: () => Promise<void>
}) {
  return (
    <aside className="detail-panel transaction-detail">
      <div className="detail-head"><h2>Sale Details</h2></div>
      <div className="detail-image" />
      <h2>{row?.item ?? 'No sale selected'}</h2>
      <p>Sale ID: {row?.id ?? '-'}</p>
      <div className="detail-actions">
        <button type="button" className="primary" disabled={!row} onClick={onEditToggle}>
          {isEditing ? 'Cancel Edit' : 'Edit Sale'}
        </button>
      </div>
      {row && isEditing ? (
        <form onSubmit={async (event) => { event.preventDefault(); await onSave() }}>
          <div className="field-grid">
            <label>
              Customer
              <input value={form.customer ?? ''} onChange={(event) => onFieldChange('customer', event.target.value)} required />
            </label>
            <label>
              Phone
              <input value={form.phone ?? ''} onChange={(event) => onFieldChange('phone', event.target.value)} />
            </label>
            <label>
              Item
              <input value={form.item ?? ''} onChange={(event) => onFieldChange('item', event.target.value)} required />
            </label>
            <label>
              Category
              <input value={form.category ?? ''} onChange={(event) => onFieldChange('category', event.target.value)} />
            </label>
            <label>
              SKU
              <input value={form.sku ?? ''} onChange={(event) => onFieldChange('sku', event.target.value)} />
            </label>
            <label>
              Quantity
              <input type="number" min="0" value={form.quantity ?? ''} onChange={(event) => onFieldChange('quantity', event.target.value)} required />
            </label>
            <label>
              Value
              <input type="text" value={form.value ?? ''} onChange={(event) => onFieldChange('value', event.target.value)} />
            </label>
            <label>
              Paid Amount
              <input type="text" value={form.paidAmount ?? ''} onChange={(event) => onFieldChange('paidAmount', event.target.value)} />
            </label>
            <label>
              Payment
              <input value={form.payment ?? ''} onChange={(event) => onFieldChange('payment', event.target.value)} />
            </label>
            <label>
              Status
              <input value={form.status ?? ''} onChange={(event) => onFieldChange('status', event.target.value)} />
            </label>
            <label>
              Date
              <input type="date" value={form.date ?? ''} onChange={(event) => onFieldChange('date', event.target.value)} />
            </label>
          </div>
          <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '18px' }}>
            <button type="button" onClick={onEditToggle}>Cancel</button>
            <button className="primary-action" type="submit">Save Sale</button>
          </div>
        </form>
      ) : (
        <>
          {row?.lineItems && row.lineItems.length > 0 && (
            <section>
              <h3>Sale Items ({row.lineItems.length})</h3>
              <div className="line-items-list">
                {row.lineItems.map((li, i) => (
                  <div className="line-item-row" key={`${li.sku ?? li.item}-${i}`}>
                    <div className="line-item-main">
                      <strong className="line-item-name">{li.item}</strong>
                      {li.sku && <span className="line-item-sku">SKU: {li.sku}</span>}
                    </div>
                    <div className="line-item-calc">
                      <span>{li.quantity} × {li.formattedUnitPrice}</span>
                      <strong>{li.formattedTotal}</strong>
                    </div>
                  </div>
                ))}
                <div className="line-items-totals">
                  {row.discount && row.discount !== 'RWF 0' && (
                    <div><span>Discount</span><span>−{row.discount}</span></div>
                  )}
                  {row.tax && row.tax !== 'RWF 0' && (
                    <div><span>Tax</span><span>+{row.tax}</span></div>
                  )}
                  <div className="line-items-total-row"><span>Total</span><strong>{row.value}</strong></div>
                </div>
              </div>
            </section>
          )}
          <section>
            <h3>Customer & Payment</h3>
            <dl>
              <div><dt>Customer</dt><dd>{row?.customer ?? '-'}</dd></div>
              <div><dt>Phone</dt><dd>{row?.phone ?? '-'}</dd></div>
              <div><dt>Paid Amount</dt><dd>{row?.paidAmount ?? '-'}</dd></div>
              <div><dt>Outstanding</dt><dd>{row?.outstanding ?? '-'}</dd></div>
              <div><dt>Payment</dt><dd>{row?.payment ?? '-'}</dd></div>
              <div><dt>Status</dt><dd>{row?.status ?? '-'}</dd></div>
              <div><dt>Date</dt><dd>{row?.date ?? '-'}</dd></div>
            </dl>
          </section>
        </>
      )}
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

type FlattenedSaleItem = {
  key: string
  saleId: string
  date: string
  customer: string
  item: string
  sku: string
  category: string
  quantity: number
  unitPrice: number
  total: number
  payment: string
  status: string
}

function SaleItemsView({
  items,
  currency,
  totalOrders,
}: {
  items: FlattenedSaleItem[]
  currency: string
  totalOrders: number
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')

  const categories = useMemo(() => {
    const set = new Set<string>()
    items.forEach((it) => {
      if (it.category) set.add(it.category)
    })
    return ['ALL', ...Array.from(set)]
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchesCategory = categoryFilter === 'ALL' || it.category === categoryFilter
      const q = searchTerm.toLowerCase()
      const matchesSearch =
        !q ||
        it.item.toLowerCase().includes(q) ||
        it.sku.toLowerCase().includes(q) ||
        it.customer.toLowerCase().includes(q) ||
        it.saleId.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [items, categoryFilter, searchTerm])

  const totalSoldUnits = filteredItems.reduce((sum, it) => sum + it.quantity, 0)
  const totalItemRevenue = filteredItems.reduce((sum, it) => sum + it.total, 0)
  const distinctProductsCount = new Set(filteredItems.map((it) => it.item)).size

  const handleExportItems = () => {
    exportRows(
      'sale_items.csv',
      filteredItems.map((it) => ({
        Date: it.date,
        SaleID: it.saleId,
        Customer: it.customer,
        Item: it.item,
        SKU: it.sku,
        Category: it.category,
        Quantity: it.quantity.toString(),
        UnitPrice: it.unitPrice.toString(),
        Total: it.total.toString(),
        Payment: it.payment,
        Status: it.status,
      }))
    )
  }

  return (
    <div className="page-pad">
      <div className="inventory-title">
        <div>
          <h1>Sale Items Breakdown</h1>
          <p>Detailed view of all individual product line items sold across orders.</p>
        </div>
        <div className="toolbar">
          <button type="button" onClick={handleExportItems}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="items-kpi-grid">
        <div className="items-kpi-card">
          <span>Total Items Sold</span>
          <strong>{totalSoldUnits} Units</strong>
        </div>
        <div className="items-kpi-card">
          <span>Distinct Products</span>
          <strong>{distinctProductsCount} Products</strong>
        </div>
        <div className="items-kpi-card">
          <span>Items Revenue</span>
          <strong style={{ color: 'var(--cyan, #38bdf8)' }}>{formatMoney(totalItemRevenue, currency)}</strong>
        </div>
        <div className="items-kpi-card">
          <span>Total Orders</span>
          <strong>{totalOrders} Orders</strong>
        </div>
      </div>

      <div className="items-search-bar">
        <input
          type="text"
          className="items-search-input"
          placeholder="Search items by product name, SKU, customer, or Sale ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            height: '38px',
            padding: '0 12px',
            background: 'var(--panel, #141d2e)',
            border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
            borderRadius: 'var(--radius-sm, 8px)',
            color: 'var(--text-strong, #f8fafc)',
            font: '500 13px var(--display, system-ui)',
          }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'ALL' ? 'All Categories' : c}
            </option>
          ))}
        </select>
      </div>

      <div className="table-frame">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Sale ID</th>
              <th>Customer</th>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Line Total</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No sale items found matching your filters.
                </td>
              </tr>
            ) : (
              filteredItems.map((it) => (
                <tr key={it.key}>
                  <td>{it.date}</td>
                  <td><strong>{it.saleId}</strong></td>
                  <td>{it.customer}</td>
                  <td><strong>{it.item}</strong></td>
                  <td><code>{it.sku}</code></td>
                  <td><span className="pill">{it.category}</span></td>
                  <td><strong>{it.quantity}</strong></td>
                  <td>{formatMoney(it.unitPrice, currency)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--cyan, #38bdf8)' }}>
                    {formatMoney(it.total, currency)}
                  </td>
                  <td>{it.payment}</td>
                  <td><span className="status">{it.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


