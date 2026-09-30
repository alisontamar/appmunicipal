import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import * as checkpointsApi from '@/api/checkpoints';
import * as incidentesApi from '@/api/incidentes';
import * as mandadosApi from '@/api/mandados';
import { patrullaVigente } from '@/api/patrullas';
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
import { iniciarSeguimientoBackground, detenerSeguimientoBackground, setPuntoListener } from '@/utils/backgroundLocationTask';
import { borrarCaptura, borrarCapturas, limpiarCapturasHuerfanas } from '@/utils/media';
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

export interface AvisoRuta {
  tipo: 'asignada' | 'modificada' | 'eliminada';
  titulo: string;
  mensaje: string;
}

/**
 * Estado real de la cola offline, para mostrarlo sin mentir. `registros` deja
 * fuera los puntos de GPS (que se van solos y no son un registro del guardia):
 * es el número que de verdad le importa al supervisor.
 */
export interface DetallePendientes {
  total: number;
  registros: number;
  masAntiguoEn: string | null;
  ultimoError: string | null;
}

const DETALLE_VACIO: DetallePendientes = {
  total: 0,
  registros: 0,
  masAntiguoEn: null,
  ultimoError: null,
};

/** Resume la cola para la UI. `listarPendientes` ya viene ordenada de más antigua a más reciente. */
function describirPendientes(items: ItemPendiente[]): DetallePendientes {
  if (items.length === 0) return DETALLE_VACIO;
  const masReciente = items.reduce<ItemPendiente | null>(
    (a, b) => (!a || (a.ultimoIntentoEn ?? '') < (b.ultimoIntentoEn ?? '') ? b : a),
    null,
  );
  return {
    total: items.length,
    registros: items.filter((i) => i.tipo !== 'ubicacion').length,
    masAntiguoEn: items[0]?.creadoEn ?? null,
    ultimoError: masReciente?.ultimoError ?? null,
  };
}

