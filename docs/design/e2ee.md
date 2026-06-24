# Design: Client-Side (Zero-Knowledge) Encryption

Status: **Accepted — implementation in progress** ([ADR-0008](../adr/0008-client-side-e2ee-passkey-prf.md)) ·
Backlog ref: `OFF-4` (enabler for `OFF-2`/`OFF-3`, `FE-3`/`FE-4`) ·
Related: `CR-2` (AES-GCM), `MIG-1` (versioned format), `MIG-2` (re-encrypt), `UI-2` (auto-lock)

**Decisions (2026-06-24):** unlock is **password-free**. The vault key is derived from a
**WebAuthn passkey via the PRF extension** (no master password to type, biometric unlock,
truly zero-knowledge). Entra ID continues to handle sign-in/identity; the *encryption*
passkey is treated as a synced platform passkey or security key (see §4 for why).

## 1. Goal & motivation

Move encryption/decryption of vault secrets from the **server** to the **browser** so
that the server (and Azure) never sees plaintext passwords *or* the encryption key.
Today the API decrypts server-side and relies on TLS as the only thing protecting the
plaintext in transit; the AES key lives in Key Vault and the Function App can read every
secret. The goal is a **zero-knowledge** model where TLS is defense-in-depth, not the
sole protection.

This is the right long-term shape for a password manager and is the enabler for safe
offline access (`OFF-2`) and privacy-preserving features like breach/reuse checks
(`FE-3`/`FE-4`). As a bonus it eliminates the ASCII-corruption bug (`CR-1`), because the
browser encrypts UTF-8 bytes end to end.

### Non-goals
- Not trying to defend against a compromised browser/XSS at the moment of unlock (see §7).
- Not NSA-grade. This is a family tool: well-understood primitives, no exotic crypto.

## 2. Threat model (what changes)

| Adversary | Today (server-side decrypt) | With E2EE |
|-----------|-----------------------------|-----------|
| Network eavesdropper | Protected by TLS only | TLS **+** ciphertext is useless without the key |
| Compromised API / Function App | Can read all plaintext (has the key) | Sees only ciphertext; cannot decrypt |
| Compromised Cosmos / Azure storage | Encrypted at rest, but key is reachable | Ciphertext only; key never stored server-side |
| Stolen function key | Full read/decrypt of vault | Read of **ciphertext** only |
| XSS in the SPA while unlocked | Can exfiltrate plaintext from responses | Can exfiltrate plaintext/key from memory — **still a risk** (see §7) |

Net: every server-side and at-rest exposure is meaningfully reduced. XSS remains the
primary residual risk and must be controlled with CSP + dependency hygiene.

## 3. Core primitive: Web Crypto (`crypto.subtle`)

Use the **browser-native Web Crypto API** — not a third-party JS crypto library and not
hand-rolled code. It is native, audited, and constant-time, and supports everything we
need (AES-GCM, HKDF, AES-KW key-wrapping). The **symmetric layer** (AES-GCM encrypt /
decrypt of each secret) is validated by a proof-of-concept round-trip (encrypt, decrypt,
tamper-rejection, wrong-key-rejection, non-ASCII) and is independent of how the key is
obtained:

```js
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();

// Encrypt one secret: random 96-bit IV per entry; GCM provides integrity.
async function encryptSecret(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return { iv, ct };
}

// Decrypt: GCM verifies the auth tag and throws on tamper or wrong key.
async function decryptSecret(key, iv, ct) {
  return dec.decode(await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
}
```

What changes vs. a master-password design is **only the source of the key**: instead of
deriving it from a typed password via PBKDF2, we obtain key material from a passkey's PRF
output (§4). The AES-GCM layer above is unchanged.

## 4. Key management — WebAuthn PRF + envelope (DEK/KEK)

We use an **envelope encryption** model so the vault works across multiple devices and
family members and supports recovery, without ever putting a key on the server.

- **Data Encryption Key (DEK):** one random 256-bit AES-GCM key that actually encrypts the
  vault entries. It is generated once, in the browser, and **never leaves the client in
  plaintext** and is **never sent to the server**.
- **Key Encryption Key (KEK) from passkey PRF:** during a WebAuthn assertion we request the
  `prf` extension with a fixed per-vault salt; the authenticator returns a deterministic
  32-byte secret (`same passkey + same salt ⇒ same secret`). We `HKDF` that into an
  AES-KW/AES-GCM **KEK** (non-extractable `CryptoKey`).
