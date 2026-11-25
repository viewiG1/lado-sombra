import { describe, expect, test } from 'vitest'
import { paramsToTrip, tripToParams } from './shareLink'

const from = { lat: -33.4378123, lon: -70.6506456, name: 'Plaza de Armas', detail: 'Santiago' }
const to = { lat: -33.5107, lon: -70.7573, name: 'Plaza de Maipú' }

describe('enlace para compartir', () => {
  test('ida y vuelta: lo que se comparte se lee igual (coordenadas con 5 decimales, sin detalle)', () => {
    const params = tripToParams({ from, to, time: '18:00', mode: 'pie' })
    expect(paramsToTrip(`?${params}`)).toEqual({
      from: { lat: -33.43781, lon: -70.65065, name: 'Plaza de Armas' },
      to: { lat: -33.5107, lon: -70.7573, name: 'Plaza de Maipú' },
      time: '18:00',
      mode: 'pie',
    })
  })

  test('nombres con acentos y signos sobreviven', () => {
    const params = tripToParams({ from: { ...from, name: 'Ñuñoa & Providencia #2' }, to, time: '08:05', mode: 'micro' })
    expect(paramsToTrip(params).from!.name).toBe('Ñuñoa & Providencia #2')
  })

  test('sin parámetros → nada', () => {
    expect(paramsToTrip('')).toEqual({})
  })

  test('descarta lo inválido sin romper lo demás', () => {
    const t = paramsToTrip('?de=200,10&den=Malo&a=-33.5,-70.7&an=Bueno&hora=25:00&modo=auto')
    expect(t).toEqual({ to: { lat: -33.5, lon: -70.7, name: 'Bueno' } })
  })

  test('sin nombre, usa uno genérico; nombres largos se cortan', () => {
    expect(paramsToTrip('?de=-33.4,-70.6').from!.name).toBe('Punto compartido')
    expect(paramsToTrip(`?de=-33.4,-70.6&den=${'x'.repeat(300)}`).from!.name).toHaveLength(80)
  })
})
