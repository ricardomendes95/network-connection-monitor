import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import type { Network, NetworkCreateInput } from '../../types'
import { Wifi, Cable, Sparkles } from 'lucide-react'
import { ipc } from '../../lib/ipc'

const CONTRACTED_PRESETS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '1000'
]

const THRESHOLD_PRESETS = ['5', '10', '20', '50', '100']

interface Props {
  mode: 'create' | 'edit'
  initial?: Network
  onCancel: () => void
  onSubmit: (input: NetworkCreateInput) => Promise<void>
}

export function NetworkForm({ mode, initial, onCancel, onSubmit }: Props): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [ssid, setSsid] = useState(initial?.ssid ?? '')
  const [connectionType, setConnectionType] = useState<'wifi' | 'wired'>(
    initial?.connection_type ?? 'wifi'
  )
  const [ispName, setIspName] = useState(initial?.isp_name ?? '')
  const [contracted, setContracted] = useState(
    String(initial?.contracted_speed_mbps ?? 100)
  )
  const [threshold, setThreshold] = useState(
    String(initial?.slow_threshold_mbps ?? 10)
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'create') {
      void ipc
        .suggestNetworkFromLive()
        .then((sugg) => {
          if (sugg.alreadyRegistered) return
          setName((prev) => prev || sugg.suggestion.name)
          setSsid((prev) => prev || sugg.suggestion.ssid)
          setConnectionType(sugg.suggestion.connection_type)
          setIspName((prev) => prev || sugg.suggestion.isp_name)
        })
        .catch(() => {})
    }
  }, [mode])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Informe um nome para a rede.')
      return
    }
    if (!ssid.trim()) {
      setError('Informe o identificador técnico (SSID).')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        ssid: ssid.trim(),
        connection_type: connectionType,
        isp_name: ispName.trim(),
        contracted_speed_mbps: Number(contracted) || 100,
        slow_threshold_mbps: Number(threshold) || 10
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a rede.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {mode === 'create' ? 'Nova rede' : `Editando ${initial?.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome exibível</Label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Casa, Escritório, Café da esquina"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Rótulo que aparece na interface.</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Identificador técnico (SSID)
              {mode === 'create' && (
                <Sparkles className="w-3 h-3 text-primary" aria-label="Sugerido automaticamente" />
              )}
            </Label>
            <input
              type="text"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="SSID da WiFi ou nome do perfil Ethernet"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Usado para detectar a rede automaticamente. Normalmente igual ao nome exibido
              pelo sistema ao se conectar.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tipo de conexão</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'wired' as const, label: 'Cabeada', Icon: Cable },
                { value: 'wifi' as const, label: 'WiFi', Icon: Wifi }
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setConnectionType(value)}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-md border text-sm transition-colors ${
                    connectionType === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Provedor de internet (ISP)</Label>
            <input
              type="text"
              value={ispName}
              onChange={(e) => setIspName(e.target.value)}
              placeholder="Ex: Brisanet, Claro, Vivo..."
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <Label>Velocidade contratada</Label>
            <Select value={contracted} onValueChange={setContracted}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACTED_PRESETS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v === '1000' ? '1 Gbps' : `${v} Mbps`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Limiar de alerta (lentidão)</Label>
            <Select value={threshold} onValueChange={setThreshold}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THRESHOLD_PRESETS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v} Mbps
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Disparar alerta quando o download cair abaixo deste valor para esta rede.
            </p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Salvando…' : mode === 'create' ? 'Cadastrar' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
