/**
 * Report what the *production database* actually has, versus what the code
 * needs — the migration journal, the columns `src/db/schema.ts` declares, and
 * whether the D8 `owner` lead lane can be written.
 *
 * The migration list answers "did drizzle record running these?". That is a
 * proxy, and it can lie in both directions (below). **The question that
 * actually matters is "does this database have what the deployed code
 * selects?"** — because drizzle emits `SELECT` with every column in
 * `schema.ts` named, so one missing column 500s every page that reads that
 * table, not just the feature that added it. The schema-drift section answers
 * that one directly, by reading `schema.ts` and `information_schema` and
 * diffing them.
 *
 * Why this exists: `drizzle/meta/_journal.json` lists every migration the repo
 * has generated. It says nothing about which of them ran against prod. README
 * step 2 documents pasting a migration into phpMyAdmin as an accepted path, and
 * that path does **not** record a row in `__drizzle_migrations`. So the journal
 * and the tracking table can disagree in both directions, and `npm run
 * db:migrate` decides what to run from the tracking table alone. Look before
 * you fire — there is no staging environment.
 *
 * Strictly read-only by default: it opens its own connection, runs SELECTs
 * against information_schema, and prints. It never migrates and never writes.
 *
 *   $env:DATABASE_URL = "mysql://<user>:<pass>@<host>:3306/<db>"   # PowerShell
 *   npm run db:status
 *
 * With `--probe` it additionally tries one INSERT of a `routed_to = 'owner'`
 * lead inside a transaction and **always rolls it back**, which is the only
 * way to prove the enum accepts the value end to end. The rollback is in a
 * `finally`, so it happens even if the insert throws.
 *
 *   npm run db:status -- --probe
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { is } from "drizzle-orm";
import { getTableConfig, MySqlTable } from "drizzle-orm/mysql-core";
import * as appSchema from "../src/db/schema";

const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error(
    "DATABASE_URL is not set.\n" +
      "tsx does not read .env automatically — set it in the shell first:\n" +
      '  PowerShell:  $env:DATABASE_URL = "mysql://user:pass@host:3306/db"\n' +
      '  bash:        export DATABASE_URL="mysql://user:pass@host:3306/db"',
  );
  process.exit(1);
}

const probe = process.argv.includes("--probe");

/** Redact the password so the connection target can be printed safely. */
function describeTarget(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.username}@${u.hostname}:${u.port || "3306"}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

type JournalEntry = { idx: number; when: number; tag: string };

/**
 * The same hash drizzle-orm's migrator computes: sha256 over the **whole file
 * text**, before it is split on `--> statement-breakpoint`. Matching on this
 * rather than on the tag is what catches a migration file edited after it ran.
 */
function hashOf(tag: string): string | null {
  const path = join(process.cwd(), "drizzle", `${tag}.sql`);
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path).toString()).digest("hex");
}

const journal: { entries: JournalEntry[] } = JSON.parse(
  readFileSync(join(process.cwd(), "drizzle", "meta", "_journal.json")).toString(),
);

