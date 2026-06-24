# Password Vault — Improvement Backlog

> Context: this is a self-hosted password vault used by one family. The goal is
> **"secure and maintainable, with a clean migration path from the current data"** —
> not NSA-proof. Items are prioritized for real-world family risk, with effort
> estimates (S = hours, M = a day or two, L = several days). Nothing here is
> meant as criticism of the original — it has served its purpose; this is the
> punch list to take it to the next level.

Legend — Priority: **P0** do first / **P1** soon / **P2** nice-to-have / **P3** polish.

---

## Theme 1 — Cryptography correctness (data integrity)

These protect the actual passwords. Two are genuine "you can silently lose or
weaken data" bugs, so they come first.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| CR-1 | **P0** | S | **Fix ASCII vs UTF-8 mismatch.** `Encryption.cs:29` encrypts with `Encoding.ASCII` but `:85` decrypts with UTF-8. Any password with `é`, `£`, emoji, etc. is silently corrupted to `?` and **unrecoverable**. Switch both sides to UTF-8. *Note: existing entries with non-ASCII chars are already lost — see MIG-1.* |
| CR-2 | **P1** | M | **Adopt authenticated encryption (AES-GCM).** Replace the hand-rolled AES-CBC + Encrypt-and-MAC with `AesGcm` (random 96-bit nonce per entry, auth tag verified before decrypt). Removes the padding-oracle shape and the plaintext-equality fingerprint in one move. |
| CR-3 | **P1** | S | **Stop MAC-ing the plaintext.** `Encryption.cs:30,81` computes `HMAC(key, plaintext)` and stores it, so identical passwords get identical tags (leaks "these two accounts share a password"). Folded into CR-2 if AES-GCM is adopted; otherwise switch to Encrypt-then-MAC over ciphertext. |
| CR-4 | P2 | S | **Per-entry random IV/nonce.** Today a single static IV from env is reused (mostly mitigated by the random salt block, hence not P0). AES-GCM (CR-2) makes this automatic. |
| CR-5 | P2 | S | **Key separation / KDF.** The same raw key feeds both AES and HMAC. Derive subkeys via HKDF from one master secret (moot if CR-2 lands, since GCM uses one key). |
| CR-6 | P3 | S | **Tidy `Encryptor`.** Drop `static` fields (`_key/_iv/_size`), make it instance state, and treat key bytes carefully. Correctness/clarity only. |

## Theme 2 — Access control & secrets

The biggest *practical* exposure: the API trusts a shared key, and that key is
shipped to the browser.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| AC-1 | **P0** | M | **Validate the Entra ID token in the API.** Every endpoint is `AuthorizationLevel.Function` only; the SPA's login is cosmetic to the backend. Anyone with the function key has full read/decrypt access. Validate the bearer token (issuer/audience/`oid`) in each function and reject unauthenticated calls. |
| AC-2 | **P0** | S | **Stop shipping the function key to the browser.** `ui/.env` `VUE_APP_API_KEY` is injected as `x-functions-key` (`main.js:40-45`), so every user has the master key. Once AC-1 is in place, remove it and rely on the user's token. |
| AC-3 | P2 | M | **Scope data to the authenticated user.** All records share one env partition key, so "family member" = "all-or-nothing". Optionally partition per user (or per shared-vault) once tokens are validated. Decide if shared-vault is actually desired (it may be!). |
| AC-4 | P1 | S | **Remove sensitive log line.** `PostPassword.cs:40` logs the encrypted blob + plaintext-HMAC fingerprint into App Insights. Log only `id`. |

## Theme 3 — Migration from the existing vault (explicitly requested)

You want to move existing data onto the improved scheme without losing it.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| MIG-1 | **P0** | M | **Versioned ciphertext format.** Stored blobs are `hmac:ciphertext` with no version marker (`PasswordEntity.cs`). Add a prefix (e.g. `v2.gcm.<nonce>.<tag>.<ct>`) so old and new entries can coexist and decrypt picks the right path. Prerequisite for any crypto change. |
| MIG-2 | **P0** | M | **One-time re-encryption migration.** Write a small idempotent job (reuse `scripts/decrypt-backup.py` patterns) that reads each Cosmos record, decrypts with the legacy path, re-encrypts with AES-GCM, and writes back tagged `v2`. Dry-run + backup first. |
| MIG-3 | P1 | S | **Pre-migration backup + verify.** Snapshot the Cosmos container and verify a round-trip decrypt of every entry *before* migrating, so CR-1's already-corrupted entries are identified (not silently re-saved). |

