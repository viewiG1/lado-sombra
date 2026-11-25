import { SLIDER } from '../config'
import type { PreparedRoute } from './analyze'
import type { TravelMode } from './modes'
import { sunPosition, sunSituation } from './sun'
import { chileToUtc, hhmmToMinutes, minutesToHhmm } from './time'

/** Desde esta altura el UV estimado llega a 3 (9,5 · sen(el)^1,5 = 3): sol fuerte para quien va expuesto. */
const STRONG_SUN_ELEVATION = 27.6
const PROFILE_STEP_MIN = 10
const SEARCH_WINDOW_MIN = 90
const MIN_SAVING_MIN = 3
const MIN_SAVING_RATIO = 0.2

/**
 * Minutos de sol que importan en ese modo, saliendo a esa hora.
 * Micro: sol de lado (por la ventana). Bici y a pie: sol fuerte, venga de donde venga.
 */
export function exposureMinutes(prepared: PreparedRoute, departureUtcMs: number, mode: TravelMode): number {
  let total = 0
  for (const p of prepared.pieces) {
    const sun = sunPosition(departureUtcMs + p.midMin * 60000, p.mid[1], p.mid[0])
    if (mode === 'micro') {
      const s = sunSituation(sun, p.heading)
      if (s === 'chofer' || s === 'puerta') total += p.minutes
    } else if (sun.elevation >= STRONG_SUN_ELEVATION) {
      total += p.minutes
    }
  }
  return total
}

export interface ProfilePoint {
  time: string
  minutes: number
}

/** Minutos de sol según la hora de salida, cada 10 min dentro del rango del deslizador. */
export function departureProfile(prepared: PreparedRoute, date: string, mode: TravelMode): ProfilePoint[] {
  const points: ProfilePoint[] = []
  try {
    for (let m = SLIDER.min; m <= SLIDER.max; m += PROFILE_STEP_MIN) {
      const time = minutesToHhmm(m)
      points.push({ time, minutes: exposureMinutes(prepared, chileToUtc(date, time), mode) })
    }
  } catch {
    return []
  }
  return points
}

export interface Suggestion extends ProfilePoint {
  /** Minutos de sol que te ahorras respecto de tu hora. */
  saving: number
}

/** La hora cercana (±90 min) con menos sol, si ahorra lo suficiente como para valer la pena. */
export function suggestDeparture(profile: ProfilePoint[], currentTime: string, currentMinutes: number): Suggestion | null {
  const now = hhmmToMinutes(currentTime)
  let best: ProfilePoint | null = null
  for (const p of profile) {
    const dist = Math.abs(hhmmToMinutes(p.time) - now)
    if (dist > SEARCH_WINDOW_MIN) continue
    if (!best || p.minutes < best.minutes || (p.minutes === best.minutes && dist < Math.abs(hhmmToMinutes(best.time) - now))) {
      best = p
    }
  }
  if (!best) return null
  const saving = currentMinutes - best.minutes
  if (saving < MIN_SAVING_MIN || saving < currentMinutes * MIN_SAVING_RATIO) return null
  return { ...best, saving }
}
