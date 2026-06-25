# Password Vault — Improvement Backlog

> Context: this is a self-hosted password vault used by one family. The goal is
> **"secure and maintainable, with a clean migration path from the current data"** —
> not NSA-proof. Items are prioritized for real-world family risk, with effort
> estimates (S = hours, M = a day or two, L = several days). Nothing here is
> meant as criticism of the original — it has served its purpose; this is the
> punch list to take it to the next level.

Legend — Priority: **P0** do first / **P1** soon / **P2** nice-to-have / **P3** polish.

> **Progress (branch `improvements/security-and-features-backlog`):** Phase 0 started —
> ✅ `CR-1` (UTF-8 crypto fix + regression tests), ✅ `EN-1` (gitignore conflict),
> ✅ `EN-2` (xUnit test project), ✅ **.NET 10 upgrade** (API + devcontainer + docs),
> ✅ `EN-3`/`CD-1` (CI workflow), ✅ `MIG-1` (versioned ciphertext format),
> ✅ `CR-2`/`CR-3`/`CR-4`/`CR-5`/`CR-6` (AES-GCM `v2` writes + HKDF key separation + instance-state fix),
> ✅ `MIG-2`/`MIG-3` (`vault-migrate` tool: backup, verify, dry-run/apply re-encryption v1→v2),
> ✅ `FE-13` (password history UI), ✅ `AC-1` (server-side Entra token validation), ✅ `AC-2` (Anonymous triggers + fail-closed auth; browser function key dropped),
> ✅ `GE-1`/`GE-2`/`GE-3`/`GE-4`/`UI-5` (generator overhaul: options, exclude-ambiguous, passphrase mode, unbiased sampling + Vitest),
> ✅ `FE-15` (per-user settings page: generator + vault-list defaults, localStorage store),
> ✅ `UI-1`/`UI-2` (clipboard auto-clear + idle auto-lock, settings-driven),
> ✅ `UI-3`/`UI-6` (MSAL bootstrap rewrite + `@azure/msal-browser` v2→v5 upgrade),
> ✅ `UI-4` (PrimeVue v4 migration; removed `@vue/compat` + `bootstrap-vue`, now Vue 3-native),
> ✅ `FE-4` (reused/duplicate-password Security Audit page),
> ✅ `FE-1` (live password strength meter on create/update),
> ✅ `FE-2` (tags + search across account/site/notes/tags + tag filter),
> ✅ `FE-5` (password-age reminders: age label + stale "Old" badge, configurable threshold),
> ✅ `FE-6` (recycle bin: view + restore soft-deleted accounts),
> ✅ `FE-3` (HaveIBeenPwned breach check via k-anonymity; no secret leaves the client),
> ✅ `FE-8` (CSV import/export with header mapping for Bitwarden/Chrome/1Password).
> New writes are now AES-GCM; legacy `v1` still reads, and existing data can be migrated with `vault-migrate`.
> Design for `OFF-4` in [`design/e2ee.md`](design/e2ee.md); decision recorded in [ADR-0008](adr/0008-client-side-e2ee-passkey-prf.md); PRF spike validated on devices.

---

## Theme 1 — Cryptography correctness (data integrity)

These protect the actual passwords. Two are genuine "you can silently lose or
weaken data" bugs, so they come first.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| CR-1 | **P0** | S | ✅ **Done (via CR-2 rewrite).** **ASCII vs UTF-8 mismatch fixed.** `Encryption.cs` now uses `Encoding.UTF8` on both the encrypt and decrypt paths (legacy v1 and v2), so `é`, `£`, emoji, etc. round-trip correctly. *Note: entries written before this fix with non-ASCII chars were already corrupted to `?` and are unrecoverable — see `MIG-1`.* |
| CR-2 | **P1** | M | ✅ **Done.** **Authenticated encryption (AES-GCM).** New writes use `AesGcm` (random 96-bit nonce/entry, tag verified before decrypt → returns null on tamper). Stored as `v2.gcm.<iv>.<ct+tag>` via `SecretEnvelope`. `Encryptor.DecryptStored` routes v1/v2 so legacy data still reads. Encrypt now goes through `EncryptGcm`. |
| CR-3 | **P1** | S | ✅ **Done (via CR-2).** v2 no longer MACs the plaintext, so identical passwords no longer produce identical stored output (random nonce). Legacy v1 retains the flaw until `MIG-2` re-encrypts. |
| CR-4 | P2 | S | ✅ **Done (via CR-2).** AES-GCM uses a fresh random 96-bit nonce per entry; the static env `AesIV` is now only used by the legacy v1 decrypt path. |
| CR-5 | P2 | S | ✅ **Done for v2.** The GCM key is HKDF-SHA256-derived from the configured key (`info="passwordvault:v2:gcm"`), so it never shares material with the legacy AES/HMAC usage. |
| CR-6 | P3 | S | ✅ **Done.** `Encryptor`'s `_key`/`_iv` were `static` — the last-constructed instance overwrote the key process-wide (a real DI bug; surfaced as a parallel-test race). Now instance fields. |

