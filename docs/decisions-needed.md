# Decisions needed

Questions an agent stopped on rather than guessed at (`AGENTS.md` §6). One
bullet each: what was being built, what the choice is, and what is blocked
until the founder answers. Delete a bullet once the answer is recorded in
`PLAN.md` or `CLAUDE.md`.

- **Phase 6 deploy (2026-09-15).** Built: nothing new — this was a
  verification-and-handoff session. Choice needed: none, actually blocked —
  this cloud session's network egress is a hard HTTPS allowlist proxy; a raw
  TCP connection to Hostinger's MySQL (`srv2067.hstgr.io:3306` or its IP)
  fails instantly regardless of Remote MySQL IP allowlisting, and there is no
  hPanel/SSH/DNS access from this environment at all. So even though Anton
  shared a full-privilege Hostinger DB credential
  (`u556710939_spanienanton`@`u556710939_spanien`) in this session, it could
  not be used — both because AGENTS.md §2/§3 forbid an agent holding
  `DATABASE_URL_RW` or running `db:migrate` against production, and because
  the connection is technically impossible from here either way. Blocked
  until Anton runs `db:migrate`/`db:status`/`seed:locations`/`seed:costs`
  himself (exact commands in the Phase 6 closing report) and does the
  hPanel app creation, DNS mapping, SMTP mailbox creation, and cron
  registration — none of which any Claude Code cloud session can do without
  hPanel GUI or SSH access. **Rotate that MySQL password** since it was
  pasted into a chat transcript, once no longer needed for the initial setup.

- **Plan for the best Spanish-property site for Swedes (2026-09-23).** Built:
  `docs/plan-best-portal-2026-09.md` — a gap analysis against propia.node since
  the 2026-08-27 copy, plus a seven-phase plan. Choices needed: F1–F7 in that
  file's §6 (agency business model, Swedish profile-route slugs, a modelo 210
  estimate, what "verified" means, who reviews tax copy, reviews, area facts).
  Blocked until answered: Phase 5 scope (F1, F4), the profile-route renames in
  Phase 2 (F2), and the cost panel's tax line and the tax guides in Phase 4 (F3, F5).
