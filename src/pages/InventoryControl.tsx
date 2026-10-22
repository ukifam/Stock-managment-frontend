import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  api,
  type CustomerRecord,
  type ItemMaster,
  type MasterDataResponse,
  type StockOperationPayload,
  type SupplierRecord,
  type UnitDefinition,
  type WarehouseRecord,
} from '../api'
import { Topbar } from '../components/Topbar'
import { useAuth } from '../context/AuthContext'
import type { PageRenderProps, ThemePageProps } from '../types'

type Tab = 'items' | 'units' | 'partners' | 'warehouses'

const EMPTY_ITEM = {
  item: '', sku: '', description: '', category: 'Materials', itemType: 'raw_material' as ItemMaster['itemType'], baseUnit: 'piece', measurementAmount: '1',
  minimumStock: '0', maximumStock: '0', reorderLevel: '0', purchasePrice: '0', sellingPrice: '0', defaultSupplierId: '', defaultWarehouseCode: '',
  supplierIds: [] as string[], supplierPackSize: '1',
  batchTracking: false, expiryTracking: false, serialTracking: false,
}

const EMPTY_UNIT: Omit<UnitDefinition, '_id'> = { name: '', code: '', symbol: '', category: 'count', allowDecimals: true, active: true }
const EMPTY_SUPPLIER = { name: '', contactName: '', phone: '', email: '', address: '', paymentTerms: 'Cash', notes: '' }
const EMPTY_CUSTOMER = { name: '', phone: '', email: '', address: '', paymentStatus: 'Current', creditLimit: '0', paymentTerms: 'Cash', notes: '' }
const EMPTY_WAREHOUSE: Omit<WarehouseRecord, '_id'> = { name: '', code: '', type: 'general', address: '', active: true }

