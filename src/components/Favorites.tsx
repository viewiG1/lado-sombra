import { useState, type ReactNode } from 'react'
import { MAX_NAME_LENGTH, type Favorite } from '../lib/favorites'
import { MODES } from '../lib/modes'
import { CloseIcon, StarIcon } from './icons'

interface Props {
  favorites: Favorite[]
  canSave: boolean
  saveFailed: boolean
  onSave: (name: string) => void
  onLoad: (fav: Favorite) => void
  onRemove: (id: string) => void
  /** Botón para compartir el viaje actual (si hay uno). */
  share?: ReactNode
}

export function Favorites({ favorites, canSave, saveFailed, onSave, onLoad, onRemove, share }: Props) {
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <section aria-labelledby="fav-title" className="grid gap-3">
      <h2 id="fav-title" className="font-display text-2xl font-bold">
        Guardar y compartir
      </h2>

      <form
        className="grid gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSave) {
            setNotice('Primero elige desde y hasta.')
            return
          }
          onSave(name)
          setName('')
          setNotice('Ruta guardada.')
        }}
      >
        <label htmlFor="fav-name" className="text-sm font-medium text-mute">
          Guardar esta ruta
        </label>
        <div className="flex gap-2">
          <input
            id="fav-name"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Ej: casa → pega"
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-line bg-card px-3"
          />
          <button
            type="submit"
            aria-disabled={!canSave}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-ink px-4 font-semibold text-bg aria-disabled:opacity-50"
          >
            <StarIcon width={18} height={18} /> Guardar
          </button>
        </div>
        <p role="status" className="min-h-5 text-sm text-mute">
          {saveFailed ? 'Tu navegador no dejó guardar: la ruta se perderá al cerrar la app.' : notice}
        </p>
      </form>

      {share}

      {favorites.length === 0 ? (
        <p className="text-sm text-mute">Guarda los viajes que haces seguido y cárgalos con un toque.</p>
      ) : (
        <ul className="grid gap-2">
          {favorites.map((f) => (
            <li key={f.id} className="flex gap-2">
              <button
                type="button"
                onClick={() => onLoad(f)}
                className="min-h-11 flex-1 rounded-xl border border-line px-3 py-2 text-left hover:bg-card"
              >
                <span className="block font-medium">{f.name}</span>
                <span className="block text-sm text-mute">
                  {MODES[f.mode].label} · salida {f.time} · {f.from.name} → {f.to.name}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemove(f.id)
                  setNotice(`Borraste "${f.name}".`)
                }}
                aria-label={`Borrar ${f.name}`}
                className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-line text-mute hover:bg-card hover:text-ink"
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
