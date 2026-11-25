import { BUS_TIME_FACTOR, EVEN_THRESHOLD, PIECE_LENGTH_M } from '../config'
import { bearing, distance, resample, type LngLat } from './geo'
import { relativeAngle, sunPosition, sunSituation, type Side, type Situation } from './sun'

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
  /** Minutos de viaje en micro de este tramo. */
  minutes: number
}

/** Motivos por los que el sol no pega de lado. */
export type NoSideReason = Exclude<Situation, SunSide>

/** Posición promedio del sol respecto de la micro (ángulo 0 = de frente, 90 = lado puerta) y su altura. */
export interface SunSummary {
  relAngle: number
  elevation: number
}

export interface Analysis {
  runs: Run[]
  /** Minutos de viaje en micro según dónde pega el sol. */
  minutes: Record<Side, number>
  totalMinutes: number
  verdict: Verdict
  /** Minutos con el sol bajo de frente (encandila a quien camina o pedalea). */
  glareMinutes: number
  /** Minutos sin sol de lado, según el motivo (suman minutes.none). */
  reasons: Record<NoSideReason, number>
  /** Lado que recibe más sol y dónde está el sol en promedio mientras pega ahí (para el dibujo). */
  dominant: ({ side: SunSide } & SunSummary) | null
  /** Dónde está el sol en promedio durante el viaje, pegue o no de lado; null si es de noche todo el viaje. */
  sky: SunSummary | null
}

export interface AnalyzeOptions {
  busFactor?: number
  pieceLengthM?: number
}

const RAD = Math.PI / 180
/** Bajo esta altura, el sol de frente da en los ojos. */
export const GLARE_MAX_ELEVATION = 30
const opposite = (s: SunSide): SunSide => (s === 'chofer' ? 'puerta' : 'chofer')

/** Promedio de ángulos con suma vectorial (359° y 1° promedian 0°, no 180°), ponderado por minutos. */
class SunAverage {
  private x = 0
  private y = 0
  private el = 0
  private w = 0

  add(relAngle: number, elevation: number, weight: number) {
    this.x += Math.cos(relAngle * RAD) * weight
    this.y += Math.sin(relAngle * RAD) * weight
    this.el += elevation * weight
    this.w += weight
  }

  result(): SunSummary | null {
    if (this.w <= 0) return null
    return { relAngle: (Math.atan2(this.y, this.x) / RAD + 360) % 360, elevation: this.el / this.w }
  }
}

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
  const reasons: Record<NoSideReason, number> = { frente: 0, atras: 0, alto: 0, noche: 0 }
  const bySide: Record<SunSide, SunAverage> = { chofer: new SunAverage(), puerta: new SunAverage() }
  const sky = new SunAverage()
  let glareMinutes = 0
  const runs: Run[] = []
  let elapsedMin = 0

  for (const p of pieces) {
    const pieceMin = (p.durationS * busFactor) / 60
    const midTime = departureUtcMs + (elapsedMin + pieceMin / 2) * 60000
    elapsedMin += pieceMin
    const heading = bearing(p.from, p.to)
    const mid: LngLat = [(p.from[0] + p.to[0]) / 2, (p.from[1] + p.to[1]) / 2]
    const sun = sunPosition(midTime, mid[1], mid[0])
    const situation = sunSituation(sun, heading)
    const rel = relativeAngle(sun.azimuth, heading)
    let side: Side
    if (situation === 'chofer' || situation === 'puerta') {
      side = situation
      bySide[situation].add(rel, sun.elevation, pieceMin)
    } else {
      side = 'none'
      reasons[situation] += pieceMin
      if (situation === 'frente' && sun.elevation < GLARE_MAX_ELEVATION) glareMinutes += pieceMin
    }
    minutes[side] += pieceMin
    if (sun.elevation > 0) sky.add(rel, sun.elevation, pieceMin)

    const last = runs.at(-1)
    if (last && last.side === side) {
      last.coords.push(p.to)
      last.minutes += pieceMin
    } else {
      runs.push({ side, coords: [p.from, p.to], minutes: pieceMin })
    }
  }

  let dominant: Analysis['dominant'] = null
  if (minutes.chofer + minutes.puerta > 0) {
    const side: SunSide = minutes.puerta > minutes.chofer ? 'puerta' : 'chofer'
    const avg = bySide[side].result()
    if (avg) dominant = { side, ...avg }
  }

  return {
    runs,
    minutes,
    totalMinutes: elapsedMin,
    verdict: verdictFor(minutes, elapsedMin),
    glareMinutes,
    reasons,
    dominant,
    sky: sky.result(),
  }
}

/** Recomendación a partir de los minutos de sol por lado y el total del viaje. */
export function verdictFor(minutes: Record<Side, number>, totalMinutes: number): Verdict {
  if (minutes.chofer + minutes.puerta <= 0) return { kind: 'da-lo-mismo' }
  // Tolerancia mínima para que un empate exacto con el umbral no dependa del redondeo.
  if (Math.abs(minutes.chofer - minutes.puerta) <= EVEN_THRESHOLD * totalMinutes + 1e-9) return { kind: 'parejo' }
  return { kind: 'sentarse', side: opposite(minutes.puerta > minutes.chofer ? 'puerta' : 'chofer') }
}
