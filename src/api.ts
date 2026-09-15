import type { FilterPeriod } from './types'

export type CreditFilter = 'all' | 'salesCredit' | 'purchasesCredit'

const DEFAULT_API_URL = 'http://localhost:5000/api'
const TOKEN_STORAGE_KEY = 'tri_ltd_auth_token'
const API_URL = (() => {
  const configured = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).trim()
  if (!configured) return DEFAULT_API_URL

  const normalized = configured.replace(/\/+$/, '')
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`
})()

export type Metric = {
  label: string
  value: string
  delta?: string
  note?: string
}

export type LineItem = {
  sku?: string
  item: string
  category?: string
  quantity: number
  unitPrice: number
  total: number
  formattedUnitPrice?: string
  formattedTotal?: string
}

export type ExpenseLineItem = {
  description: string
  category?: string
  amount: number
  formattedAmount?: string
}

export type LowStockAlert = {
  name: string
  sku: string
  status: string
  action: string
}

export type CatalogItem = {
  sku: string
  name: string
  type: string
  price: string
  visual: string
}

export type InventoryRow = {
  date: string
  item: string
  meta: string
  sku: string
  category: string
  rawStock: number
  rawCapacity: number
  rawPrice: number
  stock: string
  price: string
  status: string
  serial?: string
  supplier?: string
  extractedText?: string
  shelfLocation?: string
  leadTime?: string
  warranty?: string
}

export type PurchaseRow = {
  date: string
  id: string
  supplier: string
  phone: string
  item: string
  sku?: string
  category?: string
  extractedText?: string
  rawQuantity?: number
  rawUnitPrice?: number
  rawInventoryPrice?: number
  rawValue?: number
  rawPaidAmount?: number
  rawOutstanding?: number
  quantity: string
  unitPrice?: string
  subtotal?: string
  discount?: string
  tax?: string
  value: string
  payment?: string
  paidAmount?: string
  outstanding?: string
  status: string
  lineItems?: LineItem[]
  itemSummary?: string
  items?: string
}

export type SaleRow = {
  date: string
  id: string
  customer: string
  phone: string
  item: string
  sku?: string
  category?: string
  extractedText?: string
  rawQuantity?: number
  rawValue?: number
  rawPaidAmount?: number
  rawOutstanding?: number
  items: string
  subtotal?: string
  discount?: string
  tax?: string
  value: string
  payment: string
  paidAmount?: string
  outstanding?: string
  status: string
  lineItems?: LineItem[]
  itemSummary?: string
}

export type DashboardResponse = {
  metrics: Metric[]
  salesBars: number[]
  lowStock: LowStockAlert[]
  catalog: CatalogItem[]
}

export type StockMovementRow = {
  id?: string
  _id?: string
  date: string
  sku: string
  item?: string
  type: string
  quantity: number
  previousStock: number
  newStock: number
  reason?: string
  reference?: string
  user?: string
}

export type StockDiscrepancyRow = StockMovementRow & {
  estimatedLoss?: string
}

export type InventoryValuation = {
  totalUnits: number
  totalValuation: string
  rawValuation?: number
  lowStockCount: number
  outOfStockCount: number
}

export type StockAdjustmentPayload = {
  date?: string
  sku: string
  type: string
  quantity: number | string
  reason: string
  reference?: string
  user?: string
}

export type ListResponse<T> = {
  rows: T[]
  count: number
}

export type ReportTransaction = {
  id?: string
  type: string
  date?: string
  item?: string
  category?: string
  description?: string
  status?: string
  items?: string
  quantity?: string
  value: string
  rawValue?: number
  supplier?: string
  customer?: string
  payment?: string
  paidAmount?: string
  outstanding?: string
  rawPaidAmount?: number
  rawOutstanding?: number
  purchasePrice?: string
  rawPurchasePrice?: number
  unitPrice?: string
  rawUnitPrice?: number
}

export type ReportsResponse = {
  metrics: Metric[]
  reportBars: number[]
  paymentMethods?: Array<{ method: string; amount: string; count: number }>
  recentTransactions: ReportTransaction[]
  detailPurchases?: ReportTransaction[]
  detailSales?: ReportTransaction[]
  detailExpenses?: ReportTransaction[]
  topProducts?: Array<{
    item: string
    quantity: number
    revenue: number
    value: string
  }>
  topExpenses?: Array<{
    category: string
    amount: string
    amountRaw?: number
  }>
  summary?: {
    salesCount: number
    purchasesCount: number
    expensesCount: number
    totalTransactions: number
    totalSales: string
    totalPurchases: string
    costOfGoodsSold?: string
    totalExpenses?: string
    taxes: string
    grossProfit: string
    netProfit: string
    netCashFlow: string
    purchasesCash?: string
    purchasesOnCredit?: string
    salesCash?: string
    salesOnCredit?: string
    totalPayments?: string
    totalStockUnits?: number
    totalInventoryValuation?: string
    totalLossUnits?: number
    totalLossValue?: string
    lowStockCount?: number
    outOfStockCount?: number
  }
  inventoryValuation?: InventoryValuation
  stockDiscrepancies?: StockDiscrepancyRow[]
}

export type SettingsResponse = {
  profile: { displayName: string; email: string }
  system: { darkMode: boolean; biometricLogin: boolean; telemetryReports: boolean; quantumSync: boolean }
  inventory: { lowStockThreshold: number; autoBackupFrequency: string; externalDatabase: string }
  financial: { currency: string }
  hardware: { name: string; status: string }[]
}

export type ManualEntryPayload = {
  item: string
  contactName: string
  phone: string
  reference: string
  category: string
  quantity: string
  unitPrice: string
  inventoryPrice?: string
  total: string
  sku: string
  extractedText?: string
  payment?: string
  paidAmount?: string
}

export type PurchaseUpdatePayload = {
  date?: string
  id?: string
  item: string
  supplier?: string
  phone?: string
  sku?: string
  category?: string
  quantity: string
  unitPrice: string
  inventoryPrice?: string
  payment?: string
  paidAmount?: string
  status?: string
  extractedText?: string
}

export type SaleUpdatePayload = {
  date?: string
  id?: string
  customer: string
  phone?: string
  item: string
  sku?: string
  category?: string
  quantity: string
  value?: string
  payment?: string
  paidAmount?: string
  status?: string
  extractedText?: string
}

export type InventoryUpdatePayload = {
  date?: string
  item?: string
  meta?: string
  sku?: string
  category?: string
  stock?: string
  capacity?: string
  price?: string
  status?: string
  serial?: string
  supplier?: string
  shelfLocation?: string
  leadTime?: string
  warranty?: string
}

export type ExpenseUpdatePayload = {
  date?: string
  amount?: number | string
  category?: string
  description?: string
  vendor?: string
  reference?: string
  status?: string
}

export type AvailableItem = {
  sku: string
  item: string
  category: string
  stock: number
  price: number
}

export type AvailableItemsResponse = {
  items: AvailableItem[]
}

export type VenueRow = {
  _id?: string
  name: string
  code: string
  type: string
  location: string
  address: string
  capacity: number
  currentItems: number
  manager: string
  contact: string
  status: string
  notes: string
}

export type EntryStatus = 'Received' | 'Returned' | 'Given'

export type ExpenseRow = {
  _id?: string
  id?: string
  date: string
  amount: number
  category: string
  description?: string
  vendor?: string
  reference?: string
  payment?: string
  status?: string
  lineItems?: ExpenseLineItem[]
  itemSummary?: string
  item?: string
  rawAmount?: number
  value?: string
}

export type LoanType = 'GIVEN' | 'TAKEN'
export type LoanStatus = 'ACTIVE' | 'PAID' | 'OVERDUE' | 'DEFAULTED'

export type LoanRepayment = {
  repaymentId: string
  date: string
  amount: number
  paymentMethod?: string
  reference?: string
  notes?: string
  recordedBy?: string
  createdAt?: string
}

export type LoanRow = {
  _id?: string
  id: string
  type: LoanType
  partyName: string
  partyType: string
  phone?: string
  email?: string
  idNumber?: string
  principalAmount: number
  interestRate: number
  interestAmount: number
  totalAmount: number
  totalRepaid: number
  remainingBalance: number
  startDate: string
  dueDate: string
  paymentMethod?: string
  installmentType?: string
  status: LoanStatus
  purpose?: string
  collateral?: string
  notes?: string
  repayments: LoanRepayment[]
  createdAt?: string
  updatedAt?: string
}

export type LoanMetrics = {
  given: {
    principal: number
    outstanding: number
    repaid: number
    activeCount: number
  }
  taken: {
    principal: number
    outstanding: number
    repaid: number
    activeCount: number
  }
  netPosition: number
  overdueCount: number
  totalLoans: number
}

export type CreateLoanPayload = {
  id?: string
  type: LoanType
  partyName: string
  partyType?: string
  phone?: string
  email?: string
  idNumber?: string
  principalAmount: number
  interestRate?: number
  interestAmount?: number
  startDate?: string
  dueDate?: string
  paymentMethod?: string
  installmentType?: string
  purpose?: string
  collateral?: string
  notes?: string
}

export type RecordRepaymentPayload = {
  amount: number
  date?: string
  paymentMethod?: string
  reference?: string
  notes?: string
  recordedBy?: string
}

export type CreateExpensePayload = {
  date: string
  amount: number | string
  category?: string
  description?: string
  vendor?: string
  reference?: string
  status?: string
}

export type BulkImportResponse = {
  count: number
  skipped?: number
  failed?: number
  rows?: unknown[]
}

async function request<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs, ...fetchOptions } = options ?? {}
  const controller = timeoutMs ? new AbortController() : undefined
  const timeoutId = timeoutMs ? window.setTimeout(() => controller?.abort(), timeoutMs) : undefined
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  const headers = {
    ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers,
      ...fetchOptions,
      signal: controller?.signal,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)
      throw new Error(errorBody?.message ?? `API request failed: ${response.status}`)
    }

    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Try a smaller file or check that the server is running.')
    }
    throw error
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId)
  }
}

function periodQuery(period?: FilterPeriod, from?: string, to?: string) {
  const params = new URLSearchParams()
  if (period) params.set('period', period)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  return query ? `?${query}` : ''
}

function reportQuery(from?: string, to?: string, credit: CreditFilter = 'all') {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (credit && credit !== 'all') params.set('credit', credit)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const api = {
  dashboard: () => request<DashboardResponse>('/dashboard'),
  inventory: (limit = 1000) => request<ListResponse<InventoryRow>>(`/inventory?limit=${encodeURIComponent(String(limit))}`),
  searchInventory: (query: string) => request<ListResponse<InventoryRow>>(`/search/inventory?q=${encodeURIComponent(query)}`),
  purchases: (period?: FilterPeriod, from?: string, to?: string) => request<ListResponse<PurchaseRow>>(`/purchases${periodQuery(period, from, to)}`),
  sales: (period?: FilterPeriod, from?: string, to?: string) => request<ListResponse<SaleRow>>(`/sales${periodQuery(period, from, to)}`),
  expenses: (page = 1, limit = 50, search = '', category = '') => request<ListResponse<ExpenseRow>>(`/expenses?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`),
  reports: (from?: string, to?: string, credit: CreditFilter = 'all') => request<ReportsResponse>(`/reports${reportQuery(from, to, credit)}`),
  settings: () => request<SettingsResponse>('/settings'),
  updateSettings: (payload: Partial<SettingsResponse>) => request<SettingsResponse>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  getAvailableItems: () => request<AvailableItemsResponse>('/sales/available/items'),
  createPurchase: (payload: ManualEntryPayload) => request<PurchaseRow>('/purchases', {
    method: 'POST',
    body: JSON.stringify({
      id: payload.reference,
      item: payload.item,
      supplier: payload.contactName,
      phone: payload.phone,
      sku: payload.sku,
      category: payload.category,
      extractedText: payload.extractedText,
      quantity: payload.quantity,
      unitPrice: payload.unitPrice,
      inventoryPrice: payload.inventoryPrice,
      payment: payload.payment || 'Cash',
      paidAmount: payload.paidAmount,
    }),
  }),
  createPurchaseImport: (payload: Record<string, unknown>) => request<PurchaseRow>('/purchases', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  bulkImportPurchases: (rows: Record<string, unknown>[]) => request<BulkImportResponse>('/purchases/import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
    timeoutMs: 120000,
  }),
  createInventoryImport: (payload: Record<string, unknown>) => request<InventoryRow>('/inventory', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  bulkImportInventory: (rows: Record<string, unknown>[]) => request<BulkImportResponse>('/inventory/import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
    timeoutMs: 120000,
  }),
  createSale: (payload: ManualEntryPayload) => request<SaleRow>('/sales', {
    method: 'POST',
    body: JSON.stringify({
      id: payload.reference,
      item: payload.item,
      customer: payload.contactName,
      phone: payload.phone,
      sku: payload.sku,
      category: payload.category,
      extractedText: payload.extractedText,
      quantity: payload.quantity,
      value: payload.total,
      payment: payload.payment || 'Cash',
      paidAmount: payload.paidAmount,
    }),
  }),
  createSaleImport: (payload: Record<string, unknown>) => request<SaleRow>('/sales', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  bulkImportSales: (rows: Record<string, unknown>[]) => request<BulkImportResponse>('/sales/import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
    timeoutMs: 120000,
  }),
  createExpense: (payload: CreateExpensePayload) => request<ExpenseRow>('/expenses', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updatePurchaseStatus: (id: string, status: EntryStatus) => request<PurchaseRow>(`/purchases/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  updatePurchase: (id: string, payload: PurchaseUpdatePayload) => request<PurchaseRow>(`/purchases/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  updateSale: (id: string, payload: SaleUpdatePayload) => request<SaleRow>(`/sales/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  updateSaleStatus: (id: string, status: EntryStatus) => request<SaleRow>(`/sales/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  updateInventory: (sku: string, payload: InventoryUpdatePayload) => request<InventoryRow>(`/inventory/${encodeURIComponent(sku)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  updateExpense: (id: string, payload: ExpenseUpdatePayload) => request<ExpenseRow>(`/expenses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  stockMovements: (sku?: string, page = 1, limit = 50, type?: string, search?: string) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })
    if (sku) params.set('sku', sku)
    if (type && type !== 'ALL') params.set('type', type)
    if (search) params.set('search', search)
    return request<ListResponse<StockMovementRow>>(`/stock-movements?${params.toString()}`)
  },
  adjustStock: (payload: StockAdjustmentPayload) => request<StockMovementRow>('/stock-movements/adjust', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  venues: () => request<ListResponse<VenueRow>>('/venues'),
  createVenue: (payload: VenueRow) => request<VenueRow>('/venues', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateVenue: (code: string, payload: Partial<VenueRow>) => request<VenueRow>(`/venues/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  deleteVenue: (code: string) => request<{ success: boolean }>(`/venues/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  }),
  loans: (type?: 'GIVEN' | 'TAKEN', status?: string, search?: string, page = 1, limit = 50) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (type) params.set('type', type)
    if (status && status !== 'ALL') params.set('status', status)
    if (search) params.set('search', search)
    return request<ListResponse<LoanRow>>(`/loans?${params.toString()}`)
  },
  loan: (id: string) => request<LoanRow>(`/loans/${encodeURIComponent(id)}`),
  createLoan: (payload: CreateLoanPayload) => request<LoanRow>('/loans', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  recordLoanRepayment: (id: string, payload: RecordRepaymentPayload) => request<LoanRow>(`/loans/${encodeURIComponent(id)}/repayments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateLoan: (id: string, payload: Partial<CreateLoanPayload>) => request<LoanRow>(`/loans/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  deleteLoan: (id: string) => request<{ success: boolean; id: string }>(`/loans/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
  loanMetrics: () => request<LoanMetrics>('/loans/metrics'),
  deleteInventory: (sku: string) => request<{ success: boolean }>(`/inventory/${encodeURIComponent(sku)}`, {
    method: 'DELETE',
  }),
  deleteSale: (id: string) => request<{ success: boolean }>(`/sales/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
  deletePurchase: (id: string) => request<{ success: boolean }>(`/purchases/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
  deleteExpense: (id: string) => request<{ success: boolean }>(`/expenses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
  login: (email: string, password: string) => request<{ token: string; user: { id: string; username: string; email: string; role: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  register: (username: string, email: string, password: string) => request<{ token: string; user: { id: string; username: string; email: string; role: string } }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  }),
  me: (token: string) => request<{ id: string; username: string; email: string; role: string }>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }),
}
