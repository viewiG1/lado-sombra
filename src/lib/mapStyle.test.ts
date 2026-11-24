import { describe, expect, test } from 'vitest'
import { localizeStyle } from './mapStyle'

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
