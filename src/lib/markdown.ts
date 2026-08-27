/**
 * A deliberately small markdown subset for editorial posts.
 *
 * It parses to a typed block tree, and the renderer turns that tree into React
 * elements — there is no HTML string anywhere in the path, so a post body can
 * never inject markup, and no sanitizer has to be trusted. The trade is that
 * unsupported syntax degrades to plain text instead of doing something clever.
 *
 * Supported, because it is what a property guide actually needs:
 *
 *   ## Subtítulo            → h2
 *   ### Sub-subtítulo       → h3
 *   - item                  → unordered list
 *   1. item                 → ordered list
 *   > texto                 → callout
 *   ---                     → divider
 *   párrafo normal          → p
 *   **negrita**, *cursiva*, [texto](https://…)  → inline
 *
 * Blank lines separate blocks. Everything else is a paragraph.
 */

export type Inline =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "link"; value: string; href: string };

export type Block =
  | { kind: "heading"; level: 2 | 3; content: Inline[] }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "quote"; content: Inline[] }
  | { kind: "divider" };

/** Only these schemes may appear in a rendered link. */
function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^https?:\/\//i.test(href)) return href;
  // Site-relative links are the common case in a guide ("/tasacion").
  if (/^\/(?!\/)/.test(href)) return href;
  if (/^mailto:[^\s]+@[^\s]+$/i.test(href)) return href;
  return null;
}

const INLINE_RE =
  /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;

  for (const m of text.matchAll(INLINE_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ kind: "text", value: text.slice(last, start) });
    const token = m[0];

    if (token.startsWith("**")) {
      out.push({ kind: "bold", value: token.slice(2, -2) });
    } else if (token.startsWith("*")) {
      out.push({ kind: "italic", value: token.slice(1, -1) });
    } else {
      const close = token.indexOf("](");
      const label = token.slice(1, close);
      const href = safeHref(token.slice(close + 2, -1));
      // A link we won't render as a link still keeps its text.
      out.push(
        href ? { kind: "link", value: label, href } : { kind: "text", value: label },
      );
    }
    last = start + token.length;
  }

  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out.length > 0 ? out : [{ kind: "text", value: text }];
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({
      kind: "paragraph",
      content: parseInline(paragraph.join(" ").trim()),
    });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({
      kind: "list",
      ordered: list.ordered,
      items: list.items.map((i) => parseInline(i)),
    });
    list = null;
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      flushAll();
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushAll();
      blocks.push({ kind: "divider" });
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      blocks.push({
        kind: "heading",
        level: heading[1].length === 2 ? 2 : 3,
        content: parseInline(heading[2].trim()),
      });
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushAll();
      blocks.push({ kind: "quote", content: parseInline(quote[1].trim()) });
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const item = (bullet ?? numbered)![1].trim();
      if (list && list.ordered !== ordered) flushList();
      list = list ?? { ordered, items: [] };
      list.items.push(item);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
}

/** Plain text of a body — for meta descriptions and excerpt fallbacks. */
export function markdownToPlainText(source: string, maxLen = 300): string {
  const text = parseMarkdown(source)
    .filter((b) => b.kind === "paragraph")
    .map((b) =>
      (b as Extract<Block, { kind: "paragraph" }>).content
        .map((i) => i.value)
        .join(""),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).replace(/\s+\S*$/, "")}…`;
}

/** Rough reading time in minutes, at ~200 wpm. Never returns 0. */
export function readingMinutes(source: string): number {
  const words = source.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
