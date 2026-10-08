import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, riskColor, riskLabel, spacing, typography } from '@/theme';
import { Button, Card, ScreenContainer, SectionTitle, TextField } from '@/components';
import { useShift } from '@/context/ShiftContext';
import { obtenerUbicacionActual } from '@/utils/location';
import { formatCoords, formatFechaHora } from '@/utils/format';
import {
  borradorTieneContenido,
  eliminarBorrador,
  esUriDeVideo,
  guardarBorrador,
  listarBorradores,
  nuevoBorrador,
  ubicacionDeBorrador,
  type BorradorIncidente,
} from '@/utils/borradoresIncidente';
import { borrarCapturas } from '@/utils/media';
import type { IncidentType, RiskLevel } from '@/types';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'RegisterIncident'>;

const TIPOS: { value: IncidentType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'robo', label: 'Robo', icon: 'bag-remove' },
  { value: 'asalto', label: 'Asalto', icon: 'warning' },
  { value: 'violencia', label: 'Violencia', icon: 'hand-left' },
  { value: 'accidente', label: 'Accidente', icon: 'car' },
  { value: 'disturbio', label: 'Disturbio', icon: 'people' },
  { value: 'otro', label: 'Otro', icon: 'ellipsis-horizontal' },
];

const RIESGOS: RiskLevel[] = ['bajo', 'medio', 'alto', 'muy_alto'];

/**
 * Formulario del reporte. Llega desde la cámara (o desde la lista de borradores)
 * con un borrador que ya trae las fotos y, sobre todo, la HORA y UBICACIÓN de
 * cuando el guardia empezó el reporte. Al enviar se usan esos datos y no los del
 * momento del envío, para que un borrador mandado más tarde conserve su origen.
 */
