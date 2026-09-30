import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

/**
 * Cola de pendientes — una clave de AsyncStorage POR ITEM.
 *
 * Antes esto era un único array en `gamc:cola_pendientes` y cada operación lo
 * reescribía entero (leer -> modificar -> escribir). Con dos escritores en
 * paralelo eso pierde datos: el `ubicacion` que encola el GPS en background
 * y el `quitarDeCola` del sincronizador se pisan, y el guardia perdía
 * incidentes que nunca se habían enviado.
 *
 * Ahora cada item tiene su propia clave y las escrituras no leen nada, así que
 * dos escritores no pueden pisarse. `ubicacion` usa clave DETERMINISTA por turno
 * (`gamc:pend:ub:<turnoId>`): el `setItem` sobrescribe al punto anterior, sin
 * borrar nada, y nunca comparte clave con un incidente.
 *
 * Principio: nada se descarta. Un item sale de la cola únicamente cuando el
 * servidor confirma. Un item que falla se reintenta con backoff indefinido y
 * queda visible para el guardia.
 */

const PREFIJO = 'gamc:pend:';
const PREFIJO_UB = 'ub:';
const CLAVE_LEGACY = 'gamc:cola_pendientes';
const PREFIJO_CORRUPTO = 'gamc:cola_corrupta:';

/**
 * Espera acotada para reportar los numeros de la tanda. Con senal normal todo
 * resuelve en milisegundos, asi que alcanza de sobra; el techo existe solo para
 * que un cuelgue no retenga el candado de la tanda.
 */
const ESPERA_TANDA_MS = 5_000;

/**
 * Backoff por intentos: 15s, 30s, 1m, 5m y luego 15m. El tope NO abandona el
 * item — evita quemar batería reintentando cada 30s, pero el registro se
 * sigue reintentando indefinidamente.
 */
const BACKOFF_MS = [15_000, 30_000, 60_000, 300_000, 900_000];

export type TipoPendiente = 'incidente' | 'mandado' | 'checkpoint' | 'ubicacion' | 'sos';

export interface ItemPendiente {
  id: string;
  tipo: TipoPendiente;
  payload: unknown;
  creadoEn: string; // ISO
  intentos?: number;
  ultimoIntentoEn?: string; // ISO
  ultimoError?: string;
}

function claveDe(id: string): string {
  return `${PREFIJO}${id}`;
}

function backoffMs(intentos: number): number {
  return BACKOFF_MS[Math.min(Math.max(intentos, 0), BACKOFF_MS.length - 1)];
}

function turnoIdDe(payload: unknown): string | null {
  const p = payload as { turnoId?: unknown } | null;
  return typeof p?.turnoId === 'string' && p.turnoId ? p.turnoId : null;
}

function mensajeDe(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === 'string' ? e : 'Error desconocido';
}

