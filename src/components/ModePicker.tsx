import type { ReactNode } from 'react'
import { MODES, TRAVEL_MODES, type TravelMode } from '../lib/modes'
import { BikeIcon, BusIcon, WalkIcon } from './icons'

const ICON: Record<TravelMode, (p: { width: number; height: number }) => ReactNode> = {
  micro: BusIcon,
  bici: BikeIcon,
  pie: WalkIcon,
}

const WHAT: Record<TravelMode, string> = {
  micro: 'Te digo de qué lado sentarte para ir a la sombra.',
  bici: 'Te digo por dónde te va a pegar el sol y cuánto UV hay.',
  pie: 'Te digo qué vereda tiene sombra y cuánto UV hay.',
}

/** Primera pantalla: cómo vas a viajar. */
export function ModePicker({ last, onPick }: { last: TravelMode | null; onPick: (m: TravelMode) => void }) {
  return (
    <section aria-labelledby="mode-title" className="mx-auto grid w-full max-w-md content-start gap-4 px-4 py-6">
      <div>
        <h2 id="mode-title" className="font-display text-[34px] leading-tight font-bold">
          ¿Cómo vas a viajar?
        </h2>
        <p className="mt-1 text-mute">Así te digo dónde ponerte para ir a la sombra.</p>
      </div>
      <ul className="grid gap-3">
        {TRAVEL_MODES.map((m) => {
          const Icon = ICON[m]
          return (
            <li key={m}>
              <button
                type="button"
                onClick={() => onPick(m)}
                className="flex min-h-11 w-full items-center gap-4 rounded-2xl border border-line p-4 text-left hover:bg-card"
              >
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-card text-ink">
                  <Icon width={30} height={30} />
                </span>
                <span className="grid gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold">
                    {MODES[m].label}
                    {last === m && <span className="rounded-full bg-ink px-2 py-0.5 font-sans text-xs font-semibold text-bg">Último usado</span>}
                  </span>
                  <span className="text-sm text-mute">{WHAT[m]}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-mute">Puedes cambiarlo después, arriba de la búsqueda.</p>
    </section>
  )
}

/** Cambio rápido de modo dentro de la app. */
export function ModeSwitch({ mode, onChange }: { mode: TravelMode; onChange: (m: TravelMode) => void }) {
  return (
    <div role="group" aria-label="Cómo viajas" className="grid grid-cols-3 gap-1 rounded-xl bg-card p-1">
      {TRAVEL_MODES.map((m) => {
        const Icon = ICON[m]
        return (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onChange(m)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-mute aria-pressed:bg-bg aria-pressed:text-ink aria-pressed:shadow"
          >
            <Icon width={18} height={18} />
            {MODES[m].label}
          </button>
        )
      })}
    </div>
  )
}
