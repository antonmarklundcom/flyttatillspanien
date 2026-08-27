import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNotice } from "@/components/SiteNotice";
import { brandMeta } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { currentVertical } from "@/lib/vertical-context";
import { themeFor } from "@/design/themes";

/**
 * The brand suffix on every page title is set ONCE, here, as a title template.
 * Pages return only their own title segment ("Casas en Asunción") and Next
 * appends " — <brand>" from whichever domain served the request. Before this,
 * all 50 pages interpolated a global constant into their own title string,
 * which made the brand un-varyable by host and meant renaming it touched every
 * file. Do not put the brand back into a page's own title — it will double.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { name, tagline } = await brandMeta();
  return {
    // Without a metadataBase, Next resolves relative OG images against
    // http://localhost:3000 — an unfetchable og:image and a bare grey card
    // on WhatsApp, the primary share channel here (audit F6).
    metadataBase: new URL(await siteOrigin()),
    title: { default: `${name} — ${tagline}`, template: `%s — ${name}` },
    description:
      "Casas, departamentos y terrenos en venta y alquiler en todo Paraguay.",
    // Default Open Graph for every page that doesn't set its own: Next only
    // emits og:* when metadata.openGraph is truthy, so before this the whole
    // category tree, /precios, profiles and legal pages shared as bare links
    // (audit F7). A page's own openGraph object replaces this one wholesale —
    // pages that set one must carry their own image if they want one.
    openGraph: {
      type: "website",
      siteName: name,
      locale: "es_PY",
      images: [{ url: "/img/og-share.webp", width: 1200, height: 630 }],
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // The theme is the first thing in the render path to actually consume the
  // vertical the middleware resolved (PLAN.md D6 "consumption layer"). Both
  // live hosts resolve to the same values today, so this changes nothing a
  // visitor sees — it is the wire, not a divergence.
  const vertical = await currentVertical();
  const theme = themeFor(vertical.key) as CSSProperties;

  return (
    <html lang="sv" style={theme}>
      <head>
        {/* Cormorant Garamond + Jost are self-hosted (audit F50): the
            @font-face rules live in globals.css and the variable woff2 files
            in public/fonts — no render-blocking third-party CSS, and the
            Hostinger build can't fail on someone else's CDN. Preload both so
            text doesn't reflow when they land. */}
        <link
          rel="preload"
          href="/fonts/jost-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/cormorant-garamond-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "var(--font-sans)",
          fontWeight: 300,
          background: "var(--color-background)",
          color: "var(--color-ink)",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <SiteNotice />
        <SiteHeader />
        <div className="site-main">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
