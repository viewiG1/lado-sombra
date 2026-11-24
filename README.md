# Lado Sombra

¿De qué lado me siento en la micro? Lado Sombra traza tu ruta y, según la hora, te dice de qué lado de la micro va a pegar el sol, para que te sientes a la sombra.

Pensada para Chile: el chofer va a la izquierda y la puerta a la derecha.

## Requisitos

- [Node.js](https://nodejs.org/) 20 o más nuevo (probado con Node 24)
- npm (viene con Node)

## Instalar

```bash
npm install
```

## Correr en el computador

```bash
npm run dev
```

Abre <http://localhost:5173>.

## Probar

```bash
npm test             # corre todas las pruebas una vez
npm run test:watch   # las vuelve a correr al guardar
npm run typecheck    # revisa los tipos de TypeScript
npm run lint         # revisa el estilo del código
```

## Probar en el teléfono (misma red wifi)

El navegador del teléfono **solo entrega tu ubicación (botón "Mi ubicación") y solo deja instalar la app si se abre con https**. Por eso hay un modo con un certificado de prueba:

1. Conecta el computador y el teléfono a la misma red wifi.
2. En el computador, corre:

   ```bash
   npm run dev:https
   ```

3. La terminal muestra una dirección `Network`, por ejemplo `https://192.168.1.93:5173/`. Ábrela en el teléfono.
4. El teléfono va a advertir que la conexión "no es privada" porque el certificado es de prueba. Toca **Configuración avanzada → Continuar** (Chrome) o **Mostrar detalles → visitar este sitio** (Safari). Es normal y solo pasa en esta red.
5. Si la página no abre, revisa que el firewall de Windows permita a Node.js recibir conexiones en redes privadas.

Si no necesitas el GPS, `npm run dev:host` abre la app por http sin advertencias (la app avisará que la ubicación necesita https).

Para probar la versión compilada (la que se publica, con modo sin conexión):

```bash
npm run build
npm run preview
```

## Publicar en Netlify

El proyecto ya trae `netlify.toml` (comando de compilación, carpeta `dist` y encabezados).

**Opción A: desde GitHub (recomendada, se publica sola con cada cambio)**

1. Sube el repositorio a GitHub.
2. En [app.netlify.com](https://app.netlify.com) elige **Add new site → Import an existing project** y selecciona el repositorio.
3. Netlify lee la configuración de `netlify.toml`; solo confirma con **Deploy**.

**Opción B: desde la terminal**

```bash
npx netlify-cli login
npx netlify-cli deploy --build          # versión de prueba con su propia URL
npx netlify-cli deploy --build --prod   # versión pública
```

Una vez publicada, abre la URL en el teléfono y elige **Agregar a pantalla de inicio** (o **Instalar app**).

## Cómo funciona

1. Buscas origen y destino (Nominatim, solo en Chile y solo al presionar Enter o salir del campo, con una petición por segundo como máximo), usas "Mi ubicación" o tocas el mapa.
2. OSRM entrega la ruta de un auto con la duración de cada segmento. Ese tiempo se multiplica por **1,5** para aproximar una micro (`BUS_TIME_FACTOR` en `src/config.ts`).
3. La ruta se divide en tramos de unos 50 m. Para cada uno se calcula el rumbo y la posición del sol (SunCalc) en el momento y lugar en que pasaría la micro.
4. Ángulo relativo = (azimut del sol − rumbo + 360) % 360:
   - sol bajo el horizonte o con elevación ≥ 65° → sin sol de lado
   - de frente (< 20° o > 340°) o por atrás (entre 160° y 200°) → sin sol de lado
   - 20° a 160° → sol en el lado puerta (derecha)
   - 200° a 340° → sol en el lado chofer (izquierda)
5. Se suman los minutos de cada lado y se recomienda el lado contrario al que recibe más sol. Si la diferencia es ≤ 10 % del viaje: "Está parejo". Sin sol de lado: "Da lo mismo".

Mover la hora vuelve a calcular al instante sin pedir de nuevo la ruta.

## Estructura

```
src/
  config.ts             factor micro, largo de tramos, URLs de servicios
  lib/                  lógica pura con pruebas: time, geo, sun, analyze, favoritos, textos
  services/             http (tiempo máximo y errores), routing (OSRM), geocoding (Nominatim)
  hooks/                useRoute, useGeolocation, useFavorites, preferencias del sistema
  components/           MapView, SearchBox, TimeControls, VerdictCard, BusDiagram, Favorites
```

Para cambiar de proveedor de rutas, implementa la interfaz `RoutingProvider` de `src/services/routing.ts`.

## Claves y configuración

No se usa ninguna clave de API. Si en el futuro se necesita alguna, va en un archivo `.env` (ya está en `.gitignore`) con el prefijo `VITE_`, y se lee con `import.meta.env.VITE_...`.

## Créditos

- Mapa: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), teselas de [OpenFreeMap](https://openfreemap.org/) y OpenMapTiles.
- Rutas: [OSRM](https://project-osrm.org/) (servidor de demostración: pensado para uso liviano).
- Búsqueda: [Nominatim](https://nominatim.org/) ([política de uso](https://operations.osmfoundation.org/policies/nominatim/)).
- Posición del sol: [SunCalc](https://github.com/mourner/suncalc).
