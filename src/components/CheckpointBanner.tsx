import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, radius, spacing } from '@/theme';
import { useShift } from '@/context/ShiftContext';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

// Se muestra flotando sobre cualquier pantalla mientras haya una
// verificacion de ronda pendiente (ver ShiftContext / CHECKPOINT_INTERVALO_MS).
export function CheckpointBanner() {
  const { checkpointPendiente } = useShift();
  const navigation = useNavigation<Nav>();

  if (!checkpointPendiente) return null;

  return (
    <Pressable style={styles.banner} onPress={() => navigation.navigate('CheckpointCamera')}>
      <Ionicons name="camera" size={20} color={colors.white} />
      <Text style={styles.texto}>Verificación de ronda pendiente. Toque para tomar la foto.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: 48,
    paddingBottom: spacing.sm,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  texto: { flex: 1, color: colors.white, fontWeight: '700', fontSize: 13 },
});