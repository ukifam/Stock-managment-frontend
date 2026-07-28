export function formatMoney(value: number, currency = 'RWF') {
  const amount = Number(value || 0)
  const digits = currency === 'RWF' ? 0 : 2
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(amount)

  if (currency === 'RWF') {
    return `RWF ${formatted}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(amount)
}