## Theme 2 — Access control & secrets

The biggest *practical* exposure: the API trusts a shared key, and that key is
shipped to the browser.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| AC-1 | **P0** | M | ✅ **Done.** **Validate the Entra ID token in the API.** Added isolated-worker JWT middleware (`Common/JwtAuthenticationMiddleware.cs`) that validates issuer/audience/signature/lifetime against Entra's OIDC metadata, with an optional `oid` allowlist. Security-critical logic is in the pure, unit-tested `Common/EntraTokenAuth.cs` (`EntraTokenValidator`, 23 tests incl. wrong-key/issuer/audience/expired/allowlist). Gated by `AUTH_ENABLED` (**default off**, driven by the `app_requires_authentication` TF var) so it rolls out per environment without breaking the function-key path. Health check stays anonymous. Env/runbook in [`entra.md`](entra.md). |
| AC-2 | **P0** | S | ✅ **Done (code; live cutover is operator-run).** **Stop shipping the function key to the browser.** All HTTP triggers flipped `Function`→`Anonymous`, so the AC-1 JWT middleware is the sole guard — and it's now **fail-closed**: `AUTH_ENABLED` defaults ON and only the explicit string `false` disables it (local/offline dev), so a misconfigured deploy denies (401) rather than exposing the API. The SPA no longer sends `x-functions-key` (`main.js`), the leaked key was removed from `ui/.env`, and `task deploy-ui` no longer writes `VUE_APP_API_KEY`. Terraform `app_requires_authentication` now defaults `true`. Regression coverage: fail-closed option tests (unset/empty/`true`→enabled; only `false`→disabled) + headless smoke proving no function-key header is sent. **Operator still runs the live cutover** (configure AAD → deploy → **rotate the old host key**) per the [`entra.md`](entra.md) runbook. |
| AC-3 | P2 | M | 🚫 **Not planned.** **Scope data to the authenticated user.** All records share one env partition key. Owner decision: the vault is a single shared family vault by design — nothing is hidden between family members — so per-user partitioning isn't wanted. (If selective *sharing* is ever desired, see `FE-10`.) See [ADR-0006](adr/0006-single-shared-family-vault.md). |
| AC-4 | P1 | S | ✅ **Done.** **Removed sensitive log line.** `PostPassword` no longer logs the stored password blob — it logs only `id`. A source-scanning regression guard (`SensitiveLoggingTests`) fails CI if any HTTP trigger logs a password/secret field, so this can't silently come back. |

## Theme 3 — Migration from the existing vault (explicitly requested)

