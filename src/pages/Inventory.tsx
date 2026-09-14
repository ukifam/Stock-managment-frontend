import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { api, type InventoryRow, type InventoryUpdatePayload } from '../api'
import { Topbar } from '../components/Topbar'
import { ImportHelp } from '../components/ImportHelp'
import type { PageRenderProps, ThemePageProps } from '../types'

export const page = { id: 'inventory' as const, label: 'Inventory', icon: 'box' }
import { exportRows } from '../utils/export'
import { normalizeCsvRow, parseCsvFile, parseJsonFile } from '../utils/import'
import { formatMoney } from '../utils/money'

export function Inventory({ theme, toggleTheme, setPage }: Partial<PageRenderProps>) {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [selectedSku, setSelectedSku] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [inventoryForm, setInventoryForm] = useState<InventoryUpdatePayload>({})
  const [importError, setImportError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.inventory().then((response) => {
      setRows(response.rows)
      setSelectedSku((current) => current || response.rows[0]?.sku || '')
    }).catch(() => setRows([]))
  }, [])

  const selectedRow = rows.find((row) => row.sku === selectedSku) ?? rows[0]
  const totalStockUnits = rows.reduce((sum, row) => sum + Number(row.rawStock ?? row.stock ?? 0), 0)
  const totalInventoryValue = rows.reduce((sum, row) => sum + Number(row.rawStock ?? row.stock ?? 0) * Number(row.rawPrice ?? row.price ?? 0), 0)

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
      const response = await api.inventory()
      setRows(response.rows)
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
            <span className="subtab-badge">{rows.length}</span>
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
            <div><h1>Inventory Management</h1><p>Real-time status of 1,284 high-value assets.</p></div>
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
          {importError && (
            <div style={{ marginTop: '12px', color: importError.startsWith('Imported') ? '#1b5e20' : '#d32f2f' }}>
              {importError}
            </div>
          )}
          <div className="inventory-stats">
            <div><span>Items</span><strong>{rows.length}</strong></div>
            <div><span>Total Stock</span><strong>{totalStockUnits}</strong></div>
            <div><span>Inventory Value</span><strong>{formatMoney(totalInventoryValue)}</strong></div>
            <div><span>Low Stock</span><strong>{rows.filter((row) => row.status === 'Low').length}</strong></div>
            <div><span>Out of Stock</span><strong>{rows.filter((row) => row.status.includes('Out')).length}</strong></div>
          </div>
        </section>
        <DetailPanel
          row={selectedRow}
          isEditing={isEditing}
          form={inventoryForm}
          onEditToggle={() => setIsEditing((current) => !current)}
          onFieldChange={updateInventoryForm}
          onSave={handleSaveInventory}
          setPage={setPage}
        />
      </div>
    </>
  )
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
  setPage,
}: {
  row?: InventoryRow
  isEditing: boolean
  form: InventoryUpdatePayload
  onEditToggle: () => void
  onFieldChange: (field: keyof InventoryUpdatePayload, value: string) => void
  onSave: () => Promise<void>
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
