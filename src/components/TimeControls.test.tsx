import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { dayTrack, sliderPercent } from '../lib/timeline'
import { TimeControls } from './TimeControls'

describe('sliderPercent y dayTrack', () => {
  test('05:00 = 0 %, 22:00 = 100 %, fuera de rango se ajusta', () => {
    expect(sliderPercent('05:00')).toBe(0)
    expect(sliderPercent('22:00')).toBe(100)
    expect(sliderPercent('13:30')).toBe(50)
    expect(sliderPercent('03:00')).toBe(0)
  })

  test('el fondo marca la noche alrededor de la salida y la puesta del sol', () => {
    const g = dayTrack({ sunrise: '06:27', sunset: '20:31' })
    expect(g).toMatch(/^linear-gradient\(to right, var\(--sun-night\)/)
    expect(g).toContain('var(--sun-day)')
    expect(dayTrack(null)).toBe('var(--sun-day)')
  })
})

describe('TimeControls', () => {
  const setup = () => {
    const onTimeChange = vi.fn()
    const onNow = vi.fn()
    render(
      <TimeControls
        date="2026-11-24"
        time="18:00"
        sun={{ sunrise: '06:27', sunset: '20:31' }}
        onDateChange={vi.fn()}
        onTimeChange={onTimeChange}
        onNow={onNow}
      />,
    )
    return { onTimeChange, onNow }
  }

  test('muestra la hora en grande y cuándo sale y se pone el sol', () => {
    setup()
    expect(screen.getByRole('status')).toHaveTextContent('18:00')
    expect(screen.getByText('Sale el sol 06:27 · se pone 20:31')).toBeInTheDocument()
  })

  test('el deslizador cambia la hora y anuncia la hora como texto', () => {
    const { onTimeChange } = setup()
    const slider = screen.getByRole('slider', { name: 'Hora de salida' })
    expect(slider).toHaveAttribute('aria-valuetext', '18:00')
    fireEvent.change(slider, { target: { value: '1105' } })
    expect(onTimeChange).toHaveBeenCalledWith('18:25')
  })

  test('el botón Ahora vuelve a la hora actual', () => {
    const { onNow } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Ahora' }))
    expect(onNow).toHaveBeenCalled()
  })
})