interface ShiftState {
  turno: Turno | null;
  historialTurnos: Turno[];
  enServicio: boolean;
  avisoUbicacion: string | null;
  checkpointPendiente: boolean;
  pendientesSincronizar: number;
  /** Detalle de lo que sigue sin enviar — para no mostrar "Todo sincronizado" cuando no es cierto. */
  pendientesDetalle: DetallePendientes;
  /**
   * Cambio de ruta detectado (asignada/modificada/eliminada desde la web)
   * — vive acá, no en MapScreen, para que avise sin importar en qué tab
   * esté el guardia (Inicio, Historial, Perfil...). Antes solo se
   * enteraba si tenía la pestaña de Mapa abierta en el momento exacto, o
   * saliendo y volviendo a entrar a la app.
   */
  avisoRuta: AvisoRuta | null;
  limpiarAvisoRuta: () => void;
  /** Reconsulta la ruta asignada ya mismo (no espera el próximo tick del poll de 20s) — para pull-to-refresh. */
  revisarRuta: () => Promise<void>;
  /** Trae el historial de turnos finalizados desde el servidor — para pull-to-refresh en Historial. */
  refrescarHistorial: () => Promise<void>;
  iniciarServicio: (fotoUri: string) => Promise<Turno>;
  cerrarServicio: () => Promise<Turno>;
  agregarIncidente: (data: Omit<incidentesApi.NuevoIncidente, 'turnoId' | 'ubicacion'>) => Promise<Incidente>;
  agregarMandado: (descripcion: string) => Promise<Mandado>;
  dispararSos: () => Promise<sosApi.AlertaSos>;
  registrarCheckpoint: (fotoUri: string) => Promise<Checkpoint>;
  descartarTurno: () => void;
  ultimaUbicacion: () => Promise<GeoPoint>;
  sincronizarAhora: (forzar?: boolean) => Promise<void>;
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
    case 'incidente': {
      const p = item.payload as incidentesApi.NuevoIncidente;
      await incidentesApi.registrarIncidente(p);
      // Ya está en Supabase y en el servidor: la foto local ya no hace falta.
      borrarCapturas(p.evidenciaUris ?? []);
      return;
    }
    case 'mandado': {
      const p = item.payload as { turnoId: string; descripcion: string; ubicacion: GeoPoint };
      await mandadosApi.registrarMandado(p.turnoId, p.descripcion, p.ubicacion);
      return;
    }
    case 'checkpoint': {
      const p = item.payload as { turnoId: string; fotoUri: string; ubicacion: GeoPoint };
      await checkpointsApi.registrarCheckpoint(p.turnoId, p.fotoUri, p.ubicacion);
      borrarCapturas([p.fotoUri]);
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
  const [pendientesDetalle, setPendientesDetalle] = useState<DetallePendientes>(DETALLE_VACIO);
  const [avisoRuta, setAvisoRuta] = useState<AvisoRuta | null>(null);
  const seguimientoRef = useRef<SeguimientoUbicacion | null>(null);
  const proximoCheckpointRef = useRef<number | null>(null);
  const checkpointVenceRef = useRef<number | null>(null);
  const conectadoAntesRef = useRef<boolean | null>(null);
  const rehidratadoRef = useRef<string | null>(null);
  // null = todavía no se hizo la primera lectura (no avisar en el arranque
  // de la app por una ruta que ya existía de antes).
  const rutaFirmaRef = useRef<{ id: string | null; firma: string } | null>(null);

  const limpiarAvisoRuta = useCallback(() => setAvisoRuta(null), []);

  // Detecta si el centro de monitoreo asignó, editó o eliminó la ruta del
  // guardia — corre acá (Provider global) y no solo dentro de la pantalla
  // de Mapa, para que el aviso llegue sin importar el tab activo (pedido
  // explícito: "no importa si estoy en inicio, historial o perfil").
  const verificarRuta = useCallback(async () => {
    let p: Awaited<ReturnType<typeof patrullaVigente>>;
    try {
      p = await patrullaVigente();
    } catch {
      return; // sin señal / error transitorio — no tratarlo como "ruta eliminada"
    }
    const idActual = p?.id ?? null;
    const firmaActual = p ? `${p.rutaNombre ?? p.nombre ?? ''}|${JSON.stringify(p.trazado)}|${JSON.stringify(p.poligonoGeojson)}` : '';
    const anterior = rutaFirmaRef.current;
    rutaFirmaRef.current = { id: idActual, firma: firmaActual };
    if (!anterior) return; // primera lectura: solo establece la base

    if (anterior.id === idActual) {
      if (idActual && anterior.firma !== firmaActual) {
        setAvisoRuta({
          tipo: 'modificada',
          titulo: 'Tu ruta cambió',
          mensaje: `${p?.rutaNombre || p?.nombre || 'Tu ruta asignada'} fue modificada por el centro de monitoreo — revisa el mapa actualizado.`,
        });
      }
      return;
    }
    if (idActual === null) {
      setAvisoRuta({
        tipo: 'eliminada',
        titulo: 'Ruta cancelada',
        mensaje: 'El centro de monitoreo canceló tu ruta asignada.',
      });
    } else {
      setAvisoRuta({
        tipo: 'asignada',
        titulo: '¡Nueva ruta asignada!',
        mensaje: `${p?.rutaNombre || p?.nombre || 'Te asignaron una ruta'} — ya la puedes ver en el mapa.`,
      });
    }
  }, []);

  useEffect(() => {
    verificarRuta();
    const id = setInterval(verificarRuta, 20_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') verificarRuta();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [verificarRuta]);

  const refrescarPendientes = useCallback(async () => {
    const items = await listarPendientes();
    setPendientesDetalle(describirPendientes(items));
  }, []);

  const sincronizarAhora = useCallback(
    async (forzar = false) => {
      // `forzar` ignora el backoff: lo usa el botón "reintentar ahora" de
      // Perfil y el cierre de turno. Sin él, la sincronización automática (cada
      // 30s, al volver la señal y al abrir la app) respeta el backoff de cada
      // item, así que un registro problemático no quema batería en bucle.
      const { enviados } = await sincronizarPendientes(reintentarPendiente, { forzar });
      if (enviados > 0) console.log(`[Offline] sincronizados ${enviados} pendiente(s)`);
      await refrescarPendientes();
    },
    [refrescarPendientes],
  );

  // Al abrir la app: si ya hay señal, intenta vaciar lo que haya quedado
  // pendiente de una sesion anterior.
  useEffect(() => {
    refrescarPendientes();
    sincronizarAhora();
  }, [refrescarPendientes, sincronizarAhora]);

  // Barrido de capturas huerfanas: al abrir la app se borran las fotos que ya
  // se enviaron y a las que ningun registro pendiente apunta. Cruza contra la
  // cola viva, asi que nunca toca una foto que todavia se necesite.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const items = await listarPendientes();
      if (cancelado) return;
      const referencias = items.flatMap((i) => {
        const p = i.payload as { evidenciaUris?: string[]; fotoUri?: string } | null;
        return [...(p?.evidenciaUris ?? []), ...(p?.fotoUri ? [p.fotoUri] : [])];
      });
      const borradas = limpiarCapturasHuerfanas(referencias);
      if (borradas > 0) console.log(`[Media] barrido: ${borradas} captura(s) huerfana(s)`);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

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

  // Detiene AMBOS mecanismos posibles de tracking sin necesidad de saber
  // cuál quedó activo (el de background es un no-op seguro si nunca se
  // llegó a iniciar — ver detenerSeguimientoBackground).
  const detenerSeguimiento = useCallback(() => {
    seguimientoRef.current?.remove();
    seguimientoRef.current = null;
    setPuntoListener(null);
    void detenerSeguimientoBackground();
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

  // Actualiza SOLO el estado local (recorrido/distancia) — no manda nada a
  // la red. El envío real vive en cada uno de los dos caminos posibles de
  // `iniciarSeguimiento` (uno ya manda por su cuenta, ver comentario ahí).
  const actualizarRecorridoLocal = useCallback((punto: GeoPoint) => {
    setTurno((prev) => {
      if (!prev || prev.estado !== 'en_servicio') return prev;
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
  }, []);

  // Tracking en segundo plano (pedido explícito: "cuando el celular está
  // apagado igual debería mandar el gps"). Primero intenta
  // `iniciarSeguimientoBackground` (Location.startLocationUpdatesAsync +
  // foreground service — sigue funcionando con la pantalla apagada o la
  // app minimizada, ver backgroundLocationTask.ts). Esa tarea YA manda el
  // punto a /telemetry por su cuenta (para poder correr headless, sin
  // depender de que este componente esté montado) — acá solo hace falta
  // reflejarlo en el estado local (recorrido/distancia) y refrescar el
  // contador de pendientes.
  //
  // Si el guardia no otorgó el permiso "Permitir siempre" (o el foreground
  // service no pudo arrancar), degrada AL COMPORTAMIENTO DE ANTES de este
  // cambio: `iniciarSeguimientoUbicacion` foreground-only — sigue
  // funcionando igual que siempre mientras la app está abierta, solo se
  // pierde el tracking con la app en segundo plano.
  const iniciarSeguimiento = useCallback(
    (turnoId: string) => {
      detenerSeguimiento();
      setAvisoUbicacion(null);
      iniciarSeguimientoBackground(turnoId).then((resultado) => {
        if (resultado === 'background') {
          setPuntoListener((punto) => {
            actualizarRecorridoLocal(punto);
            refrescarPendientes();
          });
          return;
        }
        iniciarSeguimientoUbicacion(
          (punto) => {
            actualizarRecorridoLocal(punto);
            enviarUbicacionOEncolar(turnoId, punto);
          },
          (err) => setAvisoUbicacion(err.message),
        ).then((sub) => {
          seguimientoRef.current = sub;
        });
      });
    },
    [detenerSeguimiento, actualizarRecorridoLocal, enviarUbicacionOEncolar, refrescarPendientes],
  );

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
          iniciarSeguimiento(restaurado.id);
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

  // `historialTurnos` antes SOLO se llenaba con lo que el guardia cerraba
  // en la MISMA sesión de la app (cerrarServicio hacía un prepend local) —
  // nunca se traía del servidor lo que ya existía de antes (RF-APP-09,
  // turnosApi.listarTurnos ya existía pero nadie la llamaba para esto).
  // Resultado: HistoryScreen mostraba solo datos mock hasta que el guardia
  // cerraba turnos nuevos, y no había ninguna forma de refrescarlo — el
  // pull-to-refresh de esa pantalla ni existía. Esto es lo que sí trae la
  // lista real y se puede volver a llamar manualmente.
  const refrescarHistorial = useCallback(async () => {
    try {
      const todos = await turnosApi.listarTurnos();
      const finalizados = todos
        .filter((t) => t.estado === 'finalizado')
        .sort((a, b) => (b.horaInicio ? new Date(b.horaInicio).getTime() : 0) - (a.horaInicio ? new Date(a.horaInicio).getTime() : 0));
      setHistorialTurnos(finalizados);
    } catch (e) {
      console.warn('[Shift] no se pudo refrescar el historial de turnos:', e);
    }
  }, []);

  useEffect(() => {
    if (!guardia) return;
    refrescarHistorial();
  }, [guardia, refrescarHistorial]);

  const iniciarServicio = useCallback(
    async (fotoUri: string) => {
      const ubicacion = await obtenerUbicacionActual();
      const nuevo = await turnosApi.iniciarServicio(fotoUri, ubicacion);
      setTurno(nuevo);
      // El selfie ya se subió a Supabase dentro de iniciarServicio.
      borrarCaptura(fotoUri);
      // Manda YA el punto de arranque a /telemetry (bug reportado: "tarda
      // demasiado en aparecer en el dashboard cuando un guardia está en
      // servicio"). Antes el primer punto que llegaba a guardia_telemetria
      // (la tabla que lee la Web) era el del primer tick de
      // watchPositionAsync dentro de iniciarSeguimiento — que puede tardar
      // varios segundos más en resolver un fix GPS en frío, sumado a que
      // recién ahí se dispara el evento en vivo que hace aparecer el pin.
      // Ya se tiene `ubicacion` (se pidió arriba para el selfie de inicio)
      // — mandarla de una evita esa espera extra.
      enviarUbicacionOEncolar(nuevo.id, ubicacion);
      iniciarSeguimiento(nuevo.id);
      proximoCheckpointRef.current = Date.now() + CHECKPOINT_INTERVALO_MS;
      checkpointVenceRef.current = null;
      setCheckpointPendiente(false);
      return nuevo;
    },
    [iniciarSeguimiento, enviarUbicacionOEncolar],
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

    // Última oportunidad de vaciar la cola: si el guardia cerró el turno con
    // registros sin enviar, hay que decirlo. Antes el cierre no miraba la cola
    // en absoluto, así que una jornada completa sin señal se perdía en silencio
    // y el guardia quedaba como que no trabajó.
    await sincronizarAhora(true);
    const sinEnviar = (await listarPendientes()).filter((i) => i.tipo !== 'ubicacion');
    if (sinEnviar.length > 0) {
      Alert.alert(
        'Quedan registros sin enviar',
        `${sinEnviar.length} registro(s) siguen guardados en este teléfono y se enviarán solos apenas tengas señal. No se pierden: están a salvo acá.`,
        [{ text: 'Entendido' }],
      );
    }

    return finalizado;
  }, [turno, detenerSeguimiento, sincronizarAhora]);

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

  const pendientesSincronizar = pendientesDetalle.total;

  const value = useMemo<ShiftState>(
    () => ({
      turno,
      historialTurnos,
      enServicio: turno?.estado === 'en_servicio',
      avisoUbicacion,
      checkpointPendiente,
      pendientesSincronizar,
      pendientesDetalle,
      avisoRuta,
      limpiarAvisoRuta,
      revisarRuta: verificarRuta,
      refrescarHistorial,
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
      pendientesDetalle,
      avisoRuta,
      limpiarAvisoRuta,
      verificarRuta,
      refrescarHistorial,
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