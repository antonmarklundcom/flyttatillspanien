/**
 * Listing photo processing. Everything uploaded is re-encoded here before it
 * reaches R2 — never the visitor's original file.
 *
 * Re-encoding is what makes the upload path safe as well as fast: decoding
 * with sharp and writing a fresh WebP means a file that claims to be a JPEG
 * but is not never gets stored, and EXIF (including the GPS tag on a phone
 * photo of a house — precise coordinates are "never shown publicly at full
 * precision", schema §2.1) is dropped rather than served.
 *
 * Two derivatives per photo, because the market is Android on mobile data:
 *   {key}       — up to 1600px, the detail-page gallery
 *   {key}-thumb — up to 480px, the card grid (~20 per category page)
 * The thumb is a key convention, not a column: see `thumbKey()` and the
 * matching `imageThumbUrl()` in format.ts.
 */
import "server-only";
import sharp from "sharp";

/** Uploads above this are rejected before decoding — a phone photo is ~5 MB. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const FULL_MAX_PX = 1600;
const THUMB_MAX_PX = 480;

export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

export interface ProcessedImage {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

export class ImageRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRejectedError";
  }
}

/**
 * Decode, orient, downscale and re-encode. Throws ImageRejectedError for
 * anything sharp cannot read — the caller turns that into a per-file message
 * rather than failing the whole upload batch.
 */
export async function processListingImage(
  input: Buffer,
): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageRejectedError("El archivo supera los 12 MB.");
  }

  // rotate() with no argument applies the EXIF orientation, so portrait phone
  // photos are not stored sideways; the tag itself is dropped on re-encode.
  const base = sharp(input, { failOn: "error" }).rotate();

  let meta;
  try {
    meta = await base.metadata();
  } catch {
    throw new ImageRejectedError("No se pudo leer la imagen.");
  }
  if (!meta.width || !meta.height) {
    throw new ImageRejectedError("La imagen no tiene dimensiones válidas.");
  }

  const resize = (max: number) =>
    base
      .clone()
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 });

  const [full, thumb] = await Promise.all([
    resize(FULL_MAX_PX).toBuffer({ resolveWithObject: true }),
    resize(THUMB_MAX_PX).toBuffer(),
  ]);

  return {
    full: full.data,
    thumb,
    // Dimensions of what we actually stored, not of the original — they feed
    // the <img> width/height that stops the gallery reflowing on load.
    width: full.info.width,
    height: full.info.height,
  };
}

/** Every stored derivative is WebP, whatever came in. */
export const STORED_CONTENT_TYPE = "image/webp";

/**
 * Key scheme: listings/{publicId}/{random}.webp — grouped by listing so a
 * listing's photos can be listed or purged by prefix, and random rather than
 * sequential so a key is never guessable from a public_id.
 */
export function buildImageKey(publicId: string): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `listings/${publicId}/${rand}.webp`;
}

/** Thumbnail key for a stored key. Must mirror imageThumbUrl() in format.ts. */
export function thumbKey(key: string): string {
  return key.replace(/\.webp$/, "-thumb.webp");
}
