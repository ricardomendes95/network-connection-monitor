import { PlayCircle, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { AlertBanner } from '../components/dashboard/AlertBanner'
import { TestErrorBanner } from '../components/dashboard/TestErrorBanner'
import { NetworkMismatchBanner } from '../components/dashboard/NetworkMismatchBanner'
import { UncataloguedNetworkBanner } from '../components/dashboard/UncataloguedNetworkBanner'
import { CurrentStatus } from '../components/dashboard/CurrentStatus'
import { SpeedGauge } from '../components/dashboard/SpeedGauge'
import { NetworkEvaluation } from '../components/dashboard/NetworkEvaluation'
import { SpeedLineChart } from '../components/charts/SpeedLineChart'
import { useSpeedStore } from '../store/speedStore'
import { ipc } from '../lib/ipc'

export function Dashboard(): JSX.Element {
  const { isTesting } = useSpeedStore()

  const handleRunNow = async (): Promise<void> => {
    await ipc.runTestNow()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Velocidade de internet em tempo real</p>
        </div>
        <Button onClick={handleRunNow} disabled={isTesting} size="sm">
          {isTesting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Testando...
            </>
          ) : (
            <>
              <PlayCircle className="w-4 h-4 mr-2" />
              Testar Agora
            </>
          )}
        </Button>
      </div>

      <NetworkMismatchBanner />
      <UncataloguedNetworkBanner />
      <AlertBanner />
      <TestErrorBanner />

      <CurrentStatus />

      <NetworkEvaluation />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Velocidade Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <SpeedGauge />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Oscilação — Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <SpeedLineChart />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