- **Wrapped DEK stored server-side:** for each enrolled passkey we store
  `wrap(KEK, DEK)` (an opaque blob). The server holds only **wrapped** DEKs and never the
  KEK or the plaintext DEK — this is what keeps the model zero-knowledge.
- **Unlock flow:** sign in with Entra → `navigator.credentials.get({ publicKey: { extensions: { prf: { eval: { first: vaultSalt } } } } })` → PRF secret → HKDF → KEK → unwrap the DEK → DEK lives in memory as a non-extractable key.
- **Storage of the DEK:** **in memory only**, non-extractable. Never `localStorage`/
  `sessionStorage`/cookie.
- **Auto-lock (`UI-2`):** drop the in-memory DEK on idle timeout, tab close, and explicit
  lock; re-unlock requires another passkey assertion (a quick biometric tap).
- **Salt:** the PRF input salt is per-vault, random, stored server-side (it is not secret).

### Why the encryption passkey is a platform passkey, not strictly "the Entra passkey"
PRF support depends on the authenticator + OS + browser. As of mid-2026:
- ✅ Strong: Chrome/Edge 128+, Safari 18+ with **iCloud Keychain**, Android with **Google
  Password Manager**, and modern FIDO2 security keys (YubiKey 5/Bio, etc.).
- ⚠️ New/uneven: **Windows Hello PRF only arrives in Windows 11 25H2+**; older Windows
  installs won't return PRF.
- ⚠️ **Entra-issued passkey + PRF is still maturing** and not guaranteed end-to-end.

Therefore: keep **Entra for sign-in/identity**, but enroll a **synced platform passkey or
security key** as the *encryption* credential so PRF is reliable. Feature-detect PRF at
enrollment and **require** a PRF-capable passkey to use the vault — a device that cannot do
PRF must enroll one (no degraded server-decrypt fallback after migration; see §9).

### Multi-device & multi-family-member
Because only the **DEK** encrypts data and each passkey just **wraps** its own copy of the
DEK, onboarding a new device or family member = authenticate an already-enrolled device,
unwrap the DEK, then `wrap(newKEK, DEK)` and store the new blob. No re-encryption of the
vault is needed. (Per-member access scoping is a separate concern — `AC-3`.)

### Recovery (critical — zero-knowledge means lost key = lost data)
Mitigations, layered:
1. **Multiple enrolled passkeys** (each family member's phone + laptop) — losing one device
   is survivable because another can still unwrap the DEK.
2. **Printed/offline recovery key:** generate a high-entropy recovery secret at setup, use it
   to `wrap(DEK)` as well, and have the family store it offline. Recommended belt-and-suspenders.
3. Keep the existing encrypted backup/export path (`FE-12`) as a last resort.

## 5. Storage format (versioned)

Two kinds of records, both versioned so legacy and new data coexist during migration
(`MIG-1`):

**A) Per-entry secret blob** — encrypted under the DEK (AES-GCM, no password KDF needed):

```
v2.gcm.<ivB64>.<ciphertext+tagB64>
   |    |       ciphertext = AES-GCM output (includes auth tag)
   |    random 96-bit IV, per entry
   cipher: "gcm"  (format version "v2")
```

**B) Vault key record** (one per vault) — holds the material needed to unlock:

```
{
  "prfSalt":  "<base64>",              // PRF input salt (not secret)
  "wrappedDeks": [                      // one per enrolled passkey / recovery key
    { "credentialId": "<id>", "label": "Brian-iPhone", "wrapped": "<base64>" },
    { "credentialId": "<id>", "label": "recovery-key",  "wrapped": "<base64>" }
  ]
}
```

- **`v1`** = the legacy `hmac:ciphertext` (server-side AES-CBC) format. The decrypt path
  picks the handler by prefix, so migration is incremental.
- The server stores only wrapped DEKs and the (non-secret) PRF salt — never the DEK or KEK.

## 6. Migration from the current vault (`MIG-2`)

The server cannot re-encrypt under a client-only key, so migration is a **client-driven,
one-time transitional pass**:

1. User signs in (Entra) and **enrolls a PRF-capable passkey** → client generates the random
   DEK, derives the KEK from the passkey's PRF output, and stores `wrap(KEK, DEK)` + the PRF
   salt server-side (the vault key record, §5B).
