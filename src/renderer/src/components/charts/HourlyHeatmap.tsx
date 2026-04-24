import { useEffect, useState } from 'react'
import { ipc } from '../../lib/ipc'
import { dayName, speedColorRelative } from '../../lib/utils'
import type { HeatmapPoint } from '../../types'
import { useNetworksStore } from '../../store/networksStore'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const DAYS = ['0', '1', '2', '3', '4', '5', '6']

interface Props {
  days?: number
}

export function HourlyHeatmap({ days = 7 }: Props): JSX.Element {
  const [data, setData] = useState<HeatmapPoint[]>([])
  const active = useNetworksStore((s) => s.active)

  useEffect(() => {
    ipc.getChartData('heatmap', days).then((rows) => setData(rows as HeatmapPoint[])).catch(() => {})
  }, [days])

  const map = new Map<string, number>()
  for (const p of data) {
    map.set(`${p.day}-${p.hour}`, p.avg_download)
  }

  const contracted = active?.contracted_speed_mbps ?? 0
  const connType = active?.connection_type ?? 'auto'
  const isWired = connType === 'wired'
  const hasContracted = contracted > 0

  const legend = hasContracted
    ? isWired
      ? [
          { label: `< 40% (${Math.round(contracted * 0.4)} Mbps)`, color: '#ef4444' },
          { label: `40–80% (${Math.round(contracted * 0.4)}–${Math.round(contracted * 0.8)} Mbps)`, color: '#eab308' },
          { label: `≥ 80% (${Math.round(contracted * 0.8)} Mbps)`, color: '#22c55e' }
        ]
      : [
          { label: `< 30% (${Math.round(contracted * 0.3)} Mbps)`, color: '#ef4444' },
          { label: `30–60% (${Math.round(contracted * 0.3)}–${Math.round(contracted * 0.6)} Mbps)`, color: '#eab308' },
          { label: `≥ 60% (${Math.round(contracted * 0.6)} Mbps)`, color: '#22c55e' }
        ]
    : [
        { label: '< 5 Mbps', color: '#ef4444' },
        { label: '5–10 Mbps', color: '#f97316' },
        { label: '10–20 Mbps', color: '#eab308' },
        { label: '20–50 Mbps', color: '#84cc16' },
        { label: '> 50 Mbps', color: '#22c55e' }
      ]

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Dados insuficientes para exibir o heatmap.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex items-center mb-1">
          <div className="w-10" />
          {HOURS.map((h) => (
            <div key={h} className="w-7 text-center text-[9px] text-muted-foreground">
              {h}
            </div>
          ))}
        </div>
        {DAYS.map((day) => (
          <div key={day} className="flex items-center mb-0.5">
            <div className="w-10 text-[10px] text-muted-foreground text-right pr-2">{dayName(day)}</div>
            {HOURS.map((hour) => {
              const val = map.get(`${day}-${hour}`)
              const bg = val != null
                ? speedColorRelative(val, contracted, connType)
                : '#2d3748'
              const opacity = val != null ? 0.85 : 0.3
              const pctLabel = hasContracted && val != null
                ? ` (${Math.round((val / contracted) * 100)}% do plano)`
                : ''
              return (
                <div
                  key={hour}
                  className="w-7 h-5 rounded-sm mx-px transition-all"
                  style={{ background: bg, opacity }}
                  title={val != null ? `${dayName(day)} ${hour}h: ${val.toFixed(1)} Mbps${pctLabel}` : 'Sem dados'}
                />
              )
            })}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3 mt-3 ml-10">
          {legend.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
          {hasContracted && (
            <span className="text-[10px] text-muted-foreground ml-1">
              — baseado em {contracted} Mbps contratados ({isWired ? 'Cabo / ANATEL' : 'WiFi'})
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
