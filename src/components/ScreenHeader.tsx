import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

const escudo = require('../../assets/escudo.png');

/**
 * Encabezado propio de las pantallas de pestañas: escudo + título sobre fondo claro
 * (reemplaza la barra de navegación azul nativa).
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  escudo: { width: 34, height: 34 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  spacer: { flex: 1 },
});
