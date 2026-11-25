import { BUS_TIME_FACTOR, OSRM_URL } from '../config'
import type { SunSide } from './analyze'

export type TravelMode = 'micro' | 'bici' | 'pie'
export const TRAVEL_MODES: readonly TravelMode[] = ['micro', 'bici', 'pie']

interface ModeInfo {
  /** Para botones: "Micro", "Bicicleta", "Caminando". */
  label: string
  /** Para frases: "en micro", "en bici", "a pie". */
  phrase: string
  /** Multiplica el tiempo que entrega el servidor de rutas. */
  timeFactor: number
  /** Servidor OSRM con el perfil de este modo. */
  routingBase: string
}

export const MODES: Record<TravelMode, ModeInfo> = {
  // El servidor de demostración de OSRM solo tiene rutas de auto: se ajustan a velocidad de micro.
  micro: { label: 'Micro', phrase: 'en micro', timeFactor: BUS_TIME_FACTOR, routingBase: OSRM_URL },
  // Servidores de FOSSGIS (los que usa openstreetmap.org) con perfiles de bicicleta y peatón.
  bici: { label: 'Bicicleta', phrase: 'en bici', timeFactor: 1, routingBase: 'https://routing.openstreetmap.de/routed-bike' },
  pie: { label: 'Caminando', phrase: 'a pie', timeFactor: 1, routingBase: 'https://routing.openstreetmap.de/routed-foot' },
}

export function isTravelMode(x: unknown): x is TravelMode {
  return typeof x === 'string' && (TRAVEL_MODES as readonly string[]).includes(x)
}

/** Cómo se llama cada lado en ese modo. Internamente "chofer" es la izquierda y "puerta" la derecha. */
export function sideLabel(mode: TravelMode, side: SunSide): string {
  if (mode === 'micro') return side === 'chofer' ? 'lado chofer' : 'lado puerta'
  return side === 'chofer' ? 'izquierda' : 'derecha'
}
