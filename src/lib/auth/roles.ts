/**
 * Role model (task brief: super_admin / agency / agent) mapped onto the
 * existing users.role enum in src/db/schema.ts — the schema is the source of
 * truth and its enum is left untouched:
 *
 *   brief          users.role
 *   super_admin  ← "admin"
 *   agency       ← "agency_admin"
 *   agent        ← "agent"
 *
 * "consumer" and "developer" are public/lead-side roles with no panel access.
 * Route gating is expressed in these terms, never by comparing raw enum
 * strings at the call site.
 */
import type { users } from "@/db/schema";

export type UserRole = (typeof users.$inferSelect)["role"];

/** Full super-admin: the founder. Sees /admin. */
export function isSuperAdmin(role: UserRole): boolean {
  return role === "admin";
}

/** Belongs to an agency (agency owner/admin or an agency's agent). Sees /agencia. */
export function isAgencyRole(role: UserRole): boolean {
  return role === "agency_admin" || role === "agent";
}

/** Human-readable, es-PY label for a role — used in the panel header. */
export function roleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Administrador";
    case "agency_admin":
      return "Inmobiliaria";
    case "agent":
      return "Agente";
    case "developer":
      return "Desarrolladora";
    case "consumer":
      return "Usuario";
  }
}
