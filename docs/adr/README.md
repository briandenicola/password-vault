# Architecture Decision Records

Short records of decisions that are hard to reverse or worth not re-litigating.
One decision per file. Keep each to a page. Format follows
[Michael Nygard's ADR template](https://github.com/joelparkerhenderson/architecture-decision-record).

## How to add one

1. Copy [`0000-template.md`](0000-template.md) to the next number + a short slug.
2. Fill in Context / Decision / Consequences. Be brief.
3. Set **Status** (`Proposed` → `Accepted`; later `Superseded by ADR-XXXX`).
4. Link it from the relevant `BACKLOG.md` row if applicable.

## Index

| # | Title | Status |
|---|-------|--------|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-target-dotnet-10.md) | Target .NET 10 for the API | Accepted |
| [0003](0003-versioned-aes-gcm-envelope.md) | Versioned AES-GCM secret envelope | Accepted |
| [0004](0004-primevue-ui.md) | PrimeVue v4 for the UI (exit Vue 2 compat) | Accepted |
| [0005](0005-entra-server-side-auth.md) | Server-side Entra token validation (flag-gated) | Accepted |
| [0006](0006-single-shared-family-vault.md) | Single shared family vault (no per-user scoping) | Accepted |
| [0007](0007-oidc-cd-remote-state.md) | OIDC-only CD with remote Terraform state | Accepted |
| [0008](0008-client-side-e2ee-passkey-prf.md) | Client-side E2EE via WebAuthn passkey PRF | Accepted (design) |
