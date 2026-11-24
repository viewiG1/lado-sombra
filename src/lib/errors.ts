export type AppErrorKind = 'offline' | 'gps-denied' | 'gps-unavailable' | 'not-found' | 'no-route' | 'service' | 'timeout'

const MESSAGES: Record<AppErrorKind, string> = {
  offline: 'Estás sin conexión. Revisa tu wifi o tus datos móviles e intenta de nuevo.',
  'gps-denied': 'No tengo permiso para ver tu ubicación. Actívalo en los ajustes del navegador o escribe la dirección.',
  'gps-unavailable': 'No pude obtener tu ubicación. Intenta de nuevo o escribe la dirección.',
  'not-found': 'No encontré ese lugar. Prueba con calle, número y comuna.',
  'no-route': 'No encontré una ruta entre esos puntos. Prueba con lugares más cerca de una calle.',
  service: 'El servicio no respondió bien. Intenta de nuevo en un rato.',
  timeout: 'El servicio se está demorando demasiado. Intenta de nuevo.',
}

/** Error que la interfaz sabe explicar al usuario. */
export class AppError extends Error {
  readonly kind: AppErrorKind

  constructor(kind: AppErrorKind, options?: { cause?: unknown }) {
    super(MESSAGES[kind], options)
    this.name = 'AppError'
    this.kind = kind
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof AppError ? MESSAGES[err.kind] : 'Algo salió mal. Intenta de nuevo.'
}

/** Una petición cancelada (por una más nueva) no es un error que mostrar. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

export const abortError = () => new DOMException('Cancelado', 'AbortError')
