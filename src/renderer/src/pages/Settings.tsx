import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useSettings } from '../hooks/useSettings'
import { Check, Info, Wifi, Cable } from 'lucide-react'
import { ipc } from '../lib/ipc'

const INTERVAL_OPTIONS = [
  { value: '5', label: 'A cada 5 min', note: 'Muito frequente, usa mais banda' },
  { value: '10', label: 'A cada 10 min', note: '' },
  { value: '15', label: 'A cada 15 min (recomendado)', note: 'Padrão da indústria para monitoramento ISP' },
  { value: '30', label: 'A cada 30 min', note: '' },
  { value: '60', label: 'A cada 1 hora', note: '' }
]

const THRESHOLD_OPTIONS = [
  { value: '5', label: '5 Mbps' },
  { value: '10', label: '10 Mbps' },
  { value: '20', label: '20 Mbps' },
  { value: '50', label: '50 Mbps' },
  { value: '100', label: '100 Mbps' }
]

const CONTRACTED_PRESETS = [
  { value: '50', label: '50 Mbps' },
  { value: '100', label: '100 Mbps' },
  { value: '200', label: '200 Mbps' },
  { value: '300', label: '300 Mbps' },
  { value: '400', label: '400 Mbps' },
  { value: '500', label: '500 Mbps' },
  { value: '600', label: '600 Mbps' },
  { value: '700', label: '700 Mbps' },
  { value: '800', label: '800 Mbps' },
  { value: '1000', label: '1 Gbps' }
]

export function SettingsPage(): JSX.Element {
  const { settings, saveSettings } = useSettings()
  const [saved, setSaved] = useState(false)

  const [interval, setInterval] = useState(settings.interval_minutes)
  const [threshold, setThreshold] = useState(settings.slow_threshold_mbps)
  const [notifs, setNotifs] = useState(settings.notifications_enabled === 'true')
  const [contracted, setContracted] = useState(settings.contracted_speed_mbps ?? '100')
  const [connType, setConnType] = useState(settings.connection_type ?? 'auto')
  const [ispName, setIspName] = useState(settings.isp_name ?? '')
  const [autostart, setAutostart] = useState(false)

  useEffect(() => {
    setInterval(settings.interval_minutes)
    setThreshold(settings.slow_threshold_mbps)
    setNotifs(settings.notifications_enabled === 'true')
    setContracted(settings.contracted_speed_mbps ?? '100')
    setConnType(settings.connection_type ?? 'auto')
    setIspName(settings.isp_name ?? '')
  }, [settings])

  useEffect(() => {
    ipc.getAutostart().then(setAutostart).catch(() => {})
  }, [])

  const handleSave = async (): Promise<void> => {
    await Promise.all([
      saveSettings({
        interval_minutes: interval,
        slow_threshold_mbps: threshold,
        notifications_enabled: String(notifs),
        contracted_speed_mbps: contracted,
        connection_type: connType,
        isp_name: ispName
      }),
      ipc.setAutostart(autostart)
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const selectedInterval = INTERVAL_OPTIONS.find((o) => o.value === interval)

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize o monitor e informe seu plano de internet</p>
      </div>

      {/* PLANO E PROVEDOR */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Plano e Provedor</CardTitle>
          <CardDescription className="text-xs">
            Usado para calcular se a velocidade está dentro do esperado segundo a ANATEL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provedor de internet (ISP)</Label>
            <input
              type="text"
              value={ispName}
              onChange={(e) => setIspName(e.target.value)}
              placeholder="Ex: Brisanet, Claro, Vivo..."
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Deixe em branco para usar a detecção automática por IP.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Velocidade contratada</Label>
            <Select value={contracted} onValueChange={setContracted}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                {CONTRACTED_PRESETS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pacote contratado com a operadora. Ex: plano de 500 Mbps da Brisanet → selecione 500 Mbps.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tipo de conexão</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'auto', label: 'Automático', icon: null },
                { value: 'wired', label: 'Cabeada', icon: Cable },
                { value: 'wifi', label: 'WiFi', icon: Wifi }
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setConnType(value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-colors ${
                    connType === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {!Icon && <span className="text-xs">🔍</span>}
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-start gap-1.5 pt-1">
              <Info className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                A ANATEL garante mínimo de 40% e média de 80% apenas para conexões <strong>cabeadas</strong>.
                WiFi não tem garantia legal, mas tolerância prática é de 25–60%.
              </p>
            </div>
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
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Intervalo entre testes</Label>
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
        </CardContent>
      </Card>

      {/* ALERTAS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Alertas</CardTitle>
          <CardDescription className="text-xs">Quando mostrar alerta de rede lenta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Limite de velocidade para alerta</Label>
            <Select value={threshold} onValueChange={setThreshold}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THRESHOLD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Alerta disparado quando o download ficar abaixo deste valor.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Notificações do sistema</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exibir notificação desktop ao detectar lentidão
              </p>
            </div>
            <Switch checked={notifs} onCheckedChange={setNotifs} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Iniciar com o Windows</Label>
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
