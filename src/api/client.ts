/**
 * Capa HTTP. En la fase estatica no hace llamadas reales:
 * cada metodo devuelve datos mock tras un pequeno retardo simulado.
 *
 * Cuando exista el backend (Node.js + Express/NestJS + PostgreSQL), solo hay que
 * implementar `request()` con fetch/axios apuntando a API_BASE_URL y adjuntar el JWT.
 */

export const API_BASE_URL = 'http://localhost:4000/api';

export function delay<T>(value: T, ms = 600): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function request<T>(_path: string, _init?: RequestInit): Promise<T> {
  throw new Error('Backend no conectado todavia (fase estatica).');
}
