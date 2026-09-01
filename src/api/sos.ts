import { delay } from './client';
import type { GeoPoint } from '@/types';

export interface AlertaSos {
  id: string;
  turnoId: string;
  guardiaId: string;
  ubicacion: GeoPoint;
  creadoEn: string; // ISO
}

/**
 Botón SOS envía la ubicación en vivo del guardia como alerta crítica.

 */
export async function enviarAlertaSos(
  turnoId: string,
  guardiaId: string,
  ubicacion: GeoPoint,
): Promise<AlertaSos> {
  return delay(
    {
      id: `sos-${Date.now()}`,
      turnoId,
      guardiaId,
      ubicacion,
      creadoEn: ubicacion.timestamp,
    },
    400, // el SOS debe sentirse casi instantáneo por eso un delay corto
  );
}