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
> ✅ `FE-13` (password history UI), ✅ `AC-1` (server-side Entra token validation, flag-gated; `AC-2` staged),
> ✅ `GE-1`/`GE-2`/`GE-3`/`GE-4`/`UI-5` (generator overhaul: options, exclude-ambiguous, passphrase mode, unbiased sampling + Vitest),
> ✅ `FE-15` (per-user settings page: generator + vault-list defaults, localStorage store),
> ✅ `UI-1`/`UI-2` (clipboard auto-clear + idle auto-lock, settings-driven),
> ✅ `UI-3`/`UI-6` (MSAL bootstrap rewrite + `@azure/msal-browser` v2→v5 upgrade),
> ✅ `UI-4` (PrimeVue v4 migration; removed `@vue/compat` + `bootstrap-vue`, now Vue 3-native),
> ✅ `FE-4` (reused/duplicate-password Security Audit page).
> New writes are now AES-GCM; legacy `v1` still reads, and existing data can be migrated with `vault-migrate`.
> Design for `OFF-4` in [`design/e2ee.md`](design/e2ee.md); PRF spike validated on devices.

---

## Theme 1 — Cryptography correctness (data integrity)

These protect the actual passwords. Two are genuine "you can silently lose or
weaken data" bugs, so they come first.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| CR-1 | **P0** | S | **Fix ASCII vs UTF-8 mismatch.** `Encryption.cs:29` encrypts with `Encoding.ASCII` but `:85` decrypts with UTF-8. Any password with `é`, `£`, emoji, etc. is silently corrupted to `?` and **unrecoverable**. Switch both sides to UTF-8. *Note: existing entries with non-ASCII chars are already lost — see MIG-1.* |
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
| AC-2 | **P0** | S | 🟡 **Staged (code ready; needs flag enablement first).** **Stop shipping the function key to the browser.** The SPA already sends the bearer token, and AC-1 enforces it. Safe sequence (see [`entra.md`](entra.md) cutover runbook): (1) enable `AUTH_ENABLED` in the live env and verify, (2) flip HTTP triggers `Function`→`Anonymous` and remove `VUE_APP_API_KEY`/`x-functions-key` from `main.js`, (3) **rotate** the old key (it was committed in `ui/.env` + git history). Not flipped automatically because with the flag still off that would leave the API open. |
| AC-3 | P2 | M | **Scope data to the authenticated user.** All records share one env partition key, so "family member" = "all-or-nothing". Optionally partition per user (or per shared-vault) once tokens are validated. Decide if shared-vault is actually desired (it may be!). |
| AC-4 | P1 | S | **Remove sensitive log line.** `PostPassword.cs:40` logs the encrypted blob + plaintext-HMAC fingerprint into App Insights. Log only `id`. |

## Theme 3 — Migration from the existing vault (explicitly requested)

