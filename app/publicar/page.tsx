import type { Metadata } from "next";
import { homeForRole, requireUser } from "@/lib/auth/guards";
import {
  getUserDraft,
  listNearbyProjects,
  listPublishLocations,
} from "@/lib/publish-queries";
import { svPublish } from "@/i18n/sv";
import { brandName } from "@/lib/brand-server";
import { isMessagingConfigured } from "@/lib/crm";
import {
  PublishWizard,
  type InitialDraft,
  type PublishPrefill,
} from "@/components/publish/PublishWizard";
import { resolveCity } from "@/lib/queries";
import { OPERATIONS, PROPERTY_TYPES } from "@/lib/import/types";
import { listListingImages, type ListingImageRow } from "@/lib/listing-images";

export const metadata: Metadata = {
  title: svPublish.pageTitle,
  robots: { index: false, follow: false },
};

// Draft state is per-user; never statically cache the wizard.
export const dynamic = "force-dynamic";

/**
 * Seed values handed over by /tasacion (audit I4). Every one is re-validated
 * here against the same enums the actions use, and the city is resolved to a
 * real location id — a query string is a visitor-controlled input, so an
 * unknown value is dropped rather than carried into the form.
 */
async function readPrefill(params: {
  ciudad?: string;
  tipo?: string;
  operacion?: string;
  m2?: string;
}): Promise<PublishPrefill | null> {
  const out: PublishPrefill = {};

  if (params.operacion && (OPERATIONS as readonly string[]).includes(params.operacion)) {
    out.operation = params.operacion as PublishPrefill["operation"];
  }
  if (params.tipo && (PROPERTY_TYPES as readonly string[]).includes(params.tipo)) {
    out.propertyType = params.tipo as PublishPrefill["propertyType"];
  }

  const m2 = Number(params.m2);
  if (Number.isFinite(m2) && m2 >= 10 && m2 <= 100_000) {
    // /tasacion asks for lot m² on a terreno and built m² on everything else,
    // and the wizard keeps those in two different fields.
    if (out.propertyType === "terreno") out.plotM2 = String(Math.round(m2));
    else out.builtM2 = String(Math.round(m2));
  }

  if (params.ciudad) {
    const city = await resolveCity(params.ciudad);
    if (city) out.locationId = city.id;
  }

  return Object.keys(out).length > 0 ? out : null;
}

export default async function PublishPage({
  searchParams,
}: {
  searchParams: Promise<{
    draft?: string;
    ciudad?: string;
    tipo?: string;
    operacion?: string;
    m2?: string;
  }>;
}) {
  const params = await searchParams;
  const { draft } = params;

  // Preserve the prefill across the login bounce: requireUser("/publicar")
  // would drop the query string, and a visitor who signed in from /tasacion
  // would land on an empty wizard having answered the questions already.
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => typeof v === "string") as [string, string][],
  ).toString();
  const user = await requireUser(query ? `/publicar?${query}` : "/publicar");

  const [locations, projects] = await Promise.all([
    listPublishLocations(),
    listNearbyProjects(),
  ]);

  // A prefill only ever matters when there is no draft to resume; resolving it
  // alongside the locations costs nothing and keeps the branch below simple.
  const prefill = await readPrefill(params);

  // Resume an existing draft only if it belongs to the signed-in user.
  let initialDraft: InitialDraft | null = null;
  let initialPhotos: ListingImageRow[] = [];
  const draftId = Number(draft);
  if (Number.isInteger(draftId) && draftId > 0) {
    const row = await getUserDraft(user.id, draftId);
    if (row) {
      initialDraft = {
        draftId: row.id,
        operation: row.operation,
        propertyType: row.propertyType,
        title: row.title,
        descriptionEs: row.descriptionEs ?? "",
        bedrooms: row.bedrooms != null ? String(row.bedrooms) : "",
        bathrooms: row.bathrooms != null ? String(row.bathrooms) : "",
        parking: row.parking != null ? String(row.parking) : "",
        builtM2: row.builtM2 != null ? String(row.builtM2) : "",
        usableM2: row.usableM2 != null ? String(row.usableM2) : "",
        plotM2: row.plotM2 != null ? String(row.plotM2) : "",
        locationId: row.locationId,
        projectId: row.projectId,
        priceEur: String(row.priceEur),
        videoUrl: row.videoUrl ?? "",
        referenciaCatastral: row.referenciaCatastral ?? "",
        energyRating: row.energyRating ?? "",
        legalStatus: row.legalStatus,
        chargesStatus: row.chargesStatus,
        touristLicence: row.touristLicence ?? "",
      };
      // Same owner scope the upload action uses, so a resumed draft shows the
      // photos already stored for it.
      initialPhotos = await listListingImages(row.id, {
        kind: "owner",
        userId: user.id,
      });
    }
  }

  return (
    <main className="site-main wizard-wrap">
      <header className="wizard-head">
        <h1 className="wizard-head__title">{svPublish.pageTitle}</h1>
        <p className="wizard-head__subtitle">{svPublish.pageSubtitle}</p>
      </header>
      <PublishWizard
        locations={locations}
        projects={projects}
        accountEmail={user.email}
        initialDraft={initialDraft}
        initialPhotos={initialPhotos}
        prefill={prefill}
        otpEnabled={isMessagingConfigured()}
        homeHref={homeForRole(user)}
      />
    </main>
  );
}
