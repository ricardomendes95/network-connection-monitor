import { describe, it, expect } from 'vitest'
import {
  ANATEL_MIN_RATIO_WIFI,
  ANATEL_MIN_RATIO_WIRED,
  anatelMinimumMbps,
  countConsecutiveBelowAnatel,
  isBelowAnatel,
  type AnatelEvalInput
} from './anatel'

const wifi = (download: number, contracted = 500): AnatelEvalInput => ({
  downloadMbps: download,
  contractedMbps: contracted,
  connectionType: 'wifi'
})

const wired = (download: number, contracted = 500): AnatelEvalInput => ({
  downloadMbps: download,
  contractedMbps: contracted,
  connectionType: 'wired'
})

describe('anatelMinimumMbps', () => {
  it('aplica 30% para WiFi', () => {
    expect(anatelMinimumMbps(wifi(0, 500))).toBe(150)
    expect(anatelMinimumMbps(wifi(0, 100))).toBe(30)
  })

  it('aplica 40% para cabo', () => {
    expect(anatelMinimumMbps(wired(0, 500))).toBe(200)
    expect(anatelMinimumMbps(wired(0, 100))).toBe(40)
  })

  it('trata connection_type null/undefined como WiFi (mais permissivo)', () => {
    expect(
      anatelMinimumMbps({ downloadMbps: 0, contractedMbps: 500, connectionType: null })
    ).toBe(500 * ANATEL_MIN_RATIO_WIFI)
    expect(
      anatelMinimumMbps({ downloadMbps: 0, contractedMbps: 500, connectionType: undefined })
    ).toBe(500 * ANATEL_MIN_RATIO_WIFI)
  })

  it('cai pro fallback quando não há plano contratado', () => {
    expect(
      anatelMinimumMbps({
        downloadMbps: 0,
        contractedMbps: 0,
        connectionType: 'wifi',
        fallbackThresholdMbps: 10
      })
    ).toBe(10)
  })

  it('retorna 0 quando não há plano nem fallback', () => {
    expect(
      anatelMinimumMbps({ downloadMbps: 0, contractedMbps: 0, connectionType: 'wifi' })
    ).toBe(0)
    expect(
      anatelMinimumMbps({
        downloadMbps: 0,
        contractedMbps: 0,
        connectionType: 'wifi',
        fallbackThresholdMbps: 0
      })
    ).toBe(0)
  })

  it('contractedMbps positivo tem prioridade sobre fallback', () => {
    expect(
      anatelMinimumMbps({
        downloadMbps: 0,
        contractedMbps: 100,
        connectionType: 'wifi',
        fallbackThresholdMbps: 999
      })
    ).toBe(30)
  })
})

describe('isBelowAnatel', () => {
  describe('WiFi 500 Mbps (mínimo = 150)', () => {
    it.each([
      [86.6, true], // cenário do print do usuário
      [149, true],
      [150, false], // exatamente no limite — não viola
      [151, false],
      [500, false]
    ])('download %d Mbps → below=%s', (download, expected) => {
      expect(isBelowAnatel(wifi(download))).toBe(expected)
    })
  })

  describe('cabo 500 Mbps (mínimo = 200)', () => {
    it.each([
      [86.6, true],
      [199, true],
      [200, false],
      [250, false]
    ])('download %d Mbps → below=%s', (download, expected) => {
      expect(isBelowAnatel(wired(download))).toBe(expected)
    })
  })

  it('considera o connection_type do próprio teste antes do da rede', () => {
    // mesma rede contratada como WiFi mas o teste foi feito via cabo
    const input: AnatelEvalInput = {
      downloadMbps: 180,
      contractedMbps: 500,
      connectionType: 'wired' // 40% = 200 → 180 viola
    }
    expect(isBelowAnatel(input)).toBe(true)
  })

  it('sem plano e sem fallback retorna false (não dá pra avaliar)', () => {
    expect(
      isBelowAnatel({ downloadMbps: 0.1, contractedMbps: 0, connectionType: 'wifi' })
    ).toBe(false)
  })

  it('usa fallback quando não há plano', () => {
    const base = { contractedMbps: 0, connectionType: 'wifi' as const, fallbackThresholdMbps: 10 }
    expect(isBelowAnatel({ ...base, downloadMbps: 9 })).toBe(true)
    expect(isBelowAnatel({ ...base, downloadMbps: 10 })).toBe(false)
    expect(isBelowAnatel({ ...base, downloadMbps: 50 })).toBe(false)
  })
})

describe('countConsecutiveBelowAnatel', () => {
  it('conta a partir do começo do array (mais recente primeiro)', () => {
    // 3 ruins seguidos no começo, depois um bom — streak = 3
    const inputs = [wifi(86.6), wifi(66.4), wifi(89.3), wifi(215.8), wifi(180)]
    expect(countConsecutiveBelowAnatel(inputs)).toBe(3)
  })

  it('para no primeiro teste OK', () => {
    const inputs = [wifi(86.6), wifi(215.8), wifi(50), wifi(50)]
    expect(countConsecutiveBelowAnatel(inputs)).toBe(1)
  })

  it('retorna 0 quando o primeiro teste já é OK', () => {
    expect(countConsecutiveBelowAnatel([wifi(300), wifi(50), wifi(50)])).toBe(0)
  })

  it('retorna 0 para array vazio', () => {
    expect(countConsecutiveBelowAnatel([])).toBe(0)
  })

  it('cobre o cenário real do print: 4 testes hoje no print do usuário', () => {
    // Plano: 500 Mbps WiFi → mínimo = 150
    // Histórico (mais recente primeiro): 86.6, 66.4, 81.9, 89.3 → todos < 150
    const inputs = [86.6, 66.4, 81.9, 89.3].map((d) => wifi(d))
    expect(countConsecutiveBelowAnatel(inputs)).toBe(4)
  })
})

describe('constantes', () => {
  it('mantém os ratios da Resolução ANATEL 614/2013', () => {
    expect(ANATEL_MIN_RATIO_WIRED).toBe(0.4)
    expect(ANATEL_MIN_RATIO_WIFI).toBe(0.3)
  })
})
