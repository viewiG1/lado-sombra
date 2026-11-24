import { Component, type ReactNode } from 'react'

/** Si el mapa no puede funcionar (sin WebGL, sin conexión al cargarlo), el resto de la app sigue. */
export class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid h-full place-items-center bg-card p-6 text-center text-mute">
        <p>
          Este navegador no pudo mostrar el mapa.
          <br />
          Igual puedes buscar las direcciones y ver la recomendación.
        </p>
      </div>
    )
  }
}
