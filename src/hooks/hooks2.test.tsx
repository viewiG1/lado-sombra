import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AppError } from '../lib/errors'
import { isTravelMode } from '../lib/modes'
import type { UvSeries } from '../lib/uv'
import type { UvProvider } from '../services/uv'
import { useStoredChoice } from './useStoredChoice'
import { useUv } from './useUv'

const SERIES: UvSeries = { times: [0, 3600000], uv: [1, 2], clearSky: [1, 2] }

afterEach(() => localStorage.clear())

describe('useUv', () => {
  test('pide la serie y la entrega', async () => {
    const provider: UvProvider = { series: vi.fn().mockResolvedValue(SERIES) }
    const { result } = renderHook(() => useUv(provider, -33.44, -70.65, '2026-11-24'))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.series).toBe(SERIES))
    expect(result.current.loading).toBe(false)
  })

  test('si falla, queda sin serie (la app estima) y sin romperse', async () => {
    const provider: UvProvider = { series: vi.fn().mockRejectedValue(new AppError('offline')) }
    const { result } = renderHook(() => useUv(provider, -33.44, -70.65, '2026-11-24'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.series).toBeNull()
  })

  test('mover un poco el punto (mismo ~1 km) no vuelve a pedir; cambiar la fecha sí', async () => {
    const provider: UvProvider = { series: vi.fn().mockResolvedValue(SERIES) }
    const { result, rerender } = renderHook(({ lat, date }) => useUv(provider, lat, -70.65, date), {
      initialProps: { lat: -33.4401, date: '2026-11-24' },
    })
    await waitFor(() => expect(result.current.series).toBe(SERIES))
    rerender({ lat: -33.4404, date: '2026-11-24' })
    expect(provider.series).toHaveBeenCalledTimes(1)
    rerender({ lat: -33.4404, date: '2026-11-25' })
    await waitFor(() => expect(provider.series).toHaveBeenCalledTimes(2))
  })
})

describe('useStoredChoice', () => {
  test('recuerda la elección y descarta valores inválidos', () => {
    localStorage.setItem('k', 'auto')
    const { result } = renderHook(() => useStoredChoice('k', isTravelMode))
    expect(result.current[0]).toBeNull()
    act(() => result.current[1]('pie'))
    expect(result.current[0]).toBe('pie')
    expect(localStorage.getItem('k')).toBe('pie')
    act(() => result.current[1](null))
    expect(localStorage.getItem('k')).toBeNull()
  })

  test('lee lo guardado al empezar', () => {
    localStorage.setItem('k', 'bici')
    const { result } = renderHook(() => useStoredChoice('k', isTravelMode))
    expect(result.current[0]).toBe('bici')
  })
})
