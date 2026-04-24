import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { useSpeedStore } from '../../store/speedStore'
import { useNetworksStore } from '../../store/networksStore'
import { formatTime } from '../../lib/utils'

export function SpeedLineChart(): JSX.Element {
  const { results } = useSpeedStore()
  const threshold = useNetworksStore((s) => s.active?.slow_threshold_mbps ?? 10)

  const data = [...results]
    .reverse()
    .slice(-50)
    .map((r) => ({
      time: formatTime(r.tested_at),
      download: Number(r.download.toFixed(2)),
      upload: Number(r.upload.toFixed(2)),
      ping: Number(r.ping.toFixed(0))
    }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Aguardando dados dos testes...
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
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
        <ReferenceLine
          y={threshold}
          stroke="hsl(var(--destructive))"
          strokeDasharray="4 4"
          label={{ value: `${threshold} Mbps`, fill: 'hsl(var(--destructive))', fontSize: 10 }}
        />
        <Line type="monotone" dataKey="download" stroke="hsl(var(--chart-1))" dot={false} name="Download" strokeWidth={2} />
        <Line type="monotone" dataKey="upload" stroke="hsl(var(--chart-2))" dot={false} name="Upload" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}
