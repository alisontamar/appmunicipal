import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Alto de FloatingTabBar sin contar el inset inferior del dispositivo:
 * paddingTop del wrap (8) + alto del contenido de la píldora (paddingVertical
 * 8+8 del bar + paddingVertical 10+10 del item + 22 del ícono = 58) +
 * el "+4" fijo que el wrap le suma a su paddingBottom.
 * Si se cambia el padding/tamaño en FloatingTabBar.tsx, actualizar este valor.
 */
const TAB_BAR_FIXED_HEIGHT = 8 + 58 + 4;

/** Alto real (en px) que ocupa FloatingTabBar en este dispositivo, insets incluidos. */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_FIXED_HEIGHT + Math.max(insets.bottom, 10);
}
