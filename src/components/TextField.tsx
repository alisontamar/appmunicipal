import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/theme';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  /** El campo sigue siendo blanco; solo la etiqueta/hint se aclaran para fondos oscuros. */
  onDark?: boolean;
}

export const TextField = forwardRef<TextInput, Props>(function TextField(
  {
    label,
    hint,
    error,
    onDark = false,
    style,
    secureTextEntry,
    ...rest
  },
  ref,
) {
  // Si el campo es de contraseña, agregamos el ojo para mostrar/ocultar en
  // vez de dejarlo siempre oculto.
  const esPassword = Boolean(secureTextEntry);
  const [oculto, setOculto] = useState(true);

  return (
    <View style={styles.wrap}>
      <Text style={[typography.bodyStrong, styles.label, onDark && styles.labelOnDark]}>
        {label}
      </Text>
      <View style={styles.inputWrap}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            esPassword && styles.inputConIcono,
            error ? styles.inputError : null,
            style,
          ]}
          secureTextEntry={esPassword ? oculto : secureTextEntry}
          {...(esPassword
            ? {
                // En un campo de contrasena el teclado no debe alterar lo que se
                // escribe: si autocapitaliza o autocorrige, la clave deja de
                // coincidir con el hash de la BD y el login falla.
                autoCapitalize: 'none' as const,
                autoCorrect: false,
                spellCheck: false,
                autoComplete: 'off' as const,
                importantForAutofill: 'no' as const,
              }
            : null)}
          {...rest}
        />
        {esPassword && (
          <Pressable
            style={styles.iconoOjo}
            onPress={() => setOculto((v) => !v)}
            hitSlop={8}
            accessibilityLabel={oculto ? 'Mostrar contraseña' : 'Ocultar contraseña'}
          >
            <Ionicons
              name={oculto ? 'eye-off' : 'eye'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text style={[typography.caption, styles.error]}>{error}</Text>
      ) : hint ? (
        <Text style={[typography.caption, onDark && styles.hintOnDark]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs },
  labelOnDark: { color: colors.white },
  hintOnDark: { color: colors.grayLight },
  inputWrap: { justifyContent: 'center' },
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
  inputConIcono: { paddingRight: 44 },
  iconoOjo: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, marginTop: spacing.xs },
});
