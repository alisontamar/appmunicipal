import { createNavigationContainerRef } from '@react-navigation/native';

import type { AppStackParamList } from './types';

/** Referencia global al navegador: permite navegar desde fuera de las pantallas (acciones del widget). */
export const navigationRef = createNavigationContainerRef<AppStackParamList>();
