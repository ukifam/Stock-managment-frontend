import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  api,
  type ProductionConfiguration,
  type ProductionMaterial,
  type ProductionObjective,
  type ProductionOrder,
  type ProductionPlan,
  type ProductionWasteRecord,
  type ProductionProcess,
  type ProductionProcessStep,
  type ProductionRecipe,
  type ProductionResourceAssignment,
  type ProductionUtilityAssignment,
  type NewProductionRecipe,
  type PurchaseRequest,
  type PurchaseOrder,
} from '../api'
import { Topbar } from '../components/Topbar'
import { formatMoney } from '../utils/money'
import type { PageRenderProps } from '../types'

type ProductionTab = 'planner' | 'objectives' | 'recipes' | 'processes' | 'orders' | 'procurement' | 'resources' | 'waste'

type ProductionProps = Partial<PageRenderProps> & {
  tab?: ProductionTab
}

type Notice = { tone: 'success' | 'error'; text: string }

const EMPTY_CONFIGURATION: ProductionConfiguration = {
  units: ['piece', 'kg', 'litre', 'hour', 'batch'],
  conversions: [],
  workers: [],
  machines: [],
  utilities: [],
  overheadCosts: [],
  overheadRatePerUnit: 0,
  transportCostPerBatch: 0,
  separationOfDuties: false,
}

const TAB_ROUTES: Array<{ id: ProductionTab; page: 'production' | 'production-objectives' | 'production-recipes' | 'production-processes' | 'production-orders' | 'production-procurement' | 'production-resources' | 'production-waste'; label: string }> = [
  { id: 'planner', page: 'production', label: 'Planner' },
  { id: 'objectives', page: 'production-objectives', label: 'What do I need?' },
  { id: 'recipes', page: 'production-recipes', label: 'Recipes & BOM' },
  { id: 'processes', page: 'production-processes', label: 'Processes' },
  { id: 'orders', page: 'production-orders', label: 'Orders & Quality' },
  { id: 'procurement', page: 'production-procurement', label: 'Purchasing' },
  { id: 'resources', page: 'production-resources', label: 'Resources & Cost' },
  { id: 'waste', page: 'production-waste', label: 'Waste & By-products' },
]

