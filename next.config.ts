import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Listing photos live on Cloudflare R2 behind the CDN — never on hosting disk.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "img.propia.com.py" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  // Shared-hosting friendly: standalone output keeps the deployed footprint small.
  output: "standalone",
  experimental: {
    /**
     * The import upload posts the spreadsheet itself to a server action, twice
     * — once to preview, once to commit — so the bytes the operator approved
     * are the bytes that get written. The 1 MB default cuts that off at a few
     * hundred rows. `MAX_UPLOAD_BYTES` in lib/import/intake.ts is the real
     * limit and is set below this on purpose, so an oversized file gets a
     * Spanish error instead of a framework stack trace.
     */
    serverActions: { bodySizeLimit: "8mb" },
  },
  /**
   * Security headers (audit F20). Everything here is static and host-agnostic,
   * so it belongs in the config rather than the middleware — which matters
   * because the middleware matcher deliberately skips static assets, and those
   * responses should still carry `nosniff` and HSTS.
   *
   * The Content-Security-Policy is NOT here: it carries a per-response nonce
   * and is set in middleware.ts (see src/lib/csp.ts). Two CSP headers would be
   * intersected by the browser, so there must only ever be one source.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Two years, subdomains included. Deliberately no `preload`: that
            // is a one-way submission to the browser vendors' list and a
            // founder decision, not a code one.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Belt and braces with the CSP's frame-ancestors, for the browsers
          // and middleboxes that only understand the older header.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // Nothing on this site asks for any of these; the map uses tiles,
            // never the visitor's position.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
