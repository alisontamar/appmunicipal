import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import { Button, Card, ScreenContainer, SectionTitle, StatTile } from '@/components';
import { useShift } from '@/context/ShiftContext';
import { useRelojEnVivo } from '@/hooks/useRelojEnVivo';
import { useUbicacionActual } from '@/hooks/useUbicacionActual';
import { formatCoords, formatDistancia, formatDuracion, formatHora } from '@/utils/format';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CloseServiceSummary'>;

export function CloseServiceSummaryScreen({ navigation }: Props) {
  const { turno, cerrarServicio } = useShift();
  const [busy, setBusy] = useState(false);
  const { ubicacion: cierre, cargando, tardando, error, reintentar } = useUbicacionActual();

  // El turno aún no cierra en esta pantalla, así que la duración sigue corriendo.
  useRelojEnVivo(10000);

  if (!turno) {
    return (
      <ScreenContainer>
        <Text style={typography.body}>No hay un turno activo.</Text>
      </ScreenContainer>
    );
  }

  const confirmar = async () => {
    setBusy(true);
    try {
      await cerrarServicio(cierre ?? undefined);
      navigation.replace('ServiceFinished');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <Text style={typography.h2}>Resumen del turno</Text>
      <Text style={[typography.caption, styles.p]}>
        Verifique los datos antes de cerrar el servicio (RF-APP-07).
      </Text>

      <View style={styles.stats}>
        <StatTile icon="time" value={formatDuracion(turno.horaInicio)} label="Duración total" />
        <StatTile
          icon="walk"
          value={formatDistancia(turno.distanciaMetros)}
          label="Distancia recorrida"
        />
      </View>
      <View style={styles.stats}>
        <StatTile
          icon="alert-circle"
          value={String(turno.incidentes.length)}
          label="Incidentes"
        />
        <StatTile icon="clipboard" value={String(turno.mandados.length)} label="Tareas" />
      </View>

      <SectionTitle>Cierre</SectionTitle>
      {cargando ? (
        <Card>
          <View style={styles.row}>
            <Ionicons name="navigate" size={18} color={colors.gold} />
            <Text style={typography.body}>Obteniendo ubicación GPS…</Text>
          </View>
          {tardando && (
            <Text style={[typography.caption, styles.tardando]}>
              Esto puede tardar unos segundos en interiores.
            </Text>
          )}
        </Card>
      ) : error || !cierre ? (
        <Card>
          <View style={styles.row}>
            <Ionicons name="warning" size={18} color={colors.danger} />
            <Text style={[typography.body, styles.errorText]}>
              {error ?? 'No se pudo obtener la ubicación.'}
            </Text>
          </View>
          <Button label="Reintentar ubicación" variant="outline" onPress={reintentar} />
        </Card>
      ) : (
        <Card>
          <Row icon="time" label="Hora de cierre" value={formatHora(cierre.timestamp)} />
          <Row
            icon="location"
            label="Ubicación de cierre"
            value={formatCoords(cierre.latitud, cierre.longitud)}
            last
          />
        </Card>
      )}

      <Button
        label="Confirmar cierre de servicio"
        icon="stop-circle"
        variant="danger"
        large
        loading={busy}
        disabled={!cierre || cargando}
        onPress={confirmar}
        style={styles.cta}
      />
      <Button label="Seguir en servicio" variant="outline" onPress={() => navigation.goBack()} />
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
  p: { marginBottom: spacing.lg },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flex: 1 },
  errorText: { flex: 1, color: colors.danger },
  cta: { marginTop: spacing.xl, marginBottom: spacing.sm },
  tardando: { marginTop: spacing.sm },
});