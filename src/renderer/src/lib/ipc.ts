import type {
  Settings,
  HistoryResponse,
  HeatmapPoint,
  DailyPoint,
  WeeklyPoint,
  SpeedResult,
  LiveNetworkInfo,
  Network,
  NetworkCreateInput,
  NetworkUpdateInput,
  ActiveNetworkState,
  NetworkSuggestion
} from '../types'

declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform
      getHistory: (filter?: {
        days?: number
        page?: number
        limit?: number
        networkId?: number | null
      }) => Promise<HistoryResponse>
      getChartData(
        type: 'heatmap',
        days?: number,
        options?: { contracted_mbps?: number; connection_type?: string; networkId?: number | null }
      ): Promise<HeatmapPoint[]>
      getChartData(
        type: 'daily',
        days?: number,
        options?: { contracted_mbps?: number; connection_type?: string; networkId?: number | null }
      ): Promise<DailyPoint[]>
      getChartData(
        type: 'weekly',
        days?: number,
        options?: { contracted_mbps?: number; connection_type?: string; networkId?: number | null }
      ): Promise<WeeklyPoint[]>
      getChartData(
        type: 'timeline',
        days?: number,
        options?: { contracted_mbps?: number; connection_type?: string; networkId?: number | null }
      ): Promise<SpeedResult[]>
      getChartData(
        type: 'instability',
        days?: number,
        options?: { contracted_mbps?: number; connection_type?: string; networkId?: number | null }
      ): Promise<unknown>
      runTestNow: () => Promise<{ queued: boolean }>
      getSettings: () => Promise<Settings>
      setSettings: (settings: Partial<Settings>) => Promise<{ ok: boolean }>

      listNetworks: () => Promise<Network[]>
      getActiveNetwork: () => Promise<ActiveNetworkState>
      createNetwork: (input: NetworkCreateInput) => Promise<Network>
      updateNetwork: (id: number, patch: NetworkUpdateInput) => Promise<Network>
      deleteNetwork: (id: number) => Promise<{ ok: boolean }>
      setActiveNetwork: (id: number) => Promise<ActiveNetworkState>
      suggestNetworkFromLive: () => Promise<NetworkSuggestion>
      onActiveNetworkChanged: (cb: (state: ActiveNetworkState) => void) => void

      getCurrentNetworkInfo: () => Promise<LiveNetworkInfo>
      exportPdf: () => Promise<{ ok: boolean }>
      savePng: (dataUrl: string) => Promise<{ ok: boolean }>
      exportEvidence: (
        days: number,
        opts?: { contracted_mbps?: number; connection_type?: string }
      ) => Promise<{ ok: boolean; count: number }>
      exportEvidencePdf: (
        days: number,
        opts?: { contracted_mbps?: number; connection_type?: string }
      ) => Promise<{ ok: boolean; count: number }>
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
  getHistory: (filter?: {
    days?: number
    page?: number
    limit?: number
    networkId?: number | null
  }) => window.electronAPI.getHistory(filter),

  getChartData: (
    type: string,
    days?: number,
    options?: { contracted_mbps?: number; connection_type?: string; networkId?: number | null }
  ) =>
    (
      window.electronAPI.getChartData as (
        t: string,
        d?: number,
        o?: { contracted_mbps?: number; connection_type?: string; networkId?: number | null }
      ) => Promise<unknown>
    )(type, days, options),

  runTestNow: () => window.electronAPI.runTestNow(),
  getSettings: () => window.electronAPI.getSettings(),
  setSettings: (settings: Partial<Settings>) => window.electronAPI.setSettings(settings),
  getCurrentNetworkInfo: () => window.electronAPI.getCurrentNetworkInfo(),

  listNetworks: () => window.electronAPI.listNetworks(),
  getActiveNetwork: () => window.electronAPI.getActiveNetwork(),
  createNetwork: (input: NetworkCreateInput) => window.electronAPI.createNetwork(input),
  updateNetwork: (id: number, patch: NetworkUpdateInput) =>
    window.electronAPI.updateNetwork(id, patch),
  deleteNetwork: (id: number) => window.electronAPI.deleteNetwork(id),
  setActiveNetwork: (id: number) => window.electronAPI.setActiveNetwork(id),
  suggestNetworkFromLive: () => window.electronAPI.suggestNetworkFromLive(),
  onActiveNetworkChanged: (cb: (state: ActiveNetworkState) => void) =>
    window.electronAPI.onActiveNetworkChanged(cb),

  exportPdf: () => window.electronAPI.exportPdf(),

  savePng: (dataUrl: string) => window.electronAPI.savePng(dataUrl),

  exportEvidence: (days: number, opts?: { contracted_mbps?: number; connection_type?: string }) =>
    window.electronAPI.exportEvidence(days, opts),

  exportEvidencePdf: (days: number, opts?: { contracted_mbps?: number; connection_type?: string }) =>
    window.electronAPI.exportEvidencePdf(days, opts),

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
  setAutostart: (enable: boolean) => window.electronAPI.setAutostart(enable),

  getPlatform: (): NodeJS.Platform => window.electronAPI.platform
}
