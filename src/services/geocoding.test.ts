import { afterEach, describe, expect, test, vi } from 'vitest'
import { createNominatimGeocoder, createRateLimiter } from './geocoding'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const results = [
  { lat: '-33.5107', lon: '-70.7573', name: 'Plaza de Maipú', display_name: 'Plaza de Maipú, Maipú, Provincia de Santiago, Región Metropolitana, Chile' },
  { lat: '-33.44', lon: '-70.65', name: '', display_name: 'Avenida Libertador Bernardo O’Higgins 1000, Santiago, Chile' },
]

// Sin espera entre peticiones, para las pruebas que no tratan del límite.
const noLimit = createRateLimiter(0)

afterEach(() => vi.useRealTimers())

describe('Nominatim', () => {
  test('busca solo en Chile y en español', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(results))
    await createNominatimGeocoder({ baseUrl: 'https://nom.test', fetchFn, limiter: noLimit }).search('plaza de maipú')
    const url = new URL(fetchFn.mock.calls[0]![0] as string)
    expect(url.origin + url.pathname).toBe('https://nom.test/search')
    expect(url.searchParams.get('countrycodes')).toBe('cl')
    expect(url.searchParams.get('accept-language')).toBe('es')
    expect(url.searchParams.get('q')).toBe('plaza de maipú')
    expect(url.searchParams.get('format')).toBe('jsonv2')
  })

  test('convierte los resultados en lugares con nombre corto y detalle', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(results))
    const places = await createNominatimGeocoder({ fetchFn, limiter: noLimit }).search('plaza')
    expect(places[0]).toEqual({ lat: -33.5107, lon: -70.7573, name: 'Plaza de Maipú', detail: 'Maipú, Provincia de Santiago, Región Metropolitana, Chile' })
    expect(places[1]).toMatchObject({ name: 'Avenida Libertador Bernardo O’Higgins 1000', detail: 'Santiago, Chile' })
  })

  test('descarta resultados con coordenadas inválidas', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json([{ lat: 'x', lon: '1', display_name: 'Malo' }, results[0]]))
    const places = await createNominatimGeocoder({ fetchFn, limiter: noLimit }).search('plaza')
    expect(places).toHaveLength(1)
  })

  test('sin resultados → AppError not-found', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json([]))
    await expect(createNominatimGeocoder({ fetchFn, limiter: noLimit }).search('asdfgh')).rejects.toMatchObject({ kind: 'not-found' })
  })

  test('respuesta que no es una lista o error HTTP → AppError service', async () => {
    const g = createNominatimGeocoder({
      fetchFn: vi.fn().mockResolvedValueOnce(json({ error: 'x' })).mockResolvedValueOnce(json([], 429)),
      limiter: noLimit,
    })
    await expect(g.search('uno')).rejects.toMatchObject({ kind: 'service' })
    await expect(g.search('dos')).rejects.toMatchObject({ kind: 'service' })
  })

  test('guarda en caché: la misma búsqueda (ignorando mayúsculas y espacios) no vuelve a pedir', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(results))
    const g = createNominatimGeocoder({ fetchFn, limiter: noLimit })
    await g.search('Plaza de Maipú')
    await g.search('  plaza   de maipú ')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  test('texto de menos de 3 letras → RangeError, sin llamar al servicio', async () => {
    const fetchFn = vi.fn()
    await expect(createNominatimGeocoder({ fetchFn, limiter: noLimit }).search(' ab ')).rejects.toThrow(RangeError)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('createRateLimiter', () => {
  test('deja al menos 1 segundo entre el inicio de cada petición', async () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter(1000)
    const starts: number[] = []
    const job = () => {
      starts.push(Date.now())
      return Promise.resolve()
    }
    const t0 = Date.now()
    const all = Promise.all([limiter.schedule(job), limiter.schedule(job), limiter.schedule(job)])
    await vi.advanceTimersByTimeAsync(2500)
    await all
    expect(starts.map((s) => s - t0)).toEqual([0, 1000, 2000])
  })

  test('una petición cancelada mientras espera no se ejecuta', async () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter(1000)
    const job = vi.fn(() => Promise.resolve())
    await limiter.schedule(job)
    const ctrl = new AbortController()
    const p = limiter.schedule(job, ctrl.signal)
    const check = expect(p).rejects.toMatchObject({ name: 'AbortError' })
    ctrl.abort()
    await vi.advanceTimersByTimeAsync(1000)
    await check
    expect(job).toHaveBeenCalledTimes(1)
  })
})
