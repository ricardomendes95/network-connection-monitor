import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select'
import { useSettings } from '../hooks/useSettings'
import { Check, Network } from 'lucide-react'
import { ipc } from '../lib/ipc'

const INTERVAL_OPTIONS = [
  { value: '1', label: 'A cada 1 min', note: 'Extremamente frequente, uso intenso de banda — use apenas para diagnóstico' },
  { value: '2', label: 'A cada 2 min', note: 'Muito frequente, consumo alto de banda' },
  { value: '3', label: 'A cada 3 min', note: 'Frequente, consumo alto de banda' },
  { value: '5', label: 'A cada 5 min', note: 'Frequente, usa mais banda' },
  { value: '10', label: 'A cada 10 min', note: '' },
  { value: '15', label: 'A cada 15 min (recomendado)', note: 'Padrão da indústria para monitoramento ISP' },
  { value: '20', label: 'A cada 20 min', note: '' },
  { value: '30', label: 'A cada 30 min', note: '' },
  { value: '45', label: 'A cada 45 min', note: '' },
  { value: '60', label: 'A cada 1 hora', note: '' },
  { value: '120', label: 'A cada 2 horas', note: '' },
  { value: '240', label: 'A cada 4 horas', note: '' }
]

const OFFLINE_INTERVAL_OPTIONS = [
  { value: '5', label: 'A cada 5 segundos', note: 'Detecção quase instantânea — uso intenso enquanto offline' },
  { value: '15', label: 'A cada 15 segundos', note: '' },
  { value: '30', label: 'A cada 30 segundos (recomendado)', note: 'Equilíbrio entre rapidez e economia' },
  { value: '60', label: 'A cada 1 min', note: '' },
  { value: '300', label: 'A cada 5 min', note: '' },
  { value: '600', label: 'A cada 10 min', note: '' },
  { value: '900', label: 'A cada 15 min', note: '' },
  { value: '1200', label: 'A cada 20 min', note: '' },
  { value: '1800', label: 'A cada 30 min', note: '' },
  { value: '2700', label: 'A cada 45 min', note: '' },
  { value: '3600', label: 'A cada 1 hora', note: '' },
  { value: '7200', label: 'A cada 2 horas', note: '' },
  { value: '14400', label: 'A cada 4 horas', note: '' }
]

function getAutostartLabel(platform: NodeJS.Platform): string {
  switch (platform) {
    case 'win32':
      return 'Iniciar com o Windows'
    case 'darwin':
      return 'Iniciar com o macOS'
    case 'linux':
      return 'Iniciar com o sistema (Linux)'
    default:
      return 'Iniciar com o sistema'
  }
}

export function SettingsPage(): JSX.Element {
  const navigate = useNavigate()
  const { settings, saveSettings } = useSettings()
  const [saved, setSaved] = useState(false)

  const [interval, setInterval] = useState(settings.interval_minutes)
  const [offlineInterval, setOfflineInterval] = useState(
    settings.offline_interval_seconds ?? '30'
  )
  const [notifyTestOverlay, setNotifyTestOverlay] = useState(
    settings.notify_test_overlay !== 'false'
  )
  const [notifyDown, setNotifyDown] = useState(
    settings.notify_internet_down !== 'false'
  )
  const [notifyRestored, setNotifyRestored] = useState(
    settings.notify_internet_restored !== 'false'
  )
  const [autostart, setAutostart] = useState(false)
  const autostartLabel = getAutostartLabel(ipc.getPlatform())

  useEffect(() => {
    setInterval(settings.interval_minutes)
    setOfflineInterval(settings.offline_interval_seconds ?? '30')
    setNotifyTestOverlay(settings.notify_test_overlay !== 'false')
    setNotifyDown(settings.notify_internet_down !== 'false')
    setNotifyRestored(settings.notify_internet_restored !== 'false')
  }, [settings])

  useEffect(() => {
    ipc.getAutostart().then(setAutostart).catch(() => {})
  }, [])

  const handleSave = async (): Promise<void> => {
    await Promise.all([
      saveSettings({
        interval_minutes: interval,
        offline_interval_seconds: offlineInterval,
        notify_test_overlay: String(notifyTestOverlay),
        notify_internet_down: String(notifyDown),
        notify_internet_restored: String(notifyRestored)
      }),
      ipc.setAutostart(autostart)
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const selectedInterval = INTERVAL_OPTIONS.find((o) => o.value === interval)
  const selectedOfflineInterval = OFFLINE_INTERVAL_OPTIONS.find(
    (o) => o.value === offlineInterval
  )

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Preferências globais do monitor. Provedor, plano e limiar de alerta são configurados{' '}
          <button
            className="text-primary underline underline-offset-2"
            onClick={() => navigate('/networks')}
          >
            por rede
          </button>
          .
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4 flex items-start gap-3">
          <Network className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Configurações por rede</strong> (provedor, plano
              contratado e limiar de lentidão) ficam na página Redes — cada rede pode ter valores
              diferentes.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => navigate('/networks')}
            >
              Abrir página de Redes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* TESTES AUTOMÁTICOS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Testes Automáticos</CardTitle>
          <CardDescription className="text-xs">
            Intervalo padrão da indústria para monitoramento de ISP é 15 minutos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Intervalo quando com internet</Label>
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedInterval?.note && (
              <p className="text-xs text-muted-foreground">{selectedInterval.note}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Intervalo quando sem internet</Label>
            <Select value={offlineInterval} onValueChange={setOfflineInterval}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFFLINE_INTERVAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedOfflineInterval?.note ||
                'Quando a conexão cai, faz sentido testar mais rápido para detectar o retorno'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ALERTAS GLOBAIS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Notificações</CardTitle>
          <CardDescription className="text-xs">
            Escolha quais avisos você quer receber. Por padrão, todos vêm ligados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Toast a cada teste</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mostrar o overlay com o resultado do teste no canto da tela
              </p>
            </div>
            <Switch
              checked={notifyTestOverlay}
              onCheckedChange={setNotifyTestOverlay}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Aviso quando a internet cair</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notificação do sistema ao detectar perda de conexão
              </p>
            </div>
            <Switch checked={notifyDown} onCheckedChange={setNotifyDown} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Aviso quando a internet voltar</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notificação do sistema quando a conexão for restaurada
              </p>
            </div>
            <Switch
              checked={notifyRestored}
              onCheckedChange={setNotifyRestored}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{autostartLabel}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Abrir o monitor automaticamente ao ligar o computador
              </p>
            </div>
            <Switch checked={autostart} onCheckedChange={setAutostart} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        {saved ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            Salvo com sucesso!
          </>
        ) : (
          'Salvar Configurações'
        )}
      </Button>
    </div>
  )
}
