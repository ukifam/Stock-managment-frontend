import { ACTIVE_BRANCH_STORAGE_KEY } from '../api'

const LEGACY_STORAGE_KEY = 'tri_production_pipelines'
const SYSTEM_ADMIN_SHOP_KEY = 'tri_system_admin_shop_owner_key'

export type PipelineStorageScope = {
  ownerKey?: string
  email?: string
  defaultBranchCode?: string
} | null

// Pipelines are cached per shop and branch so switching accounts in one browser never mixes data.
export function pipelineStorageKey(user?: PipelineStorageScope) {
  const owner = safeGet(SYSTEM_ADMIN_SHOP_KEY) || user?.ownerKey || user?.email || 'default'
  const branch = safeGet(ACTIVE_BRANCH_STORAGE_KEY) || user?.defaultBranchCode || 'MAIN'
  return `${LEGACY_STORAGE_KEY}_${owner}_${branch}`
}

export function readStoredPipelines<T>(user?: PipelineStorageScope): T[] {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    const raw = localStorage.getItem(pipelineStorageKey(user))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

export function writeStoredPipelines<T>(pipelines: T[], user?: PipelineStorageScope) {
  try {
    localStorage.setItem(pipelineStorageKey(user), JSON.stringify(pipelines))
  } catch {
    // Storage can be full or blocked; the server copy remains the source of truth.
  }
}

function safeGet(key: string) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}
