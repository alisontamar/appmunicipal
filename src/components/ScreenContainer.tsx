import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { colors, spacing } from '@/theme';

type Edge = 'top' | 'bottom';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  /** respeta el safe area (por defecto solo inferior; con `header` se agrega el superior) */
  edges?: Edge[];
  /** encabezado fijo arriba del contenido (ej. <ScreenHeader title="Inicio" />) */
  header?: React.ReactNode;
  /** color de los íconos de la barra de estado: 'light' para fondos oscuros (por defecto). */
  statusBar?: 'light' | 'dark';
}

export function ScreenContainer({
  children,
  scroll = false,
  padded = true,
  style,
  edges = ['bottom'],
  header,
  statusBar = 'light',
}: Props) {
  const resolvedEdges: Edge[] =
    header && !edges.includes('top') ? ['top', ...edges] : edges;

  const inner = (
    <View style={[padded && styles.padded, !scroll && styles.flex, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={resolvedEdges}>
      <StatusBar style={statusBar} />
      {header ? <View style={styles.headerSlot}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  padded: { padding: spacing.lg },
  scrollContent: { flexGrow: 1 },
  headerSlot: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
});
