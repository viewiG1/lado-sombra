import { getPosition, getTimes } from 'suncalc'
import { chileNow, chileToUtc } from './time'

/** Lado de la micro donde pega el sol. Chile: chofer a la izquierda, puerta a la derecha. */
export type Side = 'chofer' | 'puerta' | 'none'

/** Dónde está el sol respecto de la micro: un lado, o el motivo por el que no pega de lado. */
export type Situation = 'chofer' | 'puerta' | 'frente' | 'atras' | 'alto' | 'noche'

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

export function sunSituation(sun: SunPosition, heading: number): Situation {
  if (sun.elevation <= 0) return 'noche'
  if (sun.elevation >= MAX_SIDE_ELEVATION) return 'alto'
  const rel = relativeAngle(sun.azimuth, heading)
  const t = FRONT_BACK_TOLERANCE
  if (rel < t || rel > 360 - t) return 'frente'
  if (rel > 180 - t && rel < 180 + t) return 'atras'
  return rel < 180 ? 'puerta' : 'chofer'
}

export function classifySide(sun: SunPosition, heading: number): Side {
  const s = sunSituation(sun, heading)
  return s === 'chofer' || s === 'puerta' ? s : 'none'
}

/** Hora de Chile ("HH:MM") a la que sale y se pone el sol ese día en ese lugar; null si no se puede calcular. */
export function sunTimes(date: string, lat: number, lon: number): { sunrise: string; sunset: string } | null {
  let noon: number
  try {
    noon = chileToUtc(date, '12:00')
  } catch {
    return null
  }
  const t = getTimes(new Date(noon), lat, lon)
  if (!t.sunrise || !t.sunset) return null
  return { sunrise: chileNow(t.sunrise.getTime()).time, sunset: chileNow(t.sunset.getTime()).time }
}
