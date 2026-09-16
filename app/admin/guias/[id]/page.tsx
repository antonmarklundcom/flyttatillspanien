import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelBar } from "@/components/panel/PanelBar";
import { PostForm } from "@/components/panel/PostForm";
import { Markdown } from "@/components/Markdown";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countReviewQueue } from "@/lib/panel-queries";
import { countDraftPosts, getPostById } from "@/lib/post-queries";
import { imageUrl } from "@/lib/format";
import { isR2Configured } from "@/lib/r2";
import { svPanel } from "@/i18n/sv";
import { adminTabs } from "../../tabs";
import {
  deletePostAction,
  removePostCoverAction,
  updatePostAction,
  uploadPostCoverAction,
} from "../actions";

export const metadata: Metadata = {
  title: `Redigera anteckning`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const [{ id }, sp, user] = await Promise.all([
    params,
    searchParams,
    requireSuperAdmin(),
  ]);

  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) notFound();

  const [reviewCount, drafts, post] = await Promise.all([
    countReviewQueue(),
    countDraftPosts(),
    getPostById(postId),
  ]);
  if (!post) notFound();

  const flash = sp.msg ? svPanel.postFlash[sp.msg] : undefined;
  const coverUrl = imageUrl(post.coverR2Key);

  return (
    <>
      <PanelBar
        title={svPanel.adminPanelTitle}
        role={user.role}
        userName={user.name}
        tabs={adminTabs("posts", reviewCount, drafts)}
      />
      <main className="panel site-main">
        <Link className="panel-post__back" href="/admin/guias">
          {svPanel.postsBackToList}
        </Link>

        <div className="panel-post__title-row">
          <h2 className="panel-section__title">{post.title}</h2>
          <span
            className={`panel-post__badge${
              post.status === "published" ? " panel-post__badge--live" : ""
            }`}
          >
            {post.status === "published"
              ? svPanel.postsStatusPublished
              : svPanel.postsStatusDraft}
          </span>
          {post.status === "published" && (
            <Link
              className="panel-btn"
              href={`/guias/${post.slug}`}
              target="_blank"
            >
              {svPanel.postsViewOnSite}
            </Link>
          )}
        </div>

        {flash && (
          <p
            className={`panel-flash${flash.error ? " panel-flash--error" : ""}`}
          >
            {flash.text}
          </p>
        )}

        <PostForm post={post} action={updatePostAction} />

        {/* Cover: its own form because a file upload needs a saved post to
            attach to, and it must not be lost if the editor form fails. */}
        <section className="panel-post__cover">
          <h3 className="panel-section__title">{svPanel.postCoverTitle}</h3>
          {!isR2Configured() ? (
            <p className="panel-empty">{svPanel.postCoverNotConfigured}</p>
          ) : (
            <>
              {coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="panel-post__cover-img"
                  src={coverUrl}
                  alt={svPanel.postCoverAlt}
                />
              )}
              <form action={uploadPostCoverAction} className="panel-form">
                <input type="hidden" name="postId" value={post.id} />
                <label className="panel-form__field" style={{ flexBasis: "100%" }}>
                  <span className="auth-field__label">
                    {coverUrl ? svPanel.postCoverReplace : svPanel.postCoverUpload}
                  </span>
                  <input
                    className="auth-field__input"
                    type="file"
                    name="cover"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                  />
                  <span className="panel-hint">{svPanel.postCoverHint}</span>
                </label>
                <div className="panel-form__field panel-form__field--action">
                  <button className="panel-btn panel-btn--primary" type="submit">
                    {svPanel.postCoverUpload}
                  </button>
                </div>
              </form>
              {coverUrl && (
                <form action={removePostCoverAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button className="panel-btn" type="submit">
                    {svPanel.postCoverRemove}
                  </button>
                </form>
              )}
            </>
          )}
        </section>

        <section className="panel-post__preview">
          <h3 className="panel-section__title">{svPanel.postPreviewTitle}</h3>
          <p className="panel-post__intro">{svPanel.postPreviewHint}</p>
          <div className="panel-post__preview-body">
            <Markdown source={post.body} />
          </div>
        </section>

        <section className="panel-post__danger">
          <form action={deletePostAction}>
            <input type="hidden" name="postId" value={post.id} />
            <button className="panel-btn panel-btn--danger" type="submit">
              {svPanel.postDelete}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
