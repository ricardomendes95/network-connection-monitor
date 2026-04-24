import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { getOverlayWindow } from './overlay-toast.service'
import { activeNetworkService } from './active-network.service'
import { networksRepo } from '../database/networks.repo'

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

function buildNetworksSubmenu(): Electron.MenuItemConstructorOptions[] {
  const networks = networksRepo.list()
  const active = activeNetworkService.getActive()

  if (networks.length === 0) {
    return [
      {
        label: 'Nenhuma rede cadastrada',
        enabled: false,
      },
      {
        label: 'Abrir janela para cadastrar',
        click: () => handleOpenMain(),
      },
    ]
  }

  return networks.map((net) => ({
    label: `${net.name} (${net.connection_type === 'wifi' ? 'WiFi' : 'Cabo'})`,
    type: 'radio' as const,
    checked: active?.id === net.id,
    click: () => {
      activeNetworkService.setActive(net.id, { manual: true })
    },
  }))
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

  const active = activeNetworkService.getActive()
  const activeLabel = active
    ? `Rede: ${active.name}`
    : 'Rede: não selecionada'

  const menu = Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    ...extraInfo,
    {
      label: `Última verificação: ${formatClock(state.lastTestedAt)}`,
      enabled: false,
    },
    { type: 'separator' },
    { label: activeLabel, enabled: false },
    {
      label: 'Trocar rede',
      submenu: buildNetworksSubmenu(),
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

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'resources', 'tray-icon.png')
    : join(app.getAppPath(), 'resources', 'tray-icon.png')
  const trayIcon = nativeImage.createFromPath(iconPath)
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon)
  tray.on('click', () => {
    tray?.popUpContextMenu()
  })
  rebuildMenu()

  // Rebuild o menu quando a rede ativa ou a lista de redes mudar
  activeNetworkService.on('change', () => rebuildMenu())

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
