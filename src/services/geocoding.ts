import { NOMINATIM_URL } from '../config'
import { AppError, abortError } from '../lib/errors'
import { isValidLatLon, type Place } from '../lib/place'
import { requestJson, type FetchFn } from './http'

export interface Geocoder {
  /** Busca lugares en Chile. Lanza AppError('not-found') si no hay resultados. */
  search(query: string, signal?: AbortSignal): Promise<Place[]>
}

export interface RateLimiter {
  schedule<T>(job: () => Promise<T>, signal?: AbortSignal): Promise<T>
}

/** Asegura un mínimo de `intervalMs` entre el inicio de cada trabajo (política de uso de Nominatim). */
export function createRateLimiter(intervalMs: number): RateLimiter {
  let nextSlot = 0
  return {
    async schedule(job, signal) {
      const now = Date.now()
      const start = Math.max(now, nextSlot)
      nextSlot = start + intervalMs
      if (start > now) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort)
            resolve()
          }, start - now)
          const onAbort = () => {
            clearTimeout(timer)
            reject(abortError())
          }
          signal?.addEventListener('abort', onAbort, { once: true })
        })
      }
      if (signal?.aborted) throw abortError()
      return job()
    },
  }
}

export const MIN_QUERY_LENGTH = 3
const CACHE_SIZE = 50

const normalize = (q: string) => q.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-CL')

interface NominatimResult {
  lat?: unknown
  lon?: unknown
  name?: unknown
  display_name?: unknown
}

function toPlace(r: NominatimResult): Place | null {
  const lat = Number(r.lat)
  const lon = Number(r.lon)
  const display = typeof r.display_name === 'string' ? r.display_name : ''
  if (!isValidLatLon({ lat, lon }) || !display) return null
  const parts = display.split(',').map((s) => s.trim())
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : parts[0]!
  const rest = parts[0] === name ? parts.slice(1) : parts
  return { lat, lon, name, detail: rest.join(', ') || undefined }
}

// Compartido por toda la app: una sola cola para todas las búsquedas.
const sharedLimiter = createRateLimiter(1000)

export function createNominatimGeocoder(
  opts: { baseUrl?: string; fetchFn?: FetchFn; limiter?: RateLimiter } = {},
): Geocoder {
  const baseUrl = opts.baseUrl ?? NOMINATIM_URL
  const limiter = opts.limiter ?? sharedLimiter
  const cache = new Map<string, Place[]>()

  return {
    async search(query, signal) {
      const key = normalize(query)
      if (key.length < MIN_QUERY_LENGTH) throw new RangeError('Búsqueda demasiado corta')
      const cached = cache.get(key)
      if (cached) return cached

      const params = new URLSearchParams({
        format: 'jsonv2',
        limit: '5',
        countrycodes: 'cl',
        'accept-language': 'es',
        q: query.trim(),
      })
      const res = await limiter.schedule(() => requestJson(`${baseUrl}/search?${params}`, { fetchFn: opts.fetchFn, signal }), signal)
      if (!res.ok || !Array.isArray(res.body)) throw new AppError('service')
      const places = (res.body as NominatimResult[]).map(toPlace).filter((p): p is Place => p !== null)
      if (places.length === 0) throw new AppError('not-found')

      if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!)
      cache.set(key, places)
      return places
    },
  }
}
