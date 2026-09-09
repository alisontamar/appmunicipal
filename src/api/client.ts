/**
 * Capa HTTP real contra la API GAMC (Express + Postgres).
 *
 * - Auth por Bearer: el accessToken se adjunta en cada request; el refreshToken
 *   se usa para renovar la sesion cuando el backend responde 401.
 * - Envelope del backend: exito -> { data: ... } · error -> { error: { code, message, details? } }.
 * - Ambos tokens se guardan en AsyncStorage para sobrevivir a reinicios de la app.
 *
 * Para probar desde un celular fisico con Expo Go, `localhost` no sirve: hay que
 * apuntar a la IP LAN de la PC donde corre el backend. Se puede sobreescribir con
 * la variable de entorno EXPO_PUBLIC_API_URL.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BASE_URL = 'http://192.168.100.5:4001/api';

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) || DEFAULT_BASE_URL;

const ACCESS_KEY = 'gamc:accessToken';
const REFRESH_KEY = 'gamc:refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null = null;

// El almacenamiento persistente es "best effort": si el modulo nativo de
// AsyncStorage no esta disponible (p. ej. Expo Go con una version incompatible),
// la sesion sigue funcionando en memoria durante esta ejecucion de la app.
async function storageGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    console.warn('[storage] no se pudo leer', key, e);
    return null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.warn('[storage] no se pudo guardar', key, '(la sesion no persistira):', e);
  }
}

async function storageRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn('[storage] no se pudo borrar', key, e);
  }
}

/** Carga los tokens persistidos a memoria. Llamar una vez al arrancar la app. */
export async function cargarTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  accessToken = await storageGet(ACCESS_KEY);
  refreshToken = await storageGet(REFRESH_KEY);
  return { accessToken, refreshToken };
}

export async function guardarTokens(nuevoAccess: string, nuevoRefresh: string): Promise<void> {
  accessToken = nuevoAccess;
  refreshToken = nuevoRefresh;
  await storageSet(ACCESS_KEY, nuevoAccess);
  await storageSet(REFRESH_KEY, nuevoRefresh);
}

export async function limpiarTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await storageRemove(ACCESS_KEY);
  await storageRemove(REFRESH_KEY);
}

export function tokenActual(): string | null {
  return accessToken;
}

/** Error tipado de la API. `code` es el codigo del backend (INVALID_CREDENTIALS, etc.). */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Se lanza cuando el refresh falla: la sesion quedo invalida y hay que volver a login. */
export class SesionExpiradaError extends ApiError {
  constructor() {
    super('La sesión expiró. Inicie sesión nuevamente.', 'SESSION_EXPIRED', 401);
    this.name = 'SesionExpiradaError';
  }
}

async function parseBody(res: Response): Promise<any> {
  const texto = await res.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

let refrescoEnCurso: Promise<boolean> | null = null;

async function refrescarSesion(): Promise<boolean> {
  if (!refreshToken) return false;
  if (!refrescoEnCurso) {
    refrescoEnCurso = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/mobile/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const body = await parseBody(res);
        const d = body?.data;
        if (!d?.accessToken || !d?.refreshToken) return false;
        await guardarTokens(d.accessToken, d.refreshToken);
        return true;
      } catch {
        return false;
      }
    })();
  }
  const ok = await refrescoEnCurso;
  refrescoEnCurso = null;
  return ok;
}

/**
 * Hace una peticion contra la API y devuelve `data` ya desempaquetado.
 * Si recibe 401 y hay refreshToken, renueva la sesion y reintenta una vez.
 */
export async function request<T>(path: string, init: RequestInit = {}, _reintento = false): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (e) {
    throw new ApiError('No se pudo conectar con el servidor.', 'NETWORK_ERROR', 0, e);
  }

  if (res.status === 401 && !_reintento) {
    const renovado = await refrescarSesion();
    if (renovado) return request<T>(path, init, true);
    await limpiarTokens();
    throw new SesionExpiradaError();
  }

  const body = await parseBody(res);

  if (!res.ok) {
    const err = (body?.error ?? {}) as { code?: string; message?: string; details?: unknown };
    throw new ApiError(
      err.message ?? `Error ${res.status}`,
      err.code ?? 'HTTP_ERROR',
      res.status,
      err.details,
    );
  }

  return (body?.data ?? body) as T;
}

/** Retardo simulado. Solo lo usan los stubs que aun no tienen endpoint real. */
export function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
