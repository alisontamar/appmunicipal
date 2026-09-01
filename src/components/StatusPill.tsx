import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

export function StatusPill({ enServicio }: { enServicio: boolean }) {
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: enServicio ? colors.onDuty : colors.offDuty },
      ]}
    >
      <View style={styles.dot} />
      <Text style={styles.text}>{enServicio ? 'En servicio' : 'Fuera de servicio'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
    marginRight: spacing.sm,
  },
  text: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
