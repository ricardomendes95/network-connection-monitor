import { useNavigate } from 'react-router-dom'
import { Wifi, Cable, Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { useNetworksStore } from '../../store/networksStore'

export function NetworkSelector(): JSX.Element {
  const navigate = useNavigate()
  const { networks, active, live, liveMatch, setActive } = useNetworksStore()

  const handleChange = (value: string): void => {
    if (value === '__new__') {
      navigate('/networks?new=1')
      return
    }
    const id = Number(value)
    if (Number.isFinite(id)) void setActive(id)
  }

  const liveLabel =
    live?.networkName && live.networkName !== 'Desconhecido' ? live.networkName : null

  return (
    <div className="border-b border-border px-3 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Rede Selecionada
        </p>
        {active && (
          <span className="flex items-center gap-1 text-muted-foreground">
            {active.connection_type === 'wifi' ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <Cable className="w-3 h-3" />
            )}
          </span>
        )}
      </div>

      <Select value={active ? String(active.id) : ''} onValueChange={handleChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue
            placeholder={
              networks.length === 0 ? 'Nenhuma rede cadastrada' : 'Selecione uma rede'
            }
          />
        </SelectTrigger>
        <SelectContent>
          {networks.map((net) => (
            <SelectItem key={net.id} value={String(net.id)}>
              {net.name} · {net.connection_type === 'wifi' ? 'WiFi' : 'Cabo'}
            </SelectItem>
          ))}
          <SelectItem value="__new__">
            <span className="flex items-center gap-1.5 text-primary">
              <Plus className="w-3.5 h-3.5" /> Cadastrar nova rede…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {liveLabel && (
        <p className="text-[11px] text-muted-foreground leading-tight">
          {liveMatch === 'match' && (
            <>Conectado a <span className="text-foreground">{liveLabel}</span></>
          )}
          {liveMatch === 'mismatch' && (
            <>
              Conectado a <span className="text-yellow-400">{liveLabel}</span> (diferente)
            </>
          )}
          {liveMatch === 'uncatalogued' && (
            <>
              Conectado a <span className="text-blue-400">{liveLabel}</span> (não cadastrada)
            </>
          )}
        </p>
      )}
    </div>
  )
}
