/**
 * Escaping a user's search text before it becomes a LIKE pattern.
 *
 * This is not an injection fix — Drizzle parameterises the term, so `'` and
 * friends never reach the parser. It is that `%` and `_` are *wildcards* inside
 * the value: searching the panel for `100%` becomes `%100%%`, which matches
 * every row in the table, and a lone `%` turns a bounded lookup into a full
 * scan the operator did not ask for (audit F52). `_` is the quieter version —
 * it matches any single character, so `casa_1` silently returns `casa 1`,
 * `casa-1` and `casaX1`.
 *
 * MySQL's default LIKE escape character is the backslash, so the backslash
 * itself has to be escaped first or it eats the escape we add next.
 */

export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** The common case: a case-insensitive "contains" pattern. */
export function containsPattern(term: string): string {
  return `%${escapeLike(term)}%`;
}

/** A "starts with" pattern, for slug-collision style lookups. */
export function startsWithPattern(term: string): string {
  return `${escapeLike(term)}%`;
}
