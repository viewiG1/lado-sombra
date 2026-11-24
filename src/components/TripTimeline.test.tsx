import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { Run } from '../lib/analyze'
import { arrivalTime } from '../lib/timeline'
import { TripTimeline } from './TripTimeline'

const run = (side: Run['side'], minutes: number): Run => ({ side, minutes, coords: [] })

describe('arrivalTime', () => {
  test('suma los minutos a la salida', () => {
    expect(arrivalTime('18:00', 27.6)).toBe('18:28')
  })
  test('pasa la medianoche', () => {
    expect(arrivalTime('23:50', 20)).toBe('00:10')
  })
})

describe('TripTimeline', () => {
  test('muestra salida, llegada y los minutos de cada lado', () => {
    render(
      <TripTimeline
        departure="18:00"
        totalMinutes={28}
        minutes={{ chofer: 0, puerta: 14, none: 14 }}
        runs={[run('none', 4), run('puerta', 14), run('none', 10)]}
      />,
    )
    expect(screen.getByText('Salida 18:00')).toBeInTheDocument()
    expect(screen.getByText('Llegada ~18:28')).toBeInTheDocument()
    expect(screen.getByText('Sol lado puerta').closest('li')).toHaveTextContent('14 min')
    expect(screen.getByText('Sol lado chofer').closest('li')).toHaveTextContent('0 min')
    expect(screen.getByText('Sin sol de lado').closest('li')).toHaveTextContent('14 min')
  })

  test('cada tramo ocupa su parte del viaje, en orden', () => {
    const { container } = render(
      <TripTimeline
        departure="18:00"
        totalMinutes={20}
        minutes={{ chofer: 5, puerta: 10, none: 5 }}
        runs={[run('chofer', 5), run('puerta', 10), run('none', 5)]}
      />,
    )
    const widths = [...container.querySelectorAll<HTMLElement>('[data-run]')].map((el) => el.style.width)
    expect(widths).toEqual(['25%', '50%', '25%'])
  })

  test('describe el viaje para lectores de pantalla', () => {
    render(<TripTimeline departure="08:00" totalMinutes={10} minutes={{ chofer: 10, puerta: 0, none: 0 }} runs={[run('chofer', 10)]} />)
    expect(screen.getByRole('img', { name: /Salida 08:00.*llegada cerca de las 08:10/ })).toBeInTheDocument()
  })
})
