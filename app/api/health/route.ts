/**
 * Liveness probe that touches nothing.
 *
 * Written after an outage where the only symptom was "requests hang", and there
 * was no way to tell a dead process from one stuck waiting on MySQL. This route
 * imports no database, no storage client and no page code, so a 200 here means
 * "the Node process is alive and serving" and nothing more — which is exactly
 * the fact that was missing.
 *
 * Pair it with /api/health/db when you need to know whether MySQL answers.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true, at: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
