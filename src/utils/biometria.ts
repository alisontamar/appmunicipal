import * as LocalAuthentication from 'expo-local-authentication';


export async function biometriaDisponible(): Promise<boolean> {
  try {
    const tieneHardware = await LocalAuthentication.hasHardwareAsync();
    if (!tieneHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch (e) {
    console.warn('[Biometría] no disponible:', e);
    return false;
  }
}

export async function autenticarConBiometria(mensaje: string): Promise<boolean> {
  try {
    const disponible = await biometriaDisponible();
    if (!disponible) return false;

    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage: mensaje,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });

    return resultado.success;
  } catch (e) {
    console.warn('[Biometría] error al autenticar:', e);
    return false;
  }
}