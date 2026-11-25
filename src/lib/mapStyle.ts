interface StyleLike {
  layers: { layout?: Record<string, unknown> }[]
}

function replaceNameEn(expr: unknown): unknown {
  if (!Array.isArray(expr)) return expr
  if (expr.length === 2 && expr[0] === 'get' && expr[1] === 'name_en') return ['get', 'name:es']
  return expr.map(replaceNameEn)
}

/** Los estilos de OpenFreeMap muestran nombres en inglés si existen; preferimos el español y luego el nombre local. */
export function localizeStyle<T extends StyleLike>(style: T): T {
  return {
    ...style,
    layers: style.layers.map((layer) =>
      layer.layout && 'text-field' in layer.layout
        ? { ...layer, layout: { ...layer.layout, 'text-field': replaceNameEn(layer.layout['text-field']) } }
        : layer,
    ),
  }
}

type Rgba = [r: number, g: number, b: number, a: number]

/** Lee los formatos de color que usan los estilos de OpenFreeMap: #rgb, #rrggbb, rgb(a)() y hsl(a)(). */
export function parseColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s)
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join('') : hex[1]!
    const n = parseInt(h, 16)
    return [n >> 16, (n >> 8) & 255, n & 255, 1]
  }
  const fn = /^(rgb|hsl)a?\(([^)]+)\)$/.exec(s)
  if (!fn) return null
  const parts = fn[2]!.split(',').map((p) => parseFloat(p))
  if (parts.length < 3 || parts.some(Number.isNaN)) return null
  const a = parts[3] ?? 1
  if (fn[1] === 'rgb') return [parts[0]!, parts[1]!, parts[2]!, a]
  return [...hslToRgb(parts[0]!, parts[1]! / 100, parts[2]! / 100), a]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

type Role = 'area' | 'road' | 'text' | 'halo'

/** Pasa un color del mapa claro a su versión nocturna según su papel en el mapa. */
function nightColor(color: string, role: Role): string {
  const rgba = parseColor(color)
  if (!rgba) return color
  let [h, s, l] = rgbToHsl(rgba[0], rgba[1], rgba[2])
  // Los grises y beige se enfrían hacia el gris azulado de la app; agua y parques conservan su tono.
  if (s < 0.25) {
    h = 220
    s = 0.1
  }
  const out =
    role === 'area'
      ? [h, s * 0.5, 0.09 + (1 - l) * 0.2] // claro → oscuro
      : role === 'road'
        ? [h, s * 0.12, 0.17 + l * 0.17] // calles: algo más claras que el fondo, sin color
        : role === 'text'
          ? [h, s * 0.5, l < 0.5 ? 0.85 - l * 0.3 : 0.2] // texto oscuro → claro
          : [h, s * 0.3, 0.08] // halo
  return `hsla(${out[0]!.toFixed(0)}, ${(out[1]! * 100).toFixed(0)}%, ${(out[2]! * 100).toFixed(0)}%, ${rgba[3]})`
}

function recolor(value: unknown, role: Role): unknown {
  if (typeof value === 'string') return nightColor(value, role)
  // En expresiones, el primer elemento es el nombre del operador.
  if (Array.isArray(value)) return value.map((v, i) => (i === 0 && typeof v === 'string' ? v : recolor(v, role)))
  if (value && typeof value === 'object' && 'stops' in value) {
    const v = value as { stops: [unknown, unknown][] }
    return { ...v, stops: v.stops.map(([z, c]) => [z, recolor(c, role)]) }
  }
  return value
}

interface PaintStyle {
  layers: { id: string; type: string; paint?: Record<string, unknown> }[]
}

const ROAD_LAYER = /^(road|tunnel|bridge|aeroway)_/

/** Versión nocturna de un estilo claro (OpenFreeMap "liberty"): conserva todo el detalle con colores oscuros. */
export function darkenStyle<T extends PaintStyle>(style: T): T {
  return {
    ...style,
    layers: style.layers
      .filter((l) => l.type !== 'raster') // el relieve sombreado es claro: de noche estorba
      .map((layer) => {
        if (!layer.paint) return layer
        const paint: Record<string, unknown> = {}
        const role: Role = layer.type === 'line' && ROAD_LAYER.test(layer.id) ? 'road' : 'area'
        for (const [key, value] of Object.entries(layer.paint)) {
          if (key === 'text-color') paint[key] = recolor(value, 'text')
          else if (key === 'text-halo-color') paint[key] = recolor(value, 'halo')
          else if (key.endsWith('-color') && key !== 'icon-color') paint[key] = recolor(value, role)
          else paint[key] = value
        }
        // Las tramas (paseos peatonales, humedales) son imágenes claras: se atenúan.
        if ('fill-pattern' in paint) paint['fill-opacity'] = 0.2
        return { ...layer, paint }
      }),
  }
}
