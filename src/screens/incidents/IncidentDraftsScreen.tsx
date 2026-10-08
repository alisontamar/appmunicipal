import React, { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing, typography } from '@/theme';
import { Button, EmptyState, ScreenContainer } from '@/components';
import { useShift } from '@/context/ShiftContext';
import { formatFechaHora } from '@/utils/format';
import {
  eliminarBorrador,
  esUriDeVideo,
  listarBorradores,
  type BorradorIncidente,
} from '@/utils/borradoresIncidente';
import { borrarCapturas } from '@/utils/media';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'IncidentDrafts'>;

const TIPO_LABEL: Record<string, string> = {
  robo: 'Robo',
  asalto: 'Asalto',
  violencia: 'Violencia',
  accidente: 'Accidente',
  disturbio: 'Disturbio',
  otro: 'Otro',
};

export function IncidentDraftsScreen({ navigation }: Props) {
  const { enServicio } = useShift();
  const [items, setItems] = useState<BorradorIncidente[] | null>(null);

  const cargar = useCallback(async () => {
    setItems(await listarBorradores());
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const eliminar = (b: BorradorIncidente) => {
    Alert.alert('Eliminar borrador', 'Se borrará el reporte y sus fotos de este teléfono.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await eliminarBorrador(b.id);
          borrarCapturas(b.evidenciaUris);
          cargar();
        },
      },
    ]);
  };

  const primeraFoto = (b: BorradorIncidente) => b.evidenciaUris.find((u) => !esUriDeVideo(u));

  return (
    <ScreenContainer scroll>
      <Button
        label="Nuevo reporte"
        icon="add-circle"
        large
        onPress={() => navigation.navigate('IncidentCamera')}
      />
      {!enServicio ? (
        <Text style={[typography.caption, styles.aviso]}>
          Inicie servicio para poder enviar los borradores.
        </Text>
      ) : null}

      {items && items.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="Sin borradores"
          message="Los reportes que guarde como borrador aparecerán aquí."
        />
      ) : null}

      <View style={styles.lista}>
        {(items ?? []).map((b) => {
          const foto = primeraFoto(b);
          return (
            <Pressable
              key={b.id}
              onPress={() => navigation.navigate('RegisterIncident', { borrador: b })}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              {foto ? (
                <Image source={{ uri: foto }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbVacio]}>
                  <Ionicons name="document-text" size={24} color={colors.navy700} />
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.titulo} numberOfLines={1}>
                  {b.tipo ? TIPO_LABEL[b.tipo] ?? b.tipo : 'Reporte sin tipo'}
                </Text>
                <Text style={[typography.caption, styles.desc]} numberOfLines={2}>
                  {b.descripcion.trim() || 'Sin descripción'}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  Iniciado {formatFechaHora(b.horaInicio)} · {b.evidenciaUris.length} archivo(s)
                </Text>
              </View>
              <Pressable onPress={() => eliminar(b)} hitSlop={10} style={styles.borrar}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </Pressable>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  aviso: { textAlign: 'center', marginTop: spacing.sm },
  lista: { gap: spacing.md, marginTop: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.lilac },
  thumbVacio: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  titulo: { fontSize: 16, fontWeight: '700', color: colors.navy900 },
  desc: { color: colors.textSecondary },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  borrar: { padding: spacing.xs },
});