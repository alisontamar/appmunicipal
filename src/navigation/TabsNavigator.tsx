import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from '@/theme';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { MapScreen } from '@/screens/map/MapScreen';
import { HistoryScreen } from '@/screens/history/HistoryScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { FloatingTabBar } from './FloatingTabBar';
import { SosButton } from '@/components/SosButton';
import { CheckpointBanner } from '@/components/CheckpointBanner';
import { TutorialProvider } from '@/tutorial/Tutorial';
import type { TabsParamList } from './types';

const Tab = createBottomTabNavigator<TabsParamList>();

export function TabsNavigator() {
  return (
    <TutorialProvider>
      <Tab.Navigator
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Inicio' }} />
        <Tab.Screen name="MapTab" component={MapScreen} options={{ title: 'Mapa' }} />
        <Tab.Screen name="HistoryTab" component={HistoryScreen} options={{ title: 'Historial' }} />
        <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Perfil' }} />
      </Tab.Navigator>
      <CheckpointBanner />
      <SosButton />
    </TutorialProvider>
  );
}