You want to move existing data onto the improved scheme without losing it.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| MIG-1 | **P0** | M | ✅ **Done.** **Versioned ciphertext format.** Introduced `Common/SecretEnvelope.cs`: a version-aware parse/serialize for stored blobs. Legacy `hmac:ciphertext` is recognized as `v1` (no rewrite of existing data needed); the `v2.gcm.<iv>.<ct+tag>` format is parsed/serialized and ready for `CR-2`. Discriminator: legacy base64 never contains `.`, versioned blobs always do. `PasswordEntity` now delegates to the envelope and exposes `Format`. 14 regression tests (incl. real-Encryptor v1 round-trip, non-ASCII/emoji, malformed→`FormatException`). No crypto changed yet. |
| MIG-2 | **P0** | M | ✅ **Done.** **One-time re-encryption migration.** `src/passwordapp.tools` (`vault-migrate`): reuses the production `Encryptor`/`DocumentMigrator` (no second crypto impl) to read each Cosmos doc, decrypt legacy `v1`, re-encrypt to `v2` (AES-GCM), **verify the round-trip**, and upsert. Dry-run by default; `--apply` to write; idempotent (skips `v2`); refuses to write any doc whose secrets didn't all migrate+verify. Backs up first. Tasks: `migrate:dryrun`/`migrate:apply`. Core covered by unit tests (`VaultMigrationTests`, `DocumentMigratorTests`). |
| MIG-3 | P1 | S | ✅ **Done.** **Pre-migration backup + verify.** `vault-migrate backup` snapshots every doc to JSON; `vault-migrate verify` decrypt-checks every secret (current + history) and reports undecryptable entries (`migrate:backup`/`migrate:verify`). Also hardened the legacy `Decrypt` to fail safe (return null) instead of throwing on corrupt input, so a bad entry can't crash a bulk pass. *Caveat documented: CR-1-mangled non-ASCII still decrypts and can't be auto-detected — review known accented/emoji accounts manually.* |
| MIG-4 | P2 | M–L | ✅ **Done (code; operator runs the one-shot at cutover).** **Import / transform into a new E2EE-native store.** `Common/BlueGreenVaultTransformer.cs` (pure, Cosmos-free) + `vault-migrate import`: read a `backup` JSON snapshot → **decrypt** each current + historical secret with the existing `Encryptor` (no second crypto impl) → **re-encrypt under the supplied vault DEK** (`v2.gcm`) → write the new schema (DEK-encrypted blobs; legacy `HmacHash` dropped). Verifies each transformed blob round-trips, idempotent, refuses partial docs; plaintext stays in memory only (DEK via `VAULT_DEK_BASE64`/`--dek-base64`). Unit-tested (links into `passwordapp.api.tests`; 126 API tests green). Design: [`design/blue-green-rebuild.md`](design/blue-green-rebuild.md) §3–4. |
| MIG-5 | P2 | S–M | ✅ **Done (code; run before each flip).** **Cutover parity verification.** `BlueGreenVaultTransformer.VerifyParity` + `vault-migrate verify-parity`: account + per-account history **count parity** old→new and **value parity** (`decrypt_new == decrypt_old`) for every entry; flags missing/extra/duplicate ids and any undecryptable entry; non-zero exit on any failure. Spot-check known `CR-1` non-ASCII by hand. *(Honors "no hopeful patches" — proves the exact migration path.)* Design: [`design/blue-green-rebuild.md`](design/blue-green-rebuild.md) §6. |

## Theme 4 — Front-end UX & safety

Quality-of-life and "don't leave secrets lying around" items for a family tool.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| UI-1 | P1 | S | ✅ **Done.** **Auto-clear clipboard.** `copyWithAutoClear` (`utils/clipboard.js`) writes the secret then overwrites the clipboard after a configurable delay (default 30s; 0 = off). `home.js` `copyText`/`copyPassword` use it and surface the countdown in the success message. Delay is driven by `FE-15` settings (`security.clipboardClearSeconds`). Vitest-covered. |
| UI-2 | P2 | S | ✅ **Done.** **Auto-lock / re-auth timeout.** `IdleTimer` (`utils/idle-timer.js`) + throttled activity listeners in `App.vue` fire after the configured idle period (default 5m; 0 = off, `security.autoLockMinutes`), dropping in-memory plaintext via a forced sign-out (or reload when auth is disabled) so re-auth is required. Vitest-covered. |
| UI-3 | P2 | M | ✅ **Done.** **Fix MSAL bootstrap + token storage.** Rewrote `AzureAD.Authentication.js` to memoize a single awaited init (`initialize()` → `handleRedirectPromise()` → set active account) so the app no longer mounts/guards before the account is known. `main.js` awaits init and only sends `Authorization` when authenticated (no more `Bearer null`); the router guard awaits init before checking auth. Vitest-covered (8 tests). (Token cache still `localStorage` for SSO continuity — `sessionStorage`/passkey hardening tracked with `OFF-4`/E2EE.) |
| UI-4 | P2 | M | ✅ **Done.** **Migrated UI library to PrimeVue v4 + exited Vue 2 compat.** Removed `@vue/compat` (compat MODE 2) and `bootstrap-vue@2` (which dragged EOL `vue@2.7.16`); `npm ls vue` now shows only `vue@3`. Added `primevue@4` + `@primevue/themes` (Aura preset) + `primeicons`; registered components globally in `main.js` (moved off the Vue-2 global `Vue.use/component` API to the app instance). Ported all screens — `b-table`→**DataTable** (sort incl. last-modified, built-in paginator, row-expansion via `v-model:expandedRows`, responsive stack), `b-modal`+`$refs.show()`→**Dialog** with `v-model:visible`, plus InputText/Textarea/Select/Checkbox/RadioButton/Tag/Message/Button. Replaced Vue-2 `$set` with native reactivity. Kept Bootstrap **CSS** (framework-agnostic utilities, BS5) for grid/spacing to avoid a high-risk layout rewrite. Validated with a headless (Puppeteer) smoke pass over home/create/update/settings: all mount with zero page errors, generator + DataTable + reveal/history/delete Dialogs all exercised. (Caught & fixed two browser-only bugs en route: a `setTimeout`/`clearTimeout` unbound-`this` "Illegal invocation" in the UI-1/UI-2 timers, and an unhandled `handleRedirectPromise` rejection that blocked app mount.) |
| UI-6 | P2 | M | ✅ **Done.** **Upgrade `@azure/msal-browser` v2 → v5.** Bumped `^2.39.0` → `^5.15.0`. Adopted the v5 contract: mandatory awaited `initialize()`, active-account model (`setActiveAccount`/`getActiveAccount`), and account-gated `acquireTokenSilent` with `acquireTokenRedirect` fallback on `InteractionRequiredAuthError`. Done together with `UI-3` (single auth-module rewrite); build green and vendor bundle slightly smaller. |
| UI-5 | P3 | S | ✅ **Done.** **Improve the existing generator.** Rewrote the generator as a pure, unit-tested module (`utils/generator.js`) backing a reusable `PasswordGenerator` component, delivering `GE-1`/`GE-2`/`GE-3`/`GE-4` (configurable options, exclude-ambiguous, passphrase mode, unbiased sampling) plus a live strength/entropy readout. `utils.js` keeps a backward-compatible `generatePassword()`. Vitest added; tests run in CI. (Generator defaults will later be driven by `FE-15` settings.) |

