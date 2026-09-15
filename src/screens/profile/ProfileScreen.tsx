import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
import { Button, Card, ScreenContainer, ScreenHeader } from '@/components';
import { useAuth } from '@/context/AuthContext';
import { useShift } from '@/context/ShiftContext';
import { Avatar } from '@/components';

export function ProfileScreen() {
  const { guardia, signOut } = useAuth();
  const { enServicio, pendientesSincronizar, sincronizarAhora } = useShift();

  return (
    <ScreenContainer scroll statusBar="dark" header={<ScreenHeader title="Perfil" />}>
      {/* HERO PERFIL — premium, sin fase estática */}
      <View style={styles.hero}>
        <View style={styles.heroGold} />
        <View style={styles.heroContent}>
          <View style={styles.avatarStack}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatarRing}>
              <Avatar name={guardia?.nombre ?? ''} uri={guardia?.fotoUrl} size={84} />
            </View>
            <View style={[styles.presence, { backgroundColor: enServicio ? '#16A34A' : '#9CA3AF' }]} />
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {guardia?.nombre ?? 'Guardia Municipal'}
          </Text>
          <View style={styles.rolePill}>
            <Ionicons name="shield-checkmark" size={12} color={colors.navy900} />
            <Text style={styles.roleText}>{(guardia?.rol ?? 'Guardia').toUpperCase()}</Text>
          </View>
          <Text style={styles.distrito}>{guardia?.distrito ?? 'Sin distrito asignado'}</Text>
          <View style={styles.heroMeta}>
            <View style={styles.metaChip}>
              <Ionicons name="person" size={12} color={colors.gold} />
              <Text style={styles.metaChipText}>{guardia?.usuario ?? '-'}</Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: enServicio ? '#ECFDF5' : '#F3F4F6' }]}>
              <View style={[styles.dot, { backgroundColor: enServicio ? '#16A34A' : '#9CA3AF' }]} />
              <Text style={styles.metaChipText}>{enServicio ? 'EN SERVICIO' : 'FUERA DE SERVICIO'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionKicker}>CUENTA</Text>
        <Card style={styles.cardClean}>
          <Row icon="person-circle" label="Usuario" value={guardia?.usuario ?? '-'} />
          <View style={styles.divider} />
          <Row icon="business" label="Distrito / EPI" value={guardia?.distrito ?? '-'} />
          <View style={styles.divider} />
          <Row icon="shield" label="Estado operativo" value={enServicio ? 'En servicio' : 'Fuera de servicio'} last />
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionKicker}>SINCRONIZACIÓN</Text>
        <Card style={styles.cardClean}>
          <View style={styles.syncHeader}>
            <View style={[styles.syncIcon, { backgroundColor: pendientesSincronizar > 0 ? '#FEF2F2' : '#ECFDF5' }]}>
              <Ionicons name={pendientesSincronizar > 0 ? 'cloud-upload' : 'cloud-done'} size={18} color={pendientesSincronizar > 0 ? colors.danger : '#16A34A'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.syncTitle}>{pendientesSincronizar > 0 ? `${pendientesSincronizar} pendiente(s)` : 'Todo sincronizado'}</Text>
              <Text style={styles.syncSub}>{pendientesSincronizar > 0 ? 'En espera de señal' : 'Al día — sin cola offline'}</Text>
            </View>
            <Text style={styles.syncBig}>{String(pendientesSincronizar).padStart(2, '0')}</Text>
          </View>
          <Text style={styles.syncNote}>
            {pendientesSincronizar > 0
              ? 'Hay datos guardados en el celular esperando señal. Se sincronizan solos apenas haya conexión.'
              : 'Los incidentes, tareas, checkpoints y ubicación se guardan localmente y se envían solos si te quedás sin señal.'}
          </Text>
          {pendientesSincronizar > 0 && (
            <Pressable onPress={sincronizarAhora} style={({ pressed }) => [styles.syncBtn, pressed && { opacity: 0.9 }]}>
              <Ionicons name="sync" size={16} color={colors.white} />
              <Text style={styles.syncBtnText}>Reintentar sincronización ahora</Text>
            </Pressable>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionKicker}>APLICACIÓN</Text>
        <Card style={styles.cardClean}>
          <Row icon="information-circle" label="Versión" value="0.1.0" last />
          <Text style={styles.versionNote}>G.A.M. Cochabamba · Dirección de Seguridad Ciudadana</Text>
        </Card>
      </View>

      <Pressable onPress={signOut} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.9 }]}>
        <Ionicons name="log-out" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </ScreenContainer>
  );
}

function Row({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={14} color={colors.gold} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: spacing.lg,
  },
  heroGold: { height: 4, backgroundColor: colors.gold },
  heroContent: { alignItems: 'center', padding: spacing.lg, gap: 8 },
  avatarStack: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarGlow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.gold,
    opacity: 0.15,
  },
  avatarRing: {
    borderRadius: 42,
    padding: 3,
    backgroundColor: colors.surface,
    shadowColor: colors.gold,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  presence: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  name: { fontSize: 20, fontWeight: '900', color: colors.navy900, textAlign: 'center', letterSpacing: -0.4 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(192,144,108,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.navy900 },
  distrito: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  heroMeta: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaChipText: { fontSize: 10, fontWeight: '700', color: colors.navy700, fontFamily: 'monospace' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  section: { marginBottom: spacing.md },
  sectionKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: colors.navy700, fontFamily: 'monospace', marginBottom: spacing.sm },
  cardClean: { borderRadius: 16, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(192,144,108,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  rowValue: { fontSize: 13, fontWeight: '800', color: colors.navy900, maxWidth: 160, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#F3F4F6' },
  syncHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  syncIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  syncTitle: { fontSize: 14, fontWeight: '800', color: colors.navy900 },
  syncSub: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  syncBig: { fontSize: 22, fontWeight: '900', color: colors.navy900, fontFamily: 'monospace' },
  syncNote: { fontSize: 12, color: colors.textSecondary, lineHeight: 16, marginTop: 8 },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.navy900,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 12,
  },
  syncBtnText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  versionNote: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 8, fontFamily: 'monospace' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: spacing.lg,
  },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});
