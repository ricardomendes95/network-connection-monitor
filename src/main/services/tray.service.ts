import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { getOverlayWindow } from './overlay-toast.service'

export type ConnectivityStatus = 'online' | 'offline' | 'unknown'

interface TrayState {
  status: ConnectivityStatus
  lastTestedAt: string | null
  downloadMbps: number | null
  uploadMbps: number | null
  pingMs: number | null
  isTesting: boolean
}

const state: TrayState = {
  status: 'unknown',
  lastTestedAt: null,
  downloadMbps: null,
  uploadMbps: null,
  pingMs: null,
  isTesting: false,
}

let tray: Tray | null = null
let runTestNow: (() => Promise<void> | void) | null = null
let openMainWindow: (() => void) | null = null

function formatClock(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function statusSymbol(): string {
  if (state.isTesting) return '⟳'
  if (state.status === 'online') return '●'
  if (state.status === 'offline') return '●'
  return '○'
}

function titleText(): string {
  const sym = statusSymbol()
  if (state.isTesting) return `${sym} testando…`
  if (state.status === 'online' && state.downloadMbps !== null) {
    return `${sym} ${state.downloadMbps.toFixed(0)} Mbps`
  }
  if (state.status === 'offline') return `${sym} sem internet`
  return sym
}

function getMainWindow(): BrowserWindow | null {
  const overlay = getOverlayWindow()
  return (
    BrowserWindow.getAllWindows().find(
      (w) => !w.isDestroyed() && w !== overlay
    ) ?? null
  )
}

function handleOpenMain(): void {
  const main = getMainWindow()
  if (main) {
    if (main.isMinimized()) main.restore()
    main.show()
    main.focus()
    return
  }
  openMainWindow?.()
}

function rebuildMenu(): void {
  if (!tray) return

  const statusLabel = state.isTesting
    ? 'Testando velocidade…'
    : state.status === 'online'
      ? `Online • ${state.downloadMbps?.toFixed(1) ?? '?'} Mbps ↓`
      : state.status === 'offline'
        ? 'Sem internet'
        : 'Status desconhecido'

  const extraInfo: Electron.MenuItemConstructorOptions[] = []
  if (state.status === 'online' && !state.isTesting) {
    if (state.uploadMbps !== null) {
      extraInfo.push({
        label: `Upload: ${state.uploadMbps.toFixed(1)} Mbps`,
        enabled: false,
      })
    }
    if (state.pingMs !== null) {
      extraInfo.push({
        label: `Ping: ${state.pingMs.toFixed(0)} ms`,
        enabled: false,
      })
    }
  }

  const menu = Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    ...extraInfo,
    {
      label: `Última verificação: ${formatClock(state.lastTestedAt)}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: state.isTesting ? 'Testando…' : 'Testar agora',
      enabled: !state.isTesting,
      click: () => {
        void runTestNow?.()
      },
    },
    {
      label: 'Abrir janela principal',
      click: () => handleOpenMain(),
    },
    { type: 'separator' },
    { label: 'Sair', role: 'quit' },
  ])

  tray.setContextMenu(menu)
  tray.setToolTip(statusLabel)
  tray.setTitle(titleText())
}

export function createTray(options: {
  onRunNow: () => Promise<void> | void
  onOpenMain: () => void
}): void {
  if (tray) return
  runTestNow = options.onRunNow
  openMainWindow = options.onOpenMain

  tray = new Tray(nativeImage.createEmpty())
  tray.on('click', () => {
    tray?.popUpContextMenu()
  })
  rebuildMenu()

  app.on('before-quit', () => {
    tray?.destroy()
    tray = null
  })
}

export function setTrayTesting(isTesting: boolean): void {
  state.isTesting = isTesting
  rebuildMenu()
}

export function setTrayOnline(result: {
  download: number
  upload: number
  ping: number
  testedAt: string
}): void {
  state.status = 'online'
  state.downloadMbps = result.download
  state.uploadMbps = result.upload
  state.pingMs = result.ping
  state.lastTestedAt = result.testedAt
  state.isTesting = false
  rebuildMenu()
}

export function setTrayOffline(testedAt: string): void {
  state.status = 'offline'
  state.downloadMbps = null
  state.uploadMbps = null
  state.pingMs = null
  state.lastTestedAt = testedAt
  state.isTesting = false
  rebuildMenu()
}
