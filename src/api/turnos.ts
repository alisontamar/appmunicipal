import { request, tokenActual } from './client';
import { subirEvidencia } from '@/utils/storage';
import { DEMO_GUARDIA, esSesionDemo } from '@/utils/modoDemo';
import type { GeoPoint, ShiftStatus, Turno } from '@/types';

/** Forma del turno que devuelve el backend. */
interface TurnoDTO {
  id: string;
  guardiaId: string;
  estado: 'en_servicio' | 'finalizado' | 'anulado';
  selfieInicioUrl: string;
  latInicio: number;
  lngInicio: number;
  horaInicio: string;
  latFin: number | null;
  lngFin: number | null;
  horaFin: string | null;
  distanciaMetros: number;
  patrullaId: string | null;
  createdAt: string;
}

function punto(lat: number, lng: number, ts: string): GeoPoint {
  return { latitud: lat, longitud: lng, timestamp: ts };
}

function mapEstado(e: TurnoDTO['estado']): ShiftStatus {
  return e === 'en_servicio' ? 'en_servicio' : 'finalizado';
}

/**
 * El backend no guarda el recorrido/incidentes/mandados dentro del turno (van en
 * tablas aparte). Al mapear dejamos esos arreglos vacíos: durante el turno en
 * curso los llena el ShiftContext en memoria.
 */
function mapTurno(d: TurnoDTO): Turno {
  const inicio = punto(d.latInicio, d.lngInicio, d.horaInicio);
  return {
    id: d.id,
    guardiaId: d.guardiaId,
    estado: mapEstado(d.estado),
    fotoInicioUrl: d.selfieInicioUrl,
    ubicacionInicio: inicio,
    horaInicio: d.horaInicio,
    ubicacionFin:
      d.latFin != null && d.lngFin != null && d.horaFin
        ? punto(d.latFin, d.lngFin, d.horaFin)
        : undefined,
    horaFin: d.horaFin ?? undefined,
    distanciaMetros: d.distanciaMetros ?? 0,
    recorrido: [inicio],
    incidentes: [],
    mandados: [],
    checkpoints: [],
  };
}

/** RF-APP-03 — iniciar servicio: selfie + GPS + hora de inicio. */
export async function iniciarServicio(fotoUri: string, ubicacion: GeoPoint): Promise<Turno> {
  if (esSesionDemo(tokenActual())) {
    return {
      id: `demo-${Date.now()}`,
      guardiaId: DEMO_GUARDIA.id,
      estado: 'en_servicio',
      fotoInicioUrl: fotoUri,
      ubicacionInicio: ubicacion,
      horaInicio: ubicacion.timestamp,
      distanciaMetros: 0,
      recorrido: [ubicacion],
      incidentes: [],
      mandados: [],
      checkpoints: [],
    };
  }
  const selfieUrl = await subirEvidencia(fotoUri, 'selfies');
  const d = await request<TurnoDTO>('/turnos', {
    method: 'POST',
    body: JSON.stringify({
      selfieInicioUrl: selfieUrl,
      lat: ubicacion.latitud,
      lng: ubicacion.longitud,
      horaInicio: ubicacion.timestamp,
    }),
  });
  return mapTurno(d);
}

async function obtenerBateriaPct(): Promise<number | null> {
  try {
    // Intentar leer batería via expo-battery si está disponible; si no, null (no bloquea el envío)
    const Battery: any = await import('expo-battery').catch(() => null);
    if (Battery && Battery.getBatteryLevelAsync) {
      const level = await Battery.getBatteryLevelAsync(); // 0..1
      if (typeof level === 'number' && level >= 0 && level <= 1) return Math.round(level * 100);
    }
  } catch {}
  return null;
}

/** RF-APP-05 — envío periódico de ubicación GPS (va a la tabla de telemetría). */
export async function enviarUbicacion(turnoId: string, p: GeoPoint): Promise<{ ok: boolean }> {
  const bateriaPct = await obtenerBateriaPct();
  await request('/telemetry', {
    method: 'POST',
    body: JSON.stringify({
      turnoId,
      lat: p.latitud,
      lng: p.longitud,
      bateriaPct,
      capturadoEn: p.timestamp,
    }),
  });
  return { ok: true };
}

/** RF-APP-07 — cerrar servicio. El backend calcula la distancia total del turno. */
export async function cerrarServicio(turno: Turno, ubicacionFin: GeoPoint): Promise<Turno> {
  if (esSesionDemo(tokenActual())) {
    return { ...turno, estado: 'finalizado', ubicacionFin, horaFin: ubicacionFin.timestamp };
  }
  const d = await request<TurnoDTO>(`/turnos/${turno.id}/cerrar`, {
    method: 'PATCH',
    body: JSON.stringify({
      lat: ubicacionFin.latitud,
      lng: ubicacionFin.longitud,
      horaFin: ubicacionFin.timestamp,
    }),
  });
  // Conservamos lo acumulado en el dispositivo durante el turno.
  return {
    ...turno,
    estado: 'finalizado',
    ubicacionFin,
    horaFin: d.horaFin ?? ubicacionFin.timestamp,
    distanciaMetros: d.distanciaMetros ?? turno.distanciaMetros,
  };
}

/** RF-APP-09 — historial de turnos propios. */
export async function listarTurnos(): Promise<Turno[]> {
  const d = await request<TurnoDTO[]>('/turnos?guardia=me');
  return d.map(mapTurno);
}

export async function obtenerTurno(id: string): Promise<Turno | undefined> {
  const todos = await listarTurnos();
  return todos.find((t) => t.id === id);
}

export interface RecorridoTurno {
  turnoId: string | null;
  guardiaId: string;
  total: number;
  distanciaMetros: number | null;
  puntos: GeoPoint[]; // orden ascendente por capturadoEn
}

interface RecorridoDTO {
  turnoId: string | null;
  guardiaId: string;
  total: number;
  distanciaMetros: number | null;
  puntos: { lat: number; lng: number; capturadoEn: string; esSos: boolean }[];
}

/** Recorrido real (breadcrumb GPS) que quedó guardado del turno. */
export async function obtenerRecorrido(turnoId: string): Promise<RecorridoTurno> {
  const d = await request<RecorridoDTO>(`/turnos/${turnoId}/recorrido`);
  return {
    turnoId: d.turnoId,
    guardiaId: d.guardiaId,
    total: d.total,
    distanciaMetros: d.distanciaMetros,
    puntos: d.puntos.map((p) => ({ latitud: p.lat, longitud: p.lng, timestamp: p.capturadoEn })),
  };
}
