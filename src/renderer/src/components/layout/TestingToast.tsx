import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { ipc } from '../../lib/ipc'

type ToastState = 'hidden' | 'testing' | 'done' | 'failed'

export function TestingToast(): JSX.Element {
  const [state, setState] = useState<ToastState>('hidden')

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>

    ipc.onTestStarted(() => {
      clearTimeout(hideTimer)
      setState('testing')
    })

    ipc.onTestCompleted(() => {
      setState('done')
      hideTimer = setTimeout(() => setState('hidden'), 3000)
    })

    ipc.onTestFailed(() => {
      setState('failed')
      hideTimer = setTimeout(() => setState('hidden'), 4000)
    })

    return () => clearTimeout(hideTimer)
  }, [])

  if (state === 'hidden') return <></>

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all duration-300 ${
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

      {state === 'testing' && 'Testando velocidade...'}
      {state === 'done' && 'Teste concluído'}
      {state === 'failed' && 'Falha no teste de velocidade'}
    </div>
  )
}
