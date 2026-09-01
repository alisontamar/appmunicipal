import { useCallback, useEffect, useState } from 'react';

import type { GeoPoint } from '@/types';
import { obtenerUbicacionActual, UbicacionDenegadaError } from '@/utils/location';

const UMBRAL_LENTO_MS = 6000;

interface EstadoUbicacion {
  ubicacion: GeoPoint | null;
  cargando: boolean;
  tardando: boolean;
  error: string | null;
  permisoDenegado: boolean;
  reintentar: () => void;
}

export function useUbicacionActual(): EstadoUbicacion {
  const [ubicacion, setUbicacion] = useState<GeoPoint | null>(null);
  const [cargando, setCargando] = useState(true);
  const [tardando, setTardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permisoDenegado, setPermisoDenegado] = useState(false);
  const [intento, setIntento] = useState(0);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setTardando(false);
    setError(null);
    setPermisoDenegado(false);

    // Aviso extra si el GPS tarda
    const avisoTardanza = setTimeout(() => {
      if (vigente) setTardando(true);
    }, UMBRAL_LENTO_MS);

    obtenerUbicacionActual()
      .then((punto) => {
        if (vigente) setUbicacion(punto);
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setPermisoDenegado(e instanceof UbicacionDenegadaError);
        setError(e instanceof Error ? e.message : 'No se pudo obtener la ubicación.');
      })
      .finally(() => {
        if (vigente) {
          setCargando(false);
          setTardando(false);
        }
      });

    return () => {
      vigente = false;
      clearTimeout(avisoTardanza);
    };
  }, [intento]);

  return { ubicacion, cargando, tardando, error, permisoDenegado, reintentar };
}