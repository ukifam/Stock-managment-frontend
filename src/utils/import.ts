export type CsvRow = Record<string, string>

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

export function parseCsv(text: string): CsvRow[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []

  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row: CsvRow = {}
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim()
    })
    return row
  })
}

export async function parseCsvFile(file: File): Promise<CsvRow[]> {
  const raw = await file.text()
  return parseCsv(raw)
}

export async function parseJsonFile<T = CsvRow[]>(file: File): Promise<T> {
  const raw = await file.text()
  return JSON.parse(raw) as T
}

export function normalizeCsvRow(row: CsvRow) {
  const normalized: Record<string, string> = {}
  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
    normalized[normalizedKey] = value.trim()
  })
  return normalized
}
