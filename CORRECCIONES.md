# Correcciones aplicadas — Rondas Guardia Municipal

Resumen de las 9 correcciones pedidas: qué se hizo, dónde, y qué queda pendiente
(y por qué). `npx tsc --noEmit` pasa sin errores con todos los cambios.

## ✅ Hecho

### 1. Logo de la alcaldía al instalar la app
`app.json` no tenía `icon` ni `splash` configurados (usaba los defaults de Expo).
Generé `assets/icon.png` (1024×1024), `assets/adaptive-icon.png` (Android) y
`assets/splash-icon.png` a partir de `assets/escudo.webp`, sobre el fondo
institucional `#1C1A19`, y los referencié en `app.json`
(`expo.icon`, `expo.splash`, `expo.android.adaptiveIcon`).
**Pendiente de tu parte:** solo se ve en un build nuevo (EAS build / APK), no en
Expo Go ni recargando el bundle.

### 2. Teclado tapando los inputs
`ScreenContainer` (usado por casi todas las pantallas con formularios) no tenía
`KeyboardAvoidingView`. Se agregó ahí mismo (mismo patrón que ya usaba
`LoginScreen`), así que se arregla en todas las pantallas de una vez: Olvidé mi
contraseña, Registrar tarea, Registrar incidente, etc.

### 3. Botón "Sig." del teclado no pasa al siguiente input (Login)
`TextField` no reenviaba el `ref` al `TextInput` interno. Se convirtió a
`forwardRef` y en `LoginScreen` el campo "Usuario" ahora enfoca el campo
"Contraseña" al presionar sig. (`onSubmitEditing` + `ref`).

### 4. Recuperar contraseña no funcionaba / no mandaba código
Confirmé que el backend Express (no está en este repo) **no tiene ningún
endpoint** de recuperación (probé varias rutas, todas 404), y que `guardia` no
tiene email, solo teléfono — no había ningún canal para mandar un código.
Como pediste, lo resolví con una **Edge Function de Supabase**
(`guardia-password-reset`, ya desplegada) que verifica identidad con
usuario + CI + teléfono y cambia la contraseña en el mismo paso, sin código.
Se probó con datos que no coinciden (devuelve error genérico, sin decir cuál
dato falló) y con contraseña corta (rechazada). `ForgotPasswordScreen` se
rediseñó a un solo paso con ese formulario.
**Aviso de seguridad:** esta función es pública (el guardia no tiene sesión de
Supabase Auth, así que no puede mandar un JWT) — la única barrera es conocer
los 3 datos, y no hay límite de intentos. Razonable para la fase de pruebas
actual; antes de producción real conviene moverlo al backend Express con
throttling.

### 5. Servicio iniciado se pierde al salir de la app
Causa real: `ShiftContext` guardaba el turno activo solo en memoria (`useState`
sin persistencia). Si Android mata el proceso al salir, al reabrir la app
`AuthContext` sí rehidrataba la sesión, pero el turno quedaba en `null` aunque
en el backend siguiera `en_servicio` — de ahí el error de "ya existe una sesión
anterior" al querer iniciar de nuevo. Ahora, al detectar un guardia autenticado,
`ShiftContext` busca si ya hay un turno `en_servicio` (`GET /turnos?guardia=me`),
lo restaura junto con su recorrido real (`GET /turnos/:id/recorrido`) y sus
incidentes/tareas, y reanuda el seguimiento GPS y los checkpoints automáticamente.

### 6. Mapa más grande / centrado en tu ubicación / cuadrante de la ruta
Subí la altura del mapa (280 → 460) y ahora espera el primer fix de GPS para
mostrar el mapa ya centrado en tu ubicación real (antes arrancaba siempre en la
plaza 14 de Septiembre y recién después saltaba a tu posición).

Sobre el cuadrante de la ruta encontré **dos causas, no solo una**:
- **Falta de datos**: al revisar la base en Supabase, las patrullas de hoy
  tenían `ruta_plantilla_id = null` y la tabla `ruta_plantilla` estaba vacía
  en todo el proyecto — sin ninguna ruta cargada, no hay nada que dibujar.
- **Bug real en el código** (esto lo encontré después, al repreguntarme si ya
  funcionaría con una ruta asignada): `OsmMapView` arma el HTML del mapa
  **una sola vez al montar** y el polígono de la zona quedaba grabado ahí
  para siempre — no existía forma de actualizarlo después, a diferencia del
  recorrido o los incidentes que sí se actualizan en vivo. Como el mapa recién
  se monta cuando llega el primer punto GPS (rápido) y la ruta asignada se
  pide al backend en Render (puede tardar bastante, sobre todo si el servicio
  gratuito está "dormido"), en la práctica esa respuesta casi siempre llegaba
  **después** de que el mapa ya se había montado sin ella — y el polígono ya
  nunca se actualizaba, aunque sí hubiera una ruta asignada.
  **Arreglado**: agregué un método `setZona` a `OsmMapView`
  (`src/components/OsmMapView.tsx`) que reemplaza el polígono en vivo (igual
  patrón que ya usaban `setRecorrido`/`setIncidentes`), y `MapScreen` ahora lo
  llama cada vez que cambia la zona (`src/screens/map/MapScreen.tsx`), sin
  importar si la respuesta del backend llega antes o después de montar el mapa.

Con esto, si ya asignan una ruta desde la web (con su trazado), sí debería
aparecer en el mapa del guardia. No lo pude probar con datos reales porque
`ruta_plantilla` seguía vacía al momento de este cambio — te recomiendo
asignar una ruta de prueba y confirmarlo en un dispositivo real.

