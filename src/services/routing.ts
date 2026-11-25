import { OSRM_URL } from '../config'
import type { Route } from '../lib/analyze'
import { AppError } from '../lib/errors'
import type { LngLat } from '../lib/geo'
import { isValidLatLon, type LatLon } from '../lib/place'
import { requestJson, type FetchFn } from './http'

export interface RouteResult extends Route {
  distanceM: number
}

/** Cualquier proveedor de rutas (OSRM hoy; otro mañana) cumple esta interfaz. */
export interface RoutingProvider {
  /** Identifica al proveedor y su perfil: si cambia, la ruta se vuelve a pedir. */
  readonly id: string
  route(from: LatLon, to: LatLon, signal?: AbortSignal): Promise<RouteResult>
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isLngLat = (c: unknown): c is LngLat => Array.isArray(c) && c.length >= 2 && isNum(c[0]) && isNum(c[1])

interface OsrmRoute {
  duration?: unknown
  distance?: unknown
  geometry?: { coordinates?: unknown }
  legs?: { annotation?: { duration?: unknown } }[]
}

export function createOsrmProvider(opts: { baseUrl?: string; fetchFn?: FetchFn } = {}): RoutingProvider {
  const baseUrl = opts.baseUrl ?? OSRM_URL
  return {
    id: baseUrl,
    async route(from, to, signal) {
      if (!isValidLatLon(from) || !isValidLatLon(to)) throw new RangeError('Coordenadas inválidas')
      const path = `${from.lon},${from.lat};${to.lon},${to.lat}`
      const url = `${baseUrl}/route/v1/driving/${path}?overview=full&geometries=geojson&annotations=duration&steps=false`
      const res = await requestJson(url, { fetchFn: opts.fetchFn, signal })
      const body = (res.body ?? {}) as { code?: unknown; routes?: OsrmRoute[] }

      if (body.code === 'NoRoute' || body.code === 'NoSegment') throw new AppError('no-route')
      if (!res.ok || body.code !== 'Ok') throw new AppError('service')
      const r = Array.isArray(body.routes) ? body.routes[0] : undefined
      if (!r) throw new AppError('no-route')

      const coords = r.geometry?.coordinates
      if (!Array.isArray(coords) || coords.length < 2 || !coords.every(isLngLat)) throw new AppError('service')
      if (!isNum(r.duration) || r.duration < 0 || !isNum(r.distance)) throw new AppError('service')

      const durations = (r.legs ?? []).flatMap((leg) => (Array.isArray(leg.annotation?.duration) ? leg.annotation.duration : []))
      const segmentDurationsS =
        durations.length === coords.length - 1 && durations.every((d) => isNum(d) && d >= 0) ? (durations as number[]) : null

      return {
        coords: coords.map((c): LngLat => [c[0], c[1]]),
        durationS: r.duration,
        distanceM: r.distance,
        segmentDurationsS,
      }
    },
  }
}
