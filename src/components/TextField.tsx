import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  /** El campo sigue siendo blanco; solo la etiqueta/hint se aclaran para fondos oscuros. */
  onDark?: boolean;
}

export function TextField({ label, hint, error, onDark = false, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[typography.bodyStrong, styles.label, onDark && styles.labelOnDark]}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <Text style={[typography.caption, styles.error]}>{error}</Text>
      ) : hint ? (
        <Text style={[typography.caption, onDark && styles.hintOnDark]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs },
  labelOnDark: { color: colors.white },
  hintOnDark: { color: colors.grayLight },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, marginTop: spacing.xs },
});
