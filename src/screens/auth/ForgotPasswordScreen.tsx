import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import { Button, ScreenContainer, TextField } from '@/components';
import * as authApi from '@/api/auth';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

type Step = 'solicitar' | 'codigo' | 'listo';

export function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('solicitar');
  const [identificador, setIdentificador] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [busy, setBusy] = useState(false);

  const solicitar = async () => {
    setBusy(true);
    try {
      await authApi.requestPasswordReset(identificador);
      setStep('codigo');
    } finally {
      setBusy(false);
    }
  };

  const confirmar = async () => {
    setBusy(true);
    try {
      await authApi.confirmPasswordReset(codigo, nueva);
      setStep('listo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer scroll>
      {step === 'solicitar' && (
        <>
          <Text style={typography.h2}>Recuperar contraseña</Text>
          <Text style={[typography.caption, styles.p]}>
            Enviaremos un código de verificación. El canal (correo o SMS) queda pendiente de
            definición por el cliente (RF-APP-02).
          </Text>
          <TextField
            label="Correo o número registrado"
            autoCapitalize="none"
            value={identificador}
            onChangeText={setIdentificador}
            placeholder="guardia@cochabamba.bo"
          />
          <Button label="Enviar código" icon="mail" large onPress={solicitar} loading={busy} />
        </>
      )}

      {step === 'codigo' && (
        <>
          <Text style={typography.h2}>Verificación</Text>
          <Text style={[typography.caption, styles.p]}>
            Ingrese el código recibido y defina su nueva contraseña.
          </Text>
          <TextField
            label="Código de verificación"
            keyboardType="number-pad"
            value={codigo}
            onChangeText={setCodigo}
            placeholder="6 dígitos"
          />
          <TextField
            label="Nueva contraseña"
            secureTextEntry
            value={nueva}
            onChangeText={setNueva}
            placeholder="••••••••"
          />
          <Button label="Guardar contraseña" icon="checkmark" large onPress={confirmar} loading={busy} />
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
  done: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  center: { textAlign: 'center' },
});
