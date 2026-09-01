import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '@/theme';

export function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={typography.overline}>{children}</Text>
      {hint ? <Text style={typography.caption}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
});
