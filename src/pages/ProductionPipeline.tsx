import { useState, useEffect, useCallback, useMemo, type FormEvent, type ReactNode } from 'react'
import { api, type InventoryRow, type ItemMaster, type PermissionAction, type ProductionRecipe } from '../api'
import { Topbar } from '../components/Topbar'
import { formatMoney } from '../utils/money'
import type { Theme } from '../types'
import { useAuth, type AuthUser } from '../context/AuthContext'
import { canAccess, isFullAccessRole } from '../utils/access'
import { readStoredPipelines, writeStoredPipelines, type PipelineStorageScope } from '../utils/pipelineStorage'
import { cleanUnitName, formatUnitQty } from '../utils/units'

function isFinishedProduct(item: { itemType?: string; category?: string }) {
  const type = String(item.itemType || '').trim().toLowerCase()
  const category = String(item.category || '').trim().toLowerCase()
  return ['finished_product', 'semi_finished_product'].includes(type) || ['finished goods', 'finished product', 'finished products'].includes(category)
}

/* ──────────────────────────────── Types ──────────────────────────────── */

export type PipelineStage =
  | 'plan'
  | 'check_stock'
  | 'purchase_order'
  | 'payment'
  | 'receive'
  | 'make'
  | 'quality_check'
  | 'store'
  | 'done'

export type PipelineExecutionMode = 'delegated' | 'solo'

export type PipelineActivityRecord = {
  id: string
  stage: string
  stageLabel: string
  performedBy: string
  performedByRole: string
  timestamp: string
  summary: string
  details?: string
  metrics?: Record<string, unknown>
}

type Ingredient = {
  id: string
  name: string
  quantity: number
  unit: string
  unitCost: number
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

type RequisitionLine = { ingredientId: string; name: string; unit: string; needed: number; inStock: number; shortage: number; unitCost: number }
type PurchaseOrderLine = { ingredientId: string; name: string; unit: string; quantity: number; unitPrice: number; total: number }
type ReceiptLine = { ingredientId: string; name: string; unit: string; ordered: number; received: number; unitPrice: number; purchaseId: string }

type WorkflowRecords = {
  skippedStages?: PipelineStage[]
  requisition?: { date: string; by: string; lines: RequisitionLine[] } | null
  purchaseOrder?: { number: string; date: string; by: string; byId?: string; supplier: string; expectedDate: string; notes: string; lines: PurchaseOrderLine[]; total: number } | null
  payment?: { date: string; by: string; method: string; amountPaid: number; balance: number; reference: string } | null
  receipts?: Array<{ date: string; by: string; poNumber: string; supplier: string; payment: string; amountPaid: number; notes: string; lines: ReceiptLine[] }>
  production?: { date: string; by: string; producedQuantity: number; startTime: string; endTime: string; notes: string; materialsCost: number; consumed: Array<{ name: string; sku: string; quantity: number; unit: string; unitCost: number }> } | null
  storage?: { date: string; by: string; location: string; sku: string; item: string; quantity: number; unitCost: number; sellingPrice: number } | null
}

export type PipelineData = WorkflowRecords & {
  id: string
  productName: string
  businessType: string
  singleUnitLabel: string
  singleUnitAmount?: number
  singleUnitMeasure?: string
  ingredients: Ingredient[]
  targetQuantity: number
  scheduledDate: string
  currentStage: PipelineStage
  completedStages: PipelineStage[]
  executionMode?: PipelineExecutionMode
  activityLog?: PipelineActivityRecord[]
  totalIngredients: Array<Ingredient & { totalQuantity: number; totalCost: number }>
  totalMaterialCost: number
  purchasedItems?: Array<{ ingredientId: string; purchased: boolean; purchasedQuantity?: number; actualCost: number; surplusQuantity?: number }>
  producedQuantity: number
  qualityResult: QualityResult | null
  sellingPricePerUnit: number
  createdAt: string
  updatedAt: string
}

type StockLine = {
  ingredientId: string
  name: string
  unit: string
  needed: number
  inStock: number
  shortage: number
  sku: string
  stockItem: string
  stockUnit: string
  unitCost: number
}

/* Each step names who does it and the permission the server checks. */
const STAGES: Array<{ id: PipelineStage; label: string; shortLabel: string; owner: string; permission: [string, PermissionAction] }> = [
  { id: 'plan', label: 'Order', shortLabel: 'Order', owner: 'Production', permission: ['production', 'create'] },
  { id: 'check_stock', label: 'Check stock', shortLabel: 'Stock', owner: 'Production', permission: ['production', 'create'] },
  { id: 'purchase_order', label: 'Purchase order', shortLabel: 'Order goods', owner: 'Procurement', permission: ['purchases', 'create'] },
  { id: 'payment', label: 'Payment', shortLabel: 'Pay', owner: 'Finance', permission: ['purchases', 'approve'] },
  { id: 'receive', label: 'Receive', shortLabel: 'Receive', owner: 'Store', permission: ['inventory', 'create'] },
  { id: 'make', label: 'Make', shortLabel: 'Make', owner: 'Production', permission: ['production', 'create'] },
  { id: 'quality_check', label: 'Quality check', shortLabel: 'Check', owner: 'Quality', permission: ['quality', 'create'] },
  { id: 'store', label: 'Store', shortLabel: 'Store', owner: 'Store', permission: ['inventory', 'create'] },
]

const LEGACY_STAGES: Record<string, PipelineStage> = {
  receive_plan: 'check_stock',
  purchase: 'check_stock',
  store_raw: 'make',
  produce: 'make',
  finish: 'store',
  store_finished: 'store',
  sell: 'done',
  cost: 'done',
  analyze: 'done',
}

function normalizeStage(stage: string): PipelineStage {
  if (stage === 'done' || STAGES.some((item) => item.id === stage)) return stage as PipelineStage
  return LEGACY_STAGES[stage] || 'plan'
}

function normalizePipeline(pipeline: PipelineData): PipelineData {
  return {
    ...pipeline,
    currentStage: normalizeStage(pipeline.currentStage),
    completedStages: [...new Set((pipeline.completedStages || []).map((stage) => normalizeStage(stage)))].filter((stage) => stage !== 'done'),
    skippedStages: pipeline.skippedStages || [],
    receipts: pipeline.receipts || [],
  }
}

function stageInfo(stage: PipelineStage) {
  return STAGES.find((item) => item.id === stage)
}

function canDoStage(user: AuthUser | null, stage: PipelineStage, executionMode: PipelineExecutionMode = 'delegated') {
  const info = stageInfo(stage)
  if (!info) return false
  if (executionMode === 'solo') return isFullAccessRole(user?.role)
  return canAccess(user, info.permission[0], info.permission[1])
}

const ACTIVE_PIPELINE_KEY = 'tri_active_pipeline_id'

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
    singleUnitAmount: 1,
    singleUnitMeasure: 'ml',
    ingredients: [],
    targetQuantity: 0,
    scheduledDate: new Date().toISOString().slice(0, 10),
    currentStage: 'plan',
    completedStages: [],
    executionMode: 'delegated',
    activityLog: [],
    totalIngredients: [],
    totalMaterialCost: 0,
    producedQuantity: 0,
    qualityResult: null,
    sellingPricePerUnit: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}


function loadPipelines(user?: PipelineStorageScope): PipelineData[] {
  return readStoredPipelines<PipelineData>(user)
}

function savePipelines(pipelines: PipelineData[], user?: PipelineStorageScope) {
  writeStoredPipelines(pipelines, user)
}

/* ──────────────────────────────── Main Component ──────────────────────────────── */

type PipelineProps = {
  theme?: Theme
  toggleTheme?: () => void
  currency?: string
}

type StepName = 'submit' | 'check-stock' | 'recheck' | 'purchase-order' | 'pay' | 'receive' | 'make' | 'quality' | 'store'
type RunStep = (pipeline: PipelineData, step: StepName, body?: Record<string, unknown>) => Promise<boolean>

