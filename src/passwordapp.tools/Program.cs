using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PasswordService.Common;

namespace PasswordService.Tools
{
    // MIG-2 / MIG-3 operator tool. Reuses the production Encryptor + DocumentMigrator so the crypto
    // is identical to the running app. Migrate is DRY-RUN by default and always writes a JSON backup
    // before it changes anything.
    internal static class Program
    {
        private static async Task<int> Main(string[] args)
        {
            if (args.Length == 0)
            {
                PrintUsage();
                return 1;
            }

            var command = args[0].ToLowerInvariant();
            var apply = args.Contains("--apply");

            Config config;
            try
            {
                config = Config.FromEnvironment();
            }
            catch (InvalidOperationException ex)
            {
                Console.Error.WriteLine($"Configuration error: {ex.Message}");
                return 2;
            }

            var encryptor = new Encryptor(config.AesKey, config.AesIv);
            Console.WriteLine(config.SourceStoreDescription());

            try
            {
                switch (command)
                {
                    case "backup":
                    {
                        await using var store = NewStore(config, target: false);
                        var docs = await ReadStoreAsync(store, config.Database, config.Collection);
                        Backup(docs, args.ElementAtOrDefault(1));
                        return 0;
                    }

                    case "verify":
                    {
                        await using var store = NewStore(config, target: false);
                        var docs = await ReadStoreAsync(store, config.Database, config.Collection);
                        return Verify(encryptor, docs);
                    }

                    case "migrate":
                    {
                        await using var store = NewStore(config, target: false);
                        var docs = await ReadStoreAsync(store, config.Database, config.Collection);
                        return await MigrateAsync(encryptor, store, docs, apply);
                    }

                    case "import":
                        return await ImportAsync(encryptor, config, args, apply);

                    case "verify-parity":
                        return await VerifyParityAsync(encryptor, config, args);

                    default:
                        PrintUsage();
                        return 1;
                }
            }
            catch (Exception ex) when (ex is InvalidOperationException or IOException or JsonException or FormatException)
            {
                Console.Error.WriteLine($"Error: {ex.Message}");
                return 2;
            }
        }

        private static async Task<List<JObject>> ReadStoreAsync(IVaultStore store, string database, string collection)
        {
            Console.WriteLine($"Reading all documents from {database}/{collection} ...");
            var docs = await store.ReadAllAsync();
            Console.WriteLine($"Loaded {docs.Count} document(s).");
            return docs;
        }

        private static int Verify(Encryptor encryptor, List<JObject> docs)
        {
            int okEntries = 0, failedEntries = 0, badDocs = 0;
            foreach (var doc in docs)
            {
                var result = DocumentMigrator.VerifyDocument(encryptor, doc);
                okEntries += result.Ok;
                failedEntries += result.Failed;
                if (result.Failed > 0)
                {
                    badDocs++;
                    Console.WriteLine($"  ✗ {Id(doc)}: {string.Join("; ", result.Errors)}");
                }
            }

            Console.WriteLine();
            Console.WriteLine($"Verify complete: {okEntries} secret(s) OK, {failedEntries} undecryptable across {badDocs} document(s).");
            Console.WriteLine("Note: CR-1-corrupted entries (non-ASCII mangled to '?') still decrypt and cannot be");
            Console.WriteLine("detected here — review any account you know used accents/emoji before migrating.");
            return failedEntries == 0 ? 0 : 3;
        }

        private static async Task<int> MigrateAsync(Encryptor encryptor, IVaultStore store, List<JObject> docs, bool apply)
        {
            // Always snapshot before any write.
            var backupFile = Backup(docs, null);

            int migrated = 0, alreadyV2 = 0, failed = 0, changedDocs = 0;
            var toWrite = new List<JObject>();

            foreach (var doc in docs)
            {
                var result = DocumentMigrator.MigrateDocument(encryptor, doc);
                migrated += result.Migrated;
                alreadyV2 += result.AlreadyV2;
                failed += result.Failed;

                if (result.Failed > 0)
                {
                    Console.WriteLine($"  ✗ {Id(doc)}: NOT migrated — {string.Join("; ", result.Errors)}");
                    continue; // never write a document we could not fully, verifiably migrate
                }
                if (result.Changed)
                {
                    changedDocs++;
                    toWrite.Add(doc);
                }
            }

            Console.WriteLine();
            Console.WriteLine($"Plan: {migrated} secret(s) to migrate across {changedDocs} document(s); {alreadyV2} already v2; {failed} failed.");

            if (!apply)
            {
                Console.WriteLine("DRY RUN — nothing written. Re-run with --apply to migrate.");
                Console.WriteLine($"Backup written to {backupFile}.");
                return failed == 0 ? 0 : 3;
            }

            if (failed > 0)
            {
                Console.Error.WriteLine($"Refusing to apply: {failed} entr(ies) could not be migrated. Resolve them first.");
                return 3;
            }

            Console.WriteLine($"Applying {changedDocs} document update(s) ...");
            foreach (var doc in toWrite)
            {
                await store.UpsertAsync(doc);
            }
            Console.WriteLine($"Done. Migrated {migrated} secret(s). Backup at {backupFile}.");
            return 0;
        }

