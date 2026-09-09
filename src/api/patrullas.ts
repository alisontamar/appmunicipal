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
