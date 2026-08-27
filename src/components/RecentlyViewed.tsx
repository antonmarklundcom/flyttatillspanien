"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * "Vistos recientemente" — client-only, backed by localStorage (no accounts
 * yet, ARCHITECTURE.md M5). The listing page records a compact snapshot via
 * <RecentlyViewedRecorder>; this component renders the row on the homepage.
 * Renders nothing until hydration and nothing when the visitor has no
 * history, so SSR/first-paint is unaffected.
 */

export interface RecentEntry {
  href: string;
  title: string;
  price: string;
  operation: string;
  specs: string[];
  /**
   * Cover thumbnail URL. Optional because entries written before this field
   * existed are still in visitors' localStorage — those render on the same
   * fallback image a photo-less listing gets, rather than being discarded.
   */
  img?: string | null;
  viewedAt: number;
}

const KEY = "propia:recently-viewed";
const MAX = 8;

export function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function recordRecent(entry: Omit<RecentEntry, "viewedAt">) {
  try {
    const rest = readRecent().filter((e) => e.href !== entry.href);
    localStorage.setItem(
      KEY,
      JSON.stringify([{ ...entry, viewedAt: Date.now() }, ...rest].slice(0, MAX)),
    );
  } catch {
    // Private mode / quota — history is a nicety, never an error.
  }
}

export function RecentlyViewed() {
  const [entries, setEntries] = useState<RecentEntry[]>([]);

  useEffect(() => {
    setEntries(readRecent());
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="home-section">
      <div className="home-section__head">
        <h2 className="home-section__title">🕓 Vistos recientemente</h2>
      </div>
      <div className="home-row">
        {entries.map((e) => (
          /* Same markup as <ListingCard>: this row sits directly above
             "Propiedades recomendadas", and a white bordered card next to a
             row of photo cards read as a different site. It can't reuse the
             component itself — that takes a DB row, and all this has is the
             localStorage snapshot. */
          <Link key={e.href} className="ds-photo-card listing-card" href={e.href}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized
                thumb URL captured at view time; next/image adds a proxy hop. */}
            <img
              className="ds-photo-card__img"
              src={e.img || "/img/listing-fallback.webp"}
              alt={e.title}
              loading="lazy"
              decoding="async"
            />
            <div className="ds-photo-card__scrim" />
            <span className="ds-photo-card__chip">
              {e.operation === "venta" ? "Venta" : "Alquiler"}
            </span>
            {!e.img && (
              <span className="listing-card__nophoto">Foto próximamente</span>
            )}
            <div className="ds-photo-card__body">
              <div className="listing-card__title">{e.title}</div>
              <div className="ds-photo-card__price">{e.price}</div>
              {e.specs.length > 0 && (
                <div className="listing-card__specs">
                  {e.specs.map((s) => (
                    <span className="listing-card__spec" key={s}>
                      <span className="listing-card__tick" aria-hidden />
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Drop-in for the listing page: records the visit, renders nothing. */
export function RecentlyViewedRecorder({
  entry,
}: {
  entry: Omit<RecentEntry, "viewedAt">;
}) {
  useEffect(() => {
    recordRecent(entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.href]);
  return null;
}
