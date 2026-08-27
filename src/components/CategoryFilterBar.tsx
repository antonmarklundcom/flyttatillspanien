/**
 * Category page filters: price range, min bedrooms, sort. A plain GET form
 * — no client JS. Submitting reloads the same URL with a query string, which
 * the page reads via `searchParams`. Filters only narrow the visible grid;
 * they never affect indexability (see src/lib/queries.ts CategoryFilters).
 */
import { dict } from "@/i18n/server";

export async function CategoryFilterBar({
  basePath,
  precioMin,
  precioMax,
  dormitorios,
  orden,
  vista,
  tipoVacio,
  hasActiveFilters,
}: {
  basePath: string;
  precioMin?: string;
  precioMax?: string;
  dormitorios?: string;
  orden?: string;
  /** Current view mode (?vista=mapa) — kept across a filter submit. */
  vista?: string;
  /** Empty-category redirect notice (?tipo_vacio=…) — kept across a submit. */
  tipoVacio?: string;
  hasActiveFilters: boolean;
}) {
  const t = (await dict()).filters;
  return (
    <form className="filter-bar" method="GET" action={basePath}>
      {/* A GET form replaces the whole query string, so params this form
          doesn't own must ride along as hidden inputs or they're dropped. */}
      {vista && <input type="hidden" name="vista" value={vista} />}
      {tipoVacio && <input type="hidden" name="tipo_vacio" value={tipoVacio} />}
      <div className="filter-bar__field">
        <label className="filter-bar__label" htmlFor="precio_min">
          {t.priceMinLabel}
        </label>
        <input
          id="precio_min"
          name="precio_min"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder={t.priceMinPlaceholder}
          defaultValue={precioMin}
          className="filter-bar__input"
        />
      </div>

      <div className="filter-bar__field">
        <label className="filter-bar__label" htmlFor="precio_max">
          {t.priceMaxLabel}
        </label>
        <input
          id="precio_max"
          name="precio_max"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder={t.priceMaxPlaceholder}
          defaultValue={precioMax}
          className="filter-bar__input"
        />
      </div>

      <div className="filter-bar__field">
        <label className="filter-bar__label" htmlFor="dormitorios">
          {t.bedroomsLabel}
        </label>
        <select
          id="dormitorios"
          name="dormitorios"
          defaultValue={dormitorios ?? ""}
          className="filter-bar__select"
        >
          <option value="">{t.bedroomsAny}</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
        </select>
      </div>

      <div className="filter-bar__field">
        <label className="filter-bar__label" htmlFor="orden">
          {t.sortLabel}
        </label>
        <select
          id="orden"
          name="orden"
          defaultValue={orden ?? "recientes"}
          className="filter-bar__select"
        >
          <option value="recientes">{t.sortRecent}</option>
          <option value="precio_asc">{t.sortPriceAsc}</option>
          <option value="precio_desc">{t.sortPriceDesc}</option>
        </select>
      </div>

      <button className="filter-bar__submit" type="submit">
        {t.submit}
      </button>
      {hasActiveFilters && (
        <a className="filter-bar__clear" href={basePath}>
          {t.clear}
        </a>
      )}
    </form>
  );
}
