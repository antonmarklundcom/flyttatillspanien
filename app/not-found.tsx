import Link from "next/link";
import { tokens } from "@/design/tokens";
import { listCities } from "@/lib/queries";
import { SearchBar } from "@/components/SearchBar";
import { currentLocale } from "@/i18n/server";
import { POPULAR_SEARCHES } from "@/config/popular-searches";

// Renders per-request rather than at build time — the root layout reads the
// Host header for the per-host brand, so nothing in this app prerenders
// (PLAN.md F17). The city list below is cached, so a 404 no longer costs a
// query; this stays force-dynamic because the shell around it is.
export const dynamic = "force-dynamic";

/**
 * Branded 404. Also what renders for category URLs with zero matching
 * listings (getIndexability() → "gone" with no parent to redirect to,
 * ARCHITECTURE.md §4.3) — that's an intentional SEO signal, but a visitor
 * who just searched should get somewhere to go next, not a dead end.
 */
export default async function NotFound() {
  // A 404 must never become a 500. This page is also the error surface for
  // "category URL with zero matches", so it renders during exactly the kind
  // of incident where MySQL may be the thing that is unwell — a dead search
  // bar is a worse-but-usable page, a stack trace is not.
  const [cities, locale] = await Promise.all([
    listCities().catch(() => []),
    currentLocale(),
  ]);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "4rem 1rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 48 }} aria-hidden>
        🏡
      </div>
      <h1 style={{ fontSize: 26, margin: "16px 0 8px", color: tokens.color.primary }}>
        No encontramos propiedades para esa búsqueda
      </h1>
      <p style={{ fontSize: 16, color: tokens.color.inkSecondary, lineHeight: 1.6 }}>
        Puede que no haya publicaciones disponibles en esa zona o combinación
        todavía. Probá con otra ciudad o tipo de propiedad.
      </p>

      <div style={{ textAlign: "left" }}>
        <SearchBar cities={cities} locale={locale} />
      </div>

      <p
        style={{
          marginTop: 28,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.02em",
          color: tokens.color.inkSecondary,
        }}
      >
        BÚSQUEDAS POPULARES
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
        {POPULAR_SEARCHES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              padding: "8px 14px",
              borderRadius: tokens.radius.chip,
              background: tokens.color.surface,
              border: "1px solid #E1E5E0",
              color: tokens.color.ink,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <Link
        href="/"
        style={{
          display: "inline-block",
          marginTop: 24,
          fontSize: 14,
          fontWeight: 700,
          color: tokens.color.primary,
        }}
      >
        Volver al inicio
      </Link>
    </main>
  );
}