export function RegisterIncidentScreen({ navigation, route }: Props) {
  const { agregarIncidente } = useShift();
  const [borrador, setBorrador] = useState<BorradorIncidente>(
    () => route.params?.borrador ?? nuevoBorrador(),
  );
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  const salidaLibreRef = useRef(false);
  // true si este borrador ya está guardado en el teléfono (viene de la lista o se guardó antes).
  const enDiscoRef = useRef(false);
  const borradorRef = useRef(borrador);
  borradorRef.current = borrador;

  // Al volver de la cámara llega el borrador actualizado con las fotos nuevas.
  const borradorParam = route.params?.borrador;
  useEffect(() => {
    if (borradorParam) setBorrador(borradorParam);
  }, [borradorParam]);

  useEffect(() => {
    const id = borradorRef.current.id;
    listarBorradores().then((l) => {
      if (l.some((b) => b.id === id)) enDiscoRef.current = true;
    });
  }, []);

  const actualizar = (cambios: Partial<BorradorIncidente>) =>
    setBorrador((b) => ({ ...b, ...cambios }));

  const quitarEvidencia = (uri: string) =>
    setBorrador((b) => ({ ...b, evidenciaUris: b.evidenciaUris.filter((e) => e !== uri) }));

  const agregarMasEvidencia = () => navigation.navigate('IncidentCamera', { borrador });

  const volverAInicio = () => navigation.popTo('Tabs', { screen: 'HomeTab' });

  const guardar = async (): Promise<boolean> => {
    try {
      await guardarBorrador(borradorRef.current);
      enDiscoRef.current = true;
      return true;
    } catch (e) {
      console.warn('[Incidente] no se pudo guardar el borrador:', e);
      return false;
    }
  };

  const guardarYSalir = async () => {
    if (!(await guardar())) {
      setError('No se pudo guardar el borrador. Intente nuevamente.');
      return;
    }
    salidaLibreRef.current = true;
    Alert.alert(
      'Borrador guardado',
      'Puede retomarlo desde Inicio. Se conservan la hora y la ubicación de cuando lo empezó.',
    );
    volverAInicio();
  };

  const reintentarUbicacion = async () => {
    setBuscandoUbicacion(true);
    try {
      const p = await obtenerUbicacionActual();
      actualizar({
        ubicacionInicio: { latitud: p.latitud, longitud: p.longitud, precision: p.precision },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo obtener la ubicación.');
    } finally {
      setBuscandoUbicacion(false);
    }
  };

  // Salir con algo escrito/capturado: preguntar antes de perderlo.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (salidaLibreRef.current) return;
      const actual = borradorRef.current;
      if (!borradorTieneContenido(actual)) return;
      e.preventDefault();

      const salir = () => {
        salidaLibreRef.current = true;
        navigation.dispatch(e.data.action);
      };

      Alert.alert('Reporte sin enviar', '¿Qué desea hacer con este reporte?', [
        { text: 'Seguir editando', style: 'cancel' },
        enDiscoRef.current
          ? { text: 'Salir sin guardar cambios', style: 'destructive', onPress: salir }
          : {
              text: 'Descartar',
              style: 'destructive',
              onPress: () => {
                borrarCapturas(actual.evidenciaUris);
                salir();
              },
            },
        {
          text: 'Guardar borrador',
          onPress: async () => {
            if (await guardar()) salir();
            else Alert.alert('No se pudo guardar', 'Intente nuevamente.');
          },
        },
      ]);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const enviar = async () => {
    if (!borrador.tipo || !borrador.riesgo || borrador.descripcion.trim().length < 5) {
      setError('Seleccione tipo, nivel de riesgo y describa el hecho (mín. 5 caracteres).');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      // Hora y lugar de cuando se EMPEZÓ el reporte. Solo si el GPS no respondió
      // entonces se usa la ubicación actual (con la hora de inicio igualmente).
      let ubicacion = ubicacionDeBorrador(borrador);
      if (!ubicacion) {
        const ahora = await obtenerUbicacionActual();
        ubicacion = { ...ahora, timestamp: borrador.horaInicio };
      }
      await agregarIncidente({
        tipo: borrador.tipo,
        descripcion: borrador.descripcion.trim(),
        nivelRiesgo: borrador.riesgo,
        evidenciaUris: borrador.evidenciaUris,
        ubicacion,
      });
      await eliminarBorrador(borrador.id);
      salidaLibreRef.current = true;
      navigation.replace('IncidentSuccess');
    } catch (e) {
      // Que un fallo no cueste el reporte: queda como borrador en el teléfono.
      const guardado = await guardar();
      const detalle = e instanceof Error ? e.message : 'No se pudo enviar el reporte.';
      setError(
        guardado ? `${detalle} Se guardó como borrador; puede reintentar más tarde.` : detalle,
      );
    } finally {
      setBusy(false);
    }
  };

  const evidencias = borrador.evidenciaUris;

  return (
    <ScreenContainer scroll>
      <SectionTitle hint="RF-APP-08">Tipo de hecho</SectionTitle>
      <View style={styles.chips}>
        {TIPOS.map((t) => {
          const active = borrador.tipo === t.value;
          return (
            <Pressable
              key={t.value}
              onPress={() => actualizar({ tipo: t.value })}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Ionicons name={t.icon} size={16} color={active ? colors.white : colors.navy900} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Descripción</SectionTitle>
      <TextField
        label="¿Qué ocurrió?"
        value={borrador.descripcion}
        onChangeText={(descripcion) => actualizar({ descripcion })}
        placeholder="Relate lo sucedido, personas involucradas, características…"
        multiline
        numberOfLines={4}
        style={styles.textarea}
      />

      <SectionTitle>Nivel de riesgo</SectionTitle>
      <View style={styles.chips}>
        {RIESGOS.map((r) => {
          const active = borrador.riesgo === r;
          return (
            <Pressable
              key={r}
              onPress={() => actualizar({ riesgo: r })}
              style={[
                styles.riskChip,
                { borderColor: riskColor[r] },
                active && { backgroundColor: riskColor[r] },
              ]}
            >
              <Text style={[styles.riskText, active && styles.riskTextActive]}>{riskLabel[r]}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>{`Evidencia multimedia (${evidencias.length})`}</SectionTitle>
      {evidencias.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbsRow}>
          {evidencias.map((uri) => (
            <View key={uri} style={styles.thumbWrap}>
              {esUriDeVideo(uri) ? (
                <View style={[styles.thumb, styles.videoThumb]}>
                  <Ionicons name="videocam" size={24} color={colors.white} />
                </View>
              ) : (
                <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
              )}
              <Pressable style={styles.thumbRemove} onPress={() => quitarEvidencia(uri)} hitSlop={8}>
                <Ionicons name="close" size={14} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      <Button
        label={evidencias.length > 0 ? 'Agregar más fotos o videos' : 'Agregar fotos o videos'}
        icon="camera"
        variant="outline"
        onPress={agregarMasEvidencia}
        style={styles.evBtn}
      />

      <SectionTitle>Hora y lugar del inicio del reporte</SectionTitle>
      <Card>
        <View style={styles.autoRow}>
          <Ionicons name="time" size={18} color={colors.gold} />
          <Text style={typography.body}>{formatFechaHora(borrador.horaInicio)}</Text>
        </View>
        <View style={styles.autoRow}>
          <Ionicons name="location" size={18} color={colors.gold} />
          <Text style={[typography.body, styles.flex]}>
            {borrador.ubicacionInicio
              ? formatCoords(borrador.ubicacionInicio.latitud, borrador.ubicacionInicio.longitud)
              : 'No se pudo tomar la ubicación al iniciar.'}
          </Text>
        </View>
        {!borrador.ubicacionInicio ? (
          <Button
            label="Obtener ubicación ahora"
            icon="navigate"
            variant="outline"
            loading={buscandoUbicacion}
            onPress={reintentarUbicacion}
          />
        ) : null}
        <Text style={[typography.caption, styles.nota]}>
          Estos datos se conservan aunque guarde el reporte como borrador y lo envíe más tarde.
        </Text>
      </Card>

      {error ? <Text style={[typography.caption, styles.error]}>{error}</Text> : null}

      <Button
        label="Enviar reporte"
        icon="send"
        variant="danger"
        large
        loading={busy}
        onPress={enviar}
        style={styles.submit}
      />
      <Button
        label="Guardar borrador"
        icon="save"
        variant="outline"
        disabled={busy}
        onPress={guardarYSalir}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.navy900,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.navy900 },
  chipText: { color: colors.navy900, fontWeight: '600', fontSize: 14 },
  chipTextActive: { color: colors.white },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  riskChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  riskText: { fontWeight: '700', fontSize: 13, color: colors.textPrimary },
  riskTextActive: { color: '#1F2937' },
  evBtn: { marginTop: spacing.sm },
  thumbsRow: { marginTop: spacing.xs },
  thumbWrap: { marginRight: spacing.sm, position: 'relative' },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    backgroundColor: '#DDE3EA',
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoThumb: {
    backgroundColor: colors.navy700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  nota: { marginTop: spacing.sm },
  error: { color: colors.danger, marginTop: spacing.md },
  submit: { marginTop: spacing.xl, marginBottom: spacing.sm },
});
