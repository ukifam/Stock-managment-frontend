import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { api, type InventoryRow, type InventoryUpdatePayload } from '../api'
import { Topbar } from '../components/Topbar'
import { ImportHelp } from '../components/ImportHelp'
import { PaginationControls } from '../components/PaginationControls'
import type { PageRenderProps } from '../types'

export const page = { id: 'inventory' as const, label: 'Inventory', icon: 'box' }
import { exportRows } from '../utils/export'
import { normalizeCsvRow, parseCsvFile, parseJsonFile } from '../utils/import'
import { formatMoney } from '../utils/money'
import { cleanUnitName, formatUnitQty } from './ProductionPipeline'

/* ── Local type mirrors PipelineData (only fields we need) ── */
type PipelineSummary = {
  id: string
  productName: string
  businessType: string
  singleUnitLabel: string
  producedQuantity: number
  targetQuantity: number
  sellingPricePerUnit: number
  sales: Array<{ id: string; quantity: number; unitPrice: number }>
  currentStage: string
  completedStages: string[]
  scheduledDate: string
}

const PIPELINE_STORAGE_KEY = 'tri_production_pipelines'

function loadFinishedPipelines(): PipelineSummary[] {
  try {
    const raw = localStorage.getItem(PIPELINE_STORAGE_KEY)
    if (!raw) return []
    const all: PipelineSummary[] = JSON.parse(raw)
    return all.filter(
      (p) =>
        p.producedQuantity > 0 ||
        p.completedStages?.includes('finish') ||
        ['finish', 'store_finished', 'sell', 'cost', 'analyze'].includes(p.currentStage)
    )
  } catch { return [] }
}

