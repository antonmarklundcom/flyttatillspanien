/**
 * Fetch the ECB daily reference rate and upsert EUR/SEK into fx_rates
 * (docs/SPAIN-PORTAL-DESIGN.md §2). Run as `npm run cron:fx`.
 *
 * Source: https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml —
 * free, no API key, published once per TARGET business day around 16:00 CET.
 * The XML is a fixed, simple shape (a flat list of <Cube currency="XXX"
 * rate="..."/> elements under one dated <Cube time="YYYY-MM-DD">), so a
 * small regex extraction is used rather than pulling in an XML parser
 * dependency for one field.
 *
 * **Writes nothing on fetch failure — the previous rate stands.** This cron
 * runs out-of-process (a separate tsx invocation), so `revalidateTag()` here
 * cannot reach the running Next server's data cache; the TTL
 * (`CACHE_TTL.fx`, src/lib/cache.ts) is what actually invalidates the read
 * side. If the newest `fx_rates` row is older than `FX_MAX_AGE_DAYS`,
 * `formatSek()` (src/lib/format.ts) returns null and every SEK line
 * disappears from the site rather than showing a stale or invented number.
 */
import { db } from "../src/db";
import { fxRates } from "../src/db/schema";

const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

async function main() {
  let xml: string;
  try {
    const res = await fetch(ECB_URL, {
      headers: { "user-agent": "flyttatillspanien.se-fx-cron/1.0 (+https://flyttatillspanien.se)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`ECB responded ${res.status}`);
    xml = await res.text();
  } catch (err) {
    console.error("cron:fx — fetch failed, leaving the previous rate in place:", err);
    process.exit(1);
  }

  const dateMatch = xml.match(/<Cube time="(\d{4}-\d{2}-\d{2})"/);
  const rateMatch = xml.match(/<Cube currency="SEK" rate="([\d.]+)"/);

  if (!dateMatch || !rateMatch) {
    console.error("cron:fx — could not find EUR/SEK in the ECB XML (format changed?). Writing nothing.");
    process.exit(1);
  }

  const observedOn = dateMatch[1];
  const rate = rateMatch[1];

  await db
    .insert(fxRates)
    .values({
      base: "EUR",
      quote: "SEK",
      rate,
      observedOn,
      source: "ecb",
      fetchedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: { rate, observedOn, source: "ecb", fetchedAt: new Date() },
    });

  console.log(`cron:fx — EUR/SEK ${rate} (observed ${observedOn}) written.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
