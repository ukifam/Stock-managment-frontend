import { useEffect, useState, useMemo } from 'react'
import { api, type StockMovementRow } from '../api'
import { exportRows } from '../utils/export'
import type { PageDefinition, PageRenderProps } from '../types'

export function StockMovements({ setPage }: Partial<PageRenderProps>) {
  const [movements, setMovements] = useState<StockMovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [page, setPageNum] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const loadMovements = async (pageNumber: number, search: string, type: string) => {
    try {
      setLoading(true)
      const res = await api.stockMovements(undefined, pageNumber, 50, type, search)
      if (pageNumber === 1) {
        setMovements(res.rows)
      } else {
        setMovements((prev) => [...prev, ...res.rows])
      }
      setTotalCount(res.count || 0)
      setHasMore(res.rows.length === 50)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPageNum(1)
    loadMovements(1, searchFilter, typeFilter)
  }, [searchFilter, typeFilter])

  // Summary Metrics from current view
  const metrics = useMemo(() => {
    let inflow = 0
    let outflow = 0
    let shrinkage = 0

    movements.forEach((m) => {
      const q = Number(m.quantity || 0)
      if (['PURCHASE', 'OPENING_STOCK', 'CUSTOMER_RETURN'].includes(m.type) || q > 0) {
        inflow += Math.max(0, q)
      }
      if (m.type === 'SALE') {
        outflow += Math.abs(q)
      }
      if (['DAMAGE', 'LOSS', 'THEFT', 'PHYSICAL_COUNT'].includes(m.type) && q < 0) {
        shrinkage += Math.abs(q)
      }
    })

    return { inflow, outflow, shrinkage }
  }, [movements])

  const handleExport = () => {
    if (movements.length === 0) return
    exportRows(
      `stock_movements_${new Date().toISOString().slice(0, 10)}.csv`,
      movements.map((m) => ({
        Date: m.date,
        Type: m.type,
        Item: m.item || '-',
        SKU: m.sku,
        QuantityChange: String(m.quantity),
        PreviousStock: String(m.previousStock),
        NewStock: String(m.newStock),
        Reason: m.reason || '',
        Reference: m.reference || '',
        User: m.user || '',
      }))
    )
  }

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }
      case 'SALE':
        return { background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }
      case 'PHYSICAL_COUNT':
        return { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }
      case 'DAMAGE':
      case 'LOSS':
      case 'THEFT':
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }
      case 'OPENING_STOCK':
        return { background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.3)' }
      case 'CUSTOMER_RETURN':
        return { background: 'rgba(20, 184, 166, 0.15)', color: '#2dd4bf', border: '1px solid rgba(20, 184, 166, 0.3)' }
      default:
        return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)' }
    }
  }

  return (
    <div className="page stock-movements" style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Page Header */}
      <header className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-strong, #f1f5f9)' }}>
            Stock Movements Ledger
          </h1>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--text-soft, #94a3b8)', fontSize: '0.95rem' }}>
            Complete audit trail of every stock increase, deduction, physical count reconciliation, and damage write-off.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={movements.length === 0}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-sm, 8px)',
              border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
              background: 'var(--panel, #141d2e)',
              color: 'var(--text-strong, #f1f5f9)',
              fontWeight: 500,
              fontSize: '0.9rem',
              cursor: movements.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            📥 Export CSV
          </button>
          {setPage && (
            <button
              type="button"
              onClick={() => setPage('stock-adjustments')}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-sm, 8px)',
                border: 'none',
                background: 'var(--cyan, #3b82f6)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              ➕ New Adjustment / Count
            </button>
          )}
        </div>
      </header>

      {/* KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            background: 'var(--panel, #141d2e)',
            borderRadius: 'var(--radius-md, 12px)',
            border: '1px solid var(--line, rgba(148, 163, 184, 0.14))',
            padding: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ledger Entries
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-strong, #f1f5f9)', marginTop: '0.2rem' }}>
            {totalCount} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-soft, #94a3b8)' }}>movements</span>
          </div>
        </div>

        <div
          style={{
            background: 'var(--panel, #141d2e)',
            borderRadius: 'var(--radius-md, 12px)',
            border: '1px solid var(--line, rgba(148, 163, 184, 0.14))',
            padding: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Inflow Recorded
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success, #22c55e)', marginTop: '0.2rem' }}>
            +{metrics.inflow} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-soft, #94a3b8)' }}>units added</span>
          </div>
        </div>

        <div
          style={{
            background: 'var(--panel, #141d2e)',
            borderRadius: 'var(--radius-md, 12px)',
            border: '1px solid var(--line, rgba(148, 163, 184, 0.14))',
            padding: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sales Deductions
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--cyan, #3b82f6)', marginTop: '0.2rem' }}>
            -{metrics.outflow} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-soft, #94a3b8)' }}>units sold</span>
          </div>
        </div>

        <div
          style={{
            background: 'var(--panel, #141d2e)',
            borderRadius: 'var(--radius-md, 12px)',
            border: '1px solid var(--line, rgba(148, 163, 184, 0.14))',
            padding: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Shrinkage & Discrepancies
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger, #ef4444)', marginTop: '0.2rem' }}>
            -{metrics.shrinkage} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-soft, #94a3b8)' }}>units lost/damaged</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '1rem',
          background: 'var(--panel, #141d2e)',
          padding: '0.8rem 1.25rem',
          borderRadius: 'var(--radius-md, 12px)',
          border: '1px solid var(--line, rgba(148, 163, 184, 0.14))',
        }}
      >
        <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted, #64748b)' }}>🔍</span>
          <input
            type="text"
            placeholder="Search SKU, product, reason, reference..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-strong, #f1f5f9)',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              background: 'var(--bg, #0b1220)',
              color: 'var(--text-strong, #f1f5f9)',
              border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
              borderRadius: 'var(--radius-sm, 8px)',
              padding: '0.4rem 0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <option value="ALL">All Types</option>
            <option value="PHYSICAL_COUNT">Physical Stock Count</option>
            <option value="DAMAGE">Damage</option>
            <option value="LOSS">Loss</option>
            <option value="THEFT">Theft</option>
            <option value="PURCHASE">Purchase (+)</option>
            <option value="SALE">Sale (-)</option>
            <option value="OPENING_STOCK">Opening Stock</option>
            <option value="CUSTOMER_RETURN">Customer Return</option>
            <option value="SUPPLIER_RETURN">Supplier Return</option>
            <option value="ADJUSTMENT">General Adjustment</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div
        style={{
          background: 'var(--panel, #141d2e)',
          borderRadius: 'var(--radius-md, 12px)',
          border: '1px solid var(--line, rgba(148, 163, 184, 0.14))',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line, rgba(148, 163, 184, 0.14))', background: 'rgba(11, 18, 32, 0.5)' }}>
                <th style={{ padding: '0.9rem 1rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '0.9rem 1rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Movement Type</th>
                <th style={{ padding: '0.9rem 1rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Product / SKU</th>
                <th style={{ padding: '0.9rem 1rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textAlign: 'right' }}>Qty Change</th>
                <th style={{ padding: '0.9rem 1rem', color: 'var(--text-muted, #64748b)', fontWeight: 600, textAlign: 'center' }}>Before → After</th>
                <th style={{ padding: '0.9rem 1rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Reason / Details</th>
                <th style={{ padding: '0.9rem 1rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Ref</th>
                <th style={{ padding: '0.9rem 1rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>User</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const isPositive = Number(m.quantity) > 0
                return (
                  <tr
                    key={m._id || m.id || Math.random().toString()}
                    style={{
                      borderBottom: '1px solid var(--line, rgba(148, 163, 184, 0.08))',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={{ padding: '0.9rem 1rem', color: 'var(--text-soft, #94a3b8)', whiteSpace: 'nowrap' }}>
                      {m.date}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          ...getTypeBadgeStyle(m.type),
                        }}
                      >
                        {m.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '0.9rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-strong, #f1f5f9)' }}>
                        {m.item || m.sku}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', fontFamily: 'var(--mono)' }}>
                        {m.sku}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: '0.9rem 1rem',
                        textAlign: 'right',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: isPositive ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isPositive ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--text-soft, #94a3b8)', fontFamily: 'var(--mono)' }}>
                      <span>{m.previousStock}</span>
                      <span style={{ margin: '0 0.4rem', color: 'var(--text-muted, #64748b)' }}>→</span>
                      <strong style={{ color: 'var(--text-strong, #f1f5f9)' }}>{m.newStock}</strong>
                    </td>
                    <td style={{ padding: '0.9rem 1rem', color: 'var(--text-soft, #94a3b8)', maxWidth: '280px' }}>
                      {m.reason || '-'}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>
                      {m.reference || '-'}
                    </td>
                    <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>
                      {m.user || 'System'}
                    </td>
                  </tr>
                )
              })}

              {loading && (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                    ⏳ Loading movements ledger...
                  </td>
                </tr>
              )}

              {!loading && movements.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                    No stock movements found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore && !loading && (
          <div style={{ padding: '1rem', textAlign: 'center', borderTop: '1px solid var(--line, rgba(148, 163, 184, 0.14))' }}>
            <button
              type="button"
              onClick={() => {
                const next = page + 1
                setPageNum(next)
                loadMovements(next, searchFilter, typeFilter)
              }}
              style={{
                padding: '0.6rem 1.5rem',
                borderRadius: 'var(--radius-sm, 8px)',
                border: '1px solid var(--line, rgba(148, 163, 184, 0.2))',
                background: 'var(--bg, #0b1220)',
                color: 'var(--text-strong, #f1f5f9)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Load More Movements
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export const page: Pick<PageDefinition, 'id' | 'label' | 'icon'> = {
  id: 'stock-movements',
  label: 'Movements',
  icon: 'Activity',
}
