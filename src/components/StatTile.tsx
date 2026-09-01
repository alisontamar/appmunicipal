import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/theme';

export function StatTile({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.tile}>
      <Ionicons name={icon} size={22} color={colors.gold} />
      <Text style={[typography.h3, styles.value]}>{value}</Text>
      <Text style={[typography.caption, styles.label]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.navy700,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  value: { color: colors.white, marginTop: spacing.xs },
  label: { color: colors.grayLight, textAlign: 'center' },
});
