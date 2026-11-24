import { AppError, abortError } from '../lib/errors'

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

export interface RequestOptions {
  fetchFn?: FetchFn
  signal?: AbortSignal
  timeoutMs?: number
}

export interface JsonResponse {
  ok: boolean
  status: number
  /** null si el cuerpo no era JSON. */
  body: unknown
}

const defaultFetch: FetchFn = (url, init) => fetch(url, init)

/**
 * GET que devuelve el JSON aunque el estado HTTP sea de error (OSRM explica sus errores en el cuerpo).
 * Traduce fallas de red a AppError; una cancelación de quien llama se propaga como AbortError.
 */
export async function requestJson(url: string, options: RequestOptions = {}): Promise<JsonResponse> {
  const { fetchFn = defaultFetch, signal, timeoutMs = 15000 } = options
  if (signal?.aborted) throw abortError()

  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, timeoutMs)
  const forwardAbort = () => ctrl.abort()
  signal?.addEventListener('abort', forwardAbort, { once: true })

  try {
    const res = await fetchFn(url, { signal: ctrl.signal })
    const text = await res.text()
    let body: unknown = null
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
    return { ok: res.ok, status: res.status, body }
  } catch (err) {
    if (timedOut) throw new AppError('timeout', { cause: err })
    if (signal?.aborted) throw abortError()
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AppError('offline', { cause: err })
    throw new AppError('service', { cause: err })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
