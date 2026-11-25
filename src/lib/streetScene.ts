import type { SunSide, SunSummary } from './analyze'
import { CENTER, busScene, type BusScene } from './busScene'
import type { TravelMode } from './modes'

/** Calle vista desde arriba (viewBox 0 0 320 320), avanzando hacia arriba. Coordenadas x. */
export const STREET = {
  road: [140, 180] as const,
  sidewalk: { chofer: [104, 140] as const, puerta: [180, 216] as const },
  building: { chofer: [52, 104] as const, puerta: [216, 268] as const },
  /** Tramos en y de cada edificio (con calles transversales entre ellos). */
  blocks: [
    [52, 128],
    [138, 206],
    [216, 292],
  ] as const,
}

/** Altura de los edificios en unidades del dibujo: con 65° de sol la sombra ya no llega al centro de la vereda. */
const BUILDING_HEIGHT = 40
const MAX_SHADOW = 120

type Point = [number, number]

/** Envolvente convexa (cadena monótona). */
export function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Point[]) => {
    const out: Point[] = []
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...half(pts), ...half([...pts].reverse())]
}

export interface StreetScene extends BusScene {
  /** Sombra de cada edificio sobre el suelo (polígono SVG). */
  shadows: { side: SunSide; points: string }[]
  /** Vereda con sombra de los edificios: la del lado del sol, si el sol pega de lado (igual que la recomendación). */
  shadedSidewalk: SunSide | null
  /** La sombra no alcanza la mitad de la vereda: hay que ir pegado a los edificios. */
  narrowShade: boolean
  /** Dónde va la persona. */
  you: { x: number; y: number }
}

export function streetScene({ sun, lit, mode }: { sun: SunSummary | null; lit: SunSide | null; mode: TravelMode }): StreetScene {
  const base = busScene({ sun, lit })
  const shadows: StreetScene['shadows'] = []
  let shadedSidewalk: SunSide | null = null
  let narrowShade = false

  if (sun && sun.elevation > 0) {
    const rad = (sun.relAngle * Math.PI) / 180
    const len = Math.min(MAX_SHADOW, BUILDING_HEIGHT / Math.tan((Math.max(sun.elevation, 1) * Math.PI) / 180))
    const dx = -len * Math.sin(rad)
    const dy = len * Math.cos(rad)
    for (const side of ['chofer', 'puerta'] as const) {
      const [x0, x1] = STREET.building[side]
      for (const [y0, y1] of STREET.blocks) {
        const corners: Point[] = [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ]
        const hull = convexHull([...corners, ...corners.map(([x, y]): Point => [x + dx, y + dy])])
        shadows.push({ side, points: hull.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ') })
      }
      // Con el sol de lado (< 65°), los edificios de ese lado siempre dejan algo de sombra en su vereda.
      if (side === lit) {
        const [w0, w1] = STREET.sidewalk[side]
        const reach = side === 'puerta' ? -dx : dx // hacia la calle
        if (reach > 0) {
          shadedSidewalk = side
          narrowShade = reach < (w1 - w0) / 2
        }
      }
    }
  }

  const laneRight = (STREET.road[0] + STREET.road[1]) / 2 + 10
  const walkSide = shadedSidewalk ?? lit ?? 'puerta'
  const [w0, w1] = STREET.sidewalk[walkSide]
  const you = mode === 'bici' ? { x: laneRight, y: CENTER + 40 } : { x: (w0 + w1) / 2, y: CENTER + 40 }

  return { ...base, shadows, shadedSidewalk, narrowShade, you }
}
