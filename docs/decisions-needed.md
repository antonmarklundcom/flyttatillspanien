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
