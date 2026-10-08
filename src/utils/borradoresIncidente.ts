import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GeoPoint, IncidentType, RiskLevel } from '@/types';

/**
 * Borradores de reportes de incidente.
 *
 * Un borrador guarda lo escrito, las fotos/videos ya capturados y, sobre todo,
 * la HORA y la UBICACIÓN del momento en que el guardia empezó el reporte. Al
 * enviar el borrador (aunque sea horas después) se usan esos datos, no los del
 * momento del envío.
 *
 * Una clave de AsyncStorage por borrador, igual que la cola offline: dos
 * escrituras nunca se pisan entre sí.
 */

const PREFIJO = 'gamc:borrador:incidente:';

export interface UbicacionInicio {
  latitud: number;
  longitud: number;
  precision?: number;
}

export interface BorradorIncidente {
  id: string;
  tipo: IncidentType | null;
  descripcion: string;
  riesgo: RiskLevel | null;
  /** URIs locales (copiadas a un directorio que el sistema no vacía). */
  evidenciaUris: string[];
  /** ISO — cuándo empezó el guardia a armar el reporte. */
  horaInicio: string;
  /** Dónde estaba al empezar. `null` si el GPS no respondió en ese momento. */
  ubicacionInicio: UbicacionInicio | null;
  creadoEn: string;
  actualizadoEn: string;
}

function nuevoId(): string {
  return `bor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Crea un borrador vacío con la hora actual como hora de inicio. */
export function nuevoBorrador(): BorradorIncidente {
  const ahora = new Date().toISOString();
  return {
    id: nuevoId(),
    tipo: null,
    descripcion: '',
    riesgo: null,
    evidenciaUris: [],
    horaInicio: ahora,
    ubicacionInicio: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

/** Convierte la ubicación de inicio al GeoPoint que espera el envío, con la hora de INICIO. */
export function ubicacionDeBorrador(b: BorradorIncidente): GeoPoint | null {
  if (!b.ubicacionInicio) return null;
  return {
    latitud: b.ubicacionInicio.latitud,
    longitud: b.ubicacionInicio.longitud,
    precision: b.ubicacionInicio.precision,
    timestamp: b.horaInicio,
  };
}

/** true si el borrador tiene algo que valga la pena conservar. */
export function borradorTieneContenido(b: BorradorIncidente): boolean {
  return Boolean(b.tipo || b.riesgo || b.descripcion.trim() || b.evidenciaUris.length > 0);
}

export async function guardarBorrador(b: BorradorIncidente): Promise<void> {
  const actualizado: BorradorIncidente = { ...b, actualizadoEn: new Date().toISOString() };
  await AsyncStorage.setItem(`${PREFIJO}${b.id}`, JSON.stringify(actualizado));
}

export async function eliminarBorrador(id: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PREFIJO}${id}`);
  } catch (e) {
    console.warn('[Borradores] no se pudo eliminar el borrador:', e);
  }
}

/** Borradores guardados, el más reciente primero. Un registro ilegible se ignora. */
export async function listarBorradores(): Promise<BorradorIncidente[]> {
  try {
    const claves = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIJO));
    if (claves.length === 0) return [];
    const pares = await AsyncStorage.multiGet(claves);
    const items: BorradorIncidente[] = [];
    for (const [, crudo] of pares) {
      if (!crudo) continue;
      try {
        const b = JSON.parse(crudo) as BorradorIncidente;
        if (b && typeof b.id === 'string' && Array.isArray(b.evidenciaUris)) items.push(b);
      } catch {
        // borrador ilegible: se ignora
      }
    }
    return items.sort((a, b) => (a.actualizadoEn < b.actualizadoEn ? 1 : -1));
  } catch (e) {
    console.warn('[Borradores] no se pudieron leer los borradores:', e);
    return [];
  }
}

const EXT_VIDEO = ['.mp4', '.mov', '.m4v'];

/** true si la evidencia es un video (por la extensión del archivo). */
export function esUriDeVideo(uri: string): boolean {
  const limpio = uri.split('?')[0].toLowerCase();
  return EXT_VIDEO.some((ext) => limpio.endsWith(ext));
}