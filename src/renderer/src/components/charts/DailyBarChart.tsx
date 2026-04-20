import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { ipc } from '../../lib/ipc'
import { dayName } from '../../lib/utils'
import type { DailyPoint } from '../../types'
import { useSpeedStore } from '../../store/speedStore'

interface Props {
  days?: number
}

export function DailyBarChart({ days = 30 }: Props): JSX.Element {
  const [data, setData] = useState<DailyPoint[]>([])
  const threshold = Number(useSpeedStore.getState().settings.slow_threshold_mbps)

  useEffect(() => {
    ipc.getChartData('daily', days).then((rows) => setData(rows as DailyPoint[])).catch(() => {})
  }, [days])

  const chartData = data.map((d) => ({
    day: dayName(d.day_of_week),
    'Média Download': Number(d.avg_download.toFixed(2)),
    'Média Upload': Number(d.avg_upload.toFixed(2)),
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
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
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
        <Bar dataKey="Média Download" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Média Upload" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Mínimo" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
