import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import {
  Avatar,
  Button,
  Card,
  ScreenContainer,
  ScreenHeader,
  SectionTitle,
  StatTile,
  StatusPill,
} from '@/components';
import { useAuth } from '@/context/AuthContext';
import { useShift } from '@/context/ShiftContext';
import { useRelojEnVivo } from '@/hooks/useRelojEnVivo';
import { formatDistancia, formatDuracion, formatHora } from '@/utils/format';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { guardia } = useAuth();
  const { turno, enServicio, avisoUbicacion } = useShift();

  // Cronómetro en vivo 
  useRelojEnVivo(10000);

  return (
    <ScreenContainer scroll statusBar="dark" header={<ScreenHeader title="Inicio" />}>
      <Card style={styles.card}>
        <View style={styles.identityRow}>
          <Avatar name={guardia?.nombre ?? ''} uri={guardia?.fotoUrl} size={60} />
          <View style={styles.identityText}>
            <Text style={typography.h3} numberOfLines={2}>
              {guardia?.nombre}
            </Text>
            <Text style={typography.caption}>{guardia?.distrito}</Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <StatusPill enServicio={enServicio} />
          {enServicio && turno ? (
            <Text style={typography.caption}>Inicio {formatHora(turno.horaInicio)}</Text>
          ) : null}
        </View>

        <View style={styles.divider} />

        {enServicio && turno ? (
          <View style={styles.stats}>
            <StatTile icon="time" value={formatDuracion(turno.horaInicio)} label="Duración" />
            <StatTile
              icon="walk"
              value={formatDistancia(turno.distanciaMetros)}
              label="Distancia"
            />
            <StatTile
              icon="alert-circle"
              value={String(turno.incidentes.length)}
              label="Incidentes"
            />
          </View>
        ) : (
          <Text style={typography.body}>
            No hay un turno activo. Presione «Iniciar servicio» para comenzar la ronda de
            vigilancia.
          </Text>
        )}
      </Card>

      {enServicio && avisoUbicacion ? (
        <View style={styles.warning}>
          <Ionicons name="warning" size={16} color={colors.danger} />
          <Text style={[typography.caption, styles.warningText]}>{avisoUbicacion}</Text>
        </View>
      ) : null}

      {enServicio ? (
        <>
          <SectionTitle>Acciones del turno</SectionTitle>
          <Button
            label="Registrar incidente"
            icon="alert-circle"
            variant="danger"
            large
            onPress={() => navigation.navigate('RegisterIncident')}
            style={styles.action}
          />
          <Button
            label="Registrar mandado"
            icon="clipboard"
            variant="secondary"
            large
            onPress={() => navigation.navigate('RegisterErrand')}
            style={styles.action}
          />
          <Button
            label="Ver mapa de la ronda"
            icon="map"
            variant="outline"
            large
            onPress={() => navigation.navigate('Tabs', { screen: 'MapTab' })}
            style={styles.action}
          />

          <SectionTitle>Fin del turno</SectionTitle>
          <Button
            label="Cerrar servicio"
            icon="stop-circle"
            large
            onPress={() => navigation.navigate('CloseServiceSummary')}
          />
        </>
      ) : (
        <View style={styles.startWrap}>
          <Button
            label="Iniciar servicio"
            icon="play-circle"
            large
            onPress={() => {
              console.log('[HomeScreen] onPress Iniciar servicio');
              try {
                navigation.navigate('StartServiceCamera');
                console.log('[HomeScreen] navigate OK');
              } catch (e) {
                console.log('[HomeScreen] navigate ERROR', e);
              }
            }}
          />
          <View style={styles.hintRow}>
            <Ionicons name="shield-checkmark" size={14} color={colors.textSecondary} />
            <Text style={[typography.caption, styles.hint]}>
              Se pedirá una foto de verificación y se registrará ubicación y hora de inicio
              (RF-APP-03).
            </Text>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: { height: 1, backgroundColor: colors.border },
  stats: { flexDirection: 'row', gap: spacing.sm },
  action: { marginBottom: spacing.sm },
  startWrap: { marginTop: spacing.xl, gap: spacing.md },
  hintRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
  },
  hint: { flex: 1 },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FDECEC',
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningText: { flex: 1, color: colors.danger },
});