/** Conserva un valor ilegible en vez de descartarlo en silencio. */
async function preservarComoCorrupto(clave: string, crudo: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PREFIJO_CORRUPTO}${Date.now()}`, crudo);
    console.warn(`[Offline] item ilegible preservado en ${PREFIJO_CORRUPTO}* (clave ${clave})`);
  } catch {
    console.warn(`[Offline] no se pudo preservar el item ilegible ${clave}`);
  }
}

/**
 * Migra el formato viejo (un array) al de clave-por-item. Idempotente: los ids
 * originales se respetan, así que re-ejecutarla sobrescribe claves iguales sin
 * duplicar nada. Se borra la clave vieja SOLO después de escribir todos los
 * items, para que un cierre a mitad de camino no pierda nada.
 */
let migracion: Promise<void> | null = null;
export function migrarColaLegacy(): Promise<void> {
  // Se memoiza la PROMESA (no un booleano): si la UI y un sync la piden a la
  // vez, el segundo espera a que la primera termine de repartir los items en vez
  // de leer la cola medio migrada.
  migracion ??= migrarColaLegacyUnaVez();
  return migracion;
}

async function migrarColaLegacyUnaVez(): Promise<void> {
  let crudo: string | null;
  try {
    crudo = await AsyncStorage.getItem(CLAVE_LEGACY);
  } catch {
    return;
  }
  if (!crudo) return;

  let items: unknown;
  try {
    items = JSON.parse(crudo);
    if (!Array.isArray(items)) throw new Error('no es un array');
  } catch (e) {
    console.warn('[Offline] la cola vieja está corrupta; se preserva íntegra para revisar:', e);
    await preservarComoCorrupto(CLAVE_LEGACY, crudo);
    await AsyncStorage.removeItem(CLAVE_LEGACY);
    return;
  }

  let migrados = 0;
  for (const raw of items as Partial<ItemPendiente>[]) {
    if (!raw || typeof raw.id !== 'string' || typeof raw.tipo !== 'string') continue;
    // Los `ubicacion` viejos reciben la clave determinista: al escribirse en
    // orden, el último punto gana y los anteriores se colapsan solos.
    const id = raw.tipo === 'ubicacion' ? `${PREFIJO_UB}${turnoIdDe(raw.payload) ?? raw.id}` : raw.id;
    const item: ItemPendiente = {
      id,
      tipo: raw.tipo,
      payload: raw.payload ?? null,
      creadoEn: typeof raw.creadoEn === 'string' ? raw.creadoEn : new Date().toISOString(),
      intentos: typeof raw.intentos === 'number' ? raw.intentos : 0,
      ultimoIntentoEn: raw.ultimoIntentoEn,
      ultimoError: raw.ultimoError,
    };
    try {
      await AsyncStorage.setItem(claveDe(id), JSON.stringify(item));
      migrados += 1;
    } catch (e) {
      console.warn('[Offline] no se pudo migrar un item de la cola vieja:', e);
    }
  }

  await AsyncStorage.removeItem(CLAVE_LEGACY);
  console.log(`[Offline] cola vieja migrada: ${migrados} item(s) a clave-por-item`);
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

// El id debe ser único DE VERDAD, no "probablemente único": dos registros que
// colisionen comparten clave y uno pisa al otro en silencio, que es exactamente
// la perdida de datos que esta cola viene a evitar. Con `Date.now()` solo mas
// un random de 1000 valores, encolar muchos registros en el mismo milisegundo
// (el guardia y el GPS de fondo a la vez) colisionaba de forma habitual.
// El contador cubre dentro de un runtime; el sufijo aleatorio cubre el cruce
// entre el runtime de la UI y el de `backgroundLocationTask`.
let secuencia = 0;
function nuevoIdPendiente(): string {
  secuencia = (secuencia + 1) % 1_000_000;
  return `pend-${Date.now().toString(36)}-${secuencia.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Agrega un item a la cola de pendientes y devuelve el item guardado. */
export async function encolar(tipo: TipoPendiente, payload: unknown): Promise<ItemPendiente> {
  const turnoId = tipo === 'ubicacion' ? turnoIdDe(payload) : null;
  const item: ItemPendiente = {
    // Clave determinista para ubicacion: el `setItem` de abajo pisa el punto
    // anterior del mismo turno en vez de acumularlo.
    id: turnoId ? `${PREFIJO_UB}${turnoId}` : nuevoIdPendiente(),
    tipo,
    payload,
    creadoEn: new Date().toISOString(),
    intentos: 0,
  };
  await AsyncStorage.setItem(claveDe(item.id), JSON.stringify(item));
  return item;
}

/** Lee la cola completa. Un item ilegible se aparta; el resto sigue disponible. */
export async function listarPendientes(): Promise<ItemPendiente[]> {
  await migrarColaLegacy();

  let claves: readonly string[];
  try {
    claves = await AsyncStorage.getAllKeys();
  } catch (e) {
    console.warn('[Offline] no se pudieron listar las claves de la cola:', e);
    return [];
  }
  const propias = claves.filter((k) => k.startsWith(PREFIJO));
  if (propias.length === 0) return [];

  let pares: readonly (readonly [string, string | null])[];
  try {
    pares = await AsyncStorage.multiGet(propias);
  } catch (e) {
    console.warn('[Offline] no se pudo leer la cola:', e);
    return [];
  }

  const items: ItemPendiente[] = [];
  for (const [clave, crudo] of pares) {
    if (!crudo) continue;
    let item: ItemPendiente;
    try {
      item = JSON.parse(crudo) as ItemPendiente;
      if (!item || typeof item.id !== 'string' || typeof item.tipo !== 'string') {
        throw new Error('item incompleto');
      }
    } catch {
      // Antes esto devolvía `[]` y el siguiente encolar pisaba toda la cola con
      // un solo elemento. Ahora solo se pierde ESTE item.
      await preservarComoCorrupto(clave, crudo);
      await AsyncStorage.removeItem(clave);
      continue;
    }
    items.push(item);
  }

  return items.sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : a.creadoEn > b.creadoEn ? 1 : 0));
}

export async function quitarDeCola(id: string): Promise<void> {
  await AsyncStorage.removeItem(claveDe(id));
}

function esperandoBackoff(item: ItemPendiente, ahora: number): boolean {
  if (!item.ultimoIntentoEn) return false;
  const ultima = Date.parse(item.ultimoIntentoEn);
  if (Number.isNaN(ultima)) return false;
  return ahora - ultima < backoffMs(item.intentos ?? 0);
}

