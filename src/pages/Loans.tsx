import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { Topbar } from '../components/Topbar'
import {
  api,
  type CreateLoanPayload,
  type LoanMetrics,
  type LoanRepayment,
  type LoanRow,
  type LoanStatus,
  type LoanType,
  type RecordRepaymentPayload,
} from '../api'
import { exportRows } from '../utils/export'
import { formatMoney } from '../utils/money'
import type { Page, ThemePageProps } from '../types'

export const page = { id: 'loans' as const, label: 'Loans & Debt', icon: 'credit-card' }

type LoansProps = ThemePageProps & {
  page?: Page
  subTab?: 'given' | 'taken' | 'repayments'
  setPage?: (page: Page) => void
  currency?: string
}

export function Loans({
  page,
  subTab,
  setPage,
  currency = 'RWF',
  theme,
  toggleTheme,
}: LoansProps) {
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [metrics, setMetrics] = useState<LoanMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [partyTypeFilter, setPartyTypeFilter] = useState('ALL')

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalType, setCreateModalType] = useState<LoanType>('GIVEN')
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false)
  const [repayLoan, setRepayLoan] = useState<LoanRow | null>(null)

  const currentTab: 'given' | 'taken' | 'repayments' =
    subTab ||
    (page === 'loans-taken'
      ? 'taken'
      : page === 'loans-repayments'
      ? 'repayments'
      : 'given')

  const handleTabSelect = (tab: 'given' | 'taken' | 'repayments') => {
    if (tab === 'given') setPage?.('loans-given')
    else if (tab === 'taken') setPage?.('loans-taken')
    else if (tab === 'repayments') setPage?.('loans-repayments')
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [loansRes, metricsRes] = await Promise.all([
        api.loans(),
        api.loanMetrics().catch(() => null),
      ])
      setLoans(loansRes.rows)
      setMetrics(metricsRes)
      if (loansRes.rows.length > 0 && !selectedId) {
        setSelectedId(loansRes.rows[0].id)
      }
    } catch {
      setLoans([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedLoan = loans.find((l) => l.id === selectedId) ?? loans[0]

  // Filtered by current tab (Given vs Taken)
  const tabLoans = useMemo(() => {
    if (currentTab === 'given') {
      return loans.filter((l) => l.type === 'GIVEN')
    }
    if (currentTab === 'taken') {
      return loans.filter((l) => l.type === 'TAKEN')
    }
    return loans
  }, [loans, currentTab])

  // Search & Status filters
  const filteredLoans = useMemo(() => {
    return tabLoans.filter((l) => {
      const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter
      const matchesPartyType = partyTypeFilter === 'ALL' || l.partyType === partyTypeFilter
      const q = searchTerm.toLowerCase()
      const matchesSearch =
        !q ||
        l.partyName.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        (l.phone && l.phone.toLowerCase().includes(q)) ||
        (l.purpose && l.purpose.toLowerCase().includes(q))
      return matchesStatus && matchesPartyType && matchesSearch
    })
  }, [tabLoans, statusFilter, partyTypeFilter, searchTerm])

  // Flattened repayments list across all loans
  const allRepayments = useMemo(() => {
    const list: Array<LoanRepayment & { loanId: string; partyName: string; loanType: LoanType }> = []
    loans.forEach((l) => {
      if (l.repayments && l.repayments.length > 0) {
        l.repayments.forEach((r) => {
          list.push({
            ...r,
            loanId: l.id,
            partyName: l.partyName,
            loanType: l.type,
          })
        })
      }
    })
    return list.sort((a, b) => (b.date > a.date ? 1 : -1))
  }, [loans])

  const openCreateModal = (type: LoanType) => {
    setCreateModalType(type)
    setIsCreateModalOpen(true)
  }

  const openRepayModal = (loan: LoanRow) => {
    setRepayLoan(loan)
    setIsRepayModalOpen(true)
  }

  const handleExportLoans = () => {
    exportRows(
      `loans_${currentTab}_${new Date().toISOString().slice(0, 10)}.csv`,
      filteredLoans.map((l) => ({
        LoanID: l.id,
        Type: l.type,
        PartyName: l.partyName,
        PartyType: l.partyType,
        Phone: l.phone || '-',
        Principal: l.principalAmount,
        InterestRate: `${l.interestRate}%`,
        TotalAmount: l.totalAmount,
        TotalRepaid: l.totalRepaid,
        RemainingBalance: l.remainingBalance,
        StartDate: l.startDate,
        DueDate: l.dueDate,
        Status: l.status,
        Purpose: l.purpose || '-',
      }))
    )
  }

  const handleExportRepayments = () => {
    exportRows(
      `loan_repayments_${new Date().toISOString().slice(0, 10)}.csv`,
      allRepayments.map((r) => ({
        RepaymentID: r.repaymentId,
        Date: r.date,
        LoanID: r.loanId,
        PartyName: r.partyName,
        LoanType: r.loanType,
        Amount: r.amount,
        PaymentMethod: r.paymentMethod || 'Bank Transfer',
        Reference: r.reference || '-',
        RecordedBy: r.recordedBy || 'Admin',
      }))
    )
  }

  const givenCount = loans.filter((l) => l.type === 'GIVEN').length
  const takenCount = loans.filter((l) => l.type === 'TAKEN').length

  return (
    <>
      <Topbar placeholder="Search borrowers, lenders, loan IDs..." theme={theme} toggleTheme={toggleTheme} />

      {/* In-Page Sub-tabs Bar */}
      <div style={{ padding: '1rem 1.5rem 0 1.5rem' }}>
        <div className="subtabs-bar">
          <button
            type="button"
            className={`subtab-btn ${currentTab === 'given' ? 'active' : ''}`}
            onClick={() => handleTabSelect('given')}
          >
            <span className="subtab-icon">📤</span>
            <span className="subtab-label">Loans Given</span>
            <span className="subtab-badge">{givenCount}</span>
          </button>
          <button
            type="button"
            className={`subtab-btn ${currentTab === 'taken' ? 'active' : ''}`}
            onClick={() => handleTabSelect('taken')}
          >
            <span className="subtab-icon">📥</span>
            <span className="subtab-label">Loans Taken</span>
            <span className="subtab-badge">{takenCount}</span>
          </button>
          <button
            type="button"
            className={`subtab-btn ${currentTab === 'repayments' ? 'active' : ''}`}
            onClick={() => handleTabSelect('repayments')}
          >
            <span className="subtab-icon">💳</span>
            <span className="subtab-label">Repayments Ledger</span>
            <span className="subtab-badge">{allRepayments.length}</span>
          </button>
        </div>
      </div>

      {currentTab === 'repayments' ? (
        <RepaymentsLedgerView
          repayments={allRepayments}
          currency={currency}
          onExport={handleExportRepayments}
        />
      ) : (
        <div className="list-detail-layout">
          <section className="page-pad list-page">
            <div className="inventory-title">
              <div>
                <h1>{currentTab === 'given' ? 'Loans Given (Receivables)' : 'Loans Taken (Borrowings & Debt)'}</h1>
                <p>
                  {currentTab === 'given'
                    ? 'Money the company lent out to employees, customers, or business partners.'
                    : 'Money borrowed by the company from banks, microfinances, or investors.'}
                </p>
              </div>
              <div className="toolbar">
                <button type="button" onClick={handleExportLoans}>
                  Export CSV
                </button>
                {currentTab === 'given' ? (
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => openCreateModal('GIVEN')}
                  >
                    + Issue Loan
                  </button>
                ) : (
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => openCreateModal('TAKEN')}
                  >
                    + Record Borrowing
                  </button>
                )}
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="items-kpi-grid">
              {currentTab === 'given' ? (
                <>
                  <div className="items-kpi-card">
                    <span>Total Lent Out</span>
                    <strong style={{ color: 'var(--cyan, #38bdf8)' }}>
                      {formatMoney(metrics?.given.principal ?? 0, currency)}
                    </strong>
                  </div>
                  <div className="items-kpi-card">
                    <span>Total Repaid Received</span>
                    <strong style={{ color: 'var(--emerald, #10b981)' }}>
                      {formatMoney(metrics?.given.repaid ?? 0, currency)}
                    </strong>
                  </div>
                  <div className="items-kpi-card">
                    <span>Outstanding Receivable</span>
                    <strong style={{ color: 'var(--amber, #f59e0b)' }}>
                      {formatMoney(metrics?.given.outstanding ?? 0, currency)}
                    </strong>
                  </div>
                  <div className="items-kpi-card">
                    <span>Active Borrowers</span>
                    <strong>{metrics?.given.activeCount ?? 0} Active</strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="items-kpi-card">
                    <span>Total Principal Borrowed</span>
                    <strong style={{ color: 'var(--cyan, #38bdf8)' }}>
                      {formatMoney(metrics?.taken.principal ?? 0, currency)}
                    </strong>
                  </div>
                  <div className="items-kpi-card">
                    <span>Total Repaid by Company</span>
                    <strong style={{ color: 'var(--emerald, #10b981)' }}>
                      {formatMoney(metrics?.taken.repaid ?? 0, currency)}
                    </strong>
                  </div>
                  <div className="items-kpi-card">
                    <span>Outstanding Debt Payable</span>
                    <strong style={{ color: '#ef4444' }}>
                      {formatMoney(metrics?.taken.outstanding ?? 0, currency)}
                    </strong>
                  </div>
                  <div className="items-kpi-card">
                    <span>Active Creditors / Banks</span>
                    <strong>{metrics?.taken.activeCount ?? 0} Active</strong>
                  </div>
                </>
              )}
            </div>

            {/* Search & Filters */}
            <div className="items-search-bar">
              <input
                type="text"
                className="items-search-input"
                placeholder={
                  currentTab === 'given'
                    ? 'Search borrowers by name, phone, purpose, or Loan ID...'
                    : 'Search lenders, banks, purpose, or Loan ID...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
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
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PAID">Fully Paid</option>
                <option value="OVERDUE">Overdue</option>
                <option value="DEFAULTED">Defaulted</option>
              </select>
              <select
                value={partyTypeFilter}
                onChange={(e) => setPartyTypeFilter(e.target.value)}
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
                <option value="ALL">All Parties</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="EMPLOYEE">Employee / Staff</option>
                <option value="BANK">Bank / Institution</option>
                <option value="INVESTOR">Investor</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Loans Table */}
            <div className="table-frame">
              <table>
                <thead>
                  <tr>
                    <th>Loan ID</th>
                    <th>{currentTab === 'given' ? 'Borrower' : 'Lender / Bank'}</th>
                    <th>Type</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Total Repaid</th>
                    <th>Repayment Progress</th>
                    <th>Remaining Balance</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        {loading ? 'Loading loans…' : 'No loan records found matching your filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((l) => {
                      const pct = l.totalAmount > 0 ? Math.min(100, Math.round((l.totalRepaid / l.totalAmount) * 100)) : 0
                      const isSelected = l.id === selectedLoan?.id

                      return (
                        <tr
                          key={l.id}
                          className={isSelected ? 'selected-row clickable-row' : 'clickable-row'}
                          onClick={() => setSelectedId(l.id)}
                        >
                          <td>
                            <strong>{l.id}</strong>
                          </td>
                          <td>
                            <strong>{l.partyName}</strong>
                            {l.phone && <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>{l.phone}</span>}
                          </td>
                          <td>
                            <span className="pill">{l.partyType}</span>
                          </td>
                          <td>{formatMoney(l.principalAmount, currency)}</td>
                          <td>{l.interestRate > 0 ? `${l.interestRate}% (${formatMoney(l.interestAmount, currency)})` : '0%'}</td>
                          <td style={{ color: 'var(--emerald, #10b981)', fontWeight: 600 }}>
                            {formatMoney(l.totalRepaid, currency)}
                          </td>
                          <td style={{ minWidth: '120px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  flex: 1,
                                  height: '7px',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  borderRadius: '9999px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: pct >= 100 ? '#10b981' : '#3b82f6',
                                    borderRadius: '9999px',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 600 }}>{pct}%</span>
                            </div>
                          </td>
                          <td
                            style={{
                              fontWeight: 700,
                              color: l.remainingBalance > 0 ? '#f59e0b' : '#10b981',
                            }}
                          >
                            {formatMoney(l.remainingBalance, currency)}
                          </td>
                          <td>{l.dueDate}</td>
                          <td>
                            <span
                              className={`status ${
                                l.status === 'PAID'
                                  ? 'given'
                                  : l.status === 'OVERDUE'
                                  ? 'danger'
                                  : l.status === 'ACTIVE'
                                  ? 'received'
                                  : ''
                              }`}
                            >
                              {l.status}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {l.remainingBalance > 0 && (
                              <button
                                type="button"
                                onClick={() => openRepayModal(l)}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  color: '#60a5fa',
                                  cursor: 'pointer',
                                }}
                              >
                                Repay
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right-Side Detail Panel */}
          <LoanDetailPanel
            loan={selectedLoan}
            currency={currency}
            onRepayClick={() => selectedLoan && openRepayModal(selectedLoan)}
          />
        </div>
      )}

      {/* Create Loan Modal */}
      {isCreateModalOpen && (
        <CreateLoanModal
          type={createModalType}
          currency={currency}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false)
            loadData()
          }}
        />
      )}

      {/* Record Repayment Modal */}
      {isRepayModalOpen && repayLoan && (
        <RecordRepaymentModal
          loan={repayLoan}
          currency={currency}
          onClose={() => {
            setIsRepayModalOpen(false)
            setRepayLoan(null)
          }}
          onSuccess={() => {
            setIsRepayModalOpen(false)
            setRepayLoan(null)
            loadData()
          }}
        />
      )}
    </>
  )
}

