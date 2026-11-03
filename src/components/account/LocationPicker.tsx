"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Spinner } from "@/components/ui/Spinner";

// Exact delivery pin. "Use my current location" asks the phone for GPS;
// customers can drag the pin to their gate. OpenStreetMap tiles — no API key.

export interface LatLng {
  lat: number;
  lng: number;
}

const SURAPET: LatLng = { lat: 13.1415, lng: 80.1911 }; // map start when nothing else is known

export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const pinIcon = `<div style="transform:translate(-50%,-100%);font-size:34px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))">📍</div>`;

export function LocationPicker({ value, onChange, restaurant }: { value: LatLng | null; onChange: (v: LatLng | null) => void; restaurant?: LatLng | null }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(Boolean(value));
  // Latest value, read by the (async) map initialiser so a GPS fix that
  // arrives before the map loads is never overwritten by the default spot.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Create the map once it is shown
  useEffect(() => {
    if (!showMap || !box.current || map.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !box.current) return;
      const current = valueRef.current;
      const start = current ?? restaurant ?? SURAPET;
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], current ? 18 : 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      const icon = L.divIcon({ html: pinIcon, className: "", iconSize: [0, 0] });
      const mk = L.marker([start.lat, start.lng], { draggable: true, icon }).addTo(m);
      mk.on("dragend", () => {
        const p = mk.getLatLng();
        onChange({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
      });
      m.on("click", (e) => {
        mk.setLatLng(e.latlng);
        onChange({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) });
      });
      map.current = m;
      marker.current = mk;
      if (!valueRef.current) onChange({ lat: start.lat, lng: start.lng });
      setTimeout(() => m.invalidateSize(), 50);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap]);

  // Keep the marker in sync when the value changes from GPS
  useEffect(() => {
    if (value && marker.current && map.current) {
      marker.current.setLatLng([value.lat, value.lng]);
    }
  }, [value]);

  useEffect(() => () => {
    map.current?.remove();
    map.current = null;
  }, []);

  function useMyLocation() {
    setError(null);
    if (!("geolocation" in navigator)) return setError("Your browser can't share location. Drag the pin on the map instead.");
    setLocating(true);
    setShowMap(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const v = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) };
        onChange(v);
        setTimeout(() => map.current?.setView([v.lat, v.lng], 18), 100);
        if (pos.coords.accuracy > 100) setError(`Location is approximate (±${Math.round(pos.coords.accuracy)} m). Please drag the pin to your exact gate.`);
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was blocked. Allow it in your browser settings, or drag the pin on the map."
            : "Couldn't get your location. Drag the pin on the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  const km = value && restaurant ? distanceKm(value, restaurant) : null;

  return (
    <div className="rounded-2xl border border-charcoal/10 bg-cream/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={useMyLocation} className="btn-secondary btn-sm" disabled={locating}>
          {locating ? <Spinner className="h-3 w-3" /> : "📍"} Use my current location
        </button>
        {!showMap && (
          <button type="button" onClick={() => setShowMap(true)} className="btn-ghost btn-sm">
            Pick on map
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setShowMap(false);
              map.current?.remove();
              map.current = null;
            }}
            className="btn-ghost btn-sm text-charcoal-500"
          >
            Remove pin
          </button>
        )}
      </div>
      <p className="hint mt-1">Recommended: helps our delivery partner reach your exact gate without calling.</p>
      {error && <p className="mt-1 text-xs text-amber-800">{error}</p>}
      {showMap && (
        <>
          <div ref={box} className="mt-3 h-64 w-full overflow-hidden rounded-xl ring-1 ring-charcoal/10" role="application" aria-label="Map — drag the pin to your exact location" />
          <p className="mt-1 text-xs text-charcoal-500">
            Drag the 📍 pin (or tap the map) to your building entrance.
            {km !== null && <> · About {km.toFixed(1)} km from Orange Kitchen</>}
          </p>
        </>
      )}
    </div>
  );
}
