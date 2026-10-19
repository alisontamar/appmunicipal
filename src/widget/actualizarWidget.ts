import React from 'react';
import { Platform } from 'react-native';

import { leerEstadoWidget } from './estadoWidget';
import { GuardiaWidget } from './GuardiaWidget';

export const NOMBRE_WIDGET = 'GuardiaAcciones';

/**
 * Redibuja todos los widgets puestos en la pantalla de inicio con el estado
 * guardado. No hace nada fuera de Android ni en Expo Go (sin módulo nativo).
 */
export async function actualizarWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    const { enServicio } = await leerEstadoWidget();
    await requestWidgetUpdate({
      widgetName: NOMBRE_WIDGET,
      renderWidget: () => React.createElement(GuardiaWidget, { enServicio }),
    });
  } catch (e) {
    console.warn('[Widget] no se pudo actualizar:', e);
  }
}