        private static async Task<int> ImportAsync(Encryptor oldEncryptor, Config config, string[] args, bool apply)
        {
            var backupPath = PositionalArgs(args.Skip(1)).FirstOrDefault();
            if (backupPath is null)
            {
                Console.Error.WriteLine("import requires a backup JSON file.");
                return 1;
            }

            var oldDocs = ReadJsonArrayFile(backupPath);
            Console.WriteLine($"Loaded {oldDocs.Count} document(s) from backup file {backupPath}.");
            if (args.Contains("--e2ee"))
            {
                return await ImportE2eeAsync(oldEncryptor, config, args, apply, oldDocs);
            }

            var source = SourceBackupEncryptor(config);
            Console.WriteLine(source.UsesDestinationKey
                ? "Backup/source key: using the destination/current vault AES key and IV."
                : "Backup/source key: using SOURCE_AES_KEY/SOURCE_AES_IV or prompted values.");
            Console.WriteLine(config.TargetStoreDescription());
            Console.WriteLine("Planning restore: decrypting backup secrets, re-encrypting for destination, and verifying every transformed secret ...");
            var plan = VaultBackupImporter.PlanRestore(source.Encryptor, oldEncryptor, oldDocs);

            foreach (var error in plan.Errors)
            {
                Console.WriteLine($"  ✗ {error}");
            }
            Console.WriteLine();
            Console.WriteLine($"Restore import plan: {plan.DocumentsReady} document(s) ready, {plan.DocumentsFailed} failed; {plan.SecretsTransformed} secret(s) transformed for the target vault, {plan.SecretsVerified} verified.");

            if (!apply)
            {
                Console.WriteLine("DRY RUN — nothing written. Re-run with --apply to import.");
                return plan.DocumentsFailed == 0 ? 0 : 3;
            }

            if (plan.DocumentsFailed > 0)
            {
                Console.Error.WriteLine("Refusing to apply: at least one document failed transform/verification.");
                return 3;
            }

            await using var targetStore = NewStore(config, target: true);
            Console.WriteLine("Reading destination container before import so a safety backup can be written ...");
            var targetDocs = await ReadStoreAsync(targetStore, config.TargetDatabase, config.TargetCollection);
            var targetBackup = Backup(targetDocs, null, "Target pre-import backup");

            Console.WriteLine($"Applying {plan.Documents.Count} upsert(s) to {config.TargetDatabase}/{config.TargetCollection} ...");
            await UpsertWithProgressAsync(targetStore, plan.Documents);

            Console.WriteLine("Reading destination container after import to confirm the write landed ...");
            var postImportDocs = await ReadStoreAsync(targetStore, config.TargetDatabase, config.TargetCollection);
            var verification = VerifyRestoredDocuments(plan.Documents, postImportDocs);
            Console.WriteLine($"Post-import destination count: {postImportDocs.Count} document(s). Verified {verification.Found}/{verification.Expected} restored document id(s) are present.");
            if (verification.Missing.Count > 0)
            {
                Console.Error.WriteLine($"Post-import verification failed: missing restored document id(s): {string.Join(", ", verification.Missing.Take(10))}{(verification.Missing.Count > 10 ? ", ..." : string.Empty)}");
                return 3;
            }

            Console.WriteLine($"Done. Restored {plan.Documents.Count} document(s). Target pre-import backup at {targetBackup}.");
            return 0;
        }

