/**
 * Subida de fotos/videos de evidencia al API GAMC.
 *
 * La app NO guarda credenciales de almacenamiento: manda el archivo a
 * `POST /api/media` con el token Bearer de la sesión. El backend lo escribe en
 * RustFS (bucket privado) y devuelve la URL pública `/media/<clave>`, que es la
 * que se envía después en `selfieInicioUrl` / `evidencias[].url`.
 *
 * El parámetro `carpeta` se conserva por compatibilidad con los callers
 * existentes; el servidor decide la carpeta (`fotos` / `videos`) según el MIME.
 */
import { request } from '@/api/client';

export type CarpetaEvidencia = 'selfies' | 'incidentes' | 'checkpoints';

function extensionDe(uri: string): string {
  const limpio = uri.split('?')[0];
  const punto = limpio.lastIndexOf('.');
  return punto >= 0 ? limpio.slice(punto + 1).toLowerCase() : 'jpg';
}

/** Sube un archivo local (URI de expo-camera) y devuelve su URL pública. */
export async function subirEvidencia(localUri: string, _carpeta?: CarpetaEvidencia): Promise<string> {
  const respuestaArchivo = await fetch(localUri);
  const blob = await respuestaArchivo.blob();
  const extension = extensionDe(localUri);
  const tipo = blob.type || `image/${extension === 'png' ? 'png' : 'jpeg'}`;

  // React Native espera el descriptor `{ uri, name, type }` en el FormData.
  const datos = new FormData();
  datos.append('file', { uri: localUri, name: `evidencia.${extension}`, type: tipo } as unknown as Blob);

  const { url } = await request<{ url: string }>('/media', { method: 'POST', body: datos });
  if (!url) throw new Error('El servidor de archivos no devolvió la URL.');
  return url;
}
