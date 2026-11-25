import { AppError } from '../lib/errors'
import type { UvSeries } from '../lib/uv'
import { requestJson, type FetchFn } from './http'

export const OPEN_METEO_URL = 'https://api.open-meteo.com'

export interface UvProvider {
  /** Serie de UV por hora que cubre el día de Chile `date`; null si el pronóstico no llega a esa fecha. */
  series(lat: number, lon: number, date: string, signal?: AbortSignal): Promise<UvSeries | null>
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CACHE_SIZE = 20

const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
const isNumOrNull = (x: unknown): x is number | null => x === null || (typeof x === 'number' && Number.isFinite(x))

export function createOpenMeteoUv(opts: { baseUrl?: string; fetchFn?: FetchFn } = {}): UvProvider {
  const baseUrl = opts.baseUrl ?? OPEN_METEO_URL
  const cache = new Map<string, UvSeries | null>()

  return {
    async series(lat, lon, date, signal) {
      if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new RangeError(`Fecha inválida: "${date}"`)
      // Dos decimales (~1 km): el UV no cambia en esa distancia y la caché sirve para toda la ruta.
      const la = lat.toFixed(2)
      const lo = lon.toFixed(2)
      const key = `${la},${lo},${date}`
      if (cache.has(key)) return cache.get(key)!

      // En UTC, el día de Chile (UTC−3/−4) cae entre este día y el siguiente.
      const params = new URLSearchParams({
        latitude: la,
        longitude: lo,
        hourly: 'uv_index,uv_index_clear_sky',
        timezone: 'GMT',
        start_date: date,
        end_date: nextDay(date),
      })
      const res = await requestJson(`${baseUrl}/v1/forecast?${params}`, { fetchFn: opts.fetchFn, signal })
      const b = res.body as { error?: unknown; reason?: unknown; hourly?: { time?: unknown; uv_index?: unknown; uv_index_clear_sky?: unknown } } | null

      let result: UvSeries | null
      if (res.status === 400 && b?.error === true) {
        result = null // fuera del rango del pronóstico
      } else {
        const h = b?.hourly
        const time = h?.time
        const uv = h?.uv_index
        const clear = h?.uv_index_clear_sky
        if (
          !res.ok ||
          !Array.isArray(time) ||
          !Array.isArray(uv) ||
          !Array.isArray(clear) ||
          uv.length !== time.length ||
          clear.length !== time.length ||
          !uv.every(isNumOrNull) ||
          !clear.every(isNumOrNull)
        ) {
          throw new AppError('service')
        }
        const times = time.map((t) => Date.parse(`${String(t)}:00Z`))
        if (times.some(Number.isNaN)) throw new AppError('service')
        result = { times, uv, clearSky: clear }
      }

      if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!)
      cache.set(key, result)
      return result
    },
  }
}
