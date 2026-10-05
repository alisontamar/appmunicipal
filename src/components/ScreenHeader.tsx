import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

const escudo = require('../../assets/escudo.webp');

/**
 * Encabezado propio de las pantallas de pestañas: escudo + título sobre la banda morada
 * que dibuja ScreenContainer (reemplaza la barra de navegación nativa).
 */
export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.escudoWrap}>
        <Image
          source={escudo}
          style={styles.escudo}
          resizeMode="contain"
          accessibilityLabel="Escudo del G.A.M. Cochabamba"
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  escudoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  escudo: { width: 30, height: 30 },
  title: { fontSize: 20, fontWeight: '700', color: colors.white },
  spacer: { flex: 1 },
});
