import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import * as SplashScreen from 'expo-splash-screen';

import App from './App';

// Mantiene el splash nativo hasta que la sesion se rehidrate (se oculta en RootNavigator).
SplashScreen.preventAutoHideAsync().catch(() => {});

registerRootComponent(App);
