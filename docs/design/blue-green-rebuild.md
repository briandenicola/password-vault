# Design: Blue-Green Rebuild & Migration (separate stack)

Status: **Proposal** · Backlog refs: `MIG-4` (import/transform), `MIG-5` (parity verify), `OFF-5` (cutover runbook) ·
Builds on: `OFF-4` (client-side E2EE, [`e2ee.md`](e2ee.md)), `MIG-2`/`MIG-3` (`vault-migrate`)

## 1. Goal

Stand up a **brand-new stack with its own datastore**, import the existing vault into
it, test the whole thing end-to-end without touching the live vault, then **switch the
URL**. The old stack stays running as an instant rollback.

This is a blue-green migration. The motivation is confidence: the family's live vault is
never modified during the build, and rollback is "point the URL back".

## 2. Why this over in-place

In-place (the `OFF-4` Phase 2 path) migrates the existing Cosmos container behind feature
flags — zero data movement, but you're mutating the live vault and rollback means undoing
flags. Blue-green trades a heavier transition (two stacks for a while) for a spotless
rollback and the ability to fully test a clean codebase before anyone depends on it.

For a **small dataset** (a family's accounts: dozens–low hundreds) the usual blue-green
tax — delta sync, dual-write — is unnecessary. A short write-freeze plus a *full*
re-import at cutover is simpler and good enough. See §5.

## 3. The data seam

The export already exists: `vault-migrate backup` writes every Cosmos document to JSON
(the format you see in the maintenance export). **It is ciphertext**, encrypted under the
old server AES key — `CurrentPassword` is the `v2.gcm` envelope, `OldPasswords[].EncryptedPassword`
is legacy v1 (`AES-CBC` + `HmacHash`). The file is therefore sensitive but not directly
readable without the key.

The export is transport only. The hard part is the **transform** (§4): decrypt with the
old key, re-encrypt under the new vault DEK, write the new schema.

## 4. Import / transform (`MIG-4`)

A one-shot tool (extend `vault-migrate` with an `import` subcommand, or a sibling) that:

1. Reads a `backup` JSON snapshot.
2. For each account + each historical password: **decrypts** with the old `Encryptor`
   (reuse `Common/Encryptor.DecryptStored` — no second crypto impl).
3. **Re-encrypts** the plaintext under the new vault **DEK** (the `OFF-4` envelope model),
   producing the new-schema document. The new store has **no** server-readable secret and
   **no** `HmacHash` (that was v1-only).
4. Writes to the **new** datastore.

The plaintext exists only in memory inside this trusted one-shot run; it is never written
to disk. Ideally the re-encrypt step runs where the DEK lives (client/trusted operator
context per `e2ee.md` §6), so the new server never sees plaintext either.

New-store schema: the E2EE-native shape from [`e2ee.md`](e2ee.md) §5 — DEK-encrypted
blobs plus the §5B vault-key-record (already built in `OFF-4` Phase 2a).

## 5. Cutover (`OFF-5`)

Because the dataset is tiny, skip delta-sync:

1. **Build & seed:** deploy the new stack; import a recent `backup`; test end-to-end
   (read every account, edit one, confirm auto-lock/unlock, PWA install).
2. **Freeze:** announce a short window ("don't add/change passwords for ~30 min").
3. **Final import:** run a fresh `backup` of the old vault → `import` into the new store
   (full re-import, not a delta).
4. **Verify parity** (`MIG-5`) before flipping — see §6.
5. **Flip the URL:** repoint the SWA custom domain / DNS to the new stack.
6. **Rollback window:** leave the old stack and old URL live for a few days. Rollback =
   repoint the URL back. Decommission the old stack once confident.

## 6. Parity verification (`MIG-5`)

Do **not** trust a hopeful import. Before cutover, prove every secret round-trips:

- Count parity: account count and per-account history count match old → new.
- Value parity: for every account and every historical entry,
  `decrypt_new(record) == decrypt_old(record)`. Any mismatch or undecryptable entry
  blocks the cutover and is reported (reuse the `vault-migrate verify` decrypt-check
  pattern, comparing across stores).
- Spot-check the known `CR-1`-mangled non-ASCII accounts by hand (those are unrecoverable
  legacy corruption, not import bugs — carry the caveat forward).

## 7. Security

- The `backup` JSON is **every secret in one file**. Treat as sensitive: gitignored,
  never emailed, deleted immediately after import.
- After import re-encrypts under the DEK and the old server AES key is retired, **no
  server-readable secret exists anywhere** — the whole point of `OFF-4`.
- The new stack's own datastore + identities + infra are provisioned via Terraform in the
  single `infrastructure/` directory (owner-managed; e.g. workspaces or a stack toggle),
  not click-ops, so it's reproducible and teardown is clean.

## 8. Testing OFF-4 (E2EE) on the parallel stack

The parallel deployment is the natural testbed for `OFF-4` Phase 2b/2c: flip the E2EE
flag **on in that stack only**, point it at the imported (re-encrypted) data, and exercise
the real unlock path on a real HTTPS origin without risking the live vault.

- **2b (in-memory DEK + auto-lock):** fully testable here, no caveats — pure client logic
  against real data (unlock → idle auto-lock → re-unlock).
- **2c (passkey enrollment + PRF unlock):** testable here for the flow, **but WebAuthn
  credentials are bound to the RP ID (domain)**. A passkey enrolled on a temporary host
  (`vault-next.example.com`) will **not** resolve after the URL flip to the production host
  — different RP ID.
  - **Clean fix:** set RP ID to the shared **registrable parent** (`example.com`) and host
    the parallel stack as a subdomain of it; the credential then works on both the temp and
    final hosts, surviving the flip.
  - **Fallback (fine at family scale):** re-enroll passkeys once after cutover. It is only a
    **re-wrap of the existing DEK** under the new passkey-derived KEK (data doesn't move),
    and the **recovery key** bridges the gap. The DEK is independent of the passkey.

Decide RP ID = final production registrable domain **before** anyone enrolls "for real",
or plan a one-time post-cutover re-enroll.

## 9. Non-goals / open questions

- **Not** dual-write or live delta sync — explicitly out of scope at family scale (§2).
- New datastore choice: same Cosmos (new account/container) keeps infra/tooling familiar;
  revisit only if there's a concrete reason to change engines.
- Whether the transform runs as an operator one-shot or via the client unlock flow
  (`e2ee.md` §6) depends on how `OFF-4` Phase 2c/2d land — decide then.
- WebAuthn RP ID must be chosen up front (§8) so passkeys survive the URL switch.
