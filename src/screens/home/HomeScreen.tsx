import React, { useCallback, useState } from 'react';
import { StyleSheet, ScrollView, Text, View, Pressable } from 'react-native';
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
import {
  CopilotStep,
  Walkthroughable,
  useCopilot,
  marcarTutorialVisto,
  tutorialVisto,
  type FaseTutorial,
} from '@/tutorial/Tutorial';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { guardia } = useAuth();
  const { turno, enServicio, avisoUbicacion, sincronizarAhora, revisarRuta } = useShift();
  const [refreshing, setRefreshing] = useState(false);
  const [incidentesReales, setIncidentesReales] = useState<number | null>(null);
  useRelojEnVivo(1000);
  const { start, copilotEvents } = useCopilot();
  const fase: FaseTutorial = enServicio ? 'servicio' : 'inicio';

  // Mini tutorial de primer uso: una fase al abrir Inicio sin servicio y otra
  // la primera vez que el guardia entra en servicio (ahí aparecen incidente,
  // tarea, cerrar y el SOS). Cada una se muestra una sola vez.
  // `start` cambia de identidad cada vez que se registra un paso; si estuviera en
  // las dependencias reiniciaba el tutorial al pulsar "Siguiente". Se guarda en
  // un ref y se lanza una sola vez por fase.
  const startRef = React.useRef(start);
  startRef.current = start;
  const scrollRef = React.useRef<ScrollView>(null);
  const menuYRef = React.useRef(0);
  const faseLanzadaRef = React.useRef<FaseTutorial | null>(null);
  React.useEffect(() => {
    if (faseLanzadaRef.current === fase) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      if (cancelado || (await tutorialVisto(fase)) || cancelado) return;
      faseLanzadaRef.current = fase;
      // Los items del menú están dentro de un ScrollView y `walkthroughable` los
      // mide en coordenadas de ventana: los que caen bajo el fold se resaltaban
      // fuera de pantalla. Se sube el scroll para que el menú entero entre en
      // vista antes de que el tour mida.
      //
      // NO se le pasa el ScrollView a `start()` a propósito: eso hace que la
      // librería mida cada paso contra ese scroll, y el paso del SOS vive fuera
      // de él (es un botón absoluto sobre el tab bar). Medirlo contra un
      // ancestro que no lo contiene dispara
      // "ref.measureLayout must be called with a ref to a native component".
      const y = Math.max(0, menuYRef.current - 8);
      scrollRef.current?.scrollTo({ y, animated: false });
      setTimeout(() => {
        if (!cancelado) startRef.current();
      }, 250);
    }, 900);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [fase]);
  React.useEffect(() => {
    const alTerminar = () => marcarTutorialVisto(fase);
    copilotEvents.on('stop', alTerminar);
    return () => {
      copilotEvents.off('stop', alTerminar);
    };
  }, [copilotEvents, fase]);
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

  const irATab = (screen: 'MapTab' | 'HistoryTab' | 'ProfileTab') => navigation.navigate('Tabs', { screen });
  const incidencias = incidentesReales ?? turno?.incidentes.length ?? 0;

  return (
    <ScreenContainer scroll scrollRef={scrollRef} header={<ScreenHeader title="Inicio" />} refreshing={refreshing} onRefresh={onRefresh}>
      {/* Saludo */}
      <View style={styles.greeting}>
        <View style={styles.avatarRing}>
          <Avatar name={guardia?.nombre ?? ''} uri={guardia?.fotoUrl} size={84} />
          <View style={[styles.presence, { backgroundColor: enServicio ? '#16A34A' : '#9CA3AF' }]} />
        </View>
        <Text style={styles.hola}>Hola</Text>
        <Text style={styles.name} numberOfLines={2}>
          {guardia?.nombre ?? 'Guardia Municipal'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {guardia?.distrito ?? 'Sin distrito'} · {enServicio ? 'En servicio' : 'Fuera de servicio'}
          {enServicio && turno ? ` · desde ${formatHora(turno.horaInicio)}` : ''}
        </Text>
        <Text style={styles.pregunta}>
          ¿Qué quieres hacer hoy<Text style={styles.preguntaMark}> ?</Text>
        </Text>
      </View>

      {/* Control de ronda (solo en servicio) */}
      {enServicio && turno ? (
        <View style={styles.ledger}>
          <View style={styles.ledgerCell}>
            <Text style={styles.ledgerLabel}>Duración</Text>
            <Text style={styles.ledgerValue}>{formatDuracion(turno.horaInicio)}</Text>
          </View>
          <View style={styles.ledgerVRule} />
          <View style={styles.ledgerCell}>
            <Text style={styles.ledgerLabel}>Distancia</Text>
            <Text style={styles.ledgerValue}>{formatDistancia(turno.distanciaMetros)}</Text>
          </View>
          <View style={styles.ledgerVRule} />
          <View style={styles.ledgerCell}>
            <Text style={styles.ledgerLabel}>Incidencias</Text>
            <Text style={[styles.ledgerValue, incidencias > 0 && { color: colors.danger }]}>
              {String(incidencias).padStart(2, '0')}
            </Text>
          </View>
        </View>
      ) : null}

      {enServicio && avisoUbicacion ? (
        <View style={styles.warning}>
          <Ionicons name="warning" size={14} color={colors.danger} />
          <Text style={styles.warningText}>{avisoUbicacion}</Text>
        </View>
      ) : null}

      {/* Menú principal: círculos con icono, al estilo de Innova */}
      <View
        style={styles.menu}
        onLayout={(e) => {
          menuYRef.current = e.nativeEvent.layout.y;
        }}
      >
        {enServicio ? (
          <>
            <MenuItem step={1} tip="Aquí reportas cualquier incidente con fotos de evidencia." icon="alert" label="Registrar incidente" onPress={() => navigation.navigate('RegisterIncident')} accent />
            <MenuItem step={2} tip="Anota los mandados o tareas que te encargan durante la ronda." icon="clipboard-outline" label="Registrar tarea" onPress={() => navigation.navigate('RegisterErrand')} />
            <MenuItem step={3} tip="Mira tu zona asignada y tu recorrido en el mapa." icon="map-outline" label="Mapa de ronda" onPress={() => irATab('MapTab')} />
            <MenuItem step={4} tip="Consulta tus turnos anteriores." icon="time-outline" label="Historial" onPress={() => irATab('HistoryTab')} />
            <MenuItem step={5} tip="Tus datos y el estado de sincronización." icon="person-outline" label="Perfil" onPress={() => irATab('ProfileTab')} />
            <MenuItem step={6} tip="Al terminar tu ronda, ciérrala desde aquí." icon="stop-circle-outline" label="Cerrar servicio" onPress={() => navigation.navigate('CloseServiceSummary')} />
          </>
        ) : (
          <>
            <MenuItem step={1} tip="¡Empieza aquí! Toca para iniciar tu ronda: se registra con foto, GPS y hora." icon="play" label="Iniciar servicio" onPress={() => navigation.navigate('StartServiceCamera')} accent />
            <MenuItem step={2} tip="Mira tu zona asignada en el mapa." icon="map-outline" label="Mapa" onPress={() => irATab('MapTab')} />
            <MenuItem step={3} tip="Consulta tus turnos anteriores." icon="time-outline" label="Historial" onPress={() => irATab('HistoryTab')} />
            <MenuItem step={4} tip="Tus datos y el estado de sincronización." icon="person-outline" label="Perfil" onPress={() => irATab('ProfileTab')} />
          </>
        )}
      </View>

      {!enServicio ? (
        <Text style={styles.startNote}>
          Al iniciar el servicio quedará registrado con foto, GPS y hora. Se solicita cámara y ubicación en el siguiente paso.
        </Text>
      ) : null}

      <Text style={styles.footer}>G.A.M. Cochabamba — Dirección de Seguridad Ciudadana</Text>
    </ScreenContainer>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  step,
  tip,
  accent = false,
}: {
  step: number;
  tip: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <CopilotStep order={step} name={`menu-${label}`} text={tip}>
    <Walkthroughable style={styles.menuItem}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.menuInner, pressed && styles.pressed]}
    >
      <View style={[styles.menuCircle, accent && styles.menuCircleAccent]}>
        <Ionicons name={icon} size={26} color={accent ? colors.white : colors.brand} />
      </View>
      <Text style={styles.menuLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
    </Walkthroughable>
    </CopilotStep>
  );
}

