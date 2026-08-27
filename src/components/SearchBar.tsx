"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { categoryUrl, operationSlug } from "@/lib/urls";
import { DEFAULT_LOCALE, getDictionary, type Locale } from "@/i18n";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/property-types";
import type { Operation, PropertyType } from "@/lib/import/types";

export interface CityOption {
  name: string;
  slug: string;
}

/**
 * Optional max-budget shortcut (feeds ?precio_max=, the same USD filter the
 * category page's filter bar reads). Sale and rent budgets are different
 * orders of magnitude, so each operation gets its own rungs.
 */
const BUDGET_OPTIONS: Record<"venta" | "alquiler", number[]> = {
  venta: [50_000, 100_000, 150_000, 250_000, 500_000],
  alquiler: [300, 500, 800, 1_200, 2_000],
};

/**
 * Hero search bar: operación + ciudad + tipo, submits by pushing straight to
 * the matching category URL (§4 shapes) — no client-side filtering, no new
 * backend. Ciudad list comes from the DB (server-fetched, passed as a prop)
 * so it never drifts from what's actually seeded.
 *
 * Also reused on category pages, pre-filled with the current selection
 * (defaultOperation/defaultCitySlug/defaultType) so a visitor can pivot the
 * search without going back to the homepage.
 *
 * This is the one client component among the buyer-facing surfaces, so it
 * cannot read the `x-locale` header itself — the server page that renders it
 * passes `locale` down. The default keeps every existing call site rendering
 * exactly what it rendered before.
 */
export function SearchBar({
  cities,
  defaultOperation = "venta",
  defaultCitySlug,
  defaultType = "",
  locale = DEFAULT_LOCALE,
}: {
  cities: CityOption[];
  defaultOperation?: Operation;
  defaultCitySlug?: string;
  defaultType?: PropertyType | "";
  locale?: Locale;
}) {
  const t = getDictionary(locale).searchBar;
  // Number formatting follows the locale, not the copy — kept as a variable
  // (rather than inlined at the one call site) so a future second locale
  // widens this instead of introducing a new pattern.
  const numberLocale = "sv-SE";
  const OPERATION_OPTIONS: { value: Operation; label: string }[] = [
    { value: "venta", label: t.operationBuy },
    { value: "alquiler", label: t.operationRent },
  ];
  const router = useRouter();
  const [operation, setOperation] = useState<Operation>(defaultOperation);
  // "" = todas las ciudades → the national operation hub (/venta, /alquiler).
  const [citySlug, setCitySlug] = useState(defaultCitySlug ?? "");
  const [type, setType] = useState<PropertyType | "">(defaultType);
  const [budget, setBudget] = useState("");

  const budgets =
    BUDGET_OPTIONS[operation === "venta" ? "venta" : "alquiler"];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Without a city there is no category route; the operation hub lists
    // every city and type with live counts, so that's where "todas" lands.
    const href = citySlug
      ? categoryUrl({ operation, citySlug, type: type || undefined })
      : `/${operationSlug(operation)}`;
    router.push(citySlug && budget ? `${href}?precio_max=${budget}` : href);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit} role="search">
      <div className="search-bar__field">
        <label className="search-bar__label" htmlFor="search-operation">
          {t.operationLabel}
        </label>
        <select
          id="search-operation"
          className="search-bar__select"
          value={operation}
          onChange={(e) => setOperation(e.target.value as Operation)}
        >
          {OPERATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="search-bar__field search-bar__field--grow">
        <label className="search-bar__label" htmlFor="search-city">
          {t.cityLabel}
        </label>
        <select
          id="search-city"
          className="search-bar__select"
          value={citySlug}
          onChange={(e) => setCitySlug(e.target.value)}
        >
          <option value="">{t.cityAny}</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="search-bar__field search-bar__field--grow">
        <label className="search-bar__label" htmlFor="search-type">
          {t.typeLabel}
        </label>
        <select
          id="search-type"
          className="search-bar__select"
          value={type}
          onChange={(e) => setType(e.target.value as PropertyType | "")}
        >
          <option value="">{t.typeAny}</option>
          {PROPERTY_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="search-bar__field">
        <label className="search-bar__label" htmlFor="search-budget">
          {t.budgetLabel}
        </label>
        <select
          id="search-budget"
          className="search-bar__select"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        >
          <option value="">{t.budgetAny}</option>
          {budgets.map((b) => (
            <option key={b} value={b}>
              {t.budgetUpTo(b, numberLocale)}
            </option>
          ))}
        </select>
      </div>

      <button className="search-bar__submit" type="submit">
        {t.submit}
      </button>
    </form>
  );
}
