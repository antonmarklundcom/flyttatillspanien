import { esPanel } from "@/i18n/es";
import type { DailyPoint } from "@/lib/stats-queries";

/**
 * Views and leads for one listing, on its edit page. Shared by the admin and
 * agency panels — the numbers are already scope-filtered by the caller's query.
 *
 * The daily breakdown is bars built from divs, not a chart library: 30 numbers
 * do not justify a dependency, and this renders on the server with no
 * hydration at all.
 */
export function ListingStats({
  views,
  leads,
  daily,
}: {
  views: number;
  leads: number;
  daily: DailyPoint[];
}) {
  // Oldest → newest reads left-to-right like a timeline; the query returns
  // newest first because that is the useful order for everything else.
  const points = [...daily].reverse();
  const peak = points.reduce((max, p) => Math.max(max, p.views), 0);

  return (
    <section className="panel-card" style={{ marginTop: "1.5rem" }}>
      <h2 style={{ fontSize: 18, margin: "0 0 .25rem" }}>
        {esPanel.statsViews} · {esPanel.statsLeads}
      </h2>
      <p style={{ color: "#55655F", fontSize: 13, margin: "0 0 1rem" }}>
        {esPanel.statsWindow} — {esPanel.statsViewsHint}
      </p>

      <div className="panel-stats">
        <div className="panel-stats__figure">
          <span className="panel-stats__value">{views}</span>
          <span className="panel-stats__label">{esPanel.statsViews}</span>
        </div>
        <div className="panel-stats__figure">
          <span className="panel-stats__value">{leads}</span>
          <span className="panel-stats__label">{esPanel.statsLeads}</span>
        </div>
      </div>

      {peak === 0 ? (
        <p style={{ color: "#55655F", fontSize: 13, marginTop: "1rem" }}>
          {esPanel.statsNoData}
        </p>
      ) : (
        <ul className="panel-spark" aria-label={esPanel.statsViews}>
          {points.map((p) => (
            <li key={p.day} className="panel-spark__col" title={`${p.day}: ${p.views}`}>
              <span
                className="panel-spark__bar"
                /* Percentage of the window's peak — a relative shape is what a
                   30-day trend is for; absolute pixel heights would flatten
                   every low-traffic listing into nothing. */
                style={{ height: `${Math.max(6, (p.views / peak) * 100)}%` }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