export function Inventory({ theme = 'dark', toggleTheme = () => {}, setPage }: Partial<PageRenderProps>) {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [listRevision, setListRevision] = useState(0)
  const [selectedSku, setSelectedSku] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [inventoryForm, setInventoryForm] = useState<InventoryUpdatePayload>({})
  const [importError, setImportError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let isMounted = true
    api.inventory(pageSize, pageNumber).then((response) => {
      if (!isMounted) return
      setRows(response.rows)
      setTotalCount(response.count)
      setTotalPages(response.totalPages ?? 0)
      setSelectedSku((current) => response.rows.some((row) => row.sku === current) ? current : response.rows[0]?.sku || '')
      const lastPage = Math.max(1, response.totalPages ?? 1)
      if (pageNumber > lastPage) setPageNumber(lastPage)
    }).catch(() => {
      if (isMounted) setRows([])
    })
    return () => { isMounted = false }
  }, [pageNumber, pageSize, listRevision])

  const selectedRow = rows.find((row) => row.sku === selectedSku) ?? rows[0]
  const availableRows = rows.filter((row) => getStockUnits(row) > 0)
  const totalStockUnits = availableRows.reduce((sum, row) => sum + getStockUnits(row), 0)
  const totalInventoryValue = availableRows.reduce((sum, row) => sum + getStockUnits(row) * getUnitPrice(row), 0)

  useEffect(() => {
    setInventoryForm(inventoryFormFromRow(selectedRow))
    setIsEditing(false)
  }, [selectedRow?.sku])

  const handleSaveInventory = async () => {
    if (!selectedRow) return

    try {
      const updated = await api.updateInventory(selectedRow.sku, inventoryForm)
      setRows((current) => current.map((row) => (row.sku === selectedRow.sku ? updated : row)))
      setSelectedSku(updated.sku)
      setInventoryForm(inventoryFormFromRow(updated))
      setIsEditing(false)
      setImportError('Inventory item updated successfully.')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not update inventory item')
    }
  }

  const handleDeleteInventory = async () => {
    if (!selectedRow) return
    if (!window.confirm(`Are you sure you want to delete "${selectedRow.item}" (${selectedRow.sku})?`)) return

    try {
      await api.deleteInventory(selectedRow.sku)
      setRows((current) => current.filter((row) => row.sku !== selectedRow.sku))
      setSelectedSku('')
      setIsEditing(false)
      setListRevision((current) => current + 1)
      setImportError('Inventory item deleted successfully.')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not delete inventory item')
    }
  }

  const updateInventoryForm = (field: keyof InventoryUpdatePayload, value: string) => {
    setInventoryForm((current) => ({ ...current, [field]: value }))
  }

  const handleExport = () => {
    exportRows('inventory.csv', rows.map((row) => ({
      Date: row.date,
      Item: row.item,
      SKU: row.sku,
      Category: row.category,
      Stock: row.stock,
      Price: row.price,
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
      const parsed = file.name.toLowerCase().endsWith('.json')
        ? await parseJsonFile(file)
        : await parseCsvFile(file)

      const importedRows = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { rows?: unknown }).rows)
          ? (parsed as { rows: unknown[] }).rows
          : Array.isArray((parsed as { inventory?: unknown }).inventory)
            ? (parsed as { inventory: unknown[] }).inventory
            : []
      const payloads = importedRows.map((rawRow) => {
        const row = normalizeCsvRow(rawRow as Record<string, string>)
        return {
          date: row.date || new Date().toISOString().slice(0, 10),
          item: row.item || row.product || row.description || '',
          meta: row.meta || row.brand || 'Imported inventory',
          sku: row.sku || row.barcode || '',
          category: row.category || row.type || 'Uncategorized',
          stock: row.stock || row.quantity || '1',
          capacity: row.capacity || row.maxstock || row.stock || '1',
          price: row.price || row.unitprice || row.value || '0',
          status: row.status || (Number(row.stock || row.quantity || 1) <= 0 ? 'Out of Stock' : 'Active'),
          serial: row.serial || row.serialnumber || '',
          supplier: row.supplier || row.vendor || '',
          shelfLocation: row.shelflocation || row.location || '',
          leadTime: row.leadtime || '',
          warranty: row.warranty || '',
        }
      }).filter((payload) => payload.item && payload.category)

      if (payloads.length === 0) {
        setImportError('No valid inventory rows were found in the file.')
        return
      }

      const result = await api.bulkImportInventory(payloads)
      const skippedNote = result.skipped ? ` (${result.skipped} skipped)` : ''
      setPageNumber(1)
      const response = await api.inventory(pageSize, 1)
      setRows(response.rows)
      setTotalCount(response.count)
      setTotalPages(response.totalPages ?? 0)
      if (response.rows[0]?.sku) {
        setSelectedSku(response.rows[0].sku)
      }
      setImportError(`Imported ${result.count} inventory items successfully${skippedNote}.`)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import file.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <>
      <Topbar placeholder="Search Global Inventory..." theme={theme} toggleTheme={toggleTheme} />
      <div style={{ padding: '1rem 1.5rem 0 1.5rem' }}>
        <div className="subtabs-bar">
          <button
            type="button"
            className="subtab-btn active"
            onClick={() => setPage?.('inventory')}
          >
            <span className="subtab-icon">📦</span>
            <span className="subtab-label">Products</span>
            <span className="subtab-badge">{totalCount}</span>
          </button>
          <button
            type="button"
            className="subtab-btn"
            onClick={() => setPage?.('stock-movements')}
          >
            <span className="subtab-icon">↕️</span>
            <span className="subtab-label">Movements</span>
          </button>
          <button
            type="button"
            className="subtab-btn"
            onClick={() => setPage?.('stock-adjustments')}
          >
            <span className="subtab-icon">✏️</span>
            <span className="subtab-label">Adjustments</span>
          </button>
        </div>
      </div>
      <div className="inventory-layout">
        <section className="inventory-content page-pad">
          <div className="inventory-title">
            <div><h1>Inventory Management</h1><p>Real-time status of {totalCount.toLocaleString()} products.</p></div>
            <div className="toolbar">
              <button type="button" onClick={handleExport}>Export</button>
              <button type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
                {isImporting ? 'Importing…' : 'Import'}
              </button>
              <input ref={importInputRef} type="file" accept=".csv,.json" hidden onChange={handleImportFile} />
            </div>
          </div>
          <ImportHelp kind="inventory" />
          <InventoryTable rows={rows} selectedSku={selectedRow?.sku ?? ''} onSelect={setSelectedSku} />
          <PaginationControls
            page={pageNumber}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPageNumber}
            onPageSizeChange={(size) => { setPageSize(size); setPageNumber(1) }}
          />
          {importError && (
            <div style={{ marginTop: '12px', color: importError.startsWith('Imported') ? '#1b5e20' : '#d32f2f' }}>
              {importError}
            </div>
          )}
          <div className="inventory-stats">
            <div><span>Available Items</span><strong>{availableRows.length}</strong></div>
            <div><span>Available Stock</span><strong>{totalStockUnits}</strong></div>
            <div><span>Page Inventory Value</span><strong>{formatMoney(totalInventoryValue)}</strong></div>
            <div><span>Low Stock</span><strong>{rows.filter((row) => row.status === 'Low').length}</strong></div>
            <div><span>Out of Stock</span><strong>{rows.filter((row) => row.status.includes('Out')).length}</strong></div>
          </div>

          {/* Finished Products from Production Pipeline */}
          <FinishedProductsPanel setPage={setPage} />
        </section>
        <DetailPanel
          row={selectedRow}
          isEditing={isEditing}
          form={inventoryForm}
          onEditToggle={() => setIsEditing((current) => !current)}
          onFieldChange={updateInventoryForm}
          onSave={handleSaveInventory}
          onDelete={handleDeleteInventory}
          setPage={setPage}
        />
      </div>
    </>
  )
}

