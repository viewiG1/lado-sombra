import type { ReactNode } from 'react'
import { MODES, TRAVEL_MODES, type TravelMode } from '../lib/modes'
import { BikeIcon, BusIcon, WalkIcon } from './icons'

const ICON: Record<TravelMode, (p: { width: number; height: number }) => ReactNode> = {
  micro: BusIcon,
  bici: BikeIcon,
  pie: WalkIcon,
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
