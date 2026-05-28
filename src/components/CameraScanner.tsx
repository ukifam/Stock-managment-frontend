import { useEffect, useRef, useState } from 'react'

type CameraScannerProps = {
  onScan: (result: string) => void
  onCapture?: (file: File) => void
  isActive: boolean
  previewImageUrl?: string
}

type DetectedBarcode = {
  rawValue: string
}

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance

const barcodeFormats = [
  'qr_code',
  'code_128',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
]

const isPermissionError = (message: string) => (
  message.includes('NotAllowedError')
  || message.includes('NotFoundError')
  || message.includes('Permission')
  || message.includes('permission')
  || message.includes('Requested device not found')
)

const stopStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop())
}

const getBarcodeDetector = () => {
  const detectorWindow = window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }
  return detectorWindow.BarcodeDetector ? new detectorWindow.BarcodeDetector({ formats: barcodeFormats }) : null
}

export function CameraScanner({ onScan, onCapture, isActive, previewImageUrl }: CameraScannerProps) {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'pending'>('pending')
  const [error, setError] = useState('')
  const [isReady, setIsReady] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onScanRef = useRef(onScan)
  const lastScanRef = useRef('')

  const handleTakePhoto = () => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError('Camera is not ready yet. Wait a moment and try again.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setError('Could not capture a photo from the camera.')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Could not capture a photo from the camera.')
        return
      }

      onCapture?.(new File([blob], `scan-${Date.now()}.png`, { type: 'image/png' }))
    }, 'image/png')
  }

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    let isCancelled = false
    let scanTimer = 0
    let blackFrameTimer = 0

    const cleanup = () => {
      window.clearInterval(scanTimer)
      window.clearTimeout(blackFrameTimer)
      stopStream(streamRef.current)
      streamRef.current = null
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setIsReady(false)
    }

    if (!isActive) {
      cleanup()
      return cleanup
    }

    const initCamera = async () => {
      if (!videoRef.current) return

      try {
        setError('')
        setPermission('pending')

        if (!navigator.mediaDevices?.getUserMedia) {
          setError('This browser cannot open the camera. Type the barcode/SKU below.')
          return
        }

        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        }

        if (isCancelled) {
          stopStream(stream)
          return
        }

        const video = videoRef.current
        streamRef.current = stream
        video.srcObject = stream
        video.muted = true
        video.playsInline = true

        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error('Camera video did not load.')), 4000)
          video.onloadedmetadata = () => {
            window.clearTimeout(timeout)
            resolve()
          }
        })

        await video.play()

        if (isCancelled) {
          cleanup()
          return
        }

        setPermission('granted')
        setIsReady(true)

        const detector = getBarcodeDetector()
        if (!detector) {
          setError('Camera preview is open. Automatic barcode detection is not supported in this browser, so type the barcode/SKU below.')
        } else {
          scanTimer = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

            try {
              const results = await detector.detect(videoRef.current)
              const value = results[0]?.rawValue?.trim()
              if (value && value !== lastScanRef.current) {
                lastScanRef.current = value
                onScanRef.current(value)
              }
            } catch {
              // Keep the preview alive even if a frame cannot be decoded.
            }
          }, 450)
        }

        blackFrameTimer = window.setTimeout(() => {
          const activeVideo = videoRef.current
          if (!activeVideo || activeVideo.videoWidth === 0 || activeVideo.videoHeight === 0) {
            setError('The camera is connected, but no video frame is visible. Check camera privacy settings or type the barcode/SKU below.')
          }
        }, 1800)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to start scanner'
        console.error('Scanner error:', err)

        cleanup()
        if (isPermissionError(errorMessage)) {
          setPermission('denied')
        } else {
          setError(cameraErrorMessage(errorMessage))
          setPermission('pending')
        }
      }
    }

    initCamera()

    return () => {
      isCancelled = true
      cleanup()
    }
  }, [isActive])

  if (permission === 'denied') {
    return (
      <div style={{ padding: '16px', backgroundColor: '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ color: '#d32f2f', marginBottom: '8px' }}><strong>Camera Permission Denied</strong></div>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>Allow camera access or type the barcode/SKU below.</div>
        <ManualScanForm manualCode={manualCode} setManualCode={setManualCode} onScan={onScan} />
      </div>
    )
  }

  return (
    <div className="camera-scanner">
      {(error || !window.isSecureContext) && (
        <div style={{ color: '#ff6f00', padding: '8px', marginBottom: '12px', backgroundColor: '#fff3e0', borderRadius: '4px', fontSize: '14px' }}>
          {error || 'Camera scanning requires localhost or HTTPS. Type the barcode/SKU below if the camera does not open.'}
        </div>
      )}
      <div className={`camera-viewfinder${isReady || previewImageUrl ? ' is-ready' : ''}${previewImageUrl ? ' has-preview-image' : ''}`}>
        {!isReady && !previewImageUrl && <span>Initializing camera...</span>}
        <video ref={videoRef} aria-label="Camera scanner preview" />
        {previewImageUrl && <img src={previewImageUrl} alt="Selected scan preview" />}
      </div>
      <button className="take-photo-button" type="button" disabled={!isReady || !onCapture} onClick={handleTakePhoto}>Take Photo</button>
      <ManualScanForm manualCode={manualCode} setManualCode={setManualCode} onScan={onScan} />
      {isReady && (
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '13px', color: '#1565c0' }}>
          <strong>Scanner Ready</strong> - Point your camera at a QR code or barcode
        </div>
      )}
    </div>
  )
}

function ManualScanForm({ manualCode, setManualCode, onScan }: {
  manualCode: string
  setManualCode: (value: string) => void
  onScan: (result: string) => void
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const code = manualCode.trim()
        if (!code) return
        onScan(code)
        setManualCode('')
      }}
      style={{ display: 'flex', gap: '8px', marginTop: '12px' }}
    >
      <input
        value={manualCode}
        onChange={(event) => setManualCode(event.target.value)}
        placeholder="Type barcode, QR value, or SKU..."
        style={{ flex: 1 }}
      />
      <button type="submit">Add</button>
    </form>
  )
}

function cameraErrorMessage(message: string) {
  if (message.includes('NotFoundError') || message.includes('Requested device not found') || message.includes('No camera')) {
    return 'No camera was found. Type the barcode or SKU below.'
  }

  if (message.includes('NotReadableError') || message.includes('Could not start video source')) {
    return 'The camera is being used by another app. Close it or type the barcode/SKU below.'
  }

  if (message.includes('NotSupportedError') || message.includes('secure context')) {
    return 'Camera scanning needs localhost or HTTPS. Type the barcode/SKU below.'
  }

  return 'Failed to start scanner. Type the barcode or SKU below.'
}
