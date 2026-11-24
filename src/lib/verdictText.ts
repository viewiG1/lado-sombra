import type { Analysis, NoSideReason, SunSide } from './analyze'

export interface VerdictText {
  /** Comienzo del titular, o el titular completo si no hay énfasis. */
  lead: string
  /** Parte destacada (el lado recomendado). */
  emphasis: string | null
  /** Lado recomendado, para el color del énfasis. */
  side: SunSide | null
  detail: string
  /** Aclaración corta bajo el detalle. */
  hint: string | null
  /** Si da lo mismo: el motivo principal. */
  reason: NoSideReason | null
}

const SIDE_NAME: Record<SunSide, string> = { chofer: 'lado del chofer', puerta: 'lado de la puerta' }
const SIDE_HINT: Record<SunSide, string> = {
  chofer: 'Es el lado izquierdo, mirando hacia adelante.',
  puerta: 'Es el lado derecho, mirando hacia adelante.',
}
const REASON_TEXT: Record<NoSideReason, string> = {
  noche: 'Es de noche: en este viaje no hay sol.',
  alto: 'El sol va casi encima de la micro: no entra por las ventanas de los lados.',
  frente: 'El sol va de frente: entra por el parabrisas, no por los lados.',
  atras: 'El sol va por atrás: no entra por las ventanas de los lados.',
}

function mainReason(reasons: Record<NoSideReason, number>): NoSideReason {
  let best: NoSideReason = 'noche'
  for (const r of ['alto', 'frente', 'atras', 'noche'] as const) if (reasons[r] > reasons[best]) best = r
  return best
}

export function describeVerdict(a: Analysis): VerdictText {
  const total = Math.max(1, Math.round(a.totalMinutes))
  const ch = Math.round(a.minutes.chofer)
  const pu = Math.round(a.minutes.puerta)
  const v = a.verdict
  switch (v.kind) {
    case 'sentarse': {
      const sunny = v.side === 'chofer' ? 'puerta' : 'chofer'
      return {
        lead: 'Siéntate al',
        emphasis: SIDE_NAME[v.side],
        side: v.side,
        detail: `El sol pega en el lado ${sunny} ${sunny === 'puerta' ? pu : ch} de ~${total} min.`,
        hint: SIDE_HINT[v.side],
        reason: null,
      }
    }
    case 'parejo':
      return {
        lead: 'Está parejo',
        emphasis: null,
        side: null,
        detail: `El sol pega ${ch} min en el lado chofer y ${pu} min en el lado puerta.`,
        hint: 'Te va a dar más o menos lo mismo en cualquier lado.',
        reason: null,
      }
    case 'da-lo-mismo': {
      const reason = mainReason(a.reasons)
      return { lead: 'Da lo mismo', emphasis: null, side: null, detail: REASON_TEXT[reason], hint: null, reason }
    }
  }
}
