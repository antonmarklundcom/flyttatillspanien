/**
 * Fetch the EUR/SEK reference rate from the ECB and cache it in `fx_rates`.
 *
 *   npm run cron:fx            write the newest rate
 *   npm run cron:fx -- --dry   fetch and print, write nothing
 *
 * Source: the ECB euro foreign-exchange reference rates — free, no API key, no
 * rate limit, published once per TARGET business day around 16:00 CET, and the
 * rate Swedish banks and Skatteverket themselves reference, which is what
 * makes it defensible to print next to a property price.
 *
 * **Writes nothing on failure, on purpose.** If the ECB is down, the XML moves,
 * or this box has no outbound HTTPS, the previous row stands and
 * `formatSek()`'s 7-day staleness guard eventually removes every kronor figure
 * from the site by itself. That is the intended failure mode: a missing SEK
 * line is a small disappointment, a confidently wrong one is a complaint. The
 * same rule as `sendOtp` — never record something that did not happen.
 *
 * There is no in-process cache invalidation from here: this is a separate
 * `tsx` process and its `revalidateTag()` could not reach the running server's
 * data cache. `CACHE_TTL.fx` (one hour) is the invalidation mechanism, which
 * is documented in src/lib/cache.ts.
 */
import { db } from "../src/db";
import { fxRates } from "../src/db/schema";

const ECB_DAILY =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

const BASE = "EUR";
const QUOTE = "SEK";

interface Observation {
  rate: number;
  observedOn: string; // 'YYYY-MM-DD'
}

/**
 * Pull the SEK rate and its reference date out of the daily XML.
 *
 * Parsed with two narrow regexes rather than an XML dependency: the document
 * is a flat, stable, machine-published file of ~40 `<Cube currency=… rate=…>`
 * elements, and a parser would be more code and more supply chain for the same
 * two values. If the format ever changes this returns null and the job exits
 * without writing — which is exactly the behaviour a silent parse failure
 * needs.
 */
export function parseEcbDaily(xml: string): Observation | null {
  const day = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/);
  const rate = xml.match(
    new RegExp(`currency=['"]${QUOTE}['"]\\s+rate=['"]([0-9.]+)['"]`),
  );
  if (!day || !rate) return null;
  const value = Number(rate[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { rate: value, observedOn: day[1] };
}

async function main() {
  const dry = process.argv.includes("--dry");

  let xml: string;
  try {
    const res = await fetch(ECB_DAILY, {
      headers: { "user-agent": "ftse-fx/1.0 (+https://flyttatillspanien.se)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error(`ECB feed returned ${res.status} — wrote nothing, the previous rate stands`);
      process.exit(1);
    }
    xml = await res.text();
  } catch (e) {
    console.error(
      `could not reach the ECB feed (${e instanceof Error ? e.message : String(e)}) — wrote nothing, the previous rate stands`,
    );
    process.exit(1);
  }

  const obs = parseEcbDaily(xml);
  if (!obs) {
    console.error(
      `no ${BASE}/${QUOTE} rate found in the ECB daily feed (format change?) — wrote nothing, the previous rate stands`,
    );
    process.exit(1);
  }

  if (dry) {
    console.log(`[dry] ${BASE}/${QUOTE} ${obs.rate} observed ${obs.observedOn} — nothing written`);
    process.exit(0);
  }

  const values = {
    base: BASE,
    quote: QUOTE,
    rate: obs.rate.toFixed(6),
    observedOn: obs.observedOn,
    source: "ecb" as const,
    fetchedAt: new Date(),
  };
  await db.insert(fxRates).values(values).onDuplicateKeyUpdate({ set: values });

  console.log(`${BASE}/${QUOTE} ${obs.rate} observed ${obs.observedOn} — written`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
