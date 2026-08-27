import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // mysql://user:pass@host:3306/dbname — Hostinger hPanel gives you these
    // values when you create the database (enable Remote MySQL for local dev).
    url: process.env.DATABASE_URL!,
  },
});
