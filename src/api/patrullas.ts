import { request } from './client';

/** Patrulla vigente del guardia para el día (reemplaza `mockZonaAsignada`). */
export interface PatrullaVigente {
  id: string;
  guardiaId: string;
  estado: 'asignada' | 'en_curso';
  fecha: string; // ISO date
  nombre: string | null;
  descripcion: string | null;
  notas: string | null;
  epiId: string | null;
  rutaPlantillaId: string | null;
  rutaNombre: string | null;
  trazado: [number, number][] | null; // [[lng, lat], ...] de ruta_plantilla
  poligonoGeojson: unknown | null;
  turnoId: string | null;
  horaInicioPrevista: string | null; // "HH:MM"
  iniciadaEn: string | null;
}

export interface ZonaPunto {
  latitud: number;
  longitud: number;
}

/** Devuelve la patrulla vigente, o `null` si hoy el guardia no tiene ninguna. */
export async function patrullaVigente(): Promise<PatrullaVigente | null> {
  return request<PatrullaVigente | null>('/patrullas/vigente');
}

/** Convierte el `trazado` ([lng,lat]) al formato que usa el mapa ({latitud,longitud}). */
export function trazadoAZona(trazado: PatrullaVigente['trazado']): ZonaPunto[] {
  if (!Array.isArray(trazado)) return [];
  return trazado
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map(([lng, lat]) => ({ latitud: lat, longitud: lng }));
}

/**
 * Convierte un GeoJSON Polygon ({ type: 'Polygon', coordinates: [[[lng,lat],...]] })
 * al formato que usa el mapa. Es lo que realmente llena el panel web al asignar una
 * ruta (`AssignRouteWizard` ubica un pin por guardia y el backend genera un cuadrado
 * alrededor, guardado en `patrulla.poligono_geojson`) — "ruta_plantilla.trazado" hoy
 * no se puede crear desde la web (queda como placeholder para más adelante).
 */
export function poligonoAZona(poligono: PatrullaVigente['poligonoGeojson']): ZonaPunto[] {
  if (!poligono || typeof poligono !== 'object') return [];
  const anillo = (poligono as { coordinates?: unknown }).coordinates;
  const anilloExterior = Array.isArray(anillo) ? anillo[0] : null;
  if (!Array.isArray(anilloExterior)) return [];
  return anilloExterior
    .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2)
    .map(([lng, lat]) => ({ latitud: lat, longitud: lng }));
}

/**
 * Zona a dibujar para la patrulla vigente: prioriza `poligonoGeojson` (lo que
 * realmente asigna la web hoy) y cae a `trazado` de ruta_plantilla si en el futuro
 * ese feature de plantillas reutilizables termina de implementarse en el backend.
 */
export function zonaDePatrulla(p: PatrullaVigente | null): ZonaPunto[] {
  const deAsignacion = poligonoAZona(p?.poligonoGeojson ?? null);
  if (deAsignacion.length > 0) return deAsignacion;
  return trazadoAZona(p?.trazado ?? null);
}