        private static async Task<int> ImportE2eeAsync(Encryptor oldEncryptor, Config config, string[] args, bool apply, List<JObject> oldDocs)
        {
            var dekEncryptor = DekEncryptor(args);
            var plan = BlueGreenVaultTransformer.PlanImport(oldEncryptor, dekEncryptor, oldDocs);

            foreach (var error in plan.Errors)
            {
                Console.WriteLine($"  ✗ {error}");
            }
            Console.WriteLine();
            Console.WriteLine($"E2EE import plan: {plan.DocumentsReady} document(s) ready, {plan.DocumentsFailed} failed; {plan.SecretsTransformed} secret(s) transformed, {plan.AlreadyNew} already new-schema.");

            if (!apply)
            {
                Console.WriteLine("DRY RUN — nothing written. Re-run with --apply to import.");
                return plan.DocumentsFailed == 0 ? 0 : 3;
            }

            if (plan.DocumentsFailed > 0)
            {
                Console.Error.WriteLine("Refusing to apply: at least one document failed transform/verification.");
                return 3;
            }

            await using var targetStore = NewStore(config, target: true);
            Console.WriteLine(config.TargetStoreDescription());
            Console.WriteLine("Reading destination container before import so a safety backup can be written ...");
            var targetDocs = await ReadStoreAsync(targetStore, config.TargetDatabase, config.TargetCollection);
            var targetBackup = Backup(targetDocs, null, "Target pre-import backup");

            Console.WriteLine($"Applying {plan.Documents.Count} upsert(s) to {config.TargetDatabase}/{config.TargetCollection} ...");
            await UpsertWithProgressAsync(targetStore, plan.Documents);

            Console.WriteLine("Reading destination container after import to confirm the write landed ...");
            var postImportDocs = await ReadStoreAsync(targetStore, config.TargetDatabase, config.TargetCollection);
            var verification = VerifyRestoredDocuments(plan.Documents, postImportDocs);
            Console.WriteLine($"Post-import destination count: {postImportDocs.Count} document(s). Verified {verification.Found}/{verification.Expected} restored document id(s) are present.");
            if (verification.Missing.Count > 0)
            {
                Console.Error.WriteLine($"Post-import verification failed: missing restored document id(s): {string.Join(", ", verification.Missing.Take(10))}{(verification.Missing.Count > 10 ? ", ..." : string.Empty)}");
                return 3;
            }

            Console.WriteLine($"Done. Imported {plan.Documents.Count} E2EE document(s). Target pre-import backup at {targetBackup}.");
            return 0;
        }

        private static async Task<int> VerifyParityAsync(Encryptor oldEncryptor, Config config, string[] args)
        {
            var positional = PositionalArgs(args.Skip(1)).ToArray();
            if (positional.Length == 0)
            {
                Console.Error.WriteLine("verify-parity requires an old snapshot and either a new snapshot or --new-store.");
                return 1;
            }

            var dekEncryptor = DekEncryptor(args);
            var oldDocs = ReadJsonArrayFile(positional[0]);
            List<JObject> newDocs;
            if (args.Contains("--new-store"))
            {
                await using var targetStore = NewStore(config, target: true);
                newDocs = await ReadStoreAsync(targetStore, config.TargetDatabase, config.TargetCollection);
            }
            else
            {
                if (positional.Length < 2)
                {
                    Console.Error.WriteLine("verify-parity requires a new snapshot unless --new-store is supplied.");
                    return 1;
                }
                newDocs = ReadJsonArrayFile(positional[1]);
            }

            var result = BlueGreenVaultTransformer.VerifyParity(oldEncryptor, dekEncryptor, oldDocs, newDocs);
            foreach (var error in result.Errors)
            {
                Console.WriteLine($"  ✗ {error}");
            }
            Console.WriteLine();
            Console.WriteLine($"Parity verification: {result.AccountsChecked} account(s), {result.SecretsChecked} secret(s) checked, {result.Errors.Count} error(s).");
            return result.Success ? 0 : 3;
        }

        private static string Backup(List<JObject> docs, string? path, string label = "Backup")
        {
            path ??= $"vault-backup-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json";
            File.WriteAllText(path, JsonConvert.SerializeObject(new JArray(docs), Formatting.Indented));
            Console.WriteLine($"{label} of {docs.Count} document(s) written to {path}.");
            return path;
        }

        private static string Id(JObject doc) => (string?)doc["id"] ?? "<no-id>";

        private static List<JObject> ReadJsonArrayFile(string path)
        {
            var token = JToken.Parse(File.ReadAllText(path));
            if (token is not JArray array)
            {
                throw new InvalidOperationException($"{path} must contain a JSON array.");
            }
            return array.OfType<JObject>().ToList();
        }

        private static IEnumerable<string> PositionalArgs(IEnumerable<string> args)
        {
            var skipNext = false;
            foreach (var arg in args)
            {
                if (skipNext)
                {
                    skipNext = false;
                    continue;
                }

                if (string.Equals(arg, "--dek-base64", StringComparison.Ordinal))
                {
                    skipNext = true;
                    continue;
                }

                if (!arg.StartsWith("--", StringComparison.Ordinal))
                {
                    yield return arg;
                }
            }
        }

