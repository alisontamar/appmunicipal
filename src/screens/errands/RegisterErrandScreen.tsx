import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import { Button, Card, ScreenContainer, SectionTitle, TextField } from '@/components';
import { useShift } from '@/context/ShiftContext';
import { useUbicacionActual } from '@/hooks/useUbicacionActual';
import { formatCoords, formatHora } from '@/utils/format';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'RegisterErrand'>;

export function RegisterErrandScreen({ navigation }: Props) {
  const { agregarMandado } = useShift();
  const {
    ubicacion: captura,
    cargando,
    tardando,
    error: errorUbicacion,
    permisoDenegado,
    reintentar,
  } = useUbicacionActual();
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const enviar = async () => {
    if (descripcion.trim().length < 3) {
      setError('Describa brevemente el mandado.');
      return;
    }
    if (!captura) {
      setError('Aún no se pudo obtener la ubicación GPS. Reintente antes de enviar.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await agregarMandado(descripcion.trim());
      navigation.replace('ErrandSuccess');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <Text style={typography.h2}>Registrar mandado</Text>
      <Text style={[typography.caption, styles.p]}>
        Comisiones o tareas puntuales asignadas durante el turno (RF-APP-06).
      </Text>

      <TextField
        label="Descripción breve"
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Ej. Entrega de notificación en oficina distrital"
        multiline
        numberOfLines={3}
        style={styles.textarea}
        error={error}
      />

      <SectionTitle>Hora y ubicación (automáticas)</SectionTitle>
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
      ) : errorUbicacion || !captura ? (
        <Card>
          <View style={styles.row}>
            <Ionicons name="warning" size={18} color={colors.danger} />
            <Text style={[typography.body, styles.errorText]}>
              {permisoDenegado
                ? 'Active el permiso de ubicación para continuar.'
                : errorUbicacion ?? 'No se pudo obtener la ubicación.'}
            </Text>
          </View>
          <Button label="Reintentar ubicación" variant="outline" onPress={reintentar} />
        </Card>
      ) : (
        <Card>
          <View style={styles.row}>
            <Ionicons name="time" size={18} color={colors.gold} />
            <Text style={typography.body}>{formatHora(captura.timestamp)}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="location" size={18} color={colors.gold} />
            <Text style={typography.body}>{formatCoords(captura.latitud, captura.longitud)}</Text>
          </View>
        </Card>
      )}

      <Button
        label="Guardar mandado"
        icon="clipboard"
        variant="secondary"
        large
        loading={busy}
        disabled={!captura || cargando}
        onPress={enviar}
        style={styles.cta}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  p: { marginBottom: spacing.lg },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  errorText: { flex: 1, color: colors.danger },
  cta: { marginTop: spacing.xl },
  tardando: { marginTop: spacing.sm },
});