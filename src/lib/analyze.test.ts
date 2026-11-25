import { describe, expect, test } from 'vitest'
import { analyzePrepared, analyzeRoute, prepareRoute, verdictFor, type Route } from './analyze'
import type { LngLat } from './geo'
import { chileToUtc } from './time'

const START: LngLat = [-70.6506, -33.4378] // Plaza de Armas

/** Línea recta de `km` kilómetros desde `from`, hacia el sur (-1) o el norte (+1), en n segmentos. */
function straight(from: LngLat, km: number, dir: 1 | -1, n = 10): LngLat[] {
  const dLat = (km / 111.2) * dir
  return Array.from({ length: n + 1 }, (_, i): LngLat => [from[0], from[1] + (dLat * i) / n])
}

function route(coords: LngLat[], durationS: number, segmentDurationsS?: number[]): Route {
  return { coords, durationS, segmentDurationsS: segmentDurationsS ?? null }
}

const AT_18 = chileToUtc('2026-11-24', '18:00')

describe('analyzeRoute: casos de referencia en Santiago', () => {
  test('24 nov 18:00 hacia el sur → sol en el lado puerta → sentarse al lado chofer', () => {
    const a = analyzeRoute(route(straight(START, 3, -1), 600), AT_18)
    expect(a.minutes.puerta).toBeGreaterThan(0)
    expect(a.minutes.chofer).toBe(0)
    expect(a.verdict).toEqual({ kind: 'sentarse', side: 'chofer' })
    expect(a.dominant?.side).toBe('puerta')
    expect(a.dominant!.relAngle).toBeGreaterThan(20)
    expect(a.dominant!.relAngle).toBeLessThan(160)
  })

  test('mismo día y hora hacia el norte → sol en el lado chofer → sentarse al lado puerta', () => {
    const a = analyzeRoute(route(straight(START, 3, 1), 600), AT_18)
    expect(a.minutes.chofer).toBeGreaterThan(0)
    expect(a.minutes.puerta).toBe(0)
    expect(a.verdict).toEqual({ kind: 'sentarse', side: 'puerta' })
    expect(a.dominant?.side).toBe('chofer')
  })

  test('mediodía de verano → sin sol de lado (sol muy alto)', () => {
    const a = analyzeRoute(route(straight(START, 3, -1), 600), chileToUtc('2026-12-21', '13:40'))
    expect(a.minutes.chofer).toBe(0)
    expect(a.minutes.puerta).toBe(0)
    expect(a.minutes.none).toBeCloseTo(15, 6)
    expect(a.verdict).toEqual({ kind: 'da-lo-mismo' })
    expect(a.dominant).toBeNull()
  })

  test('de noche → da lo mismo', () => {
    const a = analyzeRoute(route(straight(START, 3, 1), 600), chileToUtc('2026-11-24', '23:00'))
    expect(a.verdict).toEqual({ kind: 'da-lo-mismo' })
  })
})

