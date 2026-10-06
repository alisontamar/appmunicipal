import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  /** pull-to-refresh */
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Referencia al ScrollView interno. Necesaria cuando hay un tour guiada
   * (react-native-copilot) sobre elementos que viven dentro del scroll: la
   * librería la usa con `start(fromStep, scrollView)` para traer cada objetivo
   * a la vista antes de medirlo.
   */
  scrollRef?: React.RefObject<ScrollView | null>;
}

export function ScreenContainer({
  children,
  scroll = false,
  padded = true,
  style,
  edges = ['bottom'],
  header,
  statusBar = 'light',
  refreshing,
  onRefresh,
  scrollRef,
}: Props) {
  const insets = useSafeAreaInsets();
  // Con header, la banda morada cubre la zona de la barra de estado, asi que el
  // SafeAreaView ya no reserva el borde superior (lo hace el propio header).
  const resolvedEdges: Edge[] = header ? edges.filter((e) => e !== 'top') : edges;

  const inner = (
    <View style={[padded && styles.padded, !scroll && styles.flex, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={resolvedEdges}>
      <StatusBar style={header ? 'light' : statusBar} />
      {header ? (
        <View style={[styles.headerSlot, { paddingTop: insets.top + spacing.sm }]}>{header}</View>
      ) : null}
      {scroll ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.navy900]} tintColor={colors.navy900} /> : undefined
            }
          >
            {inner}
          </ScrollView>
        </KeyboardAvoidingView>
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
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: spacing.xs,
  },
});
