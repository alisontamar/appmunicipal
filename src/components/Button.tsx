import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Coloca el ícono a la derecha del texto (ej. «Ingresar →»). */
  iconRight?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Botones grandes para uso en campo (RF no funcional: usabilidad). */
  large?: boolean;
  style?: ViewStyle;
}

const bg: Record<Variant, string> = {
  primary: colors.navy900,
  secondary: colors.gold,
  outline: colors.transparent,
  danger: colors.danger,
};

const fg: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.white,
  outline: colors.navy900,
  danger: colors.white,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight = false,
  loading = false,
  disabled = false,
  large = false,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        large && styles.large,
        { backgroundColor: bg[variant] },
        variant === 'outline' && styles.outline,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={fg[variant]} />
        ) : (
          <>
            {icon && !iconRight && (
              <Ionicons name={icon} size={large ? 24 : 20} color={fg[variant]} style={styles.iconLeft} />
            )}
            <Text style={[typography.button, { color: fg[variant] }, large && styles.largeLabel]}>
              {label}
            </Text>
            {icon && iconRight && (
              <Ionicons name={icon} size={large ? 24 : 20} color={fg[variant]} style={styles.iconRight} />
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: { paddingVertical: spacing.lg + 2, borderRadius: radius.lg },
  largeLabel: { fontSize: 19 },
  outline: { borderWidth: 2, borderColor: colors.navy900 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center' },
  iconLeft: { marginRight: spacing.sm },
  iconRight: { marginLeft: spacing.sm },
});
