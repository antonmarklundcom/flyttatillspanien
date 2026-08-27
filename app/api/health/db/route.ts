/**
 * Does MySQL answer, and how fast?
 *
 * Separate from /api/health on purpose: that one proves the process is alive,
 * this one proves the database is reachable. During the 503 incident the two
 * were indistinguishable, which cost hours.
 *
 * `SELECT 1` only — it takes a pool connection and returns it immediately, so
 * probing this cannot itself contribute to pool starvation. A slow response
 * here means the pool is saturated; a 503 means it timed out, which is now the
 * designed behaviour rather than an infinite wait.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json(
      { ok: true, dbMs: Date.now() - started },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    // The driver's message is not safe to return: mysql2 spells out the DB
    // user, the host it dialled and — on a rejected connection — this box's
    // egress IP, all to an unauthenticated caller (audit F29). The class is
    // what an operator actually reads off a probe; the detail goes to the
    // process log, where it is already available to whoever runs the app.
    console.error("[health/db]", err);
    return NextResponse.json(
      { ok: false, dbMs: Date.now() - started, error: failureClass(err) },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

type FailureClass = "timeout" | "refused" | "auth" | "exhausted" | "unknown";

/** Map a driver error onto the handful of things that are actually wrong. */
function failureClass(err: unknown): FailureClass {
  const code = (err as { code?: string } | null)?.code ?? "";
  const message = err instanceof Error ? err.message.toLowerCase() : "";

  if (code === "ETIMEDOUT" || code === "PROTOCOL_SEQUENCE_TIMEOUT") return "timeout";
  if (message.includes("timeout") || message.includes("timed out")) return "timeout";
  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EHOSTUNREACH") {
    return "refused";
  }
  if (code.startsWith("ER_ACCESS_DENIED") || code === "ER_DBACCESS_DENIED_ERROR") {
    return "auth";
  }
  if (code === "ER_CON_COUNT_ERROR" || message.includes("too many connections")) {
    return "exhausted";
  }
  return "unknown";
}
