/**
 * Paleta G.A.M. Cochabamba - Direccion de Seguridad Ciudadana.
 * Morado + rosa, en la linea visual de las apps de la alcaldia (Innova Cochabamba),
 * conservando el escudo institucional.
 *
 * Nota: las claves `navy*` y `gold*` se conservan por compatibilidad con el codigo
 * existente, pero ahora son tonos de morado (navy) y rosa de acento (gold).
 */
export const colors = {
  // Morado institucional
  brand: '#6B559F', // header, barra de estado
  navy900: '#4D3B86', // botones primarios, tab bar, textos de titulo, camara
  navy800: '#5A4794',
  navy700: '#6B559F', // paneles, tarjetas sobre fondo oscuro

  // Acento rosa (la "V" de Innova)
  gold: '#E8567F',
  goldLight: '#F28BA6',

  // Tintes claros del morado (circulos de iconos, chips)
  lilac: '#EFEAF8',
  lilacStrong: '#E1D9F2',

  // Texto sobre fondo oscuro
  white: '#FFFFFF',
  grayLight: '#E5E7EB',

  // Fondo claro de pantallas
  background: '#F5F2FA',
  surface: '#FFFFFF',
  border: '#DDD6EC',
  textPrimary: '#1F1A2E',
  textSecondary: '#6B6880',

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