### UI-4 migration steps (bootstrap-vue@2 → PrimeVue v4)

1. **Inventory current usage.** Grep the UI for `b-*` components/directives (`b-form*`, `b-button`, `b-modal`, `b-table`, `b-nav*`, etc.) and `v-b-*` directives to size the surface and build a component map.
2. **Add PrimeVue, stage the swap.** `npm install primevue` (+ an icon set, e.g. `primeicons`); register it in `main.js` (`app.use(PrimeVue, { theme: ... })`) and import a theme/preset. Keep bootstrap-vue installed during the transition so the app stays runnable.
3. **Port screen-by-screen.** Replace components per the map — e.g. `b-form-input`→`InputText`, `b-form-group`→label + `<small>`, `b-button`→`Button`, `b-modal`→`Dialog`, `b-form-select`→`Select`, nav→`Menubar`. Do one route at a time (home → create → update → notfound) and smoke-test each.
4. **Adopt the built-in `Password` component.** Use `<Password feedback toggleMask>` on the create/update password fields to deliver the FE-1 strength meter; wire the existing generator into its input.
5. **Drop Bootstrap + compat.** Remove `bootstrap-vue`, `bootstrap`, `portal-vue`, and `@vue/compat`; delete Bootstrap CSS imports and the `compat` Vite/alias config; replace residual layout/grid utilities (PrimeFlex or plain CSS).
6. **Verify.** `npm ls vue` shows only `vue@3` (no `2.7.16`); `npm run build` is clean; manual pass over all four screens + copy/reveal/generate flows. CI (`ui` job) gates the build.

> Sequence note: do UI-4 **before** UI-6 (MSAL) so you're testing one big dependency change at a time; both are P2/Theme 4.

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

---

## Theme 7 — Feature ideas

Realistic, family-friendly features. Most are independent of the security work;
a few (marked) are easier *after* end-to-end encryption (see Theme 8).

