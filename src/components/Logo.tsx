import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '@/theme';

const escudo = require('../../assets/escudo.webp');

/**
 * Escudo / logo institucional (assets/escudo.webp).
 * `onDark` ajusta el color del texto para fondos oscuros (negro institucional).
 */
export function Logo({
  size = 96,
  withText = true,
  onDark = true,
}: {
  size?: number;
  withText?: boolean;
  onDark?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Image
        source={escudo}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="Escudo del G.A.M. Cochabamba"
      />
      {withText ? (
        <View style={styles.textWrap}>
          <Text
            style={[typography.h3, styles.title, { color: onDark ? colors.white : colors.textPrimary }]}
          >
            Rondas · Guardia Municipal
          </Text>
          <Text
            style={[
              typography.caption,
              styles.subtitle,
              { color: onDark ? colors.grayLight : colors.textSecondary },
            ]}
          >
            Dirección de Seguridad Ciudadana · G.A.M. Cochabamba
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  textWrap: { alignItems: 'center', gap: 2 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
});
