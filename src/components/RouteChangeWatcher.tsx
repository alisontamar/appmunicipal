import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useShift } from '@/context/ShiftContext';

/**
 * Muestra el aviso de ruta asignada/modificada/eliminada (ShiftContext)
 * como un Alert nativo — se monta UNA vez en App.tsx, fuera de cualquier
 * tab, para que aparezca sin importar si el guardia está en Inicio,
 * Historial, Perfil o Mapa (pedido explícito: antes solo se enteraba si
 * tenía la pestaña de Mapa abierta, o saliendo y volviendo a entrar).
 * No renderiza nada — es un observador puro del estado del contexto.
 */
export function RouteChangeWatcher() {
  const { avisoRuta, limpiarAvisoRuta } = useShift();

  useEffect(() => {
    if (!avisoRuta) return;
    Alert.alert(avisoRuta.titulo, avisoRuta.mensaje, [{ text: 'Entendido', onPress: limpiarAvisoRuta }], {
      onDismiss: limpiarAvisoRuta,
    });
  }, [avisoRuta, limpiarAvisoRuta]);

  return null;
}
