import type { ReactNode } from 'react'
import type { Analysis } from '../lib/analyze'
import type { AppError } from '../lib/errors'
import { describeVerdict } from '../lib/verdictText'
import { BusDiagram } from './BusDiagram'
import { Spinner } from './icons'

type Props =
  | { state: 'empty' }
  | { state: 'loading' }
  | { state: 'error'; error: AppError; onRetry: () => void }
  | { state: 'ready'; analysis: Analysis }

function Meter({ label, minutes, total, color }: { label: string; minutes: number; total: number; color: string }) {
  const m = Math.round(minutes)
  const pct = total > 0 ? Math.min(100, (minutes / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="whitespace-nowrap tabular-nums">{m} min</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-card" aria-hidden="true">
        <div className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-400" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function VerdictCard(props: Props) {
  let headline: ReactNode
  let detail: ReactNode = null
  let hint: string | null = null
  let headlineKey: string = props.state

  if (props.state === 'empty') {
    headline = 'Elige tu destino'
    detail = 'Busca a dónde vas o toca el mapa, y te digo de qué lado sentarte.'
  } else if (props.state === 'loading') {
    headline = (
      <span className="flex items-center gap-2 text-mute">
        <Spinner width={28} height={28} /> Trazando ruta…
      </span>
    )
  } else if (props.state === 'error') {
    headline = 'No pude calcular'
    detail = (
      <>
        {props.error.message}{' '}
        <button type="button" onClick={props.onRetry} className="mt-2 block min-h-11 rounded-xl bg-ink px-4 font-semibold text-bg">
          Intentar de nuevo
        </button>
      </>
    )
  } else {
    const t = describeVerdict(props.analysis)
    headlineKey = `${props.analysis.verdict.kind}-${t.side ?? ''}`
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
    detail = t.detail
    hint = t.hint
  }

  const analysis = props.state === 'ready' ? props.analysis : null
  const recommended = analysis?.verdict.kind === 'sentarse' ? analysis.verdict.side : null

  return (
    <section aria-labelledby="verdict" className="rounded-2xl border border-line p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 max-[359px]:grid-cols-1">
        <div>
          {/* Solo el titular se anuncia: así el deslizador no llena el lector de pantalla de avisos. */}
          <div aria-live="polite" aria-atomic="true">
            <h2 id="verdict" key={headlineKey} className="animate-pop font-display text-[30px] leading-[1.05] sm:text-[34px] font-bold text-balance">
              {headline}
            </h2>
          </div>
          {detail && <div className="mt-2 text-[15px] text-mute">{detail}</div>}
          {hint && <p className="mt-1 text-sm text-mute">{hint}</p>}
        </div>
        <div className="w-[120px] max-[359px]:mx-auto sm:w-[150px]">
          <BusDiagram recommended={recommended} dominant={analysis?.dominant ?? null} />
        </div>
      </div>

      {analysis && (
        <div className="mt-3 grid gap-2">
          <Meter label="Sol en el lado chofer" minutes={analysis.minutes.chofer} total={analysis.totalMinutes} color="var(--chofer)" />
          <Meter label="Sol en el lado puerta" minutes={analysis.minutes.puerta} total={analysis.totalMinutes} color="var(--puerta)" />
        </div>
      )}
    </section>
  )
}
