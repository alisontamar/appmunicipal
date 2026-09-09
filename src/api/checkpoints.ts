import { delay } from './client';
import type { Checkpoint, GeoPoint } from '@/types';

/**
 * Verificacion periodica de identidad/ubicacion durante el turno (checkpoint de ronda).
 *
 * TODO(backend): la API móvil todavía no expone un endpoint de checkpoints. Por
 * ahora se resuelve localmente; cuando exista, cambiar por `request('/checkpoints', ...)`.
 */
export async function registrarCheckpoint(
  turnoId: string,
  fotoUri: string,
  ubicacion: GeoPoint,
): Promise<Checkpoint> {
  return delay({
    id: `chk-${Date.now()}`,
    turnoId,
    estado: 'realizado',
    fotoUri,
    ubicacion,
    creadoEn: ubicacion.timestamp,
  });
}