**Actualización — encontré la causa real y ya la arreglé (revisé el repo de la
web en `C:\Users\USUARIO\GAMC`):**
- El asistente de la web (`AssignRouteWizard.tsx`) **no dibuja un trazado
  real** — ubica un pin por guardia y `assignRoute.ts` genera automáticamente
  un cuadrado (`squareAround`) alrededor, que se guarda en
  `patrulla.poligono_geojson`. Confirmé con `pg_get_viewdef` que la vista
  `v_patrulla_vigente` arma la respuesta con `p.poligono_geojson` (el cuadrado
  real) y por separado `r.trazado` (de `ruta_plantilla`, casi siempre null
  porque `ruta_plantilla_id` casi nunca se llena y la web ni siquiera puede
  crear plantillas todavía: `crearRutaPlantilla` es un no-op porque el
  backend no tiene `POST /api/mapas/rutas`).
- La app móvil **solo leía `trazado`**, nunca `poligonoGeojson` — por eso
  nunca aparecía nada, aunque sí asignaran una ruta desde la web.
- **Arreglado**: `src/api/patrullas.ts` ahora tiene `poligonoAZona()` y
  `zonaDePatrulla()`, que prioriza `poligonoGeojson` (lo real) y cae a
  `trazado` solo si algún día se termina el feature de plantillas. Ya lo
  verifiqué contra datos reales: mientras investigaba, ya habías asignado
  rutas hoy a **rod78** y **alison03** desde la web (con polígono real
  guardado) — deberían verse en el mapa de esos guardias con este fix.
- **Pendiente de la web/backend** (fuera de este repo): si más adelante
  quieren rutas reutilizables de verdad, falta `POST /api/mapas/rutas` para
  que "Guardar como plantilla" persista algo real.

### 7. "MANDADOS" → "TAREAS"
Cambiado todo el texto visible (títulos de pantalla, botones, tabs de
historial, resúmenes de turno). **No se tocó** la tabla `mandado`, el endpoint
`/mandados` ni los nombres internos (`Mandado`, `agregarMandado`, etc.) porque
son el contrato real con el backend/DB — cambiarlos habría roto la app sin
ningún beneficio visible.

### 8. Bucket de imágenes en Supabase (lo más importante)
- Creado el bucket **`evidencias`** (público para lectura) con carpetas
  `selfies/`, `incidentes/`, `checkpoints/`.
- Policies en `storage.objects`: `INSERT` habilitado para `anon` pero acotado a
  esas 3 carpetas; sin `UPDATE`/`DELETE` para `anon` (nadie puede pisar o
  borrar evidencia ajena con la key pública). Probado con curl: sube dentro de
  las carpetas permitidas, la URL pública se lee bien, y falla (400) si se
  intenta subir fuera de ellas.
- La app ahora sube la foto/video **directo a Supabase Storage** antes de
  mandar la URL al backend (en vez de mandar la ruta local del celular como
  hacía antes): `src/utils/storage.ts` (nuevo) + wiring en
  `src/api/turnos.ts` (selfie de inicio), `src/api/incidentes.ts` (evidencias,
  foto y video), `src/api/checkpoints.ts` (foto de checkpoint).
- Nuevas variables `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  en `.env` y en los 3 perfiles de `eas.json`.
- Dejé sin tocar el RLS de las demás tablas, como pediste (proyecto en pruebas).

### 9. "Permisos denegados" intermitente en el mapa
`MapScreen` y `ShiftContext` pueden pedir el permiso de ubicación casi al mismo
tiempo al entrar al mapa durante un turno activo; dos llamadas nativas
simultáneas al plugin de permisos de Android pueden hacer que una resuelva
como "denegado" aunque el permiso ya esté otorgado. Se aplicó el mismo patrón
que ya usa `client.ts` para no duplicar refrescos de sesión: una sola promesa
compartida para que las llamadas concurrentes esperen el mismo chequeo
(`src/utils/location.ts`).

## ⏳ No se hizo / queda pendiente

- **Verificación real en dispositivo/Expo Go**: hice typecheck (`tsc --noEmit`,
  sin errores) y probé el bucket + la Edge Function directo contra Supabase con
  curl, pero no hay forma de correr esta app de React Native (cámara, GPS,
  teclado nativo) desde aquí — te recomiendo probar los 9 puntos en un
  dispositivo real antes de dar esto por cerrado.
- **Recuperar contraseña "de verdad" (código por correo/SMS)**: la solución
  actual es un atajo intencional (verificar identidad en vez de mandar código)
  porque no existe canal de envío ni endpoint de backend. Si más adelante
  agregan email a `guardia` y un proveedor de correo/SMS, esto debería migrar a
  un flujo con código real en el backend Express.
- **Cuadrante de ruta en el mapa**: ya arreglé el bug de código (ver punto 6),
  pero sigue haciendo falta cargar rutas (`ruta_plantilla`) y asignarlas a las
  patrullas desde el panel web para poder verlo con datos reales.
- **Quedó un archivo de prueba** `evidencias/selfies/test-smoke.txt` en el
  bucket (usado para verificar que la policy funcionaba). Es inofensivo, lo
  puedes borrar desde el dashboard de Supabase (Storage → evidencias) cuando
  quieras.
- **RLS de las tablas de `public`** (guardia, turno, hecho, etc.) sigue
  desactivado, tal como pediste porque están en fase de pruebas. Antes de
  producción real conviene activarlo con policies apropiadas.
