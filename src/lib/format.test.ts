import { describe, expect, test } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  test.each([
    [0, '0 min'],
    [0.4, '0 min'],
    [14.6, '15 min'],
    [59.4, '59 min'],
    [59.6, '1 h'],
    [60, '1 h'],
    [80, '1 h 20 min'],
    [97, '1 h 37 min'],
    [198.2, '3 h 18 min'],
    [120, '2 h'],
  ])('%d → %s', (min, text) => {
    expect(formatDuration(min)).toBe(text)
  })
})