describe('analyzeRoute: tiempos y veredicto', () => {
  const south = straight(START, 2, -1, 5)
  const backNorth = straight(south.at(-1)!, 2, 1, 5).slice(1)
  const roundTrip = [...south, ...backNorth]

  test('aplica el factor micro (×1,5) al tiempo del auto', () => {
    const a = analyzeRoute(route(straight(START, 3, -1), 600), AT_18)
    expect(a.totalMinutes).toBeCloseTo(15, 6)
    expect(a.minutes.puerta + a.minutes.chofer + a.minutes.none).toBeCloseTo(15, 6)
  })

  test('el factor es configurable', () => {
    const a = analyzeRoute(route(straight(START, 3, -1), 600), AT_18, { busFactor: 2 })
    expect(a.totalMinutes).toBeCloseTo(20, 6)
  })

  test('ida y vuelta con el mismo tiempo → está parejo', () => {
    const a = analyzeRoute(route(roundTrip, 600), AT_18)
    expect(a.verdict).toEqual({ kind: 'parejo' })
    expect(a.runs.map((r) => r.side)).toEqual(['puerta', 'chofer'])
  })

  test('usa la duración de cada segmento cuando viene en la ruta', () => {
    // ida lenta (900 s) y vuelta rápida (100 s): domina la ida, con sol en el lado puerta
    const durations = [...Array<number>(5).fill(180), ...Array<number>(5).fill(20)]
    const a = analyzeRoute(route(roundTrip, 1000, durations), AT_18)
    expect(a.minutes.puerta).toBeCloseTo((900 * 1.5) / 60, 3)
    expect(a.minutes.chofer).toBeCloseTo((100 * 1.5) / 60, 3)
    expect(a.verdict).toEqual({ kind: 'sentarse', side: 'chofer' })
  })

  // En la vuelta en U un tramo de 50 m queda con un pie a cada lado: por eso los márgenes de 0,01 min.
  test('si las duraciones por segmento no sirven, reparte el total según la distancia', () => {
    const a = analyzeRoute(route(roundTrip, 1000, [1, 2, 3]), AT_18)
    expect(a.minutes.puerta).toBeCloseTo(a.minutes.chofer, 2)
    expect(a.totalMinutes).toBeCloseTo(25, 6)
  })

  test('en la ruta: 8 % de diferencia → parejo; 12 % → recomienda', () => {
    const even = [...Array<number>(5).fill(108), ...Array<number>(5).fill(92)]
    expect(analyzeRoute(route(roundTrip, 1000, even), AT_18).verdict).toEqual({ kind: 'parejo' })
    const uneven = [...Array<number>(5).fill(112), ...Array<number>(5).fill(88)]
    expect(analyzeRoute(route(roundTrip, 1000, uneven), AT_18).verdict).toEqual({ kind: 'sentarse', side: 'chofer' })
  })
})

describe('verdictFor', () => {
  test('diferencia de justo 10 % → parejo; apenas más → recomienda el lado contrario', () => {
    expect(verdictFor({ chofer: 4.5, puerta: 5.5, none: 0 }, 10)).toEqual({ kind: 'parejo' })
    expect(verdictFor({ chofer: 4.4, puerta: 5.6, none: 0 }, 10)).toEqual({ kind: 'sentarse', side: 'chofer' })
    expect(verdictFor({ chofer: 6, puerta: 1, none: 3 }, 10)).toEqual({ kind: 'sentarse', side: 'puerta' })
  })

  test('el 10 % es del viaje completo, incluido el tiempo sin sol de lado', () => {
    expect(verdictFor({ chofer: 0, puerta: 2, none: 18 }, 20)).toEqual({ kind: 'parejo' })
  })

  test('sin minutos de sol de lado → da lo mismo', () => {
    expect(verdictFor({ chofer: 0, puerta: 0, none: 10 }, 10)).toEqual({ kind: 'da-lo-mismo' })
  })
})

describe('analyzeRoute: tramos para el mapa', () => {
  test('junta tramos seguidos del mismo lado en una sola línea continua', () => {
    const coords = straight(START, 3, -1)
    const a = analyzeRoute(route(coords, 600), AT_18)
    expect(a.runs).toHaveLength(1)
    expect(a.runs[0]!.coords[0]).toEqual(coords[0])
    expect(a.runs[0]!.coords.at(-1)).toEqual(coords.at(-1))
  })

  test('ruta sin largo → sin tramos y da lo mismo', () => {
    const a = analyzeRoute(route([START, START], 60), AT_18)
    expect(a.runs).toEqual([])
    expect(a.verdict).toEqual({ kind: 'da-lo-mismo' })
  })

  test('rechaza duraciones u horas inválidas', () => {
    expect(() => analyzeRoute(route(straight(START, 1, 1), -5), AT_18)).toThrow(RangeError)
    expect(() => analyzeRoute(route(straight(START, 1, 1), Number.NaN), AT_18)).toThrow(RangeError)
    expect(() => analyzeRoute(route(straight(START, 1, 1), 60), Number.NaN)).toThrow(RangeError)
  })
})

