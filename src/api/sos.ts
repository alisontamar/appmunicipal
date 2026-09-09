import { request } from './client';
import type { GeoPoint } from '@/types';

export interface AlertaSos {
  id: string;
  turnoId: string;
  guardiaId: string;
  ubicacion: GeoPoint;
  creadoEn: string; // ISO
}

/** Punto de telemetría con la bandera SOS (unificado, BD_UNIFICADA §2.2). */
interface TelemetriaSosDTO {
  id: string; // bigint serializado como string
  guardiaId: string;
  turnoId: string | null;
  lat: number;
  lng: number;
  esSos: boolean;
  sosEstado: string | null;
  capturadoEn: string;
}

/**
 * Botón SOS: envía la ubicación en vivo del guardia como alerta crítica. El
 * backend marca `estadoOperativo = "emergencia"` y emite el evento realtime.
 * El `guardiaId` real sale del token; el parámetro se conserva por compatibilidad.
 */
export async function enviarAlertaSos(
  turnoId: string,
  guardiaId: string,
  ubicacion: GeoPoint,
): Promise<AlertaSos> {
  const d = await request<TelemetriaSosDTO>('/telemetry', {
    method: 'POST',
    body: JSON.stringify({
      turnoId: turnoId || undefined,
      lat: ubicacion.latitud,
      lng: ubicacion.longitud,
      esSos: true,
      sosEstado: 'pendiente',
      capturadoEn: ubicacion.timestamp,
    }),
  });
  return {
    id: String(d.id),
    turnoId: d.turnoId ?? turnoId,
    guardiaId: d.guardiaId ?? guardiaId,
    ubicacion: { latitud: d.lat, longitud: d.lng, timestamp: d.capturadoEn },
    creadoEn: d.capturadoEn,
  };
}
