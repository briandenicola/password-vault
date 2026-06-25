# vault-migrate

Operator tool for **MIG-3** (backup + verify), **MIG-2** (one-time re-encryption of
legacy `v1` AES-CBC secrets to `v2` AES-GCM), JSON backup restore, and the
blue-green **MIG-4/MIG-5** import/parity flow. See [`docs/BACKLOG.md`](../../docs/BACKLOG.md)
Theme 3 and [`docs/design/e2ee.md`](../../docs/design/e2ee.md) §5–6.

It reuses the **exact** production crypto and migration logic (`Encryptor`,
`SecretEnvelope`, `VaultMigration`, `DocumentMigrator` are linked from `passwordapp.api`),
so there is no second crypto implementation to keep in sync. Every re-encryption is
verified — the new `v2` blob is decrypted and compared to the original before it is
accepted, and an entry that cannot be decrypted or verified is reported and **never**
written.

## Safety model

- **`migrate` and `import` are dry runs by default.** They only write when you pass `--apply`.
- **A JSON backup is always written before any change.**
- A document is upserted only if **all** of its secrets migrated and verified. Any failure
  in a document leaves that document untouched and reported.

## Configuration (environment variables)

| Variable | Purpose |
|----------|---------|
| `COSMOSDB` | Cosmos DB connection string |
| `COSMOS_DATABASE_NAME` | e.g. `AccountPasswords` |
| `COSMOS_COLLECTION_NAME` | e.g. `Passwords` |
| `AesKey` | base64 AES key (same value the Functions app uses) |
| `AesIV` | base64 AES IV (legacy v1 decrypt only) |
| `SOURCE_AES_KEY`, `SOURCE_AES_IV` | optional source backup key/IV for `import`; if omitted, the tool prompts and can fall back to the target key/IV |
| `VAULT_DEK_BASE64` | base64 raw vault DEK for `import --e2ee` / `verify-parity` (or pass `--dek-base64`) |
| `NEW_COSMOSDB`, `NEW_COSMOS_DATABASE_NAME`, `NEW_COSMOS_COLLECTION_NAME` | optional target store overrides for blue-green import/parity |

## Usage

```bash
# From the repo root, with the variables above exported:
dotnet run --project src/passwordapp.tools -- backup            # snapshot to vault-backup-*.json
dotnet run --project src/passwordapp.tools -- verify            # MIG-3: decrypt-check every secret
dotnet run --project src/passwordapp.tools -- migrate           # MIG-2 dry run (writes a backup)
dotnet run --project src/passwordapp.tools -- migrate --apply   # MIG-2 apply
dotnet run --project src/passwordapp.tools -- import vault-backup.json          # restore app JSON backup (dry run)
dotnet run --project src/passwordapp.tools -- import vault-backup.json --apply  # restore app JSON backup
dotnet run --project src/passwordapp.tools -- import vault-backup.json --e2ee --apply
dotnet run --project src/passwordapp.tools -- verify-parity old.json new.json
dotnet run --project src/passwordapp.tools -- verify-parity old.json --new-store
```

Or via Taskfile (`COSMOSDB` is auto-derived from the Terraform output
`COSMOSDB_CONNECTION_STRING`). If key/IV values are not present in your environment,
`vault-migrate` prompts for them without echoing input. For a previous-vault backup that
used different crypto values, provide/paste the source backup key/IV when prompted, or
set `SOURCE_AES_KEY` / `SOURCE_AES_IV`. To run against a backup or an environment you
haven't `terraform init`-ed, override `COSMOSDB` by exporting it or adding it to
`infrastructure/.env`:

```bash
task migrate:verify
task migrate:dryrun
task migrate:apply
task migrate:import -- vault-backup.json
task migrate:import -- vault-backup.json --apply
task migrate:verify-parity -- old.json new.json
```

## Recommended runbook

1. `task migrate:backup` — keep the JSON snapshot somewhere safe.
2. `task migrate:verify` — confirm everything currently decrypts. Manually review any account
   you know used accented/emoji characters: CR-1 already mangled those to `?` at write time and
   that corruption **cannot** be detected here (the value still decrypts, just to the wrong text).
3. `task migrate:dryrun` — review the plan.
4. `task migrate:apply` — migrate. Re-run `verify` afterwards; all entries should now read as `v2`.
