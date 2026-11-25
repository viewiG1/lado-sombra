import { useCallback, useEffect, useState } from 'react'
import { AppError, isAbortError } from '../lib/errors'
import type { LatLon } from '../lib/place'
import type { RouteResult, RoutingProvider } from '../services/routing'

type Result = { key: string; route: RouteResult; error: null } | { key: string; route: null; error: AppError }

export type RouteState =
  | { status: 'idle' | 'loading'; route: null; error: null }
  | { status: 'ok'; route: RouteResult; error: null }
  | { status: 'error'; route: null; error: AppError }

/** Pide la ruta cada vez que cambian origen o destino; cancela la petición anterior. */
export function useRoute(from: LatLon | null, to: LatLon | null, provider: RoutingProvider) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const key = from && to ? `${provider.id};${from.lat},${from.lon};${to.lat},${to.lon};${attempt}` : null

  const fromLat = from?.lat
  const fromLon = from?.lon
  const toLat = to?.lat
  const toLon = to?.lon

  useEffect(() => {
    if (key === null || fromLat === undefined || fromLon === undefined || toLat === undefined || toLon === undefined) return
    const ctrl = new AbortController()
    provider
      .route({ lat: fromLat, lon: fromLon }, { lat: toLat, lon: toLon }, ctrl.signal)
      .then((route) => {
        if (!ctrl.signal.aborted) setResult({ key, route, error: null })
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || isAbortError(err)) return
        setResult({ key, route: null, error: err instanceof AppError ? err : new AppError('service', { cause: err }) })
      })
    return () => ctrl.abort()
  }, [key, fromLat, fromLon, toLat, toLon, provider])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  let state: RouteState
  if (key === null) state = { status: 'idle', route: null, error: null }
  else if (result?.key !== key) state = { status: 'loading', route: null, error: null }
  else if (result.error) state = { status: 'error', route: null, error: result.error }
  else state = { status: 'ok', route: result.route, error: null }

  return { ...state, retry }
}
