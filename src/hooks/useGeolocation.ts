import { useCallback, useState } from 'react'
import { AppError } from '../lib/errors'
import type { LatLon } from '../lib/place'

const PERMISSION_DENIED = 1

export function useGeolocation() {
  const [loading, setLoading] = useState(false)

  const locate = useCallback(
    () =>
      new Promise<LatLon>((resolve, reject) => {
        const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
        if (!geo) {
          reject(new AppError('gps-unavailable'))
          return
        }
        setLoading(true)
        geo.getCurrentPosition(
          (pos) => {
            setLoading(false)
            resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude })
          },
          (err) => {
            setLoading(false)
            reject(new AppError(err.code === PERMISSION_DENIED ? 'gps-denied' : 'gps-unavailable', { cause: err }))
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        )
      }),
    [],
  )

  return { locate, loading }
}
