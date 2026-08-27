import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

/**
 * Single pool for the whole app. Hostinger MySQL allows a limited number of
 * concurrent connections per user — keep the pool small; Next.js server
 * components share it across requests.
 *
 * **The limits below are not tuning, they are an outage fix.** With mysql2's
 * defaults (`waitForConnections: true`, `queueLimit: 0`, no acquire timeout) a
 * request arriving when every connection is busy waits *forever*. On this host
 * that is fatal rather than merely slow: each stuck request keeps its process
 * alive, the account's shared 200-process cap fills, and then every site on the
 * account answers 503 — the incident this comment was written after. A request
 * that cannot get a connection must fail in seconds so its process is released.
 *
 * `DATABASE_URL` handling is untouched on purpose: this pool is built at module
 * load, so a malformed URL crashes the process at startup (503) rather than
 * failing one page. Add options here; never rewrite the credential handling.
 */
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,

  /**
   * Deliberately small. The ceiling that matters is MySQL's per-user connection
   * limit, and Passenger may run several app processes — each with its own pool
   * — so the real total is connectionLimit × processes.
   */
  connectionLimit: 6,
  maxIdle: 6,
  idleTimeout: 30_000,

  /**
   * Bounded queue instead of an unbounded one: past this, requests are rejected
   * immediately rather than piling up behind a saturated pool.
   */
  waitForConnections: true,
  queueLimit: 24,

  /** Never hang on an unreachable or overloaded MySQL. */
  connectTimeout: 8_000,

  timezone: "Z",
});

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
