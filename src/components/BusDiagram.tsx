import { useState } from 'react'
import type { Analysis, SunSide } from '../lib/analyze'

interface Props {
  recommended: SunSide | null
  dominant: Analysis['dominant']
}

const SEAT_ROWS = [0, 1, 2, 3, 4, 5]
const RAY_OFFSETS = [-0.28, 0, 0.28]

/** Gira por el camino más corto desde el ángulo anterior (sin dar la vuelta completa). */
function nextAngle(prev: number | null, target: number): number {
  if (prev === null) return target
  return prev + ((((target - prev) % 360) + 540) % 360) - 180
}

function describe(recommended: SunSide | null, dominant: Analysis['dominant']): string {
  const sun = dominant ? `El sol pega más en el lado ${dominant.side}.` : 'El sol no pega de lado.'
  const you = recommended ? ` Tu asiento: lado ${recommended}.` : ''
  return `Micro vista desde arriba, con el frente hacia arriba. ${sun}${you}`
}

export function BusDiagram({ recommended, dominant }: Props) {
  const [angle, setAngle] = useState<number | null>(dominant?.relAngle ?? null)
  const [prevTarget, setPrevTarget] = useState(dominant?.relAngle)
  if (dominant && dominant.relAngle !== prevTarget) {
    setPrevTarget(dominant.relAngle)
    setAngle(nextAngle(angle, dominant.relAngle))
  }

  const lit = dominant?.side ?? null
  return (
    <svg viewBox="0 0 300 300" role="img" aria-label={describe(recommended, dominant)} className="h-auto w-full max-w-[150px]">
      <g
        className="bus-sun"
        style={{ transformOrigin: '150px 150px', transform: `rotate(${angle ?? 0}deg)`, opacity: dominant ? 1 : 0 }}
      >
        <g className="bus-rays">
          {RAY_OFFSETS.map((k) => {
            const b = Math.PI / 2 + k
            return (
              <line
                key={k}
                x1={150 + Math.cos(b) * 22}
                y1={32 + Math.sin(b) * 22}
                x2={150 + Math.cos(b) * 62}
                y2={32 + Math.sin(b) * 62}
                stroke="var(--sun)"
                strokeWidth="4"
                strokeLinecap="round"
              />
            )
          })}
        </g>
        <circle className="bus-halo" cx="150" cy="32" r="20" fill="none" stroke="var(--sun)" strokeWidth="3" />
        <circle cx="150" cy="32" r="17" fill="var(--sun)" />
      </g>

      <rect x="104" y="58" width="92" height="184" rx="18" fill="var(--card)" stroke="var(--ink)" strokeWidth="3" />
      {/* parabrisas */}
      <path d="M114 66h72l-6 16h-60z" fill="var(--ink)" opacity=".75" />
      <rect className="bus-glow" x="98" y="62" width="12" height="176" rx="6" fill="var(--sun)" style={{ opacity: lit === 'chofer' ? 0.85 : 0 }} />
      <rect className="bus-glow" x="190" y="62" width="12" height="176" rx="6" fill="var(--sun)" style={{ opacity: lit === 'puerta' ? 0.85 : 0 }} />
      {/* chofer adelante a la izquierda; puerta a la derecha */}
      <rect x="114" y="90" width="20" height="16" rx="4" fill="var(--chofer)" />
      <rect x="196" y="92" width="5" height="28" fill="var(--puerta)" />
      {SEAT_ROWS.map((r) => (
        <g key={r} fill="var(--line)">
          <rect x="114" y={118 + r * 19} width="22" height="14" rx="3" />
          <rect x="164" y={118 + r * 19} width="22" height="14" rx="3" />
        </g>
      ))}
      <g
        className="bus-you"
        style={{ opacity: recommended ? 1 : 0, transform: recommended === 'puerta' ? 'translateX(50px)' : 'none' }}
      >
        <rect x="112" y="154" width="26" height="18" rx="4" fill="var(--ink)" />
        <text x="125" y="167" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--bg)" fontFamily="Barlow, sans-serif">
          TÚ
        </text>
      </g>
    </svg>
  )
}
