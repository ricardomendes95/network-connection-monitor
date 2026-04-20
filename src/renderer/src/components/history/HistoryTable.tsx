import { Wifi, Cable } from 'lucide-react'
import { Badge } from '../ui/badge'
import { formatMbps, formatMs, formatDateTime, evaluateSpeed } from '../../lib/utils'
import type { SpeedResult } from '../../types'
import { useSpeedStore } from '../../store/speedStore'

interface Props {
  results: SpeedResult[]
}

const EVAL_BADGE: Record<string, { variant: 'success' | 'warning' | 'destructive' | 'outline'; label: string }> = {
  green: { variant: 'success', label: '' },
  yellow: { variant: 'warning', label: '' },
  orange: { variant: 'outline', label: '' },
  red: { variant: 'destructive', label: '' }
}

export function HistoryTable({ results }: Props): JSX.Element {
  const { settings } = useSpeedStore()
  const contracted = Number(settings.contracted_speed_mbps ?? 0)

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Nenhum resultado encontrado.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left pb-2 pr-3 font-medium text-muted-foreground whitespace-nowrap">Data/Hora</th>
            <th className="text-left pb-2 pr-3 font-medium text-muted-foreground">Rede / Provedor</th>
            <th className="text-right pb-2 pr-3 font-medium text-muted-foreground">Download</th>
            <th className="text-right pb-2 pr-3 font-medium text-muted-foreground">Upload</th>
            <th className="text-right pb-2 pr-3 font-medium text-muted-foreground">Ping</th>
            <th className="text-center pb-2 font-medium text-muted-foreground">Avaliação</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const eval_ = evaluateSpeed(r.download, contracted, r.connection_type)
            const badge = EVAL_BADGE[eval_.color]
            const ConnIcon = r.connection_type === 'wifi' ? Wifi : Cable

            return (
              <tr key={r.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">
                  {formatDateTime(r.tested_at)}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <ConnIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate max-w-[160px]" title={r.network_name ?? '—'}>
                        {r.network_name ?? '—'}
                      </p>
                      {r.isp_name && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[160px]" title={r.isp_name}>
                          {r.isp_name}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-right font-medium">{formatMbps(r.download)}</td>
                <td className="py-2.5 pr-3 text-right text-muted-foreground">{formatMbps(r.upload)}</td>
                <td className="py-2.5 pr-3 text-right text-muted-foreground">{formatMs(r.ping)}</td>
                <td className="py-2.5 text-center">
                  <Badge variant={badge.variant} title={eval_.detail}>
                    {contracted > 0 ? `${eval_.percentage.toFixed(0)}% — ${eval_.label}` : eval_.label}
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
