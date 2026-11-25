import type { TravelMode } from '../lib/modes'

/** Créditos de mapas y servicios, y la aclaración de cómo se calcula según el modo. */
export function Credits({ mode }: { mode: TravelMode }) {
  return (
    <footer className="text-[13px] text-mute">
      <p>
        Mapa: ©{' '}
        <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          colaboradores de OpenStreetMap
        </a>{' '}
        y OpenFreeMap. Rutas:{' '}
        <a className="underline" href="https://project-osrm.org/" target="_blank" rel="noreferrer">
          OSRM
        </a>{' '}
        (bici y a pie:{' '}
        <a className="underline" href="https://routing.openstreetmap.de/" target="_blank" rel="noreferrer">
          FOSSGIS
        </a>
        ). Búsqueda:{' '}
        <a className="underline" href="https://nominatim.org/" target="_blank" rel="noreferrer">
          Nominatim
        </a>
        . UV:{' '}
        <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>{' '}
        (CC BY 4.0).
      </p>
      <p className="mt-2">
        {mode === 'micro'
          ? 'La ruta es la de un auto y el tiempo se ajusta a velocidad de micro (×1,5). Los recorridos reales de las micros vienen en una próxima versión. «Lado chofer» = izquierdo; «lado puerta» = derecho.'
          : 'La sombra de las veredas es una aproximación: supone edificios a los dos lados de la calle. Árboles, toldos y la altura real de los edificios pueden cambiarla.'}
      </p>
    </footer>
  )
}
