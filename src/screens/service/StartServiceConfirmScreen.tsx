import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing, typography } from '@/theme';
import { Button, Card, ScreenContainer, SectionTitle } from '@/components';
import { useShift } from '@/context/ShiftContext';
import { useUbicacionActual } from '@/hooks/useUbicacionActual';
import { formatCoords, formatHora } from '@/utils/format';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'StartServiceConfirm'>;

export function StartServiceConfirmScreen({ navigation, route }: Props) {
  const { fotoUri } = route.params;
  const { iniciarServicio } = useShift();
  const [busy, setBusy] = useState(false);

  const { ubicacion: captura, cargando, tardando, error, permisoDenegado, reintentar } =
    useUbicacionActual();

  const confirmar = async () => {
    if (!captura) return;
    setBusy(true);
    try {
      await iniciarServicio(fotoUri, captura);
      navigation.navigate('Tabs', { screen: 'HomeTab' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer scroll>
      {fotoUri ? (
        <Image source={{ uri: fotoUri }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoFallback]}>
          <Ionicons name="image" size={44} color={colors.navy700} />
          <Text style={typography.caption}>No se pudo cargar la foto</Text>
        </View>
      )}
      <Text style={[typography.caption, styles.photoLabel]}>Foto de verificación capturada</Text>

      <SectionTitle>Datos capturados automáticamente</SectionTitle>
      {cargando ? (
        <Card>
          <View style={styles.autoRow}>
            <Ionicons name="navigate" size={18} color={colors.gold} />
            <Text style={typography.body}>Obteniendo ubicación GPS…</Text>
          </View>
          {tardando && (
            <Text style={[typography.caption, styles.tardando]}>
              Esto puede tardar unos segundos en interiores. Asegúrese de tener la ubicación
              activada en su celular.
            </Text>
          )}
        </Card>
      ) : error || !captura ? (
        <Card>
          <View style={styles.autoRow}>
            <Ionicons name="warning" size={18} color={colors.danger} />
            <Text style={[typography.body, styles.errorText]}>
              {permisoDenegado
                ? 'Se necesita permiso de ubicación para iniciar el servicio.'
                : error ?? 'No se pudo obtener la ubicación.'}
            </Text>
          </View>
          <Button label="Reintentar ubicación" variant="outline" onPress={reintentar} />
        </Card>
      ) : (
        <Card>
          <Row icon="time" label="Hora de inicio" value={formatHora(captura.timestamp)} />
          <Row
            icon="location"
            label="Ubicación GPS"
            value={formatCoords(captura.latitud, captura.longitud)}
          />
          <Row icon="camera" label="Evidencia" value="1 foto adjunta" last />
        </Card>
      )}

      <Text style={[typography.caption, styles.note]}>
        Al confirmar, el turno pasa a estado «En servicio» y comienza la captura periódica de
        ubicación (RF-APP-05).
      </Text>

      <Button
        label="Confirmar inicio de servicio"
        icon="play-circle"
        large
        loading={busy}
        disabled={!captura || cargando}
        onPress={confirmar}
      />
      <Button label="Repetir foto" variant="outline" onPress={() => navigation.replace('StartServiceCamera')} style={styles.retry} />
    </ScreenContainer>
  );
}

function Row({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Ionicons name={icon} size={18} color={colors.gold} />
      <Text style={[typography.body, styles.rowLabel]}>{label}</Text>
      <Text style={typography.bodyStrong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: '#DDE3EA',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  photoLabel: { textAlign: 'center', marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flex: 1 },
  note: { marginVertical: spacing.lg },
  retry: { marginTop: spacing.sm },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  errorText: { flex: 1, color: colors.danger },
  tardando: { marginTop: spacing.sm },
});