You want to move existing data onto the improved scheme without losing it.

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| MIG-1 | **P0** | M | ✅ **Done.** **Versioned ciphertext format.** Introduced `Common/SecretEnvelope.cs`: a version-aware parse/serialize for stored blobs. Legacy `hmac:ciphertext` is recognized as `v1` (no rewrite of existing data needed); the `v2.gcm.<iv>.<ct+tag>` format is parsed/serialized and ready for `CR-2`. Discriminator: legacy base64 never contains `.`, versioned blobs always do. `PasswordEntity` now delegates to the envelope and exposes `Format`. 14 regression tests (incl. real-Encryptor v1 round-trip, non-ASCII/emoji, malformed→`FormatException`). No crypto changed yet. |
| MIG-2 | **P0** | M | ✅ **Done.** **One-time re-encryption migration.** `src/passwordapp.tools` (`vault-migrate`): reuses the production `Encryptor`/`DocumentMigrator` (no second crypto impl) to read each Cosmos doc, decrypt legacy `v1`, re-encrypt to `v2` (AES-GCM), **verify the round-trip**, and upsert. Dry-run by default; `--apply` to write; idempotent (skips `v2`); refuses to write any doc whose secrets didn't all migrate+verify. Backs up first. Tasks: `migrate:dryrun`/`migrate:apply`. Core covered by unit tests (`VaultMigrationTests`, `DocumentMigratorTests`). |
| MIG-3 | P1 | S | ✅ **Done.** **Pre-migration backup + verify.** `vault-migrate backup` snapshots every doc to JSON; `vault-migrate verify` decrypt-checks every secret (current + history) and reports undecryptable entries (`migrate:backup`/`migrate:verify`). Also hardened the legacy `Decrypt` to fail safe (return null) instead of throwing on corrupt input, so a bad entry can't crash a bulk pass. *Caveat documented: CR-1-mangled non-ASCII still decrypts and can't be auto-detected — review known accented/emoji accounts manually.* |

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
| FE-1 | P1 | S | **Strength meter on create/update.** Integrate `zxcvbn` for live feedback. |
| FE-2 | P1 | M | **Search / filter / tags.** As entries grow, a family vault needs search by site/account and optional tags or folders. |
| FE-3 | P2 | M | **Breach check (HaveIBeenPwned).** Privacy-preserving k-anonymity range API to flag pwned passwords. No secret leaves the client. |
| FE-4 | P2 | S | ✅ **Done.** **Reused / duplicate password report.** New `/audit` route + **Security Audit** page (linked from the vault nav). Pure, unit-tested grouping logic in `components/audit/reuse.js` (`findReusedPasswords`/`countReusedAccounts`); the page fetches each entry's server-decrypted password (the list returns only encrypted blobs, and AES-GCM gives identical passwords different ciphertext), groups accounts sharing a password, and lists each group with a **Change** action (→ Update page, where the generator lives). Plaintext is dropped right after grouping and never enters reactive state / the DOM. 10 Vitest tests + headless smoke-validated. |
| FE-5 | P2 | S | **Password age / expiry reminders.** Use existing `LastModifiedDate` to surface "this is 2+ years old". |
| FE-6 | P2 | M | **Recycle bin / restore.** `isDeleted` already exists in the model but there's no UI to view or restore soft-deleted entries. |
| FE-7 | P2 | M | **TOTP (2FA) secret storage + code generation.** Store TOTP seeds and show rolling 6-digit codes. High family value. |
| FE-8 | P2 | M | **Import / export.** CSV + Bitwarden/1Password/browser formats — useful for onboarding family members and as an exit hatch. Pairs with the Theme 3 migration work. |
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
| OFF-1 | P3 | **S — mostly done** | **App-shell offline.** Already a PWA: `registerServiceWorker.js` + `vue.config.js` `pwa{}` cache the UI shell. The app *loads* offline today; it just can't fetch data. Task is only to verify/upgrade the Workbox config and add an "offline" UI state. |
| OFF-2 | P2 | **M–L** | **Read-only offline vault.** Cache entries in IndexedDB so the family can *view* passwords with no signal. **The blocker:** today `GetPasswordById` decrypts server-side and returns plaintext, so caching would mean storing plaintext (or the function key) in the browser — unacceptable. The clean path is to cache **encrypted** blobs and decrypt in the browser, which requires E2EE (OFF-4). Effort is M if you accept caching encrypted blobs + client decrypt; L if done carefully with key handling and auto-lock. |
| OFF-3 | P3 | **L** | **Offline edits + sync.** Queue create/update/delete while offline and replay on reconnect, with conflict resolution (last-write-wins is simplest given low family concurrency). Genuinely the hardest piece; only worth it if OFF-2 proves valuable. |
| OFF-4 | P2 | **L (enabler)** | **End-to-end / zero-knowledge encryption.** ✅ *Design decided* — see [`design/e2ee.md`](design/e2ee.md). Password-free unlock via **WebAuthn passkey PRF**; envelope model (random vault DEK wrapped per passkey via a PRF-derived KEK, all in Web Crypto); Entra for sign-in only. The server never sees plaintext or the key. Unlocks OFF-2/OFF-3 and FE-3/FE-4. Pairs with Theme 1 AES-GCM + Theme 3 versioned/migration format. PRF feasibility validated via `scripts/spikes/webauthn-prf`. |

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
| CD-1 | **P1** | M | **CI on every PR.** Actions workflow: `dotnet build` + `dotnet test` (net10, runs the new `passwordapp.api.tests`), `npm ci` + `npm run build` for the UI, and `terraform fmt -check`/`validate`. Supersedes `EN-3`. |
| CD-3 | **P1** | S | **Azure login via OIDC federated credentials** (`azure/login`), so no service-principal password or publish profile is stored as a secret. Prerequisite for safe CD. |
| CD-2 | P2 | M | **CD pipelines.** Deploy API (publish → storage, run-from-package), UI (`Azure/static-web-apps-deploy`), and the Python maintenance function — triggered on merge to `main` (or tags). |
| CD-4 | P2 | M | **Terraform in CI with remote state.** Move state to an `azurerm` backend (currently local — `providers.tf`), run `terraform plan` on PR and `apply` on `main` behind a **GitHub Environment** approval. Ties `IN-4`. |
| CD-5 | P2 | S | **Stop passing the encryption key/IV as Terraform `-var`s from a local `.env`.** Mark them `sensitive`, source from Key Vault / CI secret, and keep them off the command line. (Removed entirely once `OFF-4` lands and the server no longer holds a key.) |
| CD-6 | P2 | S | **Dependabot config** for nuget, npm, terraform, and github-actions (a `dependabot/nuget` branch exists but there's no config on `main`). |
| CD-7 | P3 | S | **Keep `Taskfile.yaml` as a thin wrapper** over the same scripts CI uses, so local and pipeline deploys don't drift. |
