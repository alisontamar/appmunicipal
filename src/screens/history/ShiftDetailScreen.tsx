import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import {
  Card,
  EmptyState,
  ListRow,
  MapPlaceholder,
  ScreenContainer,
  SectionTitle,
  StatTile,
} from '@/components';
import { useShift } from '@/context/ShiftContext';
import { mockTurnosHistoricos } from '@/mocks';
import { riskColor } from '@/theme';
import {
  formatDistancia,
  formatDuracion,
  formatFechaHora,
  formatHora,
} from '@/utils/format';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ShiftDetail'>;
type Nav = NativeStackNavigationProp<AppStackParamList>;

export function ShiftDetailScreen({ route }: Props) {
  const navigation = useNavigation<Nav>();
  const { turno: turnoActual, historialTurnos } = useShift();

  const turno =
    (turnoActual?.id === route.params.turnoId ? turnoActual : undefined) ??
    historialTurnos.find((t) => t.id === route.params.turnoId) ??
    mockTurnosHistoricos.find((t) => t.id === route.params.turnoId);

  if (!turno) {
    return (
      <ScreenContainer>
        <Text style={typography.body}>No se encontró el turno.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Text style={typography.caption}>
        {formatHora(turno.horaInicio)} – {formatHora(turno.horaFin)}
      </Text>

      <View style={styles.stats}>
        <StatTile
          icon="time"
          value={formatDuracion(turno.horaInicio, turno.horaFin)}
          label="Duración"
        />
        <StatTile icon="walk" value={formatDistancia(turno.distanciaMetros)} label="Distancia" />
      </View>

      <SectionTitle hint="RF-APP-09">Recorrido</SectionTitle>
      <MapPlaceholder label={`Ronda trazada · ${turno.recorrido.length} puntos`} height={200} />

      <SectionTitle>{`Incidentes (${turno.incidentes.length})`}</SectionTitle>
      {turno.incidentes.length === 0 ? (
        <EmptyState title="Sin incidentes en este turno" />
      ) : (
        turno.incidentes.map((i) => (
          <ListRow
            key={i.id}
            icon="alert-circle"
            accent={riskColor[i.nivelRiesgo]}
            title={i.tipo.toUpperCase()}
            subtitle={i.descripcion}
            meta={formatFechaHora(i.creadoEn)}
            onPress={() => navigation.navigate('IncidentDetail', { incidenteId: i.id })}
          />
        ))
      )}

      <SectionTitle>{`Mandados (${turno.mandados.length})`}</SectionTitle>
      {turno.mandados.length === 0 ? (
        <EmptyState title="Sin mandados en este turno" />
      ) : (
        turno.mandados.map((m) => (
          <ListRow
            key={m.id}
            icon="clipboard"
            accent={colors.gold}
            title={m.descripcion}
            meta={formatFechaHora(m.creadoEn)}
          />
        ))
      )}

      <SectionTitle>Inicio / cierre</SectionTitle>
      <Card>
        <Text style={typography.body}>Inicio: {formatFechaHora(turno.horaInicio)}</Text>
        <Text style={typography.body}>Cierre: {formatFechaHora(turno.horaFin)}</Text>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});