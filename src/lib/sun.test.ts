import { describe, expect, test } from 'vitest'
import { chileToUtc } from './time'
import { classifySide, relativeAngle, sunPosition, sunSituation, sunTimes } from './sun'

const STGO = { lat: -33.4378, lon: -70.6506 }

describe('sunPosition', () => {
  test('Santiago, 24 nov 18:00: sol al oeste, sobre el horizonte', () => {
    const s = sunPosition(chileToUtc('2026-11-24', '18:00'), STGO.lat, STGO.lon)
    expect(s.azimuth).toBeGreaterThan(240)
    expect(s.azimuth).toBeLessThan(290)
    expect(s.elevation).toBeGreaterThan(15)
    expect(s.elevation).toBeLessThan(45)
  })

  test('mediodía de verano: sol muy alto', () => {
    const s = sunPosition(chileToUtc('2026-12-21', '13:40'), STGO.lat, STGO.lon)
    expect(s.elevation).toBeGreaterThan(75)
  })

  test('de madrugada: bajo el horizonte', () => {
    expect(sunPosition(chileToUtc('2026-11-24', '02:00'), STGO.lat, STGO.lon).elevation).toBeLessThan(0)
  })
})

describe('relativeAngle', () => {
  test('normaliza a [0, 360)', () => {
    expect(relativeAngle(270, 180)).toBe(90)
    expect(relativeAngle(10, 350)).toBe(20)
    expect(relativeAngle(350, 10)).toBe(340)
    expect(relativeAngle(90, 90)).toBe(0)
  })
})

describe('classifySide', () => {
  const sun = (azimuth: number, elevation = 30) => ({ azimuth, elevation })

  test('sol a la derecha → lado puerta; a la izquierda → lado chofer', () => {
    expect(classifySide(sun(270), 180)).toBe('puerta') // micro al sur, sol al oeste
    expect(classifySide(sun(270), 0)).toBe('chofer') // micro al norte, sol al oeste
  })

  test('de frente o por atrás → sin sol de lado', () => {
    expect(classifySide(sun(10), 0)).toBe('none')
    expect(classifySide(sun(350), 0)).toBe('none')
    expect(classifySide(sun(180), 0)).toBe('none')
  })

  test('bordes de los rangos', () => {
    expect(classifySide(sun(19.99), 0)).toBe('none')
    expect(classifySide(sun(20), 0)).toBe('puerta')
    expect(classifySide(sun(160), 0)).toBe('puerta')
    expect(classifySide(sun(160.01), 0)).toBe('none')
    expect(classifySide(sun(199.99), 0)).toBe('none')
    expect(classifySide(sun(200), 0)).toBe('chofer')
    expect(classifySide(sun(340), 0)).toBe('chofer')
    expect(classifySide(sun(340.01), 0)).toBe('none')
  })

  test('sol bajo el horizonte o muy alto → sin sol de lado', () => {
    expect(classifySide(sun(90, 0), 0)).toBe('none')
    expect(classifySide(sun(90, -5), 0)).toBe('none')
    expect(classifySide(sun(90, 65), 0)).toBe('none')
    expect(classifySide(sun(90, 64.9), 0)).toBe('puerta')
  })
})

describe('sunSituation: lado o motivo por el que no pega de lado', () => {
  const sun = (azimuth: number, elevation = 30) => ({ azimuth, elevation })

  test.each([
    [sun(270), 180, 'puerta'],
    [sun(270), 0, 'chofer'],
    [sun(10), 0, 'frente'],
    [sun(350), 0, 'frente'],
    [sun(180), 0, 'atras'],
    [sun(90, 70), 0, 'alto'],
    [sun(90, -3), 0, 'noche'],
    [sun(10, 70), 0, 'alto'], // muy alto gana sobre de frente
  ] as const)('%o con rumbo %i → %s', (s, heading, expected) => {
    expect(sunSituation(s, heading)).toBe(expected)
  })

  test('es coherente con classifySide', () => {
    for (let az = 0; az < 360; az += 7) {
      for (const el of [-5, 10, 40, 70]) {
        const sit = sunSituation(sun(az, el), 0)
        const side = classifySide(sun(az, el), 0)
        expect(side).toBe(sit === 'chofer' || sit === 'puerta' ? sit : 'none')
      }
    }
  })
})

describe('sunTimes', () => {
  test('Santiago, 24 nov: amanece cerca de las 6:27 y se pone cerca de las 20:31 (hora de Chile)', () => {
    const t = sunTimes('2026-11-24', STGO.lat, STGO.lon)
    expect(t).not.toBeNull()
    expect(t!.sunrise).toMatch(/^06:[23]\d$/)
    expect(t!.sunset).toMatch(/^20:[23]\d$/)
  })

  test('fecha inválida → null', () => {
    expect(sunTimes('nada', STGO.lat, STGO.lon)).toBeNull()
  })
})
