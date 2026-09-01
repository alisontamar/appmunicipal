/** Modelo de datos de la app movil. Espeja las entidades sugeridas en los requerimientos (3.3). */

export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'muy_alto';

export type ShiftStatus = 'fuera_de_servicio' | 'en_servicio' | 'finalizado';

export interface Guardia {
  id: string;
  nombre: string;
  usuario: string;
  rol: string;
  distrito: string; // Distrito / EPI asignado
  fotoUrl?: string;
}

export interface GeoPoint {
  latitud: number;
  longitud: number;
  timestamp: string; // ISO
}

export type IncidentType =
  | 'robo'
  | 'asalto'
  | 'violencia'
  | 'accidente'
  | 'disturbio'
  | 'otro';

export interface Incidente {
  id: string;
  turnoId: string;
  tipo: IncidentType;
  descripcion: string;
  nivelRiesgo: RiskLevel;
  ubicacion: GeoPoint;
  evidenciaUrls: string[];
  creadoEn: string; // ISO
  estado: 'reportado' | 'en_revision' | 'cerrado';
}

export interface Mandado {
  id: string;
  turnoId: string;
  descripcion: string;
  ubicacion: GeoPoint;
  creadoEn: string; // ISO
}

export interface Turno {
  id: string;
  guardiaId: string;
  estado: ShiftStatus;
  fotoInicioUrl?: string;
  ubicacionInicio?: GeoPoint;
  horaInicio?: string; // ISO
  ubicacionFin?: GeoPoint;
  horaFin?: string; // ISO
  distanciaMetros: number;
  recorrido: GeoPoint[];
  incidentes: Incidente[];
  mandados: Mandado[];
}
