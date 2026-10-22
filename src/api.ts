import type { FilterPeriod, Page } from './types'

export type CreditFilter = 'all' | 'salesCredit' | 'purchasesCredit'

const DEFAULT_API_URL = 'http://localhost:5000/api'
const TOKEN_STORAGE_KEY = 'tri_ltd_auth_token'
export const ACTIVE_BRANCH_STORAGE_KEY = 'tri_active_branch_code'
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
  reference?: string
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
  netRevenue?: number
  costOfGoodsSold?: number
  grossProfit?: number
  grossMarginPercent?: number
  status: string
  lineItems?: LineItem[]
  itemSummary?: string
}

export type CreatePosSalePayload = {
  customer: string
  phone?: string
  discount?: number
  tax?: number
  payment: 'Cash' | 'Card' | 'Mobile Money' | 'Credit'
  paidAmount?: number
  source?: string
  allowFlexibleStock?: boolean
  date?: string
  id?: string
  items: Array<{ sku: string; item: string; category?: string; quantity: number; unitPrice: number; unit?: string }>
}

export type SaleReturnRow = {
  id: string
  saleId: string
  date: string
  reason: string
  status: 'Pending' | 'Approved' | 'Rejected'
  items: Array<{ sku: string; item: string; quantity: number }>
  approvedBy?: { username?: string; email?: string }
}

export type DashboardResponse = {
  categories: string[]
  metrics: Metric[]
  salesBars: number[]
  salesLabels: string[]
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
  originalQuantity?: number
  originalUnit?: string
  convertedQuantity?: number
  convertedUnit?: string
  warehouseCode?: string
  fromWarehouseCode?: string
  toWarehouseCode?: string
  batchNumber?: string
  expiryDate?: string
  serialNumber?: string
  previousStock: number
  newStock: number
  reason?: string
  reference?: string
  partner?: string
  showcaseQuantity?: number
  expectedReturnDate?: string
  user?: string
}

export type OpenShowcase = {
  reference: string
  sku: string
  item: string
  partner: string
  issueDate: string
  expectedReturnDate?: string
  quantityIssued: number
  quantityReturned: number
  quantitySold: number
  remainingQuantity: number
}

export type ShowcaseIssuePayload = {
  sku: string
  quantity: number
  partner: string
  expectedReturnDate?: string
  notes?: string
}

export type ShowcaseClosePayload = {
  outcome: 'RETURNED' | 'SOLD'
  quantity: number
  unitPrice?: number
  payment?: string
  paidAmount?: number
  notes?: string
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
  page?: number
  pageSize?: number
  totalPages?: number
  hasNextPage?: boolean
  hasPrevPage?: boolean
}

export type GlobalSearchResult = {
  id: string
  type: string
  title: string
  subtitle: string
  page: Page
}

