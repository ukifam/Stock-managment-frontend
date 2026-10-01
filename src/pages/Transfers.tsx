import { useEffect, useMemo, useState } from 'react'
import { api, type PartnerTransfer } from '../api'
import { Topbar } from '../components/Topbar'
import { formatMoney } from '../utils/money'
import type { PageRenderProps } from '../types'

export const page = { id: 'transfers' as const, label: 'Transfers', icon: 'transfer' }

type TransferAction = 'sell' | 'return'

export function Transfers({ theme, toggleTheme, currency = 'RWF' }: Partial<PageRenderProps>) {
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

  const reload = async () => {
    setLoading(true)
    try {
      const response = await api.partnerTransfers(statusFilter, search)
      setTransfers(response.rows)
      setSelected((current) => response.rows.find((row) => row._id === current?._id) ?? null)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load partner transfers.')
      setTransfers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload() }, 180)
    return () => window.clearTimeout(timer)
  }, [statusFilter, search])

  const openTransfers = useMemo(() => transfers.filter((transfer) => transfer.status === 'OPEN'), [transfers])

  const receiveStock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const created = await api.receivePartnerTransfer({
        partner: partner.trim(),
        partnerPhone: partnerPhone.trim() || undefined,
        item: item.trim(),
        sku: sku.trim() || undefined,
        category: category.trim() || 'General',
        quantityReceived: Number(quantityReceived),
        partnerUnitCost: Number(partnerUnitCost),
        customerUnitPrice: Number(customerUnitPrice),
        receivedDate,
        notes: notes.trim() || undefined,
      })
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
      setNotice(`Received ${created.quantityReceived} ${created.item} from ${created.partner}. Your inventory was not changed.`)
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
      <Topbar title="Transfers" placeholder="Search partner, item, SKU, or transfer..." theme={theme ?? 'dark'} toggleTheme={toggleTheme ?? (() => undefined)} />
      <div className="transfers-page page-pad">
        <header className="transfers-heading">
          <div>
            <h1>Partner Stock Transfers</h1>
            <p>Track partner-owned stock separately. Receiving and returning it never changes your inventory.</p>
          </div>
          <div className="transfers-heading-actions">
            <div className="transfer-balance" aria-label="Open transfer count">
              <span>Open transfers</span><strong>{openTransfers.length}</strong>
            </div>
            <button className="primary-action" type="button" onClick={() => { setReceiveModalOpen(true); setError('') }}>
              Receive partner items
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
                  <h2 id="receive-transfer-title">Receive partner items</h2>
                  <p>Record partner stock separately from your own inventory.</p>
                </div>
                <button type="button" aria-label="Close receive partner items modal" onClick={() => setReceiveModalOpen(false)} disabled={saving}>Close</button>
              </div>
              {error && <div className="transfer-feedback error" role="alert">{error}</div>}
              <form className="transfer-receive-form" onSubmit={receiveStock}>
                <label>Partner shop<input required value={partner} onChange={(event) => setPartner(event.target.value)} placeholder="Partner or shop name" /></label>
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
                  <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record partner stock'}</button>
                </div>
              </form>
            </section>
          </div>
        )}

        <section className="transfer-register-section">
          <div className="transfer-section-heading transfer-register-heading">
            <div><h2>Transfer register</h2><p>Partner quantities remain outside your owned inventory.</p></div>
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

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
