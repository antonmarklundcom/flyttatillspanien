import { esPanel } from "@/i18n/es";
import { imageThumbUrl } from "@/lib/format";
import { isPlaceholderPhoto } from "@/lib/photos";
import type { ListingImageRow } from "@/lib/listing-images";

/**
 * Photo management for one listing, shared verbatim by /admin/propiedades/[id]
 * and /agencia/propiedad/[id] — the same arrangement as ListingForm: the
 * caller passes its own scoped actions, and the scope guard lives in the query
 * layer, never here.
 *
 * Deliberately plain forms rather than a drag-and-drop client component: the
 * panel is used on Android phones over mobile data, and reordering by "move
 * before / move after" works with no JavaScript at all.
 *
 * It sits outside the edit <form> because a form cannot nest — photo changes
 * apply immediately, they are not part of "Guardar cambios".
 */
export function PhotoManager({
  listingId,
  images,
  storageReady,
  uploadAction,
  deleteAction,
  moveAction,
  coverAction,
}: {
  listingId: number;
  images: ListingImageRow[];
  storageReady: boolean;
  uploadAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  moveAction: (formData: FormData) => void | Promise<void>;
  coverAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <section className="panel-card" style={{ marginTop: "1.5rem" }}>
      <h2 style={{ fontSize: 18, margin: "0 0 .25rem" }}>
        {esPanel.photosTitle}
      </h2>
      <p style={{ color: "#55655F", fontSize: 13, margin: "0 0 1rem" }}>
        {esPanel.photosHint}
      </p>

      {!storageReady && (
        <p className="panel-flash panel-flash--error" role="status">
          {esPanel.photosNotConfigured}
        </p>
      )}

      <form action={uploadAction} className="panel-photos__upload">
        <input type="hidden" name="listingId" value={listingId} />
        <label className="panel-form__field" style={{ flexBasis: "100%" }}>
          <span className="auth-field__label">{esPanel.photosAddLabel}</span>
          <input
            className="auth-field__input"
            type="file"
            name="photos"
            accept="image/*"
            multiple
            required
            disabled={!storageReady}
          />
        </label>
        <button
          className="panel-btn panel-btn--primary"
          type="submit"
          disabled={!storageReady}
        >
          {esPanel.photosUpload}
        </button>
      </form>

      {images.length === 0 ? (
        <p style={{ color: "#55655F", marginTop: "1rem" }}>
          {esPanel.photosEmpty}
        </p>
      ) : (
        <ul className="panel-photos">
          {images.map((image, i) => (
            <li key={image.id} className="panel-photos__item">
              {/* Stored photos live on the R2 public host and are already
                  sized; next/image would only add a proxy hop. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="panel-photos__thumb"
                src={imageThumbUrl(image.r2Key) ?? ""}
                alt=""
                loading="lazy"
              />

              <div className="panel-photos__meta">
                {i === 0 && (
                  <span className="panel-photos__badge">
                    {esPanel.photosCover}
                  </span>
                )}
                {isPlaceholderPhoto(image.r2Key) && (
                  <span
                    className="panel-photos__note"
                    title={esPanel.photosPlaceholderNote}
                  >
                    {esPanel.photosPlaceholderNote}
                  </span>
                )}
              </div>

              <div className="panel-photos__actions">
                {i !== 0 && (
                  <form action={coverAction}>
                    <input type="hidden" name="listingId" value={listingId} />
                    <input type="hidden" name="imageId" value={image.id} />
                    <button className="panel-btn" type="submit">
                      {esPanel.photosMakeCover}
                    </button>
                  </form>
                )}

                <form action={moveAction}>
                  <input type="hidden" name="listingId" value={listingId} />
                  <input type="hidden" name="imageId" value={image.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    className="panel-btn"
                    type="submit"
                    disabled={i === 0}
                    aria-label={esPanel.photosMoveUp}
                  >
                    ↑
                  </button>
                </form>

                <form action={moveAction}>
                  <input type="hidden" name="listingId" value={listingId} />
                  <input type="hidden" name="imageId" value={image.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    className="panel-btn"
                    type="submit"
                    disabled={i === images.length - 1}
                    aria-label={esPanel.photosMoveDown}
                  >
                    ↓
                  </button>
                </form>

                <form action={deleteAction}>
                  <input type="hidden" name="listingId" value={listingId} />
                  <input type="hidden" name="imageId" value={image.id} />
                  <button className="panel-btn panel-btn--danger" type="submit">
                    {esPanel.photosDelete}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
