import type { Guardia } from '@/types';

/**
 * Modo demo: para probar la app sin backend.
 *
 * Solo se activa en desarrollo (`__DEV__`) y con EXPO_PUBLIC_MODO_DEMO=true en el
 * .env. Los builds de producción tienen `__DEV__` en false, así que nunca entran
 * en modo demo aunque el .env tenga la variable.
 *
 * Credenciales de prueba: usuario `demo`, contraseña `demo123`.
 */
export const MODO_DEMO = __DEV__ && process.env.EXPO_PUBLIC_MODO_DEMO === 'true';

export const DEMO_USUARIO = 'demo';
export const DEMO_PASSWORD = 'demo123';
export const DEMO_TOKEN = 'demo-token';

export const DEMO_GUARDIA: Guardia = {
  id: 'demo-guardia-001',
  nombre: 'Guardia de Prueba',
  usuario: DEMO_USUARIO,
  rol: 'Guardia Municipal',
  distrito: 'Distrito de prueba',
};

/** true si la sesión activa es la de demo (no hay servidor detrás). */
export function esSesionDemo(token: string | null): boolean {
  return MODO_DEMO && token === DEMO_TOKEN;
}
