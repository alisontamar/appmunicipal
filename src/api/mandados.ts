import { request } from './client';
import type { GeoPoint, Mandado } from '@/types';

interface MandadoDTO {
  id: string;
  turnoId: string | null;
  guardiaId: string;
  descripcion: string;
  lat: number;
  lng: number;
  creadoEn: string;
}

function mapMandado(d: MandadoDTO): Mandado {
  return {
    id: d.id,
    turnoId: d.turnoId ?? '',
    descripcion: d.descripcion,
    ubicacion: { latitud: d.lat, longitud: d.lng, timestamp: d.creadoEn },
    creadoEn: d.creadoEn,
  };
}

/** RF-APP-06 — registrar mandado / comisión puntual del turno. */
export async function registrarMandado(
  turnoId: string,
  descripcion: string,
  ubicacion: GeoPoint,
): Promise<Mandado> {
  const d = await request<MandadoDTO>('/mandados', {
    method: 'POST',
    body: JSON.stringify({
      turnoId: turnoId || undefined,
      descripcion,
      lat: ubicacion.latitud,
      lng: ubicacion.longitud,
    }),
  });
  return mapMandado(d);
}

export async function listarMandados(): Promise<Mandado[]> {
  const d = await request<MandadoDTO[]>('/mandados?guardia=me');
  return d.map(mapMandado);
}
