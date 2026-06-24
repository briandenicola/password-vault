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
            await using var store = new CosmosVaultStore(config.CosmosConnection, config.Database, config.Collection);

            Console.WriteLine($"Reading all documents from {config.Database}/{config.Collection} ...");
            var docs = await store.ReadAllAsync();
            Console.WriteLine($"Loaded {docs.Count} document(s).");

            switch (command)
            {
                case "backup":
                    Backup(docs, args.ElementAtOrDefault(1));
                    return 0;

                case "verify":
                    return Verify(encryptor, docs);

                case "migrate":
                    return await MigrateAsync(encryptor, store, docs, apply);

                default:
                    PrintUsage();
                    return 1;
            }
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

        private static async Task<int> MigrateAsync(Encryptor encryptor, CosmosVaultStore store, List<JObject> docs, bool apply)
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

        private static string Backup(List<JObject> docs, string? path)
        {
            path ??= $"vault-backup-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json";
            File.WriteAllText(path, JsonConvert.SerializeObject(new JArray(docs), Formatting.Indented));
            Console.WriteLine($"Backup of {docs.Count} document(s) written to {path}.");
            return path;
        }

        private static string Id(JObject doc) => (string?)doc["id"] ?? "<no-id>";

        private static void PrintUsage()
        {
            Console.WriteLine("vault-migrate — MIG-2/MIG-3 operator tool");
            Console.WriteLine();
            Console.WriteLine("Usage:");
            Console.WriteLine("  vault-migrate backup [file]     Snapshot all documents to JSON (default: timestamped file)");
            Console.WriteLine("  vault-migrate verify            Decrypt every secret and report undecryptable entries");
            Console.WriteLine("  vault-migrate migrate           DRY RUN: show what would be re-encrypted to v2 (writes a backup)");
            Console.WriteLine("  vault-migrate migrate --apply   Re-encrypt legacy v1 secrets to v2 and write them back");
            Console.WriteLine();
            Console.WriteLine("Required environment variables:");
            Console.WriteLine("  COSMOSDB, COSMOS_DATABASE_NAME, COSMOS_COLLECTION_NAME, AesKey, AesIV");
        }

        private sealed record Config(string CosmosConnection, string Database, string Collection, string AesKey, string AesIv)
        {
            public static Config FromEnvironment()
            {
                static string Require(string name) =>
                    Environment.GetEnvironmentVariable(name)
                    ?? throw new InvalidOperationException($"missing environment variable '{name}'");

                return new Config(
                    Require("COSMOSDB"),
                    Require("COSMOS_DATABASE_NAME"),
                    Require("COSMOS_COLLECTION_NAME"),
                    Require("AesKey"),
                    Require("AesIV"));
            }
        }
    }
}
