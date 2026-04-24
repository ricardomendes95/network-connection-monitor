import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { HourlyHeatmap } from '../components/charts/HourlyHeatmap'
import { DailyBarChart } from '../components/charts/DailyBarChart'
import { WeeklyLineChart } from '../components/charts/WeeklyLineChart'
import { InstabilityReport } from '../components/charts/InstabilityReport'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useNetworksStore } from '../store/networksStore'
import { ipc } from '../lib/ipc'
import { FileText, Image, Loader2 } from 'lucide-react'

const PERIOD_OPTIONS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '14', label: 'Últimos 14 dias' },
  { value: '30', label: 'Últimos 30 dias' }
]

export function Charts(): JSX.Element {
  const [days, setDays] = useState('7')
  const active = useNetworksStore((s) => s.active)
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  async function handleExportPDF(): Promise<void> {
    setExporting('pdf')
    try {
      await ipc.exportPdf()
    } finally {
      setExporting(null)
    }
  }

  async function handleExportPNG(): Promise<void> {
    if (!contentRef.current) return
    setExporting('png')

    const el = contentRef.current
    const parent = el.parentElement as HTMLElement

    // Remover temporariamente overflow para capturar conteúdo completo
    const origOverflow = parent.style.overflow
    const origHeight = parent.style.height
    parent.style.overflow = 'visible'
    parent.style.height = 'auto'

    // Aguardar reflow
    await new Promise((r) => setTimeout(r, 200))

    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#111827',
        scale: 2,
        useCORS: true,
        logging: false,
        width: el.scrollWidth,
        height: el.scrollHeight
      })

      const dataUrl = canvas.toDataURL('image/png')
      await ipc.savePng(dataUrl)
    } finally {
      parent.style.overflow = origOverflow
      parent.style.height = origHeight
      setExporting(null)
    }
  }

  const scopeLabel = active
    ? `Rede: ${active.name}`
    : 'Nenhuma rede selecionada'
  const contracted = active?.contracted_speed_mbps ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Gráficos</h1>
          <p className="text-sm text-muted-foreground">
            Análise de oscilações e horários de lentidão · {scopeLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exporting !== null}
          >
            {exporting === 'pdf' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPNG}
            disabled={exporting !== null}
          >
            {exporting === 'png' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Image className="w-4 h-4 mr-2" />
            )}
            PNG
          </Button>
        </div>
      </div>

      {/* Conteúdo capturado no export PNG */}
      <div ref={contentRef} className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Velocidade ao Longo da Semana</CardTitle>
            <CardDescription className="text-xs">Média diária de download</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyLineChart days={Number(days)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Mapa de Calor — Hora × Dia da Semana</CardTitle>
            <CardDescription className="text-xs">
              Identifica os horários de maior lentidão.
              {contracted > 0
                ? ` Cores relativas ao plano de ${contracted} Mbps (ANATEL).`
                : ' Configure a velocidade contratada da rede para ver cores relativas ao plano.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HourlyHeatmap days={Number(days)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Média por Dia da Semana</CardTitle>
            <CardDescription className="text-xs">Comparativo de download e upload por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyBarChart days={Number(days)} />
          </CardContent>
        </Card>

        <InstabilityReport days={Number(days)} />
      </div>
    </div>
  )
}
