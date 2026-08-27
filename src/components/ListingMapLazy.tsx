"use client";

import dynamic from "next/dynamic";

/**
 * next/dynamic with ssr:false must live in a Client Component boundary — the
 * page itself stays a Server Component. This keeps maplibre-gl (~270kB) out
 * of the page's synchronous hydration bundle; it loads as its own chunk only
 * when this section actually mounts.
 */
const ListingMap = dynamic(() => import("./ListingMap").then((m) => m.ListingMap), {
  ssr: false,
  loading: () => <div className="listing-map" />,
});

export function ListingMapLazy(props: { lat: number; lng: number; zoom?: number }) {
  return <ListingMap {...props} />;
}
