import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared building blocks for the hand-authored pages (/nosotros, /planes,
 * /para-inmobiliarias, /como-funciona, /financiamiento, legal…). Nine pages
 * that each rolled their own hero and card grid would be nine chances for the
 * site to look like nine sites — these keep the shell consistent and the page
 * files about their content.
 */

export function PageHero({
  kicker,
  title,
  subtitle,
  actions,
  tone = "light",
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** "dark" = deep primary band, for the sales pages. */
  tone?: "light" | "dark";
}) {
  return (
    <section className={`mk-hero mk-hero--${tone}`}>
      <div className="mk-hero__inner">
        {kicker && <div className="mk-hero__kicker">{kicker}</div>}
        <h1 className="mk-hero__title">{title}</h1>
        {subtitle && <p className="mk-hero__subtitle">{subtitle}</p>}
        {actions && <div className="mk-hero__actions">{actions}</div>}
      </div>
    </section>
  );
}

export function Section({
  title,
  subtitle,
  children,
  id,
  tone = "default",
  width = "wide",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  id?: string;
  tone?: "default" | "muted";
  width?: "wide" | "narrow";
}) {
  return (
    <section
      id={id}
      className={`mk-section${tone === "muted" ? " mk-section--muted" : ""}`}
    >
      <div className={`mk-section__inner mk-section__inner--${width}`}>
        {title && <h2 className="mk-section__title">{title}</h2>}
        {subtitle && <p className="mk-section__subtitle">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}

export function FeatureGrid({
  items,
  columns = 3,
}: {
  items: { icon?: string; title: string; text: string }[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <div className={`mk-features mk-features--${columns}`}>
      {items.map((f) => (
        <div key={f.title} className="mk-feature">
          {f.icon && (
            <span className="mk-feature__icon" aria-hidden>
              {f.icon}
            </span>
          )}
          <h3 className="mk-feature__title">{f.title}</h3>
          <p className="mk-feature__text">{f.text}</p>
        </div>
      ))}
    </div>
  );
}

export function StepList({
  steps,
}: {
  steps: { title: string; text: string }[];
}) {
  return (
    <ol className="mk-steps">
      {steps.map((s, i) => (
        <li key={s.title} className="mk-step">
          <span className="mk-step__num" aria-hidden>
            {i + 1}
          </span>
          <div>
            <h3 className="mk-step__title">{s.title}</h3>
            <p className="mk-step__text">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function StatRow({
  stats,
}: {
  stats: { value: string; label: string }[];
}) {
  return (
    <div className="mk-stats">
      {stats.map((s) => (
        <div key={s.label} className="mk-stat">
          <div className="mk-stat__value">{s.value}</div>
          <div className="mk-stat__label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export function CtaBand({
  title,
  text,
  primary,
  secondary,
}: {
  title: string;
  text?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="mk-cta">
      <div className="mk-cta__inner">
        <h2 className="mk-cta__title">{title}</h2>
        {text && <p className="mk-cta__text">{text}</p>}
        <div className="mk-cta__actions">
          <Link className="mk-btn mk-btn--accent" href={primary.href}>
            {primary.label}
          </Link>
          {secondary && (
            <Link className="mk-btn mk-btn--ghost" href={secondary.href}>
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/** Long-form text block (legal pages, about copy) with readable measure. */
export function Prose({ children }: { children: ReactNode }) {
  return <div className="mk-prose">{children}</div>;
}
