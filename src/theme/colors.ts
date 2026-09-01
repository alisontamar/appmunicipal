/**
 * Paleta institucional G.A.M. Cochabamba - Direccion de Seguridad Ciudadana.
 * Valores aproximados del material grafico compartido (ver requerimientos 3.2).
 */
export const colors = {
  // Azules institucionales
  navy900: '#0B1F3A', // headers, navegacion
  navy800: '#0D1B3E',
  navy700: '#13294B', // paneles, tarjetas

  // Acento dorado (escudo, iconos, detalles)
  gold: '#C9A227',
  goldLight: '#D4AF37',

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
