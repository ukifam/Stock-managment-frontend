import { api, type InventoryRow, type ManualEntryPayload } from '../api'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createWorker } from 'tesseract.js'
import type { EntryMode, EntryType } from '../types'
import { CameraScanner } from './CameraScanner'

type EntryFlowModalProps = {
  initialType?: EntryType
  currency?: string
  onClose: () => void
  onSubmit: (type: EntryType, mode: EntryMode, payload?: ManualEntryPayload) => void | Promise<void>
}

type ScanDetails = ManualEntryPayload

type DetectedBarcode = {
  rawValue: string
}

type BarcodeDetectorInstance = {
  detect: (source: ImageBitmap | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => Promise<DetectedBarcode[]>
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance

const emptyScanDetails: ScanDetails = {
  item: '',
  contactName: '',
  phone: '',
  reference: '',
  category: '',
  quantity: '1',
  unitPrice: '0',
  total: '0',
  sku: '',
  extractedText: '',
}

const barcodeFormats = ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e']

export function EntryFlowModal({ initialType, currency = 'RWF', onClose, onSubmit }: EntryFlowModalProps) {
  const [mode, setMode] = useState<EntryMode | null>(null)
  const title = initialType ? `New ${entryTypeLabel(initialType)}` : 'New Entry'

  if (!mode) {
    return (
      <div className="modal-backdrop" role="presentation">
        <section className="entry-modal method-modal" aria-labelledby="entry-method-title">
          <div className="detail-head">
            <div>
              <h2 id="entry-method-title">{title}</h2>
              <p>Choose how you want to add the item first.</p>
            </div>
            <button type="button" aria-label="Close new entry modal" onClick={onClose}>x</button>
          </div>

          <div className="method-grid">
            <button type="button" className="method-card" onClick={() => setMode('scan')}>
              <span>Scan Item</span>
              <small>Use barcode, serial, or photo scan before completing the transaction.</small>
            </button>
            <button type="button" className="method-card" onClick={() => setMode('manual')}>
              <span>Add Manually</span>
              <small>Enter item, customer or supplier, phone number, and quantity by hand.</small>
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (mode === 'scan') {
    return <ScanEntryModal initialType={initialType} currency={currency} onBack={() => setMode(null)} onClose={onClose} onSubmit={onSubmit} />
  }

  return <ManualEntryModal initialType={initialType} currency={currency} mode={mode} onBack={() => setMode(null)} onClose={onClose} onSubmit={onSubmit} />
}

function ScanEntryModal({ initialType, currency = 'RWF', onBack, onClose, onSubmit }: EntryFlowModalProps & { onBack: () => void }) {
  const [type, setType] = useState<EntryType>(initialType ?? 'purchase')
  const [details, setDetails] = useState<ScanDetails>(emptyScanDetails)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isReadingImage, setIsReadingImage] = useState(false)
  const [extractedText, setExtractedText] = useState('')
  const [scanPreviewUrl, setScanPreviewUrl] = useState('')
  const scanImageInputRef = useRef<HTMLInputElement>(null)
  const uploadImageInputRef = useRef<HTMLInputElement>(null)
  const scanPreviewUrlRef = useRef('')

  useEffect(() => {
    return () => {
      if (scanPreviewUrlRef.current) {
        URL.revokeObjectURL(scanPreviewUrlRef.current)
      }
    }
  }, [])

  const handleScan = async (barcode: string) => {
    setError('')
    setNotice('')
    
    try {
      const response = await api.searchInventory(barcode)
      if (response.rows.length === 0) {
        const scannedDetails = parseEntryDetailsFromScanValue(barcode, type)
        setDetails((current) => ({
          ...current,
          ...dropEmptyValues(scannedDetails),
          sku: scannedDetails.sku || barcode,
        }))
        setNotice(scannedDetails.item ? 'Item name was read from the scan. Review the details below, then save.' : 'Code captured. Complete the item details below before saving.')
        return
      }
      
      const foundItem = response.rows[0]
      setDetails((current) => ({
        ...current,
        item: foundItem.item,
        category: foundItem.category,
        quantity: current.quantity || '1',
        unitPrice: String(foundItem.rawPrice),
        total: String((Number(current.quantity) || 1) * foundItem.rawPrice),
        sku: foundItem.sku || barcode,
      }))
      setNotice('Item found. Review the details below, then save.')
    } catch {
      setError('Failed to scan item. Please try again.')
    }
  }

  const handleImageFile = async (file: File) => {
    if (!file) return

    setError('')
    setNotice('')
    setIsReadingImage(true)
    if (scanPreviewUrlRef.current) {
      URL.revokeObjectURL(scanPreviewUrlRef.current)
    }
    const nextPreviewUrl = URL.createObjectURL(file)
    scanPreviewUrlRef.current = nextPreviewUrl
    setScanPreviewUrl(nextPreviewUrl)

    try {
      const detector = getBarcodeDetector()
      if (detector) {
        const image = await createImageBitmap(file)
        const results = await detector.detect(image)
        const code = results[0]?.rawValue?.trim()
        image.close()

        if (code) {
          await handleScan(code)
        }
      }

      const text = await extractTextFromImage(file)
      const parsedDetails = parseEntryDetailsFromText(text, type)
      setExtractedText(text)

      if (Object.values(parsedDetails).some(Boolean)) {
        setDetails((current) => ({
          ...current,
          ...dropEmptyValues(parsedDetails),
          extractedText: text,
          total: String(
            (Number(parsedDetails.quantity || current.quantity) || 0)
            * (Number(parsedDetails.unitPrice || current.unitPrice) || 0)
          ),
        }))
        setNotice(parsedDetails.item ? 'Item name was read from the image. Review the details below, then save.' : 'Image text was read. Review the filled details below, then save.')
      } else if (text.trim()) {
        setDetails((current) => ({ ...current, extractedText: text }))
        setNotice('Image text was read, but no clear labels were found. Copy from the extracted text into the fields below.')
      } else {
        setNotice('No readable text was found. Try a clearer image or complete the details manually.')
      }
    } catch {
      setError('Could not read that image. Try another image or enter the details manually.')
    } finally {
      setIsReadingImage(false)
    }
  }

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await handleImageFile(file)
  }

  const updateDetails = (field: keyof ScanDetails, value: string) => {
    setDetails((current) => {
      const next = { ...current, [field]: value }
      if (field === 'quantity' || field === 'unitPrice') {
        next.total = String((Number(next.quantity) || 0) * (Number(next.unitPrice) || 0))
      }
      return next
    })
  }

  const hasRequiredContact = type === 'purchase' || details.contactName.trim()
  const canSave = details.item.trim() && hasRequiredContact && details.reference.trim() && Number(details.quantity) > 0

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="entry-modal scan-entry-modal" onSubmit={async (event) => {
        event.preventDefault()
        if (!canSave) {
          setError(type === 'purchase' ? 'Complete item, reference, and quantity before saving.' : 'Complete item, customer, reference, and quantity before saving.')
          return
        }
        await onSubmit(type, 'scan', details)
      }}>
        <div className="detail-head">
          <div>
            <h2>Scan Items</h2>
            <p>{type === 'purchase' ? 'Scan supplier items' : 'Scan items to sell'}</p>
          </div>
          <button type="button" aria-label="Close scan entry modal" onClick={onClose}>x</button>
        </div>

        {!initialType && (
          <label>Transaction Type
            <select value={type} onChange={(event) => setType(event.target.value as EntryType)}>
              <option value="purchase">Purchase</option>
              <option value="sale">Sale</option>
            </select>
          </label>
        )}

        <CameraScanner onScan={handleScan} onCapture={handleImageFile} previewImageUrl={scanPreviewUrl} isActive />

        <div className="scan-image-actions">
          <button type="button" disabled={isReadingImage} onClick={() => scanImageInputRef.current?.click()}>{isReadingImage ? 'Reading Image...' : 'Scan Image'}</button>
          <button type="button" disabled={isReadingImage} onClick={() => uploadImageInputRef.current?.click()}>{isReadingImage ? 'Reading Image...' : 'Upload Image'}</button>
          <input ref={scanImageInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleImageChange} />
          <input ref={uploadImageInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
        </div>

        {error && <div style={{ color: '#d32f2f', padding: '8px', marginTop: '12px', marginBottom: '8px', backgroundColor: '#ffebee', borderRadius: '4px', fontSize: '14px' }}>{error}</div>}
        {notice && <div style={{ color: '#1565c0', padding: '8px', marginTop: '12px', marginBottom: '8px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '14px' }}>{notice}</div>}
        {extractedText && (
          <details className="extracted-text">
            <summary>Extracted image text</summary>
            <pre>{extractedText}</pre>
          </details>
        )}

        <div className="field-grid">
          <label>Item Name
            <input required value={details.item} onChange={(event) => updateDetails('item', event.target.value)} placeholder="Scanned item name..." />
          </label>
          <label>{type === 'purchase' ? 'Supplier' : 'Customer'}
            <input required={type === 'sale'} value={details.contactName} onChange={(event) => updateDetails('contactName', event.target.value)} placeholder={type === 'purchase' ? 'Supplier name...' : 'Customer name...'} />
          </label>
          <label>Phone Number
            <input value={details.phone} onChange={(event) => updateDetails('phone', event.target.value)} placeholder="+1 (555) 000-0000" />
          </label>
          <label>{type === 'purchase' ? 'Purchase Reference' : 'Sale Reference'}
            <input required value={details.reference} onChange={(event) => updateDetails('reference', event.target.value)} placeholder={type === 'purchase' ? 'PO-9281-A' : 'SO-90210-A'} />
          </label>
          <label>Item Category
            <input value={details.category} onChange={(event) => updateDetails('category', event.target.value)} placeholder="Category..." />
          </label>
          <label>Quantity
            <input required type="number" min="1" value={details.quantity} onChange={(event) => updateDetails('quantity', event.target.value)} />
          </label>
          <label>Unit Price
            <input type="number" min="0" step="0.01" value={details.unitPrice} onChange={(event) => updateDetails('unitPrice', event.target.value)} />
          </label>
          <label>Total
            <input value={formatMoney(Number(details.total) || 0, currency)} readOnly />
          </label>
        </div>

        <label>Item Search or SKU
          <input value={details.sku} onChange={(event) => updateDetails('sku', event.target.value)} placeholder="Barcode, QR value, or SKU..." />
        </label>

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" onClick={onBack}>Back</button>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary-action" type="submit" disabled={!canSave}>Save Details</button>
        </div>
      </form>
    </div>
  )
}

function ManualEntryModal({ initialType, currency = 'RWF', mode, onBack, onClose, onSubmit }: EntryFlowModalProps & { mode: EntryMode; onBack: () => void }) {
  const [type, setType] = useState<EntryType>(initialType ?? 'purchase')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [selectedInventoryKey, setSelectedInventoryKey] = useState('')
  const isPurchase = type === 'purchase'
  const inStockItems = inventory.filter((item) => item.rawStock > 0)
  const selectedInventory = inStockItems.find((item) => inventoryKey(item) === selectedInventoryKey)
  const total = quantity * unitPrice

  useEffect(() => {
    api.inventory('yearly').then((response) => {
      const availableItems = response.rows.filter((item) => item.rawStock > 0)
      setInventory(response.rows)
      setSelectedInventoryKey((current) => current || (availableItems[0] ? inventoryKey(availableItems[0]) : ''))
    }).catch(() => setInventory([]))
  }, [])

  useEffect(() => {
    if (type === 'sale' && selectedInventory) {
      setUnitPrice(selectedInventory.rawPrice)
      setQuantity((current) => Math.min(Math.max(current, 1), selectedInventory.rawStock))
    }
  }, [type, selectedInventory])

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="entry-modal" onSubmit={async (event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const saleItem = type === 'sale' ? selectedInventory : undefined

        if (type === 'sale') {
          if (!saleItem) {
            window.alert('No in-stock item is available for sale.')
            return
          }

          if (quantity > saleItem.rawStock) {
            window.alert(`Only ${saleItem.rawStock} units are available for ${saleItem.item}.`)
            return
          }
        }

        await onSubmit(type, mode, {
          item: saleItem?.item ?? String(form.get('item') || ''),
          contactName: String(form.get('contactName') || ''),
          phone: String(form.get('phone') || ''),
          reference: String(form.get('reference') || ''),
          category: saleItem?.category ?? String(form.get('category') || ''),
          quantity: String(form.get('quantity') || '1'),
          unitPrice: String(unitPrice),
          total: String(total),
          sku: saleItem?.sku ?? String(form.get('sku') || ''),
        })
      }}>
        <div className="detail-head">
          <div>
            <h2>New Entry</h2>
            <p>Manual mode selected. Add the transaction details before continuing.</p>
          </div>
          <button type="button" aria-label="Close new entry modal" onClick={onClose}>x</button>
        </div>

        {!initialType && (
          <label>Entry Type
            <select value={type} onChange={(event) => setType(event.target.value as EntryType)}>
              <option value="purchase">Purchase</option>
              <option value="sale">Sale</option>
            </select>
          </label>
        )}

        <div className="field-grid">
          <label>Item Name
            {isPurchase ? (
              <input name="item" required placeholder="Purchased item name..." />
            ) : (
              <select name="item" required value={selectedInventoryKey} onChange={(event) => setSelectedInventoryKey(event.target.value)}>
                {inStockItems.map((item) => <option key={inventoryKey(item)} value={inventoryKey(item)}>{item.item} ({item.rawStock} in stock)</option>)}
              </select>
            )}
          </label>
          <label>{isPurchase ? 'Supplier' : 'Customer'}
            <input name="contactName" required={!isPurchase} placeholder={isPurchase ? 'Supplier name...' : 'Customer name...'} />
          </label>
          <label>Phone Number
            <input name="phone" placeholder="+1 (555) 000-0000" />
          </label>
          <label>{isPurchase ? 'Purchase Reference' : 'Sale Reference'}
            <input name="reference" placeholder={isPurchase ? 'PO-9281-A' : 'SO-90210-A'} />
          </label>
          <label>Item Category
            {isPurchase ? (
              <select name="category" defaultValue="Computing">
                <option>Computing</option>
                <option>Visual Displays</option>
                <option>Peripherals</option>
                <option>Imaging Gear</option>
                <option>Drones</option>
                <option>Uncategorized</option>
              </select>
            ) : (
              <input value={selectedInventory?.category ?? ''} readOnly />
            )}
          </label>
          <label>Quantity
            <input name="quantity" type="number" min="1" max={isPurchase ? undefined : selectedInventory?.rawStock} value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} />
          </label>
          <label>Unit Price
            <input name="unitPrice" type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(Number(event.target.value) || 0)} />
          </label>
          <label>Total
            <input name="total" value={formatMoney(total, currency)} readOnly />
          </label>
        </div>

        <label>Item Search or SKU
          {isPurchase ? <input name="sku" placeholder="Enter SKU before continuing..." /> : <input name="sku" value={selectedInventory?.sku ?? ''} readOnly />}
        </label>

        <div className="modal-actions">
          <button type="button" onClick={onBack}>Back</button>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary-action" type="submit">{isPurchase ? 'Add Purchase Manually' : 'Add Sale Manually'}</button>
        </div>
      </form>
    </div>
  )
}

function formatMoney(value: number, currency = 'RWF') {
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'RWF' ? 0 : 2,
  }).format(value)
}

