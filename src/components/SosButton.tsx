import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '@/theme';
import { useShift } from '@/context/ShiftContext';
import { autenticarConBiometria, biometriaDisponible } from '@/utils/biometria';
import { useTabBarHeight } from '@/navigation/tabBarMetrics';
import { CopilotStep, Walkthroughable } from '@/tutorial/Tutorial';
import { leerUltimoSosWidget } from '@/native/overlay';
import { VENTANA_SOS_WIDGET_MS, suscribirSosWidget } from '@/utils/sosWidgetEvento';

// Separación entre el borde superior del tab bar y el borde inferior del botón.
const GAP_SOBRE_TAB_BAR = 20;
// Verde del estado "atendido" (el SOS ya lo gestionó el centro de monitoreo).
const VERDE_ATENDIDO = '#16A34A';
// Ritmo de reintento mientras un SOS espera en la cola por falta de señal.
const REINTENTO_COLA_MS = 15_000;

export function SosButton() {
  const { enServicio, dispararSos, sincronizarAhora, pendientesSincronizar } = useShift();
  const [enviando, setEnviando] = useState(false);
  const [sosActivo, setSosActivo] = useState(false);
  // SOS guardado en el teléfono porque no había señal: todavía NO llegó a la web.
  const [enCola, setEnCola] = useState(false);
  const [atendido, setAtendido] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Solo se da por atendido un SOS que el servidor mostró primero como emergencia.
  // Antes, cualquier respuesta distinta de 'emergencia' (incluida la que llega antes
  // de que el SOS se haya recibido) se tomaba como atendida y el guardia veía
  // "ATENDIDO" sin que el operador hubiera visto nada.
  const vistoEnEmergenciaRef = useRef(false);
  // Evita marcar "enviado" por la cola vacía antes de que el SOS entrara en ella.
  const pendienteVistoRef = useRef(false);
  const tabBarHeight = useTabBarHeight();

  // Cuando el operador marca como atendido (desde la web), el backend limpia esSos.
  // Hacemos polling al endpoint de estado para detectar el cambio y avisar
  // "Solicitud atendida" en vez de dejar el botón pulsado para siempre.
  //
  // La app no tiene un canal de push en vivo (socket) todavía. Este intervalo es un
  // parche: el fix de fondo sería un socket.io-client en la app.
  useEffect(() => {
    if (!sosActivo || atendido || enCola) return;
    let cancelado = false;
    const id = setInterval(async () => {
      try {
        const { request } = await import('@/api/client');
        const data: any = await request('/telemetry/estado').catch(() => null);
        if (data?.estadoOperativo === 'emergencia') vistoEnEmergenciaRef.current = true;
        const resuelto = Boolean(
          vistoEnEmergenciaRef.current &&
            data &&
            (data.estadoOperativo !== 'emergencia' || (data.esSos === false && data.sosEstado === 'atendido')),
        );
        if (!cancelado && resuelto) {
          setAtendido(true);
          setSosActivo(false);
          Alert.alert('Solicitud atendida', 'Tu solicitud SOS fue atendida. Ayuda en camino / ya fue gestionada por el centro de monitoreo.');
          clearInterval(id);
        }
      } catch {}
    }, 4000);
    // Respaldo a los 90s si el backend no confirma nada (evita botón pegado para siempre).
    const timeout = setTimeout(() => {
      if (!cancelado && sosActivo && !atendido) {
        setAtendido(true);
        setSosActivo(false);
        Alert.alert('Ayuda en camino', 'Tu alerta SOS sigue activa. El centro de monitoreo ya recibió tu ubicación y coordina la ayuda.');
      }
    }, 90000);
    return () => {
      cancelado = true;
      clearInterval(id);
      clearTimeout(timeout);
    };
  }, [sosActivo, atendido, enCola]);

  // Una vez confirmado como atendido, volver a SOS normal tras 6s para poder enviar de nuevo
  useEffect(() => {
    if (!atendido) return;
    const t = setTimeout(() => {
      setAtendido(false);
    }, 6000);
    return () => clearTimeout(t);
  }, [atendido]);

  // SOS que mandó el widget (con la app cerrada o en segundo plano): se muestra como ACTIVO
  // si es reciente, así el guardia ve que ya salió y el botón sigue el estado real del operador.
  useEffect(() => {
    let ultimoTs = 0;
    const aplicar = (ts: number) => {
      if (ts <= ultimoTs || Date.now() - ts > VENTANA_SOS_WIDGET_MS) return;
      ultimoTs = ts;
      vistoEnEmergenciaRef.current = false;
      setEnCola(false);
      setAtendido(false);
      setSosActivo(true);
    };
    leerUltimoSosWidget().then(aplicar);
    return suscribirSosWidget(aplicar);
  }, []);

  // SOS en cola: se reintenta solo hasta que salga, sin esperar el backoff normal.
  useEffect(() => {
    if (!enCola) return;
    const id = setInterval(() => {
      sincronizarAhora(true).catch(() => {});
    }, REINTENTO_COLA_MS);
    return () => clearInterval(id);
  }, [enCola, sincronizarAhora]);

  // La cola se vació después de haber tenido algo pendiente: el SOS ya salió a la web.
  useEffect(() => {
    if (!enCola) return;
    if (pendientesSincronizar > 0) {
      pendienteVistoRef.current = true;
      return;
    }
    if (pendienteVistoRef.current) {
      pendienteVistoRef.current = false;
      setEnCola(false);
      setSosActivo(false);
      setAtendido(false);
      Alert.alert('SOS enviado', 'Se recuperó la señal y tu alerta ya llegó al centro de monitoreo.');
    }
  }, [enCola, pendientesSincronizar]);

  if (!enServicio) return null;

  const confirmarYEnviar = async () => {
    if (sosActivo) {
      Alert.alert('SOS ya enviado', 'Tu alerta sigue activa. Ayuda en camino. Si la emergencia ya pasó, espera a que el operador la marque como atendida.', [
        { text: 'Entendido', style: 'default' },
        {
          text: 'Cancelar SOS',
          style: 'destructive',
          onPress: () => {
            setSosActivo(false);
            setEnCola(false);
            setAtendido(false);
          },
        },
      ]);
      return;
    }
    // Con huella disponible un solo toque confirma
    const conBiometria = await biometriaDisponible();
    if (conBiometria) {
      const exito = await autenticarConBiometria('Confirme su identidad para enviar el SOS');
      if (exito) enviar();
      return;
    }

    setShowConfirm(true);
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      const alerta = await dispararSos();
      // dispararSos devuelve un registro local ('local-…') cuando no hubo señal y lo dejó en cola.
      const quedoEnCola = alerta.id.startsWith('local-');
      vistoEnEmergenciaRef.current = false;
      pendienteVistoRef.current = false;
      setSosActivo(true);
      setAtendido(false);
      if (quedoEnCola) {
        setEnCola(true);
        sincronizarAhora(true).catch(() => {});
        Alert.alert(
          'Sin señal',
          'Tu SOS quedó guardado en el teléfono y se enviará apenas recupere la conexión. Mantén la app abierta si puedes.',
        );
      } else {
        setEnCola(false);
        Alert.alert('¡SOS Enviado!', 'Ayuda en camino — tu ubicación fue enviada al centro de monitoreo. Mantén tu teléfono encendido, un operador ya ve tu alerta en el mapa.');
      }
    } catch (e) {
      Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Intente nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  const isPulsado = sosActivo || enviando;

  return (
    <>
      <CopilotStep
        order={7}
        name="sos"
        text="Botón SOS: en una emergencia púlsalo y el centro de monitoreo recibe tu ubicación al instante."
      >
        <Walkthroughable style={[styles.sosWrap, { bottom: tabBarHeight + GAP_SOBRE_TAB_BAR }]}>
          <Pressable
            style={({ pressed }) => [
              styles.boton,
              isPulsado && styles.botonActivo,
              atendido && styles.botonAtendido,
              pressed && styles.presionado,
            ]}
            onPress={confirmarYEnviar}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color={colors.white} />
            ) : atendido ? (
              <>
                <Ionicons name="checkmark-circle" size={22} color={colors.white} />
                <Text style={styles.texto}>ATENDIDO</Text>
              </>
            ) : enCola ? (
              <>
                <Ionicons name="cloud-offline" size={20} color={colors.white} />
                <Text style={styles.texto}>EN COLA</Text>
              </>
            ) : sosActivo ? (
              <>
                <View style={styles.pulso} />
                <Ionicons name="radio" size={20} color={colors.white} />
                <Text style={styles.texto}>ACTIVO</Text>
              </>
            ) : (
              <>
                <Ionicons name="alert-circle" size={22} color={colors.white} />
                <Text style={styles.texto}>SOS</Text>
              </>
            )}
          </Pressable>
        </Walkthroughable>
      </CopilotStep>

      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={28} color={colors.white} />
            </View>
            <Text style={styles.modalTitle}>¿Enviar alerta SOS?</Text>
            <Text style={styles.modalText}>Se enviará tu ubicación actual al centro de monitoreo como emergencia. Esta acción quedará registrada.</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowConfirm(false)} style={({ pressed }) => [styles.modalBtn, styles.modalBtnGhost, pressed && { opacity: 0.8 }]}>
                <Text style={styles.modalBtnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowConfirm(false);
                  enviar();
                }}
                style={({ pressed }) => [styles.modalBtn, styles.modalBtnDanger, pressed && { opacity: 0.9 }]}
              >
                <Ionicons name="radio" size={16} color={colors.white} />
                <Text style={styles.modalBtnDangerText}>Sí, enviar SOS</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Lado izquierdo: en el derecho tapaba "Enviar reporte" y el borde de los formularios.
  sosWrap: { position: 'absolute', left: 20, width: 64, height: 64 },
  boton: {
    backgroundColor: colors.danger,
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 0,
    borderColor: 'transparent',
  },
  botonActivo: {
    backgroundColor: '#B71C1C',
    borderWidth: 3,
    borderColor: '#FFEBEE',
    elevation: 10,
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  botonAtendido: {
    backgroundColor: VERDE_ATENDIDO,
    borderWidth: 3,
    borderColor: '#DCFCE7',
    elevation: 10,
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  pulso: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    opacity: 0.25,
  },
  presionado: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  texto: { color: colors.white, fontWeight: '800', fontSize: 10, marginTop: 1, letterSpacing: 0.5 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(31,26,46,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.navy900, textAlign: 'center' },
  modalText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4, alignSelf: 'stretch' },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalBtnGhost: { backgroundColor: colors.surface, borderColor: colors.border },
  modalBtnGhostText: { fontSize: 14, fontWeight: '700', color: colors.navy900 },
  modalBtnDanger: { backgroundColor: colors.danger, borderColor: '#B91C1C' },
  modalBtnDangerText: { fontSize: 14, fontWeight: '800', color: colors.white },
});
