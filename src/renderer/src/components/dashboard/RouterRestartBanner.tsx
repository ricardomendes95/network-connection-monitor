import { Router, X } from 'lucide-react'
import { useSpeedStore, ROUTER_HINT_THRESHOLD } from '../../store/speedStore'

export function RouterRestartBanner(): JSX.Element | null {
  const { consecutiveBelowAnatel, routerHintDismissed, dismissRouterHint } = useSpeedStore()

  if (consecutiveBelowAnatel < ROUTER_HINT_THRESHOLD || routerHintDismissed) return null

  return (
    <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-lg px-4 py-3 mb-4">
      <Router className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-300">
          Sua conexão tá abaixo do mínimo ANATEL há {consecutiveBelowAnatel} testes seguidos.
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Já experimentou reiniciar o roteador? Caso ainda não tenha feito, vale
          tentar — a gente checa no próximo teste se a internet voltou ao normal.
        </p>
      </div>
      <button
        onClick={dismissRouterHint}
        aria-label="Dispensar"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
