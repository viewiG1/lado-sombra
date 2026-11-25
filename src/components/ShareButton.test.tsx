import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ShareButton } from './ShareButton'

const props = {
  from: { lat: -33.4378, lon: -70.6506, name: 'Plaza de Armas' },
  to: { lat: -33.5107, lon: -70.7573, name: 'Plaza de Maipú' },
  time: '18:00',
  mode: 'micro' as const,
  summary: 'Siéntate al lado del chofer',
}

afterEach(() => vi.unstubAllGlobals())

describe('ShareButton', () => {
  test('usa el menú de compartir del teléfono con texto y enlace', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, share })
    render(<ShareButton {...props} />)
    await userEvent.click(screen.getByRole('button', { name: /Compartir este viaje/ }))
    expect(share).toHaveBeenCalledWith({
      title: 'Lado Sombra',
      text: 'Siéntate al lado del chofer (Plaza de Armas → Plaza de Maipú, 18:00)',
      url: expect.stringMatching(/\?de=-33\.4378%2C-70\.6506&den=Plaza\+de\+Armas&a=.*&hora=18%3A00&modo=micro$/),
    })
  })

  test('sin menú de compartir, copia el enlace y lo avisa', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } })
    render(<ShareButton {...props} />)
    await userEvent.click(screen.getByRole('button', { name: /Compartir este viaje/ }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('hora=18%3A00'))
    expect(await screen.findByText(/Enlace copiado/)).toBeInTheDocument()
  })

  test('si no puede copiar, muestra el enlace para copiarlo a mano', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } })
    render(<ShareButton {...props} />)
    await userEvent.click(screen.getByRole('button', { name: /Compartir este viaje/ }))
    expect(((await screen.findByLabelText(/Copia este enlace/)) as HTMLInputElement).value).toContain('modo=micro')
  })

  test('si la persona cierra el menú de compartir, no copia nada', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')), clipboard: { writeText } })
    render(<ShareButton {...props} />)
    await userEvent.click(screen.getByRole('button', { name: /Compartir este viaje/ }))
    expect(writeText).not.toHaveBeenCalled()
  })
})
