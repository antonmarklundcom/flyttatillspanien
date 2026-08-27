import type { Metadata } from "next";
import Link from "next/link";
import { PanelBar } from "@/components/panel/PanelBar";
import { PostForm } from "@/components/panel/PostForm";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { countReviewQueue } from "@/lib/panel-queries";
import { countDraftPosts, isPostsTableReady } from "@/lib/post-queries";
import { adminTabs } from "../../tabs";
import { createPostAction } from "../actions";

export const metadata: Metadata = {
  title: `Nueva nota`,
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
        title="Panel de administración"
        role={user.role}
        userName={user.name}
        tabs={adminTabs("posts", reviewCount, drafts)}
      />
      <main className="panel site-main">
        <Link className="panel-post__back" href="/admin/guias">
          ← Volver a guías y notas
        </Link>
        <h2 className="panel-section__title">Nueva nota</h2>

        {/* Without this the editor would render fine and only fail on submit,
            which is a 500 the author has to read logs to understand. */}
        {!ready && (
          <p className="panel-flash panel-flash--error">
            La tabla de notas todavía no existe en esta base de datos. Ejecutá{" "}
            <code>npm run db:migrate</code> con el DATABASE_URL de producción
            antes de escribir la primera nota.
          </p>
        )}

        {params.msg === "invalid" && (
          <p className="panel-flash panel-flash--error">
            La nota necesita al menos un título y contenido.
          </p>
        )}

        <p className="panel-post__intro">
          Guardá como borrador cuantas veces quieras — nadie la ve hasta que
          toques «Publicar». La imagen de portada se agrega después de guardar.
        </p>

        {ready && <PostForm action={createPostAction} />}
      </main>
    </>
  );
}
