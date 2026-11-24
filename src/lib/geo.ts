/** [longitud, latitud], el mismo orden que GeoJSON y OSRM. */
export type LngLat = [lng: number, lat: number]

export interface Piece {
  from: LngLat
  to: LngLat
  /** Largo recorrido sobre la ruta (no en línea recta). */
  lengthM: number
  durationS: number
}

const RAD = Math.PI / 180
const EARTH_RADIUS_M = 6371008.8
const EPS = 1e-9

/** Rumbo inicial de a hacia b, en grados: 0 = norte, en sentido horario. */
export function bearing(a: LngLat, b: LngLat): number {
  const f1 = a[1] * RAD
  const f2 = b[1] * RAD
  const dl = (b[0] - a[0]) * RAD
  const y = Math.sin(dl) * Math.cos(f2)
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)
  return (Math.atan2(y, x) / RAD + 360) % 360
}

/** Distancia (haversine) en metros. */
export function distance(a: LngLat, b: LngLat): number {
  const dp = (b[1] - a[1]) * RAD
  const dl = (b[0] - a[0]) * RAD
  const h = Math.sin(dp / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dl / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

const lerp = (a: LngLat, b: LngLat, t: number): LngLat => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/**
 * Divide una línea en tramos contiguos de `stepM` metros (el último puede ser más corto).
 * `durationsS[i]` es la duración del segmento coords[i]→coords[i+1] y se reparte según el largo.
 * Conserva el largo y la duración totales.
 */
export function resample(coords: readonly LngLat[], durationsS: readonly number[], stepM: number): Piece[] {
  if (!(stepM > 0)) throw new RangeError('El largo del tramo debe ser positivo')
  if (coords.length >= 2 && durationsS.length !== coords.length - 1) {
    throw new RangeError('Se necesita una duración por segmento')
  }

  const pieces: Piece[] = []
  let start: LngLat | null = null
  let len = 0
  let dur = 0
  let lastPoint: LngLat | null = null

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!
    const b = coords[i + 1]!
    const d = distance(a, b)
    const segDur = durationsS[i]!
    if (d === 0) {
      dur += segDur // un punto repetido no tiene rumbo, pero su tiempo cuenta
      continue
    }
    start ??= a
    lastPoint = b
    let pos = 0
    while (d - pos > EPS) {
      const take = Math.min(stepM - len, d - pos)
      pos += take
      len += take
      dur += (segDur * take) / d
      if (len >= stepM - EPS) {
        const end = d - pos <= EPS ? b : lerp(a, b, pos / d)
        pieces.push({ from: start, to: end, lengthM: len, durationS: dur })
        start = end
        len = 0
        dur = 0
      }
    }
  }

  if (len > EPS && start && lastPoint) {
    pieces.push({ from: start, to: lastPoint, lengthM: len, durationS: dur })
  } else if (dur > 0 && pieces.length > 0) {
    pieces[pieces.length - 1]!.durationS += dur
  }
  return pieces
}
