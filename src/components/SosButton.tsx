import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '@/theme';
import { useShift } from '@/context/ShiftContext';
import { autenticarConBiometria, biometriaDisponible } from '@/utils/biometria';
import { useTabBarHeight } from '@/navigation/tabBarMetrics';

// Separación entre el borde superior del tab bar y el borde inferior del botón.
const GAP_SOBRE_TAB_BAR = 20;

export function SosButton() {
  const { enServicio, dispararSos } = useShift();
  const [enviando, setEnviando] = useState(false);
  const [sosActivo, setSosActivo] = useState(false);
  const [atendido, setAtendido] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const tabBarHeight = useTabBarHeight();

  // Cuando el operador marca como atendido (desde la web), el backend limpia esSos.
  // Hacemos polling suave cada 15s al endpoint de estado para detectar el cambio y avisar
  // "Solicitud atendida — ayuda en camino/ya atendida" en vez de dejar el botón pulsado para siempre.
  useEffect(() => {
    if (!sosActivo || atendido) return;
    let cancelado = false;
    const id = setInterval(async () => {
      try {
        // Intenta consultar el estado SOS del guardia; si no existe el endpoint, se ignora silenciosamente
        const { request } = await import('@/api/client');
        const data: any = await request('/telemetry/estado').catch(() => null);
        if (!cancelado && data && data.esSos === false && data.sosEstado === 'atendido') {
          setAtendido(true);
          setSosActivo(false);
          Alert.alert('Solicitud atendida', 'Tu solicitud SOS fue atendida. Ayuda en camino / ya fue gestionada por el centro de monitoreo.');
          clearInterval(id);
        }
      } catch {}
    }, 15000);
    // Auto-atendido simulado a los 90s si el backend no responde (evita botón pegado forever)
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
  }, [sosActivo, atendido]);

  // Una vez confirmado como atendido, volver a SOS normal tras 6s para poder enviar de nuevo
  useEffect(() => {
    if (!atendido) return;
    const t = setTimeout(() => {
      setAtendido(false);
    }, 6000);
    return () => clearTimeout(t);
  }, [atendido]);

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
      await dispararSos();
      setSosActivo(true);
      setAtendido(false);
      Alert.alert('¡SOS Enviado!', 'Ayuda en camino — tu ubicación fue enviada al centro de monitoreo. Mantén tu teléfono encendido, un operador ya ve tu alerta en el mapa.');
    } catch (e) {
      Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Intente nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  const isPulsado = sosActivo || enviando;

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.boton,
          { bottom: tabBarHeight + GAP_SOBRE_TAB_BAR },
          isPulsado && styles.botonActivo,
          pressed && styles.presionado,
        ]}
        onPress={confirmarYEnviar}
        disabled={enviando}
      >
        {enviando ? (
          <ActivityIndicator color={colors.white} />
        ) : sosActivo ? (
          <>
            <View style={styles.pulso} />
            <Ionicons name="radio" size={20} color={colors.white} />
            <Text style={styles.texto}>ACTIVO</Text>
          </>
        ) : atendido ? (
          <>
            <Ionicons name="checkmark-circle" size={22} color={colors.white} />
            <Text style={styles.texto}>ATENDIDO</Text>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle" size={22} color={colors.white} />
            <Text style={styles.texto}>SOS</Text>
          </>
        )}
      </Pressable>

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
  boton: {
    position: 'absolute',
    right: 20,
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
    backgroundColor: 'rgba(28,26,25,0.55)',
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