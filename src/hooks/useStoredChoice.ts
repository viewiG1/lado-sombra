import { useCallback, useState } from 'react'

/** Un valor guardado en localStorage, validado al leer. null = sin elegir. */
export function useStoredChoice<T extends string>(key: string, isValid: (x: unknown) => x is T) {
  const [value, setValue] = useState<T | null>(() => {
    try {
      const raw = localStorage.getItem(key)
      return isValid(raw) ? raw : null
    } catch {
      return null
    }
  })

  const update = useCallback(
    (next: T | null) => {
      setValue(next)
      try {
        if (next === null) localStorage.removeItem(key)
        else localStorage.setItem(key, next)
      } catch {
        // Navegación privada o almacenamiento lleno: la elección dura hasta cerrar la app.
      }
    },
    [key],
  )

  return [value, update] as const
}