function getStockUnits(row: InventoryRow) {
  return Number.isFinite(row.rawStock) ? Math.max(0, row.rawStock) : 0
}

function getUnitPrice(row: InventoryRow) {
  return Number.isFinite(row.rawPrice) ? Math.max(0, row.rawPrice) : 0
}

function InventoryTable({ rows, selectedSku, onSelect }: { rows: InventoryRow[]; selectedSku: string; onSelect: (sku: string) => void }) {
  return (
    <div className="table-frame">
      <table>
        <thead><tr><th>Date</th><th>Item Name</th><th>SKU</th><th>Category</th><th>Stock Level</th><th>Unit Price</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const isOutOfStock = Number(row.rawStock ?? row.stock ?? 0) <= 0
            const isLowStock = row.status === 'Low' || (!isOutOfStock && Number(row.rawStock ?? row.stock ?? 0) <= 5)
            return (
              <tr className={row.sku === selectedSku ? 'selected-row clickable-row' : 'clickable-row'} key={row.sku} onClick={() => onSelect(row.sku)}>
                <td>{row.date}</td>
                <td><strong>{row.item}</strong><span>{row.meta}</span></td>
                <td>{row.sku}</td><td>{row.category}</td>
                <td className={isOutOfStock ? 'danger' : isLowStock ? 'warning' : ''}>{row.stock}</td>
                <td>{row.price}</td>
                <td>
                  <i className={isOutOfStock ? 'status danger' : isLowStock ? 'status low' : 'status'}>
                    {isOutOfStock ? 'Out of Stock' : row.status}
                  </i>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function inventoryFormFromRow(row?: InventoryRow): InventoryUpdatePayload {
  return {
    date: row?.date ?? '',
    item: row?.item ?? '',
    meta: row?.meta ?? '',
    sku: row?.sku ?? '',
    category: row?.category ?? '',
    stock: String(row?.rawStock ?? row?.stock ?? '0'),
    capacity: String(row?.rawCapacity ?? '0'),
    price: String(row?.rawPrice ?? row?.price ?? '0'),
    status: row?.status ?? 'Active',
    serial: row?.serial ?? '',
    supplier: row?.supplier ?? '',
    shelfLocation: row?.shelfLocation ?? '',
    leadTime: row?.leadTime ?? '',
    warranty: row?.warranty ?? '',
  }
}

function DetailPanel({
  row,
  isEditing,
  form,
  onEditToggle,
  onFieldChange,
  onSave,
  onDelete,
  setPage,
}: {
  row?: InventoryRow
  isEditing: boolean
  form: InventoryUpdatePayload
  onEditToggle: () => void
  onFieldChange: (field: keyof InventoryUpdatePayload, value: string) => void
  onSave: () => Promise<void>
  onDelete: () => void
  setPage?: (page: any) => void
}) {
  return (
    <aside className="detail-panel">
      <div className="detail-head"><h2>Inventory Details</h2><button type="button" aria-label="Close">x</button></div>
      <div className="detail-image" />
      <h2>{row?.item ?? 'No item selected'}</h2>
      <p>SKU: {row?.sku ?? '-'} - SERIAL: #{row?.serial ?? '-'}</p>
      <div className="detail-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" className="primary" disabled={!row}>Sell Item</button>
        <button type="button" onClick={onEditToggle} disabled={!row}>{isEditing ? 'Cancel' : 'Edit Item'}</button>
        {setPage && (
          <>
            <button
              type="button"
              disabled={!row}
              onClick={() => setPage('stock-adjustments')}
              title="Record physical count or adjust stock"
              style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.3)' }}
            >
              ⚖️ Stock Count
            </button>
            <button
              type="button"
              disabled={!row}
              onClick={() => setPage('stock-movements')}
              title="View stock movements ledger"
              style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', borderColor: 'rgba(148, 163, 184, 0.3)' }}
            >
              📋 Ledger
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!row}
          onClick={onDelete}
          title="Delete this inventory item"
          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
        >
          🗑 Delete
        </button>
      </div>
      {row && isEditing ? (
        <form onSubmit={async (event) => { event.preventDefault(); await onSave() }}>
          <div className="field-grid">
            <label>
              Item Name
              <input value={String(form.item ?? '')} onChange={(event) => onFieldChange('item', event.target.value)} required />
            </label>
            <label>
              Category
              <input value={String(form.category ?? '')} onChange={(event) => onFieldChange('category', event.target.value)} />
            </label>
            <label>
              SKU
              <input value={String(form.sku ?? '')} onChange={(event) => onFieldChange('sku', event.target.value)} />
            </label>
            <label>
              Supplier
              <input value={String(form.supplier ?? '')} onChange={(event) => onFieldChange('supplier', event.target.value)} />
            </label>
            <label>
              Stock
              <input type="number" min="0" value={String(form.stock ?? '')} readOnly disabled title="Use Stock Adjustments to change stock levels" style={{ opacity: 0.5, cursor: 'not-allowed' }} />
              <small style={{ color: 'var(--text-tertiary, #888)', marginTop: '4px', display: 'block' }}>
                ⚠️ Stock cannot be edited directly. Use <strong>Adjustments</strong> in the sidebar.
              </small>
            </label>
            <label>
              Capacity
              <input type="number" min="0" value={String(form.capacity ?? '')} onChange={(event) => onFieldChange('capacity', event.target.value)} />
            </label>
            <label>
              Price
              <input type="number" min="0" step="0.01" value={String(form.price ?? '')} onChange={(event) => onFieldChange('price', event.target.value)} />
            </label>
            <label>
              Status
              <input value={String(form.status ?? '')} onChange={(event) => onFieldChange('status', event.target.value)} />
            </label>
            <label>
              Shelf Location
              <input value={String(form.shelfLocation ?? '')} onChange={(event) => onFieldChange('shelfLocation', event.target.value)} />
            </label>
            <label>
              Lead Time
              <input value={String(form.leadTime ?? '')} onChange={(event) => onFieldChange('leadTime', event.target.value)} />
            </label>
            <label>
              Warranty
              <input value={String(form.warranty ?? '')} onChange={(event) => onFieldChange('warranty', event.target.value)} />
            </label>
          </div>
          <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '18px' }}>
            <button type="button" onClick={onEditToggle}>Cancel</button>
            <button className="primary-action" type="submit">Save Item</button>
          </div>
        </form>
      ) : (
        <>
          <section><h3>Logistics Data</h3><dl><div><dt>Shelf Location</dt><dd>{row?.shelfLocation ?? '-'}</dd></div><div><dt>Supplier</dt><dd>{row?.supplier ?? '-'}</dd></div><div><dt>Lead Time</dt><dd>{row?.leadTime ?? '-'}</dd></div><div><dt>Warranty</dt><dd>{row?.warranty ?? '-'}</dd></div></dl></section>
          {row?.extractedText && <section><h3>Scanned Image Text</h3><pre className="detail-extracted-text">{row.extractedText}</pre></section>}
        </>
      )}
    </aside>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Finished Products Panel — shows production pipeline output inside Inventory
───────────────────────────────────────────────────────────────────────────── */

type QuickSellState = {
  pipeline: PipelineSummary
  available: number
  unitPrice: number
} | null

function FinishedProductsPanel({ setPage }: { setPage?: (page: any) => void }) {
  const [items, setItems] = useState<PipelineSummary[]>(() => loadFinishedPipelines())
  const [quickSell, setQuickSell] = useState<QuickSellState>(null)
  const [notice, setNotice] = useState('')

  // Reload whenever the window regains focus (user may have just done pipeline work)
  useEffect(() => {
    const onFocus = () => setItems(loadFinishedPipelines())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 4000)
      return () => clearTimeout(t)
    }
  }, [notice])

  if (items.length === 0) return null

  const enriched = items.map((p) => {
    const totalSold = (p.sales ?? []).reduce((s, r) => s + r.quantity, 0)
    const available = Math.max(0, (p.producedQuantity || p.targetQuantity) - totalSold)
    const unitPrice = p.sellingPricePerUnit || 0
    return { p, totalSold, available, unitPrice, value: available * unitPrice }
  })

  const totalValue = enriched.reduce((s, e) => s + e.value, 0)
  const totalUnits = enriched.reduce((s, e) => s + e.available, 0)

  const handleConfirmSale = (
    pipeline: PipelineSummary,
    qty: number,
    unitPrice: number,
    customer: string,
    payment: string,
  ) => {
    // Persist sale into the pipeline data in localStorage
    const saleId = `PS-${Date.now()}`
    const saleDate = new Date().toISOString()

    try {
      const raw = localStorage.getItem(PIPELINE_STORAGE_KEY)
      if (raw) {
        const all = JSON.parse(raw)
        const updated = all.map((p: any) => {
          if (p.id !== pipeline.id) return p
          return {
            ...p,
            sales: [
              ...(p.sales ?? []),
              { id: saleId, date: saleDate, quantity: qty, unitPrice, customer, payment },
            ],
            updatedAt: saleDate,
          }
        })
        localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(updated))
      }
    } catch { /* ignore */ }

    // Sync to backend POS (non-blocking)
    api.createPosSale({
      id: saleId,
      date: saleDate.slice(0, 10),
      customer: customer || 'Walk-in',
      payment: (payment as any) || 'Cash',
      source: 'pipeline',
      allowFlexibleStock: true,
      items: [{
        sku: pipeline.id,
        item: pipeline.productName,
        quantity: qty,
        unitPrice,
        unit: cleanUnitName(pipeline.singleUnitLabel),
      }],
    }).catch(() => {})

    setNotice(
      `Sold ${formatUnitQty(qty, pipeline.singleUnitLabel)} of ${pipeline.productName} for ${formatMoney(qty * unitPrice)}!`,
    )
    setQuickSell(null)
    setItems(loadFinishedPipelines())
  }

  return (
    <section style={{ marginTop: '32px' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
            🏪 Finished Products
            <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 500, opacity: 0.55 }}>
              — from Production Pipeline
            </span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-soft, #94a3b8)' }}>
            {enriched.length} product{enriched.length !== 1 ? 's' : ''} ·{' '}
            {totalUnits} units available ·{' '}
            Total value {formatMoney(totalValue)}
          </p>
        </div>
        {setPage && (
          <button
            type="button"
            onClick={() => setPage('production-pipeline')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(99,102,241,0.3)',
              background: 'rgba(99,102,241,0.1)',
              color: '#a5b4fc',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ⚙️ Open Production Pipeline
          </button>
        )}
      </div>

      {notice && (
        <div
          style={{
            marginBottom: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(34,197,94,0.12)',
            color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.2)',
            fontSize: '13px',
          }}
        >
          ✅ {notice}
        </div>
      )}

      <div className="table-frame">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Unit</th>
              <th>Produced</th>
              <th>Sold</th>
              <th>Available</th>
              <th>Selling Price</th>
              <th>Stock Value</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(({ p, totalSold, available, unitPrice, value }) => {
              const unit = cleanUnitName(p.singleUnitLabel)
              const isSoldOut = available <= 0
              const isLow = available > 0 && available <= 10
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{p.productName || 'Untitled'}</strong>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                      {p.id}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-soft, #94a3b8)' }}>{unit}</td>
                  <td>{formatUnitQty(p.producedQuantity || p.targetQuantity, unit)}</td>
                  <td style={{ color: totalSold > 0 ? '#f59e0b' : 'inherit' }}>
                    {formatUnitQty(totalSold, unit)}
                  </td>
                  <td>
                    <strong
                      style={{
                        color: isSoldOut ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e',
                        fontSize: '14px',
                      }}
                    >
                      {formatUnitQty(available, unit)}
                    </strong>
                  </td>
                  <td>
                    {unitPrice > 0
                      ? formatMoney(unitPrice)
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td><strong>{value > 0 ? formatMoney(value) : '—'}</strong></td>
                  <td>
                    {isSoldOut ? (
                      <i className="status danger">Sold Out</i>
                    ) : isLow ? (
                      <i className="status low">Low Stock</i>
                    ) : (
                      <i className="status">Ready</i>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="primary"
                      disabled={isSoldOut || unitPrice <= 0}
                      onClick={() => setQuickSell({ pipeline: p, available, unitPrice })}
                      style={{ padding: '5px 12px', fontSize: '12px', opacity: isSoldOut ? 0.5 : 1 }}
                      title={
                        isSoldOut
                          ? 'No stock left'
                          : unitPrice <= 0
                            ? 'Set a selling price in the pipeline first'
                            : `Sell ${p.productName}`
                      }
                    >
                      💰 Sell
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {quickSell && (
        <InvQuickSellModal
          pipeline={quickSell.pipeline}
          available={quickSell.available}
          unitPrice={quickSell.unitPrice}
          onClose={() => setQuickSell(null)}
          onConfirm={handleConfirmSale}
        />
      )}
    </section>
  )
}

/* ── Inline Quick-Sell Modal for Inventory page ── */
function InvQuickSellModal({
  pipeline,
  available,
  unitPrice: defaultPrice,
  onClose,
  onConfirm,
}: {
  pipeline: PipelineSummary
  available: number
  unitPrice: number
  onClose: () => void
  onConfirm: (pipeline: PipelineSummary, qty: number, unitPrice: number, customer: string, payment: string) => void
}) {
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(defaultPrice)
  const [customer, setCustomer] = useState('')
  const [payment, setPayment] = useState('Cash')
  const unit = cleanUnitName(pipeline.singleUnitLabel)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (qty <= 0 || qty > available) return
    onConfirm(pipeline, qty, price, customer, payment)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface, #1e293b)',
          borderRadius: '14px',
          border: '1px solid var(--line, rgba(255,255,255,0.1))',
          padding: '24px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>💰 Sell — {pipeline.productName}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '18px', opacity: 0.7 }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              background: 'rgba(99,102,241,0.08)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text-soft)' }}>Available:</span>
            <strong style={{ color: '#22c55e' }}>{formatUnitQty(available, unit)}</strong>
          </div>

          <div className="field-grid" style={{ display: 'grid', gap: '12px' }}>
            <label>
              Quantity ({unit}s)
              <input
                type="number"
                min="1"
                max={available}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(available, Number(e.target.value))))}
                required
              />
            </label>
            <label>
              Unit Price
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                required
              />
            </label>
            <label>
              Customer (optional)
              <input
                type="text"
                placeholder="Walk-in"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </label>
            <label>
              Payment Method
              <select value={payment} onChange={(e) => setPayment(e.target.value)}>
                <option>Cash</option>
                <option>Mobile Money</option>
                <option>Card</option>
                <option>Credit</option>
              </select>
            </label>
          </div>

          <div
            style={{
              background: 'rgba(34,197,94,0.08)',
              borderRadius: '8px',
              padding: '10px 14px',
              margin: '16px 0',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text-soft)' }}>Total Sale:</span>
            <strong style={{ color: '#22c55e', fontSize: '16px' }}>{formatMoney(qty * price)}</strong>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-action">
              Confirm Sale ({formatMoney(qty * price)})
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
