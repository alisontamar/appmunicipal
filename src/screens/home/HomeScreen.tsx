import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing } from '@/theme';
import { ScreenContainer, ScreenHeader } from '@/components';
import { Avatar } from '@/components';
import { useAuth } from '@/context/AuthContext';
import { useShift } from '@/context/ShiftContext';
import { useRelojEnVivo } from '@/hooks/useRelojEnVivo';
import { formatDistancia, formatDuracion, formatHora } from '@/utils/format';
import type { AppStackParamList } from '@/navigation/types';
import * as incidentesApi from '@/api/incidentes';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { guardia } = useAuth();
  const { turno, enServicio, avisoUbicacion, sincronizarAhora, revisarRuta } = useShift();
  const [refreshing, setRefreshing] = useState(false);
  const [incidentesReales, setIncidentesReales] = useState<number | null>(null);
  useRelojEnVivo(1000);
  const recargarIncidentes = useCallback(async () => {
    try {
      const todos = await incidentesApi.listarIncidentes();
      // Contar los del turno activo si hay, sino todos los del guardia
      if (turno?.id) {
        const delTurno = todos.filter((i) => !i.turnoId || i.turnoId === turno.id);
        setIncidentesReales(delTurno.length > 0 ? delTurno.length : todos.length);
      } else {
        setIncidentesReales(todos.length);
      }
    } catch {
      setIncidentesReales(null);
    }
  }, [turno?.id]);
  // Refrescar conteo al entrar y cuando cambie el turno
  React.useEffect(() => {
    if (enServicio) recargarIncidentes();
    else setIncidentesReales(null);
  }, [enServicio, turno?.id, turno?.incidentes.length, recargarIncidentes]);
  // Antes solo sincronizaba la cola offline y recontaba incidentes — nunca
  // volvía a preguntar por la ruta asignada, así que un cambio hecho desde
  // la web no se notaba acá aunque el guardia tirara del refresh a
  // propósito (el chequeo automático de ShiftContext solo corre cada 20s
  // o al volver del background). Con esto, tirar del refresh SIEMPRE
  // revisa la ruta ya mismo, no espera el próximo tick.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([sincronizarAhora(), recargarIncidentes(), revisarRuta()]);
    } finally {
      setRefreshing(false);
    }
  }, [sincronizarAhora, recargarIncidentes, revisarRuta]);

  return (
    <ScreenContainer scroll statusBar="dark" header={<ScreenHeader title="Inicio" />} refreshing={refreshing} onRefresh={onRefresh}>
      {/* DOSSIER HERO — noir institucional, sin estética IA genérica */}
      <View style={styles.dossier}>
        <View style={styles.dossierRule} />
        <View style={styles.dossierTop}>
          <Text style={styles.dossierEyebrow}>DIRECCIÓN DE SEGURIDAD CIUDADANA — G.A.M. COCHABAMBA</Text>
          <View style={styles.dossierLine} />
        </View>

        <View style={styles.identityRow}>
          <View style={styles.avatarStack}>
            <View style={styles.avatarOffset} />
            <View style={styles.avatarFrame}>
              <Avatar name={guardia?.nombre ?? ''} uri={guardia?.fotoUrl} size={68} />
            </View>
            <View style={[styles.presence, { backgroundColor: enServicio ? '#16A34A' : '#6B7280' }]} />
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={2}>
              {guardia?.nombre ?? 'Guardia Municipal'}
            </Text>
            <Text style={styles.metaMono} numberOfLines={1}>
              {(guardia?.distrito ?? 'SIN DISTRITO').toUpperCase()} · {enServicio ? 'EN SERVICIO' : 'FUERA DE SERVICIO'}
            </Text>
            {enServicio && turno && <Text style={styles.metaSub}>INICIO {formatHora(turno.horaInicio).toUpperCase()} — TURNO {turno.id.slice(0, 6).toUpperCase()}</Text>}
          </View>
        </View>

        <View style={styles.specStrip}>
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>ESTADO</Text>
            <View style={styles.specValueRow}>
              <View style={[styles.specDot, { backgroundColor: enServicio ? '#16A34A' : '#9CA3AF' }]} />
              <Text style={styles.specValue}>{enServicio ? 'ACTIVO' : 'INACTIVO'}</Text>
            </View>
          </View>
          <View style={styles.specDivider} />
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>GUARDIA</Text>
            <Text style={styles.specValueSmall} numberOfLines={1}>
              {(guardia?.nombre ?? '').split(' ')[0]?.toUpperCase() ?? '—'}
            </Text>
          </View>
          <View style={styles.specDivider} />
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>EPI</Text>
            <Text style={styles.specValueSmall}>{(guardia?.distrito ?? '—').split(' ')[0]?.toUpperCase() ?? '—'}</Text>
          </View>
        </View>
      </View>

      {/* STATS — tira técnica tipo ficha, no cards redondeadas genéricas */}
      {enServicio && turno ? (
        <View style={styles.ledger}>
          <View style={styles.ledgerHeader}>
            <Text style={styles.ledgerTitle}>CONTROL DE RONDA</Text>
          </View>
          <View style={styles.ledgerRow}>
            <View style={styles.ledgerCell}>
              <Text style={styles.ledgerLabel}>DURACIÓN</Text>
              <Text style={styles.ledgerValue}>{formatDuracion(turno.horaInicio)}</Text>
            </View>
            <View style={styles.ledgerVRule} />
            <View style={styles.ledgerCell}>
              <Text style={styles.ledgerLabel}>DISTANCIA</Text>
              <Text style={styles.ledgerValue}>{formatDistancia(turno.distanciaMetros)}</Text>
            </View>
            <View style={styles.ledgerVRule} />
            <View style={styles.ledgerCell}>
              <Text style={styles.ledgerLabel}>INCIDENCIAS</Text>
              <Text style={[styles.ledgerValue, { color: (incidentesReales ?? turno.incidentes.length) > 0 ? colors.danger : colors.navy900 }]}>
                {String((incidentesReales ?? turno.incidentes.length)).padStart(2, '0')}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyDossier}>
          <Text style={styles.emptyRule}>— SIN TURNO —</Text>
          <Text style={styles.emptyTitle}>Iniciá tu servicio para activar la trazabilidad</Text>
          <Text style={styles.emptyText}>Quedará registrado con foto, GPS y hora. Podrás ver tu ruta azul en el mapa y registrar novedades en campo.</Text>
        </View>
      )}

      {enServicio && avisoUbicacion ? (
        <View style={styles.warning}>
          <Ionicons name="warning" size={14} color={colors.danger} />
          <Text style={styles.warningText}>{avisoUbicacion}</Text>
        </View>
      ) : null}

      {/* ACCIONES — lista dossier numerada, no grid bento genérico */}
      {enServicio ? (
        <View style={styles.actionList}>
          <Text style={styles.listKicker}>OPERACIONES DE CAMPO</Text>

          <Pressable onPress={() => navigation.navigate('RegisterIncident')} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
            <Text style={styles.actionNum}>01</Text>
            <View style={[styles.actionIconBox, { backgroundColor: colors.danger }]}>
              <Ionicons name="alert" size={16} color={colors.white} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Registrar incidente</Text>
              <Text style={styles.actionSub}>Hecho en vía pública · foto / video</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.navy900} />
          </Pressable>

          <Pressable onPress={() => navigation.navigate('RegisterErrand')} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
            <Text style={styles.actionNum}>02</Text>
            <View style={[styles.actionIconBox, { backgroundColor: colors.gold }]}>
              <Ionicons name="clipboard" size={16} color={colors.navy900} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Registrar tarea</Text>
              <Text style={styles.actionSub}>Mandado puntual del turno</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.navy900} />
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'MapTab' })} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
            <Text style={styles.actionNum}>03</Text>
            <View style={[styles.actionIconBox, { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }]}>
              <Ionicons name="map" size={16} color="#2563EB" />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Mapa de ronda</Text>
              <Text style={styles.actionSub}>Tu ruta asignada en azul</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.navy900} />
          </Pressable>

          <Pressable onPress={() => navigation.navigate('CloseServiceSummary')} style={({ pressed }) => [styles.actionRow, styles.actionRowLast, pressed && styles.pressed]}>
            <Text style={styles.actionNum}>04</Text>
            <View style={[styles.actionIconBox, { backgroundColor: colors.navy900 }]}>
              <Ionicons name="stop" size={14} color={colors.white} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Cerrar servicio</Text>
              <Text style={styles.actionSub}>Finalizar turno y reporte</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.navy900} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.startBlock}>
          <Pressable onPress={() => navigation.navigate('StartServiceCamera')} style={({ pressed }) => [styles.startRow, pressed && styles.pressed]}>
            <View style={styles.startIconBox}>
              <Ionicons name="play" size={18} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.startTitle}>Iniciar servicio</Text>
              <Text style={styles.startSub}>Foto de verificación · GPS · Hora</Text>
            </View>
            <View style={styles.startArrow}>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </View>
          </Pressable>
          <Text style={styles.startNote}>Se solicita cámara y ubicación en el siguiente paso.</Text>
        </View>
      )}

      <Text style={styles.footer}>G.A.M. Cochabamba — Dirección de Seguridad Ciudadana</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dossier: {
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderRadius: 16,
    paddingTop: 0,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dossierRule: { height: 3, backgroundColor: colors.gold, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  dossierTop: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 6 },
  dossierEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: colors.gold, textTransform: 'uppercase' },
  dossierLine: { height: 1, backgroundColor: colors.border, marginTop: 2 },
  identityRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, alignItems: 'center' },
  avatarStack: { width: 72, height: 72 },
  avatarOffset: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 68,
    height: 68,
    backgroundColor: colors.gold,
    borderRadius: 16,
    opacity: 0.7,
  },
  avatarFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 0,
    backgroundColor: colors.surface,
    padding: 2,
    borderRadius: 16,
  },
  presence: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  identityText: { flex: 1, gap: 2 },
  name: { fontSize: 20, fontWeight: '900', color: colors.navy900, letterSpacing: -0.4, lineHeight: 20, fontFamily: 'System' },
  metaMono: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: colors.textSecondary, fontFamily: 'monospace' },
  metaSub: { fontSize: 10, fontWeight: '600', color: colors.navy700, fontFamily: 'monospace' },
  specStrip: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F9FAFB',
  },
  specItem: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, gap: 2 },
  specDivider: { width: 1, backgroundColor: colors.border },
  specLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: colors.textSecondary, fontFamily: 'monospace' },
  specValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  specDot: { width: 6, height: 6, borderRadius: 3 },
  specValue: { fontSize: 12, fontWeight: '900', color: colors.navy900, fontFamily: 'monospace' },
  specValueSmall: { fontSize: 11, fontWeight: '800', color: colors.navy900, fontFamily: 'monospace' },
  ledger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.navy900,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  ledgerTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.gold, fontFamily: 'monospace' },
  ledgerHash: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' },
  ledgerRow: { flexDirection: 'row' },
  ledgerCell: { flex: 1, paddingVertical: 12, paddingHorizontal: 6, gap: 2, alignItems: 'center', minWidth: 0 },
  ledgerVRule: { width: 1, backgroundColor: colors.border },
  ledgerLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.9, color: colors.textSecondary, fontFamily: 'monospace', textTransform: 'uppercase' },
  ledgerValue: { fontSize: 15, fontWeight: '900', color: colors.navy900, letterSpacing: -0.3, fontFamily: 'monospace', textAlign: 'center' },
  emptyDossier: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: 6,
    marginBottom: spacing.md,
  },
  emptyRule: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: colors.gold, fontFamily: 'monospace', textAlign: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: colors.navy900, textAlign: 'center' },
  emptyText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 16 },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  warningText: { flex: 1, fontSize: 12, color: colors.danger, fontWeight: '600' },
  listKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: colors.navy700, fontFamily: 'monospace', marginBottom: spacing.sm },
  actionList: { gap: spacing.sm, backgroundColor: 'transparent' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderWidth: 0,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionRowLast: { borderBottomWidth: 0 },
  actionNum: { fontSize: 11, fontWeight: '900', color: colors.gold, fontFamily: 'monospace', width: 18 },
  actionIconBox: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionCopy: { flex: 1, gap: 1 },
  actionTitle: { fontSize: 13, fontWeight: '900', color: colors.navy900, letterSpacing: -0.2 },
  actionSub: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  pressed: { opacity: 0.92 },
  startBlock: { gap: spacing.sm, marginTop: spacing.md },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.navy900,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  startIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTitle: { fontSize: 15, fontWeight: '900', color: colors.white, letterSpacing: -0.2 },
  startSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontFamily: 'monospace' },
  startArrow: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  startNote: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', fontFamily: 'monospace' },
  footer: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg, fontFamily: 'monospace', letterSpacing: 0.5 },
});
