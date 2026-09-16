import type { Metadata } from "next";
import Link from "next/link";
import { PanelBar } from "@/components/panel/PanelBar";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countReviewQueue } from "@/lib/panel-queries";
import {
  countDraftPosts,
  isPostsTableReady,
  listAllPosts,
  POST_CATEGORY_LABEL,
} from "@/lib/post-queries";
import { readingMinutes } from "@/lib/markdown";
import { svPanel } from "@/i18n/sv";
import { adminTabs } from "../tabs";

export const metadata: Metadata = {
  title: `Guider och anteckningar`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, string> = {
  deleted: svPanel.postsDeleted,
  not_found: svPanel.postsNotFound,
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("sv-SE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminPostsPage({
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
  const posts = ready ? await listAllPosts() : [];

  const flash = params.msg ? FLASH[params.msg] : undefined;

  return (
    <>
      <PanelBar
        title={svPanel.adminPanelTitle}
        role={user.role}
        userName={user.name}
        tabs={adminTabs("posts", reviewCount, drafts)}
      />
      <main className="panel site-main">
        <h2 className="panel-section__title">{svPanel.postsListTitle}</h2>

        {flash && <p className="panel-flash">{flash}</p>}

        {!ready && (
          <p className="panel-flash panel-flash--error">
            {svPanel.postsTableMissing}
          </p>
        )}

        <p className="panel-post__intro">{svPanel.postsIntro}</p>

        <div className="panel-form__field panel-form__field--action">
          <Link
            className="panel-btn panel-btn--primary"
            href="/admin/guias/nueva"
          >
            {svPanel.postsWrite}
          </Link>
          <Link className="panel-btn" href="/guias" target="_blank">
            {svPanel.postsViewPublic}
          </Link>
        </div>

        {posts.length === 0 ? (
          <p className="panel-empty">{svPanel.postsEmpty}</p>
        ) : (
          posts.map((p) => (
            <article className="panel-card" key={p.id}>
              <div className="panel-card__head">
                <div>
                  <h3 className="panel-card__title">
                    <Link className="panel-post__link" href={`/admin/guias/${p.id}`}>
                      {p.title}
                    </Link>
                  </h3>
                  <div className="panel-card__meta">
                    <span
                      className={`panel-post__badge${
                        p.status === "published"
                          ? " panel-post__badge--live"
                          : ""
                      }`}
                    >
                      {p.status === "published"
                        ? svPanel.postsStatusPublished
                        : svPanel.postsStatusDraft}
                    </span>
                    <span>{POST_CATEGORY_LABEL[p.category]}</span>
                    <span>/guias/{p.slug}</span>
                    <span>{svPanel.postsReadingMinutes(readingMinutes(p.body))}</span>
                    <span>
                      {p.status === "published"
                        ? svPanel.postsPublishedOn(formatDate(p.publishedAt))
                        : svPanel.postsEditedOn(formatDate(p.updatedAt))}
                    </span>
                  </div>
                </div>
                <div className="panel-card__actions">
                  <Link className="panel-btn" href={`/admin/guias/${p.id}`}>
                    {svPanel.postsEdit}
                  </Link>
                  {p.status === "published" && (
                    <Link
                      className="panel-btn"
                      href={`/guias/${p.slug}`}
                      target="_blank"
                    >
                      {svPanel.postsView}
                    </Link>
                  )}
                </div>
              </div>
              {p.excerpt && <div className="panel-card__body">{p.excerpt}</div>}
            </article>
          ))
        )}
      </main>
    </>
  );
}
