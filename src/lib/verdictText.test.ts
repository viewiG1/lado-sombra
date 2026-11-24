import { describe, expect, test } from 'vitest'
import type { Analysis, NoSideReason } from './analyze'
import { describeVerdict } from './verdictText'

function analysis(partial: Pick<Analysis, 'minutes' | 'totalMinutes' | 'verdict'> & { reasons?: Partial<Record<NoSideReason, number>> }): Analysis {
  return {
    runs: [],
    dominant: null,
    sky: null,
    ...partial,
    reasons: { frente: 0, atras: 0, alto: 0, noche: 0, ...partial.reasons },
  }
}

describe('describeVerdict', () => {
  test('sentarse al lado del chofer', () => {
    const t = describeVerdict(
      analysis({ minutes: { chofer: 0, puerta: 12.4, none: 12.6 }, totalMinutes: 25, verdict: { kind: 'sentarse', side: 'chofer' } }),
    )
    expect(t.lead).toBe('Siéntate al')
    expect(t.emphasis).toBe('lado del chofer')
    expect(t.side).toBe('chofer')
    expect(t.detail).toBe('El sol pega en el lado puerta 12 de ~25 min.')
    expect(t.hint).toMatch(/izquierdo/)
  })

  test('sentarse al lado de la puerta', () => {
    const t = describeVerdict(
      analysis({ minutes: { chofer: 9.6, puerta: 1, none: 0 }, totalMinutes: 10.6, verdict: { kind: 'sentarse', side: 'puerta' } }),
    )
    expect(t.emphasis).toBe('lado de la puerta')
    expect(t.detail).toBe('El sol pega en el lado chofer 10 de ~11 min.')
    expect(t.hint).toMatch(/derecho/)
  })

  test('parejo', () => {
    const t = describeVerdict(analysis({ minutes: { chofer: 5, puerta: 6, none: 9 }, totalMinutes: 20, verdict: { kind: 'parejo' } }))
    expect(t.lead).toBe('Está parejo')
    expect(t.emphasis).toBeNull()
    expect(t.detail).toBe('El sol pega 5 min en el lado chofer y 6 min en el lado puerta.')
    expect(t.hint).toMatch(/cualquier lado/)
  })

  test.each([
    ['noche', /de noche/],
    ['alto', /encima de la micro/],
    ['frente', /de frente/],
    ['atras', /por atrás/],
  ] as const)('da lo mismo explica el motivo principal: %s', (reason, text) => {
    const t = describeVerdict(
      analysis({ minutes: { chofer: 0, puerta: 0, none: 10 }, totalMinutes: 10, verdict: { kind: 'da-lo-mismo' }, reasons: { [reason]: 7, noche: reason === 'noche' ? 7 : 3 } }),
    )
    expect(t.lead).toBe('Da lo mismo')
    expect(t.detail).toMatch(text)
    expect(t.reason).toBe(reason)
  })

  test('un viaje de menos de un minuto se muestra como ~1 min', () => {
    const t = describeVerdict(
      analysis({ minutes: { chofer: 0, puerta: 0.3, none: 0 }, totalMinutes: 0.3, verdict: { kind: 'sentarse', side: 'chofer' } }),
    )
    expect(t.detail).toBe('El sol pega en el lado puerta 0 de ~1 min.')
  })
})
