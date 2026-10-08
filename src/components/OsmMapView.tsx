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
  /** Reemplaza el polígono de la zona/ruta asignada. */
  setZona: (puntos: OsmPoint[]) => void;
  /** Actualiza el popup de la zona con las calles */
  setZonaCalles: (calles: string[], nombreRuta?: string) => void;
  /** Centra el mapa en la zona/ruta con fitBounds. */
  centrarEnZona: (puntos: OsmPoint[]) => void;
  /** Centra el mapa en mi ubicación actual. */
  centrarEnMiUbicacion: () => void;
}

interface Props {
  centroInicial: OsmPoint;
  zona?: OsmPoint[];
  zonaColor?: string;
  recorridoColor?: string;
  /** Polyline del recorrido ya dibujada al cargar el mapa (evita la carrera con injectJavaScript). */
  recorridoInicial?: OsmPoint[];
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
  {
    centroInicial,
    zona = [],
    zonaColor = '#2563EB',
    recorridoColor = '#16A34A',
    recorridoInicial = [],
    height = 280,
  },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const pendingZonaRef = useRef<OsmPoint[] | null>(zona.length > 0 ? zona : null);
  const pendingUbicacionRef = useRef<OsmPoint | null>(null);
  const pendingIncidentesRef = useRef<OsmMarker[] | null>(null);
  // "Ver mi ruta"/"Mi ubicación" tocados antes de que el WebView termine de
  // cargar quedaban en la nada: centrarEnZona guardaba la zona pendiente
  // pero nunca recentraba después, y centrarEnMiUbicacion no tenía ningún
  // resguardo — el tap se perdía en silencio (reportado 2026-09-19: "a
  // veces los botones... no me funcionan"). Se recuerda la INTENCIÓN acá y
  // se ejecuta de verdad en onLoadEnd si el guardia tocó antes de tiempo.
  const pendingCentrarZonaRef = useRef(false);
  const pendingCentrarMiUbicacionRef = useRef(false);
  const mapReadyRef = useRef(false);

