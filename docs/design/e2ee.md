# Design: Client-Side (Zero-Knowledge) Encryption

Status: **Proposal** · Backlog ref: `OFF-4` (enabler for `OFF-2`/`OFF-3`, `FE-3`/`FE-4`) ·
Related: `CR-2` (AES-GCM), `MIG-1` (versioned format), `MIG-2` (re-encrypt), `UI-2` (auto-lock)

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
need (AES-GCM, PBKDF2, HKDF). A validated proof-of-concept round-trip (encrypt, decrypt,
tamper-rejection, wrong-password-rejection, non-ASCII) is ~40 lines:

```js
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();

// Derive a NON-EXTRACTABLE AES-GCM key from the family master password.
async function deriveKey(masterPassword, salt, iterations = 600_000) {
  const baseKey = await subtle.importKey(
    'raw', enc.encode(masterPassword), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,                       // extractable:false — script can never read raw key
    ['encrypt', 'decrypt']);
}

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

PBKDF2 at 600k iterations derived a key in ~117 ms on a dev machine — fast enough that
unlock feels instant while still being expensive to brute-force.

## 4. Key management

- **Source of the key:** a **master password** set by the family (the classic
  Bitwarden/1Password model). It is *not* the Entra password and is never sent anywhere.
- **Derivation:** PBKDF2-SHA-256, ≥ 600,000 iterations (OWASP 2023 floor).
  Optionally upgrade to **Argon2id** (via a vetted WASM build) for stronger
  memory-hardness; the format carries the algorithm + parameters so this can change later.
- **Salt:** a random 16-byte salt generated once per vault/user, stored server-side
  alongside the data (salts are not secret). Returned to the client at unlock so it can
  re-derive the same key.
- **Storage of the derived key:** **in memory only**, as a non-extractable `CryptoKey`.
  Never `localStorage`/`sessionStorage`, never a cookie.
- **Auto-lock (`UI-2`):** clear the key on idle timeout, tab close, and explicit lock.
  Re-derivation requires re-entering the master password.
- **Verification:** store a small encrypted "verifier" token (e.g. a known constant) so
  a wrong master password is detected immediately on unlock rather than on first decrypt.

### Master-password recovery
Zero-knowledge means **if the master password is lost, the data is unrecoverable.** For a
family tool this must be addressed explicitly. Options (pick one, document it):
1. **Printed recovery key** kept offline (recommended; simplest).
2. **Encrypt the vault key to a second recovery key/passphrase** held by a trusted family member.
3. Accept the risk + maintain the existing backup/export path (`FE-12`).

## 5. Storage format (versioned)

Ciphertext blobs are self-describing so legacy and new entries coexist during migration
(this is `MIG-1`). Proposed string layout:

```
v2.gcm.<kdf>.<iterations>.<saltB64>.<ivB64>.<ciphertext+tagB64>
   |    |     |            |          |        ciphertext = AES-GCM output (includes auth tag)
   |    |     |            |          random 96-bit IV, per entry
   |    |     |            KDF iteration count (lets us raise cost later)
   |    |     kdf id: "pbkdf2" | "argon2id"
   |    cipher: "gcm"
   format version
```

- **`v1`** = the legacy `hmac:ciphertext` (server-side AES-CBC) format. The decrypt path
  picks the handler by prefix.
- The salt can be stored once per vault rather than per entry; it is included in the
  per-entry layout above for clarity — final placement is an implementation choice.

## 6. Migration from the current vault (`MIG-2`)

The server cannot re-encrypt under a client-only key, so migration is a **client-driven,
one-time transitional pass**:

1. User upgrades and sets a master password → client derives the key, stores the salt +
   verifier server-side.
2. For each legacy (`v1`) entry: the server decrypts it as it does today and returns the
   plaintext over TLS (same exposure as the current app).
3. The **client** re-encrypts the plaintext under the master-password key and writes back a
   `v2` blob.
4. Once every entry is `v2`, retire the server-side AES key from Key Vault. From then on the
   server holds nothing decryptable.

Guardrails: take a Cosmos snapshot + verify a full round-trip decrypt **before** migrating
(`MIG-3`), and run the pass idempotently so it can resume. Surface any entry that fails to
decrypt (e.g. `CR-1`-corrupted non-ASCII) for manual re-entry rather than carrying it forward.

## 7. Residual risk: XSS (must-read)

Client-side E2EE is only as strong as the page's XSS posture: an attacker who can run
script in the SPA while it is **unlocked** can read the in-memory key or plaintext. No
cryptography prevents this. Required mitigations shipped *with* this feature:

- A strict **Content-Security-Policy** (no inline scripts, locked-down `connect-src`).
- **Dependency hygiene** — this matters more now; finishing the Vue 3 migration and pruning
  legacy deps (`UI-4`) reduces the supply-chain surface.
- No `innerHTML`/`v-html` with untrusted data; avoid rendering secrets into the DOM longer
  than necessary; clear clipboard (`UI-1`) and auto-lock (`UI-2`).

This is still strictly better than today, where a single key decrypts the entire vault
server-side.

## 8. Impact / blast radius

| Layer | Change |
|-------|--------|
| API (`passwordapp.api`) | Stop decrypting on read; return ciphertext. Keep a temporary server-side decrypt path *only* for the migration pass, then remove. Add storage for per-vault salt + verifier. |
| Crypto (`Encryption.cs`) | Legacy `v1` decrypt retained for migration; new writes are client-side. Server-side `Encryptor` eventually deleted. |
| Data format | New `v2` versioned blob; `MIG-1` versioning is a prerequisite. |
| UI (`passwordapp.ui`) | New crypto module (Web Crypto), master-password **unlock screen**, in-memory key state, auto-lock, client-side encrypt on create/update and decrypt on read. |
| Infra (`infrastructure`) | After migration, remove the AES key/IV Key Vault secrets and the Function App's access to them. |
| Docs / ops | Document master-password + recovery model; update `entra.md`/`deploy.md`. |

## 9. Open questions for regroup

1. **Master password** vs. deriving a key from the Entra session — master password is more
   standard and truly zero-knowledge; confirm the family is OK entering one to unlock.
2. **Recovery strategy** (§4) — which option?
3. **KDF** — PBKDF2 (zero-dependency, built in) now, with a path to Argon2id later?
4. **Scope** — ship E2EE for the whole vault at once, or behind a feature flag for a single
   test user first?
5. **Offline** — is `OFF-2` (offline read) actually wanted, or is E2EE valuable on its own?

## 10. Recommended sequence

`MIG-1` (versioned format) → `CR-2` (AES-GCM server-side, shared format) →
client crypto module + unlock UI (`OFF-4`) → `MIG-2`/`MIG-3` (migrate + verify) →
retire server key → optional `OFF-2` (offline read), `UI-1`/`UI-2` (clipboard/auto-lock),
`FE-3`/`FE-4` (now-safe breach/reuse checks).
