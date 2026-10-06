/**
 * Capa HTTP real contra la API GAMC (Express + Postgres).
 *
 * - Auth por Bearer: el accessToken se adjunta en cada request; el refreshToken
 *   se usa para renovar la sesion cuando el backend responde 401.
 * - Envelope del backend: exito -> { data: ... } · error -> { error: { code, message, details? } }.
 * - Ambos tokens se guardan en AsyncStorage para sobrevivir a reinicios de la app.
 *
 * Para probar desde un celular fisico con Expo Go, `localhost` no sirve: hay que
 * apuntar a la IP LAN de la PC donde corre el backend. En vez de hardcodearla,
 * la deducimos del host que Expo/Metro ya usan para conectarse a este dispositivo
 * (Constants.expoConfig.hostUri) — así funciona sola al cambiar de red, siempre que
 * el celular y la PC del backend sigan en la misma red. Se puede forzar otra URL
 * con EXPO_PUBLIC_API_URL.
 *
 * IMPORTANTE: en un build standalone (EAS/APK) `hostUri` no existe (no hay Metro).
 * En teoria eas.json fija EXPO_PUBLIC_API_URL ahi y deberia bastar, pero se
 * confirmo con un build real que esa variable a veces NO llega al bundle final
 * (quedo embebida la IP de LAN vieja en vez de la URL de produccion). Por eso el
 * fallback para standalone NO es una IP local: es el backend de produccion. Si
 * cambia la URL del backend, actualizar PROD_API_URL aca Y en eas.json/.env.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_PORT) || '4001';
const PROD_API_URL = 'https://api.sistec-unifranz.com/api';

function hostDesdeExpo(): string | null {
  const hostUri: string | undefined =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
    (Constants as any).manifest?.debuggerHost;
  return hostUri?.split(':')[0] || null;
}

function calcularBaseUrlPorDefecto(): string {
  if (Platform.OS === 'web') return `http://localhost:${API_PORT}/api`;
  const host = hostDesdeExpo();
  // Con hostUri (Expo Go / dev client con Metro corriendo): apunta al backend
  // local en la PC del desarrollador. Sin hostUri (standalone/APK): produccion.
  return host ? `http://${host}:${API_PORT}/api` : PROD_API_URL;
}

const DEFAULT_BASE_URL = calcularBaseUrlPorDefecto();

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

  // El body se lee una sola vez y ANTES de evaluar el 401: si no, el mensaje real
  // del backend (INVALID_CREDENTIALS, ACCOUNT_DISABLED...) se pierde.
  const body = await parseBody(res);

  // Solo es "sesion expirada" si veniamos con una sesion (login fallido no lo es:
  // es usuario/contrasena incorrectos). Antes esto mascaraba todo 401 del login
  // como "La sesion expiro", por eso el guardia veia ese texto al escribir mal
  // la contrasena.
  if (res.status === 401 && !_reintento && accessToken) {
    const renovado = await refrescarSesion();
    if (renovado) return request<T>(path, init, true);
    await limpiarTokens();
    throw new SesionExpiradaError();
  }

  if (!res.ok) {
    const err = (body?.error ?? {}) as { code?: string; message?: string; details?: unknown };
    throw new ApiError(
      err.message ?? `Error ${res.status}`,
      err.code ?? 'HTTP_ERROR',
      res.status,
      err.details,
    );
  }

  // 200 pero sin envelope JSON: antes se devolvia null y reventaba aguas abajo
  // con "Cannot read property accessToken of null". Casi siempre significa que la
  // URL de la API apunta a otro host (o a una pagina HTML de cPanel).
  if (body === null || typeof body !== 'object') {
    throw new ApiError(
      `El servidor respondió sin datos válidos (HTTP ${res.status}). URL de la API: ${API_BASE_URL}`,
      'BAD_RESPONSE',
      res.status,
    );
  }

  return (body?.data ?? body) as T;
}

/** Retardo simulado. Solo lo usan los stubs que aun no tienen endpoint real. */
export function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
