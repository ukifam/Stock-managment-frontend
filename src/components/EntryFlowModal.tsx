import { useState } from 'react'
import type { EntryMode, EntryType } from '../types'

type EntryFlowModalProps = {
  onClose: () => void
  onSubmit: (type: EntryType, mode: EntryMode) => void
}

export function EntryFlowModal({ onClose, onSubmit }: EntryFlowModalProps) {
  const [mode, setMode] = useState<EntryMode | null>(null)

  if (!mode) {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="entry-modal method-modal" aria-labelledby="entry-method-title">
          <div className="detail-head">
            <div>
              <h2 id="entry-method-title">New Entry</h2>
              <p>Choose how you want to add the item first.</p>
            </div>
            <button type="button" aria-label="Close new entry modal" onClick={onClose}>x</button>
          </div>

          <div className="method-grid">
            <button type="button" className="method-card" onClick={() => setMode('scan')}>
              <span>Scan Item</span>
              <small>Use barcode, serial, or photo scan before completing the transaction.</small>
            </button>
            <button type="button" className="method-card" onClick={() => setMode('manual')}>
              <span>Add Manually</span>
              <small>Enter item, customer or supplier, phone number, and quantity by hand.</small>
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (mode === 'scan') {
    return <ScanEntryModal onBack={() => setMode(null)} onClose={onClose} onSubmit={onSubmit} />
  }

  return <ManualEntryModal mode={mode} onBack={() => setMode(null)} onClose={onClose} onSubmit={onSubmit} />
}

function ScanEntryModal({ onBack, onClose, onSubmit }: EntryFlowModalProps & { onBack: () => void }) {
  const [type, setType] = useState<EntryType>('purchase')

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="entry-modal scan-entry-modal" onSubmit={(event) => { event.preventDefault(); onSubmit(type, 'scan') }}>
        <div className="detail-head">
          <div>
            <h2>Scan Entry</h2>
            <p>Choose what kind of transaction you are scanning.</p>
          </div>
          <button type="button" aria-label="Close scan entry modal" onClick={onClose}>x</button>
        </div>

        <label>Scan For
          <select value={type} onChange={(event) => setType(event.target.value as EntryType)}>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
          </select>
        </label>

        <div className="scan-preview-card">
          <div className="scanner-hero"><span>Ready to Scan...</span><b>Standby</b><i /></div>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onBack}>Back</button>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary-action" type="submit">Open Scanner</button>
        </div>
      </form>
    </div>
  )
}

function ManualEntryModal({ mode, onBack, onClose, onSubmit }: EntryFlowModalProps & { mode: EntryMode; onBack: () => void }) {
  const [type, setType] = useState<EntryType>('purchase')
  const isPurchase = type === 'purchase'

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="entry-modal" onSubmit={(event) => { event.preventDefault(); onSubmit(type, mode) }}>
        <div className="detail-head">
          <div>
            <h2>New Entry</h2>
            <p>Manual mode selected. Add the transaction details before continuing.</p>
          </div>
          <button type="button" aria-label="Close new entry modal" onClick={onClose}>x</button>
        </div>

        <label>Entry Type
          <select value={type} onChange={(event) => setType(event.target.value as EntryType)}>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
          </select>
        </label>

        <div className="field-grid">
          <label>Item Name
            <input placeholder={isPurchase ? 'Purchased item name...' : 'Sold item name...'} />
          </label>
          <label>{isPurchase ? 'Supplier' : 'Customer'}
            <input placeholder={isPurchase ? 'Supplier name...' : 'Customer name...'} />
          </label>
          <label>Phone Number
            <input placeholder="+1 (555) 000-0000" />
          </label>
          <label>{isPurchase ? 'Purchase Reference' : 'Sale Reference'}
            <input placeholder={isPurchase ? 'PO-9281-A' : 'SO-90210-A'} />
          </label>
          <label>Item Category
            <select defaultValue="Computing">
              <option>Computing</option>
              <option>Visual Displays</option>
              <option>Peripherals</option>
              <option>Imaging Gear</option>
              <option>Drones</option>
            </select>
          </label>
          <label>Quantity
            <input type="number" min="1" defaultValue="1" />
          </label>
        </div>

        <label>Item Search or SKU
          <input placeholder="Enter SKU before continuing..." />
        </label>

        <div className="modal-actions">
          <button type="button" onClick={onBack}>Back</button>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary-action" type="submit">{isPurchase ? 'Add Purchase Manually' : 'Add Sale Manually'}</button>
        </div>
      </form>
    </div>
  )
}
