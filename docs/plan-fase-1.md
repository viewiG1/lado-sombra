# Lado Sombra — Diseño y plan de la fase 1

Estado: **borrador, esperando aprobación**. No se escribe código hasta que se apruebe.

## 1. Lo que sacamos del prototipo (y lo que cambia)

Se mantiene:
- Textos, tono, colores (`--red #d7262e`, `--blue #2160c4` / `#5b95f0` en oscuro, `--sun #ffb800`, gris), tipografía Barlow + Barlow Condensed.
- Regla de clasificación por ángulo relativo, recomendación "lado contrario al que recibe más sol", umbral de 10 % para "Está parejo".
- Micro SVG vista desde arriba con sol que gira (ángulo relativo promedio ponderado del lado dominante), costado iluminado y asiento "TÚ".
- Modo de "tocar el mapa" con selector *marcar desde / marcar hasta*.

Se corrige o mejora:
| Prototipo | Fase 1 |
|---|---|
| Tiempo de cada tramo proporcional a la distancia | Usa la duración por tramo que entrega OSRM (`annotations=duration`) × 1,5: las calles lentas pesan más. Si falta, cae a proporcional por distancia. |
| Clasifica cada segmento crudo del polígono (en esquinas y rotondas salen rumbos erráticos) | Remuestrea la ruta en tramos de ~50 m y calcula el rumbo de cada tramo completo. |
| Algoritmo solar escrito a mano | SunCalc. |
| Umbral "parejo" con minutos redondeados | Con minutos sin redondear; se redondea solo para mostrar. |
| En el teléfono el mapa queda abajo de un panel largo | Ver decisión B. |
| Google Fonts | Fuentes empaquetadas con `@fontsource` (funcionan sin conexión y no avisan a terceros). |
| Sin control de concurrencia | `AbortController`: una ruta o búsqueda nueva cancela la anterior. Se cachean las búsquedas de Nominatim en memoria. |

## 2. Reglas de cálculo (quedan fijadas en código y pruebas)

- Rumbo: 0° = norte, sentido horario. Azimut solar convertido a la misma convención (SunCalc lo da desde el sur, en radianes).
- `rel = (azSol − rumbo + 360) % 360`.
- `sin sol de lado` si elevación ≤ 0°, elevación ≥ 65°, `rel < 20`, `rel > 340` o `160 < rel < 200`.
- `puerta` (derecha) si `20 ≤ rel ≤ 160`; `chofer` (izquierda) si `200 ≤ rel ≤ 340`. (Bordes iguales que el prototipo.)
- La hora del sol de cada tramo es la de salida + el tiempo acumulado hasta la mitad del tramo; la posición, la del punto medio del tramo.
- Veredicto: sin minutos de sol de lado → "Da lo mismo"; `|chofer − puerta| ≤ 10 % del viaje` → "Está parejo"; si no, sentarse en el lado contrario al que suma más.
- Factor micro = 1,5 en una constante de configuración (`BUS_TIME_FACTOR`).
- Hora: el usuario escribe fecha y hora de Chile; `lib/time.ts` lo pasa a UTC con `Intl` y `America/Santiago` (sigue el horario de verano/invierno sin tablas propias). Hay pruebas para un día de verano, uno de invierno y los días de cambio de hora.

## 3. Arquitectura

```
src/
  config.ts             factor micro, tramo de 50 m, URLs de servicios, límites del deslizador
  lib/time.ts           hora Chile ↔ UTC, "ahora" en Chile
  lib/geo.ts            rumbo, distancia, remuestreo en tramos
  lib/sun.ts            SunCalc → {azimut, elevación}; classifySide()
  lib/analyze.ts        (ruta, salida) → tramos clasificados, minutos por lado, veredicto
  lib/errors.ts         AppError con tipos: sin-conexion, sin-permiso-gps, no-encontrado, sin-ruta, servicio
  services/routing.ts   interfaz RoutingProvider + OsrmProvider
  services/geocoding.ts Nominatim (Chile, es) + cola de 1 petición/segundo + caché
  hooks/                useRoute, useGeolocation, useFavorites, usePrefersDark
  components/           Map, SearchBox, TimeControls, VerdictCard, BusDiagram, SunMeters, Legend, Favorites, Attribution
  App.tsx
```

