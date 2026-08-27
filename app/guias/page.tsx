import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { imageThumbUrl } from "@/lib/format";
import {
  listPublishedPosts,
  POST_CATEGORY_LABEL,
  type PostCard,
} from "@/lib/post-queries";
import { CtaBand, PageHero, Section } from "@/components/MarketingUI";

// Editorial content changes when the founder publishes, not on a schedule.
export const dynamic = "force-dynamic";

const TITLE = "Guías y notas";
const DESCRIPTION = (brand: string) => `Guías prácticas para comprar, vender y alquilar en España, y análisis del mercado inmobiliario — escritas por el equipo de ${brand}.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} sobre el mercado inmobiliario español`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/guias` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("es-PY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function PostTile({ post, featured }: { post: PostCard; featured?: boolean }) {
  const cover = imageThumbUrl(post.coverR2Key);
  const date = formatDate(post.publishedAt);
  return (
    <Link
      className={`post-card${featured ? " post-card--featured" : ""}`}
      href={`/guias/${post.slug}`}
    >
      <div
        className={`post-card__media${cover ? "" : " post-card__media--empty"}`}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="media-cover-img"
            src={cover}
            alt={post.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="post-card__placeholder" aria-hidden>
            📄
          </span>
        )}
        <span className="post-card__category">
          {POST_CATEGORY_LABEL[post.category]}
        </span>
      </div>
      <div className="post-card__body">
        <h2 className="post-card__title">{post.title}</h2>
        <p className="post-card__excerpt">{post.excerpt}</p>
        <div className="post-card__meta">
          {date && <span>{date}</span>}
          <span>{post.readingMinutes} min de lectura</span>
        </div>
      </div>
    </Link>
  );
}

export default async function GuiasPage() {
  const [origin, posts] = await Promise.all([
    siteOrigin(),
    listPublishedPosts(),
  ]);

  const [featured, ...rest] = posts;

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/guias" },
          ]),
          ...(posts.length > 0
            ? [
                itemListJsonLd(
                  origin,
                  posts.map((p) => ({
                    title: p.title,
                    url: `/guias/${p.slug}`,
                  })),
                ),
              ]
            : []),
        ]}
      />

      <PageHero
        kicker="Guías"
        title="Comprar, vender y alquilar en España, explicado"
        subtitle="Lo que conviene saber antes de firmar: documentos, financiamiento, precios de referencia y los errores que salen caros."
      />

      <Section>
        {posts.length === 0 ? (
          <div className="mk-empty">
            <p>
              Todavía no publicamos ninguna guía. Mientras tanto, estas páginas
              responden lo más consultado:
            </p>
            <div className="mk-cta__actions" style={{ marginTop: 16 }}>
              <Link className="mk-btn mk-btn--outline" href="/como-funciona">
                Cómo funciona
              </Link>
              <Link className="mk-btn mk-btn--outline" href="/financiamiento">
                Financiamiento y cuotas
              </Link>
              <Link className="mk-btn mk-btn--outline" href="/preguntas-frecuentes">
                Preguntas frecuentes
              </Link>
            </div>
          </div>
        ) : (
          <>
            <PostTile post={featured} featured />
            {rest.length > 0 && (
              <div className="post-grid">
                {rest.map((p) => (
                  <PostTile key={p.id} post={p} />
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      <CtaBand
        title="¿Ya sabés cuánto vale tu propiedad?"
        text="Tasación online gratuita, con los precios publicados de tu zona."
        primary={{ label: "Tasar gratis", href: "/tasacion" }}
        secondary={{ label: "Ver datos del mercado", href: "/datos" }}
      />
    </main>
  );
}