async function main() {
  const c = await mysql.createConnection(url);

  try {
    console.log(`\nConnected to ${describeTarget(url)}`);

    const [[server]] = (await c.query(
      "SELECT VERSION() AS version, DATABASE() AS db, @@sql_mode AS sql_mode",
    )) as [Array<{ version: string; db: string; sql_mode: string }>, unknown];
    console.log(`MySQL ${server.version}, database \`${server.db}\``);

    /**
     * Strict mode is the difference between a loud failure and a silent one. With
     * STRICT_TRANS_TABLES off, MySQL does not reject an out-of-range ENUM value —
     * it stores '' and emits a warning nobody reads. That is the shape a "leads
     * vanish quietly" report takes, and it means there may be salvageable rows.
     */
    const strict = /STRICT_TRANS_TABLES|STRICT_ALL_TABLES/.test(server.sql_mode);
    console.log(`sql_mode strict: ${strict ? "YES (bad value => error)" : "NO  (bad value => stored as '', warning only)"}`);

    /* ---------------- migration tracking ---------------- */

    const [tracking] = (await c.query(
      // Aliased to lower case on purpose: information_schema column names come
      // back UPPER on MySQL 8.x whatever case the query is written in, and an
      // unaliased `r.table_schema` is then silently `undefined` — which reads
      // downstream as a query against a database literally named "undefined".
      `SELECT table_schema AS \`table_schema\` FROM information_schema.tables
        WHERE table_name = '__drizzle_migrations'`,
    )) as [Array<{ table_schema: string }>, unknown];

    console.log("\n=== migrations ===");
    /** Cross-referenced by the drift section below. Null = nothing recorded. */
    let pendingCount: number | null = null;
    if (tracking.length === 0) {
      console.log(
        "No __drizzle_migrations table exists anywhere on this server.\n" +
          "Drizzle has never recorded a migration here. It does NOT follow that the\n" +
          "schema is empty — migrations pasted into phpMyAdmin leave no trace. Compare\n" +
          "the table list below against drizzle/ before running db:migrate, because\n" +
          "db:migrate would replay every migration from 0000.",
      );
    } else {
      for (const t of tracking) {
        const [rows] = (await c.query(
          `SELECT hash, created_at FROM \`${t.table_schema}\`.\`__drizzle_migrations\`
            ORDER BY created_at`,
        )) as [Array<{ hash: string; created_at: number | string }>, unknown];

        const applied = new Set(rows.map((r) => r.hash));
        console.log(`tracking table: \`${t.table_schema}\`.__drizzle_migrations (${rows.length} rows)\n`);

        let pending = 0;
        for (const e of journal.entries) {
          const h = hashOf(e.tag);
          const known = h !== null && applied.has(h);
          if (!known) pending++;
          console.log(
            `  ${known ? "APPLIED " : "PENDING "} ${String(e.idx).padStart(4, "0")}  ${e.tag}` +
              (h === null ? "   <-- .sql file missing from drizzle/" : ""),
          );
        }

        /**
         * A recorded hash with no matching file means prod ran something this
         * checkout does not contain — a different branch, or an edited file.
         * db:migrate cannot reconcile that; a human has to.
         */
        const known = new Set(
          journal.entries.map((e) => hashOf(e.tag)).filter((h): h is string => h !== null),
        );
        const orphans = rows.filter((r) => !known.has(r.hash));
        if (orphans.length > 0) {
          console.log(
            `\n  WARNING: ${orphans.length} recorded migration(s) match no file in drizzle/.` +
              "\n  Production ran SQL this checkout does not have. Do not run db:migrate; investigate.",
          );
        }
        pendingCount = pending;
        console.log(`\n  ${pending} pending, ${journal.entries.length - pending} applied.`);
        if (pending > 0) {
          console.log("  `npm run db:migrate` runs ALL of the above PENDING rows, in order.");
        }
      }
    }

    /* ---------------- schema drift ---------------- */

    /**
     * What `src/db/schema.ts` declares, flattened. Drizzle's own metadata, so
     * it cannot drift from what the ORM actually emits — the point of reading
     * the schema object rather than parsing the migrations.
     */
    const declared = Object.values(appSchema)
      .filter((v) => is(v, MySqlTable))
      .map((t) => getTableConfig(t as MySqlTable));

    const [live] = (await c.query(
      `SELECT table_name AS \`table_name\`, column_name AS \`column_name\`,
              column_type AS \`column_type\`
         FROM information_schema.columns
        WHERE table_schema = DATABASE()`,
    )) as [
      Array<{ table_name: string; column_name: string; column_type: string }>,
      unknown,
    ];

    const liveByTable = new Map<string, Map<string, string>>();
    for (const r of live) {
      // information_schema casing follows the server's lower_case_table_names.
      const table = r.table_name.toLowerCase();
      if (!liveByTable.has(table)) liveByTable.set(table, new Map());
      liveByTable.get(table)!.set(r.column_name.toLowerCase(), r.column_type);
    }

    const missingTables: string[] = [];
    const missingColumns: string[] = [];
    const missingEnumValues: string[] = [];
    let declaredColumns = 0;

    for (const t of declared) {
      declaredColumns += t.columns.length;
      const liveCols = liveByTable.get(t.name.toLowerCase());
      if (!liveCols) {
        // Its columns are missing too, but naming 30 of them under a table
        // that does not exist is noise — the table line says it.
        missingTables.push(t.name);
        continue;
      }
      for (const col of t.columns) {
        const liveType = liveCols.get(col.name.toLowerCase());
        if (liveType === undefined) {
          missingColumns.push(`${t.name}.${col.name}`);
          continue;
        }
        /**
         * An enum the database is missing a value for is the D8 incident
         * generalised: the column exists, every SELECT is fine, and the one
         * INSERT that uses the new value fails (or, on a non-strict server,
         * silently stores ''). Comparing the declared values against the live
         * column_type catches the next one of these before it ships.
         */
        const values = (col as unknown as { enumValues?: string[] }).enumValues;
        if (Array.isArray(values) && liveType.startsWith("enum(")) {
          for (const v of values) {
            if (!liveType.includes(`'${v}'`)) {
              missingEnumValues.push(`${t.name}.${col.name} is missing '${v}'`);
            }
          }
        }
      }
    }

    console.log("\n=== schema drift (src/db/schema.ts vs this database) ===");
    console.log(
      `${declared.length} tables, ${declaredColumns} columns declared in schema.ts.`,
    );

    if (missingTables.length === 0 && missingColumns.length === 0 && missingEnumValues.length === 0) {
      console.log("Every declared table, column and enum value is present. No drift.");
    }

    if (missingTables.length > 0) {
      console.log(
        `\n  MISSING TABLES (${missingTables.length}) — every query against these fails:`,
      );
      for (const t of missingTables) console.log(`    ${t}`);
    }

    /**
     * The headline, and the reason this section exists. Drizzle names every
     * column of a table in its SELECT, so one column the database does not
     * have is not a broken feature — it is a 500 on every page that reads that
     * table. This is what to look at before merging a schema PR, and again
     * right after running db:migrate.
     */
    if (missingColumns.length > 0) {
      console.log(
        `\n  MISSING COLUMNS (${missingColumns.length}) — deployed code SELECTs these by name,\n` +
          "  so EVERY page that reads the table 500s until the migration runs:",
      );
      for (const col of missingColumns) console.log(`    ${col}`);
    }

    if (missingEnumValues.length > 0) {
      console.log(
        `\n  ENUM VALUES THE DATABASE WILL NOT ACCEPT (${missingEnumValues.length}) — reads are fine;\n` +
          "  an INSERT or UPDATE using one of these fails, or on a non-strict server\n" +
          "  stores '' with a warning nobody reads:",
      );
      for (const v of missingEnumValues) console.log(`    ${v}`);
    }

    /**
     * The two reconciliations that matter, because each means the migration
     * list above is lying and the fix is different in each direction.
     */
    const drifted =
      missingTables.length + missingColumns.length + missingEnumValues.length;
    if (pendingCount === 0 && drifted > 0) {
      console.log(
        "\n  WARNING: the tracking table says nothing is pending, yet the database is\n" +
          "  missing things schema.ts declares. Something applied a migration's row\n" +
          "  without its SQL, or the SQL was rolled back afterwards. `db:migrate` will\n" +
          "  do NOTHING here — this needs a human and hand-written DDL.",
      );
    } else if (pendingCount !== null && pendingCount > 0 && drifted === 0) {
      console.log(
        "\n  Note: migrations are pending but nothing is missing — the schema changes\n" +
          "  were applied by hand (phpMyAdmin) without recording a row. `db:migrate`\n" +
          "  would replay them; read each pending file above before running it.",
      );
    }

    /* ---------------- the actual incident ---------------- */

    console.log("\n=== leads.routed_to (the D8 owner lane) ===");
    const [cols] = (await c.query(
      `SELECT table_schema AS \`table_schema\`, column_type AS \`column_type\`,
              is_nullable AS \`is_nullable\`
         FROM information_schema.columns
        WHERE column_name = 'routed_to' AND table_name = 'leads'`,
    )) as [Array<{ table_schema: string; column_type: string; is_nullable: string }>, unknown];

    if (cols.length === 0) {
      console.log("No `leads.routed_to` column found. Is this the right database?");
    }
    for (const col of cols) {
      const ok = col.column_type.includes("'owner'");
      console.log(`  \`${col.table_schema}\`.leads.routed_to  ${col.column_type}`);
      console.log(`  accepts 'owner': ${ok ? "YES — migration 0009 is applied" : "NO  — migration 0009 is NOT applied; FSBO leads are failing"}`);

      /**
       * Only meaningful on a non-strict server, where the failed inserts did not
       * error but landed as ''. On a strict server this is correctly always 0 —
       * those leads never reached the table and are not recoverable from here.
       */
      const [[bad]] = (await c.query(
        `SELECT COUNT(*) AS n FROM \`${col.table_schema}\`.leads WHERE routed_to = ''`,
      )) as [Array<{ n: number }>, unknown];
      if (bad.n > 0) {
        console.log(
          `\n  ${bad.n} lead row(s) have routed_to = '' — silently truncated writes.\n` +
            "  These are recoverable: after 0009 is applied, re-route the ones whose\n" +
            "  listing has no agent and no agency to 'owner'. Review before updating.",
        );
      }
    }

    /* ---------------- optional end-to-end proof ---------------- */

    if (probe) {
      console.log("\n=== probe: INSERT routed_to='owner' (rolled back) ===");
      const db = cols[0]?.table_schema;
      if (!db) {
        console.log("  skipped — no leads table located.");
      } else {
        let inserted = false;
        await c.beginTransaction();
        try {
          await c.query(
            `INSERT INTO \`${db}\`.leads (lead_type, vertical, whatsapp, name, message, routed_to)
             VALUES ('buyer', 'probe', '+000000000', 'migration probe', 'rolled back', 'owner')`,
          );
          inserted = true;
          const [warns] = (await c.query("SHOW WARNINGS")) as [Array<{ Message: string }>, unknown];
          for (const w of warns) console.log(`  warning: ${w.Message}`);
          console.log(warns.length === 0 ? "  INSERT OK, no warnings — the owner lane works." : "  INSERT stored a value but MySQL warned; read the warning above.");
        } catch (err) {
          console.log(`  INSERT FAILED: ${(err as Error).message}`);
          console.log("  The enum still does not accept 'owner'.");
        } finally {
          // Always. The probe must never leave a row behind in production.
          await c.rollback();
          if (inserted) console.log("  rolled back.");
        }
      }
    } else {
      console.log("\nRe-run with `-- --probe` to prove an owner-routed insert succeeds (rolled back).");
    }
  } finally {
    await c.end();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
