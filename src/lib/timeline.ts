import { SLIDER } from '../config'
import { hhmmToMinutes, minutesToHhmm } from './time'

/** Hora de llegada ("HH:MM") a partir de la salida y los minutos de viaje. */
export function arrivalTime(departure: string, totalMinutes: number): string {
  return minutesToHhmm((hhmmToMinutes(departure) + Math.round(totalMinutes)) % 1440)
}

/** Posición (0–100 %) de una hora dentro del deslizador. */
export function sliderPercent(time: string): number {
  const m = hhmmToMinutes(time)
  return Math.min(100, Math.max(0, ((m - SLIDER.min) / (SLIDER.max - SLIDER.min)) * 100))
}

/** Fondo del deslizador: noche antes de la salida del sol y después de la puesta, día en medio. */
export function dayTrack(sun: { sunrise: string; sunset: string } | null): string {
  if (!sun) return 'var(--sun-day)'
  const a = sliderPercent(sun.sunrise)
  const b = sliderPercent(sun.sunset)
  return `linear-gradient(to right, var(--sun-night) ${a - 3}%, var(--sun-day) ${a + 3}%, var(--sun-day) ${b - 3}%, var(--sun-night) ${b + 3}%)`
}
