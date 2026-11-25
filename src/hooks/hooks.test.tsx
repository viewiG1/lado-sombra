import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AppError } from '../lib/errors'
import { STORAGE_KEY, serializeFavorites } from '../lib/favorites'
import type { RouteResult, RoutingProvider } from '../services/routing'
import { useFavorites } from './useFavorites'
import { useGeolocation } from './useGeolocation'
import { useRoute } from './useRoute'

const A = { lat: -33.44, lon: -70.65, name: 'A' }
const B = { lat: -33.51, lon: -70.76, name: 'B' }
const ROUTE: RouteResult = { coords: [[-70.65, -33.44], [-70.76, -33.51]], durationS: 600, distanceM: 9000, segmentDurationsS: null }

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('useFavorites', () => {
  test('carga, agrega y borra, guardando en localStorage', () => {
    localStorage.setItem(STORAGE_KEY, serializeFavorites([{ id: 'x', name: 'Vieja', from: A, to: B, time: '07:00', mode: 'micro' }]))
    const { result } = renderHook(() => useFavorites())
    expect(result.current.favorites.map((f) => f.name)).toEqual(['Vieja'])

    act(() => result.current.add({ name: 'Nueva', from: B, to: A, time: '18:30', mode: 'pie' }))
    expect(result.current.favorites.map((f) => f.name)).toEqual(['Nueva', 'Vieja'])
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Nueva')

    act(() => result.current.remove('x'))
    expect(result.current.favorites.map((f) => f.name)).toEqual(['Nueva'])
  })

  test('si el navegador no deja guardar, sigue funcionando en memoria y lo avisa', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError')
    })
    const { result } = renderHook(() => useFavorites())
    act(() => result.current.add({ name: 'Nueva', from: A, to: B, time: '08:00', mode: 'micro' }))
    expect(result.current.favorites).toHaveLength(1)
    expect(result.current.saveFailed).toBe(true)
  })
})

function mockGeolocation(impl: (ok: PositionCallback, fail: PositionErrorCallback) => void) {
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition: vi.fn(impl) } })
}

describe('useGeolocation', () => {
  test('entrega la posición', async () => {
    mockGeolocation((ok) => ok({ coords: { latitude: -33.4, longitude: -70.6 } } as GeolocationPosition))
    const { result } = renderHook(() => useGeolocation())
    let pos: unknown
    await act(async () => {
      pos = await result.current.locate()
    })
    expect(pos).toEqual({ lat: -33.4, lon: -70.6 })
    expect(result.current.loading).toBe(false)
  })

  test.each([
    [1, 'gps-denied'],
    [2, 'gps-unavailable'],
    [3, 'gps-unavailable'],
  ])('error de GPS código %i → %s', async (code, kind) => {
    mockGeolocation((_ok, fail) => fail?.({ code, message: '' } as GeolocationPositionError))
    const { result } = renderHook(() => useGeolocation())
    await act(async () => {
      await expect(result.current.locate()).rejects.toMatchObject({ kind })
    })
  })

  test('página sin https → gps-insecure, sin pedir la ubicación', async () => {
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })
    vi.stubGlobal('isSecureContext', false)
    const { result } = renderHook(() => useGeolocation())
    await act(async () => {
      await expect(result.current.locate()).rejects.toMatchObject({ kind: 'gps-insecure' })
    })
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  test('navegador sin GPS → gps-unavailable', async () => {
    vi.stubGlobal('navigator', {})
    const { result } = renderHook(() => useGeolocation())
    await act(async () => {
      await expect(result.current.locate()).rejects.toMatchObject({ kind: 'gps-unavailable' })
    })
  })
})

describe('useRoute', () => {
  test('sin origen o destino no pide nada', () => {
    const provider: RoutingProvider = { id: 'p', route: vi.fn() }
    const { result } = renderHook(() => useRoute(A, null, provider))
    expect(result.current.status).toBe('idle')
    expect(provider.route).not.toHaveBeenCalled()
  })

  test('pide la ruta y la entrega', async () => {
    const provider: RoutingProvider = { id: 'p', route: vi.fn().mockResolvedValue(ROUTE) }
    const { result } = renderHook(() => useRoute(A, B, provider))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ok'))
    expect(result.current.route).toBe(ROUTE)
  })

  test('muestra el error y permite reintentar', async () => {
    const provider: RoutingProvider = {
      id: 'p',
      route: vi.fn().mockRejectedValueOnce(new AppError('no-route')).mockResolvedValueOnce(ROUTE),
    }
    const { result } = renderHook(() => useRoute(A, B, provider))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.kind).toBe('no-route')
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ok'))
  })

  test('cambiar el destino cancela la petición anterior y no la usa', async () => {
    const signals: AbortSignal[] = []
    let resolveFirst: (r: RouteResult) => void = () => {}
    const provider: RoutingProvider = {
      id: 'p',
      route: vi.fn((_f, _t, signal?: AbortSignal) => {
        signals.push(signal!)
        return signals.length === 1 ? new Promise<RouteResult>((res) => (resolveFirst = res)) : Promise.resolve({ ...ROUTE, durationS: 1 })
      }),
    }
    const { result, rerender } = renderHook(({ to }) => useRoute(A, to, provider), { initialProps: { to: B } })
    rerender({ to: { ...B, lat: -33.6 } })
    expect(signals[0]!.aborted).toBe(true)
    await waitFor(() => expect(result.current.route?.durationS).toBe(1))
    resolveFirst(ROUTE)
    await Promise.resolve()
    expect(result.current.route?.durationS).toBe(1)
  })
})

describe('useRoute al cambiar de modo', () => {
  test('otro proveedor (otro modo) vuelve a pedir la ruta y no muestra la anterior mientras carga', async () => {
    const car: RoutingProvider = { id: 'auto', route: vi.fn().mockResolvedValue(ROUTE) }
    const foot: RoutingProvider = { id: 'pie', route: vi.fn(() => new Promise<RouteResult>(() => {})) }
    const { result, rerender } = renderHook(({ p }) => useRoute(A, B, p), { initialProps: { p: car } })
    await waitFor(() => expect(result.current.status).toBe('ok'))
    rerender({ p: foot })
    expect(result.current.status).toBe('loading')
    expect(result.current.route).toBeNull()
    expect(foot.route).toHaveBeenCalled()
  })
})
