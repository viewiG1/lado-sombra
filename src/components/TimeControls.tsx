import type { CSSProperties } from 'react'
import { SLIDER } from '../config'
import { hhmmToMinutes, minutesToHhmm } from '../lib/time'
import type { ProfilePoint, Suggestion } from '../lib/bestTime'
import { dayTrack } from '../lib/timeline'

interface Props {
  date: string
  time: string
  /** Salida y puesta del sol ese día (hora de Chile); null si no se sabe. */
  sun: { sunrise: string; sunset: string } | null
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onNow: () => void
  /** Minutos de sol según la hora de salida (solo con ruta). */
  profile?: ProfilePoint[]
  suggestion?: Suggestion | null
  /** Qué se mide: "de sol de lado" o "de sol fuerte". */
  metric?: string
}

const field = 'min-h-11 w-full min-w-0 rounded-xl border border-line bg-card px-3 text-base'
const label = 'mb-1 block text-sm font-medium text-mute'

/** Franja sobre el deslizador: más amarilla donde hay más sol. Alineada con la pista (la perilla mide 30 px). */
function SunStrip({ profile, metric }: { profile: ProfilePoint[]; metric: string }) {
  const max = Math.max(...profile.map((p) => p.minutes))
  if (max <= 0) return null
  const least = profile.reduce((a, b) => (b.minutes < a.minutes ? b : a))
  const most = profile.reduce((a, b) => (b.minutes > a.minutes ? b : a))
  const r = Math.round
  return (
    <div className="mx-[15px]">
      <div className="mb-1 text-xs text-mute">Sol durante el viaje según la hora de salida</div>
      <div
        role="img"
        aria-label={`Menos sol saliendo a las ${least.time} (${r(least.minutes)} min ${metric}); más sol a las ${most.time} (${r(most.minutes)} min).`}
        className="flex h-3 overflow-hidden rounded-full bg-card"
      >
        {profile.map((p) => (
          <span key={p.time} className="h-full flex-1" style={{ background: 'var(--sun)', opacity: 0.12 + (p.minutes / max) * 0.88 }} />
        ))}
      </div>
    </div>
  )
}

export function TimeControls({ date, time, sun, onDateChange, onTimeChange, onNow, profile, suggestion, metric = 'de sol' }: Props) {
  const minutes = hhmmToMinutes(time)
  const sliderValue = Math.min(SLIDER.max, Math.max(SLIDER.min, minutes))

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 font-display text-2xl font-bold">¿A qué hora sales?</legend>

      <div className="flex items-end justify-between gap-2">
        <output htmlFor="slide time" className="font-display text-5xl leading-none font-bold tabular-nums">
          {time}
        </output>
        <button type="button" onClick={onNow} className="min-h-11 rounded-xl border border-line px-4 font-medium hover:bg-card">
          Ahora
        </button>
      </div>

      <div className="grid gap-1">
        {profile && profile.length > 0 && <SunStrip profile={profile} metric={metric} />}
        <label htmlFor="slide" className="sr-only">
          Hora de salida
        </label>
        <input
          id="slide"
          type="range"
          min={SLIDER.min}
          max={SLIDER.max}
          step={SLIDER.step}
          value={sliderValue}
          aria-valuetext={time}
          onChange={(e) => onTimeChange(minutesToHhmm(Number(e.target.value)))}
          className="time-range w-full"
          style={{ '--track': dayTrack(sun) } as CSSProperties}
        />
        <div className="flex justify-between text-xs text-mute">
          <span aria-hidden="true">{minutesToHhmm(SLIDER.min)}</span>
          {sun && (
            <span>
              Sale el sol {sun.sunrise} · se pone {sun.sunset}
            </span>
          )}
          <span aria-hidden="true">{minutesToHhmm(SLIDER.max)}</span>
        </div>
      </div>

      {suggestion && (
        <button
          type="button"
          onClick={() => onTimeChange(suggestion.time)}
          className="min-h-11 rounded-xl border border-sun bg-sun/15 px-3 py-2 text-left text-sm font-medium hover:bg-sun/25"
        >
          <span aria-hidden="true">☀️ </span>
          Sal a las {suggestion.time}: {Math.round(suggestion.minutes)} min {metric} ({Math.round(suggestion.saving)} menos)
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="date" className={label}>
            Fecha
          </label>
          <input
            id="date"
            type="date"
            required
            value={date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="time" className={label}>
            Salida
          </label>
          <input
            id="time"
            type="time"
            required
            value={time}
            onChange={(e) => e.target.value && onTimeChange(e.target.value)}
            className={field}
          />
        </div>
      </div>
    </fieldset>
  )
}
