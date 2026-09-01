# App Móvil — Rondas de Guardias Municipales

App móvil para el **Guardia Municipal** (uso en campo durante su turno).
Dirección de Seguridad Ciudadana · G.A.M. Cochabamba.

> **Fase actual: integración de hardware real.** La navegación y las pantallas usan
> datos mock para el historial y el backend (`src/api` deja los stubs listos para
> conectar a **Node.js + PostgreSQL**), pero **GPS, cámara y mapa ya son reales**
> (`expo-location`, `expo-camera`, `react-native-maps`).

## Stack

| Área | Tecnología |
|------|-----------|
| App móvil | React Native 0.81 (Expo SDK 54) + TypeScript |
| Navegación | React Navigation (native-stack + bottom-tabs) |
| Íconos | `@expo/vector-icons` (Ionicons) |
| GPS | `expo-location` (permisos, ubicación puntual y seguimiento en vivo) |
| Cámara | `expo-camera` (selfie de inicio de turno + evidencia foto/video) |
| Mapa | OpenStreetMap (Leaflet) dentro de un WebView (`react-native-webview`) — **sin costo, sin API key** |
| Backend (siguiente fase) | Node.js (Express/NestJS) + PostgreSQL |

## Cómo correr

```bash
npm install
npm start          # abre Expo; escanear QR con Expo Go (Android)
# o
npm run android
```

En el login, **cualquier usuario y contraseña** ingresan (fase estática).

## Estructura

```
src/
├── api/          Stubs del backend (devuelven mocks con retardo simulado)
├── components/   UI reutilizable (Button, Card, TextField, RiskBadge, MapPlaceholder…)
├── context/      AuthContext (sesión) · ShiftContext (turno en curso)
├── mocks/        Datos de ejemplo (guardia, turnos, incidentes, mandados)
├── navigation/   RootNavigator → AuthNavigator | AppNavigator (+ TabsNavigator)
├── screens/
│   ├── auth/     Splash · Login · RecuperarContraseña
│   ├── home/     Inicio (estado del turno: en servicio / fuera de servicio)
│   ├── service/  IniciarServicio (cámara + confirmación) · CerrarServicio · TurnoFinalizado
│   ├── incidents/ RegistrarIncidente · Éxito · DetalleIncidente
│   ├── errands/  RegistrarMandado · Éxito
│   ├── map/      Mapa de la ronda
│   ├── history/  Historial (turnos / incidentes / mandados) · DetalleTurno
│   └── profile/  Perfil / Ajustes
├── theme/        Paleta institucional, tipografía, espaciado
├── types/        Modelo de datos (espeja las entidades de los requerimientos)
└── utils/        Formato de fecha/hora/distancia · helpers de geolocalización (mock)
```

## Mapa de pantallas ↔ requerimientos

| Pantalla | RF |
|----------|-----|
| Login | RF-APP-01 |
| Recuperar contraseña | RF-APP-02 |
| Iniciar servicio (cámara + confirmación) | RF-APP-03 |
| Inicio / estado del turno | RF-APP-04 |
| (Captura periódica de GPS — pendiente librería nativa) | RF-APP-05 |
| Registrar mandado | RF-APP-06 |
| Cerrar servicio + resumen | RF-APP-07 |
| Registrar incidente | RF-APP-08 |
| Historial (turnos / incidentes / mandados) | RF-APP-09 |
| Mapa de la ronda | RF-APP-10 |
| Sincronización (Perfil) — modo offline a evaluar | RF-APP-11 |

## Flujo principal

Splash → Login → **Inicio (Fuera de servicio)** → Iniciar Servicio → Cámara (foto) →
Confirmación (GPS + hora automáticos) → **Inicio (En servicio)** → durante el turno:
Registrar Incidente / Registrar Mandado / Ver Mapa → Cerrar Servicio → Resumen
(duración, distancia, incidentes, mandados) → Turno Finalizado → **Inicio (Fuera de servicio)**.

## Pendientes (según requerimientos 3.4)

- Formulario definitivo de "Registrar Incidente" y catálogo de tipos de hecho (confirmar con el cliente).
- Ajustar intervalo de captura de GPS en segundo plano (hoy: primer plano, cada 15s / 25m).
- GPS en segundo plano real (app cerrada/minimizada) — requiere `expo-location` background permission + dev client, no funciona en Expo Go.
- Alcance del modo offline (RF-APP-11): guardar hechos/mandados localmente si no hay señal y sincronizar después.
- Conexión con el backend real (implementar `src/api/client.ts`).
- Botón SOS con envío de ubicación en vivo (RF-APP-11 de requerimientos del Grupo 3).
- Imagen del escudo institucional (ver `assets/LEEME.md`).

## Notas sobre GPS, cámara y mapa (nuevo)

- **GPS** (`src/utils/location.ts`): pide permiso de ubicación en primer plano; si es denegado,
  se lanza `UbicacionDenegadaError` y la pantalla lo muestra con un botón "Reintentar". En
  desarrollo (`__DEV__`), si el dispositivo/emulador no reporta posición, se usa una ubicación
  simulada para no bloquear las pruebas.
- **Seguimiento en vivo** (`ShiftContext`): al iniciar un turno se activa `watchPositionAsync`
  (cada 15s o 25m de desplazamiento); cada punto se agrega al recorrido y la distancia total se
  calcula con la fórmula de Haversine (`utils/geo.ts`), reemplazando el valor aleatorio anterior.
- **Cámara**: `StartServiceCameraScreen` usa la cámara frontal para la selfie de verificación;
  `EvidenceCameraScreen` (compartida) captura foto o video de evidencia para incidentes y
  regresa el/los URI(s) a `RegisterIncidentScreen` vía parámetros de navegación.
- **Mapa**: se usa **OpenStreetMap** en vez de Google Maps para evitar costos de facturación.
  `src/components/OsmMapView.tsx` renderiza un mapa Leaflet dentro de un `WebView`
  (`react-native-webview`), cargando los tiles públicos de `tile.openstreetmap.org`. No
  requiere API key ni SDK nativo de mapas, y funciona igual en Expo Go. `MapScreen` lo
  alimenta con la ubicación en vivo, el recorrido del turno (polyline) y los incidentes
  (marcadores), actualizándolos con `injectJavaScript` para no recargar el mapa completo
  en cada movimiento. Nota: al ser tiles públicos de OSM, para un uso en producción con
  mucho tráfico se recomienda revisar su [política de uso](https://operations.osmfoundation.org/policies/tiles/)
  o contratar un proveedor de tiles OSM (ej. MapTiler, Stadia Maps), que igual seguiría
  siendo mucho más económico que Google Maps.
