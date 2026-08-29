/**
 * Purge expired session rows (audit F39): sessions are deleted on logout and
 * lazily when their owner next shows up, so a session that simply goes stale
 * sits in the table forever. Same predicate as purgeExpiredSessions() in
 * src/lib/auth/session.ts, inlined here because that module is request-scoped
 * (next/headers) and this runs under tsx.
 *
 *   DATABASE_URL=... npm run cron:sessions
 *
 * Wire as a Hostinger cron (daily) next to cron:fx. Uses idx_expires.
 */
import { lt } from "drizzle-orm";
import { db } from "../src/db";
import { sessions } from "../src/db/schema";

async function main() {
  const [res] = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  console.log(`purged ${res.affectedRows} expired session(s)`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
