type ImportHelpProps = {
  kind: 'inventory' | 'purchases' | 'sales'
}

const importGuides = {
  inventory: {
    required: 'item, category',
    columns: ['item', 'category', 'sku', 'stock', 'capacity', 'price', 'supplier', 'date', 'status'],
    example: 'item,category,sku,stock,price\nRice 25kg,Grains,SKU-001,10,32000',
  },
  purchases: {
    required: 'item',
    columns: ['item', 'supplier', 'quantity', 'unitPrice', 'id', 'phone', 'sku', 'category', 'payment', 'date', 'status'],
    example: 'item,supplier,quantity,unitPrice,id\nFlour 50kg,ABC Supplies,5,42000,PO-1001',
  },
  sales: {
    required: 'item, customer',
    columns: ['item', 'customer', 'quantity', 'total', 'id', 'phone', 'sku', 'payment', 'date', 'status'],
    example: 'item,customer,quantity,total,id\nBread,Walk-in,3,4500,SO-2001',
  },
}

export function ImportHelp({ kind }: ImportHelpProps) {
  const guide = importGuides[kind]

  return (
    <details className="import-help">
      <summary aria-label="Import file format" title="Import file format">?</summary>
      <div className="import-help-body">
        <p><strong>CSV or JSON.</strong> Required: {guide.required}</p>
        <p>Columns: {guide.columns.join(', ')}</p>
        <pre>{guide.example}</pre>
      </div>
    </details>
  )
}
