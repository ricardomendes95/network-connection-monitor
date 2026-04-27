import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { ipc } from '../lib/ipc'

type State = 'testing' | 'done' | 'failed'

export function OverlayPage(): JSX.Element {
  const [state, setState] = useState<State>('testing')
  const [download, setDownload] = useState<number | null>(null)

  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'

    ipc.onTestStarted(() => {
      setDownload(null)
      setState('testing')
    })
    ipc.onTestCompleted((result) => {
      setDownload(result.download)
      setState('done')
    })
    ipc.onTestFailed(() => setState('failed'))
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-transparent">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${
          state === 'testing'
            ? 'bg-background border-primary/40 text-primary'
            : state === 'done'
              ? 'bg-background border-green-500/40 text-green-500'
              : 'bg-background border-destructive/40 text-destructive'
        }`}
      >
        {state === 'testing' && <Loader2 className="w-4 h-4 animate-spin" />}
        {state === 'done' && <CheckCircle2 className="w-4 h-4" />}
        {state === 'failed' && <XCircle className="w-4 h-4" />}
        {state === 'testing' && 'Realizando teste...'}
        {state === 'done' && (
          <span>
            Teste concluído{' '}
            {download !== null && (
              <span className="font-semibold">↓ {download.toFixed(1)} Mbps</span>
            )}
          </span>
        )}
        {state === 'failed' && 'Falha no teste de velocidade'}
      </div>
    </div>
  )
}
