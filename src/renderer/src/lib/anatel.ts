// Resolução ANATEL 614/2013 (residencial fixo): velocidade instantânea
// mínima é 40% do contratado para link cabeado e 30% para WiFi (esse último
// é a referência prática usada pelo app — WiFi não tem garantia legal,
// mas é o mesmo número aplicado nos relatórios e no gráfico de instabilidade).
export const ANATEL_MIN_RATIO_WIRED = 0.4
export const ANATEL_MIN_RATIO_WIFI = 0.3

export interface AnatelEvalInput {
  /** Download medido no teste, em Mbps. */
  downloadMbps: number
  /** Plano contratado, em Mbps. <=0 ou ausente = sem plano configurado. */
  contractedMbps: number
  /** Tipo da conexão. null/undefined trata como WiFi (mais permissivo). */
  connectionType: 'wifi' | 'wired' | null | undefined
  /**
   * Threshold manual configurado pelo usuário na rede (slow_threshold_mbps).
   * Usado como fallback quando não há plano contratado.
   */
  fallbackThresholdMbps?: number
}

/**
 * Retorna o threshold mínimo (em Mbps) que o download precisa atingir pra
 * estar dentro da expectativa ANATEL. Retorna 0 quando não há critério
 * computável (sem plano contratado e sem fallback).
 */
export function anatelMinimumMbps(input: AnatelEvalInput): number {
  const { contractedMbps, connectionType, fallbackThresholdMbps } = input

  if (contractedMbps && contractedMbps > 0) {
    const ratio =
      connectionType === 'wired' ? ANATEL_MIN_RATIO_WIRED : ANATEL_MIN_RATIO_WIFI
    return contractedMbps * ratio
  }

  if (typeof fallbackThresholdMbps === 'number' && fallbackThresholdMbps > 0) {
    return fallbackThresholdMbps
  }

  return 0
}

/**
 * `true` quando o teste violou o mínimo ANATEL (ou o fallback configurado).
 * Sem plano e sem fallback retorna `false` — não dá pra avaliar.
 */
export function isBelowAnatel(input: AnatelEvalInput): boolean {
  const minimum = anatelMinimumMbps(input)
  if (minimum <= 0) return false
  return input.downloadMbps < minimum
}

/**
 * Conta quantos testes consecutivos do começo do array (mais recentes
 * primeiro, como vem do store) violam o mínimo ANATEL. Para no primeiro
 * teste OK encontrado.
 */
export function countConsecutiveBelowAnatel(inputs: AnatelEvalInput[]): number {
  let n = 0
  for (const input of inputs) {
    if (isBelowAnatel(input)) n++
    else break
  }
  return n
}