        private static ISecretProtector DekEncryptor(string[] args)
        {
            var dek = OptionValue(args, "--dek-base64") ?? Environment.GetEnvironmentVariable("VAULT_DEK_BASE64");
            if (string.IsNullOrWhiteSpace(dek))
            {
                throw new InvalidOperationException("missing vault DEK: set VAULT_DEK_BASE64 or pass --dek-base64 <base64>");
            }

            return new E2eeDekProtector(dek);
        }

        private static SourceEncryptorSelection SourceBackupEncryptor(Config config)
        {
            var sourceKey = OptionalEnv("SOURCE_AES_KEY") ?? PromptSecretOptional("Backup/source AES key (press Enter if same as destination): ");
            var sourceIv = OptionalEnv("SOURCE_AES_IV") ?? PromptSecretOptional("Backup/source AES IV (press Enter if same as destination): ");
            var usesDestinationKey = string.IsNullOrWhiteSpace(sourceKey) && string.IsNullOrWhiteSpace(sourceIv);

            sourceKey = string.IsNullOrWhiteSpace(sourceKey) ? config.AesKey : sourceKey;
            sourceIv = string.IsNullOrWhiteSpace(sourceIv) ? config.AesIv : sourceIv;
            return new SourceEncryptorSelection(new Encryptor(sourceKey, sourceIv), usesDestinationKey);
        }

        private static async Task UpsertWithProgressAsync(IVaultStore store, IReadOnlyList<JObject> docs)
        {
            for (var i = 0; i < docs.Count; i++)
            {
                await store.UpsertAsync(docs[i]);
                var completed = i + 1;
                if (completed == docs.Count || completed % 50 == 0)
                {
                    Console.WriteLine($"  Upserted {completed}/{docs.Count} document(s) ...");
                }
            }
        }

        private static RestoreWriteVerification VerifyRestoredDocuments(IReadOnlyList<JObject> expectedDocs, IReadOnlyList<JObject> actualDocs)
        {
            var actualIds = actualDocs
                .Select(Id)
                .Where(id => id != "<no-id>")
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var missing = expectedDocs
                .Select(Id)
                .Where(id => id != "<no-id>" && !actualIds.Contains(id))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return new RestoreWriteVerification(expectedDocs.Count, expectedDocs.Count - missing.Count, missing);
        }

        private static string? OptionValue(string[] args, string name)
        {
            for (var i = 0; i < args.Length - 1; i++)
            {
                if (string.Equals(args[i], name, StringComparison.Ordinal))
                {
                    return args[i + 1];
                }
            }
            return null;
        }

        private static CosmosVaultStore NewStore(Config config, bool target) =>
            target
                ? NewCosmosStore(config.TargetCosmosConnection, config.TargetDatabase, config.TargetCollection, "destination/target")
                : NewCosmosStore(config.CosmosConnection, config.Database, config.Collection, "source/current");

        private static CosmosVaultStore NewCosmosStore(string connection, string database, string collection, string label)
        {
            if (string.IsNullOrWhiteSpace(connection) || string.IsNullOrWhiteSpace(database) || string.IsNullOrWhiteSpace(collection))
            {
                throw new InvalidOperationException($"missing {label} Cosmos configuration");
            }
            return new CosmosVaultStore(connection, database, collection);
        }

        private static void PrintUsage()
        {
            Console.WriteLine("vault-migrate — MIG-2/MIG-5 operator tool");
            Console.WriteLine();
            Console.WriteLine("Usage:");
            Console.WriteLine("  vault-migrate backup [file]     Snapshot all documents to JSON (default: timestamped file)");
            Console.WriteLine("  vault-migrate verify            Decrypt every secret and report undecryptable entries");
            Console.WriteLine("  vault-migrate migrate           DRY RUN: show what would be re-encrypted to v2 (writes a backup)");
            Console.WriteLine("  vault-migrate migrate --apply   Re-encrypt legacy v1 secrets to v2 and write them back");
            Console.WriteLine("  vault-migrate import <backup.json> [--apply]");
            Console.WriteLine("  vault-migrate import <backup.json> --e2ee [--apply] [--dek-base64 <b64>]");
            Console.WriteLine("  vault-migrate verify-parity <old.json> <new.json> [--dek-base64 <b64>]");
            Console.WriteLine("  vault-migrate verify-parity <old.json> --new-store [--dek-base64 <b64>]");
            Console.WriteLine();
            Console.WriteLine("Configuration:");
            Console.WriteLine("  COSMOSDB, COSMOS_DATABASE_NAME, COSMOS_COLLECTION_NAME for store reads/writes");
            Console.WriteLine("  AesKey/AesIV may be set in env; otherwise the tool prompts without echoing input");
            Console.WriteLine("  SOURCE_AES_KEY/SOURCE_AES_IV may be set for import; otherwise the tool prompts");
            Console.WriteLine("  VAULT_DEK_BASE64 for --e2ee import/verify-parity (unless --dek-base64 is supplied)");
            Console.WriteLine("  Optional target overrides: NEW_COSMOSDB, NEW_COSMOS_DATABASE_NAME, NEW_COSMOS_COLLECTION_NAME");
        }

