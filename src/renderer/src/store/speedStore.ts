import { create } from 'zustand'
import type { SpeedResult, Settings, LiveNetworkInfo } from '../types'

interface SpeedStore {
  results: SpeedResult[]
  lastResult: SpeedResult | null
  isTesting: boolean
  isAlert: boolean
  nextTestIn: number
  settings: Settings
  liveNetwork: LiveNetworkInfo | null

  addResult: (result: SpeedResult) => void
  setIsTesting: (v: boolean) => void
  setIsAlert: (v: boolean) => void
  setNextTestIn: (seconds: number) => void
  setSettings: (s: Settings) => void
  setResults: (results: SpeedResult[]) => void
  setLiveNetwork: (info: LiveNetworkInfo) => void
}

export const useSpeedStore = create<SpeedStore>((set) => ({
  results: [],
  lastResult: null,
  isTesting: false,
  isAlert: false,
  nextTestIn: 0,
  liveNetwork: null,
  settings: {
    interval_minutes: '15',
    slow_threshold_mbps: '10',
    notifications_enabled: 'true',
    contracted_speed_mbps: '100',
    connection_type: 'auto',
    isp_name: ''
  },

  addResult: (result) =>
    set((state) => ({
      results: [result, ...state.results].slice(0, 500),
      lastResult: result,
      isAlert: result.is_slow === 1
    })),

  setIsTesting: (v) => set({ isTesting: v }),
  setIsAlert: (v) => set({ isAlert: v }),
  setNextTestIn: (seconds) => set({ nextTestIn: seconds }),
  setSettings: (s) => set({ settings: s }),
  setResults: (results) => set({ results, lastResult: results[0] ?? null }),
  setLiveNetwork: (info) => set({ liveNetwork: info })
}))
