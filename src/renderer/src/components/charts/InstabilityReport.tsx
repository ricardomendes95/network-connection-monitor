import { useEffect, useState } from 'react'
import { ipc } from '../../lib/ipc'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import type { InstabilityData, DailyHourSlot, DailyInterval, Settings } from '../../types'
import { AlertTriangle, Cable, Wifi, CheckCircle2 } from 'lucide-react'

interface Props {
  days: number
  settings: Settings
}

/**
 * Para cada dia, encontra o intervalo de maior instabilidade.
 * Se houver múltiplos blocos no dia, retorna o período completo (do primeiro ao último bloco)
 * quando os blocos cobrem mais de metade do dia — caso contrário, retorna o bloco mais denso.
 */
function computeDailyIntervals(dailyHourly: DailyHourSlot[]): Map<string, DailyInterval> {
  const byDay = new Map<string, DailyHourSlot[]>()
  for (const slot of dailyHourly) {
    if (!byDay.has(slot.day)) byDay.set(slot.day, [])
    byDay.get(slot.day)!.push(slot)
  }

  const result = new Map<string, DailyInterval>()

  for (const [day, slots] of byDay) {
    const sorted = [...slots].sort((a, b) => Number(a.hour) - Number(b.hour))

    // Agrupa em blocos contíguos (gap de até 2 horas entre slots)
    const blocks: DailyHourSlot[][] = []
    let current: DailyHourSlot[] = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
      if (Number(sorted[i].hour) - Number(sorted[i - 1].hour) <= 2) {
        current.push(sorted[i])
      } else {
        blocks.push(current)
        current = [sorted[i]]
      }
    }
    blocks.push(current)

    const totalSlowAcrossBlocks = blocks.reduce(
      (s, b) => s + b.reduce((bs, x) => bs + x.slow_count, 0),
      0
    )

    // Período total: do primeiro ao último slot instável do dia
    const firstHour = Number(sorted[0].hour)
    const lastHour = Number(sorted.at(-1)!.hour)
    const spanHours = lastHour - firstHour

    // Se instabilidade espalha por > 4 horas ou tem mais de 1 bloco distinto → mostra período maior
    const showFullSpan = blocks.length > 1 && spanHours > 4

    let chosen: DailyHourSlot[]
    if (showFullSpan) {
      chosen = sorted // todos os slots instáveis do dia
    } else {
      // Bloco com mais testes abaixo do threshold
      chosen = blocks.reduce((a, b) => {
        const aTotal = a.reduce((s, x) => s + x.slow_count, 0)
        const bTotal = b.reduce((s, x) => s + x.slow_count, 0)
        return bTotal > aTotal ? b : a
      })
    }

    result.set(day, {
      day,
      startHour: chosen[0].hour,
      endHour: chosen.at(-1)!.hour,
      avgDownload: chosen.reduce((s, x) => s + x.avg_download, 0) / chosen.length,
      minDownload: Math.min(...chosen.map((x) => x.min_download)),
      maxDownload: Math.max(...chosen.map((x) => x.max_download)),
      slowCount: totalSlowAcrossBlocks,
      totalTests: sorted.reduce((s, x) => s + x.total, 0)
    })
  }

  return result
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function connLabel(type: string | null): string {
  if (type === 'wifi') return 'WiFi'
  if (type === 'wired') return 'Cabo'
  return 'Desconhecido'
}

function connIcon(type: string | null): JSX.Element {
  if (type === 'wifi') return <Wifi className="w-3.5 h-3.5" />
  return <Cable className="w-3.5 h-3.5" />
}

