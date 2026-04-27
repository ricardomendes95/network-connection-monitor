import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let overlayWin: BrowserWindow | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

export function createOverlayWindow(preloadPath: string): void {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  overlayWin = new BrowserWindow({
    width: 280,
    height: 64,
    x: width - 296,
    y: 16,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    show: false,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  overlayWin.setAlwaysOnTop(true, 'screen-saver')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/overlay`)
  } else {
    overlayWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'overlay' })
  }
}

export function showOverlayWindow(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  overlayWin?.show()
}

export function hideOverlayWindowAfter(ms: number): void {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => overlayWin?.hide(), ms)
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWin
}
