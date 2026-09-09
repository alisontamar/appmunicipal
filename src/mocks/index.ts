import type { Guardia, Incidente, Mandado, Turno } from '@/types';

export const mockGuardia: Guardia = {
  id: 'g-001',
  nombre: 'Juan Pérez Mamani',
  usuario: 'jperez',
  rol: 'Guardia Municipal',
  distrito: 'Distrito 10 - EPI Sur',
};

// Coordenadas de referencia: plaza 14 de Septiembre, Cochabamba.
const BASE_LAT = -17.3935;
const BASE_LNG = -66.157;

function point(dLat: number, dLng: number, minutesAgo: number) {
  return {
    latitud: BASE_LAT + dLat,
    longitud: BASE_LNG + dLng,
    timestamp: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

export const mockIncidentesHistoricos: Incidente[] = [
  {
    id: 'inc-101',
    turnoId: 't-900',
    tipo: 'robo',
    descripcion: 'Robo de celular a transeúnte sobre la Av. Heroínas. Sospechoso se dio a la fuga.',
    nivelRiesgo: 'alto',
    ubicacion: point(0.002, -0.003, 60 * 20),
    evidenciaUrls: [],
    creadoEn: new Date(Date.now() - 20 * 3600_000).toISOString(),
    estado: 'en_revision',
  },
  {
    id: 'inc-102',
    turnoId: 't-901',
    tipo: 'disturbio',
    descripcion: 'Riña entre personas en estado de ebriedad cerca del mercado.',
    nivelRiesgo: 'medio',
    ubicacion: point(-0.004, 0.001, 60 * 40),
    evidenciaUrls: [],
    creadoEn: new Date(Date.now() - 40 * 3600_000).toISOString(),
    estado: 'cerrado',
  },
];

export const mockMandadosHistoricos: Mandado[] = [
  {
    id: 'man-201',
    turnoId: 't-900',
    descripcion: 'Entrega de notificación en oficina distrital.',
    ubicacion: point(0.001, 0.002, 60 * 22),
    creadoEn: new Date(Date.now() - 22 * 3600_000).toISOString(),
  },
];

export const mockTurnosHistoricos: Turno[] = [
  {
    id: 't-901',
    guardiaId: 'g-001',
    estado: 'finalizado',
    fotoInicioUrl: undefined,
    ubicacionInicio: point(0, 0, 60 * 48),
    horaInicio: new Date(Date.now() - 48 * 3600_000).toISOString(),
    ubicacionFin: point(0.006, 0.004, 60 * 40),
    horaFin: new Date(Date.now() - 40 * 3600_000).toISOString(),
    distanciaMetros: 5230,
    recorrido: [
      point(0, 0, 60 * 48),
      point(0.002, 0.001, 60 * 46),
      point(0.004, 0.002, 60 * 43),
      point(0.006, 0.004, 60 * 40),
    ],
    incidentes: [mockIncidentesHistoricos[1]],
    mandados: [],
    checkpoints: [],
  },
  {
    id: 't-900',
    guardiaId: 'g-001',
    estado: 'finalizado',
    ubicacionInicio: point(0, 0, 60 * 26),
    horaInicio: new Date(Date.now() - 26 * 3600_000).toISOString(),
    ubicacionFin: point(-0.003, 0.005, 60 * 18),
    horaFin: new Date(Date.now() - 18 * 3600_000).toISOString(),
    distanciaMetros: 6840,
    recorrido: [
      point(0, 0, 60 * 26),
      point(-0.001, 0.002, 60 * 24),
      point(-0.002, 0.004, 60 * 21),
      point(-0.003, 0.005, 60 * 18),
    ],
    incidentes: [mockIncidentesHistoricos[0]],
    mandados: [mockMandadosHistoricos[0]],
    checkpoints: [],
  },
];

/** Ruta / zona asignada al guardia para el turno (RF-APP-10). */
export const mockZonaAsignada: { latitud: number; longitud: number }[] = [
  { latitud: BASE_LAT + 0.004, longitud: BASE_LNG - 0.004 },
  { latitud: BASE_LAT + 0.004, longitud: BASE_LNG + 0.004 },
  { latitud: BASE_LAT - 0.004, longitud: BASE_LNG + 0.004 },
  { latitud: BASE_LAT - 0.004, longitud: BASE_LNG - 0.004 },
];

export const mockUbicacionActual = { latitud: BASE_LAT, longitud: BASE_LNG };
