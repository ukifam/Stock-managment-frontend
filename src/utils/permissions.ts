import type { PermissionAction, RolePermission } from '../api'

export const PERMISSION_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'approve', 'cancel', 'delete', 'export']

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Open',
  create: 'Add',
  edit: 'Edit',
  approve: 'Approve',
  cancel: 'Cancel',
  delete: 'Delete',
  export: 'Export',
}

// Ordered as they appear in the sidebar. Modules not listed here have no page.
export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  sales: 'Sales',
  purchases: 'Purchases',
  inventory: 'Products & stock',
  stock_movements: 'Stock movements',
  transfers: 'Transfers',
  production: 'Production',
  quality: 'Quality control',
  expenses: 'Expenses',
  loans: 'Loans',
  reports: 'Reports',
  organization: 'Business & branches',
  users: 'Staff & roles',
  settings: 'Settings',
  search: 'Search',
}

const PROCESSING_MODULES = ['production', 'quality']

export function pageModules(processingEnabled: boolean) {
  return Object.keys(MODULE_LABELS).filter((module) => processingEnabled || !PROCESSING_MODULES.includes(module))
}

export function hasPermission(permissions: RolePermission[] | undefined, module: string, action: PermissionAction) {
  return Boolean(permissions?.find((permission) => permission.module === module)?.actions.includes(action))
}

function toKeys(permissions: RolePermission[] = []) {
  return new Set(permissions.flatMap(({ module, actions }) => actions.map((action) => `${module}:${action}`)))
}

function fromKeys(keys: Set<string>): RolePermission[] {
  const byModule = new Map<string, PermissionAction[]>()
  for (const key of keys) {
    const [module, action] = key.split(':') as [string, PermissionAction]
    byModule.set(module, [...(byModule.get(module) || []), action])
  }
  return [...byModule.entries()].map(([module, actions]) => ({
    module,
    actions: PERMISSION_ACTIONS.filter((action) => actions.includes(action)),
  }))
}

export function applyOverrides(base: RolePermission[], grants: RolePermission[] = [], revokes: RolePermission[] = []) {
  const keys = toKeys(base)
  toKeys(grants).forEach((key) => keys.add(key))
  toKeys(revokes).forEach((key) => keys.delete(key))
  return fromKeys(keys)
}

export function diffPermissions(base: RolePermission[], desired: RolePermission[]) {
  const baseKeys = toKeys(base)
  const desiredKeys = toKeys(desired)
  return {
    grants: fromKeys(new Set([...desiredKeys].filter((key) => !baseKeys.has(key)))),
    revokes: fromKeys(new Set([...baseKeys].filter((key) => !desiredKeys.has(key)))),
  }
}

// Turning a page off removes every action on it; any other action needs the page open.
export function togglePermission(permissions: RolePermission[], module: string, action: PermissionAction) {
  const keys = toKeys(permissions)
  const key = `${module}:${action}`
  if (keys.has(key)) {
    if (action === 'view') PERMISSION_ACTIONS.forEach((item) => keys.delete(`${module}:${item}`))
    else keys.delete(key)
  } else {
    keys.add(key)
    keys.add(`${module}:view`)
  }
  return fromKeys(keys)
}

export function countPermissions(permissions: RolePermission[] = []) {
  return permissions.reduce((total, permission) => total + permission.actions.length, 0)
}
