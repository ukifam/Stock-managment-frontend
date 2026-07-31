import { useEffect, useMemo, useState } from 'react'
import { api, type CreditFilter, type ReportTransaction, type ReportsResponse } from '../api'
import { Topbar } from '../components/Topbar'
import { exportRows } from '../utils/export'
import type { ReportScope, ThemePageProps } from '../types'
import { jsPDF } from 'jspdf'

export const page = { id: 'reports' as const, label: 'Reports', icon: 'doc' }

type ReportsProps = ThemePageProps & {
  currency?: string
  reportScope?: ReportScope
  onReportScopeChange?: (scope: ReportScope) => void
}

type LedgerRow = {
  date: string
  type: string
  id: string
  description: string
  party: string
  payment: string
  amount: string
  paid: string
  outstanding: string
  rawAmount: number
  rawPaid: number
  rawOutstanding: number
}

const scopeLabels: Record<ReportScope, string> = {
  all: 'General Business Report',
  purchases: 'Purchases Report',
  sales: 'Sales Report',
  expenses: 'Expenses Report',
}

const scopeLedgerTitles: Record<ReportScope, string> = {
  all: 'Complete Transaction Ledger',
  purchases: 'Purchase Transactions',
  sales: 'Sales Transactions',
  expenses: 'Expense Transactions',
}

const cogsLabel = 'Purchase of Sold Items'

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseNumber(val: string | number | undefined) {
  if (val === undefined || val === null || val === '') return 0
  const num = Number(String(val).replace(/[^0-9.-]+/g, ''))
  return Number.isFinite(num) ? num : 0
}

function formatNumberNoCurrency(val: string | number | undefined, currency = 'RWF') {
  const numberValue = parseNumber(val)
  if (isNaN(numberValue)) return '-'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: currency === 'RWF' ? 0 : 2,
    minimumFractionDigits: currency === 'RWF' ? 0 : 2,
  }).format(numberValue)
}

function getProfitStatus(netProfit: string | number | undefined) {
  const amount = parseNumber(netProfit)
  if (amount > 0) {
    return {
      label: 'Profit',
      tone: 'profit',
      note: 'The business made money in this period.',
    }
  }
  if (amount < 0) {
    return {
      label: 'Loss',
      tone: 'loss',
      note: 'The business spent more than it earned in this period.',
    }
  }
  return {
    label: 'Break even',
    tone: 'even',
    note: 'Income and costs are equal in this period.',
  }
}

function formatSignedAmount(amount: number, currency = 'RWF') {
  return `${currency} ${formatNumberNoCurrency(amount, currency)}`
}

function toLedgerRow(row: ReportTransaction, currency: string): LedgerRow {
  const rawAmount = row.rawValue ?? parseNumber(row.value)
  const rawPaid = row.rawPaidAmount ?? parseNumber(row.paidAmount ?? row.value)
  const rawOutstanding = row.rawOutstanding ?? parseNumber(row.outstanding)

  return {
    date: row.date ?? '-',
    type: row.type,
    id: row.id ?? '-',
    description: row.item ?? row.description ?? '-',
    party: row.supplier ?? row.customer ?? '-',
    payment: row.payment ?? row.status ?? '-',
    // on-page display: no currency symbol, only formatted numbers
    amount: formatNumberNoCurrency(rawAmount, currency),
    paid: formatNumberNoCurrency(rawPaid, currency),
    outstanding: formatNumberNoCurrency(rawOutstanding, currency),
    rawAmount,
    rawPaid,
    rawOutstanding,
  }
}

function buildLedgerRows(reports: ReportsResponse, scope: ReportScope, currency = 'RWF'): LedgerRow[] {
  const purchases = (reports.detailPurchases ?? []).map((row) => toLedgerRow(row, currency))
  const sales = (reports.detailSales ?? []).map((row) => toLedgerRow(row, currency))
  const expenses = (reports.detailExpenses ?? []).map((row) => toLedgerRow(row, currency))

  const rows =
    scope === 'purchases' ? purchases : scope === 'sales' ? sales : scope === 'expenses' ? expenses : [...purchases, ...sales, ...expenses]

  return rows.sort((a, b) => new Date(`${b.date}T12:00:00`).getTime() - new Date(`${a.date}T12:00:00`).getTime())
}

