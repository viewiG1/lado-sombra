import { afterEach, describe, expect, test, vi } from 'vitest'
import { AppError } from '../lib/errors'
import { requestJson } from './http'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('requestJson', () => {
  test('entrega estado y cuerpo, también en respuestas con error HTTP', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(json({ a: 1 })).mockResolvedValueOnce(json({ code: 'NoRoute' }, 400))
    expect(await requestJson('https://x', { fetchFn })).toEqual({ ok: true, status: 200, body: { a: 1 } })
    expect(await requestJson('https://x', { fetchFn })).toEqual({ ok: false, status: 400, body: { code: 'NoRoute' } })
  })

  test('cuerpo que no es JSON → body null', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }))
    expect(await requestJson('https://x', { fetchFn })).toEqual({ ok: false, status: 502, body: null })
  })

  test('sin conexión → AppError offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(requestJson('https://x', { fetchFn })).rejects.toMatchObject({ kind: 'offline' })
  })

  test('falla de red con conexión → AppError service', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await requestJson('https://x', { fetchFn }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err).toMatchObject({ kind: 'service' })
  })

  test('se demora más del máximo → AppError timeout', async () => {
    vi.useFakeTimers()
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('x', 'AbortError')))),
    )
    const p = requestJson('https://x', { fetchFn, timeoutMs: 1000 })
    const check = expect(p).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(1000)
    await check
  })

  test('cancelación de quien llama → AbortError (no es un error para el usuario)', async () => {
    const ctrl = new AbortController()
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('x', 'AbortError')))),
    )
    const p = requestJson('https://x', { fetchFn, signal: ctrl.signal })
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})
