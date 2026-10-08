import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

const escudo = require('../../assets/escudo.webp');

/**
 * Encabezado propio de las pantallas de pestañas: escudo + título sobre la banda de color
 * que dibuja ScreenContainer (reemplaza la barra de navegación nativa).
 */
export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Image
        source={escudo}
        style={styles.escudo}
        resizeMode="contain"
        accessibilityLabel="Escudo del G.A.M. Cochabamba"
      />
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // El escudo (491x640) va suelto sobre el encabezado, sin circulo blanco detras.
  escudo: { width: 38, height: 50 },
  title: { fontSize: 20, fontWeight: '700', color: colors.white },
  spacer: { flex: 1 },
});
