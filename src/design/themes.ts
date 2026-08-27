/**
 * Per-vertical themes — the mechanism PLAN.md D6 calls for, with the values
 * deliberately identical for now.
 *
 * A theme is just the subset of `:root` custom properties a host is allowed to
 * override. `app/layout.tsx` writes them onto <html> for the resolved vertical,
 * so every rule that reads `var(--color-*)` follows the domain with no
 * component changes. Today both live hosts get the same editorial system, so
 * this is a no-op at runtime — but the wire exists, and giving
 * realestateinparaguay.com its own palette later is an entry in this file
 * rather than a refactor of every component.
 *
 * Rules for adding one:
 *   - Values only. Structure (which sections a page has, which hero it uses)
 *     belongs in a shell/component registry, not here — a token can't express
 *     "this domain has a different homepage".
 *   - A shared component must never branch on the vertical key. If it needs to
 *     differ, it needs a token here or a fork in the registry; a conditional
 *     inside a shared component is how one component quietly becomes two.
 */
import type { VerticalKey } from "@/config/verticals";
import { tokens } from "./tokens";

export type ThemeVars = Record<`--${string}`, string>;

/** The editorial system: the base every host currently uses. */
const EDITORIAL: ThemeVars = {
  "--color-primary": tokens.color.primary,
  "--color-primary-dark": tokens.color.primaryDark,
  "--color-primary-soft": tokens.color.primarySoft,
  "--color-accent": tokens.color.accent,
  "--color-accent-hover": tokens.color.accentHover,
  "--color-accent-soft": tokens.color.accentSoft,
  "--color-link": tokens.color.link,
  "--color-link-hover": tokens.color.linkHover,
  "--color-ink": tokens.color.ink,
  "--color-ink-secondary": tokens.color.inkSecondary,
  "--color-ink-muted": tokens.color.inkMuted,
  "--color-background": tokens.color.background,
  "--color-border": tokens.color.border,
};

/**
 * Overrides per vertical, merged onto EDITORIAL. Empty today on purpose —
 * an entry here is a deliberate divergence, and the diff should show it.
 */
const OVERRIDES: Partial<Record<VerticalKey, ThemeVars>> = {};

export function themeFor(key: VerticalKey): ThemeVars {
  return { ...EDITORIAL, ...(OVERRIDES[key] ?? {}) };
}
