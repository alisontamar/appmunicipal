import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GeoPoint } from '@/types';
import { cargarTokens, tokenActual } from '@/api/client';
import { enviarUbicacion } from '@/api/turnos';
import { encolar } from './offlineQueue';
import { procesarPuntoGps } from './filtroGps';

/**
 * Tracking en segundo plano (RF-APP-05, pedido explícito: "cuando el celular
 * está apagado [con la pantalla bloqueada] igual debería mandar el gps en
 * segundo plano"). `watchPositionAsync` (ver location.ts) solo funciona con
 * la app en foreground — Android/iOS suspenden el JS en cuanto se bloquea la
 * pantalla o se cambia de app, y el GPS deja de reportar hasta reabrirla.
 *
 * `Location.startLocationUpdatesAsync` es la API que sí sigue corriendo con
 * la app en segundo plano: en Android via un foreground service real (por
 * eso el guardia ve una notificación persistente mientras está en turno — es
 * un requisito del sistema, no decorativo) y en iOS porque la app declara el
 * background mode "location". El punto capturado llega a la tarea definida
 * más abajo (`TaskManager.defineTask`), NO a un callback normal de React —
 * por eso esta tarea es un módulo aparte, sin hooks, que se auto-registra al
 * cargar (una sola vez, ver `isTaskDefined`).
 *
 * Contexto "headless": en Android, si el proceso de la app fue matado (no
 * solo puesto en background) y el sistema despierta el proceso SOLO para
 * correr esta tarea, ningún componente de React (AuthContext, ShiftContext)
 * llegó a montarse — por eso la tarea:
 *   1. No lee el turno activo de un estado de React — lo lee de AsyncStorage
 *      (`setTurnoActivoParaBackground` lo escribe desde ShiftContext al
 *      iniciar/cerrar turno).
 *   2. Se asegura de tener el accessToken en memoria con `cargarTokens()`
 *      antes de mandar — normalmente eso lo hace AuthContext al montar la
 *      app, que en un despertar headless nunca corre.
 *   3. Manda directo a la API (mismo endpoint que enviarUbicacion en
 *      foreground) y si falla, encola en la misma cola offline — al volver
 *      a abrir la app, la sincronización periódica de ShiftContext la vacía
 *      igual que cualquier otro pendiente.
 */

export const BACKGROUND_LOCATION_TASK = 'gamc-ubicacion-en-segundo-plano';

const CLAVE_TURNO_ACTIVO = 'gamc:turno_activo_id';

/** ShiftContext llama a esto al iniciar servicio (turnoId) y al cerrarlo/descartarlo (null). */
export async function setTurnoActivoParaBackground(turnoId: string | null): Promise<void> {
  try {
    if (turnoId) await AsyncStorage.setItem(CLAVE_TURNO_ACTIVO, turnoId);
    else await AsyncStorage.removeItem(CLAVE_TURNO_ACTIVO);
  } catch (e) {
    console.warn('[GPS background] no se pudo persistir el turno activo:', e);
  }
}

async function turnoActivoPersistido(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CLAVE_TURNO_ACTIVO);
  } catch {
    return null;
  }
}

function aGeoPoint(loc: Location.LocationObject): GeoPoint {
  return {
    latitud: loc.coords.latitude,
    longitud: loc.coords.longitude,
    timestamp: new Date(loc.timestamp).toISOString(),
    precision: loc.coords.accuracy ?? undefined,
  };
}

type PuntoListener = (punto: GeoPoint) => void;
let puntoListener: PuntoListener | null = null;

/**
 * ShiftContext se suscribe con esto SOLO para reflejar el punto en el
 * estado local (recorrido/distancia en pantalla) — el envío a la API ya lo
 * hace la tarea de abajo por su cuenta, así que este listener nunca debe
 * volver a mandar el punto (evitaría duplicar el POST a /telemetry). Si la
 * tarea corre headless (app no montada), `puntoListener` es null acá y
 * simplemente no hay UI que actualizar — el punto de todos modos ya se
 * mandó/encoló.
 */
export function setPuntoListener(fn: PuntoListener | null): void {
  puntoListener = fn;
}

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[GPS background]', error.message);
      return;
    }
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    if (!locations || locations.length === 0) return;

    const turnoId = await turnoActivoPersistido();
    if (!turnoId) return; // Sin turno en curso — ping suelto, se ignora.

    // Solo el punto más reciente del lote — igual criterio que
    // watchPositionAsync en foreground, no hace falta mandar cada punto
    // intermedio que el sistema haya podido agrupar.
    // Filtro anti-deriva: un guardia quieto repite el mismo punto (no suma metros).
    const filtrado = procesarPuntoGps(aGeoPoint(locations[locations.length - 1]!));
    if (!filtrado) return;
    const punto = filtrado.punto;
    puntoListener?.(punto);

    if (!tokenActual()) {
      await cargarTokens();
    }
    try {
      await enviarUbicacion(turnoId, punto);
    } catch (e) {
      console.warn('[GPS background] fallo el envío, se encola:', e);
      await encolar('ubicacion', { turnoId, punto });
    }
  });
}

export type ResultadoSeguimientoBackground = 'background' | 'denegado';

/**
 * Arranca el tracking en segundo plano para el turno en curso. Requiere el
 * permiso "Permitir siempre" (Android: ACCESS_BACKGROUND_LOCATION; iOS:
 * "Always") — el foreground ya está garantizado en este punto porque
 * `iniciarServicio` (ShiftContext) recién llamó a `obtenerUbicacionActual()`
 * con éxito antes de llegar acá.
 *
 * Si el guardia NO otorga "Permitir siempre" (o el foreground service no
 * llega a arrancar), devuelve 'denegado' — ShiftContext.iniciarSeguimiento
 * degrada ahí mismo al tracking foreground-only que ya existía antes de
 * este cambio (watchPositionAsync), en vez de dejar al guardia sin ningún
 * tracking.
 */
export async function iniciarSeguimientoBackground(turnoId: string): Promise<ResultadoSeguimientoBackground> {
  await setTurnoActivoParaBackground(turnoId);
  try {
    let { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      ({ status } = await Location.requestBackgroundPermissionsAsync());
    }
    if (status !== Location.PermissionStatus.GRANTED) {
      await setTurnoActivoParaBackground(null);
      return 'denegado';
    }
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 20_000,
      distanceInterval: 25,
      foregroundService: {
        notificationTitle: 'Patrullaje en curso',
        notificationBody: 'Se está registrando su ubicación mientras el turno está activo.',
        killServiceOnDestroy: false,
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
    return 'background';
  } catch (e) {
    console.warn('[GPS background] no se pudo iniciar:', e);
    await setTurnoActivoParaBackground(null);
    return 'denegado';
  }
}

export async function detenerSeguimientoBackground(): Promise<void> {
  await setTurnoActivoParaBackground(null);
  try {
    const activo = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (activo) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch (e) {
    console.warn('[GPS background] no se pudo detener:', e);
  }
}
/** True si la tarea de ubicación en segundo plano está corriendo ahora mismo. */
export async function seguimientoBackgroundActivo(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}

/** True si el guardia ya dio "Permitir siempre" (para reiniciar sin volver a preguntarle). */
export async function permisoBackgroundOtorgado(): Promise<boolean> {
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED;
  } catch {
    return false;
  }
}
