# Manual Técnico — App Móvil Rondas Guardia Municipal

**Dirección de Seguridad Ciudadana · Gobierno Autónomo Municipal de Cochabamba**
Módulo: Registro y Control de Guardias Municipales — componente **app móvil**
(el panel web y el backend viven en repositorios aparte; ver [§10](#10-integración-con-el-resto-del-sistema)).

---

## Índice

1. [Resumen y alcance](#1-resumen-y-alcance)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura general](#3-arquitectura-general)
4. [Estructura del proyecto](#4-estructura-del-proyecto)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Autenticación y sesión](#6-autenticación-y-sesión)
7. [Flujo de turno (ShiftContext)](#7-flujo-de-turno-shiftcontext)
8. [Geolocalización](#8-geolocalización)
9. [Evidencias (cámara y Supabase Storage)](#9-evidencias-cámara-y-supabase-storage)
10. [Integración con el resto del sistema](#10-integración-con-el-resto-del-sistema)
11. [Navegación y pantallas](#11-navegación-y-pantallas)
12. [Modo offline](#12-modo-offline)
13. [Dimensionamiento de infraestructura](#13-dimensionamiento-de-infraestructura)
14. [Configuración y variables de entorno](#14-configuración-y-variables-de-entorno)
15. [Cómo correr el proyecto](#15-cómo-correr-el-proyecto)
16. [Build y despliegue (EAS)](#16-build-y-despliegue-eas)
17. [Permisos nativos](#17-permisos-nativos)
18. [Mapa de pantallas ↔ requerimientos funcionales](#18-mapa-de-pantallas--requerimientos-funcionales)
19. [Referencia de endpoints consumidos](#19-referencia-de-endpoints-consumidos)
20. [Glosario](#20-glosario)

---

## 1. Resumen y alcance

Aplicación móvil (Android/iOS, Expo + React Native) para el **guardia municipal en
campo**. Cubre todo el ciclo de un turno de patrullaje:

- Inicio de servicio con selfie de verificación + geolocalización.
- Seguimiento GPS en vivo del recorrido (primer y segundo plano).
- Registro de incidentes (hechos) con evidencia foto/video.
- Registro de mandados/tareas puntuales.
- Botón de emergencia **SOS**.
- Verificaciones periódicas de ronda (checkpoints) con foto.
- Mapa en vivo con recorrido, incidentes y zona/ruta asignada.
- Historial de turnos, incidentes y mandados.
- Cierre de servicio con resumen (duración, distancia, incidentes, mandados).
- Cola de sincronización offline para cuando falla la señal.

Es el módulo "app móvil" de un sistema más amplio de Seguridad Ciudadana que
también incluye un **panel web** de monitoreo/administración y un **backend**
compartido. Ver [§10](#10-integración-con-el-resto-del-sistema).

## 2. Stack tecnológico

| Área | Tecnología |
|------|-----------|
| Framework | React Native 0.81 + React 19, sobre **Expo SDK 54** |
| Lenguaje | TypeScript 5.9 (`tsc --noEmit` como único chequeo estático, sin ESLint configurado) |
| Navegación | React Navigation 7 (`native-stack` + `bottom-tabs`) |
| Estado global | React Context (`AuthContext`, `ShiftContext`) — sin Redux/Zustand |
| Persistencia local | `@react-native-async-storage/async-storage` |
| Red / conectividad | `@react-native-community/netinfo` |
| GPS | `expo-location` (`expo-task-manager` para tracking en segundo plano) |
| Batería | `expo-battery` (se adjunta a cada ping de ubicación/SOS) |
| Cámara | `expo-camera` |
| Biometría | `expo-local-authentication` (huella/Face ID para confirmar SOS y, opcionalmente, login) |
| Mapa | OpenStreetMap/Leaflet dentro de un `WebView` (`react-native-webview`) — **sin API key, sin costo** |
| Backend | Node.js/Express (repo aparte) sobre **PostgreSQL** |
| Base de datos / Storage / Auth edge | **Supabase** (Postgres, Storage de evidencias, Edge Function de reseteo de contraseña) |
| Hosting | Backend, DB y panel web en el servidor propio (`api.sistec-unifranz.com`). La DB/Storage ya no están en Supabase |
| Build/distribución | **EAS Build** (perfiles `development` / `preview` / `production`) |

No hay librería de manejo de formularios (los forms son `useState` simples), ni
librería de estilos (usa `StyleSheet.create` de React Native + un theme propio en
`src/theme/`). No hay push en tiempo real (`socket.io-client`): la comunicación
"en vivo" con el backend es por **polling** (ver [§10](#10-integración-con-el-resto-del-sistema)).

## 3. Arquitectura general

```
┌─────────────────────────────┐        ┌──────────────────────────┐
│   App móvil (este repo)     │        │      Panel web (Next)     │
│  Expo / React Native        │        │      (repo aparte)        │
└──────────────┬───────────────┘        └─────────────┬────────────┘
               │ REST (Bearer JWT)                     │ REST / Realtime
               ▼                                       ▼
        ┌─────────────────────────────────────────────────────┐
        │        Backend Node.js/Express  (api.sistec-unifranz.com)             │
        │  Auth, turnos, hechos, mandados, telemetría, patrullas│
        └───────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   PostgreSQL (Supabase) │
                    └────────────────────────┘

        App móvil también habla DIRECTO con Supabase para:
        - Storage (subida de fotos/video de evidencia)
        - Edge Function `guardia-password-reset` (recuperar contraseña)
```

Puntos clave de diseño:

- **La app nunca habla con Postgres directamente** salvo para Storage y la Edge
  Function de recuperación de contraseña — todo lo demás (login, turnos, hechos,
  mandados, telemetría, patrullas) pasa por la API REST del backend Express.
- **Envelope de respuesta del backend**: éxito → `{ data: ... }`, error →
  `{ error: { code, message, details? } }` (`src/api/client.ts`).
- **Sesión por JWT**: `accessToken` + `refreshToken`, ambos persistidos en
  AsyncStorage. Un 401 dispara un refresh automático con una única promesa
  compartida (evita refrescos duplicados por llamadas concurrentes).
- **Resolución automática de URL del backend**: en desarrollo (Expo Go / dev
  client con Metro) se deduce la IP LAN desde `Constants.expoConfig.hostUri`; en
  build standalone (sin Metro) cae a la URL de producción (`https://api.sistec-unifranz.com/api`). Se puede
  forzar con `EXPO_PUBLIC_API_URL`.

## 4. Estructura del proyecto

```
src/
├── api/          Capa HTTP real contra el backend (auth, turnos, incidentes,
│                 mandados, sos, patrullas, checkpoints, client)
├── components/   UI reutilizable (Button, Card, TextField, RiskBadge,
│                 OsmMapView, SosButton, CheckpointBanner, RouteChangeWatcher…)
├── context/      AuthContext (sesión) · ShiftContext (turno en curso, GPS,
│                 checkpoints, SOS, cola offline)
├── hooks/        useUbicacionActual, useRelojEnVivo
├── mocks/        Datos de ejemplo (quedan como fallback/semilla visual,
│                 la app ya no depende de ellos para operar)
├── navigation/   RootNavigator → AuthNavigator | AppNavigator (+ TabsNavigator)
├── screens/
│   ├── auth/      Splash · Login · RecuperarContraseña
│   ├── home/      Inicio (estado del turno)
│   ├── service/   IniciarServicio (cámara + confirmación) · CerrarServicio ·
│   │              TurnoFinalizado · CheckpointCamera
│   ├── incidents/ RegistrarIncidente · EvidenceCamera · Éxito · DetalleIncidente
│   ├── errands/   RegistrarMandado (tarea) · Éxito
│   ├── map/       Mapa de la ronda
│   ├── history/   Historial (turnos/incidentes/mandados) · DetalleTurno
│   └── profile/   Perfil / Ajustes
├── theme/        Paleta institucional, tipografía, espaciado
├── types/        Modelo de datos (espeja las entidades del backend)
└── utils/        location (GPS), backgroundLocationTask (GPS en segundo
                  plano), geo (Haversine), storage (subida a Supabase),
                  offlineQueue, biometria, format
```

Alias de importación: `@/*` → `src/*` (configurado en `babel.config.js` /
`tsconfig.json`), por ejemplo `import { useShift } from '@/context/ShiftContext'`.

## 5. Modelo de datos

Definido en `src/types/index.ts`, espeja las entidades del backend/DB
(`BD_UNIFICADA.md`, esquema completo en Supabase/Postgres).

### Entidades principales (lado app)

| Tipo TS | Tabla backend | Notas |
|---|---|---|
| `Guardia` | `guardia` | Perfil del guardia autenticado; `estadoOperativo` (`fuera_de_servicio` / `en_servicio` / `emergencia`) lo controla el backend |
| `Turno` | `turno` | Un turno abierto por guardia a la vez (`ux_turno_abierto_por_guardia` en DB) |
| `GeoPoint` | — (fila de `guardia_telemetria`) | `{ latitud, longitud, timestamp }` |
| `Incidente` | `hecho` + `hecho_evidencia` | `tipo` viene de `tipo_hecho` (catálogo administrado desde la web) |
| `Mandado` | `mandado` | Tarea/comisión puntual durante el turno |
| `Checkpoint` | *(no persiste en backend aún)* | Verificación periódica de identidad/ubicación — ver nota en `src/api/checkpoints.ts` |

### Enums relevantes

- `RiskLevel`: `bajo` · `medio` · `alto` · `muy_alto`
- `ShiftStatus` (app): `fuera_de_servicio` · `en_servicio` · `finalizado`
- `turno_estado` (DB): `en_servicio` · `finalizado` · `anulado`
- `IncidentType` (app, valores base): `robo` · `asalto` · `violencia` · `accidente`
  · `disturbio` · `otro` — el catálogo real y ampliable vive en `tipo_hecho`
  (`GET /hechos/tipos`, ver `listarTiposHecho`).

### Esquema de base de datos (Supabase/Postgres)

El script completo de creación está en `BD_UNIFICADA.md` (raíz del repo) y
cubre: catálogos (`epi`, `role`, `role_permission`, `tipo_hecho`), usuarios
(`user`, `guardia`, `password_reset`, `refresh_token`), patrullaje
(`ruta_plantilla`, `patrulla`), operación en campo (`turno`,
`guardia_telemetria`, `hecho`, `hecho_evidencia`, `mandado`) y derivados/auditoría
(`zona_critica_activa`, `audit_log`). Incluye funciones (`fn_haversine_m`,
`fn_turno_distancia`) y vistas (`v_guardia_ubicacion_actual`, `v_sos_pendiente`,
`v_patrulla_vigente`) que usa el backend/panel web.

> La app móvil **no ejecuta SQL ni conoce el esquema directamente** — solo
> consume la API REST del backend. Esta sección documenta el contrato de datos
> para entender de dónde vienen los campos que la app mapea en `src/api/*.ts`.

## 6. Autenticación y sesión

**Archivos clave:** `src/context/AuthContext.tsx`, `src/api/auth.ts`,
`src/api/client.ts`.

- **Login** (`POST /mobile/auth/login`): usuario + contraseña → `{ accessToken,
  refreshToken, guardia }`. Ambos tokens se guardan en AsyncStorage
  (`gamc:accessToken` / `gamc:refreshToken`).
- **Activación de cuenta** (`POST /mobile/auth/activar`): primer acceso del
  guardia; fija la contraseña usando el token de activación que le entrega la
  web (`activacion_token` en la tabla `guardia`).
- **Rehidratación al abrir la app**: si hay `accessToken` guardado, se llama a
  `GET /mobile/auth/me`; si responde bien, se entra directo sin mostrar login.
  Mientras esto corre, `RootNavigator` no monta ningún navegador (`booting`)
  para evitar el parpadeo Login → App.
- **Refresh automático**: cualquier 401 dispara `POST /mobile/auth/refresh` con
  el `refreshToken`; si funciona, reintenta la petición original una vez; si
  falla, limpia tokens y lanza `SesionExpiradaError` (vuelve a Login).
- **Logout**: `POST /mobile/auth/logout` (best-effort) + limpieza local de
  tokens, siempre, aunque el request falle.
- **Recuperar contraseña**: el backend Express **no tiene** endpoint de
  recuperación y `guardia` no tiene email. Se resuelve con la **Edge Function de
  Supabase** `guardia-password-reset`, que verifica usuario + CI + teléfono y
  cambia la contraseña en un solo paso, sin código intermedio. Es un endpoint
  público (sin JWT); la única barrera es conocer esos 3 datos, sin límite de
  intentos — aceptable en fase de pruebas, a revisar antes de producción real
  (mover a backend Express con throttling).
- **Biometría** (`src/utils/biometria.ts`): usada para confirmar el envío de
  SOS con un solo toque si el dispositivo tiene huella/Face ID enrolado
  (`expo-local-authentication`); si no hay biometría disponible, cae a un
  modal de confirmación normal.

## 7. Flujo de turno (ShiftContext)

**Archivo:** `src/context/ShiftContext.tsx` — es el contexto más grande y el
corazón operativo de la app. Expone: `turno`, `historialTurnos`, `enServicio`,
`checkpointPendiente`, `pendientesSincronizar`, `avisoRuta`, y las acciones
`iniciarServicio`, `cerrarServicio`, `agregarIncidente`, `agregarMandado`,
`dispararSos`, `registrarCheckpoint`, `sincronizarAhora`, `revisarRuta`,
`refrescarHistorial`.

### Ciclo de vida de un turno

1. **Iniciar servicio** (`RF-APP-03`): selfie con la cámara frontal →
   `obtenerUbicacionActual()` → `POST /turnos` (sube antes la selfie a Supabase
   Storage). Se envía inmediatamente un punto a `/telemetry` para que el pin
   aparezca rápido en el panel web (antes había que esperar el primer tick del
   `watchPositionAsync`, que podía tardar varios segundos).
2. **Seguimiento en vivo** (`RF-APP-05`): arranca `iniciarSeguimiento`, que
   intenta primero tracking en **segundo plano** (`backgroundLocationTask.ts`)
   y, si el permiso "Permitir siempre" no fue otorgado, degrada a tracking solo
   en **primer plano** (`watchPositionAsync`, cada 15s / 25m).
3. **Checkpoints periódicos**: cada 30 min (`CHECKPOINT_INTERVALO_MS`) se marca
   `checkpointPendiente = true`; el guardia tiene otros 30 min de gracia
   (`CHECKPOINT_GRACIA_MS`) para tomarse una foto de verificación
   (`CheckpointCameraScreen`, banner flotante `CheckpointBanner`). Si vence el
   plazo sin respuesta, se registra un checkpoint local con `estado: 'perdido'`.
4. **Registrar incidente / mandado**: obtiene ubicación actual, intenta
   `POST /hechos` o `POST /mandados`; si falla, encola en `offlineQueue`.
5. **Botón SOS**: obtiene ubicación, `POST /telemetry` con `esSos: true`. El
   backend marca `estadoOperativo = 'emergencia'` en `guardia` y aparece en
   `v_sos_pendiente` para el panel web. La app hace **polling cada 4s** a
   `/telemetry/estado` para detectar cuándo el operador lo marca como atendido
   (con un auto-timeout de 90s como red de seguridad si el backend no
   responde).
6. **Cerrar servicio** (`RF-APP-07`): ubicación de cierre →
   `PATCH /turnos/:id/cerrar`; el backend recalcula la distancia total con
   `fn_turno_distancia` (Haversine sobre `guardia_telemetria`). La app conserva
   lo acumulado localmente durante el turno como resumen inmediato.

### Aviso de cambios de ruta

`verificarRuta` hace polling a `GET /patrullas/vigente` cada 20s (y al volver
la app a primer plano) comparando una "firma" del recorrido/polígono actual
contra la anterior. Si detecta que se asignó, modificó o eliminó una ruta,
guarda un `avisoRuta` en el contexto (no en `MapScreen`) para que el aviso
llegue sin importar en qué pestaña esté el guardia; `RouteChangeWatcher`
(montado una vez en `App.tsx`) lo muestra como `Alert` nativo.

### Rehidratación de turno tras cierre de proceso

Si Android mata el proceso mientras el guardia está en servicio, al reabrir la
app `AuthContext` rehidrata la sesión pero `ShiftContext` arrancaba con
`turno = null` aunque el backend siguiera en `en_servicio`. Se corrige
buscando un turno abierto (`GET /turnos?guardia=me`) al detectar un guardia
autenticado, restaurando su recorrido real (`GET /turnos/:id/recorrido`),
incidentes y mandados, y reanudando el seguimiento GPS/checkpoints
automáticamente.

## 8. Geolocalización

**Archivos:** `src/utils/location.ts` (primer plano), `src/utils/backgroundLocationTask.ts`
(segundo plano), `src/utils/geo.ts` (Haversine + mock de desarrollo).

- **Permiso de primer plano**: obligatorio para iniciar cualquier turno. Si se
  deniega, se lanza `UbicacionDenegadaError`. Las llamadas concurrentes de
  distintas pantallas comparten una única promesa de chequeo de permiso
  (evita el bug de Android donde dos chequeos simultáneos pueden resolver
  "denegado" aunque el permiso ya esté otorgado).
- **Modo desarrollo sin GPS real**: si `__DEV__` y el dispositivo/emulador no
  reporta posición, se usa `capturarUbicacionMock()` (punto cerca de la plaza
  14 de Septiembre, Cochabamba, con jitter aleatorio) — **nunca** en producción.
- **Tracking en segundo plano** (`RF-APP-05` extendido): usa
  `Location.startLocationUpdatesAsync` + foreground service de Android (por
  eso el guardia ve una notificación persistente "Patrullaje en curso" mientras
  está de turno — requisito del sistema, no decorativo). La tarea headless
  (`TaskManager.defineTask`) no depende de que React esté montado: lee el
  turno activo de AsyncStorage, asegura el token con `cargarTokens()`, y
  manda directo a `/telemetry`, encolando si falla.
- **Cálculo de distancia**: fórmula de Haversine (`utils/geo.ts` en el
  cliente, `fn_haversine_m` en el backend/DB) — ambas coinciden en la fórmula.
- **Umbral anti-ruido**: desplazamientos menores a 10m entre lecturas
  consecutivas no se suman a la distancia ni al recorrido (deriva normal del
  GPS estando de pie).
- **Frecuencia**: ~15s/25m en primer plano, ~20s/25m en segundo plano.

## 9. Evidencias (cámara y Supabase Storage)

**Archivos:** `src/utils/storage.ts`, `src/screens/service/StartServiceCameraScreen.tsx`,
`src/screens/incidents/EvidenceCameraScreen.tsx`, `src/screens/service/CheckpointCameraScreen.tsx`.

- `StartServiceCameraScreen` usa la cámara **frontal** para la selfie de
  verificación de inicio de turno.
- `EvidenceCameraScreen` (compartida) captura foto **o** video de evidencia
  para incidentes; el/los URI(s) locales vuelven a `RegisterIncidentScreen`
  por parámetros de navegación, junto con un `borrador` del formulario para no
  perder lo ya escrito al ir a la cámara y volver.
- **Subida directa a Supabase Storage** (bucket `evidencias`, carpetas
  `selfies/`, `incidentes/`, `checkpoints/`): el backend Express no tiene
  endpoint propio de subida de archivos, así que `subirEvidencia()` sube el
  blob directo con la publishable key del proyecto y devuelve la URL pública,
  que es lo que finalmente viaja al backend (`selfieInicioUrl`,
  `evidencias[].url`).
- **Seguridad del bucket**: público solo para lectura; `INSERT` habilitado
  para `anon` pero acotado por policy a esas 3 carpetas; sin `UPDATE`/`DELETE`
  para `anon` (nadie puede pisar o borrar evidencia ajena con la key pública).

## 10. Integración con el resto del sistema

Este repo es **solo la app móvil**. El sistema completo (entregado en la
Primera Etapa, ver `ENTREGA_PRIMERA_ETAPA.md`) incluye además:

- **Panel web** de monitoreo y administración (alta de guardias, asignación de
  rutas/patrullas, seguimiento en tiempo real, atención de alertas SOS).
- **Backend Node.js/Express**, desplegado en **api.sistec-unifranz.com**, que expone la API REST
  que consume tanto la app como la web.
- **Supabase**: base de datos PostgreSQL, Storage de evidencias, y la Edge
  Function `guardia-password-reset`.

### Sin push en tiempo real

La app **no incluye `socket.io-client`** — todo lo que se entera del centro de
monitoreo (SOS atendido, ruta asignada/editada/eliminada) es por **polling**,
no por notificación push real:

| Qué se consulta | Intervalo | Dónde |
|---|---|---|
| Estado del SOS activo | 4s | `SosButton.tsx` → `/telemetry/estado` |
| Ruta/patrulla asignada | 20s (+ al volver a primer plano) | `ShiftContext.verificarRuta` → `/patrullas/vigente` |
| Sincronización de cola offline | 30s (+ al recuperar señal) | `ShiftContext.sincronizarAhora` |

Esto implica un delay mínimo (del orden del intervalo de polling) entre que
algo cambia en la web y que el guardia se entera, y viceversa. El backend ya
tiene un canal realtime propio (sala `guardia:{id}`, ver
`gamc-api/src/infrastructure/realtime.ts` en el repo del backend) que hoy solo
usa la web; agregar `socket.io-client` a la app eliminaría este delay y es la
mejora de fondo recomendada si el polling deja de sentirse "suficientemente
rápido".

### Zona/ruta asignada en el mapa

`src/api/patrullas.ts` prioriza `poligonoGeojson` (lo que realmente genera
hoy el asistente de la web al ubicar un pin — un cuadrado alrededor del
guardia) y cae a `trazado` de `ruta_plantilla` solo si en el futuro se termina
el feature de plantillas reutilizables (`POST /api/mapas/rutas` no existe aún
en el backend).

## 11. Navegación y pantallas

**Árbol de navegadores** (`src/navigation/`):

```
RootNavigator
├── (no autenticado) AuthNavigator
│   ├── Splash
│   ├── Login
│   └── ForgotPassword
└── (autenticado) AppNavigator
    ├── Tabs (TabsNavigator, con FloatingTabBar + SosButton + CheckpointBanner)
    │   ├── HomeTab
    │   ├── MapTab
    │   ├── HistoryTab
    │   └── ProfileTab
    ├── StartServiceCamera → StartServiceConfirm
    ├── CheckpointCamera
    ├── RegisterIncident → EvidenceCamera → IncidentSuccess
    ├── RegisterErrand → ErrandSuccess
    ├── CloseServiceSummary → ServiceFinished
    ├── ShiftDetail
    └── IncidentDetail
```

`RootNavigator` decide entre `AuthNavigator` y `AppNavigator` según
`isAuthenticated` (`AuthContext`), y no monta ningún navegador mientras
`booting` es `true` (rehidratación de sesión en curso).

### Flujo principal

Splash → Login → **Inicio (fuera de servicio)** → Iniciar Servicio → Cámara
(selfie) → Confirmación (GPS + hora automáticos) → **Inicio (en servicio)** →
durante el turno: Registrar Incidente / Registrar Mandado / Ver Mapa /
Checkpoints periódicos / SOS si aplica → Cerrar Servicio → Resumen (duración,
distancia, incidentes, mandados) → Turno Finalizado → **Inicio (fuera de
servicio)**.

## 12. Modo offline

**Archivo:** `src/utils/offlineQueue.ts`, integrado en `ShiftContext`.

- Cada acción con red (ubicación, incidente, mandado, checkpoint, SOS) intenta
  enviarse primero; **solo si el intento real falla** se encola
  (`enviarOEncolar`) — no se decide de antemano por lo que reporte `NetInfo`,
  porque `isInternetReachable` puede llegar `null`/impreciso en Android.
- La cola persiste en AsyncStorage (`gamc:cola_pendientes`).
- Se reintenta automáticamente: al recuperar señal (listener de `NetInfo`),
  cada 30s (poll periódico), y al abrir la app.
- Mientras hay pendientes, la UI puede mostrar el objeto "de mentira" local
  (`incidenteLocal`, `mandadoLocal`, etc., con `id: local-...`) para que el
  guardia vea su registro de inmediato aunque todavía no se haya confirmado
  con el servidor.
- **Alcance actual**: cubre incidentes, mandados, checkpoints, SOS y pings de
  ubicación. No cubre offline "de origen" para operaciones que dependen de un
  turno ya creado en el servidor (iniciar/cerrar servicio requieren
  conectividad en el momento).

## 13. Dimensionamiento de infraestructura

Estimación de la carga que genera la app móvil sobre el backend y la base de
datos, a partir de los intervalos reales de polling/tracking del código
(secciones [§7](#7-flujo-de-turno-shiftcontext), [§8](#8-geolocalización) y
[§10](#10-integración-con-el-resto-del-sistema)) para un escenario de
referencia de **~100 guardias en turno simultáneamente**. Pensada como punto
de partida para evaluar un servidor propio de la institución (independiente
de dónde corra hoy el sistema). No incluye la carga adicional del panel web
(consultas de los operadores/administradores).

### Carga de peticiones estimada (100 guardias en turno)

| Origen | Intervalo por guardia | Solicitudes/seg. estimadas (100 guardias) |
|---|---|---|
| Telemetría GPS — primer plano | ~15s | ~6.7 req/s |
| Telemetría GPS — segundo plano | ~20s | ~5 req/s |
| Verificación de ruta asignada (`/patrullas/vigente`) | 20s | ~5 req/s |
| Sincronización de cola offline (poll) | 30s | ~3.3 req/s |
| Estado de SOS (solo mientras hay una alerta activa) | 4s | ~0.25 req/s por alerta activa (normalmente 0) |

En la práctica un guardia usa **primer o segundo plano**, no ambos a la vez,
así que la carga sostenida real ronda **~15 solicitudes/segundo** con los 100
guardias trabajando en simultáneo, con picos breves cuando varios registran un
incidente/mandado o disparan un SOS a la vez. Son peticiones JSON pequeñas
(cientos de bytes) sin trabajo de CPU pesado del lado del servidor — el único
componente pesado en tamaño son las fotos/video de evidencia (ver más abajo).

### Servidor recomendado

La carga calculada arriba es liviana (API REST con JSON pequeño, sin
procesamiento de imágenes en el propio backend), así que para 100 guardias el
factor crítico no es la CPU sino **disponibilidad constante** (un                           con
el SOS activo no puede depender de un servidor lento en responder) y
**espacio en disco suficiente**, porque la base de datos y las evidencias
crecen todos los días de operación.

**Opción todo-en-uno** (backend + base de datos en el mismo servidor):

| | Mínimo viable | Recomendado (con margen) |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disco | SSD, 50 GB | SSD, 200 GB o más (ver estimación de crecimiento abajo) |
| Red | IP fija, conexión estable | Igual, con buen ancho de subida si las evidencias se guardan en el mismo servidor |
| Software base | Linux (Ubuntu/Debian LTS) + Node.js 20 LTS + PostgreSQL 15+ | Igual |

**Opción en dos servidores** (recomendada para producción real: aísla la base
de datos del tráfico web y es más resiliente):

| Servidor | Especificación | Para qué |
|---|---|---|
| Aplicación (backend Express + panel web) | 2 vCPU / 4 GB RAM | Atiende la API REST y el panel de monitoreo |
| Base de datos (PostgreSQL) | 2-4 vCPU / 8 GB RAM, SSD dedicado | Aislar la DB evita que un pico de consultas del panel afecte el tiempo de respuesta del SOS |

Un solo proceso Node.js alcanza para 100 guardias; si la dotación crece a
varios cientos conviene reevaluar (más vCPU, o balanceo de carga entre varias
instancias del backend).

### Espacio en disco recomendado

- **Base de datos**: la tabla que más crece es la de telemetría (un punto GPS
  por guardia cada ~15-20s durante su turno). Con 100 guardias en turnos de
  8h: ≈1,500-1,900 filas/guardia/turno × 100 guardias ≈ **150,000-190,000
  filas/día**, cada una pequeña (~100-150 bytes) → aproximadamente **20-30
  MB/día**, unos **600-900 MB/mes** si los 100 guardias trabajan turno todos
  los días (del orden de 7-10 GB/año solo de esa tabla, sin contar índices).
  No hay hoy una política de retención/purgado implementada: conviene
  definirla desde el arranque del servidor propio (archivar o borrar
  telemetría de más de cierta antigüedad, o particionar la tabla por
  mes/año) para no comprometer el rendimiento del mapa en vivo y el
  historial a mediano plazo.
- **Evidencias (fotos/video)**: por turno, 1 selfie de inicio (~0.2-1 MB) +
  evidencia variable de incidentes (fotos ~1-3 MB, video bastante más
  pesado). Estimación conservadora de uso normal: **3-5 MB/guardia/día**, es
  decir **300-500 MB/día con 100 guardias activos**, varios GB por mes
  acumulados y sin techo natural (crece indefinidamente salvo que se defina
  una política de archivado a almacenamiento frío).
- **Recomendación de arranque**: al menos 50-100 GB de disco disponible desde
  el día uno (deja varios meses de margen), con capacidad de ampliar el
  volumen o de mover las evidencias a un almacenamiento de objetos separado
  (por ejemplo MinIO autoalojado, compatible con el mismo protocolo S3 que ya
  usa la app) si el crecimiento se acelera.

### Ancho de banda / consumo de datos del guardia

- Cada ping de ubicación es un JSON pequeño (~0.3-0.5 KB de ida y vuelta); en
  un turno de 8h eso son solo algunos cientos de KB por guardia únicamente en
  telemetría — el consumo de datos móviles es bajo, pero requiere señal de
  datos **continua**, no solo intermitente (ver [§8](#8-geolocalización)).

> Estas cifras son una estimación de dimensionamiento a partir del
> comportamiento real del código (intervalos de polling/tracking definidos en
> `ShiftContext`, `location.ts` y `backgroundLocationTask.ts`), no una
> medición de carga en producción. Antes de comprometer un servidor
> definitivo, conviene validarlas con monitoreo real una vez el sistema esté
> en uso con los 100 guardias, y ajustar según el tráfico observado.

## 14. Configuración y variables de entorno

Definidas en `.env` (desarrollo local) y replicadas en los 3 perfiles de
`eas.json` (build). Prefijo `EXPO_PUBLIC_` obligatorio para que Expo las
incluya en el bundle del cliente.

| Variable | Uso | Notas |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL del backend Express | Si se omite, se deduce automáticamente: IP LAN de Metro en desarrollo, o la URL de producción (`https://api.sistec-unifranz.com/api`) en build standalone (ver `src/api/client.ts`) |
| `EXPO_PUBLIC_SUPABASE_URL` | Proyecto Supabase | Usado para Storage y la Edge Function de recuperación de contraseña |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Publishable key de Supabase | Pública por diseño (va embebida en el APK); el acceso real queda acotado por las policies del bucket y por la Edge Function |
| `EXPO_PUBLIC_API_PORT` | Puerto del backend local (opcional) | Default `4001`, solo relevante calculando la URL por defecto en desarrollo |

> No se necesita ninguna API key de mapas: el mapa usa tiles públicos de
> OpenStreetMap. Para producción con mucho tráfico, revisar la
> [política de uso de OSM](https://operations.osmfoundation.org/policies/tiles/)
> o considerar un proveedor de tiles OSM (MapTiler, Stadia Maps).

## 15. Cómo correr el proyecto

```bash
npm install
npm start          # abre Expo; escanear QR con Expo Go (Android)
# o
npm run android
npm run ios
npm run web
```

Chequeo de tipos (no hay suite de tests automatizados en este repo):

```bash
npm run typecheck   # tsc --noEmit
```

**Limitaciones en Expo Go**: el GPS en segundo plano (app minimizada/pantalla
apagada) **no funciona en Expo Go** — requiere un dev client o build nativo
(EAS). En Expo Go, el tracking siempre degrada a primer-plano-únicamente.

## 16. Build y despliegue (EAS)

Configurado en `eas.json`, tres perfiles:

| Perfil | Distribución | Tipo Android | Uso |
|---|---|---|---|
| `development` | interna | APK, `developmentClient: true` | Dev client para probar GPS en segundo plano, cámara, etc. fuera de Expo Go |
| `preview` | interna | APK | Builds de prueba para QA / stakeholders |
| `production` | — | App Bundle (`.aab`), `autoIncrement: true` | Publicación en Play Store |

```bash
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile production --platform android
```

Identidad de la app: `bo.gob.cochabamba.guardias` (bundle id / package),
`app.json` → `expo.owner: "carmenvic"`, `projectId` de EAS en
`expo.extra.eas.projectId`.

⚠️ **Nota de configuración conocida**: en un build standalone `hostUri` no
existe (no hay Metro). En teoría `eas.json` fija `EXPO_PUBLIC_API_URL` ahí y
debería bastar, pero se confirmó en un build real que esa variable a veces
**no llega** al bundle final (quedó embebida una IP de LAN vieja en vez de la
URL de producción). Por eso el fallback en `src/api/client.ts` para build
standalone **no es una IP local**: es directamente la URL de producción
(`PROD_API_URL`). Si cambia la URL del backend, actualizar en **ambos**
lugares: `PROD_API_URL` (código) y `EXPO_PUBLIC_API_URL` (`eas.json`/`.env`).

## 17. Permisos nativos

Declarados en `app.json` (`expo.ios.infoPlist`, `expo.android.permissions`,
plugins `expo-camera` / `expo-location`):

| Permiso | Plataforma | Para qué |
|---|---|---|
| Cámara | Android/iOS | Selfie de inicio de turno, evidencia foto/video de incidentes |
| Micrófono | Android/iOS | Grabar video de evidencia (audio incluido) |
| Ubicación en uso | Android/iOS | Inicio/cierre de turno, ruta de patrullaje, ubicación de incidentes/mandados |
| Ubicación en segundo plano ("Permitir siempre") | Android/iOS | Seguir registrando el recorrido con la app minimizada o la pantalla apagada — **requiere dev client/build nativo**, no funciona en Expo Go |
| Face ID (`NSFaceIDUsageDescription`) | iOS | Login / confirmación rápida de SOS |

En Android, con fabricantes que aplican optimización de batería agresiva
(Xiaomi, Huawei, Samsung), el sistema puede matar la app en segundo plano
igual salvo que el guardia la excluya manualmente de la optimización de
batería — sin eso, el seguimiento en vivo se detiene en silencio.

## 18. Mapa de pantallas ↔ requerimientos funcionales

| Pantalla | RF |
|----------|-----|
| Login | RF-APP-01 |
| Recuperar contraseña | RF-APP-02 |
| Iniciar servicio (cámara + confirmación) | RF-APP-03 |
| Inicio / estado del turno | RF-APP-04 |
| Captura periódica de GPS (primer y segundo plano) | RF-APP-05 |
| Registrar mandado (tarea) | RF-APP-06 |
| Cerrar servicio + resumen | RF-APP-07 |
| Registrar incidente | RF-APP-08 |
| Historial (turnos / incidentes / mandados) | RF-APP-09 |
| Mapa de la ronda | RF-APP-10 |
| Sincronización offline + botón SOS | RF-APP-11 |

## 19. Referencia de endpoints consumidos

Todos los endpoints que la app realmente llama, extraídos de `src/api/*.ts` y
`src/api/client.ts`. Todos van bajo `API_BASE_URL` (ver [§14](#14-configuración-y-variables-de-entorno))
salvo los dos marcados como "Supabase directo", que no pasan por el backend
Express.

### Autenticación (`src/api/auth.ts`, `src/api/client.ts`)

| Método y ruta | Para qué | Guarda / muestra |
|---|---|---|
| `POST /mobile/auth/login` | Iniciar sesión (usuario + contraseña) | Guarda `accessToken`/`refreshToken`, muestra el perfil del guardia |
| `POST /mobile/auth/activar` | Primer acceso: fija contraseña con el token de activación | Igual que login, deja la sesión iniciada |
| `GET /mobile/auth/me` | Rehidratar sesión al abrir la app | Muestra el perfil del guardia autenticado |
| `POST /mobile/auth/refresh` | Renovar `accessToken` cuando expira (interno, en cualquier 401) | — |
| `POST /mobile/auth/logout` | Cerrar sesión en el servidor | — |

### Turnos (`src/api/turnos.ts`)

| Método y ruta | Para qué | Guarda / muestra |
|---|---|---|
| `POST /turnos` | Iniciar servicio (RF-APP-03) | Guarda el turno; muestra estado "en servicio" |
| `PATCH /turnos/:id/cerrar` | Cerrar servicio (RF-APP-07) | Guarda cierre; muestra resumen del turno |
| `GET /turnos?guardia=me` | Listar turnos propios (RF-APP-09) | Muestra historial de turnos |
| `GET /turnos/:id/recorrido` | Recorrido GPS real de un turno | Muestra la polyline en Mapa/Detalle de turno |

### Telemetría / ubicación (`src/api/turnos.ts`, `src/api/sos.ts`, `SosButton.tsx`)

| Método y ruta | Para qué | Guarda / muestra |
|---|---|---|
| `POST /telemetry` | Ping periódico de ubicación (RF-APP-05) | Guarda el punto GPS del recorrido |
| `POST /telemetry` (`esSos: true`) | Botón SOS | Guarda la alerta; pone al guardia en `emergencia` |
| `GET /telemetry/estado` | Poll cada 4s mientras hay SOS activo | Muestra si el operador ya atendió la alerta |

### Incidentes / hechos (`src/api/incidentes.ts`)

| Método y ruta | Para qué | Guarda / muestra |
|---|---|---|
| `POST /hechos` | Registrar incidente (RF-APP-08) | Guarda el hecho con sus evidencias |
| `GET /hechos?guardia=me` | Listar incidentes propios (RF-APP-09) | Muestra historial de incidentes |
| `GET /hechos/tipos` | Catálogo de tipos de hecho | Llena el selector de tipo en el formulario |

### Mandados / tareas (`src/api/mandados.ts`)

| Método y ruta | Para qué | Guarda / muestra |
|---|---|---|
| `POST /mandados` | Registrar mandado/tarea (RF-APP-06) | Guarda el mandado |
| `GET /mandados?guardia=me` | Listar mandados propios (RF-APP-09) | Muestra historial de mandados |

### Patrullas / rutas (`src/api/patrullas.ts`)

| Método y ruta | Para qué | Guarda / muestra |
|---|---|---|
| `GET /patrullas/vigente` | Ruta/zona asignada para hoy | Muestra el polígono/trazado en el Mapa; dispara el aviso de ruta nueva/modificada/eliminada |

### Checkpoints (`src/api/checkpoints.ts`)

| Método y ruta | Para qué | Guarda / muestra |
|---|---|---|
| `POST /checkpoints` | Registrar verificación periódica de ronda (foto + ubicación) | Guarda el checkpoint; despeja el aviso pendiente en la app |

### Directo a Supabase (no pasan por el backend Express)

| Llamada | Para qué |
|---|---|
| `POST {SUPABASE_URL}/storage/v1/object/evidencias/{selfies\|incidentes\|checkpoints}/...` | Subir selfie/foto/video antes de mandar la URL al backend (`src/utils/storage.ts`) |
| `POST {SUPABASE_URL}/functions/v1/guardia-password-reset` | Recuperar contraseña (Edge Function, sin JWT) (`src/api/auth.ts`) |

## 20. Glosario

| Término | Significado |
|---|---|
| **EPI** | Estación Policial Integral — distrito/zona de asignación del guardia |
| **Turno** | Periodo de servicio de un guardia, de inicio a cierre |
| **Hecho** | Nombre interno (DB/backend) de un incidente reportado |
| **Mandado** | Nombre interno (DB/backend/código) de lo que la UI muestra como "Tarea" |
| **Patrulla** | Asignación de ruta/zona de un guardia para un día (tabla `patrulla`) |
| **Checkpoint** | Verificación periódica de identidad/ubicación durante la ronda (foto + GPS) |
| **Telemetría** | Puntos GPS periódicos del guardia, incluida la bandera de SOS (`guardia_telemetria`) |
| **Zona crítica** | Área con concentración de hechos recientes, calculada por el backend (`zona_critica_activa`) |

---

*Este documento describe el estado del código en la rama `main` al momento de
su redacción. Ante cambios relevantes en la arquitectura, actualizar esta
sección junto con `README.md` y `CORRECCIONES.md`.*
