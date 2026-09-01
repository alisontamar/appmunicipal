import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/theme';

interface Props {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accent?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}

export function ListRow({ title, subtitle, meta, icon, accent, onPress, right }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.pressed : null]}
    >
      {icon ? (
        <View style={[styles.iconWrap, accent ? { backgroundColor: accent } : null]}>
          <Ionicons name={icon} size={20} color={colors.white} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={typography.bodyStrong} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={typography.caption} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? <Text style={[typography.caption, styles.meta]}>{meta}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.navy700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  meta: { marginTop: 2 },
});
