import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelBar } from "@/components/panel/PanelBar";
import { ListingForm } from "@/components/panel/ListingForm";
import { PhotoManager } from "@/components/panel/PhotoManager";
import { ListingStats } from "@/components/panel/ListingStats";
import { canManageTeam, panelScope, requireAgencyContext } from "@/lib/auth/guards";
import {
  agencyStatusOptions,
  getEditableListing,
  type EditScope,
} from "@/lib/listing-edit";
import { listListingImages } from "@/lib/listing-images";
import {
  getListingDailyViews,
  getPanelListingStats,
} from "@/lib/stats-queries";
import { isR2Configured } from "@/lib/r2";
import { listPublishLocations } from "@/lib/publish-queries";
import { svPanel } from "@/i18n/sv";
import { listingUrl } from "@/lib/urls";
import { agencyTabs } from "../../tabs";
import { agencyUpdateListingAction } from "./actions";
import {
  agencyDeletePhotoAction,
  agencyMovePhotoAction,
  agencySetCoverAction,
  agencyUploadPhotosAction,
} from "./photo-actions";

export const metadata: Metadata = {
  title: `Editar aviso`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  saved: { text: svPanel.listingSaved },
  invalid: { text: svPanel.listingInvalid, error: true },
  not_found: { text: svPanel.listingNotFound, error: true },
  photos_uploaded: { text: svPanel.photosUploaded },
  photos_rejected: { text: svPanel.photosRejected, error: true },
  photos_deleted: { text: svPanel.photosDeleted },
  photos_reordered: { text: svPanel.photosReordered },
  photos_none: { text: svPanel.photosNoFiles, error: true },
  photos_too_many: { text: svPanel.photosTooManyFiles, error: true },
  photos_unconfigured: { text: svPanel.photosNotConfigured, error: true },
  imported: { text: svPanel.importCreated },
};

export default async function AgencyListingEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ id }, { msg }, ctx] = await Promise.all([
    params,
    searchParams,
    requireAgencyContext(),
  ]);

  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) notFound();

  // Agency accounts are scoped to their agency; an independent agent to their
  // own rows (panelScope) — so this page serves both without a special case.
  const scope: EditScope = panelScope(ctx);

  const [listing, locations, images, daily, stats] = await Promise.all([
    getEditableListing(listingId, scope),
    listPublishLocations(),
    // Same scope the listing was loaded with — an agency reaches only its own.
    listListingImages(listingId, scope),
    getListingDailyViews(listingId, scope),
    getPanelListingStats(scope),
  ]);
  if (!listing) notFound();

  const flash = msg ? FLASH[msg] : undefined;

  return (
    <>
      <PanelBar
        title="Panel de la inmobiliaria"
        role={ctx.user.role}
        userName={ctx.user.name}
        tabs={agencyTabs("listings", canManageTeam(ctx))}
      />
      <main className="panel site-main">
        <p>
          <Link className="panel-btn" href="/agencia">
            {svPanel.backToListings}
          </Link>
        </p>

        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>{flash.text}</p>
        ) : null}

        <h2 className="panel-section__title">{listing.title}</h2>
        <p className="panel-card__meta">
          <span>#{listing.publicId}</span>
          {listing.status === "published" ? (
            <Link href={listingUrl(listing)} target="_blank">
              {svPanel.viewListing}
            </Link>
          ) : null}
          {listing.reviewNotes ? <span>· {listing.reviewNotes}</span> : null}
        </p>

        <ListingStats
          views={daily.reduce((sum, d) => sum + d.views, 0)}
          leads={stats.get(listing.id)?.leads ?? 0}
          daily={daily}
        />

        <article className="panel-card">
          <ListingForm
            listing={listing}
            locations={locations}
            statuses={agencyStatusOptions(listing.status)}
            action={agencyUpdateListingAction}
          />
        </article>


        <PhotoManager
          listingId={listing.id}
          images={images}
          storageReady={isR2Configured()}
          uploadAction={agencyUploadPhotosAction}
          deleteAction={agencyDeletePhotoAction}
          moveAction={agencyMovePhotoAction}
          coverAction={agencySetCoverAction}
        />
      </main>
    </>
  );
}
