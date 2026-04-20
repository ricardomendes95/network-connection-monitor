import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { ipc } from '../../lib/ipc'
import { useSpeedStore } from '../../store/speedStore'
import type { WeeklyPoint } from '../../types'

interface Props {
  days?: number
}

export function WeeklyLineChart({ days = 7 }: Props): JSX.Element {
  const [data, setData] = useState<WeeklyPoint[]>([])
  const threshold = Number(useSpeedStore.getState().settings.slow_threshold_mbps)

  useEffect(() => {
    ipc.getChartData('weekly', days).then((rows) => setData(rows as WeeklyPoint[])).catch(() => {})
  }, [days])

  const chartData = data.map((d) => ({
    day: d.day.slice(5),
    'Média': Number(d.avg_download.toFixed(2)),
    'Mínimo': Number(d.min_download.toFixed(2))
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Dados insuficientes para exibir o gráfico.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <defs>
          <linearGradient id="gradAvg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit=" Mb" />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px'
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <ReferenceLine y={threshold} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
        <Area type="monotone" dataKey="Média" stroke="hsl(var(--chart-1))" fill="url(#gradAvg)" strokeWidth={2} />
        <Area type="monotone" dataKey="Mínimo" stroke="hsl(var(--chart-4))" fill="none" strokeDasharray="4 2" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
