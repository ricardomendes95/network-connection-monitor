import { Wifi, Cable, Info, Signal } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { useSpeedStore } from '../../store/speedStore'
import { useNetworksStore } from '../../store/networksStore'
import { evaluateSpeed } from '../../lib/utils'

const COLOR_CLASSES: Record<string, { bg: string; text: string; bar: string }> = {
  green:  { bg: 'bg-green-500/10 border-green-500/30',  text: 'text-green-400',  bar: 'bg-green-500'  },
  yellow: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', bar: 'bg-yellow-500' },
  orange: { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400', bar: 'bg-orange-500' },
  red:    { bg: 'bg-red-500/10 border-red-500/30',       text: 'text-red-400',    bar: 'bg-red-500'    }
}

export function NetworkEvaluation(): JSX.Element {
  const { lastResult, liveNetwork } = useSpeedStore()
  const active = useNetworksStore((s) => s.active)

  // liveNetwork tem prioridade: é detectado ao vivo no startup e a cada teste
  // Garante que o tipo correto (WiFi/Cabo) é mostrado mesmo sem resultado armazenado
  const connType = liveNetwork?.connectionType ?? lastResult?.connection_type ?? active?.connection_type ?? 'wired'
  const networkName = liveNetwork?.networkName ?? lastResult?.network_name ?? null
  const ispName = active?.isp_name || liveNetwork?.ispName || lastResult?.isp_name || null

  const contracted = active?.contracted_speed_mbps ?? 0
  const evaluation = lastResult
    ? evaluateSpeed(lastResult.download, contracted, connType)
    : null

  const colors = COLOR_CLASSES[evaluation?.color ?? 'orange']
  const barWidth = evaluation ? Math.min(evaluation.percentage, 100) : 0
  const isWifi = connType === 'wifi'
  const ConnIcon = isWifi ? Wifi : Cable

  return (
    <Card className={`border ${evaluation ? colors.bg : 'border-border'}`}>
      <CardContent className="pt-4 pb-4">

        {/* Linha de rede: tipo + nome + ISP */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <div className="flex items-center gap-1.5 bg-muted/60 rounded-md px-2 py-1">
            <ConnIcon className={`w-3.5 h-3.5 ${isWifi ? 'text-blue-400' : 'text-muted-foreground'}`} />
            <span className="text-xs font-medium">{isWifi ? 'WiFi' : 'Cabeada'}</span>
          </div>

          {active && (
            <div className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-md px-2 py-1">
              <span className="text-xs font-medium text-primary" title={active.ssid}>
                {active.name}
              </span>
            </div>
          )}

          {isWifi && networkName && networkName !== 'Desconhecido' && networkName !== active?.ssid && (
            <div className="flex items-center gap-1 bg-muted/60 rounded-md px-2 py-1">
              <Signal className="w-3 h-3 text-blue-400" />
              <span className="text-xs font-medium" title={networkName}>
                {networkName}
              </span>
            </div>
          )}

          {!isWifi && networkName && networkName !== 'Desconhecido' && networkName !== 'Ethernet' && networkName !== active?.ssid && (
            <span className="text-xs text-muted-foreground">{networkName}</span>
          )}

          {ispName && ispName !== 'Desconhecido' && (
            <span
              className="text-xs text-muted-foreground truncate max-w-[200px]"
              title={ispName}
            >
              · {ispName.length > 35 ? ispName.slice(0, 35) + '…' : ispName}
            </span>
          )}
        </div>

        {/* Avaliação de velocidade */}
        {evaluation ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-sm font-semibold ${colors.text}`}>{evaluation.label}</p>
              {contracted > 0 && (
                <span className={`text-xl font-bold ${colors.text}`}>
                  {evaluation.percentage.toFixed(0)}%
                </span>
              )}
            </div>

            {contracted > 0 && (
              <div className="space-y-1 mb-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{lastResult!.download.toFixed(1)} Mbps obtidos</span>
                  <span>de {contracted} Mbps contratados</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">{evaluation.detail}</p>

            {evaluation.anatelRule && (
              <div className="flex items-center gap-1 mt-2">
                <Info className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground">{evaluation.anatelRule}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Clique em <strong>Testar Agora</strong> para ver a avaliação da velocidade.
          </p>
        )}

      </CardContent>
    </Card>
  )
}
