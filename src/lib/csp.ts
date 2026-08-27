/**
 * The Content-Security-Policy the middleware stamps on every HTML response
 * (audit F20). Kept out of middleware.ts so the directive list is readable on
 * its own and so the one non-obvious decision has room to be explained.
 *
 * **Why a nonce and not `'unsafe-inline'`.** The site inlines JSON-LD on nearly
 * every page, and Next inlines its own hydration payload. `'unsafe-inline'`
 * would cover both, but it also covers an injected `<script>` — which is
 * exactly the class of bug a CSP is here to blunt (audit F2: JSON-LD is built
 * from listing text). So each response gets a fresh nonce: the middleware puts
 * it on the *request* headers, Next reads it from there and stamps its own
 * inline scripts with it, and `<JsonLd>` reads it back via `next/headers`.
 *
 * A nonce means the HTML cannot be cached across requests. That costs nothing
 * today — the root layout already calls `headers()` for the vertical, so every
 * page is dynamic (audit F17) — but it is a real constraint on the route-cache
 * work F17 asks for: any page that becomes static must stop inlining JSON-LD,
 * or the policy must move to hashes for those blocks.
 *
 * Directive notes:
 *  - `style-src` keeps `'unsafe-inline'`: ~120 components use React's
 *    `style={{…}}`, which emits a style *attribute*, and nonces do not apply to
 *    attributes. Style injection is not the threat being defended here.
 *  - `img-src https:` is deliberately broad — agency logos and agent photos are
 *    operator-supplied URLs. `src/lib/external-image.ts` is what constrains
 *    those (audit F30); the CSP is not the right layer for it, and narrowing
 *    this to a host list would silently blank real profiles.
 *  - `worker-src blob:` is maplibre-gl: it builds its tile-decoding worker from
 *    a blob URL, and without this the map renders an empty grey canvas.
 *  - OSM tiles are fetched by maplibre as both images and XHR, so the tile host
 *    appears in `img-src` and `connect-src` alike.
 */

const OSM_TILES = "https://tile.openstreetmap.org";

export function cspHeader(nonce: string, dev: boolean): string {
  const directives: string[] = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    // next dev needs eval for React Refresh; production never does.
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${OSM_TILES}`,
    "font-src 'self'",
    `connect-src 'self' ${OSM_TILES}${dev ? " ws: http://localhost:*" : ""}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "manifest-src 'self'",
  ];
  if (!dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** 128 bits of base64 — Web Crypto, so this works in the edge runtime. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
