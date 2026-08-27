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
import { adminTabs } from "../../tabs";
import {
  deletePostAction,
  removePostCoverAction,
  updatePostAction,
  uploadPostCoverAction,
} from "../actions";

export const metadata: Metadata = {
  title: `Editar nota`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FLASH: Record<string, { text: string; error?: boolean }> = {
  created: { text: "Nota creada." },
  saved: { text: "Cambios guardados." },
  invalid: { text: "La nota necesita título y contenido.", error: true },
  cover_saved: { text: "Portada actualizada." },
  cover_removed: { text: "Portada eliminada." },
  no_file: { text: "Elegí una imagen antes de subir.", error: true },
  bad_image: { text: "No pudimos procesar esa imagen.", error: true },
  no_storage: {
    text: "El almacenamiento de imágenes (R2) no está configurado.",
    error: true,
  },
};

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

  const flash = sp.msg ? FLASH[sp.msg] : undefined;
  const coverUrl = imageUrl(post.coverR2Key);

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

        <div className="panel-post__title-row">
          <h2 className="panel-section__title">{post.title}</h2>
          <span
            className={`panel-post__badge${
              post.status === "published" ? " panel-post__badge--live" : ""
            }`}
          >
            {post.status === "published" ? "Publicada" : "Borrador"}
          </span>
          {post.status === "published" && (
            <Link
              className="panel-btn"
              href={`/guias/${post.slug}`}
              target="_blank"
            >
              Ver en el sitio ↗
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
          <h3 className="panel-section__title">Imagen de portada</h3>
          {!isR2Configured() ? (
            <p className="panel-empty">
              El almacenamiento de imágenes no está configurado en este entorno
              (faltan las variables R2_*), así que no se pueden subir portadas.
              La nota funciona igual sin imagen.
            </p>
          ) : (
            <>
              {coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="panel-post__cover-img"
                  src={coverUrl}
                  alt="Portada actual"
                />
              )}
              <form action={uploadPostCoverAction} className="panel-form">
                <input type="hidden" name="postId" value={post.id} />
                <label className="panel-form__field" style={{ flexBasis: "100%" }}>
                  <span className="auth-field__label">
                    {coverUrl ? "Reemplazar portada" : "Subir portada"}
                  </span>
                  <input
                    className="auth-field__input"
                    type="file"
                    name="cover"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                  />
                  <span className="panel-hint">
                    Se reescala y convierte a WebP automáticamente. Ideal
                    horizontal, mínimo 1200px de ancho.
                  </span>
                </label>
                <div className="panel-form__field panel-form__field--action">
                  <button className="panel-btn panel-btn--primary" type="submit">
                    Subir portada
                  </button>
                </div>
              </form>
              {coverUrl && (
                <form action={removePostCoverAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button className="panel-btn" type="submit">
                    Quitar portada
                  </button>
                </form>
              )}
            </>
          )}
        </section>

        <section className="panel-post__preview">
          <h3 className="panel-section__title">Vista previa</h3>
          <p className="panel-post__intro">
            Así se va a ver el contenido en el sitio.
          </p>
          <div className="panel-post__preview-body">
            <Markdown source={post.body} />
          </div>
        </section>

        <section className="panel-post__danger">
          <form action={deletePostAction}>
            <input type="hidden" name="postId" value={post.id} />
            <button className="panel-btn panel-btn--danger" type="submit">
              Eliminar nota
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
