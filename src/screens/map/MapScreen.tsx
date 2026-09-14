import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { patrullaVigente, zonaDePatrulla, type ZonaPunto } from '@/api/patrullas';
import { mockZonaAsignada } from '@/mocks';
import { formatCoords } from '@/utils/format';
import type { GeoPoint } from '@/types';
import { iniciarSeguimientoUbicacion, obtenerUbicacionActual } from '@/utils/location';

const MAP_HEIGHT = 460;

export function MapScreen() {
  const { turno, enServicio } = useShift();
  const [miUbicacion, setMiUbicacion] = useState<GeoPoint | null>(null);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [zona, setZona] = useState<ZonaPunto[]>(mockZonaAsignada);
  const mapRef = useRef<OsmMapViewHandle>(null);

  // Ruta / zona asignada del dia (v_patrulla_vigente). Prioriza el poligono real
  // de la patrulla asignada (lo que llena el asistente de la web); si hoy no hay
  // patrulla o no tiene poligono ni trazado, se deja el poligono de referencia.
  useEffect(() => {
    let vigente = true;
    patrullaVigente()
      .then((p) => {
        if (!vigente) return;
        const puntos = zonaDePatrulla(p);
        if (puntos.length > 0) setZona(puntos);
      })
      .catch(() => {
        /* sin patrulla / sin conexion: se mantiene la zona de referencia */
      });
    return () => {
      vigente = false;
    };
  }, []);

  // Empuja el polígono de zona al mapa cada vez que cambia. Es necesario además
  // de pasarlo como prop: el HTML del mapa se arma una sola vez al montar
  // (OsmMapView), así que si la respuesta de /patrullas/vigente llega después
  // de que el mapa ya se montó con el punto GPS (el backend puede tardar más
  // que el GPS en responder), el polígono solo se actualiza si se empuja por
  // esta vía imperativa.
  useEffect(() => {
    mapRef.current?.setZona(zona);
  }, [zona]);

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
    <ScreenContainer scroll statusBar="dark" header={<ScreenHeader title="Mapa" />}>
      {miUbicacion ? (
        <OsmMapView
          ref={mapRef}
          centroInicial={{ latitud: miUbicacion.latitud, longitud: miUbicacion.longitud }}
          zona={zona}
          zonaColor={colors.gold}
          recorridoColor={colors.onDuty}
          height={MAP_HEIGHT}
        />
      ) : (
        <View style={[styles.mapLoading, { height: MAP_HEIGHT }]}>
          <Ionicons
            name={errorUbicacion ? 'warning' : 'navigate'}
            size={28}
            color={errorUbicacion ? colors.danger : colors.gold}
          />
          <Text style={typography.body}>
            {errorUbicacion ?? 'Obteniendo su ubicación…'}
          </Text>
        </View>
      )}

      <SectionTitle hint="RF-APP-10">Mi ubicación</SectionTitle>
      <Card>
        {errorUbicacion ? (
          <View style={styles.row}>
            <Ionicons name="warning" size={18} color={colors.danger} />
            <Text style={[typography.body, styles.errorText]}>{errorUbicacion}</Text>
          </View>
        ) : (
          <View style={styles.row}>
            <Ionicons name="navigate" size={18} color={colors.gold} />
            <Text style={typography.body}>
              {miUbicacion
                ? formatCoords(miUbicacion.latitud, miUbicacion.longitud)
                : 'Obteniendo ubicación GPS…'}
            </Text>
          </View>
        )}
        <View style={styles.row}>
          <Ionicons name="business" size={18} color={colors.gold} />
          <Text style={typography.body}>Zona asignada: Distrito 10 · EPI Sur</Text>
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
        <Legend color={colors.onDuty} label="Guardia en servicio / recorrido" />
        <Legend color={colors.gold} label="Ruta / zona asignada" />
        <Legend color={colors.riskVeryHigh} label="Incidente reportado" />
      </View>

      <Text style={[typography.caption, styles.attribution]}>
        Mapa © colaboradores de OpenStreetMap
      </Text>
    </ScreenContainer>
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
  mapLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  errorText: { flex: 1, color: colors.danger },
  note: { marginTop: spacing.xs },
  legend: { gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  attribution: { textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
});
