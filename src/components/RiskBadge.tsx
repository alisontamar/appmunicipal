import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { radius, riskColor, riskLabel, spacing } from '@/theme';
import type { RiskLevel } from '@/types';

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <View style={[styles.badge, { backgroundColor: riskColor[level] }]}>
      <Text style={styles.text}>{riskLabel[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  text: { color: '#1F2937', fontSize: 12, fontWeight: '700' },
});