describe('analyzeRoute: el sol aunque no pegue de lado', () => {
  test('mediodía de verano: motivo "alto" y el sol queda registrado con su elevación', () => {
    const a = analyzeRoute(route(straight(START, 3, -1), 600), chileToUtc('2026-12-21', '13:40'))
    expect(a.reasons.alto).toBeCloseTo(15, 6)
    expect(a.sky).not.toBeNull()
    expect(a.sky!.elevation).toBeGreaterThan(65)
  })

  test('de noche: motivo "noche" y sin sol', () => {
    const a = analyzeRoute(route(straight(START, 3, 1), 600), chileToUtc('2026-11-24', '23:00'))
    expect(a.reasons.noche).toBeCloseTo(15, 6)
    expect(a.sky).toBeNull()
  })

  test('hacia el oeste a las 18:00: sol de frente', () => {
    const west: LngLat[] = Array.from({ length: 11 }, (_, i): LngLat => [START[0] - (0.03 * i) / 10, START[1]])
    const a = analyzeRoute(route(west, 600), AT_18)
    expect(a.reasons.frente).toBeGreaterThan(a.totalMinutes * 0.9)
    expect(a.verdict).toEqual({ kind: 'da-lo-mismo' })
    // de frente: ángulo relativo cerca de 0
    const rel = a.sky!.relAngle
    expect(Math.min(rel, 360 - rel)).toBeLessThan(20)
  })

  test('hacia el este a las 18:00: sol por atrás', () => {
    const east: LngLat[] = Array.from({ length: 11 }, (_, i): LngLat => [START[0] + (0.03 * i) / 10, START[1]])
    const a = analyzeRoute(route(east, 600), AT_18)
    expect(a.reasons.atras).toBeGreaterThan(a.totalMinutes * 0.9)
    expect(Math.abs(a.sky!.relAngle - 180)).toBeLessThan(20)
  })

  test('los motivos suman los minutos sin sol de lado', () => {
    const a = analyzeRoute(route(straight(START, 3, -1), 600), chileToUtc('2026-12-21', '13:40'))
    const r = a.reasons
    expect(r.noche + r.alto + r.frente + r.atras).toBeCloseTo(a.minutes.none, 6)
  })

  test('el lado dominante trae la elevación promedio del sol', () => {
    const a = analyzeRoute(route(straight(START, 3, -1), 600), AT_18)
    expect(a.dominant!.elevation).toBeGreaterThan(10)
    expect(a.dominant!.elevation).toBeLessThan(45)
  })

  test('cada tramo del mapa trae sus minutos y suman el viaje', () => {
    const south = straight(START, 2, -1, 5)
    const a = analyzeRoute(route([...south, ...straight(south.at(-1)!, 2, 1, 5).slice(1)], 600), AT_18)
    expect(a.runs.reduce((s, r) => s + r.minutes, 0)).toBeCloseTo(a.totalMinutes, 6)
  })
})

describe('analyzeRoute: sol bajo en la cara', () => {
  const west: LngLat[] = Array.from({ length: 11 }, (_, i): LngLat => [START[0] - (0.03 * i) / 10, START[1]])
  const east: LngLat[] = Array.from({ length: 11 }, (_, i): LngLat => [START[0] + (0.03 * i) / 10, START[1]])

  test('hacia el poniente a las 19:00: el sol bajo da en la cara todo el viaje', () => {
    const a = analyzeRoute(route(west, 600), chileToUtc('2026-11-24', '19:00'))
    expect(a.glareMinutes).toBeCloseTo(a.totalMinutes, 1)
  })

  test('de espalda al sol o con el sol alto no encandila', () => {
    expect(analyzeRoute(route(east, 600), chileToUtc('2026-11-24', '19:00')).glareMinutes).toBe(0)
    expect(analyzeRoute(route(west, 600), chileToUtc('2026-12-21', '13:40')).glareMinutes).toBe(0)
  })
})

describe('prepareRoute + analyzePrepared', () => {
  test('preparar una vez y evaluar a otra hora da lo mismo que analizar de cero', () => {
    const r = route(straight(START, 3, -1), 600)
    const prepared = prepareRoute(r)
    for (const t of ['08:00', '13:40', '18:00', '23:00']) {
      const dep = chileToUtc('2026-11-24', t)
      expect(analyzePrepared(prepared, dep)).toEqual(analyzeRoute(r, dep))
    }
  })

  test('la ruta preparada trae los minutos totales con el factor aplicado', () => {
    expect(prepareRoute(route(straight(START, 3, -1), 600), { busFactor: 2 }).totalMinutes).toBeCloseTo(20, 6)
  })
})
