import { Suspense, lazy } from 'react'
import type { Run } from '../lib/analyze'
import type { LngLat } from '../lib/geo'
import type { TravelMode } from '../lib/modes'
import type { LatLon, Place } from '../lib/place'
import { MoonIcon, SunIcon } from './icons'
import { MapErrorBoundary } from './MapErrorBoundary'
import type { MapTheme } from './MapView'

// MapLibre pesa ~1 MB: se carga después del panel.
const MapView = lazy(() => import('./MapView'))

export type PickTarget = 'from' | 'to'

interface Props {
  mode: TravelMode
  from: Place | null
  to: Place | null
  routeCoords: LngLat[] | null
  runs: Run[] | null
  onPick: (p: LatLon) => void
  /** Qué marca un toque en el mapa. */
  pick: PickTarget
  onPickChange: (p: PickTarget) => void
  theme: MapTheme
  onToggleTheme: () => void
}

function Legend({ mode }: { mode: TravelMode }) {
  const item = (color: string, text: string) => (
    <li className="flex items-center gap-1.5">
      <span className="inline-block h-1.5 w-5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {text}
    </li>
  )
  const micro = mode === 'micro'
  return (
    <ul aria-label="Colores de la ruta" className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line px-4 py-1.5 text-[13px] text-mute">
      {item('var(--chofer)', micro ? 'Sol chofer' : 'Sol a la izquierda')}
      {item('var(--puerta)', micro ? 'Sol puerta' : 'Sol a la derecha')}
      {item('var(--nosun)', 'Sin sol de lado')}
    </ul>
  )
}

/** Mapa con la ruta pintada por tramos, controles flotantes y leyenda. */
export function MapPanel({ mode, from, to, routeCoords, runs, onPick, pick, onPickChange, theme, onToggleTheme }: Props) {
  const darkMap = theme === 'dark'
  return (
    <section aria-label="Mapa de la ruta" className="order-1 flex flex-col wide:order-none wide:min-h-0">
      <div className="relative h-[40dvh] min-h-64 wide:h-auto wide:min-h-0 wide:flex-1">
        <MapErrorBoundary>
          <Suspense fallback={<div className="h-full animate-pulse bg-card motion-reduce:animate-none" />}>
            <MapView
              from={from}
              to={to}
              routeCoords={routeCoords}
              runs={runs}
              onPick={onPick}
              theme={theme}
            />
          </Suspense>
        </MapErrorBoundary>
        <div
          role="group"
          aria-label="Al tocar el mapa se marca"
          className="absolute top-2 left-2 flex items-center gap-1 rounded-xl bg-bg/95 p-1 text-sm shadow"
        >
          <span className="px-2 text-mute" aria-hidden="true">
            Tocar marca:
          </span>
          {(['from', 'to'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={pick === k}
              onClick={() => onPickChange(k)}
              className="min-h-11 rounded-lg px-3 font-medium aria-pressed:bg-ink aria-pressed:text-bg"
            >
              {k === 'from' ? 'Desde' : 'Hasta'}
            </button>
          ))}
        </div>
        {/* Debajo de los botones de zoom (2 × 44 px + márgenes). */}
        <button
          type="button"
          aria-pressed={darkMap}
          aria-label="Mapa oscuro"
          title={darkMap ? 'Cambiar a mapa claro' : 'Cambiar a mapa oscuro'}
          onClick={onToggleTheme}
          className="absolute top-[106px] right-[10px] grid size-11 place-items-center rounded-md bg-bg text-ink shadow-[0_0_0_2px_rgb(0_0_0/0.1)]"
        >
          {darkMap ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
      <Legend mode={mode} />
    </section>
  )
}
