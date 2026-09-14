import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import { Button, ScreenContainer, TextField } from '@/components';
import * as authApi from '@/api/auth';
import { ApiError } from '@/api/client';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

type Step = 'formulario' | 'listo';

function mensajeError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'No se pudo cambiar la contraseña. Intente nuevamente.';
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('formulario');
  const [usuario, setUsuario] = useState('');
  const [ci, setCi] = useState('');
  const [telefono, setTelefono] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const cambiar = async () => {
    setError(undefined);
    if (!usuario.trim() || !ci.trim() || !telefono.trim()) {
      setError('Complete usuario, CI y teléfono.');
      return;
    }
    if (nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await authApi.resetearPassword(usuario.trim(), ci.trim(), telefono.trim(), nueva);
      setStep('listo');
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer scroll>
      {step === 'formulario' && (
        <>
          <Text style={typography.h2}>Recuperar contraseña</Text>
          <Text style={[typography.caption, styles.p]}>
            Todavía no hay un canal de correo o SMS configurado para enviar códigos. Verifique su
            identidad con los datos de su registro y defina su nueva contraseña directamente.
          </Text>
          <TextField
            label="Usuario"
            autoCapitalize="none"
            autoCorrect={false}
            value={usuario}
            onChangeText={setUsuario}
            placeholder="Ej. jperez"
            returnKeyType="next"
          />
          <TextField
            label="Cédula de identidad"
            value={ci}
            onChangeText={setCi}
            placeholder="Ej. 1234567"
            keyboardType="number-pad"
            returnKeyType="next"
          />
          <TextField
            label="Teléfono registrado"
            value={telefono}
            onChangeText={setTelefono}
            placeholder="Ej. 70012345"
            keyboardType="phone-pad"
            returnKeyType="next"
          />
          <TextField
            label="Nueva contraseña"
            secureTextEntry
            value={nueva}
            onChangeText={setNueva}
            placeholder="••••••••"
            hint="Mínimo 8 caracteres."
            error={error}
            returnKeyType="go"
            onSubmitEditing={cambiar}
          />
          <Button label="Cambiar contraseña" icon="key" large onPress={cambiar} loading={busy} />
          <Text style={[typography.caption, styles.nota]}>
            Si sus datos no coinciden, contacte a la Dirección de Seguridad Ciudadana para
            restablecer su acceso.
          </Text>
        </>
      )}

      {step === 'listo' && (
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={72} color={colors.onDuty} />
          <Text style={[typography.h2, styles.center]}>Contraseña actualizada</Text>
          <Text style={[typography.caption, styles.center]}>
            Ya puede iniciar sesión con su nueva contraseña.
          </Text>
          <Button label="Volver a iniciar sesión" large onPress={() => navigation.replace('Login')} />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  p: { marginVertical: spacing.md },
  nota: { textAlign: 'center', marginTop: spacing.md },
  done: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  center: { textAlign: 'center' },
});
