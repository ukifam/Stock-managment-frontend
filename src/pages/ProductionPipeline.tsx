import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react'
import { api, type InventoryRow, type ShopRole, type ItemMaster, type UnitDefinition, type ProductionRecipe } from '../api'
import { Topbar } from '../components/Topbar'
import { formatMoney } from '../utils/money'
import type { Theme } from '../types'
import { useAuth } from '../context/AuthContext'

function isFinishedProduct(item: { itemType?: string; category?: string }) {
  const type = String(item.itemType || '').trim().toLowerCase()
  const category = String(item.category || '').trim().toLowerCase()
  return ['finished_product', 'semi_finished_product'].includes(type) || ['finished goods', 'finished product', 'finished products'].includes(category)
}

/* ──────────────────────────────── Types ──────────────────────────────── */

export type PipelineStage =
  | 'plan'
  | 'receive_plan'
  | 'purchase'
  | 'store_raw'
  | 'produce'
  | 'quality_check'
  | 'finish'
  | 'store_finished'
  | 'sell'
  | 'cost'
  | 'analyze'

export type PipelineExecutionMode = 'delegated' | 'solo'

export type PipelineActivityRecord = {
  id: string
  stage: PipelineStage
  stageLabel: string
  performedBy: string
  performedByRole: string
  timestamp: string
  summary: string
  details?: string
  metrics?: Record<string, any>
}

type Ingredient = {
  id: string
  name: string
  quantity: number
  unit: string
  unitCost: number
}

type SaleRecord = {
  id: string
  date: string
  quantity: number
  unitPrice: number
  customer: string
  payment?: string
}

type QualityResult = {
  passed: boolean
  inspectedQuantity: number
  passedQuantity: number
  defectQuantity: number
  notes: string
  inspectedBy: string
  date: string
}

export type PipelineData = {
  id: string
  productName: string
  businessType: string
  singleUnitLabel: string
  ingredients: Ingredient[]
  targetQuantity: number
  scheduledDate: string
  currentStage: PipelineStage
  completedStages: PipelineStage[]
  // Operational workflow mode
  executionMode?: PipelineExecutionMode
  // Audit trail of worker activities & alerts
  activityLog?: PipelineActivityRecord[]
  // Calculated
  totalIngredients: Array<Ingredient & { totalQuantity: number; totalCost: number }>
  totalMaterialCost: number
  // Purchase
  purchasedItems: Array<{
    ingredientId: string
    purchased: boolean
    purchasedQuantity?: number
    actualCost: number
    surplusQuantity?: number
  }>
  // Produce
  producedQuantity: number
  productionStartTime: string
  productionEndTime: string
  productionNotes: string
  // Quality
  qualityResult: QualityResult | null
  // Sell
  sellingPricePerUnit: number
  sales: SaleRecord[]
  // Storage
  rawMaterialsStored: boolean
  finishedGoodsStored: boolean
  finishedGoodsLocation: string
  // Timestamps
  createdAt: string
  updatedAt: string
}

export const STAGES: Array<{ id: PipelineStage; label: string; icon: string; shortLabel: string }> = [
  { id: 'plan', label: 'Plan', icon: '📋', shortLabel: 'Plan' },
  { id: 'receive_plan', label: 'Receive Plan', icon: '📥', shortLabel: 'Review' },
  { id: 'purchase', label: 'Purchase', icon: '🛒', shortLabel: 'Buy' },
  { id: 'store_raw', label: 'Store Materials', icon: '📦', shortLabel: 'Store' },
  { id: 'produce', label: 'Produce', icon: '⚙️', shortLabel: 'Make' },
  { id: 'quality_check', label: 'Quality Check', icon: '✅', shortLabel: 'QC' },
  { id: 'finish', label: 'Finish', icon: '🏁', shortLabel: 'Done' },
  { id: 'store_finished', label: 'Store Products', icon: '🏪', shortLabel: 'Stock' },
  { id: 'sell', label: 'Sell', icon: '💰', shortLabel: 'Sell' },
  { id: 'cost', label: 'Cost', icon: '📊', shortLabel: 'Cost' },
  { id: 'analyze', label: 'Analyze', icon: '📈', shortLabel: 'Profit' },
]

export const STAGE_ROLE_RULES: Record<
  PipelineStage,
  {
    allowedRoles: ShopRole[]
    primaryRoleName: string
    description: string
    icon: string
  }
> = {
  plan: {
    allowedRoles: ['production_supervisor', 'manager'],
    primaryRoleName: 'Shop Admin / Planner',
    description: 'Set recipe bill of materials, batch targets and production schedule',
    icon: '📋',
  },
  receive_plan: {
    allowedRoles: ['production_supervisor', 'shift_supervisor', 'manager'],
    primaryRoleName: 'Production Supervisor',
    description: 'Review recipe requirements and verify operational readiness',
    icon: '📥',
  },
  purchase: {
    allowedRoles: ['procurement_officer', 'storekeeper', 'manager'],
    primaryRoleName: 'Procurement Officer',
    description: 'Purchase required ingredients and record actual supplier costs',
    icon: '🛒',
  },
  store_raw: {
    allowedRoles: ['storekeeper', 'stock_clerk', 'manager'],
    primaryRoleName: 'Storekeeper / Inventory',
    description: 'Verify and stock raw materials into inventory storage',
    icon: '📦',
  },
  produce: {
    allowedRoles: ['production_supervisor', 'shift_supervisor'],
    primaryRoleName: 'Production Supervisor / Operator',
    description: 'Execute batch processing and log actual units produced',
    icon: '⚙️',
  },
  quality_check: {
    allowedRoles: ['quality_officer', 'manager'],
    primaryRoleName: 'Quality Officer / QC',
    description: 'Inspect product quality, check defects and approve batch release',
    icon: '✅',
  },
  finish: {
    allowedRoles: ['production_supervisor', 'storekeeper', 'manager'],
    primaryRoleName: 'Production Supervisor',
    description: 'Package, label and prepare finished items for stock transfer',
    icon: '🏁',
  },
  store_finished: {
    allowedRoles: ['storekeeper', 'stock_clerk', 'manager'],
    primaryRoleName: 'Storekeeper / Warehouse',
    description: 'Stock finished goods into retail shelves or main warehouse',
    icon: '🏪',
  },
  sell: {
    allowedRoles: ['cashier', 'sales_associate', 'store_manager', 'manager'],
    primaryRoleName: 'Cashier / Sales Associate',
    description: 'Process customer sales, payments and generate receipts',
    icon: '💰',
  },
  cost: {
    allowedRoles: ['accountant', 'manager'],
    primaryRoleName: 'Accountant / Finance',
    description: 'Compute production costs, ingredient usage and profit margins',
    icon: '📊',
  },
  analyze: {
    allowedRoles: ['accountant', 'manager'],
    primaryRoleName: 'Accountant / Admin',
    description: 'Analyze batch yield, overall profitability and forecast',
    icon: '📈',
  },
}

export function canUserExecuteStage(
  stage: PipelineStage,
  user: { role?: string; shopRole?: string } | null,
  executionMode: PipelineExecutionMode = 'delegated'
): { allowed: boolean; reason?: string } {
  const isAdmin = user?.role === 'admin' || user?.role === 'system_admin'
  if (isAdmin) return { allowed: true }

  if (executionMode === 'solo') {
    return {
      allowed: false,
      reason: 'This pipeline is set to Solo Admin Mode. Only the shop administrator can execute stages.',
    }
  }

  const rule = STAGE_ROLE_RULES[stage]
  if (!rule) return { allowed: true }

  const userShopRole = (user?.shopRole || '') as ShopRole
  if (rule.allowedRoles.includes(userShopRole)) {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: `Requires ${rule.primaryRoleName}. You are signed in as ${userShopRole ? userShopRole.replace(/_/g, ' ') : 'Staff'}.`,
  }
}

const STORAGE_KEY = 'tri_production_pipelines'
const ACTIVE_PIPELINE_KEY = 'tri_active_pipeline_id'

/* ──────────────────────────────── Unit Helpers ──────────────────────────────── */

export function cleanUnitName(label: string): string {
  if (!label) return 'unit'
  return label.replace(/^1\s+/i, '').trim() || 'unit'
}

export function formatUnitQty(quantity: number, label: string): string {
  const unit = cleanUnitName(label)
  if (quantity === 1) return `1 ${unit}`
  if (unit.endsWith('s')) return `${quantity.toLocaleString()} ${unit}`
  return `${quantity.toLocaleString()} ${unit}s`
}

export function findMatchingInventoryItem(ingName: string, inventory: InventoryRow[]): InventoryRow | undefined {
  if (!ingName || inventory.length === 0) return undefined
  const clean = ingName.toLowerCase().trim()
  const exact = inventory.find((item) => item.item.toLowerCase().trim() === clean)
  if (exact) return exact

  const tokens = clean.split(/[\s/,-]+/).filter((t) => t.length >= 3)
  for (const token of tokens) {
    const match = inventory.find((item) => item.item.toLowerCase().includes(token))
    if (match) return match
  }
  return undefined
}

/* ──────────────────────────────── Business Presets ──────────────────────────────── */

const BUSINESS_PRESETS: Array<{ value: string; label: string; unitLabel: string; example: string; ingredients: Ingredient[] }> = [
  {
    value: 'cafe',
    label: '☕ Café / Coffee & Tea',
    unitLabel: 'cup',
    example: 'e.g. Milk Tea or American Tea',
    ingredients: [
      { id: '1', name: 'Tea leaves', quantity: 5, unit: 'grams', unitCost: 2 },
      { id: '2', name: 'Milk', quantity: 50, unit: 'ml', unitCost: 1.5 },
      { id: '3', name: 'Sugar', quantity: 10, unit: 'grams', unitCost: 0.5 },
      { id: '4', name: 'Water', quantity: 200, unit: 'ml', unitCost: 0.1 },
      { id: '5', name: 'Tea cups / Packaging', quantity: 1, unit: 'cup', unitCost: 50 },
    ],
  },
  {
    value: 'restaurant',
    label: '🍽️ Restaurant',
    unitLabel: 'plate',
    example: 'e.g. 1 plate of Food',
    ingredients: [
      { id: '1', name: 'Main ingredient', quantity: 300, unit: 'grams', unitCost: 3 },
      { id: '2', name: 'Oil / Fat', quantity: 30, unit: 'ml', unitCost: 1 },
      { id: '3', name: 'Seasoning', quantity: 10, unit: 'grams', unitCost: 2 },
      { id: '4', name: 'Side / Starch', quantity: 200, unit: 'grams', unitCost: 1.5 },
      { id: '5', name: 'Takeaway Packaging', quantity: 1, unit: 'piece', unitCost: 100 },
    ],
  },
  {
    value: 'bakery',
    label: '🍞 Bakery / Boulangerie',
    unitLabel: 'loaf',
    example: 'e.g. 1 loaf of Bread',
    ingredients: [
      { id: '1', name: 'Flour', quantity: 500, unit: 'grams', unitCost: 1 },
      { id: '2', name: 'Yeast', quantity: 7, unit: 'grams', unitCost: 3 },
      { id: '3', name: 'Salt', quantity: 10, unit: 'grams', unitCost: 0.3 },
      { id: '4', name: 'Sugar', quantity: 25, unit: 'grams', unitCost: 0.5 },
      { id: '5', name: 'Oil / Butter', quantity: 30, unit: 'ml', unitCost: 2 },
      { id: '6', name: 'Water', quantity: 300, unit: 'ml', unitCost: 0.1 },
      { id: '7', name: 'Bread Bag / Packaging', quantity: 1, unit: 'piece', unitCost: 30 },
    ],
  },
  {
    value: 'maize_mill',
    label: '🌽 Maize Mill',
    unitLabel: 'kg',
    example: 'e.g. 1 kg of Maize Flour',
    ingredients: [
      { id: '1', name: 'Maize grain', quantity: 1.2, unit: 'kg', unitCost: 500 },
      { id: '2', name: 'Electricity / Energy', quantity: 0.5, unit: 'kWh', unitCost: 100 },
      { id: '3', name: 'Packaging bag', quantity: 1, unit: 'piece', unitCost: 50 },
    ],
  },
  {
    value: 'juice_producer',
    label: '🧃 Juice Producer',
    unitLabel: 'glass',
    example: 'e.g. 1 glass of Fresh Juice',
    ingredients: [
      { id: '1', name: 'Fruit', quantity: 200, unit: 'grams', unitCost: 3 },
      { id: '2', name: 'Sugar', quantity: 15, unit: 'grams', unitCost: 0.5 },
      { id: '3', name: 'Water / Ice', quantity: 100, unit: 'ml', unitCost: 0.2 },
      { id: '4', name: 'Juice Bottle / Cup', quantity: 1, unit: 'piece', unitCost: 70 },
    ],
  },
  {
    value: 'furniture_workshop',
    label: '🪑 Furniture Workshop',
    unitLabel: 'piece',
    example: 'e.g. 1 chair or table',
    ingredients: [
      { id: '1', name: 'Timber / Wood', quantity: 5, unit: 'kg', unitCost: 500 },
      { id: '2', name: 'Nails / Screws', quantity: 20, unit: 'pieces', unitCost: 5 },
      { id: '3', name: 'Varnish / Paint', quantity: 0.5, unit: 'litre', unitCost: 2000 },
      { id: '4', name: 'Glue', quantity: 0.1, unit: 'litre', unitCost: 500 },
    ],
  },
  {
    value: 'soap_manufacturer',
    label: '🧼 Soap Manufacturer',
    unitLabel: 'bar',
    example: 'e.g. 1 bar of soap',
    ingredients: [
      { id: '1', name: 'Oil / Fat base', quantity: 100, unit: 'grams', unitCost: 2 },
      { id: '2', name: 'Lye (NaOH)', quantity: 15, unit: 'grams', unitCost: 3 },
      { id: '3', name: 'Fragrance', quantity: 5, unit: 'ml', unitCost: 10 },
      { id: '4', name: 'Colourant', quantity: 2, unit: 'grams', unitCost: 5 },
      { id: '5', name: 'Soap Wrapper', quantity: 1, unit: 'piece', unitCost: 20 },
    ],
  },
  {
    value: 'cosmetics',
    label: '💄 Cosmetics',
    unitLabel: 'unit',
    example: 'e.g. 1 jar of cream',
    ingredients: [
      { id: '1', name: 'Base / Emulsion', quantity: 80, unit: 'grams', unitCost: 5 },
      { id: '2', name: 'Active ingredient', quantity: 10, unit: 'grams', unitCost: 20 },
      { id: '3', name: 'Fragrance', quantity: 3, unit: 'ml', unitCost: 15 },
      { id: '4', name: 'Container / Jar', quantity: 1, unit: 'piece', unitCost: 50 },
    ],
  },
  {
    value: 'agro_processor',
    label: '🌾 Agro Processor',
    unitLabel: 'kg',
    example: 'e.g. 1 kg of processed grain',
    ingredients: [
      { id: '1', name: 'Raw crop / grain', quantity: 1.3, unit: 'kg', unitCost: 400 },
      { id: '2', name: 'Processing energy', quantity: 0.4, unit: 'kWh', unitCost: 80 },
      { id: '3', name: 'Packaging', quantity: 1, unit: 'piece', unitCost: 30 },
    ],
  },
  {
    value: 'other',
    label: '🔧 General / Custom',
    unitLabel: 'unit',
    example: 'Define your own product ingredients',
    ingredients: [],
  },
]

function resolvePreset(template: string): typeof BUSINESS_PRESETS[number] | undefined {
  const key = template.trim().toLowerCase().replace(/[\s-]+/g, '_')
  const direct = BUSINESS_PRESETS.find((p) => p.value === key)
  if (direct) return direct

  const aliases: Record<string, string> = {
    coffee_shop: 'cafe', coffee: 'cafe', tea_shop: 'cafe',
    boulangerie: 'bakery', bread: 'bakery',
    juice_bar: 'juice_producer', juice: 'juice_producer',
    maize: 'maize_mill', mill: 'maize_mill', flour_mill: 'maize_mill',
    retail_shop: 'other', electronics_store: 'other',
    furniture: 'furniture_workshop', soap: 'soap_manufacturer',
    agro: 'agro_processor',
  }
  const mapped = aliases[key]
  if (mapped) return BUSINESS_PRESETS.find((p) => p.value === mapped)
  return BUSINESS_PRESETS.find((p) => p.value === 'other')
}