export type GlobalSearchResponse = {
  results: GlobalSearchResult[]
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
    totalPurchasesOnCredit?: string
    salesCash?: string
    salesOnCredit?: string
    totalSalesOnCredit?: string
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

export type UnitDefinition = {
  _id?: string
  name: string
  code: string
  symbol: string
  category: string
  allowDecimals: boolean
  active: boolean
}

export type UnitConversionRule = {
  _id: string
  productSku?: string
  fromUnit: string
  toUnit: string
  factor: number
  description?: string
  active: boolean
}

export type SupplierRecord = {
  _id: string
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  paymentTerms?: string
  active: boolean
  notes?: string
}

export type CustomerRecord = {
  _id: string
  name: string
  phone?: string
  email?: string
  address?: string
  paymentStatus?: string
  creditLimit?: number
  paymentTerms?: string
  active: boolean
  notes?: string
}

export type WarehouseRecord = {
  _id?: string
  name: string
  code: string
  type: 'raw_material' | 'packaging' | 'finished_goods' | 'quarantine' | 'waste' | 'general'
  address?: string
  active: boolean
}

export type SupplierOption = {
  supplierId: string
  supplierName: string
  price: number
  purchaseUnit: string
  packSize?: number
}

export type ItemMaster = {
  id: string
  sku: string
  item: string
  description: string
  category: string
  itemType: 'raw_material' | 'packaging_material' | 'consumable' | 'finished_product' | 'semi_finished_product' | 'by_product'
  baseUnit: string
  measurementAmount: number
  status: string
  stock: number
  minimumStock: number
  maximumStock: number
  reorderLevel: number
  defaultSupplierId: string
  supplierOptions: SupplierOption[]
  purchasePrice: number
  sellingPrice: number
  priceTiers: Array<{ name: string; price: number }>
  defaultWarehouseCode: string
  batchTracking: boolean
  expiryTracking: boolean
  serialTracking: boolean
}

export type WarehouseBalance = {
  warehouseCode: string
  warehouseName: string
  warehouseType: string
  sku: string
  item: string
  baseUnit: string
  onHand: number
  reserved: number
  available: number
  incoming: number
  quarantined: number
  averageCost: number
}

export type ExpiryAlert = {
  sku: string
  item: string
  warehouseCode: string
  batchNumber: string
  expiryDate: string
  quantity: number
  status: 'Expired' | 'Due soon'
}

export type MasterDataResponse = {
  units: UnitDefinition[]
  conversions: UnitConversionRule[]
  suppliers: SupplierRecord[]
  customers: CustomerRecord[]
  warehouses: WarehouseRecord[]
  stock: WarehouseBalance[]
  expiryAlerts: ExpiryAlert[]
  items: ItemMaster[]
  ownerKey: string
}

export type StockOperationPayload = {
  operation: 'RECEIPT' | 'CUSTOMER_RETURN' | 'ISSUE' | 'TRANSFER' | 'COUNT' | 'QUARANTINE' | 'RELEASE_QUARANTINE' | 'RESERVE' | 'RELEASE_RESERVATION' | 'MARK_INCOMING' | 'CLEAR_INCOMING' | 'PRODUCTION_CONSUMPTION' | 'PRODUCTION_OUTPUT' | 'SALE' | 'DAMAGE' | 'EXPIRY' | 'WASTE'
  sku: string
  quantity: number
  unit: string
  warehouseCode?: string
  fromWarehouseCode?: string
  toWarehouseCode?: string
  reason?: string
  reference?: string
  partner?: string
  unitPrice?: number
  batchNumber?: string
  expiryDate?: string
  serialNumber?: string
  allowNegative?: boolean
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

export type NewProductionRecipe = Omit<ProductionRecipe, '_id' | 'productSku'> & { productSku?: string }

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

export type PartnerTransfer = {
  _id: string
  reference: string
  partner: string
  partnerPhone?: string
  sku?: string
  item: string
  category: string
  quantityReceived: number
  quantitySold: number
  quantityReturned: number
  remainingQuantity: number
  partnerUnitCost: number
  customerUnitPrice: number
  totalPartnerCost: number
  totalPotentialRevenue: number
  realizedRevenue: number
  receivedDate: string
  status: 'OPEN' | 'CLOSED'
  notes?: string
}

export type PartnerTransferPayload = {
  partner: string
  partnerPhone?: string
  sku?: string
  item: string
  category?: string
  quantityReceived: number
  partnerUnitCost: number
  customerUnitPrice: number
  receivedDate?: string
  notes?: string
}

export type PartnerTransferListResponse = {
  rows: PartnerTransfer[]
  count: number
  openCount: number
}

export type AdminActivity = {
  id: string
  type: string
  reference: string
  description: string
  date: string
  status: string
  actor: string
  amount?: string
  section: Page
  shopOwnerKey?: string
  shopName?: string
}

export type AdminOverview = {
  generatedAt: string
  metrics: {
    shops: number
    users: number
    activeUsers: number
    inventoryItems: number
    lowStockCount: number
    outOfStockCount: number
    salesToday: number
    purchasesToday: number
    expensesToday: number
    openLoans: number
    openTransfers: number
  }
  shops: Array<{
    ownerKey: string
    name: string
    email: string
    userCount: number
    active: boolean
    template: string
    processingEnabled: boolean
  }>
  activity: AdminActivity[]
}

export type AdminUser = {
  id: string
  username: string
  email: string
  role: string
  active: boolean
  ownerKey: string
  shopName: string
  shopEmail: string
  createdAt?: string
}

export type CreateAdminUserPayload = {
  username: string
  email: string
  password: string
  role: 'admin' | 'staff'
  ownerKey?: string
}

export type CreateAdminBusinessPayload = {
  businessName: string
  username: string
  email: string
  password: string
  template: string
  processingEnabled: boolean
}

export type AdminBusiness = {
  id: string
  ownerKey: string
  name: string
  email: string
  template: string
  processingEnabled: boolean
}

export type ShopRole =
  | 'cashier'
  | 'sales_associate'
  | 'customer_service_representative'
  | 'stock_clerk'
  | 'visual_merchandiser'
  | 'loss_prevention_officer'
  | 'shift_supervisor'
  | 'assistant_store_manager'
  | 'store_manager'
  | 'manager'
  | 'storekeeper'
  | 'production_supervisor'
  | 'procurement_officer'
  | 'quality_officer'
  | 'accountant'

export type PermissionAction = 'view' | 'create' | 'edit' | 'approve' | 'cancel' | 'delete' | 'export'

export type RolePermission = {
  module: string
  actions: PermissionAction[]
}

export type AccessRole = {
  id: string
  name: string
  code: string
  description: string
  permissions: RolePermission[]
  builtIn: boolean
  active: boolean
}

export type AccessRoleListResponse = {
  modules: string[]
  actions: PermissionAction[]
  roles: AccessRole[]
}

export type ShopUser = {
  id: string
  username: string
  email: string
  shopRole: ShopRole
  accountType: 'admin' | 'staff'
  accessRoleCode: string
  active: boolean
  createdAt?: string
}

export type BackendNotification = {
  _id: string
  ownerKey: string
  recipientEmail?: string
  actorId?: string
  actorUsername: string
  actorRole: string
  title: string
  message: string
  category: 'production' | 'inventory' | 'sales' | 'loans' | 'transfers' | 'users' | 'system'
  severity: 'critical' | 'warning' | 'info' | 'success'
  targetPage?: Page
  actionLabel?: string
  metadata?: Record<string, any>
  read: boolean
  createdAt: string
}

export type NotificationsResponse = {
  notifications: BackendNotification[]
  unreadCount: number
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

export type ProductionMaterial = {
  sku: string
  item: string
  quantity: number
  unit: string
  wastePercent?: number
  materialType?: 'material' | 'packaging'
  substitutes?: Array<{ sku: string; item: string; quantity: number; unit: string }>
}

export type ProductionResourceAssignment = {
  name: string
  hoursPerBatch: number
}

export type ProductionUtilityAssignment = {
  name: string
  quantityPerBatch: number
}

export type ProductionProcessStep = {
  sequence?: number
  name: string
  description?: string
  durationHours: number
  capacityPerHour?: number
  instructions?: string
  qualityCheck?: string
  materials?: ProductionMaterial[]
  labor?: ProductionResourceAssignment[]
  machines?: ProductionResourceAssignment[]
  utilities?: ProductionUtilityAssignment[]
  expectedOutputQuantity?: number
  expectedWastePercent?: number
  optional?: boolean
  reworkAllowed?: boolean
}

export type ProductionProcess = {
  _id: string
  code: string
  name: string
  description?: string
  steps: ProductionProcessStep[]
  active: boolean
}

export type QualityCriterion = {
  name: string
  minimum: number | null
  maximum: number | null
  requiredResult: string
  unit: string
}

export type QualityStandard = {
  _id: string
  name: string
  productSku: string
  processCode: string
  stepSequence: number | null
  criteria: QualityCriterion[]
  active: boolean
  createdAt?: string
}

export type QualityInspectionOutcome = 'PASS' | 'FAIL' | 'ON_HOLD' | 'REWORK' | 'REJECT'

export type QualityInspection = {
  _id: string
  standardId: string
  inspectionDate: string
  inspector: { id: string; username: string; email: string }
  productSku: string
  productName: string
  productionOrderId: string
  batchNumber: string
  processCode: string
  stepSequence: number | null
  results: Array<{ name: string; value: string | number; unit: string; passed: boolean }>
  outcome: QualityInspectionOutcome
  notes: string
  createdAt?: string
}

export type QualityOverview = {
  standards: QualityStandard[]
  inspections: QualityInspection[]
  products: Array<{ sku: string; item: string; baseUnit: string; itemType: string }>
  processes: ProductionProcess[]
  orders: Array<{ id: string; productSku: string; productName: string; status: string }>
}

export type ProductionRecipe = {
  _id: string
  productSku: string
  productName: string
  productUnit: string
  version?: number
  versionLabel?: string
  approvalStatus?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  approvedAt?: string
  sellingPrice: number
  yieldQuantity: number
  servingSize?: number
  servingUnit?: string
  expectedWastePercent?: number
  materials: ProductionMaterial[]
  labor: ProductionResourceAssignment[]
  machines: ProductionResourceAssignment[]
  utilities: ProductionUtilityAssignment[]
  processSteps: ProductionProcessStep[]
  processId?: string
  notes?: string
  active: boolean
}

export type ProductionConfiguration = {
  units: string[]
  conversions: Array<{ fromUnit: string; toUnit: string; factor: number }>
  workers: Array<{ code?: string; name: string; role: string; skills?: string[]; rateType?: 'monthly' | 'daily' | 'hourly' | 'per_product' | 'per_batch'; rate?: number; hourlyRate: number; overtimeRate?: number; availableHoursPerDay?: number; active?: boolean }>
  machines: Array<{ code?: string; name: string; machineType: string; purchasePrice?: number; purchaseDate?: string; usefulLifeYears?: number; residualValue?: number; capacityUnit?: string; hourlyRate: number; rate?: number; costingMethod?: 'hourly' | 'quantity' | 'batch' | 'depreciation'; capacityPerHour: number; electricityPerHour?: number; fuelPerHour?: number; status: string; operatingHours?: number; maintenanceIntervalHours?: number; lastMaintenanceHours?: number }>
  utilities: Array<{ name: string; unit: string; rate: number }>
  overheadCosts?: Array<{ name: string; amount: number; allocationMethod: 'per_unit' | 'per_batch' | 'per_production_hour' | 'percentage' | 'fixed'; active?: boolean }>
  overheadRatePerUnit: number
  transportCostPerBatch?: number
  separationOfDuties?: boolean
}

export type ProductionRequirement = {
  sku: string
  item: string
  unit: string
  baseRequiredQuantity?: number
  wasteQuantity?: number
  recipeUnit?: string
  purchaseUnit?: string
  purchaseQuantity?: number
  packageSize?: number
  packagesRequired?: number
  supplierId?: string
  supplierName?: string
  onHandQuantity?: number
  reservedQuantity?: number
  incomingQuantity?: number
  projectedAvailableQuantity?: number
  availabilityStatus?: 'FULLY_AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'PURCHASE_REQUIRED'
  requiredQuantity: number
  availableQuantity: number
  shortageQuantity: number
  unitCost: number
  materialCost?: number
  materialType?: 'material' | 'packaging'
  purchaseCost?: number
}

export type ProductionPlan = {
  recipeId: string
  productSku: string
  productName: string
  productUnit: string
  servingSize?: number
  servingUnit?: string
  plannedQuantity: number
  yieldQuantity: number
  batches: number
  durationHours: number
  expectedWasteQuantity?: number
  expectedWastePercent?: number
  totalMaterialInputQuantity?: number
  recipeVersion?: number
  recipeApproved?: boolean
  estimatedEndDate?: string
  scheduleWarnings?: string[]
  assumptions?: { branchCode?: string; scheduledDate?: string; stockBasis?: string; purchaseRounding?: string; valuationMethod?: string }
  materialsReady: boolean
  requirements: ProductionRequirement[]
  labor: Array<{ name: string; hours: number; rate: number; cost: number }>
  laborEstimate?: { workerHours: number; workersRequired: number; shiftHours: number; averageHourlyRate: number }
  machines: Array<{ name: string; hours: number; rate: number; cost: number }>
  utilities: Array<{ name: string; quantity: number; unit: string; rate: number; cost: number }>
  cost: { material: number; packaging?: number; labor: number; machine: number; utility: number; overhead: number; transport?: number; waste?: number; rework?: number; total: number; unit: number }
}

export type ProductionQualityInspection = {
  date: string
  result: 'PASS' | 'FAIL' | 'ON_HOLD' | 'REWORK' | 'REJECT'
  notes?: string
  inspectedBy?: string
}

export type ProductionOrder = {
  _id: string
  id: string
  recipeId: string
  recipeVersion?: number
  productSku: string
  productName: string
  productUnit: string
  plannedQuantity: number
  actualOutput: number
  actualWaste: number
  actualWastePercent?: number
  actualWasteReason?: string
  expectedWasteQuantity?: number
  expectedWastePercent?: number
  totalMaterialInputQuantity?: number
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PLANNED' | 'MATERIALS_READY' | 'IN_PROGRESS' | 'PAUSED' | 'QUALITY_CHECK' | 'REWORK' | 'COMPLETED' | 'ON_HOLD' | 'REJECTED' | 'CANCELLED'
  scheduledDate: string
  plannedEndDate?: string
  approvedAt?: string
  expectedDurationHours: number
  warehouseCode?: string
  startedAt?: string
  pausedAt?: string
  productionTimeHours?: number
  materialReservations?: Array<{ sku: string; warehouseCode?: string; quantity: number; unit: string; reservedAt?: string }>
  requirements: ProductionRequirement[]
  cost: ProductionPlan['cost']
  actualMaterials?: Array<{ sku: string; item: string; quantity: number; unit: string; unitCost: number; cost: number }>
  actualLabor?: Array<{ name: string; hours: number; rate: number; overtimeHours: number; cost: number }>
  actualMachines?: Array<{ name: string; hours: number; quantity: number; rate: number; cost: number }>
  actualUtilities?: Array<{ name: string; quantity: number; unit: string; rate: number; cost: number }>
  byProducts?: Array<{ sku: string; item: string; quantity: number; unit: string; notes?: string }>
  actualCost?: ProductionPlan['cost']
  costVariance?: ProductionPlan['cost']
  qualityInspections: ProductionQualityInspection[]
  notes?: string
  planningAssumptions?: ProductionPlan['assumptions']
  scheduleWarnings?: string[]
  completedAt?: string
}

export type ProductionWasteRecord = {
  _id: string
  id: string
  productionOrderId: string
  productionOrderCode: string
  kind: 'WASTE' | 'BYPRODUCT'
  productSku: string
  productName: string
  sku: string
  item: string
  quantity: number
  unit: string
  reason: string
  reusable: boolean
  inventorySku: string
  inventoryQuantity: number
  inventoryUnit: string
  notes?: string
  status: 'RECORDED' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'REJECTED'
  approvedAt?: string
  postedAt?: string
}

export type ProductionOverview = {
  recipes: ProductionRecipe[]
  orders: ProductionOrder[]
  processes: ProductionProcess[]
  purchaseRequests: PurchaseRequest[]
  configuration: ProductionConfiguration
  inventory: Array<{ sku: string; item: string; category: string; itemType?: string; stock: number; price: number; purchasePrice?: number; baseUnit?: string; onHand?: number; reserved?: number; incoming?: number; available?: number; supplierOptions?: SupplierOption[] }>
  metrics: { activeRecipes: number; openOrders: number; qualityHoldCount: number; completedOrders: number; purchaseRequestCount?: number }
}

export type PurchaseRequest = {
  _id: string
  id: string
  productionOrderId?: string
  recipeId?: string
  productName?: string
  plannedQuantity?: number
  requiredByDate?: string
  reason?: string
  status: 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ORDERED'
  lines: Array<{ sku: string; item: string; shortageQuantity: number; storageUnit: string; purchaseUnit: string; purchaseQuantity: number; packageSize: number; packagesRequired: number; supplierId?: string; supplierName?: string; estimatedUnitPrice?: number; estimatedCost: number }>
  totalEstimatedCost: number
  notes?: string
}

export type ProductionObjective = {
  _id: string
  id: string
  title: string
  objective?: string
  scheduledDate: string
  targets: Array<{ recipeId: string; productSku: string; productName: string; quantity: number; unit: string; sellingPrice?: number }>
  result: { requirements: ProductionRequirement[]; labor: Array<{ name: string; hours: number; cost: number }>; machines: Array<{ name: string; hours: number; cost: number }>; utilities: Array<{ name: string; quantity: number; unit: string; cost: number }>; durationHours: number; totalMaterialInputQuantity?: number; expectedWasteQuantity?: number; expectedWastePercent?: number; totalCost: number; salesValue: number; expectedProfit: number; assumptions?: Record<string, string> }
  status: 'DRAFT' | 'CALCULATED' | 'CONVERTED' | 'CANCELLED'
  convertedOrderIds?: string[]
}

export type PurchaseOrder = {
  _id: string
  id: string
  purchaseRequestId?: string
  supplierId?: string
  supplierName: string
  orderDate: string
  expectedDeliveryDate?: string
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'
  lines: Array<{ sku: string; item: string; quantity: number; unit: string; unitPrice: number; taxRate: number; subtotal: number; tax: number; total: number; receivedQuantity?: number; damagedQuantity?: number; rejectedQuantity?: number }>
  subtotal: number
  tax: number
  total: number
  notes?: string
}

export type ProductionOperations = { objectives: ProductionObjective[]; purchaseOrders: PurchaseOrder[] }

export type Warehouse = {
  name: string
  code: string
  address: string
  active: boolean
}

export type OrganizationBusiness = {
  id: string
  name: string
  address: string
  phone: string
  email: string
  logoUrl: string
  currency: string
  tax: { taxNumber: string; taxRate: number; taxInclusive: boolean }
  template: string
  processingEnabled: boolean
  active: boolean
}

export type OrganizationBranch = {
  id: string
  name: string
  code: string
  address: string
  phone: string
  email: string
  manager: string
  active: boolean
  warehouses: Warehouse[]
}

export type OrganizationUser = {
  id: string
  username: string
  email: string
  role: string
  shopRole: string
  active: boolean
  branchCodes: string[]
  defaultBranchCode: string
}

export type OrganizationResponse = {
  business: OrganizationBusiness
  features: { processing: boolean }
  branches: OrganizationBranch[]
  users: OrganizationUser[]
  activeBranchCode: string
  accessibleBranchCodes: string[]
  templates: string[]
}

export type BusinessFeatureResponse = {
  template: string
  features: { processing: boolean }
}

async function request<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs, ...fetchOptions } = options ?? {}
  const controller = timeoutMs ? new AbortController() : undefined
  const timeoutId = timeoutMs ? window.setTimeout(() => controller?.abort(), timeoutMs) : undefined
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  const activeShopOwnerKey = localStorage.getItem('tri_system_admin_shop_owner_key')
  const activeBranchCode = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY)
  const isSystemAdmin = (() => {
    try {
      return String(JSON.parse(localStorage.getItem('tri_ltd_auth_user') || 'null')?.role || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_') === 'system_admin'
    } catch {
      return false
    }
  })()
  const headers = {
    ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isSystemAdmin && activeShopOwnerKey ? { 'X-Shop-Owner-Key': activeShopOwnerKey } : {}),
    ...(activeBranchCode ? { 'X-Branch-Code': activeBranchCode } : {}),
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

    if (response.status === 204) return undefined as T

    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Try a smaller file or check that the server is running.', { cause: error })
    }
    throw error
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId)
  }
}

