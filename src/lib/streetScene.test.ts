import { describe, expect, test } from 'vitest'
import { STREET, convexHull, streetScene } from './streetScene'

const sun = (relAngle: number, elevation: number) => ({ relAngle, elevation })

describe('convexHull', () => {
  test('envuelve un rectángulo y su copia desplazada', () => {
    const hull = convexHull([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
      [15, 5],
      [15, 15],
      [5, 15],
    ])
    expect(hull).toHaveLength(6)
    expect(hull).not.toContainEqual([5, 5])
  })
})

describe('streetScene', () => {
  test('sol a la derecha y bajo: los edificios de la derecha dan sombra a la vereda derecha', () => {
    const s = streetScene({ sun: sun(90, 30), lit: 'puerta', mode: 'pie' })
    expect(s.shadedSidewalk).toBe('puerta')
    // "TÚ" va por la vereda derecha
    expect(s.you.x).toBeGreaterThan(STREET.road[1])
  })

  test('sol a la izquierda: vereda izquierda con sombra y "TÚ" ahí', () => {
    const s = streetScene({ sun: sun(270, 30), lit: 'chofer', mode: 'pie' })
    expect(s.shadedSidewalk).toBe('chofer')
    expect(s.you.x).toBeLessThan(STREET.road[0])
  })

  test('sol alto y algo adelante: la sombra es una franja angosta, pero sigue del lado que recomienda el texto', () => {
    const s = streetScene({ sun: sun(300, 64), lit: 'chofer', mode: 'pie' })
    expect(s.shadedSidewalk).toBe('chofer')
    expect(s.narrowShade).toBe(true)
  })

  test('sol bajo de lado: sombra ancha', () => {
    expect(streetScene({ sun: sun(90, 25), lit: 'puerta', mode: 'pie' }).narrowShade).toBe(false)
  })

  test('sol muy alto: la sombra no alcanza las veredas', () => {
    expect(streetScene({ sun: sun(90, 72), lit: null, mode: 'pie' }).shadedSidewalk).toBeNull()
  })

  test('sol de frente: ninguna vereda queda con más sombra', () => {
    expect(streetScene({ sun: sun(0, 25), lit: null, mode: 'pie' }).shadedSidewalk).toBeNull()
  })

  test('en bici vas por la pista derecha, aunque la sombra esté a la izquierda', () => {
    const s = streetScene({ sun: sun(270, 30), lit: 'chofer', mode: 'bici' })
    expect(s.you.x).toBeGreaterThan((STREET.road[0] + STREET.road[1]) / 2)
    expect(s.you.x).toBeLessThan(STREET.road[1])
  })

  test('hay una sombra por edificio; de noche, ninguna', () => {
    const day = streetScene({ sun: sun(90, 30), lit: 'puerta', mode: 'pie' })
    expect(day.shadows).toHaveLength(STREET.blocks.length * 2)
    for (const sh of day.shadows) expect(sh.points).toMatch(/^[\d.\s,-]+$/)
    expect(streetScene({ sun: null, lit: null, mode: 'pie' }).shadows).toEqual([])
  })
})
