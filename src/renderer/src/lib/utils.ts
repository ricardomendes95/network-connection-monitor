import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatMbps(value: number | undefined | null): string {
  if (value == null) return '—'
  return `${value.toFixed(1)} Mbps`
}

export function formatMs(value: number | undefined | null): string {
  if (value == null) return '—'
  return `${Math.round(value)} ms`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export function dayName(dayIndex: string | number): string {
  return DAY_NAMES[Number(dayIndex)] ?? '?'
}

export function speedColor(mbps: number): string {
  if (mbps >= 50) return '#22c55e'
  if (mbps >= 20) return '#84cc16'
  if (mbps >= 10) return '#eab308'
  if (mbps >= 5) return '#f97316'
  return '#ef4444'
}

export function speedColorRelative(
  mbps: number,
  contractedMbps: number,
  connectionType: string | null
): string {
  if (!contractedMbps || contractedMbps <= 0) return speedColor(mbps)
  const ev = evaluateSpeed(mbps, contractedMbps, connectionType)
  if (ev.color === 'green') return '#22c55e'
  if (ev.color === 'yellow') return '#eab308'
  if (ev.color === 'orange') return '#f97316'
  return '#ef4444'
}

export function secondsToMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export type EvalColor = 'green' | 'yellow' | 'orange' | 'red'

export interface SpeedEvaluation {
  label: string
  detail: string
  percentage: number
  color: EvalColor
  anatelRule: string | null
}

/**
 * Avalia a velocidade medida com base no plano contratado e tipo de conexão,
 * usando como referência a Resolução ANATEL nº 614/2013 (mín. 40% cabeado, média 80%).
 */
export function evaluateSpeed(
  downloadMbps: number,
  contractedMbps: number,
  connectionType: 'wifi' | 'wired' | string | null
): SpeedEvaluation {
  if (!contractedMbps || contractedMbps <= 0) {
    return {
      label: 'Configure o plano',
      detail: 'Informe a velocidade contratada nas Configurações para ver a avaliação.',
      percentage: 0,
      color: 'orange',
      anatelRule: null
    }
  }

  const pct = (downloadMbps / contractedMbps) * 100
  const type = connectionType === 'wifi' ? 'wifi' : 'wired'

  if (type === 'wired') {
    // ANATEL Res. 614/2013: mínimo instantâneo 40%, média 80%
    if (pct >= 80) {
      return {
        label: 'Excelente',
        detail: `${pct.toFixed(0)}% do plano contratado. Dentro da média mínima ANATEL (80%).`,
        percentage: pct,
        color: 'green',
        anatelRule: 'ANATEL: mínimo 40% | média 80% (cabo)'
      }
    }
    if (pct >= 40) {
      return {
        label: 'Regular',
        detail: `${pct.toFixed(0)}% do plano contratado. Acima do mínimo instantâneo ANATEL (40%), mas abaixo da média exigida (80%).`,
        percentage: pct,
        color: 'yellow',
        anatelRule: 'ANATEL: mínimo 40% | média 80% (cabo)'
      }
    }
    return {
      label: 'Abaixo do mínimo ANATEL',
      detail: `${pct.toFixed(0)}% do plano contratado. Abaixo do mínimo legal de 40%. Você pode registrar reclamação na ANATEL.`,
      percentage: pct,
      color: 'red',
      anatelRule: 'ANATEL: mínimo 40% | média 80% (cabo)'
    }
  }

  // WiFi: sem garantia legal, mas guias práticos indicam 50–60% como aceitável
  if (pct >= 60) {
    return {
      label: 'Excelente para WiFi',
      detail: `${pct.toFixed(0)}% do plano. Ótimo desempenho para conexão sem fio.`,
      percentage: pct,
      color: 'green',
      anatelRule: 'WiFi: sem garantia legal (sinal compartilhado)'
    }
  }
  if (pct >= 30) {
    return {
      label: 'Aceitável para WiFi',
      detail: `${pct.toFixed(0)}% do plano. Perdas de sinal são comuns em WiFi. Considere usar cabo para mais estabilidade.`,
      percentage: pct,
      color: 'yellow',
      anatelRule: 'WiFi: sem garantia legal (sinal compartilhado)'
    }
  }
  return {
    label: 'Ruim para WiFi',
    detail: `${pct.toFixed(0)}% do plano. Sinal muito fraco. Verifique obstáculos, distância do roteador ou use cabo.`,
    percentage: pct,
    color: 'orange',
    anatelRule: 'WiFi: sem garantia legal (sinal compartilhado)'
  }
}
