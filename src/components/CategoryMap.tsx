"use client";

/**
 * Split-view map for category pages (ARCHITECTURE.md M4: "split list/map with
 * price pins and cluster chips").
 *
 * Two deliberate choices:
 *
 * 1. **No `supercluster`, no font glyphs.** MapLibre's built-in clustering
 *    needs a `symbol` layer to draw the count, and `symbol` text needs a
 *    `glyphs` URL — which the free raster OSM style has none of, so it would
 *    mean depending on someone else's font server. Pins are HTML markers
 *    instead: the price pill is the market-standard UX here, it styles with
 *    plain CSS, and clustering is a grid bucket in screen space (~50 lines
 *    below) rather than a dependency.
 *
 * 2. **Markers are rebuilt on `moveend`, not on every frame.** maplibregl
 *    keeps existing markers pinned to their coordinates while the user drags,
 *    so panning stays smooth and we only recompute clusters when the view
 *    settles.
 *
 * Coordinates arrive already rounded from /api/mapa — see map-queries.ts for
 * why (precise positions are never public).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { listingUrl } from "@/lib/urls";

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

interface Pin {
  publicId: string;
  slug: string;
  title: string;
  lat: number;
  lng: number;
  priceUsd: number;
  priceAmount: number;
  priceCurrency: "USD" | "PYG";
  bedrooms: number | null;
  areaM2: number | null;
  approximate: boolean;
}

/** Compact price for a pin: "US$ 85 mil", "US$ 1,2 M". Space is ~70px. */
function pinPrice(pin: Pin): string {
  const n = pin.priceUsd;
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `US$ ${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  return `US$ ${Math.round(n / 1000)} mil`;
}

/**
 * Grid size in screen pixels; pins closer than this collapse into a chip.
 * Sized against the price pill itself (~70px wide) — at 56 the pills visibly
 * overlapped each other on a real render.
 */
const CELL_PX = 76;

interface Cluster {
  lat: number;
  lng: number;
  pins: Pin[];
}

/**
 * Bucket pins by their projected screen position. Screen space rather than
 * geographic, so a cluster means "these overlap at this zoom" — which is what
 * the eye is actually complaining about.
 */
function clusterPins(map: maplibregl.Map, pins: Pin[]): Cluster[] {
  const cells = new Map<string, Pin[]>();
  for (const pin of pins) {
    const p = map.project([pin.lng, pin.lat]);
    const key = `${Math.floor(p.x / CELL_PX)}:${Math.floor(p.y / CELL_PX)}`;
    const cell = cells.get(key);
    if (cell) cell.push(pin);
    else cells.set(key, [pin]);
  }

  // A chip sits at its members' mean position, not at whichever pin happened
  // to be first: a representative point near a cell edge renders right next to
  // the neighbouring cell's chip, which is exactly the overlap clustering is
  // supposed to remove (seen on a real mobile render).
  return [...cells.values()].map((group) => ({
    lat: group.reduce((sum, p) => sum + p.lat, 0) / group.length,
    lng: group.reduce((sum, p) => sum + p.lng, 0) / group.length,
    pins: group,
  }));
}

export function CategoryMap({
  centerLat,
  centerLng,
  zoom = 12,
  /** Category filters, forwarded verbatim so map and grid never disagree. */
  query,
}: {
  centerLat: number;
  centerLng: number;
  zoom?: number;
  query: Record<string, string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [capped, setCapped] = useState(false);
  const [error, setError] = useState(false);

  const fetchPins = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const bbox = [
      b.getWest(),
      b.getSouth(),
      b.getEast(),
      b.getNorth(),
    ]
      .map((n) => n.toFixed(4))
      .join(",");

    const params = new URLSearchParams({ ...query, bbox });
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/mapa?${params}`);
      const data = (await res.json()) as
        | { ok: true; pins: Pin[]; capped: boolean }
        | { ok: false };
      if (!data.ok) {
        setError(true);
        return;
      }
      setPins(data.pins);
      setCapped(data.capped);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [centerLng, centerLat],
      zoom,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    mapRef.current = map;

    map.on("load", fetchPins);
    map.on("moveend", fetchPins);

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Center/zoom are the initial view only; re-running would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the fetch callback current without recreating the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.off("moveend", fetchPins);
    map.on("moveend", fetchPins);
    void fetchPins();
    return () => {
      map.off("moveend", fetchPins);
    };
  }, [fetchPins]);

  // Rebuild markers whenever the pin set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const cluster of clusterPins(map, pins)) {
      const el = document.createElement("div");

      if (cluster.pins.length > 1) {
        el.className = "map-chip";
        el.textContent = String(cluster.pins.length);
        el.title = `${cluster.pins.length} propiedades`;
        el.addEventListener("click", () => {
          // Zoom toward the chip rather than opening an arbitrary listing.
          map.easeTo({
            center: [cluster.lng, cluster.lat],
            zoom: Math.min(map.getZoom() + 2, 17),
          });
        });
      } else {
        const pin = cluster.pins[0];
        const link = document.createElement("a");
        link.className = "map-pin";
        link.href = listingUrl(pin);
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = pinPrice(pin);
        // The approximate case is the honest default, so only the exact one
        // is worth distinguishing in the tooltip.
        link.title = pin.approximate
          ? `${pin.title} — ubicación aproximada`
          : pin.title;
        if (pin.approximate) link.classList.add("map-pin--approx");
        el.appendChild(link);
      }

      markersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([cluster.lng, cluster.lat])
          .addTo(map),
      );
    }
  }, [pins]);

  return (
    <div className="map-view">
      <div ref={containerRef} className="map-view__canvas" />
      <div className="map-view__status" aria-live="polite">
        {error
          ? "No pudimos cargar el mapa. Movelo de nuevo para reintentar."
          : loading
            ? "Buscando…"
            : capped
              ? `Mostrando las ${pins.length} más económicas de esta zona — acercá para ver el resto.`
              : `${pins.length} ${pins.length === 1 ? "propiedad" : "propiedades"} en esta zona`}
      </div>
    </div>
  );
}
