using Newtonsoft.Json.Linq;

namespace PasswordService.Common
{
    /// <summary>
    /// Pure MIG-4/MIG-5 logic for the blue-green E2EE rebuild. It transforms exported legacy
    /// account documents into the new DEK-encrypted schema and verifies old/new parity without any
    /// dependency on Cosmos.
    /// </summary>
    public static class BlueGreenVaultTransformer
    {
        public sealed record TransformResult(bool Success, JObject? Document, int SecretsTransformed, int AlreadyNew, IReadOnlyList<string> Errors)
        {
            public bool ShouldWrite => Success && Document is not null;
        }

        public sealed record ImportPlan(int DocumentsReady, int DocumentsFailed, int SecretsTransformed, int AlreadyNew, IReadOnlyList<string> Errors, IReadOnlyList<JObject> Documents);

        public sealed record ParityResult(bool Success, int AccountsChecked, int SecretsChecked, IReadOnlyList<string> Errors);

        public static ImportPlan PlanImport(Encryptor oldEncryptor, Encryptor dekEncryptor, IEnumerable<JObject> sourceDocs)
        {
            var documents = new List<JObject>();
            var errors = new List<string>();
            int ready = 0, failed = 0, transformed = 0, alreadyNew = 0;

            foreach (var source in sourceDocs)
            {
                var id = Id(source);
                var result = TransformDocument(oldEncryptor, dekEncryptor, source);
                transformed += result.SecretsTransformed;
                alreadyNew += result.AlreadyNew;
                if (result.Success && result.Document is not null)
                {
                    ready++;
                    documents.Add(result.Document);
                }
                else
                {
                    failed++;
                    errors.AddRange(result.Errors.Select(e => $"{id}: {e}"));
                }
            }

            return new ImportPlan(ready, failed, transformed, alreadyNew, errors, documents);
        }

        public static TransformResult TransformDocument(Encryptor oldEncryptor, Encryptor dekEncryptor, JObject source)
        {
            ArgumentNullException.ThrowIfNull(source);
            var errors = new List<string>();
            int transformed = 0, alreadyNew = 0;

            var output = new JObject();
            CopyIfPresent(source, output, "PartitionKey");
            CopyIfPresent(source, output, "id");
            CopyIfPresent(source, output, "SiteName");
            CopyIfPresent(source, output, "AccountName");

            var currentBlob = ReadStringProperty(source, "CurrentPassword");
            var current = TransformSecret(oldEncryptor, dekEncryptor, currentBlob, "CurrentPassword");
            Tally(current);
            if (current.Success)
            {
                output["CurrentPassword"] = current.Blob;
            }

            var historyOutput = new JArray();
            if (FindProperty(source, "OldPasswords")?.Value is JArray history)
            {
                for (var i = 0; i < history.Count; i++)
                {
                    if (history[i] is not JObject entry)
                    {
                        errors.Add($"OldPasswords[{i}]: entry is not an object");
                        continue;
                    }

                    var secret = ReadHistorySecret(entry);
                    var transformedSecret = TransformSecret(oldEncryptor, dekEncryptor, secret, $"OldPasswords[{i}].Password");
                    Tally(transformedSecret);
                    if (!transformedSecret.Success)
                    {
                        continue;
                    }

                    var newEntry = new JObject { ["Password"] = transformedSecret.Blob };
                    var createdDate = FindProperty(entry, "CreatedDate");
                    if (createdDate is not null)
                    {
                        newEntry["CreatedDate"] = createdDate.Value.DeepClone();
                    }
                    historyOutput.Add(newEntry);
                }
            }
            output["OldPasswords"] = historyOutput;

            return errors.Count == 0
                ? new TransformResult(true, output, transformed, alreadyNew, errors)
                : new TransformResult(false, null, transformed, alreadyNew, errors);

            void Tally(SecretTransform secret)
            {
                if (!secret.Success)
                {
                    errors.Add(secret.Error!);
                }
                else if (secret.AlreadyNew)
                {
                    alreadyNew++;
                }
                else
                {
                    transformed++;
                }
            }
        }