function periodQuery(period?: FilterPeriod, from?: string, to?: string, page = 1, limit = 50) {
  const params = new URLSearchParams()
  if (period) params.set('period', period)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  params.set('page', String(page))
  params.set('limit', String(limit))
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
  masterData: () => request<MasterDataResponse>('/master-data'),
  createUnit: (payload: Omit<UnitDefinition, '_id'>) => request<UnitDefinition>('/master-data/units', { method: 'POST', body: JSON.stringify(payload) }),
  updateUnit: (code: string, payload: Partial<UnitDefinition>) => request<UnitDefinition>(`/master-data/units/${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createUnitConversion: (payload: Omit<UnitConversionRule, '_id'>) => request<UnitConversionRule>('/master-data/conversions', { method: 'POST', body: JSON.stringify(payload) }),
  updateUnitConversion: (id: string, payload: Partial<UnitConversionRule>) => request<UnitConversionRule>(`/master-data/conversions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createSupplier: (payload: Omit<SupplierRecord, '_id'>) => request<SupplierRecord>('/master-data/suppliers', { method: 'POST', body: JSON.stringify(payload) }),
  updateSupplier: (id: string, payload: Partial<SupplierRecord>) => request<SupplierRecord>(`/master-data/suppliers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createCustomer: (payload: Omit<CustomerRecord, '_id'>) => request<CustomerRecord>('/master-data/customers', { method: 'POST', body: JSON.stringify(payload) }),
  updateCustomer: (id: string, payload: Partial<CustomerRecord>) => request<CustomerRecord>(`/master-data/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createMasterItem: (payload: Partial<ItemMaster> & { item: string; sku: string; category: string }) => request<ItemMaster>('/master-data/items', { method: 'POST', body: JSON.stringify(payload) }),
  updateMasterItem: (sku: string, payload: Partial<ItemMaster>) => request<ItemMaster>(`/master-data/items/${encodeURIComponent(sku)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createWarehouse: (payload: Omit<WarehouseRecord, '_id'>) => request<WarehouseRecord>('/master-data/warehouses', { method: 'POST', body: JSON.stringify(payload) }),
  updateWarehouse: (code: string, payload: Partial<WarehouseRecord>) => request<WarehouseRecord>(`/master-data/warehouses/${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  recordStockOperation: (payload: StockOperationPayload) => request<StockMovementRow | { outgoing: StockMovementRow; incoming: StockMovementRow }>('/master-data/stock/operations', { method: 'POST', body: JSON.stringify(payload) }),
  organization: () => request<OrganizationResponse>('/organization'),
  businessFeatures: () => request<BusinessFeatureResponse>('/business/features'),
  updateOrganizationBusiness: (payload: Partial<OrganizationBusiness>) => request<OrganizationBusiness>('/organization/business', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  createOrganizationBranch: (payload: Omit<OrganizationBranch, 'id'>) => request<OrganizationBranch>('/organization/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateOrganizationBranch: (code: string, payload: Partial<Omit<OrganizationBranch, 'id' | 'code'>>) => request<OrganizationBranch>(`/organization/branches/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  assignOrganizationUserBranches: (id: string, branchCodes: string[]) => request<OrganizationUser>(`/organization/users/${encodeURIComponent(id)}/branches`, {
    method: 'PATCH',
    body: JSON.stringify({ branchCodes }),
  }),
  accessRoles: () => request<AccessRoleListResponse>('/roles'),
  createAccessRole: (payload: { name: string; code: string; description?: string; permissions: RolePermission[]; active?: boolean }) => request<AccessRole>('/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateAccessRole: (code: string, payload: { name?: string; description?: string; permissions?: RolePermission[]; active?: boolean }) => request<AccessRole>(`/roles/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  dashboard: (filters: { from?: string; to?: string; category?: string; stockStatus?: string } = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    const query = params.toString()
    return request<DashboardResponse>(`/dashboard${query ? `?${query}` : ''}`)
  },
  inventory: (limit = 1000, page = 1) => request<ListResponse<InventoryRow>>(`/inventory?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`),
  productionOverview: () => request<ProductionOverview>('/production'),
  qualityOverview: () => request<QualityOverview>('/quality'),
  createQualityStandard: (payload: Omit<QualityStandard, '_id' | 'active' | 'createdAt'> & { active?: boolean }) => request<QualityStandard>('/quality/standards', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  updateQualityStandard: (id: string, payload: Partial<Omit<QualityStandard, '_id'>>) => request<QualityStandard>(`/quality/standards/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(payload),
  }),
  createQualityInspection: (payload: { standardId: string; inspectionDate?: string; productSku: string; productionOrderId?: string; batchNumber: string; processCode?: string; stepSequence?: number; results: Array<{ name: string; value: string | number }>; notes?: string }) => request<QualityInspection>('/quality/inspections', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  setQualityDisposition: (id: string, outcome: 'ON_HOLD' | 'REWORK' | 'REJECT', notes?: string) => request<QualityInspection>(`/quality/inspections/${encodeURIComponent(id)}/disposition`, {
    method: 'PATCH', body: JSON.stringify({ outcome, notes }),
  }),
  productionOperations: () => request<ProductionOperations>('/production/operations'),
  productionPlan: (recipeId: string, quantity: number, scheduledDate?: string) => request<ProductionPlan>(`/production/plan?recipeId=${encodeURIComponent(recipeId)}&quantity=${encodeURIComponent(String(quantity))}${scheduledDate ? `&scheduledDate=${encodeURIComponent(scheduledDate)}` : ''}`),
  previewProductionObjective: (payload: { targets: Array<{ recipeId: string; quantity: number; sellingPrice?: number }>; scheduledDate?: string }) => request<ProductionObjective['result']>('/production/objectives/preview', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  createProductionObjective: (payload: { title: string; objective?: string; targets: Array<{ recipeId: string; quantity: number; sellingPrice?: number }>; scheduledDate?: string }) => request<ProductionObjective>('/production/objectives', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  convertProductionObjective: (id: string, payload: { scheduledDate?: string; submitForApproval?: boolean } = {}) => request<{ objective: ProductionObjective; orders: ProductionOrder[] }>(`/production/objectives/${encodeURIComponent(id)}/convert`, {
    method: 'POST', body: JSON.stringify(payload),
  }),
  createProductionRecipe: (payload: NewProductionRecipe & { submitForApproval?: boolean }) => request<ProductionRecipe>('/production/recipes', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateProductionRecipe: (id: string, payload: Partial<Omit<ProductionRecipe, '_id'>>) => request<ProductionRecipe>(`/production/recipes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  approveProductionRecipe: (id: string) => request<ProductionRecipe>(`/production/recipes/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  createProductionProcess: (payload: Omit<ProductionProcess, '_id'>) => request<ProductionProcess>('/production/processes', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateProductionProcess: (id: string, payload: Partial<Omit<ProductionProcess, '_id'>>) => request<ProductionProcess>(`/production/processes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  createProductionOrder: (payload: { recipeId: string; quantity: number; scheduledDate?: string; notes?: string; submitForApproval?: boolean }) => request<ProductionOrder>('/production/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateProductionOrder: (id: string, payload: { status?: ProductionOrder['status']; scheduledDate?: string; notes?: string }) => request<ProductionOrder>(`/production/orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  approveProductionOrder: (id: string) => request<ProductionOrder>(`/production/orders/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  reserveProductionOrderMaterials: (id: string, payload: { warehouseCode?: string } = {}) => request<ProductionOrder>(`/production/orders/${encodeURIComponent(id)}/reserve`, { method: 'POST', body: JSON.stringify(payload) }),
  recordProductionExecution: (id: string, payload: { actualOutput?: number; actualWaste?: number; actualWasteReason?: string; reusableWaste?: boolean; reusableWasteSku?: string; reusableWasteQuantity?: number; reusableWasteUnit?: string; productionTimeHours?: number; actualMaterials?: Array<{ sku: string; quantity: number; unit?: string; unitCost?: number }>; labor?: Array<{ name: string; hours: number; overtimeHours?: number; rate?: number }>; machines?: Array<{ name: string; hours: number; quantity?: number; rate?: number }>; utilities?: Array<{ name: string; quantity: number; unit?: string; rate?: number }>; byProducts?: Array<{ sku: string; item: string; quantity: number; unit: string; notes?: string }> }) => request<ProductionOrder>(`/production/orders/${encodeURIComponent(id)}/execution`, {
    method: 'POST', body: JSON.stringify(payload),
  }),
  createProductionPurchaseRequest: (payload: { recipeId?: string; quantity?: number; scheduledDate?: string; productionOrderId?: string; requiredByDate?: string; notes?: string }) => request<PurchaseRequest>('/production/purchase-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateProductionPurchaseRequest: (id: string, payload: { status?: PurchaseRequest['status']; notes?: string }) => request<PurchaseRequest>(`/production/purchase-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  createManualProductionPurchaseRequest: (payload: { requiredByDate?: string; reason?: string; notes?: string; status?: 'DRAFT' | 'REQUESTED'; lines: Array<{ sku: string; item: string; quantity: number; unit: string; supplierId?: string; supplierName?: string; unitPrice?: number }> }) => request<PurchaseRequest>('/production/purchase-requests/manual', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  approveProductionPurchaseRequest: (id: string) => request<PurchaseRequest>(`/production/purchase-requests/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  rejectProductionPurchaseRequest: (id: string, reason?: string) => request<PurchaseRequest>(`/production/purchase-requests/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  convertProductionPurchaseRequest: (id: string, payload: { supplierId?: string; supplierName?: string; submitForApproval?: boolean } = {}) => request<PurchaseOrder[]>(`/production/purchase-requests/${encodeURIComponent(id)}/purchase-orders`, { method: 'POST', body: JSON.stringify(payload) }),
  createProductionPurchaseOrder: (payload: { supplierId?: string; supplierName: string; expectedDeliveryDate?: string; notes?: string; submitForApproval?: boolean; lines: Array<{ sku: string; item: string; quantity: number; unit: string; unitPrice: number; taxRate?: number }> }) => request<PurchaseOrder>('/production/purchase-orders', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  approveProductionPurchaseOrder: (id: string) => request<PurchaseOrder>(`/production/purchase-orders/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  receiveProductionPurchaseOrder: (id: string, payload: { date?: string; receipts: Array<{ sku: string; acceptedQuantity: number; damagedQuantity?: number; rejectedQuantity?: number; unit?: string; unitPrice?: number; warehouseCode?: string; batchNumber?: string; expiryDate?: string }> }) => request<PurchaseOrder>(`/production/purchase-orders/${encodeURIComponent(id)}/receive`, {
    method: 'POST', body: JSON.stringify(payload),
  }),
  recordProductionQuality: (id: string, payload: { result: ProductionQualityInspection['result']; actualOutput?: number; actualWaste?: number; actualWasteReason?: string; notes?: string; inspectedBy?: string; date?: string }) => request<ProductionOrder>(`/production/orders/${encodeURIComponent(id)}/quality`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  productionWasteRecords: () => request<ProductionWasteRecord[]>('/production/waste'),
  approveProductionWasteRecord: (id: string, payload: { inventorySku?: string; inventoryQuantity?: number; inventoryUnit?: string } = {}) => request<ProductionWasteRecord>(`/production/waste/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify(payload) }),
  updateProductionConfiguration: (payload: ProductionConfiguration) => request<ProductionConfiguration>('/production/configuration', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  searchInventory: (query: string) => request<ListResponse<InventoryRow>>(`/search/inventory?q=${encodeURIComponent(query)}`),
  searchAll: (query: string) => request<GlobalSearchResponse>(`/search?q=${encodeURIComponent(query)}`),
  purchases: (period?: FilterPeriod, from?: string, to?: string, page = 1, limit = 50) => request<ListResponse<PurchaseRow>>(`/purchases${periodQuery(period, from, to, page, limit)}`),
  sales: (period?: FilterPeriod, from?: string, to?: string, page = 1, limit = 50) => request<ListResponse<SaleRow>>(`/sales${periodQuery(period, from, to, page, limit)}`),
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
  createPosSale: (payload: CreatePosSalePayload) => request<SaleRow>('/sales', {
    method: 'POST',
    body: JSON.stringify(payload),
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
  listSaleReturns: (id: string) => request<SaleReturnRow[]>(`/sales/${encodeURIComponent(id)}/returns`),
  createSaleReturn: (id: string, payload: { reason: string; items: Array<{ sku: string; item: string; quantity: number }> }) =>
    request<SaleReturnRow>(`/sales/${encodeURIComponent(id)}/returns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveSaleReturn: (id: string) => request<SaleReturnRow>(`/sales/returns/${encodeURIComponent(id)}/approve`, {
    method: 'PATCH',
  }),
  rejectSaleReturn: (id: string) => request<SaleReturnRow>(`/sales/returns/${encodeURIComponent(id)}/reject`, {
    method: 'PATCH',
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
  openShowcases: () => request<OpenShowcase[]>('/stock-movements/showcases/open'),
  sendToShowcase: (payload: ShowcaseIssuePayload) => request<StockMovementRow>('/stock-movements/showcases', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  closeShowcase: (reference: string, payload: ShowcaseClosePayload) => request<unknown>(`/stock-movements/showcases/${encodeURIComponent(reference)}/close`, {
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
  partnerTransfers: (status = 'ALL', search = '') => request<PartnerTransferListResponse>(`/transfers?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`),
  adminOverview: () => request<AdminOverview>('/admin/overview'),
  adminUsers: () => request<AdminUser[]>('/admin/users'),
  createAdminBusiness: (payload: CreateAdminBusinessPayload) => request<AdminBusiness>('/admin/businesses', { method: 'POST', body: JSON.stringify(payload) }),
  createAdminUser: (payload: CreateAdminUserPayload) => request<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminUser: (id: string, payload: { username?: string; email?: string; password?: string; role?: 'admin' | 'staff'; ownerKey?: string; active?: boolean }) => request<AdminUser>(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  shopUsers: () => request<ShopUser[]>('/shop/users'),
  createShopUser: (payload: { username: string; email: string; password: string; shopRole: ShopRole; accountType: 'admin' | 'staff'; accessRoleCode: string }) => request<ShopUser>('/shop/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateShopUser: (id: string, payload: { username?: string; email?: string; password?: string; active?: boolean; shopRole?: ShopRole; accountType?: 'admin' | 'staff'; accessRoleCode?: string }) => request<ShopUser>(`/shop/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  receivePartnerTransfer: (payload: PartnerTransferPayload) => request<PartnerTransfer>('/transfers', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  sellPartnerTransfer: (id: string, payload: { quantity: number; customer: string; unitPrice: number; payment: string; paidAmount?: number; date?: string }) => request<unknown>(`/transfers/${encodeURIComponent(id)}/sell`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  returnPartnerTransfer: (id: string, payload: { quantity: number; date?: string; notes?: string }) => request<PartnerTransfer>(`/transfers/${encodeURIComponent(id)}/return`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
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
  requestPasswordReset: (email: string) => request<{ message: string; resetToken?: string; emailSent?: boolean; email?: string; resetUrl?: string }>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  resetPassword: (token: string, password: string) => request<{ message: string }>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  login: (email: string, password: string) => request<{ token: string; user: { id: string; username: string; email: string; role: string; shopRole?: ShopRole; ownerKey?: string; accessRoleCode?: string; branchCodes?: string[]; defaultBranchCode?: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  register: (username: string, email: string, password: string) => request<{ token: string; user: { id: string; username: string; email: string; role: string; shopRole?: ShopRole; ownerKey?: string; accessRoleCode?: string; branchCodes?: string[]; defaultBranchCode?: string } }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  }),
  me: (token: string) => request<{ id: string; username: string; email: string; role: string; shopRole?: ShopRole; ownerKey?: string; accessRoleCode?: string; branchCodes?: string[]; defaultBranchCode?: string; permissions: RolePermission[] }>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }),
  notifications: (unreadOnly = false) => request<NotificationsResponse>(`/notifications${unreadOnly ? '?unread=true' : ''}`),
  markNotificationRead: (id: string) => request<BackendNotification>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request<{ success: boolean }>(`/notifications/read-all`, { method: 'PATCH' }),
  recordPipelineActivity: (payload: {
    pipelineId: string
    stage: string
    stageLabel: string
    productName: string
    summary?: string
    details?: string
    metrics?: Record<string, any>
    severity?: 'critical' | 'warning' | 'info' | 'success'
  }) => request<{ success: boolean; notification: BackendNotification }>('/notifications/pipeline-activity', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  listPipelines: () => request<{ pipelines: any[] }>('/pipelines'),
  savePipelineToServer: (pipeline: any) => request<{ pipeline: any }>('/pipelines', {
    method: 'POST',
    body: JSON.stringify(pipeline),
  }),
  bulkSavePipelines: (pipelines: any[]) => request<{ pipelines: any[] }>('/pipelines/bulk', {
    method: 'POST',
    body: JSON.stringify({ pipelines }),
  }),
  deletePipelineFromServer: (id: string) => request<{ deleted: boolean; id: string }>(`/pipelines/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
}
