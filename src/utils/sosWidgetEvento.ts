/**
 * Avisa a la app cuando el widget mandó un SOS, para que el botón SOS muestre
 * ACTIVO aunque el envío haya salido desde fuera de la app.
 */

/** Un SOS del widget más viejo que esto ya no se muestra como activo. */
export const VENTANA_SOS_WIDGET_MS = 30 * 60_000;

type Oyente = (ts: number) => void;
const oyentes = new Set<Oyente>();

export function notificarSosWidget(ts: number): void {
  oyentes.forEach((o) => o(ts));
}

export function suscribirSosWidget(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}