function generateId() {
  return `PP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function createEmptyPipeline(): PipelineData {
  return {
    id: generateId(),
    productName: '',
    businessType: '',
    singleUnitLabel: 'unit',
    ingredients: [],
    targetQuantity: 1,
    scheduledDate: new Date().toISOString().slice(0, 10),
    currentStage: 'plan',
    completedStages: [],
    executionMode: 'delegated',
    activityLog: [],
    totalIngredients: [],
    totalMaterialCost: 0,
    purchasedItems: [],
    producedQuantity: 0,
    productionStartTime: '',
    productionEndTime: '',
    productionNotes: '',
    qualityResult: null,
    sellingPricePerUnit: 0,
    sales: [],
    rawMaterialsStored: false,
    finishedGoodsStored: false,
    finishedGoodsLocation: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function getStorageKey(user?: any) {
  const owner = user?.ownerKey || user?.shopOwnerKey || user?.email || 'default'
  const branch = user?.branchCode || user?.defaultBranchCode || 'MAIN'
  return `tri_production_pipelines_${owner}_${branch}`
}

function convertServerOrderToPipeline(order: any): PipelineData {
  const stageMap: Record<string, PipelineStage> = {
    DRAFT: 'plan',
    PENDING_APPROVAL: 'receive_plan',
    APPROVED: 'purchase',
    PLANNED: 'store_raw',
    MATERIALS_READY: 'store_raw',
    IN_PROGRESS: 'produce',
    QUALITY_CHECK: 'quality_check',
    REWORK: 'produce',
    ON_HOLD: 'quality_check',
    COMPLETED: 'analyze',
    CANCELLED: 'plan',
  }

  const reqs = Array.isArray(order.requirements) ? order.requirements : []
  const ingredients: Ingredient[] = reqs.map((req: any, idx: number) => ({
    id: `ing-${idx + 1}-${order.id || Date.now()}`,
    name: req.item || req.sku || 'Ingredient',
    quantity: req.requiredQuantity ? (req.requiredQuantity / (order.plannedQuantity || 1)) : 1,
    unit: cleanUnitName(req.unit || req.recipeUnit || 'unit'),
    unitCost: req.unitCost || req.purchaseUnitPrice || 0,
  }))

  const targetQuantity = Number(order.plannedQuantity) || 1
  const totalIngredients = ingredients.map((ing) => ({
    ...ing,
    totalQuantity: ing.quantity * targetQuantity,
    totalCost: ing.quantity * targetQuantity * ing.unitCost,
  }))

  const totalMaterialCost = totalIngredients.reduce((sum, ing) => sum + ing.totalCost, 0)
  const currentStage = stageMap[String(order.status).toUpperCase()] || 'plan'
  const allStages: PipelineStage[] = ['plan', 'receive_plan', 'purchase', 'store_raw', 'produce', 'quality_check', 'finish', 'store_finished', 'sell', 'cost', 'analyze']
  const stageIdx = allStages.indexOf(currentStage)
  const completedStages = stageIdx >= 0
    ? allStages.slice(0, stageIdx + (order.status === 'COMPLETED' ? 1 : 0))
    : ['plan']

  return {
    id: order.id || `PP-${Date.now()}`,
    productName: order.productName || 'Batch Product',
    businessType: 'other',
    singleUnitLabel: cleanUnitName(order.productUnit || 'unit'),
    ingredients: ingredients.length > 0 ? ingredients : [{ id: 'ing-1', name: 'Raw Material', quantity: 1, unit: 'unit', unitCost: 0 }],
    targetQuantity,
    scheduledDate: order.scheduledDate || new Date().toISOString().slice(0, 10),
    currentStage,
    completedStages,
    executionMode: 'delegated',
    activityLog: [
      {
        id: `act-server-${order.id}`,
        stage: currentStage,
        stageLabel: `Shop Record (${order.status || 'Active'})`,
        performedBy: order.createdBy?.username || order.createdBy?.email || 'Shop Manager',
        performedByRole: 'Shop Manager',
        timestamp: order.createdAt || new Date().toISOString(),
        summary: `Production order ${order.id} loaded from shop database (${targetQuantity} ${cleanUnitName(order.productUnit)}).`,
      },
    ],
    totalIngredients,
    totalMaterialCost,
    purchasedItems: totalIngredients.map((ing) => ({
      ingredientId: ing.id,
      purchased: true,
      purchasedQuantity: ing.totalQuantity,
      actualCost: ing.totalCost,
      surplusQuantity: 0,
    })),
    producedQuantity: Number(order.actualOutput) || targetQuantity,
    productionStartTime: order.startedAt || '',
    productionEndTime: order.completedAt || '',
    productionNotes: order.notes || '',
    qualityResult: order.status === 'COMPLETED' ? {
      passed: true,
      inspectedQuantity: targetQuantity,
      passedQuantity: targetQuantity,
      defectQuantity: 0,
      notes: 'Inspection passed',
      inspectedBy: 'Shop Manager',
      date: order.completedAt || new Date().toISOString().slice(0, 10),
    } : null,
    sellingPricePerUnit: Number(order.cost?.unit) || 0,
    sales: [],
    rawMaterialsStored: ['IN_PROGRESS', 'QUALITY_CHECK', 'COMPLETED'].includes(order.status),
    finishedGoodsStored: order.status === 'COMPLETED',
    finishedGoodsLocation: 'Main Store',
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: order.updatedAt || new Date().toISOString(),
  }
}

function loadPipelines(user?: any): PipelineData[] {
  try {
    const key = getStorageKey(user)
    const raw = localStorage.getItem(key) || localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePipelines(pipelines: PipelineData[], user?: any) {
  try {
    const key = getStorageKey(user)
    localStorage.setItem(key, JSON.stringify(pipelines))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines))
  } catch {}
}

/* ──────────────────────────────── Main Component ──────────────────────────────── */

type PipelineProps = {
  theme?: Theme
  toggleTheme?: () => void
  currency?: string
}

export function ProductionPipeline({ theme = 'dark', toggleTheme = () => {}, currency = 'RWF' }: PipelineProps) {
  const { user } = useAuth()
  const [pipelines, setPipelines] = useState<PipelineData[]>(() => loadPipelines(user))
  const [activePipelineId, setActivePipelineId] = useState<string | null>(() => localStorage.getItem(ACTIVE_PIPELINE_KEY))
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [businessTemplate, setBusinessTemplate] = useState<string>('')
  const [quickSellProduct, setQuickSellProduct] = useState<{ pipeline: PipelineData; available: number; unitPrice: number } | null>(null)
  const [catalogItems, setCatalogItems] = useState<ItemMaster[]>([])
  const [recordedUnits, setRecordedUnits] = useState<string[]>([])
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([])
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false)
  const [showCatalogModal, setShowCatalogModal] = useState(false)
  const [pendingAddProductCb, setPendingAddProductCb] = useState<((item: ItemMaster) => void) | null>(null)
  const [pendingAddIngredientCb, setPendingAddIngredientCb] = useState<((item: ItemMaster) => void) | null>(null)

  const refreshCatalog = useCallback(async () => {
    try {
      const [mdRes, invRes, prodRes] = await Promise.all([
        api.masterData().catch(() => null),
        api.inventory(1000).catch(() => null),
        api.productionOverview().catch(() => null),
      ])
      const masterItems: ItemMaster[] = mdRes?.items || []
      const invRows: InventoryRow[] = invRes?.rows || []

      const itemMap = new Map<string, ItemMaster>()
      masterItems.forEach((m) => itemMap.set(m.sku, m))
      invRows.forEach((r) => {
        if (!itemMap.has(r.sku)) {
          itemMap.set(r.sku, {
            id: r.id || r.sku,
            sku: r.sku,
            item: r.item,
            description: r.description || '',
            category: r.category || 'General',
            itemType: (r.itemType as any) || (isFinishedProduct(r) ? 'finished_product' : 'raw_material'),
            baseUnit: r.baseUnit || 'piece',
            status: r.status || 'Active',
            stock: r.stock || 0,
            minimumStock: r.minimumStock || 0,
            maximumStock: r.maximumStock || 0,
            reorderLevel: r.reorderLevel || 0,
            defaultSupplierId: '',
            supplierOptions: [],
            purchasePrice: (r as any).purchasePrice ?? r.price ?? 0,
            sellingPrice: (r as any).sellingPrice ?? r.price ?? 0,
          })
        }
      })
      const allItems = Array.from(itemMap.values())
      setCatalogItems(allItems)

      const defaultUnits = ['piece', 'kg', 'g', 'litre', 'ml', 'cup', 'plate', 'box', 'bag', 'hour', 'batch', 'unit']
      const mdUnits = (mdRes?.units || []).map((u) => u.code || u.name).filter(Boolean)
      const configUnits = prodRes?.configuration?.units || []
      const combinedUnits = Array.from(new Set([...defaultUnits, ...mdUnits, ...configUnits].map((u) => cleanUnitName(u)).filter(Boolean)))
      setRecordedUnits(combinedUnits)

      if (prodRes?.recipes) {
        setRecipes(prodRes.recipes)
      }

      // Load saved pipelines from server (authoritative source)
      try {
        const serverRes = await api.listPipelines().catch(() => null)
        const serverPipelines: PipelineData[] = serverRes?.pipelines || []
        if (serverPipelines.length > 0) {
          // Merge: server records are authoritative; local-only pipelines (not on server) are kept too
          setPipelines((existing) => {
            const map = new Map<string, PipelineData>()
            // Put server pipelines first (they are authoritative)
            serverPipelines.forEach((sp) => map.set(sp.id, sp))
            // Keep local-only pipelines that haven't been saved to server yet
            existing.forEach((ep) => {
              if (!map.has(ep.id)) map.set(ep.id, ep)
            })
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
            )
            savePipelines(merged, user)
            return merged
          })
        } else {
          // No server pipelines yet — push any existing local ones to server
          const local = loadPipelines(user)
          if (local.length > 0) {
            api.bulkSavePipelines(local).catch(() => {})
          }
        }
      } catch (e) {
        console.warn('Could not fetch pipelines from server:', e)
      }
    } catch (e) {
      console.warn('Could not load processing catalog:', e)
    }
  }, [user])

  useEffect(() => {
    void refreshCatalog()
  }, [refreshCatalog])

  const catalogProducts = useMemo(() => catalogItems.filter((i) => isFinishedProduct(i)), [catalogItems])
  const catalogIngredients = useMemo(() => catalogItems.filter((i) => !isFinishedProduct(i)), [catalogItems])

  useEffect(() => {
    api.businessFeatures()
      .then((result) => setBusinessTemplate(result.template || ''))
      .catch(() => setBusinessTemplate(''))

    // Auto-sync any unrecorded pipeline sales to sales reports / POS
    const list = loadPipelines(user)
    list.forEach((p) => {
      if (p.sales && p.sales.length > 0) {
        p.sales.forEach((s) => {
          api.createPosSale({
            id: s.id,
            date: s.date || new Date().toISOString().slice(0, 10),
            customer: s.customer || 'Walk-in',
            payment: (s.payment as 'Cash' | 'Card' | 'Mobile Money' | 'Credit') || 'Cash',
            source: 'pipeline',
            allowFlexibleStock: true,
            items: [{
              sku: p.id,
              item: p.productName,
              quantity: s.quantity,
              unitPrice: s.unitPrice,
              unit: cleanUnitName(p.singleUnitLabel),
            }],
          }).catch(() => {})
        })
      }
    })
  }, [user])

  const activePipeline = pipelines.find((p) => p.id === activePipelineId) || null

  const persist = useCallback((updated: PipelineData[]) => {
    setPipelines(updated)
    savePipelines(updated, user)
  }, [user])

  const updatePipeline = useCallback((data: PipelineData) => {
    data.updatedAt = new Date().toISOString()
    const updated = pipelines.map((p) => (p.id === data.id ? data : p))
    persist(updated)
    // Always save to server so any device/session can pick it up
    api.savePipelineToServer(data).catch(() => {})
  }, [pipelines, persist])

  const createNew = () => {
    const pipeline = createEmptyPipeline()
    const updated = [pipeline, ...pipelines]
    persist(updated)
    setActivePipelineId(pipeline.id)
    localStorage.setItem(ACTIVE_PIPELINE_KEY, pipeline.id)
    api.savePipelineToServer(pipeline).catch(() => {})
  }

  const openPipeline = (id: string) => {
    setActivePipelineId(id)
    localStorage.setItem(ACTIVE_PIPELINE_KEY, id)
  }

  const goBack = () => {
    setActivePipelineId(null)
    localStorage.removeItem(ACTIVE_PIPELINE_KEY)
  }

  const deletePipeline = (id: string) => {
    const updated = pipelines.filter((p) => p.id !== id)
    persist(updated)
    if (activePipelineId === id) {
      setActivePipelineId(null)
      localStorage.removeItem(ACTIVE_PIPELINE_KEY)
    }
    api.deletePipelineFromServer(id).catch(() => {})
  }

  const advanceStage = (pipeline: PipelineData) => {
    const currentIdx = STAGES.findIndex((s) => s.id === pipeline.currentStage)
    const completedStage = pipeline.currentStage
    const completedStageObj = STAGES[currentIdx]

    // 1. Audit Log Entry
    const workerName = user?.username || 'Staff Member'
    const workerRole = (user?.shopRole || user?.role || 'staff').replace(/_/g, ' ')
    const summaryText = `${workerName} (${workerRole}) executed stage "${completedStageObj?.label || completedStage}" on ${pipeline.productName || 'Batch Product'}`

    const logEntry: PipelineActivityRecord = {
      id: String(Date.now()),
      stage: completedStage,
      stageLabel: completedStageObj?.label || completedStage,
      performedBy: workerName,
      performedByRole: user?.shopRole || user?.role || 'staff',
      timestamp: new Date().toISOString(),
      summary: summaryText,
      metrics: {
        product: pipeline.productName,
        targetQuantity: pipeline.targetQuantity,
        producedQuantity: pipeline.producedQuantity,
        materialCost: pipeline.totalMaterialCost,
      },
    }
    const currentLogs = pipeline.activityLog || []
    pipeline.activityLog = [logEntry, ...currentLogs]

    // 2. Dispatch Backend Notification & Email Alert to Shop Admin
    api.recordPipelineActivity({
      pipelineId: pipeline.id,
      stage: completedStage,
      stageLabel: completedStageObj?.label || completedStage,
      productName: pipeline.productName || 'Batch Product',
      summary: summaryText,
      metrics: {
        targetQuantity: pipeline.targetQuantity,
        producedQuantity: pipeline.producedQuantity,
        materialCost: pipeline.totalMaterialCost,
      },
    }).catch((err) => {
      console.warn('Could not dispatch pipeline activity notification:', err)
    })

    if (currentIdx < STAGES.length - 1) {
      const nextStageIndex = currentIdx + 1
      const shouldSkipRawStorage = pipeline.currentStage === 'purchase' && pipeline.rawMaterialsStored
      const nextStage = shouldSkipRawStorage
        ? STAGES[nextStageIndex + 1].id
        : STAGES[nextStageIndex].id
      pipeline.completedStages = [
        ...new Set([
          ...pipeline.completedStages,
          pipeline.currentStage,
          ...(shouldSkipRawStorage ? ['store_raw' as PipelineStage] : []),
        ]),
      ]
      pipeline.currentStage = nextStage
      updatePipeline(pipeline)
      setNotice({
        tone: 'success',
        text: `Stage "${completedStageObj?.label}" completed! Admin alerted via in-app notification & email. Advanced to ${STAGES.find((stage) => stage.id === nextStage)?.label}.`,
      })
    } else {
      pipeline.completedStages = [...new Set([...pipeline.completedStages, pipeline.currentStage])]
      updatePipeline(pipeline)
      setNotice({
        tone: 'success',
        text: `Production run completed! Final summary sent to shop admin.`,
      })
    }
  }

  const goToStage = (pipeline: PipelineData, stage: PipelineStage) => {
    const stageIdx = STAGES.findIndex((s) => s.id === stage)
    const currentIdx = STAGES.findIndex((s) => s.id === pipeline.currentStage)
    if (stageIdx <= currentIdx || pipeline.completedStages.includes(stage)) {
      pipeline.currentStage = stage
      updatePipeline(pipeline)
    }
  }

  const handleQuickSale = (pipelineId: string, sale: SaleRecord) => {
    const target = pipelines.find((p) => p.id === pipelineId)
    if (!target) return
    const updatedSales = [...target.sales, sale]
    const updatedPipeline = { ...target, sales: updatedSales, updatedAt: new Date().toISOString() }
    const updatedAll = pipelines.map((p) => (p.id === pipelineId ? updatedPipeline : p))
    persist(updatedAll)
    setNotice({
      tone: 'success',
      text: `Sold ${sale.quantity} ${cleanUnitName(target.singleUnitLabel)}s of ${target.productName} for ${formatMoney(sale.quantity * sale.unitPrice, currency)}!`,
    })
    setQuickSellProduct(null)

    // Sync to POS / sales endpoint so it enters Sales Reports
    api.createPosSale({
      id: sale.id,
      date: sale.date || new Date().toISOString().slice(0, 10),
      customer: sale.customer || 'Walk-in',
      payment: (sale.payment as 'Cash' | 'Card' | 'Mobile Money' | 'Credit') || 'Cash',
      source: 'pipeline',
      allowFlexibleStock: true,
      items: [{
        sku: target.id,
        item: target.productName,
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        unit: cleanUnitName(target.singleUnitLabel),
      }],
    }).catch((err) => {
      console.warn('Could not sync pipeline sale to POS reports:', err)
    })
  }

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notice])

  return (
    <>
      <Topbar title="Production Pipeline" placeholder="Search pipelines..." theme={theme} toggleTheme={toggleTheme} />
      <main className="pipeline-page page-pad">
        {notice && <div className={`pipeline-notice ${notice.tone}`}>{notice.text}</div>}

        {activePipeline ? (
          <PipelineWorkspace
            businessTemplate={businessTemplate}
            pipeline={activePipeline}
            allPipelines={pipelines}
            currency={currency}
            onUpdate={updatePipeline}
            onAdvance={advanceStage}
            onGoToStage={goToStage}
            onBack={goBack}
            onNotice={setNotice}
            onCreateNew={createNew}
            onOpenPipeline={openPipeline}
            onQuickSell={(prod) => setQuickSellProduct(prod)}
            catalogProducts={catalogProducts}
            catalogIngredients={catalogIngredients}
            recordedUnits={recordedUnits}
            recipes={recipes}
            onOpenCatalog={() => setShowCatalogModal(true)}
            onAddProduct={() => setShowAddProductModal(true)}
            onAddIngredient={(cb) => {
              if (cb) setPendingAddIngredientCb(() => cb)
              setShowAddIngredientModal(true)
            }}
          />
        ) : (
          <PipelineList
            pipelines={pipelines}
            currency={currency}
            onOpen={openPipeline}
            onCreate={createNew}
            onDelete={deletePipeline}
            businessTemplate={businessTemplate}
            onQuickSell={(prod) => setQuickSellProduct(prod)}
            onOpenCatalog={() => setShowCatalogModal(true)}
            onAddProduct={() => setShowAddProductModal(true)}
            onAddIngredient={() => setShowAddIngredientModal(true)}
            catalogProductsCount={catalogProducts.length}
            catalogIngredientsCount={catalogIngredients.length}
          />
        )}

        {quickSellProduct && (
          <QuickSellModal
            product={quickSellProduct}
            currency={currency}
            onClose={() => setQuickSellProduct(null)}
            onConfirm={(sale) => handleQuickSale(quickSellProduct.pipeline.id, sale)}
          />
        )}

        {showAddProductModal && (
          <AddProductModal
            isOpen={showAddProductModal}
            units={recordedUnits}
            currency={currency}
            onClose={() => {
              setShowAddProductModal(false)
              setPendingAddProductCb(null)
            }}
            onSuccess={(item) => {
              setNotice({ tone: 'success', text: `Product "${item.item}" created and added to catalog!` })
              void refreshCatalog()
              if (pendingAddProductCb) {
                pendingAddProductCb(item)
                setPendingAddProductCb(null)
              }
            }}
          />
        )}

        {showAddIngredientModal && (
          <AddIngredientModal
            isOpen={showAddIngredientModal}
            units={recordedUnits}
            currency={currency}
            onClose={() => {
              setShowAddIngredientModal(false)
              setPendingAddIngredientCb(null)
            }}
            onSuccess={(item) => {
              setNotice({ tone: 'success', text: `Ingredient "${item.item}" created and added to catalog!` })
              void refreshCatalog()
              if (pendingAddIngredientCb) {
                pendingAddIngredientCb(item)
                setPendingAddIngredientCb(null)
              }
            }}
          />
        )}

        {showCatalogModal && (
          <CatalogManagerModal
            isOpen={showCatalogModal}
            products={catalogProducts}
            ingredients={catalogIngredients}
            currency={currency}
            onClose={() => setShowCatalogModal(false)}
            onAddProduct={() => {
              setShowCatalogModal(false)
              setShowAddProductModal(true)
            }}
            onAddIngredient={() => {
              setShowCatalogModal(false)
              setShowAddIngredientModal(true)
            }}
          />
        )}
      </main>
    </>
  )
}

/* ──────────────────────────────── Quick Sell Modal ──────────────────────────────── */

function QuickSellModal({
  product,
  currency,
  onClose,
  onConfirm,
}: {
  product: { pipeline: PipelineData; available: number; unitPrice: number }
  currency: string
  onClose: () => void
  onConfirm: (sale: SaleRecord) => void
}) {
  const [qty, setQty] = useState(1)
  const [unitPrice, setUnitPrice] = useState(product.unitPrice || product.pipeline.sellingPricePerUnit || 0)
  const [customer, setCustomer] = useState('')
  const [payment, setPayment] = useState<'Cash' | 'Mobile Money' | 'Card' | 'Credit'>('Cash')
  const unit = cleanUnitName(product.pipeline.singleUnitLabel)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (qty <= 0 || qty > product.available) return
    onConfirm({
      id: String(Date.now()),
      date: new Date().toISOString(),
      quantity: qty,
      unitPrice,
      customer: customer.trim() || 'Walk-in',
      payment,
    })
  }

  return (
    <div className="pipeline-modal-backdrop" onClick={onClose}>
      <div className="pipeline-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pipeline-modal-header">
          <h3>💰 Sell {product.pipeline.productName}</h3>
          <button type="button" className="pipeline-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="pipeline-modal-body">
          <div className="pipeline-modal-info-card">
            <span>Available in Stock:</span>
            <strong>{formatUnitQty(product.available, unit)}</strong>
          </div>

          <label className="pipeline-field">
            <span>Quantity to Sell ({unit}s)</span>
            <input
              type="number"
              min="1"
              max={product.available}
              value={qty}
              onChange={(e) => setQty(Math.min(product.available, Math.max(1, Number(e.target.value))))}
              required
            />
          </label>

          <label className="pipeline-field">
            <span>Unit Price ({currency})</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitPrice || ''}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              required
            />
          </label>

          <label className="pipeline-field">
            <span>Customer Name (optional)</span>
            <input
              type="text"
              placeholder="e.g. Walk-in customer, Table 4"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
          </label>

          <label className="pipeline-field">
            <span>Payment Method</span>
            <select value={payment} onChange={(e) => setPayment(e.target.value as any)}>
              <option value="Cash">Cash</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Card">Card</option>
              <option value="Credit">Credit (Pay Later)</option>
            </select>
          </label>

          <div className="pipeline-modal-info-card" style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)' }}>
            <span>Total Sale Amount:</span>
            <strong style={{ color: '#22c55e', fontSize: '18px' }}>{formatMoney(qty * unitPrice, currency)}</strong>
          </div>

          <div className="pipeline-modal-footer">
            <button type="button" className="pipeline-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="pipeline-btn-sell" style={{ padding: '10px 22px', fontSize: '14px' }}>
              Confirm Sale ({formatMoney(qty * unitPrice, currency)})
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ──────────────────────────────── Catalog Modals ──────────────────────────────── */

function AddProductModal({
  isOpen,
  units,
  currency,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  units: string[]
  currency: string
  onClose: () => void
  onSuccess: (item: ItemMaster) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Finished Goods')
  const [baseUnit, setBaseUnit] = useState(units[0] || 'piece')
  const [sellingPrice, setSellingPrice] = useState('0')
  const [minimumStock, setMinimumStock] = useState('5')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter the finished product name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const namePart = name.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
      const autoSku = `PRD-${namePart ? `${namePart}-` : ''}${Date.now().toString(36).toUpperCase()}`
      const created = await api.createMasterItem({
        item: name.trim(),
        sku: autoSku,
        category: category.trim() || 'Finished Goods',
        itemType: 'finished_product',
        baseUnit: cleanUnitName(baseUnit || 'piece'),
        sellingPrice: Number(sellingPrice) || 0,
        price: Number(sellingPrice) || 0,
        minimumStock: Number(minimumStock) || 0,
        description: description.trim(),
      })
      onSuccess(created)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pipeline-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="pipeline-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="pipeline-modal-header">
          <h2>📦 Add Finished Product to Catalog</h2>
          <button type="button" className="pipeline-btn-remove" onClick={onClose} title="Close">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="pipeline-modal-body">
            {error && <div className="pipeline-notice error" style={{ marginBottom: '14px' }}>{error}</div>}
            <div className="pipeline-modal-form-grid">
              <label className="pipeline-field full-width">
                <span>Product Name *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. African Tea, White Loaf, Corn Meal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="pipeline-field">
                <span>Category</span>
                <input
                  type="text"
                  placeholder="e.g. Beverages, Bakery, Milling"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>
              <label className="pipeline-field">
                <span>Output Unit * (Recorded)</span>
                <select value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)}>
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label className="pipeline-field">
                <span>Selling Price ({currency})</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                />
              </label>
              <label className="pipeline-field">
                <span>Minimum Alert Stock</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(e.target.value)}
                />
              </label>
              <label className="pipeline-field full-width">
                <span>Description / Notes</span>
                <input
                  type="text"
                  placeholder="Optional product description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="pipeline-modal-footer">
            <button type="button" className="pipeline-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="pipeline-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddIngredientModal({
  isOpen,
  units,
  currency,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  units: string[]
  currency: string
  onClose: () => void
  onSuccess: (item: ItemMaster) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Raw Materials')
  const [itemType, setItemType] = useState<'raw_material' | 'packaging_material'>('raw_material')
  const [baseUnit, setBaseUnit] = useState(units.includes('kg') ? 'kg' : (units[0] || 'piece'))
  const [purchasePrice, setPurchasePrice] = useState('0')
  const [minimumStock, setMinimumStock] = useState('10')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter the ingredient / raw material name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const namePart = name.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
      const autoSku = `ING-${namePart ? `${namePart}-` : ''}${Date.now().toString(36).toUpperCase()}`
      const created = await api.createMasterItem({
        item: name.trim(),
        sku: autoSku,
        category: category.trim() || (itemType === 'packaging_material' ? 'Packaging' : 'Raw Materials'),
        itemType,
        baseUnit: cleanUnitName(baseUnit || 'piece'),
        purchasePrice: Number(purchasePrice) || 0,
        price: Number(purchasePrice) || 0,
        minimumStock: Number(minimumStock) || 0,
        description: description.trim(),
      })
      onSuccess(created)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ingredient')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pipeline-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="pipeline-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="pipeline-modal-header">
          <h2>🌾 Add Ingredient / Material to Catalog</h2>
          <button type="button" className="pipeline-btn-remove" onClick={onClose} title="Close">✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="pipeline-modal-body">
            {error && <div className="pipeline-notice error" style={{ marginBottom: '14px' }}>{error}</div>}
            <div className="pipeline-modal-form-grid">
              <label className="pipeline-field full-width">
                <span>Ingredient / Material Name *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Black Tea Leaves, Whole Milk, White Sugar, Paper Cups"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="pipeline-field">
                <span>Requirement Type</span>
                <select value={itemType} onChange={(e) => setItemType(e.target.value as any)}>
                  <option value="raw_material">Raw Material / Ingredient</option>
                  <option value="packaging_material">Packaging / Container</option>
                </select>
              </label>
              <label className="pipeline-field">
                <span>Measurement Unit * (Recorded)</span>
                <select value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)}>
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label className="pipeline-field">
                <span>Purchase Cost ({currency})</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                />
              </label>
              <label className="pipeline-field">
                <span>Category</span>
                <input
                  type="text"
                  placeholder="e.g. Raw Materials, Spices, Packaging"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>
              <label className="pipeline-field">
                <span>Minimum Alert Stock</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={minimumStock}
                  onChange={(e) => setMinimumStock(e.target.value)}
                />
              </label>
              <label className="pipeline-field full-width">
                <span>Description / Notes</span>
                <input
                  type="text"
                  placeholder="Optional material specs or supplier info"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="pipeline-modal-footer">
            <button type="button" className="pipeline-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="pipeline-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Ingredient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CatalogManagerModal({
  isOpen,
  products,
  ingredients,
  currency,
  onClose,
  onAddProduct,
  onAddIngredient,
}: {
  isOpen: boolean
  products: ItemMaster[]
  ingredients: ItemMaster[]
  currency: string
  onClose: () => void
  onAddProduct: () => void
  onAddIngredient: () => void
}) {
  const [tab, setTab] = useState<'products' | 'ingredients'>('products')
  const [search, setSearch] = useState('')

  if (!isOpen) return null

  const items = tab === 'products' ? products : ingredients
  const filtered = items.filter((i) =>
    i.item.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="pipeline-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="pipeline-modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="pipeline-modal-header">
          <h2>📦 Products &amp; Ingredients Catalog</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="pipeline-btn-secondary"
              onClick={() => {
                onClose()
                if (tab === 'products') onAddProduct()
                else onAddIngredient()
              }}
            >
              + Add {tab === 'products' ? 'Product' : 'Ingredient'}
            </button>
            <button type="button" className="pipeline-btn-remove" onClick={onClose} title="Close">✕</button>
          </div>
        </div>
        <div className="pipeline-modal-body">
          <div className="pipeline-catalog-tabs">
            <button
              type="button"
              className={`pipeline-catalog-tab-btn ${tab === 'products' ? 'active' : ''}`}
              onClick={() => setTab('products')}
            >
              Finished Products ({products.length})
            </button>
            <button
              type="button"
              className={`pipeline-catalog-tab-btn ${tab === 'ingredients' ? 'active' : ''}`}
              onClick={() => setTab('ingredients')}
            >
              Ingredients &amp; Materials ({ingredients.length})
            </button>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <input
              type="search"
              placeholder={`Search ${tab === 'products' ? 'products' : 'ingredients'} by name, code, category...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--line)', color: '#fff' }}
            />
          </div>

          <div className="table-frame" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Code / SKU</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>{tab === 'products' ? 'Selling Price' : 'Purchase Cost'}</th>
                  <th>On Hand Stock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.sku}>
                    <td><strong>{item.item}</strong></td>
                    <td><code>{item.sku}</code></td>
                    <td>{item.category || '-'}</td>
                    <td><span className="pipeline-catalog-badge">{item.baseUnit}</span></td>
                    <td>{formatMoney(tab === 'products' ? (item.sellingPrice || item.price || 0) : (item.purchasePrice || 0), currency)}</td>
                    <td>{item.stock} {item.baseUnit}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-soft)' }}>
                      No {tab === 'products' ? 'products' : 'ingredients'} found. Click "+ Add {tab === 'products' ? 'Product' : 'Ingredient'}" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="pipeline-modal-footer">
          <button type="button" className="pipeline-btn-primary" onClick={onClose}>Close Catalog</button>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────── Finished Products Table ──────────────────────────────── */

