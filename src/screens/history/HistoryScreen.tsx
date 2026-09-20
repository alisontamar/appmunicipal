import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, radius, riskColor, spacing, typography } from '@/theme';
import { EmptyState, ListRow, ScreenContainer, ScreenHeader } from '@/components';
import { useShift } from '@/context/ShiftContext';
import {
  mockIncidentesHistoricos,
  mockMandadosHistoricos,
  mockTurnosHistoricos,
} from '@/mocks';
import { formatDistancia, formatFecha, formatFechaHora, formatHora } from '@/utils/format';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type TabKey = 'turnos' | 'incidentes' | 'mandados';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'turnos', label: 'Turnos' },
  { key: 'incidentes', label: 'Incidentes' },
  { key: 'mandados', label: 'Tareas' },
];

export function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<TabKey>('turnos');
  const [refreshing, setRefreshing] = useState(false);
  const { turno, enServicio, historialTurnos, refrescarHistorial } = useShift();

  // Antes esta pantalla no tenía pull-to-refresh — historialTurnos solo se
  // llenaba con lo que el guardia cerraba en la MISMA sesión de la app, sin
  // ninguna forma de traer el historial real del servidor de nuevo
  // (reportado 2026-09-19: "los refresh que existen no hacen nada").
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refrescarHistorial();
    } finally {
      setRefreshing(false);
    }
  }, [refrescarHistorial]);

  // Lo real (esta sesión) va primero; los datos de prueba quedan abajo para no
  // dejar las listas vacías en una demo recién instalada.
  const turnos = [...historialTurnos, ...mockTurnosHistoricos];
  const incidentes = [
    ...(enServicio && turno ? turno.incidentes : []),
    ...historialTurnos.flatMap((t) => t.incidentes),
    ...mockIncidentesHistoricos,
  ];
  const mandados = [
    ...(enServicio && turno ? turno.mandados : []),
    ...historialTurnos.flatMap((t) => t.mandados),
    ...mockMandadosHistoricos,
  ];

  return (
    <ScreenContainer padded={false} statusBar="dark" header={<ScreenHeader title="Historial" />}>
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.navy900]} tintColor={colors.navy900} />}
      >
        {tab === 'turnos' &&
          (turnos.length === 0 ? (
            <EmptyState title="Sin turnos" message="Aún no tiene turnos registrados." />
          ) : (
            turnos.map((t) => (
              <ListRow
                key={t.id}
                icon="shield-checkmark"
                accent={colors.onDuty}
                title={`Turno ${formatFecha(t.horaInicio)}`}
                subtitle={`${formatHora(t.horaInicio)} – ${formatHora(t.horaFin)} · ${formatDistancia(
                  t.distanciaMetros,
                )}`}
                meta={`${t.incidentes.length} incidente(s) · ${t.mandados.length} tarea(s)`}
                onPress={() => navigation.navigate('ShiftDetail', { turnoId: t.id })}
              />
            ))
          ))}

        {tab === 'incidentes' &&
          (incidentes.length === 0 ? (
            <EmptyState title="Sin incidentes" />
          ) : (
            incidentes.map((i) => (
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
          ))}

        {tab === 'mandados' &&
          (mandados.length === 0 ? (
            <EmptyState title="Sin tareas" />
          ) : (
            mandados.map((m) => (
              <ListRow
                key={m.id}
                icon="clipboard"
                accent={colors.gold}
                title={m.descripcion}
                meta={formatFechaHora(m.creadoEn)}
              />
            ))
          ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: colors.transparent },
  tabActive: { borderBottomColor: colors.navy900 },
  tabText: { ...typography.bodyStrong, color: colors.textSecondary },
  tabTextActive: { color: colors.navy900 },
  list: { padding: spacing.lg },
});