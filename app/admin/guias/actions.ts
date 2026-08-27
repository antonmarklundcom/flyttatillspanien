"use server";

/**
 * Editorial actions. requireSuperAdmin() runs before every read and write —
 * these are the only writes in the app with no ownership scope to fall back
 * on (a post belongs to the site, not to an agency), so the role check is the
 * whole guard and it is re-derived from the session on every call.
 */
import { revalidatePath } from "next/cache";
import { revalidateGuides } from "@/lib/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/guards";
import {
  createPost,
  deletePost,
  getPostById,
  setPostCover,
  updatePost,
  uniquePostSlug,
  type PostInput,
  type PostRow,
} from "@/lib/post-queries";
import { deleteObjects, isR2Configured, putObject } from "@/lib/r2";
import { processListingImage, STORED_CONTENT_TYPE, thumbKey } from "@/lib/images";
import { slugify } from "@/lib/slug";

const CATEGORIES: PostRow["category"][] = ["guia", "mercado", "noticia"];

/** Read + validate the editor form. Returns null when the post is unusable. */
function readForm(formData: FormData): Omit<PostInput, "slug"> | null {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return null;

  const rawCategory = String(formData.get("category") ?? "guia");
  const category = CATEGORIES.includes(rawCategory as PostRow["category"])
    ? (rawCategory as PostRow["category"])
    : "guia";

  return {
    title: title.slice(0, 200),
    excerpt: String(formData.get("excerpt") ?? "").trim().slice(0, 400) || null,
    body,
    category,
    // Publishing is an explicit choice: the editor has two submit buttons and
    // anything other than "published" saves a draft.
    status:
      String(formData.get("status") ?? "draft") === "published"
        ? "published"
        : "draft",
  };
}

export async function createPostAction(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();

  const fields = readForm(formData);
  if (!fields) redirect("/admin/guias/nueva?msg=invalid");

  // An author-supplied slug wins; otherwise derive it from the title. Either
  // way it goes through the uniqueness check.
  const desired = String(formData.get("slug") ?? "").trim() || fields.title;
  const slug = await uniquePostSlug(slugify(desired));

  const id = await createPost({ ...fields, slug }, user.id);

  revalidatePath("/admin/guias");
  revalidatePath("/guias");
  revalidateGuides();
  redirect(`/admin/guias/${id}?msg=created`);
}

export async function updatePostAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const id = Number(formData.get("postId"));
  if (!Number.isInteger(id) || id <= 0) redirect("/admin/guias?msg=not_found");

  const fields = readForm(formData);
  if (!fields) redirect(`/admin/guias/${id}?msg=invalid`);

  const current = await getPostById(id);
  if (!current) redirect("/admin/guias?msg=not_found");

  const desired = String(formData.get("slug") ?? "").trim() || fields.title;
  const slug = await uniquePostSlug(slugify(desired), id);

  await updatePost(id, { ...fields, slug });

  revalidatePath("/admin/guias");
  revalidatePath("/guias");
  revalidateGuides();
  revalidatePath(`/guias/${current.slug}`);
  if (slug !== current.slug) revalidatePath(`/guias/${slug}`);
  redirect(`/admin/guias/${id}?msg=saved`);
}

export async function deletePostAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const id = Number(formData.get("postId"));
  if (Number.isInteger(id) && id > 0) {
    const post = await getPostById(id);
    if (post?.coverR2Key) {
      // Best-effort, same posture as listing photos: orphaned bytes are cheap,
      // a row that will not delete is not.
      await deleteObjects([post.coverR2Key, thumbKey(post.coverR2Key)]).catch(
        () => {},
      );
    }
    await deletePost(id);
    if (post) revalidatePath(`/guias/${post.slug}`);
  }

  revalidatePath("/admin/guias");
  revalidatePath("/guias");
  revalidateGuides();
  redirect("/admin/guias?msg=deleted");
}

/**
 * Cover image. Re-encoded through the same sharp pipeline as listing photos,
 * so an unreadable or mislabelled file never reaches the bucket and EXIF is
 * dropped on the way.
 */
export async function uploadPostCoverAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const id = Number(formData.get("postId"));
  if (!Number.isInteger(id) || id <= 0) redirect("/admin/guias?msg=not_found");

  const post = await getPostById(id);
  if (!post) redirect("/admin/guias?msg=not_found");

  if (!isR2Configured()) redirect(`/admin/guias/${id}?msg=no_storage`);

  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/admin/guias/${id}?msg=no_file`);
  }

  try {
    const processed = await processListingImage(
      Buffer.from(await file.arrayBuffer()),
    );
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const key = `posts/${post.slug}/${rand}.webp`;

    await putObject(key, processed.full, STORED_CONTENT_TYPE);
    await putObject(thumbKey(key), processed.thumb, STORED_CONTENT_TYPE);

    const previous = post.coverR2Key;
    await setPostCover(id, key);
    if (previous) {
      await deleteObjects([previous, thumbKey(previous)]).catch(() => {});
    }
  } catch {
    redirect(`/admin/guias/${id}?msg=bad_image`);
  }

  revalidatePath("/admin/guias");
  revalidatePath("/guias");
  revalidateGuides();
  revalidatePath(`/guias/${post.slug}`);
  redirect(`/admin/guias/${id}?msg=cover_saved`);
}

export async function removePostCoverAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const id = Number(formData.get("postId"));
  if (!Number.isInteger(id) || id <= 0) redirect("/admin/guias?msg=not_found");

  const post = await getPostById(id);
  if (post?.coverR2Key) {
    await deleteObjects([post.coverR2Key, thumbKey(post.coverR2Key)]).catch(
      () => {},
    );
    await setPostCover(id, null);
    revalidatePath(`/guias/${post.slug}`);
  }

  revalidatePath("/admin/guias");
  revalidatePath("/guias");
  revalidateGuides();
  redirect(`/admin/guias/${id}?msg=cover_removed`);
}
