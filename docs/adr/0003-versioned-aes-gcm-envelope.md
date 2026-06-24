# ADR-0003: Versioned AES-GCM secret envelope

- **Status:** Accepted
- **Date:** 2026-06-24

## Context

The original storage encrypted passwords with **AES-CBC** plus a separate HMAC,
using a static IV and an ASCII/UTF-8 mismatch that silently corrupted non-ASCII
secrets. There was no authenticated encryption and identical passwords produced
identical ciphertext. We must fix this **without losing the family's existing
data**, which is already stored in the legacy format.

## Decision

Adopt a **versioned ciphertext envelope** (`Common/SecretEnvelope.cs`):

- **v1 (legacy):** `hmac:ciphertext` (AES-CBC) — still *readable* for migration.
- **v2 (current):** `v2.gcm.<iv>.<ct+tag>` — **AES-GCM** with a random 96-bit
  nonce per entry; the GCM key is **HKDF-SHA256-derived** from the configured key
  (`info="passwordvault:v2:gcm"`) so it never shares material with legacy usage.

`Encryptor.DecryptStored` routes by version; all new writes are v2. A standalone
[`vault-migrate`](../../src/passwordapp.tools/README.md) tool backs up, verifies,
and re-encrypts v1→v2 (dry-run by default).

## Consequences

- Tamper-evident, non-deterministic encryption going forward.
- Legacy data keeps working until migrated; migration is explicit and reversible
  (always backs up first).
- Two code paths (v1 read, v2 read/write) until all data is migrated, then v1 can
  be retired.
- Any entries with non-ASCII chars written under the old ASCII bug are already
  corrupted and unrecoverable (pre-existing data loss).
