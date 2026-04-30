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

  // Sugestão de reiniciar o roteador após 3 testes slow consecutivos.
  consecutiveSlow: number
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

const ROUTER_HINT_THRESHOLD = 3

function computeConsecutiveSlow(results: SpeedResult[]): number {
  let n = 0
  for (const r of results) {
    if (r.is_slow === 1) n++
    else break
  }
  return n
}

export const useSpeedStore = create<SpeedStore>((set) => ({
  results: [],
  lastResult: null,
  isTesting: false,
  isAlert: false,
  testError: null,
  nextTestIn: 0,
  liveNetwork: null,
  consecutiveSlow: 0,
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
      const isSlow = result.is_slow === 1
      const newStreak = isSlow ? state.consecutiveSlow + 1 : 0
      // Dispara o toast positivo quando recuperar de uma streak que tinha
      // atingido o threshold, mesmo se o banner já tinha sido dispensado —
      // a recuperação é uma boa notícia independente.
      const hadHintStreak = state.consecutiveSlow >= ROUTER_HINT_THRESHOLD
      const recoveryToastVisible = !isSlow && hadHintStreak ? true : state.recoveryToastVisible
      return {
        results: [result, ...state.results].slice(0, 500),
        lastResult: result,
        isAlert: isSlow,
        consecutiveSlow: newStreak,
        // Reset do dismiss quando a streak reseta — assim a próxima vez que
        // bater 3 slow consecutivos o banner volta.
        routerHintDismissed: isSlow ? state.routerHintDismissed : false,
        recoveryToastVisible
      }
    }),

  setIsTesting: (v) => set({ isTesting: v }),
  setIsAlert: (v) => set({ isAlert: v }),
  setTestError: (error) => set({ testError: error }),
  setNextTestIn: (seconds) => set({ nextTestIn: seconds }),
  setSettings: (s) => set({ settings: s }),
  setResults: (results) =>
    set({
      results,
      lastResult: results[0] ?? null,
      consecutiveSlow: computeConsecutiveSlow(results),
      routerHintDismissed: false,
      recoveryToastVisible: false
    }),
  setLiveNetwork: (info) => set({ liveNetwork: info }),
  dismissRouterHint: () => set({ routerHintDismissed: true }),
  hideRecoveryToast: () => set({ recoveryToastVisible: false })
}))
