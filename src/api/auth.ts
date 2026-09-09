import { guardarTokens, limpiarTokens, request } from './client';
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

// TODO(backend): todavía no hay endpoint de recuperación de contraseña para
// guardias en la API móvil. Se dejan como no-op para no romper la pantalla.
export async function requestPasswordReset(_identificador: string): Promise<{ enviado: boolean }> {
  return { enviado: true };
}

export async function confirmPasswordReset(
  _codigo: string,
  _nuevaPassword: string,
): Promise<{ ok: boolean }> {
  return { ok: true };
}