2. For each legacy (`v1`) entry: the server decrypts it as it does today and returns the
   plaintext over TLS (same exposure as the current app).
3. The **client** re-encrypts the plaintext under the **DEK** and writes back a `v2` blob.
4. Once every entry is `v2`, retire the server-side AES key from Key Vault. From then on the
   server holds nothing decryptable.

Guardrails: take a Cosmos snapshot + verify a full round-trip decrypt **before** migrating
(`MIG-3`), and run the pass idempotently so it can resume. Surface any entry that fails to
decrypt (e.g. `CR-1`-corrupted non-ASCII) for manual re-entry rather than carrying it forward.

## 7. Residual risk: XSS (must-read)

Client-side E2EE is only as strong as the page's XSS posture: an attacker who can run
script in the SPA while it is **unlocked** can read the in-memory DEK or plaintext. No
cryptography prevents this (the passkey makes key *theft at rest* irrelevant, but not
runtime exfiltration of an unlocked key). Required mitigations shipped *with* this feature:

- A strict **Content-Security-Policy** (no inline scripts, locked-down `connect-src`).
- **Dependency hygiene** — this matters more now; finishing the Vue 3 migration and pruning
  legacy deps (`UI-4`) reduces the supply-chain surface.
- No `innerHTML`/`v-html` with untrusted data; avoid rendering secrets into the DOM longer
  than necessary; clear clipboard (`UI-1`) and auto-lock (`UI-2`) to shrink the unlocked window.

This is still strictly better than today, where a single key decrypts the entire vault
server-side.

## 8. Impact / blast radius

> **Implementation status:** *Phase 1* (client crypto foundation,
> `ui/src/components/crypto/*`) and *Phase 2a* (server vault-key store) are
> shipped behind feature flags (UI `VUE_APP_E2EE`, API `E2EE_ENABLED`, both
> default off). The vault-key record (§5B) is served by `GET`/`PUT
> /api/vault-key` and stored opaquely in an isolated Cosmos container
> (`VaultKeys`) — the server cannot unwrap it. Still to do: Phase 2b in-memory
> DEK + auto-lock, Phase 2c passkey enrollment/unlock UI, then MIG-2/MIG-3.

| Layer | Change |
|-------|--------|
| API (`passwordapp.api`) | Stop decrypting on read; return ciphertext. Keep a temporary server-side decrypt path *only* for the migration pass, then remove. Add a vault-key record store (PRF salt + wrapped DEKs, §5B). |
| Crypto (`Encryption.cs`) | Legacy `v1` decrypt retained for migration; new writes are client-side. Server-side `Encryptor` eventually deleted. |
| Data format | New `v2` entry blob + vault-key record; `MIG-1` versioning is a prerequisite. |
| UI (`passwordapp.ui`) | New crypto module (Web Crypto), **passkey enrollment + PRF unlock** flow with feature-detection, in-memory DEK state, auto-lock, client-side encrypt on create/update and decrypt on read. |
| Infra (`infrastructure`) | After migration, remove the AES key/IV Key Vault secrets and the Function App's access to them. |
| Docs / ops | Document passkey enrollment + recovery model and the PRF device-support matrix; update `entra.md`/`deploy.md`. |

## 9. Decisions (resolved at regroup, 2026-06-24)

1. ~~Master password vs. Entra-derived~~ — **WebAuthn passkey PRF** (zero-knowledge,
   password-free).
2. **Recovery:** multiple enrolled passkeys **plus a printed/offline recovery key from day
   one** (the recovery key also wraps the DEK — §4). ✅
3. **Device fallback:** a device without PRF support **must enroll a PRF-capable passkey**
   (synced platform passkey or security key) to use the vault — no degraded server-decrypt
   mode after migration. ✅
4. **Rollout:** ship behind a **feature flag**, enabled for one device/user first, then the
   family. ✅
5. **Offline (`OFF-2`)** — still open; revisit after E2EE lands. E2EE is worthwhile on its own.

## 10. Recommended sequence

`MIG-1` (versioned format) → `CR-2` (AES-GCM server-side, shared format) →
PRF feature-detection spike → client crypto module + passkey enrollment/unlock UI (`OFF-4`) →
`MIG-2`/`MIG-3` (migrate + verify) → retire server key → optional `OFF-2` (offline read),
`UI-1`/`UI-2` (clipboard/auto-lock), `FE-3`/`FE-4` (now-safe breach/reuse checks).
