import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelBar } from "@/components/panel/PanelBar";
import { ListingForm } from "@/components/panel/ListingForm";
import { PhotoManager } from "@/components/panel/PhotoManager";
import { ListingStats } from "@/components/panel/ListingStats";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countReviewQueue } from "@/lib/panel-queries";
import { ADMIN_STATUSES, getEditableListing } from "@/lib/listing-edit";
import { listListingImages } from "@/lib/listing-images";
import {
  getListingDailyViews,
  getPanelListingStats,
} from "@/lib/stats-queries";
import { isR2Configured } from "@/lib/r2";
import { listPublishLocations } from "@/lib/publish-queries";
import { esPanel } from "@/i18n/es";
import { listingUrl } from "@/lib/urls";
import { adminTabs } from "../../tabs";
import { adminDeleteListingAction, adminUpdateListingAction } from "../actions";
import {
  adminDeletePhotoAction,
  adminMovePhotoAction,
  adminSetCoverAction,
  adminUploadPhotosAction,
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

export default async function AdminListingEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ id }, { msg }, user] = await Promise.all([
    params,
    searchParams,
    requireSuperAdmin(),
  ]);

  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) notFound();

  const [reviewCount, listing, locations, images, daily] = await Promise.all([
    countReviewQueue(),
    getEditableListing(listingId, { kind: "admin" }),
    listPublishLocations(),
    listListingImages(listingId, { kind: "admin" }),
    getListingDailyViews(listingId, { kind: "admin" }),
  ]);
  if (!listing) notFound();

  // Lead count for this one listing, from the same scoped aggregate the
  // listings table uses.
  const leadCount =
    (await getPanelListingStats({ kind: "admin" })).get(listing.id)?.leads ?? 0;

  const flash = msg ? FLASH[msg] : undefined;

  return (
    <>
      <PanelBar
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("listings", reviewCount)}
      />
      <main className="panel site-main">
        <p>
          <Link className="panel-btn" href="/admin/propiedades">
            {esPanel.backToListings}
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
              {esPanel.viewListing}
            </Link>
          ) : null}
          {listing.reviewNotes ? <span>· {listing.reviewNotes}</span> : null}
        </p>

        <ListingStats
          views={daily.reduce((sum, d) => sum + d.views, 0)}
          leads={leadCount}
          daily={daily}
        />

        <article className="panel-card">
          <ListingForm
            listing={listing}
            locations={locations}
            statuses={ADMIN_STATUSES}
            action={adminUpdateListingAction}
            canDelete
            deleteAction={adminDeleteListingAction}
          />
        </article>


        <PhotoManager
          listingId={listing.id}
          images={images}
          storageReady={isR2Configured()}
          uploadAction={adminUploadPhotosAction}
          deleteAction={adminDeletePhotoAction}
          moveAction={adminMovePhotoAction}
          coverAction={adminSetCoverAction}
        />
      </main>
    </>
  );
}
