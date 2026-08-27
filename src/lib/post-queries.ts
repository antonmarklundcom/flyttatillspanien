/**
 * Editorial reads and writes for `posts` (schema §2.10).
 *
 * Public reads are FAIL-SOFT: Hostinger auto-deploys on a push to main but
 * migrations are run by hand, so between deploy and `npm run db:migrate` the
 * posts table may not exist yet. A missing table there must degrade to "no
 * posts" — an empty /guias is a non-event, a 500 on a page linked from the
 * main menu is not. Panel writes do NOT swallow anything: the author needs to
 * see a real error.
 */
import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { posts, users } from "@/db/schema";
import { markdownToPlainText, readingMinutes } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, CACHE_TTL } from "@/lib/cache";

export type PostRow = typeof posts.$inferSelect;

export interface PostCard {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: PostRow["category"];
  coverR2Key: string | null;
  publishedAt: Date | null;
  readingMinutes: number;
}

export const POST_CATEGORY_LABEL: Record<PostRow["category"], string> = {
  guia: "Guía",
  mercado: "Mercado",
  noticia: "Noticia",
};

/**
 * True when the failure is "the table isn't there yet", not a real fault.
 *
 * Drizzle wraps driver errors in its own `Failed query: …` Error and hangs the
 * mysql2 error off `cause`, so the code is never on the top-level object —
 * checking only there silently disabled the whole fail-soft path. Walk the
 * chain, and match on the message too: `ER_NO_SUCH_TABLE` is the code, but a
 * wrapper that only carries a message still has "doesn't exist" in it.
 */
function isMissingTable(err: unknown): boolean {
  for (let e: unknown = err, hops = 0; e && hops < 5; hops++) {
    const node = e as { code?: string; message?: string; cause?: unknown };
    if (node.code === "ER_NO_SUCH_TABLE") return true;
    if (node.message && /doesn't exist|no such table/i.test(node.message)) {
      return true;
    }
    e = node.cause;
  }
  return false;
}

function toCard(row: PostRow): PostCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt?.trim() || markdownToPlainText(row.body, 180),
    category: row.category,
    coverR2Key: row.coverR2Key,
    publishedAt: row.publishedAt,
    readingMinutes: readingMinutes(row.body),
  };
}

