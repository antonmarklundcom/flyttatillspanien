import type { Metadata } from "next";
import Link from "next/link";
import { PanelBar } from "@/components/panel/PanelBar";
import { PostForm } from "@/components/panel/PostForm";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countReviewQueue } from "@/lib/panel-queries";
import { countDraftPosts, isPostsTableReady } from "@/lib/post-queries";
import { svPanel } from "@/i18n/sv";
import { adminTabs } from "../../tabs";
import { createPostAction } from "../actions";

export const metadata: Metadata = {
  title: `Ny anteckning`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const [params, user] = await Promise.all([searchParams, requireSuperAdmin()]);
  const [reviewCount, drafts, ready] = await Promise.all([
    countReviewQueue(),
    countDraftPosts(),
    isPostsTableReady(),
  ]);

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
        <h2 className="panel-section__title">{svPanel.newPostTitle}</h2>

        {/* Without this the editor would render fine and only fail on submit,
            which is a 500 the author has to read logs to understand. */}
        {!ready && (
          <p className="panel-flash panel-flash--error">
            {svPanel.postsTableMissing}
          </p>
        )}

        {params.msg === "invalid" && (
          <p className="panel-flash panel-flash--error">
            {svPanel.newPostInvalid}
          </p>
        )}

        <p className="panel-post__intro">{svPanel.newPostIntro}</p>

        {ready && <PostForm action={createPostAction} />}
      </main>
    </>
  );
}