function FinishedProductsTable({
  pipelines,
  currency,
  onOpenPipeline,
  onCreateNew,
  onSellProduct,
}: {
  pipelines: PipelineData[]
  currency: string
  onOpenPipeline: (id: string) => void
  onCreateNew: () => void
  onSellProduct: (prod: { pipeline: PipelineData; available: number; unitPrice: number }) => void
}) {
  const finishedItems = pipelines
    .filter((p) =>
      p.producedQuantity > 0 ||
      p.completedStages.includes('finish') ||
      ['finish', 'store_finished', 'sell', 'cost', 'analyze'].includes(p.currentStage)
    )
    .map((p) => {
      const totalSold = p.sales.reduce((sum, s) => sum + s.quantity, 0)
      const available = Math.max(0, (p.producedQuantity || p.targetQuantity) - totalSold)
      const unitPrice = p.sellingPricePerUnit || 0
      return {
        pipeline: p,
        totalSold,
        available,
        unitPrice,
        totalValue: available * unitPrice,
      }
    })

  if (finishedItems.length === 0) return null

  const totalFinishedProducts = finishedItems.length
  const totalUnitsAvailable = finishedItems.reduce((sum, item) => sum + item.available, 0)
  const totalStockValue = finishedItems.reduce((sum, item) => sum + item.totalValue, 0)

  return (
    <section className="pipeline-finished-section">
      <div className="pipeline-finished-header">
        <div>
          <h2>🏪 Finished Products Ready to Sell</h2>
          <p>All products that have finished production. Sell directly or plan another batch.</p>
        </div>
        <button className="pipeline-btn-primary" type="button" onClick={onCreateNew}>
          <span>+</span> Plan Another Product
        </button>
      </div>

      <div className="pipeline-finished-stats-row">
        <div className="pipeline-stat-pill">
          <span>Finished Products:</span>
          <strong>{totalFinishedProducts} items</strong>
        </div>
        <div className="pipeline-stat-pill success">
          <span>Available to Sell:</span>
          <strong>{totalUnitsAvailable} total units</strong>
        </div>
        <div className="pipeline-stat-pill">
          <span>Total Stock Value:</span>
          <strong>{formatMoney(totalStockValue, currency)}</strong>
        </div>
      </div>

      <div className="table-frame">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Produced</th>
              <th>Sold</th>
              <th>Available to Sell</th>
              <th>Unit Price</th>
              <th>Inventory Value</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {finishedItems.map(({ pipeline, totalSold, available, unitPrice, totalValue }) => {
              const unit = cleanUnitName(pipeline.singleUnitLabel)
              const isSoldOut = available <= 0
              const isLowStock = available > 0 && available <= 10

              return (
                <tr key={pipeline.id}>
                  <td>
                    <strong>{pipeline.productName || 'Untitled Product'}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pipeline.id}</div>
                  </td>
                  <td>
                    <span className="pipeline-preset-tag">
                      {BUSINESS_PRESETS.find((b) => b.value === pipeline.businessType)?.label || pipeline.businessType || 'General'}
                    </span>
                  </td>
                  <td>{formatUnitQty(pipeline.producedQuantity, unit)}</td>
                  <td>{formatUnitQty(totalSold, unit)}</td>
                  <td>
                    <strong style={{ color: isSoldOut ? '#ef4444' : isLowStock ? '#f59e0b' : '#22c55e', fontSize: '14px' }}>
                      {formatUnitQty(available, unit)}
                    </strong>
                  </td>
                  <td>{formatMoney(unitPrice, currency)}</td>
                  <td><strong>{formatMoney(totalValue, currency)}</strong></td>
                  <td>
                    {isSoldOut ? (
                      <span className="pipeline-stock-badge sold-out">Sold Out</span>
                    ) : isLowStock ? (
                      <span className="pipeline-stock-badge low-stock">Low Stock</span>
                    ) : (
                      <span className="pipeline-stock-badge in-stock">Ready to Sell</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="pipeline-btn-sell"
                        disabled={isSoldOut}
                        onClick={() => onSellProduct({ pipeline, available, unitPrice })}
                        title={isSoldOut ? 'No stock available' : `Sell ${pipeline.productName}`}
                      >
                        💰 Sell Now
                      </button>
                      <button
                        type="button"
                        className="pipeline-btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                        onClick={() => onOpenPipeline(pipeline.id)}
                      >
                        Open Pipeline →
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ──────────────────────────────── Pipeline List ──────────────────────────────── */

function PipelineList({
  pipelines,
  currency,
  onOpen,
  onCreate,
  onDelete,
  businessTemplate,
  onQuickSell,
  onOpenCatalog,
  onAddProduct,
  onAddIngredient,
  catalogProductsCount = 0,
  catalogIngredientsCount = 0,
}: {
  pipelines: PipelineData[]
  currency: string
  onOpen: (id: string) => void
  businessTemplate: string
  onCreate: () => void
  onDelete: (id: string) => void
  onQuickSell: (prod: { pipeline: PipelineData; available: number; unitPrice: number }) => void
  onOpenCatalog?: () => void
  onAddProduct?: () => void
  onAddIngredient?: () => void
  catalogProductsCount?: number
  catalogIngredientsCount?: number
}) {
  const activePipelines = pipelines.filter((p) => !p.completedStages.includes('analyze'))
  const completedPipelines = pipelines.filter((p) => p.completedStages.includes('analyze'))
  const detectedPreset = resolvePreset(businessTemplate)

  return (
    <section className="pipeline-list-section">
      <header className="pipeline-list-header">
        <div>
          <h1>Production Pipeline</h1>
          <p>Track multiple products from recipe planning to store &amp; sales{detectedPreset ? ` • ${detectedPreset.label}` : ''}</p>
        </div>
        <div className="pipeline-header-actions">
          {onOpenCatalog && (
            <button className="pipeline-btn-secondary" type="button" onClick={onOpenCatalog}>
              📦 Products &amp; Ingredients ({catalogProductsCount + catalogIngredientsCount})
            </button>
          )}
          {onAddProduct && (
            <button className="pipeline-btn-secondary" type="button" onClick={onAddProduct}>
              + Add Product
            </button>
          )}
          {onAddIngredient && (
            <button className="pipeline-btn-secondary" type="button" onClick={onAddIngredient}>
              + Add Ingredient
            </button>
          )}
          <button className="pipeline-btn-primary" type="button" onClick={onCreate}>
            <span>+</span> New Product Pipeline
          </button>
        </div>
      </header>

      {/* Finished Products Ready for Sale Table */}
      <FinishedProductsTable
        pipelines={pipelines}
        currency={currency}
        onOpenPipeline={onOpen}
        onCreateNew={onCreate}
        onSellProduct={onQuickSell}
      />

      {pipelines.length === 0 ? (
        <div className="pipeline-empty-state">
          <div className="pipeline-empty-icon">🏭</div>
          <h2>Start your first production pipeline</h2>
          <p>
            {detectedPreset && detectedPreset.value !== 'other'
              ? <>Your business is set up as <strong>{detectedPreset.label}</strong>. Define what goes into 1 {detectedPreset.unitLabel} of your product (such as tea or coffee), then tell us how many you want to produce. We will check your inventory, calculate shortages to purchase, and guide you through to selling.</>
              : <>Define what goes into a single unit of your product (1 cup of tea, 1 loaf of bread, 1 kg of flour), then tell us how many you want to produce. We'll check inventory shortages and guide you from planning to sales.</>
            }
          </p>
          {detectedPreset && detectedPreset.value !== 'other' && (
            <div className="pipeline-business-preview">
              <span className="pipeline-preset-tag">{detectedPreset.label}</span>
            </div>
          )}
          <button className="pipeline-btn-primary pipeline-btn-lg" type="button" onClick={onCreate}>
            Create your first pipeline
          </button>
        </div>
      ) : (
        <>
          {activePipelines.length > 0 && (
            <div className="pipeline-section">
              <h2 className="pipeline-section-title">🔄 In-Progress Production ({activePipelines.length})</h2>
              <div className="pipeline-card-grid">
                {activePipelines.map((p) => (
                  <PipelineCard key={p.id} pipeline={p} currency={currency} onOpen={onOpen} onDelete={onDelete} />
                ))}
              </div>
            </div>
          )}
          {completedPipelines.length > 0 && (
            <div className="pipeline-section">
              <h2 className="pipeline-section-title">✅ Completed Runs ({completedPipelines.length})</h2>
              <div className="pipeline-card-grid">
                {completedPipelines.map((p) => (
                  <PipelineCard key={p.id} pipeline={p} currency={currency} onOpen={onOpen} onDelete={onDelete} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function PipelineCard({ pipeline, currency, onOpen, onDelete }: {
  pipeline: PipelineData
  currency: string
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  const currentStageIdx = STAGES.findIndex((s) => s.id === pipeline.currentStage)
  const progress = ((pipeline.completedStages.length) / STAGES.length) * 100
  const currentStage = STAGES[currentStageIdx]
  const isComplete = pipeline.completedStages.includes('analyze')

  return (
    <article className={`pipeline-card ${isComplete ? 'completed' : ''}`} onClick={() => onOpen(pipeline.id)}>
      <div className="pipeline-card-header">
        <strong>{pipeline.productName || 'Untitled Product'}</strong>
        <span className="pipeline-card-id">{pipeline.id}</span>
      </div>
      <div className="pipeline-card-meta">
        {pipeline.businessType && <span className="pipeline-card-type">{BUSINESS_PRESETS.find((b) => b.value === pipeline.businessType)?.label || pipeline.businessType}</span>}
        <span>{pipeline.targetQuantity > 0 ? formatUnitQty(pipeline.targetQuantity, pipeline.singleUnitLabel) : 'Not planned'}</span>
      </div>
      <div className="pipeline-card-progress">
        <div className="pipeline-card-progress-bar">
          <div className="pipeline-card-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="pipeline-card-stage">
          {isComplete ? '✅ Complete' : `${currentStage?.icon} ${currentStage?.label}`}
        </span>
      </div>
      {pipeline.totalMaterialCost > 0 && (
        <div className="pipeline-card-cost">
          Materials: {formatMoney(pipeline.totalMaterialCost, currency)}
        </div>
      )}
      <div className="pipeline-card-footer">
        <small>Updated {new Date(pipeline.updatedAt).toLocaleDateString()}</small>
        <button
          className="pipeline-btn-danger-sm"
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(pipeline.id) }}
          title="Delete pipeline"
        >
          🗑️
        </button>
      </div>
    </article>
  )
}

/* ──────────────────────── Stage Role Banner & Audit Modal ──────────────────────── */

function StageRoleBanner({
  stage,
  executionMode = 'delegated',
  user,
}: {
  stage: PipelineStage
  executionMode?: PipelineExecutionMode
  user: { role?: string; shopRole?: string; username?: string } | null
}) {
  const rule = STAGE_ROLE_RULES[stage]
  if (!rule) return null

  const auth = canUserExecuteStage(stage, user, executionMode)
  const isAdmin = user?.role === 'admin' || user?.role === 'system_admin'
  const userRoleDisplay = user?.shopRole ? user.shopRole.replace(/_/g, ' ') : (user?.role || 'Staff')

  return (
    <div className="pipeline-stage-role-banner">
      <div className="pipeline-role-top">
        <div className="pipeline-role-tag">
          <span>{rule.icon}</span>
          <span>Responsible Role:</span>
          <span className="role-badge">{rule.primaryRoleName}</span>
        </div>

        <div
          className={`pipeline-auth-status ${
            isAdmin ? 'admin' : auth.allowed ? 'authorized' : 'restricted'
          }`}
        >
          {isAdmin ? (
            <>👑 Shop Administrator (Supervising)</>
          ) : auth.allowed ? (
            <>✅ Authorized ({user?.username} · {userRoleDisplay})</>
          ) : (
            <>⚠️ Restricted Access (Signed in as {userRoleDisplay})</>
          )}
        </div>
      </div>

      <p className="pipeline-role-desc">
        {rule.description}. {executionMode === 'delegated' ? 'Delegated to assigned operational department role.' : 'Directly executed under Solo Admin mode.'}
      </p>

      <div className="pipeline-role-alert-notice">
        <span>📧</span>
        <span>
          <strong>Admin Alert Active:</strong> Executing actions on this stage immediately registers an in-app notification and sends an email report to the shop administrator.
        </span>
      </div>

      {!auth.allowed && (
        <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>
          {auth.reason}
        </div>
      )}
    </div>
  )
}

function PipelineAuditModal({
  pipeline,
  onClose,
}: {
  pipeline: PipelineData
  onClose: () => void
}) {
  const logs = pipeline.activityLog || []

  return (
    <div className="pipeline-audit-modal" onClick={onClose}>
      <div className="pipeline-audit-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pipeline-audit-header">
          <div>
            <h3>📜 Stage Activities & Email Alerts Log</h3>
            <small style={{ color: 'var(--text-soft)' }}>
              Batch: <strong>{pipeline.productName || pipeline.id}</strong> ({logs.length} events logged)
            </small>
          </div>
          <button type="button" className="pipeline-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="pipeline-audit-list">
          {logs.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-soft)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
              <div>No activities logged yet for this production run.</div>
              <small>When workers or admins execute stages, notifications and email reports appear here.</small>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="pipeline-audit-card">
                <div className="pipeline-audit-card-top">
                  <span className="pipeline-audit-worker">
                    👤 {log.performedBy} <small>({log.performedByRole.replace(/_/g, ' ')})</small>
                  </span>
                  <span className="pipeline-audit-time">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(log.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="pipeline-audit-summary">{log.summary}</div>
                {log.details && <p>{log.details}</p>}
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      background: 'rgba(34,197,94,0.12)',
                      color: '#4ade80',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(34,197,94,0.25)',
                    }}
                  >
                    📧 Email Dispatched to Admin
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      background: 'rgba(99,102,241,0.12)',
                      color: '#a5b4fc',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(99,102,241,0.25)',
                    }}
                  >
                    🔔 System Notification Sent
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pipeline-audit-footer">
          <button type="button" className="pipeline-btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────── Pipeline Workspace ──────────────────────────────── */

function PipelineWorkspace({
  pipeline,
  allPipelines,
  currency,
  onUpdate,
  onAdvance,
  onGoToStage,
  onBack,
  onNotice,
  businessTemplate,
  onCreateNew,
  onOpenPipeline,
  onQuickSell,
  catalogProducts = [],
  catalogIngredients = [],
  recordedUnits = [],
  recipes = [],
  onOpenCatalog,
  onAddProduct,
  onAddIngredient,
}: {
  pipeline: PipelineData
  allPipelines: PipelineData[]
  currency: string
  onUpdate: (data: PipelineData) => void
  onAdvance: (pipeline: PipelineData) => void
  onGoToStage: (pipeline: PipelineData, stage: PipelineStage) => void
  onBack: () => void
  onNotice: (notice: { tone: 'success' | 'error' | 'info'; text: string }) => void
  businessTemplate: string
  onCreateNew: () => void
  onOpenPipeline: (id: string) => void
  onQuickSell: (prod: { pipeline: PipelineData; available: number; unitPrice: number }) => void
  catalogProducts?: ItemMaster[]
  catalogIngredients?: ItemMaster[]
  recordedUnits?: string[]
  recipes?: ProductionRecipe[]
  onOpenCatalog?: () => void
  onAddProduct?: () => void
  onAddIngredient?: (callback?: (newItem: ItemMaster) => void) => void
}) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'system_admin'
  const noRawMaterialsToStore = pipeline.totalIngredients.length > 0
    && pipeline.purchasedItems.length === pipeline.totalIngredients.length
    && pipeline.purchasedItems.every((item) => item.purchased && item.purchasedQuantity === 0)
  const skipRawMaterialsStorage = pipeline.rawMaterialsStored && noRawMaterialsToStore
  const visibleStages = STAGES.filter((stage) => !(skipRawMaterialsStorage && stage.id === 'store_raw'))
  const currentIdx = visibleStages.findIndex((s) => s.id === pipeline.currentStage)
  const [showFinishedDrawer, setShowFinishedDrawer] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)

  useEffect(() => {
    if (pipeline.currentStage !== 'store_raw' || !noRawMaterialsToStore) return

    const updated: PipelineData = {
      ...pipeline,
      rawMaterialsStored: true,
      completedStages: [...new Set([...pipeline.completedStages, 'store_raw' as PipelineStage])],
      currentStage: 'produce',
    }
    onUpdate(updated)
  }, [noRawMaterialsToStore, onUpdate, pipeline])

  const finishedCount = allPipelines.filter((p) =>
    p.producedQuantity > 0 || p.completedStages.includes('finish') || ['finish', 'store_finished', 'sell', 'cost', 'analyze'].includes(p.currentStage)
  ).length

  return (
    <div className="pipeline-workspace">
      <header className="pipeline-ws-header">
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="pipeline-btn-back" type="button" onClick={onBack}>← All Pipelines</button>
          <button className="pipeline-btn-secondary" type="button" onClick={onCreateNew}>
            <span>+</span> Plan Another Product
          </button>
          {onOpenCatalog && (
            <button className="pipeline-btn-secondary" type="button" onClick={onOpenCatalog}>
              📦 Products &amp; Ingredients
            </button>
          )}
          {onAddProduct && (
            <button className="pipeline-btn-secondary" type="button" onClick={onAddProduct}>
              + Add Product
            </button>
          )}
          {onAddIngredient && (
            <button className="pipeline-btn-secondary" type="button" onClick={() => onAddIngredient()}>
              + Add Ingredient
            </button>
          )}
          {finishedCount > 0 && (
            <button
              className="pipeline-btn-secondary"
              type="button"
              onClick={() => setShowFinishedDrawer((prev) => !prev)}
              style={{ background: showFinishedDrawer ? 'rgba(99,102,241,0.15)' : undefined }}
            >
              🏪 Finished Stock ({finishedCount})
            </button>
          )}
          <button
            className="pipeline-btn-secondary"
            type="button"
            onClick={() => setShowAuditModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            📜 Activities &amp; Alerts Log ({pipeline.activityLog?.length || 0})
          </button>
        </div>
        <div className="pipeline-ws-title">
          <h1>{pipeline.productName || 'New Pipeline'}</h1>
          <span className="pipeline-ws-id">{pipeline.id}</span>
        </div>
      </header>

      {/* Workflow Execution Mode Selection */}
      <div className="pipeline-mode-card">
        <div className="pipeline-mode-info">
          <span className="pipeline-mode-icon">{pipeline.executionMode === 'solo' ? '👑' : '👥'}</span>
          <div>
            <strong>Operational Workflow: {pipeline.executionMode === 'solo' ? 'All Processes (Solo Admin)' : 'Plan Only (Team Workflow)'}</strong>
            <p>
              {pipeline.executionMode === 'solo'
                ? 'Shop administrator manages and executes all production steps directly without delegating.'
                : 'Admin configures the plan; operational processes are assigned to worker roles with automated admin email & notification alerts.'}
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="pipeline-mode-switch-actions">
            <button
              type="button"
              className={`pipeline-mode-btn ${pipeline.executionMode !== 'solo' ? 'active' : ''}`}
              onClick={() => {
                onUpdate({ ...pipeline, executionMode: 'delegated' })
                onNotice({ tone: 'info', text: 'Switched to Team Workflow: stages assigned to operational roles with admin alerts.' })
              }}
            >
              👥 Team Workflow
            </button>
            <button
              type="button"
              className={`pipeline-mode-btn ${pipeline.executionMode === 'solo' ? 'active' : ''}`}
              onClick={() => {
                onUpdate({ ...pipeline, executionMode: 'solo' })
                onNotice({ tone: 'info', text: 'Switched to Solo Admin: shop admin executes all processes directly.' })
              }}
            >
              👑 Solo Admin
            </button>
          </div>
        )}
      </div>

      {/* Finished Products Drawer / Section if toggled */}
      {showFinishedDrawer && (
        <div style={{ marginBottom: '24px' }}>
          <FinishedProductsTable
            pipelines={allPipelines}
            currency={currency}
            onOpenPipeline={(id) => { setShowFinishedDrawer(false); onOpenPipeline(id) }}
            onCreateNew={onCreateNew}
            onSellProduct={onQuickSell}
          />
        </div>
      )}

      {/* Visual Pipeline Progress */}
      <nav className="pipeline-progress" aria-label="Pipeline stages">
        {visibleStages.map((stage, idx) => {
          const isCompleted = pipeline.completedStages.includes(stage.id)
          const isCurrent = pipeline.currentStage === stage.id
          const isAccessible = isCompleted || isCurrent || idx <= currentIdx
          return (
            <button
              key={stage.id}
              type="button"
              className={`pipeline-stage-node ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${!isAccessible ? 'locked' : ''}`}
              onClick={() => isAccessible && onGoToStage(pipeline, stage.id)}
              disabled={!isAccessible}
              title={stage.label}
            >
              <span className="pipeline-stage-icon">{isCompleted ? '✓' : stage.icon}</span>
              <span className="pipeline-stage-label">{stage.shortLabel}</span>
              {idx < visibleStages.length - 1 && <span className={`pipeline-stage-connector ${isCompleted ? 'completed' : ''}`} />}
            </button>
          )
        })}
      </nav>

      {/* Stage Content */}
      <section className="pipeline-stage-content">
        {!(pipeline.currentStage === 'store_raw' && noRawMaterialsToStore) && (
          <StageRoleBanner
            stage={pipeline.currentStage}
            executionMode={pipeline.executionMode || 'delegated'}
            user={user}
          />
        )}

        {pipeline.currentStage === 'plan' && (
          <PlanStage
            pipeline={pipeline}
            currency={currency}
            onUpdate={onUpdate}
            onAdvance={onAdvance}
            onNotice={onNotice}
            businessTemplate={businessTemplate}
            catalogProducts={catalogProducts}
            catalogIngredients={catalogIngredients}
            recordedUnits={recordedUnits}
            recipes={recipes}
            onOpenAddProduct={onAddProduct}
            onOpenAddIngredient={onAddIngredient}
          />
        )}
        {pipeline.currentStage === 'receive_plan' && (
          <ReceivePlanStage pipeline={pipeline} currency={currency} onAdvance={onAdvance} onGoBack={() => onGoToStage(pipeline, 'plan')} />
        )}
        {pipeline.currentStage === 'purchase' && (
          <PurchaseStage pipeline={pipeline} currency={currency} onUpdate={onUpdate} onAdvance={onAdvance} />
        )}
        {pipeline.currentStage === 'store_raw' && (
          noRawMaterialsToStore
            ? <p className="pipeline-auto-detect-banner">All required materials are already in stock. Skipping storage confirmation and moving to production.</p>
            : <StoreRawStage pipeline={pipeline} onUpdate={onUpdate} onAdvance={onAdvance} />
        )}
        {pipeline.currentStage === 'produce' && (
          <ProduceStage pipeline={pipeline} onUpdate={onUpdate} onAdvance={onAdvance} />
        )}
        {pipeline.currentStage === 'quality_check' && (
          <QualityCheckStage pipeline={pipeline} onUpdate={onUpdate} onAdvance={onAdvance} />
        )}
        {pipeline.currentStage === 'finish' && (
          <FinishStage
            pipeline={pipeline}
            currency={currency}
            onAdvance={onAdvance}
            onCreateNext={onCreateNew}
          />
        )}
        {pipeline.currentStage === 'store_finished' && (
          <StoreFinishedStage pipeline={pipeline} onUpdate={onUpdate} onAdvance={onAdvance} />
        )}
        {pipeline.currentStage === 'sell' && (
          <SellStage
            pipeline={pipeline}
            allPipelines={allPipelines}
            currency={currency}
            onUpdate={onUpdate}
            onAdvance={onAdvance}
            onQuickSell={onQuickSell}
          />
        )}
        {pipeline.currentStage === 'cost' && (
          <CostStage pipeline={pipeline} currency={currency} onAdvance={onAdvance} />
        )}
        {pipeline.currentStage === 'analyze' && (
          <AnalyzeStage pipeline={pipeline} currency={currency} onUpdate={onUpdate} onCreateNext={onCreateNew} />
        )}
      </section>

      {/* Audit Modal */}
      {showAuditModal && (
        <PipelineAuditModal pipeline={pipeline} onClose={() => setShowAuditModal(false)} />
      )}
    </div>
  )
}

/* ──────────────────────────── Stage Components ──────────────────────────── */

/* ─── 1. PLAN ─── */
function PlanStage({
  pipeline,
  currency,
  onUpdate,
  onAdvance,
  onNotice,
  businessTemplate,
  catalogProducts = [],
  catalogIngredients = [],
  recordedUnits = [],
  recipes = [],
  onOpenAddProduct,
  onOpenAddIngredient,
}: {
  pipeline: PipelineData
  currency: string
  onUpdate: (data: PipelineData) => void
  onAdvance: (pipeline: PipelineData) => void
  onNotice: (notice: { tone: 'success' | 'error' | 'info'; text: string }) => void
  businessTemplate: string
  catalogProducts?: ItemMaster[]
  catalogIngredients?: ItemMaster[]
  recordedUnits?: string[]
  recipes?: ProductionRecipe[]
  onOpenAddProduct?: () => void
  onOpenAddIngredient?: (callback?: (newItem: ItemMaster) => void) => void
}) {
  const detectedPreset = resolvePreset(businessTemplate)
  const defaultUnits = ['piece', 'kg', 'g', 'litre', 'ml', 'cup', 'plate', 'box', 'bag', 'hour', 'batch', 'unit']
  const availableUnits = Array.from(new Set([...recordedUnits, ...defaultUnits].map((u) => cleanUnitName(u)).filter(Boolean)))

  const [selectedProductSku, setSelectedProductSku] = useState(() => {
    const match = catalogProducts.find((p) => p.item.toLowerCase() === pipeline.productName.toLowerCase())
    return match ? match.sku : (pipeline.productName ? '__custom__' : '')
  })
  const [productName, setProductName] = useState(pipeline.productName)
  const [businessType] = useState(pipeline.businessType || detectedPreset?.value || 'other')
  const [singleUnitLabel, setSingleUnitLabel] = useState(
    pipeline.singleUnitLabel && pipeline.singleUnitLabel !== 'unit' && pipeline.singleUnitLabel !== '1 unit'
      ? cleanUnitName(pipeline.singleUnitLabel)
      : (detectedPreset?.unitLabel || 'unit')
  )
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    if (pipeline.ingredients.length > 0) return pipeline.ingredients
    if (detectedPreset && detectedPreset.ingredients.length > 0) {
      return detectedPreset.ingredients.map((ing, idx) => ({ ...ing, id: String(idx + 1) }))
    }
    return []
  })
  const [targetQuantity, setTargetQuantity] = useState(pipeline.targetQuantity || 100)
  const [scheduledDate, setScheduledDate] = useState(pipeline.scheduledDate || new Date().toISOString().slice(0, 10))
  const [sellingPrice, setSellingPrice] = useState(pipeline.sellingPricePerUnit)

  // Sync product selection if catalog loads or changes
  useEffect(() => {
    if (pipeline.productName && !selectedProductSku && catalogProducts.length > 0) {
      const match = catalogProducts.find((p) => p.item.toLowerCase() === pipeline.productName.toLowerCase())
      setSelectedProductSku(match ? match.sku : '__custom__')
    }
  }, [catalogProducts, pipeline.productName, selectedProductSku])

  const handleProductSelect = (sku: string) => {
    setSelectedProductSku(sku)
    if (!sku || sku === '__custom__') return

    const product = catalogProducts.find((p) => p.sku === sku)
    if (!product) return

    setProductName(product.item)
    if (product.baseUnit) {
      setSingleUnitLabel(cleanUnitName(product.baseUnit))
    }
    if (product.sellingPrice || product.price) {
      setSellingPrice(Number(product.sellingPrice || product.price || 0))
    }

    // Auto-load recipe if available in recorded recipes
    const matchingRecipe = recipes.find(
      (r) => r.productSku === product.sku || r.productName.toLowerCase() === product.item.toLowerCase()
    )
    if (matchingRecipe && matchingRecipe.materials && matchingRecipe.materials.length > 0) {
      const recipeYield = matchingRecipe.yieldQuantity || 1
      const mappedIngredients: Ingredient[] = matchingRecipe.materials.map((m, idx) => ({
        id: String(idx + 1),
        name: m.item,
        quantity: Number((m.quantity / recipeYield).toFixed(4)),
        unit: cleanUnitName(m.unit || 'unit'),
        unitCost: 0,
      }))
      setIngredients(mappedIngredients)
      onNotice({
        tone: 'info',
        text: `Loaded recorded recipe materials for ${product.item}.`,
      })
    }
  }

  const handleSelectIngredientRow = (id: string, sku: string) => {
    if (!sku) {
      updateIngredient(id, 'name', '')
      return
    }
    if (sku === '__custom__') {
      return
    }
    const item = catalogIngredients.find((i) => i.sku === sku)
    if (item) {
      setIngredients((curr) =>
        curr.map((i) =>
          i.id === id
            ? {
                ...i,
                name: item.item,
                unit: cleanUnitName(item.baseUnit || 'piece'),
                unitCost: Number(item.purchasePrice || 0),
              }
            : i
        )
      )
    }
  }

  const addIngredient = () => {
    setIngredients([...ingredients, { id: String(Date.now()), name: '', quantity: 0, unit: availableUnits[0] || 'unit', unitCost: 0 }])
  }

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter((i) => i.id !== id))
  }

  const updateIngredient = (id: string, field: keyof Ingredient, value: string | number) => {
    setIngredients(ingredients.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  const unitCostPerProduct = ingredients.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!productName.trim()) {
      onNotice({ tone: 'error', text: 'Enter a product name (e.g. Milk Tea or American Tea).' })
      return
    }
    if (ingredients.length === 0) {
      onNotice({ tone: 'error', text: 'Add at least one ingredient or material.' })
      return
    }
    if (targetQuantity <= 0) {
      onNotice({ tone: 'error', text: 'Enter a production quantity greater than zero.' })
      return
    }
    const validIngredients = ingredients.filter((i) => i.name.trim() && i.quantity > 0)
    if (validIngredients.length === 0) {
      onNotice({ tone: 'error', text: 'Fill in ingredient names and quantities.' })
      return
    }

    const totalIngredients = validIngredients.map((i) => ({
      ...i,
      totalQuantity: i.quantity * targetQuantity,
      totalCost: i.quantity * i.unitCost * targetQuantity,
    }))
    const totalMaterialCost = totalIngredients.reduce((sum, i) => sum + i.totalCost, 0)

    const updated: PipelineData = {
      ...pipeline,
      productName: productName.trim(),
      businessType,
      singleUnitLabel: cleanUnitName(singleUnitLabel),
      ingredients: validIngredients,
      targetQuantity,
      scheduledDate,
      sellingPricePerUnit: sellingPrice,
      totalIngredients,
      totalMaterialCost,
      purchasedItems: validIngredients.map((i) => ({
        ingredientId: i.id,
        purchased: false,
        purchasedQuantity: i.quantity * targetQuantity,
        actualCost: i.quantity * i.unitCost * targetQuantity,
        surplusQuantity: 0,
      })),
    }

    onUpdate(updated)
    onAdvance(updated)
  }

  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 1 of 11</span>
        <h2>📋 Production Plan</h2>
        <p>Define the single-item recipe, materials &amp; packaging. Select from recorded shop products and ingredients, or add new ones.</p>
      </div>

      <form className="pipeline-form" onSubmit={handleSubmit}>
        {detectedPreset && detectedPreset.value !== 'other' && (
          <div className="pipeline-auto-detect-banner">
            <span>{detectedPreset.label}</span>
            <small>Business type detected from settings. Enter your recipe per 1 {cleanUnitName(singleUnitLabel)} below.</small>
          </div>
        )}

        <div className="pipeline-form-row">
          <label className="pipeline-field">
            <div className="pipeline-field-label-row">
              <span>Select Recorded Product</span>
              {onOpenAddProduct && (
                <button type="button" className="pipeline-link-btn" onClick={onOpenAddProduct}>
                  + Add Product to Catalog
                </button>
              )}
            </div>
            <select
              value={selectedProductSku}
              onChange={(e) => handleProductSelect(e.target.value)}
              style={{ colorScheme: 'dark', backgroundColor: '#162033', color: '#f1f5f9' }}
            >
              <option value="" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>-- Choose from recorded catalog products --</option>
              {catalogProducts.map((p) => (
                <option key={p.sku} value={p.sku} style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>
                  {p.item} ({p.sku}) • {p.baseUnit} • {formatMoney(p.sellingPrice || p.price || 0, currency)}
                </option>
              ))}
              <option value="__custom__" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>✏️ Custom / Write product name manually</option>
            </select>
          </label>

          <label className="pipeline-field">
            <span>Finished Product Name *</span>
            <input
              type="text"
              value={productName}
              onChange={(e) => {
                setProductName(e.target.value)
                if (selectedProductSku !== '__custom__') setSelectedProductSku('__custom__')
              }}
              placeholder="e.g. African Tea, American Tea, White Bread"
              required
            />
          </label>
        </div>

        <div className="pipeline-form-row">
          <label className="pipeline-field">
            <span>Unit of measurement * (Recorded)</span>
            <select
              value={singleUnitLabel}
              onChange={(e) => setSingleUnitLabel(cleanUnitName(e.target.value))}
              required
              style={{ colorScheme: 'dark', backgroundColor: '#162033', color: '#f1f5f9' }}
            >
              {!availableUnits.includes(cleanUnitName(singleUnitLabel)) && singleUnitLabel && (
                <option value={cleanUnitName(singleUnitLabel)} style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>{cleanUnitName(singleUnitLabel)}</option>
              )}
              {availableUnits.map((u) => (
                <option key={u} value={u} style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>{u}</option>
              ))}
            </select>
          </label>
          <label className="pipeline-field">
            <span>Selling price per {cleanUnitName(singleUnitLabel)} ({currency})</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice || ''}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
              placeholder="e.g. 500"
            />
          </label>
        </div>

        {/* Single Item Recipe */}
        <fieldset className="pipeline-fieldset">
          <legend>Recipe &amp; Materials for 1 {cleanUnitName(singleUnitLabel)}</legend>
          <p className="pipeline-field-desc">
            Enter all ingredients, packaging, and materials needed to make just <strong>one single {cleanUnitName(singleUnitLabel)}</strong>. Select from recorded ingredients below.
          </p>

          <div className="pipeline-ingredients-table">
            <div className="pipeline-ing-header">
              <span>Ingredient / Material (Recorded)</span>
              <span>Qty per 1 {cleanUnitName(singleUnitLabel)}</span>
              <span>Unit (Recorded)</span>
              <span>Cost ({currency})</span>
              <span />
            </div>

            {ingredients.map((ing) => {
              const matchedCatalogItem = catalogIngredients.find(
                (item) => item.item.toLowerCase().trim() === ing.name.toLowerCase().trim()
              )
              const currentSkuValue = matchedCatalogItem ? matchedCatalogItem.sku : (ing.name ? '__custom__' : '')

              return (
                <div key={ing.id} className="pipeline-ing-row">
                  <div className="pipeline-ing-select-wrap">
                    <select
                      value={currentSkuValue}
                      onChange={(e) => handleSelectIngredientRow(ing.id, e.target.value)}
                      style={{ colorScheme: 'dark', backgroundColor: '#162033', color: '#f1f5f9' }}
                    >
                      <option value="" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>-- Select recorded ingredient --</option>
                      {catalogIngredients.map((item) => (
                        <option key={item.sku} value={item.sku} style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>
                          {item.item} ({item.baseUnit || 'unit'}) • {formatMoney(item.purchasePrice || 0, currency)}
                        </option>
                      ))}
                      <option value="__custom__" style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>✏️ Custom / Write manually</option>
                    </select>
                    {(!currentSkuValue || currentSkuValue === '__custom__') && (
                      <input
                        type="text"
                        value={ing.name}
                        onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)}
                        placeholder="e.g. Tea leaves, Milk, Cups"
                        required
                      />
                    )}
                  </div>
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={ing.quantity || ''}
                    onChange={(e) => updateIngredient(ing.id, 'quantity', Number(e.target.value))}
                    placeholder="Qty"
                    required
                  />
                  <select
                    value={cleanUnitName(ing.unit || 'unit')}
                    onChange={(e) => updateIngredient(ing.id, 'unit', cleanUnitName(e.target.value))}
                    required
                    style={{ colorScheme: 'dark', backgroundColor: '#162033', color: '#f1f5f9' }}
                  >
                    {!availableUnits.includes(cleanUnitName(ing.unit)) && ing.unit && (
                      <option value={cleanUnitName(ing.unit)} style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>{cleanUnitName(ing.unit)}</option>
                    )}
                    {availableUnits.map((u) => (
                      <option key={u} value={u} style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}>{u}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ing.unitCost || ''}
                    onChange={(e) => updateIngredient(ing.id, 'unitCost', Number(e.target.value))}
                    placeholder="Cost"
                  />
                  <button
                    type="button"
                    className="pipeline-btn-remove"
                    onClick={() => removeIngredient(ing.id)}
                    title="Remove ingredient"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          <div className="pipeline-ing-actions-row">
            <button className="pipeline-btn-add" type="button" onClick={addIngredient}>
              + Add Ingredient Row
            </button>
            {onOpenAddIngredient && (
              <button
                className="pipeline-btn-secondary"
                type="button"
                onClick={() =>
                  onOpenAddIngredient((newItem) => {
                    setIngredients((current) => [
                      ...current,
                      {
                        id: String(Date.now()),
                        name: newItem.item,
                        quantity: 1,
                        unit: cleanUnitName(newItem.baseUnit || 'piece'),
                        unitCost: Number(newItem.purchasePrice || 0),
                      },
                    ])
                  })
                }
              >
                🌾 + Add New Ingredient to Catalog
              </button>
            )}
          </div>

          {ingredients.length > 0 && unitCostPerProduct > 0 && (
            <div className="pipeline-unit-cost-preview">
              Material cost per {cleanUnitName(singleUnitLabel)}: <strong>{formatMoney(unitCostPerProduct, currency)}</strong>
            </div>
          )}
        </fieldset>

        {/* Target quantity */}
        <div className="pipeline-form-row">
          <label className="pipeline-field">
            <span>How many {cleanUnitName(singleUnitLabel)}s to produce?</span>
            <input
              type="number"
              min="1"
              step="1"
              value={targetQuantity || ''}
              onChange={(e) => setTargetQuantity(Number(e.target.value))}
              placeholder="e.g. 100"
              required
            />
          </label>
          <label className="pipeline-field">
            <span>Planned Production Date</span>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </label>
          <label className="pipeline-field">
            <span>Selling price per {cleanUnitName(singleUnitLabel)} ({currency})</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice || ''}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
              placeholder="e.g. 500"
            />
          </label>
        </div>

        {targetQuantity > 0 && ingredients.length > 0 && (
          <div className="pipeline-preview-box">
            <h3>Quick Preview</h3>
            <div className="pipeline-preview-stats">
              <div>
                <span>Total output</span>
                <strong>{formatUnitQty(targetQuantity, singleUnitLabel)}</strong>
              </div>
              <div>
                <span>Total material cost</span>
                <strong>{formatMoney(unitCostPerProduct * targetQuantity, currency)}</strong>
              </div>
              {sellingPrice > 0 && (
                <div>
                  <span>Expected revenue</span>
                  <strong>{formatMoney(sellingPrice * targetQuantity, currency)}</strong>
                </div>
              )}
              {sellingPrice > 0 && (
                <div>
                  <span>Expected gross profit</span>
                  <strong className={sellingPrice * targetQuantity - unitCostPerProduct * targetQuantity > 0 ? 'profit-positive' : 'profit-negative'}>
                    {formatMoney(sellingPrice * targetQuantity - unitCostPerProduct * targetQuantity, currency)}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pipeline-form-actions">
          <button className="pipeline-btn-primary pipeline-btn-lg" type="submit">
            Calculate Batch & Review Plan →
          </button>
        </div>
      </form>
    </div>
  )
}

/* ─── 2. RECEIVE PLAN ─── */
function ReceivePlanStage({ pipeline, currency, onAdvance, onGoBack }: {
  pipeline: PipelineData
  currency: string
  onAdvance: (pipeline: PipelineData) => void
  onGoBack: () => void
}) {
  const [inventory, setInventory] = useState<InventoryRow[]>([])

  useEffect(() => {
    let active = true
    api.inventory(1000)
      .then((res) => { if (active) setInventory(res.rows || (res as any).items || []) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const stockAssessment = pipeline.totalIngredients.map((ing) => {
    const matched = findMatchingInventoryItem(ing.name, inventory)
    const inStock = matched ? Number(matched.rawStock || 0) : 0
    const needed = ing.totalQuantity
    const shortage = Math.max(0, needed - inStock)
    return { ...ing, inStock, shortage, matched }
  })

  const inStockCount = stockAssessment.filter((s) => s.shortage === 0).length
  const shortageCount = stockAssessment.filter((s) => s.shortage > 0).length

  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 2 of 11</span>
        <h2>📥 Receive & Review Plan</h2>
        <p>Review the calculated production plan for <strong>{pipeline.productName}</strong>.</p>
      </div>

      <div className="pipeline-plan-summary">
        <div className="pipeline-summary-grid">
          <div className="pipeline-summary-card highlight">
            <span>Product</span>
            <strong>{pipeline.productName}</strong>
          </div>
          <div className="pipeline-summary-card">
            <span>Target Output</span>
            <strong>{formatUnitQty(pipeline.targetQuantity, pipeline.singleUnitLabel)}</strong>
          </div>
          <div className="pipeline-summary-card">
            <span>Recipe items</span>
            <strong>{pipeline.ingredients.length} materials</strong>
          </div>
          <div className="pipeline-summary-card">
            <span>Scheduled Date</span>
            <strong>{pipeline.scheduledDate}</strong>
          </div>
          <div className="pipeline-summary-card cost-card">
            <span>Total Material Cost</span>
            <strong>{formatMoney(pipeline.totalMaterialCost, currency)}</strong>
          </div>
          <div className="pipeline-summary-card">
            <span>Cost per Unit</span>
            <strong>{formatMoney(pipeline.totalMaterialCost / (pipeline.targetQuantity || 1), currency)}</strong>
          </div>
          {pipeline.sellingPricePerUnit > 0 && (
            <>
              <div className="pipeline-summary-card">
                <span>Selling Price</span>
                <strong>{formatMoney(pipeline.sellingPricePerUnit, currency)}</strong>
              </div>
              <div className="pipeline-summary-card profit-card">
                <span>Expected Profit</span>
                <strong>{formatMoney((pipeline.sellingPricePerUnit * pipeline.targetQuantity) - pipeline.totalMaterialCost, currency)}</strong>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inventory Stock Assessment Banner */}
      <div className="pipeline-inventory-check-box">
        <div className="pipeline-inventory-check-header">
          <h3>📦 Warehouse Inventory Readiness Check</h3>
          <div>
            <span className="pipeline-shortage-badge ok">{inStockCount} in stock</span>
            {shortageCount > 0 && (
              <span className="pipeline-shortage-badge short" style={{ marginLeft: '6px' }}>{shortageCount} shortages to buy</span>
            )}
          </div>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-soft)', margin: '0 0 12px' }}>
          {shortageCount === 0
            ? '✅ All required materials are already available in your store stock. No purchases needed!'
            : `⚠️ You need to purchase ${shortageCount} materials before production. Stock shortages will be calculated in Step 3.`
          }
        </p>
      </div>

      <div className="pipeline-requirements-table">
        <h3>Total Materials Required for Batch</h3>
        <div className="table-frame">
          <table>
            <thead>
              <tr>
                <th>Ingredient / Material</th>
                <th>Per 1 {cleanUnitName(pipeline.singleUnitLabel)}</th>
                <th>Total Needed (×{pipeline.targetQuantity})</th>
                <th>Unit</th>
                <th>Unit Cost</th>
                <th>Est. Total</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.totalIngredients.map((ing) => (
                <tr key={ing.id}>
                  <td><strong>{ing.name}</strong></td>
                  <td>{ing.quantity}</td>
                  <td><strong>{ing.totalQuantity.toLocaleString()}</strong></td>
                  <td>{ing.unit}</td>
                  <td>{formatMoney(ing.unitCost, currency)}</td>
                  <td><strong>{formatMoney(ing.totalCost, currency)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}><strong>Total Material Budget</strong></td>
                <td><strong>{formatMoney(pipeline.totalMaterialCost, currency)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="pipeline-form-actions">
        <button type="button" className="pipeline-btn-secondary" onClick={onGoBack}>← Edit Plan</button>
        <button type="button" className="pipeline-btn-primary pipeline-btn-lg" onClick={() => onAdvance(pipeline)}>
          Accept Plan & Check Shortages to Purchase →
        </button>
      </div>
    </div>
  )
}

/* ─── 3. PURCHASE (INVENTORY SHORTAGE CHECK) ─── */
function PurchaseStage({ pipeline, currency, onUpdate, onAdvance }: {
  pipeline: PipelineData
  currency: string
  onUpdate: (data: PipelineData) => void
  onAdvance: (pipeline: PipelineData) => void
}) {
  const [items, setItems] = useState(pipeline.purchasedItems)
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loadingInv, setLoadingInv] = useState(true)

  useEffect(() => {
    let active = true
    api.inventory(1000)
      .then((res) => {
        if (active) {
          setInventory(res.rows || (res as any).items || [])
          setLoadingInv(false)
        }
      })
      .catch(() => {
        if (active) setLoadingInv(false)
      })
    return () => { active = false }
  }, [])

  // Calculate in-stock, shortages, and user-editable purchase quantities (can buy extra for buffer)
  const ingredientStatus = pipeline.totalIngredients.map((ing) => {
    const matched = findMatchingInventoryItem(ing.name, inventory)
    const inStock = matched ? Number(matched.rawStock || 0) : 0
    const needed = ing.totalQuantity
    const shortage = Math.max(0, needed - inStock)
    const purchaseItem = items.find((i) => i.ingredientId === ing.id)

    // User can customize quantity to buy (can be more than shortage for warehouse buffer)
    const qtyToBuy = purchaseItem && typeof purchaseItem.purchasedQuantity === 'number'
      ? purchaseItem.purchasedQuantity
      : shortage

    const surplus = Math.max(0, qtyToBuy - shortage)
    const estCost = qtyToBuy * ing.unitCost

    const isPurchased = shortage === 0 || Boolean(purchaseItem?.purchased)
    const actualCost = purchaseItem && typeof purchaseItem.actualCost === 'number'
      ? purchaseItem.actualCost
      : (shortage === 0 ? 0 : estCost)

    return {
      ...ing,
      matched,
      inStock,
      shortage,
      qtyToBuy,
      surplus,
      estCost,
      isPurchased,
      actualCost,
    }
  })

  const updateQtyToBuy = (ingredientId: string, qty: number) => {
    const cleanQty = Math.max(0, isNaN(qty) ? 0 : qty)
    const ing = pipeline.totalIngredients.find((i) => i.id === ingredientId)
    const newCost = ing ? cleanQty * ing.unitCost : 0

    const updated = items.some((i) => i.ingredientId === ingredientId)
      ? items.map((i) => (i.ingredientId === ingredientId ? {
          ...i,
          purchasedQuantity: cleanQty,
          actualCost: newCost,
          purchased: cleanQty > 0 ? i.purchased : true,
        } : i))
      : [...items, { ingredientId, purchased: cleanQty === 0, purchasedQuantity: cleanQty, actualCost: newCost }]

    setItems(updated)
  }

  const togglePurchased = (ingredientId: string) => {
    const current = ingredientStatus.find((s) => s.id === ingredientId)
    const nextPurchased = !current?.isPurchased
    const nextCost = nextPurchased ? (current?.actualCost || current?.estCost || 0) : 0

    const updated = items.some((i) => i.ingredientId === ingredientId)
      ? items.map((i) => (i.ingredientId === ingredientId ? { ...i, purchased: nextPurchased, actualCost: nextCost } : i))
      : [...items, { ingredientId, purchased: nextPurchased, purchasedQuantity: current?.qtyToBuy || 0, actualCost: nextCost }]

    setItems(updated)
  }

  const updateActualCost = (ingredientId: string, cost: number) => {
    const current = ingredientStatus.find((s) => s.id === ingredientId)
    const updated = items.some((i) => i.ingredientId === ingredientId)
      ? items.map((i) => (i.ingredientId === ingredientId ? { ...i, actualCost: cost, purchased: true } : i))
      : [...items, { ingredientId, purchased: true, purchasedQuantity: current?.qtyToBuy || 0, actualCost: cost }]

    setItems(updated)
  }

  // Reset to exact command shortages
  const resetToExactShortages = () => {
    const updated = pipeline.totalIngredients.map((ing) => {
      const match = ingredientStatus.find((s) => s.id === ing.id)
      const shortage = match?.shortage || 0
      return {
        ingredientId: ing.id,
        purchased: shortage === 0,
        purchasedQuantity: shortage,
        actualCost: shortage * ing.unitCost,
        surplusQuantity: 0,
      }
    })
    setItems(updated)
  }

  // Auto-fulfill in-stock items
  const fulfillInStock = () => {
    const updated = pipeline.totalIngredients.map((ing) => {
      const match = ingredientStatus.find((s) => s.id === ing.id)
      const isAlreadyInStock = match && match.shortage === 0
      const existing = items.find((i) => i.ingredientId === ing.id)
      if (isAlreadyInStock) {
        return { ingredientId: ing.id, purchased: true, purchasedQuantity: 0, actualCost: 0, surplusQuantity: 0 }
      }
      const qty = existing && typeof existing.purchasedQuantity === 'number' ? existing.purchasedQuantity : (match?.shortage || 0)
      return existing || { ingredientId: ing.id, purchased: false, purchasedQuantity: qty, actualCost: qty * ing.unitCost, surplusQuantity: 0 }
    })
    setItems(updated)
  }

  const allFulfilled = ingredientStatus.every((s) => s.isPurchased)
  const shortagesCount = ingredientStatus.filter((s) => s.shortage > 0).length
  const inStockCount = ingredientStatus.filter((s) => s.shortage === 0).length
  const allMaterialsInStock = !loadingInv && shortagesCount === 0
  const totalSurplusUnits = allMaterialsInStock ? 0 : ingredientStatus.reduce((sum, s) => sum + s.surplus, 0)
  const totalActualCost = allMaterialsInStock ? 0 : items.reduce((sum, item) => sum + item.actualCost, 0)

  const handleProceed = async () => {
    const finalItems = pipeline.totalIngredients.map((ing) => {
      const current = items.find((i) => i.ingredientId === ing.id)
      const st = ingredientStatus.find((s) => s.id === ing.id)
      const qtyToBuy = allMaterialsInStock ? 0 : (st?.qtyToBuy ?? (st?.shortage || 0))
      const surplus = allMaterialsInStock ? 0 : (st?.surplus ?? 0)
      return {
        ingredientId: ing.id,
        purchased: allMaterialsInStock || (current ? current.purchased : (st?.shortage === 0)),
        purchasedQuantity: qtyToBuy,
        actualCost: allMaterialsInStock ? 0 : (current ? current.actualCost : (qtyToBuy * ing.unitCost)),
        surplusQuantity: surplus,
      }
    })
    const updated = {
      ...pipeline,
      purchasedItems: finalItems,
      rawMaterialsStored: allMaterialsInStock,
    }
    onUpdate(updated)

    // ── Backend sync: create a Purchase record and update Inventory for each item actually bought ──
    const ref = `PIPE-${pipeline.id}-PURCHASE`

    for (const ing of pipeline.totalIngredients) {
      const finalItem = finalItems.find((fi) => fi.ingredientId === ing.id)
      if (!finalItem) continue
      const qtyBought = finalItem.purchasedQuantity ?? 0
      if (qtyBought <= 0) continue  // nothing to buy for this ingredient (already in stock)

      const actualCost = finalItem.actualCost ?? 0
      const unitPrice = qtyBought > 0 ? actualCost / qtyBought : ing.unitCost
      const ingSku = `ING-${ing.name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 15)}`

      // 1. Create a Purchase record so it appears in the Purchases ledger
      api.createPurchase({
        item: ing.name,
        contactName: 'Production Pipeline',
        phone: '',
        reference: `${ref}-${ing.id}`,
        category: 'Production Material',
        quantity: String(qtyBought),
        unitPrice: String(unitPrice.toFixed(2)),
        inventoryPrice: String(unitPrice.toFixed(2)),
        total: String(actualCost.toFixed(2)),
        sku: ingSku,
        extractedText: `Auto-created by Production Pipeline for ${pipeline.productName} (${pipeline.id}). Batch needs ${ing.totalQuantity} ${ing.unit}. Purchased: ${qtyBought} ${ing.unit}. Surplus/buffer: ${finalItem.surplusQuantity ?? 0} ${ing.unit}.`,
        payment: 'Cash',
      }).catch(() => {
        // Non-blocking — local state is already saved
      })

      // 2. Create / update Inventory row so stock reflects the new purchase
      api.createInventoryImport({
        item: ing.name,
        sku: ingSku,
        category: 'Production Material',
        stock: String(qtyBought),
        price: String(unitPrice.toFixed(2)),
        status: 'Received',
        meta: `Pipeline purchase for ${pipeline.productName}`,
      }).catch(() => {
        // Non-blocking fallback
      })
    }

    onAdvance(updated)
  }

  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 3 of 11</span>
        <h2>🛒 Check Inventory & Purchase Shortages</h2>
        <p>The system checks your store inventory. You can edit the purchase quantity to <strong>buy more than needed</strong> for store inventory buffer.</p>
      </div>

      {/* Stock Health Summary */}
      <div className="pipeline-purchase-summary">
        <div>
          <span>Total Materials Required:</span>
          <strong>{pipeline.totalIngredients.length} items</strong>
        </div>
        <div>
          <span>Already In Stock:</span>
          <strong style={{ color: '#22c55e' }}>{inStockCount} items</strong>
        </div>
        <div>
          <span>Shortages to Purchase:</span>
          <strong style={{ color: shortagesCount > 0 ? '#ef4444' : '#22c55e' }}>
            {shortagesCount} {shortagesCount === 1 ? 'item' : 'items'}
          </strong>
        </div>
        {totalSurplusUnits > 0 && (
          <div>
            <span>Extra Buffer Purchased:</span>
            <strong style={{ color: '#6366f1' }}>+{totalSurplusUnits.toLocaleString()} units extra</strong>
          </div>
        )}
        <div>
          <span>Total Purchase Spend:</span>
          <strong style={{ color: '#22c55e' }}>{formatMoney(totalActualCost, currency)}</strong>
        </div>
      </div>

      {allMaterialsInStock && (
        <div className="pipeline-auto-detect-banner" style={{ marginBottom: '20px' }}>
          <span>🎉 All Materials Are In Stock!</span>
          <small>Your warehouse has sufficient stock for every ingredient and packaging item. No purchase is needed.</small>
        </div>
      )}

      {/* Actions toolbar */}
      {!allMaterialsInStock && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button type="button" className="pipeline-btn-secondary" onClick={resetToExactShortages}>
            🎯 Buy Exact Shortages
          </button>
          <button type="button" className="pipeline-btn-secondary" onClick={fulfillInStock}>
            ✅ Auto-fulfill In-Stock Materials
          </button>
        </div>
      )}

      {/* Ingredient Shortage Table with Editable Purchase Quantities */}
      <div className="table-frame" style={{ marginBottom: '24px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>{allMaterialsInStock ? 'Ready' : 'Done'}</th>
              <th>Material / Ingredient</th>
              <th>Needed by Command</th>
              <th>In Stock</th>
              <th>Min Shortage</th>
              <th style={{ minWidth: '150px' }}>
                {allMaterialsInStock ? 'Qty to Purchase' : 'Qty to Purchase (Editable)'}
              </th>
              <th>Est. Cost</th>
              <th>Actual Cost ({currency})</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ingredientStatus.map((ing) => {
              const isFulfilled = ing.isPurchased
              const hasShortage = ing.shortage > 0

              return (
                <tr key={ing.id} style={{ background: isFulfilled ? 'rgba(34,197,94,0.03)' : undefined }}>
                  <td>
                    {allMaterialsInStock ? (
                      <span aria-label="In stock">✅</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isFulfilled}
                        onChange={() => togglePurchased(ing.id)}
                        style={{ width: '18px', height: '18px', accentColor: '#22c55e', cursor: 'pointer' }}
                      />
                    )}
                  </td>
                  <td>
                    <strong>{ing.name}</strong>
                    {ing.matched && (
                      <span className="pipeline-inventory-match-tag">
                        Stock: {ing.matched.item} ({ing.matched.stock})
                      </span>
                    )}
                  </td>
                  <td><strong>{ing.totalQuantity.toLocaleString()} {ing.unit}</strong></td>
                  <td>
                    <span style={{ color: ing.inStock > 0 ? '#60a5fa' : 'var(--text-muted)' }}>
                      {ing.inStock.toLocaleString()} {ing.unit}
                    </span>
                  </td>
                  <td>
                    {hasShortage ? (
                      <strong style={{ color: '#ef4444' }}>
                        {ing.shortage.toLocaleString()} {ing.unit}
                      </strong>
                    ) : (
                      <span style={{ color: '#22c55e' }}>0 (Sufficient)</span>
                    )}
                  </td>
                  <td>
                    {allMaterialsInStock ? (
                      <span>0 {ing.unit} — no purchase needed</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={ing.qtyToBuy}
                            onChange={(e) => updateQtyToBuy(ing.id, Number(e.target.value))}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--line)',
                              background: 'rgba(255,255,255,0.05)',
                              color: 'inherit',
                              width: '95px',
                              fontWeight: 600,
                            }}
                          />
                          <small style={{ color: 'var(--text-soft)' }}>{ing.unit}</small>
                        </div>
                        {ing.surplus > 0 && (
                          <span
                            className="pipeline-surplus-badge"
                            title="Extra quantity that will remain in warehouse inventory after this command"
                          >
                            +{ing.surplus.toLocaleString()} {ing.unit} extra buffer
                          </span>
                        )}
                        {ing.qtyToBuy < ing.shortage && (
                          <small style={{ color: '#ef4444' }}>
                            ⚠️ Under by {(ing.shortage - ing.qtyToBuy).toLocaleString()} {ing.unit}
                          </small>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{formatMoney(allMaterialsInStock ? 0 : ing.estCost, currency)}</td>
                  <td>
                    {allMaterialsInStock ? (
                      formatMoney(0, currency)
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ing.actualCost}
                        onChange={(e) => updateActualCost(ing.id, Number(e.target.value))}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--line)',
                          background: 'rgba(255,255,255,0.05)',
                          color: 'inherit',
                          width: '110px',
                        }}
                      />
                    )}
                  </td>
                  <td>
                    {allMaterialsInStock ? (
                      <span className="pipeline-shortage-badge ok">✅ In Stock</span>
                    ) : ing.surplus > 0 ? (
                      <span className="pipeline-shortage-badge ok">🛒 Buying +{ing.surplus} Buffer</span>
                    ) : !hasShortage && ing.qtyToBuy === 0 ? (
                      <span className="pipeline-shortage-badge ok">✅ In Stock</span>
                    ) : isFulfilled ? (
                      <span className="pipeline-shortage-badge ok">🛒 Purchased</span>
                    ) : (
                      <span className="pipeline-shortage-badge short">⚠️ Buy Shortage</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="pipeline-form-actions">
        <button
          type="button"
          className="pipeline-btn-primary pipeline-btn-lg"
          onClick={handleProceed}
          disabled={!allFulfilled}
        >
          {allFulfilled
            ? allMaterialsInStock
              ? 'All Materials In Stock — Start Production →'
              : 'All Materials Secured — Store Materials →'
            : `Fulfill or check off remaining ${ingredientStatus.filter((s) => !s.isPurchased).length} items →`}
        </button>
      </div>
    </div>
  )
}

/* ─── 4. STORE RAW MATERIALS ─── */
function StoreRawStage({ pipeline, onUpdate, onAdvance }: {
  pipeline: PipelineData
  onUpdate: (data: PipelineData) => void
  onAdvance: (pipeline: PipelineData) => void
}) {
  const [confirmed, setConfirmed] = useState(pipeline.rawMaterialsStored)

  const handleProceed = () => {
    const updated = { ...pipeline, rawMaterialsStored: true }
    onUpdate(updated)
    onAdvance(updated)
  }

  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 4 of 11</span>
        <h2>📦 Store Raw Materials</h2>
        <p>Verify all materials are safely stored and staged for production.</p>
      </div>

      <div className="pipeline-store-checklist">
        <h3>Materials Ready for Production & Warehouse Buffers:</h3>
        {pipeline.totalIngredients.map((ing) => {
          const purchItem = pipeline.purchasedItems.find((p) => p.ingredientId === ing.id)
          const surplus = purchItem?.surplusQuantity || 0
          return (
            <div key={ing.id} className="pipeline-store-item">
              <span className="pipeline-store-check">✓</span>
              <span>{ing.name}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <strong>{ing.totalQuantity.toLocaleString()} {ing.unit} (for this command)</strong>
                {surplus > 0 && (
                  <span className="pipeline-surplus-badge" title="Extra units stored in warehouse for future commands">
                    +{surplus.toLocaleString()} {ing.unit} extra stored in warehouse buffer
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <label className="pipeline-confirm-box">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>I confirm all raw materials are stored safely and ready for production</span>
      </label>

      <div className="pipeline-form-actions">
        <button type="button" className="pipeline-btn-primary pipeline-btn-lg" onClick={handleProceed} disabled={!confirmed}>
          Materials Stored — Start Production →
        </button>
      </div>
    </div>
  )
}

/* ─── 5. PRODUCE ─── */
function ProduceStage({ pipeline, onUpdate, onAdvance }: {
  pipeline: PipelineData
  onUpdate: (data: PipelineData) => void
  onAdvance: (pipeline: PipelineData) => void
}) {
  const [producedQuantity, setProducedQuantity] = useState(pipeline.producedQuantity || pipeline.targetQuantity)
  const [startTime, setStartTime] = useState(pipeline.productionStartTime || new Date().toISOString().slice(0, 16))
  const [endTime, setEndTime] = useState(pipeline.productionEndTime || new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState(pipeline.productionNotes)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const updated = {
      ...pipeline,
      producedQuantity,
      productionStartTime: startTime,
      productionEndTime: endTime,
      productionNotes: notes,
    }
    onUpdate(updated)
    onAdvance(updated)
  }

  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 5 of 11</span>
        <h2>⚙️ Production Run</h2>
        <p>Record the production process for <strong>{pipeline.productName}</strong>.</p>
      </div>

      <div className="pipeline-produce-visual">
        <div className="pipeline-produce-animation">
          <span className="pipeline-cog">⚙️</span>
          <span className="pipeline-arrow">➔</span>
          <span className="pipeline-product-icon">📦</span>
        </div>
        <p>1 {cleanUnitName(pipeline.singleUnitLabel)} × {pipeline.targetQuantity} = Production run</p>
      </div>

      <form className="pipeline-form" onSubmit={handleSubmit}>
        <div className="pipeline-form-row">
          <label className="pipeline-field">
            <span>Actual quantity produced ({cleanUnitName(pipeline.singleUnitLabel)}s)</span>
            <input
              type="number"
              min="1"
              value={producedQuantity || ''}
              onChange={(e) => setProducedQuantity(Number(e.target.value))}
              required
            />
          </label>
          <label className="pipeline-field">
            <span>Production start time</span>
            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="pipeline-field">
            <span>Production end time</span>
            <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>

        <label className="pipeline-field wide">
          <span>Production notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes on batch consistency, equipment used, adjustments..."
          />
        </label>

        <div className="pipeline-form-actions">
          <button className="pipeline-btn-primary pipeline-btn-lg" type="submit">
            Complete Production Run → Quality Check →
          </button>
        </div>
      </form>
    </div>
  )
}

/* ─── 6. QUALITY CHECK ─── */
function QualityCheckStage({ pipeline, onUpdate, onAdvance }: {
  pipeline: PipelineData
  onUpdate: (data: PipelineData) => void
  onAdvance: (pipeline: PipelineData) => void
}) {
  const [inspectedQty, setInspectedQty] = useState(pipeline.qualityResult?.inspectedQuantity || pipeline.producedQuantity)
  const [passedQty, setPassedQty] = useState(pipeline.qualityResult?.passedQuantity || pipeline.producedQuantity)
  const [defectQty, setDefectQty] = useState(pipeline.qualityResult?.defectQuantity || 0)
  const [inspector, setInspector] = useState(pipeline.qualityResult?.inspectedBy || '')
  const [notes, setNotes] = useState(pipeline.qualityResult?.notes || '')

  const passRate = inspectedQty > 0 ? ((passedQty / inspectedQty) * 100).toFixed(1) : '100'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const qualityResult: QualityResult = {
      passed: defectQty === 0,
      inspectedQuantity: inspectedQty,
      passedQuantity: passedQty,
      defectQuantity: defectQty,
      notes,
      inspectedBy: inspector || 'Self',
      date: new Date().toISOString(),
    }
    const updated = { ...pipeline, qualityResult, producedQuantity: passedQty }
    onUpdate(updated)
    onAdvance(updated)
  }

  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 6 of 11</span>
        <h2>✅ Quality Inspection</h2>
        <p>Inspect the produced batch of <strong>{pipeline.productName}</strong>.</p>
      </div>

      <div className={`pipeline-qc-status ${defectQty === 0 ? 'pass' : 'partial'}`}>
        <span className="pipeline-qc-icon">{defectQty === 0 ? '✅' : '⚠️'}</span>
        <span>Pass Rate: {passRate}% ({passedQty} of {inspectedQty} passed)</span>
      </div>

      <form className="pipeline-form" onSubmit={handleSubmit}>
        <div className="pipeline-form-row">
          <label className="pipeline-field">
            <span>Total inspected</span>
            <input type="number" min="1" value={inspectedQty || ''} onChange={(e) => setInspectedQty(Number(e.target.value))} required />
          </label>
          <label className="pipeline-field">
            <span>Passed quality check</span>
            <input
              type="number"
              min="0"
              max={inspectedQty}
              value={passedQty || ''}
              onChange={(e) => {
                const p = Number(e.target.value)
                setPassedQty(p)
                setDefectQty(inspectedQty - p)
              }}
              required
            />
          </label>
          <label className="pipeline-field">
            <span>Defects / Rejected</span>
            <input
              type="number"
              min="0"
              value={defectQty || ''}
              onChange={(e) => {
                const d = Number(e.target.value)
                setDefectQty(d)
                setPassedQty(inspectedQty - d)
              }}
            />
          </label>
        </div>

        <div className="pipeline-form-row">
          <label className="pipeline-field">
            <span>Inspector name</span>
            <input type="text" value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="e.g. Lead Barista, Baker, QC Lead" />
          </label>
        </div>

        <label className="pipeline-field wide">
          <span>Inspection notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observations on taste, temperature, appearance, weight..." />
        </label>

        <div className="pipeline-form-actions">
          <button className="pipeline-btn-primary pipeline-btn-lg" type="submit">
            Quality Approved — Finish Batch →
          </button>
        </div>
      </form>
    </div>
  )
}

/* ─── 7. FINISH ─── */
function FinishStage({
  pipeline,
  currency,
  onAdvance,
  onCreateNext,
}: {
  pipeline: PipelineData
  currency: string
  onAdvance: (pipeline: PipelineData) => void
  onCreateNext: () => void
}) {
  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 7 of 11</span>
        <h2>🏁 Production Finished!</h2>
        <p>Production batch for <strong>{pipeline.productName}</strong> is complete.</p>
      </div>

      <div className="pipeline-finish-summary">
        <div className="pipeline-finish-icon">🎉</div>
        <div className="pipeline-finish-stats">
          <div className="pipeline-summary-card highlight">
            <span>Finished Goods</span>
            <strong>{formatUnitQty(pipeline.producedQuantity, pipeline.singleUnitLabel)}</strong>
          </div>
          <div className="pipeline-summary-card">
            <span>Total Material Cost</span>
            <strong>{formatMoney(pipeline.purchasedItems.reduce((s, i) => s + i.actualCost, 0), currency)}</strong>
          </div>
          {pipeline.qualityResult && (
            <div className="pipeline-summary-card">
              <span>Quality Pass Rate</span>
              <strong>{pipeline.qualityResult.inspectedQuantity > 0 ? ((pipeline.qualityResult.passedQuantity / pipeline.qualityResult.inspectedQuantity) * 100).toFixed(1) : 0}%</strong>
            </div>
          )}
        </div>
      </div>

      <div className="pipeline-form-actions" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="pipeline-btn-secondary" onClick={onCreateNext}>
          <span>+</span> Plan Another Product (e.g. American Tea)
        </button>
        <button type="button" className="pipeline-btn-primary pipeline-btn-lg" onClick={() => onAdvance(pipeline)}>
          Store Finished Goods →
        </button>
      </div>
    </div>
  )
}

/* ─── 8. STORE FINISHED ─── */
function StoreFinishedStage({ pipeline, onUpdate, onAdvance }: {
  pipeline: PipelineData
  onUpdate: (data: PipelineData) => void
  onAdvance: (pipeline: PipelineData) => void
}) {
  const [location, setLocation] = useState(pipeline.finishedGoodsLocation || 'Display Counter / Shelf')
  const [confirmed, setConfirmed] = useState(pipeline.finishedGoodsStored)

  const handleProceed = () => {
    const updated = { ...pipeline, finishedGoodsStored: true, finishedGoodsLocation: location }
    onUpdate(updated)
    onAdvance(updated)

    // Register / update in inventory so finished goods appear in inventory and reports
    api.createInventoryImport({
      sku: pipeline.id,
      item: pipeline.productName,
      category: 'Finished Goods',
      itemType: 'finished_good',
      baseUnit: cleanUnitName(pipeline.singleUnitLabel) || 'piece',
      stock: pipeline.producedQuantity,
      price: pipeline.sellingPricePerUnit || 0,
      sellingPrice: pipeline.sellingPricePerUnit || 0,
      shelflocation: location,
      meta: 'Production Pipeline',
    }).catch(() => {
      api.updateInventory(pipeline.id, {
        stock: String(pipeline.producedQuantity),
        price: String(pipeline.sellingPricePerUnit || 0),
      }).catch(() => {})
    })
  }

  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 8 of 11</span>
        <h2>🏪 Store Finished Products</h2>
        <p>Store <strong>{formatUnitQty(pipeline.producedQuantity, pipeline.singleUnitLabel)}</strong> of <strong>{pipeline.productName}</strong>.</p>
      </div>

      <div className="pipeline-store-visual">
        <div className="pipeline-store-icon">🏪</div>
        <h3>Ready for Storage & Sale</h3>
        <p className="pipeline-store-qty">{formatUnitQty(pipeline.producedQuantity, pipeline.singleUnitLabel)}</p>
      </div>

      <label className="pipeline-field wide">
        <span>Storage location</span>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Counter display, Front fridge, Warm shelf" />
      </label>

      <label className="pipeline-confirm-box">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>I confirm all finished goods are placed in storage and ready for customer sales</span>
      </label>

      <div className="pipeline-form-actions">
        <button type="button" className="pipeline-btn-primary pipeline-btn-lg" onClick={handleProceed} disabled={!confirmed}>
          Products Stored — Start Selling →
        </button>
      </div>
    </div>
  )
}

/* ─── 9. SELL ─── */
function SellStage({
  pipeline,
  allPipelines,
  currency,
  onUpdate,
  onAdvance,
  onQuickSell,
}: {
  pipeline: PipelineData
  allPipelines: PipelineData[]
  currency: string
  onUpdate: (data: PipelineData) => void
  onAdvance: (pipeline: PipelineData) => void
  onQuickSell: (prod: { pipeline: PipelineData; available: number; unitPrice: number }) => void
}) {
  const [sales, setSales] = useState<SaleRecord[]>(pipeline.sales)
  const [newQty, setNewQty] = useState(1)
  const [newPrice, setNewPrice] = useState(pipeline.sellingPricePerUnit || 0)
  const [newCustomer, setNewCustomer] = useState('')
  const unit = cleanUnitName(pipeline.singleUnitLabel)

  const totalSold = sales.reduce((s, sale) => s + sale.quantity, 0)
  const totalRevenue = sales.reduce((s, sale) => s + sale.quantity * sale.unitPrice, 0)
  const remaining = Math.max(0, pipeline.producedQuantity - totalSold)

  const addSale = () => {
    if (newQty <= 0 || newQty > remaining) return
    const sale: SaleRecord = {
      id: String(Date.now()),
      date: new Date().toISOString().slice(0, 10),
      quantity: newQty,
      unitPrice: newPrice,
      customer: newCustomer.trim() || 'Walk-in',
    }
    const updated = [...sales, sale]
    setSales(updated)
    const p = { ...pipeline, sales: updated, updatedAt: new Date().toISOString() }
    onUpdate(p)
    setNewQty(1)
    setNewCustomer('')

    // Sync to POS so it enters Sales Reports immediately
    api.createPosSale({
      id: sale.id,
      date: sale.date.slice(0, 10),
      customer: sale.customer,
      payment: 'Cash',
      source: 'pipeline',
      allowFlexibleStock: true,
      items: [{
        sku: pipeline.id,
        item: pipeline.productName,
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        unit,
      }],
    }).catch((err) => {
      console.warn('Could not sync pipeline sale to POS reports:', err)
    })
  }

  const removeSale = (id: string) => {
    const updated = sales.filter((s) => s.id !== id)
    setSales(updated)
    onUpdate({ ...pipeline, sales: updated, updatedAt: new Date().toISOString() })
  }

  // Other finished products in inventory
  const otherFinished = allPipelines.filter(
    (p) => p.id !== pipeline.id && (p.producedQuantity > 0 || ['finish', 'store_finished', 'sell', 'cost', 'analyze'].includes(p.currentStage))
  ).map((p) => {
    const sold = p.sales.reduce((s, sale) => s + sale.quantity, 0)
    const avail = Math.max(0, (p.producedQuantity || p.targetQuantity) - sold)
    return { pipeline: p, available: avail, unitPrice: p.sellingPricePerUnit || 0 }
  })

  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 9 of 11</span>
        <h2>💰 Sell Products</h2>
        <p>Record sales for <strong>{pipeline.productName}</strong>. Stock decreases automatically.</p>
      </div>

      <div className="pipeline-sell-stats">
        <div className="pipeline-summary-card highlight">
          <span>Available to Sell</span>
          <strong>{formatUnitQty(remaining, unit)}</strong>
        </div>
        <div className="pipeline-summary-card">
          <span>Sold so Far</span>
          <strong>{formatUnitQty(totalSold, unit)}</strong>
        </div>
        <div className="pipeline-summary-card cost-card">
          <span>Sales Revenue</span>
          <strong>{formatMoney(totalRevenue, currency)}</strong>
        </div>
      </div>

      <div className="pipeline-sell-form">
        <input
          type="number"
          min="1"
          max={remaining}
          value={newQty || ''}
          onChange={(e) => setNewQty(Number(e.target.value))}
          placeholder={`Qty (${unit}s)`}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={newPrice || ''}
          onChange={(e) => setNewPrice(Number(e.target.value))}
          placeholder={`Unit Price (${currency})`}
        />
        <input
          type="text"
          value={newCustomer}
          onChange={(e) => setNewCustomer(e.target.value)}
          placeholder="Customer (Walk-in, Table 2...)"
        />
        <button
          type="button"
          className="pipeline-btn-sell"
          onClick={addSale}
          disabled={newQty <= 0 || newQty > remaining || remaining === 0}
        >
          + Record Sale
        </button>
      </div>

      {sales.length > 0 && (
        <div className="table-frame" style={{ marginBottom: '24px' }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Customer</th><th>Qty</th><th>Unit Price</th><th>Total</th><th /></tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>{new Date(sale.date).toLocaleDateString()}</td>
                  <td>{sale.customer}</td>
                  <td>{sale.quantity}</td>
                  <td>{formatMoney(sale.unitPrice, currency)}</td>
                  <td><strong>{formatMoney(sale.quantity * sale.unitPrice, currency)}</strong></td>
                  <td><button type="button" className="pipeline-btn-remove" onClick={() => removeSale(sale.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Other Finished Products Section */}
      {otherFinished.length > 0 && (
        <div style={{ marginTop: '28px', borderTop: '1px solid var(--line)', paddingTop: '20px' }}>
          <h3 style={{ fontSize: '15px', margin: '0 0 12px', color: 'var(--text-soft)' }}>
            🏪 Other Finished Products Available for Sale ({otherFinished.length})
          </h3>
          <div className="table-frame">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Available</th>
                  <th>Price</th>
                  <th style={{ textAlign: 'right' }}>Sell</th>
                </tr>
              </thead>
              <tbody>
                {otherFinished.map((item) => (
                  <tr key={item.pipeline.id}>
                    <td><strong>{item.pipeline.productName}</strong></td>
                    <td>{formatUnitQty(item.available, item.pipeline.singleUnitLabel)}</td>
                    <td>{formatMoney(item.unitPrice, currency)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="pipeline-btn-sell"
                        disabled={item.available <= 0}
                        onClick={() => onQuickSell(item)}
                      >
                        💰 Sell
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="pipeline-form-actions">
        <button type="button" className="pipeline-btn-primary pipeline-btn-lg" onClick={() => onAdvance(pipeline)}>
          View Cost & Profit Analysis →
        </button>
      </div>
    </div>
  )
}

/* ─── 10. COST ─── */
function CostStage({ pipeline, currency, onAdvance }: {
  pipeline: PipelineData
  currency: string
  onAdvance: (pipeline: PipelineData) => void
}) {
  const actualMaterialCost = pipeline.purchasedItems.reduce((s, i) => s + i.actualCost, 0)
  const totalRevenue = pipeline.sales.reduce((s, sale) => s + sale.quantity * sale.unitPrice, 0)
  const totalSold = pipeline.sales.reduce((s, sale) => s + sale.quantity, 0)
  const costPerUnit = pipeline.producedQuantity > 0 ? actualMaterialCost / pipeline.producedQuantity : 0

  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 10 of 11</span>
        <h2>📊 Cost Breakdown</h2>
        <p>Detailed cost and profit analysis for <strong>{pipeline.productName}</strong>.</p>
      </div>

      <div className="pipeline-cost-breakdown">
        <h3>Material Cost Analysis</h3>
        <div className="table-frame">
          <table>
            <thead>
              <tr><th>Material</th><th>Quantity Used</th><th>Estimated Cost</th><th>Actual Cost</th><th>Variance</th></tr>
            </thead>
            <tbody>
              {pipeline.totalIngredients.map((ing) => {
                const purchItem = pipeline.purchasedItems.find((p) => p.ingredientId === ing.id)
                const actual = purchItem?.actualCost || 0
                const variance = actual - ing.totalCost
                return (
                  <tr key={ing.id}>
                    <td><strong>{ing.name}</strong></td>
                    <td>{ing.totalQuantity.toLocaleString()} {ing.unit}</td>
                    <td>{formatMoney(ing.totalCost, currency)}</td>
                    <td>{formatMoney(actual, currency)}</td>
                    <td className={variance > 0 ? 'profit-negative' : 'profit-positive'}>
                      {variance > 0 ? '+' : ''}{formatMoney(variance, currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><strong>Total</strong></td>
                <td><strong>{formatMoney(pipeline.totalMaterialCost, currency)}</strong></td>
                <td><strong>{formatMoney(actualMaterialCost, currency)}</strong></td>
                <td className={actualMaterialCost - pipeline.totalMaterialCost > 0 ? 'profit-negative' : 'profit-positive'}>
                  <strong>{actualMaterialCost - pipeline.totalMaterialCost > 0 ? '+' : ''}{formatMoney(actualMaterialCost - pipeline.totalMaterialCost, currency)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="pipeline-cost-summary-grid">
          <div className="pipeline-cost-card">
            <span>Total Material Cost</span>
            <strong>{formatMoney(actualMaterialCost, currency)}</strong>
          </div>
          <div className="pipeline-cost-card">
            <span>Cost Per Unit</span>
            <strong>{formatMoney(costPerUnit, currency)}</strong>
          </div>
          <div className="pipeline-cost-card">
            <span>Units Produced</span>
            <strong>{formatUnitQty(pipeline.producedQuantity, pipeline.singleUnitLabel)}</strong>
          </div>
          <div className="pipeline-cost-card">
            <span>Units Sold</span>
            <strong>{formatUnitQty(totalSold, pipeline.singleUnitLabel)}</strong>
          </div>
          <div className="pipeline-cost-card">
            <span>Total Revenue</span>
            <strong>{formatMoney(totalRevenue, currency)}</strong>
          </div>
          <div className="pipeline-cost-card highlight">
            <span>Gross Profit</span>
            <strong className={totalRevenue - actualMaterialCost >= 0 ? 'profit-positive' : 'profit-negative'}>
              {formatMoney(totalRevenue - actualMaterialCost, currency)}
            </strong>
          </div>
        </div>
      </div>

      <div className="pipeline-form-actions">
        <button type="button" className="pipeline-btn-primary pipeline-btn-lg" onClick={() => onAdvance(pipeline)}>
          View Profitability & Business Insights →
        </button>
      </div>
    </div>
  )
}

/* ─── 11. ANALYZE ─── */
function AnalyzeStage({
  pipeline,
  currency,
  onUpdate,
  onCreateNext,
}: {
  pipeline: PipelineData
  currency: string
  onUpdate: (data: PipelineData) => void
  onCreateNext: () => void
}) {
  const actualMaterialCost = pipeline.purchasedItems.reduce((s, i) => s + i.actualCost, 0)
  const totalRevenue = pipeline.sales.reduce((s, sale) => s + sale.quantity * sale.unitPrice, 0)
  const totalSold = pipeline.sales.reduce((s, sale) => s + sale.quantity, 0)
  const grossProfit = totalRevenue - actualMaterialCost
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0
  const costPerUnit = pipeline.producedQuantity > 0 ? actualMaterialCost / pipeline.producedQuantity : 0
  const avgSellingPrice = totalSold > 0 ? totalRevenue / totalSold : pipeline.sellingPricePerUnit
  const markupPercent = costPerUnit > 0 ? ((avgSellingPrice - costPerUnit) / costPerUnit * 100) : 0
  const remaining = Math.max(0, pipeline.producedQuantity - totalSold)
  const unsoldValue = remaining * avgSellingPrice
  const productionHours = pipeline.productionStartTime && pipeline.productionEndTime
    ? (new Date(pipeline.productionEndTime).getTime() - new Date(pipeline.productionStartTime).getTime()) / 3600000
    : 0
  const revenuePerHour = productionHours > 0 ? totalRevenue / productionHours : 0
  const wasteRate = pipeline.qualityResult
    ? (pipeline.qualityResult.defectQuantity / (pipeline.qualityResult.inspectedQuantity || 1) * 100)
    : 0

  useEffect(() => {
    if (!pipeline.completedStages.includes('analyze')) {
      const updated: PipelineData = { ...pipeline, completedStages: [...pipeline.completedStages, 'analyze'] }
      onUpdate(updated)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pipeline-stage-card">
      <div className="pipeline-stage-header">
        <span className="pipeline-stage-badge">Step 11 of 11</span>
        <h2>📈 Profitability Analysis</h2>
        <p>Complete financial analysis for <strong>{pipeline.productName}</strong>.</p>
      </div>

      <div className="pipeline-analyze-hero">
        <div className={`pipeline-profit-ring ${grossProfit >= 0 ? 'positive' : 'negative'}`}>
          <div className="pipeline-profit-value">
            <span>{grossProfit >= 0 ? '📈' : '📉'}</span>
            <strong>{formatMoney(grossProfit, currency)}</strong>
            <small>{profitMargin.toFixed(1)}% margin</small>
          </div>
        </div>
      </div>

      <div className="pipeline-analyze-grid">
        <div className="pipeline-analyze-card revenue">
          <h4>Revenue</h4>
          <strong>{formatMoney(totalRevenue, currency)}</strong>
          <small>{totalSold} sold at avg {formatMoney(avgSellingPrice, currency)}</small>
        </div>
        <div className="pipeline-analyze-card cost">
          <h4>Total Cost</h4>
          <strong>{formatMoney(actualMaterialCost, currency)}</strong>
          <small>{formatMoney(costPerUnit, currency)} per unit</small>
        </div>
        <div className="pipeline-analyze-card profit">
          <h4>Gross Profit</h4>
          <strong className={grossProfit >= 0 ? 'profit-positive' : 'profit-negative'}>{formatMoney(grossProfit, currency)}</strong>
          <small>{markupPercent.toFixed(1)}% markup</small>
        </div>
        <div className="pipeline-analyze-card">
          <h4>Unsold Stock</h4>
          <strong>{formatUnitQty(remaining, pipeline.singleUnitLabel)}</strong>
          <small>Worth {formatMoney(unsoldValue, currency)}</small>
        </div>
        {productionHours > 0 && (
          <div className="pipeline-analyze-card">
            <h4>Production Time</h4>
            <strong>{productionHours.toFixed(1)} hours</strong>
            <small>{formatMoney(revenuePerHour, currency)}/hr revenue</small>
          </div>
        )}
        <div className="pipeline-analyze-card">
          <h4>Quality</h4>
          <strong>{(100 - wasteRate).toFixed(1)}% pass rate</strong>
          <small>{pipeline.qualityResult?.defectQuantity || 0} defects</small>
        </div>
      </div>

      {/* Recommendations */}
      <div className="pipeline-recommendations">
        <h3>💡 Insights & Recommendations</h3>
        <ul>
          {profitMargin > 20 && <li className="pipeline-rec-good">Good profit margin ({profitMargin.toFixed(1)}%). This product is performing well.</li>}
          {profitMargin > 0 && profitMargin <= 20 && <li className="pipeline-rec-warn">Moderate profit margin ({profitMargin.toFixed(1)}%). Consider reducing material costs or increasing prices.</li>}
          {profitMargin <= 0 && <li className="pipeline-rec-bad">This production run is not profitable. Review costs and pricing immediately.</li>}
          {remaining > 0 && <li className="pipeline-rec-warn">{remaining} units remain unsold (worth {formatMoney(unsoldValue, currency)}). Consider selling them or running promotions.</li>}
          {wasteRate > 5 && <li className="pipeline-rec-bad">Waste rate of {wasteRate.toFixed(1)}% is high. Review production process for quality improvements.</li>}
          {wasteRate <= 5 && wasteRate > 0 && <li className="pipeline-rec-good">Waste rate is low ({wasteRate.toFixed(1)}%). Good quality control.</li>}
          {actualMaterialCost <= pipeline.totalMaterialCost && <li className="pipeline-rec-good">Material costs came in at or under budget. Good procurement.</li>}
        </ul>
      </div>

      <div className="pipeline-complete-banner" style={{ marginBottom: '24px' }}>
        <span>✅</span>
        <div>
          <strong>Production Run Complete!</strong>
          <p>This production cycle for {pipeline.productName} has been fully completed from recipe planning to profit analysis.</p>
        </div>
      </div>

      <div className="pipeline-form-actions">
        <button type="button" className="pipeline-btn-primary pipeline-btn-lg" onClick={onCreateNext}>
          <span>+</span> Plan Next Product (e.g. American Tea) →
        </button>
      </div>
    </div>
  )
}
