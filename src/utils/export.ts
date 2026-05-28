import type { FilterPeriod } from '../types'

type DatedRow = {
  date: string
}

export const periodLabels: Record<FilterPeriod, string> = {
  daily: 'Daily',
  weekly: 'Last 7 Days',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

export function filterByPeriod<T extends DatedRow>(rows: T[], period: FilterPeriod) {
  return rows.filter((row) => isInPeriod(new Date(`${row.date}T12:00:00`), period))
}

export function exportRows(filename: string, rows: Record<string, string>[]) {
  const headers = Object.keys(rows[0] ?? {})
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function isInPeriod(date: Date, period: FilterPeriod) {
  const now = new Date()

  if (period === 'daily') {
    return sameDay(date, now)
  }

  if (period === 'monthly') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }

  if (period === 'weekly') {
    return daysBetween(date, now) >= 0 && daysBetween(date, now) < 7
  }

  if (period === 'quarterly') {
    return date.getFullYear() === now.getFullYear() && quarter(date) === quarter(now)
  }

  return date.getFullYear() === now.getFullYear()
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
}

function quarter(date: Date) {
  return Math.floor(date.getMonth() / 3)
}

function daysBetween(left: Date, right: Date) {
  const start = new Date(left.getFullYear(), left.getMonth(), left.getDate())
  const end = new Date(right.getFullYear(), right.getMonth(), right.getDate())
  return Math.floor((end.getTime() - start.getTime()) / 86400000)
}

function csvCell(value = '') {
  return `"${value.replaceAll('"', '""')}"`
}
