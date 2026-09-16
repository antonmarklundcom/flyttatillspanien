import type { PostRow } from "@/lib/post-queries";
import { svPanel } from "@/i18n/sv";

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
  { value: "guia", label: svPanel.postCategoryOptions.guia },
  { value: "mercado", label: svPanel.postCategoryOptions.mercado },
  { value: "noticia", label: svPanel.postCategoryOptions.noticia },
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
        <span className="auth-field__label">{svPanel.postTitleLabel}</span>
        <input
          className="auth-field__input"
          name="title"
          type="text"
          defaultValue={post?.title ?? ""}
          maxLength={200}
          required
          placeholder={svPanel.postTitlePlaceholder}
        />
      </label>

      <label className="panel-form__field" style={{ flexBasis: "100%" }}>
        <span className="auth-field__label">{svPanel.postUrlLabel}</span>
        <input
          className="auth-field__input"
          name="slug"
          type="text"
          defaultValue={post?.slug ?? ""}
          maxLength={200}
          placeholder={svPanel.postUrlPlaceholder}
        />
        <span className="panel-hint">
          {svPanel.postUrlHint(post?.slug ?? svPanel.postUrlPlaceholder)}
        </span>
      </label>

      <label className="panel-form__field">
        <span className="auth-field__label">{svPanel.postCategoryLabel}</span>
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
        <span className="auth-field__label">{svPanel.postExcerptLabel}</span>
        <textarea
          className="panel-reject__textarea"
          name="excerpt"
          defaultValue={post?.excerpt ?? ""}
          rows={2}
          maxLength={400}
          placeholder={svPanel.postExcerptPlaceholder}
        />
      </label>

      <label className="panel-form__field" style={{ flexBasis: "100%" }}>
        <span className="auth-field__label">{svPanel.postBodyLabel}</span>
        <textarea
          className="panel-reject__textarea post-editor"
          name="body"
          defaultValue={post?.body ?? ""}
          rows={22}
          required
          placeholder={svPanel.postBodyPlaceholder}
        />
      </label>

      <details className="panel-form__field post-cheatsheet" style={{ flexBasis: "100%" }}>
        <summary>{svPanel.postCheatsheetSummary}</summary>
        <ul>
          <li>
            <code>## Underrubrik</code> — {svPanel.postCheatsheetHeading}
          </li>
          <li>
            <code>### Mindre underrubrik</code> — {svPanel.postCheatsheetHeadingSmall}
          </li>
          <li>
            <code>- punkt</code> — {svPanel.postCheatsheetBulletList}
          </li>
          <li>
            <code>1. punkt</code> — {svPanel.postCheatsheetNumberedList}
          </li>
          <li>
            <code>**{svPanel.postCheatsheetBold}**</code> och{" "}
            <code>*{svPanel.postCheatsheetItalic}*</code>
          </li>
          <li>
            <code>[länktext](/tasacion)</code> — {svPanel.postCheatsheetLink}
          </li>
          <li>
            <code>&gt; text</code> — {svPanel.postCheatsheetQuote}
          </li>
          <li>
            <code>---</code> — {svPanel.postCheatsheetRule}
          </li>
        </ul>
        <p>{svPanel.postCheatsheetHint}</p>
      </details>

      <div className="panel-form__field panel-form__field--action" style={{ flexBasis: "100%" }}>
        {/* On a live post this button un-publishes it. Saying "Spara
            utkast" there would hide that behind a neutral-sounding label. */}
        <button
          className="panel-btn"
          type="submit"
          name="status"
          value="draft"
        >
          {post?.status === "published"
            ? svPanel.postUnpublishSaveDraft
            : svPanel.postSaveDraft}
        </button>
        <button
          className="panel-btn panel-btn--primary"
          type="submit"
          name="status"
          value="published"
        >
          {post?.status === "published" ? svPanel.postSaveAndPublish : svPanel.postPublish}
        </button>
      </div>
    </form>
  );
}
