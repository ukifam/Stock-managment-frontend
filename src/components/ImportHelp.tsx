type ImportHelpProps = {
  kind: 'inventory' | 'purchases' | 'sales'
}

const importGuides = {
  inventory: {
    title: 'Import inventory (CSV or JSON)',
    required: 'item, category',
    columns: ['item', 'category', 'sku', 'stock', 'capacity', 'price', 'supplier', 'date', 'status'],
    example: 'item,category,sku,stock,price\nLaptop,Computing,SKU-001,10,850000',
  },
  purchases: {
    title: 'Import purchases (CSV or JSON)',
    required: 'item',
    columns: ['item', 'supplier', 'quantity', 'unitPrice', 'id', 'phone', 'sku', 'category', 'payment', 'date', 'status'],
    example: 'item,supplier,quantity,unitPrice,id\nLaptop,ABC Supplies,5,800000,PO-1001',
  },
  sales: {
    title: 'Import sales (CSV or JSON)',
    required: 'item, customer',
    columns: ['item', 'customer', 'quantity', 'total', 'id', 'phone', 'sku', 'payment', 'date', 'status'],
    example: 'item,customer,quantity,total,id\nLaptop,John Doe,1,950000,SO-2001',
  },
}

export function ImportHelp({ kind }: ImportHelpProps) {
  const guide = importGuides[kind]

  return (
    <details className="import-help">
      <summary>{guide.title}</summary>
      <div className="import-help-body">
        <p>
          Click <strong>Import</strong>, choose a <strong>.csv</strong> or <strong>.json</strong> file. Column names are flexible (e.g.{' '}
          <code>unitPrice</code>, <code>unit price</code>, <code>Unit Price</code> all work).
        </p>
        <p>
          <strong>Required:</strong> {guide.required}
        </p>
        <p>
          <strong>Supported columns:</strong> {guide.columns.join(', ')}
        </p>
        <pre>{guide.example}</pre>
      </div>
    </details>
  )
}