function LoanDetailPanel({
  loan,
  currency,
  onRepayClick,
}: {
  loan?: LoanRow
  currency: string
  onRepayClick: () => void
}) {
  if (!loan) {
    return (
      <aside className="detail-panel">
        <div className="detail-head">
          <h2>Loan Details</h2>
        </div>
        <p style={{ color: 'var(--text-muted)' }}>Select a loan to view terms and repayments.</p>
      </aside>
    )
  }

  const pct = loan.totalAmount > 0 ? Math.min(100, Math.round((loan.totalRepaid / loan.totalAmount) * 100)) : 0

  return (
    <aside className="detail-panel">
      <div className="detail-head">
        <h2>{loan.id}</h2>
        <span className="pill">{loan.type === 'GIVEN' ? 'Loan Given' : 'Loan Taken'}</span>
      </div>

      <h2>{loan.partyName}</h2>
      <p>
        {loan.partyType} • {loan.phone || 'No phone'} • {loan.email || 'No email'}
      </p>

      {loan.remainingBalance > 0 && (
        <div className="detail-actions" style={{ marginBottom: '1rem' }}>
          <button className="primary" type="button" onClick={onRepayClick}>
            💳 Record Repayment
          </button>
        </div>
      )}

      <section>
        <h3>Repayment Progress ({pct}%)</h3>
        <div
          style={{
            height: '10px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '9999px',
            overflow: 'hidden',
            margin: '8px 0 12px 0',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: pct >= 100 ? '#10b981' : '#3b82f6',
              borderRadius: '9999px',
            }}
          />
        </div>
        <dl>
          <div>
            <dt>Principal</dt>
            <dd>{formatMoney(loan.principalAmount, currency)}</dd>
          </div>
          <div>
            <dt>Interest Rate</dt>
            <dd>{loan.interestRate}% ({formatMoney(loan.interestAmount, currency)})</dd>
          </div>
          <div>
            <dt>Total Amount</dt>
            <dd style={{ fontWeight: 700 }}>{formatMoney(loan.totalAmount, currency)}</dd>
          </div>
          <div>
            <dt>Total Repaid</dt>
            <dd style={{ color: 'var(--emerald, #10b981)', fontWeight: 600 }}>
              {formatMoney(loan.totalRepaid, currency)}
            </dd>
          </div>
          <div>
            <dt>Remaining Balance</dt>
            <dd style={{ color: loan.remainingBalance > 0 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>
              {formatMoney(loan.remainingBalance, currency)}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3>Terms & Dates</h3>
        <dl>
          <div>
            <dt>Start Date</dt>
            <dd>{loan.startDate}</dd>
          </div>
          <div>
            <dt>Due Date</dt>
            <dd>{loan.dueDate}</dd>
          </div>
          <div>
            <dt>Schedule</dt>
            <dd>{loan.installmentType}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{loan.status}</dd>
          </div>
          {loan.purpose && (
            <div>
              <dt>Purpose</dt>
              <dd>{loan.purpose}</dd>
            </div>
          )}
          {loan.collateral && (
            <div>
              <dt>Collateral</dt>
              <dd>{loan.collateral}</dd>
            </div>
          )}
        </dl>
      </section>

      <section>
        <h3>Repayment History ({loan.repayments?.length ?? 0})</h3>
        {!loan.repayments || loan.repayments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No repayments recorded yet.</p>
        ) : (
          <div className="line-items-list">
            {loan.repayments.map((r) => (
              <div className="line-item-row" key={r.repaymentId}>
                <div className="line-item-info">
                  <strong className="line-item-name">{formatMoney(r.amount, currency)}</strong>
                  <span className="line-item-meta">
                    {r.date} • {r.paymentMethod || 'Bank Transfer'}
                    {r.reference ? ` • Ref: ${r.reference}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  )
}

function RepaymentsLedgerView({
  repayments,
  currency,
  onExport,
}: {
  repayments: Array<LoanRepayment & { loanId: string; partyName: string; loanType: LoanType }>
  currency: string
  onExport: () => void
}) {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase()
    return repayments.filter((r) => {
      return (
        !q ||
        r.loanId.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q) ||
        (r.reference && r.reference.toLowerCase().includes(q)) ||
        (r.paymentMethod && r.paymentMethod.toLowerCase().includes(q))
      )
    })
  }, [repayments, searchTerm])

  const totalRepaidSum = filtered.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="page-pad">
      <div className="inventory-title">
        <div>
          <h1>Repayments Ledger</h1>
          <p>Chronological audit log of all installments repaid on loans given and taken.</p>
        </div>
        <div className="toolbar">
          <button type="button" onClick={onExport}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="items-kpi-grid">
        <div className="items-kpi-card">
          <span>Total Repayments Recorded</span>
          <strong>{filtered.length} Installments</strong>
        </div>
        <div className="items-kpi-card">
          <span>Total Capital Repaid</span>
          <strong style={{ color: 'var(--emerald, #10b981)' }}>
            {formatMoney(totalRepaidSum, currency)}
          </strong>
        </div>
      </div>

      <div className="items-search-bar">
        <input
          type="text"
          className="items-search-input"
          placeholder="Search repayments by Loan ID, borrower, lender, or reference..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="table-frame">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Repayment ID</th>
              <th>Loan ID</th>
              <th>Loan Type</th>
              <th>Party</th>
              <th>Amount Repaid</th>
              <th>Payment Method</th>
              <th>Reference</th>
              <th>Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No repayment transactions recorded yet.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.repaymentId}>
                  <td>{r.date}</td>
                  <td><code>{r.repaymentId}</code></td>
                  <td><strong>{r.loanId}</strong></td>
                  <td>
                    <span className="pill">
                      {r.loanType === 'GIVEN' ? '📤 Loan Given' : '📥 Loan Taken'}
                    </span>
                  </td>
                  <td><strong>{r.partyName}</strong></td>
                  <td style={{ fontWeight: 700, color: 'var(--emerald, #10b981)' }}>
                    {formatMoney(r.amount, currency)}
                  </td>
                  <td>{r.paymentMethod || 'Bank Transfer'}</td>
                  <td><code>{r.reference || '-'}</code></td>
                  <td>{r.recordedBy || 'Admin'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CreateLoanModal({
  type,
  currency,
  onClose,
  onSuccess,
}: {
  type: LoanType
  currency: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [partyName, setPartyName] = useState('')
  const [partyType, setPartyType] = useState('INDIVIDUAL')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [principal, setPrincipal] = useState('')
  const [interestRate, setInterestRate] = useState('0')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )
  const [installmentType, setInstallmentType] = useState('MONTHLY')
  const [purpose, setPurpose] = useState('')
  const [collateral, setCollateral] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const numPrincipal = Number(principal || 0)
  const numRate = Number(interestRate || 0)
  const computedInterest = (numPrincipal * numRate) / 100
  const computedTotal = numPrincipal + computedInterest

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!partyName.trim()) {
      setError('Name is required')
      return
    }
    if (numPrincipal <= 0) {
      setError('Principal amount must be greater than 0')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload: CreateLoanPayload = {
        type,
        partyName: partyName.trim(),
        partyType,
        phone,
        email,
        principalAmount: numPrincipal,
        interestRate: numRate,
        interestAmount: computedInterest,
        startDate,
        dueDate,
        installmentType,
        purpose,
        collateral,
      }

      await api.createLoan(payload)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create loan record')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="entry-modal" onSubmit={handleSubmit}>
        <div className="detail-head">
          <div>
            <h2>{type === 'GIVEN' ? 'Issue New Loan (Given)' : 'Record Borrowing (Taken)'}</h2>
            <p>
              {type === 'GIVEN'
                ? 'Lend company funds to an individual, employee, or partner.'
                : 'Record debt or borrowing from a bank, microfinance, or investor.'}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div className="field-grid" style={{ gap: '12px' }}>
          <label>
            {type === 'GIVEN' ? 'Borrower Name *' : 'Lender / Bank Name *'}
            <input
              type="text"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder={type === 'GIVEN' ? 'e.g. John Doe, Staff Member' : 'e.g. Bank of Kigali, Equity Bank'}
              required
            />
          </label>

          <label>
            Party Type
            <select value={partyType} onChange={(e) => setPartyType(e.target.value)}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="EMPLOYEE">Employee / Staff</option>
              <option value="BANK">Bank / Financial Institution</option>
              <option value="INVESTOR">Private Investor</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label>
            Phone Number
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+250 780 000 000"
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@email.com"
            />
          </label>

          <label>
            Principal Amount ({currency}) *
            <input
              type="number"
              min="1"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder="0"
              required
            />
          </label>

          <label>
            Interest Rate (%)
            <input
              type="number"
              step="0.1"
              min="0"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              placeholder="0"
            />
          </label>

          <label>
            Disbursement Date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>

          <label>
            Maturity / Due Date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </label>

          <label>
            Repayment Schedule
            <select value={installmentType} onChange={(e) => setInstallmentType(e.target.value)}>
              <option value="LUMP_SUM">Bullet / Lump Sum at Maturity</option>
              <option value="MONTHLY">Monthly Installments</option>
              <option value="WEEKLY">Weekly Installments</option>
              <option value="CUSTOM">Custom Schedule</option>
            </select>
          </label>

          <label>
            Collateral / Guarantor
            <input
              type="text"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              placeholder="e.g. Land title, Car logbook, Personal guarantee"
            />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            Purpose / Notes
            <textarea
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Working capital expansion, equipment purchase, emergency staff advance"
            />
          </label>
        </div>

        {/* Calculated summary */}
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Interest Charge:</span>
            <strong style={{ display: 'block' }}>{formatMoney(computedInterest, currency)}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Repayable:</span>
            <strong style={{ display: 'block', color: 'var(--cyan, #38bdf8)', fontSize: '16px' }}>
              {formatMoney(computedTotal, currency)}
            </strong>
          </div>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '18px' }}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-action" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : type === 'GIVEN' ? 'Issue Loan' : 'Record Borrowing'}
          </button>
        </div>
      </form>
    </div>
  )
}

function RecordRepaymentModal({
  loan,
  currency,
  onClose,
  onSuccess,
}: {
  loan: LoanRow
  currency: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState(String(loan.remainingBalance))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = Number(amount || 0)
    if (numAmount <= 0) {
      setError('Repayment amount must be greater than 0')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload: RecordRepaymentPayload = {
        amount: numAmount,
        date,
        paymentMethod,
        reference,
        notes,
      }

      await api.recordLoanRepayment(loan.id, payload)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record repayment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="entry-modal" onSubmit={handleSubmit}>
        <div className="detail-head">
          <div>
            <h2>Record Repayment</h2>
            <p>
              {loan.id} • {loan.partyName} ({loan.type === 'GIVEN' ? 'Borrower' : 'Lender'})
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(59, 130, 246, 0.12)',
            borderRadius: '8px',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Remaining Balance:</span>
          <strong style={{ color: '#f59e0b' }}>{formatMoney(loan.remainingBalance, currency)}</strong>
        </div>

        <div className="field-grid" style={{ gap: '12px' }}>
          <label>
            Repayment Amount ({currency}) *
            <input
              type="number"
              step="0.01"
              min="1"
              max={loan.remainingBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>

          <label>
            Payment Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>

          <label>
            Payment Method
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="MTN MoMo">MTN Mobile Money</option>
              <option value="Airtel Money">Airtel Money</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
            </select>
          </label>

          <label>
            Transaction Ref / Check #
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TXN-8921829"
            />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            Notes / Receipt info
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </label>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '18px' }}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-action" type="submit" disabled={submitting}>
            {submitting ? 'Processing…' : 'Record Repayment'}
          </button>
        </div>
      </form>
    </div>
  )
}
