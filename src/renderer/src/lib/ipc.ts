import type { Settings, HistoryResponse, HeatmapPoint, DailyPoint, WeeklyPoint, SpeedResult, LiveNetworkInfo } from '../types'

declare global {
  interface Window {
    electronAPI: {
      getHistory: (filter?: { days?: number; page?: number; limit?: number }) => Promise<HistoryResponse>
      getChartData: (type: 'heatmap', days?: number) => Promise<HeatmapPoint[]>
      getChartData: (type: 'daily', days?: number) => Promise<DailyPoint[]>
      getChartData: (type: 'weekly', days?: number) => Promise<WeeklyPoint[]>
      getChartData: (type: 'timeline', days?: number) => Promise<SpeedResult[]>
      getChartData: (type: 'instability', days?: number) => Promise<unknown>
      runTestNow: () => Promise<{ queued: boolean }>
      getSettings: () => Promise<Settings>
      setSettings: (settings: Partial<Settings>) => Promise<{ ok: boolean }>
      getCurrentNetworkInfo: () => Promise<LiveNetworkInfo>
      exportPdf: () => Promise<{ ok: boolean }>
      savePng: (dataUrl: string) => Promise<{ ok: boolean }>
      onTestStarted: (cb: () => void) => void
      onTestCompleted: (cb: (result: SpeedResult) => void) => void
      onTestFailed: (cb: (data: { error: string }) => void) => void
      onSpeedAlert: (cb: (data: { download: number }) => void) => void
      onSchedulerTick: (cb: (data: { nextInSeconds: number }) => void) => void
      onNetworkInfoUpdate: (cb: (info: LiveNetworkInfo) => void) => void
      removeAllListeners: (channel: string) => void
      getAutostart: () => Promise<boolean>
      setAutostart: (enable: boolean) => Promise<{ ok: boolean }>
    }
  }
}

export const ipc = {
  getHistory: (filter?: { days?: number; page?: number; limit?: number }) =>
    window.electronAPI.getHistory(filter),

  getChartData: (type: string, days?: number, options?: { contracted_mbps?: number; connection_type?: string }) =>
    (window.electronAPI.getChartData as (t: string, d?: number, o?: { contracted_mbps?: number; connection_type?: string }) => Promise<unknown>)(type, days, options),

  runTestNow: () => window.electronAPI.runTestNow(),
  getSettings: () => window.electronAPI.getSettings(),
  setSettings: (settings: Partial<Settings>) => window.electronAPI.setSettings(settings),
  getCurrentNetworkInfo: () => window.electronAPI.getCurrentNetworkInfo(),

  exportPdf: () => window.electronAPI.exportPdf(),

  savePng: (dataUrl: string) => window.electronAPI.savePng(dataUrl),

  onTestStarted: (cb: () => void) => window.electronAPI.onTestStarted(cb),
  onTestCompleted: (cb: (result: SpeedResult) => void) => window.electronAPI.onTestCompleted(cb),
  onTestFailed: (cb: (data: { error: string }) => void) => window.electronAPI.onTestFailed(cb),
  onSpeedAlert: (cb: (data: { download: number }) => void) => window.electronAPI.onSpeedAlert(cb),
  onSchedulerTick: (cb: (data: { nextInSeconds: number }) => void) =>
    window.electronAPI.onSchedulerTick(cb),
  onNetworkInfoUpdate: (cb: (info: LiveNetworkInfo) => void) =>
    window.electronAPI.onNetworkInfoUpdate(cb),

  removeAllListeners: (channel: string) => window.electronAPI.removeAllListeners(channel),

  getAutostart: () => window.electronAPI.getAutostart(),
  setAutostart: (enable: boolean) => window.electronAPI.setAutostart(enable)
}
