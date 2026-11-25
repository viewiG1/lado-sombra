import { describe, expect, test } from 'vitest'
import { SLIDER } from '../config'
import { prepareRoute, type Route } from './analyze'
import { departureProfile, exposureMinutes, suggestDeparture } from './bestTime'
import type { LngLat } from './geo'
import { chileToUtc } from './time'

const START: LngLat = [-70.6506, -33.4378]
const south: Route = {
  coords: Array.from({ length: 11 }, (_, i): LngLat => [START[0], START[1] - (0.027 * i) / 10]),
  durationS: 600,
  segmentDurationsS: null,
}
const prepared = prepareRoute(south)

describe('exposureMinutes', () => {
  test('micro: minutos con sol de lado (a las 18:00 hacia el sur, casi todo el viaje)', () => {
    const m = exposureMinutes(prepared, chileToUtc('2026-11-24', '18:00'), 'micro')
    expect(m).toBeGreaterThan(10)
  })

  test('micro: al mediodía de verano el sol va alto → 0', () => {
    expect(exposureMinutes(prepared, chileToUtc('2026-12-21', '13:40'), 'micro')).toBe(0)
  })

  test('a pie: minutos con sol fuerte (alto también cuenta, aunque no sea de lado)', () => {
    expect(exposureMinutes(prepared, chileToUtc('2026-12-21', '13:40'), 'pie')).toBeCloseTo(15, 1)
    expect(exposureMinutes(prepared, chileToUtc('2026-11-24', '20:00'), 'pie')).toBe(0)
  })
})

describe('departureProfile', () => {
  test('un valor cada 10 min entre 05:00 y 22:00', () => {
    const p = departureProfile(prepared, '2026-11-24', 'micro')
    expect(p).toHaveLength((SLIDER.max - SLIDER.min) / 10 + 1)
    expect(p[0]!.time).toBe('05:00')
    expect(p.at(-1)!.time).toBe('22:00')
  })

  test('de noche no hay sol', () => {
    const p = departureProfile(prepared, '2026-11-24', 'pie')
    expect(p.find((x) => x.time === '05:00')!.minutes).toBe(0)
    expect(p.find((x) => x.time === '22:00')!.minutes).toBe(0)
  })

  test('fecha inválida → lista vacía', () => {
    expect(departureProfile(prepared, 'nada', 'micro')).toEqual([])
  })
})

describe('suggestDeparture', () => {
  const profile = [
    { time: '13:00', minutes: 2 },
    { time: '13:30', minutes: 0 },
    { time: '14:00', minutes: 6 },
    { time: '15:00', minutes: 12 },
    { time: '17:00', minutes: 1 },
  ]

  test('busca la hora con menos sol cerca de la tuya (±90 min)', () => {
    expect(suggestDeparture(profile, '15:00', 12)).toEqual({ time: '13:30', minutes: 0, saving: 12 })
  })

  test('con empate, la más cercana a tu hora', () => {
    const tie = [
      { time: '14:00', minutes: 1 },
      { time: '16:00', minutes: 1 },
      { time: '15:20', minutes: 9 },
    ]
    expect(suggestDeparture(tie, '15:30', 9)!.time).toBe('16:00')
  })

  test('no sugiere si el ahorro es poco (< 3 min o < 20 %)', () => {
    expect(suggestDeparture(profile, '13:00', 2)).toBeNull()
    expect(suggestDeparture([{ time: '10:00', minutes: 37 }], '10:30', 40)).toBeNull()
  })

  test('no mira más allá de 90 min', () => {
    expect(suggestDeparture([{ time: '10:00', minutes: 0 }], '13:00', 20)).toBeNull()
  })
})
