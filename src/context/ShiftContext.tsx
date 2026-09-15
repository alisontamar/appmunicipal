import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import NetInfo from '@react-native-community/netinfo';

import * as checkpointsApi from '@/api/checkpoints';
import * as incidentesApi from '@/api/incidentes';
import * as mandadosApi from '@/api/mandados';
import * as sosApi from '@/api/sos';
import * as turnosApi from '@/api/turnos';
import { useAuth } from '@/context/AuthContext';
import type { Checkpoint, GeoPoint, Incidente, Mandado, Turno } from '@/types';
import { distanciaMetros } from '@/utils/geo';
import {
  iniciarSeguimientoUbicacion,
  obtenerUbicacionActual,
  type SeguimientoUbicacion,
} from '@/utils/location';
import {
  encolar,
  hayConexion,
  listarPendientes,
  sincronizarPendientes,
  type ItemPendiente,
} from '@/utils/offlineQueue';

const CHECKPOINT_INTERVALO_MS = 30 * 60 * 1000;
const CHECKPOINT_GRACIA_MS = CHECKPOINT_INTERVALO_MS;
const CHECKPOINT_TICK_MS = 15_000;

// Umbral anti-ruido del GPS: entre dos lecturas seguidas, un desplazamiento
// menor a esto casi siempre es deriva del GPS (de pie el punto "baila" varios
// metros), no movimiento real. Por debajo no se acumula distancia ni se guarda
// el punto en el recorrido. Las lecturas reales caminando quedan muy por encima
// (watchPositionAsync ya emite cada ~25 m al moverse).
const MIN_DESPLAZAMIENTO_M = 10;

interface ShiftState {
  turno: Turno | null;
  historialTurnos: Turno[];
  enServicio: boolean;
  avisoUbicacion: string | null;
  checkpointPendiente: boolean;
  pendientesSincronizar: number;
  iniciarServicio: (fotoUri: string) => Promise<Turno>;
  cerrarServicio: () => Promise<Turno>;
  agregarIncidente: (data: Omit<incidentesApi.NuevoIncidente, 'turnoId' | 'ubicacion'>) => Promise<Incidente>;
  agregarMandado: (descripcion: string) => Promise<Mandado>;
  dispararSos: () => Promise<sosApi.AlertaSos>;
  registrarCheckpoint: (fotoUri: string) => Promise<Checkpoint>;
  descartarTurno: () => void;
  ultimaUbicacion: () => Promise<GeoPoint>;
  sincronizarAhora: () => Promise<void>;
}

const ShiftContext = createContext<ShiftState | undefined>(undefined);

// Reconstruye un objeto "de mentira" con id local mientras no hay señal,
// para que el guardia vea su registro de inmediato en la pantalla aunque
// todavia no se haya enviado de verdad.
function incidenteLocal(data: incidentesApi.NuevoIncidente): Incidente {
  return {
    id: `local-${Date.now()}`,
    turnoId: data.turnoId,
    tipo: data.tipo,
    descripcion: data.descripcion,
    nivelRiesgo: data.nivelRiesgo,
    ubicacion: data.ubicacion,
    evidenciaUrls: data.evidenciaUris,
    creadoEn: data.ubicacion.timestamp,
    estado: 'reportado',
  };
}

function mandadoLocal(turnoId: string, descripcion: string, ubicacion: GeoPoint): Mandado {
  return { id: `local-${Date.now()}`, turnoId, descripcion, ubicacion, creadoEn: ubicacion.timestamp };
}

function checkpointLocal(turnoId: string, fotoUri: string, ubicacion: GeoPoint): Checkpoint {
  return {
    id: `local-${Date.now()}`,
    turnoId,
    estado: 'realizado',
    fotoUri,
    ubicacion,
    creadoEn: ubicacion.timestamp,
  };
}

function sosLocal(turnoId: string, guardiaId: string, ubicacion: GeoPoint): sosApi.AlertaSos {
  return { id: `local-${Date.now()}`, turnoId, guardiaId, ubicacion, creadoEn: ubicacion.timestamp };
}

// Punto unico donde se decide "mando ahora" o "guardo para despues". Si
// intentarEnviar() falla (o de plano no hay señal), va a la cola offline.
// Antes preguntaba hayConexion() primero y si NetInfo decía "desconectado" ni siquiera
// intentaba el fetch, quedando el mandado en cola 5 minutos hasta el próximo sync.
// Ahora intenta enviar siempre; solo encola si el fetch falla de verdad.
async function enviarOEncolar<T>(
  tipo: ItemPendiente['tipo'],
  payload: unknown,
  intentarEnviar: () => Promise<T>,
  construirLocal: () => T,
): Promise<T> {
  try {
    return await intentarEnviar();
  } catch (e) {
    // Solo encola si el intento real falló (sin señal o error de red)
    const conectado = await hayConexion().catch(() => false);
    console.warn(`[Offline] fallo el envio (${tipo}), se encola (conectado=${conectado}):`, e);
    await encolar(tipo, payload);
    return construirLocal();
  }
}

