import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
// v2: el tutorial cambió (botón central de incidentes), se vuelve a mostrar una vez.
const clave = (f: FaseTutorial) => `tutorial_visto_v2_${f}`;

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
  const { isLastStep, isFirstStep, goToNext, goToPrev, stop, currentStep } = useCopilot();
  // El ancho lo fija el `tooltipStyle` del provider, no el card. La librería
  // calculaba su propio `maxWidth` a partir del `x` del objetivo (dist/index.js:592),
  // así que en los ítems de la 3ª columna el card quedaba de ~112px y el texto y
  // los botones se cortaban. `100%` deja que el ancho lo imponga el provider.
  return (
    <View style={[styles.card, { width: '100%' }]}>
      <Text style={styles.texto}>{currentStep?.text}</Text>
      <View style={styles.fila}>
        <View style={styles.acciones}>
          <Pressable onPress={() => stop()} hitSlop={8}>
            <Text style={styles.saltar}>{labels.skip}</Text>
          </Pressable>
          {isFirstStep ? null : (
            <Pressable onPress={() => goToPrev()} hitSlop={8}>
              <Text style={styles.saltar}>{labels.previous}</Text>
            </Pressable>
          )}
        </View>
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
  const { width: screenWidth } = useWindowDimensions();
  // La librería posiciona el tooltip a partir del objetivo y le pone un
  // `maxWidth` = anchoPantalla - xObjetivo - margin, que para objetivos del lado
  // derecho deja un ancho inservible (ver dist/index.js:581-593). Este estilo se
  // aplica DESPUÉS del que calcula la librería (dist/index.js:744), así que fija
  // un ancho que siempre entra en pantalla sin importar dónde esté el foco.
  const ancho = Math.max(200, screenWidth - spacing.lg * 2);
  return (
    <CopilotProvider
      tooltipComponent={Tooltip}
      overlay="svg"
      svgMaskPath={mascaraRedondeada}
      tooltipStyle={{
        left: spacing.lg,
        right: spacing.lg,
        width: ancho,
        maxWidth: ancho,
        paddingTop: 0,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
        borderRadius: radius.lg,
      }}
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
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    gap: spacing.md,
  },
  // '500' no es un peso soportado de forma consistente en Android: el texto
  // salía con espaciado raro entre letras.
  texto: { fontSize: 14, lineHeight: 20, color: colors.textPrimary, fontWeight: '400' },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Sin flexShrink: con 3 elementos en un ancho chico la fila se comprimía y los
  // textos se cortaban a media palabra.
  acciones: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 0 },
  saltar: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  boton: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  botonTexto: { color: colors.white, fontWeight: '800', fontSize: 13 },
});
