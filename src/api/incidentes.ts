import { request } from './client';
import { subirEvidencia } from '@/utils/storage';
import type { GeoPoint, IncidentType, Incidente, RiskLevel } from '@/types';

export interface NuevoIncidente {
  turnoId: string;
  tipo: IncidentType;
  descripcion: string;
  nivelRiesgo: RiskLevel;
  ubicacion: GeoPoint;
  evidenciaUris: string[];
}

/** `hecho` como lo devuelve el backend. */
interface HechoDTO {
  id: string;
  tipoHecho: string;
  tipoLabel: string;
  descripcion: string;
  nivelRiesgo: RiskLevel;
  lat: number;
  lng: number;
  direccion: string | null;
  ocurridoEn: string;
  reportadoEn: string;
  estado: 'reportado' | 'en_revision' | 'cerrado';
  epiId: string | null;
  epiCodigo: string | null;
  epiNombre: string | null;
  guardiaId: string;
  guardiaNombre: string;
  turnoId?: string | null;
  evidencias?: { id: string; url: string; tipo: string }[];
}

function mapIncidente(d: HechoDTO, origen?: NuevoIncidente): Incidente {
  return {
    id: d.id,
    turnoId: d.turnoId ?? origen?.turnoId ?? '',
    tipo: d.tipoHecho as IncidentType,
    descripcion: d.descripcion,
    nivelRiesgo: d.nivelRiesgo,
    ubicacion: { latitud: d.lat, longitud: d.lng, timestamp: d.ocurridoEn },
    evidenciaUrls: d.evidencias?.map((e) => e.url) ?? origen?.evidenciaUris ?? [],
    creadoEn: d.reportadoEn,
    estado: d.estado,
  };
}

/** RF-APP-08 — registrar incidente (robo, asalto, etc.). */
export async function registrarIncidente(data: NuevoIncidente): Promise<Incidente> {
  const evidenciaUrls = await Promise.all(
    data.evidenciaUris.map((uri) => subirEvidencia(uri, 'incidentes')),
  );
  // Si el backend no devuelve `evidencias` en la respuesta, mapIncidente hace
  // fallback a `origen.evidenciaUris` — debe ser la URL ya subida, no la ruta local.
  const origen: NuevoIncidente = { ...data, evidenciaUris: evidenciaUrls };
  const d = await request<HechoDTO>('/hechos', {
    method: 'POST',
    body: JSON.stringify({
      tipoCodigo: data.tipo,
      descripcion: data.descripcion,
      nivelRiesgo: data.nivelRiesgo,
      lat: data.ubicacion.latitud,
      lng: data.ubicacion.longitud,
      ocurridoEn: data.ubicacion.timestamp,
      turnoId: data.turnoId || undefined,
      evidencias: evidenciaUrls.map((url) => ({ url })),
    }),
  });
  return mapIncidente(d, origen);
}

/** RF-APP-09 — historial de incidentes propios. */
export async function listarIncidentes(): Promise<Incidente[]> {
  const d = await request<HechoDTO[]>('/hechos?guardia=me');
  return d.map((h) => mapIncidente(h));
}

export interface TipoHecho {
  id: string;
  codigo: string;
  label: string;
}

/** Catálogo de tipos de hecho administrado desde la web (para el formulario). */
export async function listarTiposHecho(): Promise<TipoHecho[]> {
  return request<TipoHecho[]>('/hechos/tipos');
}
