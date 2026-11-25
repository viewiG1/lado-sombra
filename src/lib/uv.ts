import { sunPosition } from './sun'

/** Serie por hora (instantes UTC). Cada valor es el promedio de la hora que termina en ese instante. */
export interface UvSeries {
  times: number[]
  uv: (number | null)[]
  clearSky: (number | null)[]
}

export type UvLevel = 'bajo' | 'moderado' | 'alto' | 'muy-alto' | 'extremo'

export interface UvCategory {
  level: UvLevel
  label: string
  advice: string
}

const HOUR = 3600000
const SAMPLE_MIN = 5

/**
 * UV con cielo despejado según la altura del sol. Calibrado con Open-Meteo en Santiago
 * (agosto y noviembre–diciembre 2026): UV ≈ 9,5 · sen(elevación)^1,5.
 */
export function estimateUv(elevationDeg: number): number {
  if (elevationDeg <= 0) return 0
  return 9.5 * Math.sin((elevationDeg * Math.PI) / 180) ** 1.5
}

/** Escala de la OMS (se redondea al entero más cercano, como se informa el índice). */
export function uvCategory(uv: number): UvCategory {
  const n = Math.round(uv)
  if (n <= 2) return { level: 'bajo', label: 'Bajo', advice: 'No necesitas protección especial.' }
  if (n <= 5) return { level: 'moderado', label: 'Moderado', advice: 'Usa bloqueador y lentes de sol si vas a estar al sol.' }
  if (n <= 7) return { level: 'alto', label: 'Alto', advice: 'Bloqueador, gorro y lentes de sol. Busca la sombra.' }
  if (n <= 10)
    return { level: 'muy-alto', label: 'Muy alto', advice: 'Evita el sol directo: bloqueador, gorro, lentes y ropa que cubra.' }
  return { level: 'extremo', label: 'Extremo', advice: 'Evita exponerte. Si sales: bloqueador, gorro, lentes, ropa que cubra y sombra.' }
}

/** Valor interpolado en el instante `ms`; null si la serie no lo cubre o no tiene datos. */
function seriesAt(times: number[], values: (number | null)[], ms: number): number | null {
  // El valor marcado a las HH es el promedio de la hora anterior: representa el instante HH − 30 min.
  const t = ms + HOUR / 2
  for (let i = 1; i < times.length; i++) {
    const t0 = times[i - 1]!
    const t1 = times[i]!
    if (t < t0 || t > t1) continue
    const a = values[i - 1]
    const b = values[i]
    if (a == null || b == null) return null
    return a + ((b - a) * (t - t0)) / (t1 - t0)
  }
  return null
}

export interface TripUv {
  /** UV máximo previsto durante el viaje. */
  uv: number
  /** UV máximo con cielo despejado (lo que podría haber sin nubes). */
  clearSky: number
  source: 'pronostico' | 'estimado'
}

/** UV máximo entre la salida y la llegada. Usa el pronóstico si lo cubre; si no, lo estima con la altura del sol. */
export function uvForTrip(input: { series: UvSeries | null; departureMs: number; minutes: number; lat: number; lon: number }): TripUv {
  const { series, departureMs, lat, lon } = input
  const minutes = Math.max(0, input.minutes)
  const samples: number[] = []
  for (let m = 0; m <= minutes; m += SAMPLE_MIN) samples.push(departureMs + m * 60000)
  if (samples.at(-1) !== departureMs + minutes * 60000) samples.push(departureMs + minutes * 60000)

  if (series) {
    let uv = 0
    let clear = 0
    let ok = true
    for (const ms of samples) {
      const u = seriesAt(series.times, series.uv, ms)
      const c = seriesAt(series.times, series.clearSky, ms)
      if (u === null) {
        ok = false
        break
      }
      uv = Math.max(uv, u)
      clear = Math.max(clear, c ?? u)
    }
    if (ok) return { uv, clearSky: Math.max(clear, uv), source: 'pronostico' }
  }

  const est = Math.max(...samples.map((ms) => estimateUv(sunPosition(ms, lat, lon).elevation)))
  return { uv: est, clearSky: est, source: 'estimado' }
}
