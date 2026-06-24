# Password Vault — Constitution

The short, durable rules for this project. Keep it small. If a rule needs a
paragraph of justification, it belongs in an [ADR](adr/), not here.

> Context: a self-hosted password vault used by **one family**. Goal: *secure and
> maintainable, with a clean migration path from existing data* — not NSA-proof.

## Principles

1. **Protect the data first.** Correctness and recoverability of stored secrets
   beat every feature. Crypto changes must keep existing data readable and offer
   a migration path (see [ADR-0003](adr/0003-versioned-aes-gcm-envelope.md)).
2. **No hopeful patches.** A fix isn't done until the exact failing path has a
   regression test and has been validated. UI changes get a real-browser smoke
   pass, not just node unit tests.
3. **Secure by default, simple to use.** Favor safe defaults (auth on, short
   clipboard/idle timeouts) over options that require the family to be experts.
4. **Right-sized security.** Mitigate realistic family-scale risks (device theft,
   shoulder-surfing, breach reuse). Don't add complexity to resist nation-states.
5. **Migrate, don't break.** Prefer additive, versioned changes with a backout
   path over flag-day rewrites. Stage risky cutovers behind a flag.
6. **Keep dependencies current and lean.** Stay on supported majors (.NET 10,
   Vue 3 + PrimeVue v4, MSAL v5). Remove dead/EOL deps rather than pinning them.
7. **Decisions are written down.** Any choice that's hard to reverse, or that a
   future contributor would otherwise re-litigate, gets a one-page ADR.

## Working agreements

- **Branch:** feature work lands on `improvements/*` branches via PR; the
  `main` line stays releasable. Don't rewrite shared history.
- **Tests/build:** API — `dotnet test` in `src/passwordapp.api.tests`; UI —
  `npm run test:unit` (Vitest) in `src/passwordapp.ui`. CI gates both. Run the
  smallest targeted check that covers the change before committing.
- **Commits:** clear, imperative messages; include the
  `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer.
- **Secrets:** never commit secrets. `.env` is gitignored; rotate anything that
  leaks into history.
- **The backlog is the plan.** [`BACKLOG.md`](BACKLOG.md) is the single source of
  truth for what's done and what's next.

## Amending

This document and ADRs are living. To change a principle, open a PR that edits
this file (and supersede any affected ADR). Keep it concise — brevity is a feature.
