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

/** UV 5 todo el día (7 con cielo despejado), en horas UTC desde start_date. */
function openMeteo(url: string) {
  const start = Date.parse(`${new URL(url).searchParams.get('start_date')}T00:00:00Z`)
  const time = Array.from({ length: 48 }, (_, i) => new Date(start + i * 3600000).toISOString().slice(0, 16))
  return { hourly: { time, uv_index: time.map(() => 5), uv_index_clear_sky: time.map(() => 7) } }
}

const fetchMock = vi.fn(async (input: string | URL) => {
  const url = String(input)
  let body: unknown = []
  if (url.includes('/route/v1/')) body = osrmRoute(url)
  else if (url.includes('open-meteo')) body = openMeteo(url)
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

async function pickMode(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole('button', { name }))
}

async function searchAndPick(user: ReturnType<typeof userEvent.setup>, label: string, text: string, result: string) {
  await user.type(screen.getByLabelText(label), `${text}{Enter}`)
  await user.click(await screen.findByRole('button', { name: new RegExp(result) }, { timeout: 3000 }))
}

describe('App', () => {
  test('flujo completo: buscar, recomendar, mover la hora sin volver a pedir la ruta e invertir', async () => {
    const user = userEvent.setup()
    render(<App />)
    await pickMode(user, /^Micro$/)
    expect(screen.getByRole('heading', { name: '¿A dónde vas?' })).toBeInTheDocument()

    setDateTime('2026-11-24', '18:00')
    await searchAndPick(user, 'Desde', 'plaza de armas', 'Plaza de Armas')
    await searchAndPick(user, 'Hasta', 'destino sur', 'Destino Sur')

    expect(await screen.findByRole('heading', { name: /Siéntate al lado del chofer/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /pega en el lado puerta. Tu asiento: lado chofer, a la sombra/ })).toBeInTheDocument()
    expect(screen.getByText('Salida 18:00')).toBeInTheDocument()
    const routeCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('/route/v1/')).length
    expect(routeCalls()).toBe(1)

    // Mediodía de verano: el sol está muy alto. Recalcula sin pedir otra ruta.
    setDateTime('2026-12-21', '13:40')
    expect(await screen.findByRole('heading', { name: 'Da lo mismo' })).toBeInTheDocument()
    expect(screen.getByText(/El sol va casi encima de la micro/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /El sol va casi encima de la micro./ })).toBeInTheDocument()
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
    await pickMode(user, /^Micro$/)
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
    await pickMode(user, /^Micro$/)
    await user.click(screen.getByRole('button', { name: /Mi ubicación/ }))
    expect(await screen.findByText(/No tengo permiso para ver tu ubicación/)).toBeInTheDocument()
  })

  test('marcar en el mapa, guardar la ruta y volver a cargarla', async () => {
    const user = userEvent.setup()
    render(<App />)
    await pickMode(user, /^Micro$/)
    // Tocar el mapa: primero marca desde y pasa solo a hasta.
    await user.click(screen.getByRole('button', { name: 'mapa simulado' }))
    expect(screen.getByRole('button', { name: 'Hasta', pressed: true })).toBeInTheDocument()
    await searchAndPick(user, 'Hasta', 'destino sur', 'Destino Sur')

    setDateTime('2026-11-24', '18:00')
    await user.type(screen.getByLabelText('Guardar esta ruta'), 'A la pega')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    const fav = screen.getByRole('button', { name: /^A la pega/ })
    expect(within(fav).getByText(/Micro · salida 18:00 · Punto en el mapa .* → Destino Sur/)).toBeInTheDocument()

    // Cargarla vuelve a poner la hora guardada.
    fireEvent.change(screen.getByLabelText('Salida'), { target: { value: '07:00' } })
    await user.click(fav)
    expect(screen.getByLabelText('Salida')).toHaveValue('18:00')

    await user.click(screen.getByRole('button', { name: 'Borrar A la pega' }))
    await waitFor(() => expect(screen.queryByText('A la pega')).not.toBeInTheDocument())
  }, 10000)
})