  const html = useMemo(
    () => buildHtml(centroInicial, zona, zonaColor, recorridoColor, recorridoInicial),
    // Solo se reconstruye si cambia el centro inicial o la zona; las actualizaciones
    // de ubicación/recorrido/incidentes viajan después por injectJavaScript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useImperativeHandle(ref, () => ({
    setMiUbicacion: (punto) => {
      if (!mapReadyRef.current) {
        pendingUbicacionRef.current = punto;
        return;
      }
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
      if (!mapReadyRef.current) {
        pendingIncidentesRef.current = marcadores;
        return;
      }
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
    setZona: (puntos) => {
      if (!mapReadyRef.current) {
        pendingZonaRef.current = puntos;
        return;
      }
      webRef.current?.injectJavaScript(
        `window.setZona(${JSON.stringify(puntos.map((p) => [p.latitud, p.longitud]))}); true;`,
      );
    },
    setZonaCalles: (calles, nombreRuta) => {
      const safe = JSON.stringify({ calles, nombreRuta });
      webRef.current?.injectJavaScript(`window.setZonaCalles(${safe}); true;`);
    },
    centrarEnZona: (puntos) => {
      if (!mapReadyRef.current) {
        pendingZonaRef.current = puntos;
        pendingCentrarZonaRef.current = true;
        return;
      }
      webRef.current?.injectJavaScript(
        `window.centrarEnZona(${JSON.stringify(puntos.map((p) => [p.latitud, p.longitud]))}); true;`,
      );
    },
    centrarEnMiUbicacion: () => {
      if (!mapReadyRef.current) {
        pendingCentrarMiUbicacionRef.current = true;
        return;
      }
      webRef.current?.injectJavaScript(`window.centrarEnMiUbicacion(); true;`);
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
        nestedScrollEnabled
        onLoadEnd={() => {
          mapReadyRef.current = true;
          if (pendingZonaRef.current && pendingZonaRef.current.length > 0) {
            const p = pendingZonaRef.current;
            pendingZonaRef.current = null;
            const centrar = pendingCentrarZonaRef.current;
            pendingCentrarZonaRef.current = false;
            setTimeout(() => {
              webRef.current?.injectJavaScript(`window.setZona(${JSON.stringify(p.map((pt) => [pt.latitud, pt.longitud]))}); true;`);
              if (centrar) {
                setTimeout(() => {
                  webRef.current?.injectJavaScript(`window.centrarEnZona(${JSON.stringify(p.map((pt) => [pt.latitud, pt.longitud]))}); true;`);
                }, 150);
              }
            }, 200);
          } else if (pendingCentrarZonaRef.current) {
            pendingCentrarZonaRef.current = false;
            setTimeout(() => {
              webRef.current?.injectJavaScript(`window.centrarEnZona([]); true;`);
            }, 200);
          }
          if (pendingUbicacionRef.current) {
            const u = pendingUbicacionRef.current;
            pendingUbicacionRef.current = null;
            setTimeout(() => {
              webRef.current?.injectJavaScript(`window.setMiUbicacion(${u.latitud}, ${u.longitud}); true;`);
            }, 300);
          }
          if (pendingCentrarMiUbicacionRef.current) {
            pendingCentrarMiUbicacionRef.current = false;
            setTimeout(() => {
              webRef.current?.injectJavaScript(`window.centrarEnMiUbicacion(); true;`);
            }, 350);
          }
          if (pendingIncidentesRef.current && pendingIncidentesRef.current.length > 0) {
            const m = pendingIncidentesRef.current;
            pendingIncidentesRef.current = null;
            setTimeout(() => {
              webRef.current?.injectJavaScript(
                `window.setIncidentes(${JSON.stringify(
                  m.map((mk) => ({ id: mk.id, lat: mk.latitud, lng: mk.longitud, color: mk.color ?? '#E53935', title: mk.title ?? '' })),
                )}); true;`,
              );
            }, 350);
          }
        }}
        // Leaflet maneja el pan/zoom por su cuenta con JS; si el WebView deja
        // habilitado su propio scroll nativo, ese scroll compite con el gesto
        // de pellizco (pinch) y lo corta a medias. Los botones +/- de Leaflet
        // son un simple tap, por eso esos sí funcionaban aunque el pellizco no.
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
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
  recorridoInicial: OsmPoint[] = [],
): string {
  const zonaCoords = JSON.stringify(zona.map((p) => [p.latitud, p.longitud]));
  const recorridoCoords = JSON.stringify(recorridoInicial.map((p) => [p.latitud, p.longitud]));
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

    var zonaPoligono = null;
    var miUbicacionActual = null;
    var primerAjusteHecho = false;
    var zonaCallesData = [];
    var zonaNombreData = '';
    function ajustarVistaConAmbos() {
      try {
        if (zonaPoligono && miMarcador) {
          var grupo = L.featureGroup([zonaPoligono, miMarcador]);
          map.fitBounds(grupo.getBounds(), { padding: [32, 32], maxZoom: 16 });
        } else if (zonaPoligono) {
          map.fitBounds(zonaPoligono.getBounds(), { padding: [28, 28], maxZoom: 17 });
        } else if (miMarcador && miUbicacionActual) {
          map.setView(miUbicacionActual, 15);
        }
      } catch(e){}
    }
    function popupZonaHtml(){
      var titulo = zonaNombreData ? '▣ ' + zonaNombreData : '▣ Zona / Ruta asignada';
      var html = '<b style="color:${zonaColor}">' + titulo + '</b><br>';
      if (zonaCallesData.length>0) {
        html += '<span style="font-size:11px;color:#334155">' + zonaCallesData.slice(0,3).join(' · ') + '</span><br>';
        if (zonaCallesData.length>3) html += '<span style="font-size:10px;color:#64748B">+' + (zonaCallesData.length-3) + ' calles más abajo</span><br>';
      } else {
        html += '<span style="font-size:11px">Toca Ver mi ruta para centrar</span><br>';
      }
      html += '<span style="font-size:10px;color:#2563EB">▲ Toca fuera para cerrar</span>';
      return html;
    }
    window.setZonaCalles = function(data){
      zonaCallesData = (data && data.calles) ? data.calles : [];
      zonaNombreData = (data && data.nombreRuta) ? data.nombreRuta : '';
      if (zonaPoligono) zonaPoligono.setPopupContent(popupZonaHtml());
    };
    window.setZona = function (puntos) {
      if (zonaPoligono) {
        map.removeLayer(zonaPoligono);
        zonaPoligono = null;
      }
      if (puntos.length > 0) {
        zonaPoligono = L.polygon(puntos, {
          color: '${zonaColor}',
          fillColor: '${zonaColor}',
          fillOpacity: 0.18,
          weight: 3,
          dashArray: '8, 6',
          lineCap: 'round',
          interactive: true
        }).addTo(map);
        zonaPoligono.bindPopup(popupZonaHtml());
        zonaPoligono.on('click', function(e){ L.DomEvent.stopPropagation(e); zonaPoligono.setPopupContent(popupZonaHtml()); zonaPoligono.openPopup(); });
        // Solo auto-centrar la primera vez que llega la zona real, no en cada click
        if (!primerAjusteHecho) {
          primerAjusteHecho = true;
          setTimeout(ajustarVistaConAmbos, 180);
        }
      }
    };
    window.centrarEnZona = function(puntos){
      try {
        if (zonaPoligono) {
          map.fitBounds(zonaPoligono.getBounds(), { padding: [28, 28], maxZoom: 17 });
        } else if (puntos && puntos.length>0) {
          var b = L.latLngBounds(puntos); map.fitBounds(b, { padding: [28,28], maxZoom: 17 });
        }
      } catch(e){}
    };
    window.centrarEnMiUbicacion = function(){
      if (miUbicacionActual) map.setView(miUbicacionActual, 16);
    };
    window.setZona(${zonaCoords});
    if (${zonaCoords}.length > 2) {
      try { setTimeout(function(){ if(zonaPoligono && !primerAjusteHecho){ primerAjusteHecho=true; ajustarVistaConAmbos(); } }, 350); } catch(e){}
    }

    var miIcono = L.divIcon({
      className: '',
      html: '<div style="width:16px;height:16px;border-radius:50%;background:${recorridoColor};border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    // El marcador de "mi ubicación" se crea YA con el centro inicial (que
    // es la posición del guardia al momento de montar el mapa) en vez de
    // esperar la primera llamada a window.setMiUbicacion() desde React
    // Native — esa primera llamada corría antes de que el ref del WebView
    // quedara asignado (el mapa recién se monta cuando llega la primera
    // ubicación) y se perdía en silencio, dejando el mapa sin marcador
    // hasta el siguiente fix de GPS real (reportado 2026-09-19: "a veces
    // no me aparece el marcador de donde estoy").
    miUbicacionActual = [${centro.latitud}, ${centro.longitud}];
    var miMarcador = L.marker(miUbicacionActual, { icon: miIcono }).addTo(map).bindPopup('📍 Mi ubicación actual');
    miMarcador.on('click', function(){ miMarcador.openPopup(); });
    var recorridoLinea = L.polyline(${recorridoCoords}, { color: '${recorridoColor}', weight: 4 }).addTo(map);
    if (${recorridoCoords}.length > 1) {
      try { map.fitBounds(recorridoLinea.getBounds(), { padding: [24, 24] }); } catch (e) {}
    }
    var incidenteMarcadores = {};

    window.setMiUbicacion = function (lat, lng) {
      miUbicacionActual = [lat, lng];
      if (!miMarcador) {
        miMarcador = L.marker([lat, lng], { icon: miIcono }).addTo(map).bindPopup('📍 Mi ubicación actual');
        miMarcador.on('click', function(){ miMarcador.openPopup(); });
        // Si es la primera ubicación y aún no hay ajuste, centrar incluyendo ambos
        if (!primerAjusteHecho) {
          primerAjusteHecho = true;
          setTimeout(ajustarVistaConAmbos, 180);
        } else if (!zonaPoligono) {
          map.setView([lat, lng], 15);
        }
        // Si ya hay zona, no mover el mapa automáticamente (el guardia puede estar explorando),
        // pero el marcador sí queda agregado y visible al hacer "Mi ubicación"
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
