/**
 * Verify the panel's ownership guards against a real database.
 *
 * These are the riskiest invariants in the app: every panel read and write is
 * scoped by a WHERE clause (`listingScopeWhere`), and if one of them ever loses
 * its guard, one agency edits another's listings and nothing visibly breaks.
 * Types cannot catch that — only exercising it can.
 *
 * Refuses to run against anything but a local database: it creates and deletes
 * users, agencies and listings, which must never happen in production.
 *
 *   docker compose up -d
 *   npm run db:migrate
 *   DATABASE_URL="mysql://propia:propia@127.0.0.1:3306/propia" npm run verify:scopes
 *
 * Cleans up the rows it created, so it is safe to re-run.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  agencies,
  agents,
  leads,
  listings,
  locations,
  sessions,
  users,
} from "../src/db/schema";
import { registerAccount } from "../src/lib/registration";
import {
  getAgencyProfile,
  getOwnAgentProfile,
  updateAgencyProfile,
  updateOwnAccount,
  updateOwnAgentProfile,
} from "../src/lib/profile-queries";
import {
  getPanelLeads,
  getPanelListings,
  setPanelListingStatus,
} from "../src/lib/panel-queries";
import { getEditableListing, updateListing } from "../src/lib/listing-edit";
import { verifyPassword } from "../src/lib/auth/password";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1|mysql)[:/]/.test(url)) {
  console.error(
    "Refusing to run: DATABASE_URL must point at a local database " +
      "(this script creates and deletes users, agencies and listings).",
  );
  process.exit(1);
}

let failures = 0;
function check(label: string, condition: boolean, detail = ""): void {
  if (!condition) failures += 1;
  console.log(
    `${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

/** Unique per run so a re-run never collides with leftovers. */
const stamp = Date.now();
const mail = (who: string) => `verify-${who}-${stamp}@example.test`;

