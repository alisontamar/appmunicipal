import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Foto del guardia; si no hay `uri`, muestra las iniciales sobre morado institucional. */
export function Avatar({ name, uri, size = 56 }: { name: string; uri?: string; size?: number }) {
  const dim = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.base, dim]} accessibilityLabel={name} />;
  }

  return (
    <View style={[styles.base, styles.fallback, dim]}>
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.navy700,
  },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.white, fontWeight: '700' },
});
