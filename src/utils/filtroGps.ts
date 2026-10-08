import type { GeoPoint } from '@/types';
import { distanciaMetros } from './geo';

/**
 * Filtro anti-deriva del GPS.
 *
 * Un celular quieto reporta posiciones que "bailan" 10-40 m alrededor del punto
 * real. Sumar la distancia entre cada par de lecturas hacía que los metros del
 * turno subieran solos aunque el guardia no se moviera.
 *
 * Cómo funciona:
 *  1. Se mantiene un "centro": la posición estimada del guardia. Mientras las
 *     lecturas caen cerca del centro (dentro del ruido esperado) se promedian
 *     para afinarlo, y lo que se devuelve es siempre el centro: el guardia se
 *     ve quieto y no suma metros, pero la web lo sigue viendo "vivo".
 *  2. Una lectura lejos del centro NO mueve nada de inmediato: queda como
 *     "candidata". Solo si la siguiente lectura también cae lejos del centro
 *     (dos seguidas) se considera movimiento real y el centro salta ahí. Un
 *     salto suelto del GPS nunca llega a contar.
 *  3. Lecturas con mala precisión, o saltos físicamente imposibles, se ignoran.
 *
 * Lo usan el GPS en primer plano (ShiftContext) y la tarea en segundo plano, así
 * que lo que se dibuja en la app y lo que se manda al servidor es lo mismo.
 */

/** Lecturas con peor precisión que esto no mueven el centro. */
const PRECISION_MAX_M = 35;
/** Movimiento mínimo para considerarlo real, aunque el GPS diga que es muy preciso. */
const UMBRAL_MIN_M = 15;
/** El umbral crece con la imprecisión de la lectura. */
const FACTOR_PRECISION = 1.5;
/** Saltos más rápidos que esto (m/s, ~144 km/h) son errores del GPS, no movimiento. */
const VELOCIDAD_MAX_MS = 40;
/** Para arrancar sin centro se exige al menos esta precisión. */
const PRECISION_ARRANQUE_M = 100;
/** Cuántas lecturas quietas como máximo pesan en el promedio del centro. */
const VENTANA_PROMEDIO = 10;

export interface PuntoFiltrado {
  /** Punto que se debe guardar y enviar. */
  punto: GeoPoint;
  /** true si es movimiento real; false si es el centro repetido (guardia quieto). */
  seMovio: boolean;
}

let centro: GeoPoint | null = null;
let pesoCentro = 1;
let candidato: GeoPoint | null = null;
let ultimaLecturaMs = 0;

/** Fija (o borra) el punto de partida. Llamar al iniciar/restaurar/cerrar un turno. */
export function reiniciarFiltroGps(inicial: GeoPoint | null = null): void {
  centro = inicial;
  pesoCentro = 1;
  candidato = null;
  ultimaLecturaMs = inicial ? Date.parse(inicial.timestamp) || Date.now() : 0;
}

/**
 * Procesa una lectura del GPS. Devuelve `null` si hay que ignorarla por
 * completo (sin centro y con mala precisión, o un salto imposible).
 */
export function procesarPuntoGps(nuevo: GeoPoint): PuntoFiltrado | null {
  const ahoraMs = Date.parse(nuevo.timestamp) || Date.now();
  const precision = nuevo.precision;

  // Primera lectura del turno: se acepta si no es una lectura muy mala.
  if (!centro) {
    if (precision != null && precision > PRECISION_ARRANQUE_M) return null;
    centro = nuevo;
    pesoCentro = 1;
    candidato = null;
    ultimaLecturaMs = ahoraMs;
    return { punto: nuevo, seMovio: true };
  }

  const quieto = (): PuntoFiltrado => ({
    punto: { ...centro!, timestamp: nuevo.timestamp },
    seMovio: false,
  });

  // Lectura imprecisa: no se puede saber si se movió, se repite el centro.
  if (precision != null && precision > PRECISION_MAX_M) {
    ultimaLecturaMs = ahoraMs;
    return quieto();
  }

  const d = distanciaMetros(centro, nuevo);
  const umbral = Math.max(UMBRAL_MIN_M, (precision ?? 0) * FACTOR_PRECISION);

  // Dentro del ruido: se afina el centro con el promedio y el guardia sigue quieto.
  if (d < umbral) {
    pesoCentro = Math.min(pesoCentro + 1, VENTANA_PROMEDIO);
    centro = {
      ...centro,
      latitud: centro.latitud + (nuevo.latitud - centro.latitud) / pesoCentro,
      longitud: centro.longitud + (nuevo.longitud - centro.longitud) / pesoCentro,
    };
    candidato = null;
    ultimaLecturaMs = ahoraMs;
    return quieto();
  }

  // Salto imposible (teletransporte del GPS): se ignora sin tocar nada.
  const dt = (ahoraMs - ultimaLecturaMs) / 1000;
  if (dt > 0 && d / dt > VELOCIDAD_MAX_MS) return null;
  ultimaLecturaMs = ahoraMs;

  // Lejos del centro: solo cuenta si la lectura anterior también lo estaba. Una
  // sola lectura suelta fuera del ruido (típica de la deriva) no mueve nada; dos
  // seguidas lejos del centro sí es movimiento real, aunque el guardia camine y
  // las dos lecturas queden separadas entre sí.
  if (candidato) {
    centro = nuevo;
    pesoCentro = 1;
    candidato = null;
    return { punto: nuevo, seMovio: true };
  }

  candidato = nuevo;
  return quieto();
}