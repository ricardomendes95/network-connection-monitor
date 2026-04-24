import { useNavigate } from 'react-router-dom'
import { Info } from 'lucide-react'
import { useNetworksStore } from '../../store/networksStore'

export function UncataloguedNetworkBanner(): JSX.Element | null {
  const navigate = useNavigate()
  const { liveMatch, live, active } = useNetworksStore()

  if (liveMatch !== 'uncatalogued' || !live) return null

  return (
    <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/40 rounded-lg px-4 py-3">
      <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-blue-200">
          Rede atual não cadastrada
        </p>
        <p className="text-xs text-muted-foreground">
          Você está conectado a <strong className="text-foreground">{live.networkName}</strong>
          {active ? (
            <>
              . Os testes continuam sendo atribuídos a{' '}
              <strong className="text-foreground">{active.name}</strong>.
            </>
          ) : (
            <>. Cadastre para começar a registrar.</>
          )}
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => navigate('/networks?new=1')}
            className="text-xs px-2.5 py-1 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 transition-colors"
          >
            Cadastrar agora
          </button>
        </div>
      </div>
    </div>
  )
}
