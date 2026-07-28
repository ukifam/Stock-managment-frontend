import { useEffect, useState } from 'react'
import type React from 'react'
import { Topbar } from '../components/Topbar'
import { api, type CreateExpensePayload, type ExpenseRow, type ExpenseUpdatePayload } from '../api'
import type { ThemePageProps } from '../types'

export const page = { id: 'expenses' as const, label: 'Expenses', icon: 'receipt' }

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

export function Expenses({ theme, toggleTheme, onOpenReport }: ThemePageProps & { onOpenReport?: () => void }) {
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [limit] = useState(50)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseUpdatePayload>({ date: new Date().toISOString().slice(0, 10), amount: 0, category: 'General' })

  const resetForm = () => setForm({ date: new Date().toISOString().slice(0, 10), amount: 0, category: 'General' })

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
      <div className="page-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div>
            <h1>Expenses</h1>
            <p>Record and review shop expenses.</p>
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
                    <td>{typeof row.amount === 'number' ? row.amount.toFixed(2) : row.amount}</td>
                    <td>{row.category}</td>
                    <td>{row.vendor}</td>
                    <td>{row.reference}</td>
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
    </>
  )
}