function inventoryKey(item: InventoryRow) {
  return item.sku || item.item
}

function entryTypeLabel(type: EntryType) {
  return type === 'purchase' ? 'Purchase' : 'Sale'
}

function getBarcodeDetector() {
  const detectorWindow = window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }
  return detectorWindow.BarcodeDetector ? new detectorWindow.BarcodeDetector({ formats: barcodeFormats }) : null
}

async function extractTextFromImage(file: File) {
  const worker = await createWorker('eng')
  try {
    const imageSources = [file, ...await createPreparedImageBlobs(file)]
    const textParts: string[] = []

    for (const source of imageSources) {
      const result = await worker.recognize(source)
      const text = result.data.text.trim()
      if (text && !textParts.includes(text)) {
        textParts.push(text)
      }
    }

    return textParts.join('\n').trim()
  } finally {
    await worker.terminate()
  }
}

async function createPreparedImageBlobs(file: File) {
  const image = await createImageBitmap(file)
  try {
    return (await Promise.all([
      renderImageRegion(image, { x: 0.18, y: 0.18, width: 0.64, height: 0.42 }),
      renderImageRegion(image, { x: 0.12, y: 0.12, width: 0.76, height: 0.62 }),
    ])).filter((blob): blob is Blob => Boolean(blob))
  } finally {
    image.close()
  }
}

