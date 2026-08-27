import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelBar } from "@/components/panel/PanelBar";
import { ListingForm } from "@/components/panel/ListingForm";
import { PhotoManager } from "@/components/panel/PhotoManager";
import { ListingStats } from "@/components/panel/ListingStats";
import { requireOwnerContext } from "@/lib/auth/guards";
import { agencyStatusOptions, getEditableListing } from "@/lib/listing-edit";
import { listListingImages } from "@/lib/listing-images";
import { getListingDailyViews, getPanelListingStats } from "@/lib/stats-queries";
import { isR2Configured } from "@/lib/r2";
import { listPublishLocations } from "@/lib/publish-queries";
import { esOwner, esPanel } from "@/i18n/es";
import { listingUrl } from "@/lib/urls";
import { ownerTabs } from "../../tabs";
import { ownerUpdateListingAction } from "./actions";
import {
  ownerDeletePhotoAction,
  ownerMovePhotoAction,
  ownerSetCoverAction,
  ownerUploadPhotosAction,
} from "./photo-actions";

export const metadata: Metadata = {
  title: `Editar aviso`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  saved: { text: esPanel.listingSaved },
  invalid: { text: esPanel.listingInvalid, error: true },
  not_found: { text: esPanel.listingNotFound, error: true },
  photos_uploaded: { text: esPanel.photosUploaded },
  photos_rejected: { text: esPanel.photosRejected, error: true },
  photos_deleted: { text: esPanel.photosDeleted },
  photos_reordered: { text: esPanel.photosReordered },
  photos_none: { text: esPanel.photosNoFiles, error: true },
  photos_too_many: { text: esPanel.photosTooManyFiles, error: true },
  photos_unconfigured: { text: esPanel.photosNotConfigured, error: true },
};

export default async function OwnerListingEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ id }, { msg }, { user, scope }] = await Promise.all([
    params,
    searchParams,
    requireOwnerContext(),
  ]);

  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) notFound();

  const [listing, locations, images, daily, stats] = await Promise.all([
    getEditableListing(listingId, scope),
    listPublishLocations(),
    // Same scope the listing was loaded with — owner rows only.
    listListingImages(listingId, scope),
    getListingDailyViews(listingId, scope),
    getPanelListingStats(scope),
  ]);
  // Not theirs, or not a listing: a 404, not a 403 — a stranger should not be
  // able to tell the difference between a row that is missing and one that is
  // somebody else's.
  if (!listing) notFound();

  const flash = msg ? FLASH[msg] : undefined;

  return (
    <>
      <PanelBar
        title={esOwner.panelTitle}
        role={user.role}
        userName={user.name}
        tabs={ownerTabs("listings")}
      />
      <main className="panel site-main">
        <p>
          <Link className="panel-btn" href="/mis-avisos">
            {esOwner.backToListings}
          </Link>
        </p>

        {flash ? (
          <p className={flash.error ? "auth-error" : "panel-flash"}>
            {flash.text}
          </p>
        ) : null}

        <h2 className="panel-section__title">{listing.title}</h2>
        <p className="panel-card__meta">
          <span>#{listing.publicId}</span>
          {listing.status === "published" ? (
            <Link href={listingUrl(listing)} target="_blank">
              {esOwner.viewListing}
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
            action={ownerUpdateListingAction}
          />
        </article>

        <PhotoManager
          listingId={listing.id}
          images={images}
          storageReady={isR2Configured()}
          uploadAction={ownerUploadPhotosAction}
          deleteAction={ownerDeletePhotoAction}
          moveAction={ownerMovePhotoAction}
          coverAction={ownerSetCoverAction}
        />
      </main>
    </>
  );
}
