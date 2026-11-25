import { Suspense, lazy, useDeferredValue, useMemo, useState } from 'react'
import { Favorites } from './components/Favorites'
import { LocateIcon, MoonIcon, Spinner, SunIcon, SwapIcon } from './components/icons'
import { MapErrorBoundary } from './components/MapErrorBoundary'
import { ModePicker, ModeSwitch } from './components/ModePicker'
import { SearchBox } from './components/SearchBox'
import { TimeControls } from './components/TimeControls'
import { UvCard } from './components/UvCard'
import { VerdictCard } from './components/VerdictCard'
import { DEFAULT_VIEW } from './config'
import { useFavorites } from './hooks/useFavorites'
import { useGeolocation } from './hooks/useGeolocation'
import { useOnline, usePrefersDark } from './hooks/useMediaQuery'
import { useRoute } from './hooks/useRoute'
import { useStoredChoice } from './hooks/useStoredChoice'
import { useUv } from './hooks/useUv'
import { analyzeRoute, type Analysis } from './lib/analyze'
import { errorMessage } from './lib/errors'
import type { Favorite } from './lib/favorites'
import { MODES, isTravelMode, type TravelMode } from './lib/modes'
import type { LatLon, Place } from './lib/place'
import { sunTimes } from './lib/sun'
import { chileNow, chileToUtc } from './lib/time'
import { uvForTrip } from './lib/uv'
import { createNominatimGeocoder } from './services/geocoding'
import { createOsrmProvider, type RoutingProvider } from './services/routing'
import { createOpenMeteoUv } from './services/uv'

const MapView = lazy(() => import('./components/MapView'))
const routing: Record<TravelMode, RoutingProvider> = {
  micro: createOsrmProvider({ baseUrl: MODES.micro.routingBase }),
  bici: createOsrmProvider({ baseUrl: MODES.bici.routingBase }),
  pie: createOsrmProvider({ baseUrl: MODES.pie.routingBase }),
}
const geocoder = createNominatimGeocoder()
const uvProvider = createOpenMeteoUv()

type PickTarget = 'from' | 'to'
type MapChoice = 'claro' | 'oscuro'
const isMapChoice = (x: unknown): x is MapChoice => x === 'claro' || x === 'oscuro'

const iconButton = 'grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-line hover:bg-card disabled:opacity-50'

const mapPlace = (p: LatLon): Place => ({ ...p, name: `Punto en el mapa (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)})` })