        private sealed record SourceEncryptorSelection(Encryptor Encryptor, bool UsesDestinationKey);

        private sealed record RestoreWriteVerification(int Expected, int Found, IReadOnlyList<string> Missing);

        private sealed record Config(string CosmosConnection, string Database, string Collection, string TargetCosmosConnection, string TargetDatabase, string TargetCollection, string AesKey, string AesIv)
        {
            public string SourceStoreDescription() =>
                StoreDescription("Source/current", CosmosConnection, Database, Collection);

            public string TargetStoreDescription() =>
                StoreDescription("Destination/target", TargetCosmosConnection, TargetDatabase, TargetCollection);

            private static string StoreDescription(string label, string connection, string database, string collection) =>
                $"{label} Cosmos store: endpoint={ConnectionEndpoint(connection)}, database={ValueOrMissing(database)}, container={ValueOrMissing(collection)}";

            private static string ConnectionEndpoint(string connection)
            {
                if (string.IsNullOrWhiteSpace(connection))
                {
                    return "<missing COSMOSDB>";
                }

                var endpoint = connection.Split(';', StringSplitOptions.RemoveEmptyEntries)
                    .Select(part => part.Split('=', 2))
                    .FirstOrDefault(parts => parts.Length == 2 && string.Equals(parts[0], "AccountEndpoint", StringComparison.OrdinalIgnoreCase));

                return endpoint is null ? "<COSMOSDB present; endpoint not parseable>" : endpoint[1];
            }

            private static string ValueOrMissing(string value) =>
                string.IsNullOrWhiteSpace(value) ? "<missing>" : value;

            public static Config FromEnvironment()
            {
                var cosmos = Optional("COSMOSDB") ?? string.Empty;
                var database = Optional("COSMOS_DATABASE_NAME") ?? string.Empty;
                var collection = Optional("COSMOS_COLLECTION_NAME") ?? string.Empty;

                return new Config(
                    cosmos,
                    database,
                    collection,
                    Optional("NEW_COSMOSDB") ?? cosmos,
                    Optional("NEW_COSMOS_DATABASE_NAME") ?? database,
                    Optional("NEW_COSMOS_COLLECTION_NAME") ?? collection,
                    Optional("AesKey") ?? Optional("ENCRYPTION_KEY") ?? PromptSecretRequired("Destination/current vault AES key (AesKey): "),
                    Optional("AesIV") ?? Optional("ENCRYPTION_IV") ?? PromptSecretRequired("Destination/current vault AES IV (AesIV): "));

                static string? Optional(string name)
                {
                    return OptionalEnv(name);
                }
            }
        }

        private static string? OptionalEnv(string name)
        {
            var value = Environment.GetEnvironmentVariable(name);
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }

        private static string PromptSecretRequired(string prompt)
        {
            var value = PromptSecretOptional(prompt);
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new InvalidOperationException($"missing required value: {prompt.TrimEnd(' ', ':')}");
            }

            return value;
        }

        private static string? PromptSecretOptional(string prompt)
        {
            if (Console.IsInputRedirected)
            {
                return null;
            }

            Console.Error.Write(prompt);
            var chars = new List<char>();
            while (true)
            {
                var key = Console.ReadKey(intercept: true);
                if (key.Key == ConsoleKey.Enter)
                {
                    Console.Error.WriteLine();
                    return chars.Count == 0 ? null : new string(chars.ToArray());
                }

                if (key.Key == ConsoleKey.Backspace)
                {
                    if (chars.Count > 0)
                    {
                        chars.RemoveAt(chars.Count - 1);
                    }
                    continue;
                }

                if (!char.IsControl(key.KeyChar))
                {
                    chars.Add(key.KeyChar);
                }
            }
        }
    }
}