async function renderImageRegion(image: ImageBitmap, region: { x: number; y: number; width: number; height: number }) {
  const sourceX = Math.round(image.width * region.x)
  const sourceY = Math.round(image.height * region.y)
  const sourceWidth = Math.round(image.width * region.width)
  const sourceHeight = Math.round(image.height * region.height)
  const scale = Math.max(1, Math.min(3, 1400 / Math.max(sourceWidth, sourceHeight)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sourceWidth * scale)
  canvas.height = Math.round(sourceHeight * scale)

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < imageData.data.length; index += 4) {
    const gray = imageData.data[index] * 0.299 + imageData.data[index + 1] * 0.587 + imageData.data[index + 2] * 0.114
    const boosted = gray < 145 ? Math.max(0, gray - 35) : Math.min(255, gray + 25)
    imageData.data[index] = boosted
    imageData.data[index + 1] = boosted
    imageData.data[index + 2] = boosted
  }
  context.putImageData(imageData, 0, 0)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
}

function parseEntryDetailsFromText(text: string, type: EntryType): Partial<ScanDetails> {
  const normalized = text.replace(/\r/g, '\n')
  const lines = normalized
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const details: Partial<ScanDetails> = {}
  const aboutDetails = parseWindowsAboutDetails(lines)

  details.item = aboutDetails.item || firstMatch(normalized, [
    /(?:product|item|name|device|computer|model)\s*(?:name|no\.?|number)?\s*[:=#-]\s*([^\n]+)/i,
    /(?:product|item|device|computer)\s+name\s+([^\n]+)/i,
    /(?:model)\s*(?:name|no\.?|number)?\s+([A-Z0-9][^\n]+)/i,
    /(?:laptop|desktop|notebook|workstation|computer)\s*[:=#-]\s*([^\n]+)/i,
  ]) || bestItemNameLine(lines)

  details.sku = aboutDetails.sku || firstMatch(normalized, [
    /(?:sku|barcode|serial|s\/n|part\s*(?:no\.?|number)|model\s*(?:no\.?|number))\s*[:=#-]\s*([A-Z0-9][A-Z0-9._/-]{2,})/i,
  ])

  details.category = aboutDetails.category || firstMatch(normalized, [
    /(?:category|type|class)\s*[:=#-]\s*([^\n]+)/i,
  ]) || inferCategory(normalized)

  details.quantity = firstMatch(normalized, [
    /(?:qty|quantity|units?)\s*[:=#-]\s*(\d+)/i,
  ])

  const price = firstMatch(normalized, [
    /(?:unit\s*price|price|cost)\s*[:=#-]?\s*(?:USD|\$)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
  ])
  if (price) {
    details.unitPrice = price.replace(/,/g, '')
  }

  details.contactName = firstMatch(normalized, [
    new RegExp(`(?:${type === 'purchase' ? 'supplier|vendor|seller' : 'customer|client|buyer'})\\s*(?:name)?\\s*[:=#-]\\s*([^\\n]+)`, 'i'),
  ])

  details.phone = firstMatch(normalized, [
    /(?:phone|tel|mobile|contact)\s*[:=#-]\s*([+()0-9\s-]{7,})/i,
    /(\+?\d[\d\s().-]{7,}\d)/,
  ])

  details.reference = aboutDetails.reference || firstMatch(normalized, [
    /(?:reference|ref|invoice|order|po|purchase\s*order|so|sale\s*order)\s*(?:no\.?|number|id)?\s*[:=#-]\s*([A-Z0-9._/-]+)/i,
  ])

  return details
}

function parseEntryDetailsFromScanValue(value: string, type: EntryType): Partial<ScanDetails> {
  const trimmedValue = value.trim()
  if (!trimmedValue) return {}

  const jsonDetails = parseJsonScanValue(trimmedValue)
  if (Object.values(jsonDetails).some(Boolean)) return jsonDetails

  const decodedValue = safeDecodeURIComponent(trimmedValue)
  const keyValueDetails = parseEntryDetailsFromText(decodedValue.replace(/[;&|]/g, '\n'), type)
  if (Object.values(keyValueDetails).some(Boolean)) return keyValueDetails

  return looksLikeSku(trimmedValue) ? { sku: trimmedValue } : { item: cleanOcrValue(trimmedValue) }
}

function parseJsonScanValue(value: string): Partial<ScanDetails> {
  try {
    const data = JSON.parse(value) as Record<string, unknown>
    return {
      item: stringFromKeys(data, ['item', 'itemName', 'name', 'product', 'productName', 'device', 'model']),
      sku: stringFromKeys(data, ['sku', 'barcode', 'code', 'serial', 'serialNumber', 'productId']),
      category: stringFromKeys(data, ['category', 'type']),
      quantity: stringFromKeys(data, ['quantity', 'qty']),
      unitPrice: stringFromKeys(data, ['unitPrice', 'price', 'cost']),
      contactName: stringFromKeys(data, ['supplier', 'vendor', 'seller', 'customer', 'client', 'buyer']),
      phone: stringFromKeys(data, ['phone', 'telephone', 'mobile', 'contact']),
      reference: stringFromKeys(data, ['reference', 'ref', 'invoice', 'order', 'po', 'so']),
    }
  } catch {
    return {}
  }
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.trim()
    if (value) return cleanOcrValue(value)
  }

  return ''
}

function cleanOcrValue(value: string) {
  return value.replace(/[|]+/g, '').replace(/\s{2,}/g, ' ').trim()
}

function bestItemNameLine(lines: string[]) {
  const softwareProductName = softwareProductNameFromLines(lines)
  if (softwareProductName) return softwareProductName

  const packagedProductName = packagedProductNameFromLines(lines)
  if (packagedProductName) return packagedProductName

  const candidates = lines
    .map(cleanOcrValue)
    .filter((line) => line.length >= 4 && isReadableNameCandidate(line) && !isIgnoredItemNameLine(line) && !looksLikeSku(line))
    .sort((first, second) => itemNameScore(second) - itemNameScore(first))

  return candidates[0] ?? ''
}

function softwareProductNameFromLines(lines: string[]) {
  const text = lines.map(cleanOcrValue).join(' ')
  const brand = knownSoftwareBrand(text)
  if (!brand) return ''

  const edition = firstSoftwareEdition(lines)
  return edition ? `${brand} ${edition}` : brand
}

function packagedProductNameFromLines(lines: string[]) {
  const cleanLines = lines
    .map(cleanOcrValue)
    .filter((line) => line.length >= 3 && isReadableNameCandidate(line) && !isIgnoredItemNameLine(line) && !looksLikeSku(line))

  for (let index = 0; index < cleanLines.length; index += 1) {
    const brandLine = cleanLines[index]
    const editionLine = cleanLines[index + 1]

    if (isLikelyBrandLine(brandLine) && editionLine && isLikelyEditionLine(editionLine)) {
      return `${brandLine} ${editionLine}`
    }
  }

  return ''
}

function isIgnoredItemNameLine(line: string) {
  return /^(system|about|sku|serial|barcode|price|cost|qty|quantity|phone|tel|reference|invoice|order|category|supplier|customer|device name|processor|installed ram|graphics card|storage|device id|product id|system type|pen and touch|windows info|edition|copy|rename this pc|related links|security|performance|devices|year subscription)\b/i.test(line)
    || /\b(?:this is your|protect your|security built|digital life|apps and networks|privacy|subscription|devices|get premium|identity theft|protection|update faster|new anti-virus)\b/i.test(line)
}

function isReadableNameCandidate(line: string) {
  const letters = line.match(/[a-z]/gi)?.length ?? 0
  const visibleCharacters = line.replace(/\s/g, '').length
  const symbolCharacters = line.match(/[^a-z0-9\s-]/gi)?.length ?? 0

  return letters >= 3
    && visibleCharacters > 0
    && letters / visibleCharacters >= 0.45
    && symbolCharacters / visibleCharacters <= 0.25
}

function itemNameScore(line: string) {
  let score = Math.min(line.length, 80)
  if (/\b(?:hp|dell|lenovo|asus|acer|apple|samsung|lg|sony|canon|epson|kaspersky|norton|mcafee|bitdefender|eset|avast|avg|malwarebytes|microsoft|office|windows|adobe|corel|autodesk|quickbooks|elitebook|thinkpad|latitude|inspiron|macbook|surface|printer|scanner|monitor|keyboard|mouse|laptop|desktop|notebook|workstation|phone|tablet)\b/i.test(line)) {
    score += 60
  }
  if (/\d/.test(line)) score += 8
  if (/[:#]/.test(line)) score -= 20
  if (/[.!?]/.test(line) || line.split(/\s+/).length > 5) score -= 55
  if (/\b(?:get|plus|with|your|built|keep|pace|protect|protection|faster|update|identity|theft)\b/i.test(line)) score -= 70
  if (line.length > 70) score -= 15
  return score
}

function knownSoftwareBrand(text: string) {
  const brands: Array<[RegExp, string]> = [
    [/\bkaspersk[yi1l]\b/i, 'Kaspersky'],
    [/\bnorton\b/i, 'Norton'],
    [/\bmcafee\b/i, 'McAfee'],
    [/\bbitdefender\b/i, 'Bitdefender'],
    [/\beset\b/i, 'ESET'],
    [/\bavast\b/i, 'Avast'],
    [/\bavg\b/i, 'AVG'],
    [/\bmalwarebytes\b/i, 'Malwarebytes'],
    [/\bmicrosoft\b/i, 'Microsoft'],
    [/\badobe\b/i, 'Adobe'],
  ]

  return brands.find(([pattern]) => pattern.test(text))?.[1] ?? ''
}

function firstSoftwareEdition(lines: string[]) {
  const cleanLines = lines.map(cleanOcrValue)
  const standaloneEdition = cleanLines.find((line) => !isIgnoredItemNameLine(line) && /^(?:standard|premium|plus|pro|professional|business|enterprise|ultimate|basic|essential|essentials|total security|internet security|anti-virus|antivirus)$/i.test(line))
  if (standaloneEdition) return titleCaseEdition(standaloneEdition)

  const text = cleanLines.filter((line) => !isIgnoredItemNameLine(line)).join(' ')
  const editionPatterns: Array<[RegExp, string]> = [
    [/\bstandard\b/i, 'Standard'],
    [/\bplus\b/i, 'Plus'],
    [/\bpro(?:fessional)?\b/i, 'Pro'],
    [/\bbusiness\b/i, 'Business'],
    [/\benterprise\b/i, 'Enterprise'],
    [/\btotal security\b/i, 'Total Security'],
    [/\binternet security\b/i, 'Internet Security'],
    [/\banti[-\s]?virus\b/i, 'Anti-Virus'],
  ]

  return editionPatterns.find(([pattern]) => pattern.test(text))?.[1] ?? ''
}

function titleCaseEdition(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word === 'pro' ? 'Pro' : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/Anti-virus/i, 'Anti-Virus')
}

function isLikelyBrandLine(line: string) {
  return /^(?:[a-z][a-z0-9-]{2,}|[A-Z][A-Za-z0-9-]{2,})(?:\s+[A-Z][A-Za-z0-9-]{2,}){0,2}$/i.test(line)
    && /\b(?:hp|dell|lenovo|asus|acer|apple|samsung|lg|sony|canon|epson|kaspersky|norton|mcafee|bitdefender|eset|avast|avg|malwarebytes|microsoft|adobe|corel|autodesk|quickbooks)\b/i.test(line)
}

function isLikelyEditionLine(line: string) {
  return /^(?:standard|premium|plus|pro|professional|business|enterprise|ultimate|basic|essential|essentials|total security|internet security|anti-virus|antivirus|office|home|student|personal)$/i.test(line)
    || (/^[A-Z][A-Z\s-]{2,24}$/.test(line) && !isIgnoredItemNameLine(line))
}

function inferCategory(text: string) {
  if (/anti[-\s]?virus|security|kaspersky|norton|mcafee|bitdefender|eset|avast|avg|malwarebytes|software|subscription/i.test(text)) {
    return 'Software'
  }

  if (/laptop|notebook|desktop|workstation|computer|cpu|ram|ssd|hdd|processor/i.test(text)) {
    return 'Computing'
  }

  if (/monitor|display|screen|qled|oled|led/i.test(text)) {
    return 'Visual Displays'
  }

  if (/keyboard|mouse|scanner|printer|headset|speaker/i.test(text)) {
    return 'Peripherals'
  }

  return ''
}

function dropEmptyValues(details: Partial<ScanDetails>) {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => String(value ?? '').trim())) as Partial<ScanDetails>
}

function parseWindowsAboutDetails(lines: string[]): Partial<ScanDetails> {
  const details: Partial<ScanDetails> = {}
  const deviceInfoIndex = lines.findIndex((line) => /^device info$/i.test(line))
  const beforeDeviceInfo = deviceInfoIndex >= 0 ? lines.slice(0, deviceInfoIndex) : lines
  const hostnameIndex = beforeDeviceInfo.findIndex((line) => /^[A-Z0-9_-]{4,}$/i.test(line) && !/^(system|about)$/i.test(line))
  const modelLine = hostnameIndex >= 0 ? beforeDeviceInfo[hostnameIndex + 1] : ''

  if (modelLine && !isWindowsAboutLabel(modelLine)) {
    details.item = cleanOcrValue(modelLine)
  }

  const productId = valueAfterLabel(lines, 'Product ID')
  const deviceId = valueAfterLabel(lines, 'Device ID')
  const processor = valueAfterLabel(lines, 'Processor')
  const ram = valueAfterLabel(lines, 'Installed RAM')
  const graphics = valueAfterLabel(lines, 'Graphics card')
  const storage = valueAfterLabel(lines, 'Storage')

  details.sku = productId || deviceId
  details.reference = productId || deviceId

  if (processor || ram || graphics || storage) {
    details.category = 'Computing'
  }

  const fallbackModel = firstHardwareModel(lines)
  if (!details.item && fallbackModel) {
    details.item = fallbackModel
  }

  return details
}

function valueAfterLabel(lines: string[], label: string) {
  const labelPattern = new RegExp(`^${label.replace(/\s+/g, '\\s+')}$`, 'i')
  const inlinePattern = new RegExp(`^${label.replace(/\s+/g, '\\s+')}\\s+(.+)$`, 'i')

  for (let index = 0; index < lines.length; index += 1) {
    const inline = lines[index].match(inlinePattern)?.[1]
    if (inline) return cleanOcrValue(inline)

    if (labelPattern.test(lines[index])) {
      const next = lines[index + 1]
      return next && !isWindowsAboutLabel(next) ? cleanOcrValue(next) : ''
    }
  }

  return ''
}

function firstHardwareModel(lines: string[]) {
  return cleanOcrValue(lines.find((line) => /\b(?:hp|dell|lenovo|asus|acer|elitebook|thinkpad|latitude|inspiron|macbook|surface)\b/i.test(line) && !isWindowsAboutLabel(line)) ?? '')
}

function looksLikeSku(value: string) {
  const normalized = value.trim()
  return /^[A-Z0-9._/-]{5,}$/i.test(normalized) && !/\s/.test(normalized)
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function stringFromKeys(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key]
    if (value !== undefined && value !== null && String(value).trim()) {
      return cleanOcrValue(String(value))
    }
  }

  return ''
}

function isWindowsAboutLabel(value: string) {
  return /^(system|about|processor|installed ram|graphics card|storage|device info|device name|device id|product id|system type|pen and touch|windows info|edition|copy|rename this pc|related links)$/i.test(value.trim())
}
