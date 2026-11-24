import { describe, expect, test } from 'vitest'
import { AppError, errorMessage, isAbortError, type AppErrorKind } from './errors'

describe('errores', () => {
  const kinds: AppErrorKind[] = ['offline', 'gps-denied', 'gps-unavailable', 'not-found', 'no-route', 'service', 'timeout']

  test.each(kinds)('%s tiene un mensaje en español', (kind) => {
    const msg = errorMessage(new AppError(kind))
    expect(msg.length).toBeGreaterThan(10)
    expect(new AppError(kind).message).toBe(msg)
  })

  test('mensajes clave', () => {
    expect(errorMessage(new AppError('offline'))).toMatch(/conexión/i)
    expect(errorMessage(new AppError('gps-denied'))).toMatch(/permiso/i)
    expect(errorMessage(new AppError('not-found'))).toMatch(/no encontré ese lugar/i)
    expect(errorMessage(new AppError('no-route'))).toMatch(/ruta/i)
  })

  test('un error desconocido da un mensaje genérico', () => {
    expect(errorMessage(new Error('boom'))).toMatch(/algo salió mal/i)
    expect(errorMessage('x')).toMatch(/algo salió mal/i)
  })

  test('reconoce cancelaciones', () => {
    expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true)
    expect(isAbortError(new AppError('timeout'))).toBe(false)
  })
})
