/**
 * Paleta institucional G.A.M. Cochabamba - Direccion de Seguridad Ciudadana.
 * Colores tomados del escudo oficial (assets/escudo.webp): negro cálido + dorado
 * bronce. Reemplaza el azul/amarillo anterior.
 *
 * Nota: las claves `navy*` se conservan por compatibilidad con el código
 * existente, pero ahora son tonos de negro cálido, no azules.
 */
export const colors = {
  // Negro cálido institucional (fondo del escudo)
  navy900: '#1C1A19', // headers, navegacion, splash, login
  navy800: '#262220',
  navy700: '#332E2A', // paneles, tarjetas sobre fondo oscuro

  // Acento dorado bronce (linework del escudo, iconos, detalles)
  gold: '#C0906C',
  goldLight: '#D4AF8F',

  // Texto sobre fondo oscuro
  white: '#FFFFFF',
  grayLight: '#E5E7EB',

  // Fondo claro de pantallas
  background: '#F3F4F6',
  surface: '#FFFFFF',
  border: '#D1D5DB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',

  // Semaforo de niveles de riesgo
  riskVeryHigh: '#E53935',
  riskHigh: '#FB8C00',
  riskMedium: '#FDD835',
  riskLow: '#43A047',

  // Estado del turno
  onDuty: '#2E7D32',
  offDuty: '#6B7280',

  danger: '#E53935',
  transparent: 'transparent',
} as const;

export type ColorName = keyof typeof colors;
