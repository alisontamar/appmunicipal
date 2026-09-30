import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { Button } from '@/components';
import { asegurarPersistencia } from '@/utils/media';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'EvidenceCamera'>;


export function EvidenceCameraScreen({ navigation, route }: Props) {
  const { modo, evidenciasPrevias, returnTo, borrador } = route.params;
  const insets = useSafeAreaInsets();
  const [permisoCamara, solicitarPermisoCamara] = useCameraPermissions();
  const [permisoMic, solicitarPermisoMic] = useMicrophonePermissions();
  const [ocupado, setOcupado] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [lista, setLista] = useState(false);
  const camRef = useRef<CameraView>(null);

  const permisoListo =
    permisoCamara?.granted && (modo === 'foto' || permisoMic?.granted);

  const volver = (uri: string) => {
    navigation.navigate({
      name: returnTo,
      params: { evidenciaUris: [...evidenciasPrevias, uri], borrador },
      merge: true,
    } as never);
  };

  // Cancelar: vuelve al formulario conservando lo ya cargado (evidencias y borrador).
  const cancelar = () => {
    navigation.navigate({
      name: returnTo,
      params: { evidenciaUris: evidenciasPrevias, borrador },
      merge: true,
    } as never);
  };

  const capturarFoto = async () => {
    if (!camRef.current || ocupado) return;
    setOcupado(true);
    try {
      const foto = await camRef.current.takePictureAsync({ quality: 0.5 });
      if (foto?.uri) volver(asegurarPersistencia(foto.uri, 'incidentes'));
    } catch (e) {
      console.warn('[Cámara] No se pudo capturar la foto de evidencia:', e);
    } finally {
      setOcupado(false);
    }
  };

  const alternarVideo = async () => {
    if (!camRef.current || ocupado) return;
    if (grabando) {
      camRef.current.stopRecording();
      return;
    }
    setGrabando(true);
    try {
      const video = await camRef.current.recordAsync({ maxDuration: 60 });
      if (video?.uri) volver(asegurarPersistencia(video.uri, 'incidentes'));
    } catch (e) {
      console.warn('[Cámara] No se pudo grabar el video de evidencia:', e);
    } finally {
      setGrabando(false);
    }
  };

  if (!permisoCamara || (modo === 'video' && !permisoMic)) {
    return <View style={styles.container} />;
  }

  if (!permisoListo) {
    return (
      <View style={[styles.container, styles.permisoWrap]}>
        <Ionicons name="camera-outline" size={56} color={colors.grayLight} />
        <Text style={styles.hint}>
          {modo === 'foto'
            ? 'Se necesita acceso a la cámara para adjuntar una fotografía de evidencia.'
            : 'Se necesita acceso a la cámara y al micrófono para grabar un video de evidencia.'}
        </Text>
        <Button
          label="Dar permisos"
          icon="camera"
          large
          onPress={async () => {
            await solicitarPermisoCamara();
            if (modo === 'video') await solicitarPermisoMic();
          }}
        />
        <Button label="Cancelar" variant="outline" onPress={cancelar} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.viewfinder}>
        <CameraView
          ref={camRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode={modo === 'video' ? 'video' : 'picture'}
          onCameraReady={() => setLista(true)}
        />
        {grabando && (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>Grabando…</Text>
          </View>
        )}
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 12) + spacing.md }]}>
        {modo === 'foto' ? (
          <Button
            label={ocupado ? 'Capturando…' : 'Tomar foto'}
            icon="camera"
            large
            loading={ocupado}
            disabled={!lista}
            onPress={capturarFoto}
          />
        ) : (
          <Button
            label={grabando ? 'Detener grabación' : 'Grabar video'}
            icon={grabando ? 'stop-circle' : 'videocam'}
            variant={grabando ? 'danger' : 'primary'}
            large
            disabled={!lista}
            onPress={alternarVideo}
          />
        )}
        <Button label="Cancelar" variant="outline" onPress={cancelar} />
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
  hint: {
    color: colors.grayLight,
    textAlign: 'center',
    fontSize: 14,
  },
  recBadge: {
    position: 'absolute',
    top: spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  controls: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});