export function InstabilityReport({ days, settings }: Props): JSX.Element {
  const [data, setData] = useState<InstabilityData | null>(null)

  const contracted = Number(settings.contracted_speed_mbps ?? 0)
  const connType = settings.connection_type ?? 'auto'
  const ispName = settings.isp_name || 'Provedor'

  useEffect(() => {
    ipc
      .getChartData('instability', days, {
        contracted_mbps: contracted > 0 ? contracted : undefined,
        connection_type: connType !== 'auto' ? connType : undefined
      })
      .then((d) => setData(d as unknown as InstabilityData))
      .catch(() => {})
  }, [days, contracted, connType])

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Carregando relatório...
        </CardContent>
      </Card>
    )
  }

  const { slowDays, connectionComparison, dailyHourly, totalSlowDays, anatelThreshold } = data
  const intervalsMap = computeDailyIntervals(dailyHourly ?? [])

  const best =
    connectionComparison.length > 1
      ? connectionComparison.reduce((a, b) => (a.avg_download > b.avg_download ? a : b))
      : null

  // Label do critério usado
  const thresholdLabel =
    contracted > 0
      ? connType === 'wifi'
        ? `30% do plano (${(contracted * 0.3).toFixed(0)} Mbps — mínimo WiFi)`
        : `40% do plano (${(contracted * 0.4).toFixed(0)} Mbps — mínimo ANATEL cabo)`
      : `${anatelThreshold} Mbps (threshold configurado)`

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <CardTitle className="text-sm font-medium">Relatório de Instabilidade</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Dossiê para questionar o {ispName} · últimos {days} dias ·{' '}
          {totalSlowDays} de {slowDays.length} dias com instabilidade detectada
          {contracted > 0 && ` · Plano contratado: ${contracted} Mbps`}
          {' · '}Critério: abaixo de {thresholdLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {slowDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dado encontrado para o período.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[175px]">
                    Data
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Resultado
                  </th>
                </tr>
              </thead>
              <tbody>
                {slowDays.map((d) => {
                  const interval = intervalsMap.get(d.day)
                  const hasInstability = d.slow_count > 0 && interval != null
                  const pct =
                    contracted > 0 && interval
                      ? Math.round((interval.avgDownload / contracted) * 100)
                      : null
                  const sameHour = interval && interval.startHour === interval.endHour

                  return (
                    <tr
                      key={d.day}
                      className={`border-b border-border last:border-0 ${
                        hasInstability ? 'bg-destructive/5' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap align-top pt-3">
                        {formatDate(d.day)}
                      </td>
                      <td className="px-3 py-2.5">
                        {hasInstability ? (
                          <span>
                            {sameHour
                              ? `Às ${interval.startHour}:00`
                              : `Entre ${interval.startHour}:00 e ${interval.endHour}:59`}
                            {', '}
                            resultados entre{' '}
                            <span className="font-medium text-destructive">
                              {interval.minDownload.toFixed(1)} Mbps
                            </span>{' '}
                            e{' '}
                            <span className="font-medium">
                              {interval.maxDownload.toFixed(1)} Mbps
                            </span>
                            {', '}
                            em média de{' '}
                            <span className="font-medium">
                              {interval.avgDownload.toFixed(1)} Mbps
                            </span>{' '}
                            de download
                            {pct !== null && (
                              <span className="text-muted-foreground"> ({pct}% do plano)</span>
                            )}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            Estável — sem quedas detectadas ({d.total} testes realizados)
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {connectionComparison.length > 0 && (
          <div className="pt-1">
            <p className="text-xs font-medium mb-2">Comparativo de conexão</p>
            <div className="grid grid-cols-2 gap-2">
              {connectionComparison.map((c) => (
                <div
                  key={c.connection_type ?? 'null'}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                    best?.connection_type === c.connection_type
                      ? 'border-green-500/40 bg-green-500/10'
                      : 'border-border'
                  }`}
                >
                  <span className="text-muted-foreground">{connIcon(c.connection_type)}</span>
                  <div>
                    <div className="font-medium">{connLabel(c.connection_type)}</div>
                    <div className="text-muted-foreground">
                      {c.avg_download.toFixed(1)} Mbps · {c.total} testes
                    </div>
                  </div>
                  {best?.connection_type === c.connection_type && connectionComparison.length > 1 && (
                    <span className="ml-auto text-[9px] text-green-500 font-medium">MELHOR</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground border-t border-border pt-3">
          Gerado em{' '}
          {new Date().toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}{' '}
          · Network Connection Monitor
        </p>
      </CardContent>
    </Card>
  )
}
