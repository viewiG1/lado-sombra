import { useState } from 'react'
import type { TravelMode } from '../lib/modes'
import type { Place } from '../lib/place'
import { tripToParams } from '../lib/shareLink'
import { ShareIcon } from './icons'

interface Props {
  from: Place
  to: Place
  time: string
  mode: TravelMode
  /** Resumen para el mensaje, por ejemplo "Siéntate al lado del chofer". */
  summary: string
}

type Status = { kind: 'idle' } | { kind: 'copied' } | { kind: 'manual'; url: string }

export function ShareButton({ from, to, time, mode, summary }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}?${tripToParams({ from, to, time, mode })}`
    const text = `${summary} (${from.name} → ${to.name}, ${time})`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lado Sombra', text, url })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return // la persona cerró el menú
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus({ kind: 'copied' })
    } catch {
      setStatus({ kind: 'manual', url })
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => void share()}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 font-semibold hover:bg-card"
      >
        <ShareIcon /> Compartir este viaje
      </button>
      <p role="status" className="text-center text-sm text-mute empty:hidden">
        {status.kind === 'copied' && 'Enlace copiado: pégalo donde quieras.'}
      </p>
      {status.kind === 'manual' && (
        <label className="grid gap-1 text-sm text-mute">
          Copia este enlace:
          <input readOnly value={status.url} onFocus={(e) => e.target.select()} className="min-h-11 rounded-xl border border-line bg-card px-3 text-ink" />
        </label>
      )}
    </div>
  )
}
