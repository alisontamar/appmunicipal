import { useEffect, useRef } from 'react';
import { Alert, AppState, Linking } from 'react-native';

import { API_BASE_URL, tokenActual } from '@/api/client';
import { useShift } from '@/context/ShiftContext';
import { navigationRef } from '@/navigation/navigationRef';
import {
  abrirAjustesSuperposicion,
  detenerWidget,
  guardarSesionWidget,
  iniciarWidget,
  leerUltimoSosWidget,
  limpiarSesionWidget,
  puedeDibujarSobreApps,
} from '@/native/overlay';
import { notificarSosWidget } from '@/utils/sosWidgetEvento';

type AccionWidget = 'tarea' | 'cerrar' | 'sos';

const PATRON_DEEP_LINK = /^guardiasgam:\/\/widget\/(tarea|cerrar|sos)(?:[/?#]|$)/;

/** Reintenta hasta que el navegador esté listo (en arranque en frío tarda un poco). */
function cuandoNavegaListo(accion: () => void, intento = 0) {
  if (navigationRef.isReady()) {
    accion();
  } else if (intento < 40) {
    setTimeout(() => cuandoNavegaListo(accion, intento + 1), 250);
  }
}

/**
 * Conecta el widget flotante con el turno:
 *  - Lo enciende al iniciar servicio y lo apaga al cerrarlo.
 *  - Le pasa la sesión (token, URL y turno) para que el SOS salga aunque la app esté cerrada.
 *  - Recibe los toques del widget (guardiasgam://widget/...) y ejecuta la acción.
 */
export function WidgetOverlayBridge() {
  const { enServicio, turno, dispararSos } = useShift();
  const avisoPermisoRef = useRef(false);
  const dispararSosRef = useRef(dispararSos);
  dispararSosRef.current = dispararSos;

  // Encender / apagar el widget según el turno.
  useEffect(() => {
    if (!enServicio || !turno) {
      detenerWidget();
      limpiarSesionWidget();
      return;
    }
    let vigente = true;
    (async () => {
      const token = tokenActual();
      if (token) guardarSesionWidget(token, API_BASE_URL, turno.id);
      if (!(await puedeDibujarSobreApps())) {
        if (vigente && !avisoPermisoRef.current) {
          avisoPermisoRef.current = true;
          Alert.alert(
            'Widget de ronda',
            'Para ver el acceso rápido sobre otras apps, active "Mostrar sobre otras aplicaciones" para esta app.',
            [
              { text: 'Ahora no', style: 'cancel' },
              { text: 'Abrir ajustes', onPress: abrirAjustesSuperposicion },
            ],
          );
        }
        return;
      }
      if (vigente) await iniciarWidget();
    })();
    return () => {
      vigente = false;
    };
  }, [enServicio, turno?.id]);

  // Al pasar a segundo plano o volver, reenvía la sesión: el token pudo renovarse.
  useEffect(() => {
    if (!enServicio || !turno) return;
    const sub = AppState.addEventListener('change', (estado) => {
      const token = tokenActual();
      if ((estado === 'background' || estado === 'active') && token) {
        guardarSesionWidget(token, API_BASE_URL, turno.id);
      }
    });
    return () => sub.remove();
  }, [enServicio, turno?.id]);

  // Si el widget mandó un SOS mientras la app estaba en segundo plano, avisa al botón SOS al volver.
  useEffect(() => {
    const revisar = () => {
      leerUltimoSosWidget().then((ts) => {
        if (ts > 0) notificarSosWidget(ts);
      });
    };
    revisar();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') revisar();
    });
    return () => sub.remove();
  }, []);

  // Toques del widget: la app se abre (o ya estaba abierta) con una URL guardiasgam://widget/<accion>.
  useEffect(() => {
    const ejecutar = (accion: AccionWidget) => {
      if (accion === 'tarea') {
        cuandoNavegaListo(() => navigationRef.navigate('RegisterErrand'));
      } else if (accion === 'cerrar') {
        cuandoNavegaListo(() => navigationRef.navigate('CloseServiceSummary'));
      } else {
        // SOS: el widget ya intentó mandarlo solo; si llegó hasta aquí, lo manda la app.
        dispararSosRef
          .current()
          .then((alerta) => {
            const enCola = alerta.id.startsWith('local-');
            Alert.alert(
              enCola ? 'Sin señal' : '¡SOS Enviado!',
              enCola
                ? 'Tu SOS quedó guardado en el teléfono y se enviará apenas recupere la conexión.'
                : 'Ayuda en camino — tu ubicación fue enviada al centro de monitoreo.',
            );
          })
          .catch((e: Error) => {
            Alert.alert('No se pudo enviar el SOS', e.message || 'Intente desde la pantalla de Inicio.');
          });
      }
    };

    const manejar = (url: string | null) => {
      const coincidencia = url ? PATRON_DEEP_LINK.exec(url) : null;
      if (coincidencia) ejecutar(coincidencia[1] as AccionWidget);
    };

    Linking.getInitialURL().then(manejar).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => manejar(url));
    return () => sub.remove();
  }, []);

  return null;
}
