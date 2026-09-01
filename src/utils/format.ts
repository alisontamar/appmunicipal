export function formatHora(iso?: string): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatFecha(iso?: string): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatFechaHora(iso?: string): string {
  if (!iso) return '--';
  return `${formatFecha(iso)} · ${formatHora(iso)}`;
}

/** Duracion legible entre dos ISO (o desde inicio hasta ahora). */
export function formatDuracion(inicioIso?: string, finIso?: string): string {
  if (!inicioIso) return '00:00';
  const fin = finIso ? new Date(finIso).getTime() : Date.now();
  const totalMin = Math.max(0, Math.floor((fin - new Date(inicioIso).getTime()) / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(2)} km`;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
