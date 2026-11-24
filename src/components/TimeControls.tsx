import { SLIDER } from '../config'
import { hhmmToMinutes, minutesToHhmm } from '../lib/time'

interface Props {
  date: string
  time: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onNow: () => void
}

const field = 'min-h-11 w-full min-w-0 rounded-xl border border-line bg-card px-3 text-base'
const label = 'mb-1 block text-sm font-medium text-mute'

export function TimeControls({ date, time, onDateChange, onTimeChange, onNow }: Props) {
  const minutes = hhmmToMinutes(time)
  const sliderValue = Math.min(SLIDER.max, Math.max(SLIDER.min, minutes))

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">Fecha y hora de salida</legend>
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
      <div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="slide" className="text-sm font-medium text-mute">
            Desliza para cambiar la hora
          </label>
          <button type="button" onClick={onNow} className="min-h-11 rounded-xl border border-line px-3 font-medium hover:bg-card">
            Ahora
          </button>
        </div>
        <input
          id="slide"
          type="range"
          min={SLIDER.min}
          max={SLIDER.max}
          step={SLIDER.step}
          value={sliderValue}
          aria-valuetext={time}
          onChange={(e) => onTimeChange(minutesToHhmm(Number(e.target.value)))}
          className="h-11 w-full cursor-pointer accent-sun"
        />
        <div className="flex justify-between text-xs text-mute" aria-hidden="true">
          <span>{minutesToHhmm(SLIDER.min)}</span>
          <span>{minutesToHhmm((SLIDER.min + SLIDER.max) / 2)}</span>
          <span>{minutesToHhmm(SLIDER.max)}</span>
        </div>
      </div>
    </fieldset>
  )
}
