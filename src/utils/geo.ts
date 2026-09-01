import type { GeoPoint } from '@/types';

/**
 * Ubicacion GPS simulada. En la fase estatica no se pide permiso ni se usa
 * expo-location: se devuelve un punto cercano a la plaza principal de Cochabamba
 * con una pequena variacion aleatoria para simular el movimiento de la ronda.
 */
const BASE_LAT = -17.3935;
const BASE_LNG = -66.157;

export function capturarUbicacionMock(): GeoPoint {
  const jitter = () => (Math.random() - 0.5) * 0.01;
  return {
    latitud: BASE_LAT + jitter(),
    longitud: BASE_LNG + jitter(),
    timestamp: new Date().toISOString(),
  };
}

/** Distancia aproximada en metros entre dos puntos (haversine). */
export function distanciaMetros(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitud - a.latitud);
  const dLng = toRad(b.longitud - a.longitud);
  const lat1 = toRad(a.latitud);
  const lat2 = toRad(b.latitud);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