function sortLedgerRows(rows: LedgerRow[]) {
  return [...rows].sort((a, b) => new Date(`${b.date}T12:00:00`).getTime() - new Date(`${a.date}T12:00:00`).getTime())
}

function sumLedger(rows: LedgerRow[]) {
  return rows.reduce(
    (totals, row) => ({
      amount: totals.amount + row.rawAmount,
      paid: totals.paid + row.rawPaid,
      outstanding: totals.outstanding + row.rawOutstanding,
    }),
    { amount: 0, paid: 0, outstanding: 0 },
  )
}

function getPaymentTone(payment: string) {
  const normalized = payment.toLowerCase()
  if (normalized.includes('credit') || normalized.includes('outstanding') || normalized.includes('unpaid')) return 'warning'
  if (normalized.includes('paid') || normalized.includes('cash') || normalized.includes('complete')) return 'success'
  return 'neutral'
}

function getTransactionTone(type: string) {
  const normalized = type.toLowerCase()
  if (normalized.includes('purchase')) return 'purchase'
  if (normalized.includes('sale')) return 'sale'
  if (normalized.includes('expense')) return 'expense'
  return 'neutral'
}

function MetricIcon({ kind }: { kind: string }) {
  const size = 20
  switch (kind) {
    case 'purchases':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 6h2l1 9a2 2 0 002 2h8a2 2 0 002-2l1-9h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'sales':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 13l4-4 4 4 6-6 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'gross':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 8v8M9 11h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'cogs':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7h16M4 12h10M4 17h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="19" cy="17" r="3" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'net':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 12h4l2 4 6-8 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'payments':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 10h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case 'credit':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'expenses':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M21 8v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 8V6a5 5 0 0110 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}

export function Reports({ theme, toggleTheme, currency = 'RWF', reportScope = 'all', onReportScopeChange }: ReportsProps) {
  const today = new Date()
  const [fromDate, setFromDate] = useState(formatDateInput(new Date(today.getTime() - 1000 * 60 * 60 * 24 * 30)))
  const [toDate, setToDate] = useState(formatDateInput(today))
  const [creditFilter, setCreditFilter] = useState<CreditFilter>('all')
  const [reports, setReports] = useState<ReportsResponse>({
    metrics: [],
    reportBars: [],
    recentTransactions: [],
  })
  const [error, setError] = useState('')
  const [viewScope, setViewScope] = useState<ReportScope>(reportScope)

  useEffect(() => {
    setViewScope(reportScope)
  }, [reportScope])

  const creditFilterLabel =
    creditFilter === 'all' ? 'All transactions' : creditFilter === 'salesCredit' ? 'Sales on Credit' : 'Purchases on Credit'

  const formatAmount = (val: string | number | undefined) => {
    const numberValue = parseNumber(val)
    if (isNaN(numberValue)) return '-'
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: currency === 'RWF' ? 0 : 2,
      minimumFractionDigits: currency === 'RWF' ? 0 : 2,
    }).format(numberValue)
  }

  const ledgerRows = useMemo(() => buildLedgerRows(reports, viewScope, currency), [reports, viewScope, currency])
  const purchaseRows = useMemo(() => sortLedgerRows((reports.detailPurchases ?? []).map((row) => toLedgerRow(row, currency))), [reports.detailPurchases, currency])
  const salesRows = useMemo(() => sortLedgerRows((reports.detailSales ?? []).map((row) => toLedgerRow(row, currency))), [reports.detailSales, currency])
  const expenseRows = useMemo(() => sortLedgerRows((reports.detailExpenses ?? []).map((row) => toLedgerRow(row, currency))), [reports.detailExpenses, currency])

  const changeScope = (scope: ReportScope) => {
    setViewScope(scope)
    onReportScopeChange?.(scope)
  }

  const soldGoodsStatus = getProfitStatus(reports.summary?.netProfit)
  const generalResult = parseNumber(reports.summary?.totalSales) - parseNumber(reports.summary?.totalPurchases)
  const generalStatus = getProfitStatus(generalResult)
  const generalResultText = formatSignedAmount(generalResult, currency)

  const transactionSummaryRows = [
    {
      category: 'Purchases',
      total: reports.summary?.totalPurchases,
      cash: reports.summary?.purchasesCash ?? '-',
      credit: reports.summary?.purchasesOnCredit ?? '-',
      outstanding: reports.summary?.purchasesOnCredit ?? '-',
    },
    {
      category: 'Sales',
      total: reports.summary?.totalSales,
      cash: reports.summary?.salesCash ?? '-',
      credit: reports.summary?.salesOnCredit ?? '-',
      outstanding: reports.summary?.salesOnCredit ?? '-',
    },
    { category: 'Monthly Profit', total: generalResultText, cash: generalStatus.label, credit: '-', outstanding: '-' },
    { category: cogsLabel, total: reports.summary?.costOfGoodsSold ?? '-', cash: '-', credit: '-', outstanding: '-' },
    { category: 'Gross Profit', total: reports.summary?.grossProfit ?? '-', cash: '-', credit: '-', outstanding: '-' },
    {
      category: 'Expenses',
      total: reports.summary?.totalExpenses ?? reports.summary?.taxes ?? '-',
      cash: '-',
      credit: '-',
      outstanding: '-',
    },
    { category: 'Net Profit', total: reports.summary?.netProfit ?? '-', cash: soldGoodsStatus.label, credit: '-', outstanding: '-' },
    {
      category: 'Payments (Made)',
      total: reports.summary?.totalPayments ?? '-',
      cash: reports.summary?.totalPayments ?? '-',
      credit: '-',
      outstanding: '-',
    },
  ]

  const visibleSummaryRows =
    viewScope === 'all'
      ? transactionSummaryRows
      : viewScope === 'purchases'
      ? [transactionSummaryRows[0]]
      : viewScope === 'sales'
      ? [transactionSummaryRows[1], transactionSummaryRows[2], transactionSummaryRows[3], transactionSummaryRows[4], transactionSummaryRows[6]]
      : [transactionSummaryRows[5], transactionSummaryRows[6]]
  const grossMargin =
    reports.summary?.grossProfit && reports.summary?.totalSales
      ? (
          (parseNumber(reports.summary.grossProfit) / Math.max(parseNumber(reports.summary.totalSales), 1)) *
          100
        ).toFixed(1)
      : null

  const reportHighlights = [
    { label: 'Period', value: `${fromDate} → ${toDate}` },
    { label: 'Filter', value: creditFilterLabel },
    { label: 'Monthly Profit', value: generalStatus.label },
    { label: 'Transactions', value: String(reports.summary?.totalTransactions ?? ledgerRows.length) },
    { label: 'Currency', value: currency },
  ]
  useEffect(() => {
    let isMounted = true

    const loadReports = () => {
      api
        .reports(fromDate, toDate, creditFilter)
        .then((response) => {
          if (!isMounted) return
          setReports(response)
          setError('')
        })
        .catch(() => {
          if (isMounted) setError('Could not refresh report data.')
        })
    }

    loadReports()
    const refreshId = window.setInterval(loadReports, 5000)
    window.addEventListener('focus', loadReports)

    return () => {
      isMounted = false
      window.clearInterval(refreshId)
      window.removeEventListener('focus', loadReports)
    }
  }, [fromDate, toDate, creditFilter])

  const exportReportCsv = () => {
    const scopeName = scopeLabels[viewScope]
    const metaRows = [
      { Section: 'Report Info', Field: 'Company', Value: 'TRI LTD' },
      { Section: 'Report Info', Field: 'Report Type', Value: scopeName },
      { Section: 'Report Info', Field: 'Period From', Value: fromDate },
      { Section: 'Report Info', Field: 'Period To', Value: toDate },
      { Section: 'Report Info', Field: 'Credit Filter', Value: creditFilterLabel },
      { Section: 'Report Info', Field: 'Generated On', Value: new Date().toLocaleString() },
    ]

    if (viewScope === 'all' && reports.summary) {
      metaRows.push(
        { Section: 'Summary', Field: 'Total Sales', Value: reports.summary.totalSales ?? '' },
        { Section: 'Summary', Field: 'Total Purchases', Value: reports.summary.totalPurchases ?? '' },
        { Section: 'Summary', Field: cogsLabel, Value: reports.summary.costOfGoodsSold ?? '' },
        { Section: 'Summary', Field: 'Monthly Profit', Value: generalResultText },
        { Section: 'Summary', Field: 'General Status', Value: generalStatus.label },
        { Section: 'Summary', Field: 'Gross Profit', Value: reports.summary.grossProfit ?? '' },
        { Section: 'Summary', Field: 'Total Expenses', Value: reports.summary.totalExpenses ?? reports.summary.taxes ?? '' },
        { Section: 'Summary', Field: 'Net Profit', Value: reports.summary.netProfit ?? '' },
        { Section: 'Summary', Field: 'Net Profit Status', Value: soldGoodsStatus.label },
      )
    }

    const ledgerExportRows = ledgerRows.map((row) => ({
      Section: 'Ledger',
      Date: row.date,
      Type: row.type,
      ID: row.id,
      Description: row.description,
      Party: row.party,
      Payment: row.payment,
      Amount: row.amount,
      Paid: row.paid,
      Outstanding: row.outstanding,
    }))

    exportRows(`TRI-LTD-${viewScope}-Report-${fromDate}-to-${toDate}.csv`, [...metaRows, ...ledgerExportRows] as Record<string, string>[])
  }

  const exportReportPdf = () => {
    const title = `TRI_LTD_${viewScope}_Report_${fromDate}_to_${toDate}`
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const margin = 40
    let y = 50

    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, 595, 86, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(scopeLabels[viewScope], margin, 28)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Monthly profit: ${generalStatus.label} (${generalResultText})`, margin, 62)
    doc.text(`Gross and net profit use sold items only`, margin, 76)
    doc.text(`TRI LTD • ${fromDate} to ${toDate} • ${creditFilterLabel}`, margin, 48)
    doc.setTextColor(17, 24, 39)
    y = 112

    // Prepare page metrics for header and tables
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const tableWidth = pageWidth - margin * 2
    const headerGap = 12
    const halfWidth = (pageWidth - margin * 2 - headerGap) / 2
    const rowSpacing = 14
    const cardHeight = 84

    // Income card (left)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(margin, y, halfWidth, cardHeight, 8, 8, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.6)
    doc.roundedRect(margin, y, halfWidth, cardHeight, 8, 8, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('INCOME', margin + 12, y + 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    const salesLabelX = margin + 12
    const salesAmountX = margin + halfWidth - 12
    doc.text('Sales', salesLabelX, y + 40)
    doc.setFont('helvetica', 'bold')
    doc.text(`${currency} ${formatNumberNoCurrency(reports.summary?.totalSales ?? '-')}`, salesAmountX, y + 40, { align: 'right' })

    // Expenses card (right)
    const rightX = margin + halfWidth + headerGap
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(rightX, y, halfWidth, cardHeight, 8, 8, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.6)
    doc.roundedRect(rightX, y, halfWidth, cardHeight, 8, 8, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('EXPENSES', rightX + 12, y + 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const expenses = [
      { label: 'Purchases', value: reports.summary?.totalPurchases },
      { label: cogsLabel, value: reports.summary?.costOfGoodsSold },
      { label: 'Expenses', value: reports.summary?.totalExpenses ?? reports.summary?.taxes },
    ]
    let expY = y + 36
    expenses.forEach((it, idx) => {
      doc.text(it.label, rightX + 12, expY)
      doc.text(`${currency} ${formatNumberNoCurrency(it.value ?? '-')}`, rightX + halfWidth - 12, expY, { align: 'right' })
      expY += 18
      if (idx < expenses.length - 1) {
        doc.setDrawColor(236, 238, 241)
        doc.setLineWidth(0.5)
        doc.line(rightX + 8, expY - 10, rightX + halfWidth - 8, expY - 10)
      }
    })

    y += cardHeight + 12

    // Bottom result cards
    const profitCardHeight = 110
    const resultGap = 10
    const resultWidth = (tableWidth - resultGap * 2) / 3
    const generalX = margin
    const grossX = margin + resultWidth + resultGap
    const netX = margin + (resultWidth + resultGap) * 2

    if (generalStatus.tone === 'loss') {
      doc.setFillColor(255, 241, 242)
    } else if (generalStatus.tone === 'even') {
      doc.setFillColor(248, 250, 252)
    } else {
      doc.setFillColor(240, 255, 245)
    }
    doc.roundedRect(generalX, y, resultWidth, profitCardHeight, 10, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`GENERAL - ${generalStatus.label.toUpperCase()}`, generalX + 12, y + 22)
    doc.setFontSize(15)
    doc.text(generalResultText, generalX + 12, y + 54)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Sales minus all purchases', generalX + 12, y + 78)

    doc.setFillColor(255, 250, 230)
    doc.roundedRect(grossX, y, resultWidth, profitCardHeight, 10, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('GROSS PROFIT', grossX + 12, y + 22)
    doc.setFontSize(15)
    doc.text(`${currency} ${formatNumberNoCurrency(reports.summary?.grossProfit ?? '-')}`, grossX + 12, y + 54)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(grossMargin ? `${grossMargin}% gross margin` : `Sales minus sold cost`, grossX + 12, y + 78)

    if (soldGoodsStatus.tone === 'loss') {
      doc.setFillColor(255, 241, 242)
    } else if (soldGoodsStatus.tone === 'even') {
      doc.setFillColor(248, 250, 252)
    } else {
      doc.setFillColor(240, 255, 245)
    }
    doc.roundedRect(netX, y, resultWidth, profitCardHeight, 10, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`NET PROFIT - ${soldGoodsStatus.label.toUpperCase()}`, netX + 12, y + 22)
    doc.setFontSize(15)
    doc.text(`${currency} ${formatNumberNoCurrency(reports.summary?.netProfit ?? '-')}`, netX + 12, y + 54)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Gross profit minus expenses', netX + 12, y + 78)

    y += profitCardHeight + 16
    const columnWidths = [44, 78, 112, 48, 42, 41, 41, 41]
    const columnPositions = columnWidths.reduce<number[]>((acc, _, index) => {
      if (index === 0) return [0]
      return [...acc, acc[index - 1] + columnWidths[index - 1] + 6]
    }, [])
    const maxY = pageHeight - margin

    const renderTableHeader = (x: number, y: number) => {
      const headers = [
        'Date',
        'Ref',
        'Description',
        'Party',
        'Payment',
        'Amount',
        'Paid',
        'Due',
      ]
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(255, 255, 255)
      doc.setFillColor(17, 24, 39)
      doc.rect(x - 2, y - 10, tableWidth + 4, 18, 'F')
      headers.forEach((header, index) => {
        const isMoneyColumn = index >= 5
        doc.text(header, x + columnPositions[index] + (isMoneyColumn ? columnWidths[index] : 0), y, {
          align: isMoneyColumn ? 'right' : 'left',
        })
      })
      doc.setTextColor(17, 24, 39)
      return y + rowSpacing + 6
    }

    const measureRowHeight = (row: LedgerRow) => {
      const values = [row.date, row.id, row.description, row.party, row.payment, row.amount, row.paid, row.outstanding]
      return Math.max(
        ...values.map((value, index) => {
          const lines = doc.splitTextToSize(String(value ?? '-'), columnWidths[index])
          return lines.length * rowSpacing
        }),
      )
    }

    const renderTableRow = (row: LedgerRow, x: number, y: number) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const values = [row.date, row.id, row.description, row.party, row.payment, row.amount, row.paid, row.outstanding]
      let rowHeight = 0

      values.forEach((value, index) => {
        const lines = doc.splitTextToSize(String(value ?? '-'), columnWidths[index])
        const isMoneyColumn = index >= 5
        doc.text(lines, x + columnPositions[index] + (isMoneyColumn ? columnWidths[index] : 0), y, {
          align: isMoneyColumn ? 'right' : 'left',
        })
        rowHeight = Math.max(rowHeight, lines.length * rowSpacing)
      })

      const borderY = y + rowHeight - (rowSpacing - 4)
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.3)
      doc.line(x - 2, borderY, x + tableWidth + 2, borderY)
      return y + rowHeight
    }

    const groups =
      viewScope === 'all'
        ? [
            { key: 'purchases', title: 'Purchases', rows: purchaseRows },
            { key: 'sales', title: 'Sales', rows: salesRows },
            { key: 'expenses', title: 'Expenses', rows: expenseRows },
          ]
        : [
            {
              key: viewScope,
              title: viewScope === 'purchases' ? 'Purchases' : viewScope === 'sales' ? 'Sales' : 'Expenses',
              rows: viewScope === 'purchases' ? purchaseRows : viewScope === 'sales' ? salesRows : expenseRows,
            },
          ]

    for (const group of groups) {
      if (y > maxY - 60) {
        doc.addPage()
        y = margin
      }

      // group heading
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(`${group.title} — ${group.rows.length} entries • Amounts in ${currency}`, margin, y)
      y += 14

      y = renderTableHeader(margin, y)

      if (group.rows.length === 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text('No entries for this period.', margin, y)
        y += 18
        continue
      }

      for (const row of group.rows) {
        const rowHeight = measureRowHeight(row)
        if (y + rowHeight > maxY) {
          doc.addPage()
          y = margin
          y = renderTableHeader(margin, y)
        }
        y = renderTableRow(row, margin, y)
        y += 8
      }

      // subtotal for the group
      const totals = sumLedger(group.rows)
      const subtotalY = y + 6
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.5)
      doc.line(margin - 2, subtotalY, margin + tableWidth + 2, subtotalY)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`${group.title} Total`, margin + columnPositions[0], subtotalY + 12)
      doc.text(formatNumberNoCurrency(totals.amount, currency), margin + columnPositions[5] + columnWidths[5], subtotalY + 12, { align: 'right' })
      doc.text(formatNumberNoCurrency(totals.paid, currency), margin + columnPositions[6] + columnWidths[6], subtotalY + 12, { align: 'right' })
      doc.text(formatNumberNoCurrency(totals.outstanding, currency), margin + columnPositions[7] + columnWidths[7], subtotalY + 12, { align: 'right' })
      y = subtotalY + 22
    }

    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = `${title}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(pdfUrl)
  }

  const exportReportPrintable = () => {
    exportReportPdf()
  }

  const renderLedgerTable = () => {
    const groups =
      viewScope === 'all'
        ? [
            { key: 'purchases', title: 'Purchases', rows: purchaseRows, empty: 'No purchases recorded for this period.' },
            { key: 'sales', title: 'Sales', rows: salesRows, empty: 'No sales recorded for this period.' },
            { key: 'expenses', title: 'Expenses', rows: expenseRows, empty: 'No expenses recorded for this period.' },
          ]
        : [
            {
              key: viewScope,
              title: viewScope === 'purchases' ? 'Purchases' : viewScope === 'sales' ? 'Sales' : 'Expenses',
              rows: viewScope === 'purchases' ? purchaseRows : viewScope === 'sales' ? salesRows : expenseRows,
              empty: `No ${viewScope} recorded for this period.`,
            },
          ]

    return (
      <section className="report-ledger">
        <div className="ledger-heading">
          <h2>{scopeLedgerTitles[viewScope]}</h2>
          <p>
            {viewScope === 'all'
              ? 'Transactions are grouped into separate tables for easier review.'
              : `All ${viewScope} for the selected period.`}
          </p>
        </div>

        {groups.map((group) => {
          const totals = sumLedger(group.rows)
          return (
            <div key={group.key} className="ledger-group">
              <div className="ledger-heading subsection-heading">
                <h3>{group.title}</h3>
                <p>{group.rows.length} entries • Amounts in {currency} • {formatAmount(totals.amount)}</p>
              </div>
              <div className="table-shell ledger-shell">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref / ID</th>
                      <th>Description</th>
                      <th>Party</th>
                      <th>Payment</th>
                      <th>Amount</th>
                      <th>Paid</th>
                      <th>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-row">
                          {group.empty}
                        </td>
                      </tr>
                    ) : (
                      group.rows.map((row, index) => (
                        <tr key={`${group.key}-${row.id}-${index}`} className={`ledger-row ledger-row-${getTransactionTone(row.type)}`}>
                          <td>{row.date}</td>
                          <td>
                            <span className={`type-badge type-${getTransactionTone(row.type)}`}>{row.type}</span>
                            <strong className="ledger-ref">{row.id}</strong>
                          </td>
                          <td className="ledger-description">{row.description}</td>
                          <td>{row.party}</td>
                          <td>
                            <span className={`payment-badge payment-${getPaymentTone(row.payment)}`}>{row.payment}</span>
                          </td>
                          <td className="money-cell">{row.amount}</td>
                          <td className="money-cell">{row.paid}</td>
                          <td className={`money-cell ${row.rawOutstanding > 0 ? 'outstanding-cell' : ''}`}>{row.outstanding}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {group.rows.length > 0 && (
                    <tfoot>
                      <tr className="ledger-total">
                        <td colSpan={5}>
                          <strong>{group.title} Total</strong>
                        </td>
                        <td className="money-cell">
                          <strong>{formatAmount(totals.amount)}</strong>
                        </td>
                        <td className="money-cell">
                          <strong>{formatAmount(totals.paid)}</strong>
                        </td>
                        <td className="money-cell">
                          <strong>{formatAmount(totals.outstanding)}</strong>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )
        })}
      </section>
    )
  }

  return (
    <>
      <Topbar title="Reports" placeholder="Search reports..." theme={theme} toggleTheme={toggleTheme} minimal />
      <div className="reports-page page-pad">
        <section className="report-toolbar no-print">
          <div className="report-toolbar-copy">
            <h1>{scopeLabels[viewScope]}</h1>
            <p>Professional ledger with summary totals. Choose a report type or open from Sales, Purchases, or Expenses.</p>
          </div>
          <div className="report-toolbar-actions">
            <button type="button" className="ghost-export" onClick={exportReportPrintable}>
              Download PDF
            </button>
            <button className="primary-action" type="button" onClick={exportReportCsv}>
              Export CSV
            </button>
          </div>
        </section>

        <section className="report-filters-panel no-print">
          <div className="report-scope-tabs">
            {(['all', 'sales', 'purchases', 'expenses'] as ReportScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                className={`scope-tab ${viewScope === scope ? 'active' : ''}`}
                onClick={() => changeScope(scope)}
              >
                {scope === 'all' ? 'General' : scope.charAt(0).toUpperCase() + scope.slice(1)}
              </button>
            ))}
          </div>
          <div className="report-filters-row">
            <div className="filter-group">
              <label>
                From
                <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </label>
              <label>
                To
                <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </label>
            </div>
            <div className="credit-filter">
              <button type="button" className={`filter-button filter-all ${creditFilter === 'all' ? 'selected' : ''}`} onClick={() => setCreditFilter('all')}>
                All
              </button>
              <button type="button" className={`filter-button filter-sales ${creditFilter === 'salesCredit' ? 'selected' : ''}`} onClick={() => setCreditFilter('salesCredit')}>
                Sales Credit
              </button>
              <button type="button" className={`filter-button filter-purchase ${creditFilter === 'purchasesCredit' ? 'selected' : ''}`} onClick={() => setCreditFilter('purchasesCredit')}>
                Purchase Credit
              </button>
            </div>
          </div>
        </section>

        {error && <div className="report-error no-print">{error}</div>}

        <article className="report-document" data-scope={viewScope}>
          <div className="report-front-matter">
          <header className="report-letterhead print-only">
            <div className="report-brand">
              <div className="brand-logo">
                <span>T</span>
              </div>
              <div className="brand-info">
                <p className="brand-eyebrow">{scopeLabels[viewScope]}</p>
                <h1>TRI LTD</h1>
                <p className="brand-sub">Business transaction report</p>
              </div>
            </div>
            <div className="report-meta">
              <div className="meta-card">
                <span>Report Period</span>
                <strong>
                  {fromDate} — {toDate}
                </strong>
              </div>
              <div className="meta-card">
                <span>Generated On</span>
                <strong>{new Date().toLocaleString()}</strong>
              </div>
              <div className="meta-card">
                <span>Report Type</span>
                <strong>{scopeLabels[viewScope]}</strong>
              </div>
              <div className="meta-card">
                <span>Filter</span>
                <strong>{creditFilterLabel}</strong>
              </div>
            </div>
          </header>

          <section className="report-hero" aria-label="Report overview">
            <div className="report-hero-copy">
              <span className="report-eyebrow">Business snapshot</span>
              <h2>Clear view of performance for the selected period</h2>
              <p>Track sales, spending, and profitability with a professional ledger summary built for faster decisions.</p>
            </div>
            <div className="report-hero-metrics">
              {reportHighlights.map((item) => (
                <div key={item.label} className="report-hero-chip">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          {reports.summary && (
            <section className="report-summary-block">
              <div className="report-summary-groups">
                <div className="summary-group-card income-group">
                  <h3>Income</h3>
                  <div className="summary-group-row">
                    <span>Sales</span>
                    <strong>{reports.summary.totalSales ?? '-'}</strong>
                  </div>
                </div>
                <div className="summary-group-card expenses-group">
                  <h3>Expenses</h3>
                  <div className="summary-group-row">
                    <span>Purchases</span>
                    <strong>{reports.summary.totalPurchases ?? '-'}</strong>
                  </div>
                  <div className="summary-group-row">
                    <span>{cogsLabel}</span>
                    <strong>{reports.summary.costOfGoodsSold ?? '-'}</strong>
                  </div>
                  <div className="summary-group-row">
                    <span>Expenses</span>
                    <strong>{reports.summary.totalExpenses ?? reports.summary.taxes ?? '-'}</strong>
                  </div>
                </div>
              </div>
              <div className="report-profit-summary">
                <article className={`summary-card result ${generalStatus.tone}`}>
                  <span className="result-label">Monthly Profit</span>
                  <strong>{generalResultText}</strong>
                  <small>{generalStatus.label}: sales minus all purchases.</small>
                </article>
                <article className="summary-card gross">
                  <span className="card-icon">
                    <MetricIcon kind="gross" />
                  </span>
                  <h3>Gross Profit</h3>
                  <strong>{reports.summary.grossProfit ?? '-'}</strong>
                  <small>{grossMargin ? `${grossMargin}% gross margin` : `Sales minus ${cogsLabel.toLowerCase()}`}</small>
                </article>
                <article className={`summary-card net ${soldGoodsStatus.tone}`}>
                  <span className="card-icon">
                    <MetricIcon kind="net" />
                  </span>
                  <h3>Net Profit</h3>
                  <strong>{reports.summary.netProfit ?? '-'}</strong>
                  <small>Gross profit minus expenses.</small>
                </article>
              </div>
            </section>
          )}
          </div>

          <div className="report-tables-section">
          <section className="transaction-summary">
            <div className="section-title">
              <h2>Financial Summary</h2>
              <p>Gross profit = total sales − purchase of sold items. Net profit = gross profit − all expenses for the selected period.</p>
            </div>
            <div className="table-shell">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total ({currency})</th>
                    <th>Cash ({currency})</th>
                    <th>Credit ({currency})</th>
                    <th>Outstanding ({currency})</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSummaryRows.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td>{row.total ?? '-'}</td>
                      <td>{row.cash ?? '-'}</td>
                      <td>{row.credit ?? '-'}</td>
                      <td>{row.outstanding ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {renderLedgerTable()}
          </div>

          <footer className="report-footer">
            <div className="report-note">
              <strong>Note:</strong> This report is computer generated and does not require a signature.
            </div>
            <div className="report-footer-meta">
              <span>TRI LTD Business Suite — {scopeLabels[viewScope]}</span>
              <span>
                {fromDate} to {toDate}
              </span>
            </div>
          </footer>
        </article>
      </div>
    </>
  )
}




