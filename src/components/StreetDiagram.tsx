import type { SunSide, SunSummary } from '../lib/analyze'
import { CENTER } from '../lib/busScene'
import type { TravelMode } from '../lib/modes'
import { STREET, streetScene } from '../lib/streetScene'
import type { Situation } from '../lib/sun'
import { OrbitRing, SunOrbit } from './SunOrbit'

interface Props {
  sun: SunSummary | null
  lit: SunSide | null
  mode: Exclude<TravelMode, 'micro'>
}

const SITUATION_TEXT: Record<Situation, string> = {
  chofer: 'El sol viene de tu izquierda.',
  puerta: 'El sol viene de tu derecha.',
  frente: 'El sol te da de frente.',
  atras: 'El sol te da en la espalda.',
  alto: 'El sol va casi encima.',
  noche: 'Es de noche.',
}
const SIDE_WORD: Record<SunSide, string> = { chofer: 'izquierda', puerta: 'derecha' }
const [ROAD_L, ROAD_R] = STREET.road
const TOP = STREET.blocks[0][0]
const BOTTOM = STREET.blocks[STREET.blocks.length - 1]![1]

/** Calle vista desde arriba: edificios, sus sombras según el sol, y dónde conviene ir. */
export function StreetDiagram({ sun, lit, mode }: Props) {
  const scene = streetScene({ sun, lit, mode })
  const shade = scene.shadedSidewalk
  const label = [
    'Calle vista desde arriba, avanzando hacia arriba.',
    SITUATION_TEXT[scene.situation],
    mode === 'pie'
      ? shade
        ? scene.narrowShade
          ? `La vereda de la ${SIDE_WORD[shade]} tiene una franja de sombra junto a los edificios: ve pegado a ellos.`
          : `La vereda de la ${SIDE_WORD[shade]} queda a la sombra de los edificios: ve por ahí.`
        : 'Ninguna vereda queda a la sombra de los edificios.'
      : 'Vas por la pista derecha.',
  ].join(' ')

  return (
    <svg viewBox="0 0 320 320" role="img" aria-label={label} className="h-auto w-full">
      <defs>
        {/* Ventana redonda dentro de la órbita: el sol nunca queda encima de los edificios. */}
        <clipPath id="street-clip">
          <circle cx={CENTER} cy={CENTER} r={114} />
        </clipPath>
      </defs>
      <OrbitRing />

      <g clipPath="url(#street-clip)">
        {/* suelo: veredas, calle y calles transversales */}
        <circle cx={CENTER} cy={CENTER} r={114} fill="var(--card)" />
        <rect x={ROAD_L} y={TOP} width={ROAD_R - ROAD_L} height={BOTTOM - TOP} fill="var(--road)" />
        {STREET.blocks.slice(1).map(([y0], i) => {
          const prevEnd = STREET.blocks[i]![1]
          return <rect key={y0} x={STREET.building.chofer[0]} y={prevEnd} width={STREET.building.puerta[1] - STREET.building.chofer[0]} height={y0 - prevEnd} fill="var(--road)" />
        })}
        <line x1={CENTER} y1={TOP} x2={CENTER} y2={BOTTOM} stroke="var(--bg)" strokeWidth="2" strokeDasharray="8 8" />

        {/* sombras de los edificios */}
        {scene.shadows.map((s, i) => (
          <polygon key={i} points={s.points} fill="var(--bus-shadow)" />
        ))}

        {/* edificios */}
        {(['chofer', 'puerta'] as const).map((side) =>
          STREET.blocks.map(([y0, y1]) => (
            <rect
              key={`${side}${y0}`}
              x={STREET.building[side][0]}
              y={y0}
              width={STREET.building[side][1] - STREET.building[side][0]}
              height={y1 - y0}
              rx="4"
              fill="var(--building)"
              stroke="var(--ink)"
              strokeOpacity=".25"
            />
          )),
        )}
      </g>

      {/* rótulos */}
      <text x={CENTER} y={TOP - 8} textAnchor="middle" className="bus-fade fill-mute text-[11px] font-semibold tracking-wider" style={{ opacity: scene.situation === 'frente' ? 0 : 1 }}>
        ▲ ADELANTE
      </text>
      {(['chofer', 'puerta'] as const).map((side) => {
        const [w0, w1] = STREET.sidewalk[side]
        return (
          <text
            key={side}
            transform={`translate(${(w0 + w1) / 2 + 4} ${CENTER - 40}) rotate(-90)`}
            textAnchor="middle"
            className={`text-[11px] font-semibold tracking-wider ${side === 'chofer' ? 'fill-chofer' : 'fill-puerta'}`}
          >
            {shade === side ? 'SOMBRA' : SIDE_WORD[side].toUpperCase()}
          </text>
        )
      })}

      {/* tú */}
      <g className="bus-anim" style={{ transform: `translate(${scene.you.x}px, ${scene.you.y}px)` }}>
        {mode === 'pie' ? (
          <>
            <circle r="13" fill="var(--ink)" stroke="var(--bg)" strokeWidth="2" />
            <text y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--bg)">
              TÚ
            </text>
          </>
        ) : (
          <>
            <rect x="-11" y="-18" width="22" height="36" rx="8" fill="var(--ink)" stroke="var(--bg)" strokeWidth="2" />
            <text y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--bg)">
              TÚ
            </text>
          </>
        )}
      </g>

      <SunOrbit scene={scene} />
    </svg>
  )
}
