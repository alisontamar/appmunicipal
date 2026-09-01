import React, { useEffect, useRef } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing, typography } from '@/theme';
import {
  Card,
  OsmMapView,
  RiskBadge,
  ScreenContainer,
  SectionTitle,
  type OsmMapViewHandle,
} from '@/components';
import { useShift } from '@/context/ShiftContext';
import { mockIncidentesHistoricos, mockTurnosHistoricos } from '@/mocks';
import { formatCoords, formatFechaHora } from '@/utils/format';
import type { Incidente } from '@/types';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'IncidentDetail'>;

const tipoLabel: Record<string, string> = {
  robo: 'Robo',
  asalto: 'Asalto',
  violencia: 'Violencia',
  accidente: 'Accidente',
  disturbio: 'Disturbio',
  otro: 'Otro',
};

const estadoLabel: Record<string, string> = {
  reportado: 'Reportado',
  en_revision: 'En revisión',
  cerrado: 'Cerrado',
};

const EXT_VIDEO = ['.mp4', '.mov', '.m4v'];
function esVideo(uri: string): boolean {
  return EXT_VIDEO.some((ext) => uri.toLowerCase().endsWith(ext));
}

export function IncidentDetailScreen({ route }: Props) {
  const { incidenteId } = route.params;
  const { turno, historialTurnos } = useShift();
  const mapRef = useRef<OsmMapViewHandle>(null);

  const incidente: Incidente | undefined =
    turno?.incidentes.find((i) => i.id === incidenteId) ??
    historialTurnos.flatMap((t) => t.incidentes).find((i) => i.id === incidenteId) ??
    mockIncidentesHistoricos.find((i) => i.id === incidenteId) ??
    mockTurnosHistoricos.flatMap((t) => t.incidentes).find((i) => i.id === incidenteId);

  // El marcador se pinta después de montado el mapa 
  useEffect(() => {
    if (!incidente) return;
    mapRef.current?.setIncidentes([
      {
        id: incidente.id,
        latitud: incidente.ubicacion.latitud,
        longitud: incidente.ubicacion.longitud,
        color: colors.riskVeryHigh,
        title: incidente.descripcion,
      },
    ]);
  }, [incidente]);

  if (!incidente) {
    return (
      <ScreenContainer>
        <Text style={typography.body}>No se encontró el incidente.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.head}>
        <Text style={typography.h2}>{tipoLabel[incidente.tipo] ?? incidente.tipo}</Text>
        <RiskBadge level={incidente.nivelRiesgo} />
      </View>
      <Text style={typography.caption}>{formatFechaHora(incidente.creadoEn)}</Text>

      <SectionTitle>Descripción</SectionTitle>
      <Card>
        <Text style={typography.body}>{incidente.descripcion}</Text>
      </Card>

      <SectionTitle>Ubicación</SectionTitle>
      <OsmMapView
        ref={mapRef}
        centroInicial={{
          latitud: incidente.ubicacion.latitud,
          longitud: incidente.ubicacion.longitud,
        }}
        height={200}
      />
      <View style={styles.row}>
        <Ionicons name="location" size={18} color={colors.gold} />
        <Text style={typography.body}>
          {formatCoords(incidente.ubicacion.latitud, incidente.ubicacion.longitud)}
        </Text>
      </View>

      <SectionTitle>Estado</SectionTitle>
      <Card>
        <Text style={typography.bodyStrong}>{estadoLabel[incidente.estado] ?? incidente.estado}</Text>
      </Card>

      <SectionTitle>Evidencia</SectionTitle>
      {incidente.evidenciaUrls.length === 0 ? (
        <Text style={typography.caption}>Sin archivos adjuntos.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {incidente.evidenciaUrls.map((uri) => (
            <View key={uri} style={styles.thumbWrap}>
              {esVideo(uri) ? (
                <View style={[styles.thumb, styles.videoThumb]}>
                  <Ionicons name="videocam" size={24} color={colors.white} />
                </View>
              ) : (
                <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  thumbWrap: { marginRight: spacing.sm },
  thumb: {
    width: 90,
    height: 90,
    borderRadius: radius.md,
    backgroundColor: '#DDE3EA',
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoThumb: {
    backgroundColor: colors.navy700,
    alignItems: 'center',
    justifyContent: 'center',
  },
});