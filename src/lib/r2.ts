/**
 * Cloudflare R2 object storage — the home for listing photos (ARCHITECTURE
 * M0). R2 speaks the S3 API, so this is the AWS SDK pointed at an R2 endpoint.
 *
 * Every entry point checks isR2Configured() first: the envs are a `[YOU]` item
 * and may well be missing in dev or on a half-set-up deploy. Missing config is
 * a *disabled feature*, never a crash — the panel says "photo storage is not
 * configured" instead of the page 500ing, and nothing else in the app cares.
 *
 * Reads never come through here. Public delivery is the R2 public bucket URL
 * (R2_PUBLIC_BASE_URL — the bucket's pub-*.r2.dev URL or a custom domain
 * actually mapped in Cloudflare; see .env.example), which is what
 * `imageUrl()` in format.ts builds — zero egress cost and no Node process in
 * the path.
 */
import "server-only";
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

function readConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function isR2Configured(): boolean {
  return readConfig() !== null;
}

/**
 * Built lazily and cached: at module load the env may not be there yet, and a
 * client constructed from missing credentials would be a startup crash rather
 * than a disabled feature (see src/db/index.ts for why that distinction is
 * load-bearing on this host).
 */
let cached: { client: S3Client; bucket: string } | null = null;

function connect(): { client: S3Client; bucket: string } | null {
  if (cached) return cached;
  const cfg = readConfig();
  if (!cfg) return null;
  cached = {
    bucket: cfg.bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    }),
  };
  return cached;
}

export class R2NotConfiguredError extends Error {
  constructor() {
    super("R2 is not configured (R2_ACCOUNT_ID / keys / bucket missing)");
    this.name = "R2NotConfiguredError";
  }
}

/**
 * Store one object. Photos are immutable once written — a new upload gets a
 * new key rather than overwriting — so they are safe to cache forever.
 */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const conn = connect();
  if (!conn) throw new R2NotConfiguredError();
  await conn.client.send(
    new PutObjectCommand({
      Bucket: conn.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

/**
 * Best-effort delete. A key that fails to disappear is orphaned bytes in a
 * 10 GB bucket — cheap. Losing the DB row's delete because R2 errored would
 * leave a photo the panel cannot remove, which is not cheap, so callers
 * delete the row regardless of what this returns.
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  const conn = connect();
  if (!conn || keys.length === 0) return;
  await conn.client.send(
    new DeleteObjectsCommand({
      Bucket: conn.bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
    }),
  );
}
