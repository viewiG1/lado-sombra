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

describe('TimeControls con la ruta: sol según la hora de salida', () => {
  const profile = [
    { time: '17:00', minutes: 2 },
    { time: '17:10', minutes: 8 },
    { time: '18:00', minutes: 14 },
  ]

  test('muestra la franja y su resumen para lectores de pantalla', () => {
    render(
      <TimeControls date="2026-11-24" time="18:00" sun={null} profile={profile} suggestion={null} metric="de sol de lado" onDateChange={vi.fn()} onTimeChange={vi.fn()} onNow={vi.fn()} />,
    )
    expect(screen.getByRole('img', { name: /Menos sol saliendo a las 17:00 \(2 min de sol de lado\).*más sol a las 18:00 \(14 min\)/ })).toBeInTheDocument()
  })

  test('el botón de la sugerencia cambia la hora', () => {
    const onTimeChange = vi.fn()
    render(
      <TimeControls
        date="2026-11-24"
        time="18:00"
        sun={null}
        profile={profile}
        suggestion={{ time: '17:00', minutes: 2, saving: 12 }}
        metric="de sol de lado"
        onDateChange={vi.fn()}
        onTimeChange={onTimeChange}
        onNow={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Sal a las 17:00: 2 min de sol de lado \(12 menos\)/ }))
    expect(onTimeChange).toHaveBeenCalledWith('17:00')
  })

  test('sin ruta no hay franja ni sugerencia', () => {
    render(<TimeControls date="2026-11-24" time="18:00" sun={null} onDateChange={vi.fn()} onTimeChange={vi.fn()} onNow={vi.fn()} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sal a las/ })).not.toBeInTheDocument()
  })
})
