import type { Analysis, SunSide } from './analyze'

export interface VerdictText {
  /** Comienzo del titular, o el titular completo si no hay énfasis. */
  lead: string
  /** Parte destacada (el lado recomendado). */
  emphasis: string | null
  /** Lado recomendado, para el color del énfasis. */
  side: SunSide | null
  detail: string
  /** Aclaración para quien no sabe dónde va el chofer. */
  hint: string | null
}

const SIDE_NAME: Record<SunSide, string> = { chofer: 'lado del chofer', puerta: 'lado de la puerta' }
const SIDE_HINT: Record<SunSide, string> = {
  chofer: 'Es el lado izquierdo, mirando hacia adelante.',
  puerta: 'Es el lado derecho, mirando hacia adelante.',
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
      }
    }
    case 'parejo':
      return {
        lead: 'Está parejo',
        emphasis: null,
        side: null,
        detail: `El sol pega ${ch} min en el lado chofer y ${pu} min en el lado puerta.`,
        hint: null,
      }
    case 'da-lo-mismo':
      return { lead: 'Da lo mismo', emphasis: null, side: null, detail: 'En este viaje el sol no te pega de lado.', hint: null }
  }
}
