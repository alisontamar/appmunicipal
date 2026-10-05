import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
import { Button, Card, ScreenContainer, ScreenHeader } from '@/components';
import { useAuth } from '@/context/AuthContext';
import { useShift } from '@/context/ShiftContext';
import { Avatar } from '@/components';

/** Antigüedad del registro más viejo de la cola — el guardia tiene que ver que
 *  lleva 3 h a salvo en el teléfono, no solo un número. */
function esperaLegible(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'Esperando hace menos de 1 minuto';
  if (min < 60) return `Esperando hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Esperando hace ${h} h`;
  return `Esperando hace ${Math.floor(h / 24)} día(s)`;
}

export function ProfileScreen() {
  const { guardia, signOut } = useAuth();
  const { enServicio, pendientesDetalle, sincronizarAhora } = useShift();

  const esperaTexto = esperaLegible(pendientesDetalle.masAntiguoEn);

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
            <Ionicons name="shield-checkmark" size={12} color={colors.brand} />
            <Text style={styles.roleText}>{(guardia?.rol ?? 'Guardia').toUpperCase()}</Text>
          </View>
          <Text style={styles.distrito}>{guardia?.distrito ?? 'Sin distrito asignado'}</Text>
          <View style={styles.heroMeta}>
            <View style={styles.metaChip}>
              <Ionicons name="person" size={12} color={colors.brand} />
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
            <View style={[styles.syncIcon, { backgroundColor: pendientesDetalle.registros > 0 ? '#FEF2F2' : '#ECFDF5' }]}>
              <Ionicons name={pendientesDetalle.registros > 0 ? 'cloud-upload' : 'cloud-done'} size={18} color={pendientesDetalle.registros > 0 ? colors.danger : '#16A34A'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.syncTitle}>
                {pendientesDetalle.registros > 0
                  ? `${pendientesDetalle.registros} registro(s) sin enviar`
                  : pendientesDetalle.total > 0
                    ? 'Sin registros pendientes'
                    : 'Todo sincronizado'}
              </Text>
              <Text style={styles.syncSub}>
                {pendientesDetalle.registros > 0
                  ? 'A salvo en este teléfono'
                  : pendientesDetalle.total > 0
                    ? 'Solo puntos de GPS esperando señal'
                    : 'Al día — sin cola offline'}
              </Text>
            </View>
            <Text style={styles.syncBig}>{String(pendientesDetalle.total).padStart(2, '0')}</Text>
          </View>
          <Text style={styles.syncNote}>
            {pendientesDetalle.registros > 0
              ? 'Estos registros están guardados en el celular y se envían solos apenas haya señal. Se reintentan cada vez con más calma si algo falla, pero no se descartan nunca.'
              : 'Los incidentes, tareas, checkpoints y ubicación se guardan localmente y se envían solos si te quedás sin señal.'}
          </Text>
          {esperaTexto ? (
            <View style={styles.warnBox}>
              <Ionicons name="time-outline" size={15} color="#B45309" />
              <Text style={styles.warnText}>{esperaTexto}</Text>
            </View>
          ) : null}
          {pendientesDetalle.ultimoError ? (
            <View style={styles.warnBox}>
              <Ionicons name="alert-circle-outline" size={15} color="#B45309" />
              <Text style={styles.warnText}>Último error: {pendientesDetalle.ultimoError}</Text>
            </View>
          ) : null}
          {pendientesDetalle.total > 0 && (
            <Pressable
              onPress={() => sincronizarAhora(true)}
              style={({ pressed }) => [styles.syncBtn, pressed && { opacity: 0.9 }]}
            >
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
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.lilac }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={14} color={colors.brand} />
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
  heroGold: { height: 56, backgroundColor: colors.brand },
  // El avatar sube sobre la franja morada (marginTop negativo)
  heroContent: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 8, marginTop: -44 },
  avatarStack: { width: 94, height: 94, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarGlow: {
    position: 'absolute',
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: colors.surface,
  },
  avatarRing: {
    borderRadius: 47,
    padding: 3,
    backgroundColor: colors.surface,
    shadowColor: colors.navy900,
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
    backgroundColor: colors.lilac,
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
    backgroundColor: colors.lilac,
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
    backgroundColor: colors.lilac,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  rowValue: { fontSize: 13, fontWeight: '800', color: colors.navy900, maxWidth: 160, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.lilac },
  syncHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  syncIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  syncTitle: { fontSize: 14, fontWeight: '800', color: colors.navy900 },
  syncSub: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  syncBig: { fontSize: 22, fontWeight: '900', color: colors.navy900, fontFamily: 'monospace' },
  syncNote: { fontSize: 12, color: colors.textSecondary, lineHeight: 16, marginTop: 8 },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
  },
  warnText: { flex: 1, fontSize: 12, color: '#B45309', lineHeight: 16 },
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
