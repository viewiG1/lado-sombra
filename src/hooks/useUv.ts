import { useEffect, useState } from 'react'
import { isAbortError } from '../lib/errors'
import type { UvSeries } from '../lib/uv'
import type { UvProvider } from '../services/uv'

/**
 * Pronóstico de UV para el lugar (~1 km) y la fecha. Si no hay pronóstico o falla,
 * `series` queda en null y la app estima el UV con la altura del sol.
 */
export function useUv(provider: UvProvider, lat: number, lon: number, date: string) {
  const la = lat.toFixed(2)
  const lo = lon.toFixed(2)
  const key = `${la},${lo},${date}`
  const [result, setResult] = useState<{ key: string; series: UvSeries | null } | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    provider
      .series(Number(la), Number(lo), date, ctrl.signal)
      .then((series) => {
        if (!ctrl.signal.aborted) setResult({ key, series })
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || isAbortError(err)) return
        setResult({ key, series: null })
      })
    return () => ctrl.abort()
  }, [provider, key, la, lo, date])

  const ready = result?.key === key
  return { series: ready ? result.series : null, loading: !ready }
}
