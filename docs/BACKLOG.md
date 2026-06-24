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
> ✅ `MIG-2`/`MIG-3` (`vault-migrate` tool: backup, verify, dry-run/apply re-encryption v1→v2).
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
| AC-1 | **P0** | M | **Validate the Entra ID token in the API.** Every endpoint is `AuthorizationLevel.Function` only; the SPA's login is cosmetic to the backend. Anyone with the function key has full read/decrypt access. Validate the bearer token (issuer/audience/`oid`) in each function and reject unauthenticated calls. |
| AC-2 | **P0** | S | **Stop shipping the function key to the browser.** `ui/.env` `VUE_APP_API_KEY` is injected as `x-functions-key` (`main.js:40-45`), so every user has the master key. Once AC-1 is in place, remove it and rely on the user's token. |
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
| UI-1 | P1 | S | **Auto-clear clipboard.** `home.js:86-103` copies passwords with no timed clear. Clear after ~30s. |
| UI-2 | P2 | S | **Auto-lock / re-auth timeout.** No idle lockout after revealing secrets. Add a session timeout that clears in-memory plaintext and requires re-auth. |
| UI-3 | P2 | M | **Fix MSAL bootstrap + token storage.** `AzureAD.Authentication.js` admits it "does not handle initial page load properly" and caches tokens in `localStorage` (XSS-reachable). Fix the redirect-promise flow; consider `sessionStorage`. |
| UI-4 | P2 | M | **Migrate UI library to PrimeVue v4 + exit Vue 2 compat.** Vue 3 is the current major (no Vue 4), so the *core* is fine — but the app runs through `@vue/compat` (temporary migration build) and **`bootstrap-vue@2`**, which is Vue 2-only and drags **EOL `vue@2.7.16`** into the tree (via `portal-vue`). **Decision (2026-06-24): replace bootstrap-vue with [PrimeVue v4](https://primevue.org/).** Rationale: actively maintained (90+ components, weekly releases), modern non-Bootstrap look via design tokens (and optional unstyled/Tailwind mode), and a built-in `Password` component with strength meter + toggle-mask that gives us **FE-1 nearly for free**. Remove `@vue/compat` and `bootstrap-vue`; confirm `npm ls vue` shows only `vue@3`. Migration surface is small (home/create/update/notfound + forms, buttons, one modal). See migration steps below. |
| UI-6 | P2 | M | **Upgrade `@azure/msal-browser` v2 → v5.** Currently `^2.39.0`; current major is v5.x. Security-relevant (it's the auth library) and increasingly important as passkey/E2EE flows land. Review breaking changes across v2→v3→v4→v5. |
| UI-5 | P3 | S | **Improve the existing generator.** A generator already exists (`utils.js:generatePassword`, CSPRNG + class guarantee + shuffle). Improvements only — see Theme 7 `GE-*`. |

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
| GE-1 | P2 | S | **Configurable options in the UI.** Length slider + toggles (upper/lower/digits/symbols). Today length is hardcoded to 13 (`utils.js:2`) with no UI controls. |
| GE-2 | P3 | S | **Exclude-ambiguous mode.** Optional removal of `l/I/1/O/0` etc. for hand-typed passwords. |
| GE-3 | P3 | S | **Passphrase / diceware mode.** Word-list passphrases for memorable master-style secrets. |
| GE-4 | P3 | S | **Remove modulo bias.** `% charset.length` (`utils.js:11,29`) is slightly biased; use rejection sampling. Cosmetic for a family tool, but trivial to fix. |

### Vault features

| ID | Pri | Effort | Item |
|----|-----|--------|------|
| FE-1 | P1 | S | **Strength meter on create/update.** Integrate `zxcvbn` for live feedback. |
| FE-2 | P1 | M | **Search / filter / tags.** As entries grow, a family vault needs search by site/account and optional tags or folders. |
| FE-3 | P2 | M | **Breach check (HaveIBeenPwned).** Privacy-preserving k-anonymity range API to flag pwned passwords. No secret leaves the client. |
| FE-4 | P2 | S | **Reused / duplicate password report.** Flag accounts sharing a password (do it client-side after decrypt — ironically what CR-3 stops the *server* from leaking). |
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
