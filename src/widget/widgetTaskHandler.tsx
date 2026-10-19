import React from 'react';
import * as Location from 'expo-location';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { cargarTokens, tokenActual } from '@/api/client';
import { enviarAlertaSos } from '@/api/sos';
import type { GeoPoint } from '@/types';
import { encolar } from '@/utils/offlineQueue';
import { GuardiaWidget, type MensajeWidget } from './GuardiaWidget';
import {
  guardarUltimoSosWidget,
  leerEstadoWidget,
  leerUltimoSosWidget,
} from './estadoWidget';

/** Si ya se mandó un SOS hace menos de esto, un toque nuevo se ignora (evita duplicar la alerta). */
const ANTIREBOTE_SOS_MS = 60_000;
const ESPERA_GPS_MS = 8_000;
const MENSAJE_VISIBLE_MS = 4_000;

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function aGeoPoint(loc: Location.LocationObject): GeoPoint {
  return {
    latitud: loc.coords.latitude,
    longitud: loc.coords.longitude,
    timestamp: new Date(loc.timestamp).toISOString(),
    precision: loc.coords.accuracy ?? undefined,
  };
}

/**
 * Ubicación para un SOS lanzado desde el widget. No se pide permiso (no hay UI):
 * si el guardia está en servicio ya lo otorgó al iniciar. Prioriza la rapidez —
 * en una emergencia es mejor una posición de hace segundos que esperar un fix nuevo.
 */
async function ubicacionParaSos(): Promise<GeoPoint> {
  const reciente = await Location.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null);
  if (reciente) return aGeoPoint(reciente);

  const nueva = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
    esperar(ESPERA_GPS_MS).then(() => null),
  ]);
  if (nueva) return aGeoPoint(nueva);

  const cualquiera = await Location.getLastKnownPositionAsync().catch(() => null);
  if (cualquiera) return aGeoPoint(cualquiera);
  throw new Error('Sin ubicación disponible');
}

async function enviarSosDirecto(turnoId: string): Promise<'enviado' | 'encolado'> {
  const ubicacion = await ubicacionParaSos();
  if (!tokenActual()) await cargarTokens();
  try {
    // El guardiaId real sale del token; el parámetro es solo por compatibilidad.
    await enviarAlertaSos(turnoId, '', ubicacion);
    return 'enviado';
  } catch (e) {
    // Sin señal: queda en la cola offline y sale solo al abrir la app / volver la red.
    console.warn('[Widget] SOS no se pudo enviar, se encola:', e);
    await encolar('sos', { turnoId, guardiaId: '', ubicacion });
    return 'encolado';
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const estado = await leerEstadoWidget();
  const dibujar = (mensaje: MensajeWidget | null = null) => {
    try {
      props.renderWidget(<GuardiaWidget enServicio={estado.enServicio} mensaje={mensaje} />);
    } catch (e) {
      console.warn('[Widget] no se pudo dibujar:', e);
    }
  };

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      dibujar();
      return;

    case 'WIDGET_CLICK': {
      if (props.clickAction !== 'SOS' && props.clickAction !== 'INCIDENTE') return;

      if (!estado.enServicio || !estado.turnoId) {
        dibujar({ texto: 'Inicia servicio desde la app', color: '#6B7280' });
        await esperar(MENSAJE_VISIBLE_MS);
        dibujar();
        return;
      }

      if (Date.now() - (await leerUltimoSosWidget()) < ANTIREBOTE_SOS_MS) {
        dibujar({ texto: 'SOS ya enviado', color: '#B71C1C' });
        await esperar(MENSAJE_VISIBLE_MS);
        dibujar();
        return;
      }

      dibujar({ texto: 'Enviando SOS…', color: '#B71C1C' });
      try {
        const resultado = await enviarSosDirecto(estado.turnoId);
        await guardarUltimoSosWidget(Date.now());
        dibujar(
          resultado === 'enviado'
            ? { texto: 'SOS ENVIADO', color: '#B71C1C' }
            : { texto: 'SOS guardado: se enviará con señal', color: '#B45309' },
        );
      } catch (e) {
        console.warn('[Widget] fallo el SOS:', e);
        dibujar({ texto: 'No se pudo enviar. Abre la app', color: '#6B7280' });
      }
      await esperar(MENSAJE_VISIBLE_MS);
      dibujar();
      return;
    }

    default:
      return;
  }
}
