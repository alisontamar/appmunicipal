import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
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
  const tabBarHeight = useTabBarHeight();

  if (!enServicio) return null;

  const confirmarYEnviar = async () => {
    // Con huella disponible un solo toque confirma
    const conBiometria = await biometriaDisponible();
    if (conBiometria) {
      const exito = await autenticarConBiometria('Confirme su identidad para enviar el SOS');
      if (exito) enviar();
      return;
    }

    Alert.alert(
      'Enviar alerta SOS',
      '¿Confirma que desea enviar una alerta de emergencia con su ubicación actual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar SOS', style: 'destructive', onPress: enviar },
      ],
    );
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      await dispararSos();
      Alert.alert('Alerta enviada', 'Su ubicación fue enviada al centro de monitoreo.');
    } catch (e) {
      Alert.alert('No se pudo enviar', e instanceof Error ? e.message : 'Intente nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.boton,
        { bottom: tabBarHeight + GAP_SOBRE_TAB_BAR },
        pressed && styles.presionado,
      ]}
      onPress={confirmarYEnviar}
      disabled={enviando}
    >
      {enviando ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          <Ionicons name="alert-circle" size={22} color={colors.white} />
          <Text style={styles.texto}>SOS</Text>
        </>
      )}
    </Pressable>
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
  },
  presionado: { opacity: 0.8 },
  texto: { color: colors.white, fontWeight: '700', fontSize: 11, marginTop: 1 },
});