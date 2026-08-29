import Link from "next/link";
import { formatEur } from "@/lib/format";
import type { ProjectCard as Card } from "@/lib/queries";

const STAGE_LABEL: Record<string, string> = {
  en_pozo: "En pozo",
  en_construccion: "En construcción",
  entrega_inmediata: "Entrega inmediata",
};

/** "Ent. Jul 2029" — compact delivery chip like the stage badge's sibling. */
function deliveryLabel(d: string | Date | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.toLocaleDateString("es-PY", { month: "short" });
  return `Ent. ${month.charAt(0).toUpperCase() + month.slice(1)} ${date.getFullYear()}`;
}

/** Homepage carousel / project-row card. Whole card links to /proyecto/{slug}. */
export function ProjectCard({ card }: { card: Card }) {
  const delivery = deliveryLabel(card.deliveryDate);
  return (
    <Link className="project-card" href={`/proyecto/${card.slug}`}>
      <div
        className={`project-card__media${card.heroImageUrl ? "" : " project-card__media--empty"}`}
      >
        {card.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="media-cover-img" src={card.heroImageUrl} alt={card.name} loading="lazy" decoding="async" />
        )}
        {card.stage && (
          <span className="project-card__badge">{STAGE_LABEL[card.stage] ?? card.stage}</span>
        )}
        {delivery && <span className="project-card__delivery">{delivery}</span>}
        {!card.heroImageUrl && (
          <span className="project-card__placeholder" aria-hidden>
            🏗️
          </span>
        )}
      </div>
      <div className="project-card__body">
        <div className="project-card__kicker">
          Proyecto{card.developerName ? ` · ${card.developerName}` : ""}
        </div>
        <div className="project-card__name">{card.name}</div>
        {card.minPriceEur != null && (
          <div className="project-card__price">Desde {formatEur(card.minPriceEur)}</div>
        )}
        <div className="project-card__meta">
          {card.availableUnits > 0 && (
            <span>{card.availableUnits} disponibles</span>
          )}
          {card.cityName && <span>{card.cityName}</span>}
        </div>
      </div>
    </Link>
  );
}
