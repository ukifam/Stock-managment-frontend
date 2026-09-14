import { useEffect, useState, useMemo } from 'react'
import { api, type StockAdjustmentPayload, type InventoryRow } from '../api'
import type { PageDefinition, PageRenderProps } from '../types'

type AdjustmentMode = 'count' | 'quick'

export function StockAdjustments({ theme, setPage }: PageRenderProps) {
  const [inventoryItems, setInventoryItems] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<AdjustmentMode>('count')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSku, setSelectedSku] = useState('')
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)

  // Physical Count state
  const [countedQty, setCountedQty] = useState<string>('')
  const [countCounterName, setCountCounterName] = useState('Store Auditor / Staff')
  const [countNotes, setCountNotes] = useState('')

  // Quick Adjustment state
  const [quickType, setQuickType] = useState('DAMAGE')
  const [quickQty, setQuickQty] = useState('')
  const [quickReason, setQuickReason] = useState('')
  const [quickRef, setQuickRef] = useState('')

  useEffect(() => {
    // Fetch all inventory items so any product (even 0-stock) can be counted/adjusted
    api.inventory(2000)
      .then((res) => {
        setInventoryItems(res.rows || [])
        if (res.rows && res.rows.length > 0 && !selectedSku) {
          setSelectedSku(res.rows[0].sku)
        }
      })
      .catch(() => {
        setMessage({ text: 'Could not load inventory items from server.', type: 'error' })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const selectedItem = useMemo(() => {
    return inventoryItems.find((i) => i.sku === selectedSku)
  }, [inventoryItems, selectedSku])

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return inventoryItems
    const q = searchQuery.toLowerCase()
    return inventoryItems.filter(
      (i) => i.item.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || (i.category && i.category.toLowerCase().includes(q))
    )
  }, [inventoryItems, searchQuery])

  // Current stock of selected item
  const currentStock = selectedItem ? Number(selectedItem.rawStock ?? selectedItem.stock ?? 0) : 0

  // Count discrepancy calculations
  const parsedCount = countedQty === '' ? null : Number(countedQty)
  const discrepancy = parsedCount !== null && !isNaN(parsedCount) ? parsedCount - currentStock : null

  // Handle Physical Stock Count Submit
  const handleCountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) {
      setMessage({ text: 'Please select a product first.', type: 'error' })
      return
    }
    if (parsedCount === null || isNaN(parsedCount) || parsedCount < 0) {
      setMessage({ text: 'Please enter a valid physical count quantity (0 or greater).', type: 'error' })
      return
    }

    if (discrepancy === 0) {
      setMessage({ text: 'Physical count matches recorded system stock exactly (no discrepancy). No adjustment needed.', type: 'success' })
      return
    }

    const payload: StockAdjustmentPayload = {
      sku: selectedItem.sku,
      type: 'PHYSICAL_COUNT',
      quantity: discrepancy!,
      reason: countNotes.trim()
        ? `Physical Count: ${countNotes.trim()} (Counted ${parsedCount} vs System ${currentStock})`
        : `Physical count reconciliation: counted ${parsedCount} vs system ${currentStock} (${discrepancy! > 0 ? '+' : ''}${discrepancy})`,
      reference: `PC-${new Date().toISOString().slice(0, 10)}`,
      user: countCounterName || 'Staff',
      date: new Date().toISOString().slice(0, 10),
    }

    try {
      setSaving(true)
      await api.adjustStock(payload)
      setMessage({
        text: `Physical count applied successfully! Stock updated from ${currentStock} to ${parsedCount} units (${discrepancy! > 0 ? '+' : ''}${discrepancy} units recorded in ledger).`,
        type: 'success',
      })
      // Update local item stock
      setInventoryItems((prev) =>
        prev.map((item) =>
          item.sku === selectedItem.sku ? { ...item, rawStock: parsedCount, stock: `${parsedCount} / ${item.rawCapacity || 25}` } : item
        )
      )
      setCountedQty('')
      setCountNotes('')
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to apply physical stock count.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Handle Quick Adjustment Submit
  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) {
      setMessage({ text: 'Please select a product first.', type: 'error' })
      return
    }
    const qtyNum = Number(quickQty)
    if (!quickQty || isNaN(qtyNum) || qtyNum === 0) {
      setMessage({ text: 'Please specify a non-zero quantity change (+ or -).', type: 'error' })
      return
    }
    if (!quickReason.trim()) {
      setMessage({ text: 'Please provide a reason for the adjustment.', type: 'error' })
      return
    }

    const payload: StockAdjustmentPayload = {
      sku: selectedItem.sku,
      type: quickType,
      quantity: qtyNum,
      reason: quickReason.trim(),
      reference: quickRef.trim() || undefined,
      user: 'System Operator',
      date: new Date().toISOString().slice(0, 10),
    }

    try {
      setSaving(true)
      await api.adjustStock(payload)
      const newStockVal = currentStock + qtyNum
      setMessage({
        text: `Stock adjustment saved successfully! Updated stock: ${newStockVal} units (${qtyNum > 0 ? '+' : ''}${qtyNum} recorded in ledger).`,
        type: 'success',
      })
      // Update local item stock
      setInventoryItems((prev) =>
        prev.map((item) =>
          item.sku === selectedItem.sku ? { ...item, rawStock: newStockVal, stock: `${newStockVal} / ${item.rawCapacity || 25}` } : item
        )
      )
      setQuickQty('')
      setQuickReason('')
      setQuickRef('')
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to adjust stock.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page stock-adjustments" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <header className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-strong, #f1f5f9)' }}>
            Inventory Adjustments & Stock Count
          </h1>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--text-soft, #94a3b8)', fontSize: '0.95rem' }}>
            Reconcile physical stock counts, record damaged or lost items, and maintain a 100% traceable stock ledger.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setPage('stock-movements')}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-sm, 8px)',
              border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
              background: 'var(--panel, #141d2e)',
              color: 'var(--text-strong, #f1f5f9)',
              fontWeight: 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            📋 View Stock Ledger
          </button>
          <button
            type="button"
            onClick={() => setPage('inventory')}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-sm, 8px)',
              border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
              background: 'var(--panel, #141d2e)',
              color: 'var(--text-strong, #f1f5f9)',
              fontWeight: 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            📦 Products List
          </button>
        </div>
      </header>

      {/* Mode Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          background: 'var(--panel, #141d2e)',
          padding: '0.4rem',
          borderRadius: 'var(--radius-md, 12px)',
          border: '1px solid var(--line, rgba(148, 163, 184, 0.14))',
          width: 'fit-content',
        }}
      >
        <button
          type="button"
          onClick={() => { setMode('count'); setMessage(null) }}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: 'var(--radius-sm, 8px)',
            border: 'none',
            background: mode === 'count' ? 'var(--cyan, #3b82f6)' : 'transparent',
            color: mode === 'count' ? '#ffffff' : 'var(--text-soft, #94a3b8)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          🔍 Physical Stock Count (Reconciliation)
        </button>
        <button
          type="button"
          onClick={() => { setMode('quick'); setMessage(null) }}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: 'var(--radius-sm, 8px)',
            border: 'none',
            background: mode === 'quick' ? 'var(--cyan, #3b82f6)' : 'transparent',
            color: mode === 'quick' ? '#ffffff' : 'var(--text-soft, #94a3b8)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          ⚡ Quick Adjustment (Damage / Loss / Return)
        </button>
      </div>

      {/* Status Alert */}
      {message && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-sm, 8px)',
            marginBottom: '1.5rem',
            backgroundColor: message.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
            color: message.type === 'error' ? '#f87171' : '#4ade80',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.95rem',
          }}
        >
          <span>{message.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-soft, #94a3b8)' }}>
          ⏳ Loading inventory catalog...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Left Column: Product Selection & Live Info Card */}
          <div
            style={{
              background: 'var(--panel, #141d2e)',
              borderRadius: 'var(--radius-md, 12px)',
              border: '1px solid var(--line, rgba(148, 163, 184, 0.14))',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-strong, #f1f5f9)' }}>
              1. Select Inventory Item
            </h3>

            {/* Product Search */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', marginBottom: '0.35rem' }}>
                Search Product Name or SKU
              </label>
              <input
                type="text"
                placeholder="e.g. CCTV, HP, SKU-IMP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-sm, 8px)',
                  border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
                  background: 'var(--bg, #0b1220)',
                  color: 'var(--text-strong, #f1f5f9)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            {/* Dropdown list */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', marginBottom: '0.35rem' }}>
                Matching Products ({filteredItems.length} items)
              </label>
              <select
                value={selectedSku}
                onChange={(e) => { setSelectedSku(e.target.value); setMessage(null) }}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  borderRadius: 'var(--radius-sm, 8px)',
                  border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
                  background: 'var(--bg, #0b1220)',
                  color: 'var(--text-strong, #f1f5f9)',
                  fontSize: '0.9rem',
                }}
              >
                {filteredItems.map((item) => (
                  <option key={item.sku} value={item.sku}>
                    {item.item} — Stock: {item.rawStock ?? item.stock ?? 0} ({item.sku})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Product Card */}
            {selectedItem ? (
              <div
                style={{
                  background: 'rgba(11, 18, 32, 0.7)',
                  borderRadius: 'var(--radius-sm, 8px)',
                  border: '1px solid var(--line, rgba(148, 163, 184, 0.14))',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent, #60a5fa)', fontWeight: 600 }}>
                    {selectedItem.category || 'General Inventory'}
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-strong, #f1f5f9)', marginTop: '0.2rem' }}>
                    {selectedItem.item}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', fontFamily: 'var(--mono)' }}>
                    SKU: {selectedItem.sku}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--line, rgba(148, 163, 184, 0.1))' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-soft, #94a3b8)' }}>Current System Stock</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: currentStock <= 0 ? 'var(--danger, #ef4444)' : currentStock <= 5 ? 'var(--warning, #f59e0b)' : 'var(--success, #22c55e)' }}>
                      {currentStock} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>units</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-soft, #94a3b8)' }}>Unit Price</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-strong, #f1f5f9)' }}>
                      {selectedItem.price || '0 RWF'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                  <span>Status: <strong style={{ color: currentStock <= 0 ? 'var(--danger, #ef4444)' : 'var(--text-soft, #94a3b8)' }}>{selectedItem.status || 'Active'}</strong></span>
                  {selectedItem.shelfLocation && <span>Shelf: {selectedItem.shelfLocation}</span>}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.9rem' }}>No item selected.</div>
            )}
          </div>

          {/* Right Column: Adjustment Action Form */}
          <div
            style={{
              background: 'var(--panel, #141d2e)',
              borderRadius: 'var(--radius-md, 12px)',
              border: '1px solid var(--line, rgba(148, 163, 184, 0.14))',
              padding: '1.5rem',
            }}
          >
            {mode === 'count' ? (
              /* Physical Stock Count Mode Form */
              <form onSubmit={handleCountSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-strong, #f1f5f9)' }}>
                  2. Physical Stock Count
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-strong, #f1f5f9)' }}>
                    Actual Physical Count on Shelf *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder={`e.g. ${currentStock}`}
                    value={countedQty}
                    onChange={(e) => setCountedQty(e.target.value)}
                    required
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--cyan, #3b82f6)',
                      background: 'var(--bg, #0b1220)',
                      color: 'var(--text-strong, #f1f5f9)',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                    Enter the exact physical quantity physically counted in the warehouse/store.
                  </span>
                </div>

                {/* Discrepancy Live Box */}
                {discrepancy !== null && (
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm, 8px)',
                      background:
                        discrepancy < 0
                          ? 'rgba(239, 68, 68, 0.12)'
                          : discrepancy > 0
                          ? 'rgba(34, 197, 94, 0.12)'
                          : 'rgba(59, 130, 246, 0.12)',
                      border: `1px solid ${
                        discrepancy < 0
                          ? 'rgba(239, 68, 68, 0.3)'
                          : discrepancy > 0
                          ? 'rgba(34, 197, 94, 0.3)'
                          : 'rgba(59, 130, 246, 0.3)'
                      }`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-soft, #94a3b8)' }}>Count Result:</span>
                      <strong
                        style={{
                          fontSize: '1.1rem',
                          color:
                            discrepancy < 0
                              ? 'var(--danger, #ef4444)'
                              : discrepancy > 0
                              ? 'var(--success, #22c55e)'
                              : 'var(--cyan, #3b82f6)',
                        }}
                      >
                        {discrepancy < 0 ? `Shortage: ${discrepancy} units` : discrepancy > 0 ? `Surplus: +${discrepancy} units` : 'Exact Match (0 discrepancy)'}
                      </strong>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-soft, #94a3b8)', marginTop: '0.4rem' }}>
                      {discrepancy < 0 ? (
                        <span>System recorded <strong>{currentStock}</strong>, but only <strong>{parsedCount}</strong> were found. System will record a loss of <strong>{Math.abs(discrepancy)}</strong> units.</span>
                      ) : discrepancy > 0 ? (
                        <span>System recorded <strong>{currentStock}</strong>, but <strong>{parsedCount}</strong> were found on shelf. System will add <strong>+{discrepancy}</strong> units.</span>
                      ) : (
                        <span>System stock matches shelf count. Everything is accounted for.</span>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-soft, #94a3b8)' }}>
                    Count Auditor / Staff Name
                  </label>
                  <input
                    type="text"
                    value={countCounterName}
                    onChange={(e) => setCountCounterName(e.target.value)}
                    placeholder="Staff member performing count"
                    style={{
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
                      background: 'var(--bg, #0b1220)',
                      color: 'var(--text-strong, #f1f5f9)',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-soft, #94a3b8)' }}>
                    Audit Notes / Reason for Discrepancy
                  </label>
                  <input
                    type="text"
                    value={countNotes}
                    onChange={(e) => setCountNotes(e.target.value)}
                    placeholder="e.g. Monthly routine audit / damaged packaging discarded"
                    style={{
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
                      background: 'var(--bg, #0b1220)',
                      color: 'var(--text-strong, #f1f5f9)',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving || !selectedItem || parsedCount === null}
                  style={{
                    padding: '0.8rem',
                    background: 'var(--cyan, #3b82f6)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm, 8px)',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    marginTop: '0.5rem',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: saving || !selectedItem || parsedCount === null ? 0.6 : 1,
                  }}
                >
                  {saving ? '⏳ Applying Count...' : '✅ Save Physical Count & Update Ledger'}
                </button>
              </form>
            ) : (
              /* Quick Adjustment Mode Form */
              <form onSubmit={handleQuickSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-strong, #f1f5f9)' }}>
                  2. Quick Stock Adjustment
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-soft, #94a3b8)' }}>
                    Adjustment Category *
                  </label>
                  <select
                    value={quickType}
                    onChange={(e) => setQuickType(e.target.value)}
                    required
                    style={{
                      padding: '0.65rem 0.8rem',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
                      background: 'var(--bg, #0b1220)',
                      color: 'var(--text-strong, #f1f5f9)',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value="DAMAGE">💥 Damage / Broken Goods (-)</option>
                    <option value="LOSS">📉 Unexplained Loss / Shrinkage (-)</option>
                    <option value="THEFT">🚨 Theft / Security Incident (-)</option>
                    <option value="SUPPLIER_RETURN">↩️ Return to Supplier (-)</option>
                    <option value="CUSTOMER_RETURN">🛍️ Customer Return (+)</option>
                    <option value="CORRECTION">✏️ Data Correction (+ or -)</option>
                    <option value="ADJUSTMENT">⚙️ General Adjustment</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-soft, #94a3b8)' }}>
                    Quantity Change (+ or -) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g. -2 for damage, +5 for return"
                    value={quickQty}
                    onChange={(e) => setQuickQty(e.target.value)}
                    required
                    style={{
                      padding: '0.65rem 0.8rem',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
                      background: 'var(--bg, #0b1220)',
                      color: 'var(--text-strong, #f1f5f9)',
                      fontSize: '1rem',
                      fontWeight: 600,
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                    Negative numbers reduce stock (e.g. -1). Positive numbers add stock (e.g. 5).
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-soft, #94a3b8)' }}>
                    Reason for Adjustment *
                  </label>
                  <input
                    type="text"
                    value={quickReason}
                    onChange={(e) => setQuickReason(e.target.value)}
                    placeholder="e.g. Water damage in storage room"
                    required
                    style={{
                      padding: '0.65rem 0.8rem',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
                      background: 'var(--bg, #0b1220)',
                      color: 'var(--text-strong, #f1f5f9)',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-soft, #94a3b8)' }}>
                    Reference / Ticket (Optional)
                  </label>
                  <input
                    type="text"
                    value={quickRef}
                    onChange={(e) => setQuickRef(e.target.value)}
                    placeholder="e.g. INC-2026-091 or PO Ref"
                    style={{
                      padding: '0.65rem 0.8rem',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
                      background: 'var(--bg, #0b1220)',
                      color: 'var(--text-strong, #f1f5f9)',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving || !selectedItem || !quickQty}
                  style={{
                    padding: '0.8rem',
                    background: 'var(--cyan, #3b82f6)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm, 8px)',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    marginTop: '0.5rem',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: saving || !selectedItem || !quickQty ? 0.6 : 1,
                  }}
                >
                  {saving ? '⏳ Saving Adjustment...' : '⚡ Apply Quick Adjustment'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export const page: Pick<PageDefinition, 'id' | 'label' | 'icon'> = {
  id: 'stock-adjustments',
  label: 'Adjustments',
  icon: 'Edit3',
}