const styles = StyleSheet.create({
  greeting: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.lilacStrong,
    backgroundColor: colors.surface,
  },
  presence: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  hola: { fontSize: 26, fontWeight: '800', color: colors.navy900, marginTop: spacing.md },
  name: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', marginTop: 2 },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  pregunta: { fontSize: 16, color: colors.textPrimary, marginTop: spacing.lg },
  preguntaMark: { color: colors.gold, fontWeight: '800' },
  ledger: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    shadowColor: colors.navy900,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  ledgerCell: { flex: 1, gap: 2, alignItems: 'center', minWidth: 0 },
  ledgerVRule: { width: 1, backgroundColor: colors.border },
  ledgerLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  ledgerValue: { fontSize: 17, fontWeight: '800', color: colors.navy900, textAlign: 'center' },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningText: { flex: 1, fontSize: 12, color: colors.danger, fontWeight: '600' },
  menu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xl,
    backgroundColor: colors.lilac,
    borderRadius: 28,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  menuItem: { width: '33.333%', paddingHorizontal: 4 },
  menuInner: { alignItems: 'center', gap: spacing.sm },
  menuCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.navy900,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  menuCircleAccent: { backgroundColor: colors.gold },
  menuLabel: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  pressed: { opacity: 0.8 },
  startNote: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg, lineHeight: 17 },
  footer: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl, letterSpacing: 0.5 },
});
