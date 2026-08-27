/**
 * Create or update a panel user with an email+password login and a role.
 * There's no public sign-up for the panel yet (WhatsApp OTP + the publish
 * wizard are a later milestone), so this is how the founder bootstraps the
 * first super-admin and seeds agency/agent logins.
 *
 * Idempotent — re-running for the same email resets the password/role/name:
 *
 *   npx tsx scripts/create-user.ts <email> <password> <role> [name]
 *
 * <role> accepts the task's names or the raw enum:
 *   super_admin | admin           → admin
 *   agency      | agency_admin     → agency_admin
 *   agent                          → agent
 *
 * Linking an agency/agent login to a specific agency is done via the agents
 * table (agents.user_id) in Drizzle Studio — the dashboard scopes on it.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";

type Role = (typeof users.$inferSelect)["role"];

const ROLE_ALIASES: Record<string, Role> = {
  super_admin: "admin",
  admin: "admin",
  agency: "agency_admin",
  agency_admin: "agency_admin",
  agent: "agent",
  developer: "developer",
  consumer: "consumer",
};

async function main() {
  const [email, password, roleArg, ...nameParts] = process.argv.slice(2);
  if (!email || !password || !roleArg) {
    console.error(
      "Usage: tsx scripts/create-user.ts <email> <password> <role> [name]",
    );
    process.exit(1);
  }

  const role = ROLE_ALIASES[roleArg.toLowerCase()];
  if (!role) {
    console.error(
      `Unknown role "${roleArg}". Use: super_admin | agency | agent | developer | consumer`,
    );
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const name = nameParts.join(" ").trim() || null;
  const passwordHash = await hashPassword(password);

  await db
    .insert(users)
    .values({ email: normalizedEmail, name, role, passwordHash })
    .onDuplicateKeyUpdate({ set: { name, role, passwordHash } });

  const [row] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  console.info(
    `✓ user ready: #${row?.id} ${row?.email} (${row?.role}) — login at /login`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
