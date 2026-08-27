/**
 * Shim for the `server-only` marker module, used ONLY by the tsx scripts (see
 * scripts/tsconfig.json).
 *
 * `server-only` exists to fail a build when a server module is pulled into a
 * client bundle, and it does that by throwing on import. Next resolves it to a
 * no-op on the server; plain Node has no such condition, so importing it under
 * tsx throws "Cannot find module 'server-only'" (or the guard error) and a CLI
 * script that reaches into src/lib cannot start at all.
 *
 * Mapping it to this empty module keeps the guard exactly as it is in the app
 * while letting scripts import the same query and pipeline code the panels use,
 * instead of a duplicate copy that can drift.
 */
export {};
