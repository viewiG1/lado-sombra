import type { Run } from '../lib/analyze'
import type { TravelMode } from '../lib/modes'
import type { Side } from '../lib/sun'
import { arrivalTime } from '../lib/timeline'

interface Props {
  departure: string
  totalMinutes: number
  minutes: Record<Side, number>
  runs: Run[]
  mode?: TravelMode
}

const COLOR: Record<Side, string> = { chofer: 'var(--chofer)', puerta: 'var(--puerta)', none: 'var(--nosun)' }
const LABEL: Record<'micro' | 'otro', Record<Side, string>> = {
  micro: { chofer: 'Sol lado chofer', puerta: 'Sol lado puerta', none: 'Sin sol de lado' },
  otro: { chofer: 'Sol a tu izquierda', puerta: 'Sol a tu derecha', none: 'Sin sol de lado' },
}

/** El viaje de principio a fin, pintado según dónde pega el sol en cada momento. */
export function TripTimeline({ departure, totalMinutes, minutes, runs, mode = 'micro' }: Props) {
  const labels = LABEL[mode === 'micro' ? 'micro' : 'otro']
  const arrival = arrivalTime(departure, totalMinutes)
  const round = (m: number) => Math.round(m)
  const summary = `Salida ${departure}, llegada cerca de las ${arrival}. ${(['chofer', 'puerta', 'none'] as const)
    .map((s) => `${labels[s]}: ${round(minutes[s])} min`)
    .join(', ')}.`

  return (
    <div className="grid gap-2">
      <div className="flex justify-between text-sm font-medium">
        <span>Salida {departure}</span>
        <span>Llegada ~{arrival}</span>
      </div>
      <div role="img" aria-label={summary} className="flex h-3 overflow-hidden rounded-full bg-card">
        {totalMinutes > 0 &&
          runs.map((r, i) => (
            <span
              key={i}
              data-run={r.side}
              className="h-full motion-safe:transition-[width] motion-safe:duration-500"
              style={{ width: `${(r.minutes / totalMinutes) * 100}%`, background: COLOR[r.side] }}
            />
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {(['chofer', 'puerta', 'none'] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: COLOR[s] }} aria-hidden="true" />
            <span className="text-mute">{labels[s]}</span>
            <span className="font-semibold tabular-nums">{round(minutes[s])} min</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
