import type { PostRow } from "@/lib/post-queries";

/**
 * The post editor, shared by /admin/guias/nueva and /admin/guias/[id].
 *
 * Plain server-rendered form posting to a server action — the same posture as
 * ListingForm. No rich-text editor: the body is a small markdown subset
 * (src/lib/markdown.ts) and the cheat sheet below the textarea is the whole
 * "how do I make this bold" documentation an author needs. A WYSIWYG would
 * mean storing HTML, and storing HTML means trusting a sanitizer forever.
 *
 * The cover upload is a separate form because a file needs a saved post to
 * hang off (and its own R2 key); the editor shows it only once the post
 * exists.
 */
const CATEGORY_OPTIONS: { value: PostRow["category"]; label: string }[] = [
  { value: "guia", label: "Guía — contenido evergreen" },
  { value: "mercado", label: "Mercado — análisis y datos" },
  { value: "noticia", label: "Noticia — actualidad" },
];

export function PostForm({
  post,
  action,
}: {
  /** Undefined when creating. */
  post?: PostRow;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="panel-form">
      {post && <input type="hidden" name="postId" value={post.id} />}

      <label className="panel-form__field" style={{ flexBasis: "100%" }}>
        <span className="auth-field__label">Título</span>
        <input
          className="auth-field__input"
          name="title"
          type="text"
          defaultValue={post?.title ?? ""}
          maxLength={200}
          required
          placeholder="Cómo comprar tu primera casa en Paraguay"
        />
      </label>

      <label className="panel-form__field" style={{ flexBasis: "100%" }}>
        <span className="auth-field__label">
          URL (opcional — se genera del título)
        </span>
        <input
          className="auth-field__input"
          name="slug"
          type="text"
          defaultValue={post?.slug ?? ""}
          maxLength={200}
          placeholder="comprar-primera-casa-paraguay"
        />
        <span className="panel-hint">
          Queda como /guias/<strong>{post?.slug ?? "tu-url"}</strong>. Si la
          cambiás después de publicar, los enlaces viejos dejan de funcionar.
        </span>
      </label>

      <label className="panel-form__field">
        <span className="auth-field__label">Categoría</span>
        <select
          className="panel-select"
          name="category"
          defaultValue={post?.category ?? "guia"}
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="panel-form__field" style={{ flexBasis: "100%" }}>
        <span className="auth-field__label">
          Resumen (se muestra en la lista y en Google)
        </span>
        <textarea
          className="panel-reject__textarea"
          name="excerpt"
          defaultValue={post?.excerpt ?? ""}
          rows={2}
          maxLength={400}
          placeholder="Dos o tres líneas que expliquen de qué trata la nota."
        />
      </label>

      <label className="panel-form__field" style={{ flexBasis: "100%" }}>
        <span className="auth-field__label">Contenido</span>
        <textarea
          className="panel-reject__textarea post-editor"
          name="body"
          defaultValue={post?.body ?? ""}
          rows={22}
          required
          placeholder={"Escribí acá la nota.\n\n## Un subtítulo\n\nUn párrafo normal.\n\n- Un punto de una lista\n- Otro punto"}
        />
      </label>

      <details className="panel-form__field post-cheatsheet" style={{ flexBasis: "100%" }}>
        <summary>Cómo dar formato al texto</summary>
        <ul>
          <li>
            <code>## Subtítulo</code> — subtítulo grande
          </li>
          <li>
            <code>### Subtítulo menor</code> — subtítulo chico
          </li>
          <li>
            <code>- item</code> — lista con viñetas (una por línea)
          </li>
          <li>
            <code>1. item</code> — lista numerada
          </li>
          <li>
            <code>**negrita**</code> y <code>*cursiva*</code>
          </li>
          <li>
            <code>[texto del enlace](/tasacion)</code> — enlace interno o
            externo
          </li>
          <li>
            <code>&gt; texto</code> — destacado
          </li>
          <li>
            <code>---</code> — separador
          </li>
        </ul>
        <p>
          Dejá una línea en blanco entre párrafos. Todo lo demás se muestra tal
          cual lo escribís.
        </p>
      </details>

      <div className="panel-form__field panel-form__field--action" style={{ flexBasis: "100%" }}>
        {/* On a live post this button un-publishes it. Saying "Guardar
            borrador" there would hide that behind a neutral-sounding label. */}
        <button
          className="panel-btn"
          type="submit"
          name="status"
          value="draft"
        >
          {post?.status === "published"
            ? "Despublicar y guardar como borrador"
            : "Guardar borrador"}
        </button>
        <button
          className="panel-btn panel-btn--primary"
          type="submit"
          name="status"
          value="published"
        >
          {post?.status === "published" ? "Guardar y publicar" : "Publicar"}
        </button>
      </div>
    </form>
  );
}
