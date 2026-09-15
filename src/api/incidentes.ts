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
  // Detectar si cada evidencia es video o foto para mandarlo con tipo correcto
  // (antes siempre mandaba {url} sin tipo -> backend lo guardaba como 'foto')
  const EXT_VIDEO = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'];
  const esVideo = (uri: string) => EXT_VIDEO.some((ext) => uri.toLowerCase().includes(ext));
  const evidenciasConTipo = await Promise.all(
    data.evidenciaUris.map(async (uri) => {
      const url = await subirEvidencia(uri, 'incidentes');
      return { url, tipo: (esVideo(uri) ? 'video' : 'foto') as 'foto' | 'video' };
    }),
  );
  const evidenciaUrls = evidenciasConTipo.map((e) => e.url);
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
      evidencias: evidenciasConTipo.map((e) => ({ url: e.url, tipo: e.tipo })),
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
