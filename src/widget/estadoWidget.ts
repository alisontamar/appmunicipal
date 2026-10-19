import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lo mínimo que el widget necesita saber, guardado en AsyncStorage: el widget
 * corre en una tarea "headless" sin React montado, así que no puede leer el
 * ShiftContext. ShiftContext lo escribe cada vez que el turno cambia.
 */
export interface EstadoWidget {
  enServicio: boolean;
  turnoId: string | null;
}

const CLAVE_ESTADO = 'gamc:widget_estado';
const CLAVE_ULTIMO_SOS = 'gamc:widget_ultimo_sos';

export async function guardarEstadoWidget(estado: EstadoWidget): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado));
  } catch (e) {
    console.warn('[Widget] no se pudo guardar el estado:', e);
  }
}

export async function leerEstadoWidget(): Promise<EstadoWidget> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE_ESTADO);
    if (raw) return JSON.parse(raw) as EstadoWidget;
  } catch {
    // se asume fuera de servicio
  }
  return { enServicio: false, turnoId: null };
}

/** Marca de tiempo del último SOS enviado desde el widget (anti doble toque). */
export async function leerUltimoSosWidget(): Promise<number> {
  try {
    return Number(await AsyncStorage.getItem(CLAVE_ULTIMO_SOS)) || 0;
  } catch {
    return 0;
  }
}

export async function guardarUltimoSosWidget(ms: number): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_ULTIMO_SOS, String(ms));
  } catch {
    // no crítico
  }
}
