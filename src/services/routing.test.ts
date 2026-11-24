import { describe, expect, test, vi } from 'vitest'
import { createOsrmProvider } from './routing'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const FROM = { lat: -33.4378, lon: -70.6506 }
const TO = { lat: -33.5107, lon: -70.7573 }

const okBody = {
  code: 'Ok',
  routes: [
    {
      duration: 900,
      distance: 12000,
      geometry: { type: 'LineString', coordinates: [[-70.6506, -33.4378], [-70.7, -33.47], [-70.7573, -33.5107]] },
      legs: [{ annotation: { duration: [400, 500] } }],
    },
  ],
}

describe('OSRM', () => {
  test('arma la URL con lon,lat y pide geometría completa y duraciones', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(okBody))
    await createOsrmProvider({ baseUrl: 'https://osrm.test', fetchFn }).route(FROM, TO)
    const url = new URL(fetchFn.mock.calls[0]![0] as string)
    expect(url.pathname).toBe('/route/v1/driving/-70.6506,-33.4378;-70.7573,-33.5107')
    expect(url.searchParams.get('overview')).toBe('full')
    expect(url.searchParams.get('geometries')).toBe('geojson')
    expect(url.searchParams.get('annotations')).toBe('duration')
  })

  test('convierte la respuesta en una ruta', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(okBody))
    const r = await createOsrmProvider({ fetchFn }).route(FROM, TO)
    expect(r).toEqual({
      coords: okBody.routes[0]!.geometry.coordinates,
      durationS: 900,
      distanceM: 12000,
      segmentDurationsS: [400, 500],
    })
  })

  test('sin duraciones por segmento → null (el análisis reparte por distancia)', async () => {
    const body = structuredClone(okBody)
    body.routes[0]!.legs = [{ annotation: { duration: [400] } }]
    const r = await createOsrmProvider({ fetchFn: vi.fn().mockResolvedValue(json(body)) }).route(FROM, TO)
    expect(r.segmentDurationsS).toBeNull()
  })

  test.each([
    ['NoRoute', 200],
    ['NoSegment', 400],
  ])('código %s → AppError no-route', async (code, status) => {
    const fetchFn = vi.fn().mockResolvedValue(json({ code, message: '…' }, status))
    await expect(createOsrmProvider({ fetchFn }).route(FROM, TO)).rejects.toMatchObject({ kind: 'no-route' })
  })

  test('Ok sin rutas → no-route', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ code: 'Ok', routes: [] }))
    await expect(createOsrmProvider({ fetchFn }).route(FROM, TO)).rejects.toMatchObject({ kind: 'no-route' })
  })

  test.each([
    ['error del servidor', new Response('oops', { status: 503 })],
    ['demasiadas peticiones', json({ message: 'Too Many Requests' }, 429)],
    ['geometría inválida', json({ code: 'Ok', routes: [{ duration: 1, distance: 1, geometry: { coordinates: [['a', 1]] } }] })],
    ['duración inválida', json({ code: 'Ok', routes: [{ duration: -1, distance: 1, geometry: okBody.routes[0]!.geometry }] })],
  ])('%s → AppError service', async (_n, res) => {
    const fetchFn = vi.fn().mockResolvedValue(res)
    await expect(createOsrmProvider({ fetchFn }).route(FROM, TO)).rejects.toMatchObject({ kind: 'service' })
  })

  test('rechaza coordenadas inválidas sin llamar al servicio', async () => {
    const fetchFn = vi.fn()
    await expect(createOsrmProvider({ fetchFn }).route({ lat: 200, lon: 0 }, TO)).rejects.toThrow(RangeError)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
