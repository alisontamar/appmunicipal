import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '@/theme';
import { TabsNavigator } from './TabsNavigator';
import { StartServiceCameraScreen } from '@/screens/service/StartServiceCameraScreen';
import { StartServiceConfirmScreen } from '@/screens/service/StartServiceConfirmScreen';
import { CloseServiceSummaryScreen } from '@/screens/service/CloseServiceSummaryScreen';
import { ServiceFinishedScreen } from '@/screens/service/ServiceFinishedScreen';
import { RegisterIncidentScreen } from '@/screens/incidents/RegisterIncidentScreen';
import { EvidenceCameraScreen } from '@/screens/incidents/EvidenceCameraScreen';
import { IncidentSuccessScreen } from '@/screens/incidents/IncidentSuccessScreen';
import { IncidentDetailScreen } from '@/screens/incidents/IncidentDetailScreen';
import { RegisterErrandScreen } from '@/screens/errands/RegisterErrandScreen';
import { ErrandSuccessScreen } from '@/screens/errands/ErrandSuccessScreen';
import { ShiftDetailScreen } from '@/screens/history/ShiftDetailScreen';
import { CheckpointCameraScreen } from '@/screens/service/CheckpointCameraScreen';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy900 },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />

      <Stack.Group screenOptions={{ presentation: 'card' }}>
        <Stack.Screen
          name="StartServiceCamera"
          component={StartServiceCameraScreen}
          options={{ title: 'Iniciar servicio' }}
        />
        <Stack.Screen
          name="StartServiceConfirm"
          component={StartServiceConfirmScreen}
          options={{ title: 'Confirmar inicio' }}
        />
        <Stack.Screen
          name="CloseServiceSummary"
          component={CloseServiceSummaryScreen}
          options={{ title: 'Cerrar servicio' }}
        />
        <Stack.Screen
          name="ServiceFinished"
          component={ServiceFinishedScreen}
          options={{ title: 'Turno finalizado', headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="RegisterIncident"
          component={RegisterIncidentScreen}
          options={{ title: 'Registrar incidente' }}
        />
        <Stack.Screen
          name="EvidenceCamera"
          component={EvidenceCameraScreen}
          options={{ title: 'Adjuntar evidencia', headerShown: false }}
        />
        <Stack.Screen
          name="IncidentSuccess"
          component={IncidentSuccessScreen}
          options={{ title: 'Incidente registrado', headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="RegisterErrand"
          component={RegisterErrandScreen}
          options={{ title: 'Registrar tarea' }}
        />
        <Stack.Screen
          name="ErrandSuccess"
          component={ErrandSuccessScreen}
          options={{ title: 'Tarea registrada', headerBackVisible: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="ShiftDetail"
          component={ShiftDetailScreen}
          options={{ title: 'Detalle del turno' }}
        />
        <Stack.Screen
          name="CheckpointCamera"
          component={CheckpointCameraScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="IncidentDetail"
          component={IncidentDetailScreen}
          options={{ title: 'Detalle del incidente' }}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
}