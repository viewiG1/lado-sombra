import { describe, expect, test } from 'vitest'
import type { Analysis, NoSideReason } from './analyze'
import { describeVerdict, headline } from './verdictText'

function analysis(partial: Pick<Analysis, 'minutes' | 'totalMinutes' | 'verdict'> & { reasons?: Partial<Record<NoSideReason, number>> }): Analysis {
  return {
    runs: [],
    dominant: null,
    sky: null,
    glareMinutes: 0,
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

describe('describeVerdict a pie', () => {
  test('sol a la derecha → camina por la vereda de la derecha (los edificios de ese lado dan sombra)', () => {
    // "sentarse chofer" = el sol pega a la derecha (lado puerta)
    const t = describeVerdict(
      analysis({ minutes: { chofer: 0, puerta: 14, none: 6 }, totalMinutes: 20, verdict: { kind: 'sentarse', side: 'chofer' } }),
      'pie',
    )
    expect(t.lead).toBe('Camina por la vereda de la')
    expect(t.emphasis).toBe('derecha')
    expect(t.side).toBe('puerta')
    expect(t.detail).toMatch(/derecha 14 de ~20 min/)
    expect(t.detail).toMatch(/edificios/)
  })

  test('sol a la izquierda → vereda de la izquierda', () => {
    const t = describeVerdict(
      analysis({ minutes: { chofer: 12, puerta: 0, none: 0 }, totalMinutes: 12, verdict: { kind: 'sentarse', side: 'puerta' } }),
      'pie',
    )
    expect(t.emphasis).toBe('izquierda')
    expect(t.side).toBe('chofer')
  })

  test('sol encima: no hay vereda con sombra', () => {
    const t = describeVerdict(
      analysis({ minutes: { chofer: 0, puerta: 0, none: 10 }, totalMinutes: 10, verdict: { kind: 'da-lo-mismo' }, reasons: { alto: 10 } }),
      'pie',
    )
    expect(t.lead).toBe('Da lo mismo la vereda')
    expect(t.detail).toMatch(/árboles/)
  })

  test('avisa si el sol bajo da en la cara', () => {
    const t = describeVerdict(
      { ...analysis({ minutes: { chofer: 0, puerta: 0, none: 10 }, totalMinutes: 10, verdict: { kind: 'da-lo-mismo' }, reasons: { frente: 10 } }), glareMinutes: 8 },
      'pie',
    )
    expect(t.warning).toMatch(/en la cara ~8 min/)
    expect(t.warning).toMatch(/lentes/)
  })

  test('menos de 2 minutos de sol en la cara no merece aviso', () => {
    const t = describeVerdict({ ...analysis({ minutes: { chofer: 5, puerta: 0, none: 0 }, totalMinutes: 5, verdict: { kind: 'sentarse', side: 'puerta' } }), glareMinutes: 1 }, 'pie')
    expect(t.warning).toBeNull()
  })
})

describe('describeVerdict en bici', () => {
  test('dice por qué lado pega el sol', () => {
    const t = describeVerdict(
      analysis({ minutes: { chofer: 0, puerta: 14, none: 6 }, totalMinutes: 20, verdict: { kind: 'sentarse', side: 'chofer' } }),
      'bici',
    )
    expect(t.lead).toBe('El sol te pega por la')
    expect(t.emphasis).toBe('derecha')
    expect(t.detail).toBe('14 de ~20 min en bici.')
  })

  test('sin sol de lado: el titular dice dónde va el sol', () => {
    const t = describeVerdict(
      analysis({ minutes: { chofer: 0, puerta: 0, none: 10 }, totalMinutes: 10, verdict: { kind: 'da-lo-mismo' }, reasons: { atras: 10 } }),
      'bici',
    )
    expect(t.lead).toBe('Sol en la espalda')
  })

  test('la micro no avisa del sol en la cara (no vas manejando)', () => {
    const t = describeVerdict({ ...analysis({ minutes: { chofer: 0, puerta: 0, none: 10 }, totalMinutes: 10, verdict: { kind: 'da-lo-mismo' }, reasons: { frente: 10 } }), glareMinutes: 9 })
    expect(t.warning).toBeNull()
  })
})

describe('headline', () => {
  test('une el comienzo y el énfasis', () => {
    expect(headline({ lead: 'Siéntate al', emphasis: 'lado del chofer' })).toBe('Siéntate al lado del chofer')
    expect(headline({ lead: 'Da lo mismo', emphasis: null })).toBe('Da lo mismo')
  })
})
