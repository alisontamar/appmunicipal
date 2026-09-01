import { delay } from './client';
import { mockIncidentesHistoricos } from '@/mocks';
import type { GeoPoint, IncidentType, Incidente, RiskLevel } from '@/types';

export interface NuevoIncidente {
  turnoId: string;
  tipo: IncidentType;
  descripcion: string;
  nivelRiesgo: RiskLevel;
  ubicacion: GeoPoint;
  evidenciaUris: string[];
}

/** RF-APP-08 - registrar incidente (robo, asalto, etc.). */
export async function registrarIncidente(data: NuevoIncidente): Promise<Incidente> {
  return delay({
    id: `inc-${Date.now()}`,
    turnoId: data.turnoId,
    tipo: data.tipo,
    descripcion: data.descripcion,
    nivelRiesgo: data.nivelRiesgo,
    ubicacion: data.ubicacion,
    evidenciaUrls: data.evidenciaUris,
    creadoEn: data.ubicacion.timestamp,
    estado: 'reportado',
  });
}

/** RF-APP-09 - historial de incidentes propios. */
export async function listarIncidentes(): Promise<Incidente[]> {
  return delay(mockIncidentesHistoricos);
}
