import { describe, expect, test } from 'vitest'
import { darkenStyle, localizeStyle, parseColor } from './mapStyle'

describe('localizeStyle', () => {
  const style = {
    version: 8,
    layers: [
      { id: 'bg', type: 'background' },
      {
        id: 'place',
        type: 'symbol',
        layout: {
          'text-field': ['case', ['has', 'name:nonlatin'], ['get', 'name:latin'], ['coalesce', ['get', 'name_en'], ['get', 'name']]],
          'text-size': 12,
        },
      },
      { id: 'ref', type: 'symbol', layout: { 'text-field': ['to-string', ['get', 'ref']] } },
    ],
  }

  test('prefiere el nombre en español y si no hay, el local', () => {
    const out = localizeStyle(style)
    expect(out.layers[1]!.layout!['text-field']).toEqual([
      'case',
      ['has', 'name:nonlatin'],
      ['get', 'name:latin'],
      ['coalesce', ['get', 'name:es'], ['get', 'name']],
    ])
  })

  test('no toca otras capas ni modifica el original', () => {
    const before = structuredClone(style)
    const out = localizeStyle(style)
    expect(out.layers[2]).toEqual(style.layers[2])
    expect(out.layers[1]!.layout!['text-size']).toBe(12)
    expect(style).toEqual(before)
  })
})

describe('parseColor', () => {
  test.each([
    ['#fff', [255, 255, 255, 1]],
    ['#a0c8f0', [160, 200, 240, 1]],
    ['rgb(10, 20, 30)', [10, 20, 30, 1]],
    ['rgba(10,20,30,0.5)', [10, 20, 30, 0.5]],
    ['hsl(0, 100%, 50%)', [255, 0, 0, 1]],
    ['hsla(120,100%,25%,0.4)', [0, 128, 0, 0.4]],
  ] as const)('%s', (input, rgba) => {
    const c = parseColor(input)!
    expect(c.map((v, i) => (i < 3 ? Math.round(v) : v))).toEqual(rgba)
  })

  test('lo que no es color → null', () => {
    expect(parseColor('match')).toBeNull()
    expect(parseColor('#12')).toBeNull()
  })
})

describe('darkenStyle', () => {
  const lightness = (c: unknown) => {
    const [r, g, b] = parseColor(c as string)!
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255
  }
  const style = {
    version: 8,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
      { id: 'water', type: 'fill', paint: { 'fill-color': 'rgb(158,189,255)' } },
      { id: 'road_minor', type: 'line', paint: { 'line-color': '#fff', 'line-width': 2 } },
      { id: 'road_area_pattern', type: 'fill', paint: { 'fill-pattern': 'pedestrian_polygon' } },
      { id: 'hillshade', type: 'raster', paint: {} },
      {
        id: 'place',
        type: 'symbol',
        paint: { 'text-color': '#333', 'text-halo-color': 'rgba(255,255,255,0.8)' },
      },
      { id: 'zoomed', type: 'fill', paint: { 'fill-color': ['interpolate', ['linear'], ['zoom'], 10, '#eee', 14, '#ddd'] } },
    ],
  }
  const out = darkenStyle(style)
  const paint = (id: string) => out.layers.find((l) => l.id === id)!.paint as Record<string, unknown>

  test('el fondo claro pasa a oscuro', () => {
    expect(lightness(paint('background')['background-color'])).toBeLessThan(0.15)
  })

  test('las calles quedan un poco más claras que el fondo', () => {
    const road = lightness(paint('road_minor')['line-color'])
    expect(road).toBeGreaterThan(lightness(paint('background')['background-color']))
    expect(road).toBeLessThan(0.4)
    expect(paint('road_minor')['line-width']).toBe(2)
  })

  test('el agua sigue siendo azul (conserva el tono)', () => {
    const [r, , b] = parseColor(paint('water')['fill-color'] as string)!
    expect(b).toBeGreaterThan(r)
  })

  test('texto claro sobre halo oscuro', () => {
    expect(lightness(paint('place')['text-color'])).toBeGreaterThan(0.6)
    expect(lightness(paint('place')['text-halo-color'])).toBeLessThan(0.15)
  })

  test('recorre expresiones y no toca los nombres de operadores', () => {
    const expr = paint('zoomed')['fill-color'] as unknown[]
    expect(expr[0]).toBe('interpolate')
    expect(lightness(expr[4])).toBeLessThan(0.3)
  })

  test('saca el relieve claro y atenúa las tramas', () => {
    expect(out.layers.some((l) => l.id === 'hillshade')).toBe(false)
    expect(paint('road_area_pattern')['fill-opacity']).toBeLessThan(0.5)
  })
})
