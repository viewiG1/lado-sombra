import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'
import type { MapViewProps } from './components/MapView'

// En jsdom no hay WebGL: el mapa se reemplaza por un botón que simula un toque.
vi.mock('./components/MapView', () => ({
  default: (p: MapViewProps) => (
    <button type="button" onClick={() => p.onPick({ lat: -33.47, lon: -70.6506 })}>
      mapa simulado
    </button>
  ),
}))

const PLAZA = { lat: '-33.4378', lon: '-70.6506', name: 'Plaza de Armas', display_name: 'Plaza de Armas, Santiago, Chile' }
const SUR = { lat: '-33.4648', lon: '-70.6506', name: 'Destino Sur', display_name: 'Destino Sur, Santiago, Chile' }

/** Ruta recta entre dos puntos, en 10 segmentos de 60 s. */
function osrmRoute(url: string) {
  const [a, b] = new URL(url).pathname.split('/').at(-1)!.split(';').map((p) => p.split(',').map(Number))
  const coords = Array.from({ length: 11 }, (_, i) => [a![0]! + ((b![0]! - a![0]!) * i) / 10, a![1]! + ((b![1]! - a![1]!) * i) / 10])
  return { code: 'Ok', routes: [{ duration: 600, distance: 3000, geometry: { coordinates: coords }, legs: [{ annotation: { duration: Array(10).fill(60) } }] }] }
}

const fetchMock = vi.fn(async (input: string | URL) => {
  const url = String(input)
  let body: unknown = []
  if (url.includes('/route/v1/')) body = osrmRoute(url)
  else if (url.includes('nominatim') && /plaza/i.test(url)) body = [PLAZA]
  else if (url.includes('nominatim') && /sur/i.test(url)) body = [SUR]
  return new Response(JSON.stringify(body), { status: 200 })
})

beforeEach(() => vi.stubGlobal('fetch', fetchMock))
afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockClear()
  localStorage.clear()
})

function setDateTime(date: string, time: string) {
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: date } })
  fireEvent.change(screen.getByLabelText('Salida'), { target: { value: time } })
}

async function searchAndPick(user: ReturnType<typeof userEvent.setup>, label: string, text: string, result: string) {
  await user.type(screen.getByLabelText(label), `${text}{Enter}`)
  await user.click(await screen.findByRole('button', { name: new RegExp(result) }, { timeout: 3000 }))
}

describe('App', () => {
  test('flujo completo: buscar, recomendar, mover la hora sin volver a pedir la ruta e invertir', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Elige tu destino' })).toBeInTheDocument()

    setDateTime('2026-11-24', '18:00')
    await searchAndPick(user, 'Desde', 'plaza de armas', 'Plaza de Armas')
    await searchAndPick(user, 'Hasta', 'destino sur', 'Destino Sur')

    expect(await screen.findByRole('heading', { name: /Siéntate al lado del chofer/ })).toBeInTheDocument()
    const routeCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('/route/v1/')).length
    expect(routeCalls()).toBe(1)

    // Mediodía de verano: el sol está muy alto. Recalcula sin pedir otra ruta.
    setDateTime('2026-12-21', '13:40')
    expect(await screen.findByRole('heading', { name: 'Da lo mismo' })).toBeInTheDocument()
    expect(routeCalls()).toBe(1)

    // Viaje de vuelta (hacia el norte) a las 18:00: al revés.
    setDateTime('2026-11-24', '18:00')
    await user.click(screen.getByRole('button', { name: /Invertir desde y hasta/ }))
    expect(await screen.findByRole('heading', { name: /Siéntate al lado de la puerta/ })).toBeInTheDocument()
    expect(routeCalls()).toBe(2)
  }, 10000)

  test('lugar no encontrado muestra un mensaje claro', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Desde'), 'zzzzzz{Enter}')
    expect(await screen.findByText(/No encontré ese lugar/, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  test('sin permiso de GPS muestra un mensaje claro', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      onLine: true,
      geolocation: { getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) => fail({ code: 1 }) },
    })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Mi ubicación/ }))
    expect(await screen.findByText(/No tengo permiso para ver tu ubicación/)).toBeInTheDocument()
  })

  test('marcar en el mapa, guardar la ruta y volver a cargarla', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Tocar el mapa: primero marca desde y pasa solo a hasta.
    await user.click(screen.getByRole('button', { name: 'mapa simulado' }))
    expect(screen.getByRole('button', { name: 'Hasta', pressed: true })).toBeInTheDocument()
    await searchAndPick(user, 'Hasta', 'destino sur', 'Destino Sur')

    setDateTime('2026-11-24', '18:00')
    await user.type(screen.getByLabelText('Guardar esta ruta'), 'A la pega')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    const fav = screen.getByRole('button', { name: /^A la pega/ })
    expect(within(fav).getByText(/Salida 18:00 · Punto en el mapa .* → Destino Sur/)).toBeInTheDocument()

    // Cargarla vuelve a poner la hora guardada.
    fireEvent.change(screen.getByLabelText('Salida'), { target: { value: '07:00' } })
    await user.click(fav)
    expect(screen.getByLabelText('Salida')).toHaveValue('18:00')

    await user.click(screen.getByRole('button', { name: 'Borrar A la pega' }))
    await waitFor(() => expect(screen.queryByText('A la pega')).not.toBeInTheDocument())
  }, 10000)
})
