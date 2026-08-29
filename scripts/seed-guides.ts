/**
 * Seed `locations.guide_content_sv` — a short, factual area note for every
 * municipio (npm run seed:guides).
 *
 * **Grounded only in general, well-established geography**: comunidad,
 * provincia, coastal/island region name, and — where it is genuinely common
 * knowledge — one or two landmarks or the area's general character. No price,
 * count or median claim: those columns don't have real data yet
 * (`listing_counts` is cron-refreshed from published listings, which do not
 * exist in production), and the design doc's "no invented facts" rule (the
 * same one `acquisition_costs`' PLACEHOLDER rates and `dedupKey()`'s `null`
 * both follow) means a page must never quote a number the database cannot
 * back up. Once real listing volume exists, `cron:medians`-backed sentences
 * ("X annonser i {ort}, medianpris Y €/m²") are the natural upgrade — see
 * `CLAUDE.md`'s i18n section for how a machine-generated addition should be
 * marked as such if that day comes.
 *
 * Idempotent: upserts by `full_slug`, matching `seed-locations.ts`'s own key.
 * Zonas are left NULL on purpose — nullable means "not stated", and a
 * one-paragraph guide at the neighbourhood level (Nueva Andalucía, Old Town,
 * …) risks a confident-sounding but unverified specific claim for very little
 * SEO benefit at MVP. Grep `guideContentSv` before extending this: as of this
 * script, no page template reads the column yet (KNOWN-ISSUES.md); this is
 * the data half only.
 */
import { db } from "../src/db";
import { locations } from "../src/db/schema";
import { eq } from "drizzle-orm";

