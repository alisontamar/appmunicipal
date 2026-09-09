import React from 'react';
import { DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';

import { colors } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.navy900,
    background: colors.background,
    card: colors.navy900,
    text: colors.white,
    border: colors.border,
  },
};

export function RootNavigator() {
  const { isAuthenticated, booting } = useAuth();
  // Mientras se rehidrata la sesion guardada, no montamos ningun navegador
  // (evita el parpadeo Login -> App cuando el token es valido).
  if (booting) return null;
  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
