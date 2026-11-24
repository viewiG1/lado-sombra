import { BUS_TIME_FACTOR, EVEN_THRESHOLD, PIECE_LENGTH_M } from '../config'
import { bearing, distance, resample, type LngLat } from './geo'
import { classifySide, relativeAngle, sunPosition, type Side } from './sun'

/** Ruta de auto tal como la entrega el proveedor de rutas. */
export interface Route {
  coords: LngLat[]
  /** Duración total en auto, en segundos. */
  durationS: number
  /** Duración de cada segmento coords[i]→coords[i+1], si el proveedor la da. */
  segmentDurationsS: number[] | null
}

export type SunSide = Exclude<Side, 'none'>

export type Verdict = { kind: 'sentarse'; side: SunSide } | { kind: 'parejo' } | { kind: 'da-lo-mismo' }

/** Tramo continuo con el mismo lado de sol, para pintar en el mapa. */
export interface Run {
  side: Side
  coords: LngLat[]
}

export interface Analysis {
  runs: Run[]
  /** Minutos de viaje en micro según dónde pega el sol. */
  minutes: Record<Side, number>
  totalMinutes: number
  verdict: Verdict
  /** Lado que recibe más sol y ángulo promedio del sol respecto de la micro (para el dibujo). */
  dominant: { side: SunSide; relAngle: number } | null
}

export interface AnalyzeOptions {
  busFactor?: number
  pieceLengthM?: number
}

const RAD = Math.PI / 180
const opposite = (s: SunSide): SunSide => (s === 'chofer' ? 'puerta' : 'chofer')

function segmentDurations(route: Route): number[] {
  const n = route.coords.length - 1
  if (n < 1) return []
  const given = route.segmentDurationsS
  if (given && given.length === n && given.every((d) => Number.isFinite(d) && d >= 0) && given.some((d) => d > 0)) {
    return given
  }
  const lengths = route.coords.slice(1).map((p, i) => distance(route.coords[i]!, p))
  const total = lengths.reduce((s, l) => s + l, 0)
  return lengths.map((l) => (total > 0 ? (l / total) * route.durationS : 0))
}

export function analyzeRoute(route: Route, departureUtcMs: number, options: AnalyzeOptions = {}): Analysis {
  const busFactor = options.busFactor ?? BUS_TIME_FACTOR
  const pieceLengthM = options.pieceLengthM ?? PIECE_LENGTH_M
  if (!Number.isFinite(route.durationS) || route.durationS < 0) throw new RangeError('Duración de ruta inválida')
  if (!Number.isFinite(departureUtcMs)) throw new RangeError('Hora de salida inválida')
  if (!(busFactor > 0)) throw new RangeError('El factor micro debe ser positivo')

  const pieces = resample(route.coords, segmentDurations(route), pieceLengthM)
  const minutes: Record<Side, number> = { chofer: 0, puerta: 0, none: 0 }
  // Suma vectorial del ángulo relativo, ponderada por minutos, para ubicar el sol en el dibujo.
  const vec: Record<SunSide, [number, number]> = { chofer: [0, 0], puerta: [0, 0] }
  const runs: Run[] = []
  let elapsedMin = 0

  for (const p of pieces) {
    const pieceMin = (p.durationS * busFactor) / 60
    const midTime = departureUtcMs + (elapsedMin + pieceMin / 2) * 60000
    elapsedMin += pieceMin
    const heading = bearing(p.from, p.to)
    const mid: LngLat = [(p.from[0] + p.to[0]) / 2, (p.from[1] + p.to[1]) / 2]
    const sun = sunPosition(midTime, mid[1], mid[0])
    const side = classifySide(sun, heading)
    minutes[side] += pieceMin
    if (side !== 'none') {
      const rel = relativeAngle(sun.azimuth, heading) * RAD
      vec[side][0] += Math.cos(rel) * pieceMin
      vec[side][1] += Math.sin(rel) * pieceMin
    }
    const last = runs.at(-1)
    if (last && last.side === side) last.coords.push(p.to)
    else runs.push({ side, coords: [p.from, p.to] })
  }

  let dominant: Analysis['dominant'] = null
  if (minutes.chofer + minutes.puerta > 0) {
    const side: SunSide = minutes.puerta > minutes.chofer ? 'puerta' : 'chofer'
    const [x, y] = vec[side]
    dominant = { side, relAngle: (Math.atan2(y, x) / RAD + 360) % 360 }
  }

  return { runs, minutes, totalMinutes: elapsedMin, verdict: verdictFor(minutes, elapsedMin), dominant }
}

/** Recomendación a partir de los minutos de sol por lado y el total del viaje. */
export function verdictFor(minutes: Record<Side, number>, totalMinutes: number): Verdict {
  if (minutes.chofer + minutes.puerta <= 0) return { kind: 'da-lo-mismo' }
  // Tolerancia mínima para que un empate exacto con el umbral no dependa del redondeo.
  if (Math.abs(minutes.chofer - minutes.puerta) <= EVEN_THRESHOLD * totalMinutes + 1e-9) return { kind: 'parejo' }
  return { kind: 'sentarse', side: opposite(minutes.puerta > minutes.chofer ? 'puerta' : 'chofer') }
}
