import type { FilterPeriod } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'

export type Metric = {
  label: string
  value: string
  delta?: string
  note?: string
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
  rawValue?: number
  quantity: string
  unitPrice?: string
  value: string
  status: string
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
  items: string
  value: string
  payment: string
  status: string
}

export type DashboardResponse = {
  metrics: Metric[]
  salesBars: number[]
  lowStock: LowStockAlert[]
  catalog: CatalogItem[]
}

export type ListResponse<T> = {
  rows: T[]
  count: number
}

export type ReportsResponse = {
  metrics: Metric[]
  reportBars: number[]
  recentTransactions: Array<Partial<SaleRow & PurchaseRow>>
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
  total: string
  sku: string
  extractedText?: string
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
  status?: string
  extractedText?: string
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: options?.body ? { 'Content-Type': 'application/json', ...options.headers } : options?.headers,
    ...options,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.message ?? `API request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

function periodQuery(period: FilterPeriod) {
  return `?period=${encodeURIComponent(period)}`
}

export const api = {
  dashboard: () => request<DashboardResponse>('/dashboard'),
  inventory: (period: FilterPeriod) => request<ListResponse<InventoryRow>>(`/inventory${periodQuery(period)}`),
  searchInventory: (query: string) => request<ListResponse<InventoryRow>>(`/search/inventory?q=${encodeURIComponent(query)}`),
  purchases: (period: FilterPeriod) => request<ListResponse<PurchaseRow>>(`/purchases${periodQuery(period)}`),
  sales: (period: FilterPeriod) => request<ListResponse<SaleRow>>(`/sales${periodQuery(period)}`),
  reports: (period: FilterPeriod) => request<ReportsResponse>(`/reports${periodQuery(period)}`),
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
      status: 'Received',
    }),
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
      status: 'Given',
      payment: 'Credit',
    }),
  }),
  updatePurchaseStatus: (id: string, status: EntryStatus) => request<PurchaseRow>(`/purchases/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  updatePurchase: (id: string, payload: PurchaseUpdatePayload) => request<PurchaseRow>(`/purchases/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  updateSaleStatus: (id: string, status: EntryStatus) => request<SaleRow>(`/sales/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
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
}
