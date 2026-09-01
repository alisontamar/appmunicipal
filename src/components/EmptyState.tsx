import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography } from '@/theme';

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={44} color={colors.textSecondary} />
      <Text style={[typography.h3, styles.title]}>{title}</Text>
      {message ? <Text style={[typography.caption, styles.msg]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm },
  title: { marginTop: spacing.sm },
  msg: { textAlign: 'center' },
});