### Generator improvements (the existing one is good — polish it)

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| GE-1 | P2 | S | ✅ **Done.** **Configurable options in the UI.** New reusable `PasswordGenerator` component (`components/generator/`) with a length slider (8–64) and upper/lower/digit/symbol toggles, embedded on create + update. Live entropy/strength readout. |
| GE-2 | P3 | S | ✅ **Done.** **Exclude-ambiguous mode.** Toggle removes visually confusable chars (`O/0/o/i/I/l/L/1/|` and quotes) from the pool; entropy estimate accounts for the smaller pool. |
| GE-3 | P3 | S | ✅ **Done.** **Passphrase / diceware mode.** Mode toggle generates word-list passphrases from the bundled **EFF large wordlist** (7776 words, CC-BY, `utils/wordlist.js`) with configurable word count, separator, capitalize, and optional number (~12.9 bits/word). |
| GE-4 | P3 | S | ✅ **Done.** **Remove modulo bias.** Replaced `% charset.length` with `secureRandomBelow()` rejection sampling (used for both char selection and the Fisher-Yates shuffle). Unit-tested incl. the rejection path + statistical uniformity. |

### Vault features

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| FE-1 | P1 | S | ✅ **Done.** **Strength meter on create/update.** Live strength meter under the password field on both the create and update forms. Pure, unit-tested estimator in `components/utils/strength.js` (`estimatePasswordStrength`): entropy from charset pool size × length, reusing the generator's Weak/Fair/Strong/Excellent thresholds (40/60/80 bits), plus a `COMMON_PASSWORDS` blocklist and repeat/sequence detection that force a **Very weak** rating with a warning regardless of length. Reusable `strength/strength-meter.vue` (bar + Tag + bits + warning). Dependency-free (no zxcvbn). 15 Vitest tests + headless smoke-validated (live updates, common-password flagged, hidden when empty). |
| FE-2 | P1 | M | ✅ **Done.** **Search / filter / tags.** Each entry now carries optional `Tags` (`AccountPassword.Tags`, copied in `Clone()`, persisted by Post/Update). Create/Update forms have a comma-separated tags field (pure, tested `utils/tags.js`: `parseTags`/`formatTags`/`collectTags`/`hasTag` — trim, dedupe case-insensitively). The vault list shows clickable tag chips per row, a **tag filter** Select (built from `collectTags`), and the substring search now also matches **notes and tags** (not just account/site). 11 Vitest tests + 4 API tests (Clone/JSON round-trip) + headless smoke-validated (chips render, finance filter narrows 3→1). |
| FE-3 | P2 | M | ✅ **Done.** **Breach check (HaveIBeenPwned).** A second tool on the **Security Audit** page checks each password against HIBP's Pwned Passwords range API using **k-anonymity** — only the first 5 chars of each password's SHA-1 hash leave the device; the password and full hash never do. Pure, tested `audit/hibp.js` (`sha1Hex` via Web Crypto, `parsePwnedRange`, `pwnedCount` with injectable fetch). Native `fetch` (bypasses the Axios API baseURL) with the `Add-Padding` header; passwords deduped to minimise calls; breached accounts listed with their breach count and a **Change** action; plaintext dropped right after. 11 Vitest tests + headless smoke (reused→99,999 flagged, safe account excluded, only 5-char prefixes sent). |
| FE-4 | P2 | S | ✅ **Done.** **Reused / duplicate password report.** New `/audit` route + **Security Audit** page (linked from the vault nav). Pure, unit-tested grouping logic in `components/audit/reuse.js` (`findReusedPasswords`/`countReusedAccounts`); the page fetches each entry's server-decrypted password (the list returns only encrypted blobs, and AES-GCM gives identical passwords different ciphertext), groups accounts sharing a password, and lists each group with a **Change** action (→ Update page, where the generator lives). Plaintext is dropped right after grouping and never enters reactive state / the DOM. 10 Vitest tests + headless smoke-validated. |
| FE-5 | P2 | S | ✅ **Done.** **Password age / expiry reminders.** Pure, tested `utils/age.js` (`daysSince`/`monthsSince`/`isStale`/`ageLabel`, injectable "now"). The vault list shows a human age ("3 months", "2 years") under **Last Modified** and an **Old** warning Tag (with tooltip) when an entry is older than the configurable threshold. Threshold lives in settings (`list.staleAfterMonths`, default 24 months; **Never**/6mo/1/2/3yr choices on the Settings page). 15 Vitest tests + headless smoke-validated (only the 1200-day entry flagged). |
| FE-6 | P2 | M | ✅ **Done.** **Recycle bin / restore.** Soft-delete already set `isDeleted=true`; now there's a **Recycle Bin** page (`/trash`, linked from the vault nav) to view and recover deleted accounts. New API endpoints: `GET passwords/deleted` (lists soft-deleted entries; literal route beats `{id}`) and `POST passwords/{id}/restore` (clears `isDeleted`, bumps `LastModifiedDate`, upserts via the Cosmos output binding). `Password.Service.js` gains `getDeleted()`/`restore(id)`; the page lists account/site/deleted-date with a per-row **Restore** action that removes the row and confirms. Headless smoke-validated (lists 2 deleted, restore POSTs the right id, row clears). *Note:* this is recovery only — there's no hard "empty trash" yet (the Cosmos output binding upserts, so a true purge needs the Cosmos SDK; tracked as a follow-up). |
| FE-7 | P2 | M | 🚫 **Not planned.** **TOTP (2FA) secret storage + code generation.** Technically low-risk (RFC 6238 via Web Crypto HMAC-SHA1), but it stores a *second* factor next to the first under today's server-trust model. Deferred by owner decision; revisit once `OFF-4` (E2EE) lands so the seed can be encrypted client-side and the server never holds both factors. |
| FE-8 | P2 | M | ✅ **Done (CSV).** **Import / export.** New **Import / Export** page (`/transfer`, linked from the vault nav). **Export** downloads every account to a CSV (`name,url,username,password,notes,tags`) that re-imports here and into browsers/most managers — with a clear plain-text warning. **Import** reads a CSV, maps headers case-insensitively (our export + Bitwarden `login_*`/`folder`, Chrome `name/url/username/note`, 1Password), previews the rows (skipping any missing account/site/password), then creates each via the API. Pure, tested `transfer/csv.js` (RFC-4180 `parseCsv`/`toCsv`, `entriesToCsv`, `csvToEntries`) — 15 Vitest tests (quoting/escaping, embedded commas/newlines, Bitwarden/Chrome header mapping, skip-count, round-trip) + headless smoke (export quoting + dated filename; import previews 2, skips 1, posts correct fields). Native JSON backup + other-manager formats can follow. |
| FE-9 | P3 | M | **Secure notes / attachments.** Free-form encrypted notes or small files (e.g. recovery codes, passport scans). |
| FE-10 | P3 | L | **Per-item / shared-folder sharing.** Selective sharing instead of one shared vault (depends on AC-3 user scoping). |
| FE-11 | P3 | M | **Biometric / WebAuthn app unlock.** Use platform authenticator to unlock the app locally. |
| FE-12 | P3 | S | **Backup/restore UI.** A `scripts/decrypt-backup.py` exists as a CLI; expose backup/export from the UI. |
| FE-13 | P2 | S | ✅ **Done.** **Password history view (UI).** Added `getHistory(id)` to `Password.Service.js` (calls `passwords/{id}/history`) and a history modal in `home.vue`/`home.js`: a per-account table of every password (current + prior) with timestamps, a **Current** badge on the newest, and a per-row copy button. Reachable from a new clock action in the account row. (Built on bootstrap-vue for now; will carry over in the UI-4 PrimeVue migration.) |
| FE-14 | P3 | M | **Better sorting / filtering / searching.** Builds on `FE-2`. Today the home list uses bootstrap-vue's `b-table` with sort on Account/Site only (`lastModifiedDate` is `sortable: false`) and a single substring filter (`home.js:19-24`). Improvements: make every column sortable (incl. last-modified/age), add scoped filters (by site/account/tag/folder once `FE-2` lands), and a faster global search. **Couples to `UI-4`:** the PrimeVue migration replaces `b-table` with PrimeVue `DataTable`, which provides column sort, per-column filters, and global search out of the box — so do this as part of / after `UI-4`. |
| FE-15 | P2 | M | ✅ **Done (v1).** **User settings / preferences page.** New `/settings` route + page (linked from the vault nav) backed by a per-user `localStorage` store (`components/settings/settings.store.js`) with deep-merge defaults, forward-compat backfill, type-checking, and corrupt-JSON fallback. Today it controls **generator defaults** (password/passphrase mode + all options — the `PasswordGenerator` seeds from it) and **vault list defaults** (sort field/direction, rows per page — `home.js` seeds from it). The store schema is the single source of truth and is ready to grow into `UI-1` (clipboard auto-clear), `UI-2` (auto-lock), theme, and a server-stored profile after `AC-3`. Vitest-covered (10 tests). |

