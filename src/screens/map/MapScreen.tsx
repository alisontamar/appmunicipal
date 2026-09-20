import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, typography } from '@/theme';
import {
  Card,
  OsmMapView,
  ScreenContainer,
  ScreenHeader,
  SectionTitle,
  type OsmMapViewHandle,
} from '@/components';
import { useShift } from '@/context/ShiftContext';
import { patrullaVigente, zonaDePatrulla, trazadoAZona, type ZonaPunto } from '@/api/patrullas';
import { formatCoords } from '@/utils/format';
import type { GeoPoint } from '@/types';
import { iniciarSeguimientoUbicacion, obtenerUbicacionActual } from '@/utils/location';

const MAP_HEIGHT = 280;

export function MapScreen() {
  const { turno, enServicio, sincronizarAhora, revisarRuta } = useShift();
  const [miUbicacion, setMiUbicacion] = useState<GeoPoint | null>(null);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [zona, setZona] = useState<ZonaPunto[]>([]);
  const [trazadoCalles, setTrazadoCalles] = useState<ZonaPunto[]>([]);
  const [patrullaInfo, setPatrullaInfo] = useState<{ nombre: string | null; rutaNombre: string | null; id: string | null } | null>(null);
  const [cargandoZona, setCargandoZona] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calles, setCalles] = useState<string[]>([]);
  const [cargandoCalles, setCargandoCalles] = useState(false);
  const mapRef = useRef<OsmMapViewHandle>(null);
  const zonaIdRef = useRef<string | null>(null);
  const primerCargaRef = useRef(true);

  const cargarZona = useCallback(async (mostrarAviso = false) => {
    try {
      const p = await patrullaVigente();
      const puntos = zonaDePatrulla(p);
      const trazado = trazadoAZona(p?.trazado ?? null);
      // Para el mapa: el polígono (zona) ; para calles: priorizar el trazado real si existe
      const puntosCalles = trazado.length >= 2 ? trazado : puntos;
      if (puntos.length > 0) {
        const nuevoId = p?.id ?? JSON.stringify(puntos.slice(0, 2));
        setZona(puntos);
        setTrazadoCalles(puntosCalles);
        if (p) setPatrullaInfo({ nombre: p.nombre ?? p.rutaNombre ?? null, rutaNombre: p.rutaNombre, id: p.id });
        zonaIdRef.current = nuevoId;
        // El aviso de ruta nueva/modificada/eliminada ya no se dispara acá
        // — vive en ShiftContext (verificarRuta), que corre en TODA la app
        // (Inicio, Historial, Perfil), no solo con esta pantalla montada.
        // Antes solo avisaba si el guardia justo estaba viendo el Mapa.
        primerCargaRef.current = false;
        return;
      }
      // Sin ruta asignada hoy: mantener vacío. Antes caía a un mock
      // ("no dejar el mapa vacío") que era un cuadrado fijo de 4 puntos
      // alrededor de una coordenada de referencia (mockZonaAsignada) — el
      // guardia lo veía como si tuviera una ruta real asignada cuando en
      // realidad el admin todavía no le asignó ninguna. El estado vacío ya
      // tiene su propio mensaje ("Sin zona asignada hoy...", más abajo en
      // el render), así que no hace falta simular una zona.
      setZona([]);
      primerCargaRef.current = false;
    } catch {
      primerCargaRef.current = false;
    } finally {
      setCargandoZona(false);
    }
  }, []);

  // Carga inicial + polling cada 20s + al volver al foreground (cuando el admin asigna ruta en web)
  useEffect(() => {
    cargarZona(false);
    const id = setInterval(() => cargarZona(true), 20_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') cargarZona(true);
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [cargarZona]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // revisarRuta corre el mismo chequeo global que muestra el aviso de
      // ruta asignada/modificada/eliminada (ShiftContext) — sin esto, el
      // refresh de esta pantalla actualizaba el polígono visual pero no
      // "adelantaba" la referencia que usa ese detector, pudiendo generar
      // un aviso repetido o tardío más adelante.
      await Promise.all([cargarZona(true), sincronizarAhora(), revisarRuta()]);
    } finally {
      setRefreshing(false);
    }
  }, [cargarZona, sincronizarAhora, revisarRuta]);

  // Empuja el polígono de zona al mapa cada vez que cambia y centra el mapa en la ruta.
  // Reintenta si el WebView aún no cargó (window.setZona aún no existe) — antes se perdía
  // el primer setZona y quedaba el cuadrado default hasta salir/volver.
  //
  // El `return` temprano de abajo (cuando zona queda vacía) hacía que
  // NUNCA se llamara a mapRef.current.setZona([]) al eliminarse la ruta
  // desde la web — el polígono azul viejo se quedaba pintado en el mapa
  // para siempre (hasta salir y volver a entrar, que recarga el WebView
  // de cero). window.setZona([]) sí sabe borrar el polígono anterior
  // (OsmMapView.tsx), solo faltaba llamarlo.
  useEffect(() => {
    const aplicar = () => {
      mapRef.current?.setZona(zona);
      if (zona.length > 2) mapRef.current?.centrarEnZona?.(zona);
    };
    aplicar();
    if (zona.length === 0) return;
    // Reintentos por si el WebView aún no está listo (carga asíncrona de Leaflet)
    const t1 = setTimeout(aplicar, 400);
    const t2 = setTimeout(aplicar, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [zona]);

  // Calles de la ruta asignada — prioriza trazado real, fetcheo en paralelo para que sea instantáneo
  useEffect(() => {
    const fuenteCalles = trazadoCalles.length >= 2 ? trazadoCalles : zona;
    if (fuenteCalles.length === 0) {
      setCalles([]);
      return;
    }
    let cancelado = false;
    setCargandoCalles(true);
    // Mostrar el nombre de la ruta de inmediato mientras llegan las calles (no esperar 2-3s en blanco)
    const fallbackInmediato = patrullaInfo?.rutaNombre || patrullaInfo?.nombre;
    if (fallbackInmediato) setCalles([fallbackInmediato]);

    (async () => {
      const puntos = fuenteCalles.slice(0, 4);
      try {
        const resultados = await Promise.all(
          puntos.map(async (p) => {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.latitud}&lon=${p.longitud}&zoom=17&addressdetails=1`,
                { headers: { 'Accept-Language': 'es', 'User-Agent': 'GAMC-Guardias/0.1.0' } },
              );
              if (!res.ok) return null;
              const data: any = await res.json();
              const addr = data?.address;
              return (
                addr?.road ||
                addr?.pedestrian ||
                addr?.footway ||
                addr?.path ||
                addr?.neighbourhood ||
                addr?.suburb ||
                addr?.quarter ||
                data?.display_name?.split(',')[0] ||
                null
              );
            } catch {
              return null;
            }
          }),
        );
        if (cancelado) return;
        const nombres: string[] = [];
        for (const c of resultados) {
          if (c && !nombres.includes(c.trim())) nombres.push(c.trim());
        }
        if (nombres.length === 0) {
          // Si todo falló pero ya mostramos el fallback, mantenerlo
          if (!fallbackInmediato) {
            const fb = patrullaInfo?.rutaNombre || patrullaInfo?.nombre || 'Ruta asignada';
            nombres.push(fb);
          } else if (fallbackInmediato && !nombres.includes(fallbackInmediato)) {
            // Ya está mostrado, no duplicar
          }
        } else if (fallbackInmediato && nombres[0] !== fallbackInmediato && !nombres.includes(fallbackInmediato)) {
          // Mantener el nombre de la ruta primero si no vino en el reverse
          nombres.unshift(fallbackInmediato);
        }
        // Limitar a 4 para que sea instantáneo
        const recorte = nombres.slice(0, 4);
        setCalles(recorte);
        try {
          mapRef.current?.setZonaCalles(recorte, patrullaInfo?.rutaNombre || patrullaInfo?.nombre || undefined);
        } catch {}
      } finally {
        if (!cancelado) setCargandoCalles(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [zona, trazadoCalles, patrullaInfo?.rutaNombre, patrullaInfo?.nombre]);

  // Sigue la ubicación en vivo mientras la pantalla está montada (RF-APP-10).
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let vigente = true;

    obtenerUbicacionActual()
      .then((p) => {
        if (!vigente) return;
        setMiUbicacion(p);
        mapRef.current?.setMiUbicacion({ latitud: p.latitud, longitud: p.longitud });
      })
      .catch((e: Error) => vigente && setErrorUbicacion(e.message));

    iniciarSeguimientoUbicacion(
      (p) => {
        if (!vigente) return;
        setMiUbicacion(p);
        mapRef.current?.setMiUbicacion({ latitud: p.latitud, longitud: p.longitud });
      },
      (e) => vigente && setErrorUbicacion(e.message),
    ).then((s) => {
      sub = s;
    });

    return () => {
      vigente = false;
      sub?.remove();
    };
  }, []);

  // Actualiza la polyline del recorrido cuando crece durante el turno.
  useEffect(() => {
    const recorrido = enServicio && turno ? turno.recorrido : [];
    mapRef.current?.setRecorrido(recorrido.map((p) => ({ latitud: p.latitud, longitud: p.longitud })));
  }, [enServicio, turno?.recorrido]);

  // Actualiza los marcadores de incidentes.
  useEffect(() => {
    const incidentes = turno?.incidentes ?? [];
    mapRef.current?.setIncidentes(
      incidentes.map((inc) => ({
        id: inc.id,
        latitud: inc.ubicacion.latitud,
        longitud: inc.ubicacion.longitud,
        color: colors.riskVeryHigh,
        title: inc.descripcion,
      })),
    );
  }, [turno?.incidentes]);

  return (
    <ScreenContainer statusBar="dark" header={<ScreenHeader title="Mapa" />}>
      {/*
        El mapa va FUERA del ScrollView a propósito: un WebView con Leaflet
        dentro de un ScrollView compite por el gesto con el scroll vertical, y
        el pellizco para hacer zoom queda entrecortado (los botones +/- del
        mapa sí funcionan porque son un simple tap, no un gesto). Solo el
        contenido de abajo se desplaza.
      */}
      {miUbicacion ? (
        <View>
          <OsmMapView
            ref={mapRef}
            centroInicial={{ latitud: miUbicacion.latitud, longitud: miUbicacion.longitud }}
            zona={zona}
            zonaColor="#2563EB"
            recorridoColor="#16A34A"
            height={MAP_HEIGHT}
          />
          <View style={styles.mapControls}>
            <PressableButton onPress={() => mapRef.current?.centrarEnZona(zona)} label="Ver mi ruta" icon="locate" />
            <PressableButton onPress={() => mapRef.current?.centrarEnMiUbicacion()} label="Mi ubicación" icon="navigate" />
          </View>
        </View>
      ) : (
        <View style={[styles.mapLoading, { height: MAP_HEIGHT }]}>
          <Ionicons
            name={errorUbicacion ? 'warning' : 'navigate'}
            size={28}
            color={errorUbicacion ? colors.danger : '#2563EB'}
          />
          <Text style={typography.body}>
            {errorUbicacion ?? 'Obteniendo su ubicación…'}
          </Text>
        </View>
        )}

      {/* Calles de mi ruta — siempre visible justo debajo del mapa, como en la web al clickear cada guardia */}
      {(trazadoCalles.length > 0 || zona.length > 0 || patrullaInfo) && (
        <View style={styles.callesBelowMap}>
          <View style={styles.callesHeader}>
            <Ionicons name="map" size={14} color="#2563EB" />
            <Text style={styles.callesTitle}>Calles de mi ruta asignada</Text>
            {patrullaInfo?.rutaNombre && <Text style={styles.callesSubtitle} numberOfLines={1}> — {patrullaInfo.rutaNombre}</Text>}
          </View>
          <Card style={styles.callesCard}>
            {cargandoZona || cargandoCalles ? (
              <View style={styles.row}>
                <Ionicons name="hourglass" size={14} color={colors.textSecondary} />
                <Text style={[typography.caption, { flex: 1, color: colors.textSecondary }]}>Obteniendo calles de tu ruta…</Text>
              </View>
            ) : calles.length > 0 ? (
              <View style={{ gap: 6 }}>
                {calles.slice(0, 3).map((c, idx) => (
                  <View key={`${c}-${idx}`} style={styles.calleRow}>
                    <View style={styles.calleBullet} />
                    <Text style={[typography.body, { flex: 1, fontSize: 13 }]} numberOfLines={1}>{c}</Text>
                  </View>
                ))}
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2, fontSize: 11 }]}>
                  {trazadoCalles.length >= 2 ? 'Basado en tu trazado real (ruta)' : 'Basado en el polígono asignado'} · Toca el azul para ver el área
                </Text>
              </View>
            ) : zona.length === 0 ? (
              <View style={styles.row}>
                <Ionicons name="information-circle" size={14} color={colors.textSecondary} />
                <Text style={[typography.caption, { flex: 1, color: colors.textSecondary, fontSize: 12 }]}>Sin zona asignada hoy. El admin te asigna la ruta desde la web.</Text>
              </View>
            ) : (
              <View style={styles.row}>
                <Ionicons name="information-circle" size={14} color={colors.textSecondary} />
                <Text style={[typography.caption, { flex: 1, color: colors.textSecondary, fontSize: 12 }]}>Ruta asignada — verás el contorno azul en el mapa ({zona.length} pts).</Text>
              </View>
            )}
          </Card>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.navy900]} tintColor={colors.navy900} />}
      >
        <SectionTitle hint="RF-APP-10">Mi ubicación y ruta</SectionTitle>
        <Card>
          {errorUbicacion ? (
            <View style={styles.row}>
              <Ionicons name="warning" size={18} color={colors.danger} />
              <Text style={[typography.body, styles.errorText]}>{errorUbicacion}</Text>
            </View>
          ) : (
            <View style={styles.row}>
              <Ionicons name="navigate" size={18} color="#16A34A" />
              <Text style={[typography.body, { flex: 1 }]} numberOfLines={2}>
                {miUbicacion
                  ? formatCoords(miUbicacion.latitud, miUbicacion.longitud)
                  : 'Obteniendo ubicación GPS…'}
              </Text>
            </View>
          )}
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <Ionicons name="business" size={18} color="#2563EB" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { fontWeight: '700' }]} numberOfLines={2}>
                {patrullaInfo?.rutaNombre || patrullaInfo?.nombre || (cargandoZona ? 'Cargando zona asignada…' : zona.length > 2 ? 'Zona asignada disponible en el mapa' : 'Sin zona asignada hoy')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {zona.length > 2 ? `${zona.length} puntos • Zona interactiva (toca el polígono azul)` : 'Se asigna desde la web en Módulo de Mapas'}
              </Text>
            </View>
          </View>
        </Card>

        <SectionTitle>Recorrido de la ronda</SectionTitle>
        {enServicio && turno ? (
          <Card>
            <Text style={typography.body}>
              {turno.recorrido.length} punto(s) GPS registrados en este turno.
            </Text>
            <Text style={[typography.caption, styles.note]}>
              La captura periódica se envía al backend para trazar el recorrido (RF-APP-05).
            </Text>
          </Card>
        ) : (
          <Card>
            <Text style={typography.body}>Inicie un servicio para trazar el recorrido.</Text>
          </Card>
        )}

        <SectionTitle>Leyenda</SectionTitle>
        <View style={styles.legend}>
          <Legend color="#16A34A" label="Tu recorrido (verde)" />
          <Legend color="#2563EB" label="Ruta / zona asignada (azul, interactiva)" />
          <Legend color={colors.riskVeryHigh} label="Incidente reportado" />
        </View>

        <Text style={[typography.caption, styles.attribution]}>
          Mapa © colaboradores de OpenStreetMap
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function PressableButton({ onPress, label, icon }: { onPress: () => void; label: string; icon: any }) {
  return (
    <Pressable onPress={onPress} style={styles.mapBtn}>
      <Ionicons name={icon} size={14} color="#2563EB" />
      <Text style={styles.mapBtnText}>{label}</Text>
    </Pressable>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, marginTop: spacing.lg },
  scrollContent: { flexGrow: 1 },
  mapLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  mapControls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    justifyContent: 'center',
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 2,
  },
  mapBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  zonaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
  zonaBadgeText: { fontSize: 11, color: colors.white, fontWeight: '600' },
  callesBelowMap: { marginTop: 10, gap: 6 },
  callesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  callesTitle: { fontSize: 11, fontWeight: '800', color: colors.navy900, fontFamily: 'monospace', letterSpacing: 0.7 },
  callesSubtitle: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', flex: 1 },
  callesCard: { paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  calleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.background },
  calleBullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },
  errorText: { flex: 1, color: colors.danger },
  note: { marginTop: spacing.xs },
  legend: { gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  attribution: { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
});
