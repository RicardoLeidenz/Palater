"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lng: number };

/** Tap the map to drop a pin. Uses OpenStreetMap tiles (light use only, per their tile policy). */
export function MapPicker({
  center,
  value,
  onChange,
}: {
  center: Point | null;
  value: Point | null;
  onChange: (p: Point | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current || map.current) return;
      // Without a known location, start zoomed out on the world.
      const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(
        center ? [center.lat, center.lng] : [20, 0],
        center ? 15 : 2,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#b5573a;border:3px solid #f7f1e8;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(46,33,27,.35)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      m.on("click", (e) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (marker.current) marker.current.setLatLng(e.latlng);
        else marker.current = L.marker(e.latlng, { icon }).addTo(m);
        onChangeRef.current(p);
      });
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // Center is only the initial view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value && marker.current) {
      marker.current.remove();
      marker.current = null;
    }
  }, [value]);

  return (
    <div
      ref={el}
      role="application"
      aria-label="Map. Tap to place a pin on the restaurant's location."
      className="border-line z-0 h-64 w-full overflow-hidden rounded-xl border"
    />
  );
}