---

## Theme 8 — Offline caching (answering "how hard would it be?")

Short answer: it's a **spectrum**, and the app already does the easy part. The
catch is the current architecture **decrypts on the server**, so true offline
access to secrets requires moving decryption to the client first.

| ID | Pri | Effort | Item & difficulty notes |
|----|-----|--------|--------------------------|
| OFF-1 | P3 | ✅ **Done (app-shell)** | **Installable PWA + app-shell offline.** Hardened the existing PWA so it's a great phone experience: fixed the broken `manifest.json` (it referenced 512/maskable icons that didn't exist and used a black splash) by moving config to `manifestOptions` with a full icon set (192/512 `any` + `maskable`), navy splash (`background_color #343541`), `description`/`id`/`scope`/`orientation`/`categories`; generated a real icon set (512, maskable 192/512, 180px iOS `apple-touch-icon`, `favicon.ico`). Added an in-app **update prompt** (`components/pwa/`): the SW waits and a banner lets the user pick up the new version (posts `SKIP_WAITING`). The SW precaches only the app shell — the cross-origin Functions API (vault data) is **never** cached. Regression coverage: `sw-update.spec.js` (skip-waiting + reload-once guard) + headless smoke (SW active, manifest/all icons 200, banner→`SKIP_WAITING`). Remaining: an explicit "you're offline" data state belongs to OFF-2/OFF-4 (needs client-side data). |
| OFF-2 | P2 | **M–L** | **Read-only offline vault.** Cache entries in IndexedDB so the family can *view* passwords with no signal. **The blocker:** today `GetPasswordById` decrypts server-side and returns plaintext, so caching would mean storing plaintext (or the function key) in the browser — unacceptable. The clean path is to cache **encrypted** blobs and decrypt in the browser, which requires E2EE (OFF-4). Effort is M if you accept caching encrypted blobs + client decrypt; L if done carefully with key handling and auto-lock. |
| OFF-3 | P3 | **L** | **Offline edits + sync.** Queue create/update/delete while offline and replay on reconnect, with conflict resolution (last-write-wins is simplest given low family concurrency). Genuinely the hardest piece; only worth it if OFF-2 proves valuable. |
| OFF-4 | P2 | **L (enabler)** | **End-to-end / zero-knowledge encryption.** ✅ *Design decided* — see [`design/e2ee.md`](design/e2ee.md). Password-free unlock via **WebAuthn passkey PRF**; envelope model (random vault DEK wrapped per passkey via a PRF-derived KEK, all in Web Crypto); Entra for sign-in only. The server never sees plaintext or the key. Unlocks OFF-2/OFF-3 and FE-3/FE-4. Pairs with Theme 1 AES-GCM + Theme 3 versioned/migration format. PRF feasibility validated via `scripts/spikes/webauthn-prf`. **Progress:** ✅ *Phase 1* — flag-gated client crypto foundation (`ui/src/components/crypto/*`: AES-GCM `v2.gcm` envelope, DEK gen/wrap, HKDF KEK, recovery key, §5B record, passkey PRF helpers; 38 tests). ✅ *Phase 2a* — server **vault-key store**: flag-gated (`E2EE_ENABLED`, default off) `GET`/`PUT /api/vault-key` persisting the §5B record (PRF salt + wrapped DEKs) in an isolated Cosmos container; pure `VaultKeyRecordValidator`/`E2eeFeature` (30 tests). Server stores it opaquely — cannot unwrap. ✅ *Phase 2b* — in-memory **DEK session** (`ui/src/components/crypto/vault-session.js`): the unwrapped DEK lives in module memory only (never persisted), with `unlock`/`lock`/`getDek`/`subscribe` + idle auto-lock; App.vue's idle lock now clears it (13 tests). *Next:* on-device passkey enrollment/unlock validation (owner hardware), then 2d MIG-2/MIG-3 client-driven migration + retire server key. ✅ *Phase 2c* — passkey **enrollment + PRF unlock/lock UI** (`ui/src/components/crypto/e2ee-flow.js` + `PasskeyVaultGate.vue`, flag-gated): first-enroll generates the DEK + recovery key and PUTs the §5B record, additional passkeys re-wrap the DEK, unlock/recovery paths drive `vaultSession.unlock`; idle auto-lock becomes a soft lock; WebAuthn injected for unit tests (194 Vitest, flag-on headless smoke). Blue-green alternative for 2b/2c testing + cutover: [`design/blue-green-rebuild.md`](design/blue-green-rebuild.md). |

