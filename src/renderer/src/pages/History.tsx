import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { HistoryTable } from '../components/history/HistoryTable'
import { ipc } from '../lib/ipc'
import type { SpeedResult } from '../types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const LIMIT = 30

export function HistoryPage(): JSX.Element {
  const [results, setResults] = useState<SpeedResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [days, setDays] = useState('7')
  const [isLoading, setIsLoading] = useState(false)

  const totalPages = Math.ceil(total / LIMIT)

  useEffect(() => {
    setPage(1)
  }, [days])

  useEffect(() => {
    setIsLoading(true)
    ipc
      .getHistory({ days: Number(days), page, limit: LIMIT })
      .then((r) => {
        setResults(r.rows)
        setTotal(r.total)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [days, page])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Histórico</h1>
          <p className="text-sm text-muted-foreground">
            {total} resultado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Hoje</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Resultados dos Testes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : (
            <HistoryTable results={results} />
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
