import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Turno } from '@/types';

/**
 * Copia del turno en curso en el teléfono. Permite mostrar el servicio al abrir
 * la app sin esperar la red; el servidor corrige lo que haya cambiado después.
 */
const CLAVE = 'gamc:turno_cache';

interface TurnoGuardado {
  guardiaId: string;
  turno: Turno;
}

/** Guarda el turno si está en servicio; si no, borra la copia. */
export async function guardarTurnoCache(guardiaId: string, turno: Turno | null): Promise<void> {
  try {
    if (turno && turno.estado === 'en_servicio') {
      const datos: TurnoGuardado = { guardiaId, turno };
      await AsyncStorage.setItem(CLAVE, JSON.stringify(datos));
    } else {
      await AsyncStorage.removeItem(CLAVE);
    }
  } catch {
    // Best effort: sin cache, la app igual consulta al servidor.
  }
}

/** Devuelve el turno guardado si es de este guardia y sigue en servicio. */
export async function leerTurnoCache(guardiaId: string): Promise<Turno | null> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE);
    if (!raw) return null;
    const datos = JSON.parse(raw) as TurnoGuardado;
    if (datos.guardiaId !== guardiaId || datos.turno?.estado !== 'en_servicio') return null;
    return datos.turno;
  } catch {
    return null;
  }
}