describe('App: modos, UV y mapa', () => {
  test('abre directo, sin pantalla previa, en el último modo usado', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    expect(screen.queryByRole('heading', { name: /Cómo vas a viajar/ })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'mapa simulado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Micro', pressed: true })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bicicleta' }))
    unmount()

    render(<App />)
    expect(screen.getByRole('button', { name: 'Bicicleta', pressed: true })).toBeInTheDocument()
  })

  test('si ya diste permiso de ubicación, parte desde donde estás', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      onLine: true,
      permissions: { query: () => Promise.resolve({ state: 'granted' }) },
      geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: -33.44, longitude: -70.65 } } as GeolocationPosition) },
    })
    render(<App />)
    await waitFor(() => expect(screen.getByLabelText('Desde')).toHaveValue('Mi ubicación'))
  })

  test('sin permiso previo no pregunta por la ubicación al abrir', async () => {
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, onLine: true, permissions: { query: () => Promise.resolve({ state: 'prompt' }) }, geolocation: { getCurrentPosition } })
    render(<App />)
    await screen.findByRole('button', { name: 'mapa simulado' })
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  test('a pie: pide la ruta peatonal y recomienda la vereda con sombra', async () => {
    const user = userEvent.setup()
    render(<App />)
    await pickMode(user, /^Caminando$/)
    setDateTime('2026-11-24', '18:00')
    await searchAndPick(user, 'Desde', 'plaza de armas', 'Plaza de Armas')
    await searchAndPick(user, 'Hasta', 'destino sur', 'Destino Sur')

    // Hacia el sur a las 18:00 el sol viene del poniente = a la derecha.
    expect(await screen.findByRole('heading', { name: /Camina por la vereda de la derecha/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /La vereda de la derecha queda a la sombra/ })).toBeInTheDocument()
    const routeUrls = fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/route/v1/'))
    expect(routeUrls.at(-1)).toContain('routing.openstreetmap.de/routed-foot')
  })

  test('cambiar de modo vuelve a pedir la ruta con el perfil nuevo', async () => {
    const user = userEvent.setup()
    render(<App />)
    await pickMode(user, /^Micro$/)
    await searchAndPick(user, 'Desde', 'plaza de armas', 'Plaza de Armas')
    await searchAndPick(user, 'Hasta', 'destino sur', 'Destino Sur')
    await screen.findByRole('heading', { name: /Siéntate|parejo|Da lo mismo/ }, { timeout: 3000 })
    await user.click(screen.getByRole('button', { name: /Bicicleta/ }))
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('routed-bike/route/v1/'))).toBe(true),
    )
  }, 10000)

  test('muestra el índice UV del pronóstico y lo que podría haber con cielo despejado', async () => {
    const user = userEvent.setup()
    render(<App />)
    await pickMode(user, /^Caminando$/)
    setDateTime('2026-11-24', '15:00')
    const uv = await screen.findByRole('region', { name: 'Rayos UV' })
    await within(uv).findByText(/Pronóstico por hora de Open-Meteo/)
    expect(uv).toHaveTextContent('Índice UV 5')
    expect(uv).toHaveTextContent('Moderado')
    expect(uv).toHaveTextContent('podría llegar a 7')
  })

  test('el botón del mapa cambia entre claro y oscuro y lo recuerda', async () => {
    const user = userEvent.setup()
    render(<App />)
    await pickMode(user, /^Micro$/)
    const toggle = screen.getByRole('button', { name: 'Mapa oscuro' })
    const before = toggle.getAttribute('aria-pressed')
    await user.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).not.toBe(before)
    expect(localStorage.getItem('lado-sombra:mapa')).toBe(before === 'true' ? 'claro' : 'oscuro')
  })
})