const GUIDE_SV: Record<string, string> = {
  marbella:
    "Marbella ligger vid Costa del Sol i provinsen Málaga, Andalusien. Orten är känd för marinan Puerto Banús, sina golfbanor och sin gamla stadskärna, och har länge varit ett av de mest efterfrågade områdena för utländska köpare på spanska solkusten.",
  estepona:
    "Estepona ligger vid Costa del Sol i provinsen Málaga, mellan Marbella och Sotogrande. Orten har en välbevarad gammal stadskärna och en lång strandpromenad.",
  mijas:
    "Mijas ligger vid Costa del Sol i provinsen Málaga och består av den vitkalkade bergsbyn Mijas Pueblo och kustdelen Mijas Costa, med flera golfbanor.",
  fuengirola:
    "Fuengirola ligger vid Costa del Sol i provinsen Málaga, mellan Marbella och Málaga stad, med en lång sandstrand och en kompakt, gångvänlig stadskärna.",
  benalmadena:
    "Benalmádena ligger vid Costa del Sol i provinsen Málaga och omfattar kustdelen Benalmádena Costa med marina, samt den äldre bergsbyn Benalmádena Pueblo.",
  torremolinos:
    "Torremolinos ligger vid Costa del Sol i provinsen Málaga, granne med Málaga stad, och är en av kustens äldsta och mest etablerade turistorter.",
  malaga:
    "Málaga är huvudort i provinsen med samma namn, Andalusien, med flygplats, hamn och tågförbindelser till övriga Costa del Sol.",
  nerja:
    "Nerja ligger längst österut på Costa del Sol i provinsen Málaga, känd för sina klippformationer, grottor och utsiktsplatsen Balcón de Europa.",
  manilva:
    "Manilva ligger längst västerut på Costa del Sol i provinsen Málaga, nära gränsen till provinsen Cádiz.",
  mojacar:
    "Mojácar ligger vid Costa de Almería i provinsen Almería och består av den vitkalkade byn Mojácar Pueblo på en kulle och kustremsan Mojácar Playa.",
  vera: "Vera ligger vid Costa de Almería i provinsen Almería, med kustdelen Vera Playa.",
  "roquetas-de-mar":
    "Roquetas de Mar ligger vid Costa de Almería i provinsen Almería, en av regionens större kustorter.",
  torrevieja:
    "Torrevieja ligger vid Costa Blanca i provinsen Alicante och har en av kustens största skandinaviska och nordeuropeiska bosättningar, med saltsjöarna vid Las Salinas som kännetecken.",
  "orihuela-costa":
    "Orihuela Costa är kustdelen av kommunen Orihuela vid Costa Blanca i provinsen Alicante, söder om Torrevieja, med flera golfbanor och stränder.",
  "alfaz-del-pi":
    "Alfaz del Pi ligger vid Costa Blanca i provinsen Alicante, mellan Benidorm och Altea, med en stor utlandsbosatt befolkning.",
  altea:
    "Altea ligger vid Costa Blanca i provinsen Alicante, känd för sin vitkalkade gamla stadskärna med den blåkupolade kyrkan.",
  calpe:
    "Calpe ligger vid Costa Blanca i provinsen Alicante, känd för klippan Peñón de Ifach som reser sig direkt ur havet.",
  javea:
    "Jávea ligger vid Costa Blanca i provinsen Alicante, mellan Calpe och Dénia, med en havsnära gammal stadskärna och en egen hamndel.",
  denia:
    "Dénia ligger längst norrut på Costa Blanca i provinsen Alicante, med färjeförbindelse till Balearerna och ett slott med utsikt över staden och hamnen.",
  "guardamar-del-segura":
    "Guardamar del Segura ligger vid Costa Blanca i provinsen Alicante, vid Seguraflodens mynning, mellan Torrevieja och Alicante stad.",
  "santa-pola":
    "Santa Pola ligger vid Costa Blanca i provinsen Alicante, en fiske- och hamnstad med färjeförbindelse till ön Tabarca.",
  "san-javier":
    "San Javier ligger vid Costa Cálida i provinsen Murcia, vid Mar Menor-lagunen.",
  "los-alcazares":
    "Los Alcázares ligger vid Costa Cálida i provinsen Murcia, på västra sidan av Mar Menor-lagunen.",
  cartagena:
    "Cartagena är en historisk hamnstad vid Costa Cálida i provinsen Murcia, med rötter från fenicisk och romersk tid.",
  mazarron:
    "Mazarrón ligger vid Costa Cálida i provinsen Murcia, med kustdelen Puerto de Mazarrón.",
  palma:
    "Palma är huvudstad på Mallorca, Illes Balears, med en historisk stadskärna kring katedralen La Seu och en av öns största marinor.",
  calvia:
    "Calvià ligger på Mallorcas sydvästra kust, Illes Balears, och omfattar flera av öns mest kända turistorter, bland annat Palmanova och Santa Ponsa.",
  andratx:
    "Andratx ligger längst västerut på Mallorca, Illes Balears, med hamndelen Port d'Andratx omgiven av bergskedjan Serra de Tramuntana.",
  pollenca:
    "Pollença ligger i norra delen av Mallorca, Illes Balears, vid foten av Serra de Tramuntana, med hamndelen Port de Pollença.",
  alcudia:
    "Alcúdia ligger i norra delen av Mallorca, Illes Balears, med en välbevarad medeltida stadsmur och närhet till naturområdet S'Albufera.",
  santanyi:
    "Santanyí ligger i sydöstra Mallorca, Illes Balears, känd för sina kalkstensklippor och kalvikar längs kusten.",
  mogan:
    "Mogán ligger på sydvästra Gran Canaria, Kanarieöarna, med kustorterna Puerto Rico och Puerto de Mogán.",
  "san-bartolome-de-tirajana":
    "San Bartolomé de Tirajana ligger på södra Gran Canaria, Kanarieöarna, och omfattar turistorten Maspalomas med sina sanddyner.",
  adeje:
    "Adeje ligger på sydvästra Teneriffa, Kanarieöarna, och omfattar kustorten Costa Adeje.",
  arona:
    "Arona ligger på södra Teneriffa, Kanarieöarna, och omfattar turistorten Playa de las Américas.",
  "lloret-de-mar":
    "Lloret de Mar ligger vid Costa Brava i provinsen Girona, en av kustens mest kända turistorter.",
  roses:
    "Roses ligger vid Costa Brava i provinsen Girona, vid Rosesbukten nära gränsen till Frankrike.",
  "castell-platja-d-aro":
    "Castell-Platja d'Aro ligger vid Costa Brava i provinsen Girona, med flera stränder och vikar.",
  barcelona:
    "Barcelona är Kataloniens huvudstad, med Medelhavskust, internationell flygplats och tågförbindelser till övriga Spanien.",
  sitges:
    "Sitges ligger vid kusten söder om Barcelona, Katalonien, känd för sin gamla stadskärna och sina stränder.",
  madrid:
    "Madrid är Spaniens huvudstad, belägen i landets inland, med landets största inrikes flyg- och tågnav.",
};

async function main() {
  const rows = await db.query.locations.findMany({
    where: (l, { eq }) => eq(l.level, "municipio"),
    columns: { id: true, slug: true, fullSlug: true, name: true },
  });

  let updated = 0;
  let missing: string[] = [];
  for (const row of rows) {
    const text = GUIDE_SV[row.slug];
    if (!text) {
      missing.push(`${row.name} (${row.slug})`);
      continue;
    }
    await db
      .update(locations)
      .set({ guideContentSv: text, guideUpdatedAt: new Date() })
      .where(eq(locations.id, row.id));
    updated++;
  }

  console.log(`seed:guides — ${updated}/${rows.length} municipios updated`);
  if (missing.length) {
    console.log(`no guide text for: ${missing.join(", ")}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