// Como reintentar cada tipo de pendiente cuando vuelve la señal.
async function reintentarPendiente(item: ItemPendiente): Promise<void> {
  switch (item.tipo) {
    case 'incidente':
      await incidentesApi.registrarIncidente(item.payload as incidentesApi.NuevoIncidente);
      return;
    case 'mandado': {
      const p = item.payload as { turnoId: string; descripcion: string; ubicacion: GeoPoint };
      await mandadosApi.registrarMandado(p.turnoId, p.descripcion, p.ubicacion);
      return;
    }
    case 'checkpoint': {
      const p = item.payload as { turnoId: string; fotoUri: string; ubicacion: GeoPoint };
      await checkpointsApi.registrarCheckpoint(p.turnoId, p.fotoUri, p.ubicacion);
      return;
    }
    case 'sos': {
      const p = item.payload as { turnoId: string; guardiaId: string; ubicacion: GeoPoint };
      await sosApi.enviarAlertaSos(p.turnoId, p.guardiaId, p.ubicacion);
      return;
    }
    case 'ubicacion': {
      const p = item.payload as { turnoId: string; punto: GeoPoint };
      await turnosApi.enviarUbicacion(p.turnoId, p.punto);
      return;
    }
  }
}

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const { guardia } = useAuth();
  const [turno, setTurno] = useState<Turno | null>(null);
  const [historialTurnos, setHistorialTurnos] = useState<Turno[]>([]);
  const [avisoUbicacion, setAvisoUbicacion] = useState<string | null>(null);
  const [checkpointPendiente, setCheckpointPendiente] = useState(false);
  const [pendientesSincronizar, setPendientesSincronizar] = useState(0);
  const seguimientoRef = useRef<SeguimientoUbicacion | null>(null);
  const proximoCheckpointRef = useRef<number | null>(null);
  const checkpointVenceRef = useRef<number | null>(null);
  const conectadoAntesRef = useRef<boolean | null>(null);
  const rehidratadoRef = useRef<string | null>(null);

  const refrescarPendientes = useCallback(async () => {
    const items = await listarPendientes();
    setPendientesSincronizar(items.length);
  }, []);

  const sincronizarAhora = useCallback(async () => {
    const { enviados } = await sincronizarPendientes(reintentarPendiente);
    if (enviados > 0) console.log(`[Offline] sincronizados ${enviados} pendiente(s)`);
    await refrescarPendientes();
  }, [refrescarPendientes]);

  // Al abrir la app: si ya hay señal, intenta vaciar lo que haya quedado
  // pendiente de una sesion anterior.
  useEffect(() => {
    refrescarPendientes();
    sincronizarAhora();
  }, [refrescarPendientes, sincronizarAhora]);

  // Dispara la sincronizacion automaticamente en el momento exacto en que
  // vuelve la señal (no hace falta que el guardia haga nada).
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((estado) => {
      const conectadoAhora = Boolean(estado.isConnected && estado.isInternetReachable !== false);
      if (conectadoAhora && conectadoAntesRef.current === false) {
        sincronizarAhora();
      }
      conectadoAntesRef.current = conectadoAhora;
    });
    return () => unsubscribe();
  }, [sincronizarAhora]);

  // Sincronización periódica cada 30s: antes solo se sincronizaba al volver la señal,
  // por eso un mandado encolado por un fallo transitorio quedaba 5 minutos en cola
  // hasta que el guardia moviera el teléfono y cambiara el estado de NetInfo.
  useEffect(() => {
    const id = setInterval(() => {
      sincronizarAhora();
    }, 30_000);
    return () => clearInterval(id);
  }, [sincronizarAhora]);

  const detenerSeguimiento = useCallback(() => {
    seguimientoRef.current?.remove();
    seguimientoRef.current = null;
  }, []);

  const enviarUbicacionOEncolar = useCallback(
    (turnoId: string, punto: GeoPoint) => {
      enviarOEncolar(
        'ubicacion',
        { turnoId, punto },
        () => turnosApi.enviarUbicacion(turnoId, punto),
        () => ({ ok: true }),
      ).then(refrescarPendientes);
    },
    [refrescarPendientes],
  );

  const iniciarSeguimiento = useCallback(() => {
    detenerSeguimiento();
    setAvisoUbicacion(null);
    iniciarSeguimientoUbicacion(
      (punto) => {
        setTurno((prev) => {
          if (!prev || prev.estado !== 'en_servicio') return prev;
          enviarUbicacionOEncolar(prev.id, punto);
          const anterior = prev.recorrido[prev.recorrido.length - 1];
          const tramo = anterior ? distanciaMetros(anterior, punto) : 0;
          // Quieto o micro-movimiento: no suma metros ni ensucia el recorrido.
          if (anterior && tramo < MIN_DESPLAZAMIENTO_M) return prev;
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
  }, [detenerSeguimiento, enviarUbicacionOEncolar]);

  useEffect(() => {
    if (!turno || turno.estado !== 'en_servicio') return;

    const id = setInterval(() => {
      const ahora = Date.now();

      if (
        !checkpointPendiente &&
        proximoCheckpointRef.current !== null &&
        ahora >= proximoCheckpointRef.current
      ) {
        setCheckpointPendiente(true);
        checkpointVenceRef.current = ahora + CHECKPOINT_GRACIA_MS;
      }

      if (checkpointVenceRef.current !== null && ahora >= checkpointVenceRef.current) {
        const perdido: Checkpoint = {
          id: `chk-${ahora}`,
          turnoId: turno.id,
          estado: 'perdido',
          creadoEn: new Date(ahora).toISOString(),
        };
        setTurno((prev) =>
          prev ? { ...prev, checkpoints: [perdido, ...prev.checkpoints] } : prev,
        );
        setCheckpointPendiente(false);
        checkpointVenceRef.current = null;
        proximoCheckpointRef.current = ahora + CHECKPOINT_INTERVALO_MS;
      }
    }, CHECKPOINT_TICK_MS);

    return () => clearInterval(id);
  }, [turno, checkpointPendiente]);

  useEffect(() => () => detenerSeguimiento(), [detenerSeguimiento]);

  // Si el proceso de la app murió mientras había un servicio en curso (p. ej. Android
  // lo mata al salir), al reabrir la app AuthContext rehidrata la sesión pero este
  // contexto arrancaba con turno=null aunque en el backend el turno seguía
  // "en_servicio" — dejando al guardia sin poder iniciar ni cerrar nada. Al tener
  // guardia autenticado, se busca si ya hay un turno abierto y se retoma.
  useEffect(() => {
    if (!guardia || rehidratadoRef.current === guardia.id) return;
    rehidratadoRef.current = guardia.id;

    (async () => {
      try {
        const turnos = await turnosApi.listarTurnos();
        const activo = turnos.find((t) => t.estado === 'en_servicio');
        if (!activo) return;

        let recorrido = activo.recorrido;
        let distanciaMetros = activo.distanciaMetros;
        try {
          const r = await turnosApi.obtenerRecorrido(activo.id);
          if (r.puntos.length > 0) recorrido = r.puntos;
          if (r.distanciaMetros != null) distanciaMetros = r.distanciaMetros;
        } catch {
          // se mantiene el recorrido minimo (solo el punto de inicio)
        }

        let incidentes = activo.incidentes;
        let mandados = activo.mandados;
        try {
          const [todosIncidentes, todosMandados] = await Promise.all([
            incidentesApi.listarIncidentes(),
            mandadosApi.listarMandados(),
          ]);
          // Incluir incidentes/mandados sin turnoId (creados antes de vincular turno o con sync offline)
          // para que no aparezca "0 incidencias" aunque ya registraste varios
          incidentes = todosIncidentes.filter((i) => !i.turnoId || i.turnoId === activo.id);
          mandados = todosMandados.filter((m) => !m.turnoId || m.turnoId === activo.id);
          if (todosIncidentes.length > 0 && incidentes.length === 0) incidentes = todosIncidentes.slice(0, 20);
          if (todosMandados.length > 0 && mandados.length === 0) mandados = todosMandados.slice(0, 20);
        } catch (e) {
          console.warn('[Shift] no se pudieron recargar incidentes/mandados:', e);
        }

        const restaurado: Turno = { ...activo, recorrido, distanciaMetros, incidentes, mandados };
        let aplicado = false;
        setTurno((prev) => {
          if (prev) return prev; // ya se inicio un turno nuevo en esta misma sesion
          aplicado = true;
          return restaurado;
        });
        if (aplicado) {
          iniciarSeguimiento();
          proximoCheckpointRef.current = Date.now() + CHECKPOINT_INTERVALO_MS;
          checkpointVenceRef.current = null;
          setCheckpointPendiente(false);
        }
      } catch (e) {
        console.warn('[Shift] no se pudo verificar si habia un servicio activo:', e);
      }
    })();
  }, [guardia, iniciarSeguimiento]);

  const ultimaUbicacion = useCallback((): Promise<GeoPoint> => obtenerUbicacionActual(), []);

  const iniciarServicio = useCallback(
    async (fotoUri: string) => {
      const ubicacion = await obtenerUbicacionActual();
      const nuevo = await turnosApi.iniciarServicio(fotoUri, ubicacion);
      setTurno(nuevo);
      iniciarSeguimiento();
      proximoCheckpointRef.current = Date.now() + CHECKPOINT_INTERVALO_MS;
      checkpointVenceRef.current = null;
      setCheckpointPendiente(false);
      return nuevo;
    },
    [iniciarSeguimiento],
  );

  const cerrarServicio = useCallback(async () => {
    if (!turno) throw new Error('No hay turno en curso');
    detenerSeguimiento();
    proximoCheckpointRef.current = null;
    checkpointVenceRef.current = null;
    setCheckpointPendiente(false);
    const ubicacionFin = await obtenerUbicacionActual();
    const finalizado = await turnosApi.cerrarServicio(turno, ubicacionFin);
    setTurno(finalizado);
    setHistorialTurnos((prev) => [finalizado, ...prev]);
    return finalizado;
  }, [turno, detenerSeguimiento]);

  const agregarIncidente = useCallback<ShiftState['agregarIncidente']>(
    async (data) => {
      if (!turno) throw new Error('No hay turno en curso');
      const ubicacion = await obtenerUbicacionActual();
      const payload: incidentesApi.NuevoIncidente = { ...data, turnoId: turno.id, ubicacion };

      const inc = await enviarOEncolar(
        'incidente',
        payload,
        () => incidentesApi.registrarIncidente(payload),
        () => incidenteLocal(payload),
      );
      await refrescarPendientes();
      setTurno((prev) => (prev ? { ...prev, incidentes: [inc, ...prev.incidentes] } : prev));
      return inc;
    },
    [turno, refrescarPendientes],
  );

  const agregarMandado = useCallback(
    async (descripcion: string) => {
      if (!turno) throw new Error('No hay turno en curso');
      const ubicacion = await obtenerUbicacionActual();
      const payload = { turnoId: turno.id, descripcion, ubicacion };

      const man = await enviarOEncolar(
        'mandado',
        payload,
        () => mandadosApi.registrarMandado(turno.id, descripcion, ubicacion),
        () => mandadoLocal(turno.id, descripcion, ubicacion),
      );
      await refrescarPendientes();
      setTurno((prev) => (prev ? { ...prev, mandados: [man, ...prev.mandados] } : prev));
      return man;
    },
    [turno, refrescarPendientes],
  );

  const dispararSos = useCallback(async () => {
    if (!turno) throw new Error('No hay turno en curso');
    if (!guardia) throw new Error('No hay guardia autenticado');
    const ubicacion = await obtenerUbicacionActual();
    const payload = { turnoId: turno.id, guardiaId: guardia.id, ubicacion };

    const alerta = await enviarOEncolar(
      'sos',
      payload,
      () => sosApi.enviarAlertaSos(turno.id, guardia.id, ubicacion),
      () => sosLocal(turno.id, guardia.id, ubicacion),
    );
    await refrescarPendientes();
    return alerta;
  }, [turno, guardia, refrescarPendientes]);

  const registrarCheckpoint = useCallback(
    async (fotoUri: string) => {
      if (!turno) throw new Error('No hay turno en curso');
      const ubicacion = await obtenerUbicacionActual();
      const payload = { turnoId: turno.id, fotoUri, ubicacion };

      const chk = await enviarOEncolar(
        'checkpoint',
        payload,
        () => checkpointsApi.registrarCheckpoint(turno.id, fotoUri, ubicacion),
        () => checkpointLocal(turno.id, fotoUri, ubicacion),
      );
      await refrescarPendientes();
      setTurno((prev) => (prev ? { ...prev, checkpoints: [chk, ...prev.checkpoints] } : prev));
      setCheckpointPendiente(false);
      checkpointVenceRef.current = null;
      proximoCheckpointRef.current = Date.now() + CHECKPOINT_INTERVALO_MS;
      return chk;
    },
    [turno, refrescarPendientes],
  );

  const descartarTurno = useCallback(() => setTurno(null), []);

  const value = useMemo<ShiftState>(
    () => ({
      turno,
      historialTurnos,
      enServicio: turno?.estado === 'en_servicio',
      avisoUbicacion,
      checkpointPendiente,
      pendientesSincronizar,
      iniciarServicio,
      cerrarServicio,
      agregarIncidente,
      agregarMandado,
      dispararSos,
      registrarCheckpoint,
      descartarTurno,
      ultimaUbicacion,
      sincronizarAhora,
    }),
    [
      turno,
      historialTurnos,
      avisoUbicacion,
      checkpointPendiente,
      pendientesSincronizar,
      iniciarServicio,
      cerrarServicio,
      agregarIncidente,
      agregarMandado,
      dispararSos,
      registrarCheckpoint,
      descartarTurno,
      ultimaUbicacion,
      sincronizarAhora,
    ],
  );

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
}

export function useShift(): ShiftState {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift debe usarse dentro de <ShiftProvider>');
  return ctx;
}