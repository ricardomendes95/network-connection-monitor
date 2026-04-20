import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'
import { useSpeedStore } from '../../store/speedStore'
import { speedColor } from '../../lib/utils'

const MAX_SPEED = 200

export function SpeedGauge(): JSX.Element {
  const { lastResult, isTesting } = useSpeedStore()
  const download = lastResult?.download ?? 0
  const pct = Math.min((download / MAX_SPEED) * 100, 100)
  const color = speedColor(download)

  const data = [{ value: pct, fill: color }]

  return (
    <div className="flex flex-col items-center justify-center h-48">
      <div className="relative w-40 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            startAngle={210}
            endAngle={-30}
            data={data}
            barSize={14}
          >
            <RadialBar dataKey="value" cornerRadius={7} background={{ fill: 'hsl(var(--muted))' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${isTesting ? 'opacity-30' : ''}`} style={{ color }}>
            {isTesting ? '...' : download.toFixed(0)}
          </span>
          <span className="text-xs text-muted-foreground">Mbps</span>
        </div>
      </div>
    </div>
  )
}
