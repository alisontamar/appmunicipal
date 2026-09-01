import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export interface OsmPoint {
  latitud: number;
  longitud: number;
}

export interface OsmMarker extends OsmPoint {
  id: string;
  color?: string;
  title?: string;
}

export interface OsmMapViewHandle {
  /** Mueve/crea el marcador de "mi ubicación" y recentra el mapa. */
  setMiUbicacion: (punto: OsmPoint) => void;
  /** Reemplaza la polyline del recorrido con la lista completa de puntos. */
  setRecorrido: (puntos: OsmPoint[]) => void;
  /** Reemplaza los marcadores de incidentes. */
  setIncidentes: (marcadores: OsmMarker[]) => void;
}

interface Props {
  centroInicial: OsmPoint;
  zona?: OsmPoint[];
  zonaColor?: string;
  recorridoColor?: string;
  height?: number;
}

/**
 * Mapa basado en OpenStreetMap (Leaflet) renderizado en un WebView.
 *
 * Se eligió esta opción en vez de `react-native-maps` porque en Android ese paquete
 * usa el SDK nativo de Google Maps por debajo (requiere API key y está sujeto a la
 * facturación de Google Cloud), incluso si se le superponen tiles de OSM. Esta
 * implementación no depende de ningún SDK de mapas nativo ni de una API key: usa
 * los tiles públicos de OpenStreetMap directamente, es gratuita y funciona en
 * Expo Go sin compilaciones nativas especiales.
 *
 * Se actualiza mediante `injectJavaScript` (vía el ref) en lugar de recargar el
 * HTML completo, para evitar parpadeos al moverse el guardia.
 */
export const OsmMapView = forwardRef<OsmMapViewHandle, Props>(function OsmMapView(
  { centroInicial, zona = [], zonaColor = '#C9A227', recorridoColor = '#2E7D32', height = 280 },
  ref,
) {
  const webRef = useRef<WebView>(null);

  const html = useMemo(
    () => buildHtml(centroInicial, zona, zonaColor, recorridoColor),
    // Solo se reconstruye si cambia el centro inicial o la zona; las actualizaciones
    // de ubicación/recorrido/incidentes viajan después por injectJavaScript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useImperativeHandle(ref, () => ({
    setMiUbicacion: (punto) => {
      webRef.current?.injectJavaScript(
        `window.setMiUbicacion(${punto.latitud}, ${punto.longitud}); true;`,
      );
    },
    setRecorrido: (puntos) => {
      webRef.current?.injectJavaScript(
        `window.setRecorrido(${JSON.stringify(
          puntos.map((p) => [p.latitud, p.longitud]),
        )}); true;`,
      );
    },
    setIncidentes: (marcadores) => {
      webRef.current?.injectJavaScript(
        `window.setIncidentes(${JSON.stringify(
          marcadores.map((m) => ({
            id: m.id,
            lat: m.latitud,
            lng: m.longitud,
            color: m.color ?? '#E53935',
            title: m.title ?? '',
          })),
        )}); true;`,
      );
    },
  }));

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
      />
    </View>
  );
});

function buildHtml(
  centro: OsmPoint,
  zona: OsmPoint[],
  zonaColor: string,
  recorridoColor: string,
): string {
  const zonaCoords = JSON.stringify(zona.map((p) => [p.latitud, p.longitud]));
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${centro.latitud}, ${centro.longitud}], 15);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    if (${zonaCoords}.length > 0) {
      L.polygon(${zonaCoords}, {
        color: '${zonaColor}',
        fillColor: '${zonaColor}',
        fillOpacity: 0.15,
        weight: 2
      }).addTo(map);
    }

    var miIcono = L.divIcon({
      className: '',
      html: '<div style="width:16px;height:16px;border-radius:50%;background:${recorridoColor};border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    var miMarcador = null;
    var recorridoLinea = L.polyline([], { color: '${recorridoColor}', weight: 4 }).addTo(map);
    var incidenteMarcadores = {};

    window.setMiUbicacion = function (lat, lng) {
      if (!miMarcador) {
        miMarcador = L.marker([lat, lng], { icon: miIcono }).addTo(map);
        map.setView([lat, lng], map.getZoom());
      } else {
        miMarcador.setLatLng([lat, lng]);
      }
    };

    window.setRecorrido = function (puntos) {
      recorridoLinea.setLatLngs(puntos);
    };

    window.setIncidentes = function (marcadores) {
      var vistos = {};
      marcadores.forEach(function (m) {
        vistos[m.id] = true;
        if (incidenteMarcadores[m.id]) {
          incidenteMarcadores[m.id].setLatLng([m.lat, m.lng]);
        } else {
          var icono = L.divIcon({
            className: '',
            html: '<div style="width:14px;height:14px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:' + m.color + ';border:2px solid white;"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 14]
          });
          var mk = L.marker([m.lat, m.lng], { icon: icono }).addTo(map);
          if (m.title) mk.bindPopup(m.title);
          incidenteMarcadores[m.id] = mk;
        }
      });
      Object.keys(incidenteMarcadores).forEach(function (id) {
        if (!vistos[id]) {
          map.removeLayer(incidenteMarcadores[id]);
          delete incidenteMarcadores[id];
        }
      });
    };
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});
