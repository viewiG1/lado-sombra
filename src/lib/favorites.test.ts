import { describe, expect, test } from 'vitest'
import { MAX_FAVORITES, addFavorite, parseFavorites, removeFavorite, serializeFavorites, type Favorite } from './favorites'

const from = { lat: -33.44, lon: -70.65, name: 'Casa' }
const to = { lat: -33.51, lon: -70.76, name: 'Pega', detail: 'Maipú' }
const fav: Favorite = { id: 'a', name: 'Casa → pega', from, to, time: '08:00' }

describe('parseFavorites', () => {
  test('lee lo que se guardó', () => {
    expect(parseFavorites(serializeFavorites([fav]))).toEqual([fav])
  })

  test.each([null, '', 'no es json', '{"v":1}', '[1,2]', '{"v":99,"items":[]}'])('dato vacío o corrupto (%s) → lista vacía', (raw) => {
    expect(parseFavorites(raw)).toEqual([])
  })

  test('descarta solo los favoritos inválidos', () => {
    const bad = [
      { ...fav, id: 'b', time: '25:00' },
      { ...fav, id: 'c', from: { lat: 'x', lon: 1, name: 'x' } },
      { ...fav, id: 'd', name: 42 },
      { ...fav, id: 'e', to: null },
    ]
    const raw = JSON.stringify({ v: 1, items: [fav, ...bad] })
    expect(parseFavorites(raw)).toEqual([fav])
  })

  test('no deja pasar campos de más ni nombres de lugar gigantes', () => {
    const raw = JSON.stringify({ v: 1, items: [{ ...fav, extra: '<script>', from: { ...from, name: 'x'.repeat(500) } }] })
    const [f] = parseFavorites(raw)
    expect(f).not.toHaveProperty('extra')
    expect(f!.from.name.length).toBeLessThanOrEqual(120)
  })
})

describe('addFavorite / removeFavorite', () => {
  test('agrega al principio con nombre limpio', () => {
    const list = addFavorite([fav], { name: '  Al gym  ', from: to, to: from, time: '19:30' }, 'z')
    expect(list[0]).toEqual({ id: 'z', name: 'Al gym', from: to, to: from, time: '19:30' })
    expect(list).toHaveLength(2)
  })

  test('sin nombre usa "Origen → Destino"', () => {
    expect(addFavorite([], { name: '   ', from, to, time: '08:00' }, 'z')[0]!.name).toBe('Casa → Pega')
  })

  test('corta nombres muy largos', () => {
    expect(addFavorite([], { name: 'x'.repeat(100), from, to, time: '08:00' }, 'z')[0]!.name).toHaveLength(40)
  })

  test(`guarda como máximo ${MAX_FAVORITES}: se va el más antiguo`, () => {
    let list: Favorite[] = []
    for (let i = 0; i < MAX_FAVORITES + 2; i++) list = addFavorite(list, { name: `R${i}`, from, to, time: '08:00' }, `id${i}`)
    expect(list).toHaveLength(MAX_FAVORITES)
    expect(list[0]!.name).toBe(`R${MAX_FAVORITES + 1}`)
  })

  test('rechaza hora inválida', () => {
    expect(() => addFavorite([], { name: 'x', from, to, time: '8' }, 'z')).toThrow(RangeError)
  })

  test('borra por id', () => {
    expect(removeFavorite([fav], 'a')).toEqual([])
    expect(removeFavorite([fav], 'otro')).toEqual([fav])
  })
})
