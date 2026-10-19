import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { expect, request as playwrightRequest } from '@playwright/test'

const apiBase = process.env.ACCEPTANCE_API_URL || 'http://localhost:5000/api'
const backendDirectory = path.resolve(import.meta.dirname, '../../Stock-backend')

async function call(api, method, endpoint, data, headers = {}) {
  const response = await api.fetch(endpoint, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(data === undefined ? {} : { data }),
  })
  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!response.ok()) {
    throw new Error(`${method} ${endpoint} returned ${response.status()}: ${JSON.stringify(body)}`)
  }
  return body
}

function parseCurrency(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  assert.ok(Number.isFinite(parsed), `Expected a currency amount, received ${value}`)
  return parsed
}

export async function runCoffeeAcceptance(page, testInfo, focus) {
  const api = await playwrightRequest.newContext({ baseURL: apiBase })
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8)
  const ownerKey = `acceptance-${suffix}@example.test`
  const password = `Accept-${suffix}-Pass!`
  const branchCode = `E2E${suffix.toUpperCase()}`
  const warehouseCode = `E2E${suffix.slice(0, 5).toUpperCase()}`
  const productCategory = `Acceptance-${suffix}`
  const today = new Date().toISOString().slice(0, 10)
  let registered = false

  try {
    const unauthenticated = await api.get('/master-data/units')
    expect(unauthenticated.status(), 'protected endpoints reject missing credentials').toBe(401)

    const session = await call(api, 'POST', '/auth/register', {
      username: `Acceptance ${suffix}`,
      email: ownerKey,
      password,
    })
    registered = true
    expect(session.token).toBeTruthy()

    const authHeaders = { authorization: `Bearer ${session.token}`, 'x-branch-code': 'MAIN' }
    const business = await call(api, 'PATCH', '/organization/business', {
      name: `Coffee Acceptance ${suffix}`,
      template: 'cafe',
      currency: 'USD',
    }, authHeaders)
    expect(business.name).toBe(`Coffee Acceptance ${suffix}`)

    const branch = await call(api, 'POST', '/organization/branches', {
      name: `Acceptance Branch ${suffix}`,
      code: branchCode,
    }, authHeaders)
    expect(branch.code).toBe(branchCode)
    authHeaders['x-branch-code'] = branch.code

    const units = {
      gram: `gram_${suffix}`,
      kilogram: `kilogram_${suffix}`,
      milliliter: `milliliter_${suffix}`,
      cup: `cup_${suffix}`,
      piece: `piece_${suffix}`,
    }
    for (const [name, code] of Object.entries(units)) {
      await call(api, 'POST', '/master-data/units', {
        name: `${name} ${suffix}`,
        code,
        category: name === 'piece' || name === 'cup' ? 'count' : 'weight',
      }, authHeaders)
    }
    const conversion = await call(api, 'POST', '/master-data/conversions', {
      fromUnit: units.gram,
      toUnit: units.kilogram,
      factor: 0.001,
      description: `Acceptance-test grams to kilograms ${suffix}`,
    }, authHeaders)
    expect(conversion.factor).toBe(0.001)

    const warehouse = await call(api, 'POST', '/master-data/warehouses', {
      name: `Acceptance Warehouse ${suffix}`,
      code: warehouseCode,
      type: 'general',
    }, authHeaders)
    expect(warehouse.code).toBe(warehouseCode)

    const supplier = await call(api, 'POST', '/master-data/suppliers', {
      name: `Acceptance Supplier ${suffix}`,
    }, authHeaders)
    const supplierId = String(supplier._id || supplier.id)
    const materialRows = [
      { key: 'coffee', name: 'Coffee Beans', quantity: 12, unit: units.gram, price: 0.02, type: 'raw_material', category: 'Coffee' },
      { key: 'sugar', name: 'Sugar', quantity: 5, unit: units.gram, price: 0.004, type: 'raw_material', category: 'Sweetener' },
      { key: 'milk', name: 'Milk', quantity: 30, unit: units.milliliter, price: 0.002, type: 'raw_material', category: 'Dairy' },
      { key: 'water', name: 'Water', quantity: 200, unit: units.milliliter, price: 0.0005, type: 'raw_material', category: 'Water' },
      { key: 'cups', name: 'Paper Cups', quantity: 1, unit: units.piece, price: 0.03, type: 'packaging_material', category: 'Packaging' },
    ]
    for (const row of materialRows) {
      row.sku = `E2E-${suffix.toUpperCase()}-${row.key.toUpperCase()}`
      await call(api, 'POST', '/master-data/items', {
        sku: row.sku,
        item: `${row.name} ${suffix}`,
        category: row.category,
        itemType: row.type,
        baseUnit: row.unit,
        stock: 0,
        purchasePrice: row.price,
        defaultWarehouseCode: warehouseCode,
        defaultSupplierId: supplierId,
        supplierOptions: [{
          supplierId,
          supplierName: supplier.name,
          price: row.price,
          purchaseUnit: row.unit,
          packSize: 1,
        }],
      }, authHeaders)
    }

    const productSku = `E2E-${suffix.toUpperCase()}-AMERICAN-COFFEE`
    const recipe = await call(api, 'POST', '/production/recipes', {
      productSku,
      productName: `American Coffee ${suffix}`,
      productUnit: units.cup,
      sellingPrice: 350,
      yieldQuantity: 1,
      expectedWastePercent: 0,
      materials: materialRows.map((row) => ({
        sku: row.sku,
        item: row.name,
        quantity: row.quantity,
        unit: row.unit,
        materialType: row.key === 'cups' ? 'packaging' : 'material',
      })),
      labor: [{ name: 'Barista', hoursPerBatch: 0.1 }],
      machines: [{ name: 'Coffee Brewer', hoursPerBatch: 0.1 }],
      utilities: [{ name: 'Electricity', quantityPerBatch: 0.1 }],
    }, authHeaders)
    const approvedRecipe = await call(api, 'POST', `/production/recipes/${recipe._id}/approve`, {}, authHeaders)
    expect(approvedRecipe.approvalStatus).toBe('APPROVED')

    const initialPlan = await call(api, 'GET', `/production/plan?recipeId=${encodeURIComponent(recipe._id)}&quantity=100`, undefined, authHeaders)
    expect(initialPlan.plannedQuantity).toBe(100)
    const shortageRows = initialPlan.requirements.filter((row) => Number(row.shortageQuantity) > 0)
    expect(shortageRows).toHaveLength(5)

    const purchaseRequest = await call(api, 'POST', '/production/purchase-requests', {
      recipeId: recipe._id,
      quantity: 100,
      notes: `Acceptance procurement ${suffix}`,
    }, authHeaders)
    expect(purchaseRequest.lines).toHaveLength(5)
    const approvedRequest = await call(api, 'POST', `/production/purchase-requests/${purchaseRequest._id}/approve`, {}, authHeaders)
    expect(approvedRequest.status).toBe('APPROVED')
    const purchaseOrders = await call(api, 'POST', `/production/purchase-requests/${purchaseRequest._id}/purchase-orders`, {}, authHeaders)
    expect(purchaseOrders.length).toBeGreaterThan(0)

    const approvedPurchaseOrders = []
    for (const purchaseOrder of purchaseOrders) {
      const purchaseOrderId = purchaseOrder._id
      const approvedOrder = await call(api, 'POST', `/production/purchase-orders/${purchaseOrderId}/approve`, {}, authHeaders)
      expect(approvedOrder.status).toBe('APPROVED')
      approvedPurchaseOrders.push(approvedOrder)
      const receivedOrder = await call(api, 'POST', `/production/purchase-orders/${purchaseOrderId}/receive`, {
        date: today,
        receipts: purchaseOrder.lines.map((line) => ({
          sku: line.sku,
          acceptedQuantity: line.quantity,
          unit: line.unit,
          warehouseCode,
          unitPrice: line.unitPrice,
        })),
      }, authHeaders)
      expect(receivedOrder.status).toBe('RECEIVED')
    }

    const postReceiptStock = await call(api, 'GET', '/master-data', undefined, authHeaders)
    for (const row of materialRows) {
      expect(postReceiptStock.items.find((item) => item.sku === row.sku)?.stock).toBeGreaterThanOrEqual(row.quantity * 100)
    }
    const planAfterReceipt = await call(api, 'GET', `/production/plan?recipeId=${encodeURIComponent(recipe._id)}&quantity=100`, undefined, authHeaders)
    expect(planAfterReceipt.requirements.every((row) => Number(row.shortageQuantity) === 0)).toBe(true)

    const order = await call(api, 'POST', '/production/orders', {
      recipeId: recipe._id,
      quantity: 100,
      warehouseCode,
      notes: `Acceptance production ${suffix}`,
    }, authHeaders)
    const productionOrderId = order._id
    const approvedProduction = await call(api, 'POST', `/production/orders/${productionOrderId}/approve`, {}, authHeaders)
    expect(approvedProduction.status).toBe('APPROVED')
    const reservedOrder = await call(api, 'POST', `/production/orders/${productionOrderId}/reserve`, { warehouseCode }, authHeaders)
    expect(reservedOrder.status).toBe('MATERIALS_READY')
    const startedOrder = await call(api, 'PATCH', `/production/orders/${productionOrderId}`, { status: 'IN_PROGRESS' }, authHeaders)
    expect(startedOrder.status).toBe('IN_PROGRESS')

    const execution = await call(api, 'POST', `/production/orders/${productionOrderId}/execution`, {
      actualOutput: 100,
      actualMaterials: order.requirements.map((requirement) => {
        const row = materialRows.find((material) => material.sku === requirement.sku)
        return { sku: row.sku, quantity: requirement.requiredQuantity, unit: requirement.unit, unitCost: row.price }
      }),
      labor: [{ name: 'Barista', hours: 2, rate: 15 }],
      machines: [{ name: 'Coffee Brewer', hours: 1, rate: 8 }],
      utilities: [{ name: 'Electricity', quantity: 3, unit: 'kWh', rate: 1 }],
    }, authHeaders)
    expect(execution.actualCost.total).toBeGreaterThan(0)
    const productionUnitCost = Number(execution.actualCost.unit)

    const standard = await call(api, 'POST', '/quality/standards', {
      name: `American Coffee Fill Standard ${suffix}`,
      productSku,
      criteria: [{ name: 'Fill Volume', minimum: 180, maximum: 220, unit: 'ml' }],
    }, authHeaders)
    const inspection = await call(api, 'POST', '/quality/inspections', {
      standardId: standard._id,
      inspectionDate: today,
      productSku,
      batchNumber: order.id,
      productionOrderId: order.id,
      actualOutput: 100,
      results: [{ name: 'Fill Volume', value: 200, unit: 'ml' }],
    }, authHeaders)
    expect(inspection.outcome).toBe('PASS')
    const productionOrders = await call(api, 'GET', '/production/orders', undefined, authHeaders)
    expect(productionOrders.find((entry) => entry.id === order.id)?.status).toBe('COMPLETED')

    const productBeforeSale = await call(api, 'GET', '/master-data', undefined, authHeaders)
    expect(productBeforeSale.items.find((item) => item.sku === productSku)?.stock).toBe(100)
    const sale = await call(api, 'POST', '/sales', {
      id: `E2E-SALE-${suffix.toUpperCase()}`,
      date: today,
      customer: `Acceptance Walk-in ${suffix}`,
      warehouseCode,
      payment: 'Cash',
      items: [{ sku: productSku, quantity: 20, unit: units.cup, unitPrice: 350 }],
    }, authHeaders)
    expect(sale.rawQuantity).toBe(20)
    expect(sale.netRevenue).toBe(7000)

    const productAfterSale = await call(api, 'GET', '/master-data', undefined, authHeaders)
    expect(productAfterSale.items.find((item) => item.sku === productSku)?.stock).toBe(80)
    const salesReadBack = await call(api, 'GET', `/sales?from=${today}&to=${today}`, undefined, authHeaders)
    expect(salesReadBack.rows.some((entry) => entry.id === sale.id)).toBe(true)
    expect(Number(sale.costOfGoodsSold)).toBeGreaterThanOrEqual(0)
    expect(Number(sale.grossProfit)).toBe(Number(sale.netRevenue) - Number(sale.costOfGoodsSold))

    const dashboard = await call(api, 'GET', `/dashboard?from=${today}&to=${today}&category=${encodeURIComponent(productCategory)}`, undefined, authHeaders)
    const dashboardSales = dashboard.metrics.find((metric) => metric.label === 'Total Sales')
    expect(dashboardSales).toBeTruthy()
    expect(parseCurrency(dashboardSales.value)).toBe(7000)
    const report = await call(api, 'GET', `/reports?from=${today}&to=${today}`, undefined, authHeaders)
    expect(parseCurrency(report.summary.totalSales)).toBe(7000)
    expect(parseCurrency(report.summary.costOfGoodsSold)).toBe(Number(sale.costOfGoodsSold))
    expect(parseCurrency(report.summary.grossProfit)).toBe(Number(sale.grossProfit))

    if (focus === 'sales-reporting') {
      const expectedCostOfGoodsSold = Number((productionUnitCost * 20).toFixed(4))
      expect(
        Number(sale.costOfGoodsSold),
        'POS COGS for produced stock should use the actual production unit cost',
      ).toBeCloseTo(expectedCostOfGoodsSold, 3)

      await page.addInitScript(({ token, activeBranch }) => {
        localStorage.setItem('tri_ltd_auth_token', token)
        localStorage.setItem('tri_active_branch_code', activeBranch)
      }, { token: session.token, activeBranch: branchCode })
      await page.goto('/')
      await expect(page.getByText('Total Sales', { exact: true }).first()).toBeVisible()
      await expect(page.getByText(/American Coffee/).first()).toBeVisible()
      const productionNavigation = page.getByRole('button', { name: /^Production/ })
      await expect(productionNavigation).toBeVisible()

      await call(api, 'PATCH', '/organization/business', { template: 'retail_shop' }, authHeaders)
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('tri:business-template-updated')))
      await expect(productionNavigation).toHaveCount(0)
      await expect(page.getByRole('region', { name: 'Processing workspace' })).toHaveCount(0)
      const blockedProductionResponse = await api.get('/production/orders', { headers: authHeaders })
      expect(blockedProductionResponse.status(), 'retail businesses cannot access production APIs').toBe(403)
    }

    if (focus === 'purchasing') {
      expect(approvedPurchaseOrders.every((entry) => entry.status === 'APPROVED')).toBe(true)
      expect(planAfterReceipt.requirements.every((row) => row.shortageQuantity === 0)).toBe(true)
    }
    if (focus === 'quality-production') {
      expect(inspection.results.every((result) => result.passed)).toBe(true)
      expect(productBeforeSale.items.find((item) => item.sku === productSku)?.stock).toBe(100)
      expect(productionUnitCost).toBeGreaterThan(0)
    }

    testInfo.annotations.push({
      type: 'scenario',
      description: `tenant=${ownerKey}; order=${order.id}; sale=${sale.id}; revenue=${sale.netRevenue}; COGS=${sale.costOfGoodsSold}; productionUnitCost=${productionUnitCost}`,
    })
  } finally {
    await api.dispose()
    const cleanup = spawnSync(
      process.execPath,
      ['test/helpers/cleanupAcceptanceTenant.js', ownerKey],
      { cwd: backendDirectory, encoding: 'utf8', timeout: 60_000 },
    )
    if (cleanup.error || cleanup.status !== 0) {
      throw new Error(`Acceptance tenant cleanup failed: ${cleanup.error?.message || cleanup.stderr || cleanup.status}`)
    }
    const cleanupOutput = cleanup.stdout.trim().split(/\r?\n/)
    const cleanupResult = JSON.parse(cleanupOutput.at(-1))
    testInfo.annotations.push({
      type: 'cleanup',
      description: `${registered ? 'registered tenant' : 'unused generated owner key'}; ${cleanupResult.deletedDocuments} scoped documents removed`,
    })
  }
}
