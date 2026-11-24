import type { ReactNode } from 'react'
import type { Analysis } from '../lib/analyze'
import type { AppError } from '../lib/errors'
import { describeVerdict } from '../lib/verdictText'
import { BusDiagram } from './BusDiagram'
import { Spinner } from './icons'
import { TripTimeline } from './TripTimeline'

type Props =
  | { state: 'empty' }
  | { state: 'loading' }
  | { state: 'error'; error: AppError; onRetry: () => void }
  | { state: 'ready'; analysis: Analysis; departure: string }

/** Ejemplo para la pantalla inicial: sol en el lado puerta, asiento al lado del chofer. */
const EXAMPLE = { sun: { relAngle: 75, elevation: 30 }, lit: 'puerta', recommended: 'chofer' } as const

export function VerdictCard(props: Props) {
  let headline: ReactNode
  let body: ReactNode = null
  let headlineKey: string = props.state

  if (props.state === 'empty') {
    headline = '¿A dónde vas?'
    body = (
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
        <p className="text-[15px] text-mute">
          Elige desde dónde y hasta dónde vas (o toca el mapa). Te digo de qué lado va a pegar el sol y en cuál quedas a la sombra.
        </p>
        <figure className="m-0">
          <BusDiagram {...EXAMPLE} />
          <figcaption className="text-center text-xs text-mute">Ejemplo: sol en la puerta, tú al lado del chofer</figcaption>
        </figure>
      </div>
    )
  } else if (props.state === 'loading') {
    headline = (
      <span className="flex items-center gap-2 text-mute">
        <Spinner width={28} height={28} /> Trazando ruta…
      </span>
    )
  } else if (props.state === 'error') {
    headline = 'No pude calcular'
    body = (
      <div className="mt-2 text-[15px] text-mute">
        <p>{props.error.message}</p>
        <button type="button" onClick={props.onRetry} className="mt-3 min-h-11 rounded-xl bg-ink px-4 font-semibold text-bg">
          Intentar de nuevo
        </button>
      </div>
    )
  } else {
    const { analysis, departure } = props
    const t = describeVerdict(analysis)
    headlineKey = `${analysis.verdict.kind}-${t.side ?? t.reason ?? ''}`
    headline = (
      <>
        {t.lead}
        {t.emphasis && (
          <>
            {' '}
            <b className={t.side === 'chofer' ? 'text-chofer' : 'text-puerta'}>{t.emphasis}</b>
          </>
        )}
      </>
    )
    const recommended = analysis.verdict.kind === 'sentarse' ? analysis.verdict.side : null
    body = (
      <>
        <p className="mt-2 text-[15px] text-mute">{t.detail}</p>
        {t.hint && <p className="mt-1 text-sm text-mute">{t.hint}</p>}
        <div className="mx-auto mt-2 w-full max-w-[240px]">
          <BusDiagram sun={analysis.dominant ?? analysis.sky} lit={analysis.dominant?.side ?? null} recommended={recommended} />
        </div>
        <TripTimeline departure={departure} totalMinutes={analysis.totalMinutes} minutes={analysis.minutes} runs={analysis.runs} />
      </>
    )
  }

  return (
    <section aria-labelledby="verdict" className="rounded-2xl border border-line p-4">
      {/* Solo el titular se anuncia: así el deslizador no llena el lector de pantalla de avisos. */}
      <div aria-live="polite" aria-atomic="true">
        <h2 id="verdict" key={headlineKey} className="animate-pop font-display text-[32px] leading-[1.05] font-bold text-balance sm:text-[36px]">
          {headline}
        </h2>
      </div>
      {body}
    </section>
  )
}
