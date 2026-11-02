import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type InventoryRow, type ShopTransfer, type ShopTransferListResponse } from '../api'
import { useAuth } from '../context/AuthContext'
import type { Page } from '../types'
import { canAccess } from '../utils/access'
import { formatMoney } from '../utils/money'

type StatusFilter = 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED' | 'ALL'

const FILTERS: Array<[StatusFilter, string]> = [['IN_TRANSIT', 'In transit'], ['RECEIVED', 'Received'], ['CANCELLED', 'Cancelled'], ['ALL', 'All']]

const STATUS_LABELS: Record<ShopTransfer['status'], string> = {
  IN_TRANSIT: 'In transit',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

type ShopTransfersProps = {
  currency: string
  setPage?: (page: Page) => void
}

export function ShopTransfers({ currency, setPage }: ShopTransfersProps) {
  const { user } = useAuth()
  const [data, setData] = useState<ShopTransferListResponse | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('IN_TRANSIT')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const canSend = canAccess(user, 'transfers', 'create')
  const canCancel = canAccess(user, 'transfers', 'cancel')

  const load = useCallback(async () => {
    try {
      const response = await api.shopTransfers(filter, search)
      setData(response)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load transfers.')
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 180)
    return () => window.clearTimeout(timer)
  }, [load])

  const rows = data?.rows || []
  const selected = rows.find((row) => row.id === selectedId) || rows[0] || null
  const done = async (message: string, id?: string) => {
    setNotice(message)
    setError('')
    if (id) setSelectedId(id)
    await load()
  }

  if (data && data.branches.length === 0) {
    return (
      <div className="panel transfer-setup">
        <h2>Only one shop</h2>
        <p className="empty-state">Add another shop (branch) to move stock between shops.</p>
        {setPage && <button type="button" className="primary-action" onClick={() => setPage('organization')}>Add a shop</button>}
      </div>
    )
  }

  return (
    <>
      <div className="toolbar shop-transfer-toolbar">
        <div className="segmented">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setSelectedId('') }}>
              {label}
              {value === 'IN_TRANSIT' && Boolean(data?.incomingCount) && <span className="count-badge">{data?.incomingCount}</span>}
            </button>
          ))}
        </div>
        <input type="search" placeholder="Reference, product, driver" value={search} onChange={(event) => setSearch(event.target.value)} />
        {data && <span className="current-shop">At <b>{data.currentBranch.name}</b></span>}
        {canSend && <button type="button" className="primary-action" onClick={() => setCreating(true)}>+ New transfer</button>}
      </div>

      {error && <div className="notice error" role="alert">{error}</div>}
      {notice && <div className="notice success" role="status">{notice}</div>}

      <div className="list-detail-layout shop-transfer-layout">
        <section>
          <div className="table-frame">
            <table>
              <thead>
                <tr><th>Sent</th><th>Reference</th><th>Route</th><th>Products</th><th>Units</th><th>Value</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="empty-state">Loading…</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={7} className="empty-state">No transfers</td></tr>}
                {rows.map((row) => (
                  <tr key={row.id} className={selected?.id === row.id ? 'selected-row' : ''} onClick={() => setSelectedId(row.id)}>
                    <td>{row.sentDate}</td>
                    <td><strong>{row.reference}</strong></td>
                    <td><span className={`dir-tag ${row.direction.toLowerCase()}`}>{row.direction === 'IN' ? 'In' : 'Out'}</span> {row.fromName} → {row.toName}</td>
                    <td>{row.items[0]?.item}{row.items.length > 1 ? ` +${row.items.length - 1}` : ''}</td>
                    <td>{row.totalUnits}</td>
                    <td>{formatMoney(row.value, currency)}</td>
                    <td><TransferStatus transfer={row} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="detail-panel">
          {selected
            ? <TransferDetail key={`${selected.id}:${selected.status}`} transfer={selected} currency={currency} canCancel={canCancel} onDone={done} onError={setError} />
            : <p className="empty-state">Select a transfer</p>}
        </aside>
      </div>

      {creating && data && (
        <NewTransferDialog
          branches={data.branches}
          fromName={data.currentBranch.name}
          currency={currency}
          onClose={() => setCreating(false)}
          onSent={async (transfer) => {
            setCreating(false)
            setFilter('IN_TRANSIT')
            await done(`${transfer.reference} sent to ${transfer.toName}`, transfer.id)
          }}
        />
      )}
    </>
  )
}

function TransferStatus({ transfer }: { transfer: ShopTransfer }) {
  return (
    <span className={`transfer-chip ${transfer.status.toLowerCase()}`}>
      {STATUS_LABELS[transfer.status]}{transfer.shortage > 0 ? ` · ${transfer.shortage} short` : ''}
    </span>
  )
}

function TransferDetail({ transfer, currency, canCancel, onDone, onError }: {
  transfer: ShopTransfer
  currency: string
  canCancel: boolean
  onDone: (message: string, id?: string) => Promise<void>
  onError: (message: string) => void
}) {
  const [received, setReceived] = useState<Record<string, string>>(() => Object.fromEntries(transfer.items.map((line) => [line.sku, String(line.quantity)])))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const receiving = transfer.direction === 'IN' && transfer.status === 'IN_TRANSIT'
  const shortage = transfer.items.reduce((sum, line) => sum + Math.max(0, line.quantity - Number(received[line.sku] || 0)), 0)

  const receive = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await api.receiveShopTransfer(transfer.id, {
        items: transfer.items.map((line) => ({ sku: line.sku, receivedQuantity: Number(received[line.sku] || 0) })),
        notes: notes.trim() || undefined,
      })
      await onDone(`${result.receivedUnits} units added to stock${result.shortage ? `, ${result.shortage} short` : ''}`, result.id)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not receive the transfer.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!window.confirm(`Cancel ${transfer.reference}? The stock will return to ${transfer.fromName}.`)) return
    setBusy(true)
    try {
      await api.cancelShopTransfer(transfer.id)
      await onDone(`${transfer.reference} cancelled; stock returned`, transfer.id)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not cancel the transfer.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={receive}>
      <div className="detail-head transfer-detail-head">
        <h2>{transfer.reference}</h2>
        <TransferStatus transfer={transfer} />
      </div>
      <dl className="kv-list">
        <div><dt>From</dt><dd>{transfer.fromName}</dd></div>
        <div><dt>To</dt><dd>{transfer.toName}</dd></div>
        <div><dt>Sent</dt><dd>{transfer.sentDate}{transfer.sentBy ? ` · ${transfer.sentBy}` : ''}</dd></div>
        {transfer.expectedDate && <div><dt>Expected</dt><dd>{transfer.expectedDate}</dd></div>}
        {transfer.transporter && <div><dt>Transport</dt><dd>{transfer.transporter}</dd></div>}
        {transfer.receivedDate && <div><dt>Received</dt><dd>{transfer.receivedDate}{transfer.receivedBy ? ` · ${transfer.receivedBy}` : ''}</dd></div>}
        <div><dt>Value</dt><dd>{formatMoney(transfer.value, currency)}</dd></div>
        {transfer.notes && <div><dt>Note</dt><dd>{transfer.notes}</dd></div>}
        {transfer.receiveNotes && <div><dt>On arrival</dt><dd>{transfer.receiveNotes}</dd></div>}
      </dl>

      <table className="transfer-lines">
        <thead><tr><th>Product</th><th>Sent</th><th>{receiving ? 'Arrived' : 'Received'}</th></tr></thead>
        <tbody>
          {transfer.items.map((line) => (
            <tr key={line.sku}>
              <td><strong>{line.item}</strong><small>{line.sku}</small></td>
              <td>{line.quantity} {line.unit}</td>
              <td>
                {receiving
                  ? <input type="number" min="0" max={line.quantity} step="any" required value={received[line.sku] ?? ''} onChange={(event) => setReceived({ ...received, [line.sku]: event.target.value })} aria-label={`${line.item} arrived`} />
                  : transfer.status === 'RECEIVED' ? `${line.receivedQuantity} ${line.unit}` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {receiving && (
        <>
          {shortage > 0 && <p className="notice warning">{shortage} units short will be recorded</p>}
          <label className="transfer-note">Note<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Condition on arrival" /></label>
          <div className="button-row"><button type="submit" className="primary-action" disabled={busy}>{busy ? 'Saving…' : 'Confirm received'}</button></div>
        </>
      )}
      {transfer.direction === 'OUT' && transfer.status === 'IN_TRANSIT' && (
        <div className="button-row">
          <span className="current-shop">Waiting for <b>{transfer.toName}</b></span>
          {canCancel && <button type="button" className="danger-button" disabled={busy} onClick={() => void cancel()}>Cancel transfer</button>}
        </div>
      )}
    </form>
  )
}

type Line = { sku: string; quantity: string }

function NewTransferDialog({ branches, fromName, currency, onClose, onSent }: {
  branches: Array<{ code: string; name: string }>
  fromName: string
  currency: string
  onClose: () => void
  onSent: (transfer: ShopTransfer) => Promise<void>
}) {
  const [products, setProducts] = useState<InventoryRow[]>([])
  const [toBranch, setToBranch] = useState(branches[0]?.code || '')
  const [lines, setLines] = useState<Line[]>([{ sku: '', quantity: '' }])
  const [transporter, setTransporter] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.inventory(2000)
      .then((response) => setProducts(response.rows.filter((row) => Number(row.rawStock) > 0)))
      .catch(() => setError('Could not load products.'))
  }, [])

  const product = (sku: string) => products.find((row) => row.sku === sku)
  const updateLine = (index: number, patch: Partial<Line>) => setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  const value = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(product(line.sku)?.purchasePrice || product(line.sku)?.rawPrice || 0), 0)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const transfer = await api.sendShopTransfer({
        toBranch,
        items: lines.filter((line) => line.sku).map((line) => ({ sku: line.sku, quantity: Number(line.quantity) })),
        transporter: transporter.trim() || undefined,
        expectedDate: expectedDate || undefined,
        notes: notes.trim() || undefined,
      })
      await onSent(transfer)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send the transfer.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="entry-modal transfer-dialog" role="dialog" aria-modal="true" aria-label="New transfer">
        <header className="detail-head transfer-detail-head">
          <h2>New transfer</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Close">×</button>
        </header>
        <form onSubmit={submit}>
          <div className="transfer-route">
            <label>From<input value={fromName} disabled /></label>
            <span aria-hidden="true">→</span>
            <label>To
              <select required value={toBranch} onChange={(event) => setToBranch(event.target.value)}>
                {branches.map((branch) => <option key={branch.code} value={branch.code}>{branch.name}</option>)}
              </select>
            </label>
          </div>

          <div className="transfer-line-list">
            {lines.map((line, index) => {
              const selected = product(line.sku)
              return (
                <div key={index} className="transfer-line">
                  <select required value={line.sku} onChange={(event) => updateLine(index, { sku: event.target.value })} aria-label="Product">
                    <option value="">Choose product</option>
                    {products.map((row) => (
                      <option key={row.sku} value={row.sku} disabled={row.sku !== line.sku && lines.some((other) => other.sku === row.sku)}>
                        {row.item} · {row.rawStock} {row.baseUnit || ''}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    max={selected?.rawStock}
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: event.target.value })}
                    aria-label="Quantity"
                  />
                  <span className="transfer-line-unit">{selected?.baseUnit || ''}</span>
                  <button type="button" className="link-button" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, i) => i !== index))} aria-label="Remove product">✕</button>
                </div>
              )
            })}
            <button type="button" className="link-button" onClick={() => setLines([...lines, { sku: '', quantity: '' }])}>+ Add product</button>
          </div>

          <div className="transfer-extra">
            <label>Transport<input value={transporter} onChange={(event) => setTransporter(event.target.value)} placeholder="Driver / vehicle plate" /></label>
            <label>Expected arrival<input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} /></label>
            <label className="transfer-extra-wide">Note<input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </div>

          {error && <div className="notice error" role="alert">{error}</div>}
          <footer className="transfer-dialog-footer">
            <span>Value <b>{formatMoney(value, currency)}</b></span>
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="primary-action" disabled={saving || !toBranch}>{saving ? 'Sending…' : 'Send'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
