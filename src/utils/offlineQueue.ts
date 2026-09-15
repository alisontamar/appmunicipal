import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CLAVE_COLA = 'gamc:cola_pendientes';

export type TipoPendiente = 'incidente' | 'mandado' | 'checkpoint' | 'ubicacion' | 'sos';

export interface ItemPendiente {
  id: string;
  tipo: TipoPendiente;
  payload: unknown;
  creadoEn: string; // ISO
}

/** true si el celular tiene conexion a internet en este instante. */
export async function hayConexion(): Promise<boolean> {
  try {
    const estado = await NetInfo.fetch();
    // En algunos Android isInternetReachable llega null (no confirmado) aunque sí hay internet.
    // Antes exigía isInternetReachable !== false y dejaba encolado todo 5 minutos hasta que el
    // listener de NetInfo disparara de nuevo. Ahora basta con isConnected.
    if (estado.isConnected) return true;
    return Boolean(estado.isConnected && estado.isInternetReachable !== false);
  } catch {
    return true; // Si NetInfo falla, intentar enviar de todos modos y que el catch encole
  }
}

async function leerCola(): Promise<ItemPendiente[]> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_COLA);
    return crudo ? (JSON.parse(crudo) as ItemPendiente[]) : [];
  } catch (e) {
    console.warn('[Offline] no se pudo leer la cola, se asume vacia:', e);
    return [];
  }
}

async function guardarCola(items: ItemPendiente[]): Promise<void> {
  await AsyncStorage.setItem(CLAVE_COLA, JSON.stringify(items));
}

/** Agrega un item a la cola de pendientes y devuelve el item guardado. */
export async function encolar(tipo: TipoPendiente, payload: unknown): Promise<ItemPendiente> {
  const item: ItemPendiente = {
    id: `pend-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    tipo,
    payload,
    creadoEn: new Date().toISOString(),
  };
  const cola = await leerCola();
  await guardarCola([...cola, item]);
  return item;
}

export async function listarPendientes(): Promise<ItemPendiente[]> {
  return leerCola();
}

export async function quitarDeCola(id: string): Promise<void> {
  const cola = await leerCola();
  await guardarCola(cola.filter((i) => i.id !== id));
}

/**
 * Intenta enviar cada item pendiente usando la funcion real correspondiente
 * a su tipo. Si un item se envia bien, se saca de la cola; si vuelve a
 * fallar, se deja ahi para el proximo intento.
 */
export async function sincronizarPendientes(
  reintentar: (item: ItemPendiente) => Promise<void>,
): Promise<{ enviados: number; restantes: number }> {
  const cola = await leerCola();
  let enviados = 0;

  for (const item of cola) {
    try {
      await reintentar(item);
      await quitarDeCola(item.id);
      enviados += 1;
    } catch (e) {
      console.warn(`[Offline] sigue pendiente (${item.tipo}):`, e);
    }
  }

  const restantes = (await leerCola()).length;
  return { enviados, restantes };
}