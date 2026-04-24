import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useNetworksStore } from '../../store/networksStore'

export function NetworkMismatchBanner(): JSX.Element | null {
  const navigate = useNavigate()
  const { liveMatch, live, active, networks, setActive } = useNetworksStore()

  if (liveMatch !== 'mismatch' || !live || !active) return null

  const matching = networks.find(
    (n) => n.ssid === live.networkName && n.connection_type === live.connectionType
  )

  return (
    <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/40 rounded-lg px-4 py-3">
      <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-yellow-200">
          Rede conectada diferente da selecionada
        </p>
        <p className="text-xs text-muted-foreground">
          Você está conectado a <strong className="text-foreground">{live.networkName}</strong>,
          mas os testes estão sendo atribuídos à rede{' '}
          <strong className="text-foreground">{active.name}</strong>.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {matching ? (
            <button
              onClick={() => void setActive(matching.id)}
              className="text-xs px-2.5 py-1 rounded-md bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-100 transition-colors"
            >
              Selecionar {matching.name}
            </button>
          ) : (
            <button
              onClick={() => navigate('/networks?new=1')}
              className="text-xs px-2.5 py-1 rounded-md bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-100 transition-colors"
            >
              Cadastrar rede atual
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
