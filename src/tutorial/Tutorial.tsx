import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CopilotProvider,
  CopilotStep,
  useCopilot,
  walkthroughable,
  type TooltipProps,
  type CopilotProps,
} from 'react-native-copilot';

type SvgMaskPathFunction = NonNullable<CopilotProps['svgMaskPath']>;

import { colors, radius, spacing } from '@/theme';

export const Walkthroughable = walkthroughable(View);
export { CopilotStep, useCopilot };

/** Cada fase se muestra una sola vez por instalación. */
export type FaseTutorial = 'inicio' | 'servicio';
const clave = (f: FaseTutorial) => `tutorial_visto_${f}`;

export async function tutorialVisto(f: FaseTutorial): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(clave(f))) === '1';
  } catch {
    return true; // ante la duda no molestar
  }
}

export function marcarTutorialVisto(f: FaseTutorial) {
  AsyncStorage.setItem(clave(f), '1').catch(() => {});
}

function Tooltip({ labels }: TooltipProps) {
  const { isLastStep, goToNext, stop, currentStep } = useCopilot();
  return (
    <View style={styles.card}>
      <Text style={styles.texto}>{currentStep?.text}</Text>
      <View style={styles.fila}>
        {!isLastStep ? (
          <Pressable onPress={() => stop()} hitSlop={8}>
            <Text style={styles.saltar}>{labels.skip}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={() => (isLastStep ? stop() : goToNext())} style={styles.boton}>
          <Text style={styles.botonTexto}>{isLastStep ? labels.finish : labels.next}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Recorte con esquinas redondeadas (el de fábrica es un rectángulo con ángulos rectos).
const PAD = 6;
const RADIO = 18;
const mascaraRedondeada: SvgMaskPathFunction = ({ size, position, canvasSize }) => {
  const x = (position.x as any)._value - PAD;
  const y = (position.y as any)._value - PAD;
  const w = (size.x as any)._value + PAD * 2;
  const h = (size.y as any)._value + PAD * 2;
  const r = Math.min(RADIO, w / 2, h / 2);
  return (
    `M0,0H${canvasSize.x}V${canvasSize.y}H0V0Z` +
    `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}` +
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}` +
    `V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`
  );
};

/** Provider del tutorial con el estilo de la app, en español. */
export function TutorialProvider({ children }: { children: React.ReactNode }) {
  return (
    <CopilotProvider
      tooltipComponent={Tooltip}
      overlay="svg"
      svgMaskPath={mascaraRedondeada}
      animated
      backdropColor="rgba(15, 23, 42, 0.78)"
      arrowColor={colors.white}
      labels={{ previous: 'Anterior', next: 'Siguiente', skip: 'Saltar', finish: 'Listo' }}
      stepNumberComponent={() => null}
    >
      {children}
    </CopilotProvider>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    width: 270,
    gap: spacing.md,
  },
  texto: { fontSize: 14, lineHeight: 20, color: colors.textPrimary, fontWeight: '500' },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saltar: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  boton: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  botonTexto: { color: colors.white, fontWeight: '800', fontSize: 13 },
});
