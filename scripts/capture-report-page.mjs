import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const chromePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const userDataDir = `C:\\Users\\HP\\Downloads\\stock\\stock-frontend\\.edge-profile-${Date.now()}`
const screenshotPath = 'C:\\tmp\\stock-report-page.png'
const port = 9223

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createCdpClient(socketUrl) {
  const socket = new WebSocket(socketUrl)
  let id = 0
  const pending = new Map()

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data)
    if (!payload.id || !pending.has(payload.id)) return
    const { resolve, reject } = pending.get(payload.id)
    pending.delete(payload.id)
    if (payload.error) reject(new Error(payload.error.message))
    else resolve(payload.result)
  })

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  return {
    async send(method, params = {}, sessionId) {
      await ready
      id += 1
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
    },
    close() {
      socket.close()
    },
  }
}

await mkdir('C:\\tmp', { recursive: true })

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${port}`,
  '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${userDataDir}`,
  '--headless=new',
  '--disable-gpu',
  '--disable-gpu-compositing',
  '--disable-software-rasterizer',
  '--disable-features=Vulkan',
  '--use-angle=swiftshader',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--disable-crash-reporter',
  '--disable-crashpad',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--window-size=1440,1100',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })

const browserSocketUrl = new Promise((resolve, reject) => {
  const timeoutId = setTimeout(() => reject(new Error('Edge did not print a DevTools WebSocket URL in time.')), 10000)

  chrome.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    process.stderr.write(chunk)
    const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/)
    if (match) {
      clearTimeout(timeoutId)
      resolve(match[1])
    }
  })

  chrome.on('exit', (code) => {
    clearTimeout(timeoutId)
    reject(new Error(`Edge exited before capture: ${code}`))
  })
})

chrome.stderr.on('data', (chunk) => {
  process.stderr.write(chunk)
})

try {
  const cdp = createCdpClient(await browserSocketUrl)
  const target = await cdp.send('Target.createTarget', { url: 'http://localhost:5173/' })
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })

  await cdp.send('Page.enable', {}, attached.sessionId)
  await cdp.send('Runtime.enable', {}, attached.sessionId)
  await delay(2000)
  await cdp.send('Runtime.evaluate', {
    expression: `
      [...document.querySelectorAll('button')]
        .find((button) => button.textContent.trim() === 'Reports')
        ?.click()
    `,
  }, attached.sessionId)
  await delay(2000)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  }, attached.sessionId)
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  }, attached.sessionId)
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  cdp.close()
  console.log(screenshotPath)
} finally {
  chrome.kill()
}
