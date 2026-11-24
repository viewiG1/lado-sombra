import { describe, expect, test } from 'vitest'
import { CENTER, ORBIT, busScene } from './busScene'

const sun = (relAngle: number, elevation: number) => ({ relAngle, elevation })

describe('busScene', () => {
  test('sol a la derecha (lado puerta): el sol a la derecha y la sombra hacia la izquierda', () => {
    const s = busScene({ sun: sun(90, 25), lit: 'puerta' })
    expect(s.situation).toBe('puerta')
    expect(s.sun!.distance).toBe(ORBIT)
    expect(s.sun!.x).toBeCloseTo(CENTER + ORBIT, 6)
    expect(s.sun!.y).toBeCloseTo(CENTER, 6)
    expect(s.shadow!.dx).toBeLessThan(0)
    expect(Math.abs(s.shadow!.dy)).toBeLessThan(1e-6)
  })

  test('sol de frente: arriba del dibujo, sombra hacia atrás', () => {
    const s = busScene({ sun: sun(5, 20), lit: null })
    expect(s.situation).toBe('frente')
    expect(s.sun!.y).toBeLessThan(CENTER - ORBIT * 0.9)
    expect(s.shadow!.dy).toBeGreaterThan(0)
  })

  test('sol por atrás: abajo del dibujo', () => {
    const s = busScene({ sun: sun(180, 20), lit: null })
    expect(s.situation).toBe('atras')
    expect(s.sun!.y).toBeGreaterThan(CENTER + ORBIT * 0.9)
  })

  test('sol muy alto: encima del techo y casi sin sombra', () => {
    const s = busScene({ sun: sun(30, 78), lit: null })
    expect(s.situation).toBe('alto')
    expect(s.sun!.distance).toBe(0)
    expect(Math.hypot(s.shadow!.dx, s.shadow!.dy)).toBeLessThan(8)
  })

  test('el sol se acerca al techo a medida que sube', () => {
    const d = [30, 45, 55, 64].map((el) => busScene({ sun: sun(90, el), lit: 'puerta' }).sun!.distance)
    for (let i = 1; i < d.length; i++) expect(d[i]!).toBeLessThanOrEqual(d[i - 1]!)
    expect(d[0]).toBe(ORBIT)
  })

  test('sol bajo → sombra larga; sol alto → sombra corta', () => {
    const len = (el: number) => {
      const sh = busScene({ sun: sun(90, el), lit: 'puerta' }).shadow!
      return Math.hypot(sh.dx, sh.dy)
    }
    expect(len(8)).toBeGreaterThan(len(40))
    expect(len(1)).toBeLessThanOrEqual(48)
  })

  test('de noche: sin sol ni sombra', () => {
    const s = busScene({ sun: null, lit: null })
    expect(s.situation).toBe('noche')
    expect(s.sun).toBeNull()
    expect(s.shadow).toBeNull()
  })

  test('el lado iluminado manda aunque el promedio caiga cerca del frente', () => {
    expect(busScene({ sun: sun(25, 30), lit: 'puerta' }).situation).toBe('puerta')
  })
})
