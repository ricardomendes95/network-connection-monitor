import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Wifi, Cable, Pencil, Trash2, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { NetworkForm } from '../components/networks/NetworkForm'
import { useNetworksStore } from '../store/networksStore'
import type { Network, NetworkCreateInput } from '../types'

type EditorState =
  | { mode: 'hidden' }
  | { mode: 'create' }
  | { mode: 'edit'; network: Network }

export function NetworksPage(): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const { networks, active, setActive, create, update, remove } = useNetworksStore()
  const [editor, setEditor] = useState<EditorState>({ mode: 'hidden' })
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const queryWantsNew = useMemo(
    () => new URLSearchParams(location.search).get('new') === '1',
    [location.search]
  )

  useEffect(() => {
    if (queryWantsNew) {
      setEditor({ mode: 'create' })
      // Limpa o query param para não reabrir ao trocar de aba
      navigate('/networks', { replace: true })
    }
  }, [queryWantsNew, navigate])

  const handleCreate = async (input: NetworkCreateInput): Promise<void> => {
    const created = await create(input)
    if (!active) {
      await setActive(created.id)
    }
    setEditor({ mode: 'hidden' })
  }

  const handleUpdate = async (id: number, input: NetworkCreateInput): Promise<void> => {
    await update(id, input)
    setEditor({ mode: 'hidden' })
  }

  const handleDelete = async (id: number): Promise<void> => {
    setDeletingId(id)
    try {
      await remove(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Redes</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre as redes que você usa e defina provedor, plano e limiar de cada uma
          </p>
        </div>
        {editor.mode === 'hidden' && (
          <Button size="sm" onClick={() => setEditor({ mode: 'create' })}>
            <Plus className="w-4 h-4 mr-2" />
            Nova rede
          </Button>
        )}
      </div>

      {editor.mode !== 'hidden' && (
        <NetworkForm
          mode={editor.mode}
          initial={editor.mode === 'edit' ? editor.network : undefined}
          onCancel={() => setEditor({ mode: 'hidden' })}
          onSubmit={(input) =>
            editor.mode === 'edit'
              ? handleUpdate(editor.network.id, input)
              : handleCreate(input)
          }
        />
      )}

      {networks.length === 0 && editor.mode === 'hidden' && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-3">
            <p>Nenhuma rede cadastrada ainda.</p>
            <Button size="sm" onClick={() => setEditor({ mode: 'create' })}>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar primeira rede
            </Button>
          </CardContent>
        </Card>
      )}

      {networks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Redes cadastradas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {networks.map((net) => {
              const ConnIcon = net.connection_type === 'wifi' ? Wifi : Cable
              const isActive = active?.id === net.id
              return (
                <div
                  key={net.id}
                  className={`flex items-center gap-3 p-3 rounded-md border ${
                    isActive
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-border hover:bg-accent/30'
                  }`}
                >
                  <ConnIcon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      {net.name}
                      {isActive && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Ativa
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {net.isp_name || 'ISP não configurado'} · {net.contracted_speed_mbps} Mbps · alerta {net.slow_threshold_mbps} Mbps
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {net.ssid}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void setActive(net.id)}
                      >
                        Ativar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditor({ mode: 'edit', network: net })}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deletingId === net.id}
                      onClick={() => {
                        if (
                          confirm(
                            `Excluir a rede "${net.name}"? Os registros históricos ficarão sem rede associada.`
                          )
                        ) {
                          void handleDelete(net.id)
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
