import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as incidentesApi from '@/api/incidentes';
import * as mandadosApi from '@/api/mandados';
import * as sosApi from '@/api/sos';
import * as turnosApi from '@/api/turnos';
import { useAuth } from '@/context/AuthContext';
import type { GeoPoint, Incidente, Mandado, Turno } from '@/types';
import { distanciaMetros } from '@/utils/geo';
import {
  iniciarSeguimientoUbicacion,
  obtenerUbicacionActual,
  type SeguimientoUbicacion,
} from '@/utils/location';

interface ShiftState {
  turno: Turno | null;
  
  historialTurnos: Turno[];
  enServicio: boolean;
  avisoUbicacion: string | null;
  iniciarServicio: (fotoUri: string) => Promise<Turno>;
  cerrarServicio: () => Promise<Turno>;
  agregarIncidente: (data: Omit<incidentesApi.NuevoIncidente, 'turnoId' | 'ubicacion'>) => Promise<Incidente>;
  agregarMandado: (descripcion: string) => Promise<Mandado>;
  dispararSos: () => Promise<sosApi.AlertaSos>;
  descartarTurno: () => void;
  ultimaUbicacion: () => Promise<GeoPoint>;
}

const ShiftContext = createContext<ShiftState | undefined>(undefined);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const { guardia } = useAuth();
  const [turno, setTurno] = useState<Turno | null>(null);
  const [historialTurnos, setHistorialTurnos] = useState<Turno[]>([]);
  const [avisoUbicacion, setAvisoUbicacion] = useState<string | null>(null);
  const seguimientoRef = useRef<SeguimientoUbicacion | null>(null);

  const detenerSeguimiento = useCallback(() => {
    seguimientoRef.current?.remove();
    seguimientoRef.current = null;
  }, []);

  const iniciarSeguimiento = useCallback(() => {
    detenerSeguimiento();
    setAvisoUbicacion(null);
    iniciarSeguimientoUbicacion(
      (punto) => {
        setTurno((prev) => {
          if (!prev || prev.estado !== 'en_servicio') return prev;
          const anterior = prev.recorrido[prev.recorrido.length - 1];
          const tramo = anterior ? distanciaMetros(anterior, punto) : 0;
          turnosApi.enviarUbicacion(prev.id, punto).catch(() => undefined);
          return {
            ...prev,
            recorrido: [...prev.recorrido, punto],
            distanciaMetros: prev.distanciaMetros + tramo,
          };
        });
      },
      (err) => setAvisoUbicacion(err.message),
    ).then((sub) => {
      seguimientoRef.current = sub;
    });
  }, [detenerSeguimiento]);

  useEffect(() => () => detenerSeguimiento(), [detenerSeguimiento]);

  const ultimaUbicacion = useCallback((): Promise<GeoPoint> => obtenerUbicacionActual(), []);

  const iniciarServicio = useCallback(
    async (fotoUri: string) => {
      const ubicacion = await obtenerUbicacionActual();
      const nuevo = await turnosApi.iniciarServicio(fotoUri, ubicacion);
      setTurno(nuevo);
      iniciarSeguimiento();
      return nuevo;
    },
    [iniciarSeguimiento],
  );

  const cerrarServicio = useCallback(async () => {
    if (!turno) throw new Error('No hay turno en curso');
    detenerSeguimiento();
    const ubicacionFin = await obtenerUbicacionActual();
    const finalizado = await turnosApi.cerrarServicio(turno, ubicacionFin);
    setTurno(finalizado);
    // Queda guardado para que el Historial lo muestre, aunque más tarde se
    // descarte el "turno actual" al volver a Inicio.
    setHistorialTurnos((prev) => [finalizado, ...prev]);
    return finalizado;
  }, [turno, detenerSeguimiento]);

  const agregarIncidente = useCallback<ShiftState['agregarIncidente']>(
    async (data) => {
      if (!turno) throw new Error('No hay turno en curso');
      const ubicacion = await obtenerUbicacionActual();
      const inc = await incidentesApi.registrarIncidente({
        ...data,
        turnoId: turno.id,
        ubicacion,
      });
      setTurno((prev) => (prev ? { ...prev, incidentes: [inc, ...prev.incidentes] } : prev));
      return inc;
    },
    [turno],
  );

  const agregarMandado = useCallback(
    async (descripcion: string) => {
      if (!turno) throw new Error('No hay turno en curso');
      const ubicacion = await obtenerUbicacionActual();
      const man = await mandadosApi.registrarMandado(turno.id, descripcion, ubicacion);
      setTurno((prev) => (prev ? { ...prev, mandados: [man, ...prev.mandados] } : prev));
      return man;
    },
    [turno],
  );

  const dispararSos = useCallback(async () => {
    if (!turno) throw new Error('No hay turno en curso');
    if (!guardia) throw new Error('No hay guardia autenticado');
    const ubicacion = await obtenerUbicacionActual();
    return sosApi.enviarAlertaSos(turno.id, guardia.id, ubicacion);
  }, [turno, guardia]);

  const descartarTurno = useCallback(() => setTurno(null), []);

  const value = useMemo<ShiftState>(
    () => ({
      turno,
      historialTurnos,
      enServicio: turno?.estado === 'en_servicio',
      avisoUbicacion,
      iniciarServicio,
      cerrarServicio,
      agregarIncidente,
      agregarMandado,
      dispararSos,
      descartarTurno,
      ultimaUbicacion,
    }),
    [
      turno,
      historialTurnos,
      avisoUbicacion,
      iniciarServicio,
      cerrarServicio,
      agregarIncidente,
      agregarMandado,
      dispararSos,
      descartarTurno,
      ultimaUbicacion,
    ],
  );

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
}

export function useShift(): ShiftState {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift debe usarse dentro de <ShiftProvider>');
  return ctx;
}