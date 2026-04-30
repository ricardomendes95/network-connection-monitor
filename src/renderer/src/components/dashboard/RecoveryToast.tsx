import { useEffect } from 'react'
import { Bot, ThumbsUp, X } from 'lucide-react'
import { useSpeedStore } from '../../store/speedStore'

const AUTO_DISMISS_MS = 6000

export function RecoveryToast(): JSX.Element | null {
  const { recoveryToastVisible, hideRecoveryToast } = useSpeedStore()

  useEffect(() => {
    if (!recoveryToastVisible) return
    const id = window.setTimeout(hideRecoveryToast, AUTO_DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [recoveryToastVisible, hideRecoveryToast])

  if (!recoveryToastVisible) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 print:hidden animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3 bg-emerald-600 border border-emerald-400/50 text-white rounded-lg px-4 py-3 shadow-lg shadow-emerald-900/40 max-w-sm">
        <div className="relative flex-shrink-0">
          <Bot className="w-6 h-6" />
          <ThumbsUp className="w-3.5 h-3.5 absolute -bottom-1 -right-1 bg-emerald-600 rounded-full" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Funcionou!</p>
          <p className="text-xs text-emerald-50/90 mt-0.5">
            Sua conexão voltou ao normal. Que bacana!
          </p>
        </div>
        <button
          onClick={hideRecoveryToast}
          aria-label="Fechar"
          className="text-emerald-50/70 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