## Theme 4 — Front-end UX & safety

Quality-of-life and "don't leave secrets lying around" items for a family tool.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| UI-1 | P1 | S | **Auto-clear clipboard.** `home.js:86-103` copies passwords with no timed clear. Clear after ~30s. |
| UI-2 | P2 | S | **Auto-lock / re-auth timeout.** No idle lockout after revealing secrets. Add a session timeout that clears in-memory plaintext and requires re-auth. |
| UI-3 | P2 | M | **Fix MSAL bootstrap + token storage.** `AzureAD.Authentication.js` admits it "does not handle initial page load properly" and caches tokens in `localStorage` (XSS-reachable). Fix the redirect-promise flow; consider `sessionStorage`. |
| UI-4 | P3 | M | **Exit Vue 2 compat mode.** App runs Vue 3 in `@vue/compat` with `bootstrap-vue`. Finish the Vue 3 migration and replace EOL deps. Pure maintenance. |
| UI-5 | P3 | S | **Password generator + strength meter.** Feature request: generate strong passwords on create/update. |

## Theme 5 — Infrastructure hardening

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| IN-1 | P2 | S | **Key Vault purge protection.** `keyvault.tf:7-9` has `purge_protection_enabled = false`; enable it so key/connection-string secrets survive accidental purge. |
| IN-2 | P2 | M | **Cosmos + Functions via Managed Identity/RBAC** instead of connection-string/function keys (`cosmosdb.tf`, `functions.tf`). |
| IN-3 | P3 | M | **Restrict public network access.** `functions.tf` runs `public_network_access_enabled = true`. Consider IP allow-list or Private Endpoint (weigh against family-from-anywhere convenience). |
| IN-4 | P3 | S | **Remote Terraform state.** Backend is commented out in `providers.tf` (local state). Move to a remote backend. |
| IN-5 | P3 | S | **Confirm SWA auth enforcement.** `staticwebapp.tf` defines no auth; enforcement currently relies on client routing. |

## Theme 6 — Engineering hygiene

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| EN-1 | **P1** | S | **Resolve `.gitignore` merge conflict.** Lines ~330/375 still contain `<<<<<<< HEAD` / `=======` markers, so ignore rules below them are unreliable. |
| EN-2 | P1 | M | **Add automated tests.** No unit tests exist (only manual `scripts/test-*.ps1`). Start with round-trip crypto tests (covers CR-1/CR-2 regressions) and the migration job. |
| EN-3 | P2 | M | **Add CI.** No `.github/workflows`. Add build + test + (optionally) deploy on PR. |
| EN-4 | P3 | S | **Meaningful commit messages.** Recent history is emoji-only; low signal for future debugging. |

---

## Suggested sequencing (a kind, realistic path)

1. **Stop the bleeding (P0, ~2–3 days):** CR-1 (UTF-8), MIG-1 + MIG-3 (versioning + backup/verify), AC-1 + AC-2 (real auth, drop browser key).
2. **Strengthen the core (P1):** CR-2/CR-3 (AES-GCM) → MIG-2 (re-encrypt), AC-4 (log scrub), EN-1/EN-2 (gitignore + crypto tests), UI-1 (clipboard clear).
3. **Harden & modernize (P2):** AC-3, UI-2/UI-3, IN-1/IN-2, EN-3.
4. **Polish (P3):** UI-4/UI-5, IN-3/IN-4/IN-5, CR-6, EN-4.

> Do CR-1 and MIG-3 *together first*: fix the UTF-8 bug, then run a verify pass so
> any already-corrupted non-ASCII passwords are surfaced and re-entered by hand
> rather than carried forward into the new scheme.
