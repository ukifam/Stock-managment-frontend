import type { PermissionAction } from '../api'
import type { AuthUser } from '../context/AuthContext'
import type { Page } from '../types'

export const PRODUCTION_PAGES: Page[] = [
  'production',
  'production-objectives',
  'production-recipes',
  'production-processes',
  'production-orders',
  'production-procurement',
  'production-resources',
  'production-waste',
  'production-pipeline',
]

const MODULE_BY_PAGE: Partial<Record<Page, string>> = {
  dashboard: 'dashboard',
  organization: 'organization',
  'shop-users': 'users',
  'access-control': 'users',
  inventory: 'inventory',
  'inventory-control': 'inventory',
  'stock-movements': 'stock_movements',
  'stock-adjustments': 'stock_movements',
  purchases: 'purchases',
  'purchase-items': 'purchases',
  'purchases-report': 'purchases',
  sales: 'sales',
  'sale-items': 'sales',
  'sales-report': 'sales',
  expenses: 'expenses',
  'expense-items': 'expenses',
  'expenses-report': 'expenses',
  loans: 'loans',
  'loans-given': 'loans',
  'loans-taken': 'loans',
  'loans-repayments': 'loans',
  transfers: 'transfers',
  'quality-control': 'quality',
  reports: 'reports',
  settings: 'settings',
  ...Object.fromEntries(PRODUCTION_PAGES.map((page) => [page, 'production'])),
}

export function moduleForPage(page: Page) {
  return MODULE_BY_PAGE[page] || 'dashboard'
}

export function normalizedRole(role?: string) {
  return String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function isSystemAdminRole(role?: string) {
  return normalizedRole(role) === 'system_admin'
}

export function isFullAccessRole(role?: string) {
  const value = normalizedRole(role)
  return value === 'admin' || value === 'system_admin'
}

export function canAccess(user: AuthUser | null | undefined, module: string, action: PermissionAction = 'view') {
  if (isFullAccessRole(user?.role)) return true
  return Boolean(user?.permissions?.find((permission) => permission.module === module)?.actions.includes(action))
}

export function isProcessingFeaturePage(page: Page) {
  return page === 'quality-control' || PRODUCTION_PAGES.includes(page)
}
