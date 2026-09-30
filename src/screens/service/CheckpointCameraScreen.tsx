import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { Button } from '@/components';
import { useShift } from '@/context/ShiftContext';
import { asegurarPersistencia } from '@/utils/media';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CheckpointCamera'>;

/** Verificacion periodica de ronda: selfie rapida + GPS, sin pantalla de confirmacion. */
export function CheckpointCameraScreen({ navigation }: Props) {
  const { registrarCheckpoint } = useShift();
  const [permiso, solicitarPermiso] = useCameraPermissions();
  const [capturando, setCapturando] = useState(false);
  const [lista, setLista] = useState(false);
  const camRef = useRef<CameraView>(null);

  const tomarFoto = async () => {
    if (!camRef.current || capturando) return;
    setCapturando(true);
    try {
      const foto = await camRef.current.takePictureAsync({ quality: 0.5 });
      if (foto?.uri) {
        // Queda en la zona durable: si el registro se encola sin señal y el
        // proceso muere, la foto sigue ahí para el reintento.
        await registrarCheckpoint(asegurarPersistencia(foto.uri, 'checkpoints'));
      }
      navigation.goBack();
    } catch (e) {
      console.warn('[Checkpoint] no se pudo completar la verificacion:', e);
    } finally {
      setCapturando(false);
    }
  };

  if (!permiso) {
    return <View style={styles.container} />;
  }

  if (!permiso.granted) {
    return (
      <View style={[styles.container, styles.permisoWrap]}>
        <Ionicons name="camera-outline" size={56} color={colors.grayLight} />
        <Text style={styles.hint}>
          Se necesita acceso a la cámara para completar la verificación de ronda.
        </Text>
        <Button label="Dar permiso de cámara" icon="camera" large onPress={solicitarPermiso} />
        <Button label="Cancelar" variant="outline" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.viewfinder}>
        <CameraView
          ref={camRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          onCameraReady={() => setLista(true)}
        />
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.hint}>Verificación de ronda: tómese una foto para confirmar su presencia.</Text>
          <View style={styles.frame} />
        </View>
      </View>

      <View style={styles.controls}>
        <Button
          label={capturando ? 'Verificando…' : 'Tomar foto de verificación'}
          icon="camera"
          large
          loading={capturando}
          disabled={!lista}
          onPress={tomarFoto}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy900 },
  permisoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  viewfinder: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  frame: {
    position: 'absolute',
    width: 220,
    height: 280,
    borderWidth: 3,
    borderColor: colors.gold,
    borderRadius: radius.lg,
  },
  hint: {
    color: colors.grayLight,
    textAlign: 'center',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  controls: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});