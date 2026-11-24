import { useCallback, useState } from 'react'
import { STORAGE_KEY, addFavorite, parseFavorites, removeFavorite, serializeFavorites, type Favorite } from '../lib/favorites'

function load(): Favorite[] {
  try {
    return parseFavorites(localStorage.getItem(STORAGE_KEY))
  } catch {
    return [] // navegación privada o almacenamiento bloqueado
  }
}

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>(load)
  const [saveFailed, setSaveFailed] = useState(false)

  const commit = useCallback((next: Favorite[]) => {
    setFavorites(next)
    try {
      localStorage.setItem(STORAGE_KEY, serializeFavorites(next))
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }, [])

  const add = useCallback((input: Omit<Favorite, 'id'>) => commit(addFavorite(favorites, input, newId())), [commit, favorites])
  const remove = useCallback((id: string) => commit(removeFavorite(favorites, id)), [commit, favorites])

  return { favorites, add, remove, saveFailed }
}
