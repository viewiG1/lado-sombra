import type { Analysis, NoSideReason, SunSide } from './analyze'
import { formatDuration as fmt } from './format'
import { sideLabel, type TravelMode } from './modes'

export interface VerdictText {
  /** Comienzo del titular, o el titular completo si no hay énfasis. */
  lead: string
  /** Parte destacada (lado recomendado). */
  emphasis: string | null
  /** Lado de la parte destacada, para su color (chofer = izquierda, puerta = derecha). */
  side: SunSide | null
  detail: string
  /** Aclaración corta bajo el detalle. */
  hint: string | null
  /** Aviso aparte (sol bajo en la cara). */
  warning: string | null
  /** Si no hay sol de lado: el motivo principal. */
  reason: NoSideReason | null
}

/** Desde este tiempo con sol bajo de frente se avisa de lentes de sol. */
const GLARE_WARNING_MIN = 2

const opposite = (s: SunSide): SunSide => (s === 'chofer' ? 'puerta' : 'chofer')

function mainReason(reasons: Record<NoSideReason, number>): NoSideReason {
  let best: NoSideReason = 'noche'
  for (const r of ['alto', 'frente', 'atras', 'noche'] as const) if (reasons[r] > reasons[best]) best = r
  return best
}

const MICRO_SIDE: Record<SunSide, string> = { chofer: 'lado del chofer', puerta: 'lado de la puerta' }
const MICRO_HINT: Record<SunSide, string> = {
  chofer: 'Es el lado izquierdo, mirando hacia adelante.',
  puerta: 'Es el lado derecho, mirando hacia adelante.',
}

const REASON: Record<TravelMode, Record<NoSideReason, { lead: string; detail: string }>> = {
  micro: {
    noche: { lead: 'Da lo mismo', detail: 'Es de noche: en este viaje no hay sol.' },
    alto: { lead: 'Da lo mismo', detail: 'El sol va casi encima de la micro: no entra por las ventanas de los lados.' },
    frente: { lead: 'Da lo mismo', detail: 'El sol va de frente: entra por el parabrisas, no por los lados.' },
    atras: { lead: 'Da lo mismo', detail: 'El sol va por atrás: no entra por las ventanas de los lados.' },
  },
  pie: {
    noche: { lead: 'Da lo mismo la vereda', detail: 'Es de noche: en este camino no hay sol.' },
    alto: { lead: 'Da lo mismo la vereda', detail: 'El sol va casi encima: los edificios casi no dan sombra. Busca árboles o toldos.' },
    frente: { lead: 'Da lo mismo la vereda', detail: 'El sol te da de frente: ninguna vereda tiene más sombra que la otra.' },
    atras: { lead: 'Da lo mismo la vereda', detail: 'El sol te da en la espalda: ninguna vereda tiene más sombra que la otra.' },
  },
  bici: {
    noche: { lead: 'Es de noche', detail: 'En este viaje no hay sol. Usa luces en la bici.' },
    alto: { lead: 'Sol encima', detail: 'El sol va casi vertical: te pega en la cabeza y los hombros.' },
    frente: { lead: 'Sol de frente', detail: 'El sol te da de frente durante casi todo el viaje.' },
    atras: { lead: 'Sol en la espalda', detail: 'El sol te da en la espalda durante casi todo el viaje.' },
  },
}

export function describeVerdict(a: Analysis, mode: TravelMode = 'micro'): VerdictText {
  const total = fmt(Math.max(1, a.totalMinutes))
  const ch = fmt(a.minutes.chofer)
  const pu = fmt(a.minutes.puerta)
  const warning =
    mode !== 'micro' && a.glareMinutes >= GLARE_WARNING_MIN
      ? `El sol bajo te va a dar en la cara ~${fmt(a.glareMinutes)}: lleva lentes de sol${mode === 'bici' ? ' y anda con cuidado' : ''}.`
      : null
  const base = { warning, reason: null }
  const v = a.verdict

  if (v.kind === 'da-lo-mismo') {
    const reason = mainReason(a.reasons)
    return { ...REASON[mode][reason], emphasis: null, side: null, hint: null, warning, reason }
  }

  if (v.kind === 'parejo') {
    const left = sideLabel(mode, 'chofer')
    const right = sideLabel(mode, 'puerta')
    const detail =
      mode === 'micro'
        ? `El sol pega ${ch} en el lado chofer y ${pu} en el lado puerta.`
        : `El sol te da ${ch} por la ${left} y ${pu} por la ${right}.`
    const hint =
      mode === 'micro'
        ? 'Te va a dar más o menos lo mismo en cualquier lado.'
        : mode === 'pie'
          ? 'Cambia de vereda según la calle: la sombra está del lado del sol.'
          : 'El sol se reparte entre los dos lados.'
    return { ...base, lead: 'Está parejo', emphasis: null, side: null, detail, hint }
  }

  // Hay un lado con más sol. En la micro te sientas al otro lado; a pie vas por la vereda
  // del lado del sol (los edificios de ese lado la tapan); en bici solo se informa.
  const seat = v.side
  const sunny = opposite(seat)
  const sunnyMin = sunny === 'puerta' ? pu : ch
  if (mode === 'micro') {
    return {
      ...base,
      lead: 'Siéntate al',
      emphasis: MICRO_SIDE[seat],
      side: seat,
      detail: `El sol pega en el lado ${sunny} ${sunnyMin} de ~${total}.`,
      hint: MICRO_HINT[seat],
    }
  }
  const sunnyName = sideLabel(mode, sunny)
  if (mode === 'pie') {
    return {
      ...base,
      lead: 'Camina por la vereda de la',
      emphasis: sunnyName,
      side: sunny,
      detail: `El sol viene de tu ${sunnyName} ${sunnyMin} de ~${total}: los edificios de ese lado dan sombra a su vereda.`,
      hint: 'Mientras más alto el sol, más angosta la sombra: anda pegado a los edificios.',
    }
  }
  return {
    ...base,
    lead: 'El sol te pega por la',
    emphasis: sunnyName,
    side: sunny,
    detail: `${sunnyMin} de ~${total} en bici.`,
    hint: 'Si puedes, elige calles con árboles.',
  }
}

/** El titular en una línea, por ejemplo "Siéntate al lado del chofer". */
export function headline(t: Pick<VerdictText, 'lead' | 'emphasis'>): string {
  return t.emphasis ? `${t.lead} ${t.emphasis}` : t.lead
}