export function ProductionPipeline({ theme = 'dark', toggleTheme = () => {}, currency = 'RWF' }: PipelineProps) {
  const { user } = useAuth()
  const [pipelines, setPipelines] = useState<PipelineData[]>(() => loadPipelines(user).map(normalizePipeline))
  const [activePipelineId, setActivePipelineId] = useState<string | null>(() => localStorage.getItem(ACTIVE_PIPELINE_KEY))
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [businessTemplate, setBusinessTemplate] = useState<string>('')
  const [catalogItems, setCatalogItems] = useState<ItemMaster[]>([])
  const [recordedUnits, setRecordedUnits] = useState<string[]>([])
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([])
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false)
  const [showCatalogModal, setShowCatalogModal] = useState(false)
  const [pendingAddProductCb, setPendingAddProductCb] = useState<((item: ItemMaster) => void) | null>(null)
  const [pendingAddIngredientCb, setPendingAddIngredientCb] = useState<((item: ItemMaster) => void) | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [openPlanModalAfterCreate, setOpenPlanModalAfterCreate] = useState(false)

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
            itemType: (r.itemType as ItemMaster['itemType']) || (isFinishedProduct(r) ? 'finished_product' : 'raw_material'),
            baseUnit: r.baseUnit || 'piece',
            measurementAmount: Number(r.measurementAmount) || 1,
            status: r.status || 'Active',
            stock: Number(r.stock) || 0,
            minimumStock: r.minimumStock || 0,
            maximumStock: r.maximumStock || 0,
            reorderLevel: r.reorderLevel || 0,
            defaultSupplierId: '',
            supplierOptions: [],
            purchasePrice: r.purchasePrice ?? r.rawPrice ?? 0,
            sellingPrice: r.sellingPrice ?? r.rawPrice ?? 0,
            priceTiers: [],
            defaultWarehouseCode: '',
            batchTracking: false,
            expiryTracking: false,
            serialTracking: false,
          })
        }
      })
      setCatalogItems(Array.from(itemMap.values()))

      const defaultUnits = ['piece', 'kg', 'g', 'litre', 'ml', 'cup', 'plate', 'box', 'bag', 'hour', 'batch', 'unit']
      const mdUnits = (mdRes?.units || []).map((u) => u.code || u.name).filter(Boolean)
      const configUnits = prodRes?.configuration?.units || []
      setRecordedUnits(Array.from(new Set([...defaultUnits, ...mdUnits, ...configUnits].map((u) => cleanUnitName(u)).filter(Boolean))))
      if (prodRes?.recipes) setRecipes(prodRes.recipes)

      // The server is the source of truth for every order and its progress.
      const serverRes = await api.listPipelines<PipelineData>().catch(() => null)
      if (serverRes) {
        const serverPipelines = serverRes.pipelines.map(normalizePipeline)
        setPipelines((existing) => {
          const map = new Map<string, PipelineData>()
          serverPipelines.forEach((sp) => map.set(sp.id, sp))
          // Keep unsaved drafts that never reached the server.
          existing.forEach((ep) => {
            if (!map.has(ep.id) && ep.currentStage === 'plan') map.set(ep.id, ep)
          })
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
          )
          savePipelines(merged, user)
          return merged
        })
      }
    } catch (e) {
      console.warn('Could not load production data:', e)
    }
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is only set after the request resolves
    void refreshCatalog()
  }, [refreshCatalog])

  useEffect(() => {
    api.businessFeatures()
      .then((result) => setBusinessTemplate(result.template || ''))
      .catch(() => setBusinessTemplate(''))
  }, [])

  const catalogProducts = useMemo(() => catalogItems.filter((i) => isFinishedProduct(i)), [catalogItems])
  const catalogIngredients = useMemo(() => catalogItems.filter((i) => !isFinishedProduct(i)), [catalogItems])

  const activePipeline = pipelines.find((p) => p.id === activePipelineId) || null
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const visiblePipelines = normalizedSearchQuery
    ? pipelines.filter((pipeline) => [pipeline.productName, pipeline.id].join(' ').toLocaleLowerCase().includes(normalizedSearchQuery))
    : pipelines

  const replacePipeline = useCallback((data: PipelineData) => {
    setPipelines((current) => {
      const next = current.some((p) => p.id === data.id) ? current.map((p) => (p.id === data.id ? data : p)) : [data, ...current]
      savePipelines(next, user)
      return next
    })
  }, [user])

  // Only the order (plan) and the Team/Solo switch are edited directly.
  const updatePipeline = useCallback((data: PipelineData) => {
    const updated = { ...data, updatedAt: new Date().toISOString() }
    replacePipeline(updated)
    api.savePipelineToServer(updated).catch(() => {})
  }, [replacePipeline])

  const runStep: RunStep = useCallback(async (pipeline, step, body = {}) => {
    try {
      const result = await api.pipelineStep<PipelineData>(pipeline.id, step, body)
      const updated = normalizePipeline(result.pipeline)
      replacePipeline(updated)
      const latest = updated.activityLog?.[0]
      setNotice({ tone: 'success', text: latest?.summary || 'Saved' })
      return true
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save this step.' })
      return false
    }
  }, [replacePipeline])

  const createNew = () => {
    const pipeline = createEmptyPipeline()
    replacePipeline(pipeline)
    setActivePipelineId(pipeline.id)
    localStorage.setItem(ACTIVE_PIPELINE_KEY, pipeline.id)
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
    if (!window.confirm('Delete this production order? Stock already moved stays as it is.')) return
    setPipelines((current) => {
      const next = current.filter((p) => p.id !== id)
      savePipelines(next, user)
      return next
    })
    if (activePipelineId === id) goBack()
    api.deletePipelineFromServer(id).catch(() => {})
  }

  const deleteDrafts = (ids: string[]) => {
    if (!window.confirm(`Remove ${ids.length} empty draft order${ids.length === 1 ? '' : 's'}?`)) return
    setPipelines((current) => {
      const next = current.filter((p) => !ids.includes(p.id))
      savePipelines(next, user)
      return next
    })
    ids.forEach((id) => api.deletePipelineFromServer(id).catch(() => {}))
  }

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), notice.tone === 'error' ? 7000 : 4000)
    return () => clearTimeout(timer)
  }, [notice])

  return (
    <>
      <Topbar title="Production" placeholder="Search production orders..." theme={theme} toggleTheme={toggleTheme} onSearchChange={setSearchQuery} />
      <main className={`pipeline-page page-pad ${activePipeline ? 'has-workspace' : ''}`}>
        {notice && <div className={`pipeline-notice ${notice.tone}`} role="status">{notice.text}</div>}

        {activePipeline ? (
          <PipelineWorkspace
            key={activePipeline.id}
            businessTemplate={businessTemplate}
            pipeline={activePipeline}
            currency={currency}
            onUpdate={updatePipeline}
            onRunStep={runStep}
            onBack={goBack}
            onNotice={setNotice}
            onCreateNew={createNew}
            initialPlanModalOpen={openPlanModalAfterCreate}
            onPlanModalOpened={() => setOpenPlanModalAfterCreate(false)}
            catalogProducts={catalogProducts}
            catalogIngredients={catalogIngredients}
            recordedUnits={recordedUnits}
            recipes={recipes}
            onAddProduct={() => setShowAddProductModal(true)}
            onAddIngredient={(cb) => {
              if (cb) setPendingAddIngredientCb(() => cb)
              setShowAddIngredientModal(true)
            }}
          />
        ) : (
          <PipelineList
            pipelines={visiblePipelines}
            currency={currency}
            onOpen={openPipeline}
            onCreate={() => {
              setOpenPlanModalAfterCreate(true)
              createNew()
            }}
            onDelete={deletePipeline}
            onDeleteDrafts={deleteDrafts}
            onOpenCatalog={() => setShowCatalogModal(true)}
            searchQuery={searchQuery}
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
              setNotice({ tone: 'success', text: `Product "${item.item}" added` })
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
              setNotice({ tone: 'success', text: `Material "${item.item}" added` })
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
  const [measurementAmount, setMeasurementAmount] = useState('1')
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
        measurementAmount: Number(measurementAmount),
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
                <select value={itemType} onChange={(e) => setItemType(e.target.value as typeof itemType)}>
                  <option value="raw_material">Raw Material / Ingredient</option>
                  <option value="packaging_material">Packaging / Container</option>
                </select>
              </label>
              <label className="pipeline-field">
                <span>Measurement Amount *</span>
                <input
                  type="number"
                  required
                  min="0.00000001"
                  step="any"
                  placeholder="e.g. 2 or 200"
                  value={measurementAmount}
                  onChange={(e) => setMeasurementAmount(e.target.value)}
                />
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

/* ──────────────────────────────── Order List & Dashboard ──────────────────────────────── */

type ListFilter = 'active' | 'mine' | 'done'

// Orders opened and closed without filling anything in.
function isEmptyDraft(p: PipelineData) {
  return p.currentStage === 'plan' && !p.productName.trim() && p.ingredients.length === 0
}

function PipelineList({
  pipelines,
  currency,
  onOpen,
  onCreate,
  onDelete,
  onDeleteDrafts,
  onOpenCatalog,
  searchQuery,
}: {
  pipelines: PipelineData[]
  currency: string
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onDeleteDrafts: (ids: string[]) => void
  onOpenCatalog?: () => void
  searchQuery?: string
}) {
  const { user } = useAuth()
  const drafts = pipelines.filter(isEmptyDraft)
  const orders = pipelines.filter((p) => !isEmptyDraft(p))
  const active = orders.filter((p) => p.currentStage !== 'done')
  const mine = active.filter((p) => canDoStage(user, p.currentStage, p.executionMode))
  const done = orders.filter((p) => p.currentStage === 'done')
  const [chosenFilter, setFilter] = useState<ListFilter | null>(null)
  const [stepFilter, setStepFilter] = useState<PipelineStage | null>(null)
  const filter: ListFilter = chosenFilter ?? (mine.length ? 'mine' : 'active')
  const rows = stepFilter
    ? active.filter((p) => p.currentStage === stepFilter)
    : filter === 'mine' ? mine : filter === 'done' ? done : active
  const canCreate = canAccess(user, 'production', 'create')
  const canDelete = canAccess(user, 'production', 'delete')

  // Dashboard figures
  const month = new Date().toISOString().slice(0, 7)
  const doneThisMonth = done.filter((p) => (p.storage?.date || p.production?.date || p.updatedAt || '').slice(0, 7) === month)
  const madeThisMonth = doneThisMonth.reduce((sum, p) => sum + Number(p.storage?.quantity || 0), 0)
  const costThisMonth = doneThisMonth.reduce((sum, p) => sum + Number(p.production?.materialsCost || 0), 0)
  const buying = active.filter((p) => ['purchase_order', 'payment', 'receive'].includes(p.currentStage))
  const openPurchaseValue = buying.reduce((sum, p) => sum + Number(p.purchaseOrder?.total || 0), 0)
  const owed = orders.reduce((sum, p) => sum + Number(p.payment?.balance || 0), 0)

  const chooseFilter = (value: ListFilter) => {
    setStepFilter(null)
    setFilter(value)
  }

  const empty = searchQuery?.trim()
    ? 'No matching orders'
    : stepFilter ? 'No orders at this step'
      : filter === 'mine' ? 'Nothing waiting for you' : filter === 'done' ? 'No completed orders yet' : 'No orders in progress'

  return (
    <section className="pipeline-list">
      <div className="page-title-row">
        <h1>Production</h1>
        <div className="toolbar">
          {onOpenCatalog && canCreate && <button type="button" className="secondary-action" onClick={onOpenCatalog}>Catalog</button>}
          {canCreate && <button type="button" className="primary-action" onClick={onCreate}>+ New order</button>}
        </div>
      </div>

      <StageStats items={[
        { label: 'In progress', value: active.length },
        { label: 'Waiting for you', value: mine.length, tone: mine.length ? 'good' : undefined },
        { label: 'Buying materials', value: buying.length ? `${buying.length} · ${formatMoney(openPurchaseValue, currency)}` : 0 },
        { label: 'Owed to suppliers', value: formatMoney(owed, currency), tone: owed > 0 ? 'bad' : undefined },
        { label: 'Made this month', value: `${madeThisMonth.toLocaleString()} (${doneThisMonth.length} orders)` },
        { label: 'Cost this month', value: formatMoney(costThisMonth, currency) },
      ]} />

      <div className="order-funnel" aria-label="Orders by step">
        {STAGES.map((s, index) => {
          const count = active.filter((p) => p.currentStage === s.id).length
          const yours = canDoStage(user, s.id)
          return (
            <button
              key={s.id}
              type="button"
              className={`order-funnel-step ${count ? 'busy' : ''} ${stepFilter === s.id ? 'active' : ''}`}
              onClick={() => setStepFilter(stepFilter === s.id ? null : s.id)}
              title={`${s.label} · ${s.owner}`}
            >
              <span className="order-funnel-count">{count}</span>
              <span className="order-funnel-label">{index + 1}. {s.label}</span>
              <span className={`order-funnel-owner ${yours ? 'mine' : ''}`}>{s.owner}</span>
            </button>
          )
        })}
      </div>

      <div className="order-list-bar">
        <div className="segmented" role="tablist" aria-label="Orders">
          <button type="button" className={!stepFilter && filter === 'mine' ? 'active' : ''} onClick={() => chooseFilter('mine')}>
            My tasks{mine.length > 0 && <span className="count-badge">{mine.length}</span>}
          </button>
          <button type="button" className={!stepFilter && filter === 'active' ? 'active' : ''} onClick={() => chooseFilter('active')}>In progress ({active.length})</button>
          <button type="button" className={!stepFilter && filter === 'done' ? 'active' : ''} onClick={() => chooseFilter('done')}>Complete ({done.length})</button>
        </div>
        {stepFilter && <span className="current-shop">Step: <b>{stageInfo(stepFilter)?.label}</b> <button type="button" className="link-button" onClick={() => setStepFilter(null)}>Clear</button></span>}
        {canDelete && drafts.length > 0 && (
          <button type="button" className="link-button order-drafts" onClick={() => onDeleteDrafts(drafts.map((d) => d.id))}>
            Remove {drafts.length} empty draft{drafts.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <div className="table-frame pipeline-order-table">
        <table>
          <thead>
            <tr><th>Product</th><th>Quantity</th><th>Step</th><th>Waiting for</th><th>Updated</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="empty-state">{empty}</td></tr>}
            {rows.map((p) => {
              const index = STAGES.findIndex((s) => s.id === p.currentStage)
              const info = stageInfo(p.currentStage)
              const yours = canDoStage(user, p.currentStage, p.executionMode)
              return (
                <tr key={p.id} className="clickable-row" onClick={() => onOpen(p.id)}>
                  <td><strong>{p.productName || 'Order (not filled in)'}</strong><small className="stage-subtext">{p.id}</small></td>
                  <td>{p.targetQuantity > 0 ? formatUnitQty(p.targetQuantity, p.singleUnitLabel) : '—'}</td>
                  <td>
                    {p.currentStage === 'done'
                      ? <span className="pipeline-shortage-badge ok">Complete</span>
                      : <span className="order-step"><b>{index + 1}/{STAGES.length}</b> {info?.label}</span>}
                  </td>
                  <td>
                    {p.currentStage === 'done' ? '—' : <span className={`stage-role ${yours ? 'mine' : ''}`}>{yours ? 'You' : info?.owner}</span>}
                  </td>
                  <td className="text-muted">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}</td>
                  <td className="stage-row-action">
                    {canDelete && (
                      <button type="button" className="link-button danger-link" onClick={(e) => { e.stopPropagation(); onDelete(p.id) }} aria-label={`Delete ${p.productName || 'order'}`}>Delete</button>
                    )}
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

/* ──────────────────────── Shared stage layout & activity log ──────────────────────── */

/* One header row with the step's main action, a one-line stats strip, and a body that fills the rest. */
function StageHeader({ stage, title, status, children }: {
  stage: PipelineStage
  title?: string
  status?: ReactNode
  children?: ReactNode
}) {
  const index = STAGES.findIndex((s) => s.id === stage)
  const info = stageInfo(stage)
  return (
    <header className="stage-head">
      {index >= 0 && <span className="stage-step">{index + 1}/{STAGES.length}</span>}
      <h2>{title || info?.label}</h2>
      {info && <span className="stage-owner">{info.owner}</span>}
      {status && <div className="stage-status">{status}</div>}
      <div className="stage-actions">{children}</div>
    </header>
  )
}

type StageStat = { label: string; value: ReactNode; tone?: 'good' | 'bad' }

function StageStats({ items }: { items: StageStat[] }) {
  return (
    <dl className="stage-stats">
      {items.map((item) => (
        <div key={item.label} className={item.tone || ''}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Waiting({ stage }: { stage: PipelineStage }) {
  return <span className="stage-waiting">Waiting for {stageInfo(stage)?.owner || 'someone else'}</span>
}

function PipelineAuditModal({ pipeline, onClose }: { pipeline: PipelineData; onClose: () => void }) {
  const logs = pipeline.activityLog || []
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="entry-modal pipeline-activity-modal" role="dialog" aria-modal="true" aria-label="Activity">
        <header className="detail-head transfer-detail-head">
          <h2>Activity <span className="count-badge">{logs.length}</span></h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        {logs.length === 0 ? (
          <p className="empty-state">No activity yet</p>
        ) : (
          <ol className="activity-list">
            {logs.map((log) => (
              <li key={log.id}>
                <div>
                  <strong>{log.stageLabel || log.stage}</strong>
                  <span>{log.performedBy}{log.performedByRole ? ` · ${log.performedByRole.replace(/_/g, ' ')}` : ''}</span>
                </div>
                <p>{log.summary}</p>
                <time>{new Date(log.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

/* ──────────────────────────────── Order Workspace ──────────────────────────────── */

function planBody(pipeline: PipelineData) {
  return {
    productName: pipeline.productName,
    businessType: pipeline.businessType,
    singleUnitLabel: pipeline.singleUnitLabel,
    ingredients: pipeline.ingredients,
    targetQuantity: pipeline.targetQuantity,
    scheduledDate: pipeline.scheduledDate,
    sellingPricePerUnit: pipeline.sellingPricePerUnit,
  }
}

type StageProps = {
  pipeline: PipelineData
  currency: string
  canAct: boolean
  run: (step: StepName, body?: Record<string, unknown>) => Promise<boolean>
}

function PipelineWorkspace({
  pipeline,
  currency,
  onUpdate,
  onRunStep,
  onBack,
  onNotice,
  businessTemplate,
  onCreateNew,
  initialPlanModalOpen = false,
  onPlanModalOpened,
  catalogProducts = [],
  catalogIngredients = [],
  recordedUnits = [],
  recipes = [],
  onAddProduct,
  onAddIngredient,
}: {
  pipeline: PipelineData
  currency: string
  onUpdate: (data: PipelineData) => void
  onRunStep: RunStep
  onBack: () => void
  onNotice: (notice: { tone: 'success' | 'error' | 'info'; text: string }) => void
  businessTemplate: string
  onCreateNew: () => void
  initialPlanModalOpen?: boolean
  onPlanModalOpened?: () => void
  catalogProducts?: ItemMaster[]
  catalogIngredients?: ItemMaster[]
  recordedUnits?: string[]
  recipes?: ProductionRecipe[]
  onAddProduct?: () => void
  onAddIngredient?: (callback?: (newItem: ItemMaster) => void) => void
}) {
  const { user } = useAuth()
  const isAdmin = isFullAccessRole(user?.role)
  const [viewStage, setViewStage] = useState<PipelineStage | null>(null)
  const [showActivity, setShowActivity] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(initialPlanModalOpen)

  useEffect(() => {
    if (initialPlanModalOpen) onPlanModalOpened?.()
  }, [initialPlanModalOpen, onPlanModalOpened])

  const stage = pipeline.currentStage
  const shown = viewStage && viewStage !== stage ? viewStage : stage
  const canAct = canDoStage(user, stage, pipeline.executionMode)
  const skipped = pipeline.skippedStages || []
  const currentIndex = STAGES.findIndex((s) => s.id === stage)
  const run = (step: StepName, body?: Record<string, unknown>) => onRunStep(pipeline, step, body)
  const stageProps: StageProps = { pipeline, currency, canAct, run }

  return (
    <div className="pipeline-workspace">
      <header className="pipeline-ws-bar">
        <button className="pipeline-btn-back" type="button" onClick={onBack} title="All orders" aria-label="All orders">←</button>
        <h1>{pipeline.productName || 'New order'}</h1>
        {stage === 'done'
          ? <span className="pipeline-shortage-badge ok">Complete</span>
          : <span className={`stage-role ${canAct ? 'mine' : ''}`}>{canAct ? `Your step: ${stageInfo(stage)?.label}` : `Waiting for ${stageInfo(stage)?.owner}`}</span>}
        <div className="pipeline-ws-tools">
          {isAdmin && stage !== 'done' && (
            <div className="segmented" role="group" aria-label="Who runs the steps">
              <button type="button" className={pipeline.executionMode !== 'solo' ? 'active' : ''} title="Each step is done by its team" onClick={() => onUpdate({ ...pipeline, executionMode: 'delegated' })}>Team</button>
              <button type="button" className={pipeline.executionMode === 'solo' ? 'active' : ''} title="Only you run the steps" onClick={() => onUpdate({ ...pipeline, executionMode: 'solo' })}>Solo</button>
            </div>
          )}
          <button className="pipeline-icon-action" type="button" onClick={() => setShowActivity(true)}>
            Activity ({pipeline.activityLog?.length || 0})
          </button>
          {canAccess(user, 'production', 'create') && (
            <button className="pipeline-btn-primary" type="button" onClick={() => { onCreateNew(); setShowPlanModal(true) }}>New order</button>
          )}
        </div>
      </header>

      <nav className="pipeline-progress" aria-label="Steps">
        {STAGES.map((s, idx) => {
          const isSkipped = skipped.includes(s.id)
          const isCompleted = !isSkipped && (pipeline.completedStages.includes(s.id) || stage === 'done')
          const isCurrent = stage === s.id
          const viewable = isCompleted || isCurrent
          return (
            <button
              key={s.id}
              type="button"
              className={`pipeline-stage-node ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isSkipped ? 'skipped' : ''} ${!viewable ? 'locked' : ''} ${shown === s.id ? 'viewing' : ''}`}
              onClick={() => viewable && setViewStage(s.id === stage ? null : s.id)}
              disabled={!viewable}
              title={isSkipped ? `${s.label}: not needed, everything was in stock` : `${s.label} · ${s.owner}`}
            >
              <span className="pipeline-stage-icon">{isSkipped ? '–' : isCompleted ? '✓' : idx + 1}</span>
              <span className="pipeline-stage-label">{s.shortLabel}</span>
              {idx < STAGES.length - 1 && <span className={`pipeline-stage-connector ${isCompleted || (idx < currentIndex) ? 'completed' : ''}`} />}
            </button>
          )
        })}
      </nav>

      <section className="pipeline-stage-content">
        {shown !== stage ? (
          <StageRecord pipeline={pipeline} stage={shown} currency={currency} onClose={() => setViewStage(null)} />
        ) : (
          <>
            {stage === 'plan' && (
              showPlanModal ? (
                <div className="pipeline-modal-backdrop" role="presentation" onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setShowPlanModal(false)
                }}>
                  <PlanStage
                    pipeline={pipeline}
                    currency={currency}
                    onUpdate={onUpdate}
                    onAdvance={(updated) => {
                      setShowPlanModal(false)
                      void onRunStep(updated, 'submit', planBody(updated))
                    }}
                    onNotice={onNotice}
                    businessTemplate={businessTemplate}
                    catalogProducts={catalogProducts}
                    catalogIngredients={catalogIngredients}
                    recordedUnits={recordedUnits}
                    recipes={recipes}
                    onOpenAddProduct={onAddProduct}
                    onOpenAddIngredient={onAddIngredient}
                    isModal
                    onClose={() => setShowPlanModal(false)}
                  />
                </div>
              ) : (
                <OrderOverview {...stageProps} onEdit={() => setShowPlanModal(true)} />
              )
            )}
            {stage === 'check_stock' && <CheckStockStage {...stageProps} />}
            {stage === 'purchase_order' && <PurchaseOrderStage {...stageProps} />}
            {stage === 'payment' && <PaymentStage {...stageProps} />}
            {stage === 'receive' && <ReceiveStage {...stageProps} />}
            {stage === 'make' && <MakeStage {...stageProps} />}
            {stage === 'quality_check' && <QualityStage {...stageProps} />}
            {stage === 'store' && <StoreStage {...stageProps} />}
            {stage === 'done' && <DoneStage pipeline={pipeline} currency={currency} onCreateNew={() => { onCreateNew(); setShowPlanModal(true) }} />}
          </>
        )}
      </section>

      {showActivity && <PipelineAuditModal pipeline={pipeline} onClose={() => setShowActivity(false)} />}
    </div>
  )
}

/* ─── 1. ORDER ─── */
function OrderOverview({ pipeline, currency, canAct, run, onEdit }: StageProps & { onEdit: () => void }) {
  const [busy, setBusy] = useState(false)
  const ready = Boolean(pipeline.productName) && pipeline.targetQuantity > 0 && pipeline.ingredients.length > 0
  return (
    <div className="pipeline-stage-card">
      <StageHeader stage="plan">
        {canAct ? (
          <>
            <button type="button" className="pipeline-btn-secondary" onClick={onEdit}>{ready ? 'Edit order' : 'Fill in order'}</button>
            <button type="button" className="pipeline-btn-primary" disabled={!ready || busy} onClick={async () => { setBusy(true); await run('submit', planBody(pipeline)); setBusy(false) }}>
              Check stock
            </button>
          </>
        ) : <Waiting stage="plan" />}
      </StageHeader>
      <StageStats items={[
        { label: 'Make', value: pipeline.targetQuantity > 0 ? formatUnitQty(pipeline.targetQuantity, pipeline.singleUnitLabel) : '—' },
        { label: 'Materials', value: `${pipeline.ingredients.length} items` },
        { label: 'Planned cost', value: formatMoney(pipeline.totalMaterialCost, currency) },
        { label: 'Date', value: pipeline.scheduledDate || '—' },
      ]} />
      <MaterialsTable pipeline={pipeline} currency={currency} />
    </div>
  )
}

function MaterialsTable({ pipeline, currency }: { pipeline: PipelineData; currency: string }) {
  const unit = cleanUnitName(pipeline.singleUnitLabel)
  return (
    <div className="stage-body table-frame">
      <table className="stage-table">
        <thead><tr><th>Material</th><th>Per {unit}</th><th>Total needed</th><th>Planned cost</th></tr></thead>
        <tbody>
          {pipeline.totalIngredients.length === 0 && <tr><td colSpan={4} className="empty-state">No materials yet</td></tr>}
          {pipeline.totalIngredients.map((ing) => (
            <tr key={ing.id}>
              <td><strong>{ing.name}</strong></td>
              <td>{ing.quantity} {ing.unit}</td>
              <td>{ing.totalQuantity.toLocaleString()} {ing.unit}</td>
              <td>{formatMoney(ing.totalCost, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
  isModal = false,
  onClose,
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
  isModal?: boolean
  onClose?: () => void
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
  const [singleUnitAmount, setSingleUnitAmount] = useState(pipeline.singleUnitAmount || 1)
  const [singleUnitMeasure, setSingleUnitMeasure] = useState(pipeline.singleUnitMeasure || 'ml')
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    if (pipeline.ingredients.length > 0) return pipeline.ingredients
    if (detectedPreset && detectedPreset.ingredients.length > 0) {
      return detectedPreset.ingredients.map((ing, idx) => ({ ...ing, id: String(idx + 1) }))
    }
    return []
  })
  const [targetQuantity, setTargetQuantity] = useState(pipeline.targetQuantity || 0)
  const [scheduledDate, setScheduledDate] = useState(pipeline.scheduledDate || new Date().toISOString().slice(0, 10))
  const [sellingPrice, setSellingPrice] = useState(pipeline.sellingPricePerUnit)

  // Match the saved product once the catalog has loaded.
  if (pipeline.productName && !selectedProductSku && catalogProducts.length > 0) {
    const match = catalogProducts.find((p) => p.item.toLowerCase() === pipeline.productName.toLowerCase())
    setSelectedProductSku(match ? match.sku : '__custom__')
  }

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
      singleUnitAmount,
      singleUnitMeasure: cleanUnitName(singleUnitMeasure),
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

  const unitName = cleanUnitName(singleUnitLabel) || 'unit'
  const totalCost = unitCostPerProduct * targetQuantity
  const expectedProfit = sellingPrice * targetQuantity - totalCost
  const unitOptions = (current: string) => (
    <>
      {!availableUnits.includes(cleanUnitName(current)) && current && <option value={cleanUnitName(current)}>{cleanUnitName(current)}</option>}
      {availableUnits.map((u) => <option key={u} value={u}>{u}</option>)}
    </>
  )

  return (
    <div className={`pipeline-stage-card order-form ${isModal ? 'pipeline-plan-modal-card' : ''}`}>
      <form className="order-form-body" onSubmit={handleSubmit}>
        <header className="stage-head order-form-head">
          <span className="stage-step">1/{STAGES.length}</span>
          <h2>Order</h2>
          {isModal && onClose && (
            <button type="button" className="modal-close order-form-close" onClick={onClose} aria-label="Close">×</button>
          )}
        </header>

        {/* What and how many come first. */}
        <div className="order-form-main">
          <label className="order-field order-product">
            <span>
              Product
              {onOpenAddProduct && <button type="button" className="link-button" onClick={onOpenAddProduct}>+ New product</button>}
            </span>
            <select value={selectedProductSku} onChange={(e) => handleProductSelect(e.target.value)}>
              <option value="">Choose a product…</option>
              {catalogProducts.map((p) => (
                <option key={p.sku} value={p.sku}>{p.item} · {formatMoney(p.sellingPrice || p.price || 0, currency)}</option>
              ))}
              <option value="__custom__">Other (type the name)</option>
            </select>
            {(selectedProductSku === '__custom__' || (!selectedProductSku && productName)) && (
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Product name, e.g. African tea"
                required
                autoFocus
              />
            )}
          </label>

          <label className="order-field order-quantity">
            <span>How many to make</span>
            <div className="order-quantity-input">
              <input
                type="number"
                min="0.0001"
                step="any"
                value={targetQuantity || ''}
                onChange={(e) => setTargetQuantity(Number(e.target.value))}
                placeholder="e.g. 100"
                required
              />
              <select value={unitName} onChange={(e) => setSingleUnitLabel(cleanUnitName(e.target.value))} aria-label="Unit">
                {unitOptions(singleUnitLabel)}
              </select>
            </div>
          </label>

          <label className="order-field">
            <span>Date</span>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </label>

          <label className="order-field">
            <span>Selling price / {unitName} ({currency})</span>
            <input type="number" min="0" step="any" value={sellingPrice || ''} onChange={(e) => setSellingPrice(Number(e.target.value))} placeholder="Optional" />
          </label>
        </div>

        {/* Recipe for one unit; only this part scrolls when it is long. */}
        <section className="order-recipe">
          <div className="order-recipe-head">
            <h3>Recipe for 1 {unitName}</h3>
            <span className="order-size">
              1 {unitName} =
              <input type="number" min="0" step="any" value={singleUnitAmount || ''} onChange={(e) => setSingleUnitAmount(Number(e.target.value))} aria-label={`Size of 1 ${unitName}`} />
              <select value={cleanUnitName(singleUnitMeasure)} onChange={(e) => setSingleUnitMeasure(cleanUnitName(e.target.value))} aria-label="Size unit">
                {unitOptions(singleUnitMeasure)}
              </select>
            </span>
            <div className="order-recipe-actions">
              <button className="pipeline-btn-secondary" type="button" onClick={addIngredient}>+ Add material</button>
              {onOpenAddIngredient && (
                <button
                  className="link-button"
                  type="button"
                  onClick={() =>
                    onOpenAddIngredient((newItem) => {
                      setIngredients((current) => [
                        ...current,
                        { id: String(Date.now()), name: newItem.item, quantity: 1, unit: cleanUnitName(newItem.baseUnit || 'piece'), unitCost: Number(newItem.purchasePrice || 0) },
                      ])
                    })
                  }
                >
                  + New material
                </button>
              )}
            </div>
          </div>

          <div className="stage-body table-frame">
            <table className="stage-table order-recipe-table">
              <thead>
                <tr><th>Material</th><th>Per {unitName}</th><th>Unit</th><th>Cost / unit ({currency})</th><th>For {targetQuantity || 0}</th><th aria-label="Remove" /></tr>
              </thead>
              <tbody>
                {ingredients.length === 0 && (
                  <tr><td colSpan={6} className="empty-state">Add the materials needed to make 1 {unitName}</td></tr>
                )}
                {ingredients.map((ing) => {
                  const matched = catalogIngredients.find((item) => item.item.toLowerCase().trim() === ing.name.toLowerCase().trim())
                  const skuValue = matched ? matched.sku : (ing.name ? '__custom__' : '')
                  return (
                    <tr key={ing.id}>
                      <td>
                        <div className="order-material">
                          <select value={skuValue} onChange={(e) => handleSelectIngredientRow(ing.id, e.target.value)} aria-label="Material">
                            <option value="">Choose…</option>
                            {catalogIngredients.map((item) => (
                              <option key={item.sku} value={item.sku}>{item.item} ({item.baseUnit || 'unit'})</option>
                            ))}
                            <option value="__custom__">Other (type the name)</option>
                          </select>
                          {skuValue === '__custom__' && (
                            <input type="text" value={ing.name} onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)} placeholder="Material name" required />
                          )}
                        </div>
                      </td>
                      <td><input className="stage-input" type="number" min="0.0001" step="any" value={ing.quantity || ''} onChange={(e) => updateIngredient(ing.id, 'quantity', Number(e.target.value))} required aria-label={`${ing.name || 'Material'} per ${unitName}`} /></td>
                      <td>
                        <select className="stage-input wide" value={cleanUnitName(ing.unit || 'unit')} onChange={(e) => updateIngredient(ing.id, 'unit', cleanUnitName(e.target.value))} aria-label="Unit">
                          {unitOptions(ing.unit)}
                        </select>
                      </td>
                      <td><input className="stage-input" type="number" min="0" step="any" value={ing.unitCost || ''} onChange={(e) => updateIngredient(ing.id, 'unitCost', Number(e.target.value))} aria-label="Cost per unit" /></td>
                      <td className="text-muted">{ing.quantity > 0 && targetQuantity > 0 ? `${Number((ing.quantity * targetQuantity).toFixed(3)).toLocaleString()} ${cleanUnitName(ing.unit)}` : '—'}</td>
                      <td><button type="button" className="pipeline-btn-remove" onClick={() => removeIngredient(ing.id)} aria-label="Remove material">✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Always visible: what this order adds up to, and the save button. */}
        <footer className="order-form-footer">
          <StageStats items={[
            { label: 'Make', value: targetQuantity > 0 ? formatUnitQty(targetQuantity, unitName) : '—' },
            { label: 'Materials', value: ingredients.filter((i) => i.name.trim()).length },
            { label: `Cost / ${unitName}`, value: formatMoney(unitCostPerProduct, currency) },
            { label: 'Total cost', value: formatMoney(totalCost, currency) },
            ...(sellingPrice > 0 ? [{ label: 'Expected profit', value: formatMoney(expectedProfit, currency), tone: expectedProfit >= 0 ? 'good' as const : 'bad' as const }] : []),
          ]} />
          <button className="pipeline-btn-primary" type="submit">Save &amp; check stock</button>
        </footer>
      </form>
    </div>
  )
}

/* ─── Shared: live stock check against the materials in inventory ─── */
function useStockCheck(pipelineId: string) {
  const [lines, setLines] = useState<StockLine[] | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    api.pipelineStockCheck<StockLine>(pipelineId)
      .then((res) => { if (active) setLines(res.lines) })
      .catch(() => { if (active) setLines([]) })
    return () => { active = false }
  }, [pipelineId, revision])
  return { lines, reload: () => setRevision((value) => value + 1) }
}

function unitNote(line: StockLine) {
  return line.stockUnit && cleanUnitName(line.stockUnit) !== cleanUnitName(line.unit) ? `stock counted in ${line.stockUnit}` : ''
}

function StockTable({ lines, actionLabel = 'Short' }: { lines: StockLine[] | null; actionLabel?: string }) {
  return (
    <div className="stage-body table-frame">
      <table className="stage-table">
        <thead><tr><th>Material</th><th>Needed</th><th>In stock</th><th>{actionLabel}</th></tr></thead>
        <tbody>
          {!lines && <tr><td colSpan={4} className="empty-state">Checking stock…</td></tr>}
          {lines?.map((line) => {
            const note = [line.stockItem && line.stockItem.toLowerCase() !== line.name.toLowerCase() ? `uses ${line.stockItem}` : '', unitNote(line)].filter(Boolean).join(' · ')
            return (
              <tr key={line.ingredientId} className={line.shortage > 0 ? '' : 'row-done'}>
                <td><strong>{line.name}</strong>{note && <small className="stage-subtext">{note}</small>}</td>
                <td>{line.needed.toLocaleString()} {line.unit}</td>
                <td>{line.sku ? `${line.inStock.toLocaleString()} ${line.unit}` : <span className="text-muted">not in stock</span>}</td>
                <td className={line.shortage > 0 ? 'text-bad' : 'text-good'}>{line.shortage > 0 ? `${line.shortage.toLocaleString()} ${line.unit}` : '✓'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── 2. CHECK STOCK ─── */
function CheckStockStage({ pipeline, canAct, run }: StageProps) {
  const { lines } = useStockCheck(pipeline.id)
  const [busy, setBusy] = useState(false)
  const short = (lines || []).filter((line) => line.shortage > 0)
  const isRecheck = (pipeline.receipts || []).length > 0
  return (
    <div className="pipeline-stage-card">
      <StageHeader
        stage="check_stock"
        status={lines && <span className={`pipeline-shortage-badge ${short.length ? 'short' : 'ok'}`}>{short.length ? `${short.length} short` : 'All in stock'}</span>}
      >
        {canAct ? (
          <button type="button" className="pipeline-btn-primary" disabled={!lines || busy} onClick={async () => { setBusy(true); await run('check-stock'); setBusy(false) }}>
            {short.length ? `Send ${short.length} to procurement` : 'Start making'}
          </button>
        ) : <Waiting stage="check_stock" />}
      </StageHeader>
      <StageStats items={[
        { label: 'Make', value: formatUnitQty(pipeline.targetQuantity, pipeline.singleUnitLabel) },
        { label: 'Materials', value: pipeline.totalIngredients.length },
        { label: 'In stock', value: lines ? lines.length - short.length : '…', tone: 'good' },
        { label: 'Short', value: lines ? short.length : '…', tone: short.length ? 'bad' : undefined },
      ]} />
      {isRecheck && short.length > 0 && <p className="notice warning">Still short after the last delivery.</p>}
      <StockTable lines={lines} />
    </div>
  )
}

/* ─── 3. PURCHASE ORDER (procurement) ─── */
function PurchaseOrderStage({ pipeline, currency, canAct, run }: StageProps) {
  const lines = pipeline.requisition?.lines || []
  const [supplier, setSupplier] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Record<string, { quantity: string; unitPrice: string }>>(() => Object.fromEntries(
    lines.map((line) => [line.ingredientId, { quantity: String(line.shortage), unitPrice: String(line.unitCost || 0) }]),
  ))
  const [busy, setBusy] = useState(false)
  const total = lines.reduce((sum, line) => sum + Number(items[line.ingredientId]?.quantity || 0) * Number(items[line.ingredientId]?.unitPrice || 0), 0)
  const setItem = (id: string, patch: Partial<{ quantity: string; unitPrice: string }>) => setItems({ ...items, [id]: { ...items[id], ...patch } })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    await run('purchase-order', {
      supplier,
      expectedDate,
      notes,
      lines: lines.map((line) => ({ ingredientId: line.ingredientId, quantity: Number(items[line.ingredientId]?.quantity), unitPrice: Number(items[line.ingredientId]?.unitPrice) })),
    })
    setBusy(false)
  }

  return (
    <form className="pipeline-stage-card" onSubmit={submit}>
      <StageHeader stage="purchase_order" status={<span className="pipeline-shortage-badge short">{lines.length} to buy</span>}>
        {canAct ? <button type="submit" className="pipeline-btn-primary" disabled={busy}>Send to finance</button> : <Waiting stage="purchase_order" />}
      </StageHeader>
      <fieldset className={`stage-fieldset ${canAct ? '' : 'readonly'}`} disabled={!canAct || busy}>
        <div className="stage-fields">
          <label>Supplier<input required value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Who will supply" /></label>
          <label>Expected delivery<input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></label>
          <label>Note<input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="stage-total"><span>Total</span><strong>{formatMoney(total, currency)}</strong></div>
        </div>
        <div className="stage-body table-frame">
          <table className="stage-table">
            <thead><tr><th>Material</th><th>Short</th><th>Order</th><th>Unit price</th><th>Total</th></tr></thead>
            <tbody>
              {lines.map((line) => {
                const item = items[line.ingredientId] || { quantity: '', unitPrice: '' }
                return (
                  <tr key={line.ingredientId}>
                    <td><strong>{line.name}</strong></td>
                    <td className="text-bad">{line.shortage.toLocaleString()} {line.unit}</td>
                    <td>
                      <span className="stage-input-unit">
                        <input className="stage-input" type="number" min={line.shortage} step="any" required value={item.quantity} onChange={(e) => setItem(line.ingredientId, { quantity: e.target.value })} aria-label={`${line.name} quantity`} />
                        {line.unit}
                      </span>
                    </td>
                    <td><input className="stage-input wide" type="number" min="0" step="any" required value={item.unitPrice} onChange={(e) => setItem(line.ingredientId, { unitPrice: e.target.value })} aria-label={`${line.name} unit price`} /></td>
                    <td><strong>{formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0), currency)}</strong></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </fieldset>
    </form>
  )
}

function OrderLinesTable({ lines, currency }: { lines: PurchaseOrderLine[]; currency: string }) {
  return (
    <div className="stage-body table-frame">
      <table className="stage-table">
        <thead><tr><th>Material</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.ingredientId}>
              <td><strong>{line.name}</strong></td>
              <td>{line.quantity.toLocaleString()} {line.unit}</td>
              <td>{formatMoney(line.unitPrice, currency)}</td>
              <td><strong>{formatMoney(line.total, currency)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── 4. PAYMENT (finance) ─── */
const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Card', 'Credit']

function PaymentStage({ pipeline, currency, canAct, run }: StageProps) {
  const { user } = useAuth()
  const order = pipeline.purchaseOrder
  const [method, setMethod] = useState('Cash')
  const [amount, setAmount] = useState(String(order?.total || 0))
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  if (!order) return <div className="pipeline-stage-card"><p className="empty-state">No purchase order</p></div>
  const raisedByMe = !isFullAccessRole(user?.role) && order.byId === user?.id
  const allowed = canAct && !raisedByMe
  const paid = Number(amount || 0)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    await run('pay', { method, amountPaid: paid, reference })
    setBusy(false)
  }

  return (
    <form className="pipeline-stage-card" onSubmit={submit}>
      <StageHeader stage="payment" status={<span className="pipeline-shortage-badge short">{formatMoney(order.total, currency)}</span>}>
        {allowed
          ? <button type="submit" className="pipeline-btn-primary" disabled={busy}>{method === 'Credit' || paid < order.total ? 'Approve' : 'Approve & pay'}</button>
          : raisedByMe ? <span className="stage-waiting">Another person must approve your order</span> : <Waiting stage="payment" />}
      </StageHeader>
      <StageStats items={[
        { label: 'Order', value: order.number },
        { label: 'Supplier', value: order.supplier },
        { label: 'Raised by', value: order.by },
        { label: 'Expected', value: order.expectedDate || '—' },
        { label: 'Total', value: formatMoney(order.total, currency) },
      ]} />
      <fieldset className={`stage-fieldset ${allowed ? '' : 'readonly'}`} disabled={!allowed || busy}>
        <div className="stage-fields">
          <label>Method
            <select value={method} onChange={(e) => { setMethod(e.target.value); setAmount(e.target.value === 'Credit' ? '0' : String(order.total)) }}>
              {PAYMENT_METHODS.map((option) => <option key={option} value={option}>{option === 'Credit' ? 'Credit (pay later)' : option}</option>)}
            </select>
          </label>
          <label>Paid now<input type="number" min="0" max={order.total} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label>Reference<input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt / transaction no." /></label>
          <div className="stage-total"><span>Owed after</span><strong className={order.total - paid > 0 ? 'text-bad' : ''}>{formatMoney(Math.max(0, order.total - paid), currency)}</strong></div>
        </div>
        <OrderLinesTable lines={order.lines} currency={currency} />
      </fieldset>
    </form>
  )
}

/* ─── 5. RECEIVE (store) ─── */
function ReceiveStage({ pipeline, currency, canAct, run }: StageProps) {
  const order = pipeline.purchaseOrder
  const payment = pipeline.payment
  const [arrived, setArrived] = useState<Record<string, string>>(() => Object.fromEntries((order?.lines || []).map((line) => [line.ingredientId, String(line.quantity)])))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  if (!order) return <div className="pipeline-stage-card"><p className="empty-state">No purchase order</p></div>
  const missing = order.lines.reduce((sum, line) => sum + Math.max(0, line.quantity - Number(arrived[line.ingredientId] || 0)), 0)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    await run('receive', { notes, lines: order.lines.map((line) => ({ ingredientId: line.ingredientId, quantity: Number(arrived[line.ingredientId] || 0) })) })
    setBusy(false)
  }

  return (
    <form className="pipeline-stage-card" onSubmit={submit}>
      <StageHeader stage="receive" status={missing > 0 ? <span className="pipeline-shortage-badge short">Part delivery</span> : undefined}>
        {canAct ? <button type="submit" className="pipeline-btn-primary" disabled={busy}>Add to stock</button> : <Waiting stage="receive" />}
      </StageHeader>
      <StageStats items={[
        { label: 'Order', value: order.number },
        { label: 'Supplier', value: order.supplier },
        { label: 'Paid', value: payment ? `${formatMoney(payment.amountPaid, currency)} · ${payment.method}` : '—' },
        { label: 'Owed', value: formatMoney(payment?.balance || 0, currency), tone: payment && payment.balance > 0 ? 'bad' : undefined },
      ]} />
      <fieldset className={`stage-fieldset ${canAct ? '' : 'readonly'}`} disabled={!canAct || busy}>
        <div className="stage-body table-frame">
          <table className="stage-table">
            <thead><tr><th>Material</th><th>Ordered</th><th>Arrived</th><th>Unit price</th></tr></thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.ingredientId}>
                  <td><strong>{line.name}</strong></td>
                  <td>{line.quantity.toLocaleString()} {line.unit}</td>
                  <td>
                    <span className="stage-input-unit">
                      <input className="stage-input" type="number" min="0" max={line.quantity} step="any" required value={arrived[line.ingredientId] ?? ''} onChange={(e) => setArrived({ ...arrived, [line.ingredientId]: e.target.value })} aria-label={`${line.name} arrived`} />
                      {line.unit}
                    </span>
                  </td>
                  <td>{formatMoney(line.unitPrice, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stage-fields">
          <label className="wide">Note<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condition on arrival" /></label>
        </div>
      </fieldset>
    </form>
  )
}

/* ─── 6. MAKE (production) ─── */
function MakeStage({ pipeline, canAct, run }: StageProps) {
  const { lines } = useStockCheck(pipeline.id)
  const [made, setMade] = useState(String(pipeline.targetQuantity || ''))
  const [startTime, setStartTime] = useState(() => new Date().toISOString().slice(0, 16))
  const [endTime, setEndTime] = useState(() => new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const short = (lines || []).filter((line) => line.shortage > 0)
  const unit = cleanUnitName(pipeline.singleUnitLabel)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    await run('make', { producedQuantity: Number(made), startTime, endTime, notes })
    setBusy(false)
  }

  return (
    <form className="pipeline-stage-card" onSubmit={submit}>
      <StageHeader stage="make" status={short.length > 0 ? <span className="pipeline-shortage-badge short">{short.length} short</span> : undefined}>
        {!canAct ? <Waiting stage="make" /> : short.length > 0 ? (
          <button type="button" className="pipeline-btn-primary" disabled={busy} onClick={async () => { setBusy(true); await run('recheck'); setBusy(false) }}>Check stock again</button>
        ) : (
          <button type="submit" className="pipeline-btn-primary" disabled={busy || !lines} title="The materials below are taken out of stock">Done making</button>
        )}
      </StageHeader>
      <fieldset className={`stage-fieldset ${canAct ? '' : 'readonly'}`} disabled={!canAct || busy}>
        <div className="stage-fields">
          <label>Made ({unit}s)<input type="number" min="0.0001" step="any" required value={made} onChange={(e) => setMade(e.target.value)} /></label>
          <label>Started<input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
          <label>Finished<input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
          <label>Note<input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </div>
      </fieldset>
      <h3 className="stage-pane-title">Materials to use</h3>
      <StockTable lines={lines} actionLabel="Ready" />
    </form>
  )
}

/* ─── 7. QUALITY CHECK ─── */
function QualityStage({ pipeline, currency, canAct, run }: StageProps) {
  const produced = pipeline.producedQuantity || pipeline.production?.producedQuantity || 0
  const [passed, setPassed] = useState(String(produced))
  const [rejected, setRejected] = useState('0')
  const [inspector, setInspector] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const passedNumber = Number(passed || 0)
  const rate = produced > 0 ? (passedNumber / produced) * 100 : 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    await run('quality', { passedQuantity: passedNumber, rejectedQuantity: Number(rejected || 0), inspector, notes })
    setBusy(false)
  }

  return (
    <form className="pipeline-stage-card" onSubmit={submit}>
      <StageHeader stage="quality_check" status={<span className={`pipeline-shortage-badge ${Number(rejected) > 0 ? 'short' : 'ok'}`}>{rate.toFixed(0)}% passed</span>}>
        {canAct ? <button type="submit" className="pipeline-btn-primary" disabled={busy}>Save check</button> : <Waiting stage="quality_check" />}
      </StageHeader>
      <StageStats items={[
        { label: 'Made', value: formatUnitQty(produced, pipeline.singleUnitLabel) },
        { label: 'Made by', value: pipeline.production?.by || '—' },
        { label: 'Material cost', value: formatMoney(pipeline.production?.materialsCost || 0, currency) },
      ]} />
      <fieldset className={`stage-fieldset ${canAct ? '' : 'readonly'}`} disabled={!canAct || busy}>
        <div className="stage-fields">
          <label>Passed
            <input type="number" min="0" max={produced} step="any" required value={passed} onChange={(e) => { setPassed(e.target.value); setRejected(String(Math.max(0, produced - Number(e.target.value || 0)))) }} />
          </label>
          <label>Rejected
            <input type="number" min="0" max={produced} step="any" value={rejected} onChange={(e) => { setRejected(e.target.value); setPassed(String(Math.max(0, produced - Number(e.target.value || 0)))) }} />
          </label>
          <label>Inspector<input value={inspector} onChange={(e) => setInspector(e.target.value)} /></label>
          <label className="wide">Notes<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Taste, look, weight…" /></label>
        </div>
      </fieldset>
    </form>
  )
}

/* ─── 8. STORE ─── */
function StoreStage({ pipeline, currency, canAct, run }: StageProps) {
  const passed = pipeline.qualityResult?.passedQuantity || 0
  const unitCost = passed > 0 ? (pipeline.production?.materialsCost || 0) / passed : 0
  const [price, setPrice] = useState(String(pipeline.sellingPricePerUnit || ''))
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const margin = Number(price || 0) - unitCost

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    await run('store', { sellingPrice: Number(price || 0), location })
    setBusy(false)
  }

  return (
    <form className="pipeline-stage-card" onSubmit={submit}>
      <StageHeader stage="store">
        {canAct ? <button type="submit" className="pipeline-btn-primary" disabled={busy}>Add to stock</button> : <Waiting stage="store" />}
      </StageHeader>
      <StageStats items={[
        { label: 'Passed', value: formatUnitQty(passed, pipeline.singleUnitLabel), tone: 'good' },
        { label: 'Cost per unit', value: formatMoney(unitCost, currency) },
        { label: 'Margin per unit', value: Number(price) > 0 ? formatMoney(margin, currency) : '—', tone: Number(price) > 0 ? (margin >= 0 ? 'good' : 'bad') : undefined },
      ]} />
      <fieldset className={`stage-fieldset ${canAct ? '' : 'readonly'}`} disabled={!canAct || busy}>
        <div className="stage-fields">
          <label>Selling price ({currency})<input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Shelf, fridge, counter…" /></label>
        </div>
      </fieldset>
    </form>
  )
}

/* ─── Complete ─── */
function DoneStage({ pipeline, currency, onCreateNew }: { pipeline: PipelineData; currency: string; onCreateNew: () => void }) {
  const { user } = useAuth()
  const storage = pipeline.storage
  const purchased = (pipeline.receipts || []).reduce((sum, receipt) => sum + receipt.lines.reduce((s, line) => s + line.received * line.unitPrice, 0), 0)
  return (
    <div className="pipeline-stage-card">
      <StageHeader stage="done" title="Complete" status={<span className="pipeline-shortage-badge ok">{storage ? 'In stock' : 'Nothing stored'}</span>}>
        {canAccess(user, 'production', 'create') && <button type="button" className="pipeline-btn-primary" onClick={onCreateNew}>+ New order</button>}
      </StageHeader>
      <StageStats items={[
        { label: 'Ordered', value: formatUnitQty(pipeline.targetQuantity, pipeline.singleUnitLabel) },
        { label: 'Made', value: formatUnitQty(pipeline.producedQuantity, pipeline.singleUnitLabel) },
        { label: 'Added to stock', value: formatUnitQty(storage?.quantity || 0, pipeline.singleUnitLabel), tone: 'good' },
        { label: 'Cost per unit', value: formatMoney(storage?.unitCost || 0, currency) },
        { label: 'Selling price', value: storage?.sellingPrice ? formatMoney(storage.sellingPrice, currency) : '—' },
      ]} />
      <StageStats items={[
        { label: 'Materials used', value: formatMoney(pipeline.production?.materialsCost || 0, currency) },
        { label: 'Bought for this order', value: formatMoney(purchased, currency) },
        { label: 'Rejected', value: pipeline.qualityResult?.defectQuantity || 0, tone: pipeline.qualityResult?.defectQuantity ? 'bad' : undefined },
        { label: 'Stored as', value: storage ? `${storage.item}${storage.location ? ` · ${storage.location}` : ''}` : '—' },
      ]} />
    </div>
  )
}

/* ─── Read-only record of a finished step ─── */
function StageRecord({ pipeline, stage, currency, onClose }: { pipeline: PipelineData; stage: PipelineStage; currency: string; onClose: () => void }) {
  const back = <button type="button" className="pipeline-btn-secondary" onClick={onClose}>Back to current step</button>
  const kv = (rows: Array<[string, ReactNode]>) => (
    <dl className="kv-list stage-record">
      {rows.filter(([, value]) => value !== '' && value !== undefined && value !== null).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
  )
  let body: ReactNode = null
  if (stage === 'plan') body = <MaterialsTable pipeline={pipeline} currency={currency} />
  if (stage === 'check_stock') {
    const req = pipeline.requisition
    body = req?.lines?.length ? (
      <div className="stage-body table-frame">
        <table className="stage-table">
          <thead><tr><th>Material</th><th>Needed</th><th>In stock</th><th>Sent to procurement</th></tr></thead>
          <tbody>{req.lines.map((line) => (
            <tr key={line.ingredientId}><td><strong>{line.name}</strong></td><td>{line.needed} {line.unit}</td><td>{line.inStock} {line.unit}</td><td className="text-bad">{line.shortage} {line.unit}</td></tr>
          ))}</tbody>
        </table>
      </div>
    ) : <p className="empty-state">Everything was in stock</p>
  }
  if (stage === 'purchase_order' && pipeline.purchaseOrder) {
    const order = pipeline.purchaseOrder
    body = <>{kv([['Order', order.number], ['Supplier', order.supplier], ['Raised by', `${order.by} · ${order.date}`], ['Expected', order.expectedDate], ['Note', order.notes], ['Total', formatMoney(order.total, currency)]])}<OrderLinesTable lines={order.lines} currency={currency} /></>
  }
  if (stage === 'payment' && pipeline.payment) {
    const pay = pipeline.payment
    body = kv([['Approved by', `${pay.by} · ${pay.date}`], ['Method', pay.method], ['Paid', formatMoney(pay.amountPaid, currency)], ['Owed', formatMoney(pay.balance, currency)], ['Reference', pay.reference]])
  }
  if (stage === 'receive') {
    body = (
      <div className="stage-body table-frame">
        <table className="stage-table">
          <thead><tr><th>Date</th><th>Order</th><th>Material</th><th>Ordered</th><th>Received</th><th>By</th></tr></thead>
          <tbody>{(pipeline.receipts || []).flatMap((receipt) => receipt.lines.map((line) => (
            <tr key={`${receipt.poNumber}-${line.ingredientId}`}><td>{receipt.date}</td><td>{receipt.poNumber}</td><td><strong>{line.name}</strong></td><td>{line.ordered} {line.unit}</td><td>{line.received} {line.unit}</td><td>{receipt.by}</td></tr>
          )))}</tbody>
        </table>
      </div>
    )
  }
  if (stage === 'make' && pipeline.production) {
    const prod = pipeline.production
    body = <>
      {kv([['Made', formatUnitQty(prod.producedQuantity, pipeline.singleUnitLabel)], ['By', `${prod.by} · ${prod.date}`], ['Material cost', formatMoney(prod.materialsCost, currency)], ['Note', prod.notes]])}
      <div className="stage-body table-frame">
        <table className="stage-table">
          <thead><tr><th>Taken from stock</th><th>Quantity</th><th>Unit cost</th></tr></thead>
          <tbody>{prod.consumed.map((line) => <tr key={line.sku}><td><strong>{line.name}</strong></td><td>{line.quantity} {line.unit}</td><td>{formatMoney(line.unitCost, currency)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  }
  if (stage === 'quality_check' && pipeline.qualityResult) {
    const q = pipeline.qualityResult
    body = kv([['Passed', q.passedQuantity], ['Rejected', q.defectQuantity], ['Inspector', q.inspectedBy], ['Date', q.date], ['Notes', q.notes]])
  }
  if (stage === 'store' && pipeline.storage) {
    const s = pipeline.storage
    body = kv([['Added to stock', formatUnitQty(s.quantity, pipeline.singleUnitLabel)], ['Product', `${s.item} (${s.sku})`], ['Cost per unit', formatMoney(s.unitCost, currency)], ['Selling price', formatMoney(s.sellingPrice, currency)], ['Location', s.location], ['By', `${s.by} · ${s.date}`]])
  }
  return (
    <div className="pipeline-stage-card">
      <StageHeader stage={stage}>{back}</StageHeader>
      {body || <p className="empty-state">No record for this step</p>}
    </div>
  )
}
