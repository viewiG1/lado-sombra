import { useState } from 'react'
import type { SunSide, SunSummary } from '../lib/analyze'
import { CENTER, busScene } from '../lib/busScene'
import type { Situation } from '../lib/sun'

interface Props {
  /** Dónde está el sol en promedio respecto de la micro; null si es de noche. */
  sun: SunSummary | null
  /** Lado que recibe el sol, si pega de lado. */
  lit: SunSide | null
  /** Lado recomendado para sentarse (asiento "TÚ"). */
  recommended: SunSide | null
}

// Micro: 92 × 184, centrada.
const BUS = { x: CENTER - 46, y: CENTER - 92, w: 92, h: 184 }
const SEAT_ROWS = [0, 1, 2, 3, 4, 5]
const SEAT_X = { chofer: BUS.x + 10, puerta: BUS.x + 60 }
const TOWARD_BUS_RAYS = [-0.5, 0, 0.5] // radianes alrededor de "hacia la micro"
const ALL_AROUND_RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

const SITUATION_TEXT: Record<Situation, string> = {
  chofer: 'El sol pega en el lado chofer.',
  puerta: 'El sol pega en el lado puerta.',
  frente: 'El sol va de frente.',
  atras: 'El sol va por atrás.',
  alto: 'El sol va casi encima de la micro.',
  noche: 'Es de noche.',
}

/** Gira por el camino más corto desde el ángulo anterior (sin dar la vuelta completa). */
function nextAngle(prev: number | null, target: number): number {
  if (prev === null) return target
  return prev + ((((target - prev) % 360) + 540) % 360) - 180
}

