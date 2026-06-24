# ADR-0006: Single shared family vault (no per-user data scoping)

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

Every record shares one Cosmos partition key, so the vault is effectively a
single shared store. The backlog (`AC-3`) raised whether to partition data
per authenticated user once Entra tokens are validated (AC-1/AC-2), which would
let "family member" mean less than "all-or-nothing" access.

## Decision

Keep the **single shared family vault**. Nothing is hidden between family
members by design, so per-user data scoping adds complexity (partitioning,
migration, access rules, sharing UX) for no benefit to this household. `AC-3`
is marked **not planned**.

Authentication still applies: Entra validates *who* may reach the vault
(AC-1/AC-2); it just does not subdivide *what* they see.

## Consequences

- Simpler data model, queries, and backups — one logical vault.
- If selective sharing is ever wanted, it returns as a *feature* (`FE-10`),
  built deliberately on top of this, rather than as default partitioning.
- This is hard to reverse cleanly once more data accumulates, hence the record.
