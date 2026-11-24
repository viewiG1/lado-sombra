/** La ruta es la de un auto: el tiempo de cada tramo se multiplica por esto para aproximar una micro. */
export const BUS_TIME_FACTOR = 1.5

/** Largo de los tramos en que se divide la ruta para calcular el rumbo. */
export const PIECE_LENGTH_M = 50

/** Si la diferencia entre lados es ≤ esta fracción del viaje, "Está parejo". */
export const EVEN_THRESHOLD = 0.1

/** Deslizador de hora, en minutos desde medianoche. */
export const SLIDER = { min: 5 * 60, max: 22 * 60, step: 5 } as const

export const OSRM_URL = 'https://router.project-osrm.org'
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'

/** Centro inicial del mapa: Santiago. */
export const DEFAULT_VIEW = { longitude: -70.65, latitude: -33.45, zoom: 11 } as const
