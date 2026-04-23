import { useEffect, useState } from 'react'
import { ipc } from '../../lib/ipc'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import type { InstabilityData, DailyHourSlot, DailyInterval, Settings } from '../../types'
import { AlertTriangle, Cable, Wifi, CheckCircle2, FileDown, FileText } from 'lucide-react'

interface Props {
  days: number
  settings: Settings
}

// Retorna o intervalo onde a lentidão foi mais concentrada no dia.
// Seleciona os slots mais lentos (cobrindo no mínimo MIN_TESTS testes individuais).
// Se esses slots forem próximos entre si (span ≤ 4h, sem gaps > 2h), mostra esse range.
// Caso contrário, usa janela deslizante de 3h para encontrar o período com mais slow_count.
function computeDailyIntervals(dailyHourly: DailyHourSlot[]): Map<string, DailyInterval> {
  const byDay = new Map<string, DailyHourSlot[]>()
  for (const slot of dailyHourly) {
    if (!byDay.has(slot.day)) byDay.set(slot.day, [])
    byDay.get(slot.day)!.push(slot)
  }

  const result = new Map<string, DailyInterval>()
  const MIN_TESTS = 5

  for (const [day, slots] of byDay) {
    const bySpeed = [...slots].sort((a, b) => a.avg_download - b.avg_download)

    const worstSlots: DailyHourSlot[] = []
    let testCount = 0
    for (const slot of bySpeed) {
      worstSlots.push(slot)
      testCount += slot.total
      if (testCount >= MIN_TESTS) break
    }

    const worstByHour = [...worstSlots].sort((a, b) => Number(a.hour) - Number(b.hour))
    const span = Number(worstByHour.at(-1)!.hour) - Number(worstByHour[0].hour)

    let hasGap = false
    for (let i = 1; i < worstByHour.length; i++) {
      if (Number(worstByHour[i].hour) - Number(worstByHour[i - 1].hour) > 2) {
        hasGap = true
        break
      }
    }

    let chosen: DailyHourSlot[]
    if (span <= 4 && !hasGap) {
      chosen = worstByHour
    } else {
      const allByHour = [...slots].sort((a, b) => Number(a.hour) - Number(b.hour))
      let bestScore = -1
      chosen = [allByHour[0]]

      for (const anchor of allByHour) {
        const wStart = Number(anchor.hour)
        const wEnd = wStart + 3
        const windowSlots = allByHour.filter(
          (s) => Number(s.hour) >= wStart && Number(s.hour) <= wEnd
        )
        const score = windowSlots.reduce((sum, s) => sum + s.slow_count, 0)
        if (score > bestScore) {
          bestScore = score
          chosen = windowSlots
        }
      }
    }

    result.set(day, {
      day,
      startHour: chosen[0].hour,
      endHour: chosen.at(-1)!.hour,
      avgDownload: chosen.reduce((s, x) => s + x.avg_download, 0) / chosen.length,
      minDownload: Math.min(...chosen.map((x) => x.min_download)),
      maxDownload: Math.max(...chosen.map((x) => x.max_download)),
      slowCount: slots.reduce((s, x) => s + x.slow_count, 0),
      totalTests: slots.reduce((s, x) => s + x.total, 0)
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
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const contracted = Number(settings.contracted_speed_mbps ?? 0)
  const connType = settings.connection_type ?? 'auto'
  const ispName = settings.isp_name || 'Provedor'

  const evidenceOpts = {
    contracted_mbps: contracted > 0 ? contracted : undefined,
    connection_type: connType !== 'auto' ? connType : undefined
  }

  async function handleExportEvidence(): Promise<void> {
    setExporting(true)
    try { await ipc.exportEvidence(days, evidenceOpts) } finally { setExporting(false) }
  }

  async function handleExportPdf(): Promise<void> {
    setExportingPdf(true)
    try { await ipc.exportEvidencePdf(days, evidenceOpts) } finally { setExportingPdf(false) }
  }

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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <CardTitle className="text-sm font-medium">Relatório de Instabilidade</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf || exporting}
              title="Exportar dossiê em PDF (tabelas, estatísticas, para ANATEL / PROCON)"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-3.5 h-3.5" />
              {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
            </button>
            <button
              onClick={handleExportEvidence}
              disabled={exporting || exportingPdf}
              title="Exportar dados brutos em CSV (Excel / LibreOffice)"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="w-3.5 h-3.5" />
              {exporting ? 'Exportando...' : 'CSV'}
            </button>
          </div>
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
