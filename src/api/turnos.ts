import { delay } from './client';
import { mockTurnosHistoricos } from '@/mocks';
import type { GeoPoint, Turno } from '@/types';

/** RF-APP-03 - iniciar servicio: foto + GPS + hora de inicio. */
export async function iniciarServicio(_fotoUri: string, _ubicacion: GeoPoint): Promise<Turno> {
  return delay({
    id: `t-${Date.now()}`,
    guardiaId: 'g-001',
    estado: 'en_servicio',
    fotoInicioUrl: _fotoUri,
    ubicacionInicio: _ubicacion,
    horaInicio: _ubicacion.timestamp,
    distanciaMetros: 0,
    recorrido: [_ubicacion],
    incidentes: [],
    mandados: [],
  });
}

/** RF-APP-05 - envio periodico de ubicacion GPS durante el servicio. */
export async function enviarUbicacion(_turnoId: string, _punto: GeoPoint): Promise<{ ok: boolean }> {
  return delay({ ok: true }, 200);
}

/** RF-APP-07 - cerrar servicio: ubicacion + hora de cierre. */
export async function cerrarServicio(turno: Turno, ubicacionFin: GeoPoint): Promise<Turno> {
  return delay({
    ...turno,
    estado: 'finalizado',
    ubicacionFin,
    horaFin: ubicacionFin.timestamp,
  });
}

/** RF-APP-09 - historial de turnos propios. */
export async function listarTurnos(): Promise<Turno[]> {
  return delay(mockTurnosHistoricos);
}

export async function obtenerTurno(id: string): Promise<Turno | undefined> {
  return delay(mockTurnosHistoricos.find((t) => t.id === id));
}
