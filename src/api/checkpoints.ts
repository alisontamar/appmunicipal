import { delay } from './client';
import { subirEvidencia } from '@/utils/storage';
import type { Checkpoint, GeoPoint } from '@/types';

/**
 * Verificacion periodica de identidad/ubicacion durante el turno (checkpoint de ronda).
 *
 * TODO(backend): la API móvil todavía no expone un endpoint de checkpoints. Por
 * ahora se resuelve localmente; cuando exista, cambiar por `request('/checkpoints', ...)`.
 * La foto ya se sube al bucket "evidencias" para que, cuando exista el endpoint,
 * quede lista una URL real en vez de una ruta local del dispositivo.
 */
export async function registrarCheckpoint(
  turnoId: string,
  fotoUri: string,
  ubicacion: GeoPoint,
): Promise<Checkpoint> {
  const fotoUrl = await subirEvidencia(fotoUri, 'checkpoints');
  return delay({
    id: `chk-${Date.now()}`,
    turnoId,
    estado: 'realizado',
    fotoUri: fotoUrl,
    ubicacion,
    creadoEn: ubicacion.timestamp,
  });
}
