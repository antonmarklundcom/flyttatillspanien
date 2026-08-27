import { headers } from "next/headers";

/**
 * Inlines a JSON-LD object as a script tag. Server component.
 *
 * Two things stop a listing description from becoming script here:
 *
 * 1. `JSON.stringify` escapes quotes but NOT `<`, so a title containing
 *    `</script><script>…` would close this tag and run (audit F2). Escaping the
 *    three characters that can start markup into their `\uXXXX` forms is
 *    lossless — JSON parsers read them back as the same string — and doing it
 *    in this one component covers every call site at once.
 * 2. The nonce the middleware minted for this response. Without it the CSP
 *    (src/lib/csp.ts) refuses the tag, so an injected `<script>` that somehow
 *    escaped the escaping still would not execute.
 */
const MARKUP_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
};

export async function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(Array.isArray(data) ? data : [data]).replace(
    /[<>&]/g,
    (c) => MARKUP_ESCAPES[c],
  );
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
