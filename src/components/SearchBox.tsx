import { useRef, useState, type ReactNode } from 'react'
import { errorMessage, isAbortError } from '../lib/errors'
import type { Place } from '../lib/place'
import { MIN_QUERY_LENGTH, type Geocoder } from '../services/geocoding'
import { Spinner } from './icons'

interface Props {
  id: string
  label: string
  placeholder: string
  value: Place | null
  onSelect: (place: Place) => void
  geocoder: Geocoder
  /** Botón al lado del campo (Mi ubicación, invertir). */
  action?: ReactNode
  /** Mensaje que viene de afuera (por ejemplo, error de GPS). */
  externalMessage?: string | null
}

/** `query` es el texto que se buscó, para no repetir la misma búsqueda al salir del campo. */
type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; query: string }
  | { kind: 'results'; query: string; places: Place[] }
  | { kind: 'error'; query: string; message: string }

export function SearchBox({ id, label, placeholder, value, onSelect, geocoder, action, externalMessage }: Props) {
  const [text, setText] = useState(value?.name ?? '')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [prevValue, setPrevValue] = useState(value)
  const pending = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Si el lugar cambia desde afuera (mapa, GPS, invertir, favorito), el texto lo sigue.
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value?.name ?? '')
    setStatus({ kind: 'idle' })
  }

  /** `force`: Enter siempre busca; salir del campo solo si el texto cambió desde la última búsqueda. */
  async function search(force: boolean) {
    const q = text.trim()
    if (value && q === value.name) return
    if (!force && status.kind !== 'idle' && status.query === q) return
    pending.current?.abort()
    if (q === '') {
      setStatus({ kind: 'idle' })
      return
    }
    if (q.length < MIN_QUERY_LENGTH) {
      setStatus({ kind: 'error', query: q, message: `Escribe al menos ${MIN_QUERY_LENGTH} letras.` })
      return
    }
    const ctrl = new AbortController()
    pending.current = ctrl
    setStatus({ kind: 'loading', query: q })
    try {
      const places = await geocoder.search(q, ctrl.signal)
      if (!ctrl.signal.aborted) setStatus({ kind: 'results', query: q, places })
    } catch (err) {
      if (isAbortError(err) || ctrl.signal.aborted) return
      setStatus({ kind: 'error', query: q, message: errorMessage(err) })
    }
  }

  function choose(place: Place) {
    pending.current?.abort()
    onSelect(place)
  }

  const statusId = `${id}-status`
  const message = status.kind === 'error' ? status.message : (externalMessage ?? null)

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-mute">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={text}
          aria-describedby={statusId}
          aria-invalid={status.kind === 'error' || undefined}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void search(true)
            }
          }}
          onBlur={(e) => {
            if (listRef.current?.contains(e.relatedTarget)) return
            void search(false)
          }}
          className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-line bg-card px-3 text-base placeholder:text-mute/80"
        />
        {action}
      </div>

      <div id={statusId} role="status" className="text-sm">
        {status.kind === 'loading' && (
          <p className="mt-2 flex items-center gap-2 text-mute">
            <Spinner width={16} height={16} /> Buscando…
          </p>
        )}
        {status.kind === 'results' && (
          <span className="sr-only">
            {status.places.length === 1 ? 'Un resultado' : `${status.places.length} resultados`}
          </span>
        )}
        {message && <p className="mt-2 text-chofer">{message}</p>}
      </div>

      {status.kind === 'results' && (
        <ul ref={listRef} className="mt-2 grid gap-1" aria-label={`Resultados para ${label.toLowerCase()}`}>
          {status.places.map((p) => (
            <li key={`${p.lat},${p.lon},${p.name}`}>
              <button
                type="button"
                onClick={() => choose(p)}
                className="min-h-11 w-full rounded-xl border border-line px-3 py-2 text-left hover:bg-card"
              >
                <span className="block font-medium">{p.name}</span>
                {p.detail && <span className="block text-sm text-mute">{p.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
