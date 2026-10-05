/**
 * Subida de fotos/videos de evidencia a Cloudflare R2 (bucket "evidencias").
 *
 * La app no tiene llaves de R2: le manda el archivo a un Worker de Cloudflare
 * (subir-evidencias) que valida la clave compartida, el tipo, el tamano y la
 * carpeta, lo guarda en el bucket y responde con la URL publica. Al backend
 * solo se le pasa esa URL (campos `selfieInicioUrl` / `evidencias[].url`).
 *
 * Las fotos viejas siguen en Supabase con sus URLs; solo las nuevas van a R2.
 *
 * Los valores tienen fallback en codigo porque en builds standalone las
 * variables EXPO_PUBLIC_* a veces no llegan al bundle (ver api/client.ts).
 */
const UPLOAD_URL =
  process.env.EXPO_PUBLIC_UPLOAD_URL || 'https://subir-evidencias.cbbe-alisontamara-gomez-vi.workers.dev';
const UPLOAD_KEY =
  process.env.EXPO_PUBLIC_UPLOAD_KEY || 'b7723c24ad1b825559fbd2d4fa79f0501ad7dbc3b8d3e574';

export type CarpetaEvidencia = 'selfies' | 'incidentes' | 'checkpoints';

function extensionDe(uri: string): string {
  const limpio = uri.split('?')[0];
  const punto = limpio.lastIndexOf('.');
  return punto >= 0 ? limpio.slice(punto + 1).toLowerCase() : 'jpg';
}

/**
 * Sube un archivo local (URI de expo-camera) a R2 y devuelve su URL publica.
 * Si falla la subida, propaga el error para que quien llama decida como
 * manejarlo (p. ej. reintentar u offline-queue).
 */
export async function subirEvidencia(localUri: string, carpeta: CarpetaEvidencia): Promise<string> {
  const respuestaArchivo = await fetch(localUri);
  const blob = await respuestaArchivo.blob();
  const tipo = blob.type || `image/${extensionDe(localUri) === 'png' ? 'png' : 'jpeg'}`;

  const res = await fetch(`${UPLOAD_URL}/?carpeta=${carpeta}`, {
    method: 'POST',
    headers: { 'x-upload-key': UPLOAD_KEY, 'Content-Type': tipo },
    body: blob,
  });

  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`No se pudo subir el archivo (${res.status}): ${texto}`);
  }

  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error('El servidor de archivos no devolvio la URL.');
  return url;
}
