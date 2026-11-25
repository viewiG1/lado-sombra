import type { TravelMode } from '../lib/modes'
import { uvCategory, type TripUv, type UvLevel } from '../lib/uv'

const BADGE: Record<UvLevel, { bg: string; fg: string }> = {
  bajo: { bg: 'var(--uv-bajo)', fg: '#ffffff' },
  moderado: { bg: 'var(--uv-moderado)', fg: '#16181d' },
  alto: { bg: 'var(--uv-alto)', fg: '#16181d' },
  'muy-alto': { bg: 'var(--uv-muy-alto)', fg: '#ffffff' },
  extremo: { bg: 'var(--uv-extremo)', fg: '#ffffff' },
}

interface Props {
  uv: TripUv
  mode: TravelMode
  /** Hay ruta: el UV es el máximo durante el viaje; si no, el de la hora de salida. */
  hasTrip: boolean
  loading: boolean
}

export function UvCard({ uv, mode, hasTrip, loading }: Props) {
  const value = Math.round(uv.uv)
  const cat = uvCategory(uv.uv)
  const clear = Math.round(uv.clearSky)
  const clearCat = uvCategory(uv.clearSky)
  const when = hasTrip ? 'durante tu viaje' : 'a la hora de salida'

  return (
    <section aria-labelledby="uv-title" className="rounded-2xl border border-line p-4">
      <h2 id="uv-title" className="font-display text-2xl font-bold">
        Rayos UV
      </h2>
      <div className="mt-2 flex items-center gap-3">
        <span
          className="grid size-16 shrink-0 place-items-center rounded-2xl font-display text-4xl font-bold tabular-nums"
          style={{ background: BADGE[cat.level].bg, color: BADGE[cat.level].fg }}
          aria-hidden="true"
        >
          {value}
        </span>
        <div>
          <p className="font-semibold">
            <span className="sr-only">Índice UV {value}: </span>
            {cat.label} {when}
            {loading && <span className="font-normal text-mute"> (buscando pronóstico…)</span>}
          </p>
          <p className="text-sm text-mute">{cat.advice}</p>
        </div>
      </div>
      {uv.source === 'pronostico' && clear > value && (
        <p className="mt-2 text-sm">
          Si se despeja, podría llegar a <b>{clear}</b> ({clearCat.label.toLowerCase()}).
        </p>
      )}
      {mode === 'micro' && value >= 3 && (
        <p className="mt-2 text-sm text-mute">Cuenta para la espera en el paradero y si vas junto a una ventana con sol.</p>
      )}
      <p className="mt-2 text-xs text-mute">
        {uv.source === 'pronostico'
          ? 'Pronóstico por hora de Open-Meteo (considera las nubes).'
          : 'Estimado con la altura del sol, como si estuviera despejado: no hay pronóstico para esa fecha o estás sin conexión.'}
      </p>
    </section>
  )
}