/** Published posts, newest first — the /guias index. */
async function listPublishedPostsUncached(limit = 60): Promise<PostCard[]> {
  try {
    const rows = await db
      .select()
      .from(posts)
      .where(eq(posts.status, "published"))
      .orderBy(desc(posts.publishedAt), desc(posts.id))
      .limit(limit);
    return rows.map(toCard);
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

export interface PostDetail {
  post: PostRow;
  authorName: string | null;
  readingMinutes: number;
  related: PostCard[];
}

async function getPublishedPostUncached(
  slug: string,
): Promise<PostDetail | null> {
  try {
    const [row] = await db
      .select({ post: posts, authorName: users.name })
      .from(posts)
      .leftJoin(users, eq(posts.authorUserId, users.id))
      .where(and(eq(posts.slug, slug), eq(posts.status, "published")))
      .limit(1);
    if (!row) return null;

    const related = await db
      .select()
      .from(posts)
      .where(and(eq(posts.status, "published"), ne(posts.id, row.post.id)))
      .orderBy(desc(posts.publishedAt), desc(posts.id))
      .limit(3);

    return {
      post: row.post,
      authorName: row.authorName,
      readingMinutes: readingMinutes(row.post.body),
      related: related.map(toCard),
    };
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

/** Slugs of every published post — sitemap. */
export async function listPublishedPostSlugs(): Promise<
  { slug: string; updatedAt: Date | null }[]
> {
  try {
    return await db
      .select({ slug: posts.slug, updatedAt: posts.updatedAt })
      .from(posts)
      .where(eq(posts.status, "published"));
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Panel side — super-admin only (guarded at the call site)            */
/* ------------------------------------------------------------------ */

/**
 * Whether the posts table exists yet. Hostinger deploys on push but
 * migrations are manual, so the panel can land before its table does — this
 * lets /admin/guias say "run the migration" instead of throwing a 500 the
 * founder has to go read logs to understand.
 */
export async function isPostsTableReady(): Promise<boolean> {
  try {
    await db.select({ id: posts.id }).from(posts).limit(1);
    return true;
  } catch (err) {
    if (isMissingTable(err)) return false;
    throw err;
  }
}

/** Every post, drafts included, newest activity first. */
export async function listAllPosts(): Promise<PostRow[]> {
  return db
    .select()
    .from(posts)
    .orderBy(desc(posts.updatedAt), desc(posts.id));
}

export async function getPostById(id: number): Promise<PostRow | null> {
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return row ?? null;
}

/**
 * A slug that is free. The author's own row is excluded, so re-saving a post
 * without touching its title keeps the slug it already has (and the URL any
 * reader may already have bookmarked).
 */
export async function uniquePostSlug(
  desired: string,
  excludeId?: number,
): Promise<string> {
  const base = slugify(desired) || "nota";
  let candidate = base;
  for (let n = 2; n < 200; n++) {
    const [clash] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, candidate))
      .limit(1);
    if (!clash || clash.id === excludeId) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

export interface PostInput {
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  category: PostRow["category"];
  status: PostRow["status"];
}

export async function createPost(
  input: PostInput,
  authorUserId: number,
): Promise<number> {
  const now = new Date();
  const [res] = await db.insert(posts).values({
    ...input,
    authorUserId,
    updatedAt: now,
    publishedAt: input.status === "published" ? now : null,
  });
  return Number((res as { insertId: number }).insertId);
}

export async function updatePost(id: number, input: PostInput): Promise<void> {
  const current = await getPostById(id);
  if (!current) return;
  await db
    .update(posts)
    .set({
      ...input,
      updatedAt: new Date(),
      // publishedAt is set on FIRST publish and then left alone: an edit is
      // not a new publication, and rewriting it would reshuffle the index.
      publishedAt:
        input.status === "published"
          ? (current.publishedAt ?? new Date())
          : current.publishedAt,
    })
    .where(eq(posts.id, id));
}

export async function setPostCover(
  id: number,
  coverR2Key: string | null,
): Promise<void> {
  await db
    .update(posts)
    .set({ coverR2Key, updatedAt: new Date() })
    .where(eq(posts.id, id));
}

export async function deletePost(id: number): Promise<void> {
  await db.delete(posts).where(eq(posts.id, id));
}

/** Draft/published counts for the admin tab badge. */
export async function countDraftPosts(): Promise<number> {
  try {
    const [row] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(posts)
      .where(eq(posts.status, "draft"));
    return Number(row?.n ?? 0);
  } catch (err) {
    if (isMissingTable(err)) return 0;
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Data cache (PLAN.md F17)                                            */
/*                                                                     */
/* /guias changes when the founder writes a post, i.e. rarely, and is  */
/* read by crawlers far more often than it is written. Both reads are  */
/* cached under the `guides` tag and every post write in               */
/* app/admin/guias/actions.ts calls revalidateGuides(), so a published */
/* edit is live at once rather than at the TTL's convenience.          */
/*                                                                     */
/* Dates do not survive the cache boundary — an entry is serialized,   */
/* so `publishedAt`/`updatedAt` come back as ISO strings while the row */
/* types still say `Date | null`. Both are re-wrapped here, at the     */
/* boundary, rather than by every consumer.                            */
/* ------------------------------------------------------------------ */

const GUIDES_CACHE = {
  revalidate: CACHE_TTL.guides,
  tags: [CACHE_TAGS.guides],
};

function asDate(v: Date | string | null): Date | null {
  return v == null ? null : new Date(v);
}

function reviveCard(c: PostCard): PostCard {
  return { ...c, publishedAt: asDate(c.publishedAt) };
}

function reviveRow(r: PostRow): PostRow {
  return {
    ...r,
    publishedAt: asDate(r.publishedAt),
    updatedAt: asDate(r.updatedAt),
  };
}

const cachedPublishedPosts = unstable_cache(
  listPublishedPostsUncached,
  ["guides:list"],
  GUIDES_CACHE,
);

/** Published posts, newest first — the /guias index. */
export async function listPublishedPosts(limit = 60): Promise<PostCard[]> {
  return (await cachedPublishedPosts(limit)).map(reviveCard);
}

const cachedPublishedPost = unstable_cache(
  getPublishedPostUncached,
  ["guides:detail"],
  GUIDES_CACHE,
);

/** One published post by slug, plus a few siblings. Null when not published. */
export async function getPublishedPost(
  slug: string,
): Promise<PostDetail | null> {
  const detail = await cachedPublishedPost(slug);
  if (!detail) return null;
  return {
    ...detail,
    post: reviveRow(detail.post),
    related: detail.related.map(reviveCard),
  };
}
