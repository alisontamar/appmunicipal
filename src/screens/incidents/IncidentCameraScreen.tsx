import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { Button } from '@/components';
import { asegurarPersistencia, borrarCaptura, borrarCapturas } from '@/utils/media';
import { obtenerUbicacionActual } from '@/utils/location';
import {
  esUriDeVideo,
  guardarBorrador,
  listarBorradores,
  nuevoBorrador,
  type BorradorIncidente,
} from '@/utils/borradoresIncidente';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'IncidentCamera'>;

/**
 * Entrada directa de "Registrar incidente": abre la cámara y deja tomar varias
 * fotos (o videos) seguidas antes de pasar al formulario.
 *
 * - Sin `borrador` en los params = reporte nuevo. Al abrir se fija la HORA y la
 *   UBICACIÓN de inicio; esos datos viajan con el borrador y son los que se
 *   envían, aunque el reporte se mande horas después.
 * - Con `borrador` = el guardia viene del formulario a agregar más evidencia.
 */
export function IncidentCameraScreen({ navigation, route }: Props) {
  const modoAgregar = Boolean(route.params?.borrador);
  const insets = useSafeAreaInsets();
  const [permisoCamara, solicitarPermisoCamara] = useCameraPermissions();
  const [permisoMic, solicitarPermisoMic] = useMicrophonePermissions();

  const [borrador, setBorrador] = useState<BorradorIncidente>(
    () => route.params?.borrador ?? nuevoBorrador(),
  );
  const [modoCaptura, setModoCaptura] = useState<'foto' | 'video'>('foto');
  const [ocupado, setOcupado] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [lista, setLista] = useState(false);
  const [cantBorradores, setCantBorradores] = useState(0);

  const camRef = useRef<CameraView>(null);
  const flash = useRef(new Animated.Value(0)).current;
  const salidaLibreRef = useRef(false);
  // Siempre apunta al borrador más reciente (los listeners no ven el estado nuevo).
  const borradorRef = useRef(borrador);
  borradorRef.current = borrador;
  // Archivos creados en ESTA sesión de cámara: solo esos se pueden borrar al quitarlos.
  const nuevasRef = useRef<Set<string>>(new Set());

  // Ubicación de inicio: se toma al abrir, no al enviar.
  useEffect(() => {
    if (borradorRef.current.ubicacionInicio) return;
    let vivo = true;
    obtenerUbicacionActual()
      .then((p) => {
        if (!vivo) return;
        setBorrador((b) =>
          b.ubicacionInicio
            ? b
            : {
                ...b,
                ubicacionInicio: { latitud: p.latitud, longitud: p.longitud, precision: p.precision },
              },
        );
      })
      .catch((e) => console.warn('[Incidente] no se pudo tomar la ubicación de inicio:', e));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (modoAgregar) return;
    listarBorradores().then((l) => setCantBorradores(l.length));
  }, [modoAgregar]);

  const destello = () => {
    flash.setValue(0.7);
    Animated.timing(flash, { toValue: 0, duration: 180, useNativeDriver: true }).start();
  };

  const agregarEvidencia = (uriOriginal: string) => {
    // La cámara devuelve una URI de caché que Android puede borrar: se copia a
    // un directorio durable antes de guardarla en el borrador.
    const uri = asegurarPersistencia(uriOriginal, 'incidentes');
    nuevasRef.current.add(uri);
    setBorrador((b) => ({ ...b, evidenciaUris: [...b.evidenciaUris, uri] }));
  };

  const quitarEvidencia = (uri: string) => {
    setBorrador((b) => ({ ...b, evidenciaUris: b.evidenciaUris.filter((e) => e !== uri) }));
    if (nuevasRef.current.delete(uri)) borrarCaptura(uri);
  };

  const capturarFoto = async () => {
    if (!camRef.current || ocupado) return;
    setOcupado(true);
    try {
      const foto = await camRef.current.takePictureAsync({ quality: 0.5 });
      if (foto?.uri) {
        agregarEvidencia(foto.uri);
        destello();
      }
    } catch (e) {
      console.warn('[Cámara] No se pudo capturar la foto de evidencia:', e);
    } finally {
      setOcupado(false);
    }
  };

  const alternarVideo = async () => {
    if (!camRef.current) return;
    if (grabando) {
      camRef.current.stopRecording();
      return;
    }
    setGrabando(true);
    try {
      const video = await camRef.current.recordAsync({ maxDuration: 60 });
      if (video?.uri) agregarEvidencia(video.uri);
    } catch (e) {
      console.warn('[Cámara] No se pudo grabar el video de evidencia:', e);
    } finally {
      setGrabando(false);
    }
  };

  const cambiarModo = async (nuevo: 'foto' | 'video') => {
    if (grabando || nuevo === modoCaptura) return;
    if (nuevo === 'video' && !permisoMic?.granted) {
      const r = await solicitarPermisoMic();
      if (!r.granted) {
        Alert.alert('Micrófono', 'Se necesita el permiso de micrófono para grabar video.');
        return;
      }
    }
    setLista(false);
    setModoCaptura(nuevo);
  };

  const volverAlFormulario = () => {
    salidaLibreRef.current = true;
    navigation.popTo('RegisterIncident', { borrador: borradorRef.current }, { merge: true });
  };

  const continuar = () => {
    if (grabando) return;
    if (modoAgregar) {
      volverAlFormulario();
      return;
    }
    salidaLibreRef.current = true;
    navigation.replace('RegisterIncident', { borrador: borradorRef.current });
  };

  // Salir con fotos tomadas: preguntar qué hacer con ellas. En modo "agregar" la
  // salida siempre devuelve lo capturado al formulario (nunca se pierde).
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (salidaLibreRef.current) return;
      if (modoAgregar) {
        e.preventDefault();
        volverAlFormulario();
        return;
      }
      const actual = borradorRef.current;
      if (actual.evidenciaUris.length === 0) return;
      e.preventDefault();
      Alert.alert(
        '¿Qué hacemos con las fotos?',
        `Tomaste ${actual.evidenciaUris.length} archivo(s) y todavía no hay reporte.`,
        [
          { text: 'Seguir en la cámara', style: 'cancel' },
          {
            text: 'Descartar',
            style: 'destructive',
            onPress: () => {
              borrarCapturas(actual.evidenciaUris);
              salidaLibreRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Guardar borrador',
            onPress: async () => {
              try {
                await guardarBorrador(actual);
                salidaLibreRef.current = true;
                navigation.dispatch(e.data.action);
              } catch {
                Alert.alert('No se pudo guardar', 'Intente nuevamente.');
              }
            },
          },
        ],
      );
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, modoAgregar]);

  const cancelar = () => {
    if (modoAgregar) volverAlFormulario();
    else navigation.goBack();
  };

  const permisoListo = permisoCamara?.granted;

  if (!permisoCamara) return <View style={styles.container} />;

  if (!permisoListo) {
    return (
      <View style={[styles.container, styles.permisoWrap]}>
        <Ionicons name="camera-outline" size={56} color={colors.grayLight} />
        <Text style={styles.hint}>
          Se necesita acceso a la cámara para adjuntar evidencia al reporte de incidente.
        </Text>
        <Button label="Dar permiso de cámara" icon="camera" large onPress={solicitarPermisoCamara} />
        <Button label="Cancelar" variant="outline" onPress={cancelar} />
      </View>
    );
  }

  const evidencias = borrador.evidenciaUris;
  const esVideoModo = modoCaptura === 'video';

  return (
    <View style={styles.container}>
      <View style={styles.viewfinder}>
        <CameraView
          ref={camRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode={esVideoModo ? 'video' : 'picture'}
          onCameraReady={() => setLista(true)}
        />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />

        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={cancelar} style={styles.chip} hitSlop={8} accessibilityLabel="Cerrar cámara">
            <Ionicons name={modoAgregar ? 'arrow-back' : 'close'} size={18} color={colors.white} />
            <Text style={styles.chipText}>{modoAgregar ? 'Volver' : 'Cancelar'}</Text>
          </Pressable>
          {!modoAgregar && cantBorradores > 0 ? (
            <Pressable
              onPress={() => navigation.navigate('IncidentDrafts')}
              style={styles.chip}
              hitSlop={8}
              accessibilityLabel="Ver borradores"
            >
              <Ionicons name="document-text" size={18} color={colors.white} />
              <Text style={styles.chipText}>Borradores ({cantBorradores})</Text>
            </Pressable>
          ) : null}
        </View>

        {grabando ? (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>Grabando…</Text>
          </View>
        ) : evidencias.length === 0 ? (
          <View style={styles.tip}>
            <Text style={styles.tipText}>Toma todas las fotos que necesites</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 12) + spacing.sm }]}>
        {evidencias.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {evidencias.map((uri) => (
              <View key={uri} style={styles.thumbWrap}>
                {esUriDeVideo(uri) ? (
                  <View style={[styles.thumb, styles.videoThumb]}>
                    <Ionicons name="videocam" size={22} color={colors.white} />
                  </View>
                ) : (
                  <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                )}
                <Pressable style={styles.thumbRemove} onPress={() => quitarEvidencia(uri)} hitSlop={8}>
                  <Ionicons name="close" size={12} color={colors.white} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.controls}>
          <View style={styles.toggle}>
            <Pressable
              onPress={() => cambiarModo('foto')}
              style={[styles.toggleBtn, !esVideoModo && styles.toggleBtnOn]}
              accessibilityLabel="Modo foto"
            >
              <Ionicons name="camera" size={20} color={colors.white} />
            </Pressable>
            <Pressable
              onPress={() => cambiarModo('video')}
              style={[styles.toggleBtn, esVideoModo && styles.toggleBtnOn]}
              accessibilityLabel="Modo video"
            >
              <Ionicons name="videocam" size={20} color={colors.white} />
            </Pressable>
          </View>

          <Pressable
            onPress={esVideoModo ? alternarVideo : capturarFoto}
            disabled={!lista || (!esVideoModo && ocupado)}
            style={[styles.shutterRing, (!lista || (!esVideoModo && ocupado)) && styles.disabled]}
            accessibilityLabel={esVideoModo ? (grabando ? 'Detener grabación' : 'Grabar video') : 'Tomar foto'}
          >
            <View
              style={[
                styles.shutterInner,
                esVideoModo && styles.shutterVideo,
                grabando && styles.shutterStop,
              ]}
            />
          </Pressable>

          <Pressable
            onPress={continuar}
            disabled={grabando}
            style={[styles.listo, grabando && styles.disabled]}
            accessibilityLabel="Continuar al formulario"
          >
            <Text style={styles.listoText}>
              {evidencias.length > 0 ? `Listo · ${evidencias.length}` : 'Sin fotos'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permisoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.navy900,
  },
  hint: { color: colors.grayLight, textAlign: 'center', fontSize: 14 },
  viewfinder: { flex: 1 },
  flash: { backgroundColor: '#FFFFFF' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  chipText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  tip: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  tipText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  recBadge: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  panel: {
    backgroundColor: colors.navy900,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  strip: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.navy700,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  videoThumb: { alignItems: 'center', justifyContent: 'center' },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.pill,
    padding: 3,
  },
  toggleBtn: {
    width: 40,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnOn: { backgroundColor: colors.gold },
  shutterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white },
  shutterVideo: { backgroundColor: colors.danger },
  shutterStop: { width: 28, height: 28, borderRadius: 6 },
  listo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.pill,
  },
  listoText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.45 },
});