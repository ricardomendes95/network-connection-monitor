import { useEffect } from 'react'
import { ipc } from '../lib/ipc'
import { useSpeedStore } from '../store/speedStore'

const CHANNELS = [
  'speed:test-started',
  'speed:test-completed',
  'speed:test-failed',
  'speed:alert',
  'speed:scheduler-tick',
  'network:info-update'
]

export function useSpeedData(): void {
  const { addResult, setIsTesting, setIsAlert, setTestError, setNextTestIn, setResults, setLiveNetwork, setSettings } =
    useSpeedStore()

  useEffect(() => {
    // Carrega settings reais do banco logo no startup
    ipc.getSettings().then(setSettings).catch(() => {})

    // Carrega histórico do dia
    ipc.getHistory({ days: 1, limit: 200 }).then((r) => setResults(r.rows)).catch(() => {})

    // Solicita info de rede ao vivo imediatamente
    ipc.getCurrentNetworkInfo().then(setLiveNetwork).catch(() => {})

    // Eventos de teste
    ipc.onTestStarted(() => { setIsTesting(true); setTestError(null) })
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
    ipc.onTestFailed((data) => { setIsTesting(false); setTestError(data.error) })
    ipc.onSpeedAlert(() => setIsAlert(true))
    ipc.onSchedulerTick((data) => setNextTestIn(data.nextInSeconds))

    // Recebe push de info de rede enviado pelo main no startup
    ipc.onNetworkInfoUpdate(setLiveNetwork)

    return () => {
      for (const ch of CHANNELS) ipc.removeAllListeners(ch)
    }
  }, [])
}
