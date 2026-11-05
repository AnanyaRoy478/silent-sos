import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// markers: [{ id, lat, lng, label, tone: 'danger' | 'calm', accuracy }]
// path: [[lat, lng], ...]
export default function MapView({ markers = [], path = [], height = 340 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: true }).setView([20.59, 78.96], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 80);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  const key = JSON.stringify([markers, path.length ? path[path.length - 1] : null, path.length]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (path.length > 1) L.polyline(path, { color: '#1F7A76', weight: 3, opacity: 0.75 }).addTo(layer);

    const points = [];
    markers.forEach((m) => {
      if (m.lat == null || m.lng == null) return;
      const danger = m.tone === 'danger';
      if (m.accuracy && m.accuracy > 15) {
        L.circle([m.lat, m.lng], {
          radius: m.accuracy,
          color: danger ? '#C2334D' : '#16213A',
          weight: 1,
          opacity: 0.4,
          fillOpacity: 0.08,
        }).addTo(layer);
      }
      const dot = L.circleMarker([m.lat, m.lng], {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: danger ? '#C2334D' : '#16213A',
        fillOpacity: 1,
      }).addTo(layer);
      if (m.label) dot.bindTooltip(m.label);
      points.push([m.lat, m.lng]);
    });

    if (!points.length) return;
    if (points.length === 1) {
      if (fittedRef.current) map.panTo(points[0]);
      else map.setView(points[0], 16);
    } else if (!fittedRef.current) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
    }
    fittedRef.current = true;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={elRef} className="map" style={{ height }} role="region" aria-label="Map" />;
}
