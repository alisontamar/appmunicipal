import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';

import { colors } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.background,
    card: colors.brand,
    text: colors.white,
    border: colors.border,
  },
};

export function RootNavigator() {
  const { isAuthenticated, booting } = useAuth();

  useEffect(() => {
    if (!booting) SplashScreen.hideAsync().catch(() => {});
  }, [booting]);

  // Mientras se rehidrata la sesion guardada, no montamos ningun navegador
  // (evita el parpadeo Login -> App cuando el token es valido). Se muestra un
  // fondo de marca en vez de null para que nunca quede la pantalla negra.
  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    );
  }
  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
