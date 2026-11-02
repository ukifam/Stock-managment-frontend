import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type InventoryRow, type PartnerTransfer } from '../api'
import { Topbar } from '../components/Topbar'
import { formatMoney } from '../utils/money'
import type { PageRenderProps } from '../types'
import { ShopTransfers } from './ShopTransfers'

type TransferTab = 'shops' | 'consignment'

export function Transfers({ theme, toggleTheme, currency = 'RWF', setPage }: Partial<PageRenderProps>) {
  const [tab, setTab] = useState<TransferTab>('shops')
  return (
    <>
      <Topbar title="" placeholder="Search the active branch..." theme={theme ?? 'dark'} toggleTheme={toggleTheme ?? (() => undefined)} />
      <div className="page-pad transfers-shell">
        <div className="page-title-row">
          <h1>Transfers</h1>
          <div className="segmented" role="tablist" aria-label="Transfer type">
            <button type="button" role="tab" aria-selected={tab === 'shops'} className={tab === 'shops' ? 'active' : ''} onClick={() => setTab('shops')}>Between shops</button>
            <button type="button" role="tab" aria-selected={tab === 'consignment'} className={tab === 'consignment' ? 'active' : ''} onClick={() => setTab('consignment')}>Consignment</button>
          </div>
        </div>
        {tab === 'shops' ? <ShopTransfers currency={currency} setPage={setPage} /> : <ConsignmentPanel currency={currency} />}
      </div>
    </>
  )
}

type TransferAction = 'sell' | 'return'

