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
  const { isAuthenticated } = useAuth();
  return (
    <NavigationContainer theme={navTheme}>
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
