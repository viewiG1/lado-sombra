import 'maplibre-gl/dist/maplibre-gl.css'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { AttributionControl, Layer, Marker, NavigationControl, Source, type MapRef, type StyleSpecification } from 'react-map-gl/maplibre'
import { DEFAULT_VIEW } from '../config'
import type { Run } from '../lib/analyze'
import type { LngLat } from '../lib/geo'
import { localizeStyle } from '../lib/mapStyle'
import type { LatLon, Place } from '../lib/place'
import { useMediaQuery, usePrefersDark } from '../hooks/useMediaQuery'

export interface MapViewProps {
  from: Place | null
  to: Place | null
  /** Ruta completa (para encuadrar); cambia solo cuando llega una ruta nueva. */
  routeCoords: LngLat[] | null
  runs: Run[] | null
  onPick: (p: LatLon) => void
}

// MapLibre 6 carga su worker aparte: Vite lo copia a /assets y aquí le decimos dónde quedó.
setWorkerUrl(workerUrl)

const STYLE_URL = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
const styleCache: Partial<Record<keyof typeof STYLE_URL, Promise<StyleSpecification>>> = {}

function loadStyle(theme: keyof typeof STYLE_URL): Promise<StyleSpecification> {
  styleCache[theme] ??= fetch(STYLE_URL[theme])
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<StyleSpecification>
    })
    .then(localizeStyle)
    .catch((err: unknown) => {
      delete styleCache[theme] // permite reintentar
      throw err
    })
  return styleCache[theme]
}

/** `theme` solo sirve para recalcular cuando cambia el tema: las variables CSS ya cambiaron. */
function readRouteColors(theme: string) {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const dark = theme === 'dark'
  return {
    chofer: v('--chofer', dark ? '#f0555c' : '#d7262e'),
    puerta: v('--puerta', dark ? '#5b95f0' : '#2160c4'),
    none: v('--nosun', dark ? '#7d8592' : '#9aa1ac'),
    casing: v('--casing', dark ? '#14161b' : '#ffffff'),
  }
}

function PointMarker({ place, kind }: { place: Place; kind: 'from' | 'to' }) {
  const text = kind === 'from' ? 'Desde' : 'Hasta'
  return (
    <Marker longitude={place.lon} latitude={place.lat} anchor="bottom" offset={[0, 8]}>
      <div title={`${text}: ${place.name}`} className="flex flex-col items-center">
        <span className="rounded-md bg-ink px-1.5 py-0.5 text-xs font-semibold text-bg shadow">{text}</span>
        <span className="h-2 w-0.5 bg-ink" />
        <span className={`size-4 rounded-full border-[3px] border-ink shadow ${kind === 'from' ? 'bg-bg' : 'bg-ink'}`} />
      </div>
    </Marker>
  )
}

export default function MapView({ from, to, routeCoords, runs, onPick }: MapViewProps) {
  const dark = usePrefersDark()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const theme = dark ? 'dark' : 'light'
  const [style, setStyle] = useState<{ theme: string; spec: StyleSpecification } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const mapRef = useRef<MapRef>(null)

  useEffect(() => {
    let alive = true
    loadStyle(theme).then(
      (spec) => alive && setStyle({ theme, spec }),
      () => alive && setFailed(theme),
    )
    return () => {
      alive = false
    }
  }, [theme, attempt])

  // Colores desde las variables CSS (una sola fuente para la interfaz y el mapa); cambian con el tema.
  const colors = useMemo(() => readRouteColors(theme), [theme])

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: (runs ?? []).map((r) => ({
        type: 'Feature' as const,
        properties: { side: r.side },
        geometry: { type: 'LineString' as const, coordinates: r.coords },
      })),
    }),
    [runs],
  )

  // Encuadra cada ruta nueva (no al mover la hora).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded || !routeCoords || routeCoords.length < 2) return
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, y] of routeCoords) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: { top: 72, bottom: 48, left: 32, right: 56 }, duration: reduceMotion ? 0 : 700, maxZoom: 16 },
    )
  }, [routeCoords, loaded, reduceMotion])

  // Sin ruta todavía: acerca el mapa al punto que se acaba de marcar.
  const focus = !routeCoords ? (to ?? from) : null
  const focusLat = focus?.lat
  const focusLon = focus?.lon
  useEffect(() => {
    const map = mapRef.current
    if (focusLat === undefined || focusLon === undefined || !map || !loaded) return
    map.easeTo({ center: [focusLon, focusLat], zoom: Math.max(map.getZoom(), 14), duration: reduceMotion ? 0 : 600 })
  }, [focusLat, focusLon, loaded, reduceMotion])

  if (failed === theme && style?.theme !== theme) {
    return (
      <div className="grid h-full place-items-center bg-card p-6 text-center">
        <div>
          <p className="text-mute">No pude cargar el mapa. Revisa tu conexión.</p>
          <p className="mt-1 text-sm text-mute">Igual puedes buscar las direcciones arriba.</p>
          <button
            type="button"
            onClick={() => {
              setFailed(null)
              setAttempt((n) => n + 1)
            }}
            className="mt-3 min-h-11 rounded-xl bg-ink px-4 font-semibold text-bg"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!style) return <div className="h-full animate-pulse bg-card motion-reduce:animate-none" aria-label="Cargando mapa" />

  return (
    <Map
      ref={mapRef}
      initialViewState={DEFAULT_VIEW}
      mapStyle={style.spec}
      attributionControl={false}
      dragRotate={false}
      touchPitch={false}
      pitchWithRotate={false}
      cursor="crosshair"
      onLoad={() => setLoaded(true)}
      onClick={(e) => onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng })}
      style={{ width: '100%', height: '100%' }}
      locale={{
        'NavigationControl.ZoomIn': 'Acercar',
        'NavigationControl.ZoomOut': 'Alejar',
        'AttributionControl.ToggleAttribution': 'Mostrar u ocultar créditos',
        'Map.Title': 'Mapa interactivo: toca para marcar desde o hasta',
      }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      <AttributionControl position="bottom-right" compact customAttribution="Rutas: OSRM" />
      <Source id="route" type="geojson" data={geojson}>
        <Layer
          id="route-casing"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': colors.casing, 'line-width': 10 }}
        />
        <Layer
          id="route-line"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': ['match', ['get', 'side'], 'chofer', colors.chofer, 'puerta', colors.puerta, colors.none],
            'line-width': 6,
          }}
        />
      </Source>
      {from && <PointMarker place={from} kind="from" />}
      {to && <PointMarker place={to} kind="to" />}
    </Map>
  )
}
