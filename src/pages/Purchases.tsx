import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { api, type EntryStatus, type PurchaseRow, type PurchaseUpdatePayload } from '../api'
import { Topbar } from '../components/Topbar'
import { ImportHelp } from '../components/ImportHelp'
import { CameraScanner } from '../components/CameraScanner'
import { useMemo } from 'react'
import { Reports } from './Reports'
import type { EntryMode, Page, ThemePageProps } from '../types'

export const page = { id: 'purchases' as const, label: 'Purchases', icon: 'cart' }
import { exportRows } from '../utils/export'
import { normalizeCsvRow, parseCsvFile, parseJsonFile } from '../utils/import'
import { formatMoney } from '../utils/money'

type PurchasesProps = ThemePageProps & {
  page?: Page
  subTab?: 'all' | 'items' | 'report'
  setPage?: (page: Page) => void
  startAdding?: boolean
  entryMode?: EntryMode
  onNewEntry?: () => void
  currency?: string
  onOpenReport?: () => void
}

type ScannedPurchaseItem = {
  sku: string
  item: string
  quantity: number
  unitPrice: number
}

export function Purchases({
  page,
  subTab,
  setPage,
  theme,
  toggleTheme,
  startAdding = false,
  entryMode = 'scan',
  onNewEntry,
  currency = 'RWF',
  onOpenReport,
}: PurchasesProps) {
  const [isAdding, setIsAdding] = useState(startAdding)
  const [rows, setRows] = useState<PurchaseRow[]>([])
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [appliedFilterFrom, setAppliedFilterFrom] = useState('')
  const [appliedFilterTo, setAppliedFilterTo] = useState('')
  const [manualItem, setManualItem] = useState('')
  const [manualBrand, setManualBrand] = useState('')
  const [manualCategory, setManualCategory] = useState('Computing')
  const [manualSerial, setManualSerial] = useState('')
  const [manualBarcode, setManualBarcode] = useState('')
  const [manualQuantity, setManualQuantity] = useState('1')
  const [manualUnitPrice, setManualUnitPrice] = useState('0')
  const [manualSaving, setManualSaving] = useState(false)
  const [manualError, setManualError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [scannedItems, setScannedItems] = useState<ScannedPurchaseItem[]>([])
  const [error, setError] = useState('')
  const [supplier, setSupplier] = useState('')
  const [phone, setPhone] = useState('')
  const [importError, setImportError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const isManual = entryMode === 'manual'

  useEffect(() => {
    api.purchases(undefined, appliedFilterFrom, appliedFilterTo).then((response) => {
      setRows(response.rows)
      setSelectedId((current) => current || response.rows[0]?.id || '')
    }).catch(() => setRows([]))
  }, [appliedFilterFrom, appliedFilterTo])

  const selectedPurchase = rows.find((row) => row.id === selectedId) ?? rows[0]

  const handleExport = () => {
    const suffix = [appliedFilterFrom, appliedFilterTo].filter(Boolean).join('_to_') || 'all'
    exportRows(`purchases-${suffix}.csv`, rows.map((row) => ({
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

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    setImportError('')
    setIsImporting(true)

    try {
      const rows = file.name.toLowerCase().endsWith('.json')
        ? await parseJsonFile(file)
        : await parseCsvFile(file)

      const importedRows = Array.isArray(rows) ? rows : []
      const payloads = importedRows.map((rawRow) => {
        const row = normalizeCsvRow(rawRow)
        return {
          id: row.purchaseid || row.id || undefined,
          item: row.item || row.description || row.product || '',
          supplier: row.supplier || row.vendor || '',
          phone: row.phone || row.contact || '',
          sku: row.sku || row.barcode || '',
          category: row.category || '',
          quantity: row.quantity || row.qty || row.amount || '1',
          unitPrice: row.unitprice || row.price || row.value || '0',
          status: row.status || 'Received',
        }
      }).filter((payload) => payload.item)

      if (payloads.length === 0) {
        setImportError('No valid rows were found in the file.')
        return
      }

      const result = await api.bulkImportPurchases(payloads)
      const skippedNote = result.skipped ? ` (${result.skipped} skipped)` : ''
      setImportError(`Imported ${result.count} purchases successfully${skippedNote}.`)
      api.purchases(undefined, appliedFilterFrom, appliedFilterTo).then((response) => setRows(response.rows)).catch(() => undefined)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import file.')
    } finally {
      setIsImporting(false)
    }
  }

  const handleStatusChange = async (id: string, status: EntryStatus) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row))

    try {
      const updated = await api.updatePurchaseStatus(id, status)
      setRows((current) => current.map((row) => row.id === id ? updated : row))
    } catch {
      api.purchases(undefined, appliedFilterFrom, appliedFilterTo).then((response) => setRows(response.rows)).catch(() => undefined)
      window.alert('Could not update status. Please try again.')
    }
  }

  const handlePurchaseUpdate = async (id: string, payload: PurchaseUpdatePayload) => {
    const updated = await api.updatePurchase(id, payload)
    setRows((current) => current.map((row) => row.id === id ? updated : row))
    setSelectedId(updated.id)
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

  const handleScannedPriceChange = (sku: string, newPrice: number) => {
    setScannedItems((current) =>
      current.map((item) =>
        item.sku === sku ? { ...item, unitPrice: newPrice } : item
      )
    )
  }

  const scanTotal = scannedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const filteredPurchaseTotal = rows.reduce((sum, row) => sum + Number(row.rawValue ?? row.value ?? 0), 0)
  const filteredPurchaseQuantity = rows.reduce((sum, row) => sum + Number(row.rawQuantity ?? row.quantity ?? 0), 0)

  const handleCommitPurchase = async () => {
    if (manualSaving) return

    const hasScannedItems = scannedItems.length > 0
    if (!hasScannedItems && !manualItem.trim()) {
      setManualError('Item name is required before saving.')
      return
    }

    if (!hasScannedItems && Number(manualQuantity) <= 0) {
      setManualError('Quantity must be at least 1.')
      return
    }

    setManualSaving(true)
    setManualError('')

    try {
      const payloads = hasScannedItems
        ? scannedItems.map((item, index) => ({
            item: item.item,
            contactName: supplier || 'Supplier',
            phone,
            reference: `PO-${Date.now()}-${index + 1}`,
            category: 'Uncategorized',
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            total: String(item.quantity * item.unitPrice),
            sku: item.sku,
            payment: 'Cash',
            paidAmount: String(item.quantity * item.unitPrice),
          }))
        : [{
            item: manualItem.trim(),
            contactName: supplier || 'Supplier',
            phone,
            reference: `PO-${Date.now()}`,
            category: manualCategory,
            quantity: manualQuantity,
            unitPrice: manualUnitPrice,
            total: String(Number(manualQuantity || 0) * Number(manualUnitPrice || 0)),
            sku: manualBarcode.trim(),
            payment: 'Cash',
            paidAmount: String(Number(manualQuantity || 0) * Number(manualUnitPrice || 0)),
          }]

      await Promise.all(payloads.map((payload) => api.createPurchase(payload)))
      const refreshed = await api.purchases(undefined, appliedFilterFrom, appliedFilterTo)
      setRows(refreshed.rows)
      setSelectedId(refreshed.rows[0]?.id || '')
      setIsAdding(false)
      setManualItem('')
      setManualBrand('')
      setManualCategory('Computing')
      setManualSerial('')
      setManualBarcode('')
      setManualQuantity('1')
      setManualUnitPrice('0')
      setScannedItems([])
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Could not save purchase.')
    } finally {
      setManualSaving(false)
    }
  }

  if (isAdding) {
    return (
      <>
        <Topbar placeholder="Global identification..." theme={theme} toggleTheme={toggleTheme} />
        <div className="purchase-page page-pad">
          <div className="crumbs">Logistics / Purchases / <b>{isManual ? 'Manual Entry' : 'Smart Entry'}</b></div>
          <div className="form-head"><h1>{isManual ? 'Manual Add Purchase' : 'Smart Add Purchase'}</h1><div className="toolbar"><button type="button" onClick={() => setIsAdding(false)}>Back to Table</button><button type="button">Discard</button><button className="primary-action" type="button" onClick={handleCommitPurchase} disabled={manualSaving}>{manualSaving ? 'Saving…' : 'Commit Transaction'}</button></div></div>
          <section className={isManual ? 'purchase-grid manual-entry-grid' : 'purchase-grid'}>
            {!isManual && (
              <div className="scan-column">
                <div style={{ padding: '16px' }}>
                  <h3>Scan Items</h3>
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
                                unitPrice: foundItem.rawPrice,
                              },
                            ])
                          }
                          setError('')
                        } catch {
                          setError('Failed to process scanned item.')
                        }
                      })()
                    }}
                    isActive={isAdding && !isManual}
                  />
                  {error && <div style={{ color: '#d32f2f', padding: '8px', marginTop: '12px', marginBottom: '8px', backgroundColor: '#ffebee', borderRadius: '4px', fontSize: '14px' }}>{error}</div>}
                  {scannedItems.length > 0 && (
                    <div style={{ marginTop: '16px', maxHeight: '300px', overflowY: 'auto' }}>
                      <h4>Scanned Items ({scannedItems.length})</h4>
                      {scannedItems.map((item) => (
                        <div key={item.sku} style={{ padding: '10px', marginBottom: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px', borderLeft: '3px solid #4CAF50' }}>
                          <div><strong>{item.item}</strong></div>
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>SKU: {item.sku}</div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '13px' }}>
                            <label style={{ flex: 1 }}>
                              Qty:
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleScannedQuantityChange(item.sku, parseInt(e.target.value) || 0)}
                                style={{ width: '50px', marginLeft: '4px', padding: '4px' }}
                              />
                            </label>
                            <label style={{ flex: 1 }}>
                              Price:
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => handleScannedPriceChange(item.sku, parseFloat(e.target.value) || 0)}
                                style={{ width: '60px', marginLeft: '4px', padding: '4px' }}
                              />
                            </label>
                            <button type="button" onClick={() => handleRemoveScannedItem(item.sku)} style={{ padding: '4px 8px', color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
                          </div>
                          <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>
                            Subtotal: {formatMoney(item.quantity * item.unitPrice, currency)}
                          </div>
                        </div>
                      ))}
                      <div style={{ padding: '12px', marginTop: '12px', backgroundColor: '#fff3e0', borderRadius: '4px', fontSize: '15px', fontWeight: 'bold', textAlign: 'right' }}>
                        Total: {formatMoney(scanTotal, currency)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="entry-column">
              {!isManual && (
                <article className="panel compact-panel">
                  <div className="section-head"><h2>Purchase Summary</h2><span>{scannedItems.length} Items</span></div>
                  <div style={{ padding: '8px 0' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Total Items:</strong> {scannedItems.reduce((sum, item) => sum + item.quantity, 0)} units
                    </div>
                    <div>
                      <strong>Estimated Value:</strong> {formatMoney(scanTotal, currency)}
                    </div>
                  </div>
                </article>
              )}
              {isManual && (
                <article className="panel compact-panel">
                  <h2>Item Details</h2>
                  <div className="field-grid">
                    <label>Item Name<input value={manualItem} onChange={(event) => setManualItem(event.target.value)} placeholder="Enter item name..." /></label>
                    <label>Brand<input value={manualBrand} onChange={(event) => setManualBrand(event.target.value)} placeholder="Enter brand..." /></label>
                    <label>Category<select value={manualCategory} onChange={(event) => setManualCategory(event.target.value)}><option>Computing</option><option>Visual Displays</option><option>Peripherals</option><option>Imaging Gear</option><option>Drones</option><option>Uncategorized</option></select></label>
                    <label>Serial Number<input value={manualSerial} onChange={(event) => setManualSerial(event.target.value)} placeholder="Enter serial number..." /></label>
                    <label>Barcode<input value={manualBarcode} onChange={(event) => setManualBarcode(event.target.value)} placeholder="Enter barcode..." /></label>
                  </div>
                </article>
              )}
              <article className="panel compact-panel">
                <h2>{isManual ? 'Purchase' : 'Supplier'} Information</h2>
                <div className="field-grid">
                  <label>
                    Supplier Name
                    <input
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Enter supplier name..."
                    />
                  </label>
                  <label>
                    Phone Number
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                    />
                  </label>
                </div>
                {isManual && (
                  <div className="field-grid money-grid"><label>Quantity<input type="number" min="1" value={manualQuantity} onChange={(event) => setManualQuantity(event.target.value)} /></label><label>Unit Price<input type="number" min="0" step="0.01" value={manualUnitPrice} onChange={(event) => setManualUnitPrice(event.target.value)} /></label><label>Total<input value={formatMoney(Number(manualQuantity || 0) * Number(manualUnitPrice || 0), currency)} readOnly /></label></div>
                )}
                {manualError && <div style={{ color: '#d32f2f', padding: '8px', marginTop: '12px', backgroundColor: '#ffebee', borderRadius: '4px', fontSize: '14px' }}>{manualError}</div>}
              </article>
            </div>
          </section>
        </div>
      </>
    )
  }

  const currentTab: 'all' | 'items' | 'report' =
    subTab || (page === 'purchase-items' ? 'items' : page === 'purchases-report' ? 'report' : 'all')

  const handleTabSelect = (tab: 'all' | 'items' | 'report') => {
    if (tab === 'all') setPage?.('purchases')
    else if (tab === 'items') setPage?.('purchase-items')
    else if (tab === 'report') setPage?.('purchases-report')
  }

  const flattenedPurchaseItems = useMemo(() => {
    const list: FlattenedPurchaseItem[] = []

    rows.forEach((purchase) => {
      if (purchase.lineItems && purchase.lineItems.length > 0) {
        purchase.lineItems.forEach((it, idx) => {
          list.push({
            key: `${purchase.id}-${it.sku || idx}-${it.item}`,
            purchaseId: purchase.id,
            date: purchase.date,
            supplier: purchase.supplier || 'Main Supplier',
            item: it.item,
            sku: it.sku || purchase.sku || '-',
            category: it.category || purchase.category || 'General',
            quantity: Number(it.quantity || 1),
            unitPrice: Number(it.unitPrice || 0),
            total: Number(it.total || (it.quantity * it.unitPrice) || 0),
            payment: purchase.payment || 'Cash',
            status: purchase.status || 'Received',
          })
        })
      } else {
        const qty = Number(purchase.rawQuantity || 1)
        const val = Number(purchase.rawValue || 0)
        list.push({
          key: `${purchase.id}-main`,
          purchaseId: purchase.id,
          date: purchase.date,
          supplier: purchase.supplier || 'Main Supplier',
          item: purchase.item || 'General Purchase',
          sku: purchase.sku || '-',
          category: purchase.category || 'General',
          quantity: qty,
          unitPrice: qty > 0 ? val / qty : val,
          total: val,
          payment: purchase.payment || 'Cash',
          status: purchase.status || 'Received',
        })
      }
    })

    return list
  }, [rows])

  return (
    <>
      <Topbar placeholder="Global identification..." theme={theme} toggleTheme={toggleTheme} />
      <div style={{ padding: '1rem 1.5rem 0 1.5rem' }}>
        <div className="subtabs-bar">
          <button
            type="button"
            className={`subtab-btn ${currentTab === 'all' ? 'active' : ''}`}
            onClick={() => handleTabSelect('all')}
          >
            <span className="subtab-icon">🛒</span>
            <span className="subtab-label">All Purchases</span>
            <span className="subtab-badge">{rows.length}</span>
          </button>
          <button
            type="button"
            className={`subtab-btn ${currentTab === 'items' ? 'active' : ''}`}
            onClick={() => handleTabSelect('items')}
          >
            <span className="subtab-icon">📋</span>
            <span className="subtab-label">Purchase Items</span>
            <span className="subtab-badge">{flattenedPurchaseItems.length}</span>
          </button>
          <button
            type="button"
            className={`subtab-btn ${currentTab === 'report' ? 'active' : ''}`}
            onClick={() => handleTabSelect('report')}
          >
            <span className="subtab-icon">📊</span>
            <span className="subtab-label">Purchases Report</span>
          </button>
        </div>
      </div>

      {currentTab === 'report' ? (
        <Reports theme={theme} toggleTheme={toggleTheme} currency={currency} reportScope="purchases" />
      ) : currentTab === 'items' ? (
        <PurchaseItemsView items={flattenedPurchaseItems} currency={currency} totalOrders={rows.length} />
      ) : (
        <div className="list-detail-layout">
          <section className="purchase-page page-pad list-page">
            <div className="inventory-title">
              <div><h1>Purchase Orders</h1><p>Receive supplier shipments and convert scanned products into stock.</p></div>
              <div className="toolbar">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>From<input type="date" value={filterFrom} onChange={(event) => setFilterFrom(event.target.value)} /></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>To<input type="date" value={filterTo} onChange={(event) => setFilterTo(event.target.value)} /></label>
                <button type="button" onClick={() => { setAppliedFilterFrom(filterFrom); setAppliedFilterTo(filterTo) }}>Apply</button>
                <button type="button" onClick={() => { setFilterFrom(''); setFilterTo(''); setAppliedFilterFrom(''); setAppliedFilterTo('') }}>Clear</button>
                <button type="button" onClick={handleExport}>Export CSV</button>
                {onOpenReport && (
                  <button type="button" onClick={onOpenReport}>Purchase Report</button>
                )}
                <button type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
                  {isImporting ? 'Importing…' : 'Import'}
                </button>
                <button className="primary-action" type="button" onClick={onNewEntry ?? (() => setIsAdding(true))}>New Purchase</button>
                <input ref={importInputRef} type="file" accept=".csv,.json" hidden onChange={handleImportFile} />
              </div>
            </div>
            <ImportHelp kind="purchases" />
            <div className="table-frame">
              <table>
                <thead><tr><th>Date</th><th>Purchase ID</th><th>Item Name</th><th>Supplier Name</th><th>Phone Number</th><th>Quantity</th><th>Total Value</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className={row.id === selectedPurchase?.id ? 'selected-row clickable-row' : 'clickable-row'} key={row.id} onClick={() => setSelectedId(row.id)}>
                      <td>{row.date}</td>
                      <td><strong>{row.id}</strong><span>Inbound stock order</span></td>
                      <td>{row.item}</td><td>{row.supplier}</td><td>{row.phone}</td><td>{row.quantity}</td><td>{row.value}</td>
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
              <div><span>Filtered Total</span><strong>{formatMoney(filteredPurchaseTotal, currency)}</strong></div>
              <div><span>Filtered Qty</span><strong>{filteredPurchaseQuantity}</strong></div>
              <div><span>Received</span><strong>{rows.filter((row) => row.status === 'Received').length}</strong></div>
              <div><span>Returned</span><strong>{rows.filter((row) => row.status === 'Returned').length}</strong></div>
            </div>
          </section>
          <PurchaseDetailPanel row={selectedPurchase} onUpdate={handlePurchaseUpdate} />
        </div>
      )}
    </>
  )
}

type PurchaseEditForm = {
  date: string
  id: string
  item: string
  supplier: string
  phone: string
  sku: string
  category: string
  quantity: string
  unitPrice: string
  status: string
  paidAmount?: string
}

function PurchaseDetailPanel({ row, onUpdate }: { row?: PurchaseRow; onUpdate: (id: string, payload: PurchaseUpdatePayload) => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<PurchaseEditForm>(() => purchaseFormFromRow(row))

  useEffect(() => {
    setForm(purchaseFormFromRow(row))
    setIsEditing(false)
    setError('')
  }, [row?.id])

  const updateForm = (field: keyof PurchaseEditForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!row || isSaving) return

    if (!form.item.trim()) {
      setError('Item name is required.')
      return
    }

    if (Number(form.quantity) <= 0) {
      setError('Quantity must be at least 1.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      await onUpdate(row.id, {
        date: form.date,
        id: form.id,
        item: form.item,
        supplier: form.supplier,
        phone: form.phone,
        sku: form.sku,
        category: form.category,
        quantity: form.quantity,
        unitPrice: form.unitPrice,
        paidAmount: form.paidAmount,
        status: form.status,
        extractedText: row.extractedText,
      })
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update purchase.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <aside className="detail-panel transaction-detail">
      <div className="detail-head"><h2>Purchase Details</h2></div>
      <div className="detail-image" />
      <h2>{row?.item ?? 'No purchase selected'}</h2>
      <p>Purchase ID: {row?.id ?? '-'}</p>
      {row && !isEditing && (
        <div className="detail-actions">
          <button type="button" className="primary" onClick={() => setIsEditing(true)}>Edit Purchase</button>
          <button type="button" onClick={() => setForm(purchaseFormFromRow(row))}>Reset</button>
        </div>
      )}
      {row && isEditing && (
        <form onSubmit={handleSubmit}>
          <div className="field-grid">
            <label>Purchase ID
              <input value={form.id} onChange={(event) => updateForm('id', event.target.value)} placeholder="PO-000001" />
            </label>
            <label>Date
              <input type="date" value={form.date} onChange={(event) => updateForm('date', event.target.value)} />
            </label>
            <label>Item Name
              <input required value={form.item} onChange={(event) => updateForm('item', event.target.value)} placeholder="Item name..." />
            </label>
            <label>Category
              <input value={form.category} onChange={(event) => updateForm('category', event.target.value)} placeholder="Category..." />
            </label>
            <label>Supplier Name
              <input value={form.supplier} onChange={(event) => updateForm('supplier', event.target.value)} placeholder="Optional supplier..." />
            </label>
            <label>Phone Number
              <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="Optional phone..." />
            </label>
            <label>SKU / Barcode
              <input value={form.sku} onChange={(event) => updateForm('sku', event.target.value)} placeholder="SKU..." />
            </label>
            <label>Status
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                <option>Received</option>
                <option>Returned</option>
                <option>Given</option>
              </select>
            </label>
            <label>Quantity
              <input required type="number" min="1" value={form.quantity} onChange={(event) => updateForm('quantity', event.target.value)} />
            </label>
            <label>Unit Price
              <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(event) => updateForm('unitPrice', event.target.value)} />
            </label>
            <label>Paid Amount
              <input type="text" value={form.paidAmount ?? ''} onChange={(event) => updateForm('paidAmount', event.target.value)} />
            </label>
          </div>
          {error && <div style={{ color: '#d32f2f', padding: '8px', marginTop: '12px', backgroundColor: '#ffebee', borderRadius: '4px', fontSize: '14px' }}>{error}</div>}
          <div className="modal-actions" style={{ position: 'static', margin: '18px 0 0', padding: 0, background: 'transparent' }}>
            <button type="button" onClick={() => { setIsEditing(false); setForm(purchaseFormFromRow(row)); setError('') }}>Cancel</button>
            <button className="primary-action" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      )}
      {!isEditing && (
        <>
          {row?.lineItems && row.lineItems.length > 0 && (
            <section>
              <h3>Purchase Items ({row.lineItems.length})</h3>
              <div className="line-items-list">
                {row.lineItems.map((li, i) => (
                  <div className="line-item-row" key={`${li.sku ?? li.item}-${i}`}>
                    <div className="line-item-main">
                      <strong className="line-item-name">{li.item}</strong>
                      {li.sku && <span className="line-item-sku">SKU: {li.sku}</span>}
                      {li.category && <span className="line-item-sku">{li.category}</span>}
                    </div>
                    <div className="line-item-calc">
                      <span>{li.quantity} × {li.formattedUnitPrice}</span>
                      <strong>{li.formattedTotal}</strong>
                    </div>
                  </div>
                ))}
                <div className="line-items-totals">
                  <div className="line-items-total-row"><span>Total</span><strong>{row.value}</strong></div>
                </div>
              </div>
            </section>
          )}
          <section>
            <h3>Supplier & Stock</h3>
            <dl>
              <div><dt>Supplier</dt><dd>{row?.supplier ?? '-'}</dd></div>
              <div><dt>Phone</dt><dd>{row?.phone ?? '-'}</dd></div>
              <div><dt>SKU / Barcode</dt><dd>{row?.sku || '-'}</dd></div>
              <div><dt>Category</dt><dd>{row?.category || '-'}</dd></div>
              <div><dt>Quantity</dt><dd>{row?.quantity ?? '-'}</dd></div>
              <div><dt>Unit Price</dt><dd>{row?.unitPrice ?? '-'}</dd></div>
              <div><dt>Paid Amount</dt><dd>{row?.paidAmount ?? '-'}</dd></div>
              <div><dt>Outstanding</dt><dd>{row?.outstanding ?? '-'}</dd></div>
              <div><dt>Total Value</dt><dd>{row?.value ?? '-'}</dd></div>
              <div><dt>Date</dt><dd>{row?.date ?? '-'}</dd></div>
              <div><dt>Status</dt><dd>{row?.status ?? '-'}</dd></div>
            </dl>
          </section>
        </>
      )}
      {row?.extractedText && <section><h3>Scanned Image Text</h3><pre className="detail-extracted-text">{row.extractedText}</pre></section>}
    </aside>
  )
}

function purchaseFormFromRow(row?: PurchaseRow): PurchaseEditForm {
  return {
    date: row?.date ?? '',
    id: row?.id ?? '',
    item: row?.item ?? '',
    supplier: row?.supplier ?? '',
    phone: row?.phone ?? '',
    sku: row?.sku ?? '',
    category: row?.category ?? '',
    quantity: String(row?.rawQuantity ?? 1),
    unitPrice: String(row?.rawUnitPrice ?? 0),
    status: row?.status ?? 'Received',
    paidAmount: row?.paidAmount ?? '',
  }
}

function StatusSelect({ value, onChange }: { value: string; onChange: (status: EntryStatus) => void }) {
  const options: EntryStatus[] = ['Received', 'Returned', 'Given']
  const selected = options.includes(value as EntryStatus) ? value : 'Received'

  return (
    <select className="period-select" value={selected} onChange={(event) => onChange(event.target.value as EntryStatus)} aria-label="Change purchase status">
      {options.map((status) => <option key={status} value={status}>{status}</option>)}
    </select>
  )
}

type FlattenedPurchaseItem = {
  key: string
  purchaseId: string
  date: string
  supplier: string
  item: string
  sku: string
  category: string
  quantity: number
  unitPrice: number
  total: number
  payment: string
  status: string
}

function PurchaseItemsView({
  items,
  currency,
  totalOrders,
}: {
  items: FlattenedPurchaseItem[]
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
        it.supplier.toLowerCase().includes(q) ||
        it.purchaseId.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [items, categoryFilter, searchTerm])

  const totalReceivedUnits = filteredItems.reduce((sum, it) => sum + it.quantity, 0)
  const totalItemSpend = filteredItems.reduce((sum, it) => sum + it.total, 0)
  const distinctProductsCount = new Set(filteredItems.map((it) => it.item)).size

  const handleExportItems = () => {
    exportRows(
      'purchase_items.csv',
      filteredItems.map((it) => ({
        Date: it.date,
        PurchaseID: it.purchaseId,
        Supplier: it.supplier,
        Item: it.item,
        SKU: it.sku,
        Category: it.category,
        Quantity: it.quantity,
        UnitPrice: it.unitPrice,
        Total: it.total,
        Payment: it.payment,
        Status: it.status,
      }))
    )
  }

  return (
    <div className="page-pad">
      <div className="inventory-title">
        <div>
          <h1>Purchase Items Breakdown</h1>
          <p>Detailed view of all individual product line items received from suppliers.</p>
        </div>
        <div className="toolbar">
          <button type="button" onClick={handleExportItems}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="items-kpi-grid">
        <div className="items-kpi-card">
          <span>Total Items Received</span>
          <strong>{totalReceivedUnits} Units</strong>
        </div>
        <div className="items-kpi-card">
          <span>Distinct Products</span>
          <strong>{distinctProductsCount} Products</strong>
        </div>
        <div className="items-kpi-card">
          <span>Total Procurement Spend</span>
          <strong style={{ color: 'var(--cyan, #38bdf8)' }}>{formatMoney(totalItemSpend, currency)}</strong>
        </div>
        <div className="items-kpi-card">
          <span>Total Purchase Orders</span>
          <strong>{totalOrders} Orders</strong>
        </div>
      </div>

      <div className="items-search-bar">
        <input
          type="text"
          className="items-search-input"
          placeholder="Search items by product name, SKU, supplier, or Purchase ID..."
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
              <th>Purchase ID</th>
              <th>Supplier</th>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Unit Cost</th>
              <th>Line Total</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No purchase items found matching your filters.
                </td>
              </tr>
            ) : (
              filteredItems.map((it) => (
                <tr key={it.key}>
                  <td>{it.date}</td>
                  <td><strong>{it.purchaseId}</strong></td>
                  <td>{it.supplier}</td>
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


