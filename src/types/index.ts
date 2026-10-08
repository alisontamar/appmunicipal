/** Modelo de datos de la app movil. Espeja las entidades sugeridas en los requerimientos (3.3). */

export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'muy_alto';

export type ShiftStatus = 'fuera_de_servicio' | 'en_servicio' | 'finalizado';

export type GuardiaEstado = 'pendiente_activacion' | 'activo' | 'inactivo' | 'suspendido';

export type EstadoOperativo = 'fuera_de_servicio' | 'en_servicio' | 'emergencia';

export interface Guardia {
  id: string;
  nombre: string;
  usuario: string;
  rol: string;
  distrito: string; // Distrito / EPI asignado (viene de epiNombre)
  fotoUrl?: string;
  // Campos que aporta el backend (opcionales para no romper los mocks).
  ci?: string;
  telefono?: string;
  estado?: GuardiaEstado;
  estadoOperativo?: EstadoOperativo;
  debeCambiarPassword?: boolean;
  epiId?: string;
  epiCodigo?: string;
  epiNombre?: string;
}

export interface GeoPoint {
  latitud: number;
  longitud: number;
  timestamp: string; // ISO
  /** Precisión horizontal que reporta el GPS, en metros (opcional). */
  precision?: number;
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

// Verificacion periodica de identidad/ubicacion durante el turno (checkpoint).
// "perdido" = paso el tiempo de gracia y el guardia no respondio; queda sin
// fotoUri/ubicacion porque nunca se llego a capturar.
export interface Checkpoint {
  id: string;
  turnoId: string;
  estado: 'realizado' | 'perdido';
  fotoUri?: string;
  ubicacion?: GeoPoint;
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
  checkpoints: Checkpoint[];
}