function ConsignmentPanel({ currency }: { currency: string }) {
  const [transfers, setTransfers] = useState<PartnerTransfer[]>([])
  const [statusFilter, setStatusFilter] = useState('OPEN')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<PartnerTransfer | null>(null)
  const [action, setAction] = useState<TransferAction>('sell')
  const [receiveModalOpen, setReceiveModalOpen] = useState(false)
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN')
  const [accountingMode, setAccountingMode] = useState<'NONE' | 'PURCHASE' | 'SALE' | 'DISPOSAL'>('NONE')
  const [inventoryItems, setInventoryItems] = useState<InventoryRow[]>([])
  const [outSku, setOutSku] = useState('')

  const [partner, setPartner] = useState('')
  const [partnerPhone, setPartnerPhone] = useState('')
  const [item, setItem] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('General')
  const [quantityReceived, setQuantityReceived] = useState('1')
  const [partnerUnitCost, setPartnerUnitCost] = useState('0')
  const [customerUnitPrice, setCustomerUnitPrice] = useState('0')
  const [receivedDate, setReceivedDate] = useState(today())
  const [notes, setNotes] = useState('')

  const [closeQuantity, setCloseQuantity] = useState('1')
  const [customer, setCustomer] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [payment, setPayment] = useState('Cash')
  const [returnNotes, setReturnNotes] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.partnerTransfers(statusFilter, search)
      setTransfers(response.rows)
      setSelected((current) => response.rows.find((row) => row._id === current?._id) ?? null)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load consignment stock.')
      setTransfers([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload() }, 180)
    return () => window.clearTimeout(timer)
  }, [reload])

  useEffect(() => {
    void api.inventory(2000).then((response) => {
      setInventoryItems(response.rows)
      setOutSku(response.rows[0]?.sku || '')
    }).catch(() => setInventoryItems([]))
  }, [])

  const openTransfers = useMemo(() => transfers.filter((transfer) => transfer.status === 'OPEN'), [transfers])

  const receiveStock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.processTransfer({
        direction,
        accountingMode,
        partner: partner.trim(),
        partnerPhone: partnerPhone.trim() || undefined,
        item: item.trim(),
        sku: sku.trim() || undefined,
        category: category.trim() || 'General',
        quantity: Number(quantityReceived),
        unitCost: Number(partnerUnitCost),
        unitPrice: Number(partnerUnitCost),
        customerUnitPrice: Number(customerUnitPrice),
        inventoryPrice: Number(partnerUnitCost),
        date: receivedDate,
        notes: notes.trim() || undefined,
      })
      const created = result.transfer
      setPartner('')
      setPartnerPhone('')
      setItem('')
      setSku('')
      setCategory('General')
      setQuantityReceived('1')
      setPartnerUnitCost('0')
      setCustomerUnitPrice('0')
      setNotes('')
      setStatusFilter('OPEN')
      setSelected(created)
      setReceiveModalOpen(false)
      setNotice(accountingMode === 'PURCHASE'
        ? `Received ${created.quantityReceived} ${created.item} and recorded the owned purchase.`
        : `Received ${created.quantityReceived} ${created.item} as partner-owned stock. Inventory was not changed.`)
      await reload()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not record partner stock.')
    } finally {
      setSaving(false)
    }
  }

  const chooseAction = (transfer: PartnerTransfer, nextAction: TransferAction) => {
    setSelected(transfer)
    setAction(nextAction)
    setCloseQuantity('1')
    setCustomer('')
    setSalePrice(String(transfer.customerUnitPrice))
    setPayment('Cash')
    setReturnNotes('')
    setNotice('')
    setError('')
  }

  const closeTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    setError('')
    setNotice('')
    const quantity = Number(closeQuantity)
    try {
      if (action === 'return') {
        await api.returnPartnerTransfer(selected._id, { quantity, notes: returnNotes.trim() || undefined })
        setNotice(`Returned ${quantity} ${selected.item} to ${selected.partner}. Your inventory was not changed.`)
      } else {
        const result = await api.sellPartnerTransfer(selected._id, {
          quantity,
          customer: customer.trim(),
          unitPrice: Number(salePrice),
          payment,
          paidAmount: payment === 'Cash' ? quantity * Number(salePrice) : 0,
        }) as { sale?: { id: string } }
        setNotice(`Sale recorded for ${quantity} ${selected.item}. Sale reference: ${result.sale?.id || selected.reference}. Your inventory was not changed.`)
      }
      setSelected(null)
      await reload()
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : 'Could not close this transfer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="transfers-page">
        <header className="transfers-heading">
          <div className="transfers-heading-actions">
            <div className="transfer-balance" aria-label="Open consignment count">
              <span>Open</span><strong>{openTransfers.length}</strong>
            </div>
            <button className="primary-action" type="button" onClick={() => { setDirection('IN'); setAccountingMode('NONE'); setReceiveModalOpen(true); setError('') }}>
              Receive stock
            </button>
          </div>
        </header>

        {error && <div className="transfer-feedback error" role="alert">{error}</div>}
        {notice && <div className="transfer-feedback success" role="status">{notice}</div>}

        {receiveModalOpen && (
          <div className="modal-backdrop transfer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setReceiveModalOpen(false) }}>
            <section className="entry-modal transfer-receive-modal" role="dialog" aria-modal="true" aria-labelledby="receive-transfer-title">
              <div className="detail-head">
                <div>
                  <h2 id="receive-transfer-title">{accountingMode === 'PURCHASE' ? 'Transfer in as purchase' : 'Transfer in without purchase'}</h2>
                  <p>{accountingMode === 'PURCHASE' ? 'Add owned stock and create purchase accounting.' : 'Keep partner-owned stock outside your inventory.'}</p>
                </div>
                <button type="button" aria-label="Close receive partner items modal" onClick={() => setReceiveModalOpen(false)} disabled={saving}>Close</button>
              </div>
              {error && <div className="transfer-feedback error" role="alert">{error}</div>}
              <form className="transfer-receive-form" onSubmit={receiveStock}>
                <label>{accountingMode === 'PURCHASE' ? 'Supplier' : 'Partner shop'}<input required value={partner} onChange={(event) => setPartner(event.target.value)} placeholder={accountingMode === 'PURCHASE' ? 'Supplier name' : 'Partner or shop name'} /></label>
                <label>Partner phone<input value={partnerPhone} onChange={(event) => setPartnerPhone(event.target.value)} placeholder="Optional contact" /></label>
                <label>Item name<input required value={item} onChange={(event) => setItem(event.target.value)} placeholder="Product name" /></label>
                <label>SKU / partner reference<input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Optional SKU" /></label>
                <label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
                <label>Quantity received<input required type="number" min="1" step="1" value={quantityReceived} onChange={(event) => setQuantityReceived(event.target.value)} /></label>
                <label>Partner cost / unit<input required type="number" min="0" step="0.01" value={partnerUnitCost} onChange={(event) => setPartnerUnitCost(event.target.value)} /></label>
                <label>Customer price / unit<input required type="number" min="0.01" step="0.01" value={customerUnitPrice} onChange={(event) => setCustomerUnitPrice(event.target.value)} /></label>
                <label>Received date<input required type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} /></label>
                <label className="transfer-notes-field">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional agreement or condition notes" /></label>
                <div className="transfer-modal-actions">
                  <button type="button" onClick={() => setReceiveModalOpen(false)} disabled={saving}>Cancel</button>
                  <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : accountingMode === 'PURCHASE' ? 'Record transfer and purchase' : 'Record transfer in'}</button>
                </div>
              </form>
            </section>
          </div>
        )}

        <section className="transfer-in-out-section">
          <div className="transfer-direction-tabs" role="tablist" aria-label="Transfer direction">
            <button type="button" role="tab" aria-selected={direction === 'IN'} className={direction === 'IN' ? 'active' : ''} onClick={() => { setDirection('IN'); setAccountingMode('NONE'); setError('') }}>Transfer in</button>
            <button type="button" role="tab" aria-selected={direction === 'OUT'} className={direction === 'OUT' ? 'active' : ''} onClick={() => { setDirection('OUT'); setAccountingMode('NONE'); setError('') }}>Transfer out</button>
          </div>
          {direction === 'OUT' ? (
            <OutTransferForm
              inventoryItems={inventoryItems}
              outSku={outSku}
              setOutSku={setOutSku}
              accountingMode={accountingMode === 'SALE' || accountingMode === 'DISPOSAL' ? accountingMode : 'NONE'}
              setAccountingMode={(mode) => setAccountingMode(mode)}
              saving={saving}
              setSaving={setSaving}
              currency={currency}
              onSaved={async (notice) => { setNotice(notice); await reload() }}
              onError={setError}
            />
          ) : (
            <div className="transfer-in-choice">
              <button type="button" className={accountingMode === 'NONE' ? 'active' : ''} onClick={() => { setAccountingMode('NONE'); setReceiveModalOpen(true) }}>
                <strong>Transfer in only</strong><span>Partner-owned stock; inventory stays unchanged</span>
              </button>
              <button type="button" className={accountingMode === 'PURCHASE' ? 'active' : ''} onClick={() => { setAccountingMode('PURCHASE'); setReceiveModalOpen(true) }}>
                <strong>Transfer in as purchase</strong><span>Receives owned inventory and records a purchase</span>
              </button>
            </div>
          )}
        </section>

        <section className="transfer-register-section">
          <div className="transfer-section-heading transfer-register-heading">
            <div><h2>Transfer register</h2></div>
            <div className="transfer-register-filters">
              <label>Show<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="ALL">All transfers</option></select></label>
              <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Partner, item, SKU, reference" /></label>
            </div>
          </div>
          <div className="transfer-table-wrap">
            <table className="transfer-table">
              <thead><tr><th>Received</th><th>Transfer</th><th>Partner</th><th>Item / SKU</th><th>Received</th><th>Sold</th><th>Returned</th><th>Remaining</th><th>Partner cost</th><th>Client price</th><th>Actions</th></tr></thead>
              <tbody>
                {transfers.map((transfer) => (
                  <tr key={transfer._id} className={selected?._id === transfer._id ? 'selected' : ''}>
                    <td>{transfer.receivedDate}</td>
                    <td><strong>{transfer.reference}</strong><small className={`transfer-status ${transfer.status.toLowerCase()}`}>{transfer.status}</small></td>
                    <td>{transfer.partner}<small>{transfer.partnerPhone || ''}</small></td>
                    <td><strong>{transfer.item}</strong><small>{transfer.sku || transfer.category}</small></td>
                    <td>{transfer.quantityReceived}</td>
                    <td>{transfer.quantitySold}</td>
                    <td>{transfer.quantityReturned}</td>
                    <td><strong>{transfer.remainingQuantity}</strong></td>
                    <td>{formatMoney(transfer.partnerUnitCost, currency)}</td>
                    <td>{formatMoney(transfer.customerUnitPrice, currency)}</td>
                    <td className="transfer-actions">
                      {transfer.status === 'OPEN' ? <>
                        <button type="button" onClick={() => chooseAction(transfer, 'sell')}>Sell</button>
                        <button type="button" onClick={() => chooseAction(transfer, 'return')}>Return</button>
                      </> : <span>Closed</span>}
                    </td>
                  </tr>
                ))}
                {!loading && transfers.length === 0 && <tr><td className="transfer-empty" colSpan={11}>No transfers match this view.</td></tr>}
                {loading && <tr><td className="transfer-empty" colSpan={11}>Loading transfers…</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {selected?.status === 'OPEN' && (
          <section className="transfer-close-section">
            <div className="transfer-section-heading"><h2>{action === 'sell' ? 'Sell partner item' : 'Return partner item'}</h2><p>{selected.item} from {selected.partner} · {selected.remainingQuantity} units available</p></div>
            <form className="transfer-close-form" onSubmit={closeTransfer}>
              <label>Quantity<input required type="number" min="1" max={selected.remainingQuantity} step="1" value={closeQuantity} onChange={(event) => setCloseQuantity(event.target.value)} /></label>
              {action === 'sell' ? <>
                <label>Client name<input required value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Who bought the item?" /></label>
                <label>Agreed price / unit<input required type="number" min="0.01" step="0.01" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} /></label>
                <label>Payment<select value={payment} onChange={(event) => setPayment(event.target.value)}><option value="Cash">Cash paid</option><option value="Credit">Credit / due</option></select></label>
              </> : <label>Return note<input value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} placeholder="Optional condition or handoff note" /></label>}
              <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : action === 'sell' ? 'Record sale' : 'Record return to partner'}</button>
              <button type="button" onClick={() => setSelected(null)} disabled={saving}>Cancel</button>
            </form>
          </section>
        )}
      </div>
    </>
  )
}