const TAGLINE: Record<TravelMode, string> = {
  micro: '¿De qué lado me siento en la micro?',
  bici: '¿Por dónde me va a pegar el sol?',
  pie: '¿Qué vereda tiene sombra?',
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

export default function App() {
  // Se pregunta cómo viajas cada vez que se abre la app; se recuerda el último para marcarlo.
  const [mode, setMode] = useState<TravelMode | null>(null)
  const [lastMode, setLastMode] = useStoredChoice('lado-sombra:modo', isTravelMode)
  const [mapChoice, setMapChoice] = useStoredChoice('lado-sombra:mapa', isMapChoice)
  const [from, setFrom] = useState<Place | null>(null)
  const [to, setTo] = useState<Place | null>(null)
  const [{ date, time }, setWhen] = useState(() => chileNow())
  const [pick, setPick] = useState<PickTarget>('from')
  const [gpsMessage, setGpsMessage] = useState<string | null>(null)

  const activeMode: TravelMode = mode ?? 'micro'
  const systemDark = usePrefersDark()
  const mapTheme = (mapChoice ?? (systemDark ? 'oscuro' : 'claro')) === 'oscuro' ? 'dark' : 'light'
  const online = useOnline()
  const route = useRoute(from, to, routing[activeMode])
  const { locate, loading: locating } = useGeolocation()
  const favs = useFavorites()

  // El deslizador cambia la hora muy seguido: el análisis puede ir un paso atrás sin trabar el arrastre.
  const departure = useMemo(() => {
    try {
      return chileToUtc(date, time)
    } catch {
      return null
    }
  }, [date, time])
  const deferredDeparture = useDeferredValue(departure)

  // Sol y UV se calculan en el origen (o en Santiago mientras no haya origen).
  const hereLat = from?.lat ?? DEFAULT_VIEW.latitude
  const hereLon = from?.lon ?? DEFAULT_VIEW.longitude
  const daylight = useMemo(() => sunTimes(date, hereLat, hereLon), [date, hereLat, hereLon])
  const uvData = useUv(uvProvider, hereLat, hereLon, date)

  const analysis: Analysis | null = useMemo(() => {
    if (!route.route || deferredDeparture === null) return null
    try {
      return analyzeRoute(route.route, deferredDeparture, { busFactor: MODES[activeMode].timeFactor })
    } catch {
      return null
    }
  }, [route.route, deferredDeparture, activeMode])

  const tripUv = useMemo(
    () =>
      deferredDeparture === null
        ? null
        : uvForTrip({ series: uvData.series, departureMs: deferredDeparture, minutes: analysis?.totalMinutes ?? 0, lat: hereLat, lon: hereLon }),
    [uvData.series, deferredDeparture, analysis?.totalMinutes, hereLat, hereLon],
  )

  function chooseMode(m: TravelMode) {
    setMode(m)
    setLastMode(m)
  }

  function chooseFrom(p: Place) {
    setFrom(p)
    setGpsMessage(null)
  }

  function onMapPick(p: LatLon) {
    if (pick === 'from') {
      chooseFrom(mapPlace(p))
      setPick('to')
    } else {
      setTo(mapPlace(p))
    }
  }

  async function locateMe() {
    setGpsMessage(null)
    try {
      const pos = await locate()
      chooseFrom({ ...pos, name: 'Mi ubicación' })
    } catch (err) {
      setGpsMessage(errorMessage(err))
    }
  }

  function swap() {
    setFrom(to)
    setTo(from)
  }

  function loadFavorite(f: Favorite) {
    chooseMode(f.mode)
    chooseFrom(f.from)
    setTo(f.to)
    setWhen({ date: chileNow().date, time: f.time })
  }

  const header = (
    <header className="flex flex-wrap items-baseline gap-x-3 bg-brand px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white">
      <h1 className="font-display text-3xl leading-none font-bold">Lado Sombra</h1>
      <p className="text-[15px]">{mode ? TAGLINE[mode] : 'Para viajar a la sombra'}</p>
    </header>
  )

  // Antes del mapa: ¿cómo vas a viajar?
  if (mode === null) {
    return (
      <div className="flex min-h-dvh flex-col">
        {header}
        <main className="flex-1">
          <ModePicker last={lastMode} onPick={chooseMode} />
        </main>
      </div>
    )
  }

  const card =
    route.status === 'idle' ? (
      <VerdictCard mode={mode} state="empty" />
    ) : route.status === 'loading' ? (
      <VerdictCard mode={mode} state="loading" />
    ) : route.status === 'error' ? (
      <VerdictCard mode={mode} state="error" error={route.error} onRetry={route.retry} />
    ) : analysis ? (
      <VerdictCard mode={mode} state="ready" analysis={analysis} departure={time} />
    ) : (
      <VerdictCard mode={mode} state="loading" />
    )

  const darkMap = mapTheme === 'dark'

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      {header}

      <main className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="order-2 grid content-start gap-5 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:order-none lg:overflow-y-auto lg:border-r lg:border-line">
          {!online && (
            <p role="alert" className="rounded-xl bg-card px-3 py-2 text-sm">
              Estás sin conexión: no puedo buscar lugares ni trazar rutas hasta que vuelva internet.
            </p>
          )}

          <ModeSwitch mode={mode} onChange={chooseMode} />

          <div className="grid gap-3">
            <SearchBox
              id="from"
              label="Desde"
              placeholder="Dirección o lugar"
              value={from}
              onSelect={chooseFrom}
              geocoder={geocoder}
              externalMessage={gpsMessage}
              action={
                <button type="button" onClick={locateMe} disabled={locating} className={`${iconButton} gap-1.5 px-3`}>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    {locating ? <Spinner /> : <LocateIcon />}
                    Mi ubicación
                  </span>
                </button>
              }
            />
            <SearchBox
              id="to"
              label="Hasta"
              placeholder="Ej: Plaza de Maipú"
              value={to}
              onSelect={setTo}
              geocoder={geocoder}
              action={
                <button
                  type="button"
                  onClick={swap}
                  disabled={!from && !to}
                  aria-label="Invertir desde y hasta (viaje de vuelta)"
                  title="Invertir desde y hasta"
                  className={iconButton}
                >
                  <SwapIcon />
                </button>
              }
            />
          </div>

          {card}

          {tripUv && <UvCard uv={tripUv} mode={mode} hasTrip={analysis !== null} loading={uvData.loading} />}

          <TimeControls
            sun={daylight}
            date={date}
            time={time}
            onDateChange={(d) => setWhen((w) => ({ ...w, date: d }))}
            onTimeChange={(t) => setWhen((w) => ({ ...w, time: t }))}
            onNow={() => setWhen(chileNow())}
          />

          <Favorites
            favorites={favs.favorites}
            canSave={Boolean(from && to)}
            saveFailed={favs.saveFailed}
            onSave={(name) => from && to && favs.add({ name, from, to, time, mode })}
            onLoad={loadFavorite}
            onRemove={favs.remove}
          />

          <footer className="text-[13px] text-mute">
            <p>
              Mapa: ©{' '}
              <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                colaboradores de OpenStreetMap
              </a>{' '}
              y OpenFreeMap. Rutas:{' '}
              <a className="underline" href="https://project-osrm.org/" target="_blank" rel="noreferrer">
                OSRM
              </a>{' '}
              (bici y a pie:{' '}
              <a className="underline" href="https://routing.openstreetmap.de/" target="_blank" rel="noreferrer">
                FOSSGIS
              </a>
              ). Búsqueda:{' '}
              <a className="underline" href="https://nominatim.org/" target="_blank" rel="noreferrer">
                Nominatim
              </a>
              . UV:{' '}
              <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>{' '}
              (CC BY 4.0).
            </p>
            <p className="mt-2">
              {mode === 'micro'
                ? 'La ruta es la de un auto y el tiempo se ajusta a velocidad de micro (×1,5). Los recorridos reales de las micros vienen en una próxima versión. «Lado chofer» = izquierdo; «lado puerta» = derecho.'
                : 'La sombra de las veredas es una aproximación: supone edificios a los dos lados de la calle. Árboles, toldos y la altura real de los edificios pueden cambiarla.'}
            </p>
          </footer>
        </div>

        <section aria-label="Mapa de la ruta" className="order-1 flex flex-col lg:order-none lg:min-h-0">
          <div className="relative h-[40dvh] min-h-64 lg:h-auto lg:flex-1">
            <MapErrorBoundary>
              <Suspense fallback={<div className="h-full animate-pulse bg-card motion-reduce:animate-none" />}>
                <MapView
                  from={from}
                  to={to}
                  routeCoords={route.route?.coords ?? null}
                  runs={analysis?.runs ?? null}
                  onPick={onMapPick}
                  theme={mapTheme}
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
                  onClick={() => setPick(k)}
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
              onClick={() => setMapChoice(darkMap ? 'claro' : 'oscuro')}
              className="absolute top-[106px] right-[10px] grid size-11 place-items-center rounded-md bg-bg text-ink shadow-[0_0_0_2px_rgb(0_0_0/0.1)]"
            >
              {darkMap ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
          <Legend mode={mode} />
        </section>
      </main>
    </div>
  )
}
