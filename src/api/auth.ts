import { ApiError, guardarTokens, limpiarTokens, request } from './client';
import type { Guardia } from '@/types';

export interface LoginResult {
  token: string;
  guardia: Guardia;
}

/** Forma de guardia que devuelve el backend (login / activar / refresh / me). */
interface GuardiaDTO {
  id: string;
  usuario: string;
  nombre: string;
  ci: string;
  telefono: string;
  fotoUrl: string | null;
  estado: NonNullable<Guardia['estado']>;
  estadoOperativo: NonNullable<Guardia['estadoOperativo']>;
  debeCambiarPassword: boolean;
  epiId: string | null;
  epiCodigo: string | null;
  epiNombre: string | null;
}

interface SesionDTO {
  accessToken: string;
  refreshToken: string;
  guardia: GuardiaDTO;
}

function mapGuardia(d: GuardiaDTO): Guardia {
  return {
    id: d.id,
    nombre: d.nombre,
    usuario: d.usuario,
    rol: 'Guardia Municipal',
    distrito: d.epiNombre ?? '—',
    fotoUrl: d.fotoUrl ?? undefined,
    ci: d.ci,
    telefono: d.telefono,
    estado: d.estado,
    estadoOperativo: d.estadoOperativo,
    debeCambiarPassword: d.debeCambiarPassword,
    epiId: d.epiId ?? undefined,
    epiCodigo: d.epiCodigo ?? undefined,
    epiNombre: d.epiNombre ?? undefined,
  };
}

async function persistirSesion(s: SesionDTO): Promise<LoginResult> {
  await guardarTokens(s.accessToken, s.refreshToken);
  return { token: s.accessToken, guardia: mapGuardia(s.guardia) };
}

/** RF-APP-01 — login con usuario y contraseña. Deja la sesión guardada. */
export async function login(usuario: string, password: string): Promise<LoginResult> {
  const s = await request<SesionDTO>('/mobile/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usuario, password }),
  });
  return persistirSesion(s);
}

/**
 * Primer acceso del guardia (BD_UNIFICADA §5): fija la contraseña con el token de
 * activación entregado por la web. Al terminar, ya queda logueado.
 */
export async function activarCuenta(
  usuario: string,
  activacionToken: string,
  password: string,
): Promise<LoginResult> {
  const s = await request<SesionDTO>('/mobile/auth/activar', {
    method: 'POST',
    body: JSON.stringify({ usuario, activacion_token: activacionToken, password }),
  });
  return persistirSesion(s);
}

/** Guardia autenticado actual (se usa al reabrir la app para rehidratar la sesión). */
export async function me(): Promise<Guardia> {
  const r = await request<{ guardia: GuardiaDTO }>('/mobile/auth/me');
  return mapGuardia(r.guardia);
}

/** Cierra la sesión en el servidor y borra los tokens locales. */
export async function logout(): Promise<void> {
  try {
    await request('/mobile/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  } catch {
    // Si falla igual limpiamos localmente: la sesión local no debe quedar viva.
  }
  await limpiarTokens();
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * La API móvil (backend Express) todavía no tiene endpoint de recuperación de
 * contraseña, y `guardia` no tiene email (solo teléfono) — no hay canal para
 * mandar un código de verificación. En su lugar, esto llama a la Edge Function
 * de Supabase `guardia-password-reset`, que verifica identidad con datos que el
 * guardia ya conoce (usuario + CI + teléfono) y cambia la contraseña en un solo
 * paso, sin código intermedio.
 */
export async function resetearPassword(
  usuario: string,
  ci: string,
  telefono: string,
  nuevaPassword: string,
): Promise<{ ok: boolean }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Función de recuperación no disponible (falta configuración de Supabase).');
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/guardia-password-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ usuario, ci, telefono, nuevaPassword }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      body?.error?.message ?? 'No se pudo cambiar la contraseña.',
      body?.error?.code ?? 'HTTP_ERROR',
      res.status,
    );
  }
  return { ok: true };
}