type OutTransferProps = {
  inventoryItems: InventoryRow[]
  outSku: string
  setOutSku: (sku: string) => void
  accountingMode: 'NONE' | 'SALE' | 'DISPOSAL'
  setAccountingMode: (mode: 'NONE' | 'SALE' | 'DISPOSAL') => void
  saving: boolean
  setSaving: (saving: boolean) => void
  currency: string
  onSaved: (notice: string) => Promise<void>
  onError: (message: string) => void
}

function OutTransferForm({ inventoryItems, outSku, setOutSku, accountingMode, setAccountingMode, saving, setSaving, currency, onSaved, onError }: OutTransferProps) {
  const [quantity, setQuantity] = useState('1')
  const [partner, setPartner] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [payment, setPayment] = useState('Cash')
  const [notes, setNotes] = useState('')
  const selected = inventoryItems.find((row) => row.sku === outSku)
  const available = Number(selected?.rawStock ?? selected?.stock ?? 0)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return onError('Select an inventory item.')
    if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0) return onError('Quantity must be a positive whole number.')
    if (Number(quantity) > available) return onError(`Only ${available} units are available.`)
    if (accountingMode === 'SALE' && (!partner.trim() || Number(unitPrice) <= 0)) return onError('Enter a customer and sale price.')
    onError('')
    setSaving(true)
    try {
      const result = await api.processTransfer({
        direction: 'OUT',
        accountingMode,
        partner: accountingMode === 'SALE' ? partner.trim() : partner.trim() || 'Stock transfer',
        item: selected.item,
        sku: selected.sku,
        category: selected.category,
        quantity: Number(quantity),
        unitCost: selected.purchasePrice,
        unitPrice: accountingMode === 'SALE' ? Number(unitPrice) : undefined,
        customerUnitPrice: accountingMode === 'SALE' ? Number(unitPrice) : undefined,
        payment,
        date: today(),
        notes: notes.trim() || undefined,
      })
      const action = accountingMode === 'NONE' ? 'Transfer out recorded' : accountingMode === 'SALE' ? 'Sale and transfer out recorded' : 'Disposal and transfer out recorded'
      await onSaved(`${action}: ${quantity} ${result.transfer.item}.`)
      setQuantity('1')
      setPartner('')
      setUnitPrice('')
      setNotes('')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not record transfer out.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="transfer-out-form" onSubmit={submit}>
      <div className="transfer-out-modes" role="radiogroup" aria-label="Transfer out accounting">
        <button type="button" role="radio" aria-checked={accountingMode === 'NONE'} className={accountingMode === 'NONE' ? 'active' : ''} onClick={() => setAccountingMode('NONE')}><strong>Transfer out only</strong><span>No sale or disposal accounting</span></button>
        <button type="button" role="radio" aria-checked={accountingMode === 'SALE'} className={accountingMode === 'SALE' ? 'active' : ''} onClick={() => setAccountingMode('SALE')}><strong>Transfer out + sale</strong><span>Create a sale and stock movement</span></button>
        <button type="button" role="radio" aria-checked={accountingMode === 'DISPOSAL'} className={accountingMode === 'DISPOSAL' ? 'active' : ''} onClick={() => setAccountingMode('DISPOSAL')}><strong>Transfer out + disposal</strong><span>Record damage / disposal</span></button>
      </div>
      <label>Inventory item
        <select value={outSku} onChange={(event) => setOutSku(event.target.value)}>
          <option value="">Select item</option>
          {inventoryItems.map((row) => <option key={row.sku} value={row.sku}>{row.item} — {row.sku} ({row.rawStock ?? row.stock})</option>)}
        </select>
      </label>
      <label>Quantity<input required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      {accountingMode === 'SALE' ? <>
        <label>Customer<input required value={partner} onChange={(event) => setPartner(event.target.value)} /></label>
        <label>Sale price / unit<input required type="number" min="0.01" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /></label>
        <label>Payment<select value={payment} onChange={(event) => setPayment(event.target.value)}><option value="Cash">Cash paid</option><option value="Credit">Credit / due</option></select></label>
      </> : <label>{accountingMode === 'DISPOSAL' ? 'Disposal destination' : 'Destination / partner'}<input value={partner} onChange={(event) => setPartner(event.target.value)} placeholder="Optional" /></label>}
      <label className="transfer-out-notes">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Reason or handoff note" /></label>
      <div className="transfer-modal-actions"><strong>Available: {available} units · {currency}</strong><button className="primary-action" type="submit" disabled={saving || inventoryItems.length === 0}>{saving ? 'Saving…' : 'Record transfer out'}</button></div>
    </form>
  )
}

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
