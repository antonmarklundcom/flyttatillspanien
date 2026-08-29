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

const TITLE = "Guider och artiklar";
const DESCRIPTION = (brand: string) => `Praktiska guider för att köpa, sälja och hyra i Spanien, och analyser av bostadsmarknaden — skrivna av teamet på ${brand}.`;

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE} om den spanska bostadsmarknaden`,
    description: DESCRIPTION(brand),
    alternates: { canonical: `${await siteOrigin()}/guias` },
    openGraph: { title: `${TITLE} — ${brand}`, description: DESCRIPTION(brand) },
  };
}

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("sv-SE", {
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
          <span>{post.readingMinutes} min lästid</span>
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
            { name: "Start", url: "/" },
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
        kicker="Guider"
        title="Köpa, sälja och hyra i Spanien, förklarat"
        subtitle="Det som är bra att veta innan du skriver under: dokument, skatter, referenspriser och misstagen som blir dyra."
      />

      <Section>
        {posts.length === 0 ? (
          <div className="mk-empty">
            <p>
              Vi har inte publicerat någon guide än. Under tiden svarar de
              här sidorna på det vanligaste:
            </p>
            <div className="mk-cta__actions" style={{ marginTop: 16 }}>
              <Link className="mk-btn mk-btn--outline" href="/como-funciona">
                Så fungerar det
              </Link>
              <Link className="mk-btn mk-btn--outline" href="/preguntas-frecuentes">
                Vanliga frågor
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
        title="Vet du redan vad din bostad är värd?"
        text="Gratis värdering online, med de publicerade priserna i ditt område."
        primary={{ label: "Värdera gratis", href: "/tasacion" }}
        secondary={{ label: "Se marknadsdata", href: "/datos" }}
      />
    </main>
  );
}
