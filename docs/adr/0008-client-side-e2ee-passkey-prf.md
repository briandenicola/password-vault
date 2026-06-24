# ADR-0008: Client-side E2EE via WebAuthn passkey PRF

- **Status:** Accepted (design); implementation in progress (`OFF-4`)
- **Date:** 2026-06-24

## Context

Today the **server** decrypts vault secrets and TLS is the only thing
protecting plaintext in transit; the AES key lives in Key Vault and the Function
App can read every secret. The long-term goal (`OFF-4`) is a **zero-knowledge**
model where the server never sees plaintext or the key, which also unblocks safe
offline read (`OFF-2`) and privacy-preserving breach/reuse checks
(`FE-3`/`FE-4`). The full rationale, threat model, formats, and migration plan
live in [`../design/e2ee.md`](../design/e2ee.md).

## Decision

Adopt the design in `design/e2ee.md`:

- **Unlock is password-free**, derived from a **WebAuthn passkey via the PRF
  extension**. Entra still handles sign-in/identity; the passkey handles the
  *encryption* key.
- **Envelope model:** a random per-vault **DEK** encrypts each secret (AES-GCM,
  `v2.gcm.<iv>.<ct>`); the DEK is **wrapped once per enrolled passkey / recovery
  key** under a PRF-derived KEK (HKDF). All crypto uses Web Crypto
  (`crypto.subtle`) — no third-party crypto library.
- **Recovery from day one:** multiple enrolled passkeys **plus** a printed
  offline recovery key that also wraps the DEK.
- **Zero-knowledge storage:** the server stores only the (non-secret) PRF salt
  and wrapped DEKs (the §5B vault-key record) and never the DEK/KEK/plaintext.
- **Ship behind feature flags** (UI `VUE_APP_E2EE`, API `E2EE_ENABLED`, both
  default OFF), rolled out to one device first, then the family.

## Consequences

- Every server-side and at-rest exposure is meaningfully reduced; **XSS while
  unlocked** becomes the primary residual risk and must be controlled with CSP
  + dependency hygiene (`design/e2ee.md` §7).
- A device without PRF support must enroll a PRF-capable passkey — there is no
  degraded server-decrypt mode after migration.
- Requires a one-time **client-driven migration** (`MIG-2`/`MIG-3`) before the
  server AES key can be retired.
- **Progress:** Phase 1 (client crypto modules) and Phase 2a (server vault-key
  store) are shipped behind the flags; remaining: in-memory DEK + auto-lock,
  passkey enrollment/unlock UI, then migration and key retirement.
