import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { Topbar } from '../components/Topbar'
import { api, type CreateExpensePayload, type ExpenseRow, type ExpenseUpdatePayload } from '../api'
import { Reports } from './Reports'
import { exportRows } from '../utils/export'
import { formatMoney } from '../utils/money'
import type { Page, ThemePageProps } from '../types'

export const page = { id: 'expenses' as const, label: 'Expenses', icon: 'receipt' }

type ExpensesProps = ThemePageProps & {
  page?: Page
  subTab?: 'all' | 'items' | 'report'
  setPage?: (page: Page) => void
  currency?: string
  onOpenReport?: () => void
}

function ExpenseModal({
  open,
  form,
  setForm,
  onClose,
  onSubmit,
  loading,
  isEditing,
}: {
  open: boolean
  form: ExpenseUpdatePayload
  setForm: React.Dispatch<React.SetStateAction<ExpenseUpdatePayload>>
  onClose: () => void
  onSubmit: () => Promise<void>
  loading: boolean
  isEditing: boolean
}) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="entry-modal"
        onSubmit={async (event) => {
          event.preventDefault()
          await onSubmit()
        }}
      >
        <div className="detail-head">
          <div>
            <h2>{isEditing ? 'Edit Expense' : 'New Expense'}</h2>
            <p>{isEditing ? 'Update the expense details and save your changes.' : 'Enter the details for the new expense and save it to the ledger.'}</p>
          </div>
          <button type="button" aria-label="Close expense modal" onClick={onClose}>x</button>
        </div>

        <div className="field-grid" style={{ gap: '12px' }}>
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              required
            />
          </label>

          <label>
            Amount
            <input
              type="number"
              step="0.01"
              value={String(form.amount)}
              onChange={(event) => setForm((current) => ({ ...current, amount: Number(event.target.value) }))}
              required
            />
          </label>

          <label>
            Category
            <input
              value={form.category || ''}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            />
          </label>

          <label>
            Vendor
            <input
              value={form.vendor || ''}
              onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))}
            />
          </label>

          <label>
            Reference
            <input
              value={form.reference || ''}
              onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
            />
          </label>

          <label>
            Status
            <input
              value={form.status || ''}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            Description
            <textarea
              value={form.description || ''}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={4}
            />
          </label>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '18px' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary-action" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function Expenses({
  page,
  subTab,
  setPage,
  currency = 'RWF',
  theme,
  toggleTheme,
  onOpenReport,
}: ExpensesProps) {
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [limit] = useState(50)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseUpdatePayload>({ date: new Date().toISOString().slice(0, 10), amount: 0, category: 'General' })

  const resetForm = () => setForm({ date: new Date().toISOString().slice(0, 10), amount: 0, category: 'General' })

  const currentTab: 'all' | 'items' | 'report' =
    subTab || (page === 'expense-items' ? 'items' : page === 'expenses-report' ? 'report' : 'all')

  const handleTabSelect = (tab: 'all' | 'items' | 'report') => {
    if (tab === 'all') setPage?.('expenses')
    else if (tab === 'items') setPage?.('expense-items')
    else if (tab === 'report') setPage?.('expenses-report')
  }

  const load = async () => {
    setLoading(true)
    try {
      const response = await api.expenses(1, limit)
      setRows(response.rows)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreateOrUpdate = async () => {
    setSubmitting(true)
    try {
      if (editingExpenseId) {
        await api.updateExpense(editingExpenseId, form)
      } else {
        await api.createExpense(form as CreateExpensePayload)
      }
      resetForm()
      setModalOpen(false)
      setEditingExpenseId(null)
      load()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not save expense')
    } finally {
      setSubmitting(false)
    }
  }

  const openEditExpense = (expense: ExpenseRow) => {
    setEditingExpenseId(expense.id || expense._id?.toString() || null)
    setForm({
      date: expense.date,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      vendor: expense.vendor,
      reference: expense.reference,
      status: expense.status,
    })
    setModalOpen(true)
  }

  const openNewExpense = () => {
    setEditingExpenseId(null)
    resetForm()
    setModalOpen(true)
  }

  const flattenedExpenseItems = useMemo(() => {
    const list: FlattenedExpenseItem[] = []

    rows.forEach((exp) => {
      const expenseId = exp.id || exp._id?.toString() || exp.reference || 'EXP'
      if (exp.lineItems && exp.lineItems.length > 0) {
        exp.lineItems.forEach((it, idx) => {
          list.push({
            key: `${expenseId}-${idx}-${it.description || it.category}`,
            expenseId,
            date: exp.date,
            vendor: exp.vendor || 'Shop Expense',
            category: it.category || exp.category || 'General',
            description: it.description || exp.description || exp.category || 'Expense Item',
            amount: Number(it.amount || 0),
            reference: exp.reference || '-',
            payment: exp.payment || 'Cash',
            status: exp.status || 'Recorded',
          })
        })
      } else {
        const amt = Number(exp.rawAmount != null ? exp.rawAmount : exp.amount || 0)
        list.push({
          key: `${expenseId}-main`,
          expenseId,
          date: exp.date,
          vendor: exp.vendor || 'Shop Expense',
          category: exp.category || 'General',
          description: exp.description || exp.item || 'Shop Expense',
          amount: amt,
          reference: exp.reference || '-',
          payment: exp.payment || 'Cash',
          status: exp.status || 'Recorded',
        })
      }
    })

    return list
  }, [rows])

  return (
    <>
      <Topbar placeholder="Search Expenses..." theme={theme} toggleTheme={toggleTheme} />
      <ExpenseModal
        open={modalOpen}
        form={form}
        setForm={setForm}
        onClose={() => {
          setModalOpen(false)
          setEditingExpenseId(null)
        }}
        onSubmit={handleCreateOrUpdate}
        loading={submitting}
        isEditing={Boolean(editingExpenseId)}
      />

      <div style={{ padding: '1rem 1.5rem 0 1.5rem' }}>
        <div className="subtabs-bar">
          <button
            type="button"
            className={`subtab-btn ${currentTab === 'all' ? 'active' : ''}`}
            onClick={() => handleTabSelect('all')}
          >
            <span className="subtab-icon">🧾</span>
            <span className="subtab-label">All Expenses</span>
            <span className="subtab-badge">{rows.length}</span>
          </button>
          <button
            type="button"
            className={`subtab-btn ${currentTab === 'items' ? 'active' : ''}`}
            onClick={() => handleTabSelect('items')}
          >
            <span className="subtab-icon">📋</span>
            <span className="subtab-label">Expense Items</span>
            <span className="subtab-badge">{flattenedExpenseItems.length}</span>
          </button>
          <button
            type="button"
            className={`subtab-btn ${currentTab === 'report' ? 'active' : ''}`}
            onClick={() => handleTabSelect('report')}
          >
            <span className="subtab-icon">📊</span>
            <span className="subtab-label">Expenses Report</span>
          </button>
        </div>
      </div>

      {currentTab === 'report' ? (
        <Reports theme={theme} toggleTheme={toggleTheme} currency={currency} reportScope="expenses" />
      ) : currentTab === 'items' ? (
        <ExpenseItemsView items={flattenedExpenseItems} currency={currency} totalOrders={rows.length} />
      ) : (
        <div className="page-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
            <div>
              <h1>Expenses Ledger</h1>
              <p>Record, manage, and review shop expenditures.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {onOpenReport && (
                <button type="button" onClick={onOpenReport}>
                  Expense Report
                </button>
              )}
              <button className="primary-action" type="button" onClick={openNewExpense}>
                New Expense
              </button>
            </div>
          </div>

          <section className="panel">
            <div style={{ marginBottom: '8px' }}><strong>Recent Expenses</strong></div>
            {loading ? (
              <div>Loading…</div>
            ) : (
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Category</th>
                    <th>Vendor</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row._id ?? row.reference ?? `${row.date}-${row.amount}`}>
                      <td>{row.date}</td>
                      <td>{formatMoney(typeof row.amount === 'number' ? row.amount : Number(row.rawAmount || 0), currency)}</td>
                      <td><span className="pill">{row.category}</span></td>
                      <td>{row.vendor}</td>
                      <td><code>{row.reference || '-'}</code></td>
                      <td>{row.description}</td>
                      <td>
                        <button type="button" onClick={() => openEditExpense(row)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </>
  )
}

type FlattenedExpenseItem = {
  key: string
  expenseId: string
  date: string
  vendor: string
  category: string
  description: string
  amount: number
  reference: string
  payment: string
  status: string
}

function ExpenseItemsView({
  items,
  currency,
  totalOrders,
}: {
  items: FlattenedExpenseItem[]
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
        it.description.toLowerCase().includes(q) ||
        it.vendor.toLowerCase().includes(q) ||
        it.reference.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [items, categoryFilter, searchTerm])

  const totalSpent = filteredItems.reduce((sum, it) => sum + it.amount, 0)
  const distinctVendorsCount = new Set(filteredItems.map((it) => it.vendor)).size

  const handleExportItems = () => {
    exportRows(
      'expense_items.csv',
      filteredItems.map((it) => ({
        Date: it.date,
        Reference: it.reference,
        Vendor: it.vendor,
        Category: it.category,
        Description: it.description,
        Amount: it.amount,
        Payment: it.payment,
        Status: it.status,
      }))
    )
  }

  return (
    <div className="page-pad">
      <div className="inventory-title">
        <div>
          <h1>Expense Items Breakdown</h1>
          <p>Itemized record of all individual shop expenses and operational expenditures.</p>
        </div>
        <div className="toolbar">
          <button type="button" onClick={handleExportItems}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="items-kpi-grid">
        <div className="items-kpi-card">
          <span>Total Expense Items</span>
          <strong>{filteredItems.length} Entries</strong>
        </div>
        <div className="items-kpi-card">
          <span>Distinct Vendors</span>
          <strong>{distinctVendorsCount} Vendors</strong>
        </div>
        <div className="items-kpi-card">
          <span>Total Expenditure</span>
          <strong style={{ color: 'var(--amber, #f59e0b)' }}>{formatMoney(totalSpent, currency)}</strong>
        </div>
        <div className="items-kpi-card">
          <span>Total Ledgers</span>
          <strong>{totalOrders} Records</strong>
        </div>
      </div>

      <div className="items-search-bar">
        <input
          type="text"
          className="items-search-input"
          placeholder="Search expenses by description, vendor, or category..."
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
              <th>Reference</th>
              <th>Vendor</th>
              <th>Category</th>
              <th>Description / Item</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No expense items found matching your filters.
                </td>
              </tr>
            ) : (
              filteredItems.map((it) => (
                <tr key={it.key}>
                  <td>{it.date}</td>
                  <td><code>{it.reference}</code></td>
                  <td><strong>{it.vendor}</strong></td>
                  <td><span className="pill">{it.category}</span></td>
                  <td><strong>{it.description}</strong></td>
                  <td style={{ fontWeight: 700, color: 'var(--amber, #f59e0b)' }}>
                    {formatMoney(it.amount, currency)}
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
