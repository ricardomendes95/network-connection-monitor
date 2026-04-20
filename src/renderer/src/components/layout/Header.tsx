import { useSpeedStore } from '../../store/speedStore'
import { secondsToMMSS } from '../../lib/utils'
import { Loader2 } from 'lucide-react'

export function Header(): JSX.Element {
  const { isTesting, nextTestIn } = useSpeedStore()

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-6 bg-background">
      <span className="text-sm text-muted-foreground">
        {isTesting ? (
          <span className="flex items-center gap-2 text-primary">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Testando velocidade...
          </span>
        ) : nextTestIn > 0 ? (
          `Próximo teste em ${secondsToMMSS(nextTestIn)}`
        ) : (
          'Aguardando início...'
        )}
      </span>
    </header>
  )
}