export function BusDiagram({ sun, lit, recommended }: Props) {
  const scene = busScene({ sun, lit })
  const target = scene.sun?.angle ?? null
  const [angle, setAngle] = useState<number | null>(target)
  const [prevTarget, setPrevTarget] = useState(target)
  if (target !== null && target !== prevTarget) {
    setPrevTarget(target)
    setAngle(nextAngle(angle, target))
  }

  const night = scene.situation === 'noche'
  const overhead = scene.sun !== null && scene.sun.distance < 20
  const you = recommended ? `Tu asiento: lado ${recommended}, a la sombra.` : ''
  const label = `Micro vista desde arriba, con el frente hacia arriba. ${SITUATION_TEXT[scene.situation]} ${you}`.trim()

  return (
    <svg viewBox="0 0 320 320" role="img" aria-label={label} className="h-auto w-full">
      {/* órbita del sol */}
      <circle cx={CENTER} cy={CENTER} r={132} fill="none" stroke="var(--line)" strokeWidth="2" strokeDasharray="3 7" />

      {/* sombra de la micro en el suelo */}
      <rect
        className="bus-anim"
        x={BUS.x}
        y={BUS.y}
        width={BUS.w}
        height={BUS.h}
        rx="18"
        fill="var(--bus-shadow)"
        style={{
          transform: `translate(${scene.shadow?.dx ?? 0}px, ${scene.shadow?.dy ?? 0}px)`,
          opacity: scene.shadow ? 1 : 0,
        }}
      />

      {/* rótulos */}
      <text
        x={CENTER}
        y={BUS.y - 10}
        textAnchor="middle"
        className="bus-fade fill-mute text-[11px] font-semibold tracking-wider"
        style={{ opacity: scene.situation === 'frente' ? 0 : 1 }}
      >
        ▲ ADELANTE
      </text>
      <text
        transform={`translate(${BUS.x - 22} ${CENTER}) rotate(-90)`}
        textAnchor="middle"
        className="fill-chofer text-[12px] font-semibold tracking-wider"
      >
        CHOFER
      </text>
      <text
        transform={`translate(${BUS.x + BUS.w + 22} ${CENTER}) rotate(90)`}
        textAnchor="middle"
        className="fill-puerta text-[12px] font-semibold tracking-wider"
      >
        PUERTA
      </text>

      {/* micro */}
      <g className="bus-fade" style={{ opacity: night ? 0.7 : 1 }}>
        <rect x={BUS.x} y={BUS.y} width={BUS.w} height={BUS.h} rx="18" fill="var(--card)" stroke="var(--ink)" strokeWidth="3" />
        <path d={`M${BUS.x + 10} ${BUS.y + 8}h72l-6 16h-60z`} fill="var(--ink)" opacity=".75" />
        {(['chofer', 'puerta'] as const).map((side) => (
          <rect
            key={side}
            className="bus-fade"
            x={side === 'chofer' ? BUS.x - 6 : BUS.x + BUS.w - 6}
            y={BUS.y + 4}
            width="12"
            height={BUS.h - 8}
            rx="6"
            fill="var(--sun)"
            style={{ opacity: lit === side ? 0.9 : 0 }}
          />
        ))}
        <rect x={BUS.x + 10} y={BUS.y + 32} width="20" height="16" rx="4" fill="var(--chofer)" />
        <rect x={BUS.x + BUS.w - 8} y={BUS.y + 34} width="5" height="28" fill="var(--puerta)" />
        {SEAT_ROWS.map((r) =>
          (['chofer', 'puerta'] as const).map((side) => (
            <rect
              key={`${side}${r}`}
              className="bus-fill"
              x={SEAT_X[side]}
              y={BUS.y + 60 + r * 19}
              width="22"
              height="14"
              rx="3"
              fill={lit === side ? 'var(--sun-seat)' : 'var(--line)'}
            />
          )),
        )}
        <g
          className="bus-anim"
          style={{ opacity: recommended ? 1 : 0, transform: recommended === 'puerta' ? 'translateX(50px)' : 'none' }}
        >
          <rect x={SEAT_X.chofer - 2} y={BUS.y + 96} width="26" height="18" rx="4" fill="var(--ink)" />
          <text x={SEAT_X.chofer + 11} y={BUS.y + 109} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--bg)">
            TÚ
          </text>
        </g>
      </g>

      {/* sol: gira alrededor de la micro y se acerca al techo cuando sube */}
      <g
        className="bus-sun"
        style={{
          transformOrigin: `${CENTER}px ${CENTER}px`,
          transform: `rotate(${angle ?? 0}deg) translate(0px, ${-(scene.sun?.distance ?? 132)}px)`,
          opacity: scene.sun ? 1 : 0,
        }}
      >
        <g className="bus-rays bus-fade" style={{ opacity: overhead ? 0 : 1 }}>
          {TOWARD_BUS_RAYS.map((k) => (
            <line
              key={k}
              x1={CENTER + Math.sin(k) * 22}
              y1={CENTER + Math.cos(k) * 22}
              x2={CENTER + Math.sin(k) * 36}
              y2={CENTER + Math.cos(k) * 36}
              stroke="var(--sun)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          ))}
        </g>
        <g className="bus-rays bus-fade" style={{ opacity: overhead ? 1 : 0 }}>
          {ALL_AROUND_RAYS.map((deg) => {
            const a = (deg * Math.PI) / 180
            return (
              <line
                key={deg}
                x1={CENTER + Math.sin(a) * 23}
                y1={CENTER + Math.cos(a) * 23}
                x2={CENTER + Math.sin(a) * 32}
                y2={CENTER + Math.cos(a) * 32}
                stroke="var(--sun)"
                strokeWidth="4"
                strokeLinecap="round"
              />
            )
          })}
        </g>
        <circle className="bus-halo" cx={CENTER} cy={CENTER} r="20" fill="none" stroke="var(--sun)" strokeWidth="3" />
        <circle cx={CENTER} cy={CENTER} r="17" fill="var(--sun)" stroke="var(--bg)" strokeWidth="2" />
      </g>

      {/* luna */}
      <g className="bus-fade" style={{ opacity: night ? 1 : 0 }}>
        <circle cx="268" cy="52" r="18" fill="var(--mute)" />
        <circle cx="277" cy="45" r="16" fill="var(--bg)" />
      </g>
    </svg>
  )
}
