import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

const escudo = require('../../../assets/escudo.webp');

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace('Login'), 800);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image
        source={escudo}
        style={styles.escudo}
        resizeMode="contain"
        accessibilityLabel="Escudo del G.A.M. Cochabamba"
      />

      <Text style={styles.title}>Rondas</Text>
      <Text style={styles.subtitle}>Guardia Municipal</Text>
      <Text style={styles.org}>Dirección de Seguridad Ciudadana · G.A.M. Cochabamba</Text>

      <ActivityIndicator color={colors.gold} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  escudo: { width: 160, height: 160 },
  title: { color: colors.navy900, fontSize: 34, fontWeight: '800', marginTop: spacing.lg },
  subtitle: { color: colors.brand, fontSize: 16, fontWeight: '600', marginTop: 2 },
  org: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  spinner: { marginTop: spacing.xxl },
});
