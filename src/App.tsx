import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Favorites } from './components/Favorites'
import { Credits } from './components/Credits'
import { LocateIcon, Spinner, SwapIcon } from './components/icons'
import { MapPanel, type PickTarget } from './components/MapPanel'
import { ModeSwitch } from './components/ModeSwitch'
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
import { analyzePrepared, prepareRoute, type Analysis } from './lib/analyze'
import { departureProfile, exposureMinutes, suggestDeparture } from './lib/bestTime'
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

const routing: Record<TravelMode, RoutingProvider> = {
  micro: createOsrmProvider({ baseUrl: MODES.micro.routingBase }),
  bici: createOsrmProvider({ baseUrl: MODES.bici.routingBase }),
  pie: createOsrmProvider({ baseUrl: MODES.pie.routingBase }),
}
const geocoder = createNominatimGeocoder()
const uvProvider = createOpenMeteoUv()

type MapChoice = 'claro' | 'oscuro'
const isMapChoice = (x: unknown): x is MapChoice => x === 'claro' || x === 'oscuro'

const iconButton = 'grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-line hover:bg-card disabled:opacity-50'

const mapPlace = (p: LatLon): Place => ({ ...p, name: `Punto en el mapa (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)})` })

const TAGLINE: Record<TravelMode, string> = {
  micro: '¿De qué lado me siento en la micro?',
  bici: '¿Por dónde me va a pegar el sol?',
  pie: '¿Qué vereda tiene sombra?',
}

export default function App() {
  // La app abre en el último modo usado (micro la primera vez).
  const [savedMode, setSavedMode] = useStoredChoice('lado-sombra:modo', isTravelMode)
  const mode: TravelMode = savedMode ?? 'micro'
  const [mapChoice, setMapChoice] = useStoredChoice('lado-sombra:mapa', isMapChoice)
  const [from, setFrom] = useState<Place | null>(null)
  const [to, setTo] = useState<Place | null>(null)
  const [{ date, time }, setWhen] = useState(() => chileNow())
  const [pick, setPick] = useState<PickTarget>('from')
  const [gpsMessage, setGpsMessage] = useState<string | null>(null)

  const systemDark = usePrefersDark()
  const mapTheme = (mapChoice ?? (systemDark ? 'oscuro' : 'claro')) === 'oscuro' ? 'dark' : 'light'
  const online = useOnline()
  const route = useRoute(from, to, routing[mode])
  const { locate, loading: locating } = useGeolocation()
  const favs = useFavorites()

  // Si ya diste permiso de ubicación antes, la app parte desde donde estás (sin volver a preguntar).
  useEffect(() => {
    let cancelled = false
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => (status.state === 'granted' ? locate() : null))
      .then((pos) => {
        if (pos && !cancelled) setFrom((current) => current ?? { ...pos, name: 'Mi ubicación' })
      })
      .catch(() => {}) // sin ubicación: se elige a mano, como siempre
    return () => {
      cancelled = true
    }
  }, [locate])

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

  // La ruta se divide en tramos una sola vez; mover la hora solo recalcula el sol.
  const prepared = useMemo(() => {
    if (!route.route) return null
    try {
      return prepareRoute(route.route, { busFactor: MODES[mode].timeFactor })
    } catch {
      return null
    }
  }, [route.route, mode])

  const analysis: Analysis | null = useMemo(
    () => (prepared && deferredDeparture !== null ? analyzePrepared(prepared, deferredDeparture) : null),
    [prepared, deferredDeparture],
  )

  // Sol según la hora de salida (franja sobre el deslizador) y la mejor hora cercana.
  const profile = useMemo(() => (prepared ? departureProfile(prepared, date, mode) : []), [prepared, date, mode])
  const suggestion = useMemo(() => {
    if (!prepared || deferredDeparture === null) return null
    return suggestDeparture(profile, time, exposureMinutes(prepared, deferredDeparture, mode))
  }, [prepared, deferredDeparture, profile, time, mode])

  const tripUv = useMemo(
    () =>
      deferredDeparture === null
        ? null
        : uvForTrip({ series: uvData.series, departureMs: deferredDeparture, minutes: analysis?.totalMinutes ?? 0, lat: hereLat, lon: hereLon }),
    [uvData.series, deferredDeparture, analysis?.totalMinutes, hereLat, hereLon],
  )

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
    setSavedMode(f.mode)
    chooseFrom(f.from)
    setTo(f.to)
    setWhen({ date: chileNow().date, time: f.time })
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

  return (
    <div className="flex min-h-dvh flex-col wide:h-dvh">
      <header className="flex flex-wrap items-baseline gap-x-3 bg-brand px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white">
        <h1 className="font-display text-3xl leading-none font-bold">Lado Sombra</h1>
        <p className="text-[15px]">{TAGLINE[mode]}</p>
      </header>

      <main className="flex flex-1 flex-col wide:grid wide:min-h-0 wide:grid-cols-[minmax(0,380px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <div className="order-2 grid content-start gap-5 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] wide:order-none wide:overflow-y-auto wide:border-r wide:border-line">
          {!online && (
            <p role="alert" className="rounded-xl bg-card px-3 py-2 text-sm">
              Estás sin conexión: no puedo buscar lugares ni trazar rutas hasta que vuelva internet.
            </p>
          )}

          <ModeSwitch mode={mode} onChange={setSavedMode} />

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
            profile={profile}
            suggestion={suggestion}
            metric={mode === 'micro' ? 'de sol de lado' : 'de sol fuerte'}
          />

          <Favorites
            favorites={favs.favorites}
            canSave={Boolean(from && to)}
            saveFailed={favs.saveFailed}
            onSave={(name) => from && to && favs.add({ name, from, to, time, mode })}
            onLoad={loadFavorite}
            onRemove={favs.remove}
          />

          <Credits mode={mode} />
        </div>

        <MapPanel
          mode={mode}
          from={from}
          to={to}
          routeCoords={route.route?.coords ?? null}
          runs={analysis?.runs ?? null}
          onPick={onMapPick}
          pick={pick}
          onPickChange={setPick}
          theme={mapTheme}
          onToggleTheme={() => setMapChoice(mapTheme === 'dark' ? 'claro' : 'oscuro')}
        />
      </main>
    </div>
  )
}
