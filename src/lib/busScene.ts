import type { SunSide, SunSummary } from './analyze'
import { sunSituation, type Situation } from './sun'

/** Coordenadas del dibujo de la micro (viewBox 0 0 320 320), con el frente hacia arriba. */
export const CENTER = 160
/** Distancia del sol al centro (órbita). Solo con el sol "alto" pasa encima del techo. */
export const ORBIT = 132
const MAX_SHADOW = 48
const MIN_SHADOW = 4

export interface BusScene {
  situation: Situation
  /** Ángulo (0 = adelante, 90 = lado puerta) y distancia al centro; x, y en el dibujo. */
  sun: { angle: number; distance: number; x: number; y: number } | null
  /** Desplazamiento de la sombra de la micro sobre el suelo. */
  shadow: { dx: number; dy: number } | null
}

const RAD = Math.PI / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function busScene({ sun, lit }: { sun: SunSummary | null; lit: SunSide | null }): BusScene {
  if (!sun || sun.elevation <= 0) return { situation: lit ?? 'noche', sun: null, shadow: null }

  const situation = lit ?? sunSituation({ azimuth: sun.relAngle, elevation: sun.elevation }, 0)
  // Mientras pegue de lado (< 65°) el sol se dibuja afuera; si va alto, encima del techo.
  const distance = situation === 'alto' ? 0 : ORBIT
  const sin = Math.sin(sun.relAngle * RAD)
  const cos = Math.cos(sun.relAngle * RAD)
  // Largo de la sombra de un cuerpo de altura fija: crece cuando el sol baja.
  const length = clamp(18 / Math.tan(clamp(sun.elevation, 1, 89) * RAD), MIN_SHADOW, MAX_SHADOW)

  return {
    situation,
    sun: { angle: sun.relAngle, distance, x: CENTER + distance * sin, y: CENTER - distance * cos },
    shadow: { dx: -length * sin, dy: length * cos },
  }
}
