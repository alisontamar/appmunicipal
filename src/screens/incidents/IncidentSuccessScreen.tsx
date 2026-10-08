import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import { Button } from '@/components';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'IncidentSuccess'>;

export function IncidentSuccessScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="checkmark-circle" size={96} color={colors.onDuty} />
      <Text style={[typography.h2, styles.center]}>Incidente registrado</Text>
      <Text style={[typography.caption, styles.center]}>
        El reporte se envió con ubicación y hora. Podrá consultarlo en el historial y quedará
        disponible para el panel de administración.
      </Text>
      <View style={styles.actions}>
        <Button
          label="Volver al inicio"
          icon="home"
          large
          onPress={() => navigation.navigate('Tabs', { screen: 'HomeTab' })}
        />
        <Button
          label="Registrar otro incidente"
          variant="outline"
          onPress={() => navigation.replace('IncidentCamera')}
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