- La ruta se pide **una sola vez** por par origen/destino; cambiar la hora o la fecha solo vuelve a correr `analyze` (puro y rápido), por eso el deslizador responde al instante.
- `RoutingProvider.route(from, to, signal) → { coords, segmentDurations, durationS, distanceM }`. Cambiar de proveedor = otra implementación de la interfaz.
- Nominatim: se busca solo con Enter o al salir del campo (y no se repite si el texto no cambió). Una cola global asegura ≥ 1 s entre peticiones. `countrycodes=cl`, `accept-language=es`.
- Favoritos en `localStorage` con versión y validación al leer (los datos corruptos se descartan sin romper la app). Guardan nombre, origen, destino y hora; al cargarlos se usa la fecha de hoy.
- El mapa dibuja la ruta como una capa GeoJSON con un color según la propiedad `side`, con colores distintos para claro y oscuro.

## 4. Pruebas (Vitest)

Lógica pura, con TDD:
- `time`: verano (UTC−3), invierno (UTC−4), días de cambio de hora, "ahora" en Chile.
- `geo`: rumbo N/S/E/O, distancia conocida, el remuestreo conserva el largo total y produce tramos de ≤ 50 m.
- `sun`: los 4 cuadrantes de `classifySide`, bordes 20/160/200/340, elevación 65 y bajo el horizonte.
- `analyze` (con rutas rectas sintéticas en Santiago, sin red):
  - 24 nov, 18:00, hacia el sur → sol lado puerta → "lado chofer".
  - Mismo día y hora, hacia el norte → sol lado chofer → "lado de la puerta".
  - Mediodía de verano → todo "sin sol de lado".
  - De noche → "Da lo mismo".
  - Caso "Está parejo" y uso de la duración por tramo.

Servicios y hooks, con `fetch` simulado: respuesta de OSRM → ruta; `NoRoute` → error sin-ruta; sin conexión; Nominatim vacío → no-encontrado; la cola respeta 1 petición/segundo (con temporizadores falsos); favoritos corruptos en `localStorage`.

## 5. Etapas (un commit o más por etapa, con revisión antes de cerrar)

0. **Base**: Vite + React + TS estricto, Tailwind v4, Vitest, ESLint de la plantilla, `.gitignore` (con `.env`), `netlify.toml`.
1. **Lógica pura** (TDD): time → geo → sun → analyze.
2. **Servicios**: errores, routing OSRM, geocoding Nominatim.
3. **Hooks**: geolocalización, ruta, favoritos.
4. **Interfaz**: estructura y mapa → búsqueda/origen/destino → hora → tarjeta del veredicto + micro → favoritos → errores, carga, atribución. Crítica y pulido de diseño al terminar la pantalla.
5. **PWA**: vite-plugin-pwa, íconos, manifiesto, caché (la app sí; las respuestas de OSRM y Nominatim no; las teselas del mapa con un límite).
6. **Cierre**: auditoría de accesibilidad y rendimiento y sus arreglos, README, revisión final del código.

## 6. Avisos que conviene saber desde ya

- **GPS en el teléfono por wifi**: el navegador solo entrega la ubicación (y solo instala la PWA) en HTTPS. Con `http://192.168.x.x:5173` el botón "Mi ubicación" va a fallar. Propongo un `npm run dev:https` con certificado autofirmado (el teléfono muestra una advertencia que se acepta una vez); la alternativa es probar en la URL de Netlify.
- **Servidores públicos**: el OSRM de demostración y Nominatim son gratis pero son para uso liviano. Para un piloto alcanza; si la app crece hay que pasar a un proveedor propio o pagado (ya queda la interfaz lista).
- **Publicar en Netlify** es una acción pública: dejo todo configurado y documentado, pero no publico sin que me lo pidas.

## 7. Decisiones para ti (con mi recomendación)

**A. Fuente del mapa.** MapLibre funciona mejor con teselas vectoriales.
- *Recomendado:* **OpenFreeMap** (datos de OpenStreetMap, sin clave, sin límite de uso, estilos claro y oscuro bien hechos).
- Alternativa: teselas raster de `tile.openstreetmap.org` (lo del prototipo; su política de uso desaconseja apps publicadas con tráfico, y el modo oscuro queda como un filtro invertido).

**B. Distribución en el teléfono (360 px).**
- *Recomendado:* mapa arriba (~40 % de la altura) y el panel abajo con desplazamiento, con la tarjeta del veredicto justo después de los campos desde/hasta. En pantallas anchas, dos columnas como en el prototipo.
- Alternativa: mapa a pantalla completa con un panel deslizable desde abajo (estilo Google Maps). Se ve más "app", pero es más complejo y más difícil de hacer accesible.

**C. Componente de mapa.**
- *Recomendado:* `react-map-gl` (versión MapLibre): menos código y bien mantenido.
- Alternativa: MapLibre directo con un hook propio.

**D. HTTPS en desarrollo para probar el GPS en el teléfono** (ver punto 6).
- *Recomendado:* sí, agregar `npm run dev:https`.