export function Production({ tab = 'planner', setPage, theme = 'dark', toggleTheme = () => {}, currency = 'RWF' }: ProductionProps) {
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([])
  const [processes, setProcesses] = useState<ProductionProcess[]>([])
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [wasteRecords, setWasteRecords] = useState<ProductionWasteRecord[]>([])
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([])
  const [objectives, setObjectives] = useState<ProductionObjective[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [inventory, setInventory] = useState<Array<{ sku: string; item: string; category: string; itemType?: string; stock: number; price: number; baseUnit?: string; onHand?: number; reserved?: number; incoming?: number; available?: number }>>([])
  const [configuration, setConfiguration] = useState<ProductionConfiguration>(EMPTY_CONFIGURATION)
  const [metrics, setMetrics] = useState({ activeRecipes: 0, openOrders: 0, qualityHoldCount: 0, completedOrders: 0, purchaseRequestCount: 0 })
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [targetQuantity, setTargetQuantity] = useState('1')
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [plan, setPlan] = useState<ProductionPlan | null>(null)
  const [planning, setPlanning] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [showRecipeModal, setShowRecipeModal] = useState(false)
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [qualityOrder, setQualityOrder] = useState<ProductionOrder | null>(null)
  const [executionOrder, setExecutionOrder] = useState<ProductionOrder | null>(null)

  const refresh = async () => {
    const [overview, operations, waste] = await Promise.all([api.productionOverview(), api.productionOperations(), api.productionWasteRecords()])
    setRecipes(overview.recipes)
    setProcesses(overview.processes)
    setOrders(overview.orders)
    setWasteRecords(waste)
    setPurchaseRequests(overview.purchaseRequests)
    setObjectives(operations.objectives)
    setPurchaseOrders(operations.purchaseOrders)
    setInventory(overview.inventory)
    setConfiguration(overview.configuration)
    setMetrics({ ...overview.metrics, purchaseRequestCount: overview.metrics.purchaseRequestCount || 0 })
    const activeRecipes = overview.recipes.filter((recipe) => recipe.active && recipe.approvalStatus === 'APPROVED')
    setSelectedRecipeId((current) => activeRecipes.some((recipe) => recipe._id === current) ? current : activeRecipes[0]?._id || '')
  }

  useEffect(() => {
    let mounted = true
    const loadTimer = window.setTimeout(() => {
      refresh()
        .catch((error) => {
          if (mounted) setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load production data.' })
        })
        .finally(() => {
          if (mounted) setLoading(false)
        })
    }, 0)
    return () => {
      mounted = false
      window.clearTimeout(loadTimer)
    }
  }, [])

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe._id === selectedRecipeId) ?? recipes.find((recipe) => recipe.active && recipe.approvalStatus === 'APPROVED'),
    [recipes, selectedRecipeId]
  )

  const calculatePlan = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!selectedRecipe) return
    const quantity = Number(targetQuantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setNotice({ tone: 'error', text: 'Enter a production quantity greater than zero.' })
      return
    }

    try {
      setPlanning(true)
      setPlan(await api.productionPlan(selectedRecipe._id, quantity, scheduledDate))
      setNotice(null)
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not calculate the production plan.' })
    } finally {
      setPlanning(false)
    }
  }

  const createOrder = async (submitForApproval: boolean) => {
    if (!selectedRecipe || !plan) return
    try {
      setCreatingOrder(true)
      await api.createProductionOrder({ recipeId: selectedRecipe._id, quantity: plan.plannedQuantity, scheduledDate, submitForApproval })
      await refresh()
      setNotice({ tone: 'success', text: submitForApproval ? 'Production plan submitted for approval.' : 'Production plan saved as a draft.' })
      setPage?.('production-orders')
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not create the production order.' })
    } finally {
      setCreatingOrder(false)
    }
  }

  const createPurchaseRequest = async () => {
    if (!selectedRecipe || !plan) return
    try {
      await api.createProductionPurchaseRequest({ recipeId: selectedRecipe._id, quantity: plan.plannedQuantity, scheduledDate })
      await refresh()
      setNotice({ tone: 'success', text: 'Purchase request created from the current shortages.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not create the purchase request.' })
    }
  }

  const updateOrderStatus = async (order: ProductionOrder, status: ProductionOrder['status']) => {
    try {
      await api.updateProductionOrder(order._id, { status })
      await refresh()
      setNotice({ tone: 'success', text: `${order.id} is now ${formatStatus(status).toLowerCase()}.` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not update the production order.' })
    }
  }

  const approveOrder = async (order: ProductionOrder) => {
    try {
      await api.approveProductionOrder(order._id)
      await refresh()
      setNotice({ tone: 'success', text: `${order.id} was approved and recalculated using current stock.` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not approve the production plan.' })
    }
  }

  const reserveOrderMaterials = async (order: ProductionOrder) => {
    try {
      await api.reserveProductionOrderMaterials(order._id)
      await refresh()
      setNotice({ tone: 'success', text: `${order.id} materials were reserved.` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not reserve production materials.' })
    }
  }

  const approveRecipe = async (recipe: ProductionRecipe) => {
    try {
      await api.approveProductionRecipe(recipe._id)
      await refresh()
      setNotice({ tone: 'success', text: `${recipe.productName} ${recipe.versionLabel || ''} is the active approved recipe.` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not approve the recipe.' })
    }
  }

  const saveRecipe = async (recipe: NewProductionRecipe) => {
    try {
      await api.createProductionRecipe(recipe)
      await refresh()
      setShowRecipeModal(false)
      setNotice({ tone: 'success', text: 'Recipe saved. Its finished-good inventory item is ready for production output.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save the recipe.' })
    }
  }

  const saveConfiguration = async (nextConfiguration: ProductionConfiguration) => {
    try {
      const saved = await api.updateProductionConfiguration(nextConfiguration)
      setConfiguration(saved)
      setNotice({ tone: 'success', text: 'Production resources and cost rates saved.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save production resources.' })
    }
  }

  const saveProcess = async (process: Omit<ProductionProcess, '_id'>) => {
    try {
      await api.createProductionProcess(process)
      await refresh()
      setShowProcessModal(false)
      setNotice({ tone: 'success', text: 'Production process saved.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save the production process.' })
    }
  }

  return (
    <>
      <Topbar title="Production Operations" placeholder="Search inventory, sales, reports..." theme={theme} toggleTheme={toggleTheme} />
      <main className="production-page page-pad">
        <div className="subtabs-bar production-tabs" aria-label="Production navigation">
          {TAB_ROUTES.map((route) => (
            <button
              className={`subtab-btn ${tab === route.id ? 'active' : ''}`}
              type="button"
              key={route.id}
              onClick={() => setPage?.(route.page)}
            >
              {route.label}
            </button>
          ))}
        </div>

        <header className="production-heading">
          <div>
            <h1>{titleForTab(tab)}</h1>
            <p>{subtitleForTab(tab)}</p>
          </div>
          <div className="production-heading-metrics" aria-label="Production summary">
            <span>{metrics.activeRecipes} active recipes</span>
            <span>{metrics.openOrders} open plans</span>
            <span>{metrics.purchaseRequestCount} purchase requests</span>
            {metrics.qualityHoldCount > 0 && <span className="production-warning">{metrics.qualityHoldCount} on hold</span>}
          </div>
        </header>

        {notice && <div className={`production-notice ${notice.tone}`}>{notice.text}</div>}

        {loading ? (
          <div className="production-empty">Loading production workspace...</div>
        ) : tab === 'waste' ? (
          <WasteRecordsView
            records={wasteRecords}
            inventory={inventory}
            onApprove={async (record, payload) => {
              await api.approveProductionWasteRecord(record._id, payload)
              await refresh()
              setNotice({ tone: 'success', text: `${record.id} was approved and added to inventory.` })
            }}
          />
        ) : tab === 'planner' ? (
          <PlannerView
            recipes={recipes}
            inventory={inventory}
            selectedRecipeId={selectedRecipe?._id || ''}
            targetQuantity={targetQuantity}
            scheduledDate={scheduledDate}
            plan={plan}
            currency={currency}
            planning={planning}
            creatingOrder={creatingOrder}
            onRecipeChange={(value) => { setSelectedRecipeId(value); setPlan(null) }}
            onQuantityChange={(value) => { setTargetQuantity(value); setPlan(null) }}
            onScheduledDateChange={(value) => { setScheduledDate(value); setPlan(null) }}
            onCalculate={calculatePlan}
            onCreateOrder={createOrder}
            onCreatePurchaseRequest={createPurchaseRequest}
            onCreateRecipe={() => setShowRecipeModal(true)}
          />
        ) : tab === 'objectives' ? (
          <ObjectivesView recipes={recipes.filter((recipe) => recipe.active && recipe.approvalStatus === 'APPROVED')} objectives={objectives} currency={currency} onRefresh={refresh} onNotice={setNotice} />
        ) : tab === 'recipes' ? (
          <RecipesView recipes={recipes} currency={currency} onCreateRecipe={() => setShowRecipeModal(true)} onApprove={approveRecipe} />
        ) : tab === 'processes' ? (
          <ProcessesView processes={processes} onCreateProcess={() => setShowProcessModal(true)} />
        ) : tab === 'orders' ? (
          <OrdersView orders={orders} purchaseRequests={purchaseRequests} currency={currency} onStart={updateOrderStatus} onApprove={approveOrder} onReserve={reserveOrderMaterials} onQuality={setQualityOrder} onExecution={setExecutionOrder} />
        ) : tab === 'procurement' ? (
          <ProcurementView inventory={inventory} purchaseRequests={purchaseRequests} purchaseOrders={purchaseOrders} currency={currency} onRefresh={refresh} onNotice={setNotice} />
        ) : (
          <ResourcesView configuration={configuration} currency={currency} onSave={saveConfiguration} />
        )}
      </main>

      {showRecipeModal && (
        <RecipeModal
          inventory={inventory}
          configuration={configuration}
          processes={processes}
          currency={currency}
          onClose={() => setShowRecipeModal(false)}
          onSave={saveRecipe}
        />
      )}
      {showProcessModal && <ProcessModal inventory={inventory} configuration={configuration} onClose={() => setShowProcessModal(false)} onSave={saveProcess} />}
      {qualityOrder && (
        <QualityModal
          order={qualityOrder}
          onClose={() => setQualityOrder(null)}
          onSave={async (payload) => {
            try {
              const saved = await api.recordProductionQuality(qualityOrder._id, payload)
              await refresh()
              setQualityOrder(null)
              setNotice({ tone: 'success', text: saved.status === 'COMPLETED' ? `${saved.id} passed quality and finished stock was updated.` : `Quality result recorded for ${saved.id}.` })
            } catch (error) {
              setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not record the quality check.' })
              throw error
            }
          }}
        />
      )}
      {executionOrder && (
        <ExecutionModal
          order={executionOrder}
          inventory={inventory}
          onClose={() => setExecutionOrder(null)}
          onSave={async (payload) => {
            try {
              await api.recordProductionExecution(executionOrder._id, payload)
              await refresh()
              setExecutionOrder(null)
              setNotice({ tone: 'success', text: `Actual usage and costs were recorded for ${executionOrder.id}.` })
            } catch (error) {
              setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not record actual production usage.' })
              throw error
            }
          }}
        />
      )}
    </>
  )
}

function WasteRecordsView({
  records,
  inventory,
  onApprove,
}: {
  records: ProductionWasteRecord[]
  inventory: Array<{ sku: string; item: string; baseUnit?: string; stock: number }>
  onApprove: (record: ProductionWasteRecord, payload: { inventorySku?: string; inventoryQuantity?: number; inventoryUnit?: string }) => Promise<void>
}) {
  const [selectedRecord, setSelectedRecord] = useState<ProductionWasteRecord | null>(null)
  const [error, setError] = useState('')
  return <section className="production-orders"><div className="production-section-head"><h2>Waste and by-product records</h2><span>{records.length} records</span></div>{error && <div className="production-notice error">{error}</div>}{records.length === 0 ? <div className="production-empty compact"><p>No production waste or by-products have been recorded.</p></div> : <div className="table-frame"><table><thead><tr><th>Production order</th><th>Kind</th><th>Quantity</th><th>Reason / notes</th><th>Disposition</th><th>Inventory output</th><th /></tr></thead><tbody>{records.map((record) => <tr key={record._id}><td><strong>{record.productionOrderCode}</strong><small>{record.productName}</small></td><td>{record.kind === 'BYPRODUCT' ? 'By-product' : record.reusable ? 'Reusable waste' : 'Non-reusable waste'}</td><td>{record.quantity} {record.unit}</td><td>{record.reason || record.notes || '-'}</td><td><span className={`production-status ${record.status.toLowerCase()}`}>{formatStatus(record.status)}</span></td><td>{record.inventorySku ? `${record.inventorySku}: ${record.inventoryQuantity} ${record.inventoryUnit}` : '-'}</td><td>{record.status === 'PENDING_APPROVAL' && <button className="primary-action" type="button" onClick={() => { setSelectedRecord(record); setError('') }}>Approve inventory</button>}</td></tr>)}</tbody></table></div>}{selectedRecord && <WasteApprovalModal record={selectedRecord} inventory={inventory} onClose={() => setSelectedRecord(null)} onApprove={async (payload) => { try { await onApprove(selectedRecord, payload); setSelectedRecord(null) } catch (approvalError) { setError(approvalError instanceof Error ? approvalError.message : 'Could not approve this inventory output.') } }} />}</section>
}

function WasteApprovalModal({
  record,
  inventory,
  onClose,
  onApprove,
}: {
  record: ProductionWasteRecord
  inventory: Array<{ sku: string; item: string; baseUnit?: string; stock: number }>
  onClose: () => void
  onApprove: (payload: { inventorySku?: string; inventoryQuantity?: number; inventoryUnit?: string }) => Promise<void>
}) {
  const [sku, setSku] = useState(record.inventorySku || '')
  const [quantity, setQuantity] = useState(String(record.inventoryQuantity || record.quantity))
  const [saving, setSaving] = useState(false)
  const selectedItem = inventory.find((item) => item.sku === sku)
  const unit = record.kind === 'BYPRODUCT' ? record.inventoryUnit || record.unit : selectedItem?.baseUnit || ''
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onApprove({ inventorySku: sku, inventoryQuantity: Number(quantity), inventoryUnit: unit })
    } finally {
      setSaving(false)
    }
  }
  return <div className="modal-backdrop" role="presentation"><form className="entry-modal production-quality-modal" onSubmit={submit}><div className="detail-head"><div><h2>Approve inventory output</h2><p>{record.productionOrderCode} · {record.kind === 'BYPRODUCT' ? 'By-product' : 'Reusable waste'}</p></div><button type="button" aria-label="Close" onClick={onClose}>x</button></div><div className="field-grid"><label>Inventory item<select required disabled={record.kind === 'BYPRODUCT'} value={sku} onChange={(event) => setSku(event.target.value)}><option value="">Choose item</option>{inventory.map((item) => <option key={item.sku} value={item.sku}>{item.item} ({item.baseUnit || 'unit'})</option>)}</select></label><label>Quantity to add<input required type="number" min="0.0001" step="0.0001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Inventory unit<input readOnly value={unit} /></label></div><div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Approving...' : 'Approve and add stock'}</button></div></form></div>
}

function PlannerView({
  recipes,
  inventory,
  selectedRecipeId,
  targetQuantity,
  scheduledDate,
  plan,
  currency,
  planning,
  creatingOrder,
  onRecipeChange,
  onQuantityChange,
  onScheduledDateChange,
  onCalculate,
  onCreateOrder,
  onCreatePurchaseRequest,
  onCreateRecipe,
}: {
  recipes: ProductionRecipe[]
  inventory: Array<{ sku: string; item: string; category: string; itemType?: string }>
  selectedRecipeId: string
  targetQuantity: string
  scheduledDate: string
  plan: ProductionPlan | null
  currency: string
  planning: boolean
  creatingOrder: boolean
  onRecipeChange: (value: string) => void
  onQuantityChange: (value: string) => void
  onScheduledDateChange: (value: string) => void
  onCalculate: (event: FormEvent) => void
  onCreateOrder: (submitForApproval: boolean) => void
  onCreatePurchaseRequest: () => void
  onCreateRecipe: () => void
}) {
  const approvedRecipes = recipes.filter((recipe) => recipe.active && recipe.approvalStatus === 'APPROVED')
  const approvedBySku = new Map<string, ProductionRecipe>()
  approvedRecipes.forEach((recipe) => {
    if (!approvedBySku.has(recipe.productSku)) approvedBySku.set(recipe.productSku, recipe)
  })
  if (approvedRecipes.length === 0) {
    return (
      <section className="production-empty">
        <h2>Start with a recipe or bill of materials</h2>
        <p>Select a product already in Inventory, define its ingredients for one recipe yield, then enter how many you want to produce. The planner scales ingredients and estimates labor, duration, and cost.</p>
        <button className="primary-action" type="button" onClick={onCreateRecipe}>Create recipe</button>
      </section>
    )
  }

  return (
    <>
      <form className="production-plan-form" onSubmit={onCalculate}>
        <label>
          Product in inventory
          <select value={selectedRecipeId} onChange={(event) => onRecipeChange(event.target.value)}>
            {inventory.map((product) => {
              const recipe = approvedBySku.get(product.sku)
              const productRecipes = recipes.filter((row) => row.productSku === product.sku)
              const hasPendingRecipe = productRecipes.some((row) => row.approvalStatus === 'PENDING_APPROVAL')
              const label = recipe
                ? product.item
                : `${product.item} — ${hasPendingRecipe ? 'recipe awaiting approval' : 'approved recipe required'}`
              return <option key={product.sku} value={recipe?._id || `missing-recipe:${product.sku}`} disabled={!recipe}>{label}</option>
            })}
            {approvedRecipes.filter((recipe) => !inventory.some((product) => product.sku === recipe.productSku)).map((recipe) => <option key={recipe._id} value={recipe._id}>{recipe.productName}</option>)}
          </select>
        </label>
        <label>
          Quantity to produce
          <input type="number" min="0.01" step="0.01" value={targetQuantity} onChange={(event) => onQuantityChange(event.target.value)} />
        </label>
        <label>
          Planned start
          <input type="date" value={scheduledDate} onChange={(event) => onScheduledDateChange(event.target.value)} />
        </label>
        <button className="primary-action" type="submit" disabled={planning}>{planning ? 'Calculating...' : 'Calculate ingredients and production'}</button>
      </form>

      {!plan ? (
        <section className="production-empty compact"><p>Choose an inventory product with an approved recipe, enter the quantity to produce, and calculate all ingredient quantities, labor, duration, shortages, and cost. Products marked “approved recipe required” need a recipe in Recipes &amp; BOM before they can be planned.</p></section>
      ) : (
        <section className="production-plan-results">
          <div className="production-summary-grid">
            <div><span>Planned output</span><strong>{plan.plannedQuantity.toLocaleString()} {plan.productUnit}</strong></div>
            <div><span>Production batches</span><strong>{plan.batches.toLocaleString()}</strong></div>
            <div><span>Estimated duration</span><strong>{plan.durationHours.toLocaleString()} hrs</strong></div>
            {plan.laborEstimate && <div><span>Estimated labor</span><strong>{plan.laborEstimate.workerHours.toLocaleString()} worker-hrs</strong><small>{plan.laborEstimate.workersRequired} worker(s) for a {plan.laborEstimate.shiftHours}-hour shift</small></div>}
            <div><span>Planned end</span><strong>{plan.estimatedEndDate || '-'}</strong></div>
            <div><span>Material readiness</span><strong className={plan.materialsReady ? 'production-positive' : 'production-negative'}>{plan.materialsReady ? 'Ready' : 'Shortages found'}</strong></div>
            <div><span>Expected waste</span><strong>{plan.expectedWasteQuantity ?? 0} input units ({plan.expectedWastePercent ?? 0}%)</strong></div>
          </div>

          <div className="production-results-grid">
            <div className="production-table-section">
              <div className="production-section-head"><h2>Material requirements</h2><span>{plan.productName}</span></div>
              <div className="table-frame">
                <table>
                  <thead><tr><th>Material</th><th>Base need</th><th>Waste allowance</th><th>Total required</th><th>On hand</th><th>Reserved</th><th>Incoming</th><th>Available</th><th>Shortage</th><th>Purchase need</th><th>Estimated cost</th></tr></thead>
                  <tbody>
                    {plan.requirements.map((requirement) => (
                      <tr key={requirement.sku} className={requirement.shortageQuantity > 0 ? 'production-shortage-row' : ''}>
                        <td><strong>{requirement.item}</strong></td>
                        <td>{requirement.baseRequiredQuantity ?? requirement.requiredQuantity} {requirement.unit}</td>
                        <td>{requirement.wasteQuantity ? `${requirement.wasteQuantity} ${requirement.unit}` : '-'}</td>
                        <td>{requirement.requiredQuantity} {requirement.unit}</td>
                        <td>{requirement.onHandQuantity ?? requirement.availableQuantity} {requirement.unit}</td>
                        <td>{requirement.reservedQuantity ?? 0} {requirement.unit}</td>
                        <td>{requirement.incomingQuantity ?? 0} {requirement.unit}</td>
                        <td>{requirement.availableQuantity} {requirement.unit}<small>{formatAvailability(requirement.availabilityStatus)}</small></td>
                        <td>{requirement.shortageQuantity > 0 ? `${requirement.shortageQuantity} ${requirement.unit}` : 'Covered'}</td>
                        <td>{requirement.shortageQuantity > 0 ? <><strong>{requirement.purchaseQuantity ?? requirement.shortageQuantity} {requirement.purchaseUnit || requirement.unit}</strong><small>{requirement.packagesRequired ? `${requirement.packagesRequired} pack(s) of ${requirement.packageSize}` : requirement.supplierName || 'Supplier not assigned'}</small></> : '-'}</td>
                        <td>{formatMoney(requirement.materialCost || 0, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <CostPanel plan={plan} currency={currency} />
          </div>

          {(plan.labor.length > 0 || plan.machines.length > 0 || plan.utilities.length > 0) && (
            <div className="production-resource-requirements">
              {plan.labor.length > 0 && <ResourceRequirementList title={plan.laborEstimate ? 'Estimated labor by step' : 'Labor'} rows={plan.labor.map((row) => ({ name: row.name, detail: `${row.hours} worker-hrs`, cost: row.cost }))} currency={currency} />}
              {plan.machines.length > 0 && <ResourceRequirementList title="Equipment" rows={plan.machines.map((row) => ({ name: row.name, detail: `${row.hours} hrs`, cost: row.cost }))} currency={currency} />}
              {plan.utilities.length > 0 && <ResourceRequirementList title="Utilities" rows={plan.utilities.map((row) => ({ name: row.name, detail: `${row.quantity} ${row.unit}`, cost: row.cost }))} currency={currency} />}
            </div>
          )}

          <div className="production-plan-actions">
            <p>{plan.assumptions?.stockBasis}</p>
            {plan.scheduleWarnings?.map((warning) => <p className="production-warning" key={warning}>{warning}</p>)}
            <div className="production-action-row">
              <button type="button" onClick={() => onCreateOrder(false)} disabled={creatingOrder}>{creatingOrder ? 'Saving...' : 'Save draft'}</button>
              <button className="primary-action" type="button" onClick={() => onCreateOrder(true)} disabled={creatingOrder}>{creatingOrder ? 'Saving...' : 'Submit for approval'}</button>
              {!plan.materialsReady && <button type="button" onClick={onCreatePurchaseRequest}>Create purchase request</button>}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

function CostPanel({ plan, currency }: { plan: ProductionPlan; currency: string }) {
  const costs = [
    ['Materials', plan.cost.material],
    ['Labor', plan.cost.labor],
    ['Equipment', plan.cost.machine],
    ['Utilities', plan.cost.utility],
    ['Overheads', plan.cost.overhead],
  ]
  return (
    <aside className="production-cost-panel">
      <div className="production-section-head"><h2>Cost estimate</h2><span>Per plan</span></div>
      <dl>
        {costs.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{formatMoney(Number(value), currency)}</dd></div>)}
        <div className="production-cost-total"><dt>Total cost</dt><dd>{formatMoney(plan.cost.total, currency)}</dd></div>
        <div><dt>Unit cost</dt><dd>{formatMoney(plan.cost.unit, currency)}</dd></div>
      </dl>
    </aside>
  )
}

function ResourceRequirementList({ title, rows, currency }: { title: string; rows: Array<{ name: string; detail: string; cost: number }>; currency: string }) {
  return (
    <section className="production-resource-list">
      <h2>{title}</h2>
      {rows.map((row) => <div key={row.name}><strong>{row.name}</strong><span>{row.detail}</span><b>{formatMoney(row.cost, currency)}</b></div>)}
    </section>
  )
}

function RecipesView({ recipes, currency, onCreateRecipe, onApprove }: { recipes: ProductionRecipe[]; currency: string; onCreateRecipe: () => void; onApprove: (recipe: ProductionRecipe) => void }) {
  return (
    <section>
      <div className="production-list-head">
        <p>{recipes.length} recipe versions across finished products</p>
        <button className="primary-action" type="button" onClick={onCreateRecipe}>New recipe version</button>
      </div>
      {recipes.length === 0 ? <div className="production-empty compact"><p>No recipes yet.</p></div> : (
        <div className="production-recipe-list">
          {recipes.map((recipe) => (
            <article className="production-recipe-row" key={recipe._id}>
              <div className="production-recipe-title"><strong>{recipe.productName}</strong><span>Yields {recipe.yieldQuantity} {recipe.productUnit}</span></div>
              <div className="production-recipe-materials"><span>{recipe.materials.length} materials</span><span>{recipe.processSteps.length} process steps</span></div>
              <div className="production-recipe-price"><span>Selling price</span><strong>{formatMoney(recipe.sellingPrice, currency)}</strong></div>
              <div className="production-recipe-actions"><span className={`production-status ${(recipe.approvalStatus || 'draft').toLowerCase()}`}>{formatStatus(recipe.approvalStatus || 'DRAFT')}</span>{recipe.active && <small>Active version</small>}{recipe.approvalStatus !== 'APPROVED' && <button type="button" className="primary-action" onClick={() => onApprove(recipe)}>Approve</button>}</div>
              <details>
                <summary>View BOM</summary>
                <div className="production-bom-detail">
                  {recipe.materials.map((material) => <span key={material.sku}>{material.item} ({material.materialType || 'material'}): {material.quantity} {material.unit}{material.wastePercent ? ` + ${material.wastePercent}% waste` : ''}{material.substitutes?.length ? `; substitute ${material.substitutes.map((substitute) => substitute.item).join(', ')}` : ''}</span>)}
                  {recipe.processSteps.map((step) => <span key={step.name}>{step.name}: {step.durationHours} hrs{step.qualityCheck ? ` · check ${step.qualityCheck}` : ''}</span>)}
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function ProcessesView({ processes, onCreateProcess }: { processes: ProductionProcess[]; onCreateProcess: () => void }) {
  return (
    <section>
      <div className="production-list-head"><p>{processes.length} reusable production processes</p><button className="primary-action" type="button" onClick={onCreateProcess}>New process</button></div>
      {processes.length === 0 ? <div className="production-empty compact"><p>No production processes have been configured yet.</p></div> : (
        <div className="production-recipe-list">
          {processes.map((process) => <article key={process._id} className="production-recipe-row">
            <div className="production-recipe-title"><strong>{process.name}</strong><span>{process.code}{process.description ? ` - ${process.description}` : ''}</span></div>
            <div className="production-recipe-materials"><span>{process.steps.length} sequenced steps</span><span>{process.active ? 'Active' : 'Inactive'}</span></div>
            <details><summary>View steps</summary><div className="production-bom-detail">{process.steps.map((step) => <span key={`${process._id}-${step.sequence}-${step.name}`}>{step.sequence}. {step.name}: {step.durationHours} hrs{step.capacityPerHour ? `; capacity ${step.capacityPerHour}/hr` : ''}{step.optional ? '; optional' : ''}{step.reworkAllowed ? '; rework allowed' : ''}{step.qualityCheck ? `; check ${step.qualityCheck}` : ''}</span>)}</div></details>
          </article>)}
        </div>
      )}
    </section>
  )
}

function OrdersView({ orders, purchaseRequests, currency, onStart, onApprove, onReserve, onQuality, onExecution }: { orders: ProductionOrder[]; purchaseRequests: PurchaseRequest[]; currency: string; onStart: (order: ProductionOrder, status: ProductionOrder['status']) => void; onApprove: (order: ProductionOrder) => void; onReserve: (order: ProductionOrder) => void; onQuality: (order: ProductionOrder) => void; onExecution: (order: ProductionOrder) => void }) {
  if (orders.length === 0 && purchaseRequests.length === 0) return <div className="production-empty compact"><p>No production plans or purchase requests yet. Calculate a plan when you are ready to execute.</p></div>

  return (
    <section className="production-orders-stack">
    {orders.length > 0 && <div className="table-frame production-orders-table">
      <table>
        <thead><tr><th>Order</th><th>Product</th><th>Schedule</th><th>Progress</th><th>Cost</th><th>Action</th></tr></thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order._id}>
              <td><strong>{order.id}</strong><small>{order.expectedDurationHours} estimated hrs</small></td>
              <td><strong>{order.productName}</strong><small>{order.plannedQuantity} {order.productUnit}</small></td>
              <td>{order.scheduledDate}<small>{order.plannedEndDate ? `Ends ${order.plannedEndDate}` : ''}</small></td>
              <td><span className={`production-status ${order.status.toLowerCase()}`}>{formatStatus(order.status)}</span></td>
              <td>{formatMoney(order.cost.total, currency)}<small>{formatMoney(order.cost.unit, currency)} / unit</small></td>
              <td>
                {['DRAFT', 'PENDING_APPROVAL'].includes(order.status) && <button className="primary-action" type="button" onClick={() => onApprove(order)}>Approve</button>}
                {order.status === 'APPROVED' && <button type="button" onClick={() => onReserve(order)}>Reserve materials</button>}
                {['APPROVED', 'PLANNED', 'MATERIALS_READY', 'ON_HOLD', 'PAUSED', 'REWORK'].includes(order.status) && <button type="button" onClick={() => onStart(order, 'IN_PROGRESS')}>Start</button>}
                {order.status === 'IN_PROGRESS' && <><button type="button" onClick={() => onExecution(order)}>Log actuals</button><button type="button" onClick={() => onStart(order, 'PAUSED')}>Pause</button></>}
                {['IN_PROGRESS', 'QUALITY_CHECK'].includes(order.status) && <button className="primary-action" type="button" onClick={() => onQuality(order)}>Record quality</button>}
                {order.status === 'COMPLETED' && <span className="production-complete-output">Output: {order.actualOutput} {order.productUnit}</span>}
                {order.status === 'CANCELLED' && <span>Cancelled</span>}
                <details className="production-order-details"><summary>Requirements</summary>{order.requirements.map((requirement) => <div key={requirement.sku}>{requirement.item}: {requirement.requiredQuantity} {requirement.unit}; available {requirement.availableQuantity}; shortage {requirement.shortageQuantity}</div>)}<div>Expected waste: {order.expectedWasteQuantity || 0} input units ({order.expectedWastePercent || 0}%)</div>{order.actualWaste > 0 && <div>Actual waste: {order.actualWaste} input units ({order.actualWastePercent || 0}%) - {order.actualWasteReason}</div>}{order.actualCost && <div>Actual cost: {formatMoney(order.actualCost.total, currency)}; variance: {formatMoney(order.costVariance?.total || 0, currency)}</div>}</details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>}
    {purchaseRequests.length > 0 && <div className="production-purchase-requests"><div className="production-section-head"><h2>Purchase requests</h2><span>{purchaseRequests.length} records</span></div><div className="table-frame"><table><thead><tr><th>Request</th><th>Production</th><th>Required by</th><th>Items</th><th>Status</th><th>Estimate</th></tr></thead><tbody>{purchaseRequests.map((request) => <tr key={request._id}><td><strong>{request.id}</strong></td><td>{request.productName}<small>{request.plannedQuantity} planned</small></td><td>{request.requiredByDate || '-'}</td><td>{request.lines.map((line) => <small key={line.sku}>{line.item}: {line.purchaseQuantity} {line.purchaseUnit}</small>)}</td><td><span className={`production-status ${request.status.toLowerCase()}`}>{formatStatus(request.status)}</span></td><td>{formatMoney(request.totalEstimatedCost, currency)}</td></tr>)}</tbody></table></div></div>}
    </section>
  )
}

function ObjectivesView({ recipes, objectives, currency, onRefresh, onNotice }: { recipes: ProductionRecipe[]; objectives: ProductionObjective[]; currency: string; onRefresh: () => Promise<void>; onNotice: (notice: Notice) => void }) {
  const [title, setTitle] = useState('')
  const [objective, setObjective] = useState('')
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [recipeId, setRecipeId] = useState(recipes[0]?._id || '')
  const [quantity, setQuantity] = useState('1')
  const [sellingPrice, setSellingPrice] = useState(String(recipes[0]?.sellingPrice || 0))
  const [preview, setPreview] = useState<ProductionObjective['result'] | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedRecipe = recipes.find((recipe) => recipe._id === recipeId)
  const normalizedTargets = () => recipeId && Number(quantity) > 0
    ? [{ recipeId, quantity: Number(quantity), sellingPrice: Number(sellingPrice) }]
    : []
  const selectTargetRecipe = (nextRecipeId: string) => {
    const recipe = recipes.find((entry) => entry._id === nextRecipeId)
    setRecipeId(nextRecipeId)
    setSellingPrice(String(recipe?.sellingPrice || 0))
    setPreview(null)
  }
  const calculate = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setSaving(true)
      setPreview(await api.previewProductionObjective({ targets: normalizedTargets(), scheduledDate }))
    } catch (error) {
      onNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not calculate the production objective.' })
    } finally {
      setSaving(false)
    }
  }
  const save = async () => {
    try {
      setSaving(true)
      await api.createProductionObjective({ title: title.trim() || 'Production objective', objective, targets: normalizedTargets(), scheduledDate })
      await onRefresh()
      setPreview(null)
      setTitle('')
      onNotice({ tone: 'success', text: 'Production objective saved with its calculated requirements.' })
    } catch (error) {
      onNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save the production objective.' })
    } finally {
      setSaving(false)
    }
  }
  const convert = async (entry: ProductionObjective) => {
    try {
      setSaving(true)
      const result = await api.convertProductionObjective(entry._id, { submitForApproval: true })
      await onRefresh()
      onNotice({ tone: 'success', text: `${result.orders.length} production order(s) were created from ${entry.id}.` })
    } catch (error) {
      onNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not convert the objective to production orders.' })
    } finally {
      setSaving(false)
    }
  }

  if (!recipes.length) return <div className="production-empty compact"><p>Approve at least one recipe before calculating a production objective.</p></div>
  return <section className="production-orders-stack">
    <form className="production-plan-form" onSubmit={calculate}>
      <label>Objective title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Weekly bakery output" /></label>
      <label>Planned date<input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} /></label>
      <label className="production-full-width">Business objective<input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Serve a customer order or replenish stock" /></label>
      <label>Finished product<select value={recipeId} onChange={(event) => selectTargetRecipe(event.target.value)}>{recipes.map((recipe) => <option value={recipe._id} key={recipe._id}>{recipe.productName}</option>)}</select></label>
      <label>Estimated output amount ({selectedRecipe?.productUnit || 'unit'})<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      <label>Selling price per {selectedRecipe?.productUnit || 'unit'}<input type="number" min="0" step="0.01" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} /></label>
      <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Calculating...' : 'Calculate needs'}</button>
    </form>
    {preview && <div className="production-plan-results">
      <div className="production-summary-grid"><div><span>Planned output</span><strong>{quantity} {selectedRecipe?.productUnit || 'unit'}</strong></div><div><span>Materials</span><strong>{preview.requirements.length} item(s)</strong></div><div><span>Expected waste</span><strong>{preview.expectedWasteQuantity || 0} input units ({preview.expectedWastePercent || 0}%)</strong></div><div><span>Production time</span><strong>{preview.durationHours} hrs</strong></div><div><span>Estimated total cost</span><strong>{formatMoney(preview.totalCost, currency)}</strong></div><div><span>Expected sales</span><strong>{formatMoney(preview.salesValue, currency)}</strong></div><div><span>Expected profit</span><strong className={preview.expectedProfit >= 0 ? 'production-positive' : 'production-negative'}>{formatMoney(preview.expectedProfit, currency)}</strong></div></div>
      <div className="table-frame"><table><thead><tr><th>Material</th><th>Base need</th><th>Waste allowance</th><th>Total required</th><th>Available</th><th>Shortage</th><th>Purchase quantity</th></tr></thead><tbody>{preview.requirements.map((row) => <tr key={`${row.sku}-${row.unit}`}><td><strong>{row.item}</strong></td><td>{row.baseRequiredQuantity ?? row.requiredQuantity} {row.unit}</td><td>{row.wasteQuantity ? `${row.wasteQuantity} ${row.unit}` : '-'}</td><td>{row.requiredQuantity} {row.unit}</td><td>{row.availableQuantity} {row.unit}</td><td>{row.shortageQuantity || 'Covered'}</td><td>{row.shortageQuantity > 0 ? `${row.purchaseQuantity || row.shortageQuantity} ${row.purchaseUnit || row.unit}` : '-'}</td></tr>)}</tbody></table></div>
      <div className="production-plan-actions"><p>{preview.assumptions?.stock}</p><button type="button" className="primary-action" disabled={saving} onClick={save}>Save objective</button></div>
    </div>}
    <div className="production-purchase-requests"><div className="production-section-head"><h2>Saved plans</h2><span>{objectives.length} records</span></div>{objectives.length === 0 ? <div className="production-empty compact"><p>No plans saved yet.</p></div> : <div className="table-frame"><table><thead><tr><th>Plan</th><th>Finished product</th><th>Output</th><th>Expected waste</th><th>Schedule</th><th>Total cost</th><th>Status</th><th /></tr></thead><tbody>{objectives.map((entry) => <tr key={entry._id}><td><strong>{entry.id}</strong><small>{entry.title}</small></td><td>{entry.targets.map((target) => <small key={target.recipeId}>{target.productName}</small>)}</td><td>{entry.targets.map((target) => <small key={target.recipeId}>{target.quantity} {target.unit}</small>)}</td><td>{entry.result?.expectedWasteQuantity || 0} units ({entry.result?.expectedWastePercent || 0}%)</td><td>{entry.scheduledDate}</td><td>{formatMoney(entry.result?.totalCost || 0, currency)}</td><td><span className={`production-status ${entry.status.toLowerCase()}`}>{formatStatus(entry.status)}</span></td><td>{entry.status !== 'CONVERTED' && <button className="primary-action" type="button" disabled={saving} onClick={() => convert(entry)}>Create orders</button>}</td></tr>)}</tbody></table></div>}</div>
  </section>
}

function ProcurementView({ inventory, purchaseRequests, purchaseOrders, currency, onRefresh, onNotice }: { inventory: Array<{ sku: string; item: string; category: string; itemType?: string; stock: number; price: number; baseUnit?: string; purchasePrice?: number }>; purchaseRequests: PurchaseRequest[]; purchaseOrders: PurchaseOrder[]; currency: string; onRefresh: () => Promise<void>; onNotice: (notice: Notice) => void }) {
  const purchasable = inventory.filter((item) => item.itemType !== 'finished_product')
  const [itemSku, setItemSku] = useState(purchasable[0]?.sku || '')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState(String(purchasable[0]?.purchasePrice ?? purchasable[0]?.price ?? 0))
  const [supplierName, setSupplierName] = useState('')
  const [requiredByDate, setRequiredByDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null)
  const selectedItem = purchasable.find((item) => item.sku === itemSku) || purchasable[0]
  const changeItem = (sku: string) => { const item = purchasable.find((entry) => entry.sku === sku); setItemSku(sku); setUnitPrice(String(item?.purchasePrice ?? item?.price ?? 0)) }
  const manualRequest = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedItem) return
    try {
      setSaving(true)
      await api.createManualProductionPurchaseRequest({ requiredByDate, reason, lines: [{ sku: selectedItem.sku, item: selectedItem.item, quantity: Number(quantity), unit: selectedItem.baseUnit || 'piece', supplierName, unitPrice: Number(unitPrice) }] })
      await onRefresh(); onNotice({ tone: 'success', text: 'Manual purchase request created.' })
    } catch (error) { onNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not create the purchase request.' }) } finally { setSaving(false) }
  }
  const directOrder = async () => {
    if (!selectedItem) return
    try {
      setSaving(true)
      await api.createProductionPurchaseOrder({ supplierName, expectedDeliveryDate: requiredByDate, submitForApproval: true, lines: [{ sku: selectedItem.sku, item: selectedItem.item, quantity: Number(quantity), unit: selectedItem.baseUnit || 'piece', unitPrice: Number(unitPrice), taxRate: 0 }] })
      await onRefresh(); onNotice({ tone: 'success', text: 'Purchase order created and submitted for approval.' })
    } catch (error) { onNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not create the purchase order.' }) } finally { setSaving(false) }
  }
  const act = async (action: () => Promise<unknown>, success: string) => { try { setSaving(true); await action(); await onRefresh(); onNotice({ tone: 'success', text: success }) } catch (error) { onNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not update purchasing.' }) } finally { setSaving(false) } }
  if (!purchasable.length) return <div className="production-empty compact"><p>Create raw-material, packaging, or consumable inventory items before purchasing.</p></div>
  return <section className="production-orders-stack">
    <form className="production-plan-form" onSubmit={manualRequest}>
      <label>Item<select value={selectedItem?.sku || ''} onChange={(event) => changeItem(event.target.value)}>{purchasable.map((item) => <option key={item.sku} value={item.sku}>{item.item} ({item.sku})</option>)}</select></label><label>Quantity<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Unit price ({currency})<input type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /></label><label>Supplier<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Supplier name" /></label><label>Required by<input type="date" value={requiredByDate} onChange={(event) => setRequiredByDate(event.target.value)} /></label><label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Production shortage" /></label><button className="primary-action" type="submit" disabled={saving}>Create request</button><button type="button" disabled={saving || !supplierName.trim()} onClick={directOrder}>Create direct PO</button>
    </form>
    <div className="production-purchase-requests"><div className="production-section-head"><h2>Purchase requests</h2><span>{purchaseRequests.length} records</span></div><div className="table-frame"><table><thead><tr><th>Request</th><th>Items</th><th>Reason</th><th>Required by</th><th>Estimate</th><th>Status</th><th /></tr></thead><tbody>{purchaseRequests.map((request) => <tr key={request._id}><td><strong>{request.id}</strong></td><td>{request.lines.map((line) => <small key={line.sku}>{line.item}: {line.purchaseQuantity} {line.purchaseUnit}</small>)}</td><td>{request.reason || request.productName || '-'}</td><td>{request.requiredByDate || '-'}</td><td>{formatMoney(request.totalEstimatedCost, currency)}</td><td><span className={`production-status ${request.status.toLowerCase()}`}>{formatStatus(request.status)}</span></td><td>{['DRAFT', 'REQUESTED'].includes(request.status) && <><button type="button" disabled={saving} onClick={() => act(() => api.approveProductionPurchaseRequest(request._id), `${request.id} approved.`)}>Approve</button><button type="button" disabled={saving} onClick={() => act(() => api.rejectProductionPurchaseRequest(request._id), `${request.id} rejected.`)}>Reject</button></>}{request.status === 'APPROVED' && <button className="primary-action" type="button" disabled={saving} onClick={() => act(() => api.convertProductionPurchaseRequest(request._id, { submitForApproval: true }), `${request.id} converted to purchase order(s).`)}>Create PO</button>}</td></tr>)}</tbody></table></div></div>
    <div className="production-purchase-requests"><div className="production-section-head"><h2>Purchase orders</h2><span>{purchaseOrders.length} records</span></div><div className="table-frame"><table><thead><tr><th>Order</th><th>Supplier</th><th>Delivery</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>{purchaseOrders.map((order) => <tr key={order._id}><td><strong>{order.id}</strong><small>{order.lines.map((line) => `${line.item}: ${line.quantity} ${line.unit}`).join(', ')}</small></td><td>{order.supplierName}</td><td>{order.expectedDeliveryDate || '-'}</td><td>{formatMoney(order.total, currency)}</td><td><span className={`production-status ${order.status.toLowerCase()}`}>{formatStatus(order.status)}</span></td><td>{['DRAFT', 'PENDING_APPROVAL'].includes(order.status) && <button type="button" disabled={saving} onClick={() => act(() => api.approveProductionPurchaseOrder(order._id), `${order.id} approved.`)}>Approve</button>}{['APPROVED', 'PARTIALLY_RECEIVED'].includes(order.status) && <button className="primary-action" type="button" onClick={() => setReceivingOrder(order)}>Receive</button>}</td></tr>)}</tbody></table></div></div>
    {receivingOrder && <ReceiptModal order={receivingOrder} onClose={() => setReceivingOrder(null)} onSave={async (payload) => { await api.receiveProductionPurchaseOrder(receivingOrder._id, payload); await onRefresh(); setReceivingOrder(null); onNotice({ tone: 'success', text: `Receipt recorded for ${receivingOrder.id}.` }) }} />}
  </section>
}

function ResourcesView({ configuration, currency, onSave }: { configuration: ProductionConfiguration; currency: string; onSave: (configuration: ProductionConfiguration) => Promise<void> }) {
  const [draft, setDraft] = useState<ProductionConfiguration>(configuration)
  const [unitDraft, setUnitDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await onSave({ ...draft, overheadRatePerUnit: Number(draft.overheadRatePerUnit || 0) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="production-resources">
      <div className="production-resource-grid">
        <ResourceTable title="Production workers" description="Active hourly, daily, or monthly rates and available hours per day are used for automatic labor estimates." rows={draft.workers} columns={[
          { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'skills', label: 'Skills' }, { key: 'rateType', label: 'Rate method' }, { key: 'hourlyRate', label: `Rate (${currency})`, numeric: true }, { key: 'overtimeRate', label: 'Overtime rate', numeric: true }, { key: 'availableHoursPerDay', label: 'Hours/day', numeric: true },
        ]} onChange={(workers) => setDraft((current) => ({ ...current, workers }))} onAdd={() => setDraft((current) => ({ ...current, workers: [...current.workers, { code: '', name: '', role: '', skills: [], rateType: 'hourly', hourlyRate: 0, overtimeRate: 0, availableHoursPerDay: 8, active: true }] }))} />
        <ResourceTable title="Equipment" description="Capacity and runtime are included in production plans." rows={draft.machines} columns={[
          { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'machineType', label: 'Type' }, { key: 'costingMethod', label: 'Cost method' }, { key: 'hourlyRate', label: `Rate (${currency})`, numeric: true }, { key: 'purchasePrice', label: 'Purchase cost', numeric: true }, { key: 'usefulLifeYears', label: 'Life (years)', numeric: true }, { key: 'capacityPerHour', label: 'Capacity / hr', numeric: true }, { key: 'operatingHours', label: 'Operating hrs', numeric: true }, { key: 'maintenanceIntervalHours', label: 'Maintain after hrs', numeric: true }, { key: 'status', label: 'Status' },
        ]} onChange={(machines) => setDraft((current) => ({ ...current, machines }))} onAdd={() => setDraft((current) => ({ ...current, machines: [...current.machines, { code: '', name: '', machineType: '', costingMethod: 'hourly', hourlyRate: 0, purchasePrice: 0, usefulLifeYears: 0, capacityPerHour: 0, operatingHours: 0, maintenanceIntervalHours: 0, status: 'Available' }] }))} />
        <ResourceTable title="Utilities" description="Use these rates for electricity, water, fuel, gas, and similar inputs." rows={draft.utilities} columns={[
          { key: 'name', label: 'Utility' }, { key: 'unit', label: 'Unit' }, { key: 'rate', label: `Rate (${currency})`, numeric: true },
        ]} onChange={(utilities) => setDraft((current) => ({ ...current, utilities }))} onAdd={() => setDraft((current) => ({ ...current, utilities: [...current.utilities, { name: '', unit: 'unit', rate: 0 }] }))} />
        <ResourceTable title="Unit conversions" description="Store a rule as one source unit equals the conversion factor in the target unit." rows={draft.conversions} columns={[
          { key: 'fromUnit', label: 'From unit' }, { key: 'toUnit', label: 'To unit' }, { key: 'factor', label: 'Factor', numeric: true },
        ]} onChange={(conversions) => setDraft((current) => ({ ...current, conversions }))} onAdd={() => setDraft((current) => ({ ...current, conversions: [...current.conversions, { fromUnit: '', toUnit: '', factor: 1 }] }))} />
        <ResourceTable title="Overhead allocation" description="Allocate rent, admin, and other overheads per unit, batch, hour, percentage, or fixed amount." rows={draft.overheadCosts || []} columns={[
          { key: 'name', label: 'Cost name' }, { key: 'amount', label: `Amount (${currency})`, numeric: true }, { key: 'allocationMethod', label: 'Allocation method' },
        ]} onChange={(overheadCosts) => setDraft((current) => ({ ...current, overheadCosts }))} onAdd={() => setDraft((current) => ({ ...current, overheadCosts: [...(current.overheadCosts || []), { name: '', amount: 0, allocationMethod: 'per_unit', active: true }] }))} />
      </div>

      <div className="production-configuration-footer">
        <label>
          Allocated overhead per finished unit ({currency})
          <input type="number" min="0" step="0.01" value={draft.overheadRatePerUnit} onChange={(event) => setDraft((current) => ({ ...current, overheadRatePerUnit: Number(event.target.value) }))} />
        </label>
        <label>
          Transport cost per batch ({currency})
          <input type="number" min="0" step="0.01" value={draft.transportCostPerBatch || 0} onChange={(event) => setDraft((current) => ({ ...current, transportCostPerBatch: Number(event.target.value) }))} />
        </label>
        <label className="production-inline-check"><input type="checkbox" checked={Boolean(draft.separationOfDuties)} onChange={(event) => setDraft((current) => ({ ...current, separationOfDuties: event.target.checked }))} />Require a different approver for purchase requests</label>
        <div className="production-units">
          <span>Units: {draft.units.join(', ') || 'None configured'}</span>
          <input value={unitDraft} placeholder="Add unit" onChange={(event) => setUnitDraft(event.target.value)} />
          <button type="button" onClick={() => {
            const unit = unitDraft.trim()
            if (!unit || draft.units.includes(unit)) return
            setDraft((current) => ({ ...current, units: [...current.units, unit] }))
            setUnitDraft('')
          }}>Add unit</button>
        </div>
        <button className="primary-action" type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save resources & rates'}</button>
      </div>
    </section>
  )
}

function ResourceTable<T extends object>({ title, description, rows, columns, onChange, onAdd }: {
  title: string
  description: string
  rows: T[]
  columns: Array<{ key: keyof T; label: string; numeric?: boolean }>
  onChange: (rows: T[]) => void
  onAdd: () => void
}) {
  const update = (rowIndex: number, key: keyof T, value: string, numeric?: boolean) => {
    onChange(rows.map((row, index) => index === rowIndex ? { ...row, [key]: numeric ? Number(value) : value } as T : row))
  }
  return (
    <section className="production-resource-table">
      <div className="production-section-head"><div><h2>{title}</h2><p>{description}</p></div><button type="button" onClick={onAdd}>Add</button></div>
      <div className="table-frame">
        <table>
          <thead><tr>{columns.map((column) => <th key={String(column.key)}>{column.label}</th>)}<th aria-label="Remove row" /></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={columns.length + 1} className="production-empty-cell">Nothing configured.</td></tr> : rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => <td key={String(column.key)}><input type={column.numeric ? 'number' : 'text'} min={column.numeric ? '0' : undefined} step={column.numeric ? '0.01' : undefined} value={String(row[column.key] ?? '')} onChange={(event) => update(rowIndex, column.key, event.target.value, column.numeric)} /></td>)}
                <td><button type="button" className="production-remove-row" aria-label={`Remove ${title} row`} onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RecipeModal({ inventory, configuration, processes, currency, onClose, onSave }: {
  inventory: Array<{ sku: string; item: string; category: string; stock: number; price: number; baseUnit?: string; itemType?: string }>
  configuration: ProductionConfiguration
  processes: ProductionProcess[]
  currency: string
  onClose: () => void
  onSave: (recipe: NewProductionRecipe) => Promise<void>
}) {
  const materialInventory = inventory.filter((item) => !isFinishedProduct(item))
  const inventoryProducts = inventory
  const defaultFinishedProduct = inventoryProducts.find(isFinishedProduct)
  const [finishedProductSku, setFinishedProductSku] = useState(defaultFinishedProduct?.sku || '')
  const [productName, setProductName] = useState(defaultFinishedProduct?.item || '')
  const [productUnit, setProductUnit] = useState(defaultFinishedProduct?.baseUnit || 'piece')
  const [yieldQuantity, setYieldQuantity] = useState('1')
  const [sellingPrice, setSellingPrice] = useState('0')
  const [expectedWastePercent, setExpectedWastePercent] = useState('0')
  const [processId, setProcessId] = useState('')
  const [notes, setNotes] = useState('')
  const [materials, setMaterials] = useState<ProductionMaterial[]>([])
  const [machines, setMachines] = useState<ProductionResourceAssignment[]>([])
  const [utilities, setUtilities] = useState<ProductionUtilityAssignment[]>([])
  const [steps, setSteps] = useState([{ name: 'Production', durationHours: 0, capacityPerHour: 0, instructions: '', qualityCheck: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addMaterial = () => {
    setMaterials((current) => [...current, { sku: '', item: '', quantity: 1, unit: 'unit', wastePercent: 0, materialType: 'material', substitutes: [] }])
  }
  const selectMaterial = (index: number, sku: string) => {
    const match = materialInventory.find((item) => item.sku === sku)
    if (!match) return
    setMaterials((current) => current.map((material, materialIndex) => materialIndex === index ? { ...material, sku: match.sku, item: match.item, unit: match.baseUnit || material.unit, materialType: match.itemType === 'packaging_material' ? 'packaging' : 'material' } : material))
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!productName.trim() || Number(yieldQuantity) <= 0 || materials.length === 0 || materials.some((material) => !material.sku || !material.item || material.quantity <= 0)) {
      setError('Add the finished product name, its yield, and at least one valid inventory material.')
      return
    }
    try {
      setSaving(true)
      setError('')
      await onSave({
        productSku: finishedProductSku || undefined, productName: productName.trim(), productUnit, yieldQuantity: Number(yieldQuantity), sellingPrice: Number(sellingPrice || 0), expectedWastePercent: Number(expectedWastePercent || 0), processId,
        materials, labor: [], machines, utilities, processSteps: steps.filter((step) => step.name.trim()), notes, active: false,
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save recipe.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="entry-modal production-recipe-modal" onSubmit={submit}>
        <div className="detail-head"><div><h2>New recipe / bill of materials</h2><p>Define one standard production batch. The planner scales it to any target.</p></div><button type="button" aria-label="Close" onClick={onClose}>x</button></div>
        {error && <div className="production-notice error">{error}</div>}
        <div className="field-grid">
          <label>Product from inventory<select value={finishedProductSku || '__new__'} onChange={(event) => {
            const sku = event.target.value === '__new__' ? '' : event.target.value
            const product = inventoryProducts.find((item) => item.sku === sku)
            setFinishedProductSku(sku)
            setProductName(product?.item || '')
            setProductUnit(product?.baseUnit || configuration.units[0] || 'piece')
            setSellingPrice(String(product?.price || 0))
          }}><option value="__new__">Create a new finished product</option>{inventoryProducts.map((item) => <option key={item.sku} value={item.sku}>{item.item} ({item.category})</option>)}</select></label>
          <label>Finished product name<input value={productName} onChange={(event) => setProductName(event.target.value)} readOnly={Boolean(finishedProductSku)} required /></label>
          <label>Yield quantity<input type="number" min="0.01" step="0.01" value={yieldQuantity} onChange={(event) => setYieldQuantity(event.target.value)} required /></label>
          <label>Output unit<select value={productUnit} onChange={(event) => setProductUnit(event.target.value)}>{configuration.units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          <label>Selling price ({currency})<input type="number" min="0" step="0.01" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} /></label>
          <label>Expected product waste (%)<input type="number" min="0" max="100" step="0.01" value={expectedWastePercent} onChange={(event) => setExpectedWastePercent(event.target.value)} /></label>
          <label>Reusable process<select value={processId} onChange={(event) => setProcessId(event.target.value)}><option value="">Use recipe steps</option>{processes.filter((process) => process.active).map((process) => <option key={process._id} value={process._id}>{process.name}</option>)}</select></label>
        </div>

        <RecipeMaterials materials={materials} inventory={materialInventory} units={configuration.units} onChange={setMaterials} onAdd={addMaterial} onSelect={selectMaterial} />
        <RecipeAssignments title="Equipment assignments" resources={configuration.machines.map((machine) => machine.name)} values={machines} onChange={setMachines} />
        <UtilityAssignments resources={configuration.utilities.map((utility) => utility.name)} values={utilities} onChange={setUtilities} />
        <RecipeSteps steps={steps} onChange={setSteps} />
        <label className="production-full-width">Notes<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save recipe'}</button></div>
      </form>
    </div>
  )
}

function RecipeMaterials({ materials, inventory, units = [], onChange, onAdd, onSelect }: { materials: ProductionMaterial[]; inventory: Array<{ sku: string; item: string; baseUnit?: string; itemType?: string }>; units?: string[]; onChange: (materials: ProductionMaterial[]) => void; onAdd: () => void; onSelect: (index: number, sku: string) => void }) {
  const update = (index: number, field: 'quantity' | 'unit' | 'wastePercent' | 'materialType', value: string) => onChange(materials.map((material, materialIndex) => materialIndex === index ? { ...material, [field]: field === 'quantity' || field === 'wastePercent' ? Number(value) : value } : material))
  const updateSubstitute = (index: number, sku: string) => {
    const substitute = inventory.find((item) => item.sku === sku)
    onChange(materials.map((material, materialIndex) => materialIndex === index ? { ...material, substitutes: substitute ? [{ sku: substitute.sku, item: substitute.item, quantity: material.quantity, unit: substitute.baseUnit || material.unit }] : [] } : material))
  }
  const updateSubstituteQuantity = (index: number, value: string) => onChange(materials.map((material, materialIndex) => materialIndex === index ? { ...material, substitutes: (material.substitutes || []).map((substitute) => ({ ...substitute, quantity: Number(value) })) } : material))
  const availableUnits = Array.from(new Set([...units, 'piece', 'kg', 'litre', 'g', 'ml', 'unit']))
  return <section className="production-modal-section"><div className="production-section-head"><div><h3>Materials, packaging, and waste allowance</h3><p className="production-helper">Define quantities for this recipe yield once; the planner scales them to the requested output.</p></div><button type="button" onClick={onAdd}>Add material</button></div>{inventory.length === 0 && <p className="production-helper">Create raw-material or packaging inventory items before selecting recipe materials.</p>}{materials.map((material, index) => <div className="production-material-row" key={`${material.sku}-${index}`}><div className="production-form-row"><select value={material.sku} onChange={(event) => onSelect(index, event.target.value)} aria-label="Material" disabled={inventory.length === 0} required><option value="">{inventory.length ? 'Select material' : 'No inventory materials available'}</option>{inventory.map((item) => <option value={item.sku} key={item.sku}>{item.item}</option>)}</select><input type="number" min="0.0001" step="0.0001" value={material.quantity} aria-label="Required quantity" placeholder="Amount" onChange={(event) => update(index, 'quantity', event.target.value)} /><select value={material.unit} aria-label="Unit" onChange={(event) => update(index, 'unit', event.target.value)}>{!availableUnits.includes(material.unit) && material.unit && <option value={material.unit}>{material.unit}</option>}{availableUnits.map((u) => <option key={u} value={u}>{u}</option>)}</select><input type="number" min="0" max="100" step="0.01" value={material.wastePercent || 0} aria-label="Expected material waste percentage" placeholder="Waste %" title="Expected material waste percentage" onChange={(event) => update(index, 'wastePercent', event.target.value)} /><button type="button" className="production-remove-row" onClick={() => onChange(materials.filter((_, materialIndex) => materialIndex !== index))}>Remove</button></div><div className="production-substitute-row"><label>Requirement type<select value={material.materialType || 'material'} onChange={(event) => update(index, 'materialType', event.target.value)}><option value="material">Material</option><option value="packaging">Packaging</option></select></label><label>Substitute material<select value={material.substitutes?.[0]?.sku || ''} onChange={(event) => updateSubstitute(index, event.target.value)}><option value="">No substitute</option>{inventory.filter((item) => item.sku !== material.sku).map((item) => <option value={item.sku} key={item.sku}>{item.item}</option>)}</select></label>{material.substitutes?.[0] && <label>Substitute quantity<input type="number" min="0.0001" step="0.0001" value={material.substitutes[0].quantity} onChange={(event) => updateSubstituteQuantity(index, event.target.value)} /></label>}</div></div>)}</section>
}

function RecipeAssignments({ title, resources, values, onChange }: { title: string; resources: string[]; values: ProductionResourceAssignment[]; onChange: (values: ProductionResourceAssignment[]) => void }) {
  if (resources.length === 0) return <section className="production-modal-section"><h3>{title}</h3><p className="production-helper">Add resources and rates in Resources & Cost to include this in production costing.</p></section>
  return <section className="production-modal-section"><h3>{title}</h3><div className="production-assignment-grid">{resources.map((name) => { const assignment = values.find((value) => value.name === name); return <label key={name}><span><input type="checkbox" checked={Boolean(assignment)} onChange={(event) => onChange(event.target.checked ? [...values, { name, hoursPerBatch: 1 }] : values.filter((value) => value.name !== name))} /> {name}</span>{assignment && <input type="number" min="0.01" step="0.01" value={assignment.hoursPerBatch} onChange={(event) => onChange(values.map((value) => value.name === name ? { ...value, hoursPerBatch: Number(event.target.value) } : value))} />}</label> })}</div></section>
}

function UtilityAssignments({ resources, values, onChange }: { resources: string[]; values: ProductionUtilityAssignment[]; onChange: (values: ProductionUtilityAssignment[]) => void }) {
  if (resources.length === 0) return null
  return <section className="production-modal-section"><h3>Utility assignments</h3><div className="production-assignment-grid">{resources.map((name) => { const assignment = values.find((value) => value.name === name); return <label key={name}><span><input type="checkbox" checked={Boolean(assignment)} onChange={(event) => onChange(event.target.checked ? [...values, { name, quantityPerBatch: 1 }] : values.filter((value) => value.name !== name))} /> {name}</span>{assignment && <input type="number" min="0.01" step="0.01" value={assignment.quantityPerBatch} onChange={(event) => onChange(values.map((value) => value.name === name ? { ...value, quantityPerBatch: Number(event.target.value) } : value))} />}</label> })}</div></section>
}

function RecipeSteps({ steps, onChange }: { steps: Array<{ name: string; durationHours: number; capacityPerHour: number; instructions: string; qualityCheck: string }>; onChange: (steps: Array<{ name: string; durationHours: number; capacityPerHour: number; instructions: string; qualityCheck: string }>) => void }) {
  const update = (index: number, field: 'name' | 'durationHours' | 'capacityPerHour' | 'instructions' | 'qualityCheck', value: string) => onChange(steps.map((step, stepIndex) => stepIndex === index ? { ...step, [field]: field === 'durationHours' || field === 'capacityPerHour' ? Number(value) : value } : step))
  return <section className="production-modal-section"><div className="production-section-head"><div><h3>Process steps</h3><p className="production-helper">Set output units per worker-hour to estimate labor-hours and workers needed for a shift.</p></div><button type="button" onClick={() => onChange([...steps, { name: '', durationHours: 0, capacityPerHour: 0, instructions: '', qualityCheck: '' }])}>Add step</button></div>{steps.map((step, index) => <div className="production-step-row" key={index}><input value={step.name} placeholder="Step name" onChange={(event) => update(index, 'name', event.target.value)} /><input type="number" min="0" step="0.01" value={step.durationHours} placeholder="Fallback hours / batch" aria-label="Fallback hours per batch" onChange={(event) => update(index, 'durationHours', event.target.value)} /><input type="number" min="0" step="0.01" value={step.capacityPerHour || 0} placeholder="Units / worker-hour" aria-label="Finished units per worker-hour" onChange={(event) => update(index, 'capacityPerHour', event.target.value)} /><input value={step.qualityCheck} placeholder="Quality check" onChange={(event) => update(index, 'qualityCheck', event.target.value)} /><button type="button" className="production-remove-row" onClick={() => onChange(steps.filter((_, stepIndex) => stepIndex !== index))}>Remove</button></div>)}</section>
}

function ProcessModal({ inventory, configuration, onClose, onSave }: { inventory: Array<{ sku: string; item: string; category: string; baseUnit?: string; itemType?: string }>; configuration: ProductionConfiguration; onClose: () => void; onSave: (process: Omit<ProductionProcess, '_id'>) => Promise<void> }) {
  const materialInventory = inventory.filter((item) => !isFinishedProduct(item))
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<ProductionProcessStep[]>([{ sequence: 1, name: 'Preparation', durationHours: 0, capacityPerHour: 0, description: '', instructions: '', qualityCheck: '', materials: [], expectedOutputQuantity: 0, expectedWastePercent: 0, optional: false, reworkAllowed: false }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const updateStep = (index: number, field: 'name' | 'durationHours' | 'capacityPerHour' | 'qualityCheck' | 'instructions' | 'optional' | 'reworkAllowed', value: string | boolean) => setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, [field]: ['durationHours', 'capacityPerHour'].includes(field) ? Number(value) : value } : step))
  const selectStepMaterial = (index: number, sku: string) => {
    const item = materialInventory.find((row) => row.sku === sku)
    setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, materials: item ? [{ sku: item.sku, item: item.item, quantity: 1, unit: item.baseUnit || 'piece', materialType: item.itemType === 'packaging_material' ? 'packaging' : 'material' }] : [] } : step))
  }
  const updateStepMaterialQuantity = (index: number, quantity: string) => setSteps((current) => current.map((step, stepIndex) => stepIndex === index && step.materials?.[0] ? { ...step, materials: [{ ...step.materials[0], quantity: Number(quantity) }] } : step))
  const selectResources = (index: number, field: 'machines' | 'utilities', values: string[]) => setSteps((current) => current.map((step, stepIndex) => stepIndex !== index ? step : { ...step, [field]: field === 'utilities' ? values.map((name) => ({ name, quantityPerBatch: 1 })) : values.map((name) => ({ name, hoursPerBatch: 1 })) }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !steps.some((step) => step.name.trim())) { setError('Add a process name and at least one named step.'); return }
    try {
      setSaving(true); setError('')
      await onSave({ name: name.trim(), code: code.trim() || name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_'), description: description.trim(), steps: steps.filter((step) => step.name.trim()).map((step, index) => ({ ...step, sequence: index + 1 })), active: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the process.')
    } finally { setSaving(false) }
  }
  return <div className="modal-backdrop" role="presentation"><form className="entry-modal production-recipe-modal" onSubmit={submit}><div className="detail-head"><div><h2>New production process</h2><p>Set process steps and output units per worker-hour to estimate labor for the requested quantity.</p></div><button type="button" aria-label="Close" onClick={onClose}>x</button></div>{error && <div className="production-notice error">{error}</div>}<div className="field-grid"><label>Process name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Process code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label><label className="production-full-width">Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label></div><section className="production-modal-section"><div className="production-section-head"><div><h3>Sequenced steps</h3><p className="production-helper">Capacity is finished units per worker-hour. If omitted, fallback hours per batch are used.</p></div><button type="button" onClick={() => setSteps((current) => [...current, { sequence: current.length + 1, name: '', durationHours: 0, capacityPerHour: 0, description: '', instructions: '', qualityCheck: '', materials: [], expectedOutputQuantity: 0, expectedWastePercent: 0, optional: false, reworkAllowed: false }])}>Add step</button></div>{steps.map((step, index) => <div className="production-process-step" key={index}><div className="production-form-row"><input value={step.name} placeholder="Step name" onChange={(event) => updateStep(index, 'name', event.target.value)} /><input type="number" min="0" step="0.01" value={step.durationHours} aria-label="Fallback hours per batch" placeholder="Fallback hours / batch" onChange={(event) => updateStep(index, 'durationHours', event.target.value)} /><input type="number" min="0" step="0.01" value={step.capacityPerHour || 0} aria-label="Finished units per worker-hour" placeholder="Units / worker-hour" onChange={(event) => updateStep(index, 'capacityPerHour', event.target.value)} /><button type="button" className="production-remove-row" onClick={() => setSteps((current) => current.filter((_, stepIndex) => stepIndex !== index))}>Remove</button></div><div className="production-form-row"><select value={step.materials?.[0]?.sku || ''} onChange={(event) => selectStepMaterial(index, event.target.value)}><option value="">No step material</option>{materialInventory.map((item) => <option key={item.sku} value={item.sku}>{item.item}</option>)}</select><input type="number" min="0.0001" step="0.0001" disabled={!step.materials?.[0]} value={step.materials?.[0]?.quantity || 0} aria-label="Step material quantity" onChange={(event) => updateStepMaterialQuantity(index, event.target.value)} /><input value={step.qualityCheck || ''} placeholder="Quality check" onChange={(event) => updateStep(index, 'qualityCheck', event.target.value)} /><input value={step.instructions || ''} placeholder="Work instructions" onChange={(event) => updateStep(index, 'instructions', event.target.value)} /></div><div className="production-process-resources"><label>Equipment<select multiple value={(step.machines || []).map((row) => row.name)} onChange={(event) => selectResources(index, 'machines', Array.from(event.target.selectedOptions, (option) => option.value))}>{configuration.machines.map((machine) => <option key={machine.name} value={machine.name}>{machine.name}</option>)}</select></label><label>Utilities<select multiple value={(step.utilities || []).map((row) => row.name)} onChange={(event) => selectResources(index, 'utilities', Array.from(event.target.selectedOptions, (option) => option.value))}>{configuration.utilities.map((utility) => <option key={utility.name} value={utility.name}>{utility.name}</option>)}</select></label><label>Expected output<input type="number" min="0" step="0.01" value={step.expectedOutputQuantity || 0} onChange={(event) => setSteps((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, expectedOutputQuantity: Number(event.target.value) } : row))} /></label><label>Expected waste (%)<input type="number" min="0" step="0.01" value={step.expectedWastePercent || 0} onChange={(event) => setSteps((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, expectedWastePercent: Number(event.target.value) } : row))} /></label><label className="production-inline-check"><input type="checkbox" checked={Boolean(step.optional)} onChange={(event) => updateStep(index, 'optional', event.target.checked)} />Optional</label><label className="production-inline-check"><input type="checkbox" checked={Boolean(step.reworkAllowed)} onChange={(event) => updateStep(index, 'reworkAllowed', event.target.checked)} />Rework</label></div></div>)}</section><div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save process'}</button></div></form></div>
}

function ReceiptModal({ order, onClose, onSave }: { order: PurchaseOrder; onClose: () => void; onSave: (payload: { date?: string; receipts: Array<{ sku: string; acceptedQuantity: number; damagedQuantity?: number; rejectedQuantity?: number; unit?: string; unitPrice?: number; batchNumber?: string; expiryDate?: string }> }) => Promise<void> }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState(() => order.lines.map((line) => ({ sku: line.sku, acceptedQuantity: String(Math.max(0, line.quantity - Number(line.receivedQuantity || 0) - Number(line.damagedQuantity || 0) - Number(line.rejectedQuantity || 0))), damagedQuantity: '0', rejectedQuantity: '0', unit: line.unit, unitPrice: String(line.unitPrice), batchNumber: '', expiryDate: '' })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const update = (index: number, field: keyof typeof rows[number], value: string) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setSaving(true); setError('')
      await onSave({ date, receipts: rows.map((row) => ({ sku: row.sku, acceptedQuantity: Number(row.acceptedQuantity), damagedQuantity: Number(row.damagedQuantity), rejectedQuantity: Number(row.rejectedQuantity), unit: row.unit, unitPrice: Number(row.unitPrice), batchNumber: row.batchNumber, expiryDate: row.expiryDate })) })
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not record the receipt.') } finally { setSaving(false) }
  }
  return <div className="modal-backdrop" role="presentation"><form className="entry-modal production-quality-modal" onSubmit={submit}><div className="detail-head"><div><h2>Receive purchase order</h2><p>{order.id} - {order.supplierName}</p></div><button type="button" aria-label="Close" onClick={onClose}>x</button></div>{error && <div className="production-notice error">{error}</div>}<label>Receipt date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><div className="table-frame"><table><thead><tr><th>Item</th><th>Accepted</th><th>Damaged</th><th>Rejected</th><th>Batch</th><th>Expiry</th></tr></thead><tbody>{order.lines.map((line, index) => <tr key={line.sku}><td>{line.item}<small>{line.quantity} {line.unit} ordered</small></td><td><input type="number" min="0" step="0.01" value={rows[index].acceptedQuantity} onChange={(event) => update(index, 'acceptedQuantity', event.target.value)} /></td><td><input type="number" min="0" step="0.01" value={rows[index].damagedQuantity} onChange={(event) => update(index, 'damagedQuantity', event.target.value)} /></td><td><input type="number" min="0" step="0.01" value={rows[index].rejectedQuantity} onChange={(event) => update(index, 'rejectedQuantity', event.target.value)} /></td><td><input value={rows[index].batchNumber} onChange={(event) => update(index, 'batchNumber', event.target.value)} /></td><td><input type="date" value={rows[index].expiryDate} onChange={(event) => update(index, 'expiryDate', event.target.value)} /></td></tr>)}</tbody></table></div><div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Receiving...' : 'Record receipt'}</button></div></form></div>
}

function ExecutionModal({ order, inventory, onClose, onSave }: { order: ProductionOrder; inventory: Array<{ sku: string; item: string; baseUnit?: string; stock: number }>; onClose: () => void; onSave: (payload: { actualOutput?: number; actualWaste?: number; actualWasteReason?: string; reusableWaste?: boolean; reusableWasteSku?: string; reusableWasteQuantity?: number; reusableWasteUnit?: string; productionTimeHours?: number; actualMaterials: Array<{ sku: string; quantity: number; unit?: string }>; labor: Array<{ name: string; hours: number; overtimeHours?: number }>; machines: Array<{ name: string; hours: number }>; utilities: Array<{ name: string; quantity: number; unit?: string }>; byProducts?: Array<{ sku: string; item: string; quantity: number; unit: string; notes?: string }> }) => Promise<void> }) {
  const [actualOutput, setActualOutput] = useState(String(order.actualOutput || order.plannedQuantity))
  const [actualWaste, setActualWaste] = useState(String(order.actualWaste || 0))
  const [actualWasteReason, setActualWasteReason] = useState(order.actualWasteReason || '')
  const [reusableWaste, setReusableWaste] = useState(false)
  const [reusableWasteSku, setReusableWasteSku] = useState('')
  const [reusableWasteQuantity, setReusableWasteQuantity] = useState('0')
  const [byProducts, setByProducts] = useState<Array<{ sku: string; item: string; quantity: string; unit: string; notes: string }>>([])
  const [productionTimeHours, setProductionTimeHours] = useState(String(order.productionTimeHours || order.expectedDurationHours || 0))
  const [materials, setMaterials] = useState(() => (order.actualMaterials?.length ? order.actualMaterials : order.requirements).map((row) => ({ sku: row.sku, item: row.item, quantity: String('quantity' in row ? row.quantity : row.requiredQuantity), unit: row.unit })))
  const [laborName, setLaborName] = useState('')
  const [laborHours, setLaborHours] = useState('0')
  const [machineName, setMachineName] = useState('')
  const [machineHours, setMachineHours] = useState('0')
  const [utilityName, setUtilityName] = useState('')
  const [utilityQuantity, setUtilityQuantity] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const updateMaterial = (index: number, value: string) => setMaterials((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: value } : row))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setSaving(true); setError('')
      await onSave({ actualOutput: Number(actualOutput), actualWaste: Number(actualWaste), actualWasteReason, reusableWaste, reusableWasteSku, reusableWasteQuantity: Number(reusableWasteQuantity), reusableWasteUnit: inventory.find((item) => item.sku === reusableWasteSku)?.baseUnit || '', productionTimeHours: Number(productionTimeHours), actualMaterials: materials.map((row) => ({ sku: row.sku, quantity: Number(row.quantity), unit: row.unit })).filter((row) => row.quantity > 0), labor: laborName.trim() && Number(laborHours) > 0 ? [{ name: laborName, hours: Number(laborHours) }] : [], machines: machineName.trim() && Number(machineHours) > 0 ? [{ name: machineName, hours: Number(machineHours) }] : [], utilities: utilityName.trim() && Number(utilityQuantity) > 0 ? [{ name: utilityName, quantity: Number(utilityQuantity) }] : [], byProducts: byProducts.map((row) => ({ ...row, quantity: Number(row.quantity) })).filter((row) => row.sku && row.quantity > 0) })
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not record actual production usage.') } finally { setSaving(false) }
  }
  return <div className="modal-backdrop" role="presentation"><form className="entry-modal production-quality-modal" onSubmit={submit}><div className="detail-head"><div><h2>Record actual production</h2><p>{order.id} - {order.productName}</p></div><button type="button" aria-label="Close" onClick={onClose}>x</button></div>{error && <div className="production-notice error">{error}</div>}<div className="field-grid"><label>Actual output ({order.productUnit})<input type="number" min="0.01" step="0.01" value={actualOutput} onChange={(event) => setActualOutput(event.target.value)} /></label><label>Actual waste (material-input units)<input type="number" min="0" step="0.01" value={actualWaste} onChange={(event) => setActualWaste(event.target.value)} /></label><label className="production-full-width">Waste reason<textarea rows={2} value={actualWasteReason} onChange={(event) => setActualWasteReason(event.target.value)} required={Number(actualWaste) > 0} /></label><label className="production-inline-check"><input type="checkbox" checked={reusableWaste} onChange={(event) => setReusableWaste(event.target.checked)} />Some waste is reusable</label>{reusableWaste && <><label>Reusable waste quantity<input type="number" min="0.0001" step="0.0001" required value={reusableWasteQuantity} onChange={(event) => setReusableWasteQuantity(event.target.value)} /></label><label>Reusable waste inventory item<select value={reusableWasteSku} onChange={(event) => setReusableWasteSku(event.target.value)}><option value="">Select at approval</option>{inventory.map((item) => <option key={item.sku} value={item.sku}>{item.item} ({item.baseUnit || 'unit'})</option>)}</select></label></>}<label>Production time (hours)<input type="number" min="0" step="0.01" value={productionTimeHours} onChange={(event) => setProductionTimeHours(event.target.value)} /></label><label>Worker<input value={laborName} onChange={(event) => setLaborName(event.target.value)} placeholder="Worker name" /></label><label>Labor hours<input type="number" min="0" step="0.01" value={laborHours} onChange={(event) => setLaborHours(event.target.value)} /></label><label>Machine<input value={machineName} onChange={(event) => setMachineName(event.target.value)} placeholder="Machine name" /></label><label>Machine hours<input type="number" min="0" step="0.01" value={machineHours} onChange={(event) => setMachineHours(event.target.value)} /></label><label>Utility<input value={utilityName} onChange={(event) => setUtilityName(event.target.value)} placeholder="Electricity, water, fuel..." /></label><label>Utility quantity<input type="number" min="0" step="0.01" value={utilityQuantity} onChange={(event) => setUtilityQuantity(event.target.value)} /></label></div><div className="table-frame"><table><thead><tr><th>Material</th><th>Actual quantity</th><th>Unit</th></tr></thead><tbody>{materials.map((row, index) => <tr key={row.sku}><td>{row.item}</td><td><input type="number" min="0" step="0.01" value={row.quantity} onChange={(event) => updateMaterial(index, event.target.value)} /></td><td>{row.unit}</td></tr>)}</tbody></table></div><section className="production-modal-section"><div className="production-section-head"><h3>By-products</h3><button type="button" onClick={() => setByProducts((rows) => [...rows, { sku: '', item: '', quantity: '0', unit: 'piece', notes: '' }])}>Add by-product</button></div>{byProducts.map((row, index) => <div className="production-form-row" key={index}><select value={row.sku} onChange={(event) => { const item = inventory.find((candidate) => candidate.sku === event.target.value); setByProducts((rows) => rows.map((candidate, rowIndex) => rowIndex === index ? { ...candidate, sku: item?.sku || '', item: item?.item || '', unit: item?.baseUnit || 'piece' } : candidate)) }}><option value="">Inventory item</option>{inventory.map((item) => <option key={item.sku} value={item.sku}>{item.item}</option>)}</select><input type="number" min="0" step="0.01" value={row.quantity} placeholder="Quantity" onChange={(event) => setByProducts((rows) => rows.map((candidate, rowIndex) => rowIndex === index ? { ...candidate, quantity: event.target.value } : candidate))} /><span>{row.unit}</span><input value={row.notes} placeholder="Notes" onChange={(event) => setByProducts((rows) => rows.map((candidate, rowIndex) => rowIndex === index ? { ...candidate, notes: event.target.value } : candidate))} /><button type="button" onClick={() => setByProducts((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></div>)}</section><div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save actuals'}</button></div></form></div>
}

function QualityModal({ order, onClose, onSave }: { order: ProductionOrder; onClose: () => void; onSave: (payload: { result: 'PASS' | 'REWORK' | 'REJECT'; actualOutput?: number; actualWaste?: number; actualWasteReason?: string; notes?: string; inspectedBy?: string }) => Promise<void> }) {
  const [result, setResult] = useState<'PASS' | 'REWORK' | 'REJECT'>('PASS')
  const [actualOutput, setActualOutput] = useState(String(order.plannedQuantity))
  const [actualWaste, setActualWaste] = useState(String(order.actualWaste || 0))
  const [actualWasteReason, setActualWasteReason] = useState(order.actualWasteReason || '')
  const [notes, setNotes] = useState('')
  const [inspectedBy, setInspectedBy] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      await onSave({ result, actualOutput: Number(actualOutput), actualWaste: Number(actualWaste), actualWasteReason, notes, inspectedBy })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not record quality inspection.')
    } finally {
      setSaving(false)
    }
  }
  return <div className="modal-backdrop" role="presentation"><form className="entry-modal production-quality-modal" onSubmit={submit}><div className="detail-head"><div><h2>Quality inspection</h2><p>{order.id} · {order.productName}</p></div><button type="button" aria-label="Close" onClick={onClose}>x</button></div>{error && <div className="production-notice error">{error}</div>}<div className="field-grid"><label>Result<select value={result} onChange={(event) => setResult(event.target.value as 'PASS' | 'REWORK' | 'REJECT')}><option value="PASS">Pass - complete production</option><option value="REWORK">Rework required</option><option value="REJECT">Reject and place on hold</option></select></label><label>Actual output ({order.productUnit})<input type="number" min="0" step="0.01" value={actualOutput} onChange={(event) => setActualOutput(event.target.value)} /></label><label>Actual waste (material-input units)<input type="number" min="0" step="0.01" value={actualWaste} onChange={(event) => setActualWaste(event.target.value)} /></label><label className="production-full-width">Waste reason<textarea rows={2} value={actualWasteReason} onChange={(event) => setActualWasteReason(event.target.value)} required={Number(actualWaste) > 0} /></label><label>Inspected by<input value={inspectedBy} onChange={(event) => setInspectedBy(event.target.value)} placeholder="Name or role" /></label><label className="production-full-width">Inspection notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div><div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record inspection'}</button></div></form></div>
}

function titleForTab(tab: ProductionTab) {
  return { planner: 'Production Planning', objectives: 'What Do I Need?', recipes: 'Recipes & Bill of Materials', processes: 'Production Processes', orders: 'Production Orders & Quality', procurement: 'Purchasing & Receiving', resources: 'Resources & Cost Allocation', waste: 'Waste & By-products' }[tab]
}

function subtitleForTab(tab: ProductionTab) {
  return { planner: 'Scale approved recipes into reservation-aware material requirements, capacity, purchase shortages, and projected cost.', objectives: 'Start with a business target, see every resource and shortage, then convert the calculation into approved work.', recipes: 'Create versioned BOMs with packaging, expected waste, and substitute materials before approval.', processes: 'Define reusable production steps, capacity, work instructions, quality checks, and rework settings.', orders: 'Review calculated requirements, reserve stock, record actual usage, and move work through quality.', procurement: 'Create requests and purchase orders, approve them, and receive accepted, damaged, or rejected quantities.', resources: 'Configure labor, equipment, utilities, unit conversions, and allocated overheads.', waste: 'Review production waste and by-products; approve reusable outputs before they enter available stock.' }[tab]
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function isFinishedProduct(item: { itemType?: string; category?: string }) {
  const type = String(item.itemType || '').trim().toLowerCase()
  const category = String(item.category || '').trim().toLowerCase()
  return ['finished_product', 'semi_finished_product'].includes(type) || ['finished goods', 'finished product', 'finished products'].includes(category)
}

function formatAvailability(status?: string) {
  if (status === 'FULLY_AVAILABLE') return 'Fully available'
  if (status === 'PARTIALLY_AVAILABLE') return 'Covered by incoming stock'
  if (status === 'PURCHASE_REQUIRED') return 'Purchase required'
  return ''
}
