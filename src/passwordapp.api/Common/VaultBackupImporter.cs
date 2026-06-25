using Newtonsoft.Json.Linq;

namespace PasswordService.Common
{
    /// <summary>
    /// Restores JSON backups exported from the current Cosmos container. The backup contains
    /// encrypted secrets, so restore verifies/decrypts with the configured app Encryptor, migrates
    /// any legacy v1 blobs to the current v2 shape, and strips Cosmos system metadata before upsert.
    /// </summary>
    public static class VaultBackupImporter
    {
        private static readonly HashSet<string> CosmosSystemProperties = new(StringComparer.OrdinalIgnoreCase)
        {
            "_rid",
            "_self",
            "_etag",
            "_attachments",
            "_ts",
        };

        public sealed record RestorePlan(
            int DocumentsReady,
            int DocumentsFailed,
            int SecretsTransformed,
            int SecretsVerified,
            IReadOnlyList<string> Errors,
            IReadOnlyList<JObject> Documents);

        public static RestorePlan PlanRestore(Encryptor encryptor, IEnumerable<JObject> backupDocs)
        {
            return PlanRestore(encryptor, encryptor, backupDocs);
        }

        public static RestorePlan PlanRestore(Encryptor sourceEncryptor, Encryptor targetEncryptor, IEnumerable<JObject> backupDocs)
        {
            ArgumentNullException.ThrowIfNull(sourceEncryptor);
            ArgumentNullException.ThrowIfNull(targetEncryptor);
            ArgumentNullException.ThrowIfNull(backupDocs);

            var documents = new List<JObject>();
            var errors = new List<string>();
            int ready = 0, failed = 0, transformed = 0, verified = 0;

            foreach (var backupDoc in backupDocs)
            {
                var doc = SanitizeForRestore(backupDoc);
                var id = Id(doc);
                var docErrors = new List<string>();

                if (string.IsNullOrWhiteSpace(ReadStringProperty(doc, "id")))
                {
                    docErrors.Add("missing id");
                }

                transformed += TransformDocument(sourceEncryptor, targetEncryptor, doc, docErrors);

                var verification = DocumentMigrator.VerifyDocument(targetEncryptor, doc);
                verified += verification.Ok;
                if (verification.Failed > 0)
                {
                    docErrors.AddRange(verification.Errors.Select(e => $"post-restore verification failed: {e}"));
                }

                if (docErrors.Count == 0)
                {
                    ready++;
                    documents.Add(doc);
                }
                else
                {
                    failed++;
                    errors.AddRange(docErrors.Select(e => $"{id}: {e}"));
                }
            }

            return new RestorePlan(ready, failed, transformed, verified, errors, documents);
        }

        public static JObject SanitizeForRestore(JObject backupDoc)
        {
            ArgumentNullException.ThrowIfNull(backupDoc);
            var output = (JObject)backupDoc.DeepClone();
            foreach (var prop in output.Properties().Where(p => CosmosSystemProperties.Contains(p.Name)).ToList())
            {
                prop.Remove();
            }

            return output;
        }

        private static string Id(JObject doc) => ReadStringProperty(doc, "id") ?? "<no-id>";

        private static string? ReadStringProperty(JObject obj, string name) =>
            (string?)obj.Properties().FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase))?.Value;

        private static int TransformDocument(Encryptor sourceEncryptor, Encryptor targetEncryptor, JObject doc, List<string> errors)
        {
            var transformed = 0;

            var currentProp = FindProperty(doc, "currentPassword");
            if (currentProp?.Value.Type == JTokenType.String)
            {
                var newBlob = TransformSecret(sourceEncryptor, targetEncryptor, (string?)currentProp.Value, "currentPassword", errors);
                if (newBlob is not null)
                {
                    currentProp.Value = newBlob;
                    transformed++;
                }
            }
            else
            {
                errors.Add("currentPassword: missing secret");
            }

            if (FindProperty(doc, "oldPasswords")?.Value is JArray history)
            {
                for (var i = 0; i < history.Count; i++)
                {
                    if (history[i] is not JObject entry)
                    {
                        errors.Add($"oldPasswords[{i}]: entry is not an object");
                        continue;
                    }

                    var passwordProp = FindProperty(entry, "password");
                    if (passwordProp?.Value is JObject secret)
                    {
                        var blob = ReadPasswordEntityBlob(secret);
                        var newBlob = TransformSecret(sourceEncryptor, targetEncryptor, blob, $"oldPasswords[{i}]", errors);
                        if (newBlob is not null)
                        {
                            WritePasswordEntityBlob(secret, newBlob);
                            transformed++;
                        }
                    }
                    else if (passwordProp?.Value.Type == JTokenType.String)
                    {
                        var newBlob = TransformSecret(sourceEncryptor, targetEncryptor, (string?)passwordProp.Value, $"oldPasswords[{i}]", errors);
                        if (newBlob is not null)
                        {
                            passwordProp.Value = newBlob;
                            transformed++;
                        }
                    }
                }
            }

            return transformed;
        }

        private static string? TransformSecret(Encryptor sourceEncryptor, Encryptor targetEncryptor, string? sourceBlob, string where, List<string> errors)
        {
            if (string.IsNullOrWhiteSpace(sourceBlob))
            {
                errors.Add($"{where}: missing secret");
                return null;
            }

            var plaintext = SafeDecrypt(sourceEncryptor, sourceBlob);
            if (plaintext is null)
            {
                errors.Add($"{where}: decrypt failed");
                return null;
            }

            var targetBlob = targetEncryptor.EncryptGcm(plaintext);
            var verify = SafeDecrypt(targetEncryptor, targetBlob);
            if (!string.Equals(verify, plaintext, StringComparison.Ordinal))
            {
                errors.Add($"{where}: target re-encryption failed verification");
                return null;
            }

            return targetBlob;
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

        private static string? ReadPasswordEntityBlob(JObject secret)
        {
            var cipher = ReadStringProperty(secret, "encryptedPassword");
            if (string.IsNullOrEmpty(cipher))
            {
                return null;
            }

            var iv = ReadStringProperty(secret, "iv");
            if (!string.IsNullOrEmpty(iv))
            {
                return SecretEnvelope.FromV2Gcm(iv, cipher).Serialize();
            }

            var hmac = ReadStringProperty(secret, "hmacHash");
            return string.IsNullOrEmpty(hmac) ? null : SecretEnvelope.FromV1(hmac, cipher).Serialize();
        }

        private static void WritePasswordEntityBlob(JObject secret, string v2Blob)
        {
            var envelope = SecretEnvelope.Parse(v2Blob);
            SetProperty(secret, "encryptedPassword", envelope.CipherTextAndTag);
            SetProperty(secret, "iv", envelope.Iv);

            var hmacProp = FindProperty(secret, "hmacHash");
            if (hmacProp is not null)
            {
                hmacProp.Value = JValue.CreateNull();
            }
        }

        private static void SetProperty(JObject obj, string name, string? value)
        {
            var existing = FindProperty(obj, name);
            if (existing is not null)
            {
                existing.Value = value;
            }
            else
            {
                obj.Add(name, value);
            }
        }

        private static JProperty? FindProperty(JObject obj, string name) =>
            obj.Properties().FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
    }
}
