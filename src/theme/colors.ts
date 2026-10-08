/**
 * Paleta G.A.M. Cochabamba - Direccion de Seguridad Ciudadana.
 * Tonos del escudo institucional: negro carbon + dorado arena.
 *
 * Nota: las claves `navy*` y `gold*` se conservan por compatibilidad con el codigo
 * existente: `navy*` son los tonos oscuros (carbon) y `gold*` el dorado de acento.
 */
export const colors = {
  // Carbon del escudo
  brand: '#1C1B1A', // header, barra de estado
  navy900: '#141312', // botones primarios, tab bar, textos de titulo, camara
  navy800: '#24221F',
  navy700: '#33302C', // paneles, tarjetas sobre fondo oscuro

  // Dorado arena del escudo (acento)
  gold: '#BF9466',
  goldLight: '#D9BC94',

  // Tintes claros del dorado (circulos de iconos, chips)
  lilac: '#F4EDE2',
  lilacStrong: '#E9DAC4',

  // Texto sobre fondo oscuro
  white: '#FFFFFF',
  grayLight: '#E5E7EB',

  // Fondo claro de pantallas
  background: '#F7F4EF',
  surface: '#FFFFFF',
  border: '#E0D7CA',
  textPrimary: '#1B1917',
  textSecondary: '#6F685F',

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
