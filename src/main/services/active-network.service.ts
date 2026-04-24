import { BrowserWindow } from 'electron'
import EventEmitter from 'node:events'
import { getDb } from '../database/connection'
import { networksRepo, type NetworkRecord } from '../database/networks.repo'
import { IPC_CHANNELS } from '../ipc/channels'
import type { NetworkInfo } from './network-info.service'

export type LiveMatchStatus = 'match' | 'mismatch' | 'uncatalogued' | 'unknown'

export interface ActiveNetworkState {
  active: NetworkRecord | null
  live: NetworkInfo | null
  liveMatch: LiveMatchStatus
  manualOverride: boolean
}

export interface ActiveNetworkEvents {
  change: (state: ActiveNetworkState) => void
}

const SETTING_ACTIVE_ID = 'active_network_id'
const SETTING_MANUAL_OVERRIDE = 'active_network_manual_override'

function readSetting(key: string): string | null {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

function writeSetting(key: string, value: string): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, value)
}

class ActiveNetworkService extends EventEmitter {
  private live: NetworkInfo | null = null

  getActive(): NetworkRecord | null {
    const raw = readSetting(SETTING_ACTIVE_ID)
    const id = raw ? Number(raw) : NaN
    if (!Number.isFinite(id)) return null
    return networksRepo.getById(id)
  }

  getManualOverride(): boolean {
    return readSetting(SETTING_MANUAL_OVERRIDE) === 'true'
  }

  getLive(): NetworkInfo | null {
    return this.live
  }

  getState(): ActiveNetworkState {
    const active = this.getActive()
    const live = this.live
    const manualOverride = this.getManualOverride()
    return {
      active,
      live,
      liveMatch: this.computeMatch(active, live),
      manualOverride
    }
  }

  private computeMatch(
    active: NetworkRecord | null,
    live: NetworkInfo | null
  ): LiveMatchStatus {
    if (!live) return 'unknown'
    const matching = networksRepo.getByIdentity(live.networkName, live.connectionType)
    if (!matching) return 'uncatalogued'
    if (active && matching.id === active.id) return 'match'
    return 'mismatch'
  }

  reconcile(info: NetworkInfo): ActiveNetworkState {
    this.live = info
    const match = networksRepo.getByIdentity(info.networkName, info.connectionType)
    const active = this.getActive()
    const manualOverride = this.getManualOverride()

    if (match) {
      if (!active || active.id !== match.id) {
        if (!manualOverride) {
          writeSetting(SETTING_ACTIVE_ID, String(match.id))
        }
      } else if (manualOverride) {
        // A rede viva agora bate com a selecionada → limpa override
        writeSetting(SETTING_MANUAL_OVERRIDE, 'false')
      }
    }

    const state = this.getState()
    this.broadcast(state)
    return state
  }

  setActive(networkId: number, opts: { manual: boolean } = { manual: true }): ActiveNetworkState {
    const target = networksRepo.getById(networkId)
    if (!target) throw new Error(`Rede ${networkId} não encontrada`)
    writeSetting(SETTING_ACTIVE_ID, String(networkId))

    if (opts.manual) {
      const live = this.live
      const matchesLive =
        !!live &&
        live.networkName === target.ssid &&
        live.connectionType === target.connection_type
      writeSetting(SETTING_MANUAL_OVERRIDE, matchesLive ? 'false' : 'true')
    }

    const state = this.getState()
    this.broadcast(state)
    return state
  }

  notifyNetworksChanged(): void {
    const state = this.getState()
    this.broadcast(state)
  }

  private broadcast(state: ActiveNetworkState): void {
    this.emit('change', state)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.ACTIVE_NETWORK_CHANGED, state)
      }
    }
  }
}

export const activeNetworkService = new ActiveNetworkService()