export function InventoryControl({ theme, toggleTheme, setPage }: ThemePageProps & Pick<PageRenderProps, 'setPage'>) {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('items')
  const [data, setData] = useState<MasterDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [item, setItem] = useState(EMPTY_ITEM)
  const [unit, setUnit] = useState(EMPTY_UNIT)
  const [conversion, setConversion] = useState({ productSku: '', fromUnit: '', toUnit: '', factor: '1', description: '' })
  const [partnerKind, setPartnerKind] = useState<'supplier' | 'customer'>('supplier')
  const [supplier, setSupplier] = useState(EMPTY_SUPPLIER)
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER)
  const [warehouse, setWarehouse] = useState(EMPTY_WAREHOUSE)
  const [operation, setOperation] = useState<StockOperationPayload>({ operation: 'RECEIPT', sku: '', quantity: 1, unit: 'piece', warehouseCode: '', reason: '' })

  const canCreate = String(user?.role) === 'admin' || Boolean(user?.permissions?.find((permission) => ['inventory', 'purchases', 'sales'].includes(permission.module))?.actions.includes('create'))

  const load = async () => {
    setLoading(true)
    try {
      setData(await api.masterData())
      setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load inventory setup data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const units = data?.units ?? []
  const items = data?.items ?? []
  const warehouses = data?.warehouses ?? []
  const selectedItem = items.find((row) => row.sku === operation.sku)
  const stockRows = useMemo(() => (data?.stock ?? []).filter((row) => !operation.warehouseCode || row.warehouseCode === operation.warehouseCode), [data?.stock, operation.warehouseCode])

  const save = async (work: () => Promise<unknown>, success: string) => {
    setSaving(true)
    setNotice('')
    try {
      await work()
      setNotice(success)
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save the changes.')
    } finally {
      setSaving(false)
    }
  }

  const submitItem = (event: FormEvent) => {
    event.preventDefault()
    void save(async () => {
      await api.createMasterItem({
        ...item,
        minimumStock: Number(item.minimumStock),
        maximumStock: Number(item.maximumStock),
        reorderLevel: Number(item.reorderLevel),
        purchasePrice: Number(item.purchasePrice),
        sellingPrice: Number(item.sellingPrice),
        measurementAmount: Number(item.measurementAmount),
        supplierOptions: item.supplierIds.map((supplierId) => ({
          supplierId,
          supplierName: data?.suppliers.find((row) => row._id === supplierId)?.name || '',
          price: Number(item.purchasePrice),
          purchaseUnit: item.baseUnit,
          packSize: Number(item.supplierPackSize || 1),
        })),
      })
      setItem(EMPTY_ITEM)
    }, 'Item created and ready for transactions.')
  }

  const submitUnit = (event: FormEvent) => {
    event.preventDefault()
    void save(async () => {
      await api.createUnit({ ...unit, code: unit.code || unit.name.toLowerCase().replace(/\s+/g, '_') })
      setUnit(EMPTY_UNIT)
    }, 'Unit created.')
  }

  const submitConversion = (event: FormEvent) => {
    event.preventDefault()
    void save(async () => {
      await api.createUnitConversion({
        productSku: conversion.productSku,
        fromUnit: conversion.fromUnit,
        toUnit: conversion.toUnit,
        factor: Number(conversion.factor),
        description: conversion.description,
        active: true,
      })
      setConversion({ productSku: '', fromUnit: '', toUnit: '', factor: '1', description: '' })
    }, 'Conversion rule created.')
  }

  const submitPartner = (event: FormEvent) => {
    event.preventDefault()
    if (partnerKind === 'supplier') {
      void save(async () => {
        await api.createSupplier({ ...supplier, active: true })
        setSupplier(EMPTY_SUPPLIER)
      }, 'Supplier created.')
      return
    }
    void save(async () => {
      await api.createCustomer({ ...customer, creditLimit: Number(customer.creditLimit), active: true })
      setCustomer(EMPTY_CUSTOMER)
    }, 'Customer created.')
  }

  const submitWarehouse = (event: FormEvent) => {
    event.preventDefault()
    void save(async () => {
      await api.createWarehouse(warehouse)
      setWarehouse(EMPTY_WAREHOUSE)
    }, 'Warehouse created for the active branch.')
  }

  const submitOperation = (event: FormEvent) => {
    event.preventDefault()
    void save(async () => {
      await api.recordStockOperation(operation)
      setOperation((current) => ({ ...current, quantity: 1, reason: '', reference: '', partner: '', batchNumber: '', expiryDate: '' }))
    }, 'Stock operation recorded.')
  }

  return <>
    <Topbar title="Inventory Setup" placeholder="Search the active branch..." theme={theme} toggleTheme={toggleTheme} />
    <main className="inventory-control-page page-pad">
      <header className="inventory-control-heading">
        <div><h1>Inventory control</h1><p>Maintain item masters, measurement rules, partners, warehouse balances, and stock operations.</p></div>
        <div className="inventory-control-actions"><button type="button" className="secondary-action" onClick={() => setPage('inventory')}>Inventory list</button><button type="button" className="secondary-action" onClick={() => setPage('stock-movements')}>Movement history</button></div>
      </header>
      {notice && <div className={`organization-notice ${notice.includes('Could not') || notice.includes('required') || notice.includes('Choose') || notice.includes('Only ') ? 'error' : ''}`} role="status">{notice}</div>}
      <div className="inventory-control-tabs" role="tablist" aria-label="Inventory setup areas">
        {([['items', 'Items'], ['units', 'Units & conversions'], ['partners', 'Suppliers & customers'], ['warehouses', 'Warehouses & stock']] as Array<[Tab, string]>).map(([id, label]) => <button key={id} role="tab" type="button" className={tab === id ? 'active' : ''} aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === 'items' && <section className="inventory-control-layout">
        <div className="inventory-control-table"><div className="inventory-control-section-heading"><div><h2>Item catalog</h2><p>{items.length} active and historical item records.</p></div></div>
          <div className="table-frame"><table><thead><tr><th>Item</th><th>Type</th><th>Base unit</th><th>On hand</th><th>Reorder</th><th>Status</th></tr></thead><tbody>
            {items.map((row) => <tr key={row.sku}><td><strong>{row.item}</strong><span className="inventory-control-code">{row.sku}</span></td><td>{labelize(row.itemType)}</td><td>{row.baseUnit}</td><td>{row.stock}</td><td>{row.reorderLevel}</td><td><span className={`organization-status ${row.status === 'Active' ? 'active' : 'inactive'}`}>{row.status}</span></td></tr>)}
            {!loading && !items.length && <tr><td colSpan={6}>No items have been created yet.</td></tr>}
          </tbody></table></div>
        </div>
        {canCreate && <form className="inventory-control-form" onSubmit={submitItem}><h2>New item</h2><div className="inventory-control-form-grid">
          <label>Name<input required value={item.item} onChange={(event) => setItem({ ...item, item: event.target.value })} /></label>
          <label>Item code<input required value={item.sku} onChange={(event) => setItem({ ...item, sku: event.target.value.toUpperCase() })} /></label>
          <label>Category<input required value={item.category} onChange={(event) => setItem({ ...item, category: event.target.value })} /></label>
          <label>Type<select value={item.itemType} onChange={(event) => setItem({ ...item, itemType: event.target.value as ItemMaster['itemType'] })}>{itemTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}</select></label>
          <label>Measurement amount<input required type="number" min="0.00000001" step="any" value={item.measurementAmount} onChange={(event) => setItem({ ...item, measurementAmount: event.target.value })} placeholder="e.g. 2" /></label>
          <label>Measurement unit<select value={item.baseUnit} onChange={(event) => setItem({ ...item, baseUnit: event.target.value })}>{units.map((row) => <option key={row.code} value={row.code}>{row.name} ({row.symbol || row.code})</option>)}</select></label>
          <label>Default warehouse<select value={item.defaultWarehouseCode} onChange={(event) => setItem({ ...item, defaultWarehouseCode: event.target.value })}><option value="">Main storage</option>{warehouses.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>
          <label>Minimum stock<input type="number" min="0" step="any" value={item.minimumStock} onChange={(event) => setItem({ ...item, minimumStock: event.target.value })} /></label>
          <label>Maximum stock<input type="number" min="0" step="any" value={item.maximumStock} onChange={(event) => setItem({ ...item, maximumStock: event.target.value })} /></label>
          <label>Reorder level<input type="number" min="0" step="any" value={item.reorderLevel} onChange={(event) => setItem({ ...item, reorderLevel: event.target.value })} /></label>
          <label>Purchase price<input type="number" min="0" step="any" value={item.purchasePrice} onChange={(event) => setItem({ ...item, purchasePrice: event.target.value })} /></label>
          <label>Selling price<input type="number" min="0" step="any" value={item.sellingPrice} onChange={(event) => setItem({ ...item, sellingPrice: event.target.value })} /></label>
          <label>Default supplier<select value={item.defaultSupplierId} onChange={(event) => setItem({ ...item, defaultSupplierId: event.target.value })}><option value="">None</option>{data?.suppliers.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
          <label>Supplier package size<input type="number" min="0.0001" step="any" value={item.supplierPackSize} onChange={(event) => setItem({ ...item, supplierPackSize: event.target.value })} /></label>
          <label className="inventory-control-wide">Approved suppliers<select multiple value={item.supplierIds} onChange={(event) => setItem({ ...item, supplierIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{data?.suppliers.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
          <label className="inventory-control-wide">Description<input value={item.description} onChange={(event) => setItem({ ...item, description: event.target.value })} /></label>
          <label className="inventory-control-check"><input type="checkbox" checked={item.batchTracking} onChange={(event) => setItem({ ...item, batchTracking: event.target.checked })} />Batch tracking</label>
          <label className="inventory-control-check"><input type="checkbox" checked={item.expiryTracking} onChange={(event) => setItem({ ...item, expiryTracking: event.target.checked })} />Expiry tracking</label>
          <label className="inventory-control-check"><input type="checkbox" checked={item.serialTracking} onChange={(event) => setItem({ ...item, serialTracking: event.target.checked })} />Serial tracking</label>
        </div><button className="primary-action" disabled={saving} type="submit">Create item</button></form>}
      </section>}

      {tab === 'units' && <section className="inventory-control-layout inventory-control-layout-equal">
        <div><section className="inventory-control-panel"><div className="inventory-control-section-heading"><div><h2>Units</h2><p>Base measurement vocabulary for each business.</p></div></div><div className="inventory-chip-list">{units.map((row) => <span key={row.code} className="inventory-unit-chip"><strong>{row.symbol || row.code}</strong>{row.name}<small>{row.allowDecimals ? 'decimal' : 'whole'}</small></span>)}</div></section>
          {canCreate && <form className="inventory-control-form" onSubmit={submitUnit}><h2>Add unit</h2><div className="inventory-control-form-grid"><label>Name<input required value={unit.name} onChange={(event) => setUnit({ ...unit, name: event.target.value })} /></label><label>Code<input value={unit.code} onChange={(event) => setUnit({ ...unit, code: event.target.value.toLowerCase() })} /></label><label>Symbol<input value={unit.symbol} onChange={(event) => setUnit({ ...unit, symbol: event.target.value })} /></label><label>Category<input value={unit.category} onChange={(event) => setUnit({ ...unit, category: event.target.value })} /></label><label className="inventory-control-check"><input type="checkbox" checked={unit.allowDecimals} onChange={(event) => setUnit({ ...unit, allowDecimals: event.target.checked })} />Allow decimal quantities</label></div><button className="primary-action" disabled={saving} type="submit">Add unit</button></form>}
        </div>
        <div><section className="inventory-control-panel"><div className="inventory-control-section-heading"><div><h2>Conversion rules</h2><p>Product-specific rules override general rules.</p></div></div><div className="inventory-rule-list">{data?.conversions.map((row) => <div key={row._id}><strong>1 {row.fromUnit}</strong><span>= {row.factor} {row.toUnit}</span><small>{row.productSku ? `Item: ${row.productSku}` : 'General rule'}</small></div>)}{!loading && !data?.conversions.length && <p>No conversion rules yet.</p>}</div></section>
          {canCreate && <form className="inventory-control-form" onSubmit={submitConversion}><h2>New conversion</h2><div className="inventory-control-form-grid"><label>Item-specific SKU<select value={conversion.productSku} onChange={(event) => setConversion({ ...conversion, productSku: event.target.value })}><option value="">General rule</option>{items.map((row) => <option key={row.sku} value={row.sku}>{row.item} ({row.sku})</option>)}</select></label><label>From unit<select required value={conversion.fromUnit} onChange={(event) => setConversion({ ...conversion, fromUnit: event.target.value })}><option value="">Select</option>{units.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label><label>Factor<input required type="number" min="0.00000001" step="any" value={conversion.factor} onChange={(event) => setConversion({ ...conversion, factor: event.target.value })} /></label><label>To unit<select required value={conversion.toUnit} onChange={(event) => setConversion({ ...conversion, toUnit: event.target.value })}><option value="">Select</option>{units.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label><label className="inventory-control-wide">Description<input placeholder="Example: 1 kg = 80 spoons" value={conversion.description} onChange={(event) => setConversion({ ...conversion, description: event.target.value })} /></label></div><button className="primary-action" disabled={saving} type="submit">Add conversion</button></form>}
        </div>
      </section>}

      {tab === 'partners' && <section className="inventory-control-layout">
        <div className="inventory-control-table"><div className="inventory-control-section-heading"><div><h2>Suppliers</h2><p>Assigned suppliers can carry product prices and purchase units.</p></div></div><div className="table-frame"><table><thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th>Payment terms</th><th>Status</th></tr></thead><tbody>{data?.suppliers.map((row) => <SupplierRow key={row._id} row={row} />)}{!loading && !data?.suppliers.length && <tr><td colSpan={5}>No suppliers have been added.</td></tr>}</tbody></table></div>
          <div className="inventory-control-section-heading inventory-control-subheading"><div><h2>Customers</h2><p>Keep payment status, terms, and credit limits alongside the sale history.</p></div></div><div className="table-frame"><table><thead><tr><th>Customer</th><th>Phone</th><th>Payment status</th><th>Credit limit</th><th>Terms</th></tr></thead><tbody>{data?.customers.map((row) => <CustomerRow key={row._id} row={row} />)}{!loading && !data?.customers.length && <tr><td colSpan={5}>No customers have been added.</td></tr>}</tbody></table></div>
        </div>
        {canCreate && <form className="inventory-control-form" onSubmit={submitPartner}><div className="inventory-control-toggle"><button type="button" className={partnerKind === 'supplier' ? 'active' : ''} onClick={() => setPartnerKind('supplier')}>Supplier</button><button type="button" className={partnerKind === 'customer' ? 'active' : ''} onClick={() => setPartnerKind('customer')}>Customer</button></div>{partnerKind === 'supplier' ? <><h2>New supplier</h2><div className="inventory-control-form-grid"><label>Name<input required value={supplier.name} onChange={(event) => setSupplier({ ...supplier, name: event.target.value })} /></label><label>Contact person<input value={supplier.contactName} onChange={(event) => setSupplier({ ...supplier, contactName: event.target.value })} /></label><label>Phone<input value={supplier.phone} onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })} /></label><label>Email<input type="email" value={supplier.email} onChange={(event) => setSupplier({ ...supplier, email: event.target.value })} /></label><label>Payment terms<input value={supplier.paymentTerms} onChange={(event) => setSupplier({ ...supplier, paymentTerms: event.target.value })} /></label><label className="inventory-control-wide">Address<input value={supplier.address} onChange={(event) => setSupplier({ ...supplier, address: event.target.value })} /></label><label className="inventory-control-wide">Notes<input value={supplier.notes} onChange={(event) => setSupplier({ ...supplier, notes: event.target.value })} /></label></div></> : <><h2>New customer</h2><div className="inventory-control-form-grid"><label>Name<input required value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label><label>Phone<input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label><label>Email<input type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label><label>Payment status<input value={customer.paymentStatus} onChange={(event) => setCustomer({ ...customer, paymentStatus: event.target.value })} /></label><label>Credit limit<input type="number" min="0" step="any" value={customer.creditLimit} onChange={(event) => setCustomer({ ...customer, creditLimit: event.target.value })} /></label><label>Payment terms<input value={customer.paymentTerms} onChange={(event) => setCustomer({ ...customer, paymentTerms: event.target.value })} /></label><label className="inventory-control-wide">Address<input value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} /></label><label className="inventory-control-wide">Notes<input value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} /></label></div></>}<button className="primary-action" disabled={saving} type="submit">Create {partnerKind}</button></form>}
      </section>}

      {tab === 'warehouses' && <section className="inventory-control-layout">
        <div className="inventory-control-table"><div className="inventory-control-section-heading"><div><h2>Warehouse balances</h2><p>On-hand, reserved, available, incoming, and quarantined quantities per location.</p></div></div><div className="table-frame"><table><thead><tr><th>Warehouse</th><th>Item</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Incoming</th><th>Quarantined</th></tr></thead><tbody>{stockRows.map((row) => <tr key={`${row.warehouseCode}-${row.sku}`}><td><strong>{row.warehouseName}</strong><span className="inventory-control-code">{row.warehouseCode}</span></td><td>{row.item}<span className="inventory-control-code">{row.baseUnit}</span></td><td>{row.onHand}</td><td>{row.reserved}</td><td>{row.available}</td><td>{row.incoming}</td><td>{row.quarantined}</td></tr>)}{!loading && !stockRows.length && <tr><td colSpan={7}>No warehouse balances yet.</td></tr>}</tbody></table></div>
          <div className="inventory-control-section-heading inventory-control-subheading"><div><h2>Warehouses</h2><p>{warehouses.map((row) => `${row.name} (${labelize(row.type)})`).join(' · ') || 'No warehouses yet.'}</p></div></div>
          <div className="inventory-control-section-heading inventory-control-subheading"><div><h2>Expiry watch</h2><p>{data?.expiryAlerts.length ? `${data.expiryAlerts.length} batch records are expired or due within 30 days.` : 'No batches are due within 30 days.'}</p></div></div>
          {(data?.expiryAlerts.length ?? 0) > 0 && <div className="inventory-rule-list">{data?.expiryAlerts.map((alert) => <div key={`${alert.sku}-${alert.batchNumber}-${alert.expiryDate}`}><strong>{alert.item}</strong><span>{alert.expiryDate} · {alert.quantity}</span><small>{alert.status}{alert.batchNumber ? ` · ${alert.batchNumber}` : ''}</small></div>)}</div>}
        </div>
        {canCreate && <div className="inventory-control-side-stack"><form className="inventory-control-form" onSubmit={submitWarehouse}><h2>New warehouse</h2><div className="inventory-control-form-grid"><label>Name<input required value={warehouse.name} onChange={(event) => setWarehouse({ ...warehouse, name: event.target.value })} /></label><label>Code<input required value={warehouse.code} onChange={(event) => setWarehouse({ ...warehouse, code: event.target.value.toUpperCase() })} /></label><label>Type<select value={warehouse.type} onChange={(event) => setWarehouse({ ...warehouse, type: event.target.value as WarehouseRecord['type'] })}>{warehouseTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}</select></label><label>Address<input value={warehouse.address} onChange={(event) => setWarehouse({ ...warehouse, address: event.target.value })} /></label></div><button className="primary-action" disabled={saving} type="submit">Create warehouse</button></form>
          <form className="inventory-control-form" onSubmit={submitOperation}><h2>Record stock operation</h2><div className="inventory-control-form-grid"><label>Operation<select value={operation.operation} onChange={(event) => setOperation({ ...operation, operation: event.target.value as StockOperationPayload['operation'] })}>{operations.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}</select></label><label>Item<select required value={operation.sku} onChange={(event) => { const next = items.find((row) => row.sku === event.target.value); setOperation({ ...operation, sku: event.target.value, unit: next?.baseUnit || 'piece', warehouseCode: next?.defaultWarehouseCode || operation.warehouseCode }) }}><option value="">Select item</option>{items.map((row) => <option key={row.sku} value={row.sku}>{row.item} ({row.sku})</option>)}</select></label><label>Quantity<input required type="number" min="0.00000001" step="any" value={operation.quantity} onChange={(event) => setOperation({ ...operation, quantity: Number(event.target.value) })} /></label><label>Unit<select value={operation.unit} onChange={(event) => setOperation({ ...operation, unit: event.target.value })}>{units.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>{operation.operation === 'TRANSFER' ? <><label>From warehouse<select required value={operation.fromWarehouseCode || ''} onChange={(event) => setOperation({ ...operation, fromWarehouseCode: event.target.value })}><option value="">Select</option>{warehouses.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label><label>To warehouse<select required value={operation.toWarehouseCode || ''} onChange={(event) => setOperation({ ...operation, toWarehouseCode: event.target.value })}><option value="">Select</option>{warehouses.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label></> : <label>Warehouse<select value={operation.warehouseCode || ''} onChange={(event) => setOperation({ ...operation, warehouseCode: event.target.value })}><option value="">Main storage</option>{warehouses.map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>}<label>Reference<input value={operation.reference || ''} onChange={(event) => setOperation({ ...operation, reference: event.target.value })} /></label><label>Batch number<input value={operation.batchNumber || ''} onChange={(event) => setOperation({ ...operation, batchNumber: event.target.value })} /></label><label>Expiry date<input type="date" value={operation.expiryDate || ''} onChange={(event) => setOperation({ ...operation, expiryDate: event.target.value })} /></label><label>Serial number<input value={operation.serialNumber || ''} onChange={(event) => setOperation({ ...operation, serialNumber: event.target.value })} /></label><label className="inventory-control-wide">Reason<input value={operation.reason || ''} onChange={(event) => setOperation({ ...operation, reason: event.target.value })} placeholder={selectedItem ? `${selectedItem.item} in ${selectedItem.baseUnit}` : 'Required operational note'} /></label></div><button className="primary-action" disabled={saving} type="submit">Post operation</button></form></div>}
      </section>}
    </main>
  </>
}

function SupplierRow({ row }: { row: SupplierRecord }) {
  return <tr><td><strong>{row.name}</strong></td><td>{row.contactName || '-'}</td><td>{row.phone || '-'}</td><td>{row.paymentTerms || '-'}</td><td><span className={`organization-status ${row.active ? 'active' : 'inactive'}`}>{row.active ? 'Active' : 'Inactive'}</span></td></tr>
}

function CustomerRow({ row }: { row: CustomerRecord }) {
  return <tr><td><strong>{row.name}</strong></td><td>{row.phone || '-'}</td><td>{row.paymentStatus || 'Current'}</td><td>{Number(row.creditLimit || 0)}</td><td>{row.paymentTerms || '-'}</td></tr>
}

function labelize(value: string) {
  return String(value || '').replace(/_/g, ' ')
}

const itemTypes: ItemMaster['itemType'][] = ['raw_material', 'packaging_material', 'consumable', 'finished_product', 'semi_finished_product', 'by_product']
const warehouseTypes: WarehouseRecord['type'][] = ['raw_material', 'packaging', 'finished_goods', 'quarantine', 'waste', 'general']
const operations: StockOperationPayload['operation'][] = ['RECEIPT', 'CUSTOMER_RETURN', 'ISSUE', 'TRANSFER', 'COUNT', 'QUARANTINE', 'RELEASE_QUARANTINE', 'RESERVE', 'RELEASE_RESERVATION', 'MARK_INCOMING', 'PRODUCTION_CONSUMPTION', 'SALE', 'DAMAGE', 'EXPIRY', 'WASTE']
