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
import { adminTabs } from "../tabs";

export const metadata: Metadata = {
  title: `Guías y notas`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, string> = {
  deleted: "Nota eliminada.",
  not_found: "No encontramos esa nota.",
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", {
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
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("posts", reviewCount, drafts)}
      />
      <main className="panel site-main">
        <h2 className="panel-section__title">Guías y notas</h2>

        {flash && <p className="panel-flash">{flash}</p>}

        {!ready && (
          <p className="panel-flash panel-flash--error">
            La tabla de notas todavía no existe en esta base de datos. Ejecutá{" "}
            <code>npm run db:migrate</code> con el DATABASE_URL de producción y
            recargá esta página.
          </p>
        )}

        <p className="panel-post__intro">
          Lo que publiques acá aparece en <strong>/guias</strong> y en el menú
          del sitio. Las notas en borrador no son visibles para nadie más que
          vos.
        </p>

        <div className="panel-form__field panel-form__field--action">
          <Link
            className="panel-btn panel-btn--primary"
            href="/admin/guias/nueva"
          >
            Escribir nota
          </Link>
          <Link className="panel-btn" href="/guias" target="_blank">
            Ver la sección pública ↗
          </Link>
        </div>

        {posts.length === 0 ? (
          <p className="panel-empty">
            Todavía no escribiste ninguna nota. La primera guía es la que
            empieza a traer visitas desde Google.
          </p>
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
                      {p.status === "published" ? "Publicada" : "Borrador"}
                    </span>
                    <span>{POST_CATEGORY_LABEL[p.category]}</span>
                    <span>/guias/{p.slug}</span>
                    <span>{readingMinutes(p.body)} min de lectura</span>
                    <span>
                      {p.status === "published"
                        ? `Publicada ${formatDate(p.publishedAt)}`
                        : `Editada ${formatDate(p.updatedAt)}`}
                    </span>
                  </div>
                </div>
                <div className="panel-card__actions">
                  <Link className="panel-btn" href={`/admin/guias/${p.id}`}>
                    Editar
                  </Link>
                  {p.status === "published" && (
                    <Link
                      className="panel-btn"
                      href={`/guias/${p.slug}`}
                      target="_blank"
                    >
                      Ver ↗
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
