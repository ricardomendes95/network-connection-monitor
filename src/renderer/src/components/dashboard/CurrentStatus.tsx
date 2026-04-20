import { Download, Upload, Activity, Clock } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { useSpeedStore } from '../../store/speedStore'
import { formatMbps, formatMs, formatDateTime } from '../../lib/utils'

export function CurrentStatus(): JSX.Element {
  const { lastResult, isTesting } = useSpeedStore()

  const metrics = [
    {
      label: 'Download',
      value: formatMbps(lastResult?.download),
      icon: Download,
      color: 'text-blue-400'
    },
    {
      label: 'Upload',
      value: formatMbps(lastResult?.upload),
      icon: Upload,
      color: 'text-green-400'
    },
    {
      label: 'Ping',
      value: formatMs(lastResult?.ping),
      icon: Activity,
      color: 'text-yellow-400'
    },
    {
      label: 'Jitter',
      value: formatMs(lastResult?.jitter ?? null),
      icon: Clock,
      color: 'text-purple-400'
    }
  ]

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className={`text-2xl font-bold ${isTesting ? 'opacity-40' : ''}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {lastResult && (
        <p className="text-xs text-muted-foreground">
          Último teste: {formatDateTime(lastResult.tested_at)}
          {lastResult.server_host && ` — ${lastResult.server_host}`}
        </p>
      )}
    </div>
  )
}
