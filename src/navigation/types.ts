import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  ForgotPassword: undefined;
};

export type TabsParamList = {
  HomeTab: undefined;
  MapTab: undefined;
  HistoryTab: undefined;
  ProfileTab: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList>;
  // Flujo Iniciar Servicio (RF-APP-03)
  StartServiceCamera: undefined;
  StartServiceConfirm: { fotoUri: string };
  // Registrar Incidente (RF-APP-08)
  RegisterIncident: { evidenciaUris?: string[] } | undefined;
  EvidenceCamera: {
    modo: 'foto' | 'video';
    evidenciasPrevias: string[];
    returnTo: 'RegisterIncident';
  };
  IncidentSuccess: undefined;
  // Registrar Mandado (RF-APP-06)
  RegisterErrand: undefined;
  ErrandSuccess: undefined;
  // Cerrar Servicio (RF-APP-07)
  CloseServiceSummary: undefined;
  ServiceFinished: undefined;
  // Historial (RF-APP-09)
  ShiftDetail: { turnoId: string };
  IncidentDetail: { incidenteId: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends AppStackParamList {}
  }
}
