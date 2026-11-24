import { getPosition } from 'suncalc'

/** Lado de la micro donde pega el sol. Chile: chofer a la izquierda, puerta a la derecha. */
export type Side = 'chofer' | 'puerta' | 'none'

export interface SunPosition {
  /** Grados desde el norte, en sentido horario. */
  azimuth: number
  /** Grados sobre el horizonte (negativo = de noche). */
  elevation: number
}

/** Con el sol así de alto entra poco por las ventanas: no cuenta como sol de lado. */
export const MAX_SIDE_ELEVATION = 65
/** Ángulo (a cada lado) en que el sol se considera de frente o por atrás. */
export const FRONT_BACK_TOLERANCE = 20

export function sunPosition(utcMs: number, lat: number, lon: number): SunPosition {
  const p = getPosition(new Date(utcMs), lat, lon)
  return { azimuth: ((p.azimuth % 360) + 360) % 360, elevation: p.altitude }
}

/** Ángulo del sol respecto del frente de la micro, en [0, 360): 90 = derecha, 270 = izquierda. */
export function relativeAngle(sunAzimuth: number, heading: number): number {
  return (((sunAzimuth - heading) % 360) + 360) % 360
}

export function classifySide(sun: SunPosition, heading: number): Side {
  if (sun.elevation <= 0 || sun.elevation >= MAX_SIDE_ELEVATION) return 'none'
  const rel = relativeAngle(sun.azimuth, heading)
  const t = FRONT_BACK_TOLERANCE
  if (rel < t || rel > 360 - t) return 'none' // de frente
  if (rel > 180 - t && rel < 180 + t) return 'none' // por atrás
  return rel < 180 ? 'puerta' : 'chofer'
}
