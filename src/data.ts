import type { Page } from './types'

export const metrics = [
  { label: 'Total Products', value: '12,842', delta: '+12%' },
  { label: 'Total Sales', value: '$842.2k', delta: '+8%' },
  { label: 'Total Purchases', value: '4,192', delta: 'No active' },
  { label: 'Available Stock', value: '94.4%', delta: '-6.7%' },
]

export const salesBars = [48, 70, 36, 92, 58, 100, 76, 42, 64, 20, 82, 54]
export const reportBars = [20, 34, 38, 31, 42, 71, 86]

export const lowStock = [
  { name: 'Neural-Link Processor V4', sku: 'NL-8890-X', status: '1 left', action: 'Quick Reorder' },
  { name: 'OLED Matrix Display 27"', sku: 'OM-DIS-27', status: '5 left', action: 'Quick Reorder' },
  { name: 'Graphene Battery Pack', sku: 'GB-990-CELL', status: 'Out of Stock', action: 'Urgent Restock' },
]

export const catalog = [
  { sku: 'Q-LP-990', name: 'Quantum Laptop Pro X', type: 'Laptops', price: '$2,499.00', visual: 'laptop' },
  { sku: 'MN-C49-ULTRA', name: 'Curved Vision 49"', type: 'Monitors', price: '$1,850.00', visual: 'monitor' },
  { sku: 'KB-MECH-Z', name: 'Titanium Matrix Deck', type: 'Peripherals', price: '$320.00', visual: 'keyboard' },
  { sku: 'GS-550-V2', name: 'Core Engine Console', type: 'Gaming', price: '$499.00', visual: 'console' },
]

export const inventoryRows = [
  { date: '2026-05-19', item: 'Samsung Neo QLED 8K', meta: 'High Resolution Series', sku: 'SAM-8K-900B', category: 'Visual Displays', stock: '12 / 25', price: '$4,299.00', status: 'Active' },
  { date: '2026-05-19', item: 'Sony Alpha A7 IV', meta: 'Full-frame Mirrorless', sku: 'SNY-A74-BODY', category: 'Imaging Gear', stock: '3 / 20', price: '$2,498.00', status: 'Low' },
  { date: '2026-05-04', item: 'Apple MacBook Pro 16"', meta: 'M3 Max 64GB RAM', sku: 'APL-MBP-M3MX', category: 'Computing', stock: '24 / 30', price: '$3,699.00', status: 'Active' },
  { date: '2026-04-18', item: 'Logitech MX Master 3S', meta: 'Performance Mouse', sku: 'LOG-MXM3S-GR', category: 'Peripherals', stock: '95 / 100', price: '$99.00', status: 'Active' },
  { date: '2026-01-12', item: 'DJI Mavic 3 Pro', meta: 'Professional Camera Drone', sku: 'DJI-M3P-FLY', category: 'Drones', stock: '6 / 20', price: '$2,199.00', status: 'Low' },
]

export const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'inventory', label: 'Inventory', icon: 'box' },
  { id: 'purchases', label: 'Purchases', icon: 'cart' },
  { id: 'sales', label: 'Sales', icon: 'tag' },
  { id: 'expenses', label: 'Expenses', icon: 'receipt' },
  { id: 'reports', label: 'Reports', icon: 'doc' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
]

export const cartItems = [
  { name: 'Neural Pad Pro X1', sn: 'NP-8829-QX-01', price: '$1,299.00', qty: '01', visual: 'console' },
  { name: 'Sonic Core ANC - Obsidian', sn: 'SC-1022-OB-44', price: '$349.00', qty: '02', visual: 'headset' },
  { name: 'Vector Mechanical Deck', sn: 'VM-3301-KB-02', price: '$189.00', qty: '01', visual: 'keyboard' },
]

export const purchaseRows = [
  { date: '2026-05-19', id: 'PO-9281-A', supplier: 'Zenith-Core Systems', phone: '+1 (555) 341-9012', item: 'ProBook Elite X1 Series', quantity: '14 Units', value: '$17,486.00', status: 'Receiving' },
  { date: '2026-05-11', id: 'PO-9278-C', supplier: 'Samsung Global', phone: '+1 (555) 884-1209', item: 'Neo QLED 8K Display', quantity: '10 Units', value: '$42,990.00', status: 'Confirmed' },
  { date: '2026-04-26', id: 'PO-9273-Q', supplier: 'Vector Input Labs', phone: '+1 (555) 229-0144', item: 'Mechanical Deck Batch', quantity: '60 Units', value: '$11,340.00', status: 'Pending' },
  { date: '2026-02-09', id: 'PO-9269-B', supplier: 'Sonic Core Audio', phone: '+1 (555) 671-8931', item: 'ANC Obsidian Headsets', quantity: '32 Units', value: '$11,168.00', status: 'Delayed' },
]

export const saleRows = [
  { date: '2026-05-19', id: 'SO-90210-A', customer: 'Alexander Sterling', phone: '+1 (555) 892-4410', item: 'Neural Pad Pro X1', items: '4 Units', value: '$2,371.81', payment: 'Credit', status: 'Active Cart' },
  { date: '2026-05-08', id: 'SO-90204-C', customer: 'Northstar Retail', phone: '+1 (555) 408-7712', item: 'Neo QLED 8K Display', items: '18 Units', value: '$18,290.00', payment: 'Wire', status: 'Processing' },
  { date: '2026-04-03', id: 'SO-90198-L', customer: 'Helio Systems', phone: '+1 (555) 732-1830', item: 'DJI Mavic 3 Pro', items: '6 Units', value: '$7,840.00', payment: 'Credit', status: 'Completed' },
  { date: '2026-03-20', id: 'SO-90182-M', customer: 'Vertex Labs', phone: '+1 (555) 510-9928', item: 'Sony Alpha A7 IV', items: '2 Units', value: '$4,998.00', payment: 'Crypto', status: 'Draft' },
]
