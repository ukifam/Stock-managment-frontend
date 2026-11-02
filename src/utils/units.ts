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
