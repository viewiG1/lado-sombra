import { describe, expect, test } from 'vitest'
import { bearing, distance, resample, type LngLat } from './geo'

// Plaza de Armas de Santiago
const P: LngLat = [-70.6506, -33.4378]

describe('bearing', () => {
  test.each([
    ['norte', [P[0], P[1] + 0.01], 0],
    ['este', [P[0] + 0.01, P[1]], 90],
    ['sur', [P[0], P[1] - 0.01], 180],
    ['oeste', [P[0] - 0.01, P[1]], 270],
  ] as const)('hacia el %s', (_n, to, expected) => {
    expect(bearing(P, [to[0], to[1]])).toBeCloseTo(expected, 1)
  })
})

describe('distance', () => {
  test('0,01° de latitud ≈ 1112 m', () => {
    expect(distance(P, [P[0], P[1] + 0.01])).toBeCloseTo(1112, -1)
  })
  test('mismo punto = 0', () => {
    expect(distance(P, P)).toBe(0)
  })
})

describe('resample', () => {
  const line: LngLat[] = [P, [P[0], P[1] - 0.001], [P[0] + 0.002, P[1] - 0.001]]
  const total = distance(line[0]!, line[1]!) + distance(line[1]!, line[2]!)

  test('conserva el largo total y la duración, con tramos de ≤ 50 m', () => {
    const pieces = resample(line, [60, 120], 50)
    const len = pieces.reduce((s, p) => s + p.lengthM, 0)
    const dur = pieces.reduce((s, p) => s + p.durationS, 0)
    expect(len).toBeCloseTo(total, 3)
    expect(dur).toBeCloseTo(180, 6)
    for (const p of pieces) expect(p.lengthM).toBeLessThanOrEqual(50 + 1e-6)
  })

  test('los tramos son contiguos y empiezan y terminan en la ruta', () => {
    const pieces = resample(line, [60, 120], 50)
    expect(pieces[0]!.from).toEqual(line[0])
    expect(pieces.at(-1)!.to).toEqual(line[2])
    for (let i = 1; i < pieces.length; i++) expect(pieces[i]!.from).toEqual(pieces[i - 1]!.to)
  })

  test('reparte la duración según el segmento original', () => {
    // el segmento 1 (≈111 m) dura 60 s: el primer tramo de 50 m dura la parte proporcional
    const pieces = resample(line, [60, 120], 50)
    expect(pieces[0]!.durationS).toBeCloseTo((50 / distance(line[0]!, line[1]!)) * 60, 3)
  })

  test('ignora puntos repetidos y rutas sin largo', () => {
    expect(resample([P, P], [5], 50)).toEqual([])
    expect(resample([P], [], 50)).toEqual([])
    const withDup = resample([P, P, line[1]!], [0, 60], 50)
    expect(withDup.reduce((s, p) => s + p.durationS, 0)).toBeCloseTo(60, 6)
  })

  test('exige una duración por segmento y un paso positivo', () => {
    expect(() => resample(line, [60], 50)).toThrow(RangeError)
    expect(() => resample(line, [60, 120], 0)).toThrow(RangeError)
  })
})
