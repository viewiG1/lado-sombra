import { describe, expect, test, vi } from 'vitest'
import { createOpenMeteoUv } from './uv'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const body = {
  hourly: {
    time: ['2026-11-24T00:00', '2026-11-24T01:00', '2026-11-24T02:00'],
    uv_index: [0, 1.5, null],
    uv_index_clear_sky: [0, 2, 3],
    temperature_2m: [14.2, 15, 16.5],
    apparent_temperature: [13, 14.1, null],
  },
}

describe('Open-Meteo UV', () => {
  test('pide UV y UV con cielo despejado por hora, en UTC, para el día y el siguiente', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(body))
    await createOpenMeteoUv({ baseUrl: 'https://om.test', fetchFn }).series(-33.4378, -70.6506, '2026-11-24')
    const url = new URL(fetchFn.mock.calls[0]![0] as string)
    expect(url.origin + url.pathname).toBe('https://om.test/v1/forecast')
    expect(url.searchParams.get('hourly')).toBe('uv_index,uv_index_clear_sky,temperature_2m,apparent_temperature')
    expect(url.searchParams.get('timezone')).toBe('GMT')
    expect(url.searchParams.get('start_date')).toBe('2026-11-24')
    expect(url.searchParams.get('end_date')).toBe('2026-11-25')
    // Coordenadas redondeadas: no hace falta más precisión y mejora la caché.
    expect(url.searchParams.get('latitude')).toBe('-33.44')
  })

  test('convierte las horas a instantes UTC', async () => {
    const s = await createOpenMeteoUv({ fetchFn: vi.fn().mockResolvedValue(json(body)) }).series(-33.44, -70.65, '2026-11-24')
    expect(s).toEqual({
      times: [Date.UTC(2026, 10, 24, 0), Date.UTC(2026, 10, 24, 1), Date.UTC(2026, 10, 24, 2)],
      uv: [0, 1.5, null],
      clearSky: [0, 2, 3],
      temp: [14.2, 15, 16.5],
      feels: [13, 14.1, null],
    })
  })

  test('si faltan las temperaturas, igual entrega el UV', async () => {
    const { temperature_2m: _t, apparent_temperature: _a, ...hourly } = body.hourly
    const s = await createOpenMeteoUv({ fetchFn: vi.fn().mockResolvedValue(json({ hourly })) }).series(-33.44, -70.65, '2026-11-24')
    expect(s!.temp).toEqual([null, null, null])
    expect(s!.uv).toEqual([0, 1.5, null])
  })

  test('fecha fuera del rango del pronóstico → null (se usa la estimación)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: true, reason: 'out of allowed range' }, 400))
    expect(await createOpenMeteoUv({ fetchFn }).series(-33.44, -70.65, '2027-03-01')).toBeNull()
  })

  test('respuesta rara o error del servidor → AppError service', async () => {
    const g = createOpenMeteoUv({
      fetchFn: vi.fn().mockResolvedValueOnce(json({ hourly: { time: 'x' } })).mockResolvedValueOnce(new Response('oops', { status: 500 })),
    })
    await expect(g.series(-33.44, -70.65, '2026-11-24')).rejects.toMatchObject({ kind: 'service' })
    await expect(g.series(-33.44, -70.66, '2026-11-24')).rejects.toMatchObject({ kind: 'service' })
  })

  test('guarda en caché por lugar (aprox.) y fecha', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(body))
    const g = createOpenMeteoUv({ fetchFn })
    await g.series(-33.4378, -70.6506, '2026-11-24')
    await g.series(-33.4401, -70.6499, '2026-11-24')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  test('fecha inválida → RangeError sin llamar al servicio', async () => {
    const fetchFn = vi.fn()
    await expect(createOpenMeteoUv({ fetchFn }).series(-33.44, -70.65, '24-11-2026')).rejects.toThrow(RangeError)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
