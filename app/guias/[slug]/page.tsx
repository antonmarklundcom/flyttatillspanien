import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Markdown } from "@/components/Markdown";
import { imageUrl, imageThumbUrl } from "@/lib/format";
import { markdownToPlainText } from "@/lib/markdown";
import { getPublishedPost, POST_CATEGORY_LABEL } from "@/lib/post-queries";
import { CtaBand, Section } from "@/components/MarketingUI";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

const resolve = cache(getPublishedPost);

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const detail = await resolve(slug);
  if (!detail) return { title: `Artikeln hittades inte` };

  const { post } = detail;
  const description =
    post.excerpt?.trim() || markdownToPlainText(post.body, 160);
  const cover = imageUrl(post.coverR2Key);

  return {
    title: `${post.title}`,
    description,
    alternates: { canonical: `${await siteOrigin()}/guias/${post.slug}` },
    openGraph: {
      type: "article",
      // og:title doesn't inherit title.template — brand goes in by hand (F47).
      title: `${post.title} — ${await brandName()}`,
      description,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

export default async function GuiaPage({ params }: Params) {
  const brand = await brandName();
  const { slug } = await params;
  const detail = await resolve(slug);
  if (!detail) notFound();

  const { post, authorName, readingMinutes, related } = detail;
  const origin = await siteOrigin();
  const cover = imageUrl(post.coverR2Key);
  const published = formatDate(post.publishedAt);
  const updated = formatDate(post.updatedAt);
  // Only surface "actualizada" when it is genuinely later than publication —
  // otherwise every post carries two identical dates.
  const showUpdated =
    updated &&
    published &&
    post.updatedAt &&
    post.publishedAt &&
    new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() >
      36 * 60 * 60 * 1000;

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Start", url: "/" },
            { name: "Guider", url: "/guias" },
            { name: post.title, url: `/guias/${post.slug}` },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description:
              post.excerpt?.trim() || markdownToPlainText(post.body, 160),
            datePublished: post.publishedAt?.toISOString(),
            dateModified: (post.updatedAt ?? post.publishedAt)?.toISOString(),
            author: {
              "@type": authorName ? "Person" : "Organization",
              name: authorName ?? brand,
            },
            publisher: { "@type": "Organization", name: brand },
            mainEntityOfPage: `${origin}/guias/${post.slug}`,
            ...(cover ? { image: cover } : {}),
          },
        ]}
      />

      <article>
        <header className="post-hero">
          <div className="post-hero__inner">
            <Link className="post-hero__back" href="/guias">
              ← Guider och artiklar
            </Link>
            <div className="post-hero__category">
              {POST_CATEGORY_LABEL[post.category]}
            </div>
            <h1 className="post-hero__title">{post.title}</h1>
            {post.excerpt && (
              <p className="post-hero__excerpt">{post.excerpt}</p>
            )}
            <div className="post-hero__meta">
              {authorName && <span>Av {authorName}</span>}
              {published && <span>{published}</span>}
              <span>{readingMinutes} min lästid</span>
              {showUpdated && <span>Uppdaterad {updated}</span>}
            </div>
          </div>
        </header>

        {cover && (
          <div className="post-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="post-cover__img" src={cover} alt={post.title} />
          </div>
        )}

        <Section width="narrow">
          <Markdown source={post.body} />
        </Section>
      </article>

      {related.length > 0 && (
        <Section tone="muted" title="Fortsätt läsa">
          <div className="post-grid">
            {related.map((r) => (
              <Link
                key={r.id}
                className="post-card"
                href={`/guias/${r.slug}`}
              >
                <div
                  className={`post-card__media${
                    imageThumbUrl(r.coverR2Key) ? "" : " post-card__media--empty"
                  }`}
                >
                  {imageThumbUrl(r.coverR2Key) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="media-cover-img"
                      src={imageThumbUrl(r.coverR2Key)!}
                      alt={r.title}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="post-card__placeholder" aria-hidden>
                      📄
                    </span>
                  )}
                </div>
                <div className="post-card__body">
                  <h3 className="post-card__title">{r.title}</h3>
                  <p className="post-card__excerpt">{r.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <CtaBand
        title="Från att läsa till att söka"
        text="Villor, lägenheter och tomter i hela Spanien, med kostnaden för köpet uträknad."
        primary={{ label: "Se bostäder", href: "/kopa" }}
        secondary={{ label: "Värdera min bostad", href: "/tasacion" }}
      />
    </main>
  );
}
