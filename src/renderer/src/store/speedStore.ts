import { create } from 'zustand'
import type { SpeedResult, Settings, LiveNetworkInfo } from '../types'

interface SpeedStore {
  results: SpeedResult[]
  lastResult: SpeedResult | null
  isTesting: boolean
  isAlert: boolean
  testError: string | null
  nextTestIn: number
  settings: Settings
  liveNetwork: LiveNetworkInfo | null

  addResult: (result: SpeedResult) => void
  setIsTesting: (v: boolean) => void
  setIsAlert: (v: boolean) => void
  setTestError: (error: string | null) => void
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
  testError: null,
  nextTestIn: 0,
  liveNetwork: null,
  settings: {
    interval_minutes: '15',
    notifications_enabled: 'true'
  },

  addResult: (result) =>
    set((state) => ({
      results: [result, ...state.results].slice(0, 500),
      lastResult: result,
      isAlert: result.is_slow === 1
    })),

  setIsTesting: (v) => set({ isTesting: v }),
  setIsAlert: (v) => set({ isAlert: v }),
  setTestError: (error) => set({ testError: error }),
  setNextTestIn: (seconds) => set({ nextTestIn: seconds }),
  setSettings: (s) => set({ settings: s }),
  setResults: (results) => set({ results, lastResult: results[0] ?? null }),
  setLiveNetwork: (info) => set({ liveNetwork: info })
}))
