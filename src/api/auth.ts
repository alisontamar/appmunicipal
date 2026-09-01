import { delay } from './client';
import { mockGuardia } from '@/mocks';
import type { Guardia } from '@/types';

export interface LoginResult {
  token: string;
  guardia: Guardia;
}

/** RF-APP-01 - login con usuario y contrasena. Devuelve JWT (mock). */
export async function login(usuario: string, _password: string): Promise<LoginResult> {
  return delay({
    token: 'mock-jwt-token',
    guardia: { ...mockGuardia, usuario: usuario || mockGuardia.usuario },
  });
}

/** RF-APP-02 - solicitar recuperacion de contrasena (correo / SMS a definir). */
export async function requestPasswordReset(_identificador: string): Promise<{ enviado: boolean }> {
  return delay({ enviado: true });
}

export async function confirmPasswordReset(
  _codigo: string,
  _nuevaPassword: string,
): Promise<{ ok: boolean }> {
  return delay({ ok: true });
}
