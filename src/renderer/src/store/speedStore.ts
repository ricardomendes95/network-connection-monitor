import { create } from 'zustand'
import type { SpeedResult, Settings, LiveNetworkInfo, Network } from '../types'
import { isBelowAnatel, countConsecutiveBelowAnatel, type AnatelEvalInput } from '../lib/anatel'
import { useNetworksStore } from './networksStore'

interface SpeedStore {
  results: SpeedResult[]
  lastResult: SpeedResult | null
  isTesting: boolean
  isAlert: boolean
  testError: string | null
  nextTestIn: number
  settings: Settings
  liveNetwork: LiveNetworkInfo | null

  // Sugestão de reiniciar o roteador após 3 testes seguidos abaixo do
  // mínimo ANATEL (30% do plano em WiFi, 40% em cabo).
  consecutiveBelowAnatel: number
  routerHintDismissed: boolean
  recoveryToastVisible: boolean

  addResult: (result: SpeedResult) => void
  setIsTesting: (v: boolean) => void
  setIsAlert: (v: boolean) => void
  setTestError: (error: string | null) => void
  setNextTestIn: (seconds: number) => void
  setSettings: (s: Settings) => void
  setResults: (results: SpeedResult[]) => void
  setLiveNetwork: (info: LiveNetworkInfo) => void
  dismissRouterHint: () => void
  hideRecoveryToast: () => void
}

export const ROUTER_HINT_THRESHOLD = 3

function toEvalInput(result: SpeedResult, active: Network | null): AnatelEvalInput {
  return {
    downloadMbps: result.download,
    contractedMbps: active?.contracted_speed_mbps ?? 0,
    connectionType: result.connection_type ?? active?.connection_type ?? null,
    fallbackThresholdMbps: active?.slow_threshold_mbps
  }
}

export const useSpeedStore = create<SpeedStore>((set) => ({
  results: [],
  lastResult: null,
  isTesting: false,
  isAlert: false,
  testError: null,
  nextTestIn: 0,
  liveNetwork: null,
  consecutiveBelowAnatel: 0,
  routerHintDismissed: false,
  recoveryToastVisible: false,
  settings: {
    interval_minutes: '15',
    offline_interval_seconds: '30',
    notify_test_overlay: 'true',
    notify_internet_down: 'true',
    notify_internet_restored: 'true'
  },

  addResult: (result) =>
    set((state) => {
      const active = useNetworksStore.getState().active
      const below = isBelowAnatel(toEvalInput(result, active))
      const newStreak = below ? state.consecutiveBelowAnatel + 1 : 0
      // Dispara o toast positivo quando recuperar de uma streak que tinha
      // atingido o threshold, mesmo se o banner já tinha sido dispensado —
      // a recuperação é uma boa notícia independente.
      const hadHintStreak = state.consecutiveBelowAnatel >= ROUTER_HINT_THRESHOLD
      const recoveryToastVisible = !below && hadHintStreak ? true : state.recoveryToastVisible
      return {
        results: [result, ...state.results].slice(0, 500),
        lastResult: result,
        isAlert: result.is_slow === 1,
        consecutiveBelowAnatel: newStreak,
        // Reset do dismiss quando a streak quebra — próxima vez que bater o
        // threshold o banner volta.
        routerHintDismissed: below ? state.routerHintDismissed : false,
        recoveryToastVisible
      }
    }),

  setIsTesting: (v) => set({ isTesting: v }),
  setIsAlert: (v) => set({ isAlert: v }),
  setTestError: (error) => set({ testError: error }),
  setNextTestIn: (seconds) => set({ nextTestIn: seconds }),
  setSettings: (s) => set({ settings: s }),
  setResults: (results) =>
    set(() => {
      const active = useNetworksStore.getState().active
      const inputs = results.map((r) => toEvalInput(r, active))
      return {
        results,
        lastResult: results[0] ?? null,
        consecutiveBelowAnatel: countConsecutiveBelowAnatel(inputs),
        routerHintDismissed: false,
        recoveryToastVisible: false
      }
    }),
  setLiveNetwork: (info) => set({ liveNetwork: info }),
  dismissRouterHint: () => set({ routerHintDismissed: true }),
  hideRecoveryToast: () => set({ recoveryToastVisible: false })
}))
