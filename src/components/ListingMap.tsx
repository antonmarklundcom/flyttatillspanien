"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Free ($0) raster OSM style — no API key. Fine for current traffic; revisit
 * (MapTiler/Stadia free tier) per OSM's tile usage policy if traffic grows
 * (ARCHITECTURE.md §1: MapLibre + OSM, "token swap" to a paid tile provider
 * later needs no code change beyond this style object).
 */
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

/**
 * Approximate-location map for the listing detail page. Deliberately centers
 * on the barrio/city, never the listing's exact lat/lng (schema.ts: precise
 * coordinates are "never shown publicly at full precision") — a soft circle
 * marker signals "somewhere around here", not a pin on the exact building.
 */
export function ListingMap({ lat, lng, zoom = 14 }: { lat: number; lng: number; zoom?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // A WebGL failure (disabled by the visitor, blocked by an extension or
  // policy, an older device) must not take down the whole listing page for
  // the sake of a map widget — everything else on this page (price, contact
  // form) matters far more than the map. Caught locally rather than relying
  // on the route's error boundary, which would discard all of it.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: maplibregl.Map | undefined;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: OSM_STYLE,
        center: [lng, lat],
        zoom,
        attributionControl: false,
        interactive: true,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }));

      const marker = document.createElement("div");
      marker.className = "listing-map__marker";
      new maplibregl.Marker({ element: marker }).setLngLat([lng, lat]).addTo(map);
    } catch {
      setFailed(true);
      return;
    }
    return () => map?.remove();
  }, [lat, lng, zoom]);

  if (failed) {
    return (
      <div className="listing-map listing-map--unavailable">
        Kartan kunde inte laddas i den här webbläsaren.
      </div>
    );
  }
  return <div ref={containerRef} className="listing-map" />;
}
