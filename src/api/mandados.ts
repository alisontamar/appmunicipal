import { delay } from './client';
import { mockMandadosHistoricos } from '@/mocks';
import type { GeoPoint, Mandado } from '@/types';

/** RF-APP-06 - registrar mandado / comision puntual del turno. */
export async function registrarMandado(
  turnoId: string,
  descripcion: string,
  ubicacion: GeoPoint,
): Promise<Mandado> {
  return delay({
    id: `man-${Date.now()}`,
    turnoId,
    descripcion,
    ubicacion,
    creadoEn: ubicacion.timestamp,
  });
}

export async function listarMandados(): Promise<Mandado[]> {
  return delay(mockMandadosHistoricos);
}
