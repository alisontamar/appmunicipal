import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import {
  Card,
  EmptyState,
  ListRow,
  MapPlaceholder,
  OsmMapView,
  ScreenContainer,
  SectionTitle,
  StatTile,
} from '@/components';
import { obtenerRecorrido } from '@/api/turnos';
import { useShift } from '@/context/ShiftContext';
import { mockTurnosHistoricos } from '@/mocks';
import type { GeoPoint, Turno } from '@/types';
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
  const { turnoId } = route.params;

  const [turnoRemoto, setTurnoRemoto] = React.useState<Turno | null>(null);
  const [cargandoTurno, setCargandoTurno] = React.useState(false);

  const turnoLocal =
    (turnoActual?.id === turnoId ? turnoActual : undefined) ??
    historialTurnos.find((t) => t.id === turnoId) ??
    mockTurnosHistoricos.find((t) => t.id === turnoId);

  const turno = turnoLocal ?? turnoRemoto;

  // Si no está en memoria (ej. turno viejo solo en backend), traerlo
  React.useEffect(() => {
    if (turnoLocal || cargandoTurno) return;
    let vivo = true;
    setCargandoTurno(true);
    import('@/api/turnos')
      .then((m) => m.obtenerTurno(turnoId))
      .then((t) => {
        if (vivo && t) setTurnoRemoto(t);
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setCargandoTurno(false);
      });
    return () => {
      vivo = false;
    };
  }, [turnoId, turnoLocal, cargandoTurno]);

  // Recorrido real (breadcrumb GPS) traído del backend. Si falla (turno de
  // ejemplo, sin conexión, aún sin puntos) se cae al recorrido local del turno.
  const [recorrido, setRecorrido] = useState<GeoPoint[]>([]);
  const [distanciaReal, setDistanciaReal] = useState<number | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerRecorrido(turnoId)
      .then((r) => {
        if (!vigente) return;
        setRecorrido(r.puntos);
        setDistanciaReal(r.distanciaMetros);
      })
      .catch(() => {
        /* sin recorrido remoto: se usa el local */
      });
    return () => {
      vigente = false;
    };
  }, [turnoId]);

  const puntos = recorrido.length > 0 ? recorrido : (turno?.recorrido ?? []);

  if (!turno) {
    if (cargandoTurno) {
      return (
        <ScreenContainer>
          <Text style={typography.body}>Cargando detalle del turno…</Text>
        </ScreenContainer>
      );
    }
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
        <StatTile
          icon="walk"
          value={formatDistancia(distanciaReal ?? turno.distanciaMetros)}
          label="Distancia"
        />
      </View>

      <SectionTitle hint="RF-APP-09">Recorrido</SectionTitle>
      {puntos.length >= 2 ? (
        <OsmMapView
          key={`recorrido-${puntos.length}`}
          centroInicial={{ latitud: puntos[0].latitud, longitud: puntos[0].longitud }}
          recorridoInicial={puntos}
          recorridoColor={colors.onDuty}
          height={220}
        />
      ) : (
        <MapPlaceholder label={`Ronda trazada · ${puntos.length} punto(s)`} height={200} />
      )}

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

      <SectionTitle>{`Tareas (${turno.mandados.length})`}</SectionTitle>
      {turno.mandados.length === 0 ? (
        <EmptyState title="Sin tareas en este turno" />
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