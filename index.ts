import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import * as SplashScreen from 'expo-splash-screen';

import App from './App';
import { widgetTaskHandler } from './src/widget/widgetTaskHandler';

// Mantiene el splash nativo hasta que la sesion se rehidrate (se oculta en RootNavigator).
SplashScreen.preventAutoHideAsync().catch(() => {});

registerRootComponent(App);

// Widget de pantalla de inicio (solo Android). Se registra aquí, en el punto de
// entrada, porque el sistema lo despierta sin montar la app.
if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
}
