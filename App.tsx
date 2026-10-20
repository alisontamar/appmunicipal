import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { ShiftProvider } from '@/context/ShiftContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { RouteChangeWatcher } from '@/components';
import { WidgetOverlayBridge } from '@/components/WidgetOverlayBridge';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ShiftProvider>
            <StatusBar style="light" />
            <RouteChangeWatcher />
            <WidgetOverlayBridge />
            <RootNavigator />
          </ShiftProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
