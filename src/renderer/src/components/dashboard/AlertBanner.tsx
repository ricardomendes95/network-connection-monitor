import { AlertTriangle, X } from 'lucide-react'
import { useSpeedStore } from '../../store/speedStore'
import { formatMbps } from '../../lib/utils'

export function AlertBanner(): JSX.Element | null {
  const { isAlert, lastResult, setIsAlert } = useSpeedStore()

  if (!isAlert || !lastResult) return null

  return (
    <div className="flex items-center gap-3 bg-destructive/20 border border-destructive/50 rounded-lg px-4 py-3 mb-4 animate-pulse-slow">
      <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-destructive">Rede lenta detectada!</p>
        <p className="text-xs text-muted-foreground">
          Velocidade atual: {formatMbps(lastResult.download)} — abaixo do limite configurado
        </p>
      </div>
      <button
        onClick={() => setIsAlert(false)}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
