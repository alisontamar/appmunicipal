import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography } from '@/theme';
import { Button, Card, ScreenContainer, ScreenHeader, SectionTitle } from '@/components';
import { useAuth } from '@/context/AuthContext';
import { useShift } from '@/context/ShiftContext';

export function ProfileScreen() {
  const { guardia, signOut } = useAuth();
  const { enServicio, pendientesSincronizar, sincronizarAhora } = useShift();

  return (
    <ScreenContainer scroll statusBar="dark" header={<ScreenHeader title="Perfil" />}>
      <Card style={styles.hero}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={36} color={colors.white} />
        </View>
        <Text style={[typography.h3, styles.name]}>{guardia?.nombre}</Text>
        <Text style={styles.sub}>{guardia?.rol}</Text>
        <Text style={styles.sub}>{guardia?.distrito}</Text>
      </Card>

      <SectionTitle>Cuenta</SectionTitle>
      <Card>
        <Row icon="person-circle" label="Usuario" value={guardia?.usuario ?? '-'} />
        <Row icon="shield" label="Estado" value={enServicio ? 'En servicio' : 'Fuera de servicio'} last />
      </Card>

      <SectionTitle>Sincronización</SectionTitle>
      <Card>
        <Row
          icon={pendientesSincronizar > 0 ? 'cloud-upload' : 'cloud-done'}
          label="Datos pendientes de enviar"
          value={String(pendientesSincronizar)}
          last
        />
      </Card>
      {pendientesSincronizar > 0 ? (
        <>
          <Text style={[typography.caption, styles.note]}>
            Hay datos guardados en el celular esperando señal para enviarse. Se sincronizan solos
            apenas haya conexión.
          </Text>
          <Button
            label="Reintentar sincronización ahora"
            icon="sync"
            variant="outline"
            onPress={sincronizarAhora}
            style={styles.syncBtn}
          />
        </>
      ) : (
        <Text style={[typography.caption, styles.note]}>
          Todo sincronizado. Los incidentes, mandados, checkpoints y ubicación se guardan en el
          celular y se envían solos si en algún momento no hay señal (RF-APP-11).
        </Text>
      )}

      <SectionTitle>Aplicación</SectionTitle>
      <Card>
        <Row icon="information-circle" label="Versión" value="0.1.0 (fase estática)" last />
      </Card>

      <Button
        label="Cerrar sesión"
        icon="log-out"
        variant="outline"
        large
        onPress={signOut}
        style={styles.logout}
      />
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
  hero: { backgroundColor: colors.navy900, borderColor: colors.navy900, alignItems: 'center', gap: 4 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.navy700,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
    marginBottom: spacing.sm,
  },
  name: { color: colors.white },
  sub: { color: colors.grayLight, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flex: 1 },
  note: { marginTop: spacing.sm },
  syncBtn: { marginTop: spacing.sm },
  logout: { marginTop: spacing.xl },
});