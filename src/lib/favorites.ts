import { isValidLatLon, type Place } from './place'

export interface Favorite {
  id: string
  name: string
  from: Place
  to: Place
  /** Hora de salida "HH:MM"; al cargar se usa con la fecha de hoy. */
  time: string
}

export const STORAGE_KEY = 'lado-sombra:favoritos'
export const MAX_FAVORITES = 20
export const MAX_NAME_LENGTH = 40
const MAX_PLACE_TEXT = 120
const VERSION = 1
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const text = (x: unknown, max: number): string | null => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null)

function toPlace(x: unknown): Place | null {
  if (!isValidLatLon(x)) return null
  const raw = x as unknown as Record<string, unknown>
  const name = text(raw.name, MAX_PLACE_TEXT)
  if (!name) return null
  const detail = text(raw.detail, MAX_PLACE_TEXT)
  return { lat: x.lat, lon: x.lon, name, ...(detail ? { detail } : {}) }
}

function toFavorite(x: unknown): Favorite | null {
  if (typeof x !== 'object' || x === null) return null
  const r = x as Record<string, unknown>
  const id = text(r.id, 64)
  const name = text(r.name, MAX_NAME_LENGTH)
  const from = toPlace(r.from)
  const to = toPlace(r.to)
  const time = typeof r.time === 'string' && TIME_RE.test(r.time) ? r.time : null
  return id && name && from && to && time ? { id, name, from, to, time } : null
}

/** Lee lo guardado; cualquier dato corrupto se descarta sin romper la app. */
export function parseFavorites(raw: string | null): Favorite[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  const items = (data as { v?: unknown; items?: unknown })?.items
  if ((data as { v?: unknown })?.v !== VERSION || !Array.isArray(items)) return []
  return items.map(toFavorite).filter((f): f is Favorite => f !== null).slice(0, MAX_FAVORITES)
}

export function serializeFavorites(list: Favorite[]): string {
  return JSON.stringify({ v: VERSION, items: list })
}

export function addFavorite(list: Favorite[], input: Omit<Favorite, 'id'>, id: string): Favorite[] {
  if (!TIME_RE.test(input.time)) throw new RangeError(`Hora inválida: "${input.time}"`)
  const name = (input.name.trim() || `${input.from.name} → ${input.to.name}`).slice(0, MAX_NAME_LENGTH)
  return [{ id, name, from: input.from, to: input.to, time: input.time }, ...list].slice(0, MAX_FAVORITES)
}

export function removeFavorite(list: Favorite[], id: string): Favorite[] {
  return list.filter((f) => f.id !== id)
}
