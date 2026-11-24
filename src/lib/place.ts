export interface LatLon {
  lat: number
  lon: number
}

export interface Place extends LatLon {
  /** Nombre corto para mostrar en el campo. */
  name: string
  /** Comuna, región, etc. */
  detail?: string
}

export function isValidLatLon(p: unknown): p is LatLon {
  if (typeof p !== 'object' || p === null) return false
  const { lat, lon } = p as Record<string, unknown>
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  )
}