**Recommended offline path:** OFF-1 is essentially free (tidy it up). Don't chase
OFF-2/OFF-3 directly — they're a trap without OFF-4. If offline access matters to
the family, treat **OFF-4 (client-side E2EE)** as the real project; OFF-2 then
becomes a straightforward IndexedDB cache of encrypted blobs, and OFF-3 an
optional follow-up. If offline *isn't* a real need, skip the whole theme and keep
decryption server-side — simpler and arguably safer for a small shared vault.

---

## Theme 9 — Deployment & CI/CD

Today everything deploys from a developer's laptop via `Taskfile.yaml`: local
`terraform apply` (encryption key/IV passed as `-var` from `infrastructure/.env`),
`dotnet publish` → zip → `az storage copy` (run-from-package), and `swa deploy` with a
deployment token. It works, but it's manual, secret-on-laptop, and has no automated
build/test gate. The goal: move to **GitHub Actions** with **OIDC** (no stored cloud
secrets) while keeping the Taskfile usable for local dev.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| CD-1 | **P1** | M | ✅ **Done.** **CI on every PR.** `.github/workflows/ci.yml` runs on every PR + push to `main`: API `dotnet build` + `dotnet test` (net10, `passwordapp.api.tests`), migration-tool build, UI `npm install` + `lint` + `test:unit` + `build`, and `terraform fmt -check` + `validate`. Supersedes `EN-3`. (`npm ci` pending a committed lockfile.) |
| CD-3 | **P1** | S | ✅ **Done (code; operator wires the federated credential + secrets).** **Azure login via OIDC.** Both `infra.yml` and `deploy.yml` authenticate with `azure/login@v2` using `id-token: write` + `AZURE_CLIENT_ID/TENANT_ID/SUBSCRIPTION_ID` — no SP password or publish profile is stored. Terraform backend uses `ARM_USE_OIDC`. Setup runbook in [`deploy.md`](deploy.md). |
| CD-2 | P2 | M | ✅ **Done (code; operator approves each run).** **CD pipelines.** `.github/workflows/deploy.yml` deploys API (`task deploy-api` → storage/run-from-package), UI (`task deploy-ui` → SWA CLI), and the Python maintenance function — on `workflow_dispatch` (per-component) or merge to `main`. Every job runs in the `production` Environment so it waits for approval. |
| CD-4 | P2 | M | ✅ **Done (code; operator runs the one-time state migration + Environment).** **Terraform in CI with remote state.** State moved to the `azurerm` backend (`providers.tf`, `use_oidc`). `.github/workflows/infra.yml` runs `task plan` on PRs touching `infrastructure/**` and `task apply` on `main` behind the `production` Environment approval. See [ADR-0007](adr/0007-oidc-cd-remote-state.md). |
| CD-5 | P2 | S | ✅ **Done.** **Encryption key/IV off the command line.** Both vars are `sensitive` in `variables.tf`; the Taskfile passes them via `TF_VAR_*` env (not `-var`), so they stay out of `ps`/shell history. (Goes away entirely once `OFF-4` retires the server key.) |
| CD-6 | P2 | S | ✅ **Done.** **Dependabot config** (`.github/dependabot.yml`) for nuget (api/tests/tools), npm (UI), pip (maintenance), terraform (root + maintenance), and github-actions — weekly, grouped. |
| CD-7 | P3 | S | ✅ **Done.** **Taskfile is the single source of truth.** Every CD job (`infra.yml`, `deploy.yml`) invokes the same `task plan`/`apply`/`deploy-*` targets used locally, so local and pipeline deploys can't drift. |
| OFF-5 | P2 | M | 📋 **Planned (owner-managed infra).** **Cutover runbook.** The new-stack Terraform is owner-managed in the single `infrastructure/` directory (`VaultKeys` container + `E2EE_ENABLED`/`app_e2ee_enabled` already present; flip the flag + point at the new datastore there — no separate TF tree). Cutover: stand up the new stack → run `MIG-4` import → test E2EE (`OFF-4` 2b/2c) → brief write-freeze → fresh `backup` + full re-import → `MIG-5` parity → flip the SWA/DNS URL → keep old URL live as instant rollback. **RP ID is locked to the registrable parent (`denicolafamily.com`)** so passkeys survive the switch. Design: [`design/blue-green-rebuild.md`](design/blue-green-rebuild.md) §5, §8. |
