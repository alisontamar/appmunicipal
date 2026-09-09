import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, riskColor, riskLabel, spacing, typography } from '@/theme';
import { Button, Card, ScreenContainer, SectionTitle, TextField } from '@/components';
import { useShift } from '@/context/ShiftContext';
import { useUbicacionActual } from '@/hooks/useUbicacionActual';
import { formatCoords, formatHora } from '@/utils/format';
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

// Los uris de video terminan en estas extensiones; todo lo demás lo tratamos como foto.
const EXT_VIDEO = ['.mp4', '.mov', '.m4v'];
function esVideo(uri: string): boolean {
  return EXT_VIDEO.some((ext) => uri.toLowerCase().endsWith(ext));
}

export function RegisterIncidentScreen({ navigation, route }: Props) {
  const { agregarIncidente } = useShift();
  const {
    ubicacion: captura,
    cargando,
    tardando,
    error: errorUbicacion,
    permisoDenegado,
    reintentar,
  } = useUbicacionActual();

  // El borrador puede venir en los params al volver de la cámara: así abrir
  // "Agregar foto/video" no borra el tipo, la descripción ni el nivel de riesgo.
  const borrador = route.params?.borrador;
  const [tipo, setTipo] = useState<IncidentType | null>(borrador?.tipo ?? null);
  const [descripcion, setDescripcion] = useState(borrador?.descripcion ?? '');
  const [riesgo, setRiesgo] = useState<RiskLevel | null>(borrador?.riesgo ?? null);
  const [evidencias, setEvidencias] = useState<string[]>(route.params?.evidenciaUris ?? []);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const abrirCamara = (kind: 'foto' | 'video') =>
    navigation.navigate('EvidenceCamera', {
      modo: kind,
      evidenciasPrevias: evidencias,
      returnTo: 'RegisterIncident',
      borrador: { tipo, descripcion, riesgo },
    });

  const quitarEvidencia = (uri: string) =>
    setEvidencias((prev) => prev.filter((e) => e !== uri));

  React.useEffect(() => {
    if (route.params?.evidenciaUris) {
      setEvidencias(route.params.evidenciaUris);
    }
  }, [route.params?.evidenciaUris]);

  // Al regresar de la cámara, rehidrata el formulario por si el screen se
  // remontó y el estado local se perdió.
  React.useEffect(() => {
    if (!borrador) return;
    setTipo(borrador.tipo);
    setDescripcion(borrador.descripcion);
    setRiesgo(borrador.riesgo);
  }, [borrador]);

  const enviar = async () => {
    if (!tipo || !riesgo || descripcion.trim().length < 5) {
      setError('Seleccione tipo, nivel de riesgo y describa el hecho (mín. 5 caracteres).');
      return;
    }
    if (!captura) {
      setError('Aún no se pudo obtener la ubicación GPS. Reintente antes de enviar.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await agregarIncidente({
        tipo,
        descripcion: descripcion.trim(),
        nivelRiesgo: riesgo,
        evidenciaUris: evidencias,
      });
      navigation.replace('IncidentSuccess');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <SectionTitle hint="RF-APP-08">Tipo de hecho</SectionTitle>
      <View style={styles.chips}>
        {TIPOS.map((t) => {
          const active = tipo === t.value;
          return (
            <Pressable
              key={t.value}
              onPress={() => setTipo(t.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Ionicons
                name={t.icon}
                size={16}
                color={active ? colors.white : colors.navy900}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Descripción</SectionTitle>
      <TextField
        label="¿Qué ocurrió?"
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Relate lo sucedido, personas involucradas, características…"
        multiline
        numberOfLines={4}
        style={styles.textarea}
      />

      <SectionTitle>Nivel de riesgo</SectionTitle>
      <View style={styles.chips}>
        {RIESGOS.map((r) => {
          const active = riesgo === r;
          return (
            <Pressable
              key={r}
              onPress={() => setRiesgo(r)}
              style={[
                styles.riskChip,
                { borderColor: riskColor[r] },
                active && { backgroundColor: riskColor[r] },
              ]}
            >
              <Text style={[styles.riskText, active && styles.riskTextActive]}>
                {riskLabel[r]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Evidencia multimedia</SectionTitle>
      <View style={styles.evRow}>
        <Button label="Agregar foto" icon="camera" variant="outline" onPress={() => abrirCamara('foto')} style={styles.evBtn} />
        <Button label="Agregar video" icon="videocam" variant="outline" onPress={() => abrirCamara('video')} style={styles.evBtn} />
      </View>

      {evidencias.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbsRow}>
          {evidencias.map((uri) => (
            <View key={uri} style={styles.thumbWrap}>
              {esVideo(uri) ? (
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

      <SectionTitle>Ubicación y hora (automáticas)</SectionTitle>
      {cargando ? (
        <Card>
          <View style={styles.autoRow}>
            <Ionicons name="navigate" size={18} color={colors.gold} />
            <Text style={typography.body}>Obteniendo ubicación GPS…</Text>
          </View>
          {tardando && (
            <Text style={[typography.caption, styles.tardando]}>
              Esto puede tardar unos segundos en interiores.
            </Text>
          )}
        </Card>
      ) : errorUbicacion || !captura ? (
        <Card>
          <View style={styles.autoRow}>
            <Ionicons name="warning" size={18} color={colors.danger} />
            <Text style={[typography.body, styles.error]}>
              {permisoDenegado
                ? 'Active el permiso de ubicación para registrar el hecho.'
                : errorUbicacion ?? 'No se pudo obtener la ubicación.'}
            </Text>
          </View>
          <Button label="Reintentar ubicación" variant="outline" onPress={reintentar} />
        </Card>
      ) : (
        <Card>
          <View style={styles.autoRow}>
            <Ionicons name="location" size={18} color={colors.gold} />
            <Text style={typography.body}>{formatCoords(captura.latitud, captura.longitud)}</Text>
          </View>
          <View style={styles.autoRow}>
            <Ionicons name="time" size={18} color={colors.gold} />
            <Text style={typography.body}>{formatHora(captura.timestamp)}</Text>
          </View>
        </Card>
      )}

      {error ? <Text style={[typography.caption, styles.error]}>{error}</Text> : null}

      <Button
        label="Enviar reporte"
        icon="send"
        variant="danger"
        large
        loading={busy}
        disabled={!captura || cargando}
        onPress={enviar}
        style={styles.submit}
      />
      <Text style={[typography.caption, styles.note]}>
        Campos definitivos y catálogo de tipos: pendientes de las especificaciones del cliente.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  evRow: { flexDirection: 'row', gap: spacing.sm },
  evBtn: { flex: 1 },
  thumbsRow: { marginTop: spacing.md },
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
  error: { color: colors.danger, marginTop: spacing.md },
  submit: { marginTop: spacing.xl, marginBottom: spacing.sm },
  note: { textAlign: 'center' },
  tardando: { marginTop: spacing.sm },
});