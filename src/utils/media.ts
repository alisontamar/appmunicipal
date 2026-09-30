import { Directory, File, Paths } from 'expo-file-system';

/**
 * Copia las capturas de la cámara a un lugar que el sistema NO borra.
 *
 * `expo-camera` devuelve siempre un URI en el directorio de caché. Android
 * puede vaciar esa caché en cualquier momento (falta de espacio) y además el
 * proceso puede morir mientras el registro espera señal: cuando el guardia
 * vuelve a abrir la app, `subirEvidencia()` hace `fetch()` de un archivo que ya
 * no está y el registro queda atascado para siempre, reintentándose cada 30s.
 *
 * `Paths.document` sí sobrevive a reinicios y vaciados de caché, así que todo lo
 * que se vaya a encolar pasa por acá primero.
 *
 * `asegurarPersistencia` es IDEMPOTENTE: si el URI ya está en `document` lo
 * devuelve tal cual, así se puede llamar tanto en la cámara como más adelante
 * sin miedo a copiar dos veces el mismo archivo.
 */

const CARPETA = 'capturas';

export type CarpetaEvidencia = 'selfies' | 'incidentes' | 'checkpoints';

const ANTIGUEDAD_MAX_MS = 24 * 60 * 60 * 1000;

function extensionDe(uri: string): string {
  const limpio = uri.split('?')[0];
  const punto = limpio.lastIndexOf('.');
  const ext = punto >= 0 ? limpio.slice(punto + 1).toLowerCase() : '';
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'jpg';
}

function directorioDe(carpeta: CarpetaEvidencia): Directory {
  const dir = new Directory(Paths.document, CARPETA, carpeta);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** true si el URI ya está en la zona que el sistema no borra. */
export function yaEsDuradera(uri: string): boolean {
  return typeof uri === 'string' && uri.length > 0 && uri.startsWith(Paths.document.uri);
}

/**
 * Devuelve un URI durable para la captura. Si algo falla (no existe la fuente,
 * error de disco) devuelve el URI original: es preferible intentar subir un
 * archivo de caché a perder el registro en el acto.
 */
export function asegurarPersistencia(uri: string, carpeta: CarpetaEvidencia): string {
  if (!uri || yaEsDuradera(uri)) return uri;
  try {
    const origen = new File(uri);
    if (!origen.exists) return uri;
    const destino = new File(
      directorioDe(carpeta),
      `${Date.now()}-${Math.round(Math.random() * 1000)}.${extensionDe(uri)}`,
    );
    origen.copy(destino);
    return destino.uri;
  } catch (e) {
    console.warn(`[Media] no se pudo persistir la captura (${carpeta}), se usa la original:`, e);
    return uri;
  }
}

/** Borra una captura local. Silencioso: si ya no está, no es un error. */
export function borrarCaptura(uri: string | null | undefined): void {
  if (!uri || !yaEsDuradera(uri)) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // No es critico: el barrido de huerfanos lo limpia igual.
  }
}

export function borrarCapturas(uris: readonly (string | null | undefined)[]): void {
  for (const uri of uris) borrarCaptura(uri);
}

/**
 * Barrido de seguridad: borra capturas viejas que NINGUN registro pendiente
 * referencia. Sin esto, un turno largo con cámara y GPS llena el teléfono, y
 * un incidente que ya se sube pero cuyo registro sigue encolado jamás suelta
 * su foto.
 *
 * Las referencias se cruzan contra la cola viva, así que nunca toca una foto
 * que todavía se puede necesitar.
 */
export function limpiarCapturasHuerfanas(
  referencias: readonly string[],
  antiguedadMaxMs: number = ANTIGUEDAD_MAX_MS,
): number {
  const base = new Directory(Paths.document, CARPETA);
  if (!base.exists) return 0;

  const enUso = new Set(referencias.filter(Boolean));
  const corte = Date.now() - antiguedadMaxMs;
  let borrados = 0;

  try {
    for (const sub of base.list()) {
      if (!(sub instanceof Directory)) continue;
      for (const f of sub.list()) {
        if (!(f instanceof File)) continue;
        if (enUso.has(f.uri)) continue;
        if ((f.modificationTime ?? 0) > corte) continue;
        try {
          f.delete();
          borrados += 1;
        } catch {
          // Si no se pudo borrar, se reintenta en el próximo arranque.
        }
      }
    }
  } catch (e) {
    console.warn('[Media] no se pudo hacer el barrido de capturas:', e);
  }
  return borrados;
}