/** Marca el fallo sin sacar el item de la cola: sigue esperando ser enviado. */
async function marcarFallo(item: ItemPendiente, error: unknown): Promise<void> {
  // `ubicacion` es desechable y se reescribe sola con el siguiente punto del
  // GPS, asi que se descarta en vez de hacer un read-modify-write que podria
  // pisar un punto mas nuevo.
  if (item.tipo === 'ubicacion') {
    await quitarDeCola(item.id);
    return;
  }
  const actualizado: ItemPendiente = {
    ...item,
    intentos: (item.intentos ?? 0) + 1,
    ultimoIntentoEn: new Date().toISOString(),
    ultimoError: mensajeDe(error),
  };
  try {
    await AsyncStorage.setItem(claveDe(item.id), JSON.stringify(actualizado));
  } catch (e) {
    console.warn(`[Offline] no se pudo registrar el fallo de ${item.id}:`, e);
  }
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sincronizaciones en curso, por item, para no solapar ni duplicar envíos. */
/** Sincronizaciones en curso, por item, para no solapar ni duplicar envíos. */
const enVuelo = new Map<string, { intento: Promise<unknown>; desde: number }>();

/**
 * Si una peticion quedo colgada mas de esto, se la considera muerta y el item
 * vuelve a ser reintentable. Sin este techo, un item colgado para siempre
 * (un `fetch` que nunca resuelve) nunca volveria a intentarse y se quedaria en
 * la cola sin salida.
 */
const EN_VUELO_MAX_MS = 60_000;

let tandaEnCurso: Promise<{ enviados: number; restantes: number }> | null = null;

export interface OpcionesSync {
  /** Ignora el backoff (reintento manual desde Perfil). */
  forzar?: boolean;
}

/** true si este item ya tiene un intento vivo (y que no sea uno colgado). */
function yaEstaEnVuelo(id: string): boolean {
  const e = enVuelo.get(id);
  if (!e) return false;
  if (Date.now() - e.desde > EN_VUELO_MAX_MS) {
    enVuelo.delete(id);
    return false;
  }
  return true;
}

/**
 * Intenta enviar cada item pendiente usando la funcion real correspondiente
 * a su tipo. Un item sale de la cola SOLO con confirmacion del servidor; si
 * falla, queda con su contador de intentos y se reintenta con backoff.
 *
 * El bucle NO espera item por item: lanza todos los que no estan en vuelo y
 * vuelve. Asi un item colgado (wifi asociada sin internet, donde `fetch` se
 * queda esperando) no bloquea a los que vienen detras. El candado de tanda dura
 * lo mismo que el despacho, no hasta que terminen las peticiones: si no, un
 * cuelgue frenaria la cola entera justo lo que se vino a arreglar.
 *
 * Un item ya enviado en vuelo no se vuelve a lanzar (para no crear duplicados);
 * si el intento anterior se cuelga mas de EN_VUELO_MAX_MS se lo considera
 * muerto y vuelve a ser reintentable.
 */
export function sincronizarPendientes(
  reintentar: (item: ItemPendiente) => Promise<void>,
  opciones: OpcionesSync = {},
): Promise<{ enviados: number; restantes: number }> {
  if (tandaEnCurso) return tandaEnCurso;
  tandaEnCurso = ejecutarTanda(reintentar, opciones).finally(() => {
    tandaEnCurso = null;
  });
  return tandaEnCurso;
}

async function ejecutarTanda(
  reintentar: (item: ItemPendiente) => Promise<void>,
  opciones: OpcionesSync,
): Promise<{ enviados: number; restantes: number }> {
  await migrarColaLegacy();
  const cola = await listarPendientes();
  const ahora = Date.now();

  const lanzados: Promise<unknown>[] = [];
  let enviados = 0;

  for (const item of cola) {
    if (yaEstaEnVuelo(item.id)) continue; // ya hay un intento vivo de este item
    if (!opciones.forzar && esperandoBackoff(item, ahora)) continue;

    const intento = (async () => reintentar(item))();
    enVuelo.set(item.id, { intento, desde: Date.now() });
    lanzados.push(intento);

    // El desenlace se resuelve en su propia cadena, sin depender del timeout:
    // si la peticion termina tarde, igual se saca el item (o se registra el
    // fallo). Asi nunca queda un item enviado en el servidor y vivo en la cola.
    // Dos handlers en vez de then().catch(): así un fallo al SACAR el item de la
    // cola nunca cae en el handler de error y lo marca como fallido (lo que lo
    // reintentaría y crearía un duplicado en el servidor).
    intento.then(
      async () => {
        try {
          await quitarDeCola(item.id);
          enviados += 1;
        } catch (e) {
          console.warn(`[Offline] se envió ${item.tipo} pero no se pudo quitar de la cola:`, e);
        }
      },
      async (e) => {
        console.warn(`[Offline] sigue pendiente (${item.tipo}):`, e);
        try {
          await marcarFallo(item, e);
        } catch (er) {
          console.warn(`[Offline] no se pudo registrar el fallo de ${item.id}:`, er);
        }
      },
    ).finally(() => {
      enVuelo.delete(item.id);
    });
  }

  // Espera corta y acotada SOLO para poder reportar bien los numeros: con senal
  // normal todo resuelve en milisegundos. No retiene el candado de tanda.
  if (lanzados.length > 0) {
    await Promise.race([Promise.allSettled(lanzados), dormir(ESPERA_TANDA_MS)]);
  }

  return { enviados, restantes: (await listarPendientes()).length };
}