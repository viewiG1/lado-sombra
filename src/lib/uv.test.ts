import { describe, expect, test } from 'vitest'
import { chileToUtc } from './time'
import { estimateUv, uvCategory, uvForTrip, type UvSeries } from './uv'

const STGO = { lat: -33.44, lon: -70.65 }

describe('estimateUv (cielo despejado, según la altura del sol)', () => {
  test('se parece a Open-Meteo en Santiago', () => {
    expect(estimateUv(76)).toBeCloseTo(9.1, 0)
    expect(estimateUv(42)).toBeCloseTo(5.2, 0)
    expect(estimateUv(17)).toBeCloseTo(1.5, 0)
  })
  test('de noche es 0', () => {
    expect(estimateUv(0)).toBe(0)
    expect(estimateUv(-10)).toBe(0)
  })
})

describe('uvCategory (escala de la OMS)', () => {
  test.each([
    [0, 'bajo'],
    [2.4, 'bajo'],
    [2.6, 'moderado'],
    [5.4, 'moderado'],
    [6, 'alto'],
    [7.4, 'alto'],
    [8, 'muy-alto'],
    [10.4, 'muy-alto'],
    [11, 'extremo'],
  ] as const)('UV %d → %s', (uv, level) => {
    expect(uvCategory(uv).level).toBe(level)
  })

  test('cada nivel trae nombre y consejo en español', () => {
    expect(uvCategory(9).label).toBe('Muy alto')
    expect(uvCategory(9).advice).toMatch(/bloqueador/i)
    expect(uvCategory(1).advice).toMatch(/no necesitas/i)
  })
})

describe('uvForTrip', () => {
  // Serie por hora en UTC: cada valor es el promedio de la hora anterior.
  const t0 = Date.UTC(2026, 10, 24, 0)
  const hours = Array.from({ length: 48 }, (_, i) => t0 + i * 3600000)
  const series: UvSeries = {
    times: hours,
    uv: hours.map((_, i) => (i === 21 ? 4 : i === 22 ? 2 : i === 20 ? 6 : 0)),
    clearSky: hours.map((_, i) => (i === 21 ? 5 : i === 22 ? 3 : i === 20 ? 7 : 0)),
  }

  test('usa el pronóstico y entrega el máximo durante el viaje', () => {
    // 18:00 de Chile = 21:00 UTC; el valor de las 21:00 UTC cubre 20:00–21:00, así que a las 21:00 ≈ (4 + 2) / 2
    const r = uvForTrip({ series, departureMs: chileToUtc('2026-11-24', '18:00'), minutes: 20, ...STGO })
    expect(r.source).toBe('pronostico')
    expect(r.uv).toBeGreaterThan(2.5)
    expect(r.uv).toBeLessThanOrEqual(4)
    expect(r.clearSky).toBeGreaterThan(r.uv)
  })

  test('sin pronóstico estima con la altura del sol', () => {
    const r = uvForTrip({ series: null, departureMs: chileToUtc('2026-12-21', '13:30'), minutes: 20, ...STGO })
    expect(r.source).toBe('estimado')
    expect(r.uv).toBeGreaterThan(8)
    expect(r.clearSky).toBe(r.uv)
  })

  test('de noche: 0', () => {
    const r = uvForTrip({ series: null, departureMs: chileToUtc('2026-11-24', '23:00'), minutes: 20, ...STGO })
    expect(r.uv).toBe(0)
  })

  test('si el viaje queda fuera de la serie, estima', () => {
    const r = uvForTrip({ series, departureMs: chileToUtc('2026-12-25', '13:00'), minutes: 20, ...STGO })
    expect(r.source).toBe('estimado')
  })

  test('el pronóstico sin datos (null) cae a la estimación', () => {
    const empty: UvSeries = { times: hours, uv: hours.map(() => null), clearSky: hours.map(() => null) }
    expect(uvForTrip({ series: empty, departureMs: chileToUtc('2026-11-24', '18:00'), minutes: 20, ...STGO }).source).toBe('estimado')
  })
})
