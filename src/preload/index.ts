import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../main/ipc/channels'

type Callback<T = unknown> = (data: T) => void

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform as NodeJS.Platform,

  getHistory: (filter?: { days?: number; page?: number; limit?: number; networkId?: number | null }) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_HISTORY, filter),

  getChartData: (
    type: 'heatmap' | 'daily' | 'timeline' | 'weekly' | 'instability',
    days?: number,
    options?: { contracted_mbps?: number; connection_type?: string; networkId?: number | null }
  ) => ipcRenderer.invoke(IPC_CHANNELS.GET_CHART_DATA, type, days, options),

  runTestNow: () => ipcRenderer.invoke(IPC_CHANNELS.RUN_NOW),

  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),

  setSettings: (settings: Record<string, string>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  listNetworks: () => ipcRenderer.invoke(IPC_CHANNELS.NETWORKS_LIST),
  getActiveNetwork: () => ipcRenderer.invoke(IPC_CHANNELS.NETWORKS_GET_ACTIVE),
  createNetwork: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.NETWORKS_CREATE, input),
  updateNetwork: (id: number, patch: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.NETWORKS_UPDATE, { id, patch }),
  deleteNetwork: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.NETWORKS_DELETE, id),
  setActiveNetwork: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.NETWORKS_SET_ACTIVE, id),
  suggestNetworkFromLive: () => ipcRenderer.invoke(IPC_CHANNELS.NETWORKS_SUGGEST_FROM_LIVE),
  onActiveNetworkChanged: (cb: Callback) => {
    ipcRenderer.on(IPC_CHANNELS.ACTIVE_NETWORK_CHANGED, (_e, d) => cb(d))
  },

  onTestStarted: (cb: Callback) => {
    ipcRenderer.on(IPC_CHANNELS.TEST_STARTED, (_e, d) => cb(d))
  },
  onTestCompleted: (cb: Callback) => {
    ipcRenderer.on(IPC_CHANNELS.TEST_COMPLETED, (_e, d) => cb(d))
  },
  onTestFailed: (cb: Callback<{ error: string }>) => {
    ipcRenderer.on(IPC_CHANNELS.TEST_FAILED, (_e, d) => cb(d))
  },
  onSpeedAlert: (cb: Callback<{ download: number }>) => {
    ipcRenderer.on(IPC_CHANNELS.SPEED_ALERT, (_e, d) => cb(d))
  },
  onSchedulerTick: (cb: Callback<{ nextInSeconds: number }>) => {
    ipcRenderer.on(IPC_CHANNELS.SCHEDULER_TICK, (_e, d) => cb(d))
  },
  onNetworkInfoUpdate: (cb: Callback<{ networkName: string; ispName: string; connectionType: 'wifi' | 'wired' }>) => {
    ipcRenderer.on(IPC_CHANNELS.NETWORK_INFO_UPDATE, (_e, d) => cb(d))
  },

  getCurrentNetworkInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_NETWORK_INFO),

  exportPdf: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_PDF),

  savePng: (dataUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_PNG, dataUrl),

  exportEvidence: (days: number, opts?: { contracted_mbps?: number; connection_type?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_EVIDENCE, days, opts),

  exportEvidencePdf: (days: number, opts?: { contracted_mbps?: number; connection_type?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_EVIDENCE_PDF, days, opts),

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

  getAutostart: () => ipcRenderer.invoke(IPC_CHANNELS.AUTOSTART_GET),
  setAutostart: (enable: boolean) => ipcRenderer.invoke(IPC_CHANNELS.AUTOSTART_SET, enable)
})
