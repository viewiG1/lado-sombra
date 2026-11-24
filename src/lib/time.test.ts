import { describe, expect, test } from 'vitest'
import { chileNow, chileToUtc, hhmmToMinutes, minutesToHhmm } from './time'

const iso = (ms: number) => new Date(ms).toISOString()

describe('chileToUtc', () => {
  test('verano: UTC−3', () => {
    expect(iso(chileToUtc('2026-11-24', '18:00'))).toBe('2026-11-24T21:00:00.000Z')
  })

  test('invierno: UTC−4', () => {
    expect(iso(chileToUtc('2026-07-15', '12:00'))).toBe('2026-07-15T16:00:00.000Z')
  })

  test('alrededor del paso a horario de invierno (4 de abril)', () => {
    expect(iso(chileToUtc('2026-04-04', '12:00'))).toBe('2026-04-04T15:00:00.000Z')
    expect(iso(chileToUtc('2026-04-05', '12:00'))).toBe('2026-04-05T16:00:00.000Z')
  })

  test('alrededor del paso a horario de verano (6 de septiembre)', () => {
    expect(iso(chileToUtc('2026-09-05', '12:00'))).toBe('2026-09-05T16:00:00.000Z')
    expect(iso(chileToUtc('2026-09-06', '12:00'))).toBe('2026-09-06T15:00:00.000Z')
  })

  test('una hora que no existe (salto de reloj) igual da un instante cercano', () => {
    const ms = chileToUtc('2026-09-06', '00:30')
    expect(ms).toBeGreaterThanOrEqual(Date.UTC(2026, 8, 6, 3, 30))
    expect(ms).toBeLessThanOrEqual(Date.UTC(2026, 8, 6, 4, 30))
  })

  test.each([
    ['', '10:00'],
    ['2026-13-01', '10:00'],
    ['2026-02-30', '10:00'],
    ['2026-11-24', '24:00'],
    ['2026-11-24', '7:5'],
    ['hola', 'chao'],
  ])('rechaza fecha u hora inválida (%s %s)', (d, t) => {
    expect(() => chileToUtc(d, t)).toThrow(RangeError)
  })
})

describe('chileNow', () => {
  test('entrega fecha y hora de Chile', () => {
    expect(chileNow(Date.UTC(2026, 10, 25, 2, 7))).toEqual({ date: '2026-11-24', time: '23:07' })
    expect(chileNow(Date.UTC(2026, 6, 15, 16, 0))).toEqual({ date: '2026-07-15', time: '12:00' })
  })
})

describe('minutos ↔ HH:MM', () => {
  test('convierte en ambos sentidos', () => {
    expect(hhmmToMinutes('05:00')).toBe(300)
    expect(hhmmToMinutes('22:00')).toBe(1320)
    expect(minutesToHhmm(305)).toBe('05:05')
    expect(minutesToHhmm(0)).toBe('00:00')
  })

  test('rechaza valores fuera de rango', () => {
    expect(() => hhmmToMinutes('25:00')).toThrow(RangeError)
    expect(() => minutesToHhmm(1440)).toThrow(RangeError)
    expect(() => minutesToHhmm(-1)).toThrow(RangeError)
  })
})
