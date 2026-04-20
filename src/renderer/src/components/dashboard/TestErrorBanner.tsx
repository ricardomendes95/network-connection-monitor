import { XCircle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useSpeedStore } from '../../store/speedStore'

export function TestErrorBanner(): JSX.Element | null {
  const { testError, setTestError } = useSpeedStore()
  const [expanded, setExpanded] = useState(false)

  if (!testError) return null

  const firstLine = testError.split('\n')[0]

  return (
    <div className="flex flex-col gap-2 bg-destructive/10 border border-destructive/40 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-start gap-3">
        <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-destructive">Falha no teste de velocidade</p>
          <p className="text-xs text-muted-foreground mt-0.5 break-all">{firstLine}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setTestError(null)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <pre className="text-xs text-muted-foreground bg-muted/40 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all">
          {testError}
        </pre>
      )}
    </div>
  )
}
