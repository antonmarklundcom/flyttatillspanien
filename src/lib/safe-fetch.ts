/**
 * Fetching a URL a *user* supplied, safely.
 *
 * This is the dangerous half of "paste your listing link". The server makes the
 * request, so without a guard a user could point it at
 * `http://127.0.0.1:3306`, `http://169.254.169.254/latest/meta-data/`
 * (cloud credentials) or any host inside the hosting network, and read the
 * response through our own preview UI. That is SSRF, and it is the reason this
 * module exists rather than a bare `fetch()` at the call site.
 *
 * What it enforces:
 *  - http/https only (no file:, no gopher:, no data:)
 *  - the resolved IP must be public — checked for the original host *and*
 *    after every redirect hop, because a public URL can 302 to 127.0.0.1
 *  - the connection goes to *the address we checked* (audit F27): the resolved
 *    IP is pinned onto the socket, so a name whose second DNS answer is
 *    127.0.0.1 cannot win the race between the check and the connect
 *  - no https → http downgrade across a redirect
 *  - a byte cap applied *while streaming* (audit F19), so a server that omits
 *    or lies about content-length cannot push unbounded bytes into the heap
 *  - a timeout, so a hanging server cannot hold a request handler open
 *
 * DNS resolution happens here explicitly: checking the hostname string is not
 * enough, since `localtest.me` and countless other names resolve to loopback.
 *
 * Implemented on `node:http`/`node:https` rather than `fetch` for one reason:
 * only the Node agent lets us hand the socket a `lookup` function, which is
 * what makes the check-then-connect pair atomic. As a bonus we never send
 * `accept-encoding`, so the cap below counts real bytes and a compression bomb
 * has nothing to expand into.
 */
import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";

export const MAX_BYTES = 2 * 1024 * 1024; // a listing page; not a download
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 4;

export type FetchRejection =
  | "bad_url"
  | "blocked_host"
  | "too_many_redirects"
  | "too_large"
  | "not_html"
  | "unreachable"
  | "http_error";

