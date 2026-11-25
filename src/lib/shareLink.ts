import { isTravelMode, type TravelMode } from './modes'
import { isValidLatLon, type Place } from './place'

export interface SharedTrip {
  from?: Place
  to?: Place
  time?: string
  mode?: TravelMode
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_NAME = 80
/** 5 decimales ≈ 1 m: suficiente y deja el enlace corto. */
const round = (n: number) => Math.round(n * 1e5) / 1e5

/** Parámetros de la URL: de/den (origen), a/an (destino), hora y modo. La fecha no va: el viaje se ve para hoy. */
export function tripToParams(trip: { from: Place; to: Place; time: string; mode: TravelMode }): string {
  return new URLSearchParams({
    de: `${round(trip.from.lat)},${round(trip.from.lon)}`,
    den: trip.from.name.slice(0, MAX_NAME),
    a: `${round(trip.to.lat)},${round(trip.to.lon)}`,
    an: trip.to.name.slice(0, MAX_NAME),
    hora: trip.time,
    modo: trip.mode,
  }).toString()
}

function readPlace(params: URLSearchParams, coordKey: string, nameKey: string): Place | undefined {
  const [lat, lon] = (params.get(coordKey) ?? '').split(',').map(Number)
  const p = { lat, lon }
  if (!isValidLatLon(p)) return undefined
  const name = (params.get(nameKey) ?? '').trim().slice(0, MAX_NAME) || 'Punto compartido'
  return { lat: round(p.lat), lon: round(p.lon), name }
}

/** Lee un viaje compartido; lo que no sea válido se ignora. */
export function paramsToTrip(search: string): SharedTrip {
  const params = new URLSearchParams(search)
  const trip: SharedTrip = {}
  const from = readPlace(params, 'de', 'den')
  const to = readPlace(params, 'a', 'an')
  const time = params.get('hora')
  const mode = params.get('modo')
  if (from) trip.from = from
  if (to) trip.to = to
  if (time && TIME_RE.test(time)) trip.time = time
  if (isTravelMode(mode)) trip.mode = mode
  return trip
}
