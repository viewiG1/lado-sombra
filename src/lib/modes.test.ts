import { describe, expect, test } from 'vitest'
import { MODES, TRAVEL_MODES, isTravelMode, sideLabel } from './modes'

describe('modos de viaje', () => {
  test('la micro usa el factor 1,5 sobre el auto; bici y a pie usan su propio tiempo', () => {
    expect(MODES.micro.timeFactor).toBe(1.5)
    expect(MODES.bici.timeFactor).toBe(1)
    expect(MODES.pie.timeFactor).toBe(1)
  })

  test('cada modo tiene su servidor de rutas', () => {
    expect(MODES.micro.routingBase).toBe('https://router.project-osrm.org')
    expect(MODES.bici.routingBase).toBe('https://routing.openstreetmap.de/routed-bike')
    expect(MODES.pie.routingBase).toBe('https://routing.openstreetmap.de/routed-foot')
  })

  test('reconoce modos válidos', () => {
    expect(TRAVEL_MODES).toEqual(['micro', 'bici', 'pie'])
    expect(isTravelMode('bici')).toBe(true)
    expect(isTravelMode('auto')).toBe(false)
    expect(isTravelMode(null)).toBe(false)
  })

  test('en la micro los lados son chofer y puerta; a pie y en bici, izquierda y derecha', () => {
    expect(sideLabel('micro', 'chofer')).toBe('lado chofer')
    expect(sideLabel('micro', 'puerta')).toBe('lado puerta')
    expect(sideLabel('pie', 'chofer')).toBe('izquierda')
    expect(sideLabel('bici', 'puerta')).toBe('derecha')
  })
})
