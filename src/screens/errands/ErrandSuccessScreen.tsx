import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import { Button } from '@/components';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ErrandSuccess'>;

export function ErrandSuccessScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="checkmark-circle" size={96} color={colors.onDuty} />
      <Text style={[typography.h2, styles.center]}>Mandado registrado</Text>
      <Text style={[typography.caption, styles.center]}>
        Quedó guardado en el turno con su hora y ubicación.
      </Text>
      <View style={styles.actions}>
        <Button
          label="Volver al inicio"
          icon="home"
          large
          onPress={() => navigation.navigate('Tabs', { screen: 'HomeTab' })}
        />
        <Button
          label="Registrar otro mandado"
          variant="outline"
          onPress={() => navigation.replace('RegisterErrand')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xl },
});
