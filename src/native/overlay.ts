import { NativeModules, Platform } from 'react-native';

/** Métodos del módulo nativo GamcOverlay (native-overlay/GamcOverlayModule.kt). */
interface GamcOverlayNativo {
  canDrawOverlays(): Promise<boolean>;
  openOverlaySettings(): void;
  setSession(token: string, baseUrl: string, turnoId: string): void;
  clearSession(): void;
  start(): Promise<boolean>;
  stop(): void;
  ultimoSosWidget(): Promise<number>;
}

// Solo existe en Android con el build nativo (no en Expo Go ni en iOS).
const nativo: GamcOverlayNativo | undefined =
  Platform.OS === 'android' ? (NativeModules as { GamcOverlay?: GamcOverlayNativo }).GamcOverlay : undefined;

export const widgetDisponible = Boolean(nativo);

export async function puedeDibujarSobreApps(): Promise<boolean> {
  if (!nativo) return false;
  try {
    return await nativo.canDrawOverlays();
  } catch {
    return false;
  }
}

export function abrirAjustesSuperposicion(): void {
  try {
    nativo?.openOverlaySettings();
  } catch {}
}

export function guardarSesionWidget(token: string, baseUrl: string, turnoId: string): void {
  try {
    nativo?.setSession(token, baseUrl, turnoId);
  } catch {}
}

export function limpiarSesionWidget(): void {
  try {
    nativo?.clearSession();
  } catch {}
}

export async function iniciarWidget(): Promise<boolean> {
  if (!nativo) return false;
  try {
    return await nativo.start();
  } catch {
    return false;
  }
}

export function detenerWidget(): void {
  try {
    nativo?.stop();
  } catch {}
}

/** Hora (ms) del último SOS que mandó el widget; 0 si no hubo ninguno. */
export async function leerUltimoSosWidget(): Promise<number> {
  if (!nativo) return 0;
  try {
    return await nativo.ultimoSosWidget();
  } catch {
    return 0;
  }
}
