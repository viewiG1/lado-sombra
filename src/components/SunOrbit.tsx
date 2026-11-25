import { useState } from 'react'
import { CENTER, ORBIT, type BusScene } from '../lib/busScene'

const TOWARD_CENTER_RAYS = [-0.5, 0, 0.5] // radianes alrededor de "hacia el centro"
const ALL_AROUND_RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

/** Gira por el camino más corto desde el ángulo anterior (sin dar la vuelta completa). */
function nextAngle(prev: number | null, target: number): number {
  if (prev === null) return target
  return prev + ((((target - prev) % 360) + 540) % 360) - 180
}

/** Círculo punteado por donde se mueve el sol. Va debajo del dibujo. */
export function OrbitRing() {
  return <circle cx={CENTER} cy={CENTER} r={ORBIT} fill="none" stroke="var(--line)" strokeWidth="2" strokeDasharray="3 7" />
}

/** Sol que recorre la órbita y sube hacia el centro cuando está alto; luna de noche. Va encima del dibujo. */
export function SunOrbit({ scene }: { scene: Pick<BusScene, 'sun' | 'situation'> }) {
  const target = scene.sun?.angle ?? null
  const [angle, setAngle] = useState<number | null>(target)
  const [prevTarget, setPrevTarget] = useState(target)
  if (target !== null && target !== prevTarget) {
    setPrevTarget(target)
    setAngle(nextAngle(angle, target))
  }
  const overhead = scene.sun !== null && scene.sun.distance < 20

  return (
    <>
      <g
        className="bus-sun"
        style={{
          transformOrigin: `${CENTER}px ${CENTER}px`,
          transform: `rotate(${angle ?? 0}deg) translate(0px, ${-(scene.sun?.distance ?? ORBIT)}px)`,
          opacity: scene.sun ? 1 : 0,
        }}
      >
        <g className="bus-rays bus-fade" style={{ opacity: overhead ? 0 : 1 }}>
          {TOWARD_CENTER_RAYS.map((k) => (
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

      <g className="bus-fade" style={{ opacity: scene.situation === 'noche' ? 1 : 0 }}>
        <circle cx="268" cy="52" r="18" fill="var(--mute)" />
        <circle cx="277" cy="45" r="16" fill="var(--bg)" />
      </g>
    </>
  )
}
