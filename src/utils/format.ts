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

/** Duracion legible entre dos ISO (o desde inicio hasta ahora) — con segundos en vivo. */
export function formatDuracion(inicioIso?: string, finIso?: string): string {
  if (!inicioIso) return '00:00:00';
  const fin = finIso ? new Date(finIso).getTime() : Date.now();
  const totalSeg = Math.max(0, Math.floor((fin - new Date(inicioIso).getTime()) / 1000));
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(2)} km`;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
