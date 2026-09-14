import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import { Button, Card } from '@/components';
import { useShift } from '@/context/ShiftContext';
import { formatDistancia, formatDuracion, formatHora } from '@/utils/format';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ServiceFinished'>;

export function ServiceFinishedScreen({ navigation }: Props) {
  const { turno, descartarTurno } = useShift();

  const finalizar = () => {
    descartarTurno();
    navigation.navigate('Tabs', { screen: 'HomeTab' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Ionicons name="checkmark-circle" size={88} color={colors.onDuty} />
        <Text style={[typography.h2, styles.center]}>Turno finalizado</Text>
        <Text style={[typography.caption, styles.center]}>
          El resumen fue enviado. Ya está fuera de servicio.
        </Text>
      </View>

      {turno && (
        <Card style={styles.card}>
          <Line label="Duración" value={formatDuracion(turno.horaInicio, turno.horaFin)} />
          <Line label="Distancia" value={formatDistancia(turno.distanciaMetros)} />
          <Line label="Incidentes" value={String(turno.incidentes.length)} />
          <Line label="Tareas" value={String(turno.mandados.length)} />
          <Line label="Cierre" value={formatHora(turno.horaFin)} last />
        </Card>
      )}

      <Button label="Finalizar" icon="home" large onPress={finalizar} />
    </View>
  );
}

function Line({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.line, !last && styles.lineBorder]}>
      <Text style={typography.body}>{label}</Text>
      <Text style={typography.bodyStrong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center', gap: spacing.xl },
  top: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  card: { gap: 0 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
  lineBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