async function main() {
  // Listings need a real location FK; seed one with npm run seed:locations.
  const [anyLocation] = await db
    .select({ id: locations.id })
    .from(locations)
    .limit(1);
  if (!anyLocation) {
    console.error("No locations row — run `npm run seed:locations` first.");
    process.exit(1);
  }
  const locationId = anyLocation.id;

  const createdUserIds: number[] = [];
  const createdAgencyIds: number[] = [];
  const createdListingIds: number[] = [];

  try {
    /* ---------------------------------------------------------------- */
    /* Sign-up creates a login, not trust                               */
    /* ---------------------------------------------------------------- */
    const agencyOwner = await registerAccount({
      kind: "agency",
      name: "Verify Agency Owner",
      email: mail("agency"),
      password: "secreto123",
      phone: null,
      agencyName: `Verify Inmobiliaria ${stamp}`,
    });
    check("agency signup succeeds", agencyOwner.ok);
    if (!agencyOwner.ok) return;
    createdUserIds.push(agencyOwner.userId);

    const [ownerUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, agencyOwner.userId));
    check("agency owner gets agency_admin", ownerUser.role === "agency_admin");
    check(
      "password is stored hashed",
      !!ownerUser.passwordHash && !ownerUser.passwordHash.includes("secreto123"),
    );
    check(
      "password verifies",
      await verifyPassword("secreto123", ownerUser.passwordHash),
    );

    const [agentRow] = await db
      .select()
      .from(agents)
      .where(eq(agents.userId, agencyOwner.userId));
    check("agents row links user to agency", agentRow?.agencyId != null);
    check("agent starts unverified", agentRow.isVerified === false);
    const agencyId = agentRow.agencyId!;
    createdAgencyIds.push(agencyId);

    const agencyRow = await getAgencyProfile(agencyId);
    check("agency starts unverified", agencyRow?.isVerified === false);

    const independent = await registerAccount({
      kind: "independent",
      name: "Verify Independent",
      email: mail("independent"),
      password: "secreto123",
      phone: null,
      agencyName: null,
    });
    check("independent signup succeeds", independent.ok);
    if (!independent.ok) return;
    createdUserIds.push(independent.userId);

    const [indepUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, independent.userId));
    const [indepAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.userId, independent.userId));
    check("independent gets the agent role", indepUser.role === "agent");
    check("independent has no agency", indepAgent.agencyId === null);

    const dup = await registerAccount({
      kind: "independent",
      name: "Duplicate",
      email: ownerUser.email!,
      password: "secreto123",
      phone: null,
      agencyName: null,
    });
    check("duplicate email refused", !dup.ok && dup.error === "email_taken");

    const weak = await registerAccount({
      kind: "independent",
      name: "Weak",
      email: mail("weak"),
      password: "corto",
      phone: null,
      agencyName: null,
    });
    check("short password refused", !weak.ok && weak.error === "password");

    /* ---------------------------------------------------------------- */
    /* Scope isolation — the invariant that actually matters            */
    /* ---------------------------------------------------------------- */
    const base = {
      operation: "venta" as const,
      propertyType: "villa" as const,
      locationId,
      status: "published" as const,
      legalStatus: "desconocido" as const,
      chargesStatus: "desconocido" as const,
    };
    await db.insert(listings).values([
      {
        ...base,
        publicId: `vfy${String(stamp).slice(-7)}`,
        slug: `verify-agency-${stamp}`,
        title: "Verify agency listing",
        priceEur: "285000",
        agencyId,
        /**
         * Must start as a DRAFT, and this is not cosmetic. maySetStatus()
         * always lets a row keep the status it already has, so if this
         * fixture inherited `base`'s `published` the F1 assertion below
         * ("agency cannot publish its own listing") would be published ->
         * published — permitted, and testing nothing. A draft is the state
         * the review queue actually exists to gate.
         */
        status: "draft" as const,
      },
      {
        ...base,
        publicId: `vfx${String(stamp).slice(-7)}`,
        slug: `verify-owner-${stamp}`,
        title: "Verify independent listing",
        priceEur: "260000",
        ownerUserId: independent.userId,
      },
    ]);

    const agencyScope = { kind: "agency", agencyId } as const;
    const ownerScope = { kind: "owner", userId: independent.userId } as const;

    const agencyRows = await getPanelListings(agencyScope);
    const ownerRows = await getPanelListings(ownerScope);
    createdListingIds.push(...agencyRows.map((r) => r.id), ...ownerRows.map((r) => r.id));

    check(
      "agency dashboard shows only its own listing",
      agencyRows.length === 1 && agencyRows[0].title === "Verify agency listing",
    );
    check(
      "independent dashboard shows only their own listing",
      ownerRows.length === 1 &&
        ownerRows[0].title === "Verify independent listing",
    );

    const crossStatus = await setPanelListingStatus({
      listingId: ownerRows[0].id,
      scope: agencyScope,
      status: "paused",
    });
    check(
      "agency cannot change the independent's listing status",
      crossStatus === 0,
      `rows affected: ${crossStatus}`,
    );

    const ownStatus = await setPanelListingStatus({
      listingId: ownerRows[0].id,
      scope: ownerScope,
      status: "paused",
    });
    check("independent can change their own", ownStatus === 1);

    /* ---------------------------------------------------------------- */
    /* Review queue is not optional (audit F1)                          */
    /* ---------------------------------------------------------------- */
    const selfPublish = await setPanelListingStatus({
      listingId: agencyRows[0].id,
      scope: agencyScope,
      status: "published",
    });
    check(
      "agency cannot publish its own listing",
      selfPublish === 0,
      `rows affected: ${selfPublish}`,
    );

    const submit = await setPanelListingStatus({
      listingId: agencyRows[0].id,
      scope: agencyScope,
      status: "pending_review",
    });
    check("agency can submit its own listing for review", submit === 1);

    const adminPublish = await setPanelListingStatus({
      listingId: agencyRows[0].id,
      scope: { kind: "admin" },
      status: "published",
    });
    check("admin can publish it", adminPublish === 1);

    /**
     * The regression this fix could plausibly cause: an agency saving a typo
     * fix on a PUBLISHED listing. `published` is not a status they may move
     * to, so without maySetStatus()'s keep-current allowance the save would be
     * rejected outright or would quietly unpublish the row.
     *
     * Asserted through updateListing (the real edit path) rather than a
     * same-status setPanelListingStatus call, because an UPDATE that changes
     * nothing reports 0 affected rows and would prove nothing either way.
     */
    const editPublished = await updateListing({
      id: agencyRows[0].id,
      scope: agencyScope,
      input: {
        title: "Verify agency listing (edited)",
        descriptionEs: null,
        operation: "venta",
        propertyType: "villa",
        priceEur: 285000,
        bedrooms: null,
        bathrooms: null,
        parking: null,
        builtM2: null,
        plotM2: null,
        locationId,
        videoUrl: null,
        energyRating: "D",
        status: "published",
      },
    });
    check("agency can edit a published listing without unpublishing it", editPublished === 1);

    const [afterEdit] = await db
      .select({ status: listings.status })
      .from(listings)
      .where(eq(listings.id, agencyRows[0].id))
      .limit(1);
    check("...and it is still published", afterEdit?.status === "published");

    check(
      "agency cannot load the independent's listing for editing",
      (await getEditableListing(ownerRows[0].id, agencyScope)) === null,
    );
    check(
      "admin scope can load any listing",
      (await getEditableListing(ownerRows[0].id, { kind: "admin" })) !== null,
    );

    /* ---------------------------------------------------------------- */
    /* FSBO owner inbox — the `owner` lead lane (PLAN.md D8)            */
    /* ---------------------------------------------------------------- */
    /**
     * Before the lane existed, a lead on a self-published listing was written
     * as `internal` — the same lane as valuation and seller leads — so the
     * person waiting for it could not be shown it without also showing them
     * the founder's inbox. These assert both halves: the owner sees their own
     * `owner` lead, and `internal` still belongs to nobody's panel.
     */
    await db.insert(leads).values([
      {
        leadType: "buyer",
        vertical: "verify",
        listingId: ownerRows[0].id,
        email: `buyer-${stamp}@verify.test`,
        name: "Verify buyer lead",
        routedTo: "owner",
      },
      {
        leadType: "valuation",
        vertical: "verify",
        listingId: ownerRows[0].id,
        email: `internal-${stamp}@verify.test`,
        name: "Verify internal lead",
        routedTo: "internal",
      },
    ]);

    const ownerInbox = await getPanelLeads(ownerScope);
    check(
      "owner sees the lead routed to them",
      ownerInbox.some((l) => l.name === "Verify buyer lead"),
      `${ownerInbox.length} lead(s) in the owner inbox`,
    );
    check(
      "an internal lead stays out of the owner's inbox",
      !ownerInbox.some((l) => l.name === "Verify internal lead"),
    );
    check(
      "the agency cannot see the owner's leads",
      (await getPanelLeads(agencyScope)).every(
        (l) => l.name !== "Verify buyer lead",
      ),
    );

    /* ---------------------------------------------------------------- */
    /* Profile editing                                                  */
    /* ---------------------------------------------------------------- */
    const slugBefore = agencyRow!.slug;
    await updateAgencyProfile(agencyId, {
      name: "Verify Renamed",
      logoUrl: "https://example.test/logo.png",
      phone: "0981000000",
      email: "hola@example.test",
    });
    const renamed = await getAgencyProfile(agencyId);
    check("agency rename applies", renamed?.name === "Verify Renamed");
    check(
      "agency slug is never rewritten on rename",
      renamed?.slug === slugBefore,
      `${slugBefore} -> ${renamed?.slug}`,
    );

    await updateAgencyProfile(agencyId, {
      name: "Verify Renamed",
      logoUrl: "",
      phone: "",
      email: "",
    });
    check(
      "cleared field becomes NULL",
      (await getAgencyProfile(agencyId))?.logoUrl === null,
    );
    check(
      "empty agency name refused",
      (await updateAgencyProfile(agencyId, {
        name: " ",
        logoUrl: "",
        phone: "",
        email: "",
      })) === false,
    );

    await updateOwnAgentProfile(independent.userId, {
      name: "Verify Independent Renamed",
      photoUrl: "https://example.test/a.jpg",
      phone: "0982000000",
    });
    check(
      "own agent profile updates",
      (await getOwnAgentProfile(independent.userId))?.name ===
        "Verify Independent Renamed",
    );
    check(
      "another user's agent profile is untouched",
      (await getOwnAgentProfile(agencyOwner.userId))?.name ===
        "Verify Agency Owner",
    );

    const collision = await updateOwnAccount(independent.userId, {
      name: "Verify Independent",
      email: ownerUser.email!,
      password: "",
      currentPassword: "secreto123",
    });
    check(
      "account email collision refused",
      !collision.ok && collision.error === "email_taken",
    );

    // Audit F21: a session alone must not be enough to move the credentials.
    const noReauth = await updateOwnAccount(independent.userId, {
      name: "Verify Independent",
      email: indepUser.email!,
      password: "otraclave1",
      currentPassword: "",
    });
    check(
      "password change without current password refused",
      !noReauth.ok && noReauth.error === "bad_password",
    );
    const wrongReauth = await updateOwnAccount(independent.userId, {
      name: "Verify Independent",
      email: mail("moved"),
      password: "",
      currentPassword: "no-es-la-clave",
    });
    check(
      "email change with wrong current password refused",
      !wrongReauth.ok && wrongReauth.error === "bad_password",
    );
    const renameOnly = await updateOwnAccount(independent.userId, {
      name: "Verify Independent",
      email: indepUser.email!,
      password: "",
      currentPassword: "",
    });
    check(
      "renaming alone needs no re-auth",
      renameOnly.ok && !renameOnly.passwordChanged,
    );

    await db.insert(sessions).values([
      {
        id: `verify-indep-${stamp}`,
        userId: independent.userId,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
      {
        id: `verify-owner-${stamp}`,
        userId: agencyOwner.userId,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    ]);

    const changed = await updateOwnAccount(independent.userId, {
      name: "Verify Independent",
      email: indepUser.email!,
      password: "nuevaclave1",
      currentPassword: "secreto123",
    });
    check("password change reported", changed.ok && changed.passwordChanged);

    const remaining = await db.select().from(sessions);
    check(
      "password change revokes that user's sessions",
      !remaining.some((s) => s.userId === independent.userId),
    );
    check(
      "another user's session survives",
      remaining.some((s) => s.userId === agencyOwner.userId),
    );

    const [afterPw] = await db
      .select()
      .from(users)
      .where(eq(users.id, independent.userId));
    check(
      "new password verifies",
      await verifyPassword("nuevaclave1", afterPw.passwordHash),
    );
    check(
      "old password stops working",
      !(await verifyPassword("secreto123", afterPw.passwordHash)),
    );
  } finally {
    // Clean up in FK order: leads before the listings they point at, listings
    // and sessions before the rows those point at.
    if (createdListingIds.length) {
      await db.delete(leads).where(inArray(leads.listingId, createdListingIds));
    }
    if (createdListingIds.length) {
      await db.delete(listings).where(inArray(listings.id, createdListingIds));
    }
    if (createdUserIds.length) {
      await db.delete(sessions).where(inArray(sessions.userId, createdUserIds));
      await db.delete(agents).where(inArray(agents.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    if (createdAgencyIds.length) {
      await db.delete(agencies).where(inArray(agencies.id, createdAgencyIds));
    }
  }

  console.log(
    failures === 0
      ? "\nAll scope and profile checks passed."
      : `\n${failures} check(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