export class UnsafeUrlError extends Error {
  constructor(readonly reason: FetchRejection) {
    super(`refused to fetch: ${reason}`);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Private, loopback, link-local and other non-routable ranges. Written out
 * rather than pulled from a package because the list is short, stable, and
 * worth being able to read in review.
 */
function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // unparseable → treat as unsafe
  }
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
  if (a === 169 && b === 254) return true; // link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true; // protocol assignments / test nets
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/**
 * Expand an IPv6 literal to its 16 bytes, or null if it isn't one.
 *
 * String prefix matching is not enough here: `::127.0.0.1`, `::7f00:1`,
 * `2002:7f00:1::` (6to4) and `64:ff9b::7f00:1` (NAT64) all reach loopback
 * without ever starting with `fe80`/`fc`/`fd` (audit F27). Working on bytes is
 * the only way to see the embedded address in each of those forms.
 */
function parseIPv6(ip: string): number[] | null {
  let text = ip.toLowerCase();
  const zone = text.indexOf("%"); // fe80::1%eth0
  if (zone !== -1) text = text.slice(0, zone);

  // A trailing dotted quad (::ffff:127.0.0.1) becomes two hex groups.
  const dotted = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const octets = dotted[1].split(".").map(Number);
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hex = `${((octets[0] << 8) | octets[1]).toString(16)}:${(
      (octets[2] << 8) |
      octets[3]
    ).toString(16)}`;
    text = `${text.slice(0, dotted.index)}${hex}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : [];
  if (halves.length === 1 && head.length !== 8) return null;
  if (head.length + tail.length > 8) return null;

  const groups = [
    ...head,
    ...Array<string>(8 - head.length - tail.length).fill("0"),
    ...tail,
  ];
  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = Number.parseInt(g, 16);
    bytes.push((n >> 8) & 0xff, n & 0xff);
  }
  return bytes;
}

const dotted = (b: number[], at: number) => b.slice(at, at + 4).join(".");

function isPrivateIPv6(ip: string): boolean {
  const b = parseIPv6(ip);
  if (!b) return true; // unparseable → treat as unsafe

  const allZero = (from: number, to: number) =>
    b.slice(from, to).every((n) => n === 0);

  // :: (unspecified) and ::1 (loopback)
  if (allZero(0, 15) && (b[15] === 0 || b[15] === 1)) return true;
  // ::a.b.c.d — IPv4-compatible, deprecated but still routed by some stacks.
  if (allZero(0, 12)) return isPrivateIPv4(dotted(b, 12));
  // ::ffff:a.b.c.d — IPv4-mapped, and ::ffff:0:a.b.c.d — IPv4-translated.
  if (allZero(0, 10) && b[10] === 0xff && b[11] === 0xff) {
    return isPrivateIPv4(dotted(b, 12));
  }
  if (allZero(0, 8) && b[8] === 0xff && b[9] === 0xff && allZero(10, 12)) {
    return isPrivateIPv4(dotted(b, 12));
  }
  // 64:ff9b::/96 and 64:ff9b:1::/48 — NAT64, embeds the v4 destination.
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) {
    return isPrivateIPv4(dotted(b, 12));
  }
  // 2002::/16 — 6to4, embeds the v4 address in the next 32 bits.
  if (b[0] === 0x20 && b[1] === 0x02) return isPrivateIPv4(dotted(b, 2));
  // 2001::/32 — Teredo, embeds the v4 server address.
  if (b[0] === 0x20 && b[1] === 0x01 && allZero(2, 4)) return true;
  // 2001:db8::/32 — documentation.
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true;
  // 100::/64 — discard-only.
  if (b[0] === 0x01 && b[1] === 0x00 && allZero(2, 8)) return true;
  // fc00::/7 unique-local, fe80::/10 link-local, fec0::/10 site-local, ff00::/8 multicast.
  if ((b[0] & 0xfe) === 0xfc) return true;
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true;
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return true;
  if (b[0] === 0xff) return true;
  return false;
}

function isPrivateAddress(address: string, family: number): boolean {
  return family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address);
}

/** The address a hop will actually connect to, once it has been vetted. */
interface PinnedAddress {
  address: string;
  family: 4 | 6;
}

/**
 * Resolve a hostname and return the single address the request may use, or
 * null if anything about it is non-public.
 *
 * EVERY record must be public before any of them is used: a name with one
 * public and one loopback answer would otherwise be a coin flip. Returning one
 * pinned address (rather than a boolean) is what closes the TOCTOU — the caller
 * hands it to the socket instead of letting the resolver run a second time.
 */
async function resolvePublicAddress(
  hostname: string,
): Promise<PinnedAddress | null> {
  const literal = isIP(hostname);
  if (literal === 4 || literal === 6) {
    if (isPrivateAddress(hostname, literal)) return null;
    return { address: hostname, family: literal };
  }

  let results: { address: string; family: number }[];
  try {
    results = await dnsLookup(hostname, { all: true, verbatim: true });
  } catch {
    return null;
  }
  if (results.length === 0) return null;
  if (results.some((r) => isPrivateAddress(r.address, r.family))) return null;

  const first = results[0];
  return { address: first.address, family: first.family === 6 ? 6 : 4 };
}

/** Parse + validate, without fetching. Exported so the UI can pre-check. */
export async function assertFetchableUrl(raw: string): Promise<URL> {
  await resolveFetchTarget(raw);
  return new URL(raw.trim());
}

/** Parse + validate, keeping the address the connect must be pinned to. */
async function resolveFetchTarget(
  raw: string,
): Promise<{ url: URL; pinned: PinnedAddress }> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError("bad_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("bad_url");
  }
  // URL keeps IPv6 literals in brackets; the resolver wants them bare.
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const pinned = await resolvePublicAddress(hostname);
  if (!pinned) throw new UnsafeUrlError("blocked_host");
  return { url, pinned };
}

export interface FetchedPage {
  url: string;
  html: string;
}

interface HopResult {
  status: number;
  location: string | null;
  contentType: string;
  contentLength: number;
  body: Buffer;
}

/**
 * One HTTP request, connecting only to `pinned.address`, reading at most
 * MAX_BYTES and never following a redirect itself.
 */
function requestHop(
  url: URL,
  pinned: PinnedAddress,
  deadline: number,
): Promise<HopResult> {
  const client = url.protocol === "https:" ? https : http;

  return new Promise<HopResult>((resolve, reject) => {
    const req = client.request(
      url,
      {
        // The socket resolves through this and only this — the address is the
        // one already vetted above, so the name cannot re-resolve to loopback
        // between the check and the connect. TLS still uses the hostname for
        // SNI and certificate validation, which is what we want.
        lookup: (_hostname, options, callback) => {
          const cb = callback as (
            err: NodeJS.ErrnoException | null,
            address: string | { address: string; family: number }[],
            family?: number,
          ) => void;
          if (options && typeof options === "object" && options.all) {
            cb(null, [{ address: pinned.address, family: pinned.family }]);
          } else {
            cb(null, pinned.address, pinned.family);
          }
        },
        headers: {
          // Honest about who we are; some sites 403 an unidentified client.
          "user-agent": "listing-import/1.0 (+https://realestateinparaguay.com)",
          accept: "text/html,application/xhtml+xml",
          // No accept-encoding on purpose: identity responses mean MAX_BYTES
          // counts the bytes that will actually be decoded.
          "accept-encoding": "identity",
        },
        timeout: Math.max(1, deadline - Date.now()),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers["content-type"] ?? "");
        const contentLength = Number(res.headers["content-length"] ?? 0);
        const location = res.headers.location ?? null;

        // Redirects and non-HTML bodies are never read — the caller only needs
        // the headers, and reading them would be free bandwidth for an attacker.
        if (status >= 300 && status < 400) {
          res.destroy();
          resolve({ status, location, contentType, contentLength, body: Buffer.alloc(0) });
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_BYTES) {
            // Stop pulling bytes the moment the cap is crossed — this is the
            // whole point of streaming rather than buffering (audit F19).
            res.destroy();
            req.destroy();
            reject(new UnsafeUrlError("too_large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status,
            location,
            contentType,
            contentLength,
            body: Buffer.concat(chunks),
          }),
        );
        res.on("error", () => reject(new UnsafeUrlError("unreachable")));
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new UnsafeUrlError("unreachable"));
    });
    req.on("error", (err) => {
      reject(err instanceof UnsafeUrlError ? err : new UnsafeUrlError("unreachable"));
    });
    req.end();
  });
}

/**
 * Fetch an HTML page from a user-supplied URL.
 *
 * Redirects are followed manually so each hop's host can be re-validated and
 * re-pinned — automatic following would happily land on localhost after a 302
 * we never saw, and would drop the pinned lookup on the way.
 */
export async function fetchUserUrl(raw: string): Promise<FetchedPage> {
  const deadline = Date.now() + TIMEOUT_MS;
  let { url, pinned } = await resolveFetchTarget(raw);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const res = await requestHop(url, pinned, deadline);

    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new UnsafeUrlError("http_error");
      const target = new URL(res.location, url);
      // A redirect may not drop TLS: an https page that 302s to http hands the
      // rest of the exchange to anyone on the path (audit F27).
      if (url.protocol === "https:" && target.protocol !== "https:") {
        throw new UnsafeUrlError("blocked_host");
      }
      ({ url, pinned } = await resolveFetchTarget(target.toString()));
      continue;
    }

    if (res.status < 200 || res.status >= 300) {
      throw new UnsafeUrlError("http_error");
    }

    if (!/text\/html|application\/xhtml/i.test(res.contentType)) {
      throw new UnsafeUrlError("not_html");
    }
    if (res.contentLength > MAX_BYTES || res.body.byteLength > MAX_BYTES) {
      throw new UnsafeUrlError("too_large");
    }

    return {
      url: url.toString(),
      html: new TextDecoder("utf-8").decode(res.body),
    };
  }

  throw new UnsafeUrlError("too_many_redirects");
}
