import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, spacing, typography } from '@/theme';
import { Button, TextField } from '@/components';
import { useAuth } from '@/context/AuthContext';
import { autenticarConBiometria, biometriaDisponible } from '@/utils/biometria';
import type { AuthStackParamList } from '@/navigation/types';

const escudo = require('../../../assets/escudo.png');

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn, loading, ultimoUsuario } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [mostrarHuella, setMostrarHuella] = useState(false);

  // La huella solo tiene sentido si ya hay un usuario guardado de un login  anterior
  useEffect(() => {
    if (!ultimoUsuario) return;
    biometriaDisponible().then(setMostrarHuella);
  }, [ultimoUsuario]);

  const onSubmit = async () => {
    setError(undefined);
    if (!usuario.trim() || !password.trim()) {
      setError('Ingrese usuario y contraseña.');
      return;
    }
    try {
      await signIn(usuario.trim(), password);
    } catch {
      setError('No se pudo iniciar sesión. Intente nuevamente.');
    }
  };

  const onSubmitBiometria = async () => {
    if (!ultimoUsuario) return;
    const exito = await autenticarConBiometria('Ingrese con su huella o Face ID');
    if (!exito) return;
    try {
      // Fase estática de la biometría reemplaza la contraseña
      await signIn(ultimoUsuario, 'biometria');
    } catch {
      setError('No se pudo iniciar sesión. Intente nuevamente.');
    }
  };

  return (
    <View style={styles.root}>
      <Image
        source={escudo}
        style={styles.escudo}
        resizeMode="contain"
        accessibilityLabel="Escudo del G.A.M. Cochabamba"
      />

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headline}>
              <Text style={styles.title}>Iniciar{'\n'}sesión</Text>
              <Text style={styles.subtitle}>
                Guardia Municipal · Rondas{'\n'}
                Dirección de Seguridad Ciudadana · G.A.M. Cochabamba
              </Text>
            </View>

            <View style={styles.form}>
              <TextField
                label="Usuario"
                onDark
                autoCapitalize="none"
                autoCorrect={false}
                value={usuario}
                onChangeText={setUsuario}
                placeholder="Ej. jperez"
                returnKeyType="next"
              />
              <TextField
                label="Contraseña"
                onDark
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                error={error}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />

              <Button
                label="Ingresar"
                icon="arrow-forward"
                iconRight
                variant="secondary"
                large
                onPress={onSubmit}
                loading={loading}
                style={styles.cta}
              />

              {mostrarHuella && (
                <Pressable style={styles.huella} onPress={onSubmitBiometria} hitSlop={8}>
                  <Ionicons name="finger-print" size={22} color={colors.gold} />
                  <Text style={styles.huellaText}>Ingresar con huella / Face ID</Text>
                </Pressable>
              )}

              <Pressable
                style={styles.forgot}
                onPress={() => navigation.navigate('ForgotPassword')}
                hitSlop={8}
              >
                <Text style={styles.forgotText}>¿Olvidó su contraseña?</Text>
              </Pressable>
            </View>

            <Text style={styles.footer}>
              Fase estática · cualquier usuario y contraseña ingresan
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy900 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 190,
    paddingBottom: spacing.xl,
  },
  escudo: {
    position: 'absolute',
    top: 56,
    right: spacing.xl,
    width: 148,
    height: 148,
    pointerEvents: 'none',
  },
  headline: { marginBottom: spacing.xxl },
  title: { color: colors.white, fontSize: 40, fontWeight: '800', lineHeight: 44 },
  subtitle: {
    color: colors.grayLight,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  form: { marginTop: spacing.sm },
  cta: { marginTop: spacing.md },
  huella: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  huellaText: { color: colors.gold, fontWeight: '700', fontSize: 15 },
  forgot: { alignSelf: 'center', marginTop: spacing.sm, padding: spacing.sm },
  forgotText: { color: colors.gold, fontWeight: '700', fontSize: 15 },
  footer: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },
});