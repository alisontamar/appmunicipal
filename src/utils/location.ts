import * as Location from 'expo-location';

import type { GeoPoint } from '@/types';
import { capturarUbicacionMock } from './geo';

/** Se lanza cuando el usuario niega el permiso de ubicación. */
export class UbicacionDenegadaError extends Error {
  constructor() {
    super('Permiso de ubicación denegado. Actívelo en Ajustes para continuar.');
    this.name = 'UbicacionDenegadaError';
  }
}

let seSolicitoPermiso = false;
// MapScreen (ubicación + seguimiento) y ShiftContext (seguimiento del turno) pueden
// pedir permiso casi al mismo tiempo al entrar al mapa durante un servicio activo.
// Llamar dos veces en paralelo a los métodos nativos de permisos de Android puede
// hacer que una de las dos llamadas resuelva como "denegado" aunque el permiso ya
// esté otorgado. Se comparte una única promesa en vuelo para que las llamadas
// concurrentes esperen el mismo chequeo en vez de disparar varias llamadas nativas.
let chequeoEnCurso: Promise<boolean> | null = null;

async function asegurarPermiso(): Promise<boolean> {
  if (chequeoEnCurso) return chequeoEnCurso;

  chequeoEnCurso = (async () => {
    const actual = await Location.getForegroundPermissionsAsync();
    if (actual.status === Location.PermissionStatus.GRANTED) return true;
    if (!actual.canAskAgain && seSolicitoPermiso) return false;
    seSolicitoPermiso = true;
    const solicitado = await Location.requestForegroundPermissionsAsync();
    return solicitado.status === Location.PermissionStatus.GRANTED;
  })();

  try {
    return await chequeoEnCurso;
  } finally {
    chequeoEnCurso = null;
  }
}

function aGeoPoint(pos: Location.LocationObject): GeoPoint {
  return {
    latitud: pos.coords.latitude,
    longitud: pos.coords.longitude,
    timestamp: new Date(pos.timestamp).toISOString(),
    precision: pos.coords.accuracy ?? undefined,
  };
}

/**
 * Obtiene la ubicación GPS real del dispositivo (RF-APP-03, RF-APP-06, RF-APP-08).
 *
 * Si el permiso es denegado, propaga `UbicacionDenegadaError` para que la pantalla lo
 * muestre explícitamente (no se debe iniciar un turno ni registrar un hecho con una
 * ubicación falsa sin que el guardia lo sepa).
 *
 * Si el permiso está otorgado pero el dispositivo no logra reportar una posición (típico
 * en emuladores sin GPS configurado durante el desarrollo), se usa una ubicación simulada
 * únicamente en modo desarrollo, dejando constancia en consola.
 */
export async function obtenerUbicacionActual(): Promise<GeoPoint> {
  const otorgado = await asegurarPermiso();
  if (!otorgado) throw new UbicacionDenegadaError();

  try {
    const serviciosActivos = await Location.hasServicesEnabledAsync();
    if (!serviciosActivos) {
      throw new Error('El GPS del dispositivo está desactivado.');
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return aGeoPoint(pos);
  } catch (error) {
    if (__DEV__) {
      console.warn('[GPS] No se pudo leer la ubicación real, usando mock:', error);
      return capturarUbicacionMock();
    }
    throw error instanceof Error ? error : new Error('No se pudo obtener la ubicación.');
  }
}

export interface SeguimientoUbicacion {
  remove: () => void;
}

/**
 * Inicia el seguimiento continuo de ubicación durante el turno (RF-APP-05).
 * Emite un nuevo punto cada ~15s o cada 25m de desplazamiento, lo que ocurra primero.
 */
export async function iniciarSeguimientoUbicacion(
  onUpdate: (punto: GeoPoint) => void,
  onError?: (error: Error) => void,
): Promise<SeguimientoUbicacion> {
  const otorgado = await asegurarPermiso();
  if (!otorgado) {
    onError?.(new UbicacionDenegadaError());
    return { remove: () => {} };
  }

  try {
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 15_000,
        distanceInterval: 25,
      },
      (pos) => onUpdate(aGeoPoint(pos)),
    );
    return { remove: () => sub.remove() };
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('No se pudo iniciar el GPS.'));
    return { remove: () => {} };
  }
}