        public static ParityResult VerifyParity(Encryptor oldEncryptor, Encryptor dekEncryptor, IEnumerable<JObject> oldDocs, IEnumerable<JObject> newDocs)
        {
            var errors = new List<string>();
            var oldById = IndexById(oldDocs, "old", errors);
            var newById = IndexById(newDocs, "new", errors);
            var accountsChecked = 0;
            var secretsChecked = 0;

            foreach (var (id, oldDoc) in oldById)
            {
                if (!newById.TryGetValue(id, out var newDoc))
                {
                    errors.Add($"{id}: missing from new store");
                    continue;
                }

                accountsChecked++;
                CompareSecret(id, "CurrentPassword", ReadStringProperty(oldDoc, "CurrentPassword"), oldEncryptor, ReadStringProperty(newDoc, "CurrentPassword"), dekEncryptor);

                var oldHistory = FindProperty(oldDoc, "OldPasswords")?.Value as JArray ?? new JArray();
                var newHistory = FindProperty(newDoc, "OldPasswords")?.Value as JArray ?? new JArray();
                if (oldHistory.Count != newHistory.Count)
                {
                    errors.Add($"{id}: history count mismatch old={oldHistory.Count} new={newHistory.Count}");
                }

                var count = Math.Min(oldHistory.Count, newHistory.Count);
                for (var i = 0; i < count; i++)
                {
                    var oldEntry = oldHistory[i] as JObject;
                    var newEntry = newHistory[i] as JObject;
                    CompareSecret(id, $"OldPasswords[{i}].Password", oldEntry is null ? null : ReadHistorySecret(oldEntry), oldEncryptor, newEntry is null ? null : ReadHistorySecret(newEntry), dekEncryptor);
                }
            }

            foreach (var id in newById.Keys.Except(oldById.Keys, StringComparer.Ordinal))
            {
                errors.Add($"{id}: extra in new store");
            }

            return new ParityResult(errors.Count == 0, accountsChecked, secretsChecked, errors);

            void CompareSecret(string id, string where, string? oldBlob, Encryptor oldE, string? newBlob, Encryptor newE)
            {
                var oldPlain = string.IsNullOrWhiteSpace(oldBlob) ? null : SafeDecrypt(oldE, oldBlob);
                var newPlain = string.IsNullOrWhiteSpace(newBlob) ? null : SafeDecrypt(newE, newBlob);
                if (oldPlain is null)
                {
                    errors.Add($"{id}: {where}: old decrypt failed");
                    return;
                }
                if (newPlain is null)
                {
                    errors.Add($"{id}: {where}: new decrypt failed");
                    return;
                }
                secretsChecked++;
                if (!string.Equals(oldPlain, newPlain, StringComparison.Ordinal))
                {
                    errors.Add($"{id}: {where}: value mismatch");
                }
            }
        }

        private sealed record SecretTransform(bool Success, string? Blob, bool AlreadyNew, string? Error);

        private static SecretTransform TransformSecret(Encryptor oldEncryptor, Encryptor dekEncryptor, string? sourceBlob, string where)
        {
            if (string.IsNullOrWhiteSpace(sourceBlob))
            {
                return new SecretTransform(false, null, false, $"{where}: missing secret");
            }

            var plaintext = SafeDecrypt(oldEncryptor, sourceBlob);
            if (plaintext is not null)
            {
                var newBlob = dekEncryptor.EncryptGcm(plaintext);
                return VerifyNewBlob(dekEncryptor, newBlob, plaintext, where, alreadyNew: false);
            }

            plaintext = SafeDecrypt(dekEncryptor, sourceBlob);
            if (plaintext is not null)
            {
                return VerifyNewBlob(dekEncryptor, sourceBlob, plaintext, where, alreadyNew: true);
            }

            return new SecretTransform(false, null, false, $"{where}: decrypt failed");
        }

        private static SecretTransform VerifyNewBlob(Encryptor dekEncryptor, string blob, string plaintext, string where, bool alreadyNew)
        {
            if (!blob.StartsWith("v2.gcm.", StringComparison.Ordinal))
            {
                return new SecretTransform(false, null, alreadyNew, $"{where}: transformed secret is not v2.gcm");
            }

            var verify = SafeDecrypt(dekEncryptor, blob);
            return string.Equals(verify, plaintext, StringComparison.Ordinal)
                ? new SecretTransform(true, blob, alreadyNew, null)
                : new SecretTransform(false, null, alreadyNew, $"{where}: transform verification failed");
        }

        private static Dictionary<string, JObject> IndexById(IEnumerable<JObject> docs, string label, List<string> errors)
        {
            var result = new Dictionary<string, JObject>(StringComparer.Ordinal);
            foreach (var doc in docs)
            {
                var id = ReadStringProperty(doc, "id");
                if (string.IsNullOrWhiteSpace(id))
                {
                    errors.Add($"{label}: document missing id");
                    continue;
                }
                if (!result.TryAdd(id, doc))
                {
                    errors.Add($"{label}: duplicate id {id}");
                }
            }
            return result;
        }

        private static string? SafeDecrypt(Encryptor encryptor, string stored)
        {
            try
            {
                return encryptor.DecryptStored(stored);
            }
            catch (FormatException)
            {
                return null;
            }
        }

        private static string? ReadHistorySecret(JObject entry)
        {
            var value = FindProperty(entry, "Password")?.Value;
            return value switch
            {
                JValue { Type: JTokenType.String } s => (string?)s,
                JObject secret => ReadPasswordEntityBlob(secret),
                _ => null,
            };
        }

        private static string? ReadPasswordEntityBlob(JObject secret)
        {
            var cipher = ReadStringProperty(secret, "EncryptedPassword");
            if (string.IsNullOrEmpty(cipher))
            {
                return null;
            }

            var iv = ReadStringProperty(secret, "Iv");
            if (!string.IsNullOrEmpty(iv))
            {
                return SecretEnvelope.FromV2Gcm(iv, cipher).Serialize();
            }

            var hmac = ReadStringProperty(secret, "HmacHash");
            return string.IsNullOrEmpty(hmac) ? null : SecretEnvelope.FromV1(hmac, cipher).Serialize();
        }

        private static void CopyIfPresent(JObject source, JObject target, string name)
        {
            var prop = FindProperty(source, name);
            if (prop is not null)
            {
                target[name] = prop.Value.DeepClone();
            }
        }

        private static string Id(JObject doc) => ReadStringProperty(doc, "id") ?? "<no-id>";

        private static string? ReadStringProperty(JObject obj, string name) => (string?)FindProperty(obj, name)?.Value;

        private static JProperty? FindProperty(JObject obj, string name) =>
            obj.Properties().FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
    }
}
