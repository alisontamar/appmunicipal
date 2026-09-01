import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/theme';

/**
 * Marcador visual del mapa para la fase estatica.
 * Se reemplazara por react-native-maps + tiles OpenStreetMap (RF-APP-10).
 */
export function MapPlaceholder({
  label = 'Mapa (OpenStreetMap)',
  height = 220,
  style,
}: {
  label?: string;
  height?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.wrap, { height }, style]}>
      <View style={styles.grid} />
      <Ionicons name="map-outline" size={40} color={colors.navy700} />
      <Text style={[typography.caption, styles.label]}>{label}</Text>
      <Text style={typography.caption}>Pendiente: integrar react-native-maps + OSM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    backgroundColor: '#DDE3EA',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.4 },
  label: { marginTop: spacing.sm, fontWeight: '700', color: colors.navy700 },
});
