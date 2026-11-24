import { describe, expect, test } from 'vitest'
import type { Analysis } from './analyze'
import { describeVerdict } from './verdictText'

const base = { runs: [], dominant: null } satisfies Partial<Analysis>

describe('describeVerdict', () => {
  test('sentarse al lado del chofer', () => {
    const t = describeVerdict({ ...base, minutes: { chofer: 0, puerta: 12.4, none: 12.6 }, totalMinutes: 25, verdict: { kind: 'sentarse', side: 'chofer' } })
    expect(t.lead).toBe('Siéntate al')
    expect(t.emphasis).toBe('lado del chofer')
    expect(t.side).toBe('chofer')
    expect(t.detail).toBe('El sol pega en el lado puerta 12 de ~25 min.')
    expect(t.hint).toMatch(/izquierdo/)
  })

  test('sentarse al lado de la puerta', () => {
    const t = describeVerdict({ ...base, minutes: { chofer: 9.6, puerta: 1, none: 0 }, totalMinutes: 10.6, verdict: { kind: 'sentarse', side: 'puerta' } })
    expect(t.emphasis).toBe('lado de la puerta')
    expect(t.detail).toBe('El sol pega en el lado chofer 10 de ~11 min.')
    expect(t.hint).toMatch(/derecho/)
  })

  test('parejo', () => {
    const t = describeVerdict({ ...base, minutes: { chofer: 5, puerta: 6, none: 9 }, totalMinutes: 20, verdict: { kind: 'parejo' } })
    expect(t.lead).toBe('Está parejo')
    expect(t.emphasis).toBeNull()
    expect(t.detail).toBe('El sol pega 5 min en el lado chofer y 6 min en el lado puerta.')
  })

  test('da lo mismo', () => {
    const t = describeVerdict({ ...base, minutes: { chofer: 0, puerta: 0, none: 9 }, totalMinutes: 9, verdict: { kind: 'da-lo-mismo' } })
    expect(t.lead).toBe('Da lo mismo')
    expect(t.detail).toBe('En este viaje el sol no te pega de lado.')
  })

  test('un viaje de menos de un minuto se muestra como ~1 min', () => {
    const t = describeVerdict({ ...base, minutes: { chofer: 0, puerta: 0.3, none: 0 }, totalMinutes: 0.3, verdict: { kind: 'sentarse', side: 'chofer' } })
    expect(t.detail).toBe('El sol pega en el lado puerta 0 de ~1 min.')
  })
})
