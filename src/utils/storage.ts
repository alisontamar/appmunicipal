/**
 * Subida directa de fotos/videos al bucket de Supabase Storage "evidencias".
 *
 * El backend Express no tiene (todavia) un endpoint propio de subida de archivos,
 * así que la app sube el archivo directo a Supabase Storage con la publishable key
 * del proyecto y le pasa al backend la URL pública resultante (los campos
 * `selfieInicioUrl` / `evidencias[].url` ya esperaban una URL, antes recibian la
 * ruta local del celular). El bucket es público solo para lectura; el INSERT
 * anónimo está acotado por policy a las carpetas `selfies/`, `incidentes/` y
 * `checkpoints/` (ver migración `crear_bucket_evidencias`).
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = 'evidencias';

export type CarpetaEvidencia = 'selfies' | 'incidentes' | 'checkpoints';

function extensionDe(uri: string): string {
  const limpio = uri.split('?')[0];
  const punto = limpio.lastIndexOf('.');
  return punto >= 0 ? limpio.slice(punto + 1).toLowerCase() : 'jpg';
}

/**
 * Sube un archivo local (URI de expo-camera) a Storage y devuelve su URL pública.
 * Si no hay configuración de Supabase (o falla la subida), propaga el error para
 * que quien llama decida cómo manejarlo (p. ej. reintentar u ofline-queue).
 */
export async function subirEvidencia(localUri: string, carpeta: CarpetaEvidencia): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase no está configurado (falta EXPO_PUBLIC_SUPABASE_URL/ANON_KEY).');
  }

  const respuestaArchivo = await fetch(localUri);
  const blob = await respuestaArchivo.blob();
  const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionDe(localUri)}`;
  const path = `${carpeta}/${nombre}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': blob.type || 'application/octet-stream',
    },
    body: blob,
  });

  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`No se pudo subir el archivo a Storage (${res.status}): ${texto}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
