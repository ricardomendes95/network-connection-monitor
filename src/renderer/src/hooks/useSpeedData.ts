import { useEffect } from 'react'
import { ipc } from '../lib/ipc'
import { useSpeedStore } from '../store/speedStore'
import { useNetworksStore } from '../store/networksStore'

const CHANNELS = [
  'speed:test-started',
  'speed:test-completed',
  'speed:test-failed',
  'speed:alert',
  'speed:scheduler-tick',
  'network:info-update',
  'networks:active-changed'
]

export function useSpeedData(): void {
  const {
    addResult,
    setIsTesting,
    setIsAlert,
    setTestError,
    setNextTestIn,
    setResults,
    setLiveNetwork,
    setSettings
  } = useSpeedStore()
  const refreshNetworks = useNetworksStore((s) => s.refresh)
  const applyNetworkState = useNetworksStore((s) => s.applyState)

  useEffect(() => {
    // Carrega settings reais do banco logo no startup
    ipc.getSettings().then(setSettings).catch(() => {})

    // Carrega lista de redes + estado da rede ativa
    void refreshNetworks()

    // Carrega histórico do dia (escopado na rede ativa pelo main process)
    ipc.getHistory({ days: 1, limit: 200 }).then((r) => setResults(r.rows)).catch(() => {})

    // Solicita info de rede ao vivo imediatamente
    ipc.getCurrentNetworkInfo().then(setLiveNetwork).catch(() => {})

    // Eventos de teste
    ipc.onTestStarted(() => {
      setIsTesting(true)
      setTestError(null)
    })
    ipc.onTestCompleted((result) => {
      setIsTesting(false)
      setTestError(null)
      addResult(result)
      if (result.connection_type && result.network_name) {
        setLiveNetwork({
          connectionType: result.connection_type as 'wifi' | 'wired',
          networkName: result.network_name,
          ispName: result.isp_name ?? ''
        })
      }
    })
    ipc.onTestFailed((data) => {
      setIsTesting(false)
      setTestError(data.error)
    })
    ipc.onSpeedAlert(() => setIsAlert(true))
    ipc.onSchedulerTick((data) => setNextTestIn(data.nextInSeconds))

    // Push do main quando a rede viva é detectada
    ipc.onNetworkInfoUpdate(setLiveNetwork)

    // Push do main quando a rede ativa muda (auto-seleção ou override manual)
    ipc.onActiveNetworkChanged((state) => {
      applyNetworkState(state)
      // Re-fetch do histórico pois o escopo mudou
      ipc
        .getHistory({ days: 1, limit: 200 })
        .then((r) => setResults(r.rows))
        .catch(() => {})
    })

    return () => {
      for (const ch of CHANNELS) ipc.removeAllListeners(ch)
    }
  }, [])
}
