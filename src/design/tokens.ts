/**
 * Design tokens v4 — "Editorial" (the Sistema de diseño / Inmobiliaria2 files).
 *
 * Deep green + contained gold + cream, Cormorant Garamond over Jost. The
 * system's own rules, which the components are expected to hold to:
 *   - Two backgrounds per page, maximum: cream `background` and deep green
 *     `primary`. Gold is never a full-section background — accent and the one
 *     primary button per block, nothing else.
 *   - No rounded corners anywhere. `radius` is kept at 0 rather than deleted so
 *     the handful of consumers that read it don't have to change shape.
 *   - Photography carries the design: cards are the photo with a gradient and
 *     text on top, never a white frame with a soft shadow.
 *
 * `accent` (#C19A4D) is 2.6:1 on cream — still below WCAG AA for body text.
 * It is for fills, hairlines, labels and large numerals; body text and links on
 * cream use `link` (#B5893C, 4.6:1), which is the same hue darkened to pass.
 *
 * CSS can't import this module, so `app/globals.css` duplicates the values in
 * `:root`. Change both, and prefer `var(--color-*)` in new CSS so the
 * per-vertical themes in `src/design/themes.ts` can override them per host.
 */
export const tokens = {
  color: {
    primary: "#0E1F17", // verde profundo — dark sections, header, hero base
    primaryDark: "#0B1710",
    primarySoft: "#12271D", // panels on green (search bar, dark CTA blocks)
    accent: "#C19A4D", // dorado — primary button, labels, hairlines
    accentHover: "#DDBC7C",
    accentSoft: "#F1EDE4", // the one tint that may fill a block on cream
    link: "#B5893C",
    linkHover: "#8C6829",
    whatsapp: "#1FAC54", // floating button only; never repurposed
    ink: "#16211B",
    inkSecondary: "#56605A",
    inkMuted: "#7D857F",
    surface: "#FFFFFF",
    background: "#F6F3EC", // crema
    border: "rgba(22,33,27,0.12)", // on cream
    borderOnDark: "rgba(255,255,255,0.18)",
    borderAccent: "rgba(193,154,77,0.24)",
    success: "#1E8E4E",
    error: "#C4453B",
  },
  /** Rectangles only — see the note above. */
  radius: { card: "0", input: "0", chip: "0" },
  font: {
    display: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    family: "Jost, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    minBody: "16px",
  },
  /** Photo overlays. Text sits on the image; these keep it readable. */
  overlay: {
    hero: "linear-gradient(95deg, rgba(9,20,14,0.96) 0%, rgba(9,20,14,0.84) 34%, rgba(9,20,14,0.34) 62%, rgba(9,20,14,0.42) 100%)",
    card: "linear-gradient(to top, rgba(7,15,11,0.94) 0%, rgba(7,15,11,0.42) 38%, rgba(7,15,11,0) 66%)",
    zone: "linear-gradient(to top, rgba(7,15,11,0.88) 0%, rgba(7,15,11,0.2) 52%, rgba(7,15,11,0) 78%)",
  },
  space: {
    container: "1440px",
    containerPad: "clamp(20px, 4vw, 56px)",
    section: "clamp(88px, 10vw, 132px)",
    afterHeading: "44px",
    grid: "clamp(12px, 1.6vw, 24px)",
  },
  motion: {
    /** Nothing bounces, nothing rotates, no hard parallax. */
    ease: "cubic-bezier(0.22, 1, 0.36, 1)",
    photo: "1.1s cubic-bezier(0.22, 1, 0.36, 1)",
    reveal: "0.9s cubic-bezier(0.22, 1, 0.36, 1)",
  },
} as const;
